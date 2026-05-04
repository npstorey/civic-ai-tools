---
Status: Doctrine
Last updated: 2026-05-03
Maintainer: [TK: leave as placeholder]
---

# Chat type taxonomy

> **This document is project doctrine.** It defines the taxonomy of conversation types used in this project's work, the conditions under which each type is appropriate, and the discipline that holds them apart. Cited by `working-method.md` and applied across all conversational surfaces (Claude.ai web, Claude Code, and any future executor).

## Purpose

Conversation surfaces are not interchangeable. Different kinds of work — strategic exploration, coordinative planning, in-flight orchestration, scoped execution — have different cognitive loads, different memory needs, different tooling requirements, and different failure modes when they collide. Treating "a chat" as a single category papers over those differences and produces predictable problems: context windows that feel "all over the place," chats that morph mid-stream from one purpose to another, accumulated state that doesn't fit any clean role.

This document names the types, their proper uses, their failure modes, and the discipline of keeping them apart.

The taxonomy below is project-specific. There is also a broader, cross-project chat taxonomy that includes work outside this project (personal reflection, cross-project learning, system-level workflow questions). That broader taxonomy is tracked separately in a personal-system surface outside any single project repo. References to "Personal Reflection / Learning" in this document refer to that broader system.

## The seven project-specific types

### 1. Strategic chat

**Purpose:** thinking through a single non-trivial question that doesn't yet have a clear shape. The output is *better understanding*, not deliverables.

**Surface:** Claude.ai web. No codebase access — the work is conceptual, not artifact-shaped. Optional access to chat history (`conversation_search`, `recent_chats`) when prior thinking is relevant.

**Examples:** the early conversations about KOI / atproto / nanopublications layering; the question of whether to generalize the spec beyond AI-produced analysis; the architectural insight about typed claims as a kind of attestation.

**Lifecycle:** short. Most should last one substantive exchange or a small handful. The output is a conclusion, an open question to register, or a recognition that this needs to become a planning chat.

**Closure rule:** when a strategic chat produces a conclusion that needs to turn into work, *close it and start a planning chat for the work*. Do not let a strategic chat morph into ongoing planning.

**Failure mode:** strategic chats that morph into operational threads, accumulating context they shouldn't have. The fix is the closure rule above, applied deliberately.

### 2. Planning chat — variant B (web + chat histories, no codebase)

**Purpose:** coordinative planning where the relevant context lives in prior chats rather than in tracked artifacts. Drafting impl-chat prompts, evaluating impl-chat report-backs, deciding next steps within a defined scope.

**Surface:** Claude.ai web with `conversation_search` and `recent_chats`. No direct codebase access — execution is delegated to impl chats.

**Examples:** early framing of a project before its tracked docs are mature; cross-project planning that draws on prior thinking from multiple chats; OTI/CIDI-style strategic conversations where the context is conversational rather than codified.

**Lifecycle:** medium. As long as the bounded scope it's coordinating, but not longer.

**Closure rule:** when the scope is done, close. Do not roll a planning chat from one project to the next; start fresh for the next bounded scope.

**Failure mode:** planning chats that try to span too much and accumulate cross-cutting context. Recognize the boundary and close.

### 3. Planning chat — variant C (codebase access, no chat histories)

**Purpose:** coordinative planning where the relevant context lives in tracked artifacts (specs, registry, ADRs, doctrines). The canonical sources answer most questions a planning chat would have, so chat-history search is unnecessary.

**Surface:** Claude.ai web with codebase access (or an executor that provides equivalent access). No chat-history search.

**Examples:** planning the resolution of an open question once the project's tracked docs contain enough context that prior chat threads aren't needed; routine sprint planning against a mature artifact base.

**Lifecycle:** medium. Same closure discipline as variant B.

**When to use C vs. B:** if the canonical sources have absorbed the relevant context (which is the case once a project has a registry, working method, and substantive specs), C is more efficient than B. Reserve B for early-project work or when chat history genuinely contains context that hasn't migrated to tracked docs.

### 4. Planning chat — variant D (codebase + chat histories)

**Purpose:** coordinative planning that crosses the boundary between strategic and project work — drawing on prior strategic thinking that hasn't fully migrated into tracked docs, while also needing to evaluate things against the codebase.

**Surface:** Claude.ai web with both codebase access and chat-history search.

**Examples:** beginning of a new arc that synthesizes both strategic exploration and project artifacts; planning that needs to reference both the project's tracked state and unmigrated strategic context from earlier chats.

**Lifecycle:** medium. Heaviest cognitive load and the most expensive in context-window terms; use when warranted.

**Failure mode:** D becomes the default because it's the most powerful, even when C would suffice. Notice when chat history isn't actually being consulted, and downgrade to C in that case.

### 5. Orchestration chat (codebase access, in-flight coordination)

**Purpose:** sitting in the middle of one or more in-flight implementation streams. Receiving report-backs, evaluating what came back, drafting follow-up prompts, deciding whether to continue or course-correct, holding the meta-state of "where are we across multiple impl streams."

