# Civic AI Tools

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/npstorey/civic-ai-tools)

**Use AI to explore NYC Open Data and Google Data Commons — no advanced programming required.**

Civic AI Tools connects AI assistants (GitHub Copilot, Cursor, Claude Code) to public datasets using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Think of MCP as a universal adapter that lets AI talk directly to data sources — so you can ask questions in plain English and get answers from real civic data.

**Built for** civic technologists, government workers, journalists, and students exploring public data with AI.

Civic AI Tools sits at one layer of a broader landscape where open data meets AI: projects in this space address making data discoverable to AI, making AI mediation legible to humans, feeding signal back to data publishers, and orchestrating AI across civic-data domains. This project focuses on the second layer — evidence packages that make AI analyses inspectable, reproducible, and cryptographically verifiable. See [docs/research/landscape-analysis.md](docs/research/landscape-analysis.md) for the wider landscape.

> **Integrating against the evidence registry?** The reference implementation and its integration contract live in [civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website) — start at [`docs/api/evidence-publish.md`](https://github.com/npstorey/civic-ai-tools-website/blob/main/docs/api/evidence-publish.md). This repo holds the protocol decisions (ADRs, the open-questions registry) and the Typed Standards Specification the contract cites.

> **Reviewing the standard?** The Typed Standards Specification is [`docs/architecture/typed-standards-specification.md`](docs/architecture/typed-standards-specification.md) (v0.1 Working Draft, CC BY 4.0); the short version is [`typed-standards-summary.md`](docs/architecture/typed-standards-summary.md). Reviewers should start at [`docs/community-review/v0.1-rfc-reviewer-orientation.md`](docs/community-review/v0.1-rfc-reviewer-orientation.md) — a one-page reading guide.

> **Running your own instance?** This repo is the local starter. To deploy the evidence platform on your own infrastructure, see [`civic-ai-tools-website/docs/deploy.md`](https://github.com/npstorey/civic-ai-tools-website/blob/main/docs/deploy.md).

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

Civic AI Tools is one of four repositories in this project — see [CONTRIBUTING.md](CONTRIBUTING.md#this-is-a-multi-repo-project) for the full map and where to file what.

| Repository | Description |
|-----------|-------------|
| [socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server) | The MCP server that connects AI tools to Socrata open data portals. This repo uses it as a dependency. |
| [civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website) | Demo website at [civicaitools.org](https://civicaitools.org) — side-by-side comparison of AI with and without live data access |
| [typedstandards](https://github.com/npstorey/typedstandards) | The standard's home — @typedstandards/verify-core, @typedstandards/produce-core, and [typedstandards.org](https://typedstandards.org). The specification *text* lives in this repo; the packages and site live there. |

## Packages

This repo is an npm workspace. [packages/civic-typed-harness](packages/civic-typed-harness) publishes as [`@typedstandards/civic-typed-harness`](https://www.npmjs.com/package/@typedstandards/civic-typed-harness) — the civic **domain** harness layered on `@typedstandards/produce-core`'s neutral envelope assembly ([ADR-0021](docs/adr/0021-produce-core-extraction.md), [ADR-0022](docs/adr/0022-civic-typed-harness-packaging.md)).

## Documentation

### Getting started
- [docs/setup.md](docs/setup.md) — Setup, tool-specific instructions, and troubleshooting
- [docs/publish-evidence.md](docs/publish-evidence.md) — Publishing analyses from Claude Code to the evidence registry

### Data and skills
- [docs/mcp-servers.md](docs/mcp-servers.md) — Directory of civic data MCP servers
- [docs/datasets.md](docs/datasets.md) — Curated dataset directory
- [docs/opengov-skill.md](docs/opengov-skill.md) — Socrata query patterns and SoQL syntax reference
- [docs/skills/](docs/skills/) — Per-source AI skill guidance

### Governance and discipline
- [ROADMAP.md](ROADMAP.md) — Public roadmap, trust commitments, and out-of-scope items
- [docs/adr/](docs/adr/) — Architectural decision records
- [docs/trust-and-evidence.md](docs/trust-and-evidence.md) — What "verifiable" means and how to verify a package
- [docs/sustainability.md](docs/sustainability.md) — Project sustainability posture

### Architecture
- [docs/architecture/](docs/architecture/) — Canonical architecture documents and spec drafts (internal working drafts; not stable specs)
- [docs/architecture/typed-standards-specification.md](docs/architecture/typed-standards-specification.md) — **the Typed Standards Specification** (v0.1 Working Draft, CC BY 4.0). Version-tagged: changes are patch revisions, not edits.
- [docs/community-review/](docs/community-review/) — reviewer orientation and the circulated render of the spec.
- [docs/architecture/end-state-vision.md](docs/architecture/end-state-vision.md) — Layered architecture target with build-state coloring and full glossary
- [docs/architecture/open-evidence-standard.md](docs/architecture/open-evidence-standard.md) — **Historical snapshot, frozen 2026-05-26**; envelope-layer content consolidated into the Typed Standards Specification (ADR-0012)
- [docs/architecture/civic-claim-vocabulary-draft-spec.md](docs/architecture/civic-claim-vocabulary-draft-spec.md) — **Historical snapshot, frozen 2026-05-26**; typed-claims-layer content consolidated into the specification (ADR-0012)
- [docs/architecture/xanadu-doctrine.md](docs/architecture/xanadu-doctrine.md) — Project discipline gating spec growth
- **[docs/architecture/open-questions.md](docs/architecture/open-questions.md)** — Open questions registry. Canonical home for unresolved decisions affecting the architecture and standards. Start here when deciding what's settled vs. what's still in flight.

### Research
- [docs/research-agenda.md](docs/research-agenda.md) — Research questions the project engages
- [docs/research/landscape-analysis.md](docs/research/landscape-analysis.md) — Ecosystem survey of adjacent civic-AI and evidence projects
- [docs/evidence-protocol-fork.md](docs/evidence-protocol-fork.md) — Long-form analysis of the evidence-system fork
- [docs/research/](docs/research/) — Additional research artifacts

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines — there are ways to help even if you don't write code.

Two CI gates run on every PR and are worth knowing before you start: **skill-drift** (docs/skills/{base,local,web,web-reference-demo}.md are byte-compared against the copies embedded in socrata-mcp-server — regenerate with `node scripts/check-skill-drift.mjs --emit <dir>`, never hand-transcribe) and **dependency budgets** (`npm run check:budgets`).

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

## License

Code in this repo is MIT (see [LICENSE](LICENSE)). The Typed Standards Specification text is CC BY 4.0 (declared in the document). Cross-repo license choices — including the fork attribution on socrata-mcp-server and the CC0 dedication on the project's directory data — are documented in [LICENSING.md](LICENSING.md).

## Disclaimer

This is a personal project and is not affiliated with, endorsed by, or representative of any employer or organization.
