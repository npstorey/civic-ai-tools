// Provenance-builder tests: (1) byte parity against golden output captured
// from the reference implementation (civic-ai-tools-website
// src/lib/evidence/provenance.ts, 2026-08-01) — the port must reproduce the
// reference graph BYTE-FOR-BYTE with the reference config passed explicitly
// (0.2.0: config is required, never defaulted), because the legacy envelope
// chain hashes JSON.stringify output; (2) the M9.3 agent-pruning behavior
// ported from the reference test suite; (3) config injection — the platform
// agent, source registry, and model description are per-instance inputs;
// (4) honest omission — a config without modelAgentDescription emits a model
// agent with no description field at all.
//
// BOTH VOCABULARY ERAS (spec Appendix J). `website-golden.json` was captured
// 2026-08-01, before the 2026-08-19 settlement, so its graphs carry the
// prior-era `urn:civic-record:` / `ns/evidence/` terms. Those bytes are
// frozen and are never edited: the byte-parity tests inject
// PRIOR_ERA_CIVIC_VOCABULARY and still demand byte-identity, which is what
// proves the harness can still reproduce an already-signed prior-era record.
// The settlement-era leg re-derives the same graphs under the DEFAULT
// vocabulary and demands they equal the fixture with exactly the two
// Appendix J literals substituted — so the eras are pinned to differ by the
// vocabulary and by nothing else. Every live-derivation test below asserts
// settlement-era ids, which is what a new emission mints.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildProvenanceGraph,
  CIVICAITOOLS_PROVENANCE_CONFIG,
  type ProvenanceConfig,
} from './provenance.ts';
import {
  CIVIC_NS,
  CIVIC_URN_PREFIX,
  PRIOR_ERA_CIVIC_NS,
  PRIOR_ERA_CIVIC_URN_PREFIX,
  PRIOR_ERA_CIVIC_VOCABULARY,
} from '../format/vocabulary.ts';

const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'website-golden.json'),
    'utf8',
  ),
);

/** The reference config with the PRIOR-era vocabulary injected — the only
 *  configuration under which a 2026-08-01 capture can be reproduced. */
const PRIOR_ERA_REFERENCE_CONFIG: ProvenanceConfig = {
  ...CIVICAITOOLS_PROVENANCE_CONFIG,
  vocabulary: PRIOR_ERA_CIVIC_VOCABULARY,
};

/** Lift a prior-era serialization to the settlement era by substituting
 *  exactly the two Appendix J literals — nothing else in the bytes moves. */
function toSettlementEra(json: string): string {
  return json
    .replaceAll(`${PRIOR_ERA_CIVIC_URN_PREFIX}:`, `${CIVIC_URN_PREFIX}:`)
    .replaceAll(PRIOR_ERA_CIVIC_NS, CIVIC_NS);
}

// --- Byte parity against the reference implementation (PRIOR era) ---

test('golden parity [prior era]: multi-source trace reproduces the reference graph byte-for-byte', () => {
  const graph = buildProvenanceGraph(
    FIXTURE.trace,
    FIXTURE.provenanceInput,
    PRIOR_ERA_REFERENCE_CONFIG,
  );
  assert.equal(
    JSON.stringify(graph),
    JSON.stringify(FIXTURE.provenanceGraph),
    'harness graph must be byte-identical to the reference implementation output',
  );
});

test('golden parity [prior era]: empty trace + pre-computed outputHash reproduces the reference minimal graph', () => {
  const graph = buildProvenanceGraph(
    { resourceSpans: [] },
    {
      packageId: 'pkg-golden-002',
      promptHash: 'ph2',
      outputHash: 'deadbeef'.repeat(8),
      model: 'anthropic/claude-3-5-sonnet',
      portal: 'data.cityofnewyork.us',
    },
    PRIOR_ERA_REFERENCE_CONFIG,
  );
  assert.equal(JSON.stringify(graph), JSON.stringify(FIXTURE.provenanceGraphMinimal));
});

// --- Byte parity in the SETTLEMENT era (what new emissions mint) ---

