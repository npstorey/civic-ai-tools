---
Status: Historical snapshot — frozen 2026-05-26
Last updated: 2026-05-01
Maintainer: [TK: leave as placeholder]
---

> **Historical snapshot — frozen 2026-05-26.**
>
> Canonical text now lives at [`typed-standards-specification.md`](typed-standards-specification.md). The OES envelope mechanics, definitions, package structure, cryptographic envelope, trace capture, identity binding, captureMethod, datHere content profile, commitment-view schema, lifecycle / location attestations, typed-claims pointer (now realized via absorbed Civic Claim Vocabulary body), verification properties, federation, `attestation/*` namespace, and conformance sections are absorbed into the consolidated specification per [ADR-0012](../adr/0012-typed-standards-consolidation.md). Specifically:
>
> - §3 Definitions → typed-standards-specification.md §6.2 (Glossary)
> - §4 Evidence package structure → §8.1
> - §5 Canonical JSON, envelope hash, content hash → §8.2
> - §6 Cryptographic envelope → §8.3 (well-known path renamed `evidence-public-keys.json` → `typed-publisher.json`; legacy path served in parallel indefinitely)
> - §7 Trace capture → §8.4
> - §8 Identity binding → §8.5
> - §9 captureMethod + §9.1 datHere + §9.2 commitment-view + §9.3 embed-vs-reference → §8.6, §8.7, §8.8, §8.9
> - §10 Lifecycle and location attestations → §8.10
> - §11 Typed claims (pointer) → §8.11 (with the absorbed Civic Claim Vocabulary body)
> - §12 Upstream evidence references → §8.12.5 (the retired layer; obsoleted by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §8)
> - §13 Verification properties → §9 (Conformance) + §10 (Security Considerations) + §11 (Privacy Considerations)
> - §14 Federation and discoverability → §8.13
> - §15 `attestation/*` namespace → §8.12
> - §16 Conformance → §9
> - §17 Revision history → Appendix G
> - §18 Related documents → Appendix H
>
> Body preserved verbatim per [ADR-0012](../adr/0012-typed-standards-consolidation.md) §4 for historical cross-reference accuracy: existing ADRs (0003-0011) cite OES sections at the numbers and content state they were written against. New implementations and new ADRs should reference the consolidated specification instead. The "Internal working draft" status callout below reflects the file's state at the time it was being authored; it is not the file's current state.

> **Status: Internal working draft, pre-v0.1. Not for external review.**
>
> This document represents the project's current internal best-thinking on the Open Evidence Standard. It is not a stable specification. Several substantive sections depend on open questions that have not yet been resolved (see `civic-ai-tools/docs/architecture/open-questions.md`). The document is shared publicly only to make it easier for the project's small set of active collaborators to discuss specific sections; it should not be implemented against. Sections subject to pending open questions are marked inline.

---

# Open Evidence Standard

Schema version: `0.1.0`.

Conformance language follows [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) keywords (MUST, MUST NOT, SHOULD, MAY) when applied to normative requirements. Every normative requirement in this document corresponds either to a check enforced in `civic-ai-tools-website` code today or to a settled Architectural Decision Record in `civic-ai-tools/docs/adr/`. Where neither holds, the section is labeled with a `Status:` callout pointing at the relevant open question.

---

## 1. Introduction and scope

The Open Evidence Standard defines the structure, signing, and verification properties of an **evidence package**: a content-addressable, cryptographically signed record of a single AI-assisted civic-data analysis.

> ⚠ **Subject to Open Question #1 — package format.** Today, third-party verification of a published package depends on calling `civicaitools.org` server endpoints (specifically `GET /api/evidence/<slug>/verify`, which composes the package JSON with DB-resident signature + RFC 3161 token + Rekor proof). The cryptographic envelope is split between the Vercel Blob package and the Postgres `evidence_records` row. End-state verifiability — the package alone plus the public trust registry plus FreeTSA + Sigstore Rekor, with no civicaitools.org dependency — is the target shape under Open Question #1 (multi-file package format / RO-Crate compatibility profile). See §13 for the current verification surface and the target end-state.

### 1.1 What this document covers

- Required and optional fields of an evidence package as currently produced by `POST /api/evidence` and stored on Vercel Blob.
- The cryptographic envelope (Ed25519ph signature, RFC 3161 timestamp, Sigstore Rekor entry) and how it binds to package content.
- The two-kinds-of-canonicalization split — envelope-level (RFC 8785 JCS) and content-level (named per `contentCanonicalization`) — and the multihash `contentHash` shape per [ADR-0007](../adr/0007-content-canonicalization.md) + [ADR-0008](../adr/0008-multihash-content-hash.md).
- The envelope-hash, content-hash, and signature-verification rules a third-party verifier follows.
- The current vocabulary for `captureMethod` and `promptVisibility`, both enforced at the publish path.
- The withdrawal and reinstatement lifecycle (signed, public, append-only).
- The trust-registry contract for key rotation.
- Pointers to companion specs for layers under active design (typed claims, federation, identity).

### 1.2 What this document does not cover

- The architectural rationale for the layered design — see `civic-ai-tools/docs/architecture/end-state-vision.md`.
- The Civic Claim Vocabulary typed-claims layer — defined separately in `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md`. The claim vocabulary sits *on top of* this standard's evidence package; it does not modify the package's normative shape.
- The Xanadu doctrine (project discipline for how this spec is allowed to grow) — see `civic-ai-tools/docs/architecture/xanadu-doctrine.md`.
- ADR-level decision histories — see `civic-ai-tools/docs/adr/`.
- The publish API request/response details for the canonical reference implementation — see `civic-ai-tools-website/docs/api/evidence-publish.md`. That document and this one MUST stay aligned; where they diverge, this document is normative for the package shape and the API doc is normative for the request/response contract.

### 1.3 Producer-type scope

> ⚠ **Subject to Open Question #7 — producer-type scope.** Also subject to Open Question #9 (AI-specific commitments inventory and the path to generalization).

This v0.1 draft is written from the assumption that the package's analytical content is produced by an AI client (an LLM with optional MCP tool calls). The cryptographic envelope, identity binding, withdrawal lifecycle, and trust-registry semantics are producer-type-agnostic; the trace-capture and skill-metadata sections currently presuppose an AI producer. Generalization to human and hybrid producers is an open question and would land as a separate ADR plus a `producer.type` field on the package.

---

## 2. Normative preamble

Every product surface that renders evidence packages, every downstream consumer that processes them, every derived publication that cites them, and every third-party implementation of this standard MUST carry the following preamble or a clearly-equivalent statement, surfaced where readers will encounter it before forming conclusions about a package's content:

> **Corroboration ≠ truth.** Consensus can be wrong.
>
> **Contradiction ≠ falsity.** The heretic is sometimes right.
>
> **Identity strength ≠ topic authority.** A credentialed outsider can be wrong; a pseudonymous insider can be right.
>
> **The system surfaces signals; the consumer applies judgment.**

The intent is to prevent the architecture from drifting into automated truth-scoring — a regime that has historically gone badly (content moderation, credit scoring, citation metrics). Implementers MUST NOT use evidence-package signals to compute platform-issued correctness verdicts, rank-by-trust scores, or any equivalent consensus collapse. Consumer-side aggregation (citation graphs, contradiction surfacing, meta-analysis) is permitted and encouraged, provided the preamble's framing accompanies the surfaced result.

This is the only normative requirement in this document that is not enforced by code. **Enforcement of this requirement is currently editorial and reputational only.** No standards body, no certification regime, no audit, and no automated check exists today to verify that downstream implementations honor it. This is a v0.1 limitation. Future versions of the standard may define a stewardship process — a public consultation forum, a conformance self-attestation, or a reference test corpus — through which implementers demonstrate the preamble is surfaced. Until such a process exists, the requirement holds normatively, and breaches are addressed in conversation with the implementer rather than through enforcement infrastructure.

---

## 3. Definitions

Terms below are used with the meanings given. **Normative** terms have specific meaning when used in conformance language; **informative** terms are used descriptively.

- **Evidence package** *(normative)*: A signed node in the system, carrying the structural-primitive fields per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §1 plus sub-type-specific payload fields. Today's reference implementation produces `content/analysis/v1` nodes (the default content sub-type — legacy and `datHere` shapes both map to it); the broader concept is "signed node." Identified by its envelope hash (see `nodeId`) and stored at a content-addressable URL. See §4 for structure.
- **Signed node** *(normative)*: Any conformant signed object in the system — a `content/*` node (standalone assertion; no `targetNodeId`) or an `attestation/*` node (assertion about another node; `targetNodeId` required). Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §2.
- **`type`** *(normative)*: The URI declaring a signed node's family + sub-type. Required post-[ADR-0009](../adr/0009-unified-typed-attestation-primitive.md); pre-ADR-0009 packages are interpreted as `content/analysis/v1` by construction per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §9. Form: `content/<noun>/v<N>` or `attestation/<verb>/v<N>` per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §6.
- **`content/*` namespace** *(normative)*: The top-level type family for **standalone assertions** — nodes whose payloads do NOT carry `targetNodeId`. Sub-types include `content/analysis/v1` (built; default for AI-Assisted Analysis Producer Profile output), `content/claim/v1`, `content/question/v1`, `content/evidence/v1`, `content/host/v1`, `content/hostPolicy/v1`, `content/hostTermsOfUse/v1`, `content/tool/v1` (reserved name-only per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7).
- **`attestation/*` namespace** *(normative)*: The top-level type family for **assertions about another node** — nodes whose payloads carry at least one `targetNodeId`. The v0.1 sub-type table — `attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/supersedes/v1`, `attestation/publishes/v1`, `attestation/locatedAt/v1`, `attestation/corroborates/v1`, `attestation/contradicts/v1`, `attestation/endorses/v1`, `attestation/wasDerivedFrom/v1`, `attestation/answersQuestion/v1`, `attestation/supportedBy/v1`, `attestation/opposedBy/v1`, `attestation/certifies/v1`, `attestation/evaluates/v1`, `attestation/conforms/v1` — is ratified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7. Operationalization per sub-type lands via downstream ADRs.
- **`nodeId`** *(normative)*: A signed node's stable identity in the system — the envelope hash per [ADR-0008](../adr/0008-multihash-content-hash.md) §6, by construction. Derived (not a separately-stored field). `attestation/*` payloads carry `targetNodeId` referencing the target's `nodeId`. Verifier semantics: cross-check the recomputed envelope hash matches the URL slug, any stored envelope hash, and (for any referencing attestation) the `targetNodeId` field. Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §3.
- **`signer`** *(normative)*: An object on the canonical JSON top level carrying identity binding for the party that signed the node — `bindingTier` (one of `pseudonymous`, `oauth`, `orcid`, `did-web`, `notarized` per the §8 graded identity ladder; extensible), `identifier` (provider-prefixed string), `displayName`, optional `verifiedAt`. Recommended post-[ADR-0009](../adr/0009-unified-typed-attestation-primitive.md); pre-ADR-0009 packages derive `signer` from the trust registry's `signerIdentity` entry for the envelope's `kid` per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §9. Distinct from the `sig` (signature envelope) per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4; the verifier MUST cross-check `sig.kid → trust-registry signerIdentity` against `signer.identifier`. Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4.
- **Content hash** *(normative)*: The multihash digest set fingerprinting the package's off-log content, canonicalized per the rule named in `contentCanonicalization`. Serialized as a JSON object keyed by lowercase algorithm name (e.g., `{"sha256": "...", "blake3": "..."}`); v0.1 vocabulary is `sha256` (required default), `sha3-256` (registered alternate), `blake3` (registered alternate). Embedded in the canonical JSON as the top-level `contentHash` field. Pre-ADR-0008 packages emit a single SHA-256 hex string externally (URL slug + DB row) instead of an embedded field; verifiers interpret the legacy form as `{"sha256": <value>}` per [ADR-0008](../adr/0008-multihash-content-hash.md) §4. Specified by [ADR-0008](../adr/0008-multihash-content-hash.md).
- **Envelope hash** *(normative)*: The SHA-256 hex digest of the [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) JSON Canonicalization Scheme (JCS) canonicalization of the unsigned envelope. The unsigned envelope is the canonical-JSON package object with the signature envelope removed. Pre-ADR-0008 packages used Node.js `JSON.stringify` insertion-order serialization; verifiers handle them under that legacy rule. Specified by [ADR-0008](../adr/0008-multihash-content-hash.md) §6.
- **Content canonicalization** *(normative)*: The URI naming the rule by which off-log content reduces to bytes that `contentHash` fingerprints. Carried as the top-level `contentCanonicalization` field on the canonical JSON; covered by the envelope hash and the platform signature. v0.1 reserved URIs: `https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1` (datHere A-G/Jupyter content profile per [ADR-0004](../adr/0004-dathere-captureMethod-variant.md) + [ADR-0005](../adr/0005-executed-notebook-architecture.md)) and `https://typedstandards.org/canonicalization/legacy-json/v1` (legacy default content profile). Specified by [ADR-0007](../adr/0007-content-canonicalization.md).
- **Signed envelope** *(normative)*: The envelope-hash hex string, signed with Ed25519ph by a key in the trust registry. The envelope JSON object stored in the database also carries `publicKey`, `algorithm`, and `kid` fields for verifier convenience; signature math binds only the hash bytes. Per [ADR-0008](../adr/0008-multihash-content-hash.md) §7, the envelope hash is computed over the JCS canonicalization of the unsigned envelope; pre-ADR-0008 packages used `JSON.stringify` insertion-order canonicalization, and verifiers handle them under that legacy rule.
- **Trust registry** *(normative)*: The JSON document at `${baseUrl}/.well-known/evidence-public-keys.json` that lists authorized signing keys with lifecycle metadata. See §6.3.
- **`kid` (key identifier)** *(normative)*: A stable string identifying a signing key (e.g. `platform:evidence-2026-04`), present in both the signed envelope and the trust registry. The `kid` is part of the canonical package JSON via `metadata.signingKeyId`, so it is covered by the envelope hash (per [ADR-0008](../adr/0008-multihash-content-hash.md) §6) and therefore by the platform signature.
- **BlobRef** *(normative)*: A four-field JSON object `{ ref, url, contentType, size }` that names a content-addressable Vercel Blob in place of inline content for selected fields. See §4.5.
- **`captureMethod`** *(normative)*: The label identifying *how* the package's content was captured — the integrity-of-pipeline property. The field is required, signed, and tamper-evident per [ADR-0003](../adr/0003-evidence-capture-method.md). Its **value space is open at the core level** per [ADR-0011](../adr/0011-capturemethod-generalization.md); the vocabulary of valid values is declared by the package's `producerProfile`'s guidance bundle (per [ADR-0006](../adr/0006-producer-profile-architecture.md) §5). For the `ai-assisted-analysis` Producer Profile, the v0.1 vocabulary is `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report` — the three values originally enumerated in core by ADR-0003 and relocated to this profile's guidance bundle by [ADR-0011](../adr/0011-capturemethod-generalization.md) §2. See §9.
- **`contentProfile`** *(normative)*: The label identifying *what shape* the package's content is in — the content-shape property. Orthogonal to `captureMethod`. Values: `"default"` (legacy shape; absence treated as default) or `"datHere"` (A-G envelope content profile per §9.1). Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md). See §4.1 and §9.1-§9.3.
- **Trace** *(informative)*: An OpenTelemetry-shaped JSON object (or BlobRef) describing the spans of the analysis. See §7.
- **PROV-O graph** *(informative)*: A W3C PROV-O JSON-LD graph derived from the trace at publish time. See §4.4.
- **Withdrawal / reinstatement** *(normative)*: Signed, public, append-only lifecycle events on a published package. See §10.
- **Verifier** *(informative)*: Any party performing the checks described in §11 against a fetched package.

