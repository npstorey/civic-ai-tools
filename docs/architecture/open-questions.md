---
Status: Living document
Last updated: 2026-05-05
Maintainer: [TK: leave as placeholder]
---

# Open questions registry

This is the canonical home for unresolved decisions affecting the project's architecture and standards. Questions land here first; some get worked on directly, some get promoted to GitHub issues, some get deferred. The registry is the durable record — issues come and go, this list persists until the underlying question is resolved.

The registry exists to keep the architecture documents (`end-state-vision.md`, `open-evidence-standard.md`, `civic-claim-vocabulary-draft-spec.md`, the ADRs) honest. When a spec section asserts behavior that depends on an unresolved question, that section gets a callout pointing here, and the question carries the spec section's stake forward.

## Schema for entries

Each entry uses the following fields:

- **Title.** Short descriptive name.
- **Status.** One of: Open / In discussion / Promoted to issue #N / Resolved (link to ADR or spec section) / Deferred.
- **Origin.** What conversation, document, or event surfaced this question.
- **Stakes.** What spec sections, ADRs, or dependencies are affected by the resolution.
- **Current direction.** Where the project is leaning, if anywhere. Marked as direction, not commitment.
- **Resolution criteria.** Concrete conditions that would close the question. Connected to the Xanadu doctrine: a real adopter need is a valid criterion; "it would be cleaner if..." is not.
- **Notes.** Working discussion, links to related work, or pointers to where the back-and-forth lives.

**Promotion to GitHub issue.** Not every open question becomes an issue. A question is promoted when (a) the path to resolution is clear enough to scope work against, (b) the resolution is needed for downstream work to proceed, or (c) the project has explicitly decided to invest the time. Questions failing those criteria stay here. This is consistent with the [Xanadu doctrine](xanadu-doctrine.md): don't promote items to executable work without the work being needed.

---

## Active questions

### Q1 — Package format

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #1 (the doc's most consequential current decision per its own framing).
- **Stakes.** §1 L3 of the standards stack; §2 packaging flow; §3 verification flow; §6 transport choice (network signals); the Open Evidence Standard's §4 (evidence-package structure), §5 (canonical JSON), §13 (verification surface). Most consequentially: §13 verifiability today depends on `civicaitools.org` because the signature, RFC 3161 token, and Rekor proof are DB-resident, not embedded in the package. End-state offline verification requires resolving this.
- **Current direction.** Multi-file directory with an RO-Crate / WRROC compatibility profile. The single-blob form would become one artifact in a larger package; signature, timestamp, and Rekor proof would move into sibling artifacts inside the package.
- **Resolution criteria.** A real adopter that needs offline verifiability without a `civicaitools.org` dependency. Possibilities: an academic partner archiving packages independently, an external publisher (Boston OpenContext, datHere, or similar) running their own registry against the same standard, a regulatory or audit context that disallows trust in the publishing platform.
- **Notes.** Drives Open Question #15 (external verification testing). Also gates the §11 typed-claims layer's `claims.jsonld` companion and the §12 upstream-evidence layer — both presuppose a multi-file form.

### Q2 — Federation substrate

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #2.
- **Stakes.** §1 L7 (network signals & coordination); §6 network signals; the Open Evidence Standard §14 (federation and discoverability). Also affects §4.5 BlobRef substitution: a federation substrate determines whether non-Vercel content-addressable storage (e.g. IPFS) is a first-class option.
- **Current direction.** No commitment. Three candidate substrates named: atproto firehose / labelers, KOI net (RIDs + sensor nodes), nanopub network. Each is independent of the package format (Q1) and the cryptographic envelope.
- **Resolution criteria.** Either (a) at least one external adopter wants to consume packages from a registry not under `civicaitools.org` (forces selecting some federation pattern), or (b) the project's spin-out direction (Path B in `evidence-protocol-fork.md`) advances enough that one substrate's properties become load-bearing for an extracted library.
- **Notes.** Independent of Q1 (package format) and Q8 (Croissant outbound). All three could resolve in any order; they touch different parts of the stack.

