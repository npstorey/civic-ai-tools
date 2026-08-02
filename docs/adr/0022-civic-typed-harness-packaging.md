# ADR-0022: Civic-harness packaging — npm workspaces and the first package in the hub repo

- **Status:** **Accepted** 2026-08-01 (maintainer review, post-merge of #117)
- **Date:** 2026-08-01 (decision; drafted the same day by the S2 P1 implementation session, riding its PR per the sprint's G0 decision 1)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0021](0021-produce-core-extraction.md) (the format/domain line — this ADR lands the DOMAIN side of that line as a package), [ADR-0019](0019-reference-app-posture.md) (the importable-package adoption layer, now extended to the civic domain), [ADR-0020](0020-instance-key-custody.md) (the parameterization posture the harness's config-not-constants rule implements at the domain layer)

*Numbering note: 0018 remains reserved for the roadmap-governance amendment; 0019–0021 are taken (confirmed against the working tree at drafting time).*

## Context

ADR-0021 §B drew the format/domain line and deliberately left the DOMAIN column behind in the reference app: the `civic:` vocabulary and `urn:civic-evidence:` scheme, the datHere derivations, and the capture machinery (TraceBuilder, span-walking extraction, data-source population, the adversarial rubric core). Its §Consequences named the follow-through: *"the civic harness relocation (Stream 2) picks up the domain side of the line."* This ADR records the packaging decisions that relocation forces on the hub repo.

`civic-ai-tools` has until now been a starter/docs repo — MCP configs, skill docs, setup scripts, the architecture documents, and the specification's canonical home. Landing the harness as *code* makes it what the stack program plan calls it: the civic-domain-harness spec + method, with the code to match. That is a purpose expansion for a public repo, worth a decision record.

## Decision

### A. npm workspaces at the repo root; `packages/civic-typed-harness` is the first (and only) package

The root `package.json` gains `workspaces: ["packages/*"]` and stays `private: true`. The harness is the only package this decision introduces; nothing else in the repo moves into a package. The relocation is **purely additive**: the reference app keeps its in-repo copies until the S3 re-point migrates it onto `produce-core` + the harness in one move.

### B. Working name, publish deferred

The package's working name is **`civic-typed-harness`** (sprint G0 decision 2, adopting the layering sketch's layer-3 name). The final npm name/scope is deferred to the project's naming taxonomy and gates only *publishing*, not the code landing. **No npm publish this sprint** (G0 decision 3): the package is `private: true` and publishes when S3 is ready to consume both packages together, avoiding naming churn on the registry.

### C. One package, two module groups — the boundary is the hedge

Internally the package holds two cleanly separated module groups plus a small third:

- **format-extension** (`src/format/`) — what extends the *standard*: the `civic:` vocabulary and id scheme, the civic source registry, the datHere policy derivations, the captureMethod vocabulary surface (re-exported from verify-core's Q32 fallback table — flagged, not solved).
- **capture** (`src/capture/`) — what *produces* under it: TraceBuilder, skill-metadata extraction, data-source population, and the provenance *builder*, which imports its vocabulary from the format-extension group.
- **rubric** (`src/rubric/`) — the adversarial-evaluation pure core, with its Q26-pinned `RUBRIC_VERSION_SHA256` preserved byte-exactly across the move.

The boundary is normative and mechanically enforced (purity test): no capture module defines vocabulary; no format-extension module walks a trace. Rationale: the naming-taxonomy input distinguishes a civic extension *of Typed Standards* from the civic *harness* proper — holding the boundary now makes that outcome a mechanical package split later instead of a re-partition, at near-zero present cost.

### D. Harness-grade purity; config-not-constants

The package carries verify-core/produce-core's purity discipline one notch looser, as the domain layer requires: no I/O, no environment reads, no Node built-ins, browser-safe — everywhere; clock + RNG **in capture modules only** (timestamps and span ids are what capture *is*), injectable for tests. Enforced the same way as the cores: ESLint restricted-imports/globals plus a dependency-free purity test.

Every value naming a deployment — platform-agent identity/URL, MCP server URLs, the environment-extension `host`, trace `service.name` — is a typed config input with the civicaitools.org demo values as exported defaults. This is where S2 meets the ADR-0020/S3 parameterization set: the harness *accepts* instance values; it hardcodes none.

### E. Runtime dependency: `@typedstandards/produce-core` (^0.1.0) only

The harness derives; the core assembles (ADR-0021's operating rule). `verify-core` arrives transitively through produce-core's own pinned dependency and is imported directly for primitives produce-core does not re-export (`sha256Hex`, `isBlobRef`, the canonicalization-rule URIs, the Q32 vocabulary table) — producer, harness, and verifier share one hashing implementation by construction. No framework, no DB, no fetch.

## Considered and rejected

- **Keep the domain code in the app; publish only the format core.** Rejected by ADR-0021's own consequences: a prospective instance would have to copy application internals to emit civic-conformant packages — the divergent-fork risk Q59 named, reproduced one layer up.
- **Two packages now (civic extension vs capture harness).** Premature: no adopter needs them separately yet (Xanadu gate), and the naming taxonomy that would name the split is unresolved. The §C module boundary buys the same optionality at near-zero cost.
- **A separate repo for the harness.** Rejected: the hub repo already holds the civic method's docs, dataset directory, and skill guidance — S2 brings the code to where the method already lives; a third repo adds coordination surface without a consumer asking for it.
- **Publish to npm now under the working name.** Rejected (G0 decision 3): renaming a published package later costs registry churn for zero present benefit; nothing consumes the package until S3.

## Consequences

- The reference app is untouched by this decision; S3 re-points it at `produce-core` + the harness in one migration and deletes the in-repo copies.
- Byte-compatibility is the acceptance bar for the relocation: with demo-default config, the harness reproduces the reference implementation's provenance graphs, dataSources arrays, and rubric version hash byte-for-byte (golden-parity tests ride the package; full fixture-level proof against produce-core's `reference-golden.json` and the produce→verify composition round-trip are the next sprint phase).
- The repo's contributor surface grows a Node toolchain (workspaces install, `npm test --workspaces`). CI wiring for the workspace is follow-up work.
- When the naming taxonomy lands, the rename (and any §C package split) is a mechanical move; this ADR gets a companion recording the final name rather than an amendment re-arguing the shape.

## References

- [ADR-0021](0021-produce-core-extraction.md) — the format/domain line; §B's DOMAIN column is this package's contents.
- [ADR-0019](0019-reference-app-posture.md), [ADR-0020](0020-instance-key-custody.md) — the adoption-layer and parameterization posture.
- `packages/civic-typed-harness/README.md` — module map, config surface, purity contract, and the boundary sentence reserving the future split.
- Typed Standards Specification §8.6 (profile-governed vocabularies), §8.9 (PROV-O), §9.1 (conformant publisher).
- Stream 2 brief (planning-side): `stream2-civic-harness-brief.md` — the function-level partition and G0 decisions this ADR records the packaging half of.

## Addendum (2026-08-02) — final npm name

*The companion §Consequences anticipated: this records the name the deferred decision landed on. It does not re-argue §B–§E; the shape of the decision stands as written above.*

- **Final npm name: `@typedstandards/civic-typed-harness`.** `private: true` is removed, `publishConfig.access` is `public`, and the package publishes at 0.1.0. §B's "working name, publish deferred" is thereby discharged, not amended: the code landing never waited on the name, and the name now gates nothing further.
- **Rationale:** the planning-side decision memo `naming-research-harness-scope.md` (candidate C2), which scored four candidates against the two futures the project holds open — a neutral-stewardship spin-out and a brand rename. C2 is the only candidate cheap under both: it carries the *domain* word (`civic`, which also lives in the `civic:` namespace and the `urn:civic-evidence:` scheme) rather than the brand, so a brand rename does not reach it; and it is decidable without waiting on any other track. The memo also records a **named reversal condition** (migrate out of `@typedstandards`, keeping the basename, if a spin-out becomes concrete or external adoption starts compounding while that question is open) and a standing rider (register the intended civic scope defensively the moment the brand-rename track resolves — npm scopes are first-come-first-served and untransferable).
- **§C's reserved split is unaffected.** The basename survives a later scope hop, so splitting the format-extension group out remains the mechanical move §C reserved.
- **§E is superseded on the dependency-declaration mechanism only.** §E described `verify-core` being imported directly for primitives produce-core did not re-export. `@typedstandards/produce-core` 0.2.0 re-exports exactly that consumption set (`sha256Hex`, `isBlobRef`, the canonicalization-rule URIs, `PROFILE_CAPTURE_VOCAB`, `CaptureMethod`), so the harness declares **one** runtime dependency, `@typedstandards/produce-core` `^0.2.0`, and imports nothing undeclared. §E's substance is unchanged: producer, harness, and verifier still share one hashing implementation by construction — now by re-export identity rather than by transitive resolution.
