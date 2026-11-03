// A1.1 and A1.2 (hub #302, S1 P1): the four inventories.
//
//   A1.1  `node benchmark/inventories/build.mjs --check` rebuilds 7.json,
//         50.json, 200.json and 1000.json and their `.sha256` byte for byte;
//         each `.sha256` is the router's canonicalJson SHA-256 of the parsed
//         file.
//   A1.2  every entry of every file validates against schema.json;
//         createCivicRouter over to-manifest.mjs's output for 50, 200 and
//         1,000 passes its startup checks; no file holds a number, a boolean
//         or null.
//   And the composition: each size's count by source is the one build.mjs
//   states (COMPOSITION), each larger size holds the smaller one's entries
//   unchanged and in the same order, and the extracted sources re-extract
//   byte for byte where the owner's local inputs are present.
//
// A missing file fails at an assertion, so the test is red before P1 builds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { canonicalJson, createCivicRouter, exposedToolName, sha256Hex, TOOL_NAME_PATTERN } from '@typedstandards/civic-typed-router';
import { COMPOSITION } from '../inventories/build.mjs';
import { toManifest } from '../inventories/to-manifest.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const at = (rel) => new URL(`../inventories/${rel}`, import.meta.url);
const SIZES = [7, 50, 200, 1000];
const LARGER = [50, 200, 1000];

/** An inventory by size, parsed; an assertion failure when it is absent. */
function inventory(size) {
  assert.ok(existsSync(at(`${size}.json`)), `benchmark/inventories/${size}.json exists`);
  return JSON.parse(readFileSync(at(`${size}.json`), 'utf8'));
}

/** Where an entry came from, as the composition counts it. */
function sourceOf(entry) {
  if (entry.synthetic === 'true') return entry.distractor.kind;
  if (entry.tools === 'not-captured') return 'registry';
  if (entry.kind === 'pack') return `${entry.catalog.platform}-pack`;
  return 'server';
}

const countBySource = (inv) => inv.entries.reduce((acc, e) => ({ ...acc, [sourceOf(e)]: (acc[sourceOf(e)] ?? 0) + 1 }), {});

/** Every value in `value` that is not a string, an array or an object, by
 *  path. */
function nonStrings(value, path = '$') {
  if (typeof value === 'string') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonStrings(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => nonStrings(v, `${path}.${k}`));
  return [`${path} = ${JSON.stringify(value)}`];
}

