// Self-test for scripts/check-verifier-subtype-set.mjs.
//
// Two registered sets are pinned here, verbatim from the published tarballs,
// so the check is demonstrated against the sets that shipped rather than a
// reconstruction of them:
//
//   REGISTERED_0_11_0 — `KNOWN_TYPE_URIS` in @typedstandards/verify-core
//     0.11.0, dist/checks.js lines 254-272 (`npm pack
//     @typedstandards/verify-core@0.11.0`, tarball shasum 511675d5…). The
//     first release that exports it.
//   INTERNAL_0_9_0 — the same constant in 0.9.0, dist/checks.js lines 138-155,
//     where it is not exported. 0.10.0 holds the identical list (lines
//     251-268). It is the registered set without `attestation/revises/v1`
//     that civic-ai-tools#230 records.
//
// The specification side is a small built document carrying the §8.12.1
// table over the 0.11.0 set's attestation/* members, so the instrument is
// proved independently of the live table's contents; two tests read the live
// document too — its table is found and parses, and the 0.9.0 list against it
// is reported missing attestation/revises/v1 (ratified by the owner's ruling
// on civic-ai-tools#230). The loader is driven
// against throwaway repository trees under the OS temp directory, each with a
// stand-in package installed where the consumer resolves it, so the
// never-skip rules are proved without depending on what this checkout has
// installed. The last test runs the CLI itself against such a tree.
//
// Run: node --test scripts/check-verifier-subtype-set.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONSUMER,
  EXPORT_NAME,
  VERIFIER_PACKAGE,
  checkVerifierSubtypeSet,
  loadInstalledVerifier,
  readRegisteredSet,
  readSpecTable,
  runVerifierSubtypeSetCheck,
} from './check-verifier-subtype-set.mjs';
import { SPEC_PATH } from './check-spec-subtype-table.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const LIVE_SPEC = readFileSync(join(repoRoot, SPEC_PATH), 'utf8');

/** VERBATIM: @typedstandards/verify-core 0.11.0, dist/checks.js lines 254-272. */
const REGISTERED_0_11_0 = Object.freeze([
  'content/analysis/v1',
  'attestation/withdraws/v1',
  'attestation/reinstates/v1',
  'attestation/supersedes/v1',
  'attestation/revises/v1',
  'attestation/publishes/v1',
  'attestation/locatedAt/v1',
  'attestation/corroborates/v1',
  'attestation/contradicts/v1',
  'attestation/endorses/v1',
  'attestation/wasDerivedFrom/v1',
  'attestation/answersQuestion/v1',
  'attestation/supportedBy/v1',
  'attestation/opposedBy/v1',
  'attestation/certifies/v1',
  'attestation/evaluates/v1',
  'attestation/conforms/v1',
]);

/** VERBATIM: @typedstandards/verify-core 0.9.0, dist/checks.js lines 138-155 (unexported there). */
const INTERNAL_0_9_0 = [
  'content/analysis/v1',
  'attestation/withdraws/v1',
  'attestation/reinstates/v1',
  'attestation/supersedes/v1',
  'attestation/publishes/v1',
  'attestation/locatedAt/v1',
  'attestation/corroborates/v1',
  'attestation/contradicts/v1',
  'attestation/endorses/v1',
  'attestation/wasDerivedFrom/v1',
  'attestation/answersQuestion/v1',
  'attestation/supportedBy/v1',
  'attestation/opposedBy/v1',
  'attestation/certifies/v1',
  'attestation/evaluates/v1',
  'attestation/conforms/v1',
];

const attestations = (list) => list.filter((u) => u.startsWith('attestation/'));
const kinds = (violations) => violations.map((v) => v.kind).sort();

/** A small document carrying only the §8.12.1 table, over the given URIs. */
function tableDoc(uris) {
  const out = ['# Spec', '', '### 8.12 The attestation/* namespace', '', 'Prose.', ''];
  out.push('#### 8.12.1 Sub-type table (v0.1 ratified)', '');
  out.push('| Sub-type | Relation kind | Authorization rule | Payload (beyond structural primitive) |', '|---|---|---|---|');
  for (const u of uris) out.push(`| \`${u}\` | kind | any-with-binding | \`targetNodeId\` |`);
  out.push('', '#### 8.12.2 Next', '', 'Prose.', '');
  return out.join('\n');
}

