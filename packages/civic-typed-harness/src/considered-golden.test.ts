// The considered golden (ADR-0033 amendment 3): one packaged record of an
// in-loop run that states the inventory it was routed against, credits a
// pack beside its base, and states for each load whether a question was put
// to the reader. Held byte for byte.
//
// WHAT IT PINS.
//   - The composition block's new key, `considered { inventory: { id,
//     version, hash }, total, listed, rule, ruleVersion }`, after
//     `definitionHash`, and nothing else moved: the same trace without
//     `analysis.considered` yields the block a record built without the key
//     has, byte for byte, and a block built with it differs (the decoy).
//   - The pack's credit: a `components[]` entry of its own, after its base's,
//     with `version` `<version>+<hash12>`; and the one call the pack shaped,
//     whose activity states `civic:packId` after `civic:serverId`, the base's.
//   - `civic:loadAsked` on each load activity, after `civic:loadOutcome`:
//     `false` for a source that needed no question, `true` for one that did.
//     A span without `mcp.pack_id` or `tool.load_asked` states neither term.
//   - The refusals: a `considered` outside the record's form is refused with
//     `RecordFieldError('considered', …)`, a present attribute that does not
//     parse with `RunAttributeError`, and a load span whose `tool.load_asked`
//     is not a boolean with `LoadSpanError`.
// Every record built without these inputs keeps 0.11.0's bytes: the other
// goldens (`frozen-fixtures.test.ts`, `in-loop-golden.test.ts`,
// `civicaitools-v1-golden.test.ts`, `golden-reproduction.test.ts`) are
// unchanged and pass.
//
// THE INVENTORY HERE IS A TEST ONE (`test-inventory`), not the hub's
// `inventory/civic-inventory.json`: version 1 of that file lists no pack, and
// a record citing it beside a pack component would state a pair no run of
// it can produce.
//
// DETERMINISM. The clock and the id source are injected, as the in-loop
// golden injects them: millisecond values stay at six digits, so every
// `<ms>000000` timestamp is at most twelve digits, and every id byte is in
// 0xa0-0xef (fixture convention: no bare run of thirteen or more digits; the
// serialized record is asserted run-free below).
//
// REGENERATING. Only when a change is intended to move these bytes: write
// `JSON.stringify(buildConsideredRecord().pkg)` and the two hashes into the
// fixture, and say in its note what moved and why.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildEnvelope,
  computeContentHashSha256,
  computeEnvelopeHash,
  DEFAULT_CONTENT_TYPE,
  type RecordPackage,
} from '@typedstandards/produce-core';
import {
  TraceBuilder,
  CIVICAITOOLS_TRACE_CONFIG,
  CIVICAITOOLS_PROVENANCE_CONFIG,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  CIVIC_TERM_LOAD_ASKED,
  CIVIC_TERM_PACK_ID,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  LoadSpanError,
  RecordFieldError,
  RunAttributeError,
  hash,
  buildCompositionExtension,
  extractRunAttributes,
  extractSkillMetadata,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  type ConsideredInput,
  type ToolCallSummary,
} from './index.ts';

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'considered-golden.json');

const PACKAGE_ID = '00000000-0000-4000-8000-0000000000b3';
const CREATED_AT = '2026-11-07T00:00:00.000Z';
const KID = 'platform:test-key-1';
const SIGNER = {
  bindingTier: 'platform',
  identifier: 'platform:civic-ai-tools',
  displayName: 'Civic AI Tools Platform',
};
const PROMPT = 'Which notices about street closures were published last week?';
const OUTPUT = 'Twelve notices about street closures were published last week.';
const SUMMARY = 'Street-closure notices published last week, counted from one dataset through a pack.';
const MODEL = 'anthropic/claude-sonnet-5.5';
const PORTAL = 'data.cityofnewyork.us';
const DATASET = 'ab12-cd34';
const ROUTER_VERSION = '0.7.0';

