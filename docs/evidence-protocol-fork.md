# Evidence-protocol fork: long-form analysis

**Audience.** Contributors, collaborators, and readers who want the context behind Section 6 of `ROADMAP.md`.
**Status.** Living. Public-facing supersession of the maintainer's internal spin-out notes.

## Context

The evidence system that shipped in v0.6.0 is the most reusable piece of infrastructure this project has produced. Its primitives — canonical-JSON signing, Ed25519ph signatures, RFC 3161 timestamping via FreeTSA, Sigstore Rekor publishing, W3C PROV-O provenance graphs, content-addressable packages, a trust registry for key rotation, and an extensions architecture — are not civic-specific. Any AI-assisted analysis that needs tamper-evident provenance could use them: biomedical research, financial analysis, journalism, open science generally.

Two futures are currently reachable. This document describes them at enough depth to support the three decision criteria and the 2026-12-31 resolution date from `ROADMAP.md` Section 6.

## Path A — Civic-branded

The evidence system stays part of civic-ai-tools. The library lives in `civic-ai-tools-website/src/lib/evidence/`. Growth happens through:

- **Extensions.** Additional reverse-DNS extension types (Agent Receipts interop, BPMN replay, visual artifacts, Croissant ML metadata) widen what kinds of civic analysis the package can record without changing the core.
- **Partner consumers.** Government instances of the civicaitools.org pattern (e.g., a city running its own registry against its own data portals), forks for adjacent topical domains (climate, transit, housing), and compatible tools that adopt the same package format.
- **Cross-registry reference, later.** A thin federation protocol could emerge eventually, but only if and when partner registries exist.

Under Path A, the project's identity stays civic-AI tooling that produces signed evidence. Maintenance appetite stays at the current level: solo maintainer, one website, the commitments in `ROADMAP.md` Section 3.

## Path B — Domain-neutral spin-out

The evidence library, the registry protocol, and — depending on the Section 5 Next decision on skill-routing architecture — the meta-orchestrator direction are extracted as standalone infrastructure under a neutral name. The library becomes importable by any consumer (another website, a CLI, a Claude Code hook, an MCP server, a framework author). The registry protocol is documented at a level that lets compatible registries be run by other disciplines' communities.

Under Path B, civic-ai-tools is one *instance* of a more general protocol; civicaitools.org is one registry. Maintenance becomes a commitment to external adopters, which requires either expanded solo capacity or a co-maintainer arrangement.

## Open questions that either path has to address

- **Key management.** On civicaitools.org, one platform Ed25519 key signs everything, with rotation via the trust registry. Under Path B, whose key signs? User-generated? Per-domain? An "unsigned dev mode"? The answer shapes whether the library reads as *civic-AI evidence kit* or as *general-purpose signing library*.
- **Naming.** A civic-branded name optimizes for mission clarity and narrows scope. A neutral name optimizes for cross-domain adoption. Split-branding causes confusion. This decision is downstream of the fork, not upstream.
- **Relationship to adjacent emerging protocols.** civic-ai-tools' package format is more complete than several adjacent AI-provenance proposals today, but the field is young. The design commitment is to be composable-with, not competing-against; the extensions architecture is meant to absorb other formats as first-class artifacts.
- **Two-axis skill composition.** A reference consumer past a single data source will eventually want skill guidance composed on two axes — source (Socrata, Data Commons, etc.) and methodology (problem framing, descriptive analysis, equity analysis, benchmarking, communication). civic-ai-tools' source-keyed `SKILL_REGISTRY` is one axis; methodology-axis peers exist in the wild. Any spun-out library should anticipate the two-axis shape.

## Decision criteria (mirrors `ROADMAP.md` Section 6)

1. Whether at least one external integration surface beyond civicaitools.org emerges naturally during 2026.
2. Whether audience feedback from government, academic, and journalism users skews toward civic-specific framing or general-purpose framing.
3. Whether maintenance capacity can honestly absorb the additional commitment of third-party adopters depending on extracted infrastructure.

The criteria are observational. Resolution is driven by what actually happens in 2026, not by a preferred narrative.

## What lands when the decision resolves

An ADR in `docs/adr/` records, at minimum:

- The chosen path.
- The observed state of each of the three criteria at the decision point.
- Naming decisions (if any).
- Migration implications — under Path B, what moves where; under Path A, the explicit note that no migration happens.
- A conditional-Later-items update to `ROADMAP.md` Section 5.
