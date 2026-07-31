# ADR-0020: Key custody for instances (Q56) — per-instance keys with an intentional unsigned dev tier

- **Status:** **Proposed** — decision drafted 2026-07-30, revised 2026-07-31 per maintainer review (terminology `fork`→`instance`; tier-model precision — an unsigned package is a *signing status*, not a third `visibility` value; dev-tier guardrails; co-signing non-preclusion); awaiting sign-off. Accepted on merge. **Scope narrowed:** this ADR decides **instance** custody; the **spoke** case is unbundled and deferred to [civic-ai-tools#102](https://github.com/npstorey/civic-ai-tools/issues/102) (see §Deferred).
- **Date:** 2026-07-30 (decision) · 2026-07-08 (options skeleton)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0019](0019-reference-app-posture.md) (reference-app posture — the no-hosted-service constraint that eliminates Option 2), [ADR-0016](0016-vcs-native-lifecycle-mapping.md) (the `sealed`/`public` visibility definitions Decisions B/C rest on), [ADR-0013](0013-verification-rendering-delegation.md) (publisher-agnostic verifier), [ADR-0010](0010-visibility-lifecycle-location-attestations.md) (visibility/lifecycle)

*Numbering note: 0018 reserved for the roadmap-governance amendment, 0019 for the reference-app posture ADR (accepted 2026-07-30); confirm numbering at merge.*

*Terminology: an **instance** is a deployment of the open-source application, stood up by installing the published packages and customizing the thin templates — not a divergent code copy. "Fork" (take-and-maintain-your-own-copy) is deliberately avoided; it is a supported but non-primary path (ADR-0019 Decision 6), and it carries baggage the install-first model is designed to remove.*

## Context