/** The base server's component id, which the pack's call states as `mcp.server.id`. */
const BASE_ID = 'socrata';
/** A test pack over the base: its id, alias and version (`<version>+<hash12>` over its text). */
const PACK_ID = 'test-pack@example';
const PACK_ALIAS = 'notices';
const PACK_VERSION = `1.0.0+${hash('test pack text').slice(0, 12)}`;

const INVENTORY_HASH = hash('test inventory');
export const CONSIDERED: ConsideredInput = {
  inventory: { id: 'test-inventory', version: `2026-11-07.1+${INVENTORY_HASH.slice(0, 12)}`, hash: INVENTORY_HASH },
  total: 8,
  listed: 3,
  rule: 'directory-set',
  ruleVersion: '1',
};

const LOAD_BASE_ARGS = { alias: 'socrata' };
const LOAD_PACK_ARGS = { alias: PACK_ALIAS };
const DATA_ARGS = { type: 'query', portal: PORTAL, dataset_id: DATASET, where: "category = 'street closure'", select: 'count(*)' };

/** The final request's tools array: the directory tool, then the pack's tool. */
const TOOL_DEFINITIONS = [
  { type: 'function', function: { name: 'load_source', parameters: { type: 'object', properties: { alias: { type: 'string', enum: ['socrata', 'data_commons', PACK_ALIAS] } }, required: ['alias'] } } },
  { type: 'function', function: { name: `${PACK_ALIAS}__get_data`, parameters: { type: 'object' } } },
];
const MCP_SERVERS = [
  { url: 'https://socrata-mcp.example', name: 'socrata' },
  { url: 'https://api.datacommons.org/mcp', name: 'data-commons' },
];
const SOURCES_OFFERED = [
  { sourceId: 'socrata', alias: 'socrata', reason: 'configured' },
  { sourceId: 'data-commons', alias: 'data_commons', reason: 'configured' },
  { sourceId: 'boston-opencontext', alias: 'boston', reason: 'not-configured' },
  { sourceId: 'notices', alias: PACK_ALIAS, reason: 'configured' },
];
/** The loaded set in manifest order, the pack after its base, then the router. */
const COMPONENTS = [
  { id: BASE_ID, version: '0.9.2', guidanceHash: hash('socrata guidance'), guidanceOrigin: 'endpoint' },
  { id: PACK_ID, version: PACK_VERSION, guidanceHash: hash('test pack guidance'), guidanceOrigin: 'inline' },
  { id: '@typedstandards/civic-typed-router', version: ROUTER_VERSION },
];
const FLOWS_STATEMENT = { url: 'https://instance.example/api/flows', hash: hash('flows statement'), date: '2026-11-06' };
const ROUTING = { method: 'in-loop', version: ROUTER_VERSION };
const DEFINITION_HASH = hash('harness definition with a pack');

function makeClock(): () => number {
  let ms = 200_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 13) % 0x50);
    return out;
  };
}

/** The run's trace: the directory request, a load of the base (no question
 *  put), a load of the pack (a question put), the request with the pack's
 *  tools, the pack's data call, the answer. `considered` false drops
 *  `analysis.considered` from the root span and nothing else. */
