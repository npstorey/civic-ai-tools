---
paths:
  - "examples/**"
---

# Python examples

These are demonstration scripts, not library code — they are read by newcomers deciding whether the
project is for them, so clarity beats cleverness.

**Querying.** The standing query discipline lives in `docs/skills/base.md` (Socrata) and
`docs/skills/data-commons.md` (Data Commons), and both are served verbatim to MCP clients, so treat
them as the source: discover columns before composing a query, search for a variable DCID before
fetching observations, and filter by date with an explicit limit on high-volume datasets. NYC 311 alone
adds roughly ten thousand rows a day. Curated dataset IDs are in `docs/datasets.md` — take them from
there rather than pasting one into a script from memory.

**Report only what a query returned.** These scripts are the demo surface for a project whose whole
argument is that an AI analysis should be inspectable; a plausible-looking number that no query
produced is the failure it exists to prevent.

**TLS.** If a corporate proxy intercepts TLS, use the proxy wrapper (`scripts/proxy-wrapper.js`, with
`.vscode/mcp.json.city-proxy-example` as the config template). Do not disable certificate verification
in an example script — a `verify=False` that ships is a pattern readers copy.

**Charts.** Maximise the data-ink ratio, label series directly instead of relying on a legend, and skip
decoration that carries no data. Generated output belongs in `visualizations/`, which is gitignored.
