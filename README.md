# Civic AI Tools - Example Project

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/npstorey/civic-ai-tools)

A standalone example for querying NYC Open Data and Google Data Commons using MCP (Model Context Protocol) servers. Works with **Cursor IDE** and **Claude Code CLI**.

## Quick Start

### GitHub Codespaces (fastest)

Click the badge above to launch a Codespace. The dev container automatically runs `./scripts/setup.sh`, which builds the MCP servers and generates config files.

Once the Codespace is ready:
1. Open the Copilot Chat panel (the chat icon in the sidebar, or `Ctrl+Shift+I`)
2. Switch to **Agent** mode (dropdown at the top of the chat panel)
3. Start asking questions — MCP tools are available automatically

> **Copilot Chat timing out?** This is common on first load. Open the Command Palette (`Ctrl+Shift+P`) → "Developer: Reload Window" and wait for it to reconnect. You need a [GitHub Copilot](https://github.com/features/copilot) subscription (free tier works).

### Local setup

```bash
git clone https://github.com/npstorey/civic-ai-tools.git
cd civic-ai-tools
./scripts/setup.sh
```

The setup script automatically:
- Builds the OpenGov MCP server
- Installs Data Commons MCP
- Generates config files for VS Code, Cursor, and Claude Code

Then:
- **VS Code + Copilot**: Open the folder, reload window, use Copilot Chat in Agent mode
- **Cursor**: Open the folder in Cursor (restart Cursor if servers don't appear)
- **Claude Code**: Run `claude` and approve the MCP servers

See [SETUP.md](SETUP.md) for detailed instructions and troubleshooting.

## What's Included

**MCP Servers:**
- **OpenGov MCP** - Query NYC Open Data (311 complaints, restaurant inspections, housing violations, etc.)
- **Data Commons MCP** - Access Google Data Commons (population, income, demographics)

**Example Queries:**
- "What are the top 311 complaint types in NYC?"
- "Show me restaurant grades by borough"
- "Compare NYC's population with other major cities"

## Requirements

- Node.js 18+
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (recommended)

## Standalone Scripts

Several scripts can be run directly with [`uv`](https://docs.astral.sh/uv/getting-started/installation/) — no virtualenv or `requirements.txt` needed. Each script has inline [PEP 723](https://peps.python.org/pep-0723/) metadata so `uv` automatically installs the right dependencies in an isolated environment:

```bash
# Fetch and analyze live NYC Open Data + Data Commons data
uv run examples/real_data_analysis.py

# Generate matplotlib charts from analysis results
uv run examples/create_visualizations.py

# Generate an interactive HTML dashboard (no extra deps)
uv run examples/create_html_visualizations.py

# Launch a live Streamlit dashboard querying NYC 311 API
uv run examples/nyc_311_dashboard.py

# Launch the embedded-data Streamlit dashboard
uv run dashboard_311_dec2025.py
```

Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Documentation

- [SETUP.md](SETUP.md) - Complete setup instructions
- [docs/opengov-skill.md](docs/opengov-skill.md) - OpenGov query patterns and guidance
- [CLAUDE.md](CLAUDE.md) - Claude Code specific instructions
