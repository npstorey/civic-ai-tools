// ============================================================================
//  Typed Standards Specification v0.1.x — SysML v2 model
//
//  Normative source : docs/architecture/typed-standards-specification.md
//  Companion prose  : research/02-typed-standards-as-sysml-v2.md (formalization
//                     study), research/05-typed-standards-spec-architecture-views.md
//                     (needs / functional / logical views)
//  Sibling view     : research/shapes/typed-standards.shacl.ttl (instance-level
//                     graph-shape validation — SHACL's authoritative territory)
//
//  Package map
//    BuildState          annotation vocabulary (built / partial / reserved / ...)
//    Primitives          shared scalar aliases + small value objects
//    Envelope            the structural primitive: SignedNode + its parts (§7.4)
//    Taxonomy            two-family taxonomy: content + attestation families (§7.4, §8.12)
//    ContentAnalysis     content/analysis/v1 payload: EvidencePackage (§8.1)
//    TypedClaims         §8.11 typed-claims vocabulary (specified, Q5)
//    CaptureAndProfiles  captureMethod + producer/content profiles (§8.6–§8.7)
//    Infrastructure      system context: registry, TSA, Rekor, blob store (§7.3)
//    Lifecycle           the four state machines (§8.10, §8.3.3, §8.7.4)
//    Verification        §9.2 ordered check flow + structural validations
//    Conformance         §9 requirements corpus + satisfy/verify traceability
// ============================================================================

package TypedStandards {
    doc /* Typed Standards Specification v0.1.x as a SysML v2 model.

         Normative source: docs/architecture/typed-standards-specification.md.
         Descriptive model; the spec text is normative. One of the parallel
         research views over the spec (research/00-05); each view answers to
         the spec, not to the other views.

         Modeling boundaries:
         - Crypto/log/network checks are delegated to external opaque actions
           and are NOT executed by this model (the hard boundary of 03 §3).
         - Instance-level graph-shape validation is SHACL's authoritative
           responsibility; the ValidateStructure constraints name, but do not
           express, those shapes.
         - Coverage: behavior modeling covers the §9.2 verify flow + structural
           validations and the four lifecycle machines (§8.10, §8.3.3, §8.7.4);
           the publisher pipeline (§9.1) and cross-host publication (§8.8-§8.9)
           are deliberately unmodeled.

         Notation conventions used throughout:
         - 'ref', 'metadata', 'subject', 'default' are SysML keywords; where the
           spec uses them as field names they appear as quoted-name escapes.
         - Scalar vocabulary names (UriString, HexDigest, ...) are ALIASES of
           ScalarValues::String, not attribute subtypes: string literals (e.g.
           default "content/analysis/v1") must type-conform to the declared
           attribute type, and a literal's type is String.
         - Build states are prefix metadata (#BuildState::Built etc.), one
           metaclass per level, per end-state-vision.md's coloring.
         - Comment text never contains the two-character sequence slash-star
           (the spec's content/star and attestation/star namespace shorthands
           are written out): block comments lex as nested, so the sequence
           inside a doc body opens another nesting level.

         Known analyzer residue (SySide warnings, not errors): feature chains
         through requirement subjects and transition accept payloads (e.g.
         pkg.sig.algorithm, w.reason) and the library actions start/done may
         report unresolved references in current tooling; they follow the
         SysML v2 grammar and are kept as written. */
}

// ============================================================================
//  BUILD STATE — annotation vocabulary
// ============================================================================
package BuildState {
    doc /* Build-state coloring per end-state-vision.md, applied as prefix
         metadata on definitions (e.g. #BuildState::Reserved part def ...).
         One metadata def per level: SysML v2 prefix metadata must be typed
         directly by a metaclass, so the levels cannot be carried as values
         of a single parameterized metaclass. */

    metadata def Built;      // implemented end-to-end in the reference stack
    metadata def Partial;    // partially implemented
    metadata def Reserved;   // name-only reservation; promotion Xanadu-gated
    metadata def Ratified;   // taxonomy ratified (ADR-0009); operationalization lands per-ADR
    metadata def Specified;  // fully specified, not built (e.g. typed claims per Q5)
}

// ============================================================================
//  PRIMITIVES — shared scalar aliases + small value objects
// ============================================================================
package Primitives {
    private import ScalarValues::*;

    // Documentation aliases over String (see header note on literal conformance).
    alias UriString for ScalarValues::String;   // URI-valued strings
    alias HexDigest for ScalarValues::String;   // lowercase hex digests
    alias Base64    for ScalarValues::String;   // base64-encoded bytes
    alias Iso8601   for ScalarValues::String;   // ISO-8601 UTC timestamps

    attribute def ContentHash {
        doc /* §8.2 / ADR-0008 — multihash digest set fingerprinting the off-log
             content. Keyed by lowercase algorithm name; at least one entry,
             sha256 required by default; verifier passes on at-least-one match. */
        attribute sha256   : HexDigest[1];
        attribute sha3_256 : HexDigest[0..1];
        attribute blake3   : HexDigest[0..1];
    }

    item def BlobRef {
        doc /* §8.1.5 — by-reference substitution for large sub-content
             (output, trace, skillMetadata.skillText). The single-signer
             implicit case of attestation/locatedAt/v1's verification rule:
             fetch url, recompute sha256, confirm size. */
        attribute 'ref'       : String[1];       // "blob:sha256:<64-hex>" ('ref' is a SysML keyword)
        attribute url         : UriString[1];
        attribute contentType : String[1];
        attribute size        : Integer[1];
    }

    item def DerivationMethod;
        doc /* §8.12.1 — the wasDerivedFrom payload object. A plain object at
             the sub-type level; TypedClaims::AnalyticalDerivation specializes
             it for the untyped-to-typed extraction case. */
}

