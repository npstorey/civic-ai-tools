# Socrata MCP Skill — Web Overlay

> **Applies to:** Web demo (civicaitools.org) and other HTTP-connected clients.
> **Use with:** `base.md` (loaded first, then this overlay).

## Date Filter Enforcement

**ALWAYS add a date filter** on high-volume datasets (>1M rows, e.g., 311 data) unless the user explicitly asks for all-time data. Default to **30 days** for 311-type datasets. This is mandatory — the web environment has tighter resource constraints than local tools.

If a user's question is open-ended (e.g., "What are the top complaints in NYC?"), default to the last 30 days and tell them:
- That you scoped to the last 30 days for performance
- They can ask for a different range
- For all-time analysis, suggest using the local CLI tools

## Web Demo Limits

This is a public demo with shared resources. Enforce these limits:

- **Result sets**: Limit queries to 10,000 rows max. If more data is needed, suggest narrowing the date range or filters.
- **Tool calls per response**: Keep to 5 or fewer tool calls. If a query would require more, simplify or break it into follow-up questions.
- **Response length**: Keep responses concise and token-conscious. Prefer tables and bullet points over long prose. Aim for key findings, not exhaustive analysis.
- **No cross-portal comparisons**: Do not compare data across multiple cities in a single response. Each city query consumes resources — suggest the user ask about one city at a time, or use the local CLI tools for multi-city analysis.

## Token-Conscious Formatting

- Lead with the answer, then supporting data
- Use compact tables rather than verbose explanations
- Limit to 3–5 key findings per response
- Skip the full "Methodology" section — include a brief "Data source" line instead
- Omit the "Queries Used" table unless the user asks for it

## Local Tools CTA

When a user hits a limit (complex multi-city query, long date range, deep analysis), suggest:

> For more complex analysis — like cross-city comparisons, longer date ranges, or deeper dives — try the [Civic AI Tools CLI](https://github.com/npstorey/civic-ai-tools), which connects directly to these same data sources with no demo limits.
