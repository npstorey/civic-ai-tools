// The civicaitools-v1 golden (hub ADR-0038): one packaged record that
// declares the Producer Profile subtype `ai-assisted-analysis/civicaitools-v1`,
// held byte for byte, and the subtype constant the reference host passes.
//
// WHAT IT PINS.
//   - The constant: its value, its profile-type prefix, and verify-core's
//     subtype-table row for it, with the bundle digest ADR-0038 §5 records.
//   - The derivation: an explicit subtype wins under both content profiles
//     (`deriveProducerProfile` is unchanged; this file pins it).
//   - The golden: a `datHere` record of an in-loop run (composition block with
//     `routing` and `definitionHash`) that declares the subtype and carries the
//     system prompt as website issue 694's ruling C puts it on new records:
//     `skillMetadata.systemPromptHash` inline, and `skillMetadata.skillText` a
//     BlobRef whose stated content hash equals it. The BlobRef's bytes are NOT
//     in the fixture: a record carries the reference and the hash, and the text
//     is a separate blob. Check 17 reads `ok` on a BlobRef without resolving it
//     (check 9 resolves it), so the record verifies with no fetch.
//   - A hash-only `default` record: it carries the subtype and
//     `metadata.contentProfile: "default"`; without the subtype passed it
//     carries no `producerProfile` key, as before.
//
// WHERE THE BYTES COME FROM. This repository's own code, as for
// `in-loop-golden.json`: `buildCivicAiToolsV1Record()` derives the record from
// literal inputs with an injected clock and id source, and produce-core
// assembles it. Nothing outside this repository produced them.
//
// DETERMINISM. Millisecond values stay at six digits, so every `<ms>000000`
// timestamp is at most twelve digits, and every id byte is in 0xa0-0xef (no
// bare run of thirteen or more digits; asserted below).
//
// REGENERATING. Only when a change is intended to move these bytes: write
// `JSON.stringify(buildCivicAiToolsV1Record().pkg)` and the two hashes into the
// fixture, and add a dated line to its note saying what moved and why.

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
  type BlobRef,
  type RecordPackage,
} from '@typedstandards/produce-core';
import * as verifyCore from '@typedstandards/verify-core';
import {
  checkContentProfile,
  computeBlobRefHash,
  isBlobRef,
  parseBlobRef,
} from '@typedstandards/verify-core';
import {
  TraceBuilder,
  CIVICAITOOLS_TRACE_CONFIG,
  CIVICAITOOLS_PROVENANCE_CONFIG,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  CIVICAITOOLS_V1_PRODUCER_PROFILE,
  AI_ASSISTED_ANALYSIS_PROFILE_TYPE,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  hash,
  extractRunAttributes,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  deriveProducerProfile,
  type ToolCallSummary,
} from './index.ts';

// RED STUB (removed when verify-core moves to 0.15.0): the three exports that
// 0.15.0 adds are read off the namespace, `undefined` under 0.14.0.
interface SubtypeRowStub {
  readonly admits: readonly string[];
  readonly bundle?: { readonly url: string; readonly sha256: string };
}
const vc = verifyCore as unknown as Record<string, unknown>;
const PRODUCER_PROFILE_SUBTYPES = vc['PRODUCER_PROFILE_SUBTYPES'] as
  | Readonly<Record<string, SubtypeRowStub>>
  | undefined;
const isContentProfileConsistent = vc['isContentProfileConsistent'] as
  | ((producerProfile: string, contentProfile: string) => boolean)
  | undefined;
const checkSystemPrompt = vc['checkSystemPrompt'] as
  | ((pkg: Record<string, unknown>) => { status: string; form?: string })
  | undefined;

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'civicaitools-v1-golden.json');

/** The bundle digest ADR-0038 §5 records for revision 1 (2026-10-30). */
const BUNDLE_SHA256 = '724e399e02db8993041b64982eec731505084bec2ec5e6ca58fda2de8087a281';

const PACKAGE_ID = '00000000-0000-4000-8000-0000000000c1';
const HASH_ONLY_PACKAGE_ID = '00000000-0000-4000-8000-0000000000c2';
const CREATED_AT = '2026-10-30T00:00:00.000Z';
const KID = 'platform:test-key-1';
const SIGNER = {
  bindingTier: 'platform',
  identifier: 'platform:civic-ai-tools',
  displayName: 'Civic AI Tools Platform',
};
const PROMPT = 'How many street tree service requests were filed in 2025?';
const OUTPUT = 'About 61,000 street tree service requests were filed in 2025.';
const SUMMARY = 'Street tree service requests filed in 2025, counted from one dataset.';
const MODEL = 'anthropic/claude-sonnet-5.5';
const PORTAL = 'data.cityofnewyork.us';
const ROUTER_VERSION = '0.6.0';

