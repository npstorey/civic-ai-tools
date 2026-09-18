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
import { CIVIC_SOURCE_REGISTRY, type CivicSourceRegistry } from '../format/sources.ts';
// Namespace import: the vocabulary guard at the foot of this file derives the
// declared-term set from the module's exported VALUES, so it must see all of
// them rather than the handful named above.
import * as vocabularyModule from '../format/vocabulary.ts';

const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'website-golden.json'),
    'utf8',
  ),
);

/** The OTHER golden fixture — read here only so the byte-stability
 *  measurement below covers both, rather than the one this file already
 *  reproduces. */
const REFERENCE_GOLDEN = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'reference-golden.json'),
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

/**
 * Lift a frozen capture over the ONE behaviour 0.5.0 changed
 * (civic-ai-tools#205): the 2026-08-01 reference implementation gave a source
 * the registry did not carry a `civic:serverUrl` equal to its own source id —
 * the source-id fallback — and the builder now omits the key instead.
 *
 * The capture's bytes are NEVER edited. This is a transform OF them, the same
 * device `toSettlementEra` above applies to the Appendix J literals and
 * golden-reproduction.test.ts applies to the prompt-hash placeholder. Keeping
 * the file frozen is what lets it still record what the reference
 * implementation emitted, which is the only thing that makes it a golden.
 *
 * DERIVED, NOT A HAND LIST: it walks every node and lifts each one whose
 * `civic:sourceId` is in no registry entry. `dropped` is asserted, so a
 * capture in which the lift finds nothing (or finds more than the one agent
 * measured at 3d09d99) fails here rather than silently doing nothing. Key
 * order survives: deleting one key leaves the insertion order of the rest.
 *
 * A near-twin of this function lives in golden-reproduction.test.ts, which
 * lifts the same capture for the ninth envelope case. Test files run in
 * separate processes, so it is copied rather than imported.
 */
function dropUnregisteredServerUrls(
  graph: { '@graph': Array<Record<string, unknown>> },
  registry: CivicSourceRegistry,
  expectedDropped = 1,
): { '@graph': Array<Record<string, unknown>> } {
  const lifted = JSON.parse(JSON.stringify(graph)) as {
    '@graph': Array<Record<string, unknown>>;
  };
  let dropped = 0;
  for (const node of lifted['@graph']) {
    const sourceId = node['civic:sourceId'];
    if (typeof sourceId !== 'string') continue;
    if (!Object.hasOwn(node, 'civic:serverUrl')) continue;
    if (Object.hasOwn(registry, sourceId)) continue;
    delete node['civic:serverUrl'];
    dropped += 1;
  }
  assert.equal(
    dropped,
    expectedDropped,
    'the frozen capture no longer carries the source-id fallback this lift exists for — the lift would be silently doing nothing',
  );
  return lifted;
}

/** The frozen reference graph as the 0.5.0 builder reproduces it. */
const LIFTED_FIXTURE_GRAPH = dropUnregisteredServerUrls(
  FIXTURE.provenanceGraph,
  CIVIC_SOURCE_REGISTRY,
);

// --- Byte parity against the reference implementation (PRIOR era) ---

