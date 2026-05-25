# ADR-0009: Unified typed-attestation primitive — one structural envelope, two top-level type families

- **Status:** Proposed
- **Date:** 2026-05-25
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

The G1 envelope-shape cohort ([ADR-0007](0007-content-canonicalization.md) + [ADR-0008](0008-multihash-content-hash.md)) named the off-log content's canonicalization rule via `contentCanonicalization`, committed envelope-level canonicalization to RFC 8785 JCS, and reshaped `contentHash` as a multihash digest set. The cohort sharpens *how* a single signed envelope carries a payload and how a verifier checks it. It does not, however, name *what kinds of payloads exist* or how a payload of one kind references a payload of another.

The `typed-standards-proposal.md` §6 typed-node ontology has carried the four-family framing (content / hosts / tools-methods / attestations as peers) since 2026-05-21. The strategic memo of 2026-05-25 (`docs/architecture-incorporation-memo-2026-05-25.md` §3 finding #3 + §5 sequencing items 2 + 3 + §7 side-note) named the demote: the four families collapse to **two top-level type families over one structural primitive**. The distinguishing rule is semantic — `content/*` nodes are standalone assertions; `attestation/*` nodes are assertions *about another node identified by `nodeId`*. Hosts, tools, certifying bodies, and attestation kinds become sub-types of one of the two families per the Q36 collapse table; none warrant a separate top-level family.

The structural-primitive framing is not new design surface. The G1 cohort already specified most of the primitive's fields (envelope hash, content hash, content canonicalization, signature mechanics, timestamp, transparency-log inclusion proof). What ADR-0009 adds at the envelope level is small: a `type` URI field declaring which family + sub-type the node carries, a `signer` object carrying identity binding (resolving [Q35](../architecture/open-questions.md#q35--public-key-location-in-the-envelope-sig-vs-signer-and-verifier-cross-check-rule)), and the formal articulation that the existing envelope hash IS the `nodeId` that relations target (resolving the memo §3 finding #3 two-identifier formalization). Beyond those three small primitives, the ADR is taxonomy work: it ratifies the [Q36](../architecture/open-questions.md#q36--attestation-sub-type-collapse-regular-family-or-structured-hierarchy) candidate sub-type table, names the sub-type URI format, articulates the authorization-rule taxonomy each `attestation/*` sub-type carries, and absorbs [Q11](../architecture/open-questions.md#q11--typed-claims-as-a-kind-of-attestation) (typed claims as attestation) + [Q12](../architecture/open-questions.md#q12--attestations-as-the-implementation-path-for-upstream-evidence-references) (upstream-evidence as attestation) into the new framing as direct consequences.

Three adopters are blocked without the cohort:

**datHere** (publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md); the Pittsburgh / WPRDC pilot integration partner). Their pipeline emits notebook-shaped content packages and is preparing to emit publication-records, location-records, and withdrawal-records that reference their content packages cross-host. Today, "the package hash" overloads identity (what relations target) and payload-fingerprint (what verifiers recompute). The cohort's structural primitive disambiguates: relations target `nodeId`; payload checks compare against `contentHash`. The two-family taxonomy gives them a stable namespace for their attestation emissions (`attestation/withdraws/v1`, `attestation/locatedAt/v1`, etc.) under the same trust registry without inventing per-emission field-sets.

**A second prospective collaborator in early discussions.** Different content shape (already named via `contentCanonicalization` per ADR-0007), same envelope contract, same need to emit attestations on others' content (notably location-attestations for cross-host backup mirroring) without forking the spec.

**A third prospective collaborator in early discussions.** Same structural story. Two collaborators on the same scope motivates the cohort as cross-sector portable rather than n=1 / datHere-shaped.

The Xanadu gate is satisfied. Three named adopters are blocked on the same structural property — multi-publisher reality requires explicit identity binding (Q35), unambiguous reference semantics (nodeId), and a stable attestation namespace (the Q36 table). The cohort reduces all three adopters' pipelines to the same envelope contract without forcing any of them to conform to the others' content shapes or invent per-implementation attestation vocabularies.

