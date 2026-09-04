// Data-source population tests: golden parity against the reference
// implementation's output, the reference behaviors ported from the app's
// test suite (dedupe, aggregate entries, fallbacks), and the harness
// additions — caller-supplied resolver + registry injection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildDataSources,
  resolveToolSource,
  type ToolCallSummary,
} from './data-sources.ts';
import type { CivicSourceRegistry } from '../format/sources.ts';

const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'website-golden.json'),
    'utf8',
  ),
);

interface SpanStub {
  name: string;
  attributes: Array<{ key: string; value: { stringValue?: string } }>;
}

function traceWithToolSpans(spans: SpanStub[]): Record<string, unknown> {
  return {
    resourceSpans: [
      {
        scopeSpans: [{ spans }],
      },
    ],
  };
}

function toolSpan(source: string, attrs: Record<string, string> = {}): SpanStub {
  const allAttrs: Record<string, string> = { 'mcp.source': source, ...attrs };
  return {
    name: 'mcp_tool_call',
    attributes: Object.entries(allAttrs).map(([key, stringValue]) => ({
      key,
      value: { stringValue },
    })),
  };
}

const NOW = '2026-04-16T00:00:00.000Z';

// --- Byte parity against the reference implementation ---

test('golden parity: multi-source tool calls reproduce the reference dataSources byte-for-byte', () => {
  const entries = buildDataSources(
    FIXTURE.toolCalls,
    FIXTURE.trace,
    'data.cityofnewyork.us',
    FIXTURE.dataSourcesNow,
  );
  assert.equal(JSON.stringify(entries), JSON.stringify(FIXTURE.dataSources));
});

// --- Ported reference tests ---

test('Socrata-only: one entry per unique dataset_id, tagged sourceId=socrata', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    },
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    }, // duplicate dataset — should be deduped
    {
      name: 'get_data',
      args: { type: 'metadata', portal: 'data.cityofnewyork.us', dataset_id: '43nn-pn8j' },
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('socrata', { 'tool.dataset_id': 'erm2-nwe9', 'tool.portal_domain': 'data.cityofnewyork.us' }),
    toolSpan('socrata', { 'tool.dataset_id': 'erm2-nwe9', 'tool.portal_domain': 'data.cityofnewyork.us' }),
    toolSpan('socrata', { 'tool.dataset_id': '43nn-pn8j', 'tool.portal_domain': 'data.cityofnewyork.us' }),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 2);
  const first = entries[0];
  assert.equal(first.sourceId, 'socrata');
  assert.equal(first.catalogType, 'socrata');
  assert.equal(first.portalUrl, 'https://data.cityofnewyork.us');
  assert.equal(first.datasetId, 'erm2-nwe9');
  assert.equal(first.datasetUrl, 'https://data.cityofnewyork.us/d/erm2-nwe9');
  assert.equal(first.accessTimestamp, NOW);
  for (const entry of entries) {
    assert.ok(entry.sourceId, `entry is missing sourceId: ${JSON.stringify(entry)}`);
  }
});

test('Data Commons only: emits a single aggregate entry tagged sourceId=data-commons', () => {
  const toolCalls: ToolCallSummary[] = [
    { name: 'search_indicators', args: { query: 'median household income' } },
    {
      name: 'get_observations',
      args: { variable_dcid: 'Median_Income_Household', place_dcid: 'geoId/36061' },
    },
  ];
  const trace = traceWithToolSpans([toolSpan('data-commons'), toolSpan('data-commons')]);

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.sourceId, 'data-commons');
  assert.equal(entry.catalogType, 'data-commons');
  assert.equal(entry.portalUrl, 'https://api.datacommons.org/mcp');
  // No per-dataset identifier for DC — the knowledge graph isn't dataset-keyed.
  assert.equal(entry.datasetId, undefined);
  assert.equal(entry.datasetUrl, undefined);
});

test('Multi-source: Socrata + Data Commons in one analysis produce distinct entries', () => {
  const toolCalls: ToolCallSummary[] = [
    { name: 'search_indicators', args: { query: 'median household income' } },
    {
      name: 'get_observations',
      args: { variable_dcid: 'Median_Income_Household', place_dcid: 'geoId/36061' },
    },
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('data-commons'),
    toolSpan('data-commons'),
    toolSpan('socrata', { 'tool.dataset_id': 'erm2-nwe9', 'tool.portal_domain': 'data.cityofnewyork.us' }),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 2);
  const socrataEntry = entries.find((s) => s.sourceId === 'socrata');
  const dcEntry = entries.find((s) => s.sourceId === 'data-commons');
  assert.ok(socrataEntry, 'missing socrata dataSource entry');
  assert.ok(dcEntry, 'missing data-commons dataSource entry');
  assert.equal(socrataEntry!.datasetId, 'erm2-nwe9');
  assert.equal(dcEntry!.portalUrl, 'https://api.datacommons.org/mcp');
});

