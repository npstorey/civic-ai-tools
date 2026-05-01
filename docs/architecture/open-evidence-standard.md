---
Status: Draft v0.1 (pre-stable, not for adoption)
Last updated: 2026-05-01
Maintainer: [TK: leave as placeholder]
---

> **This document is a working draft.** It represents the project's current best-thinking on the Open Evidence Standard. It is not yet a specification any third party should implement against. Major open questions are tracked inline and in the companion vision document. Stakeholder review is invited; no formal review process is yet defined.

---

# Open Evidence Standard

Schema version: `0.1.0`.

Conformance language follows [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) keywords (MUST, MUST NOT, SHOULD, MAY) when applied to normative requirements. Every normative requirement in this document corresponds either to a check enforced in `civic-ai-tools-website` code today or to a settled Architectural Decision Record in `civic-ai-tools/docs/adr/`. Where neither holds, the section is labeled with a `Status:` callout pointing at the relevant open question.

---

## 1. Introduction and scope

The Open Evidence Standard defines the structure, signing, and verification properties of an **evidence package**: a content-addressable, cryptographically signed record of a single AI-assisted civic-data analysis. A conformant package is verifiable by any third party using only the package itself, the published trust registry, and the public infrastructure of FreeTSA and Sigstore Rekor. No part of verification depends on trusting `civicaitools.org`.

### 1.1 What this document covers

- Required and optional fields of an evidence package as currently produced by `POST /api/evidence` and stored on Vercel Blob.
- The cryptographic envelope (Ed25519ph signature, RFC 3161 timestamp, Sigstore Rekor entry) and how it binds to package content.
- The package-hash and signature-verification rules a third-party verifier follows.
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

> **Status: open question — see `civic-ai-tools/docs/architecture/end-state-vision.md` §Open questions item #7 (producer-type scope).**

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

This is the only normative requirement in this document that is not enforced by code. It is enforced by stewardship of the standard.

---

## 3. Definitions

Terms below are used with the meanings given. **Normative** terms have specific meaning when used in conformance language; **informative** terms are used descriptively.

- **Evidence package** *(normative)*: The single canonical-JSON object produced by the publish path, identified by its SHA-256 hash, and stored at a content-addressable URL. See §4 for structure.
- **Package hash** *(normative)*: The SHA-256 hex digest of the canonical JSON serialization of the evidence package. The hash is the package's content-addressable identifier.
- **Signed envelope** *(normative)*: The package hash hex string, signed with Ed25519ph by a key in the trust registry. The envelope JSON object stored in the database also carries `publicKey`, `algorithm`, and `kid` fields for verifier convenience; signature math binds only the hash bytes.
- **Trust registry** *(normative)*: The JSON document at `${baseUrl}/.well-known/evidence-public-keys.json` that lists authorized signing keys with lifecycle metadata. See §6.3.
- **`kid` (key identifier)** *(normative)*: A stable string identifying a signing key (e.g. `platform:evidence-2026-04`), present in both the signed envelope and the trust registry. The `kid` is part of the canonical package JSON via `metadata.signingKeyId`, so it is covered by the package hash.
- **BlobRef** *(normative)*: A four-field JSON object `{ ref, url, contentType, size }` that names a content-addressable Vercel Blob in place of inline content for selected fields. See §4.5.
- **`captureMethod`** *(normative)*: The label identifying how the package's content was captured. One of `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`. Specified by [ADR-0003](../adr/0003-evidence-capture-method.md). See §9.
- **Trace** *(informative)*: An OpenTelemetry-shaped JSON object (or BlobRef) describing the spans of the analysis. See §7.
- **PROV-O graph** *(informative)*: A W3C PROV-O JSON-LD graph derived from the trace at publish time. See §4.4.
- **Withdrawal / reinstatement** *(normative)*: Signed, public, append-only lifecycle events on a published package. See §10.
- **Verifier** *(informative)*: Any party performing the checks described in §11 against a fetched package.

