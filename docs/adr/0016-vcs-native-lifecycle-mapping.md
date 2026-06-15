# ADR-0016: Mapping the lifecycle/visibility model onto a VCS-native evidence-notebook workflow

- **Status:** Proposed
- **Date:** 2026-06-15
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0010](0010-visibility-lifecycle-location-attestations.md)

## Context

[ADR-0010](0010-visibility-lifecycle-location-attestations.md) operationalized the visibility/lifecycle/location sub-set of the [ADR-0009](0009-unified-typed-attestation-primitive.md) §7 attestation table: an immutable, content-addressed analysis node (identity = `nodeId` = envelope hash); visibility as the structural consequence of which attestations reference it (zero `locatedAt` = the private/draft base case; an `attestation/publishes/v1` + at least one `attestation/locatedAt/v1` = published); status changes as a chain of separately-signed `attestation/*` nodes. That model is **platform-first** — it was shaped by the civicaitools.org publish flow and the three collaborators named in ADR-0010's Context.

A CI/git-versioned evidence-notebook adopter's model is different in emphasis. Evidence notebooks are produced through a CI pipeline; git is the system of record; the diff between notebook versions is treated as the evidentiary unit. The platform-first model needs an explicit, ratified mapping onto that VCS-native workflow so the two models are known to be compatible rather than merely assumed to be. This question is registered as [Q49](../architecture/open-questions.md#q49--lifecyclevisibility-model-vs-a-vcs-native-git-versioned-evidence-notebook-workflow); this ADR resolves it at the decision level.

The strain is **not** uniform across the model. The *publication* half maps cleanly onto CI: a pipeline step emits the `attestation/publishes/v1` + `attestation/locatedAt/v1` pair, with the `locatedAt` `uri` resolving to a git/release URL. The strain concentrates in three places, which are the three decisions below:

- **(A)** the word "committed" — the platform's not-yet-published visibility state ([ADR-0010](0010-visibility-lifecycle-location-attestations.md); reference implementation `visibility: "committed"`) collides head-on, with near-opposite meaning, with "git commit" for a git-native adopter; resolving it surfaced a second clarity issue — the `visibility` field's *other* value, `published`, is act-shaped rather than a disclosure quality (Decision A makes the whole field type-correct);
- **(B)** whether and how a node records the VCS state it came from;
- **(C)** how a chain of notebook revisions (git history) is mirrored in the protocol.

**Adopter neutrality.** This ADR is written for *a CI/git-versioned evidence-notebook adopter* generically. datHere is named only at the level already public in the codebase ([ADR-0004](0004-dathere-captureMethod-variant.md): the `datHere` content profile + notebook captureMethod); the specific pipeline/diff workflow that motivated Q49 stays generic, and partner coordination is comms-side, not in this record.

**Xanadu gate.** The decisions below are **additive, optional, and adopter-motivated**. Decision A renames an existing live state (no new mechanism). Decision B adds one *optional* envelope field. Decision C adds one attestation sub-type to the open enum, motivated by a real adopter whose git-native workflow the existing `supersedes` sub-type does not cleanly express. No decision grows a required field, and residual sub-questions are sent to the registry rather than pre-specified.

**Demo-gating (explicit).** **None of this gates the July 6 demo**, which runs the published path end-to-end and is unaffected. Everything here is post-demo: the (A) rename is a UI/contract sweep tracked by the Demo-UX chat; the (B) `vcsRef` field and the (C) `attestation/revises/v1` sub-type are spec + reference-implementation work with no demo dependency. This ADR is a decision record; the implementation lands on its own timeline.

## Decision

### A. The `visibility` field is `sealed` / `public`; "publish" is reserved for the act and the attestation

The `visibility` field's values become **`sealed`** and **`public`**. The not-yet-disclosed state `committed` → **`sealed`** (verb "Commit" → "Seal"); the disclosed state `published` → **`public`**. The **verb/act** stays **"Publish"** (and its mirror "Seal"), and the **relationship** stays `attestation/publishes/v1` + `attestation/locatedAt/v1` — only the *state label* moves. State meanings are unchanged: a `sealed` node is signed + RFC 3161-timestamped + Sigstore Rekor-logged, content creator-only / unlisted / at a non-derivable key; a `public` node has the `attestation/publishes/v1` + `attestation/locatedAt/v1` pair and its content served + listed.

