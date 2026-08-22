---
paths:
  - "docs/skills/**"
---

# Skill guidance is a three-surface artefact

These files are the source of truth. `socrata-mcp-server` carries byte-identical copies of `base.md`,
`web.md`, `local.md`, and `web-reference-demo.md` as string constants in `src/skills/`, and the
website carries a hand-shaped fallback. `npm run check:skill-drift` fetches the embedded copies from
the public repo and fails the build on any divergence — including a trailing-newline-only one.

**Never hand-transcribe an embedded copy.** Render it:
`node scripts/check-skill-drift.mjs --emit <dir>`, then land the emitted file in
`socrata-mcp-server/src/skills/`. Hand transcription is how the copies drifted before the check existed.

**Merge order for a three-surface change** — the socrata embed PR first, then the civic source PR,
then the website fallback PR. The civic source PR's drift check is *expected red* until socrata `main`
carries the new embed; re-run it after that merge rather than treating red as a defect. The website
fallback is hand-shaped under test coverage: `sync-fallback.mjs` refuses by default and must not be
force-run — doing so re-imports server posture and breaks the template literal.

These documents are read as repo docs *and* served verbatim to MCP clients, so they must work in both
contexts: absolute URLs rather than repo-relative links, and no references to other files by filename.
Governance detail, including the `org.civicaitools.*` protocol vocabulary, is in `docs/skills/README.md`.
