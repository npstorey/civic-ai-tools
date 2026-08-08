#!/usr/bin/env node
/**
 * check-dependency-budget.mjs — zero-dependency dependency-budget checker.
 *
 * PROVENANCE: copied from typedstandards@2eebbc5, PR typedstandards#39.
 * Per project doctrine (docs/architecture/xanadu-doctrine.md) the two repos
 * duplicate this ~350-line zero-dependency script rather than mint a shared
 * package for it: nothing needs the abstraction yet, and a published tooling
 * package would be spec growth without an adopter. Keep the two copies
 * recognizably the same file — port fixes across, and re-stamp this line with
 * the source commit when you do.
 *
 * Enforces, per budgeted package (see scripts/dependency-budgets.json):
 *
 *  (a) phantom-import — shipped source (`src/`, test files and `__fixtures__`
 *      exempt) must not import a bare-specifier module whose owning package is
 *      absent from the manifest's `dependencies`. This is the class caught by
 *      hand twice before this check existed: typedstandards#35 (produce-core
 *      -> @noble/curves), and this repo's harness -> verify-core case in the
 *      S3a PF1 phase — the harness imported `@typedstandards/verify-core`
 *      directly while declaring only produce-core. ADR-0022's 2026-08-02
 *      addendum closed that by having produce-core 0.2.0 re-export the whole
 *      consumption set; this check keeps it closed.
 *
 *  (b) unbudgeted-dependency — the manifest's `dependencies` must not contain
 *      a package that is missing from the budget allowlist. The budget
 *      restates decisions of record; growing it means changing the decision,
 *      not just the manifest.
 *
 * Together: src bare imports ⊆ manifest dependencies ⊆ budget.
 *
 * Design choices (documented for the record):
 *  - Scope: only `dependencies` is budgeted. `devDependencies` is test/build
 *    tooling and stays unbudgeted; no budgeted package uses peerDependencies.
 *  - Import extraction: comments are stripped by a small string-aware state
 *    machine (so `//` inside string literals survives), then static
 *    `import ... from`, side-effect `import 'x'`, `export ... from`, dynamic
 *    `import('x')`, and `require('x')` forms are matched by regex. Known
 *    limitations (documented, acceptable for this codebase): regex literals
 *    containing `//` can blank the rest of their line (worst case a missed
 *    import on that line, never a false failure), and a string literal that
 *    itself contains an import statement would be scanned.
 *  - Type-only handling: `import type ... from` / `export type ... from` are
 *    exempt from check (a) — TypeScript erases them, so they create no runtime
 *    edge. Mixed imports with inline `type` specifiers (`import { type A, b }`)
 *    count as value imports, matching verbatim-module semantics. `.d.ts` files
 *    are skipped entirely.
 *  - Subpath imports resolve to their owning package: `@noble/curves/p256`
 *    -> `@noble/curves`; `left-pad/lib/x.js` -> `left-pad`.
 *  - Only `node:`-prefixed builtins are exempt. Un-prefixed builtins (e.g.
 *    `import 'crypto'`) fail check (a) on purpose — the harness's shipped src
 *    is browser-safe and Node-built-in-free per ADR-0022 §D (harness-grade
 *    purity), so such an import is a bug either way.
 *  - Self-references (a package importing its own name) are exempt.
 *
 * Zero dependencies: Node built-ins only. Run via `npm run check:budgets`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

/**
 * Blank out comments while preserving string contents and line structure.
 * Replaced characters become spaces; newlines are kept so line numbers
 * computed on the output match the input.
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | line | block | single | double | template
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = i + 1 < n ? source[i + 1] : '';
    if (state === 'code') {
      if (c === '/' && next === '/') {
        state = 'line';
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        state = 'block';
        out += '  ';
        i += 2;
        continue;
      }
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      out += c;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code';
        out += c;
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        out += '  ';
        i += 2;
        continue;
      }
      out += c === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    // Inside a string/template literal: honor escapes, look for the closer.
    if (c === '\\') {
      out += c + next;
      i += 2;
      continue;
    }
    if (
      (state === 'single' && c === "'") ||
      (state === 'double' && c === '"') ||
      (state === 'template' && c === '`')
    ) {
      state = 'code';
    }
    out += c;
    i += 1;
  }
  return out;
}

const IMPORT_PATTERNS = [
  {
    // import defaultExport, { named } from 'spec' | import type { T } from 'spec'
    re: /\bimport\s+(type\s+)?[^'";]*?\bfrom\s*(['"])([^'"\n]+)\2/g,
    typeOnly: (m) => Boolean(m[1]),
    spec: (m) => m[3],
  },
  {
    // side-effect import: import 'spec'
    re: /\bimport\s*(['"])([^'"\n]+)\1/g,
    typeOnly: () => false,
    spec: (m) => m[2],
  },
  {
    // export { x } from 'spec' | export * from 'spec' | export type { T } from 'spec'
    re: /\bexport\s+(type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"\n]+)\2/g,
    typeOnly: (m) => Boolean(m[1]),
    spec: (m) => m[3],
  },
  {
    // dynamic import('spec')
    re: /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
    typeOnly: () => false,
    spec: (m) => m[2],
  },
  {
    // require('spec')
    re: /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
    typeOnly: () => false,
    spec: (m) => m[2],
  },
];

/**
 * Extract module specifiers from a source text.
 * Returns [{ specifier, typeOnly, line }].
 */
