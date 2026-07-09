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

## Suggested reading order

1. `00-formal-model.md` — establish the shared, neutral model.
2. `01-typed-standards-as-shacl.md` with `shapes/typed-standards.shacl.ttl` open alongside it.
3. `02-typed-standards-as-sysml-v2.md` with `sysml/typed-standards.sysml` open alongside it.
4. `03-formalism-comparison.md` — the synthesis, boundary, and recommendation. Readers who only want the conclusion can start here and follow its references back.

## Status

Exploratory research framing, produced 2026-06-24. This is **not** a normative addition to the Typed Standards Specification. It does **not** change the spec or any ADR, and it introduces no new requirements. It is a study artifact in the sense of the [xanadu-doctrine](../docs/architecture/xanadu-doctrine.md): the two framings are non-committal viewpoints, each with an explicit promotion trigger named in `03-formalism-comparison.md`, and neither has been promoted. The spec at [`docs/architecture/typed-standards-specification.md`](../docs/architecture/typed-standards-specification.md) remains the single source of truth; where this bundle and the spec disagree, the spec governs.