test('Empty trace falls back to tool-name source mapping (Socrata)', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    },
  ];
  const trace = { resourceSpans: [] };

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceId, 'socrata');
  assert.equal(entries[0].datasetId, 'erm2-nwe9');
});

test('Empty trace falls back to tool-name mapping (Data Commons)', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_observations',
      args: { variable_dcid: 'Count_Person', place_dcid: 'country/USA' },
    },
  ];
  const trace = { resourceSpans: [] };

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceId, 'data-commons');
});

test('Boston OpenContext only: emits a single aggregate entry with catalogType=ckan', () => {
  const toolCalls: ToolCallSummary[] = [
    { name: 'ckan__search_datasets', args: { query: '311 pothole requests' } },
    {
      name: 'ckan__aggregate_data',
      args: {
        resource_id: '8048697b-ad64-4bfc-b090-ee00169f2323',
        group_by: ['neighborhood'],
        metrics: { count: 'count(*)' },
      },
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('boston-opencontext'),
    toolSpan('boston-opencontext'),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.sourceId, 'boston-opencontext');
  assert.equal(entry.catalogType, 'ckan');
  assert.equal(entry.portalUrl, 'https://data.boston.gov');
  assert.equal(entry.datasetId, undefined);
  assert.equal(entry.datasetUrl, undefined);
  assert.equal(entry.accessTimestamp, NOW);
});

test('Three-source analysis produces three distinct entries', () => {
  const toolCalls: ToolCallSummary[] = [
    { name: 'search_indicators', args: { query: 'population' } },
    {
      name: 'get_observations',
      args: { variable_dcid: 'Count_Person', place_dcid: 'geoId/25025' },
    },
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    },
    {
      name: 'ckan__aggregate_data',
      args: { resource_id: 'boston-311-uuid', group_by: ['neighborhood'], metrics: { count: 'count(*)' } },
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('data-commons'),
    toolSpan('data-commons'),
    toolSpan('socrata', { 'tool.dataset_id': 'erm2-nwe9', 'tool.portal_domain': 'data.cityofnewyork.us' }),
    toolSpan('boston-opencontext'),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 3);
  const socrata = entries.find((s) => s.sourceId === 'socrata');
  const dc = entries.find((s) => s.sourceId === 'data-commons');
  const boston = entries.find((s) => s.sourceId === 'boston-opencontext');
  assert.ok(socrata, 'missing socrata dataSource entry');
  assert.ok(dc, 'missing data-commons dataSource entry');
  assert.ok(boston, 'missing boston-opencontext dataSource entry');
  assert.equal(socrata!.datasetId, 'erm2-nwe9');
  assert.equal(dc!.portalUrl, 'https://api.datacommons.org/mcp');
  assert.equal(boston!.catalogType, 'ckan');
  assert.equal(boston!.portalUrl, 'https://data.boston.gov');
});

test('Empty trace falls back to tool-name mapping (Boston OpenContext)', () => {
  const toolCalls: ToolCallSummary[] = [
    { name: 'ckan__search_datasets', args: { query: 'permits' } },
  ];
  const trace = { resourceSpans: [] };

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceId, 'boston-opencontext');
});

test('Regression: Socrata-only entry shape is backward-compatible', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('socrata', { 'tool.dataset_id': 'erm2-nwe9', 'tool.portal_domain': 'data.cityofnewyork.us' }),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.cityofnewyork.us', NOW);

  assert.equal(entries.length, 1);
  const entry = entries[0];
  const expectedKeys = ['sourceId', 'catalogType', 'portalUrl', 'datasetId', 'datasetUrl', 'accessTimestamp'];
  for (const key of expectedKeys) {
    assert.ok(key in entry, `Socrata entry missing expected key: ${key}`);
  }
});

test('Trace span mcp.source wins over tool-name mapping when they disagree', () => {
  const tc: ToolCallSummary = {
    name: 'get_data',
    args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
  };
  const span = toolSpan('data-commons');
  assert.equal(resolveToolSource(tc, span), 'data-commons');
});

test('Unknown tool with no trace span defaults to socrata (pre-M9.1 backward compat)', () => {
  const tc: ToolCallSummary = { name: 'mystery_tool', args: {} };
  assert.equal(resolveToolSource(tc, undefined), 'socrata');
});

