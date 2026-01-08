# Civic AI Tools - Example Project

A standalone example for querying NYC Open Data and Google Data Commons using MCP (Model Context Protocol) servers. Works with **Cursor IDE** and **Claude Code CLI**.

## Quick Start

```bash
git clone https://github.com/npstorey/civic-ai-tools-example.git
cd civic-ai-tools-example
./scripts/setup.sh
```

Then:
- **Cursor**: Open the folder in Cursor
- **Claude Code**: Run `claude` and approve the MCP servers

See [SETUP.md](SETUP.md) for detailed instructions.

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

## Documentation

- [SETUP.md](SETUP.md) - Complete setup instructions
- [docs/opengov-skill.md](docs/opengov-skill.md) - OpenGov query patterns and guidance
- [CLAUDE.md](CLAUDE.md) - Claude Code specific instructions