/** The default specification side: the table over the 0.11.0 set's attestation/* members. */
const SPEC_DOC = tableDoc(attestations(REGISTERED_0_11_0));

const check = (list, { specSource = SPEC_DOC, version = '0.11.0' } = {}) =>
  checkVerifierSubtypeSet({ specSource, namespace: { [EXPORT_NAME]: list }, version });

/** Replace the first occurrence of `from`, failing if it is absent — a no-op mutation would pass for the wrong reason. */
function mutate(source, from, to) {
  assert.ok(source.includes(from), `fixture mutation target not found: ${from}`);
  return source.replace(from, to);
}

// --- The pinned sets, and the live specification ---

test('the pinned copies: sixteen attestation/* URIs, and the 0.9.0 list is that set without revises', () => {
  assert.equal(attestations(REGISTERED_0_11_0).length, 16);
  assert.deepEqual(
    REGISTERED_0_11_0.filter((u) => !INTERNAL_0_9_0.includes(u)),
    ['attestation/revises/v1'],
    'the 0.9.0 list is the 0.11.0 list without attestation/revises/v1',
  );
  assert.equal(INTERNAL_0_9_0.length, REGISTERED_0_11_0.length - 1, 'and nothing else differs');
});

test('the live specification: the §8.12.1 table is found and parses, and the 0.9.0 list against it lacks revises', () => {
  const table = readSpecTable(LIVE_SPEC);
  assert.equal(table.ok, true, table.message);
  assert.ok(table.uris.length > 0);
  const { violations } = check(INTERNAL_0_9_0, { specSource: LIVE_SPEC, version: '0.9.0' });
  assert.ok(
    violations.some((v) => v.kind === 'missing' && v.subtype === 'attestation/revises/v1'),
    'against the live table, the registered set without attestation/revises/v1 is reported missing it',
  );
});

// --- GREEN: the registered set and the table agree ---

test('AGREEMENT PASSES: the table against the 0.11.0 registered set', () => {
  const { table, registered, violations } = check(REGISTERED_0_11_0);
  assert.deepEqual(violations, [], 'the positive control is clean');
  assert.equal(table.uris.length, 16);
  assert.equal(registered.uris.length, 16);
  assert.deepEqual(registered.other, ['content/analysis/v1'], 'the content/* member is reported as not compared');
});

// --- RED: each failure mode the contract names ---

test('MISSING: a copy of the registered set without attestation/revises/v1 fails, naming it', () => {
  const { violations } = check(REGISTERED_0_11_0.filter((u) => u !== 'attestation/revises/v1'));
  assert.deepEqual(kinds(violations), ['missing']);
  assert.equal(violations[0].subtype, 'attestation/revises/v1');
  assert.match(violations[0].message, /lacks attestation\/revises\/v1, which the §8\.12\.1 sub-type table \(lines \d+-\d+\) lists/);

  const shipped = check(INTERNAL_0_9_0, { version: '0.9.0' });
  assert.deepEqual(
    shipped.violations.map((v) => [v.kind, v.subtype]),
    [['missing', 'attestation/revises/v1']],
    'the list 0.9.0 and 0.10.0 held internally fails the same way',
  );
});

test('EXTRA: a registered attestation/* URI the table does not list fails, naming it', () => {
  const { violations } = check([...REGISTERED_0_11_0, 'attestation/rescinds/v1']);
  assert.deepEqual(kinds(violations), ['extra']);
  assert.equal(violations[0].subtype, 'attestation/rescinds/v1');

  const version = check(REGISTERED_0_11_0.map((u) => (u === 'attestation/conforms/v1' ? 'attestation/conforms/v2' : u)));
  assert.deepEqual(kinds(version.violations), ['extra', 'missing'], 'versions are compared, not just verbs');
});

