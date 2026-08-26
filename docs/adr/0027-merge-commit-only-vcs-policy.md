# ADR-0027: Merge-commit-only across the program's repositories — preserving contributor signatures, per-commit attribution, and revision lineage

- **Status:** **Accepted** (2026-08-26 — applied the same day to six repositories at both the repository-settings and `protect-main` ruleset layers; the verification record is in Consequences)
- **Date:** 2026-08-26
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0016](0016-vcs-native-lifecycle-mapping.md) (whose `vcsRef` field and `attestation/revises/v1` lineage sub-type this protects in the reference implementation's own history) and [ADR-0017](0017-ipr-posture-dco-rf-statement.md) (whose per-commit DCO regime this makes mechanically coherent)

*Numbering note: 0026 is the highest record on `main` at drafting time; 0018 remains reserved for the roadmap-governance amendment.*

## Context

Until 2026-08-26 every repository in this program allowed all three GitHub merge methods — merge commit, squash, and rebase — at **two independent layers**: the repository-level `allow_*_merge` settings, and the `pull_request` rule's `allowed_merge_methods` inside each repo's active `protect-main` ruleset. Nothing expressed a preference, so the web UI's per-PR choice decided how each contribution entered `main`.

Squash and rebase merges both **rewrite** commits. The objects that land on `main` are new: new hashes, a new committer, and — because the original signature covers the original object — no contributor signature. GitHub signs the replacement with its own web-flow key or leaves it unsigned. A true merge commit is the only method that leaves the contributor's commits on `main` as the objects the contributor actually made and signed.

That distinction is not incidental for this project. The Typed Standards Specification is a specification about Ed25519 signing, Sigstore transparency logging, and attestation. Its reference implementation's own history should be verifiable on the terms the specification asks of everyone else.

### What the history measures

Signature status of the most recent 200 commits on each default branch (all 75, for `typedstandards`), measured 2026-08-26 at the tips named. "GitHub web-flow" is key `B5690EEEBB952194`; "contributor key" is any other signing key, verified or merely unrecognized locally:

| Repository | Tip | GitHub web-flow | Contributor key | Unsigned |
|---|---|---:|---:|---:|
| `typedstandards` | `6b080df` | 51 | 0 | 24 |
| `civic-ai-tools` | `0fde247` | 70 | 8 | 122 |
| `civic-ai-tools-website` | `22170da` | 127 | 49 | 24 |
| `socrata-mcp-server` | `116f46c` | 97 | 0 | 103 |

Across the four repositories, **215 commits on `main` carry the squash-merge subject shape** (a subject ending in `(#N)` on a single-parent commit) — a lower bound on how many pull requests entered the mainline as rewritten objects.

### The case that settled it: `civic-ai-tools#159`

[PR #159](https://github.com/npstorey/civic-ai-tools/pull/159), from an outside contributor, is the first substantive external contribution to the program and shows every cost in one sequence:

- **2026-08-18** — opened from a fork, 14 commits, **none carrying a `Signed-off-by` trailer**. The `DCO` required status check (present in all four repositories' rulesets) blocked the merge.
- **2026-08-18 → 08-24** — the contributor rewrote the entire branch to add a DCO sign-off to every commit. Author dates stayed at 08-18; committer dates moved to 08-24. Final state: **13 commits, all 13 signed off**. Every one of them was also **signed with the contributor's own GPG key** (`955237B77C517223`) — not GitHub's.
- **2026-08-25** — merged. The resulting commit `0fde247f46` has **`parentCount: 1`**: a squash. Its committer is `GitHub`; its signature is GitHub's web-flow key.

What survived and what did not, stated precisely:

- **The sign-off text survived.** GitHub concatenates squashed commit messages, so all 14 `Signed-off-by` lines are present in the squash commit's body.
- **The signatures did not.** Thirteen commits signed with the contributor's key are not on `main`. One commit signed by GitHub is.
- **The per-commit binding did not.** Fourteen sign-off lines now sit in a single commit body as prose, no longer attached to the commits they certify — which is the form [ADR-0017](0017-ipr-posture-dco-rf-statement.md) Decision 1 actually specifies.
- **The revision granularity did not.** Thirteen revision edges became one.

Nothing went wrong procedurally. An ordinary squash merge produced this, which is the point: the default did it, six days after the contributor did deliberate work to satisfy the project's own IPR policy.

### Why the granularity matters beyond hygiene

[ADR-0016](0016-vcs-native-lifecycle-mapping.md) Decision B specifies `vcsRef` — an **attested**, signature-covered envelope field carrying `repoUrl` and a required `commitSha`, "the full, immutable revision object id," resolvable **verify-on-fetch**: a verifier MAY resolve the reference and check that the revision exists and that the content at the referenced path matches the node's `contentHash`. When a project squash-merges, the commit a `vcsRef` names can be an object that never existed on any contributor's machine — content-correct, lineage-synthetic.

[ADR-0016](0016-vcs-native-lifecycle-mapping.md) Decision C mints `attestation/revises/v1` to mirror a chain of revisions, **one attestation node per revision edge**. Squashing collapses exactly the edges that primitive exists to represent. Both are specified and not yet built; adopting this policy now means the reference implementation's history is already in the shape the specification will ask adopters to preserve, rather than needing to be apologized for later.

Finally, [ADR-0017](0017-ipr-posture-dco-rf-statement.md) makes a per-commit record load-bearing for the IPR regime: DCO 1.1 sign-off on every contribution, and the `PATENTS.md` royalty-free covenant with its inbound counterpart for normative specification text. Both depend on a durable record of who contributed what, and when. One commit carrying fourteen concatenated sign-off lines is a weaker record than fourteen commits each carrying their own.

*(A note on a claim not made here: squash merge does **not** reassign authorship to whoever pressed the button. GitHub preserves the primary `author` field and sets the `committer` to itself. What the rewrite destroys is the signature, the per-commit binding, and the revision granularity — not the author name.)*

## Decision

**1. A merge commit is the only way a pull request enters a default branch in this program.** Squash merge and rebase merge are disabled.

**2. The policy is enforced at both layers**, so that neither alone can silently re-open the others:

- repository settings — `allow_squash_merge: false`, `allow_rebase_merge: false`, `allow_merge_commit: true`;
- the `protect-main` ruleset's `pull_request` rule — `allowed_merge_methods: ["merge"]`.

**3. Scope is all six repositories in the program**, including the two private coordination repositories, which do not use pull requests today. Uniformity is the point: a repository configured differently invites the question of why, and answers it wrongly.

**4. Contributors curate branches locally, before review.** The cleanup that squash merge performed at merge time moves earlier and becomes the contributor's: interactive rebase, `--fixup`/`--autosquash`, and a branch whose commits are individually meaningful and individually signed. `CONTRIBUTING.md` carries the guidance.

**5. This is forward-looking only.** No existing history is rewritten. The 215 squash commits already on the mainline stay exactly as they are; rewriting them would destroy far more provenance than it restored, and would break every `vcsRef` and permalink that already points at them.

## Considered and rejected alternatives

- **Squash-only.** The mainstream default, and genuinely good at what it optimizes for: a linear, readable `main` where one commit is one change, `git bisect` is clean, and release notes fall out of the log. Rejected because it is precisely the method that discards contributor signatures and per-commit sign-offs, which is the property this project cannot afford to discard. This is a trade specific to a project whose subject matter is provenance — it is not a claim that squash-merging projects are careless, and no such claim should be read into this record.

- **Rebase merge.** Keeps commits separate and yields a linear history, so it appears to preserve granularity. Rejected because it rewrites every commit onto a new base: new hashes, broken signatures, and the same loss as squash with less of the readability benefit. It also silently produces commits that were never tested in the combination in which they land.

- **Allow all three, choose per PR by convention.** The status quo ante. Rejected because it had already failed — #159 was squash-merged under it, by the maintainer who wrote the DCO policy, one week after the contributor did the work to satisfy that policy. A convention that depends on remembering at merge time is not a control.

- **Also require signed commits on the default branch now.** Deliberately **not** adopted; registered as [Q74](../architecture/open-questions.md#q74--should-the-default-branches-require-signed-commits). With rebase merge disabled, GitHub can no longer rewrite an unsigned contributor commit into a signed one at merge time, so a `required_signatures` rule becomes a hard block with no maintainer escape hatch short of re-authoring the contribution — which would cost exactly the attribution this record protects. The question is real and the evidence is more favorable than assumed (the one substantive outside contributor already signs with their own key), but it is a separate decision with a separate cost, and it is not taken here.

## Consequences

**Applied and verified 2026-08-26.** All six repositories moved from `squash=true, rebase=true, merge=true` to `squash=false, rebase=false, merge=true`, each confirmed by a read-back: `typedstandards`, `civic-ai-tools`, `civic-ai-tools-website`, `socrata-mcp-server`, `civic-ai-tools-planning`, `civic-ai-ops`. The four `protect-main` rulesets moved from `allowed_merge_methods: ["merge","squash","rebase"]` to `["merge"]`, each confirmed by a normalized before/after diff showing that field as the only change — enforcement, empty bypass-actor list, ref conditions, and all four rules (`deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`, including the `DCO` and CI contexts) unchanged.

**The mainline now carries merge commits, and that is a real readability cost.** `git log` on a default branch becomes a DAG rather than a list. Readers who want the old shape should use `git log --first-parent`, which shows one entry per merged pull request; it is worth putting that in the repo's own docs rather than expecting people to know it.

**`git bisect` gets harder, and this is the sharpest cost.** With squash merge, every commit on `main` was a whole, reviewed change. Now bisect traverses branch commits too, and can land on a mid-branch commit that never independently passed CI. This is the concrete reason Decision 4 asks for atomic commits rather than merely tidy ones: a branch whose every commit builds keeps bisect useful, and a branch of work-in-progress checkpoints does not.

**Contributors bear cleanup work that the merge button used to absorb.** For a drive-by contributor this is a genuine new cost, and it lands on people who are doing the project a favor. The mitigation is documentation and review-time help, not enforcement — an over-strict bar here trades a provenance gain for a contribution loss.

**Release-note and changelog tooling that assumed one-commit-per-PR needs revisiting** if any is added later. None depends on it today.

**[ADR-0017](0017-ipr-posture-dco-rf-statement.md)'s enforcement clause is now understated by its own text.** It records DCO enforcement as "by review convention initially; an automated check may be added without revisiting this ADR." Measured 2026-08-26, a `DCO` required status check is active in all four code repositories' rulesets. That check is what blocked #159. No decision changes; the text is simply behind the configuration, and this record notes it so the next reader is not misled.

**A future repository consolidation is now constrained in how, not whether.** If the program's repositories are ever merged — the question is registered against the org-migration survey in [civic-ai-tools#135](https://github.com/npstorey/civic-ai-tools/issues/135) — the common path (`git filter-repo` to rewrite paths into subdirectories) rewrites every commit hash and destroys every signature in the program's history at once, which is this record's harm at maximum scale. A history-preserving path exists (`git merge --allow-unrelated-histories`, keeping original trees, relocating files in a follow-up commit) and is the only acceptable one under this decision.

**Rollback is one API call per repository per layer.** Nothing here is one-way.

## References

- [ADR-0016](0016-vcs-native-lifecycle-mapping.md) — Decision B (`vcsRef`: attested, verify-on-fetch, required `commitSha`) and Decision C (`attestation/revises/v1`, one node per revision edge). Its deferred-work list names signed-commit verification semantics, now registered as [Q74](../architecture/open-questions.md#q74--should-the-default-branches-require-signed-commits).
- [ADR-0017](0017-ipr-posture-dco-rf-statement.md) — DCO 1.1 inbound, the `PATENTS.md` royalty-free covenant, and the `CONTRIBUTING.md` surface-update pattern this record's rollout follows.
- [`IPR.md`](../../IPR.md), [`PATENTS.md`](../../PATENTS.md) — the policy texts the per-commit record supports.
- [civic-ai-tools#159](https://github.com/npstorey/civic-ai-tools/pull/159) — the measured case; merge commit `0fde247f46`.
- [Q74](../architecture/open-questions.md#q74--should-the-default-branches-require-signed-commits) — whether default branches should require signed commits.
