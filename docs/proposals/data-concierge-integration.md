---
Status: Proposal
Last updated: 2026-05-16
Maintainer: [TK: leave as placeholder]
---

# Data Concierge integration arc (Pittsburgh / WPRDC pilot)

## Purpose

Integrate Civic AI Tools' evidence-package system with an external civic-data publisher's notebook-based publishing tool for the Pittsburgh / WPRDC pilot. This proposal scopes the architectural changes, organizes them into filed GitHub issues, and traces dependencies between them.

The integration is also the driver for several foundational refinements to the Open Evidence Standard — most consequentially, the **attest-by-default / publish-by-choice** lifecycle and the **unified node primitive** framing. These refinements were surfaced by the integration scenarios but are general-purpose improvements that stand on their own merits.

## Architectural commitments

Three foundational commitments shape this arc:

### 1. The unified node primitive

OES has exactly one protocol primitive: **the signed evidence package**.

```
                ┌─────────────────────────────────┐
                │      Signed Evidence Package    │
                ├─────────────────────────────────┤
                │ claimType: <what kind of node>  │
                │ subjectCategory: <what about>   │
                │ content: <inline OR pointers>   │
                │ references: [                   │
                │   { type: ..., targetHash: ...} │
                │   ...                           │
                │ ]                               │
                │ signature, signerIdentity, ...  │
                └─────────────────────────────────┘
```

When this node is registered on the public transparency log, it becomes a **commitment** — there is no separate "commitment" object; the commitment is just the log view of the node. The same primitive functions as different things depending on `claimType` and `references`:

- `object-claim` — primary AI-generated civic-data analysis (the datHere flavor)
- `attestation` (with various `attestationKind` values) — corroboration, contradiction, correction, withdrawal, abuse-report, subject-objection, adversarial-evaluation
- `publication-record` — makes content public; references prior committed claim
- `host-self-attestation` — host describing itself
- `host-evaluation` — third-party describing a host
- ...future claim types extend the ontology, not the protocol

This is the architectural payoff of the integration work: one verification flow, one network-signal computation, one growing ontology. The spec stays small.

### 2. Attest by default, publish by choice

OES claims are **attested** by default and **published** by choice.

- **Attestation** = the act of signing a claim + registering its commitment on the transparency log. Always public-anchored, regardless of content visibility.
- **Publication** = the additional, irreversible act of making content publicly accessible, activating drift / contradiction / citation signals over the content itself.

Every claim is attested. Publishing is opt-in.

Visibility modes:

| Mode | Commitment on transparency log | Content access |
|---|---|---|
| `published` | Yes | Public |
| `committed` | Yes | Restricted (host access control, recipient-set, encrypted-to-recipients) |
| `group` *(reserved)* | Yes | Closed group with own corroboration scope |

This directly enables internal-data scenarios (cryptographic signing without forced public disclosure) and lowers adoption friction (the social ask becomes "sign and share with colleagues" rather than "publish to the world").

### 3. The datHere flavor: A-G envelope content structure

`captureMethod: datHere` defines the content of an evidence package whose subject is an AI-generated civic-data analysis. Seven sections:

| Section | Content | Role |
|---|---|---|
| A | Initial prompt | The user's question, verbatim |
| B | System prompt(s) | System prompts active for the model |
| C | Model card + environment | Model ID/version, temperature, MCP servers, tool definitions, host metadata |
| D | Deliberative trace | Thinking + tool calls + tool results, in order |
| E | **Answer Notebook** | Jupyter (or Marimo) notebook that deterministically produces F |
| F | The Answer | Rendered output of E |
| G | Answer Summary | Short, indexable, citation-ready |

E is the integrity-bearing artifact; F is recomputable from E. The envelope wrapping A-G is the signed unit.

## Integration shape

The pilot integration uses a GitHub-frontmatter publishing pattern:

```
Civic AI Tools (civicaitools.org)
  └─ User asks question → AI deliberates → produces datHere-flavor envelope
       └─ POST /api/evidence (visibility: published | committed)
            └─ Signed envelope registered on transparency log

External notebook publisher (integration partner)
  └─ User asks question → semantic search of verified answers
       └─ If new: drafts notebook → generates answer → produces datHere envelope
            └─ Envelope published as frontmatter in git-host commit
                 └─ Commit body: notebook (E), rendered answer (F), summary (G)
                 └─ Frontmatter: envelope hash, signature, identity binding,
                                 captureMethod=datHere, links/embeds to attestations
       └─ Admin reviews → "approve" → POST /api/attestation
            └─ Typed corroboration attestation signed and registered
       └─ "Publish" requested → Adversarial eval runs → publication-record created
            └─ References original committed claim + adversarial-eval attestation
```

