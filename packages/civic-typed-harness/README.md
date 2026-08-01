# civic-typed-harness

The civic **domain harness** for [Typed Standards](../../docs/architecture/typed-standards-specification.md) evidence packages — the DOMAIN side of the format/domain line drawn in [ADR-0021](../../docs/adr/0021-produce-core-extraction.md), relocated from the reference app as an installable package ([ADR-0022](../../docs/adr/0022-civic-typed-harness-packaging.md)). The operating rule: **the harness derives, the core assembles** — everything here produces domain-derived values (civic vocabulary terms, datHere policy fields, provenance graphs, capture artifacts) that feed [`@typedstandards/produce-core`](https://www.npmjs.com/package/@typedstandards/produce-core)'s neutral envelope assembly.

> **Working name.** `civic-typed-harness` is the working name (sprint G0 decision); the final npm name/scope is deferred to the project's naming taxonomy and only gates *publishing*, not this code. The package is `private: true` and is **not published to npm** — it will publish when the reference app is ready to consume it (S3).

## What's inside

| Module group | Modules | What it is |
|---|---|---|
| **`src/format/`** — the civic format-extension | `vocabulary.ts`, `sources.ts`, `dathere.ts`, `profiles.ts` | What extends the *standard*: the `civic:` JSON-LD namespace and `urn:civic-evidence:` id scheme, the civic source registry, the datHere envelope-policy derivations (producerProfile, canonicalization rule, summary emission, environment extension), and the captureMethod vocabulary surface. |
| **`src/capture/`** — the capture machinery | `trace.ts`, `skill-metadata.ts`, `data-sources.ts`, `provenance.ts` | What *produces* under it: the OTel `TraceBuilder`, skill-metadata extraction, data-source population, and the provenance **builder** — which imports its vocabulary from the format group and walks the trace. |
| **`src/rubric/`** — the adversarial rubric | `adversarial-eval-core.ts` | The civic six-criterion evaluation rubric (pure core: rubric text, pinned version hash, prompt builder, response parser). The model runner and result emission stay implementation-side. |

**The internal boundary is load-bearing:** no capture module defines vocabulary, and no format-extension module walks a trace — this sentence reserves a future split of the format-extension group into its own package (a civic extension *of Typed Standards*, distinct from the civic *harness* proper) as a mechanical move rather than a re-partition. The boundary is enforced by `src/purity.test.ts`.

## Config, not constants

Every value that names a deployment is a **typed config input**, with the civicaitools.org demo values exported as overridable defaults:

| Value | Config type | Demo default export |
|---|---|---|
| Platform-agent identity/URL | `PlatformAgentConfig` | `CIVICAITOOLS_PLATFORM_AGENT` |
| MCP source registry (server URLs, catalog types, display names) | `CivicSourceRegistry` | `CIVIC_SOURCE_REGISTRY` |
| Tool-name → source-id resolver | `ToolSourceResolver` | `civicToolSourceResolver` |
| Environment-extension `host` | `DatHereEnvironmentConfig` | `CIVICAITOOLS_ENVIRONMENT_CONFIG` |
| Trace `service.name` / scope identity | `TraceBuilderConfig` | `CIVICAITOOLS_TRACE_CONFIG` |
| Provenance build (all of the above + model-agent description) | `ProvenanceConfig` | `CIVICAITOOLS_PROVENANCE_CONFIG` |

## Purity contract (harness-grade)

No I/O, no network, no environment reads, no Node built-ins, browser-safe — anywhere in the package. Clock and RNG are permitted **in capture modules only** (span timestamps and ids are what capture *is*) and are injectable for deterministic tests. Enforced mechanically twice: `eslint.config.mjs` (`no-restricted-imports` / `-globals` / `-properties` / `-syntax`) and `src/purity.test.ts` (browser-safety + determinism + module-boundary checks under `node --test`).

Runtime dependency: **`@typedstandards/produce-core` only.** `@typedstandards/verify-core` arrives transitively through it (pinned by produce-core's own dependency) and is imported directly for the primitives produce-core does not re-export (`sha256Hex`, `isBlobRef`, the canonicalization-rule URIs, the Q32 vocabulary table) — one hashing implementation across producer, harness, and verifier by construction.

> **Q32 adjacency** (open-questions registry): the captureMethod vocabulary re-exported from `src/format/profiles.ts` is verify-core's hardcoded fallback table, pending versioned, content-addressed guidance bundles. Flagged, not solved, here.

## Byte-compatibility

The port is tested for **byte parity** against golden outputs captured from the reference implementation (`src/__fixtures__/website-golden.json`): with the demo default config, `buildProvenanceGraph` and `buildDataSources` reproduce the app's output byte-for-byte, and `RUBRIC_VERSION_SHA256` is asserted against the exact reference digest (moving the rubric changes no hashes). Full fixture-level byte-compat against produce-core's `reference-golden.json` and the produce→verify composition round-trip land in the next sprint phase.

## Develop

```bash
npm install          # from the repo root (npm workspaces)
npm test  --workspace civic-typed-harness
npm run lint  --workspace civic-typed-harness
npm run build --workspace civic-typed-harness
```