// ============================================================================
//  ENVELOPE — the structural primitive (§6.2, §7.1, §7.4 / ADR-0009 §1)
// ============================================================================
package Envelope {
    private import Primitives::*;
    private import ScalarValues::*;

    item def SignatureEnvelope {
        doc /* §8.3.1 — what was signed and by what key. Signature is Ed25519ph
             over the UTF-8 bytes of the envelope-hash hex string. Distinct
             from Signer (who claims to have signed); the verifier cross-checks
             the two via the trust registry (§9.2 check #14). */
        attribute signature : Base64[1];
        attribute publicKey : Base64[1];         // base64 DER SPKI
        attribute algorithm : String[1] default "Ed25519ph";
        attribute kid       : String[1];
    }

    item def Signer {
        doc /* §8.5 / §6.2 — envelope-side identity claim (who claims to have
             signed). Recommended v0.1; pre-v0.1 packages carry none and the
             verifier derives an implicit signer from the trust registry. */
        attribute bindingTier : Taxonomy::BindingTier[1];
        attribute identifier  : String[1];       // provider-prefixed, e.g. "github:<user>:<id>"
        attribute displayName : String[1];
        attribute verifiedAt  : Iso8601[0..1];
    }

    item def Rfc3161Timestamp {                  // §8.3.2 — best-effort at publish time
        attribute token : Base64[1];
    }

    item def RekorInclusionProof {               // §8.3.2 — hashedrekord entry + RFC 6962 proof
        attribute entryId        : String[1];
        attribute inclusionProof : Base64[1];
        attribute checkpoint     : Base64[1];    // signed note; verified against pinned log key (§10.3)
    }

    item def Metadata {
        doc /* §8.1.2 — the metadata object of the canonical JSON. */
        attribute schemaVersion  : String[1] default "0.1.0";   // stays 0.1.0 per Q27
        attribute packageId      : String[1];                   // UUID; distinct from the envelope hash
        attribute createdAt      : Iso8601[1];
        attribute signingKeyId   : String[1];                   // MUST equal sig.kid (§9.2 check #6)
        attribute captureMethod  : CaptureAndProfiles::CaptureMethodLabel[1];
        attribute contentType    : ContentAnalysis::QecContentType[0..*];
            // §7.5 QEC framing; not part of the §8.1.2 required field set.
        attribute contentProfile : CaptureAndProfiles::ContentProfile[0..1];
            // Spec places this top-level (§8.1.1) AND under metadata (§8.7.1(7));
            // the field rename that would resolve it is deferred per ADR-0006/Q27.
    }

    abstract part def SignedNode {
        doc /* The structural primitive (§7.4 / ADR-0009 §1): every conformant
             signed node, whichever family it belongs to, is this envelope over a
             typed payload. Sub-type payload fields live alongside the primitive
             at the canonical-JSON top level (§8.1 bridge note). */
        attribute type                    : Primitives::UriString[1];
        attribute contentHash             : Primitives::ContentHash[1];
        attribute contentCanonicalization : Primitives::UriString[0..1];
            // Recommended (v0.1); pre-v0.1 verifiers infer the rule from the profile (§8.1.1).
        ref item sig                 : SignatureEnvelope[1];
        ref item signer              : Signer[0..1];             // recommended (v0.1)
        ref item timestamp           : Rfc3161Timestamp[0..1];   // SHOULD (§8.3.2)
        ref item rekorInclusionProof : RekorInclusionProof[0..1];// SHOULD (§8.3.2)
        ref item 'metadata'          : Metadata[1];              // ('metadata' is a SysML keyword)
        derived attribute nodeId : Primitives::HexDigest[1];
            // nodeId IS the envelope hash by construction (ADR-0009 §3): the
            // SHA-256 of the JCS-canonicalized unsigned envelope, computed
            // out-of-band at verify time (Verification::computeEnvelopeHash),
            // never stored. Left unbound here — the computation is out-of-band.
    }
}

// ============================================================================
//  TAXONOMY — two families over one primitive (§7.4 / ADR-0009 §2, §8.12)
// ============================================================================
package Taxonomy {
    private import Envelope::*;
    private import ScalarValues::*;

    enum def BindingTier {
        doc /* §8.5 — graded identity ladder (informative direction; GitHub is
             the only built tier) plus the registry-side values: 'platform'
             (registry example §8.3.3) and 'legacy_embedded' (pre-registry
             fallback). */
        pseudonymous; github; orcid; did_web; notarized; platform; legacy_embedded;
    }

    enum def AuthorizationRule {
        doc /* §8.12.1 / ADR-0009 §5 — who may emit an attestation sub-type.
             'self_attestation' appears only on attestation/conforms/v1. */
        publisher_only; any_with_binding; specific_role_required; self_attestation;
    }

    abstract part def TypedNode :> SignedNode {
        attribute targetNodeId : Primitives::HexDigest[0..*];
    }
    abstract part def ContentNode :> TypedNode {
        doc /* §7.4 — standalone assertion; MUST NOT carry targetNodeId. */
        attribute redefines targetNodeId : Primitives::HexDigest[0];
    }
    abstract part def AttestationNode :> TypedNode {
        doc /* §7.4 — assertion about another node; MUST carry >=1 targetNodeId. */
        attribute redefines targetNodeId : Primitives::HexDigest[1..*];
        attribute authorizationRule : AuthorizationRule[1];
    }

    // ------------------------------------------------------------------
    // content/<noun>/vN sub-types (§7.4 ratified list)
    // ------------------------------------------------------------------
    #BuildState::Built part def AnalysisNode :> ContentNode {
        attribute redefines type default "content/analysis/v1";
        ref item payload : ContentAnalysis::EvidencePackage[1];
    }
    #BuildState::Reserved part def ClaimNode :> ContentNode {
        attribute redefines type default "content/claim/v1";
        ref item payload : TypedClaims::ClaimDocument[1];
    }
    #BuildState::Reserved part def QuestionNode :> ContentNode {
        attribute redefines type default "content/question/v1"; }
    #BuildState::Reserved part def EvidenceNode :> ContentNode {
        attribute redefines type default "content/evidence/v1"; }
    #BuildState::Reserved part def HostNode :> ContentNode {                 // Q22
        attribute redefines type default "content/host/v1"; }
    #BuildState::Reserved part def HostPolicyNode :> ContentNode {           // Q22
        attribute redefines type default "content/hostPolicy/v1"; }
    #BuildState::Reserved part def HostTermsOfUseNode :> ContentNode {       // Q22
        attribute redefines type default "content/hostTermsOfUse/v1"; }
    #BuildState::Reserved part def ToolNode :> ContentNode {
        attribute redefines type default "content/tool/v1"; }

    // ------------------------------------------------------------------
    // attestation/<verb>/vN sub-types — the Q36 ratified table (§8.12.1)
    // Payload fields beyond the structural primitive, per row.
    // ------------------------------------------------------------------
    #BuildState::Ratified part def WithdrawsNode :> AttestationNode {
        attribute redefines type default "attestation/withdraws/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute reason      : String[1];                 // required, non-empty
        attribute effectiveAt : Primitives::Iso8601[0..1]; // defaults to envelope timestamp
    }
    #BuildState::Ratified part def ReinstatesNode :> AttestationNode {
        attribute redefines type default "attestation/reinstates/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute priorWithdrawalNodeId : Primitives::HexDigest[1];
        attribute reason : String[0..1];
    }
    #BuildState::Ratified part def SupersedesNode :> AttestationNode {
        attribute redefines type default "attestation/supersedes/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
        attribute successorNodeId : Primitives::HexDigest[1];
    }
    #BuildState::Ratified part def PublishesNode :> AttestationNode {
        attribute redefines type default "attestation/publishes/v1";
        attribute redefines authorizationRule default AuthorizationRule::publisher_only;
            // ...OR delegated-publisher per Q20 (mechanics land in a future ADR).
        attribute publicationHost : String[1];
        attribute releasedAt      : Primitives::Iso8601[1];
    }
    #BuildState::Ratified part def LocatedAtNode :> AttestationNode {
        attribute redefines type default "attestation/locatedAt/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute uri : Primitives::UriString[1];
        attribute targetContentHash : Primitives::ContentHash[1];
            // Spec payload name: `contentHash` — the TARGET's fingerprint as
            // hosted at `uri` (SHOULD match the target's own contentHash;
            // mismatch is informative content drift). Renamed in the model:
            // the spec name would shadow the node's own inherited
            // Envelope::SignedNode::contentHash.
        attribute contentLength : Integer[0..1];
        attribute availability  : String[0..1];
    }
    #BuildState::Ratified part def WasDerivedFromNode :> AttestationNode {
        attribute redefines type default "attestation/wasDerivedFrom/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        ref item derivationMethod : Primitives::DerivationMethod[1];
            // §8.12.1: a plain object. MUST be a ts:AnalyticalDerivation only
            // when the source is untyped content/analysis/v1 and the target is
            // a typed content sub-type (ADR-0009 refinement (a) — the
            // classification-laundering guard; §8.11.3 step 2).
    }
    #BuildState::Ratified part def AnswersQuestionNode :> AttestationNode {
        attribute redefines type default "attestation/answersQuestion/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
    }
    #BuildState::Ratified part def SupportedByNode :> AttestationNode {
        attribute redefines type default "attestation/supportedBy/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
    }
    #BuildState::Ratified part def OpposedByNode :> AttestationNode {
        attribute redefines type default "attestation/opposedBy/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
    }
    #BuildState::Ratified part def CorroboratesNode :> AttestationNode {
        attribute redefines type default "attestation/corroborates/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute scope     : String[1];
        attribute reasoning : String[0..1];
    }
    #BuildState::Ratified part def ContradictsNode :> AttestationNode {
        attribute redefines type default "attestation/contradicts/v1";
        attribute redefines authorizationRule default AuthorizationRule::any_with_binding;
        attribute scope     : String[1];
        attribute reasoning : String[0..1];
    }
    #BuildState::Ratified part def EndorsesNode :> AttestationNode {
        doc /* Institutional vouching — kept distinct from peer corroboration
             per ADR-0009 refinement (b). */
        attribute redefines type default "attestation/endorses/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute scope : String[1];
    }
    #BuildState::Ratified part def CertifiesNode :> AttestationNode {
        attribute redefines type default "attestation/certifies/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        attribute certificationScheme : String[1];
        attribute validityWindow      : String[1];
    }
    #BuildState::Ratified part def EvaluatesNode :> AttestationNode {
        attribute redefines type default "attestation/evaluates/v1";
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
            // Evaluator definition (identity binding + methodology declaration) per Q26.
        attribute methodology   : String[1];
        attribute scoringRubric : String[1];
        ref item results : String[1];
    }
    #BuildState::Ratified part def ConformsNode :> AttestationNode {
        attribute redefines type default "attestation/conforms/v1";
        // §8.12.1: self-attestation OR specific-role-required (third-party).
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        assert constraint { (authorizationRule == AuthorizationRule::self_attestation)
                         or (authorizationRule == AuthorizationRule::specific_role_required) }
        attribute standardId : Primitives::UriString[1];
    }
}

