# ADR-0011: captureMethod generalization — open enum at core, per-profile vocabulary

- **Status:** Proposed
- **Date:** 2026-05-25
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR-0003](0003-evidence-capture-method.md) introduced the `metadata.captureMethod` field and enumerated three values — `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report` — each naming an AI-publishing surface that exists today (the website chat flow, the Claude Code skill, and the legacy paraphrased-self-report path the skill was migrated away from). The field is required, signed, and tamper-evident; that part of ADR-0003 stands. The value space, however, is a closed enum at the spec's core level — and the names of the three values anchor on the publishing surfaces of one Producer Profile (AI-Assisted Analysis) rather than on any property the standard's core actually wants to commit to.

[ADR-0006](0006-producer-profile-architecture.md) §5 established the principle that each Producer Profile carries a **guidance bundle** of documents specifying conventions outside the envelope's normative scope — visualization stack, citation format, entity normalization, synthesis-cell phrasing, confidence-scoring methodology. That principle is the right home for the AI-publishing-surface-specific values; it is not the right home for a captureMethod field constrained at the core level to three values that two new prospective adopters would never use.

Two prospective adopters in early discussions are blocked by the closed core enum:

**A second prospective collaborator in early discussions** (referenced neutrally per the workspace stakeholder/relationship-content boundary). Their pipelines emit captureMethod values describing **product-testing protocols**, not AI-publishing surfaces. The three current values don't apply; there is no escape valve in the closed enum.

**A third prospective collaborator in early discussions** (also referenced neutrally per the boundary). Their pipelines emit captureMethod values describing **data-ingestion pipelines**, not AI-publishing surfaces. Same problem.

Both adopters' content-production paths satisfy the structural property the captureMethod label exists to surface — *how the package's content was captured, named at the layer that delivers the guarantee* — but neither produces content via an AI-mediated synthesis loop. The three AI-publishing-surface-named values are a hard block on cross-sector portability for these adopters. This is the single most-important item for cross-sector positioning per the 2026-05-25 strategic memo §3.

The 2026-05-25 strategic memo §3 "Restructure existing in-flight work" row for captureMethod names this directly:

> *captureMethod generalized in core; AI-specific values move to the AI-Assisted Analysis Producer Profile guidance bundle. ADR-0006's Producer Profile architecture already establishes that subtype-specific guidance bundles carry per-profile conventions. captureMethod's value space (currently `chat-flow-stream` / `claude-code-jsonl-readback` / `claude-code-self-report`, all AI-publishing-surface-named) belongs in the `ai-assisted-analysis` Producer Profile's guidance bundle, not the core enum. **Core keeps the field; profile owns the values.** This is the cleanest answer to Q9 (AI-specific commitments inventory) and the most direct hedge against n=1 / AI-shaped-core.*

The Xanadu gate is satisfied. Two named (neutrally) adopters are blocked on the same generalization. The captureMethod label's core-level structural property (*the field is required; the value names the capture mechanism at a layer where the guarantee actually holds; the value is signature-covered and therefore tamper-evident*) is preserved. Only the value space changes: from a closed enum hardcoded in core to an open field whose vocabulary is declared per Producer Profile.

This ADR is one of the cohort the 2026-05-25 memo §5 sequencing item 5 names: *"captureMethod generalization (small OES amendment + ADR-0006 §5 guidance-bundle update). Generalize the field's value space in OES §9; move the three current AI-publishing values into the `ai-assisted-analysis` Producer Profile guidance bundle. Resolves Q9 (AI-specific commitments inventory) for the captureMethod field specifically. Other AI-specific fields (cost shape, skillMetadata shape) can follow the same pattern in subsequent passes — track in Q9 as a checklist."* This ADR is the smallest cohort in the G1-G4 sequence; it lands as one ADR + one OES amendment + one ADR-0006 §5 cross-ref + open-questions updates.

This ADR does NOT supersede [ADR-0003](0003-evidence-capture-method.md). ADR-0003's core decisions stand intact:

