# Community review

This directory holds the artifacts the Typed Standards Specification's community-review process produces and consumes. The directory's purpose is named in [ADR-0012 §8](../adr/0012-typed-standards-consolidation.md).

## Contents

- [`v0.1-rfc-reviewer-orientation.md`](v0.1-rfc-reviewer-orientation.md) — one-page reading guide for reviewers receiving the spec privately ahead of a public RFC launch. Independent of the spec text itself.
- [`typed-standards-specification-v0.1.pdf`](typed-standards-specification-v0.1.pdf) — PDF render of the consolidated [`typed-standards-specification.md`](../architecture/typed-standards-specification.md), produced via the workspace external-doc pipeline (pandoc → headless Chrome). The PDF is the artifact sent to reviewers; the GitHub-hosted markdown at the `v0.2-typed-standards-rfc` tag is the canonical citation form.

## Scope

This directory carries the **pre-launch private-circulation** review materials. The spec is being shared with a small set of named reviewers ahead of public RFC publication; per-reviewer outreach happens outside this repo (channels chosen by the maintainer; see the orientation document for the user-side how-to-send-feedback section).

Public-launch infrastructure — GitHub Discussions categories, mailing list, provisional IANA registration PR, reviewer tracker — is **not** in scope here. Those land in a future phase gated on [`typedstandards.org`](https://typedstandards.org) launch with the new institutional steward. ADR-0012 §Consequences's "Phase 4" enumeration described that public-launch infrastructure as part of the consolidation chat's Phase 4; the orchestrator rescoped Phase 4 to pre-launch private-circulation only. ADR-0012 stays as the historical record of the plan as conceived; the rescope lives in this directory's existence + the Phase 4 commit message.

## Maintenance

This directory is updated when:

- A new reviewer-orientation document is drafted (or the existing one is revised based on first-reviewer feedback).
- A new PDF render is produced (e.g., after a substantive spec revision).
- Public-launch infrastructure materializes — at which point this directory may gain reviewer-tracker files, discussion-thread archives, or move out entirely to a successor directory under a typedstandards.org-managed surface.
