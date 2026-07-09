# Typed Standards — Consolidated Formal Model

> **Purpose.** This document consolidates the per-region extractions of the Typed Standards Specification (v0.1.x) into one coherent, formalization-ready model for two downstream authors who will re-express it in (1) SHACL shapes and (2) SysML v2. It records every named type/field/datatype/cardinality/constraint, every state transition, every verification step, and every conformance requirement stated in the spec — and nothing the spec does not state. Where a field shape, enum, or per-sub-type detail is "referenced but not defined in region," it is marked **(unspecified)** rather than invented.
>
> **Build-state legend** (per `end-state-vision.md`): **green = built**, **yellow = partial**, **orange = reserved** (designed, not implemented). Recorded per type/layer where the spec colors it.
>
> **SHACL vs. out-of-band.** A constraint or check is *SHACL-expressible* only if it is pure graph-shape validation (presence, datatype, cardinality, value-set membership, conditional presence, intra-graph reference resolution / string equality on materialized values). Any check requiring **cryptographic signature verification, hash/canonicalization recomputation, X.509 cert-chain validation, RFC 6962 Merkle inclusion, network fetch, or cross-graph trust-registry resolution** is *out-of-band* and is flagged `expressibleInShacl=false`.

---

## 1. Layered architecture

The umbrella sits over a stack of layers. From bottom (foundational) to top (coordination):

| Layer | Build state | What lives in it |
|---|---|---|
| **Structural primitive (envelope / cryptographic core)** | **built** (green) | The content-agnostic cryptographic core every signed node shares: `type` URI · `nodeId` (≡ envelope hash) · multihash `contentHash` · `contentCanonicalization` URI · `sig` (publicKey + algorithm + kid) · `signer` (identity binding) · RFC 3161 `timestamp` · Sigstore Rekor inclusion proof · `metadata` · `captureMethod` label · withdrawal lifecycle. Built components: Ed25519ph signature, RFC 3161 timestamp, Rekor inclusion, captureMethod label, PROV-O graph. Partial (yellow): envelope hash node, multihash contentHash node, trace. Reserved (orange): `contentCanonicalization` URI node, `contentType` (QEC) label node. |
| **Two-family taxonomy** (`content/*` and `attestation/*`) | **partial** (yellow); per ADR-0009 | The semantic distinction over the primitive. `content/*` = standalone assertions (no `targetNodeId`). `attestation/*` = assertions about another node (`targetNodeId` required). `content/analysis/v1` = built; QEC typed sub-types (`content/claim/question/evidence/v1`) reserved; host/hostPolicy/hostTermsOfUse/tool sub-types reserved per Q22; the 15-member `attestation/*` Q36 table is **ratified** but per-sub-type operationalization lands via downstream ADRs (treat individual attestation sub-types as **reserved/ratified**). Within `content/*`, the **QEC sub-ontology** (`metadata.contentType` set-valued over `claim`/`question`/`evidence`/`untyped`) is the most-developed sub-area. |
| **Profiles — two orthogonal axes** | **partial** (yellow) | **Content profiles** (WHAT shape the content takes: Typed Claims / Typed Evidence / Typed Questions; field values `default`, `datHere`). **Producer profiles** (WHO/HOW produced it; AI-Assisted Analysis per ADR-0006: `ai-assisted-analysis/datHere` subtype = built; `civicaitools-default` subtype = reserved; `human`/`hybrid`/`sandbox-only` types = reserved). The producer profile's guidance bundle declares the valid `captureMethod` vocabulary. A third **orthogonal axis** — notebook provenance (HOW authored: `skeleton`/`executed`) — governs the `datHere` reproducibility strength. |
| **Typed Claims layer** (§8.11) | **specified, not built** (orange); gated on Q5 | Structured, machine-comparable JSON-LD claims against the `ts:` vocabulary (`https://typedstandards.org/ns/ts#`), carried as first-class signed `content/claim/v1` nodes. `ts:Claim` + six concrete subclasses; `ts:Scope`, `ts:ConfidenceStatement`, `ts:AnalyticalDerivation`; validated by SHACL shapes published with the vocabulary. |
| **Domain extensions** | **reserved** (orange) | Specialize a content profile for a subject domain. Civic data analysis is the first domain extension. May add geographic-scope subtypes / confidence methods under their own namespace; MUST publish SHACL shapes. |
| **Publisher registry (coordination index)** | **reserved** (orange) | A directory at `typedstandards.org` that indexes declared publishers. Does NOT host, approve, rank, or vouch. **NOT in the verification path** — a verifier never queries it. |

**Two kinds of canonicalization.** *Envelope-level* canonicalization is a single fixed rule (RFC 8785 JCS) committed to by the spec, invariant across content shapes. *Content-level* canonicalization legitimately varies per content shape and is named by the `contentCanonicalization` URI. Nesting: off-log content → content rule → bytes → multihash → `contentHash` (embedded in envelope); unsigned envelope (containing `contentHash` + `contentCanonicalization`) → JCS → bytes → SHA-256 → envelope hash; envelope-hash hex string is what the Ed25519ph signature covers.

---

## 2. Structural primitive and the two-family taxonomy (class/type hierarchy)

```
SignedNode  (abstract structural primitive — the signed envelope over a typed payload)
│   fields: type, nodeId(≡envelopeHash), contentHash, contentCanonicalization,
│           sig, signer, timestamp, rekorInclusionProof, metadata, captureMethod
│   RULE: belongs to EXACTLY ONE family, decided by type-URI first segment
│         AND by presence/absence of targetNodeId on the payload
│
├── ContentNode  (content/* — standalone assertion; MUST NOT carry targetNodeId)
│   │
│   ├── content/analysis/v1            [BUILT]   default AI-Assisted Analysis output;
│   │       payload: prompt/queries/output/trace; metadata.contentType = QEC set;
│   │       contentProfile ∈ {default, datHere}; producerProfile
│   │
│   ├── content/claim/v1               [RESERVED] carrier of a typed claim (§8.11)
│   │       payload (JSON-LD): ts:Claim or subclass
│   │       │
│   │       └── (QEC typed-claims sub-ontology, §8.11)
│   │           ts:Claim  (base)
│   │           ├── ts:TrendClaim          metric ↑/↓/stable across two periods
│   │           ├── ts:ComparisonClaim     two scopes differ on a metric, one period
│   │           ├── ts:ObservationClaim    metric = value in scope at a time (↦ qb:Observation)
│   │           ├── ts:CompositionClaim    breakdown of whole into components
│   │           ├── ts:RelationshipClaim   statistical relation (NO ts:CausalClaim in v1)
│   │           └── ts:QualitativeClaim    non-numeric assertion (permitted, flagged)
│   │           supporting shapes: ts:Scope, ts:GeographicScope (+ civic subtype taxonomy),
│   │           ts:ConfidenceStatement, ts:AnalyticalDerivation, ts:Magnitude, ts:Component,
│   │           ts:sourceOutputSpan
│   │
│   ├── content/question/v1            [RESERVED] question node (payload undefined in-spec)
│   ├── content/evidence/v1            [RESERVED] evidence node (payload undefined in-spec)
│   ├── content/host/v1                [RESERVED, Q22] host self-declaration
│   ├── content/hostPolicy/v1          [RESERVED, Q22] host policy self-declaration
│   ├── content/hostTermsOfUse/v1      [RESERVED, Q22] host terms-of-use self-declaration
│   └── content/tool/v1                [RESERVED] tool author's tool declaration
│
└── AttestationNode  (attestation/* — assertion about another node; targetNodeId REQUIRED ≥1)
    │   each sub-type declares an authorizationRule ∈ {publisher-only, any-with-binding,
    │                                                  specific-role-required}
    │   — Lifecycle relations —
    ├── attestation/withdraws/v1       [ratified] publisher-only
    ├── attestation/reinstates/v1      [ratified] publisher-only
    ├── attestation/supersedes/v1      [ratified] publisher-only (claim versioning)
    ├── attestation/publishes/v1       [ratified] publisher-only OR delegated-publisher (Q20)
    │   — Reference / location / derivation relations —
    ├── attestation/locatedAt/v1       [ratified] any-with-binding  (Q38: no copyOf minted)
    ├── attestation/wasDerivedFrom/v1  [ratified] any-with-binding  (extractsTo merges here;
    │                                              AnalyticalDerivation = content-shape variant)
    ├── attestation/answersQuestion/v1 [ratified] any-with-binding  (QEC primitive)
    ├── attestation/supportedBy/v1     [ratified] any-with-binding  (QEC primitive)
    ├── attestation/opposedBy/v1       [ratified] any-with-binding  (QEC primitive)
    │   — Claim-to-claim relations —
    ├── attestation/corroborates/v1    [ratified] any-with-binding  (peer; distinct from endorses)
    ├── attestation/contradicts/v1     [ratified] any-with-binding
    ├── attestation/endorses/v1        [ratified] specific-role-required (institutional)
    │   — Authority-bearing relations —
    ├── attestation/certifies/v1       [ratified] specific-role-required (certifying body)
    ├── attestation/evaluates/v1       [ratified] specific-role-required (evaluator; Q26)
    └── attestation/conforms/v1        [ratified] self-attestation OR specific-role-required
```

**Family discriminator (normative).** Exactly one of two families holds for every node, consistent with the `type` URI's first path segment: `content/*` (no `targetNodeId` on payload) vs. `attestation/*` (≥1 `targetNodeId`). Hosts/tools/certifying bodies are **not** peer families — they fold in as `content/*` self-declarations + `attestation/*` relations. Sub-types are an open enum (`content/<noun>/v<N>`, `attestation/<verb>/v<N>`); the registry/governance mechanism is Xanadu-gated (Q37).

**Signatures layer, not collapse.** Multiple signers at different scopes layer; a verifier sees who signed what at what scope, never a single composite verdict. The `signer.identifier` ↔ `sig.kid → trust-registry signerIdentity` cross-check makes the layering tamper-evident.

---

## 3. Type catalog

Fields tables use: **field | datatype | cardinality | required | constraints**. Duplicate mentions across regions are resolved into one entry. The canonical normative field shapes are §8.x; Appendix-B-derived field hints are reconciled against §8.11 and not treated as a second authoritative source.

### 3.1 Family: envelope / structural primitive

#### `SignedNode` (abstract structural primitive) — §6.2, §7.1, §7.4

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `type` | URI string | 1 | yes | URI declaring family + sub-type. Form `content/<noun>/v<N>` or `attestation/<verb>/v<N>`. First segment decides family. Required v0.1; absence ⇒ `content/analysis/v1` by construction (pre-v0.1). Open enum (Q37). |
| `nodeId` | string (SHA-256 hex envelope hash) | 1 | yes | Stable identity = envelope hash by construction. **DERIVED**, not separately stored. Cross-checked: recomputed envelope hash == URL slug == any stored envelope hash == referencing attestation's `targetNodeId`. |
| `contentHash` | multihash DigestSet (object keyed by lowercase algo) | 1 | yes (v0.1; absent pre-v0.1) | Keyed by algorithm: `sha256` (required default) + optional `sha3-256`/`blake3`. v0.1 vocab = {sha256, sha3-256, blake3}. Pre-v0.1: single SHA-256 hex string externally → relabeled `{"sha256":<value>}` at verify (not recomputed). Embedded in (covered by) envelope hash. |
| `contentCanonicalization` | URI string | 1 (recommended v0.1) | yes | Names the off-log content canonicalization rule. v0.1 reserved: `…/canonicalization/dathere-ag-jupyter/v1`, `…/canonicalization/legacy-json/v1`. Identifier, not fetch target; resolved via local rule registry. Covered by envelope hash + signature. |
| `sig` | SignatureEnvelope object | 1 | yes | Ed25519ph over the envelope-hash hex string; carries publicKey + algorithm + kid. Removed before JCS canonicalization (not part of unsigned envelope). |
| `signer` | Signer object | 0..1 (RECOMMENDED v0.1) | no | Identity binding on canonical-JSON top level. Pre-v0.1 derived from registry `signerIdentity` for the kid. Verifier MUST cross-check `sig.kid → signerIdentity` == `signer.identifier`. |
| `timestamp` | RFC 3161 TimeStampToken | 1 (SHOULD-level, best-effort) | yes | Trusted timestamp from public TSA (FreeTSA). Covers envelope hash. Persists null on failure. |
| `rekorInclusionProof` | Sigstore Rekor entry + inclusion proof | 1 (SHOULD-level, best-effort) | yes | Transparency-log inclusion (hashedrekord v0.0.1). Indexes envelope hash. Persists null on failure. |
| `metadata` | Metadata object | 1 | yes | Carries `signingKeyId` (== kid; covered by envelope hash), `captureMethod`, and (for `content/analysis/v1`) `contentType` QEC set. |
| `captureMethod` | string label (`metadata.captureMethod`) | 1 | yes | Required, signed, tamper-evident. Value space OPEN at core; vocab declared by producerProfile guidance bundle. For ai-assisted-analysis v0.1: {chat-flow-stream, claude-code-jsonl-readback, claude-code-self-report}. |

#### `SignatureEnvelope` (`sig`) — §8.3.1

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `signature` | string (base64) | 1 | yes | Ed25519ph over UTF-8 bytes of the envelope-hash hex string (NOT raw 32-byte hash). MAY be null on DB row if signing leg failed (then not signed-package conformant). |
| `publicKey` | string (base64 DER SPKI) | 1 | yes | MUST match `publicKey` of a trust-registry entry. |
| `algorithm` | string (const) | 1 | yes | MUST be `Ed25519ph` (RFC 8032 §5.1.2). |
| `kid` | string | 1 | yes | MUST match a trust-registry entry's kid AND equal `metadata.signingKeyId`. MUST resolve via registry `signerIdentity` to the same identity `signer.identifier` claims. |

#### `EvidencePackage` (the `content/analysis/v1` package object) — §8.1

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `metadata` | PackageMetadata object | 1 | yes | See §3.5. |
| `prompt` | Prompt object | 1 | yes | See §3.5. |
| `queries` | array of object | 0..* (array present) | yes | One entry per observed tool call. MAY be empty (no tool calls). Array itself required. |
| `dataSources` | array of object | 0..* (array present) | yes | One per data source touched; derived from `queries[]` + trace. MAY be empty when `queries[]` empty. Array required. |
| `cost` | Cost object | 1 | yes | Token/timing summary. AI-LLM-specific (Q7/Q9). |
| `skillMetadata` | object | 1 | yes | Carries skill-guidance hash, MCP server URL, `skillText` (string \| BlobRef), `mcpServerUrl`. |
| `output` | string \| BlobRef | 1 | yes | Assistant's final response text or BlobRef. |
| `trace` | object \| BlobRef | 1 | yes | OTel-shaped trace or BlobRef (§8.4; Q4). |
| `summary` | string | 0..1 | conditional | Optional in general; **REQUIRED** when `metadata.contentProfile == 'datHere'`. When present: covered by envelope hash + signature. |
| `contentProfile` | string enum | 0..1 | no | `default` (absence ⇒ default) \| `datHere`. Orthogonal to captureMethod. Consistency invariant with producerProfile. *(Placement ambiguity: §8.1.1 lists top-level; §8.1.2/§8.7 say `metadata.contentProfile`. Resolve against reference impl before fixing path.)* |
| `producerProfile` | string (compound `<type>/<subtype>`) | 0..1 | no | v0.1 includes `ai-assisted-analysis/datHere`. Reserved name-only: human/hybrid/sandbox-only. Verifiers SHOULD prefer producerProfile over contentProfile. |
| `contentHash` | ContentHash multihash object | 0..1 (req v0.1; absent pre-v0.1) | yes | See §3.4. ≥1 entry; sha256 default. ≥1 listed digest MUST match at verify. |
| `contentCanonicalization` | URI string | 0..1 (recommended v0.1) | no | Reserved URIs as above. |
| `type` | URI string (pattern) | 0..1 (req v0.1) | yes | `content/<noun>/v<N>` or `attestation/<verb>/v<N>`. Absent (pre-v0.1) ⇒ `content/analysis/v1`. |
| `signer` | Signer object | 0..1 (recommended v0.1) | no | See §3.3. |
| `targetNodeId` | string | 0..1 (conditional) | no | REQUIRED for `attestation/*`; MUST NOT appear on `content/*`. |
| `provenance` | object (PROV-O JSON-LD graph) | 0..1 | no | Derived from trace at publish. Present when trace inspectable inline; omitted when trace is BlobRef and no override. |
| `extensions` | object (reverse-DNS-keyed map) | 0..1 | no | Keys reverse-DNS (e.g. `org.civicaitools.notebook`). Covered by envelope hash + signature. Advisory: MUST NOT change spec-field meaning; verifier MAY ignore unknown. Under datHere, `org.civicaitools.notebook` is normatively required. |

