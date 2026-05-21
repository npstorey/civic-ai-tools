# Civic Analytics Agent Workflow vs. Civic AI Tools — skills comparison

*Research, not a decision. In-depth comparison of an external Claude Skill set (sgarcese/Civic-Analytics-Agent-Workflow-Claude-Skill) against the project's own skill guidance, identifying opportunities for adoption. Adoption decisions tracked at `civic-ai-tools-website/docs/proposed-issues/011-skill-guidance-methodology-uplift.md`.*

## TL;DR

These projects solve **different problems** with overlapping surface area. sgarcese's skill is a **methodology orchestrator** — five phases of civic policy analysis, anchored in named academic traditions (Bloomberg, J-PAL, GovLab, Results for America). The project's skill guidance is a **tool-mechanics companion** — how to query Socrata, CKAN, and Data Commons safely without hallucinating. They are **complementary**, not competing. The high-leverage opportunity is to layer a methodology surface on top of the tool-mechanics surface — not to rewrite what already exists, which is sharper at the tool-call layer than sgarcese's docs are.

## Sources compared

- **External skill set:** `https://github.com/sgarcese/Civic-Analytics-Agent-Workflow-Claude-Skill` (MIT-licensed, created 2026-03-24, last pushed 2026-04-02). Twelve files totaling ~145KB. Project page at `https://sgarcese.github.io/Civic-Analytics-Agent-Workflow-Claude-Skill/`.
- **Project skill guidance:** `civic-ai-tools/docs/skills/{base,web,local,boston,data-commons,README}.md`. Six files totaling ~32KB. Composed at MCP request time via base + modality overlay.

Both were read in full prior to comparison.

## What each project is

### sgarcese's *Civic Analytics Agent Workflow* (Boston-centric)

A 12-file Claude Skill set built around a five-phase workflow:

1. **FRAME** (Bloomberg Centers methodology — JHU & HKS) — problem scoping, stakeholder mapping, assumption interrogation, equity dimensions, problem statement.
2. **ANALYZE** (J-PAL — MIT) — descriptive → diagnostic → equity → counterfactual → synthesis, with explicit claim-strength labeling.
3. **COMMUNICATE** (GovLab — NYU & Northeastern, plus InnovateUS) — audience-specific outputs (memo, brief, fact sheet, dashboard, deck), inclusive design, asset-based framing.
4. **BENCHMARK** — cross-city comparison against SF, Seattle, DC, with comparability assessment and J-PAL claim-strength rules.
5. **PERFORM** (Results for America / PerformanceStat / CitiStat tradition) — budget × staffing × outcomes; cost-per-outcome, workload-per-FTE, overtime stress signals.

A `SKILL.md` master orchestrator routes user requests to the right phase. Supporting docs: `CHECKLISTS.md`, `TEMPLATES.md` (6 output formats), `PROMPTS.md` (25+ examples by complexity), `REFERENCE.md` (dataset + field directory), `EXAMPLE-311-equity.md` (full worked walkthrough). Boston Open Data MCP is primary; SF/Seattle (Socrata), DC (ArcGIS) are benchmarking peers. Has a separately-hosted **29-prompt eval suite** with weighted scoring across structural / facts / multi-step / cross-dataset levels (described on the methodology page; not in this repo).

### Project skill guidance

Six files in `civic-ai-tools/docs/skills/`:

- `base.md` — universal Socrata guidance: anti-hallucination, query complexity tiers (GREEN/YELLOW/RED), mandatory column discovery, SoQL patterns, date arithmetic gotchas (the `date_diff_d` rule), retry discipline, zero-result verification, well-tested portal table, date-range guidelines, dataset directory by portal, error handling, output structure.
- `web.md` overlay — HTTP demo limits, token-conscious formatting, no cross-portal comparisons, local-tools CTA.
- `local.md` overlay — full capabilities, cross-portal encouraged, extended analysis OK.
- `boston.md` peer skill — CKAN-vs-Socrata cheat sheet for Boston OpenContext (CKAN-native), Boston-specific geographies (neighborhoods ≠ Census tracts, BPD districts, parcel IDs).
- `data-commons.md` peer skill — DCID patterns, the silent-wrong-answer risk, cross-source decision logic for joining demographics with operational data.
- `README.md` — explains the base + overlay composition pattern.

The MCP server composes guidance per request based on transport (HTTP→web overlay, stdio→local overlay).

