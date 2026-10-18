// Run-attribute extraction (ADR-0033 §D, §E): the facts the producer recorded
// on the trace's ROOT span at run time come back under the derivation's input
// names; an absent attribute is an absent field; a present attribute that is
// not the named shape is refused, never read as absent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TraceBuilder, type TraceBuilderConfig } from './trace.ts';
import { extractRunAttributes, RunAttributeError } from './run-attributes.ts';

// Fixture convention: seconds-scale clock, ids seeded in the hex-letter range.
function builder(): TraceBuilder {
  let tick = 1_000;
  let seed = 0xa0;
  const config: TraceBuilderConfig = {
    serviceName: 'test-service',
    scopeName: 'test-scope',
    scopeVersion: '0.0.0',
    semconvVersion: '1.30.0',
    now: () => (tick += 1),
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed++ & 0xff) | 0xa0),
  };
  return new TraceBuilder(config);
}

const SERVERS = [
  { url: 'https://socrata-mcp.example', name: 'socrata' },
  { url: 'https://boston-at-run.example', name: 'boston-opencontext' },
];
const TOOLS = [{ type: 'function', function: { name: 'socrata__get_data', parameters: { type: 'object' } } }];
const OFFERED = [{ sourceId: 'socrata', alias: 'socrata', reason: 'configured' }];
const COMPONENTS = [{ id: 'socrata', version: '0.9.2', guidanceHash: 'a0'.repeat(32), guidanceOrigin: 'endpoint' }];

function traceWithRoot(attrs: Record<string, string>): Record<string, unknown> {
  const tb = builder();
  tb.startRoot('analysis', { 'analysis.prompt_hash': 'ab', ...attrs });
  // A child span carrying a look-alike attribute: only the ROOT is read.
  const child = tb.startSpan('skill_fetch', undefined, { 'analysis.asserted_date': '1999-01-01' });
  tb.endSpan(child);
  tb.endRoot();
  return tb.finalize() as unknown as Record<string, unknown>;
}

test('ADR-0033: every run attribute on the root span comes back under its input name', () => {
  const extracted = extractRunAttributes(traceWithRoot({
    'analysis.asserted_date': '2026-10-15',
    'analysis.mcp_servers': JSON.stringify(SERVERS),
    'analysis.tool_definitions': JSON.stringify(TOOLS),
    'analysis.sources_offered': JSON.stringify(OFFERED),
    'analysis.components': JSON.stringify(COMPONENTS),
  }));
  assert.deepEqual(extracted, {
    assertedDate: '2026-10-15',
    runMcpServers: SERVERS,
    toolDefinitions: TOOLS,
    sourcesOffered: OFFERED,
    components: COMPONENTS,
  });
});

test('ADR-0033: an absent attribute is an absent field — a root span that carries none yields {}', () => {
  const extracted = extractRunAttributes(traceWithRoot({}));
  assert.deepEqual(extracted, {});
  assert.deepEqual(Object.keys(extractRunAttributes(traceWithRoot({ 'analysis.asserted_date': '2026-10-15' }))), ['assertedDate']);
  // A spanless trace, and a BlobRef trace's inspection view, yield {} too.
  assert.deepEqual(extractRunAttributes({ resourceSpans: [] }), {});
});

test('ADR-0033: a present attribute that is not the named shape is refused by name, never read as absent', () => {
  const cases: Array<[string, string]> = [
    ['analysis.mcp_servers', 'not json'],
    ['analysis.mcp_servers', '{"url":"https://a.example"}'],
    ['analysis.mcp_servers', '[{"name":"socrata"}]'],
    ['analysis.mcp_servers', '[{"url":"https://a.example","name":7}]'],
    ['analysis.tool_definitions', '[1,2]'],
    ['analysis.sources_offered', '[{"sourceId":"socrata","alias":"socrata"}]'],
    ['analysis.components', '[{"version":"1"}]'],
    ['analysis.components', '[{"id":"x","guidanceHash":5}]'],
  ];
  for (const [attribute, value] of cases) {
    assert.throws(
      () => extractRunAttributes(traceWithRoot({ [attribute]: value })),
      (e: unknown) => e instanceof RunAttributeError && e.attribute === attribute,
      `${attribute}=${value} was not refused`,
    );
  }
});

// --- ADR-0033 §E as amended 2026-10-18: analysis.flows_statement ---

const FLOWS = { url: 'https://instance.example/api/flows', hash: 'c4'.repeat(32), date: '2026-10-18' };

/** The extractor's output read by a field name its type may not declare yet. */
function flowsOf(trace: Record<string, unknown>): unknown {
  return (extractRunAttributes(trace) as { flowsStatement?: unknown }).flowsStatement;
}

test('ADR-0033 §E amended: analysis.flows_statement comes back as flowsStatement, one object of three strings', () => {
  assert.deepEqual(flowsOf(traceWithRoot({ 'analysis.flows_statement': JSON.stringify(FLOWS) })), FLOWS);
  // Shape, not policy: the forms of url, hash and date are the derivation's to refuse.
  const unchecked = { url: 'not a url', hash: 'XYZ', date: 'yesterday' };
  assert.deepEqual(flowsOf(traceWithRoot({ 'analysis.flows_statement': JSON.stringify(unchecked) })), unchecked);
  // Absent attribute, absent field.
  assert.equal(Object.prototype.hasOwnProperty.call(extractRunAttributes(traceWithRoot({})), 'flowsStatement'), false);
});

test('ADR-0033 §E amended: an analysis.flows_statement that is not one object of exactly three strings is refused', () => {
  const cases: Array<[string, string]> = [
    ['not JSON', 'https://instance.example/api/flows'],
    ['an array', JSON.stringify([FLOWS])],
    ['null', 'null'],
    ['a JSON string', JSON.stringify(JSON.stringify(FLOWS))],
    ['a missing field', JSON.stringify({ url: FLOWS.url, hash: FLOWS.hash })],
    ['a non-string field', JSON.stringify({ ...FLOWS, date: 20261018 })],
    ['a null field', JSON.stringify({ ...FLOWS, hash: null })],
    ['an extra field', JSON.stringify({ ...FLOWS, content: 'the statement itself' })],
  ];
  for (const [why, value] of cases) {
    assert.throws(
      () => extractRunAttributes(traceWithRoot({ 'analysis.flows_statement': value })),
      (e: unknown) => e instanceof RunAttributeError && e.attribute === 'analysis.flows_statement',
      `${why} (${value}) was not refused`,
    );
  }
});
