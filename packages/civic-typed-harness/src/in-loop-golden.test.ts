// The in-loop golden (ADR-0033 amendment 2): one packaged record of a run
// whose sources were loaded in the loop, held byte for byte.
//
// WHAT IT PINS. The composition block's two new keys, `routing { method:
// 'in-loop', version }` and `definitionHash`, after `flowsStatement`; and a
// trace carrying one load span (`tool.operation_type: load_source`, outcome
// `loaded`) before one Socrata data call. The record is derived from literal
// inputs by the harness's own capture and derivation, then assembled by
// produce-core, so the bytes are this code's output and not a reference
// capture: unlike `span-carrying-golden.json`, nothing outside this
// repository produced them. What holds them is the structural assertions
// below (one server agent, one dataSources entry, the load activity on the
// platform agent, the block's key order) plus the fixture's bytes and its two
// hashes, so an unintended change to any byte of an in-loop record fails here
// by name. The three existing goldens are untouched; they hold the bytes of a
// record packaged without the new inputs.
//
// DETERMINISM. The clock and the id source are injected, as the composition
// round trip injects them: millisecond values stay at six digits, so every
// `<ms>000000` timestamp is at most twelve digits, and every id byte is in
// 0xa0-0xef (fixture convention: no bare run of thirteen or more digits; the
// serialized record is asserted run-free below).
//
// REGENERATING. Only when a change is intended to move these bytes: write
// `JSON.stringify(buildInLoopRecord().pkg)` and the two hashes into the
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
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  hash,
  extractRunAttributes,
  extractSkillMetadata,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  type ToolCallSummary,
} from './index.ts';

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'in-loop-golden.json');

const PACKAGE_ID = '00000000-0000-4000-8000-0000000000b2';
const CREATED_AT = '2026-10-19T00:00:00.000Z';
const KID = 'platform:test-key-1';
const SIGNER = {
  bindingTier: 'platform',
  identifier: 'platform:civic-ai-tools',
  displayName: 'Civic AI Tools Platform',
};
const PROMPT = 'How many noise complaints were filed in 2025?';
const OUTPUT = 'About 740,000 noise complaints were filed in 2025.';
const SUMMARY = 'Noise complaints filed in 2025, counted from one dataset.';
const MODEL = 'anthropic/claude-sonnet-5.5';
const PORTAL = 'data.cityofnewyork.us';
const ROUTER_VERSION = '0.5.0';

const LOAD_ARGS = { alias: 'socrata' };
const DATA_ARGS = { type: 'query', portal: PORTAL, dataset_id: 'erm2-nwe9', select: 'count(*)' };

/** The final request's tools array: the directory tool, then the loaded source's tool. */
const TOOL_DEFINITIONS = [
  { type: 'function', function: { name: 'load_source', parameters: { type: 'object', properties: { alias: { type: 'string', enum: ['socrata', 'data_commons'] } }, required: ['alias'] } } },
  { type: 'function', function: { name: 'socrata__get_data', parameters: { type: 'object' } } },
];
const MCP_SERVERS = [
  { url: 'https://socrata-mcp.example', name: 'socrata' },
  { url: 'https://api.datacommons.org/mcp', name: 'data-commons' },
];
const SOURCES_OFFERED = [
  { sourceId: 'socrata', alias: 'socrata', reason: 'configured' },
  { sourceId: 'data-commons', alias: 'data_commons', reason: 'configured' },
  { sourceId: 'boston-opencontext', alias: 'boston', reason: 'not-configured' },
];
/** The loaded set, then the router (ADR-0033 §E; the anchor's rider item 4). */
const COMPONENTS = [
  { id: 'socrata', version: '0.9.2', guidanceHash: hash('socrata guidance'), guidanceOrigin: 'endpoint' },
  { id: '@typedstandards/civic-typed-router', version: ROUTER_VERSION },
];
const FLOWS_STATEMENT = { url: 'https://instance.example/api/flows', hash: hash('flows statement'), date: '2026-10-18' };
const ROUTING = { method: 'in-loop', version: ROUTER_VERSION };
const DEFINITION_HASH = hash('harness definition');

function makeClock(): () => number {
  let ms = 100_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 7) % 0x50);
    return out;
  };
}

/** The in-loop run's trace: the directory request, the load, the request with
 *  the loaded source's tools, its data call, the answer. */
function captureInLoopRun(): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash(PROMPT) });

  const directoryRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '0' });
  tb.endSpan(directoryRequest, { 'gen_ai.response.prompt_tokens': 1834, 'gen_ai.response.completion_tokens': 18 });

  const load = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'load_source',
    'tool.operation_type': 'load_source',
    'tool.arguments': JSON.stringify(LOAD_ARGS),
  });
  tb.endSpan(load, { 'tool.load_outcome': 'loaded', 'tool.duration_ms': 3 });

  const loadedRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '1' });
  tb.endSpan(loadedRequest, { 'gen_ai.response.prompt_tokens': 14118, 'gen_ai.response.completion_tokens': 64 });

  const dataCall = tb.startSpan('mcp_tool_call', undefined, {
    'mcp.source': 'socrata',
    'tool.name': 'socrata__get_data',
    'tool.operation_type': 'query',
    'tool.arguments': JSON.stringify(DATA_ARGS),
    'tool.dataset_id': DATA_ARGS.dataset_id,
    'tool.portal_domain': PORTAL,
    'tool.upstream_name': 'get_data',
    'mcp.alias': 'socrata',
  });
  tb.endSpan(dataCall, { 'tool.response_hash': hash('count rows'), 'tool.response_rows': 1, 'tool.duration_ms': 410 });

  const answer = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '2' });
  tb.endSpan(answer, { 'gen_ai.response.prompt_tokens': 14260, 'gen_ai.response.completion_tokens': 52 });

  tb.endRoot({
    'analysis.asserted_date': '2026-10-19',
    'analysis.mcp_servers': JSON.stringify(MCP_SERVERS),
    'analysis.tool_definitions': JSON.stringify(TOOL_DEFINITIONS),
    'analysis.sources_offered': JSON.stringify(SOURCES_OFFERED),
    'analysis.components': JSON.stringify(COMPONENTS),
    'analysis.flows_statement': JSON.stringify(FLOWS_STATEMENT),
    'analysis.routing': JSON.stringify(ROUTING),
    'analysis.definition_hash': DEFINITION_HASH,
  });
  return tb.finalize() as unknown as Record<string, unknown>;
}

