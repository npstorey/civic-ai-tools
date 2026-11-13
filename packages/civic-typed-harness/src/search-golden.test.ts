// The search golden (ADR-0033 amendment 5; sprint anchor civic-ai-tools#318,
// S3-A P2, criterion A12): one packaged record of an in-loop run in which the
// model searched the source inventory with `find_source` and then loaded a
// source the search found. Held byte for byte.
//
// WHAT IT PINS.
//   - The search span read apart from a source's call: its activity is the
//     platform agent's, states no `civic:sourceId`, and states
//     `civic:searchOutcome` (`searched`), `civic:searchQuery` then
//     `civic:searchHits` (the hits' source ids in rank order) as its last keys; the graph mints no source agent and no
//     data-response entity for it, and `dataSources[]` has no entry for it;
//     the calls after it keep their own spans.
//   - The composition block's new key, `routingConfiguration { rule, cap,
//     search, inventory, hash }`, after `considered`, with search
//     `{ method: 'bm25', version: '1' }`, and nothing else moved: the same
//     trace without `analysis.routing_configuration` yields the block a
//     record built without the key has, byte for byte (the decoy).
//   - The run's rule is a named test rule, `test-listed-subset` version `1`
//     (anchor criterion B3), never `directory-set`: the model was shown fewer
//     sources than it could search, so the record must not say it was shown
//     every usable source.
//   - The record verifies under the installed verify-core with the checks
//     its producer profile names: the envelope hash (check 1), the content
//     hash (check 4), the capture vocabulary (check 15), the content profile
//     (check 16) and the system prompt (check 17).
// Every record built without a search span or the attribute keeps 0.13.0's
// bytes: the other goldens are unchanged and pass.
//
// THE INVENTORY AND THE RULE HERE ARE TEST ONES (`test-inventory`,
// `test-listed-subset`), as the considered golden's inventory is.
//
// THE ROUTING CONFIGURATION'S HASH is the SHA-256 of the canonical JSON
// written out below by hand (members in code-unit order, no whitespace) and
// hashed with node:crypto, so the harness's own recomputation is checked
// against text it did not write.
//
// DETERMINISM. The clock and the id source are injected: millisecond values
// stay at six digits, and every id byte is in 0xa0-0xef (fixture convention:
// no bare run of thirteen or more digits; asserted below).
//
// REGENERATING. Only when a change is intended to move these bytes: write
// `JSON.stringify(buildSearchRecord().pkg)` and the two hashes into the
// fixture, and say in its note what moved and why.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildEnvelope,
  computeContentHashSha256,
  computeEnvelopeHash,
  DEFAULT_CONTENT_TYPE,
  type BlobRef,
  type RecordPackage,
} from '@typedstandards/produce-core';
import {
  checkCaptureMethodVocab,
  checkContentProfile,
  checkSystemPrompt,
  recomputePackageHash,
  resolveContentCanonicalization,
  verifyContentHash,
} from '@typedstandards/verify-core';
import {
  TraceBuilder,
  CIVICAITOOLS_TRACE_CONFIG,
  CIVICAITOOLS_PROVENANCE_CONFIG,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  CIVICAITOOLS_V1_PRODUCER_PROFILE,
  CIVIC_TERM_SEARCH_HITS,
  CIVIC_TERM_SEARCH_OUTCOME,
  CIVIC_TERM_SEARCH_QUERY,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  hash,
  buildCompositionExtension,
  extractRunAttributes,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  type ConsideredInput,
  type RoutingConfigurationInput,
  type ToolCallSummary,
} from './index.ts';

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'search-golden.json');

const PACKAGE_ID = '00000000-0000-4000-8000-0000000000d5';
const CREATED_AT = '2026-11-13T00:00:00.000Z';
const KID = 'platform:test-key-1';
const SIGNER = {
  bindingTier: 'platform',
  identifier: 'platform:civic-ai-tools',
  displayName: 'Civic AI Tools Platform',
};
const PROMPT = 'Which notices about street closures were published last week?';
const OUTPUT = 'Twelve notices about street closures were published last week.';
const SUMMARY = 'Street-closure notices published last week, counted from one dataset through a pack the model found by search.';
const MODEL = 'anthropic/claude-sonnet-5.5';
const PORTAL = 'data.cityofnewyork.us';
const DATASET = 'ab12-cd34';
const ROUTER_VERSION = '0.10.0';

