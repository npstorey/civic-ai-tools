// Self-test for scripts/check-dependency-budget.mjs.
//
// Demonstrates BOTH chartered failure modes against committed fixtures
// (scripts/__fixtures__/budget-check/ — obviously-fake module names, never
// installed or built) plus the passing case against the real package and the
// real budget file. Run: node --test scripts/check-dependency-budget.test.mjs
//
// Copied from typedstandards@2eebbc5 (PR typedstandards#39) alongside the
// script it covers; the fixtures are byte-identical, only the "decisions of
// record" and "real packages" cases are re-pointed at this repo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkPackage,
  classifySpecifier,
  extractImports,
  ownerPackageOf,
  runBudgetCheck,
  stripComments,
} from './check-dependency-budget.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const fixturesRoot = join(here, '__fixtures__', 'budget-check');

test('ownerPackageOf resolves subpath imports to the owning package', () => {
  assert.equal(ownerPackageOf('@noble/curves/ed25519.js'), '@noble/curves');
  assert.equal(ownerPackageOf('@noble/curves/p256'), '@noble/curves');
  assert.equal(ownerPackageOf('left-pad/lib/deep.js'), 'left-pad');
  assert.equal(ownerPackageOf('canonicalize'), 'canonicalize');
});

test('classifySpecifier skips relative, node builtins, and internal imports', () => {
  assert.equal(classifySpecifier('./util.ts').kind, 'skip');
  assert.equal(classifySpecifier('../up.js').kind, 'skip');
  assert.equal(classifySpecifier('node:crypto').kind, 'skip');
  assert.equal(classifySpecifier('#internal/thing').kind, 'skip');
  assert.deepEqual(classifySpecifier('@noble/hashes/sha2.js'), {
    kind: 'bare',
    owner: '@noble/hashes',
  });
});

test('stripComments blanks comments but preserves strings and line count', () => {
  const src = [
    "const url = 'https://example.test/x'; // trailing comment",
    "// import ghost from 'commented-out-mod';",
    '/* import block from "block-mod"; */',
    "import real from 'real-mod';",
  ].join('\n');
  const out = stripComments(src);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.ok(out.includes("'https://example.test/x'"), 'string content survives');
  assert.ok(!out.includes('commented-out-mod'), 'line comment blanked');
  assert.ok(!out.includes('block-mod'), 'block comment blanked');
  assert.ok(out.includes("import real from 'real-mod';"), 'code survives');
});

test('extractImports covers static, side-effect, export-from, dynamic, require, and type-only forms', () => {
  const src = [
    "import a from 'mod-a';",
    "import { b } from '@scope/mod-b/sub.js';",
    "import type { T } from 'mod-type';",
    "import 'mod-side-effect';",
    "export { c } from 'mod-c';",
    "export type { U } from 'mod-type-reexport';",
    "export * from 'mod-star';",
    "const d = await import('mod-dynamic');",
    "const e = require('mod-required');",
  ].join('\n');
  const imports = extractImports(src);
  const bySpec = new Map(imports.map((i) => [i.specifier, i]));
  for (const spec of [
    'mod-a',
    '@scope/mod-b/sub.js',
    'mod-side-effect',
    'mod-c',
    'mod-star',
    'mod-dynamic',
    'mod-required',
  ]) {
    assert.ok(bySpec.has(spec), `found ${spec}`);
    assert.equal(bySpec.get(spec).typeOnly, false, `${spec} is a value import`);
  }
  assert.equal(bySpec.get('mod-type').typeOnly, true, 'import type is type-only');
  assert.equal(bySpec.get('mod-type-reexport').typeOnly, true, 'export type is type-only');
});