test('golden parity [prior era]: multi-source trace reproduces the reference graph byte-for-byte', () => {
  const graph = buildProvenanceGraph(
    FIXTURE.trace,
    FIXTURE.provenanceInput,
    PRIOR_ERA_REFERENCE_CONFIG,
  );
  assert.equal(
    JSON.stringify(graph),
    JSON.stringify(LIFTED_FIXTURE_GRAPH),
    'harness graph must be byte-identical to the reference implementation output, lifted over the #205 fallback',
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
  const priorEra = JSON.stringify(LIFTED_FIXTURE_GRAPH);
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
  // `boolValue` is the third OTel value shape (capture/trace.ts) and the one a
  // rejection arrives in — the reference producer ends a refused call's span
  // with `error: true`. It is on this stub so a fixture can drive that shape
  // rather than a string the producer never writes.
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; boolValue?: boolean } }>;
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

// --- #205: the agent names the CONFIGURED address, or names nothing ---

/** One registry carrying three deliberately different source shapes, plus a
 *  fourth id the registry has never heard of, driven from the traces below.
 *  `skillSourceId` is its own source and is never in a tool span, so the
 *  skill-fetch substitution cannot reach — and cannot rescue — any of the
 *  three cases under test. */
const ADDRESS_CONFIG: ProvenanceConfig = {
  platformAgent: {
    id: 'city-evidence-portal',
    title: 'City Evidence Portal',
    url: 'https://evidence.city.example',
  },
  sourceRegistry: {
    'skill-source': {
      displayName: 'Skill Source',
      agentTitle: 'Skill Source MCP Server',
      serverUrl: 'https://mcp-skill.city.example',
      catalogType: 'warehouse',
    },
    // Shape 1: an entry carrying the address this instance is pointed at,
    // which is NOT the address any harness constant names.
    'configured-source': {
      displayName: 'Configured Source',
      agentTitle: 'Configured Source MCP Server',
      serverUrl: 'https://mcp-configured.city.example',
      catalogType: 'warehouse',
    },
    // Shape 2: an entry the registry KNOWS, whose address it does not.
    'addressless-source': {
      displayName: 'Addressless Source',
      agentTitle: 'Addressless Source MCP Server',
      catalogType: 'warehouse',
    },
    // Shape 3 is the absence of an entry — see `unregistered-source` below.
  },
  fallbackSourceId: 'skill-source',
  skillSourceId: 'skill-source',
};

test('#205 PREMISE: the three cases below are three different shapes', () => {
  // Without this the two absence cases could be the same case twice, and a
  // green on both would be one measurement reported as two.
  assert.equal(
    ADDRESS_CONFIG.sourceRegistry['configured-source'].serverUrl,
    'https://mcp-configured.city.example',
  );
  assert.ok(Object.hasOwn(ADDRESS_CONFIG.sourceRegistry, 'addressless-source'));
  assert.equal(ADDRESS_CONFIG.sourceRegistry['addressless-source'].serverUrl, undefined);
  assert.ok(!Object.hasOwn(ADDRESS_CONFIG.sourceRegistry, 'unregistered-source'));
  // And the configured address is not a constant the harness could have
  // supplied: it appears in no entry of the civic reference registry.
  for (const info of Object.values(CIVIC_SOURCE_REGISTRY)) {
    assert.notEqual(info.serverUrl, 'https://mcp-configured.city.example');
  }
});

test('#205: a non-skill source whose entry carries a configured address names that address', () => {
  const trace = traceOf([
    skillSpan('skill-hash'),
    toolSpan('configured-source', 'warehouse_query', 'span-1'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, ADDRESS_CONFIG);
  const agent = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-record:mcp-server:configured-source',
  );
  assert.ok(agent, 'the configured source agent should be emitted');
  assert.equal(agent!['civic:serverUrl'], 'https://mcp-configured.city.example');
  // The skill-fetch span's URL belongs to another source and must not reach
  // this agent.
  assert.notEqual(agent!['civic:serverUrl'], 'https://socrata-mcp.civicaitools.org');
  // Key order is part of the byte contract on the legacy chain.
  assert.deepEqual(Object.keys(agent!).filter((k) => k !== '@id' && k !== '@type'), [
    'dcterms:title',
    'civic:serverUrl',
    'civic:sourceId',
  ]);
});

test('#205: a registry entry with no address emits an agent with NO civic:serverUrl key', () => {
  const trace = traceOf([
    skillSpan('skill-hash'),
    toolSpan('addressless-source', 'warehouse_query', 'span-1'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, ADDRESS_CONFIG);
  const agent = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-record:mcp-server:addressless-source',
  );
  assert.ok(agent, 'the agent is still emitted — the run used the source');
  // The KEY'S ABSENCE, not an empty string. An empty string is an assertion
  // about an address, and JSON.stringify keeps it in the signed bytes.
  assert.equal(Object.hasOwn(agent!, 'civic:serverUrl'), false);
  assert.ok(!JSON.stringify(agent).includes('civic:serverUrl'));
  // This is the registry-KNOWN shape: the title comes from the entry.
  assert.equal(agent!['dcterms:title'], 'Addressless Source MCP Server');
  assert.equal(agent!['civic:sourceId'], 'addressless-source');
});

test('#205: a source the registry has never heard of emits an agent with NO civic:serverUrl key', () => {
  const trace = traceOf([
    skillSpan('skill-hash'),
    toolSpan('unregistered-source', 'warehouse_query', 'span-1'),
  ]);
  const graph = buildProvenanceGraph(trace, BASE_INPUT, ADDRESS_CONFIG);
  const agent = graph['@graph'].find(
    (n) => n['@id'] === 'urn:civic-record:mcp-server:unregistered-source',
  );
  assert.ok(agent, 'the agent is still emitted — the run used the source');
  assert.equal(Object.hasOwn(agent!, 'civic:serverUrl'), false);
  assert.ok(!JSON.stringify(agent).includes('civic:serverUrl'));
  // The dropped fallback, named: before 0.5.0 this node carried
  // `"civic:serverUrl":"unregistered-source"` — the source id standing in for
  // an address. That exact string must not be in the bytes.
  assert.ok(!JSON.stringify(agent).includes('"civic:serverUrl":"unregistered-source"'));
  // Distinct from the case above: this id is in no registry entry, so the
  // title is the derived one rather than an entry's agentTitle.
  assert.equal(agent!['dcterms:title'], 'unregistered-source MCP Server');
  assert.equal(agent!['civic:sourceId'], 'unregistered-source');
  assert.deepEqual(Object.keys(agent!).filter((k) => k !== '@id' && k !== '@type'), [
    'dcterms:title',
    'civic:sourceId',
  ]);
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

// --- The honest shapes (Wave N9 P-H1, the fix) ---
//
// The four instruments above forbid the invented values. These pin the
// shapes the builder now emits, so a later change that reinvents a value or
// drops a stated fact fails by name.

test('honest shape: a get_data span carrying both tool.portal_domain and tool.dataset_id yields the description, civic:portalDomain and civic:datasetUrl it always has', () => {
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-get-data',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': '{"type":"query","dataset_id":"abcd-1234","portal":"data.cityofnewyork.us"}',
      'mcp.source': 'socrata',
      'tool.dataset_id': 'abcd-1234',
      'tool.portal_domain': 'data.cityofnewyork.us',
      'tool.response_hash': 'a0b1c2',
    }),
  };
  // The run portal differs from the span's on purpose: the span's nodes
  // state the span's portal and nothing of the run's.
  const graph = buildProvenanceGraph(
    traceOf([span]),
    { ...BASE_INPUT, portal: RUN_PORTAL },
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-get-data');
  const response = derived.find((n) => n['@id'].includes(':data:'));
  assert.ok(response, 'data-response entity expected');
  assert.equal(response!['dcterms:description'], 'Data response from data.cityofnewyork.us');
  assert.equal(response!['civic:datasetId'], 'abcd-1234');
  assert.equal(response!['civic:portalDomain'], 'data.cityofnewyork.us');
  assert.equal(response!['civic:datasetUrl'], 'https://data.cityofnewyork.us/d/abcd-1234');
  assert.equal(response!['civic:croissantMetadataUrl'], null);
  // Key order is the byte contract: the block reads exactly as it did before.
  assert.deepEqual(
    Object.keys(response!).filter((k) => k.startsWith('civic:')),
    [
      'civic:contentHash',
      'civic:sourceId',
      'civic:datasetId',
      'civic:portalDomain',
      'civic:datasetUrl',
      'civic:croissantMetadataUrl',
    ],
  );
  const query = derived.find((n) => n['@id'].includes(':query:'));
  assert.equal(query!['civic:toolName'], 'get_data');
  const activity = derived.find((n) => n['@id'].includes(':tool-call:'));
  assert.equal(activity!['dcterms:description'], 'MCP tool call: get_data (query)');
  assertNoPortalClaim(derived, RUN_PORTAL, "the span carried its own portal; the run's is not it");
});

test('honest shape: a dataset-keyed span with no tool.portal_domain describes its data response by the source agent title', () => {
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-search-shape',
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
  const graph = buildProvenanceGraph(traceOf([span]), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-search-shape');
  const response = derived.find((n) => n['@id'].includes(':data:'));
  assert.ok(response, 'data-response entity expected');
  // The same form aggregate and unknown sources take: the agent that
  // answered, by its registry title.
  assert.equal(response!['dcterms:description'], 'Data response from Socrata MCP Server');
  assert.equal(response!['civic:sourceId'], 'socrata');
  for (const key of ['civic:datasetId', 'civic:portalDomain', 'civic:datasetUrl', 'civic:croissantMetadataUrl']) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(response, key),
      `${key} must be absent — the span carried neither a dataset id nor a portal`,
    );
  }
});

test('honest shape: a dataset-keyed span with a dataset id and no portal states the dataset id and mints no URL', () => {
  // Latent by construction for the reference producer (its loop injects the
  // run portal into get_data arguments before the span opens); reachable by
  // any producer that writes tool.dataset_id without tool.portal_domain.
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-dataset-no-portal',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': '{"type":"query","dataset_id":"abcd-1234"}',
      'mcp.source': 'socrata',
      'tool.dataset_id': 'abcd-1234',
      'tool.response_hash': 'a0b1c2',
    }),
  };
  const graph = buildProvenanceGraph(
    traceOf([span]),
    { ...BASE_INPUT, portal: RUN_PORTAL },
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-dataset-no-portal');
  const response = derived.find((n) => n['@id'].includes(':data:'));
  assert.ok(response, 'data-response entity expected');
  assert.equal(response!['dcterms:description'], 'Data response from Socrata MCP Server');
  assert.equal(response!['civic:datasetId'], 'abcd-1234', 'the dataset id the span carried is stated');
  assert.ok(!Object.prototype.hasOwnProperty.call(response, 'civic:portalDomain'));
  assert.ok(!Object.prototype.hasOwnProperty.call(response, 'civic:datasetUrl'));
  assert.equal(response!['civic:croissantMetadataUrl'], null);
  assert.deepEqual(
    Object.keys(response!).filter((k) => k.startsWith('civic:')),
    ['civic:contentHash', 'civic:sourceId', 'civic:datasetId', 'civic:croissantMetadataUrl'],
  );
  assertNoPortalClaim(derived, RUN_PORTAL, 'the span carried no portal');
});

