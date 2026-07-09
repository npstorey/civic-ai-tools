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

4. **Certain capabilities are deferred as future community/vendor extensions, not core v1 roadmap.** Two are named today: **browser-sandbox execution** (the server-side execution model stands for v1; a contributor-driven browser-sandbox path is welcome when a contributor materializes) and **multi-tenancy / per-tenant isolation** (a single-tenant instance is the v1 shape — one instance, one organization; a vendor or contributor may later extend the software to host multiple isolated organizations). The project does not build either speculatively; both are welcome as downstream contributions when a real need materializes. This keeps the posture intact — the project ships single-tenant software it does not operate for others — while recording these as anticipated extension points rather than permanent exclusions.

5. **A public front door plus an account-gated full application is the intended surface split; its name, topology, and repo layout stay open.** The intended shape is a public, marketing-lite front door (the with/without demonstration) alongside the full reference application behind sign-in — the latter running on the *project's own* instance, where accounts gate who may log in to that instance (early access may be application-gated). This stays within Decision 2: it is the project operating its own instance well, not hosting instances for third parties. What remains open, pending the Phase 0 fork-cost inventory: whether the full app deploys under a distinct name ("app.civicaitools.org" is a candidate, not a decision), whether it is a separate deploy from the front door, and the forkable repo's shape. This ADR records posture and the intended surface split, not the topology.

6. **Two adoption layers: a forkable application and importable packages.** The *application* is adopted by forking or templating it — clone, configure, deploy; you do not `npm install` a whole web app. Its *reusable internals* are adopted as importable packages: the verification core already ships this way (`@typedstandards/verify-core`, [ADR-0013](0013-verification-rendering-delegation.md)), and further extraction — the evidence engine, MCP client, skill composition; the Phase 0 portability audit found the core largely decoupled — happens when a real adopter needs the library rather than the whole app, per the Xanadu doctrine. "Fork-first" describes the application layer; it does not mean fork-only. The prospective implementer's current need is the fork-and-deploy path; the package layer serves the adopter who wants only the engine.

## Considered and rejected alternatives

- **Hosted service (SaaS), with or without payments.** Rejected — inverts the positioning per Decision 2. The project's adoption thesis is consumption-side liquidity and forkable reference implementation, not operated infrastructure. A hosted service would also concentrate key custody and availability obligations in a solo-maintainer project — exactly the institutional-mortality risk the standard's design distrusts.
- **Managed "pilot instances" as a middle path (project-operated instances for early partners).** Rejected for the same reasons at smaller scale: every operated instance is an ongoing custody + availability + support obligation, and the precedent converts each future adopter conversation into a hosting negotiation. Partners get a better artifact: a fork that works.
- **Leaving the posture unrecorded.** Rejected — the fork-enablement work now beginning would otherwise be scoped against an undocumented assumption; the first structural question (custody, parameterization depth, portability bar) would re-litigate the posture implicitly. The working method's promotion path exists for exactly this moment.
- **Recording the posture as a ROADMAP commitment instead of an ADR.** Rejected — ROADMAP §3 commitments are absolute trust commitments (verifiability, cadence) per [ADR-0002](0002-commitments-vs-targets.md); a product posture is an architectural decision with a named revisit mechanism, which is ADR-shaped.

## Consequences

- Fork-enablement work (config extraction, per-instance trust registry, deploy guide, time-to-first-value setup path) is licensed and scoped against this posture; hosted-service machinery fails review by default, and multi-tenant / per-tenant machinery is out of v1 scope as a recorded future extension (Decision 4) rather than a permanent exclusion.
- The instance access model stays binary for v1 — creator-only (`sealed`) vs. world-public (`public`). Per-user / per-org scoped access control (so an org instance's users see only the objects they are granted, not just their own drafts and the fully-public set) is recorded as deferred future work in [civic-ai-tools-website#161](https://github.com/npstorey/civic-ai-tools-website/issues/161), sequenced after the ADR-0016 naming sweep; it is the lighter, single-tenant cousin of the deferred multi-tenancy (Decision 4).
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