// ============================================================================
//  CONTENT/ANALYSIS — the content/analysis/v1 payload (§8.1)
// ============================================================================
package ContentAnalysis {
    private import Primitives::*;
    private import Envelope::*;
    private import ScalarValues::*;

    item def Cost {
        doc /* §8.1.7 — AI-LLM-specific shape; producer-type generalization is
             tracked under Q7/Q9 and lands as its own ADR when an adopter blocks. */
        attribute promptTokens     : Integer[1];
        attribute completionTokens : Integer[1];
        attribute totalTokens      : Integer[1];
        attribute model            : String[1];
        attribute durationMs       : Integer[1];
    }

    enum def PromptVisibility { full_text; hash_only; }          // §8.1.3

    item def Prompt {                                            // §8.1.3
        attribute hash       : HexDigest[1];
        attribute visibility : PromptVisibility[1];
        attribute text       : String[0..1];                     // present iff full_text
    }

    enum def QecContentType {
        doc /* §7.5 — the QEC set. 'untyped' is mutually exclusive with the
             typed values; multiplicity expresses multi-typed content. */
        claim; question; evidence; untyped;
    }

    item def SkillMetadata {                                     // §8.1.1
        attribute skillText : String[0..1];
        ref item skillTextBlob : BlobRef[0..1];
        attribute mcpServerUrl : UriString[0..*];
    }

    item def NotebookExtension {
        doc /* §8.7.2 / §8.7.4 — org.civicaitools.notebook content-format marker.
             format e.g. "jupyter-v4.5" | "marimo-v0.x"; provenance
             "skeleton" | "executed" (absent reads as skeleton). */
        attribute format     : String[0..1];
        attribute provenance : String[0..1];
    }

    item def McpServerRef {                                      // §8.7.1(3)
        attribute url  : UriString[1];
        attribute name : String[0..1];
    }

    item def EnvironmentExtension {
        doc /* §8.7.1(3) — org.civicaitools.environment; normatively required
             under the datHere content profile. */
        attribute modelVersion : String[1];
        attribute temperature  : Real[1];
        ref item mcpServers : McpServerRef[0..*];
        attribute toolDefinitions : String[0..*];
        ref item toolDefinitionsBlob : BlobRef[0..1];            // array OR BlobRef when large
        attribute host : String[1];                              // publishing-host identifier
    }

    item def ExtensionsMap {                                     // §8.1.6 reverse-DNS-keyed
        ref item notebook    : NotebookExtension[0..1];
        ref item environment : EnvironmentExtension[0..1];
    }

    item def EvidencePackage {
        doc /* §8.1 — the content/analysis/v1 payload fields (the structural-
             primitive fields live on Envelope::SignedNode; see the §8.1
             bridge note). output/trace/skillText admit BlobRef substitution
             per §8.1.5 — modeled as inline-or-blob field pairs. */
        ref item 'metadata' : Metadata[1];
        ref item prompt     : Prompt[1];
        attribute queries     : String[0..*];                    // one entry per observed tool call
        attribute dataSources : String[0..*];                    // derived from queries[] + trace
        ref item cost          : Cost[1];
        ref item skillMetadata : SkillMetadata[1];
        attribute output : String[0..1];   ref item outputBlob : BlobRef[0..1];
        attribute trace  : String[0..1];   ref item traceBlob  : BlobRef[0..1];
        attribute summary : String[0..1];                        // REQUIRED under datHere (§8.7.1(6))
        attribute producerProfile : CaptureAndProfiles::ProducerProfile[0..1];
            // §8.1.1 top-level field; consistency invariant with contentProfile
            // per Verification::ProfileConsistencyShape.
        ref item provenance : String[0..1];                      // PROV-O JSON-LD graph (§8.1.4)
        ref item extensions : ExtensionsMap[0..1];
    }
}

