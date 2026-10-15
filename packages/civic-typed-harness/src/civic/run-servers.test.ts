// Run-time server addresses for the provenance graph (ADR-0033 §D, #495).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRunServerAddresses } from './run-servers.ts';
import { CIVIC_SOURCE_REGISTRY } from '../format/sources.ts';
import { buildProvenanceGraph, CIVICAITOOLS_PROVENANCE_CONFIG } from './provenance.ts';

const RUN = [
  { url: 'https://socrata-at-run.example', name: 'socrata' },
  { url: 'https://boston-at-run.example', name: 'boston-opencontext' },
];

test('ADR-0033 §D: each registry entry takes the run\'s address for its source id, and a source the run did not have states none', () => {
  const registry = withRunServerAddresses(CIVIC_SOURCE_REGISTRY, RUN);
  assert.equal(registry.socrata!.serverUrl, 'https://socrata-at-run.example');
  assert.equal(registry['boston-opencontext']!.serverUrl, 'https://boston-at-run.example');
  assert.equal(Object.hasOwn(registry['data-commons']!, 'serverUrl'), false);
  // Everything else in an entry is the registry's own, in its own key order.
  assert.deepEqual(Object.keys(registry), Object.keys(CIVIC_SOURCE_REGISTRY));
  assert.equal(registry['boston-opencontext']!.aggregatePortalUrl, 'https://data.boston.gov');
  assert.equal(registry.socrata!.agentTitle, 'Socrata MCP Server');
  // The input is not mutated.
  assert.equal(CIVIC_SOURCE_REGISTRY.socrata!.serverUrl, 'https://socrata-mcp.civicaitools.org');
});

test('ADR-0033 §D: a graph built on that registry names the run\'s address, not the one configured at packaging', () => {
  const span = {
    name: 'mcp_tool_call',
    spanId: 'b1',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: [
      { key: 'mcp.source', value: { stringValue: 'boston-opencontext' } },
      { key: 'tool.name', value: { stringValue: 'ckan__query_data' } },
      { key: 'tool.arguments', value: { stringValue: '{}' } },
    ],
  };
  const graph = buildProvenanceGraph(
    { resourceSpans: [{ scopeSpans: [{ spans: [span] }] }] },
    { packageId: 'p', promptHash: 'ph', outputText: 'o', model: 'm' },
    { ...CIVICAITOOLS_PROVENANCE_CONFIG, sourceRegistry: withRunServerAddresses(CIVIC_SOURCE_REGISTRY, RUN) },
  );
  const agent = graph['@graph'].find((n) => n['@id'] === 'urn:civic-record:mcp-server:boston-opencontext');
  assert.equal(agent!['civic:serverUrl'], 'https://boston-at-run.example');
});
