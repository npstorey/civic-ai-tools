# ADR-0014: Resolve the evidence-system fork toward Path B (domain-neutral), realized spec-first via Typed Standards

- **Status:** Accepted
- **Date:** 2026-06-26 (accepted); 2026-06-07 (proposed)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

[`ROADMAP.md`](../../ROADMAP.md) §6 and the long-form analysis at [`docs/evidence-protocol-fork.md`](../evidence-protocol-fork.md) framed two reachable futures for the evidence system and committed to resolving between them by 2026-12-31 against three observational criteria:

- **Path A — Civic-branded.** The evidence system stays part of civic-ai-tools; the library lives in `civic-ai-tools-website/src/lib/evidence/`; growth happens through civic extensions and partner consumers. Identity stays civic-AI tooling; maintenance stays at current solo level.
- **Path B — Domain-neutral spin-out.** The evidence library, registry protocol, and (depending on the skill-routing decision) the meta-orchestrator are extracted under a neutral name, available to adjacent disciplines to run compatible registries. civic-ai-tools becomes one *instance* of a more general protocol.

The roadmap's resolution criteria were: (1) whether at least one external integration surface beyond civicaitools.org emerges naturally during 2026; (2) whether audience feedback skews toward civic-specific or general-purpose framing; (3) whether maintenance capacity can honestly absorb the additional commitment of third-party adopters. The fork doc was explicit that "the criteria are observational. Resolution is driven by what actually happens in 2026, not by a preferred narrative," and that what lands at resolution is "the observed state of each of the three criteria, naming decisions (if any), and migration implications."

The workspace-local strategic notes at [`evidence-spin-out-strategy.md`](../../../evidence-spin-out-strategy.md) (2026-04-14; "thinking, not a plan") deferred any naming or positioning decision pending external-stakeholder feedback, and sequenced the spin-out as library → integration surfaces → registry protocol.

**Over Q2 2026, the project built Path B without formally deciding it.** The relevant moves, all on public-signal pathways:

