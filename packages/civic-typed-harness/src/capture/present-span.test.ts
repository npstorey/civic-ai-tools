// The present span (ADR-0033 amendment 6; sprint anchor
// civic-ai-tools-website#810, OF-1 phase OF1, criteria 2 and 3, with the
// seat's rulings S3, S6 = A and S7).
//
// A `present_result` call is the site's own step in a run asked in an output
// format: the model names which result of the run to present, and which of
// its columns labels each row, and the site answers the call itself. It is a
// tool span like any other (`mcp_tool_call`), with
// `tool.operation_type: present_result` and one outcome attribute,
// `tool.present_outcome` (`accepted`, the site took the result and the label
// the call named; `refused`, a value the call named was not one the site
// could check against the run's results). The call's arguments,
// `{ result, label }`, are in `tool.arguments`, as every call's are. No
// source sees the call, so it is read as a load span and a search span are
// read: no source agent, no data-response entity, no `dataSources[]` entry,
// its position in the walk kept; its activity is associated with the
// platform agent, states no `civic:sourceId`, and states
// `civic:presentOutcome`, last. A present span with no outcome, an outcome
// outside the two, or carrying `error: true`, `mcp.source`, `mcp.server.id`,
// `mcp.alias`, `mcp.pack_id` or `tool.upstream_name` is refused before any
// node is built: no source, server or pack took part in it.
//
// THE BASE (harness 0.15.0, hub 9ab745ac). No attribute of the step is read,
// and a `present_result` span is resolved to a source like any other tool
// span: its `mcp.source` tag, else the resolver over its tool name, else the
// fallback `unknown` (capture/provenance.ts:338-345, :380). So an untagged
// step mints the agent `urn:civic-record:mcp-server:unknown` and its activity
// states `civic:sourceId: "unknown"`: a statement, in signed bytes, that a
// data source answered the site's own step. A step tagged with an aggregate
// source mints that source's `dataSources[]` entry.
//
// THE SHAPE THAT CAN FAIL. An untagged step mints no `dataSources[]` entry at
// the base either (the resolver knows no `present_result`, and `unknown` is
// in no registry), so a dataSources assertion over an untagged step could
// only ever pass. The dataSources tests below drive a step tagged with an
// aggregate source, which the base credits with an entry; the graph refuses
// that tag, and the dataSources walk skips the step without reading it, as
// it skips a search span. Each read-apart assertion has a decoy: the same
// span with `tool.operation_type` `get_data` does mint the agent or the entry.
//
// The names the fix adds are read from the modules by name, so this file
// type-checks on a tree that does not declare them; a missing name fails an
// assertion, not the import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenanceGraph, CIVICAITOOLS_PROVENANCE_CONFIG } from '../civic/provenance.ts';
import { CIVIC_URN_PREFIX } from '../format/vocabulary.ts';
import { buildDataSources } from '../civic/data-sources.ts';
import * as harnessEntry from '../index.ts';
import * as vocabularyModule from '../format/vocabulary.ts';

interface SpanStub {
  name: string;
  spanId?: string;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; boolValue?: boolean } }>;
}

type GraphNode = { '@id': string; [k: string]: unknown };

function traceOf(spans: SpanStub[]): Record<string, unknown> {
  return { resourceSpans: [{ scopeSpans: [{ spans }] }] };
}

function attrs(map: Record<string, string>): SpanStub['attributes'] {
  return Object.entries(map).map(([key, stringValue]) => ({ key, value: { stringValue } }));
}

// Fixture convention: synthetic timestamps stay under 13 digits.
const BASE_INPUT = {
  packageId: 'pkg-present',
  promptHash: 'abc123',
  outputText: 'hello world',
  model: 'openai/gpt-4o',
};

/** The step's arguments (S7): identifiers only, the index of a call in the run and one of its result's columns. */
const PRESENT_ARGUMENTS = { result: 2, label: 'street_name' };

const vocabulary = vocabularyModule as Record<string, unknown>;
const entry = harnessEntry as Record<string, unknown>;
const PRESENT_OUTCOME_TERM = 'civic:presentOutcome';

/** A present span of outcome `accepted`; `extra` adds or overrides
 *  attributes, and `omit` drops the named ones. */
function presentSpan(spanId: string, extra: Record<string, string> = {}, omit: string[] = []): SpanStub {
  const map: Record<string, string> = {
    'tool.name': 'present_result',
    'tool.operation_type': 'present_result',
    'tool.arguments': JSON.stringify(PRESENT_ARGUMENTS),
    'tool.present_outcome': 'accepted',
    ...extra,
  };
  for (const key of omit) delete map[key];
  return {
    name: 'mcp_tool_call',
    spanId,
    startTimeUnixNano: '1400000000',
    endTimeUnixNano: '1410000000',
    attributes: attrs(map),
  };
}

