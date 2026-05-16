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

## Architecture documentation

Canonical specifications and design decisions live in [`docs/architecture/`](docs/architecture/):

- [`end-state-vision.md`](docs/architecture/end-state-vision.md) — layered architecture target with build-state coloring (built / partial / designed / speculative) and full glossary. Update when an open question resolves.
- [`open-evidence-standard.md`](docs/architecture/open-evidence-standard.md) — Internal working draft of the Open Evidence Standard (pre-v0.1, not for external review). Spec for evidence-package shape, signing, verification, captureMethod, withdrawal lifecycle. Honors what the codebase actually enforces today; sections subject to open questions are marked inline.
- [`civic-claim-vocabulary-draft-spec.md`](docs/architecture/civic-claim-vocabulary-draft-spec.md) — Internal working draft of the Civic Claim Vocabulary (pre-v0.1). The typed-claims layer that sits on top of the Open Evidence Standard. Reserved but not yet built; gated by the Xanadu doctrine.
- [`xanadu-doctrine.md`](docs/architecture/xanadu-doctrine.md) — project discipline gating spec growth: do not promote anything to a higher build state without a real package or adopter that needs it.
- [`working-method.md`](docs/architecture/working-method.md) — project discipline governing how content moves between the project's six coordination surfaces: decision surfaces (registry / proposed-issues + GitHub issues / ADRs / specs), memory surfaces, and instruction surfaces. Covers the promotion path from question to issue to ADR, the explicit avoidance of issue-tracker-as-thinking-surface, and the inclusion conditions for memory and CLAUDE.md content. Companion doctrine to `xanadu-doctrine.md`.
- [`working-method-flow.md`](docs/architecture/working-method-flow.md) — practical operational guide to the working method: surface map, ASCII flowchart from origination through promotion, worked classification examples ("I have a thing in my chat — where does it go?"). Read this when placing content; read `working-method.md` for rationale.
- [`chat-type-taxonomy.md`](docs/architecture/chat-type-taxonomy.md) — project discipline governing conversation surfaces: defines the seven project-specific chat types (strategic, planning B/C/D, orchestration, implementation, meta), their proper uses, and the closure rules that hold them apart. Third companion doctrine alongside `xanadu-doctrine.md` (spec growth) and `working-method.md` (surface content placement).
- **[`open-questions.md`](docs/architecture/open-questions.md)** — Living registry of unresolved decisions affecting the architecture and standards. Canonical home for what's still in flight. The front door per the working method. Spec sections that depend on unresolved questions cite this registry by question number; future ADRs that resolve a question update the registry entry to point at the resolution.

ADRs in [`docs/adr/`](docs/adr/) record settled decisions; the architecture docs above describe the artifacts those decisions are about. ADRs cite the doctrine and specs by URL when their decisions involve a Xanadu-test gate.

## Running Scripts

```bash
python scripts/mcp_demo.py              # Interactive demo
python scripts/real_data_analysis.py    # Real data example
```

## Claude Code skills

### `publish-evidence`

Bundled at `.claude/skills/publish-evidence/`. Publishes a completed civic-data analysis from a Claude Code session to the civicaitools.org evidence registry as a cryptographically signed, timestamped evidence package. Intended for frontier-model runs (Opus 4.7, 1M context) where the analysis depth exceeds what the civicaitools.org chat flow can cover under its token budget.

Invoke by saying something like "publish this as evidence" after a Socrata or Data Commons MCP-backed analysis completes. Requires a `CIVICAITOOLS_SESSION_TOKEN` (or `CIVICAITOOLS_SESSION_TOKEN_OP` 1Password reference) in the shell environment. See [`docs/publish-evidence.md`](docs/publish-evidence.md) for the end-to-end walkthrough and [`civic-ai-tools-website/docs/api/evidence-publish.md`](../civic-ai-tools-website/docs/api/evidence-publish.md) for the underlying POST contract.
