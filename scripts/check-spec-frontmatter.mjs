#!/usr/bin/env node
/**
 * check-spec-frontmatter.mjs — zero-dependency validator for the Typed
 * Standards Specification's YAML frontmatter block.
 *
 * WHY THIS EXISTS. Spec v0.1.5 shipped a frontmatter block whose `Version:`
 * line was written as a single unquoted scalar that itself contained a second
 * `tag: ` mapping. That is not valid YAML: the block became machine-unreadable,
 * GitHub's renderer showed an error banner on the canonical URL, and the whole
 * point of the header-semver rider — an external integrator reading a precise
 * version identifier out of the document itself — was defeated. The defect was
 * caught by eye on a rendered page and fixed in v0.1.6 (see Appendix G). Two
 * coordination layers had "validated" the change by reading its content without
 * parsing it. This script is the durable instrument that replaces the eye.
 *
 * WHAT IT CHECKS (four rules; the last two are a strictly stronger net than
 * "does it parse"):
 *
 *  (a) shape — the file opens with a `---`-fenced block, and every line inside
 *      it is `Key: value` with `Key` drawn from a fixed known-key set. Each
 *      known key appears exactly once. Blank lines, comments, nesting, and list
 *      items are rejected: this block is a fixed metadata table, and anything
 *      else in it is a signal, not a style choice.
 *
 *  (b) no `": "` inside a plain (unquoted) value — the exact v0.1.5 defect
 *      class. In YAML a colon-space sequence inside a plain scalar is a mapping
 *      indicator, so such a value either fails to parse or silently parses as
 *      something other than the string the author wrote. Quoted values are
 *      exempt, because quoting is precisely how YAML says "this colon is
 *      content". A trailing bare `:` is caught by the same rule.
 *
 *  (c) `Version` matches `^v\d+\.\d+\.\d+$` — a full patch version, not the
 *      coarse draft number and not a version with commentary appended.
 *
 *  (d) `Tag` is exactly `<Version>-typed-standards-spec`. Parseability alone
 *      would not catch a well-formed block whose Version and Tag disagree —
 *      a bumped version with a stale tag is a wrong citation target for every
 *      integrator that embeds one. Rule (d) is the reason this checker is not
 *      just "run a YAML parser".
 *
 * WHY NO YAML LIBRARY. Same reason as the sibling checkers in this directory:
 * dependency-free by charter (docs/architecture/xanadu-doctrine.md — do not
 * grow the surface without an adopter that needs it), and CI here installs only
 * what the one workspace needs. The grammar this block is allowed to use is a
 * fixed flat map of eight scalar keys, which is small enough to implement
 * exactly. Implementing it also lets rules (b)–(d) report *which* rule broke
 * and where, rather than a parser's position-only error.
 *
 * Zero dependencies: Node built-ins only. Run via `npm run check:spec-frontmatter`.
 * Self-test: `npm run check:spec-frontmatter:self-test`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

/** The one document this check governs, relative to the repo root. */
export const SPEC_PATH = 'docs/architecture/typed-standards-specification.md';

/**
 * The frontmatter's known keys. Every one is required and may appear once.
 * Adding a key here is a deliberate change to the document's metadata contract.
 */
export const KNOWN_KEYS = [
  'Status',
  'Spec name',
  'Version',
  'Tag',
  'License',
  'Last updated',
  'Maintainer',
  'Canonical URL',
];

/** `Tag` must be `<Version>` plus this suffix — the repo's spec-tag convention. */
export const TAG_SUFFIX = '-typed-standards-spec';

/** A full patch version: `v` + three dot-separated integers, nothing else. */
export const VERSION_RE = /^v\d+\.\d+\.\d+$/;

const FENCE = '---';
const LINE_RE = /^([A-Za-z][A-Za-z0-9 _-]*): (.*)$/;

/**
 * Split a document into its frontmatter lines and the rest.
 * Returns { ok: true, lines, endLine } or { ok: false, kind, message }.
 * `lines` are [{ text, line }] with 1-based line numbers into the document.
 */
export function extractFrontmatter(source) {
  const withoutBom = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const all = withoutBom.split('\n');
  if (all[0] !== FENCE) {
    return {
      ok: false,
      kind: 'missing-frontmatter',
      message: `line 1 is not the opening \`${FENCE}\` fence (found ${JSON.stringify(all[0] ?? '')})`,
    };
  }
  for (let i = 1; i < all.length; i += 1) {
    if (all[i] === FENCE) {
      const lines = [];
      for (let j = 1; j < i; j += 1) lines.push({ text: all[j], line: j + 1 });
      return { ok: true, lines, endLine: i + 1 };
    }
  }
  return {
    ok: false,
    kind: 'unterminated-frontmatter',
    message: `no closing \`${FENCE}\` fence found after line 1`,
  };
}

/**
 * Is this raw value a quoted scalar? Quoting is how YAML says "the colons in
 * here are content"; a quoted value is therefore exempt from rule (b).
 */
export function isQuoted(raw) {
  if (raw.length < 2) return false;
  const first = raw[0];
  const last = raw[raw.length - 1];
  return (first === '"' && last === '"') || (first === "'" && last === "'");
}

/** The scalar a raw value denotes: quotes stripped when present, else as written. */
export function scalarValue(raw) {
  return isQuoted(raw) ? raw.slice(1, -1) : raw;
}

/**
 * Rule (b): a plain scalar must not contain a mapping indicator.
 * Returns the offending index, or -1 when clean.
 */
export function plainValueColonIndex(raw) {
  if (isQuoted(raw)) return -1;
  const withSpace = raw.indexOf(': ');
  if (withSpace !== -1) return withSpace;
  if (raw.endsWith(':')) return raw.length - 1;
  return -1;
}

