# ADR-0015: Adversarial-evaluation publication gate — host policy + default-on, presence-based

- **Status:** Proposed (records a decision whose reference implementation has already shipped and been verified in production code review; flips to Accepted on review of this ADR)
- **Date:** 2026-06-12
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

[Q25](../architecture/open-questions.md#q25--adversarial-evaluation-requirement-strength-on-publication-records) (adversarial-evaluation requirement strength on publication records) and [Q26](../architecture/open-questions.md#q26--valid-evaluator-definition-identity-binding--methodology-declaration) (valid evaluator definition) were promoted to [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72), whose stated resolution criterion is "an ADR documenting the decision + reference implementation." This is that ADR. It is deliberately post-hoc: the decision was ratified in the Phase 1 integration-contract review ([civic-ai-tools-website#138](https://github.com/npstorey/civic-ai-tools-website/pull/138), `docs/api/evidence-publish.md`) and the reference implementation shipped and was verified in [civic-ai-tools-website#140](https://github.com/npstorey/civic-ai-tools-website/pull/140) (2026-06-12), with the dashboard promotion UI in [civic-ai-tools-website#142](https://github.com/npstorey/civic-ai-tools-website/pull/142). The ADR records the decision and its rationale so #72 can close per its own criterion; it cites the ratified `attestation/evaluates/v1` shape (spec §8.12.1, [ADR-0009](0009-unified-typed-attestation-primitive.md) §7) and does not grow the spec.

The gating point this ADR operationalizes — publication as the emission of `attestation/publishes/v1` (+ `attestation/locatedAt/v1`) under the attest-by-default / publish-by-choice lifecycle — exists because [ADR-0010](0010-visibility-lifecycle-location-attestations.md) operationalized it and the Phase 2 reference implementation ([civic-ai-tools-website#139](https://github.com/npstorey/civic-ai-tools-website/pull/139)) built it. The Xanadu gate is satisfied by the collaborator integration arc itself: the integration partner's pilot publish flow (issue #72 scope item 6) and civicaitools.org's own publish flow both needed the gate's semantics fixed before partner-side engineers could implement the consumer-side check.

## Decision

### 1. Requirement strength: host policy + default-on at the publisher tool (Q25 options b + c), not protocol-mandatory

The protocol does **not** require an adversarial evaluation for a publication record to be valid. Instead:

- **(b) Host policy.** Hosts MAY declare, in their host self-attestation, that they require conforming evaluation references on publication records they serve — the `requiresAdversarialEvalOnPublication` field (`false` | `true` | structured `{ required, minOverallScore, minEvaluatorBindingTier }`), whose v1 shape is fixed in the integration contract (`civic-ai-tools-website/docs/api/evidence-publish.md`). Host-side *enforcement* (refusing to serve eval-less publication records) activates when the host self-attestation pattern ships (proposed-issue 008 / [Q22](../architecture/open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape), still open); the field shape is fixed now so consuming partners can implement the check.
- **(c) Default-on at the publisher tool.** civicaitools.org's publication step (`POST /api/evidence/:slug/publish`) runs the adversarial evaluation **by default** and emits the signed `attestation/evaluates/v1` node before creating the publication pair. Opting out is explicit (`{"runEvaluation": false}` on the API; an unchecked toggle in the dashboard promotion dialog). An evaluation *failure* (evaluator unreachable, malformed response) aborts the publish loudly (`502`) — never a silent skip — preserving gate integrity while keeping the documented opt-out as the only ungated path.

Protocol-mandatory (option a) is rejected: baking one evaluation methodology's presence into protocol-level validity would ossify a methodology at the layer least able to evolve it, and would make every non-AI or differently-evaluated adopter non-conformant by construction.

### 2. The gate is presence-based; `attestation/publishes/v1` is unchanged

A conforming evaluation is an `attestation/evaluates/v1` node **targeting the same content node** (`targetNodeId` equal to the publication record's `targetNodeId`), with a valid signature, a methodology declaration, and a signer meeting whatever binding-tier floor the consuming host declares. The publication record carries **no pointer to the evaluation** — the relationship is the shared target. This keeps `publishes/v1` exactly at its ratified §8.12.1 payload (`targetNodeId`, `publicationHost`, `releasedAt`).

The explicit-reference alternative (a `referencedEvaluationNodeIds`-style field on the publishes payload, registered as the 2026-06-11 note under Q25) is **decided against for v0.1**: it would change a ratified payload shape for marginal gain — "which evaluations exist for this node" is already answerable by querying evaluations over the shared target, and "which evaluation did the publisher rely on" is consumer-side filtering (by methodology, signer, timestamp) rather than publisher assertion. Revisit trigger: a host policy that requires *publisher-designated* (rather than merely present) evaluations — that would need the pointer and lands as a payload-shape amendment with its own motivating adopter.

### 3. Valid evaluator (Q26): envelope-signer binding + required methodology declaration; no central registry

- **Identity binding rides the envelope `signer`** ([ADR-0009](0009-unified-typed-attestation-primitive.md) §4): the evaluator's `bindingTier` / `identifier` are the attestation envelope's signer fields, cross-checked against the trust registry like any signer. Issue #72's `evaluatorBindingTier` *content* field is deliberately not implemented — duplicating the binding in the payload would create a consistency hazard between two signature-covered claims about the same fact.
- **Methodology declaration is required payload content**: `methodology.testSet` (rubric identifier), `methodology.promptSetVersion` (the SHA-256 of the rubric text, pinning the exact prompt set that produced the scores inside the signed payload), `methodology.evaluatorModel`, and `scoringRubric`. The v1 methodology is the existing six-criterion adversarial rubric (`civicaitools-adversarial-rubric/six-criterion-v1`); the declaration supports any test set — nothing privileges this rubric.
- **No central registry of approved evaluators.** Anyone with an identity binding may evaluate (the `specific-role-required` rule is satisfied by the methodology declaration + binding, not by appearing on a roster); consumers and hosts filter on `signer.bindingTier` and methodology specifics. This preserves the federation property Q26 named and avoids the single-trusted-evaluator gatekeeping failure mode.
- **Evaluator independence**: the evaluator model MUST differ from the model that produced the analysis. The reference implementation enforces this (caller-supplied evaluator equal to the analysis model → `400`; the default evaluator falls back to an alternate when the analysis itself used the default).

### 4. v1 gate semantics: presence, any score

The publisher-tool gate requires the evaluation to *exist and conform*, not to score above a threshold. A low-scoring analysis publishes with its low score attached and fully disclosed (the Phase 3 verification run demonstrated exactly this: a fabricated smoke analysis scored 2.3/10 and published with the score rendered on its detail page). Score thresholds are a **host-policy axis** (`minOverallScore` in the structured `requiresAdversarialEvalOnPublication` form), not a platform constant — score semantics are methodology-relative, and a protocol- or platform-level floor would smuggle one rubric's calibration into a universal judgment.

## Considered and rejected alternatives

- **Protocol-mandatory evaluation (Q25 option a).** Rejected per §1 — ossifies a methodology at the protocol layer; punishes adopters with different evaluation regimes.
- **Explicit evaluation-reference field on `publishes/v1`.** Rejected for v0.1 per §2 — ratified-payload change for marginal gain; consumer-side filtering suffices; revisit trigger named.
- **Minimum-score gating at the publisher tool.** Rejected per §4 — score semantics are methodology-relative; presence + disclosure is the honest v1; thresholds belong to host policy.
- **Central evaluator registry / approved-evaluator roster.** Rejected per §3 — gatekeeping risk; the federation property (diverse evaluators, consumer-side weighting) is the designed protection.
- **Silent skip when the evaluation fails.** Rejected per §1 — a gate that silently opens under error is not a gate; failure is loud, the opt-out is explicit and recorded in the request.
- **`evaluatorBindingTier` as payload content (issue #72's original wording).** Rejected per §3 — the envelope signer already carries the binding; duplication is a consistency hazard.
- **Wiring the gate into direct published-mode creation (`POST /api/evidence` with `visibility: "published"`).** Rejected for v1, deliberately: the default UI path is committed-first (civic-ai-tools#71 scope item 7), so the default user journey passes through the gated promotion step; direct published-mode (API back-compat, the dialog's explicit "Publish now") stays ungated, consistent with not-protocol-mandatory. Documented as a known asymmetry in the integration contract; a host that wants no ungated path expresses that via its self-attestation.

## Consequences

- **civic-ai-tools#72 resolution criterion met** (ADR + reference implementation) — the issue can close, citing this ADR and the shipped PRs (#138 contract, #140 gate + signed `evaluates` nodes + detail-page surface, #142 promotion UI).
- **Registry:** [Q25](../architecture/open-questions.md#q25--adversarial-evaluation-requirement-strength-on-publication-records) and [Q26](../architecture/open-questions.md#q26--valid-evaluator-definition-identity-binding--methodology-declaration) move to the Resolution log (both criteria are met by this ADR + the shipped implementation; Q26's per-tier identity-binding schemas remain with [Q3](../architecture/open-questions.md#q3--first-non-github-identity-provider) as before).
- **No spec amendment.** Choosing host-policy + default-on *means* no normative change is required: the `attestation/evaluates/v1` row in §8.12.1 was ratified by [ADR-0009](0009-unified-typed-attestation-primitive.md) and stands as-is; the gate is publisher-tool behavior plus the host-policy field shape, both documented in the integration contract (`civic-ai-tools-website/docs/api/evidence-publish.md`). The one registered naming divergence in the arc (`targetContentHash` on `locatedAt`, [Q48](../architecture/open-questions.md#q48--attestationlocatedatv1-payload-contenthash-name-collision-with-the-structural-primitive)) is independent of this ADR and stays open.
- **Build-state coloring:** `attestation/evaluates/v1` moves from "specified — taxonomy registered" to **built** (emission, gating, rendering, and independent re-verification all shipped).
- **Host-side enforcement deferred with its owner:** serving-refusal per `requiresAdversarialEvalOnPublication` lands with the host self-attestation work (proposed-issue 008 / Q22), which remains Xanadu-gated on a host-self-attestation adopter.

## References

- [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72) — the tracker whose resolution criterion this ADR satisfies; [#41](https://github.com/npstorey/civic-ai-tools/issues/41) introduced the adversarial attestation type this operationalizes at publication time.
- [ADR-0009](0009-unified-typed-attestation-primitive.md) §5/§7 — authorization-rule taxonomy and the ratified `attestation/evaluates/v1` payload row; [ADR-0010](0010-visibility-lifecycle-location-attestations.md) — the publication gating point.
- `civic-ai-tools-website/docs/api/evidence-publish.md` — the integration contract carrying the wire shapes (evaluates payload, gate semantics, host-policy field).
- [civic-ai-tools-website#138](https://github.com/npstorey/civic-ai-tools-website/pull/138) (contract), [#139](https://github.com/npstorey/civic-ai-tools-website/pull/139) (lifecycle + publication pair), [#140](https://github.com/npstorey/civic-ai-tools-website/pull/140) (the gate: shared rubric core, signed `evaluates` emission, presence-based gating, CAS double-publish guard, detail-page rendering), [#142](https://github.com/npstorey/civic-ai-tools-website/pull/142) (dashboard promotion UI with the eval toggle).
- `civic-ai-tools/docs/architecture/open-questions.md` — Q25 + Q26 resolved by this ADR; Q22 (host self-attestation) and Q48 unaffected.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied by the collaborator integration arc (partner publish flow + civicaitools.org publish flow).