### Q3 — First non-GitHub identity provider

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #3.
- **Stakes.** §1 L6 federated publishing & identity; §4 identity ladder (the graded-binding model); the Open Evidence Standard §8 (identity binding); the Open Evidence Standard §13 (verifier checks for binding strength).
- **Current direction.** No commitment. Three candidates: ORCID (academic identity), sigstore OIDC keyless (general open-source-style identity), `did:web` (institutional / DNS-bound identity). The graded ladder (pseudonymous → GitHub → ORCID → DNS-bound `did:web` → notarized) is informative; only GitHub is implemented.
- **Resolution criteria.** A real publisher type emerges that GitHub OAuth doesn't fit — most likely an academic publishing pattern (drives ORCID), an institutional publishing pattern (drives `did:web`), or an open-source-community publishing pattern (drives sigstore OIDC).
- **Notes.** Schema implication: the current `github_id` / `display_name` / `github_profile_url` columns will need genericization to `creator_auth_provider` / `creator_auth_provider_id` / similar. That refactor is itself a sub-question gated on the choice.

### Q4 — Trace capture

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #4.
- **Stakes.** §1 L2 trace-capture layer; §2 trace capture leg of the publish flow; the Open Evidence Standard §7 (trace capture). Also touches the §11 typed-claims `caco:AnalyticalDerivation` requirement (typed claims need a trace step they can point at).
- **Current direction.** Hand-rolled OTel-shaped JSON today. Two named alternatives: (a) adopt a real OpenTelemetry SDK with the GenAI and MCP semantic conventions, or (b) layer Agent Receipts (W3C VC over MCP tool calls) over or under the OTel layer. See `civic-ai-tools-website/docs/proposed-issues/002-extend-agent-receipts-response-capture.md` for the upstream-contribution path on Agent Receipts.
- **Resolution criteria.** Per `civic-ai-tools/docs/research/agent-receipts-evaluation.md`: an external adopter (Boston OpenContext, datHere, an academic partner) explicitly asks for Agent Receipts integration, OR Agent Receipts ships response-content capture upstream and the project's adoption story improves enough to justify the switch, OR a real OTel SDK becomes lower-friction than the current hand-rolled approach.
- **Notes.** Issue 002 in `civic-ai-tools-website/docs/proposed-issues/` is the upstream-contribution path; the local trace-layer adoption decision is downstream of the contribution shipping.

### Q5 — `claims.jsonld` and `upstream-evidence.json` implementation timing

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #5.
- **Stakes.** §1 L3 semantic packaging; §5 claims vocabulary family; §6 network signals (cross-package corroboration depends on these); the Open Evidence Standard §11 (typed claims) and §12 (upstream evidence references); the Civic Claim Vocabulary draft spec in its entirety; the Civic Claim Vocabulary domain-extensions portfolio (`civic-ai-tools-website/docs/proposed-issues/003-civic-claim-vocabulary-domain-extensions-portfolio.md`).
- **Current direction.** Designed but not built. The Xanadu doctrine gates promotion to "built" on a real adopter package whose verification or claim queries are blocked without the layer. Q11 may reframe how typed claims integrate with the attestations infrastructure; Q12 may collapse upstream-evidence references into attestations.
- **Resolution criteria.** A real published package whose author needs structured trend or comparison claims that prose alone cannot make machine-comparable, OR an external collaborator with a published civic-data infrastructure project committing to consume typed claims as part of a named integration, OR a `guidance-quality` issue surfacing a real failure mode that typed claims would resolve. See `xanadu-doctrine.md` worked example.
- **Notes.** Resolution of Q11 / Q12 may reduce the scope of Q5 (if upstream-evidence becomes an attestation pattern rather than a separate file).

### Q6 — captureMethod enforcement

- **Status.** Resolved 2026-04-29. See [ADR-0003](../adr/0003-evidence-capture-method.md).
- **Origin.** Vision-doc §Open questions item #6.
- **Resolution.** The `captureMethod` field is required at the publish route, covered by the canonical-JSON package hash and the platform Ed25519ph signature, persisted to the database column, surfaced on the detail page near verification status, and labeled `Unknown (pre-ADR-0003)` for legacy packages. ADR-0003 is genuinely Accepted as of 2026-04-29 (it had been downgraded to Proposed during a brief enforcement gap).
- **Notes.** Retained in the registry as a Resolved entry for the historical record so the numbering stays stable across the migration from `end-state-vision.md`.

