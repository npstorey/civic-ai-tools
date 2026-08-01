// Provenance-builder tests: (1) byte parity against golden output captured
// from the reference implementation (civic-ai-tools-website
// src/lib/evidence/provenance.ts, 2026-08-01) — the port must reproduce the
// reference graph BYTE-FOR-BYTE with the demo default config, because the
// legacy envelope chain hashes JSON.stringify output; (2) the M9.3
// agent-pruning behavior ported from the reference test suite; (3) config
// injection — the platform agent, source registry, and model description are
// per-instance inputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildProvenanceGraph, type ProvenanceConfig } from './provenance.ts';

const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'website-golden.json'),
    'utf8',
  ),
);

// --- Byte parity against the reference implementation ---

test('golden parity: multi-source trace reproduces the reference graph byte-for-byte', () => {
  const graph = buildProvenanceGraph(FIXTURE.trace, FIXTURE.provenanceInput);
  assert.equal(
    JSON.stringify(graph),
    JSON.stringify(FIXTURE.provenanceGraph),
    'harness graph must be byte-identical to the reference implementation output',
  );
});

test('golden parity: empty trace + pre-computed outputHash reproduces the reference minimal graph', () => {
  const graph = buildProvenanceGraph(
    { resourceSpans: [] },
    {
      packageId: 'pkg-golden-002',
      promptHash: 'ph2',
      outputHash: 'deadbeef'.repeat(8),
      model: 'anthropic/claude-3-5-sonnet',
      portal: 'data.cityofnewyork.us',
    },
  );
  assert.equal(JSON.stringify(graph), JSON.stringify(FIXTURE.provenanceGraphMinimal));
});

// --- Ported reference tests: M9.3 agent pruning ---

interface SpanStub {
  name: string;
  spanId?: string;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string } }>;
}

function traceOf(spans: SpanStub[]): Record<string, unknown> {
  return {
    resourceSpans: [
      {
        scopeSpans: [{ spans }],
      },
    ],
  };
}

function attrs(map: Record<string, string>): SpanStub['attributes'] {
  return Object.entries(map).map(([key, stringValue]) => ({ key, value: { stringValue } }));
}

function skillSpan(hash: string): SpanStub {
  return {
    name: 'skill_fetch',
    attributes: attrs({
      'skill.text_hash': hash,
      'skill.mcp_server_url': 'https://socrata-mcp.civicaitools.org',
    }),
  };
}

// Fixture convention: synthetic span timestamps stay under 13 digits
// (seconds-scale nano values) so they cannot pattern-match as card/account
// numbers in pre-push sensitivity scans.
function toolSpan(source: string, toolName: string, spanId: string): SpanStub {
  return {
    name: 'mcp_tool_call',
    spanId,
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'mcp.source': source,
      'tool.name': toolName,
      'tool.operation_type': 'query',
      'tool.arguments': '{}',
    }),
  };
}

const BASE_INPUT = {
  packageId: 'pkg-123',
  promptHash: 'abc123',
  outputText: 'hello world',
  model: 'openai/gpt-4o',
  portal: 'data.cityofnewyork.us',
};

function mcpAgents(graph: Array<{ '@id': string; [k: string]: unknown }>): string[] {
  return graph
    .filter((node) => typeof node['@id'] === 'string' && node['@id'].startsWith('urn:civic-evidence:mcp-server:'))
    .map((node) => node['@id'] as string);
}

