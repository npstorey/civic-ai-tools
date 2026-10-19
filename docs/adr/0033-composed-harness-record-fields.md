# ADR-0033: The composed-harness record fields — what a record states about how its prompt and tools were composed, and who answered each call

- **Status:** **Accepted** (2026-10-15 — the field list ruled by the owner at gate G0 of sprint R2, anchor [civic-ai-tools-website#599](https://github.com/npstorey/civic-ai-tools-website/issues/599): D5, row G0-12 and memo card 3; the names, types, sources and placement below read and approved by the program seat on 2026-10-15 before any code, with three conditions, each folded in: the specification amendment of §C, made in this record's PR; the measurement of whether the specification enumerates vocabulary terms or extension keys (§H); and a census of public records under §A (Consequences))
- **Date:** 2026-10-15 (decision); written by the sprint's H2 implementation session and landing in its PR, with `@typedstandards/civic-typed-harness` 0.7.0
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0004](0004-dathere-captureMethod-variant.md) (the `org.civicaitools.environment` block: two of its fields become present only when known, §C), [ADR-0024](0024-evidence-path-configuration.md) (applied to two placeholders and to a source-id default, §A and §C), [ADR-0022](0022-civic-typed-harness-packaging.md) §C (the capture/civic boundary, §F)

## Context

`@typedstandards/civic-typed-harness` 0.6.0 derives what a record package states about a run: the PROV-O graph, `dataSources[]`, and the datHere profile's `org.civicaitools.environment` block. Measured at hub `6483894`, five things it states are either defaults or absent:

1. **Calls are attributed to Socrata when their source is not in the registry.** `capture/provenance.ts:318-325` resolves a call's agent through `sourceAgentMap[id] ?? sourceAgentMap[fallbackSourceId]`, and the civic layer sets the fallback to `'socrata'` (`civic/provenance.ts:148`). A span tagged with an unregistered source gets its own agent node (`:295-312`) while the call's `prov:wasAssociatedWith` names Socrata's (`:322`, used at `:404` and `:514`). When Socrata made no call in the run, that reference names an agent the graph does not contain. An untagged span is attributed to the fallback directly (`:291`, `:403`), without consulting the tool name. `dataSources[]` has the same default (`capture/data-sources.ts:103-105`, defaulted at `civic/data-sources.ts:60` and `:101`).
2. **The environment block states `temperature: 0` and `toolDefinitions: []`** (`format/dathere.ts:160`, `:162`), documented as known gaps at `:147-149` (hub #240). No model call in the reference app sends a temperature, and the run offered tools.
3. **The date the prompt asserted is hashed, never recorded** (website #475). `skillMetadata.systemPromptHash` covers the composed prompt, date line included, and nothing states the date.
4. **The servers a record names are read when it is packaged, not when the run happened** (website #495).
5. **Nothing states which sources the run was offered, or which components composed its prompt** (D5).

R2 also renames every tool the model sees to `<alias>__<upstream name>` (ADR-0032), so a call has two names, and a record must carry both (design §6, item 5).

The program's rule applies to items 1 and 2: a default that asserts a fact inside a signed record is an integrity defect even while it is true (ADR-0024 §B).

## Decision

### A. Every call is attributed to its own source (G0 memo card 3)

The source id of an `mcp_tool_call` span is resolved in this order, in both the provenance graph and `dataSources[]`:

1. the span's `mcp.source` attribute, when non-empty, whether or not the registry carries that source;
2. otherwise the resolver applied to the tool name (`ToolSourceResolver`; the civic default is `civicToolSourceResolver`): the span's `tool.name` in the graph, and the call summary's `name` in `dataSources[]`, which already does this;
3. otherwise `fallbackSourceId`, whose civic default becomes **`UNKNOWN_SOURCE_ID = 'unknown'`**, a new export of `format/sources.ts`. This is the value the reference app writes for a tool it cannot resolve (website `run-tool-loop.ts:912`).

The call's `prov:wasAssociatedWith` is the agent of that source id: the registry's agent when the registry carries it, otherwise `<prefix>:mcp-server:<encodeURIComponent(id)>`, titled `<id> MCP Server`, with no `civic:serverUrl`. The branch at `capture/provenance.ts:322` is removed, so no caller setting restores it. `ProvenanceConfig` gains an optional `resolver` (civic default `civicToolSourceResolver`). The capture builder's `ProvenanceBuildConfig` gains a required `resolver`, as every capture input is required.

`fallbackSourceId` stays as a caller input. A caller may still pass an explicit id, for example `'socrata'` to reproduce a pre-0.7.0 record of an untagged span whose tool name does not resolve. `FALLBACK_SOURCE_ID = 'socrata'` stays exported and is no longer a default for attribution. Two readers keep it, and neither attributes a call: `displayNameForSource` (`format/sources.ts:136`, a display label, hub #256, outside this decision), and `skillSourceId`'s default (`civic/provenance.ts:149`), which names the source whose agent the skill-fetch URL overrides.

`UNKNOWN_SOURCE_ID` is not in the civic registry, so an unresolved call contributes no `dataSources[]` entry. In the provenance graph it is attributed to an agent `mcp-server:unknown`.

### B. Each call records both its names, its alias and its server (G0-12 as extended at G0)

The tool-call activity gains three `civic:` terms. Each is declared in `format/vocabulary.ts` in the `export const NAME = 'civic:…';` form that `purity.test.ts` derives its universe from. Each is emitted only when the span carries its attribute, and appended after the existing keys, so a span without the attributes yields the 0.6.0 key list.

| Field | Type | Span attribute (on `mcp_tool_call`) | Term on the tool-call activity |
|---|---|---|---|
| Exposed name, the name the model called | string | `tool.name` (unchanged) | `civic:toolName` on the query entity (unchanged; it states the span's `tool.name` verbatim) |
| Upstream name, the name sent on the wire | string | `tool.upstream_name` | `CIVIC_TERM_UPSTREAM_TOOL_NAME = 'civic:upstreamToolName'` |
| Alias of the source that answered | string | `mcp.alias` | `CIVIC_TERM_SOURCE_ALIAS = 'civic:sourceAlias'` |
| Server identity: the manifest entry's `id`, which is the source's MCP Registry name where it has one, otherwise its package or service name and address (router `ManifestEntry.id`) | string | `mcp.server.id` | `CIVIC_TERM_SERVER_ID = 'civic:serverId'` |

The router's dispatch map supplies the first three, and the manifest supplies the fourth. The reference app writes them (W3 and W4). `civic:toolName` keeps its meaning: it states what the span carried. `queries[]` entries are built by the producer, not the harness (spec §8.1.8), and are outside this record.

### C. The environment block: `toolDefinitions` and `temperature` are stated when known, and absent otherwise (hub #240)

`buildDatHereEnvironment` and `DatHerePolicyInput` take two optional inputs:

| Field | Type | Read from | Lands in | When absent |
|---|---|---|---|---|
| `toolDefinitions` | `readonly Record<string, unknown>[]`, the tools array as offered to the model (chat-completions function tools, the router's output), in offered order, stated verbatim | input `toolDefinitions`; the reference app records it on the root span as `analysis.tool_definitions` (JSON text), read by §E's extractor | `extensions["org.civicaitools.environment"].toolDefinitions`, in its current key position (after `mcpServers`) | the key is omitted |
| `temperature` | number | input `temperature`, the value the request sent | `extensions["org.civicaitools.environment"].temperature`, in its current key position (after `modelVersion`) | the key is omitted |

No trace attribute is defined for `temperature`. The reference app sends none (#548's measurement), and a producer that does send one passes it as input.

Each key keeps its 0.6.0 position, so a caller that passes the recorded `temperature: 0` and `toolDefinitions: []` gets the 0.6.0 bytes exactly. This is how an already-signed record is reproduced.

**This decision conflicts with the specification as written.** §8.7.1 requirement 3 says the environment object "MUST contain at least … `temperature` (number) … `toolDefinitions` (array …)". Under ADR-0024 §A, a required field with no known value would be refused, and that would refuse every datHere publish, because no temperature is sent. This record decides the other branch: in requirement 3, the two fields become **present when the producer knows the value, absent otherwise**, and a verifier MUST NOT read either absence as malformed. The amendment to §8.7.1 is its own commit in this record's PR: specification v0.1.11, a patch revision of the v0.1 Working Draft (§2 and Appendix G), whose tag `v0.1.11-typed-standards-spec` the owner makes at the merge. No verifier enforces requirement 3 today: verify-core 0.12.0 in the hub lockfile, and typedstandards `ec997fc`, carry neither key outside fixtures.

### D. Run-time servers are read from the trace, and preferred (website #495)

| Field | Type | Read from | Lands in |
|---|---|---|---|
| `runMcpServers` | `readonly DatHereMcpServer[]` (`{ url, name? }`, with `name` set to the source id, in the app's registry order) | the root span's **`analysis.mcp_servers`** attribute (JSON text), written by the app at run time from the configuration it ran with; read by §E's extractor; also accepted as an input | `org.civicaitools.environment.mcpServers` |

Precedence in `deriveDatHereEnvelopeFields`: `runMcpServers`, then the packaging-time `mcpServers`, then `skillMcpServerUrl`, so a trace that carries the attribute always wins.

For the provenance graph's agent addresses, which every profile carries, the civic layer adds `withRunServerAddresses(registry, runMcpServers)` (`src/civic/run-servers.ts`). It returns the registry with each entry's `serverUrl` set to the run's address for that source id. An entry the run list does not name has its `serverUrl` omitted: the run did not have that server, so the graph states no address for it (#205's rule).

### E. A new extension block for how the prompt and tools were composed: `org.civicaitools.composition`

These fields apply to every profile, not only datHere, so they do not go in the datHere environment block. They go in a new reverse-DNS block (spec §8.1.6), `COMPOSITION_EXTENSION_KEY = 'org.civicaitools.composition'`. It is emitted by `deriveDatHereEnvelopeFields` for every content profile when at least one field is passed, and appended after any caller extensions and the environment block. With no field passed it is not emitted, and the extensions bytes are unchanged.

| Field | Type | Read from | When absent |
|---|---|---|---|
| `assertedDate` (#475) | string, `YYYY-MM-DD`, the `today` the composed prompt stated; anything else is refused with a named error | input `assertedDate`; root-span attribute **`analysis.asserted_date`** | key omitted |
| `sourcesOffered` (D3, D5) | `{ sourceId: string; alias: string; reason: 'configured' \| 'not-configured' \| 'selected' \| 'not-selected' }[]`, one entry per manifest source in manifest order; a reason outside the four is refused | input `sourcesOffered`; root-span attribute **`analysis.sources_offered`** (JSON text) | key omitted |
| `components` (D5) | `{ id: string; version?: string; guidanceHash?: string; guidanceOrigin?: 'endpoint' \| 'inline' \| 'fallback' }[]`, one entry per offered source in manifest order, then one for the composing package | input `components`; root-span attribute **`analysis.components`** (JSON text) | key omitted |

The four reasons:
- `not-configured`: the instance has no address for the source, so it was not offered.
- `configured`: the source was configured and offered, and the run passed no explicit selection (the default selection is every configured source).
- `selected`: the source was configured, and the run's explicit selection included it.
- `not-selected`: the source was configured, and the explicit selection left it out.

A source was offered exactly when its reason is `configured` or `selected`.

The `components` fields:
- `id` is the manifest entry's `id` (§B's server identity, so a call's `civic:serverId` joins to its component), or, for the composing package, its package name.
- `version` is what the instance knows: a server's reported version, or a pinned commit. It is omitted when unknown.
- `guidanceHash` is the lowercase hex SHA-256 of that component's guidance text as composed into the prompt, in the same form as `skillMetadata.systemPromptHash`. It is omitted when the component contributed no guidance.
- `guidanceOrigin` is present exactly when `guidanceHash` is:
  - `endpoint`: fetched from the source's server at run time;
  - `inline`: text carried in the manifest or composing package;
  - `fallback`: the composer's stand-in after a fetch failed.

  These are Q65's three guidance-provenance kinds.
- The composing package's own entry carries no guidance fields. The composed prompt as a whole stays `skillMetadata.systemPromptHash`, which is unchanged.

**The extractor.** A new capture module, `capture/run-attributes.ts`, exports `extractRunAttributes(trace)`. It reads the root span (the span with no parent) and returns `{ assertedDate?, runMcpServers?, toolDefinitions?, sourcesOffered?, components? }`, under the field names above. An absent attribute gives an absent field. An attribute that is present but does not parse as the JSON shape above (an array of objects whose named fields are strings) is refused with a named error, `RunAttributeError`, not read as absent: falling back to packaging-time state there would repeat #495. A BlobRef trace yields `{}` through `traceForInspection`, the same degraded path skill extraction takes, and a caller holding such a trace passes the fields as inputs. The extractor checks shape only. The values (the date form, the reason set, the hash form, the origin set) are policy, checked in `format/` by the derivation, which refuses a bad value with a named error, `RecordFieldError`.

### F. `CIVICAITOOLS_TRACE_CONFIG` moves to `src/civic/` (hub #246)

The constant moves from `capture/trace.ts:114-119` to a new `src/civic/trace.ts`, typed by `capture/trace.ts`'s `TraceBuilderConfig` (a type-only import in the allowed direction). `src/index.ts` re-exports it under the same name with `export * from './civic/trace.ts'`.

`purity.test.ts` gains a fourth boundary leg: **no capture module exports a value binding** (`export const|let|var`). Capture exports types, functions and classes. A deployment's values live in `src/civic/` and the format group's vocabulary in `format/`. After the move, capture/ exports no value binding, so the rule holds with no exception list.

### G. What does not change

- `skillMetadata` (`systemPromptHash`, `mcpServerUrl`, `skillText`) and its extraction.
- The `queries[]` shape the harness passes through.
- The `civic:` namespace, the URN scheme, both vocabulary eras.
- `displayNameForSource`.
- produce-core's envelope assembly. Every new field lands in a PROV-O term or an extension block, and no top-level envelope field is added.
- No dependency changes.

### H. What the specification lists, and what it does not (the seat's second condition)

The specification names `civic:` terms and extension keys by example only, so this record adds none to it:
- §8.1.4 names one term, `civic:sourceId`, to describe per-source attribution, and none of the other fifteen the harness emits (`civic:toolName`, `civic:failed` and the rest appear nowhere in it).
- §8.1.1's `extensions` row and §8.1.6 introduce keys with "e.g." and "(`org.civicaitools.notebook`, `org.civicaitools.environment`, `org.<your-domain>.<your-extension>`)". `org.civicaitools.summary`, which the reference app emits, appears nowhere in it.

The three new terms are declared where every other term is, in `format/vocabulary.ts`, and the new block's key in `format/dathere.ts`.

## Considered and rejected

- **Putting every new field in `org.civicaitools.environment`, emitted for every profile.** The asserted date, the offered set and the components are needed in default-profile records too. Emitting the environment block outside datHere would put `modelVersion` and `host` into default-profile bytes and blur §8.7.1's profile requirement. The reference app's renderer also reads that block as the datHere environment.
- **New top-level envelope fields** (for example `assertedDate` beside `prompt`). This would change produce-core and the specification's §8.1.1 table, and the harness derives, while the core assembles (ADR-0021).
- **`toolDefinitions` as a packaging-time input only**, carried by the app from run to publish. A value read at publish time is publish-time state, which is #495's defect. The trace already travels from run to publish. The cost is accepted (Consequences: the tools array appears twice in an inline trace).
- **Keeping the Socrata fallback for untagged spans whose tool name does not resolve**, on the grounds that pre-source-tagging records were Socrata-only. That is the asserted-default class. The explicit `fallbackSourceId: 'socrata'` input covers reproduction of such a record without making it the default.
- **Server identity as the server's self-reported `serverInfo` (name, version at MCP `initialize`).** It is not under the operator's control, and the reference client does not read it today. It can fill a component's `version`. The per-call identity is the manifest's `id`, which joins to `components[]`.
- **Refusing a datHere publish when `temperature` is unknown** (ADR-0024 §A's required-field branch). Every datHere publish would fail, because none is sent. The specification's requirement is amended instead (§C).

## Consequences

- **Signed bytes move only where a field named here is passed, or where a call's source is not in the registry.**
  - A trace that tags only registered sources, or whose untagged spans resolve by name, yields 0.6.0's graph and `dataSources[]` byte for byte.
  - A datHere package built with none of the new inputs differs from 0.6.0's only in the two absent environment keys.
  - Measured on the goldens (before any code, and held by the suite since): `website-golden.json`'s derived graph moves in exactly one field, tool-4's `prov:wasAssociatedWith` (`mcp-server:socrata` to `mcp-server:euro%20stat`), and its `dataSources[]` do not move. `reference-golden.json`'s eight cases reproduce byte for byte when given their recorded `temperature: 0` and `toolDefinitions: []`. The frozen fixtures are never edited, and a test now pins each one's sha256: a move reaches them as a named lift with its node count asserted, as #205's did, and `span-carrying-golden.json`'s two recorded hashes are regenerated with a dated note.
- **A record signed by ≤0.6.0 whose trace tags a source the registry lacks** does not reproduce under 0.7.0. Its call was attributed to Socrata, and §A removes that branch with no opt-out. The reference app tags an unresolvable tool `unknown`, so published records with such a call are the ones affected. A read-only census of the public records, listing each such call by record, is run for the merge gate's evidence, with an instrument kept outside this repository; any lifecycle action on an affected record, and any census of non-public records, is the owner's later decision. An already-signed record is never edited.
- **Untagged spans now resolve by name in the graph**, as they already did in `dataSources[]`. A pre-tagging record whose untagged span names a non-Socrata tool moves to that tool's source. Such records were Socrata-only when written.
- **The civic default resolver reads the eleven bare names only.** After R2's renaming, the reference app tags every span, so attribution does not depend on the resolver. A span missing for a call (counts diverging) with an aliased name then resolves to `unknown` and mints no `dataSources[]` entry.
- **An inline trace carries the offered tools twice**: once as `analysis.tool_definitions`, once in the environment block. Spec §8.7.1 already allows `toolDefinitions` as a BlobRef when large.
- **The specification's §8.7.1 requirement 3 is amended** (§C), in its own commit, as v0.1.11. The website's record detail page already renders `temperature` only when present (website `evidence/[slug]/page.tsx:561` at `d1919a8`).
- **The reference app writes:**
  - five root-span attributes: `analysis.asserted_date`, `analysis.mcp_servers`, `analysis.tool_definitions`, `analysis.sources_offered` and `analysis.components`;
  - three tool-span attributes: `tool.upstream_name`, `mcp.alias` and `mcp.server.id`.

  It calls `extractRunAttributes` and `withRunServerAddresses` (R2 W3 and W4).

## References

- [civic-ai-tools-website#599](https://github.com/npstorey/civic-ai-tools-website/issues/599): the R2 anchor, its G0 record and G0 close.
- [civic-ai-tools#240](https://github.com/npstorey/civic-ai-tools/issues/240), [#246](https://github.com/npstorey/civic-ai-tools/issues/246), [#256](https://github.com/npstorey/civic-ai-tools/issues/256); [civic-ai-tools-website#475](https://github.com/npstorey/civic-ai-tools-website/issues/475), [#495](https://github.com/npstorey/civic-ai-tools-website/issues/495).
- [ADR-0024](0024-evidence-path-configuration.md): absent-or-error, never defaulted.
- ADR-0032: tool naming across sources, written by R2's router phase (H1) and landing beside this record.
- Specification §8.1.6 (extensions), §8.1.8 (`queries[]`), §8.7.1 (datHere requirements), Appendix J (vocabulary).
- [Q65](../architecture/open-questions.md#q65--build-composition-as-a-publishable-artifact-what-is-a-harness-at-the-experience-layer): per-source guidance provenance.

## Amendment — 2026-10-18: two reasons and the flows-statement reference (ruling D2 = A)

Ruled by the owner on 2026-10-17 at gate G0 of sprint R6, anchor [civic-ai-tools-website#632](https://github.com/npstorey/civic-ai-tools-website/issues/632): ruling D2 = A. Written by the sprint's harness phase (H2) and landing in its PR, with `@typedstandards/civic-typed-harness` 0.9.0 as planned. It amends §E in two places and changes nothing else in this record. As §H found, the specification lists none of these fields, so no specification text moves.

**The reasons.** `sourcesOffered[].reason` gains two values, after the four of §E in §E's order: `'configured' | 'not-configured' | 'selected' | 'not-selected' | 'reader-off' | 'not-consented'`. A reason outside the six is refused (`RecordFieldError`).
- `reader-off`: the source was configured, and the reader turned it off.
- `not-consented`: the source was configured, and the reader has given no consent for it (the reader's state for it is Ask first, or no consent is in force).

A source was offered exactly when its reason is `configured` or `selected`, as §E states; neither new reason is an offered one. The two reasons are the reader's states, which the consuming app maps from its consent store. The router's own `not-selected` stays what the router emits.

**The flows statement.** The composition block gains a fourth field, its last key:

| Field | Type | Read from | When absent |
|---|---|---|---|
| `flowsStatement` | `{ url: string; hash: string; date: string }`, keys in that order: the address the instance serves its flows statement at, the statement's version as a lowercase hex SHA-256, and the statement's `YYYY-MM-DD` date | input `flowsStatement`; root-span attribute **`analysis.flows_statement`** (JSON text of one object) | key omitted |

- **`url`'s form.** An absolute URL that the WHATWG `URL` parser accepts, written with its scheme and `//`, whose scheme is `https:` or `http:`, with no user name or password and no whitespace or control character. `http:` is accepted because a local instance serves its statement from `http://localhost`, and no measured reason requires `https:` only: the record states the address as passed and fetches nothing. Anything else is refused.
- `hash` is refused unless it is lowercase hex SHA-256, the form of `components[].guidanceHash`. `date` is refused unless it is a real calendar date, the check `assertedDate` takes.
- An object that is not exactly the three fields is refused, an extra key included: the record carries the reference and nothing else.
- **The extractor** reads `analysis.flows_statement` as JSON text of one object whose fields are exactly `url`, `hash` and `date`, each a string. It refuses with `RunAttributeError` text that is not JSON, a JSON value that is not an object (an array, `null`, a string), a missing field, a field that is not a string, and an extra field. It checks that shape only; the three forms above are checked by the derivation.

**Key placement.** `flowsStatement` is the block's last key, after `components`, so a block built without it has the same bytes as before this amendment, and a block built with it keeps the three earlier keys where they were. Measured at hub `794fe5b`, with produce-core 0.9.0 and verify-core 0.14.0: a v0.1 envelope's hash is the SHA-256 of its RFC 8785 JCS canonicalization (verify-core `computeEnvelopeHash`), and JCS sorts object keys, so on that chain the envelope hash does not depend on the order. Three things do depend on insertion order: a pre-v0.1 envelope's hash, which is the SHA-256 of its `JSON.stringify`; the package as stored and served, which is serialized in insertion order; and the derivation's output, which the tests pin with `JSON.stringify`. The `dathere-ag-jupyter/v1` content hash covers the notebook alone, and the composition block does not enter it.

**By reference only.** The record refers to the flows statement by address, hash and date, and never carries its content (ADR-0036 §D). The recipients, what each receives and the postures their holders state are in the statement, not in signed bytes, so a record can state where its question went without attesting other parties' practices.

**Bytes.** Signed bytes move only on a new record that passes a new reason or a `flowsStatement`. A record packaged without them has the same bytes, and the golden fixtures do not move.

## Amendment 2 — 2026-10-19: routing, the definition hash and the load span (rulings D3 = A and D5 = B)

Ruled by the owner on 2026-10-19 at gate G0 of sprint R8, anchor [civic-ai-tools-website#644](https://github.com/npstorey/civic-ai-tools-website/issues/644): ruling D3 = A (the router package owns the directory and the `load_source` tool, the website owns the loop's load step, and the harness owns what a record states) and ruling D5 = B (every composition yields a harness definition, and a record of an in-loop run states its hash). Written by the sprint's harness phase (H2) and landing in its PR, with `@typedstandards/civic-typed-harness` 0.10.0 as planned. It amends §E with two fields and adds the load span below; nothing else in this record changes. As §H found, the specification lists none of these fields or terms, so no specification text moves.

**Two fields.** The composition block gains two keys after `flowsStatement`, in this order, each emitted only when passed:

| Field | Type | Read from | When absent |
|---|---|---|---|
| `routing` | `{ method: 'all-sources' \| 'picker' \| 'in-loop'; version: string }`, keys in that order: how the run's sources were chosen, and the version of the router that chose them | input `routing`; root-span attribute **`analysis.routing`** (JSON text of one object) | key omitted |
| `definitionHash` | string, the lowercase hex SHA-256 of the run's harness definition, as the router computed it ([ADR-0037](0037-the-first-step-tool.md)) | input `definitionHash`; root-span attribute **`analysis.definition_hash`** (plain text) | key omitted |

- **The methods** (`ROUTING_METHODS`, design §5's three values): `all-sources`, every configured source offered from the first request; `picker`, a set chosen before the run; `in-loop`, the model loaded sources during the run through the router's directory. The derivation accepts `picker`, and nothing in this sprint emits it: whether a run under all-sources routing with a reader's panel selection is `all-sources` or `picker` is left unrecorded, so its bytes do not move.
- **Refusals** (`RecordFieldError`, naming the field). `routing` is refused when it is `null` or not an object (an array, a string, JSON text), when it carries a key besides `method` and `version`, when `method` is not one of the three, and when `version` is not a non-empty string. `definitionHash` is refused when it is `null` or not a lowercase hex SHA-256, the form of `components[].guidanceHash`.
- **The input type.** `RoutingInput.method` is typed `string`, as `SourceOfferedInput.reason` is, so the extractor's output passes to the derivation by name; `RoutingMethod` names the three values for a caller that builds the object itself.
- **The harness computes no hash.** The definition's hash arrives as a value (D5 = B): the router computes it over its canonical JSON, and the harness checks its form and states it.
- **The extractor** reads `analysis.routing` as JSON text of one object whose fields are exactly `method` and `version`, each a string, and refuses with `RunAttributeError` text that is not JSON, a JSON value that is not an object, a missing field, a field that is not a string, and an extra field. It reads `analysis.definition_hash` as a plain string, as `analysis.asserted_date` is read. It checks those shapes only; the method set and the hash form are checked by the derivation.

**Key placement.** Each key follows the ones before it, so a block built without them has the same bytes as before this amendment, and a block built with them keeps every earlier key where it was. The amendment of 2026-10-18 says which hashes depend on insertion order.

**The load span.** A `load_source` call is recorded as a tool span like any other (`mcp_tool_call`), with `tool.operation_type` `load_source` and one outcome attribute, `tool.load_outcome`. The instance's own loop handles the call, and no source answers it. So:
- the provenance graph mints no `mcp-server:` agent for it: it is not among the sources in the trace, even when it carries an `mcp.source` tag;
- it mints no data-response entity for it, even when the span carries `tool.response_hash`, and `buildDataSources` mints no `dataSources[]` entry for it, skipping the call **in place**: calls are paired to spans by index (`capture/data-sources.ts`), so a load call keeps its position and the calls after it keep their own spans;
- its tool-call activity is associated with the **platform agent** (`config.platformAgent`, the instance that publishes the record), states no `civic:sourceId`, and states the outcome under `civic:loadOutcome`, as its last key;
- its query entity, its description, and `civic:sourceAlias`, `civic:upstreamToolName` and `civic:serverId` when the span carries the attributes, are as for any tool span;
- `tool.load_outcome` must be one of `loaded`, `declined`, `no-answer` and `unavailable`; a load span with no outcome, or another value, is refused with `LoadSpanError` when the graph is built, so a graph never states a load without saying how it ended.

A span with any other operation type is unchanged.

**Two readings, and why.** The anchor says the load's activity "is associated with the software agent", and that the harness mints "no access entry" for it.
- *The software agent is the platform agent.* Every agent in the graph is a `prov:SoftwareAgent`: the model, one per source, and the platform. No source handled the load, and the model asked for it (its inference is the query entity's `prov:wasGeneratedBy`, as for any call); the loop that answered it is the instance's, which the platform agent names. Associating it with a source's agent would state a contact that did not happen, and a source agent minted for it is exactly the `unknown` agent this amendment removes.
- *No access entry means no `dataSources[]` entry and no data-response entity.* Both state that a source was reached and returned data. A load reached none, even if a producer hashes the one-line result onto the span.

**The outcome term.** `civic:loadOutcome` (`CIVIC_TERM_LOAD_OUTCOME`), declared in `format/vocabulary.ts` with its four values (`LOAD_OUTCOMES`): `loaded`, the source's guidance and tools were added for the next request; `declined`, the reader did not allow the source for this run; `no-answer`, no decision arrived in time; `unavailable`, the instance could not offer the source for a reason known without contacting it. It is named as `civic:failureKind` is, for the call outcome it labels. Like every term, it is era-independent: a graph built under the prior-era vocabulary carries the same key under that era's namespace. It reaches the capture builder as a parameter, with the outcome set, as every other term does (the seam of civic-ai-tools#244 P2: `capture/` imports nothing from `format/`).

**Bytes.** Signed bytes move only on a new record that passes `routing` or `definitionHash`, or whose trace carries a load span. A record packaged without them has the same bytes: the three existing golden fixtures do not move, and the two pinned ones keep their sha256. One new golden, `in-loop-golden.json`, holds a record of an in-loop run byte for byte.
