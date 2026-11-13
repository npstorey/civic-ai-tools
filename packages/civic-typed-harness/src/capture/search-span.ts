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
