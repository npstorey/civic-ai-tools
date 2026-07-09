# ADR-0019: Reference-application product posture — open-source, demo-hostable, fork-first ("Postgres, not Heroku")

- **Status:** Proposed (awaiting maintainer decision)
- **Date:** 2026-07-08
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

*Numbering note: ADR-0018 is reserved for the in-flight roadmap-governance amendment of [ADR-0001](0001-roadmap-governance.md); this ADR files as 0019. Renumber at merge if that changes.*

## Context

The analysis application at civicaitools.org is the reference implementation of the Typed Standards evidence system: server-side capture, platform-key signing, publish/verify surfaces, and the hosted demo. Until now, its *product posture* — what the application is **for**, commercially and structurally — existed only as a maintainer planning record (recorded 2026-06-24 in the maintainer's working notes as "Postgres, not Heroku"), deliberately unpromoted per the working method's promote-when-load-bearing rule: no code-repo artifact depended on it.

Two things now make it load-bearing:

1. **A prospective implementer's need.** A prospective implementer wants to run their own instance of the analysis application. Serving that need requires the codebase to become forkable in fact, not just in license — which is engineering work whose scope depends entirely on which posture governs it.
2. **The end-state vision already assumes it.** `end-state-vision.md` describes city implementations as *customizations of the open-source software* — a claim that is only honest if the software is genuinely designed to be forked.

The gates that previously sequenced this work have cleared: the IPR posture is in force ([ADR-0017](0017-ipr-posture-dco-rf-statement.md); PATENTS.md merged), and the license groundwork is done (LICENSING.md current). The Xanadu gate is satisfied by the prospective implementer: an imminent real-world adopter concretely needs the posture recorded so the fork-enablement work it licenses can be scoped against it.

The metaphor: **Postgres, not Heroku.** Postgres is software you run; Heroku is a service someone runs for you. This project ships the software and demonstrates it on a hosted demo instance; it does not sell or operate instances for others.

## Decision

1. **The analysis application is an open-source reference application: demo-hostable, fork-first.** The project hosts one demo instance (today at civicaitools.org) as a demonstration and as the project's own publishing surface. The supported adoption path for everyone else — cities, newsrooms, civic organizations, prospective implementers — is to fork, configure, and deploy their own instance.

2. **No SaaS, no payments.** The project does not operate hosted instances for third parties, does not take payment for hosting, and builds no billing, subscription, or tenant-management machinery. Running the application as a hosted service would invert the project's positioning into competing with its own adopters — the parties the reference architecture exists to serve. Reopening this is an explicit maintainer decision recorded as a superseding ADR, not something that accretes by drift.

3. **Fork enablement is scoped by the Xanadu doctrine to what a real fork needs.** Parameterization of hosts, keys, and configuration; a deploy guide; a per-instance trust-registry story (the custody model is a separate decision — see the Q56 options ADR). Explicitly out of scope absent a real adopter need: multi-tenant machinery, per-tenant isolation, usage metering, and any hosted-service affordance.

4. **Browser-sandbox execution is a v2 community contribution, not core roadmap.** The current server-side execution model stands for v1. A contributor-driven browser-sandbox path is welcome when a contributor materializes; the project does not build it speculatively.

5. **The demo instance's name and the app/front-door split remain open.** "app.civicaitools.org" is a candidate name for the hosted demo instance, not a decision; whether the app splits from the front door, and the forkable repo's shape, are separate scoping decisions informed by the Phase 0 fork-cost inventory. This ADR records posture, not topology.

## Considered and rejected alternatives

- **Hosted service (SaaS), with or without payments.** Rejected — inverts the positioning per Decision 2. The project's adoption thesis is consumption-side liquidity and forkable reference implementation, not operated infrastructure. A hosted service would also concentrate key custody and availability obligations in a solo-maintainer project — exactly the institutional-mortality risk the standard's design distrusts.
- **Managed "pilot instances" as a middle path (project-operated instances for early partners).** Rejected for the same reasons at smaller scale: every operated instance is an ongoing custody + availability + support obligation, and the precedent converts each future adopter conversation into a hosting negotiation. Partners get a better artifact: a fork that works.
- **Leaving the posture unrecorded.** Rejected — the fork-enablement work now beginning would otherwise be scoped against an undocumented assumption; the first structural question (custody, parameterization depth, portability bar) would re-litigate the posture implicitly. The working method's promotion path exists for exactly this moment.
- **Recording the posture as a ROADMAP commitment instead of an ADR.** Rejected — ROADMAP §3 commitments are absolute trust commitments (verifiability, cadence) per [ADR-0002](0002-commitments-vs-targets.md); a product posture is an architectural decision with a named revisit mechanism, which is ADR-shaped.

## Consequences

- Fork-enablement work (config extraction, per-instance trust registry, deploy guide, time-to-first-value setup path) is licensed and scoped against this posture; anything that smells like multi-tenant or hosted-service machinery fails review by default.
- The key-custody question for forked instances (per-instance keys vs. platform signing vs. a default-with-options) is **not** decided here — it resolves as the Q56 ADR, which must cover the fork-instance case alongside the spoke-emission case ([civic-ai-tools#102](https://github.com/npstorey/civic-ai-tools/issues/102)). Decision 2 constrains it: a platform *signing service* for third-party instances would be a hosted-service surface.
- Fork-facing contract documentation (deploy guide, fork-facing API docs) freezes only after the [ADR-0016](0016-vcs-native-lifecycle-mapping.md) naming sweep lands, so it is written once against the final `sealed`/`public` vocabulary.
- The demo instance remains the project's own publishing surface and the standard's first proof — nothing in this posture reduces the project's commitment to operating *its own* instance well.
- If a future maintainer or governance body revisits this posture (e.g., a fiscally-sponsored hosted offering), the revisit is a superseding ADR that must address the adopter-competition inversion and the custody/availability obligations named here.

## References

- [ADR-0013](0013-verification-rendering-delegation.md) — the neutral, forkable verifier; the verification half of the fork-first posture already shipped (`@typedstandards/verify-core`).
- [ADR-0014](0014-evidence-system-fork-resolution-path-b.md) — the two-identity split (neutral standard / civic instance) this posture extends to the application layer.
- [ADR-0016](0016-vcs-native-lifecycle-mapping.md) — the naming sweep that precedes fork-facing contract freezes.
- [ADR-0017](0017-ipr-posture-dco-rf-statement.md) — the IPR gate cleared before inviting forks.
- `docs/architecture/end-state-vision.md` — "city implementations are customizations of the open-source software."
- `docs/architecture/xanadu-doctrine.md` — the gate scoping fork enablement to real adopter need; satisfied here by a prospective implementer.
- `docs/architecture/working-method.md` — the promotion path this ADR follows (planning record → ADR when load-bearing).
- `docs/architecture/open-questions.md` [Q56](../architecture/open-questions.md#q56--hub-topology-thin-vs-thick-hub-registry-location-and-key-custody) — hub topology / key custody; constrained but not resolved by this ADR.