test('honest shape: a span with no tool.name yields a query entity with no civic:toolName key and an activity that names no tool', () => {
  const span: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-no-tool-name-shape',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'mcp.source': 'socrata',
      'tool.operation_type': 'unknown',
      'tool.arguments': '{"query":"noise complaints"}',
    }),
  };
  const graph = buildProvenanceGraph(traceOf([span]), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG);
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-no-tool-name-shape');
  const query = derived.find((n) => n['@id'].includes(':query:'));
  assert.ok(query, 'query entity expected');
  // The key is ABSENT — not an empty string, not a placeholder.
  assert.ok(!Object.prototype.hasOwnProperty.call(query, 'civic:toolName'));
  assert.equal(query!['civic:operationType'], 'unknown');
  assert.equal(query!['dcterms:description'], 'MCP tool arguments (unknown)');
  const activity = derived.find((n) => n['@id'].includes(':tool-call:'));
  assert.equal(activity!['dcterms:description'], 'MCP tool call (unknown)');
});

// --- The activity states the rejection (Wave N10 P-H2, civic-ai-tools#193) ---
//
// RED INSTRUMENT. At 0.3.1 the graph describes a call the source REFUSED
// exactly as it describes one that answered — same activity node, same
// description, no marker — so a reader of the signed graph cannot tell them
// apart. `buildProvenanceGraph` reads nine `tool.*` / `mcp.*` attributes and
// never looks at the span's failure at all.
//
// HOW THE REJECTION ARRIVES. The reference producer ends a rejected call's
// span with `error: true` and `error.kind: <ToolFailureKind>`
// (civic-ai-tools-website `src/lib/model-loop/run-tool-loop.ts`, the catch
// site). `error.kind` is the one attribute name across both repositories
// (Wave N10 D5) and `error.message` is gone from that span by the same wave,
// so the classified kind is the ONLY cause the graph may ever state.
//
// `error` is a BOOLEAN, and `TraceBuilder` encodes a boolean as
// `{ boolValue }` (capture/trace.ts) — a value shape the module's string
// attribute reader returns `undefined` for. The fixtures below therefore
// write it as a boolean rather than as the string "true": a fixture that
// wrote the string would drive a path the producer does not use, and would go
// green over a reader that cannot see a real rejection.
//
// THE PROPERTY. `error` is the ASSERTION and `error.kind` only a LABEL on one
// — the posture `ToolCallSummary.failed` / `failureKind` already takes. A span
// carrying a kind and no assertion is not a rejection. A span carrying
// `error: false` is not a rejection either, and states that by carrying NO
// marker key at all: a literal `false` inside signed bytes would assert an
// outcome the producer never stated, and "recorded as not-failed" is not
// distinguishable from "nothing recorded" once it is written down.