### Q7 — Producer-type scope

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #7.
- **Stakes.** Spec preamble; the Open Evidence Standard §1.3 (producer-type scope) + §4.7 (`cost` object framing); the Civic Claim Vocabulary draft spec's §1 framing (typed claims today presuppose AI translation via `ccv:AnalyticalDerivation`); the first-extension portfolio (the candidate domains all currently presuppose AI publication); competitive landscape and academic adoption story; Q9 (AI-specific commitments inventory).
- **Current direction.** No commitment. The standard is currently AI-focused. Generalization options: (a) keep AI-focused, position adjacent to non-AI evidence patterns; (b) generalize to "evidence packages where AI is one producer type" with `producer.type` field and per-producer-type evaluation profiles; (c) split the spec into a producer-type-agnostic core + AI-specific profile.
- **Resolution criteria.** A non-AI publisher (a journalist, a researcher, a city employee) needs to publish through this standard, AND that need surfaces structurally rather than as a one-off. Or: an academic adoption conversation gates on the answer.
- **Notes.** Drives Q9 (which catalogs which fields would need rework), Q13 (naming), Q14 (geographic/temporal scope nullability).

### Q8 — Croissant outbound metadata

- **Status.** Open.
- **Origin.** Migrated from `end-state-vision.md` §Open questions item #8.
- **Stakes.** §1 L3 semantic packaging; §6 network signals (a discoverable package is more valuable to all four audiences); the Open Evidence Standard §14 (federation and discoverability). Issue 004 in `civic-ai-tools-website/docs/proposed-issues/` (`004-croissant-outbound-metadata.md`) is the implementation path.
- **Current direction.** Inbound use of Croissant (characterizing queried datasets in `data-sources.json` / PROV-O hooks) is partially built. Outbound use (publishing Croissant metadata about the evidence package itself, at a well-known location, for dataset-crawler discoverability) is undecided.
- **Resolution criteria.** Either the project decides to adopt outbound Croissant unilaterally (a low-effort discoverability play) or an adopter with their own evidence-style packages adopts the pattern and the project follows. Issue 004 scopes the decision.
- **Notes.** Independent of Q1 (package format) — both single-blob and multi-file packages can expose Croissant metadata as a sibling resource.

### Q9 — AI-specific commitments and producer-type generalization

- **Status.** Open.
- **Origin.** Surfaced 2026-05-01 during the cleanup pass on the Open Evidence Standard draft. Several spec fields presuppose AI publication and would need rework if Q7 resolves toward generalization.
- **Stakes.** Tightly coupled to Q7. Specific spec sections / fields where AI-specificity bites today: `cost` object schema (token-billed-LLM-shaped); `captureMethod` vocabulary (Claude Code surfaces); `skillMetadata` (presupposes a system-prompt + MCP-server + skill-text concept); the `caco:AnalyticalDerivation` requirement (presupposes an LLM-prose-to-structured-claim translation step); some BlobRef field choices.
- **Current direction.** Inventory only — no commitment to generalize. The standard is honest about being AI-focused via the §1.3 callout in the OES.
- **Resolution criteria.** Q7 resolves first. If Q7 resolves toward generalization, this question's resolution is the inventory-and-rework plan. If Q7 resolves toward staying AI-focused, this question collapses to "no action — current AI-specific shape is the spec's intent."
- **Notes.** This question exists to keep the inventory durable. As more AI-specific commitments accumulate, they should be added here so the generalization conversation has a concrete target if Q7 ever fires.

### Q10 — Civic Claim Vocabulary as a full ontology

