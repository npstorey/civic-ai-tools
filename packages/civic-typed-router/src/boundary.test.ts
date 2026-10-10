// The core boundary: no file under `src/core/` imports from `src/civic/`, or
// from any package. A relative specifier must resolve inside `src/core/`; any
// other specifier — a bare package name, a `node:` built-in, a URL — fails.
// Type-only imports count: the boundary is about what core knows, not only
// what it loads.
//
// This is what makes `src/core/` extractable later as its own package
// (`@typedstandards/typed-router`, reserved) by moving the directory.
//
// The universe is every file under `src/core/`, of any extension, test files
// included; core's own unit tests therefore live outside it
// (`core-unit.test.ts`), because a test imports `node:test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = join(SRC_DIR, 'core');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

/** Blank comments, keeping string contents and line structure. */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i]!;
    const next = i + 1 < n ? source[i + 1] : '';
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') {
          out += source[i]! + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += source[i];
        i++;
      }
      out += source[i] ?? '';
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Every module specifier a source names: `import … from`, `export … from`,
 *  side-effect `import '…'`, dynamic `import('…')` and `require('…')`. A
 *  dynamic import or require whose argument is not a string literal is
 *  returned as `<non-literal>`, which no rule accepts. */
export function specifiersOf(source: string): string[] {
  const code = stripComments(source);
  const out: string[] = [];
  const patterns = [
    /\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
    /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const m of code.matchAll(pattern)) out.push(m[2]!);
  }
  const literalCalls = [...code.matchAll(/\b(?:import|require)\s*\(\s*['"]/g)].length;
  const allCalls = [...code.matchAll(/\b(?:import|require)\s*\(/g)].length;
  for (let k = literalCalls; k < allCalls; k++) out.push('<non-literal>');
  return out;
}

/** Why `specifier`, named in `file`, breaks the boundary; `null` if it does not. */
export function boundaryViolation(file: string, specifier: string, coreDir: string = CORE_DIR): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return `imports "${specifier}" — core imports nothing from any package (bare specifiers and node: built-ins included)`;
  }
  const target = resolve(dirname(file), specifier);
  if (target !== coreDir && !target.startsWith(coreDir + sep)) {
    return `imports "${specifier}", which resolves to ${relative(SRC_DIR, target)} — outside src/core/ (core never imports civic content)`;
  }
  return null;
}

test('boundary: the specifier reader finds every import form and ignores comments', () => {
  const sample = [
    "import { a } from './a.ts';",
    "import type { B } from '../civic/b.ts';",
    "export * from './c.ts';",
    "export { d } from 'some-package';",
    "import 'node:fs';",
    "const e = await import('./e.ts');",
    'const f = require("f");',
    'const g = await import(name);',
    "// import { h } from '../civic/h.ts';",
    "/* export * from 'node:path'; */",
    "const s = 'a string, not an import';",
  ].join('\n');
  assert.deepEqual(specifiersOf(sample).sort(), [
    '../civic/b.ts',
    './a.ts',
    './c.ts',
    './e.ts',
    '<non-literal>',
    'f',
    'node:fs',
    'some-package',
  ]);
});

test('boundary: the rule refuses civic, package and built-in specifiers and accepts core-relative ones', () => {
  const file = join(CORE_DIR, 'select.ts');
  assert.equal(boundaryViolation(file, './types.ts'), null);
  assert.equal(boundaryViolation(join(CORE_DIR, 'nested', 'x.ts'), '../types.ts'), null);
  assert.match(boundaryViolation(file, '../civic/env.ts')!, /outside src\/core/);
  assert.match(boundaryViolation(file, '../index.ts')!, /outside src\/core/);
  assert.match(boundaryViolation(file, './../civic/router.ts')!, /outside src\/core/);
  assert.match(boundaryViolation(file, 'openai')!, /any package/);
  assert.match(boundaryViolation(file, 'node:fs')!, /any package/);
  assert.match(boundaryViolation(file, '@typedstandards/produce-core')!, /any package/);
  assert.match(boundaryViolation(file, '<non-literal>')!, /any package/);
});

test('boundary: no file under src/core/ imports from src/civic/ or from any package', () => {
  const files = filesUnder(CORE_DIR);
  assert.ok(files.length >= 5, `expected the core modules, found ${files.length}`);
  // The reader finds core's real imports: index.ts re-exports four modules.
  const index = files.find((f) => relative(CORE_DIR, f) === 'index.ts');
  assert.ok(index, 'src/core/index.ts exists');
  assert.ok(specifiersOf(readFileSync(index!, 'utf8')).length >= 4, 'the reader finds core/index.ts\'s re-exports');

  const violations: string[] = [];
  for (const file of files) {
    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      const why = boundaryViolation(file, specifier);
      if (why) violations.push(`src/${relative(SRC_DIR, file)} ${why}`);
    }
  }
  assert.deepEqual(violations, [], violations.join('\n'));
});
