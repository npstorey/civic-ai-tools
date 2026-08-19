# ADR-0025: "Evidence" is retired from the artifact and infrastructure surface, and retained as the epistemic QEC role

- **Status:** **Accepted** 2026-08-19 (owner rulings received in-session at the [civic-ai-tools#160](https://github.com/npstorey/civic-ai-tools/issues/160) settlement gate, after a verified four-repo anchor census; this record lands with the v0.1.5 spec patch revision that executes the spec-side half)
- **Date:** 2026-08-19
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0016](0016-vcs-native-lifecycle-mapping.md) (the `committed`→`sealed` / `published`→`public` value rename — the narrow, aliased precedent this settlement is the endpoint/contract/brand-scale analog of), [ADR-0012](0012-typed-standards-consolidation.md) (the trust-registry rename's parallel-serve, byte-identical-alias pattern, which the settlement's alias classes generalize), [ADR-0014](0014-evidence-system-fork-resolution-path-b.md) (the two-identity split: the neutral protocol is Typed Standards; this settlement settles the civic instance's resource noun on its side of that line)

*Numbering note: 0018 remains reserved for the roadmap-governance amendment; 0019–0024 are taken (confirmed against `origin/main` at drafting time).*

## Context

Registry [Q50](../architecture/open-questions.md#q50--evidence-product-framing-vs-precise-typed-node-resource-naming) (registered 2026-06-15) named the problem: "evidence" pervades the API/URL/DB/skill surface while the thing those names point at is, in the typed ontology, a `content/analysis/v1` node — so the word both **under-specifies** (the published default is an analysis) and **collides** with the reserved QEC `content/evidence/v1` sub-type. [Q66](../architecture/open-questions.md#q66--project-glossary-and-controlled-vocabulary-for-prose-across-the-four-repos) named the surrounding cost: vocabulary decisions landing piecemeal and being re-derived instead of consulted.

Q50 was deliberately held rather than resolved reactively — a clarity preference is not a Xanadu trigger ([xanadu-doctrine.md](../architecture/xanadu-doctrine.md)). What changed:

1. **A deeper defect than imprecision was named.** "Evidence" as the artifact and infrastructure brand **overclaims**: a signed record under the specification shows *how* an answer was produced, not that the answer is correct, and the brand position invites exactly the corroboration-equals-truth reading the spec's §5.1 normative preamble exists to prevent.
2. **The freeze risk became concrete.** The one live external adopter is approaching a public release milestone; shipping the old vocabulary inside a released external product would harden exactly the usage the settlement pre-empts. The spec is in pre-launch private review — the correct window for a naming revision.
3. **The census existed.** A verified anchor sweep across all four repos (2026-08-18, re-derived at current mains at the sprint's G1 gate) enumerated every surface, so the decision could be taken on measured scope rather than impression.

## Decision

### A. Scoping principle (Group F): two roles, one retained

"Evidence" plays two unrelated roles, and the settlement separates them on principle rather than sweeping by string match:

- **Artifact / infrastructure brand** (package noun, route segments, env-var prefix, wire version key, exported types and functions, OAuth scope, skill name, sidecar filename): **excised**. The record shows how an answer was produced, not that it is correct.
- **Epistemic role** in the Question / Evidence / Claim triad (`content/evidence/v1`; the `contentType` value `"evidence"`; `supportedBy` / `opposedBy` targets): **retained**. Content serving as evidence-for-a-claim is the legitimate, Discourse-Graphs-derived use.

The spec records this boundary at §6.3 and Appendix J.1 so it reads as principled, not accidental.

### B. The naming block (gate ruling D1)

`RecordPackage` · `verifyRecord` · `records:publish` (pluralization deliberate) · `publish-record` · `.record.yaml` · §8.1 "Record package structure" · `records-publish.md` / `records-commitment.md` with old-name stubs · routes `/api/records/*` + `/records/*` · env prefix `PUBLISHER_*` · wire key `protocolVersion` · `urn:civic-record:` · `https://civicaitools.org/ns/civic/` · `org.civicaitools.record`.

### C. Per-surface rulings and migration shapes

The canonical, phase-citable enumeration is the spec's **Appendix J** (mapping table + migration-class definitions + normative dual-era rules), landed by the same patch revision as this record. Summary of the rulings:

| # | Surface | Ruling | Migration shape |
|---|---|---|---|
| A | 14 `EVIDENCE_*` env vars (reference implementation; includes the written-not-read `EVIDENCE_PUBLIC_KEY`, missed by the charter's preflight-derived count of 13) | → `PUBLISHER_*` | Expand-then-flip: read new-then-old with deprecation warning; docs/preflight/deploy surfaces flip; old drops at a later major. The successor of `EVIDENCE_TRUST_REGISTRY_URL` gains a documentation home in the same sweep. |
| B | `/api/evidence/*` routes + `/evidence/*` pages | → `/api/records/*`, `/records/*` | New canonical segments; old segments are **permanent** aliases (published links exist in the wild). Publish responses emit new-form URLs; the neutral verifier learns new-then-old resolution in the same sprint. |
| C | `evidenceProtocolVersion` wire key | → `protocolVersion` | Frozen-in-signed-artifacts: old records keep the old key forever; verifiers accept both keys for both eras; new emissions use the new key; cutover coordinated with the one live external adopter. |
| D | DB names (`evidence_records` + constraints/indexes); blob prefixes (`evidence-packages/`, `evidence-refs/`, `evidence-packages/committed/`) | **Exempt — recorded, not renamed** | Internal/frozen: DB names never cross the wire; blob addresses are hash-frozen inside signed fields. The exemption is a ruling, not an omission. |
| E | `urn:civic-evidence:` scheme + `https://civicaitools.org/ns/evidence/` vocabulary URI | → `urn:civic-record:` + `…/ns/civic/` | Frozen-in-signed-artifacts: existing graphs keep their identifiers; both eras valid; golden fixtures re-freeze; the `typedstandards.org/ns/ts#` alignment stays with [Q10](../architecture/open-questions.md#q10--civic-claim-vocabulary-as-a-full-ontology), explicitly not pre-judged. |
| F | Spec QEC vocabulary | **Retained** (epistemic role) | No change beyond the recorded rationale; §8.1 retitles and `.evidence.yaml` renames in the same patch. |
| G | `EvidencePackage`, `verifyEvidence`, `evidence:publish`, `publish-evidence` (+ its User-Agent and client display name) | **Alias-and-deprecate** | New names beside deprecated old; both work; token endpoints accept both scopes and mint the new; old names drop at each package's next major. Exempt-frozen: the live kid `platform:evidence-2026-04` (next rotation names its key under the new vocabulary; no forced rotation) and OTel scope names inside already-signed traces. |

### D. Gate rulings of record (sprint G1, 2026-08-19)

- **D2** — `/.well-known/evidence-public-keys.json`: exempt-frozen, recorded — the legacy leg of the **already-completed** trust-registry rename (ADR-0012); not renamed again.
- **D3** — `org.civicaitools.evidence` extension namespace: **dual-era, accepted forever** (deliberate, against the default recommendation): new emissions mint `org.civicaitools.record`; the old key is accepted with no drop horizon.
- **D4** — the dated 2026-07 talk deck: frozen as a dated record.
- **D5** — neutral-verifier site UI prose: falsified-statements-only this sprint; a follow-up issue for the full excision is filed as part of the sprint's records.
- **D6** — stale references to the former spec name fix to the current spec name + verified section numbers (§8.7 family), independent of the rename (stale under ADR-0012).
- **D7** — the working census accepted with corrections: 14 env vars (not 13); the verify-core wire-key read site does not exist (the dual-key obligation is emitter-and-spec-side); the spec's version header appears twice; the §2 citation line named the milestone tag rather than the patch-revision tag.

### E. Dual-era verification rules

Normative text at spec Appendix J.4: (1) old records keep their old keys and identifiers forever — rewriting a frozen identifier would change the envelope hash and invalidate the signature; (2) verifiers treat both eras as valid, and era is not a trust signal; (3) new emissions use the new vocabulary post-cutover; (4) **expand before any flip** — no migration phase may create a state where an existing verifier, link, token, or record stops resolving.

### F. Header-semver precision (external-integrator rider)

The spec's two version blocks carry the full patch version and its tag name (`v0.1.5` / `v0.1.5-typed-standards-spec`), and the §2 citation guidance points integrators at the patch-revision tag rather than the coarse draft number or the consolidation-milestone tag. An external integrator embedding a version identifier from the document itself gets the precise revision.

## Considered and rejected

- **Rename everything, including frozen surfaces.** Rejected: identifiers inside already-signed artifacts cannot change without invalidating signatures; DB names and blob prefixes never cross the wire, so renaming them buys nothing and risks the storage layer. Exemptions are recorded as rulings so they read as decisions, not misses.
- **Excise the epistemic QEC vocabulary along with the brand.** Rejected: the QEC role is precise, attributed, and load-bearing (§7.5); sweeping it would trade an overclaim for an underclaim. The two-roles principle (§A) is the boundary.
- **Deprecation windows on the route aliases.** Rejected: published links exist in the wild; the aliases are permanent, per the trust-registry parallel-serve precedent (ADR-0012).
- **Defer until after the external adopter's public milestone.** Rejected as the default (held as the fallback): shipping the old vocabulary inside a released external product hardens exactly the usage this settlement pre-empts — the Q50 freeze risk made concrete.
- **A "fresher" brand word without the census.** Rejected: the settlement was taken on the measured four-repo census, with every stated fix-shape re-verified at current mains (the premise-check rider), not on preference — the promotion discipline of [working-method.md](../architecture/working-method.md).

## Consequences

- **The spec-side half is executed by the v0.1.5 patch revision** (same change set as this record): §8.1 retitle, glossary, §6.3 two-roles disambiguation, Appendix J (mapping + migration classes + dual-era rules), the §8.8 dual-era serializations, the annotated frozen examples, and the header-semver fix. Registry Q50 moves to Resolved; Q66 gains a settled-term record.
- **Code-side halves land in later phases of the #160 sprint** (typedstandards expand, reference-implementation expand, harness flip + skill rename, website cutover, three-surface skill sync), each phase citing Appendix J. Nothing in this record is self-executing: expand lands and verifies before any flip, per §E rule 4.
- **The reference implementation is temporarily ahead-of/behind the spec on emission vocabulary.** Until its cutover lands, it emits prior-era keys and namespaces — conformant under the dual-era rules, and stated as such in the spec (§8.8.1, §8.8.2). This is the deliberate expand-before-flip window, not drift.
- **Q50's "stop digging" rule becomes general practice:** new surfaces mint `record`/`records` vocabulary; nothing new is named with the artifact-brand "evidence."
- **Prose and UI copy carry a residue** the occurrence-sweep classes do not cover: brand-role usages that nothing falsifies but the excision targets (the census's UI-prose leg). The neutral-verifier site's full excision is a filed follow-up (ruling D5); remaining repos sweep in their sprint phases.
- **Historical records stay historical.** Frozen snapshots, dated ADRs (including ADR-0003's filename and this repo's earlier decision records), completed-sprint records, and the dated talk deck keep their vocabulary per the historical-record doctrine; this record does not rewrite them.

## References

- [civic-ai-tools#160](https://github.com/npstorey/civic-ai-tools/issues/160) — the settlement charter, its riders, and the G1 gate record (census re-derivation + rulings D0–D7).
- Typed Standards Specification v0.1.5 — §6.3 (two-roles disambiguation), §8.1 (retitle), §8.8.1–§8.8.3 (dual-era serializations), Appendix J (canonical mapping + dual-era rules), Appendix G (revision entry).
- [Q50](../architecture/open-questions.md#q50--evidence-product-framing-vs-precise-typed-node-resource-naming), [Q66](../architecture/open-questions.md#q66--project-glossary-and-controlled-vocabulary-for-prose-across-the-four-repos) — the registry entries this settlement resolves and extends.
- [xanadu-doctrine.md](../architecture/xanadu-doctrine.md) — the gate this decision waited on: resolved when a real adopter milestone and a concrete freeze risk forced it, not on preference.
- [working-method.md](../architecture/working-method.md) — the promotion path this decision followed: registry entry (Q50, held deliberately) → execution anchor (#160) → this ADR → spec revision.
- [ADR-0016](0016-vcs-native-lifecycle-mapping.md) §A, [ADR-0012](0012-typed-standards-consolidation.md), [ADR-0014](0014-evidence-system-fork-resolution-path-b.md) — the rename, alias, and identity-split precedents.