/** A span attribute the producer wrote as a BOOLEAN. */
function boolAttr(key: string, boolValue: boolean): SpanStub['attributes'][number] {
  return { key, value: { boolValue } };
}

/** Two dataset ids so the rejected call addresses a dataset nothing else
 *  touched — the shape in which an assertion about the rejected call can
 *  actually fail. Seeded hex opens in the letter range (fixture convention). */
const ANSWERED_DATASET = 'abcd-1234';
const REJECTED_DATASET = 'a1b2-c3d4';

/**
 * The wave's driving shape: in ONE trace, a call the source answered and a
 * call it REFUSED, on different datasets. Two calls rather than one so that a
 * builder which marked every activity, or marked the wrong one, fails here.
 *
 * The rejected span carries no `tool.response_hash` — there was no response.
 * It carries a `tool.duration_ms` only when `rejectedDurationMs` is passed,
 * and the two shapes are BOTH real inputs:
 *
 *   - WITHOUT it — a producer that stated no elapsed for the rejection. This
 *     is what the reference producer emitted until
 *     civic-ai-tools-website#413 shipped (Wave N11 P4, merged `ec7f173`), and
 *     it is what any other producer that measures nothing still emits. The
 *     docstring that stood here said the reference producer "does not write
 *     it onto the span (civic-ai-tools-website#413, out of scope for this
 *     phase)"; since #413 that sentence is false, and it is corrected rather
 *     than deleted because the shape it described is still a shape the graph
 *     must handle — absence stated as absence.
 *   - WITH it — what the reference producer emits today: the elapsed it
 *     already measured, written onto the span on the rejection path. That
 *     puts `civic:durationMs` BESIDE `civic:failed` on one activity, in
 *     SIGNED bytes, which is the combination
 *     `the reference producer's rejected call states its elapsed` below
 *     drives and pins.
 */
function answeredAndRejectedTrace(options: {
  kind?: string;
  rawText?: string;
  assertion?: boolean;
  rejectedDurationMs?: string;
} = {}): Record<string, unknown> {
  const answered: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-answered',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'mcp.source': 'socrata',
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': `{"type":"query","dataset_id":"${ANSWERED_DATASET}","portal":"${RUN_PORTAL}"}`,
      'tool.dataset_id': ANSWERED_DATASET,
      'tool.portal_domain': RUN_PORTAL,
      'tool.response_hash': 'a0b1c2',
      'tool.duration_ms': '850',
    }),
  };
  const rejected: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-rejected',
    startTimeUnixNano: '3000000000',
    endTimeUnixNano: '4000000000',
    attributes: [
      ...attrs({
        'mcp.source': 'socrata',
        'tool.name': 'get_data',
        'tool.operation_type': 'query',
        'tool.arguments': `{"type":"query","dataset_id":"${REJECTED_DATASET}","portal":"${RUN_PORTAL}"}`,
        'tool.dataset_id': REJECTED_DATASET,
        'tool.portal_domain': RUN_PORTAL,
        ...(options.rejectedDurationMs
          ? { 'tool.duration_ms': options.rejectedDurationMs }
          : {}),
        ...(options.kind ? { 'error.kind': options.kind } : {}),
        ...(options.rawText ? { 'error.message': options.rawText } : {}),
      }),
      ...(options.assertion === undefined
        ? [boolAttr('error', true)]
        : [boolAttr('error', options.assertion)]),
    ],
  };
  return traceOf([answered, rejected]);
}

/** The tool-call activity the builder derived from one span. */
function activityForSpan(nodes: GraphNode[], spanId: string): GraphNode {
  const urn = `${CIVIC_URN_PREFIX}:${BASE_INPUT.packageId}:tool-call:${spanId}`;
  const node = nodes.find((n) => n['@id'] === urn);
  assert.ok(node, `${urn}: the tool-call activity must be on the graph`);
  return node!;
}

/** The keys a tool-call activity carried at 0.3.1, in emission order — the
 *  byte contract. A marker is APPENDED to this list; nothing in it moves. */
const ACTIVITY_KEYS_0_3_1 = [
  '@id',
  '@type',
  'dcterms:description',
  'civic:sourceId',
  'prov:used',
  'prov:wasAssociatedWith',
  'prov:startedAtTime',
  'prov:endedAtTime',
];

function hasKey(node: GraphNode, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(node, key);
}