/**
 * Validate one document's frontmatter.
 * Returns { violations, keys } — `keys` is a Map of key -> raw value for the
 * lines that were well-formed enough to yield one.
 */
export function checkFrontmatter(source) {
  const violations = [];
  const keys = new Map();

  const extracted = extractFrontmatter(source);
  if (!extracted.ok) {
    violations.push({ kind: extracted.kind, message: extracted.message });
    return { violations, keys };
  }

  // (a) shape: every line is `Key: value` over a known, non-repeating key set.
  for (const { text, line } of extracted.lines) {
    const m = LINE_RE.exec(text);
    if (!m) {
      violations.push({
        kind: 'malformed-line',
        line,
        message:
          `line ${line}: not a \`Key: value\` mapping line ` +
          `(${JSON.stringify(text)}). The frontmatter is a flat map of scalars; ` +
          `blank lines, comments, nesting, and list items are not admitted here.`,
      });
      continue;
    }
    const [, key, raw] = m;
    if (!KNOWN_KEYS.includes(key)) {
      violations.push({
        kind: 'unknown-key',
        line,
        key,
        message: `line ${line}: unknown key "${key}" (known keys: ${KNOWN_KEYS.join(', ')})`,
      });
      continue;
    }
    if (keys.has(key)) {
      violations.push({
        kind: 'duplicate-key',
        line,
        key,
        message: `line ${line}: key "${key}" appears more than once`,
      });
      continue;
    }
    keys.set(key, raw);

    // (b) the v0.1.5 defect class.
    const colonAt = plainValueColonIndex(raw);
    if (colonAt !== -1) {
      violations.push({
        kind: 'colon-in-plain-value',
        line,
        key,
        message:
          `line ${line}: key "${key}" has an unquoted value containing a mapping ` +
          `indicator at offset ${colonAt} (${JSON.stringify(raw.slice(colonAt, colonAt + 24))}). ` +
          `A plain YAML scalar may not contain ": " — the value either fails to ` +
          `parse or silently parses as something other than the intended string. ` +
          `This is the v0.1.5 defect class. Quote the value, or move the second ` +
          `field into its own key.`,
      });
    }
  }

  for (const key of KNOWN_KEYS) {
    if (!keys.has(key)) {
      violations.push({
        kind: 'missing-key',
        key,
        message: `required key "${key}" is absent from the frontmatter`,
      });
    }
  }

  // (c) Version shape.
  const versionRaw = keys.get('Version');
  const version = versionRaw === undefined ? undefined : scalarValue(versionRaw);
  if (version !== undefined && !VERSION_RE.test(version)) {
    violations.push({
      kind: 'version-format',
      key: 'Version',
      message:
        `Version ${JSON.stringify(version)} does not match ${VERSION_RE} — ` +
        `the frontmatter must carry the full patch version (e.g. "v0.1.7"), ` +
        `not the coarse draft number and not a version with commentary appended.`,
    });
  }

  // (d) Tag agrees with Version.
  const tagRaw = keys.get('Tag');
  const tag = tagRaw === undefined ? undefined : scalarValue(tagRaw);
  if (version !== undefined && tag !== undefined) {
    const expected = `${version}${TAG_SUFFIX}`;
    if (tag !== expected) {
      violations.push({
        kind: 'version-tag-mismatch',
        key: 'Tag',
        message:
          `Tag ${JSON.stringify(tag)} does not equal ${JSON.stringify(expected)} ` +
          `(Version ${JSON.stringify(version)} + "${TAG_SUFFIX}"). A version bumped ` +
          `without its tag leaves every integrator citing the wrong revision.`,
      });
    }
  }

  return { violations, keys };
}

/** Run the check over one or more files. Returns { results, ok }. */
export function runFrontmatterCheck(repoRoot, relPaths = [SPEC_PATH]) {
  const results = relPaths.map((relPath) => {
    const abs = resolve(repoRoot, relPath);
    let source;
    try {
      source = readFileSync(abs, 'utf8');
    } catch (err) {
      return {
        relPath,
        violations: [{ kind: 'unreadable', message: `cannot read ${relPath}: ${err.message}` }],
        keys: new Map(),
      };
    }
    return { relPath, ...checkFrontmatter(source) };
  });
  const ok = results.every((r) => r.violations.length === 0);
  return { results, ok };
}

function main() {
  const args = process.argv.slice(2);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  let repoRoot = resolve(scriptDir, '..');
  const files = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root' && args[i + 1]) repoRoot = resolve(args[(i += 1)]);
    else if (args[i] === '--file' && args[i + 1]) files.push(args[(i += 1)]);
    else {
      console.error(`usage: check-spec-frontmatter.mjs [--root <dir>] [--file <path>]...`);
      process.exit(2);
    }
  }

  const { results, ok } = runFrontmatterCheck(repoRoot, files.length > 0 ? files : [SPEC_PATH]);
  for (const { relPath, violations, keys } of results) {
    if (violations.length === 0) {
      console.log(
        `OK   ${relPath} — ${keys.size} keys, Version ${scalarValue(keys.get('Version'))}, ` +
          `Tag ${scalarValue(keys.get('Tag'))}`,
      );
    } else {
      console.log(`FAIL ${relPath}`);
      for (const v of violations) console.log(`  [${v.kind}] ${v.message}`);
    }
  }
  if (!ok) {
    console.error(
      '\nSpec-frontmatter check FAILED. The frontmatter of the Typed Standards ' +
        'Specification must be a flat, parseable map of the known keys, with Tag ' +
        'agreeing with Version. See scripts/check-spec-frontmatter.mjs for the rules.',
    );
    process.exit(1);
  }
  console.log('\nSpec-frontmatter check passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