Both publishers hit the same registry endpoints with the same envelope shape.

## Filed issues

This proposal is realized through four GitHub issues filed in `npstorey/civic-ai-tools`:

| # | Title | Scope |
|---|-------|-------|
| [#69](https://github.com/npstorey/civic-ai-tools/issues/69) | Add "datHere flavor" evidence package format (A-G envelope) | Foundation. Defines the captureMethod variant + frontmatter schema + bundle-export. |
| [#70](https://github.com/npstorey/civic-ai-tools/issues/70) | Implement typed attestation primitive | Six initial attestation kinds; admin-approve maps to corroboration. |
| [#71](https://github.com/npstorey/civic-ai-tools/issues/71) | Add visibility modes: attest-by-default, publish-by-choice | `published` + `committed`; `publication-record` claim type. |
| [#72](https://github.com/npstorey/civic-ai-tools/issues/72) | Operationalize adversarial attestation as publication-record gate | Builds on existing adversarial attestation (#41) and the new publish lifecycle (#71). |

Sequencing: #69 first → #70 and #71 in parallel → #72 after #70 and #71.

Related proposed-issues (not yet promoted; will be once their dependencies land):

- **008** at `civic-ai-tools-website/docs/proposed-issues/008-host-self-attestation-pattern.md` — first reference host implementation (civicaitools.org as the first host).
- **009** at `civic-ai-tools-website/docs/proposed-issues/009-subject-of-claim-natural-person-ontology.md` — highest-leverage protocol-level defense against doxxing.
- **010** at `civic-ai-tools-website/docs/proposed-issues/010-platform-independence-documentation.md` — DPG Indicator 4 evidence (coordinated with the parallel DPG-readiness arc).

## Open questions in the registry

The integration work surfaces seven open architectural questions, now tracked in `open-questions.md`:

| Q | Title | Status |
|---|-------|--------|
| Q20 | Visibility lifecycle and attest/publish semantics | Promoted to #71 |
| Q21 | Canonical notebook format for datHere captureMethod | Promoted to #69 |
| Q22 | Host as typeable subject + host self-attestation shape | Open; proposed-issue 008 drafted |
| Q23 | Provenance graph rendering with meta-attestation layer | Promoted to #70 |
| Q24 | Embed-vs-reference policy for attestations in published artifacts | Promoted to #69 |
| Q25 | Adversarial-evaluation requirement strength on publication-records | Promoted to #72 |
| Q26 | Valid evaluator definition | Promoted to #72 |

## Spec implications

The four issues + three proposed-issues produce, collectively:

- **Open Evidence Standard amendments**: unified-primitive opening; visibility lifecycle + publication-record semantics; meta-attestation ontology; captureMethod variant for `datHere`; Host as typeable subject; staleness honesty; cryptographic-primitives section. The harms section work proceeds under #63 in coordination.
- **Civic Claim Vocabulary amendments**: typed meta-attestation classes (including adversarial-evaluation under Q11/Q26).
- **ADRs**: ADR-0004 (datHere captureMethod), ADR-0005 (attest/publish lifecycle), ADR-0006 (unified primitive), ADR-0007 (adversarial-eval requirement model).
- **Trust-and-evidence doc**: attest/publish lifecycle's effect on integrity claims; capture-method UI guidance.

## Coordination with parallel tracks

- **OES spinout decision** (parked) — naming + repo organization. Decoupled from this arc; decide after first iteration ships.
- **DPG-readiness arc** at `docs/proposals/dpg-readiness.md` — runs in parallel. Several overlaps (harms section, platform-independence doc, subject-of-claim ontology); see that proposal's overlap table.
- **Existing related issues** — #41 (adversarial attestation feedback loop), #43 (publish-evidence skill capture), #63 (threat model documentation), #50 (Democratic Capabilities Gap Map submission). Cross-referenced via comments.

## Out of scope for v1

- Group-corroboration mode (Pattern 3) — `group` visibility value reserved; specify later.
- Zero-knowledge predicates over private claims — future.
- Cross-host claim discovery / federation — useful but not blocking; deferred.
- Local LLM deployment for the pilot integration partner's internal data — integration partner's side; this arc provides the protocol layer.

## Source materials

- Architecture-conversation work on attest/publish reframing and the unified primitive (in-session transcript; in workspace planning docs at `data-concierge-integration-project-plan.md`).
- The clarifying conversation on cryptographic primitives, commitment-vs-content distinction, staleness, and bypass-host distribution (in workspace planning docs).
- Pilot integration partner meetings (2026-05-12 and follow-up) confirming alignment on the deterministic-notebook output pattern and the GitHub-frontmatter publishing model.
