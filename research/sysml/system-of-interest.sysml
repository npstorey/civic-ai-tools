// ============================================================================
//  System of interest — civic-ai-tools and its immediate ecosystem
//
//  Source view : research/04-architecture-views.md (needs / functional /
//                logical views + cross-layer traceability)
//  Refined by  : research/sysml/tss-as-system.sysml (the Typed Standards
//                Spec component decomposed as its own system, from 05)
//  Detail model: research/sysml/typed-standards.sysml (the spec's normative
//                content as structure / behavior / requirements)
//
//  Package map (all nested under SystemOfInterest)
//    Stakeholders   who holds the needs (04 §1)
//    Needs          N1-N4 as requirement defs with stakeholder links
//    Functions      F1-F6 as action defs + the mission pipeline (04 §2)
//    Components     logical components, this repo highlighted (04 §3)
//    Architecture   reference configuration: parts, connections, performances
//    Traceability   need-to-function satisfies (04 cross-layer view)
// ============================================================================

package SystemOfInterest {
    doc /* The civic-ai-tools system as a whole — stakeholders, needs,
         functions, logical components, and their traceability, transcribed
         from research/04-architecture-views.md (exploratory sketch, not a
         decided spec). One of the parallel research views: this file answers
         to 04, which answers to the README, end-state-vision.md, and the ADR
         corpus. Solid edges of 04's traceability view are modeled as satisfy
         relationships and performed actions; dotted (supporting) edges are
         carried in doc notes rather than modeled relationships. */

    // ------------------------------------------------------------------------
    //  STAKEHOLDERS (04 §1)
    // ------------------------------------------------------------------------
    package Stakeholders {
        part def CivicTechnologist {
            doc /* Civic technologists, journalists, students — want
                 plain-English access to public civic data and trustworthy
                 AI analysis. */
        }
        part def GovernmentDataPublisher {
            doc /* Government workers / data publishers — want trustworthy
                 AI-mediated analysis over their data and open-standards
                 interoperability rather than a proprietary silo. */
        }
        part def DownstreamVerifier {
            doc /* Downstream verifiers — readers of AI analyses who need to
                 check what they are being shown and cite it durably. */
        }
    }

    // ------------------------------------------------------------------------
    //  NEEDS (04 §1) — requirement defs with stakeholder links
    // ------------------------------------------------------------------------
    package Needs {
        private import SystemOfInterest::Stakeholders::*;

        requirement def <'N1'> PlainEnglishDataAccess {
            doc /* Query public civic data in plain English, no coding. */
            subject soi;   // untyped: bound per-satisfy to the realizing feature
            stakeholder ct : CivicTechnologist;
        }
        requirement def <'N2'> TrustworthyAiAnalysis {
            doc /* Trust AI-mediated analysis — inspectable, reproducible,
                 verifiable. Held by every stakeholder group. */
            subject soi;
            stakeholder ct  : CivicTechnologist;
            stakeholder gov : GovernmentDataPublisher;
            stakeholder ver : DownstreamVerifier;
        }
        requirement def <'N3'> DurableCitableEvidence {
            doc /* Durable, citable evidence — timestamped, archived. */
            subject soi;
            stakeholder ver : DownstreamVerifier;
        }
        requirement def <'N4'> OpenStandardsInterop {
            doc /* Interoperability — open standards, not a proprietary
                 silo. */
            subject soi;
            stakeholder gov : GovernmentDataPublisher;
        }
    }

    // ------------------------------------------------------------------------
    //  FUNCTIONS (04 §2) — what the system does
    // ------------------------------------------------------------------------
    package Functions {
        action def DiscoverAndQueryData {
            doc /* F1 — discover and query civic datasets (NYC Open Data,
                 Google Data Commons). */
        }
        action def AnalyzeAndVisualize {
            doc /* F2 — analyze and visualize via AI assistant. */
        }
        action def PackageAsSignedEvidence {
            doc /* F3 — package analysis as signed evidence: hash, sign,
                 timestamp. Constrained by the Typed Standards Spec (package
                 shape). */
        }
        action def PublishToRegistry {
            doc /* F4 — publish to the evidence registry. Constrained by the
                 Typed Standards Spec (publish API contract). */
        }
        action def VerifyEvidence {
            doc /* F5 — verify evidence: signature, timestamp, transparency
                 log. Constrained by the Typed Standards Spec (the §9.2
                 verification sequence). */
        }
        action def GovernTheStandard {
            doc /* F6 — govern the standard: spec, ADRs, open-questions
                 registry. Sits outside the F1-F5 pipeline and constrains
                 F3, F4 and F5. */
        }

        action def MissionFlow {
            doc /* 04 §2 — the functional pipeline F1 -> F2 -> F3 -> F4 -> F5,
                 with F6 governing from the side (its constrains edges to
                 F3-F5 are doc-carried, not successions). */
            first start;
            then action query           : DiscoverAndQueryData;
            then action analyze         : AnalyzeAndVisualize;
            then action packageEvidence : PackageAsSignedEvidence;
            then action publish         : PublishToRegistry;
            then action verifyEvidence  : VerifyEvidence;
            then done;
            action govern : GovernTheStandard;
        }
    }

    // ------------------------------------------------------------------------
    //  COMPONENTS (04 §3) — logical components; this repo highlighted
    // ------------------------------------------------------------------------
    package Components {
        part def CivicAiToolsSystem {
            doc /* The system boundary — the def the Architecture reference
                 configuration instantiates. */
        }

        // ---- AI clients ----------------------------------------------------
        part def AiClient {
            doc /* Claude Code / Copilot / Cursor — the assistant the user
                 converses with; consumes the MCP configs and the skill. */
        }

        // ---- civic-ai-tools (this repo) --------------------------------------
        part def McpConfigs {
            doc /* THIS REPO — MCP configs: .mcp.json, .cursor, .codex. */
        }
        part def PublishEvidenceSkill {
            doc /* THIS REPO — publish-evidence skill + opengov skill docs.
                 The skill docs also support F2: reproducibility starts in
                 the analysis itself (queries recorded, no hallucinated
                 data). */
        }
        part def SpecCorpus {
            doc /* THIS REPO — Typed Standards Spec, ADRs, open-questions
                 registry, doctrine docs. The repo's main payload. Decomposed
                 as its own system of interest in tss-as-system.sysml. */
        }

        // ---- MCP servers ------------------------------------------------------
        part def SocrataMcpServer {
            doc /* socrata-mcp-server — NYC Open Data via the Socrata API. */
        }
        part def DataCommonsMcpServer {
            doc /* Data Commons MCP — Google Data Commons. */
        }

        // ---- companion components ---------------------------------------------
        part def EvidenceRegistryWebsite {
            doc /* civic-ai-tools-website — evidence registry + publish API
                 at civicaitools.org. */
        }
        part def VerifierStack {
            doc /* typedstandards.org — verify-core library + the standalone
                 client-side verifier. */
        }
        part def SigningInfra {
            doc /* Sigstore Rekor + RFC 3161 TSA — signing / timestamp
                 infrastructure (external, out-of-band). */
        }
    }

    // ------------------------------------------------------------------------
    //  ARCHITECTURE — reference configuration (04 §3 topology + carriage)
    // ------------------------------------------------------------------------
    package Architecture {
        private import SystemOfInterest::Components::*;
        private import SystemOfInterest::Functions::*;

        action mission : MissionFlow {
            doc /* The system's functional thread; satisfy targets below
                 point at its subactions (one canonical usage per
                 function). */
        }

        part civicAiTools : CivicAiToolsSystem {
            doc /* Reference configuration per 04 §3. Function-to-component
                 carriage (the solid function-to-component edges of 04's
                 traceability view) is modeled as components performing the
                 function: the component carries the function.
                 Dotted/supporting edges live in doc notes. */

            part aiClient : AiClient;
            part mcpConfigs : McpConfigs {
                perform action query : DiscoverAndQueryData;             // F1
            }
            part socrataServer : SocrataMcpServer {
                perform action query   : DiscoverAndQueryData;           // F1
                perform action analyze : AnalyzeAndVisualize;            // F2
            }
            part dataCommonsServer : DataCommonsMcpServer {
                perform action query   : DiscoverAndQueryData;           // F1
                perform action analyze : AnalyzeAndVisualize;            // F2
            }
            part publishSkill : PublishEvidenceSkill {
                doc /* Also supports F2 (dotted): the opengov skill's rules
                     make the analysis reproducible at the source. */
                perform action packageEvidence : PackageAsSignedEvidence; // F3
                perform action publish         : PublishToRegistry;      // F4
            }
            part registry : EvidenceRegistryWebsite {
                perform action publish : PublishToRegistry;              // F4
            }
            part verifier : VerifierStack {
                perform action verifyEvidence : VerifyEvidence;          // F5
            }
            part signingInfra : SigningInfra {
                perform action packageEvidence : PackageAsSignedEvidence; // F3 (timestamp + log legs)
                perform action verifyEvidence  : VerifyEvidence;          // F5 (proof-checking legs)
            }
            part specCorpus : SpecCorpus {
                doc /* F6; additionally specifies/constrains the registry,
                     the verifier stack, and the skill (04 §3 dotted
                     specifies edges), and constrains F3-F5 (04 cross-layer
                     view). */
                perform action govern : GovernTheStandard;               // F6
            }

            // 04 §3 topology.
            connect aiClient to mcpConfigs;
            connect mcpConfigs to socrataServer;
            connect mcpConfigs to dataCommonsServer;
            connect aiClient to publishSkill;
            connect publishSkill to registry;
            connect registry to signingInfra;
            connect verifier to registry;                                // dotted "verifies" in 04
        }
    }

    // ------------------------------------------------------------------------
    //  TRACEABILITY (04 cross-layer view) — need-to-function satisfies
    // ------------------------------------------------------------------------
    package Traceability {
        private import SystemOfInterest::Needs::*;
        private import SystemOfInterest::Architecture::*;

        // The needs instantiated as requirement usages over the reference
        // configuration (satisfy must reference a requirement usage, and its
        // by-referent must be a feature — here, mission subactions).
        requirement n1 : PlainEnglishDataAccess;
        requirement n2 : TrustworthyAiAnalysis;
        requirement n3 : DurableCitableEvidence;
        requirement n4 : OpenStandardsInterop;

        // N1 plain-English data access -> F1 query, F2 analyze.
        satisfy n1 by mission.query;
        satisfy n1 by mission.analyze;

        // N2 trustworthy AI analysis -> F3 package, F4 publish, F5 verify
        // (dotted supporting: F2 analyze, F6 govern).
        satisfy n2 by mission.packageEvidence;
        satisfy n2 by mission.publish;
        satisfy n2 by mission.verifyEvidence;

        // N3 durable citable evidence -> F3 package, F5 verify
        // (dotted supporting: F4 publish — the registry makes evidence
        // citable; durability comes from F3/F5's timestamp and
        // transparency-log steps).
        satisfy n3 by mission.packageEvidence;
        satisfy n3 by mission.verifyEvidence;

        // N4 open-standards interop -> F6 govern
        // (dotted supporting: F3-F5 — the functions the open standard
        // disciplines).
        satisfy n4 by mission.govern;
    }
}
