# Changelog — @typedstandards/civic-typed-harness

Factual record of what changed per published version. Section references are
to the Typed Standards specification unless noted otherwise.

## Unreleased

- **Dependency floor raised:** `@typedstandards/produce-core` `^0.3.0 ||
  ^0.4.0` → `^0.6.0`, and the `@typedstandards/verify-core` devDependency
  `^0.9.0` → `^0.11.0`, the version produce-core 0.6.0 resolves. The two move
  together so the install holds one copy of verify-core: with only the
  devDependency moved, produce-core 0.3.0 kept verify-core 0.9.0 and the
  harness tests imported a second copy, 0.11.0. verify-core 0.11.0 is the
  first release that exports `KNOWN_TYPE_URIS`, which the hub's
  `check:verifier-subtype-set` compares with the specification's §8.12.1
  table ([civic-ai-tools#232](https://github.com/npstorey/civic-ai-tools/issues/232)).
  No harness source changes. The lockfile resolves produce-core 0.6.0 and
  verify-core 0.11.0, and the golden byte-compat suite passes unchanged.
  A consumer that pins produce-core 0.3.x or 0.4.x no longer shares its copy
  with this package.

## 0.5.0 — 2026-09-18

The list is derived from
`git log 33a3aff..<this release> -- packages/civic-typed-harness/` — `33a3aff`
is the 0.4.1 release bump — so it is the commit range rather than a
recollection.
Three commits landed after that bump and had no entry; this phase's two
changes join them.

**Together, the two changes below make a record name the servers the run
actually had, and say nothing where it does not know.** They are the harness
half of
[civic-ai-tools#205](https://github.com/npstorey/civic-ai-tools/issues/205)
and
[civic-ai-tools-website#449](https://github.com/npstorey/civic-ai-tools-website/issues/449);
the caller half (a registry built from the instance's own configuration, and
the packager passing the list) lands in the reference application.

### The environment extension can name every server, not only the skill's

- **`buildDatHereEnvironment` accepts a list of MCP servers**, additively. Its
  second parameter is now `string | readonly DatHereMcpServer[] | undefined`:
  the bare string is the pre-0.5.0 shape — the trace's skill-fetch URL, the one
  server the builder could name — and a list is emitted in the order the caller
  gives, each entry carrying `name` only when the caller supplied one. Spec
  §8.7.1 requirement 3 always specified `mcpServers` as "an array of objects
  with `url` and optional `name`"; until now the harness could only ever put
  one object in it.
- **The single-URL shape is byte-identical to before**, and a test pins those
  exact bytes rather than deep-equality, because an already-signed datHere
  package reproduces through this function. A one-entry list with no `name`
  produces the same bytes as the string, which is the same statement from the
  other side.
- **`DatHerePolicyInput` gains `mcpServers`**, consulted in preference to
  `skillMcpServerUrl` and falling back to it, so `deriveDatHereEnvelopeFields`
  carries the list through without any existing caller changing.
- **New export:** the `DatHereMcpServer` interface. An entry whose `url` is
  empty contributes nothing — the same rule the single-URL shape always
  applied: a server with no address is stated by absence, never by an empty
  string.

### A source agent names the configured address, or names no address at all

- **`CivicSourceInfo.serverUrl` is optional.** The address a run reached is the
  operator's configuration, not a fact the harness knows. A caller passes a
  registry whose entries carry the addresses that instance is pointed at.
- **`buildProvenanceGraph` omits `civic:serverUrl` when it has no address.**
  Two shapes reach that: a registry entry that carries no `serverUrl`, and a
  source id the registry does not carry at all. Both now emit an agent with no
  `civic:serverUrl` key — the key's absence, not an empty string — so the
  signed bytes say the address is unknown instead of naming a server the
  analysis may never have contacted. When an address IS known the key keeps its
  position in the emitted key order, which is the byte contract on the legacy
  chain.
- **The source-id fallback is dropped.** An agent for a source outside the
  registry used to carry `civic:serverUrl` equal to its own source id — a
  string that was never an address. That is the asserted-default class
  ([civic-ai-tools#129](https://github.com/npstorey/civic-ai-tools/issues/129)'s
  family): a stand-in standing in a signed record for a fact the run had and
  did not write.
- **`CIVIC_SOURCE_REGISTRY` keeps its three `serverUrl` values**, and the
  comment now says what they are for: the reference deployment's own default
  addresses for display, and — on the two aggregate sources — the companions of
  `aggregatePortalUrl`. They are not what a record asserts about a run.
- **Type-level consequence, stated rather than glossed.** Widening
  `serverUrl` to optional is additive for a caller that BUILDS a registry and
  narrowing for one that READS `info.serverUrl` and expects a `string`. A
  TypeScript consumer doing the latter has to handle `undefined`.

**Golden bytes.** Two of the three fixtures are untouched;
`__fixtures__/website-golden.json` and `__fixtures__/reference-golden.json` are
frozen reference captures and no byte of either is edited. The 2026-08-01
website capture carries one MCP agent for a source its registry does not know,
and that agent's `civic:serverUrl` is the dropped fallback, so the suites lift
the capture over exactly that one key — derived from the registry, with the
number of lifted nodes asserted, the same device already used for the two
Appendix J literals and for the synthetic prompt hash. The lifted graph is
inside the hashed bytes of the ninth golden-reproduction case, so
`__fixtures__/span-carrying-golden.json`'s two recorded hashes are regenerated,
intentionally and by that one dropped key: `envelopeHash` `eaa41755…b9b87d` →
`2a57c911…c0af89`, `contentHashSha256` `cd036569…0e0202` → `e14adecf…a6af5f`.
The fixture records the reason beside them. **A package signed before this
change whose graph carried the source-id fallback no longer reproduces at the
defaults** — that is the intended consequence of dropping an asserted default,
and it is named here so nobody reads a moved hash as an accident.

### Already on `main` since 0.4.1, and unreleased

- **The test files type-check**
  ([civic-ai-tools#197](https://github.com/npstorey/civic-ai-tools/issues/197),
  `0a861b1`). `tsconfig.test.json` extends the build config, emits nothing, and
  adds the Node types the suite needs; the package's `typecheck` script runs
  both configs, and `src/the-suite-type-checks.test.ts` guards that every test
  file is inside the checking config and none is inside the emitting one. The
  build config now sets `types: []`, so shipped source still cannot reach a
  Node global and type-check. No runtime export changes.
- **The `civic:` vocabulary is named, and a rejected call states its elapsed**
  ([civic-ai-tools#199](https://github.com/npstorey/civic-ai-tools/issues/199)
  §2, `e4e32e7`). **Fourteen new `CIVIC_TERM_*` exports** —
  `CIVIC_TERM_CONTENT_HASH`, `CIVIC_TERM_SERVER_URL`, `CIVIC_TERM_SOURCE_ID`,
  `CIVIC_TERM_URL`, `CIVIC_TERM_PROMPT_TOKENS`, `CIVIC_TERM_COMPLETION_TOKENS`,
  `CIVIC_TERM_TOOL_NAME`, `CIVIC_TERM_OPERATION_TYPE`, `CIVIC_TERM_DATASET_ID`,
  `CIVIC_TERM_PORTAL_DOMAIN`, `CIVIC_TERM_DATASET_URL`,
  `CIVIC_TERM_CROISSANT_METADATA_URL`, `CIVIC_TERM_RESPONSE_ROWS`,
  `CIVIC_TERM_DURATION_MS` — replacing inline literals at twenty sites in
  `capture/provenance.ts`, with no byte moving (a computed key inserts in the
  same position with the same value). `purity.test.ts`'s guard derives its
  universe rather than listing literals. The same commit corrected two comments
  that said a rejected span carries no `tool.duration_ms`: the reference
  producer records it, so a rejected call's activity emits `civic:durationMs`
  beside `civic:failed`, the duration in its 0.3.1 position and the two markers
  appended after it.
- **A golden case that carries `mcp_tool_call` spans**
  ([civic-ai-tools#199](https://github.com/npstorey/civic-ai-tools/issues/199)
  §1, `92efbae`). `__fixtures__/span-carrying-golden.json` — a ninth
  golden-reproduction case, in its own file so the verbatim upstream copy stays
  a copy. The other eight carry zero spans of any kind, so until it existed the
  byte-compat suite was green for everything the tool-span loop does. Test-only;
  no export changes.

**Correction to the 0.4.0 entry.** That entry's type-level-gate bullet says
"`tsconfig.json` excludes `src/**/*.test.ts`, so the suite type-checks nothing
— a test can drive a field the type does not have and `npm run typecheck` stays
green." **That has been false since `0a861b1`.** The suite is type-checked by
`tsconfig.test.json`, `npm run typecheck` runs it, and a type error in a test
file fails that gate. The sentence is true of 0.4.0 as published and is left in
place as the record of it; this is the forward correction.

## 0.4.1 — 2026-09-12

Patch: one existing export changes its output for one input shape, and no
export is added, removed or retyped. That is measured across the release
boundary rather than asserted — the published `0.4.0` and this build each
expose 49 runtime exports from the package root, none added, none removed,
none changing runtime type, and no declared top-level name in `dist/*.d.ts`
differing between them. The tarball carries the same 28 files, and 22 of the
24 under `dist/` are byte-identical to `0.4.0`; the two that are not are
`dist/rubric/adversarial-eval-core.js` and its `.d.ts`, the latter differing
by a doc comment alone.

**What this release claims about golden bytes, and what it does not.** Every
golden byte is unchanged. This time that sentence is not the evidence, and
saying so is the point: **no golden fixture reaches the export that changed.**
`buildEvaluationPrompt` is named in two test files, both under `src/rubric/`,
and in neither golden suite. `__fixtures__/website-golden.json` carries no
`queries` array at all; `__fixtures__/reference-golden.json` carries eight and
**zero** occurrences of the `failed` key that is this release's only new
branch. So the golden suites are green for this change the way they are green
for a change to a file they never import, and their green is not evidence
about it. This is the same narrowing
[civic-ai-tools#199](https://github.com/npstorey/civic-ai-tools/issues/199)
records for the graph builder, met from the other side.

What **is** evidence is a direct measurement of the changed export either side
of the release boundary: `buildEvaluationPrompt` imported from the published
`0.4.0` and from this build, run over the same package.

- A package in which **no entry records `failed: true`** renders
  **byte-identical** on both — 492 bytes, `sha256 ed77c84e…` — over five entry
  shapes: `resultRows: 12`, `resultRows: 0`, no `resultRows` at all,
  `failed: false`, and a bare `failureKind` carrying no `failed`.
- The same package plus one entry recorded `failed: true` renders
  **differently** (539 bytes against 607). That case is the reason the first
  one is worth reporting: an instrument that answers "identical" whatever it is
  fed has not measured anything, and this one is shown answering "different"
  on the shape it must flag.

**The evaluator reads a rejected call as rejected**
([civic-ai-tools#203](https://github.com/npstorey/civic-ai-tools/issues/203),
Wave N11 P-H1). Behaviour change, confined to one input shape.

- **The line that changes.** A `queries[]` entry the producer recorded as
  rejected rendered `→ ? rows` — the same line an entry whose row count was
  simply never recorded produces. A rejection and an unrecorded count were one
  line to the evaluator, and the rubric asks that evaluator to cross-check the
  answer's figures against the data the tool calls returned, so the conflation
  invited it to read data that was never returned as merely uncounted. Its
  score becomes a signed attestation. The entry now reads `→ REJECTED by the
  source — no data was returned, and no row count is claimed`.
- **`failed: true` is the whole assertion.** `failureKind` is declared on the
  shape and **deliberately not rendered**: it is producer-controlled text, and
  the turn built here is read by a model whose score is signed, so the
  rejection is stated in this module's own fixed words, interpolating nothing
  the producer wrote and claiming no row count.
- **Absence stays absence.** An entry that records no outcome renders exactly
  as it did before the fields existed. `failed: false` is not a rejection, and
  a `failureKind` with no `failed` is not a rejection — the posture
  `ToolCallSummary.failed` already takes in `capture/data-sources.ts`.
- **No dependency moves.** The two keys are read off a locally-declared shape
  rather than imported, following that same file: produce-core `0.3.0`, which
  the lockfile resolves, names neither key. No manifest change, no lockfile
  bump, no new dependency.

**`RUBRIC_VERSION_SHA256` does not move, and the claim around it is corrected
rather than left standing**
([civic-ai-tools#207](https://github.com/npstorey/civic-ai-tools/issues/207)).
The hash is `sha256Hex(EVALUATION_RUBRIC)` — the rubric text alone. It does not
cover `buildEvaluationPrompt`, the template that assembles that rubric with the
package's tool calls, data sources and model into the turn the evaluator
actually reads. So this release changes what an evaluator is shown without
changing the value an attestation pins as `methodology.promptSetVersion`: two
evaluations either side of it carry the same value, measured here as
`b62b193c992fd430cc82dff9a80a057bbe0b2b656fbdace450ca1a5d99fffa02` on both the
published `0.4.0` and this build.

- **The overclaim is retired in the same change.** ADR-0015 §3, Q26's
  resolution note and the two module comments said the value pinned the whole
  prompt set that produced the scores. They now say it pins the rubric
  *wording*, and that the prompt template is outside the hash. The phrase they
  used for the wider claim appears nowhere in the tree at this release.
- **The gap is filed, not resolved.** #207 records what the hash covers, what
  it does not, and the two spec-level options — widen the hash, or add a second
  field — with no recommendation. Which one is right is a specification
  decision, not a package's.

A consumer sees none of this until its own lockfile moves: `^0.4.0` admits
`0.4.1`, so the manifest range need not change and the refresh is the whole of
the upgrade.

## 0.4.0 — 2026-09-04

Minor: two optional input fields are added and no existing export is removed
or retyped. `fallbackPortal` and `ProvenanceInput.portal`, inert since 0.3.1,
are widened and deprecated rather than dropped — removing either is breaking
and waits for a major.

**What this release claims about golden bytes, and what it does not.** Every
golden byte is unchanged — both vocabulary eras, all eight
golden-reproduction cases, and `__fixtures__/website-golden.json`. That
sentence has appeared in every release note since 0.3.0, and it is narrower
than it reads: **`__fixtures__/reference-golden.json` carries no spans at
all** — `spanId` and `scopeSpans` each occur zero times across its eight
cases, whose traces are empty `resourceSpans` arrays or BlobRefs. So those
eight cases are green for anything the tool-span loop does, including the
rejection marker this release adds, and their green is not evidence about it.

`website-golden.json` is the only golden fixture that exercises span-derived
output: five tool-call activities and four data-response descriptions. It is
the fixture that proves this release's byte-stability claim, and the one the
conditional spread of `civic:failed` was measured against — driven red by
making that spread unconditional, which moves it. Read
[civic-ai-tools#199](https://github.com/npstorey/civic-ai-tools/issues/199)
before citing a green golden suite as evidence about the graph builder.

**The reader-facing source name is measured, not changed**
([civic-ai-tools#194](https://github.com/npstorey/civic-ai-tools/issues/194),
Wave N10 P-H3). Tests only: no exported behaviour changes, and every golden
byte — both vocabulary eras, all eight golden-reproduction cases — is
unchanged.

- **The change #194 asks for moves frozen golden bytes.** A data response the
  builder cannot describe by a portal is described by its source's registry
  `agentTitle` (`Data response from Socrata MCP Server`) — the agent's title,
  implementation language on a reader-facing surface. Reading the registry's
  `displayName` instead — the reader-facing name, in the registry beside
  `agentTitle` since the package's first release — is a one-expression change,
  and it rewrites two lines inside `__fixtures__/website-golden.json`'s
  captured graph: the data-commons and boston-opencontext data responses, both
  on the agent-title branch. Three whole-graph byte-parity assertions read
  those two lines. A golden fixture is never edited to match new behaviour, so
  the change waits on a decision about whether those bytes move.
- **The vocabulary era cannot carry it.** `CivicVocabulary` binds exactly two
  literals — the `civic:` namespace and the id-scheme prefix
  (`makeCivicVocabulary(ns, urnPrefix)`) — and both era suites assert the two
  eras differ by those and by nothing else. A description's wording is neither
  of them and is not era-scoped: the same prefix is emitted under both eras, so
  gating it on the era would make prior-era reproduction and settlement-era
  emission disagree about a reader's wording rather than about an identifier.
- **Two instruments, both able to fail.** `provenance.test.ts` now pins the
  agent node's `dcterms:title` to the registry `agentTitle` — those are signed
  bytes in both golden fixtures and the one thing that does not move under
  either decision — and names the two golden descriptions at stake, asserting
  each reads by agent title today and *not* by display name. The sources they
  drive all carry two distinct registry names, which is what makes the
  assertions able to fail; a builder changed under either one turns it red.
- **What holds still either way.** The portal branch
  (`Data response from data.cityofnewyork.us`) and the unknown-source fallback
  (`Data response from euro stat`, the raw source id) move under neither
  decision.

**The PROV-O activity for a rejected call says it was rejected**
([civic-ai-tools#193](https://github.com/npstorey/civic-ai-tools/issues/193),
Wave N10 P-H2). Additive: no existing export is removed or retyped, and every
golden byte — both vocabulary eras, all eight golden-reproduction cases — is
unchanged.

- **Two new activity terms.** `CIVIC_TERM_FAILED` (`civic:failed`) and
  `CIVIC_TERM_FAILURE_KIND` (`civic:failureKind`) are declared in
  `src/format/vocabulary.ts` and exported from the package root. A `civic:`
  property name is vocabulary as much as the namespace it hangs under, so the
  capture-side builder imports them rather than spelling them; `purity.test.ts`
  now lists both, which is what makes that a claim able to fail.
- **`buildProvenanceGraph` reads the span's failure.** A tool span the producer
  ended with the boolean `error: true` yields a tool-call activity carrying
  `civic:failed: true`, and `civic:failureKind` with the span's `error.kind`
  verbatim when it carried one. Previously the builder read nine `tool.*` /
  `mcp.*` attributes and never asked about the outcome, so a call the source
  REFUSED and one that answered were the same node with the same description —
  and, a rejected call having no response hash, the absent data-response entity
  was the only trace of the rejection in the graph. `error.kind` is the one
  attribute name across this package and the reference producer.
- **`error` is the assertion, `error.kind` only a label on one.** A span
  carrying a kind and no assertion is not a rejection and yields neither key —
  the posture `ToolCallSummary.failed` / `failureKind` already takes.
- **A new boolean attribute reader.** The module's string attribute reader
  returns `stringValue ?? intValue` and cannot see `boolValue` at all, so it
  returned `undefined` for a span that really did record a rejection.
  `getBoolAttr` is a separate, strictly-typed reader rather than a widening of
  the string one: the nine attributes that reader serves are strings by
  contract, and a truthiness test would read the string `"false"` as an
  assertion of failure. Only the boolean `true` marks an activity.
- **The description states no cause.** `dcterms:description` is byte-unchanged
  — it states what the call WAS, and the marker states how it ended. The
  classified kind is the only cause the graph will ever carry: the reference
  producer stopped writing a rejection's raw text onto the span in this same
  wave, and the builder does not read it back in one layer up.
- **Byte consequence.** Both terms are spread conditionally and appended after
  every key the activity already carried, exactly as `civic:durationMs` is. A
  span that recorded no rejection yields the 0.3.1 key list in the 0.3.1 order,
  and `civic:failed: false` is never emitted — a producer that stated "not
  failed" and one that stated nothing must read the same, which is what makes a
  marker that IS present mean something. A rejected span carries no
  `tool.duration_ms` from the reference producer today
  ([civic-ai-tools-website#413](https://github.com/npstorey/civic-ai-tools-website/issues/413)),
  so `civic:durationMs` does not fire beside the two new keys.

**A call the record states as failed asserts no access**
([civic-ai-tools#192](https://github.com/npstorey/civic-ai-tools/issues/192),
Wave N10 P-H1). Additive: no existing export is removed, no existing caller
changes, and every golden byte — both vocabulary eras, all eight
golden-reproduction cases — is unchanged.

- **`ToolCallSummary` can see the rejection.** Two new OPTIONAL fields:
  `failed?: boolean`, the producer's assertion that the source rejected this
  call, and `failureKind?: string`, the producer's own open label for why.
  The harness never interprets the label, and `buildDataSources` never reads
  it — `failed` is the assertion, `failureKind` only a label on one. A
  summary carrying neither is exactly the 0.3.1 shape, and absence means
  "not recorded as failed", never "succeeded".
- **`buildDataSources` mints nothing from a rejected call.** A call whose
  summary carries `failed: true` contributes no dataset-keyed entry for the
  dataset it never read, and marks no aggregate source accessed. Previously
  the population could not see the failure at all, so a rejected call minted
  its dataset's entry and, on an aggregate source, marked that source
  accessed at a timestamp — inside the bytes a publisher signs. The rejected
  call keeps its POSITION in the walk (calls pair to spans by index), and it
  remains on the PROV-O graph's tool-call activities and in the caller's own
  `queries[]`. A source with any non-rejected call is still accessed; a
  dataset a successful call also read still gets its entry.
- **The two inert inputs are marked deprecated, not removed.**
  `buildDataSources`'s `fallbackPortal` — accepted and not consulted since
  0.3.1 — now also accepts `undefined`, so a caller that has stopped
  consulting it can stop supplying a value; it stays third of five positional
  parameters, because dropping a positional parameter is breaking.
  `ProvenanceInput.portal` becomes optional and carries `@deprecated`;
  removing it outright would make the reference app's object literal an
  excess-property error. Both removals wait for a major.
- **Byte consequence.** A package built from a record that states no failure
  is byte-identical to one built by 0.3.1 — the walk reaches the new branch
  only when a summary carries `failed: true`. A package built from a record
  that DOES state a failure loses the `dataSources` entries that failure
  never earned; that is the defect being fixed, and the wave re-emits
  nothing.
- **Type-level gate.** `src/capture/data-sources.assert.ts` pins the shape at
  compile time. `tsconfig.json` excludes `src/**/*.test.ts`, so the suite
  type-checks nothing — a test can drive a field the type does not have and
  `npm run typecheck` stays green.

## 0.3.1 — 2026-09-02

**The graph states what the span carried, and states absence as absence**
([civic-ai-tools-website#384](https://github.com/npstorey/civic-ai-tools-website/issues/384),
Wave N9 P-H1). Patch, not breaking: no existing export is removed or
retyped, and every golden byte — both vocabulary eras, all eight
golden-reproduction cases — is unchanged.

- **`buildProvenanceGraph` no longer invents a tool name.** An
  `mcp_tool_call` span with no `tool.name` yields a query entity with no
  `civic:toolName` key (omitted, not placeholdered) and a tool-call activity
  described as `MCP tool call (<operation type>)`. Previously the builder
  substituted `get_data`.
- **`buildProvenanceGraph` no longer attributes a data response to the run's
  portal.** `civic:portalDomain` and `civic:datasetUrl` are emitted only when
  the span carried both `tool.portal_domain` and `tool.dataset_id`. A
  dataset-keyed span with no portal is described by its source agent's
  registry title (`Data response from Socrata MCP Server`), the form
  aggregate and unknown sources already took; a span with a dataset id and
  no portal states `civic:datasetId` and mints no URL. Previously the builder
  substituted `ProvenanceInput.portal` — the run's selected portal — which
  attributed every `search` and `fetch` response to a portal the call never
  addressed (the Socrata server's `search` and `fetch` take no portal and
  answer from the portal that server is configured for). The graph does not
  parse tool arguments: a portal embedded in a `fetch` id is not a portal the
  span carried.
- **`buildDataSources` no longer mints an entry on `fallbackPortal`.** A
  dataset-keyed call whose arguments carry `dataset_id` but no `portal`
  contributes no `dataSources` entry — `DataSourceEntry.portalUrl` is a
  required string in produce-core, so an entry with no portal is not a shape
  this package can emit — and the call remains on the graph's tool-call
  activities. Calls that carry a portal (every `get_data` call from the
  reference producer, whose loop injects the run portal before the record is
  built) are unchanged.
- **Unchanged signatures, two inputs now unused.** `ProvenanceInput.portal`
  and the `fallbackPortal` parameter of `buildDataSources` keep their exact
  types and positions, are accepted, and are not consulted; both say so at
  the declaration.
- **Byte consequence.** A package produced by this version from a trace
  whose tool spans all carry `tool.name`, and carry `tool.portal_domain`
  wherever they carry a response hash, is byte-identical to one produced by
  0.3.0. Where a span carried less, the 0.3.0 output asserted a value the
  span did not, and this version's output differs from it by exactly that
  assertion. Packages already signed under 0.3.0 are untouched and remain
  verifiable exactly as published.
- **Dependency range widened, nothing resolved differently.**
  `@typedstandards/produce-core` is accepted at `^0.3.0 || ^0.4.0` so a
  consumer that takes produce-core 0.4.0 (an additive minor) resolves one
  copy rather than nesting a second under this package. The lockfile here
  still resolves 0.3.0.

## 0.3.0 — 2026-08-20

**Settlement-era civic vocabulary + produce-core 0.3.0**
([civic-ai-tools#160](https://github.com/npstorey/civic-ai-tools/issues/160) —
the 2026-08-19 vocabulary settlement, [ADR-0025](../../docs/adr/0025-vocabulary-settlement-evidence-excision.md);
canonical mapping in the specification's **Appendix J**, migration class
*frozen-in-signed-artifacts*). Minor, not breaking: no existing export is
removed or retyped, and no already-published package changes.

- **New emissions mint the settlement-era vocabulary.** `CIVIC_NS` becomes
  `https://civicaitools.org/ns/civic/` (was
  `https://civicaitools.org/ns/evidence/`) and `CIVIC_URN_PREFIX` becomes
  `urn:civic-record` (was `urn:civic-evidence`). Every id emitted by
  `buildProvenanceGraph` and every `civic:` `@context` entry moves with them.
  **A package produced by this version is not byte-identical to one produced
  by 0.2.0 from the same inputs** — the graph is inside the hashed envelope,
  so its envelope hash differs. Packages already signed under 0.2.0 are
  untouched and remain verifiable exactly as published.
- **The prior era stays available, exported, and reproducible.** New:
  `PRIOR_ERA_CIVIC_NS`, `PRIOR_ERA_CIVIC_URN_PREFIX`, the `CivicVocabulary`
  type, `makeCivicVocabulary(ns, urnPrefix)`, and the two bound eras
  `CIVIC_VOCABULARY` / `PRIOR_ERA_CIVIC_VOCABULARY`. `ProvenanceConfig` gains
  an optional `vocabulary` field defaulting to `CIVIC_VOCABULARY`. Supplying
  `PRIOR_ERA_CIVIC_VOCABULARY` reproduces a pre-settlement record
  byte-for-byte — the only sanctioned use; it is never for new emissions.
  Unlike the other `ProvenanceConfig` fields this one is defaulted rather than
  required: emitting the current vocabulary is not the silent-attribution
  hazard ADR-0024 guards against.
- **Unchanged signatures.** `civicUrn`, `civicModelUrn`, `civicSourceAgentUrn`,
  `civicPlatformUrn`, and `makeCivicProvContext` keep their exact signatures
  and now delegate to `CIVIC_VOCABULARY`, so callers of the settlement era need
  no edits.
- **`buildEvaluationPrompt` takes `RecordPackage`** — produce-core 0.3.0's
  settlement-era name for the same object (Appendix J, *alias-and-deprecate*).
  `EvidencePackage` remains a deprecated upstream alias of that exact type, so
  existing callers still compile; the rubric test suite deliberately stays on
  the prior name as the executable alias proof.
- **Dependency floor raised:** `@typedstandards/produce-core` `^0.2.0` →
  `^0.3.0`, and the `@typedstandards/verify-core` devDependency `^0.8.0` →
  `^0.9.0` to match the version produce-core 0.3.0 resolves (same-commit
  manifest bump across a minor boundary). No behavior-affecting patch bumps
  ride along.
- **Both eras are under test.** The two captured fixtures
  (`reference-golden.json`, `website-golden.json`) predate the settlement and
  are not edited: their byte- and hash-parity legs now run with the prior-era
  vocabulary injected, and a settlement-era leg asserts the same reference
  bytes with exactly the two Appendix J literals substituted, with the hashes
  recomputed from those substituted bytes by verify-core's shared chain. The
  per-canonicalization-rule consequence is pinned explicitly: under
  `legacy-json/v1` the era flip moves `contentHash` (the whole package is
  fingerprinted, provenance included); under `dathere-ag-jupyter/v1` it does
  not (only the executed notebook is). The envelope hash moves under both.
- **Purity guard widened:** the capture/format boundary test now bars
  vocabulary literals of **both** eras from `src/capture/**`. The invariant is
  "vocabulary lives only in `format/vocabulary.ts`", not "the prior-era strings
  are gone" — both eras are real vocabulary now, and either could be redefined
  in the wrong module.

## 0.2.0 — 2026-08-17

**Breaking: identity-bearing config is now required**
([civic-ai-tools#153](https://github.com/npstorey/civic-ai-tools/issues/153) —
the [ADR-0024](../../docs/adr/0024-evidence-path-configuration.md) posture at
the domain layer: configuration that reaches signed output is absent-or-error,
never defaulted). 0.1.0 applied the civicaitools.org reference deployment's
identity via silently-applied default parameters; 0.2.0 removes every such
default, so a bare call fails typecheck instead of attributing output to the
reference deployment.

- **Breaking — the config parameter is required in five API families:**
  - `buildProvenanceGraph(trace, input, config)` — `ProvenanceConfig`
    required (was defaulted to `CIVICAITOOLS_PROVENANCE_CONFIG`).
  - `buildDatHereEnvironment(model, skillMcpServerUrl, config)` and
    `deriveDatHereEnvelopeFields(input, config)` —
    `DatHereEnvironmentConfig` required (was defaulted to
    `CIVICAITOOLS_ENVIRONMENT_CONFIG`; the `host` field lands under the
    envelope hash, so this default was the sharpest instance).
  - `new TraceBuilder(config)` — `TraceBuilderConfig` required (was
    defaulted to `CIVICAITOOLS_TRACE_CONFIG`). The intra-config
    `now`/`randomBytes` operational fallbacks are unchanged — they are not
    identity.
  - `isDatasetKeyedSource(sourceId, registry)`,
    `displayNameForSource(sourceId, registry)`,
    `formatDataSourcesSummary(entries, registry)` — `CivicSourceRegistry`
    required in all three (was defaulted to `CIVIC_SOURCE_REGISTRY`).
- **Breaking — the model-agent description is omitted when unset.** The
  module-private fallback description is deleted.
  `ProvenanceConfig.modelAgentDescription` stays optional, but when unset the
  PROV model agent now carries **no** `dcterms:description` field at all
  (honest absence, not an empty string — ADR-0024 §B) instead of the fallback
  text. `CIVICAITOOLS_PROVENANCE_CONFIG` now carries
  `modelAgentDescription: 'Large language model via OpenRouter'`, so
  reference-config output is byte-identical to 0.1.0.
- **The reference-value exports remain.** `CIVICAITOOLS_PROVENANCE_CONFIG`,
  `CIVICAITOOLS_ENVIRONMENT_CONFIG`, `CIVICAITOOLS_TRACE_CONFIG`, and
  `CIVIC_SOURCE_REGISTRY` are still exported — they are the reference
  deployment's values, which the reference app passes explicitly; they are no
  longer applied on any caller's behalf.
- **Migration:** pass the exported reference configs to reproduce 0.1.x
  behavior byte-for-byte (see README §"Migrating from 0.1.x"). Golden
  fixtures are unchanged; byte parity now comes from tests passing the
  reference config explicitly, never from restored defaults.
- **Enforcement:** `src/required-config.assert.ts` encodes the acceptance
  condition — one `@ts-expect-error` bare call per changed signature —
  so reintroducing a default parameter fails `npm run typecheck` and
  `npm run build`.
- Dependencies unchanged (`@typedstandards/produce-core` `^0.2.0` remains the
  single runtime dependency).

## 0.1.0 — 2026-08-02

Initial release: the civic **domain harness** for Typed Standards evidence
packages — the DOMAIN side of the format/domain line drawn in
[ADR-0021](../../docs/adr/0021-produce-core-extraction.md), relocated whole
from the reference application and packaged per
[ADR-0022](../../docs/adr/0022-civic-typed-harness-packaging.md). Operating
rule: **the harness derives, the core assembles.**

- **Published as `@typedstandards/civic-typed-harness`.** The package landed
  in-repo under the working name `civic-typed-harness`, `private: true`, with
  the final npm name deferred to the project's naming taxonomy (ADR-0022 §B).
  The decision selected the standard's scope with the full layer-3 basename;
  rationale, the alternatives scored, and the named reversal condition are in
  the planning-side naming memo (`naming-research-harness-scope.md`), recorded
  as a dated addendum to ADR-0022.
- **Format-extension group** (`src/format/`) — the `civic:` JSON-LD namespace
  and `urn:civic-evidence:` id scheme, the civic source registry, the datHere
  envelope-policy derivations (producerProfile, content-canonicalization rule,
  summary emission, the `org.civicaitools.environment` extension), and the
  captureMethod vocabulary surface (verify-core's Q32 fallback-table entry,
  single-sourced — flagged, not solved, here).
- **Capture group** (`src/capture/`) — the OTel-compatible `TraceBuilder`,
  skill-metadata extraction, data-source population, and the civic provenance
  graph builder. Clock and RNG are permitted here only, and are injectable.
- **Rubric group** (`src/rubric/`) — the civic six-criterion adversarial
  evaluation core: rubric text, the Q26-pinned `RUBRIC_VERSION_SHA256`, prompt
  builder, and response parser. The model runner and result emission stay
  implementation-side; this module performs no I/O.
- **Config, not constants** (ADR-0020 posture at the domain layer) — every
  value naming a deployment (platform-agent identity/URL, MCP server URLs, the
  environment-extension `host`, trace `service.name` and scope identity) is a
  typed config input with the demo values exported as overridable defaults.
- **Single declared runtime dependency: `@typedstandards/produce-core`**
  (`^0.2.0`). The verify-core primitives the harness consumes (`sha256Hex`,
  `isBlobRef`, the canonicalization-rule URIs, the Q32 vocabulary table and
  the `CaptureMethod` type) are reached through produce-core 0.2.0's
  re-exports rather than importing `@typedstandards/verify-core` directly —
  no phantom dependency, and producer, harness, and verifier still share one
  hashing implementation by construction (typedstandards#35 class of bug,
  flagged in civic-ai-tools#116 P1).
- **Purity contract (harness-grade)** — no I/O, no network, no environment
  reads, no Node built-ins, browser-safe throughout; enforced twice, by
  `eslint.config.mjs` and by `src/purity.test.ts`, which also enforces the
  internal format/capture module boundary that reserves the future package
  split (ADR-0022 §C).
- **Byte-compatibility proof** — golden fixtures captured from the reference
  implementation: provenance graphs and dataSources arrays reproduce
  byte-for-byte under the demo default config, `RUBRIC_VERSION_SHA256` is
  asserted against the exact reference digest, and a produce→verify
  composition round-trip runs the harness output through produce-core's
  envelope assembly and verify-core's §9.2 verification sequence.