/** The composed system prompt the run's requests carried. Its bytes are the
 *  blob's, not the record's: the record states their hash and a BlobRef. */
const SYSTEM_PROMPT = [
  'You are a civic data analyst. Today is 2026-10-30.',
  'Load a source before you query it, and name each dataset you use.',
  'Sources you can load: socrata, data_commons.',
].join('\n');
const SYSTEM_PROMPT_HASH = hash(SYSTEM_PROMPT);
/** One blob per distinct composed prompt, addressed by its hash. */
const SKILL_TEXT_REF: BlobRef = {
  ref: `blob:sha256:${SYSTEM_PROMPT_HASH}`,
  url: `https://blob-store.example/system-prompts/${SYSTEM_PROMPT_HASH}.md`,
  contentType: 'text/markdown',
  size: new TextEncoder().encode(SYSTEM_PROMPT).length,
};
const SKILL_METADATA = { systemPromptHash: SYSTEM_PROMPT_HASH, skillText: SKILL_TEXT_REF };

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
];
const COMPONENTS = [
  { id: 'socrata', version: '0.9.2', guidanceHash: hash('socrata guidance'), guidanceOrigin: 'endpoint' },
  { id: '@typedstandards/civic-typed-router', version: ROUTER_VERSION },
];
const FLOWS_STATEMENT = { url: 'https://instance.example/api/flows', hash: hash('flows statement'), date: '2026-10-18' };
const ROUTING = { method: 'in-loop', version: ROUTER_VERSION };
const DEFINITION_HASH = hash('harness definition, civicaitools-v1 golden');

function makeClock(): () => number {
  let ms = 200_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 11) % 0x50);
    return out;
  };
}

/** The run's trace: the directory request, the load, the request with the
 *  loaded source's tools, its data call, the answer. Each request states the
 *  composed prompt's hash, as the reference host's traces do. */
