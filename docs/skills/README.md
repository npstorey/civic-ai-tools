# Skill Guidance — Modular Structure

This directory contains the companion skill guidance for the MCP servers the civic-ai-tools stack uses. The Socrata skill is split into a base document plus modality overlays (web / local). The Data Commons skill is a single peer document — the second MCP server's two-tool surface is narrow enough that it does not need per-modality overlays.

## Files

| File | Purpose |
|------|---------|
| `base.md` | Socrata universal guidance: anti-hallucination, SoQL syntax, column discovery, key datasets, date range guidelines, error handling, uncertainty caveats, output format, data quality, advanced techniques |
| `web.md` | Socrata web overlay (deployment-neutral): aggressive date defaults, deployment-declared limits guidance, token-conscious formatting, local-client suggestion, reproducible-notebook mode |
| `web-reference-demo.md` | Socrata posture overlay for the reference deployment (civicaitools.org public demo): specific demo limits (row / tool-call / findings caps, no cross-portal comparisons) and the Local Tools CTA. Appended after `web.md` when the server sets `SKILL_POSTURE=reference-demo` |
| `local.md` | Socrata local overlay: relaxed date defaults, full capabilities, cross-portal comparisons encouraged, extended analysis OK |
| `data-commons.md` | Google Data Commons skill: two-tool workflow, DCID patterns, small-area coverage, aggregation-semantics risks, cross-source decision logic, attribution |
| `boston.md` | Boston OpenContext skill: CKAN-vs-Socrata cheat sheet, Boston geographies (neighborhoods ≠ Census tracts, BPD districts, parcel IDs), resource-UUID citation. No embedded server copy — not drift-checked. |

## How overlays work

The MCP server composes guidance at request time:

1. **Base** (`base.md`) is always included — it contains ~80% of the guidance.
2. **One modality overlay** (`web.md` or `local.md`) is appended based on the client's modality:
   - HTTP transport → `web.md` (web clients)
   - stdio transport → `local.md` (CLI clients like Claude Code, Cursor)
3. **One optional posture overlay** is appended after the modality overlay when the server declares a deployment posture: with `SKILL_POSTURE=reference-demo` set in the server's environment and modality `web`, the server appends `web-reference-demo.md` after `web.md`. Unset, the server serves base + modality overlay only. Posture applies only to the web modality — `SKILL_POSTURE` has no effect on `local`.
4. The client receives the composed result via the MCP `prompts/get` endpoint (`skill-guidance` prompt).

Clients can also explicitly request a modality by passing `modality: "web"` or `modality: "local"` as a prompt argument.

## Governance

- **Source of truth**: These files are the canonical skill guidance. The socrata-mcp-server carries committed copies of `base.md`, `web.md`, `local.md`, and `web-reference-demo.md` as string constants in `src/skills/`; `data-commons.md` has no embedded copy. `web-reference-demo.md` is drift-checked exactly like the other three.
- **Review process**: Changes to skill guidance are reviewed in a PR to this repo (`civic-ai-tools`). The embedded copies are updated in a follow-up PR to `socrata-mcp-server` — never edited there directly.
- **Enforcement**: CI checks byte-identity between these files and the embedded copies on every pull request and push to `main`, via `scripts/check-skill-drift.mjs` (which fetches the copies from the public repo). Drift fails the build.
- **Syncing**: run `node scripts/check-skill-drift.mjs --emit <dir>` to render the embedded modules from these files, then land them in `socrata-mcp-server/src/skills/`. Do not transcribe by hand — hand transcription is how the copies drifted before the check existed.
- **Both audiences**: these documents are read as repo docs *and* served verbatim to MCP clients, so they must work in both contexts: absolute URLs rather than repo-relative links, and no references to other files by filename.
- **Legacy file**: `../opengov-skill.md` is the original monolithic doc, kept for reference. It points here as the source of truth.

### Protocol vocabulary: the `org.civicaitools.*` extension keys

`org.civicaitools.summary` (mandated by the reproducible-notebook instructions in `web.md`) and `org.civicaitools.notebook` (the extension the `dathere-ag-jupyter/v1` canonicalization rule fingerprints — typedstandards `packages/verify-core/src/canonicalization.ts:34`) are **protocol vocabulary**: reverse-DNS extension keys owned by the project, kept identical across all deployments regardless of deployment identity or posture. The deployment-posture split above never touches them — a deployment renames its chrome, not these keys. The notebook extension is governed by the [Typed Standards Specification](../architecture/typed-standards-specification.md) §8.7.1 (requirement 4) and §8.7.2 (notebook format). Note the consolidated spec renumbered the frozen OES's §9.1.x sections to §8.7.x per [ADR-0012](../adr/0012-typed-standards-consolidation.md); `web.md`'s inline "OES §9.1.4" citation refers to the frozen snapshot and maps to spec §8.7.4. Deciding records: [civic-ai-tools#148](https://github.com/npstorey/civic-ai-tools/issues/148) audit ruling C6; [civic-ai-tools#154](https://github.com/npstorey/civic-ai-tools/issues/154).

## Adding a new modality

To add support for a new modality (e.g., Slack, mobile):

1. Create a new overlay file (e.g., `slack.md`) in this directory.
2. Add its name to `EMBEDDED_SKILLS` in `scripts/check-skill-drift.mjs`, so the new embedded copy is covered by the drift check.
3. Render the embedded module with `node scripts/check-skill-drift.mjs --emit <dir>` and land the emitted file in `socrata-mcp-server/src/skills/` — do not transcribe by hand (see Governance above).
4. Update the `GetPrompt` handler in the MCP server to compose with the new overlay.
