// The reported-keys golden (ADR-0033 amendment 4): one packaged record of an
// all-sources run whose remote server's component states what the server
// reported itself as, `reportedName` and `reportedVersion`. Held byte for byte.
//
// WHAT IT PINS.
//   - The two keys on a `components[]` entry, after `guidanceOrigin`, each
//     stated as passed: the base server's entry carries both; a second remote
//     server's entry, whose report the producer did not read, carries neither;
//     the pack's entry and the composing package's carry neither.
//   - Nothing else moved: the same trace with the two keys left out of
//     `analysis.components` yields the block a record built without them has,
//     byte for byte, and a block built with them differs (the decoy).
//   - The refusals: a key that is empty or not a string is refused by the
//     derivation with `RecordFieldError('components', …)`; a present
//     `analysis.components` whose entry carries a non-string key is refused by
//     the extractor with `RunAttributeError`.
//   - One pack call the producer did not send, recorded as the reference
//     producer records a rejected call (`error`, `error.kind` `base_changed`,
//     `tool.duration_ms`, `mcp.pack_id`): its activity states `civic:failed`,
//     `civic:failureKind` and `civic:packId`, and `dataSources[]` has no entry
//     for it. The harness states the label verbatim; it adds no code for it.
// Every record built without the two keys keeps 0.12.0's bytes: the other
// goldens (`frozen-fixtures.test.ts`, `in-loop-golden.test.ts`,
// `civicaitools-v1-golden.test.ts`, `considered-golden.test.ts`,
// `golden-reproduction.test.ts`) are unchanged and pass.
//
// THE IDS AND VALUES HERE ARE A TEST RUN'S. The pack is a test one
// (`test-pack@example`, version `1.1+<hash12>` of a test string); the base's
// reported name and version are the ones the Socrata server's source states
// (socrata-mcp-server `src/index.ts:114`, `:229-230` at `c0512d0`), used here as
// literals, not read from any server.
//
// DETERMINISM. The clock and the id source are injected, as the considered
// golden injects them: millisecond values stay at six digits, and every id
// byte is in 0xa0-0xef (fixture convention: no bare run of thirteen or more
// digits; the serialized record is asserted run-free below).
//
// REGENERATING. Only when a change is intended to move these bytes: write
// `JSON.stringify(buildReportedKeysRecord().pkg)` and the two hashes into the
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
  CIVIC_TERM_FAILED,
  CIVIC_TERM_FAILURE_KIND,
  CIVIC_TERM_PACK_ID,
  COMPOSITION_EXTENSION_KEY,
  DATHERE_CONTENT_PROFILE,
  RecordFieldError,
  RunAttributeError,
  hash,
  buildCompositionExtension,
  extractRunAttributes,
  extractSkillMetadata,
  buildDataSources,
  buildProvenanceGraph,
  deriveDatHereEnvelopeFields,
  type CompositionComponentInput,
  type ToolCallSummary,
} from './index.ts';

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'reported-keys-golden.json');

const PACKAGE_ID = '00000000-0000-4000-8000-0000000000c4';
const CREATED_AT = '2026-11-12T00:00:00.000Z';
const KID = 'platform:test-key-1';
const SIGNER = {
  bindingTier: 'platform',
  identifier: 'platform:civic-ai-tools',
  displayName: 'Civic AI Tools Platform',
};
const PROMPT = 'How many street-closure notices were published last week, and how many noise complaints?';
const OUTPUT = 'The notices could not be read; there were 412 noise complaints last week.';
const SUMMARY = 'Noise complaints counted from one dataset; the notices pack call was not sent.';
const MODEL = 'anthropic/claude-sonnet-5.5';
const PORTAL = 'data.cityofnewyork.us';
const NOISE_DATASET = 'ef56-gh78';
const NOTICES_DATASET = 'ab12-cd34';
const ROUTER_VERSION = '0.8.0';

/** The base server: its manifest id, and what it reported itself as. */
const BASE_ID = 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server';
const BASE_REPORTED_NAME = 'socrata-mcp-server';
const BASE_REPORTED_VERSION = '0.9.2';
/** A second remote server, whose report the producer did not read in this run. */
const SECOND_ID = 'datacommons-mcp@https://github.com/datacommonsorg/agent-toolkit';
/** A test pack over the base: `<version>+<hash12>`, the twelve of a test string. */
const PACK_ID = 'test-pack@example';
const PACK_ALIAS = 'notices';
const PACK_VERSION = `1.1+${hash('test pack entry').slice(0, 12)}`;

const NOTICES_ARGS = { type: 'query', portal: PORTAL, dataset_id: NOTICES_DATASET, where: "category = 'street closure'", select: 'count(*)' };
const NOISE_ARGS = { type: 'query', portal: PORTAL, dataset_id: NOISE_DATASET, where: "descriptor like '%Noise%'", select: 'count(*)' };

