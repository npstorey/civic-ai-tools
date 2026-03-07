# Civic AI Tools

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/npstorey/civic-ai-tools)

**Use AI to explore NYC Open Data and Google Data Commons — no advanced programming required.**

Civic AI Tools connects AI assistants (GitHub Copilot, Cursor, Claude Code) to public datasets using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Think of MCP as a universal adapter that lets AI talk directly to data sources — so you can ask questions in plain English and get answers from real civic data.

**Built for** civic technologists, government workers, journalists, and students exploring public data with AI.

## What can you do with this?

- Ask questions about NYC 311 complaints, restaurant inspections, or housing violations in plain English
- Pull population, income, and demographic data from Google Data Commons
- Generate visualizations and dashboards from live civic datasets
- Compare statistics across cities and time periods

**Example queries you can ask:**
- "What are the top 311 complaint types in NYC?"
- "Show me restaurant inspection grades by borough"
- "Compare NYC's population trend with Los Angeles and Chicago"

## Quick start

### Option 1: GitHub Codespaces (recommended — nothing to install)

1. Click the **"Open in GitHub Codespaces"** button above
2. Wait for the environment to build (everything is installed automatically)
3. Open **Copilot Chat** (sidebar chat icon or `Ctrl+Shift+I`), switch to **Agent** mode, and start asking questions

**Optional:** For higher rate limits, add Codespaces Secrets before launching:
- Go to your fork's **Settings > Secrets and variables > Codespaces**
- Add `SOCRATA_APP_TOKEN` ([get one free](https://data.cityofnewyork.us/profile/edit/developer_settings))
- Add `DC_API_KEY` ([get one free](https://apikeys.datacommons.org/)) — required for Data Commons

> Without API keys, NYC Open Data queries still work (with lower rate limits). Data Commons is skipped if no key is set.

### Option 2: Local setup

```bash
git clone https://github.com/npstorey/civic-ai-tools.git
cd civic-ai-tools
cp .env.example .env       # Add your API keys (see file for instructions)
./scripts/setup.sh         # Builds MCP servers and generates config files
```

Then open the project in your preferred tool:
- **VS Code + Copilot** — Reload window (`Ctrl+Shift+P` > "Developer: Reload Window"), use Copilot Chat in Agent mode
- **Cursor** — Open the folder in Cursor (restart if MCP servers don't appear)
- **Claude Code** — Run `claude` in this directory and approve the MCP servers when prompted

See [docs/setup.md](docs/setup.md) for detailed instructions and troubleshooting.

## What's included

| MCP Server | Data Source | What you can query |
|------------|-------------|-------------------|
| **Socrata MCP** | [NYC Open Data](https://data.cityofnewyork.us/) | 311 complaints, restaurant inspections, housing violations, traffic data, and 2,000+ other datasets |
| **Data Commons MCP** | [Google Data Commons](https://datacommons.org/) | Population, income, demographics, and other statistical indicators across cities, states, and countries |

## Requirements (local setup only)

- Node.js 18+
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (recommended) — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Example scripts

The `examples/` directory contains standalone scripts you can run directly with [`uv`](https://docs.astral.sh/uv/getting-started/installation/):

```bash
uv run examples/real_data_analysis.py         # Fetch and analyze live NYC + Data Commons data
uv run examples/nyc_311_dashboard.py          # Launch a Streamlit dashboard of 311 data
uv run examples/create_html_visualizations.py # Generate an interactive HTML dashboard
```

See [examples/README.md](examples/README.md) for the full list.

## Related projects

| Repository | Description |
|-----------|-------------|
| [socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server) | The MCP server that connects AI tools to Socrata open data portals. This repo uses it as a dependency. |
| [civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website) | Demo website at [civicaitools.org](https://civicaitools.org) — side-by-side comparison of AI with and without live data access |

## Documentation

- [docs/setup.md](docs/setup.md) — Complete setup, tool-specific instructions, and troubleshooting
- [docs/opengov-skill.md](docs/opengov-skill.md) — OpenGov query patterns and SoQL syntax reference

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines — there are ways to help even if you don't write code.

## Glossary

New to some of these terms? Here's a quick reference:

| Term | What it means |
|------|--------------|
| **Repo** (repository) | A folder of code hosted on GitHub that tracks changes over time |
| **Clone** | Download a copy of a repo to your computer |
| **MCP** | Model Context Protocol — a standard way for AI tools to connect to external data sources |
| **API** | Application Programming Interface — a way for programs to request data from a service |
| **API key** | A password-like string that identifies you when making API requests |
| **Codespace** | A cloud development environment that runs in your browser — no local setup needed |

## Disclaimer

This is a personal project and is not affiliated with, endorsed by, or representative of any employer or organization.