**Why these two values (and not `sealed` / `published`).** The field is named `visibility`, so its values should be *visibility qualities*, not *acts*. `sealed` and `public` are both node-local content-disclosure qualities — type-correct. `published`, by contrast, is act-shaped: it is the act of emitting `publishes` + `locatedAt` doing double duty as a state label. Splitting them apart leaves three non-overlapping concepts:

- **the quality** — the `visibility` field: `sealed` | `public`;
- **the act** — the verb on the button: "Publish" / "Seal";
- **the relationship** — the attestation: `attestation/publishes/v1` + `attestation/locatedAt/v1`.

"Publish" survives intact as the verb and the attestation; only the badge/state label reads "Public" instead of "Published" (arguably clearer in a visibility context). "Sealed" remains the right private-state word: it is the only candidate that honestly carries *both* facets — public proof (a tamper-evident seal anyone can check) and private contents — with neither a git collision (unlike "staged") nor a protocol-vocabulary collision (unlike "attested," which collides with the `attestation/*` namespace, or "notarized," which collides with the identity-binding tier). The facet-only alternatives each had a disqualifying snag: "private" overclaims, "registered" contradicts the unlisted property, "recorded" clashes with the "evidence record" noun, "held"/"draft" undersell the public-proof facet.

**Honesty note — `visibility` is content disclosure, not ledger presence.** The *cryptographic commitment* (the Rekor entry: envelope hash + timestamp + signer) is public in **both** states — `sealed` and `public` alike carry a public transparency-log commitment. The `visibility` field describes whether the *content* is disclosed, never whether the node is on the ledger. (This is also why a "ledger visibility" framing was rejected: nothing logged to Rekor is hidden; a truly-hidden-from-the-log mode would require a *private* transparency log per [ADR-0010](0010-visibility-lifecycle-location-attestations.md) §4, which is Xanadu-gated and not built.)

#### A.1 `visibility` is one of three orthogonal dimensions

Visibility is the *content-disclosure* axis only. Two further dimensions are deliberately kept distinct from it; conflating them (e.g. treating `withdrawn` as a visibility value) would lose a signal the standard is built to surface:

| Dimension | Question | Values | Derived from |
|---|---|---|---|
| **Visibility** | Is the content disclosed? | `sealed` / `public` | presence of `attestation/locatedAt/v1` |
| **Lifecycle status** | What is the publisher's current standing? | `active` / `withdrawn` / `superseded` (reinstate → active) | the latest signer-matched lifecycle attestation in the chain ([ADR-0010](0010-visibility-lifecycle-location-attestations.md) §1) |
| **Host display** | Does *this* host show it? | host's choice | **host policy** (`content/hostPolicy/v1`, [Q22](../architecture/open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape)) reading the two signals above |

- **`withdrawn` / `reinstated` / `superseded` are lifecycle status, NOT visibility values.** A withdrawn-formerly-public node is **`public` + `withdrawn`**, not `sealed`: withdrawal retracts the publisher's *standing*, not the content's *disclosure* (the retention-asymmetry property, spec §8.10.3 / [ADR-0010](0010-visibility-lifecycle-location-attestations.md) §3). A publisher cannot un-disclose content already on the public log and on other hosts; folding `withdrawn` into `visibility` would falsely assert that it can. Lifecycle status is already modeled separately as the attestation chain ([ADR-0010](0010-visibility-lifecycle-location-attestations.md) §1); a denormalized `status` mirror alongside the `visibility` mirror is an implementation option, not a protocol change.
- **Host display is host policy, not a node property.** The protocol emits the `withdraws` signal but mandates no host behavior; a host MAY hide withdrawn nodes, show them with a "withdrawn by publisher" banner, or keep serving them, per its `content/hostPolicy/v1` declaration (Q22). "Public but withdrawn, and host X still shows it" must remain expressible — which it cannot be if `withdrawn` is a `visibility` value.
- (**Availability** — whether a `locatedAt` URI currently resolves — rides the optional `availability` sub-field on `locatedAt`, distinct again from `visibility`, which records *asserted* disclosure rather than current reachability.)

