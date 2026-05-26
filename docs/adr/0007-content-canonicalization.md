# ADR-0007: `contentCanonicalization` — sixth envelope field naming the off-log content canonicalization rule

- **Status:** Proposed
- **Date:** 2026-05-25
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

The current Open Evidence Standard §5 specifies the package hash as "the SHA-256 hex digest of the JSON serialization of the evidence-package object" and acknowledges in an "Implementation gap (informative)" callout that the reference implementation relies on Node.js `JSON.stringify` insertion-order determinism, with no commitment to RFC 8785 JCS or an equivalent canonical-JSON standard. The gap surfaces concretely as soon as a second implementation tries to produce the same hash for the same logical content: there is no named rule for how the content's bytes are reduced, only the reference implementation's implicit behavior.

The strategic memo of 2026-05-25 (`docs/architecture-incorporation-memo-2026-05-25.md` §3 finding #1) named the gap and the resolution: canonicalization comes in two kinds. **Envelope-level canonicalization** is a single fixed rule (candidate: RFC 8785 JCS) committed to by the spec — every envelope serializes the same way. **Content-bundle-level canonicalization** legitimately varies per content shape: a datHere A-G/Jupyter notebook bundle reduces differently from a multi-file RO-Crate directory, which reduces differently from a plain single-JSON output. The content-bundle-level rule belongs in a signed envelope field, not a separate document, because base-level verification (recompute `contentHash` and compare) requires the rule to be discoverable from the package itself.

Three adopters are blocked without the field:

**datHere** (publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md); the Pittsburgh / WPRDC pilot integration partner). The pilot's pipeline produces Jupyter notebooks with sibling artifacts (rendered answer, environment metadata, summary, the commitment-view metadata block). Today's reference implementation reduces these to bytes implicitly via Node `JSON.stringify` insertion-order over the canonical-JSON object that embeds them. The integration partner's own implementation runs on different infrastructure with different serialization defaults; without a named canonicalization rule, there is no way for their pipeline to reproduce the reference implementation's package hash for the same logical content. The Phase 2 cross-host publication flow (notebook on a git host, sibling YAML, OES §9.2) cannot deliver consistent verification across implementations until the canonicalization rule is named and stable.

