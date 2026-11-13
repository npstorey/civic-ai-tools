// The routing configuration (S3-A P1, hub #318; router 0.10.0): S1's object
// (`benchmark/runner/session.mjs`, `hashes()`), key for key, and its hash,
// the SHA-256 of its canonical JSON.
//
//   A5  For each of the 16 configurations S1's committed run records in its
//       `meta.json`, `routingConfiguration` returns an object deep-equal to
//       the recorded `routingConfiguration`, keys in S1's order (`rule`,
//       `cap`, `search`, `inventory`), and its hash equals the recorded
//       `routingConfigurationHash`. Changing any one field moves the hash. A
//       malformed value is refused with a thrown error, never hashed.
//       Amended by ORCH S3-A, confirmed by the seat (ruling 6842901380 on hub
//       #318): `cap` is `'none'` or a positive decimal integer with no
//       leading zero (`/^[1-9][0-9]*$/`), as the harness refuses the same
//       set, so `'0'`, `'025'`, `''` and `'2.5'` are refused: `'025'` and
//       `'25'` would otherwise hash differently for the same cap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { routingConfiguration, RoutingConfigurationError, type RoutingConfiguration } from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = join(SRC, '..', '..', '..');
const META = join(REPO, 'benchmark', 'runs', '2026-11-05', '2026-11-05-run-191511', 'meta.json');

const meta = JSON.parse(readFileSync(META, 'utf8')) as {
  configurations: Record<string, { routingConfiguration: RoutingConfiguration; routingConfigurationHash: string }>;
};

test('A5: for each of the 16 configurations of S1\'s run, the object deep-equals the recorded one, keys in S1\'s order, and the hash equals the recorded hash', () => {
  const names = Object.keys(meta.configurations);
  assert.equal(names.length, 16, 'sixteen configurations');
  for (const name of names) {
    const recorded = meta.configurations[name]!;
    const r = recorded.routingConfiguration;
    // Built from the parts, in another key order, so that the order is the
    // function's own.
    const input = {
      inventory: { hash: r.inventory.hash, version: r.inventory.version, id: r.inventory.id },
      search: r.search === 'none' ? 'none' : { version: r.search.version, method: r.search.method },
      cap: r.cap,
      rule: { version: r.rule.version, id: r.rule.id },
    } as RoutingConfiguration;
    const got = routingConfiguration(input);
    assert.deepEqual(got.routingConfiguration, recorded.routingConfiguration, `${name}: the object`);
    assert.equal(JSON.stringify(got.routingConfiguration), JSON.stringify(recorded.routingConfiguration), `${name}: key for key, in S1's order`);
    assert.deepEqual(Object.keys(got.routingConfiguration), ['rule', 'cap', 'search', 'inventory'], `${name}: the top-level keys`);
    assert.equal(got.routingConfigurationHash, recorded.routingConfigurationHash, `${name}: the hash`);
    assert.deepEqual(Object.keys(got), ['routingConfiguration', 'routingConfigurationHash'], `${name}: the record's two members, as meta.json names them`);
  }
});

/** shortlist+search-200's configuration: every field set, search an object. */
const BASE: RoutingConfiguration = meta.configurations['shortlist+search-200']!.routingConfiguration;
const clone = (): Record<string, unknown> => structuredClone(BASE) as unknown as Record<string, unknown>;

