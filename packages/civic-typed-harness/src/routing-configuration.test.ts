// The routing configuration (ADR-0033 amendment 5; sprint anchor
// civic-ai-tools#318, S3-A P2, criterion A11).
//
// The root span's `analysis.routing_configuration` is JSON text of one object
// of five members: the router's routing configuration `{ rule: { id, version
// }, cap, search, inventory: { id, version, hash } }`, key for key as S1's
// benchmark built it (`benchmark/runner/session.mjs:196-203`), and `hash`, the
// lowercase hex SHA-256 of the router's canonical JSON of those four members.
// It reaches the composition block under one key, `routingConfiguration`,
// after `considered`. A value that is malformed is refused, never read as
// absent: by the extractor (`RunAttributeError`) for a shape that is not the
// five members, each a string or an object of exactly its strings, and by the
// derivation (`RecordFieldError('routingConfiguration', …)`) for a form that
// is not the record's (a `cap` other than `none` or a positive whole number
// with no leading zero, the seat's Q6), or a hash that is not the SHA-256 of
// the four members.
// The harness recomputes the hash: every member it hashes is in the record.
//
// THE BASE (harness 0.13.0). `extractRunAttributes` reads nine named root
// keys and no other (capture/run-attributes.ts:225-274), so the attribute
// stays in the trace and the composition block has no key for it; nothing is
// refused.
//
// THE VALUES. S1's committed run records sixteen routing configurations and
// their hashes, computed by the router's own `canonicalJson` and `sha256Hex`
// (`benchmark/runs/2026-11-05/2026-11-05-run-191511/meta.json`,
// `configurations.<name>.routingConfiguration` and
// `.routingConfigurationHash`). They are read from that file, so the
// harness's recomputation is checked against the router's without the
// harness depending on the router.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TraceBuilder,
  CIVICAITOOLS_TRACE_CONFIG,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  RecordFieldError,
  RunAttributeError,
  hash,
  buildCompositionExtension,
  deriveDatHereEnvelopeFields,
  extractRunAttributes,
  type ConsideredInput,
  type RoutingConfigurationInput,
} from './index.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const S1_META_PATH = join(REPO_ROOT, 'benchmark', 'runs', '2026-11-05', '2026-11-05-run-191511', 'meta.json');

interface S1Configuration {
  routingConfiguration: Omit<RoutingConfigurationInput, 'hash'>;
  routingConfigurationHash: string;
}

const S1_CONFIGURATIONS = Object.entries(
  (JSON.parse(readFileSync(S1_META_PATH, 'utf8')) as { configurations: Record<string, S1Configuration> }).configurations,
);

const ATTRIBUTE = 'analysis.routing_configuration';

/** One of S1's sixteen, with its hash, as the attribute's object. */
function s1Value(name: string): RoutingConfigurationInput {
  const found = S1_CONFIGURATIONS.find(([n]) => n === name);
  assert.ok(found, `S1's meta.json has ${name}`);
  return { ...found![1].routingConfiguration, hash: found![1].routingConfigurationHash };
}

function makeClock(): () => number {
  let ms = 500_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 19) % 0x50);
    return out;
  };
}

/** A trace whose root span carries `attributes` and nothing else. */
function traceWithRoot(attributes: Record<string, string>): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', {});
  tb.endRoot(attributes);
  return tb.finalize() as unknown as Record<string, unknown>;
}

/** The composition block a trace yields through the extractor and the derivation. */
function blockOf(trace: Record<string, unknown>): Record<string, unknown> | undefined {
  const fields = deriveDatHereEnvelopeFields(
    { model: 'test-model', contentProfile: DATHERE_CONTENT_PROFILE, ...extractRunAttributes(trace) },
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
  );
  return fields.extensions?.[COMPOSITION_EXTENSION_KEY] as Record<string, unknown> | undefined;
}

