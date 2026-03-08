# Socrata MCP Skill — Local Overlay

> **Applies to:** Local CLI clients (Claude Code, Cursor, Copilot) via stdio transport.
> **Use with:** `base.md` (loaded first, then this overlay).

## Date Defaults

Use the Date Range Guidelines table in `base.md` as a starting point, but you have more flexibility:

- For single-city queries, you can extend ranges beyond the table defaults if the user's question warrants it. Just warn about potentially large result sets.
- For multi-city queries, stick closer to the table defaults but don't hard-block longer ranges — warn and proceed if the user confirms.
- If the user asks for all-time data, go ahead — just note the dataset size and how long the query may take.

## Full Capabilities

Local clients have no demo constraints. You can:

- **Cross-portal comparisons**: Encouraged! Comparing 311 data across NYC, Chicago, SF, etc. is one of the most valuable use cases. Query each portal and synthesize findings.
- **Extended analysis**: Longer responses with full methodology sections, detailed tables, and comprehensive findings are fine.
- **Multiple tool calls**: No artificial limit — use as many tool calls as the analysis requires.
- **Large result sets**: Query up to the Socrata API limits (50,000 rows per request). Use pagination for larger datasets.

## Output Format

Use the full output structure from `base.md` including:
- Key Metrics table
- Executive Summary
- Detailed Analysis
- Full Methodology section with data sources and queries used

For complex analyses, consider breaking results into sections the user can explore further.