/** A span with one attribute written in another OTel value shape. */
function withValue(span: SpanStub, key: string, value: SpanStub['attributes'][number]['value']): SpanStub {
  return { ...span, attributes: [...span.attributes.filter((a) => a.key !== key), { key, value }] };
}

function socrataDataSpan(spanId: string): SpanStub {
  return {
    name: 'mcp_tool_call',
    spanId,
    startTimeUnixNano: '1200000000',
    endTimeUnixNano: '1300000000',
    attributes: attrs({
      'mcp.source': 'socrata',
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': '{"type":"query","portal":"data.cityofnewyork.us","dataset_id":"erm2-nwe9"}',
      'tool.dataset_id': 'erm2-nwe9',
      'tool.portal_domain': 'data.cityofnewyork.us',
      'tool.response_hash': 'a0b1c2',
    }),
  };
}

function mcpAgents(nodes: GraphNode[]): string[] {
  return nodes.filter((n) => n['@id'].startsWith(`${CIVIC_URN_PREFIX}:mcp-server:`)).map((n) => n['@id']);
}

function activityForSpan(nodes: GraphNode[], spanId: string): GraphNode {
  const urn = `${CIVIC_URN_PREFIX}:${BASE_INPUT.packageId}:tool-call:${spanId}`;
  const node = nodes.find((n) => n['@id'] === urn);
  assert.ok(node, `${urn}: the tool-call activity must be on the graph`);
  return node!;
}

function hasKey(node: GraphNode, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(node, key);
}

function nodesOf(trace: Record<string, unknown>): GraphNode[] {
  return buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG)['@graph'] as GraphNode[];
}

