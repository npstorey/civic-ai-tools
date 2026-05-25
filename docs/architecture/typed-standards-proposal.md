---
Status: Internal working draft (pre-v0.1)
Last updated: 2026-05-21
Maintainer: [TK: leave as placeholder]
---

# Typed Standards — proposal

**One-line definition.** A layered, content-agnostic open standard for **production-process attestation** of analytical artifacts: a cryptographically signed, content-addressed, capture-method-labeled record of *how* an artifact was produced, verifiable by a third party who does not trust the publisher.

> **Status: Internal working draft, pre-v0.1.** This proposal renames and restructures the project's standards work (formerly the Open Evidence Standard / OES at the envelope layer, and the Civic Claim Vocabulary / CCV at the typed-claims layer) under a single umbrella name. Several layers described here — the typed-node ontology, the producer-profile / content-profile / domain-extension split, the publisher registry as a coordination index — are **reserved**: drafted in this document and adjacent draft specs, not yet implemented and not yet normative in the existing standard drafts. Sections that depend on reserved layers are marked inline. The existing `civic-ai-tools/docs/architecture/open-evidence-standard.md` and `civic-claim-vocabulary-draft-spec.md` remain ground truth for what is normative today; this document sketches the umbrella those drafts will sit under.

---

## 1. The problem

Trust in analytical claims today is mediated by brand. A reader who encounters a chart, a number, or a synthesis decides whether to believe it based on the institution behind it — investigative journalism, academic publishing, civic-data analysis from a government agency, consumer-rights research, regulatory submissions, audit work product. The artifact itself usually carries no machine-verifiable record of how it was produced.

This was workable while production was an implicit labor attestation. A serious data analysis took weeks of skilled work; the institution staking its name on it had presumably done that work. AI-assisted analysis breaks the implicit-labor-attestation assumption. The same chart that took an analyst a week can now be produced in minutes by a journalist with no statistical training, a community member with no institutional affiliation, or an adversary fabricating a plausible-looking story. Brand-mediated trust becomes increasingly orthogonal to whether the analysis is sound — and brands themselves are now consumers of AI-assisted production they cannot internally verify.

The standard's response is to make the **production process itself** the unit of attestation. Not "is this true," but "here is, in cryptographic detail, how this was produced — judge for yourself."

---

## 2. What Typed Standards is

Typed Standards is **opinionated about three things** and **deliberately silent about three others**.

**Opinionated about:**

1. **The envelope.** Every conformant package carries an Ed25519ph signature over a SHA-256 content-addressed canonical JSON, an RFC 3161 trusted timestamp from a public TSA, and an inclusion proof on a public transparency log (Sigstore Rekor). The signing key is bound to a published trust registry under the publisher's own well-known path.
2. **Capture-method discipline.** Every package declares, in a field covered by the canonical-JSON hash and therefore by the signature, *how* its content was captured. The label is structural and tamper-evident: a verifier can tell a verbatim wire-layer capture from a JSONL-layer readback from a paraphrased self-report. Future capture methods extend the vocabulary; the discipline holds.
3. **The typed-node ontology** *(reserved)*. Every package is built from typed nodes drawn from four families: **content** (the QEC sub-ontology — `metadata.contentType` set-valued across `claim` / `question` / `evidence` / `untyped`), **hosts** (typed self-description and policy of a publishing platform), **tools / methods** (typed descriptions of tools, MCP servers, skills, or methods used in production), and **attestations** (typed references to other packages with a small relations vocabulary). Each family gets the envelope and its own sub-typing rules. Nodes can carry signatures from different parties — individuals, hosts, certifying bodies, other attesting nodes — and these signatures layer rather than collapse into a single trust authority. A small relations vocabulary ties nodes together (`supportedBy`, `opposedBy`, `answersQuestion`, `corroborates`, `contradicts`, `supersedes`, `wasDerivedFrom`). QEC content is the most developed sub-ontology today; host, tool, and attestation typing are reserved.

The **normative preamble** applies across all three commitments and across every implementation: corroboration ≠ truth, contradiction ≠ falsity, identity strength ≠ topic authority, the system surfaces signals and the consumer applies judgment. The preamble is the architectural guardrail against drift toward automated truth-scoring; every product surface, downstream consumer, and third-party implementation MUST carry it.

**Deliberately silent about:**

1. **Truth.** The signature attests that the package was published and has not been altered. It does not attest that the content is correct. Editorial review, fact-checking, replication, and adversarial evaluation are *separately-signed attestations* carried in the network around the envelope, never enforced by it.
2. **Editorial policy.** Publishers set their own filters, audiences, and review processes. The standard does not gate publication on topic, viewpoint, or sign-off.
3. **Topology.** Publishers publish at their own domains. The standard does not require — and is structurally indifferent to — any central host, federation substrate, or coordination protocol beyond an optional indexing registry that does not host or gatekeep.

---

## 3. Architecture

The layered shape the umbrella sits over. Color encoding follows the convention in `end-state-vision.md`: **green = built**, **yellow = partial**, **orange = reserved (designed but not implemented; or proposed in this document and not yet in the existing drafts)**.

