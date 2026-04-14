# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A standalone example for querying civic data using MCP servers:
- **Socrata MCP** - NYC Open Data (data.cityofnewyork.us) via Socrata API
- **Data Commons MCP** - Google Data Commons for statistical data

## Strategic context — what not to include in this repo

This repo is public. Strategic and relationship context — specific external stakeholders, prospective collaborators, pre-meeting strategy, private outreach plans, named individuals' opinions or quotes — lives in local-only planning docs outside this repo (workspace `CLAUDE.md`, `ROADMAP.md`, per-user auto-memory), not here.

When contributing code, docs, commit messages, issue bodies, PR descriptions, or starter prompts for implementation chats that will commit to this repo, use neutral phrasing: "an external stakeholder," "an upcoming demo," "a follow-up meeting" — not specific names. If a task prompt you received includes strategic context, scrub it before producing any content destined for this repo.

## Setup

Run `./scripts/setup.sh` to install dependencies and verify configuration.

**When the setup script reports missing API keys**, you MUST:
1. Explain that the MCP tools require API keys to function (Data Commons won't work at all, Socrata can't return data)
2. Share the sign-up links from the script output for each missing key
3. Tell the user to open the `.env` file in the project folder and paste their keys there — do NOT ask them to paste API keys into this chat
4. Remind them that `.env` is a hidden file (Mac: Cmd+Shift+. in Finder; Windows: View > Show > Hidden items in File Explorer)
5. Tell them to let you know when they've added their keys so you can re-run `./scripts/setup.sh`
6. Mention that AI tools can read `.env` — these keys are low-risk (free public data APIs), but if they want to prevent it, they can add `{ "permissions": { "deny": ["Read(.env)"] } }` to `.claude/settings.local.json`

See [docs/setup.md](docs/setup.md) for detailed instructions.

## MCP Configuration

| Tool | Config File |
|------|-------------|
| Claude Code CLI | `.mcp.json` |
| Cursor IDE | `.cursor/mcp.json` |
| Codex CLI | `.codex/config.toml` |

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

## Related Repos

| Repo | Purpose |
|------|---------|
| [civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website) | Demo website at [civicaitools.org](https://civicaitools.org) — Next.js app with side-by-side MCP comparison |
| [socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server) | The MCP server itself (Socrata open data portals) |

Sprint-based work for the website lives in that repo's `/sprints/` folder. This repo holds MCP server configs, skill docs, and setup tooling.

## Running Scripts

```bash
python scripts/mcp_demo.py              # Interactive demo
python scripts/real_data_analysis.py    # Real data example
```