const BASE_ID = 'socrata';
const PACK_ID = 'test-pack@example';
const PACK_ALIAS = 'notices';
const PACK_VERSION = `1.0.0+${hash('test pack text').slice(0, 12)}`;

const INVENTORY_HASH = hash('test inventory');
const INVENTORY = { id: 'test-inventory', version: `2026-11-07.1+${INVENTORY_HASH.slice(0, 12)}`, hash: INVENTORY_HASH };

/** A named test rule that lists a subset of what can be searched (anchor B3). */
const CONSIDERED: ConsideredInput = {
  inventory: INVENTORY,
  total: 8,
  listed: 2,
  rule: 'test-listed-subset',
  ruleVersion: '1',
};

/** The routing configuration's canonical JSON, written out: members in
 *  code-unit order, no whitespace. */
const ROUTING_CONFIGURATION_CANONICAL =
  `{"cap":"none","inventory":{"hash":"${INVENTORY.hash}","id":"${INVENTORY.id}","version":"${INVENTORY.version}"},`
  + '"rule":{"id":"test-listed-subset","version":"1"},"search":{"method":"bm25","version":"1"}}';
export const ROUTING_CONFIGURATION: RoutingConfigurationInput = {
  rule: { id: 'test-listed-subset', version: '1' },
  cap: 'none',
  search: { method: 'bm25', version: '1' },
  inventory: INVENTORY,
  hash: createHash('sha256').update(ROUTING_CONFIGURATION_CANONICAL).digest('hex'),
};

const SEARCH_QUERY = 'street closure notices';
/** The hits' source ids, in rank order. */
const SEARCH_HITS = [PACK_ALIAS, BASE_ID];
const SEARCH_ARGS = { query: SEARCH_QUERY };
const LOAD_ARGS = { alias: PACK_ALIAS };
const DATA_ARGS = { type: 'query', portal: PORTAL, dataset_id: DATASET, where: "category = 'street closure'", select: 'count(*)' };

/** The final request's tools array: the two first-step tools, then the found pack's tool. */
const TOOL_DEFINITIONS = [
  { type: 'function', function: { name: 'load_source', parameters: { type: 'object', properties: { alias: { type: 'string', enum: ['socrata', 'data_commons', PACK_ALIAS] } }, required: ['alias'] } } },
  { type: 'function', function: { name: 'find_source', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
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
const COMPONENTS = [
  { id: BASE_ID, version: '0.9.2', guidanceHash: hash('socrata guidance'), guidanceOrigin: 'endpoint' },
  { id: PACK_ID, version: PACK_VERSION, guidanceHash: hash('test pack guidance'), guidanceOrigin: 'inline' },
  { id: '@typedstandards/civic-typed-router', version: ROUTER_VERSION },
];
const FLOWS_STATEMENT = { url: 'https://instance.example/api/flows', hash: hash('flows statement'), date: '2026-11-06' };
const ROUTING = { method: 'in-loop', version: ROUTER_VERSION };
const DEFINITION_HASH = hash('harness definition after a search');

/** The composed system prompt; its bytes are the blob's, not the record's. */
const SYSTEM_PROMPT = [
  'You are a civic data analyst. Today is 2026-11-13.',
  'Load a source before you query it. Search for a source the list does not show.',
  'Sources you can load: socrata, data_commons.',
].join('\n');
const SYSTEM_PROMPT_HASH = hash(SYSTEM_PROMPT);
const SKILL_TEXT_REF: BlobRef = {
  ref: `blob:sha256:${SYSTEM_PROMPT_HASH}`,
  url: `https://blob-store.example/system-prompts/${SYSTEM_PROMPT_HASH}.md`,
  contentType: 'text/markdown',
  size: new TextEncoder().encode(SYSTEM_PROMPT).length,
};

function makeClock(): () => number {
  let ms = 600_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 23) % 0x50);
    return out;
  };
}