// ============================================================================
//  TYPED CLAIMS — §8.11 vocabulary (specified, not built; gated on Q5)
// ============================================================================
package TypedClaims {
    private import Primitives::*;
    private import ScalarValues::*;

    // ---- scope (§8.11.4) --------------------------------------------------
    item def TemporalInterval {                                  // W3C OWL-Time shapes
        attribute hasBeginning : Iso8601[0..1];
        attribute hasEnd       : Iso8601[0..1];
        attribute inXSDDate    : Iso8601[0..1];
    }
    item def GeographicScope {                                   // ts:GeographicScope
        attribute identifier  : String[0..1];
        attribute name        : String[0..1];
        attribute hasGeometry : String[0..1];                    // OGC GeoSPARQL geometry literal
    }
    // §8.11.4 civic-unit subtype taxonomy (each names its reference authority in the spec).
    item def CensusTract :> GeographicScope;
    item def CensusBlock :> GeographicScope;
    item def CensusBlockGroup :> GeographicScope;
    item def ZIPCodeTabulationArea :> GeographicScope;
    item def SchoolDistrict :> GeographicScope;
    item def MunicipalBoundary :> GeographicScope;
    item def CountyBoundary :> GeographicScope;
    item def StateBoundary :> GeographicScope;
    item def NeighborhoodTabulationArea :> GeographicScope;      // NYC-specific
    item def CommunityBoardDistrict :> GeographicScope;          // NYC-specific
    item def CityCouncilDistrict :> GeographicScope;             // jurisdiction-specific
    item def PolicePrecinct :> GeographicScope;                  // name flagged NYC-coded per Q14
    item def Scope {                                             // ts:Scope — where + when
        ref item geographicScope : GeographicScope[1];
        ref item temporalScope   : TemporalInterval[1];
    }

    // ---- confidence (§8.11.4) ----------------------------------------------
    enum def ConfidenceMethod {
        doc /* Confidence MUST be method-derived, never asserted (§8.11.2
             principle 6); NotApplicable requires an explanatory description. */
        FrequentistInterval; BayesianCredibleInterval; SampleSizeBased;
        LLMReportedLogProbability; HumanReview; NotApplicable;
    }
    item def ConfidenceStatement {                               // ts:ConfidenceStatement
        attribute method          : ConfidenceMethod[1];
        attribute level           : Real[0..1];
        attribute lowerBound      : Real[0..1];
        attribute upperBound      : Real[0..1];
        attribute methodReference : String[0..1];                // e.g. "trace.json#step-stat-test-3"
    }

    // ---- derivation provenance (§8.11.4) ------------------------------------
    item def OutputSpan {                                        // pins a claim to source bytes
        attribute outputFile : String[1];
        attribute byteRange  : Integer[2];
    }
    item def AnalyticalDerivation :> DerivationMethod {
        doc /* ts:AnalyticalDerivation — makes the LLM-prose-to-structured-claim
             translation auditable: which model, what prompt, over which span. */
        attribute traceReference : String[1];
        ref item translationModel : String[1];
        attribute translationPrompt : String[1];
        ref item sourceOutputSpan : OutputSpan[1];
    }

    // ---- the Claim hierarchy (§8.11.4–§8.11.5) ------------------------------
    abstract item def Magnitude;                                 // absolute or percent (shape unspecified in spec)
    abstract item def Component;                                 // CompositionClaim part (shape unspecified in spec)

    abstract item def Claim {
        doc /* ts:Claim — required core: identifier, subject, scope, confidence,
             wasDerivedFrom (>=1 provenance entity), derivedVia. Optional:
             description, limitations, and the inline claim-to-claim relations
             (also expressible as separately-signed attestation nodes). */
        attribute identifier : String[1];
        attribute 'subject'  : UriString[1];                     // ('subject' is a SysML keyword)
        ref item scope      : Scope[1];
        ref item confidence : ConfidenceStatement[1];
        attribute wasDerivedFrom : UriString[1..*];
        ref item derivedVia : AnalyticalDerivation[1];
        attribute description : String[0..1];
        attribute limitations : String[0..1];
        attribute contradicts  : UriString[0..*];
        attribute corroborates : UriString[0..*];
        attribute supersedes   : UriString[0..1];
    }

    enum def TrendDirection { Increase; Decrease; NoSignificantChange; }
    enum def ComparisonRel  { GreaterThan; LessThan; ApproximatelyEqual; }

    item def TrendClaim :> Claim {                               // metric moved across two periods
        attribute metric : UriString[1];
        ref item baselinePeriod   : TemporalInterval[1];
        ref item comparisonPeriod : TemporalInterval[1];
        attribute direction : TrendDirection[1];
        ref item magnitude : Magnitude[1];
    }
    item def ComparisonClaim :> Claim {                          // two scopes differ on a metric
        attribute metric : UriString[1];
        ref item scopeA : Scope[1];
        ref item scopeB : Scope[1];
        attribute relation : ComparisonRel[1];
        ref item magnitude : Magnitude[1];
    }
    item def ObservationClaim :> Claim {                         // metric had a value (qb:Observation)
        attribute metric : UriString[1];
        attribute value  : Real[1];
        attribute unit   : UriString[1];                         // QUDT / UCUM reference
    }
    item def CompositionClaim :> Claim {                         // whole broken into components
        ref item whole : Scope[1];
        ref item components : Component[1..*];
        attribute totalsTo : Real[1];                            // 1.0 for proportions, total $ for budgets
    }
    item def RelationshipClaim :> Claim {                        // statistical relation; causal claims deliberately absent (§8.11.7)
        attribute metricA : UriString[1];
        attribute metricB : UriString[1];
        attribute relationshipType : UriString[1];
        attribute strength : Real[1];
    }
    item def QualitativeClaim :> Claim {                         // permitted but flagged (§8.11.5)
        attribute assertion : String[1];
        attribute groundingMethod : UriString[1];
    }

    item def ClaimDocument {                                     // JSON-LD carrier inside content/claim/v1
        attribute context : UriString[1..*];                     // MUST include https://typedstandards.org/ns/ts#
        ref item graph : Claim[1..*];
    }
}

// ============================================================================
//  CAPTURE & PROFILES — §8.6 captureMethod, §8.7 datHere content profile
// ============================================================================
package CaptureAndProfiles {
    private import Taxonomy::*;
    private import ContentAnalysis::*;
    private import ScalarValues::*;

    alias CaptureMethodLabel for ScalarValues::String;
        // §8.6 — value space open at the core; valid values are declared per
        // Producer Profile guidance bundle, so no closed enum here.
    alias ProducerProfile for ScalarValues::String;
        // §8.1.1 — compound "<profile-type>/<profile-subtype>" string, e.g.
        // "ai-assisted-analysis/datHere". Other types reserved name-only.

    package AiAssistedCaptureVocabulary {
        doc /* §8.6 — the ai-assisted-analysis Producer Profile's v0.1
             captureMethod vocabulary. Hyphenated literals carried as
             string-valued constants, NOT enum identifiers (02 §1.3). */
        attribute chatFlowStream          : CaptureMethodLabel default "chat-flow-stream";
        attribute claudeCodeJsonlReadback : CaptureMethodLabel default "claude-code-jsonl-readback";
        attribute claudeCodeSelfReport    : CaptureMethodLabel default "claude-code-self-report";  // legacy, deprecated
    }

    enum def ContentProfile { 'default'; datHere; }              // §8.1.1 ('default' is a SysML keyword)

    variation part def AnalysisNodeVariant :> AnalysisNode {
        doc /* §8.7 — the datHere content profile as a variation over
             content/analysis/v1. The datHere variant models §8.7.1
             requirements 4, 6 and 7 structurally (notebook, summary,
             label) plus requirement 3 (environment extension); the
             remaining requirements (1, 2, 5) live in the §8.7.1 text
             and Verification::DatHereReqs1to7. */
        variant part defaultProfile : AnalysisNode {
            attribute redefines payload.'metadata'.contentProfile default ContentProfile::'default';
        }
        variant part datHereProfile : AnalysisNode {
            metadata BuildState::Built;
            attribute redefines payload.'metadata'.contentProfile default ContentProfile::datHere;
            attribute redefines payload.summary : String[1];                                  // §8.7.1(6)
            ref item redefines payload.extensions.notebook    : NotebookExtension[1];         // §8.7.1(4)
            ref item redefines payload.extensions.environment : EnvironmentExtension[1];      // §8.7.1(3)
        }
    }
}