**Scope of the rename (narrow).** Renamed: the `visibility` *value* (`committed` → `sealed`, `published` → `public`) wherever it is a state label — the DB `visibilityEnum`, the `POST /api/evidence` `visibility` value, the TypeScript unions, the `publish-evidence` skill's `--visibility` value + `ALLOWED_VISIBILITY`, and the user-facing strings (publish-dialog radio + help text, submit button, success badge + copy, dashboard status badge, detail-page banner). The verb "Commit" → "Seal"; the verb "Publish" is unchanged. **Not renamed:** the cryptographic "commitment" noun (`/commitment` endpoint, the commitment view/bundle), the `attestation/publishes/v1` sub-type, and the "Publish" verb. This threads through **live** civicaitools.org UI copy and the published skill, so it is sequenced deliberately — the Demo-UX naming sweep was waiting only on this. Back-compat in Consequences (the API + skill SHOULD accept legacy `committed` → `sealed` and `published` → `public` as aliases).

### B. Optional VCS reference: an attested, verify-on-fetch envelope field on the content node

A content node **MAY** optionally carry a `vcsRef` field recording the version-control state the analysis was generated from. The decision has two parts — *where it lives* and *what its signature means*.

**It is a content-family self-declaration, not an attestation.** Per the [ADR-0009](0009-unified-typed-attestation-primitive.md) §2 two-family rule, an `attestation/*` node asserts about *another* node (it carries a `targetNodeId`); a `content/*` node makes a standalone, self-describing assertion. "This analysis was generated from git commit X in repo Y" is the node describing *its own* provenance — there is no other node as the subject. It therefore lives as an **optional top-level envelope field on the content node**, structurally alongside `captureMethod`, `contentProfile`, and `producerProfile` ([ADR-0003](0003-evidence-capture-method.md) / [ADR-0004](0004-dathere-captureMethod-variant.md) / [ADR-0006](0006-producer-profile-architecture.md)) — not as a new attestation sub-type. (This is distinct from `attestation/locatedAt/v1`, whose `uri` says *where the published artifact is fetchable* — possibly a git/release URL — whereas `vcsRef` says *which source revision the analysis derives from*. The two can both be present and point at different things.)

**It is attested (signed), not unsigned descriptive metadata.** Because `vcsRef` is a top-level envelope field, it is covered by the RFC 8785 JCS envelope hash and the Ed25519ph signature ([ADR-0008](0008-multihash-content-hash.md) §6–§7) like every other envelope field. The binding is therefore **tamper-evident and attributable**: a third party cannot strip, alter, or forge "this came from commit X" without invalidating the signature, and the assertion is bound to the signer's identity. An adopter whose git history is the evidentiary backbone needs exactly this property; unsigned descriptive metadata would lose it.

**But the signature attests the *assertion*, not the *fact*.** This is the load-bearing normative constraint, and it follows the project's established posture (production-process attestation, not truth — [ADR-0003](0003-evidence-capture-method.md); spec §5.2 / §10.2) and the direct precedent of `attestation/locatedAt/v1` (spec §8.10.2: `contentHash` "SHOULD match … mismatch is informative"). A signed `vcsRef` proves the signer *asserted* the analysis corresponds to commit X — it does **not** prove that commit X exists, is reachable, or contains what is claimed. Concretely:

- `vcsRef` is **verify-on-fetch**: a verifier that chooses to resolve `repoUrl` + `commitSha` MAY check that the referenced revision exists and that the notebook at the referenced `path` matches the node's `contentHash`. A mismatch (or an unreachable commit) is **informative, not a hard failure** — surfaced as a signal, not converted into a platform verdict, per the §5.1 normative preamble.
- The *weight* a consumer places on an unverified `vcsRef` is **`captureMethod`-contextualized**, consistent with [ADR-0003](0003-evidence-capture-method.md) / [ADR-0011](0011-capturemethod-generalization.md): a platform-attested capture method lends the self-asserted reference more weight than a user-attested (locally editable) one. `vcsRef` does not need a new `captureMethod` value; the existing per-profile vocabulary already carries the capture-strength signal.

**Field shape (v0.1, minimal).** `vcsRef` is an object:

| Sub-field | Required-if-present | Meaning |
|---|---|---|
| `repoUrl` | yes | Repository URL (the system; "VCS" = version-control system, not git-specific) |
| `commitSha` | yes | The full, immutable revision object id |
| `path` | optional | Path to the notebook / source artifact within the repository |
| `ref` | optional | Branch or tag name — a *mutable* pointer, informative only |

Deferred to future work (not specified here; see Deferred): a `provider` discriminator, signed-commit (e.g. GPG/SSH) verification semantics, and multi-file references. The exact field key (`vcsRef`) is the recommended name; final confirmation is an implementation detail.

