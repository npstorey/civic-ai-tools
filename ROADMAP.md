# civic-ai-tools — public roadmap

**Version:** 2026.Q2
**Last updated:** 2026-04-24
**Next scheduled refresh:** 2026-07-15

*This roadmap describes the maintainer's current plans and commitments. Items under Now and Next are committed; items under Later are scoped but not committed to a horizon. Scope, cadence, and priorities may shift in response to contributor interest, technical discovery, and maintenance capacity. The commitments in Section 3 are durable independent of feature changes.*

*See also: [README](README.md) for project navigation, [docs/research-agenda.md](docs/research-agenda.md) for research directions, and [docs/research/landscape-analysis.md](docs/research/landscape-analysis.md) for the ecosystem survey.*

---

## 1. What this project is, and why

A published analysis of open civic data should survive scrutiny. Six months after it's written, a reader should be able to tell what the AI was asked, which public data sources it queried, which figures came from which query, what guidance the model was operating under, and whether the package has been independently attested to or withdrawn. They should be able to verify all of this without trusting the site that hosts it. That is the problem civic-ai-tools exists to work on — not "AI over civic data," but *legible, verifiable AI over civic data*, and the infrastructure it takes to make that real.

In practical terms, civic-ai-tools is three open-source repositories. Together they let AI assistants (Claude Code, Cursor, Copilot, Codex, Claude Desktop, or any compliant client) query open civic data through the Model Context Protocol, and let anyone publish the result as a cryptographically signed evidence package. As of v0.8.0, three data sources are wired in — Socrata (NYC Open Data and others), Google Data Commons, and Boston OpenContext — behind a single routing registry; new sources slot in via a thin skill document and one registry entry. Audience: civic technologists, government data workers, journalists, students, and researchers who need AI outputs over civic data to be attributable and replayable. A survey of adjacent projects — at the tool-server, platform, deliberative-tools-interop, and agentic-state-vision layers — lives at `docs/research/landscape-analysis.md`. Within the broader Digital Public Infrastructure discussion about AI in public services, civic-ai-tools' niche is the verifiable-evidence layer — not discovery, not service delivery, not procurement.

## 2. Vision pillars

Seven disciplines describe what this project tries to hold itself to. They are not marketing claims; each is a behavior you can inspect in shipped code.

- **Verifiable by default.** Every analysis published to the registry ships as a content-addressable, cryptographically signed evidence package. Signatures are Ed25519 over canonical-JSON, timestamps are RFC 3161, and a Sigstore Rekor entry is recorded for every publish. The trust registry at `/.well-known/evidence-public-keys.json` lists every historical signing key by `kid`. Verification does not require trusting civicaitools.org.

- **Grounded in open civic data.** AI answers about public records must come from the records. Tool calls are recorded; sources are named and attributed per claim. The project connects only to open civic data APIs — no training-data fall-through for civic queries.

- **Disclosure, not validation.** The evidence system discloses what happened — which model, which sources, which tool calls, what guidance — and makes those disclosures tamper-evident. It does not certify that any analysis is *correct*. "Unverified" means no attestation has been added yet, not "the AI got it wrong." Every label on the site is audited against that distinction.

- **Portable across AI tools.** Because the data-access layer is MCP, the same stack works in any compliant client. No lock-in to one AI vendor.

- **Accessible to non-programmers.** A journalist or student with no local dev environment should be in a working session inside five minutes — Codespaces for the repo, a browser for the site. Documentation is written for readers who are not full-stack engineers.

- **Sustainable for solo maintenance.** The project is maintained by one person. Scope, cadence, and commitments are sized for that reality; the roadmap below does not promise features that would require a team. If capacity changes, that gets disclosed publicly.

- **Openly governed.** The roadmap, architectural decisions, and changes are public. Non-obvious decisions are captured as Architectural Decision Records in `docs/adr/`. Contributions route through this hub repo with public issue templates.

## 3. Trust and reliability commitments

These are the durable parts of the roadmap that hold *regardless of what features ship*. They are promises a solo maintainer can keep when feature work slips. Some are absolute commitments; others — those framed around numeric timelines — are operational targets the project aims for and publicly discloses when unable to meet.

1. **Evidence-package verifiability, long-term.** Any evidence package published on or after v0.6.0 will remain cryptographically verifiable for at least **five years** after publication. The trust registry records every historical signing key; key material is never deleted, only superseded. The underlying cryptographic chain (Ed25519 signatures, FreeTSA RFC 3161 timestamps, Sigstore Rekor entries) is independent of civicaitools.org and remains externally verifiable by third-party tooling beyond that window. The five-year commitment covers operational aspects: trust-registry availability, verification-tooling maintenance, key-rotation runbook adherence.