test('Data-Commons-only analysis emits only the data-commons MCP agent', () => {
  const trace = traceOf([skillSpan('skill-hash'), toolSpan('data-commons', 'get_observations', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-evidence:mcp-server:data-commons']);
});

test('Socrata-only analysis emits only the socrata MCP agent', () => {
  const trace = traceOf([skillSpan('skill-hash'), toolSpan('socrata', 'get_data', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-evidence:mcp-server:socrata']);
});

test('Multi-source analysis emits both MCP agents', () => {
  const trace = traceOf([
    skillSpan('skill-hash'),
    toolSpan('socrata', 'get_data', 'span-1'),
    toolSpan('data-commons', 'get_observations', 'span-2'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  const agents = mcpAgents(graph['@graph']);
  assert.equal(agents.length, 2);
  assert.ok(agents.includes('urn:civic-evidence:mcp-server:socrata'));
  assert.ok(agents.includes('urn:civic-evidence:mcp-server:data-commons'));
});

test('Boston OpenContext only analysis emits only the boston-opencontext MCP agent with correct title', () => {
  const trace = traceOf([skillSpan('skill-hash'), toolSpan('boston-opencontext', 'ckan__search_datasets', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-evidence:mcp-server:boston-opencontext']);

  const bostonAgentNode = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-evidence:mcp-server:boston-opencontext',
  );
  assert.ok(bostonAgentNode, 'expected Boston OpenContext agent node in graph');
  assert.equal(bostonAgentNode!['dcterms:title'], 'Boston OpenContext MCP Server');
  assert.equal(bostonAgentNode!['civic:serverUrl'], 'https://data-mcp.boston.gov/mcp');
  assert.equal(bostonAgentNode!['civic:sourceId'], 'boston-opencontext');
});

test('Three-source analysis emits all three MCP agents, no stray sources', () => {
  const trace = traceOf([
    skillSpan('skill-hash'),
    toolSpan('socrata', 'get_data', 'span-1'),
    toolSpan('data-commons', 'get_observations', 'span-2'),
    toolSpan('boston-opencontext', 'ckan__aggregate_data', 'span-3'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  const agents = mcpAgents(graph['@graph']);
  assert.equal(agents.length, 3);
  assert.ok(agents.includes('urn:civic-evidence:mcp-server:socrata'));
  assert.ok(agents.includes('urn:civic-evidence:mcp-server:data-commons'));
  assert.ok(agents.includes('urn:civic-evidence:mcp-server:boston-opencontext'));
});

test('Skill fetched but no tool calls emits no MCP agent', () => {
  const trace = traceOf([skillSpan('skill-hash')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  assert.deepEqual(mcpAgents(graph['@graph']), []);
});

test('Pre-M9.1 Socrata span without mcp.source attribute still emits the socrata agent', () => {
  const legacyToolSpan: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'legacy-1',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': '{}',
    }),
  };
  const trace = traceOf([skillSpan('skill-hash'), legacyToolSpan]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-evidence:mcp-server:socrata']);
});

// --- Config injection (config-not-constants) ---

const CUSTOM_CONFIG: ProvenanceConfig = {
  platformAgent: {
    id: 'city-evidence-portal',
    title: 'City Evidence Portal',
    url: 'https://evidence.city.example',
  },
  sourceRegistry: {
    'city-warehouse': {
      displayName: 'City Warehouse',
      agentTitle: 'City Warehouse MCP Server',
      serverUrl: 'https://mcp.city.example',
      catalogType: 'warehouse',
      aggregatePortalUrl: 'https://data.city.example',
    },
  },
  fallbackSourceId: 'city-warehouse',
  skillSourceId: 'city-warehouse',
  modelAgentDescription: 'Large language model via a self-hosted gateway',
};

test('config injection: platform agent identity is a config input', () => {
  const graph = buildProvenanceGraph(traceOf([]), BASE_INPUT, CUSTOM_CONFIG);
  const platform = graph['@graph'].find((n) =>
    n['@id'].startsWith('urn:civic-evidence:platform:'),
  );
  assert.ok(platform);
  assert.equal(platform!['@id'], 'urn:civic-evidence:platform:city-evidence-portal');
  assert.equal(platform!['dcterms:title'], 'City Evidence Portal');
  assert.equal(platform!['civic:url'], 'https://evidence.city.example');
  // The demo platform identity must NOT leak into a custom-config graph.
  assert.ok(!JSON.stringify(graph).includes('urn:civic-evidence:platform:civic-ai-tools'));
});

test('config injection: source registry and fallback source are config inputs', () => {
  const trace = traceOf([toolSpan('city-warehouse', 'warehouse_query', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CUSTOM_CONFIG);
  const agent = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-evidence:mcp-server:city-warehouse',
  );
  assert.ok(agent, 'custom source agent should be emitted');
  assert.equal(agent!['dcterms:title'], 'City Warehouse MCP Server');
  assert.equal(agent!['civic:serverUrl'], 'https://mcp.city.example');
});

test('config injection: skill-fetch server URL overrides the configured skill source', () => {
  const trace = traceOf([
    {
      name: 'skill_fetch',
      attributes: attrs({
        'skill.text_hash': 'sh',
        'skill.mcp_server_url': 'https://mcp-preview.city.example',
      }),
    },
    toolSpan('city-warehouse', 'warehouse_query', 'span-1'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CUSTOM_CONFIG);
  const agent = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-evidence:mcp-server:city-warehouse',
  );
  assert.equal(agent!['civic:serverUrl'], 'https://mcp-preview.city.example');
});

test('config injection: model agent description is a config input', () => {
  const graph = buildProvenanceGraph(traceOf([]), BASE_INPUT, CUSTOM_CONFIG);
  const model = graph['@graph'].find((n) => n['@id'].startsWith('urn:civic-evidence:model:'));
  assert.equal(model!['dcterms:description'], 'Large language model via a self-hosted gateway');
});

test('default config: demo platform agent and OpenRouter description are the defaults', () => {
  const graph = buildProvenanceGraph(traceOf([]), BASE_INPUT);
  const platform = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-evidence:platform:civic-ai-tools',
  );
  assert.ok(platform);
  assert.equal(platform!['dcterms:title'], 'Civic AI Tools');
  assert.equal(platform!['civic:url'], 'https://civicaitools.org');
  const model = graph['@graph'].find((n) => n['@id'].startsWith('urn:civic-evidence:model:'));
  assert.equal(model!['dcterms:description'], 'Large language model via OpenRouter');
});
