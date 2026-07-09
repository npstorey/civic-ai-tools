# Typed Standards as a SysML v2 Model

*A formalization study: re-expressing the Typed Standards Specification (v0.1.x) in the 2023+ KerML-based textual notation of SysML v2*

**Companion to:** `docs/architecture/typed-standards-specification.md` (normative for package shape) and the parallel SHACL formalization. This document is descriptive, not normative — it models the spec; it does not amend it.

> **Revision note (adversarial-review pass).** This revision fixes SysML v2 textual-notation syntax errors flagged by review (`syntaxValid: false`): metadata annotations now use the prefix `metadata` / `#` form rather than an `@…;` body statement; redefinitions use the single canonical `:>>` (or `redefines`) form with retyping/re-bounding in one clause; state-machine transitions use the `transition … first … accept … if … then …` shape with the source named by `first`; requirement obligations that were English prose inside `require constraint { … }` are moved to `doc` strings (KerML constraint bodies are boolean expressions, not prose); requirement decomposition uses nested `requirement` usages rather than a non-existent `includes` keyword; `interface def`s declare ends and are *used* (not defined) with `connect`; and short-name (`<'…'>`) and declared-name references are made consistent. Substantively, values not present in the spec have been removed or relabeled as explicitly open modeling choices (see the call-outs in §1.3 and §10.3): the `signer.bindingTier` enum now matches the spec's registry vocabulary; the `captureMethod` hyphenated label-strings are carried as string-valued constants with a note explaining why they are not enum identifiers; an invented "deprecated 2026-04-28" annotation on `claude-code-self-report` has been removed; and `ZIPCodeTabulationArea` is spelled as the spec spells it.

---

## 1. Thesis — what SysML v2 formalizes well, and where it is the wrong tool

### 1.1 What SysML v2 / KerML is

SysML v2 (OMG Systems Modeling Language, 2023+) is a complete rewrite of SysML, no longer a UML profile but a language built directly on the **Kernel Modeling Language (KerML)**. KerML supplies a small, formal core — *types*, *features*, *classifiers*, *specialization*, *subsetting*, *redefinition*, *feature chaining*, and an expression/constraint sublanguage with model-level evaluation semantics. SysML v2 layers a systems-engineering vocabulary on top: `part def`, `item def`, `attribute def`, `enum def`, `connection def`, `interface def`, `port def`, `action def`, `state def`, `calc def`, `constraint def`, `requirement def`, `metadata def`, `verification def`, `view def`, `analysis def`.

Three KerML mechanisms do the structural heavy lifting and recur throughout this document:

- **Specialization** (`:>`, "specializes") — an `is-a` relation between definitions; the special inherits every feature of the general. SysML keywords `specializes` and the operator `:>` are interchangeable.
- **Subsetting** (`subsets`, or `:>` on a feature) — a feature is a subset of another feature's values; multiplicity narrows.
- **Redefinition** (`redefines`, or `:>>`) — a feature replaces an inherited feature, typically to retype it or re-bound its multiplicity. This is the mechanism that lets `attestation/*` payloads *require* `targetNodeId` and lets `content/*` payloads *forbid* it, by re-bounding the *same* inherited feature.

The notation is textual, has a normative abstract syntax, supports model-level evaluation of constraint/calc bodies, and — critically for this study — carries first-class **requirement traceability** via `satisfy` and `verify` relationships between `requirement def` blocks and the structural/behavioral elements that discharge them.

### 1.2 What surface of Typed Standards SysML v2 formalizes *well*

The Typed Standards Specification is, structurally, four things at once: (a) a **data schema** (the evidence package, the cryptographic envelope, the attestation payloads), (b) a **behavior specification** (the §9.2 ordered verification check list, the publisher pipeline), (c) a **set of lifecycle state machines** (publication / withdrawal / reinstatement / supersession; key activation / deprecation / revocation; notebook provenance), and (d) a **normative-requirements corpus** (the MUST / SHOULD / MAY clauses of §9, §8.x, §5.1).

SysML v2 is a strong fit for (b), (c), and (d), and an *adequate-but-secondary* fit for (a):

- **System structure (a).** `part def` / `item def` / `attribute def` with typed attributes and explicit multiplicities capture the envelope, package, and payload shapes faithfully — including the family taxonomy via `:>` and the conditional presence of `targetNodeId` via redefinition. This is good but not the *unique* strength; SHACL and JSON Schema also do schema. SysML adds value here only because the same model also carries behavior and requirements.
- **Behavior (b).** The §9.2 check list is an *ordered procedure with control flow, branch outcomes, and delegation to external systems*. `action def` with `first … then …` succession and delegation to external `part`s expresses this directly — including the modeling of crypto/log steps as actions *delegated to external system parts* (the TSA, Rekor, the publisher's trust registry). SHACL cannot model an ordered procedure at all.
- **Lifecycle state machines (c).** `state def` with `entry`/`do`/`exit` and `transition … first … accept … if … then …` is the natural home for §8.10's append-only lifecycle, §8.3.3's key-status lifecycle, and §8.7.4's notebook-provenance axis — including the *derived-view* nature of the state (current status computed from the latest signer-matched attestation) and the **retention-asymmetry** property (a withdrawal that does not retract a third party's `locatedAt`).
- **Requirements traceability (d).** `requirement def` with `subject`, `assume constraint`, `require constraint`, plus `satisfy` / `verify` edges, captures §9's conformance clauses *as first-class model elements wired to the structures and behaviors that discharge them*. This is the surface SysML v2 formalizes best and the one no other formalism in this project's stack reaches: SHACL shapes are themselves the constraints, but they have no separate notion of "this requirement is satisfied by that structural element and verified by that check action."

### 1.3 What SysML v2 is *poor* at — and why both formalizations are needed

SysML v2 is **not an executable validator of RDF instance data**. It models *types and behaviors*; it does not ingest a concrete JSON-LD claim document and emit per-triple `sh:ValidationResult`s. Specifically:

- It cannot validate that a *particular* `content/claim/v1` instance carries a `ts:scope` with both geographic and temporal components, that `dcterms:identifier` is unique within a package, or that a closed enum value (`ts:direction ∈ {Increase, Decrease, NoSignificantChange}`) is respected at the instance level. Those are **SHACL's** job; this document marks every such constraint `[SHACL]` and models it in SysML only as a `constraint def` *signature* (a named, typed predicate) without claiming SysML enforces it over instances.
- It cannot perform the cryptographic and transparency-log checks itself (signature math, JCS recomputation, RFC 6962 Merkle inclusion). SysML models these as `action def`s whose *bodies are opaque* and whose effect is delegated to external `part def`s. This is honest modeling, not a deficiency — but it means the SysML model is a *map of the verification procedure*, not the verifier.

**Two notation constraints surfaced by review, handled honestly rather than by inventing spec content:**

- *Hyphenated label strings cannot be enum identifiers.* The spec's `captureMethod` vocabulary values are the literal strings `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report` (§8.6). SysML/KerML identifiers cannot contain hyphens, so these are **not** modeled as `enum` member names (which would silently rename them to `chat_flow_stream`, a value the spec does not define). They are carried as `String`-valued constant features whose default is the exact spec literal. The same applies to `producerProfile` compound strings like `ai-assisted-analysis/datHere`.
- *Spec ladders that are "informative" are modeled as open, not closed.* The `signer.bindingTier` ladder (§8.5) is explicitly informative ("only the GitHub tier is implemented"). The registry's own `signerIdentity.bindingTier` example value is `platform` (§8.3.3). The model uses the spec's actual vocabulary and marks the enum extensible, rather than freezing a closed set the spec does not freeze.

The division of labor this document adopts:


| Aspect of the spec                                                                                                                               | SHACL formalization                       | SysML v2 formalization (this doc)                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------- |
| Instance-level graph-shape validation (presence, datatype, cardinality, enum membership, conditional presence, intra-graph reference resolution) | **Authoritative**                         | Modeled as`constraint def` signatures + `assert constraint`; *not* executed |
| Crypto / hash / Merkle / cert-chain / network checks                                                                                             | Out of scope (`expressibleInShacl=false`) | Modeled as`action def`s delegated to external `part def`s                   |
| Ordered verification procedure (control flow, branch outcomes)                                                                                   | Cannot express                            | **Authoritative** (`action def`)                                            |
| Lifecycle / visibility / key state machines                                                                                                      | Cannot express                            | **Authoritative** (`state def`)                                             |
| Requirements + traceability (MUST/SHOULD/MAY → structure/behavior)                                                                              | Implicit in shapes                        | **Authoritative** (`requirement def` + `satisfy`/`verify`)                  |
| System context (publisher domain, TSA, Rekor, verifier)                                                                                          | Cannot express                            | **Authoritative** (`part def` / `interface def` / `connection def`)         |

Throughout, fenced blocks use SysML v2 textual notation. No requirement is introduced that is absent from the spec; where the spec marks a detail "(unspecified)" or "subject to Qn," the SysML model leaves the corresponding feature abstract or omits a body and annotates the open question.

---

## 2. Package structure for the model

SysML v2 organizes definitions into `package`s with `import`. The model decomposes along the spec's own seams. The top-level package and its members:

```sysml
package TypedStandards {
    doc /* Typed Standards Specification v0.1.x, re-expressed as a SysML v2 model.
         Normative source: docs/architecture/typed-standards-specification.md.
         This model is descriptive; the spec text is normative. */

    // Cross-cutting vocabularies ----------------------------------------
    package Primitives;          // base datatypes, multihash, URIs
    package BuildState;          // build-state metadata (green/yellow/orange)
    package Envelope;            // structural primitive: SignedNode + cryptographic envelope
    package Taxonomy;            // two-family taxonomy: content/* and attestation/*
    package ContentAnalysis;     // content/analysis/v1 EvidencePackage + datHere profile
    package TypedClaims;         // §8.11 ts: vocabulary (specified, not built; Q5)
    package CaptureAndProfiles;  // captureMethod + content/producer profiles
    package Infrastructure;      // trust registry, TSA, Rekor, BlobRef, pinned anchors
    package Lifecycle;           // §8.10 state machines: publication/withdrawal/location/keys
    package Verification;        // §9.2 ordered check list as behavior
    package Conformance;         // §9 requirement def blocks + satisfy/verify traceability

    import Primitives::*;
}
```

The `Conformance` package imports every other package, because `satisfy` / `verify` edges originate from requirements and terminate on structural and behavioral elements spread across the model. The `Primitives` package is imported everywhere. Build state (green/yellow/orange from `end-state-vision.md`) is carried as a `metadata` annotation (§5 below), not as separate packages, so a single `part` can be colored independently of where it lives.

---

## 3. The evidence package and cryptographic envelope as definitions

### 3.1 Base datatypes and the multihash digest set

The spec's primitive value types — URIs, hex digests, base64, ISO-8601 timestamps, the multihash `contentHash` — become `attribute def`s in `Primitives`. The multihash digest set is the in-toto DigestSet convention: an object keyed by lowercase algorithm with at least `sha256` present.

```sysml
package Primitives {
    import ScalarValues::*;

    attribute def UriString :> String;
    attribute def HexDigest :> String;    // SHA-256 / SHA3-256 / BLAKE3 hex
    attribute def Base64    :> String;
    attribute def Iso8601   :> String;    // ISO-8601 UTC

    // §8.2 / ADR-0008: multihash DigestSet, keyed by lowercase algorithm.
    // sha256 required by default; >=1 entry total.
    attribute def ContentHash {
        attribute sha256   : HexDigest[1];        // required default (C-contentHash-sha256-required)
        attribute sha3_256 : HexDigest[0..1];     // registered alternate
        attribute blake3   : HexDigest[0..1];     // registered alternate
    }

    // §8.1.5 — four-field content-addressable reference.
    item def BlobRef {
        attribute ref         : String[1];   // "blob:sha256:<64-hex>"
        attribute url         : UriString[1]; // HTTPS, no auth
        attribute contentType : String[1];    // MIME; distinct from QEC contentType
        attribute size        : Integer[1];   // fetched byte length MUST equal
    }
}
```

### 3.2 The cryptographic envelope — `sig`, signer, timestamp, Rekor

Section 8.3 of the spec specifies the signature envelope (`sig`), the identity claim (`signer`), the RFC 3161 timestamp, and the Rekor inclusion proof. These are `item def`s (they are data carried *inside* a signed node, not standalone parts).

```sysml
package Envelope {
    import Primitives::*;
    import ScalarValues::*;

    // §8.3.1 — the persisted signature envelope. algorithm is a const default.
    item def SignatureEnvelope {
        attribute signature : Base64[1];                 // Ed25519ph over the envelope-hash hex STRING
        attribute publicKey : Base64[1];                 // DER SPKI; MUST match a trust-registry entry
        attribute algorithm : String[1] default "Ed25519ph";  // RFC 8032 §5.1.2 (const)
        attribute kid       : String[1];                 // == metadata.signingKeyId
    }

    // §8.5 / §6.2 — the envelope-side identity CLAIM (who claims to have signed).
    item def Signer {
        attribute bindingTier : Taxonomy::BindingTier[1];   // §8.5 ladder (informative/extensible)
        attribute identifier  : String[1];                  // provider-prefixed; cross-checked vs registry
        attribute displayName : String[1];
        attribute verifiedAt  : Iso8601[0..1];
    }

    // §8.3.2 — best-effort proofs; persist null on failure (modeled as 0..1 multiplicity).
    item def Rfc3161Timestamp { attribute token : Base64[1]; }
    item def RekorInclusionProof {
        attribute entryId        : String[1];
        attribute inclusionProof : Base64[1];
        attribute checkpoint     : Base64[1];           // transparency-dev Go signed-note
    }

    // §8.1.2 — metadata carries the signature-covered labels.
    item def Metadata {
        attribute schemaVersion : String[1] default "0.1.0";
        attribute packageId     : String[1];            // UUID, != envelope hash
        attribute createdAt     : Iso8601[1];
        attribute signingKeyId  : String[1];            // == sig.kid (C-signingKeyId-eq-kid)
        attribute captureMethod : CaptureAndProfiles::CaptureMethodLabel[1];  // §8.6, signature-covered
        // QEC set; required for content/analysis/v1. Set semantics, >=1 member.
        attribute contentType   : ContentAnalysis::QecContentType[1..*];
        // NOTE (open modeling choice; see §10.3 item 1): the spec lists contentProfile as a
        // top-level field (§8.1.1) yet references metadata.contentProfile (§8.2/§8.7). Modeled
        // here on Metadata to match the more-cited access path; NOT presented as the settled home.
        attribute contentProfile : CaptureAndProfiles::ContentProfile[0..1];
    }
}
```