**Surface:** Claude.ai web (or an executor that provides equivalent access) with codebase access. Codebase access is load-bearing here because the orchestration chat needs to evaluate impl-chat report-backs against ground truth — reading the actual artifacts, not trusting the impl chat's word for what shipped.

**Examples:** the architecture-foundation arc, where multiple impl chats produced PRs and the coordinating chat needed to evaluate each report-back against actual file contents.

**Distinction from planning:** planning is largely upstream of execution (front-loaded, bursty). Orchestration is concurrent with execution (sustained, rhythmic, peaks at each report-back). They have different cognitive shapes and should be different chats.

**Lifecycle:** medium-to-long. As long as the in-flight streams require coordination.

**Failure mode:** running orchestration without codebase access, compensating by manually pasting report-backs and uploaded files. This works but is lossy and produces "context all over the place" feelings. The fix is to provision codebase access for orchestration chats from the start.

### 6. Implementation chat (Claude Code, codebase, scoped task)

**Purpose:** executing a defined task against artifacts. Reading and writing files. Running commands. Producing concrete deliverables.

**Surface:** Claude Code with full codebase access. No chat-history search needed; the task is in the starter prompt and the artifacts are in the codebase.

**Examples:** every "IMPL A," "IMPL B," etc. The captureMethod enforcement work, the architecture compilation, the memory pass, the audit work.

**Lifecycle:** short to medium. A single bounded task, possibly with a few checkpoint cycles.

**Closure rule:** close when the task is done. Do not carry impl chats forward looking for new work. Explicit "Then close the session" instructions in starter prompts maintain this discipline.

**Failure mode:** impl chats that drift into improvising scope when the original task is done. Prevented by explicit close-out instructions.

### 7. Meta chat

**Purpose:** reasoning about the work itself rather than doing the work. Determining which chat type is best for a given task; defining new chat types when the existing taxonomy doesn't cover a need; evaluating tools, harnesses, or executors; reviewing or revising markdown guidance docs (working method, Xanadu doctrine, this taxonomy itself); auditing the project's working patterns; assessing whether disciplines are holding up in practice.

A meta chat is the type that makes this taxonomy extendable. New chat types are defined here. Tools are evaluated here. The working method's own conventions are reviewed here. The taxonomy itself is revised here.

**Surface:** Claude.ai web. Codebase access optional — needed when meta work involves evaluating tracked artifacts (e.g., reviewing whether the working-method doc still matches actual practice), not needed for purely conceptual meta work (e.g., deciding whether a new chat type is warranted). Chat-history search useful when the meta work draws on observed patterns from prior sessions.

**Examples:**
- Defining a new chat type when an emerging pattern of work doesn't fit existing types
- Evaluating whether a new tool or executor (e.g., a non-Claude harness, a new MCP server, a different orchestration pattern) should be adopted
- Reviewing a markdown guidance document for currency, completeness, or drift from practice
- Assessing whether a doctrine is being followed in practice or has eroded
- Reasoning about workflow patterns: when to start a new chat, when to close, when to escalate to a different type
- Deciding whether two chat types should be merged, or whether one type should split
- Evaluating whether memory-pruning practices are working
- Comparing the project's working pattern against external frameworks (e.g., the agentic-OS comparison)

**Distinction from other types:**

- *Strategic chat* thinks through a substantive question whose answer affects project direction. Meta chat thinks through how the project's work itself is structured.
- *Planning chat* coordinates execution within established conventions. Meta chat reasons about whether the conventions themselves are right.
- *Personal Reflection / Learning* (the broader cross-project surface) handles meta work that spans multiple projects. Meta chat handles project-specific meta work.

A productive distinction: strategic and planning chats *use* the conventions; meta chats *examine* them.

**Lifecycle:** short to medium. Most meta work resolves in one or a few exchanges. The output is typically a decision (adopt this tool, define this type, revise this doc) plus a follow-up to act on the decision in a different chat.

**Closure rule:** when a meta chat produces a decision, close it and route the resulting work to the appropriate type. A meta chat that decides "we need a new chat type" should close, and the new chat type should be used in subsequent work — not used inside the meta chat that defined it.

**Failure mode:** meta chats that try to do the work they're reasoning about. If a meta chat decides "we need to revise the working-method doc" and then revises it inline, the meta chat has changed types mid-stream. Better disposition: meta chat decides the revision is needed, closes, the revision happens in a planning or implementation chat.

A second failure mode: meta chats that get used as a refuge from doing actual work. If you find yourself opening a meta chat to think about how to think about the work instead of doing the work, the meta chat is procrastination. The taxonomy is a tool, not a stage.

**Why this type matters:** without an explicit meta type, taxonomy maintenance happens accidentally inside other chat types — usually planning chats that have drifted. The taxonomy ends up evolving through accumulated drift rather than deliberate revision. A named meta type makes taxonomy revision a first-class activity with its own discipline.

## On chats that resist typing

Three patterns sometimes feel like they need an "untyped" category but actually don't. Each has a proper disposition within the existing taxonomy.