A broader vocabulary covering the surrounding architectural standards (PROV-O, Croissant, RO-Crate, atproto, KOI, nanopublications, etc.) is defined in `end-state-vision.md` Glossary and not duplicated here.

---

## 4. Evidence package structure

A conformant evidence package is a single JSON object whose canonical-JSON serialization is the input to the SHA-256 package hash.

> **Status: open question — see `end-state-vision.md` §Open questions item #1 (package format).** The current implementation is a single canonical JSON object plus a database-resident envelope. The current direction is a multi-file directory with an RO-Crate / WRROC compatibility profile, in which the canonical JSON object would become one artifact in a larger package. This v0.1 normalizes the single-blob form because that is what the publish path produces today; section §4 will be revised when the format decision lands.

### 4.1 Top-level fields

A conformant evidence package MUST carry every field in the following list. Fields marked optional MAY be omitted; when present, they MUST conform to the type given.

| Field | Type | Required | Description |
|---|---|---|---|
| `metadata` | object | yes | See §4.2. |
| `prompt` | object | yes | See §4.3. |
| `queries` | array of objects | yes | One entry per tool call observed during the analysis. May be empty. |
| `dataSources` | array of objects | yes | One entry per data source touched by the analysis, derived from `queries[]` and the trace. |
| `cost` | object | yes | Token-usage and timing summary. |
| `skillMetadata` | object | yes | Skill-guidance hash, MCP server URL, and skill text or BlobRef. |
| `output` | string \| BlobRef | yes | The assistant's final response text, or a BlobRef. See §4.5. |
| `trace` | object \| BlobRef | yes | OpenTelemetry-shaped trace, or a BlobRef to the same. |
| `provenance` | object | optional | W3C PROV-O JSON-LD graph derived from `trace` at publish time. Present when the trace was inspectable inline; omitted when `trace` is a BlobRef and no override is supplied. |
| `extensions` | object | optional | Reverse-DNS-keyed implementation-specific artifacts (e.g. `org.civicaitools.notebook`). Included in the canonical JSON and therefore covered by the package hash. |

### 4.2 `metadata` object

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | yes | Currently `0.1.0`. |
| `packageId` | string (UUID) | yes | A UUID generated at publish time. Distinct from the package hash. |
| `createdAt` | string (ISO 8601) | yes | UTC timestamp set at packager time. |
| `signingKeyId` | string | yes | The `kid` of the signing key. Present in the canonical JSON; therefore covered by the package hash. |
| `captureMethod` | string | yes (post-ADR-0003) | One of the three vocabulary values in §9. Required at the publish route since 2026-04-29. Pre-ADR-0003 packages persist with a `null` capture method on the database row and render with a "Unknown (pre-ADR-0003)" label. |

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

### 4.6 `extensions` (optional)

Implementations MAY add fields under `extensions` keyed by reverse-DNS identifiers (`org.civicaitools.notebook`, `org.<your-domain>.<your-extension>`). All extension content is part of the canonical JSON and is therefore covered by the package hash and the platform signature. Extensions are advisory — they MUST NOT change the meaning of fields defined in this standard, and a verifier MAY ignore unknown extensions without breaking conformance.

The `org.civicaitools.notebook` extension is a content-format marker (a Jupyter-style cell list) emitted by the canonical reference implementation. External implementations are not required to emit it.

---

## 5. Canonical JSON and the package hash

The package hash is the SHA-256 hex digest of the JSON serialization of the evidence-package object. The serialization rules below describe the *current reference implementation*; cross-implementation interop is an open implementation question.

- The reference implementation uses Node.js `JSON.stringify(pkg)` with no key-sorting transform; the packager and verify-route produce keys in matching insertion order, which is what makes recompute-and-compare work today.
- All field values defined in this standard — including `metadata.captureMethod`, `metadata.signingKeyId`, every `extensions` entry, and BlobRef objects — are part of the serialized JSON and therefore part of the hash.
- Fields that live on the database row but not in the canonical package object (such as `title`, `summary`, `verificationStatus`, `creatorId`) are NOT part of the serialized JSON and are NOT covered by the package hash.

