// TraceBuilder tests: injectable clock/RNG (determinism), config-not-constants
// for the resource/scope identity, the noble-backed hash(), and the OTel
// trace shape the reference implementation emitted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  TraceBuilder,
  hash,
  CIVICAITOOLS_TRACE_CONFIG,
  type TraceBuilderConfig,
} from './trace.ts';

// Fixture convention: synthetic timestamps stay under 13 digits and seeded
// ids start in the hex-letter range (0xa0…) so no fixture value can
// pattern-match as a payment-card-shaped digit run in pre-push sensitivity scans.

/** Deterministic RNG: counts up from 0xa0 so ids are distinct, stable, and
 *  always contain hex letters. */
function seededBytes(): (n: number) => Uint8Array {
  let counter = 0xa0;
  return (n: number) => {
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = (counter + i) % 256;
    counter += n;
    return buf;
  };
}

function deterministicConfig(overrides: Partial<TraceBuilderConfig> = {}): TraceBuilderConfig {
  let t = 100000; // ms clock seed — nano strings stay 12 digits
  return {
    ...CIVICAITOOLS_TRACE_CONFIG,
    now: () => t++,
    randomBytes: seededBytes(),
    ...overrides,
  };
}

test('hash() matches node:crypto SHA-256 hex (noble backend is byte-identical)', () => {
  for (const input of ['', 'hello world', 'civic-typed-harness é中文']) {
    const expected = crypto.createHash('sha256').update(input).digest('hex');
    assert.equal(hash(input), expected);
  }
});

test('injected clock + RNG make the whole trace deterministic', () => {
  const build = () => {
    const tb = new TraceBuilder(deterministicConfig());
    tb.startRoot('analysis', { 'analysis.prompt_hash': 'abc' });
    const s1 = tb.startSpan('llm_inference', undefined, { 'gen_ai.inference_index': 0 });
    tb.recordEvent(s1, 'first_token');
    tb.endSpan(s1, { 'gen_ai.response.completion_tokens': 42 });
    const s2 = tb.startSpan('mcp_tool_call');
    tb.endSpan(s2);
    tb.endRoot();
    return tb.finalize();
  };
  const a = build();
  const b = build();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('trace/span ids come from the injected RNG (128-bit trace, 64-bit spans)', () => {
  const tb = new TraceBuilder(deterministicConfig());
  assert.equal(tb.traceId, 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf');
  assert.equal(tb.rootSpanId, 'b0b1b2b3b4b5b6b7');
  assert.equal(tb.traceId.length, 32);
  assert.equal(tb.rootSpanId.length, 16);
});

test('timestamps come from the injected clock, as ms-precision nano strings', () => {
  const config = deterministicConfig();
  const tb = new TraceBuilder(config);
  tb.startRoot('analysis');
  const spanId = tb.startSpan('llm_inference');
  tb.endSpan(spanId);
  const otel = tb.finalize();
  const spans = otel.resourceSpans[0].scopeSpans[0].spans;
  const root = spans.find((s) => s.spanId === tb.rootSpanId)!;
  assert.equal(root.startTimeUnixNano, '100000000000');
  const child = spans.find((s) => s.spanId === spanId)!;
  assert.equal(child.startTimeUnixNano, '100001000000');
  assert.equal(child.endTimeUnixNano, '100002000000');
});

test('resource + scope identity comes from config (demo defaults preserved)', () => {
  const tb = new TraceBuilder(deterministicConfig());
  const otel = tb.finalize();
  const resourceAttrs = Object.fromEntries(
    otel.resourceSpans[0].resource.attributes.map((a) => [a.key, a.value.stringValue]),
  );
  assert.equal(resourceAttrs['service.name'], 'civic-ai-tools-website');
  assert.equal(resourceAttrs['service.version'], '0.1.0');
  assert.equal(resourceAttrs['telemetry.sdk.language'], 'typescript');
  assert.equal(resourceAttrs['otel.semconv.version'], '1.30.0');
  assert.deepEqual(otel.resourceSpans[0].scopeSpans[0].scope, {
    name: 'civic-ai-tools-evidence',
    version: '0.1.0',
  });
});

test('config injection: service.name and scope identity are per-instance inputs', () => {
  const tb = new TraceBuilder(
    deterministicConfig({
      serviceName: 'city-evidence-portal',
      scopeName: 'city-evidence-capture',
      scopeVersion: '2.0.0',
      semconvVersion: '1.31.0',
    }),
  );
  const otel = tb.finalize();
  const resourceAttrs = Object.fromEntries(
    otel.resourceSpans[0].resource.attributes.map((a) => [a.key, a.value.stringValue]),
  );
  assert.equal(resourceAttrs['service.name'], 'city-evidence-portal');
  assert.equal(resourceAttrs['service.version'], '2.0.0');
  assert.equal(resourceAttrs['otel.semconv.version'], '1.31.0');
  assert.deepEqual(otel.resourceSpans[0].scopeSpans[0].scope, {
    name: 'city-evidence-capture',
    version: '2.0.0',
  });
});

test('span parenting: default parent is the root span; kind codes match OTel', () => {
  const tb = new TraceBuilder(deterministicConfig());
  tb.startRoot('analysis');
  const s1 = tb.startSpan('llm_inference');
  const s2 = tb.startSpan('mcp_tool_call', s1);
  const otel = tb.finalize();
  const spans = otel.resourceSpans[0].scopeSpans[0].spans;
  const root = spans.find((s) => s.spanId === tb.rootSpanId)!;
  assert.equal(root.parentSpanId, undefined);
  assert.equal(root.kind, 2); // SERVER
  const first = spans.find((s) => s.spanId === s1)!;
  assert.equal(first.parentSpanId, tb.rootSpanId);
  assert.equal(first.kind, 1); // INTERNAL
  const second = spans.find((s) => s.spanId === s2)!;
  assert.equal(second.parentSpanId, s1);
});

test('finalize() closes any span that was never ended', () => {
  const tb = new TraceBuilder(deterministicConfig());
  tb.startRoot('analysis');
  tb.startSpan('llm_inference'); // never ended
  const otel = tb.finalize();
  for (const span of otel.resourceSpans[0].scopeSpans[0].spans) {
    assert.ok(span.endTimeUnixNano, `span ${span.name} should be closed at finalize`);
  }
});

test('attribute typing: numbers → intValue strings, booleans → boolValue', () => {
  const tb = new TraceBuilder(deterministicConfig());
  const s = tb.startSpan('llm_inference', undefined, {
    'tokens': 42,
    'cached': true,
    'model': 'openai/gpt-4o',
  });
  const otel = tb.finalize();
  const span = otel.resourceSpans[0].scopeSpans[0].spans.find((x) => x.spanId === s)!;
  const byKey = Object.fromEntries(span.attributes.map((a) => [a.key, a.value]));
  assert.deepEqual(byKey['tokens'], { intValue: '42' });
  assert.deepEqual(byKey['cached'], { boolValue: true });
  assert.deepEqual(byKey['model'], { stringValue: 'openai/gpt-4o' });
});

test('default construction (no injected clock/RNG) still produces well-formed ids', () => {
  const tb = new TraceBuilder();
  assert.match(tb.traceId, /^[0-9a-f]{32}$/);
  assert.match(tb.rootSpanId, /^[0-9a-f]{16}$/);
});