### C. Lineage: mint `attestation/revises/v1`, distinct from the existing `attestation/supersedes/v1`

A chain of notebook revisions (git history) is mirrored as a chain of **`attestation/revises/v1`** nodes, one per revision edge, each linking a prior node to its successor. This is a **new** sub-type added to the [ADR-0009](0009-unified-typed-attestation-primitive.md) §7 open enum — *distinct from* the already-ratified `attestation/supersedes/v1`.

**Why a distinct sub-type rather than reusing `supersedes`.** `attestation/supersedes/v1` already exists with exactly the old→new shape (`targetNodeId`, `successorNodeId`), so reuse is tempting. But the two encode **meaningfully different consumer signals**, and conflating them loses a signal — the same reasoning ADR-0009 §7 refinement (b) used to keep `endorses` and `corroborates` distinct:

- **`supersedes` = corrective replacement.** "This new node *replaces* the old one; treat the old as obsoleted." It carries a deprecation signal — a consumer should stop relying on the superseded node.
- **`revises` = neutral version-succession.** "This is the *next version* in a lineage." It carries **no** deprecation signal — the prior revision remains a valid point-in-time snapshot. This matches both git history (commit N+1 does not declare N "wrong") and the project's retention model (a prior node is not withdrawn merely because a successor exists; ADR-0010 §3 / spec §8.10.3).

A git-native adopter's revision chain is overwhelmingly the *revises* semantic; forcing it through `supersedes` would mislabel every iteration as a correction.

**Shape (v0.1).** `attestation/revises/v1`:

| Field | Meaning |
|---|---|
| `targetNodeId` | the prior revision (the parent) |
| `successorNodeId` | this revision (the child) |

Authorization rule: **`publisher-only`** (the lineage owner), consistent with the other lifecycle sub-types per [ADR-0009](0009-unified-typed-attestation-primitive.md) §5. Single-parent only at v0.1 (linear lineage); multi-parent / merge-DAG lineage is deferred (see Deferred).

**The diff stays a derivable view, not a first-class object.** The diff between two revisions is **computed on demand** from the two content-addressed nodes (both immutable, both retrievable) and rendered as a human view. It is **not** a node, **not** an attestation, and **not** separately signed. The `attestation/revises/v1` edge plus the two nodes it links are sufficient to render the diff; signing the diff would add a redundant, derivable artifact whose integrity is already implied by the two nodes' own signatures. This keeps the *evidentiary units* the immutable nodes — honoring the adopter's "the diff is the evidentiary unit" intuition by making the diff a first-class *view* without making it a first-class *object*. (A future adopter who needs a signed, attributable diff — e.g. a reviewer attesting "I reviewed exactly this diff" — would express that as an `attestation/*` over the two nodes, registered when that need is real; it is not minted here.)

## Considered and rejected alternatives

