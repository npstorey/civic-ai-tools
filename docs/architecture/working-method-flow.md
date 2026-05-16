---
Status: Companion to working-method.md
Last updated: 2026-05-16
Maintainer: [TK: leave as placeholder]
---

# Working-method flow

A practical companion to [`working-method.md`](working-method.md). The working method defines the surfaces and the promotion criteria; this document is the **operational guide** for the question session participants ask most: "I have a thing in my chat — where does it go?"

It is shorter, more concrete, and oriented around the moment of decision, not the doctrine. Read it when you have something to place; read `working-method.md` when you need the rationale.

## Six coordination surfaces, one-line each

| # | Surface | Purpose | Path |
|---|---------|---------|------|
| 1 | **Registry** | Unresolved decisions (the front door) | `civic-ai-tools/docs/architecture/open-questions.md` |
| 2 | **Proposed-issues** | Decision drafts not yet ready for execution | `civic-ai-tools-website/docs/proposed-issues/<NNN>-name.md` |
| 3 | **GitHub Issues** | Execution work that has passed the promotion criteria | Relevant repo on GitHub |
| 4 | **ADRs** | Settled decisions, append-only | `civic-ai-tools/docs/adr/<NNNN>-name.md` |
| 5 | **Specs / architecture docs** | Canonical project state | `civic-ai-tools/docs/architecture/*.md` |
| 6 | **Memory & instruction surfaces** | Cross-session coordination | `~/.claude/projects/.../memory/*.md`, `CLAUDE.md` files |

Per the doctrine, **one canonical home per piece of knowledge**. If the same content lives in three places, two are wrong.

## Flow from origination

```
                  ORIGINATES in local Claude Code session
                            │
                            ▼
                  ┌───────────────────┐
                  │  What is it?      │
                  └─────────┬─────────┘
                            │
   ┌─────────────┬──────────┼──────────┬──────────────┐
   ▼             ▼          ▼          ▼              ▼
QUESTION     DRAFT       WORK ITEM   PLANNING/      INSIGHT
(no answer   DECISION    (past all   BRAINSTORM     worth
yet — needs  (debatable, three       CONTEXT        remembering
discussion)  needs       promotion   (in active     across
             review)     criteria)   iteration)     sessions
   │             │          │          │              │
   ▼             ▼          ▼          ▼              ▼
Registry    Proposed-    GitHub      Workspace      auto-memory
(open-      issues       Issue       root           (this dir's
questions   (NNN-name.md (filed in   (local-only;   MEMORY.md
.md)        in website   relevant    promote when   via Write)
            repo)        repo)       stable)
   │             │          │          │              │
   │             │          │          │              │
   ▼             ▼          ▼          ▼              ▼
Discussed;   Reviewed;   Worked on   Iterate;       Cross-session
when         filed as    when        promote to     recall;
answered,    Issue when  scheduled;  proposed-      review
becomes      promotion   produces    issues OR      periodically
ADR + spec   criteria    spec edits  proposals/     for staleness
amendment    met         + ADR       OR an Issue
                         when done   when ready
```

## The three promotion criteria (gate for becoming a GitHub Issue)

From `working-method.md`. **All three must hold**:

1. **Path to resolution clear enough to scope work against** — acceptance criteria can be enumerated from current direction + resolution criteria.
2. **Resolution needed for downstream work to proceed** — an existing adopter is blocked, or in-flight project work has hit it as a hard dependency.
3. **Project has explicitly decided to invest the time** — capacity allocated; this isn't speculative wishlist work.

If any one criterion fails, the item stays in the registry (if it's a question) or in proposed-issues (if it's a decision draft) or in a workspace-root planning doc (if it's still in active iteration).

## Worked classification examples

Common items and where they go:

| The item | Where it lives | Reason |
|---|---|---|
| "Should we use COSE or JOSE for signing?" | Registry | Unresolved decision; no adopter pull yet. |
| "We've decided to use COSE. Here's the detailed migration plan." | Proposed-issue, then Issue once scoped + capacity-allocated | Decision is made; the implementation needs design work first. |
| "Implement COSE signing in the package builder." | Issue | Past all three criteria. |
| "ADR-0007 records the COSE decision." | ADR | Settled. |
| "The OES spec §4.6 specifies COSE format." | Spec text | Canonical project state. |
| "Brainstorming three options for the OES spinout decision." | Workspace-root planning doc | Active iteration; not ready for any of the durable surfaces. |
| "We met X on Y date." | Outside the memory system entirely | Session state, not durable knowledge. |
| "Pittsburgh wants us to add `committed` visibility for internal data." | Issue (Pittsburgh is the adopter; criteria met) | Past all three criteria. |
| "It would be cleaner if hosts could express SLA in their self-attestation." | Registry; promote when an adopter needs it | Speculative wishlist until adopter pulls. |

## Cross-surface moves require deliberate review

Per `working-method.md`: content moving between surfaces — memory to instructions, internal working draft to externally shared, gitignored to tracked, private to public — requires deliberate review before the change lands. The session proposing the transition surfaces it; the user reviews and approves.

Common transitions to think about:

- **Workspace-root planning doc → `civic-ai-tools/docs/proposals/`.** Sanitize the framing (drop "v1 draft for Nathan's review"; reframe for outside readers). Strip any strategic-content boundary violations. Reference the resulting GitHub Issues by number.
- **Proposed-issue → GitHub Issue.** Confirm all three promotion criteria. Add a "Promoted to issue #N" pointer in the proposed-issue file or the registry entry.
- **Registry question → ADR.** Resolution lands as an ADR; registry entry moves to the Resolution log with a link.
- **GitHub Issue → ADR.** When the work produces a settled decision, an ADR is filed; the registry entry that prompted the issue gets updated.

## What this flow is not

- **Not a single linear path.** Items can move sideways (workspace planning → proposed-issue without registry), get parked (deferred), or be retired (no longer relevant). The diagram above is descriptive of the common moves, not prescriptive.
- **Not a permission system.** Anyone can put a question in the registry. The promotion criteria gate movement *out* of the registry into execution work, not movement *into* the registry from chat.
- **Not a substitute for the doctrines.** [`working-method.md`](working-method.md) is the why; [`xanadu-doctrine.md`](xanadu-doctrine.md) is the spec-growth gate; [`chat-type-taxonomy.md`](chat-type-taxonomy.md) is the conversation-surface discipline. This document is the practical surface map.

## Common failure modes

- **Filing speculative wishlist work as an issue** because "we discussed it and it seems important." Issues invite "what's the status?" pressure that registry entries don't. The right move for a not-yet-actionable idea is a registry entry or proposed-issue draft.
- **Duplicating content across surfaces.** A spec section restating an ADR's decision; a memory entry restating a CLAUDE.md instruction; a planning doc restating registry content. Pick one canonical home; the others get a pointer.
- **Letting workspace-root planning docs accumulate.** They're a holding pen, not a destination. Promote them to `docs/proposals/` (or proposed-issues, or registry, depending on shape) when they stabilize.
- **Filing 12 issues from one planning session.** A planning session often generates a few items that pass the promotion criteria now plus a long tail that should be in the registry or proposed-issues. Filing the long tail as issues prematurely conflates thinking work with execution work and clogs the tracker.

## Companion documents

- [`working-method.md`](working-method.md) — the doctrine this flow operationalizes.
- [`xanadu-doctrine.md`](xanadu-doctrine.md) — the spec-growth gate.
- [`chat-type-taxonomy.md`](chat-type-taxonomy.md) — the conversation-surface discipline.
- [`open-questions.md`](open-questions.md) — the registry itself.
