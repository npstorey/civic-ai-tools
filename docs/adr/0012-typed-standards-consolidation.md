# ADR-0012: Consolidate OES + CCV under the Typed Standards umbrella — `ts:` namespace, `typed-publisher.json` well-known path, CC BY 4.0 spec license

- **Status:** Proposed
- **Date:** 2026-05-25
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

The G1-G4 MVP cohort ([ADR-0007](0007-content-canonicalization.md) + [ADR-0008](0008-multihash-content-hash.md) — envelope-shape; [ADR-0009](0009-unified-typed-attestation-primitive.md) — unified typed-attestation primitive; [ADR-0010](0010-visibility-lifecycle-location-attestations.md) — visibility/lifecycle/location attestations; [ADR-0011](0011-capturemethod-generalization.md) — captureMethod generalization) landed the substantive spec moves that the 2026-05-25 strategic memo (`docs/architecture-incorporation-memo-2026-05-25.md`) sequenced. With those moves complete, the project's standards documentation is structurally settled enough that the umbrella + two normative-layer-docs structure — [`typed-standards-proposal.md`](../architecture/typed-standards-proposal.md) (umbrella) + [`open-evidence-standard.md`](../architecture/open-evidence-standard.md) (OES; envelope mechanics) + [`civic-claim-vocabulary-draft-spec.md`](../architecture/civic-claim-vocabulary-draft-spec.md) (CCV; typed-claims layer) — is now harder to read than it is to maintain. The reserved renames in `typed-standards-proposal.md` §8 (well-known path, namespace prefix, document-title shift to "Typed Standards Specification") have been deferred precisely until the spec stopped restructuring. That gate has now closed; the consolidation moment has arrived.

The concrete trigger is the v0.1 RFC external-review need. A 2026-05-26 deep-research memo (workspace-local at `/temp/q39_40_memo`; not committed because it carries specifics under the workspace stakeholder/relationship-content boundary) executes [Q40](../architecture/open-questions.md#q40--pre-adoption-research-for-typedstandardsorg-rename--namespace-prefix-selection-ts-vs-tss-vs-alternatives)'s seven-item research checklist and recommends self-publication + GitHub Discussions + a public mailing list + three scheduled review calls as the appropriate v0.1 review posture. The memo's §8 enumerates eight pre-decided items the consolidation should adopt verbatim: namespace prefix `ts:`, namespace URI `https://typedstandards.org/ns/ts#`, well-known path `/.well-known/typed-publisher.json`, domain `typedstandards.org`, spec citation form, CC BY 4.0 spec license, community-review posture, and this ADR. The consolidation chat that produced this ADR confirmed the live-check first-actions the memo flagged: prefix.cc lookup for `ts:` on 2026-05-25 returned "prefix not found"; RDAP lookup for `typedstandards.org` on the same day returned HTTP 404 / `Object not found`; the IANA Well-Known URI Registry has no entry for `typed-publisher` or any path containing the substring `typed` or `publisher`. The paths are all clear.

Three adopters motivate the consolidation as cross-sector portable rather than n=1 / civic-shaped:

**datHere** (publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md); the Pittsburgh / WPRDC pilot integration partner). Their pipeline emits notebook-shaped `content/analysis/v1` packages with the `ai-assisted-analysis/datHere` Producer Profile subtype. An RFC-ready single document at a stable URL is what they need to point internal stakeholders, university partners, and downstream consumers at; the three-doc structure is reviewable but not citable.

**A second prospective collaborator in early discussions** (referenced neutrally per the workspace stakeholder boundary). Their pipelines emit product-testing-protocol-captured content under their own (future) Producer Profile; [ADR-0011](0011-capturemethod-generalization.md) generalized the captureMethod field for them. Their interest in adopting the standard depends on its positioning as a cross-sector spec, not a civic-coded one — the consolidated RFC's framing is load-bearing for their adoption decision.

**A third prospective collaborator in early discussions** (also referenced neutrally per the boundary). Their pipelines emit data-ingestion-pipeline-captured content under a different (future) Producer Profile. Same structural story.

