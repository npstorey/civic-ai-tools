---
paths:
  - "docs/architecture/**"
  - "docs/adr/**"
---

# Architecture documents and ADRs

Canonical specifications and design decisions. ADRs in `docs/adr/` record settled decisions; the
documents below describe the artifacts those decisions are about. Two frozen snapshots are kept only
for cross-reference accuracy in pre-consolidation ADRs — do not edit them as if they were live.

| Document | What it is |
|---|---|
| `typed-standards-specification.md` | **The canonical consolidated specification** (v0.1.x; OES + CCV absorbed per ADR-0012). Record-package shape (§8.1), signing, the §9.2 verification check sequence, captureMethod, lifecycle, typed claims (§8.11). Appendix J is the vocabulary mapping. Sections with open questions cite the registry by Q-number. |
| `typed-standards-summary.md` | One-pager companion to the specification. |
| `open-questions.md` | **Living registry of unresolved decisions** — the front door per the working method. A future ADR that resolves a question updates its entry to point at the resolution. |
| `end-state-vision.md` | Layered architecture target with build-state colouring (built / partial / designed / speculative) and the glossary. Update when an open question resolves. |
| `open-evidence-standard.md` | **Frozen snapshot (2026-05-26).** Envelope-layer content consolidated into the specification per ADR-0012. Not the source of truth. |
| `civic-claim-vocabulary-draft-spec.md` | **Frozen snapshot (2026-05-26).** Typed-claims content consolidated into specification §8.11 per ADR-0012. OWL-ontology promotion tracked under Q10. |
| `xanadu-doctrine.md` | Discipline gating spec growth: nothing is promoted to a higher build state without a real package or adopter that needs it. |
| `working-method.md` | Discipline governing how content moves between the project's coordination surfaces, and the promotion path from question to issue to ADR. |
| `working-method-flow.md` | The practical companion: surface map, flowchart, worked "where does this go?" examples. Read this when placing content; read `working-method.md` for the rationale. |
| `chat-type-taxonomy.md` | Discipline governing conversation surfaces and their closure rules. |

Editing the specification's YAML frontmatter? `npm run check:spec-frontmatter` gates it — known keys
only, no mapping indicator inside a plain scalar, a full patch Version, and a Tag that agrees with it.
