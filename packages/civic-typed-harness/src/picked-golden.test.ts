// The picked-run golden (ADR-0033 amendment 5; sprint anchor
// civic-ai-tools#318, S3-A P2, criterion A12, with B9): one packaged record of
// an in-loop run whose sources the reader picked for the question. Held byte
// for byte.
//
// WHAT IT PINS.
//   - `considered.rule` is `reader-picked`, `ruleVersion` `1`, and `listed`
//     the number of picks that survived (two of the reader's three: the third
//     is a source the site has not set up). The harness does not enumerate
//     rules (capture/run-attributes.ts, `consideredObject`); this record is
//     the value a producer may write (ADR-0033 amendment 5).
//   - The composition block's `routingConfiguration`, after `considered`,
//     with rule `reader-picked` version `1`, cap `none` and search `none`: no
//     search on a picked run (G0-4 = A), so the tools array offers no
//     `find_source` and the trace holds no search span.
//   - `sourcesOffered` gives `selected` to each surviving pick and
//     `not-selected` to a source the reader allows and did not pick (anchor
//     B8); the harness states the reasons as passed.
//   - The record verifies under the installed verify-core with the checks
//     its producer profile names: checks 1, 4, 15, 16 and 17.
// Every record built without the attribute keeps 0.13.0's bytes: the other
// goldens are unchanged and pass.
//
// THE INVENTORY HERE IS A TEST ONE (`test-inventory`), as the considered
// golden's is. The routing configuration's hash is the SHA-256 of the
// canonical JSON written out below by hand, hashed with node:crypto.
//
// DETERMINISM. The clock and the id source are injected: millisecond values
// stay at six digits, and every id byte is in 0xa0-0xef (fixture convention:
// no bare run of thirteen or more digits; asserted below).
//
// REGENERATING. Only when a change is intended to move these bytes: write
// `JSON.stringify(buildPickedRecord().pkg)` and the two hashes into the
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
  CIVIC_TERM_SEARCH_QUERY,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  hash,
  extractRunAttributes,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  type ConsideredInput,
  type RoutingConfigurationInput,
  type ToolCallSummary,
} from './index.ts';

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'picked-golden.json');

const PACKAGE_ID = '00000000-0000-4000-8000-0000000000d6';
const CREATED_AT = '2026-11-13T00:00:00.000Z';
const KID = 'platform:test-key-1';
const SIGNER = {
  bindingTier: 'platform',
  identifier: 'platform:civic-ai-tools',
  displayName: 'Civic AI Tools Platform',
};
const PROMPT = 'How many street tree service requests were filed in 2025?';
const OUTPUT = 'About 61,000 street tree service requests were filed in 2025.';
const SUMMARY = 'Street tree service requests filed in 2025, counted from one dataset of a source the reader picked.';
const MODEL = 'anthropic/claude-sonnet-5.5';
const PORTAL = 'data.cityofnewyork.us';
const DATASET = 'erm2-nwe9';
const ROUTER_VERSION = '0.10.0';

const INVENTORY_HASH = hash('test inventory');
const INVENTORY = { id: 'test-inventory', version: `2026-11-07.1+${INVENTORY_HASH.slice(0, 12)}`, hash: INVENTORY_HASH };

/** The reader picked three sources; two survived (the third is not set up on the site). */
const CONSIDERED: ConsideredInput = {
  inventory: INVENTORY,
  total: 8,
  listed: 2,
  rule: 'reader-picked',
  ruleVersion: '1',
};

/** The routing configuration's canonical JSON, written out: members in
 *  code-unit order, no whitespace. */
const ROUTING_CONFIGURATION_CANONICAL =
  `{"cap":"none","inventory":{"hash":"${INVENTORY.hash}","id":"${INVENTORY.id}","version":"${INVENTORY.version}"},`
  + '"rule":{"id":"reader-picked","version":"1"},"search":"none"}';
export const ROUTING_CONFIGURATION: RoutingConfigurationInput = {
  rule: { id: 'reader-picked', version: '1' },
  cap: 'none',
  search: 'none',
  inventory: INVENTORY,
  hash: createHash('sha256').update(ROUTING_CONFIGURATION_CANONICAL).digest('hex'),
};

const LOAD_ARGS = { alias: 'socrata' };
const DATA_ARGS = { type: 'query', portal: PORTAL, dataset_id: DATASET, select: 'count(*)' };

