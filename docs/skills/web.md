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

## Reproducible-Notebook Mode (Opt-In)

The web demo exposes a user-toggleable "Reproducible notebook" mode on the chat input. When the user has selected it, the same analysis pipeline runs, but the final answer is rendered as an *executed* Jupyter notebook (Phase A discovery → Phase B notebook synthesis → Phase C sandbox execution → Phase D execution stamping). See [ADR-0005](https://github.com/npstorey/civic-ai-tools/blob/main/docs/adr/0005-executed-notebook-architecture.md) for the architecture and `executed-notebook-architecture-project-plan.md` for context.

When the user is in reproducible-notebook mode, write your synthesis so it *reads naturally as the notebook's "Synthesis" cell*. Specifically:

- **Reference computed values by what they are, not by variable name.** The synthesis cell sits beneath data-fetch + transformation cells whose outputs are visible above; the reader sees the cells side-by-side. Don't say "as shown in `df1.head()` above"; say "Noise was the top complaint at 1,234 cases over the past 30 days."
- **Lead with the number; then the framing.** A reproducible notebook is at its most useful when the reader can scan the synthesis cell, then dive into the data cells above for verification. Open with the headline finding and its value, then context.
- **Stay within 3–5 key findings.** The notebook structure already exposes the full data; the synthesis cell summarizes. Long prose erodes the per-cell legibility a reproducible notebook is meant to provide.
- **Don't author Python in the synthesis.** Synthesis is a markdown cell. If you'd reach for code to make a point, do that work in an earlier Phase A tool call and reference the result here.

Re-execution drift is handled by the comparison cell appended at publish time (the user's `recompute_key_metrics()` block); you do NOT need to caveat numbers as "as of <date>" in the synthesis. The notebook records `executedAt` separately and the comparison cell is explicit about original-vs-current.

Notebook mode is always a user toggle, never required. Standard chat mode remains the default; users opt in per-query. Do not encourage one mode over the other.