function captureRun(): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash(PROMPT) });

  const directoryRequest = tb.startSpan('llm_inference', undefined, {
    'gen_ai.inference_index': '0',
    'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH,
  });
  tb.endSpan(directoryRequest, { 'gen_ai.response.prompt_tokens': 1902, 'gen_ai.response.completion_tokens': 17 });

  const load = tb.startSpan('mcp_tool_call', undefined, {
    'tool.name': 'load_source',
    'tool.operation_type': 'load_source',
    'tool.arguments': JSON.stringify(LOAD_ARGS),
  });
  tb.endSpan(load, { 'tool.load_outcome': 'loaded', 'tool.duration_ms': 4 });

  const loadedRequest = tb.startSpan('llm_inference', undefined, {
    'gen_ai.inference_index': '1',
    'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH,
  });
  tb.endSpan(loadedRequest, { 'gen_ai.response.prompt_tokens': 14205, 'gen_ai.response.completion_tokens': 61 });

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
  tb.endSpan(dataCall, { 'tool.response_hash': hash('count rows'), 'tool.response_rows': 1, 'tool.duration_ms': 388 });

  const answer = tb.startSpan('llm_inference', undefined, {
    'gen_ai.inference_index': '2',
    'gen_ai.system_prompt_hash': SYSTEM_PROMPT_HASH,
  });
  tb.endSpan(answer, { 'gen_ai.response.prompt_tokens': 14331, 'gen_ai.response.completion_tokens': 49 });

  tb.endRoot({
    'analysis.asserted_date': '2026-10-30',
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

/** Derive and assemble a record of the run under one content profile,
 *  deterministically. `producerProfile` is passed as the reference host passes
 *  it; `undefined` leaves the derivation to its datHere fallback. */
function buildRunRecord(opts: {
  packageId: string;
  contentProfile: string;
  promptVisibility: 'full_text' | 'hash_only';
  producerProfile: string | undefined;
}): { pkg: RecordPackage; envelopeHash: string } {
  const trace = captureRun();
  const toolCalls: ToolCallSummary[] = [
    { name: 'load_source', args: LOAD_ARGS },
    { name: 'socrata__get_data', args: DATA_ARGS },
  ];
  const isDatHere = opts.contentProfile === DATHERE_CONTENT_PROFILE;
  const fields = deriveDatHereEnvelopeFields({
    model: MODEL,
    contentProfile: opts.contentProfile,
    producerProfile: opts.producerProfile,
    summary: SUMMARY,
    ...(isDatHere
      ? { extensions: { 'org.civicaitools.notebook': { nbformat: 4, nbformat_minor: 5, cells: [], metadata: {} } } }
      : {}),
    ...extractRunAttributes(trace),
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  const { pkg, envelopeHash } = buildEnvelope({
    packageId: opts.packageId,
    createdAt: CREATED_AT,
    signingKeyId: KID,
    prompt: PROMPT,
    promptVisibility: opts.promptVisibility,
    queries: [
      { tool: 'load_source', operationType: 'load_source', arguments: LOAD_ARGS },
      { tool: 'socrata__get_data', operationType: 'query', arguments: DATA_ARGS, datasetId: DATA_ARGS.dataset_id, portal: PORTAL, resultRows: 1 },
    ],
    dataSources: buildDataSources(toolCalls, trace, undefined, CREATED_AT),
    cost: { promptTokens: 30438, completionTokens: 127, totalTokens: 30565, model: MODEL },
    // Website issue 694, ruling C: the hash inline and the text as a BlobRef.
    skillMetadata: SKILL_METADATA,
    output: OUTPUT,
    trace,
    captureMethod: 'chat-flow-stream',
    contentProfile: opts.contentProfile,
    type: DEFAULT_CONTENT_TYPE,
    signer: SIGNER,
    provenance: buildProvenanceGraph(trace, {
      packageId: opts.packageId,
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

/** The golden: a `datHere` record that declares the subtype. Exported so the
 *  fixture can be regenerated from the same function the test compares. */
export function buildCivicAiToolsV1Record(): { pkg: RecordPackage; envelopeHash: string } {
  return buildRunRecord({
    packageId: PACKAGE_ID,
    contentProfile: DATHERE_CONTENT_PROFILE,
    promptVisibility: 'full_text',
    producerProfile: CIVICAITOOLS_V1_PRODUCER_PROFILE,
  });
}

/** A hash-only record of the same run: `contentProfile: "default"`. */
function buildHashOnlyRecord(producerProfile: string | undefined): Record<string, unknown> {
  return buildRunRecord({
    packageId: HASH_ONLY_PACKAGE_ID,
    contentProfile: 'default',
    promptVisibility: 'hash_only',
    producerProfile,
  }).pkg as unknown as Record<string, unknown>;
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

// --- The constant (criterion 4) ---

test('civicaitools-v1: the subtype constant, its profile-type prefix, and verify-core\'s row with the bundle digest', () => {
  assert.equal(CIVICAITOOLS_V1_PRODUCER_PROFILE, 'ai-assisted-analysis/civicaitools-v1');
  assert.ok(CIVICAITOOLS_V1_PRODUCER_PROFILE.startsWith(`${AI_ASSISTED_ANALYSIS_PROFILE_TYPE}/`));
  assert.ok(PRODUCER_PROFILE_SUBTYPES, 'verify-core exports PRODUCER_PROFILE_SUBTYPES');
  const row = PRODUCER_PROFILE_SUBTYPES[CIVICAITOOLS_V1_PRODUCER_PROFILE];
  assert.ok(row, 'verify-core\'s subtype table has a row for the constant');
  assert.deepEqual([...row.admits], ['datHere', 'default']);
  assert.equal(row.bundle?.sha256, BUNDLE_SHA256);
});

test('civicaitools-v1: the derivation states the passed subtype under both content profiles', () => {
  assert.equal(deriveProducerProfile(CIVICAITOOLS_V1_PRODUCER_PROFILE, 'datHere'), 'ai-assisted-analysis/civicaitools-v1');
  assert.equal(deriveProducerProfile(CIVICAITOOLS_V1_PRODUCER_PROFILE, 'default'), 'ai-assisted-analysis/civicaitools-v1');
  for (const contentProfile of ['datHere', 'default']) {
    const fields = deriveDatHereEnvelopeFields(
      { model: MODEL, contentProfile, producerProfile: CIVICAITOOLS_V1_PRODUCER_PROFILE },
      CIVICAITOOLS_ENVIRONMENT_CONFIG,
    );
    assert.equal(fields.producerProfile, 'ai-assisted-analysis/civicaitools-v1', contentProfile);
  }
});

// --- The golden (criterion 2) ---

test('civicaitools-v1 golden: the record reproduces the fixture byte for byte, and both hashes', () => {
  const fixture = readFixture();
  const { pkg, envelopeHash } = buildCivicAiToolsV1Record();
  const serialized = JSON.stringify(pkg);
  assert.ok(serialized === fixture.serializedJson, 'the civicaitools-v1 record differs from civicaitools-v1-golden.json');
  assert.equal(pkg.contentHash?.sha256, fixture.contentHashSha256);
  assert.equal(envelopeHash, fixture.envelopeHash);
  // The recorded hashes are the hashes of the recorded bytes, by produce-core's own chain.
  const stored = storedRecord();
  assert.equal(computeEnvelopeHash(stored), fixture.envelopeHash);
  assert.equal(computeContentHashSha256(stored, stored.contentCanonicalization as string), fixture.contentHashSha256);
});

test('civicaitools-v1 golden: it declares the subtype on a datHere record of an in-loop run', () => {
  const stored = storedRecord();
  assert.equal(stored.producerProfile, 'ai-assisted-analysis/civicaitools-v1');
  assert.equal((stored.metadata as Record<string, unknown>).contentProfile, 'datHere');
  const block = (stored.extensions as Record<string, Record<string, unknown>>)[COMPOSITION_EXTENSION_KEY];
  assert.deepEqual(Object.keys(block), ['assertedDate', 'sourcesOffered', 'components', 'flowsStatement', 'routing', 'definitionHash']);
  assert.deepEqual(block.routing, ROUTING);
  assert.equal(block.definitionHash, DEFINITION_HASH);
});

test('civicaitools-v1 golden: the system prompt is its hash inline and a BlobRef to the text, and the text is not in the record', () => {
  const stored = storedRecord();
  const skill = stored.skillMetadata as Record<string, unknown>;
  assert.deepEqual(Object.keys(skill), ['systemPromptHash', 'skillText']);
  assert.equal(skill.systemPromptHash, SYSTEM_PROMPT_HASH);
  assert.ok(isBlobRef(skill.skillText), 'skillText is a BlobRef');
  const ref = skill.skillText as BlobRef;
  // The BlobRef's stated content hash is the inline hash, and both are the text's.
  assert.equal(parseBlobRef(ref.ref).hash, skill.systemPromptHash);
  assert.equal(ref.ref, `blob:sha256:${computeBlobRefHash(SYSTEM_PROMPT)}`);
  assert.equal(ref.size, new TextEncoder().encode(SYSTEM_PROMPT).length);
  // Every request of the run states the same hash in the trace.
  const spans = (stored.trace as { resourceSpans: Array<{ scopeSpans: Array<{ spans: Array<{ name: string; attributes: Array<{ key: string; value: { stringValue?: string } }> }> }> }> })
    .resourceSpans[0].scopeSpans[0].spans;
  const traced = spans
    .filter((s) => s.name === 'llm_inference')
    .map((s) => s.attributes.find((a) => a.key === 'gen_ai.system_prompt_hash')?.value.stringValue);
  assert.deepEqual(traced, [SYSTEM_PROMPT_HASH, SYSTEM_PROMPT_HASH, SYSTEM_PROMPT_HASH]);
  // The blob's bytes are not in the fixture: the record carries the reference.
  assert.equal(readFileSync(FIXTURE_PATH, 'utf8').includes(SYSTEM_PROMPT.split('\n')[0]), false);
});

test('civicaitools-v1 golden: under verify-core, check 16 and check 17 read ok and the invariant holds', () => {
  for (const [label, record] of [
    ['the fixture', storedRecord()],
    ['the built record', buildCivicAiToolsV1Record().pkg as unknown as Record<string, unknown>],
  ] as const) {
    assert.equal(checkContentProfile(record).status, 'ok', `check 16 on ${label}`);
    assert.equal(typeof checkSystemPrompt, 'function', 'verify-core exports checkSystemPrompt');
    assert.deepEqual(checkSystemPrompt!(record), { status: 'ok', form: 'blobRef' }, `check 17 on ${label}`);
  }
  assert.equal(typeof isContentProfileConsistent, 'function', 'verify-core exports isContentProfileConsistent');
  assert.equal(isContentProfileConsistent!('ai-assisted-analysis/civicaitools-v1', 'datHere'), true);
});

test('civicaitools-v1 golden: fixture convention — no bare run of thirteen or more digits', () => {
  assert.doesNotMatch(readFileSync(FIXTURE_PATH, 'utf8'), /\b\d{13,19}\b/);
  assert.doesNotMatch(JSON.stringify(buildCivicAiToolsV1Record().pkg), /\b\d{13,19}\b/);
});

// --- A hash-only record (criterion 3) ---

test('civicaitools-v1: a hash-only default record carries the subtype and "default"; check 16 ok, check 17 not_applicable', () => {
  const record = buildHashOnlyRecord(CIVICAITOOLS_V1_PRODUCER_PROFILE);
  assert.equal(record.producerProfile, 'ai-assisted-analysis/civicaitools-v1');
  assert.equal((record.metadata as Record<string, unknown>).contentProfile, 'default');
  assert.equal((record.prompt as Record<string, unknown>).visibility, 'hash_only');
  assert.equal(checkContentProfile(record).status, 'ok');
  assert.equal(typeof checkSystemPrompt, 'function', 'verify-core exports checkSystemPrompt');
  assert.deepEqual(checkSystemPrompt!(record), { status: 'not_applicable' });
  assert.doesNotMatch(JSON.stringify(record), /\b\d{13,19}\b/);
});

test('civicaitools-v1: the same hash-only input with no subtype passed emits no producerProfile key', () => {
  const record = buildHashOnlyRecord(undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(record, 'producerProfile'), false);
  assert.equal((record.metadata as Record<string, unknown>).contentProfile, 'default');
});