### The orientation difference

| Axis | sgarcese | civic-ai-tools |
|------|----------|----------------|
| Primary concern | What questions to ask, in what order, with what rigor | How to make tool calls correctly without lying |
| Methodology framing | Five named academic traditions | Anti-hallucination rules + caveats, no formal framing |
| Workflow scaffold | Frame → Analyze → Communicate → Benchmark → Perform | Plan → narrate → query → present (implicit) |
| Tool detail | Generic `search → get_schema → query` patterns | SoQL syntax gotchas, retry discipline, complexity tiers, portal-specific workarounds |
| Geographic scope | Boston primary, SF/Seattle/DC as benchmark peers | Multi-city Socrata + Boston CKAN + Data Commons (federal/international) |
| Audience | City policy analysts | Civic technologists, government workers, journalists, students |
| Output formats | 6 audience-specific templates | One standard markdown structure |
| Equity | Threaded through every phase | Mentioned in caveats |
| Pre-flight / review | 8 phase-specific checklists + 4 cross-phase tests | Imperative bullets in prose |
| Worked example | Full 4-phase end-to-end walkthrough | None |
| Cross-city benchmarking | 22KB dedicated phase with comparability template | Encouraged but unstructured |
| Doc size | ~145KB across 12 files | ~32KB across 6 files |
| Composition | Master orchestrator + sub-skills (loaded on demand) | Base + modality overlay (composed at MCP request time) |

## What sgarcese does well that civic-ai-tools lacks — opportunities

Ordered roughly by leverage. The first four are the most worth doing.

### 1. Claim-strength labeling taxonomy (highest leverage)

sgarcese's `Analytical_Skill.md` codifies a J-PAL-derived 5-level taxonomy:

| Level | Language convention | Evidence required |
|-------|---------------------|-------------------|
| Strong causal | "X caused Y" | Randomized evaluation |
| Suggestive causal | "Evidence suggests X contributed to Y" | Before/after + comparison group + alternatives ruled out |
| Correlational | "X is associated with Y" | Systematic co-occurrence |
| Descriptive | "The data shows X" | Observed patterns |
| Hypothetical | "One possible explanation is..." | Logical reasoning consistent with data |

Every finding gets one label. The language pattern is immediately legible.

**Why this fits this project specifically.** There's an active spec draft for the **Civic Claim Vocabulary** (`civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md`, pre-v0.1). A typed-claim layer is the whole point of CCV. Adopting J-PAL's claim-strength scale into the skill guidance is the runtime side of what CCV is trying to spec — and it would feed back into CCV refinement organically rather than being designed in the abstract. It also strengthens the evidence-system value proposition: a signed package with claim-strength-labeled findings is a more useful artifact than one without.

**How to incorporate.** Add a "Claim Strength" subsection to `base.md` and `data-commons.md` with the 5-level table and language conventions. Wire it into the existing "Uncertainty & Limitations Disclosure" section. Probably the cheapest single edit on this list with the largest output-quality impact.

### 2. The Frame → Analyze → Communicate scaffold

The project's docs are strong at the `query → present` middle. They're **silent on what comes before and after**:

- *Before query:* Is this even the right question? Whose problem is this? What would the user accept as evidence? sgarcese has a full pre-query Bloomberg-style framing phase.
- *After result:* Who is this for? What format do they need? sgarcese has a full audience → format → tone routing layer.

For a public demo at civicaitools.org and a CLI used by journalists / students, the framing-and-output bookends are where naive users go off the rails. A casual user pastes "is the city racist about potholes" and the current docs send them straight into a SoQL query — instead of catching that the question is undefined and bringing them through it.

**How to incorporate.** Add a *short* methodology overlay — `methodology.md` or fold into `base.md`'s top section — sketching three lightweight phases:

- **Frame** (one-screen): scope check, who-is-asking, which datasets *might* answer this, list known limitations.
- **Analyze** (already covered, but link to claim-strength labels).
- **Communicate** (one-screen): match output format to audience.

Keep it shorter than sgarcese's 8KB-per-phase. The patterns don't require citing Bloomberg/J-PAL by name — see Risks below.

### 3. Audience → format → tone matrix

```
Mayor / Chief of Staff      → 1-page memo, BLUF, decisive
Department Head             → 2-3 page memo, operational, specific
City Council                → policy brief + talking points, balanced
Community organizations     → fact sheet, asset-based, plain language
General public              → dashboard, infographic, 8th-grade reading
Media                       → press-ready summary, factual, quotable
Research partners           → technical appendix, reproducible
```