- **Status.** Promoted to issue 005 (`005-promote-civic-claim-vocabulary-to-ontology.md`). Decision: yes, do this; scoping work in flight.
- **Origin.** Surfaced 2026-05-01. The current Civic Claim Vocabulary draft is intentionally framed as a controlled vocabulary of typed claim shapes expressed in JSON-LD, lighter-weight than a full OWL ontology with rich axioms. The project intends to promote it to a full ontology.
- **Stakes.** The Civic Claim Vocabulary draft spec's framing throughout; the OWL and RDF glossary entries in `end-state-vision.md`; the §5 claims vocabulary family in `end-state-vision.md` (would change name); the Civic Claim Vocabulary domain-extensions portfolio (a full ontology has more rigorous extension semantics than a controlled vocabulary); reasoner compatibility, alignment with PROV-O / SDMX / Data Cube / Schema.org. Touches the Open Evidence Standard §11 (typed claims) by changing what "conforms to the Civic Claim Vocabulary" means.
- **Current direction.** Promote. Phasing and scope are TBD via issue 005.
- **Resolution criteria.** Issue 005 ships an ADR and a v0.2 (or beyond) of the spec that uses OWL axioms, reasoner-compatible class definitions, and explicit alignment with adjacent ontologies.
- **Notes.** This is partially a position-taking decision (the project wants to be a serious participant in the semantic-web / linked-data community) and partially a technical decision (full OWL semantics enable richer downstream tooling).

### Q11 — Typed claims as a kind of attestation

- **Status.** Promoted to issue 006 (`006-typed-claims-as-attestation-reframe.md`). Decision: yes, do this.
- **Origin.** Surfaced 2026-05-01. The current architecture treats typed claims (`claims.jsonld`) and attestations (`consistency`, `evaluation`, `expert_attestation`) as separate concepts. Insight: a typed claim may be a kind of attestation — specifically, a semantic translation of an evidence package, signed at publish time, with metadata about the translation method (which LLM did the translation, what prompt, what source span).
- **Stakes.** The Open Evidence Standard §11 (typed claims) and §15 (attestations) might collapse or restructure. The Civic Claim Vocabulary draft spec's `caco:AnalyticalDerivation` requirement becomes structurally an attestation pattern. Impacts how typed claims are signed, stored, retrieved, and rendered.
- **Current direction.** Reframe typed claims as a kind of attestation. Specifics in issue 006.
- **Resolution criteria.** Issue 006 produces an ADR and either (a) a revised Open Evidence Standard §11 + §15 that reflects the unified frame, or (b) explicit articulation of why the unified frame doesn't work and the two should remain separate.
- **Notes.** Possibly subsumes Q12 (which would also fold into the attestations infrastructure).

### Q12 — Attestations as the implementation path for upstream-evidence references

- **Status.** Promoted to issue 007 (`007-attestation-as-upstream-evidence.md`). May be folded into Q11's issue 006 depending on how the work scopes.
- **Origin.** Surfaced 2026-05-01. Current architecture has separate sections for attestations and `upstream-evidence.json`. Insight: the existing attestations infrastructure may already be a partial implementation of upstream-evidence references — they may be the same thing, with `upstream-evidence` being one kind of attestation that says "this package is in a relationship of type R with package X."
- **Stakes.** The Open Evidence Standard §12 (upstream evidence references) might collapse into §15 (attestations). The upstream-evidence relationship vocabulary (`derived_from`, `compares_to`, `extends`, `replicates`, `contradicts`, `evaluates`) might become attestation kinds rather than a separate file format. Impacts citation graphs, cross-package corroboration, meta-analysis.
- **Current direction.** Reframe upstream-evidence references as a kind of attestation. Specifics in issue 007 (or in 006 if folded).
- **Resolution criteria.** Issue 007 (or 006) produces an ADR and either (a) a revised Open Evidence Standard §12 + §15 that uses attestations as the implementation, or (b) explicit articulation of why a separate file format remains necessary.
- **Notes.** Closely related to Q11. The two questions may merge during scoping; the registry will be updated accordingly.

### Q13 — Civic vs. evidence-packager naming and scope

