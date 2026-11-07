// The load span (CAPTURE group; ADR-0033 amendment 2). A `load_source` call is
// recorded as a tool span like any other (`mcp_tool_call`), with
// `tool.operation_type` `load_source`, one outcome attribute,
// `tool.load_outcome`, and, from harness 0.12.0, `tool.load_asked`, whether a
// question was put to the reader (ADR-0033 amendment 3). The instance's own loop handles the call and no source
// answers it, so the two builders that read tool spans treat it apart: the
// provenance graph mints no source agent and no data-response entity for it,
// and the dataSources population skips it in place.
//
// This module is not part of the package's entry; the civic layer re-exports
// what callers need (`LoadSpanError`).

/** The span attribute value that marks a load span. */
const LOAD_SOURCE_OPERATION_TYPE = 'load_source';

/** Does this span's `tool.operation_type` mark it as a load span? */
export function isLoadSpan(
  attributes: ReadonlyArray<{ key: string; value?: { stringValue?: string } }> | undefined,
): boolean {
  return attributes?.find((a) => a.key === 'tool.operation_type')?.value?.stringValue === LOAD_SOURCE_OPERATION_TYPE;
}

/** A load span whose `tool.load_outcome` is absent or outside the outcome
 *  set, or whose `tool.load_asked` is present and not a boolean (ADR-0033
 *  amendment 3): refused when the provenance graph is built, because the
 *  graph would otherwise state a load without saying how it ended, or state
 *  a question put (or not) that the producer did not state. */
export class LoadSpanError extends Error {
  /** The span's id. */
  readonly spanId: string;
  /** The outcome the span carried; `undefined` when it carried none. */
  readonly outcome: string | undefined;
  /** The attribute refused: `tool.load_outcome`, or `tool.load_asked`. */
  readonly attribute: 'tool.load_outcome' | 'tool.load_asked';
  constructor(
    spanId: string,
    outcome: string | undefined,
    outcomes: readonly string[],
    refused?: { loadAsked: unknown },
  ) {
    super(
      refused !== undefined
        ? `load span ${spanId}: tool.load_asked ${JSON.stringify(refused.loadAsked ?? null)} is not a boolean; a load span states true or false, or no tool.load_asked`
        : `load span ${spanId}: tool.load_outcome ${outcome === undefined ? 'is absent' : JSON.stringify(outcome)}`
          + `${outcome === undefined ? '' : ' is not one of the outcomes'}; a load span states one of ${outcomes.join(', ')}`,
    );
    this.name = 'LoadSpanError';
    this.spanId = spanId;
    this.outcome = outcome;
    this.attribute = refused !== undefined ? 'tool.load_asked' : 'tool.load_outcome';
  }
}
