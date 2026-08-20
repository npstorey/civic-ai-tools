// Self-test for scripts/check-spec-frontmatter.mjs.
//
// The known-bad fixture is the REAL defective frontmatter that shipped as spec
// v0.1.5, recovered verbatim from the merge commit that carried it:
//
//   git show 87c4fb5:docs/architecture/typed-standards-specification.md | sed -n '1,9p'
//
// It is pinned here rather than described, so the check is demonstrated against
// the actual historical defect instead of a reconstruction of it. The live
// document is the passing case, and a version/tag-mismatch fixture covers the
// rule that parseability alone would not catch.
//
// Run: node --test scripts/check-spec-frontmatter.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KNOWN_KEYS,
  SPEC_PATH,
  TAG_SUFFIX,
  checkFrontmatter,
  extractFrontmatter,
  isQuoted,
  plainValueColonIndex,
  runFrontmatterCheck,
  scalarValue,
} from './check-spec-frontmatter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

/**
 * KNOWN-BAD, VERBATIM: spec v0.1.5's frontmatter as merged at 87c4fb5.
 * The defect is on the `Version` line — a single unquoted scalar carrying a
 * second `tag: ` mapping inside it. Kept as separate line strings so no
 * template-literal escaping can silently alter the recovered bytes.
 */
const V015_FRONTMATTER = [
  '---',
  'Status: v0.1 Working Draft — open for external review (review window to be scheduled)',
  'Spec name: Typed Standards Specification',
  'Version: v0.1.5 (patch revision of the v0.1 Working Draft; tag: `v0.1.5-typed-standards-spec`)',
  'License: CC BY 4.0',
  'Last updated: 2026-08-19',
  'Maintainer: Nathan Storey (current; see reviewer-orientation document for stewardship and contact details)',
  'Canonical URL: [TK: typedstandards.org/specs/v0.1/ once typedstandards.org is registered and the spec is published there]',
  '---',
  '',
  '# Typed Standards Specification',
  '',
].join('\n');

/** A well-formed block, used as the positive control the other fixtures vary from. */
function goodBlock(overrides = {}) {
  const fields = {
    Status: 'v0.1 Working Draft — open for external review (review window to be scheduled)',
    'Spec name': 'Typed Standards Specification',
    Version: 'v0.1.7',
    Tag: 'v0.1.7-typed-standards-spec',
    License: 'CC BY 4.0',
    'Last updated': '2026-08-20',
    Maintainer: 'Nathan Storey (current)',
    'Canonical URL': '"[TK: typedstandards.org/specs/v0.1/ once published there]"',
    ...overrides,
  };
  const body = KNOWN_KEYS.filter((k) => fields[k] !== undefined).map((k) => `${k}: ${fields[k]}`);
  return ['---', ...body, '---', '', '# Typed Standards Specification', ''].join('\n');
}

test('extractFrontmatter finds the fenced block and reports its line numbers', () => {
  const got = extractFrontmatter(V015_FRONTMATTER);
  assert.equal(got.ok, true);
  assert.equal(got.lines.length, 7, 'seven mapping lines between the fences');
  assert.equal(got.lines[0].line, 2, 'first mapping line is document line 2');
  assert.match(got.lines[2].text, /^Version: /);
});

test('extractFrontmatter rejects a document with no opening fence', () => {
  const got = extractFrontmatter('# Typed Standards Specification\n');
  assert.equal(got.ok, false);
  assert.equal(got.kind, 'missing-frontmatter');
});

test('extractFrontmatter rejects an unterminated block', () => {
  const got = extractFrontmatter('---\nVersion: v0.1.7\n\n# Heading\n');
  assert.equal(got.ok, false);
  assert.equal(got.kind, 'unterminated-frontmatter');
});

test('quoting exempts a value from the mapping-indicator rule', () => {
  assert.equal(isQuoted('"a: b"'), true);
  assert.equal(isQuoted("'a: b'"), true);
  assert.equal(isQuoted('a: b'), false);
  assert.equal(scalarValue('"a: b"'), 'a: b');
  assert.equal(scalarValue('a b'), 'a b');
  assert.equal(plainValueColonIndex('"a: b"'), -1, 'quoted value exempt');
  assert.equal(plainValueColonIndex('v0.1.7'), -1, 'clean plain value');
  assert.equal(plainValueColonIndex('v0.1.5 (tag: `x`)'), 11, 'plain value with ": " reported');
  assert.equal(plainValueColonIndex('trailing:'), 8, 'a trailing bare colon is the same class');
});

