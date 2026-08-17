# @typedstandards/civic-typed-harness

The civic **domain harness** for [Typed Standards](../../docs/architecture/typed-standards-specification.md) evidence packages — the DOMAIN side of the format/domain line drawn in [ADR-0021](../../docs/adr/0021-produce-core-extraction.md), relocated from the reference app as an installable package ([ADR-0022](../../docs/adr/0022-civic-typed-harness-packaging.md)). The operating rule: **the harness derives, the core assembles** — everything here produces domain-derived values (civic vocabulary terms, datHere policy fields, provenance graphs, capture artifacts) that feed [`@typedstandards/produce-core`](https://www.npmjs.com/package/@typedstandards/produce-core)'s neutral envelope assembly.

> **Name.** The package landed in-repo under the working name `civic-typed-harness` with the final npm name deferred (ADR-0022 §B). It publishes as **`@typedstandards/civic-typed-harness`** — the standard's scope with the full layer-3 basename; the rationale, the alternatives scored, and the named reversal condition are recorded in the planning-side naming memo and summarized in the [ADR-0022 addendum](../../docs/adr/0022-civic-typed-harness-packaging.md#addendum-2026-08-02--final-npm-name).

## What's inside

| Module group | Modules | What it is |
|---|---|---|
| **`src/format/`** — the civic format-extension | `vocabulary.ts`, `sources.ts`, `dathere.ts`, `profiles.ts` | What extends the *standard*: the `civic:` JSON-LD namespace and `urn:civic-evidence:` id scheme, the civic source registry, the datHere envelope-policy derivations (producerProfile, canonicalization rule, summary emission, environment extension), and the captureMethod vocabulary surface. |
| **`src/capture/`** — the capture machinery | `trace.ts`, `skill-metadata.ts`, `data-sources.ts`, `provenance.ts` | What *produces* under it: the OTel `TraceBuilder`, skill-metadata extraction, data-source population, and the provenance **builder** — which imports its vocabulary from the format group and walks the trace. |
| **`src/rubric/`** — the adversarial rubric | `adversarial-eval-core.ts` | The civic six-criterion evaluation rubric (pure core: rubric text, pinned version hash, prompt builder, response parser). The model runner and result emission stay implementation-side. |

**The internal boundary is load-bearing:** no capture module defines vocabulary, and no format-extension module walks a trace — this sentence reserves a future split of the format-extension group into its own package (a civic extension *of Typed Standards*, distinct from the civic *harness* proper) as a mechanical move rather than a re-partition. The boundary is enforced by `src/purity.test.ts`.

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

## Purity contract (harness-grade)

No I/O, no network, no environment reads, no Node built-ins, browser-safe — anywhere in the package. Clock and RNG are permitted **in capture modules only** (span timestamps and ids are what capture *is*) and are injectable for deterministic tests. Enforced mechanically twice: `eslint.config.mjs` (`no-restricted-imports` / `-globals` / `-properties` / `-syntax`) and `src/purity.test.ts` (browser-safety + determinism + module-boundary checks under `node --test`).

Runtime dependency: **`@typedstandards/produce-core` (`^0.2.0`) only.** The verify-core primitives the harness consumes (`sha256Hex`, `isBlobRef`, the canonicalization-rule URIs, the Q32 vocabulary table, the `CaptureMethod` type) are reached through produce-core's 0.2.0 re-exports rather than imported from `@typedstandards/verify-core` directly — one declared dependency, no phantom, and still one hashing implementation across producer, harness, and verifier by construction (produce-core re-exports the same bindings verify-core defines, verified by reference identity).

> **Q32 adjacency** (open-questions registry): the captureMethod vocabulary re-exported from `src/format/profiles.ts` is verify-core's hardcoded fallback table, pending versioned, content-addressed guidance bundles. Flagged, not solved, here.

## Byte-compatibility

The port is tested for **byte parity** against golden outputs captured from the reference implementation (`src/__fixtures__/website-golden.json`): with the reference config passed explicitly, `buildProvenanceGraph` and `buildDataSources` reproduce the app's output byte-for-byte, and `RUBRIC_VERSION_SHA256` is asserted against the exact reference digest (moving the rubric changes no hashes). Fixture-level byte-compat against produce-core's `reference-golden.json` (`src/golden-reproduction.test.ts`) and the produce→verify composition round-trip (`src/composition-roundtrip.test.ts`) landed in S2 P2 and run with the suite.

## Develop

```bash
npm install          # from the repo root (npm workspaces)
npm test  --workspace @typedstandards/civic-typed-harness
npm run lint  --workspace @typedstandards/civic-typed-harness
npm run build --workspace @typedstandards/civic-typed-harness
```
