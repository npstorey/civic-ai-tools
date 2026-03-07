# AGENTS.md

This file provides guidance to AI coding agents (GitHub Copilot, Cursor, Claude Code, etc.) when working with this repository.

## Project Overview

A standalone example for querying civic data using MCP servers:
- **Socrata MCP** - NYC Open Data (data.cityofnewyork.us) via Socrata API
- **Data Commons MCP** - Google Data Commons for statistical data

## Setup

Run `./scripts/setup.sh` to install dependencies and verify configuration.

See [docs/setup.md](docs/setup.md) for detailed instructions.

## MCP Configuration

| Tool | Config File |
|------|-------------|
| Claude Code CLI | `.mcp.json` |
| Cursor IDE | `.cursor/mcp.json` |
| VS Code / Copilot | `.vscode/mcp.json` |

## Socrata MCP Guidance

**For detailed query patterns, SoQL syntax, and domain-specific workarounds, read [`docs/opengov-skill.md`](docs/opengov-skill.md).**

Key points:
- Always discover columns first with `SELECT * LIMIT 1` for unfamiliar datasets
- Never hallucinate data - only report what queries return
- Check query complexity before large analyses
- NYC 311 dataset ID: `erm2-nwe9`
- Restaurant Inspections: `43nn-pn8j`
- Housing Violations: `wvxf-dwi5`

## Data Commons DCIDs

| City | DCID |
|------|------|
| NYC | `geoId/3651000` |
| Los Angeles | `geoId/0644000` |
| Chicago | `geoId/1714000` |

Common variables: `Count_Person`, `Median_Income_Person`, `Count_HousingUnit`

## Project Structure

```
civic-ai-tools/
├── scripts/           # Infrastructure scripts (setup.sh, proxy-wrapper.js)
├── examples/          # Demo scripts and sample analyses
│   ├── nyc_311_dashboard.py    # Streamlit dashboard
│   ├── mcp_demo.py             # Interactive MCP demo
│   └── REAL_DATA_ANALYSIS.md   # Sample results
├── docs/              # Documentation
│   └── opengov-skill.md        # OpenGov query patterns
└── visualizations/    # Generated charts and dashboards
```

## Running Examples

```bash
# Interactive MCP demo
python examples/mcp_demo.py

# Real data analysis
python examples/real_data_analysis.py

# Streamlit dashboard (311 data)
streamlit run examples/nyc_311_dashboard.py --server.headless=true
```

## Best Practices for Agents

1. **Data Queries**: Use the Socrata MCP tools to query NYC Open Data. Always check column names before building complex queries.

2. **SSL Issues**: In corporate environments, you may need `verify=False` for requests due to proxy SSL interception.

3. **Large Datasets**: NYC 311 has millions of records. Always use date filters and reasonable limits.

4. **Visualization**: Follow Tufte's principles - maximize data-ink ratio, avoid chartjunk, use direct labels.