test('KNOWN-BAD (the real v0.1.5 frontmatter) FAILS, naming the defect', () => {
  const { violations } = checkFrontmatter(V015_FRONTMATTER);
  assert.ok(violations.length > 0, 'the historical defect is rejected');

  const colon = violations.find((v) => v.kind === 'colon-in-plain-value');
  assert.ok(colon, 'the mapping-indicator rule fires');
  assert.equal(colon.key, 'Version', 'and names the Version line as the offender');
  assert.equal(colon.line, 4, 'at document line 4');
  assert.match(colon.message, /v0\.1\.5 defect class/, 'the message names the defect class');
  const rawVersion = V015_FRONTMATTER.split('\n')[3].slice('Version: '.length);
  const offset = Number(colon.message.match(/offset (\d+)/)[1]);
  assert.equal(
    rawVersion.slice(offset - 3, offset + 1),
    'tag:',
    'the reported offset points at the second `tag:` mapping buried in the Version scalar',
  );

  // The same block also trips the two rules added on top of parseability:
  // there is no `Tag` key at all, and `Version` carries commentary.
  assert.ok(
    violations.some((v) => v.kind === 'missing-key' && v.key === 'Tag'),
    'v0.1.5 had no separate Tag key',
  );
  assert.ok(
    violations.some((v) => v.kind === 'version-format'),
    'v0.1.5 Version is not a bare patch version',
  );
});

test('PASSING (the live specification) — the current frontmatter is clean', () => {
  const source = readFileSync(join(repoRoot, SPEC_PATH), 'utf8');
  const { violations, keys } = checkFrontmatter(source);
  assert.deepEqual(violations, [], 'the tracked specification satisfies every rule');
  assert.equal(keys.size, KNOWN_KEYS.length, 'every known key is present exactly once');
  const version = scalarValue(keys.get('Version'));
  const tag = scalarValue(keys.get('Tag'));
  assert.match(version, /^v\d+\.\d+\.\d+$/, 'Version is a full patch version');
  assert.equal(tag, `${version}${TAG_SUFFIX}`, 'Tag names the same revision');
});

test('version/tag mismatch FAILS — the rule parseability alone would miss', () => {
  const stale = goodBlock({ Version: 'v0.1.7', Tag: 'v0.1.6-typed-standards-spec' });

  // The block is perfectly well-formed YAML; only the agreement rule catches it.
  const clean = checkFrontmatter(goodBlock());
  assert.deepEqual(clean.violations, [], 'positive control passes');

  const { violations } = checkFrontmatter(stale);
  assert.equal(violations.length, 1, 'exactly one rule fires — the failure mode is isolated');
  assert.equal(violations[0].kind, 'version-tag-mismatch');
  assert.match(violations[0].message, /v0\.1\.7-typed-standards-spec/, 'the expected tag is named');
});

test('shape rules: unknown key, duplicate key, and non-mapping lines are rejected', () => {
  const unknown = checkFrontmatter(goodBlock().replace('License: ', 'Licence: '));
  assert.ok(
    unknown.violations.some((v) => v.kind === 'unknown-key' && v.key === 'Licence'),
    'a misspelled key is not silently accepted',
  );
  assert.ok(
    unknown.violations.some((v) => v.kind === 'missing-key' && v.key === 'License'),
    'and the real key is reported absent',
  );

  const duplicated = checkFrontmatter(goodBlock().replace('Tag: ', 'Tag: v0.1.7-typed-standards-spec\nTag: '));
  assert.ok(
    duplicated.violations.some((v) => v.kind === 'duplicate-key' && v.key === 'Tag'),
    'a repeated key is reported',
  );

  const nested = checkFrontmatter(goodBlock().replace('License: CC BY 4.0', 'License:\n  name: CC BY 4.0'));
  assert.ok(
    nested.violations.some((v) => v.kind === 'malformed-line'),
    'nesting is not admitted in this flat block',
  );
});

test('bad version formats are rejected', () => {
  for (const bad of ['v0.1', '0.1.7', 'v0.1.7-rc1', 'v0.1.7 ']) {
    const { violations } = checkFrontmatter(
      goodBlock({ Version: bad, Tag: `${bad}${TAG_SUFFIX}` }),
    );
    assert.ok(
      violations.some((v) => v.kind === 'version-format'),
      `${JSON.stringify(bad)} is rejected as a Version`,
    );
  }
});

test('passing case: the real repository satisfies the check', () => {
  const { results, ok } = runFrontmatterCheck(repoRoot);
  assert.equal(results.length, 1, 'the one governed document is checked');
  assert.deepEqual(results[0].violations, [], `${results[0].relPath}: no violations`);
  assert.equal(ok, true);
});

test('an unreadable target fails rather than passing quietly', () => {
  const { results, ok } = runFrontmatterCheck(repoRoot, ['docs/architecture/does-not-exist.md']);
  assert.equal(ok, false);
  assert.equal(results[0].violations[0].kind, 'unreadable');
});
