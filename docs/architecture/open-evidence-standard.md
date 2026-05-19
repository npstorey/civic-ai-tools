---
Status: Internal working draft (pre-v0.1)
Last updated: 2026-05-01
Maintainer: [TK: leave as placeholder]
---

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

- **Evidence package** *(normative)*: The single canonical-JSON object produced by the publish path, identified by its SHA-256 hash, and stored at a content-addressable URL. See §4 for structure.
- **Package hash** *(normative)*: The SHA-256 hex digest of the canonical JSON serialization of the evidence package. The hash is the package's content-addressable identifier.
- **Signed envelope** *(normative)*: The package hash hex string, signed with Ed25519ph by a key in the trust registry. The envelope JSON object stored in the database also carries `publicKey`, `algorithm`, and `kid` fields for verifier convenience; signature math binds only the hash bytes.
- **Trust registry** *(normative)*: The JSON document at `${baseUrl}/.well-known/evidence-public-keys.json` that lists authorized signing keys with lifecycle metadata. See §6.3.
- **`kid` (key identifier)** *(normative)*: A stable string identifying a signing key (e.g. `platform:evidence-2026-04`), present in both the signed envelope and the trust registry. The `kid` is part of the canonical package JSON via `metadata.signingKeyId`, so it is covered by the package hash.
- **BlobRef** *(normative)*: A four-field JSON object `{ ref, url, contentType, size }` that names a content-addressable Vercel Blob in place of inline content for selected fields. See §4.5.
- **`captureMethod`** *(normative)*: The label identifying how the package's content was captured. One of `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`, `datHere`. Specified by [ADR-0003](../adr/0003-evidence-capture-method.md) (original three values) and [ADR-0004](../adr/0004-dathere-captureMethod-variant.md) (`datHere` variant). See §9.
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
| `summary` | string | optional | Short, indexable, citation-ready summary of the analysis. Required when `metadata.captureMethod == "datHere"` (see §9.1). When present, part of canonical JSON and therefore covered by the package hash and signature. |
| `provenance` | object | optional | W3C PROV-O JSON-LD graph derived from `trace` at publish time. Present when the trace was inspectable inline; omitted when `trace` is a BlobRef and no override is supplied. |
| `extensions` | object | optional | Reverse-DNS-keyed implementation-specific artifacts (e.g. `org.civicaitools.notebook`, `org.civicaitools.dathere.environment`). Included in the canonical JSON and therefore covered by the package hash. |