- captureMethod is required at the publish route; missing or unknown values reject with 400.
- The value is part of `metadata.captureMethod` in canonical JSON, covered by the envelope hash and the platform signature — tamper-evident by construction.
- The verbatim-by-construction framing and the field carve-out for inherently-model-authored fields (`title`, `summary`) are unchanged.
- Pre-ADR-0003 packages continue to render with the `Unknown (pre-ADR-0003)` label.

This ADR amends only the **value space** at the core level (closed enum → open) and the **vocabulary owner** (core → per-profile guidance bundle), with the three existing values relocated to the AI-Assisted Analysis Producer Profile's v0.1 vocabulary without changing their semantics or the packages that already carry them.

## Decision

Generalize captureMethod's value space at the core level: the enum becomes open. Move the three existing values into the AI-Assisted Analysis Producer Profile's v0.1 captureMethod vocabulary, declared as part of that profile's guidance bundle per [ADR-0006](0006-producer-profile-architecture.md) §5. Specify that verifiers check captureMethod against the vocabulary declared by the package's `producerProfile` (falling back to `contentProfile` via the ADR-0006 §2 legacy alias). Preserve backwards-compat for every existing package.

### 1. captureMethod field value space generalized at the core level

OES §9's normative statement changes from:

> *"A conformant evidence package published after 2026-04-29 MUST carry exactly one of the following values in `metadata.captureMethod`: `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`."*

to:

> *"A conformant evidence package published after 2026-04-29 MUST carry exactly one of the values declared by the captureMethod vocabulary of the package's `producerProfile`'s guidance bundle (per [ADR-0011](../adr/0011-capturemethod-generalization.md)). For the `ai-assisted-analysis` Producer Profile, the v0.1 vocabulary is `chat-flow-stream`, `claude-code-jsonl-readback`, and `claude-code-self-report` — the values originally enumerated in core by ADR-0003 and relocated to this profile's guidance bundle by ADR-0011 §2 below."*

The structural properties of the field are unchanged: the value is required, part of canonical JSON, covered by the envelope hash and the platform signature, and labeled in a way that lets a verifier reason about *what guarantee the value carries* (verbatim-by-construction at some layer; product-test-protocol-attested at some layer; data-ingestion-pipeline-attested at some layer; etc.) without the standard's core enumerating the surfaces.

The verifier's check that the field is present and well-formed (a single string from the package's `producerProfile`'s declared captureMethod vocabulary) becomes one of the §13.1 checks; the verifier resolves the producerProfile → guidance bundle → captureMethod vocabulary lookup via the same local registry mechanism Q32 anticipates for guidance-doc routing in general. For v0.1, the only Producer Profile with a built guidance bundle is `ai-assisted-analysis`, which declares the three values above; non-AI Producer Profile types (Human, Hybrid, Sandbox-only) are reserved name-only per ADR-0006 §1 and their captureMethod vocabularies are declared when those profiles are promoted to built per their motivating-adopter ADRs.

### 2. The three existing values become the AI-Assisted Analysis Producer Profile's v0.1 vocabulary

The three existing captureMethod values move to the `ai-assisted-analysis` Producer Profile's guidance bundle as that profile's v0.1 captureMethod vocabulary:

- **`chat-flow-stream`** — wire-layer capture by the publishing platform as the model streams to the calling client. Verbatim by construction at the wire layer.
- **`claude-code-jsonl-readback`** — JSONL-layer readback by a publishing client (typically a Claude Code skill) of each turn's content and per-invocation usage from the session JSONL on disk. Verbatim by construction at the JSONL layer.
- **`claude-code-self-report`** — Legacy. The publishing model paraphrased the original session from in-context memory. Deprecated by ADR-0003 as of 2026-04-28; retained as a vocabulary value so packages predating ADR-0003 can be re-rendered with their actual capture method labeled rather than silently re-described.