- **(A) Keep "committed."** Rejected — the collision with "git commit" is the originating problem of Q49 for the target adopter, and the state appears in live UI copy and the publish skill where the ambiguity is user-facing.
- **(A) Rename the cryptographic "commitment" noun too.** Rejected as over-reach — "commitment" is a correct cryptographic term with no git collision; renaming it would lose precision and churn the `/commitment` endpoint, bundle, and verifier vocabulary for no benefit.
- **(A) Keep `published` as the disclosed-state value (i.e. `sealed` / `published`).** Rejected per §A — in a field named `visibility`, `published` is act-shaped (the act of emitting `publishes` + `locatedAt`) doing double duty as a state, while `sealed` is a disclosure quality; the mismatch invites conflation (and would sit awkwardly next to lifecycle-status values like `withdrawn`). `sealed` / `public` makes both values disclosure qualities and reserves "publish" / `attestation/publishes/v1` for the act and the relationship.
- **(A) Add `withdrawn` (or `superseded`) as a third `visibility` value.** Rejected per §A.1 — these are *lifecycle status*, not disclosure: a withdrawn-formerly-public node is `public` + `withdrawn`, not `sealed`, because withdrawal cannot un-disclose content already public (retention asymmetry, §8.10.3). Lifecycle status is the attestation chain; host display is host policy (Q22). Collapsing any of these into `visibility` loses the "public but withdrawn, host still shows it" expressiveness.
- **(B) Unsigned descriptive `vcsRef`.** Rejected — it would forfeit tamper-evidence and attribution on a binding the adopter's evidentiary model depends on, and it would make `vcsRef` an odd exception to the signed-self-declaration pattern that `captureMethod` / `contentProfile` / `producerProfile` already establish.
- **(B) A signed `vcsRef` treated as a cryptographic *proof* of the git state.** Rejected — the signature cannot establish that the referenced commit exists or contains what is claimed; presenting it as proof would be exactly the overclaim the project's "attests the assertion, not the fact" posture exists to prevent, and would invite a false sense of binding strength. Verify-on-fetch + mismatch-is-informative + `captureMethod`-weighting is the honest framing.
- **(B) A new `attestation/*` sub-type for the VCS reference.** Rejected — a node describing its own source revision asserts about *itself*, not another node; per the two-family rule it is `content/*` self-description, so an envelope field is the correct carrier. (An assertion linking *two* nodes is what the `attestation/*` family is for — that is Decision C.)
- **(C) Reuse `attestation/supersedes/v1` for git lineage.** Rejected per §C — `supersedes` carries a corrective/deprecation signal that a routine git revision does not; mislabeling every iteration as a correction loses the lineage-vs-correction signal, paralleling the ADR-0009 §7(b) endorses-vs-corroborates rationale.
- **(C) Make the diff a first-class signed object (a node or attestation).** Rejected per §C — the diff is fully derivable from two immutable signed nodes; signing it adds a redundant artifact and would shift the evidentiary unit away from the content-addressed nodes that anchor the model.

## Consequences

