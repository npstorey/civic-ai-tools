# Typed Standards as SHACL — A Formalization of Instance-Data Conformance

> **Companion to** the consolidated formal model and `docs/architecture/typed-standards-specification.md` (v0.1.x). This document re-expresses the formalization-ready model as W3C SHACL ([Shapes Constraint Language](https://www.w3.org/TR/shacl/)) shapes. It is the RDF-native sibling of the SysML v2 behavioral re-expression: where SysML captures the verifier's *behavior* (the §9.2 check sequence as activities, the state machines of §5), SHACL captures the *instance-data conformance* surface — what a well-formed signed node and a well-formed typed claim must structurally look like. The two formalizations are complementary and deliberately non-overlapping at the boundary the spec itself draws: graph-shape validation vs. cryptographic / behavioral verification.
>
> **Conformance-tier note (read first).** Not every shape in this document is SHACL **Core**. The consolidated graph in the final section is partitioned into three tiers and is *loadable as Core* with the single SHACL-SPARQL shape (`tsh:SigningKeyIdConsistencyShape`) clearly isolated and labeled. Where a constraint needs SHACL-SPARQL or an out-of-band check, it is named as such and **not** presented as Core. The `syntaxValid` claim in earlier drafts was overstated; this revision corrects it — see §6.2 and §8.2.

---

## 1. Thesis

### 1.1 What SHACL is

SHACL is a W3C Recommendation for **validating RDF instance data against a set of constraints called *shapes*.** A SHACL processor takes two inputs — a *data graph* (RDF triples to be checked) and a *shapes graph* (a set of `sh:NodeShape` / `sh:PropertyShape` declarations) — and produces a *validation report*: a graph of `sh:ValidationResult` nodes, each naming the focus node, the failing path, the constraint component that fired, and a severity (`sh:Violation`, `sh:Warning`, `sh:Info`). SHACL constraints are pure functions of the graph. Core SHACL expresses presence (`sh:minCount`), absence (`sh:maxCount 0`), datatype (`sh:datatype`), node kind (`sh:nodeKind`), value-set membership (`sh:in`), lexical form (`sh:pattern`), fixed value (`sh:hasValue`), structural recursion into nested shapes (`sh:node`), logical composition (`sh:and`, `sh:or`, `sh:not`, `sh:xone`), and conditional application (`sh:if`-style patterns via `sh:or`/`sh:not`). Anything genuinely computational — cross-field equality over property *paths*, cross-node joins, ordering, uniqueness — requires **SHACL-SPARQL** (a `sh:sparql` constraint) and is *not* Core. This document keeps that line explicit.

The decisive property for this exercise: **SHACL validates the *shape* of a graph, never its *truth*, its *cryptographic integrity*, or the *behavior* of a process that consumes it.** That boundary is exactly the boundary Typed Standards itself draws in its §5.1 preamble ("the system surfaces signals, the consumer applies judgment") and in §9.3 ("what a verifier cannot check today"). The fit is therefore unusually clean in places and unusually honest about its limits in others.

### 1.2 Which surface of Typed Standards SHACL formalizes well

SHACL formalizes the **instance-data conformance** of two layers of the standard, and only those two:

1. **The cryptographic envelope as a data structure (§8.1, §8.3).** The presence, datatype, cardinality, and value-set membership of every field of a signed node — `type`, `contentHash`, `contentCanonicalization`, `sig{publicKey,algorithm,kid}`, `signer`, `metadata`, `captureMethod`, `timestamp`, `rekorInclusionProof` — is a pure graph-shape question, *once the JSON envelope is interpreted as RDF* (the `tsx:` fiction; see §2 and §8.2). SHACL expresses it natively under that interpretation. Crucially, SHACL validates that the *fields are well-formed*, never that the *signature is mathematically valid* — that distinction is the spine of §6 below.

2. **The typed-claims layer (§8.11).** This is where SHACL is not merely *applicable* but *prescribed*. §8.11.3 condition 3 reads: "Every top-level claim object validates against the SHACL shapes published with the Typed Standards Claim Vocabulary." §8.11.6 step 5 requires every domain extension to "publish SHACL shapes for validation." TC-R10 in the conformance catalog restates it as a MUST. The typed-claims layer is an *RDF graph* (JSON-LD 1.1) against an *RDF vocabulary* (`ts:`); SHACL is its native validation technology. **This document's shapes graph is therefore a candidate concrete realization of the "published SHACL shapes" the spec repeatedly references but does not itself ship.**

It also formalizes a useful slice of the structural checks the §9.2 verification list folds in alongside its crypto checks — family membership, the QEC `contentType` set, profile consistency, BlobRef shape, attestation-entry form, `type`-URI patterns, nodeId reference resolution within a loaded graph. §6 maps each §9.2 check to "SHACL-Core / SHACL-SPARQL / out-of-band."

### 1.3 Which surface SHACL does *not* formalize

SHACL cannot express, and this document does not pretend it can, the following — each of which is the *load-bearing* part of the standard's trust model:

- **Cryptographic signature verification** (§9.2 check 2 — Ed25519ph over the envelope-hash hex string). No graph constraint verifies a digital signature.
- **Envelope-hash and content-hash recomputation** (§9.2 checks 1, 4 — SHA-256 of RFC 8785 JCS bytes; multihash of off-log content). SHACL can assert that a `contentHash` *field is present and well-shaped*; it cannot recompute the hash and compare. (`nodeId ≡ envelopeHash` is *derived by construction* — SHACL cannot derive it.)
- **RFC 3161 timestamp X.509 chain validation and RFC 6962 Rekor Merkle-inclusion verification** (§9.2 checks 7, 8). Cert-chain walking and Merkle-proof verification against a pinned key are computational, not graph-shape.
- **Trust-registry verdict and the signer↔kid cross-check** (§9.2 checks 5, 14). These require a *cross-graph join* against a `.well-known` registry resource the data graph does not contain, plus temporal comparison against signing time.
- **BlobRef fetch-and-rehash** (§9.2 check 9 — HTTPS fetch + SHA-256). Network + hash, not graph.
- **Per-attestation lifecycle signature verification** (§9.2 check 10 — *mixed*: chain *ordering and signer-matching* is graph-checkable at the SHACL-SPARQL tier; each lifecycle node's *signature* is not).
- **Process behavior and state** — the publish-time signing/timestamping state machine (§5.4), the lifecycle derived-view projection (§5.1), the verifier's REJECT/degrade-gracefully error routing (§6 error vocabulary). These are *behavioral* and belong to the SysML formalization, not SHACL.
- **Truth and falsifiability.** §8.11.2 principle 5 ("falsifiable by construction") is a property of a claim *type's design* — that a counter-claim is *expressible in the same vocabulary* — not of any instance. SHACL validates instances; it cannot validate "a counter-claim could be written." This is a per-*type* meta-property, out of SHACL's reach.

### 1.4 Relationship to the vocabulary URI and the OWL-promotion open question

The typed-claims layer is bound to a single normative RDF vocabulary URI: `ts:` → `https://typedstandards.org/ns/ts#` (§8.11.4; reserved as an identifier in §12.2). SHACL shapes *target* RDF classes and properties in that namespace (`sh:targetClass ts:Claim`, `sh:path ts:scope`). SHACL is therefore the validation companion to the vocabulary, and the two ship together: §8.11.3 conditions the conformance of a `content/claim/v1` node on the claim payload's `@context` including exactly this URI **and** on validation against "the SHACL shapes published with" it.

The open question this most directly touches is **Q10 — OWL-ontology promotion of the typed-claims layer.** Today `ts:` is a *controlled vocabulary* (a flat set of class and property URIs with informal English definitions in §8.11.4–§8.11.5). Q10's recorded decision is "promote," but "the exact OWL axioms / class semantics are not yet fixed." This matters for a SHACL formalization in a specific, non-cosmetic way:

- **SHACL and OWL answer different questions.** OWL is for *entailment* (a reasoner infers new triples: `ts:TrendClaim rdfs:subClassOf ts:Claim` lets a reasoner conclude every `TrendClaim` *is a* `Claim`). SHACL is for *validation* under a closed-world, constraint-checking reading (does this instance carry the required properties?). The spec's requirements are overwhelmingly *constraint* requirements ("MUST carry an explicit scope," "confidence MUST reference a method," "direction is a closed enum"). These are SHACL's job, not OWL's.
- **Where promotion to OWL changes the SHACL shapes.** If Q10 promotes `ts:Claim`'s subclasses to *defined* OWL classes (e.g. `ts:TrendClaim ≡ ts:Claim ⊓ ∃ts:direction`), a SHACL processor running *with* an OWL-RL pre-materialization step would see inferred `rdf:type` triples and could validate sub-type shapes by `sh:targetClass` without the instance explicitly declaring `@type: ts:TrendClaim`. Until promotion fixes those axioms, this document targets sub-type shapes by the *explicit* `@type` the spec's worked example carries (Appendix B declares `"@type": "ts:TrendClaim"` directly). Where I rely on explicit typing rather than entailment, I flag it, because the choice is contingent on Q10.
- **`sh:class` vs. `sh:node`.** OWL-style class membership checks (`sh:class ts:Scope`) presuppose that something — either an explicit `@type` triple or an OWL reasoner — has typed the value node. The spec's instances type their nested objects explicitly (`ts:scope` values carry `"@type": "ts:Scope"`), so `sh:class` and `sh:node` both work today; under a future OWL reasoner they would also be satisfiable by entailment. I prefer `sh:node` (structural) over `sh:class` (type-membership) wherever the spec's own JSON-LD types the node, to keep the shapes robust to the still-unfixed Q10 axioms.

**Net:** SHACL is the right tool for the conformance the spec *states*; OWL promotion (Q10) would add an *entailment* layer beneath it but would not displace it. This document writes the validation layer and marks every place where its choices are contingent on the unresolved OWL axioms.

---

## 2. Namespace and prefix setup

The shapes graph and all data graphs in this document share the following prefixes. The Typed Standards vocabulary prefix `ts:` and its URI are the normative ones from §8.11.4 / §12.2; the external vocabularies are the ones §8.11.4 enumerates as *reused, not redefined* (PROV-O, OWL-Time, RDF Data Cube, Schema.org, GeoSPARQL, Dublin Core Terms). I add `tsh:` for *the shapes themselves* (the shapes are RDF resources and need their own namespace, distinct from the vocabulary they constrain) and `tsx:` for the **envelope/structural-primitive terms** — a deliberate fiction flagged in §8 below, because the spec defines the envelope as *canonical JSON*, not as an RDF vocabulary with minted property URIs.

A `@base` is declared so that the relative `type`-token IRIs the spec uses (`content/analysis/v1`, `attestation/withdraws/v1`, …) resolve to **stable absolute IRIs** under a single envelope-type namespace. This is what lets the `type` field be both an IRI (`sh:nodeKind sh:IRI`) and pattern-matchable — see §3.1 and the major-issue fix there. The base namespace is *minted by this formalization*, not by the spec (the spec's `type` is a JSON string token); §8.2 records this.

```ttl
@base            <https://typedstandards.org/ns/envelope-type/> .

@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .

# Typed Standards Claim Vocabulary — the single normative prefix (spec §8.11.4 / §12.2)
@prefix ts:      <https://typedstandards.org/ns/ts#> .

# Reused external vocabularies (spec §8.11.4, "Reused vocabularies" table)
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix qb:      <http://purl.org/linked-data/cube#> .
@prefix schema:  <https://schema.org/> .
@prefix geo:     <http://www.opengis.net/ont/geosparql#> .
@prefix time:    <http://www.w3.org/2006/time#> .
@prefix dcterms: <http://purl.org/dc/terms/> .

# Non-normative additions for THIS formalization (flagged in §8):
#   tsh: — the SHACL shapes defined in this document
#   tsx: — minted RDF property URIs for envelope/structural-primitive fields that
#          the spec defines only as canonical-JSON keys, not as RDF terms.
#   tst: — the envelope-type IRI namespace the @base above resolves type tokens into.
@prefix tsh:     <https://typedstandards.org/shapes/> .
@prefix tsx:     <https://typedstandards.org/ns/envelope#> .
@prefix tst:     <https://typedstandards.org/ns/envelope-type/> .
```

> **Honest note on `tsx:` and `tst:`.** The spec's envelope is *JSON*, canonicalized with RFC 8785 JCS and hashed — it is not an RDF graph and the spec mints no RDF property URIs for `type`, `contentHash`, `sig`, etc. To validate the envelope with SHACL at all, one must first *interpret the JSON as RDF*, which means choosing property URIs (`tsx:`) and deciding how the `type` *value* is represented. The spec's `type` value is a string token like `"content/analysis/v1"`. This formalization makes one explicit, internally-consistent choice: the `type` value is an **absolute IRI** in the `tst:` namespace (so `content/analysis/v1` becomes `https://typedstandards.org/ns/envelope-type/content/analysis/v1`), declared via `@base`. That keeps `sh:nodeKind sh:IRI` and the pattern check mutually satisfiable. None of `tsx:`, `tst:`, or `@base` is from the spec; the typed-claims layer (`ts:`) needs no such fiction — it is already RDF. §8 returns to this gap.

---

## 3. The evidence package and cryptographic envelope as shapes

This section shapes the **structural primitive** (`SignedNode`, §3.1 of the model) and the `content/analysis/v1` **evidence package** (§8.1). Everything here is *field well-formedness*: presence, datatype, cardinality, enum membership, lexical pattern. None of it verifies a hash or a signature — that is §6's honest table.

### 3.1 The cryptographic-envelope shape (`SignedNode`)

Every signed node carries the structural-primitive fields. The shape below encodes §3.1's field table and the corresponding constraints C-type-required-v01 (4.2), C-contentHash-sha256-required (4.3 C11), C-sig-algorithm (C21 — `sh:hasValue "Ed25519ph"`), C-contentCanon-uris (C20 — `sh:in` the reserved URI set), C-captureMethod-required-signed (C49). I model `nodeId` as `sh:maxCount 1` but flag it as *derived*: the spec is explicit that `nodeId ≡ envelopeHash` **by construction** and is not separately stored, so a faithful shape should *not* require it as stored data — `sh:minCount 0`.

**The `type`-as-IRI fix.** The spec's `type` value is the string token `content/analysis/v1`. Earlier drafts wrote `sh:nodeKind sh:IRI` *and* an anchored `^(content|attestation)/…` pattern *and* compared against a relative `<content/analysis/v1>` with **no `@base`** — three constraints that cannot all hold: with no base, `<content/analysis/v1>` is an invalid/relative IRI; with a base, it resolves to `https://…/content/analysis/v1`, after which `^content/…` never matches. This revision fixes it by declaring `@base` (§2) so that the `type` IRI is the **absolute** `tst:`-namespaced form, and the pattern matches the **absolute** lexical form (`^https://typedstandards\.org/ns/envelope-type/(content|attestation)/[A-Za-z]+/v[0-9]+$`). All `sh:hasValue` / `sh:in` operands for `type` are likewise the absolute `tst:` IRIs. The two constraints are now mutually satisfiable.

```ttl
tsh:SignatureEnvelopeShape
    a sh:NodeShape ;
    rdfs:label "sig — §8.3.1 SignatureEnvelope" ;
    sh:closed false ;
    sh:property [
        sh:path tsx:signature ;
        sh:datatype xsd:string ;     # base64; presence only — math is check #2 (out of band)
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "sig.signature must be present (base64 string); validity is verified out of band." ;
    ] ;
    sh:property [
        sh:path tsx:publicKey ;
        sh:datatype xsd:string ;     # base64 DER SPKI
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:algorithm ;
        sh:hasValue "Ed25519ph" ;    # C-sig-algorithm (C21): const
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "sig.algorithm MUST be the literal 'Ed25519ph' (RFC 8032 §5.1.2)." ;
    ] ;
    sh:property [
        sh:path tsx:kid ;
        sh:datatype xsd:string ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] .

tsh:ContentHashShape
    a sh:NodeShape ;
    rdfs:label "contentHash — multihash DigestSet (§8.1.1 / ADR-0008)" ;
    sh:closed false ;
    # sha256 required by default; at least one entry total. The 'at least one of
    # {sha256,sha3-256,blake3}' is expressed with sh:or; sha256 is the default-required key.
    sh:property [
        sh:path tsx:sha256 ;
        sh:datatype xsd:string ;
        sh:pattern "^[0-9a-f]{64}$" ;   # lowercase hex SHA-256; lexical form only, NOT recomputed
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "contentHash.sha256 is required by default and must be 64 lowercase hex chars." ;
    ] ;
    sh:property [
        sh:path tsx:sha3-256 ;
        sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:blake3 ;
        sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ; sh:maxCount 1 ;
    ] .

tsh:SignedNodeShape
    a sh:NodeShape ;
    rdfs:label "SignedNode — structural primitive / cryptographic envelope (§6.2, §8.1, §8.3)" ;
    sh:targetClass tsx:SignedNode ;
    sh:closed false ;

    # type — required v0.1; ABSOLUTE tst: IRI; pattern over the absolute lexical form  (C7, C8)
    sh:property [
        sh:path tsx:type ;
        sh:nodeKind sh:IRI ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:pattern "^https://typedstandards\\.org/ns/envelope-type/(content|attestation)/[A-Za-z]+/v[0-9]+$" ;
        sh:message "type MUST be a tst: IRI of form .../content/<noun>/v<N> or .../attestation/<verb>/v<N>." ;
    ] ;

    # nodeId — DERIVED (= envelope hash). Spec: not separately stored. minCount 0.  (C9)
    sh:property [
        sh:path tsx:nodeId ;
        sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
        sh:minCount 0 ; sh:maxCount 1 ;
        sh:severity sh:Info ;
        sh:message "nodeId is derived (= envelope hash by construction); presence is informational, derivation is out of band." ;
    ] ;

    # contentHash — required v0.1 (C-CONTENTHASH-V01-REQ); nested multihash shape  (C11)
    sh:property [
        sh:path tsx:contentHash ;
        sh:node tsh:ContentHashShape ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;

    # contentCanonicalization — recommended v0.1; sh:in the reserved URI set  (C20)
    sh:property [
        sh:path tsx:contentCanonicalization ;
        sh:nodeKind sh:IRI ;
        sh:maxCount 1 ;
        sh:in (
            <https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1>
            <https://typedstandards.org/canonicalization/legacy-json/v1>
        ) ;
        sh:message "contentCanonicalization, when present, MUST be a reserved rule URI (§12.3)." ;
    ] ;

    # sig — required; nested signature-envelope shape  (C21, C-sig-required)
    sh:property [
        sh:path tsx:sig ;
        sh:node tsh:SignatureEnvelopeShape ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;

    # signer — RECOMMENDED v0.1 (C-signer-recommended): 0..1; nested SignerShape
    sh:property [
        sh:path tsx:signer ;
        sh:node tsh:SignerShape ;
        sh:minCount 0 ; sh:maxCount 1 ;
        sh:severity sh:Warning ;
        sh:message "signer is RECOMMENDED in v0.1; absence is a warning, not a violation." ;
    ] ;

    # metadata — required; nested PackageMetadata
    sh:property [
        sh:path tsx:metadata ;
        sh:node tsh:PackageMetadataShape ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;

    # timestamp / rekorInclusionProof — SHOULD-level, best-effort; may persist null.
    # Modeled as 0..1 with Warning severity (presence recommended; null on failure).  (C30, C31)
    sh:property [
        sh:path tsx:timestamp ;
        sh:maxCount 1 ; sh:minCount 0 ;
        sh:severity sh:Warning ;
        sh:message "RFC 3161 timestamp SHOULD be present (best-effort); cryptographic validity is check #7, out of band." ;
    ] ;
    sh:property [
        sh:path tsx:rekorInclusionProof ;
        sh:maxCount 1 ; sh:minCount 0 ;
        sh:severity sh:Warning ;
        sh:message "Rekor inclusion proof SHOULD be present (best-effort); Merkle inclusion is check #8, out of band." ;
    ] .
```

The `tsh:SignerShape` and `tsh:PackageMetadataShape` referenced above encode §3.3 and §3.5:

```ttl
tsh:SignerShape
    a sh:NodeShape ;
    rdfs:label "signer — identity binding (§6.2 / §8.5)" ;
    sh:closed false ;
    sh:property [
        sh:path tsx:bindingTier ;
        # bindingTier is a STRING. The §8.5 ladder is INFORMATIVE prose and EXTENSIBLE, and the
        # non-GitHub tiers are explicitly not-yet-fixed (Q3). We therefore DO NOT close the value
        # set with sh:in. The spec's own data uses values beyond the §8.5 ladder ('platform' in the
        # §8.3.3 trust-registry example; 'legacy_embedded' as the §8.3.3 absence-default), so a closed
        # enum would wrongly violate conformant data. We require presence + string type only; an
        # advisory ladder-membership hint is offered at sh:Info severity below (non-violating).
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "signer.bindingTier is a required string; the §8.5 ladder is informative + extensible (Q3-open), so the value set is NOT closed." ;
    ] ;
    # Advisory, NON-VIOLATING ladder hint (sh:Info). Includes the §8.5 ladder values AND the
    # spec-attested registry values 'platform' (§8.3.3) and 'legacy_embedded' (§8.3.3). Surfaces
    # an unfamiliar tier as informational, never as a failure. No invented tokens.
    sh:property [
        sh:path tsx:bindingTier ;
        sh:severity sh:Info ;
        sh:in ( "pseudonymous" "oauth" "orcid" "did-web" "notarized" "platform" "legacy_embedded" ) ;
        sh:message "bindingTier is outside the spec-attested set {pseudonymous,oauth,orcid,did-web,notarized,platform,legacy_embedded}; permitted (ladder is extensible), surfaced as Info." ;
    ] ;
    sh:property [
        sh:path tsx:identifier ;     # provider-prefixed; cross-checked vs registry OUT OF BAND (#14)
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:displayName ;
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:verifiedAt ;
        sh:datatype xsd:dateTime ; sh:maxCount 1 ;
    ] .

tsh:PackageMetadataShape
    a sh:NodeShape ;
    rdfs:label "metadata — PackageMetadata (§8.1.2)" ;
    sh:closed false ;
    sh:property [
        sh:path tsx:schemaVersion ;
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:packageId ;     # UUID at publish; distinct from envelope hash
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:createdAt ;
        sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    # signingKeyId MUST equal envelope kid (§9.2 check #6). The cross-field EQUALITY is SHACL-SPARQL
    # (sh:equals over a path is NOT Core); see tsh:SigningKeyIdConsistencyShape in §6.2. Here: presence + type.
    sh:property [
        sh:path tsx:signingKeyId ;
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    # captureMethod — required, signed (C49). Value space is OPEN at the core (per-profile vocab);
    # the sh:in below encodes the ai-assisted-analysis profile's v0.1 vocabulary specifically (the
    # only fully-materialized profile vocabulary). For other profiles this membership does not apply
    # — §6 check #15 records the general producerProfile-driven lookup (including legacy-alias and
    # pre-v0.1 fallbacks) as conditional / not modeled here.
    sh:property [
        sh:path tsx:captureMethod ;
        sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ( "chat-flow-stream" "claude-code-jsonl-readback" "claude-code-self-report" ) ;
        sh:message "captureMethod is required and (for the ai-assisted-analysis profile) MUST be one of the three v0.1 values." ;
    ] ;
    # contentProfile / producerProfile — BOTH top-level per §8.1.1 (they appear on PackageMetadata
    # because metadata IS the top-level object carrying schemaVersion/packageId/captureMethod et al.).
    # See §8.3 ambiguity #5: the spec table places both at top level; we root them here, consistently.
    sh:property [
        sh:path tsx:contentProfile ;
        sh:datatype xsd:string ; sh:maxCount 1 ;
        sh:in ( "default" "datHere" ) ;
        sh:message "contentProfile, when present, is one of {default, datHere} (§8.1.1)." ;
    ] ;
    sh:property [
        sh:path tsx:producerProfile ;
        sh:datatype xsd:string ; sh:maxCount 1 ;
        sh:message "producerProfile, when present, is a <profile-type>/<profile-subtype> string (§8.1.1)." ;
    ] ;
    # contentType — QEC set; see §4.3 below for the set-membership + untyped-mutex shape.
    sh:property [
        sh:path tsx:contentType ;
        sh:minCount 1 ;            # ≥1 member (C-contentType-min-one)
        sh:or (
            [ sh:in ( "claim" "question" "evidence" ) ]
            [ sh:in ( "untyped" ) ]
        ) ;
        sh:message "contentType members must be drawn from {claim,question,evidence,untyped}." ;
    ] .
```

### 3.2 The `content/analysis/v1` package required-field shape

§8.1.1 lists eight required top-level fields (`metadata`, `prompt`, `queries`, `dataSources`, `cost`, `skillMetadata`, `output`, `trace`) plus conditionally-required ones (`summary` under datHere). This encodes C-PKG-REQUIRED-FIELDS (C63), C-QUERIES-EMPTY-OK / C-DATASOURCES-EMPTY-OK (C65 — arrays *present* but MAY be empty → `sh:minCount 1` on the *property*, no minimum on members), and C-PROMPT-VISIBILITY-ENUM / C-PROMPT-TEXT-CONDITIONAL (C68/C69).

> **Targeting note (corrected).** Earlier drafts targeted the analysis package with `sh:targetNode [ sh:filterShape … ]`. **`sh:filterShape` is not a real SHACL or SHACL-AF term**, and `sh:targetNode` takes an RDF term (IRI/literal), never a blank-node shape. That construct is removed entirely. The portable pattern — used in both the prose shape below and the consolidated graph — is an **implicit class target** (`sh:targetClass tsx:SignedNode`) plus an `sh:or` whose first branch is "skip unless `type` is the analysis IRI." A genuinely SHACL-AF custom target would be written `sh:target [ a sh:SPARQLTarget ; sh:select "…" ]`; we do not need it here and do not imply `sh:filterShape` exists.

```ttl
tsh:PromptShape
    a sh:NodeShape ;
    rdfs:label "prompt (§8.1.3)" ;
    sh:closed false ;
    sh:property [
        sh:path tsx:hash ;
        sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:visibility ;
        sh:in ( "full_text" "hash_only" ) ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    # text present IFF visibility == full_text; omitted IFF hash_only  (C69)
    sh:xone (
        [ sh:property [ sh:path tsx:visibility ; sh:hasValue "full_text" ] ;
          sh:property [ sh:path tsx:text ; sh:minCount 1 ; sh:datatype xsd:string ] ]
        [ sh:property [ sh:path tsx:visibility ; sh:hasValue "hash_only" ] ;
          sh:property [ sh:path tsx:text ; sh:maxCount 0 ] ]
    ) ;
    sh:message "prompt.text MUST be present iff visibility=full_text and absent iff visibility=hash_only." .

tsh:CostShape
    a sh:NodeShape ;
    rdfs:label "cost (§8.1.7) — AI/LLM-specific (Q7/Q9)" ;
    sh:closed false ;
    sh:property [ sh:path tsx:promptTokens ;     sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:completionTokens ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:totalTokens ;      sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:model ;            sh:datatype xsd:string  ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:durationMs ;       sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] .

tsh:BlobRefShape
    a sh:NodeShape ;
    rdfs:label "BlobRef (§8.1.5) — load-bearing fields ref/url/size required; contentType optional" ;
    sh:closed true ;
    sh:ignoredProperties ( rdf:type ) ;
    sh:property [
        sh:path tsx:ref ;
        sh:datatype xsd:string ;
        sh:pattern "^blob:sha256:[0-9a-f]{64}$" ;   # ref form; hash MATCH is out of band (#9)
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:url ;
        sh:nodeKind sh:IRI ; sh:pattern "^https://" ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        # contentType (MIME) — distinct from metadata.contentType QEC set. The §8.1.5 verifier MUST
        # steps load-bear ONLY ref/url/size (fetch, rehash, confirm size); contentType is shown in the
        # example object but never stated as a MUST. We therefore make it OPTIONAL (0..1), not required.
        sh:path tsx:contentType ;
        sh:datatype xsd:string ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path tsx:size ;
        sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ;
    ] .

# content/analysis/v1: implicit class target + sh:or type discriminator (portable; no sh:filterShape).
tsh:ContentAnalysisV1Shape
    a sh:NodeShape ;
    rdfs:label "content/analysis/v1 evidence package (§8.1.1)" ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        # branch 1: not an analysis node → vacuously conforms (skip)
        [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:content/analysis/v1 ] ] ]
        # branch 2: analysis node → must satisfy SignedNode + the package required fields
        [ sh:and ( tsh:SignedNodeShape ) ;
          sh:property [ sh:path tsx:prompt ;        sh:node tsh:PromptShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:cost ;          sh:node tsh:CostShape ;   sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:skillMetadata ; sh:minCount 1 ; sh:maxCount 1 ] ;
          # queries / dataSources: the ARRAY (property) is required; members MAY be zero (C65).
          sh:property [ sh:path tsx:queries ;     sh:minCount 1 ; sh:maxCount 1 ;
                        sh:message "queries array property must be present (may be empty)." ] ;
          sh:property [ sh:path tsx:dataSources ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:message "dataSources array property must be present (may be empty)." ] ;
          # output / trace: string OR BlobRef
          sh:property [ sh:path tsx:output ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:or ( [ sh:datatype xsd:string ] [ sh:node tsh:BlobRefShape ] ) ] ;
          sh:property [ sh:path tsx:trace ;  sh:minCount 1 ; sh:maxCount 1 ;
                        sh:or ( [ sh:nodeKind sh:BlankNodeOrIRI ] [ sh:node tsh:BlobRefShape ] ) ] ;
          # content/* MUST NOT carry targetNodeId  (C-content-no-target, C5)
          sh:property [ sh:path tsx:targetNodeId ; sh:maxCount 0 ;
                        sh:message "content/* nodes MUST NOT carry targetNodeId." ] ]
    ) ;
    sh:message "content/analysis/v1 required-field conformance (§8.1.1)." .
```

### 3.3 `extensions` keys and the datHere conditional fields

C-EXTENSIONS-KEYS (C73) requires reverse-DNS keys; C-SUMMARY-CONDITIONAL (C71) and C-NOTEBOOK-DATHERE-REQ (C76) make `summary` and `org.civicaitools.notebook` required *only* under `contentProfile == datHere`. Per §8.1.1 the `contentProfile` field is **top-level** (carried on the metadata object alongside `schemaVersion`, `captureMethod`, etc.); the conditional roots its discriminator there consistently. The conditional is expressible with the `sh:not`/`sh:or` "if-then" idiom: *if* `metadata.contentProfile = datHere`, *then* the field is required.

```ttl
tsh:DatHereConditionalShape
    a sh:NodeShape ;
    rdfs:label "datHere conditional requirements (§8.7.1 reqs 6,4 — C71, C76)" ;
    sh:targetClass tsx:SignedNode ;
    # if metadata.contentProfile == datHere then summary present (req 6) and notebook ext present (req 4)
    sh:or (
        [ sh:not [ sh:property [ sh:path ( tsx:metadata tsx:contentProfile ) ; sh:hasValue "datHere" ] ] ]
        [ sh:property [ sh:path tsx:summary ; sh:minCount 1 ; sh:datatype xsd:string ] ;
          sh:property [ sh:path ( tsx:extensions tsx:org.civicaitools.notebook ) ; sh:minCount 1 ] ]
    ) ;
    sh:message "Under contentProfile=datHere, summary and org.civicaitools.notebook are required (§8.7.1)." .
```

> The `provenance → execution` conditional (execution extension present iff `notebook.provenance == executed`, C-8.7.4-1..2) follows the same `sh:or(sh:not …)` two-branch idiom and appears in the consolidated graph. The `contentProfile ⟺ producerProfile` biconditional (C-profile-consistency-invariant, C55) needs *both directions* and is written as an `sh:and` of two implications there. Both `contentProfile` and `producerProfile` live on the metadata (top-level) object per §8.1.1; the biconditional roots `contentProfile` via the `( tsx:metadata tsx:contentProfile )` path and `producerProfile` via `( tsx:metadata tsx:producerProfile )` — same level, no path inconsistency.

---

## 4. The two-family taxonomy as a shape hierarchy

### 4.1 The family discriminator

The normative rule (C-family-disjoint C4; C-content-no-target C5; C-attestation-has-target C6) is: **exactly one of two families holds, consistent with the `type`-URI first segment** — `content/*` (no `targetNodeId`) xor `attestation/*` (≥1 `targetNodeId`). With `type` rendered as an absolute `tst:` IRI (§3.1), the prefix test matches the absolute lexical form. This is a textbook `sh:xone`:

```ttl
tsh:FamilyDiscriminatorShape
    a sh:NodeShape ;
    rdfs:label "Two-family taxonomy discriminator (§7.4 / C4,C5,C6)" ;
    sh:targetClass tsx:SignedNode ;
    sh:xone (
        # content/* : type IRI in the content/ subtree  AND  no targetNodeId
        [ sh:property [ sh:path tsx:type ; sh:pattern "^https://typedstandards\\.org/ns/envelope-type/content/" ] ;
          sh:property [ sh:path tsx:targetNodeId ; sh:maxCount 0 ] ]
        # attestation/* : type IRI in the attestation/ subtree  AND  >=1 targetNodeId
        [ sh:property [ sh:path tsx:type ; sh:pattern "^https://typedstandards\\.org/ns/envelope-type/attestation/" ] ;
          sh:property [ sh:path tsx:targetNodeId ; sh:minCount 1 ] ]
    ) ;
    sh:message "A node MUST be exactly one family: content/* (no targetNodeId) xor attestation/* (>=1 targetNodeId)." .
```

This catches both error modes the model lists: a `content/*` node carrying `targetNodeId` (laundering an assertion-about as a standalone assertion) and an `attestation/*` node missing it. `sh:xone` is exactly right here because the families are *disjoint* — `sh:or` would let a malformed node satisfy both branches.

### 4.2 Specialization via `sh:node` / `sh:and`, and **per-sub-type targeting** (major-issue fix)

Sub-type shapes *specialize* the structural primitive. SHACL has no class inheritance, so specialization is expressed by **conjunction**: a sub-type shape requires its focus node to satisfy `tsh:SignedNodeShape` (via `sh:and`) *and* the sub-type-specific constraints (via additional `sh:property`).

**The targeting fix.** Earlier drafts gave every `tsh:Attestation*V1Shape` and `tsh:AttestationNodeShape` a shape *body* but **no target** and **no inbound `sh:node`/`sh:and` reference** — so a SHACL processor never activated them, and §8.12.3's "MUST carry the sub-type's required payload fields" was written but never enforced. This revision activates every attestation sub-type the same portable way the analysis package is targeted: an **implicit class target** (`sh:targetClass tsx:SignedNode`) plus an `sh:or` whose first branch skips the node unless its `tsx:type` equals the sub-type's `tst:` IRI. The sub-type's required-payload `sh:property` constraints then *do* fire for matching nodes. The base `tsh:AttestationNodeShape` is likewise targeted on the whole `attestation/*` subtree by `type` pattern, so `targetNodeId` presence is enforced for every attestation node.

```ttl
# attestation/* BASE — activated for any node whose type is in the attestation/ subtree.
tsh:AttestationNodeShape
    a sh:NodeShape ;
    rdfs:label "attestation/* base (§8.12.3)" ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path tsx:type ;
                    sh:pattern "^https://typedstandards\\.org/ns/envelope-type/attestation/" ] ] ]
        [ sh:and ( tsh:SignedNodeShape ) ;             # inherits envelope structural primitive
          sh:property [
              sh:path tsx:targetNodeId ;
              sh:minCount 1 ;                          # ≥1 (C6); some sub-types carry >1 (no maxCount at base)
              sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
              sh:message "attestation/* MUST carry >=1 targetNodeId." ] ]
    ) ;
    sh:message "attestation/* base: envelope + >=1 targetNodeId (§8.12.3)." .

# Worked sub-type: withdraws — publisher-only; reason required non-empty; effectiveAt optional.
# Activated only for nodes whose type IS attestation/withdraws/v1.
tsh:AttestationWithdrawsV1Shape
    a sh:NodeShape ;
    rdfs:label "attestation/withdraws/v1 (§8.12.1)" ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/withdraws/v1 ] ] ]
        [ sh:and ( tsh:AttestationNodeShape ) ;
          sh:property [ sh:path tsx:reason ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:minLength 1 ;                # C-WITHDRAWS-REASON: non-empty
                        sh:message "withdraws.reason is required and non-empty (minLength 1)." ] ;
          sh:property [ sh:path tsx:effectiveAt ; sh:datatype xsd:dateTime ; sh:maxCount 1 ] ]   # defaults to envelope timestamp
    ) .

# Worked sub-type: locatedAt — any-with-binding; uri + contentHash required (§8.12.1).
# The 'contentHash SHOULD match target's; mismatch is informative' note is a CROSS-NODE Info check
# (out of band; SHACL cannot compare to the target). The PRESENCE of contentHash stays a Violation-
# severity required field — severity Info is NOT placed on the presence constraint (issue fix).
tsh:AttestationLocatedAtV1Shape
    a sh:NodeShape ;
    rdfs:label "attestation/locatedAt/v1 (§8.12.1)" ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/locatedAt/v1 ] ] ]
        [ sh:and ( tsh:AttestationNodeShape ) ;
          sh:property [ sh:path tsx:uri ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:contentHash ; sh:node tsh:ContentHashShape ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:message "locatedAt.contentHash is required and must be a well-formed multihash (§8.12.1)." ] ;
          sh:property [ sh:path tsx:contentLength ; sh:datatype xsd:integer ; sh:maxCount 1 ] ;    # optional
          sh:property [ sh:path tsx:availability ; sh:maxCount 1 ] ]                                # optional; enum unspecified (§8)
    ) .
    # NOTE: the 'contentHash SHOULD match the target node's contentHash; mismatch = informative content
    # drift' semantics is a CROSS-NODE comparison → out of band (the target may not be in the graph).
    # It is documented as §6-adjacent (cross-node), NOT encoded as an Info severity on the presence constraint.

# Worked sub-type: wasDerivedFrom — derivationMethod required; classification-laundering guard CONDITIONAL.
tsh:AttestationWasDerivedFromV1Shape
    a sh:NodeShape ;
    rdfs:label "attestation/wasDerivedFrom/v1 (§8.12.1)" ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/wasDerivedFrom/v1 ] ] ]
        [ sh:and ( tsh:AttestationNodeShape ) ;
          sh:property [ sh:path tsx:derivationMethod ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:message "wasDerivedFrom MUST carry derivationMethod." ] ]
    ) .
    # The conditional 'when source is content/analysis/v1 untyped AND target is typed, derivationMethod
    # MUST carry a ts:AnalyticalDerivation' (refinement (a), §8.12.1) requires resolving BOTH referenced
    # nodes → SHACL-SPARQL tier, not Core. See §6 check #10 / §8.2.
```

> The remaining attestation sub-types follow the identical *implicit-class-target + `sh:or` type discriminator + `sh:and ( tsh:AttestationNodeShape )`* pattern, with each sub-type's required payload fields from the §8.12.1 table. They are all written out in the consolidated graph and are now genuinely **activated** (no longer dead shapes). Several payload fields the spec names but does not type (`scope`, `availability`, `certificationScheme`, `validityWindow`, `methodology`, `scoringRubric`, `results`, `standardId`) are shaped as *presence-only* (`sh:minCount 1`, no `sh:datatype`) and the datatype gap is flagged in §8 rather than invented.

### 4.3 The QEC sub-ontology

The QEC set (§7.5) lives on `metadata.contentType`. Two constraints: ≥1 member from `{claim,question,evidence,untyped}` (C60), and `untyped` mutually exclusive with the typed values (C59). The membership is a per-value `sh:in`; the mutex is an `sh:not`-of-co-occurrence. SHACL's set-validation reads each member of the multi-valued property as a separate value of the path, so the mutex is "*not* (`untyped` present *and* any typed value present)":

```ttl
tsh:QecContentTypeShape
    a sh:NodeShape ;
    rdfs:label "QEC contentType set (§7.5 / C59,C60)" ;
    sh:targetObjectsOf tsx:metadata ;     # focus = the metadata object
    sh:property [
        sh:path tsx:contentType ;
        sh:minCount 1 ;                                       # C60: >=1 member
        sh:or ( [ sh:in ( "claim" "question" "evidence" ) ]
                [ sh:in ( "untyped" ) ] ) ;                   # each member in the vocabulary
    ] ;
    # untyped-mutex (C59): NOT( has untyped  AND  has any typed )
    sh:not [
        sh:and (
            [ sh:property [ sh:path tsx:contentType ; sh:hasValue "untyped" ] ]
            [ sh:property [ sh:path tsx:contentType ;
                            sh:qualifiedValueShape [ sh:in ( "claim" "question" "evidence" ) ] ;
                            sh:qualifiedMinCount 1 ] ]
        )
    ] ;
    sh:message "contentType must be non-empty; 'untyped' is mutually exclusive with claim/question/evidence." .
```

The reserved typed sub-types `content/claim/v1`, `content/question/v1`, `content/evidence/v1` are *name-only* in v0.1 (Q5); only `content/claim/v1`'s payload is specified (§8.11). `content/question/v1` and `content/evidence/v1` payloads are **reserved but undefined** in the spec — §8 below records that no faithful shape can be written for them because the spec defines no fields.

---

## 5. The typed-claims layer (§8.11) as shapes

This is the layer SHACL is *prescribed* for. The shapes encode the §8.11.4 core `ts:Claim` required/optional properties, the §8.11.5 sub-type additions, the §8.11.3 five conformance conditions (those that are graph-checkable), and the closed enums TC-C13/TC-C14.

> **Numeric-datatype note (major-issue fix).** Appendix B is JSON-LD whose `@context` declares **no datatype coercion** for `ts:level`, `ts:lowerBound`, `ts:upperBound`, `ts:percentChange`. Under JSON-LD 1.1, a fractional JSON number (`0.95`, `23.0`) parses to **`xsd:double`**, and a bare integer (`1842`, the `byteRange` members) parses to **`xsd:integer`** — *not* `xsd:decimal`. A shape that hard-required `xsd:decimal` would therefore **violate Appendix B once parsed through its own `@context`**, contradicting any "conforms = true" claim. This revision widens every fractional-number constraint to accept the numeric literal types JSON-LD actually produces, via `sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] )`. (Hand-written Turtle that writes a bare `0.95` yields `xsd:decimal`; the `sh:or` accepts both round-trips, so the worked example in §7 conforms whether sourced from Turtle or from the Appendix-B JSON-LD parse.) See §7.1 for the explicit reconciliation.

### 5.1 `ts:Claim` base shape

Required (§8.11.4): `dcterms:identifier` (unique within package — TC-C2/C-uniqueness), `ts:subject` (exactly one URI — TC-C19), `ts:scope` (explicit — TC-C3/R6), `ts:confidence` (method-derived — TC-C4/R3), `prov:wasDerivedFrom` (≥1 — TC-C7), `ts:derivedVia` (TC-C8). Optional: `dcterms:description` (required when confidence method is `ts:NotApplicable` — TC-C6), `ts:contradicts`/`ts:corroborates`/`ts:supersedes`/`ts:limitations`.

```ttl
tsh:ClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:Claim base (§8.11.4)" ;
    sh:targetClass ts:Claim ;       # also matched by entailment for subclasses if OWL-RL runs (Q10)
    sh:closed false ;

    sh:property [
        sh:path dcterms:identifier ;
        sh:datatype xsd:string ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "Every claim MUST carry a dcterms:identifier (stable, unique within package)." ;
    ] ;
    sh:property [
        sh:path ts:subject ;
        sh:nodeKind sh:BlankNodeOrIRI ;     # 'a metric/indicator/observable' — IRI or typed node
        sh:minCount 1 ; sh:maxCount 1 ;     # TC-C19: exactly one  (see §8.3 #1 — Appendix-B subject/metric gap)
        sh:message "ts:subject MUST be exactly one URI/node." ;
    ] ;
    sh:property [
        sh:path ts:scope ;
        sh:node tsh:ScopeShape ;
        sh:minCount 1 ; sh:maxCount 1 ;     # TC-C3: explicit scope required (no implicit scope)
        sh:message "Every claim MUST have an explicit ts:Scope (implicit scope is non-conforming)." ;
    ] ;
    sh:property [
        sh:path ts:confidence ;
        sh:node tsh:ConfidenceStatementShape ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path prov:wasDerivedFrom ;
        sh:nodeKind sh:BlankNodeOrIRI ;
        sh:minCount 1 ;                     # TC-C7: at least one entity
        sh:message "Every claim MUST cite >=1 prov:wasDerivedFrom entity from the source provenance graph." ;
    ] ;
    sh:property [
        sh:path ts:derivedVia ;
        sh:node tsh:AnalyticalDerivationShape ;
        sh:minCount 1 ; sh:maxCount 1 ;     # TC-C8: link to the extraction step
    ] ;
    # description required IFF confidence method is ts:NotApplicable (TC-C6).  if-then via sh:or(sh:not)
    sh:or (
        [ sh:not [ sh:property [ sh:path ( ts:confidence ts:method ) ; sh:hasValue ts:NotApplicable ] ] ]
        [ sh:property [ sh:path dcterms:description ; sh:minCount 1 ; sh:datatype xsd:string ] ]
    ) ;
    # optional, typed when present
    sh:property [ sh:path dcterms:description ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:contradicts ; sh:nodeKind sh:IRI ] ;
    sh:property [ sh:path ts:corroborates ; sh:nodeKind sh:IRI ] ;
    sh:property [ sh:path ts:supersedes ; sh:nodeKind sh:IRI ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:limitations ; sh:datatype xsd:string ; sh:maxCount 1 ] .
```

> **dcterms:identifier uniqueness (TC-C2).** "Unique within the package" is a *uniqueness-across-focus-nodes* constraint, not a per-node one. SHACL Core cannot express "no two claims share an identifier" with `sh:NodeShape` property constraints alone — it needs a SHACL-SPARQL constraint. §6 marks this as SHACL-*SPARQL*-expressible, not SHACL-Core.

### 5.2 Scope, confidence, derivation, magnitude

> **Scope nullability and Q14 (minor-issue fix).** The §8.11.7 implicit-scope prohibition supports requiring `ts:scope` *to be present*. But the *per-component* mandatoriness — whether **both** `ts:geographicScope` and `ts:temporalScope` must always be present, and whether a `time:Interval` must carry **both** endpoints — is the subject of **open question Q14 (geographic-and-temporal-scope nullability)**, which the spec cites in §8.11.4. OWL-Time intervals do not require both endpoints. This revision therefore relaxes those four `sh:minCount 1` constraints to **`sh:Warning` severity** and flags them as **Q14-contingent**, rather than asserting a hard `sh:Violation` the spec cannot yet justify. (When Q14 resolves to "stay required, document why," these revert to `sh:Violation`.)

```ttl
tsh:ScopeShape
    a sh:NodeShape ;
    rdfs:label "ts:Scope (§8.11.4) — per-component cardinality contingent on Q14" ;
    sh:closed false ;
    sh:property [
        sh:path ts:geographicScope ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:severity sh:Warning ;            # Q14-contingent: presence of the geographic component is not yet fixed
        sh:node tsh:GeographicScopeShape ;
        sh:message "ts:geographicScope expected (Q14-contingent; Warning until scope-nullability resolves)." ;
    ] ;
    sh:property [
        sh:path ts:temporalScope ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:severity sh:Warning ;            # Q14-contingent
        sh:node tsh:TemporalIntervalShape ;
        sh:message "ts:temporalScope expected (Q14-contingent; Warning until scope-nullability resolves)." ;
    ] .

tsh:GeographicScopeShape
    a sh:NodeShape ;
    rdfs:label "ts:GeographicScope + civic subtype taxonomy (§8.11.4)" ;
    sh:closed false ;
    # base type fields are all 0..1; geo:hasGeometry required ONLY when using the base type for
    # arbitrary geometry (TC-C23) — conditional, not encodable without knowing @type; presence-optional.
    sh:property [ sh:path dcterms:identifier ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
    sh:property [ sh:path schema:name ; sh:maxCount 1 ] ;
    sh:property [ sh:path geo:hasGeometry ; sh:maxCount 1 ] .

tsh:TemporalIntervalShape
    a sh:NodeShape ;
    rdfs:label "time:Interval (OWL-Time, reused directly §8.11.4) — endpoints Q14-contingent" ;
    sh:closed false ;
    sh:property [ sh:path time:hasBeginning ; sh:minCount 1 ; sh:maxCount 1 ; sh:severity sh:Warning ;
                  sh:message "time:hasBeginning expected (Q14-contingent; OWL-Time does not require both endpoints)." ] ;
    sh:property [ sh:path time:hasEnd ; sh:minCount 1 ; sh:maxCount 1 ; sh:severity sh:Warning ;
                  sh:message "time:hasEnd expected (Q14-contingent; OWL-Time does not require both endpoints)." ] .

tsh:ConfidenceStatementShape
    a sh:NodeShape ;
    rdfs:label "ts:ConfidenceStatement (§8.11.4)" ;
    sh:closed false ;
    sh:property [
        sh:path ts:method ;
        sh:minCount 1 ; sh:maxCount 1 ;
        # starter set is extensible (domain methods allowed), so sh:in would be WRONG here:
        # the spec says new methods MUST be method-derived, NOT that the value set is closed.
        # We require the property be an IRI; closed enum would distort the spec (see §8).
        sh:nodeKind sh:IRI ;
        sh:message "ts:confidence MUST reference a method (an IRI); free-form high/medium/low is non-conforming." ;
    ] ;
    # level/lowerBound/upperBound are fractional numbers. JSON-LD 1.1 parses them as xsd:double
    # (no coercion in Appendix B's @context); hand-written Turtle yields xsd:decimal. Accept BOTH.
    sh:property [ sh:path ts:level ;      sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:lowerBound ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:upperBound ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:methodReference ; sh:maxCount 1 ] .   # resolution to trace.json is OUT OF BAND

tsh:AnalyticalDerivationShape
    a sh:NodeShape ;
    rdfs:label "ts:AnalyticalDerivation (§8.11.4)" ;
    sh:closed false ;
    sh:property [ sh:path ts:traceReference ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:translationModel ; sh:minCount 1 ; sh:maxCount 1 ] ;   # schema:SoftwareApplication
    sh:property [ sh:path ts:translationPrompt ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [
        sh:path ts:sourceOutputSpan ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:node tsh:SourceOutputSpanShape ;
    ] .

tsh:SourceOutputSpanShape
    a sh:NodeShape ;
    rdfs:label "ts:sourceOutputSpan {ts:outputFile, ts:byteRange}" ;
    sh:closed false ;
    sh:property [ sh:path ts:outputFile ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [
        sh:path ts:byteRange ;
        sh:datatype xsd:integer ;
        sh:minCount 2 ; sh:maxCount 2 ;     # exactly 2 integers [start,end]
        sh:message "ts:byteRange MUST be exactly two integers [start,end]." ;
    ] .
    # HONEST CAVEAT: RDF multiset semantics LOSE the [start,end] ORDERING the spec's array implies.
    # This shape enforces 'exactly two integers' but CANNOT enforce start<=end or which value is start.
    # Enforcing order would require an rdf:List with sh:order (an ordered-list shape) or a SHACL-SPARQL
    # check. Left as a known Core limitation (see §8.2).

tsh:MagnitudeShape
    a sh:NodeShape ;
    rdfs:label "ts:Magnitude (UNDER-SPECIFIED — see §8)" ;
    sh:closed false ;
    # Spec names absolute/percent only via the example (ts:percentChange, ts:absoluteChange).
    # No required fields stated. We DO NOT invent minCounts; presence-optional, typed-if-present.
    # percentChange is a fractional number → accept xsd:decimal OR xsd:double (JSON-LD parse, see §5 note).
    sh:property [ sh:path ts:percentChange ;  sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:absoluteChange ; sh:maxCount 1 ] .
```

### 5.3 The six concrete claim subclasses

Each adds its required properties (§8.11.5) on top of `tsh:ClaimShape` via `sh:and`. The two closed enums — `ts:direction` (TC-C13) and `ts:relation` (TC-C14) — use `sh:in`; the open enums (`ts:relationshipType`, `ts:groundingMethod`) use `sh:nodeKind sh:IRI` *without* `sh:in`, because the spec explicitly marks them open.

```ttl
tsh:TrendClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:TrendClaim (§8.11.5)" ;
    sh:targetClass ts:TrendClaim ;
    sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metric ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:BlankNodeOrIRI ] ;
    sh:property [ sh:path ts:baselinePeriod ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:TemporalIntervalShape ] ;
    sh:property [ sh:path ts:comparisonPeriod ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:TemporalIntervalShape ] ;
    sh:property [
        sh:path ts:direction ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ( ts:Increase ts:Decrease ts:NoSignificantChange ) ;     # CLOSED enum (TC-C13)
        sh:message "ts:direction MUST be one of {ts:Increase, ts:Decrease, ts:NoSignificantChange}." ;
    ] ;
    sh:property [ sh:path ts:magnitude ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:MagnitudeShape ] .

tsh:ComparisonClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:ComparisonClaim (§8.11.5)" ;
    sh:targetClass ts:ComparisonClaim ;
    sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metric ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:scopeA ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:ScopeShape ] ;
    sh:property [ sh:path ts:scopeB ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:ScopeShape ] ;
    sh:property [
        sh:path ts:relation ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ( ts:GreaterThan ts:LessThan ts:ApproximatelyEqual ) ;   # CLOSED enum (TC-C14)
    ] ;
    sh:property [ sh:path ts:magnitude ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:MagnitudeShape ] .

tsh:ObservationClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:ObservationClaim (§8.11.5) — maps onto qb:Observation (TC-C20)" ;
    sh:targetClass ts:ObservationClaim ;
    sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metric ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:value ; sh:minCount 1 ; sh:maxCount 1 ] ;     # numeric OR qb:Observation
    sh:property [ sh:path ts:unit ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:IRI ] .   # QUDT/UCUM

tsh:CompositionClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:CompositionClaim (§8.11.5)" ;
    sh:targetClass ts:CompositionClaim ;
    sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:whole ; sh:minCount 1 ; sh:maxCount 1 ; sh:node tsh:ScopeShape ] ;
    sh:property [ sh:path ts:components ; sh:minCount 1 ] ;                 # ts:Component[]
    sh:property [ sh:path ts:totalsTo ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] .   # fractional → accept both
    # NOTE: spec does NOT mandate components sum to ts:totalsTo — no sum constraint written (see §8).

tsh:RelationshipClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:RelationshipClaim (§8.11.5) — NOT causal (TC-C22)" ;
    sh:targetClass ts:RelationshipClaim ;
    sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metricA ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:metricB ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:relationshipType ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:IRI ] ;  # OPEN enum
    sh:property [ sh:path ts:strength ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] .   # fractional → accept both

tsh:QualitativeClaimShape
    a sh:NodeShape ;
    rdfs:label "ts:QualitativeClaim (§8.11.5) — permitted, flagged" ;
    sh:targetClass ts:QualitativeClaim ;
    sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:assertion ; sh:minCount 1 ; sh:maxCount 1 ; sh:datatype xsd:string ] ;
    sh:property [ sh:path ts:groundingMethod ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:IRI ] .   # OPEN enum
    # ts:confidence MAY be ts:NotApplicable (with required description) — inherited from ClaimShape's
    # description-iff-NotApplicable rule.
```

### 5.4 The JSON-LD wrapper and `@context` membership

§8.11.3 condition 2 requires the claim payload's `@context` to include `https://typedstandards.org/ns/ts#` (TC-C18). Once the JSON-LD is parsed to RDF, the `@context` is *consumed* (it produces the namespace expansions, not a triple). So `@context` membership is checkable **only before/at parse time**, not on the resulting RDF graph — a JSON-LD-framing concern, not a SHACL one. The model marks this precisely: "`@context` membership is checkable once parsed." I encode the *consequence* — that claim properties resolve under the `ts:` namespace — which the targeting on `ts:Claim`/`ts:TrendClaim` already enforces structurally. The literal `@context` array check is flagged as out-of-band JSON-LD validation in §6.

---

## 6. The §9.2 verification check list rendered as SHACL — and the honest gaps

The §9.2 sequence is 15 numbered checks plus the additional structural validations the model lists in §6.1. The table below states, for each, whether it is expressible in **SHACL-Core**, **SHACL-SPARQL** (computable in-graph via a SPARQL constraint but beyond Core), or **out-of-band** (requires crypto / network / cross-graph-join the SHACL processor cannot perform), and what is needed instead.

| # | Check | Expressible in SHACL? | What SHACL can do / what's needed instead |
|---|---|---|---|
| 1 | **Envelope integrity** (recompute envelope hash over JCS bytes; compare to reported) | **No (out of band)** | SHA-256 of RFC 8785 JCS canonicalization. Not a graph operation. SHACL can assert a `nodeId`/hash *field is well-formed hex*; it cannot recompute or compare. **Needs:** out-of-band canonicalize+hash. |
| 2 | **Signature mathematics** (Ed25519ph over the envelope-hash hex string) | **No (out of band)** | Digital-signature verification. No SHACL construct evaluates a signature. SHACL validates `sig.algorithm = "Ed25519ph"`, presence of `publicKey`/`kid`. **Needs:** out-of-band Ed25519ph verify. |
| 3 | **Content canonicalization rule resolution** (`contentCanonicalization` ∈ known rules) | **SHACL-Core (membership only)** | `sh:in` over the reserved rule URIs (done in `tsh:SignedNodeShape`). The *live-registry resolution* of the rule is out of band, but the **membership** check is pure graph. Unknown URI → `sh:Violation` (or `unknown_canonicalization_rule`). |
| 4 | **Content hash verification** (apply rule to off-log content; ≥1 digest matches) | **No (out of band)** | Multihash recomputation over off-log bytes. SHACL validates the digest-set *shape* (`tsh:ContentHashShape`), not the match. **Needs:** out-of-band hash. |
| 5 | **Trust-registry verdict** (look up `(kid,publicKey)`; apply active/deprecated/revoked + temporal) | **No (cross-graph join → out of band; partial SHACL-SPARQL if registry loaded)** | Requires joining against the `.well-known` registry resource (not in the data graph) + temporal comparison vs signing time. If the registry were *loaded into the data graph*, the `(kid,publicKey)` match and status read become SHACL-SPARQL-expressible; the live fetch and as-of-signing-time logic are not Core. **Needs:** registry fetch + temporal logic. |
| 6 | **`signingKeyId` consistency** (`sig.kid == metadata.signingKeyId`) | **SHACL-SPARQL** | `sh:equals` takes a *predicate*, NOT a path; the two values sit at the ends of two sequence paths, so this is **not Core**. Expressed as a `sh:sparql` ASK/SELECT comparison (`tsh:SigningKeyIdConsistencyShape`, §6.2), or, with JSON-LD framing lifting both to direct properties, as Core `sh:equals` over predicates. **Intra-graph, but SPARQL-tier as written.** |
| 7 | **Timestamp validity** (RFC 3161 token; X.509 chain to pinned FreeTSA root) | **No (out of band)** | Cert-chain walking + token signature. SHACL validates the token *field is present*. **Needs:** out-of-band X.509 validation. |
| 8 | **Transparency-log inclusion** (RFC 6962 Merkle inclusion vs pinned Rekor key) | **No (out of band)** | Merkle-proof verification. SHACL validates the Rekor entry *field is present*. **Needs:** out-of-band RFC 6962 verify. |
| 9 | **BlobRef integrity** (fetch HTTPS; recompute SHA-256; confirm size) | **No (out of band)** | Network fetch + hash. SHACL validates BlobRef *shape* (`tsh:BlobRefShape`: `ref` pattern, `url`, `size` required; `contentType` optional). **Needs:** out-of-band fetch+hash. |
| 10 | **Lifecycle state** (chain of signer-matched lifecycle attestations; verify each sig+timestamp) | **Mixed (SHACL-SPARQL + out of band)** | **SHACL-able (Core):** each lifecycle node is `attestation/{withdraws,reinstates,supersedes,publishes}/v1` (now actually targeted, §4.2). **SHACL-SPARQL:** `targetNodeId`→nodeId reference resolution across a loaded graph, signer-matching by `signer.identifier` equality across nodes, `priorWithdrawalNodeId` pointing at a withdrawal of the same target, and *envelope-timestamp ordering* (`ORDER BY`). **Out of band:** per-attestation *signature*+*timestamp* verification (checks 2/7 again). **Needs:** out-of-band per-node crypto; SPARQL for ordering/joins. |
| 11 | **captureMethod label** (read `metadata.captureMethod`; render) | **SHACL-Core** | Field read/presence. `tsh:PackageMetadataShape` requires it and enforces the ai-assisted-analysis `sh:in`. Integrity comes from check #2; *reading* the label is a graph op. |
| 12 | **`type` resolution** (known v0.1 sub-type; unknown → `unknown_type`, **non-fatal**) | **SHACL-Core** | `sh:pattern` (absolute `tst:` form) + (optionally) `sh:in` over the known sub-type IRIs. Non-fatal outcome modeled as `sh:severity sh:Warning`/`sh:Info` rather than `sh:Violation`. |
| 13 | **nodeId cross-check** (recompute envelope hash; a referencing `targetNodeId` resolves here) | **Mixed (SHACL-SPARQL + out of band)** | **SHACL-SPARQL:** `targetNodeId` *resolving to a known node's nodeId* within a loaded graph (reference resolution is a join). **Out of band:** the *authoritative nodeId derivation* (envelope-hash recompute). Unresolvable → `unknown_target_node` (**non-fatal**). |
| 14 | **signer ↔ kid cross-check** (`signer.identifier` == registry `signerIdentity.identifier` for the kid) | **No (cross-graph join → out of band)** | The *intra-package* half (`signer.identifier` present) is Core; the *registry lookup* is not pure graph. Mismatch → `signer_identity_mismatch` + **REJECT**. **Needs:** registry join. |
| 15 | **captureMethod per-profile vocabulary conformance** (resolve producerProfile bundle; `captureMethod` ∈ vocab) | **SHACL-Core, conditionally** | `sh:in` membership **iff the profile vocabulary is materialized in the shapes graph** (it is, for ai-assisted-analysis, in `tsh:PackageMetadataShape`). The general `producerProfile`-driven lookup — including the legacy-alias and pre-v0.1 `ai-assisted-analysis` fallbacks (§8.6 steps 1–2) and the `producerProfile_bundle_unresolved` graceful-degrade branch — requires out-of-band rule-registry resolution and is **not modeled** here. |

**Summary.** Of the 15 numbered checks, **4 are cleanly SHACL-Core** (#3 membership, #11, #12, and the intra-package half of #14), **1 more is SHACL-Core conditionally** (#15, for the materialized ai-assisted-analysis vocab only), **1 is SHACL-SPARQL** (#6, the `signingKeyId` equality, NOT Core), **2 are mixed SHACL-SPARQL + out-of-band** (#10, #13 — structure/joins at the SPARQL tier, crypto not expressible), and the remainder are **out-of-band** (#1, #2, #4, #5, #7, #8, #9, and the registry half of #14). The out-of-band set is exactly the cryptographic and cross-graph-join checks: **hashing, signing, timestamping, Rekor inclusion, trust-registry resolution.** This is the precise boundary the spec's own §9.3 ("what a verifier cannot check today") and §5.1 preamble draw — SHACL formalizes the *shape* of a conformant node, and the crypto verifier formalizes its *integrity*. Neither subsumes the other.

### 6.1 The cleanly-SHACL structural validations

The model's §6.1 lists pure-graph-shape validations layered alongside §9.2; every one is already encoded above or in the consolidated graph: family membership (`tsh:FamilyDiscriminatorShape`), QEC set (`tsh:QecContentTypeShape`), profile consistency (`tsh:ProfileConsistencyShape`, consolidated graph), required structural fields (`tsh:SignedNodeShape`), `targetNodeId` rule (in the family discriminator + `tsh:ContentAnalysisV1Shape`), `type`-IRI pattern, BlobRef shape (`tsh:BlobRefShape`), prompt visibility (`tsh:PromptShape`), extensions reverse-DNS keys, datHere presence reqs (`tsh:DatHereConditionalShape`), provenance→execution conditional, attestation-entry sub-type discriminators (now actually targeted, §4.2), CommitmentView field set, and typed-claim shape validation (§5). Reference-resolution within a loaded graph (`nodeId` ↔ `targetNodeId`) is a join and sits at the SHACL-SPARQL tier (see #10/#13), not Core.

### 6.2 The intra-graph `signingKeyId` consistency check (#6) — SHACL-SPARQL, not Core

Check #6 (`sig.kid == metadata.signingKeyId`) is an intra-graph equality, but it compares the values at the ends of **two sequence paths** (`sig → kid` and `metadata → signingKeyId`). SHACL-Core's `sh:equals` takes a **single predicate IRI**, not a property path — a sequence-path operand is **not valid Core** and most processors reject it. So this check is expressed at the **SHACL-SPARQL tier**, with a `sh:sparql` constraint, and is labeled as such (it is *not* in the Core block of the consolidated graph):

```ttl
# SHACL-SPARQL TIER (NOT SHACL-Core). Isolated from the Core block in the consolidated graph.
tsh:SigningKeyIdConsistencyShape
    a sh:NodeShape ;
    rdfs:label "§9.2 check #6 — sig.kid == metadata.signingKeyId (C26) — SHACL-SPARQL" ;
    sh:targetClass tsx:SignedNode ;
    sh:sparql [
        a sh:SPARQLConstraint ;
        sh:message "metadata.signingKeyId MUST equal sig.kid (envelope-vs-canonical drift = envelope swap)." ;
        sh:select """
            PREFIX tsx: <https://typedstandards.org/ns/envelope#>
            SELECT $this ?signingKeyId ?kid
            WHERE {
                $this tsx:metadata/tsx:signingKeyId ?signingKeyId .
                $this tsx:sig/tsx:kid              ?kid .
                FILTER (str(?signingKeyId) != str(?kid))
            }
        """ ;
    ] .
```

> **Why SPARQL, not Core.** The portable Core alternative is to *lift* `kid` and `signingKeyId` to direct properties of the focus node first (a JSON-LD framing choice) and then use `sh:equals` over those two **predicates**. That works but pushes the burden onto the framing step. The honest classification is: as written against the natural envelope graph, #6 is **SHACL-SPARQL**. Earlier drafts placed an `sh:equals ( tsx:sig tsx:kid )` sequence-path construct inside the "loadable Core" graph; that is invalid Core and is removed. The Core consolidated block no longer contains it; this SPARQL shape lives in the clearly-labeled SHACL-SPARQL section.

---

## 7. Worked example: the Appendix B typed claim as RDF

### 7.1 The valid instance (Appendix B, as Turtle)

Appendix B is a `ts:TrendClaim` for noise complaints in Bushwick North, 2024 vs 2025, given as JSON-LD. Below is the byte-faithful RDF translation (the JSON-LD `@graph` member, expanded against the `ts:` context). It carries every required `ts:Claim` property and every `ts:TrendClaim` addition.

> **Datatype reconciliation (read with §5's numeric note).** Appendix B's `@context` declares no coercion, so its `ts:level`/`ts:percentChange` etc. parse as `xsd:double`. The Turtle below writes them as bare decimals (`0.95`, `23.0`), which Turtle types as `xsd:decimal`. Because the shapes accept **both** via `sh:or ( [sh:datatype xsd:decimal] [sh:datatype xsd:double] )`, the instance conforms **whether sourced from the Appendix-B JSON-LD parse (`xsd:double`) or from this hand-written Turtle (`xsd:decimal`)**. This is the fix for the earlier overstated conforms-claim, which silently relied on the Turtle parse.

```ttl
@prefix ts:      <https://typedstandards.org/ns/ts#> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix schema:  <https://schema.org/> .
@prefix time:    <http://www.w3.org/2006/time#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:      <https://example.gov/datasets/311/> .

<claim-001>
    a ts:TrendClaim ;
    dcterms:identifier "claim-001" ;
    dcterms:description "Noise complaints rose materially in Bushwick North between 2024 and 2025." ;
    ts:metric [
        a schema:Thing ;
        schema:name "311 noise complaint count"
    ] ;          # @id ex:complaint-count in JSON-LD; modeled as the metric node
    ts:subject ex:complaint-count ;     # the claim's subject metric (see §7.3 / §8.3 #1 note)
    ts:scope [
        a ts:Scope ;
        ts:geographicScope [
            a ts:NeighborhoodTabulationArea ;
            dcterms:identifier "BK0801" ;
            schema:name "Bushwick North"
        ] ;
        ts:temporalScope [
            a time:Interval ;
            time:hasBeginning [ time:inXSDDate "2024-01-01"^^xsd:date ] ;
            time:hasEnd       [ time:inXSDDate "2025-12-31"^^xsd:date ]
        ]
    ] ;
    ts:baselinePeriod [
        a time:Interval ;
        time:hasBeginning [ time:inXSDDate "2024-01-01"^^xsd:date ] ;
        time:hasEnd       [ time:inXSDDate "2024-12-31"^^xsd:date ]
    ] ;
    ts:comparisonPeriod [
        a time:Interval ;
        time:hasBeginning [ time:inXSDDate "2025-01-01"^^xsd:date ] ;
        time:hasEnd       [ time:inXSDDate "2025-12-31"^^xsd:date ]
    ] ;
    ts:direction ts:Increase ;
    ts:magnitude [
        a ts:Magnitude ;
        ts:percentChange  23.0 ;
        ts:absoluteChange 1842
    ] ;
    ts:confidence [
        a ts:ConfidenceStatement ;
        ts:method ts:FrequentistInterval ;
        ts:level      0.95 ;
        ts:lowerBound 18.4 ;
        ts:upperBound 27.6 ;
        ts:methodReference "trace.json#step-stat-test-3"
    ] ;
    prov:wasDerivedFrom <source-analysis-nodeId#query-result-2> ;
    ts:derivedVia [
        a ts:AnalyticalDerivation ;
        ts:traceReference "trace.json#step-claim-extraction-1" ;
        ts:translationModel [
            a schema:SoftwareApplication ;
            schema:name "claude-opus-4-7"
        ] ;
        ts:translationPrompt <prompt.json#claim-extraction> ;
        ts:sourceOutputSpan [
            ts:outputFile "output.md" ;
            ts:byteRange 1240, 1487
        ]
    ] ;
    ts:limitations "Excludes complaints recorded against addresses without geocoded NTA assignment (~3.1% of records)." .
```

**Validation against the §5 shapes — conformance report:** Running `tsh:TrendClaimShape` (which `sh:and`s `tsh:ClaimShape`) over this instance produces **`sh:conforms = true`**:

- `tsh:ClaimShape`: `dcterms:identifier` present (1), `ts:subject` present (1 IRI), `ts:scope` validates `tsh:ScopeShape` (both `ts:geographicScope` and `ts:temporalScope` present — and even if a component were absent, those are now Q14-contingent `sh:Warning`, not `sh:Violation`), `ts:confidence` validates `tsh:ConfidenceStatementShape` (`ts:method` is an IRI; `level`/`lowerBound`/`upperBound` accepted as decimal-or-double), `prov:wasDerivedFrom` present (≥1), `ts:derivedVia` validates `tsh:AnalyticalDerivationShape` (`traceReference`, `translationModel`, `translationPrompt`, `sourceOutputSpan` with a 2-integer `byteRange`). The description-iff-`NotApplicable` rule is satisfied vacuously: method is `ts:FrequentistInterval`, so the `sh:not` branch holds.
- `tsh:TrendClaimShape`: `ts:metric` (1), `ts:baselinePeriod` + `ts:comparisonPeriod` (each a valid `time:Interval`), `ts:direction = ts:Increase` ∈ the closed enum `{ts:Increase, ts:Decrease, ts:NoSignificantChange}`, `ts:magnitude` validates `tsh:MagnitudeShape` (`percentChange` accepted as decimal-or-double).

> **One reconciliation, flagged (§8.3 #1).** Appendix B's JSON-LD gives `ts:metric` an `@id` (`ex:complaint-count`) *and* a nested `schema:name`, but the §8.11.4 core `ts:Claim` table also requires `ts:subject` ("what the claim is about, typically a metric") on *every* `ts:Claim`. Appendix B does **not** carry an explicit `ts:subject` property — it carries `ts:metric` (a `ts:TrendClaim` addition) instead. This is a **spec ambiguity**: either (a) `ts:subject` is satisfied-by/aliased-to `ts:metric` for metric-bearing subtypes, or (b) Appendix B is under-specified against its own core. To validate Appendix B *as written* I added `ts:subject ex:complaint-count` (the most charitable reading — the metric *is* the subject); a strict reading of `tsh:ClaimShape` against the *literal* Appendix B JSON would report a `ts:subject` `minCount` violation. I do not silently resolve this in the shapes; §8 records it as a gap the spec must close.

### 7.2 A deliberately-invalid variant and the SHACL violation

Now mutate two things: change `ts:direction` to a value outside the closed enum, and make the confidence free-form (`ts:method` a plain string instead of a method IRI — the §8.11.7 "free-form confidence" anti-pattern). This is the canonical non-conforming claim the spec prohibits.

```ttl
<claim-002-invalid>
    a ts:TrendClaim ;
    dcterms:identifier "claim-002" ;
    ts:subject ex:complaint-count ;
    ts:metric ex:complaint-count ;
    ts:scope [
        a ts:Scope ;
        ts:geographicScope [ a ts:NeighborhoodTabulationArea ; dcterms:identifier "BK0801" ] ;
        ts:temporalScope   [ a time:Interval ;
                             time:hasBeginning [ time:inXSDDate "2024-01-01"^^xsd:date ] ;
                             time:hasEnd       [ time:inXSDDate "2025-12-31"^^xsd:date ] ]
    ] ;
    ts:baselinePeriod   [ a time:Interval ; time:hasBeginning [ time:inXSDDate "2024-01-01"^^xsd:date ] ;
                                            time:hasEnd       [ time:inXSDDate "2024-12-31"^^xsd:date ] ] ;
    ts:comparisonPeriod [ a time:Interval ; time:hasBeginning [ time:inXSDDate "2025-01-01"^^xsd:date ] ;
                                            time:hasEnd       [ time:inXSDDate "2025-12-31"^^xsd:date ] ] ;
    ts:direction "way up" ;                         # ← VIOLATION 1: outside the closed enum
    ts:magnitude [ a ts:Magnitude ; ts:percentChange 23.0 ] ;
    ts:confidence [
        a ts:ConfidenceStatement ;
        ts:method "high"                            # ← VIOLATION 2: free-form, not a method IRI
    ] ;
    prov:wasDerivedFrom <source-analysis-nodeId#query-result-2> ;
    ts:derivedVia [
        a ts:AnalyticalDerivation ;
        ts:traceReference "trace.json#step-x" ;
        ts:translationModel [ a schema:SoftwareApplication ; schema:name "claude-opus-4-7" ] ;
        ts:translationPrompt <prompt.json#claim-extraction> ;
        ts:sourceOutputSpan [ ts:outputFile "output.md" ; ts:byteRange 1240, 1487 ]
    ] .
```

**Conformance report — `sh:conforms = false`**, two `sh:ValidationResult` nodes:

```ttl
[] a sh:ValidationReport ;
   sh:conforms false ;
   sh:result
     [ a sh:ValidationResult ;
       sh:focusNode <claim-002-invalid> ;
       sh:resultPath ts:direction ;
       sh:value "way up" ;
       sh:sourceConstraintComponent sh:InConstraintComponent ;
       sh:sourceShape tsh:TrendClaimShape ;
       sh:resultSeverity sh:Violation ;
       sh:resultMessage "ts:direction MUST be one of {ts:Increase, ts:Decrease, ts:NoSignificantChange}." ] ,
     [ a sh:ValidationResult ;
       sh:focusNode _:confidence-of-claim-002 ;        # the ts:ConfidenceStatement blank node
       sh:resultPath ts:method ;
       sh:value "high" ;
       sh:sourceConstraintComponent sh:NodeKindConstraintComponent ;
       sh:sourceShape tsh:ConfidenceStatementShape ;
       sh:resultSeverity sh:Violation ;
       sh:resultMessage "ts:confidence MUST reference a method (an IRI); free-form high/medium/low is non-conforming." ] .
```

The first result fires `sh:InConstraintComponent` (the `sh:in` on `ts:direction`); the second fires `sh:NodeKindConstraintComponent` (the `ts:method` value is a string literal, not the required `sh:IRI`). **Both are exactly the prohibitions §8.11.7 names** — "free-form confidence" and an out-of-enum direction — and SHACL reports them with precise focus node, path, value, and the constraint component that fired. This is SHACL doing what it does best: catching structural non-conformance against a published vocabulary, deterministically, with a machine-readable report.

### 7.3 What the report does *not* tell you

The report says the *shape* is wrong. It says nothing about whether the *valid* `claim-001` is *true* — whether noise complaints actually rose 23%, whether `trace.json#step-stat-test-3` actually contains a frequentist interval, or whether the Ed25519ph signature on the enclosing `content/claim/v1` envelope verifies. Those are checks #2, #4, #14 and the §8.11.3-condition-4 trace-resolution — all out-of-band per §6. SHACL validated that the claim is *well-formed against the vocabulary*; the cryptographic verifier validates that it is *intact and attributable*; and per §5.1 nothing validates that it is *correct*. The three are deliberately separate, and the SHACL layer is honest about owning only the first.

---

## 8. Fit / gap analysis

### 8.1 What SHACL captures cleanly

- **The typed-claims layer (§8.11) — a near-perfect fit.** This is the layer the spec *designed for SHACL*: §8.11.3 condition 3 and §8.11.6 step 5 *require* SHACL shapes. Required-property presence, datatype constraints (with the decimal-or-double widening for JSON-LD-parsed numbers), the two closed enums (`ts:direction`, `ts:relation`), explicit-scope-required, method-derived-confidence (as "method must be an IRI, not a literal"), the `byteRange`-is-two-integers constraint, the description-iff-`NotApplicable` conditional — all are idiomatic SHACL Core. The worked example validates and the invalid variant produces precise, correct violations.
- **Envelope *field* well-formedness (§8.1, §8.3).** Presence/datatype/cardinality of every structural-primitive field; the `Ed25519ph` const (`sh:hasValue`); the reserved canonicalization-URI set (`sh:in`); the captureMethod vocabulary (ai-assisted-analysis profile); the BlobRef shape (`ref`/`url`/`size` required, `contentType` optional, per the §8.1.5 MUST steps) with its `blob:sha256:<hex>` pattern; the prompt-visibility conditional; the `type`-as-absolute-IRI pattern. Clean.
- **The two-family taxonomy (§7.4) — `sh:xone` is the perfect operator.** Disjoint families, discriminated by `type`-IRI prefix and `targetNodeId` presence, is *precisely* an exclusive-or, and `sh:xone` enforces the disjointness `sh:or` would miss.
- **The QEC `untyped`-mutex (§7.5).** `sh:not` of co-occurrence captures "untyped is mutually exclusive with typed values" exactly.
- **Specialization without inheritance, *with* targeting.** SHACL's lack of class inheritance is *not* a problem here: `sh:and ( BaseShape )` + additional `sh:property` expresses sub-type specialization cleanly, and the implicit-class-target + `sh:or` type-discriminator pattern actually **activates** each sub-type shape so its payload constraints fire (the earlier draft's dead-shape bug is fixed in §4.2).
- **Non-fatal outcomes.** The spec's `unknown_type`/`unknown_target_node` non-fatal results map to `sh:severity sh:Warning`/`sh:Info`, and the REJECT results to `sh:Violation` — SHACL's severity model fits the verifier's error-routing distinction at the *structural* layer.

### 8.2 What SHACL distorts or cannot express

- **All cryptographic verification (§9.2 checks 1,2,4,5,7,8,9,14).** Eight of fifteen numbered checks. This is not a shortcoming of the shapes — it is the boundary of the technology. SHACL validates that a `contentHash` field *exists and is well-formed hex*; the entire trust value of that field comes from the *recomputation and match*, which is out-of-band. A SHACL-only "validator" would pass a package with a structurally-perfect but *forged* signature. Any consumer of these shapes MUST run the crypto verifier alongside; the shapes are necessary, never sufficient.
- **`signingKeyId` consistency (check #6) is SHACL-SPARQL, not Core.** `sh:equals` takes a *predicate*, not a *path*; `sig.kid == metadata.signingKeyId` compares the ends of two sequence paths and so cannot be Core `sh:equals`. It is expressed as a `sh:sparql` constraint (§6.2) and kept out of the Core block. A portable-Core alternative requires JSON-LD framing to lift both values to direct properties first. **The earlier "loadable Core" graph wrongly embedded a sequence-path `sh:equals`; that is removed.**
- **`dcterms:identifier` uniqueness within package (TC-C2).** "No two claims share an identifier" is a graph-global constraint requiring SHACL-SPARQL (a `sh:sparql` constraint with a `SELECT ?this ?other WHERE { … } FILTER(?this != ?other)`), not SHACL-Core.
- **Lifecycle chain *ordering* (check #10).** Signer-matching by identifier equality and `targetNodeId`↔`nodeId` joins are graph-checkable only at the SHACL-SPARQL tier; *ordering by envelope timestamp with nodeId tie-break* requires `ORDER BY` — SPARQL, not Core. The state-machine projection of §5 is fundamentally *behavioral* and belongs to the SysML formalization; SHACL can validate individual lifecycle *nodes* (now targeted, §4.2) but not *derive the current status* from the chain.
- **The `wasDerivedFrom` classification-laundering guard (refinement (a) / TC-C9).** The conditional — "*when source is `content/analysis/v1` untyped AND target is typed*, `derivationMethod` MUST carry a `ts:AnalyticalDerivation`" — requires resolving *both* the source and target nodes (their `type` and `contentType`) and is only checkable if both are loaded; even then the *cross-node* condition is SPARQL-tier. The *presence* of `derivationMethod` is Core (and now targeted); the *conditional content* is not.
- **`ts:byteRange` ordering.** Modeling `[start,end]` as exactly-two-integers is enforceable in Core (`sh:minCount 2 ; sh:maxCount 2`), but RDF multiset semantics **lose the array ordering**, so the shape cannot enforce `start ≤ end` or which value is `start`. Enforcing order needs an `rdf:List` with `sh:order`, or SPARQL. Recorded as a known Core limitation (`tsh:SourceOutputSpanShape` carries the caveat in-line).
- **The envelope-as-RDF fiction (`tsx:` / `tst:` / `@base`).** The single largest distortion: **the spec's envelope is JSON, not RDF.** It is canonicalized with RFC 8785 JCS and hashed *as JSON bytes*; it mints no RDF property URIs, and its `type` value is a string token, not an IRI. To SHACL-validate it at all, this document *invents* `tsx:` property URIs, a `tst:` type-IRI namespace, and a `@base` so the `type` token becomes a real absolute IRI (the only way `sh:nodeKind sh:IRI` and the anchored pattern can both hold — the fix to the earlier self-inconsistent relative-IRI handling). That interpretation is a modeling choice not present in the spec. A real deployment would either (a) validate the envelope JSON with JSON Schema (its native shape language) and reserve SHACL for the `ts:` claim layer, or (b) define a normative JSON-LD context for the envelope so the `tsx:`/`tst:` URIs become real. The typed-claims layer needs no such fiction — it is already RDF. **This is the cleanest line in the fit analysis: SHACL fits the claim layer natively and the envelope layer only by translation.**
- **`@context` membership (TC-C18).** Checkable only at JSON-LD parse time, not on the resulting RDF graph (the `@context` is consumed during expansion). SHACL targeting on `ts:`-namespaced classes enforces the *consequence* but not the literal `@context`-array assertion; that is a JSON-LD-framing check.
- **Falsifiability (§8.11.2 principle 5 / TC-C10).** A per-*type* design meta-property ("a counter-claim is expressible in the same vocabulary"), not a per-instance constraint. Outside SHACL entirely — it is a property of the *vocabulary's design*, verified by inspection of the shapes, not by validating data against them.

### 8.3 Spec ambiguities that block a faithful shape

These are places where I could not write a faithful shape because the spec is silent or internally inconsistent — recorded here rather than resolved by invention (the model's discipline: "where the spec is silent, say so").

1. **`ts:subject` vs. `ts:metric` in Appendix B (§7.1 above).** The §8.11.4 core table requires `ts:subject` on every `ts:Claim`, but the Appendix B worked example carries `ts:metric` and no `ts:subject`. A strict `tsh:ClaimShape` reports a `minCount` violation against the spec's own example. The spec must say whether `ts:metric` satisfies `ts:subject` for metric-bearing subtypes (alias/subproperty), or whether Appendix B is under-specified. **Until resolved, `tsh:ClaimShape`'s `ts:subject minCount 1` is contingent.**
2. **`ts:Magnitude` and `ts:Component` field shapes (§5.2/§5.3).** The model marks both **under-specified** — the example uses `ts:percentChange`/`ts:absoluteChange` but the spec states *no required fields*. I shaped `tsh:MagnitudeShape` as presence-optional/typed-if-present and wrote *no* `minCount` for either field, and did *not* write a "components sum to `ts:totalsTo`" constraint (the spec does *not* mandate the sum). A faithful *required-field* shape is impossible without the spec naming required fields.
3. **`content/question/v1` and `content/evidence/v1` payloads.** Reserved name-only (Q5); the spec defines *no* payload fields. No faithful shape can be written; I shaped only `content/claim/v1`.
4. **Several attestation payload datatypes (`scope`, `availability`, `certificationScheme`, `validityWindow`, `methodology`, `scoringRubric`, `results`, `standardId`).** Named in §8.12.1 with no datatype. Shaped as presence-only (and now actually targeted/enforced per §4.2); no invented datatypes.
5. **`contentProfile` / `producerProfile` placement.** Resolved against the §8.1.1 normative field table: **both** are listed as **top-level** fields on the package object. This revision roots both at the metadata (top-level) object consistently — `( tsx:metadata tsx:contentProfile )` and `( tsx:metadata tsx:producerProfile )` — fixing the earlier internal inconsistency that routed `contentProfile` through metadata but `producerProfile` at a different level. (§8.7/datHere prose's informal `metadata.contentProfile` reference is consistent with this rooting.)
6. **Scope nullability (Q14).** Whether **both** scope components and **both** interval endpoints are mandatory is the open question Q14 (cited in §8.11.4). This revision marks those four `sh:minCount 1` constraints `sh:Warning` and Q14-contingent rather than asserting a `sh:Violation` the spec cannot yet justify; they revert to `sh:Violation` if Q14 resolves to "stay required."
7. **OWL axioms (Q10).** Whether sub-type shapes should be *targeted by entailment* (`ts:TrendClaim rdfs:subClassOf ts:Claim` + a reasoner) or by *explicit `@type`* is contingent on the unfixed Q10 axioms. I target by explicit `@type` (matching Appendix B) and flag every place this matters.
8. **`bindingTier` value set (Q3).** The §8.5 ladder is **informative** prose and **extensible**, and the non-GitHub tiers are explicitly Q3-open. The spec's own data uses values beyond the ladder (`platform`, `legacy_embedded`, §8.3.3). I therefore do **not** close the `bindingTier` enum; presence + string type is required, with a non-violating `sh:Info` ladder-membership hint that includes the spec-attested values. (The earlier draft both invented coinages and closed the enum, omitting `platform`/`legacy_embedded` — fixed.)

### 8.4 Bottom line

SHACL is the **correct and spec-mandated** validation technology for the typed-claims layer and a **clean-by-translation** fit for envelope field well-formedness. It is **not** — and the spec never asks it to be — a substitute for the cryptographic verifier: the eight out-of-band §9.2 checks (hash, signature, timestamp, Rekor, registry) carry the actual trust, and SHACL validates only that the *fields those checks operate on* are present and well-shaped. A handful of in-graph checks (`signingKeyId` equality #6, identifier uniqueness, lifecycle ordering/joins) sit at the **SHACL-SPARQL** tier, not Core, and are labeled as such. The honest architecture is **layered**: JSON Schema or a normative JSON-LD context for the envelope, SHACL for the `ts:` claim layer (this document's shapes graph), and an out-of-band crypto verifier (`@typedstandards/verify-core`) for integrity — with SHACL owning exactly the instance-data-conformance slice and nothing it cannot honestly hold. OWL promotion (Q10) would sit *beneath* the SHACL layer as an entailment regime, not displace it.

---

## Consolidated shapes graph

The complete, self-contained shapes graph, partitioned by conformance tier. **Sections A–E are SHACL-Core and load into any SHACL-Core processor.** The single **SHACL-SPARQL** shape (`tsh:SigningKeyIdConsistencyShape`) is isolated in **Section F** and requires a SHACL-SPARQL-capable processor; it is NOT Core and is not needed to load the Core block. **Section G** documents the out-of-band and further SHACL-SPARQL-tier checks as comments only (not enforceable in Core).

`tsx:`/`tst:` (envelope) terms are the non-normative RDF interpretation of the JSON envelope (see §2/§8.2); `ts:` terms are the normative vocabulary. The `@base` makes the `type` token a real absolute IRI.

```ttl
@base            <https://typedstandards.org/ns/envelope-type/> .

@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix ts:      <https://typedstandards.org/ns/ts#> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix qb:      <http://purl.org/linked-data/cube#> .
@prefix schema:  <https://schema.org/> .
@prefix geo:     <http://www.opengis.net/ont/geosparql#> .
@prefix time:    <http://www.w3.org/2006/time#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix tsh:     <https://typedstandards.org/shapes/> .
@prefix tsx:     <https://typedstandards.org/ns/envelope#> .
@prefix tst:     <https://typedstandards.org/ns/envelope-type/> .

#################################################################
# A. CRYPTOGRAPHIC ENVELOPE / STRUCTURAL PRIMITIVE (§8.1, §8.3)  [SHACL-Core]
#    Field well-formedness ONLY. Hash/signature recomputation is OUT OF BAND (§6 checks 1,2,4).
#################################################################

tsh:SignatureEnvelopeShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path tsx:signature ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "sig.signature present (base64); validity = check #2, out of band." ] ;
    sh:property [ sh:path tsx:publicKey ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:algorithm ; sh:hasValue "Ed25519ph" ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "sig.algorithm MUST be 'Ed25519ph'." ] ;
    sh:property [ sh:path tsx:kid ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .

tsh:ContentHashShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path tsx:sha256 ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
                  sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "contentHash.sha256 required by default; 64 lowercase hex chars." ] ;
    sh:property [ sh:path tsx:sha3-256 ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:blake3 ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ; sh:maxCount 1 ] .

tsh:SignerShape a sh:NodeShape ;
    sh:closed false ;
    # bindingTier: required string; NOT a closed enum (ladder informative + extensible, Q3-open).
    sh:property [ sh:path tsx:bindingTier ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "bindingTier required string; §8.5 ladder informative + extensible (Q3-open)." ] ;
    # advisory NON-VIOLATING ladder hint; includes spec-attested 'platform' + 'legacy_embedded' (§8.3.3).
    sh:property [ sh:path tsx:bindingTier ; sh:severity sh:Info ;
                  sh:in ( "pseudonymous" "oauth" "orcid" "did-web" "notarized" "platform" "legacy_embedded" ) ;
                  sh:message "bindingTier outside spec-attested set; permitted (extensible), surfaced as Info." ] ;
    sh:property [ sh:path tsx:identifier ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:displayName ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:verifiedAt ; sh:datatype xsd:dateTime ; sh:maxCount 1 ] .

tsh:PackageMetadataShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path tsx:schemaVersion ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:packageId ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:createdAt ; sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:signingKeyId ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:captureMethod ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:in ( "chat-flow-stream" "claude-code-jsonl-readback" "claude-code-self-report" ) ;
                  sh:message "captureMethod required; ai-assisted-analysis v0.1 vocabulary." ] ;
    sh:property [ sh:path tsx:contentProfile ; sh:datatype xsd:string ; sh:maxCount 1 ;
                  sh:in ( "default" "datHere" ) ] ;
    sh:property [ sh:path tsx:producerProfile ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:contentType ; sh:minCount 1 ;
                  sh:or ( [ sh:in ( "claim" "question" "evidence" ) ] [ sh:in ( "untyped" ) ] ) ] .

tsh:SignedNodeShape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:closed false ;
    sh:property [ sh:path tsx:type ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:pattern "^https://typedstandards\\.org/ns/envelope-type/(content|attestation)/[A-Za-z]+/v[0-9]+$" ;
                  sh:message "type MUST be a tst: IRI of form .../content/<noun>/v<N> or .../attestation/<verb>/v<N>." ] ;
    sh:property [ sh:path tsx:nodeId ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
                  sh:minCount 0 ; sh:maxCount 1 ; sh:severity sh:Info ;
                  sh:message "nodeId is derived (= envelope hash); derivation is out of band." ] ;
    sh:property [ sh:path tsx:contentHash ; sh:node tsh:ContentHashShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:contentCanonicalization ; sh:nodeKind sh:IRI ; sh:maxCount 1 ;
                  sh:in ( <https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1>
                          <https://typedstandards.org/canonicalization/legacy-json/v1> ) ] ;
    sh:property [ sh:path tsx:sig ; sh:node tsh:SignatureEnvelopeShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:signer ; sh:node tsh:SignerShape ; sh:minCount 0 ; sh:maxCount 1 ;
                  sh:severity sh:Warning ; sh:message "signer RECOMMENDED in v0.1." ] ;
    sh:property [ sh:path tsx:metadata ; sh:node tsh:PackageMetadataShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:timestamp ; sh:minCount 0 ; sh:maxCount 1 ; sh:severity sh:Warning ;
                  sh:message "RFC 3161 timestamp SHOULD be present; validity = check #7, out of band." ] ;
    sh:property [ sh:path tsx:rekorInclusionProof ; sh:minCount 0 ; sh:maxCount 1 ; sh:severity sh:Warning ;
                  sh:message "Rekor proof SHOULD be present; Merkle inclusion = check #8, out of band." ] .

#################################################################
# B. TWO-FAMILY TAXONOMY (§7.4) + QEC (§7.5) + PROFILE CONSISTENCY  [SHACL-Core]
#################################################################

tsh:FamilyDiscriminatorShape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:xone (
        [ sh:property [ sh:path tsx:type ; sh:pattern "^https://typedstandards\\.org/ns/envelope-type/content/" ] ;
          sh:property [ sh:path tsx:targetNodeId ; sh:maxCount 0 ] ]
        [ sh:property [ sh:path tsx:type ; sh:pattern "^https://typedstandards\\.org/ns/envelope-type/attestation/" ] ;
          sh:property [ sh:path tsx:targetNodeId ; sh:minCount 1 ] ]
    ) ;
    sh:message "Exactly one family: content/* (no targetNodeId) xor attestation/* (>=1 targetNodeId)." .

tsh:QecContentTypeShape a sh:NodeShape ;
    sh:targetObjectsOf tsx:metadata ;
    sh:property [ sh:path tsx:contentType ; sh:minCount 1 ;
                  sh:or ( [ sh:in ( "claim" "question" "evidence" ) ] [ sh:in ( "untyped" ) ] ) ] ;
    sh:not [ sh:and (
        [ sh:property [ sh:path tsx:contentType ; sh:hasValue "untyped" ] ]
        [ sh:property [ sh:path tsx:contentType ;
                        sh:qualifiedValueShape [ sh:in ( "claim" "question" "evidence" ) ] ;
                        sh:qualifiedMinCount 1 ] ] ) ] ;
    sh:message "contentType non-empty; 'untyped' mutually exclusive with claim/question/evidence." .

# contentProfile <=> producerProfile biconditional (C55). BOTH live on metadata (top-level, §8.1.1).
tsh:ProfileConsistencyShape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:and (
        # metadata.contentProfile=datHere -> metadata.producerProfile starts ai-assisted-analysis/datHere
        [ sh:or (
            [ sh:not [ sh:property [ sh:path ( tsx:metadata tsx:contentProfile ) ; sh:hasValue "datHere" ] ] ]
            [ sh:property [ sh:path ( tsx:metadata tsx:producerProfile ) ; sh:pattern "^ai-assisted-analysis/datHere" ] ] ) ]
        # metadata.producerProfile starts ai-assisted-analysis/datHere -> metadata.contentProfile=datHere
        [ sh:or (
            [ sh:not [ sh:property [ sh:path ( tsx:metadata tsx:producerProfile ) ; sh:pattern "^ai-assisted-analysis/datHere" ] ] ]
            [ sh:property [ sh:path ( tsx:metadata tsx:contentProfile ) ; sh:hasValue "datHere" ] ] ) ]
    ) ;
    sh:message "contentProfile=datHere IFF producerProfile starts ai-assisted-analysis/datHere (both top-level, §8.1.1)." .

#################################################################
# C. content/analysis/v1 PACKAGE (§8.1) + sub-objects  [SHACL-Core]
#################################################################

tsh:PromptShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path tsx:hash ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
                  sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:visibility ; sh:in ( "full_text" "hash_only" ) ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:xone (
        [ sh:property [ sh:path tsx:visibility ; sh:hasValue "full_text" ] ;
          sh:property [ sh:path tsx:text ; sh:minCount 1 ; sh:datatype xsd:string ] ]
        [ sh:property [ sh:path tsx:visibility ; sh:hasValue "hash_only" ] ;
          sh:property [ sh:path tsx:text ; sh:maxCount 0 ] ]
    ) ;
    sh:message "prompt.text present iff full_text, absent iff hash_only." .

tsh:CostShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path tsx:promptTokens ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:completionTokens ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:totalTokens ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:model ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:durationMs ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] .

# BlobRef: ref/url/size required (§8.1.5 MUST steps); contentType OPTIONAL (shown in example, no MUST).
tsh:BlobRefShape a sh:NodeShape ;
    sh:closed true ; sh:ignoredProperties ( rdf:type ) ;
    sh:property [ sh:path tsx:ref ; sh:datatype xsd:string ; sh:pattern "^blob:sha256:[0-9a-f]{64}$" ;
                  sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "BlobRef.ref form blob:sha256:<64hex>; hash MATCH is check #9, out of band." ] ;
    sh:property [ sh:path tsx:url ; sh:nodeKind sh:IRI ; sh:pattern "^https://" ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path tsx:contentType ; sh:datatype xsd:string ; sh:maxCount 1 ] ;   # optional (no MUST)
    sh:property [ sh:path tsx:size ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] .

# content/analysis/v1: implicit-class target + sh:or type discriminator (portable; no sh:filterShape).
tsh:ContentAnalysisV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:content/analysis/v1 ] ] ]   # skip if not analysis
        [ sh:and ( tsh:SignedNodeShape ) ;
          sh:property [ sh:path tsx:prompt ; sh:node tsh:PromptShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:cost ; sh:node tsh:CostShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:skillMetadata ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:queries ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:dataSources ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path tsx:output ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:or ( [ sh:datatype xsd:string ] [ sh:node tsh:BlobRefShape ] ) ] ;
          sh:property [ sh:path tsx:trace ; sh:minCount 1 ; sh:maxCount 1 ;
                        sh:or ( [ sh:nodeKind sh:BlankNodeOrIRI ] [ sh:node tsh:BlobRefShape ] ) ] ;
          sh:property [ sh:path tsx:targetNodeId ; sh:maxCount 0 ] ]
    ) ;
    sh:message "content/analysis/v1 required-field conformance (§8.1.1)." .

# datHere conditional presence (req 6 summary, req 4 notebook ext). metadata.contentProfile (top-level).
tsh:DatHereConditionalShape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path ( tsx:metadata tsx:contentProfile ) ; sh:hasValue "datHere" ] ] ]
        [ sh:property [ sh:path tsx:summary ; sh:minCount 1 ; sh:datatype xsd:string ] ;
          sh:property [ sh:path ( tsx:extensions tsx:org.civicaitools.notebook ) ; sh:minCount 1 ] ]
    ) ;
    sh:message "Under contentProfile=datHere: summary and org.civicaitools.notebook required (§8.7.1)." .

#################################################################
# D. attestation/* FAMILY (§8.12) — base + ALL sub-types, EACH ACTUALLY TARGETED  [SHACL-Core]
#    Pattern: implicit-class target + sh:or type discriminator + sh:and ( base ). No dead shapes.
#################################################################

tsh:AttestationNodeShape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or (
        [ sh:not [ sh:property [ sh:path tsx:type ;
                    sh:pattern "^https://typedstandards\\.org/ns/envelope-type/attestation/" ] ] ]
        [ sh:and ( tsh:SignedNodeShape ) ;
          sh:property [ sh:path tsx:targetNodeId ; sh:minCount 1 ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
                        sh:message "attestation/* MUST carry >=1 targetNodeId." ] ]
    ) ;
    sh:message "attestation/* base: envelope + >=1 targetNodeId (§8.12.3)." .

tsh:AttestationWithdrawsV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/withdraws/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:reason ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ; sh:minLength 1 ;
                            sh:message "withdraws.reason required, non-empty." ] ;
              sh:property [ sh:path tsx:effectiveAt ; sh:datatype xsd:dateTime ; sh:maxCount 1 ] ] ) .

tsh:AttestationReinstatesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/reinstates/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:priorWithdrawalNodeId ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
                            sh:minCount 1 ; sh:maxCount 1 ] ;
              sh:property [ sh:path tsx:reason ; sh:datatype xsd:string ; sh:maxCount 1 ] ] ) .

tsh:AttestationSupersedesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/supersedes/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:successorNodeId ; sh:datatype xsd:string ; sh:pattern "^[0-9a-f]{64}$" ;
                            sh:minCount 1 ; sh:maxCount 1 ] ] ) .

tsh:AttestationPublishesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/publishes/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:publicationHost ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
              sh:property [ sh:path tsx:releasedAt ; sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ] ] ) .

tsh:AttestationLocatedAtV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/locatedAt/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:uri ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ] ;
              # contentHash presence is a REQUIRED field at default (Violation) severity — NOT demoted to Info.
              sh:property [ sh:path tsx:contentHash ; sh:node tsh:ContentHashShape ; sh:minCount 1 ; sh:maxCount 1 ;
                            sh:message "locatedAt.contentHash required; well-formed multihash (§8.12.1)." ] ;
              sh:property [ sh:path tsx:contentLength ; sh:datatype xsd:integer ; sh:maxCount 1 ] ;
              sh:property [ sh:path tsx:availability ; sh:maxCount 1 ] ] ) .
    # The 'contentHash SHOULD match target's; mismatch = informative drift' semantics is a CROSS-NODE
    # comparison → out of band (§6, target may be absent). NOT encoded as Info on the presence constraint.

tsh:AttestationWasDerivedFromV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/wasDerivedFrom/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:derivationMethod ; sh:minCount 1 ; sh:maxCount 1 ;
                            sh:message "wasDerivedFrom MUST carry derivationMethod." ] ] ) .
    # CONDITIONAL classification-laundering guard (refinement (a)/TC-C9): when source is
    # content/analysis/v1 untyped AND target typed, derivationMethod MUST carry ts:AnalyticalDerivation.
    # Requires resolving BOTH referenced nodes -> SHACL-SPARQL tier, not Core. See §6 #10 / §8.2.

tsh:AttestationCorroboratesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/corroborates/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:scope ; sh:minCount 1 ; sh:maxCount 1 ] ;     # datatype unspecified (§8.3)
              sh:property [ sh:path tsx:reasoning ; sh:datatype xsd:string ; sh:maxCount 1 ] ] ) .   # optional

tsh:AttestationContradictsV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/contradicts/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:scope ; sh:minCount 1 ; sh:maxCount 1 ] ;
              sh:property [ sh:path tsx:reasoning ; sh:datatype xsd:string ; sh:maxCount 1 ] ] ) .

tsh:AttestationEndorsesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/endorses/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:scope ; sh:minCount 1 ; sh:maxCount 1 ] ] ) .

tsh:AttestationAnswersQuestionV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/answersQuestion/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ] ) .    # only targetNodeId (question) beyond base

tsh:AttestationSupportedByV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/supportedBy/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ] ) .    # only targetNodeId (evidence) beyond base

tsh:AttestationOpposedByV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/opposedBy/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ] ) .    # only targetNodeId (evidence) beyond base

tsh:AttestationCertifiesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/certifies/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:certificationScheme ; sh:minCount 1 ; sh:maxCount 1 ] ;   # unspecified type
              sh:property [ sh:path tsx:validityWindow ; sh:minCount 1 ; sh:maxCount 1 ] ] ) .     # unspecified type

tsh:AttestationEvaluatesV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/evaluates/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:methodology ; sh:minCount 1 ; sh:maxCount 1 ] ;            # unspecified type
              sh:property [ sh:path tsx:scoringRubric ; sh:minCount 1 ; sh:maxCount 1 ] ;          # unspecified type
              sh:property [ sh:path tsx:results ; sh:minCount 1 ; sh:maxCount 1 ] ] ) .            # unspecified type

tsh:AttestationConformsV1Shape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:or ( [ sh:not [ sh:property [ sh:path tsx:type ; sh:hasValue tst:attestation/conforms/v1 ] ] ]
            [ sh:and ( tsh:AttestationNodeShape ) ;
              sh:property [ sh:path tsx:standardId ; sh:minCount 1 ; sh:maxCount 1 ] ] ) .         # unspecified type

#################################################################
# E. TYPED-CLAIMS LAYER (§8.11) — the SHACL-PRESCRIBED surface  [SHACL-Core]
#    Fractional numbers accept xsd:decimal OR xsd:double (JSON-LD 1.1 parses fractions as double).
#################################################################

tsh:SourceOutputSpanShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path ts:outputFile ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:byteRange ; sh:datatype xsd:integer ; sh:minCount 2 ; sh:maxCount 2 ;
                  sh:message "ts:byteRange MUST be exactly two integers [start,end]." ] .
    # CAVEAT: RDF multiset loses [start,end] ORDER; start<=end / which-is-start NOT enforceable in Core
    # (would need rdf:List + sh:order, or SPARQL). Known limitation (§8.2).

tsh:AnalyticalDerivationShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path ts:traceReference ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:translationModel ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:translationPrompt ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:sourceOutputSpan ; sh:node tsh:SourceOutputSpanShape ; sh:minCount 1 ; sh:maxCount 1 ] .

tsh:ConfidenceStatementShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path ts:method ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "ts:confidence MUST reference a method IRI; free-form is non-conforming." ] ;
    sh:property [ sh:path ts:level ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:lowerBound ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:upperBound ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:methodReference ; sh:maxCount 1 ] .   # resolution to trace.json = out of band

# Q14-contingent: both interval endpoints relaxed to Warning (OWL-Time requires neither; Q14 open).
tsh:TemporalIntervalShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path time:hasBeginning ; sh:minCount 1 ; sh:maxCount 1 ; sh:severity sh:Warning ;
                  sh:message "time:hasBeginning expected (Q14-contingent)." ] ;
    sh:property [ sh:path time:hasEnd ; sh:minCount 1 ; sh:maxCount 1 ; sh:severity sh:Warning ;
                  sh:message "time:hasEnd expected (Q14-contingent)." ] .

tsh:GeographicScopeShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path dcterms:identifier ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
    sh:property [ sh:path schema:name ; sh:maxCount 1 ] ;
    sh:property [ sh:path geo:hasGeometry ; sh:maxCount 1 ] .

# Q14-contingent: both scope components relaxed to Warning (per-component nullability is Q14-open).
tsh:ScopeShape a sh:NodeShape ;
    sh:closed false ;
    sh:property [ sh:path ts:geographicScope ; sh:node tsh:GeographicScopeShape ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:severity sh:Warning ; sh:message "ts:geographicScope expected (Q14-contingent)." ] ;
    sh:property [ sh:path ts:temporalScope ; sh:node tsh:TemporalIntervalShape ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:severity sh:Warning ; sh:message "ts:temporalScope expected (Q14-contingent)." ] .

tsh:MagnitudeShape a sh:NodeShape ;
    sh:closed false ;   # UNDER-SPECIFIED: no required fields per spec (§8); typed-if-present only.
    sh:property [ sh:path ts:percentChange ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] ;
    sh:property [ sh:path ts:absoluteChange ; sh:maxCount 1 ] .

tsh:ClaimShape a sh:NodeShape ;
    sh:targetClass ts:Claim ;
    sh:closed false ;
    sh:property [ sh:path dcterms:identifier ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "Every claim MUST carry dcterms:identifier (unique within package — uniqueness = SPARQL tier)." ] ;
    sh:property [ sh:path ts:subject ; sh:nodeKind sh:BlankNodeOrIRI ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "ts:subject exactly one (NOTE: Appendix B ambiguity vs ts:metric — §8.3 #1)." ] ;
    sh:property [ sh:path ts:scope ; sh:node tsh:ScopeShape ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:message "Explicit ts:Scope required (implicit scope non-conforming)." ] ;
    sh:property [ sh:path ts:confidence ; sh:node tsh:ConfidenceStatementShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path prov:wasDerivedFrom ; sh:nodeKind sh:BlankNodeOrIRI ; sh:minCount 1 ;
                  sh:message "Claim MUST cite >=1 prov:wasDerivedFrom entity." ] ;
    sh:property [ sh:path ts:derivedVia ; sh:node tsh:AnalyticalDerivationShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:or (   # description required IFF confidence method is ts:NotApplicable (TC-C6)
        [ sh:not [ sh:property [ sh:path ( ts:confidence ts:method ) ; sh:hasValue ts:NotApplicable ] ] ]
        [ sh:property [ sh:path dcterms:description ; sh:minCount 1 ; sh:datatype xsd:string ] ]
    ) ;
    sh:property [ sh:path dcterms:description ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:contradicts ; sh:nodeKind sh:IRI ] ;
    sh:property [ sh:path ts:corroborates ; sh:nodeKind sh:IRI ] ;
    sh:property [ sh:path ts:supersedes ; sh:nodeKind sh:IRI ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:limitations ; sh:datatype xsd:string ; sh:maxCount 1 ] .

tsh:TrendClaimShape a sh:NodeShape ;
    sh:targetClass ts:TrendClaim ; sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metric ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:BlankNodeOrIRI ] ;
    sh:property [ sh:path ts:baselinePeriod ; sh:node tsh:TemporalIntervalShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:comparisonPeriod ; sh:node tsh:TemporalIntervalShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:direction ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:in ( ts:Increase ts:Decrease ts:NoSignificantChange ) ;
                  sh:message "ts:direction closed enum {Increase,Decrease,NoSignificantChange}." ] ;
    sh:property [ sh:path ts:magnitude ; sh:node tsh:MagnitudeShape ; sh:minCount 1 ; sh:maxCount 1 ] .

tsh:ComparisonClaimShape a sh:NodeShape ;
    sh:targetClass ts:ComparisonClaim ; sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metric ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:scopeA ; sh:node tsh:ScopeShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:scopeB ; sh:node tsh:ScopeShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:relation ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:in ( ts:GreaterThan ts:LessThan ts:ApproximatelyEqual ) ;
                  sh:message "ts:relation closed enum {GreaterThan,LessThan,ApproximatelyEqual}." ] ;
    sh:property [ sh:path ts:magnitude ; sh:node tsh:MagnitudeShape ; sh:minCount 1 ; sh:maxCount 1 ] .

tsh:ObservationClaimShape a sh:NodeShape ;
    sh:targetClass ts:ObservationClaim ; sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metric ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:value ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:unit ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ] .

tsh:CompositionClaimShape a sh:NodeShape ;
    sh:targetClass ts:CompositionClaim ; sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:whole ; sh:node tsh:ScopeShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:components ; sh:minCount 1 ] ;
    sh:property [ sh:path ts:totalsTo ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] .
    # No 'components sum to totalsTo' constraint: spec does NOT mandate the sum (§8).

tsh:RelationshipClaimShape a sh:NodeShape ;
    sh:targetClass ts:RelationshipClaim ; sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:metricA ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:metricB ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:relationshipType ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ] ;  # OPEN enum
    sh:property [ sh:path ts:strength ; sh:minCount 1 ; sh:maxCount 1 ;
                  sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:double ] ) ] .

tsh:QualitativeClaimShape a sh:NodeShape ;
    sh:targetClass ts:QualitativeClaim ; sh:and ( tsh:ClaimShape ) ;
    sh:property [ sh:path ts:assertion ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path ts:groundingMethod ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ] .   # OPEN enum

#################################################################
# F. SHACL-SPARQL TIER (NOT SHACL-Core; requires a SHACL-SPARQL processor)
#    Isolated here so Sections A-E remain loadable as pure Core.
#################################################################

# §9.2 check #6 — sig.kid == metadata.signingKeyId. sh:equals takes a PREDICATE, not a path, so the
# sequence-path comparison is NOT Core. Expressed as a sh:sparql constraint.
tsh:SigningKeyIdConsistencyShape a sh:NodeShape ;
    sh:targetClass tsx:SignedNode ;
    sh:sparql [
        a sh:SPARQLConstraint ;
        sh:message "metadata.signingKeyId MUST equal sig.kid." ;
        sh:select """
            PREFIX tsx: <https://typedstandards.org/ns/envelope#>
            SELECT $this ?signingKeyId ?kid
            WHERE {
                $this tsx:metadata/tsx:signingKeyId ?signingKeyId .
                $this tsx:sig/tsx:kid              ?kid .
                FILTER (str(?signingKeyId) != str(?kid))
            }
        """ ;
    ] .

#################################################################
# G. OUT-OF-BAND and further SHACL-SPARQL-tier checks (documented, NOT enforceable in Core):
#   OUT OF BAND: §9.2 #1 envelope-hash recompute · #2 Ed25519ph signature · #4 content-hash recompute ·
#     #5 trust-registry verdict · #7 RFC 3161 X.509 chain · #8 RFC 6962 Rekor inclusion ·
#     #9 BlobRef fetch+rehash · #14 signer<->kid registry cross-check.
#   SHACL-SPARQL tier (beyond Core, in addition to F): dcterms:identifier package-uniqueness (TC-C2);
#     nodeId<->targetNodeId reference-resolution joins (#10/#13); lifecycle-chain timestamp ordering (#10);
#     wasDerivedFrom laundering-guard cross-node condition (refinement (a)/TC-C9); locatedAt.contentHash
#     SHOULD-match-target cross-node comparison.
#   Out of SHACL entirely: falsifiability-by-construction (per-TYPE meta-property, §8.11.2 principle 5);
#     @context-array membership (TC-C18; consumed at JSON-LD parse time, not a graph triple);
#     ts:byteRange start<=end ORDERING (RDF multiset loses array order; needs rdf:List+sh:order or SPARQL).
#################################################################
```
