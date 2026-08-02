# Changelog — @typedstandards/civic-typed-harness

Factual record of what changed per published version. Section references are
to the Typed Standards specification unless noted otherwise.

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