The semantics of each value are unchanged from ADR-0003. Only the **scope** changes — these are now values of the `ai-assisted-analysis` Producer Profile's vocabulary, not values of a global core enum. The verifier behavior (`Captured via:` label rendered near the signature-verification verdict, per ADR-0003 Consequences and OES §9) is unchanged.

Vocabulary scope: per the in-session G4 decision, the captureMethod vocabulary is declared at the **profile-type level** (`ai-assisted-analysis`), not per-subtype. The three values above apply to all subtypes of `ai-assisted-analysis` — the existing `datHere` subtype, the reserved `civicaitools-default` subtype, and any future AI-Assisted Analysis subtypes — unless a subtype's guidance bundle explicitly constrains or extends the parent vocabulary. v0.1 has no subtype-level overrides.

Future AI-publishing surfaces (a hook-based path that records bytes at message-emission time, a third-party signed self-attestation, an MCP-host-agnostic capture protocol, etc.) extend the `ai-assisted-analysis` Producer Profile's vocabulary by amending its guidance bundle, not by touching OES core. The bundle's amendment surface — versioning, distribution, content-addressing — is governed by [Q32](../architecture/open-questions.md#q32--producer-profile-guidance-doc-routing-convention) (Producer Profile guidance-doc routing convention).

### 3. Per-profile vocabulary lookup rule (verifier behavior)

A verifier validating a package's captureMethod:

1. Reads the package's `producerProfile` (per ADR-0006 §1); if absent and `contentProfile === "datHere"` is present, treats the producerProfile as `ai-assisted-analysis/datHere` per ADR-0006 §2 legacy alias; if both `producerProfile` and `contentProfile` are absent (pre-ADR-0006 / pre-ADR-0011 packages), treats the producerProfile as `ai-assisted-analysis` (the implicit profile type of pre-existing packages, all of which were AI-mediated by construction).
2. Resolves the producerProfile's guidance bundle via the local rule registry mechanism Q32 anticipates.
3. Confirms the package's `metadata.captureMethod` value is in the captureMethod vocabulary declared by that bundle.
4. Reports `captureMethod_unknown` and rejects the package if the value is not in the declared vocabulary; reports `producerProfile_bundle_unresolved` and degrades gracefully (the value is preserved verbatim on the detail page; the structural integrity check still passes; only the vocabulary-conformance assertion is unverified) if the bundle cannot be resolved.

For pre-ADR-0011 packages, the resolution falls through to the `ai-assisted-analysis` Producer Profile's v0.1 vocabulary, which contains exactly the three values ADR-0003 originally enumerated; every pre-ADR-0011 conformant package therefore verifies byte-identical under the new rule.

### 4. Backwards-compatibility via ADR-0006 §2 legacy alias

Every existing package with one of the three current captureMethod values remains valid:

- **Post-ADR-0006 packages** emit both `producerProfile` and `contentProfile`. Their `producerProfile` is either `ai-assisted-analysis/datHere` (when `contentProfile === "datHere"`) or, when `contentProfile === "default"` or absent and the package was AI-mediated, falls into the `ai-assisted-analysis` profile-type's default vocabulary scope by construction. The captureMethod vocabulary lookup resolves to the three v0.1 values above. Verification succeeds.
- **Pre-ADR-0006 packages** (which emit `contentProfile` but no `producerProfile`) resolve via the §3 step-1 fallback: `contentProfile === "datHere"` ⇒ `ai-assisted-analysis/datHere` per ADR-0006 §2 legacy alias; `contentProfile === "default"` (or absent) ⇒ `ai-assisted-analysis` (the implicit profile-type for all pre-ADR-0006 packages, all of which were AI-mediated). Either way, the captureMethod vocabulary lookup resolves to the same three values. Verification succeeds.
- **Pre-ADR-0003 packages** persist with a null `metadata.captureMethod` column and render with the `Unknown (pre-ADR-0003)` label per ADR-0003 Consequences §1 (as amended 2026-04-29). This ADR does not change that handling; the null-and-legacy-label path is orthogonal to the value-space generalization.

Schema version stays at `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec). No DB migration is required. No re-signing of any existing package is required. The envelope-hash and signature of every existing package are unchanged byte-for-byte.

### 5. Q9 partial-resolution scoping; pattern established for follow-on AI-specific fields

[Q9](../architecture/open-questions.md#q9--ai-specific-commitments-and-producer-type-generalization) (AI-specific commitments inventory and producer-type generalization) resolves for the captureMethod field specifically: the field is now generalized in core; AI-specific values live in the `ai-assisted-analysis` Producer Profile's guidance bundle.

Q9 stays Open overall because the inventory contains other AI-specific fields that have not yet been generalized:

- `cost` object schema (token-billed-LLM-shaped; OES §4.7).
- `skillMetadata` (presupposes a system-prompt + MCP-server + skill-text concept; OES §4.1).
- The `caco:AnalyticalDerivation` requirement (presupposes an LLM-prose-to-structured-claim translation step; reaches into the Civic Claim Vocabulary draft + ADR-0006 §4).
- Some BlobRef field choices (OES §4.5 / ADR-0010 §2).

Each of these follows the **same pattern** ADR-0011 establishes here: the field stays in core as a producer-profile-agnostic shape; the AI-specific values move to the `ai-assisted-analysis` Producer Profile's guidance bundle. Each resolution is its own ADR with its own motivating adopter named. The pattern is now the canonical answer to the inventory.

[Q7](../architecture/open-questions.md#q7--producer-type-scope) (Producer-type scope) gets a clarifying note: the direction has crystallized as option (c) from Q7's three candidates — producer-type-agnostic core + AI-specific Producer Profile + reserved name-only future profile types (Human, Hybrid, Sandbox-only) — via the [ADR-0006](0006-producer-profile-architecture.md) + ADR-0011 pairing. Q7 stays Open because the trigger condition (a non-AI publisher actually publishes through this standard, *and* the need surfaces structurally) is still unmet; the two prospective adopters whose blocked pipelines motivated this ADR are in early discussions, not yet shipping. Q7 will resolve when the first non-AI Producer Profile is promoted from reserved to built.

## Considered and rejected alternatives

- **Keep the closed enum at core; extend it with new non-AI values.** Rejected. Adding `product-testing-protocol-X` and `data-ingestion-pipeline-Y` to OES §9 enumeration baked into the spec's core would lock the standard into n=N-shaped surfaces forever — every new adopter's surfaces would require a core spec amendment. The strategic memo §6 doctrine guardrail #2 (n=1 / AI-shaped-core hedge) is directly violated. Profile-bound vocabularies are the right home; the core should commit to the field's existence and structural property, not to the surfaces.

- **Add per-subtype vocabulary declaration rather than per-profile-type.** Rejected (per the in-session G4 decision, recorded in §2 above). Per-subtype would mean every `ai-assisted-analysis/datHere`, `ai-assisted-analysis/civicaitools-default`, and future-subtype bundle has to independently declare the same three values; backwards-compat for pre-ADR-0006 packages (which lack `producerProfile` and may map to either subtype) becomes ambiguous. Per-profile-type with subtype-level override-only-when-needed is cleaner and matches the brief's framing.

- **Wait for Q7 (producer-type scope) to fully resolve before generalizing captureMethod.** Rejected. Q7's resolution criterion (a non-AI publisher actually shipping) hasn't fired; the captureMethod block on cross-sector portability for two named adopters is concrete and current. Q7's direction is already crystallized (option (c)) via the ADR-0006 + ADR-0011 pairing; pre-committing the captureMethod generalization that Q7's direction implies is the right move per the per-field pattern §5 establishes.

- **Mint a separate `captureSurface` field on non-AI Producer Profiles rather than reusing captureMethod.** Rejected. The structural property captureMethod exists to surface — *how the content was captured, named at the layer where the guarantee actually holds* — is profile-agnostic. A product-testing-protocol-attested capture and an LLM-wire-layer capture both name a capture mechanism at a layer where the guarantee holds; renaming the field per profile fragments the verifier's reasoning surface for no semantic gain. One field; per-profile vocabulary.

- **Specify the AI-Assisted Analysis Producer Profile's guidance bundle in this ADR.** Rejected as scope creep. The bundle's routing convention, hosting, versioning, and content-addressing are Q32 work; the bundle itself is a follow-on document once Q32 resolves. This ADR establishes that the bundle owns the captureMethod vocabulary; the bundle's full contents (visualization stack convention, citation format convention, entity-normalization convention, synthesis-cell-phrasing convention, plus the captureMethod vocabulary) accumulate as ADR-0006 §5 anticipated.

- **Hardcode `producerProfile`-to-vocabulary mapping in the verifier (skip the bundle lookup entirely for v0.1).** Rejected. The bundle-lookup framing is the right long-term shape per ADR-0006 §5 and Q32; hardcoding the v0.1 mapping in the verifier would be a tactical-shortcut that creates a migration debt when the bundle distribution mechanism actually ships. The §3 lookup rule's graceful-degradation behavior (`producerProfile_bundle_unresolved` reports + value preserved verbatim + structural-integrity check still passes) is the correct v0.1 verifier behavior; the bundle distribution mechanism falls behind v0.1 conformance, not vice versa.

- **Bundle the cost / skillMetadata / AnalyticalDerivation / BlobRef generalizations into this ADR.** Rejected. Smallest cohort per the brief; each AI-specific field follows the same pattern in its own ADR with its own motivating adopter named. Q9 stays Open as a checklist (§5 above).

## Consequences

- **OES amendment (small).** §3 captureMethod definition gains a co-equal *"Specified by [ADR-0003] (field shape, signing, tamper-evidence) + [ADR-0011] (value-space generalization, per-profile vocabulary)"* pointer. §9 main prose rewrites the normative-vocabulary statement per §1 above and reframes the forward-extensibility callout (the three values are now `ai-assisted-analysis`-profile vocabulary; future AI-publishing surfaces extend the profile's bundle; non-AI Producer Profile vocabularies live in their own bundles). §9.1.1 item 7 reframes the captureMethod parenthetical to point at the per-profile vocabulary rather than naming the three values. §13.1 verifier-check list gains a new check for per-profile vocabulary conformance (degrades gracefully when the bundle cannot be resolved). §17 gains a 2026-05-25 G4 revision-history entry. §18 related-documents list extended with ADR-0011.

- **ADR-0006 amendment (micro).** §5 example list of conventions a subtype's guidance bundle might specify gains an explicit *captureMethod vocabulary* entry, with a forward-pointer to ADR-0011 for the operationalization.

- **typed-standards-proposal amendment (small).** §8 line 242 (which currently names the three values in the body of the document) is reframed: the discipline statement (captureMethod field is required, signed, tamper-evident) stays; the three values pivot to the AI-Assisted Analysis Producer Profile's v0.1 vocabulary per ADR-0011, with the per-profile vocabulary mechanism named. §8 line 272 (currently "A future Sandbox capture method as the highest-attestation capture tier") is reframed: the Sandbox capture mechanism is reserved as a future entry in the `sandbox-only` Producer Profile's captureMethod vocabulary, not a "highest-attestation capture tier" alongside the core. No mermaid diagrams change (captureMethod stays a core field; only its value-space ownership shifts to per-profile bundles).

- **open-questions registry updates.** Q9 status updated with the partial-resolution-for-captureMethod inventory entry + remaining-items checklist (cost / skillMetadata / AnalyticalDerivation / BlobRef) + resolution-criteria amendment naming the per-field pattern. Q7 gains a clarifying note that direction has crystallized as option (c) via the ADR-0006 + ADR-0011 pairing; stays Open. Q32 gains a one-line note that captureMethod-vocabulary-distribution is one specific kind of guidance-bundle content the routing convention will need to support (per the in-session G4 decision; no new Q-number minted).

- **No ADR-0003 amendment.** ADR-0003 stays Accepted; its decisions (introduce the field, require it, label it, sign it, verbatim-by-construction principle, field carve-out for inherently-model-authored fields, pre-ADR-0003 packages render `Unknown (pre-ADR-0003)`) are unchanged. ADR-0011 amends only the value-space ownership; the per-profile bundle is where the v0.1 vocabulary now lives. ADR-0003's Consequences §1 (legacy-default clause) and the related history note stay verbatim.

- **No schema version bump.** Schema version stays at `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec). Pre-ADR-0011 packages verify byte-identical under §4 above. Eventual deprecation of the AI-only captureMethod vocabulary at core is gated on a non-AI Producer Profile actually shipping; the bump trigger remains Q27.

