---
Status: Doctrine
Last updated: 2026-08-23
---

# Chat type taxonomy

> **This document is project doctrine, version 2.** It names the six kinds of session this project runs, where each one roots, what it reports and to whom, and the rule by which it closes. It is the third of the project's three doctrines, alongside [`xanadu-doctrine.md`](xanadu-doctrine.md) and [`working-method.md`](working-method.md), which cites it.

## Purpose

Sessions are not interchangeable. Strategic thinking, program coordination, sprint orchestration, scoped execution, doctrine revision and external correspondence carry different context, different authority and different failure modes. Treating them as one category produces sessions that drift, accumulate state fitting no role, and end without anyone knowing what they owed.

This taxonomy names the types and holds them apart. It is doctrine, not procedure: the mechanics of booting, gating and closing a session live in the skills that run them, and are revised on their own cadence. Every rule below states the reason it exists, because a rule whose reason has expired should be cut at the next revision rather than inherited.

## The six types

All six run in Claude Code. The surface no longer distinguishes them — **the root directory does.** A session's type follows from the directory it opens in and the contract it boots with, and it is named in the first exchange, because a session that cannot name its type has a scope nobody has decided.

### 1. Strategic

**For** — one non-trivial question that does not yet have a shape. The output is understanding, not deliverables.

**Roots** — in the repository whose artifacts the question is about, read-mostly. It opens no branches, because a strategic session that starts editing has become an implementation session without saying so.

**Reports** — to the owner, as a conclusion and its disposition: a question registered in [`open-questions.md`](open-questions.md), a scope handed to a plan seat, or the recognition that the question was already answered elsewhere.

**Closes** — when the conclusion exists. Work falling out of it is routed, never absorbed.

### 2. Plan seat

**For** — holding program scope across sprints: what is in flight, what is owed, what comes next. One seat at a time, because two sessions holding program scope hold two different versions of it.

**Roots** — in the planning repository, where program state lives. It reads the code repositories and implements in none of them.

**Reports** — to the owner. More than two open rulings become a decision memo; fewer are asked directly. Either way the report names what is owed and who holds it. The seat also reads each sprint's head commit before a merge — see the two keys, below.

**Closes** — not on a schedule. It is the one long-lived type: it retires at a seam, handing its state to a successor as an artifact, never mid-sprint, because a seat that ends mid-sprint leaves the program state nowhere.

### 3. Orchestration (ORCH)

**For** — one sprint, from charter to close: writing phase contracts, spawning implementers, and evaluating what they return against the repository rather than against their word.

**Roots** — in the repository the sprint targets, booted from a sprint anchor issue, because the anchor is the durable record of the sprint and the session is not.

**Reports** — a gate record per phase, to the seat and the owner: branch, diff stat, the verification output in full, model and effort disclosed. Evidence, not assurance.

**Closes** — at sprint close, when every phase is merged or explicitly parked in the anchor. It does not carry into the next sprint; the next sprint boots its own.

### 4. Implementation (IMPL)

**For** — one phase of one sprint under a written contract: ground truth as measured, the blast zone, and a small set of binary criteria with runnable checks.

**Roots** — in a worktree of the target repository, isolated from every other phase. **It never pushes to a deploying branch and never merges,** because the merge is an owner act.

**Reports** — to the ORCH that spawned it: what changed, the commands it ran with their output, each criterion checked one by one, and anything it could not do. A criterion honestly reported as failed is worth more than one asserted as passed, because only the first is actionable.

**Closes** — when its evidence is filed. It does not look for further work; an implementer that improvises scope has left its blast zone.

### 5. Meta

**For** — reasoning about the method rather than running it: which type fits a kind of work, whether a doctrine still matches practice, whether a tool or configuration layer earns its place. This document is revised here.

**Roots** — in the repository that owns the document or configuration under revision, because a decision about a layer lands as a change to that layer.

**Reports** — to the owner: the decision, the layer it lands in, and the pull request that lands it.

**Closes** — when the decision is recorded and routed. A meta session still reasoning after its decision is made is avoiding the work it decided on.