/** The run's trace: the directory request, a search, the request after it, a
 *  load of the found pack (a question put), the request with the pack's
 *  tools, the pack's data call, the answer. `routingConfiguration` false
 *  drops `analysis.routing_configuration` from the root span and nothing
 *  else. */
function captureRun(options: { routingConfiguration?: boolean } = {}): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash(PROMPT) });

  const directoryRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '0', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(directoryRequest, { 'gen_ai.response.prompt_tokens': 1990, 'gen_ai.response.completion_tokens': 19 });

  const search = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'find_source',
    'tool.operation_type': 'find_source',
    'tool.arguments': JSON.stringify(SEARCH_ARGS),
    'tool.search_outcome': 'searched',
    'tool.search_query': SEARCH_QUERY,
  });
  tb.endSpan(search, { 'tool.search_hits': JSON.stringify(SEARCH_HITS), 'tool.duration_ms': 3 });

  const searchedRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '1', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(searchedRequest, { 'gen_ai.response.prompt_tokens': 2104, 'gen_ai.response.completion_tokens': 17 });

  const load = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'load_source',
    'tool.operation_type': 'load_source',
    'tool.arguments': JSON.stringify(LOAD_ARGS),
  });
  tb.endSpan(load, { 'tool.load_outcome': 'loaded', 'tool.load_asked': true, 'tool.duration_ms': 5 });

  const loadedRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '2', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(loadedRequest, { 'gen_ai.response.prompt_tokens': 9310, 'gen_ai.response.completion_tokens': 66 });

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
  tb.endSpan(dataCall, { 'tool.response_hash': hash('notice count'), 'tool.response_rows': 1, 'tool.duration_ms': 372 });

  const answer = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '3', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(answer, { 'gen_ai.response.prompt_tokens': 9420, 'gen_ai.response.completion_tokens': 44 });

  tb.endRoot({
    'analysis.asserted_date': '2026-11-13',
    'analysis.mcp_servers': JSON.stringify(MCP_SERVERS),
    'analysis.tool_definitions': JSON.stringify(TOOL_DEFINITIONS),
    'analysis.sources_offered': JSON.stringify(SOURCES_OFFERED),
    'analysis.components': JSON.stringify(COMPONENTS),
    'analysis.flows_statement': JSON.stringify(FLOWS_STATEMENT),
    'analysis.routing': JSON.stringify(ROUTING),
    'analysis.definition_hash': DEFINITION_HASH,
    'analysis.considered': JSON.stringify(CONSIDERED),
    ...(options.routingConfiguration === false ? {} : { 'analysis.routing_configuration': JSON.stringify(ROUTING_CONFIGURATION) }),
  });
  return tb.finalize() as unknown as Record<string, unknown>;
}

const TOOL_CALLS: ToolCallSummary[] = [
  { name: 'find_source', args: SEARCH_ARGS },
  { name: 'load_source', args: LOAD_ARGS },
  { name: `${PACK_ALIAS}__get_data`, args: DATA_ARGS },
];

/** Derive and assemble the record, deterministically. Exported so the
 *  fixture can be regenerated from the same function the test compares. */