- **Status.** Open. No issue yet; needs more thinking before promotion.
- **Origin.** Surfaced 2026-05-01. As the spec generalizes (broader producer types per Q7, broader fields than civic-data, broader adoption beyond the project's origin community), the "civic" branding cuts against the spec's actual scope. But "civic" is the project's origin community, funder relationship, and strategic positioning.
- **Stakes.** The names of all the artifacts: Open Evidence Standard (less civic-coded, less of an issue), Civic Claim Vocabulary (currently civic-coded), `civic` JSON-LD prefix in PROV-O graphs, repository names, organization names, the project's overall identity. Touches `evidence-protocol-fork.md` Path A vs. Path B framing — Path B (domain-neutral spin-out) makes this question load-bearing.
- **Current direction.** No direction. The trade-off is real and unresolved.
- **Resolution criteria.** Genuinely unclear. Plausible triggers: (a) the Path A vs. Path B fork resolves and the chosen path forces the naming question; (b) a non-civic adopter wants to use the spec and the "civic" name becomes a friction point in the conversation; (c) a funder relationship requires the project to be either more or less civic-branded.
- **Notes.** This is a strategic / identity question more than a technical one. Probably stays here for a while.

### Q14 — Geographic and temporal scope nullability

- **Status.** Open.
- **Origin.** Surfaced 2026-05-01. The current Civic Claim Vocabulary draft (`civic-claim-vocabulary-draft-spec.md` §4.3, §8.1) requires geographic and temporal scope on every claim. If the spec generalizes beyond civic-data via Q7, scope-required claims may not fit non-civic patterns (a claim about national-level fiscal policy at a single point in time may have implicit-or-trivial scope; a claim about a global health phenomenon may have no clean geographic scope at all).
- **Stakes.** The Civic Claim Vocabulary draft spec's required-properties table (§4.3); the §8.1 anti-patterns prohibition on implicit scope; downstream extension authoring patterns.
- **Current direction.** Required at v0.1. Open whether v1.0 keeps the requirement or moves to "scope present unless explicitly waived with a documented reason."
- **Resolution criteria.** Tied to Q7 — if Q7 resolves toward generalization, Q14 follows. If Q7 resolves toward staying civic-focused, Q14 may resolve to "stay required, document why."
- **Notes.** Listed separately from Q9 because it's a vocabulary-spec concern rather than a producer-type-spec concern; same upstream dependency though. **Specific instance:** the CCV draft's `ccv:PolicePrecinct` subtype namespace name is NYC-coded (other jurisdictions use "district," "division," "ward"); renaming it generally — and similar surface-level civic-isms throughout the geographic-scope taxonomy — requires resolving the civic-vs-general scope question that this entry tracks.

### Q15 — External verification testing

- **Status.** Open. Will be promoted to an issue once Q1 (package format) has resolved enough to know what verification of a conformant package actually entails.
- **Origin.** Surfaced 2026-05-01 during the verifiability claim audit. The Open Evidence Standard §13 currently asserts properties about offline verifiability that depend on package-format end-state. None of those properties have been validated by an external party performing actual verification with no access to `civicaitools.org` server endpoints.
- **Stakes.** The Open Evidence Standard §13 (verification properties) entire section. The credibility of the standard's verifiability claims. Consequence for adopters: if the standard claims "verifiable using only public infrastructure" and no one has actually demonstrated that, the claim is aspirational.
- **Current direction.** Defer until Q1 resolves enough to know what verification of a conformant package looks like (today, verification requires `civicaitools.org`; end-state, verification requires only public infrastructure). The test should be performed at the end-state, not the current state.
- **Resolution criteria.** Q1 resolves to a multi-file format that embeds the proofs in the package, AND an external party (academic partner, security researcher, an adjacent civic-tech project) performs full verification with no access to civicaitools.org server endpoints AND the verification succeeds.
- **Notes.** Until this test is performed and passes, the offline-verifiability claim is a target, not a property. The §13.3 target end-state subsection in the Open Evidence Standard is honest about this.

### Q16 — Formal conformance criteria

- **Status.** Open.
- **Origin.** Open Evidence Standard §16 (current internal working draft).
- **Stakes.** §16 of the Open Evidence Standard; future adopter onboarding; whether the spec can ever leave v0.x without this resolution.
- **Current direction.** Conformance is currently described operationally (a conformant package is one that satisfies §4 and verifies under §6 / §13; a conformant publisher is one that validates the publish-route required-field set and signs with a registry-listed key; a conformant verifier is one that performs the §13.1 checks). Formal criteria, a reference test corpus, and a conformance-claims registration mechanism are deferred until external implementations surface what's needed.
- **Resolution criteria.** At least one external implementation attempt that surfaces what formal conformance would need to specify; alternatively, a formal conformance test suite drafted as part of moving toward v1.0.
- **Notes.** Connected to Q15 (verification testing outside `civicaitools.org`); a serious external verification attempt would likely produce the requirements list for formal conformance. Likely also connected to Q1 (package format) — a multi-file end-state package may need a different conformance shape than a single-blob package.

### Q17 — BPMN conversion of process-flow diagrams

- **Status.** Open.
- **Origin.** `end-state-vision.md` §8 — identified as feasible for the publish flow (§2), the verification flow (§3), and the BYOK evaluation flow (§7); not yet executed.
- **Stakes.** Audiences that prefer process-modeling rigor (MetaGov interop work, deliberative tool integration, formal architecture review). Limited stakes today; the project already has BPMN tooling in use for response visualization (`civic-ai-tools-website` Explore page), so the conversion is operationally tractable when needed.
- **Current direction.** Defer until an audience explicitly asks for BPMN versions. Static diagrams (the §1 standards stack, the §4 identity ladder, the §5 claims taxonomy, the §6 network 2×2) do not convert cleanly and stay in Mermaid regardless.
- **Resolution criteria.** A named audience or use case that requires BPMN process notation specifically. Not driven by spec evolution; driven by audience need.
- **Notes.** §8 of the vision doc names the candidate diagrams and the pools/lanes for each (e.g., the publish flow's pools: User, Skill, MCP server, Trace, Packager, Signer, Timestamp/Rekor, Store, Zenodo). Conversion is a mechanical translation when the time comes.

### Q18 — Standards adoption review: Blake3, Data Package Standard, DCAT-US3, CODATA semantic markdown

- **Status.** Promoted to GitHub issue [npstorey/civic-ai-tools#67](https://github.com/npstorey/civic-ai-tools/issues/67). Each candidate evaluated independently within that issue; resolution lands as a per-candidate ADR or documented not-adopting decision.
- **Origin.** Surfaced 2026-05-01 in a collaboration session with datHere on the Open Evidence Standard. Captured as a candidate-set for systematic evaluation against the existing architecture stack, rather than handled ad-hoc, so each candidate either lands as an ADR adopting it (with rationale) or as a documented decision-not-to-adopt (with reason).
- **Stakes (per candidate).**
  - **Blake3.** The Open Evidence Standard §6.1 (signature / package hash). CKAN already uses Blake3 for tamper-evident metadata; potential supplement or replacement for SHA-256 in the package-hash construction.
  - **Data Package Standard (Open Knowledge Foundation).** `end-state-vision.md` §1 L3 (semantic packaging) and the Open Evidence Standard §4 (evidence-package structure). Direct alternative or complement to RO-Crate; supports custom dialects (e.g., an "evidence" dialect). Interacts with Q1 (package format) — Q1's current direction (multi-file directory with an RO-Crate / WRROC compatibility profile) would be reopened if Data Package adoption were committed.
  - **DCAT-US3.** `end-state-vision.md` §1 L3 and the data-source description layer. Federal data catalog standard; relevant to cross-portal interop and dataset metadata.
  - **CODATA semantic markdown.** `end-state-vision.md` §1 L3 and the human-readable metadata layer. Alternative or complement to JSON-LD for the data-coordinator persona that surfaced in the working session as a target audience.
- **Current direction.** No commitment. Each candidate evaluated independently on (a) what problem it solves in the current architecture, (b) whether that problem is already addressed by something already in the stack, (c) cost of adoption (implementation, dependency surface, governance overhead, breaking-change risk), (d) cost of not adopting (interop friction, missed network effect, friction with the datHere ecosystem and downstream WPRDC adoption per the [landscape analysis](../research/landscape-analysis.md)).
- **Resolution criteria.** Each candidate resolves independently. For each, either an ADR adopting the standard (with rationale) or a documented not-adopting decision (with reason). Resolution requires real adopter need per the [Xanadu doctrine](xanadu-doctrine.md) — datHere, WPRDC, or another named adopter blocked or materially friction'd without the change. "It would be cleaner if" is not sufficient.
- **Notes.** Coordination with datHere on this candidate set is ongoing. The Data Package Standard candidate is the most consequential structurally because it interacts with Q1 (and reopens that direction if adopted); the other three can be evaluated more independently. Each candidate should land as a separate ADR or registry-resolution entry rather than being bundled, so adoption rationale (or non-adoption reason) is durable per-standard.

### Q19 — OpenContext as unified upstream MCP framework for portal access

- **Status.** Open.
- **Origin.** Surfaced 2026-05-09 from landscape observation. OpenContext (`github.com/CityOfBoston/OpenContext`, production at `data-mcp.boston.gov/mcp`) is a generalized civic-data MCP-server framework already consumed by the website as one of its three MCP sources alongside `socrata-mcp.civicaitools.org` and Data Commons. Question: rather than keeping a separately-maintained per-portal Socrata MCP server, consume OpenContext as the unified upstream framework for portal access across portal types (Socrata, CKAN, ArcGIS Hub). Existing landscape memory: see `project_opencontext_landscape.md`.
- **Stakes.**
  - `end-state-vision.md` §1 L1 (tool execution layer) — OpenContext could become the canonical adapter the project uses for civic-data portal access, replacing or supplementing `socrata-mcp-server` as a separately-maintained tool.
  - Maintenance surface of `socrata-mcp-server` itself. A unified upstream framework collapses N per-portal connectors into one consumed dependency. The trade is reduced maintenance vs. dependency on an upstream not under project control.
  - Multi-portal coverage path (additional cities, ArcGIS Hub coverage, additional CKAN deployments). A unified framework lowers the marginal cost of each new portal but couples coverage timelines to upstream prioritization.
  - Relationship to Q18 (standards adoption review). Q18's candidate set is about evidence-side standards (Blake3, Data Package Standard, DCAT-US3, CODATA semantic markdown); this question is on a different axis (portal-access tooling), so it should not be bundled with Q18, but the per-candidate ADR-or-documented-not-adopting evaluation discipline is a useful template.
- **Current direction.** No commitment. Evaluate against:
  - (a) What does OpenContext solve that the current per-portal approach does not? (Probable: ArcGIS Hub coverage, unified tool surface across portal types, multi-cloud deployment support — verify against the upstream repo before relying on these in an ADR.)
  - (b) Cost of adoption — migrating away from `socrata-mcp-server` as the project's own MCP layer (or restructuring it as an OpenContext deployment), upstream-dependency surface, governance footing for an external-org-led project, contribution path back upstream.
  - (c) Cost of not adopting — continued per-portal maintenance burden, divergence from a framework other portals may also adopt, ArcGIS Hub coverage remaining out of scope.
  - (d) Is partial adoption viable? E.g., adopt OpenContext for ArcGIS Hub coverage only while keeping `socrata-mcp-server` for Socrata-portal access; or the inverse.
- **Resolution criteria.** Either (a) an ADR adopting OpenContext (full or partial — e.g., for ArcGIS Hub specifically) with rationale, or (b) a documented decision-not-to-adopt with reason. Per the [Xanadu doctrine](xanadu-doctrine.md), resolution requires a real adopter or maintenance need: the maintenance argument (cost of N per-portal connectors vs. one consumed framework) is plausibly sufficient, but should be evaluated concretely against the actual maintenance load of `socrata-mcp-server` rather than abstractly.
- **Notes.** The website already consumes OpenContext for Boston-portal access (`data-mcp.boston.gov/mcp` is in the MCP source set), so the project is already a downstream user of OpenContext for one portal — the question is whether to extend that to portal access generally and retire or restructure the project's own per-portal MCP layer in the process.

---

## Resolution log

This section records resolved questions for the historical record. Migrated from `end-state-vision.md` §Open questions where applicable.

- **Q6 — captureMethod enforcement.** Resolved 2026-04-29 by [ADR-0003](../adr/0003-evidence-capture-method.md). See entry above for context.

---

## Maintenance

This document is updated when:

- A new question surfaces in the spec drafts, ADRs, or active conversations.
- A question is promoted to an issue (update Status to `Promoted to issue #N`).
- A question is resolved (move to the Resolution log + leave entry above with `Resolved` link).
- A question is deferred indefinitely (move to a Deferred section, to be added when needed).

The vision document `end-state-vision.md` no longer maintains its own §Open questions section — that section is now a short pointer paragraph; this document is canonical.
