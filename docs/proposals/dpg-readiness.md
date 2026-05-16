---
Status: Proposal
Last updated: 2026-05-16
Maintainer: [TK: leave as placeholder]
---

# Digital Public Goods Standard readiness

## Purpose

Make civic-ai-tools ready to submit to the [Digital Public Goods Alliance](https://www.digitalpublicgoods.net) registry, which would increase discoverability for international funders, researchers, and civic-tech audiences. The DPG Standard has 9 indicators; the project is already largely aligned by design, but several pieces of documentation are needed before submission.

This proposal organizes the work into filed GitHub issues, identifies what's substantive vs. mechanical, and notes overlap with the parallel pilot-integration arc at `data-concierge-integration.md`.

## Per-indicator status

| # | Indicator | Status | Where addressed |
|---|-----------|--------|-----------------|
| 1 | Relevance to SDGs | ✅ Strong | Documented in submission packet (#73) |
| 2 | Approved open licenses | ⚠️ Verify + declare | #75 (licensing audit) |
| 3 | Clear ownership | ⚠️ In flight | Ownership transition (out-of-scope; coordinated separately) |
| 4 | Platform independence | ⚠️ Partial | Proposed-issue 010 (platform-independence doc) |
| 5 | Documentation | ✅ Strong | Existing architecture + research docs; some packaging work |
| 6 | Mechanism for extracting data | ✅ Strong | Bundle-export endpoint from #69 satisfies |
| 7 | Privacy and applicable laws | ⚠️ Real tension | #74 (privacy-and-applicable-laws doc — substantive) |
| 8 | Adherence to standards | ✅ Strong | Standards-landscape work (see #67); conformance table |
| 9 | Do no harm by design | ⚠️ Mostly strong; gaps | #63 (harms section); proposed-issue 009 (natural-person ontology) |

## The substantive work

Two indicators require substantive thinking, not just packaging:

**Indicator 7 — privacy and applicable laws (issue #74).** The publication-irreversibility property in the OES architecture is in real tension with GDPR Article 17 right-to-erasure. The architecture has good mitigations (attest-by-default, withdrawal meta-attestations, host policy de-listing, content-vs-commitment separation, subject-objection meta-attestations), but they need to be articulated as a coherent doc. The doc is useful well beyond DPG — standards-track engagement (SCITT, W3C), academic adoption, partner agreements.

**Indicator 9 — do no harm by design (#63 + proposed-issue 009).** The OES harms section (#63, existing) needs expansion to incorporate the attest/publish framing introduced by the pilot-integration arc. The subject-of-claim natural-person ontology (proposed-issue 009) is the highest-leverage single defense against the doxxing failure mode and should land as a follow-on issue after typed attestations (#70).

## Filed issues

| # | Title | Scope |
|---|-------|-------|
| [#73](https://github.com/npstorey/civic-ai-tools/issues/73) | Submit civic-ai-tools to the DPGA registry | Sibling to #50; coordinates the submission act |
| [#74](https://github.com/npstorey/civic-ai-tools/issues/74) | Write privacy-and-applicable-laws documentation | Substantive (Indicator 7) |
| [#75](https://github.com/npstorey/civic-ai-tools/issues/75) | Audit and declare licenses across repos, specs, and sample data | Mechanical (Indicator 2) |

Related proposed-issue (will be promoted when its dependency lands):

- **010** at `civic-ai-tools-website/docs/proposed-issues/010-platform-independence-documentation.md` — Indicator 4.

Coordination with existing issues:

- **#50** (Democratic Capabilities Gap Map submission) — sibling submission effort; the two share preparation work.
- **#63** (threat model documentation by capture method) — supports Indicator 9; expanded per the cross-reference comment with the pilot-integration arc context.
- **#67** (standards adoption review) — supports Indicator 8 evidence.

## Sequencing

**Phase 1 — substantive writing (1-3 weeks, parallel with the integration arc):**
- #74 (privacy doc) — the longest-lead substantive piece.
- #63 expansion (harms section incorporates attest/publish framing).

**Phase 2 — mechanical work (1 week, interleave with anything):**
- #75 (licensing audit + declarations).
- Ownership-transition documentation (coordinated separately).

**Phase 3 — packaging (1-2 weeks):**
- Documentation packaging (top-level READMEs; outside-reader explainer; use-cases page; standalone glossary).
- Standards-conformance table (Indicator 8).
- SDG-relevance doc (Indicator 1) — synthesis of existing material.
- Data-portability doc (Indicator 6).

**Phase 4 — submission (after Phases 1-3 land):**
- #73 (DPGA registry submission packet + submission).

## Overlap with the pilot-integration arc

Work done for the pilot integration also moves DPG readiness forward. Explicit overlaps:

| DPG item | Integration-arc equivalent | Notes |
|----------|----------------------------|-------|
| Harms section (Indicator 9) | Existing #63 (expanded per cross-reference comment) | Same doc; one effort. |
| Natural-person ontology (Indicator 9) | Proposed-issue 009 (follow-on from #70) | Becomes a 5th issue eventually; serves both arcs. |
| Subject-objection ops (Indicator 7) | #70 (typed attestation primitive) | Implementation overlap. |
| Data portability (Indicator 6) | #69 bundle-export endpoint | Bundle export work serves both arcs. |
| Model-agnostic captureMethod (Indicator 4) | #69 captureMethod work + proposed-issue 010 | Captures the model used; proposed-issue 010 frames it as model-agnosticism evidence. |
| Standards conformance (Indicator 8) | #67 + spec-preamble work | Existing #67 supplies the substance; conformance table is the packaging. |

Net effect: the pilot-integration arc moves DPG readiness forward as a side effect. The DPG-specific incremental work is the privacy doc (#74), the harms expansion beyond what the integration arc needs, licensing declarations (#75), and the packaging docs.

## Out of scope

- Fiscal-sponsorship transition mechanics (coordinated separately; affects Indicator 3 evidence but not gated by this arc).
- DPGA-specific governance or contributor agreements (assessed at submission time).
- Re-licensing existing code (assumes current licenses are acceptable; flag if not).
- Children's-data subject-category mechanics (the position statement is in #74; the operational mechanism is a follow-on after proposed-issue 009 lands).

## Open questions

- **Submission timing**: aim for DPGA registry submission before UN Open Source Week, or after the pilot's first iteration ships? Pre-OSW gives DPGA framing for the OSW conversation; post-pilot gives a concrete adopter to point to. Tracked in #73.
- **Co-submission**: does the integration partner submit alongside this project (joint civic-AI-tools-stack submission), or are they separate submissions with cross-references? Tracked in #73.
- **Spec authorship structure**: solely project, jointly with the integration partner, or open-authored via a draft-RFC-style process? Affects ownership-transition documentation; tracked separately.

## Source materials

- The DPG Standard: https://www.digitalpublicgoods.net/standard (9 indicators).
- In-session DPG analysis run on the integration architecture (in workspace planning docs at `dpg-readiness-project-plan.md`).
- Existing project state: three GitHub repos under `npstorey/`; OES + CCV spec drafts in `civic-ai-tools/docs/architecture/`; design-principles + trust-and-evidence docs.