A broader vocabulary covering the surrounding architectural standards (PROV-O, Croissant, RO-Crate, atproto, KOI, nanopublications, etc.) is defined in `end-state-vision.md` Glossary and not duplicated here.

---

## 4. Evidence package structure

A conformant evidence package is a single JSON object whose canonical-JSON serialization is the input to the SHA-256 package hash.

> ⚠ **Subject to Open Question #1 — package format.** The current implementation is a single canonical JSON object plus a database-resident envelope. The current direction is a multi-file directory with an RO-Crate / WRROC compatibility profile, in which the canonical JSON object would become one artifact in a larger package. This v0.1 normalizes the single-blob form because that is what the publish path produces today; section §4 will be revised when the format decision lands.

### 4.1 Top-level fields

A conformant evidence package MUST carry every field in the following list. Fields marked optional MAY be omitted; when present, they MUST conform to the type given.

| Field | Type | Required | Description |
|---|---|---|---|
| `metadata` | object | yes | See §4.2. |
| `prompt` | object | yes | See §4.3. |
| `queries` | array of objects | yes | One entry per tool call observed during the analysis. May be empty when the analysis made no tool calls. |
| `dataSources` | array of objects | yes | One entry per data source touched by the analysis, derived from `queries[]` and the trace. May be empty when `queries[]` is empty (no tool calls means no data sources to enumerate). |
| `cost` | object | yes | Token-usage and timing summary. See §4.7. |
| `skillMetadata` | object | yes | Skill-guidance hash, MCP server URL, and skill text or BlobRef. |
| `output` | string \| BlobRef | yes | The assistant's final response text, or a BlobRef. See §4.5. |
| `trace` | object \| BlobRef | yes | OpenTelemetry-shaped trace, or a BlobRef to the same. |
| `summary` | string | optional | Short, indexable, citation-ready summary of the analysis. Required when `metadata.contentProfile == "datHere"` (see §9.1). When present, part of canonical JSON and therefore covered by the package hash and signature. |
| `contentProfile` | string | optional | The content profile the package conforms to. Values: `"default"` (legacy shape; absence treated as default) or `"datHere"` (A-G envelope content profile per §9.1). Orthogonal to `captureMethod`. Extensible — future profiles add ADRs. When present, part of canonical JSON. Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md). **Retained as legacy alias post-ADR-0006**: post-ADR-0006 packages emit both `contentProfile` and `producerProfile`; verifiers SHOULD prefer `producerProfile` when present; the two MUST be consistent (see `producerProfile` row below). |
| `producerProfile` | string | optional | The Producer Profile the package conforms to. Compound-string value of the form `<profile-type>/<profile-subtype>`. v0.1 vocabulary includes `"ai-assisted-analysis/datHere"` (first realized subtype; refactor of the ADR-0004 `datHere` content profile). Other profile types (`human`, `hybrid`, `sandbox-only`) and subtypes are reserved name-only per ADR-0006. When present, part of canonical JSON. Consistency invariant: `contentProfile === "datHere"` iff `producerProfile.startsWith("ai-assisted-analysis/datHere")`. Specified by [ADR-0006](../adr/0006-producer-profile-architecture.md). |
| `contentHash` | object | yes (post-ADR-0008) | Multihash digest set fingerprinting the package's off-log content, canonicalized per the rule named in `contentCanonicalization`. Object keyed by lowercase algorithm name (`sha256`, `sha3-256`, `blake3`) with hex digest values; at least one entry required, `sha256` required by default. Verifier semantics: at-least-one-match per [ADR-0008](../adr/0008-multihash-content-hash.md) §3. Pre-ADR-0008 packages omit the field; the legacy single-SHA-256 hash lives externally (URL slug + DB row) and is interpreted as `contentHash: {"sha256": <legacy hex>}` at verify time. Specified by [ADR-0008](../adr/0008-multihash-content-hash.md). |
| `contentCanonicalization` | string (URI) | recommended (post-ADR-0007) | URI naming the canonicalization rule by which off-log content reduces to bytes that `contentHash` fingerprints. v0.1 reserved values: `https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1` and `https://typedstandards.org/canonicalization/legacy-json/v1`. Resolution semantics out of scope (URI is an identifier, not a fetch target); verifiers resolve via a local rule registry per [ADR-0007](../adr/0007-content-canonicalization.md) §3. Pre-ADR-0007 packages omit the field; verifiers infer the rule from `contentProfile` / `producerProfile` per [ADR-0007](../adr/0007-content-canonicalization.md) §4. When present, part of canonical JSON and covered by the envelope hash + signature. Specified by [ADR-0007](../adr/0007-content-canonicalization.md). |
| `type` | string (URI) | yes (post-ADR-0009) | The node's family + sub-type identifier per the two-family taxonomy. Form: `content/<noun>/v<N>` or `attestation/<verb>/v<N>` per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §6. Pre-ADR-0009 packages omit the field and are interpreted as `content/analysis/v1` per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §9. When present, part of canonical JSON and covered by the envelope hash + signature. Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md). |
| `signer` | object | recommended (post-ADR-0009) | Identity binding for the party that signed the node. Fields: `bindingTier` (required; per the §8 graded identity ladder), `identifier` (required; provider-prefixed string), `displayName` (required; human-readable label), `verifiedAt` (optional; ISO-8601). Distinct from the `sig` envelope (which carries publicKey + algorithm + kid per §6.1); verifier MUST cross-check that `sig.kid` resolves via the trust registry's `signerIdentity` to the same identity `signer.identifier` claims, per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4. Pre-ADR-0009 packages omit the field; verifiers derive an implicit `signer` from the trust-registry `signerIdentity` entry. When present, part of canonical JSON and covered by the envelope hash + signature. Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md). |
| `targetNodeId` | string | conditional | Required for `attestation/*` nodes (the node referenced by the attestation); MUST NOT appear on `content/*` nodes. Some `attestation/*` sub-types carry multiple target references — see [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 for per-sub-type payload shape. Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md). |
| `provenance` | object | optional | W3C PROV-O JSON-LD graph derived from `trace` at publish time. Present when the trace was inspectable inline; omitted when `trace` is a BlobRef and no override is supplied. |
| `extensions` | object | optional | Reverse-DNS-keyed implementation-specific artifacts (e.g. `org.civicaitools.notebook`, `org.civicaitools.environment`). Included in the canonical JSON and therefore covered by the package hash. |