test('the activity states the rejection: a span ended with the failure carries the marker and its classified kind, and the call that answered carries neither', () => {
  const graph = buildProvenanceGraph(
    answeredAndRejectedTrace({ kind: 'unavailable' }),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const nodes = graph['@graph'] as GraphNode[];
  const rejected = activityForSpan(nodes, 'span-rejected');
  const answered = activityForSpan(nodes, 'span-answered');

  assert.equal(
    rejected['civic:failed'],
    true,
    'the activity for a span the source refused must state the rejection — without it the graph describes a refused call exactly as it describes one that answered',
  );
  assert.equal(
    rejected['civic:failureKind'],
    'unavailable',
    'the classified kind the span carried is stated verbatim — the producer classifies once, the graph does not re-derive',
  );

  // The two must be TELLABLE APART. This leg is what makes the assertion
  // above able to fail in the other direction: a builder that marked every
  // activity would satisfy the first two assertions and fail here.
  assert.ok(!hasKey(answered, 'civic:failed'), 'the call that answered must carry no failure marker');
  assert.ok(!hasKey(answered, 'civic:failureKind'), 'the call that answered must carry no failure kind');
  assert.notDeepEqual(
    Object.keys(rejected),
    Object.keys(answered).filter((k) => k !== 'civic:durationMs'),
    'a reader must be able to tell the two activities apart',
  );
});

test('the activity states the rejection: a rejected span that carried no kind states the failure and states no kind', () => {
  const graph = buildProvenanceGraph(
    answeredAndRejectedTrace(),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const rejected = activityForSpan(graph['@graph'] as GraphNode[], 'span-rejected');
  assert.equal(rejected['civic:failed'], true);
  assert.ok(
    !hasKey(rejected, 'civic:failureKind'),
    'a kind the span did not carry is omitted, never placeholdered with "unknown" — that word is one of the producer\'s four real values',
  );
});

test('the activity states the rejection: the marker is appended, leaving every key the activity already carried in its place', () => {
  const graph = buildProvenanceGraph(
    answeredAndRejectedTrace({ kind: 'timeout' }),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const nodes = graph['@graph'] as GraphNode[];
  assert.deepEqual(
    Object.keys(activityForSpan(nodes, 'span-answered')),
    [...ACTIVITY_KEYS_0_3_1, 'civic:durationMs'],
    'the activity for a call that answered is the 0.3.1 shape, key for key and in order',
  );
  assert.deepEqual(
    Object.keys(activityForSpan(nodes, 'span-rejected')),
    [...ACTIVITY_KEYS_0_3_1, 'civic:failed', 'civic:failureKind'],
    'the marker is appended after the keys the activity already carried — insertion order is the hashed byte order',
  );
});

// --- The rejected call states its elapsed too (Wave N11 P-H2, the seat's
// fold-in at G25; civic-ai-tools-website#413) ---
//
// #413 shipped in the website's Wave N11 P4 (merged `ec7f173`): the reference
// producer's loop starts its clock outside the `try`, so the elapsed until a
// rejection was already measured, and the catch-side span now records it
// instead of discarding it. Two comments in this package — one here, one at
// the conditional in capture/provenance.ts — said the opposite and cited the
// issue BY NUMBER as the reason the case could not arise. Both are corrected;
// this test is the part a comment cannot do.
//
// WHY IT MATTERS HERE. `civic:durationMs` and `civic:failed` on ONE activity
// is a key combination this package exercised nowhere: the driving fixture's
// rejected span deliberately carried no duration, `reference-golden.json`
// carries no spans at all, and `website-golden.json`'s nine include one with a
// duration and none with `error`. The website writes that combination into a
// SIGNED graph, so the graph's key list for it is a byte contract with no
// instrument behind it until now.

/** The elapsed the rejected call reports — deliberately NOT the answered
 *  call's 850, so an activity that read the wrong span's attribute fails. */
const REJECTED_DURATION_MS = '1420';

test("the reference producer's rejected call states its elapsed: the activity carries the duration BESIDE the marker and its kind, in that order", () => {
  const graph = buildProvenanceGraph(
    answeredAndRejectedTrace({ kind: 'timeout', rejectedDurationMs: REJECTED_DURATION_MS }),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const nodes = graph['@graph'] as GraphNode[];
  const rejected = activityForSpan(nodes, 'span-rejected');
  const answered = activityForSpan(nodes, 'span-answered');

  // The value is the rejected span's own, read as a number.
  assert.equal(
    rejected['civic:durationMs'],
    Number(REJECTED_DURATION_MS),
    'the elapsed the producer measured for the REFUSED call is stated on its activity',
  );
  assert.notEqual(
    rejected['civic:durationMs'],
    answered['civic:durationMs'],
    'the two calls report different elapsed values — an activity that read the other span would pass the assertion above',
  );
  assert.equal(rejected['civic:failed'], true, 'and the rejection is still stated');
  assert.equal(rejected['civic:failureKind'], 'timeout', 'with its classified kind');

  // THE KEY ORDER, in full. `civic:durationMs` keeps the position it has held
  // since 0.3.1 — before the two markers, which are appended last — so a
  // package whose producer records the elapsed on a rejection hashes the same
  // key list as one whose rejection carried no duration, plus that one key in
  // its established place.
  assert.deepEqual(
    Object.keys(rejected),
    [...ACTIVITY_KEYS_0_3_1, 'civic:durationMs', 'civic:failed', 'civic:failureKind'],
    'the duration sits in its 0.3.1 position and the two markers stay appended after it',
  );

  // The call that answered is untouched by any of this.
  assert.deepEqual(
    Object.keys(answered),
    [...ACTIVITY_KEYS_0_3_1, 'civic:durationMs'],
    'the answered activity is the 0.3.1 shape plus its duration, key for key',
  );
});

test("the reference producer's rejected call states its elapsed: no golden fixture carries the combination, which is why adding it moves no golden byte", () => {
  // The measurement behind "no golden byte moves" for the test above, taken
  // from the fixtures themselves rather than asserted in a report. It walks
  // EVERY span in both fixtures — the universe is what the files carry, not a
  // list of the spans someone remembered — and states three facts:
  // reference-golden has no spans at all, website-golden has spans with a
  // duration but none with a failure, and neither has one with both. The day a
  // fixture gains such a span this test fails, and it should: at that point
  // the golden bytes for it are exactly what has to be re-examined.
  const spansOf = (fixtureTrace: unknown): SpanStub[] => {
    const trace = fixtureTrace as {
      resourceSpans?: Array<{ scopeSpans?: Array<{ spans?: SpanStub[] }> }>;
    };
    return (trace.resourceSpans ?? []).flatMap((rs) =>
      (rs.scopeSpans ?? []).flatMap((ss) => ss.spans ?? []),
    );
  };
  const has = (span: SpanStub, key: string): boolean =>
    span.attributes.some((a) => a.key === key);

  const referenceSpans = (REFERENCE_GOLDEN.envelopeCases as Array<{ input: { trace: unknown } }>)
    .flatMap((c) => spansOf(c.input.trace));
  assert.equal(referenceSpans.length, 0, 'reference-golden.json carries zero spans of any kind');

  const websiteSpans = spansOf(FIXTURE.trace);
  assert.equal(websiteSpans.length, 9, 'website-golden.json carries nine spans');
  assert.equal(
    websiteSpans.filter((s) => has(s, 'tool.duration_ms')).length,
    1,
    'exactly one of them carries a duration — so the duration path IS golden-covered',
  );
  assert.equal(
    websiteSpans.filter((s) => has(s, 'error')).length,
    0,
    'none of them carries a failure — so the rejection path is not',
  );
  for (const span of [...referenceSpans, ...websiteSpans]) {
    assert.ok(
      !(has(span, 'error') && has(span, 'tool.duration_ms')),
      'no golden span carries both, so no golden byte depends on the combination this phase drives',
    );
  }
});

test('absent is absent: a span carrying error: false yields an activity with no failure key at all, not a literal false', () => {
  const graph = buildProvenanceGraph(
    answeredAndRejectedTrace({ assertion: false, kind: 'timeout' }),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const node = activityForSpan(graph['@graph'] as GraphNode[], 'span-rejected');
  assert.ok(
    !hasKey(node, 'civic:failed'),
    'a producer that stated "not failed" and a producer that stated nothing must be indistinguishable in the bytes — a literal false asserts an outcome',
  );
  assert.ok(!hasKey(node, 'civic:failureKind'), 'no assertion, so no label on one');
  assert.deepEqual(Object.keys(node), ACTIVITY_KEYS_0_3_1);
});

test('the kind is a label on the assertion, not the assertion: a span carrying error.kind and no error is not a rejection', () => {
  const rejectedWithKindOnly: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-kind-only',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'mcp.source': 'socrata',
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': '{"type":"query"}',
      'error.kind': 'unavailable',
    }),
  };
  const graph = buildProvenanceGraph(
    traceOf([rejectedWithKindOnly]),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const node = activityForSpan(graph['@graph'] as GraphNode[], 'span-kind-only');
  assert.ok(!hasKey(node, 'civic:failed'), 'a label with nothing to label is not an assertion of failure');
  assert.ok(!hasKey(node, 'civic:failureKind'), 'and the label alone is not stated either');
  assert.deepEqual(Object.keys(node), ACTIVITY_KEYS_0_3_1);
});

test('the description names no cause the span did not carry: raw text on the span reaches no node the builder derives from it', () => {
  // The reference producer stopped writing raw error text onto the span in
  // this same wave, precisely so it could not reach signed bytes. This
  // fixture puts it back — a hostname and a stack fragment, the shapes such
  // text actually carries — and demands the builder ignore it. Without the
  // fixture the assertion could only ever be green.
  const rawText = 'connect ECONNREFUSED mcp.unreachable.example:8443 at Socket.onError';
  const graph = buildProvenanceGraph(
    answeredAndRejectedTrace({ kind: 'unavailable', rawText }),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const derived = nodesDerivedFromToolSpan(graph['@graph'], BASE_INPUT.packageId, 'span-rejected');
  for (const node of derived) {
    assert.ok(
      !JSON.stringify(node).includes('mcp.unreachable.example'),
      `${node['@id']}: a node derived from the span names a host out of the source's raw text`,
    );
    assert.ok(
      !JSON.stringify(node).includes('ECONNREFUSED'),
      `${node['@id']}: a node derived from the span carries the source's raw text`,
    );
  }
  const activity = activityForSpan(graph['@graph'] as GraphNode[], 'span-rejected');
  assert.equal(
    activity['dcterms:description'],
    'MCP tool call: get_data (query)',
    'the description states what the call WAS; the cause is stated by the classified kind and by nothing else',
  );
  assert.equal(activity['civic:failureKind'], 'unavailable', 'the classified kind is the only cause on the node');
});

test('byte stability: the golden trace carries no rejected call, so its five tool-call activities are what an unconditional marker would move', () => {
  // This names the driving fixture for the byte-stability criterion. The
  // golden-parity tests at the top of this file compare the whole graph
  // against `website-golden.json` byte for byte; an unconditional
  // `civic:failed: false` would add a key to each of these five activities and
  // turn every one of them, and all eight golden-reproduction cases, red.
  const goldenToolSpans = (FIXTURE.trace.resourceSpans[0].scopeSpans[0].spans as SpanStub[]).filter(
    (s) => s.name === 'mcp_tool_call',
  );
  assert.equal(goldenToolSpans.length, 5, 'the golden trace has five tool spans');
  for (const span of goldenToolSpans) {
    assert.ok(
      !span.attributes.some((a) => a.key === 'error' || a.key === 'error.kind'),
      'no golden tool span carries a failure — this fixture can only exercise the unmarked path',
    );
  }

  const graph = buildProvenanceGraph(
    FIXTURE.trace,
    FIXTURE.provenanceInput,
    PRIOR_ERA_REFERENCE_CONFIG,
  );
  const activities = (graph['@graph'] as GraphNode[]).filter((n) => n['@id'].includes(':tool-call:'));
  assert.equal(activities.length, 5);
  for (const activity of activities) {
    assert.ok(!hasKey(activity, 'civic:failed'), `${activity['@id']}: no failure was recorded, so no key is emitted`);
    assert.ok(!hasKey(activity, 'civic:failureKind'), `${activity['@id']}: and no kind either`);
  }
  assert.equal(
    JSON.stringify(graph),
    JSON.stringify(LIFTED_FIXTURE_GRAPH),
    'a trace that records no failure reproduces the reference bytes exactly',
  );
});

// --- The two names the graph carries (Wave N10 P-H3, civic-ai-tools#194) ---
//
// #194 asks that the data-response description name a source the way a reader
// would name it ("Data response from Socrata") rather than by the agent that
// answered ("Data response from Socrata MCP Server"). The registry already
// carries both names — `displayName` beside `agentTitle` — so the change is
// three characters of the prefix expression. It is NOT made here: the
// description is inside `website-golden.json`'s frozen bytes on the
// agent-title branch, so the change moves golden bytes, and whether those
// bytes move is the owner's ruling and not this file's. The two instruments
// below hold the constraint that survives either ruling and measure exactly
// what is at stake.

test('the agent node states the AGENT, by its registry title — the reader-facing name reaches no node here', () => {
  // Non-vacuity: this can only catch a change because the registry's two
  // names differ for this source. A builder that read `displayName` for the
  // agent node would emit "Socrata" and fail — and those are signed bytes in
  // both golden fixtures.
  assert.notEqual(
    CIVIC_SOURCE_REGISTRY.socrata.displayName,
    CIVIC_SOURCE_REGISTRY.socrata.agentTitle,
    'the fixture is shaped so it cannot fail unless the registry carries two distinct names',
  );
  const graph = buildProvenanceGraph(
    traceOf([skillSpan('a0b1c2'), toolSpan('socrata', 'get_data', 'span-agent-title')]),
    BASE_INPUT,
    CIVICAITOOLS_PROVENANCE_CONFIG,
  );
  const agent = (graph['@graph'] as GraphNode[]).find(
    (n) => n['@id'] === 'urn:civic-record:mcp-server:socrata',
  );
  assert.ok(agent, 'the socrata MCP agent node is expected');
  assert.equal(agent!['dcterms:title'], 'Socrata MCP Server');
  assert.equal(
    agent!['dcterms:title'],
    CIVIC_SOURCE_REGISTRY.socrata.agentTitle,
    'the agent node is titled by the registry `agentTitle`, and by nothing else',
  );
  assert.notEqual(
    agent!['dcterms:title'],
    CIVIC_SOURCE_REGISTRY.socrata.displayName,
    'the reader-facing name must not reach the agent node — it is inside both golden fixtures’ frozen signed bytes',
  );
});

test('byte stability: the golden graph carries two data-response descriptions on the agent-title branch — exactly the frozen bytes a reader-facing prefix would move', () => {
  // This names the driving fixture for #194's byte question, and it is able
  // to fail: it asserts the two frozen descriptions read as the registry's
  // AGENT TITLES today and would read as the registry's DISPLAY NAMES after
  // the change, on sources whose two names differ. The portal-branch response
  // and the unknown-source response are named too, as the bytes that must NOT
  // move under either ruling.
  const graph = buildProvenanceGraph(
    FIXTURE.trace,
    FIXTURE.provenanceInput,
    PRIOR_ERA_REFERENCE_CONFIG,
  );
  const responses = (graph['@graph'] as GraphNode[])
    .filter((n) => n['@id'].includes(':data:'))
    .map((n) => ({
      sourceId: n['civic:sourceId'] as string,
      description: n['dcterms:description'] as string,
    }));
  assert.equal(responses.length, 4, 'the golden trace yields four data responses');

  // The portal branch — untouched by #194 under any ruling.
  assert.deepEqual(
    responses.filter((r) => r.description.includes('.')),
    [{ sourceId: 'socrata', description: 'Data response from data.cityofnewyork.us' }],
    'exactly one response is described by the portal its span carried',
  );

  // The agent-title branch on a REGISTRY source: the two bytes at stake.
  const registryNamed = responses.filter((r) => CIVIC_SOURCE_REGISTRY[r.sourceId] !== undefined
    && !r.description.includes('.'));
  assert.deepEqual(
    registryNamed.map((r) => r.sourceId),
    ['data-commons', 'boston-opencontext'],
    'two golden responses are described by a registry source with no portal',
  );
  for (const r of registryNamed) {
    const info = CIVIC_SOURCE_REGISTRY[r.sourceId]!;
    assert.notEqual(info.displayName, info.agentTitle, `${r.sourceId}: the two registry names must differ for this to be a real measurement`);
    assert.equal(
      r.description,
      `Data response from ${info.agentTitle}`,
      `${r.sourceId}: the frozen byte reads by AGENT TITLE — reading \`displayName\` here is the #194 change, and it moves this line`,
    );
    assert.notEqual(
      r.description,
      `Data response from ${info.displayName}`,
      `${r.sourceId}: stated as the byte the change would write, so this instrument fails the day it does`,
    );
  }

  // An UNKNOWN source falls back to the raw id, and holds still under the
  // change as long as the prefix reads the registry rather than the
  // capitalising `displayNameForSource` helper.
  assert.deepEqual(
    responses.filter((r) => CIVIC_SOURCE_REGISTRY[r.sourceId] === undefined),
    [{ sourceId: 'euro stat', description: 'Data response from euro stat' }],
    'the unknown-source response states the raw source id',
  );
});

// --- Every `civic:` key the builder EMITS is a declared term (#199 §2) ---
//
// The third leg of the vocabulary guard. Two static legs live in
// purity.test.ts — no capture module may spell a literal the format group
// declares, and no capture module may spell a `civic:` term at all — and
// between them they can prove that capture/ contains no term literal. Neither
// can prove the other half: that the terms the builder actually PUTS IN A
// SIGNED GRAPH are the ones format/vocabulary.ts declares. Only a driven build
// can, so this one drives one.
//
// The universe on both sides is derived. The emitted side is every `civic:`
// key found by walking a graph built from a trace shaped to reach every
// branch that emits one; the declared side is every string export of
// format/vocabulary.ts whose VALUE starts with `civic:` — not a naming
// convention, not a list. A term added inline tomorrow appears on the emitted
// side and not the declared side; a term declared and emitted nowhere appears
// on the declared side and not the emitted side. Both are failures, and both
// name the term.

/** A trace shaped to reach every branch of the builder that emits a `civic:`
 *  key: a skill fetch (server URL override), an inference reporting both
 *  token counts, a dataset-keyed call that answered with rows and an elapsed,
 *  a call the source REFUSED that also reports its elapsed, and a synthesis. */
function everyCivicTermTrace(): Record<string, unknown> {
  const inference: SpanStub = {
    name: 'llm_inference',
    spanId: 'span-inference',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '1500000000',
    attributes: attrs({
      'gen_ai.inference_index': '0',
      'gen_ai.response.prompt_tokens': '1200',
      'gen_ai.response.completion_tokens': '340',
    }),
  };
  const answered: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-answered-all-terms',
    startTimeUnixNano: '1600000000',
    endTimeUnixNano: '2000000000',
    attributes: attrs({
      'mcp.source': 'socrata',
      'tool.name': 'get_data',
      'tool.operation_type': 'query',
      'tool.arguments': `{"type":"query","dataset_id":"${ANSWERED_DATASET}","portal":"${RUN_PORTAL}"}`,
      'tool.dataset_id': ANSWERED_DATASET,
      'tool.portal_domain': RUN_PORTAL,
      'tool.response_hash': 'a0b1c2',
      'tool.response_rows': '42',
      'tool.duration_ms': '850',
    }),
  };
  const rejected: SpanStub = {
    name: 'mcp_tool_call',
    spanId: 'span-rejected-all-terms',
    startTimeUnixNano: '2100000000',
    endTimeUnixNano: '2500000000',
    attributes: [
      ...attrs({
        'mcp.source': 'socrata',
        'tool.name': 'get_data',
        'tool.operation_type': 'query',
        'tool.arguments': `{"type":"query","dataset_id":"${REJECTED_DATASET}","portal":"${RUN_PORTAL}"}`,
        'tool.dataset_id': REJECTED_DATASET,
        'tool.portal_domain': RUN_PORTAL,
        'tool.duration_ms': REJECTED_DURATION_MS,
        'error.kind': 'timeout',
      }),
      { key: 'error', value: { boolValue: true } },
    ],
  };
  const synthesis: SpanStub = {
    name: 'synthesis',
    spanId: 'span-synthesis',
    startTimeUnixNano: '2600000000',
    endTimeUnixNano: '2700000000',
    attributes: [],
  };
  return traceOf([skillSpan('5f6e7d'), inference, answered, rejected, synthesis]);
}

/** Every `civic:` property key anywhere in a graph, nested nodes included. */
function civicKeysIn(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) civicKeysIn(item, into);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('civic:')) into.add(key);
      civicKeysIn(child, into);
    }
  }
  return into;
}

