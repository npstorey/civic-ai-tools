# ADR-0021: Producer-side core extraction (`@typedstandards/produce-core`) and the format/domain line (Q59)

- **Status:** **Proposed** — drafted 2026-07-31 by an orchestration session per Stream 1 of the civic-data-analysis stack program; decision pending maintainer review. On acceptance, [Q59](../architecture/open-questions.md#q59--producer-side-core-no-portable-counterpart-to-verify-core) resolves via its option (a), contingent on the demonstration named in §Consequences.
- **Date:** 2026-07-31 (draft)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0019](0019-reference-app-posture.md) (Decision 6's two adoption layers — this ADR builds out the package layer's producer half), [ADR-0020](0020-instance-key-custody.md) (per-instance key custody — the caller-supplies-the-key contract is this core's signing API), [ADR-0008](0008-multihash-content-hash.md) (the envelope-hash → signature chain the core implements), [ADR-0009](0009-unified-typed-attestation-primitive.md) (the attestation family the core's second builder emits)

*Numbering note: 0018 remains reserved for the roadmap-governance amendment; 0019/0020 are taken (confirmed against `origin/main` at drafting time).*

## Context

[Q59](../architecture/open-questions.md#q59--producer-side-core-no-portable-counterpart-to-verify-core) registers the consume/produce asymmetry: the project ships a portable, browser-safe, I/O-free core for *verifying* packages (`@typedstandards/verify-core` v0.7.0) and nothing equivalent for *producing* them — a third party can independently check our output but cannot independently emit conformant output without copying application internals. Its resolution criteria offer two legitimate paths: **(a)** extract and publish a produce-side core such that an independent implementation demonstrably emits packages that verify under spec §9.2 without depending on the reference application, or **(b)** record that producing is an application concern and scope the spec's interoperability claim to verification.

Three things have changed since Q59 was registered:

1. **The posture decisions landed.** [ADR-0019](0019-reference-app-posture.md) (accepted 2026-07-30) names two adoption layers, with the *importable-package* layer primary; [ADR-0020](0020-instance-key-custody.md) (accepted 2026-07-31) resolves instance key custody as per-instance keys with an intentional unsigned dev tier — which fixes the producer core's signing contract: the caller/config supplies the key; the core signs with what it is given.
2. **A prospective adopter's pull exists.** The stack program's forcing function — a prospective adopter standing up an instance on a standard cloud/container stack — makes an installable producer load-bearing rather than speculative, satisfying the Xanadu gate. Q59's own closing note names the correctness stake: a fork that diverges while continuing to emit packages under the standard makes format compatibility rest on discipline rather than on a pinned dependency.
3. **The extraction path was verified module-by-module** (2026-07-31, all 19 modules of `civic-ai-tools-website/src/lib/evidence/`): the pure half already exists — `canonicalization.ts`, `profiles.ts`, and `blob-ref.ts` are one-line re-export shims over the published verify-core, so producer and verifier already share one hashing implementation; env/config reads in the producer path are confined to `signing.ts` (`EVIDENCE_KEY_ID` :69, `EVIDENCE_SIGNING_KEY` :136) plus hardcoded identity/registry constants (`signing.ts:25, 48–52`; `commitment.ts:44–53`); and I/O is confined to four orchestration modules (`lifecycle`, `publication`, `committed-access`, `adversarial-eval`) plus the TSA/Rekor `fetch` legs (`signing.ts:165–170, 239–244`) — exactly as Q59's registry entry predicted.

## Decision

### A. Extract `@typedstandards/produce-core` beside `verify-core`

A new package `packages/produce-core` in the `typedstandards` monorepo, published as `@typedstandards/produce-core`: the format-neutral, I/O-free producer counterpart to `verify-core`. It contains:

- **Envelope assembly** for `content/*` nodes — the format-shaped body of `buildEvidencePackage` (`packager.ts:412–509`) with its byte-compatibility discipline (conditional spreads; the v0.1 `type` discriminator; `contentHash` computed from the base object and spread last; the shared envelope hash) and the `EvidencePackage` type (`packager.ts:162–263`).
- **Attestation assembly** for `attestation/*` nodes — `buildAttestationNode` (`attestation.ts:164–224`) plus the §8.12.1 emittable sub-type constants and methodology/results payload types (`attestation.ts:47–79`).
- **The signing mechanism** — Ed25519ph over the UTF-8 bytes of the envelope-hash hex string per spec §8.3.1 (`signing.ts:142–153`), with key material *passed in* (raw seed or PKCS8 DER; the `node:crypto` key handling at `signing.ts:98–123` re-implemented on the small-ASN.1-reader pattern verify-core's `asn1.ts` established), and SPKI/PEM helpers (`signing.ts:190–198`).
- **Pure external-proof codecs** — the RFC 3161 `TimeStampReq` DER builder (`signing.ts:270–307`), the Rekor `hashedrekord` v0.0.1 proposal body (`signing.ts:225–237`) and response parser (`signing.ts:252–263`). **No network submission in the package** — submission is implementation-side (see §Considered).
- **A neutral commitment-view builder** — the spec §8.8.1 sidecar shape (`commitment.ts:173–229`) built from caller-supplied proof fields, with `trustRegistryUrl` as caller config, never a constant.
- **Generic PROV-O types** (`provenance.ts:12–21`) and context/node helpers — the graph *mechanics*, not the graph *content*.

### B. The format/domain line (normative for the extraction)

The core is **format-neutral and I/O-free**; the boundary is drawn at the function level where modules mix:

| Travels to `produce-core` (FORMAT) | Stays in the civic harness (DOMAIN) | Stays in the implementation (I/O / config) |
|---|---|---|
| Envelope + attestation assembly; canonicalization/hashing via verify-core; Ed25519ph mechanism; RFC 3161 / Rekor codecs; §8.8.1 sidecar builder; generic PROV-O types; `SignerIdentity` / `SignResult` / `DataSourceEntry` field types | The `civic:` JSON-LD namespace and `urn:civic-evidence:` scheme (`provenance.ts:51, 387`); the datHere derivations (`packager.ts:26, 286–322, 393–395, 407–410, 464–466, 477–484`); capture machinery — OTel `TraceBuilder` (`trace.ts:81–199`), span-walking data-source extraction (`data-sources.ts:130–185`), skill extraction (`packager.ts:303–322`); the adversarial rubric (`adversarial-eval-core.ts`) | DB/blob/auth/model orchestration (`lifecycle.ts`, `publication.ts`, `committed-access.ts`, `adversarial-eval.ts`); TSA/Rekor submission (`signing.ts:159–183, 216–268`); the trust-registry loader (`verify.ts:53–124`); per-instance constants — signer identity (`signing.ts:48–52`), kid default (`signing.ts:25`), registry URLs (`commitment.ts:44–53`), publication host (`publication.ts:36`) |

The operating rule that keeps assembly byte-identical while the core stays civic-blind: **the harness derives, the core assembles.** Values the app currently derives inline (producerProfile from the content profile, the datHere canonicalization rule, the summary-emission decision, the environment extension) arrive at the core as explicit envelope-field inputs; `captureMethod` / `contentProfile` / `producerProfile` are opaque strings to the core — their vocabularies are profile-governed (spec §8.6), not core-encoded.

### C. `produce-core` depends on `@typedstandards/verify-core`

The core's only runtime dependency. This is load-bearing, not convenience: canonicalization and hashing stay single-sourced, so a producer and a verifier *cannot* disagree on an envelope hash — the same argument the reference app's in-repo shims already make, promoted to the package layer. Dependency budget is thereby verify-core's own (its three pure deps arrive transitively); the purity contract is enforced the same way (ESLint `no-restricted-imports` on `node:*`/`process`/`fs`/`path`; a browser-safety test; `sideEffects: false`).

### D. Determinism inputs are caller-supplied

`packageId`, `createdAt`, and `signingKeyId` are arguments, not internal `randomUUID()`/`new Date()`/env reads (today at `packager.ts:335–336, 417` and `attestation.ts:167, 176–177`). This is what makes byte-golden fixtures — the refactor-safety bar for later re-pointing the reference app — possible.

### E. The unsigned tier is first-class

Per ADR-0020 Decisions B/C: not signing is a legitimate result — a complete package with an envelope hash and no signature — and nothing in the core may label an unsigned result `sealed` or `public`. The core has no env probe and no warn-and-null fallback (`signing.ts:135–140` stays behind in the app); the caller's decision not to call the signing function *is* the unsigned tier.

### F. Q59 resolves via option (a)

On acceptance and completion of the §Consequences demonstration, the registry entry moves to the resolution log: the spec's interoperability claim extends to producing, backed by a pinned dependency rather than discipline.

## Considered and rejected

- **Q59 option (b) — record producing as an application concern.** Legitimate per the registry entry, but wrong now: the package-first program needs an installable producer, adopter pull exists, and the divergent-fork correctness risk in Q59's notes is real. Option (b) was the right answer only while extraction lacked a consumer.
- **Fold the producer into `verify-core` (one package).** Rejected: the browser verifier deployment should not carry signing and key-handling surface it never calls; the two cores version independently (a verifier bugfix should not force producer consumers to re-vet a signing-path change); and the consume/produce asymmetry is clearer, not blurrier, as two packages with an explicit dependency arrow.
- **Extract a full "reference producer" including the datHere/civic profile behavior.** Rejected: it would move the domain layer into the format package, exactly the line this ADR exists to hold. The civic harness (Stream 2) owns the derivations; a fork bringing its own domain brings its own.
- **Ship TSA/Rekor submission helpers (injected `FetchLike`) now.** Deferred, not precluded: verify-core's injection pattern is the sanctioned escape hatch, but no second consumer has asked for submission helpers, and the pure codecs already carry the format knowledge. Xanadu: extract what a real second producer needs.

## Consequences

- **Acceptance bar (the Q59(a) demonstration).** A test or walkthrough inside `typedstandards`, depending on no reference-application code, builds and signs a package with a test key and test registry that `verify-core` passes under §9.2 (checks #1–#6, #11–#15 offline; the RFC 3161/Rekor codecs round-tripped against verify-core's parsers). Byte-compatibility is proven with golden fixtures captured from the reference app's packager/attestation tests.
- **The reference app becomes a consumer (Stream 3).** Re-pointing `civic-ai-tools-website` at the published package rides the stack program's S3 alongside the parameterizations ADR-0020 already names (signer identity, kid, registry URLs, publication host) and the reconciliation of the as-built unsigned-committed path (ADR-0020 §Consequences). No app behavior change rides the extraction PR itself.
- **The civic harness relocation (Stream 2)** picks up the domain side of the line: the `civic:` vocabulary, datHere derivations, and capture machinery move from the app to `civic-ai-tools`; the harness builds its provenance graph with the core's generic types and hands the finished value to envelope assembly.
- **Spec §9.1 mapping.** The core covers the format-mechanism halves of the conformant-publisher definition (canonical JSON + envelope hash, §9.1.2–3's signing chain) while custody, storage, lifecycle honoring, and preamble surfaces (§9.1.3–6) remain publisher/implementation obligations — the spec text needs no change for this ADR.
- **Conformance-suite interaction (Q16).** An extracted producer sharpens Q16's target: the produce→verify round-trip in the monorepo is the seed of a conformance corpus for independent *producers*, a different target than independent verifiers.
- **Signing-construction note.** The core carries §8.3.1's construction byte-for-byte (no domain-separation tag; an implicitly empty domain). The registered open question on domain separation (Q61, registration in flight on the registry branch) is *inherited* by produce-core — whichever way it resolves, the change lands in one package instead of N applications, which is part of this extraction's point.
- **Registry updates on acceptance:** Q59 → resolution log (option (a), pending-demonstration noted until the package ships); the Q59 entry's module inventory becomes historical.

## References

- [Q59](../architecture/open-questions.md#q59--producer-side-core-no-portable-counterpart-to-verify-core) — the registered asymmetry this ADR resolves.
- [ADR-0019](0019-reference-app-posture.md) — two adoption layers; the package layer this ADR builds out.
- [ADR-0020](0020-instance-key-custody.md) — per-instance keys + unsigned dev tier; the core's signing contract and unsigned-tier semantics.
- [ADR-0008](0008-multihash-content-hash.md), [ADR-0009](0009-unified-typed-attestation-primitive.md) — the envelope-hash/signature chain and attestation family the core implements.
- Typed Standards Specification §8.2 (canonicalization), §8.3 (cryptographic envelope), §8.8 (commitment view), §8.12 (attestation sub-types), §9.1–§9.2 (conformance and the check list).
- `@typedstandards/verify-core` — the shipped precedent whose purity/browser-safety discipline this package inherits, and its dependency.
- Stream 1 brief (planning-side): `stream1-produce-core-brief.md` — the full file:line-cited module partition, API sketch, and IMPL handoff behind this decision.