const PLATFORM_URN = `${CIVIC_URN_PREFIX}:platform:${CIVICAITOOLS_PROVENANCE_CONFIG.platformAgent.id}`;
const NOW = '2026-11-24T00:00:00.000Z';
const SOCRATA_CALL = { name: 'get_data', args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' } };
const PRESENT_CALL = { name: 'present_result', args: { ...PRESENT_ARGUMENTS } };

// --- Criterion 2: read apart from a source's call ----------------------------------------

test('OF1-2 present span: the term and the two outcomes are declared', () => {
  assert.equal(vocabulary.CIVIC_TERM_PRESENT_OUTCOME, PRESENT_OUTCOME_TERM);
  assert.deepEqual(vocabulary.PRESENT_OUTCOMES, ['accepted', 'refused']);
});

test('OF1-2 present span: an untagged step beside a Socrata call mints one server agent, socrata, and no unknown agent', () => {
  const nodes = nodesOf(traceOf([socrataDataSpan('span-data'), presentSpan('span-present')]));
  assert.deepEqual(mcpAgents(nodes), [`${CIVIC_URN_PREFIX}:mcp-server:socrata`]);
  assert.equal(JSON.stringify(nodes).includes('"civic:sourceId":"unknown"'), false, 'no node states the source unknown');
});

test('OF1-2 present span (decoy): the same span with tool.operation_type get_data mints the unknown agent', () => {
  const nodes = nodesOf(traceOf([socrataDataSpan('span-data'), presentSpan('span-present', { 'tool.operation_type': 'get_data' })]));
  assert.deepEqual(mcpAgents(nodes), [
    `${CIVIC_URN_PREFIX}:mcp-server:socrata`,
    `${CIVIC_URN_PREFIX}:mcp-server:unknown`,
  ]);
  assert.equal(activityForSpan(nodes, 'span-present')['civic:sourceId'], 'unknown');
});

test('OF1-2 present span: its activity is associated with the platform agent, states no civic:sourceId, and states the outcome, last', () => {
  for (const outcome of ['accepted', 'refused']) {
    const nodes = nodesOf(traceOf([presentSpan('span-present', { 'tool.present_outcome': outcome, 'tool.duration_ms': '2' })]));
    const activity = activityForSpan(nodes, 'span-present');
    assert.deepEqual(Object.keys(activity), [
      '@id',
      '@type',
      'dcterms:description',
      'prov:used',
      'prov:wasAssociatedWith',
      'prov:startedAtTime',
      'prov:endedAtTime',
      'civic:durationMs',
      PRESENT_OUTCOME_TERM,
    ], outcome);
    assert.deepEqual(activity['prov:wasAssociatedWith'], { '@id': PLATFORM_URN }, outcome);
    assert.equal(hasKey(activity, 'civic:sourceId'), false, outcome);
    assert.equal(activity[PRESENT_OUTCOME_TERM], outcome);
    assert.equal(activity['dcterms:description'], 'MCP tool call: present_result (present_result)');
    assert.deepEqual(mcpAgents(nodes), [], outcome);
    // The query entity is as for any tool span: it hashes the arguments and names the tool.
    const query = nodes.find((n) => n['@id'].includes(':query:'))!;
    assert.deepEqual(Object.keys(query), ['@id', '@type', 'civic:contentHash', 'civic:toolName', 'civic:operationType', 'dcterms:description']);
    assert.equal(query['civic:operationType'], 'present_result');
  }
});

test('OF1-2 present span: no data-response entity, even when the span carries tool.response_hash', () => {
  const nodes = nodesOf(traceOf([presentSpan('span-present', { 'tool.response_hash': 'a0c0e0', 'tool.response_rows': '12' })]));
  assert.equal(nodes.some((n) => n['@id'].includes(':data:')), false);
  assert.equal(JSON.stringify(nodes).includes('prov:wasDerivedFrom'), false);
  assert.equal(JSON.stringify(nodes).includes('civic:responseRows'), false);
});

test('OF1-2 present span: a step tagged with an aggregate source mints no dataSources entry', () => {
  // The dataSources walk does not check a present span (as it does not check a
  // search span); the graph refuses the tag (criterion 3).
  const entries = buildDataSources(
    [SOCRATA_CALL, PRESENT_CALL],
    traceOf([socrataDataSpan('span-data'), presentSpan('span-present', { 'mcp.source': 'data-commons' })]),
    undefined,
    NOW,
  );
  assert.deepEqual(entries.map((e) => `${e.sourceId}/${e.datasetId ?? ''}`), ['socrata/erm2-nwe9']);
});

test('OF1-2 present span (decoy): the same tagged span with tool.operation_type get_data mints the aggregate source\'s entry', () => {
  const entries = buildDataSources(
    [SOCRATA_CALL, PRESENT_CALL],
    traceOf([socrataDataSpan('span-data'), presentSpan('span-present', { 'mcp.source': 'data-commons', 'tool.operation_type': 'get_data' })]),
    undefined,
    NOW,
  );
  assert.deepEqual(entries.map((e) => `${e.sourceId}/${e.datasetId ?? ''}`), ['socrata/erm2-nwe9', 'data-commons/']);
});

test('OF1-2 present span: a step between two data calls is skipped in place — the call after it still pairs with its own span (decoy)', () => {
  // The present span names an aggregate source, so a step read as a data call
  // would mark that source accessed. The third call's tool name resolves to
  // nothing, so its source comes from its own span alone: a walk that dropped
  // the step would pair it with the present span instead.
  const entries = buildDataSources(
    [SOCRATA_CALL, PRESENT_CALL, { name: 'boston__search_datasets', args: { query: 'permits' } }],
    traceOf([
      socrataDataSpan('span-data'),
      presentSpan('span-present', { 'mcp.source': 'data-commons' }),
      { name: 'mcp_tool_call', attributes: attrs({ 'mcp.source': 'boston-opencontext', 'tool.name': 'boston__search_datasets' }) },
    ]),
    undefined,
    NOW,
  );
  assert.deepEqual(
    entries.map((e) => `${e.sourceId}/${e.datasetId ?? ''}`),
    ['socrata/erm2-nwe9', 'boston-opencontext/'],
    'no entry for the step, and the call after it keeps its own span',
  );
});

test('OF1-2 present span: a load, a search and a step in one run mint no agent among them, and keep their own outcomes', () => {
  const load: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-load',
    startTimeUnixNano: '1100000000',
    endTimeUnixNano: '1110000000',
    attributes: attrs({ 'tool.name': 'load_source', 'tool.operation_type': 'load_source', 'tool.arguments': '{"alias":"socrata"}', 'tool.load_outcome': 'loaded' }),
  };
  const search: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-search',
    startTimeUnixNano: '1050000000',
    endTimeUnixNano: '1060000000',
    attributes: attrs({
      'tool.name': 'find_source',
      'tool.operation_type': 'find_source',
      'tool.arguments': '{"query":"street trees"}',
      'tool.search_outcome': 'searched',
      'tool.search_query': 'street trees',
      'tool.search_hits': '["socrata"]',
    }),
  };
  const nodes = nodesOf(traceOf([search, load, socrataDataSpan('span-data'), presentSpan('span-present')]));
  assert.deepEqual(mcpAgents(nodes), [`${CIVIC_URN_PREFIX}:mcp-server:socrata`]);
  assert.equal(activityForSpan(nodes, 'span-load')['civic:loadOutcome'], 'loaded');
  assert.equal(activityForSpan(nodes, 'span-search')['civic:searchOutcome'], 'searched');
  assert.equal(activityForSpan(nodes, 'span-present')[PRESENT_OUTCOME_TERM], 'accepted');
  for (const id of ['span-load', 'span-search', 'span-present']) {
    assert.deepEqual(activityForSpan(nodes, id)['prov:wasAssociatedWith'], { '@id': PLATFORM_URN }, id);
  }
  // The step's term is on its own activity alone.
  assert.equal(nodes.filter((n) => hasKey(n, PRESENT_OUTCOME_TERM)).length, 1);
});