// ============================================================================
//  INFRASTRUCTURE — system context the spec anchors to (§7.3, §8.3.3, §10.3)
// ============================================================================
package Infrastructure {
    private import Primitives::*;
    private import ScalarValues::*;

    // ---- trust registry (§8.3.3) --------------------------------------------
    enum def KeyStatus { active; deprecated; revoked; }
    item def SignerIdentity {                                    // registry-side identity binding (ADR-0009 §4)
        attribute bindingTier : String[1];
        attribute identifier  : String[1];
        attribute displayName : String[1];
    }
    item def TrustRegistryEntry {
        attribute kid       : String[1];
        attribute publicKey : Base64[1];
        ref item signerIdentity : SignerIdentity[0..1];          // absent pre-v0.1 -> legacy_embedded treatment
        attribute status       : KeyStatus[1];
        attribute activatedAt  : String[1];
        attribute deprecatedAt : String[0..1];
        attribute revokedAt    : String[0..1];
    }
    item def TrustRegistry {                                     // served at /.well-known/typed-publisher.json
        ref item keys : TrustRegistryEntry[1..*];
    }

    // ---- pinned anchors (§10.3) ---------------------------------------------
    item def PinnedTsaAnchor   { attribute sha256Fingerprint : HexDigest[1]; }  // FreeTSA root CA
    item def PinnedRekorAnchor { attribute logId : HexDigest[1]; }              // SHA-256 of log key SPKI

    item def AttestationGraph {                                  // resolved attestation nodes targeting a package
        ref item nodes : Taxonomy::AttestationNode[0..*];
    }

    item def VerificationContext {
        doc /* Everything a verifier needs beyond the node itself. Carried
             inline, this is the offline story: the §8.8 ?inline=1
             self-contained bundle supplies registry + anchors + attestation
             chain with zero network (§9.4). The bundle serialization itself
             is unmodeled. */
        ref item registry    : TrustRegistry[1];
        ref item tsaAnchor   : PinnedTsaAnchor[1];
        ref item rekorAnchor : PinnedRekorAnchor[1];
        ref item blobStore   : BlobStore[0..1];
        ref item attestationGraph : AttestationGraph[1];
    }

    // ---- online topology (§7.3) ----------------------------------------------
    port def RegistryServePort { out registryDoc : TrustRegistry; }
    port def PackageServePort  { out packageBlob : Envelope::SignedNode; }
    port def TsaPort   { out caChain : Base64; }
    port def RekorPort { out inclusionProof : Base64; }
    port def BlobPort  { out bytes : Base64; }

    part def PublisherDomain {                                   // the publisher's own domain — sovereignty boundary (§5.4)
        port registry : RegistryServePort;
        port packages : PackageServePort;
    }
    part def PublicTsa  { port tsa   : TsaPort;   }
    part def RekorLog   { port rekor : RekorPort; }
    part def BlobStore  { port blobs : BlobPort;  }
    part def Verifier {
        port registry : ~RegistryServePort;
        port packages : ~PackageServePort;
        port tsa      : ~TsaPort;
        port rekor    : ~RekorPort;
        port blobs    : ~BlobPort;
    }

    interface def VerifyToRegistry { end verifierSide : ~RegistryServePort; end serverSide : RegistryServePort; }
    interface def VerifyToPackages { end verifierSide : ~PackageServePort;  end serverSide : PackageServePort;  }
    interface def VerifyToTsa      { end verifierSide : ~TsaPort;           end serverSide : TsaPort;           }
    interface def VerifyToRekor    { end verifierSide : ~RekorPort;         end serverSide : RekorPort;         }
    interface def VerifyToBlobs    { end verifierSide : ~BlobPort;          end serverSide : BlobPort;          }

    part def VerificationSystem {
        doc /* Online topology (§7.3, §8.13). typedstandards.org is
             deliberately ABSENT: the indexing registry is not in the
             verification path and has no authority to vouch or reject.
             The offline path (§9.4) replaces every link with a
             VerificationContext carrying registry + anchors + attestation
             chain inline — the ?inline=1 self-contained bundle of §8.8. */
        part verifier  : Verifier;
        part publisher : PublisherDomain;
        part tsa       : PublicTsa;
        part rekor     : RekorLog;
        part blobStore : BlobStore;
        interface registryLink : VerifyToRegistry connect verifier.registry to publisher.registry;
        interface packagesLink : VerifyToPackages connect verifier.packages to publisher.packages;
        interface tsaLink      : VerifyToTsa      connect verifier.tsa      to tsa.tsa;
        interface rekorLink    : VerifyToRekor    connect verifier.rekor    to rekor.rekor;
        interface blobsLink    : VerifyToBlobs    connect verifier.blobs    to blobStore.blobs;
    }
}

