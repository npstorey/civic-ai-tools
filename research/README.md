# Typed Standards in SHACL and SysML v2 — research bundle

This bundle frames the [Typed Standards Specification](../docs/architecture/typed-standards-specification.md) twice, in two established formalisms, to see what each one makes legible.

## Thesis

SHACL and SysML v2 formalize **complementary surfaces** of the spec, not competing encodings of the same thing. SHACL (the W3C Shapes Constraint Language) captures instance-data conformance — the shape and validity of an evidence package at the envelope and typed-claims layers. SysML v2 (with KerML) captures system structure, behavior, lifecycle, and requirements traceability across the whole architecture. Where they touch the same ground — the closed `ts:direction` / `ts:relation` enumerations — they record the same closure for different purposes: a value constraint on instance data versus a type in a system model. Read together they describe one model from two viewpoints; neither is a substitute for the other, and both stop at the same hard boundary (cryptographic verification, hash recomputation, and Rekor inclusion stay out-of-band in both).

## What is here

- **`00-formal-model.md`** — the consolidated, formalism-neutral formal model extracted from the spec. The shared source both framings are derived from; read this first to see what is being formalized before seeing how.
- **`01-typed-standards-as-shacl.md`** — the SHACL framing: how the envelope and typed-claims layers map to shapes, property constraints, and closed value sets.
- **`02-typed-standards-as-sysml-v2.md`** — the SysML v2 / KerML framing: system structure, the verification flow as actions, lifecycle/visibility, and requirements traceability.
- **`03-formalism-comparison.md`** — the comparison and a tempered adoption recommendation: a layer-by-layer fit table, the shared hard boundary, the open-questions relationship, and concrete promotion triggers for each formalism.
- **`shapes/typed-standards.shacl.ttl`** — the standalone SHACL shapes graph (Turtle), the artifact behind `01`.
- **`sysml/typed-standards.sysml`** — the standalone SysML v2 model, the artifact behind `02`.
- **`ontology/typedClaims.ttl`** — a draft OWL ontology for the typed-claims layer (spec §8.11), research-draft and non-normative. Recorded in the open-questions registry ([Q10](../docs/architecture/open-questions.md#q10--civic-claim-vocabulary-as-a-full-ontology)) as the candidate artifact for the ontology question; adoption is gated on a further review round per that entry, and nothing here promotes it.

Related architecture-view sketches (same research surface, separate thread from the formalism bundle):

- **`04-architecture-views.md`** — Needs / Functional / Logical views of the repository and its ecosystem, with cross-layer traceability.
- **`05-typed-standards-spec-architecture-views.md`** — recursive decomposition of the Typed Standards Spec component from `04` into its own needs, functions, and logical components; verified against `00`–`03` and validated against the specification itself (the one-pager `docs/architecture/typed-standards-summary.md` now carries a companion-not-authority banner and lags the spec).
- **`sysml/system-of-interest.sysml`** — `04` transcribed to SysML v2: stakeholders, needs N1–N4 (requirement defs with stakeholder links), functions F1–F6 (the mission pipeline), logical components, the 04 §3 topology as connections, and the cross-layer traceability as satisfy relationships.
- **`sysml/tss-as-system.sysml`** — `05` transcribed to SysML v2: the spec's own users, needs TN1–TN6, their refinement of `04`'s N-needs, functions TF1–TF8 (the spec function flow), the 05 §3 components carrying their functions, and the 05 §4 traceability as satisfy relationships. Bridges `04`'s `SpecCorpus` component to the packages of the detail model `sysml/typed-standards.sysml`.

## Suggested reading order

1. `00-formal-model.md` — establish the shared, neutral model.
2. `01-typed-standards-as-shacl.md` with `shapes/typed-standards.shacl.ttl` open alongside it.
3. `02-typed-standards-as-sysml-v2.md` with `sysml/typed-standards.sysml` open alongside it.
4. `03-formalism-comparison.md` — the synthesis, boundary, and recommendation. Readers who only want the conclusion can start here and follow its references back.

## Status

Exploratory research framing, produced 2026-06-24; **reconciled 2026-08-18** against the specification's 2026-08-03 revision (the v0.1.4 reconciliation, Appendix G) and the ADR corpus through [ADR-0024](../docs/adr/0024-evidence-path-configuration.md). The reconciliation carries forward, among other changes: the `sealed` / `public` visibility vocabulary and the three orthogonal disposition dimensions ([ADR-0016](../docs/adr/0016-vcs-native-lifecycle-mapping.md) §A, spec §8.10.6), the signing-status axis and unsigned dev tier ([ADR-0020](../docs/adr/0020-instance-key-custody.md)), the `attestation/revises/v1` sub-type and `vcsRef` field (spec §8.10.5, §8.1.1), the ratified §8.8.1 commitment-view shape, and the `@typedstandards/produce-core` / `@typedstandards/civic-typed-harness` package extractions ([ADR-0021](../docs/adr/0021-produce-core-extraction.md), [ADR-0022](../docs/adr/0022-civic-typed-harness-packaging.md)). The open-questions registry now records formalization-review positions touching this bundle (Q10, Q41); those remain positions, not resolutions, and nothing here treats them otherwise.

This is **not** a normative addition to the Typed Standards Specification. It does **not** change the spec or any ADR, and it introduces no new requirements. It is a study artifact in the sense of the [xanadu-doctrine](../docs/architecture/xanadu-doctrine.md): the two framings are non-committal viewpoints, each with an explicit promotion trigger named in `03-formalism-comparison.md`, and neither has been promoted. The spec at [`docs/architecture/typed-standards-specification.md`](../docs/architecture/typed-standards-specification.md) remains the single source of truth; where this bundle and the spec disagree, the spec governs.