test('NO EXPORT: a module without KNOWN_TYPE_URIS fails, naming the version — never a skip', () => {
  const { violations } = checkVerifierSubtypeSet({ specSource: SPEC_DOC, namespace: { resolvePackageType() {} }, version: '0.9.0' });
  assert.deepEqual(kinds(violations), ['no-export']);
  assert.match(violations[0].message, /@typedstandards\/verify-core 0\.9\.0 does not export KNOWN_TYPE_URIS/);
  assert.equal(readRegisteredSet(undefined, '0.9.0').kind, 'no-export', 'no namespace at all is the same failure');
});

test('MALFORMED: an export that is not a list of strings fails', () => {
  assert.deepEqual(kinds(check('attestation/revises/v1').violations), ['malformed']);
  assert.deepEqual(kinds(check([...REGISTERED_0_11_0, 7]).violations), ['malformed']);
  assert.deepEqual(kinds(check(new Set(REGISTERED_0_11_0)).violations), ['malformed']);
});

test('DUPLICATE: a URI listed twice on either side fails', () => {
  const reg = check([...REGISTERED_0_11_0, 'attestation/endorses/v1']);
  assert.deepEqual(reg.violations.map((v) => [v.kind, v.side, v.subtype]), [['duplicate', 'verifier', 'attestation/endorses/v1']]);
  const specSource = tableDoc([...attestations(REGISTERED_0_11_0), 'attestation/endorses/v1']);
  const spec = check(REGISTERED_0_11_0, { specSource });
  assert.deepEqual(spec.violations.map((v) => [v.kind, v.side]), [['duplicate', 'specification']]);
});

test('TABLE UNREADABLE: a table that cannot be found or parsed fails rather than comparing nothing', () => {
  const doc = SPEC_DOC;
  assert.deepEqual(check(REGISTERED_0_11_0).violations, [], 'the built document is a clean control');

  const noSection = check(REGISTERED_0_11_0, { specSource: mutate(doc, '#### 8.12.1 Sub-type table', '#### 8.12.1 Sub-types') });
  assert.deepEqual(kinds(noSection.violations), ['section-not-found']);

  const noHeader = check(REGISTERED_0_11_0, { specSource: mutate(doc, '| Sub-type |', '| Type |') });
  assert.deepEqual(kinds(noHeader.violations), ['statement-not-found']);

  const badRow = check(REGISTERED_0_11_0, { specSource: mutate(doc, '| `attestation/certifies/v1` |', '| certifies |') });
  assert.deepEqual(kinds(badRow.violations), ['unparseable']);

  const empty = check(REGISTERED_0_11_0, { specSource: tableDoc([]) });
  assert.deepEqual(kinds(empty.violations), ['empty']);

  const both = checkVerifierSubtypeSet({ specSource: '', namespace: {}, version: '0.9.0' });
  assert.deepEqual(kinds(both.violations), ['no-export', 'section-not-found'], 'both sides are reported, not the first alone');
});

test('NOT COMPARED: a content/* member on the verifier side does not fail', () => {
  assert.deepEqual(check([...REGISTERED_0_11_0, 'content/claim/v1']).violations, []);
  assert.deepEqual(check(attestations(REGISTERED_0_11_0)).violations, []);
});

// --- The loader and the runner, against throwaway repository trees ---

/**
 * A repository-shaped tree: the consumer's manifest (declaring `declared`, or
 * nothing when null), a stand-in verifier package at `version` exporting
 * `exportLine` (omitted when `install` is false), and the specification.
 */