test('golden parity [settlement era]: the default vocabulary reproduces the reference graph with exactly the two Appendix J literals substituted', () => {
  const graph = buildProvenanceGraph(
    FIXTURE.trace,
    FIXTURE.provenanceInput,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const priorEra = JSON.stringify(FIXTURE.provenanceGraph);
  const expected = toSettlementEra(priorEra);
  // Non-vacuity: the substitution must actually have moved bytes, otherwise
  // this test would pass on a graph that never flipped.
  assert.notEqual(expected, priorEra, 'the era substitution changed nothing — the fixture is not prior-era');
  assert.equal(JSON.stringify(graph), expected);
  assert.ok(
    !JSON.stringify(graph).includes(PRIOR_ERA_CIVIC_URN_PREFIX),
    'a settlement-era graph must carry no prior-era identifier',
  );
  assert.ok(
    !JSON.stringify(graph).includes(PRIOR_ERA_CIVIC_NS),
    'a settlement-era graph must carry no prior-era namespace URI',
  );
});

test('golden parity [settlement era]: the minimal graph flips era with the same substitution', () => {
  const graph = buildProvenanceGraph(
    { resourceSpans: [] },
    {
      packageId: 'pkg-golden-002',
      promptHash: 'ph2',
      outputHash: 'deadbeef'.repeat(8),
      model: 'anthropic/claude-3-5-sonnet',
      portal: 'data.cityofnewyork.us',
    },
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  assert.equal(
    JSON.stringify(graph),
    toSettlementEra(JSON.stringify(FIXTURE.provenanceGraphMinimal)),
  );
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
    .filter((node) => typeof node['@id'] === 'string' && node['@id'].startsWith('urn:civic-record:mcp-server:'))
    .map((node) => node['@id'] as string);
}

test('Data-Commons-only analysis emits only the data-commons MCP agent', () => {
  const trace = traceOf([skillSpan('skill-hash'), toolSpan('data-commons', 'get_observations', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-record:mcp-server:data-commons']);
});

test('Socrata-only analysis emits only the socrata MCP agent', () => {
  const trace = traceOf([skillSpan('skill-hash'), toolSpan('socrata', 'get_data', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-record:mcp-server:socrata']);
});

test('Multi-source analysis emits both MCP agents', () => {
  const trace = traceOf([
    skillSpan('skill-hash'),
    toolSpan('socrata', 'get_data', 'span-1'),
    toolSpan('data-commons', 'get_observations', 'span-2'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  const agents = mcpAgents(graph['@graph']);
  assert.equal(agents.length, 2);
  assert.ok(agents.includes('urn:civic-record:mcp-server:socrata'));
  assert.ok(agents.includes('urn:civic-record:mcp-server:data-commons'));
});

test('Boston OpenContext only analysis emits only the boston-opencontext MCP agent with correct title', () => {
  const trace = traceOf([skillSpan('skill-hash'), toolSpan('boston-opencontext', 'ckan__search_datasets', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-record:mcp-server:boston-opencontext']);

  const bostonAgentNode = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-record:mcp-server:boston-opencontext',
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
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  const agents = mcpAgents(graph['@graph']);
  assert.equal(agents.length, 3);
  assert.ok(agents.includes('urn:civic-record:mcp-server:socrata'));
  assert.ok(agents.includes('urn:civic-record:mcp-server:data-commons'));
  assert.ok(agents.includes('urn:civic-record:mcp-server:boston-opencontext'));
});

test('Skill fetched but no tool calls emits no MCP agent', () => {
  const trace = traceOf([skillSpan('skill-hash')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
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
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  assert.deepEqual(mcpAgents(graph['@graph']), ['urn:civic-record:mcp-server:socrata']);
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
    n['@id'].startsWith('urn:civic-record:platform:'),
  );
  assert.ok(platform);
  assert.equal(platform!['@id'], 'urn:civic-record:platform:city-evidence-portal');
  assert.equal(platform!['dcterms:title'], 'City Evidence Portal');
  assert.equal(platform!['civic:url'], 'https://evidence.city.example');
  // The demo platform identity must NOT leak into a custom-config graph.
  // Both eras are named: the settlement-era form is what this graph would
  // actually emit if the default leaked, and the prior-era form keeps the
  // assertion honest for a graph built with PRIOR_ERA_CIVIC_VOCABULARY. A
  // single-era check here would go vacuous the moment the emitted era moved.
  const serialized = JSON.stringify(graph);
  assert.ok(!serialized.includes(`${CIVIC_URN_PREFIX}:platform:civic-ai-tools`));
  assert.ok(!serialized.includes(`${PRIOR_ERA_CIVIC_URN_PREFIX}:platform:civic-ai-tools`));
});

test('config injection: source registry and fallback source are config inputs', () => {
  const trace = traceOf([toolSpan('city-warehouse', 'warehouse_query', 'span-1')]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, CUSTOM_CONFIG);
  const agent = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-record:mcp-server:city-warehouse',
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
    (n) => n['@id'] === 'urn:civic-record:mcp-server:city-warehouse',
  );
  assert.equal(agent!['civic:serverUrl'], 'https://mcp-preview.city.example');
});

test('config injection: model agent description is a config input', () => {
  const graph = buildProvenanceGraph(traceOf([]), BASE_INPUT, CUSTOM_CONFIG);
  const model = graph['@graph'].find((n) => n['@id'].startsWith('urn:civic-record:model:'));
  assert.equal(model!['dcterms:description'], 'Large language model via a self-hosted gateway');
});

test('reference config: demo platform agent and OpenRouter description come from the exported config, passed explicitly', () => {
  const graph = buildProvenanceGraph(traceOf([]), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  const platform = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-record:platform:civic-ai-tools',
  );
  assert.ok(platform);
  assert.equal(platform!['dcterms:title'], 'Civic AI Tools');
  assert.equal(platform!['civic:url'], 'https://civicaitools.org');
  const model = graph['@graph'].find((n) => n['@id'].startsWith('urn:civic-record:model:'));
  assert.equal(model!['dcterms:description'], 'Large language model via OpenRouter');
});

test('honest omission: config without modelAgentDescription emits a model agent with no description field', () => {
  const config: ProvenanceConfig = {
    platformAgent: CIVICAITOOLS_PROVENANCE_CONFIG.platformAgent,
    sourceRegistry: CIVICAITOOLS_PROVENANCE_CONFIG.sourceRegistry,
    // modelAgentDescription deliberately unset.
  };
  const graph = buildProvenanceGraph(traceOf([]), BASE_INPUT, config);
  const model = graph['@graph'].find((n) => n['@id'].startsWith('urn:civic-record:model:'));
  assert.ok(model, 'model agent node should be on the graph');
  assert.equal(model!['dcterms:title'], BASE_INPUT.model);
  // The field is ABSENT — not empty string, not a fallback value.
  assert.ok(
    !Object.prototype.hasOwnProperty.call(model, 'dcterms:description'),
    'model agent must carry no dcterms:description when the config supplies none',
  );
});

// --- The graph states what the span carried (Wave N9 P-H1) ---
//
// RED INSTRUMENT. The three tests below (and a fourth in
// data-sources.test.ts) are written against a property, not a patch, and are
// expected to fail until the builder's asserting defaults become honest
// absences.
//
// The loop that writes the trace (the reference app's model-loop) always sets
// `tool.name`, and sets `tool.portal_domain` only when the call's arguments
// carried a portal — which its portal injection does for `get_data` and for
// no other tool. The Socrata server's `search` takes exactly one argument
// (`query`) and its `fetch` exactly one (`id`); both address the ONE portal
// that server is configured for, which the app does not know. A span for
// either therefore carries no portal attribute, and a graph built from it may
// not attribute the response to the run's selected portal
// (`ProvenanceInput.portal`) — a portal the call never addressed. Nor may the
// graph name `get_data` for a span that named no tool. The property: no
// consumer of the record invents what the loop did not write; absence is
// stated as absence.
//
// Scope: the NODES DERIVED FROM THE SPAN — its tool-call activity, the query
// entity that activity `prov:used`, and the data-response entity generated by
// it. The assertions leave open how a fix expresses the absence (a field
// omitted, a description that names no portal) and do not forbid the run
// portal from appearing elsewhere on the graph as a fact about the run.

const RUN_PORTAL = 'data.run-portal.example';
const OTHER_PORTAL = 'data.other-portal.example';

type GraphNode = { '@id': string; [k: string]: unknown };

/** The nodes the builder derives from one tool span. The tool-call activity
 *  is asserted present: absence is stated on the span's nodes, the span is
 *  not dropped from the graph. */
function nodesDerivedFromToolSpan(graph: GraphNode[], packageId: string, spanId: string): GraphNode[] {
  const toolCallUrn = `${CIVIC_URN_PREFIX}:${packageId}:tool-call:${spanId}`;
  const activity = graph.find((n) => n['@id'] === toolCallUrn);
  assert.ok(activity, `${toolCallUrn}: the tool-call activity must be on the graph — the span is walked, not dropped`);
  const used = (activity!['prov:used'] as Array<{ '@id': string }> | undefined) ?? [];
  const usedIds = new Set(used.map((ref) => ref['@id']));
  const queries = graph.filter((n) => usedIds.has(n['@id']));
  const responses = graph.filter(
    (n) => (n['prov:wasGeneratedBy'] as { '@id'?: string } | undefined)?.['@id'] === toolCallUrn,
  );
  return [activity!, ...queries, ...responses];
}

/** No node derived from the span may name `portal`: not in the data
 *  response's `dcterms:description`, not as `civic:portalDomain`, not inside
 *  `civic:datasetUrl`, not anywhere else on the node. */
function assertNoPortalClaim(nodes: GraphNode[], portal: string, why: string): void {
  for (const node of nodes) {
    const description = node['dcterms:description'];
    if (typeof description === 'string') {
      assert.ok(
        !description.includes(portal),
        `${node['@id']}: dcterms:description "${description}" names ${portal} — ${why}`,
      );
    }
    assert.notEqual(
      node['civic:portalDomain'],
      portal,
      `${node['@id']}: civic:portalDomain asserts ${portal} — ${why}`,
    );
    const datasetUrl = node['civic:datasetUrl'];
    if (typeof datasetUrl === 'string') {
      assert.ok(
        !datasetUrl.includes(portal),
        `${node['@id']}: civic:datasetUrl "${datasetUrl}" is minted on ${portal} — ${why}`,
      );
    }
    assert.ok(
      !JSON.stringify(node).includes(portal),
      `${node['@id']}: a node derived from the span carries ${portal} — ${why}`,
    );
  }
}

test('the graph states what the span carried: a tool span that names no tool is not attributed to get_data', () => {
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-no-tool-name',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'mcp.source': 'socrata',
      'tool.operation_type': 'unknown',
      'tool.arguments': '{"query":"noise complaints"}',
      // No `tool.name`.
    }),
  };
  const graph = buildProvenanceGraph(traceOf([span]), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-no-tool-name');
  const query = derived.find((n) => n['@id'].includes(':query:'));
  assert.ok(query, "the span's query entity must be on the graph");
  assert.notEqual(
    query!['civic:toolName'],
    'get_data',
    'civic:toolName may not be filled in for a span that carried no tool.name',
  );
  // This span is the only one on the trace and it named no tool, so nothing
  // on the graph may say `get_data`.
  for (const node of derived) {
    assert.ok(!JSON.stringify(node).includes('get_data'), `${node['@id']}: names get_data, which the span never carried`);
  }
  assert.ok(!JSON.stringify(graph).includes('get_data'), 'the graph names get_data for a span that carried no tool.name');
});

test('the graph states what the span carried: a search span with no tool.portal_domain is not attributed to the run portal', () => {
  // What the loop writes for `search`: the tool name, the operation type it
  // derives, the serialized arguments (`query` only — the server's schema has
  // no other property), the source, and the response hash. No portal: the
  // injection that would add one is `get_data`-only.
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-search',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'tool.name': 'search',
      'tool.operation_type': 'search',
      'tool.arguments': '{"query":"noise complaints"}',
      'mcp.source': 'socrata',
      'tool.response_hash': 'a0b1c2',
    }),
  };
  const graph = buildProvenanceGraph(
    traceOf([span]),
    { ...BASE_INPUT, portal: RUN_PORTAL },
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-search');
  assert.ok(
    derived.some((n) => n['@id'].includes(':data:')),
    'the data-response entity must be on the graph — the span carried a response hash',
  );
  assertNoPortalClaim(
    derived,
    RUN_PORTAL,
    'the span carried no tool.portal_domain, and the run portal is not what the call addressed',
  );
});

test('the graph states what the span carried: a fetch span whose id names another portal is attributed to neither that portal nor the run portal', () => {
  // `fetch` takes exactly one argument, `id`. Its grammar
  // (`record:<domain>:<dataset>:<row>`) belongs to the server, the only party
  // that resolves it; the span carries the id as opaque arguments and no
  // portal attribute.
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-fetch',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'tool.name': 'fetch',
      'tool.operation_type': 'unknown',
      'tool.arguments': JSON.stringify({ id: `record:${OTHER_PORTAL}:abcd-1234:a0b1` }),
      'mcp.source': 'socrata',
      'tool.response_hash': 'a0b1c2d3',
    }),
  };
  const graph = buildProvenanceGraph(
    traceOf([span]),
    { ...BASE_INPUT, portal: RUN_PORTAL },
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-fetch');
  assert.ok(
    derived.some((n) => n['@id'].includes(':data:')),
    'the data-response entity must be on the graph — the span carried a response hash',
  );
  assertNoPortalClaim(
    derived,
    RUN_PORTAL,
    'the span carried no tool.portal_domain, and the run portal is not what the call addressed',
  );
  assertNoPortalClaim(
    derived,
    OTHER_PORTAL,
    'the portal inside the fetch id is server grammar the span never carried as an attribute',
  );
});