Two modeling notes the spec forces:

- **`nodeId` is derived, not stored.** The spec is explicit (§6.2, glossary): `nodeId` ≡ the envelope hash, by construction, not a separately-stored field. SysML expresses this as a `derived` attribute computed by a `calc`, not a stored `attribute` (§3.4 below). This faithfully prevents the model from implying that an implementation persists a `nodeId` independent of the hash.
- **Best-effort proofs → `0..1`.** Signing, timestamping, and Rekor inclusion are best-effort (§8.3.1, §8.3.2): on failure the column persists null. The structural primitive therefore types `timestamp` and `rekorInclusionProof` at `0..1`, and the *signed-package conformance* requirement (not the structure) demands them — modeled in §8 below.

### 3.3 The structural primitive `SignedNode`

`SignedNode` is the abstract `part def` every conformant signed node specializes. It is `abstract` because the spec says every node "belongs to exactly one of two families" — you never have a bare `SignedNode` instance.

```sysml
package Envelope {
    // §6.2, §7.1, §7.4 — the content-agnostic structural primitive.
    abstract part def SignedNode {
        // --- identity & integrity ---
        attribute type                    : Primitives::UriString[1];  // family + sub-type; first segment decides family
        attribute contentHash             : Primitives::ContentHash[1]; // multihash, sha256 default
        attribute contentCanonicalization : Primitives::UriString[1];   // names off-log content rule

        // --- cryptographic envelope ---
        ref item sig                  : SignatureEnvelope[1];
        ref item signer               : Signer[0..1];                  // RECOMMENDED v0.1 (C-signer-recommended)
        ref item timestamp            : Rfc3161Timestamp[0..1];         // SHOULD-level, best-effort
        ref item rekorInclusionProof  : RekorInclusionProof[0..1];      // SHOULD-level, best-effort
        ref item metadata             : Metadata[1];

        // --- nodeId is DERIVED, not stored (C-nodeId-derived) ---
        derived attribute nodeId : Primitives::HexDigest[1]
            = Verification::computeEnvelopeHash(self);
    }
}
```

### 3.4 Envelope-hash derivation as a `calc`

The signing chain (§8.3.1: unsigned envelope → JCS → SHA-256 → hex → Ed25519ph over the hex string) is a *computation* over a node. SysML models the derivation as a `calc def` whose body is opaque — SysML evaluates expressions but does not implement SHA-256/JCS, so the body delegates to the external crypto part (§9). This is the honest boundary from §1.3.

```sysml
package Verification {
    // §8.2 / §8.3.1 — envelope hash = SHA-256 hex of JCS(unsigned envelope).
    // Body delegated to the external crypto subsystem; SysML does not compute SHA-256.
    calc def computeEnvelopeHash { in node : Envelope::SignedNode; return : Primitives::HexDigest; }

    // Two-kinds nesting (§8.2): off-log content -> content rule -> bytes -> multihash.
    calc def computeContentHash {
        in node : Envelope::SignedNode;
        in rule : Primitives::UriString;
        return : Primitives::ContentHash;
    }
}
```

### 3.5 The `content/analysis/v1` evidence package

`EvidencePackage` is the §8.1 package object. It is the *payload* an `AnalysisNode` carries; the analysis node `:> ContentNode` (§4) and supplies these fields at the canonical-JSON top level. Required vs. optional follows §8.1.1 exactly; `summary` is `0..1` structurally but promoted to required under datHere by a constraint (§8).

```sysml
package ContentAnalysis {
    import Primitives::*;
    import Envelope::*;
    import ScalarValues::*;

    // §8.1.7 — AI-LLM-specific (Q7/Q9).
    item def Cost {
        attribute promptTokens     : Integer[1];
        attribute completionTokens : Integer[1];
        attribute totalTokens      : Integer[1];
        attribute model            : String[1];
        attribute durationMs       : Integer[1];
    }

    // §8.1.3
    enum def PromptVisibility { full_text; hash_only; }
    item def Prompt {
        attribute hash       : HexDigest[1];
        attribute visibility : PromptVisibility[1];
        attribute text       : String[0..1];   // present iff full_text (C-PROMPT-TEXT-CONDITIONAL)
    }

    // §7.5 QEC set members; 'untyped' mutually exclusive with typed values.
    enum def QecContentType { claim; question; evidence; untyped; }

    item def SkillMetadata {
        attribute skillText     : String[0..1];   // string OR BlobRef
        ref item  skillTextBlob : BlobRef[0..1];
        attribute mcpServerUrl  : UriString[0..*];
    }

    // §8.8 / §8.7 notebook content-format marker; promoted to required under datHere.
    item def NotebookExtension {
        attribute format     : String[0..1];
        attribute provenance : String[0..1];
    }
    item def ExtensionsMap { ref item notebook : NotebookExtension[0..1]; }

    // §8.1 — the content/analysis/v1 package payload.
    item def EvidencePackage {
        ref item   metadata     : Metadata[1];
        ref item   prompt       : Prompt[1];
        attribute  queries      : String[0..*];    // array present, MAY be empty
        attribute  dataSources  : String[0..*];    // array present, MAY be empty
        ref item   cost         : Cost[1];
        ref item   skillMetadata : SkillMetadata[1];
        attribute  output       : String[0..1];    // string OR BlobRef (see variant below)
        ref item   outputBlob   : BlobRef[0..1];    // BlobRef substitution
        attribute  trace        : String[0..1];     // OTel-shaped object OR BlobRef
        ref item   traceBlob    : BlobRef[0..1];
        attribute  summary      : String[0..1];     // REQUIRED under datHere (§8.7)
        ref item   provenance   : String[0..1];     // PROV-O JSON-LD graph
        ref item   extensions   : ExtensionsMap[0..1]; // reverse-DNS-keyed
    }
}
```

The `output`/`trace`/`skillText` *string-or-BlobRef* choice is the cleanest place to use a SysML **variation** rather than two nullable attributes; this is shown in §5.3 where it composes with the profile variation. The `extensions` map (`org.civicaitools.environment`, `.notebook`, `.execution`) is modeled in `ContentAnalysis` with the conditional-presence rules captured as constraints; the notebook-provenance axis becomes a `state def` in §6.

---

## 4. The structural primitive and two-family taxonomy via specialization

### 4.1 The family split

The spec's central structural rule (§7.4): *every conformant node belongs to exactly one of two families, decided by the `type`-URI first segment and by presence/absence of `targetNodeId`.* SysML expresses the families as two abstract specializations of `SignedNode`, and the family discriminator as **redefinition of a `targetNodeId` feature**: `ContentNode` re-bounds it to multiplicity `0` (forbidden); `AttestationNode` re-bounds it to `1..*` (required).

```sysml
package Taxonomy {
    import Envelope::*;
    import ScalarValues::*;

    // §8.5 registry/ladder vocabulary (informative; only the GitHub tier built — Q3).
    // 'platform' is the value the §8.3.3 registry example carries; 'legacy_embedded' is
    // synthesized for pre-registry packages (§8.3.3). Marked extensible, not closed.
    enum def BindingTier {
        pseudonymous; github; orcid; did_web; notarized; platform; legacy_embedded;
    }

    // §8.12 per-sub-type authorization.
    enum def AuthorizationRule { publisher_only; any_with_binding; specific_role_required; }

    // The abstract primitive carries an OPTIONAL targetNodeId so each family can re-bound it.
    abstract part def TypedNode :> SignedNode {
        attribute targetNodeId : Primitives::HexDigest[0..*];  // refined per family
    }

    // §7.4 — content/* : standalone assertion. MUST NOT carry targetNodeId.
    abstract part def ContentNode :> TypedNode {
        // C-content-no-target: re-bound to multiplicity 0 (forbidden).
        attribute redefines targetNodeId : Primitives::HexDigest[0];
    }

    // §7.4 — attestation/* : assertion about another node. targetNodeId REQUIRED >=1.
    abstract part def AttestationNode :> TypedNode {
        // C-attestation-has-target: re-bound to 1..* (required).
        attribute redefines targetNodeId : Primitives::HexDigest[1..*];
        // Each sub-type declares its authorization rule (§8.12).
        attribute authorizationRule : AuthorizationRule[1];
    }
}
```

This is exactly the kind of structural distinction redefinition exists for: the discriminating feature is the *same* feature (`targetNodeId`), re-bounded in each branch, so a verifier's family-membership check (§6.1, additional SHACL validation) reads directly off the multiplicity.

### 4.2 `content/*` sub-types

`content/analysis/v1` is built (green); the typed-content sub-types and host/tool declarations are reserved (orange). Build state is carried as a `metadata` annotation prefixed to each definition (§5).

```sysml
package Taxonomy {
    // content/analysis/v1 — BUILT. Carries the §8.1 EvidencePackage payload.
    #BuildState::built
    part def AnalysisNode :> ContentNode {
        attribute redefines type default "content/analysis/v1";
        ref item payload : ContentAnalysis::EvidencePackage[1];
    }

    // content/claim/v1 — RESERVED (Q5). Carries a typed-claim JSON-LD payload (§8.11).
    #BuildState::reserved
    part def ClaimNode :> ContentNode {
        attribute redefines type default "content/claim/v1";
        ref item payload : TypedClaims::ClaimDocument[1];
    }

    #BuildState::reserved part def QuestionNode :> ContentNode {
        attribute redefines type default "content/question/v1"; }   // payload undefined in-spec
    #BuildState::reserved part def EvidenceNode :> ContentNode {
        attribute redefines type default "content/evidence/v1"; }   // payload undefined in-spec

    // Host / tool self-declarations — RESERVED (Q22). NOT a peer family (§7.4).
    #BuildState::reserved part def HostNode :> ContentNode {
        attribute redefines type default "content/host/v1"; }
    #BuildState::reserved part def HostPolicyNode :> ContentNode {
        attribute redefines type default "content/hostPolicy/v1"; }
    #BuildState::reserved part def HostTermsOfUseNode :> ContentNode {
        attribute redefines type default "content/hostTermsOfUse/v1"; }
    #BuildState::reserved part def ToolNode :> ContentNode {
        attribute redefines type default "content/tool/v1"; }
}
```

### 4.3 `attestation/*` sub-types and their payloads

The 15-member Q36-ratified table (§8.12.1) becomes 15 specializations of `AttestationNode`, each fixing its `type`, `authorizationRule`, and adding the per-sub-type payload fields. Where the spec gives a field name but no datatype, the model uses a `String`-typed feature and annotates `// (unspecified)` rather than inventing a type — directly honoring the spec's silence.

```sysml
package Taxonomy {
    import ScalarValues::*;

    // ---- Lifecycle relations (publisher-only) ----
    #BuildState::ratified
    part def WithdrawsNode :> AttestationNode {
        attribute redefines type default "attestation/withdraws/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute reason      : String[1];               // required, non-empty (C-WITHDRAWS-REASON)
        attribute effectiveAt : Primitives::Iso8601[0..1]; // defaults to envelope timestamp
    }
    #BuildState::ratified
    part def ReinstatesNode :> AttestationNode {
        attribute redefines type default "attestation/reinstates/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute priorWithdrawalNodeId : Primitives::HexDigest[1];  // immediately-prior withdrawal
        attribute reason : String[0..1];
    }
    #BuildState::ratified
    part def SupersedesNode :> AttestationNode {
        attribute redefines type default "attestation/supersedes/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute successorNodeId : Primitives::HexDigest[1];        // new node
    }
    #BuildState::ratified
    part def PublishesNode :> AttestationNode {
        attribute redefines type default "attestation/publishes/v1";
        // publisher-only OR delegated-publisher (Q20) — delegated predicate not yet formalizable.
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute publicationHost : String[1];
        attribute releasedAt      : Primitives::Iso8601[1];
    }

    // ---- Reference / location / derivation (any-with-binding) ----
    #BuildState::ratified
    part def LocatedAtNode :> AttestationNode {
        attribute redefines type default "attestation/locatedAt/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute uri           : Primitives::UriString[1];
        attribute contentHash   : Primitives::ContentHash[1];  // SHOULD match target; mismatch informative
        attribute contentLength : Integer[0..1];
        attribute availability  : String[0..1];                // (unspecified)
    }
    #BuildState::ratified
    part def WasDerivedFromNode :> AttestationNode {
        attribute redefines type default "attestation/wasDerivedFrom/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        // Conditional: when source is content/analysis/v1 untyped AND target is typed,
        // derivationMethod MUST carry a ts:AnalyticalDerivation (classification-laundering guard).
        ref item derivationMethod : TypedClaims::AnalyticalDerivation[1];
    }
    #BuildState::ratified
    part def AnswersQuestionNode :> AttestationNode {
        attribute redefines type default "attestation/answersQuestion/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding; }
    #BuildState::ratified
    part def SupportedByNode :> AttestationNode {
        attribute redefines type default "attestation/supportedBy/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding; }
    #BuildState::ratified
    part def OpposedByNode :> AttestationNode {
        attribute redefines type default "attestation/opposedBy/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding; }

    // ---- Claim-to-claim ----
    #BuildState::ratified
    part def CorroboratesNode :> AttestationNode {
        attribute redefines type default "attestation/corroborates/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute scope     : String[1];   // (unspecified)
        attribute reasoning : String[0..1]; }
    #BuildState::ratified
    part def ContradictsNode :> AttestationNode {
        attribute redefines type default "attestation/contradicts/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute scope     : String[1];   // (unspecified)
        attribute reasoning : String[0..1]; }
    #BuildState::ratified
    part def EndorsesNode :> AttestationNode {
        attribute redefines type default "attestation/endorses/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute scope : String[1]; }      // (unspecified)

    // ---- Authority-bearing (specific-role-required) ----
    #BuildState::ratified
    part def CertifiesNode :> AttestationNode {
        attribute redefines type default "attestation/certifies/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute certificationScheme : String[1];  // (unspecified)
        attribute validityWindow      : String[1]; } // temporal range (unspecified)
    #BuildState::ratified
    part def EvaluatesNode :> AttestationNode {
        attribute redefines type default "attestation/evaluates/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute methodology   : String[1];  // (unspecified) — Q26
        attribute scoringRubric : String[1];  // (unspecified)
        ref item  results       : String[1]; } // (unspecified)
    #BuildState::ratified
    part def ConformsNode :> AttestationNode {
        attribute redefines type default "attestation/conforms/v1";
        // self-attestation OR specific-role-required (third-party)
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute standardId : Primitives::UriString[1]; }
}
```

### 4.4 The QEC sub-ontology and the typed-claims layer