function fakeRepo(t, { declared = '^0.11.0', version = '0.11.0', exportLine = null, install = true, spec = SPEC_DOC } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'verifier-subtype-set-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, CONSUMER), { recursive: true });
  const manifest = { name: 'consumer', version: '0.0.0', type: 'module' };
  if (declared) manifest.devDependencies = { [VERIFIER_PACKAGE]: declared };
  writeFileSync(join(root, CONSUMER, 'package.json'), JSON.stringify(manifest));
  if (install) {
    const pkgDir = join(root, 'node_modules', ...VERIFIER_PACKAGE.split('/'));
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: VERIFIER_PACKAGE,
        version,
        type: 'module',
        exports: { '.': { import: './index.js', default: './index.js' }, './package.json': './package.json' },
      }),
    );
    const line = exportLine ?? `export const ${EXPORT_NAME} = Object.freeze(${JSON.stringify(REGISTERED_0_11_0)});`;
    writeFileSync(join(pkgDir, 'index.js'), `export const TYPE_RESOLUTION_STATUSES = ['ok'];\n${line}\n`);
  }
  if (spec !== null) {
    mkdirSync(join(root, dirname(SPEC_PATH)), { recursive: true });
    writeFileSync(join(root, SPEC_PATH), spec);
  }
  return root;
}

const WITHOUT_EXPORT = 'export const somethingElse = 1;';

test('the runner passes on an installed package that exports the set', async (t) => {
  const root = fakeRepo(t);
  const result = await runVerifierSubtypeSetCheck(root);
  assert.deepEqual(result.violations, []);
  assert.equal(result.ok, true);
  assert.equal(result.installed.version, '0.11.0');
  assert.equal(result.registered.uris.length, 16);
});

test('the runner fails on an installed 0.9.0 without the export, naming the export and the version', async (t) => {
  const root = fakeRepo(t, { declared: '^0.9.0', version: '0.9.0', exportLine: WITHOUT_EXPORT });
  const result = await runVerifierSubtypeSetCheck(root);
  assert.equal(result.ok, false);
  assert.deepEqual(kinds(result.violations), ['no-export']);
  assert.match(result.violations[0].message, /verify-core 0\.9\.0 does not export KNOWN_TYPE_URIS/);
});

test('the runner fails when the package is not installed, not declared, or cannot be loaded', async (t) => {
  const missing = await runVerifierSubtypeSetCheck(fakeRepo(t, { install: false }));
  assert.deepEqual(kinds(missing.violations), ['not-installed']);

  const undeclared = await runVerifierSubtypeSetCheck(fakeRepo(t, { declared: null }));
  assert.deepEqual(kinds(undeclared.violations), ['not-declared'], 'a transitively installed copy is not compared');

  const broken = await runVerifierSubtypeSetCheck(fakeRepo(t, { exportLine: 'export const = ;' }));
  assert.deepEqual(kinds(broken.violations), ['unloadable']);

  const noConsumer = await loadInstalledVerifier(fakeRepo(t), 'packages/does-not-exist');
  assert.equal(noConsumer.kind, 'consumer-unreadable');
});

test('the runner fails when the specification cannot be read, and still reports the verifier side', async (t) => {
  const result = await runVerifierSubtypeSetCheck(fakeRepo(t, { spec: null }));
  assert.deepEqual(kinds(result.violations), ['unreadable']);
  const both = await runVerifierSubtypeSetCheck(fakeRepo(t, { spec: null, exportLine: WITHOUT_EXPORT }));
  assert.deepEqual(kinds(both.violations), ['no-export', 'unreadable']);
});

test('the CLI exits 1 on the 0.9.0 shape and 0 on the 0.11.0 shape', (t) => {
  const script = join(here, 'check-verifier-subtype-set.mjs');
  const red = spawnSync(process.execPath, [script, '--root', fakeRepo(t, { version: '0.9.0', exportLine: WITHOUT_EXPORT })], { encoding: 'utf8' });
  assert.equal(red.status, 1);
  assert.match(red.stdout, /\[no-export\] the installed @typedstandards\/verify-core 0\.9\.0 does not export KNOWN_TYPE_URIS/);
  assert.match(red.stderr, /Verifier-subtype-set check FAILED/);

  const green = spawnSync(process.execPath, [script, '--root', fakeRepo(t)], { encoding: 'utf8' });
  assert.equal(green.status, 0, green.stdout + green.stderr);
  assert.match(green.stdout, /Verifier-subtype-set check passed\./);
});