The current single output structure (Key Metrics → Executive Summary → Detailed Analysis → Methodology) is fine for a "default" but actively misleading for journalists or community organizers, who need very different things. The stated audience explicitly includes journalists and government workers — meeting them where they are matters.

**How to incorporate.** Add an audience-routing block to `base.md` or create `templates.md`. Even three or four templates (executive memo, journalist-facing summary, community fact sheet, technical brief) would be a substantial upgrade. The community fact sheet template in particular is well-designed — plain-language headline, simple visuals, explicit feedback mechanism, multilingual prompt — and translates directly to the civicaitools.org demo audience.

### 4. Pre-flight + review checklists

sgarcese has 8 phase-specific checklists (one pre-flight, one pre-delivery, per phase) plus a cross-phase "final review" with four explicit tests:

- **Rigor Test:** Could a skeptical analyst challenge this? Have you addressed it?
- **Human Test:** Would a resident recognize their experience in this?
- **Democracy Test:** Does it create meaningful participation opportunity?
- **Equity Test:** Who benefits and who is overlooked?

The current docs use imperative bullets ("ALWAYS / NEVER") inline. Checklists are demonstrably better at catching failures because the model self-audits against a discrete list rather than recalling prose.

**How to incorporate.** Add a `checklists.md` (or fold into `base.md`) with two short lists: pre-query checklist (do I have the dataset, schema, time period, denominator?) and pre-deliver checklist (am I citing? labeling claims? noting limitations? equity discussed?). 30-50 lines, max.

### 5. Equity as first-class concern

sgarcese embeds equity in every phase: equity mapping in framing, mandatory equity analysis in J-PAL Level 3, asset vs. deficit framing in communication, equity-gap measurement in benchmarking. Specific table:

| Deficit framing | Asset-based framing |
|-----------------|---------------------|
| "Residents fail to report issues" | "Residents face barriers to accessing 311" |
| "High-crime neighborhoods" | "Neighborhoods with historically under-resourced public safety" |
| "Low-performing schools" | "Schools with unmet resource needs" |

The current docs mention bias and reporting limitations in caveats but don't have an explicit equity discipline. For a project whose central use case is *"AI for civic data analysis,"* this is meaningful guidance to add — it shapes the language of every output, not just whether the analyst remembered to check.

**How to incorporate.** Add a short "Equity discipline" section to `base.md`: (a) the asset/deficit framing table; (b) "always disaggregate by geography when comparing"; (c) explicit ecological-fallacy caveat when using neighborhood as a demographic proxy; (d) reporting-bias prompt ("who is in this data, who might be missing"). 50-75 lines.

### 6. Anti-pattern tables with fixes

sgarcese closes nearly every phase with an anti-pattern table. Examples:

| Anti-pattern | Problem | Fix |
|--------------|---------|-----|
| Cherry-picking | Picking comparisons that flatter the conclusion | Define metrics before looking at results |
| Denominator neglect | Comparing raw counts across unequal-population areas | Always per-capita when comparing |
| Causal overclaiming | "X policy caused Y outcome" | Label claim level explicitly |
| Definition mismatch | Comparing same-named metrics across cities | Document what each city actually measures |

The current docs cover the same content in prose ("never invent data points," "use per-capita rates"), but the table format is sharper, more memorable, and easier for the model to recall. Low-effort, high-clarity transformation.

**How to incorporate.** Convert existing prose warnings into anti-pattern tables. Likely a half-day editorial pass on `base.md`.

### 7. Worked end-to-end example

`EXAMPLE-311-equity.md` walks through one analysis from a councilor's question to three audience-specific outputs, showing every tool call, every claim-strength label, every equity caveat, every cross-city comparison. It's the single most pedagogically valuable doc in the repo.

The project has query patterns and a worked Manhattan-income example in `data-commons.md`. It doesn't have an end-to-end example showing problem framing → query → cross-source synthesis → audience-tailored output → evidence-package publication. Given the evidence system already built and the publish-evidence skill that already exists, this would be **uniquely powerful**: the project can show something sgarcese can't, which is the analysis terminating in a signed, Rekor-logged package. That's a story arc no other civic-AI project has.

