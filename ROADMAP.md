# civic-ai-tools — public roadmap

**Last updated:** 2026-08-10
**Next snapshot:** v2026.Q3, cut at quarter close (see Section 8)
**Last change:** 2026-08-10 — 2026-Q3 baseline refresh [civic#140]: this document became the live roadmap; the superseded v2026.Q2.1 snapshot is archived at `docs/roadmap/archive/`; Section 6 rewritten now that the extraction it deferred has shipped; commitments 1–3 restated for accuracy.

*This is the **live** roadmap. It describes the maintainer's current plans and commitments and is updated as work ships, not on a fixed cycle; frozen, citable snapshots are cut at quarter ends into `docs/roadmap/archive/` (see Section 8). Items under Now and Next are committed; items under Later are scoped but not committed to a horizon. Scope, cadence, and priorities may shift in response to contributor interest, technical discovery, and maintenance capacity. The commitments in Section 3 are durable independent of feature changes.*

*See also: [README](README.md) for project navigation, [docs/research-agenda.md](docs/research-agenda.md) for research directions, and [docs/research/landscape-analysis.md](docs/research/landscape-analysis.md) for the ecosystem survey.*

---

## 1. What this project is, and why

A published analysis of open civic data should survive scrutiny. Six months after it's written, a reader should be able to tell what the AI was asked, which public data sources it queried, which figures came from which query, what guidance the model was operating under, and whether the package has been independently attested to or withdrawn. They should be able to verify all of this without trusting the site that hosts it. That is the problem civic-ai-tools exists to work on — not "AI over civic data," but *legible, verifiable AI over civic data*, and the infrastructure it takes to make that real.

In practical terms, civic-ai-tools is four open-source repositories: this hub (skill guidance, specifications, decision records), the Socrata MCP server, the reference web application behind civicaitools.org, and typedstandards — the neutral home of the Typed Standards specification and its published npm packages. Together they let AI assistants (Claude Code, Cursor, Copilot, Codex, Claude Desktop, or any compliant client) query open civic data through the Model Context Protocol, and let anyone publish the result as a cryptographically signed evidence package. Three data sources are wired in — Socrata (NYC Open Data and others), Google Data Commons, and Boston OpenContext — behind a single routing registry; new sources slot in via a thin skill document and one registry entry. Audience: civic technologists, government data workers, journalists, students, and researchers who need AI outputs over civic data to be attributable and replayable. A survey of adjacent projects — at the tool-server, platform, deliberative-tools-interop, and agentic-state-vision layers — lives at `docs/research/landscape-analysis.md`. Within the broader Digital Public Infrastructure discussion about AI in public services, civic-ai-tools' niche is the verifiable-evidence layer — not discovery, not service delivery, not procurement.

**Where 2026-Q3 has taken it.** Over the third quarter, the software powering the reference implementation at civicaitools.org became a parameterized open-source project in its own right — one that itself depends on published core components: `@typedstandards/produce-core` and `@typedstandards/verify-core` (the format layer) and `@typedstandards/civic-typed-harness` (the civic domain layer), each encoding adherence to the Typed Standards specification. The reference application was split from the side-by-side home-page demo onto its own app subdomain, and its infrastructure dependencies became swappable drivers behind documented seams, with a standalone container image and compose stack that have been exercised on standard cloud infrastructure. The remaining Q3 work expands the app's capabilities and keeps it easily deployable on standard infrastructure. Section 4 lists what shipped; Section 6 records what this did to the project's oldest strategic question.

## 2. Vision pillars

Eight disciplines describe what this project tries to hold itself to. They are not marketing claims; each is a behavior you can inspect in shipped code.

- **Verifiable by default.** Every analysis published to the registry ships as a content-addressable, cryptographically signed evidence package. Signatures are Ed25519 over canonical-JSON, timestamps are RFC 3161, and a Sigstore Rekor entry is recorded for every publish. The trust registry at `/.well-known/typed-publisher.json` (also served at the legacy `/.well-known/evidence-public-keys.json` path) lists every historical signing key by `kid`. Verification does not require trusting civicaitools.org — and with the producer and verifier cores published as npm packages, third parties can now produce and verify compatible packages without touching this project's infrastructure at all.

- **Grounded in open civic data.** AI answers about public records must come from the records. Tool calls are recorded; sources are named and attributed per claim. The project connects only to open civic data APIs — no training-data fall-through for civic queries.

- **Disclosure, not validation.** The evidence system discloses what happened — which model, which sources, which tool calls, what guidance — and makes those disclosures tamper-evident. It does not certify that any analysis is *correct*. "Unverified" means no attestation has been added yet, not "the AI got it wrong." Every label on the site is audited against that distinction.

- **Portable across AI tools.** Because the data-access layer is MCP, the same stack works in any compliant client. No lock-in to one AI vendor.

- **Instance-first and self-hostable.** The reference deployment is one instance of software anyone can run. Instance identity is configuration, not code: signing keys, publisher metadata, brand, model endpoint, database, object storage, and the notebook executor are all per-instance choices behind documented seams (ADR-0019, whose original fork-first framing ADR-0020 refined to instance-first; ADR-0023), and a self-hosted deploy guide takes an operator from `git clone` to a running instance. Running your own instance is a supported outcome, not a defection.

- **Accessible to non-programmers.** A journalist or student with no local dev environment should be in a working session inside five minutes — Codespaces for the repo, a browser for the site. Documentation is written for readers who are not full-stack engineers.

- **Sustainable for solo maintenance.** The project is maintained by one person. Scope, cadence, and commitments are sized for that reality; the roadmap below does not promise features that would require a team. If capacity changes, that gets disclosed publicly.

- **Openly governed.** The roadmap, architectural decisions, and changes are public. Non-obvious decisions are captured as Architectural Decision Records in `docs/adr/`. Contributions route through this hub repo with public issue templates.

## 3. Trust and reliability commitments

These are the durable parts of the roadmap that hold *regardless of what features ship*. They are promises a solo maintainer can keep when feature work slips. Some are absolute commitments; others — those framed around numeric timelines — are operational targets the project aims for and publicly discloses when unable to meet. Unless a commitment says otherwise, these commitments bind this project's own artifacts and the reference deployment at civicaitools.org; the published specification and cores give any independently operated instance the means to adopt the same commitments, but this project does not promise on other operators' behalf.

1. **Evidence-package verifiability, long-term.** Any evidence package published by the reference deployment (civicaitools.org) on or after v0.6.0 will remain cryptographically verifiable for at least **five years** after publication. The trust registry records every historical signing key; key material is never deleted, only superseded. The underlying cryptographic chain (Ed25519 signatures, FreeTSA RFC 3161 timestamps, Sigstore Rekor entries) is independent of civicaitools.org and remains externally verifiable by third-party tooling beyond that window. The five-year commitment covers operational aspects: trust-registry availability, verification-tooling maintenance, key-rotation runbook adherence.

   *Scope, stated precisely.* This commitment binds the reference deployment's published records. The published cores and the specification give every instance the means to make the same commitment for records it signs — this project does not promise on other instances' behalf. The unsigned development tier (ADR-0020) exists so an instance can be brought up with no key material at all; unsigned records are explicitly outside this guarantee.

2. **Release cadence and version tags.** Earlier versions of this roadmap committed to meaningful scope shipping on a one-to-two-week cycle with cross-repo coordinated version tags. The shipping cadence held; the coordinated-tag scheme materially diverged, and per this commitment's own no-silent-change clause, here is the cadence as actually practiced: npm packages (`@typedstandards/verify-core`, `@typedstandards/produce-core`, `@typedstandards/civic-typed-harness`) follow semantic versioning independently, each on its own release line; repos tag milestone states individually when a milestone is real (most recently v0.9.0 on this hub, 2026-08-01); sprint-internal rollback tags mark merge checkpoints and are not releases; cross-repo coordinated tags are cut only at genuinely coordinated states, not on a calendar. The durable core is unchanged: if the cadence materially changes again, the next roadmap change describes the new one — no silent slowdown.

3. **No silent breaking changes, ever.** That durable core holds in every phase. In the current phase, while the specification and the documented API are still stabilizing, every breaking change — to the evidence-package `formatVersion` schema, the signature-verification procedure, or the documented `POST /api/evidence` contract (see `civic-ai-tools-website/docs/api/evidence-publish.md`) — ships with a documented migration path and prompt public disclosure. Once the spec and API stabilize (goal: within two to three quarters), a 90-day advance-notice window takes effect; the switch-over will be announced in a roadmap refresh when it happens. Older `formatVersion` values stay verifiable indefinitely.

   *Disclosure (2026-Q3) — the history behind this restaging.* The ADR-0016 vocabulary migration changed the visibility values the API serves and accepts (`committed`→`sealed`, `published`→`public`) ahead of the notice mechanism the previous form of this commitment described: no 90-day window ran, and no shorter period was published with rationale before the change. Mitigating facts, recorded rather than offered as excuses: the migration path shipped *before* the breaking read (an accept-both phase preceded the flip), legacy aliases are still served, and the change landed pre-launch with no known external API consumers at the time. The commitment's substance — no silent breaking change, and a migration path with every one — held; the fixed notice window did not, which is why the commitment now states its phasing explicitly. Adopted through the civic#140 roadmap-change review.

4. **Security triage.** Reports sent to the published security contact receive acknowledgment; the project targets five business days, with longer turnaround possible during extended maintainer absence. Critical vulnerabilities — signing-key compromise, verification bypass, credential exposure — receive a fix or a public advisory published via GitHub Security Advisories; the project targets 30 days for that disclosure, with longer timelines publicly reported when they occur.

5. **API stability for documented endpoints.** Endpoints documented in-repo (today, `POST /api/evidence`) follow the breaking-change commitment above (commitment 3), including its phased notice window. Undocumented and internal endpoints may change at will.

6. **Security-path test coverage.** Security-sensitive paths — at minimum the device-flow OAuth path introduced in v0.8.0 — carry automated coverage. New such paths ship with coverage in the same change. *Status disclosure:* the security-sensitive surfaces added in 2026-Q3 (the sign-in allowlist gate and app-tier rate limiting) shipped with coverage in their changes; a dedicated security-property suite for the device-flow path remains open and tracked [website#85].

7. **No stealth deprecation.** If the project enters reduced-maintenance mode, a public notice appears on this roadmap and the hub README, with any known successor or fork linked. Nothing gets silently removed from the spec.

8. **No dark patterns around identity.** Publishing requires sign-in; the signed-in user is disclosed on the evidence page. Changes to this default (anonymous publishing, a different identity model) ship with explicit consent UI and clearly surfaced trade-offs.

9. **Directory hygiene.** MCP-server and dataset directory entries are reviewed before addition. Stale entries are marked stale, not silently removed. *Status disclosure:* the MCP-server directory's last full survey is dated March 2026 and is due for refresh; that refresh is scoped and tracked [civic#137].

## 4. Recently shipped

Each item is a user-visible outcome, not a feature name.

### Shipped in 2026-Q3 so far

- **The producer core became published packages.** `@typedstandards/produce-core` (format layer, I/O-free) and `@typedstandards/civic-typed-harness` (civic domain layer) joined `@typedstandards/verify-core` on npm. Golden byte-compatibility fixtures and an offline produce→verify round-trip prove that a third party can produce verifiable packages without this project's infrastructure. Decision records: ADR-0021, ADR-0022.
- **The reference app now consumes its own published packages.** civicaitools.org's evidence code was re-pointed onto the published cores, and instance identity — signing keys, publisher metadata — became configuration rather than code, with per-instance keys and an explicitly unsigned development tier (ADR-0020).
- **Portability seams and a container path.** Model endpoint, database driver, sign-in provider, object storage, and the notebook executor are swappable drivers behind documented seams (ADR-0023); the app ships a standalone container image and compose stack; the marketing and app surfaces split into separate route groups.
- **A visibility-vocabulary migration, done the way the commitments require.** ADR-0016's `committed`→`sealed`, `published`→`public` rename landed via an accept-both phase before the flip, with legacy aliases still served and the specification reconciled at v0.1.4. (See the commitment-3 disclosure in Section 3.)
- **CI and dependency budgets across all four repos.** PR-gating workflows, credential-free by design, plus enforced per-package dependency budgets. [civic#122]
- **A self-hosted deploy guide, tested cold.** From `git clone` to a running instance: compose bring-up, the driver decisions, a tiered environment reference, sign-in, host topology, database and migrations, instance signing, and an object-storage rehearsal exercised against a real hosted S3 bucket. Cold-reader passes fixed the guide's own wrong statements before an external deployment relied on it.
- **The app front door, v0.1 and v0.2 round 1.** The gated app surface serves signed-in queries at `/ask` on its own host, with host-topology modes (split-host, app-only), a sign-in gate, and app-tier rate limits — followed by an answer-first `/ask`, generalized sign-in affordances, and a topology-aware origin gate. [website#191, website#229]
- **Instance theming seam.** Brand name and accent presentation are instance configuration, so another operator's instance does not ship the reference deployment's identity. [website#217]
- **Currency and housekeeping.** A four-repo light housekeeping pass (status labels, directory indexes) and pre-deployment dependency bumps clearing a security-audit backlog. [website#216]

### Earlier milestones

- **v0.8.0, 2026-04-23** — Three civic data systems (NYC Open Data, Google Data Commons, Boston OpenContext) behind one interface with per-source attribution; external tools can publish to the registry over a documented API with OAuth device-flow auth; signing keys rotate without breaking prior packages' verifiability.
- **v0.7.0, 2026-04-17** — A single query can now combine NYC Open Data with Google Data Commons and cite each figure back to its source; a Claude Code skill ships for publishing frontier-model analyses to the registry.
- **v0.6.0, 2026-04-13** — Any analysis produced through the site can be published as a tamper-evident, timestamped, externally verifiable evidence package.

## 5. Now / Next / Later

**Axis.** *Now* is committed and active in the current cycle. *Next* is committed and scoped to the following two or three cycles. *Later* is identified and scoped in concept but not committed to a horizon. Each item is outcome-framed and tagged to the vision pillars it serves and the audiences it addresses. Linked GitHub issues are the authoritative scope; bullet text is the public summary.

### Now

- **Fix a disclosure-integrity defect in the publish skill.** The skill's publish script defaults the `model` field to a hardcoded value, so a signed record can carry a model claim nobody supplied. A default that asserts a fact inside a signed record is a defect even while the fact happens to be true. [civic#129] — *Disclosure not validation* — *all audiences.*

- **Land the roadmap-system change this document reflects.** A live roadmap plus quarterly archived snapshots, the two-tier change process, and the ADR-0001 amendment. [civic#140] — *Openly governed* — *all audiences.*

- **Finish front door v0.2.** Round 1 shipped 2026-08-10 (answer-first `/ask`, generalized sign-in affordances, a topology-aware origin gate) [website#229]. Live now: its follow-ons [website#235, website#236, website#239] and the remainder of the v0.2 scope under its two co-equal bars — visitor experience and app-only deployability [website#215]. — *Accessible to non-programmers; Instance-first and self-hostable* — *end users, journalists, students.*

- **Turn CI from advisory into a server-enforced gate.** The repo-by-repo status-checks flip, lint re-promotion on the MCP server, and one-time dispositions for two pre-existing scan findings. [civic#133] — *Sustainable for solo maintenance* — *OSS contributors.*

- **Clear the pre-deployment currency riders.** A build-time font fetch that hard-fails restricted-egress container builds — exactly the environments the self-hosted path serves [website#225]; model-roster currency [website#232]; and cost-analysis follow-ups [website#233]. — *Instance-first and self-hostable* — *government partners, OSS contributors.*

### Next

- **MCP spec-currency.** The hosted HTTP endpoint rejects current clients on SDK protocol skew; a scoping brief decides how far to modernize transports, SDK versions, and skill wiring, and in what order. [civic#131, socrata-mcp#44] — *Portable across AI tools* — *all audiences.*

- **Dependency currency as a standing practice.** A regular upstream-release review across the four repos, so security patches land while the patch runway exists rather than after it ends. [civic#136] — *Sustainable for solo maintenance* — *government partners, OSS contributors.*

- **Documentation currency.** Conventions for keeping docs honest about their own freshness — self-declared survey dates, refresh contracts — with the MCP-server directory refresh as the first concrete instance. [civic#138, civic#137] — *Openly governed* — *all audiences.*

- **Heavy housekeeping pass.** File moves and repo-front-door reorganization across the four repos, deliberately sequenced after an external deployment settles so that moves do not invalidate the deploy guide at its moment of first real use. [civic#134] — *Sustainable for solo maintenance* — *OSS contributors.*

- **Namespace and stewardship checklist.** Defensive package-name registration, a domain decision, relocating the specification source into the typedstandards repo, and a read-only survey of what an organization migration would break before any move. [civic#135] — *Openly governed* — *OSS contributors.*

- **Brand and theming tail.** An own visual identity for the reference deployment, removing a borrowed design-system association from token names and prose, font and logo as configuration, semantic-color presets, and instance-configurable indexability. [website#218, website#220, website#221, website#222, website#223, website#224] — *Instance-first and self-hostable* — *government partners, end users.*

- **Attestation consolidation.** Fold the legacy attestation review feature into the ratified typed-attestation node system, so there is one attestation model, not two. [website#173] — *Verifiable by default* — *researchers, journalists.*

### Later

- **Evolve the evidence-identity model.** Move from platform-signed to user-signed evidence with multi-signer attestations, and surface identity-strength tiers (GitHub / ORCID / institutional) so readers can calibrate. The substrate moved underneath this item in Q3 — ADR-0020 introduced per-instance keys and the unsigned tier — so it will be re-scoped against that custody layer before work starts. [website#67, website#69, website#70, civic#38] — *Disclosure not validation; Openly governed* — *researchers, journalists, academic partners.*

- **Decide how skill guidance scales past three data sources.** A research memo comparing dynamic routing, per-tool descriptions, and meta-orchestrator MCP, with the chosen path recorded as an ADR. Untouched for two quarters and now partly sequenced behind the MCP spec-currency brief above, so it moves here until that brief lands. [civic#44, website#65, website#57, website#82] — *Portable across AI tools; Sustainable for solo maintenance* — *OSS contributors, government partners.*

- **Improve model-quality signal and shareable trace URLs.** Calibrated quality tiers for available models so users can match model to stakes, and stable shareable URLs that replay a query without re-executing. Stalled through Q3; the live adjacent surface is the model-roster currency work in Now. [website#27, website#26] — *Disclosure not validation; Accessible to non-programmers* — *all audiences.*

- **Extend civic data coverage and portal-registry hygiene.** Address known portal-registry data-quality limitations (capped counts, ArcGIS curation), accept community directory submissions via the existing issue template, and evaluate an `aggregate_data` helper on the Socrata MCP server. The directory-refresh slice moved to Next as part of documentation currency. [website#38, website#39, socrata-mcp#40] — *Grounded in open civic data* — *government partners, OSS contributors.*

- **Close the loop between publishing and skill-guidance improvement.** The capture half shipped (composed skill text is recorded on every Claude Code publish, civic#43); the recurring adversarial-attestation feedback loop remains scoped but not started, so it moves here from Now. [civic#41] — *Grounded in open civic data; Disclosure not validation* — *civic technologists, researchers.*

- **Evidence-detail tails.** The language-audit pass and the server-side-narration design memo that remained after the readability work shipped. [website#92, website#93] — *Disclosure not validation* — *journalists, researchers.*

- **Let the evidence package travel outside civicaitools.org.** The premise partly arrived by another road: published cores and self-hostable instances already let packages be produced and verified elsewhere. The interop extensions themselves (Agent Receipts, BPMN replay, visual artifacts, Croissant ML metadata) remain adopter-gated, pulled forward only as real consumers emerge. [website#59, website#60, website#68, website#74] — *Verifiable by default* — *OSS contributors, adjacent-field consumers.*

- **Lower setup friction for non-programmers further.** A container image and compose stack now exist — but for deployers. This item keeps its original audience: pre-built Codespace image and Gitpod support, driven by audience patterns not speculation. [civic#10, civic#11] — *Accessible to non-programmers* — *journalists, students, OSS contributors.*

- **Formal project framing and outreach.** Substantially advanced in Q3 by another name: affiliation and contact surfaces, the IPR posture (DCO plus a royalty-free patent statement, ADR-0017), and public talks all shipped. The remaining branding and community-pathway work stays here. [civic#21, civic#22] — *Openly governed* — *all audiences.*

- **Instance capabilities beyond the reference deployment.** Scoped access models beyond creator-only versus public, and a slimmer standalone runtime image. [website#161, website#179] — *Instance-first and self-hostable* — *government partners, OSS contributors.*

## 6. The evidence-system fork — resolved, and built

The evidence system shipped in v0.6.0 is the most reusable piece of infrastructure this project has produced. Its primitives — canonical-JSON signing, hash-chained provenance, PROV-O graphs, RFC 3161 timestamps, Sigstore Rekor publishing — are not civic-specific. Earlier versions of this roadmap published that reusability as an open fork between two reachable futures: **Path A**, keep the evidence system civic-branded and grow it through civic extensions; and **Path B**, extract the reusable core under a neutral name so adjacent disciplines can run their own compatible registries, with civic-ai-tools as one *instance* of a more general protocol. The fork was published here unresolved, as a governance-in-the-open move, with a commitment to resolve by the end of 2026 against three observational criteria.

**The fork resolved toward Path B (domain-neutral), and in Q3 the project built it.** The resolution and its full reasoning are recorded in ADR-0014 (`docs/adr/0014-evidence-system-fork-resolution-path-b.md`); the previous revision of this roadmap records how the three criteria came in. What that revision could only promise, this one can point at:

- **The extraction shipped.** The last revision described wholesale extraction of the packaging/signing library as "deferred and adopter-gated." It is now on npm: `@typedstandards/produce-core` carries the format-layer producer (I/O-free, publisher-agnostic), `@typedstandards/civic-typed-harness` carries the civic domain layer, and `@typedstandards/verify-core` continues as the shared verifier. The format/domain boundary is a recorded decision (ADR-0021, ADR-0022), and golden byte-compatibility fixtures prove an independent producer can emit packages byte-identical to the reference implementation's.
- **The reference implementation eats its own protocol.** civicaitools.org's application code consumes the published packages rather than a private library — the same dependency any third-party instance would take.
- **Instances are deployable, not hypothetical.** ADR-0019 committed the app to an open-source, instance-first posture (as refined by ADR-0020); the portability seams, container path, and self-hosted deploy guide realized it; and an external deployment is standing up on that guide.

**What remains adopter-gated, honestly.** Registry federation — a protocol for consuming packages from registries other than civicaitools.org — is still unbuilt, and still waits on a real adopter who needs it. civicaitools.org remains the only registry this project operates; the difference from a quarter ago is that running a compatible instance is now a documented, supported path rather than a theoretical one. The Section 3 sustainability posture governs unchanged: capacity strain from any adopter relationship gets disclosed, not silently absorbed.

**Open follow-on — naming.** One naming thread stays deliberately open: whether the user- and resource-facing "evidence" framing (the `publish-evidence` skill, the `/api/evidence` surface, the "evidence page") should migrate toward the more precise typed-node vocabulary ("analysis," "record," "node"), since the default published node is a `content/analysis/v1` rather than the reserved `content/evidence/v1` type. That is tracked as open question **Q50** in `docs/architecture/open-questions.md`, held open under the project's discipline of not promoting a change without an adopter or decision that forces it. (The ADR-0016 migration that did land in Q3 changed *visibility* vocabulary, not this framing.) It is referenced here, not resolved here.

**Later items, after the build-out.** The shared skill registry (website#57) and the meta-orchestrator direction (civic#44) are framed against the neutral protocol and remain gated on the skill-routing decision in Section 5 Later. Croissant interop (website#68) serves the protocol regardless of which host emits a package; composite bundles shipped (website#72, closed). The evidence-identity item (website#67) proceeds as scoped, re-read against ADR-0020. Long-form analysis of the original fork lives at `docs/evidence-protocol-fork.md`.

## 7. Out of scope

Scope-request categories the project explicitly does not take on. Each has a short rationale so contributors and potential partners can redirect early.

- **Proprietary data sources or login-walled commercial APIs.** Scope is open civic data. Integrations requiring paid access, enterprise credentials, or non-open licenses are out unless the provider adds a public-access tier.

- **General-purpose AI chat.** The site demonstrates AI against civic data; it is not a general assistant. Out-of-domain queries return "not this tool's job," not training-data responses.

- **Platform-issued correctness claims.** The registry publishes *disclosures*, not *validations*. Expert attestations, when present, are separately signed objects produced by identifiable attesters.

- **Enterprise SLAs or managed hosting.** The reference deployment runs on a managed hosting platform; the application also ships a documented self-hosted path (container image, compose stack, deploy guide) as one topology among several. All four repos are open source; organizations wanting higher SLAs or different topologies can run their own instances — a supported path — but this project does not operate hosting or offer SLAs for third parties.

- **Editorial moderation of published analyses at scale.** Withdrawal and reinstatement are signed, public actions available to authors. The registry does not editorially moderate beyond obvious-abuse response. Hosting an evidence package does not endorse its claims.

- **Platform-issued identity or platform-conferred credibility.** Identity tiers in the UI describe binding strength (ORCID is more durable than GitHub); they do not reflect platform judgment.

- **Legal advisory on data-use terms or open-records compliance.** The project does not attest to users' compliance with provider terms, open-records laws, or jurisdictional requirements. Users are responsible for their own use of public data.

- **Model training or fine-tuning.** The project uses off-the-shelf foundation models via OpenRouter (and, under evaluation, direct provider APIs). It does not train, fine-tune, or host model artifacts.

- **Translation or internationalization.** The interface and documentation are English-only, as a scope decision rather than a backlog item. Translations would be welcome if community capacity emerged; the maintainer does not commit to maintaining translated surfaces.

- **Adjudicative use of AI-generated outputs.** The project's evidence system discloses provenance; it does not certify that outputs are suitable for eligibility determinations, enforcement actions, benefits adjudication, policing or immigration workflows, health or safety emergency response, or any decision where a civic-data answer drives an individual's legal, material, or safety outcome. Users electing to rely on outputs in these contexts do so outside the project's scope, and the registry does not endorse such use.

- **Uniform-quality coverage across every reachable data portal.** The system can connect to Socrata portals broadly and queries Data Commons and Boston OpenContext through their documented APIs. Higher-confidence skill guidance, tested query patterns, and known-limitation notes exist for a smaller, actively-maintained subset. The project does not claim every reachable portal is equally well-supported.

- **Data literacy curriculum development.** Training civic technologists, journalists, students, and public servants to use AI-assisted civic-data analysis responsibly is an adjacent discipline to this project's build scope. The project welcomes partnerships with training organizations, classroom deployments, and directed funding for curriculum work; the maintainer does not commit to producing or maintaining curricula directly. Contributions of tutorials, worked examples, and course materials are welcome through the issue process.

## 8. Governance

**The live document and its snapshots.** This file is the live roadmap. It is updated as work ships, carries a "Last updated" date, and carries no version number. At each quarter's end a frozen snapshot is cut into `docs/roadmap/archive/vYYYY.QN.md`; the first snapshot under this system will be **v2026.Q3**, at quarter close. The superseded quarterly-versioned document (v2026.Q2.1, the last of the old scheme) is preserved byte-identically in the same archive. Snapshots make roadmap drift inspectable: what was promised, what shipped, what slipped. This system was adopted 2026-08-10 [civic#140]; the governance record is ADR-0001 and its amendment.

**Change process.** Two tiers. Live-document edits — recording shipped work, moving items between horizons, factual corrections — flow through ordinary pull requests (all changes are PR-gated by branch protection). Snapshot cuts and **any change to a Section 3 commitment** keep the full ceremony: a roadmap-change issue (template at `.github/ISSUE_TEMPLATE/roadmap-change.md`) and, where appropriate, an ADR in `docs/adr/`.

**Where things live.**

- **This roadmap** — themes, horizons, trust commitments, out-of-scope lines. Frozen snapshots: `docs/roadmap/archive/`.
- **GitHub Issues** — concrete scope, discussion, acceptance criteria. The authoritative backlog.
- **`docs/adr/`** — architectural decisions, including roadmap governance (ADR-0001, as amended), the evidence-system fork resolution (ADR-0014), and the extraction that built it (ADR-0021, ADR-0022).
- **`docs/research/landscape-analysis.md`** — ecosystem survey of adjacent civic-AI, evidence, and gov-tech projects, and where this project sits among them.
- **Per-release tags and their annotated messages** — the diff between one milestone state and the next, per repo (see commitment 2 for how tagging works now).

**Audience routing.** The `/roadmap` page on civicaitools.org mirrors this document and adds a short audience-routing strip linking each audience — government partners, academic and policy partners, OSS contributors, journalists, funders, end users — to the adjunct best matched to them: `docs/trust-and-evidence.md`, `docs/research-agenda.md`, `docs/sustainability.md`, or `docs/evidence-protocol-fork.md`.

**Feedback.** The fastest path to push back on this roadmap is an issue using the roadmap-change template. The project does not run a community chat at this stage; community capacity is a Later item, not a present commitment.

---

*civic-ai-tools is a personal project maintained by a single person. It is not affiliated with, endorsed by, or representative of any employer or organization.*
