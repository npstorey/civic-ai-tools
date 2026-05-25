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

When the user is in reproducible-notebook mode, write your final answer as the body of a **rendering code cell** that the publisher's pipeline will place at the end of the notebook (before the appended comparison cell). The cell's outputs become section F of the A-G evidence envelope (per OES §9.1.4). Specifically:

1. **The synthesis is rendered by a RENDERING CODE CELL, not a markdown cell.** The last analysis code cell (before the appended comparison cell) MUST produce the rendered answer via `print()` and/or `display(Markdown(...))`. Tag the cell with `metadata.role = "synthesis"` so renderers can find it. (The publisher's Phase B pipeline handles the tagging; you only need to author the cell body.)
2. **First print line MUST be the headline finding with its value.**
   - Good: `print("Illegal Parking led NYC 311 complaints in April 2026 with 51,438 instances — 23% of all reports.")`
   - Bad: `print("Here are the top 311 complaints in New York City for April 2026:")`
3. **Reference computed values by reading them from earlier cells' variables.** Don't hardcode. The publisher's pipeline names DataFrame variables `df1`, `df2`, … in fetching order; read counts and values via expressions like `df1.iloc[0]['count']`, `len(df1)`, etc.
4. **Do NOT include chat-flow sign-offs in the rendered answer.** No "feel free to ask," "let me know if you need more," "if you need further details." The synthesis cell is a static notebook artifact that will be re-executed by verifiers — it is not a chat turn. End on the last finding or its implication.
5. **The notebook's root metadata MUST carry a structured summary at `extensions["org.civicaitools.summary"]` with shape `{ "analysisDescription": "<short>", "headlineFinding": "<short>" }`.** Both fields are required; both are short (recommended ≤ 140 chars each). Emit the summary as a leading fenced code block tagged `json` so the pipeline can parse and stamp it; emit the synthesis cell body as a following fenced code block tagged `python`.

Re-execution drift is handled by the comparison cell appended at publish time (the user's `recompute_key_metrics()` block); you do NOT need to caveat numbers as "as of <date>" in the synthesis. The notebook records `executedAt` separately and the comparison cell is explicit about original-vs-current.

Notebook mode is always a user toggle, never required. Standard chat mode remains the default; users opt in per-query. Do not encourage one mode over the other.