test('A1.1: build.mjs --check rebuilds the four inventories and their hashes byte for byte', () => {
  const run = spawnSync(process.execPath, ['benchmark/inventories/build.mjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stderr}`);
  for (const size of SIZES) assert.match(run.stdout, new RegExp(`\\b${size}\\.json, ${size}\\.json\\.sha256\\b`), `${size}.json and its hash are rebuilt`);
});

test("A1.1: each .sha256 is the router's canonicalJson SHA-256 of the parsed file", () => {
  for (const size of SIZES) {
    const inv = inventory(size);
    assert.ok(existsSync(at(`${size}.json.sha256`)), `${size}.json.sha256 exists`);
    const recorded = readFileSync(at(`${size}.json.sha256`), 'utf8');
    assert.match(recorded, /^[0-9a-f]{64}\n$/, `${size}.json.sha256`);
    assert.equal(recorded.trim(), sha256Hex(canonicalJson(inv)), `${size}.json.sha256`);
    assert.equal(inv.entries.length, size, `${size}.json has ${size} entries`);
  }
});

test('A1.2: no inventory holds a number, a boolean or null', () => {
  // The test of the test: the walk finds each of the three.
  assert.deepEqual(nonStrings({ a: ['x', { b: 7 }], c: true, d: null }), ['$.a[1].b = 7', '$.c = true', '$.d = null']);
  for (const size of SIZES) assert.deepEqual(nonStrings(inventory(size)), [], `${size}.json`);
});

test('A1.2: every entry of every inventory validates against schema.json', () => {
  const schema = JSON.parse(readFileSync(at('schema.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true }).compile(schema);
  for (const size of SIZES) {
    const inv = inventory(size);
    assert.equal(validate(inv), true, `${size}.json: ${JSON.stringify(validate.errors?.slice(0, 3))}`);
    for (const entry of inv.entries) {
      assert.equal(validate({ ...inv, entries: [entry] }), true, `${size}.json ${entry.alias}: ${JSON.stringify(validate.errors)}`);
    }
  }
  // The schema bites on what P1 adds: a count as a number, `synthetic` as a
  // boolean, a pack with no tools, a registry entry with tools.
  const inv = inventory(200);
  const pack = inv.entries.find((e) => e.kind === 'pack' && e.catalog);
  const distractor = inv.entries.find((e) => e.synthetic === 'true');
  const registry = inv.entries.find((e) => e.tools === 'not-captured');
  const one = (entry) => validate({ ...inv, entries: [entry] });
  assert.equal(one({ ...pack, catalog: { ...pack.catalog, datasetCount: 7 } }), false);
  assert.equal(one({ ...distractor, synthetic: true }), false);
  assert.equal(one({ ...pack, toolsRef: undefined }), false);
  assert.equal(one({ ...registry, toolsRef: pack.toolsRef }), false);
  assert.equal(one({ ...registry, categories: ['housing'] }), false);
});

test("A1.2: createCivicRouter over to-manifest's output for 50, 200 and 1,000 passes its startup checks", () => {
  for (const size of LARGER) {
    const inv = inventory(size);
    const manifest = toManifest(inv);
    const router = createCivicRouter(manifest);
    assert.deepEqual(
      router.manifest.map((e) => e.alias),
      inv.entries.map((e) => e.alias),
      `${size}: the router's manifest is the inventory, in order`,
    );
    // Every exposed name is valid and none was normalized: the alias rule keeps
    // `<alias>__<tool>` within 64 characters.
    for (const entry of manifest) {
      for (const tool of entry.tools) {
        const exposed = exposedToolName(entry.alias, tool.function.name);
        assert.match(exposed, TOOL_NAME_PATTERN);
        assert.equal(exposed, `${entry.alias}__${tool.function.name}`, `${size}: ${exposed} was not normalized`);
      }
    }
    const names = router.aliasedMcpToolsFor(undefined).map((t) => t.function.name);
    assert.equal(new Set(names).size, names.length, `${size}: every exposed name is unique`);
    // A registry entry loads no tools; a pack carries no portal lock and
    // shares no schema object with its base; a CKAN pack is a container.
    for (const [i, item] of inv.entries.entries()) {
      const entry = manifest[i];
      if (item.tools === 'not-captured') assert.deepEqual([entry.tools.length, entry.toolNames.length], [0, 0], item.alias);
      if (item.kind === 'pack') {
        assert.equal(entry.portalLock, undefined, item.alias);
        assert.equal(entry.prompt, undefined, item.alias);
        assert.equal(entry.toolsFor, undefined, item.alias);
      }
      if (item.hosting === 'container') assert.deepEqual(entry.hostings.map((h) => h.kind), ['container'], item.alias);
    }
  }
  // The startup checks bite: an alias two entries share fails them.
  const inv = inventory(50);
  const twice = { ...inv, entries: [...inv.entries, { ...inv.entries.find((e) => e.kind === 'pack'), sourceId: 'another' }] };
  assert.throws(() => createCivicRouter(toManifest(twice)));
});

test('the composition: each size by source, as build.mjs states it', () => {
  const c = COMPOSITION;
  const expected = {
    50: { server: c[50].servers, 'socrata-pack': c[50].socrataLargestUS, 'near-duplicate': c[50].nearDuplicates, wrapper: c[50].wrappers },
    200: {
      server: c[50].servers,
      'socrata-pack': c[50].socrataLargestUS + c[200].socrataUS50Plus + c[200].socrataUSOther,
      'ckan-pack': c[200].ckanUSActive,
      registry: c[200].registry,
      'near-duplicate': c[50].nearDuplicates + c[200].nearDuplicates,
      wrapper: c[50].wrappers + c[200].wrappers,
    },
    1000: {
      server: c[50].servers,
      'socrata-pack': c[50].socrataLargestUS + c[200].socrataUS50Plus + c[200].socrataUSOther + c[1000].socrataWithCountry,
      'ckan-pack': c[200].ckanUSActive + c[1000].ckanActive,
      registry: c[200].registry + c[1000].registry,
      'near-duplicate': c[50].nearDuplicates + c[200].nearDuplicates + c[1000].nearDuplicates,
      wrapper: c[50].wrappers + c[200].wrappers,
    },
  };
  for (const size of LARGER) {
    const counts = countBySource(inventory(size));
    assert.deepEqual(Object.fromEntries(Object.entries(counts).sort()), Object.fromEntries(Object.entries(expected[size]).sort()), `${size}.json by source`);
    assert.equal(Object.values(expected[size]).reduce((a, b) => a + b, 0), size);
  }
  // The remainder rule fills the 1,000 exactly.
  assert.equal(c[1000].nearDuplicates, 1000 - (c[1000].from200 + c[1000].socrataWithCountry + c[1000].ckanActive + c[1000].registry));
  assert.equal(c[200].from50 + c[200].socrataUS50Plus + c[200].socrataUSOther + c[200].ckanUSActive + c[200].registry + c[200].nearDuplicates + c[200].wrappers, 200);
});

test('the composition: each larger size holds the smaller one, unchanged and in order', () => {
  const pairs = [
    [7, 50],
    [50, 200],
    [200, 1000],
  ];
  for (const [small, large] of pairs) {
    const a = inventory(small);
    const b = inventory(large);
    const byAlias = new Map(b.entries.map((e) => [e.alias, e]));
    for (const entry of a.entries) assert.deepEqual(byAlias.get(entry.alias), entry, `${entry.alias} in ${large}.json as in ${small}.json`);
    if (small !== 7) {
      const kept = b.entries.map((e) => e.alias).filter((alias) => a.entries.some((e) => e.alias === alias));
      assert.deepEqual(kept, a.entries.map((e) => e.alias), `${small}.json's order holds in ${large}.json`);
    }
  }
  // Every distractor copies or wraps an entry of its own file, and none names
  // a publisher.
  for (const size of LARGER) {
    const inv = inventory(size);
    const aliases = new Set(inv.entries.map((e) => e.alias));
    for (const e of inv.entries.filter((x) => x.synthetic === 'true')) {
      assert.ok(aliases.has(e.distractor.of), `${size}: ${e.alias} copies ${e.distractor.of}`);
      assert.equal(e.publisher, undefined);
    }
  }
});

test("the registry load text is one fixed string, and a registry entry's tools are not captured", async () => {
  const mod = await import('../inventories/load-text.mjs').catch(() => ({}));
  assert.equal(typeof mod.REGISTRY_LOAD_TEXT, 'string', 'load-text.mjs exports REGISTRY_LOAD_TEXT');
  assert.match(mod.REGISTRY_LOAD_TEXT, /not captured/);
  for (const size of [200, 1000]) {
    for (const e of inventory(size).entries.filter((x) => x.provenance.from === 'registry')) assert.equal(e.tools, 'not-captured', e.alias);
  }
});

test("the extracted sources re-extract byte for byte from the owner's local inputs (skipped without them)", () => {
  assert.ok(existsSync(at('extract.mjs')), 'benchmark/inventories/extract.mjs exists');
  const run = spawnSync(process.execPath, ['benchmark/inventories/extract.mjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stderr}`);
  if (/SKIPPED/.test(run.stdout)) {
    console.log(run.stdout.trim());
  } else {
    assert.match(run.stdout, /registry-entries\.json, sources\/r5-servers\.json re-extracted byte for byte/);
  }
});