export function buildSearchRecord(): { pkg: RecordPackage; envelopeHash: string } {
  const trace = captureRun();
  const fields = deriveDatHereEnvelopeFields({
    model: MODEL,
    contentProfile: DATHERE_CONTENT_PROFILE,
    producerProfile: CIVICAITOOLS_V1_PRODUCER_PROFILE,
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
      { tool: 'find_source', operationType: 'find_source', arguments: SEARCH_ARGS },
      { tool: 'load_source', operationType: 'load_source', arguments: LOAD_ARGS },
      { tool: `${PACK_ALIAS}__get_data`, operationType: 'query', arguments: DATA_ARGS, datasetId: DATASET, portal: PORTAL, resultRows: 1 },
    ],
    dataSources: buildDataSources(TOOL_CALLS, trace, undefined, CREATED_AT),
    cost: { promptTokens: 22824, completionTokens: 146, totalTokens: 22970, model: MODEL },
    skillMetadata: { systemPromptHash: SYSTEM_PROMPT_HASH, skillText: SKILL_TEXT_REF },
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

interface GoldenFixture {
  note: string[];
  serializedJson: string;
  contentHashSha256: string;
  envelopeHash: string;
}

function readFixture(): GoldenFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as GoldenFixture;
}

function storedRecord(): Record<string, unknown> {
  return JSON.parse(readFixture().serializedJson) as Record<string, unknown>;
}

type Node = { '@id': string; [k: string]: unknown };

function graphOf(record: Record<string, unknown>): Node[] {
  return (record.provenance as { '@graph': Node[] })['@graph'];
}

function blockOf(record: Record<string, unknown>): Record<string, unknown> {
  return (record.extensions as Record<string, Record<string, unknown>>)[COMPOSITION_EXTENSION_KEY]!;
}

/** The composition block a trace yields through the extractor and the derivation. */
function derivedBlock(trace: Record<string, unknown>): Record<string, unknown> | undefined {
  const fields = deriveDatHereEnvelopeFields(
    { model: MODEL, contentProfile: DATHERE_CONTENT_PROFILE, ...extractRunAttributes(trace) },
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
  );
  return fields.extensions?.[COMPOSITION_EXTENSION_KEY] as Record<string, unknown> | undefined;
}

// --- The golden ---------------------------------------------------------------------------

test('search golden: the record reproduces the fixture byte for byte, and both hashes', () => {
  const fixture = readFixture();
  const { pkg, envelopeHash } = buildSearchRecord();
  const serialized = JSON.stringify(pkg);
  assert.ok(serialized === fixture.serializedJson, 'the search record differs from search-golden.json');
  assert.equal(pkg.contentHash?.sha256, fixture.contentHashSha256);
  assert.equal(envelopeHash, fixture.envelopeHash);
  const stored = storedRecord();
  assert.equal(computeEnvelopeHash(stored), fixture.envelopeHash);
  assert.equal(computeContentHashSha256(stored, stored.contentCanonicalization as string), fixture.contentHashSha256);
});

test('search golden: under verify-core, checks 1, 4, 15, 16 and 17 read ok on the fixture and on the built record', () => {
  const fixture = readFixture();
  for (const [label, record] of [
    ['the fixture', storedRecord()],
    ['the built record', buildSearchRecord().pkg as unknown as Record<string, unknown>],
  ] as const) {
    assert.equal(recomputePackageHash(record), fixture.envelopeHash, `check 1 on ${label}`);
    assert.equal(verifyContentHash(record, resolveContentCanonicalization(record)).status, 'ok', `check 4 on ${label}`);
    assert.equal(checkCaptureMethodVocab(record).status, 'ok', `check 15 on ${label}`);
    assert.equal(checkContentProfile(record).status, 'ok', `check 16 on ${label}`);
    assert.deepEqual(checkSystemPrompt(record), { status: 'ok', form: 'blobRef' }, `check 17 on ${label}`);
  }
  assert.equal(storedRecord().producerProfile, CIVICAITOOLS_V1_PRODUCER_PROFILE);
});

test('search golden: the search activity is the platform agent\'s, states no source, and states the outcome, the query, then the hits in rank order, last', () => {
  const nodes = graphOf(storedRecord());
  const searches = nodes.filter((n) => Object.hasOwn(n, CIVIC_TERM_SEARCH_OUTCOME));
  assert.equal(searches.length, 1, 'one activity states a find_source call');
  const activity = searches[0]!;
  const keys = Object.keys(activity);
  assert.deepEqual(keys.slice(-3), [CIVIC_TERM_SEARCH_OUTCOME, CIVIC_TERM_SEARCH_QUERY, CIVIC_TERM_SEARCH_HITS]);
  assert.equal(activity[CIVIC_TERM_SEARCH_OUTCOME], 'searched');
  assert.equal(activity[CIVIC_TERM_SEARCH_QUERY], SEARCH_QUERY);
  assert.deepEqual(activity[CIVIC_TERM_SEARCH_HITS], SEARCH_HITS);
  assert.equal(Object.hasOwn(activity, 'civic:sourceId'), false);
  const platform = nodes.find((n) => n['@id'].includes(':platform:'))!;
  assert.deepEqual(activity['prov:wasAssociatedWith'], { '@id': platform['@id'] });
  assert.equal(activity['dcterms:description'], 'MCP tool call: find_source (find_source)');
});

test('search golden: the graph names no unknown source and mints one server agent, socrata, the pack\'s base', () => {
  const stored = storedRecord();
  const nodes = graphOf(stored);
  const agents = nodes.filter((n) => n['@id'].includes(':mcp-server:')).map((n) => n['@id']);
  assert.deepEqual(agents, ['urn:civic-record:mcp-server:socrata']);
  assert.equal(JSON.stringify(stored.provenance).includes('unknown'), false, 'no node of the graph names unknown');
  // One data response, the pack's call's; none for the search or the load.
  assert.equal(nodes.filter((n) => n['@id'].includes(':data:')).length, 1);
});

test('search golden: dataSources has the pack call\'s entry only, and the walk kept each call on its own span', () => {
  const dataSources = (storedRecord() as { dataSources: Array<Record<string, unknown>> }).dataSources;
  assert.deepEqual(dataSources.map((d) => `${d.sourceId}/${d.datasetId}`), [`socrata/${DATASET}`]);
});

test('search golden: the composition block states routingConfiguration after considered, under the named test rule, never directory-set', () => {
  const block = blockOf(storedRecord());
  assert.deepEqual(Object.keys(block), [
    'assertedDate', 'sourcesOffered', 'components', 'flowsStatement', 'routing', 'definitionHash', 'considered', 'routingConfiguration',
  ]);
  assert.equal(JSON.stringify(block.routingConfiguration), JSON.stringify(ROUTING_CONFIGURATION));
  assert.deepEqual((block.routingConfiguration as Record<string, unknown>).search, { method: 'bm25', version: '1' });
  assert.equal((block.considered as Record<string, unknown>).rule, 'test-listed-subset');
  assert.equal((block.considered as Record<string, unknown>).ruleVersion, '1');
  assert.equal(JSON.stringify(block).includes('directory-set'), false);
  // The hash is the SHA-256 of the canonical JSON written out above.
  assert.equal(
    (block.routingConfiguration as Record<string, unknown>).hash,
    createHash('sha256').update(ROUTING_CONFIGURATION_CANONICAL).digest('hex'),
  );
});

test('search golden: the same trace without analysis.routing_configuration yields the key-less block byte for byte, and the block with it differs (decoy)', () => {
  const withKey = derivedBlock(captureRun());
  const withoutKey = derivedBlock(captureRun({ routingConfiguration: false }));
  assert.ok(withKey && withoutKey);
  const { routingConfiguration: _dropped, ...rest } = withKey!;
  assert.equal(JSON.stringify(withoutKey), JSON.stringify(rest));
  assert.notEqual(JSON.stringify(withKey), JSON.stringify(withoutKey));
  const direct = buildCompositionExtension({
    assertedDate: '2026-11-13',
    sourcesOffered: SOURCES_OFFERED,
    components: COMPONENTS,
    flowsStatement: FLOWS_STATEMENT,
    routing: ROUTING,
    definitionHash: DEFINITION_HASH,
    considered: CONSIDERED,
  });
  assert.equal(JSON.stringify(withoutKey), JSON.stringify(direct));
});

test('search golden: fixture convention — no bare run of thirteen or more digits', () => {
  assert.doesNotMatch(readFileSync(FIXTURE_PATH, 'utf8'), /\b\d{13,19}\b/);
  assert.doesNotMatch(JSON.stringify(buildSearchRecord().pkg), /\b\d{13,19}\b/);
});