const TOOL_DEFINITIONS = [
  { type: 'function', function: { name: 'socrata__get_data', parameters: { type: 'object' } } },
  { type: 'function', function: { name: 'data_commons__search_indicators', parameters: { type: 'object' } } },
  { type: 'function', function: { name: `${PACK_ALIAS}__get_data`, parameters: { type: 'object' } } },
];
const MCP_SERVERS = [
  { url: 'https://socrata-mcp.example', name: 'socrata' },
  { url: 'https://api.datacommons.org/mcp', name: 'data-commons' },
];
const SOURCES_OFFERED = [
  { sourceId: 'socrata', alias: 'socrata', reason: 'configured' },
  { sourceId: 'data-commons', alias: 'data_commons', reason: 'configured' },
  { sourceId: 'notices', alias: PACK_ALIAS, reason: 'configured' },
];
/** Every configured source in manifest order, the pack after its base, then the router. */
const COMPONENTS: CompositionComponentInput[] = [
  {
    id: BASE_ID,
    guidanceHash: hash('socrata guidance'),
    guidanceOrigin: 'endpoint',
    reportedName: BASE_REPORTED_NAME,
    reportedVersion: BASE_REPORTED_VERSION,
  },
  { id: SECOND_ID, guidanceHash: hash('data commons guidance'), guidanceOrigin: 'endpoint' },
  { id: PACK_ID, version: PACK_VERSION, guidanceHash: hash('test pack guidance'), guidanceOrigin: 'inline' },
  { id: '@typedstandards/civic-typed-router', version: ROUTER_VERSION },
];

/** `COMPONENTS` with the two reported keys dropped from every entry. */
function withoutReportedKeys(components: CompositionComponentInput[]): CompositionComponentInput[] {
  return components.map(({ reportedName: _n, reportedVersion: _v, ...rest }) => rest);
}

function makeClock(): () => number {
  let ms = 400_000;
  return () => (ms += 250);
}

function makeSeededBytes(): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = 0xa0 + ((counter++ * 17) % 0x50);
    return out;
  };
}

/** The run's trace: a request, the pack's call (not sent: recorded as a
 *  rejected call labelled `base_changed`), the base's own call (answered),
 *  the answer. `components` is what `analysis.components` states. */
function captureRun(components: CompositionComponentInput[] = COMPONENTS): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', { 'query.text_hash': hash(PROMPT) });

  const first = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '0' });
  tb.endSpan(first, { 'gen_ai.response.prompt_tokens': 8010, 'gen_ai.response.completion_tokens': 64 });

  const packCall = tb.startSpan('mcp_tool_call', undefined, {
    'mcp.source': 'socrata',
    'tool.name': `${PACK_ALIAS}__get_data`,
    'tool.operation_type': 'query',
    'tool.arguments': JSON.stringify(NOTICES_ARGS),
    'tool.dataset_id': NOTICES_DATASET,
    'tool.portal_domain': PORTAL,
    'tool.upstream_name': 'get_data',
    'mcp.alias': PACK_ALIAS,
    'mcp.server.id': BASE_ID,
    'mcp.pack_id': PACK_ID,
  });
  tb.endSpan(packCall, { error: true, 'error.kind': 'base_changed', 'tool.duration_ms': 1 });

  const baseCall = tb.startSpan('mcp_tool_call', undefined, {
    'mcp.source': 'socrata',
    'tool.name': 'socrata__get_data',
    'tool.operation_type': 'query',
    'tool.arguments': JSON.stringify(NOISE_ARGS),
    'tool.dataset_id': NOISE_DATASET,
    'tool.portal_domain': PORTAL,
    'tool.upstream_name': 'get_data',
    'mcp.alias': 'socrata',
    'mcp.server.id': BASE_ID,
  });
  tb.endSpan(baseCall, { 'tool.response_hash': hash('noise count'), 'tool.response_rows': 1, 'tool.duration_ms': 410 });

  const answer = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': '1' });
  tb.endSpan(answer, { 'gen_ai.response.prompt_tokens': 8240, 'gen_ai.response.completion_tokens': 52 });

  tb.endRoot({
    'analysis.asserted_date': '2026-11-12',
    'analysis.mcp_servers': JSON.stringify(MCP_SERVERS),
    'analysis.tool_definitions': JSON.stringify(TOOL_DEFINITIONS),
    'analysis.sources_offered': JSON.stringify(SOURCES_OFFERED),
    'analysis.components': JSON.stringify(components),
  });
  return tb.finalize() as unknown as Record<string, unknown>;
}