// --- Harness additions: caller-supplied resolver + registry injection ---

test('caller-supplied resolver overrides the civic default map', () => {
  const tc: ToolCallSummary = { name: 'warehouse_query', args: {} };
  const resolver = (name: string) => (name === 'warehouse_query' ? 'data-commons' : undefined);
  assert.equal(resolveToolSource(tc, undefined, resolver), 'data-commons');
  // Same resolver flows through buildDataSources.
  const entries = buildDataSources(
    [tc],
    { resourceSpans: [] },
    'data.cityofnewyork.us',
    NOW,
    { resolver },
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceId, 'data-commons');
});

test('caller-supplied fallbackSourceId replaces the socrata default', () => {
  const tc: ToolCallSummary = { name: 'mystery_tool', args: {} };
  assert.equal(resolveToolSource(tc, undefined, () => undefined, 'data-commons'), 'data-commons');
});

test('caller-supplied registry drives catalog types, endpoints, and the aggregate split', () => {
  const registry: CivicSourceRegistry = {
    'city-warehouse': {
      displayName: 'City Warehouse',
      agentTitle: 'City Warehouse MCP Server',
      serverUrl: 'https://mcp.city.example',
      catalogType: 'warehouse',
      aggregatePortalUrl: 'https://data.city.example',
    },
    'city-socrata': {
      displayName: 'City Socrata',
      agentTitle: 'City Socrata MCP Server',
      serverUrl: 'https://socrata-mcp.city.example',
      catalogType: 'socrata',
    },
  };
  const resolver = (name: string) =>
    name === 'warehouse_query' ? 'city-warehouse' : name === 'get_data' ? 'city-socrata' : undefined;
  const entries = buildDataSources(
    [
      { name: 'warehouse_query', args: {} },
      { name: 'get_data', args: { dataset_id: 'abcd-1234', portal: 'data.city.example' } },
    ],
    { resourceSpans: [] },
    'data.city.example',
    NOW,
    { resolver, registry, fallbackSourceId: 'city-warehouse' },
  );
  assert.equal(entries.length, 2);
  const agg = entries.find((e) => e.sourceId === 'city-warehouse');
  const ds = entries.find((e) => e.sourceId === 'city-socrata');
  assert.ok(agg && ds);
  assert.equal(agg!.catalogType, 'warehouse');
  assert.equal(agg!.portalUrl, 'https://data.city.example');
  assert.equal(ds!.datasetUrl, 'https://data.city.example/d/abcd-1234');
});

test('unknown source ids contribute no dataSources entry', () => {
  const trace = traceWithToolSpans([toolSpan('eurostat')]);
  const entries = buildDataSources(
    [{ name: 'unknown_tool', args: {} }],
    trace,
    'data.cityofnewyork.us',
    NOW,
  );
  assert.equal(entries.length, 0);
});

// --- dataSources states what the call carried (Wave N9 P-H1) ---
//
// RED INSTRUMENT — the fourth of four; the other three are in
// provenance.test.ts. `buildDataSources` keys dataset-keyed entries on the
// call's `dataset_id` and takes the portal from the call's `portal` argument;
// when that argument is absent it substitutes `fallbackPortal` — the run's
// selected portal — and mints `portalUrl` and `datasetUrl` on it. The loop
// that writes the calls injects `portal` into `get_data` arguments only, so a
// dataset-keyed call without one is attributed to a portal it never carried.
// The property: an entry may not attribute a call to
// `https://<fallbackPortal>` when the call carried no portal. Whether such an
// entry is omitted or emitted with no portal is left to the fix.

