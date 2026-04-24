# ADR-0001: Public-roadmap governance

- **Status:** Accepted
- **Date:** 2026-04-23
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

civic-ai-tools is a multi-repo project (hub `civic-ai-tools`, MCP server `socrata-mcp-server`, website `civic-ai-tools-website`) with six distinct audience types: government partners, academic and policy partners, OSS contributors, journalists, potential funders, and end users. The project is maintained by one person at a one-to-two-week coordinated release cadence; as of v0.8.0 (2026-04-23), it runs three live MCP data sources, a shipped evidence system with external-publish API, and roughly three dozen open issues distributed across the repos.

Three conditions made public-roadmap governance necessary:

1. **Contributor and partner demand.** civic#17 tracked "Project governance: unified roadmap and contribution routing across repos" as an open need from launch.
2. **The evidence-system fork is unresolved and had not been publicly published *as* unresolved.** The project needs a governance-in-the-open surface for strategic decisions that will not land for months.
3. **The audience fan-out cannot be served by a single document.** A funder, a journalist, and an OSS contributor need different things from the same project; a monolithic doc dilutes every audience.

## Decision

Adopt `ROADMAP.md` in the hub-repo root with a nine-section structure, refreshed quarterly, featuring:

- Seven vision pillars derived from shipped behavior (Verifiable by default, Grounded in open civic data, Disclosure not validation, Portable across AI tools, Accessible to non-programmers, Sustainable for solo maintenance, Openly governed).
- Nine trust and reliability commitments, including a five-year operational verifiability window for evidence packages, a one-to-two-week coordinated release cadence, a ≥90-day breaking-change notice on the evidence-package schema and documented publish API, and explicit security triage SLOs.
- Now / Next / Later horizons on a *commitment-certainty* axis (Now and Next are committed; Later is scoped-not-committed), with each item tagged to pillars and audiences.
- The evidence-system fork published as an unresolved question, with three observational decision criteria and a public decision deadline of 2026-12-31.
- An explicit out-of-scope section with nine items.
- A governance section naming cadence, change process via `.github/ISSUE_TEMPLATE/roadmap-change.md`, a quarterly archive at `docs/roadmap/archive/vYYYY.QN.md`, and audience routing to four adjunct documents.

Supporting artifacts in the same adoption:

- `.github/ISSUE_TEMPLATE/roadmap-change.md` for non-trivial changes.
- Adjunct stubs under `docs/`: `trust-and-evidence.md`, `research-agenda.md`, `sustainability.md`, `evidence-protocol-fork.md`.
- This ADR log (`docs/adr/`) to capture future non-obvious decisions.
- A `/roadmap` page on civicaitools.org mirroring the document with a six-audience routing strip (delivered via the website repo).

## Considered and rejected alternatives

- **No public roadmap.** Rejected: contributor and partner friction; no governance-in-the-open surface for the evidence-system fork; civic#17 would stay open indefinitely.
- **GitHub Projects board across repos as the primary surface.** Rejected: Projects boards track tasks, not commitments; do not support trust-commitment framing or fork narrative; are not read by non-technical audiences.
- **Monolithic single-document roadmap addressing all six audiences inline.** Rejected: the document becomes unwieldy and dilutes every audience. The adjunct-routing pattern preserves length discipline.
- **Calendar-quarter Gantt-style delivery dates on feature items.** Rejected: solo-maintainer capacity makes fixed future dates unreliable. The commitment-certainty axis preserves honesty.
- **Resolving the evidence-system fork for the roadmap launch.** Rejected: publishing both paths as live is itself the governance-in-the-open move. Forcing resolution would optimize for funder legibility over integrity.

## Consequences

- **Quarterly maintenance cost.** The maintainer commits to a quarterly refresh and archive snapshot.
- **Change-proposal surface.** Non-trivial roadmap changes now route through a public issue template; some will require an ADR. This slows change velocity slightly and increases legibility.
- **Public deadline on the evidence-system fork.** A decision is committed for 2026-12-31. Not deciding is no longer cost-free.
- **Publicly committed breaking-change discipline.** The ≥90-day notice on the evidence-package format and documented publish API is now a commitment, not an informal practice.
- **Future ADR usage.** This ADR sets the numbering (0001) and shape. Expected future ADRs: the skill-routing-architecture choice from Section 5 Next; the evidence-system fork resolution itself; any identity-model direction changes.

## References

- `ROADMAP.md` (canonical public roadmap).
- civic#17 — umbrella governance issue closed by the roadmap's merge.
- `docs/evidence-protocol-fork.md` — long-form fork analysis.
- `civic-ai-tools-website/docs/design-principles.md` — companion UX + data-model principles (cited by number rather than re-derived).