function captureRun(options: { considered?: boolean } = {}): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash(PROMPT) });

  const directoryRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '0' });
  tb.endSpan(directoryRequest, { 'gen_ai.response.prompt_tokens': 1902, 'gen_ai.response.completion_tokens': 21 });

  const loadBase = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'load_source',
    'tool.operation_type': 'load_source',
    'tool.arguments': JSON.stringify(LOAD_BASE_ARGS),
  });
  tb.endSpan(loadBase, { 'tool.load_outcome': 'loaded', 'tool.load_asked': false, 'tool.duration_ms': 2 });

  const loadPack = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'load_source',
    'tool.operation_type': 'load_source',
    'tool.arguments': JSON.stringify(LOAD_PACK_ARGS),
  });
  tb.endSpan(loadPack, { 'tool.load_outcome': 'loaded', 'tool.load_asked': true, 'tool.duration_ms': 4 });

  const loadedRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '1' });
  tb.endSpan(loadedRequest, { 'gen_ai.response.prompt_tokens': 9120, 'gen_ai.response.completion_tokens': 71 });

  const dataCall = tb.startSpan('mcp_tool_call', undefined, {
    'mcp.source': 'socrata',
    'tool.name': `${PACK_ALIAS}__get_data`,
    'tool.operation_type': 'query',
    'tool.arguments': JSON.stringify(DATA_ARGS),
    'tool.dataset_id': DATASET,
    'tool.portal_domain': PORTAL,
    'tool.upstream_name': 'get_data',
    'mcp.alias': PACK_ALIAS,
    'mcp.server.id': BASE_ID,
    'mcp.pack_id': PACK_ID,
  });
  tb.endSpan(dataCall, { 'tool.response_hash': hash('notice count'), 'tool.response_rows': 1, 'tool.duration_ms': 380 });

  const answer = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '2' });
  tb.endSpan(answer, { 'gen_ai.response.prompt_tokens': 9240, 'gen_ai.response.completion_tokens': 48 });

  tb.endRoot({
    'analysis.asserted_date': '2026-11-07',
    'analysis.mcp_servers': JSON.stringify(MCP_SERVERS),
    'analysis.tool_definitions': JSON.stringify(TOOL_DEFINITIONS),
    'analysis.sources_offered': JSON.stringify(SOURCES_OFFERED),
    'analysis.components': JSON.stringify(COMPONENTS),
    'analysis.flows_statement': JSON.stringify(FLOWS_STATEMENT),
    'analysis.routing': JSON.stringify(ROUTING),
    'analysis.definition_hash': DEFINITION_HASH,
    ...(options.considered === false ? {} : { 'analysis.considered': JSON.stringify(CONSIDERED) }),
  });
  return tb.finalize() as unknown as Record<string, unknown>;
}

/** Derive and assemble the record, deterministically. Exported so the
 *  fixture can be regenerated from the same function the test compares. */
export function buildConsideredRecord(): { pkg: RecordPackage; envelopeHash: string } {
  const trace = captureRun();
  const toolCalls: ToolCallSummary[] = [
    { name: 'load_source', args: LOAD_BASE_ARGS },
    { name: 'load_source', args: LOAD_PACK_ARGS },
    { name: `${PACK_ALIAS}__get_data`, args: DATA_ARGS },
  ];
  const fields = deriveDatHereEnvelopeFields({
    model: MODEL,
    contentProfile: DATHERE_CONTENT_PROFILE,
    summary: SUMMARY,
    extensions: { 'org.civicaitools.notebook': { nbformat: 4, nbformat_minor: 5, cells: [], metadata: {} } },
    ...extractRunAttributes(trace),
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  const { pkg, envelopeHash } = buildEnvelope({
    packageId: PACKAGE_ID,
    createdAt: CREATED_AT,
    signingKeyId: KID,
    prompt: PROMPT,
    promptVisibility: 'full_text',
    queries: [
      { tool: 'load_source', operationType: 'load_source', arguments: LOAD_BASE_ARGS },
      { tool: 'load_source', operationType: 'load_source', arguments: LOAD_PACK_ARGS },
      { tool: `${PACK_ALIAS}__get_data`, operationType: 'query', arguments: DATA_ARGS, datasetId: DATASET, portal: PORTAL, resultRows: 1 },
    ],
    dataSources: buildDataSources(toolCalls, trace, undefined, CREATED_AT),
    cost: { promptTokens: 20262, completionTokens: 140, totalTokens: 20402, model: MODEL },
    skillMetadata: extractSkillMetadata(trace),
    output: OUTPUT,
    trace,
    captureMethod: 'chat-flow-stream',
    contentProfile: DATHERE_CONTENT_PROFILE,
    type: DEFAULT_CONTENT_TYPE,
    signer: SIGNER,
    provenance: buildProvenanceGraph(trace, {
      packageId: PACKAGE_ID,
      promptHash: hash(PROMPT),
      promptText: PROMPT,
      outputText: OUTPUT,
      model: MODEL,
    }, CIVICAITOOLS_PROVENANCE_CONFIG),
    producerProfile: fields.producerProfile,
    contentCanonicalization: fields.contentCanonicalization,
    summary: fields.summary,
    extensions: fields.extensions,
  });
  return { pkg: pkg as RecordPackage, envelopeHash };
}

interface ConsideredFixture {
  note: string[];
  serializedJson: string;
  contentHashSha256: string;
  envelopeHash: string;
}

function readFixture(): ConsideredFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ConsideredFixture;
}

type Node = { '@id': string; [k: string]: unknown };

/** The composition block a trace yields through the extractor and the derivation. */
function blockOf(trace: Record<string, unknown>): Record<string, unknown> | undefined {
  const fields = deriveDatHereEnvelopeFields(
    { model: MODEL, contentProfile: DATHERE_CONTENT_PROFILE, ...extractRunAttributes(trace) },
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
  );
  return fields.extensions?.[COMPOSITION_EXTENSION_KEY] as Record<string, unknown> | undefined;
}

function graphOf(trace: Record<string, unknown>): Node[] {
  return buildProvenanceGraph(trace, {
    packageId: PACKAGE_ID,
    promptHash: hash(PROMPT),
    promptText: PROMPT,
    outputText: OUTPUT,
    model: MODEL,
  }, CIVICAITOOLS_PROVENANCE_CONFIG)['@graph'] as unknown as Node[];
}

/** A root span carrying only `analysis.considered`, set to `text`. */
function traceWithConsidered(text: string): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', {});
  tb.endRoot({ 'analysis.considered': text });
  return tb.finalize() as unknown as Record<string, unknown>;
}