**A second prospective collaborator in early discussions.** Their pipeline produces a different content shape with its own canonicalization characteristics (a multi-file bundle whose internal ordering and inclusion rules differ from datHere's A-G/Jupyter conventions). Without `contentCanonicalization` the collaborator's options today are (a) conform to datHere (forcing their content into a shape that doesn't fit their pipeline), (b) propose a new content profile and a new ADR for every novel shape (high promotion cost per the Xanadu doctrine), or (c) fork the spec. With `contentCanonicalization` the collaborator mints their own rule URI under their own domain and emits conformant packages without a spec fork.

**A third prospective collaborator in early discussions.** Same structural story as the second collaborator — different content shape, different canonicalization rule, same affordance from naming the rule via a URI. Two collaborators on the same scope motivates the field as cross-sector portable rather than n=1 / datHere-shaped.

The Xanadu gate is satisfied. Three named adopters are blocked on the same structural property; the field's introduction reduces all three pipelines to the same envelope contract without forcing any of them to conform to the others' content shapes.

This ADR is one half of a paired cohort. [ADR-0008](0008-multihash-content-hash.md) (landing in the same commit) specifies the multihash digest-set form for `contentHash`, commits the envelope-level canonicalization to RFC 8785 JCS, and updates the signature mechanics. The two ADRs split cleanly at the two-kinds-of-canonicalization seam: ADR-0007 owns the content-level rule (variable, named per `contentCanonicalization`), ADR-0008 owns the envelope-level rule (fixed at JCS), the hash serialization (multihash), and the signature chain that binds them.

## Decision

Add a sixth top-level field `contentCanonicalization` to the evidence-package canonical JSON, name the URI for the datHere A-G/Jupyter canonicalization rule and the legacy default rule, specify verifier semantics for resolving the URI, and define backwards-compatible behavior for pre-ADR-0007 packages. Articulate the relationship to envelope-level canonicalization (committed to RFC 8785 JCS by the paired ADR-0008).

### 1. Field shape, placement, value form

Add `contentCanonicalization` as a top-level field on the canonical-JSON evidence package, alongside the existing top-level fields (`metadata`, `prompt`, `queries`, `dataSources`, `cost`, `skillMetadata`, `output`, `trace`, `summary`, `contentProfile`, `producerProfile`, `provenance`, `extensions`) and the new `contentHash` field introduced by ADR-0008.

- **Type:** string (URI).
- **Placement:** top level on the canonical JSON. Conceptually parallel to `contentProfile` (ADR-0004) and `producerProfile` (ADR-0006); all three at the canonical-JSON top level rather than inside `metadata`, following the placement convention ADR-0004 §1 and ADR-0006 §1 established.
- **Value form:** an absolute URI that identifies a canonicalization rule. The URI is an identifier; resolution semantics (whether the URI resolves to a documentation page, a machine-readable rule definition, both, or neither) are out of scope for this ADR. The URI need not be HTTP-fetchable to be valid as an identifier (HTTPS-URI-as-identifier convention per W3C, in-toto, OpenSSF).
- **Hash + signature coverage:** the field is part of the canonical JSON and is therefore covered by the envelope hash (per ADR-0008 §6) and the platform Ed25519ph signature (per ADR-0008 §7). The canonicalization rule a package declares is itself tamper-evident.

The field is the sixth in the envelope-discipline top-level field set, joining `captureMethod` (ADR-0003), `contentProfile` (ADR-0004), `producerProfile` (ADR-0006), and `contentHash` (ADR-0008 — the renamed multihash form of the legacy package hash), per the strategic memo §3 finding #1's "the envelope goes from five fields to six" framing. The count refers to envelope-discipline fields the memo enumerates, not the count of all top-level fields in the canonical JSON.

### 2. Default value selection — the datHere A-G/Jupyter canonicalization rule

The reference implementation's existing `contentProfile === "datHere"` packages (per ADR-0004 + ADR-0005) follow a specific implicit canonicalization: the A-G envelope content (initial prompt, system prompts, model card + environment, deliberative trace, answer notebook, rendered answer, summary) is embedded in the canonical-JSON evidence package via the existing OES top-level fields, and the entire object is reduced to bytes via Node.js `JSON.stringify` with insertion-order key preservation matching between packager and verify-route. This is the rule the reference implementation has used since ADR-0004 acceptance.

This ADR names that rule:

**`https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1`**

The URI is a stable identifier for the rule. The rule's normative content is the union of OES §9.1 (`datHere` content profile) + ADR-0004 §2 (A-G envelope mapping) + ADR-0005 §2 (executed-notebook discriminator) + this ADR. Future implementations of the datHere content profile MUST name this URI in their `contentCanonicalization` field to declare conformance to the rule. A future v2 rule URI MAY be minted by a subsequent ADR if the bit-for-bit canonicalization needs to be tightened (e.g., switching the rule's internal canonicalization from Node `JSON.stringify` insertion-order to JCS over the A-G content subset for cleaner cross-implementation portability).

A second URI is reserved for the legacy default content profile (pre-ADR-0004 packages and post-ADR-0004 packages with `contentProfile === "default"`):

**`https://typedstandards.org/canonicalization/legacy-json/v1`**

The legacy-default rule's normative content is the reference implementation's pre-ADR-0007 behavior: Node.js `JSON.stringify` insertion-order over the canonical-JSON evidence package object, with no key-sorting transform. The URI exists to give pre-ADR-0007 packages a name for their implicit rule so that post-ADR-0007 verifiers can identify and verify them.

Two URIs are sufficient for v0.1: the existing reference-implementation behavior is captured under `legacy-json/v1`, and the existing datHere profile is captured under `dathere-ag-jupyter/v1`. Future content profiles, future revisions of either rule, and adopter-specific rules each mint their own URIs as ADRs land. The standard does not pre-allocate URIs; the registry mechanism for URI-namespace governance stays Xanadu-gated per [Q37](../architecture/open-questions.md#q37--type-registry-mechanism-and-governance-for-the-content-and-attestation-namespaces).

The `typedstandards.org` host is the project's umbrella name from [`typed-standards-specification.md`](../architecture/typed-standards-specification.md) §3. The URIs identify rules; the typedstandards.org domain need not be operational as an HTTP host for the identifiers to function. If/when the domain becomes operational as a documentation surface (a separately-decided future spec promotion, currently reserved per typed-standards-proposal §3 / §8), the URIs naturally become resolvable; this ADR makes no commitment about that.

### 3. Verifier semantics — URI resolution to canonicalization rule

A verifier processing a package with a `contentCanonicalization` field MUST:

1. Read the URI from the field.
2. Resolve the URI to the canonicalization rule it identifies via the verifier's **local registry** of known rule URIs (a built-in mapping from URI to rule implementation), not via an HTTP fetch. A verifier MAY refuse to verify a package whose URI is not in its local registry; this is a policy decision per the verifier's deployment.
3. Apply the named rule to canonicalize the off-log content into bytes.
4. Multi-hash the canonicalized bytes per ADR-0008 §2's algorithm vocabulary and compare with the package's `contentHash` field per ADR-0008 §3's verifier semantics.

The reference implementation ships a local registry that includes:

- `https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1` (datHere A-G/Jupyter)
- `https://typedstandards.org/canonicalization/legacy-json/v1` (legacy default)

Future rule URIs land in subsequent ADRs (or in adopter-published implementations that maintain their own registries). The standard does not specify how rule URIs are deprecated, mirrored, or governed across implementations; the registry mechanism stays Xanadu-gated per Q37.

A verifier that encounters an unknown URI SHOULD render an `unknown_canonicalization_rule` verdict (analogous to OES §6.3's `unknown_key` keyTrust value for the trust registry) rather than failing verification outright. This preserves the OES normative preamble's "surface signals, don't compute platform-issued verdicts" posture: the consumer chooses whether to trust an unknown-rule package; the verifier reports what it can.

### 4. Backwards-compatibility for pre-ADR-0007 packages

Pre-ADR-0007 packages omit `contentCanonicalization`. Verifiers treat absence as follows:

- **Pre-ADR-0007 datHere packages** (`contentProfile === "datHere"` OR `producerProfile.startsWith("ai-assisted-analysis/datHere")` with no `contentCanonicalization` field): the rule is `https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1`. The existing implementation's behavior IS the v1 rule, so verification passes for existing datHere packages without rehashing.
- **Pre-ADR-0007 default-profile packages** (`contentProfile === "default"` OR `contentProfile` absent, with no `contentCanonicalization` field): the rule is `https://typedstandards.org/canonicalization/legacy-json/v1`. Pre-ADR-0004 packages and current default-profile packages continue to verify under the legacy rule.

A verifier MAY warn that the package omits the field (signaling that the package was produced before ADR-0007). A verifier MUST NOT fail verification solely on the field's absence for packages that would otherwise verify under the legacy default rule. This balances the spec's normative preamble (surface signals; don't fail on missing labels alone) against the integrity claim (the legacy default rule is well-defined; absence is not ambiguity).

Post-ADR-0007 packages produced by conformant publishers MUST emit `contentCanonicalization` explicitly. Absence on a post-ADR-0007 package is a malformed-package condition; verifiers MUST report it.

The schema version stays at `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec). The field's addition is backwards-compatible (optional + interpreted per existing profile fields when absent), preserving byte-identical hashes for pre-ADR-0007 packages.

### 5. Relationship to envelope-level canonicalization (RFC 8785 JCS per ADR-0008)

The two-kinds-of-canonicalization split the strategic memo §3 finding #1 names explicitly is articulated here. **Envelope-level canonicalization** is the rule by which the unsigned envelope (the canonical-JSON object containing all top-level fields, including `contentCanonicalization` and `contentHash` themselves) is reduced to bytes for the envelope hash. That rule is fixed at RFC 8785 JCS per ADR-0008 §6 — there is no envelope-level URI; the rule is normative spec text. **Content-bundle-level canonicalization** is the rule by which off-log content (whatever the package's `contentHash` fingerprints) is reduced to bytes. That rule varies per content shape and is named by the package's `contentCanonicalization` field per this ADR.

The two rules are nested:

1. Off-log content → `contentCanonicalization` rule (this ADR) → bytes → multihash (ADR-0008 §1) → `contentHash` field embedded in the envelope.
2. Unsigned envelope (containing `contentHash`, `contentCanonicalization`, and the other top-level fields) → RFC 8785 JCS (ADR-0008 §6) → bytes → SHA-256 → envelope hash.
3. Signature (Ed25519ph) over the UTF-8 bytes of the envelope-hash hex string per ADR-0008 §7.

Because the signature covers the envelope JCS bytes, and the envelope contains `contentHash` and `contentCanonicalization`, both the off-log content's fingerprint AND the rule by which it was canonicalized are signature-covered. A bad actor cannot rewrite the canonicalization rule after publication without invalidating the signature.

The split is durable through the project's evolution. As the package format evolves toward multi-file (Q1 resolution), the off-log content's bytes become structurally distinct from the envelope's bytes (today, in the single-blob model, the legacy-json/v1 rule treats the entire canonical JSON as the canonicalization input; future rules will treat a directory of sibling artifacts as the input). The envelope-level rule stays JCS regardless of how the content side evolves; the content-level rule's URI evolves per the new content shapes that arrive.

## Considered and rejected alternatives

- **Hardcode the canonicalization rule in the spec text instead of naming it via a URI.** Rejected. Hardcoding works for one content shape (the reference implementation's behavior) but breaks immediately when a second content shape arrives. The integration partner has a different content shape today; subsequent adopters will have more. The URI is the affordance that lets the spec accommodate multiple rules without bundling them all into a single normative section, and it is the natural extension point for future content profiles (RO-Crate per Q1, Data Package Standard per Q18) without re-cutting the canonicalization section of OES §5.

- **Mint URIs under `civicaitools.org` instead of `typedstandards.org`.** Rejected. URIs minted under `civicaitools.org` would tie the rule's identity to the reference implementation's hosting domain, which is conceptually wrong: the rule is part of the spec, not part of any one implementation. The integration partner using a `civicaitools.org`-minted URI would implicitly imply civicaitools.org owns the rule. `typedstandards.org` is the umbrella name from the typed-standards-proposal; the domain's operational status is not required for URI identity.

- **Use URN form (`urn:typedstandards:canonicalization:dathere-ag-jupyter:v1`).** Rejected. URN form is cleaner about "this is an identifier, not a fetch target," but modern standards (in-toto, OpenSSF, W3C) consistently use HTTPS URIs as identifiers; the HTTPS form integrates better with JSON-LD contexts and developer tooling. The HTTPS-URI-as-identifier convention is well-established; URN form would be idiosyncratic without a corresponding benefit.

- **Add `contentCanonicalization` as a sub-field on `contentProfile` instead of as a top-level field.** Rejected. The two-kinds-of-canonicalization split is structurally above the content-profile concept: a single content profile (e.g., datHere) may have multiple canonicalization-rule revisions over time (v1, v2), and a single canonicalization rule may apply to multiple content profiles (e.g., a generic RO-Crate-multifile rule shared by future RO-Crate-using profiles). Top-level placement keeps the two concepts orthogonal and lets each evolve independently.

- **Embed the canonicalization rule's content inline in the envelope.** Rejected. Inlining the rule's normative content into every package inflates package size dramatically and creates a dual-source-of-truth problem (the spec's documented rule vs. each package's inlined rule). A URI is a name; the rule's normative content lives in the OES + ADRs + the rule's documentation, consistent across all packages using the URI.

- **Specify the canonicalization-rule registry mechanism in this ADR.** Rejected. The registry mechanism (how rule URIs are documented, versioned, mirrored, deprecated, governed) is itself an open design problem; per the strategic memo §4 and Q37, specifying the mechanism prematurely is the foundational-layer version of the over-design the Xanadu doctrine exists to prevent. This ADR specifies that canonicalization rules have URIs; how rule URIs get registered across implementations is deferred to a future ADR triggered by a second sector needing to register a rule.

- **Bundle ADR-0007 and ADR-0008 into a single ADR.** Rejected. The two ADRs split cleanly at the two-kinds-of-canonicalization seam; bundling would obscure the structural split. Landing them as a paired cohort in the same commit preserves the split in the ADR record while keeping the OES amendments coherent.

## Consequences

- **OES amendment (paired with ADR-0008 in the same commit).** §3 (definitions) gains a `contentCanonicalization` entry. §4.1 (top-level fields) gains a `contentCanonicalization` row alongside the existing `contentProfile` / `producerProfile` rows. §5 (canonical JSON) is rewritten to articulate the two-kinds-of-canonicalization split, name JCS as the envelope-level rule (per ADR-0008), and reference `contentCanonicalization` for the off-envelope content rule. §13 (verification flow) gains a step for resolving the `contentCanonicalization` URI before recomputing `contentHash`. No normative requirement changes for pre-ADR-0007 packages.

- **Typed-standards-proposal amendment (paired in the same commit).** §4 prose and the §4 mermaid diagram are updated to reflect the new envelope shape: `contentCanonicalization` becomes a new envelope node alongside the existing hash, signature, timestamp, transparency-log, captureMethod, and contentType nodes. The "envelope is content-agnostic" framing is preserved; `contentCanonicalization` is what makes the envelope's content-agnostic property formally-stated rather than implicit.

- **Open-questions registry updates.**
  - **Q34** (JCS for unsigned-envelope canonicalization) moves to the Resolution log with a link to [ADR-0008 §6](0008-multihash-content-hash.md) (where the JCS commitment lands). ADR-0007 is the content-level half of the split; the JCS half lives in ADR-0008.
  - **Q37** (type-registry mechanism) stays open; the canonicalization-rule registry is one motivating case it will eventually resolve.

- **Schema version unchanged.** Per Q27, the schema version stays at `0.1.0`. The `contentCanonicalization` field is an additive optional addition; pre-ADR-0007 packages remain verifiable byte-identical under the legacy default rule (per §4 above).

- **No DB migration.** The reference implementation's `evidence_records` table is unaffected by this ADR; `contentCanonicalization` lives in the canonical JSON, not on the DB row. The packager + verify-route changes are scoped to the JSON shape.

- **Phase 3 implementation surface (scoped, not done here).**
  - Packager extension (`civic-ai-tools-website/src/lib/evidence/packager.ts`): emit `contentCanonicalization` based on the package's content profile (datHere → `https://typedstandards.org/canonicalization/dathere-ag-jupyter/v1`; default → `https://typedstandards.org/canonicalization/legacy-json/v1`). Add `contentCanonicalization?: string` to the `EvidencePackage` interface.
  - `/api/evidence` route: accept `contentCanonicalization` in request body; if absent, default-fill per the package's profile. Validate the URI against the local rule registry; return `400` on unknown URI.
  - Verify route (`/api/evidence/[slug]/verify`): read `contentCanonicalization` from the fetched package; resolve to local rule implementation; apply rule before recomputing `contentHash`. Report `unknown_canonicalization_rule` for unrecognized URIs.

- **Paired with ADR-0008.** Both ADRs land in the same commit. The OES + typed-standards-proposal amendments span both ADRs' decisions; no partial cohort.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the tamper-evident labeling principle (`captureMethod` covered by the canonical JSON and the platform signature) this ADR's `contentCanonicalization` field follows.
- [ADR-0004](0004-dathere-captureMethod-variant.md) — defines the datHere A-G/Jupyter content profile whose canonicalization rule is named in §2 above.
- [ADR-0005](0005-executed-notebook-architecture.md) — defines the executed-notebook discriminator within datHere; the executed-vs-skeleton distinction is orthogonal to canonicalization-rule selection (both forms use the `dathere-ag-jupyter/v1` rule).
- [ADR-0006](0006-producer-profile-architecture.md) — establishes the parallel-axis pattern (`contentProfile`, `producerProfile`) that this ADR's `contentCanonicalization` field follows in placement and signature-coverage convention.
- [ADR-0008](0008-multihash-content-hash.md) — paired ADR. Specifies multihash `contentHash`, commits envelope-level canonicalization to RFC 8785 JCS, and updates signature mechanics. Lands in the same commit.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §3, §4.1, §5, §13 amended in the same workflow.
- `civic-ai-tools/docs/architecture/typed-standards-specification.md` — §4 prose + mermaid amended in the same workflow.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q34 → resolution log via ADR-0008; Q37 stays Xanadu-gated.
- `civic-ai-tools/docs/architecture-incorporation-memo-2026-05-25.md` — strategic memo §3 finding #1 (two-kinds-of-canonicalization split); §5 sequencing item 1 specifies this G1 cohort.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied: three named adopters blocked without the field.
