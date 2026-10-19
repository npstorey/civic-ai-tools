# @typedstandards/civic-typed-harness

The civic **domain harness** for [Typed Standards](../../docs/architecture/typed-standards-specification.md) record packages — the DOMAIN side of the format/domain line drawn in [ADR-0021](../../docs/adr/0021-produce-core-extraction.md), relocated from the reference app as an installable package ([ADR-0022](../../docs/adr/0022-civic-typed-harness-packaging.md)). The operating rule: **the harness derives, the core assembles** — everything here produces domain-derived values (civic vocabulary terms, datHere policy fields, provenance graphs, capture artifacts) that feed [`@typedstandards/produce-core`](https://www.npmjs.com/package/@typedstandards/produce-core)'s neutral envelope assembly.

> **Name.** The package landed in-repo under the working name `civic-typed-harness` with the final npm name deferred (ADR-0022 §B). It publishes as **`@typedstandards/civic-typed-harness`** — the standard's scope with the full layer-3 basename; the rationale, the alternatives scored, and the named reversal condition are recorded in the planning-side naming memo and summarized in the [ADR-0022 addendum](../../docs/adr/0022-civic-typed-harness-packaging.md#addendum-2026-08-02--final-npm-name).

## What's inside

| Module group | Modules | What it is |
|---|---|---|
| **`src/format/`** — the civic format-extension | `vocabulary.ts`, `sources.ts`, `dathere.ts`, `profiles.ts` | What extends the *standard*: the `civic:` JSON-LD namespace and `urn:civic-record:` id scheme (both in two eras — new emissions mint the settlement-era terms, the prior-era terms stay exported and reproducible because they are frozen inside already-signed records; spec Appendix J), the civic source registry, the datHere envelope-policy derivations (producerProfile, canonicalization rule, summary emission, environment extension), and the captureMethod vocabulary surface. |
| **`src/capture/`** — the capture machinery | `trace.ts`, `skill-metadata.ts`, `run-attributes.ts`, `data-sources.ts`, `provenance.ts`, `load-span.ts` | What *produces* under it: the OTel `TraceBuilder`, skill-metadata extraction, run-attribute extraction (`extractRunAttributes`), data-source population, the provenance **builder**, which walks the trace, and the load span's test and refusal (`LoadSpanError`, exported through the civic layer). Capture imports no module from outside `src/capture/`; its one import beyond it is the `@typedstandards/produce-core` package. The vocabulary, the term names, the source registry and their defaults arrive as parameters, and capture defines no deployment value (it exports no `const`). |
| **`src/civic/`** — the civic defaults over capture | `data-sources.ts`, `provenance.ts`, `run-servers.ts`, `trace.ts` | The package's `buildDataSources`, `resolveToolSource` and `buildProvenanceGraph`, with `DataSourceOptions`, `ProvenanceConfig` and `CIVICAITOOLS_PROVENANCE_CONFIG`: they pass the format group's vocabulary, terms and registry to the capture builders and apply the civic defaults. Also `withRunServerAddresses` and the reference deployment's trace identity, `CIVICAITOOLS_TRACE_CONFIG`. |
| **`src/rubric/`** — the adversarial rubric | `adversarial-eval-core.ts` | The civic six-criterion evaluation rubric (pure core: rubric text, pinned version hash, prompt builder, response parser). The model runner and result emission stay implementation-side. |

**The internal boundary is load-bearing:** no capture module defines vocabulary or imports a module from outside `src/capture/` (a package import, `@typedstandards/produce-core`, is allowed), and no format-extension module walks a trace — this sentence reserves a future split of the format-extension group into its own package (a civic extension *of Typed Standards*, distinct from the civic *harness* proper) as a mechanical move rather than a re-partition. The boundary is enforced by `src/purity.test.ts`.

## Config, not constants — and required, never defaulted

Every value that names a deployment is a **required typed config input**. As of 0.2.0 the harness never applies a deployment identity on a caller's behalf: a call that omits the config **fails typecheck** ([ADR-0024](../../docs/adr/0024-evidence-path-configuration.md)'s posture at the domain layer — configuration that reaches signed output is absent-or-error, never defaulted; the removal of the 0.1.x defaults is [civic-ai-tools#153](https://github.com/npstorey/civic-ai-tools/issues/153)). The `CIVICAITOOLS_*` exports are the civicaitools.org **reference deployment's values** — the reference app passes them explicitly; any other instance supplies its own.

| Identity-bearing input | Config type | Reference-value export |
|---|---|---|
| Platform-agent identity/URL | `PlatformAgentConfig` (`ProvenanceConfig.platformAgent`) | `CIVICAITOOLS_PLATFORM_AGENT` |
| MCP source registry (server URLs, catalog types, display names) | `CivicSourceRegistry` | `CIVIC_SOURCE_REGISTRY` |
| Tool-name → source-id resolver (a caller-supplied input, not a silent default) | `ToolSourceResolver` | `civicToolSourceResolver` |
| Environment-extension `host` (lands under the envelope hash) | `DatHereEnvironmentConfig` | `CIVICAITOOLS_ENVIRONMENT_CONFIG` |
| Trace `service.name` / scope identity | `TraceBuilderConfig` | `CIVICAITOOLS_TRACE_CONFIG` |
| Model-agent `dcterms:description` | `ProvenanceConfig.modelAgentDescription` (optional field) | carried in `CIVICAITOOLS_PROVENANCE_CONFIG` |
| Provenance build (platform agent + source registry + model-agent description) | `ProvenanceConfig` | `CIVICAITOOLS_PROVENANCE_CONFIG` |

`modelAgentDescription` is the one **optional** field among these: when unset, the PROV model agent carries no `dcterms:description` at all — the field is omitted from the graph (honest absence), never filled with a fallback. The `now`/`randomBytes` fields on `TraceBuilderConfig` are operational fallbacks (runtime clock/CSPRNG), not identity, and keep their intra-config defaults.

### Migrating from 0.1.x

0.1.x applied the reference deployment's identity via silent default parameters; 0.2.0 removes every such default — the breaking change is the point: a bare call that would have embedded civicaitools.org's identity in the output now fails to compile. To reproduce 0.1.x behavior byte-for-byte, pass the exported reference configs explicitly:

```ts
// 0.1.x — compiled, and silently attributed output to the reference deployment:
const graph = buildProvenanceGraph(trace, input);

// 0.2.0 — the same output, byte-identical, with the identity stated:
import { CIVICAITOOLS_PROVENANCE_CONFIG } from '@typedstandards/civic-typed-harness';
const graph = buildProvenanceGraph(trace, input, CIVICAITOOLS_PROVENANCE_CONFIG);
```

Likewise: `buildDatHereEnvironment` / `deriveDatHereEnvelopeFields` take `CIVICAITOOLS_ENVIRONMENT_CONFIG`, `new TraceBuilder(...)` takes `CIVICAITOOLS_TRACE_CONFIG`, and `isDatasetKeyedSource` / `displayNameForSource` / `formatDataSourcesSummary` take `CIVIC_SOURCE_REGISTRY`. The acceptance condition is encoded in `src/required-config.assert.ts`: reintroducing any of the removed defaults fails `npm run typecheck`.

## What a record states about its run (0.7.0, 0.9.0 and 0.10.0, [ADR-0033](../../docs/adr/0033-composed-harness-record-fields.md))

**Every call is attributed to its own source.** A tool span's source is its `mcp.source` tag; an untagged span resolves by its tool name through the resolver (`ProvenanceConfig.resolver`, default `civicToolSourceResolver`); a span neither identifies is attributed to `UNKNOWN_SOURCE_ID` (`'unknown'`), never to Socrata. The same order holds in `dataSources[]`, where an unknown call mints no entry. A caller may still pass `fallbackSourceId` explicitly, for example `'socrata'` to reproduce an earlier record of an untagged span.

**Each call states both its names, its alias and its server**, when the span carries them: `tool.upstream_name`, `mcp.alias` and `mcp.server.id` become `civic:upstreamToolName`, `civic:sourceAlias` and `civic:serverId` on the tool-call activity. `civic:toolName` stays the name the model called.

**The environment block states only what is known.** `temperature` and `toolDefinitions` are emitted only when passed (`DatHerePolicyInput.temperature`, `.toolDefinitions`; spec §8.7.1 requirement 3 as amended in v0.1.11). To reproduce a package made before 0.7.0, pass the values it recorded (`temperature: 0`, `toolDefinitions: []`); its bytes come back exactly.

**Run-time facts come from the trace.** The producer writes them on the trace's root span at run time, and `extractRunAttributes(trace)` returns them under the derivation's input names:

| Root-span attribute (JSON text unless noted) | Input | Lands in |
|---|---|---|
| `analysis.asserted_date` (plain `YYYY-MM-DD`) | `assertedDate` | `extensions["org.civicaitools.composition"].assertedDate` |
| `analysis.mcp_servers` | `runMcpServers` | `org.civicaitools.environment.mcpServers` (wins over `mcpServers` and `skillMcpServerUrl`); `withRunServerAddresses(registry, servers)` gives the graph's agents the run's addresses |
| `analysis.tool_definitions` | `toolDefinitions` | `org.civicaitools.environment.toolDefinitions` |
| `analysis.sources_offered` | `sourcesOffered` | `org.civicaitools.composition.sourcesOffered` |
| `analysis.components` | `components` | `org.civicaitools.composition.components` |
| `analysis.flows_statement` (one object, `{ url, hash, date }`) | `flowsStatement` | `org.civicaitools.composition.flowsStatement`, after `components` |
| `analysis.routing` (one object, `{ method, version }`) | `routing` | `org.civicaitools.composition.routing`, after `flowsStatement` |
| `analysis.definition_hash` (plain lowercase hex SHA-256) | `definitionHash` | `org.civicaitools.composition.definitionHash`, the block's last key |

```ts
const fields = deriveDatHereEnvelopeFields(
  { model, contentProfile, summary, extensions, ...extractRunAttributes(trace) },
  { host },
);
```

An absent attribute is an absent field. A present attribute that does not parse is refused (`RunAttributeError`), and a value outside the record's form — a date that is not a calendar date, a reason outside `configured` / `not-configured` / `selected` / `not-selected` / `reader-off` / `not-consented`, a guidance hash that is not lowercase hex SHA-256, an origin outside `endpoint` / `inline` / `fallback`, a flows statement that is not exactly an absolute `http:` or `https:` `url` with no credentials, a lowercase hex SHA-256 `hash` and a calendar `date`, a routing that is not exactly a `method` of `all-sources` / `picker` / `in-loop` and a non-empty `version`, a definition hash that is not lowercase hex SHA-256 — is refused by the derivation (`RecordFieldError`), never dropped. The `org.civicaitools.composition` block is emitted under every content profile, appended after the other extensions, and only when one of its fields is passed: a package built with none of these inputs has 0.6.0's extensions bytes, except that a datHere environment block no longer states the two placeholders.

**The reader's states and the flows statement (0.9.0, ADR-0033's 2026-10-18 amendment).** Two reasons follow the four: `reader-off` (the source was configured, and the reader turned it off) and `not-consented` (the source was configured, and the reader has given no consent for it). A source was offered exactly when its reason is `configured` or `selected`. `flowsStatement` refers to the instance's flows statement by address, hash and date, and the record never carries the statement itself. A record packaged without either has the same bytes.

**In-loop runs (0.10.0, ADR-0033's amendment 2).** `routing` states how the run's sources were chosen (`ROUTING_METHODS`: `all-sources`, `picker`, `in-loop`) and the version of the router that chose them; `definitionHash` states the hash of the run's harness definition, which the router computes and the harness only checks and states. A producer writes both only for an in-loop run, so a record packaged without them has the same bytes.

A `load_source` call is recorded as a tool span with `tool.operation_type` `load_source` and `tool.load_outcome` one of `LOAD_OUTCOMES` (`loaded`, `declined`, `no-answer`, `unavailable`, `not-offered`; `not-offered` means the alias named no source of the directory set, so nothing was loaded). The instance's loop answered it and no source did, so the graph mints no `mcp-server:` agent and no data-response entity for it, and `dataSources[]` has no entry for it (the call is skipped in place, so later calls keep their spans). Its tool-call activity is associated with the platform agent, states no `civic:sourceId`, and states the outcome under `civic:loadOutcome` (`CIVIC_TERM_LOAD_OUTCOME`). A load span with no outcome, or another value, is refused with `LoadSpanError` when the graph is built. A span with any other operation type is unchanged.

**The evaluator prompt (0.9.0, [civic-ai-tools#265](https://github.com/npstorey/civic-ai-tools/issues/265)).** `buildEvaluationPrompt` lists each `dataSources` entry by what it carries. An entry with a `datasetUrl` reads as before; an aggregate entry, which has none, reads `- <sourceId> (<catalogType>, <portalUrl>) (accessed <time>)`, where 0.8.0 printed `undefined`. `RUBRIC_VERSION_SHA256` does not move: it is the SHA-256 of the rubric text alone, and the prompt template is outside it ([civic-ai-tools#207](https://github.com/npstorey/civic-ai-tools/issues/207), open).

## Purity contract (harness-grade)

No I/O, no network, no environment reads, no Node built-ins, browser-safe — anywhere in the package. Clock and RNG are permitted **in capture modules only** (span timestamps and ids are what capture *is*) and are injectable for deterministic tests. Enforced mechanically twice: `eslint.config.mjs` (`no-restricted-imports` / `-globals` / `-properties` / `-syntax`) and `src/purity.test.ts` (browser-safety + determinism + module-boundary checks under `node --test`).

Runtime dependency: **`@typedstandards/produce-core` (`^0.9.0`) only.** The verify-core primitives the harness consumes (`sha256Hex`, `isBlobRef`, the canonicalization-rule URIs, the Q32 vocabulary table, the `CaptureMethod` type) are reached through produce-core's 0.2.0 re-exports rather than imported from `@typedstandards/verify-core` directly — one declared dependency, no phantom, and still one hashing implementation across producer, harness, and verifier by construction (produce-core re-exports the same bindings verify-core defines, verified by reference identity).

> **Q32 adjacency** (open-questions registry): the captureMethod vocabulary re-exported from `src/format/profiles.ts` is verify-core's hardcoded fallback table, pending versioned, content-addressed guidance bundles. Flagged, not solved, here.

## Byte-compatibility

The port is tested for **byte parity** against golden outputs captured from the reference implementation (`src/__fixtures__/website-golden.json`): with the reference config passed explicitly, `buildProvenanceGraph` and `buildDataSources` reproduce the app's output byte-for-byte, lifted over the two behaviours the harness has deliberately changed since (the #205 address fallback in 0.5.0 and the fallback attribution in 0.7.0, each a named transform of the frozen bytes with its node count asserted; both frozen fixtures' sha256 is asserted by `src/frozen-fixtures.test.ts`), and `RUBRIC_VERSION_SHA256` is asserted against the exact reference digest (moving the rubric changes no hashes). Both captured fixtures predate the 2026-08-19 vocabulary settlement, so their byte-parity legs run with `PRIOR_ERA_CIVIC_VOCABULARY` injected — the fixtures are never rewritten — beside a settlement-era leg asserting the same bytes with exactly the two Appendix J literals substituted. Fixture-level byte-compat against produce-core's `reference-golden.json` (`src/golden-reproduction.test.ts`) and the produce→verify composition round-trip (`src/composition-roundtrip.test.ts`) landed in S2 P2 and run with the suite. One more golden is this repository's own output, not a reference capture: `src/__fixtures__/in-loop-golden.json` holds a record of an in-loop run (routing, the definition hash, one load span and one data call) byte for byte, beside structural assertions in `src/in-loop-golden.test.ts`.

## Develop

```bash
npm install          # from the repo root (npm workspaces)
npm test  --workspace @typedstandards/civic-typed-harness
npm run lint  --workspace @typedstandards/civic-typed-harness
npm run build --workspace @typedstandards/civic-typed-harness
```