A change to any in-package field — including a single character in `output`, a different `kid`, or a different `captureMethod` — produces a different hash, which produces a different content-addressable URL and a different signature.

> **Implementation gap (informative).** The reference implementation does not adopt [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) JSON Canonicalization Scheme (JCS). It relies on insertion-order key serialization being deterministic across packager and verifier code paths. A second compatible implementation written today could plausibly produce a different byte sequence for the same logical package and therefore a different hash. Adopting JCS or an equivalent canonicalization standard is a candidate refinement before cross-implementation interop matters.

---

## 6. Cryptographic envelope

This section describes the signing, timestamping, and transparency-log mechanisms applied to the package hash. All three legs are settled by current implementation and ADR-0003.

### 6.1 Signature

A conformant evidence package MUST be signed with **Ed25519ph** (the pre-hashed Ed25519 variant, RFC 8032 §5.1.2). The signature is computed over the UTF-8 bytes of the package-hash hex string, NOT over the raw 32-byte hash bytes. Implementations using `@noble/curves/ed25519` apply Ed25519ph's internal SHA-512 prehash automatically; implementations using primitives that expose only Ed25519 MUST NOT pre-hash on the application side.

The signed envelope persisted alongside the package is the JSON object:

```json
{
  "signature": "<base64>",
  "publicKey": "<base64 DER SPKI>",
  "algorithm": "Ed25519ph",
  "kid": "<key identifier>"
}
```

The `kid` and `publicKey` in the envelope MUST match the `kid` and `publicKey` of an entry in the trust registry. The `metadata.signingKeyId` field inside the package's canonical JSON MUST equal the envelope's `kid`. A `kid` swap on the envelope after publication therefore changes neither the package hash nor the package itself — the canonical JSON is unchanged — but is detectable as an envelope-vs-canonical mismatch by any verifier.

Signing is best-effort at publish time. If the signing leg fails, the database row persists with a `null` signature column; the package and its hash remain valid but it does not satisfy this standard's signed-package conformance. The reference implementation does not currently retry-on-failure.

### 6.2 Timestamp and transparency log

A conformant evidence package SHOULD also carry an RFC 3161 trusted timestamp from a public TSA and a Sigstore Rekor inclusion proof. The reference implementation uses `freetsa.org` for the timestamp and Rekor's `hashedrekord` v0.0.1 entry type for the transparency log. Both are best-effort: failures persist as `null` columns and the package remains queryable.

A verifier checks RFC 3161 against FreeTSA's published CA chain and Rekor inclusion against `rekor.sigstore.dev`. Neither check requires `civicaitools.org`.

### 6.3 Trust registry

The trust registry is published at `${baseUrl}/.well-known/evidence-public-keys.json`, currently `https://civicaitools.org/.well-known/evidence-public-keys.json`. It is a JSON object with a `keys` array of entries:

```json
{
  "kid": "platform:evidence-2026-04",
  "publicKey": "<base64 DER SPKI>",
  "status": "active",
  "activatedAt": "2026-04-15T00:00:00.000Z",
  "deprecatedAt": null,
  "revokedAt": null
}
```

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

> **Status: open question — see `end-state-vision.md` §Open questions item #4 (trace capture).**

The reference implementation captures a hand-rolled OpenTelemetry-shaped JSON document covering five span kinds: `analysis` (root), `skill_fetch`, `llm_inference`, `mcp_tool_call`, and `synthesis`. The trace is embedded in the package as the `trace` field (or a BlobRef to the same). The PROV-O graph in `provenance` is derived from this trace at publish time.

The hand-rolled builder is OTel-schema-compliant for the spans it emits but is **not** a real OpenTelemetry SDK. Adopters that bring their own OTel infrastructure cannot drop into the publish path without adapter work. The current direction is to either (a) adopt a real OTel SDK with the GenAI and MCP semantic conventions, or (b) layer Agent Receipts (W3C Verifiable Credentials over MCP tool calls) over or under the OTel layer. Both directions are tracked under Open Question #4.

