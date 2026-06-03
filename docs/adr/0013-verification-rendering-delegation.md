# ADR-0013: Verification rendering — glance in-page, full detail delegated to a neutral client-side verifier

- **Status:** Accepted
- **Date:** 2026-06-03
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

The "Evidence trust UX" milestone ([civic-ai-tools-website#110–#115](https://github.com/npstorey/civic-ai-tools-website/milestone/1)) was scoped to re-skin and extend the verification panel *embedded in the civicaitools.org evidence detail page*: #110 built the trust-signal vocabulary; #111 re-skins the existing checks onto it (the calm baseline); #113 / #114 were scoped to surface the remaining §9.2 checks (typed-standards envelope checks; content-integrity checks) in that same in-page panel.

In parallel, [civic-ai-tools-website#116](https://github.com/npstorey/civic-ai-tools-website/issues/116) scopes a standalone third-party verifier hosted on the neutral standards domain `typedstandards.org`: a client-side page where a reader supplies a package hash / hosted URL / self-contained bundle and watches the §9.2 checks run in their own browser. Its motivating rationale is explicit — *"'don't trust the publisher, verify independently' is far stronger when the verifier is not hosted by the publisher,"* and the specification warns against a hosted *verification endpoint* (a server that verifies *for* you) in favor of a client-side page running the checks against public infrastructure.

Those two efforts raise a question the milestone did not settle: **where does verification get rendered** — a full per-check panel in each publishing host's page (#113 / #114), or delegated to the neutral verifier? Rendering the full per-check breakdown in-page on civicaitools.org has weak justification: the reader who wants per-check detail is, almost by definition, a skeptic — and a skeptic is precisely the reader who should *not* trust the *publisher's own* rendering of that detail. The strong form sends them to a neutral, forkable verifier. Meanwhile every host that adopts the standard would otherwise have to rebuild its own in-page verification panel.

The Xanadu gate is satisfied by a real adopter: **datHere** (publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md); the Pittsburgh / WPRDC pilot integration partner) needs to render a verify affordance on the packages it publishes, without rebuilding the verification UI. A single neutral verifier reached via an embeddable badge serves that need; duplicating an in-page panel per host does not.

## Decision

Adopt a **hybrid verification-rendering model split by disclosure depth**, and re-scope the milestone accordingly.

### 1. Glance in-page, detail delegated

Each publishing host (civicaitools.org and adopters) renders, on its evidence/detail surface, only the **glance** layer: a calm overall-integrity summary (using the #110 trust-signal vocabulary) plus an embeddable **verify badge**. The **detail** layer — the full §9.2 step-by-step "show the math" — is rendered once, by the neutral client-side verifier at `typedstandards.org/verify`, reached when the reader clicks the badge (which deep-links `?url=<package-url>`). The publisher does not render its own full per-check verdict.

This is design-principles **P5** (glance → narrative → detail) realized across two properties: the glance lives with the publisher; the detail lives on the neutral domain.

### 2. The verifier is neutral, client-side, publisher-agnostic, and forkable

Per #116, the verifier resolves the trust registry from whatever publisher a package declares (not hard-coded to civicaitools.org), runs the checks in the reader's browser against public infrastructure, and is hostable / forkable by any party. The "same maintainer controls both properties today" fact does not weaken the model: the architecture is publisher-agnostic and the code is forkable, so the trust property — *verify on a surface the publisher does not control* — holds for any future independent operator.

### 3. Milestone re-scope

- **#111** is unaffected (in-page glance + the vocabulary foundation).
- **#113** is re-scoped from "surface the typed-standards envelope checks in the in-page panel" → **"in-page integrity glance summary"** (a single calm overall verdict; the per-check envelope detail it originally scoped moves to the delegated verifier).
- **#114** is re-scoped from "surface the content-integrity checks in the in-page panel" → **"render the embeddable verify badge"** (the host-side entry point to the delegated verifier; the per-check content-integrity detail moves to the delegated verifier).
- **#116** gains the **embeddable verify-badge** as an explicit deliverable (the cross-host adoption mechanism; mechanically its hosted-URL input mode invoked by a badge) and becomes the canonical home for all per-check verification rendering.

### 4. No normative spec change in this ADR; the spec narrative updates with the verifier

This ADR records a UI-rendering-*location* decision; it changes no normative envelope mechanic or verification rule. The Typed Standards Specification's §7.3 / §9 verification-flow narrative is updated to describe the delegated-verifier surface when the verifier and its full-offline-crypto hardening land — the work that graduates §9.4's aspirational offline-verifiability to a demonstrated property and resolves [Q15](../architecture/open-questions.md#q15--external-verification-testing) — not in this ADR.

## Consequences

- The per-check verification UI is built **once** (on typedstandards.org), not per host — eliminating the cross-surface drift risk #116 flags, and giving adopters verification "for free" via the badge.
- civicaitools.org's evidence page keeps a low-friction in-page integrity glance (P5's glance layer) while the trustless detail experience lives on the neutral domain — the strong trust form becomes the default.
- #113 / #114 shrink substantially; effort shifts to #116 (the verifier + badge) as the milestone's real next investment.
- The decision presupposes typedstandards.org exists; until #116 stands it up, civicaitools.org's in-page glance (#111) is the interim verification surface.
- Closes [Q46](../architecture/open-questions.md#q46--verification-rendering-in-page-per-host-vs-delegated-to-a-neutral-verifier).

## References

- [Q46](../architecture/open-questions.md#q46--verification-rendering-in-page-per-host-vs-delegated-to-a-neutral-verifier) — this decision's open-question entry.
- [civic-ai-tools-website#110–#115](https://github.com/npstorey/civic-ai-tools-website/milestone/1) — the Evidence trust UX milestone (#111 glance; #113 / #114 re-scoped; #116 the verifier + badge).
- [civic-ai-tools-website#116](https://github.com/npstorey/civic-ai-tools-website/issues/116) — standalone third-party verifier (the neutral surface this delegates to).
- [ADR-0004](0004-dathere-captureMethod-variant.md) — datHere (the motivating adopter).
- Typed Standards Specification §7.3 (verification flow), §9 (conformance; §9.2 check list; §9.4 honest-status notes), §5.1 (consumer-judgment preamble).
- `civic-ai-tools-website/docs/design-principles.md` P5 (glance → narrative → detail); `civic-ai-tools/docs/trust-and-evidence.md` (publisher-independent trust posture).