/** Every term format/vocabulary.ts declares, derived from the VALUES it
 *  exports rather than from the names it gives them. */
const DECLARED_TERMS = new Map<string, string>(
  Object.entries(vocabularyModule).flatMap(([name, value]) =>
    typeof value === 'string' && value.startsWith('civic:')
      ? [[name, value] as [string, string]]
      : [],
  ),
);

test('#199 §2 PREMISE: the driving trace reaches every term-emitting branch', () => {
  const emitted = civicKeysIn(
    buildProvenanceGraph(everyCivicTermTrace(), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG),
  );
  // Named individually because the value of the two assertions below is
  // entirely in this fixture reaching the branches. A trace that emitted three
  // keys would satisfy "every emitted key is declared" and prove nothing.
  for (const key of [
    'civic:contentHash',
    'civic:serverUrl',
    'civic:sourceId',
    'civic:url',
    'civic:promptTokens',
    'civic:completionTokens',
    'civic:toolName',
    'civic:operationType',
    'civic:datasetId',
    'civic:portalDomain',
    'civic:datasetUrl',
    'civic:croissantMetadataUrl',
    'civic:responseRows',
    'civic:durationMs',
    'civic:failed',
    'civic:failureKind',
  ]) {
    assert.ok(emitted.has(key), `the driving trace does not reach ${key} — the checks below cannot see it`);
  }
});