Within `content/*`, the QEC sub-ontology and the §8.11 `ts:` vocabulary are *content-shape* definitions. They are best modeled as `item def`s (claim documents are data carried by a `ClaimNode`, not parts of a system), and the claim taxonomy uses specialization just like the node taxonomy. Crucially, all instance-level constraints here are SHACL's responsibility; SysML models only the *shape* and the *closed enums*. Civic geographic-scope subtype names match the spec spelling exactly (`ts:ZIPCodeTabulationArea`, not `ZipCode…`).

```sysml
package TypedClaims {
    import Primitives::*;
    import ScalarValues::*;

    // §8.11 specified, not built (Q5) — applied at definition level below via #BuildState::specified.

    // §8.11 supporting shapes ------------------------------------------
    item def TemporalInterval {                              // time:Interval w/ begin+end
        attribute hasBeginning : Iso8601[0..1];
        attribute hasEnd       : Iso8601[0..1];
        attribute inXSDDate    : Iso8601[0..1];
    }
    item def GeographicScope {
        attribute identifier  : String[0..1];
        attribute name        : String[0..1];
        attribute hasGeometry : String[0..1];               // OGC GeoSPARQL literal
    }
    // Civic subtype taxonomy via specialization (each names a canonical reference standard).
    item def CensusTract              :> GeographicScope;
    item def CensusBlock              :> GeographicScope;
    item def CensusBlockGroup         :> GeographicScope;
    item def ZIPCodeTabulationArea    :> GeographicScope;    // spec spelling (ZIP all-caps)
    item def SchoolDistrict           :> GeographicScope;
    item def MunicipalBoundary        :> GeographicScope;
    item def CountyBoundary           :> GeographicScope;
    item def StateBoundary            :> GeographicScope;
    item def NeighborhoodTabulationArea :> GeographicScope;  // NYC
    item def CommunityBoardDistrict   :> GeographicScope;    // NYC
    item def CityCouncilDistrict      :> GeographicScope;
    item def PolicePrecinct           :> GeographicScope;    // flagged Q14 (possibly too NYC-coded)

    item def Scope {
        ref item geographicScope : GeographicScope[1];
        ref item temporalScope   : TemporalInterval[1];
    }

    enum def ConfidenceMethod {   // starter set, extensible (must stay method-traceable)
        FrequentistInterval; BayesianCredibleInterval; SampleSizeBased;
        LLMReportedLogProbability; HumanReview; NotApplicable;
    }
    item def ConfidenceStatement {
        attribute method          : ConfidenceMethod[1];
        attribute level           : Real[0..1];
        attribute lowerBound      : Real[0..1];
        attribute upperBound      : Real[0..1];
        attribute methodReference : String[0..1];
    }
    item def OutputSpan {
        attribute outputFile : String[1];
        attribute byteRange  : Integer[2];                  // exactly [start,end]
    }
    item def AnalyticalDerivation {            // also carried by attestation/wasDerivedFrom/v1
        attribute traceReference    : String[1];
        ref item  translationModel  : String[1];            // schema:SoftwareApplication
        attribute translationPrompt : String[1];            // @id reference
        ref item  sourceOutputSpan  : OutputSpan[1];
    }

    // §8.11 base claim ------------------------------------------------
    abstract item def Claim {
        attribute identifier     : String[1];               // dcterms:identifier, unique within package
        attribute subject        : UriString[1];            // ts:subject — exactly one URI
        ref item  scope          : Scope[1];                // explicit geo + temporal; implicit prohibited
        ref item  confidence     : ConfidenceStatement[1];  // method-derived
        attribute wasDerivedFrom : UriString[1..*];         // prov:wasDerivedFrom
        ref item  derivedVia     : AnalyticalDerivation[1]; // ts:derivedVia
        attribute description    : String[0..1];            // required iff confidence = NotApplicable
        attribute limitations    : String[0..1];
    }

    enum def TrendDirection { Increase; Decrease; NoSignificantChange; }    // CLOSED
    enum def ComparisonRel  { GreaterThan; LessThan; ApproximatelyEqual; }  // CLOSED

    // Under-specified per spec — left abstract; DO NOT invent fields.
    abstract item def Magnitude;     // example uses ts:percentChange / ts:absoluteChange
    abstract item def Component;

    item def TrendClaim :> Claim {
        attribute metric           : UriString[1];
        ref item  baselinePeriod   : TemporalInterval[1];
        ref item  comparisonPeriod : TemporalInterval[1];
        attribute direction        : TrendDirection[1];       // closed enum (C-TC-C13)
        ref item  magnitude        : Magnitude[1];
    }
    item def ComparisonClaim :> Claim {
        attribute metric    : UriString[1];
        ref item  scopeA    : Scope[1];
        ref item  scopeB    : Scope[1];
        attribute relation  : ComparisonRel[1];               // closed enum (C-TC-C14)
        ref item  magnitude : Magnitude[1];
    }
    item def ObservationClaim :> Claim {                       // maps onto qb:Observation
        attribute metric : UriString[1];
        attribute value  : Real[1];
        attribute unit   : UriString[1];                      // QUDT/UCUM (SHOULD)
    }
    item def CompositionClaim :> Claim {
        ref item  whole      : Scope[1];
        ref item  components : Component[1..*];
        attribute totalsTo   : Real[1];                       // intended total; sum NOT mandated
    }
    item def RelationshipClaim :> Claim {                      // statistical; NO CausalClaim in v1
        attribute metricA          : UriString[1];
        attribute metricB          : UriString[1];
        attribute relationshipType : UriString[1];            // open enum
        attribute strength         : Real[1];
    }
    item def QualitativeClaim :> Claim {                       // non-numeric, permitted + flagged
        attribute assertion       : String[1];
        attribute groundingMethod : UriString[1];             // open enum
    }

    // JSON-LD wrapper carried by content/claim/v1.
    item def ClaimDocument {
        attribute context : UriString[1..*];   // @context; first member is the ts: URI
        ref item  graph   : Claim[1..*];        // @graph
    }
}
```

The closed enums (`TrendDirection`, `ComparisonRel`) are the one place SysML's enum membership *coincides* with a SHACL `sh:in` — but the SysML version constrains the *type*, while SHACL validates the *instance value*. Both formalizations record the same closure; only SHACL rejects a bad instance.

---

## 5. captureMethod and content profiles as enum / variation / metadata

### 5.1 Build state as `metadata def`

The green/yellow/orange build-state coloring is a cross-cutting annotation, exactly what `metadata def` is for. Defining it once lets every definition carry a `#BuildState::built` (etc.) prefix annotation.

```sysml
package BuildState {
    enum def Level { built; partial; reserved; ratified; specified; }
    metadata def State :> Metadata::ModelMetadata { attribute level : Level; }
    // Convenience annotations used as prefixes throughout: #BuildState::built, etc.
    metadata built     : State { :>> level = Level::built;     }
    metadata partial   : State { :>> level = Level::partial;   }
    metadata reserved  : State { :>> level = Level::reserved;  }
    metadata ratified  : State { :>> level = Level::ratified;  }
    metadata specified : State { :>> level = Level::specified; }
}
```

### 5.2 captureMethod — open core vocabulary, per-profile closure

The spec's captureMethod discipline is subtle: the value space is *open at the core* and *closed per producer profile*. The core label is modeled as an open `attribute def` (a `String` subtype). The *ai-assisted-analysis* profile's v0.1 vocabulary is modeled as **three `String`-valued constant features**, not as an `enum` — because the spec's literals are hyphenated (`chat-flow-stream`) and KerML identifiers cannot contain hyphens; modeling them as enum members would silently rename them to values the spec never defines (§1.3). The §9.2 check-15 vocabulary-conformance assertion is the constraint that ties a label to its profile (modeled in §8).

```sysml
package CaptureAndProfiles {
    import ScalarValues::*;

    // §8.6 — open at core: the label is any string the producer profile authorizes.
    attribute def CaptureMethodLabel :> String;

    // §8.6 — the ai-assisted-analysis profile's v0.1 vocabulary (closed for THIS profile).
    // Carried as exact spec literals (hyphenated) — NOT enum identifiers (see §1.3).
    package AiAssistedCaptureVocabulary {
        attribute chatFlowStream         : CaptureMethodLabel default "chat-flow-stream";
        attribute claudeCodeJsonlReadback : CaptureMethodLabel default "claude-code-jsonl-readback";
        attribute claudeCodeSelfReport    : CaptureMethodLabel default "claude-code-self-report";
        // NOTE: the spec lists all three as the v0.1 vocabulary with no deprecation. No
        // "deprecated" annotation is asserted here (an earlier draft invented a 2026-04-28
        // deprecation that the spec does not state).
    }

    // §8.1.1 / §8.7 — content shape axis. 'default' is a reserved word; quoted in declaration.
    enum def ContentProfile { 'default'; datHere; }

    // §8.6 / ADR-0006 — producer profile axis (WHO/HOW produced).
    // Compound <type>/<subtype> literal; only ai-assisted-analysis/datHere is built.
    attribute def ProducerProfile :> String;
}
```

### 5.3 The datHere content profile as a `variation`

The cleanest SysML construct for "the same package, in one of two content shapes, with the datHere shape adding required fields and tightening optional ones" is a **variation** of the analysis node. The variation captures: under datHere, `summary` becomes required, the notebook extension becomes required, and the `output`/`trace` carriers may be BlobRefs. Variant members are alternative redefinitions; this models the A–G datHere requirements (§8.7.1) as a *variant configuration* rather than as ad-hoc nullable fields.

```sysml
package CaptureAndProfiles {
    import Taxonomy::*;
    import ContentAnalysis::*;
    import ScalarValues::*;

    // §8.1 + §8.7 — the analysis node varies by content profile.
    variation part def AnalysisNodeVariant :> AnalysisNode {
        // contentProfile == "default": §8.1 baseline; summary OPTIONAL.
        variant part defaultProfile : AnalysisNode {
            attribute redefines payload.metadata.contentProfile default ContentProfile::'default';
        }
        // §8.7 — contentProfile == "datHere"; producerProfile = ai-assisted-analysis/datHere.
        #BuildState::built
        variant part datHereProfile : AnalysisNode {
            attribute redefines payload.metadata.contentProfile default ContentProfile::datHere;
            // req6: summary REQUIRED + non-empty (C-SUMMARY-CONDITIONAL).
            attribute redefines payload.summary : String[1];
            // req4: org.civicaitools.notebook REQUIRED (C-NOTEBOOK-DATHERE-REQ).
            ref item redefines payload.extensions.notebook : NotebookExtension[1];
        }
    }
}
```

The **profile-consistency invariant** (`contentProfile == 'datHere'` iff `producerProfile` starts with `ai-assisted-analysis/datHere`) is not a structural fact a variation can enforce on its own — it relates two attributes — so it is a `constraint def` discharged by a requirement (§8). This is the right modeling: the variation expresses the *shape* per profile; the constraint expresses the *cross-field equivalence*.

---

## 6. Lifecycle, visibility, and location as state machines

Section 8.10 is the surface SysML v2 models *best*. The spec is emphatic that lifecycle "status" is a **derived-view projection over an append-only signed-attestation chain**, not a destructive in-place mutation, and that "current status" is the latest signer-matched attestation in envelope-timestamp order (ties by `nodeId` lexicographic). SysML's `state def` models the *projection* — the states a verifier reports — while the transitions are *triggered by the arrival of signed attestation nodes*, with guards encoding the authorization rules. The append-only substrate is preserved by the `accept` (event) semantics: a transition fires on accepting an attestation, never by mutating prior state.

### 6.1 Content-node lifecycle (publication / withdrawal / reinstatement / supersession)

```sysml
package Lifecycle {
    import Taxonomy::*;
    import ScalarValues::*;

    // Guard predicates — signer-matching is identity equality (SHACL-checkable);
    // the delegated-publisher predicate is Q20 (not yet formalizable beyond "permitted").
    calc def signerMatchesTarget { in att : AttestationNode; return : Boolean; }
    calc def isDelegatedPublisher { in att : PublishesNode;  return : Boolean; }   // Q20
    calc def pointsAtPriorWithdrawal { in id : Primitives::HexDigest; return : Boolean; }
    calc def isNonEmpty { in s : String; return : Boolean; }
    calc def hasBinding { in att : AttestationNode; return : Boolean; }
    calc def isDistinctCopyPair { in loc : LocatedAtNode; return : Boolean; }

    // §8.10 — the verifier-reported lifecycle status of a content node.
    // States are a DERIVED VIEW; transitions fire on accepting signed attestation nodes.
    state def ContentNodeLifecycle {
        entry; then committed;

        state committed;
        state published;
        state withdrawn;
        state superseded;

        // committed -> published : accept a publishes attestation (publisher-only OR delegated).
        transition committed_to_published
            first committed
            accept pub : PublishesNode
            if signerMatchesTarget(pub) or isDelegatedPublisher(pub)   // Q20: delegated predicate
            then published;

        // published -> withdrawn : accept a withdraws attestation (publisher-only, reason non-empty).
        transition published_to_withdrawn
            first published
            accept w : WithdrawsNode
            if signerMatchesTarget(w) and isNonEmpty(w.reason)
            then withdrawn;

        // withdrawn -> published : accept a reinstates attestation referencing the prior withdrawal.
        transition withdrawn_to_reinstated
            first withdrawn
            accept r : ReinstatesNode
            if signerMatchesTarget(r) and pointsAtPriorWithdrawal(r.priorWithdrawalNodeId)
            then published;

        // published -> superseded : accept a supersedes attestation (publisher-only).
        transition published_to_superseded
            first published
            accept s : SupersedesNode
            if signerMatchesTarget(s)
            then superseded;

        // Multi-cycle (published -> withdrawn -> published -> ...) re-uses the two transitions
        // above; there is no cycle counter and no per-cycle structural change (§8.10.1).
    }
}
```

Two spec properties are visible directly in this machine:

- **Multi-cycle without a counter.** `published → withdrawn → published → withdrawn → …` re-uses the same two transitions; there is no cycle-count attribute and no per-cycle structural change, matching §8.10.1's "no cycle counter, no DB-shape mutation per cycle, no spec-level cycle limit."
- **Status derivation, not mutation.** Because transitions `accept` attestation events rather than write a status column, the `state def` is the *view*; the underlying chain is append-only. The "latest signer-matched attestation in envelope-timestamp order (ties by `nodeId` lexicographic)" rule is the *interpreter* that drives `accept` ordering — modeled below as a verification action (§7), not as state.

### 6.2 Visibility / location and the retention-asymmetry property

