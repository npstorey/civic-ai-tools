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
