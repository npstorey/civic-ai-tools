---
paths:
  - "scripts/__fixtures__/**"
  - "scripts/*.test.mjs"
  - "packages/**/*.test.ts"
  - ".claude/skills/publish-record/test_publish.py"
---

# Fixture convention: write test data the pre-push guard will accept

The maintainer's pre-push sensitivity guard keyword-scans the added lines of **every outgoing commit
individually**, not the net branch diff. Synthetic test data is the usual thing that trips it, and a fix
commit on top cannot clear a commit already in the branch — the history has to be rebuilt (reset to
base, recommit the final state) before the branch can push at all. Write fixtures so it never fires.

Three rules, owner-directed after a sprint lost two pushes to them:

1. **Synthetic timestamps stay under 13 digits.** A nanosecond-precision OpenTelemetry timestamp is a
   nineteen-digit decimal run, which a leak scanner reads as a card- or account-shaped number. Use
   seconds-scale values (`'1000000000'`) instead.
2. **Seeded hex identifiers start in the letter range** (`0xa0…`), so the rendered id never opens with a
   long digit run.
3. **Never write the account-shaped phrase** — the noun paired with `#`, `no.`, or `num`/`number` — in a
   comment, a doc, or a fixture. It is matched as prose, not just as data.

Reshape the content; never skip the guard and never weaken its pattern list. Apply the convention in
*every* commit, not just the final tree. To pre-verify a branch before pushing, grep the added lines of
`<base>..HEAD` against the guard's pattern list — the count must be zero.
