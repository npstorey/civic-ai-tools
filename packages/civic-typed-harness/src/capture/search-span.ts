// The search span (CAPTURE group; ADR-0033 amendment 5). A `find_source` call
// is recorded as a tool span like any other (`mcp_tool_call`), with
// `tool.operation_type` `find_source` and three attributes:
// `tool.search_outcome`, `searched` when the instance ran the search or
// `limit-reached` when it stopped the call at its limit and ran none;
// `tool.search_query`, the query as the model sent it; and, on a span whose
// outcome is `searched` only, `tool.search_hits`, JSON text of an array of the
// hits' source ids, in rank order. The instance's own loop answers the call
// and no source sees it, so the builders that read tool spans treat it as
// they treat a load span: the provenance graph mints no source agent and no
// data-response entity for it, and the dataSources population skips it in
// place. A search span that carries a failure or a source's, a server's or a
// pack's attribute is refused: no source, server or pack took part in it.
//
// This module is not part of the package's entry; the civic layer re-exports
// what callers need (`SearchSpanError`).

/** The span attribute value that marks a search span. */
const FIND_SOURCE_OPERATION_TYPE = 'find_source';

/** The two outcomes of a search span, in that order: `searched`, the
 *  instance ran the search; `limit-reached`, it stopped the call at its limit
 *  and ran no search. The format group declares the same pair as
 *  `SEARCH_OUTCOMES` for callers. */
const SEARCH_SPAN_OUTCOMES: readonly string[] = ['searched', 'limit-reached'];

/** The attributes a search span must not carry: a failure, and the
 *  attributes that name a source, a server, an alias, a pack or a wire name.
 *  `error` is refused only when it is the boolean `true`. */
const REFUSED_ON_A_SEARCH_SPAN = ['error', 'mcp.source', 'mcp.server.id', 'mcp.alias', 'mcp.pack_id', 'tool.upstream_name'] as const;

/** Does this span's `tool.operation_type` mark it as a search span? */
export function isSearchSpan(
  attributes: ReadonlyArray<{ key: string; value?: { stringValue?: string } }> | undefined,
): boolean {
  return attributes?.find((a) => a.key === 'tool.operation_type')?.value?.stringValue === FIND_SOURCE_OPERATION_TYPE;
}

/** The attribute a search span's refusal names. */
export type SearchSpanAttribute =
  | 'tool.search_outcome'
  | 'tool.search_query'
  | 'tool.search_hits'
  | 'error'
  | 'mcp.source'
  | 'mcp.server.id'
  | 'mcp.alias'
  | 'mcp.pack_id'
  | 'tool.upstream_name';

/** A search span that does not state what happened, or states something
 *  that did not happen (ADR-0033 amendment 5): its `tool.search_outcome` is
 *  absent or not `searched` or `limit-reached`; its `tool.search_query` is
 *  absent or not a string; on outcome `searched`, its `tool.search_hits` is
 *  absent or not JSON text of an array of non-empty strings with no id twice;
 *  on outcome `limit-reached`, it carries `tool.search_hits`; or it carries
 *  `error: true`, `mcp.source`, `mcp.server.id`, `mcp.alias`, `mcp.pack_id`
 *  or `tool.upstream_name`. Refused when the provenance graph is built. An
 *  empty hits array on outcome `searched` is a search that ran and returned
 *  none, and is not refused; nor is an empty query. */
export class SearchSpanError extends Error {
  /** The span's id. */
  readonly spanId: string;
  /** The attribute refused. */
  readonly attribute: SearchSpanAttribute;
  constructor(spanId: string, attribute: SearchSpanAttribute, problem: string) {
    super(
      `search span ${spanId}: ${attribute} ${problem}; a search span states its outcome (searched or limit-reached)`
        + ' and its query as strings, its hits on outcome searched only as JSON text of an array of distinct'
        + ' non-empty source ids in rank order, and no failure, source, server, alias, pack or wire name',
    );
    this.name = 'SearchSpanError';
    this.spanId = spanId;
    this.attribute = attribute;
  }
}

