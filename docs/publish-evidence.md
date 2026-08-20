# Publishing a Claude Code analysis (moved)

**This page moved to [`publish-record.md`](./publish-record.md).**

The `publish-evidence` skill was renamed to **`publish-record`** by the 2026-08-19 vocabulary settlement — see the specification's [Appendix J](./architecture/typed-standards-specification.md), migration class *alias-and-deprecate*. "Evidence" is retired as the name of the artifact and infrastructure surface and retained only for the epistemic Question / Evidence / Claim role.

This stub stays here permanently so links already published to `docs/publish-evidence.md` keep resolving. Nothing here is maintained; the walkthrough lives in one place.

**What still works, unchanged:**

- The old invocation. `.claude/skills/publish-evidence/` remains as a permanent alias directory that routes to the one script in `.claude/skills/publish-record/`, and asking Claude to "publish this as evidence" still triggers it.
- Tokens carrying the prior-era `evidence:publish` scope. civicaitools.org accepts them alongside the new `records:publish`.
- Every link to a record published before the rename. The `/api/evidence/*` and `/evidence/*` route segments are permanent aliases of `/api/records/*` and `/records/*`.
- Every already-signed package. Its identifiers are frozen under its signature and remain valid forever; verifiers accept both eras.