// --- Criterion 3: a step that does not say how it ended, or names a participant, is refused --

function refusedWith(spanId: string, attribute: string) {
  return (e: unknown) => {
    const err = e as { name?: unknown; spanId?: unknown; attribute?: unknown };
    return e instanceof Error
      && err.name === 'PresentSpanError'
      && err.spanId === spanId
      && err.attribute === attribute
      && (typeof entry.PresentSpanError !== 'function' || e instanceof (entry.PresentSpanError as new (...a: never[]) => Error));
  };
}

function assertRefused(span: SpanStub, attribute: string, label: string): void {
  assert.throws(
    () => buildProvenanceGraph(traceOf([socrataDataSpan('span-data'), span]), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG),
    refusedWith(span.spanId!, attribute),
    `${label} was not refused`,
  );
}

test('OF1-3 present span: PresentSpanError is exported from the package entry', () => {
  assert.equal(typeof entry.PresentSpanError, 'function');
  assert.equal((entry.PresentSpanError as { name?: string }).name, 'PresentSpanError');
});

test('OF1-3 present span: an outcome that is absent, or not accepted or refused, is refused', () => {
  assertRefused(presentSpan('span-present', {}, ['tool.present_outcome']), 'tool.present_outcome', 'outcome absent');
  for (const outcome of ['', 'Accepted', 'presented', 'drawn', 'loaded', 'searched', 'declined', 'not-offered']) {
    assertRefused(presentSpan('span-present', { 'tool.present_outcome': outcome }), 'tool.present_outcome', `outcome ${JSON.stringify(outcome)}`);
  }
  assertRefused(withValue(presentSpan('span-present'), 'tool.present_outcome', { intValue: '1' }), 'tool.present_outcome', 'outcome an intValue');
  assertRefused(withValue(presentSpan('span-present'), 'tool.present_outcome', { boolValue: true }), 'tool.present_outcome', 'outcome a boolValue');
  assertRefused(withValue(presentSpan('span-present'), 'tool.present_outcome', {}), 'tool.present_outcome', 'outcome with no value');
});

test('OF1-3 present span: error: true, mcp.source, mcp.server.id, mcp.alias, mcp.pack_id and tool.upstream_name are each refused, on either outcome', () => {
  for (const outcome of ['accepted', 'refused']) {
    assertRefused(withValue(presentSpan('span-present', { 'tool.present_outcome': outcome }), 'error', { boolValue: true }), 'error', `${outcome}: error: true`);
    for (const key of ['mcp.source', 'mcp.server.id', 'mcp.alias', 'mcp.pack_id', 'tool.upstream_name']) {
      const span = presentSpan('span-present', { 'tool.present_outcome': outcome });
      span.attributes.push({ key, value: { stringValue: key === 'tool.upstream_name' ? 'present_result' : 'socrata' } });
      assertRefused(span, key, `${outcome}: ${key}`);
    }
  }
});

test('OF1-3 present span: refused before any node is built — a graph is never returned for the trace', () => {
  let built: unknown;
  assert.throws(() => {
    built = buildProvenanceGraph(
      traceOf([presentSpan('span-present', {}, ['tool.present_outcome']), socrataDataSpan('span-data')]),
      BASE_INPUT,
      CIVICAITOOLS_PROVENANCE_CONFIG,
    );
  }, refusedWith('span-present', 'tool.present_outcome'));
  assert.equal(built, undefined);
});

test('OF1-3 present span: error: false is not a failure and is not refused; the activity states no civic:failed (decoy)', () => {
  const nodes = nodesOf(traceOf([withValue(presentSpan('span-present'), 'error', { boolValue: false })]));
  const activity = activityForSpan(nodes, 'span-present');
  assert.equal(hasKey(activity, 'civic:failed'), false);
  assert.equal(activity[PRESENT_OUTCOME_TERM], 'accepted');
});

test('OF1-3 present span: a span of another operation type carrying tool.present_outcome is not read as a step (decoy)', () => {
  const span = presentSpan('span-other', { 'tool.operation_type': 'query', 'mcp.source': 'socrata', 'tool.present_outcome': 'other' });
  const nodes = nodesOf(traceOf([span]));
  const activity = activityForSpan(nodes, 'span-other');
  assert.equal(activity['civic:sourceId'], 'socrata');
  assert.equal(hasKey(activity, PRESENT_OUTCOME_TERM), false);
});
