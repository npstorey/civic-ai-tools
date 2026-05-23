# ADR-0006: Producer Profile architecture — subtypes / flavors and the production-process attestation reframe

- **Status:** Proposed
- **Date:** 2026-05-23
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR-0004](0004-dathere-captureMethod-variant.md) introduced `contentProfile: "datHere"` and specified the A-G envelope (initial prompt + system prompts + model card + deliberative trace + answer notebook + rendered answer + summary) as the content shape of the `datHere` content profile. [ADR-0005](0005-executed-notebook-architecture.md) specified the executed-notebook architecture as the production path for section E within that profile. Both ADRs frame `datHere` as a value of the `contentProfile` field on the evidence package.

The internal Typed Standards proposal (`typed-standards-proposal.md`) §3 introduces a layered architecture distinguishing **Content Profiles** (typed-content carriers — Typed Claims / Typed Evidence / Typed Questions) from **Producer Profiles** (e.g., AI-Assisted Analysis). §9 explicitly flags an unresolved boundary:

> *"The `contentProfile` field's semantics under the new layering. The field today (`default` | `datHere`) addresses content shape — legacy JSON vs. A-G envelope. The proposed Content Profiles axis carries typed content carriers — Typed Claims / Typed Evidence / Typed Questions. Two related concepts on the same name; the new framing keeps both but the boundary needs spec text."*

The structural shape of the A-G envelope is *what gets tracked during analytical production* — initial prompt, system prompts, model card and environment, deliberative trace, notebook, rendered answer, summary — a **production-process attestation pattern**, not a typed-content-carrier classification. The output of an A-G production process is unstructured / untyped content (raw analytical output rendered as markdown + executed cells), not decomposed into typed claims, questions, or evidence. A *secondary attested-extraction step* — itself a feature of the producer profile, not of any content profile — decomposes that untyped output into typed nodes per the §6 typed-node ontology.

