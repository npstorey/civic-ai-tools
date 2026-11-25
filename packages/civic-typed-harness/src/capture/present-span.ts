// The present span (CAPTURE group; ADR-0033 amendment 6). A `present_result`
// call is the producer's own step in a run asked in an output format: the
// model names which result of the run to present, and which of its columns
// labels each row, as identifiers in the call's arguments (`{ result, label }`,
// in `tool.arguments` as every call's are), and the producer answers the call
// itself. It is recorded as a tool span like any other (`mcp_tool_call`), with
// `tool.operation_type` `present_result` and one outcome attribute,
// `tool.present_outcome`: `accepted` when the producer took the result and the
// label the call named, `refused` when a value the call named was not one the
// producer could check against the run's results. No source sees the call, so
// the builders that read tool spans treat it as they treat a load span and a
// search span: the provenance graph mints no source agent and no
// data-response entity for it, and the dataSources population skips it in
// place. A present span that carries a failure or a source's, a server's or a
// pack's attribute is refused: no source, server or pack took part in it.
//
// The harness does not check the arguments against the run's results: the
// results are not in the trace, and checking them is the producer's step.
//
// This module is not part of the package's entry; the civic layer re-exports
// what callers need (`PresentSpanError`).

/** The span attribute value that marks a present span. */
const PRESENT_RESULT_OPERATION_TYPE = 'present_result';

/** The two outcomes of a present span, in that order: `accepted`, the
 *  producer took the result and the label the call named; `refused`, a value
 *  the call named was not one it could check against the run's results. The
 *  format group declares the same pair as `PRESENT_OUTCOMES` for callers. */
const PRESENT_SPAN_OUTCOMES: readonly string[] = ['accepted', 'refused'];

/** The attributes a present span must not carry: a failure, and the
 *  attributes that name a source, a server, an alias, a pack or a wire name.
 *  `error` is refused only when it is the boolean `true`. */
const REFUSED_ON_A_PRESENT_SPAN = ['error', 'mcp.source', 'mcp.server.id', 'mcp.alias', 'mcp.pack_id', 'tool.upstream_name'] as const;

/** Does this span's `tool.operation_type` mark it as a present span? */
export function isPresentSpan(
  attributes: ReadonlyArray<{ key: string; value?: { stringValue?: string } }> | undefined,
): boolean {
  return attributes?.find((a) => a.key === 'tool.operation_type')?.value?.stringValue === PRESENT_RESULT_OPERATION_TYPE;
}

/** The attribute a present span's refusal names. */
export type PresentSpanAttribute =
  | 'tool.present_outcome'
  | 'error'
  | 'mcp.source'
  | 'mcp.server.id'
  | 'mcp.alias'
  | 'mcp.pack_id'
  | 'tool.upstream_name';

/** A present span that does not state how the step ended, or states a
 *  participant that took no part in it (ADR-0033 amendment 6): its
 *  `tool.present_outcome` is absent, not a string, or neither `accepted` nor
 *  `refused`; or it carries `error: true`, `mcp.source`, `mcp.server.id`,
 *  `mcp.alias`, `mcp.pack_id` or `tool.upstream_name`. Refused when the
 *  provenance graph is built, before any node. */
export class PresentSpanError extends Error {
  /** The span's id. */
  readonly spanId: string;
  /** The attribute refused. */
  readonly attribute: PresentSpanAttribute;
  constructor(spanId: string, attribute: PresentSpanAttribute, problem: string) {
    super(
      `present span ${spanId}: ${attribute} ${problem}; a present span states its outcome (accepted or refused)`
        + ' as a string, and no failure, source, server, alias, pack or wire name',
    );
    this.name = 'PresentSpanError';
    this.spanId = spanId;
    this.attribute = attribute;
  }
}

/** What a present span states: its outcome. */
export interface PresentSpanReading {
  outcome: string;
}

type SpanAttributes = ReadonlyArray<{ key: string; value?: { stringValue?: string; boolValue?: boolean } }>;

/** Read a present span's outcome, or refuse the span with
 *  `PresentSpanError` (ADR-0033 amendment 6). The outcome is read from its
 *  `stringValue` only: an outcome written in another value shape, or with
 *  none, is not a string and is refused, never read as absent. */
export function readPresentSpan(spanId: string, attributes: SpanAttributes): PresentSpanReading {
  // What no source, server or pack took part in, the span must not say one did.
  for (const key of REFUSED_ON_A_PRESENT_SPAN) {
    const attribute = attributes.find((a) => a.key === key);
    if (attribute === undefined) continue;
    if (key === 'error') {
      if (attribute.value?.boolValue === true) {
        throw new PresentSpanError(spanId, 'error', 'is true; no source received a present_result call, so none failed it');
      }
      continue;
    }
    throw new PresentSpanError(spanId, key, 'is present; no source, server or pack took part in a present_result call');
  }

  const outcomeAttribute = attributes.find((a) => a.key === 'tool.present_outcome');
  if (outcomeAttribute === undefined) {
    throw new PresentSpanError(spanId, 'tool.present_outcome', 'is absent');
  }
  const outcome = outcomeAttribute.value?.stringValue;
  if (typeof outcome !== 'string' || !PRESENT_SPAN_OUTCOMES.includes(outcome)) {
    throw new PresentSpanError(spanId, 'tool.present_outcome', `${JSON.stringify(outcome ?? null)} is not one of ${PRESENT_SPAN_OUTCOMES.join(', ')}`);
  }
  return { outcome };
}