// --- A1.2: the key, its placement, and the decoy -----------------------------------------

test('considered golden: the record reproduces the fixture byte for byte, and both hashes', () => {
  const fixture = readFixture();
  const { pkg, envelopeHash } = buildConsideredRecord();
  const serialized = JSON.stringify(pkg);
  assert.ok(serialized === fixture.serializedJson, 'the considered record differs from considered-golden.json');
  assert.equal(pkg.contentHash?.sha256, fixture.contentHashSha256);
  assert.equal(envelopeHash, fixture.envelopeHash);
  // The recorded hashes are the hashes of the recorded bytes, by produce-core's own chain.
  const stored = JSON.parse(fixture.serializedJson) as Record<string, unknown>;
  assert.equal(computeEnvelopeHash(stored), fixture.envelopeHash);
  assert.equal(computeContentHashSha256(stored, stored.contentCanonicalization as string), fixture.contentHashSha256);
});

test('considered golden: the composition block ends flowsStatement, routing, definitionHash, considered, and states considered in its key order', () => {
  const { pkg } = buildConsideredRecord();
  const block = (pkg as unknown as { extensions: Record<string, Record<string, unknown>> }).extensions[COMPOSITION_EXTENSION_KEY];
  assert.deepEqual(Object.keys(block), ['assertedDate', 'sourcesOffered', 'components', 'flowsStatement', 'routing', 'definitionHash', 'considered']);
  assert.equal(JSON.stringify(block.considered), JSON.stringify(CONSIDERED));
  assert.deepEqual(Object.keys(block.considered as object), ['inventory', 'total', 'listed', 'rule', 'ruleVersion']);
  assert.deepEqual(Object.keys((block.considered as { inventory: object }).inventory), ['id', 'version', 'hash']);
});