The Pittsburgh / WPRDC pilot integration arc (scoped at [`docs/proposals/data-concierge-integration.md`](../proposals/data-concierge-integration.md), filed as [`npstorey/civic-ai-tools#69`](https://github.com/npstorey/civic-ai-tools/issues/69)) has matured to a point where the integration partner is positioned to produce conformant packages on their own infrastructure, with the standard named publicly as the trust framework backing their pipeline output. With a second producer joining the reference implementation, the Producer Profile axis becomes load-bearing: different producers conform to the same envelope + capture-method discipline but follow different conventions outside the envelope's normative scope — visualization stack, citation format, entity normalization, synthesis style, confidence-scoring methodology. These conventions live in producer-profile-specific *guidance bundles*, not in the envelope spec.

A single Producer Profile vocabulary value cannot represent this multi-adopter reality. Both the reference implementation and the integration partner conform to the same envelope and (after ADR-0004) the same content-shape profile; both qualify as AI-Assisted Analysis producers; but their conventions on visualization, citation, entity normalization, and synthesis-cell phrasing differ in material ways. A consumer who trusts one set of conventions may not extend the same trust to another. The standard needs a way to express "two producers, same producer-profile family, different subtypes / flavors" so consumers can filter and hosts can declare which subtypes they accept on publication.

The Xanadu doctrine is satisfied. The integration partner is the named adopter motivating the promotion of the Producer Profile axis from `reserved` to `specified` and the introduction of a subtype / flavor model. Without the subtype model, the integration arc cannot represent the partner's conventions as distinct from the reference implementation's even though both packages would carry the same envelope and the same content-profile label under the existing framing.

This ADR (a) introduces a `producerProfile` field at the top level with a compound-string `<profile-type>/<profile-subtype>` value shape, (b) refactors the existing `datHere` content profile as the first subtype of the AI-Assisted Analysis Producer Profile, (c) reframes the A-G envelope as a production-process attestation shape rather than a content-shape variant, (d) names the untyped → typed extraction step as a Producer Profile feature aligned with the typed-standards-proposal §6 typed-node ontology, (e) establishes the principle of producer-profile-specific guidance bundles, and (f) preserves the existing `contentProfile` field as a backwards-compatible legacy alias. The resolution of the typed-standards-proposal §9 "boundary needs spec text" callout lands as a consequence.

## Decision

Introduce a new top-level field `producerProfile` on the evidence package, specify a compound-string value shape with first-version vocabulary, refactor the existing `datHere` content profile as the first subtype of the AI-Assisted Analysis Producer Profile, reframe the A-G envelope as a production-process attestation shape, and establish the principle of producer-profile-specific guidance bundles. Preserve `contentProfile` as a backwards-compatible legacy alias.

### 1. New field and value shape

Add an optional `producerProfile` field at the canonical-JSON top level alongside the existing top-level fields. The value is a **compound string** of the form `<profile-type>/<profile-subtype>`. The field lives at the package's canonical-JSON top level (`producerProfile`), parallel to the existing top-level `contentProfile` field per ADR-0004 §1's placement convention; the value is covered by the canonical-JSON hash and signed under the existing trust-registry keys, making the Producer Profile label tamper-evident. The `captureMethod` field lives one level deeper inside `metadata` per ADR-0003; this ADR follows the `contentProfile` placement precedent (top-level) rather than the `captureMethod` placement (inside `metadata`) because `producerProfile` is conceptually parallel to `contentProfile` and a future refactor may unify the two fields' placement.

Vocabulary plan (open enum; extended by subsequent ADRs naming their motivating adopter):

- **Profile types reserved:**
  - `ai-assisted-analysis` — *built* (this ADR; the existing implementation IS the first realized profile type).
  - `human` — *reserved, name-only*. Human-produced analysis without an AI agent in the synthesis loop. No realized implementation.
  - `hybrid` — *reserved, name-only*. Mixed human + AI production. No realized implementation.
  - `sandbox-only` — *reserved, name-only*. Future Producer Profile for packages whose content is produced entirely by a sandbox-executed pipeline without an interactive synthesis step. Conceptually adjacent to the future Sandbox capture method named in the typed-standards-proposal §8 (reserved). No realized implementation.

- **Subtypes of `ai-assisted-analysis` reserved:**
  - `datHere` — *built* (this ADR; refactor of the existing content profile from ADR-0004).
  - `civicaitools-default` — *reserved, name-only*. Would specify the civicaitools.org default conventions if/when they diverge from `datHere` enough to need a separately-named subtype. No realized divergence today.
  - Future adopter subtypes — each new adopter whose conventions differ enough from existing subtypes to need a distinct trust signal gets its own subtype added by a subsequent ADR.

Subtype names are open; the standard does not pre-allocate names. Each subtype's normative properties (guidance bundle contents, required conventions) live in the ADR that introduces it.

### 2. Backwards compatibility via legacy alias

The existing `contentProfile` field is preserved as a legacy alias:

- **Pre-ADR-0006 packages** emit `contentProfile: "default"` or `contentProfile: "datHere"` and do not emit `producerProfile`. Verifiers continue to honor the existing values. Such packages remain verifiable byte-identical; the package hash and signature are unaffected by this ADR.

- **Post-ADR-0006 packages** emit BOTH `contentProfile` AND `producerProfile`. A package that would have been `contentProfile: "datHere"` under the previous framing emits `contentProfile: "datHere"` AND `producerProfile: "ai-assisted-analysis/datHere"`. A package that would have been `contentProfile: "default"` continues to emit `contentProfile: "default"` and omits `producerProfile` (the legacy default content shape carries no Producer Profile commitment).

- **Consistency invariant.** When both fields are present, they MUST be consistent: `contentProfile === "datHere"` if and only if `producerProfile.startsWith("ai-assisted-analysis/datHere")`. A verifier encountering inconsistency MUST report the package as malformed.

- **Verifier behavior.** Verifiers SHOULD prefer `producerProfile` when present and fall back to `contentProfile` otherwise. Surfaces rendering the package label SHOULD show the more specific `producerProfile` value when available.

- **Schema version unchanged.** Schema version stays at `0.1.0`. Eventual deprecation of `contentProfile` in favor of `producerProfile` is gated on [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec) (schema version bump trigger).

### 3. A-G envelope reframed as a production-process attestation shape

The A-G envelope (introduced in ADR-0004 §2) describes *what gets tracked during analytical production*: initial prompt + system prompts + model card and environment + deliberative trace + answer notebook + rendered answer + summary. In the new framing, this is a **production-process attestation pattern** — a structural commitment about how the production process was captured and signed, not a content-shape variant.

- The A-G envelope is a requirement of the `ai-assisted-analysis/datHere` subtype, not of "the datHere content profile."
- OES §9.1's existing normative requirements (full-text prompt, system prompt present, environment metadata present, notebook present, rendered answer present, summary present, content-profile label) are preserved verbatim. Only the section's framing language changes via a follow-on OES revision; this ADR's accompanying OES amendment adds a forward-pointer callout, and a full rewrite of §9.1 in producer-profile terms is deferred to a future OES revision per the "small, focused changes" discipline.
- The Content Profiles axis from the typed-standards-proposal §3 (typed-content carriers — Typed Claims / Typed Evidence / Typed Questions) is preserved as a distinct concept. The existing `contentProfile` field's overloading is acknowledged by maintaining backwards-compat (§2 above) rather than refactoring the field's semantics in a single move.

This reframe resolves the typed-standards-proposal §9 "boundary needs spec text" callout: the A-G envelope structurally belongs to the Producer Profile axis, not to the Content Profiles axis as defined.

### 4. The output of an A-G production process is `untyped` content

Per the typed-standards-proposal §6 typed-node ontology (reserved), content nodes carry a set-valued `metadata.contentType` across `claim` / `question` / `evidence` / `untyped`. A `producerProfile: "ai-assisted-analysis/datHere"` package's content is `untyped`: the rendered answer (A-G section F) is raw analytical output rendered as markdown plus executed cells, not yet decomposed into typed claims, questions, or evidence.

A separately-signed evidence package that decomposes the untyped content into typed nodes is the **attested-extraction step** — itself a feature of the AI-Assisted Analysis Producer Profile. The extraction package's content carries `metadata.contentType: ["claim"]` (or `["claim", "question"]`, etc.); its provenance carries `prov:wasDerivedFrom` pointing at the original untyped package by content hash; its envelope carries an `AnalyticalDerivation` describing the extraction method (which model performed the typing, against what prompt, over which source span). This is the typed-standards-proposal §6 classification-laundering guard, applied to the AI-Assisted Analysis Producer Profile output.

The extraction step is not implemented today. This ADR establishes the spec framing: the existing `ai-assisted-analysis/datHere` Producer Profile output is `untyped`, and any downstream typed-content carrier (Typed Claims Profile package, Typed Evidence Profile package, Typed Questions Profile package) attesting against an `ai-assisted-analysis/datHere` package MUST carry the prov:wasDerivedFrom + AnalyticalDerivation guard. Implementation lands when a real adopter needs the typed-content carrier downstream, per Xanadu doctrine; tracked under Q5, Q10, Q11, and Q31 in the open-questions registry.

### 5. Producer Profile subtype guidance bundles

Each subtype names a bundle of guidance documents specifying conventions outside the envelope's normative scope. The bundle is the per-subtype source of truth for "how do producers conforming to this subtype actually shape their output?" — covering choices the envelope is deliberately silent about.

Examples of conventions a subtype's guidance bundle might specify:

- **Visualization stack.** Vega-Lite vs. matplotlib vs. plotly vs. mixed. The envelope does not require any specific stack; the subtype's bundle does, when subtype-level uniformity matters for consumers.
- **Citation format.** Government style, academic style, civic-data citation, or a custom format. Producers conforming to the subtype follow the bundled convention.
- **Entity normalization.** For civic-data analyses: Data Commons DCID identifiers, Socrata dataset IDs, OpenContext slugs, or a mix. The subtype's bundle declares which identifier family is canonical for that subtype's outputs.
- **Synthesis-cell phrasing conventions.** Length, prose style, mandatory vs. optional caveats, how computed values are referenced.
- **Confidence-scoring methodology.** A subtype's guidance bundle may specify which confidence-scoring scheme (if any) producers conforming to that subtype should attach as a sibling attestation package (per ADR-0006 §6: confidence is not in the envelope).

The `ai-assisted-analysis/datHere` subtype's guidance bundle is reserved as a future specification. Concrete guidance documents in scattered locations today (`civic-ai-tools/docs/skills/web.md`, the executed-notebook architecture plan, future per-domain extensions, the integration partner's authoritative guidance for their own implementation) MAY be referenced from the bundle once the routing convention is specified.

v0.1 of this ADR establishes the principle of subtype-specific guidance bundles. The specific routing convention — how subtypes reference bundles, how bundles are versioned and distributed, how SDKs consume them, where bundles are hosted, how a verifier confirms a producer is actually following a declared bundle — is deferred to a future ADR. Tracked as [Q32](../architecture/open-questions.md#q32--producer-profile-guidance-doc-routing-convention) in the open-questions registry.

### 6. Subtype trust framing

Subtypes are signals consumers can filter on. A consumer or third-party verifier can express trust in `ai-assisted-analysis/datHere` while declining to extend the same trust to `ai-assisted-analysis/<other-subtype>` — even though both produce envelope-conformant packages.

- The standard does not compute trust verdicts; it surfaces the subtype label, and consumers apply judgment per the normative preamble ("the system surfaces signals; the consumer applies judgment").
- Host self-attestation (Q22; proposed-issue 008) is the natural mechanism for a host to declare which Producer Profile subtypes it accepts on publication, and for consumers to filter accordingly.
- This ADR does not specify host-side subtype gating; that lands when the host-self-attestation work matures.

Confidence-scoring schemes (e.g., the five-factor confidence model an integration partner uses) are not part of the envelope and not part of the subtype label. Confidence lives as a separately-signed typed-attestation evidence package referencing the original by content hash. This framing is consistent with the typed-standards-proposal §6 attestation node family (reserved) and the future adversarial-eval-as-publication-gate ADR (anticipated from civic#72).

### 7. ADR-0005's `notebookProvenance` discriminator stays orthogonal

The `extensions["org.civicaitools.notebook"].provenance` sub-field (`"skeleton"` | `"executed"`) introduced by ADR-0005 §2 / OES §9.1.4 remains a notebook-extension property, not a Producer Profile field.

- A `producerProfile: "ai-assisted-analysis/datHere"` package can be either skeleton (the v0 implementation from civic-ai-tools-website PR #103) or executed (the implementation introduced by ADR-0005 from PR #104 onward). Both forms satisfy the `ai-assisted-analysis/datHere` subtype's normative requirements.
- Verifiers continue to read `notebookProvenance` from the notebook extension. The discriminator stays where ADR-0005 §2 placed it.
- The two axes (Producer Profile subtype vs. notebookProvenance) are orthogonal: subtype names *who/how* the analysis was produced; notebookProvenance names *what kind of notebook artifact* the package's section E carries. Both are tamper-evident; both are properties of the same package; they do not collapse into a single field.

### 8. The skeleton-notebook path stays valid under the refactored framing

The skeleton-notebook path from civic-ai-tools-website PR #103 (and the executed-notebook path from PR #104) both produce `ai-assisted-analysis/datHere`-subtype packages under the new framing. The subtype label does not gate on notebookProvenance; the OES §9.1.1 normative requirements are met by either form (per ADR-0005 §1's clarification that the notebook may be either skeleton or executed). The two paths coexist indefinitely.

This is structurally identical to ADR-0005 §4's framing; this ADR only restates it in the new Producer Profile vocabulary.

## Considered and rejected alternatives

- **Single Producer Profile without subtypes.** Rejected. Doesn't represent the actual multi-adopter reality. Different adopters' conventions on visualization, citation, entity normalization, synthesis style, confidence-scoring methodology differ enough to warrant filterable subtypes; collapsing them into a single "AI-Assisted Analysis" label loses real signal. Consumers and hosts need the subtype level to express which conventions they trust.

- **Refactor `contentProfile` semantics in a single move (breaking change).** Rejected as the v0.1 move. Too disruptive for backwards-compat with existing tooling that references `contentProfile`. The cleaner long-term semantics — `contentProfile` reserved for typed-content carriers (Typed Claims / Typed Evidence / Typed Questions), `producerProfile` for production-process attestation — would force migration of every package produced under ADR-0004. Migration thinking deferred to a future MINOR schema version bump per Q27.

- **Deprecate `contentProfile` entirely in this ADR.** Rejected as v0.1 move for the same backwards-compat reasons. Loudest break with the smallest gain at this point in the standard's maturity. Eventually viable at a future MAJOR or MINOR version bump.

- **Nested object for `producerProfile` (`{ type, subtype, ... }`).** Rejected. Compound string is simpler to read in JSON tooling and CLI inspection; verifiers parse `/` once; nested object adds ceremony without enough payoff at v0.1. Future spec versions MAY refactor to a nested object if subtype-specific metadata starts to accumulate substantially.

- **Two separate fields (`producerProfile` + `producerProfileSubtype`).** Rejected. More explicit but verbose; the slash-separated compound is idiomatic for hierarchical naming patterns (cf. MIME types, content types, URN namespaces).

- **Specify the guidance-doc routing convention in this ADR.** Rejected as scope creep. The routing convention is its own design problem — how subtypes reference docs, how docs version, how SDKs consume them, where bundles are hosted, how verifiers confirm conformance. Promoted to Q32 in the open-questions registry; resolves via a future ADR with a named adopter need.

- **Move ADR-0005's `notebookProvenance` discriminator to the producerProfile field.** Rejected. The two are orthogonal axes. Producer Profile names *who/how* the analysis was produced; notebookProvenance names *what kind of notebook artifact* the package's section E carries. Both are properties of an `ai-assisted-analysis/datHere` package, but mixing them into one field loses signal and forces awkward vocabulary combinations.

- **Bundle the multi-node-per-package decision into this ADR.** Rejected. Multi-node-per-package (charts as their own evidence nodes; one query producing multiple typed nodes linked by relations) is a separate structural concern that would affect the packager, the bundle endpoint, the detail-page rendering, and the cross-host commitment view. Promoted to Q33 in the open-questions registry as an idea worth exploring, not yet ready for ADR. Future ADR lands the decision if a real adopter motivates it.

- **Generalize beyond AI-Assisted Analysis in this ADR.** Rejected. The Producer Profile type vocabulary (`ai-assisted-analysis`, `human`, `hybrid`, `sandbox-only`) is enumerated at the principle level here; only `ai-assisted-analysis` has a realized implementation. Specifying the other types now is premature per the Xanadu doctrine. Each future profile type lands in its own ADR with the motivating adopter named.

- **Specify confidence-scoring shape in this ADR.** Rejected. Confidence lives as a separately-signed typed-attestation evidence package per §6 above; the shape and methodology of confidence-scoring schemes is per-subtype (named in the subtype's guidance bundle) and per-adopter. The standard does not mandate a single confidence model. The adversarial-eval-as-publication-gate ADR (anticipated from civic#72) covers the publication-time interactions; this ADR establishes that confidence is not envelope content.

## Consequences

- **OES amendment (small).** §9.1 retains its current normative content (still authoritative for what `ai-assisted-analysis/datHere` requires) but gains a forward-pointer callout noting that the section will be reframed as `producerProfile: "ai-assisted-analysis/datHere"` requirements in a future OES revision. §4.1 (top-level fields table) gains a `producerProfile` row alongside the existing `contentProfile` row, with the legacy-alias relationship documented. No normative requirement changes today; only framing language.

- **Typed-standards-proposal amendments (medium).** §3 Architecture (mermaid diagram + prose) updated to show Producer Profile subtypes; AI-Assisted Analysis Producer Profile moves from "reserved" to "specified" with `datHere` as the first built subtype. §6 typed-node ontology gains explicit framing that the untyped → typed extraction step is a Producer Profile feature, with the AI-Assisted Analysis Producer Profile being the first one to specify the extraction step. §8 status section updated. §9 "boundary needs spec text" callout resolved with link to this ADR.

- **Open-questions registry updates.**
  - **Q31** (existing — skeleton vs. executed metadata distinction): clarifying note added that the distinction is orthogonal to producerProfile; both skeleton and executed notebooks satisfy the `ai-assisted-analysis/datHere` subtype.
  - **Q32** (new): Producer Profile guidance-doc routing convention specifics. Open. Deferred to future ADR.
  - **Q33** (new): Visualizations and other analytical artifacts as their own evidence nodes (multi-node-per-query). Open; idea worth exploring; not ready for ADR.

- **Phase 3 implementation surface (scoped, not done here).**
  - Packager extension (`civic-ai-tools-website/src/lib/evidence/packager.ts`): emit `producerProfile` alongside `contentProfile` for packages following the `ai-assisted-analysis/datHere` subtype. Add `producerProfile?: string` to the `EvidencePackage` interface and `PackageInput`. The packager auto-emits `producerProfile: "ai-assisted-analysis/datHere"` when `contentProfile === "datHere"` is set on input, and validates the consistency invariant.
  - `/api/evidence` route (`civic-ai-tools-website/src/app/api/evidence/route.ts`): accept `producerProfile` in request body; if absent and `contentProfile === "datHere"`, default to `"ai-assisted-analysis/datHere"`. Validate the consistency invariant; return `400` on mismatch.
  - Bundle endpoint (`GET /api/evidence/:slug/bundle`): continues to gate on `contentProfile === "datHere"` for backwards-compat; verifiers may also accept gating on `producerProfile.startsWith("ai-assisted-analysis/datHere")` once tooling consumes the new field.
  - Detail page (`civic-ai-tools-website/src/app/evidence/[slug]/page.tsx`): surface the `producerProfile` label near the `captureMethod` label (both are tamper-evident production-discipline labels). The Phase 2a1 IMPL chat covers the chat-output rendering surface; this is the same surface in the detail-page context.

- **Phase 2b dropped from the executed-notebook architecture plan.** The publish-time trigger (originally Phase 2b in `executed-notebook-architecture-project-plan.md` §4.2, §5.1 N6b/N6c, §6 Phase 2b, §9 issue plan) is removed from the v1 implementation path. The chat-input trigger (Phase 2a + 2a1) demonstrates the capability; publish-time adds mental-model complexity (the T₀/T₁ reconciliation thread that was partially reframed in v1.3 of the plan) for marginal capability gain. ADR-0005 §6's "two trigger surfaces" framing stays accurate in spirit — publish-time IS still possible as a future implementation, just not built in v1 — so no ADR-0005 rewrite is needed. The project plan is updated to mark Phase 2b deferred / dropped; the edit is folded into the same workflow that lands this ADR (the plan doc is workspace-root and local-only).

- **Backwards compatibility (no DB migration).** Pre-ADR-0006 packages remain verifiable byte-identical. They omit `producerProfile`; verifiers fall back to `contentProfile`. Post-ADR-0006 packages emit both fields; verifiers check the consistency invariant. Schema version stays at `0.1.0`. No backfill of the legacy `evidence_records` rows.

- **Sister ADRs.**
  - The future attest/publish lifecycle ADR (from [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71)) lands the publication-record + adversarial-eval-as-publication-gate work; it interacts with this ADR's subtype framing (host policy may declare which subtypes require expert review on publication).
  - The future unified node primitive ADR (anticipated alongside [civic-ai-tools#70](https://github.com/npstorey/civic-ai-tools/issues/70)) may refine the typed-node ontology this ADR cites; the Producer Profile subtype model is forward-compatible with that work and does not depend on its outcome.
  - The future adversarial-eval requirement model ADR (from [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72)) operationalizes confidence scoring as attached attestations — consistent with this ADR's framing that confidence is not in the envelope but is a sibling typed-attestation evidence package referencing the original by hash.
  - A future ADR may resolve Q33 (multi-node-per-package) if a real adopter motivates the work. Numbering deferred to creation order.

- **Build-state coloring.** AI-Assisted Analysis Producer Profile moves from "reserved" to "specified" in `typed-standards-proposal.md` §3 / §8 status section. The `datHere` subtype moves to "built" because the existing implementation (ADR-0004 + ADR-0005 + civic-ai-tools-website PR #103 + PR #104 + PR #105) IS the first realized subtype, just under the legacy `contentProfile` field name. The `producerProfile` field itself moves to "built" once Phase 3 IMPL chat ships the packager + route changes. The `end-state-vision.md` build-state update follows the implementation, per project convention.

- **API documentation.** `civic-ai-tools-website/docs/api/evidence-publish.md` gains a section documenting `producerProfile` as an optional request field that the route may default-fill when `contentProfile === "datHere"` is provided. The consistency invariant is documented as a `400` failure mode.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the captureMethod discipline and the tamper-evident labeling principle that the Producer Profile label follows.
- [ADR-0004](0004-dathere-captureMethod-variant.md) — introduces the `datHere` content profile and the A-G envelope; refactored by this ADR as the first Producer Profile subtype (`ai-assisted-analysis/datHere`). The OES §9.1 normative requirements introduced by ADR-0004 are preserved verbatim; only the framing language changes via the accompanying OES amendment.
- [ADR-0005](0005-executed-notebook-architecture.md) — specifies the executed-notebook architecture within the `datHere` profile; under the new framing this work lives inside the `ai-assisted-analysis/datHere` subtype. The `notebookProvenance` discriminator stays where ADR-0005 §2 placed it, orthogonal to Producer Profile.
- `civic-ai-tools/docs/architecture/typed-standards-proposal.md` — §3 Architecture (Producer Profile subtypes), §6 typed-node ontology (extraction step is a Producer Profile feature), §8 status (Producer Profile moves to specified), §9 ("boundary needs spec text" resolved). All amended in the same workflow that lands this ADR.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §9.1 (forward-pointer callout added), §4.1 (producerProfile row added). Amended in the same workflow.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q32 (guidance-doc routing) and Q33 (multi-node-per-package) added; Q31 cross-reference updated.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied; the named adopter is the Pittsburgh / WPRDC pilot integration partner.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path followed (Q32 / Q33 added in the same commit that drafts this ADR; the Producer Profile axis moves from reserved → specified per the working method's promotion conventions).
- `civic-ai-tools/docs/proposals/data-concierge-integration.md` — the integration-arc proposal whose downstream work crystallized the Producer Profile axis as load-bearing.
- `executed-notebook-architecture-project-plan.md` (workspace root, local-only) — v1.4 → v1.5 update marks Phase 2b dropped. The plan-doc edit is folded into the workflow that lands this ADR.