test('#199 §2: every `civic:` key a driven graph emits is a term declared in format/vocabulary.ts', () => {
  const emitted = [...civicKeysIn(
    buildProvenanceGraph(everyCivicTermTrace(), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG),
  )].sort();
  const declared = new Set(DECLARED_TERMS.values());
  const undeclared = emitted.filter((key) => !declared.has(key));
  assert.deepEqual(
    undeclared,
    [],
    `a signed graph states these keys and format/vocabulary.ts declares none of them: ${undeclared.join(', ')}. A \`civic:\` property name is the word a reader interprets — declare it beside the namespace that gives it meaning.`,
  );
});

test('#199 §2: every term format/vocabulary.ts declares is emitted by a driven graph', () => {
  const emitted = civicKeysIn(
    buildProvenanceGraph(everyCivicTermTrace(), BASE_INPUT, CIVICAITOOLS_PROVENANCE_CONFIG),
  );
  const unemitted = [...DECLARED_TERMS]
    .filter(([, term]) => !emitted.has(term))
    .map(([name, term]) => `${name} (${term})`);
  assert.deepEqual(
    unemitted,
    [],
    `declared as civic vocabulary and emitted by no build: ${unemitted.join(', ')}. Either the trace above stopped reaching the branch that emits it — in which case the two checks are weaker than they read — or the term has no producer and should not be in the vocabulary.`,
  );
});
