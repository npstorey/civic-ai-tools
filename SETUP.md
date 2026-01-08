# Setup Guide

This guide walks you through setting up the civic-ai-tools-example project to work with **Cursor IDE** or **Claude Code CLI**.

## Quick Start

```bash
git clone https://github.com/npstorey/civic-ai-tools-example.git
cd civic-ai-tools-example
./scripts/setup.sh
```

The setup script will:
1. Check prerequisites (Node.js, Python 3.11+, git)
2. Clone and build the OpenGov MCP server into `.mcp-servers/`
3. Install the `datacommons-mcp` Python package via uv
4. Verify MCP configuration files

---

## Prerequisites

### Required

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runs opengov-mcp-server |
| npm | 8+ | Installs Node dependencies |
| Python | 3.11+ | Required by datacommons-mcp |
| git | any | Clones MCP server |

### Recommended

| Tool | Purpose |
|------|---------|
| [uv](https://github.com/astral-sh/uv) | Fast Python package manager |
| [Data Commons API Key](https://apikeys.datacommons.org/) | Higher rate limits |

Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Project Structure

After running setup:

```
civic-ai-tools-example/
├── .mcp-servers/
│   └── opengov-mcp-server/    # Cloned & built by setup script
├── .mcp.json                   # Claude Code CLI config
├── .cursor/
│   └── mcp.json               # Cursor IDE config
├── docs/
│   └── opengov-skill.md       # OpenGov query guidance
├── scripts/
│   ├── setup.sh               # Setup script
│   └── *.py                   # Demo scripts
└── CLAUDE.md                  # Claude Code instructions
```

---

## Tool-Specific Setup

### Cursor IDE

1. Run `./scripts/setup.sh`
2. Open this folder in Cursor
3. MCP servers load automatically from `.cursor/mcp.json`
4. Start asking questions about NYC data

### Claude Code CLI

1. Run `./scripts/setup.sh`
2. Start Claude Code:
   ```bash
   claude
   ```
3. On first run, approve the MCP servers when prompted
4. Verify servers are connected:
   ```
   /mcp
   ```

---

## MCP Servers

### OpenGov MCP Server

Provides access to NYC Open Data portal (data.cityofnewyork.us) via Socrata API.

**Capabilities:**
- Query datasets using SoQL
- Dataset discovery and metadata retrieval
- Built-in caching and rate limiting

**Key Datasets:**
| Dataset | ID | Description |
|---------|-----|-------------|
| 311 Service Requests | `erm2-nwe9` | Citywide service complaints |
| Restaurant Inspections | `43nn-pn8j` | Health inspection grades |
| Housing Violations | `wvxf-dwi5` | Building code violations |
| NYC Schools | `s3k6-pzi2` | School directory |
| Traffic Accidents | `h9gi-nx95` | Motor vehicle collisions |

### Data Commons MCP

Provides access to Google Data Commons for statistical data.

**Capabilities:**
- Search geographic entities (cities, states, countries)
- Retrieve statistical data across variables
- Compare data across locations

**Key Entity DCIDs:**
| City | DCID |
|------|------|
| New York City | `geoId/3651000` |
| Los Angeles | `geoId/0644000` |
| Chicago | `geoId/1714000` |

---

## Example Queries

Once set up, try these natural language queries:

### NYC Open Data
- "What are the top 10 complaint types in NYC 311?"
- "Show me restaurant inspection grades by borough"
- "Analyze housing violation trends over the past year"

### Statistical Data
- "What's NYC's population?"
- "Compare median income in NYC, LA, and Chicago"

### Combined Analysis
- "What's the relationship between median income and housing violations?"

---

## Running Demo Scripts

```bash
# Interactive MCP capabilities demo
python scripts/mcp_demo.py

# Real data analysis example
python scripts/real_data_analysis.py
```

---

## Environment Variables

Optional environment variables for enhanced functionality:

```bash
# Data Commons API key (recommended)
export DC_API_KEY='your-api-key'

# Socrata API token (optional, increases rate limits)
export SOCRATA_APP_TOKEN='your-token'
```

Get a Data Commons API key: https://apikeys.datacommons.org/

---

## Troubleshooting

### "MCP server not found"

1. Run the setup script:
   ```bash
   ./scripts/setup.sh
   ```
2. Verify the server exists:
   ```bash
   ls .mcp-servers/opengov-mcp-server/dist/index.js
   ```

### "datacommons-mcp: command not found"

1. Install it:
   ```bash
   uv tool install datacommons-mcp
   ```
2. Add `~/.local/bin` to your PATH if needed

### Claude Code doesn't show MCP tools

1. Restart Claude Code session
2. Check `/mcp` for server status
3. Approve project-scoped servers if prompted

### Cursor doesn't load MCP servers

1. Verify `.cursor/mcp.json` exists
2. Restart Cursor
3. Check Cursor's MCP settings panel

---

## Files Reference

| File | Purpose |
|------|---------|
| `.mcp.json` | MCP config for Claude Code CLI |
| `.cursor/mcp.json` | MCP config for Cursor IDE |
| `scripts/setup.sh` | Automated setup script |
| `docs/opengov-skill.md` | Detailed OpenGov query guidance |
| `CLAUDE.md` | Instructions for Claude Code |