[Q56](../architecture/open-questions.md#q56--hub-topology-thin-vs-thick-hub-registry-location-and-key-custody) asks whether the hub (civicaitools.org + the spec + the neutral verifier) is **thin** (indexes and verifies; instances and spokes own capture and publishing under their own keys) or **thick** (the hub owns the capture/publish/eval pipeline), and — pre-launch-sensitive — who holds signing keys. The registry entry flags it as shaping "nearly everything downstream." The spin-out strategy calls key management "the single biggest UX question."

Two concrete cases can force it:

1. **Instances** (the civic-data-analysis stack program — the first-firing forcing function): a prospective adopter stands up their own instance of the analysis application. Whose key signs the packages their instance publishes, and against which trust registry do those packages verify?
2. **Spokes** ([#102](https://github.com/npstorey/civic-ai-tools/issues/102)): a data-source MCP server (Socrata today) emitting Typed Standards envelopes directly. Whose key signs spoke-emitted packages?

**This ADR resolves case 1 and unbundles case 2.** The Q56 registry entry originally said whichever forcing function fired first must resolve *both*. That coupling is dropped here (§Deferred): the instance case is live now and the spoke case has no live trigger, so bundling them would force a spoke-custody decision ahead of the need it should be driven by. The narrowing is itself part of the decision.

### Current state (verified in the reference implementation, 2026-07-08 / 07-31; unchanged as of this decision)

- **Thick hub de facto.** One platform Ed25519 key signs every package; the envelope `signer` is always the hardcoded platform identity (`civic-ai-tools-website` `src/lib/evidence/signing.ts:48–52`, returned unconditionally by `getActiveSigner()`, signing.ts:79–81). Spec §8.5 records that users do not yet sign their own packages. Nothing yet commits the architecture to this shape (Q56 registry entry).
- **The verifier is already publisher-agnostic.** Per [ADR-0013](0013-verification-rendering-delegation.md) §2 the neutral verifier resolves the trust registry from whatever publisher a package declares; the commitment sidecar carries `trustRegistryUrl` precisely so third parties can bootstrap verification without knowing the publisher's internals (`src/lib/evidence/commitment.ts:18–23`). **The thin-hub verification path therefore already exists** — what does not exist is producer-side support for non-platform keys.
- **Key-id scheme anticipates multiple scopes.** The `platform:` kid prefix was chosen to leave room for other scopes without a trust-registry schema migration (signing.ts:21–25). The registry format (status semantics, rotation runbook at `docs/key-rotation.md`) is instance-generic.
- **An unsigned mode exists de facto, end to end.** With `EVIDENCE_SIGNING_KEY` unset, `signPackage()` returns null with a warning (signing.ts:135–140); the publish route stores `basePackageSignature: null` and **skips Rekor — Rekor logging is signature-gated** (`route.ts:268–271` calls `publishToRekor(packageHash, signature, publicKey)` only in the signed branch of the ternary; the RFC-3161 timestamp path at `route.ts:269` is *not* signature-gated, so a bare existence-timestamp can still be produced — that proves only "this hash existed at time T," not attribution). The trust-signal vocabulary renders a calm `NO_SIGNING_KEY_SIGNAL` rather than an error (`src/lib/evidence/trust-signal.ts:270–283`). The path lacks only intent: labeling, docs, and a deliberate onboarding story.
- **Blockers if custody stays implicit** (Phase 0 fork-cost inventory): the commitment sidecar's `trustRegistryUrl` constants point at civicaitools.org (commitment.ts:45, 53) — an instance shipping them unchanged emits packages whose proofs point at a registry that does not contain its key; and the signer identity is code, not config (signing.ts:48–52).

### Constraint inherited from ADR-0019 (now accepted)

[ADR-0019](0019-reference-app-posture.md) (reference-app posture: no SaaS, no hosted services) is **accepted as of 2026-07-30**, so its no-hosted-service constraint is in force: a platform **signing service** operated for third-party instances would be a hosted-service surface, and is therefore **excluded** — this is what eliminates Option 2 below on principle rather than on preference.

The posture also bounds *scope*: a v1 instance is **single-tenant** (one instance, one organization, one publisher — ADR-0019 Decision 4). Key custody *across multiple organizations on one instance* (multi-tenant per-org keys) is out of scope — it rides the deferred multi-tenancy extension, whose builder resolves its custody model then. This decision assumes one instance = one publisher.

## Decision

### A. Thin — each instance is its own publisher (per-instance keys + per-instance trust registry)

Each instance generates its own Ed25519 keypair at setup, publishes its own registry at its own `/.well-known/typed-publisher.json`, signs with its own key, and declares its own `signerIdentity`. The hub holds no custody, availability, or liability obligation for another instance's packages.

**Why.** It is structurally honest — an instance *is* an independent publisher, and the verification side already treats it as one ([ADR-0013](0013-verification-rendering-delegation.md) §2; the sidecar's `trustRegistryUrl`). Verify check #14 (signer identity ↔ registry entry) keeps its plain, per-publisher meaning. It is consistent with the retention/withdrawal model (each publisher's standing is its own) and with offline verification (spec §9.4), which works identically per instance. Trust bootstrapping reduces to the instance's domain — the same anchor the well-known pattern already accepts. A prospective adopter's own technical design independently arrives at a per-instance `EVIDENCE_SIGNING_KEY` / `EVIDENCE_KEY_ID`, corroborating that this is what an independent operator actually expects to hold.

### B. An intentional unsigned dev tier — a signing status, not a third visibility value

The already-existing unsigned mode is promoted from an accident to a **deliberate first-run tier**. An instance works unsigned in its first minutes — packages are produced and can be inspected, verification calmly reports no signing key — and the "go to production" step is keygen + registry + env. Because platform signing is excluded (§ADR-0019), the two tiers are **producer tiers** (unsigned dev → per-instance signed), not thin-vs-thick.

**Model it as a signing status orthogonal to visibility — not a third `visibility` value** (the same discipline [ADR-0016](0016-vcs-native-lifecycle-mapping.md) §A.1 uses to keep `withdrawn` out of the `visibility` enum):

| Axis | Values | Notes |
|---|---|---|
| **Signing status** | `unsigned` (dev / pre-commitment) → `signed` | a key moves a package from left to right |
| **Visibility** | `sealed` → `public` | *meaningful only once signed* |

An **unsigned** package carries no signer signature, and because Rekor logging is signature-gated (`route.ts:268–271`), **no transparency-log entry** and no attributable commitment. It is therefore *not* `sealed` in the [ADR-0016](0016-vcs-native-lifecycle-mapping.md) §A sense — which defines `sealed` as signed + RFC-3161-timestamped + Rekor-logged. Unsigned is the **pre-commitment** condition that precedes the signed lifecycle entirely; a configured key is what lets a package become `sealed` (where the Rekor commitment first appears) and, from there, `public`.

**Why the tier at all.** It resolves the time-to-first-value-vs-custody tension by *sequencing* it rather than picking a side; it needs almost no new mechanism (the path exists — it needs labels, docs, and an onboarding story); it matches the "envelope invisible-until-wanted" adoptability lever; and it leaves every property of Decision A intact at the signed tier.

### C. Unsigned stays local — a key is required to reach `sealed` or `public`

An **unsigned** package cannot enter either signed visibility state. Both `sealed` (signed, unlisted, Rekor-logged) and `public` (the `attestation/publishes/v1` + `attestation/locatedAt/v1` pair, content served) require a signature; an unsigned package is confined to local produce-and-inspect. This is the precise form of the "gate *publication*, not merely *signing*" choice, corrected against ADR-0016's definition of `sealed`: because `sealed` itself requires a signature, the conservative option is not "unsigned may be sealed but not public" — it is **"unsigned may be neither."**

**Why (the load-bearing judgment).** This preserves the project's honesty property: nothing unsigned should carry a `sealed` or `public` status it cannot cryptographically back. The permissive alternative — let unsigned packages be `public` with prominent "dev mode" labeling — puts the honesty burden on a label that travels less reliably than the package does; given the project's whole posture ("tamper-evident, attributable, or not evidence"), the signed-lifecycle gate is the honest default. The friction is small: the unsigned tier still exercises the whole pipeline locally, so a key is required only to *commit* an output, not to *produce* one. The verifier reinforces this for free — an unsigned artifact cannot render "commitment verified" (the signature, key-trust, and transparency-log checks have nothing to resolve), so it is structurally incapable of impersonating a signed package. A threat-model sentence on what an unsigned package does and does not claim is routed to [#63](https://github.com/npstorey/civic-ai-tools/issues/63).

### D. The spoke case is unbundled and deferred

This ADR does **not** decide spoke custody. The first spoke ([#102](https://github.com/npstorey/civic-ai-tools/issues/102), a project-run data-source MCP server) has no live trigger; deciding its within-operator custody now would be premature. When #102 fires it carries its own custody decision, weighing the shapes sketched in §Deferred. **A third-party spoke** (a future independent data-source operator) is simply an independent publisher and is already covered by Decisions A–C unchanged; only the *project-run* spoke's within-operator choice is deferred.

## Deferred — spoke custody (for #102 to decide)

Retained here as the starting analysis for the spoke decision, not decided now. A project-run spoke's "whose key" is a custody choice *within one operator*:

- **(a) Spoke signs under the platform key** — one key, one entry; blurs capture provenance (a spoke package becomes indistinguishable-by-signer from a hub-captured one).
- **(b) Per-spoke kid in the platform registry** — the kid scheme already anticipates non-`platform:` scopes (signing.ts:21–25); one registry, emitting surface legible in the signature. *(Provisional lean, non-binding.)*
- **(c) Spoke as fully independent publisher** (own registry) — maximal thin-hub consistency; heaviest per-spoke operational surface.

**Forward-compatibility (co-signing) — preserved, not foreclosed.** Unbundling the spoke case does not preclude a future model in which a publisher *and* an MCP data source both sign one analysis. The existing mechanism is the attestation family ([ADR-0009](0009-unified-typed-attestation-primitive.md) two-family model): a spoke signs its *own* `attestation/*` node — under its own key — that references the publisher's analysis node via `targetNodeId`. That is two parties, two signatures, two linked nodes, expressible today; the #102 decision would formalize which attestation a spoke emits. A literal **two signatures over one envelope** (a signature array on a single node) is a distinct, larger change — neither decided nor precluded here. Nothing in Decisions A–D forecloses either path.

## Considered and rejected

- **Option 2 — thick / platform signing.** Rejected: it is a hosted service, excluded by the now-accepted ADR-0019 posture (custody + availability obligations, the project inserted into every instance's publish path, a platform outage stopping every instance). Identity semantics also muddy — a platform signature over an instance's analysis either misattributes (spec §8.5 `signer` is *who claims to have signed*) or requires a new delegation vocabulary. Institutional-mortality concentration is exactly what Q55 warns against.
- **Gate only signing (unsigned packages may be `public`).** Rejected per Decision C — a real judgment call, recorded so the reasoning is legible: publication-gating keeps the honesty property on the package rather than on a detachable label. Revisit only if a concrete adopter need makes public-unsigned output necessary *and* a labeling scheme that travels with the package is designed.
- **Dev tier via an auto-generated self-signed key** (instead of unsigned). First run would mint a local keypair, so every dev package *is* signed and Rekor-logged but under an untrusted key → the verifier shows "valid signature, unknown publisher." Rejected for v1: it would write a throwaway entry to the **public** Sigstore transparency log on every dev test (real pollution of a shared resource), and it adds keygen to the very first-run path the unsigned tier exists to avoid. The unsigned tier's residual risk is already bounded (see Consequences). Reconsider only if realistic full-pipeline dev testing (including the Rekor leg) becomes a stated need — and then against a non-public log.
- **Bundle the spoke case into this decision.** Rejected per Decision D — the Q56 registry rule that coupled them is narrowed; deciding project-run spoke custody before #102's need would be the reverse of the Xanadu discipline.

## Consequences

- **Producer-side work** (from the Phase 0 inventory; now **Stream 1 / S3** of the civic-data-analysis stack program plan): parameterize signer identity + kid default (signing.ts:48–52, 21–25); parameterize the sidecar `trustRegistryUrl` constants (commitment.ts:45, 53); a registry template + keygen step in setup; per-instance rotation docs (the runbook is already instance-generic). This is the load-bearing gate for the program's correctness-critical bucket.
- **Unsigned-tier guardrails (against silent opt-out).** The tier's one real risk is that an operator stays unsigned and their output silently reads as evidence when it isn't. Three guards bound it, all built with the tier: (1) **it can reach neither `sealed` nor `public`** (Decision C), so unsigned output can never circulate as a signed package; (2) **mandatory labeling** — the `NO_SIGNING_KEY_SIGNAL` rendering is surfaced prominently wherever an unsigned package appears; (3) **the verifier won't bless it** — an unsigned artifact cannot produce "commitment verified." Beyond those: the deploy guide makes signing the required **go-to-production** step, and a running-unsigned indicator/banner shows outside a dev environment. An operator who nonetheless stays unsigned has simply *opted out of the evidence layer* — a legitimate choice (the analysis tool still works); the guards ensure it is never a *silent* one.
- **Reconcile the as-built unsigned-committed path.** Today the code persists an unsigned package with a `committed` visibility and a null signature (§Current state). Per Decisions B/C that record is *not* `sealed`; Stream 1/S3 must either gate the seal/commit action off in the unsigned tier or relabel the persisted state as an explicit non-sealed **draft** — so nothing wears a `sealed` label without the commitment that defines it.
- **No wire-format or spec change.** Per-instance keys are already expressible; the verifier is already publisher-agnostic (ADR-0013); verify check #14 keeps its plain per-publisher meaning. Spec §8.5's "users do not yet sign their own packages" becomes reachable at the signed tier without a schema bump.
- **Open-questions registry.** [Q56](../architecture/open-questions.md#q56--hub-topology-thin-vs-thick-hub-registry-location-and-key-custody) → **Resolved for the instance case** (Decisions A–C); the **spoke case remains open, re-scoped to [#102](https://github.com/npstorey/civic-ai-tools/issues/102)**. The registry entry's "whichever fires first covers both" rule is superseded by the unbundling (Decision D).
- **Build-state.** Per-instance signing + the unsigned-dev tier move to **built** when Stream 1/S3 ships the parameterization + labeling; the mechanism is a relabel/config-exposure of already-built code, not new cryptography.

## References

- [Q56](../architecture/open-questions.md#q56--hub-topology-thin-vs-thick-hub-registry-location-and-key-custody) — the registered question; resolved here for the instance case, spoke case re-scoped to #102.
- [civic-ai-tools#102](https://github.com/npstorey/civic-ai-tools/issues/102) — spoke emission (carries the deferred spoke-custody decision).
- [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) — threat-model home for the unsigned-tier framing (what it does/doesn't claim; reaches neither sealed nor public).
- [ADR-0019](0019-reference-app-posture.md) — reference-app posture (accepted 2026-07-30); its no-hosted-service constraint eliminates Option 2.
- [ADR-0016](0016-vcs-native-lifecycle-mapping.md) — the `sealed`/`public` visibility definitions (sealed = signed + timestamped + Rekor-logged) and the §A.1 axis discipline Decisions B/C rest on.
- [ADR-0013](0013-verification-rendering-delegation.md) — publisher-agnostic neutral verifier (the thin-hub verification half, already shipped).
- [ADR-0010](0010-visibility-lifecycle-location-attestations.md) — visibility/lifecycle model.
- [ADR-0009](0009-unified-typed-attestation-primitive.md) — the two-family attestation model (the co-signing forward-compat path in §Deferred).
- Typed Standards Specification §8.3.3 (trust registry / well-known), §8.5 (signer identity), §9.2/§9.4 (verification, offline property).
- `civic-ai-tools-website/docs/key-rotation.md` — instance-generic rotation runbook.
- Phase 0 memos (planning-side): portability audit + fork-cost inventory (file:line grounding for the current-state claims).
- Program plan (planning-side): `reference-app-project-plan.md` v6 — the four-stream civic-data-analysis stack program this decision feeds (Stream 1/S3).
