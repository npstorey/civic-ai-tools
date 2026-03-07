# Civic Data MCP Servers

A directory of MCP servers for accessing civic and public data. Servers marked **Included** are pre-configured in this repo's setup.

## Included in civic-ai-tools

| Server | Data Source | Transport | Maintainer | Notes |
|--------|------------|-----------|------------|-------|
| [socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server) | Socrata open data portals (NYC, Chicago, SF, etc.) | stdio, HTTP | [@npstorey](https://github.com/npstorey) | Pre-configured for NYC Open Data. Supports any Socrata portal. |
| [data-commons-mcp](https://github.com/datacommonsorg/data-commons-mcp) | Google Data Commons | stdio | Google | Population, income, demographics, and statistical indicators. Requires `DC_API_KEY`. |

## Other known servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [odp-mcp](https://github.com/socrata/odp-mcp) | Socrata open data portals | stdio | Socrata (Tyler Technologies) | Active | Official Socrata MCP server. Similar functionality to socrata-mcp-server. |

## Adding a server

Know of a civic data MCP server not listed here? Open an [issue](https://github.com/npstorey/civic-ai-tools/issues) or submit a pull request.

## Transport types

- **stdio** — Runs locally as a subprocess. Used by Claude Code, Cursor, and VS Code Copilot.
- **HTTP** — Runs as a web service. Used by web applications (e.g., [civicaitools.org](https://civicaitools.org)).