### 4.2 `metadata` object

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | yes | Currently `0.1.0`. |
| `packageId` | string (UUID) | yes | A UUID generated at publish time. Distinct from the package hash. |
| `createdAt` | string (ISO 8601) | yes | UTC timestamp set at packager time. |
| `signingKeyId` | string | yes | The `kid` of the signing key. Present in the canonical JSON; therefore covered by the package hash. |
| `captureMethod` | string | yes (post-ADR-0003) | One of the vocabulary values in §9 (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`). Required at the publish route since 2026-04-29. Pre-ADR-0003 packages persist with a `null` capture method on the database row and render with a "Unknown (pre-ADR-0003)" label. |

### 4.3 `prompt` object

| Field | Type | Required | Description |
|---|---|---|---|
| `hash` | string (hex) | yes | SHA-256 hex digest of the prompt text. |
| `visibility` | string | yes | One of `full_text` or `hash_only`. Enforced at the publish route. |
| `text` | string | conditional | The prompt text in clear, present iff `visibility == "full_text"`. MUST be omitted when `visibility == "hash_only"`. |

### 4.4 `provenance` object (informative on shape)

When present, `provenance` is a W3C PROV-O JSON-LD graph with `@context` mapping the `prov`, `xsd`, `civic`, and `dcterms` prefixes, and an `@graph` array of typed entities, activities, and agents derived from the trace. The graph reflects per-source attribution: each MCP server appears as a `prov:Agent` with a `civic:sourceId`, and each data response is a `prov:Entity` tagged with the same `civic:sourceId`. Skill guidance, the LLM model, and the platform are also represented as agents. The platform is `urn:civic-evidence:platform:civic-ai-tools`.

The provenance graph is deterministically derivable from `trace` at the time of packaging. A verifier MAY recompute and compare; the field exists primarily for downstream consumption rather than as a separate verification primitive.

### 4.5 BlobRef substitution

The fields `output`, `trace`, and `skillMetadata.skillText` MAY be supplied as a BlobRef in place of inline content. A BlobRef is the JSON object:

```json
{
  "ref": "blob:sha256:<64-hex-char SHA-256 of the content bytes>",
  "url": "https://<store>.public.blob.vercel-storage.com/evidence-refs/<hash>.<ext>",
  "contentType": "text/markdown",
  "size": 4194304
}
```

A verifier encountering a BlobRef MUST:

1. Fetch the URL over HTTPS without authentication.
2. Recompute SHA-256 over the fetched bytes; the result MUST equal the hex part of `ref`.
3. Confirm the fetched byte length equals `size`.

A BlobRef whose fetch fails, whose hash mismatches, or whose size mismatches MUST cause the verifier to report `ok: false` for that reference. A package MAY remain otherwise verifiable when one of its BlobRefs fails, but downstream consumers SHOULD treat a package with a failed BlobRef as missing the corresponding content.

**Relationship to `attestation/locatedAt/v1` (post-ADR-0010).** BlobRef is the **single-signer implicit case** of [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md)'s location-as-attestation framing. The verification mechanics are structurally identical: a verifier fetches a URI, recomputes a content hash over the fetched bytes, compares against the signed fingerprint, and confirms size. The differences are placement and signing surface:

- **BlobRef** is an in-envelope four-field shape on a `content/*` node's sub-content fields (`output`, `trace`, `skillMetadata.skillText`). The parent node's signature covers the BlobRef object as part of its canonical JSON, so the publisher *implicitly* asserts "this sub-content lives at this URL with this fingerprint and this size" as part of their own signed package. There is no separate envelope to sign or transparency-log; the assertion piggybacks on the parent node's signature.
- **`attestation/locatedAt/v1`** is a separately-signed envelope of its own, with its own `nodeId`, signer, timestamp, and (optionally) Rekor inclusion proof. This means it can be emitted later than the target content node, by parties other than the target's publisher (backup hosts, mirrors, archives), and references the target by `nodeId` rather than living inside it. Multiple `locatedAt` attestations from different `(signer.identifier, uri-authority)` pairs express durable independent copies per [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) §2.

BlobRef-shaped sub-content references remain conformant under v0.1 for in-envelope use. New cross-host location declarations made by parties other than the parent node's signer SHOULD use `attestation/locatedAt/v1` (separately-signed, third-party-extensible) instead of BlobRef. A verifier processing either form applies the same fetch + content-hash + size verification chain; only the *placement* of the asserter's signature differs.

> ⚠ **Subject to Open Question #2 — federation substrate.** BlobRef URLs in the reference implementation point at the deployment's Vercel Blob storage. The substitution mechanism is a single-host content-addressable pattern, not a federation-aware one. Generalizing to multi-host or multi-registry blob storage — including content-addressable storage that does not require an HTTPS-fetchable URL at all (e.g. IPFS-style addressing) — depends on which federation substrate Open Question #2 selects. The shape of `BlobRef` and the verification rules above are unchanged for v0.1; a future revision will specify how non-Vercel hosts and federation-substrate-native addressing fit. The `attestation/locatedAt/v1` framing per [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) is the natural carrier for cross-host or federation-substrate-native location declarations once Q2 resolves; BlobRef stays the in-envelope shape for sub-content references that travel with the parent node.

### 4.6 `extensions` (optional)

Implementations MAY add fields under `extensions` keyed by reverse-DNS identifiers (`org.civicaitools.notebook`, `org.civicaitools.environment`, `org.<your-domain>.<your-extension>`). All extension content is part of the canonical JSON and is therefore covered by the package hash and the platform signature. Extensions are advisory — they MUST NOT change the meaning of fields defined in this standard, and a verifier MAY ignore unknown extensions without breaking conformance.

The `org.civicaitools.notebook` extension is a content-format marker (a Jupyter-style cell list) emitted by the canonical reference implementation. External implementations are not required to emit it. Under `contentProfile: datHere`, this extension is promoted from informative to normatively required and carries the deterministic notebook of section E (see §9.1).

The `org.civicaitools.environment` extension carries environment metadata (model version, temperature, sampling parameters, tool definitions, publishing-host identifier) required by the `datHere` content profile. See §9.1 for its required shape. Other implementations MAY define their own reverse-DNS-keyed extensions for content not otherwise covered by the standard.

### 4.7 `cost` object framing

The `cost` object's current schema (`promptTokens`, `completionTokens`, `totalTokens`, `model`, `durationMs`) is AI-LLM-specific. It presupposes that the analysis was produced by a token-billed language model.

> ⚠ **Subject to Open Question #7 — producer-type scope.** The `cost` object's schema is currently AI-specific. If Open Question #7 resolves toward generalization to human-authored or hybrid-authored packages, this object will need a producer-type-aware shape (human time, compute time, third-party API costs, etc.). The current shape stays normative for AI-produced packages in v0.1; downstream generalization will land as a separate revision.

---

## 5. Canonical JSON, the envelope hash, and the content hash

Canonicalization comes in two kinds, per [ADR-0007](../adr/0007-content-canonicalization.md) + [ADR-0008](../adr/0008-multihash-content-hash.md):

- **Envelope-level canonicalization** is a single fixed rule committed to by the spec. Every package's unsigned envelope (the canonical-JSON evidence package object with the signature envelope removed) is canonicalized via [RFC 8785 JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785) to produce envelope bytes. The **envelope hash** is the SHA-256 hex digest of those JCS bytes. This rule applies to every envelope shape; there is no envelope-level URI.
- **Content-level canonicalization** varies per content shape. Off-log content (whatever the package's `contentHash` fingerprints) is canonicalized per the rule named by the package's `contentCanonicalization` field (§4.1). The **content hash** is the multihash digest set fingerprinting those canonicalized bytes — an object keyed by lowercase algorithm name (`sha256` required default, `sha3-256` + `blake3` registered alternates per [ADR-0008](../adr/0008-multihash-content-hash.md) §2). v0.1 reserved canonicalization-rule URIs are `https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1` (datHere A-G/Jupyter) and `https://typedstandards.org/canonicalization/legacy-json/v1` (legacy default).

The two rules are nested:

1. Off-log content → `contentCanonicalization` rule → bytes → multihash → `contentHash` field embedded in the envelope.
2. Unsigned envelope (containing `contentHash`, `contentCanonicalization`, and the other top-level fields) → RFC 8785 JCS → bytes → SHA-256 → envelope hash.
3. The envelope hash hex string is what the platform Ed25519ph signature covers (§6.1).

Because the signature covers the envelope JCS bytes, and the envelope contains `contentHash` and `contentCanonicalization`, both the off-log content's fingerprint AND the rule by which it was canonicalized are signature-covered. A bad actor cannot rewrite the canonicalization rule, the content hash, or any other in-envelope field after publication without invalidating the signature.

All field values defined in this standard — including `metadata.captureMethod`, `metadata.signingKeyId`, `contentProfile`, `producerProfile`, `contentCanonicalization`, `contentHash`, every `extensions` entry, and BlobRef objects — are part of the canonical JSON, part of the JCS-canonicalized envelope bytes, and therefore part of the envelope hash and signature.

Fields that live on the database row but not in the canonical package object (such as `title`, `verificationStatus`, `creatorId`) are NOT part of the canonical JSON and are NOT covered by the envelope hash. The `summary` field is optionally part of the canonical JSON per §4.1 (required for packages with `contentProfile === "datHere"`, optional for others); when present in the package, it IS covered by the envelope hash. Packages produced before [ADR-0004](../adr/0004-dathere-captureMethod-variant.md), or non-datHere-content-profile packages whose publishers keep `summary` only on the database row, hash exactly as they did before — the JCS commitment applies prospectively (see backwards-compat note below).

A change to any in-package field — including a single character in `output`, a different `kid`, a different `captureMethod`, a different `contentCanonicalization` URI, or a different `contentHash` digest — produces a different envelope hash, which produces a different content-addressable URL and a different signature.

> **Backwards-compatibility (normative).** Pre-ADR-0008 packages were canonicalized via Node.js `JSON.stringify` with insertion-order key preservation, with no JCS commitment. The JCS commitment is a forward-looking spec requirement; pre-ADR-0008 packages remain verifiable under the legacy `JSON.stringify` rule. Verifiers MUST detect which rule applies per the rule of [ADR-0008](../adr/0008-multihash-content-hash.md) §4: post-ADR-0008 packages emit `contentHash` as a multihash object in the canonical JSON and use JCS; pre-ADR-0008 packages have an external single-SHA-256 hex string (URL slug + DB row) and use `JSON.stringify`. The reference-implementation packager + verify-route's switch from `JSON.stringify` to JCS is a Phase 3 implementation item scheduled separately from this spec change.

---

## 6. Cryptographic envelope

This section describes the signing, timestamping, and transparency-log mechanisms applied to the package hash. All three legs are settled by current implementation and ADR-0003.

### 6.1 Signature

A conformant evidence package MUST be signed with **Ed25519ph** (the pre-hashed Ed25519 variant, RFC 8032 §5.1.2). The signature is computed over the UTF-8 bytes of the **envelope-hash** hex string, NOT over the raw 32-byte hash bytes. The envelope hash is the SHA-256 hex digest of the RFC 8785 JCS canonicalization of the unsigned envelope (§5; [ADR-0008](../adr/0008-multihash-content-hash.md) §6-§7). Implementations using `@noble/curves/ed25519` apply Ed25519ph's internal SHA-512 prehash automatically; implementations using primitives that expose only Ed25519 MUST NOT pre-hash on the application side.

The full signing chain post-ADR-0008:

1. Unsigned envelope (the canonical JSON with the signature envelope removed) → RFC 8785 JCS → envelope bytes.
2. Envelope bytes → SHA-256 → 32-byte envelope hash.
3. Envelope hash → hex encode → envelope-hash hex string.
4. Envelope-hash hex string → UTF-8 bytes → Ed25519ph → signature.

The envelope JSON contains `contentHash` (multihash form per [ADR-0008](../adr/0008-multihash-content-hash.md) §1) and `contentCanonicalization` (URI naming the off-log content's canonicalization rule per [ADR-0007](../adr/0007-content-canonicalization.md)) as fields; both are therefore covered by the envelope hash and the signature. The off-log content's bytes are independently fingerprinted by `contentHash` per §5's two-kinds split.

The signed envelope persisted alongside the package is the JSON object:

```json
{
  "signature": "<base64>",
  "publicKey": "<base64 DER SPKI>",
  "algorithm": "Ed25519ph",
  "kid": "<key identifier>"
}
```

The `kid` and `publicKey` in the envelope MUST match the `kid` and `publicKey` of an entry in the trust registry. The `metadata.signingKeyId` field inside the package's canonical JSON MUST equal the envelope's `kid`. A `kid` swap on the envelope after publication therefore changes neither the envelope hash nor the package itself — the canonical JSON is unchanged — but is detectable as an envelope-vs-canonical mismatch by any verifier.

Per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4, the signature envelope (`sig` — publicKey + algorithm + kid + signature bytes) is structurally distinct from the envelope-side identity claim (`signer` — bindingTier + identifier + displayName per §3 above and §8 below). The signature envelope answers *what was signed and by what key*; the `signer` object answers *who claims to have signed it*. A verifier MUST cross-check that the envelope's `kid` resolves via the trust registry's `signerIdentity` (per §6.3) to the same identity the package's `signer.identifier` claims. A mismatch MUST cause the verifier to report `signer_identity_mismatch` and reject the node. Pre-ADR-0009 packages do not carry an envelope-side `signer` claim; verifiers derive an implicit `signer` from the trust-registry `signerIdentity` entry and apply no mismatch check (there is no envelope-side claim to cross-check against). This split prevents an attacker from attaching a valid-by-key signature with a mismatched identity claim, and gives each adopter publishing under their own trust registry an unambiguous binding from `kid` to publisher identity.

Pre-ADR-0008 packages signed over the UTF-8 bytes of `SHA-256(JSON.stringify(envelope))` hex string (the legacy implicit rule); verifiers handle them under that legacy chain. The reference-implementation packager + verify-route's switch to the JCS chain is a Phase 3 implementation item scheduled separately from this spec change.

Signing is best-effort at publish time. If the signing leg fails, the database row persists with a `null` signature column; the package and its envelope hash remain valid but it does not satisfy this standard's signed-package conformance. The reference implementation does not currently retry-on-failure.

### 6.2 Timestamp and transparency log

A conformant evidence package SHOULD also carry an RFC 3161 trusted timestamp from a public TSA and a Sigstore Rekor inclusion proof. The reference implementation uses `freetsa.org` for the timestamp and Rekor's `hashedrekord` v0.0.1 entry type for the transparency log. Both are best-effort: failures persist as `null` columns and the package remains queryable.

A verifier checks RFC 3161 against FreeTSA's published CA chain and Rekor inclusion against `rekor.sigstore.dev` once it has obtained the timestamp token and the Rekor entry id. The cryptographic *check* of these proofs requires only public infrastructure; the *retrieval* of the proofs themselves currently depends on `civicaitools.org` because the package JSON does not embed them. See §13 for the full verification surface and the Open Question #1 callout in §4 for the target end-state where these are embedded in the package itself.

**Privacy-disclosure note.** Publishing a node's commitment to a transparency log is itself a public act: the envelope hash (`nodeId`), the envelope timestamp, and (via the trust registry's `signerIdentity` per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4) the signer's identity all become public records the moment the inclusion proof is obtained. This is the intended property for published analyses where transparency is a feature, and it is part of the trust contract this standard offers. It is not a neutral act for sensitive or pre-publication content. The architecture therefore PERMITS private transparency logs — an organizational-internal Rekor-equivalent log, a recipient-distributed inclusion-proof protocol, or a deferred-publication pattern where the public log entry is created only when the publication transition lands — for maximally-sensitive cases. No private-log substrate is built in v0.1; the design-permission is named per [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) §4 and Xanadu-gated for implementation. Adopters reasoning about whether to publish should treat the public log entry as part of the disclosure surface, not as opaque cryptographic plumbing.

### 6.3 Trust registry

The trust registry is published at `${baseUrl}/.well-known/evidence-public-keys.json`, currently `https://civicaitools.org/.well-known/evidence-public-keys.json`. It is a JSON object with a `keys` array of entries:

```json
{
  "kid": "platform:evidence-2026-04",
  "publicKey": "<base64 DER SPKI>",
  "signerIdentity": {
    "bindingTier": "platform",
    "identifier": "platform:civic-ai-tools",
    "displayName": "Civic AI Tools Platform"
  },
  "status": "active",
  "activatedAt": "2026-04-15T00:00:00.000Z",
  "deprecatedAt": null,
  "revokedAt": null
}
```

Per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4, each entry MAY carry a `signerIdentity` object documenting which identity the `kid` is bound to. The verifier uses this to cross-check the envelope's `signer.identifier` claim against the registry-recorded identity for the envelope's `kid`. Pre-ADR-0009 registry entries omit `signerIdentity`; verifiers treat absence as `signerIdentity: { bindingTier: "legacy_embedded", identifier: "<kid>", displayName: "<kid>" }` and apply no mismatch check. Post-ADR-0009 registries SHOULD populate `signerIdentity` for every active key.

Status values:

- `active` — current authorized signing key.
- `deprecated` — no longer used to sign new packages; packages signed before `deprecatedAt` remain trusted; packages signed after `deprecatedAt` are not trusted.
- `revoked` — never trusted, regardless of integration time.

A verifier MUST:

1. Match the envelope's `(kid, publicKey)` pair against an entry in the registry.
2. Apply the status semantics. The reference implementation's verify endpoint reports the verdict via a `keyTrust` field with values `active`, `deprecated_valid`, `deprecated_invalid`, `revoked`, `unknown_key`, `registry_unavailable`, or `legacy_embedded`.

The `legacy_embedded` value covers packages predating the trust registry: their signature still verifies mathematically against the embedded public key, but the registry cannot vouch for the key. Surfaces SHOULD render this as a neutral status, not as a failure.

The rotation runbook is at `civic-ai-tools-website/docs/key-rotation.md`.

---

## 7. Trace capture

> ⚠ **Subject to Open Question #4 — trace capture.** The reference implementation uses hand-rolled OTel-shaped JSON. Adopting a real OpenTelemetry SDK or layering Agent Receipts (W3C Verifiable Credentials over MCP tool calls) over or under the OTel layer is the resolution surface.

The reference implementation captures a hand-rolled OpenTelemetry-shaped JSON document covering five span kinds: `analysis` (root), `skill_fetch`, `llm_inference`, `mcp_tool_call`, and `synthesis`. The trace is embedded in the package as the `trace` field (or a BlobRef to the same). The PROV-O graph in `provenance` is derived from this trace at publish time.

The hand-rolled builder is OTel-schema-compliant for the spans it emits but is **not** a real OpenTelemetry SDK. Adopters that bring their own OTel infrastructure cannot drop into the publish path without adapter work. The current direction is to either (a) adopt a real OTel SDK with the GenAI and MCP semantic conventions, or (b) layer Agent Receipts (W3C Verifiable Credentials over MCP tool calls) over or under the OTel layer. Both directions are tracked under Open Question #4.

This v0.1 draft normalizes the current span-kind set as conformant; the resolution of Open Question #4 will revise this section.

---

## 8. Identity binding

> ⚠ **Subject to Open Question #3 — first non-GitHub identity provider.** GitHub OAuth is the only currently-implemented binding. The graded ladder (pseudonymous → GitHub → ORCID → DNS-bound `did:web` → notarized) is informative direction.

The reference implementation binds package authorship to a GitHub OAuth account. The DB columns recording authorship (`github_id`, `display_name`, `github_profile_url`) are GitHub-specific. The signing key is platform-held; the user does not currently sign their own packages.

The current direction is a graded identity ladder: pseudonymous → weak (GitHub OIDC / sigstore keyless) → moderate (ORCID) → institutional (DNS-bound `did:web`) → strong (notarized). The ladder is informative for now; only the GitHub tier is implemented. Open Question #3 will resolve which non-GitHub provider lands first.

This v0.1 draft documents the GitHub binding as the only currently-conformant identity binding; the standard will gain a `creator.identity_binding` typed field once the ladder is live.

---

## 9. `captureMethod`

`captureMethod` is the label identifying how the package's content was captured. The **field itself** — its presence, its required-and-signed discipline, its tamper-evident framing, and its verbatim-by-construction labeling principle — is specified by [ADR-0003](../adr/0003-evidence-capture-method.md). The **value space** — open at the core level, with the vocabulary of valid values declared per Producer Profile — is specified by [ADR-0011](../adr/0011-capturemethod-generalization.md).

A conformant evidence package published after 2026-04-29 MUST carry exactly one of the values declared by the captureMethod vocabulary of the package's `producerProfile`'s guidance bundle (per [ADR-0011](../adr/0011-capturemethod-generalization.md) §1). The vocabulary lookup follows the rule in [ADR-0011](../adr/0011-capturemethod-generalization.md) §3:

1. Read the package's `producerProfile`. When absent and `contentProfile === "datHere"`, treat producerProfile as `ai-assisted-analysis/datHere` per [ADR-0006](../adr/0006-producer-profile-architecture.md) §2 legacy alias. When both fields are absent (pre-ADR-0006 packages), treat producerProfile as `ai-assisted-analysis` — the implicit profile-type for pre-existing packages, all of which were AI-mediated by construction.
2. Resolve the producerProfile's guidance bundle via the local rule registry mechanism [Q32](open-questions.md#q32--producer-profile-guidance-doc-routing-convention) anticipates. v0.1 verifiers resolve to a hardcoded fallback table; the bundle distribution mechanism is a follow-on per [Q32](open-questions.md#q32--producer-profile-guidance-doc-routing-convention).
3. Confirm `metadata.captureMethod` is in the captureMethod vocabulary declared by that bundle.

For the `ai-assisted-analysis` Producer Profile, the v0.1 vocabulary — relocated from core by [ADR-0011](../adr/0011-capturemethod-generalization.md) §2 — is:

- **`chat-flow-stream`** — the publishing platform captured the bytes as the model streamed to the calling client. Verbatim by construction at the wire layer.
- **`claude-code-jsonl-readback`** — the publishing client (typically a Claude Code skill) read each turn's content and per-invocation usage from the session JSONL on disk, filtering to text-typed content blocks only. Verbatim by construction at the JSONL layer.
- **`claude-code-self-report`** — legacy. The publishing model paraphrased the original session from in-context memory. Deprecated as of 2026-04-28; retained as a vocabulary value so packages predating ADR-0003 can be re-rendered with their actual capture method labeled rather than silently re-described as something they were not.

The vocabulary applies to all subtypes of `ai-assisted-analysis` (the existing `datHere` subtype, the reserved `civicaitools-default` subtype, and any future subtypes) unless a subtype's guidance bundle explicitly constrains or extends the parent vocabulary; v0.1 has no subtype-level overrides per [ADR-0011](../adr/0011-capturemethod-generalization.md) §2.

The reference publish route enforces the field at request validation; a missing or invalid value returns `400`. The field is part of `metadata.captureMethod` in the canonical JSON and is therefore covered by the envelope hash and the platform signature: the capture method itself is tamper-evident.

A package's signature attests that the package was published and has not been altered since. It does NOT attest that the package's content matches what was actually generated in the original session — that property is structural and follows from the capture method. Surfaces SHOULD render the `captureMethod` label near the signature-verification verdict so readers do not conflate "signed" with "verbatim."

Pre-ADR-0003 packages persist with a `null` capture-method column on the database row. Surfaces SHOULD render these as `Unknown (pre-ADR-0003)` rather than defaulting to one of the listed values.

Future AI-publishing surfaces (a hook-based path that records bytes at message-emission time, a third-party signed self-attestation, an MCP-host-agnostic capture protocol) extend the `ai-assisted-analysis` Producer Profile's vocabulary by amending **that profile's guidance bundle**, not by amending OES core. The bundle's amendment surface — versioning, distribution, content-addressing — is governed by [Q32](open-questions.md#q32--producer-profile-guidance-doc-routing-convention). Non-AI Producer Profiles (Human, Hybrid, Sandbox-only, future adopter profiles) declare their own captureMethod vocabularies in their respective guidance bundles when promoted from reserved to built per [ADR-0006](../adr/0006-producer-profile-architecture.md) §1.

> ⚠ **Subject to backwards-compat — the v0.1 vocabulary above is the `ai-assisted-analysis` Producer Profile's vocabulary, not the core's.** Pre-ADR-0011 packages with one of the three values verify byte-identical under the new rule: their `producerProfile` (post-ADR-0006) or implicit profile-type (pre-ADR-0006, all of which were AI-mediated by construction) resolves to `ai-assisted-analysis`, whose v0.1 vocabulary contains exactly the three values originally enumerated in core by ADR-0003. No DB migration; no re-signing of any existing package; envelope-hash and signature of every existing package unchanged byte-for-byte. The reference-implementation packager continues to emit one of the three values; reframing the publish-route validator to look up the vocabulary via producerProfile rather than hardcoding the three values is a Phase 3 IMPL item gated on [Q32](open-questions.md#q32--producer-profile-guidance-doc-routing-convention).

---

> ⚠ **§9.1-§9.3 below describe the `datHere` content profile, a content-shape variant** orthogonal to `captureMethod`. The content profile is selected via the `contentProfile` field (§4.1). These sub-sections appear under §9 for historical document-layout reasons (they originally landed as a captureMethod variant in Phase 1 of [civic-ai-tools#69](https://github.com/npstorey/civic-ai-tools/issues/69) and were reframed in the 2026-05-19 amendment per [ADR-0004](../adr/0004-dathere-captureMethod-variant.md)); future revisions may relocate them under a top-level "Content Profile" section. A package with `contentProfile === "datHere"` MUST satisfy §9.1.1's requirements regardless of which `captureMethod` value it carries — the two axes are independent.

### 9.1 `datHere` content profile

> ⚠ **Resolves [Q21](open-questions.md#q21--canonical-notebook-format-for-dathere-capturemethod) (canonical notebook format for the datHere content profile; the registry anchor's "capturemethod" slug is historical and stays for stability). Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).**

> 📌 **Forward pointer: framing reframe per [ADR-0006](../adr/0006-producer-profile-architecture.md) (2026-05-23).** This section's normative requirements stay verbatim; only the framing language is being reframed. Under ADR-0006, the existing `datHere` content profile is the first realized subtype of the AI-Assisted Analysis Producer Profile — i.e., `producerProfile: "ai-assisted-analysis/datHere"`. The A-G envelope described in §9.1 is a **production-process attestation shape**, not a content-shape variant; it lives inside the Producer Profile axis, not the Content Profiles axis (which is reserved for typed-content carriers — Typed Claims / Typed Evidence / Typed Questions). The `contentProfile` field is retained as a legacy alias for backwards-compatibility (consistency invariant per ADR-0006 §2). A future OES revision will rewrite §9.1 in producer-profile terms; in the interim, the section's normative content continues to govern conformant `ai-assisted-analysis/datHere`-subtype packages without modification.

A `datHere`-content-profile package organizes its content as the **A-G envelope**, a profile over the existing top-level fields specified in §4. The envelope is a content profile, not a new container: the package remains the single canonical JSON object whose SHA-256 is the package hash. A-G is the way a `datHere`-content-profile package's content is *organized for readers and cross-host publishing*; the OES top-level fields are still what gets hashed and signed.

The A-G section-to-field mapping:

| Section | Content | OES field |
|---|---|---|
| A | Initial prompt — the user's question, verbatim | `prompt.text` (with `prompt.visibility == "full_text"`) |
| B | System prompt(s) active for the model | `skillMetadata.skillText` |
| C | Model card + environment metadata: model ID/version, temperature, sampling parameters, MCP server URLs, tool definitions, publishing-host identifier | `cost.model` + `skillMetadata.mcpServerUrl` + `extensions["org.civicaitools.environment"]` (§9.1.1) |
| D | Deliberative trace: thinking, tool calls, and tool results in order | `trace` (OTel-shaped, or BlobRef) + `queries[]` |
| E | Answer notebook — a notebook that, when executed against the documented runtime, produces F | `extensions["org.civicaitools.notebook"]` (§9.1.2) |
| F | The rendered answer | `output` (string or BlobRef) |
| G | Short, indexable, citation-ready summary | `summary` (§4.1) |

The remainder of this section specifies the normative requirements `datHere` adds to those fields.

#### 9.1.1 Normative requirements

A conformant `datHere`-content-profile package MUST satisfy *every* requirement below, in addition to the standard's existing requirements for conformant packages (§4, §5, §6, §9).

1. **Prompt visibility.** `prompt.visibility` MUST be `"full_text"`. The hash-only mode is incompatible with the A-G envelope, which requires section A to be readable.
2. **System prompt(s) present.** `skillMetadata.skillText` MUST be non-empty (inline string or BlobRef) and MUST reflect the composed system prompt set the model was operating under at the time of the analysis.
3. **Environment metadata present.** The `extensions["org.civicaitools.environment"]` object MUST be present and MUST contain at least: `modelVersion` (string), `temperature` (number), `mcpServers` (array of objects with `url` and optional `name`), `toolDefinitions` (array of tool-schema objects, OR a BlobRef when large), `host` (string identifying the publishing host, e.g. `"civicaitools.org"` or an external publisher's host identifier). Additional fields are permitted under reverse-DNS sub-namespacing.
4. **Notebook present.** The `extensions["org.civicaitools.notebook"]` object MUST be present, MUST conform to a notebook format admitted by §9.1.2, and MUST satisfy the determinism property in §9.1.3. Where the notebook is too large to inline, it MAY be supplied as a BlobRef. The notebook MAY be either skeleton or executed at protocol level; §9.1.4 specifies the discriminator and the corresponding reproducibility-property strength for each. Both forms are conformant `datHere` notebooks.
5. **Rendered answer present.** `output` MUST be present (inline or BlobRef) and MUST be the rendered output of executing the notebook against the documented runtime at publish time.
6. **Summary present.** `summary` (§4.1) MUST be present, MUST be non-empty, and SHOULD be short enough to surface in citation contexts (recommended ≤ 280 characters; not enforced numerically).
7. **Content-profile label.** `metadata.contentProfile` MUST be `"datHere"`. The label is itself covered by the canonical-JSON hash and the platform signature per §5. `captureMethod` (the ADR-0003 field, with the value-space generalized per [ADR-0011](../adr/0011-capturemethod-generalization.md)) continues to carry one of the values declared by the package's `producerProfile`'s guidance bundle (per §9); for a `datHere`-content-profile package — which post-ADR-0006 also carries `producerProfile: "ai-assisted-analysis/datHere"` — that resolves to the `ai-assisted-analysis` Producer Profile's v0.1 vocabulary (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`). `contentProfile` is an independent axis describing what shape the content takes.

A verifier encountering a `datHere`-content-profile-labeled package that fails any of the requirements above MUST report the package as malformed-for-`datHere` while still being able to perform the standard envelope-integrity checks (§13.1). Non-datHere content profiles continue to use their existing requirements; the requirements above apply only when `metadata.contentProfile == "datHere"`.

#### 9.1.2 Notebook format

A conformant `datHere`-content-profile package's section E (the notebook) MUST conform to **Jupyter Notebook Format v4.5 or later** (nbformat 4), expressed as the JSON cell structure with a top-level `cells` array, per the public nbformat specification. Jupyter is the v1 default because it matches the pattern in use at the pilot integration partner and has the broadest ecosystem support (rendering, diffing, archival, citation tooling).

This standard admits alternative notebook formats — most notably Marimo, which has stronger determinism properties via reactive evaluation and no hidden state — as conforming notebook formats for `datHere`-content-profile packages, provided they:

1. Produce a self-contained executable representation whose execution against the documented runtime is reproducible (no hidden inputs, no cell-order-dependent state that is not re-evaluable);
2. Carry an explicit content-type marker on the `extensions["org.civicaitools.notebook"]` entry indicating which format is in use (e.g., a `"format"` sub-field with values like `"jupyter-v4.5"` or `"marimo-v0.x"`);
3. Are accompanied by a renderer that produces section F (the rendered answer) from section E.

The protocol-level property the standard locks is **deterministic reproducibility**, not the choice of notebook engine. A future ADR may promote Marimo (or another format) to a second normative default without superseding this one if a real adopter requires it. Until then, `datHere`-content-profile packages SHOULD default to Jupyter v4.5+.

#### 9.1.3 Determinism property

A `datHere`-content-profile package's section E (the notebook) is **deterministic against a documented runtime environment plus stable upstream data**. The standard articulates this property explicitly because conflating "verifiable" with "the same answer forever" is the predictable failure mode.

1. The notebook MUST record its runtime requirements (language version, library versions, MCP server URLs) either in its first cell or in a sidecar `requirements` field on the `extensions["org.civicaitools.environment"]` object.
2. Re-execution of the notebook against the documented runtime, with the same MCP server endpoints reachable and the same upstream data unchanged since publication, SHOULD reproduce section F (the rendered answer) byte-for-byte modulo non-deterministic formatting (timestamps in tool-call results, floating-point representations that depend on platform libc, etc.).
3. The determinism property is **best-effort**, not absolute. Civic data is live; an upstream dataset updated since publication will produce different tool-call results on re-execution, which will produce a different rendered answer. This is expected behavior, not a verification failure.
4. Verifiers and surfaces SHOULD render the determinism property as *"reproducible against the documented runtime AND the upstream-data state at publish time,"* not as *"the same answer forever."*

The signature attests that the notebook in section E has not been altered since publication. It does NOT attest that re-executing it tomorrow produces the same answer as today; the upstream data may have changed. This is the `datHere` analog of the chat-flow-stream / JSONL-readback "verbatim-by-construction at *some* layer, with the layer named" property: the layer named is *the documented runtime against the upstream-data state at publish time*, and the property promised is *reproducibility against that layer*, not invariance.

Skeleton and executed notebooks (§9.1.4) deliver the reproducibility property with different strengths: skeleton notebooks re-execute the data-fetch cells reproducibly but the answer-synthesis cell carries a hardcoded markdown answer that is not re-derived from cell outputs; executed notebooks deliver the property materially because every cell's output (including the synthesis cell) is computed at publish time, and the comparison-cell convention (§9.1.4) makes original-vs-current values legible to verifiers. Surfaces SHOULD render the property strength honestly per §9.1.4's labeling convention.

#### 9.1.4 Notebook execution provenance and metadata

> ⚠ **Specified by [ADR-0005](../adr/0005-executed-notebook-architecture.md).**

This section adds two protocol-level fields that discriminate how the notebook in section E was produced and, when the notebook was executed by the publisher's pipeline, what runtime environment produced its outputs. The two fields are independent of `captureMethod` (§9) and `contentProfile` (§4.1, §9.1) — they describe the *notebook authoring path*, a third orthogonal axis. The fields apply only when `metadata.contentProfile == "datHere"`; non-datHere content profiles ignore them.

##### `extensions["org.civicaitools.notebook"].provenance`

A new sub-field on the existing notebook extension distinguishing how the notebook in section E was authored:

| Value | Meaning |
|---|---|
| `"skeleton"` | The notebook structure wraps an answer authored elsewhere (typically the chat-flow LLM output). Data-fetch cells are re-executable and reproducible; the answer-synthesis cell carries a hardcoded markdown answer that is NOT re-derived from cell outputs above. The reproducibility property in §9.1.3 is satisfied partially: data-fetch reproducibility holds; answer-synthesis reproducibility does not. |
| `"executed"` | The notebook was executed end-to-end by the publisher's pipeline before signing; every cell's output (including the synthesis cell) is computed from real cell execution against the documented runtime and live upstream data at publish time. The reproducibility property in §9.1.3 is satisfied materially; the comparison-cell convention below makes original-vs-current values legible to re-executors. |

When absent, verifiers SHOULD treat the field as `"skeleton"` (the pre-ADR-0005 default). The field is auto-emitted by conformant packagers from ADR-0005 forward; pre-ADR-0005 `datHere`-profile packages omit it and remain conformant.

##### `extensions["org.civicaitools.execution"]`

A new reverse-DNS-keyed extension recording the execution telemetry needed for verifiers to reason about the determinism property. The extension MUST be present when `provenance == "executed"` and MUST be absent when `provenance == "skeleton"` (or absent). Field set:

| Field | Type | Required | Description |
|---|---|---|---|
| `executedAt` | string (ISO-8601 UTC) | yes | Timestamp at which the notebook execution completed. |
| `environment` | object | yes | Runtime the notebook actually executed against. MUST contain at least: `python` (string version, e.g., `"3.13.1"`) and `libraries` (object mapping library name to pinned version string, e.g., `{"pandas": "2.2.0", "requests": "2.31.0"}`). Additional sub-fields permitted under reverse-DNS sub-namespacing. |
| `executionDuration_ms` | integer | yes | Wall-clock duration of the sandbox execution, milliseconds. Informational; not part of the trust property. |
| `sandboxId` | string | optional | Opaque identifier for the execution substrate run. Informational; not part of the trust property. The OES does NOT specify the sandbox provider; this field carries provider-specific telemetry without naming a provider in mandatory shape (see [Q28](open-questions.md#q28--sandbox-provider-lock-in-vs-portability-for-the-executed-notebook-path) on the portability question). |
| `comparisonCellPresent` | boolean | optional | Defaults to `true` for new executions. When `true`, the executed notebook includes the appended "Comparison: original vs. current" cell described below. When `false`, the cell is absent (publishers MAY opt out in cases where extracting prominent metrics is infeasible). |

The `extensions["org.civicaitools.environment"]` extension from §9.1.1 describes the runtime the package was *authored under*; `extensions["org.civicaitools.execution"]` describes the runtime an execution *actually ran in*. They coexist; an executed-path package carries both. A re-executor matches both blocks against their own environment to reason about whether re-execution outputs should match.

##### Comparison-cell convention (executed notebooks, SHOULD)

When `provenance == "executed"` and `comparisonCellPresent != false`, the executed notebook SHOULD include a final cell appended by the publisher's pipeline after sandbox execution and before signing. The cell embeds the prominent numeric/dataframe values from the original execution as Python literals and re-computes the same values on re-execution against live data. The intent is that a re-executor of the notebook tomorrow sees both the original values (as constants in source code) and the current values (computed at re-execution time) and a printed delta, without any introspection of the notebook's own .ipynb file structure. The canonical shape is:

```python
# ORIGINAL VALUES (captured at executedAt = <ISO-8601 timestamp>)
original = {
    "<metric-name>": <literal value>,
    ...
}

# CURRENT VALUES (re-computed against live data using the same helpers + queries above)
current = recompute_key_metrics()

# DELTAS
for k in original:
    delta = (current[k] - original[k]) if isinstance(original[k], (int, float)) else (original[k], current[k])
    print(f"{k}: original={original[k]}, current={current[k]}, delta={delta}")
```

The "prominent metrics to capture" selection is at the publisher's discretion. Conformant publishers SHOULD use a deterministic heuristic (e.g., top-N values from the dataframes referenced by name in the synthesis cell) or an LLM-selected metric set, documented in their reference implementation. The cell is part of the signed notebook artifact and is covered by the package hash and signature.

##### Reproducibility-property labeling convention (rendering surfaces, SHOULD)

Rendering surfaces (the publisher's detail page, third-party renderers of the cross-host publication artifact, archive views) SHOULD frame the reproducibility property a package actually delivers using labels that name the property, not the internal versioning. Recommended labels:

- `provenance == "executed"` → *"Executed notebook — answer derived from computed data; full re-execution reproducible against the documented runtime + upstream-data state at publish time."*
- `provenance == "skeleton"` (or absent) → *"Skeleton notebook — answer authored in chat; data fetch reproducible but answer synthesis is not."*

Labels are not normative wording; they SHOULD convey the property honestly without internal jargon ("v0", "pre-execution-architecture", etc.).

##### Backwards compatibility

Pre-ADR-0005 `datHere`-content-profile packages remain conformant. They omit both new fields; verifiers treat the omission as `provenance == "skeleton"` and recognize the absence of `extensions["org.civicaitools.execution"]` as consistent with that. The schema version stays at `0.1.0`. Surfaces rendering pre-ADR-0005 packages SHOULD use the skeleton label.

### 9.2 Cross-host publication: commitment-view schema

> ⚠ **Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).**

A `datHere`-content-profile package MAY be published cross-host as a Jupyter notebook on a git host, as a multi-file commit with a sibling metadata file, or as future analogous content-addressable surfaces. In every case the published artifact carries the package's **commitment view** — enough fields for any reader to independently verify the package against the publisher's trust registry without fetching the canonical-JSON package object.

This section defines the commitment view as a **logical schema** (§9.2.1 — field definitions) and specifies two **concrete serializations** of that schema: notebook-embedded (§9.2.2, for `.ipynb` outputs) and sibling YAML file (§9.2.3, for non-notebook outputs and as a sidecar option). §9.2.4 describes a reader-affordance rendering convention for notebook outputs. Both serializations carry the same field set with the same semantics; they are byte-different but semantically identical for verification. A conformant publisher MAY emit either serialization; a conformant verifier MUST accept either.

A reader holding only the published artifact + the publisher's trust registry + FreeTSA + Sigstore Rekor can verify the package's cryptographic envelope. The `civicaitools.org`-dependency property described in §13 is unchanged by this section (offline verifiability is still gated on [Q1](open-questions.md#q1--package-format) resolution), but the cross-host publication pattern *makes the package's content* independent of the originating host as long as the trust registry remains independently reachable.

Bundle-export endpoints on conformant publishers produce the published artifact (the notebook with its embedded metadata, or the multi-file set including any sibling YAML) as a single response; the reference implementation's contract is in `civic-ai-tools-website/docs/api/evidence-publish.md`. Bundle endpoints are advisory — a publisher MAY support cross-host publication by manual artifact construction without offering a bundle endpoint.

#### 9.2.1 Field definitions

A conformant commitment view carries the following fields. The field set is the same regardless of serialization; §9.2.2 and §9.2.3 specify how the fields are arranged in their respective serializations.

| Field | Type | Required | Description |
|---|---|---|---|
| `evidenceProtocolVersion` | string | yes | The OES schema version this commitment view was published against (currently `0.1.0`). |
| `packageHash` | string (hex SHA-256) | yes | The SHA-256 hex digest of the canonical-JSON package object. The package's content-addressable identifier. |
| `packageUrl` | string (URL) | yes | The content-addressable URL where the canonical-JSON package is fetchable. Reference implementation: Vercel Blob URL. Other hosts MAY serve from their own content-addressable storage. |
| `captureMethod` | string | yes | One of the three ADR-0003 values describing how the content was captured (`chat-flow-stream`, `claude-code-jsonl-readback`, or `claude-code-self-report`). Mirrors `metadata.captureMethod` from the canonical-JSON package. |
| `contentProfile` | string | yes | `"datHere"` for artifacts produced under this section. Future content profiles MAY define their own cross-host publication patterns or reuse this one. |
| `signature` | object | yes | Signed-envelope object. Shape: `{ signature, publicKey, algorithm, kid }` matching §6.1. |
| `signerIdentity` | object | yes | Identity binding for the package's author. Shape matches the OES identity-binding model (§8); GitHub-bound today, future identity providers extend the field shape per Q3. |
| `rfc3161Timestamp` | string (base64) | optional | RFC 3161 trusted timestamp token. Present when the publisher's pipeline obtains one. |
| `rekorEntryId` | string | optional | Sigstore Rekor entry identifier. Present when the publisher's pipeline obtains one. |
| `rekorInclusionProof` | string (base64) | optional | Sigstore Rekor inclusion proof bytes. Present when the publisher's pipeline obtains one. |
| `trustRegistryUrl` | string (URL) | yes | The `.well-known/evidence-public-keys.json` URL where the publisher's trust registry is served. Lets a reader resolve `signature.kid` independently of the publishing host. |
| `attestations` | array | optional | Array of attestation entries. Each entry is either a reference (§9.3) or an embed (§9.3). |
| `subjectTitle` | string | yes | Human-readable title of the analysis. Matches the publisher's database `title` field. |
| `subjectSummary` | string | yes | The G-section summary. Matches the canonical-JSON `summary` field (§9.1.1 requirement 6). |

#### 9.2.2 Notebook-embedded serialization (`.ipynb` outputs)

A `datHere`-content-profile package published as a Jupyter notebook (§9.1.2) MUST carry the commitment view in the notebook's root `metadata` object under the reverse-DNS namespace `org.civicaitools.evidence`:

```json
{
  "cells": [ ... ],
  "metadata": {
    "org.civicaitools.evidence": {
      "evidenceProtocolVersion": "0.1.0",
      "packageHash": "<hex SHA-256>",
      "packageUrl": "<URL>",
      "captureMethod": "chat-flow-stream",
      "contentProfile": "datHere",
      "signature": { "signature": "...", "publicKey": "...", "algorithm": "Ed25519ph", "kid": "..." },
      "signerIdentity": { ... },
      "trustRegistryUrl": "<URL>",
      "subjectTitle": "...",
      "subjectSummary": "...",
      "attestations": [ ... ]
    },
    "kernelspec": { ... },
    "language_info": { ... }
  },
  "nbformat": 4,
  "nbformat_minor": 5
}
```

The `org.civicaitools.evidence` namespace lives at the notebook's root `metadata` level — the location the Jupyter notebook format reserves for opaque metadata that conformant tooling MUST preserve on round-trip. Sibling namespaces (publisher-specific identifiers, `kernelspec`, `language_info`, future namespaces) coexist with the evidence namespace and are unaffected by it; a conformant verifier MUST ignore unknown sibling namespaces.

All field names and semantics from §9.2.1 map directly. Nested objects (`signature`, `signerIdentity`) flatten naturally into the JSON shape Jupyter expects. Optional fields (`rfc3161Timestamp`, `rekorEntryId`, `rekorInclusionProof`, `attestations`) MAY be omitted; when present they carry the §9.2.1-defined shape.

A conformant publisher MUST ensure the `org.civicaitools.evidence` metadata block survives notebook tooling round-trip (executing the notebook in Jupyter, Colab, VS Code, or analogous environments MUST NOT clobber the namespace). The Jupyter notebook format spec is explicit that root-level metadata under unrecognized keys is preserved by conformant tooling, which makes this serialization durable in practice.

Notebook-embedded is the recommended default serialization for `.ipynb` outputs.

#### 9.2.3 Sibling YAML file serialization (non-notebook outputs and sidecar)

A `datHere`-content-profile package published as a non-notebook artifact, or as a notebook alongside an explicit sidecar, MAY carry the commitment view as a sibling YAML file with the conventional filename `<artifact-basename>.evidence.yaml`. The file's content is the §9.2.1 field set serialized as YAML at the top level:

```yaml
evidenceProtocolVersion: "0.1.0"
packageHash: "<hex SHA-256>"
packageUrl: "<URL>"
captureMethod: "chat-flow-stream"
contentProfile: "datHere"
signature:
  signature: "<base64>"
  publicKey: "<base64 DER SPKI>"
  algorithm: "Ed25519ph"
  kid: "<key identifier>"
signerIdentity:
  # ... identity-binding-specific fields per §8
trustRegistryUrl: "<URL>"
subjectTitle: "..."
subjectSummary: "..."
attestations:
  # ... per §9.3
```

A conformant verifier MUST accept either YAML or JSON shapes at this filename (YAML is a superset of JSON; either form is valid). Where the published artifact is itself a markdown document, publishers MAY ALTERNATIVELY embed the commitment view as YAML frontmatter at the top of the markdown file between `---` delimiters (the Jekyll / GitHub Pages frontmatter convention); the field set is identical.

For non-notebook artifacts that are markdown documents, the document body (everything after the YAML frontmatter or alongside the sibling YAML file) SHOULD render A-G content as markdown sections — A (the prompt), B (system prompts), C (model card + environment), D (deliberative trace), E (the notebook reference or inline), F (the rendered answer), G (summary). Section E references the notebook by relative path when the notebook is a sibling file; section F may be inline or a sibling file based on size. The exact layout is at the publisher's discretion as long as A through G are unambiguously identifiable.

When a sibling YAML file accompanies a notebook, the notebook-embedded serialization (§9.2.2) and the sibling YAML serialization MUST carry the same field values for any field they both express. A verifier encountering a mismatch SHOULD prefer the serialization whose signature recomputes correctly against the package hash and SHOULD report the mismatch.

This serialization is the primary path for non-notebook outputs and a valid choice for notebook outputs that prefer separation of concerns over embedded metadata.

#### 9.2.4 Cell 0 rendering convention (notebook outputs, SHOULD)

A `datHere`-content-profile package published as a Jupyter notebook SHOULD render a human-readable metadata table in the notebook's first markdown cell. The cell is a reader affordance — verification does NOT depend on its presence — but it materially improves the experience of opening the notebook in any renderer (Jupyter, Colab, VS Code, GitHub's `.ipynb` viewer, nbviewer).

Recommended fields to surface in the table:

- **Signer identity + binding tier.** Who signed the package, at what identity-binding strength (pseudonymous / GitHub / ORCID / institutional / strong per §8).
- **Package hash (truncated).** First 8-12 hex characters of the canonical SHA-256, sufficient for at-a-glance identification.
- **Trust seal / captureMethod + contentProfile.** The captureMethod label (one of the three ADR-0003 values describing how the content was captured) and the contentProfile label (here, `datHere`) and a short verification status indicator suitable for static rendering. The table itself does not perform verification; the indicator reflects the publisher's pre-publication check or is omitted.
- **Attestation summary count.** Number of attestations carried in §9.2.1's `attestations` field, optionally broken out by kind (corroborations, contradictions, evaluations).
- **Publishing host + timestamp.** `host` and publish-time information from the environment metadata (§9.1).

Publishers MAY include additional fields. Existing publisher conventions of rendering analysis metadata (data source, query, generation timestamp, etc.) as a human-readable table are appropriate alongside the evidence-specific fields.

The rendered cell is purely a reader affordance. A reader who needs to verify the package MUST work from the `org.civicaitools.evidence` namespace metadata (§9.2.2) or the sibling YAML (§9.2.3); the rendered table is not authoritative and SHOULD NOT be trusted on its own.

### 9.3 Embed-vs-reference policy for cross-host publication

> ⚠ **Resolves [Q24](open-questions.md#q24--embed-vs-reference-policy-for-attestations-in-published-artifacts) (embed-vs-reference policy for attestations in published artifacts). Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).**

The `attestations` array in the commitment view (§9.2) MAY contain entries in either of two forms. The same rules apply to both serializations defined in §9.2 (notebook-embedded and sibling YAML).

**Reference form** is the default. A reference entry is a JSON object with the following fields:

```yaml
- kind: <attestation kind>
  targetHash: <SHA-256 of the package this attestation is about>
  attestationHash: <SHA-256 of the canonical-JSON attestation object>
  attestationUrl: <URL where the canonical-JSON attestation is fetchable>
```

A reader processing a reference entry fetches the attestation from `attestationUrl`, recomputes its SHA-256 against `attestationHash`, and verifies its signature against the publisher's trust registry (the same `trustRegistryUrl` from the commitment view, or a different registry URL carried inside the attestation itself).

**Embed form** is an optimization for attestations that are stable and load-bearing for trust evaluation. An embed entry is the complete signed attestation envelope, inline:

```yaml
- kind: <attestation kind>
  targetHash: <SHA-256 of the package this attestation is about>
  attestationHash: <SHA-256 of the embedded canonical-JSON>
  attestation: <inline canonical-JSON attestation object>
  signature: <signed-envelope object matching §6.1>
```

A reader processing an embed entry verifies the embedded envelope's signature directly without fetching anything. Both forms preserve independent verifiability: an embedded attestation carries its own signature, so a reader can verify it even if the surrounding commitment view has been altered (the alteration would break the package-hash check anyway, but the embed-vs-reference distinction is orthogonal to the package signature).

**Default-to-reference rule.** Implementations SHOULD prefer reference form for routine attestations (corroborations from other authors, contradictions, citations) and SHOULD use embed form only when an attestation is structurally tied to the published claim's trust state — for example, an admin-approve attestation that establishes a corroboration relationship between an original committed claim and a publication-record, or a host-policy attestation that gates publication on adversarial-evaluation presence.

A reader encountering an embedded attestation MUST verify its signature against the publisher's trust registry just like any other attestation; the embed/reference distinction is a fetch-time vs. commitment-view-size trade, not a trust trade.

The attestation-kind vocabulary itself (`corroboration`, `contradiction`, `correction`, `withdrawal`, `evaluation`, `expert_attestation`, `consistency`, etc.) is governed by §15 and is not normatively closed by this section. The cross-host publication schema accepts any attestation kind the publisher emits; readers and downstream consumers apply their own filters.

---

## 10. Lifecycle and location attestations

> **Reframed 2026-05-25 by [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md).** This section is operationalized under the unified-primitive framing established by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md): lifecycle events (withdrawals, reinstatements, supersessions, publications) are separately-signed `attestation/*` nodes referencing the target content node by `nodeId`, not DB-row columns on the target's storage. Location pointers (the publisher's URL where the content lives, plus any backup-host pointers) are separately-signed `attestation/locatedAt/v1` nodes. Pre-ADR-0010 packages whose lifecycle state lives in the legacy DB columns remain verifiable; the reference implementation honors both representations for pre-ADR-0010 packages and emits attestation nodes for new packages.

### 10.1 Lifecycle as a chain of attestation nodes

A package author MAY withdraw, reinstate, or supersede a previously-emitted content node at any time by emitting the corresponding `attestation/*` node, signed under the same trust-registry key as the target (or a delegated-publisher key per [Q20](open-questions.md#q20--visibility-lifecycle-and-attestpublish-semantics)). The lifecycle is a **chain of separately-signed attestation nodes**, each referencing the target (and, for reinstatements, the prior withdrawal) by `nodeId`.

Sub-types operationalized under [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) per the [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 table:

- **`attestation/withdraws/v1`** — references target by `nodeId`; carries `reason` (required, non-empty) and `effectiveAt` (defaults to envelope timestamp). Authorization rule: `publisher-only`.
- **`attestation/reinstates/v1`** — references target by `nodeId` and the prior withdrawal by `priorWithdrawalNodeId`; optionally carries `reason`. Authorization rule: `publisher-only`.
- **`attestation/supersedes/v1`** — references the prior node by `targetNodeId` and the successor node by `successorNodeId`. Authorization rule: `publisher-only`.
- **`attestation/publishes/v1`** — references target by `nodeId`; carries `publicationHost` and `releasedAt`. Authorization rule: `publisher-only` OR `delegated-publisher` per Q20 (delegated-publisher mechanics are a future ADR).

Each attestation envelope is Ed25519ph-signed and SHOULD be RFC 3161-timestamped + Sigstore Rekor-included per §6.2, exactly like a `content/*` envelope. The signature attests that the lifecycle event occurred at the asserted time, by the asserted signer, referencing the asserted target; it does not modify the target's own signature, which remains valid as published.

**Multi-cycle support is free by construction.** A `published → withdrawn → reinstated → withdrawn → reinstated → ...` sequence is a longer chain of attestation nodes referencing the same target, with each subsequent reinstatement pointing back to its immediately-prior withdrawal via `priorWithdrawalNodeId`. There is no cycle counter, no DB-shape mutation per cycle, and no spec-level cycle limit. The previously-deferred multi-cycle refactor at [civic-ai-tools-website#58](https://github.com/npstorey/civic-ai-tools-website/issues/58) is therefore obsolete; the engineering need it tracked is satisfied structurally.

A verifier processing a content node MUST surface the **chain of signer-matched lifecycle attestations** referencing the node, in envelope-timestamp order (ties broken by `nodeId` lexicographic). The verifier reports the current lifecycle status as derived from the latest signer-matched lifecycle attestation per the retention-asymmetry rule in §10.3 below. Each attestation's own signature, timestamp, and (if present) transparency-log inclusion proof are independently verifiable.

### 10.2 Location as attestation

The publisher's own URL where the content lives, plus any backup-host or mirror URL, are each expressed as a signed `attestation/locatedAt/v1` referencing the content node by `nodeId`. Payload fields per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7: `targetNodeId`, `uri`, `contentHash` (multihash; SHOULD match the target's `contentHash` — mismatch is informative, indicating content drift between the location and the target's signed fingerprint), optional `contentLength`, optional `availability`. Authorization rule: `any-with-binding`.

**Multiple `attestation/locatedAt/v1` attestations from different `(signer.identifier, uri-authority)` pairs express that the content has independent durable copies** per [Q38](open-questions.md#q38--dedicated-copyof-relation-vs-multiple-locatedat-attestations) (resolved on arrival in [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 refinement (c)). A dedicated `copyOf` sub-type is not minted; the multi-`locatedAt` pattern carries the durability signal sufficiently. Consumer-side weighting (publisher's own pointer vs. third-party mirror vs. recognized archive) lives in the verifier's surface logic, not in the attestation envelope.

A content node with **zero `attestation/locatedAt/v1` attestations** is the valid private/draft/enterprise base case: the signer holds the bytes; no public location is asserted. See [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) §5 for the use cases (draft / pre-publication, enterprise-private, recipient-distributed).

The BlobRef pattern in §4.5 is the **single-signer implicit case** of `attestation/locatedAt/v1`'s verification rule (fetch the URI, recompute the content hash over the fetched bytes, confirm size). BlobRef-shaped sub-content references remain conformant for in-envelope use; new cross-host location declarations made by parties other than the parent node's signer SHOULD use `attestation/locatedAt/v1` instead.

### 10.3 Retention asymmetry (normative property)

A publisher's withdrawal authority is **bounded to their own pointer and status label**. Specifically:

1. A `attestation/withdraws/v1` from publisher P referencing target T removes P's own visibility commitment. It does NOT invalidate `attestation/locatedAt/v1` attestations signed by other parties pointing at T's content hosted on other hosts.
2. A backup-host's `attestation/locatedAt/v1` remains independently verifiable after P's withdrawal: the backup host's signature still verifies; the content at their URI still hashes correctly against the target's `contentHash`; the backup host's location attestation has not been retracted (only P's own status has). Whether the backup host honors P's withdrawal at the application layer is a host-policy question (the future host self-attestation work per [Q22](open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape)), not a protocol question.
3. A verifier MUST surface the **latest signer-matched lifecycle attestation alongside any verified copy**. When rendering a content node with an `attestation/withdraws/v1` from P AND an `attestation/locatedAt/v1` from backup-host B, the verifier displays both — "withdrawn by publisher; copy still available at B's host" — rather than treating the withdrawal as global content erasure.

This is the deliberate civic-accountability feature the prior OES §10 implied but did not name. Silent erasure of civic-data claims is a worse failure mode than asymmetric retention; the standard surfaces the asymmetry honestly and lets consumers apply judgment per §2's normative preamble.

A permanent record that a civic-data claim was made and later retracted is more honest than silent deletion. Implementations MUST NOT remove withdrawn content nodes from storage or registry-side listings except through explicit administrative action with an audit trail. The retention-asymmetry rule above scopes this MUST NOT to the publisher's own infrastructure; it does not extend to a publisher's authority over content others host.

### 10.4 Backwards compatibility for pre-ADR-0010 packages

Pre-ADR-0010 packages whose lifecycle state lives in the legacy DB columns (`withdrawnAt`, `withdrawnReason`, `withdrawalSignature`, `withdrawalTimestamp`, `reinstatedAt`, `reinstatedReason`, `reinstatementSignature`, `reinstatementTimestamp`) remain verifiable. Verifiers MUST honor the legacy columns as a deprecated-but-still-supported source of withdrawal/reinstatement state when no `attestation/withdraws/v1` / `attestation/reinstates/v1` envelopes are present for the target node.

A one-time migration emitting equivalent attestation envelopes from the legacy columns is a Phase 3 implementation item per [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) Consequences; after migration, new packages do not write the legacy columns and the columns become read-only fallback for pre-migration state. The migration's spec target is "byte-identical lifecycle semantics expressed as attestation envelopes," not "schema-version bump"; the schema version stays at `0.1.0` per [Q27](open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec).

The single-cycle limitation that previously gated multi-cycle support on `civic-ai-tools-website#58` dissolves under the attestation framing. The reference implementation's withdraw/reinstate UX gains arbitrary-cycle support automatically once the packager emits attestation envelopes; the previously-tracked refactor is not needed.

---

## 11. Typed claims

> **Reframed 2026-05-25 by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §8 (Q11 closure).** Typed claims are `content/*` sub-types (`content/claim/v1`, `content/question/v1`, `content/evidence/v1`) under the two-family taxonomy ratified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md), NOT a separate `claims.jsonld` companion file. The Civic Claim Vocabulary draft spec at `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` is authoritative for the claim shapes (TrendClaim, ComparisonClaim, ObservationClaim, etc.) and the conformance requirements; under the new framing those shapes are realized as `content/claim/v1` nodes (one node per claim) with the existing CCV per-claim provenance, confidence, scope, and AnalyticalDerivation requirements preserved.

A published `content/analysis/v1` package's typed claims are extracted as separately-signed `content/claim/v1` nodes referencing the source `content/analysis/v1` via `attestation/wasDerivedFrom/v1` carrying an `AnalyticalDerivation` payload — the classification-laundering guard per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 refinement (a) + [ADR-0006](../adr/0006-producer-profile-architecture.md) §4. No `claims.jsonld` companion file is needed; the typed claims are first-class signed nodes in their own right, retrievable by `nodeId`, verifiable independently of any containing analysis.

> ⚠ **Subject to Open Question #5 — `claims.jsonld` implementation timing.** Promotion of typed claims from "specified" to "built" is gated on a real adopter package whose verification or claim queries are blocked without the layer per the Xanadu doctrine (`xanadu-doctrine.md`). Under the reframed framing, the v0.1 `content/claim/v1` sub-type is reserved name-only per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 until that adopter is identified; the spec text and CCV draft are forward-compatible with the new framing.

No code path currently generates `content/claim/v1` nodes. No published package contains a separately-signed typed-claim node. This v0.1 draft therefore makes no normative claim about typed claims beyond reserving the `content/claim/v1` / `content/question/v1` / `content/evidence/v1` sub-type URIs per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7. When typed claims ship, a follow-on ADR will operationalize the conformant interaction with the rest of a package (signature coverage, hash sensitivity, the `attestation/wasDerivedFrom/v1` extraction-attestation requirement, the cross-host commitment view's references to typed-claim nodes by `nodeId`).

---

## 12. Upstream evidence references

> **Resolved 2026-05-25 by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §8.** The earlier reserved space for an `upstream-evidence.json` companion file is obsolete in the unified-primitive framing. Cross-package corroboration, citation graphs, and meta-analysis are expressed as separately-signed `attestation/*` nodes referencing targets by `nodeId`; no separate companion file is needed.

The upstream-evidence relation vocabulary (`derived_from`, `compares_to`, `extends`, `replicates`, `contradicts`, `evaluates`) maps to the `attestation/*` sub-type table per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7:

| Earlier upstream-evidence relation | `attestation/*` sub-type |
|---|---|
| `derived_from` | `attestation/wasDerivedFrom/v1` |
| `compares_to` | `attestation/corroborates/v1` or `attestation/contradicts/v1` (per direction) |
| `extends` | `attestation/wasDerivedFrom/v1` with `derivationMethod` indicating extension semantics |
| `replicates` | `attestation/corroborates/v1` or `attestation/contradicts/v1` (a re-publication that ran the same analysis and got similar / different results); Q38 confirmed `attestation/locatedAt/v1` suffices for "durable copy" — replication is a separate concept |
| `contradicts` | `attestation/contradicts/v1` |
| `evaluates` | `attestation/evaluates/v1` (per Q26 — evaluator carries declared methodology + bindingTier) |

Implementations needing cross-package corroboration should emit separately-signed `attestation/*` nodes per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7's sub-type table, not maintain a separate `upstream-evidence.json` companion file. The companion-file design is retired without ever having been built; the work moves under §15.

---

## 13. Verification properties

> ⚠ **Subject to Open Question #1 — package format.** The current verification surface is split between the public package (Vercel Blob) and the private database row. End-state verification — package alone plus public infrastructure, with no `civicaitools.org` dependency — is the target shape under Open Question #1.

### 13.1 What a verifier can check today, and what they need to do it

A verifier today needs five sources, not three. All five MUST be available for the check listed against each.

| Source | Public? | What the verifier reads from it |
|---|---|---|
| The package JSON at the Vercel Blob URL | Public, content-addressable | Package contents, `metadata.captureMethod`, `metadata.signingKeyId`, BlobRef entries |
| `civicaitools.org/api/evidence/<slug>/verify` (or DB row) | Public-readable, server-composed | Signature envelope (`signature`, `publicKey`, `algorithm`, `kid`), RFC 3161 timestamp token, Rekor entry id + inclusion proof, lifecycle state |
| `civicaitools.org/.well-known/evidence-public-keys.json` | Public | Trust registry entries for `(kid, publicKey, status, lifecycle dates)` |
| FreeTSA's CA chain (or any equivalent TSA the publisher has switched to) | Public | RFC 3161 verification root |
| Sigstore Rekor (`rekor.sigstore.dev`) | Public | Inclusion-proof verification root |

Given those five sources, the checks the verifier can perform are:

1. **Envelope integrity.** Recompute the envelope hash over the canonical JSON of the fetched package per §5's chain (post-ADR-0008: RFC 8785 JCS canonicalization of the unsigned envelope + SHA-256; pre-ADR-0008: `JSON.stringify` insertion-order + SHA-256). The result MUST equal the envelope-hash hex string the verify endpoint reports (which today is the URL slug + DB row's legacy `packageHash` for pre-ADR-0008 packages, interpreted per [ADR-0008](../adr/0008-multihash-content-hash.md) §4).
2. **Signature mathematics.** Verify the Ed25519ph signature (obtained from the verify endpoint) over the envelope-hash hex string against the embedded `publicKey`. A mismatch fails this check. Pre-ADR-0008 packages were signed over the legacy `JSON.stringify`-derived hex string; verifiers handle them under that legacy chain per §6.1.
3. **Content canonicalization rule resolution.** Read `contentCanonicalization` from the package (post-ADR-0007). Resolve the URI via the verifier's local rule registry per [ADR-0007](../adr/0007-content-canonicalization.md) §3. An unknown URI reports `unknown_canonicalization_rule`; an absent field on a pre-ADR-0007 package implies the rule per the package's `contentProfile` (datHere → `dathere-ag-jupyter/v1`; default or absent → `legacy-json/v1`) per [ADR-0007](../adr/0007-content-canonicalization.md) §4.
4. **Content hash verification.** Apply the resolved canonicalization rule to the off-log content; multi-hash the canonicalized bytes per the algorithms in `contentHash` (post-ADR-0008 multihash form). Confirm at-least-one-match per [ADR-0008](../adr/0008-multihash-content-hash.md) §3. Report which algorithm matched (or `contentHash_mismatch` if all listed algorithms failed; `contentHash_no_supported_algorithm` if the verifier supports none of the listed). Pre-ADR-0008 packages emit a single external SHA-256 hex string (URL slug + DB row); verifiers interpret it as `{"sha256": <legacy hex>}` for the purposes of this check.
5. **Trust-registry verdict.** Look up the envelope's `(kid, publicKey)` pair in the trust registry; apply the status semantics from §6.3.
6. **`metadata.signingKeyId` consistency.** Confirm the `kid` from the signature envelope equals `metadata.signingKeyId` in the package. A mismatch indicates an envelope-vs-canonical drift (see §6.1).
7. **Timestamp validity.** When the verify endpoint returns a non-null RFC 3161 token, verify the token against FreeTSA's CA chain. The verification math itself does not depend on `civicaitools.org`.
8. **Transparency-log inclusion.** When the verify endpoint returns a non-null Rekor entry id, resolve the entry against `rekor.sigstore.dev` and verify the inclusion proof. The math does not depend on `civicaitools.org`.
9. **BlobRef integrity.** For every BlobRef in the package, fetch the URL over HTTPS, recompute SHA-256, and confirm size. See §4.5.
10. **Lifecycle state.** Detect withdrawal, reinstatement, supersession, or publication via the chain of signer-matched `attestation/*` lifecycle nodes referencing the target by `nodeId` per [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) §1 + [OES §10.1](#101-lifecycle-as-a-chain-of-attestation-nodes); verify the corresponding lifecycle signatures and timestamps for each attestation independently. For pre-ADR-0010 packages with legacy DB-row lifecycle state (`withdrawnAt` / `reinstatedAt` columns per pre-ADR-0010 §10), continue to honor the legacy fields per [OES §10.4](#104-backwards-compatibility-for-pre-adr-0010-packages). Surfaces MUST render the lifecycle state — the chain of attestation nodes in envelope-timestamp order — and MUST apply the retention-asymmetry rule per [OES §10.3](#103-retention-asymmetry-normative-property): when a withdrawal is present, surface it alongside any verified `attestation/locatedAt/v1` from a backup host, rather than treating the withdrawal as global content erasure.
11. **`captureMethod` label.** Read `metadata.captureMethod`; render it alongside the signature verdict. The label is covered by the signature.
12. **`type` resolution.** Read the `type` field (post-ADR-0009). Resolve to one of the v0.1 sub-types per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 (or future ADRs that mint new sub-types). Render the family + sub-type alongside the signature verdict. Pre-ADR-0009 packages omit the field; verifiers interpret implicit `content/analysis/v1`. A `type` URI not in the verifier's local sub-type registry reports `unknown_type` rather than failing verification, preserving the §2 normative-preamble posture.
13. **`nodeId` cross-check.** Recompute the envelope hash per §5 + §6.1. The result IS the `nodeId` by construction per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §3. MUST equal the URL slug + the stored envelope hash. For nodes referencing this one (an attestation whose `targetNodeId` points here), the `targetNodeId` MUST resolve to this envelope hash; a `targetNodeId` that does not resolve to any known envelope hash reports `unknown_target_node` (the verifier renders the attestation but flags the unresolved reference).
14. **`signer.identifier` ↔ `sig.kid → trust-registry signerIdentity` cross-check.** Read the package's `signer.identifier` (post-ADR-0009). Look up the envelope's `kid` in the trust registry. Compare `signer.identifier` against the registry entry's `signerIdentity.identifier`. A mismatch MUST cause the verifier to report `signer_identity_mismatch` and reject the node. Pre-ADR-0009 packages have no envelope-side `signer.identifier`; verifiers derive `signer` from the registry entry and skip the cross-check (there is no envelope-side claim to cross-check against).
15. **`captureMethod` per-profile vocabulary conformance.** Per [ADR-0011](../adr/0011-capturemethod-generalization.md) §3, resolve the package's `producerProfile` (or its legacy-alias fallback per [ADR-0006](../adr/0006-producer-profile-architecture.md) §2; or the implicit `ai-assisted-analysis` profile-type for pre-ADR-0006 packages, all of which were AI-mediated by construction). Look up the profile's captureMethod vocabulary in the verifier's local rule registry (v0.1: hardcoded fallback table; long-term: [Q32](open-questions.md#q32--producer-profile-guidance-doc-routing-convention) bundle-distribution mechanism). Confirm `metadata.captureMethod` is in the declared vocabulary. A value not in the declared vocabulary reports `captureMethod_unknown` and rejects the node. A producerProfile whose bundle cannot be resolved reports `producerProfile_bundle_unresolved` and degrades gracefully — the value is preserved verbatim on the detail page, the structural integrity check (#11) still passes, only the vocabulary-conformance assertion is unverified. Pre-ADR-0011 packages with one of the three pre-existing values (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`) resolve to the `ai-assisted-analysis` profile's v0.1 vocabulary and pass byte-identical.

The verify endpoint is currently the single point through which the signature, RFC 3161 token, and Rekor proof are exposed. A verifier who fetches only the Vercel Blob package and the public trust registry has only the package contents and the trust-registry contract — they cannot complete checks 2, 7, 8, or 10 (signature mathematics, RFC 3161 timestamp, Rekor inclusion, lifecycle state) without `civicaitools.org`. Checks 3 + 4 (content canonicalization rule resolution + content hash verification) become more reachable offline post-ADR-0007/0008: the rule URI lives in the package itself, and the verifier's local rule registry doesn't depend on `civicaitools.org`. Checks 12 + 13 + 14 (`type` resolution, `nodeId` cross-check, `signer.identifier` cross-check) are similarly offline-reachable post-ADR-0009 — the labels and identity binding live in the package itself; the verifier's local sub-type registry and the publisher's trust registry don't depend on `civicaitools.org`. Check 15 (`captureMethod` per-profile vocabulary conformance) is offline-reachable post-ADR-0011 — the producerProfile lives in the package itself; the verifier's local profile/vocabulary registry doesn't depend on `civicaitools.org` either (it currently lives as a hardcoded fallback table; long-term, the Q32 bundle-distribution mechanism uses content-addressed bundles fetchable from any mirror).

### 13.2 What a verifier cannot check today

A verifier cannot determine, from any combination of the sources above, any of:

1. Whether the captured analysis matches what was actually generated in the original session. The `captureMethod` label is the structural answer to this question; verbatim guarantees follow from the labeled mechanism, not from the signature.
2. Whether the assistant's prose or numerical outputs are correct. Correctness review is a separate, separately-signed attestation (see §15).
3. Whether the analysis was authored under coercion, paid promotion, or other conflicts of interest. The standard surfaces identity and provenance; the consumer applies judgment.
4. Whether the package's claims have been corroborated or contradicted by other packages. Cross-package operations require the upstream-evidence layer (§12, deferred; subject to Open Question #12).
5. Whether the `civicaitools.org` verify endpoint itself is reporting the proofs honestly. A verifier who fetches the proofs through the verify endpoint trusts that the platform did not silently substitute them. Mitigation today: the package hash is content-addressable and the trust registry is independently fetchable, so substitution would have to be consistent across the package, the registry, and the verify endpoint to avoid detection — but a malicious or compromised platform could in principle stage that. The end-state architecture removes this trust dependency by embedding the proofs in the package itself (§13.3).

### 13.3 Target end-state verifiability

The end-state property the project is building toward: a verifier holding the package alone plus the public trust registry plus FreeTSA + Sigstore Rekor — with **no** `civicaitools.org` server dependency — can perform every check in §13.1. This requires:

- **(a) Embedding the signature envelope in the package itself.** The signature, public key, kid, and algorithm move from the database row into the canonical JSON or into a sibling artifact in a multi-file package layout. Subject to Open Question #1 (package format).
- **(b) Embedding the RFC 3161 token and Rekor entry id (with inclusion proof) in the package or a sibling artifact.** Same dependency.
- **(c) Embedding the lifecycle state (withdrawal / reinstatement signatures and timestamps) in a content-addressable companion that updates the package's logical state without modifying the original signed artifact.**
- **(d) A graded identity binding** that can be resolved from the package + public infrastructure. Subject to Open Question #3.
- **(e) Cross-package corroboration via `upstream-evidence.json` or via the attestations infrastructure** (subject to Open Question #12).
- **(f) Typed-claim conformance via `claims.jsonld`** (subject to Open Question #5).

None of these are conformant requirements in v0.1. The current spec describes the current shape honestly; this section names the target so adopters and reviewers can see the gap.

A real test of (a) and (b) — performed by an external party with no access to `civicaitools.org` server endpoints, against a real published package — is itself an open question (Open Question #15). Until that test is performed and passes, the offline-verifiability claim is a target, not a property.

---

## 14. Federation and discoverability

> ⚠ **Subject to Open Question #2 — federation substrate.** Also subject to Open Question #8 — Croissant outbound metadata. Both are independent of the package format (§4) and the cryptographic envelope (§6).

The reference implementation publishes packages as stable URLs on `civicaitools.org`. There is currently no federation transport: a package's canonical home is the URL on the publisher's registry; cross-registry discovery is manual.

The current direction names three candidate federation substrates (atproto firehose / labelers, KOI net with sensor nodes, nanopub network) and an orthogonal discoverability mechanism (outbound Croissant metadata at a well-known location on each evidence page, making packages discoverable via Hugging Face / Kaggle / CKAN / Schema.org-aware crawlers).

This v0.1 draft makes no normative claim about federation transport or outbound metadata. Adopters running their own registries SHOULD publish to a stable, content-addressable URL and SHOULD honor the trust-registry contract for their own signing keys, but no specific federation protocol is required. As Open Question #2 resolves toward a specific substrate, this section will gain normative content describing how packages propagate across registries; until then, single-registry deployments and hand-replication between registries are the only patterns the standard contemplates.

---

## 15. Attestations — the `attestation/*` namespace

Per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §2, an **attestation** is one of two top-level type families: a signed node whose payload carries `targetNodeId` referencing the node it asserts about. Attestations cover lifecycle (withdraws / reinstates / supersedes / publishes), reference (locatedAt / wasDerivedFrom / answersQuestion / supportedBy / opposedBy), claim-to-claim (corroborates / contradicts / endorses), and authority-bearing (certifies / evaluates / conforms) relations. The v0.1 sub-type table is ratified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7; sub-types declare their authorization rule (`publisher-only`, `any-with-binding`, or `specific-role-required`) and payload shape per the table.

### 15.1 Existing attestation kinds map to `attestation/*` sub-types

The reference implementation has long supported a separate type of artifact — an **attestation** — that comments on a previously-published package without modifying it. The pre-ADR-0009 attestation kinds map to specific sub-types in the ratified table:

- **`consistency`** (repeat-publish runs of the same prompt to surface determinism / drift) → emitted as a separately-signed `content/analysis/v1` node (the variance test itself) plus an `attestation/corroborates/v1` or `attestation/contradicts/v1` (depending on whether the result agrees with the original); the variance methodology + result delta live in the attestation's `reasoning` payload.
- **`evaluation`** (adversarial review by an LLM-as-judge against a rubric) → `attestation/evaluates/v1` with declared methodology per [Q26](open-questions.md#q26--valid-evaluator-definition-identity-binding--methodology-declaration). Authorization rule: `specific-role-required` (evaluator with declared methodology + bindingTier).
- **`expert_attestation`** (review by a named human expert with stated relationship to the original package) → `attestation/evaluates/v1` when the expert is producing a critique, or `attestation/endorses/v1` when the expert is vouching. Authorization rule: `specific-role-required` (authority-bearing party).

A future Phase 3 migration will rewrite existing pre-ADR-0009 attestation records on `evidence_records` to emit conforming `attestation/*` nodes; the migration is scoped separately from this spec change. Until that migration ships, the existing attestation surface continues to work, and verifiers SHOULD treat existing records under the legacy attestation-kind vocabulary while emitting them under the new sub-type URIs for any new attestations.

### 15.2 Conformance requirements for `attestation/*` nodes

A conformant `attestation/*` node:

- MUST satisfy the structural-primitive requirements per §4 (envelope hash, content hash, content canonicalization, signature, optional timestamp + Rekor proof, `type`, `signer`, `metadata`).
- MUST carry `type` matching a registered `attestation/*` sub-type URI per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 (or a future sub-type minted by an ADR naming its motivating adopter).
- MUST carry `targetNodeId` referencing at least one target node by `nodeId`. The target node need not be retrievable for the attestation to be verifiable — the attestation's signature is independent of the target's availability — but a verifier MAY report `unknown_target_node` per §13.1 check 13 when the target cannot be resolved.
- MUST satisfy the sub-type's authorization rule per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §5. For `publisher-only` sub-types, the verifier MUST confirm that the attestation's `signer.identifier` matches the target node's `signer.identifier` (or that a delegated-publisher relationship is in effect per a future ADR). For `specific-role-required` sub-types, the role declaration lives in the sub-type's own normative section. For `any-with-binding` sub-types, the attestation's `signer.bindingTier` need only be at least `pseudonymous`.
- MUST carry the sub-type's required payload fields per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7's table.

### 15.3 Verifier expectations when an original package has one or more attestations

A verifier rendering a `content/*` node with referencing `attestation/*` nodes SHOULD:

- Surface aggregate attestation stats ("N corroborations, M contradictions, K endorsements") near the package's signature verdict.
- Allow drill-down to individual attestations, each rendered with its own `signer`, signature verdict, and payload.
- Distinguish sub-types visually so consumers can apply judgment per the §2 normative preamble (`corroborates` vs. `endorses` carry different signals; high-bindingTier vs. pseudonymous signers carry different signals; etc.).
- For lifecycle attestations (`withdraws`, `reinstates`, `publishes`, `supersedes`), surface the lifecycle state per §10 and [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) — that ADR operationalizes the OES §10 withdrawal columns under the `attestation/withdraws/v1` framing, closes `civic-ai-tools-website#58` as obsolete (multi-cycle support is free by construction in the attestation framing), establishes the retention-asymmetry rule per §10.3, and names the two-atomic-Rekor-entry publication property per ADR-0010 §6.

Operationalization of specific sub-types lands per-ADR on its own timeline. The withdrawal/reinstatement/supersession/publication lifecycle sub-types and the `attestation/locatedAt/v1` location sub-type are operationalized in [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) (per the strategic memo §5 sequencing item 4); the adversarial-eval requirement model lands in a future ADR anticipated from [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72) per [Q25](open-questions.md#q25--adversarial-evaluation-requirement-strength-on-publication-records) + [Q26](open-questions.md#q26--valid-evaluator-definition-identity-binding--methodology-declaration); the host self-attestation pattern (host endorsements + host-policy-required gating) lands when a host-self-attestation adopter blocks per [Q22](open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape) and proposed-issue 008. The ratified Q36 sub-type table per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 is the taxonomy backbone; individual sub-types operationalize on their own per-ADR timelines.

---

## 16. Conformance

> ⚠ **Subject to Open Question #16 — formal conformance criteria.** Formal conformance criteria, a reference test corpus, and a conformance-claims registration mechanism are themselves an open question. This section documents the operational understanding of conformance as it stands today.

A **conformant package** is a JSON object satisfying §4 that, when SHA-256-hashed in canonical form, produces a hash matching the URL slug and matching a successful Ed25519ph signature verification under the trust-registry contract (§6).

A **conformant publisher implementation** is one that:

1. Validates the publish-route required-field set (§4.1, §9).
2. Builds canonical JSON with sorted keys and produces a SHA-256 hash.
3. Signs the hash with Ed25519ph using a key listed in the publisher's published trust registry.
4. Persists the package at a content-addressable URL.
5. Honors the withdrawal / reinstatement lifecycle as signed, public, append-only events.
6. Carries the §2 normative preamble on every product surface that renders packages.

A **conformant verifier implementation** is one that performs every check in §13.1 against any package it processes, surfaces lifecycle state when present, and refuses to compute platform-issued correctness verdicts as constrained by §2.

A formal conformance test suite, a reference test corpus, and a conformance-claims registration mechanism are all pending. The current corpus is the set of packages published on `civicaitools.org`; verifying any of them against this spec is the closest thing to a conformance test today.

---

## 17. Stakeholder review and revision history

Revisions to this document will be logged here as the open questions resolve and stakeholder review is incorporated.

- **2026-05-25** — captureMethod generalization cohort (G4, per the 2026-05-25 strategic memo §5 sequencing item 5). [ADR-0011](../adr/0011-capturemethod-generalization.md) generalizes the `captureMethod` field's value space at the core level (closed enum → open) and relocates the three current values (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`) into the `ai-assisted-analysis` Producer Profile's v0.1 captureMethod vocabulary, declared as part of that profile's guidance bundle per [ADR-0006](../adr/0006-producer-profile-architecture.md) §5. Verifiers check captureMethod against the vocabulary declared by the package's `producerProfile`'s guidance bundle (falling back to `contentProfile` via the [ADR-0006](../adr/0006-producer-profile-architecture.md) §2 legacy alias, then to the implicit `ai-assisted-analysis` profile-type for pre-ADR-0006 packages). The field's required-and-signed discipline, verbatim-by-construction principle, tamper-evident framing, and `Unknown (pre-ADR-0003)` legacy label per [ADR-0003](../adr/0003-evidence-capture-method.md) are unchanged. The three Claude-Code-specific values remain valid for every existing package; backwards-compat is byte-identical because pre-ADR-0011 packages resolve via the legacy-alias fallback chain to the same vocabulary. Changes: §3 captureMethod definition rewritten with co-equal [ADR-0003](../adr/0003-evidence-capture-method.md) + [ADR-0011](../adr/0011-capturemethod-generalization.md) pointer; §9 main prose rewritten to express the open-at-core + per-profile-vocabulary rule, with the three values pivoted from a normative-core enum to the `ai-assisted-analysis` Producer Profile's v0.1 vocabulary and the forward-extensibility callout reframed accordingly; §9.1.1 item 7 reframed to point at the per-profile vocabulary rather than naming the three values directly; §13.1 verifier-check list extended with check 15 (`captureMethod` per-profile vocabulary conformance with graceful-degradation on bundle-resolution failure) + trailing offline-reachability paragraph extended for check 15; §18 related-documents list extended with [ADR-0011](../adr/0011-capturemethod-generalization.md). Schema version unchanged at `0.1.0` per [Q27](open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec); pre-ADR-0011 packages remain verifiable byte-identical. Partial-resolves [Q9](open-questions.md#q9--ai-specific-commitments-and-producer-type-generalization) for the captureMethod field specifically (Q9 stays Open overall; cost / skillMetadata / AnalyticalDerivation / BlobRef follow the same pattern in subsequent passes); Q9 resolution-criteria amended to name the per-field pattern. [Q7](open-questions.md#q7--producer-type-scope) gains a clarifying note that the producer-type-agnostic-core + per-profile-specifics direction has crystallized via the [ADR-0006](../adr/0006-producer-profile-architecture.md) + [ADR-0011](../adr/0011-capturemethod-generalization.md) pairing; Q7 stays Open (the trigger condition — non-AI publisher actually shipping — is unmet). [Q32](open-questions.md#q32--producer-profile-guidance-doc-routing-convention) gains a one-line note that captureMethod-vocabulary-distribution is one specific kind of guidance-bundle content the routing convention will need to support.
- **2026-05-25** — Visibility / lifecycle / location attestations cohort (G3, per the 2026-05-25 strategic memo §5 sequencing item 4). [ADR-0010](../adr/0010-visibility-lifecycle-location-attestations.md) operationalizes the lifecycle/location subset of the [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 sub-type table: lifecycle events become separately-signed `attestation/withdraws/v1` / `attestation/reinstates/v1` / `attestation/supersedes/v1` / `attestation/publishes/v1` nodes; the publisher's URL and backup-host URLs become signed `attestation/locatedAt/v1` nodes; the BlobRef pattern is reframed as the single-signer implicit case of `locatedAt`'s verification rule; a content node with zero `locatedAt` attestations is the valid private/draft/enterprise base case; publication is the two-atomic-Rekor-entry property (content node + locatedAt attestation, each independently inclusion-proven); the retention-asymmetry property (publisher's withdrawal authority bounded to their own pointer + status label) is stated normatively; the privacy-disclosure note on the transparency log (publishing a commitment is itself a disclosure; private logs design-permitted, Xanadu-gated). Changes: §4.5 (BlobRef substitution) reframed with the locatedAt relationship paragraph + Q2 callout extended to name the future federation-substrate carrier; §6.2 (timestamp and transparency log) gains a privacy-disclosure paragraph naming public-log entries as part of the disclosure surface + design-permitted private-log substrate; §10 (withdrawal and reinstatement lifecycle) renamed to "Lifecycle and location attestations" and rewritten in four sub-sections (§10.1 lifecycle chain; §10.2 location as attestation; §10.3 retention asymmetry as normative property; §10.4 backwards compatibility for pre-ADR-0010 packages with legacy DB-row lifecycle state); §18 related-documents list extended with ADR-0010. Schema version unchanged at `0.1.0` per [Q27](open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec); pre-ADR-0010 packages remain verifiable byte-identical (legacy `withdrawnAt` / `reinstatedAt` columns honored at verification time; one-time migration to attestation envelopes is a Phase 3 implementation item). [civic-ai-tools-website#58](https://github.com/npstorey/civic-ai-tools-website/issues/58) (multi-cycle withdraw/reinstate refactor) closes as obsolete — multi-cycle support is free by construction in the attestation framing. [Q20](open-questions.md#q20--visibility-lifecycle-and-attestpublish-semantics) spec resolution lands here; implementation tracking continues on [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71).
- **2026-05-25** — Unified typed-attestation primitive cohort (G2, per the 2026-05-25 strategic memo §5 sequencing items 2 + 3). [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) ratifies one structural envelope underlying both content/* and attestation/* families, two top-level type families distinguished by `targetNodeId` presence, formal `nodeId` ≡ envelope hash (memo §3 finding #3 two-identifier formalization), `sig` vs. `signer` split with verifier identity cross-check (resolves Q35), authorization-rule taxonomy (`publisher-only`, `any-with-binding`, `specific-role-required`), sub-type URI format (`content/<noun>/v<N>` and `attestation/<verb>/v<N>`), the Q36 ratified sub-type table (with three refinements: extractsTo merges into wasDerivedFrom; endorses/corroborates stay distinct; Q38 confirms locatedAt suffices), and the absorption of Q11 (typed claims as content/* with extraction as attestation/wasDerivedFrom/v1) + Q12 (upstream-evidence relations as attestation/* sub-types). Changes: §3 gains entries for `Signed node`, `type`, `content/* namespace`, `attestation/* namespace`, `nodeId`, `signer`; §4.1 gains `type` row + `signer` row + `targetNodeId` row; §6.1 gains a paragraph articulating the sig vs signer split and the verifier cross-check rule; §6.3 gains `signerIdentity` field per registry entry; §12 (upstream evidence references) rewritten to retire the `upstream-evidence.json` companion-file design and map the relation vocabulary to `attestation/*` sub-types per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §8; §13.1 verification checks renumbered to 14 with three new checks (`type` resolution, `nodeId` cross-check, `signer.identifier` cross-check) per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4; §15 (attestations) rewritten around the `attestation/*` namespace with sub-type mapping for existing `consistency` / `evaluation` / `expert_attestation` kinds, conformance requirements for `attestation/*` nodes, and verifier expectations when an original package has referencing attestations; §18 related-documents list extended with ADR-0009. Schema version unchanged at `0.1.0` per [Q27](open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec); pre-ADR-0009 packages remain verifiable byte-identical per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §9 (implicit `content/analysis/v1` `type`; legacy `signer` derived from trust registry). Resolves Q11 (typed claims as attestation), Q12 (upstream-evidence as attestation), Q35 (public-key location), Q36 (attestation sub-type collapse), Q38 (copyOf vs locatedAt); Q37 (type-registry mechanism) stays Xanadu-gated.
- **2026-05-25** — Two-kinds-of-canonicalization split + multihash `contentHash` cohort (G1, per the 2026-05-25 strategic memo §5 sequencing item 1). Paired ADRs [ADR-0007](../adr/0007-content-canonicalization.md) (sixth envelope field `contentCanonicalization`) and [ADR-0008](../adr/0008-multihash-content-hash.md) (multihash `contentHash` + RFC 8785 JCS envelope canonicalization + signature-chain update). Changes: §1.1 list updated; §3 gains "Content hash", "Envelope hash", and "Content canonicalization" definitions (replacing "Package hash") and updates "Signed envelope" + `kid` definitions; §4.1 gains `contentHash` and `contentCanonicalization` rows; §5 rewritten around the envelope-level / content-level canonicalization split with RFC 8785 JCS as the fixed envelope-level rule and the `contentCanonicalization` URI as the variable content-level rule selector; §6.1 signature mechanics updated to specify the JCS-envelope-hash chain (`SHA-256(JCS(unsigned envelope))` → hex → UTF-8 → Ed25519ph) and to clarify that `contentHash` + `contentCanonicalization` are signature-covered envelope fields; §13.1 verification checks renumbered from 9 to 11 with two new checks for content-canonicalization rule resolution + at-least-one-match multihash content-hash verification; §13.1 trailing paragraph updated for the renumbered check references; §18 related-documents list extended with ADR-0007 + ADR-0008. Schema version unchanged at `0.1.0` per [Q27](open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec); pre-ADR-0007/0008 packages remain verifiable byte-identical under the legacy rules per ADR-0007 §4 + ADR-0008 §4. Resolves [Q34](open-questions.md#q34--adopt-rfc-8785-jcs-for-unsigned-envelope-canonical-serialization) (JCS envelope canonicalization) via ADR-0008 §6; resolves the BLAKE3 candidate of [Q18](open-questions.md#q18--standards-adoption-review-blake3-data-package-standard-dcat-us3-codata-semantic-markdown) as a multihash-codec-table addition via ADR-0008 §2.
- **2026-05-19** — `datHere` reframed from a captureMethod variant to a `contentProfile` value (the 2026-05-18 entry below describes the original framing). Phase 2 smoke testing surfaced that `captureMethod` (integrity-of-capture per ADR-0003) and content shape are orthogonal: chat-flow-stream captures can have either the legacy content shape or the A-G envelope. Changes from the 2026-05-18 state: §3 (definitions) gains a `contentProfile` entry; §4.1 gains a `contentProfile` row and reframes the `summary` row's required-when clause to reference `contentProfile === "datHere"`; §4.2 reverts the `captureMethod` row to three values; §4.6 reframes the `org.civicaitools.environment` extension paragraph as `contentProfile`-gated; §5 hash-coverage paragraph reframes accordingly; §9 main reverts to three captureMethod values and the original forward-extensibility callout; a transition paragraph is added before §9.1 explaining the §9.1-§9.3 framing change; §9.1 heading drops "captureMethod"; §9.1.1 requirement 7 changes from `metadata.captureMethod === "datHere"` to `metadata.contentProfile === "datHere"`; §9.2.1 commitment-view table gains a `contentProfile` row and revises the `captureMethod` row; §9.2.2 and §9.2.3 examples carry `captureMethod: "chat-flow-stream"` + `contentProfile: "datHere"`; §9.2.4 cell-0 recommended fields call out both. Per the [ADR-0004 2026-05-19 status note](../adr/0004-dathere-captureMethod-variant.md), all substantive decisions (A-G envelope, notebook format, determinism property, commitment-view schema, embed-vs-reference policy) stand — only the field the new vocabulary attaches to changes.
- **2026-05-18** — `datHere` captureMethod variant added per [ADR-0004](../adr/0004-dathere-captureMethod-variant.md). *(Original framing; superseded by the 2026-05-19 reframe above. Retained for historical record.)* Changes: §4.1 gains optional `summary` field (required when `captureMethod == "datHere"`); §4.6 extension example list extended with `org.civicaitools.environment` and the existing `org.civicaitools.notebook` extension is promoted to normatively required under `datHere`; §9 vocabulary list extended with the `datHere` value; §9 forward-extensibility callout updated to reflect the fourth value; §9.1 (datHere content profile, with §9.1.1 normative requirements, §9.1.2 notebook format, §9.1.3 determinism property), §9.2 (cross-host commitment-view schema, with §9.2.1 field definitions, §9.2.2 notebook-embedded serialization under the `org.civicaitools.evidence` namespace, §9.2.3 sibling YAML file serialization, and §9.2.4 cell-0 rendering convention), and §9.3 (embed-vs-reference policy) added as new sub-sections. Schema version unchanged (`0.1.0`) — enum extension is a vocabulary change and added fields are backwards-compatible. Resolves Q21 and Q24 in the open-questions registry.

---

## 18. Related documents

- `civic-ai-tools/docs/architecture/end-state-vision.md` — architectural rationale, layered standards stack, network-signal model, full glossary, and the open-questions list this spec defers to.
- `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` — Civic Claim Vocabulary v0.1, the typed-claims layer reserved by §11.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — project discipline governing how this spec is allowed to grow; gating criteria for promoting items from speculative to designed to built.
- `civic-ai-tools/docs/adr/0001-roadmap-governance.md` — public-roadmap governance and quarterly cadence.
- `civic-ai-tools/docs/adr/0002-commitments-vs-targets.md` — distinction between absolute commitments and operational targets in `ROADMAP.md` §3.
- `civic-ai-tools/docs/adr/0003-evidence-capture-method.md` — the `captureMethod` field, vocabulary, and tamper-evident labeling. Authoritative for §9 (original three vocabulary values).
- `civic-ai-tools/docs/adr/0004-dathere-captureMethod-variant.md` — the `datHere` content profile (originally framed as a captureMethod variant; reframed 2026-05-19 per the ADR's status note), the A-G envelope shape, the notebook-format requirement, and the cross-host commitment-view publication schema (notebook-embedded + sibling-YAML serializations). Authoritative for §9.1, §9.2, and §9.3; resolves [Q21](open-questions.md#q21--canonical-notebook-format-for-dathere-capturemethod) and [Q24](open-questions.md#q24--embed-vs-reference-policy-for-attestations-in-published-artifacts). The filename retains the historical "captureMethod-variant" slug for stability of external references.
- `civic-ai-tools/docs/adr/0007-content-canonicalization.md` — the sixth top-level envelope field `contentCanonicalization`, naming the URI for the rule by which off-log content reduces to bytes that `contentHash` fingerprints. Authoritative for the content-level half of §5's two-kinds-of-canonicalization split; defines v0.1 reserved URIs for the datHere A-G/Jupyter and legacy-default rules; backwards-compat rules for pre-ADR-0007 packages. Paired with ADR-0008 in the 2026-05-25 cohort.
- `civic-ai-tools/docs/adr/0008-multihash-content-hash.md` — the multihash digest-set form for `contentHash` + the RFC 8785 JCS envelope canonicalization commitment + the signature-chain update. Authoritative for §5's envelope-level rule, §6.1's signature chain, and the at-least-one-match verifier semantics. Resolves [Q34](open-questions.md#q34--adopt-rfc-8785-jcs-for-unsigned-envelope-canonical-serialization) and the BLAKE3 candidate of [Q18](open-questions.md#q18--standards-adoption-review-blake3-data-package-standard-dcat-us3-codata-semantic-markdown). Paired with ADR-0007 in the 2026-05-25 cohort.
- `civic-ai-tools/docs/adr/0009-unified-typed-attestation-primitive.md` — one structural envelope, two top-level type families (`content/*` and `attestation/*`), formal `nodeId` ≡ envelope hash, `sig` vs `signer` split with identity cross-check, authorization-rule taxonomy, sub-type URI format, and the Q36 ratified sub-type table. Authoritative for §3 (definitions of `Signed node`, `type`, `content/*` and `attestation/*` namespaces, `nodeId`, `signer`), §4.1 (`type` + `signer` + `targetNodeId` rows), §6.1 (sig-vs-signer split + verifier cross-check), §6.3 (`signerIdentity` field), §12 (upstream-evidence reframe), §13.1 (checks 12-14), §15 (the `attestation/*` namespace + sub-type mapping for existing kinds + conformance requirements). Resolves Q11, Q12, Q35, Q36, Q38; Q37 stays Xanadu-gated.
- `civic-ai-tools/docs/adr/0010-visibility-lifecycle-location-attestations.md` — operationalizes the lifecycle/location sub-types from [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 (`attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/supersedes/v1`, `attestation/publishes/v1`, `attestation/locatedAt/v1`); reframes the BlobRef pattern as the single-signer implicit case of `locatedAt`'s verification rule; establishes the retention-asymmetry property statement, the privacy-disclosure note on the transparency log, the zero-location private/draft/enterprise base case, and the two-atomic-Rekor-entry publication property. Authoritative for §4.5 (BlobRef relationship to locatedAt), §6.2 (privacy-disclosure note), §10 (lifecycle and location attestations — the entire section). Spec resolution of [Q20](open-questions.md#q20--visibility-lifecycle-and-attestpublish-semantics); implementation tracking continues on [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71). Closes [civic-ai-tools-website#58](https://github.com/npstorey/civic-ai-tools-website/issues/58) as obsolete (multi-cycle support free by construction).
- `civic-ai-tools/docs/adr/0011-capturemethod-generalization.md` — generalizes the `captureMethod` field's value space at the core level (closed enum → open) and relocates the three existing values (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`) into the `ai-assisted-analysis` Producer Profile's v0.1 captureMethod vocabulary per [ADR-0006](../adr/0006-producer-profile-architecture.md) §5. Authoritative for §9's per-profile vocabulary lookup rule, §3's captureMethod definition (value-space half), §13.1 check 15 (per-profile vocabulary conformance with graceful-degradation on bundle-resolution failure). Partial-resolves [Q9](open-questions.md#q9--ai-specific-commitments-and-producer-type-generalization) for the captureMethod field specifically; other AI-specific fields (cost / skillMetadata / AnalyticalDerivation / BlobRef) follow the same pattern in subsequent passes. Does not supersede [ADR-0003](../adr/0003-evidence-capture-method.md); ADR-0003's field-shape / required-and-signed / tamper-evident / verbatim-by-construction discipline is unchanged.
- `civic-ai-tools/docs/proposals/data-concierge-integration.md` — the integration-arc proposal that scopes the four-issue cluster (civic#69-#72) ADR-0004 is the first of.
- `civic-ai-tools/ROADMAP.md` — public roadmap, trust commitments, out-of-scope items, and the evidence-protocol-fork resolution deadline of 2026-12-31.
- `civic-ai-tools/docs/research/landscape-analysis.md` — relationship to existing standards (PROV-O, RO-Crate, Croissant, DCAT, FAIR, DPI, CKAN ecosystem).
- `civic-ai-tools-website/docs/api/evidence-publish.md` — request/response contract for the canonical reference implementation. This document and the API doc MUST stay aligned; where they diverge, this document is normative for the package shape and the API doc is normative for the request/response contract.
- `civic-ai-tools-website/docs/key-rotation.md` — runbook for rotating the platform signing key.