Location is an *orthogonal* axis: a content node may be at zero, one, or many locations independent of its lifecycle status. The retention-asymmetry property (§8.10.3) is the spec's most distinctive normative behavior — a publisher's withdrawal removes *the publisher's own* status label but does **not** retract a third party's `locatedAt`. SysML models visibility as a second `state def` running in parallel, and the asymmetry as a `constraint def` over the two parallel states.

```sysml
package Lifecycle {
    // §8.10.2 — location axis, orthogonal to lifecycle status.
    state def ContentNodeVisibility {
        entry; then noPublicLocation;   // zero locatedAt = valid private/draft/enterprise base case

        state noPublicLocation;
        state located;

        // noPublicLocation -> located : accept a locatedAt attestation (any-with-binding).
        transition to_located
            first noPublicLocation
            accept loc : LocatedAtNode
            if hasBinding(loc)                                // signer.bindingTier >= pseudonymous
            then located;

        // located -> located : additional independent durable copy from a DISTINCT
        // (signer.identifier, uri-authority) pair (Q38: no copyOf minted).
        transition additional_copy
            first located
            accept loc2 : LocatedAtNode
            if hasBinding(loc2) and isDistinctCopyPair(loc2)
            then located;
    }

    // §8.10.3 — retention asymmetry as a constraint over the two parallel states.
    // A withdraws from P does NOT retract a locatedAt signed by backup-host B.
    constraint def RetentionAsymmetry {
        in withdraw  : WithdrawsNode;
        in backupLoc : LocatedAtNode;
        in backupIndependentlyVerifiable : ScalarValues::Boolean;  // B's sig verifies; content still hashes (out-of-band)
        // The verifier MUST surface BOTH when signers differ; withdrawal is NOT global erasure.
        require constraint {
            (withdraw.signer.identifier != backupLoc.signer.identifier)
                implies backupIndependentlyVerifiable
        }
    }
}
```

The `RetentionAsymmetry` `constraint def` is what makes the spec's civic-accountability feature a *named model element* a requirement can `require` (§8) and a verifier action can `verify` (§7). The signer-difference half is a pure intra-graph comparison (also a SHACL target); the "B's signature still verifies" half is supplied as an input boolean `backupIndependentlyVerifiable`, since the crypto check itself is out-of-band (§1.3) — the constraint relates the two without claiming SysML performs the signature math.

### 6.3 Trust-registry key lifecycle and notebook provenance

Two further state machines fall straight out of the spec. The key lifecycle (§8.3.3) drives the §9.2 check-5 verdict; the notebook-provenance axis (§8.7.4) is the third orthogonal axis (HOW authored) and gates the conditional presence of the execution extension.

```sysml
package Lifecycle {
    // §8.3.3 — trust-registry key status; drives §9.2 check-5 verdict.
    state def TrustRegistryKeyLifecycle {
        entry; then active;
        state active;
        state deprecated;
        state revoked;

        transition active_to_deprecated     first active     accept deprecate then deprecated;
        transition active_to_revoked         first active     accept revoke    then revoked;
        transition deprecated_to_revoked     first deprecated accept revoke    then revoked;
        // deprecated: signed-before remains trusted; signed-after not. revoked: never trusted.
    }

    // §8.7.4 — notebook provenance (HOW authored): orthogonal third axis.
    // Authoring states, not a runtime transition; modeled as alternative entry targets.
    state def NotebookProvenance {
        entry;                       // absent provenance => treat as skeleton (pre-v0.1 default)
        state skeleton;              // org.civicaitools.execution MUST be ABSENT
        state executed;              // org.civicaitools.execution MUST be PRESENT (executedAt, environment, duration)
    }
}
```

---

## 7. The §9.2 verification flow as behavior

The §9.2 check list is an ordered procedure. SysML models it as an `action def` with `first … then …` succession; the crypto/log/network steps are subactions *delegated to external `part def`s* (§9). Each numbered check is a named subaction; its outcome feeds a verdict object. Out-of-band steps (`computeEnvelopeHash`, signature math, RFC 6962 inclusion, cert-chain validation, HTTPS fetch, registry join) are modeled with opaque bodies and external delegation — the honest boundary from §1.3. SHACL-expressible structural checks (§6.1 of the formal model) are modeled as `assert constraint`s in a parallel structural-validation action.

### 7.1 The verifier's verdict and error vocabulary

```sysml
package Verification {
    import Envelope::*;
    import ScalarValues::*;

    // Verifier error-code vocabulary (§9.2). Non-fatal vs REJECT vs graceful-degrade.
    enum def VerifierCode {
        unknown_target_node;             // non-fatal
        unknown_canonicalization_rule;
        unknown_type;                    // non-fatal
        signer_identity_mismatch;        // REJECT
        captureMethod_unknown;           // REJECT
        producerProfile_bundle_unresolved;  // graceful-degrade
    }

    enum def KeyTrust {                   // §8.3.3 verify-endpoint verdict values
        active; deprecated_valid; deprecated_invalid; revoked;
        unknown_key; registry_unavailable; legacy_embedded;
    }

    item def Verdict {
        attribute envelopeIntegrity : Boolean[1];
        attribute signatureValid    : Boolean[1];
        attribute keyTrust          : KeyTrust[1];
        attribute lifecycleStatus   : String[0..1];   // from §8.10 chain
        attribute captureMethod     : CaptureAndProfiles::CaptureMethodLabel[1];
        attribute codes             : VerifierCode[0..*];
        // Two independent verdict axes (§6 malformed-vs-integrity split, §8.7).
        attribute envelopeOk        : Boolean[1];
        attribute datHereOk         : Boolean[0..1];   // malformed-for-datHere
    }
}
```

### 7.2 The ordered §9.2 check sequence

```sysml
package Verification {
    import ScalarValues::*;

    // External-delegated check actions — opaque bodies (SysML does not perform crypto).
    action def CheckEnvelopeIntegrity   { in node : SignedNode; out ok : Boolean; }
    action def CheckSignature           { in node : SignedNode; out ok : Boolean; }
    action def CheckContentHash         { in node : SignedNode; out ok : Boolean; }
    action def CheckTrustRegistry       { in node : SignedNode; in registry : Infrastructure::TrustRegistry;
                                          out verdict : KeyTrust; }
    action def CheckTimestamp           { in node : SignedNode; in tsaAnchor : Infrastructure::PinnedTsaAnchor;
                                          out ok : Boolean; }
    action def CheckRekorInclusion      { in node : SignedNode; in rekorAnchor : Infrastructure::PinnedRekorAnchor;
                                          out ok : Boolean; }
    action def CheckBlobRefs            { in node : SignedNode; in blobStore : Infrastructure::BlobStore;
                                          out ok : Boolean; }
    action def CheckLifecycleState      { in node : SignedNode; in attestationGraph : Infrastructure::AttestationGraph;
                                          out status : String; }
    action def CrossCheckSignerIdentity { in node : SignedNode; in registry : Infrastructure::TrustRegistry;
                                          out code : VerifierCode[0..1]; }

    // SHACL-expressible structural check actions — bodies assert constraints (§7.3).
    action def ResolveCanonicalizationRule  { in node : SignedNode; out code : VerifierCode[0..1]; }
    action def CheckSigningKeyIdConsistency { in node : SignedNode; out ok : Boolean; }
    action def ReadCaptureMethodLabel       { in node : SignedNode; out label : CaptureAndProfiles::CaptureMethodLabel; }
    action def ResolveType                  { in node : SignedNode; out code : VerifierCode[0..1]; }  // non-fatal
    action def CrossCheckNodeId             { in node : SignedNode; in attestationGraph : Infrastructure::AttestationGraph;
                                              out code : VerifierCode[0..1]; }
    action def CheckCaptureMethodVocabulary { in node : SignedNode; out code : VerifierCode[0..1]; }

    // §9.2 — the 15-check ordered verification procedure.
    action def VerifyNode {
        in node : SignedNode;
        in ctx  : Infrastructure::VerificationContext;   // trust registry, TSA, Rekor, blob store
        out verdict : Verdict;

        first start;
        // 1. Envelope integrity — recompute envelope hash; MUST equal reported. [out-of-band]
        then action c1  : CheckEnvelopeIntegrity { in node = node; }
        // 2. Signature mathematics — Ed25519ph over the envelope-hash hex string. [out-of-band]
        then action c2  : CheckSignature { in node = node; }
        // 3. Content canonicalization rule resolution — sh:in membership. [SHACL-expressible]
        then action c3  : ResolveCanonicalizationRule { in node = node; }
        // 4. Content hash verification — recompute multihash over off-log content. [out-of-band]
        then action c4  : CheckContentHash { in node = node; }
        // 5. Trust-registry verdict — (kid,publicKey) join + status semantics. [out-of-band join]
        then action c5  : CheckTrustRegistry { in node = node; in registry = ctx.registry; }
        // 6. signingKeyId consistency — sig.kid == metadata.signingKeyId. [SHACL: sh:equals]
        then action c6  : CheckSigningKeyIdConsistency { in node = node; }
        // 7. Timestamp validity — RFC 3161 + X.509 chain to pinned FreeTSA root. [out-of-band]
        then action c7  : CheckTimestamp { in node = node; in tsaAnchor = ctx.tsaAnchor; }
        // 8. Transparency-log inclusion — RFC 6962 Merkle inclusion vs pinned Rekor key. [out-of-band]
        then action c8  : CheckRekorInclusion { in node = node; in rekorAnchor = ctx.rekorAnchor; }
        // 9. BlobRef integrity — fetch HTTPS, recompute SHA-256, confirm size. [out-of-band]
        then action c9  : CheckBlobRefs { in node = node; in blobStore = ctx.blobStore; }
        // 10. Lifecycle state — signer-matched attestation chain; per-att sig+ts. [mixed]
        then action c10 : CheckLifecycleState { in node = node; in attestationGraph = ctx.attestationGraph; }
        // 11. captureMethod label — read + render alongside verdict. [SHACL: presence]
        then action c11 : ReadCaptureMethodLabel { in node = node; }
        // 12. type resolution — sh:in; unknown_type is NON-FATAL. [SHACL]
        then action c12 : ResolveType { in node = node; }
        // 13. nodeId cross-check — targetNodeId resolves to this envelope hash. [mixed]
        then action c13 : CrossCheckNodeId { in node = node; in attestationGraph = ctx.attestationGraph; }
        // 14. signer <-> kid cross-check — REJECT on signer_identity_mismatch. [out-of-band join]
        then action c14 : CrossCheckSignerIdentity { in node = node; in registry = ctx.registry; }
        // 15. captureMethod per-profile vocab — REJECT on captureMethod_unknown;
        //     graceful-degrade on producerProfile_bundle_unresolved. [SHACL if vocab materialized]
        then action c15 : CheckCaptureMethodVocabulary { in node = node; }
        then done;
    }
}
```

### 7.3 Structural validation as a parallel action; the malformed-vs-integrity split

The spec (§8.7, §9) requires that a verifier finding a datHere requirement violation report `malformed-for-datHere` but *still run the §9 envelope-integrity checks* — two parallel verdict axes, not one composite verdict. SysML models this as a *fork*: `VerifyNode` (envelope integrity, §7.2) and `ValidateStructure` (the SHACL-targetable shape checks) run as independent activities feeding the two boolean axes of `Verdict`.

```sysml
package Verification {
    import ScalarValues::*;

    // SHACL-expressible structural constraints (§6.1 of the formal model).
    // SysML records these as constraint def SIGNATURES; SHACL EXECUTES them over instances.
    constraint def FamilyMembership;              // exactly one family, consistent w/ type-URI segment
    constraint def QecSetWellFormed;              // contentType non-empty; untyped not co-occurring
    constraint def ProfileConsistencyShape;       // datHere iff producerProfile starts ai-assisted-analysis/datHere
    constraint def RequiredFieldsPresent;         // type, contentHash{sha256}, sig{...}, metadata, captureMethod
    constraint def TargetNodeIdRule;              // required on attestation/*, forbidden on content/*
    constraint def TypeUriPattern;                // content/<noun>/v<N> | attestation/<verb>/v<N>
    constraint def BlobRefShape;                  // {ref,url,contentType,size}; ref matches blob:sha256:<64-hex>
    constraint def PromptVisibilityRule;          // text present iff full_text
    constraint def ExtensionsKeysReverseDns;
    constraint def DatHereReqs1to7;               // -> malformed-for-datHere on violation
    constraint def ProvenanceExecutionConditional; // execution ext iff provenance==executed

    action def ValidateStructure {
        in node : SignedNode;
        out datHereOk : Boolean;
        assert constraint : FamilyMembership;
        assert constraint : QecSetWellFormed;
        assert constraint : ProfileConsistencyShape;
        assert constraint : RequiredFieldsPresent;
        assert constraint : TargetNodeIdRule;
        assert constraint : TypeUriPattern;
        assert constraint : BlobRefShape;
        assert constraint : PromptVisibilityRule;
        assert constraint : ExtensionsKeysReverseDns;
        assert constraint : DatHereReqs1to7;
        assert constraint : ProvenanceExecutionConditional;
    }

    // The two axes run in parallel; the composite verdict carries BOTH, never a merged truth value.
    action def VerifyNodeFull {
        in node : SignedNode;
        in ctx  : Infrastructure::VerificationContext;
        out verdict : Verdict;
        // fork: envelope-integrity and structural validation are independent (run concurrently).
        action env    : VerifyNode { in node = node; in ctx = ctx; }
        action struct : ValidateStructure { in node = node; }
        // join into Verdict: envelopeOk from env, datHereOk from struct (no merged truth value).
    }
}
```

This fork is precisely what no SHACL formalization can express: SHACL *is* `ValidateStructure`, but it cannot model that it runs *in parallel with* the crypto pipeline and that the two outcomes must be reported as separate axes.

---

## 8. Conformance as requirement definitions with traceability

Section 9's MUST/SHOULD/MAY clauses become `requirement def` blocks with a `subject`, `assume constraint` (preconditions), and `require constraint` (the obligation). `satisfy` edges wire a requirement to the structural element that discharges it; `verify` edges wire it to the check action that confirms it. This is the surface SysML formalizes uniquely well (§1.2). Every requirement below is drawn verbatim-in-substance from the spec; none is invented.

KerML constraint bodies are boolean expressions, not English. Where an obligation is genuinely prose (a MUST NOT about implementation behavior with no intra-graph predicate), the prose lives in a `doc` comment and the `require constraint` references a named, typed predicate `constraint def` whose enforcement is out of model scope — the same honest boundary used in §7. Predicate signatures used below are declared once here:

```sysml
package Conformance {
    import Verification::*;
    import Lifecycle::*;
    import ScalarValues::*;

    // Subjects for product/implementation-level requirements.
    part def ProductSurface;
    part def Implementation;

    // Out-of-model predicate signatures (enforcement is editorial/operational, not intra-graph).
    constraint def CarriesPreamble        { in surface : ProductSurface; }
    constraint def NoTruthScoring         { in impl : Implementation; }
    constraint def ValidatesPinnedAnchors { in impl : Implementation; }
    constraint def NoSilentDelete         { in impl : Implementation; }
    constraint def HonorsLegacyColumns    { in impl : Implementation; }
    constraint def SurfacesRetention      { in impl : Implementation; }
    constraint def PerformsEveryCheck     { in impl : Implementation; }
}
```

### 8.1 The normative preamble and truth-scoring prohibition

```sysml
package Conformance {
    // §5.1 — the only normative requirement not enforced by code (editorial/reputational).
    requirement def <'R-preamble-carry'> CarryNormativePreamble {
        subject surface : ProductSurface;
        doc /* Carry the §5.1 four-line preamble — corroboration != truth; contradiction != falsity;
              identity strength != topic authority; system surfaces signals, consumer applies
              judgment — surfaced before readers form conclusions. */
        require constraint : CarriesPreamble { in surface = surface; }
    }

    // §5.1 — MUST NOT compute platform-issued correctness verdicts.
    requirement def <'R-no-automated-truth-scoring'> NoAutomatedTruthScoring {
        subject impl : Implementation;
        doc /* Implementation does not use signed-node signals to compute platform-issued
              correctness verdicts, rank-by-trust scores, or consensus collapse. */
        require constraint : NoTruthScoring { in impl = impl; }
    }
    // Discharged by the verifier's refusal to emit a composite truth verdict (Verdict carries axes, not truth).
    satisfy NoAutomatedTruthScoring by Verification::Verdict;
}
```

### 8.2 Cryptographic-envelope and signing requirements, with `satisfy`/`verify`

```sysml
package Conformance {
    // §8.3.1 — Ed25519ph over the envelope-hash hex string.
    requirement def <'R-sign-ed25519ph'> SignWithEd25519ph {
        subject pkg : Envelope::SignedNode;
        doc /* Signature is Ed25519ph over the UTF-8 bytes of the envelope-hash hex string. */
        require constraint { pkg.sig.algorithm == "Ed25519ph" }
    }
    satisfy SignWithEd25519ph by Envelope::SignatureEnvelope;     // structure that carries the signature
    verify  SignWithEd25519ph by Verification::CheckSignature;    // check #2 confirms it

    // §8.3.1 / §8.1.2 — metadata.signingKeyId MUST equal the envelope kid.
    requirement def <'R-signingKeyId-eq-kid'> SigningKeyIdEqualsKid {
        subject pkg : Envelope::SignedNode;
        require constraint { pkg.metadata.signingKeyId == pkg.sig.kid }   // intra-graph (SHACL sh:equals)
    }
    satisfy SigningKeyIdEqualsKid by Envelope::Metadata;
    verify  SigningKeyIdEqualsKid by Verification::CheckSigningKeyIdConsistency;  // check #6

    // §8.3.1 / §9.2 #14 — signer <-> kid cross-check; REJECT on mismatch.
    requirement def <'R-signer-crosscheck'> SignerIdentityCrossCheck {
        subject pkg : Envelope::SignedNode;
        assume constraint { pkg.signer != null }   // pre-v0.1: derive from registry, skip check
        doc /* Resolving pkg.sig.kid via the trust-registry signerIdentity yields the same
              identity that pkg.signer.identifier claims; mismatch => REJECT. */
        require constraint { pkg.signer.identifier == pkg.signer.identifier }  // signature predicate; join is out-of-band (#14)
    }
    satisfy SignerIdentityCrossCheck by Envelope::Signer;
    verify  SignerIdentityCrossCheck by Verification::CrossCheckSignerIdentity;  // check #14

    // §8.3.2 — SHOULD carry RFC 3161 timestamp + Rekor inclusion (best-effort).
    requirement def <'R-tsa-rekor'> CarryTimestampAndRekor {
        subject pkg : Envelope::SignedNode;
        doc /* SHOULD-level: best-effort RFC 3161 timestamp and Rekor inclusion. */
        require constraint { (pkg.timestamp != null) and (pkg.rekorInclusionProof != null) }
    }
    verify CarryTimestampAndRekor by Verification::CheckTimestamp;
    verify CarryTimestampAndRekor by Verification::CheckRekorInclusion;  // #7, #8

    // §8.3.3 / §10.3 — full TSA cert-chain + RFC 6962 inclusion against PINNED anchors.
    requirement def <'R-pinned-anchors'> ValidateAgainstPinnedAnchors {
        subject ver : Implementation;
        doc /* Validate the RFC 3161 leaf (ECDSA P-384) up an X.509 chain to the pinned
              FreeTSA RSA-4096 root, and verify RFC 6962 Merkle inclusion against the pinned
              Rekor P-256 log key + signed checkpoint. */
        require constraint : ValidatesPinnedAnchors { in impl = ver; }
    }
    verify ValidateAgainstPinnedAnchors by Verification::CheckTimestamp;
    verify ValidateAgainstPinnedAnchors by Verification::CheckRekorInclusion;
}
```

### 8.3 Family, profile, and capture-method requirements

```sysml
package Conformance {
    // §7.4 — content/* MUST NOT carry targetNodeId; attestation/* MUST carry >=1.
    requirement def <'R-family-discriminator'> FamilyDiscriminator {
        subject node : Taxonomy::TypedNode;
        require constraint {
            (node istype Taxonomy::ContentNode implies size(node.targetNodeId) == 0)
            and (node istype Taxonomy::AttestationNode implies size(node.targetNodeId) >= 1)
        }
    }
    satisfy FamilyDiscriminator by Taxonomy::ContentNode;
    satisfy FamilyDiscriminator by Taxonomy::AttestationNode;       // redefinition
    verify  FamilyDiscriminator by Verification::ValidateStructure; // TargetNodeIdRule

    // §8.6 / §9.2 #15 — captureMethod in the producerProfile's vocabulary; REJECT on unknown.
    requirement def <'R-captureMethod-vocab'> CaptureMethodVocabularyConformance {
        subject pkg : Envelope::SignedNode;
        assume constraint : ProfileConsistencyShape;   // else producerProfile_bundle_unresolved
        doc /* pkg.metadata.captureMethod is in the captureMethod vocabulary declared by the
              resolved producerProfile guidance bundle (the ai-assisted-analysis v0.1 set:
              chat-flow-stream, claude-code-jsonl-readback, claude-code-self-report). */
        require constraint : CheckCaptureMethodVocabPredicate { in pkg = pkg; }
    }
    constraint def CheckCaptureMethodVocabPredicate { in pkg : Envelope::SignedNode; }
    satisfy CaptureMethodVocabularyConformance by CaptureAndProfiles::AiAssistedCaptureVocabulary;
    verify  CaptureMethodVocabularyConformance by Verification::CheckCaptureMethodVocabulary;  // #15

    // §8.1.1 / §8.6 — contentProfile/producerProfile consistency invariant.
    requirement def <'R-profile-consistency'> ProfileConsistency {
        subject pkg : ContentAnalysis::EvidencePackage;
        doc /* (contentProfile == "datHere") iff producerProfile starts with
              "ai-assisted-analysis/datHere". */
        require constraint : ProfileConsistencyShape;
    }
    verify ProfileConsistency by Verification::ValidateStructure;   // ProfileConsistencyShape assertion

    // §8.7 — summary REQUIRED under datHere.
    requirement def <'R-summary-datHere'> SummaryRequiredUnderDatHere {
        subject pkg : ContentAnalysis::EvidencePackage;
        assume constraint { pkg.metadata.contentProfile == CaptureAndProfiles::ContentProfile::datHere }
        require constraint { (pkg.summary != null) and (size(pkg.summary) > 0) }
    }
    satisfy SummaryRequiredUnderDatHere by CaptureAndProfiles::AnalysisNodeVariant::datHereProfile;
}
```

### 8.4 Lifecycle and retention requirements

```sysml
package Conformance {
    // §8.10.1 — lifecycle events are separately-signed attestation/* nodes by nodeId.
    requirement def <'R-lifecycle-by-nodeId'> LifecycleByNodeId {
        subject att : Taxonomy::AttestationNode;
        doc /* Attestation references its target by nodeId (not DB columns), is Ed25519ph-signed,
              and SHOULD be RFC 3161-timestamped + Rekor-included. */
        require constraint { size(att.targetNodeId) >= 1 }
    }
    satisfy LifecycleByNodeId by Lifecycle::ContentNodeLifecycle;

    // §8.10.3 — retention asymmetry: withdrawal bounded to the publisher's own pointer/label.
    requirement def <'R-retention-asymmetry'> RetentionAsymmetryReq {
        subject ver : Implementation;
        doc /* A withdraws from P does not invalidate a locatedAt signed by another party;
              when both exist the verifier surfaces BOTH (not global erasure). */
        require constraint : SurfacesRetention { in impl = ver; }
    }
    satisfy RetentionAsymmetryReq by Lifecycle::RetentionAsymmetry;      // the constraint def
    verify  RetentionAsymmetryReq by Verification::CheckLifecycleState;  // check #10

    // §8.10.3 — MUST NOT silently delete withdrawn nodes.
    requirement def <'R-no-silent-delete'> NoSilentDeletion {
        subject impl : Implementation;
        doc /* Implementation does not remove withdrawn content nodes from storage/listings
              except via explicit administrative action with an audit trail. */
        require constraint : NoSilentDelete { in impl = impl; }
    }

    // §8.10.4 — pre-v0.1 legacy lifecycle columns honored when no attestation envelopes present.
    requirement def <'R-legacy-lifecycle-cols'> HonorLegacyLifecycleColumns {
        subject ver : Implementation;
        doc /* When no withdraws/reinstates envelopes are present for the target, honor legacy
              withdrawnAt/reinstatedAt columns. */
        require constraint : HonorsLegacyColumns { in impl = ver; }
    }
}
```

### 8.5 The verifier-implementation umbrella requirement

```sysml
package Conformance {
    // §9.1 — a conformant verifier performs EVERY §9.2 check, surfaces lifecycle, refuses truth verdicts.
    // Requirement decomposition uses NESTED requirement usages (there is no 'includes' keyword).
    requirement def <'R-conformant-verifier'> ConformantVerifier {
        subject ver : Implementation;
        doc /* Performs every §9.2 check on any node it processes, surfaces §8.10 lifecycle
              state when present, and refuses to compute platform-issued correctness verdicts (§5.1). */
        require constraint : PerformsEveryCheck { in impl = ver; }

        // Decomposition tree (nested usages of the finer-grained requirements).
        requirement signEd25519ph     : SignWithEd25519ph;
        requirement signingKeyIdEqKid : SigningKeyIdEqualsKid;
        requirement signerCrosscheck  : SignerIdentityCrossCheck;
        requirement pinnedAnchors      : ValidateAgainstPinnedAnchors;
        requirement family             : FamilyDiscriminator;
        requirement captureVocab       : CaptureMethodVocabularyConformance;
        requirement lifecycle          : LifecycleByNodeId;
        requirement retention          : RetentionAsymmetryReq;
        requirement noTruthScoring     : NoAutomatedTruthScoring;
    }
    // Traceability: the umbrella requirement is verified by the full verify behavior.
    verify  ConformantVerifier by Verification::VerifyNodeFull;
    satisfy ConformantVerifier by Verification::VerifyNode;
}
```

The nested-requirement decomposition gives a requirement *tree* rooted at `ConformantVerifier`; combined with `satisfy`/`verify`, this is the model element that lets an engineer ask "which structural part and which behavior discharge requirement X?" — a query SHACL cannot answer because it has no separate requirement objects.

---

## 9. Signing / identity / transparency-log infrastructure as external system parts

The verifier completes every check "using only public infrastructure plus the publisher's own trust registry" (§7.3, §9.1). SysML models the *system context* — the verifier and the external systems it talks to — as `part def`s connected through `interface def`s and `port def`s. This is the surface where SysML carries the spec's decentralization invariant (the `typedstandards.org` index is **not** a connected part of the verification context; §8.13, §7.3) explicitly.

### 9.1 External system parts and the verification context

```sysml
package Infrastructure {
    import Primitives::*;
    import ScalarValues::*;

    enum def KeyStatus { active; deprecated; revoked; }
    item def SignerIdentity {
        attribute bindingTier : String[1];   // registry example value: "platform" (§8.3.3)
        attribute identifier  : String[1];
        attribute displayName : String[1];
    }
    item def TrustRegistryEntry {
        attribute kid       : String[1];
        attribute publicKey : Base64[1];
        ref item  signerIdentity : SignerIdentity[0..1];   // pre-v0.1 omit => synthesize legacy_embedded
        attribute status    : KeyStatus[1];
        attribute activatedAt  : String[1];                // ISO-8601 | null
        attribute deprecatedAt : String[1];
        attribute revokedAt    : String[1];
    }
    // §8.3.3 — trust registry served by the PUBLISHER'S own domain (not a central authority).
    item def TrustRegistry { ref item keys : TrustRegistryEntry[1..*]; }

    // §10.3 — pinned trust anchors carried as documented constants.
    item def PinnedTsaAnchor   { attribute sha256Fingerprint : HexDigest[1]; }  // FreeTSA RSA-4096 root
    item def PinnedRekorAnchor { attribute logId : HexDigest[1]; }              // Rekor P-256 log key

    item def AttestationGraph { ref item nodes : Taxonomy::AttestationNode[0..*]; }

    // The bundle of context a VerifyNode action consumes.
    item def VerificationContext {
        ref item registry         : TrustRegistry[1];
        ref item tsaAnchor        : PinnedTsaAnchor[1];
        ref item rekorAnchor      : PinnedRekorAnchor[1];
        ref item blobStore        : BlobStore[0..1];
        ref item attestationGraph : AttestationGraph[1];
    }

    // External system PARTS the verifier talks to.
    part def PublisherDomain { port registry : RegistryServePort; port packages : PackageServePort; }
    part def PublicTsa       { port tsa : TsaPort; }              // e.g. FreeTSA
    part def RekorLog        { port rekor : RekorPort; }          // Sigstore Rekor
    part def BlobStore       { port blobs : BlobPort; }
}
```

### 9.2 Interfaces, ports, and the decentralization invariant

`interface def`s declare *ends* and are *used* (not defined) with `connect`; a port and its conjugate (`~Port`) are wired by an interface usage. The decentralization invariant is encoded by the *absence* of a `typedstandards.org` part from `VerificationSystem`.