test('A5: changing any one field moves the hash', () => {
  const baseHash = routingConfiguration(BASE).routingConfigurationHash;
  assert.match(baseHash, /^[0-9a-f]{64}$/);
  const changes: [string, (c: Record<string, any>) => void][] = [
    ['rule.id', (c) => (c.rule.id = 'place-filter2')],
    ['rule.version', (c) => (c.rule.version = '2')],
    ['cap', (c) => (c.cap = '26')],
    ['cap to none', (c) => (c.cap = 'none')],
    ['search to none', (c) => (c.search = 'none')],
    ['search.method', (c) => (c.search.method = 'bm26')],
    ['search.version', (c) => (c.search.version = '2')],
    ['inventory.id', (c) => (c.inventory.id = 'civic-201')],
    ['inventory.version', (c) => (c.inventory.version = '2026-11-03.2')],
    ['inventory.hash', (c) => (c.inventory.hash = `0${c.inventory.hash.slice(1)}`)],
  ];
  const seen = new Set([baseHash]);
  for (const [field, change] of changes) {
    const c = clone();
    change(c);
    const hash = routingConfiguration(c as unknown as RoutingConfiguration).routingConfigurationHash;
    assert.notEqual(hash, baseHash, `${field} moves the hash`);
    assert.ok(!seen.has(hash), `${field}: a hash of its own`);
    seen.add(hash);
  }
  const none = meta.configurations['shortlist-200']!;
  const toObject = structuredClone(none.routingConfiguration) as unknown as Record<string, unknown>;
  toObject.search = { method: 'bm25', version: '1' };
  assert.notEqual(routingConfiguration(toObject as unknown as RoutingConfiguration).routingConfigurationHash, none.routingConfigurationHash, 'search from none to the object moves the hash');
});

test('A5: a malformed value is refused with a thrown RoutingConfigurationError, never hashed', () => {
  const malformed: [string, (c: Record<string, any>) => void][] = [
    ['cap a number', (c) => (c.cap = 25)],
    ['cap empty', (c) => (c.cap = '')],
    ['cap not decimal digits', (c) => (c.cap = '2.5')],
    ['cap signed', (c) => (c.cap = '-1')],
    ['cap None', (c) => (c.cap = 'None')],
    ['cap absent', (c) => delete c.cap],
    ['search a string other than none', (c) => (c.search = 'bm25')],
    ['search null', (c) => (c.search = null)],
    ['search an array', (c) => (c.search = ['bm25', '1'])],
    ['search missing version', (c) => delete c.search.version],
    ['search extra member', (c) => (c.search.k1 = '1.2')],
    ['search version a number', (c) => (c.search.version = 1)],
    ['rule missing id', (c) => delete c.rule.id],
    ['rule extra member', (c) => (c.rule.note = 'x')],
    ['rule version a number', (c) => (c.rule.version = 1)],
    ['rule a string', (c) => (c.rule = 'none')],
    ['inventory missing hash', (c) => delete c.inventory.hash],
    ['inventory extra member', (c) => (c.inventory.size = '200')],
    ['inventory id a number', (c) => (c.inventory.id = 200)],
    ['inventory.hash upper case', (c) => (c.inventory.hash = c.inventory.hash.toUpperCase())],
    ['inventory.hash 63 characters', (c) => (c.inventory.hash = c.inventory.hash.slice(1))],
    ['inventory.hash 65 characters', (c) => (c.inventory.hash = `${c.inventory.hash}0`)],
    ['inventory.hash not hex', (c) => (c.inventory.hash = `g${c.inventory.hash.slice(1)}`)],
    ['an extra top-level member', (c) => (c.note = 'x')],
  ];
  for (const [what, change] of malformed) {
    const c = clone();
    change(c);
    assert.throws(() => routingConfiguration(c as unknown as RoutingConfiguration), RoutingConfigurationError, what);
  }
  assert.throws(() => routingConfiguration(null as unknown as RoutingConfiguration), RoutingConfigurationError, 'null');
});

test('A5 (amended, seat 6842901380): cap \'0\', \'025\', \'\' and \'2.5\' are each refused with a thrown RoutingConfigurationError; \'25\' and \'1\' are not', () => {
  const notRefused: string[] = [];
  for (const cap of ['0', '025', '', '2.5']) {
    const c = clone();
    c.cap = cap;
    try {
      routingConfiguration(c as unknown as RoutingConfiguration);
      notRefused.push(cap);
    } catch (error) {
      if (!(error instanceof RoutingConfigurationError)) throw error;
    }
  }
  assert.deepEqual(notRefused, [], 'every one of the four caps is refused');
  for (const cap of ['25', '1']) {
    const c = clone();
    c.cap = cap;
    assert.equal(routingConfiguration(c as unknown as RoutingConfiguration).routingConfiguration.cap, cap, `${cap} is a cap`);
  }
});