**How to incorporate.** Write one worked example in `civic-ai-tools/docs/skills/examples/` (or `civic-ai-tools/docs/research/`). 311 equity is sgarcese's example — pick a different domain (housing, transit, public health) so the docs aren't accidentally derivative. Show the full chain ending in evidence publication.

### 8. Performance management module pattern

The Phase 5 "PERFORM" skill connects three data sources — operating budget, payroll/earnings, operational outcomes — to compute cost-per-outcome, workload-per-FTE, overtime rates. The cross-source pattern is the interesting part, not the Boston specifics:

```
budget_data + payroll_data + outcomes_data → efficiency_ratios
```

This is exactly the kind of analysis civic technologists, journalists, and budget watchdogs do. The current stack supports it (NYC, Chicago, SF have payroll datasets in `base.md`'s key-datasets table; there's a Citywide Payroll dataset listed). The project just doesn't have skill guidance for *how* to connect them.

**How to incorporate.** This is the largest of these proposals, probably skill work for after the others are in place. Could become an overlay (`performance.md`) loaded when the user asks about cost/efficiency/staffing. Per the Xanadu doctrine, would only justify writing once an adopter actually asks for this kind of analysis.

### 9. Decision router at the top of the master skill

`SKILL.md` opens with a decision tree mapping user request patterns to which phase to load:

```
"What data does Boston have on..."  → Frame
"Run the numbers / equity issue"    → Analyze
"Write a memo / create a brief"     → Communicate
"How does Boston compare"           → Benchmark
"Cost per outcome / FTE"            → Perform
"Full analysis"                     → All phases in sequence
```

The current `README.md` is descriptive ("here's what each file is for") but not prescriptive ("here's when to use which"). For a model self-orienting at the start of a conversation, prescriptive routing is more useful.