This v0.1 draft normalizes the current span-kind set as conformant; the resolution of Open Question #4 will revise this section.

---

## 8. Identity binding

> **Status: open question — see `end-state-vision.md` §Open questions item #3 (first non-GitHub identity provider).**

The reference implementation binds package authorship to a GitHub OAuth account. The DB columns recording authorship (`github_id`, `display_name`, `github_profile_url`) are GitHub-specific. The signing key is platform-held; the user does not currently sign their own packages.

The current direction is a graded identity ladder: pseudonymous → weak (GitHub OIDC / sigstore keyless) → moderate (ORCID) → institutional (DNS-bound `did:web`) → strong (notarized). The ladder is informative for now; only the GitHub tier is implemented. Open Question #3 will resolve which non-GitHub provider lands first.

This v0.1 draft documents the GitHub binding as the only currently-conformant identity binding; the standard will gain a `creator.identity_binding` typed field once the ladder is live.

---

## 9. `captureMethod`

`captureMethod` is the label identifying how the package's content was captured. Specified by [ADR-0003](../adr/0003-evidence-capture-method.md).

A conformant evidence package published after 2026-04-29 MUST carry exactly one of the following values in `metadata.captureMethod`:

- **`chat-flow-stream`** — the publishing platform captured the bytes as the model streamed to the calling client. Verbatim by construction at the wire layer.
- **`claude-code-jsonl-readback`** — the publishing client (typically a Claude Code skill) read each turn's content and per-invocation usage from the session JSONL on disk, filtering to text-typed content blocks only. Verbatim by construction at the JSONL layer.
- **`claude-code-self-report`** — legacy. The publishing model paraphrased the original session from in-context memory. Deprecated as of 2026-04-28; retained as a vocabulary value so packages predating ADR-0003 can be re-rendered with their actual capture method labeled rather than silently re-described as something they were not.

The reference publish route enforces the field at request validation; a missing or invalid value returns `400`. The field is part of `metadata.captureMethod` in the canonical JSON and is therefore covered by the package hash and the platform signature: the capture method itself is tamper-evident.

A package's signature attests that the package was published and has not been altered since. It does NOT attest that the package's content matches what was actually generated in the original session — that property is structural and follows from the capture method. Surfaces SHOULD render the `captureMethod` label near the signature-verification verdict so readers do not conflate "signed" with "verbatim."

Pre-ADR-0003 packages persist with a `null` capture-method column on the database row. Surfaces SHOULD render these as `Unknown (pre-ADR-0003)` rather than defaulting to one of the three values.

Future capture methods (for example, a hook-based path that records bytes at message-emission time, or a third-party signed self-attestation) extend this enum. Per ADR-0003, an enum extension is a vocabulary change, not a key change — the platform continues to sign all capture methods under the same trust-registry keys; the label is the differentiation.

---

## 10. Withdrawal and reinstatement lifecycle

A package author MAY withdraw a published package at any time by signing a withdrawal record with the platform key. Withdrawal does not erase — it appends a signed lifecycle event that renders on the detail page and excludes the package from default listings.

The withdrawal record carries a free-text `reason` (required, non-empty) and is itself Ed25519ph-signed and RFC 3161-timestamped. The reference implementation stores withdrawal artifacts on the same database row as the original package: `withdrawnAt`, `withdrawnReason`, `withdrawalSignature`, `withdrawalTimestamp`.

An author MAY also reinstate a previously withdrawn package, which appends a second signed lifecycle event linking back to the prior withdrawal signature. Reinstatement records persist on `reinstatedAt`, `reinstatedReason`, `reinstatementSignature`, `reinstatementTimestamp`. The reinstatement signature binds to the prior withdrawal so a verifier can replay the lifecycle.

A verifier inspecting a withdrawn or reinstated package MUST report the lifecycle state alongside the standard verification verdicts. Withdrawal does not invalidate the original signature; the package remains verifiable as published.

A permanent record that a civic-data claim was made and later retracted is more honest than silent deletion. Implementations MUST NOT remove withdrawn packages from storage or registry-side listings except through explicit administrative action with an audit trail.