test('considered golden: the same trace without analysis.considered yields the key-less block byte for byte, and the block with the key differs (decoy)', () => {
  const withKey = blockOf(captureRun());
  const withoutKey = blockOf(captureRun({ considered: false }));
  assert.ok(withKey && withoutKey);
  assert.equal(Object.hasOwn(withoutKey, 'considered'), false);
  // The block built without the key is the block built with it, less the key: no other byte moved.
  const { considered: _dropped, ...rest } = withKey;
  assert.equal(JSON.stringify(withoutKey), JSON.stringify(rest));
  // The decoy: a release that dropped the key silently could not pass this.
  assert.notEqual(JSON.stringify(withKey), JSON.stringify(withoutKey));
  // And the derivation's direct input agrees with the trace's.
  const direct = buildCompositionExtension({
    assertedDate: '2026-11-07',
    sourcesOffered: SOURCES_OFFERED,
    components: COMPONENTS,
    flowsStatement: FLOWS_STATEMENT,
    routing: ROUTING,
    definitionHash: DEFINITION_HASH,
  });
  assert.equal(JSON.stringify(withoutKey), JSON.stringify(direct));
});

test('considered golden: the pack is a component of its own after its base, with version <version>+<hash12>', () => {
  const { pkg } = buildConsideredRecord();
  const block = (pkg as unknown as { extensions: Record<string, Record<string, unknown>> }).extensions[COMPOSITION_EXTENSION_KEY];
  const components = block.components as Array<{ id: string; version?: string }>;
  assert.deepEqual(components.map((c) => c.id), [BASE_ID, PACK_ID, '@typedstandards/civic-typed-router']);
  assert.match(components[1]!.version!, /^1\.0\.0\+[0-9a-f]{12}$/);
});

// --- A1.2's decoy: the refusals ----------------------------------------------------------

/** `CONSIDERED` with one change, as the derivation's direct input. */
function consideredWith(change: (c: Record<string, unknown>) => void): ConsideredInput {
  const copy = JSON.parse(JSON.stringify(CONSIDERED)) as Record<string, unknown>;
  change(copy);
  return copy as unknown as ConsideredInput;
}