test('failure mode (a): phantom import — src imports absent from dependencies', () => {
  const { violations } = checkPackage(fixturesRoot, {
    path: 'phantom-pkg',
    name: 'fixture-phantom-pkg',
    budget: [],
  });
  const phantoms = violations.filter((v) => v.kind === 'phantom-import');
  assert.deepEqual(
    phantoms.map((v) => v.owner).sort(),
    ['@fake-scope/fake-lib', 'left-pad'],
    'exactly the two phantom value imports are reported',
  );
  const subpath = phantoms.find((v) => v.owner === '@fake-scope/fake-lib');
  assert.equal(
    subpath.specifier,
    '@fake-scope/fake-lib/subpath.js',
    'subpath import resolved to its owning package',
  );
  const owners = phantoms.map((v) => v.owner);
  assert.ok(!owners.includes('type-only-mod'), 'type-only import exempt');
  assert.ok(!owners.includes('commented-out-mod'), 'commented-out import exempt');
  assert.ok(!owners.includes('test-only-mod'), 'test-file import exempt');
  assert.equal(
    violations.filter((v) => v.kind === 'unbudgeted-dependency').length,
    0,
    'empty dependencies -> no (b) violations; failure mode (a) is isolated',
  );
});

test('failure mode (b): manifest dependency missing from the budget', () => {
  const { violations } = checkPackage(fixturesRoot, {
    path: 'unbudgeted-pkg',
    name: 'fixture-unbudgeted-pkg',
    budget: [],
  });
  const unbudgeted = violations.filter((v) => v.kind === 'unbudgeted-dependency');
  assert.deepEqual(
    unbudgeted.map((v) => v.dependency),
    ['left-pad'],
    'the declared-but-unbudgeted dependency is reported',
  );
  assert.equal(
    violations.filter((v) => v.kind === 'phantom-import').length,
    0,
    'left-pad is declared, so no (a) violation; failure mode (b) is isolated',
  );
});

test('budget file restates the decisions of record', () => {
  const doc = JSON.parse(readFileSync(join(here, 'dependency-budgets.json'), 'utf8'));
  const byName = new Map(doc.packages.map((p) => [p.name, p]));
  assert.deepEqual(
    byName.get('@typedstandards/civic-typed-harness').budget,
    ['@typedstandards/produce-core'],
    'harness: exactly one runtime dep per ADR-0022 §E + its 2026-08-02 addendum',
  );
  assert.match(
    byName.get('@typedstandards/civic-typed-harness').source,
    /ADR-0022/,
    'the budget entry cites the decision it restates',
  );
});

test('the harness does not declare or import verify-core directly', () => {
  // ADR-0022's 2026-08-02 addendum: produce-core 0.2.0 re-exports the whole
  // consumption set, so verify-core arrives transitively and must stay out of
  // both the manifest and shipped src. (Test files may import it — they are
  // exempt from the scan by design.) This is the exact regression the S3a PF1
  // phase caught by hand.
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, 'packages/civic-typed-harness/package.json'), 'utf8'),
  );
  assert.deepEqual(
    Object.keys(manifest.dependencies ?? {}),
    ['@typedstandards/produce-core'],
    'manifest declares produce-core and nothing else',
  );
  const { violations } = checkPackage(repoRoot, {
    path: 'packages/civic-typed-harness',
    name: '@typedstandards/civic-typed-harness',
    budget: ['@typedstandards/produce-core'],
  });
  assert.deepEqual(violations, [], 'shipped src imports nothing undeclared');
});

test('passing case: the real package satisfies its budget', () => {
  const doc = JSON.parse(readFileSync(join(here, 'dependency-budgets.json'), 'utf8'));
  const { results, ok } = runBudgetCheck(repoRoot, doc);
  assert.equal(results.length, 1, 'the one budgeted package is checked');
  for (const { entry, violations, scanned } of results) {
    assert.deepEqual(violations, [], `${entry.name}: no violations`);
    assert.ok(scanned.files > 0, `${entry.name}: shipped src actually scanned`);
    assert.ok(scanned.bareImports > 0, `${entry.name}: bare imports actually resolved`);
  }
  assert.equal(ok, true);
});
