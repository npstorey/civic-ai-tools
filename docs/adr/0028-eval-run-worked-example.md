# ADR-0028: A signed record of one AI benchmark evaluation run — self-adoption as a worked example, not normative text

- **Status:** **Proposed** (2026-09-13 — the worked example is built and verifies offline; this record notes what it demonstrates and what it does not promote)
- **Date:** 2026-09-13
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0021](0021-produce-core-extraction.md) (the independent-producer path this example exercises end to end) and [ADR-0011](0011-capturemethod-generalization.md) (whose per-profile vocabulary rule this example runs into)

*Numbering note: 0027 is the highest record on `main` at drafting time; 0018 remains reserved for the roadmap-governance amendment.*

## Context

The program needed one artifact it could put in front of an evaluation researcher and say: here is one public benchmark evaluation run, turned into a Typed Standards record package, that you can verify on your own machine with no network access. The example lives in its own repository, `typedstandards-eval-run-example` (private at the time of this record), pinning the published packages `@typedstandards/produce-core` 0.4.0 and `@typedstandards/verify-core` 0.9.0 exactly and modifying neither.

What it does: it pins one per-sample evaluation log from a public benchmarking hub (one model, GPQA Diamond, 198 questions across 16 epochs), recomputes the headline accuracy from the per-sample grades with a script whose hash was committed before it ran, and emits two signed `content/analysis/v1` nodes: a retrieval record and a recomputation record, the second carrying a PROV-O `wasDerivedFrom` edge to the first. Each node carries an RFC 3161 timestamp and a Rekor inclusion proof. One command, `node verify.mjs`, runs the verify-core check suite on both bundles with `fetch` stubbed to throw, and exits non-zero on any failure. The README's table states, row by row, what is attested, what is asserted, and what is not covered.

## Decision

This is **self-adoption under the [Xanadu doctrine](../architecture/xanadu-doctrine.md)**: a demonstration by the maintainer, not a package from an external adopter. It therefore promotes nothing.

1. **No node type moves.** `content/evidence/v1` stays reserved name-only (spec §7.5). The example's retrieval record is a `content/analysis/v1` node whose role is stated in its `summary` and `extensions`, and the README says why in one sentence.
2. **No vocabulary moves.** The example's `producerProfile` (`scripted-recomputation/eval-run`) has no guidance bundle, so its `captureMethod` (`script-run`) resolves to `producerProfile_bundle_unresolved` under check #15. The example prints that status and labels the execution-environment row *Asserted*. An evaluator producer profile — a capture vocabulary for scripted recomputation and an identity binding for an evaluating party — stays a research note until an external counterparty needs it, at which point it gets its own ADR that names that counterparty.
3. **No spec text changes.** The example is cited from this record and from the repository README only.

## Consequences

- The program has a linkable artifact whose honesty is its point: file integrity, analysis code identity, lineage and timestamps are attested; signer identity, model identity and execution environment are asserted; correctness of the published score is not covered.
- Two gaps are now on the record with a concrete package behind each, which is the doctrine's precondition for later promotion: the reserved evidence type, and the absence of any capture vocabulary outside AI-assisted analysis. Neither is promoted by this record.
- Worked examples are one repository each (the environmental-data example is the fifth repository, this is the sixth). An index of examples across implementations, listing each with its pinned package versions and its one verify command, is a later step once more than one example is validated; it is an index, not a move into the monorepo, because a workspace would resolve the packages from local source rather than from the release each example pins.
- Retrieval was not scriptable: the hub's published log links refuse scripted requests, so the log was downloaded by hand and the manifest records the route as such, with no HTTP headers. The README's reproduction steps say so, and "a scriptable public log route" appears among the things a second party could add.