function refusedAsConsidered(considered: ConsideredInput, pattern: RegExp): void {
  assert.throws(
    () => buildCompositionExtension({ considered }),
    (error: unknown) => error instanceof RecordFieldError && error.field === 'considered' && pattern.test(error.message),
  );
  // The composite derivation refuses it the same way.
  assert.throws(
    () => deriveDatHereEnvelopeFields({ model: MODEL, contentProfile: DATHERE_CONTENT_PROFILE, considered }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
    (error: unknown) => error instanceof RecordFieldError && error.field === 'considered',
  );
}

test('considered: a total that is a string, a hash that is not 64 lowercase hex, or an empty rule is refused with RecordFieldError(considered)', () => {
  refusedAsConsidered(consideredWith((c) => { c.total = '8'; }), /total must be a non-negative integer/);
  refusedAsConsidered(consideredWith((c) => { (c.inventory as Record<string, unknown>).hash = INVENTORY_HASH.toUpperCase(); }), /inventory\.hash must be a lowercase hex SHA-256/);
  refusedAsConsidered(consideredWith((c) => { (c.inventory as Record<string, unknown>).hash = INVENTORY_HASH.slice(0, 63); }), /inventory\.hash must be a lowercase hex SHA-256/);
  refusedAsConsidered(consideredWith((c) => { c.rule = ''; }), /rule must be a non-empty string/);
});

test('considered: every other value outside the record\'s form is refused, by name', () => {
  const cases: Array<[string, (c: Record<string, unknown>) => void, RegExp]> = [
    ['an extra key', (c) => { c.shortlist = []; }, /carries inventory, total, listed, rule and ruleVersion only/],
    ['no inventory', (c) => { delete c.inventory; }, /inventory must be an object/],
    ['an extra inventory key', (c) => { (c.inventory as Record<string, unknown>).url = 'https://example.org/inventory.json'; }, /inventory carries id, version and hash only/],
    ['an empty id', (c) => { (c.inventory as Record<string, unknown>).id = ''; }, /inventory\.id must be a non-empty string/],
    ['a version with no build metadata', (c) => { (c.inventory as Record<string, unknown>).version = '2026-11-07.1'; }, /inventory\.version must be <YYYY-MM-DD>\.<n>\+<hash12>/],
    ['a version whose date is not a calendar date', (c) => { (c.inventory as Record<string, unknown>).version = `2026-02-30.1+${INVENTORY_HASH.slice(0, 12)}`; }, /inventory\.version must be/],
    ['a version whose build metadata is not the hash', (c) => { (c.inventory as Record<string, unknown>).version = `2026-11-07.1+${'a'.repeat(12)}`; }, /is not the first twelve characters of inventory\.hash/],
    ['a fractional total', (c) => { c.total = 7.5; }, /total must be a non-negative integer/],
    ['a negative listed', (c) => { c.listed = -1; }, /listed must be a non-negative integer/],
    ['listed more than total', (c) => { c.listed = 9; }, /listed \(9\) is more than total \(8\)/],
    ['an empty ruleVersion', (c) => { c.ruleVersion = ''; }, /ruleVersion must be a non-empty string/],
  ];
  for (const [name, change, pattern] of cases) {
    assert.throws(
      () => buildCompositionExtension({ considered: consideredWith(change) }),
      (error: unknown) => error instanceof RecordFieldError && error.field === 'considered' && pattern.test(error.message),
      name,
    );
  }
  for (const value of [null, [], 'considered']) {
    assert.throws(
      () => buildCompositionExtension({ considered: value as unknown as ConsideredInput }),
      (error: unknown) => error instanceof RecordFieldError && error.field === 'considered',
      JSON.stringify(value),
    );
  }
});

test('considered: the extractor refuses analysis.considered that is not one object of the five keys, with RunAttributeError', () => {
  const cases: Array<[string, string]> = [
    ['not JSON', '{'],
    ['an array', '[]'],
    ['no listed', JSON.stringify({ ...CONSIDERED, listed: undefined })],
    ['an extra key', JSON.stringify({ ...CONSIDERED, extra: 'x' })],
    ['an inventory that is a string', JSON.stringify({ ...CONSIDERED, inventory: 'test-inventory' })],
    ['an inventory with an extra key', JSON.stringify({ ...CONSIDERED, inventory: { ...CONSIDERED.inventory, url: 'x' } })],
    ['a total that is a string', JSON.stringify({ ...CONSIDERED, total: '8' })],
    ['a rule that is not a string', JSON.stringify({ ...CONSIDERED, rule: 1 })],
  ];
  for (const [name, text] of cases) {
    assert.throws(
      () => extractRunAttributes(traceWithConsidered(text)),
      (error: unknown) => error instanceof RunAttributeError && error.attribute === 'analysis.considered',
      name,
    );
  }
  // The shape it accepts it returns as is, for the derivation to check.
  assert.equal(JSON.stringify(extractRunAttributes(traceWithConsidered(JSON.stringify(CONSIDERED))).considered), JSON.stringify(CONSIDERED));
});

// --- A1.3: the two graph terms -----------------------------------------------------------

test('considered golden: the pack\'s call states civic:packId after civic:serverId, the base\'s, and its source is the base', () => {
  const { pkg } = buildConsideredRecord();
  const nodes = ((pkg as unknown as Record<string, unknown>).provenance as { '@graph': Node[] })['@graph'];
  const shaped = nodes.filter((n) => n[CIVIC_TERM_PACK_ID] !== undefined);
  assert.equal(shaped.length, 1, 'one activity states a pack');
  const call = shaped[0]!;
  assert.equal(call['@type'], 'prov:Activity');
  assert.equal(call[CIVIC_TERM_PACK_ID], PACK_ID);
  assert.equal(call['civic:serverId'], BASE_ID);
  assert.equal(call['civic:sourceId'], 'socrata');
  const keys = Object.keys(call);
  assert.equal(keys.indexOf(CIVIC_TERM_PACK_ID), keys.indexOf('civic:serverId') + 1, 'civic:packId follows civic:serverId');
  assert.equal(keys[keys.length - 1], CIVIC_TERM_PACK_ID, 'and is the call\'s last key');
  // One source agent, the base's: the pack is not a server.
  assert.deepEqual(nodes.map((n) => n['@id']).filter((id) => id.includes(':mcp-server:')), ['urn:civic-record:mcp-server:socrata']);
});

test('considered golden: each load states civic:loadAsked after civic:loadOutcome, false and true as the spans stated', () => {
  const { pkg } = buildConsideredRecord();
  const nodes = ((pkg as unknown as Record<string, unknown>).provenance as { '@graph': Node[] })['@graph'];
  const loads = nodes.filter((n) => n['civic:loadOutcome'] !== undefined);
  assert.equal(loads.length, 2);
  assert.deepEqual(loads.map((n) => n[CIVIC_TERM_LOAD_ASKED]), [false, true]);
  for (const load of loads) {
    const keys = Object.keys(load);
    assert.deepEqual(keys.slice(-2), ['civic:loadOutcome', CIVIC_TERM_LOAD_ASKED]);
    assert.equal(Object.hasOwn(load, CIVIC_TERM_PACK_ID), false);
  }
  // No node but a load activity states the term.
  assert.equal(nodes.filter((n) => Object.hasOwn(n, CIVIC_TERM_LOAD_ASKED)).length, 2);
});

/** A trace of one load span and one data call with `extra` attributes on each. */
function loadAndCall(loadExtra: Record<string, string | number | boolean>, callExtra: Record<string, string | number | boolean>): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', {});
  const load = tb.startSpan('mcp_tool_call', undefined, { 'tool.name': 'load_source', 'tool.operation_type': 'load_source', 'tool.arguments': '{"alias":"socrata"}' });
  tb.endSpan(load, { 'tool.load_outcome': 'loaded', ...loadExtra });
  const call = tb.startSpan('mcp_tool_call', undefined, { 'mcp.source': 'socrata', 'tool.name': 'socrata__get_data', 'tool.operation_type': 'query', 'tool.arguments': '{}', ...callExtra });
  tb.endSpan(call, {});
  tb.endRoot({});
  return tb.finalize() as unknown as Record<string, unknown>;
}

