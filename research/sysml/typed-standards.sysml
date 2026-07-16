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
    item def DerivationMethod;                                   // §8.12.1 wasDerivedFrom payload (plain object)
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
        attribute contentType    : ContentAnalysis::QecContentType[0..*];     // §7.5 QEC framing; not in the §8.1.2 required set
        attribute contentProfile : CaptureAndProfiles::ContentProfile[0..1];  // spec places it top-level (§8.1.1) AND under metadata (§8.7.1(7)); rename deferred per ADR-0006/Q27
    }

    abstract part def SignedNode {                              // §6.2, §7.1, §7.4
        attribute type                    : Primitives::UriString[1];
        attribute contentHash             : Primitives::ContentHash[1];
        attribute contentCanonicalization : Primitives::UriString[0..1];      // recommended (v0.1); pre-v0.1 inferred from profile — §8.1.1
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
    enum def AuthorizationRule { publisher_only; any_with_binding; specific_role_required; self_attestation; }

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
        // §8.12.1: plain object; MUST be a ts:AnalyticalDerivation only when the source is
        // untyped content/analysis/v1 and the target is a typed content sub-type
        // (refinement (a), the classification-laundering guard — §8.11.3 step 2).
        ref item derivationMethod : Primitives::DerivationMethod[1]; }
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
        // §8.12.1: self-attestation OR specific-role-required (third-party)
        attribute redefines authorizationRule default AuthorizationRule::specific_role_required;
        assert constraint { (authorizationRule == AuthorizationRule::self_attestation)
                         or (authorizationRule == AuthorizationRule::specific_role_required) }
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
    item def McpServerRef { attribute url : UriString[1]; attribute name : String[0..1]; }
    item def EnvironmentExtension {                            // §8.7.1(3) org.civicaitools.environment
        attribute modelVersion : String[1]; attribute temperature : Real[1];
        ref item mcpServers : McpServerRef[0..*];
        attribute toolDefinitions : String[0..*]; ref item toolDefinitionsBlob : BlobRef[0..1];  // array OR BlobRef when large
        attribute host : String[1]; }                          // publishing-host identifier
    item def ExtensionsMap { ref item notebook : NotebookExtension[0..1];
                             ref item environment : EnvironmentExtension[0..1]; }
    item def EvidencePackage {                                // §8.1
        ref item metadata : Metadata[1]; ref item prompt : Prompt[1];
        attribute queries : String[0..*]; attribute dataSources : String[0..*];
        ref item cost : Cost[1]; ref item skillMetadata : SkillMetadata[1];
        attribute output : String[0..1]; ref item outputBlob : BlobRef[0..1];
        attribute trace : String[0..1]; ref item traceBlob : BlobRef[0..1];
        attribute summary : String[0..1];                     // REQUIRED under datHere
        attribute producerProfile : CaptureAndProfiles::ProducerProfile[0..1];  // §8.1.1 top-level; invariant w/ contentProfile per ProfileConsistencyShape
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
    item def AnalyticalDerivation :> DerivationMethod {
        attribute traceReference : String[1]; ref item translationModel : String[1];
        attribute translationPrompt : String[1]; ref item sourceOutputSpan : OutputSpan[1]; }
    abstract item def Magnitude;  abstract item def Component;
    abstract item def Claim { attribute identifier : String[1]; attribute subject : UriString[1];
                              ref item scope : Scope[1]; ref item confidence : ConfidenceStatement[1];
                              attribute wasDerivedFrom : UriString[1..*]; ref item derivedVia : AnalyticalDerivation[1];
                              attribute description : String[0..1]; attribute limitations : String[0..1];
                              // §8.11.4 optional inline relations (also expressible as attestation/* nodes)
                              attribute contradicts : UriString[0..*]; attribute corroborates : UriString[0..*];
                              attribute supersedes : UriString[0..1]; }
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
            ref item redefines payload.extensions.notebook : NotebookExtension[1];
            ref item redefines payload.extensions.environment : EnvironmentExtension[1]; }   // §8.7.1(3)
    }
}

// ============================ INFRASTRUCTURE (§9 system context) ============================
package Infrastructure {
    import Primitives::*; import ScalarValues::*;
    enum def KeyStatus { active; deprecated; revoked; }
    item def SignerIdentity { attribute bindingTier : String[1]; attribute identifier : String[1]; attribute displayName : String[1]; }
    item def TrustRegistryEntry { attribute kid : String[1]; attribute publicKey : Base64[1];
        ref item signerIdentity : SignerIdentity[0..1]; attribute status : KeyStatus[1];
        attribute activatedAt : String[1]; attribute deprecatedAt : String[0..1]; attribute revokedAt : String[0..1]; }
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
    interface def VerifyToBlobs    { end verifierSide : ~BlobPort;          end serverSide : BlobPort;          }
    part def VerificationSystem {                              // §7.3, §8.13 — typedstandards.org deliberately ABSENT
        doc /* Online topology. The offline path (§9.4) replaces every link with a
             VerificationContext carrying registry + anchors + attestation chain inline —
             the ?inline=1 self-contained bundle of §8.8; the bundle itself is unmodeled. */
        part verifier : Verifier; part publisher : PublisherDomain; part tsa : PublicTsa; part rekor : RekorLog;
        part blobStore : BlobStore;
        interface registryLink : VerifyToRegistry connect verifier.registry to publisher.registry;
        interface packagesLink : VerifyToPackages connect verifier.packages to publisher.packages;
        interface tsaLink      : VerifyToTsa      connect verifier.tsa      to tsa.tsa;
        interface rekorLink    : VerifyToRekor    connect verifier.rekor    to rekor.rekor;
        interface blobsLink    : VerifyToBlobs    connect verifier.blobs    to blobStore.blobs;
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
        // §8.10.1: a publisher may withdraw/supersede a previously-emitted node "at any
        // time" — including committed-but-unpublished (the zero-locatedAt draft case).
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
    calc def producerProfileIsDatHere { in p : CaptureAndProfiles::ProducerProfile; return : Boolean; }  // startsWith("ai-assisted-analysis/datHere")
    constraint def ProfileConsistencyShape {                 // §8.1.1 consistency invariant
        in pkg : ContentAnalysis::EvidencePackage;
        (pkg.metadata.contentProfile == CaptureAndProfiles::ContentProfile::datHere)
            == producerProfileIsDatHere(pkg.producerProfile)
    }
    constraint def FamilyMembership; constraint def QecSetWellFormed;
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

    calc def registryIdentityForKid {                          // out-of-band join: sig.kid -> registry entry's signerIdentity.identifier
        in pkg : Envelope::SignedNode; in registry : Infrastructure::TrustRegistry; return : String; }
    requirement def <'R-signer-crosscheck'> SignerIdentityCrossCheck { subject pkg : Envelope::SignedNode;
        in registry : Infrastructure::TrustRegistry;
        assume constraint { pkg.signer != null }
        doc /* sig.kid resolved via registry signerIdentity == signer.identifier; mismatch => REJECT (#14). */
        require constraint { pkg.signer.identifier == registryIdentityForKid(pkg, registry) } }
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
        require constraint : ProfileConsistencyShape { in pkg = pkg; } }
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
