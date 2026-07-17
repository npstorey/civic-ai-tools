# ADR-0020: Hub topology and key custody for forked instances and spokes (Q56) — options analysis

- **Status:** Draft — options analysis only; **no decision is made in this document**. The decision is the maintainer's. Whichever forcing function fires first — the reference-app initiative (fork-instance custody) or [civic-ai-tools#102](https://github.com/npstorey/civic-ai-tools/issues/102) (spoke emission) — carries this ADR to Accepted; per the Q56 registry entry it must then cover **both** the fork-instance and the spoke case, not just the one that fired.
- **Date:** 2026-07-08 (skeleton)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

*Numbering note: 0018 is reserved for the roadmap-governance amendment and 0019 for the reference-app posture ADR (in review); renumber at merge if either changes.*

## Context

[Q56](../architecture/open-questions.md#q56--hub-topology-thin-vs-thick-hub-registry-location-and-key-custody) asks whether the hub (civicaitools.org + the spec + the neutral verifier) is **thin** (indexes and verifies; spokes and instances own capture and publishing under their own keys) or **thick** (the hub owns the capture/publish/eval pipeline), and — pre-launch-sensitive — who holds signing keys. The registry entry flags it as shaping "nearly everything downstream." The spin-out strategy calls key management "the single biggest UX question."

Two concrete cases now force it:

1. **Forked instances** (reference-app initiative, first-firing per the maintainer's 2026-07-08 sequencing): a prospective implementer runs their own instance of the analysis application. Whose key signs the packages their instance publishes, and against which trust registry do those packages verify?
2. **Spokes** ([#102](https://github.com/npstorey/civic-ai-tools/issues/102)): the Socrata MCP server emitting Typed Standards envelopes directly. Whose key signs spoke-emitted packages?

### Current state (verified in the reference implementation, 2026-07-08)

- **Thick hub de facto.** One platform Ed25519 key signs every package; the envelope `signer` is always the hardcoded platform identity (`civic-ai-tools-website` `src/lib/evidence/signing.ts:48–52`, returned unconditionally by `getActiveSigner()`, signing.ts:79–81). Spec §8.5 records that users do not yet sign their own packages. Nothing yet commits the architecture to this shape (Q56 registry entry).
- **The verifier is already publisher-agnostic.** Per [ADR-0013](0013-verification-rendering-delegation.md) §2 the neutral verifier resolves the trust registry from whatever publisher a package declares; the commitment sidecar carries `trustRegistryUrl` precisely so third parties can bootstrap verification without knowing the publisher's internals (website `src/lib/evidence/commitment.ts:18–23`). **The thin-hub verification path therefore already exists** — what does not exist is producer-side support for non-platform keys.
- **Key-id scheme anticipates multiple scopes.** The `platform:` kid prefix was chosen to leave room for other scopes without a trust-registry schema migration (signing.ts:21–25). The registry format (status semantics, rotation runbook at website `docs/key-rotation.md`) is instance-generic.
- **An unsigned mode exists de facto, end to end.** With `EVIDENCE_SIGNING_KEY` unset, `signPackage()` returns null with a warning (signing.ts:135–140); the publish route stores `basePackageSignature: null` and skips Rekor (website `src/app/api/evidence/route.ts:265–303`); the trust-signal vocabulary renders a calm `NO_SIGNING_KEY_SIGNAL` rather than an error (website `src/lib/evidence/trust-signal.ts:270–283`). It lacks only intent: labeling, docs, and a deliberate onboarding story.
- **Fork-cost blockers if custody stays implicit** (Phase 0 inventory): the commitment sidecar's `trustRegistryUrl` constants point at civicaitools.org (commitment.ts:45, 53) — a fork shipping them unchanged emits packages whose proofs point at a registry that does not contain its key; and the signer identity is code, not config (signing.ts:48–52).

### Constraint inherited from ADR-0019 (if accepted)

The reference-app posture (no SaaS, no hosted services) constrains but does not resolve this question: a platform **signing service** operated for third-party instances would be a hosted-service surface.

The posture also bounds the *scope* of this analysis: a v1 fork instance is **single-tenant** (one instance, one organization, one publisher — ADR-0019 Decision 4). Key custody *across multiple organizations hosted on a single instance* (multi-tenant per-org keys) is therefore out of scope here — it rides the deferred multi-tenancy extension, and whoever builds that extension resolves its custody model then. The options below assume one instance = one publisher.

## Options

### Option 1 — Thin: per-instance keys + per-instance trust registry

Each forked instance is its own publisher: it generates its own Ed25519 keypair at setup, publishes its own registry at its own `/.well-known/typed-publisher.json`, signs with its own key, and declares its own `signerIdentity`. Spokes likewise sign under their own keys (see the spoke section).

- **For:** structurally honest — a forked instance *is* an independent publisher, and the verification side already treats it as one (ADR-0013 §2; the sidecar's `trustRegistryUrl`). No custody, availability, or liability obligations concentrate on the project. Verify check #14 (signer/registry cross-check) keeps its plain meaning. Consistent with the retention/withdrawal model (each publisher's standing is its own). Offline verification (spec §9.4) works identically per instance.
- **Against:** onboarding friction is the whole cost — keygen, registry template, `signerIdentity` configuration, and key-rotation responsibility land on every fork operator, against the time-to-first-value < 5 minutes lever. Trust bootstrapping is also each fork's own problem: a fresh instance's registry is self-published, so "who is this publisher" reduces to their domain — which is the same trust anchor the well-known pattern already accepts.
- **Producer-side work if chosen** (scoped in the Phase 0 inventory): parameterize signer identity + kid default; template the registry; keygen step in setup; parameterize the sidecar registry-URL constants; per-instance rotation docs (the runbook is already instance-generic).

### Option 2 — Thick: platform signing

Forked instances submit package hashes to the project's infrastructure for signing — either under the platform key, or under per-instance keys the platform custodies — and verify against the platform registry.

- **For:** zero key management for fork operators (the strongest possible first-five-minutes story); a single registry gives consumers one place to look; custody stays with the party that currently knows how to run it.
- **Against:** it is a hosted service — in tension with the ADR-0019 posture if accepted (custody + availability obligations, per-fork onboarding as a service relationship, the project inserted into every fork's publish path). Identity semantics muddy: spec §8.5's `signer` answers *who claims to have signed* — a platform signature over a fork's analysis either misattributes (platform asserts what it didn't produce) or requires a new delegation vocabulary (new spec surface). A platform outage stops every fork's publishing. Institutional-mortality concentration is exactly what Q55 warns about.
- **Producer-side work if chosen:** a signing API + auth + abuse handling + delegation semantics in the spec — the registry-protocol work the spin-out strategy deliberately sequenced last.

### Option 3 — Thin default + intentional unsigned dev mode (both-with-a-default, without a signing service)

Per-instance custody as in Option 1, plus the already-existing unsigned mode promoted to a **deliberate first-run tier**: a fork works unsigned in its first five minutes (packages publish, verification calmly reports no signing key), and the deploy guide's "go production" step is keygen + registry + env. Platform signing is not offered (per the ADR-0019 constraint), so "both" here means *two producer tiers* (unsigned dev → per-instance signed), not thin-vs-thick.

- **For:** resolves the TTFV-vs-custody tension by sequencing it instead of picking a side; requires almost no new mechanism (the tier exists; it needs labels and docs); matches the "envelope invisible-until-wanted" adoptability lever; leaves every Option 1 property intact at the signed tier.
- **Against:** risks unsigned packages leaking into circulation as if they were evidence — needs honest, prominent labeling (the trust-signal vocabulary already has the calm-no-key rendering) and possibly a visible "dev mode" banner on unsigned instances; the spec/threat-model may need a sentence on what an unsigned package does and does not claim (route to [#63](https://github.com/npstorey/civic-ai-tools/issues/63) if adopted).
- **Sub-decision if chosen:** whether unsigned packages may be `public`, or only `sealed`/local — i.e., does dev mode gate *publication* or just *signing*.

## The spoke case (must be covered at acceptance; sketch only here)

Spokes differ from forks in one structural respect: the first spoke (the Socrata MCP server, #102) is **project-run**, so "whose key" is a custody choice within one operator rather than across organizations. Candidate shapes, for the eventual decision to weigh:

- **(a) Spoke signs under the platform key** — one key, one registry entry; blurs capture provenance (a spoke-emitted package becomes indistinguishable-by-signer from a hub-captured one).
- **(b) Per-spoke kid in the platform registry** — the kid scheme already anticipates non-`platform:` scopes (signing.ts:21–25); keeps one registry while making the emitting surface legible in the signature.
- **(c) Spoke as fully independent publisher** (own registry) — maximal thin-hub consistency; heaviest per-spoke operational surface.

A third-party spoke (future CKAN/ArcGIS operators) collapses into the fork-instance question: they are independent publishers, and Options 1/3 apply unchanged. The decision should state whether fork instances and spokes share one custody model or explicitly two.

## Decision criteria the eventual decision should weigh

- Time-to-first-value < 5 minutes (adoptability lever, recorded); consumption-side liquidity (consumers must be able to resolve any publisher's registry mechanically).
- The ADR-0019 no-hosted-service constraint (if accepted).
- Verify check #14 semantics staying plain (signer identity ↔ registry entry, per publisher).
- Custody, rotation, and institutional-mortality exposure (Q55 adjacency).
- What #102's reference integration actually needs first.

## References

- [Q56](../architecture/open-questions.md#q56--hub-topology-thin-vs-thick-hub-registry-location-and-key-custody) — the registered question this skeleton carries.
- [civic-ai-tools#102](https://github.com/npstorey/civic-ai-tools/issues/102) — spoke emission (the other forcing function).
- [ADR-0013](0013-verification-rendering-delegation.md) — publisher-agnostic neutral verifier (the thin-hub verification half, already shipped).
- ADR-0019 (in review) — reference-app posture; constrains Option 2.
- Typed Standards Specification §8.3.3 (trust registry / well-known), §8.5 (signer identity), §9.2/§9.4 (verification, offline property).
- `civic-ai-tools-website/docs/key-rotation.md` — instance-generic rotation runbook.
- Phase 0 reference-app memos (planning-side): portability audit + fork-cost inventory (file:line grounding for the current-state claims above).
- [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) — threat-model home for the unsigned-mode framing if Option 3 is adopted.