2. **Coordinated release cadence.** Meaningful scope ships on a one-to-two-week cycle with cross-repo coordinated version tags (most recently v0.8.0, 2026-04-23). Tags are the stable checkpoints contributors and partners can pin to. If the cadence materially changes, the next refresh will describe the new one; no silent slowdown.

3. **Advance notice on breaking changes.** Breaking changes to the evidence-package `formatVersion` schema, the signature-verification procedure, or the documented `POST /api/evidence` contract (see `civic-ai-tools-website/docs/api/evidence-publish.md`) ship with advance notice and a documented migration path. The project targets 90 days of notice; a shorter notice period is published with rationale when that target cannot be met. Older `formatVersion` values stay verifiable indefinitely.

4. **Security triage.** Reports sent to the published security contact receive acknowledgment; the project targets five business days, with longer turnaround possible during extended maintainer absence. Critical vulnerabilities — signing-key compromise, verification bypass, credential exposure — receive a fix or a public advisory published via GitHub Security Advisories; the project targets 30 days for that disclosure, with longer timelines publicly reported when they occur.

5. **API stability for documented endpoints.** Endpoints documented in-repo (today, `POST /api/evidence`) follow the 90-day rule above. Undocumented and internal endpoints may change at will.

6. **Security-path test coverage.** Security-sensitive paths — at minimum the device-flow OAuth path introduced in v0.8.0 — carry automated coverage. New such paths ship with coverage in the same change.

7. **No stealth deprecation.** If the project enters reduced-maintenance mode, a public notice appears on this roadmap and the hub README, with any known successor or fork linked. Nothing gets silently removed from the spec.

8. **No dark patterns around identity.** Publishing requires sign-in; the signed-in user is disclosed on the evidence page. Changes to this default (anonymous publishing, a different identity model) ship with explicit consent UI and clearly surfaced trade-offs.

9. **Directory hygiene.** MCP-server and dataset directory entries are reviewed before addition. Stale entries are marked stale, not silently removed.

## 4. Recently shipped

The last three cycles. Each item is a user-visible outcome, not a feature name.

- **v0.8.0, 2026-04-23** — Three civic data systems (NYC Open Data, Google Data Commons, Boston OpenContext) behind one interface with per-source attribution; external tools can publish to the registry over a documented API with OAuth device-flow auth; signing keys rotate without breaking prior packages' verifiability.
- **v0.7.0, 2026-04-17** — A single query can now combine NYC Open Data with Google Data Commons and cite each figure back to its source; a Claude Code skill ships for publishing frontier-model analyses to the registry.
- **v0.6.0, 2026-04-13** — Any analysis produced through the site can be published as a tamper-evident, timestamped, externally verifiable evidence package.

## 5. Now / Next / Later

**Axis.** *Now* is committed and active in the current cycle. *Next* is committed and scoped to the following two or three cycles. *Later* is identified and scoped in concept but not committed to a horizon. Each item is outcome-framed and tagged to the vision pillars it serves and the audiences it addresses. Linked GitHub issues are the authoritative scope; bullet text is the public summary.

### Now