**How to incorporate.** Add a 10-line decision router at the top of `base.md` (or create a tiny `INDEX.md` if you'd rather not bloat base). Links the user/model to the right peer skill or overlay.

### 10. Templates for output formats (paired with #3)

Six fill-in-the-blank templates in `TEMPLATES.md`: executive memo, policy brief, one-page summary, community fact sheet, cross-city benchmark, presentation deck. Each is structurally complete and tone-calibrated.

The cross-city benchmark template is particularly relevant to the project — the `local.md` overlay encourages cross-portal comparison but provides no template for *how to present it*. Adopting sgarcese's benchmark template (with comparability rating, normalization columns, structural-difference notes) would close that gap.

**How to incorporate.** Borrow the structure of two or three templates (executive memo, fact sheet, cross-city benchmark) and adapt to the project's portals. Don't import all six.

## What civic-ai-tools does better — and shouldn't lose

Worth noting so the project doesn't accidentally regress while incorporating the above:

- **Tool-mechanics depth.** `base.md` has things sgarcese doesn't: SoQL date-arithmetic gotchas (the `date_diff_d` rule + the "one strike and switch" retry discipline + the client-side fallback), zero-result verification protocol, query complexity tiers, pagination guidance, portal-specific workarounds (LA-only `get_data`, SF search-returns-NYC bug). sgarcese's docs assume MCP tools "just work." When they don't, his docs go silent. The project's don't.
- **Multi-portal generality.** sgarcese's framework is Boston-shaped: Boston as primary, three peers as benchmarks. The project's docs handle 500+ Socrata portals, Boston CKAN, and Data Commons (federal/international). The base + overlay composition pattern is *the right architecture* for that breadth — don't unify it into a single Boston-shaped orchestrator.
- **Modality awareness.** `web.md` vs. `local.md` is the right design for a skill server with both an HTTP demo (resource-constrained, public) and a stdio CLI (full power). sgarcese has no equivalent.
- **Cross-source decision logic.** `data-commons.md`'s explicit logic for when to use Data Commons vs. Socrata, plus tract-level join discipline for joining demographics with operational data, is more rigorous than sgarcese's benchmarking-only cross-source pattern.
- **Silent-wrong-answer warnings.** The Data Commons "no exception, no warning" framing is sharper than anything in sgarcese's docs about analytical pitfalls.

## Risks and caveats when adopting

### Methodology-lineage authenticity

sgarcese cites Bloomberg, J-PAL, GovLab, and Results for America by name with strong fidelity claims. There is real value in named methodology — it's a vocabulary shortcut and a credibility signal — but it carries a corresponding obligation. Adopting the *patterns* (claim-strength labels, phase separation, equity discipline) without studying the source materials, while claiming the named lineage, would be appropriative. Two paths:

1. **Adopt the patterns, don't claim the lineage.** Frame as "evidence-based analysis discipline" generically; cite the specific sources actually drawn from. Lower friction, but loses some of the brand-power benefit.
2. **Genuinely engage with the source materials.** Read J-PAL's evidence-to-policy primers, the Bloomberg Centers' problem-framing materials. Cite them properly. More work, but defensible. Possibly worth it because civic technologists and journalists in the stated audience will recognize and trust those names.

Either is fine. The wrong move is to copy sgarcese's citations without doing either.

### Boston-centric vs. multi-portal

sgarcese's structure assumes a single primary city. The project's docs explicitly support 500+ Socrata portals plus Boston plus Data Commons. **Do not import sgarcese's Boston-as-primary scaffolding directly.** When adopting the Frame phase, write it portal-agnostically ("identify which dataset(s) might answer this") rather than Boston-specifically. When adopting the Benchmark phase, generalize to "any-N-portal comparison" rather than Boston-vs-three-peers.

### Compact-by-design vs. doc proliferation

sgarcese's repo is ~145KB across 12 files. The project's is ~32KB across 6 files, with deliberate compactness via base+overlay composition. **Don't bulk-copy.** The right move is to add 1-3 short, high-leverage docs (claim-strength + checklists + one worked example) rather than mirror sgarcese's structure file-for-file. If `base.md` grows past ~25KB, it's probably been done wrong — split into a peer skill.

### Working method / Xanadu doctrine

Per `working-method.md` and `xanadu-doctrine.md`, decisions enter via the open-questions registry (the front door) and only get promoted to spec/instruction surfaces when an adopter materializes. The right way to act on this report:

1. **Light edits** to existing skills (claim-strength labels, anti-pattern tables, equity discipline section, audience-routing block) — these are clear-win refinements that don't need an open-question entry.
2. **New surfaces** (worked example, methodology layer, performance module, output templates) — track as a proposed-issue first; promote to actual skill files once a real session needs them. This avoids speculative spec growth.

### Eval suite gap

sgarcese has a 29-prompt evaluation suite with weighted scoring formula (0.15 × Structure + 0.35 × Facts + 0.30 × MultiStep + 0.20 × CrossDataset). The project has `guidance-quality` issues filed when AI errors are observed, but no automated grading. This isn't a skills-doc opportunity per se, but it's a notable structural difference worth flagging for the roadmap. The dev workflow guidance in workspace CLAUDE.md frames `guidance-quality` issues as "the evaluation corpus for future research collaborators" — sgarcese has already operationalized that into running scores. Worth eventually doing.

## Suggested next steps in priority order

1. **Add a Claim-Strength Labels section** to `base.md` and `data-commons.md`. ~30 lines each. Wire it into existing Uncertainty & Limitations sections. *(Leverages CCV spec work directly.)*
2. **Convert prose warnings into anti-pattern tables** in `base.md`. Half-day editorial pass.
3. **Add a pre-flight + pre-deliver checklist block** to `base.md` (or new `checklists.md`). 50 lines.
4. **Add an Equity discipline section** (asset/deficit framing table + reporting-bias prompts + ecological-fallacy caveat) to `base.md`. 50-75 lines.
5. **Add a decision router** to the top of `base.md` or `README.md`. 10 lines.
6. **Add an audience → format → tone block** to `base.md` plus 2-3 output templates (executive summary, journalist summary, community fact sheet) in a new `templates.md`. Multi-day work.
7. **Write one end-to-end worked example** terminating in evidence-package publication. Domain other than 311 (housing or transit recommended). New `examples/` dir under `docs/skills/`. Multi-day work.
8. **(Deferred per Xanadu)** Methodology layer (`methodology.md`) and Performance module — only when a session actually needs them.

Items 1-4 are the highest-leverage, lowest-risk edits. Items 5-7 are bigger but well-scoped. Item 8 should sit in the open-questions registry until an adopter shows up.

## Tracking

Adoption decisions are tracked in `civic-ai-tools-website/docs/proposed-issues/011-skill-guidance-methodology-uplift.md`, which scopes the work into tiers and references this artifact as its origin. Promoted to [civic-ai-tools#78](https://github.com/npstorey/civic-ai-tools/issues/78) on 2026-05-21.
