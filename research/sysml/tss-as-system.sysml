// ============================================================================
//  The Typed Standards Specification as a system of interest
//
//  Source view : research/05-typed-standards-spec-architecture-views.md
//                (needs / functional / logical views + traceability, zooming
//                into the Typed Standards Spec component of 04)
//  Parent view : research/sysml/system-of-interest.sysml (the whole
//                civic-ai-tools system, from 04) — this file refines its
//                SpecCorpus component and traces onto its Needs
//  Detail model: research/sysml/typed-standards.sysml (the spec's normative
//                content as structure / behavior / requirements)
//  Reconciled  : 2026-08-18, with its source view 05, against the spec's
//                2026-08-03 revision (the v0.1.4 reconciliation) and the
//                ADR corpus through ADR-0024
//
//  Naming note: this file name uses "tss" for brevity; the spec itself
//  reserves no "TSS" abbreviation (§6.3 disambiguates it from RFC 3161
//  Time-Stamping Server usage) — read it as "the Typed Standards
//  Specification as a system".
//
//  Package map (all nested under TypedStandardsAsSystem)
//    Stakeholders   the spec's own users (05 §1)
//    Needs          TN1-TN6 as requirement defs with stakeholder links
//    NeedsTrace     TN refinement of the system-level N needs (05 §1.1)
//    Functions      TF1-TF8 as action defs + the spec function flow (05 §2)
//    Components     logical components the spec content decomposes into (05 §3)
//    Architecture   reference configuration: components carrying functions
//    Traceability   need-to-function satisfies (05 §4)
// ============================================================================