The Xanadu gate is satisfied. The same three adopters that motivated [ADR-0009](0009-unified-typed-attestation-primitive.md) (multi-publisher identity binding + unambiguous reference semantics + stable attestation namespace) now motivate the consolidation: a single document at a stable URL with a permanent license is what they will read, cite, point others at, and judge the standard against.

This ADR closes [Q39](../architecture/open-questions.md#q39--consolidate-oes--ccv-into-typed-standards-proposalmd-as-a-single-rfc-ready-spec) (the consolidation question) and [Q40](../architecture/open-questions.md#q40--pre-adoption-research-for-typedstandardsorg-rename--namespace-prefix-selection-ts-vs-tss-vs-alternatives) (the seven-item pre-adoption research checklist). The substantive consolidated body work — absorbing OES §3-§13/§15 + CCV §1-§8 into the consolidated spec — lands in Phase 2 of the consolidation chat; the historical-snapshot status notes on OES + CCV land in Phase 3; the community-review infrastructure spins up in Phase 4. This ADR records the structural decisions that govern all four phases.

This ADR is also consistent with [Q15](../architecture/open-questions.md#q15--external-verification-testing) staying the top priority gate: the consolidation makes Q15 more reachable (external readers can pick up a single document and try to verify a sample package against it) but does not substitute for actually running the external-verification test. The test stays scoped as a follow-on milestone of v0.1 review, not a side-effect of this ADR.

This ADR does NOT supersede any prior ADR. ADRs 0003-0011 stay Accepted/Proposed with their decisions intact; this ADR consolidates the documentary surfaces those decisions live in, and renames two coordination surfaces (the well-known path and the JSON-LD/RDF prefix), without changing any normative envelope mechanic, vocabulary semantic, or verification rule.

## Decision

Consolidate the project's standards documentation under a single document titled "Typed Standards Specification"; commit the namespace prefix `ts:` with namespace URI `https://typedstandards.org/ns/ts#`; rename the trust-registry well-known path to `/.well-known/typed-publisher.json` with the legacy path served in parallel indefinitely; reframe OES + CCV as historical snapshots; promote the consolidated spec from "Internal working draft (pre-v0.1)" to "v0.1 Working Draft — open for external review (review window to be scheduled)"; license the consolidated spec under CC BY 4.0; document citation conventions in a new spec appendix; and establish the community-review infrastructure tracker.

### 1. Consolidate OES + CCV normative content into a single document

The umbrella proposal file at `civic-ai-tools/docs/architecture/typed-standards-proposal.md` is renamed to `typed-standards-specification.md`; the document's title changes from "Typed Standards — proposal" to "Typed Standards Specification". The OES sections absorbed into the consolidated spec are §3 (definitions), §4 (evidence package structure), §5 (canonical JSON + JCS), §6 (cryptographic envelope), §7 (trace capture), §8 (identity binding), §9 (captureMethod + the `datHere` content profile + the commitment-view schema), §10 (lifecycle + location attestations per [ADR-0010](0010-visibility-lifecycle-location-attestations.md)), §11 (typed claims pointer — now realized as the absorbed CCV body), §13 (verification properties), and §15 (the `attestation/*` namespace per [ADR-0009](0009-unified-typed-attestation-primitive.md)). OES §12 was already obsoleted by [ADR-0009](0009-unified-typed-attestation-primitive.md) §8 and is folded into the absorbed §15 with its companion-file framing retired. The CCV sections absorbed are §1 (purpose), §2 (design principles), §3 (package integration — reframed around `content/claim/v1` nodes per [ADR-0009](0009-unified-typed-attestation-primitive.md) §8), §4 (vocabulary), §5 (core claim types), §6 (extension mechanism), §7 (worked example), and §8 (anti-patterns and prohibitions).

The consolidated spec body is reorganized to the 15-section RFC-conventional structure named in the 2026-05-26 deep-research memo §6.1: Title block / Status / Copyright / Table of Contents / Introduction / Conventions and Terminology / Architecture / Normative specification / Conformance / Security Considerations / Privacy Considerations / IANA Considerations / Internationalization Considerations / References / Appendices. The 15-section template's pre-existing content from `typed-standards-proposal.md` §§1-11 maps into Introduction + Conventions + Architecture; the absorbed OES content fills the Normative specification + Conformance + Security + Privacy + IANA sections; the absorbed CCV content fills the typed-claims sub-section of the Normative specification plus a worked-example appendix.

**Spec body changes beyond the consolidation moves are explicitly out of scope.** The consolidation is a reorganization + rename, not a spec evolution. No new normative requirements are added; existing normative content is preserved with only the wording adjustments needed to integrate the absorbed sections into the consolidated narrative.

ADRs 0004 through 0011 carry References-section entries citing `typed-standards-proposal.md`; those entries are mechanically updated to cite `typed-standards-specification.md` in the same commit that lands the body expansion + file rename. Workspace + per-repo CLAUDE.md files and the `typed-standards-summary.md` pointers update at the same time.

### 2. `ts:` namespace prefix + `https://typedstandards.org/ns/ts#` namespace URI; explicit removal of `tss:` from candidates

The consolidated spec's JSON-LD / RDF prefix is `ts:`, resolved to `https://typedstandards.org/ns/ts#`. This is the **single normative prefix** for the consolidated spec's vocabulary. It replaces the `ccv:` prefix in the absorbed CCV draft (which bound to `https://civicaitools.org/ns/civic-claim-vocabulary/v1#`) and the informational `civic:` prefix in the OES PROV-O graph (which currently appears in the `provenance` field's `@context`). All vocabulary terms that lived under `ccv:` move to `ts:` in the consolidated spec; the absorbed class names (`Claim`, `ConfidenceStatement`, `AnalyticalDerivation`, `Scope`, `TrendClaim`, `ComparisonClaim`, `ObservationClaim`, `CompositionClaim`, `RelationshipClaim`, `QualitativeClaim`, etc.) stay byte-identical save for the prefix change. Per the [Q10](../architecture/open-questions.md#q10--civic-claim-vocabulary-as-a-full-ontology) full-ontology promotion path tracked under proposed-issue 005, the post-rename vocabulary remains the target of that promotion; `ts:` is the prefix the future OWL ontology is published under.

The trailing `#` follows the W3C convention used by RDF, RDFS, OWL, FOAF, and PROV-O. The URI's resolution semantics (whether a fetch of `https://typedstandards.org/ns/ts#` returns a vocabulary document, a redirect, an HTML landing page, or 404) are out of scope for this ADR; the URI is an identifier, not a fetch target. Hosting the vocabulary at the resolution URL is a typedstandards.org-website concern tracked separately.

**Removal of `tss:` from the candidate set.** The [Q40](../architecture/open-questions.md#q40--pre-adoption-research-for-typedstandardsorg-rename--namespace-prefix-selection-ts-vs-tss-vs-alternatives) prefix-collision survey identified `tss:` as the closest contender at the singular/plural axis. The 2026-05-26 deep-research memo §2.1 elevated the RFC 3161 / TSA collision to the load-bearing rejection rationale: RFC 3161 §1 defines TSA (Time-Stamping Authority) and the wider cryptographic-provenance literature uses TSS for "Time-Stamping Server" or "Time-Stamping Service" (e.g., ETSI TS 102 023, RFC 3161 bis drafts). The Typed Standards envelope actively uses RFC 3161 timestamps inside the envelope (per OES §6.2, absorbed into the consolidated spec); a reader scanning a spec that says `tss:envelope` and `tss:timestamp` would not unreasonably read `tss:` as the timestamping subsystem. The collision is cosmetic on first read and semantic on close read — and it is precisely on the cryptographic-provenance terrain the standard occupies. `tss:` is removed from the candidate list. Other rejected candidates with one-line rationales: `tsx:` (collides with TypeScript JSX file extension and amplifies the TypeScript-standards confusion); `typed:` (acceptable fallback but longer + less mnemonic); `tstd:` (less readable); `typedstd:` (heavyweight; only justified if `ts:` proved contested at registration, which the live-check ruled out).

### 3. Well-known path rename: `/.well-known/evidence-public-keys.json` → `/.well-known/typed-publisher.json`, both served indefinitely

The trust registry's well-known path is renamed from `/.well-known/evidence-public-keys.json` to `/.well-known/typed-publisher.json`. The two paths are served in parallel **indefinitely** by the reference implementation — both URLs MUST return byte-identical JSON content. The new path is the **canonical** path going forward: new external clients SHOULD fetch the new path; existing external clients that fetch the legacy path continue to receive the registry without interruption. No `308 Permanent Redirect` is introduced; the parallel-serve pattern is permanent.

The cost of maintaining one extra served path indefinitely is small (a static JSON file under `public/.well-known/`, or a one-line route alias), and the small but non-zero population of existing fetchers (the Claude Code `publish-evidence` skill; possibly one or two third-party verifiers experimenting; no known external production verifiers) does not warrant a forced cutover. A future ADR may deprecate the legacy path if no live consumer depends on it; no forced cutover lands in this ADR.

Provisional IANA registration is filed for the new path only (`/.well-known/typed-publisher.json`) per the 2026-05-26 deep-research memo §3.3 mechanism (Specification Required; provisional registrations accepted on a lightweight basis citing the consolidated RFC URL). The legacy path is not IANA-registered (and never was); the parallel-serve is purely a reference-implementation convenience.

### 4. Reframe OES + CCV as historical snapshots

The two normative-layer-doc files at `civic-ai-tools/docs/architecture/open-evidence-standard.md` and `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` are reframed as historical snapshots. Both files receive a status note prepended at the top:

> *Historical snapshot 2026-05-26. Canonical text now at [`typed-standards-specification.md`](typed-standards-specification.md) §X. Kept for reference and historical-cross-reference accuracy; not the source-of-truth for new implementations.*

The bodies of both files are preserved verbatim. No body edits land; the snapshots freeze at the state they reached at consolidation time. Existing ADRs (0003 through 0011) continue to cite OES + CCV at the section numbers and content state they were written against; the historical-snapshot framing makes that cross-reference accuracy explicit. NEW references in this and future ADRs point at `typed-standards-specification.md`.

The `Status:` field at the top of each historical-snapshot file changes from `Internal working draft (pre-v0.1)` to `Historical snapshot — frozen 2026-05-26`; the `Last updated` and `Maintainer` fields remain unchanged from their last-edit state for historical-accuracy reasons.

### 5. Consolidated spec status: "v0.1 Working Draft — open for external review (review window to be scheduled)"

The consolidated spec's status block reads:

> **Status:** v0.1 Working Draft — open for external review (review window to be scheduled)
> **Spec name:** Typed Standards Specification
> **Version:** v0.1
> **License:** CC BY 4.0 (per §6 below; see Citation appendix for canonical citation form)
> **Maintainer:** [TK: leave as placeholder]
> **Canonical URL:** [TK: typedstandards.org/specs/v0.1/ once typedstandards.org is registered + the spec is published there]

The "review window to be scheduled" language is intentional. External-review timing depends on initial conversations with the three prospective collaborators (datHere; the second and third prospective collaborators referenced neutrally) that have not yet happened; naming review-window dates or a comment-deadline before those conversations have set expectations is a commitment the consolidation should not make on the user's behalf. The window dates + comment-deadline are populated by Phase 4 of the consolidation chat once the initial conversations have landed.

The status block does not name a specific Last-Updated date; the consolidated spec lives at HEAD of `main` until the v0.1 review window opens and the spec is frozen at a tagged commit. Versioning happens in Phase 4 of the consolidation chat (`v0.2-typed-standards-rfc` tag at the consolidation commit's HEAD; subsequent spec-tagged versions when v0.1 review concludes).

### 6. License the consolidated spec under CC BY 4.0

The consolidated spec is licensed under CC BY 4.0 (Creative Commons Attribution 4.0 International). The license name + a one-line attribution-required summary appears in the consolidated spec's status block (§5 above); the full license text is referenced by URL (`https://creativecommons.org/licenses/by/4.0/`) rather than inlined. CC BY 4.0 matches the convention used by in-toto, SLSA, and C2PA pre-v2 self-published specs at the v0.1 stage and was the user-confirmed preference over CC0 in the consolidation chat.

The OES + CCV historical snapshots inherit CC BY 4.0 from their consolidated-spec origin — no separate license note is added to either snapshot file (the status note's redirect to `typed-standards-specification.md` is sufficient).

### 7. Citation conventions documented in a new appendix to the consolidated spec

A new Citation appendix in the consolidated spec specifies the canonical citation form:

> *Typed Standards. Specification Name, Version. Status. Published at URL. Date.*

Example (for a future v0.1-frozen envelope section): *Typed Standards. Envelope Specification v0.1. Working Draft. Published at https://typedstandards.org/specs/v0.1/. 2026-06-XX.*

Academic citation follows the prevailing pattern across SLSA / in-toto / C2PA papers: cite the spec by its stable URL with an accessed-date footnote. Once v0.1 is frozen, a Zenodo DOI is applied for (free; the standard mechanism for academic citability of grey literature); the DOI takes precedence over the URL form for academic citations once issued. DOI application is deferred to v0.2 work — v0.1 may need substantive revisions before freeze, and DOIs are permanent.

### 8. Community-review infrastructure (tracker location + four pieces)

The community-review infrastructure for the v0.1 RFC has four pieces, per the 2026-05-26 deep-research memo §6.3:

1. **GitHub Discussions on `npstorey/civic-ai-tools`** with a `v0.1-rfc` category. Asynchronous open review; reviewer affordance for threaded discussion that does not need to become a GitHub issue.
2. **A public mailing list** at `typed-standards@googlegroups.com` (or equivalent self-hosted archive). Archive of the review discussion regardless of platform; recoverable independently of GitHub.
3. **A reviewer-orientation document**, separate from the RFC itself, pointing reviewers at: (i) the consolidated RFC URL; (ii) a one-page reading guide; (iii) the disambiguation paragraphs (C2PA / W3C VC / TypeScript / TS-document-class / RFC 3161-TSA) from the consolidated spec's Introduction + Conventions sections; (iv) a concrete worked example of a published package under verification.
4. **Three scheduled review calls**, one per named reviewer organization, spaced over the review window. The three reviewer organizations are **datHere** (publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md)); a **second prospective collaborator in early discussions** (referenced neutrally per the workspace stakeholder boundary); and a **third prospective collaborator in early discussions** (referenced neutrally). Recordings + minutes posted publicly per the memo §6.3 pattern.

A tracker for the three review calls and the review-window dates lives at `civic-ai-tools/docs/community-review/v0.1-rfc-tracker.md`. The `community-review/` subdirectory is created in Phase 4 of the consolidation chat; the tracker file's schema is documented in that subdirectory's `README.md`. This ADR names the tracker's location without populating it — the tracker fills in as the initial conversations + scheduling happen.

The Phase 4 infrastructure work is logistical and largely out-of-chat (user-driven); the consolidation chat produces the reviewer-orientation document text + the IANA registration PR body as in-chat deliverables.

## Considered and rejected alternatives

- **Keep three separate docs (OES + CCV + typed-standards-proposal umbrella).** Rejected. External RFC review needs a single document; the three-doc structure costs more in cross-ref maintenance than it saves in compartmentalization, and the umbrella + normative-layer split was a transitional shape that has outlived its utility now that the MVP cohort has stabilized.

- **Adopt `tss:` instead of `ts:`.** Rejected per the RFC 3161 / TSA collision rationale in §2 above. The collision is cosmetic on first read and semantic on close read precisely on the cryptographic-provenance terrain the standard occupies; that is the wrong place to inherit a vocabulary clash.

- **Keep `typed-standards-proposal.md` as the filename and only change the document title to "Typed Standards Specification".** Rejected. External readers' first impression of a spec comes from its filename as much as from its title; an RFC-ready document called `proposal.md` reads as not-yet-an-RFC even when the title block inside is unambiguous. The mechanical cost of renaming (ADRs 0004-0011 References-section sed pass; CLAUDE.md updates; summary pointer updates) is one-time and fits the same commit that lands the body expansion. The cost of keeping the misaligned filename is paid every time a reviewer or downstream consumer encounters the file path.

- **Cut over the well-known path with a forced transition (e.g., a 30- or 90-day window then `308 Permanent Redirect` from old to new).** Rejected. The actual fetcher population of the legacy path is very small (the Claude Code `publish-evidence` skill; possibly one or two third-party verifiers experimenting; no known external production verifiers); a forced cutover creates a verification-interruption risk for those clients without a corresponding maintenance saving. Serving both paths indefinitely costs essentially nothing (one extra static JSON file under `public/.well-known/`) and removes the cutover risk entirely.

- **Apply for a Zenodo DOI in v0.1.** Rejected (deferred to v0.2). DOIs are permanent; v0.1 is explicitly a working draft that may need substantive revisions before v0.2 freeze. The DOI is for the frozen version. Until v0.1 freezes, the citation form is the URL-with-accessed-date pattern named in §7.

- **Submit to W3C Community Group in v0.1.** Rejected per the 2026-05-26 deep-research memo §6.2 path (a) recommendation. Self-publication at typedstandards.org is the right v0.1 path; CG submission adds 4-8 weeks of administrative overhead, requires a W3C account, and is a post-v0.1 graduation option (matching the W3C-VC trajectory). Reconsider after the v0.1 RFC has been externally reviewed and the consolidation has settled.

- **Bundle the OES + CCV status notes into the same commit as this ADR.** Rejected. Status notes redirecting readers to "the consolidated spec" only make sense once the consolidated spec exists as a single absorbing document; landing the status notes before the body expansion would briefly redirect readers to a not-yet-expanded target. Phased landing is cleaner: this ADR + Q39/Q40 resolution log first; body expansion + file rename + ADR References-section sed pass second; OES + CCV status notes + typed-standards-summary.md pointer updates third; tag + community-review infrastructure fourth.

- **Name the review-window dates + comment-deadline in v0.1's status block.** Rejected per the user-set constraint in the consolidation chat. External-review timing depends on initial conversations with the three prospective collaborators that have not yet happened; naming dates the conversations haven't validated is a commitment the chat shouldn't make on the user's behalf. The status block uses placeholder language ("review window to be scheduled") and the tracker (§8) is populated when initial conversations land.

## Consequences

- **Phase 1 (this commit).** Lands ADR-0012 + the open-questions Q39/Q40 resolution-log moves. No spec body changes; no file renames; no status-note edits to OES or CCV. The consolidation work is staged as a draft PR on the `consolidation/typed-standards-rfc-v0.1` branch; Phase 2 + Phase 3 + Phase 4 commits land on the same branch; the PR is marked ready and merged when all four phases complete.

- **Phase 2 (separate commit on the same branch).** Lands the body expansion + the file rename (`typed-standards-proposal.md` → `typed-standards-specification.md`) + the ADRs 0004-0011 References-section sed pass + workspace + per-repo CLAUDE.md updates + `typed-standards-summary.md` pointer updates. Phase 2 is the largest single piece of work in the consolidation chat and is structured with a section outline shown to the user before any normative content is expanded.

- **Phase 3 (separate commit on the same branch).** Lands the OES + CCV historical-snapshot status notes + the `typed-standards-summary.md` light edits + the cross-ref audit. No body edits to OES or CCV; only the prepended status notes per §4 above.

- **Phase 4 (separate commits + out-of-chat user work).** Tags the consolidation commit's HEAD as `v0.2-typed-standards-rfc`; opens the GitHub Discussions category; creates the mailing list; drafts the reviewer-orientation document; files the provisional IANA registration PR at `https://github.com/protocol-registries/well-known-uris` for `/.well-known/typed-publisher.json` citing the v0.1 RFC URL. Phase 4 infrastructure work is logistical and largely out-of-chat (user-driven); the chat produces the reviewer-orientation document text + the IANA registration PR body as in-chat deliverables.

- **Open-questions registry updates (this commit).** [Q39](../architecture/open-questions.md#q39--consolidate-oes--ccv-into-typed-standards-proposalmd-as-a-single-rfc-ready-spec) (the consolidation question) moves to the Resolution log; [Q40](../architecture/open-questions.md#q40--pre-adoption-research-for-typedstandardsorg-rename--namespace-prefix-selection-ts-vs-tss-vs-alternatives) (the seven-item pre-adoption research checklist) moves to the Resolution log with the 2026-05-26 deep-research memo cited as the resolution artifact + this ADR cited as the decision artifact. Q1 + Q3 + Q15 + Q16 + Q19 + Q27 + others remain open as registered; the consolidation does not resolve them but it does make the v0.1 RFC's posture toward them sharper (the consolidated spec's Conformance section names Q15 + Q16 honestly as targets-not-properties; the Verification section names Q1's package-format dependency).

- **Schema version unchanged.** The consolidation is a documentation-structure change + a coordination-surface rename, not a spec evolution; the canonical-JSON envelope schema version stays at `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec). Every existing package verifies byte-identical under the consolidated spec. The `ts:` namespace prefix change in JSON-LD `@context` fields applies to *future* `content/claim/v1` nodes that have not yet been minted; existing PROV-O graphs in published packages continue to carry their original `civic:` prefix and remain valid.

- **CCV vocabulary URI continues to resolve under the legacy form.** The CCV namespace URI `https://civicaitools.org/ns/civic-claim-vocabulary/v1#` continues to exist as an alias for the post-consolidation `https://typedstandards.org/ns/ts#` for the same backwards-compatibility reasoning as the well-known path: a future ADR may deprecate the legacy URI when no live consumer depends on it, but no forced cutover lands in this ADR. Vocabulary URIs are identifiers, not fetch targets, so this is a documentation choice rather than a hosted-content choice.

- **Adopter-blocked check satisfied.** The three named adopters in §Context need a single document to review; the consolidation produces it.

- **Domain registration (user's hand, not chat's).** `typedstandards.org` will be registered by Nathan Storey via Cloudflare Registrar or Porkbun with lock + 2FA per the 2026-05-26 deep-research memo §4 recommendation. Defensive registration of `typedstandards.io` + `typed-standards.org` is a separate user-decision out of scope for this ADR. Registration completion is a pre-Phase-4 gate (the IANA registration PR needs a stable URL at typedstandards.org); Phase 2 + Phase 3 body work can proceed in parallel with the registration.

- **Reference-implementation IMPL surface (out of scope for this ADR; subsequent IMPL cohort after the spec consolidation merges).** The reference implementation needs to serve the trust registry at BOTH `/.well-known/evidence-public-keys.json` AND `/.well-known/typed-publisher.json` (parallel-serve pattern). Touch surface: `civic-ai-tools-website/public/.well-known/evidence-public-keys.json` (copy-or-symlink to the new path); `civic-ai-tools-website/src/lib/evidence/verify.ts` (constants + import path); `civic-ai-tools-website/src/lib/evidence/signing.ts` (doc-comment); `civic-ai-tools-website/src/app/api/evidence/[slug]/bundle/route.ts` (default trust-registry URL); `civic-ai-tools-website/src/app/api/query-notebook/route.ts` (doc-comment); `civic-ai-tools-website/docs/key-rotation.md` (path references in the runbook); `civic-ai-tools-website/docs/api/evidence-publish.md` (path references in the external-clients API doc with a note explaining the parallel-serve). The Claude Code `publish-evidence` skill at `civic-ai-tools/.claude/skills/publish-evidence/` may use either path. None of this work is required for the Phase 1 commit; it lands as a separate IMPL cohort after the spec consolidation merges.

## References

- [ADR-0003](0003-evidence-capture-method.md) — captureMethod field discipline; this ADR inherits the tamper-evident labeling principle for any new field the consolidated spec might mint.
- [ADR-0004](0004-dathere-captureMethod-variant.md) — `datHere` content profile + commitment-view schema. References-section entry updated to cite `typed-standards-specification.md` in Phase 2.
- [ADR-0005](0005-executed-notebook-architecture.md) — executed-notebook architecture within `content/analysis/v1`. References-section entry updated in Phase 2.
- [ADR-0006](0006-producer-profile-architecture.md) — Producer Profile axis; per-subtype guidance bundles. References-section entry updated in Phase 2.
- [ADR-0007](0007-content-canonicalization.md) — content-level canonicalization URI. References-section entry updated in Phase 2.
- [ADR-0008](0008-multihash-content-hash.md) — multihash `contentHash` + RFC 8785 JCS envelope canonicalization. References-section entry updated in Phase 2.
- [ADR-0009](0009-unified-typed-attestation-primitive.md) — unified typed-attestation primitive + two-family taxonomy. References-section entry updated in Phase 2; this ADR's consolidation framing absorbs OES §15 per the ADR-0009 §8 reframe.
- [ADR-0010](0010-visibility-lifecycle-location-attestations.md) — visibility/lifecycle/location attestations. References-section entry updated in Phase 2.
- [ADR-0011](0011-capturemethod-generalization.md) — captureMethod value-space generalization + per-profile vocabulary. References-section entry updated in Phase 2. ADR-0011 was the last of the G1-G4 MVP cohort; this ADR consolidates the cohort's spec output.
- `civic-ai-tools/docs/architecture/typed-standards-proposal.md` → `typed-standards-specification.md` (renamed in Phase 2) — the consolidated spec.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — historical snapshot post-Phase-3.
- `civic-ai-tools/docs/architecture/civic-claim-vocabulary-draft-spec.md` — historical snapshot post-Phase-3.
- `civic-ai-tools/docs/architecture/typed-standards-summary.md` — light edits in Phase 3; stays a one-pager.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q39 + Q40 moved to Resolution log in this commit.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied: three named adopters need a single document to review.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path followed (Q39 + Q40 registered → ADR drafted → Resolution log entry).
- `civic-ai-tools/docs/architecture/chat-type-taxonomy.md` — this work happens in the Q39 consolidation planning chat (a chat-type-taxonomy §2 planning chat); the consolidation chat's outputs (ADR + spec body + status notes + community-review tracker) are the documentary record.
- 2026-05-26 deep-research memo (workspace-local at `/temp/q39_40_memo`; not committed because it carries specifics under the workspace stakeholder/relationship-content boundary) — the live-check + community-review-pathway research basis for §1-§8 above.
- 2026-05-25 strategic memo (workspace-root at `docs/architecture-incorporation-memo-2026-05-25.md`) — the G1-G4 sequencing memo whose MVP-cohort gate this ADR's consolidation trigger fires after.
- External standards cited by the consolidated spec's disambiguation language: RFC 3161 (Time-Stamping Authority terminology — the `tss:` rejection rationale); RFC 8615 (well-known URIs registry mechanics — the IANA registration path for §3); RFC 8785 (JCS canonicalization — used by the envelope); RFC 2119 (conformance keywords); C2PA (claim/assertion/manifest disambiguation — appears in the consolidated spec's Introduction per memo §7 finding #3); in-toto (multihash + predicate-type-URI alignment per ADR-0008 + ADR-0009); W3C Verifiable Credentials (VC-claim vs typed-claims disambiguation); SLSA (production-process-attestation analogue); Sigstore (Rekor + identity-binding); W3C PROV-O (provenance graph vocabulary).