const INVENTORY_HASH = hash('test inventory');
const CONSIDERED: ConsideredInput = {
  inventory: { id: 'test-inventory', version: `2026-11-07.1+${INVENTORY_HASH.slice(0, 12)}`, hash: INVENTORY_HASH },
  total: 8,
  listed: 3,
  rule: 'directory-set',
  ruleVersion: '1',
};

// --- A11: the key, its place, its absence ------------------------------------------------

test('A11 routing configuration: S1\'s run records sixteen configurations, each with a hash', () => {
  assert.equal(S1_CONFIGURATIONS.length, 16);
  for (const [name, c] of S1_CONFIGURATIONS) {
    assert.match(c.routingConfigurationHash, /^[0-9a-f]{64}$/, name);
  }
  // Both forms of search and of cap are among them.
  assert.equal(s1Value('baseline-7').search, 'none');
  assert.deepEqual(s1Value('shortlist+search-50').search, { method: 'bm25', version: '1' });
  assert.equal(s1Value('shortlist-50').cap, '25');
});

test('A11 routing configuration: each of S1\'s sixteen, with its recorded hash, reaches the block under routingConfiguration, key for key', () => {
  for (const [name] of S1_CONFIGURATIONS) {
    const value = s1Value(name);
    const block = blockOf(traceWithRoot({ [ATTRIBUTE]: JSON.stringify(value) }));
    assert.ok(block, `${name}: the block is emitted`);
    assert.deepEqual(Object.keys(block!), ['routingConfiguration'], name);
    // The object as the attribute carried it: the four members in S1's order, then the hash.
    assert.equal(JSON.stringify(block!.routingConfiguration), JSON.stringify(value), name);
  }
});

test('A11 routing configuration: the record states the members in the record\'s order whatever order the attribute wrote them in', () => {
  const value = s1Value('shortlist+search-200');
  const shuffled = {
    hash: value.hash,
    inventory: { hash: value.inventory.hash, version: value.inventory.version, id: value.inventory.id },
    search: { version: '1', method: 'bm25' },
    cap: value.cap,
    rule: { version: value.rule.version, id: value.rule.id },
  };
  const block = blockOf(traceWithRoot({ [ATTRIBUTE]: JSON.stringify(shuffled) }));
  assert.equal(JSON.stringify(block?.routingConfiguration), JSON.stringify(value));
});

test('A11 routing configuration: the key follows considered, and the block built without it is the same block less the key (decoy)', () => {
  const value = s1Value('baseline-7');
  const withKey = buildCompositionExtension({ assertedDate: '2026-11-13', considered: CONSIDERED, routingConfiguration: value });
  const withoutKey = buildCompositionExtension({ assertedDate: '2026-11-13', considered: CONSIDERED });
  assert.ok(withKey && withoutKey);
  assert.deepEqual(Object.keys(withKey!), ['assertedDate', 'considered', 'routingConfiguration']);
  const { routingConfiguration: _dropped, ...rest } = withKey!;
  assert.equal(JSON.stringify(rest), JSON.stringify(withoutKey));
  assert.notEqual(JSON.stringify(withKey), JSON.stringify(withoutKey));
});

test('A11 routing configuration: an absent attribute is an absent key (not recorded)', () => {
  const extracted = extractRunAttributes(traceWithRoot({ 'analysis.asserted_date': '2026-11-13' }));
  assert.equal(Object.hasOwn(extracted, 'routingConfiguration'), false);
  const block = blockOf(traceWithRoot({ 'analysis.asserted_date': '2026-11-13' }));
  assert.deepEqual(Object.keys(block!), ['assertedDate']);
});

// --- A11: a malformed value is refused, never read as absent -----------------------------

const GOOD = (): Record<string, unknown> => JSON.parse(JSON.stringify(s1Value('shortlist+search-50'))) as Record<string, unknown>;

/** A copy of the good value with one change made by `edit`. */
function edited(edit: (v: Record<string, any>) => void): Record<string, unknown> {
  const value = GOOD();
  edit(value);
  return value;
}