- **Spec amendments (deferred to a spec session; this ADR makes the decisions, the spec text follows — boot discipline "full spec text may defer; the decision should not"):**
  - **§8.12.1 (sub-type table)** gains an `attestation/revises/v1` row (`lifecycle — version succession`; `publisher-only`; payload `targetNodeId`, `successorNodeId`) and a one-line contrast with `supersedes` (succession vs. correction).
  - **§8.10** gains a lineage subsection distinguishing `revises` (neutral succession; prior revision stays valid) from `supersedes` (corrective replacement), and a statement that the diff between two revisions is a derivable human view, not a signed object.
  - **§8.1 (envelope fields)** gains the optional `vcsRef` field as a content-family signed self-declaration with verify-on-fetch + mismatch-is-informative semantics, cross-referencing the `attestation/locatedAt/v1` precedent (§8.10.2) and the `captureMethod`-weighting note.
  - **§8.12.1 / §8.9** descriptive uses of "committed → published" (e.g. the `publishes/v1` row, the admin-approve example) are updated to "sealed → public" when the spec text is next amended. The §A.1 three-orthogonal-dimensions framing (visibility / lifecycle status / host display) is added to §8.10 so `withdrawn`/`superseded` are not read as visibility values.
  - **Schema version unchanged** (stays `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec)): `attestation/revises/v1` is an open-enum addition and `vcsRef` is an optional field; pre-existing packages remain verifiable byte-identical.
- **Threat-model surface (routed to [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63)).** The attested `vcsRef` introduces a "false binding to external VCS state" forgery surface — a signer asserting a `vcsRef` to a commit that does not exist / is unreachable / does not contain the claimed content. This is an instance of the pre-signing-fabrication class that #63 recognizes in principle but that spec §10.1 does not yet enumerate as a named adversary. #63 should gain a §10.1 row; its mitigation is the verify-on-fetch + mismatch-is-informative + `captureMethod`-weighting framing in Decision B (the signature attests the assertion, not the fact).
- **ADR-0010 relationship.** ADR-0016 *evolves* [ADR-0010](0010-visibility-lifecycle-location-attestations.md); it does not supersede it. ADR-0010's body is left intact per the append-only ADR convention (working method §3); a dated status note on ADR-0010 records that its `committed` visibility state is renamed `sealed` per this ADR §A, and that references to "committed" there should be read as "sealed."
- **Open-questions registry updates.**
  - **[Q49](../architecture/open-questions.md#q49--lifecyclevisibility-model-vs-a-vcs-native-git-versioned-evidence-notebook-workflow)** moves to **In discussion**, with A/B/C recorded and linked to this ADR. It moves to **Resolved** (Resolution log) when this ADR is Accepted.
  - **[Q14](../architecture/open-questions.md#q14--geographic-and-temporal-scope-nullability)** (residual naming) gains a note that the `committed` → `sealed` visibility-state rename is decided by this ADR (decision level; the implementation sweep is post-demo, owned by the Demo-UX chat).
  - **Residual sub-questions** (deferred per the Xanadu doctrine; registered as registry notes if/when an adopter blocks): multi-parent / merge-DAG `revises` lineage; the extended `vcsRef` shape (`provider` discriminator, signed-commit verification); and whether a signed, attributable diff is ever needed (a future `attestation/*` over two nodes).
- **Reference-implementation surface (scoped, not done here; post-demo).**
  - **Naming sweep (A):** `visibilityEnum` (`committed` → `sealed`, `published` → `public`) + DB migration mapping both existing values; `POST /api/evidence` + `/publish` route value handling; TypeScript unions; the `publish-evidence` skill (`ALLOWED_VISIBILITY`, `--visibility`, help text); the UI strings (badge/banner read "Public"/"Sealed"; the "Publish"/"Seal" verbs are unchanged); `docs/api/evidence-publish.md` + `docs/publish-evidence.md`; tests. The API and skill SHOULD accept the legacy values as aliases (`committed` → `sealed`, `published` → `public`) for already-shipped clients and the published skill. A denormalized lifecycle-`status` mirror (`active` / `withdrawn` / `superseded`), parallel to the `visibility` mirror, is the place to surface lifecycle status per §A.1 — kept distinct from `visibility`.
  - **`vcsRef` (B):** add the optional field to the `EvidencePackage` interface + packager; cover it by the existing signature path (no new signing surface); optional verify-on-fetch check in the verifier (mismatch → informative signal).
  - **`attestation/revises/v1` (C):** emission path in the attestation builder; verifier renders the revision chain in lineage order alongside the existing lifecycle chain; the derivable diff view between two nodes.
- **Build-state coloring.** `attestation/revises/v1` and the `vcsRef` field enter at **specified — taxonomy/field registered** once this ADR is Accepted; they reach **built** when the reference implementation ships emission + verify + render. The `sealed` rename is a relabel of a **built** state.

## References

- [ADR-0003](0003-evidence-capture-method.md) — the tamper-evident-label-don't-gatekeep principle and "attests publication, not correctness"; the `captureMethod`-weighting of self-asserted fields (Decision B) follows it.
- [ADR-0004](0004-dathere-captureMethod-variant.md) — the `datHere` content profile + notebook captureMethod; the only level at which the motivating adopter is named.
- [ADR-0006](0006-producer-profile-architecture.md) / [ADR-0011](0011-capturemethod-generalization.md) — the signed-self-declaration + per-profile-vocabulary pattern `vcsRef` joins.
- [ADR-0008](0008-multihash-content-hash.md) — JCS envelope canonicalization + signature chain that covers `vcsRef`.
- [ADR-0009](0009-unified-typed-attestation-primitive.md) — the two-family rule (Decision B's content-vs-attestation placement), the §5 authorization taxonomy, and the §7 open-enum sub-type table (Decision C's `revises` addition + the endorses/corroborates-distinction precedent).
- [ADR-0010](0010-visibility-lifecycle-location-attestations.md) — the platform-first lifecycle/visibility/location model this ADR maps onto the VCS-native workflow; evolved here (the `committed` → `sealed` rename; §A).
- `civic-ai-tools/docs/architecture/typed-standards-specification.md` — §5.1/§5.2 (surface-signals normative preamble; production-process-attestation-not-truth), §8.1 (`vcsRef`), §8.10/§8.12.1 (lifecycle/location + sub-type table), §10.1/§10.2 (threat model).
- `civic-ai-tools/docs/architecture/open-questions.md` — [Q49](../architecture/open-questions.md#q49--lifecyclevisibility-model-vs-a-vcs-native-git-versioned-evidence-notebook-workflow) (resolved at the decision level here), [Q14](../architecture/open-questions.md#q14--geographic-and-temporal-scope-nullability) (residual naming).
- [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) — threat-model documentation; gains a §10.1 row for false-binding-to-external-VCS-state.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied: additive, optional, adopter-motivated; residual sub-questions sent to the registry, not pre-specified.
- `civic-ai-tools/docs/architecture/working-method.md` — registry-as-front-door (Q49 is the registered question; this ADR is its decision-level resolution) and the append-only ADR convention (ADR-0010 amended via a dated status note, not a body rewrite).