```mermaid
flowchart TB
    REG["Publisher registry<br/>(coordination index — names publishers,<br/>does not host or gatekeep)"]:::reserved
    DX["Domain extensions<br/>(specialize a content profile for a domain)<br/>civic data analysis = first domain extension"]:::reserved

    subgraph PROF["Profiles — orthogonal axes"]
        direction LR
        CP["Content profiles<br/>(Typed Claims / Typed Evidence /<br/>Typed Questions)"]:::partial
        PP["Producer profiles<br/>(AI-Assisted Analysis specified<br/>with subtype/flavor model per ADR-0006;<br/>'ai-assisted-analysis/datHere' subtype = built;<br/>'civicaitools-default' subtype = reserved;<br/>human / hybrid / sandbox-only types = reserved)"]:::partial
    end

    subgraph TYPED["Two-family taxonomy — semantic distinction (per ADR-0009)"]
        direction LR
        CONTENT["content/* family<br/>(standalone assertions —<br/>no targetNodeId on payload;<br/>'content/analysis/v1' = built;<br/>typed-content sub-types — claim / question / evidence — reserved;<br/>host / hostPolicy / hostTermsOfUse / tool sub-types reserved per Q22)"]:::partial
        ATTESTATION["attestation/* family<br/>(assertions about another node —<br/>targetNodeId required on payload;<br/>v0.1 Q36 sub-type table ratified by ADR-0009 §7;<br/>operationalization per sub-type via downstream ADRs)"]:::partial
    end

    ENV["Structural primitive<br/>(content-agnostic cryptographic core:<br/>type URI · nodeId (≡ envelope hash) · contentHash multihash · contentCanonicalization URI ·<br/>sig (publicKey + algorithm + kid) · signer (identity binding) · timestamp ·<br/>transparency log · trust registry · captureMethod · withdrawal lifecycle)"]:::built

    REG -.indexes.-> PROF
    DX -.specializes.-> CP
    PROF --> TYPED
    TYPED --> ENV

    classDef built fill:#86efac,stroke:#166534,color:#000
    classDef partial fill:#fde68a,stroke:#92400e,color:#000
    classDef reserved fill:#fdba74,stroke:#9a3412,color:#000
```

**How to read.** The structural primitive is the layer with most implementation today — it is the bulk of what the existing OES specifies plus the small additions [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) introduces (`type` URI field, `signer` identity-binding object, formal articulation that `nodeId` ≡ envelope hash, verifier cross-check rules for `sig.kid` ↔ `signer.identifier`). The two-family taxonomy — `content/*` (standalone assertions) and `attestation/*` (assertions about another node identified by `nodeId`) — is specified by ADR-0009 over the same structural primitive, demoting the prior four-families-as-peers framing (content / hosts / tools / attestations) to two families plus the Q36 sub-type table; hosts, tools, and certifying bodies fold in as sub-types of one of the two families rather than peer families. `content/analysis/v1` is the first built `content/*` sub-type (the legacy and `datHere` shapes both map to it); the other `content/*` sub-types (`content/claim/v1`, `content/question/v1`, `content/evidence/v1`, and the host / tool sub-types) are reserved. The `attestation/*` sub-type taxonomy is specified by ADR-0009 §7 (the Q36 ratified table); operationalization per sub-type (the withdrawal-lifecycle implementation, the location-as-attestation implementation, the publication-record flow, the adversarial-eval requirement model) lands via downstream ADRs from the Pittsburgh-arc cohort. Content profiles (typed-content carriers — Typed Claims / Typed Evidence / Typed Questions) are partially built: the Typed Claims Profile is drafted, the other two reserved name-only; under the two-family framing they are `content/*` sub-types. Producer profiles moved from reserved to **specified** with [ADR-0006](../adr/0006-producer-profile-architecture.md): the AI-Assisted Analysis Producer Profile is the first one drafted, with a subtype/flavor model so different adopters' conventions are filterable (visualization stack, citation format, entity normalization, synthesis style, confidence-scoring methodology live in subtype-specific guidance bundles rather than in the envelope). The `ai-assisted-analysis/datHere` subtype is the first built realization (refactor of the existing ADR-0004 content profile, now formally a `content/analysis/v1` node with that producer-profile subtype). Future profile types (`human`, `hybrid`, `sandbox-only`) and subtypes are reserved name-only; each lands in its own ADR with the motivating adopter named. Domain extensions specialize a content profile for a domain; civic data analysis (Neighborhood Tabulation Areas, community districts, the rest of the civic-scope taxonomy in the existing CCV draft) is the first domain extension.

---

## 4. What's in the envelope

