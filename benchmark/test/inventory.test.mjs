// A0.6 (G0 ruling 1): the 7-entry inventory.
//
//   - `build.mjs --check` rebuilds 7.json byte for byte (also run as a command
//     in checks.test.mjs);
//   - 7.json.sha256 is the router's canonicalJson SHA-256 of the parsed file;
//   - every entry validates against schema.json;
//   - createCivicRouter over to-manifest.mjs's output passes its startup checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { canonicalJson, CIVIC_MANIFEST, createCivicRouter, sha256Hex } from '@typedstandards/civic-typed-router';
import { builtFiles, readSeven, routerDataFields, toolsSha256 } from '../inventories/build.mjs';
import { toManifest } from '../inventories/to-manifest.mjs';

const at = (rel) => new URL(`../inventories/${rel}`, import.meta.url);
const text = readFileSync(at('7.json'), 'utf8');
const inventory = JSON.parse(text);
const schema = JSON.parse(readFileSync(at('schema.json'), 'utf8'));

test('A0.6: build.mjs rebuilds 7.json and its hash byte for byte', async () => {
  for (const f of await builtFiles()) assert.equal(readFileSync(at(f.path), 'utf8'), f.text, f.path);
});

test("A0.6: 7.json.sha256 is the router's canonicalJson SHA-256 of the parsed file", () => {
  const recorded = readFileSync(at('7.json.sha256'), 'utf8');
  assert.match(recorded, /^[0-9a-f]{64}\n$/);
  assert.equal(recorded.trim(), sha256Hex(canonicalJson(inventory)));
  // canonicalJson refuses a number, a boolean and null, so an inventory holds
  // none: the hash above would have thrown.
  assert.throws(() => canonicalJson({ count: 7 }));
});

test('A0.6: every entry validates against schema.json', () => {
  const validate = new Ajv({ allErrors: true }).compile(schema);
  assert.equal(validate(inventory), true, JSON.stringify(validate.errors));
  assert.equal(inventory.entries.length, 7);
  for (const entry of inventory.entries) {
    const one = { ...inventory, entries: [entry] };
    assert.equal(validate(one), true, `${entry.alias}: ${JSON.stringify(validate.errors)}`);
  }
  // The schema bites: a number where a string belongs, and an unknown field.
  assert.equal(validate({ ...inventory, entries: [{ ...inventory.entries[0], description: 7 }] }), false);
  assert.equal(validate({ ...inventory, entries: [{ ...inventory.entries[0], stray: 'x' }] }), false);
});

test("A0.6: createCivicRouter over to-manifest's output passes its startup checks", () => {
  const manifest = toManifest(inventory);
  const router = createCivicRouter(manifest);
  assert.deepEqual(
    router.manifest.map((e) => e.alias),
    inventory.entries.map((e) => e.alias),
  );
  // The loader hands back the router's own entry wherever the router still
  // carries the server, so a composition over it is the website's; for a
  // source it no longer carries as a server (City Record, a pack since router
  // 0.8.0), an entry built from router 0.6.0's frozen copy. Either way each
  // entry's data fields, tool names and tools are the copy's.
  const seven = readSeven().entries;
  const live = new Map(CIVIC_MANIFEST.map((entry) => [entry.sourceId, entry]));
  assert.deepEqual(manifest.map((entry) => entry.sourceId), seven.map((entry) => entry.sourceId));
  for (const [i, entry] of manifest.entries()) {
    const own = live.get(entry.sourceId);
    if (own !== undefined && own.base === undefined && entry.sourceId === 'data-commons') {
      // Since inventory version 3 (hub #317) the router's Data Commons entry
      // states another id and freshnessSource: to-manifest returns its code
      // with the frozen copy's data fields.
      assert.notEqual(entry, own, `${entry.sourceId}: a copy`);
      for (const part of ['tools', 'guidance', 'prompt', 'toolsFor', 'portalLock']) assert.equal(entry[part], own[part], `${entry.sourceId}: the router's own ${part}`);
    } else if (own !== undefined && own.base === undefined) assert.equal(entry, own, `${entry.sourceId}: the router's own entry`);
    else assert.ok(!CIVIC_MANIFEST.includes(entry), `${entry.sourceId}: built from the frozen copy`);
    assert.deepEqual(routerDataFields(entry), routerDataFields(seven[i]), `${entry.sourceId}: the copy's data fields`);
    assert.deepEqual([...entry.toolNames], seven[i].toolNames, `${entry.sourceId}: the copy's tool names`);
    assert.equal(toolsSha256(entry.tools), toolsSha256(seven[i].tools), `${entry.sourceId}: the copy's tools`);
  }
  // And it refuses an inventory that drifts from the router.
  const drifted = structuredClone(inventory);
  drifted.entries[0].description = `${drifted.entries[0].description} (edited)`;
  assert.throws(() => toManifest(drifted), /differ from the router's manifest entry/);
  const toolsDrift = structuredClone(inventory);
  toolsDrift.entries[1].toolsRef.sha256 = '0'.repeat(64);
  assert.throws(() => toManifest(toolsDrift), /toolsRef.sha256/);
  // A duplicate alias fails the router's startup checks.
  const twice = structuredClone(inventory);
  twice.entries.push(twice.entries[0]);
  assert.throws(() => createCivicRouter(toManifest(twice)));
});