- **A neutral standard exists.** [ADR-0012](0012-typed-standards-consolidation.md) (2026-05-25) consolidated OES + CCV into a single RFC-ready **Typed Standards Specification** with an explicitly cross-sector framing, a domain-neutral namespace (`ts:` → `https://typedstandards.org/ns/ts#`), a neutral well-known path (`/.well-known/typed-publisher.json`), and a permanent open license (CC BY 4.0). This is the naming/positioning decision the fork doc said was downstream of the fork — taken in the neutral direction.
- **A shared verification core exists and is consumed by more than one codebase.** `@typedstandards/verify-core@0.1.0` is published to npm and consumed by *both* civicaitools.org and the separate `npstorey/typedstandards` monorepo. The verification library is no longer civic-coupled.
- **A neutral integration surface beyond civicaitools.org exists.** typedstandards.org runs a standalone, publisher-agnostic, client-side verifier ([website#116](https://github.com/npstorey/civic-ai-tools-website/issues/116), feature-complete 2026-06-06): paste a hash or hosted URL, verify in the browser, "show the math" per check, shareable `/verify/<hash>`, a host directory + publisher-recognition layer (Q47), and an embeddable verify badge. [ADR-0013](0013-verification-rendering-delegation.md) / Q46 (2026-06-03) established that the canonical full-detail verification surface is this neutral verifier, which every host (including civicaitools.org) delegates to.
- **A first cross-sector adopter exists.** The datHere / WPRDC pilot (publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md)) consumes the standard via the `ai-assisted-analysis/datHere` Producer Profile and needs it positioned as a cross-sector spec, not a civic-coded one. Two further prospective collaborators are in early discussions (referenced neutrally per the workspace stakeholder boundary); their interest, per [ADR-0012](0012-typed-standards-consolidation.md) §Context, is conditional on the standard's domain-neutral framing.

**The three criteria are now observably met.** (1) An external integration surface beyond civicaitools.org has emerged — typedstandards.org and verify-core, consumed by two codebases — *and* it was built rather than merely wished for. (2) Audience signal skews general-purpose: the datHere pilot and the further prospective collaborators need cross-sector framing, and the neutral name/namespace/license were chosen for exactly that reason. (3) The capacity question is the honest caveat and is addressed in the Decision below (spec-first, shared-core, no multi-registry buildout).

**The Xanadu gate is satisfied** ([`xanadu-doctrine.md`](../architecture/xanadu-doctrine.md)): this ADR does not promote a speculative direction. Real adopters, real published packages, a real npm consumer, and a real second-codebase consumer of the neutral core already exist. The decision records what has been built, not what is hoped for.

Per the [working method](../architecture/working-method.md), an unrecorded de-facto decision is the drift the project warns against. The fork was published unresolved as a governance-in-the-open move; leaving it unrecorded once the build has effectively decided it would be the opposite. This ADR closes that gap.

## Decision

**Resolve the evidence-system fork toward Path B (domain-neutral spin-out), realized spec-first.**

### 1. Path B is selected

civic-ai-tools / civicaitools.org is, going forward, **one instance and the reference implementation** of a domain-neutral protocol (Typed Standards), not the centerpiece of a civic-only evidence system. The protocol, its specification, its shared verification core, and its neutral verification surface are domain-neutral assets available to adjacent disciplines.

### 2. The realization is spec-first, not wholesale-extraction-first

The neutral asset that has spun out is the **standard** (Typed Standards Specification, ADR-0012) + a **shared verification core** (`@typedstandards/verify-core`) + a **neutral verification surface** (typedstandards.org). This is a narrower, capacity-sized realization of Path B than the "extract the whole library + registry protocol + meta-orchestrator" shape sketched in `evidence-spin-out-strategy.md`. The spec and the verifier are the load-bearing neutral primitives because they are what an external adopter reads, cites, and runs against; full library extraction and registry-protocol federation are deferred (see §4).

### 3. Naming and positioning are settled in the neutral direction

The naming question the fork doc deferred is answered: **Typed Standards** (spec name), `ts:` (namespace prefix), typedstandards.org (domain), CC BY 4.0 (spec license) — all per [ADR-0012](0012-typed-standards-consolidation.md). [Q13](../architecture/open-questions.md#q13--civic-vs-evidence-packager-naming-and-scope) (civic-vs-neutral naming and scope) is thereby substantially resolved and moves to the open-questions Resolution log citing ADR-0012 + this ADR. civic-ai-tools retains its civic identity *as a Typed Standards instance*; the neutral-named assets carry the cross-sector identity.

### 4. What is extracted now vs. deferred (adopter-gated, per Xanadu)

- **Now (done):** the specification, the shared verification core (verify-core), and the neutral client-side verifier. No further extraction action is required by this ADR — it records the state already reached.
- **Deferred (adopter-gated):** wholesale extraction of `src/lib/evidence/*` packaging/signing as a standalone published library beyond verify-core; a documented, federated **registry protocol** that other disciplines can run their own instances of. These advance only when a concrete adopter needs them — specifically, the registry-federation layer is gated on [Q2 (federation substrate)](../architecture/open-questions.md#q2--federation-substrate): build it when an adopter wants to consume packages from a registry not under civicaitools.org. Until then, civicaitools.org remains the only registry and the Xanadu gate is not met for federation work.

### 5. Capacity posture (the honest criterion 3 answer)

Path B is pursued in a solo-maintainer-sized way: a published spec + a shared core library + a neutral verifier are maintainable by one person; a sprawling multi-registry, multi-adopter platform is not, and is not being committed to. The [ROADMAP.md §3 sustainability commitment](../../ROADMAP.md) ("Sustainable for solo maintenance"; public disclosure if capacity changes) governs this direction unchanged. If an adopter relationship would require capacity the maintainer does not have, that gets disclosed rather than silently absorbed.

## Considered and rejected alternatives

- **Path A (stay civic-branded).** Rejected. All three observational criteria point to B: a neutral integration surface has emerged, audience signal is cross-sector, and the neutral realization is capacity-compatible. Choosing A now would require unwinding the neutral spec, namespace, verifier, and npm package already shipped.
- **Defer the decision past 2026-12-31 (keep gathering signal).** Rejected. The decision has effectively been made by what was built across Q2; continuing to present it as open in the roadmap misrepresents the project to outside readers and is the unrecorded-decision drift the working method exists to prevent. The 2026-12-31 date was a *latest* resolution date, not a constraint against resolving earlier when the signal is clear.
- **Full library + registry-protocol extraction now (the maximal Path B).** Rejected — deferred and adopter-gated per §4. Extracting a federated registry protocol before any adopter needs an off-civicaitools.org registry would violate the Xanadu gate and over-commit solo capacity. The spec-first realization captures the strategic value (a neutral, citable, forkable standard + verifier) without the maintenance surface of a federation platform.
- **Leave the resolution informal in `evidence-protocol-fork.md` / `evidence-spin-out-strategy.md`.** Rejected. The fork doc itself states that what lands at resolution is an ADR recording the observed criteria, naming decisions, and migration implications. An ADR is the artifact the project's own governance designates for this.

## Consequences

- **Ratified and landed in the public roadmap.** This ADR was raised Proposed (2026-06-07) recording an inferred decision read off what was built; the maintainer ratified it, and it moved Proposed → Accepted on 2026-06-26. The downstream public edit — rewriting `ROADMAP.md` §6 from "both futures reachable, resolution by end of 2026" to "Path B selected, realized spec-first" — landed the same day as a targeted roadmap-change ([civic-ai-tools#86](https://github.com/npstorey/civic-ai-tools/issues/86)) through the [ADR-0001](0001-roadmap-governance.md) governance process, ahead of the full v2026.Q3 quarterly refresh.
- **Open-questions registry updates.** [Q13](../architecture/open-questions.md#q13--civic-vs-evidence-packager-naming-and-scope) moves toward the Resolution log (naming resolved neutral via ADR-0012 + this ADR). [Q2 (federation substrate)](../architecture/open-questions.md#q2--federation-substrate) stays open but is now explicitly the gate for the deferred registry-protocol work. [Q15 (external verification testing)](../architecture/open-questions.md#q15--external-verification-testing) remains the top verification gate and is made more reachable by the neutral verifier (its hardening tracked in [website#119](https://github.com/npstorey/civic-ai-tools-website/issues/119)). [Q50](../architecture/open-questions.md#q50--evidence-product-framing-vs-precise-typed-node-resource-naming) (surfaced 2026-06-15, after this ADR was first raised) carries the live naming follow-on — the product/resource "evidence" framing vs. the precise typed-node ("analysis"/"record"/"node") vocabulary — and stays Open, to be settled alongside the spec-launch naming pass rather than by this decision; the §6 roadmap rewrite references it without resolving it.
- **`evidence-protocol-fork.md` and `evidence-spin-out-strategy.md` are reframed as superseded-by-this-ADR.** Their decision-deferral status closes; they remain as the analysis-of-record that led here. (Edits to those files are follow-on, not part of this ADR commit.)
- **No code or schema change.** This ADR records a decision already enacted by ADR-0012, verify-core, and the typedstandards.org verifier. Every existing package remains valid; the envelope schema is unchanged.
- **Positioning of civic-ai-tools surfaces.** Public copy and the roadmap will, going forward, describe civic-ai-tools as a civic instance of the domain-neutral Typed Standards protocol. This dovetails with the still-open positioning work ([website#61](https://github.com/npstorey/civic-ai-tools-website/issues/61)), which should be re-scoped to cover the two-surface (civicaitools.org + typedstandards.org) story.
- **Migration implications (per fork doc §"What lands").** Under Path-B-realized-spec-first, very little moves: the spec already lives in `civic-ai-tools/docs/architecture/` and is published neutrally; verify-core already lives as a separate npm package + the `typedstandards` monorepo; the civic evidence library stays in `civic-ai-tools-website/src/lib/evidence/` as the reference implementation. No disruptive migration is triggered now; the deferred registry-federation work (§4) is the only move that would entail real migration, and it is adopter-gated.

## References

- [`ROADMAP.md`](../../ROADMAP.md) §6 — updated 2026-06-26 to record the resolution (Path B, realized spec-first) via [ADR-0001](0001-roadmap-governance.md) governance ([civic-ai-tools#86](https://github.com/npstorey/civic-ai-tools/issues/86)).
- [`docs/evidence-protocol-fork.md`](../evidence-protocol-fork.md) — long-form Path A/B analysis + the three observational criteria + the "what lands at resolution" template this ADR follows.
- [`evidence-spin-out-strategy.md`](../../../evidence-spin-out-strategy.md) (workspace-local) — 2026-04-14 strategic notes; decision-deferral status closed by this ADR.
- [ADR-0012](0012-typed-standards-consolidation.md) — Typed Standards consolidation: the neutral name, namespace, well-known path, and CC BY 4.0 license that constitute the naming/positioning half of this decision.
- [ADR-0004](0004-dathere-captureMethod-variant.md) — datHere content profile; the publicly-named first cross-sector adopter motivating criterion (1)/(2).
- [ADR-0009](0009-unified-typed-attestation-primitive.md) — unified typed-attestation primitive; part of the cross-sector-portable spec surface.
- [ADR-0013](0013-verification-rendering-delegation.md) / [Q46](../architecture/open-questions.md#q46--verification-rendering-in-page-per-host-vs-delegated-to-a-neutral-verifier) — verification rendering delegated to the neutral verifier; the architectural commitment that makes typedstandards.org the canonical neutral surface.
- [Q2](../architecture/open-questions.md#q2--federation-substrate), [Q13](../architecture/open-questions.md#q13--civic-vs-evidence-packager-naming-and-scope), [Q15](../architecture/open-questions.md#q15--external-verification-testing) — registry entries this decision touches.
- [`xanadu-doctrine.md`](../architecture/xanadu-doctrine.md) — adopter-gate satisfied for the spec/verifier; not yet met for registry federation.
- [`working-method.md`](../architecture/working-method.md) — promotion path (published fork → de-facto build → ADR record → roadmap update).
- `@typedstandards/verify-core` (npm) + `npstorey/typedstandards` monorepo + typedstandards.org — the shipped neutral assets.
- [website#116](https://github.com/npstorey/civic-ai-tools-website/issues/116) (standalone verifier, feature-complete) + [website#119](https://github.com/npstorey/civic-ai-tools-website/issues/119) (offline-crypto hardening, in flight).
