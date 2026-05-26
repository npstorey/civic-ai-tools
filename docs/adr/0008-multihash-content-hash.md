# ADR-0008: Multihash `contentHash` + RFC 8785 JCS envelope canonicalization

- **Status:** Proposed
- **Date:** 2026-05-25
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

The current Open Evidence Standard §6.1 specifies the package hash as SHA-256 and the signature as Ed25519ph over the UTF-8 bytes of the package-hash hex string. The hash algorithm is hardcoded; algorithm migration (to BLAKE3, SHA-3, future post-quantum alternatives) would require a breaking change to the envelope shape, every existing verifier, and every existing package. The strategic memo of 2026-05-25 (`docs/architecture-incorporation-memo-2026-05-25.md` §3 finding #2) named the gap: the in-toto digest-set convention (`{"sha256": "...", "blake3": "..."}` object shape) is algorithm-self-describing, lets future algorithms join the vocabulary additively, and is the natural resolution path for [Q18](../architecture/open-questions.md#q18--standards-adoption-review-blake3-data-package-standard-dcat-us3-codata-semantic-markdown) (Blake3 evaluation, [civic-ai-tools#67](https://github.com/npstorey/civic-ai-tools/issues/67)).

The current OES §5 also acknowledges an implementation gap in envelope canonicalization: the reference implementation relies on Node.js `JSON.stringify` insertion-order determinism, with no commitment to RFC 8785 JCS or an equivalent canonical-JSON standard. The gap surfaces when a second implementation produces different canonical bytes for the same logical envelope and therefore a different hash. The strategic memo §3 finding #1 named the resolution: commit to RFC 8785 JCS for the unsigned-envelope canonicalization (envelope-level), distinct from content-level canonicalization (named per `contentCanonicalization`, the paired ADR-0007 in this cohort).

These two gaps resolve together as a single envelope-hash-chain ADR. They are inseparable in practice: a verifier needs both the algorithm specification (multihash) AND the canonicalization rule (JCS for the envelope, per-rule for off-log content) to recompute and compare hashes; one without the other leaves a verifier guessing.

Three adopters are blocked without the cohort:

**datHere, a second prospective collaborator in early discussions, and a third prospective collaborator in early discussions** (all named in [ADR-0007](0007-content-canonicalization.md) §Context; datHere publicly named per [ADR-0004](0004-dathere-captureMethod-variant.md), the other two referenced in neutral phrasing per the workspace stakeholder/relationship-content boundary). All three benefit from algorithm agility per the cross-sector positioning: the CKAN ecosystem (per Q18) already uses BLAKE3 for tamper-evident metadata, so a CKAN-adjacent implementation can emit BLAKE3 + SHA-256 dual digests without forcing every other implementation to support BLAKE3 today. Future migrations (government-cryptographic-guidance shifts toward SHA-3, eventual post-quantum-hash migration) become additive enum extensions rather than breaking changes.

The JCS commitment is similarly cross-sector portable: a second implementation of the OES (the integration partner's pipeline, or a third-party verifier) needs a stable canonicalization rule to produce identical canonical bytes for identical logical envelopes. RFC 8785 JCS is the widely-implemented standard (libraries in Node.js, Python, Java, Go, Rust) and the natural choice. Without the commitment, the integration partner's pipeline could produce envelopes that hash differently from the reference implementation's despite carrying the same logical content.

Q18 directly resolves as a multihash-codec-table addition (BLAKE3 registered as an alternate in the v0.1 vocabulary per §2 below) rather than a single-algorithm swap or a separate BLAKE3-specific ADR. The other Q18 candidates (Data Package Standard, DCAT-US3, CODATA semantic markdown) are unrelated to the hash-algorithm question and stay open under Q18's per-candidate evaluation discipline.

The Xanadu gate is satisfied. Three named adopters benefit from algorithm agility; the Q18 promotion of BLAKE3 evaluation provides direct adopter pressure for multihash specifically. The JCS commitment removes a concrete blocker for the integration partner's pipeline.

This ADR is the paired complement to ADR-0007. The two ADRs split at the two-kinds-of-canonicalization seam: ADR-0007 owns the content-level rule (variable, named per `contentCanonicalization`); ADR-0008 owns the envelope-level rule (fixed at JCS), the hash serialization (multihash), and the signature mechanics that chain them together.

## Decision

Specify `contentHash` as a multihash digest set, name the algorithm vocabulary for v0.1, commit envelope-level canonicalization to RFC 8785 JCS, specify the signature mechanics over the JCS-canonicalized envelope hash, and define backwards-compatible behavior for pre-ADR-0008 packages.

### 1. `contentHash` serialization shape

Rename the existing OES "package hash" concept to `contentHash` and change the serialization from a single hex string to a multihash digest set following the in-toto convention:

```json
{
  "contentHash": {
    "sha256": "5b3c8f3a4e7b1c2d0f9a8e7d6c5b4a3928171605f4e3d2c1b0a9988776655443",
    "blake3": "c4e7a2f1b8d3e5a609f7e8d9c0b1a2738495a6b7c8d9e0f1a2b3c4d5e6f70819"
  }
}
```

The field is an object whose keys are lowercase string algorithm names from the v0.1 vocabulary (§2) and whose values are hex digests of the canonicalized content bytes per the rule named by `contentCanonicalization` (ADR-0007).

- **Placement:** top level on the canonical-JSON evidence package. After ADR-0008, the multihash digest set is an envelope field and is therefore covered by the envelope hash (per §6) and the platform Ed25519ph signature (per §7). Pre-ADR-0008 the hash existed externally (in the URL slug + DB row) and was not embedded in the canonical JSON; this ADR embeds it.
- **At least one digest required:** a `contentHash` object MUST contain at least one algorithm entry. A package whose `contentHash` is an empty object is malformed.
- **Hex encoding:** algorithm values are lowercase hex strings without any algorithm prefix or framing.

### 2. Algorithm vocabulary v0.1

The v0.1 algorithm vocabulary:

- **`sha256`** — *required default*. Every conformant package MUST include a `sha256` entry in `contentHash`. SHA-256 remains the universal common denominator: every Ed25519ph implementation, every FreeTSA-compatible timestamp algorithm, Sigstore Rekor's hashedrekord entry type, and existing verifiers assume SHA-256. The required-default rule guarantees that any conformant verifier with SHA-256 support — which is universal — can verify any conformant package.
- **`sha3-256`** — *registered alternate*. SHA-3 family per FIPS 202. Allows publishers operating under cryptographic-guidance regimes that mandate SHA-3 to emit a SHA-3 digest alongside SHA-256.
- **`blake3`** — *registered alternate*. Resolves Q18's BLAKE3 evaluation as a multihash-codec-table addition. CKAN-adjacent implementations (per Q18's adopter pressure) MAY emit `blake3` alongside `sha256` for tamper-evident-metadata compatibility with the CKAN ecosystem.

Future algorithms (SHA-512, post-quantum hashes, BLAKE2 family if needed, etc.) are added by subsequent ADRs that name the motivating adopter per the Xanadu doctrine. The standard does not pre-allocate algorithm slots; each addition is its own promotion.

A package MAY emit multiple algorithm entries (e.g., `sha256` + `blake3`). Multi-algorithm emission is OPTIONAL; the default emission per the reference implementation is `sha256` only. The integration partner's pipeline MAY emit dual digests if BLAKE3 compatibility with their CKAN-side tooling is needed.

### 3. Verifier semantics — at-least-one-match rule

A verifier processing a `contentHash` multihash digest set MUST:

1. Inspect the algorithm entries present in the `contentHash` object.
2. For each algorithm the verifier supports locally, recompute the digest over the canonicalized content bytes (per the `contentCanonicalization` rule, ADR-0007 §3) and compare with the package's listed digest for that algorithm.
3. Confirm AT LEAST ONE listed algorithm matches. The verifier reports which algorithm matched.
4. If ALL listed algorithms fail to match (and the verifier supports at least one), verification fails. Report `contentHash_mismatch`.
5. If the verifier supports NO algorithm in the listed set (e.g., a package emits only `blake3` and the verifier supports only `sha256`), report `contentHash_no_supported_algorithm` and treat verification as unknown rather than failed. The consumer applies judgment per the normative preamble.

The at-least-one-match rule is permissive about algorithm-support fragmentation: a package emitting `sha256` + `blake3` verifies against any verifier that supports either. The required-default-on-sha256 rule (§2) ensures the universal-baseline case always passes.

### 4. Backwards-compatibility for pre-ADR-0008 packages

Pre-ADR-0008 packages do not embed a `contentHash` field in the canonical JSON; the package hash existed externally (URL slug + database row) as a single SHA-256 hex string. Verifiers reading a pre-ADR-0008 package interpret the legacy external hash as `contentHash: {"sha256": <legacy hex>}` for the purposes of multihash-form verification rules. This is a **serialization-only rewrite at verify time, not a re-hash**; the underlying bytes the hash was computed over are unchanged.

The migration path for an existing package is therefore zero-impact: the package's bytes, hash, signature, RFC 3161 timestamp, and Rekor entry are all unchanged. Only the verifier's internal representation of the hash adapts.

Post-ADR-0008 packages produced by conformant publishers MUST emit `contentHash` as the multihash object form. Absence of `contentHash` on a post-ADR-0008 package is a malformed-package condition.

The schema version stays at `0.1.0` per [Q27](../architecture/open-questions.md#q27--schema-version-bump-trigger-for-the-oes-spec). The serialization change is backwards-compatible at the verify path; the field-rename (`packageHash` → `contentHash`) is handled by the at-verify-time interpretation rule above.

### 5. Relationship to `contentCanonicalization` (ADR-0007)

The multihash `contentHash` is computed against the canonicalized content bytes per the rule named by the package's `contentCanonicalization` field (ADR-0007 §3). The full chain:

1. Off-log content (the bytes representing the package's analytical content per the content profile).
2. → `contentCanonicalization` URI resolves to a rule.
3. → Apply rule: reduce content to canonicalized bytes.
4. → Multi-hash bytes per algorithms in the v0.1 vocabulary.
5. → `contentHash` field embedded in the envelope.

The two ADRs are inseparable in practice: ADR-0007's URI names the rule; ADR-0008's multihash captures the result of applying the rule. A verifier MUST resolve the URI before computing the multihash, since the canonicalization rule determines which bytes get hashed.

### 6. Envelope-level canonicalization — RFC 8785 JCS

**Resolves [Q34](../architecture/open-questions.md#q34--adopt-rfc-8785-jcs-for-unsigned-envelope-canonical-serialization)** (adopt RFC 8785 JCS for unsigned-envelope canonical serialization).

The unsigned envelope (the canonical-JSON evidence package object with the signature envelope removed) is canonicalized via [RFC 8785 JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785) to produce envelope bytes. The envelope hash is the SHA-256 hex digest of those JCS bytes.

JCS is the single fixed envelope-level canonicalization rule for v0.1. Unlike `contentCanonicalization` (which varies per content shape), the envelope rule is the same for every package and is not named via a URI field — it is normative spec text.

JCS implementations exist in Node.js (`canonicalize`), Python (`jcs`), Java (`webpki/openkeystore`), Go (`gowebpki/jcs`), Rust (`cyberphone/jcs`), and other major platforms; cross-implementation interop is well-established.

For pre-ADR-0008 packages, verifiers continue to handle the legacy Node.js `JSON.stringify` insertion-order rule the reference implementation has used since project inception. The migration to JCS at the reference-implementation packager + verify-route is a Phase 3 implementation item; the spec commitment lands in this ADR; the reference-implementation switch lands separately. Existing pre-ADR-0008 packages do not get re-canonicalized — they remain verifiable under their existing implicit rule.

A post-ADR-0008 package produced by a conformant publisher with a JCS-capable packager will hash differently from a pre-ADR-0008 package produced by the legacy Node.js packager for the same logical content; this is expected behavior. The `contentCanonicalization` field's existence per ADR-0007 lets verifiers reason about which rule was used for the content portion; the cohort of pre-vs-post-ADR-0008 packages distinguishes itself by `contentCanonicalization` presence at the package level (absence → legacy rule for both envelope and content; presence → declared content rule + JCS envelope rule).

### 7. Signature mechanics over the envelope hash

The signature chain post-ADR-0008:

1. Unsigned envelope → RFC 8785 JCS (§6) → envelope bytes.
2. Envelope bytes → SHA-256 → 32-byte envelope hash.
3. Envelope hash → hex encode → envelope-hash hex string.
4. Envelope-hash hex string → UTF-8 bytes → Ed25519ph (RFC 8032 §5.1.2, internal SHA-512 prehash applied by the primitive).
5. Signature bytes embedded in the signed envelope alongside `publicKey`, `algorithm`, `kid` per OES §6.1.

The signature math API (`Ed25519ph` over UTF-8 bytes of a hex string) is preserved from the pre-ADR-0008 implementation; only the input differs. Pre-ADR-0008 implementations signed over `SHA-256(JSON.stringify(envelope))` hex string; post-ADR-0008 implementations sign over `SHA-256(JCS(envelope))` hex string.

The signature therefore covers the envelope JCS bytes, which include `contentHash` (multihash form) and `contentCanonicalization` (URI). All three commitments — the hash algorithm vocabulary, the off-log content's fingerprint, and the canonicalization rule URI — are signature-covered and tamper-evident.

A verifier confirms the signature math by:

1. Re-canonicalizing the fetched envelope per JCS (or the legacy `JSON.stringify` rule for pre-ADR-0008 packages).
2. SHA-256 + hex-encoding the canonicalized bytes.
3. Verifying the Ed25519ph signature against the envelope-hash hex string's UTF-8 bytes using the registry-listed public key per OES §6.1 / §6.3.

## Considered and rejected alternatives

- **Hardcode SHA-256 + add a future-extensibility note.** Rejected. Hardcoding plus a "we might revisit later" note is the v0 status quo; the strategic memo §3 finding #2 explicitly named this gap as load-bearing. The future-extensibility note has zero force at the verify-implementation level; verifiers built today against the hardcoded shape would break when SHA-256 is eventually replaced. Multihash form solves the migration once.

- **Use a parallel field for each algorithm (`contentHashSha256`, `contentHashBlake3`).** Rejected. Field-per-algorithm scales poorly (verifiers have to enumerate every possible field) and doesn't compose with the in-toto convention adopted by adjacent standards. The object form is the established pattern; the at-least-one-match verifier rule scales naturally with it.

- **Replace SHA-256 with BLAKE3 as the v0.1 default.** Rejected. SHA-256 is the universal common denominator: every Ed25519ph implementation, every FreeTSA-compatible timestamp authority, Sigstore Rekor's hashedrekord entry type, and existing verifiers assume SHA-256. Replacing the default would break every existing verifier and every existing package. The multihash form lets BLAKE3 land as an additional algorithm without disrupting SHA-256's default position.

- **Adopt a different canonicalization standard for the envelope (cyclonedx-bom, jose canon, custom rules).** Rejected. RFC 8785 JCS has the broadest cross-language implementation availability, is an IETF-published standard (not a vendor-specific format), and is the natural choice when "canonical JSON" is the goal. The alternatives are either narrower in scope or have weaker interop properties.

- **Defer the JCS commitment to a separate ADR.** Rejected as a separation. The two canonicalization-rule questions (off-log content via `contentCanonicalization`, envelope-level via JCS) split cleanly into ADR-0007 (variable content rule) and ADR-0008 (fixed envelope rule + multihash). Bundling both halves under separate ADRs would split the rationale; landing them as a paired cohort keeps the spec's articulation of the two-kinds-of-canonicalization split consistent in one body of work.

- **Keep the legacy `packageHash` field as a deprecation alias** (continue emitting on post-ADR-0008 packages for transition compat). Rejected. Verifiers already handle pre-ADR-0008 packages via the at-verify-time interpretation rule (§4); emitting both `packageHash` and `contentHash` on post-ADR-0008 packages doubles the canonical-JSON's hash-bearing fields and risks divergence (a malformed implementation might emit a `packageHash` that doesn't match the `contentHash.sha256`). The clean rename + at-verify-time interpretation is simpler.

- **Specify the multihash algorithm vocabulary via the IETF multihash codec table** (numeric algorithm codes per `multiformats/multicodec`). Rejected. The numeric-code form is well-suited for binary protocols but less ergonomic for JSON tooling and CLI inspection. The string-keyed form (`{"sha256": "..."}` per in-toto convention) matches the existing adjacent-standards pattern. A future ADR may add a numeric-form binding if a binary protocol surface emerges.

- **Bundle ADR-0007 and ADR-0008 into a single ADR.** Rejected (mirrors ADR-0007's reasoning). The two ADRs split cleanly at the two-kinds-of-canonicalization seam; bundling would obscure the split. The paired-cohort commit lands both ADRs together while preserving the split in the ADR record.

## Consequences

- **OES amendment (paired with ADR-0007 in the same commit).** §3 (definitions): "Package hash" updated to "Content hash" (multihash form); "Signed envelope" updated to reflect JCS canonicalization. §4.1 (top-level fields): a `contentHash` row added (multihash object form). §5 (canonical JSON): rewritten to commit to RFC 8785 JCS for the unsigned envelope and reference `contentCanonicalization` for off-envelope content per ADR-0007. §6.1 (signature mechanics): updated to specify that the signature covers UTF-8 bytes of the envelope-hash hex string, where envelope-hash = SHA-256 of JCS(unsigned envelope), and the envelope contains `contentHash` (multihash) as a field. §13 (verification flow): updated to add multihash at-least-one-match rule and JCS envelope-canonicalization step.

- **Typed-standards-proposal amendment (paired in the same commit).** §4 prose + mermaid diagram updated to show `contentHash` as a multihash and JCS as the envelope canonicalization. The signature node's covering relation is updated to point at the JCS envelope hash, not the legacy single SHA-256 over `JSON.stringify` bytes.

- **Open-questions registry updates.**
  - **Q34** (RFC 8785 JCS for unsigned-envelope canonicalization): moves to Resolution log with link to this ADR §6.
  - **Q18** (BLAKE3 / Data Package Standard / DCAT-US3 / CODATA semantic markdown, [civic-ai-tools#67](https://github.com/npstorey/civic-ai-tools/issues/67)): BLAKE3 specifically resolves as a multihash-codec-table addition (registered alternate per §2 above). Q18 entry updated to reflect BLAKE3's resolution; the other three candidates stay open under Q18's per-candidate evaluation discipline.

- **Schema version unchanged.** Per Q27, the schema version stays at `0.1.0`. Pre-ADR-0008 packages remain verifiable byte-identical via the at-verify-time interpretation rule (§4); post-ADR-0008 packages emit `contentHash` in multihash form.

- **No DB migration.** The reference implementation's `evidence_records.package_hash` column is unaffected by this ADR; verifiers compute the multihash form from the existing column value. A future IMPL phase MAY add a `content_hash_json` column to store the multihash object form, scoped separately.

- **Phase 3 implementation surface (scoped, not done here).**
  - Packager extension (`civic-ai-tools-website/src/lib/evidence/packager.ts`): emit `contentHash` as a multihash object with at minimum `sha256`. Switch envelope canonicalization to RFC 8785 JCS (replace `JSON.stringify` with a JCS library call). Switch signature input to envelope-JCS hash.
  - Verify route (`/api/evidence/[slug]/verify`): handle both legacy external `packageHash` (string interpretation per §4) and post-ADR-0008 embedded `contentHash` (multihash + at-least-one-match per §3). Switch envelope re-canonicalization to JCS for post-ADR-0008 packages; preserve legacy `JSON.stringify` rule for pre-ADR-0008.
  - Bundle endpoint + cross-host commitment view (OES §9.2.1): update field definitions to reflect `contentHash` (multihash) replacing `packageHash` (single hex string); verifiers fetching the bundle interpret per the at-verify-time rule.

- **Paired with ADR-0007.** Both ADRs land in the same commit. The OES + typed-standards-proposal amendments span both ADRs' decisions; no partial cohort.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the tamper-evident labeling principle and the same-key-across-vocabulary-extensions pattern this ADR follows (algorithm-agility is the §6.1 analog of `captureMethod` vocabulary-extensibility).
- [ADR-0004](0004-dathere-captureMethod-variant.md) — defines the datHere content profile whose canonicalized bytes are fingerprinted by the new `contentHash`.
- [ADR-0007](0007-content-canonicalization.md) — paired ADR. Names the off-log content's canonicalization rule URI; ADR-0008 fingerprints the result. Lands in the same commit.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §3, §4.1, §5, §6.1, §13 amended in the same workflow.
- `civic-ai-tools/docs/architecture/typed-standards-specification.md` — §4 prose + mermaid amended in the same workflow.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q34 resolved (link to §6 above); Q18 BLAKE3 candidate resolved (link to §2 above).
- `civic-ai-tools/docs/architecture-incorporation-memo-2026-05-25.md` — strategic memo §3 finding #1 (JCS) + finding #2 (multihash); §5 sequencing item 1 specifies this G1 cohort.
- [RFC 8785 — JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785).
- [in-toto attestation framework](https://in-toto.io/) — convention for digest-set form (`{"sha256": "..."}`).
- [civic-ai-tools#67](https://github.com/npstorey/civic-ai-tools/issues/67) — Q18 promoted issue (BLAKE3 / Data Package Standard / DCAT-US3 / CODATA semantic markdown evaluation).
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied: three named adopters benefit from algorithm agility; Q18 promotion provides direct BLAKE3-specific adopter pressure.