The reference implementation currently supports a single withdraw → reinstate cycle per package. Multi-cycle support is tracked as a separate refactor (`civic-ai-tools-website#58`). Future cycles SHOULD chain through `priorWithdrawalSignature` in the same way the first reinstatement does.

---

## 11. Typed claims

> **Status: open question — see `end-state-vision.md` §Open questions item #5 (`claims.jsonld` and `upstream-evidence.json` implementation timing).**

The Open Evidence Standard reserves space for a typed-claims layer in which a published package OPTIONALLY carries a `claims.jsonld` companion file containing structured assertions (TrendClaim, ComparisonClaim, ObservationClaim, etc.) that conform to the Civic Claim Vocabulary plus zero or more domain extensions. The v0.1 draft specification is at `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md`.

No code path currently generates `claims.jsonld`. No published package contains one. This v0.1 draft therefore makes no normative claim about typed claims beyond reserving the file location and namespace. When typed claims ship, this section will be revised to describe the conformant interaction with the rest of the package (signature coverage, hash sensitivity, derivation provenance from the LLM trace).

The Xanadu doctrine (`xanadu-doctrine.md`) gates promotion of typed claims from "designed" to "built" on a real adopter package whose verification or claim queries are blocked without the layer.

---

## 12. Upstream evidence references

> **Status: open question — see `end-state-vision.md` §Open questions item #5.**

The Open Evidence Standard reserves space for an `upstream-evidence.json` companion file that declares relationships to other evidence packages: `derived_from`, `compares_to`, `extends`, `replicates`, `contradicts`, `evaluates`. This enables citation graphs, cross-package meta-analysis, and adversarial-evaluation chains where the evaluation is itself a separately-signed evidence package linked to the original.

No code path currently generates `upstream-evidence.json`. No published package contains one. This v0.1 draft therefore makes no normative claim about upstream references beyond reserving the file location.

---

## 13. Verification properties

A verifier holding only a fetched evidence package, the trust registry, and access to FreeTSA and Rekor MUST be able to perform the following checks. Each check corresponds to code in the reference verify endpoint (`GET /api/evidence/<slug>/verify`) but does not depend on it — an offline implementation produces the same results.

### 13.1 What a verifier can check today

1. **Package integrity.** Recompute the SHA-256 over the canonical JSON of the fetched package; the result MUST equal the `packageHash` in the URL slug and the database row.
2. **Signature mathematics.** Verify the Ed25519ph signature over the package-hash hex string against the embedded `publicKey`. A mismatch fails this check.
3. **Trust-registry verdict.** Look up the envelope's `(kid, publicKey)` pair in the registry; apply the status semantics from §6.3.
4. **Timestamp validity.** When present, verify the RFC 3161 token against FreeTSA's CA chain.
5. **Transparency-log inclusion.** When present, resolve the Rekor entry id and verify the inclusion proof against `rekor.sigstore.dev`.
6. **BlobRef integrity.** For every BlobRef in the package (in `output`, `trace`, or `skillMetadata.skillText`), fetch, recompute SHA-256, and confirm size. See §4.5.
7. **Lifecycle state.** Detect withdrawal or reinstatement via the database row's lifecycle columns and verify the corresponding lifecycle signatures and timestamps. Surfaces MUST render the lifecycle state.
8. **`captureMethod` label.** Read `metadata.captureMethod`; render it alongside the signature verdict. The label is covered by the signature.

### 13.2 What a verifier cannot check today

A verifier cannot determine, from the package alone, any of:

1. Whether the captured analysis matches what was actually generated in the original session. The `captureMethod` label is the structural answer to this question; verbatim guarantees follow from the labeled mechanism, not from the signature.
2. Whether the assistant's prose or numerical outputs are correct. Correctness review is a separate, separately-signed attestation (see §15).
3. Whether the analysis was authored under coercion, paid promotion, or other conflicts of interest. The standard surfaces identity and provenance; the consumer applies judgment.
4. Whether the package's claims have been corroborated or contradicted by other packages. Cross-package operations require the upstream-evidence layer (§12, deferred).