- **Phase 3 IMPL surface (scoped, not done here; spec-only per this chat's scope).** The reference-implementation packager (`civic-ai-tools-website/src/lib/evidence/packager.ts`) continues to emit one of the three values; no code change is required at v0.1 because the resulting packages remain in the `ai-assisted-analysis` profile's vocabulary. The publish-route validator (`POST /api/evidence` request validation) continues to enforce the v0.1 vocabulary; reframing the validator to look up the vocabulary via producerProfile rather than hardcoding the three values is a follow-on IMPL item once Q32 resolves and the bundle-distribution mechanism ships. The detail-page label rendering is unchanged. The MCP tool definitions in `civic-ai-tools-website/src/lib/mcp/tools.ts` are not in scope.

- **Adopter-blocked check satisfied.** The two named (neutrally) prospective collaborators' pipelines can now declare their own Producer Profile types (under the reserved names per ADR-0006 §1, or as new types added by their own motivating ADRs) and their own captureMethod vocabularies in their respective guidance bundles, without negotiating a core-spec enum extension. The cross-sector portability block named in the strategic memo §3 row for captureMethod is cleared at the spec level; promotion of either adopter's Producer Profile from reserved to built is gated on Xanadu (real shipping pipeline), not on this spec change.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the captureMethod field, the required-and-signed discipline, the verbatim-by-construction principle, and the original three vocabulary values. This ADR does not supersede ADR-0003; it amends only the value-space ownership.
- [ADR-0006](0006-producer-profile-architecture.md) — introduces the Producer Profile axis + per-subtype guidance bundle principle (§5) + legacy-alias relationship between `producerProfile` and `contentProfile` (§2). This ADR operationalizes the guidance-bundle-owns-captureMethod-vocabulary pattern.
- [ADR-0009](0009-unified-typed-attestation-primitive.md) — the G2 unified-primitive cohort that established the principle that core is content-agnostic and structural. ADR-0011 is the same principle applied to captureMethod's value space.
- [ADR-0010](0010-visibility-lifecycle-location-attestations.md) — the G3 visibility/lifecycle/location cohort, which operationalized the lifecycle/location subset of ADR-0009 §7. ADR-0011 is the smallest cohort in the same G1-G4 sequence per the 2026-05-25 strategic memo §5.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §3 + §9 + §9.1.1 + §13.1 + §17 + §18 amended in the same commit that lands this ADR.
- `civic-ai-tools/docs/architecture/typed-standards-specification.md` — §8 (lines 242 + 272) amended in the same commit.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q9 partial-resolution-for-captureMethod entry; Q7 clarifying note; Q32 one-line note about captureMethod-vocabulary-distribution as a sub-concern. All amended in the same commit.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied; two named (neutrally) prospective adopters are blocked on the value-space generalization.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path followed (Q9 / Q7 / Q32 registry updates in the same commit that drafts this ADR; the captureMethod field's value-space moves from "closed enum at core" to "open at core with per-profile vocabulary" per the working method's promotion conventions).
- 2026-05-25 strategic memo (workspace root: `docs/architecture-incorporation-memo-2026-05-25.md`) — §3 "Restructure existing in-flight work" row for captureMethod (the motivating spec move); §5 sequencing item 5 (the cohort framing); §6 doctrine guardrail #2 (n=1 / AI-shaped-core hedge that this generalization addresses).
