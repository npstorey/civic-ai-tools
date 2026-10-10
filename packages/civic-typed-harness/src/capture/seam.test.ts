// The seam (civic-ai-tools#244 P2), driven: the capture builders run on
// inputs that are not civic at all. This file imports nothing from outside
// capture/, so it also shows the builders need nothing from format/ to run.
// The civic values reach them through src/civic/, whose output the golden
// suites pin; here a foreign term table, vocabulary, registry and
// dataset-keyed predicate go in, and only those come out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenanceGraphWith, type ProvenanceTerms } from './provenance.ts';
import { buildDataSourcesWith } from './data-sources.ts';

const TERMS: ProvenanceTerms = {
  contentHash: 'ex:contentHash',
  serverUrl: 'ex:serverUrl',
  sourceId: 'ex:sourceId',
  url: 'ex:url',
  promptTokens: 'ex:promptTokens',
  completionTokens: 'ex:completionTokens',
  toolName: 'ex:toolName',
  operationType: 'ex:operationType',
  datasetId: 'ex:datasetId',
  portalDomain: 'ex:portalDomain',
  datasetUrl: 'ex:datasetUrl',
  croissantMetadataUrl: 'ex:croissantMetadataUrl',
  responseRows: 'ex:responseRows',
  durationMs: 'ex:durationMs',
  failed: 'ex:failed',
  failureKind: 'ex:failureKind',
};

const VOCABULARY = {
  context: () => ({ prov: 'http://www.w3.org/ns/prov#', ex: 'https://example.org/ns/' }),
  urn: (p: string, t: string, id: string) => `urn:ex:${p}:${t}:${id}`,
  modelUrn: (m: string) => `urn:ex:model:${m}`,
  sourceAgentUrn: (s: string) => `urn:ex:source:${s}`,
  platformUrn: (p: string) => `urn:ex:platform:${p}`,
};

function attr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

/** One skill fetch, one inference and one tool call that reaches every
 *  term-keyed branch: a refused call with a duration, a dataset-keyed source
 *  with a dataset id and a portal, and a row count. */
const TRACE = {
  resourceSpans: [
    {
      scopeSpans: [
        {
          spans: [
            { name: 'skill_fetch', spanId: 'a1', attributes: [attr('skill.text_hash', 'aa')] },
            {
              name: 'llm_inference',
              spanId: 'b1',
              startTimeUnixNano: '1000000000',
              endTimeUnixNano: '2000000000',
              attributes: [
                attr('gen_ai.response.prompt_tokens', '10'),
                attr('gen_ai.response.completion_tokens', '20'),
              ],
            },
            {
              name: 'mcp_tool_call',
              spanId: 'c1',
              startTimeUnixNano: '3000000000',
              endTimeUnixNano: '4000000000',
              attributes: [
                attr('tool.name', 'lookup'),
                attr('mcp.source', 'library'),
                attr('tool.operation_type', 'query'),
                attr('tool.response_hash', 'cc'),
                attr('tool.dataset_id', 'ds-1'),
                attr('tool.portal_domain', 'portal.example'),
                attr('tool.duration_ms', '5'),
                attr('tool.response_rows', '3'),
                { key: 'error', value: { boolValue: true } },
                attr('error.kind', 'timeout'),
              ],
            },
          ],
        },
      ],
    },
  ],
};

function build(isDatasetKeyed: (id: string) => boolean): string {
  return JSON.stringify(
    buildProvenanceGraphWith(
      TRACE,
      { packageId: 'pkg', promptHash: 'dd', outputText: 'out', model: 'model-x' },
      {
        platformAgent: { id: 'plat', title: 'Platform', url: 'https://platform.example' },
        sourceRegistry: { library: { agentTitle: 'Library Server', serverUrl: 'https://library.example' } },
        isDatasetKeyed,
        fallbackSourceId: 'library',
        skillSourceId: 'library',
        vocabulary: VOCABULARY,
        terms: TERMS,
      },
    ),
  );
}

test('seam: the provenance builder keys every property with the terms it is given, and spells no civic term of its own', () => {
  const json = build(() => true);
  assert.ok(!json.includes('civic'), 'the graph built from foreign inputs carries a civic string');
  for (const term of Object.values(TERMS)) {
    assert.ok(json.includes(`"${term}":`), `${term} is not a key of the graph`);
  }
  assert.ok(json.includes('"urn:ex:source:library"'), 'the vocabulary supplied is not the one emitted');
});

test('seam: the provenance builder takes the dataset-keyed fact from its caller', () => {
  const json = build(() => false);
  for (const term of [TERMS.datasetId, TERMS.portalDomain, TERMS.datasetUrl, TERMS.croissantMetadataUrl]) {
    assert.ok(!json.includes(`"${term}":`), `${term} was emitted for a source the caller says is not dataset-keyed`);
  }
});

test('seam: data-source population runs on a caller registry, resolver and dataset-keyed predicate', () => {
  const registry = {
    library: { catalogType: 'lib' },
    aggregate: { catalogType: 'agg', aggregatePortalUrl: 'https://aggregate.example' },
  };
  const calls = [
    { name: 'lookup', args: { dataset_id: 'ds-1', portal: 'portal.example' } },
    { name: 'summarise', args: {} },
  ];
  const resolver = (name: string) => (name === 'lookup' ? 'library' : 'aggregate');
  const keyed = buildDataSourcesWith(calls, {}, 'now', {
    resolver,
    registry,
    fallbackSourceId: 'library',
    isDatasetKeyed: (id) => id === 'library',
  });
  assert.deepEqual(keyed, [
    {
      sourceId: 'library',
      catalogType: 'lib',
      portalUrl: 'https://portal.example',
      datasetId: 'ds-1',
      datasetUrl: 'https://portal.example/d/ds-1',
      accessTimestamp: 'now',
    },
    { sourceId: 'aggregate', catalogType: 'agg', portalUrl: 'https://aggregate.example', accessTimestamp: 'now' },
  ]);
  const notKeyed = buildDataSourcesWith(calls, {}, 'now', {
    resolver,
    registry,
    fallbackSourceId: 'library',
    isDatasetKeyed: () => false,
  });
  assert.deepEqual(notKeyed.map((e) => e.sourceId), ['aggregate']);
});
