# Skill Guidance — Modular Structure

This directory contains the companion skill guidance for the MCP servers the civic-ai-tools stack uses. The Socrata skill is split into a base document plus modality overlays (web / local). The Data Commons skill is a single peer document — the second MCP server's two-tool surface is narrow enough that it does not need per-modality overlays.

## Files

| File | Purpose |
|------|---------|
| `base.md` | Socrata universal guidance: anti-hallucination, SoQL syntax, column discovery, key datasets, date range guidelines, error handling, uncertainty caveats, output format, data quality, advanced techniques |
| `web.md` | Socrata web overlay: aggressive date defaults, demo limits, token-conscious formatting, no cross-portal comparisons, local tools CTA |
| `local.md` | Socrata local overlay: relaxed date defaults, full capabilities, cross-portal comparisons encouraged, extended analysis OK |
| `data-commons.md` | Google Data Commons skill: two-tool workflow, DCID patterns, small-area coverage, aggregation-semantics risks, cross-source decision logic, attribution |

## How overlays work

The MCP server composes guidance at request time:

1. **Base** (`base.md`) is always included — it contains ~80% of the guidance.
2. **One overlay** (`web.md` or `local.md`) is appended based on the client's modality:
   - HTTP transport → `web.md` (web demo clients)
   - stdio transport → `local.md` (CLI clients like Claude Code, Cursor)
3. The client receives the composed result via the MCP `prompts/get` endpoint (`skill-guidance` prompt).

Clients can also explicitly request a modality by passing `modality: "web"` or `modality: "local"` as a prompt argument.

## Governance

- **Source of truth**: These files are the canonical skill guidance. The socrata-mcp-server embeds copies at build time.
- **Review process**: Changes to skill guidance should be reviewed in a PR to this repo (`civic-ai-tools`). After merge, update the copies in `socrata-mcp-server/src/skills/` and rebuild.
- **Legacy file**: `../opengov-skill.md` is the original monolithic doc, kept for reference. It points here as the source of truth.

## Adding a new modality

To add support for a new modality (e.g., Slack, mobile):

1. Create a new overlay file (e.g., `slack.md`) in this directory.
2. Add the corresponding skill file in `socrata-mcp-server/src/skills/`.
3. Update the `GetPrompt` handler in the MCP server to compose with the new overlay.
