# Skill routing architectural shapes

*Research, not a decision. Captures the design space for dynamic skill-guidance loading when a project wires up multiple MCP data sources.*

## Context

As of M9.2, civic-ai-tools-website composes a multi-source system prompt that concatenates skill text for every active MCP data source. With Socrata + Data Commons that's ~16K characters / ~4K tokens. Each new source (direct Census API, ArcGIS portal, state-specific portals, international sources) would add another full skill block, growing the system prompt linearly.

The post-M9.2 refactor introduced a `SKILL_REGISTRY: Record<SourceId, SkillEntry>` and a pure `composeSkillPrompt(activeSources, context)` function. That separation is a precondition for any dynamic routing approach: today the active source list is hardcoded `['socrata', 'data-commons']`, but the composition function takes any list. Dynamic routing is about choosing that list at request time.

This doc sketches the design shapes, including the ones not currently being pursued, so future revisits have a complete map.

Design issue: [civic-ai-tools-website#65](https://github.com/npstorey/civic-ai-tools-website/issues/65).

## Problem

Concatenating every source's full skill text on every request has three costs:

1. **Tokens multiply linearly** with number of sources, independent of query relevance.
2. **Attention dilution** — the LLM reads Data Commons guidance when the user asks about NYC restaurant inspections.
3. **Maintenance** — the concatenation cost grows unboundedly as more sources are added.

A better pattern: classify the query at request time, load only the relevant source's skill guidance into the system prompt, keep all tool schemas available so the LLM can still call cross-source tools if needed.

## Shapes

### Shape A — Lexical keyword router

Hand-maintained keyword → `SourceId` rules applied to the user's query.

```typescript
const RULES: Array<{ pattern: RegExp; sources: SourceId[] }> = [
  { pattern: /census|acs|demographic|median income|poverty|population/i, sources: ['data-commons'] },
  { pattern: /311|permit|inspection|crime|violation|license/i, sources: ['socrata'] },
  { pattern: /equity|disparity|by race|income.*complaint/i, sources: ['socrata', 'data-commons'] },
];

function classifyLexical(query: string): SourceId[] {
  const matched = new Set<SourceId>();
  for (const rule of RULES) {
    if (rule.pattern.test(query)) rule.sources.forEach(s => matched.add(s));
  }
  return matched.size > 0 ? Array.from(matched) : ALL_SOURCES;
}
```

**Pros:**
- Zero added latency (microseconds).
- No external dependency, fully deterministic.
- Fully auditable — users can read the rules.

**Cons:**
- Brittle to phrasing variation ("rent burden" vs "housing cost burden").
- Requires hand-maintenance as new sources and terminology land.
- Doesn't handle cross-source queries gracefully unless rules explicitly enumerate them.
- Multilingual / typo-ridden queries fall through to the fallback.

**When to use:** As a fast-path filter in combination with another shape, or when the source set is small and vocabulary is narrow.

### Shape B — Classifier LLM call (pre-flight)

A small, fast LLM call runs before the main analysis call. Its only output is a list of `SourceId` values.

```
You classify civic data questions by which sources they need. Available sources:
- socrata: city operational data (311, permits, crime, inspections, licenses)
- data-commons: federal statistical data (Census/ACS, BLS, CDC, NCES, EPA)

Output a JSON array of source IDs needed for this question:
QUESTION: "..."
```

**Pros:**
- Handles natural language variation gracefully.
- Generalizes to new sources by adding a line to the classifier prompt.
- Can reason about cross-source queries without hardcoded rules.

**Cons:**
- Adds a round trip (~200-500ms depending on model and cold start).
- Extra cost per query (small model, but non-zero).
- Failure modes: model returns invalid JSON, hallucinated source IDs, misclassifies ambiguous queries.
- Needs guardrails and a fallback to `ALL_SOURCES`.
- Another moving part in the critical path of every request.

**When to use:** When the source set is large (>3-4), query vocabulary is broad, and the latency budget can absorb the round trip.

### Shape C — Router MCP server

A dedicated upstream MCP server that sits in front of Socrata, Data Commons, and others. Exposes a `route_query` tool. Clients call it with the user's prompt and get back a set of server URLs / tool schemas / skill guidance chunks to use.

**Pros:**
- Clean separation: the website doesn't own routing logic at all.
- Routing logic becomes reusable across any MCP client (Claude Code, Cursor, Claude Desktop).
- Fits the MCP ecosystem's composition model naturally.

**Cons:**
- Operational cost: another MCP server to host, monitor, update, version.
- Cold-start latency for an infrequently-called router.
- Requires two MCP initializations per request (router → target server(s)) unless the router proxies downstream calls itself — which recreates centralization the client was trying to avoid.
- Over-engineered for the current 2-source case.

**When to use:** When there are multiple distinct MCP client consumers that would benefit from shared routing logic, and the source set is large enough to justify a service boundary.

### Shape D — Progressive disclosure via MCP prompts

Skill guidance is split into small, named prompts that each MCP server exposes via `prompts/list` and `prompts/get`. The system prompt includes only a short "menu" of available prompts; the LLM calls `prompts/get` for the ones it decides it needs during an analysis.

Example system-prompt stub:

> If the question involves Census/ACS data, call `prompts/get('data-commons-skill')` for detailed guidance.

The LLM reads the menu, decides it needs DC guidance, fetches it mid-analysis, proceeds.

**Pros:**
- No pre-flight classifier call.
- The LLM itself decides what guidance it needs, based on the question and the tools it's about to use.
- Scales elegantly: more sources just means more menu items.

**Cons:**
- Latency is paid mid-analysis, not upfront — can stall a streaming response at a bad moment.
- LLMs don't always reliably call `prompts/get` when they should; needs prompt engineering to be robust.
- Requires every source's MCP server to expose `prompts/list` — Data Commons' hosted endpoint does not today; only Socrata does.
- Tool-call-based guidance fetching counts against tool-call budgets.

**When to use:** When the MCP ecosystem matures enough that `prompts/list` is universally supported, and when streaming latency isn't the dominant UX concern.

### Shape E — Hierarchical / layered registry

A skill tree with levels: base guidance (loaded always) → domain-level guidance (loaded per matched domain) → sub-domain guidance (loaded per matched specific topic). Classification traverses the tree.

Example:
- **Base:** anti-hallucination, date interpretation, cross-source decision logic (always loaded)
- **Domain:** socrata vs data-commons (loaded per matched source)
- **Sub-domain:** NYC 311 specifics, SF workarounds, ACS 5-Year quirks (loaded per matched specific topic within a source)

**Pros:**
- Ceiling on prompt size even as more sources arrive (only matched sub-domains ship).
- Natural factoring for how skill guidance actually grows over time — each new source adds a domain branch, each new quirk adds a sub-domain leaf.
- Compatible with any of Shapes A/B for the routing mechanism itself — this is about the *shape* of the registry, not how it's queried.

**Cons:**
- Requires restructuring the current flat `SKILL_REGISTRY` into a tree.
- More complex mental model for contributors updating skill guidance.
- Risk of over-chunking — skill text becomes fragmented and loses cross-references.

**When to use:** Once the skill corpus is large enough that flat per-source loading is still too heavy (~8+ sources, ~50K+ total chars).

### Shape F — Two-axis composition (methodology × source)

Two independent registries composed by the application at request time:

- A **source registry** (civic-ai-tools' current `SKILL_REGISTRY`) — skill text per data source (Socrata, Data Commons, future sources). Answers: *where does the data live and how do I query it?*
- A **methodology registry** (new) — skill text per analytical methodology phase (problem framing, descriptive/diagnostic/equity analysis, communication, benchmarking, performance management). Answers: *how should this analysis be conducted and communicated?*

`composeSkillPrompt` accepts skill entries drawn from both registries and concatenates them. An equity analysis of NYC 311 complaints against ACS demographics would load: `socrata` + `data-commons` on the source axis, plus `analyze` + `communicate` on the methodology axis.

**Real-world reference:** [sgarcese/Civic-Analytics-Agent-Workflow-Claude-Skill](https://github.com/sgarcese/Civic-Analytics-Agent-Workflow-Claude-Skill) ships the methodology axis alone (Bloomberg problem framing → J-PAL analysis → GovLab/InnovateUS communication → cross-city benchmarking → Results for America performance management) as a Claude Skills pack. civic-ai-tools ships the source axis alone. A consumer wanting both would compose across the two. See the `landscape-analysis.md` entry for the peer-project framing.

**Pros:**
- Aligns with how civic analysts actually think: *what am I analyzing* (source axis) × *how am I analyzing it* (methodology axis).
- Methodology skills are mostly source-agnostic, so they don't multiply as sources grow — better cost curve than single-axis growth.
- Each axis scales independently: new sources don't force methodology updates, and new methodologies don't force source edits.
- Matches a real-world decomposition already visible in the civic-data-AI space.

**Cons:**
- Two registries to maintain, not one.
- Ordering and cross-references matter more when skills come from different axes.
- Requires discipline to keep methodology skills source-agnostic — no "when using Socrata, filter by date" in a problem-framing skill.
- Effectively multiplies the dynamic-routing problem: you now classify on both axes.

**When to use:** When the consumer serves users running substantively different analytical workflows (problem framing vs. descriptive analysis vs. adversarial benchmarking), AND the source set and methodology set both have more than one entry. For civic-ai-tools today the methodology dimension doesn't exist yet — introducing one is a standalone product decision, not a composition refactor. Post-M8 at the earliest.

## Composition

These are composable, not exclusive:

- **A alone** — cheapest, weakest. Good as a fast-path filter before falling back to B or C.
- **A → B** — lexical match first, classifier LLM only on ambiguous queries.
- **B alone** — safest for broad query vocabularies.
- **C on top of B** — once the MCP ecosystem matures and multiple clients want shared routing.
- **D alone** — only works if all servers expose `prompts/list` uniformly.
- **E** — orthogonal to A/B/C; it's about the within-axis shape of a registry, not the routing mechanism.
- **F** — orthogonal to A/B/C and to E: it's about whether there's one axis or two. Can run lexical or classifier routing on each axis independently, and each axis can be hierarchical (E) within itself.

## Tentative recommendation

**Shape A → B** (lexical fast-path + classifier LLM fallback), in three stages:

1. **Now:** Ship the M9.2 refactor — flat `SKILL_REGISTRY` + `composeSkillPrompt` pure function. No dynamic routing. All sources load on every request. (Complete.)
2. **Post-M8:** When the registry grows to 4+ sources OR token cost becomes measurable pain, implement Shape A as a lexical fast-path filter. Preserve "load all sources" as the fallback when no rule matches.
3. **When A proves insufficient:** Add Shape B behind A as the fallback for ambiguous queries. The lexical filter catches the common case; the classifier handles the long tail.

Defer C, D, E, F indefinitely unless a concrete need emerges that can't be met by A + B.

- **Shape C** becomes interesting only if civic-ai-tools becomes part of a broader MCP ecosystem where multiple clients benefit from shared routing.
- **Shape D** is blocked on universal MCP `prompts/list` support across MCP servers in the ecosystem.
- **Shape E** is blocked on having enough sources to justify the tree structure.
- **Shape F** is blocked on civic-ai-tools not having a methodology axis yet. Introducing one is a standalone product decision (do we ship problem-framing / analytical / communication skills at all?) rather than a composition refactor. Worth revisiting after M8 when the core data-source axis is validated on a real demo and the evidence spin-out thinking in `evidence-spin-out-strategy.md` starts to commit to specific downstream consumers. Spiritually related to `sgarcese/Civic-Analytics-Agent-Workflow-Claude-Skill` in the landscape.

## Cross-references

- Design issue: [civic-ai-tools-website#65](https://github.com/npstorey/civic-ai-tools-website/issues/65)
- Current composition contract: `civic-ai-tools-website/src/lib/mcp/socrata-skill.ts` (post-M9.2 refactor)
- Spin-out strategy: `evidence-spin-out-strategy.md` — dynamic skill routing is a multi-domain protocol requirement, since any evidence system serving multiple data domains hits the same prompt-size scaling problem
- Data Commons skill: `civic-ai-tools/docs/skills/data-commons.md`
- Socrata skill: `civic-ai-tools/docs/skills/base.md`, `web.md`, `local.md`
