---
name: publish-evidence
description: Deprecated alias of publish-record. Publish the current Claude Code analysis to the civicaitools.org record registry as a cryptographically signed, timestamped, Rekor-logged record package. Invoke when the user has just completed a civic-data analysis (typically using the Socrata and/or Data Commons MCP tools) and says something like "publish this as evidence", "sign this analysis", "publish to civicaitools.org", or "make this a verifiable package."
allowed-tools: Bash(python3 *), Read, Write
---

# publish-evidence (deprecated alias of `publish-record`)

This skill was renamed to **`publish-record`** by the 2026-08-19 vocabulary settlement — see the specification's Appendix J, migration class *alias-and-deprecate*: "evidence" is retired as the name of the artifact and infrastructure surface (it overclaims — the package records how an answer was produced, not that the answer is correct) and retained only for the epistemic Question / Evidence / Claim role.

**This alias is permanent, not a deprecation window.** People and notes in the wild say "publish-evidence"; that invocation keeps working. It will not be removed before the skill's next major version, and only then if nothing depends on it.

## What to do when this skill is invoked

Follow **[`../publish-record/SKILL.md`](../publish-record/SKILL.md)** — the full, authoritative instructions — exactly as written. Read that file now and work from it. There is no second copy of the guidance here, and no second copy of the script: `publish.py` and `test_publish.py` live only in `.claude/skills/publish-record/`, so the alias and the canonical name always run byte-identical code.

The one thing to carry across: every command in that file invokes the script at its real location, for example

```bash
python3 .claude/skills/publish-record/publish.py --payload /tmp/publish-record-<timestamp>.json --dry-run
```

Those paths are correct as written whether the user typed `publish-record` or `publish-evidence`. Do not rewrite them to point inside this directory — nothing executable is here.

## Prefer the new name when you speak

When telling the user what you are doing, say **`publish-record`**. Mention the rename once if they used the old name, then continue; do not stop to ask about it, and do not treat the old name as an error.
