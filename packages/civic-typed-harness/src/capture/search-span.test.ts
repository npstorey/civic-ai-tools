// The search span (ADR-0033 amendment 5; sprint anchor civic-ai-tools#318,
// S3-A P2, criteria A9 and A10, with the seat's rulings Q6, D1, D2 and ASK 1).
//
// A `find_source` call is a tool span like any other (`mcp_tool_call`), with
// `tool.operation_type: find_source`, its outcome in `tool.search_outcome`
// (`searched`, the instance ran the search; `limit-reached`, it stopped the
// call at its limit and ran none), the query in `tool.search_query`, and, on
// outcome `searched` only, the hits in `tool.search_hits` (JSON text of an
// array of distinct non-empty source ids, in rank order). The instance's own
// loop answers it and no source sees it, so it is read as a load span is: no
// source agent, no data-response entity, no `dataSources[]` entry, its
// position in the walk kept; its activity is associated with the platform
// agent, states no `civic:sourceId`, and states `civic:searchOutcome`,
// `civic:searchQuery` and, on `searched`, `civic:searchHits`, last. A search
// span carrying `error: true`, `mcp.source`, `mcp.server.id`, `mcp.alias`,
// `mcp.pack_id` or `tool.upstream_name` is refused: no source, server or
// pack took part in it.
//
// THE BASE (harness 0.13.0). None of the three attributes is read, and a
// `find_source` span is resolved to a source like any other tool span: its
// `mcp.source` tag, else the resolver over its tool name, else the fallback
// `unknown` (capture/provenance.ts:322-327; civic/provenance.ts:180). So an
// untagged search mints an agent `urn:civic-record:mcp-server:unknown` and
// its activity states `civic:sourceId: "unknown"`: a statement that a source
// answered a call no source saw. A search tagged with a registry source is
// credited to that source, and for an aggregate source it mints a
// `dataSources[]` entry. A call stopped at the limit is the same node as a
// search that ran: nothing tells them apart.
//
// The terms are read from the vocabulary module by name, so this file
// type-checks on a tree that does not declare them yet; a missing term fails
// an assertion, not the import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProvenanceGraph,
  CIVICAITOOLS_PROVENANCE_CONFIG,
  SearchSpanError,
} from '../civic/provenance.ts';
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
  packageId: 'pkg-search',
  promptHash: 'abc123',
  outputText: 'hello world',
  model: 'openai/gpt-4o',
};

const QUERY = 'street closure notices';
const HITS = ['notices', 'socrata', 'data-commons'];

/** The terms, read by name so a tree that does not declare them fails at an assertion. */
const vocabulary = vocabularyModule as Record<string, unknown>;
const SEARCH_OUTCOME_TERM = 'civic:searchOutcome';
const SEARCH_QUERY_TERM = 'civic:searchQuery';
const SEARCH_HITS_TERM = 'civic:searchHits';

/** A search span of outcome `searched`; `extra` adds or overrides
 *  attributes, and `omit` drops the named ones. */
function searchSpan(spanId: string, extra: Record<string, string> = {}, omit: string[] = []): SpanStub {
  const map: Record<string, string> = {
    'tool.name': 'find_source',
    'tool.operation_type': 'find_source',
    'tool.arguments': JSON.stringify({ query: QUERY }),
    'tool.search_outcome': 'searched',
    'tool.search_query': QUERY,
    'tool.search_hits': JSON.stringify(HITS),
    ...extra,
  };
  for (const key of omit) delete map[key];
  return {
    name: 'mcp_tool_call',
    spanId,
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '1050000000',
    attributes: attrs(map),
  };
}

/** A call the instance stopped at its limit: outcome `limit-reached`, a
 *  query, and no hits. */