package TypedStandardsAsSystem {
    doc /* The Typed Standards Specification treated as its own system of
         interest — stakeholders, needs, functions, logical components, and
         their traceability, transcribed from
         research/05-typed-standards-spec-architecture-views.md (exploratory
         sketch; where it and the spec disagree, the spec governs). One of
         the parallel research views: this file answers to 05, which answers
         to the spec (typed-standards-specification.md; the leave-behind
         typed-standards-summary.md is a companion, not the authority — its
         own banner, added after its 2026-05-26 snapshot, defers to the spec).

         Solid edges of 05 §4 are modeled as satisfy relationships and
         performed actions; dotted (supporting) edges are carried in doc
         notes. The component parts correspond to packages of the detail
         model typed-standards.sysml: DataSchema to Envelope + Taxonomy +
         ContentAnalysis + TypedClaims, BehaviorSpec to Verification,
         LifecycleMachines to Lifecycle, ProfilesAndVocabularies to
         CaptureAndProfiles, RequirementsCorpus to Conformance. */

    // ------------------------------------------------------------------------
    //  STAKEHOLDERS (05 §1) — the spec's own users
    // ------------------------------------------------------------------------
    package Stakeholders {
        part def JournalistReader {
            doc /* Journalist / reader verifying a shared artifact. */
        }
        part def CitizenDataAnalyst {
            doc /* Citizen-data analyst / publisher signing their own work. */
        }
        part def GovOpenDataPublisher {
            doc /* Government open-data publisher attaching attestations. */
        }
        part def ImplementerResearcher {
            doc /* Implementer / adjacent-standards researcher building
                 against the spec or aligning another standard with it. */
        }
    }

    // ------------------------------------------------------------------------
    //  NEEDS (05 §1) — TN1-TN6, held by the spec's users
    // ------------------------------------------------------------------------
    package Needs {
        private import TypedStandardsAsSystem::Stakeholders::*;

        requirement def <'TN1'> ProcessBasedTrust {
            doc /* Trust the production process, not the brand — "here is how
                 this was produced; judge for yourself". */
            subject soi;   // untyped: bound per-satisfy to the realizing feature
            stakeholder j : JournalistReader;
            stakeholder g : GovOpenDataPublisher;
        }
        requirement def <'TN2'> NoCentralAuthority {
            doc /* Verify without a central authority — package + publisher
                 domain + public infrastructure suffice. */
            subject soi;
            stakeholder a : CitizenDataAnalyst;
            stakeholder i : ImplementerResearcher;
        }
        requirement def <'TN3'> TamperEvidenceAndTime {
            doc /* Tamper-evidence and existed-by-time proof (embargo,
                 priority claims). */
            subject soi;
            stakeholder a : CitizenDataAnalyst;
        }
        requirement def <'TN4'> LegibleCaptureMethod {
            doc /* Legible capture method — how the bytes were produced,
                 signature-covered. */
            subject soi;
            stakeholder j : JournalistReader;
        }
        requirement def <'TN5'> SignalsNotTruth {
            doc /* Surface signals, never adjudicate truth (the §5.1
                 normative preamble discipline). */
            subject soi;
            stakeholder j : JournalistReader;
        }
        requirement def <'TN6'> AdjacentStandardsInterop {
            doc /* Interoperate with adjacent standards (PROV-O, in-toto,
                 Sigstore, DCAT, nanopubs). */
            subject soi;
            stakeholder g : GovOpenDataPublisher;
            stakeholder i : ImplementerResearcher;
        }
    }

    // ------------------------------------------------------------------------
    //  NEEDS TRACE (05 §1.1) — refinement of the system-level needs (04)
    // ------------------------------------------------------------------------
    package NeedsTrace {
        private import TypedStandardsAsSystem::Needs::*;

        doc /* Every component-level need has a system-level parent (no
             orphans); every system-level need except N1 refines downward.
             N1 (plain-English data access) has NO trace: data access is
             upstream of the standard, which only sees an analysis once it
             is being packaged. */

        requirement n2Refinement : SystemOfInterest::Needs::TrustworthyAiAnalysis {
            doc /* N2 is the need the spec primarily exists to serve. */
            requirement tn1 : ProcessBasedTrust;
            requirement tn4 : LegibleCaptureMethod;
            requirement tn5 : SignalsNotTruth;
        }
        requirement n3Refinement : SystemOfInterest::Needs::DurableCitableEvidence {
            doc /* Supporting (dotted) refinement to TN2 as well: durability
                 without a central authority is part of what makes evidence
                 citable long-term. */
            requirement tn3 : TamperEvidenceAndTime;
        }
        requirement n4Refinement : SystemOfInterest::Needs::OpenStandardsInterop {
            requirement tn2 : NoCentralAuthority;
            requirement tn6 : AdjacentStandardsInterop;
        }
    }

    // ------------------------------------------------------------------------
    //  FUNCTIONS (05 §2) — the behaviors the spec normatively defines
    // ------------------------------------------------------------------------
    package Functions {
        action def CanonicalizeAndHash {
            doc /* TF1 — canonicalize and hash: JCS envelope canonicalization,
                 multihash content hash (§8.2). */
        }
        action def SignAndBindIdentity {
            doc /* TF2 — sign and bind identity: Ed25519ph, signer tiers,
                 trust registry (§8.3, §8.5). */
        }
        action def TimestampAndLog {
            doc /* TF3 — timestamp and log: RFC 3161 token, Rekor inclusion
                 (§8.3.2). */
        }
        action def TypeNodes {
            doc /* TF4 — type nodes: the content and attestation families,
                 QEC, typed claims (§7.4, §7.5, §8.11, §8.12). */
        }
        action def DeclareProductionProcess {
            doc /* TF5 — declare the production process: captureMethod,
                 producer + content profiles (§8.6, §8.7). */
        }
        action def RunVerification {
            doc /* TF6 — verify: the §9.2 ordered checks + structural
                 validation. */
        }
        action def ManageLifecycleAndVisibility {
            doc /* TF7 — manage lifecycle and visibility: withdraw /
                 reinstate / supersede / revise / locate; retention asymmetry
                 (§8.10). Visibility (sealed / public — the ADR-0016 state
                 labels; the legacy values committed / published remain
                 accepted input aliases, never emitted), lifecycle status
                 (active / withdrawn / superseded), and host display are
                 orthogonal dimensions (§8.10.6). Revision lineage is the
                 §8.10.5 attestation/revises/v1 chain — neutral succession,
                 the prior revision staying a valid point-in-time snapshot,
                 distinct from supersedes (corrective replacement).
                 Attests via TF4's typed nodes (dotted edge in 05 §2). */
        }
        action def GovernConformance {
            doc /* TF8 — govern conformance: the MUST/SHOULD/MAY corpus, the
                 normative preamble, open questions, ADRs (§5, §9).
                 Constrains every other function (dotted edges in 05 §2). */
        }

        action def SpecFunctionFlow {
            doc /* 05 §2 — the functional dependency flow: TF4 and TF5 feed
                 TF1; TF1 then TF2 then TF3 then TF6. TF7 and TF8 sit
                 alongside (their dotted attests-via / constrains edges are
                 doc-carried). */
            action typeNodes         : TypeNodes;
            action declareProduction : DeclareProductionProcess;
            action canonicalizeHash  : CanonicalizeAndHash;
            action signBindIdentity  : SignAndBindIdentity;
            action timestampLog      : TimestampAndLog;
            action runVerification   : RunVerification;
            action manageLifecycle   : ManageLifecycleAndVisibility;
            action governConformance : GovernConformance;
            first typeNodes         then canonicalizeHash;
            first declareProduction then canonicalizeHash;
            first canonicalizeHash  then signBindIdentity;
            first signBindIdentity  then timestampLog;
            first timestampLog      then runVerification;
        }
    }

    // ------------------------------------------------------------------------
    //  COMPONENTS (05 §3) — what carries those functions
    // ------------------------------------------------------------------------
    package Components {
        // ---- normative spec content -------------------------------------------
        part def DataSchema {
            doc /* SignedNode envelope, EvidencePackage, attestation
                 payloads, typed-claims vocabulary (§6-§8). Detail model:
                 Envelope, Taxonomy, ContentAnalysis, TypedClaims packages.
                 Formalized by both study artifacts (SHACL for instance
                 conformance, SysML for structure). */
        }
        part def BehaviorSpec {
            doc /* §9.2 verification flow, publisher pipeline, cross-host
                 publication (§8.8-§8.9; the §8.8.1 commitment view's served
                 shape — redaction rule and ?inline=1 serialization included
                 — ratified 2026-08-03). Detail model: Verification package
                 — which covers the §9.2 verify flow ONLY; the publisher
                 pipeline and cross-host publication remain prose-only
                 (05 §3/§5 coverage boundary). */
        }
        part def LifecycleMachines {
            doc /* Content-node lifecycle, revision lineage (§8.10.5),
                 visibility / location, trust-registry keys, notebook
                 provenance (§8.10, §8.3.3, §8.7.4). Detail model: Lifecycle
                 package. */
        }
        part def ProfilesAndVocabularies {
            doc /* captureMethod (open core, per-profile closed), producer
                 profile, datHere content profile (§8.6-§8.7). Detail model:
                 CaptureAndProfiles package. */
        }
        part def RequirementsCorpus {
            doc /* The normative preamble (§5.1) and the MUST/SHOULD/MAY
                 corpus of §5, §8, §9. Detail model: Conformance package. */
        }

        // ---- governance surfaces -----------------------------------------------
        part def AdrCorpus {
            doc /* ADRs — settled decisions. */
        }
        part def OpenQuestionsRegistry {
            doc /* Unresolved decisions, cited by Q-number; gates the schema
                 and lifecycle content (05 §3 dotted gates edges). */
        }
        part def XanaduDoctrine {
            doc /* Promotion gates: nothing promotes to a higher build state
                 without a real package or adopter that needs it. Gates the
                 open-questions registry itself. */
        }

        // ---- external anchors (out-of-band; the hard boundary) -----------------
        part def VerifyCore {
            doc /* verify-core — the reference verifier library. External
                 anchor: supplies properties the spec can only reference. */
        }
        part def ProduceCore {
            doc /* produce-core — the reference producer core, published
                 beside verify-core (ADR-0021). External anchor: the spec
                 cites its shipped shapes directly — the §8.8.1 commitment
                 view's required/optional marks reflect its commitment-view
                 builder, and the §8.1.2 placement note cites its envelope
                 builder. */
        }
        part def RekorAndTsa {
            doc /* Rekor log + RFC 3161 TSA. External anchor. */
        }
        part def PublisherTrustRegistries {
            doc /* Publisher .well-known trust registries. External anchor. */
        }

        // ---- study artifacts (exploratory views) -------------------------------
        part def ShaclShapes {
            doc /* SHACL shapes — instance conformance over the data schema.
                 Exploratory; Xanadu-gated on Q16/Q5 promotion triggers. */
        }
        part def SysmlModel {
            doc /* The SysML v2 model (typed-standards.sysml) — structure,
                 the §9.2 verify behavior, lifecycle machines, requirements
                 traceability. Exploratory; Xanadu-gated on an MBSE adopter
                 or second verifier. */
        }
    }

    // ------------------------------------------------------------------------
    //  ARCHITECTURE — reference configuration (05 §3 + §4 carriage)
    // ------------------------------------------------------------------------
    package Architecture {
        private import TypedStandardsAsSystem::Components::*;
        private import TypedStandardsAsSystem::Functions::*;

        action specFlow : SpecFunctionFlow {
            doc /* The spec's functional thread; satisfy targets below point
                 at its subactions (one canonical usage per function). */
        }

        part typedStandardsSpec : SystemOfInterest::Components::SpecCorpus {
            doc /* The Typed Standards Spec component of the system of
                 interest (04), decomposed per 05 §3. Function-to-component
                 carriage (the solid function-to-component edges of 05 §4)
                 is modeled as components performing the function. The
                 external anchors carry the dotted TF2/TF3/TF6 delegation
                 edges (doc-noted): trust registries, the TSA, and Rekor
                 supply the properties the spec can only reference. */

            // Normative spec content.
            part dataSchema : DataSchema {
                perform action canonicalizeHash : CanonicalizeAndHash;        // TF1
                perform action signBindIdentity : SignAndBindIdentity;        // TF2 (crypto delegated to anchors)
                perform action timestampLog     : TimestampAndLog;            // TF3 (proofs delegated to anchors)
                perform action typeNodes        : TypeNodes;                  // TF4
            }
            part behaviorSpec : BehaviorSpec {
                perform action runVerification : RunVerification;             // TF6 (checks delegated to anchors)
            }
            part lifecycleMachines : LifecycleMachines {
                perform action manageLifecycle : ManageLifecycleAndVisibility; // TF7
            }
            part profiles : ProfilesAndVocabularies {
                perform action declareProduction : DeclareProductionProcess;  // TF5
            }
            part requirementsCorpus : RequirementsCorpus {
                doc /* Also governs how TF6's checks report (dotted TF6
                     edge in 05 §4). */
                perform action governConformance : GovernConformance;         // TF8
            }

            // Governance surfaces (TF8's second solid target in 05 §4).
            part adrs : AdrCorpus {
                perform action governConformance : GovernConformance;         // TF8
            }
            part openQuestions : OpenQuestionsRegistry;
            part xanadu : XanaduDoctrine;

            // External anchors — outside the normative content, referenced by it.
            part verifyCore : VerifyCore;
            part produceCore : ProduceCore;
            part rekorTsa : RekorAndTsa;
            part trustRegistries : PublisherTrustRegistries;

            // Study artifacts — exploratory views over the spec content above.
            part shacl : ShaclShapes;
            part sysmlModel : SysmlModel;
        }
    }

    // ------------------------------------------------------------------------
    //  TRACEABILITY (05 §4) — need-to-function satisfies
    // ------------------------------------------------------------------------
    package Traceability {
        private import TypedStandardsAsSystem::Needs::*;
        private import TypedStandardsAsSystem::Architecture::*;

        // The needs instantiated as requirement usages (satisfy must
        // reference a requirement usage; its by-referent must be a feature).
        requirement tn1 : ProcessBasedTrust;
        requirement tn2 : NoCentralAuthority;
        requirement tn3 : TamperEvidenceAndTime;
        requirement tn4 : LegibleCaptureMethod;
        requirement tn5 : SignalsNotTruth;
        requirement tn6 : AdjacentStandardsInterop;

        // TN1 process-based trust -> TF1 canonicalize & hash, TF2 sign &
        // bind, TF5 declare production process.
        satisfy tn1 by specFlow.canonicalizeHash;
        satisfy tn1 by specFlow.signBindIdentity;
        satisfy tn1 by specFlow.declareProduction;

        // TN2 no central authority -> TF2 sign & bind, TF6 verify.
        satisfy tn2 by specFlow.signBindIdentity;
        satisfy tn2 by specFlow.runVerification;

        // TN3 tamper-evidence & time -> TF1 canonicalize & hash, TF3
        // timestamp & log (dotted supporting: TF7 — retention asymmetry
        // keeps withdrawn content evidenced).
        satisfy tn3 by specFlow.canonicalizeHash;
        satisfy tn3 by specFlow.timestampLog;

        // TN4 legible capture method -> TF5 declare production process.
        satisfy tn4 by specFlow.declareProduction;

        // TN5 signals not truth -> TF8 govern conformance.
        satisfy tn5 by specFlow.governConformance;

        // TN6 adjacent-standards interop -> TF4 type nodes, TF8 govern.
        satisfy tn6 by specFlow.typeNodes;
        satisfy tn6 by specFlow.governConformance;
    }
}