test('dataSources states what the call carried: a dataset-keyed call with no portal argument is not attributed to the fallback portal', () => {
  const FALLBACK_PORTAL = 'data.run-portal.example';
  const toolCalls: ToolCallSummary[] = [
    { name: 'get_data', args: { type: 'query', dataset_id: 'abcd-1234' } },
  ];
  // The span the loop writes for that call: a dataset id, no portal domain.
  const trace = traceWithToolSpans([toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234' })]);

  const entries = buildDataSources(toolCalls, trace, FALLBACK_PORTAL, NOW);

  for (const entry of entries) {
    assert.notEqual(
      entry.portalUrl,
      `https://${FALLBACK_PORTAL}`,
      `entry for ${entry.datasetId} attributes the call to the fallback portal, which the call never carried`,
    );
    assert.ok(
      !(entry.datasetUrl ?? '').includes(FALLBACK_PORTAL),
      `datasetUrl "${entry.datasetUrl}" is minted on the fallback portal, which the call never carried`,
    );
  }
  assert.ok(
    !JSON.stringify(entries).includes(FALLBACK_PORTAL),
    'no dataSources entry may carry the fallback portal for a call that did not',
  );
});

// --- The honest shape (Wave N9 P-H1, the fix) ---

test('honest shape: a dataset-keyed call with an injected portal still yields its entry; one that carried no portal yields none', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.cityofnewyork.us', dataset_id: 'erm2-nwe9' },
    },
    { name: 'get_data', args: { type: 'query', dataset_id: 'abcd-1234' } },
  ];
  const trace = traceWithToolSpans([
    toolSpan('socrata', { 'tool.dataset_id': 'erm2-nwe9', 'tool.portal_domain': 'data.cityofnewyork.us' }),
    toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234' }),
  ]);

  // `fallbackPortal` is accepted and not consulted: it appears in no entry.
  const entries = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);

  assert.equal(entries.length, 1, 'exactly the call that carried a portal contributes an entry');
  assert.deepEqual(entries[0], {
    sourceId: 'socrata',
    catalogType: 'socrata',
    portalUrl: 'https://data.cityofnewyork.us',
    datasetId: 'erm2-nwe9',
    datasetUrl: 'https://data.cityofnewyork.us/d/erm2-nwe9',
    accessTimestamp: NOW,
  });
  assert.ok(!JSON.stringify(entries).includes('data.run-portal.example'));
});

// --- A call the record states as failed asserts no access (Wave N10 P-H1) ---
//
// RED INSTRUMENT. At 0.3.1 `ToolCallSummary` is `{ name; args }`, so
// `buildDataSources` cannot see a rejection its caller recorded, and a rejected
// call reaches BOTH minting branches: the dataset-keyed branch mints an entry
// for a dataset the call never read, and the aggregate branch marks the source
// accessed on a call that resolved and nothing more. Both land inside the bytes
// a publisher signs — the package states an access, at a timestamp, that the
// record it was built from does not carry.
//
// The property: a call the source rejected asserts no access. Scope is
// `buildDataSources` only — the call is still on the PROV-O graph's tool-call
// activities, and a caller's own `queries[]` still carries the whole attempt.
//
// The two shapes below are the ones in which the assertion CAN fail. A rejected
// call on a dataset a successful call also read de-duplicates into that call's
// entry, and an aggregate source with any successful call is accessed however
// the rejected one is treated: in neither shape could these assertions fail, so
// neither is the instrument. Both are pinned further down as the converse.

test('shape A: a call recorded as failed mints no entry for its dataset, and the succeeded call keeps its own', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.city.example', dataset_id: 'abcd-1234' },
    },
    {
      // Recorded as rejected, on a dataset nothing else in this run touched —
      // the shape in which an entry for it cannot come from anywhere else.
      name: 'get_data',
      args: { type: 'query', portal: 'data.city.example', dataset_id: 'efab-5678' },
      failed: true,
      failureKind: 'unavailable',
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234', 'tool.portal_domain': 'data.city.example' }),
    toolSpan('socrata', { 'tool.dataset_id': 'efab-5678', 'tool.portal_domain': 'data.city.example' }),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);

  assert.ok(
    !entries.some((e) => e.datasetId === 'efab-5678'),
    'a call the record states as failed read no dataset: it may not appear in dataSources',
  );
  assert.ok(
    !JSON.stringify(entries).includes('efab-5678'),
    'the rejected dataset may not be named anywhere in the emitted entries',
  );
  assert.equal(entries.length, 1, 'exactly the succeeded call contributes an entry');
  assert.deepEqual(entries[0], {
    sourceId: 'socrata',
    catalogType: 'socrata',
    portalUrl: 'https://data.city.example',
    datasetId: 'abcd-1234',
    datasetUrl: 'https://data.city.example/d/abcd-1234',
    accessTimestamp: NOW,
  });
});