/** The final request's tools array: the directory tool over the picks, then the loaded source's tool; no find_source. */
const TOOL_DEFINITIONS = [
  { type: 'function', function: { name: 'load_source', parameters: { type: 'object', properties: { alias: { type: 'string', enum: ['socrata', 'data_commons'] } }, required: ['alias'] } } },
  { type: 'function', function: { name: 'socrata__get_data', parameters: { type: 'object' } } },
];
const MCP_SERVERS = [
  { url: 'https://socrata-mcp.example', name: 'socrata' },
  { url: 'https://api.datacommons.org/mcp', name: 'data-commons' },
];
const SOURCES_OFFERED = [
  { sourceId: 'socrata', alias: 'socrata', reason: 'selected' },
  { sourceId: 'data-commons', alias: 'data_commons', reason: 'selected' },
  { sourceId: 'boston-opencontext', alias: 'boston', reason: 'not-configured' },
  { sourceId: 'notices', alias: 'notices', reason: 'not-selected' },
];
const COMPONENTS = [
  { id: 'socrata', version: '0.9.2', guidanceHash: hash('socrata guidance'), guidanceOrigin: 'endpoint' },
  { id: '@typedstandards/civic-typed-router', version: ROUTER_VERSION },
];
const FLOWS_STATEMENT = { url: 'https://instance.example/api/flows', hash: hash('flows statement'), date: '2026-11-06' };
const ROUTING = { method: 'in-loop', version: ROUTER_VERSION };
const DEFINITION_HASH = hash('harness definition of a picked run');

const SYSTEM_PROMPT = [
  'You are a civic data analyst. Today is 2026-11-13.',
  'Load a source before you query it, and name each dataset you use.',
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
  let ms = 700_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 29) % 0x50);
    return out;
  };
}

/** The run's trace: the directory request over the picks, a load of one of
 *  them (no question put), the request with its tools, its data call, the
 *  answer. */
function captureRun(): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash(PROMPT) });

  const directoryRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '0', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(directoryRequest, { 'gen_ai.response.prompt_tokens': 1702, 'gen_ai.response.completion_tokens': 15 });

  const load = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'load_source',
    'tool.operation_type': 'load_source',
    'tool.arguments': JSON.stringify(LOAD_ARGS),
  });
  tb.endSpan(load, { 'tool.load_outcome': 'loaded', 'tool.load_asked': false, 'tool.duration_ms': 2 });

  const loadedRequest = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '1', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(loadedRequest, { 'gen_ai.response.prompt_tokens': 13980, 'gen_ai.response.completion_tokens': 58 });

  const dataCall = tb.startSpan('mcp_tool_call', undefined, {
    'mcp.source': 'socrata',
    'tool.name': 'socrata__get_data',
    'tool.operation_type': 'query',
    'tool.arguments': JSON.stringify(DATA_ARGS),
    'tool.dataset_id': DATASET,
    'tool.portal_domain': PORTAL,
    'tool.upstream_name': 'get_data',
    'mcp.alias': 'socrata',
    'mcp.server.id': 'socrata',
  });
  tb.endSpan(dataCall, { 'tool.response_hash': hash('count rows'), 'tool.response_rows': 1, 'tool.duration_ms': 401 });

  const answer = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '2', 'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH });
  tb.endSpan(answer, { 'gen_ai.response.prompt_tokens': 14102, 'gen_ai.response.completion_tokens': 47 });

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
    'analysis.routing_configuration': JSON.stringify(ROUTING_CONFIGURATION),
  });
  return tb.finalize() as unknown as Record<string, unknown>;
}

const TOOL_CALLS: ToolCallSummary[] = [
  { name: 'load_source', args: LOAD_ARGS },
  { name: 'socrata__get_data', args: DATA_ARGS },
];

/** Derive and assemble the record, deterministically. Exported so the
 *  fixture can be regenerated from the same function the test compares. */
export function buildPickedRecord(): { pkg: RecordPackage; envelopeHash: string } {
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
      { tool: 'load_source', operationType: 'load_source', arguments: LOAD_ARGS },
      { tool: 'socrata__get_data', operationType: 'query', arguments: DATA_ARGS, datasetId: DATASET, portal: PORTAL, resultRows: 1 },
    ],
    dataSources: buildDataSources(TOOL_CALLS, trace, undefined, CREATED_AT),
    cost: { promptTokens: 29784, completionTokens: 120, totalTokens: 29904, model: MODEL },
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

function blockOf(record: Record<string, unknown>): Record<string, unknown> {
  return (record.extensions as Record<string, Record<string, unknown>>)[COMPOSITION_EXTENSION_KEY]!;
}

// --- The golden ---------------------------------------------------------------------------