### 13.3 Target end-state verifiability

The end-state architecture extends verifier checks with: (a) full offline verification including identity-binding strength once the graded ladder ships, (b) cross-package corroboration once `upstream-evidence.json` ships, (c) typed-claim conformance once `claims.jsonld` ships. None of these are conformant requirements in v0.1.

---

## 14. Federation and discoverability

> **Status: open question — see `end-state-vision.md` §Open questions items #2 (federation substrate) and #8 (Croissant outbound metadata).**

The reference implementation publishes packages as stable URLs on `civicaitools.org`. There is currently no federation transport: a package's canonical home is the URL on the publisher's registry; cross-registry discovery is manual.

The current direction names three candidate federation substrates (atproto firehose / labelers, KOI net with sensor nodes, nanopub network) and an orthogonal discoverability mechanism (outbound Croissant metadata at a well-known location on each evidence page, making packages discoverable via Hugging Face / Kaggle / CKAN / Schema.org-aware crawlers). Both questions are independent of the package format (§4) and the cryptographic envelope (§6).

This v0.1 draft makes no normative claim about federation transport or outbound metadata. Adopters running their own registries SHOULD publish to a stable, content-addressable URL and SHOULD honor the trust-registry contract for their own signing keys, but no specific federation protocol is required.

---

## 15. Attestations and consistency / evaluation

The reference implementation supports a separate type of artifact — an **attestation** — that comments on a previously-published package without modifying it. Attestation kinds in current use:

- `consistency` — repeat-publish runs of the same prompt to surface determinism/drift.
- `evaluation` — adversarial review by an LLM-as-judge against a rubric.
- `expert_attestation` — review by a named human expert with stated relationship to the original package.

An attestation is itself a signed artifact and is linked to the original package by hash. This v0.1 draft does not normatively specify the attestation schema; that work is pending and will land as a separate spec section once the schema stabilizes. Pending sections of this standard for attestations:

- Required envelope (the same Ed25519ph + RFC 3161 + Rekor pattern).
- Required link from attestation to original (canonical reference by package hash).
- Required attestation-kind vocabulary.
- Verifier expectations when an original package has one or more attestations.

Until then, implementations referencing the attestation surface SHOULD treat it as an out-of-band complement to the evidence package, not as part of the package itself.

---

## 16. Conformance

> **Status: open question.** Formal conformance criteria are themselves an open question. This section documents the operational understanding of conformance as it stands today.

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

---

## 18. Related documents

- `civic-ai-tools/docs/architecture/end-state-vision.md` — architectural rationale, layered standards stack, network-signal model, full glossary, and the open-questions list this spec defers to.
- `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` — Civic Claim Vocabulary v0.1, the typed-claims layer reserved by §11.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — project discipline governing how this spec is allowed to grow; gating criteria for promoting items from speculative to designed to built.
- `civic-ai-tools/docs/adr/0001-roadmap-governance.md` — public-roadmap governance and quarterly cadence.
- `civic-ai-tools/docs/adr/0002-commitments-vs-targets.md` — distinction between absolute commitments and operational targets in `ROADMAP.md` §3.
- `civic-ai-tools/docs/adr/0003-evidence-capture-method.md` — the `captureMethod` field, vocabulary, and tamper-evident labeling. Authoritative for §9.
- `civic-ai-tools/ROADMAP.md` — public roadmap, trust commitments, out-of-scope items, and the evidence-protocol-fork resolution deadline of 2026-12-31.
- `civic-ai-tools/docs/research/landscape-analysis.md` — relationship to existing standards (PROV-O, RO-Crate, Croissant, DCAT, FAIR, DPI, CKAN ecosystem).
- `civic-ai-tools-website/docs/api/evidence-publish.md` — request/response contract for the canonical reference implementation. This document and the API doc MUST stay aligned; where they diverge, this document is normative for the package shape and the API doc is normative for the request/response contract.
- `civic-ai-tools-website/docs/key-rotation.md` — runbook for rotating the platform signing key.