/** Derive and assemble the in-loop record, deterministically. Exported so the
 *  fixture can be regenerated from the same function the test compares. */
export function buildInLoopRecord(): { pkg: RecordPackage; envelopeHash: string } {
  const trace = captureInLoopRun();
  const toolCalls: ToolCallSummary[] = [
    { name: 'load_source', args: LOAD_ARGS },
    { name: 'socrata__get_data', args: DATA_ARGS },
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
    // The caller's own derivation of each call, in call order.
    queries: [
      { tool: 'load_source', operationType: 'load_source', arguments: LOAD_ARGS },
      { tool: 'socrata__get_data', operationType: 'query', arguments: DATA_ARGS, datasetId: DATA_ARGS.dataset_id, portal: PORTAL, resultRows: 1 },
    ],
    dataSources: buildDataSources(toolCalls, trace, undefined, CREATED_AT),
    cost: { promptTokens: 30212, completionTokens: 134, totalTokens: 30346, model: MODEL },
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

interface InLoopFixture {
  note: string[];
  serializedJson: string;
  contentHashSha256: string;
  envelopeHash: string;
}

function readFixture(): InLoopFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as InLoopFixture;
}

type Node = { '@id': string; [k: string]: unknown };

test('in-loop golden: the record states one load and one data call — one server agent, one dataSources entry, the load on the platform agent', () => {
  const { pkg } = buildInLoopRecord();
  const record = pkg as unknown as Record<string, unknown>;
  const nodes = (record.provenance as { '@graph': Node[] })['@graph'];
  assert.deepEqual(
    nodes.map((n) => n['@id']).filter((id) => id.includes(':mcp-server:')),
    ['urn:civic-record:mcp-server:socrata'],
  );
  assert.deepEqual((record.dataSources as Array<{ sourceId: string }>).map((e) => e.sourceId), ['socrata']);
  const toolCalls = nodes.filter((n) => n['@id'].includes(':tool-call:') && n['@type'] === 'prov:Activity');
  assert.equal(toolCalls.length, 2);
  const load = toolCalls.find((n) => n['civic:loadOutcome'] !== undefined);
  assert.ok(load, 'the load activity states its outcome');
  assert.equal(load!['civic:loadOutcome'], 'loaded');
  assert.deepEqual(load!['prov:wasAssociatedWith'], { '@id': 'urn:civic-record:platform:civic-ai-tools' });
  assert.equal(Object.prototype.hasOwnProperty.call(load, 'civic:sourceId'), false);
  assert.equal(nodes.filter((n) => n['@id'].includes(':data:')).length, 1, 'one data-response entity, the data call\'s');
});

test('in-loop golden: the composition block ends flowsStatement, routing, definitionHash, and states in-loop routing and the definition hash', () => {
  const { pkg } = buildInLoopRecord();
  const block = (pkg as unknown as { extensions: Record<string, Record<string, unknown>> }).extensions[COMPOSITION_EXTENSION_KEY];
  assert.deepEqual(Object.keys(block), ['assertedDate', 'sourcesOffered', 'components', 'flowsStatement', 'routing', 'definitionHash']);
  assert.deepEqual(block.routing, ROUTING);
  assert.equal(block.definitionHash, DEFINITION_HASH);
});

test('in-loop golden: the record reproduces the fixture byte for byte, and both hashes', () => {
  const fixture = readFixture();
  const { pkg, envelopeHash } = buildInLoopRecord();
  const serialized = JSON.stringify(pkg);
  assert.ok(serialized === fixture.serializedJson, 'the in-loop record differs from in-loop-golden.json');
  assert.equal(pkg.contentHash?.sha256, fixture.contentHashSha256);
  assert.equal(envelopeHash, fixture.envelopeHash);
  // The recorded hashes are the hashes of the recorded bytes, by produce-core's own chain.
  const stored = JSON.parse(fixture.serializedJson) as Record<string, unknown>;
  assert.equal(computeEnvelopeHash(stored), fixture.envelopeHash);
  assert.equal(computeContentHashSha256(stored, stored.contentCanonicalization as string), fixture.contentHashSha256);
});

test('in-loop golden: fixture convention — no bare run of thirteen or more digits', () => {
  assert.doesNotMatch(readFileSync(FIXTURE_PATH, 'utf8'), /\b\d{13,19}\b/);
  assert.doesNotMatch(JSON.stringify(buildInLoopRecord().pkg), /\b\d{13,19}\b/);
});