**Chats that start unclear and become clear.** Sometimes a conversation begins before its shape is known. The right disposition is not a permanent untyped state, but an opening framing message ("I'm not sure what type this is yet — let me describe what I'm trying to figure out") followed by explicit typing once the shape becomes clear. The typing might happen in the second exchange or the fifth. The typing matters; the timing of the typing doesn't.

**Chats that touch multiple types.** Most chats are dominated by one type even if they touch others. A strategic chat that briefly references planning logistics is still a strategic chat. A planning chat that briefly touches meta reasoning is still a planning chat. Name the dominant type; secondary types are noted but do not override the dominant type's closure rule. If a chat genuinely cannot be assigned a dominant type because two types are sustained in equal measure, that is a signal to split into two chats, not to invent a hybrid category.

**Casual or unscoped conversations.** Quick questions, thinking-out-loud, conversations that do not need to produce anything specific — these are real and valuable, but they do not belong in this project-specific taxonomy. They belong in the broader cross-project Personal Reflection / Learning surface referenced at the top of this document. Casual conversations are typically cross-project by nature anyway: you are not having a casual conversation about the project's architecture; you are having a casual conversation about something that surfaced.

The taxonomy avoids an "untyped" type deliberately. An untyped category would absorb anything slightly awkward to categorize, and the typed categories would erode through gradual exemption until the taxonomy was effectively gone. The discipline is preserved by handling each legitimate "resists typing" case through the dispositions above rather than through an escape hatch.

## The discipline that holds the taxonomy together

Three rules carry most of the weight.

**Rule 1 — Decide chat type at startup.** Before writing the first message, name what kind of chat this is. "I'm starting a Strategic chat about X." "I'm starting a Planning C chat for Y scope." "I'm opening an Implementation chat to do Z." If the type can't be named, that's a signal to think more before starting.

**Rule 2 — Close when scope is done.** Do not let a chat search for new purposes. The closure rule for each type above is non-optional. The cost of starting a new chat is small; the cost of letting types blend is high.

**Rule 3 — Do not change types mid-chat.** If a strategic chat produces a conclusion that needs work, close and open a planning chat. If a planning chat finds itself wanting to think strategically about something cross-cutting, close out the current question and open a strategic chat. If a planning chat starts coordinating in-flight impl streams, recognize the genre shift and consider whether an orchestration chat is more appropriate.

## Memory pruning as ongoing discipline

The memory and instruction surfaces (per `working-method.md`) accumulate drift if not maintained. Pruning is a recurring discipline, not a one-time fix.

**Continuous pruning.** Each planning or orchestration chat ends with a brief "did anything in memory get superseded by what we did?" check. Lightweight, frequent, prevents accumulation.

**Trigger-based pruning.** When the workspace `MEMORY.md` size crosses a threshold (the system warns at 24.4KB; full audit when it reaches roughly 2x that), or when a planning chat notices that memory feels stale, trigger a deliberate pruning pass.

**Project-end pruning.** When a bounded scope of work closes, the closing pass includes a memory review. Less reactive than waiting for size thresholds.

The hybrid shape is intended: continuous lightweight checks prevent accumulation, full passes correct when drift sneaks through. The same shape applies to per-project memory and to cross-project memory surfaces, with the cross-project case tracked under the broader Personal Reflection / Learning system referenced above.

## Relationship to the working method and Xanadu doctrine

The working method (`working-method.md`) governs how unresolved decisions and content placement move between project surfaces. The Xanadu doctrine (`xanadu-doctrine.md`) governs spec growth — what passes the gate to enter or be promoted in the spec.

This document governs **conversation surfaces** — what kind of conversation is appropriate for what kind of work. The three doctrines are complementary:

- Xanadu: when something belongs in the spec
- Working method: when something belongs in memory, instructions, ADRs, or specs
- Chat type taxonomy: which conversational surface is appropriate for the work being done

A productive session typically involves all three: the right chat type for the work (this doctrine), produces the right kind of content for the right surface (working method), and only promotes spec content when warranted (Xanadu).

Each doctrine has its own extension mechanism: Xanadu is extended when a real adopter need pushes a speculative item across a gate; working method is extended when a new surface category is introduced; this taxonomy is extended through meta chats (type 7), which is the first-class surface for revising taxonomy and conventions.

## What this taxonomy explicitly avoids

- A single "general chat" category that covers everything. The cognitive cost of conflating types is what produced the "context all over the place" feeling that motivated this document.
- Rigid lifecycle prescriptions. The "short / medium / long" framings are descriptive, not normative — a strategic chat that takes ten exchanges to reach a conclusion is fine; an implementation chat that takes one is fine.
- Detailed scripts for chat openings or closings. The goal is recognition of type and disposition discipline, not bureaucratic ritual.

## Companion documents

- `civic-ai-tools/docs/architecture/working-method.md` — the project's discipline for handling unresolved decisions and content placement across surfaces
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — the project's discipline against speculative spec growth
- `civic-ai-tools/docs/architecture/open-questions.md` — the canonical registry of unresolved decisions

The cross-project chat taxonomy and the Personal Reflection / Learning surface that informs it are tracked in a personal-system surface outside this project repo. When the cross-project taxonomy stabilizes enough to be referenced canonically, this document should be updated with its location.