test('graph terms: a span without mcp.pack_id or tool.load_asked states neither term (honest absence)', () => {
  const nodes = graphOf(loadAndCall({}, {}));
  assert.equal(nodes.some((n) => Object.hasOwn(n, CIVIC_TERM_PACK_ID)), false);
  assert.equal(nodes.some((n) => Object.hasOwn(n, CIVIC_TERM_LOAD_ASKED)), false);
  // tool.load_asked on a span that is not a load is not read; mcp.pack_id on any call is.
  const crossed = graphOf(loadAndCall({}, { 'tool.load_asked': true, 'mcp.pack_id': PACK_ID }));
  assert.equal(crossed.some((n) => Object.hasOwn(n, CIVIC_TERM_LOAD_ASKED)), false);
  assert.equal(crossed.filter((n) => n[CIVIC_TERM_PACK_ID] === PACK_ID).length, 1);
});

test('graph terms: a load span whose tool.load_asked is not a boolean is refused with LoadSpanError, naming the attribute', () => {
  for (const value of ['true', 'false', 1]) {
    assert.throws(
      () => graphOf(loadAndCall({ 'tool.load_asked': value }, {})),
      (error: unknown) => error instanceof LoadSpanError && error.attribute === 'tool.load_asked' && /tool\.load_asked .* is not a boolean/.test(error.message),
      JSON.stringify(value),
    );
  }
  // The outcome's refusal keeps its own attribute.
  assert.throws(
    () => graphOf(loadAndCall({ 'tool.load_outcome': 'maybe' }, {})),
    (error: unknown) => error instanceof LoadSpanError && error.attribute === 'tool.load_outcome',
  );
});

// --- A1.6: the fixture convention --------------------------------------------------------

test('considered golden: fixture convention — no bare run of thirteen or more digits', () => {
  assert.doesNotMatch(readFileSync(FIXTURE_PATH, 'utf8'), /\b\d{13,19}\b/);
  assert.doesNotMatch(JSON.stringify(buildConsideredRecord().pkg), /\b\d{13,19}\b/);
});