### 6. Comms

**For** — external correspondence and the state around it: incoming messages, outbound updates, the opportunity backlog, meeting preparation. The output is managed external state.

**Roots** — in the operations repository, and only there. Relationship content never enters a public repository or a project memory surface, because publication is not reversible.

**Reports** — to the owner: what was logged, sent or prepared, and what it is waiting on.

**Closes** — when the coordination event is done. Project work surfacing during one is routed to a plan seat, not scoped here.

## The hierarchy — seat, ORCH, IMPL

Three layers, one direction of authority. The seat holds program scope and sets each ORCH's model, erring toward the top tier, because an ORCH's misreading propagates into every phase it contracts. Each ORCH holds one sprint, sets its implementers' models, and discloses each choice in the gate record for that phase, because the tier is a variable in the result and an undisclosed variable cannot be read afterwards. Implementers hold one phase each and set nothing.

Reporting runs the other way and stops at the owner: evidence up to the ORCH, gate records up to the seat and the owner, rulings back down. No layer merges its own work in a repository that deploys.

## Model policy by layer

| Layer | Default | Go up when | Go down when | Why |
|---|---|---|---|---|
| Plan seat | The top judgment tier (Fable 5) | — | The next tier down (Opus 5) at a clean seam, when the weekly allowance is spent | One long-lived session in which nearly every token spent is a judgment call |
| ORCH (per sprint) | Opus 5 | The top tier when the charter is thin, the sprint is design-heavy, or premise corrections are expected | Never below Opus | A sprint's worth of phase contracts is written here; an error compounds across all of them |
| IMPL (per phase) | Sonnet 5 for a bounded phase whose contract carries binary criteria with runnable checks; Opus 5 for long-horizon, multi-file or ambiguous phases — never Sonnet for a migration or a single-shot change | Opus 5 when a bounded phase fails its gate twice, or exhausts its output on a long one | Lower the reasoning effort before lowering the tier — the cheaper lever, and the one rarely tried | The quality variable is the contract, not the tier; but an unbounded phase has no contract to carry it |
| Cold read / verifier | Opus 5, fresh context | — | — | The value is the absence of the authoring context, not the tier |
| Triage, census, classification | Haiku 4.5 | — | — | Mechanical passes over many items, where the judgment is already written down |

The binding constraint is not tokens. It is owner pickups and wall-clock per merged phase, because that is the resource the program runs out of first: a tier that costs a fix-on-top round loses to one that does not, whatever it saved. **This table is re-asked at every model change** — rules do not carry across model generations by default, and one learned on an older model is often scaffolding a newer one does not need.

## Messaging

Sessions do not message each other unless the owner explicitly directs it; the owner is the router. Cross-session delivery was trialled and withdrawn, because two sessions reconciling by message cost more coordination than one owner carrying a decision between them. State moves between sessions through artifacts — anchors, pull requests, handoff records — because an artifact can be read later and a message cannot.

## Gates, and the two keys

**A gate exists at every owner act, and nowhere else.** An owner act is a merge into a repository that deploys, a step only the owner can run, or a decision. Between gates verification is automatic — the checks, the evidence protocol — and phases need not be serialized, because serialization is endurance scaffolding rather than policy, and it spends the one budget that actually binds. Owner pickups are that budget: count them before the sprint starts, and that number is the sprint's real size.

**A merge takes two keys, and both are bound to a head.** The coordinating seat reads the pull request at an exact head commit and gives its key; the owner merges on that key and their own. The read is bound to the commit it was made against, because a head that moved after the read was never the thing approved.

## Decisions

More than two decisions owed to the owner become a decision memo — one instrument that verifies its own premises and asks for rulings a card at a time — and never prose, because decisions buried in a narrative report are decisions that do not get made. Two or fewer are asked directly, in the report.

## The cold read

Any sprint may run a cold read, a standing optional phase: a fresh session that reads only the change and the criteria it was meant to meet, never the conversation that produced them, and reports gaps without fixing anything. Its value is what it does not know, because the authoring context is exactly what hides the defect.