test('shape B: a call recorded as failed marks no aggregate source accessed', () => {
  const registry: CivicSourceRegistry = {
    'city-warehouse': {
      displayName: 'City Warehouse',
      agentTitle: 'City Warehouse MCP Server',
      serverUrl: 'https://mcp.city.example',
      catalogType: 'warehouse',
      aggregatePortalUrl: 'https://data.city.example',
    },
  };
  const resolver = (name: string) => (name === 'warehouse_query' ? 'city-warehouse' : undefined);
  // One call to the source, and it was rejected — the shape in which the
  // source's accessed-ness can only come from the rejected call.
  const toolCalls: ToolCallSummary[] = [
    { name: 'warehouse_query', args: { query: 'noise complaints' }, failed: true, failureKind: 'timeout' },
  ];

  const entries = buildDataSources(
    toolCalls,
    { resourceSpans: [] },
    'data.run-portal.example',
    NOW,
    { resolver, registry, fallbackSourceId: 'city-warehouse' },
  );

  assert.ok(
    !entries.some((e) => e.sourceId === 'city-warehouse'),
    'a call the record states as failed accessed nothing: its aggregate source may not be marked accessed',
  );
  assert.equal(entries.length, 0, 'a run whose only call was rejected accessed no data source');
});

test('shape B on the shipped civic registry: a rejected Data Commons call marks the source accessed nowhere', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'search_indicators',
      args: { query: 'median household income' },
      failed: true,
      failureKind: 'unavailable',
    },
  ];
  const trace = traceWithToolSpans([toolSpan('data-commons')]);

  const entries = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);

  assert.equal(entries.length, 0, 'the run reached no source it can state it accessed');
});

// --- The converse: absent is absent, and a recorded success is a success ---

test('a summary carrying no failure key behaves exactly as it did before the key existed', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.city.example', dataset_id: 'abcd-1234' },
    },
    { name: 'search_indicators', args: { query: 'population' } },
  ];
  const trace = traceWithToolSpans([
    toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234', 'tool.portal_domain': 'data.city.example' }),
    toolSpan('data-commons'),
  ]);

  const withoutKey = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);
  const withExplicitFalse = buildDataSources(
    toolCalls.map((tc) => ({ ...tc, failed: false })),
    trace,
    'data.run-portal.example',
    NOW,
  );

  assert.equal(withoutKey.length, 2);
  assert.equal(
    JSON.stringify(withExplicitFalse),
    JSON.stringify(withoutKey),
    'a recorded success and an unrecorded outcome produce the same entries',
  );
});

test('a rejected call on a dataset a successful call also read leaves that entry standing', () => {
  // The shape Wave N9 P6 drove, pinned here as the shape in which the
  // rejected-call assertion CANNOT fail: the successful call mints the entry,
  // so dropping the rejected one changes nothing.
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.city.example', dataset_id: 'abcd-1234' },
    },
    {
      name: 'get_data',
      args: { type: 'metadata', portal: 'data.city.example', dataset_id: 'abcd-1234' },
      failed: true,
      failureKind: 'timeout',
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234', 'tool.portal_domain': 'data.city.example' }),
    toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234', 'tool.portal_domain': 'data.city.example' }),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].datasetId, 'abcd-1234', 'the successful call read this dataset, and says so');
});

test('an aggregate source with one rejected call and one successful call is still accessed', () => {
  const toolCalls: ToolCallSummary[] = [
    {
      name: 'search_indicators',
      args: { query: 'median household income' },
      failed: true,
      failureKind: 'timeout',
    },
    {
      name: 'get_observations',
      args: { variable_dcid: 'Median_Income_Household', place_dcid: 'geoId/36061' },
    },
  ];
  const trace = traceWithToolSpans([toolSpan('data-commons'), toolSpan('data-commons')]);

  const entries = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceId, 'data-commons');
  assert.equal(entries[0].portalUrl, 'https://api.datacommons.org/mcp');
});

test('a rejected call keeps its position: the calls after it still pair with their own spans', () => {
  // `resolveToolSource` pairs a call to `toolSpans[i]` BY INDEX, so a fix that
  // filtered the rejected call out of the list before the walk would shift
  // every later call onto the wrong span. Here call 0 is rejected and resolves
  // to an aggregate source; call 1 is a dataset-keyed success. A shifted walk
  // reads span 0 for call 1 and emits the aggregate entry instead.
  const toolCalls: ToolCallSummary[] = [
    { name: 'search_indicators', args: { query: 'population' }, failed: true, failureKind: 'unavailable' },
    {
      name: 'get_data',
      args: { type: 'query', portal: 'data.city.example', dataset_id: 'abcd-1234' },
    },
  ];
  const trace = traceWithToolSpans([
    toolSpan('data-commons'),
    toolSpan('socrata', { 'tool.dataset_id': 'abcd-1234', 'tool.portal_domain': 'data.city.example' }),
  ]);

  const entries = buildDataSources(toolCalls, trace, 'data.run-portal.example', NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceId, 'socrata', 'the surviving call kept its own span');
  assert.equal(entries[0].datasetId, 'abcd-1234');
});