### 4.2 `metadata` object

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | yes | Currently `0.1.0`. |
| `packageId` | string (UUID) | yes | A UUID generated at publish time. Distinct from the package hash. |
| `createdAt` | string (ISO 8601) | yes | UTC timestamp set at packager time. |
| `signingKeyId` | string | yes | The `kid` of the signing key. Present in the canonical JSON; therefore covered by the package hash. |
| `captureMethod` | string | yes (post-ADR-0003) | One of the vocabulary values in §9 (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`, `datHere`). Required at the publish route since 2026-04-29. Pre-ADR-0003 packages persist with a `null` capture method on the database row and render with a "Unknown (pre-ADR-0003)" label. |

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

> ⚠ **Subject to Open Question #2 — federation substrate.** BlobRef URLs in the reference implementation point at the deployment's Vercel Blob storage. The substitution mechanism is a single-host content-addressable pattern, not a federation-aware one. Generalizing to multi-host or multi-registry blob storage — including content-addressable storage that does not require an HTTPS-fetchable URL at all (e.g. IPFS-style addressing) — depends on which federation substrate Open Question #2 selects. The shape of `BlobRef` and the verification rules above are unchanged for v0.1; a future revision will specify how non-Vercel hosts and federation-substrate-native addressing fit.

### 4.6 `extensions` (optional)

Implementations MAY add fields under `extensions` keyed by reverse-DNS identifiers (`org.civicaitools.notebook`, `org.civicaitools.dathere.environment`, `org.<your-domain>.<your-extension>`). All extension content is part of the canonical JSON and is therefore covered by the package hash and the platform signature. Extensions are advisory — they MUST NOT change the meaning of fields defined in this standard, and a verifier MAY ignore unknown extensions without breaking conformance.

The `org.civicaitools.notebook` extension is a content-format marker (a Jupyter-style cell list) emitted by the canonical reference implementation. External implementations are not required to emit it. Under `captureMethod: datHere`, this extension is promoted from informative to normatively required and carries the deterministic notebook of section E (see §9.1).

The `org.civicaitools.dathere.environment` extension carries environment metadata (model version, temperature, sampling parameters, tool definitions, publishing-host identifier) required by the `datHere` captureMethod variant. See §9.1 for its required shape. Other implementations MAY define their own reverse-DNS-keyed extensions for content not otherwise covered by the standard.

### 4.7 `cost` object framing

The `cost` object's current schema (`promptTokens`, `completionTokens`, `totalTokens`, `model`, `durationMs`) is AI-LLM-specific. It presupposes that the analysis was produced by a token-billed language model.

> ⚠ **Subject to Open Question #7 — producer-type scope.** The `cost` object's schema is currently AI-specific. If Open Question #7 resolves toward generalization to human-authored or hybrid-authored packages, this object will need a producer-type-aware shape (human time, compute time, third-party API costs, etc.). The current shape stays normative for AI-produced packages in v0.1; downstream generalization will land as a separate revision.

---

## 5. Canonical JSON and the package hash

The package hash is the SHA-256 hex digest of the JSON serialization of the evidence-package object. The serialization rules below describe the *current reference implementation*; cross-implementation interop is an open implementation question.

- The reference implementation uses Node.js `JSON.stringify(pkg)` with no key-sorting transform; the packager and verify-route produce keys in matching insertion order, which is what makes recompute-and-compare work today.
- All field values defined in this standard — including `metadata.captureMethod`, `metadata.signingKeyId`, every `extensions` entry, and BlobRef objects — are part of the serialized JSON and therefore part of the hash.
- Fields that live on the database row but not in the canonical package object (such as `title`, `verificationStatus`, `creatorId`) are NOT part of the serialized JSON and are NOT covered by the package hash. The `summary` field is optionally part of the canonical JSON per §4.1 (required for `datHere`-captured packages, optional for others); when present in the package, it IS covered by the hash. Packages produced before ADR-0004, or non-`datHere` packages whose publishers keep `summary` only on the database row, hash exactly as they did before.

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

A verifier checks RFC 3161 against FreeTSA's published CA chain and Rekor inclusion against `rekor.sigstore.dev` once it has obtained the timestamp token and the Rekor entry id. The cryptographic *check* of these proofs requires only public infrastructure; the *retrieval* of the proofs themselves currently depends on `civicaitools.org` because the package JSON does not embed them. See §13 for the full verification surface and the Open Question #1 callout in §4 for the target end-state where these are embedded in the package itself.

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

`captureMethod` is the label identifying how the package's content was captured. Specified by [ADR-0003](../adr/0003-evidence-capture-method.md).

A conformant evidence package published after 2026-04-29 MUST carry exactly one of the following values in `metadata.captureMethod`:

- **`chat-flow-stream`** — the publishing platform captured the bytes as the model streamed to the calling client. Verbatim by construction at the wire layer.
- **`claude-code-jsonl-readback`** — the publishing client (typically a Claude Code skill) read each turn's content and per-invocation usage from the session JSONL on disk, filtering to text-typed content blocks only. Verbatim by construction at the JSONL layer.
- **`claude-code-self-report`** — legacy. The publishing model paraphrased the original session from in-context memory. Deprecated as of 2026-04-28; retained as a vocabulary value so packages predating ADR-0003 can be re-rendered with their actual capture method labeled rather than silently re-described as something they were not.
- **`datHere`** — the Civic AI Tools answer pipeline captured the analysis as a content-addressable bundle organized as the A-G envelope content profile (§9.1) and consumable as a notebook-plus-rendered-answer commit on a git host (§9.2). The cryptographic envelope is bound to the package hash; the rendered answer is recomputable from the package's notebook section against the documented runtime. Reproducible-by-construction against a documented runtime layer. Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).

The reference publish route enforces the field at request validation; a missing or invalid value returns `400`. The field is part of `metadata.captureMethod` in the canonical JSON and is therefore covered by the package hash and the platform signature: the capture method itself is tamper-evident.

A package's signature attests that the package was published and has not been altered since. It does NOT attest that the package's content matches what was actually generated in the original session — that property is structural and follows from the capture method. Surfaces SHOULD render the `captureMethod` label near the signature-verification verdict so readers do not conflate "signed" with "verbatim."

Pre-ADR-0003 packages persist with a `null` capture-method column on the database row. Surfaces SHOULD render these as `Unknown (pre-ADR-0003)` rather than defaulting to one of the listed values.

Future capture methods (for example, a hook-based path that records bytes at message-emission time, or a third-party signed self-attestation) extend this enum. Per ADR-0003, an enum extension is a vocabulary change, not a key change — the platform continues to sign all capture methods under the same trust-registry keys; the label is the differentiation.

> ⚠ **Subject to forward-extensibility.** The four values above anchor on the publishing surfaces that exist today: a website chat flow (`chat-flow-stream`), a Claude Code skill (`claude-code-jsonl-readback`), an earlier paraphrasing pattern retained for label honesty (`claude-code-self-report`), and the Civic AI Tools answer pipeline producing cross-host bundles (`datHere`). Other CLIs (Codex CLI, Cursor's MCP runtime, Gemini CLI), other IDEs (VS Code with GitHub Copilot, Zed), other execution environments (sandboxed runners, hosted notebooks), and speculative future surfaces (a sandbox-environment capture, an MCP-host-agnostic capture protocol) will need new vocabulary values. The current values stay normative for v0.1; ADR-0003 governs the original three values, [ADR-0004](../adr/0004-dathere-captureMethod-variant.md) governs the `datHere` value, and future extensions will require their own ADRs that preserve the structural property each value carries (verbatim-by-construction at *some* layer, or reproducibility-by-construction against a documented runtime, with the layer or property named).

### 9.1 `datHere` captureMethod content profile

> ⚠ **Resolves [Q21](open-questions.md#q21--canonical-notebook-format-for-dathere-capturemethod) (canonical notebook format for datHere captureMethod). Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).**

A `datHere`-captured package organizes its content as the **A-G envelope**, a profile over the existing top-level fields specified in §4. The envelope is a content profile, not a new container: the package remains the single canonical JSON object whose SHA-256 is the package hash. A-G is the way a `datHere`-captured package's content is *organized for readers and cross-host publishing*; the OES top-level fields are still what gets hashed and signed.

The A-G section-to-field mapping:

| Section | Content | OES field |
|---|---|---|
| A | Initial prompt — the user's question, verbatim | `prompt.text` (with `prompt.visibility == "full_text"`) |
| B | System prompt(s) active for the model | `skillMetadata.skillText` |
| C | Model card + environment metadata: model ID/version, temperature, sampling parameters, MCP server URLs, tool definitions, publishing-host identifier | `cost.model` + `skillMetadata.mcpServerUrl` + `extensions["org.civicaitools.dathere.environment"]` (§9.1.1) |
| D | Deliberative trace: thinking, tool calls, and tool results in order | `trace` (OTel-shaped, or BlobRef) + `queries[]` |
| E | Answer notebook — a notebook that, when executed against the documented runtime, produces F | `extensions["org.civicaitools.notebook"]` (§9.1.2) |
| F | The rendered answer | `output` (string or BlobRef) |
| G | Short, indexable, citation-ready summary | `summary` (§4.1) |

The remainder of this section specifies the normative requirements `datHere` adds to those fields.

#### 9.1.1 Normative requirements

A conformant `datHere`-captured package MUST satisfy *every* requirement below, in addition to the standard's existing requirements for conformant packages (§4, §5, §6, §9).

1. **Prompt visibility.** `prompt.visibility` MUST be `"full_text"`. The hash-only mode is incompatible with the A-G envelope, which requires section A to be readable.
2. **System prompt(s) present.** `skillMetadata.skillText` MUST be non-empty (inline string or BlobRef) and MUST reflect the composed system prompt set the model was operating under at the time of the analysis.
3. **Environment metadata present.** The `extensions["org.civicaitools.dathere.environment"]` object MUST be present and MUST contain at least: `modelVersion` (string), `temperature` (number), `mcpServers` (array of objects with `url` and optional `name`), `toolDefinitions` (array of tool-schema objects, OR a BlobRef when large), `host` (string identifying the publishing host, e.g. `"civicaitools.org"` or an external publisher's host identifier). Additional fields are permitted under reverse-DNS sub-namespacing.
4. **Notebook present.** The `extensions["org.civicaitools.notebook"]` object MUST be present, MUST conform to a notebook format admitted by §9.1.2, and MUST satisfy the determinism property in §9.1.3. Where the notebook is too large to inline, it MAY be supplied as a BlobRef.
5. **Rendered answer present.** `output` MUST be present (inline or BlobRef) and MUST be the rendered output of executing the notebook against the documented runtime at publish time.
6. **Summary present.** `summary` (§4.1) MUST be present, MUST be non-empty, and SHOULD be short enough to surface in citation contexts (recommended ≤ 280 characters; not enforced numerically).
7. **Capture-method label.** `metadata.captureMethod` MUST be `"datHere"`. The label is itself covered by the canonical-JSON hash and the platform signature per §9.

A verifier encountering a `datHere`-labeled package that fails any of the requirements above MUST report the package as malformed-for-`datHere` while still being able to perform the standard envelope-integrity checks (§13.1). Non-`datHere` capture methods continue to use their existing requirements; the requirements above apply only when `metadata.captureMethod == "datHere"`.

#### 9.1.2 Notebook format

A conformant `datHere`-captured package's section E (the notebook) MUST conform to **Jupyter Notebook Format v4.5 or later** (nbformat 4), expressed as the JSON cell structure with a top-level `cells` array, per the public nbformat specification. Jupyter is the v1 default because it matches the pattern in use at the pilot integration partner and has the broadest ecosystem support (rendering, diffing, archival, citation tooling).

This standard admits alternative notebook formats — most notably Marimo, which has stronger determinism properties via reactive evaluation and no hidden state — as conforming notebook formats for `datHere`-captured packages, provided they:

1. Produce a self-contained executable representation whose execution against the documented runtime is reproducible (no hidden inputs, no cell-order-dependent state that is not re-evaluable);
2. Carry an explicit content-type marker on the `extensions["org.civicaitools.notebook"]` entry indicating which format is in use (e.g., a `"format"` sub-field with values like `"jupyter-v4.5"` or `"marimo-v0.x"`);
3. Are accompanied by a renderer that produces section F (the rendered answer) from section E.

The protocol-level property the standard locks is **deterministic reproducibility**, not the choice of notebook engine. A future ADR may promote Marimo (or another format) to a second normative default without superseding this one if a real adopter requires it. Until then, `datHere`-captured packages SHOULD default to Jupyter v4.5+.

#### 9.1.3 Determinism property

A `datHere`-captured package's section E (the notebook) is **deterministic against a documented runtime environment plus stable upstream data**. The standard articulates this property explicitly because conflating "verifiable" with "the same answer forever" is the predictable failure mode.

1. The notebook MUST record its runtime requirements (language version, library versions, MCP server URLs) either in its first cell or in a sidecar `requirements` field on the `extensions["org.civicaitools.dathere.environment"]` object.
2. Re-execution of the notebook against the documented runtime, with the same MCP server endpoints reachable and the same upstream data unchanged since publication, SHOULD reproduce section F (the rendered answer) byte-for-byte modulo non-deterministic formatting (timestamps in tool-call results, floating-point representations that depend on platform libc, etc.).
3. The determinism property is **best-effort**, not absolute. Civic data is live; an upstream dataset updated since publication will produce different tool-call results on re-execution, which will produce a different rendered answer. This is expected behavior, not a verification failure.
4. Verifiers and surfaces SHOULD render the determinism property as *"reproducible against the documented runtime AND the upstream-data state at publish time,"* not as *"the same answer forever."*

The signature attests that the notebook in section E has not been altered since publication. It does NOT attest that re-executing it tomorrow produces the same answer as today; the upstream data may have changed. This is the `datHere` analog of the chat-flow-stream / JSONL-readback "verbatim-by-construction at *some* layer, with the layer named" property: the layer named is *the documented runtime against the upstream-data state at publish time*, and the property promised is *reproducibility against that layer*, not invariance.

### 9.2 Cross-host publication: GitHub-frontmatter schema

> ⚠ **Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).**

A `datHere`-captured package MAY be published cross-host as a multi-file commit on a git host. The frontmatter at the top of the published commit's primary markdown file carries the package's **commitment view** — enough fields for any reader to independently verify the package against the publisher's trust registry without fetching the canonical-JSON package object.

The frontmatter schema is YAML-shaped. A conformant cross-host publication carries the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `evidenceProtocolVersion` | string | yes | The OES schema version this commit was published against (currently `0.1.0`). |
| `packageHash` | string (hex SHA-256) | yes | The SHA-256 hex digest of the canonical-JSON package object. The package's content-addressable identifier. |
| `packageUrl` | string (URL) | yes | The content-addressable URL where the canonical-JSON package is fetchable. Reference implementation: Vercel Blob URL. Other hosts MAY serve from their own content-addressable storage. |
| `captureMethod` | string | yes | `datHere` for commits produced under this section. Future capture-method variants MAY define their own cross-host publication patterns or reuse this one. |
| `signature` | object | yes | Signed-envelope object. Shape: `{ signature, publicKey, algorithm, kid }` matching §6.1. |
| `signerIdentity` | object | yes | Identity binding for the package's author. Shape matches the OES identity-binding model (§8); GitHub-bound today, future identity providers extend the field shape per Q3. |
| `rfc3161Timestamp` | string (base64) | optional | RFC 3161 trusted timestamp token. Present when the publisher's pipeline obtains one. |
| `rekorEntryId` | string | optional | Sigstore Rekor entry identifier. Present when the publisher's pipeline obtains one. |
| `rekorInclusionProof` | string (base64) | optional | Sigstore Rekor inclusion proof bytes. Present when the publisher's pipeline obtains one. |
| `trustRegistryUrl` | string (URL) | yes | The `.well-known/evidence-public-keys.json` URL where the publisher's trust registry is served. Lets a reader resolve `signature.kid` independently of the publishing host. |
| `attestations` | array | optional | Array of attestation entries. Each entry is either a reference (§9.3) or an embed (§9.3). |
| `subjectTitle` | string | yes | Human-readable title of the analysis. Matches the publisher's database `title` field. |
| `subjectSummary` | string | yes | The G-section summary. Matches the canonical-JSON `summary` field (§9.1.1 requirement 6). |

The commit body (everything after the frontmatter) is the rendered content of A through G with one section per markdown heading. The notebook section (E) is included as either an inline fenced code block (small notebooks) or as a sibling file in the same commit (large notebooks) with a relative-path reference in the markdown. The rendered answer (F) is similarly inline or a sibling file.

A reader holding only the published commit + the publisher's trust registry + FreeTSA + Sigstore Rekor can verify the package's cryptographic envelope. The `civicaitools.org`-dependency property described in §13 is unchanged by this section (offline verifiability is still gated on [Q1](open-questions.md#q1--package-format) resolution), but the cross-host publication pattern *makes the package's content* independent of the originating host as long as the trust registry remains independently reachable.

Bundle-export endpoints on conformant publishers produce the entire multi-file set as a single response (frontmatter + sibling files); the reference implementation's contract is in `civic-ai-tools-website/docs/api/evidence-publish.md`. Bundle endpoints are advisory — a publisher MAY support cross-host publication by manual commit construction without offering a bundle endpoint.

### 9.3 Embed-vs-reference policy for cross-host publication

> ⚠ **Resolves [Q24](open-questions.md#q24--embed-vs-reference-policy-for-attestations-in-published-artifacts) (embed-vs-reference policy for attestations in published artifacts). Specified by [ADR-0004](../adr/0004-dathere-captureMethod-variant.md).**

The `attestations` array in the frontmatter (§9.2) MAY contain entries in either of two forms.

**Reference form** is the default. A reference entry is a JSON object with the following fields:

```yaml
- kind: <attestation kind>
  targetHash: <SHA-256 of the package this attestation is about>
  attestationHash: <SHA-256 of the canonical-JSON attestation object>
  attestationUrl: <URL where the canonical-JSON attestation is fetchable>
```

A reader processing a reference entry fetches the attestation from `attestationUrl`, recomputes its SHA-256 against `attestationHash`, and verifies its signature against the publisher's trust registry (the same `trustRegistryUrl` from the frontmatter, or a different registry URL carried inside the attestation itself).

**Embed form** is an optimization for attestations that are stable and load-bearing for trust evaluation. An embed entry is the complete signed attestation envelope, inline:

```yaml
- kind: <attestation kind>
  targetHash: <SHA-256 of the package this attestation is about>
  attestationHash: <SHA-256 of the embedded canonical-JSON>
  attestation: <inline canonical-JSON attestation object>
  signature: <signed-envelope object matching §6.1>
```

A reader processing an embed entry verifies the embedded envelope's signature directly without fetching anything. Both forms preserve independent verifiability: an embedded attestation carries its own signature, so a reader can verify it even if the surrounding frontmatter has been altered (the alteration would break the package-hash check anyway, but the embed-vs-reference distinction is orthogonal to the package signature).

**Default-to-reference rule.** Implementations SHOULD prefer reference form for routine attestations (corroborations from other authors, contradictions, citations) and SHOULD use embed form only when an attestation is structurally tied to the published claim's trust state — for example, an admin-approve attestation that establishes a corroboration relationship between an original committed claim and a publication-record, or a host-policy attestation that gates publication on adversarial-evaluation presence.

A reader encountering an embedded attestation MUST verify its signature against the publisher's trust registry just like any other attestation; the embed/reference distinction is a fetch-time vs. frontmatter-size trade, not a trust trade.

The attestation-kind vocabulary itself (`corroboration`, `contradiction`, `correction`, `withdrawal`, `evaluation`, `expert_attestation`, `consistency`, etc.) is governed by §15 and is not normatively closed by this section. The cross-host publication schema accepts any attestation kind the publisher emits; readers and downstream consumers apply their own filters.

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

> ⚠ **Subject to Open Question #5 — `claims.jsonld` and `upstream-evidence.json` implementation timing.** Designed but not built. Also subject to Open Question #11 (typed claims as a kind of attestation), which may reframe how `claims.jsonld` integrates with the attestations infrastructure.

The Open Evidence Standard reserves space for a typed-claims layer in which a published package OPTIONALLY carries a `claims.jsonld` companion file containing structured assertions (TrendClaim, ComparisonClaim, ObservationClaim, etc.) that conform to the Civic Claim Vocabulary plus zero or more domain extensions. The v0.1 draft specification is at `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md`.

No code path currently generates `claims.jsonld`. No published package contains one. This v0.1 draft therefore makes no normative claim about typed claims beyond reserving the file location and namespace. When typed claims ship, this section will be revised to describe the conformant interaction with the rest of the package (signature coverage, hash sensitivity, derivation provenance from the LLM trace).

The Xanadu doctrine (`xanadu-doctrine.md`) gates promotion of typed claims from "designed" to "built" on a real adopter package whose verification or claim queries are blocked without the layer.

---

## 12. Upstream evidence references

> ⚠ **Subject to Open Question #5 — `claims.jsonld` and `upstream-evidence.json` implementation timing.** Also subject to Open Question #12 (attestations as the implementation path for upstream-evidence references), which may collapse this section into the attestations infrastructure rather than implementing a separate `upstream-evidence.json` companion file.

The Open Evidence Standard reserves space for an `upstream-evidence.json` companion file that declares relationships to other evidence packages: `derived_from`, `compares_to`, `extends`, `replicates`, `contradicts`, `evaluates`. This enables citation graphs, cross-package meta-analysis, and adversarial-evaluation chains where the evaluation is itself a separately-signed evidence package linked to the original.

No code path currently generates `upstream-evidence.json`. No published package contains one. This v0.1 draft therefore makes no normative claim about upstream references beyond reserving the file location.

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

1. **Package integrity.** Recompute the SHA-256 over the canonical JSON of the fetched package; the result MUST equal the `packageHash` in the URL slug and the verify-endpoint response.
2. **Signature mathematics.** Verify the Ed25519ph signature (obtained from the verify endpoint) over the package-hash hex string against the embedded `publicKey`. A mismatch fails this check.
3. **Trust-registry verdict.** Look up the envelope's `(kid, publicKey)` pair in the trust registry; apply the status semantics from §6.3.
4. **`metadata.signingKeyId` consistency.** Confirm the `kid` from the signature envelope equals `metadata.signingKeyId` in the package. A mismatch indicates an envelope-vs-canonical drift (see §6.1).
5. **Timestamp validity.** When the verify endpoint returns a non-null RFC 3161 token, verify the token against FreeTSA's CA chain. The verification math itself does not depend on `civicaitools.org`.
6. **Transparency-log inclusion.** When the verify endpoint returns a non-null Rekor entry id, resolve the entry against `rekor.sigstore.dev` and verify the inclusion proof. The math does not depend on `civicaitools.org`.
7. **BlobRef integrity.** For every BlobRef in the package, fetch the URL over HTTPS, recompute SHA-256, and confirm size. See §4.5.
8. **Lifecycle state.** Detect withdrawal or reinstatement via the verify endpoint's lifecycle fields and verify the corresponding lifecycle signatures and timestamps. Surfaces MUST render the lifecycle state.
9. **`captureMethod` label.** Read `metadata.captureMethod`; render it alongside the signature verdict. The label is covered by the signature.

The verify endpoint is currently the single point through which the signature, RFC 3161 token, and Rekor proof are exposed. A verifier who fetches only the Vercel Blob package and the public trust registry has only the package contents and the trust-registry contract — they cannot complete checks 2, 5, 6, or 8 without `civicaitools.org`.

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

- **2026-05-18** — `datHere` captureMethod variant added per [ADR-0004](../adr/0004-dathere-captureMethod-variant.md). Changes: §4.1 gains optional `summary` field (required when `captureMethod == "datHere"`); §4.6 extension example list extended with `org.civicaitools.dathere.environment` and the existing `org.civicaitools.notebook` extension is promoted to normatively required under `datHere`; §9 vocabulary list extended with the `datHere` value; §9 forward-extensibility callout updated to reflect the fourth value; §9.1 (datHere content profile), §9.2 (cross-host frontmatter schema), and §9.3 (embed-vs-reference policy) added as new sub-sections. Schema version unchanged (`0.1.0`) — enum extension is a vocabulary change and added fields are backwards-compatible. Resolves Q21 and Q24 in the open-questions registry.

---

## 18. Related documents

- `civic-ai-tools/docs/architecture/end-state-vision.md` — architectural rationale, layered standards stack, network-signal model, full glossary, and the open-questions list this spec defers to.
- `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` — Civic Claim Vocabulary v0.1, the typed-claims layer reserved by §11.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — project discipline governing how this spec is allowed to grow; gating criteria for promoting items from speculative to designed to built.
- `civic-ai-tools/docs/adr/0001-roadmap-governance.md` — public-roadmap governance and quarterly cadence.
- `civic-ai-tools/docs/adr/0002-commitments-vs-targets.md` — distinction between absolute commitments and operational targets in `ROADMAP.md` §3.
- `civic-ai-tools/docs/adr/0003-evidence-capture-method.md` — the `captureMethod` field, vocabulary, and tamper-evident labeling. Authoritative for §9 (original three vocabulary values).
- `civic-ai-tools/docs/adr/0004-dathere-captureMethod-variant.md` — the `datHere` captureMethod variant, the A-G envelope content profile, the notebook-format requirement, and the cross-host frontmatter publication schema. Authoritative for §9.1, §9.2, and §9.3; resolves [Q21](open-questions.md#q21--canonical-notebook-format-for-dathere-capturemethod) and [Q24](open-questions.md#q24--embed-vs-reference-policy-for-attestations-in-published-artifacts).
- `civic-ai-tools/docs/proposals/data-concierge-integration.md` — the integration-arc proposal that scopes the four-issue cluster (civic#69-#72) ADR-0004 is the first of.
- `civic-ai-tools/ROADMAP.md` — public roadmap, trust commitments, out-of-scope items, and the evidence-protocol-fork resolution deadline of 2026-12-31.
- `civic-ai-tools/docs/research/landscape-analysis.md` — relationship to existing standards (PROV-O, RO-Crate, Croissant, DCAT, FAIR, DPI, CKAN ecosystem).
- `civic-ai-tools-website/docs/api/evidence-publish.md` — request/response contract for the canonical reference implementation. This document and the API doc MUST stay aligned; where they diverge, this document is normative for the package shape and the API doc is normative for the request/response contract.
- `civic-ai-tools-website/docs/key-rotation.md` — runbook for rotating the platform signing key.
