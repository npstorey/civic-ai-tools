# ADR-0028: A third party's evaluation run as a record package — self-adoption by worked example, and the two gaps it exposes

- **Status:** **Accepted** (2026-09-19 — records rulings taken 2026-09-13 and carried out the same day; the example verifies, see Consequences)
- **Date:** 2026-09-19
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0011](0011-capturemethod-generalization.md) (whose per-profile capture vocabulary this record finds empty for a producer that is not an AI) and [ADR-0026](0026-jsonl-readback-capture-label-vs-mechanism.md) (which raised the label-versus-mechanism gap this example meets from the other side)

*Numbering note: 0027 is the highest record on `main` at drafting time; 0018 remains reserved for the roadmap-governance amendment.*

## Context

`typedstandards-eval-run-example` turns one public AI benchmark evaluation run into two signed Typed Standards record packages that verify offline with one command. The run is Epoch AI Benchmarking Hub run `S5QYXSvQBRSbUbXSnAGbMm` — Llama-3.1-405B-Instruct on GPQA Diamond, 198 questions × 16 epochs. One node pins the hub's published Inspect log and the hub data file carrying the run's score; the second recomputes accuracy from the log's 3,168 per-sample grades (1613/3168, equal to the published `mean_score`) and carries a `prov:wasDerivedFrom` edge to the first node's envelope hash.

The example consumes `@typedstandards/produce-core` 0.4.0 and `@typedstandards/verify-core` 0.9.0 exactly as published. **Neither package was modified**, and no specification text was written to make it work. It is the first worked example built from the released packages by a consumer rather than inside the reference application.

Building it surfaced two places where the released surface has a name but no mechanism.

### Gap 1 — the evidence node type is reserved, and no verifier recognizes it

The natural shape for the first node is an evidence record: a retrieved third-party artifact, pinned by hash. The specification reserves `content/evidence/v1` name-only (§7.5). In `verify-core` 0.9.0, `KNOWN_TYPE_URIS` (`checks.js`) lists sixteen URIs — `content/analysis/v1` plus fifteen `attestation/*` types — and no evidence type, so check #12 would report `unknown_type` for such a node. Check #12 does not fail verification, but a grant-linked artifact demonstrating a reserved type would be promotion by demonstration.

### Gap 2 — the capture vocabulary has no value for a producer that is not an AI

The analysis here is a deterministic Python script over a pinned file. `PROFILE_CAPTURE_VOCAB` in `verify-core` 0.9.0 (`profiles.js`) carries exactly one profile type, `ai-assisted-analysis`, with three values: `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`. A script run is none of them. Under that profile an honest label is rejected as `captureMethod_unknown`; under an unbundled profile it degrades to `producerProfile_bundle_unresolved` and the package stays signed and verifiable.

## Decision

1. **Both nodes use `content/analysis/v1`**, the one content type the verifier recognizes, with each node's role stated in its `summary` and `extensions`. Lineage is a `prov:wasDerivedFrom` edge inside the recomputation node's PROV-O graph, not a node type. The example's README states in one sentence why the evidence type is not used.
2. **The capture label is truthful and unresolvable**: `producerProfile: scripted-recomputation/eval-run`, `captureMethod: script-run`. The verifier reports `producerProfile_bundle_unresolved`, the example prints that line rather than hiding it, and the README's execution-environment row reads Asserted.
3. **Neither gap is promoted by this demonstration.** No reserved type is minted, no vocabulary is added, and no specification text changes on account of an example. Under [the Xanadu doctrine](../architecture/xanadu-doctrine.md), an evaluator producer profile stays a research document until an external counterparty is blocked without it; this record is the place that need would be argued from.
4. **The example is the reference for consumer-side adoption**, in a repository of its own rather than inside `typedstandards` — pinning the published releases is the property being demonstrated, and a workspace would shadow them.

## Consequences

- **The published packages are exercised end to end by a consumer.** Assembly, Ed25519ph signing, the RFC 3161 and Rekor codecs, the PROV-O helpers, the §8.8.1 commitment view and the §9.2 check suite all ran unmodified against a third party's data.
- **Verification is offline and one command.** `node verify.mjs` reports zero network calls, with signatures, a FreeTSA token (genTime 2026-09-13T22:07:34Z) and Rekor inclusion proofs (log indexes 2822632280 and 2822632295) all checked from the bundle. Envelope hashes: retrieval `3637b595…7d48`, recomputation `abb93f78…4a9c`.
- **Two verifier behaviours are now documented from a consumer's seat.** `verifyRekorInclusion` proves a body is in the log, not that the body belongs to the package at hand, so the example adds that binding check on top. And a BlobRef whose URL the source refuses to serve to scripts reports `fetch_failed` online, which is why the example resolves it from a local copy and labels the row "local copy only".
- **A third gap is recorded without a decision**: retrieval of the source log could not be scripted at all (the published link answers `AccessDenied`, its viewer route requires human verification), so the file was retrieved by hand and pinned by hash, with the route recorded as such.
- **Cost:** one amber line in every verification of this package until a profile bundle exists for scripted producers.

## References

- Example repository: `npstorey/typedstandards-eval-run-example`, commits `d5fc615`…`129b45f`, all signed; private at the time of writing. Verify output: `docs/verify-output.txt`. Phase records: `docs/p0-record.md`…`docs/p4-record.md`; the frozen formula is `docs/p2-preregistration.md`.
- Packages: `@typedstandards/produce-core` 0.4.0, `@typedstandards/verify-core` 0.9.0.
- Data: Epoch AI, "Capabilities & Benchmarking", https://epoch.ai/benchmarks — CC BY 4.0 for the data file; the evaluation log's licence is not stated.
