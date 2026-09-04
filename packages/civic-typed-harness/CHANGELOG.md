# Changelog — @typedstandards/civic-typed-harness

Factual record of what changed per published version. Section references are
to the Typed Standards specification unless noted otherwise.

## Unreleased

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