// ============================================================================
//  LIFECYCLE — the four state machines (§8.10, §8.3.3, §8.7.4)
// ============================================================================
package Lifecycle {
    private import Taxonomy::*;
    private import ScalarValues::*;

    // Guard predicates — evaluated out-of-band by the verifier (signature +
    // signer matching are crypto/registry work, not model-executable).
    calc def signerMatchesTarget    { in att : AttestationNode; return : Boolean; }
    calc def isDelegatedPublisher   { in att : PublishesNode;   return : Boolean; }  // Q20
    calc def pointsAtPriorWithdrawal{ in id : Primitives::HexDigest; return : Boolean; }
    calc def isNonEmpty             { in s : String;            return : Boolean; }
    calc def hasBinding             { in att : AttestationNode; return : Boolean; }
    calc def isDistinctCopyPair     { in loc : LocatedAtNode;   return : Boolean; }  // (signer, uri-authority) pair

    state def ContentNodeLifecycle {
        doc /* §8.10.1 — a DERIVED VIEW over the append-only attestation chain,
             not stored state: the verifier surfaces the latest signer-matched
             lifecycle attestation in envelope-timestamp order. Multi-cycle
             (withdraw/reinstate/...) is free by construction. */
        entry; then committed;
        state committed; state published; state withdrawn; state superseded;
        transition committed_to_published first committed accept pub : PublishesNode
            if signerMatchesTarget(pub) or isDelegatedPublisher(pub) then published;
        // §8.10.1: a publisher may withdraw/supersede a previously-emitted node
        // "at any time" — including committed-but-unpublished (the
        // zero-locatedAt draft case of §8.10.2).
        transition committed_to_withdrawn first committed accept wc : WithdrawsNode
            if signerMatchesTarget(wc) and isNonEmpty(wc.reason) then withdrawn;
        transition committed_to_superseded first committed accept sc : SupersedesNode
            if signerMatchesTarget(sc) then superseded;
        transition published_to_withdrawn first published accept w : WithdrawsNode
            if signerMatchesTarget(w) and isNonEmpty(w.reason) then withdrawn;
        transition withdrawn_to_reinstated first withdrawn accept r : ReinstatesNode
            if signerMatchesTarget(r) and pointsAtPriorWithdrawal(r.priorWithdrawalNodeId) then published;
        transition published_to_superseded first published accept s : SupersedesNode
            if signerMatchesTarget(s) then superseded;
    }

    state def ContentNodeVisibility {
        doc /* §8.10.2 — the location axis, orthogonal to lifecycle status.
             Zero locatedAt attestations is the valid private/draft base case;
             multiple attestations from distinct (signer, uri-authority) pairs
             express independent durable copies (Q38: no copyOf sub-type). */
        entry; then noPublicLocation;
        state noPublicLocation; state located;
        transition to_located first noPublicLocation accept loc : LocatedAtNode
            if hasBinding(loc) then located;
        transition additional_copy first located accept loc2 : LocatedAtNode
            if hasBinding(loc2) and isDistinctCopyPair(loc2) then located;
    }

    constraint def RetentionAsymmetry {
        doc /* §8.10.3 — a publisher's withdrawal removes only their own
             visibility commitment; another party's locatedAt stays
             independently verifiable. The deliberate civic-accountability
             property: retraction is recorded, never silently erased. */
        in withdraw : WithdrawsNode;
        in backupLoc : LocatedAtNode;
        in backupIndependentlyVerifiable : Boolean;
        (withdraw.signer.identifier != backupLoc.signer.identifier) implies backupIndependentlyVerifiable
    }

    state def TrustRegistryKeyLifecycle {
        doc /* §8.3.3 — deprecated keys stay valid for packages signed before
             deprecatedAt; revoked keys are never trusted regardless of when. */
        entry; then active;
        state active; state deprecated; state revoked;
        transition active_to_deprecated first active accept deprecate then deprecated;
        transition active_to_revoked     first active accept revoke     then revoked;
        transition deprecated_to_revoked first deprecated accept revoke then revoked;
    }

    state def NotebookProvenance {
        doc /* §8.7.4 — notebook authoring-path discriminator (a third axis,
             orthogonal to captureMethod and contentProfile): skeleton wraps a
             chat-authored answer (data-fetch cells reproducible, synthesis
             hardcoded); executed computes every cell at publish time. */
        entry; state skeleton; state executed;
    }
}

