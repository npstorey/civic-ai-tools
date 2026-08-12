# Architectural Decision Records

Numbered, immutable records of settled project decisions — each documents one decision, its context, and its consequences; later ADRs supersede or refine earlier ones by reference rather than by editing them.

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-roadmap-governance.md) | Public-roadmap governance | Accepted |
| [0002](0002-commitments-vs-targets.md) | Trust commitments vs. operational targets | Accepted |
| [0003](0003-evidence-capture-method.md) | Capture-method differentiation for evidence packages | Accepted |
| [0004](0004-dathere-captureMethod-variant.md) | `datHere` content profile — A-G envelope, deterministic notebook, cross-host commitment view | Accepted |
| [0005](0005-executed-notebook-architecture.md) | Executed-notebook architecture for the `datHere` content profile | Proposed |
| [0006](0006-producer-profile-architecture.md) | Producer Profile architecture — subtypes / flavors and the production-process attestation reframe | Proposed |
| [0007](0007-content-canonicalization.md) | `contentCanonicalization` — sixth envelope field naming the off-log content canonicalization rule | Proposed |
| [0008](0008-multihash-content-hash.md) | Multihash `contentHash` + RFC 8785 JCS envelope canonicalization | Proposed |
| [0009](0009-unified-typed-attestation-primitive.md) | Unified typed-attestation primitive — one structural envelope, two top-level type families | Proposed |
| [0010](0010-visibility-lifecycle-location-attestations.md) | Visibility, lifecycle, and location as attestations | Proposed |
| [0011](0011-capturemethod-generalization.md) | captureMethod generalization — open enum at core, per-profile vocabulary | Proposed |
| [0012](0012-typed-standards-consolidation.md) | Consolidate OES + CCV under the Typed Standards umbrella — `ts:` namespace, `typed-publisher.json` well-known path, CC BY 4.0 spec license | Proposed |
| [0013](0013-verification-rendering-delegation.md) | Verification rendering — glance in-page, full detail delegated to a neutral client-side verifier | Accepted |
| [0014](0014-evidence-system-fork-resolution-path-b.md) | Resolve the evidence-system fork toward Path B (domain-neutral), realized spec-first via Typed Standards | Accepted |
| [0015](0015-adversarial-eval-publication-gate.md) | Adversarial-evaluation publication gate — host policy + default-on, presence-based | Proposed (implementation shipped; flips to Accepted on review) |
| [0016](0016-vcs-native-lifecycle-mapping.md) | Mapping the lifecycle/visibility model onto a VCS-native evidence-notebook workflow | Accepted (2026-06-15) |
| [0017](0017-ipr-posture-dco-rf-statement.md) | IPR posture — DCO inbound + maintainer royalty-free patent statement, as a pre-RFC gate | Accepted (2026-07-07) |
| 0018 | Number skipped; no record exists (gap noted 2026-08-09). | — |
| [0019](0019-reference-app-posture.md) | Reference-application product posture — open-source, demo-hostable, fork-first ("Postgres, not Heroku") | Accepted (2026-07-31) |
| [0020](0020-instance-key-custody.md) | Key custody for instances (Q56) — per-instance keys with an intentional unsigned dev tier | Accepted (2026-07-31) |
| [0021](0021-produce-core-extraction.md) | Producer-side core extraction (`@typedstandards/produce-core`) and the format/domain line (Q59) | Accepted (2026-07-31) |
| [0022](0022-civic-typed-harness-packaging.md) | Civic-harness packaging — npm workspaces and the first package in the hub repo | Accepted (2026-08-01) |
| [0023](0023-notebook-executor-driver.md) | Notebook executor as a driver interface — Vercel Sandbox default, local container-runner as the portable shape | Accepted (2026-08-05) |
| [0024](0024-evidence-path-configuration.md) | Configuration that reaches signed output is absent-or-error, never defaulted | Accepted (2026-08-12) |