#### `SelfContainedCommitmentBundle` (`?inline=1`) — §8.8 / §9.4

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `package` | object (canonical-JSON package) | 1 | yes | Conformant package (§8.1). |
| `trustRegistry` (stamped/inlined) | object | 1 | yes | `.well-known` snapshot as of `generatedAt`; check #5 verifies against this with no live fetch. |
| `rfc3161Timestamp` | RFC 3161 token | 0..1 | no | Inlined when present; check #7. |
| `rekorEntry` + `rekorInclusionProof` | object | 0..1 | no | Inlined entry body + proof; check #8. Legacy/calm packages may have no Rekor entry. |
| `lifecycleChain` | array of attestation/* nodes | 0..* | no | Inlined signed chain; check #10; each signature verified in-process. |
| `generatedAt` | dateTime | 1 | yes | As-of moment of stamped registry; bounds revocation visibility. |

#### `CommitmentView` (cross-host publication logical schema) — §8.8.1

Two byte-different but semantically identical serializations: **NotebookEmbeddedCommitmentView** (§8.8.2; carried at notebook root `metadata.org.civicaitools.evidence`, MUST survive tooling round-trip) and **SiblingYamlCommitmentView** (§8.8.3; `<artifact-basename>.evidence.yaml`, or markdown YAML frontmatter; verifier MUST accept YAML or JSON). A conformant publisher MAY emit either; a conformant verifier MUST accept either.

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `evidenceProtocolVersion` | string | 1 | yes | Currently `"0.1.0"`. |
| `packageHash` | string (hex SHA-256) | 1 | yes | SHA-256 of canonical-JSON package; content-addressable identifier. |
| `packageUrl` | string (URL) | 1 | yes | Content-addressable URL of canonical-JSON package. |
| `captureMethod` | string (enum, open) | 1 | yes | Mirrors `metadata.captureMethod`. Open-ended ("at minimum" the ai-assisted-analysis v0.1 vocab). |
| `contentProfile` | string | 1 | yes | `"datHere"` for §8.8 artifacts. |
| `signature` | SignedEnvelope object | 1 | yes | `{signature, publicKey, algorithm, kid}`; algorithm `"Ed25519ph"`. |
| `signerIdentity` | SignerIdentity object | 1 | yes | bindingTier + identifier + displayName (+ optional verifiedAt). |
| `rfc3161Timestamp` | string (base64) | 0..1 | no | Present when pipeline obtains one. |
| `rekorEntryId` | string | 0..1 | no | Present when pipeline obtains one. |
| `rekorInclusionProof` | string (base64) | 0..1 | no | Present when pipeline obtains one. |
| `trustRegistryUrl` | string (URL) | 1 | yes | `.well-known/typed-publisher.json` URL (or legacy path on pre-v0.1). Lets reader resolve `signature.kid` independently of publishing host. |
| `attestations` | array of AttestationEntry | 0..* | no | Each entry is reference-form OR embed-form (§8.9). |
| `subjectTitle` | string | 1 | yes | Matches publisher DB title. |
| `subjectSummary` | string | 1 | yes | G-section summary; matches canonical-JSON `summary`. |

#### `AttestationReferenceEntry` / `AttestationEmbedEntry` (entries in `CommitmentView.attestations`) — §8.9

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `kind` | string (attestation kind) | 1 | yes | From the `attestation/*` namespace (§8.12); not normatively closed by §8.9. |
| `targetHash` | string (SHA-256) | 1 | yes | SHA-256 of the package the attestation is about. |
| `attestationHash` | string (SHA-256) | 1 | yes | SHA-256 of the (fetched, reference-form) or (embedded, embed-form) canonical-JSON attestation. |
| `attestationUrl` | string (URL) | 1 (reference form only) | yes (ref) | URL where the canonical-JSON attestation is fetchable. *Reference form only.* |
| `attestation` | object (inline canonical-JSON) | 1 (embed form only) | yes (embed) | Inline canonical-JSON attestation. *Embed form only.* |
| `signature` | SignedEnvelope object | 1 (embed form only) | yes (embed) | The embedded attestation's own §8.3.1 signature; independently verifiable. *Embed form only.* |

> An entry MUST be exactly one of the two forms (reference = has `attestationUrl`, no inline `attestation`/`signature`; embed = inline `attestation`+`signature`, no `attestationUrl`).

### 3.2 Family: infrastructure

#### `ContentHash` (multihash digest set) — §8.1.1, §8.2; ADR-0008

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `sha256` | string (hex digest) | 0..1 | required by default | sha256 required by default; ≥1 entry total. |
| `sha3-256` | string (hex digest) | 0..1 | no | Registered alternate. |
| `blake3` | string (hex digest) | 0..1 | no | Registered alternate. |

#### `BlobRef` — §8.1.5 (four-field object)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `ref` | string `blob:sha256:<64-hex>` | 1 | yes | Hex part MUST equal recomputed SHA-256 of fetched bytes. |
| `url` | string (HTTPS URI) | 1 | yes | Fetched over HTTPS without authentication. |
| `contentType` | string (MIME) | 1 | yes | e.g. `text/markdown`. Distinct from `metadata.contentType` QEC set. |
| `size` | integer (bytes) | 1 | yes | Fetched byte length MUST equal this. |

> BlobRef may substitute for inline `output`, `trace`, `skillMetadata.skillText` (and under datHere, large `toolDefinitions`/`notebook`). BlobRef is the single-signer implicit case of `attestation/locatedAt/v1`'s verification rule; new *cross-host* declarations by parties other than the parent signer SHOULD use `attestation/locatedAt/v1` instead.

#### `TrustRegistry` — §8.3.3

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `keys` | array of TrustRegistryEntry | 1..* (array required) | yes | Published at `${baseUrl}/.well-known/typed-publisher.json` (canonical); reference impls SHOULD also serve byte-identical at legacy `…/evidence-public-keys.json` (permanent parallel-serve). Served by publisher's own domain; NOT in verification path as authority. |

#### `TrustRegistryEntry` — §8.3.3

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `kid` | string | 1 | yes | e.g. `platform:evidence-2026-04`. |
| `publicKey` | string (base64 DER SPKI) | 1 | yes | Matched against envelope publicKey. |
| `signerIdentity` | SignerIdentity object | 0..1 | no | Pre-v0.1 entries omit ⇒ verifiers synthesize `{bindingTier:'legacy_embedded', identifier:<kid>, displayName:<kid>}`, no mismatch check. Post-ADR-0009 SHOULD populate for every active key. |
| `status` | string enum | 1 | yes | `active` \| `deprecated` \| `revoked`. |
| `activatedAt` | string ISO-8601 \| null | 1 | yes | Activation time. |
| `deprecatedAt` | string ISO-8601 \| null | 1 | yes | Null unless deprecated. Packages signed before remain trusted; after, not. |
| `revokedAt` | string ISO-8601 \| null | 1 | yes | Null unless revoked. Revoked never trusted regardless of integration time. |

#### `SignerIdentity` — §8.3.3 / §8.5

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `bindingTier` | string enum | 1 | yes | e.g. `platform`; legacy synthesized `legacy_embedded`. |
| `identifier` | string | 1 | yes | e.g. `platform:civic-ai-tools`. Compared against envelope `signer.identifier`. |
| `displayName` | string | 1 | yes | e.g. `Civic AI Tools Platform`. |

#### `Trace` / `TraceDocument` — §8.4 (informative; partial/yellow; Q4)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `spans` | array of Span | 0..* | no | Each span one of five **SpanKind** values: `analysis` (root), `skill_fetch`, `llm_inference`, `mcp_tool_call`, `synthesis`. v0.1 normalizes this closed set as conformant. **No span field schema given beyond the kind enumeration — do not invent span fields.** OTel-schema-compliant but not a real OTel SDK. |

#### `EnvironmentExtension` (`extensions["org.civicaitools.environment"]`) — §8.7.1 req 3 / §8.7.4

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `modelVersion` | string | 1 | yes | Runtime the package was AUTHORED under. |
| `temperature` | number | 1 | yes | |
| `mcpServers` | array of `{url, name?}` | 1 | yes | Each object has required `url`, optional `name`. |
| `toolDefinitions` | array of tool-schema object OR BlobRef | 1 | yes | BlobRef when large. |
| `host` | string | 1 | yes | Publishing host, e.g. `civicaitools.org`. |
| `requirements` | object/string (sidecar) | 0..1 | no | §8.7.3 alternative location for runtime requirements when not in notebook's first cell. |
| `<additional>` | any | 0..* | no | Permitted under reverse-DNS sub-namespacing. |

#### `NotebookExtension` (`extensions["org.civicaitools.notebook"]`) — §8.7.1 req 4 / §8.7.2 / §8.7.4

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `format` | string | 0..1 | no | e.g. `jupyter-v4.5`, `marimo-v0.x`. Required for non-Jupyter formats (§8.7.2 cond 2). v1 default Jupyter nbformat 4 (v4.5+). |
| `cells` | array | 0..* | no | For Jupyter: top-level `cells` per nbformat 4. |
| `provenance` | string enum | 0..1 | no | `skeleton` \| `executed` (§8.7.4). Absent ⇒ verifiers treat as `skeleton` (pre-v0.1 default). Auto-emitted from ADR-0005 forward. |

#### `ExecutionExtension` (`extensions["org.civicaitools.execution"]`) — §8.7.4

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `executedAt` | string ISO-8601 UTC | 1 | yes | Execution-completion timestamp. |
| `environment` | object | 1 | yes | Runtime the notebook ACTUALLY ran in. MUST contain ≥ `python` (string version) + `libraries` (object name→pinned-version). Additional sub-fields under reverse-DNS. |
| `executionDuration_ms` | integer | 1 | yes | Wall-clock; informational; NOT part of trust property. |
| `sandboxId` | string | 0..1 | no | Opaque; informational. Provider unspecified (portability = Q28). |
| `comparisonCellPresent` | boolean | 0..1 | no | Defaults true. When true, executed notebook includes appended comparison cell. |

> **Conditional presence:** `org.civicaitools.execution` MUST be present when `notebook.provenance == 'executed'` and MUST be absent when `'skeleton'` (or absent). It and `org.civicaitools.environment` (authored-under runtime) coexist on an executed-path package.

#### IANA / pinned-anchor identifier reservations — §10.3, §12

| Type | Key fields / values |
|---|---|
| **WellKnownTypedPublisherRegistration** (§12.1) | `path` = `/.well-known/typed-publisher.json`; `registrationStatus` ∈ {provisional, permanent} (v0.1 requests **provisional** only); RFC 8615 "Specification Required" (designated expert Mark Nottingham). Legacy `/.well-known/evidence-public-keys.json` is NOT IANA-registered. |
| **VocabularyURIReservation** (§12.2) | `prefix` = `ts:`; `namespaceIRI` = `https://typedstandards.org/ns/ts#`. Identifier only; no IANA action. |
| **CanonicalizationRuleURI** (§12.3) | Two reserved: `…/canonicalization/dathere-ag-jupyter/v1`, `…/canonicalization/legacy-json/v1`. Identifiers only. |
| **PinnedFreeTSARootAnchor** (§10.3) | RSA-4096 self-signed `O=Free TSA, OU=Root CA`; SHA-256 fingerprint `A6:37:9E:7C:EC:C0:5F:AA:3C:BF:07:60:13:D7:45:E3:27:BB:BA:A3:8C:0B:9A:F2:24:69:D4:70:1D:18:AA:BC` (captured 2026-06-07 from freetsa.org/files/cacert.pem). Leaf is ECDSA P-384. Adopters changing TSAs MUST document their root anchor here. |
| **PinnedRekorLogAnchor** (§10.3) | Public-good Rekor shard log key ECDSA P-256; log id `c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d`; checkpoint = transparency-dev Go signed-note (4-byte key hint). Private-log adopters document their own anchor (Xanadu-gated; Q2). |

### 3.3 Family: attestation (identity-binding objects)

#### `Signer` — §6.2 / §8.5

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `bindingTier` | string enum (extensible) | 1 | yes | One of `pseudonymous`, `oauth`, `orcid`, `did-web`, `notarized` (§8.5 ladder; §5.4 prose: pseudonymous → OAuth → academic → institution-DNS → notarized). Only the `oauth` (GitHub) tier is implemented/conformant in v0.1 (Q3). Surfaced as a signal, never computed into a verdict. |
| `identifier` | string (provider-prefixed) | 1 | yes | Verifier MUST cross-check against `sig.kid → trust-registry signerIdentity`. |
| `displayName` | string | 1 | yes | |
| `verifiedAt` | string ISO-8601 | 0..1 | no | Optional. |

#### `GitHubAuthorshipBinding` — §8.5 (the only conformant v0.1 binding; DB-row columns, not canonical JSON)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `github_id` | string | 1 | yes | GitHub-specific DB column. Signing key is platform-held; user does not currently self-sign. |
| `display_name` | string | 1 | yes | |
| `github_profile_url` | string (URL) | 1 | yes | |

### 3.4 Attestation node sub-types (payloads)

All `attestation/*` nodes inherit the structural primitive (§3.1) plus `targetNodeId` (1..*) and an `authorizationRule`. Below: per-sub-type payload **beyond** the primitive. Where the §8.12.1 table gives a field name but no datatype, the type is **(unspecified)**.

| Sub-type | authorizationRule | Payload fields (field: datatype, card, req) |
|---|---|---|
| `attestation/withdraws/v1` | publisher-only | `targetNodeId`: nodeId, 1, yes · `reason`: string, 1, yes (non-empty, minLength≥1) · `effectiveAt`: timestamp, 0..1, no (defaults to envelope timestamp) |
| `attestation/reinstates/v1` | publisher-only | `targetNodeId`: nodeId, 1, yes · `priorWithdrawalNodeId`: nodeId, 1, yes (references the immediately-prior withdrawal of the same target) · `reason`: string, 0..1, no |
| `attestation/supersedes/v1` | publisher-only | `targetNodeId` (prior/old): nodeId, 1, yes · `successorNodeId` (new): nodeId, 1, yes |
| `attestation/publishes/v1` | publisher-only OR delegated-publisher (Q20) | `targetNodeId`: nodeId, 1, yes · `publicationHost`: string, 1, yes · `releasedAt`: timestamp, 1, yes |
| `attestation/locatedAt/v1` | any-with-binding | `targetNodeId`: nodeId, 1, yes · `uri`: URI, 1, yes · `contentHash`: multihash, 1, yes (SHOULD match target's; mismatch is informative content-drift, NOT a failure) · `contentLength`: integer, 0..1, no · `availability`: string/enum (unspecified), 0..1, no |
| `attestation/corroborates/v1` | any-with-binding | `targetNodeId`: nodeId, 1, yes · `scope`: (unspecified), 1, yes · `reasoning`: string, 0..1, no |
| `attestation/contradicts/v1` | any-with-binding | `targetNodeId`: nodeId, 1, yes · `scope`: (unspecified), 1, yes · `reasoning`: string, 0..1, no |
| `attestation/endorses/v1` | specific-role-required (authority-bearing) | `targetNodeId`: nodeId, 1, yes · `scope`: (unspecified), 1, yes |
| `attestation/wasDerivedFrom/v1` | any-with-binding (the deriver) | `targetNodeId` (source): nodeId, 1, yes · `derivationMethod`: object, 1, yes (**conditional**: when source is `content/analysis/v1` with `untyped` content AND target is a typed content sub-type, MUST carry a `ts:AnalyticalDerivation` — classification-laundering guard) |
| `attestation/answersQuestion/v1` | any-with-binding (the asserter) | `targetNodeId` (question): nodeId, 1, yes |
| `attestation/supportedBy/v1` | any-with-binding (the asserting publisher) | `targetNodeId` (evidence): nodeId, 1, yes |
| `attestation/opposedBy/v1` | any-with-binding (the asserting publisher) | `targetNodeId` (evidence): nodeId, 1, yes |
| `attestation/certifies/v1` | specific-role-required (certifying body) | `targetNodeId` (tool/method): nodeId, 1, yes · `certificationScheme`: (unspecified), 1, yes · `validityWindow`: temporal range (unspecified), 1, yes |
| `attestation/evaluates/v1` | specific-role-required (evaluator; methodology + bindingTier per Q26) | `targetNodeId`: nodeId, 1, yes · `methodology`: (unspecified), 1, yes · `scoringRubric`: (unspecified), 1, yes · `results`: object (unspecified), 1, yes |
| `attestation/conforms/v1` | self-attestation OR specific-role-required (third-party) | `targetNodeId`: nodeId, 1, yes · `standardId`: identifier/URI, 1, yes |

**AuthorizationRule** enum = {`publisher-only`, `any-with-binding`, `specific-role-required`}. `publisher-only`: `signer.identifier` MUST match target's `signer.identifier` (or delegated-publisher). `any-with-binding`: `signer.bindingTier` ≥ `pseudonymous`. `specific-role-required`: role declaration in the sub-type's own normative section.

### 3.5 Family: content (package-level objects, §8.1)

#### `PackageMetadata` — §8.1.2

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `schemaVersion` | string | 1 | yes | Currently `"0.1.0"`. |
| `packageId` | string (UUID) | 1 | yes | Generated at publish; distinct from envelope hash. |
| `createdAt` | string ISO-8601 UTC | 1 | yes | Packager time. |
| `signingKeyId` | string | 1 | yes | The kid. MUST equal envelope's kid. Covered by envelope hash. |
| `captureMethod` | string enum (nullable pre-v0.1) | 1 (req v0.1) | yes | For ai-assisted-analysis (v0.1 default): `chat-flow-stream` \| `claude-code-jsonl-readback` \| `claude-code-self-report`. Required at publish route since 2026-04-29; pre-v0.1 null → render "Unknown (pre-v0.1)". |
| `contentProfile` | string enum | 0..1 | no | See placement-ambiguity note (§3.1). |
| `contentType` | set of enum {claim, question, evidence, untyped} | 1 (set; ≥1 member) | yes (for `content/analysis/v1`) | QEC set. `untyped` mutually exclusive with typed values. No `mixed` value (multiplicity via >1 member). Common shapes: `['claim']`, `['claim','question']`, `['untyped']`. Carried in canonical JSON, signed. |

#### `Prompt` — §8.1.3

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `hash` | string (hex) | 1 | yes | SHA-256 hex of prompt text. |
| `visibility` | string enum | 1 | yes | `full_text` \| `hash_only`. Enforced at publish route. |
| `text` | string | 0..1 (conditional) | no | Present iff `visibility == 'full_text'`; MUST be omitted when `hash_only`. |

#### `Cost` — §8.1.7 (AI-LLM-specific; Q7/Q9)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `promptTokens` | integer | 1 | yes | |
| `completionTokens` | integer | 1 | yes | |
| `totalTokens` | integer | 1 | yes | |
| `model` | string | 1 | yes | Model identifier. |
| `durationMs` | integer (ms) | 1 | yes | Wall-clock. |

#### `content/analysis/v1` sub-type-specific payload (also §3.1 `EvidencePackage`)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `prompt`/`queries`/`output`/`trace` | (see §3.1) | — | — | Sub-type payload at canonical-JSON top level. |
| `content` | typed content block, or array of typed content blocks | 1 | yes | When `metadata.contentType` has >1 member, carries an **array** of individually-typed blocks, each conformant to its profile, each retaining its own provenance/confidence/scope/(claims:)AnalyticalDerivation. Per-block requirements do NOT relax when set has >1 member. |

#### `DatHereContentProfilePackage` (specializes §8.1 top-level) — §8.7; required when `metadata.contentProfile == 'datHere'`

| field (A–G section) | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `prompt.visibility` (A) | enum | 1 | yes | MUST be `full_text` (req 1). |
| `prompt.text` (A) | string | 1 | yes | User's question verbatim. |
| `skillMetadata.skillText` (B) | string or BlobRef | 1 | yes | Non-empty; MUST reflect composed system-prompt set at analysis time (req 2). |
| `cost.model` (C) | string | 1 | yes | Model card. |
| `skillMetadata.mcpServerUrl` (C) | string (URL) | 0..* | no | MCP server URLs. |
| `extensions["org.civicaitools.environment"]` (C) | object | 1 | yes | Present with minimum field set (req 3). See §3.2. |
| `trace` (D) | OTel object or BlobRef | 1 | yes | Deliberative trace (thinking, tool calls, results in order). |
| `queries` (D) | array | 0..* | no | Companion to trace. |
| `extensions["org.civicaitools.notebook"]` (E) | object | 1 | yes | Present; conforms to §8.7.2 format; satisfies §8.7.3 determinism (req 4). MAY be BlobRef when large. |
| `extensions["org.civicaitools.execution"]` | object | 0..1 | conditional | Present iff `notebook.provenance == 'executed'` (§8.7.4). |
| `output` (F) | string or BlobRef | 1 | yes | Rendered output of executing the notebook against the documented runtime at publish time (req 5). |
| `summary` (G) | string | 1 | yes | Non-empty; SHOULD be ≤280 chars (recommended, not enforced) (req 6). |
| `metadata.contentProfile` | enum | 1 | yes | MUST be `datHere` (req 7). |
| `metadata.captureMethod` | enum | 1 | yes | One of ai-assisted-analysis v0.1 vocab (producerProfile resolves to `ai-assisted-analysis/datHere`). |

#### `ComparisonCell` — §8.7.4 (when `provenance == 'executed'` and `comparisonCellPresent != false`)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `original` | object (Python literals) | 1 | yes | Original prominent values captured at `executedAt`, keyed by metric-name. |
| `current` | computed (`recompute_key_metrics()`) | 1 | yes | Re-computed against live data with same helpers + queries. |
| `deltas` | computed/printed | 1 | yes | Per-key delta. Part of signed notebook artifact; covered by envelope hash + signature. Metric selection at publisher's discretion (documented heuristic or LLM-selected). |

#### `Cell0RenderingTable` — §8.8.4 (non-authoritative reader affordance)

Recommended (SHOULD) surfaced display fields: `signerIdentityAndBindingTier`, `packageHashTruncated` (first 8–12 hex chars), `trustSealCaptureMethodContentProfile`, `attestationSummaryCount`, `publishingHostAndTimestamp`. All 0..1, display-only; verification MUST NOT depend on it.

#### `NormativePreamble` — §5.1 (family: claim)

The four-line editorial preamble (corroboration ≠ truth; contradiction ≠ falsity; identity strength ≠ topic authority; the system surfaces signals, the consumer applies judgment). The only normative requirement not enforced by code (editorial/reputational only; a v0.1 limitation). MUST be carried by every product surface, downstream consumer, derived publication, and third-party implementation.

### 3.6 Family: claim (typed-claims layer, §8.11; `specified, not built`, Q5)

The carrier is the signed `content/claim/v1` node. Conformance (§8.11.3) requires all five of: valid JSON-LD 1.1 inside the canonical envelope; `@context` includes `https://typedstandards.org/ns/ts#`; every top-level claim object validates against the published SHACL shapes; every confidence value is method-traceable; every claim is falsifiable.

#### `ClaimDocument` (JSON-LD wrapper)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `@context` | array (IRI string(s) + inline prefix-map) | 1 | yes | First member is the `ts:` vocabulary URI; optional inline prefix maps follow. |
| `@graph` | array of claim nodes | 1 | yes | One or more claim nodes. |

#### `ts:Claim` (base class)

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `@type` | ts:Claim or subclass URI | 1 | yes | Instance of ts:Claim or a subclass. |
| `dcterms:identifier` | xsd:string | 1 | yes | Stable claim ID, **unique within the package**. |
| `ts:subject` | URI | 1 | yes | What the claim is about (metric/indicator/observable). |
| `ts:scope` | ts:Scope | 1 | yes | Explicit geographic + temporal bounds. Implicit scope prohibited. Required v0.1 (Q14 may relax in v1.0). |
| `ts:confidence` | ts:ConfidenceStatement | 1 | yes | Method-derived. Free-form `high/medium/low` without method backing is non-conforming. |
| `prov:wasDerivedFrom` | URI (array) | 1..* | yes | ≥1 entity derivable from the source `content/analysis/v1` provenance graph. |
| `ts:derivedVia` | ts:AnalyticalDerivation | 1 | yes | Link to the LLM-extraction step that produced the claim. |
| `dcterms:description` | xsd:string | 0..1 | conditional | Required when `ts:confidence` method is `ts:NotApplicable`. |
| `ts:contradicts` | URI (array) | 0..* | no | Inline alt. to `attestation/contradicts/v1`. |
| `ts:corroborates` | URI (array) | 0..* | no | Inline alt. to `attestation/corroborates/v1`. |
| `ts:supersedes` | URI | 0..1 | no | Inline alt. to `attestation/supersedes/v1`. |
| `ts:limitations` | xsd:string | 0..1 | no | Author-acknowledged limitations. |

#### `ts:Scope`, `ts:GeographicScope`

`ts:Scope`: `ts:geographicScope` (ts:GeographicScope or named subtype, 1, yes), `ts:temporalScope` (`time:Interval` with `time:hasBeginning`/`time:hasEnd`/`time:inXSDDate`, 1, yes).
`ts:GeographicScope`: `dcterms:identifier` (0..1), `schema:name` (0..1), `geo:hasGeometry` (OGC GeoSPARQL WKT/GML/GeoJSON-LD, 0..1, required when using base type directly for arbitrary geometry). **Civic subtype taxonomy** (each naming a canonical reference standard): `ts:CensusTract`, `ts:CensusBlock`, `ts:CensusBlockGroup`, `ts:ZIPCodeTabulationArea`, `ts:SchoolDistrict`, `ts:MunicipalBoundary`, `ts:CountyBoundary`, `ts:StateBoundary`, `ts:NeighborhoodTabulationArea` (NYC), `ts:CommunityBoardDistrict` (NYC), `ts:CityCouncilDistrict`, `ts:PolicePrecinct` (flagged Q14 as possibly too NYC-coded). International equivalents (AU SA1, UK OA) are domain extensions, not core subtypes.

#### `ts:ConfidenceStatement`

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `ts:method` | ts:ConfidenceMethod URI (enum, extensible) | 1 | yes | Starter set: `ts:FrequentistInterval`, `ts:BayesianCredibleInterval`, `ts:SampleSizeBased`, `ts:LLMReportedLogProbability`, `ts:HumanReview`, `ts:NotApplicable`. New methods MUST be method-derived/traceable. `ts:NotApplicable` MUST be accompanied by a description. |
| `ts:level` | xsd:decimal | 0..1 | no | e.g. 0.95. |
| `ts:lowerBound` | xsd:decimal | 0..1 | no | Interval methods. |
| `ts:upperBound` | xsd:decimal | 0..1 | no | Interval methods. |
| `ts:methodReference` | URI / reference string | 0..1 | no | Pointer to recorded calculation, e.g. `trace.json#step-stat-test-3`. |

#### `ts:AnalyticalDerivation`

| field | datatype | cardinality | required | constraints |
|---|---|---|---|---|
| `ts:traceReference` | URI / reference string | 1 | yes | e.g. `trace.json#step-claim-extraction-1`. *(cardinality inferred from MUST-link prose + example.)* |
| `ts:translationModel` | schema:SoftwareApplication | 1 | yes | Which model performed extraction (schema:name, schema:softwareVersion). |
| `ts:translationPrompt` | reference (@id) | 1 | yes | e.g. `{"@id":"prompt.json#claim-extraction"}`. |
| `ts:sourceOutputSpan` | object `{ts:outputFile, ts:byteRange}` | 1 | yes | `ts:outputFile` (string), `ts:byteRange` (array of exactly 2 integers `[start,end]`). |

> The same `ts:AnalyticalDerivation` payload is a MUST-carry component of the separately-signed `attestation/wasDerivedFrom/v1` node's `derivationMethod`; when present in both places the two MUST be consistent.

#### `ts:Claim` subclasses

| Subclass | Added fields (all 1, required, beyond ts:Claim) |
|---|---|
| `ts:TrendClaim` | `ts:metric` (URI) · `ts:baselinePeriod` (time:Interval) · `ts:comparisonPeriod` (time:Interval) · `ts:direction` (**closed enum** {Increase, Decrease, NoSignificantChange}) · `ts:magnitude` (ts:Magnitude) |
| `ts:ComparisonClaim` | `ts:metric` (URI) · `ts:scopeA` (ts:Scope) · `ts:scopeB` (ts:Scope) · `ts:relation` (**closed enum** {GreaterThan, LessThan, ApproximatelyEqual}) · `ts:magnitude` (ts:Magnitude) |
| `ts:ObservationClaim` | `ts:metric` (URI) · `ts:value` (numeric or qb:Observation) · `ts:unit` (URI, QUDT/UCUM) — maps onto `qb:Observation` |
| `ts:CompositionClaim` | `ts:whole` (ts:Scope) · `ts:components` (ts:Component array, 1..*) · `ts:totalsTo` (xsd:decimal — describes intended total; **spec does NOT mandate components sum to it**) |
| `ts:RelationshipClaim` | `ts:metricA` (URI) · `ts:metricB` (URI) · `ts:relationshipType` (URI, **open enum**: Correlation/RegressionCoefficient/RankOrderAgreement/etc.) · `ts:strength` (xsd:decimal) |
| `ts:QualitativeClaim` | `ts:assertion` (xsd:string) · `ts:groundingMethod` (URI, **open enum**: Pattern Recognition/Document Analysis/Comparative Synthesis/etc.) · `ts:confidence` (ts:ConfidenceStatement; MAY be `ts:NotApplicable` + required description) |

**Under-specified (do NOT invent fields):** `ts:Magnitude` (absolute/percent — example uses `ts:percentChange`, `ts:absoluteChange`), `ts:Component`. `content/question/v1` and `content/evidence/v1` payload shapes are reserved but undefined.

---

## 4. Constraint catalog

> **id | appliesTo | kind | statement | keyword.** Kinds: structural, value, cardinality, conditional, reference, uniqueness, crypto, temporal. Crypto/temporal-dependent constraints are not SHACL-expressible.

### 4.1 Preamble, truth-scoring, identity-as-signal

1. **C-preamble-carry** | NormativePreamble; every product surface / downstream consumer / derived publication / third-party impl | structural | Every such party MUST carry the normative preamble (or a clearly-equivalent statement), surfaced where readers encounter it before forming conclusions. | **MUST**
2. **C-no-truth-scoring** | implementations | value | MUST NOT use signed-node signals to compute platform-issued correctness verdicts, rank-by-trust scores, or any consensus collapse. Consumer-side aggregation permitted provided preamble framing accompanies the result. | **MUST NOT**
3. **C-graded-identity-not-computed** | Signer.bindingTier | value | Identity binding tiers are surfaced as signals consumers may filter on; the standard never computes a platform-issued trust verdict from them. | **MUST NOT**

### 4.2 Family membership & sub-type form

4. **C-family-disjoint** | SignedNode | structural | Every conformant signed node belongs to EXACTLY ONE of two families, by the type-URI first path segment. | **MUST**
5. **C-content-no-target** | ContentNode | conditional | A `content/*` payload MUST NOT carry `targetNodeId` (absence = the structural rule). It MAY cite via `wasDerivedFrom` provenance (upstream, not the subject). | **MUST NOT**
6. **C-attestation-has-target** | AttestationNode | conditional | An `attestation/*` payload MUST carry ≥1 `targetNodeId` (presence = the structural rule). | **MUST**
7. **C-type-uri-form** | SignedNode.type | value | Sub-type URIs use `content/<noun>/v<N>` or `attestation/<verb>/v<N>`. Open enum. | **MUST**
8. **C-type-required-v01** | SignedNode.type | cardinality | `type` required v0.1; absent (pre-v0.1) ⇒ interpreted `content/analysis/v1`. | **MUST**

### 4.3 Identity, hashing, signing (crypto)

9. **C-nodeId-derived** | SignedNode.nodeId | reference | `nodeId` = envelope hash by construction; derived, not stored. Referencing attestation's `targetNodeId` references the target's `nodeId`. | **MUST**
10. **C-nodeId-crosscheck** | SignedNode.nodeId; AttestationNode.targetNodeId | reference | Recomputed envelope hash MUST match URL slug, any stored envelope hash, and any referencing `targetNodeId`. | **MUST**
11. **C-contentHash-sha256-required** | SignedNode.contentHash | value | Multihash DigestSet keyed by lowercase algorithm; sha256 required default; sha3-256/blake3 registered alternates; v0.1 vocab {sha256, sha3-256, blake3}. | **MUST**
12. **C-contentHash-legacy** | SignedNode.contentHash | conditional | Pre-v0.1 emit single SHA-256 hex externally; verifiers relabel as `{"sha256":<value>}` (not recomputed). | **MUST**
13. **C-contentHash-match** | ContentHash | crypto | ≥1 of the listed algorithms' digests MUST match the recomputed digest of the canonicalized off-log content. | **MUST**
14. **C-envelope-canon** | EvidencePackage | crypto | Envelope-level canonicalization is one fixed rule (RFC 8785 JCS over the unsigned envelope); no envelope-level URI; invariant across content shapes. | **MUST** |
15. **C-envelope-hash** | SignedNode (envelope hash) | crypto | Envelope hash = SHA-256 hex of the JCS bytes of the unsigned envelope (package object with signature envelope removed). | **MUST**
16. **C-envelope-hash-legacy** | SignedNode (envelope hash) | conditional | Pre-v0.1 used `JSON.stringify` insertion-order serialization; verifiers MUST handle under that legacy rule. | **MUST**
17. **C-canon-nested** | EvidencePackage | crypto | Two nested rules: off-log content → contentCanonicalization → bytes → multihash → contentHash; unsigned envelope → JCS → SHA-256 → envelope hash; envelope-hash hex string is what Ed25519ph covers. | **MUST** |
18. **C-legacyjson-excludes** | EvidencePackage.contentHash | crypto | `legacy-json/v1` fingerprints the JCS canonicalization of the package object with BOTH `contentHash` and the signature envelope omitted (non-circular; matches unsigned-envelope boundary). | **MUST** |
19. **C-dathere-content-fp** | EvidencePackage.contentHash | crypto | `dathere-ag-jupyter/v1` fingerprints the executed notebook (`extensions["org.civicaitools.notebook"]` + rendered outputs, §8.7.2). | **MUST** |
20. **C-contentCanon-uris** | SignedNode.contentCanonicalization | value | Top-level URI naming the content-level rule; covered by envelope hash + signature. v0.1 reserved: `…/dathere-ag-jupyter/v1`, `…/legacy-json/v1`. | **MUST**
21. **C-sig-algorithm** | SignatureEnvelope.algorithm | crypto | Ed25519ph (RFC 8032 §5.1.2); value `"Ed25519ph"`. Signature math binds only the hash bytes; publicKey/algorithm/kid in the JSON are for verifier convenience. | **MUST**
22. **C-sig-over-hex** | SignatureEnvelope.signature | crypto | Signature computed over the UTF-8 bytes of the envelope-hash hex string, NOT the raw 32-byte hash. | **MUST** |
23. **C-sig-no-double-prehash** | SignatureEnvelope | crypto | Implementations exposing only Ed25519 MUST NOT pre-hash on the application side (Ed25519ph applies its own internal SHA-512 prehash). | **MUST NOT**
24. **C-kid-covered** | SignatureEnvelope.kid | crypto | `kid` is in canonical JSON via `metadata.signingKeyId`, so covered by envelope hash + platform signature; same kid present in envelope and trust registry. | **MUST**
25. **C-sig-kid-match-registry** | SignatureEnvelope | reference | Envelope `(kid, publicKey)` MUST match a trust-registry entry's `(kid, publicKey)`. | **MUST**
26. **C-signingKeyId-eq-kid** | PackageMetadata.signingKeyId | reference | `metadata.signingKeyId` MUST equal the envelope's kid; a kid swap is detectable as envelope-vs-canonical mismatch. | **MUST**
27. **C-signer-recommended** | SignedNode.signer | cardinality | `signer` RECOMMENDED v0.1; pre-v0.1 derive from registry `signerIdentity` for the kid. | **SHOULD**
28. **C-signer-crosscheck** | SignedNode.signer; SignatureEnvelope.kid; TrustRegistry.signerIdentity | crypto | Verifier MUST cross-check `sig.kid → signerIdentity` resolves to the identity `signer.identifier` claims; a mismatch MUST report `signer_identity_mismatch` and reject (Q35/ADR-0009). Pre-v0.1: derive implicit signer, skip the cross-check. | **MUST**
29. **C-bindingTier-vocab** | Signer.bindingTier | value | One of pseudonymous, oauth, orcid, did-web, notarized (§8.5 ladder; extensible). Only oauth (GitHub) implemented in v0.1 (Q3). | **MUST**
30. **C-rekor-required** | SignedNode.rekorInclusionProof | crypto | Carries a Rekor inclusion proof (§8.3.2); best-effort, persists null on failure. | **SHOULD**
31. **C-timestamp-required** | SignedNode.timestamp | crypto | Carries an RFC 3161 trusted timestamp from a public TSA; best-effort, persists null on failure. | **SHOULD**
32. **C-tsa-pinned-anchor / C-rekor-pinned-anchor** | PinnedFreeTSARootAnchor / PinnedRekorLogAnchor | crypto | A conformant offline verifier validates the RFC 3161 token's ECDSA-P384 leaf up an X.509 chain to the pinned FreeTSA RSA-4096 root, and verifies RFC 6962 Merkle inclusion against the pinned Rekor P-256 log key + signed checkpoint. Adopters changing TSA/log MUST document their own anchor in §10.3. | **MUST**
33. **C-private-log-permitted** | EvidencePackage | structural | Private transparency logs are design-permitted for maximally-sensitive cases; nothing built in v0.1 (Xanadu-gated, Q2). | **MAY**
34. **C-pkg-conformant** | ConformantPackage | crypto | A conformant package satisfies §8.1, and when canonicalized per §8.2 + SHA-256-hashed yields an envelope hash matching the URL slug AND a successful Ed25519ph verification under the trust-registry contract. | **MUST**
35. **C-change-new-hash** | EvidencePackage | crypto | A change to any in-package field yields a different envelope hash ⇒ different content-addressable URL and signature. | **MUST** |
36. **C-db-fields-not-covered** | EvidencePackage | structural | DB-row fields not in the canonical object (`title`, `verificationStatus`, `creatorId`) are NOT covered by the envelope hash. | — |
37. **C-all-inpackage-signed** | EvidencePackage | crypto | All spec-defined field values (captureMethod, signingKeyId, contentProfile, producerProfile, contentCanonicalization, contentHash, every extensions entry, BlobRef objects) are part of the canonical JSON, JCS bytes, envelope hash, and signature. | **MUST** |
38. **C-signing-best-effort** | SignatureEnvelope.signature | conditional | Signing is best-effort; if it fails the column is null — package + envelope hash remain valid but NOT signed-package conformant. | — |

### 4.4 Trust registry

39. **C-trust-registry-path / C-registry-paths** | TrustRegistry | structural | Canonical path `${baseUrl}/.well-known/typed-publisher.json`. | **MUST** |
40. **C-legacy-registry-path** | TrustRegistry | structural | Reference impls SHOULD also serve byte-identical content at legacy `…/evidence-public-keys.json` (permanent parallel-serve; no forced cutover); verifiers MAY fetch either; new clients SHOULD fetch the new path. | **SHOULD**
41. **C-registry-status-enum** | TrustRegistryEntry.status | value | One of `active`, `deprecated`, `revoked`. | **MUST**
42. **C-registry-deprecated-semantics** | TrustRegistryEntry | temporal | deprecated: packages signed before `deprecatedAt` remain trusted; after, not. | — |
43. **C-registry-revoked-semantics** | TrustRegistryEntry | temporal | revoked: never trusted regardless of integration time. | — |
44. **C-registry-signerIdentity-should** | TrustRegistryEntry.signerIdentity | conditional | Post-ADR-0009 registries SHOULD populate for every active key; pre-v0.1 omit ⇒ verifiers synthesize `legacy_embedded`, no mismatch check. | **SHOULD**
45. **C-verifier-registry-must** | TrustRegistry | reference | A verifier MUST (1) match envelope `(kid, publicKey)` against a registry entry and (2) apply the status semantics. | **MUST**
46. **C-legacy-embedded-neutral** | TrustRegistry | value | `legacy_embedded` (pre-registry packages): signature verifies against the embedded key but registry cannot vouch; surfaces SHOULD render as neutral, not failure. | **SHOULD**
47. **C-no-central-authority-in-verify** | Verifier; PublisherRegistry; TrustRegistry | structural | A verifier completes every check using only public infrastructure + the publisher's own trust registry; no central authority; no `typedstandards.org` lookup in the path; the index has no authority to vouch/reject. | **MUST** / **MUST NOT** |
48. **C-canon-rule-detection** | EvidencePackage | conditional | Verifiers detect the canonicalization regime by whether `contentHash` is an embedded multihash object (v0.1 + JCS) or an external single SHA-256 hex (pre-v0.1 + JSON.stringify); the two regimes coexist via this routing. | — |

### 4.5 Capture method

49. **C-captureMethod-required-signed** | SignedNode.captureMethod | structural | Required, signed, tamper-evident. Value space open at core; vocab declared by the producerProfile guidance bundle. | **MUST**
50. **C-captureMethod-ai-vocab / C-CAPTUREMETHOD-ENUM** | metadata.captureMethod | value | For ai-assisted-analysis (v0.1 default): exactly one of {chat-flow-stream, claude-code-jsonl-readback, claude-code-self-report}. Required at publish route since 2026-04-29 (missing/invalid ⇒ HTTP 400); pre-v0.1 persist null → "Unknown (pre-v0.1)". | **MUST**
51. **C-8.6-3 (resolution)** | ProducerProfile resolution | conditional | Vocabulary lookup: read producerProfile; absent + contentProfile=='datHere' ⇒ `ai-assisted-analysis/datHere`; both absent (pre-v0.1) ⇒ `ai-assisted-analysis`; resolve bundle via local rule registry (Q32; v0.1 hardcoded fallback table); confirm `metadata.captureMethod` ∈ that vocabulary. | **MUST**
52. **C-8.6-6 (deprecation)** | claude-code-self-report | temporal | Deprecated as of 2026-04-28; retained so pre-discipline packages re-render with their actual capture method labeled. | — |
53. **C-8.6-9 (signed≠verbatim)** | CaptureMethod / signature | value | Signature attests published-and-unaltered, NOT that content matches what was actually generated (that property is structural, from the capture method). Surfaces SHOULD render captureMethod near the signature verdict. | **SHOULD**

### 4.6 Profiles & content shape

54. **C-contentProfile-vocab** | content/analysis/v1.contentProfile | value | `default` (absence ⇒ default) or `datHere`. | **MUST**
55. **C-profile-consistency-invariant** | contentProfile; producerProfile | conditional | `contentProfile === 'datHere'` IFF `producerProfile.startsWith('ai-assisted-analysis/datHere')`. | **MUST**
56. **C-profile-prefer** | EvidencePackage | conditional | Verifiers SHOULD prefer producerProfile over contentProfile when present. | **SHOULD**
57. **C-producerProfile-form** | EvidencePackage.producerProfile | value | Compound `<profile-type>/<profile-subtype>`; v0.1 includes `ai-assisted-analysis/datHere`; human/hybrid/sandbox-only reserved name-only. | — |

### 4.7 QEC content-type set

58. **C-contentType-set** | metadata.contentType | value | Set drawn from {claim, question, evidence, untyped}; no `mixed`; multiplicity via >1 member. | **MUST**
59. **C-untyped-mutex** | metadata.contentType | value | `untyped` MUTUALLY EXCLUSIVE with typed values; a set with untyped MUST NOT contain claim/question/evidence. | **MUST NOT**
60. **C-contentType-min-one** | metadata.contentType | cardinality | ≥1 member; AI-Assisted Analysis output is `content/analysis/v1` with `['untyped']`. | **MUST**
61. **C-multitype-array** | content/analysis/v1.content | structural | When the set has >1 member, `content` is an ARRAY of individually-typed blocks, each conformant to its profile. | **MUST**
62. **C-per-block-no-relax** | content/analysis/v1 typed blocks; content/claim/v1 | structural | Per-block requirements (provenance, confidence, scope, AnalyticalDerivation for claims) do NOT relax in multi-type packages. | **MUST**

### 4.8 Package structure (§8.1) & datHere

63. **C-PKG-REQUIRED-FIELDS** | EvidencePackage | cardinality | MUST carry every Required field: metadata, prompt, queries, dataSources, cost, skillMetadata, output, trace. | **MUST**
64. **C-PKG-OPTIONAL-CONFORM** | EvidencePackage | structural | Optional fields MAY be omitted; when present MUST conform to their type. | **MAY**
65. **C-QUERIES-EMPTY-OK / C-DATASOURCES-EMPTY-OK** | queries / dataSources | cardinality | Arrays required (present) but MAY be empty (no tool calls / empty queries). | **MAY**
66. **C-CONTENTHASH-V01-REQ** | EvidencePackage.contentHash | cardinality | Required v0.1; pre-v0.1 omit, external legacy SHA-256 relabeled at verify. | **MUST**
67. **C-PACKAGEID-UUID / C-SCHEMAVERSION** | PackageMetadata | value | `packageId` UUID at publish (≠ envelope hash); `schemaVersion` currently `"0.1.0"`. | — |
68. **C-PROMPT-VISIBILITY-ENUM** | Prompt.visibility | value | `full_text` or `hash_only`; enforced at publish route. | **MUST**
69. **C-PROMPT-TEXT-CONDITIONAL** | Prompt.text | conditional | Present iff `full_text`; MUST be omitted when `hash_only`. | **MUST**
70. **C-PROMPT-HASH-HEX** | Prompt.hash | value | SHA-256 hex of prompt text. | — |
71. **C-SUMMARY-CONDITIONAL** | EvidencePackage.summary | conditional | REQUIRED when `metadata.contentProfile == 'datHere'`; optional otherwise. | **MUST**
72. **C-SUMMARY-SIGNED** | EvidencePackage.summary | crypto | When present, part of canonical JSON ⇒ covered by envelope hash + signature. | — |
73. **C-EXTENSIONS-KEYS** | EvidencePackage.extensions | value | Keys MUST be reverse-DNS identifiers. | **MUST**
74. **C-EXTENSIONS-ADVISORY** | EvidencePackage.extensions | structural | Advisory: MUST NOT change spec-field meaning; verifier MAY ignore unknown extensions. | **MUST**
75. **C-EXTENSIONS-SIGNED** | EvidencePackage.extensions | crypto | All extension content is in canonical JSON, covered by envelope hash + signature. | — |
76. **C-NOTEBOOK-DATHERE-REQ** | EvidencePackage.extensions | conditional | Under `contentProfile:datHere`, `org.civicaitools.notebook` is promoted to normatively required (§8.7). | **MUST**
77. **C-BLOBREF-shape/substitution** | BlobRef | structural | A four-field object `{ref, url, contentType, size}`; output/trace/skillText MAY be a BlobRef in place of inline content; `ref` form `blob:sha256:<64-hex>`. | **MUST** / **MAY**
78. **C-BLOBREF-HASH-MATCH** | BlobRef | crypto | Verifier MUST fetch `url` over HTTPS without auth, recompute SHA-256 (== hex part of ref), confirm length == size. | **MUST**
79. **C-BLOBREF-FAILURE** | BlobRef | crypto | A BlobRef whose fetch/hash/size fails MUST cause `ok:false` for that reference; package MAY remain otherwise verifiable; consumers SHOULD treat as missing the content. | **MUST**
80. **C-BLOBREF-VS-LOCATEDAT** | BlobRef | structural | New cross-host location declarations by parties other than the parent signer SHOULD use `attestation/locatedAt/v1` instead of BlobRef. | **SHOULD**
81. **C-8.7.1-1..7 (datHere reqs 1–7)** | DatHereContentProfilePackage | value/structural | req1 `prompt.visibility=='full_text'`; req2 non-empty `skillMetadata.skillText` reflecting the composed system prompt; req3 environment extension present with minimum field set; req4 notebook extension present, §8.7.2-conformant, §8.7.3-deterministic (MAY be BlobRef); req5 `output` present and = rendered notebook execution against documented runtime at publish; req6 `summary` present, non-empty, SHOULD ≤280 chars; req7 `metadata.contentProfile=='datHere'`. Applies ONLY when datHere; MUST satisfy these in addition to §8.1/§8.2/§8.3/§8.6. | **MUST**
82. **C-8.7.2 (notebook format)** | NotebookExtension | structural/conditional | Section E MUST conform to Jupyter nbformat 4 (v4.5+) with top-level `cells`, OR an admitted alternative that is self-contained/reproducible, carries an explicit content-type marker, and ships a renderer producing section F. datHere SHOULD default to Jupyter v4.5+. | **MUST** / **SHOULD**
83. **C-8.7.3 (determinism)** | NotebookExtension | structural/conditional | Notebook MUST record runtime requirements (language/library versions, MCP URLs) in its first cell or in a sidecar `requirements` field. Re-execution against the documented runtime + unchanged upstream data SHOULD reproduce section F byte-for-byte modulo nondeterministic formatting. Best-effort; upstream data change ⇒ different answer is expected, NOT a verification failure. Render as "reproducible against the documented runtime AND upstream-data state at publish time." | **MUST** / **SHOULD**
84. **C-8.7.4-1..2 (provenance)** | NotebookExtension.provenance / ExecutionExtension | value/conditional | `provenance` ∈ {skeleton, executed}; absent ⇒ treat as skeleton. `org.civicaitools.execution` MUST be present when `executed`, MUST be absent when `skeleton`/absent. | **SHOULD** / **MUST**
85. **C-8.7.4-3 (execution fields)** | ExecutionExtension | structural | When present: `executedAt` (req), `environment` (req; ≥ python + libraries), `executionDuration_ms` (req); `sandboxId`, `comparisonCellPresent` optional. | **MUST**
86. **C-8.7.4-5..7 (comparison cell / labeling)** | ComparisonCell; rendering surfaces | conditional/value | When `executed` and `comparisonCellPresent != false`, SHOULD append a "Comparison: original vs. current" cell (covered by envelope hash + signature); metric selection at publisher discretion (documented). Surfaces SHOULD frame reproducibility with property-naming labels ("Executed notebook…" / "Skeleton notebook…"). | **SHOULD**
87. **C-8.7.4-9 (orthogonality)** | axes | structural | captureMethod (HOW captured), contentProfile (WHAT shape), notebook provenance (HOW authored) are three independent orthogonal axes. | — |

### 4.9 Attestation conformance (§8.12)

88. **C-attestation-authz-rule** | AttestationNode.authorizationRule | value | Each sub-type declares one of {publisher-only, any-with-binding, specific-role-required}; publishes also admits delegated-publisher (Q20); conforms admits self-attestation OR specific-role-required. | **MUST**
89. **C-ATT-STRUCT / C-ATT-TYPE-REGISTERED / C-ATT-TARGET-MIN1 / C-ATT-PAYLOAD** | Attestation | structural/value/cardinality | MUST satisfy structural primitives; `type` matches a registered sub-type URI (or future ADR-minted); ≥1 `targetNodeId`; carry the sub-type's required payload fields. | **MUST**
90. **C-ATT-TARGET-OPTIONAL-RESOLVE** | Attestation.targetNodeId | reference | Target need not be retrievable (signature independent of target availability); verifier MAY report `unknown_target_node` if unresolvable. | **MAY**
91. **C-ATT-AUTHZ-PUBONLY / -ANYBIND / -ROLE** | AuthorizationRule | conditional/value | publisher-only ⇒ verifier MUST confirm `signer.identifier` == target's `signer.identifier` (or delegated-publisher); any-with-binding ⇒ `signer.bindingTier` ≥ pseudonymous; specific-role-required ⇒ role declaration in the sub-type's own section. | **MUST**
92. **C-WITHDRAWS-REASON** | AttestationWithdrawsV1.reason | value | Required, non-empty (minLength ≥ 1). | **MUST**
93. **C-WITHDRAWS-EFFECTIVEAT-DEFAULT** | AttestationWithdrawsV1.effectiveAt | value | Defaults to envelope timestamp when absent. | **MAY**
94. **C-REINSTATES-PRIOR** | AttestationReinstatesV1.priorWithdrawalNodeId | reference | References the immediately-prior withdrawal; SHOULD/MUST point to a withdraws node targeting the same target. | **MUST**
95. **C-SUPERSEDES-FIELDS / C-PUBLISHES-FIELDS** | Supersedes/Publishes | structural | supersedes carries `targetNodeId`(old)+`successorNodeId`(new); publishes carries `targetNodeId`+`publicationHost`+`releasedAt`. | **MUST**
96. **C-DERIVED-LAUNDER-GUARD** | AttestationWasDerivedFromV1.derivationMethod | conditional | When source is `content/analysis/v1` with `untyped` content AND target is typed, `derivationMethod` MUST carry a `ts:AnalyticalDerivation` (classification-laundering guard). | **MUST**
97. **C-LOCATEDAT-FIELDS / C-LOCATEDAT-CONTENTHASH** | AttestationLocatedAtV1 | structural/value | Carries `targetNodeId`, `uri`, `contentHash` (multihash), optional `contentLength`/`availability`; `contentHash` SHOULD match target's — mismatch is informative content-drift, NOT a failure. | **MUST** / **SHOULD**
98. **C-LOCATEDAT-MULTICOPY-UNIQ** | AttestationLocatedAtV1 | uniqueness | Multiple locatedAt from distinct `(signer.identifier, uri-authority)` pairs express independent durable copies (Q38 resolved; no `copyOf` minted). | **MAY**
99. **C-LOCATEDAT-ZERO-OK** | AttestationLocatedAtV1 | cardinality | Zero locatedAt attestations is the valid private/draft/enterprise base case. | **MAY**
100. **C-host-not-family / C-tool-not-family** | content/host(Policy)/v1; tool/v1; attestation/endorses,certifies/v1 | structural | Hosts and tools/certifying bodies are NOT separate families: self-declaration = `content/host|hostPolicy|tool/v1`; endorsement = `attestation/endorses/v1`; tool certification = `attestation/certifies/v1`. | **MUST**

### 4.10 Cross-host publication (§8.8–8.9)

101. **C-COMMIT-REQUIRED-FIELDS** | CommitmentView | cardinality | Required (1..1): evidenceProtocolVersion, packageHash, packageUrl, captureMethod, contentProfile, signature, signerIdentity, trustRegistryUrl, subjectTitle, subjectSummary. Optional: rfc3161Timestamp, rekorEntryId, rekorInclusionProof, attestations. | **MUST**
102. **C-COMMIT-FIELDSET-SERIALIZATION-INVARIANT / C-COMMIT-VERIFIER-ACCEPTS-EITHER** | CommitmentView | structural/conditional | Same field set across both serializations (byte-different, semantically identical); a publisher MAY emit either; a verifier MUST accept either. | **MUST** / **MAY**
103. **C-NB-NAMESPACE-LOCATION / -ROUNDTRIP / -IGNORE-SIBLING** | NotebookEmbeddedCommitmentView | structural | A datHere Jupyter package MUST carry the commitment view at root `metadata.org.civicaitools.evidence`; publisher MUST ensure it survives tooling round-trip (Jupyter/Colab/VS Code MUST NOT clobber it); verifier MUST ignore unknown sibling namespaces. | **MUST**
104. **C-YAML-FILENAME / -ACCEPT-YAML-OR-JSON / C-MD-FRONTMATTER** | SiblingYamlCommitmentView | structural | A non-notebook (or sidecar) artifact MAY carry the view as `<artifact-basename>.evidence.yaml`; verifier MUST accept YAML or JSON at that filename; markdown MAY use YAML frontmatter between `---`. | **MAY** / **MUST**
105. **C-DUAL-SERIALIZATION-CONSISTENCY / -MISMATCH-RESOLUTION** | CommitmentView | uniqueness/conditional | When a sibling YAML accompanies a notebook, both MUST carry the same values for any shared field; on mismatch a verifier SHOULD prefer the serialization whose signature recomputes correctly and SHOULD report the mismatch. | **MUST** / **SHOULD**
106. **C-CELL0-NON-AUTHORITATIVE** | Cell0RenderingTable | structural | SHOULD render a first-cell metadata table as a pure reader affordance; verification MUST NOT depend on it; a reader needing to verify MUST work from the evidence namespace metadata or the sibling YAML. | **SHOULD**
107. **C-ATT-ENTRY-TWO-FORMS / -REF-FIELDS / -EMBED-FIELDS** | attestations entries | structural | Each entry is reference form (kind, targetHash, attestationHash, attestationUrl) or embed form (kind, targetHash, attestationHash, attestation, signature). | **MAY** / **MUST**
108. **C-ATT-DEFAULT-TO-REFERENCE / -EMBED-VERIFY / -KIND-OPEN** | attestations | conditional/crypto/value | SHOULD prefer reference form for routine attestations; use embed only when structurally tied to the claim's trust state; a reader MUST verify an embedded attestation's signature against the trust registry like any other (embed/reference is a fetch-vs-size trade, not a trust trade); attestation-kind vocabulary governed by §8.12, not closed by §8.9. | **SHOULD** / **MUST** / **MAY**

### 4.11 Lifecycle attestations & retention asymmetry (§8.10)

109. **C-LIFECYCLE-REFERENCES-BY-NODEID** | LifecycleAttestation | reference | Lifecycle events are separately-signed `attestation/*` nodes referencing the target by `nodeId`, NOT DB-row columns. | **MUST**
110. **C-LIFECYCLE-SIGNED-LIKE-CONTENT / -SIGNING-KEY** | LifecycleAttestation | crypto | Each is Ed25519ph-signed and SHOULD be RFC 3161-timestamped + Rekor-included like a `content/*` envelope (the target's own signature is unmodified); signed under the same trust-registry key as the target (or delegated-publisher per Q20). | **SHOULD** / **MUST**
111. **C-withdrawal-append-only** | withdraws/reinstates | structural | Withdrawal and reinstatement are signed, public, append-only events referencing the target by nodeId. | **MUST**
112. **C-MULTICYCLE-NO-LIMIT** | LifecycleAttestation | cardinality | published→withdrawn→reinstated→… is a longer chain; each reinstatement points back to its immediately-prior withdrawal via `priorWithdrawalNodeId`; no cycle counter, no DB-shape mutation per cycle, no spec-level cycle limit. | **MAY**
113. **C-LIFECYCLE-CHAIN-ORDER / -CURRENT-STATUS** | LifecycleAttestation | uniqueness/conditional | A verifier MUST surface the chain of signer-matched lifecycle attestations in envelope-timestamp order (ties broken by `nodeId` lexicographic) and report current status from the latest signer-matched attestation per §8.10.3. | **MUST**
114. **C-RETENTION-WITHDRAWAL-BOUNDED** | WithdrawsAttestation | structural | A withdrawal from publisher P removes P's own visibility commitment/status label only; it does NOT invalidate `locatedAt` attestations signed by other parties pointing at the content elsewhere. | **MUST**
115. **C-RETENTION-BACKUP-INDEPENDENT** | LocatedAtAttestation | crypto | A backup host's `locatedAt` remains independently verifiable after P's withdrawal (its signature still verifies; content still hashes; its location attestation is not retracted). | **MUST**
116. **C-RETENTION-SURFACE-BOTH** | LifecycleAttestation | conditional | When a node has a withdraws from P AND a locatedAt from backup-host B, the verifier MUST display both ("withdrawn by publisher; copy still available at B's host") rather than treating withdrawal as global erasure. | **MUST**
117. **C-NO-SILENT-DELETION** | WithdrawsAttestation; implementations | structural | Implementations MUST NOT remove withdrawn content nodes from storage or registry listings except through explicit administrative action with an audit trail (scoped to the publisher's own infrastructure). | **MUST NOT**
118. **C-BLOBREF-IMPLICIT-LOCATEDAT** | LocatedAtAttestation | structural | BlobRef is the single-signer implicit case of `locatedAt`'s verification rule (fetch URI, recompute content hash, confirm size). | **SHOULD**
119. **C-PREV01-LIFECYCLE-LEGACY-COLUMNS / -DUAL-REPRESENTATION** | LifecycleAttestation | conditional | Pre-v0.1 lifecycle state in legacy DB columns (`withdrawnAt`/`reinstatedAt`) remains verifiable; verifiers MUST honor legacy columns when no withdraws/reinstates envelopes are present (schema stays 0.1.0 per Q27); reference impl honors both representations and emits attestation nodes for new packages. | **MUST** / **SHOULD**

### 4.12 Typed-claims layer (§8.11)

120. **TC-C1** | content/claim/v1 | conditional | Conforms IFF all five hold: valid JSON-LD 1.1 inside the canonical envelope; `@context` includes `https://typedstandards.org/ns/ts#`; every top-level claim validates against the published SHACL shapes; every confidence value is traceable to a recorded method; every claim is falsifiable. | **MUST**
121. **TC-C2** | ts:Claim.dcterms:identifier | uniqueness | Stable claim ID, unique within the package. | **MUST**
122. **TC-C3 / TC-R6** | ts:Claim.ts:scope | structural | Explicit ts:Scope with both geographic and temporal components; implicit scope is non-conforming. Required v0.1 (Q14). | **MUST**
123. **TC-C4 / TC-C5 / TC-R3 / TC-R7** | ts:confidence; ts:ConfidenceStatement | value | Confidence MUST reference a method and be method-derived/traceable to a recorded calculation; free-form `high/medium/low` non-conforming; domain-extension methods MUST also satisfy this. | **MUST**
124. **TC-C6 / TC-R8** | ts:ConfidenceStatement(ts:NotApplicable) | conditional | `ts:NotApplicable` MUST be accompanied by a description explaining why quantified confidence is inappropriate. | **MUST**
125. **TC-C7 / TC-C12 / TC-R4** | ts:Claim.prov:wasDerivedFrom | cardinality/reference | ≥1 entity, each derivable from the source `content/analysis/v1` provenance graph. | **MUST**
126. **TC-C8 / TC-R5** | ts:Claim.ts:derivedVia | structural | Every claim MUST link (`ts:derivedVia`) to the `ts:AnalyticalDerivation` step that produced it. | **MUST**
127. **TC-C9 / TC-R1** | attestation/wasDerivedFrom/v1 + ts:AnalyticalDerivation | conditional | A claim extracted from LLM prose MUST be captured as a separately-signed `attestation/wasDerivedFrom/v1` carrying a `ts:AnalyticalDerivation` (model, prompt, source span) — classification-laundering guard. | **MUST**
128. **TC-C10 / TC-R2** | ts:Claim (all subtypes) | structural | Every claim type MUST be defined so a counter-claim is expressible in the same vocabulary (falsifiable by construction). | **MUST**
129. **TC-C11** | ts:derivedVia vs attestation derivationMethod | reference | When the same AnalyticalDerivation appears in both, the two MUST be consistent. | **MUST**
130. **TC-C13 / TC-C14** | ts:TrendClaim.ts:direction; ts:ComparisonClaim.ts:relation | value | Closed enums {Increase, Decrease, NoSignificantChange} / {GreaterThan, LessThan, ApproximatelyEqual}. | **MUST**
131. **TC-C17 / TC-C18 / TC-C19** | content/claim/v1 payload | structural | Every top-level claim object MUST validate against the published SHACL shapes; payload MUST be valid JSON-LD 1.1 in the canonical envelope; `ts:subject` is exactly one URI. | **MUST**
132. **TC-C20** | ts:ObservationClaim | reference | Maps onto `qb:Observation`; `ts:unit` references QUDT/UCUM (alignment guidance). | **SHOULD**
133. **TC-C21 / TC-R12** | typed-claims presence | cardinality | A typed-claim node is OPTIONAL in v0.1; packages without typed claims remain fully valid; those emitting conformant `content/claim/v1` SHOULD receive richer network-layer treatment. | **MAY** / **SHOULD**
134. **TC-C22 / TC-R15** | causal claims | structural | v1 includes `ts:RelationshipClaim` but NO `ts:CausalClaim`; domain extensions MAY add causal types only with explicit identification-strategy fields. | **MUST** / **MAY**
135. **TC-C23** | ts:GeographicScope (arbitrary geometry) | conditional | For non-taxonomy geometries, MAY use base `ts:GeographicScope` with a `geo:hasGeometry` OGC GeoSPARQL literal. | **MAY**
136. **TC-C24 / TC-R14** | vocabulary selection | value | Prefer the most widely adopted external vocabulary for the domain; less-common choices SHOULD include `owl:sameAs`/`skos:exactMatch` to the canonical alternative. | **SHOULD**
137. **TC-C25 / TC-R10** | domain extensions | structural | MAY declare a namespace, subclass core claim types or define new ones, add properties, align externally; MUST publish SHACL shapes. | **MAY** / **MUST**
138. **TC-C16 / TC-C26 / TC-R11 / TC-R18** | content/claim/v1 lifecycle | structural | Claim nodes follow §8.10 lifecycle (withdraw/reinstate/supersede as separately-signed attestations by nodeId), independent of the source analysis; MUST NOT silently delete withdrawn claim nodes; verifier MUST surface the signer-matched lifecycle chain and report current status. | **MUST** / **MUST NOT**

### 4.13 Federation, IANA, i18n, security/privacy (§8.13, §10–13)

139. **C-FEDERATION-NONORMATIVE / -STABLE-URL / -INDEX-NOT-IN-PATH** | Federation | structural | v0.1 makes no normative claim about federation transport / outbound metadata (Q2, Q8); adopters running registries SHOULD publish to a stable, content-addressable URL and SHOULD honor the trust-registry contract; the `typedstandards.org` index is indexing-only and NOT in the verification path. | **MAY** / **SHOULD** / **MUST NOT**
140. **C-IANA-provisional** | WellKnownTypedPublisherRegistration | value | v0.1 requests PROVISIONAL registration of `/.well-known/typed-publisher.json` only; permanent promotion deferred until a stable v1.0 at a permanent URL AND ≥1 external conforming implementation exist. | — |
141. **C-IANA-legacy-unregistered / -vocab-identifier / -canon-enum** | IANA reservations | value | Legacy `evidence-public-keys.json` is NOT IANA-registered; the `ts:` vocabulary URI is an identifier (no IANA action); reserved canonicalization URIs are exactly dathere-ag-jupyter/v1 and legacy-json/v1. | — |
142. **C-offline-asof-render / -surface** | self-contained bundle verifier | temporal/conditional | The bundle carries the registry as of `generatedAt`; an offline verifier cannot observe post-snapshot revocations; verdict is "verified … as of `<generatedAt>`"; verifier SHOULD render the as-of date and SHOULD offer an online-recheck affordance. | **SHOULD**
143. **C-kid-swap-crosscheck** | envelope (signer vs sig) | reference | Mitigating the kid-swap attacker requires the §9.2 check-14 cross-check between `sig.kid`-resolved identity and `signer.identifier`; these MUST be consistent. | **MUST**
144. **C-privacy-zero-located / -rekor-discloses** | content node (visibility base case) | cardinality/conditional | A content node MAY be signed with ZERO `publishes`/`locatedAt` references (truly-no-public-footprint, verifiable by signer, not retrievable by others). But if a Rekor inclusion proof is obtained, the publication's existence and signer identity are revealed; no-footprint mode requires skipping Rekor OR using a private log substrate. | **MAY**
145. **C-pseudonymous-tier** | signer identity binding | value | A publisher MAY sign under bindingTier `pseudonymous`; such signers SHOULD expect weaker consumer trust signals. | **MAY** / **SHOULD**
146. **C-withdrawal-retention / -oneway** | withdrawn content node | structural | Withdrawal does not erase: the node remains in the append-only transparency log, at independent third-party `locatedAt` URLs, and in non-retracted backup locations; adopters publishing privacy-sensitive content SHOULD treat publication as a one-way operation. | **SHOULD**
147. **C-i18n-language-tags / -single-lang-fields / -domain-ext-shacl / -geoscope-extensions** | typed-claim strings; datHere/commitment-view fields; domain extensions; geographic scope | value/structural | `rdfs:label`/`schema:name`/`dcterms:identifier`/`dcterms:description` MAY carry `@language` tags; `summary` and `subjectTitle`/`subjectSummary` are single-language strings in v0.1; non-English domain extensions MAY publish local-language terms and their SHACL shapes SHOULD validate against local-language property names; international geographic-scope equivalents should be domain extensions. | **MAY** / **SHOULD**
148. **R-spec-apidoc-align** | spec + reference-impl API doc | structural | This document and `civic-ai-tools-website/docs/api/evidence-publish.md` MUST stay aligned; on divergence this document is normative for the package shape, the API doc for the request/response contract. | **MUST**

---

## 5. Lifecycle & state model

State machines below are **derived-view projections over append-only signed-attestation chains**, not destructive in-place mutations. "Current status" is computed from the latest signer-matched lifecycle attestation in envelope-timestamp order (ties broken by `nodeId` lexicographic), under the §8.10.3 retention-asymmetry rule.

### 5.1 Content-node lifecycle (publication / withdrawal / reinstatement / supersession)

| Entity | from → to | trigger | guard |
|---|---|---|---|
| ContentNode.lifecycle | committed → published | `attestation/publishes/v1` (signed) | publisher-only OR delegated-publisher (Q20); carries `publicationHost` + `releasedAt`; references target by nodeId |
| ContentNode.lifecycle | published/active → withdrawn | `attestation/withdraws/v1` (signed) | publisher-only (`signer.identifier` == target's); `reason` required non-empty; `effectiveAt` defaults to envelope timestamp |
| ContentNode.lifecycle | withdrawn → active (reinstated) | `attestation/reinstates/v1` (signed) | publisher-only; references target by nodeId AND prior withdrawal by `priorWithdrawalNodeId`; optional reason |
| ContentNode.lifecycle | reinstated/active → withdrawn (subsequent cycle) | `attestation/withdraws/v1` (signed) | publisher-only; multi-cycle by construction — no cycle counter, no DB-shape mutation, no spec-level limit |
| ContentNode.lifecycle | active → superseded | `attestation/supersedes/v1` (signed) | publisher-only (typically same publisher); references prior by `targetNodeId` AND successor by `successorNodeId`; not stated mutually exclusive with withdraw/reinstate |
| Lifecycle status derivation | chain of signer-matched lifecycle attestations → current reported status | verifier derives status | chain ordered by (envelope-timestamp, nodeId lexicographic); §8.10.3 retention asymmetry governs withdrawal vs. independent copies |

### 5.2 Visibility / location

| Entity | from → to | trigger | guard |
|---|---|---|---|
| ContentNode.visibility | no-public-location (private/draft/enterprise; zero locatedAt) → located | `attestation/locatedAt/v1` (signed) | any-with-binding; carries `targetNodeId`, `uri`, `contentHash` (SHOULD match target), optional `contentLength`/`availability` |
| ContentNode.visibility | located → located (additional independent durable copy) | additional `locatedAt` from a different `(signer.identifier, uri-authority)` pair | distinct pairs signal independent durable copies (Q38); no `copyOf` minted |
| ContentNode.retention (asymmetry §8.10.3) | withdrawn-by-publisher-P → withdrawn-by-P but copy-verifiable-at-backup-B | P's withdraws does NOT retract backup-host B's locatedAt | B's signature still verifies; content at B's URI still hashes to target `contentHash`; B's locatedAt not retracted (only P's status changed). Verifier MUST surface both. |

### 5.3 Content typing (untyped → typed)

| Entity | from → to | trigger | guard |
|---|---|---|---|
| content node (typing) | untyped (`content/analysis/v1`, contentType `['untyped']`) → typed (`content/claim/question/evidence/v1`) | typed-content extraction processes raw output against a content profile, producing separately-signed typed nodes | each new typed node references the source via `attestation/wasDerivedFrom/v1` + `AnalyticalDerivation` derivationMethod (classification-laundering guard) |
| content/claim/v1 node | (none) → published/active | publisher signs + emits the envelope (Ed25519ph, timestamp, Rekor, identity binding) | valid JSON-LD 1.1 claim payload conforming to the five §8.11.3 conditions |
| content/claim/v1 node | published/active → withdrawn / withdrawn → active / active → superseded | §8.10 attestations targeting the claim by nodeId | inherits §8.10 authorization rules; claim verifiable/withdrawable/reinstatable/supersedable/corroboratable/contradictable independently of the source analysis |

### 5.4 Signing & proof state (publish-time, best-effort)

| Entity | from → to | trigger | guard |
|---|---|---|---|
| PackageSigningState | unsigned-envelope → signed | Ed25519ph signing succeeds | satisfies signed-package conformance |
| PackageSigningState | unsigned-envelope → null-signature (persisted, unsigned) | signing leg fails (best-effort) | package + envelope hash remain valid but NOT signed-package conformant |
| TimestampState | signed → timestamped+logged | RFC 3161 token + Rekor proof obtained (best-effort) | on failure persists as null columns; package remains queryable |
| PromptVisibility | (authoring) → full_text / hash_only | publisher choice | full_text ⇒ `prompt.text` present; hash_only ⇒ `prompt.text` omitted, only `prompt.hash` |

### 5.5 Notebook provenance (HOW authored — orthogonal axis)

| Entity | from → to | trigger | guard |
|---|---|---|---|
| NotebookProvenance | (authoring) → skeleton | notebook wraps an answer authored elsewhere (chat-flow output); data-fetch cells re-executable, answer-synthesis hardcoded | `org.civicaitools.execution` MUST be absent; §8.7.3 satisfied PARTIALLY |
| NotebookProvenance | (authoring) → executed | notebook executed end-to-end by publisher's pipeline before signing | `org.civicaitools.execution` MUST be present (executedAt, environment, executionDuration_ms); §8.7.3 satisfied MATERIALLY; comparison cell SHOULD be appended unless `comparisonCellPresent==false` |
| NotebookProvenance | absent → skeleton | verifier encounters no provenance field (pre-v0.1 default) | pre-v0.1 datHere packages omit the field and remain conformant |

### 5.6 Trust-registry key & captureMethod-vocabulary lifecycle

| Entity | from → to | trigger | guard |
|---|---|---|---|
| TrustRegistryKey | (none) → active | activation (`activatedAt` set) | registered in trust registry |
| TrustRegistryKey | active → deprecated | deprecation (`deprecatedAt` set) | packages signed before remain trusted; after, not |
| TrustRegistryKey | active/deprecated → revoked | revocation (`revokedAt` set) | revoked never trusted regardless of integration time |
| KeyTrustVerdict | verification → {active, deprecated_valid, deprecated_invalid, revoked, unknown_key, registry_unavailable, legacy_embedded} | verifier applies (kid,publicKey) match + status semantics | deprecated_valid iff signed before `deprecatedAt`; deprecated_invalid iff after; revoked always invalid |
| CaptureMethod (ai-assisted-analysis) | `claude-code-self-report` active → deprecated | deprecation date 2026-04-28 | value retained for re-rendering pre-discipline packages with their actual capture method |

### 5.7 Offline verifiability & build-state governance

| Entity | from → to | trigger | guard |
|---|---|---|---|
| OfflineVerificationVerdict | verified-as-of-snapshot → verified-against-live-registry | verifier invokes online-recheck affordance | offline snapshot bounded at bundle `generatedAt`; cannot see post-snapshot revocations |
| OfflineVerification | online (live fetches) → fullyOffline (zero-network) | verification over a self-contained `?inline=1` bundle behind a throwing fetch stub | bundle inlines proofs (checks #2/#7/#8/#10) + trust registry (#5); demonstrated by the Q15 harness. Non-inline §8.8 sidecar still performs public-infrastructure fetches (not zero-network). |
| §9.2 checks #7 (RFC 3161) / #8 (Rekor) | specified → ENFORCED | shipped in `@typedstandards/verify-core@0.6.0` (2026-06-08) | pinned FreeTSA root + X.509 chain; pinned Rekor key + signed checkpoint present |
| Offline verifiability property | aspirational target → demonstrated property of the self-contained `?inline=1` bundle | Q15 offline-bundle harness verifies real production packages at full §9.2 depth with zero network | harness asserts zero fetches + fullyOffline resolution; Q15 resolved on this basis. NOT a property of the bare single-blob package (still depends on a proof carrier — Q1) |
| architecture layer (build state) | reserved → specified → built | a real adopter or package concretely needs the change (Xanadu doctrine) | motivating adopter named in the promoting work |

---

## 6. Verification procedure (§9.2 ordered check list)

A conformant verifier performs every check against any node it processes; lifecycle state is surfaced when present; the verifier refuses to compute platform-issued correctness verdicts (§5.1). The 15 numbered checks below are the §9.2 sequence; structural shape checks (family membership, QEC set, profile-consistency, required-field presence, BlobRef shape, attestation-entry form, claim-shape validation) are additional SHACL-targetable validations drawn from §7.3 / §8.7 / §8.11 and listed after.

| # | Check | SHACL-expressible? | Why / failure mode |
|---|---|---|---|
| 1 | **Envelope integrity** — recompute envelope hash over the canonical JSON (v0.1: RFC 8785 JCS of the unsigned envelope + SHA-256; pre-v0.1: JSON.stringify insertion-order + SHA-256); MUST equal the envelope-hash hex string reported. | **No** | Requires SHA-256 + JCS canonicalization. Mismatch ⇒ bytes altered since signing. |
| 2 | **Signature mathematics** — verify the Ed25519ph signature over the envelope-hash hex string against the embedded publicKey (pre-v0.1 over the legacy hash). | **No** | Cryptographic Ed25519ph verification. Invalid ⇒ not signed by the named key over these bytes. |
| 3 | **Content canonicalization rule resolution** — read `contentCanonicalization`; resolve via the verifier's local rule registry; unknown URI ⇒ `unknown_canonicalization_rule`; absent on pre-v0.1 ⇒ infer from contentProfile. | **Yes** | URI presence + `sh:in` membership in the known rule set; live-registry resolution is out-of-band but membership is graph-checkable. |
| 4 | **Content hash verification** — apply the resolved rule to off-log content; multihash per the algorithms in `contentHash`; confirm ≥1 listed digest matches. | **No** | Hash recomputation over off-log content. No match ⇒ off-log bytes don't match the signed fingerprint. |
| 5 | **Trust-registry verdict** — look up the envelope `(kid, publicKey)` in the trust registry; apply active/deprecated/revoked status semantics. | **No** | Requires a trust-registry data join (live `.well-known` fetch or inlined snapshot) + temporal comparison against signing time. |
| 6 | **`metadata.signingKeyId` consistency** — confirm `sig.kid == metadata.signingKeyId`. | **Yes** | Pure intra-graph equality (`sh:equals`) when both materialized. Mismatch ⇒ envelope-vs-canonical drift (envelope swap). |
| 7 | **Timestamp validity** — for a non-null RFC 3161 token: cryptographically verify the TSA signature AND validate the token's embedded ECDSA-P384 signing-cert chain to the pinned FreeTSA RSA-4096 root (§10.3). Full X.509 chain validation, not presence/parity. **ENFORCED** in verify-core@0.6.0. | **No** | RFC 3161 token signature + X.509 cert-chain validation to a pinned root. |
| 8 | **Transparency-log inclusion** — for a non-null Rekor entry: verify RFC 6962 Merkle inclusion against the pinned Rekor log public key (ECDSA P-256) + signed checkpoint (§10.3). Not entry-id presence, not a parity check. **ENFORCED** in verify-core@0.6.0. | **No** | RFC 6962 Merkle inclusion-proof verification against a pinned key. |
| 9 | **BlobRef integrity** — for every BlobRef, fetch over HTTPS, recompute SHA-256, confirm size (§8.1.5). | **No** | HTTPS fetch + SHA-256 recomputation. |
| 10 | **Lifecycle state** — detect withdrawal/reinstatement/supersession/publication via the chain of signer-matched `attestation/*` lifecycle nodes referencing the target by nodeId; verify each lifecycle signature + timestamp independently; apply §8.10.3 retention asymmetry. | **No (mixed)** | Chain ordering/structure and signer-matching by identifier equality are SHACL-checkable; per-attestation signature + timestamp verification is out-of-band. |
| 11 | **captureMethod label** — read `metadata.captureMethod`; render alongside the signature verdict (label covered by the signature). | **Yes** | Structural field read/presence. (Integrity comes from check #2; reading the label is a graph operation.) Degrades gracefully even when #15 cannot run. |
| 12 | **`type` resolution** — resolve to a known v0.1 sub-type (or future ADR-minted); pre-v0.1 absent ⇒ implicit `content/analysis/v1`; an unknown URI ⇒ `unknown_type` (**non-fatal**, does NOT fail verification). | **Yes** | `sh:in` membership; non-fatal outcome modeled as `sh:Warning`/`sh:Info`. |
| 13 | **nodeId cross-check** — recompute the envelope hash (= nodeId by construction); for an attestation whose `targetNodeId` points here, it MUST resolve to this envelope hash; unresolvable ⇒ `unknown_target_node` (**non-fatal**, MAY report). | **No (mixed)** | Reference resolution (targetNodeId matches a known node's nodeId) is SHACL-expressible if both nodes are in the data graph; the authoritative nodeId derivation requires envelope-hash recomputation (out-of-band). |
| 14 | **signer ↔ kid cross-check** — read `signer.identifier`; look up the envelope kid in the trust registry; compare against the entry's `signerIdentity.identifier`. Mismatch ⇒ `signer_identity_mismatch` and **REJECT**. Pre-v0.1: derive signer from the registry, skip the cross-check. | **No** | Requires a trust-registry join; the intra-package half is checkable but the registry lookup is not pure graph validation. |
| 15 | **captureMethod per-profile vocabulary conformance** — resolve `producerProfile` (or legacy-alias / implicit `ai-assisted-analysis` for pre-v0.1); confirm `metadata.captureMethod` ∈ the declared vocabulary. Not in vocabulary ⇒ `captureMethod_unknown` and **REJECT**. Unresolvable bundle ⇒ `producerProfile_bundle_unresolved` and **degrade gracefully** (value preserved verbatim, structural integrity check #11 still passes, only the vocabulary-conformance assertion unverified). | **Yes** | `sh:in` membership in the profile vocabulary IF that vocabulary is materialized in the shapes graph; bundle-unresolved branch requires out-of-band resolution. |

**Verifier error-code vocabulary** (useful as a SysML behavior-output enum): `unknown_target_node`, `unknown_canonicalization_rule`, `unknown_type`, `signer_identity_mismatch`, `captureMethod_unknown`, `producerProfile_bundle_unresolved`. Non-fatal: `unknown_type`, `unknown_target_node`. REJECT: `signer_identity_mismatch`, `captureMethod_unknown`. Graceful-degrade: `producerProfile_bundle_unresolved`.

### 6.1 Additional SHACL-expressible structural validations (pure graph-shape)

| Check | What it validates | Failure mode |
|---|---|---|
| Family membership | exactly one of {content/* (no targetNodeId), attestation/* (≥1 targetNodeId)} consistent with the type-URI first segment | family/type-URI mismatch |
| QEC set | `metadata.contentType` non-empty over {claim, question, evidence, untyped}; `untyped` not co-occurring with typed values | empty / unknown value / untyped-mixed-with-typed |
| Profile consistency | `contentProfile === 'datHere'` iff `producerProfile.startsWith('ai-assisted-analysis/datHere')` | profile inconsistency |
| Required structural fields | presence/datatype/cardinality of type, contentHash (with sha256), contentCanonicalization, sig{publicKey,algorithm,kid}, timestamp, rekorInclusionProof, metadata, captureMethod; hash-algo ∈ {sha256, sha3-256, blake3}; canonicalization URI ∈ reserved set | missing/malformed required field; unknown hash algo / canonicalization URI |
| targetNodeId rule | required on `attestation/*`, forbidden on `content/*` | targetNodeId on content/* or missing on attestation/* |
| type URI pattern | `content/<noun>/v<N>` or `attestation/<verb>/v<N>` | malformed type URI |
| BlobRef shape | `{ref, url, contentType, size}`; `ref` matches `blob:sha256:<64-hex>` | malformed BlobRef |
| Prompt visibility | enum + conditional `prompt.text` presence (present iff full_text; omitted iff hash_only) | text present with hash_only / absent with full_text |
| extensions keys | reverse-DNS identifiers | non-reverse-DNS extension key |
| datHere reqs 1–7 (presence) | prompt.visibility=='full_text'; non-empty skillText; environment ext + min field set; notebook ext present + format marker + cells; output present; summary present/non-empty; contentProfile=='datHere' | report `malformed-for-datHere` while still running §9 envelope-integrity checks (independent verdict axis) |
| provenance→execution conditional | `execution` ext present iff `notebook.provenance=='executed'`, absent if skeleton/absent | conditional-cardinality violation |
| Attestation-entry form | exactly one of reference form (attestationUrl, no inline) / embed form (inline attestation+signature, no attestationUrl) | matches neither or both forms |
| CommitmentView shape & values | all required §8.8.1 fields with datatypes/cardinalities; `contentProfile=='datHere'`; `algorithm=='Ed25519ph'`; `evidenceProtocolVersion=='0.1.0'`; captureMethod ∈ known vocab | missing/malformed field; value out of permitted set |
| nodeId reference resolution | `targetNodeId`/`successorNodeId`/`priorWithdrawalNodeId`/`locatedAt.targetNodeId` resolve to known nodes within a loaded graph; `priorWithdrawalNodeId` points at a withdrawal of the same target | dangling reference / mismatched prior-withdrawal target |
| Pre-v0.1 legacy-column fallback | when no withdraws/reinstates envelopes present, honor `withdrawnAt`/`reinstatedAt` columns | legacy lifecycle state ignored |
| Typed-claim shape (§8.11 / Appendix B) | required ts:Claim properties + subtype-specific required properties; closed enums (ts:direction, ts:relation); `dcterms:identifier` unique within package; both scope components present; confidence carries a method; `ts:NotApplicable` + description; `@context` first member is the ts: URI; `ts:byteRange` exactly 2 integers | SHACL constraint violation (missing property, wrong datatype, minCount, enum out of `sh:in`, duplicate identifier, implicit scope) |

**Out-of-band typed-claim checks** (not SHACL): confidence `methodReference`/`traceReference` resolving to a recorded calculation in `trace.json`; `prov:wasDerivedFrom` derivability from a separately-fetched source-analysis provenance graph; existence/consistency of the separately-signed `attestation/wasDerivedFrom/v1` (classification-laundering guard); the falsifiability property (per-TYPE, not per-instance); all envelope crypto (signature, hash, Rekor, timestamp); JSON-LD 1.1 document well-formedness (a parsing concern, though `@context` membership is checkable once parsed).

**Malformed-vs-integrity split (SysML).** A verifier finding a datHere requirement violation MUST report `malformed-for-datHere` but MUST still run the standard §9 envelope-integrity checks — model as two parallel verification activities (datHere-conformance and envelope-integrity are independent verdict axes, not a single composite verdict).

---

## 7. Conformance requirements

> **id | statement | subject | keyword.** Consolidated across regions; duplicates merged.

### 7.1 Preamble, truth-scoring, governance

| id | statement | subject | keyword |
|---|---|---|---|
| R-preamble-carry | Carry the normative preamble (or a clearly-equivalent statement), surfaced where readers encounter it before forming conclusions. | product surface / downstream consumer / derived publication / third-party implementation | MUST |
| R-no-automated-truth-scoring | Do not use signed-node signals to compute platform-issued correctness verdicts, rank-by-trust scores, or any consensus collapse. | implementer | MUST NOT |
| R-consumer-aggregation-with-framing | Consumer-side aggregation (citation graphs, contradiction surfacing, meta-analysis) is permitted and encouraged, provided the preamble framing accompanies the result. | consumer | MAY |
| R-graded-identity-no-verdict | Never compute a platform-issued trust verdict from identity binding tiers; surface them as filterable signals. | the standard / implementation | MUST NOT |
| R-xanadu-no-promotion | Items move reserved → specified → built only when a real adopter/package concretely needs the change; this spec sketches reserved layers but promotes none. | implementer / project | MUST |
| R-c2pa-term-disambiguation | Refer to C2PA constructs as "C2PA claim" and "C2PA assertion." | this specification | MUST |
| R-vc-term-disambiguation | Use "VC claim" for a property inside a VC credential; unqualified "claim" always means a `content/claim/v1` node. | this specification | MUST |
| R-spec-apidoc-align | This document and `evidence-publish.md` MUST stay aligned; this document is normative for the package shape, the API doc for the request/response contract. | spec + reference-impl API doc | MUST |
| R-iana-provisional | Request provisional IANA registration of `/.well-known/typed-publisher.json` (RFC 8615 Specification Required); permanent promotion deferred pending stable v1.0 + ≥1 external conforming impl. | this specification / IANA | — |

### 7.2 Structural primitive, identity, signing

| id | statement | subject | keyword |
|---|---|---|---|
| R-type-required | A signed node's `type` URI is required v0.1; absent ⇒ `content/analysis/v1` (pre-v0.1). | signed node | MUST |
| R-content-no-targetNodeId | A `content/*` payload MUST NOT carry `targetNodeId`. | content/* node | MUST NOT |
| R-attestation-targetNodeId | An `attestation/*` node MUST carry ≥1 `targetNodeId` (target need not be retrievable). | attestation/* node | MUST |
| R-captureMethod-required | Declare `captureMethod` in a field covered by the canonical-JSON hash (and signature); required, signed, tamper-evident. | package / signed node | MUST |
| R-signer-recommended | The `signer` object is RECOMMENDED v0.1; pre-v0.1 derive from registry `signerIdentity` for the kid. | signed node | SHOULD |
| R-signer-crosscheck | Cross-check `sig.kid → registry signerIdentity` against `signer.identifier`; mismatch ⇒ `signer_identity_mismatch` + reject. | verifier | MUST |
| R-sign-ed25519ph | Sign with Ed25519ph (RFC 8032 §5.1.2) over the UTF-8 bytes of the envelope-hash hex string. | evidence package | MUST |
| R-no-double-prehash | Implementations exposing only Ed25519 MUST NOT pre-hash on the application side. | signing implementation | MUST NOT |
| R-kid-pubkey-registry | Envelope `(kid, publicKey)` MUST match a trust-registry entry. | signature envelope | MUST |
| R-signingKeyId-eq-kid | `metadata.signingKeyId` MUST equal the envelope's kid. | evidence package | MUST |
| R-contentHash-v01 / R-contentHash-match | v0.1 MUST embed `contentHash` as a multihash set (≥1 entry, sha256 default); ≥1 listed algorithm's digest MUST match the recomputed off-log digest. | evidence package / verifier | MUST |
| R-tsa-rekor | A conformant package SHOULD carry an RFC 3161 trusted timestamp from a public TSA and a Sigstore Rekor inclusion proof. | evidence package | SHOULD |
| R-tsa-validate / R-rekor-validate | A conformant offline verifier validates the RFC 3161 token's ECDSA-P384 leaf up an X.509 chain to the pinned FreeTSA root, and verifies RFC 6962 Merkle inclusion against the pinned Rekor key + signed checkpoint. | conformant offline verifier | MUST |
| R-tsa-anchor-doc / R-rekor-anchor-doc | Adopters changing TSAs MUST document their root anchor (fingerprint + provenance) in §10.3; private-log adopters SHOULD document their own log anchor. | adopter | MUST / SHOULD |
| R-private-log | The architecture PERMITS private transparency logs for maximally-sensitive cases (design-permission only). | architecture | MAY |

### 7.3 Package, profiles, BlobRef, datHere

| id | statement | subject | keyword |
|---|---|---|---|
| R-pkg-conformant / R-pkg-single-object | A conformant package carries every required top-level field; optional fields MAY be omitted but MUST conform when present; it is a single JSON object whose canonical serialization is the SHA-256 envelope-hash input. | evidence package | MUST |
| R-summary-datHere | `summary` MUST be present when `metadata.contentProfile == 'datHere'`. | summary field | MUST |
| R-profile-consistent / R-prefer-producerProfile | `contentProfile`/`producerProfile` MUST be consistent (datHere iff producerProfile starts with ai-assisted-analysis/datHere); verifiers SHOULD prefer producerProfile when present. | contentProfile/producerProfile / verifier | MUST / SHOULD |
| R-prompt-visibility | `prompt.text` MUST be omitted when `hash_only` and present when `full_text`. | prompt | MUST |
| R-extensions-advisory | Extension content MUST NOT change spec-field meaning; verifiers MAY ignore unknown extensions without breaking conformance. | extensions | MUST |
| R-notebook-datHere | Under `contentProfile:datHere`, `org.civicaitools.notebook` MUST be present and carry the deterministic section-E notebook. | notebook extension | MUST |
| R-blobref-verify / R-blobref-fail / R-blobref-consumer | On a BlobRef, fetch over HTTPS, recompute SHA-256 (== ref hex), confirm length == size; fetch/hash/size failure ⇒ `ok:false`; downstream consumers SHOULD treat the package as missing that content. | verifier / consumer | MUST / SHOULD |
| R-locatedAt-crosshost | New cross-host location declarations by parties other than the parent signer SHOULD use `attestation/locatedAt/v1` instead of BlobRef. | publisher | SHOULD |
| R-8.6-1..3 (captureMethod) | A package published after 2026-04-29 MUST carry exactly one value from its producerProfile bundle's captureMethod vocabulary; a verifier MUST resolve producerProfile (with fallbacks), resolve its bundle, and confirm membership; the reference publish route MUST enforce captureMethod (missing/invalid ⇒ HTTP 400). | package / verifier / publish route | MUST |
| R-8.6-4 | Surfaces SHOULD render pre-v0.1 (null) packages as "Unknown (pre-v0.1)" and render the captureMethod label near the signature verdict. | surfaces | SHOULD |
| R-8.7.1-1..3 (datHere) | A conformant datHere package MUST satisfy every §8.7.1 requirement in addition to §8.1/§8.2/§8.3/§8.6; `summary` MUST be present/non-empty (SHOULD ≤280 chars); a verifier failing any §8.7.1 requirement MUST report `malformed-for-datHere` while still running standard envelope-integrity checks. | datHere package / summary / verifier | MUST |
| R-8.7.2 / R-8.7.3 (notebook & determinism) | Section E MUST be Jupyter nbformat 4 (v4.5+) with a top-level cells array or an admitted self-contained/reproducible alternative with a content-type marker + renderer; datHere SHOULD default to Jupyter v4.5+; the notebook MUST record runtime requirements (first cell or sidecar); re-execution SHOULD reproduce section F byte-for-byte modulo nondeterministic formatting; render the property as "reproducible against the documented runtime AND upstream-data state at publish time." | section E / verifiers & surfaces | MUST / SHOULD |
| R-8.7.4-1..4 (provenance & comparison) | `org.civicaitools.execution` MUST be present when `executed` (carrying executedAt, environment ≥ python+libraries, executionDuration_ms) and absent when `skeleton`; verifiers SHOULD treat absent provenance as skeleton; executed notebooks SHOULD append the comparison cell (documented metric selection); surfaces SHOULD frame reproducibility with property-naming labels. | execution extension / verifiers / publisher pipeline / surfaces | MUST / SHOULD |

### 7.4 Trust registry & verifier behavior

| id | statement | subject | keyword |
|---|---|---|---|
| R-legacy-registry-serve | Reference impls SHOULD serve byte-identical trust-registry content at the legacy `/.well-known/evidence-public-keys.json`; verifiers MAY fetch either; new external clients SHOULD fetch the canonical path. | reference implementation | SHOULD |
| R-verifier-registry | A verifier MUST match the envelope `(kid, publicKey)` against a registry entry and apply active/deprecated/revoked semantics. | verifier | MUST |
| R-signerIdentity-populate | Post-ADR-0009 registries SHOULD populate `signerIdentity` for every active key. | post-ADR-0009 registry | SHOULD |
| R-legacy-embedded-render | Surfaces SHOULD render `legacy_embedded` as a neutral status, not a failure. | verification surfaces | SHOULD |
| R-ver-all-checks / R-ver-surface-lifecycle / R-ver-no-correctness-verdict | A conformant verifier performs every §9.2 check on any node, surfaces lifecycle state per §8.10 when present, and refuses to compute platform-issued correctness verdicts (§5.1). | conformant verifier | MUST |
| R-ver-timestamp-full / R-ver-rekor-full | When a non-null RFC 3161 token / Rekor entry is supplied, perform full TSA-signature + X.509 chain validation to the pinned root, and full RFC 6962 Merkle inclusion verification against the pinned key + signed checkpoint (not presence/parity). | conformant verifier | MUST |
| R-ver-envhash-eq / R-ver-nodeId-resolve / R-ver-signer-identity-xcheck / R-ver-captureMethod-vocab | Recomputed envelope hash MUST equal the reported value; a referencing `targetNodeId` MUST resolve to this envelope hash (else `unknown_target_node`); `signer.identifier` MUST match the resolved registry identity (else `signer_identity_mismatch` + reject); `metadata.captureMethod` MUST be in the declared vocabulary (else `captureMethod_unknown` + reject). | conformant verifier | MUST |
| R-ver-asof-date | Offline operation SHOULD render the as-of date (bundle `generatedAt`) and SHOULD offer an online-recheck affordance. | conformant offline verifier | SHOULD |

### 7.5 Cross-host publication, attestation rendering, lifecycle

| id | statement | subject | keyword |
|---|---|---|---|
| R-8.8-verifier-accept-either / R-8.8-commit-carries-fields | A verifier MUST accept either commitment-view serialization; a publisher MAY emit either; the commitment view MUST carry the §8.8.1 field set. | verifier / commitment view | MUST / MAY |
| R-8.8.2-nb-namespace / -roundtrip / -ignore-siblings | A datHere Jupyter package MUST carry the view at `metadata.org.civicaitools.evidence`; the publisher MUST ensure it survives tooling round-trip; a verifier MUST ignore unknown sibling namespaces. | publisher / verifier | MUST |
| R-8.8.3-accept-yaml-or-json / -dual-consistency / -mismatch-resolution | A verifier MUST accept YAML or JSON at the `.evidence.yaml` filename; accompanying serializations MUST carry the same values for shared fields; on mismatch a verifier SHOULD prefer the signature-valid serialization and report the mismatch. | verifier / serializations | MUST / SHOULD |
| R-8.8.4-cell0 | A datHere Jupyter package SHOULD render a first-cell metadata table; it is non-authoritative and SHOULD NOT be trusted on its own; a reader needing to verify MUST work from the evidence-namespace metadata or sibling YAML. | publisher / reader | SHOULD / MUST |
| R-8.9-default-to-reference / -embed-verify / -kind-not-closed | Implementations SHOULD prefer reference form for routine attestations and embed only when structurally tied to trust state; a reader MUST verify an embedded attestation's signature against the trust registry; the schema accepts any attestation kind (not closed by §8.9). | implementations / reader / schema | SHOULD / MUST / MAY |
| R-att-struct-primitives / -type-uri / -target / -authz-rule / -payload | A conformant `attestation/*` node satisfies the structural primitives, carries a registered sub-type `type` URI, carries ≥1 `targetNodeId`, satisfies the sub-type authorization rule, and carries the sub-type's required payload fields. | conformant attestation/* node | MUST |
| R-ver-aggregate-stats / -drilldown / -distinguish-subtypes / -surface-lifecycle-att | When rendering a content/* node with referencing attestations, surface aggregate stats near the signature verdict, allow drill-down, distinguish sub-types visually, and surface lifecycle state for lifecycle attestations. | verifier (rendering) | SHOULD |
| R-ver-legacy-att | Until the pre-v0.1 attestation migration ships, treat existing records under the legacy attestation-kind vocabulary while emitting new ones under the new sub-type URIs. | verifier | SHOULD |
| R-8.10-lifecycle-by-nodeId / R-8.10.1-* | Lifecycle and location attestations are separately-signed `attestation/*` nodes referencing the target by nodeId; withdraws/reinstates/supersedes are publisher-only (withdraws: reason required non-empty + effectiveAt default; reinstates: priorWithdrawalNodeId + optional reason; supersedes: targetNodeId + successorNodeId); publishes is publisher-only OR delegated-publisher (Q20) with publicationHost + releasedAt; each lifecycle envelope is Ed25519ph-signed and SHOULD be timestamped + Rekor-included. | lifecycle/location attestations | MUST / SHOULD |
| R-ver-lifecycle-chain-order / -retention-surface | A verifier MUST surface the signer-matched lifecycle chain in envelope-timestamp order (ties by nodeId lexicographic), report current status from the latest, and (when a withdraws from P AND a locatedAt from backup-host B both exist) display both rather than treating withdrawal as global erasure. | verifier | MUST |
| R-pub-no-silent-delete | Implementations MUST NOT remove withdrawn content nodes from storage or registry listings except through explicit administrative action with an audit trail (scoped to the publisher's own infrastructure). | implementations | MUST NOT |
| R-ver-legacy-lifecycle-cols | A verifier MUST honor legacy DB columns (`withdrawnAt`/`reinstatedAt`) for pre-v0.1 packages when no withdraws/reinstates envelopes are present. | verifier | MUST |
| R-8.10.2-locatedAt-auth / R-8.10.2-blobref-crosshost | `attestation/locatedAt/v1` references the node by nodeId, carries targetNodeId/uri/contentHash(SHOULD match)/optional contentLength/availability, authorization any-with-binding; cross-host declarations by non-parent-signers SHOULD use locatedAt instead of BlobRef. | locatedAt / publishers | MUST / SHOULD |

### 7.6 Publisher, federation, privacy, i18n

| id | statement | subject | keyword |
|---|---|---|---|
| R-pub-validate-fields / -canonical-hash / -sign / -persist-caddr / -lifecycle-att / -preamble | A conformant publisher validates the publish-route required fields, builds canonical JSON with JCS + produces the envelope hash, signs the envelope-hash hex string with a trust-registry key, persists at a content-addressable URL, honors the append-only lifecycle, and carries the §5.1 preamble on every rendering surface. | conformant publisher implementation | MUST |
| R-fed-stable-url / R-ver-no-index-query | Adopters running registries SHOULD publish to a stable, content-addressable URL and SHOULD honor the trust-registry contract; no federation protocol is required; a verifier never queries `typedstandards.org` to verify (the index is informational, not in the verification path). | adopters / verifier | SHOULD / MUST NOT |
| R-priv-identity-tier-disclosure / -pseudonymous-may / -pseudonymous-expect | Publishers SHOULD consider the identity-tier choice part of the disclosure surface; a publisher MAY sign pseudonymously; pseudonymous signers SHOULD expect weaker consumer trust signals. | publisher | SHOULD / MAY |
| R-priv-publication-oneway / -zero-footprint-may | Adopters publishing privacy-sensitive content SHOULD treat publication as one-way (transparency-log entries are permanently public; withdrawal removes only the publisher's own visibility commitment); a content node MAY be signed with zero `publishes`/`locatedAt` references (no-public-footprint). | adopter / content node | SHOULD / MAY |
| R-i18n-claim-lang-tags / -domain-ext-may / -domain-ext-shacl-should | `rdfs:label`/`schema:name`/`dcterms:identifier`/`dcterms:description` MAY carry `@language` tags; non-English jurisdictions MAY use local-language domain extensions; the extension's SHACL shapes SHOULD validate against local-language property names. | typed-claim / domain-extension authors | MAY / SHOULD |

### 7.7 Typed-claims layer (§8.11)

| id | statement | subject | keyword |
|---|---|---|---|
| TC-R1 | A claim extracted from LLM prose MUST be captured as a separately-signed `attestation/wasDerivedFrom/v1` carrying a `ts:AnalyticalDerivation` (classification-laundering guard). | translator / publisher | MUST |
| TC-R2 | Every claim type MUST be defined so a counter-claim is expressible in the same vocabulary (falsifiable by construction). | vocabulary author | MUST |
| TC-R3 / TC-R7 / TC-R8 / TC-R9 | Any confidence value MUST trace to a recorded method; `ts:confidence` MUST reference a method (no bare high/medium/low); `ts:NotApplicable` MUST carry an explanatory description; new domain-extension methods MUST be method-derived/traceable. | confidence value / domain extension | MUST |
| TC-R4 / TC-R5 / TC-R6 | A claim MUST cite supporting evidence via `prov:wasDerivedFrom` (derivable from the source provenance graph), MUST link `ts:derivedVia` to its AnalyticalDerivation step, and MUST have an explicit geographic+temporal scope. | content/claim/v1 node | MUST |
| TC-R10 | A domain extension publishing claim shapes MUST publish SHACL shapes. | domain extension | MUST |
| TC-R11 | Implementations MUST NOT remove withdrawn claim nodes except through explicit administrative action with an audit trail (inherited §8.10.3). | implementation | MUST NOT |
| TC-R12 | Packages emitting conformant `content/claim/v1` nodes SHOULD receive richer network-layer treatment; packages without typed claims remain fully valid. | network-layer processor | SHOULD |
| TC-R13 | Each lifecycle attestation targeting a claim is Ed25519ph-signed and SHOULD be timestamped + Rekor-included (inherited §8.10.1). | claim lifecycle attestation | SHOULD |
| TC-R14 | Prefer the most widely adopted external vocabulary; include `owl:sameAs`/`skos:exactMatch` when using a less-common one. | claim author | SHOULD |
| TC-R15 | Domain extensions MAY add causal claim types only with explicit identification-strategy fields (core v1 has no `ts:CausalClaim`). | domain extension | MAY |
| TC-R16 | Typed claims MAY reference data sources from the source analysis's `dataSources[]` via the source's stable identifier. | typed claim | MAY |
| TC-R17 | Downstream processors SHOULD surface the source span (from `ts:sourceOutputSpan`) alongside the structured claim (anti-translation-laundering). | downstream processor | SHOULD |
| TC-R18 | A verifier MUST surface the signer-matched lifecycle chain for a claim node in envelope-timestamp order and report current status from the latest (inherited §8.10). | verifier | MUST |

---

## 8. Open-question dependencies

Parts of the model that are unsettled, by Q-number. Items marked **resolved** are recorded as settled within this region's scope.

| Q | Topic | What in the model depends on it / status |
|---|---|---|
| **Q1** | Package format | Whether the single-blob package embeds its own proofs (signature, RFC 3161 token, Rekor proof). Current direction: multi-file RO-Crate/WRROC directory. Offline verifiability is demonstrated only of the §8.8 self-contained commitment bundle, NOT the bare single-blob package (which relies on a proof carrier). Does not change the commitment-view shape — only where proofs live. |
| **Q2** | Federation substrate / private transparency log | §8.13 federation is non-normative (no required protocol; candidate substrates atproto/KOI/nanopub are informative). Private-Rekor substrates are design-permitted but Xanadu-gated; BlobRef URL addressing may generalize to CAS/IPFS. Private-log adopters document their own anchor. |
| **Q3** | First non-GitHub identity provider | Only the `oauth` (GitHub) `bindingTier` is implemented/conformant in v0.1; the graded ladder (pseudonymous/oauth/orcid/did-web/notarized) is informative; per-tier identifier schemas for orcid/did-web/notarized are out of scope. Sigstore Fulcio keyless OIDC is a candidate tier. **Do not formalize the unimplemented tier schemas.** |
| **Q4** | Trace capture | The five-span-kind set (`analysis`/`skill_fetch`/`llm_inference`/`mcp_tool_call`/`synthesis`) is normalized as conformant only for v0.1; resolution (real OTel SDK with GenAI/MCP semantic conventions, or Agent Receipts / W3C VC over MCP) will revise §8.4. `TraceDocument`/`SpanKind` are v0.1-provisional; **no span field schema beyond the kind enumeration.** Trace field shape provisional. |
| **Q5** | Typed-claim build-out timing | The entire typed-claims layer (§8.11) is `specified, not built`; `content/claim/question/evidence/v1` are reserved name-only. The carrier-shape question is settled (signed node, not `claims.jsonld`); build-out timing is gated on a real adopter package. |
| **Q7** | Producer-type scope | The `Cost` object presupposes a token-billed LLM (AI-specific); generalization beyond AI is open. |
| **Q8** | Croissant outbound metadata | Discoverability mechanism (outbound Croissant metadata); independent of the package format and envelope; no normative content in v0.1. |
| **Q9** | AI-specific commitments inventory | Which package fields are AI-specific (e.g., `Cost`) vs. generalizable. |
| **Q10** | OWL-ontology promotion of the typed-claims / CCV layer | Promotion of the `ts:` vocabulary from a controlled vocabulary to a full OWL ontology; decision is "promote," but the exact OWL axioms/class semantics are not yet fixed — affects how a SHACL/OWL formalization fixes class semantics. Vocabulary governance/versioning/breaking-change protocol deferred here. `ccv:` resolves as a legacy alias; deprecation gated on adopter need. |
| **Q14** | Geographic/temporal scope nullability | `ts:scope` is REQUIRED at v0.1; open whether v1.0 keeps the requirement or moves to "present unless explicitly waived with a documented reason." `ts:PolicePrecinct` subtype name flagged as possibly too NYC-coded. |
| **Q15** | External verification testing | **Resolved (2026-06-08)** on the basis of the offline-bundle harness: offline verifiability is a demonstrated property of the self-contained `?inline=1` bundle. |
| **Q16** | Formal conformance criteria | **Open.** Formal conformance criteria, a reference test corpus, and a conformance-claims registration mechanism remain deferred. |
| **Q20** | Visibility / lifecycle / delegated-publisher | Lifecycle attestations MAY be signed under a delegated-publisher key (not only the target's trust-registry key); `attestation/publishes/v1` authorization is publisher-only OR delegated-publisher. Delegated-publisher mechanics are a future ADR — the exact delegated-key authorization predicate is not yet formalizable beyond "permitted in principle." Affects "signer-matched" predicate precision in lifecycle-chain assembly. |
| **Q22** | Host as typeable subject / host self-attestation | `content/host/v1`, `content/hostPolicy/v1`, `content/hostTermsOfUse/v1` are reserved per Q22. Whether a backup host honors P's withdrawal at the application layer is a host-policy question (NOT a protocol question) — imposes no envelope/graph constraint. |
| **Q25** | Adversarial-evaluation requirement strength | The adversarial-eval requirement model for publication records lands in a future ADR; `attestation/evaluates/v1` operationalization timeline. |
| **Q26** | Valid-evaluator definition | `attestation/evaluates/v1` requires a declared methodology + bindingTier; the precise valid-evaluator definition is deferred. |
| **Q27** | Schema-version-bump trigger | Schema stays at `0.1.0` despite the lifecycle-attestation migration (§8.10.4); informational, no shape constraint. |
| **Q28** | Sandbox portability | `ExecutionExtension.sandboxId` is provider-agnostic by design; portability across sandbox providers is open. |
| **Q32** | captureMethod guidance-bundle distribution | The `captureMethod` vocabulary is open at core and per-profile; the bundle distribution/versioning/content-addressing mechanism is Q32 (v0.1 uses a hardcoded fallback table). The §9.2 check-15 `producerProfile_bundle_unresolved` branch depends on this. |
| **Q35** | sig-vs-signer cross-check | Cited as the **resolution basis** (with ADR-0009) for the §9.2 check-14 signer-identity cross-check. |
| **Q36** | Attestation sub-type collapse | The 15-member `attestation/*` table is the **Q36-ratified** table, with three refinements: `extractsTo` merges into `wasDerivedFrom` (AnalyticalDerivation = content-shape variant); `endorses` and `corroborates` stay distinct; Q38 resolves "locatedAt suffices, no copyOf." |
| **Q37** | Type-registry mechanism & governance | How sub-type URIs are documented/versioned/mirrored/deprecated/governed across the `content/`/`attestation/` namespaces stays Xanadu-gated — deliberately unspecified. Sub-types are an open enum. |
| **Q38** | copyOf vs. multiple locatedAt | **Resolved** within the Q36 table: no dedicated `copyOf` sub-type is minted; multiple `attestation/locatedAt/v1` from distinct `(signer.identifier, uri-authority)` pairs carry the independent-durable-copies signal. |
| **Q40** | typedstandards.org rename / namespace-prefix selection | Cited via the 2026-05-26 deep-research memo; affects the project name / `ts:` prefix selection. |

**Also recorded as resolution bases (not open):** ADR-0008 (multihash `contentHash`), ADR-0009 (§7 ratified attestation table + sig-vs-signer cross-check), ADR-0005 (notebook `provenance` auto-emission), ADR-0003 (captureMethod vocabulary, relocated to the ai-assisted-analysis profile bundle), ADR-0006 (Producer Profile subtype/flavor model).
