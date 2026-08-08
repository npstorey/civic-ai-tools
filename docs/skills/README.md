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

- **Source of truth**: These files are the canonical skill guidance. The socrata-mcp-server carries committed copies of `base.md`, `web.md`, and `local.md` as string constants in `src/skills/`; `data-commons.md` has no embedded copy.
- **Review process**: Changes to skill guidance are reviewed in a PR to this repo (`civic-ai-tools`). The embedded copies are updated in a follow-up PR to `socrata-mcp-server` — never edited there directly.
- **Enforcement**: CI checks byte-identity between these files and the embedded copies on every pull request and push to `main`, via `scripts/check-skill-drift.mjs` (which fetches the copies from the public repo). Drift fails the build.
- **Syncing**: run `node scripts/check-skill-drift.mjs --emit <dir>` to render the embedded modules from these files, then land them in `socrata-mcp-server/src/skills/`. Do not transcribe by hand — hand transcription is how the copies drifted before the check existed.
- **Both audiences**: these documents are read as repo docs *and* served verbatim to MCP clients, so they must work in both contexts: absolute URLs rather than repo-relative links, and no references to other files by filename.
- **Legacy file**: `../opengov-skill.md` is the original monolithic doc, kept for reference. It points here as the source of truth.

## Adding a new modality

To add support for a new modality (e.g., Slack, mobile):

1. Create a new overlay file (e.g., `slack.md`) in this directory.
2. Add the corresponding skill file in `socrata-mcp-server/src/skills/`.
3. Update the `GetPrompt` handler in the MCP server to compose with the new overlay.