## Closing

Each type above carries its own closure rule. One test governs all six.

> **The closable test —** a chat closes without asking when its closeout reports nothing owed and nothing mid-flight; if closeout hasn't run, run it; resume is for mid-flight state only — otherwise the next chat boots fresh from artifacts, never from the old context.

A report that ends a session therefore says *closable*, or names what is owed and who holds it, because "done" without a disposition costs the owner a round-trip to resolve.

## The layer rule

Four layers hold this project's configuration and knowledge, and each is chosen by a question. Does it hold for every repository on this machine — the **global** layer, which reaches every session here and nothing anyone else clones. Does anyone who clones this repository need it, a scheduled cloud run included — the **project shared** layer, committed, public-safe by construction, and the only layer a cloud session ever sees. Is it about this machine or this checkout — the **project local** layer, gitignored and disposable. Is it a fact learned rather than a fact about the repository — **memory**, which never reaches the repository or a cloud run. The rule that keeps the four honest: a repo-true fact graduates out of memory into the repository's committed instructions, because a fact only one machine knows is a fact the project does not have.

## Memory pruning

Pruning is continuous rather than periodic: the closing ritual of every type carries the check for what this session superseded, which is the moment the knowledge is freshest and the cost of removing it lowest. What belongs in memory at all is [`working-method.md`](working-method.md)'s conditions; the layer rule above decides which surface a surviving fact belongs on.

## Chats that resist typing

Three patterns look untyped and are not. A session that begins before its shape is known is typed once the shape appears — the typing matters, its timing does not. A session touching two types is named by the dominant one; two types sustained equally is a signal to split, not to invent a hybrid. A casual or cross-project conversation is not in this taxonomy at all, and belongs on a personal surface outside any project repository.

There is deliberately no "untyped" type, because an escape-hatch category absorbs everything awkward and the real categories then erode by exemption. Equally deliberately, this document prescribes no session lengths and no opening or closing scripts: the discipline is recognising the type and honouring its disposition, not performing a ritual.

Three rules carry the rest. **Name the type at startup** — the root directory usually names it, and a type that cannot be named is a scope that has not been decided. **Close when the scope is done,** per the closable test, because the cost of opening a session is small and the cost of a blended one is not. **A session does not change type** — the seat is the deliberate exception, and it changes scope rather than type: it coordinates, and never implements what it coordinates.

## What changed since v1, and why

*2026-08-23.* Version 1 (2026-05-03) described eight types spread across two surfaces. Every type now runs in Claude Code, so the surface distinctions went with it: the three planning variants, split by whether chat-history search was available, no longer distinguish anything any current session does and have become the single plan seat. The one "orchestration chat" had already split in practice into a standing seat and per-sprint ORCHs, and the "implementation chat" is now a subagent under a phase contract, in a worktree, that never pushes.

Seven things the program has run on for months were absent from v1 entirely and are stated here for the first time: the gates and the two-key head-bound merge; the coordinating seat; explicit-only messaging; model policy by layer; owner pickups as the budget; the decision-memo threshold; and the cold read. What v1 got right and this version keeps: closure rules per type, the refusal of an untyped category, the dispositions for chats that resist typing, and the discipline of naming a type before the work starts.

## Companion documents

- [`working-method.md`](working-method.md) — how unresolved decisions and content reach the right surface. This taxonomy governs *which session* does the work; that method governs *where its output lands*.
- [`xanadu-doctrine.md`](xanadu-doctrine.md) — the spec-growth gate: nothing is promoted without a real package or adopter that needs it.
- [`working-method-flow.md`](working-method-flow.md) — the practical surface map and worked examples.
- [`open-questions.md`](open-questions.md) — the registry of unresolved decisions, and the destination a strategic session most often reports to.

The rituals these rules are enforced by — booting a sprint, closing a session, handing a role to a successor — live as skills at the global layer, because doctrine names the rule and a skill runs it. A broader cross-project taxonomy, covering work outside this project, is tracked on a personal surface outside any project repository.