/** What a search span states: its outcome, the query, and, on outcome
 *  `searched` only, the hits' source ids in rank order. */
export interface SearchSpanReading {
  outcome: string;
  query: string;
  hits?: string[];
}

type SpanAttributes = ReadonlyArray<{ key: string; value?: { stringValue?: string; boolValue?: boolean } }>;

/** Read a search span's outcome, query and hits, or refuse the span with
 *  `SearchSpanError` (ADR-0033 amendment 5). Each string attribute is read
 *  from its `stringValue` only: an attribute written in another value shape,
 *  or with none, is not a string and is refused, never read as absent. */
export function readSearchSpan(spanId: string, attributes: SpanAttributes): SearchSpanReading {
  // What no source, server or pack took part in, the span must not say one did.
  for (const key of REFUSED_ON_A_SEARCH_SPAN) {
    const attribute = attributes.find((a) => a.key === key);
    if (attribute === undefined) continue;
    if (key === 'error') {
      if (attribute.value?.boolValue === true) {
        throw new SearchSpanError(spanId, 'error', 'is true; no source received a find_source call, so none failed it');
      }
      continue;
    }
    throw new SearchSpanError(spanId, key, 'is present; no source, server or pack took part in a find_source call');
  }

  const outcomeAttribute = attributes.find((a) => a.key === 'tool.search_outcome');
  if (outcomeAttribute === undefined) {
    throw new SearchSpanError(spanId, 'tool.search_outcome', 'is absent');
  }
  const outcome = outcomeAttribute.value?.stringValue;
  if (typeof outcome !== 'string' || !SEARCH_SPAN_OUTCOMES.includes(outcome)) {
    throw new SearchSpanError(spanId, 'tool.search_outcome', `${JSON.stringify(outcome ?? null)} is not one of ${SEARCH_SPAN_OUTCOMES.join(', ')}`);
  }

  const query = attributes.find((a) => a.key === 'tool.search_query');
  if (query === undefined) {
    throw new SearchSpanError(spanId, 'tool.search_query', 'is absent');
  }
  const queryText = query.value?.stringValue;
  if (typeof queryText !== 'string') {
    throw new SearchSpanError(spanId, 'tool.search_query', 'is not a string');
  }

  const hitsAttribute = attributes.find((a) => a.key === 'tool.search_hits');
  if (outcome === 'limit-reached') {
    // No search ran, so nothing was returned: hits here would state a result.
    if (hitsAttribute !== undefined) {
      throw new SearchSpanError(spanId, 'tool.search_hits', 'is present on outcome limit-reached; no search ran');
    }
    return { outcome, query: queryText };
  }
  if (hitsAttribute === undefined) {
    throw new SearchSpanError(spanId, 'tool.search_hits', 'is absent on outcome searched');
  }
  const text = hitsAttribute.value?.stringValue;
  if (typeof text !== 'string') {
    throw new SearchSpanError(spanId, 'tool.search_hits', 'is not text');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SearchSpanError(spanId, 'tool.search_hits', 'is not JSON text');
  }
  if (!Array.isArray(parsed)) {
    throw new SearchSpanError(spanId, 'tool.search_hits', 'is not a JSON array');
  }
  const seen = new Set<string>();
  parsed.forEach((hit, i) => {
    if (typeof hit !== 'string') {
      throw new SearchSpanError(spanId, 'tool.search_hits', `entry ${i} is not a string`);
    }
    if (hit.length === 0) {
      throw new SearchSpanError(spanId, 'tool.search_hits', `entry ${i} is the empty string`);
    }
    if (seen.has(hit)) {
      throw new SearchSpanError(spanId, 'tool.search_hits', `entry ${i} names ${JSON.stringify(hit)} a second time`);
    }
    seen.add(hit);
  });
  return { outcome, query: queryText, hits: parsed as string[] };
}
