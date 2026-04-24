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

## Resources generated as byproducts

- **The `guidance-quality` corpus.** Issues labeled `guidance-quality` across the three repos name specific failure modes observed in production, with reproducing queries and commit SHAs. Intended as a longitudinal evaluation corpus for prompt and skill-guidance research.
- **Published evidence packages.** Each is a public, cryptographically signed record of a model + skill + data combination, with a full trace. Cite by slug or package hash; reproduce by re-running the recorded tool calls against the named source(s).
- **Landscape analysis.** `docs/research/landscape-analysis.md` surveys comparable civic, evidence, and agent projects. Cross-referenced with `census-mcp-landscape.md`, `skill-routing-architectural-shapes.md`, and `agent-receipts-evaluation.md`.

## Engagement paths

- **Cite.** Reference a specific package by slug or by content hash. Package JSON is canonical; it does not change.
- **Contribute a `guidance-quality` finding.** Include the query, observed behavior, expected behavior, and the reproducing commit SHAs across relevant repos.
- **Propose a collaboration.** Open an issue in the hub repo. The project welcomes co-authored evaluations, formal research partnerships, and external replication of its evaluation methodology, within the out-of-scope constraints named in `ROADMAP.md` Section 7.