/** Derive and assemble the record, deterministically. Exported so the
 *  fixture can be regenerated from the same function the test compares. */
export function buildReportedKeysRecord(): { pkg: RecordPackage; envelopeHash: string } {
  const trace = captureRun();
  const toolCalls: ToolCallSummary[] = [
    { name: `${PACK_ALIAS}__get_data`, args: NOTICES_ARGS, failed: true, failureKind: 'base_changed' },
    { name: 'socrata__get_data', args: NOISE_ARGS },
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
      { tool: `${PACK_ALIAS}__get_data`, operationType: 'query', arguments: NOTICES_ARGS, datasetId: NOTICES_DATASET, portal: PORTAL, failed: true, failureKind: 'base_changed' },
      { tool: 'socrata__get_data', operationType: 'query', arguments: NOISE_ARGS, datasetId: NOISE_DATASET, portal: PORTAL, resultRows: 1 },
    ],
    dataSources: buildDataSources(toolCalls, trace, undefined, CREATED_AT),
    cost: { promptTokens: 16250, completionTokens: 116, totalTokens: 16366, model: MODEL },
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

interface ReportedKeysFixture {
  note: string[];
  serializedJson: string;
  contentHashSha256: string;
  envelopeHash: string;
}

function readFixture(): ReportedKeysFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ReportedKeysFixture;
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

function componentsOf(pkg: RecordPackage): Array<Record<string, unknown>> {
  const block = (pkg as unknown as { extensions: Record<string, Record<string, unknown>> }).extensions[COMPOSITION_EXTENSION_KEY];
  return block.components as Array<Record<string, unknown>>;
}

/** A root span carrying only `analysis.components`, set to `text`. */
function traceWithComponents(text: string): Record<string, unknown> {
  const tb = new TraceBuilder({ ...CIVICAITOOLS_TRACE_CONFIG, now: makeClock(), randomBytes: makeSeededBytes() });
  tb.startRoot('civic_analysis', {});
  tb.endRoot({ 'analysis.components': text });
  return tb.finalize() as unknown as Record<string, unknown>;
}

// --- A2.2: the golden, the keys' place, and the decoy -----------------------------------

test('reported-keys golden: the record reproduces the fixture byte for byte, and both hashes', () => {
  const fixture = readFixture();
  const { pkg, envelopeHash } = buildReportedKeysRecord();
  const serialized = JSON.stringify(pkg);
  assert.ok(serialized === fixture.serializedJson, 'the reported-keys record differs from reported-keys-golden.json');
  assert.equal(pkg.contentHash?.sha256, fixture.contentHashSha256);
  assert.equal(envelopeHash, fixture.envelopeHash);
  // The recorded hashes are the hashes of the recorded bytes, by produce-core's own chain.
  const stored = JSON.parse(fixture.serializedJson) as Record<string, unknown>;
  assert.equal(computeEnvelopeHash(stored), fixture.envelopeHash);
  assert.equal(computeContentHashSha256(stored, stored.contentCanonicalization as string), fixture.contentHashSha256);
});

test('reported-keys golden: the base server\'s entry states reportedName then reportedVersion after guidanceOrigin, as passed', () => {
  const components = componentsOf(buildReportedKeysRecord().pkg);
  assert.deepEqual(components.map((c) => c.id), [BASE_ID, SECOND_ID, PACK_ID, '@typedstandards/civic-typed-router']);
  const base = components[0]!;
  assert.deepEqual(Object.keys(base), ['id', 'guidanceHash', 'guidanceOrigin', 'reportedName', 'reportedVersion']);
  assert.equal(base.reportedName, BASE_REPORTED_NAME);
  assert.equal(base.reportedVersion, BASE_REPORTED_VERSION);
  // Honest absence: the server whose report was not read, the pack and the router state neither key.
  for (const entry of components.slice(1)) {
    assert.equal(Object.hasOwn(entry, 'reportedName'), false, String(entry.id));
    assert.equal(Object.hasOwn(entry, 'reportedVersion'), false, String(entry.id));
  }
});

test('reported-keys golden: the same trace without the two keys yields the key-less block byte for byte, and the block with them differs (decoy)', () => {
  const withKeys = blockOf(captureRun());
  const withoutKeys = blockOf(captureRun(withoutReportedKeys(COMPONENTS)));
  assert.ok(withKeys && withoutKeys);
  // The block built without the keys is the block built with them, less the keys: no other byte moved.
  const stripped = {
    ...withKeys,
    components: (withKeys.components as Array<Record<string, unknown>>).map(({ reportedName: _n, reportedVersion: _v, ...rest }) => rest),
  };
  assert.equal(JSON.stringify(withoutKeys), JSON.stringify(stripped));
  // The decoy: a release that dropped the keys silently could not pass this.
  assert.notEqual(JSON.stringify(withKeys), JSON.stringify(withoutKeys));
  // And the derivation's direct input agrees with the trace's.
  const direct = buildCompositionExtension({
    assertedDate: '2026-11-12',
    sourcesOffered: SOURCES_OFFERED,
    components: withoutReportedKeys(COMPONENTS),
  });
  assert.equal(JSON.stringify(withoutKeys), JSON.stringify(direct));
});

test('reported-keys: each key is stated without the other, as passed', () => {
  const onlyName = buildCompositionExtension({ components: [{ id: 'x', reportedName: 'x-server' }] });
  const onlyVersion = buildCompositionExtension({ components: [{ id: 'x', version: '1', reportedVersion: '2' }] });
  assert.equal(JSON.stringify(onlyName?.components), '[{"id":"x","reportedName":"x-server"}]');
  assert.equal(JSON.stringify(onlyVersion?.components), '[{"id":"x","version":"1","reportedVersion":"2"}]');
});

// --- A2.2's decoy: the refusals ----------------------------------------------------------

test('reported-keys: an empty or non-string reportedName or reportedVersion is refused with RecordFieldError(components)', () => {
  const values: unknown[] = ['', 0, 1, true, null, {}, ['x']];
  for (const key of ['reportedName', 'reportedVersion'] as const) {
    for (const value of values) {
      const components = [{ id: 'x', [key]: value }] as unknown as CompositionComponentInput[];
      const refused = (error: unknown) =>
        error instanceof RecordFieldError && error.field === 'components' && new RegExp(`entry 0 \\(x\\): ${key}, when given, is a non-empty string`).test(error.message);
      assert.throws(() => buildCompositionExtension({ components }), refused, `${key} = ${JSON.stringify(value)}`);
      // The composite derivation refuses it the same way.
      assert.throws(
        () => deriveDatHereEnvelopeFields({ model: MODEL, contentProfile: DATHERE_CONTENT_PROFILE, components }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
        refused,
        `${key} = ${JSON.stringify(value)} (derive)`,
      );
    }
  }
});

test('reported-keys: the extractor refuses an analysis.components entry whose reported key is not a string, with RunAttributeError, and passes a string through', () => {
  for (const key of ['reportedName', 'reportedVersion']) {
    for (const value of [1, true, null, {}]) {
      assert.throws(
        () => extractRunAttributes(traceWithComponents(JSON.stringify([{ id: 'x', [key]: value }]))),
        (error: unknown) => error instanceof RunAttributeError && error.attribute === 'analysis.components' && error.message.includes(`${key} is not a string`),
        `${key} = ${JSON.stringify(value)}`,
      );
    }
  }
  // The extractor checks the shape only: an empty string passes it, and the derivation refuses it.
  const extracted = extractRunAttributes(traceWithComponents(JSON.stringify([{ id: 'x', reportedName: '' }])));
  assert.equal(JSON.stringify(extracted.components), '[{"id":"x","reportedName":""}]');
  assert.throws(
    () => deriveDatHereEnvelopeFields({ model: MODEL, contentProfile: DATHERE_CONTENT_PROFILE, ...extracted }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
    (error: unknown) => error instanceof RecordFieldError && error.field === 'components',
  );
});

// --- The pack call the producer did not send ----------------------------------------------

test('reported-keys golden: the unsent pack call states civic:failed, civic:failureKind base_changed and civic:packId, and no dataSources entry', () => {
  const { pkg } = buildReportedKeysRecord();
  const nodes = ((pkg as unknown as Record<string, unknown>).provenance as { '@graph': Node[] })['@graph'];
  const failed = nodes.filter((n) => n[CIVIC_TERM_FAILED] === true);
  assert.equal(failed.length, 1, 'one activity states a failed call');
  const call = failed[0]!;
  assert.equal(call[CIVIC_TERM_FAILURE_KIND], 'base_changed');
  assert.equal(call[CIVIC_TERM_PACK_ID], PACK_ID);
  assert.equal(call['civic:serverId'], BASE_ID);
  assert.equal(call['civic:durationMs'], 1);
  const dataSources = (pkg as unknown as { dataSources: Array<Record<string, unknown>> }).dataSources;
  assert.deepEqual(dataSources.map((d) => d.datasetId), [NOISE_DATASET], 'only the answered call gave an entry');
});

// --- A2.6: the fixture convention --------------------------------------------------------

test('reported-keys golden: fixture convention — no bare run of thirteen or more digits', () => {
  assert.doesNotMatch(readFileSync(FIXTURE_PATH, 'utf8'), /\b\d{13,19}\b/);
  assert.doesNotMatch(JSON.stringify(buildReportedKeysRecord().pkg), /\b\d{13,19}\b/);
});