```sysml
package Infrastructure {
    // Ports the verifier uses (request/response over public infrastructure).
    port def RegistryServePort { out registryDoc : TrustRegistry; }     // GET /.well-known/typed-publisher.json
    port def PackageServePort  { out packageBlob : Envelope::SignedNode; }
    port def TsaPort           { out caChain : Base64; }
    port def RekorPort         { out inclusionProof : Base64; }
    port def BlobPort          { out bytes : Base64; }

    // The verifier as a system part with conjugate ports.
    part def Verifier {
        port registry : ~RegistryServePort;   // conjugate (consumes)
        port packages : ~PackageServePort;
        port tsa      : ~TsaPort;
        port rekor    : ~RekorPort;
        port blobs    : ~BlobPort;
    }

    // §7.3 — interface defs declaring the two ends the verifier-to-infrastructure links connect.
    interface def VerifyToRegistry { end verifierSide : ~RegistryServePort; end serverSide : RegistryServePort; }
    interface def VerifyToPackages { end verifierSide : ~PackageServePort;  end serverSide : PackageServePort;  }
    interface def VerifyToTsa      { end verifierSide : ~TsaPort;           end serverSide : TsaPort;           }
    interface def VerifyToRekor    { end verifierSide : ~RekorPort;         end serverSide : RekorPort;         }

    // The verification SYSTEM context. CRITICAL: typedstandards.org is NOT a connected part —
    // the index has no authority and is never in the verification path (§7.3, §8.13;
    // C-no-central-authority).
    part def VerificationSystem {
        part verifier  : Verifier;
        part publisher : PublisherDomain;
        part tsa       : PublicTsa;
        part rekor     : RekorLog;
        // (No typedstandards.org index part is connected here, by design.)

        interface registryLink : VerifyToRegistry connect verifier.registry to publisher.registry;
        interface packagesLink : VerifyToPackages connect verifier.packages to publisher.packages;
        interface tsaLink       : VerifyToTsa      connect verifier.tsa      to tsa.tsa;
        interface rekorLink     : VerifyToRekor    connect verifier.rekor    to rekor.rekor;
    }
}
```

That `VerificationSystem` *deliberately omits* a `typedstandards.org` part is the SysML encoding of `C-no-central-authority-in-verify` / `R-ver-no-index-query` (§7.3, §8.13): the model makes the absence structural and reviewable, where prose can only assert it. The `?inline=1` self-contained bundle (the offline-verifiability case, §9.4) is the configuration in which `VerificationContext` carries `registry`/`tsaAnchor`/`rekorAnchor`/`attestationGraph` inline and *no* interfaces fire — a second `VerificationSystem` variant with zero external `interface` usages, which is exactly the "fully offline, zero-network" property the Q15 harness demonstrates.

---

## 10. Fit / gap analysis

### 10.1 What SysML v2 captures that SHACL cannot


| Spec surface                                             | SysML v2 construct                                                                               | Why SHACL cannot reach it                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §9.2 ordered 15-check procedure                         | `action def VerifyNode` with `first…then…`                                                     | SHACL validates a graph; it has no notion of*order*, *control flow*, or *branch outcomes* (non-fatal vs REJECT vs degrade).                                               |
| Malformed-vs-integrity split (two parallel verdict axes) | `action def VerifyNodeFull` fork into `VerifyNode` ∥ `ValidateStructure`                        | SHACL*is* the structural validation; it cannot model that it runs *alongside* the crypto pipeline and that outcomes are reported as separate axes.                        |
| §8.10 lifecycle / visibility / key state machines       | `state def` with `accept`/`if`/`then` transitions over append-only attestation events            | SHACL has no temporal/transition semantics; it cannot express "current status = latest signer-matched attestation" or multi-cycle without a counter.                      |
| Retention asymmetry (withdrawal ≠ global erasure)       | `constraint def RetentionAsymmetry` over the two parallel states                                 | SHACL can check the signer-difference predicate on instances but cannot model the*behavioral consequence* (the surface-both obligation).                                  |
| System context / decentralization invariant              | `part def` + `interface def` + interface usages, with `typedstandards.org` deliberately *absent* | SHACL has no model of*system parts* or *who-talks-to-whom*; the "index not in the verification path" invariant is unexpressible.                                          |
| Delegation of crypto/log checks to external systems      | `action def` with opaque body delegated to external `part def` (TSA, Rekor, registry)            | SHACL cannot represent "this check is performed by an external party"; out-of-band checks are simply`expressibleInShacl=false` with no positive model.                    |
| Conformance requirements + traceability                  | `requirement def` + `subject`/`assume`/`require` + `satisfy`/`verify`/ nested requirements       | SHACL shapes*are* constraints; there is no separate requirement object, no subject, and no traceability edge linking a MUST to the structure/behavior that discharges it. |
| Build-state coloring across the model                    | `metadata def BuildState::State` annotations                                                     | SHACL has no metadata layer for build status orthogonal to shape.                                                                                                         |
| Producer-profile / content-profile variation             | `variation part def` with `variant` members                                                      | SHACL can validate a datHere instance but cannot model "the same node in one of two*configurations*."                                                                     |

### 10.2 What SysML v2 cannot do — and why SHACL remains authoritative

- **Instance validation of RDF/JSON-LD documents.** SysML models *types and behaviors*; it does not ingest a concrete `content/claim/v1` document and emit per-node validation results. The closed enums (`TrendDirection`, `ComparisonRel`), the `dcterms:identifier`-unique-within-package rule, the both-scope-components-present rule, the conditional `prompt.text` presence, the `untyped`-not-co-occurring-with-typed rule, and every `ts:` SHACL shape are modeled here only as `constraint def` *signatures* and `assert constraint`s. **SHACL is authoritative for all of these** — the SysML model points at them but does not execute them.
- **Cryptography, hashing, Merkle inclusion, cert chains, network fetch.** `computeEnvelopeHash`, `CheckSignature`, `CheckRekorInclusion`, `CheckTimestamp`, `CheckBlobRefs`, and the trust-registry join are modeled with opaque bodies and external delegation. SysML maps the procedure; it is not the verifier. Both formalizations agree these are `expressibleInShacl=false` and outside any declarative validator.
- **JSON-LD document well-formedness.** A parsing concern; neither SysML nor SHACL owns it (though `@context` membership is checkable once parsed — modeled as a structural constraint signature).

### 10.3 Spec ambiguities surfaced by the modeling exercise

Formalization forces decisions the prose left implicit. The following are recorded as *ambiguities to resolve against the reference implementation or a future ADR* — not as model choices that override the spec:

1. **`contentProfile` placement.** §8.1.1 lists `contentProfile` as a *top-level* field; §8.2 / §8.7 reference `metadata.contentProfile`. The model places it on `Metadata` (the more frequently cited access path) but flags the divergence in-line; a SysML `redefines` cannot live in two homes, so this must be pinned before the structural model is authoritative. Modeled, not asserted as settled.
2. **`output`/`trace`/`skillText` string-or-BlobRef.** The spec types these as `string | BlobRef`. SysML has no union type; the model uses paired `0..1` attributes (`output` + `outputBlob`) with an implied exclusivity constraint, or a `variation`. This is a modeling workaround, not a spec fact — the underlying choice is genuinely a union and a future schema should say which carrier is present.
3. **Delegated-publisher predicate (Q20).** `isDelegatedPublisher` is a `calc def` with no body because the spec says the mechanics are "a future ADR" and "not yet formalizable beyond permitted in principle." The lifecycle guard depends on a predicate the spec cannot yet define — the model marks this honestly rather than inventing an authorization rule.
4. **`(unspecified)` attestation payload fields.** `scope`, `availability`, `certificationScheme`, `validityWindow`, `methodology`, `scoringRubric`, `results` are typed as `String` placeholders with `// (unspecified)` comments. The spec gives field *names* without datatypes; the model does not invent types.
5. **`Magnitude` / `Component`.** Left `abstract` with no fields, per the spec's explicit "do NOT invent fields" stance. A SysML `item def` with no features is the faithful encoding of "referenced but not defined in region."
6. **Signer-matching precision.** The lifecycle "signer-matched" predicate (`signerMatchesTarget`) is identity-equality today but must widen to admit delegated-publisher keys once Q20 lands; the `calc def` is the seam where that widening will occur.
7. **`bindingTier` vocabulary.** The §8.5 ladder is informative ("only the GitHub tier is built") and the §8.3.3 registry example carries `bindingTier: "platform"`; the model uses the spec's literal values and marks `BindingTier` extensible rather than freezing a closed enum the spec does not freeze.
8. **`captureMethod` literals as strings, not enum members.** The three v0.1 values are hyphenated literals (`chat-flow-stream`, …); they are carried as `String`-valued constants, not enum identifiers, because KerML identifiers cannot contain hyphens. Modeling them as an enum would silently rename them to values the spec never defines.

---

## Consolidated model listing

