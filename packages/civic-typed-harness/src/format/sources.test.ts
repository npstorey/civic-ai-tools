// Source-registry tests: the civic default registry's coordinates, the
// default tool→source resolver, and the display helpers ported from the
// reference data-sources test suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DataSourceEntry } from '@typedstandards/produce-core';
import {
  CIVIC_SOURCE_REGISTRY,
  CIVIC_TOOL_SOURCE_MAP,
  FALLBACK_SOURCE_ID,
  civicToolSourceResolver,
  isDatasetKeyedSource,
  displayNameForSource,
  formatDataSourcesSummary,
} from './sources.ts';

const NOW = '2026-04-16T00:00:00.000Z';

test('civic registry: three demo sources with reference coordinates', () => {
  assert.deepEqual(Object.keys(CIVIC_SOURCE_REGISTRY), [
    'socrata',
    'data-commons',
    'boston-opencontext',
  ]);
  assert.equal(CIVIC_SOURCE_REGISTRY.socrata.serverUrl, 'https://socrata-mcp.civicaitools.org');
  assert.equal(CIVIC_SOURCE_REGISTRY['data-commons'].serverUrl, 'https://api.datacommons.org/mcp');
  assert.equal(
    CIVIC_SOURCE_REGISTRY['boston-opencontext'].serverUrl,
    'https://data-mcp.boston.gov/mcp',
  );
  assert.equal(
    CIVIC_SOURCE_REGISTRY['boston-opencontext'].aggregatePortalUrl,
    'https://data.boston.gov',
  );
  assert.equal(FALLBACK_SOURCE_ID, 'socrata');
});

test('dataset-keyed split: socrata is dataset-keyed; DC and Boston are aggregate; unknown is neither', () => {
  assert.equal(isDatasetKeyedSource('socrata'), true);
  assert.equal(isDatasetKeyedSource('data-commons'), false);
  assert.equal(isDatasetKeyedSource('boston-opencontext'), false);
  assert.equal(isDatasetKeyedSource('eurostat'), false);
});

test('default resolver mirrors the demo MCP tool names', () => {
  assert.equal(civicToolSourceResolver('get_data'), 'socrata');
  assert.equal(civicToolSourceResolver('search'), 'socrata');
  assert.equal(civicToolSourceResolver('fetch'), 'socrata');
  assert.equal(civicToolSourceResolver('search_indicators'), 'data-commons');
  assert.equal(civicToolSourceResolver('get_observations'), 'data-commons');
  assert.equal(civicToolSourceResolver('ckan__aggregate_data'), 'boston-opencontext');
  assert.equal(civicToolSourceResolver('mystery_tool'), undefined);
  // Every mapped source id exists in the registry.
  for (const sourceId of Object.values(CIVIC_TOOL_SOURCE_MAP)) {
    assert.ok(CIVIC_SOURCE_REGISTRY[sourceId], `unmapped source id: ${sourceId}`);
  }
});

// --- Display helpers (ported from the reference test suite) ---

test('displayNameForSource maps known source ids to friendly names', () => {
  assert.equal(displayNameForSource('socrata'), 'Socrata');
  assert.equal(displayNameForSource('data-commons'), 'Data Commons');
  assert.equal(displayNameForSource('boston-opencontext'), 'Boston OpenContext');
});

test('displayNameForSource capitalises unknown ids so new sources render sensibly', () => {
  assert.equal(displayNameForSource('boston-core'), 'Boston Core');
  assert.equal(displayNameForSource('eurostat'), 'Eurostat');
});

test('displayNameForSource coerces missing sourceId to Socrata (pre-M9.3 packages)', () => {
  assert.equal(displayNameForSource(undefined), 'Socrata');
  assert.equal(displayNameForSource(null), 'Socrata');
  assert.equal(displayNameForSource(''), 'Socrata');
});

test('displayNameForSource honors a caller-supplied registry', () => {
  const registry = {
    'city-warehouse': {
      displayName: 'City Warehouse',
      agentTitle: 'City Warehouse MCP Server',
      serverUrl: 'https://mcp.city.example',
      catalogType: 'warehouse',
    },
  };
  assert.equal(displayNameForSource('city-warehouse', registry), 'City Warehouse');
});

test('formatDataSourcesSummary returns null for missing or empty arrays', () => {
  assert.equal(formatDataSourcesSummary(undefined), null);
  assert.equal(formatDataSourcesSummary([]), null);
});

test('formatDataSourcesSummary renders single-source DC package without Socrata leakage', () => {
  const entries: DataSourceEntry[] = [
    {
      sourceId: 'data-commons',
      catalogType: 'data-commons',
      portalUrl: 'https://api.datacommons.org/mcp',
      accessTimestamp: NOW,
    },
  ];
  assert.equal(formatDataSourcesSummary(entries), 'Data Commons');
});

test('formatDataSourcesSummary dedupes multiple Socrata dataset entries into one name', () => {
  const entries: DataSourceEntry[] = [
    {
      sourceId: 'socrata',
      catalogType: 'socrata',
      portalUrl: 'https://data.cityofnewyork.us',
      datasetId: 'erm2-nwe9',
      datasetUrl: 'https://data.cityofnewyork.us/d/erm2-nwe9',
      accessTimestamp: NOW,
    },
    {
      sourceId: 'socrata',
      catalogType: 'socrata',
      portalUrl: 'https://data.cityofnewyork.us',
      datasetId: '43nn-pn8j',
      datasetUrl: 'https://data.cityofnewyork.us/d/43nn-pn8j',
      accessTimestamp: NOW,
    },
  ];
  assert.equal(formatDataSourcesSummary(entries), 'Socrata');
});

test('formatDataSourcesSummary joins multi-source entries with a middle-dot separator', () => {
  const entries: DataSourceEntry[] = [
    {
      sourceId: 'socrata',
      catalogType: 'socrata',
      portalUrl: 'https://data.cityofnewyork.us',
      datasetId: 'erm2-nwe9',
      datasetUrl: 'https://data.cityofnewyork.us/d/erm2-nwe9',
      accessTimestamp: NOW,
    },
    {
      sourceId: 'data-commons',
      catalogType: 'data-commons',
      portalUrl: 'https://api.datacommons.org/mcp',
      accessTimestamp: NOW,
    },
  ];
  assert.equal(formatDataSourcesSummary(entries), 'Socrata · Data Commons');
});

test('formatDataSourcesSummary renders a three-source analysis in active-source order', () => {
  const entries: DataSourceEntry[] = [
    {
      sourceId: 'socrata',
      catalogType: 'socrata',
      portalUrl: 'https://data.cityofnewyork.us',
      datasetId: 'erm2-nwe9',
      datasetUrl: 'https://data.cityofnewyork.us/d/erm2-nwe9',
      accessTimestamp: NOW,
    },
    {
      sourceId: 'data-commons',
      catalogType: 'data-commons',
      portalUrl: 'https://api.datacommons.org/mcp',
      accessTimestamp: NOW,
    },
    {
      sourceId: 'boston-opencontext',
      catalogType: 'ckan',
      portalUrl: 'https://data.boston.gov',
      accessTimestamp: NOW,
    },
  ];
  assert.equal(
    formatDataSourcesSummary(entries),
    'Socrata · Data Commons · Boston OpenContext',
  );
});
