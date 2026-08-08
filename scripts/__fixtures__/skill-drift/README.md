# skill-drift fixtures

Inputs for `scripts/check-skill-drift.test.mjs`. Nothing here is real skill
guidance: `docs/sample.md` is a fictional overlay written only to exercise the
extractor's escape paths (inline backticks, a fenced block, a literal
backslash, a `$` that is not an interpolation, a non-ASCII em dash, a trailing
newline).

The real `docs/skills/*.md` and the real embedded copies in socrata-mcp-server
are never mutated to demonstrate a failure — that is what these fixtures are
for.

| Directory | Stands for |
|-----------|------------|
| `docs/` | the source of truth (`sample.md`) |
| `embedded-in-sync/` | a correct embedded copy — byte-for-byte after escape decoding |
| `embedded-annotated/` | a correct copy whose export carries a `: string` annotation |
| `embedded-drifted/` | the drift failure mode: a reworded heading and a dropped bullet |
| `embedded-interpolated/` | a copy that is not a static document (`${...}`) — an error, not a pass |
| `embedded-no-export/` | a copy that no longer exports `SAMPLE_SKILL` at all |