// ============================================================================
//  VERIFICATION — the §9.2 ordered check flow + structural validations
// ============================================================================
package Verification {
    private import Envelope::*;
    private import ScalarValues::*;

    // Out-of-band computations (crypto — never executed by this model).
    calc def computeEnvelopeHash { in node : SignedNode; return : Primitives::HexDigest; }
    calc def computeContentHash  { in node : SignedNode; in rule : Primitives::UriString; return : Primitives::ContentHash; }

    enum def VerifierCode {
        doc /* Non-fatal signal codes a verifier reports (§9.2). Unknown
             sub-types/rules degrade gracefully rather than failing (§5.1
             surface-signals posture). */
        unknown_target_node; unknown_canonicalization_rule; unknown_type;
        signer_identity_mismatch; captureMethod_unknown; producerProfile_bundle_unresolved;
    }
    enum def KeyTrust {                                          // §8.3.3 trust-registry verdicts
        active; deprecated_valid; deprecated_invalid; revoked;
        unknown_key; registry_unavailable; legacy_embedded;
    }

    item def Verdict {
        doc /* What a verifier reports — signals, never a truth score (§5.1).
             Two axes per the malformed-vs-integrity fork: envelope integrity
             (envelopeOk) and per-profile structural conformance (datHereOk). */
        attribute envelopeIntegrity : Boolean[1];
        attribute signatureValid    : Boolean[1];
        attribute keyTrust          : KeyTrust[1];
        attribute lifecycleStatus   : String[0..1];
        attribute captureMethod     : CaptureAndProfiles::CaptureMethodLabel[1];
        attribute codes             : VerifierCode[0..*];
        attribute envelopeOk        : Boolean[1];
        attribute datHereOk         : Boolean[0..1];
    }

    // ---- check actions -------------------------------------------------------
    // External-delegated (opaque): crypto, network, registry joins.
    action def CheckEnvelopeIntegrity     { in node : SignedNode; out ok : Boolean; }                                              // #1
    action def CheckSignature             { in node : SignedNode; out ok : Boolean; }                                              // #2
    action def CheckContentHash           { in node : SignedNode; out ok : Boolean; }                                              // #4
    action def CheckTrustRegistry         { in node : SignedNode; in registry : Infrastructure::TrustRegistry; out verdict : KeyTrust; } // #5
    action def CheckTimestamp             { in node : SignedNode; in tsaAnchor : Infrastructure::PinnedTsaAnchor; out ok : Boolean; }    // #7
    action def CheckRekorInclusion        { in node : SignedNode; in rekorAnchor : Infrastructure::PinnedRekorAnchor; out ok : Boolean; }// #8
    action def CheckBlobRefs              { in node : SignedNode; in blobStore : Infrastructure::BlobStore; out ok : Boolean; }          // #9
    action def CheckLifecycleState        { in node : SignedNode; in attestationGraph : Infrastructure::AttestationGraph; out status : String; } // #10
    action def CrossCheckSignerIdentity   { in node : SignedNode; in registry : Infrastructure::TrustRegistry; out code : VerifierCode[0..1]; }  // #14
    // SHACL-expressible (structural).
    action def ResolveCanonicalizationRule   { in node : SignedNode; out code : VerifierCode[0..1]; }                              // #3
    action def CheckSigningKeyIdConsistency  { in node : SignedNode; out ok : Boolean; }                                           // #6
    action def ReadCaptureMethodLabel        { in node : SignedNode; out label : CaptureAndProfiles::CaptureMethodLabel; }         // #11
    action def ResolveType                   { in node : SignedNode; out code : VerifierCode[0..1]; }                              // #12
    action def CrossCheckNodeId              { in node : SignedNode; in attestationGraph : Infrastructure::AttestationGraph; out code : VerifierCode[0..1]; } // #13
    action def CheckCaptureMethodVocabulary  { in node : SignedNode; out code : VerifierCode[0..1]; }                              // #15

    action def VerifyNode {
        doc /* §9.2 — the ordered 15-check list, numbering per the v0.1
             reference-implementation check order. */
        in node : SignedNode;
        in ctx : Infrastructure::VerificationContext;
        out verdict : Verdict;
        first start;
        then action c1  : CheckEnvelopeIntegrity        { in node = node; }
        then action c2  : CheckSignature                { in node = node; }
        then action c3  : ResolveCanonicalizationRule   { in node = node; }
        then action c4  : CheckContentHash              { in node = node; }
        then action c5  : CheckTrustRegistry            { in node = node; in registry = ctx.registry; }
        then action c6  : CheckSigningKeyIdConsistency  { in node = node; }
        then action c7  : CheckTimestamp                { in node = node; in tsaAnchor = ctx.tsaAnchor; }
        then action c8  : CheckRekorInclusion           { in node = node; in rekorAnchor = ctx.rekorAnchor; }
        then action c9  : CheckBlobRefs                 { in node = node; in blobStore = ctx.blobStore; }
        then action c10 : CheckLifecycleState           { in node = node; in attestationGraph = ctx.attestationGraph; }
        then action c11 : ReadCaptureMethodLabel        { in node = node; }
        then action c12 : ResolveType                   { in node = node; }
        then action c13 : CrossCheckNodeId              { in node = node; in attestationGraph = ctx.attestationGraph; }
        then action c14 : CrossCheckSignerIdentity      { in node = node; in registry = ctx.registry; }
        then action c15 : CheckCaptureMethodVocabulary  { in node = node; }
        then done;
    }

    // ---- structural validations (SHACL-targetable) ---------------------------
    calc def producerProfileIsDatHere { in p : CaptureAndProfiles::ProducerProfile; return : Boolean; }
        // startsWith("ai-assisted-analysis/datHere") — string op, out-of-band here.
    constraint def ProfileConsistencyShape {
        doc /* §8.1.1 — (contentProfile == "datHere") iff producerProfile
             starts with "ai-assisted-analysis/datHere". */
        in pkg : ContentAnalysis::EvidencePackage;
        (pkg.'metadata'.contentProfile == CaptureAndProfiles::ContentProfile::datHere)
            == producerProfileIsDatHere(pkg.producerProfile)
    }
    // Named-but-opaque shapes: expressed authoritatively in the SHACL sibling view.
    constraint def FamilyMembership;               // node is in the content family xor the attestation family
    constraint def QecSetWellFormed;               // §7.5: untyped mutually exclusive with typed values
    constraint def RequiredFieldsPresent;          // §8.1.1 required-field set
    constraint def TargetNodeIdRule;               // §7.4 family discriminator on payloads
    constraint def TypeUriPattern;                 // content/<noun>/vN | attestation/<verb>/vN
    constraint def BlobRefShape;                   // §8.1.5 four-field shape
    constraint def PromptVisibilityRule;           // §8.1.3 text iff full_text
    constraint def ExtensionsKeysReverseDns;       // §8.1.6
    constraint def DatHereReqs1to7;                // §8.7.1 requirements 1-7
    constraint def ProvenanceExecutionConditional; // §8.7.4 execution extension iff provenance == executed

    action def ValidateStructure {
        doc /* The structural half of verification: graph-shape validation a
             SHACL engine can perform. Failing here reports the node as
             malformed(-for-datHere) while §9.2 envelope checks still run. */
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

    action def VerifyNodeFull {
        doc /* The malformed-vs-integrity fork: envelope verification and
             structural validation run as two verdict axes (§8.7.1). */
        in node : SignedNode;
        in ctx : Infrastructure::VerificationContext;
        out verdict : Verdict;
        action env    : VerifyNode        { in node = node; in ctx = ctx; }
        action struct : ValidateStructure { in node = node; }
    }
}

// ============================================================================
//  CONFORMANCE — §9 requirements corpus + satisfy/verify traceability
// ============================================================================
package Conformance {
    private import Verification::*;
    private import Lifecycle::*;
    private import ScalarValues::*;
    private import SequenceFunctions::*;                         // size() in requirement constraints

    part def ProductSurface;                                     // anything that renders nodes to readers
    part def Implementation;                                     // a publisher or verifier implementation

    // Named-but-opaque obligations (their normative content is spec prose).
    constraint def CarriesPreamble        { in surface : ProductSurface; }
    constraint def NoTruthScoring         { in impl : Implementation; }
    constraint def ValidatesPinnedAnchors { in impl : Implementation; }
    constraint def NoSilentDelete         { in impl : Implementation; }
    constraint def HonorsLegacyColumns    { in impl : Implementation; }
    constraint def SurfacesRetention      { in impl : Implementation; }
    constraint def PerformsEveryCheck     { in impl : Implementation; }
    constraint def CheckCaptureMethodVocabPredicate { in pkg : Envelope::SignedNode; }

    // Traceability pattern: `satisfy R by <structure>` names the model element
    // that discharges the requirement; a verification def carries the verify
    // leg (standalone `verify X by Y;` is not in the SysML v2 grammar) —
    // its objective verifies the requirement, its performed action is the
    // §9.2 check that discharges it.

    requirement def <'R-preamble-carry'> CarryNormativePreamble {
        doc /* §5.1 — the four-line normative preamble surfaced before readers
             form conclusions. */
        subject surface : ProductSurface;
        require constraint : CarriesPreamble { in surface = surface; }
    }

    requirement def <'R-no-automated-truth-scoring'> NoAutomatedTruthScoring {
        doc /* §5.1 — no platform-issued correctness / rank-by-trust verdicts. */
        subject impl : Implementation;
        require constraint : NoTruthScoring { in impl = impl; }
    }
    satisfy NoAutomatedTruthScoring by Verification::Verdict;

    requirement def <'R-sign-ed25519ph'> SignWithEd25519ph {     // §8.3.1
        subject pkg : Envelope::SignedNode;
        require constraint { pkg.sig.algorithm == "Ed25519ph" }
    }
    satisfy SignWithEd25519ph by Envelope::SignatureEnvelope;
    verification def <'V-sign-ed25519ph'> VerifySignEd25519ph {
        objective { verify requirement : SignWithEd25519ph; }
        perform action check : Verification::CheckSignature;
    }

    requirement def <'R-signingKeyId-eq-kid'> SigningKeyIdEqualsKid {  // §8.3.1 / §9.2 #6
        subject pkg : Envelope::SignedNode;
        require constraint { pkg.'metadata'.signingKeyId == pkg.sig.kid }
    }
    satisfy SigningKeyIdEqualsKid by Envelope::Metadata;
    verification def <'V-signingKeyId'> VerifySigningKeyIdEqualsKid {
        objective { verify requirement : SigningKeyIdEqualsKid; }
        perform action check : Verification::CheckSigningKeyIdConsistency;
    }

    calc def registryIdentityForKid {
        doc /* Out-of-band join: sig.kid -> trust-registry entry ->
             signerIdentity.identifier (§8.3.3). */
        in pkg : Envelope::SignedNode;
        in registry : Infrastructure::TrustRegistry;
        return : String;
    }
    requirement def <'R-signer-crosscheck'> SignerIdentityCrossCheck {
        doc /* §8.3.1 / §9.2 #14 — sig.kid resolved via the registry MUST name
             the same identity the envelope's signer claims; mismatch =>
             signer_identity_mismatch, REJECT. */
        subject pkg : Envelope::SignedNode;
        in registry : Infrastructure::TrustRegistry;
        assume constraint { pkg.signer != null }
        require constraint { pkg.signer.identifier == registryIdentityForKid(pkg, registry) }
    }
    satisfy SignerIdentityCrossCheck by Envelope::Signer;
    verification def <'V-signer-crosscheck'> VerifySignerIdentityCrossCheck {
        objective { verify requirement : SignerIdentityCrossCheck; }
        perform action check : Verification::CrossCheckSignerIdentity;
    }

    requirement def <'R-tsa-rekor'> CarryTimestampAndRekor {     // §8.3.2 — SHOULD, not MUST
        subject pkg : Envelope::SignedNode;
        require constraint { (pkg.timestamp != null) and (pkg.rekorInclusionProof != null) }
    }
    verification def <'V-tsa-rekor'> VerifyCarryTimestampAndRekor {
        objective { verify requirement : CarryTimestampAndRekor; }
        perform action checkTs    : Verification::CheckTimestamp;
        perform action checkRekor : Verification::CheckRekorInclusion;
    }

    requirement def <'R-pinned-anchors'> ValidateAgainstPinnedAnchors {
        doc /* §10.3 — RFC 3161 leaf chain-validated to the pinned FreeTSA
             root; RFC 6962 inclusion against the pinned Rekor log key. */
        subject ver : Implementation;
        require constraint : ValidatesPinnedAnchors { in impl = ver; }
    }
    verification def <'V-pinned-anchors'> VerifyValidateAgainstPinnedAnchors {
        objective { verify requirement : ValidateAgainstPinnedAnchors; }
        perform action checkTs    : Verification::CheckTimestamp;
        perform action checkRekor : Verification::CheckRekorInclusion;
    }

    requirement def <'R-family-discriminator'> FamilyDiscriminator {  // §7.4
        subject node : Taxonomy::TypedNode;
        require constraint {
            (node istype Taxonomy::ContentNode implies size(node.targetNodeId) == 0)
            and (node istype Taxonomy::AttestationNode implies size(node.targetNodeId) >= 1)
        }
    }
    satisfy FamilyDiscriminator by Taxonomy::ContentNode;
    satisfy FamilyDiscriminator by Taxonomy::AttestationNode;
    verification def <'V-family'> VerifyFamilyDiscriminator {
        objective { verify requirement : FamilyDiscriminator; }
        perform action validate : Verification::ValidateStructure;
    }

    requirement def <'R-captureMethod-vocab'> CaptureMethodVocabularyConformance {
        doc /* §8.6 / §9.2 #15 — captureMethod is in the resolved
             producerProfile's declared vocabulary (ai-assisted-analysis v0.1
             set); unresolved bundles degrade gracefully. */
        subject pkg : Envelope::SignedNode;
        assume constraint : ProfileConsistencyShape;
        require constraint : CheckCaptureMethodVocabPredicate { in pkg = pkg; }
    }
    satisfy CaptureMethodVocabularyConformance by CaptureAndProfiles::AiAssistedCaptureVocabulary;
    verification def <'V-captureMethod-vocab'> VerifyCaptureMethodVocabulary {
        objective { verify requirement : CaptureMethodVocabularyConformance; }
        perform action check : Verification::CheckCaptureMethodVocabulary;
    }

    requirement def <'R-profile-consistency'> ProfileConsistency {
        doc /* §8.1.1 — (contentProfile == "datHere") iff producerProfile
             starts with "ai-assisted-analysis/datHere". */
        subject pkg : ContentAnalysis::EvidencePackage;
        require constraint : ProfileConsistencyShape { in pkg = pkg; }
    }
    verification def <'V-profile-consistency'> VerifyProfileConsistency {
        objective { verify requirement : ProfileConsistency; }
        perform action validate : Verification::ValidateStructure;
    }

    requirement def <'R-summary-datHere'> SummaryRequiredUnderDatHere {  // §8.7.1(6)
        subject pkg : ContentAnalysis::EvidencePackage;
        assume constraint { pkg.'metadata'.contentProfile == CaptureAndProfiles::ContentProfile::datHere }
        require constraint { (pkg.summary != null) and (size(pkg.summary) > 0) }
    }
    satisfy SummaryRequiredUnderDatHere by CaptureAndProfiles::AnalysisNodeVariant::datHereProfile;

    requirement def <'R-lifecycle-by-nodeId'> LifecycleByNodeId {
        doc /* §8.10.1 — lifecycle events are separately-signed attestation
             nodes referencing their target by nodeId (SHOULD carry
             timestamp + Rekor like any envelope). */
        subject att : Taxonomy::AttestationNode;
        require constraint { size(att.targetNodeId) >= 1 }
    }
    satisfy LifecycleByNodeId by Lifecycle::ContentNodeLifecycle;

    requirement def <'R-retention-asymmetry'> RetentionAsymmetryReq {
        doc /* §8.10.3 — P's withdrawal does not invalidate another party's
             locatedAt; a verifier surfaces both ("withdrawn by publisher;
             copy still available at B"). */
        subject ver : Implementation;
        require constraint : SurfacesRetention { in impl = ver; }
    }
    satisfy RetentionAsymmetryReq by Lifecycle::RetentionAsymmetry;
    verification def <'V-retention'> VerifyRetentionAsymmetry {
        objective { verify requirement : RetentionAsymmetryReq; }
        perform action check : Verification::CheckLifecycleState;
    }

    requirement def <'R-no-silent-delete'> NoSilentDeletion {
        doc /* §8.10.3 — withdrawn nodes MUST NOT be removed from storage or
             listings except via audited administrative action. */
        subject impl : Implementation;
        require constraint : NoSilentDelete { in impl = impl; }
    }

    requirement def <'R-legacy-lifecycle-cols'> HonorLegacyLifecycleColumns {
        doc /* §8.10.4 — when no withdraws/reinstates envelopes are present,
             honor the legacy withdrawnAt/reinstatedAt DB columns. */
        subject ver : Implementation;
        require constraint : HonorsLegacyColumns { in impl = ver; }
    }

    requirement def <'R-conformant-verifier'> ConformantVerifier {
        doc /* §9.1 — performs every §9.2 check, surfaces §8.10 lifecycle
             state, and refuses to compute platform-issued truth verdicts. */
        subject ver : Implementation;
        require constraint : PerformsEveryCheck { in impl = ver; }
        requirement signEd25519ph     : SignWithEd25519ph;
        requirement signingKeyIdEqKid : SigningKeyIdEqualsKid;
        requirement signerCrosscheck  : SignerIdentityCrossCheck;
        requirement pinnedAnchors     : ValidateAgainstPinnedAnchors;
        requirement family            : FamilyDiscriminator;
        requirement captureVocab      : CaptureMethodVocabularyConformance;
        requirement lifecycle         : LifecycleByNodeId;
        requirement retention         : RetentionAsymmetryReq;
        requirement noTruthScoring    : NoAutomatedTruthScoring;
    }
    satisfy ConformantVerifier by Verification::VerifyNode;
    verification def <'V-conformant-verifier'> VerifyConformantVerifierCase {
        objective { verify requirement : ConformantVerifier; }
        perform action full : Verification::VerifyNodeFull;
    }
}