The envelope mechanics are content-agnostic; the content slot is swappable per content profile. Canonicalization comes in two kinds (per the 2026-05-25 strategic memo §3 finding #1, formalized by [ADR-0007](../adr/0007-content-canonicalization.md) + [ADR-0008](../adr/0008-multihash-content-hash.md)): **envelope-level** canonicalization is a single fixed rule (RFC 8785 JCS) committed to by the spec; **content-level** canonicalization legitimately varies per content shape and is named by the envelope's `contentCanonicalization` URI field. The envelope-hash (SHA-256 over JCS-canonicalized unsigned envelope) is what the signature covers; the multihash `contentHash` field fingerprints the off-log content per the named rule and is itself embedded in (and therefore covered by) the envelope.

```mermaid
flowchart TB
    subgraph ENV["Envelope (content-agnostic)"]
        ENVH["Envelope hash<br/>(SHA-256 of JCS-canonicalized<br/>unsigned envelope)"]:::partial
        HASH["Multihash contentHash<br/>(sha256 required + sha3-256 / blake3 alts;<br/>over canonical content per<br/>contentCanonicalization rule)"]:::partial
        CANON["contentCanonicalization URI<br/>(names content-level<br/>canonicalization rule)"]:::reserved
        SIG["Ed25519ph signature<br/>over envelope-hash hex string"]:::built
        TS["RFC 3161 trusted timestamp<br/>from public TSA"]:::built
        REK["Sigstore Rekor entry<br/>+ inclusion proof"]:::built
        CM["captureMethod label<br/>(in canonical JSON, signed)"]:::built
        CTL["contentType label<br/>(set of QEC values,<br/>in canonical JSON, signed)"]:::reserved
        PROV["W3C PROV-O graph<br/>(derived from trace at publish)"]:::built
        TR["Execution trace<br/>(OTel-shaped, hand-rolled)"]:::partial
    end

    subgraph CONT["Typed nodes (content shown; host / tool / attestation reserved)"]
        CL["Claim"]:::reserved
        QU["Question"]:::reserved
        EV["Evidence"]:::reserved
        UN["Untyped<br/>(raw, mutually exclusive<br/>with the others)"]:::reserved
        OTHER["Host · Tool/method · Attestation<br/>(reserved node families)"]:::reserved
    end

    CONT -.canonicalized per.-> CANON
    CONT --> HASH
    HASH -.embedded in.-> ENVH
    CANON -.embedded in.-> ENVH
    CM -.embedded in.-> ENVH
    CTL -.embedded in.-> ENVH
    SIG -.covers.-> ENVH
    TS -.covers.-> ENVH
    REK -.indexes.-> ENVH
    PROV -.about.-> CONT
    TR -.captures.-> CONT

    classDef built fill:#86efac,stroke:#166534,color:#000
    classDef partial fill:#fde68a,stroke:#92400e,color:#000
    classDef reserved fill:#fdba74,stroke:#9a3412,color:#000
```

Today the content slot carries an AI-assisted civic-data analysis (prompt, queries, outputs, costs, skill metadata, optional notebook under the `datHere` content profile). The proposed restructure treats that content as **a set of typed content blocks**, with a new `metadata.contentType` field carrying the set of QEC values present — drawn from `claim`, `question`, `evidence`, or `untyped`. The most common shape is `["claim"]`; a claim that explicitly carries the question it answers is `["claim", "question"]`; raw assistant output not yet processed against any content profile is `["untyped"]`. `untyped` is mutually exclusive with the typed values. Per-block requirements (provenance, confidence, scope, AnalyticalDerivation for claims) do not relax when the set has more than one member — a multi-type package is several conformant typed blocks side-by-side, not a looser format. The envelope's hash, signature, timestamp, transparency-log entry, capture-method label, contentType label, contentCanonicalization URI, multihash content hash, provenance graph, and trace bind whatever typed node is inside; the envelope mechanics do not change when the node type or content shape changes (host, tool/method, and attestation node families are reserved alongside the content family — see §6). Different content shapes vary the `contentCanonicalization` URI; the envelope-level JCS commitment is invariant.

---

## 5. Verification flow

A verifier can complete every check using only public infrastructure plus the publisher's own trust registry. No central authority is required, and no `typedstandards.org` lookup appears in the verification path.

```mermaid
sequenceDiagram
    autonumber
    participant V as Verifier
    participant Pub as Publisher's domain<br/>(hosts package + registry)
    participant TSA as Public TSA<br/>(e.g. FreeTSA)
    participant Rkr as Sigstore Rekor

    V->>Pub: GET package + envelope<br/>(at publisher's content-addressable URL)
    Pub-->>V: package JSON + signature + timestamp + Rekor entry id
    V->>V: recompute SHA-256 over canonical JSON<br/>compare with package URL slug
    V->>Pub: GET /.well-known/typed-publisher.json<br/>(publisher's trust registry)
    Pub-->>V: public keys + lifecycle status<br/>(active / deprecated / revoked)
    V->>V: verify Ed25519ph signature against<br/>registry-listed public key
    V->>TSA: verify RFC 3161 timestamp token<br/>against TSA's CA chain
    V->>Rkr: verify Rekor inclusion proof
    V-->>V: render verdict<br/>(signature ✓, timestamp ✓, log entry ✓,<br/>captureMethod label, identity tier)

    Note over V,Pub: Decentralized publishing.<br/>Publisher hosts its own packages and its own trust registry.
    Note over V,Rkr: No central authority.<br/>The verifier never trusts the publishing platform<br/>and never trusts the Typed Standards body.
```

**The decentralized-publishing / central-indexing split.** Each publisher hosts its own packages and serves its own trust registry at a well-known path on its own domain. The reserved publisher registry at `typedstandards.org` indexes declared publishers (a directory function) but is not in the verification path: a verifier never queries `typedstandards.org` to verify a package, and the index has no authority to vouch for or reject any publisher's content. This is the deliberate inversion of the brand-mediated-trust model: trust is in the cryptography and the publisher's identity binding, not in the standards body or any host.

> **What's reserved vs. what's built in this flow.** The trust-registry well-known path shown above — `/.well-known/typed-publisher.json` — is **reserved**; today's reference implementation serves the same content at `/.well-known/evidence-public-keys.json`. Renaming touches at least the verification module, the signing module, the bundle export route, the served file, the rotation runbook, and the external-clients API documentation; it is flagged as future work, not part of this proposal. Today's verification flow also depends on a server-composed verify endpoint to assemble the signature envelope, RFC 3161 token, and Rekor proof from a database row, because the current single-blob package shape does not embed those proofs (OES Open Question Q1). Offline verification — package alone plus the publisher's trust registry plus the TSA and Rekor — is the **target end-state**, not yet a property; honestly aspirational.

---

## 6. Typed nodes — one structural primitive, two top-level families

> **Specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md).** This section reflects the unified typed-attestation primitive ratified 2026-05-25: one structural envelope underlies every signed node in the system; two top-level type families (`content/*` and `attestation/*`) sit over the primitive; sub-types are flat-namespace registered URIs per the [Q36](open-questions.md#q36--attestation-sub-type-collapse-regular-family-or-structured-hierarchy) ratified table. The earlier framing (four families — content / hosts / tools-methods / attestations — as peers) is demoted: hosts, tools, and certifying bodies fold into sub-types of one of the two families per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7, not as peer families. The QEC content sub-ontology (claim / question / evidence / untyped) is preserved as the most-developed `content/*` sub-area today; host, tool, and attestation sub-type operationalization is per-sub-type via downstream ADRs.

**The structural primitive.** Every conformant signed node is a signed envelope over a typed payload, carrying the structural-primitive fields specified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §1: a `type` URI (identifying the node's family + sub-type), a derived `nodeId` (the envelope hash by construction), a multihash `contentHash` (fingerprinting the off-log payload per [ADR-0008](../adr/0008-multihash-content-hash.md)), a `contentCanonicalization` URI (naming the off-log content's canonicalization rule per [ADR-0007](../adr/0007-content-canonicalization.md)), a signature envelope (`sig` per OES §6.1 — public key + algorithm + kid), a `signer` object (identity binding per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4), an RFC 3161 timestamp, a Sigstore Rekor inclusion proof, and the `metadata` object. Sub-type-specific payload fields live alongside the primitive at the canonical-JSON top level (for `content/analysis/v1`, that means `prompt` / `queries` / `output` / `trace` / etc.; for `attestation/*` sub-types, that means `targetNodeId` plus sub-type-specific fields per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7).

**Two top-level type families.** Every conformant signed node belongs to exactly one of two families, distinguished by the `type` URI's first path segment:

- **`content/*`** — *standalone assertion.* The node asserts something the signer takes responsibility for (an analysis, a typed claim, a question, an evidence record, a host's own identity, a tool author's tool declaration). It does NOT carry `targetNodeId` on its payload; it MAY cite or reference other nodes via PROV-O-style `wasDerivedFrom` provenance, but those references are upstream provenance, not the assertion's subject.

- **`attestation/*`** — *assertion about another node.* The node carries at least one `targetNodeId` referencing the node it asserts about. It does not stand alone — without its target the assertion has no subject. Sub-types cover lifecycle (withdraws / reinstates / supersedes / publishes), reference (locatedAt / wasDerivedFrom / answersQuestion / supportedBy / opposedBy), claim-to-claim (corroborates / contradicts / endorses), and authority-bearing (certifies / evaluates / conforms) relations.

The presence (or absence) of `targetNodeId` on the payload is the structural rule that decides which family a node belongs to. Hosts are not a separate family — host self-declarations are `content/host/v1` or `content/hostPolicy/v1` (the host is asserting something about itself, no other node referenced); host endorsements of others' content are `attestation/endorses/v1`. Tools / certifying bodies are not a separate family — a tool author's declaration is `content/tool/v1`; a certifying body's attestation about that tool is `attestation/certifies/v1`.

**Sub-type URI format.** Sub-type URIs use the form `content/<noun>/v<N>` for `content/*` sub-types and `attestation/<verb>/v<N>` for `attestation/*` sub-types (per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §6). Sub-types are an open enum; new sub-types arrive via subsequent ADRs that name the motivating adopter per the Xanadu doctrine. The registry mechanism (how sub-type URIs are documented, versioned, mirrored, deprecated, governed across implementations) stays Xanadu-gated per [Q37](open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces) — specifying the registry mechanism prematurely is the foundational-layer version of the over-design the Xanadu doctrine exists to prevent.

**Q36 ratified sub-type table.** The v0.1 attestation sub-type table — `attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/supersedes/v1`, `attestation/publishes/v1`, `attestation/locatedAt/v1`, `attestation/corroborates/v1`, `attestation/contradicts/v1`, `attestation/endorses/v1`, `attestation/wasDerivedFrom/v1`, `attestation/answersQuestion/v1`, `attestation/supportedBy/v1`, `attestation/opposedBy/v1`, `attestation/certifies/v1`, `attestation/evaluates/v1`, `attestation/conforms/v1` — is ratified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 with three explicit refinements: `extractsTo` merges into `wasDerivedFrom` (with `AnalyticalDerivation` as the content-shape variant when source is untyped and target is typed); `endorses` and `corroborates` stay distinct sub-types (peer attestation vs. institutional endorsement carries meaningfully different signal); and Q38 resolves with `locatedAt` suffices, no `copyOf` sub-type. Each sub-type declares its authorization rule (`publisher-only`, `any-with-binding`, or `specific-role-required`) and its payload shape; the full table lives in [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 and is not duplicated here. Corresponding ratified `content/*` sub-types are `content/analysis/v1` (built — the legacy and datHere content shapes both map to it), `content/claim/v1` / `content/question/v1` / `content/evidence/v1` (reserved name-only — promotion gated on first typed-content producer), `content/host/v1` / `content/hostPolicy/v1` / `content/hostTermsOfUse/v1` (reserved name-only per [Q22](open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape)), and `content/tool/v1` (reserved name-only).

**The `content/*` sub-ontology — QEC + untyped.** Within the `content/*` family, the QEC sub-ontology specifies the typed-content sub-types — `content/claim/v1`, `content/question/v1`, `content/evidence/v1` — alongside `content/analysis/v1` (the default for AI-Assisted Analysis Producer Profile output, per [ADR-0006](../adr/0006-producer-profile-architecture.md) §4). A `content/analysis/v1` node's `metadata.contentType` is a set drawn from four values:

- `claim` — one or more conformant claims (assertions the producer is making)
- `question` — one or more conformant questions (asked but not-yet-answered queries)
- `evidence` — one or more conformant evidence records (captured observations or analytical artifacts)
- `untyped` — the envelope is valid, but the content has not been processed against any content profile yet (raw output pending extraction)

`untyped` is **mutually exclusive** with the typed values. There is no `mixed` value; multiplicity is expressed by the set having more than one member. When `contentType` has more than one member, the `content` field carries an array of individually-typed blocks, each conformant to its profile and each retaining its own provenance, confidence, scope, and AnalyticalDerivation (for claims). The AI-Assisted Analysis Producer Profile output (per [ADR-0006](../adr/0006-producer-profile-architecture.md) §4) is `content/analysis/v1` with `metadata.contentType: ["untyped"]`; subsequent typed-content extraction produces separately-signed `content/claim/v1` / `content/question/v1` / `content/evidence/v1` nodes referencing the source `content/analysis/v1` via `attestation/wasDerivedFrom/v1` (see below).

Relations among typed-content sub-types and the untyped source draw from the small set the `attestation/*` family already provides, plus the structural-primitive references inside `content/*` nodes.

```mermaid
flowchart LR
    U["content/analysis/v1<br/>(untyped — raw output)"]:::partial

    subgraph T["Typed content/* sub-types (reserved name-only)"]
        Q["content/question/v1"]:::reserved
        C["content/claim/v1"]:::reserved
        E["content/evidence/v1"]:::reserved
    end

    U -.->|"attestation/wasDerivedFrom/v1<br/>+ AnalyticalDerivation derivationMethod<br/>(classification-laundering guard)"| T

    C -->|"attestation/answersQuestion/v1"| Q
    C -->|"attestation/supportedBy/v1 / opposedBy/v1"| E
    C -.->|"attestation/corroborates/v1 / contradicts/v1 / supersedes/v1<br/>(separately-signed claim → claim)"| C
    E -.->|"attestation/wasDerivedFrom/v1<br/>(separately-signed evidence → evidence)"| E

    classDef partial fill:#fde68a,stroke:#92400e,color:#000
    classDef reserved fill:#fdba74,stroke:#9a3412,color:#000
```

**Attribution.** The QEC pattern — claim, question, evidence as the three first-class content types of a discourse representation — is from **Joel Chan's Discourse Graphs work**. The Discourse Graphs community has developed and used QEC for several years as a structural representation of scholarly discourse. Typed Standards' adoption is structurally similar: QEC nodes are `content/*` sub-types; relations among them are separately-signed `attestation/*` nodes between content-addressed packages. The relations vocabulary is intentionally minimal — `wasDerivedFrom` is inherited from W3C PROV-O; `supportedBy` / `opposedBy` are the QEC primitives; `answersQuestion` ties a claim back to a question; `corroborates` / `contradicts` carry the existing CCV claim-to-claim relations forward; `supersedes` carries claim versioning; all of them are `attestation/*` sub-types per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7. Domain extensions and producer profiles add domain-specific relations on top; the small core holds.

**Untyped → typed is an attested extraction step.** Processing an `untyped` `content/analysis/v1` node into typed content (`content/claim/v1` / `content/question/v1` / `content/evidence/v1`) is itself a first-class analytical step that MUST be attested via a separately-signed `attestation/wasDerivedFrom/v1` node. The attestation's `targetNodeId` points at the source untyped node, and its `derivationMethod` MUST carry an `AnalyticalDerivation` describing the extraction (which model or process performed the classification, against what prompt, over which source span) per the [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 refinement (a) MUST-carry rule. The rationale is the **classification-laundering guard**: unstructured output silently typed loses the audit trail, and the precision of the resulting types is then mistaken for the precision of the underlying analysis. `untyped` is the *input type to an attested extraction operation*, not a passive dumping ground.

**Extraction step belongs to the Producer Profile.** Per [ADR-0006](../adr/0006-producer-profile-architecture.md) §4, the AI-Assisted Analysis Producer Profile (the first specified producer profile) outputs `content/analysis/v1` with `metadata.contentType: ["untyped"]` as its primary artifact (the rendered answer is raw analytical output, not yet decomposed into typed claims/questions/evidence). The attested-extraction step from untyped to typed nodes is itself a feature of the AI-Assisted Analysis Producer Profile — it is part of *how AI-Assisted Analysis producers produce typed content downstream*, not a separate capability that exists outside profile boundaries. Other producer profiles (Human, Hybrid, Sandbox-only — all reserved name-only) may define their own extraction-step semantics or omit the extraction step entirely if their primary output is already typed. The shape of the extraction step is per-profile; the `attestation/wasDerivedFrom/v1` MUST-carry-`AnalyticalDerivation`-when-source-is-untyped-and-target-is-typed rule holds across all profiles as a `content/*` ↔ `attestation/*` interaction invariant.

**Layered signatures across typed nodes.** A package's nodes may carry signatures from different parties at different scopes — the producer who created the `content/*` node, a host that endorses it via `attestation/endorses/v1`, a certifying body that attests to a tool's conformance via `attestation/certifies/v1`, third parties that corroborate or contradict via `attestation/corroborates/v1` / `attestation/contradicts/v1`. These signatures **layer** rather than collapse: a verifier sees who signed what and at what scope, never a single composite verdict. An upstream tool/method certification (for example, a civic-data MCP certification issued by an open-data standards body) is its own `attestation/certifies/v1` node signed by the certifying body, targeting the tool author's `content/tool/v1`; the certifying body did not sign the tool author's content directly. A producer signs a `content/analysis/v1`; an institutional host MAY additionally sign packages meeting its policy via `attestation/endorses/v1`, and that host signature is independently verifiable. A third-party corroboration or contradiction `attestation/*` references the original `content/*` by `nodeId`; the corroborator's signature attaches to the attestation node, not to the original. The standard specifies how multiple signers and node types compose verifiably without forcing a single trust authority — and the `signer.identifier` ↔ `sig.kid → trust-registry signerIdentity` cross-check per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4 makes the layering tamper-evident at the verifier level.

---

## 7. What this is NOT — relationship to adjacent standards

| Standard / framework | Relationship to Typed Standards |
|---|---|
| **Discourse Graphs** | Source of the QEC pattern. Typed Standards adopts the claim-question-evidence content types and the `supportedBy` / `opposedBy` / `answersQuestion` relations with attribution. Discourse Graphs operates at the content-representation layer; Typed Standards operates at the envelope layer that wraps the content. |
| **Nanopublications** | Closest semantic match for atomic signed claims with provenance. Nanopubs use an RDF-named-graph format for the assertion + provenance + publication info triplet. Typed Standards is envelope-first and content-addressable with capture-method discipline; consuming Typed Standards content as nanopublications is a plausible bridge but a separate effort. |
| **W3C PROV-O** | Used directly. Every package's provenance graph is PROV-O JSON-LD; the envelope does not redefine derivation, attribution, or generation. |
| **W3C Verifiable Credentials** | Adjacent. VCs are a general signed-claim format; Typed Standards is opinionated about envelope properties (content-addressing, transparency log, capture method) in ways VCs are not. VC-over-MCP-tool-call receipts are a candidate trace-capture layer for the envelope's trace slot. |
| **Schema.org Claim / ClaimReview** | Different problem. Schema.org's fact-check vocabulary tags claims with human fact-check reviews. Typed Standards attests to *how the artifact was produced*, not whether a fact-checker endorsed it. The two can coexist; ClaimReview-style attestations could land alongside Typed Standards packages. |
| **C2PA** | Closest analogue in a different domain. C2PA attests to how an image or video was produced (capture device, edit history) via cryptographic signatures. Typed Standards is the same idea applied to analytical artifacts — production-process attestation, not truth verification. |
| **RO-Crate / WRROC** | Candidate package container. The end-state direction for the envelope's package format is a multi-file directory with an RO-Crate / WRROC compatibility profile (OES Open Question Q1). The envelope's cryptographic mechanics are independent of the container choice. |
| **DCAT / open-data catalogs** | Different layer. DCAT describes datasets and their distributions for catalog discovery. Typed Standards describes *analyses produced from those datasets*; data-source references inside a package may cite DCAT-described datasets, but Typed Standards does not catalog datasets itself. |

---

## 8. Status — honest snapshot

**Implemented in the reference deployment.**
- The cryptographic envelope: Ed25519ph signature, SHA-256 canonical-JSON content-addressing, RFC 3161 timestamp from a public TSA, Sigstore Rekor inclusion proof.
- Trust registry served at `/.well-known/evidence-public-keys.json` (the path the proposal renames to `typed-publisher.json`), with `active` / `deprecated` / `revoked` lifecycle status.
- `captureMethod` discipline with three values (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`), enforced at the publish route and covered by the signature per ADR-0003.
- `contentProfile` field (existing usage: `default` and `datHere`) carrying the A-G envelope (initial prompt, system prompts, model card + environment, deliberative trace, answer notebook, rendered answer, summary) with deterministic reproducibility against documented runtime and cross-host commitment-view schema per ADR-0004. Per [ADR-0006](../adr/0006-producer-profile-architecture.md), the existing `contentProfile: "datHere"` value is reframed as the first realized subtype of the AI-Assisted Analysis Producer Profile (`ai-assisted-analysis/datHere`); the field itself is retained as a legacy alias for backwards-compat.
- The executed-notebook architecture within the `datHere` subtype, per ADR-0005: backend pipeline (`/api/query-notebook`) generates and executes notebooks via Vercel Sandbox (python3.13 + pinned scientific stack + helper-function inlining); `notebookProvenance` discriminator (`skeleton` | `executed`) on the notebook extension; `org.civicaitools.execution` extension records executedAt + environment + sandboxId.
- Withdrawal and reinstatement lifecycle as signed, public, append-only events.
- W3C PROV-O provenance graphs derived from trace at publish time.
- Identity binding via one OAuth provider (the "weak" tier of the graded ladder).

**Specified but not implemented.**
- The Typed Claims Profile (the artifact formerly drafted as the Civic Claim Vocabulary v0.1): typed claim shapes (TrendClaim, ComparisonClaim, ObservationClaim, CompositionClaim, RelationshipClaim, QualitativeClaim); confidence-method discipline; AnalyticalDerivation as a translation-laundering guard; falsifiability requirement.
- The first domain extension — civic data analysis — drafted within the CCV draft, with geographic-scope subtypes (census tracts, ZIP code tabulation areas, school districts, neighborhood tabulation areas, community board districts, etc.). Not yet a separate document.
- The attestations layer (`consistency`, `evaluation`, `expert_attestation`) — supported in code as a parallel artifact type, not yet normatively specified at the envelope layer.
- The graded identity ladder beyond the weak tier (academic ID, DNS-bound institutional, notarized) — informative direction in OES §8.
- **Producer Profile architecture per [ADR-0006](../adr/0006-producer-profile-architecture.md)**: the `producerProfile` field (compound-string `<profile-type>/<profile-subtype>`), the subtype/flavor model, the legacy-alias relationship with `contentProfile`, and the principle of subtype-specific guidance bundles. The spec lives in ADR-0006; the packager + route + bundle-endpoint plumbing that emits `producerProfile` lands in Phase 3 of the executed-notebook architecture plan.
- The AI-Assisted Analysis Producer Profile (the first specified producer profile per ADR-0006; promoted from reserved → specified): the `datHere` subtype is the first realized subtype (built via the existing ADR-0004 + ADR-0005 implementation); `civicaitools-default` is reserved name-only; future adopter subtypes extend the enum.

**Specified (taxonomy registered; not yet built end-to-end).**
- The unified typed-attestation primitive per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md): one structural envelope, two top-level type families (`content/*` and `attestation/*`), formal `nodeId` ≡ envelope hash with verifier cross-check, `sig` vs. `signer` split with identity-binding cross-check (resolves Q35), authorization-rule taxonomy, sub-type URI format, and the Q36 ratified sub-type table.
- The `content/*` family: `content/analysis/v1` is **built** (the legacy and `datHere` content shapes both map to it via the implicit-type rule per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §9). Typed-content sub-types — `content/claim/v1`, `content/question/v1`, `content/evidence/v1` — are reserved name-only; promotion is gated on a first typed-content producer. The QEC sub-ontology with set-valued `metadata.contentType` across `claim` / `question` / `evidence` / `untyped`, the untyped → typed extraction-attestation rule (via `attestation/wasDerivedFrom/v1` MUST-carry-`AnalyticalDerivation`), and the small relation vocabulary live under this layer.
- The `attestation/*` family: the v0.1 sub-type table is ratified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7. Sub-types are specified at the taxonomy level (URI form, authorization rule, payload shape per the Q36 table); operationalization per sub-type lands in downstream ADRs. The visibility/lifecycle/location ADR (anticipated from [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71)) operationalizes `attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/publishes/v1`, and `attestation/locatedAt/v1`. The adversarial-eval requirement model ADR (anticipated from [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72)) operationalizes `attestation/evaluates/v1` as a publication gate.
- The host node sub-family within `content/*` — `content/host/v1`, `content/hostPolicy/v1`, `content/hostTermsOfUse/v1` — collapses from a reserved peer family (pre-ADR-0009 framing) to a reserved sub-family inside `content/*` per the [Q36](open-questions.md#q36--attestation-sub-type-collapse-regular-family-or-structured-hierarchy) finding. A host declaring its own identity or policy has no target node, so the assertions are `content/*` (standalone); a host endorsing others' content is `attestation/endorses/v1` (targeted). Spec-work tracked under [Q22](open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape); reserved name-only until a real host-self-attestation adopter blocks.
- The tool / certifying-body node pattern: a tool author's declaration is `content/tool/v1` (reserved name-only); a certifying body's authority-bearing attestation about that tool is `attestation/certifies/v1` (reserved name-only at the operationalization level; URI registered per the Q36 table). Collapses from a reserved peer family to a sub-shape distributed across `content/*` and `attestation/*` per the same Q36 finding.

**Specified (taxonomy registered; layered signatures composition pattern).**
- The layered-signatures model — signatures from different parties (producers of `content/*` nodes; hosts emitting `attestation/endorses/v1`; certifying bodies emitting `attestation/certifies/v1`; third-party attestation authors emitting `attestation/corroborates/v1` / `attestation/contradicts/v1`; etc.) attaching to different nodes and composing without collapsing into a single trust authority. The composition pattern is now specified per [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4 (the `signer.identifier` ↔ `sig.kid → trust-registry signerIdentity` cross-check) plus the authorization-rule taxonomy (§5) plus the Q36 sub-type table. Today's reference implementation supports producer signatures over `content/analysis/v1` and (in attestation form) third-party signatures over existing OES §15 attestations; the unified-primitive operationalization (host signatures, certifying-body signatures, etc.) lands in downstream ADRs.

**Reserved (named, not specified).**
- Typed Evidence Profile and Typed Questions Profile (the Claim profile is the only one drafted).
- Producer Profile types beyond AI-Assisted Analysis: **Human** (human-produced analysis without an AI agent in the synthesis loop), **Hybrid** (mixed human + AI production), **Sandbox-only** (content produced entirely by a sandbox-executed pipeline without an interactive synthesis step). Reserved name-only per ADR-0006 §1; each future profile type lands in its own ADR with the motivating adopter named.
- Producer Profile guidance-doc routing convention (Q32). ADR-0006 §5 establishes the principle that each subtype names a guidance bundle; the routing convention (URLs, repos, hashes, hybrid) is deferred to a future ADR.
- Visualizations and other analytical artifacts as their own evidence nodes (Q33; multi-node-per-query) — idea worth exploring, not ready for ADR.
- A future Sandbox capture method as the highest-attestation capture tier, with a two-trust-domain model — the analyst signs the package, the sandbox operator signs an independent execution attestation. Not yet drafted.
- The publisher registry as an indexing-only coordination surface at `typedstandards.org`.
- The renamed trust-registry well-known path (`evidence-public-keys.json` → `typed-publisher.json`) and the namespace prefix change (`ccv:` → `ts:`; in current canonical-JSON provenance graphs, also the `civic:` prefix that does appear in code today).

---

## 9. Open questions

**Inherited from the existing standards work** (cited by Q-number from `open-questions.md`):

- **Q1 — Package format.** Single-blob canonical JSON today; multi-file RO-Crate / WRROC-compatible directory is the target. Drives whether third-party offline verification is achievable.
- **Q2 — Federation substrate.** No commitment among candidate substrates. Independent of package format.
- **Q3 — First non-OAuth identity provider.** ORCID, sigstore OIDC keyless, DNS-bound `did:web` are candidates; the graded ladder beyond the weak tier remains informative until one lands.
- **Q4 — Trace capture.** Hand-rolled OTel-shaped JSON today; alternatives include a real OpenTelemetry SDK with GenAI + MCP semantic conventions, or W3C-VC-based receipts over MCP tool calls.
- **Q15, Q16 — Conformance test suite and external verification testing.** No formal conformance criteria exist; the offline-verifiability claim has not yet been exercised against a conformant package by a party with no access to the publisher's server endpoints. Until exercised, the claim is a target, not a property.

**Resolved by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) 2026-05-25 (the unified typed-attestation primitive cohort):**

- ~~**The typed-node ontology's normative status.**~~ — *Resolved 2026-05-25 by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md).* Two top-level type families (`content/*` and `attestation/*`) sit over one structural primitive; the prior four-families-as-peers framing is demoted (hosts, tools, certifying bodies fold in as sub-types of one of the two families). Within `content/*`, the QEC sub-ontology (set-valued `metadata.contentType` across `claim` / `question` / `evidence` / `untyped`) is normative for `content/analysis/v1`; typed-content sub-types (`content/claim/v1` / `content/question/v1` / `content/evidence/v1`) carry their own per-sub-type requirements per future ADRs. The v0.1 sub-type table is ratified by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7. The type-registry mechanism stays Xanadu-gated per [Q37](open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces).
- ~~**Extraction-attestation strength.**~~ — *Resolved 2026-05-25 by [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §7 refinement (a) + [ADR-0006](../adr/0006-producer-profile-architecture.md) §4.* The attested-extraction form is mandatory: when typed content is derived from an `untyped` source, a separately-signed `attestation/wasDerivedFrom/v1` MUST carry an `AnalyticalDerivation` describing the extraction method as its `derivationMethod` payload. This is the classification-laundering guard, encoded as a MUST-carry rule at the sub-type level (no separate `extractsTo` sub-type minted).
- ~~**The `contentProfile` field's semantics under the new layering.**~~ — *Resolved 2026-05-23 by [ADR-0006](../adr/0006-producer-profile-architecture.md).* The new framing introduces a `producerProfile` field (compound-string `<profile-type>/<profile-subtype>`) and reframes the existing `datHere` content profile as the first subtype of the AI-Assisted Analysis Producer Profile (`ai-assisted-analysis/datHere`). The `contentProfile` field is retained as a legacy alias for backwards-compatibility per ADR-0006 §2 (consistency invariant: `contentProfile === "datHere"` iff `producerProfile.startsWith("ai-assisted-analysis/datHere")`). The Content Profiles axis (typed-content carriers — Typed Claims / Typed Evidence / Typed Questions) is a distinct concept; under the two-family taxonomy ratified by ADR-0009, these are `content/*` sub-types. Eventual deprecation tracked under [Q27](open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec) (schema version bump trigger).
- ~~**Producer-profile boundary.**~~ — *Resolved 2026-05-23 by [ADR-0006](../adr/0006-producer-profile-architecture.md) for AI-Assisted Analysis.* The line is drawn for `ai-assisted-analysis/datHere` (the A-G envelope is a production-process attestation shape per ADR-0006 §3; the AI-Assisted Analysis Producer Profile output is `content/analysis/v1` with `metadata.contentType: ["untyped"]`; the extraction step to typed content is a per-profile feature per ADR-0006 §4). The boundary between AI-Assisted Analysis and other reserved profile types (Human, Hybrid, Sandbox-only) is not yet drawn; each future profile type lands in its own ADR with the motivating adopter named.

**Still open:**

- **Publisher-registry conformance properties.** Indexing without gatekeeping is the design intent; the conformance properties an indexed publisher must meet are not yet specified.
- **Per-tier identity-binding schemas.** [ADR-0009](../adr/0009-unified-typed-attestation-primitive.md) §4 establishes the `signer` object's placement and the verifier cross-check rule; the fully-fleshed-out per-tier schemas (what `signer.identifier` looks like for `orcid`, `did-web`, `notarized`) stay tied to [Q3](open-questions.md#q3--first-non-github-identity-provider) (first non-GitHub identity provider) and are blocked on a real adopter needing a specific tier.

---

## 10. Project posture

- **Permissionless publishing.** Publishers publish at their own domains. An institutional publisher's domain is its sovereignty boundary; an independent publisher's domain is theirs. The standard specifies the envelope; it does not host content.
- **Indexing, not gatekeeping.** The reserved publisher registry indexes declared publishers — it does not approve them, host them, rank them, or vouch for their content. Inclusion is informational.
- **Graded identity surfaced, not computed.** Identity binding tiers (pseudonymous → OAuth-bound → academic-bound → institution-DNS-bound → notarized) are surfaced as signals consumers can filter on. The standard never computes a platform-issued trust verdict from them.
- **Don't build until an adopter needs it.** Project discipline per `xanadu-doctrine.md`: items move from reserved → specified → built only when a real adopter or package concretely needs the change. This proposal sketches reserved layers; it does not promote any of them. Promotions happen separately, with the motivating adopter named in the work that promotes the item.

---

## 11. Related documents

- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — the envelope spec under its previous name (Open Evidence Standard / OES); authoritative for envelope mechanics, capture-method discipline, the `datHere` content profile, withdrawal lifecycle, and verification properties until renamed.
- `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` — Typed Claims Profile draft under its previous name (Civic Claim Vocabulary / CCV); authoritative for claim shapes, confidence methods, AnalyticalDerivation, and the civic-data geographic-scope taxonomy.
- `civic-ai-tools/docs/architecture/end-state-vision.md` — architectural rationale, layered standards stack, build-state coloring convention used in this proposal, full glossary, and network-signal model.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — project discipline governing how reserved layers are promoted.
- `civic-ai-tools/docs/architecture/open-questions.md` — the open-questions registry (Q-numbers referenced in §9).
- `civic-ai-tools/docs/adr/0003-evidence-capture-method.md` — capture-method vocabulary and tamper-evident labeling.
- `civic-ai-tools/docs/adr/0004-dathere-captureMethod-variant.md` — the `datHere` content profile, the A-G envelope, the canonical-notebook requirement, and the cross-host commitment-view schema.
