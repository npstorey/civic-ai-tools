---
Status: Doctrine
Last updated: 2026-05-02
Maintainer: [TK: leave as placeholder]
---

# Working method for unresolved decisions

## Purpose

The working method governs how unresolved decisions affecting the project's architecture and standards get tracked, surfaced, and progressed. It exists because the project needs a way to absorb thinking work — exploration, framing, deferring, retiring — without creating premature execution pressure. It is load-bearing project discipline, equivalent in stature to the Xanadu doctrine: the doctrine governs *what gets into the spec*; this method governs *how decisions get there*.

## The four surfaces

Decisions and their artifacts live in four distinct places. Each has a role; conflating them collapses the working method.

1. **`civic-ai-tools/docs/architecture/open-questions.md` — the registry.** Canonical home for unresolved decisions affecting architecture and standards. The front door. Every spec callout that depends on an unresolved question cites this registry by Q-number. Entries carry: Title, Status, Origin, Stakes, Current direction, Resolution criteria, Notes. Statuses include Open, In discussion, Promoted to issue #N, Resolved (with link to ADR or spec section), Deferred.

2. **`civic-ai-tools-website/docs/proposed-issues/*.md` and GitHub issues — execution work.** Issues are filed when a question is ready for execution, not as the default destination for every decision. Local proposed-issue drafts live in the website repo and may or may not be promoted to actual GitHub issues. Filing as a GitHub issue is itself a workflow decision, not automatic.

3. **`civic-ai-tools/docs/adr/*.md` — decision records.** Settled architectural choices, recorded in append-only form. ADRs are amended only via dated status notes (see ADR-0003's 2026-04-29 status note for the canonical pattern). The immutability of accepted ADRs is the property that makes the system trustworthy: a reader can rely on an ADR meaning what it said when it was accepted, with subsequent qualifications visible as discrete, dated additions.

4. **`civic-ai-tools/docs/architecture/*.md` (specs, vision, doctrines) — canonical statements of project state.** Specs reflect what is built or what direction is committed; vision documents reflect architectural rationale; doctrines (Xanadu, this one) record load-bearing project discipline. Spec sections that depend on unresolved questions carry inline `⚠ Subject to Open Question #N` callouts pointing at the registry.

## The promotion path

A question lands in the registry. From there, it may take any of the following paths:

- **Resolve directly via discussion.** Becomes an ADR or a spec revision. Registry entry moves to the Resolution log with a link to the resolution.
- **Get promoted to a GitHub issue.** Status changes to `Promoted to issue #N`. The issue carries the execution work; the registry entry stays as the durable record of the question.
- **Be deferred indefinitely.** Status changes to `Deferred` with a brief note on what would re-open it.
- **Be retired.** Conditions made the question moot — the underlying choice no longer matters or has been overtaken by other decisions. Move to the Resolution log with a one-line note explaining the retirement.

The registry is the front door. GitHub issues are not the default destination for every decision — they're the execution back end for decisions that have already passed the promotion criteria.

## The promotion criteria

A question becomes a GitHub issue when *all three* of the following hold (the same disjunction the registry already documents):

1. **The path to resolution is clear enough to scope work against.** A reader can produce a list of acceptance criteria from the question's current direction and resolution criteria.
2. **The resolution is needed for downstream work to proceed.** Either an existing adopter is blocked, or in-flight project work has hit the question as a hard dependency.
3. **The project has explicitly decided to invest the time.** Capacity has been allocated; this isn't speculative wishlist work.

This is consistent with the [Xanadu doctrine](xanadu-doctrine.md): don't promote items to executable work without the work being needed. A question that fails any criterion stays in the registry — it's still a question, it's just not yet an issue.

## Relationship to the Xanadu doctrine

The Xanadu doctrine governs **spec growth**: do not promote anything in the spec to a higher build state without a real package or adopter that needs it. This working method governs **decision-making**: how questions get tracked, when they become issues, how their resolutions land in ADRs and spec text.

The two are complementary:

- The doctrine tells you *when something belongs in the spec*. A speculative direction stays out of normative spec text until it passes the gate.
- The working method tells you *how to get there*. Speculative directions live in the registry as questions, with current direction noted but not committed; they get promoted to issues when the work is needed; resolutions land as ADRs that may then license spec changes.

A question can sit in the registry indefinitely without violating the doctrine — research and direction-noting are explicitly exempt from the gate. What the doctrine prevents is the speculative direction *jumping straight into spec text* without passing the gate. The working method's promotion criteria are the procedural form of the same principle.

## What this method explicitly avoids

The default in many projects is "every decision becomes an issue immediately." The cost is real:

- **The issue tracker becomes the thinking surface.** Issues are designed for execution work — they have assignees, milestones, status workflows, completion semantics. Using them for thinking work imports those semantics whether you want them or not.
- **Pressure to resolve.** An open issue invites the question "what's the status?" and rewards closure. A registry entry doesn't carry that pressure; it just exists, durably, until conditions change.
- **No reward for "we decided this is interesting but not now."** Issue trackers don't have a good shape for this; the closest is a label like `wontfix` or `later` that carries the wrong tone. The registry's `Deferred` and `Open` statuses mean what they say without the `wontfix` baggage.
- **Conflation of work units with thinking units.** A single registry question may resolve via three issues, or via no issues, or via a spec revision that itself spawned a discussion. Forcing every question into a single-issue mold is a category error.

The registry exists precisely to absorb that thinking work without absorbing the issue-tracker semantics. Issues come later, when the question is ready for them.

## Companion documents

- [`open-questions.md`](open-questions.md) — the registry itself. Live document.
- [`xanadu-doctrine.md`](xanadu-doctrine.md) — the spec-growth gate. Cited by ADRs and spec drafts when decisions involve a Xanadu-test transition.
- [`../adr/`](../adr/) — Architectural Decision Records. The ADR log. ADR-0001 (roadmap governance), ADR-0002 (commitments vs. targets), ADR-0003 (capture-method differentiation) are the current set.
- [`end-state-vision.md`](end-state-vision.md) — architectural rationale and the layered standards stack. Vision-doc updates follow this method when they touch unresolved questions.
- [`open-evidence-standard.md`](open-evidence-standard.md) and [`civic-claim-vocabulary-draft-spec.md`](civic-claim-vocabulary-draft-spec.md) — the canonical spec drafts. Both internal working drafts (pre-v0.1) at the time this method was formalized.
