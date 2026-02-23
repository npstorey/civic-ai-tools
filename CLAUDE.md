# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A standalone example for querying civic data using MCP servers:
- **OpenGov MCP** - NYC Open Data (data.cityofnewyork.us) via Socrata API
- **Data Commons MCP** - Google Data Commons for statistical data

## Setup

Run `./scripts/setup.sh` to install dependencies and verify configuration.

See [SETUP.md](SETUP.md) for detailed instructions.

## MCP Configuration

| Tool | Config File |
|------|-------------|
| Claude Code CLI | `.mcp.json` |
| Cursor IDE | `.cursor/mcp.json` |

## OpenGov MCP Guidance

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

## Related Repos

| Repo | Purpose |
|------|---------|
| [civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website) | Demo website at [civicaitools.org](https://civicaitools.org) — Next.js app with side-by-side MCP comparison |
| [opengov-mcp-server](https://github.com/npstorey/opengov-mcp-server) | The MCP server itself (Socrata/OpenGov data) |

Sprint-based work for the website lives in that repo's `/sprints/` folder. This repo holds MCP server configs, skill docs, and setup tooling.

## Running Scripts

```bash
python scripts/mcp_demo.py              # Interactive demo
python scripts/real_data_analysis.py    # Real data example
```
