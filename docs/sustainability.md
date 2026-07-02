# Sustainability

**Audience.** Foundations, civic-tech grant programs, and individual supporters considering support for civic-ai-tools.
**Status.** Stub. Refined if and when a named funding arrangement lands.

## Current state

civic-ai-tools is a solo-maintained, self-funded, open-source project. All three repositories are MIT-licensed. The demo website runs on Vercel Pro; the Socrata MCP server runs on Render's paid tier; storage is Neon Postgres plus Vercel Blob. Costs are personal; maintainer time is uncompensated.

Release cadence has held at one-to-two-week coordinated cross-repo tags since v0.1.0 (March 2026). The evidence system shipped at v0.6.0, multi-source data access shipped at v0.7.0 and v0.8.0. `ROADMAP.md` is refreshed quarterly.

## Committed regardless of funding

The nine trust and reliability commitments in `ROADMAP.md` Section 3 are the floor. They do not depend on grants, partners, or future contracts. That includes:

- Five-year operational verifiability of every evidence package published since v0.6.0.
- ≥90-day breaking-change notice on the evidence-package schema and the documented publish API.
- Security triage SLOs: five business days to acknowledge, thirty days to fix or publicly advise on a critical issue.
- Publicly disclosed maintenance state if capacity ever changes. No stealth deprecation.
- A one-to-two-week coordinated release cadence, or an explicit update to `ROADMAP.md` if the cadence changes.

## What directed funding would enable

Without adopting commitments that would require a team, funding could accelerate:

- **Evaluation program depth.** Running the adversarial-attestation eval loop (civic#41) at regular cadence, producing public findings and skill-guidance revisions per round. Reviewer time is the bottleneck.
- **Data-source coverage.** Adding civic MCP sources beyond the current three (Socrata, Google Data Commons, Boston OpenContext). Portal-registry curation for ArcGIS and other long-tail catalogs.
- **Accessibility and documentation.** Documentation refresh for non-technical audiences; video walkthroughs; translated surfaces contingent on community capacity (see `ROADMAP.md` Section 7).
- **Infrastructure.** Migration from single-maintainer hosted services to more durable arrangements as traffic or partner commitments grow.

## What funding would not change

- The MIT license on all three repositories.
- The *disclosure, not validation* stance in the evidence system.
- The public, issue-linked roadmap and the ADR process.
- The out-of-scope list in `ROADMAP.md` Section 7 — including no proprietary data sources, no platform-issued correctness claims, no enterprise SLAs, and no editorial moderation at scale.

## Succession artifact

The succession *trigger* is committed in `ROADMAP.md` Section 3 (#7: no stealth deprecation; any known successor or fork linked). This section records *what a successor would need to hold* — the concrete assets behind the standard and the reference deployment:

- **Domains.** `civicaitools.org` (live) and `typedstandards.org` (registration in flight); registrar accounts are maintainer-held.
- **Registry signing keys.** The platform Ed25519 signing key (`EVIDENCE_SIGNING_KEY` / `EVIDENCE_KEY_ID`) and the trust-registry contents served at `/.well-known/typed-publisher.json`. Rotation runbook: `civic-ai-tools-website/docs/key-rotation.md`.
- **The publisher index** reserved at `typedstandards.org` (indexing-only; spec §8.13).
- **npm scope.** `@typedstandards` (the `verify-core` releases).
- **Archival DOI.** A Zenodo DOI is deferred to spec v0.2 (ADR-0012); once minted it joins this list.
- **Fast-handoff contact.** Currently the maintainer (see the reviewer-orientation document); a project inbox is planned alongside the typedstandards.org launch.

All of these are currently maintainer-held — the honest bus-factor-one state this stub exists to disclose. A named custody / handoff arrangement is part of the institutional-stewardship discussion referenced in the community-review orientation document.

## Accountability

Funded work lands under the same Now/Next/Later structure in `ROADMAP.md`, with the funding relationship disclosed on the affected items. Outputs of funded work remain open-source and open-access. A quarterly refresh surfaces what was funded, what shipped, and what slipped.