export function extractImports(source) {
  const stripped = stripComments(source);
  const found = [];
  const seen = new Set(); // dedupe by match start index
  for (const pattern of IMPORT_PATTERNS) {
    pattern.re.lastIndex = 0;
    let m;
    while ((m = pattern.re.exec(stripped)) !== null) {
      const key = `${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const line = stripped.slice(0, m.index).split('\n').length;
      found.push({ specifier: pattern.spec(m), typeOnly: pattern.typeOnly(m), line });
    }
  }
  found.sort((a, b) => a.line - b.line);
  return found;
}

/** Owning package of a bare specifier: '@scope/pkg/sub' -> '@scope/pkg'; 'pkg/sub' -> 'pkg'. */
export function ownerPackageOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Classify a specifier: relative/internal/builtin specifiers are out of scope for the budget. */
export function classifySpecifier(specifier) {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#') || // package-internal imports map
    specifier.startsWith('node:') ||
    specifier.startsWith('data:') ||
    specifier.startsWith('file:')
  ) {
    return { kind: 'skip' };
  }
  return { kind: 'bare', owner: ownerPackageOf(specifier) };
}

const SOURCE_FILE_RE = /\.[cm]?[jt]sx?$/;
const TEST_FILE_RE = /\.test\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['__fixtures__', 'node_modules', 'dist']);

/** Recursively list shipped source files under dir (test files, fixtures, .d.ts excluded). */
export function walkSourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...walkSourceFiles(full));
      continue;
    }
    if (!SOURCE_FILE_RE.test(entry.name)) continue;
    if (TEST_FILE_RE.test(entry.name)) continue;
    if (entry.name.endsWith('.d.ts')) continue;
    files.push(full);
  }
  files.sort();
  return files;
}

/**
 * Check one budget entry ({ path, name, budget }) against the repo at repoRoot.
 * Returns { violations, warnings, scanned: { files, bareImports } }.
 */
export function checkPackage(repoRoot, entry) {
  const violations = [];
  const warnings = [];
  const pkgDir = resolve(repoRoot, entry.path);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  } catch (err) {
    violations.push({
      kind: 'config',
      package: entry.name,
      message: `cannot read ${entry.path}/package.json: ${err.message}`,
    });
    return { violations, warnings, scanned: { files: 0, bareImports: 0 } };
  }
  if (manifest.name !== entry.name) {
    violations.push({
      kind: 'config',
      package: entry.name,
      message: `budget entry names ${entry.name} but ${entry.path}/package.json is ${manifest.name}`,
    });
  }
  const deps = Object.keys(manifest.dependencies ?? {});

  // (b) every manifest dependency must be budgeted.
  for (const dep of deps) {
    if (!entry.budget.includes(dep)) {
      violations.push({
        kind: 'unbudgeted-dependency',
        package: entry.name,
        dependency: dep,
        message: `${entry.name}: manifest dependency "${dep}" is not in the budget [${entry.budget.join(', ')}]`,
      });
    }
  }

  // Stale-budget notice (non-failing): budgeted but not declared.
  for (const budgeted of entry.budget) {
    if (!deps.includes(budgeted)) {
      warnings.push(
        `${entry.name}: budgeted dependency "${budgeted}" is not declared in the manifest (stale budget?)`,
      );
    }
  }

  // (a) every bare value import in shipped src must be a declared dependency.
  let fileCount = 0;
  let bareImportCount = 0;
  for (const file of walkSourceFiles(join(pkgDir, 'src'))) {
    fileCount += 1;
    const relFile = relative(repoRoot, file);
    for (const imp of extractImports(readFileSync(file, 'utf8'))) {
      if (imp.typeOnly) continue;
      const cls = classifySpecifier(imp.specifier);
      if (cls.kind !== 'bare') continue;
      if (cls.owner === manifest.name) continue; // self-reference
      bareImportCount += 1;
      if (!deps.includes(cls.owner)) {
        violations.push({
          kind: 'phantom-import',
          package: entry.name,
          specifier: imp.specifier,
          owner: cls.owner,
          file: relFile,
          line: imp.line,
          message: `${entry.name}: ${relFile}:${imp.line} imports "${imp.specifier}" (package "${cls.owner}") which is not in dependencies`,
        });
      }
    }
  }

  return { violations, warnings, scanned: { files: fileCount, bareImports: bareImportCount } };
}

/** Run every budget entry. Returns { results: [{ entry, ...checkPackage() }], ok }. */
export function runBudgetCheck(repoRoot, budgetsDoc) {
  const results = budgetsDoc.packages.map((entry) => ({ entry, ...checkPackage(repoRoot, entry) }));
  const ok = results.every((r) => r.violations.length === 0);
  return { results, ok };
}

function main() {
  const args = process.argv.slice(2);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  let budgetsPath = join(scriptDir, 'dependency-budgets.json');
  let repoRoot = resolve(scriptDir, '..');
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--budgets' && args[i + 1]) budgetsPath = resolve(args[(i += 1)]);
    else if (args[i] === '--root' && args[i + 1]) repoRoot = resolve(args[(i += 1)]);
    else {
      console.error(`usage: check-dependency-budget.mjs [--budgets <file>] [--root <dir>]`);
      process.exit(2);
    }
  }

  let budgetsDoc;
  try {
    budgetsDoc = JSON.parse(readFileSync(budgetsPath, 'utf8'));
  } catch (err) {
    console.error(`error: cannot read budgets file ${budgetsPath}: ${err.message}`);
    process.exit(2);
  }

  const { results, ok } = runBudgetCheck(repoRoot, budgetsDoc);
  for (const { entry, violations, warnings, scanned } of results) {
    if (violations.length === 0) {
      console.log(
        `OK   ${entry.name} — ${scanned.files} source files, ${scanned.bareImports} bare imports, ` +
          `budget [${entry.budget.join(', ')}]`,
      );
    } else {
      console.log(`FAIL ${entry.name}`);
      for (const v of violations) console.log(`  [${v.kind}] ${v.message}`);
    }
    for (const w of warnings) console.log(`  warn: ${w}`);
  }
  if (!ok) {
    console.error('\nDependency-budget check FAILED.');
    process.exit(1);
  }
  console.log('\nDependency-budget check passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
