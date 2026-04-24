# Research agenda

**Audience.** Researchers in civic technology, AI evaluation, science and technology studies, and information provenance.
**Status.** Stub. Refined in parallel with project-level research documentation (tracked under civic#22).

civic-ai-tools is an open research artifact as much as it is a working tool. This document names the research questions the project engages, the evaluation resources it generates as a byproduct, and how external researchers can cite, reproduce, or contribute.

## Questions this project engages directly

1. **Skill-guidance drift and efficacy.** How does model behavior change as explicit skill guidance is provided, revised, and version-captured per publish? How do findings from adversarial attestation on one analysis feed back into guidance revisions that improve the next? The evaluation loop (civic#41) is the mechanism.
2. **Evidence chains as a legibility primitive.** Does surfacing a cryptographic, tamper-evident provenance chain shift how non-technical readers — journalists, government workers, students — interpret AI-generated analyses? The evidence detail-page UX work (Section 5 Now) is the observational surface.
3. **Cost calibration and quality tiers.** Which model capabilities matter most for civic-data analysis? What correlations exist between model tier and hallucination, partial completion, or caveat-surfacing behavior? Addressed by website#27, website#28, website#29.
4. **Identity and credibility in AI-evidence systems.** Which identity models best match the trust needs of civic-data readers? The user-signed-evidence direction (website#67, #69, #70) draws on plural-identity thinking; civic#38 tracks the related Plurality chapter 4-1 research.
5. **Skill-composition architecture at multi-source scale.** Which architectural shape — dynamic routing, per-tool descriptions, meta-orchestrator MCP, methodology-by-source composition — scales best as the number of civic data sources grows? See Section 5 Next and `docs/research/skill-routing-architectural-shapes.md`.
6. **Feedback loops to data publishers.** Does metadata from AI analyses — query patterns, data-quality issues surfaced during analysis, gaps between user intent and available data — provide actionable signal to portal operators that could improve open-data hygiene? What format, cadence, and consent model would make such a signal useful without privacy or gaming risks? Tracked as civic-ai-tools#54.
7. **Data-availability gap identification.** Can aggregated query traces across published evidence packages surface systematically under-served civic-data needs (geographies, topics, data products), and what is the right response path (portal-level data request, community-data proposal, cross-portal aggregation, documentation as research signal)? Tracked as civic-ai-tools#55.
8. **Modular research objects from evidence artifacts.** Could parts of an evidence package be independently addressable and referenceable, so downstream data-science pipelines and Git-based workflows can import or cite them without pulling the whole package? Extends archivability from "whole-package durable" to "fine-grained reusable." Tracked as civic-ai-tools#56.
9. **Discoverability across accumulated evidence.** Once the registry has meaningful numbers of published packages, how should users find relevant prior work — by topic, geography, data source, author, similarity — without reintroducing star-rating dynamics or implying platform-issued quality claims? Tracked as civic-ai-tools#57.
10. **Lightweight user feedback complementary to expert attestation.** How does end-user reaction to evidence packages — thumbs up/down, quick quality signals — integrate with the attestation schema (`consistency`, `evaluation`, `expert_attestation`) without conflating disclosure with validation? Principle 1 constraint: reactions disclose how readers responded, not whether evidence is correct. Tracked as civic-ai-tools#58.
11. **Evidence systems as AI-literacy primitives.** Can the evidence layer's exposure of AI-in-motion (tool calls, skill guidance, reasoning traces, data lookups) serve as a pedagogical surface for literacy curricula — showing learners not just what AI answered but how it arrived there? What affordances would make evidence packages legible to learners versus technically literate reviewers? Relates to the data-literacy-curriculum item in `ROADMAP.md` § 7 (out of scope).
12. **Evidence layers in augmented deliberative systems.** How could a verifiable-evidence layer support AI-augmented deliberative processes — grounding claims during deliberation in cited public data while preserving the human-agency and collective-reasoning properties that distinguish deliberation from discrete preference aggregation? Related to Path B directions in `docs/evidence-protocol-fork.md`.
13. **Deliberative governance of the project itself as it scales.** As civic-ai-tools grows beyond solo maintenance toward contributor communities and external adopters, what governance forms — contributor councils, deliberative decision processes, user-led facilitation structures — best preserve the disclosure discipline and the commitment-certainty axis while distributing decision-making? Relates to `ROADMAP.md` § 8 governance and the evidence-system fork direction.

## Resources generated as byproducts

- **The `guidance-quality` corpus.** Issues labeled `guidance-quality` across the three repos name specific failure modes observed in production, with reproducing queries and commit SHAs. Intended as a longitudinal evaluation corpus for prompt and skill-guidance research.
- **Published evidence packages.** Each is a public, cryptographically signed record of a model + skill + data combination, with a full trace. Cite by slug or package hash; reproduce by re-running the recorded tool calls against the named source(s).
- **Landscape analysis.** `docs/research/landscape-analysis.md` surveys comparable civic, evidence, and agent projects. Cross-referenced with `census-mcp-landscape.md`, `skill-routing-architectural-shapes.md`, and `agent-receipts-evaluation.md`.

## Engagement paths

- **Cite.** Reference a specific package by slug or by content hash. Package JSON is canonical; it does not change.
- **Contribute a `guidance-quality` finding.** Include the query, observed behavior, expected behavior, and the reproducing commit SHAs across relevant repos.
- **Propose a collaboration.** Open an issue in the hub repo. The project welcomes co-authored evaluations, formal research partnerships, and external replication of its evaluation methodology, within the out-of-scope constraints named in `ROADMAP.md` Section 7.

## Framework alignment

civic-ai-tools' stance relates to several external frameworks without adopting any as its core identity:

- **FAIR data principles** — implicit alignment on all four axes (Findable via MCP, Accessible via documented API, Interoperable via content-addressable packages, Reusable via cryptographic chain). Not framed as a FAIR-alignment project; the principles are a shorthand reference for funder and researcher audiences.
- **Digital Public Infrastructure (DPI)** — the verifiable-evidence layer is a candidate DPI component for AI mediation of public records. See ROADMAP.md Section 1 for the adjacency note.

A detailed cross-walk with FAIR, DPI, the CKAN ecosystem, and Croissant (two-sided) lives in `docs/research/landscape-analysis.md` § 7 — Frameworks and principles.
