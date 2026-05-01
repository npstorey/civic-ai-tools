# Xanadu doctrine

**Status:** Doctrine. Cited by ADRs and spec drafts; not itself an ADR.
**Companion:** Glossary entry in `civic-ai-tools/docs/architecture/end-state-vision.md` (search for "Xanadu test (doctrine)").

---

## The doctrine

**Xanadu test (doctrine).** Project discipline: do not promote anything in the spec to a higher build state without a real package that needs it. Named after Project Xanadu, a hypertext system originally proposed in 1960 that accumulated decades of unimplemented features and design ambitions before shipping a small subset many years later. Apply the test as a binary gate at three transitions: (1) speculative → designed, (2) designed → built, (3) built → required for adopters. The criterion at each transition is the same: an existing or imminent real-world package or adopter must concretely need the change. The following do *not* satisfy the criterion: hypothetical future use cases, "wouldn't it be cool if...", a chat conversation about possible directions, a single funder asking whether you support X, or a self-imposed sense that the spec is incomplete. The following *do* satisfy the criterion: an existing adopter blocked from publishing without the change, a real package whose verification fails without the change, or a concrete pending integration with a named upstream/downstream project that requires the change. Items that fail the test stay in research-doc form only — no implementation, no ADR, no spec text — until they pass. Failed items can be re-tested at any time when conditions change.

---

## How to apply

The doctrine is a **gate**, not a vibe. Three things change when an item passes the gate at a given transition:

1. The item moves to the next build state in `end-state-vision.md` (color changes from speculative → designed → built; the corresponding diagram nodes update).
2. Implementation work becomes appropriate (an ADR, a draft spec, code).
3. The motivating package or adopter is named in the work that promotes the item — so the test is auditable after the fact.

If any of those three is missing, the gate has not been passed and the item stays where it was.

### Worked example: `claims.jsonld`

Today, `claims.jsonld` (the optional file in evidence packages containing typed claims that conform to CACO + zero or more domain extensions) is **designed, not built**. A v0.1 draft spec exists at `civic-ai-tools/docs/architecture/claims-ontology-draft-spec.md`. No code generates `claims.jsonld`. No published evidence package contains one.

The next gate is **designed → built**. The criterion that would fire it: at minimum one real adopter package whose verification or claim queries are blocked without `claims.jsonld`. Concretely, any of the following would satisfy:

- A published evidence package whose author wants to assert structured trend or comparison claims that prose alone cannot make machine-comparable, and who is willing to author the file.
- An external collaborator (Boston OpenContext, datHere, an academic partner) committing to consume typed claims from civic-ai-tools packages as part of a named integration, where the integration cannot proceed without typed claims existing.
- A `guidance-quality` issue surfacing a real failure mode that typed claims would resolve (e.g., a published package whose unstructured claims could not be corroborated against a competing package's claims, blocking a meta-analysis the project committed to).

The following **do not** satisfy:

- A funder conversation in which typed claims came up as interesting.
- A self-imposed sense that the spec feels incomplete without `claims.jsonld` shipping.
- An external party expressing curiosity about whether the project supports CACO.
- An ADR being drafted (drafting an ADR is *itself* downstream of the gate passing, not a substitute for it).

While the gate has not fired, `claims.jsonld` stays in research-doc / draft-spec form only. The CACO domain-extensions portfolio doc (proposed in `civic-ai-tools-website/docs/proposed-issues/003-caco-domain-extensions-portfolio.md`) is permitted because it is itself a research-doc — it scopes what extensions would look like, but does not implement any. The extensions portfolio is also gated by this doctrine: each extension passes its own gate independently.

### Worked example: `upstream-evidence.json`

Same shape as `claims.jsonld` — designed, not built, no real package needs it yet. The gate is the same: a real package must depend on declaring an `upstream-evidence` relationship (`derived_from`, `compares_to`, `extends`, `replicates`, `contradicts`, `evaluates`) for verification or downstream consumption. Re-test when an adopter or a `guidance-quality` issue surfaces a concrete need.

---

## When the doctrine has been violated

A violation looks like an ADR drafted, a schema field added, or spec text shipped *before* a real package or adopter need has been named. The fix is not always to roll back — sometimes the item turns out to have been needed all along. The fix is to:

1. Identify what real package or adopter is now using the item, and document it.
2. If no real package or adopter exists, mark the item as deferred or remove it. Document the removal so future-self does not re-add the same speculative item again.
3. Note the violation in the ADR or spec history so the audit trail is visible.

---

## Relationship to the rest of the project

- `civic-ai-tools/ROADMAP.md` Section 3 commitments (verifiability, release cadence) are **not** subject to this doctrine. They are absolute commitments that hold regardless of adopter need. The doctrine governs *spec growth*, not *trust commitments*.
- ADR-0001 (roadmap governance) and ADR-0002 (commitments vs. targets) describe the project's stance on commitments. This doctrine governs the standards stack and the spec.
- The doctrine intentionally does not gate research documents (`docs/research-agenda.md`, `docs/research/*`). Research is a precursor to passing the gate, not a violation of it.

---

## References

- `civic-ai-tools/docs/architecture/end-state-vision.md` — glossary entry, build-state coloring, open questions.
- `civic-ai-tools/docs/architecture/claims-ontology-draft-spec.md` — the worked example above.
- `civic-ai-tools-website/docs/proposed-issues/003-caco-domain-extensions-portfolio.md` — applies the doctrine as a promotion criterion for domain extensions.
- `civic-ai-tools/docs/adr/` — ADRs cite this doc by URL when their decisions involve a Xanadu-test gate.
