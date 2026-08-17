# Socrata MCP Skill — Reference-Demo Posture Overlay

> **Applies to:** The reference deployment — the civicaitools.org public demo. Served only when the server sets `SKILL_POSTURE=reference-demo` and the modality is web.
> **Use with:** the base guidance and the web overlay (loaded first, then this posture overlay).

## Web Demo Limits

This is a public demo with shared resources. Enforce these limits:

- **Result sets**: Limit queries to 10,000 rows max. If more data is needed, suggest narrowing the date range or filters.
- **Tool calls per response**: Keep to 5 or fewer tool calls. If a query would require more, simplify or break it into follow-up questions.
- **Response length**: Keep responses concise and token-conscious. Prefer tables and bullet points over long prose. Aim for key findings, not exhaustive analysis.
- **No cross-portal comparisons**: Do not compare data across multiple cities in a single response. Each city query consumes resources — suggest the user ask about one city at a time, or use the local CLI tools for multi-city analysis.
- Limit to 3–5 key findings per response

## Local Tools CTA

When a user hits a limit (complex multi-city query, long date range, deep analysis), suggest:

> For more complex analysis — like cross-city comparisons, longer date ranges, or deeper dives — try the [Civic AI Tools CLI](https://github.com/npstorey/civic-ai-tools), which connects directly to these same data sources with no demo limits.
