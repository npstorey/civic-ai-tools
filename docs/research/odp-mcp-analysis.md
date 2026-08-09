# odp-mcp Analysis: Pagination and Result Limit Patterns

*Research, not a decision. Captured March 2026; no follow-up work committed.*

Research for [civic-ai-tools#18](https://github.com/npstorey/civic-ai-tools/issues/18). Analyzed [socrata/odp-mcp](https://github.com/socrata/odp-mcp) (commit history as of March 2026).

## Result Size Limits

odp-mcp enforces hard limits in code via `src/limits.ts`:

| Parameter | Default | Maximum |
|-----------|---------|---------|
| Query limit | 500 rows | 5,000 rows |
| Preview limit | 50 rows | 5,000 rows |
| Offset | 0 | 50,000 |

All values are **clamped server-side** — even if the LLM requests 100,000 rows, the server silently caps at 5,000. This prevents runaway queries regardless of prompt quality.

**Comparison with our server:** Our socrata-mcp-server uses a single `get_data` tool with raw SoQL passthrough and no server-side clamping. The LLM can request any LIMIT. We rely on skill guidance to suggest reasonable ranges.

## Pagination Approach

**Offset/limit only** — no cursor-based pagination.

- `query_dataset` accepts `limit` (default 500, max 5000) and `offset` (max 50,000)
- To page through results, the LLM calls `query_dataset` repeatedly with increasing offsets
- The 50k offset cap means at most ~50,000 rows are accessible per query pattern (10 pages of 5000)
- No built-in "has more results" indicator — the LLM must infer pagination need from result count

**Implication:** With 5,000 max per call and 50,000 max offset, the effective ceiling is ~55,000 accessible rows per unique query. This is a reasonable guard for analytical queries while preventing the LLM from trying to download entire multi-million row datasets.

## LLM Guidance

odp-mcp provides **no separate system prompt, skill doc, or companion guidance**. All LLM-facing context comes through MCP tool descriptions:

- Tool descriptions are terse and functional: `"Run a SoQL query against a dataset with filtering, aggregation, and sorting."`
- `REQUIRED:` markers on essential parameters
- Explicit guidance in `selectFields` description: `"USE THIS for aggregations: [{column: 'amount', function: 'sum', alias: 'total'}]"`
- Limit descriptions include defaults and maxima: `"Rows to return (default 500, max 5000)"`

**Key difference:** Our project pairs the MCP server with detailed skill guidance (base.md) that teaches the LLM about query patterns, date ranges, domain-specific workarounds, and output formatting. odp-mcp has none of this — it relies entirely on the LLM's training knowledge of SoQL.

## Response Format

- All responses are serialized as JSON text (MCP SDK content typing requirement)
- `list_datasets` is notably different: it **enriches** each search result with full metadata + 10 preview rows per dataset, all in one response. This gives the LLM schema information without a separate metadata call.
- `query_dataset` returns raw JSON arrays (the Socrata API response)
- No summary statistics, record counts, or "more results available" metadata in responses

**Comparison:** Our `get_data` tool returns raw Socrata responses similarly. The `list_datasets` enrichment pattern is interesting — it reduces the number of round trips the LLM needs.

## Tool Architecture Comparison

| Feature | odp-mcp | Our socrata-mcp-server |
|---------|---------|----------------------|
| Tools | 4 (list, metadata, preview, query) | 3 (search, fetch, get_data) |
| Query interface | Structured (select/where/order/group params) | Raw SoQL string |
| SoQL safety | Server-side injection prevention + validation | Relies on LLM generating safe SoQL |
| Result clamping | Hard server-side limits | No clamping (guidance only) |
| Pagination | Built-in offset param (max 50k) | LLM manages via SoQL OFFSET |
| Auth | Per-call overrides (token/basic/bearer) | Server-level only |
| Skill guidance | None (tool descriptions only) | Detailed companion skill doc |

## Actionable Patterns We Could Adopt

### 1. Server-side result clamping (High priority)
Add hard limits to our server so no single query can return more than ~5,000 rows. This is a safety net regardless of how good the skill guidance is. Could be as simple as appending `LIMIT 5000` if no limit is present, or clamping any user-provided limit.

### 2. Structured query parameters (Medium priority)
odp-mcp's `selectFields` and `whereConditions` structured parameters prevent the LLM from writing raw SoQL, reducing both injection risk and syntax errors. We could add structured query support alongside our raw SoQL passthrough.

### 3. Enriched search results (Medium priority)
Their `list_datasets` returns metadata + 10 preview rows per result in one call. This reduces round trips when the LLM is exploring datasets. We could enrich our `search` results similarly.

### 4. Skill guidance for pagination (High priority, no server changes needed)
Add pagination guidance to base.md:
- Default to 500 rows for initial queries
- If results seem truncated, tell the user and offer to page
- For aggregation queries (COUNT, SUM, etc.), result size is usually small — no pagination needed
- Never try to fetch >5,000 rows in a single query

### 5. Preview tool with low default (Low priority)
Their separate `preview_dataset` (default 50 rows) is a clean pattern for schema discovery. We currently use `get_data` with `SELECT * LIMIT 1` for this.

### 6. SoQL injection prevention (Low priority for guidance, medium for server)
Their `soqlBuilder.ts` has comprehensive injection prevention: field validation, dangerous pattern detection, parameterized value handling. Worth adopting in the server itself, though our current approach (LLM writes raw SoQL, Socrata API validates) hasn't caused issues in practice.

---

## Issue Tracking

Recommendations 1, 3, and 4 have been turned into issues:
- [socrata-mcp-server#38](https://github.com/npstorey/socrata-mcp-server/issues/38) — Smart result limits (recommendation 1, refined: cap raw queries, allow unlimited aggregations)
- [civic-ai-tools#27](https://github.com/npstorey/civic-ai-tools/issues/27) — Pagination guidance (recommendation 4)
- [socrata-mcp-server#39](https://github.com/npstorey/socrata-mcp-server/issues/39) — Enriched search results (recommendation 3)

## Future Considerations (not yet tracked as issues)

**Structured query parameters (recommendation 2):** odp-mcp's structured `selectFields`/`whereConditions` approach prevents SoQL syntax errors and injection risk by having the server build the query from validated JSON params. Worth revisiting if we see a pattern of LLM-generated SoQL syntax errors in production. The tradeoff is added complexity in the tool schema and potentially limiting the expressiveness of what the LLM can query.

**SoQL injection prevention (recommendation 6):** odp-mcp's `soqlBuilder.ts` has thorough regex-based injection detection (`;`, `DROP`, `UNION`, `--` comments, hex-encoded strings). Socrata's API already rejects malformed queries, so this is defense-in-depth. Worth adding if we open the server to untrusted clients or if Socrata's validation proves insufficient. Low real-world risk currently.
