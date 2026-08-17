// OTel-compatible trace capture (CAPTURE group) — types + TraceBuilder,
// relocated whole from civic-ai-tools-website `src/lib/evidence/trace.ts:1–199`
// per the S2 brief §1, with two changes:
//   - `hash()` is re-backed by the @noble/hashes SHA-256 that verify-core
//     implements and @typedstandards/produce-core re-exports (0.2.0), removing
//     the module's only `node:crypto` use — the harness is browser-safe.
//   - The resource/scope identity constants (`service.name`, scope
//     name/version, semconv version) are REQUIRED typed config inputs
//     (config-not-constants, S2 brief §2); the reference deployment's values
//     are exported as `CIVICAITOOLS_TRACE_CONFIG` for explicit use, never
//     applied as a default.
//
// Clock + RNG are INHERENT to capture (span timestamps and ids are what
// capture *is*): this module is the sanctioned exception to the package's
// determinism rule, and both are injectable for deterministic tests.

import { sha256Hex } from '@typedstandards/produce-core';

// --- Types (OTel-compatible trace format) ---

export interface SpanEvent {
  timeUnixNano: string;
  name: string;
  attributes: OTelAttribute[];
}

export interface OTelAttribute {
  key: string;
  value: { stringValue?: string; intValue?: string; boolValue?: boolean };
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number; // 1=INTERNAL, 2=SERVER, 3=CLIENT
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  attributes: OTelAttribute[];
  events: SpanEvent[];
  status: { code: number }; // 0=UNSET, 1=OK, 2=ERROR
}

export interface OTelTrace {
  resourceSpans: Array<{
    resource: {
      attributes: OTelAttribute[];
    };
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: Span[];
    }>;
  }>;
}

// --- Helpers ---

function toAttr(key: string, value: string | number | boolean): OTelAttribute {
  if (typeof value === 'number') {
    return { key, value: { intValue: String(value) } };
  }
  if (typeof value === 'boolean') {
    return { key, value: { boolValue: value } };
  }
  return { key, value: { stringValue: value } };
}

function attrsFromRecord(attrs?: Record<string, string | number | boolean>): OTelAttribute[] {
  if (!attrs) return [];
  return Object.entries(attrs).map(([k, v]) => toAttr(k, v));
}

/** SHA-256 hash of a string, returned as hex. Backed by @noble/hashes via
 *  verify-core — same digest bytes as `node:crypto`, browser-safe. */
export function hash(content: string): string {
  return sha256Hex(content);
}

// --- TraceBuilder configuration ---

/** Millisecond clock. Injectable for deterministic tests. */
export type TraceClock = () => number;

/** Cryptographically-random byte source. Injectable for deterministic
 *  tests. */
export type TraceRandomBytes = (byteLength: number) => Uint8Array;

/**
 * TraceBuilder identity + determinism inputs. The identity strings name the
 * capturing service, so they are per-instance config (config-not-constants);
 * the reference deployment's values are `CIVICAITOOLS_TRACE_CONFIG` below.
 * The identity fields are required; `now`/`randomBytes` are operational
 * fallbacks, not identity, and default to the runtime's clock and CSPRNG.
 */
export interface TraceBuilderConfig {
  /** OTel resource `service.name`. */
  serviceName: string;
  /** Instrumentation scope name. */
  scopeName: string;
  /** Scope version — also emitted as resource `service.version`. */
  scopeVersion: string;
  /** OTel semantic-conventions version advertised on the resource. */
  semconvVersion: string;
  /** Millisecond clock; defaults to `Date.now`. */
  now?: TraceClock;
  /** Random byte source for trace/span ids; defaults to the runtime's
   *  `crypto.getRandomValues` (Web Crypto — Node 18+ and every browser). */
  randomBytes?: TraceRandomBytes;
}

/** The civicaitools.org reference deployment's capture identity. Passed
 *  explicitly by the reference app — never applied as a default. */
export const CIVICAITOOLS_TRACE_CONFIG: TraceBuilderConfig = {
  serviceName: 'civic-ai-tools-website',
  scopeName: 'civic-ai-tools-evidence',
  scopeVersion: '0.1.0',
  semconvVersion: '1.30.0',
};

function defaultRandomBytes(byteLength: number): Uint8Array {
  const buf = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

// --- TraceBuilder ---

export class TraceBuilder {
  readonly traceId: string;
  readonly rootSpanId: string;
  private spans: Map<string, Span> = new Map();
  private readonly config: TraceBuilderConfig;
  private readonly now: TraceClock;
  private readonly randomBytes: TraceRandomBytes;

  constructor(config: TraceBuilderConfig) {
    this.config = config;
    this.now = config.now ?? Date.now;
    this.randomBytes = config.randomBytes ?? defaultRandomBytes;
    this.traceId = this.randomHex(16); // 128-bit
    this.rootSpanId = this.randomHex(8); // 64-bit
  }

  private randomHex(bytes: number): string {
    return Array.from(this.randomBytes(bytes), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  }

  private nowNano(): string {
    // millisecond precision expressed as nanoseconds string
    return `${this.now()}000000`;
  }

  /**
   * Start a new span. Returns the span ID.
   * If no parentSpanId is given, the span is parented to the root.
   */
  startSpan(
    name: string,
    parentSpanId?: string,
    attributes?: Record<string, string | number | boolean>,
  ): string {
    const spanId = this.randomHex(8);
    this.spans.set(spanId, {
      traceId: this.traceId,
      spanId,
      parentSpanId: parentSpanId ?? this.rootSpanId,
      name,
      kind: 1, // INTERNAL
      startTimeUnixNano: this.nowNano(),
      attributes: attrsFromRecord(attributes),
      events: [],
      status: { code: 0 },
    });
    return spanId;
  }

  /** End a span, optionally merging additional attributes. */
  endSpan(spanId: string, attributes?: Record<string, string | number | boolean>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.endTimeUnixNano = this.nowNano();
    if (attributes) {
      span.attributes.push(...attrsFromRecord(attributes));
    }
  }

  /** Record a point-in-time event within an existing span. */
  recordEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.events.push({
      timeUnixNano: this.nowNano(),
      name,
      attributes: attrsFromRecord(attributes),
    });
  }

  /**
   * Start the root span. Call this at the very beginning of the analysis.
   * The root span uses the pre-generated rootSpanId.
   */
  startRoot(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    this.spans.set(this.rootSpanId, {
      traceId: this.traceId,
      spanId: this.rootSpanId,
      // root has no parent
      name,
      kind: 2, // SERVER
      startTimeUnixNano: this.nowNano(),
      attributes: attrsFromRecord(attributes),
      events: [],
      status: { code: 0 },
    });
  }

  /** End the root span. */
  endRoot(attributes?: Record<string, string | number | boolean>): void {
    this.endSpan(this.rootSpanId, attributes);
  }

  /**
   * Finalize and return the complete trace as OTel-compatible JSON.
   * Any spans that were started but not ended are closed at finalize time.
   */
  finalize(): OTelTrace {
    const finalTime = this.nowNano();
    for (const span of this.spans.values()) {
      if (!span.endTimeUnixNano) {
        span.endTimeUnixNano = finalTime;
      }
    }

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              toAttr('service.name', this.config.serviceName),
              toAttr('service.version', this.config.scopeVersion),
              toAttr('telemetry.sdk.language', 'typescript'),
              toAttr('otel.semconv.version', this.config.semconvVersion),
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: this.config.scopeName,
                version: this.config.scopeVersion,
              },
              spans: Array.from(this.spans.values()),
            },
          ],
        },
      ],
    };
  }
}