- **Close the loop between publishing and skill-guidance improvement.** Make adversarial-attestation findings a recurring feedback signal for skill guidance, and capture composed skill text on every Claude Code publish by default so findings link to the guidance version that produced them. [civic#41, civic#43] — *Grounded in open civic data; Disclosure not validation* — *civic technologists, researchers.*

- **Make the site's novel discipline legible within 90 seconds.** A first-time visitor should see that this is analysis-level cryptographic evidence over civic data — not a generic AI demo — in hero copy, About/Learn content, and post-response affordances. [website#61, website#86] — *Disclosure not validation; Accessible to non-programmers* — *journalists, government partners, students.*

- **Make the evidence detail page readable on long analyses.** Dense traces produce long provenance chains; the page's visual hierarchy should keep them scannable. Design memo landed 2026-04-23 (`civic-ai-tools-website/docs/evidence-detail-ux-memo.md`); implementation split across [website#88], [website#89], [website#90], [website#91], [website#92], with a server-side-narration design follow-on at [website#93]. — *Disclosure not validation* — *journalists, researchers.*

### Next

- **Decide how skill guidance scales past three data sources.** A research memo comparing dynamic routing, per-tool descriptions, and meta-orchestrator MCP, with the chosen path recorded as an ADR. Code work is deferred until the decision lands — decisions should not defer. [civic#44, website#65, website#57, website#82] — *Portable across AI tools; Sustainable for solo maintenance* — *OSS contributors, government partners.*

- **Ship a lifecycle model and bundle format external consumers can depend on.** Event-history refactor of evidence lifecycle, plus composite evidence bundles (package + attestations as one content-addressable artifact) so third-party verifiers need not call separate website APIs. [website#58, website#72] — *Verifiable by default* — *OSS contributors, government partners, journalists.*

- **Improve model-quality signal and shareable trace URLs.** Calibrated quality tiers for available models so users can match model to stakes, and stable shareable URLs that replay a query without re-executing. [website#27, website#26] — *Disclosure not validation; Accessible to non-programmers* — *all audiences.*

- **Extend civic data coverage and portal-registry hygiene.** Address known portal-registry data-quality limitations (capped counts, ArcGIS curation), accept community directory submissions via the existing issue template, and evaluate an `aggregate_data` helper on the Socrata MCP server. [website#38, website#39, civic#37, socrata-mcp#40] — *Grounded in open civic data* — *government partners, OSS contributors.*

### Later

- **Evolve the evidence-identity model.** Move from platform-signed to user-signed evidence with multi-signer attestations, and surface identity-strength tiers (GitHub / ORCID / institutional) so readers can calibrate. Informed by Plurality chapter 4-1 research. Committed architectural direction; scope is large. [website#67, website#69, website#70, civic#38] — *Disclosure not validation; Openly governed* — *researchers, journalists, academic partners.*

- **Let the evidence package travel outside civicaitools.org.** Interop extensions (Agent Receipts, BPMN replay, visual artifacts, Croissant ML metadata), pulled forward only as real consumers emerge. [website#59, website#60, website#68, website#74] — *Verifiable by default* — *OSS contributors, adjacent-field consumers.*

- **Lower setup friction for non-programmers further.** Pre-built Codespace image and Gitpod support, driven by audience patterns not speculation. [civic#10, civic#11] — *Accessible to non-programmers* — *journalists, students, OSS contributors.*

- **Formal project framing and outreach.** Branding, community pathways, and positioning the project's relationship to a research program. [civic#21, civic#22] — *Openly governed* — *all audiences.*

## 6. The evidence-system fork

The evidence system shipped in v0.6.0 is the most reusable piece of infrastructure this project has produced. Its primitives — canonical-JSON signing, hash-chained provenance, PROV-O graphs, RFC 3161 timestamps, Sigstore Rekor publishing — are not civic-specific. Two futures are currently reachable:

**Path A — Civic-branded.** The evidence system stays part of civic-ai-tools. The library continues to live in `civic-ai-tools-website/src/lib/evidence/`; growth happens through extensions and partner consumers — government instances of civicaitools.org, forks for adjacent cities, compatible tools that adopt the package format.

**Path B — Domain-neutral spin-out.** The evidence library, registry protocol, and — depending on the Section 5 Next decision on skill-routing — the meta-orchestrator are extracted as standalone infrastructure under a neutral name, available to adjacent disciplines (open science, journalism, biomedical research) to run their own compatible registries. civic-ai-tools becomes one *instance* of a more general protocol.

**Both futures are currently reachable. We are gathering signal. Resolution by end of 2026.** Decision criteria:

- Whether at least one external integration surface beyond civicaitools.org emerges naturally during 2026.
- Whether audience feedback from government, academic, and journalism users skews toward civic-specific framing or general-purpose framing.
- Whether maintenance capacity can honestly absorb the additional commitment of third-party adopters depending on extracted infrastructure.

Publishing the fork here, unresolved, is itself the governance-in-the-open move.

**Conditional Later items.** A shared skill registry (website#57) and the meta-orchestrator MCP direction (civic#44) accelerate under Path B and stay scoped to civic use under Path A. Croissant interop (website#68) and composite bundles (website#72) serve both paths. The identity-model Later item (website#67) is path-independent. Long-form analysis lives at `docs/evidence-protocol-fork.md`.

## 7. Out of scope

Scope-request categories the project explicitly does not take on. Each has a short rationale so contributors and potential partners can redirect early.

- **Proprietary data sources or login-walled commercial APIs.** Scope is open civic data. Integrations requiring paid access, enterprise credentials, or non-open licenses are out unless the provider adds a public-access tier.

- **General-purpose AI chat.** The site demonstrates AI against civic data; it is not a general assistant. Out-of-domain queries return "not this tool's job," not training-data responses.

- **Platform-issued correctness claims.** The registry publishes *disclosures*, not *validations*. Expert attestations, when present, are separately signed objects produced by identifiable attesters.

- **Enterprise SLAs or managed hosting.** The demo runs on standard Vercel Pro. All three repos are open source; organizations wanting higher SLAs should run their own instances.

- **Editorial moderation of published analyses at scale.** Withdrawal and reinstatement are signed, public actions available to authors. The registry does not editorially moderate beyond obvious-abuse response. Hosting an evidence package does not endorse its claims.

- **Platform-issued identity or platform-conferred credibility.** Identity tiers in the UI describe binding strength (ORCID is more durable than GitHub); they do not reflect platform judgment.

- **Legal advisory on data-use terms or open-records compliance.** The project does not attest to users' compliance with provider terms, open-records laws, or jurisdictional requirements. Users are responsible for their own use of public data.

- **Model training or fine-tuning.** The project uses off-the-shelf foundation models via OpenRouter (and, under evaluation, direct provider APIs). It does not train, fine-tune, or host model artifacts.

- **Translation or internationalization.** The interface and documentation are English-only, as a scope decision rather than a backlog item. Translations would be welcome if community capacity emerged; the maintainer does not commit to maintaining translated surfaces.

- **Adjudicative use of AI-generated outputs.** The project's evidence system discloses provenance; it does not certify that outputs are suitable for eligibility determinations, enforcement actions, benefits adjudication, policing or immigration workflows, health or safety emergency response, or any decision where a civic-data answer drives an individual's legal, material, or safety outcome. Users electing to rely on outputs in these contexts do so outside the project's scope, and the registry does not endorse such use.

- **Uniform-quality coverage across every reachable data portal.** The system can connect to Socrata portals broadly and queries Data Commons and Boston OpenContext through their documented APIs. Higher-confidence skill guidance, tested query patterns, and known-limitation notes exist for a smaller, actively-maintained subset. The project does not claim every reachable portal is equally well-supported.

- **Data literacy curriculum development.** Training civic technologists, journalists, students, and public servants to use AI-assisted civic-data analysis responsibly is an adjacent discipline to this project's build scope. The project welcomes partnerships with training organizations, classroom deployments, and directed funding for curriculum work; the maintainer does not commit to producing or maintaining curricula directly. Contributions of tutorials, worked examples, and course materials are welcome through the issue process.

## 8. Governance

**Cadence.** The roadmap refreshes once per quarter. Each refresh updates version and dates, migrates shipped Now items into "Recently shipped," and promotes Next items to Now as cycles start on them. v2026.Q2 is the first public version.

**Change process.** Non-trivial changes — adding or removing a theme, changing a trust commitment, updating fork-decision criteria — go through a roadmap-change issue (template at `.github/ISSUE_TEMPLATE/roadmap-change.md`) and, where appropriate, an ADR in `docs/adr/`. Minor corrections can land as direct commits.

**Archive.** Each quarterly snapshot is preserved at `docs/roadmap/archive/vYYYY.QN.md` when superseded, making roadmap drift inspectable: what was promised, what shipped, what slipped.

**Where things live.**

- **This roadmap** — themes, horizons, trust commitments, out-of-scope lines.
- **GitHub Issues** — concrete scope, discussion, acceptance criteria. The authoritative backlog.
- **`docs/adr/`** — architectural decisions, including the eventual evidence-system fork resolution.
- **`docs/research/landscape-analysis.md`** — ecosystem survey of adjacent civic-AI, evidence, and gov-tech projects, and where this project sits among them.
- **Per-release tags and their annotated messages** — the diff between one operational checkpoint and the next.

**Audience routing.** The `/roadmap` page on civicaitools.org mirrors this document and adds a short top strip routing each audience — government partners, academic and policy partners, OSS contributors, journalists, funders, end users — to the adjunct best matched to them: `docs/trust-and-evidence.md`, `docs/research-agenda.md`, `docs/sustainability.md`, or `docs/evidence-protocol-fork.md`.

**Feedback.** The fastest path to push back on this roadmap is an issue using the roadmap-change template. The project does not run a community chat at this stage; community capacity is a Later item, not a present commitment.

---

*civic-ai-tools is a personal project maintained by a single person. It is not affiliated with, endorsed by, or representative of any employer or organization.*