function extractorRefuses(text: string, label: string): void {
  assert.throws(
    () => extractRunAttributes(traceWithRoot({ [ATTRIBUTE]: text })),
    (e: unknown) => e instanceof RunAttributeError && e.attribute === ATTRIBUTE,
    `${label}: the extractor did not refuse it`,
  );
}

test('A11 routing configuration: the extractor refuses text that is not JSON of one object', () => {
  for (const [label, text] of [
    ['not JSON', 'rule=none'],
    ['an array', JSON.stringify([GOOD()])],
    ['a string', '"none"'],
    ['null', 'null'],
    ['a number', '1'],
  ] as const) {
    extractorRefuses(text, label);
  }
});

test('A11 routing configuration: the extractor refuses a missing, extra or non-string member, at either level', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['no rule', edited((v) => delete v.rule)],
    ['no cap', edited((v) => delete v.cap)],
    ['no search', edited((v) => delete v.search)],
    ['no inventory', edited((v) => delete v.inventory)],
    ['no hash', edited((v) => delete v.hash)],
    ['an extra member', edited((v) => { v.listed = '3'; })],
    ['rule a string', edited((v) => { v.rule = 'directory-set'; })],
    ['rule without version', edited((v) => delete v.rule.version)],
    ['rule with an extra member', edited((v) => { v.rule.inputs = 'none'; })],
    ['rule.id a number', edited((v) => { v.rule.id = 1; })],
    ['cap a number', edited((v) => { v.cap = 25; })],
    ['cap null', edited((v) => { v.cap = null; })],
    ['search a number', edited((v) => { v.search = 0; })],
    ['search an array', edited((v) => { v.search = ['bm25', '1']; })],
    ['search without version', edited((v) => delete v.search.version)],
    ['search with an extra member', edited((v) => { v.search.k1 = '1.2'; })],
    ['search.method a number', edited((v) => { v.search.method = 25; })],
    ['inventory without hash', edited((v) => delete v.inventory.hash)],
    ['inventory with an extra member', edited((v) => { v.inventory.total = '50'; })],
    ['inventory.version a number', edited((v) => { v.inventory.version = 1; })],
    ['hash a number', edited((v) => { v.hash = 0; })],
  ];
  for (const [label, value] of cases) extractorRefuses(JSON.stringify(value), label);
});

test('A11 routing configuration: a present attribute that is not text is refused, never read as absent', () => {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', {});
  tb.endRoot({ [ATTRIBUTE]: 7 });
  assert.throws(
    () => extractRunAttributes(tb.finalize() as unknown as Record<string, unknown>),
    (e: unknown) => e instanceof RunAttributeError && e.attribute === ATTRIBUTE,
  );
});

function derivationRefuses(value: unknown, label: string): void {
  const refused = (e: unknown) => e instanceof RecordFieldError && e.field === 'routingConfiguration';
  assert.throws(
    () => buildCompositionExtension({ routingConfiguration: value as RoutingConfigurationInput }),
    refused,
    `${label}: the derivation did not refuse it`,
  );
  assert.throws(
    () => deriveDatHereEnvelopeFields(
      { model: 'test-model', contentProfile: DATHERE_CONTENT_PROFILE, routingConfiguration: value as RoutingConfigurationInput },
      CIVICAITOOLS_ENVIRONMENT_CONFIG,
    ),
    refused,
    `${label}: the composite derivation did not refuse it`,
  );
}

test('A11 routing configuration: a cap that is neither none nor a positive whole number with no leading zero is refused', () => {
  for (const cap of ['', 'None', 'unlimited', '2.5', '-1', ' 25', '25 ', '+25', '0x19', '２５', '0', '00', '007', '1e3']) {
    derivationRefuses(edited((v) => { v.cap = cap; }), `cap ${JSON.stringify(cap)}`);
  }
});

test('A11 routing configuration (Q6): the cap 025 is refused, as the router refuses it; 25 is not (decoy)', () => {
  derivationRefuses(edited((v) => { v.cap = '025'; }), 'cap "025"');
  // S1's shortlist configurations record cap '25' with their hash, and pass.
  const accepted = buildCompositionExtension({ routingConfiguration: s1Value('shortlist-50') });
  assert.equal((accepted?.routingConfiguration as Record<string, unknown>).cap, '25');
});