This ADR closes Q11, Q12, Q35, Q36 (via the candidate table ratification below), and [Q38](../architecture/open-questions.md#q38--dedicated-copyof-relation-vs-multiple-locatedat-attestations). It does NOT close [Q37](../architecture/open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces) (type-registry mechanism), which stays Xanadu-gated until a second sector needs to register a new sub-type.

This ADR is structural framing + sub-type taxonomy registration. Operationalizing specific sub-types (the withdrawal-lifecycle implementation, the location-as-attestation implementation, the publication-record flow per [Q20](../architecture/open-questions.md#q20--visibility-lifecycle-and-attestpublish-semantics) / [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71)) lands in subsequent ADRs per the strategic memo §5 sequencing item 4.

This ADR is also consistent with [Q15](../architecture/open-questions.md#q15--external-verification-testing) staying the top priority gate: the cohort makes Q15 more reachable (embedded proofs via location-as-attestation, sharper relation semantics for cross-host verification), but shipping the cohort is not a substitute for actually running the external-verification test. The test stays scoped as a follow-on milestone, not a side-effect of this ADR.

## Decision

Specify the structural primitive that underlies both `content/*` and `attestation/*` families; ratify two top-level type families with a clear distinguishing rule; formalize `nodeId` and `contentHash` as two distinct identifiers with a verifier cross-check; split public-key location from signer identity binding (resolves Q35); name the authorization-rule taxonomy each `attestation/*` sub-type declares; commit to the sub-type URI format; ratify the Q36 candidate sub-type table with three explicit refinements; and absorb Q11 + Q12 into the new framing as direct consequences.

### 1. The structural primitive

Every conformant signed node in the system — whether `content/*` or `attestation/*` — is a signed envelope over a typed payload, with the following structural-primitive fields:

- **`type`** (URI; **required** post-ADR-0009; pre-ADR-0009 packages interpreted as `content/analysis/v1` per §9 below). Identifies the node's family + sub-type. Per §6 below.
- **`nodeId`** (derived; NOT a stored field). The envelope hash per [ADR-0008](0008-multihash-content-hash.md) §6 IS the `nodeId` by construction. Per §3 below.
- **`contentHash`** (multihash digest set). Fingerprints the off-log payload per [ADR-0008](0008-multihash-content-hash.md) §1.
- **`contentCanonicalization`** (URI). Names the rule by which off-log payload reduces to bytes per [ADR-0007](0007-content-canonicalization.md).
- **Signature envelope** (`sig`-equivalent). Public key, algorithm, kid, signature bytes per OES §6.1. Per §4 below.
- **`signer`** (object; **recommended** post-ADR-0009). Identity binding for the party who signed the node. Per §4 below.
- **Timestamp** (RFC 3161 trusted timestamp; SHOULD per OES §6.2).
- **Transparency-log inclusion proof** (Sigstore Rekor entry id + proof; SHOULD per OES §6.2).
- **`metadata`** (object). `schemaVersion`, `packageId`, `createdAt`, `signingKeyId` per OES §4.2.

Sub-type-specific payload fields live alongside the structural primitive at the canonical-JSON top level. For `content/analysis/v1` (the current default) those are `prompt`, `queries`, `dataSources`, `cost`, `skillMetadata`, `output`, `trace`, `summary`, `provenance`, `extensions`, etc. per OES §4. For `attestation/*` sub-types the payload carries `targetNodeId` plus sub-type-specific fields per the Q36 table in §7. The structural primitive is type-agnostic; payload fields are type-specific.

`captureMethod` ([ADR-0003](0003-evidence-capture-method.md)), `contentProfile` ([ADR-0004](0004-dathere-captureMethod-variant.md)), `producerProfile` ([ADR-0006](0006-producer-profile-architecture.md)) remain at the canonical-JSON top level for the node types that carry them (today: all of them apply to `content/analysis/v1`; their applicability to `attestation/*` sub-types is per-sub-type per future ADRs).

### 2. Two top-level type families: `content/*` and `attestation/*`

Every conformant signed node belongs to exactly one of two top-level families, distinguished by the `type` URI's first path segment:

- **`content/*`** — **standalone assertion.** The node asserts something the signer takes responsibility for (an analysis, a claim, a question, a notebook, a host's identity, a tool's declaration). It does not reference another node as the *subject* of its assertion. It MAY cite or reference other nodes via PROV-O-style `wasDerivedFrom` provenance, but those references are upstream provenance, not the assertion's subject.

- **`attestation/*`** — **assertion about another node.** The node carries a `targetNodeId` referencing the node it asserts about. It does not stand alone; without its target the assertion has no subject. Sub-types include lifecycle attestations (`withdraws`, `reinstates`, `supersedes`, `publishes`), reference attestations (`locatedAt`, `wasDerivedFrom`, `answersQuestion`, `supportedBy`, `opposedBy`, `extractsTo` [merged — see §7]), claim-to-claim attestations (`corroborates`, `contradicts`, `endorses`), and authority-bearing attestations (`certifies`, `evaluates`, `conforms`).

The distinguishing rule is the presence (or absence) of a `targetNodeId` field on the payload. A `content/*` node MUST NOT carry a `targetNodeId`. An `attestation/*` node MUST carry at least one `targetNodeId` (some sub-types reference multiple targets, e.g., `attestation/supersedes/v1` carries both the prior node and the successor node).

The rule replaces the four-families-as-peers framing (typed-standards-proposal §6 pre-ADR-0009). Hosts are not a separate family — their self-declarations are `content/host/v1` or `content/hostPolicy/v1`; their endorsements of others' content are `attestation/endorses/v1`. Tools / certifying bodies are not a separate family — a tool author's declaration is `content/tool/v1`; a certifying body's attestation about a tool is `attestation/certifies/v1`. The two-family framing is more cross-sector portable than four-families-as-peers and matches the structural collapse the Q36 candidate table revealed.

### 3. `nodeId` vs. `contentHash` — two-identifier formalization

The strategic memo §3 finding #3 named the cleaner distinction:

- **`nodeId`** = hash of the **unsigned envelope** = the [ADR-0008](0008-multihash-content-hash.md) §6 envelope hash by construction. Relations target `nodeId`. `nodeId` is the node's stable identity in the system.
- **`contentHash`** = fingerprint of the **off-log payload**, canonicalized per [ADR-0007](0007-content-canonicalization.md) and serialized as a multihash digest set per [ADR-0008](0008-multihash-content-hash.md). Payload integrity checks compare against `contentHash`.

`nodeId` is a derived value, NOT a separately-stored field — it is computed from the canonical envelope at verify time. Pre-ADR-0009 packages' `nodeId` is computed against the legacy `JSON.stringify` insertion-order rule per [ADR-0008](0008-multihash-content-hash.md) §4; post-ADR-0009 packages' `nodeId` is computed against the JCS-canonicalized envelope per [ADR-0008](0008-multihash-content-hash.md) §6. Either way the computation is deterministic from the envelope.

A verifier processing a node with a relation field (`targetNodeId`) and an off-log payload (with `contentHash`) MUST cross-check both identifiers:

1. **`nodeId` cross-check.** Recompute the envelope hash per [ADR-0008](0008-multihash-content-hash.md) §6 (or the legacy rule for pre-ADR-0008 packages). The result MUST equal the URL slug, the stored envelope hash, and (for any node referencing this one by relation) the `targetNodeId` field of the referencing attestation. A `targetNodeId` that does not resolve to a known envelope hash is `unknown_target_node`; surface SHOULD render the attestation but flag the unresolved reference.
2. **`contentHash` cross-check.** Apply the resolved `contentCanonicalization` rule to the off-log payload; multi-hash per algorithms in `contentHash` per [ADR-0008](0008-multihash-content-hash.md) §3. At-least-one-match per [ADR-0008](0008-multihash-content-hash.md) §3.

Pre-ADR-0009 packages did not carry an explicit `nodeId` concept — the URL slug + DB-row `packageHash` served both roles. Post-ADR-0009 the conceptual distinction is fixed: relations point at `nodeId` (envelope identity); payload checks compare against `contentHash` (payload fingerprint). The two identifiers may share underlying SHA-256 bytes for legacy packages (the envelope-hash and the package-hash were the same value pre-ADR-0008); post-ADR-0008, the two are structurally distinct (envelope-hash is JCS-canonicalized envelope; contentHash is multihash over canonicalized off-log payload).

### 4. Public-key location split — `sig` carries key, `signer` carries identity binding (resolves Q35)

The current OES §6.1 signature envelope carries `signature`, `publicKey`, `algorithm`, `kid` as one bundle. Identity binding lives implicit in the trust registry (kid → publisher). With multiple publishers running their own trust registries the implicit binding is no longer sufficient — a kid swap could appear under a mismatched identity claim with no spec text saying that's malformed.

ADR-0009 splits the existing envelope structure into two conceptual roles, both signature-covered:

- **`sig` (the signature envelope per OES §6.1)** carries `signature`, `publicKey`, `algorithm`, `kid`. Shape and computation are unchanged from OES §6.1 post-[ADR-0008](0008-multihash-content-hash.md) §7. This is *what was signed and by what key*.
- **`signer` (new object on the canonical JSON top level)** carries identity binding for the party the signer claims to be. Required fields: `bindingTier` (one of `pseudonymous`, `oauth`, `orcid`, `did-web`, `notarized` per the OES §8 graded identity ladder; extensible per Q3), `identifier` (provider-prefixed string, e.g., `github:npstorey:32192847` or `did:web:datahere.io:publishers:alice`), `displayName` (human-readable identity label). Optional fields: `verifiedAt` (ISO-8601; when the binding was verified). The `signer` object is part of the canonical JSON and is therefore covered by the envelope hash and the platform signature.

A verifier MUST cross-check that the `sig`-embedded `kid` resolves via the publisher's trust registry to the same identity the `signer` field claims. The trust registry's per-key entry gains a `signerIdentity` field documenting which identity each `kid` is bound to; a future revision lands the registry-side schema change. A mismatch between `sig.kid → trust-registry-recorded identity` and the envelope's `signer.identifier` MUST cause the verifier to report `signer_identity_mismatch` and reject the node.

The fully-fleshed-out per-tier identity-binding schemas (what `signer.identifier` looks like for `orcid`, `did-web`, `notarized`) are out of scope for this ADR and stay tied to [Q3](../architecture/open-questions.md#q3--first-non-github-identity-provider) (first non-GitHub identity provider). ADR-0009 establishes the placement, the split, and the cross-check rule. Per-tier schemas land when adopters need them.

Pre-ADR-0009 packages do not carry an explicit `signer` field. Verifiers treat them as `signer = { bindingTier: "legacy_embedded", identifier: "<from trust registry kid>", displayName: "<from trust registry record>" }` and apply no mismatch check (there is no envelope-side claim to cross-check against). This preserves byte-identical verification for existing packages.

### 5. Authorization rule taxonomy

Each `attestation/*` sub-type declares which **authorization rule** it requires of its signer. The taxonomy has three categories at minimum:

- **`publisher-only`** — the signer of the attestation MUST be the publisher of the target node (i.e., the attestation's `signer.identifier` MUST equal the target node's `signer.identifier`, OR a delegated-publisher relationship MUST be in effect per a future ADR). Applies to lifecycle attestations where the target's publisher has unique authority — `attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/supersedes/v1`. The publisher's authority is bounded to their own published artifact's lifecycle (per the retention-asymmetry property statement in the memo §3 finding #4; lands in the visibility/lifecycle/location ADR per memo §5 item 4).
- **`any-with-binding`** — any signer with an identity binding of at least pseudonymous tier MAY emit this attestation. Applies to claim-to-claim attestations (`corroborates`, `contradicts`), to location attestations (`locatedAt`), and to derivation attestations (`wasDerivedFrom` when the signer is the deriver). Consumer-side filtering on `signer.bindingTier` is the right place to discriminate strong vs. weak signals.
- **`specific-role-required`** — the signer MUST satisfy a sub-type-specific role declaration (e.g., a certifying body for `attestation/certifies/v1`, an evaluator with declared methodology + binding tier for `attestation/evaluates/v1` per [Q26](../architecture/open-questions.md#q26--valid-evaluator-definition-identity-binding--methodology-declaration), an authority-bearing party for `attestation/endorses/v1`). The specific role's definition lives in the sub-type's own ADR or in the OES amendment that promotes it.

Each `attestation/*` sub-type declares its authorization rule in the sub-type's own normative section. The Q36 table in §7 below documents the v0.1 rule per sub-type.

Future authorization rules may be added (e.g., `delegated-publisher` for the publication-record flow per [Q20](../architecture/open-questions.md#q20--visibility-lifecycle-and-attestpublish-semantics); host-policy-required for adversarial-eval-gated publications per [Q25](../architecture/open-questions.md#q25--adversarial-evaluation-requirement-strength-on-publication-records)). The three categories above are the minimum spine; sub-types extend.

### 6. Sub-type URI format

Sub-type URIs use the form:

- `content/<noun>/v<N>` for `content/*` sub-types
- `attestation/<verb>/v<N>` for `attestation/*` sub-types

Examples: `content/analysis/v1`, `content/claim/v1`, `attestation/withdraws/v1`, `attestation/locatedAt/v1`.

Sub-types are an open enum; new sub-types arrive via subsequent ADRs that name the motivating adopter per the Xanadu doctrine. URIs MAY be resolved to fully-qualified `https://typedstandards.org/...` forms by reading convention; the bare `<family>/<verb-or-noun>/v<N>` form is normative for the `type` field value. Verifier behavior on encountering an unknown sub-type URI follows the [ADR-0007](0007-content-canonicalization.md) §3 pattern — render `unknown_type` rather than failing verification outright, preserving the OES §2 normative preamble's "surface signals, don't compute platform-issued verdicts" posture.

The mechanism for registering, deprecating, mirroring, or governing sub-type URIs across implementations stays Xanadu-gated per [Q37](../architecture/open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces). ADR-0009 specifies the URI format; the registry mechanism lands when a second sector needs to register a new sub-type.

### 7. Q36 candidate sub-type table — ratification + three refinements

The v0.1 sub-type table per [Q36](../architecture/open-questions.md#q36--attestation-sub-type-collapse-regular-family-or-structured-hierarchy)'s candidate, with three explicit refinements made in this ADR:

| Sub-type | Relation kind | Authorization rule | Payload (beyond structural primitive) |
|---|---|---|---|
| `attestation/withdraws/v1` | lifecycle (publisher → status: withdrawn) | publisher-only | `targetNodeId`, `reason` (required, non-empty), `effectiveAt` (defaults to envelope timestamp) |
| `attestation/reinstates/v1` | lifecycle (publisher → status: active after withdrawn) | publisher-only | `targetNodeId`, `priorWithdrawalNodeId`, `reason` (optional) |
| `attestation/supersedes/v1` | lifecycle + claim-to-claim (old → new) | publisher-only (typically same publisher) | `targetNodeId` (old), `successorNodeId` (new) |
| `attestation/publishes/v1` | lifecycle (committed → published; transitions visibility) | publisher-only OR delegated-publisher per Q20 | `targetNodeId`, `publicationHost`, `releasedAt` |
| `attestation/locatedAt/v1` | location pointer (content available at URI) | any-with-binding | `targetNodeId`, `uri`, `contentHash` (multihash; SHOULD match target's contentHash; mismatch is informative — content drift), optional `contentLength`, optional `availability` |
| `attestation/corroborates/v1` | claim-to-claim agreement | any-with-binding | `targetNodeId`, `scope`, `reasoning` (optional) |
| `attestation/contradicts/v1` | claim-to-claim disagreement | any-with-binding | `targetNodeId`, `scope`, `reasoning` (optional) |
| `attestation/endorses/v1` | claim acceptance by authority-bearing party | specific-role-required (authority-bearing) | `targetNodeId`, `scope` |
| `attestation/wasDerivedFrom/v1` | derivation pointer (PROV-O semantics) | any-with-binding (the deriver) | `targetNodeId` (source), `derivationMethod` (object; when source is `content/analysis/v1` with `untyped` content and target is a typed content sub-type, `derivationMethod` MUST carry an `AnalyticalDerivation` per the classification-laundering guard, see refinement below) |
| `attestation/answersQuestion/v1` | claim → question pointer | any-with-binding (the asserter) | `targetNodeId` (question) |
| `attestation/supportedBy/v1` | claim → evidence pointer | any-with-binding (the asserting publisher) | `targetNodeId` (evidence) |
| `attestation/opposedBy/v1` | claim → evidence pointer | any-with-binding (the asserting publisher) | `targetNodeId` (evidence) |
| `attestation/certifies/v1` | tool / method authority-bearing | specific-role-required (certifying body) | `targetNodeId` (tool / method), `certificationScheme`, `validityWindow` |
| `attestation/evaluates/v1` | claim evaluation | specific-role-required (evaluator with methodology + bindingTier per Q26) | `targetNodeId`, `methodology`, `scoringRubric`, `results` |
| `attestation/conforms/v1` | claim conformance pointer | self-attestation OR specific-role-required (third-party) | `targetNodeId`, `standardId` |

Corresponding `content/*` sub-types ratified for v0.1:

- `content/analysis/v1` — the current default content shape (legacy + datHere); the `untyped` analysis output of an AI-Assisted Analysis Producer Profile (per ADR-0006 §4)
- `content/claim/v1`, `content/question/v1`, `content/evidence/v1` — typed-content sub-types per typed-standards-proposal §6 (reserved name-only; promotion gated on first typed-content producer)
- `content/host/v1` — host identity declaration (host's own identity claim about itself; per Q22)
- `content/hostPolicy/v1` — host's policy declaration (per Q22)
- `content/hostTermsOfUse/v1` — host's ToU declaration (per Q22)
- `content/tool/v1` — tool / method declaration by its author

**Three refinements in this ADR:**

**(a) `extractsTo` merges into `attestation/wasDerivedFrom/v1`.** The candidate table proposed `extractsTo` as a separate sub-type for the untyped → typed extraction step (per typed-standards-proposal §6 / ADR-0006 §4 classification-laundering guard). On reflection, `extractsTo` is structurally identical to `wasDerivedFrom` — same relation kind (derivation pointer), same authorization (the deriver), differs only in what `derivationMethod` content carries. Merging preserves PROV-O alignment without losing the classification-laundering guard: when the source is `content/analysis/v1` with `metadata.contentType: ["untyped"]` and the target is a typed-content sub-type, the `attestation/wasDerivedFrom/v1` MUST carry an `AnalyticalDerivation` describing the extraction method (which model performed the typing, against what prompt, over which source span). The MUST-carry rule encodes the guard at the sub-type level without a separate sub-type URI.

**(b) `attestation/endorses/v1` and `attestation/corroborates/v1` stay distinct sub-types.** Both target claims, both have similar payload shape, but they encode meaningfully different signals: corroboration is peer attestation ("I independently agree"); endorsement is institutional vouching ("we, as an authority, vouch for this on the record"). The authorization-rule axis alone doesn't capture the difference — a high-bindingTier corroborator is still a peer, not an institutional endorser. Two distinct sub-types preserve two distinct filter axes for consumers.

**(c) Q38 — `locatedAt` suffices, no `copyOf` sub-type.** Already resolved-on-arrival per the strategic memo §3 finding; this ADR ratifies. Multiple `attestation/locatedAt/v1` from different `(signer.identifier, uri-authority)` pairs sufficiently express "the content has independent durable copies." A dedicated `copyOf` sub-type would add nothing structural — the location-as-attestation pattern naturally accommodates backup hosts emitting their own location-attestations. Q38 moves to Resolution log.

### 8. Closure of Q11 and Q12

**Q11 — typed claims as a kind of attestation.** The unified-primitive framing refines Q11's original direction. Typed claims (TrendClaim, ComparisonClaim, ObservationClaim, etc. per the existing Civic Claim Vocabulary draft) are `content/*` sub-types (`content/claim/v1`), not `attestation/*` sub-types — they are standalone assertions the producer takes responsibility for. The attestation pattern lives in the **derivation step** that produced typed claims from untyped content: `attestation/wasDerivedFrom/v1` with an `AnalyticalDerivation` payload (per the §7 refinement (a) above and per ADR-0006 §4). The Q11 closure is therefore: typed claims are content; the typed-claims-as-attestation insight resolves as "the attestation is the relation, not the claim itself." Q11 moves to Resolution log; issue [006](https://github.com/npstorey/civic-ai-tools-website/blob/main/docs/proposed-issues/006-typed-claims-as-attestation-reframe.md) closes as obsolete (the reframe lands here, not as a separate engineering issue).

**Q12 — attestations as the implementation path for upstream-evidence references.** The upstream-evidence relation vocabulary (`derived_from`, `compares_to`, `extends`, `replicates`, `contradicts`, `evaluates`) maps directly to the Q36 attestation sub-type table:

- `derived_from` → `attestation/wasDerivedFrom/v1`
- `compares_to` → `attestation/corroborates/v1` or `attestation/contradicts/v1` (depending on the relation direction)
- `extends` → `attestation/wasDerivedFrom/v1` with `derivationMethod` indicating extension semantics (not a separate sub-type)
- `replicates` → `attestation/corroborates/v1` or `attestation/contradicts/v1` (a re-publication that ran the same analysis and got similar / different results); Q38 already confirmed `locatedAt` suffices for "durable copy" rather than replication
- `contradicts` → `attestation/contradicts/v1`
- `evaluates` → `attestation/evaluates/v1`

OES §12 (reserved space for an `upstream-evidence.json` companion file) is therefore obsolete in the new framing. Cross-package corroboration, citation graphs, and meta-analysis are expressed as separately-signed `attestation/*` nodes referencing targets by `nodeId`; no separate companion file is needed. Q12 moves to Resolution log; issue [007](https://github.com/npstorey/civic-ai-tools-website/blob/main/docs/proposed-issues/007-attestation-as-upstream-evidence.md) closes as obsolete.

### 9. Backwards compatibility for pre-ADR-0009 packages

Pre-ADR-0009 packages do not carry the `type` field or the `signer` object. Verifiers treat them as follows:

- **Implicit `type`.** Pre-ADR-0009 packages are interpreted as `content/analysis/v1`. The OES §4 field shape (prompt, queries, dataSources, cost, skillMetadata, output, trace, summary, contentProfile, producerProfile, contentHash, contentCanonicalization, provenance, extensions) maps to the `content/analysis/v1` payload schema by construction. No re-hashing, no migration.
- **Implicit `signer`.** Pre-ADR-0009 packages do not carry an envelope-side identity claim. Verifiers derive `signer` from the trust registry's `kid → signerIdentity` entry (when the registry has been updated to carry `signerIdentity` per §4 above) and apply no mismatch check. For pre-trust-registry packages (`legacy_embedded` per OES §6.3), `signer` is unknown; surfaces SHOULD render the package as `bindingTier: "legacy_embedded"`.
- **Implicit `nodeId`.** Pre-ADR-0009 packages' `nodeId` is computed against the legacy `JSON.stringify` insertion-order rule per [ADR-0008](0008-multihash-content-hash.md) §4. Any future attestation referencing a pre-ADR-0009 package targets that legacy-computed `nodeId`.

Post-ADR-0009 packages produced by conformant publishers MUST emit `type` explicitly and SHOULD emit `signer`. The schema version stays at `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec). The field additions are backwards-compatible (existing packages remain verifiable byte-identical).

## Considered and rejected alternatives

- **Keep four families as peers (status quo from typed-standards-proposal §6 pre-ADR-0009).** Rejected. The four-families framing locks in n=1 / civic-shaped-core complexity: every new "kind of thing" (host policies, tool certifications, attestation types) becomes a candidate fifth / sixth family rather than a sub-type of the existing two. The two-family taxonomy + Q36 table demonstrates the collapse is structurally complete and minimal; promoting to four families would build the lock-in the Xanadu doctrine warns against.

- **One family with `type` as a varying axis (no content/* vs. attestation/* distinction).** Rejected. The standalone-assertion vs. assertion-about-another-node distinction is structurally important for verifiers and consumers — an attestation without a target is malformed; a content node with a `targetNodeId` is malformed. Collapsing the two into a single family loses this validation invariant. The semantic distinction also drives different rendering UX (a corroboration renders against its target's detail page; a content node renders standalone) — the two-family framing carries that distinction at the protocol level.

- **Specify the type-registry mechanism in this ADR.** Rejected. The registry mechanism (how sub-type URIs are documented, versioned, mirrored, deprecated, governed across implementations) is itself an open design problem per [Q37](../architecture/open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces); specifying it prematurely is the foundational-layer version of the over-design the Xanadu doctrine exists to prevent. ADR-0009 specifies that sub-types have URIs in a normative format; the registry mechanism lands when a second sector needs to register a new sub-type.

- **Defer Q35 (public-key location split) to its own ADR.** Rejected. Q35 is structurally tied to the unified primitive: the `signer` object is one of the structural-primitive fields, and the verifier cross-check rule is part of the primitive's verification contract. Splitting Q35 into a separate ADR would either delay the unified-primitive ADR (Q35 is one of the structural-primitive fields) or fragment the verification-contract specification across two ADRs. Bundling here keeps the primitive's specification coherent.

- **Specify per-tier identity-binding schemas in this ADR.** Rejected. Per-tier schemas (what `signer.identifier` looks like for `orcid`, `did-web`, `notarized`) are tied to [Q3](../architecture/open-questions.md#q3--first-non-github-identity-provider) (first non-GitHub identity provider) and are blocked on a real adopter needing a specific tier. ADR-0009 establishes the structural shape (`signer` object, `bindingTier` field, `identifier` field, verifier cross-check rule); per-tier schemas land when adopters need them.

- **Promote `extractsTo` as a distinct sub-type instead of merging into `wasDerivedFrom`.** Rejected per the §7 refinement (a) reasoning. The PROV-O alignment is structurally more important than the special-case sub-type, and the classification-laundering guard encodes cleanly at the `derivationMethod` content-shape level (MUST-carry an `AnalyticalDerivation` when source is untyped and target is typed) without minting a separate sub-type URI.

- **Merge `endorses` into `corroborates` with authorization rule as the only varying axis.** Rejected per the §7 refinement (b) reasoning. The semantic distinction between peer attestation and institutional endorsement is real and consumer-meaningful; collapsing them loses a signal that the authorization-rule axis alone doesn't carry. Two distinct sub-types preserve the filter axes.

- **Operationalize specific attestation sub-types in this ADR (the withdrawal-lifecycle implementation, the location-as-attestation implementation, the publication-record flow).** Rejected as scope creep. ADR-0009 is structural framing + sub-type taxonomy registration. Operationalizing specific sub-types involves protocol-level publication flows (per [Q20](../architecture/open-questions.md#q20--visibility-lifecycle-and-attestpublish-semantics)), DB migrations from OES §10's existing withdrawal columns, the publisher-only authorization rule's delegated-publisher extension per Q20, and per-sub-type validation in the route. Those decisions land in the visibility/lifecycle/location ADR per the strategic memo §5 sequencing item 4.

- **Embed the `signer` identity binding inside the existing signature envelope (extend `sig` rather than add a parallel `signer` field).** Rejected. The signature envelope is what the signature mathematically covers via the OES §6.1 chain (`SHA-256(JCS(unsigned envelope))` → hex → UTF-8 → Ed25519ph). Adding identity-binding fields to that envelope would re-mingle "what was signed" (cryptographic) and "who claims to have signed it" (identity) — the conceptual split the memo §3 finding #3 / Q35 explicitly named is between those two roles. Parallel placement (`sig` for cryptographic, `signer` for identity) is the clean separation.

- **Drop OES §15 attestations section entirely and absorb into §4.** Rejected. OES §15 documents the existing `consistency` / `evaluation` / `expert_attestation` artifacts in current implementation. The rewrite path under ADR-0009 is to reframe §15 around the `attestation/*` namespace (consistency / evaluation / expert_attestation map to specific sub-types per the Q36 table) rather than delete it — the rewrite carries the implementation reality forward; the deletion would orphan the existing reference-implementation behavior.

## Consequences

- **OES amendments (paired in the same commit as this ADR).**
  - **§3 (definitions)** gains entries for `nodeId`, `content/*` namespace, `attestation/*` namespace, type URI, `signer` object. The existing `Evidence package` definition is amended to clarify that "evidence package" is now a content `content/analysis/v1` node by default; the broader concept is "signed node."
  - **§4.1 (top-level fields)** gains a `type` row (required post-ADR-0009; implicit `content/analysis/v1` for pre-ADR-0009 packages) and a `signer` row (recommended post-ADR-0009). The existing fields stay at the canonical-JSON top level for `content/analysis/v1` nodes; their applicability to other sub-types is per-sub-type per future ADRs.
  - **§6.1 (signature)** gains a paragraph articulating the `sig` vs. `signer` split and the verifier cross-check rule per §4 above.
  - **§6.3 (trust registry)** gains a `signerIdentity` field in the per-key entry shape per §4 above; rotation runbook update tracked separately.
  - **§13.1 (verification properties — what a verifier can check)** gains the `nodeId` cross-check, the `signer.identifier` ↔ `kid → trust-registry signerIdentity` cross-check, and the unknown-`type` rendering rule.
  - **§15 (attestations)** rewritten to reference the `attestation/*` namespace. The existing kinds (`consistency`, `evaluation`, `expert_attestation`) map to specific sub-types: `consistency` ≈ `attestation/corroborates/v1` or `attestation/contradicts/v1` (depending on the variance result; the variance methodology lives in the attestation's payload); `evaluation` → `attestation/evaluates/v1` with declared methodology per [Q26](../architecture/open-questions.md#q26--valid-evaluator-definition-identity-binding--methodology-declaration); `expert_attestation` → `attestation/evaluates/v1` (when the expert is producing a critique) or `attestation/endorses/v1` (when the expert is vouching).
  - **§12 (upstream evidence references)** moves to obsolete; replaced by §15's reframe around the `attestation/*` namespace per the Q12 closure in §8 above.

- **Typed-standards-proposal amendments (paired in the same commit as this ADR).** Section-specific changes detailed in the companion commit; §3 architecture diagram + prose rewritten around the two-family taxonomy over one structural primitive; §6 entire section rewritten around the structural primitive + two families + the Q36 table (or pointer to this ADR); §8 status section updates host / tool node families from reserved to "absorbed into attestation/* + content/* per Q36 finding"; §9 callouts (typed-node ontology's normative status; producer-profile boundary) resolved.

- **Open-questions registry updates.**
  - **[Q11](../architecture/open-questions.md#q11--typed-claims-as-a-kind-of-attestation)** (typed claims as attestation): moves to Resolution log per §8 above. Issue [006](https://github.com/npstorey/civic-ai-tools-website/blob/main/docs/proposed-issues/006-typed-claims-as-attestation-reframe.md) closes as obsolete.
  - **[Q12](../architecture/open-questions.md#q12--attestations-as-the-implementation-path-for-upstream-evidence-references)** (upstream-evidence as attestation): moves to Resolution log per §8 above. Issue [007](https://github.com/npstorey/civic-ai-tools-website/blob/main/docs/proposed-issues/007-attestation-as-upstream-evidence.md) closes as obsolete.
  - **[Q35](../architecture/open-questions.md#q35--public-key-location-in-the-envelope-sig-vs-signer-and-verifier-cross-check-rule)** (public-key location split): moves to Resolution log per §4 above.
  - **[Q36](../architecture/open-questions.md#q36--attestation-sub-type-collapse-regular-family-or-structured-hierarchy)** (attestation sub-type collapse): moves to Resolution log; candidate table ratified per §7 above with three explicit refinements (extractsTo → merged; endorses/corroborates → distinct; Q38 → locatedAt suffices).
  - **[Q38](../architecture/open-questions.md#q38--dedicated-copyof-relation-vs-multiple-locatedat-attestations)** (copyOf vs multiple locatedAt): moves to Resolution log per §7 refinement (c).
  - **[Q37](../architecture/open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces)** (type-registry mechanism): stays open. Xanadu-gated until a second sector needs to register a new sub-type.
  - **[Q22](../architecture/open-questions.md#q22--host-as-typeable-subject--host-self-attestation-shape)** (host as typeable subject): cross-reference updated to note host self-declarations are `content/host/v1` / `content/hostPolicy/v1` (NOT `attestation/*`); host endorsements of others' content remain `attestation/endorses/v1`. The proposed-issue 008 work picks up under the new framing without structural rework.

- **Schema version unchanged.** Per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec), the schema version stays at `0.1.0`. The `type` and `signer` field additions are backwards-compatible (existing packages remain verifiable byte-identical under the implicit-type and legacy-signer interpretation rules in §9 above).

- **No DB migration.** The reference implementation's `evidence_records` table is unaffected by this ADR. The unified primitive lives in the canonical JSON, not on the DB row. A future DB migration to add `type`, `signer_identifier`, `signer_binding_tier` columns (for index/query convenience) is scoped separately; verifiers compute these values from the canonical JSON until then. The withdrawal-related columns (`withdrawnAt`, `withdrawalSignature`, etc.) stay where they are; the operationalization of `attestation/withdraws/v1` lands in the visibility/lifecycle/location ADR per the strategic memo §5 sequencing item 4 (which closes `civic-ai-tools-website#58` as obsolete in the process — multi-cycle support is free in the attestation framing).

- **Phase 3 implementation surface (scoped, not done here).**
  - Packager extension (`civic-ai-tools-website/src/lib/evidence/packager.ts`): emit `type: "content/analysis/v1"` on every package produced by the current chat-flow / Claude Code paths. Emit a `signer` object derived from the OAuth identity binding (currently GitHub) with `bindingTier: "oauth"`, `identifier: "github:<username>:<id>"`, `displayName: "<displayName>"`. Add `type?: string` and `signer?: SignerIdentity` to the `EvidencePackage` interface.
  - `/api/evidence` route (`civic-ai-tools-website/src/app/api/evidence/route.ts`): accept `type` in request body (default `content/analysis/v1`); accept `signer` in request body (default-fill from the authenticated session identity); validate the consistency invariant (`signer.identifier` MUST match the authenticated session's identity binding); return `400` on mismatch.
  - Verify route (`/api/evidence/[slug]/verify`): read `type` and `signer` from the package; cross-check `sig.kid` against the trust-registry-recorded `signerIdentity` per §4 above; report `signer_identity_mismatch` on mismatch.
  - Trust registry (`civic-ai-tools-website/public/.well-known/evidence-public-keys.json`): add `signerIdentity` field per entry per §4 above; rotation runbook update (`civic-ai-tools-website/docs/key-rotation.md`).
  - Detail page (`civic-ai-tools-website/src/app/evidence/[slug]/page.tsx`): surface the `type` label near the existing `captureMethod` / `contentProfile` / `producerProfile` labels (all tamper-evident production-discipline labels). Surface the `signer.bindingTier` near the existing identity binding display.

- **Sister ADRs.**
  - The future visibility/lifecycle/location ADR (anticipated from [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71)) operationalizes specific `attestation/*` sub-types — `attestation/withdraws/v1`, `attestation/reinstates/v1`, `attestation/publishes/v1`, `attestation/locatedAt/v1` — and carries the OES §10 reframe (status-as-attestation; retention-asymmetry property statement; multi-cycle support free by construction). That ADR depends on ADR-0009 for the sub-type taxonomy.
  - The future captureMethod-generalization OES amendment + ADR-0006 §5 guidance-bundle update per the strategic memo §5 sequencing item 5 is independent of ADR-0009; the two land separately.
  - The future adversarial-eval requirement model ADR (anticipated from [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72)) operationalizes `attestation/evaluates/v1` as a publication gate per Q25 + Q26 and depends on ADR-0009 for the attestation framing.

- **Build-state coloring.** The structural primitive (envelope mechanics including the `type` field and `signer` object) enters `end-state-vision.md` at the "specified" build state once this ADR is Accepted; it moves to "built" when Phase 3 IMPL ships the packager + route + verify + trust-registry changes. The `content/*` sub-types ratified in §7 enter at "specified" with `content/analysis/v1` immediately "built" (the existing implementation IS the first realized sub-type). The `attestation/*` sub-types enter at "specified" (taxonomy registered) but stay at "specified" (not "built") until the visibility/lifecycle/location ADR and downstream ADRs operationalize them.

- **API documentation.** `civic-ai-tools-website/docs/api/evidence-publish.md` gains a section documenting the optional `type` request field (default `content/analysis/v1`), the optional `signer` request field (default-filled from session identity), and the consistency invariants documented as `400` failure modes.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the tamper-evident labeling principle (covered by canonical JSON + platform signature) that this ADR's `type` and `signer` fields follow.
- [ADR-0004](0004-dathere-captureMethod-variant.md) — defines the `datHere` content profile; under this ADR's framing, datHere packages are `content/analysis/v1` nodes with `contentProfile: "datHere"` / `producerProfile: "ai-assisted-analysis/datHere"`.
- [ADR-0005](0005-executed-notebook-architecture.md) — defines the executed-notebook architecture within `content/analysis/v1`; orthogonal to the unified primitive.
- [ADR-0006](0006-producer-profile-architecture.md) — establishes the Producer Profile axis; the untyped → typed extraction step's classification-laundering guard (ADR-0006 §4) encodes via the `attestation/wasDerivedFrom/v1` MUST-carry-AnalyticalDerivation rule per §7 refinement (a) above.
- [ADR-0007](0007-content-canonicalization.md) — names the off-log content's canonicalization rule URI; this ADR's `contentHash` cross-check (§3) depends on it.
- [ADR-0008](0008-multihash-content-hash.md) — specifies multihash `contentHash`, RFC 8785 JCS envelope canonicalization, and the signature chain; this ADR's `nodeId` (§3) IS the [ADR-0008](0008-multihash-content-hash.md) §6 envelope hash by construction.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §3, §4.1, §6.1, §6.3, §12, §13.1, §15 amended in the same workflow.
- `civic-ai-tools/docs/architecture/typed-standards-proposal.md` — §3, §6, §8, §9 amended in the same workflow.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q11, Q12, Q35, Q36, Q38 resolved; Q37 stays Xanadu-gated; Q22 cross-reference updated.
- `civic-ai-tools/docs/architecture-incorporation-memo-2026-05-25.md` — strategic memo §3 finding #3 (nodeId vs contentHash); §5 sequencing items 2 + 3 (this ADR); §7 side-note (Q36 collapse table).
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied: three named adopters blocked on multi-publisher identity binding (Q35), unambiguous reference semantics (nodeId), and a stable attestation namespace (Q36 table). Q37 stays Xanadu-gated.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path from registry to ADR followed (Q11, Q12 had been promoted to proposed-issues 006/007; Q35, Q36, Q38 are registry entries from the 2026-05-25 strategic memo; this ADR resolves all of them).
- `civic-ai-tools-website/docs/proposed-issues/006-typed-claims-as-attestation-reframe.md` — closed as obsolete per §8 above; the reframe lands here.
- `civic-ai-tools-website/docs/proposed-issues/007-attestation-as-upstream-evidence.md` — closed as obsolete per §8 above; the reframe lands here.