function limitSpan(spanId: string, extra: Record<string, string> = {}): SpanStub {
  const span = searchSpan(spanId, { 'tool.search_outcome': 'limit-reached' }, ['tool.search_hits']);
  return { ...span, attributes: [...span.attributes.filter((a) => !(a.key in extra)), ...attrs(extra)] };
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
const NOW = '2026-11-13T00:00:00.000Z';
const SOCRATA_CALL = { name: 'get_data', args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' } };
const SEARCH_CALL = { name: 'find_source', args: { query: QUERY } };

// --- A9: read apart from a source's call -------------------------------------------------

test('A9 search span: the three terms and the two outcomes are declared', () => {
  assert.equal(vocabulary.CIVIC_TERM_SEARCH_OUTCOME, SEARCH_OUTCOME_TERM);
  assert.equal(vocabulary.CIVIC_TERM_SEARCH_QUERY, SEARCH_QUERY_TERM);
  assert.equal(vocabulary.CIVIC_TERM_SEARCH_HITS, SEARCH_HITS_TERM);
  assert.deepEqual(vocabulary.SEARCH_OUTCOMES, ['searched', 'limit-reached']);
});

test('A9 search span: an untagged search beside a Socrata call mints one server agent, socrata, and no unknown agent', () => {
  const nodes = nodesOf(traceOf([searchSpan('span-search'), socrataDataSpan('span-data')]));
  assert.deepEqual(mcpAgents(nodes), [`${CIVIC_URN_PREFIX}:mcp-server:socrata`]);
  assert.equal(JSON.stringify(nodes).includes('"civic:sourceId":"unknown"'), false, 'no node states the source unknown');
});

test('A9 search span: its activity is associated with the platform agent, states no civic:sourceId, and states the outcome, the query, then the hits, last', () => {
  const nodes = nodesOf(traceOf([searchSpan('span-search', { 'tool.duration_ms': '3' })]));
  const activity = activityForSpan(nodes, 'span-search');
  assert.deepEqual(Object.keys(activity), [
    '@id',
    '@type',
    'dcterms:description',
    'prov:used',
    'prov:wasAssociatedWith',
    'prov:startedAtTime',
    'prov:endedAtTime',
    'civic:durationMs',
    SEARCH_OUTCOME_TERM,
    SEARCH_QUERY_TERM,
    SEARCH_HITS_TERM,
  ]);
  assert.deepEqual(activity['prov:wasAssociatedWith'], { '@id': PLATFORM_URN });
  assert.equal(hasKey(activity, 'civic:sourceId'), false);
  assert.equal(activity[SEARCH_OUTCOME_TERM], 'searched');
  assert.equal(activity[SEARCH_QUERY_TERM], QUERY);
  assert.deepEqual(activity[SEARCH_HITS_TERM], HITS, 'the hits, in rank order');
  assert.deepEqual(mcpAgents(nodes), []);
  // The query entity is as for any tool span.
  const query = nodes.find((n) => n['@id'].includes(':query:'))!;
  assert.deepEqual(Object.keys(query), ['@id', '@type', 'civic:contentHash', 'civic:toolName', 'civic:operationType', 'dcterms:description']);
  assert.equal(query['civic:operationType'], 'find_source');
});

test('A9 search span: an empty hits list is a search that ran and returned none, stated as an empty list', () => {
  const nodes = nodesOf(traceOf([searchSpan('span-search', { 'tool.search_hits': '[]' })]));
  const activity = activityForSpan(nodes, 'span-search');
  assert.equal(activity[SEARCH_OUTCOME_TERM], 'searched');
  assert.deepEqual(activity[SEARCH_HITS_TERM], []);
  assert.equal(activity[SEARCH_QUERY_TERM], QUERY);
});

test('A9 search span (D1): a call stopped at the limit states limit-reached and its query, and no hits and no "searched" anywhere', () => {
  const nodes = nodesOf(traceOf([searchSpan('span-search'), limitSpan('span-stopped'), socrataDataSpan('span-data')]));
  const stopped = activityForSpan(nodes, 'span-stopped');
  assert.equal(stopped[SEARCH_OUTCOME_TERM], 'limit-reached');
  assert.equal(stopped[SEARCH_QUERY_TERM], QUERY);
  assert.equal(hasKey(stopped, SEARCH_HITS_TERM), false, 'no hits: no search ran');
  assert.deepEqual(Object.keys(stopped).slice(-2), [SEARCH_OUTCOME_TERM, SEARCH_QUERY_TERM]);
  assert.equal(JSON.stringify(stopped).includes('searched'), false, 'the stopped call is not said to have searched');
  assert.deepEqual(stopped['prov:wasAssociatedWith'], { '@id': PLATFORM_URN });
  assert.equal(hasKey(stopped, 'civic:sourceId'), false);
  // The one search that ran is the only activity stating searched or hits.
  const searched = nodes.filter((n) => n[SEARCH_OUTCOME_TERM] === 'searched').map((n) => n['@id']);
  assert.deepEqual(searched, [`${CIVIC_URN_PREFIX}:${BASE_INPUT.packageId}:tool-call:span-search`]);
  assert.equal(nodes.filter((n) => hasKey(n, SEARCH_HITS_TERM)).length, 1);
  assert.deepEqual(mcpAgents(nodes), [`${CIVIC_URN_PREFIX}:mcp-server:socrata`]);
});

test('A9 search span: no data-response entity, even when the span carries tool.response_hash', () => {
  const nodes = nodesOf(traceOf([searchSpan('span-search', { 'tool.response_hash': 'a0c0e0' })]));
  assert.equal(nodes.some((n) => n['@id'].includes(':data:')), false);
  assert.equal(JSON.stringify(nodes).includes('prov:wasDerivedFrom'), false);
});

test('A9 search span: a search tagged with an aggregate source mints no dataSources entry', () => {
  // The dataSources walk does not check a search span (as it does not check a
  // load's outcome); the graph refuses the tag (A10, D2).
  const entries = buildDataSources(
    [SEARCH_CALL, SOCRATA_CALL],
    traceOf([searchSpan('span-search', { 'mcp.source': 'data-commons' }), socrataDataSpan('span-data')]),
    undefined,
    NOW,
  );
  assert.deepEqual(entries.map((e) => `${e.sourceId}/${e.datasetId ?? ''}`), ['socrata/erm2-nwe9']);
});

test('A9 search span: a search between two data calls is skipped in place — the call after it still pairs with its own span (decoy)', () => {
  // The search span names an aggregate source, so a search read as a data
  // call would mark that source accessed. The third call's tool name resolves
  // to nothing, so its source comes from its own span alone: a walk that
  // dropped the search call would pair it with the search span instead.
  const entries = buildDataSources(
    [SOCRATA_CALL, SEARCH_CALL, { name: 'boston__search_datasets', args: { query: 'permits' } }],
    traceOf([
      socrataDataSpan('span-data'),
      searchSpan('span-search', { 'mcp.source': 'data-commons' }),
      { name: 'mcp_tool_call', attributes: attrs({ 'mcp.source': 'boston-opencontext', 'tool.name': 'boston__search_datasets' }) },
    ]),
    undefined,
    NOW,
  );
  assert.deepEqual(
    entries.map((e) => `${e.sourceId}/${e.datasetId ?? ''}`),
    ['socrata/erm2-nwe9', 'boston-opencontext/'],
    'no entry for the search, and the call after it keeps its own span',
  );
});

// --- A10: a search span that does not say what happened, or says what did not, is refused --

function refusedWith(spanId: string, attribute: string) {
  return (e: unknown) =>
    e instanceof SearchSpanError
    && e.spanId === spanId
    && e.attribute === attribute
    && e.name === 'SearchSpanError';
}

function assertRefused(span: SpanStub, attribute: string, label: string): void {
  assert.throws(
    () => buildProvenanceGraph(traceOf([socrataDataSpan('span-data'), span]), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG),
    refusedWith(span.spanId!, attribute),
    `${label} was not refused`,
  );
}

test('A10 search span: SearchSpanError is exported from the package entry', () => {
  assert.equal((harnessEntry as Record<string, unknown>).SearchSpanError, SearchSpanError);
});

test('A10 search span (D1): an outcome that is absent, or not searched or limit-reached, is refused', () => {
  assertRefused(searchSpan('span-search', {}, ['tool.search_outcome']), 'tool.search_outcome', 'outcome absent');
  for (const outcome of ['', 'Searched', 'limit_reached', 'found', 'failed', 'not-offered']) {
    assertRefused(searchSpan('span-search', { 'tool.search_outcome': outcome }), 'tool.search_outcome', `outcome ${JSON.stringify(outcome)}`);
  }
  assertRefused(withValue(searchSpan('span-search'), 'tool.search_outcome', { intValue: '1' }), 'tool.search_outcome', 'outcome an intValue');
  assertRefused(withValue(searchSpan('span-search'), 'tool.search_outcome', { boolValue: true }), 'tool.search_outcome', 'outcome a boolValue');
});

test('A10 search span: on outcome searched, hits that are absent, or not JSON text of an array of strings, are refused', () => {
  const cases: Array<[string, SpanStub]> = [
    ['absent', searchSpan('span-search', {}, ['tool.search_hits'])],
    ['not JSON', searchSpan('span-search', { 'tool.search_hits': 'notices, socrata' })],
    ['a JSON object', searchSpan('span-search', { 'tool.search_hits': '{"0":"notices"}' })],
    ['a JSON string', searchSpan('span-search', { 'tool.search_hits': '"notices"' })],
    ['a JSON number', searchSpan('span-search', { 'tool.search_hits': '3' })],
    ['JSON null', searchSpan('span-search', { 'tool.search_hits': 'null' })],
    ['an array with a number', searchSpan('span-search', { 'tool.search_hits': '["notices",2]' })],
    ['an array with null', searchSpan('span-search', { 'tool.search_hits': '["notices",null]' })],
    ['an array with an object', searchSpan('span-search', { 'tool.search_hits': '[{"sourceId":"notices"}]' })],
    ['an array with an array', searchSpan('span-search', { 'tool.search_hits': '[["notices"]]' })],
    ['an intValue', withValue(searchSpan('span-search'), 'tool.search_hits', { intValue: '3' })],
    ['a boolValue', withValue(searchSpan('span-search'), 'tool.search_hits', { boolValue: true })],
  ];
  for (const [label, span] of cases) assertRefused(span, 'tool.search_hits', `hits ${label}`);
});

test('A10 search span (Q6): a hit that is the empty string, or an id named twice, is refused', () => {
  for (const hits of [[''], ['notices', ''], ['notices', 'socrata', 'notices'], ['socrata', 'socrata']]) {
    assertRefused(searchSpan('span-search', { 'tool.search_hits': JSON.stringify(hits) }), 'tool.search_hits', `hits ${JSON.stringify(hits)}`);
  }
});

test('A10 search span (D1): on outcome limit-reached, any hits are refused, [] included — no search ran', () => {
  for (const hits of ['[]', '["notices"]', 'not json']) {
    assertRefused(limitSpan('span-stopped', { 'tool.search_hits': hits }), 'tool.search_hits', `limit-reached with hits ${hits}`);
  }
});

test('A10 search span: a query that is absent or not a string is refused, on either outcome', () => {
  for (const [label, make] of [
    ['searched', (extra: Record<string, string>, omit: string[]) => searchSpan('span-search', extra, omit)],
    ['limit-reached', (extra: Record<string, string>, omit: string[]) => searchSpan('span-search', { 'tool.search_outcome': 'limit-reached', ...extra }, ['tool.search_hits', ...omit])],
  ] as const) {
    assertRefused(make({}, ['tool.search_query']), 'tool.search_query', `${label}: query absent`);
    assertRefused(withValue(make({}, []), 'tool.search_query', { intValue: '7' }), 'tool.search_query', `${label}: query an intValue`);
    assertRefused(withValue(make({}, []), 'tool.search_query', { boolValue: false }), 'tool.search_query', `${label}: query a boolValue`);
    assertRefused(withValue(make({}, []), 'tool.search_query', {}), 'tool.search_query', `${label}: query with no value`);
  }
});

test('A10 search span (D2, ASK 1): error: true, mcp.source, mcp.server.id, mcp.alias, mcp.pack_id and tool.upstream_name are each refused, on either outcome', () => {
  for (const make of [(id: string) => searchSpan(id), (id: string) => limitSpan(id)]) {
    assertRefused(withValue(make('span-search'), 'error', { boolValue: true }), 'error', 'error: true');
    for (const key of ['mcp.source', 'mcp.server.id', 'mcp.alias', 'mcp.pack_id', 'tool.upstream_name']) {
      const span = make('span-search');
      span.attributes.push({ key, value: { stringValue: key === 'tool.upstream_name' ? 'find_source' : 'socrata' } });
      assertRefused(span, key, key);
    }
  }
});

test('A10 search span: error: false is not a failure and is not refused; the activity states no civic:failed (decoy)', () => {
  const nodes = nodesOf(traceOf([withValue(searchSpan('span-search'), 'error', { boolValue: false })]));
  const activity = activityForSpan(nodes, 'span-search');
  assert.equal(hasKey(activity, 'civic:failed'), false);
  assert.equal(activity[SEARCH_OUTCOME_TERM], 'searched');
});

test('A10 search span: an empty hits list and an empty query are not refused (decoy for the refusals)', () => {
  const extras: Array<Record<string, string>> = [{ 'tool.search_hits': '[]' }, { 'tool.search_query': '' }];
  for (const extra of extras) {
    const nodes = nodesOf(traceOf([searchSpan('span-search', extra)]));
    const activity = activityForSpan(nodes, 'span-search');
    assert.ok(hasKey(activity, SEARCH_HITS_TERM), `${JSON.stringify(extra)}: the hits are stated`);
    assert.ok(hasKey(activity, SEARCH_QUERY_TERM), `${JSON.stringify(extra)}: the query is stated`);
  }
  const stopped = activityForSpan(nodesOf(traceOf([limitSpan('span-stopped', { 'tool.search_query': '' })])), 'span-stopped');
  assert.equal(stopped[SEARCH_QUERY_TERM], '');
  assert.equal(stopped[SEARCH_OUTCOME_TERM], 'limit-reached');
});

test('A10 search span: a span of another operation type carrying the search attributes is not read as a search', () => {
  const span = searchSpan('span-other', { 'tool.operation_type': 'search', 'mcp.source': 'socrata', 'tool.search_hits': 'not json', 'tool.search_outcome': 'other' });
  const nodes = nodesOf(traceOf([span]));
  const activity = activityForSpan(nodes, 'span-other');
  assert.equal(activity['civic:sourceId'], 'socrata');
  for (const term of [SEARCH_OUTCOME_TERM, SEARCH_HITS_TERM, SEARCH_QUERY_TERM]) assert.equal(hasKey(activity, term), false, term);
});