test('A11 routing configuration: a search that is neither none nor { method, version } is refused', () => {
  for (const search of ['', 'None', 'bm25', null, [], {}, { method: 'bm25' }, { method: '', version: '1' }, { method: 'bm25', version: '' }, { method: 'bm25', version: 1 }, { method: 'bm25', version: '1', k1: '1.2' }]) {
    derivationRefuses(edited((v) => { v.search = search; }), `search ${JSON.stringify(search)}`);
  }
});

test('A11 routing configuration: a hash that is not 64 lowercase hex is refused', () => {
  const good = GOOD().hash as string;
  for (const h of ['', good.toUpperCase(), good.slice(1), `${good}0`, `sha256:${good}`, good.replace(/^./, 'g')]) {
    derivationRefuses(edited((v) => { v.hash = h; }), `hash ${JSON.stringify(h)}`);
  }
});

test('A11 routing configuration: a hash of the right form that is not the SHA-256 of the four members is refused', () => {
  derivationRefuses(edited((v) => { v.hash = s1Value('shortlist+search-200').hash; }), 'another configuration\'s hash');
  derivationRefuses(edited((v) => { v.hash = hash('routing configuration'); }), 'a hash of other text');
});

test('A11 routing configuration: changing any one member moves the hash, so the recorded hash no longer matches and the value is refused', () => {
  const edits: Array<[string, (v: Record<string, any>) => void]> = [
    ['rule.id', (v) => { v.rule.id = 'flat'; }],
    ['rule.version', (v) => { v.rule.version = '2'; }],
    ['cap', (v) => { v.cap = '26'; }],
    ['search to none', (v) => { v.search = 'none'; }],
    ['search.method', (v) => { v.search.method = 'bm26'; }],
    ['search.version', (v) => { v.search.version = '2'; }],
    ['inventory.id', (v) => { v.inventory.id = 'civic-51'; }],
    ['inventory.version', (v) => { v.inventory.version = '2026-11-03.2'; }],
    ['inventory.hash', (v) => { v.inventory.hash = hash('another inventory'); }],
  ];
  for (const [label, edit] of edits) derivationRefuses(edited(edit), label);
});

test('A11 routing configuration: other forms that are not the record\'s are refused', () => {
  const cases: Array<[string, unknown]> = [
    ['null', null],
    ['an array', [GOOD()]],
    ['JSON text', JSON.stringify(GOOD())],
    ['an extra member', edited((v) => { v.listed = '3'; })],
    ['no hash', edited((v) => delete v.hash)],
    ['rule.id empty', edited((v) => { v.rule.id = ''; })],
    ['rule.version empty', edited((v) => { v.rule.version = ''; })],
    ['rule with an extra member', edited((v) => { v.rule.inputs = 'none'; })],
    ['inventory.id empty', edited((v) => { v.inventory.id = ''; })],
    ['inventory.version empty', edited((v) => { v.inventory.version = ''; })],
    ['inventory.hash upper case', edited((v) => { v.inventory.hash = (v.inventory.hash as string).toUpperCase(); })],
    ['inventory with an extra member', edited((v) => { v.inventory.total = '50'; })],
  ];
  for (const [label, value] of cases) derivationRefuses(value, label);
});

test('A11 routing configuration: the extractor checks the shape only, and the derivation refuses the form (a cap of "25 entries")', () => {
  const text = JSON.stringify(edited((v) => { v.cap = '25 entries'; }));
  const extracted = extractRunAttributes(traceWithRoot({ [ATTRIBUTE]: text }));
  assert.equal(extracted.routingConfiguration?.cap, '25 entries');
  assert.throws(
    () => deriveDatHereEnvelopeFields({ model: 'test-model', contentProfile: DATHERE_CONTENT_PROFILE, ...extracted }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
    (e: unknown) => e instanceof RecordFieldError && e.field === 'routingConfiguration',
  );
});