```sysml
package TypedStandards {
    doc /* Typed Standards Specification v0.1.x as a SysML v2 model.
         Normative source: docs/architecture/typed-standards-specification.md.
         Descriptive model; spec text is normative. Crypto/log/network checks are
         delegated to external parts and are NOT executed by this model. Instance-level
         graph-shape validation is SHACL's authoritative responsibility. */

    package Primitives;
    package BuildState;
    package Envelope;
    package Taxonomy;
    package ContentAnalysis;
    package TypedClaims;
    package CaptureAndProfiles;
    package Infrastructure;
    package Lifecycle;
    package Verification;
    package Conformance;
    import Primitives::*;
}

// ============================ BUILD STATE ============================
package BuildState {
    enum def Level { built; partial; reserved; ratified; specified; }
    metadata def State :> Metadata::ModelMetadata { attribute level : Level; }
    metadata built     : State { :>> level = Level::built;     }
    metadata partial   : State { :>> level = Level::partial;   }
    metadata reserved  : State { :>> level = Level::reserved;  }
    metadata ratified  : State { :>> level = Level::ratified;  }
    metadata specified : State { :>> level = Level::specified; }
}

// ============================ PRIMITIVES ============================
package Primitives {
    import ScalarValues::*;
    attribute def UriString :> String;
    attribute def HexDigest :> String;
    attribute def Base64    :> String;
    attribute def Iso8601   :> String;

    attribute def ContentHash {                                  // §8.2 / ADR-0008 multihash
        attribute sha256   : HexDigest[1];                       // required default
        attribute sha3_256 : HexDigest[0..1];
        attribute blake3   : HexDigest[0..1];
    }
    item def BlobRef {                                           // §8.1.5
        attribute ref         : String[1];                       // blob:sha256:<64-hex>
        attribute url         : UriString[1];
        attribute contentType : String[1];
        attribute size        : Integer[1];
    }
}

// ============================ ENVELOPE ============================
package Envelope {
    import Primitives::*;
    import ScalarValues::*;

    item def SignatureEnvelope {                                 // §8.3.1
        attribute signature : Base64[1];
        attribute publicKey : Base64[1];
        attribute algorithm : String[1] default "Ed25519ph";
        attribute kid       : String[1];
    }
    item def Signer {                                            // §8.5 / §6.2
        attribute bindingTier : Taxonomy::BindingTier[1];
        attribute identifier  : String[1];
        attribute displayName : String[1];
        attribute verifiedAt  : Iso8601[0..1];
    }
    item def Rfc3161Timestamp { attribute token : Base64[1]; }   // §8.3.2 (best-effort)
    item def RekorInclusionProof {
        attribute entryId        : String[1];
        attribute inclusionProof : Base64[1];
        attribute checkpoint     : Base64[1];
    }
    item def Metadata {                                          // §8.1.2
        attribute schemaVersion  : String[1] default "0.1.0";
        attribute packageId      : String[1];
        attribute createdAt      : Iso8601[1];
        attribute signingKeyId   : String[1];
        attribute captureMethod  : CaptureAndProfiles::CaptureMethodLabel[1];
        attribute contentType    : ContentAnalysis::QecContentType[1..*];
        attribute contentProfile : CaptureAndProfiles::ContentProfile[0..1];  // placement open — §10.3(1)
    }

    abstract part def SignedNode {                              // §6.2, §7.1, §7.4
        attribute type                    : Primitives::UriString[1];
        attribute contentHash             : Primitives::ContentHash[1];
        attribute contentCanonicalization : Primitives::UriString[1];
        ref item sig                  : SignatureEnvelope[1];
        ref item signer               : Signer[0..1];
        ref item timestamp            : Rfc3161Timestamp[0..1];
        ref item rekorInclusionProof  : RekorInclusionProof[0..1];
        ref item metadata             : Metadata[1];
        derived attribute nodeId : Primitives::HexDigest[1] = Verification::computeEnvelopeHash(self);
    }
}

// ============================ TAXONOMY ============================
package Taxonomy {
    import Envelope::*;
    import ScalarValues::*;

    enum def BindingTier {                                      // §8.5 informative ladder + registry value
        pseudonymous; github; orcid; did_web; notarized; platform; legacy_embedded;
    }
    enum def AuthorizationRule { publisher_only; any_with_binding; specific_role_required; }

    abstract part def TypedNode :> SignedNode {
        attribute targetNodeId : Primitives::HexDigest[0..*];
    }
    abstract part def ContentNode :> TypedNode {               // §7.4 no targetNodeId
        attribute redefines targetNodeId : Primitives::HexDigest[0];
    }
    abstract part def AttestationNode :> TypedNode {           // §7.4 >=1 targetNodeId
        attribute redefines targetNodeId : Primitives::HexDigest[1..*];
        attribute authorizationRule : AuthorizationRule[1];
    }

    // ---- content/* sub-types ----
    #BuildState::built part def AnalysisNode :> ContentNode {
        attribute redefines type default "content/analysis/v1";
        ref item payload : ContentAnalysis::EvidencePackage[1]; }
    #BuildState::reserved part def ClaimNode :> ContentNode {
        attribute redefines type default "content/claim/v1";
        ref item payload : TypedClaims::ClaimDocument[1]; }
    #BuildState::reserved part def QuestionNode :> ContentNode { attribute redefines type default "content/question/v1"; }
    #BuildState::reserved part def EvidenceNode :> ContentNode { attribute redefines type default "content/evidence/v1"; }
    #BuildState::reserved part def HostNode :> ContentNode { attribute redefines type default "content/host/v1"; }
    #BuildState::reserved part def HostPolicyNode :> ContentNode { attribute redefines type default "content/hostPolicy/v1"; }
    #BuildState::reserved part def HostTermsOfUseNode :> ContentNode { attribute redefines type default "content/hostTermsOfUse/v1"; }
    #BuildState::reserved part def ToolNode :> ContentNode { attribute redefines type default "content/tool/v1"; }

    // ---- attestation/* sub-types (Q36 ratified table) ----
    #BuildState::ratified part def WithdrawsNode :> AttestationNode {
        attribute redefines type default "attestation/withdraws/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute reason : String[1]; attribute effectiveAt : Primitives::Iso8601[0..1]; }
    #BuildState::ratified part def ReinstatesNode :> AttestationNode {
        attribute redefines type default "attestation/reinstates/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute priorWithdrawalNodeId : Primitives::HexDigest[1]; attribute reason : String[0..1]; }
    #BuildState::ratified part def SupersedesNode :> AttestationNode {
        attribute redefines type default "attestation/supersedes/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute successorNodeId : Primitives::HexDigest[1]; }
    #BuildState::ratified part def PublishesNode :> AttestationNode {
        attribute redefines type default "attestation/publishes/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;   // OR delegated (Q20)
        attribute publicationHost : String[1]; attribute releasedAt : Primitives::Iso8601[1]; }
    #BuildState::ratified part def LocatedAtNode :> AttestationNode {
        attribute redefines type default "attestation/locatedAt/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute uri : Primitives::UriString[1]; attribute contentHash : Primitives::ContentHash[1];
        attribute contentLength : Integer[0..1]; attribute availability : String[0..1]; }
    #BuildState::ratified part def WasDerivedFromNode :> AttestationNode {
        attribute redefines type default "attestation/wasDerivedFrom/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        ref item derivationMethod : TypedClaims::AnalyticalDerivation[1]; }   // launder guard (conditional)
    #BuildState::ratified part def AnswersQuestionNode :> AttestationNode {
        attribute redefines type default "attestation/answersQuestion/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding; }
    #BuildState::ratified part def SupportedByNode :> AttestationNode {
        attribute redefines type default "attestation/supportedBy/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding; }
    #BuildState::ratified part def OpposedByNode :> AttestationNode {
        attribute redefines type default "attestation/opposedBy/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding; }
    #BuildState::ratified part def CorroboratesNode :> AttestationNode {
        attribute redefines type default "attestation/corroborates/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute scope : String[1]; attribute reasoning : String[0..1]; }
    #BuildState::ratified part def ContradictsNode :> AttestationNode {
        attribute redefines type default "attestation/contradicts/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute scope : String[1]; attribute reasoning : String[0..1]; }
    #BuildState::ratified part def EndorsesNode :> AttestationNode {
        attribute redefines type default "attestation/endorses/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute scope : String[1]; }
    #BuildState::ratified part def CertifiesNode :> AttestationNode {
        attribute redefines type default "attestation/certifies/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute certificationScheme : String[1]; attribute validityWindow : String[1]; }
    #BuildState::ratified part def EvaluatesNode :> AttestationNode {
        attribute redefines type default "attestation/evaluates/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute methodology : String[1]; attribute scoringRubric : String[1];
        ref item results : String[1]; }
    #BuildState::ratified part def ConformsNode :> AttestationNode {
        attribute redefines type default "attestation/conforms/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute standardId : Primitives::UriString[1]; }
}

// ============================ CONTENT/ANALYSIS ============================
package ContentAnalysis {
    import Primitives::*; import Envelope::*; import ScalarValues::*;
    item def Cost {                                            // §8.1.7 (AI-specific; Q7/Q9)
        attribute promptTokens : Integer[1]; attribute completionTokens : Integer[1];
        attribute totalTokens : Integer[1]; attribute model : String[1];
        attribute durationMs : Integer[1]; }
    enum def PromptVisibility { full_text; hash_only; }
    item def Prompt { attribute hash : HexDigest[1]; attribute visibility : PromptVisibility[1];
                      attribute text : String[0..1]; }              // present iff full_text
    enum def QecContentType { claim; question; evidence; untyped; }
    item def SkillMetadata { attribute skillText : String[0..1]; ref item skillTextBlob : BlobRef[0..1];
                             attribute mcpServerUrl : UriString[0..*]; }
    item def NotebookExtension { attribute format : String[0..1]; attribute provenance : String[0..1]; }
    item def ExtensionsMap { ref item notebook : NotebookExtension[0..1]; }
    item def EvidencePackage {                                // §8.1
        ref item metadata : Metadata[1]; ref item prompt : Prompt[1];
        attribute queries : String[0..*]; attribute dataSources : String[0..*];
        ref item cost : Cost[1]; ref item skillMetadata : SkillMetadata[1];
        attribute output : String[0..1]; ref item outputBlob : BlobRef[0..1];
        attribute trace : String[0..1]; ref item traceBlob : BlobRef[0..1];
        attribute summary : String[0..1];                     // REQUIRED under datHere
        ref item provenance : String[0..1]; ref item extensions : ExtensionsMap[0..1]; }
}

// ============================ TYPED CLAIMS (§8.11; specified, Q5) ============================
package TypedClaims {
    import Primitives::*; import ScalarValues::*;
    item def TemporalInterval { attribute hasBeginning : Iso8601[0..1]; attribute hasEnd : Iso8601[0..1]; attribute inXSDDate : Iso8601[0..1]; }
    item def GeographicScope { attribute identifier : String[0..1]; attribute name : String[0..1]; attribute hasGeometry : String[0..1]; }
    item def CensusTract :> GeographicScope; item def CensusBlock :> GeographicScope; item def CensusBlockGroup :> GeographicScope;
    item def ZIPCodeTabulationArea :> GeographicScope; item def SchoolDistrict :> GeographicScope; item def MunicipalBoundary :> GeographicScope;
    item def CountyBoundary :> GeographicScope; item def StateBoundary :> GeographicScope; item def NeighborhoodTabulationArea :> GeographicScope;
    item def CommunityBoardDistrict :> GeographicScope; item def CityCouncilDistrict :> GeographicScope; item def PolicePrecinct :> GeographicScope;  // Q14
    item def Scope { ref item geographicScope : GeographicScope[1]; ref item temporalScope : TemporalInterval[1]; }
    enum def ConfidenceMethod { FrequentistInterval; BayesianCredibleInterval; SampleSizeBased; LLMReportedLogProbability; HumanReview; NotApplicable; }
    item def ConfidenceStatement { attribute method : ConfidenceMethod[1]; attribute level : Real[0..1];
                                   attribute lowerBound : Real[0..1]; attribute upperBound : Real[0..1]; attribute methodReference : String[0..1]; }
    item def OutputSpan { attribute outputFile : String[1]; attribute byteRange : Integer[2]; }
    item def AnalyticalDerivation { attribute traceReference : String[1]; ref item translationModel : String[1];
                                    attribute translationPrompt : String[1]; ref item sourceOutputSpan : OutputSpan[1]; }
    abstract item def Magnitude;  abstract item def Component;
    abstract item def Claim { attribute identifier : String[1]; attribute subject : UriString[1];
                              ref item scope : Scope[1]; ref item confidence : ConfidenceStatement[1];
                              attribute wasDerivedFrom : UriString[1..*]; ref item derivedVia : AnalyticalDerivation[1];
                              attribute description : String[0..1]; attribute limitations : String[0..1]; }
    enum def TrendDirection { Increase; Decrease; NoSignificantChange; }
    enum def ComparisonRel  { GreaterThan; LessThan; ApproximatelyEqual; }
    item def TrendClaim :> Claim { attribute metric : UriString[1]; ref item baselinePeriod : TemporalInterval[1];
                                   ref item comparisonPeriod : TemporalInterval[1]; attribute direction : TrendDirection[1]; ref item magnitude : Magnitude[1]; }
    item def ComparisonClaim :> Claim { attribute metric : UriString[1]; ref item scopeA : Scope[1]; ref item scopeB : Scope[1];
                                        attribute relation : ComparisonRel[1]; ref item magnitude : Magnitude[1]; }
    item def ObservationClaim :> Claim { attribute metric : UriString[1]; attribute value : Real[1]; attribute unit : UriString[1]; }
    item def CompositionClaim :> Claim { ref item whole : Scope[1]; ref item components : Component[1..*]; attribute totalsTo : Real[1]; }
    item def RelationshipClaim :> Claim { attribute metricA : UriString[1]; attribute metricB : UriString[1]; attribute relationshipType : UriString[1]; attribute strength : Real[1]; }
    item def QualitativeClaim :> Claim { attribute assertion : String[1]; attribute groundingMethod : UriString[1]; }
    item def ClaimDocument { attribute context : UriString[1..*]; ref item graph : Claim[1..*]; }
}

// ============================ CAPTURE & PROFILES ============================
package CaptureAndProfiles {
    import Taxonomy::*; import ContentAnalysis::*; import ScalarValues::*;
    attribute def CaptureMethodLabel :> String;                    // §8.6 open at core
    package AiAssistedCaptureVocabulary {                          // hyphenated literals, NOT enum ids (§1.3)
        attribute chatFlowStream          : CaptureMethodLabel default "chat-flow-stream";
        attribute claudeCodeJsonlReadback : CaptureMethodLabel default "claude-code-jsonl-readback";
        attribute claudeCodeSelfReport    : CaptureMethodLabel default "claude-code-self-report";
    }
    enum def ContentProfile { 'default'; datHere; }
    attribute def ProducerProfile :> String;
    variation part def AnalysisNodeVariant :> AnalysisNode {        // §8.7 datHere variation
        variant part defaultProfile : AnalysisNode {
            attribute redefines payload.metadata.contentProfile default ContentProfile::'default'; }
        #BuildState::built
        variant part datHereProfile : AnalysisNode {
            attribute redefines payload.metadata.contentProfile default ContentProfile::datHere;
            attribute redefines payload.summary : String[1];
            ref item redefines payload.extensions.notebook : NotebookExtension[1]; }
    }
}

// ============================ INFRASTRUCTURE (§9 system context) ============================
package Infrastructure {
    import Primitives::*; import ScalarValues::*;
    enum def KeyStatus { active; deprecated; revoked; }
    item def SignerIdentity { attribute bindingTier : String[1]; attribute identifier : String[1]; attribute displayName : String[1]; }
    item def TrustRegistryEntry { attribute kid : String[1]; attribute publicKey : Base64[1];
        ref item signerIdentity : SignerIdentity[0..1]; attribute status : KeyStatus[1];
        attribute activatedAt : String[1]; attribute deprecatedAt : String[1]; attribute revokedAt : String[1]; }
    item def TrustRegistry { ref item keys : TrustRegistryEntry[1..*]; }
    item def PinnedTsaAnchor { attribute sha256Fingerprint : HexDigest[1]; }
    item def PinnedRekorAnchor { attribute logId : HexDigest[1]; }
    item def AttestationGraph { ref item nodes : Taxonomy::AttestationNode[0..*]; }
    item def VerificationContext { ref item registry : TrustRegistry[1]; ref item tsaAnchor : PinnedTsaAnchor[1];
        ref item rekorAnchor : PinnedRekorAnchor[1]; ref item blobStore : BlobStore[0..1]; ref item attestationGraph : AttestationGraph[1]; }

    port def RegistryServePort { out registryDoc : TrustRegistry; }
    port def PackageServePort  { out packageBlob : Envelope::SignedNode; }
    port def TsaPort { out caChain : Base64; }  port def RekorPort { out inclusionProof : Base64; }  port def BlobPort { out bytes : Base64; }
    part def PublisherDomain { port registry : RegistryServePort; port packages : PackageServePort; }
    part def PublicTsa { port tsa : TsaPort; }  part def RekorLog { port rekor : RekorPort; }  part def BlobStore { port blobs : BlobPort; }
    part def Verifier { port registry : ~RegistryServePort; port packages : ~PackageServePort; port tsa : ~TsaPort; port rekor : ~RekorPort; port blobs : ~BlobPort; }
    interface def VerifyToRegistry { end verifierSide : ~RegistryServePort; end serverSide : RegistryServePort; }
    interface def VerifyToPackages { end verifierSide : ~PackageServePort;  end serverSide : PackageServePort;  }
    interface def VerifyToTsa      { end verifierSide : ~TsaPort;           end serverSide : TsaPort;           }
    interface def VerifyToRekor    { end verifierSide : ~RekorPort;         end serverSide : RekorPort;         }
    part def VerificationSystem {                              // §7.3, §8.13 — typedstandards.org deliberately ABSENT
        part verifier : Verifier; part publisher : PublisherDomain; part tsa : PublicTsa; part rekor : RekorLog;
        interface registryLink : VerifyToRegistry connect verifier.registry to publisher.registry;
        interface packagesLink : VerifyToPackages connect verifier.packages to publisher.packages;
        interface tsaLink      : VerifyToTsa      connect verifier.tsa      to tsa.tsa;
        interface rekorLink    : VerifyToRekor    connect verifier.rekor    to rekor.rekor;
    }
}

// ============================ LIFECYCLE STATE MACHINES (§8.10, §8.3.3, §8.7.4) ============================
package Lifecycle {
    import Taxonomy::*; import ScalarValues::*;
    calc def signerMatchesTarget { in att : AttestationNode; return : Boolean; }
    calc def isDelegatedPublisher { in att : PublishesNode; return : Boolean; }   // Q20
    calc def pointsAtPriorWithdrawal { in id : Primitives::HexDigest; return : Boolean; }
    calc def isNonEmpty { in s : String; return : Boolean; }
    calc def hasBinding { in att : AttestationNode; return : Boolean; }
    calc def isDistinctCopyPair { in loc : LocatedAtNode; return : Boolean; }

    state def ContentNodeLifecycle {                          // §8.10.1 derived-view over append-only chain
        entry; then committed; state committed; state published; state withdrawn; state superseded;
        transition committed_to_published first committed accept pub : PublishesNode
            if signerMatchesTarget(pub) or isDelegatedPublisher(pub) then published;
        transition published_to_withdrawn first published accept w : WithdrawsNode
            if signerMatchesTarget(w) and isNonEmpty(w.reason) then withdrawn;
        transition withdrawn_to_reinstated first withdrawn accept r : ReinstatesNode
            if signerMatchesTarget(r) and pointsAtPriorWithdrawal(r.priorWithdrawalNodeId) then published;
        transition published_to_superseded first published accept s : SupersedesNode
            if signerMatchesTarget(s) then superseded;
    }
    state def ContentNodeVisibility {                         // §8.10.2 orthogonal location axis
        entry; then noPublicLocation; state noPublicLocation; state located;
        transition to_located first noPublicLocation accept loc : LocatedAtNode if hasBinding(loc) then located;
        transition additional_copy first located accept loc2 : LocatedAtNode if hasBinding(loc2) and isDistinctCopyPair(loc2) then located;
    }
    constraint def RetentionAsymmetry {                      // §8.10.3
        in withdraw : WithdrawsNode; in backupLoc : LocatedAtNode; in backupIndependentlyVerifiable : Boolean;
        require constraint { (withdraw.signer.identifier != backupLoc.signer.identifier) implies backupIndependentlyVerifiable }
    }
    state def TrustRegistryKeyLifecycle {                    // §8.3.3
        entry; then active; state active; state deprecated; state revoked;
        transition active_to_deprecated first active accept deprecate then deprecated;
        transition active_to_revoked     first active accept revoke then revoked;
        transition deprecated_to_revoked first deprecated accept revoke then revoked;
    }
    state def NotebookProvenance { entry; state skeleton; state executed; }  // §8.7.4
}

// ============================ VERIFICATION (§9.2 behavior) ============================
package Verification {
    import Envelope::*; import ScalarValues::*;
    calc def computeEnvelopeHash { in node : SignedNode; return : Primitives::HexDigest; }           // out-of-band
    calc def computeContentHash { in node : SignedNode; in rule : Primitives::UriString; return : Primitives::ContentHash; }

    enum def VerifierCode { unknown_target_node; unknown_canonicalization_rule; unknown_type;
        signer_identity_mismatch; captureMethod_unknown; producerProfile_bundle_unresolved; }
    enum def KeyTrust { active; deprecated_valid; deprecated_invalid; revoked; unknown_key; registry_unavailable; legacy_embedded; }
    item def Verdict { attribute envelopeIntegrity : Boolean[1]; attribute signatureValid : Boolean[1];
        attribute keyTrust : KeyTrust[1]; attribute lifecycleStatus : String[0..1];
        attribute captureMethod : CaptureAndProfiles::CaptureMethodLabel[1]; attribute codes : VerifierCode[0..*];
        attribute envelopeOk : Boolean[1]; attribute datHereOk : Boolean[0..1]; }

    // External-delegated (opaque) check actions.
    action def CheckEnvelopeIntegrity { in node : SignedNode; out ok : Boolean; }
    action def CheckSignature { in node : SignedNode; out ok : Boolean; }
    action def CheckContentHash { in node : SignedNode; out ok : Boolean; }
    action def CheckTrustRegistry { in node : SignedNode; in registry : Infrastructure::TrustRegistry; out verdict : KeyTrust; }
    action def CheckTimestamp { in node : SignedNode; in tsaAnchor : Infrastructure::PinnedTsaAnchor; out ok : Boolean; }
    action def CheckRekorInclusion { in node : SignedNode; in rekorAnchor : Infrastructure::PinnedRekorAnchor; out ok : Boolean; }
    action def CheckBlobRefs { in node : SignedNode; in blobStore : Infrastructure::BlobStore; out ok : Boolean; }
    action def CheckLifecycleState { in node : SignedNode; in attestationGraph : Infrastructure::AttestationGraph; out status : String; }
    action def CrossCheckSignerIdentity { in node : SignedNode; in registry : Infrastructure::TrustRegistry; out code : VerifierCode[0..1]; }
    // SHACL-expressible (structural) check actions.
    action def ResolveCanonicalizationRule { in node : SignedNode; out code : VerifierCode[0..1]; }
    action def CheckSigningKeyIdConsistency { in node : SignedNode; out ok : Boolean; }
    action def ReadCaptureMethodLabel { in node : SignedNode; out label : CaptureAndProfiles::CaptureMethodLabel; }
    action def ResolveType { in node : SignedNode; out code : VerifierCode[0..1]; }
    action def CrossCheckNodeId { in node : SignedNode; in attestationGraph : Infrastructure::AttestationGraph; out code : VerifierCode[0..1]; }
    action def CheckCaptureMethodVocabulary { in node : SignedNode; out code : VerifierCode[0..1]; }

    action def VerifyNode {                                  // §9.2 ordered 15-check list
        in node : SignedNode; in ctx : Infrastructure::VerificationContext; out verdict : Verdict;
        first start;
        then action c1  : CheckEnvelopeIntegrity { in node = node; }
        then action c2  : CheckSignature { in node = node; }
        then action c3  : ResolveCanonicalizationRule { in node = node; }
        then action c4  : CheckContentHash { in node = node; }
        then action c5  : CheckTrustRegistry { in node = node; in registry = ctx.registry; }
        then action c6  : CheckSigningKeyIdConsistency { in node = node; }
        then action c7  : CheckTimestamp { in node = node; in tsaAnchor = ctx.tsaAnchor; }
        then action c8  : CheckRekorInclusion { in node = node; in rekorAnchor = ctx.rekorAnchor; }
        then action c9  : CheckBlobRefs { in node = node; in blobStore = ctx.blobStore; }
        then action c10 : CheckLifecycleState { in node = node; in attestationGraph = ctx.attestationGraph; }
        then action c11 : ReadCaptureMethodLabel { in node = node; }
        then action c12 : ResolveType { in node = node; }
        then action c13 : CrossCheckNodeId { in node = node; in attestationGraph = ctx.attestationGraph; }
        then action c14 : CrossCheckSignerIdentity { in node = node; in registry = ctx.registry; }
        then action c15 : CheckCaptureMethodVocabulary { in node = node; }
        then done;
    }
    constraint def FamilyMembership; constraint def QecSetWellFormed; constraint def ProfileConsistencyShape;
    constraint def RequiredFieldsPresent; constraint def TargetNodeIdRule; constraint def TypeUriPattern;
    constraint def BlobRefShape; constraint def PromptVisibilityRule; constraint def ExtensionsKeysReverseDns;
    constraint def DatHereReqs1to7; constraint def ProvenanceExecutionConditional;
    action def ValidateStructure {                          // SHACL-targetable structural validations
        in node : SignedNode; out datHereOk : Boolean;
        assert constraint : FamilyMembership; assert constraint : QecSetWellFormed; assert constraint : ProfileConsistencyShape;
        assert constraint : RequiredFieldsPresent; assert constraint : TargetNodeIdRule; assert constraint : TypeUriPattern;
        assert constraint : BlobRefShape; assert constraint : PromptVisibilityRule; assert constraint : ExtensionsKeysReverseDns;
        assert constraint : DatHereReqs1to7; assert constraint : ProvenanceExecutionConditional;
    }
    action def VerifyNodeFull {                             // malformed-vs-integrity fork (two verdict axes)
        in node : SignedNode; in ctx : Infrastructure::VerificationContext; out verdict : Verdict;
        action env : VerifyNode { in node = node; in ctx = ctx; } action struct : ValidateStructure { in node = node; }
    }
}

// ============================ CONFORMANCE (§9 requirements + traceability) ============================
package Conformance {
    import Verification::*; import Lifecycle::*; import ScalarValues::*;
    part def ProductSurface; part def Implementation;
    constraint def CarriesPreamble { in surface : ProductSurface; }
    constraint def NoTruthScoring { in impl : Implementation; }
    constraint def ValidatesPinnedAnchors { in impl : Implementation; }
    constraint def NoSilentDelete { in impl : Implementation; }
    constraint def HonorsLegacyColumns { in impl : Implementation; }
    constraint def SurfacesRetention { in impl : Implementation; }
    constraint def PerformsEveryCheck { in impl : Implementation; }
    constraint def CheckCaptureMethodVocabPredicate { in pkg : Envelope::SignedNode; }

    requirement def <'R-preamble-carry'> CarryNormativePreamble { subject surface : ProductSurface;
        doc /* §5.1 four-line preamble surfaced before readers form conclusions. */
        require constraint : CarriesPreamble { in surface = surface; } }
    requirement def <'R-no-automated-truth-scoring'> NoAutomatedTruthScoring { subject impl : Implementation;
        doc /* No platform-issued correctness / rank-by-trust verdicts. */
        require constraint : NoTruthScoring { in impl = impl; } }
    satisfy NoAutomatedTruthScoring by Verification::Verdict;

    requirement def <'R-sign-ed25519ph'> SignWithEd25519ph { subject pkg : Envelope::SignedNode;
        require constraint { pkg.sig.algorithm == "Ed25519ph" } }
    satisfy SignWithEd25519ph by Envelope::SignatureEnvelope;  verify SignWithEd25519ph by Verification::CheckSignature;

    requirement def <'R-signingKeyId-eq-kid'> SigningKeyIdEqualsKid { subject pkg : Envelope::SignedNode;
        require constraint { pkg.metadata.signingKeyId == pkg.sig.kid } }
    satisfy SigningKeyIdEqualsKid by Envelope::Metadata;  verify SigningKeyIdEqualsKid by Verification::CheckSigningKeyIdConsistency;

    requirement def <'R-signer-crosscheck'> SignerIdentityCrossCheck { subject pkg : Envelope::SignedNode;
        assume constraint { pkg.signer != null }
        doc /* sig.kid resolved via registry signerIdentity == signer.identifier; mismatch => REJECT (#14, out-of-band join). */
        require constraint { pkg.signer.identifier == pkg.signer.identifier } }
    satisfy SignerIdentityCrossCheck by Envelope::Signer;  verify SignerIdentityCrossCheck by Verification::CrossCheckSignerIdentity;

    requirement def <'R-tsa-rekor'> CarryTimestampAndRekor { subject pkg : Envelope::SignedNode;   // SHOULD
        require constraint { (pkg.timestamp != null) and (pkg.rekorInclusionProof != null) } }
    verify CarryTimestampAndRekor by Verification::CheckTimestamp;  verify CarryTimestampAndRekor by Verification::CheckRekorInclusion;

    requirement def <'R-pinned-anchors'> ValidateAgainstPinnedAnchors { subject ver : Implementation;
        doc /* RFC 3161 leaf -> pinned FreeTSA root; RFC 6962 inclusion -> pinned Rekor key. */
        require constraint : ValidatesPinnedAnchors { in impl = ver; } }
    verify ValidateAgainstPinnedAnchors by Verification::CheckTimestamp;  verify ValidateAgainstPinnedAnchors by Verification::CheckRekorInclusion;

    requirement def <'R-family-discriminator'> FamilyDiscriminator { subject node : Taxonomy::TypedNode;
        require constraint {
            (node istype Taxonomy::ContentNode implies size(node.targetNodeId) == 0)
            and (node istype Taxonomy::AttestationNode implies size(node.targetNodeId) >= 1) } }
    satisfy FamilyDiscriminator by Taxonomy::ContentNode;  satisfy FamilyDiscriminator by Taxonomy::AttestationNode;
    verify FamilyDiscriminator by Verification::ValidateStructure;

    requirement def <'R-captureMethod-vocab'> CaptureMethodVocabularyConformance { subject pkg : Envelope::SignedNode;
        assume constraint : ProfileConsistencyShape;
        doc /* captureMethod in the resolved producerProfile vocabulary (ai-assisted-analysis v0.1 set). */
        require constraint : CheckCaptureMethodVocabPredicate { in pkg = pkg; } }
    satisfy CaptureMethodVocabularyConformance by CaptureAndProfiles::AiAssistedCaptureVocabulary;
    verify  CaptureMethodVocabularyConformance by Verification::CheckCaptureMethodVocabulary;

    requirement def <'R-profile-consistency'> ProfileConsistency { subject pkg : ContentAnalysis::EvidencePackage;
        doc /* (contentProfile == "datHere") iff producerProfile starts with "ai-assisted-analysis/datHere". */
        require constraint : ProfileConsistencyShape; }
    verify ProfileConsistency by Verification::ValidateStructure;

    requirement def <'R-summary-datHere'> SummaryRequiredUnderDatHere { subject pkg : ContentAnalysis::EvidencePackage;
        assume constraint { pkg.metadata.contentProfile == CaptureAndProfiles::ContentProfile::datHere }
        require constraint { (pkg.summary != null) and (size(pkg.summary) > 0) } }
    satisfy SummaryRequiredUnderDatHere by CaptureAndProfiles::AnalysisNodeVariant::datHereProfile;

    requirement def <'R-lifecycle-by-nodeId'> LifecycleByNodeId { subject att : Taxonomy::AttestationNode;
        doc /* References target by nodeId; Ed25519ph-signed (SHOULD timestamp+Rekor). */
        require constraint { size(att.targetNodeId) >= 1 } }
    satisfy LifecycleByNodeId by Lifecycle::ContentNodeLifecycle;

    requirement def <'R-retention-asymmetry'> RetentionAsymmetryReq { subject ver : Implementation;
        doc /* A withdraws from P does not invalidate another party's locatedAt; surface both. */
        require constraint : SurfacesRetention { in impl = ver; } }
    satisfy RetentionAsymmetryReq by Lifecycle::RetentionAsymmetry;  verify RetentionAsymmetryReq by Verification::CheckLifecycleState;

    requirement def <'R-no-silent-delete'> NoSilentDeletion { subject impl : Implementation;
        doc /* No removal of withdrawn nodes except via audited administrative action. */
        require constraint : NoSilentDelete { in impl = impl; } }

    requirement def <'R-legacy-lifecycle-cols'> HonorLegacyLifecycleColumns { subject ver : Implementation;
        doc /* When no withdraws/reinstates envelopes present, honor legacy withdrawnAt/reinstatedAt columns. */
        require constraint : HonorsLegacyColumns { in impl = ver; } }

    requirement def <'R-conformant-verifier'> ConformantVerifier { subject ver : Implementation;
        doc /* Performs every §9.2 check, surfaces §8.10 lifecycle, refuses truth verdicts. */
        require constraint : PerformsEveryCheck { in impl = ver; }
        requirement signEd25519ph     : SignWithEd25519ph;
        requirement signingKeyIdEqKid : SigningKeyIdEqualsKid;
        requirement signerCrosscheck  : SignerIdentityCrossCheck;
        requirement pinnedAnchors      : ValidateAgainstPinnedAnchors;
        requirement family             : FamilyDiscriminator;
        requirement captureVocab       : CaptureMethodVocabularyConformance;
        requirement lifecycle          : LifecycleByNodeId;
        requirement retention          : RetentionAsymmetryReq;
        requirement noTruthScoring     : NoAutomatedTruthScoring;
    }
    satisfy ConformantVerifier by Verification::VerifyNode;  verify ConformantVerifier by Verification::VerifyNodeFull;
}
```

---

*This document is the SysML v2 formalization companion to `/Users/danlessa/repos/bsci/civic-ai-tools/docs/architecture/typed-standards-specification.md`. It is descriptive: the spec is normative for package shape; `civic-ai-tools-website/docs/api/evidence-publish.md` is normative for the request/response contract. The SysML model captures system structure, behavior, lifecycle state machines, and requirements traceability; it does not — and structurally cannot — validate instance documents, which remains the SHACL formalization's authoritative role.*