test('picked golden: the record reproduces the fixture byte for byte, and both hashes', () => {
  const fixture = readFixture();
  const { pkg, envelopeHash } = buildPickedRecord();
  const serialized = JSON.stringify(pkg);
  assert.ok(serialized === fixture.serializedJson, 'the picked record differs from picked-golden.json');
  assert.equal(pkg.contentHash?.sha256, fixture.contentHashSha256);
  assert.equal(envelopeHash, fixture.envelopeHash);
  const stored = storedRecord();
  assert.equal(computeEnvelopeHash(stored), fixture.envelopeHash);
  assert.equal(computeContentHashSha256(stored, stored.contentCanonicalization as string), fixture.contentHashSha256);
});

test('picked golden: under verify-core, checks 1, 4, 15, 16 and 17 read ok on the fixture and on the built record', () => {
  const fixture = readFixture();
  for (const [label, record] of [
    ['the fixture', storedRecord()],
    ['the built record', buildPickedRecord().pkg as unknown as Record<string, unknown>],
  ] as const) {
    assert.equal(recomputePackageHash(record), fixture.envelopeHash, `check 1 on ${label}`);
    assert.equal(verifyContentHash(record, resolveContentCanonicalization(record)).status, 'ok', `check 4 on ${label}`);
    assert.equal(checkCaptureMethodVocab(record).status, 'ok', `check 15 on ${label}`);
    assert.equal(checkContentProfile(record).status, 'ok', `check 16 on ${label}`);
    assert.deepEqual(checkSystemPrompt(record), { status: 'ok', form: 'blobRef' }, `check 17 on ${label}`);
  }
  assert.equal(storedRecord().producerProfile, CIVICAITOOLS_V1_PRODUCER_PROFILE);
});

test('picked golden: considered reads reader-picked, version 1, with listed the picks that survived', () => {
  const considered = blockOf(storedRecord()).considered as Record<string, unknown>;
  assert.equal(considered.rule, 'reader-picked');
  assert.equal(considered.ruleVersion, '1');
  assert.equal(considered.listed, 2);
  assert.equal(considered.total, 8);
});

test('picked golden: the routing configuration follows considered and reads rule reader-picked 1, cap none, search none', () => {
  const block = blockOf(storedRecord());
  assert.deepEqual(Object.keys(block), [
    'assertedDate', 'sourcesOffered', 'components', 'flowsStatement', 'routing', 'definitionHash', 'considered', 'routingConfiguration',
  ]);
  const configuration = block.routingConfiguration as Record<string, unknown>;
  assert.equal(JSON.stringify(configuration), JSON.stringify(ROUTING_CONFIGURATION));
  assert.deepEqual(configuration.rule, { id: 'reader-picked', version: '1' });
  assert.equal(configuration.cap, 'none');
  assert.equal(configuration.search, 'none');
  assert.equal(configuration.hash, createHash('sha256').update(ROUTING_CONFIGURATION_CANONICAL).digest('hex'));
});

test('picked golden: no search — the tools array offers no find_source and no activity states a search', () => {
  const stored = storedRecord();
  const environment = (stored.extensions as Record<string, Record<string, unknown>>)['org.civicaitools.environment']!;
  const names = (environment.toolDefinitions as Array<{ function: { name: string } }>).map((t) => t.function.name);
  assert.deepEqual(names, ['load_source', 'socrata__get_data']);
  const nodes = (stored.provenance as { '@graph': Array<Record<string, unknown>> })['@graph'];
  assert.equal(nodes.some((n) => Object.hasOwn(n, CIVIC_TERM_SEARCH_HITS) || Object.hasOwn(n, CIVIC_TERM_SEARCH_QUERY)), false);
  assert.equal(JSON.stringify(stored.trace).includes('find_source'), false);
});

test('picked golden: sourcesOffered states selected for each surviving pick and not-selected for an allowed source not picked', () => {
  const offered = blockOf(storedRecord()).sourcesOffered as Array<Record<string, unknown>>;
  assert.deepEqual(offered.map((e) => `${e.sourceId}:${e.reason}`), [
    'socrata:selected', 'data-commons:selected', 'boston-opencontext:not-configured', 'notices:not-selected',
  ]);
});

test('picked golden: fixture convention — no bare run of thirteen or more digits', () => {
  assert.doesNotMatch(readFileSync(FIXTURE_PATH, 'utf8'), /\b\d{13,19}\b/);
  assert.doesNotMatch(JSON.stringify(buildPickedRecord().pkg), /\b\d{13,19}\b/);
});
