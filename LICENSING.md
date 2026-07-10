# Licensing

The single cross-repo record of license choices for the civic-ai-tools project (civic-ai-tools#75; DPG Standard Indicator 2 evidence for the planned DPGA submission, civic-ai-tools#73). Per-repo `LICENSE` files are authoritative for code; this document explains what applies where and why.

**Audited:** 2026-06-11, against the live state of all four repos, the published npm packages, and the specification text. **Updated 2026-07-10:** typedstandards flipped public — row below revised from the "declared at launch" placeholder to the actual MIT declaration.

## Code

| Repo | License | Notes |
|------|---------|-------|
| [civic-ai-tools](https://github.com/npstorey/civic-ai-tools) (this repo) | MIT ([LICENSE](LICENSE)) | Hub: MCP configs, setup scripts, skill docs, examples, architecture docs |
| [civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website) | MIT (LICENSE) | Reference implementation + civicaitools.org |
| [socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server) | MIT (LICENSE, **dual copyright**) | Fork of Scott Robbin's original MCP server; his copyright line and `author` field are preserved alongside the fork's (© 2025 Scott Robbin, © 2025 Nathan Storey). Published on npm under MIT |
| [typedstandards](https://github.com/npstorey/typedstandards) | MIT (LICENSE) | Public since 2026-07-10. Code monorepo — the typedstandards.org site source and [`@typedstandards/verify-core`](https://www.npmjs.com/package/@typedstandards/verify-core) (on npm — MIT, LICENSE shipped in the tarball): all MIT under the repo's [LICENSE](https://github.com/npstorey/typedstandards/blob/main/LICENSE) (© 2026 Nathan Storey). The **specification text** it implements is authored in this repo under CC BY 4.0 (see "Specification text" below); typedstandards carries no separate spec-license surface |

## Specification text

- **Typed Standards Specification** (`docs/architecture/typed-standards-specification.md`) — **CC BY 4.0**, declared in the document itself (front matter + §3, with the full-license link and the canonical citation form in Appendix A). Chosen in the ADR-0012 consolidation.
- **Typed Standards summary one-pager** (`docs/architecture/typed-standards-summary.md`) — CC BY 4.0, same as the full specification (notice added in this audit).
- **Frozen historical snapshots** (`open-evidence-standard.md`, `civic-claim-vocabulary-draft-spec.md`) — superseded drafts preserved for cross-reference accuracy in pre-consolidation ADRs. Their content was absorbed into the CC BY 4.0 specification and is covered by the same license; the files themselves are not edited post-freeze, so the notice lives here rather than in-file.
- **All other documentation** (architecture doctrines, guides, skill docs, READMEs) — covered by each repo's MIT license. Only the specification text carries CC BY 4.0, because it is the artifact meant to be cited, excerpted, and adapted by other standards work.

## Project-produced data

- **MCP server directory** (`data/mcp-servers.json`, rendered to `docs/mcp-servers.md`) and the **curated dataset directory** (`docs/datasets.md`) — **CC0 1.0**. These are small, factual, hand-curated registries; dedicating them to the public domain maximizes reuse and matches how the project wants directories treated (declared in this audit).

## Patents

Patent posture is recorded separately from copyright: [IPR.md](IPR.md) (DCO inbound + patent terms for specification contributions) and [PATENTS.md](PATENTS.md) (the maintainer's royalty-free non-assertion statement over Essential Claims for conformant implementations of the Typed Standards Specification). Adopted per [ADR-0017](docs/adr/0017-ipr-posture-dco-rf-statement.md).

## Upstream civic data

Data reached through the MCP servers (Socrata portals, Google Data Commons, Boston OpenContext) is **not relicensed by this project**. Each source portal's own terms govern. Evidence packages that quote query results carry that upstream-sourced content under the source's terms; the project's roadmap §7 explicitly disclaims legal advisory on data-use terms.

## Evidence-package registry content — pending decision

Published evidence packages mix four kinds of content with different ownership: platform-generated envelope metadata (hashes, signatures, provenance graph), the author's prompt and analysis framing, model-generated output, and upstream civic-data excerpts. **No license is asserted over registry content today.** Direction under consideration: CC0 for the platform-generated envelope metadata; author-content licensing chosen at publish time with explicit consent UI — which makes it part of the publish-flow identity/consent work tracked at civic-ai-tools-website#70 rather than a unilateral platform declaration. Until that lands, registry pages carry no license statement and reusers should treat author content as all-rights-reserved by default.

## Maintenance

Update this file when: a repo is added or goes public, an npm package's license changes, the evidence-package content decision lands (#70), or the DPGA submission (#73) requires finer-grained evidence.
