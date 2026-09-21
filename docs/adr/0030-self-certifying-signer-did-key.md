# ADR-0030: A self-certifying signer for the `pseudonymous` rung — a `did:key` identifier derived from the signing key, checked with no registry, and the trust status `self_certified`

- **Status:** **Proposed** (2026-09-21) — the owner rules on it at gate G2 of Wave N14 (anchor issue typedstandards#77); the ruling settles that wave's D14 (whether decentralized identifiers are adopted); **this record proposes a decision and does not take one**
- **Date:** 2026-09-21
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0009](0009-unified-typed-attestation-primitive.md) (whose envelope-side `signer` claim and check #14 cross-check this record extends to a signer no registry vouches for), [ADR-0024](0024-evidence-path-configuration.md) (whose absent-or-error rule for `trustRegistryUrl` gains its one conditional case), and [ADR-0029](0029-scripted-recomputation-producer-profile.md) (written beside this record, which defers "a signer with no domain" to it)

*Numbering note: 0029 is the record written beside this one in Wave N14; 0018 remains reserved for the roadmap-governance amendment. The study this record carries is [`docs/research/key-derived-identifier-study.md`](../research/key-derived-identifier-study.md).*

## Context

### The ladder today

Specification v0.1.8 §8.5 gives an identity ladder — pseudonymous → GitHub OIDC / sigstore keyless → ORCID → DNS-bound `did:web` → notarized — and marks it informative; only the GitHub binding is implemented. §6.2 (line 207) lists `bindingTier` values `pseudonymous`, `oauth`, `orcid`, `did-web`, `notarized`, "extensible". §11 (line 1532) already describes the first rung as "a one-time signing key with no registry-recorded human binding". What the specification has no mechanism for is checking such a signer: §8.3.1 requires the envelope's `(kid, publicKey)` to match a trust-registry entry, and §9.2 check #14 compares `signer.identifier` with the identifier that registry records for the `kid`. Both need a registry, and a registry needs a domain (§8.3.3: `${baseUrl}/.well-known/typed-publisher.json`).

In `@typedstandards/verify-core` 0.9.0 (`typedstandards` `6b34aa3`), a signer with no registry lands on one of two calm statuses: `verifyKeyTrust` returns `registry_unavailable` when no registry is supplied (`trust-registry.ts:98-99`), and `verify.ts:324-329` returns `legacy_embedded` when the envelope carries no `kid` at all. Check #14 returns `no_registry_identity` (`checks.ts:279`). None of the seven `KEY_TRUST_STATUSES` (`trust-registry.ts:40-48`) says what such a signer's identifier proves, because today it proves nothing: it is a string beside a key, with no rule tying the two together.

### The study

Wave N14's P1a study compared key-derived identifier forms a signer with no domain could use against three questions: what an independent implementation builds to check one with no network; what it proves and does not; and whether it meets the external adopter's stated condition. It is committed as a research note beside this record. Its finding: `did:key` in its base58btc form is the one candidate that is a W3C DID method, carries the whole public key in a fixed-length string a verifier recomputes from the envelope's `publicKey` and compares byte for byte, is recognizable from its first eight characters, and costs verify-core about thirty lines and no dependency. The nearest non-DID forms — the RFC 7638 JWK thumbprint in its RFC 9278 URN, and an RFC 6920 `ni:` URI over the key's DER encoding — are equally checkable offline and equally cheap; what they lack is the property the adopter named. `did:jwk` is a DID but not canonical (one key, many valid strings). `did:web` needs a domain, and Sigstore keyless needs a network and an identity provider at verification time.

### An external tool's open issue

The qsv project by datHere opened [dathere/qsv#4448](https://github.com/dathere/qsv/issues/4448) on 2026-08-20, "Data Schematic: Replace Provenance free-text info with TypedStandards cryptographic signature". The issue is open and labelled `revisit-later`. Its [comment of 2026-09-13](https://github.com/dathere/qsv/issues/4448#issuecomment-5649582321) reads, in full:

> Revisit once TypedStandards supports something like Decentralized Identifiers
>
> https://www.w3.org/TR/did/

That link resolved, on 2026-09-21, to *Decentralized Identifiers (DIDs) v1.0*, W3C Recommendation of 19 July 2022, whose §3.1 gives the DID syntax and whose §8 says what a DID method must define. The [investigation comment of 2026-08-27](https://github.com/dathere/qsv/issues/4448#issuecomment-5440060941) states the two design questions this record answers, under "The real design work is":

> - **Key custody**: who signs a locally-generated dashboard? Likely `--sign-key <file>` / env var, with the publisher (a portal, an org) hosting the trust registry at their origin. Not signing must stay first-class (produce-core treats it that way too): an **unsigned envelope + envelope hash already delivers content-addressed integrity** without identity.
> - **Identifier / verify story**: a CLI artifact has no origin, so the inline commitment-view bundle (§9.4 zero-network verification) is the natural default, with hosted `/verify/<host>/<id>` links for publishers who serve their packages.

and lists, as its Phase 0, "settle the CLI-artifact identifier/verify story", and as its Phase 2:

> **Phase 2 (signing)** — Ed25519ph via `--sign-key`; signature envelope embedded in the HTML + sidecar; `/verify` link or inline commitment bundle; vendor produce-core's byte-golden fixtures as interop tests so the Rust producer provably emits packages `verify-core` accepts.

The thread says nothing beyond this, and this record says nothing beyond the thread.

### The Xanadu gate

Under [the Xanadu doctrine](../architecture/xanadu-doctrine.md), promotion needs a real package or adopter that needs the change, named in the promoting work.

- **The package blocked without it.** No signed package from the adopter exists; its thread plans one ("Phase 2 (signing)", quoted above) and conditions the work on this record's subject. The two signed ADR-0028 packages are **not** blocked by this record: each carries `bindingTier: "pseudonymous"` with a GitHub profile URL as identifier and a trust registry in its bundle, and check #14 reads `ok` on both. This record's honest claim is narrower than ADR-0029's: the need is a stated condition in a public thread, not a package on disk, and the first package under this mechanism is the fixture Wave N14 P7 mints.
- **The adopter:** the qsv project by datHere, through dathere/qsv#4448, whose 2026-09-13 comment is quoted above.

The transition is speculative-to-designed for the mechanism (this record) and designed-to-built for its verify-core, produce-core and verifier legs (Wave N14 P4-P7).

## Decision

### 1. What the owner is choosing between

The choice is between a **DID form** and a **non-DID hash form** for the key-derived identifier. The trade in one line: a DID form meets the adopter's stated condition on its own terms and carries the key itself; a non-DID form (an RFC 7638 thumbprint URN or an RFC 6920 `ni:` URI) is an IETF standards-track identifier that is equally checkable and equally cheap, and does not meet that condition. This record recommends the DID form, `did:key`, and the rest of this section is written for it. A ruling for a non-DID form keeps every rule below except §2's derivation, which the study gives for each alternative.

### 2. The identifier form and its derivation

The key-derived identifier is **`did:key` in its base58btc (`z`) form for an Ed25519 public key**, per *The did:key Method v0.9* (W3C Credentials Community Group draft, https://w3c-ccg.github.io/did-key-spec/, §did-key-identifier-syntax), the multicodec table (`ed25519-pub`, code `0xed`) and the multibase table (`z`, base58btc). This specification fixes the `z` form only; the method's base64url (`u`) form is not a key-derived identifier under this specification (§3 says what happens to one).

Derivation from this specification's signature envelope, whose `publicKey` is standard base64 of the 44-byte DER SubjectPublicKeyInfo (§8.3.1; RFC 8410 §3-§4: OID 1.3.101.112, parameters absent, the BIT STRING holding the raw RFC 8032 §5.1.2 public key):

1. Base64-decode `publicKey` (RFC 4648 §4) to `der`. The result MUST be 44 bytes whose first 12 are `30 2a 30 05 06 03 2b 65 70 03 21 00`; anything else is a malformed key, and the derivation fails. (verify-core's `extractRawPublicKey`, `signature.ts:35-47`, already asserts exactly this.)
2. `raw` = `der[12..44]`, 32 bytes.
3. `mc` = `ed 01` ‖ `raw`, 34 bytes. `ed 01` is the unsigned varint encoding of multicodec `0xed`.
4. `s` = base58btc(`mc`), Bitcoin alphabet `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`, big-endian base conversion, one leading `1` per leading zero byte (never, here, since `mc[0]` is `0xed`).
5. identifier = `did:key:z` ‖ `s`. For an Ed25519 key, `s` is 47 characters and begins `6Mk`.

A verifier checks an identifier by recomputing steps 1-5 from the envelope's `publicKey` and comparing the result with `signer.identifier` byte for byte — case-sensitive, no normalization, no decoding of the claimed string. No base-58 decoder is needed anywhere in the verification path.

**Worked example.** The key is the committed public key of the eval-run example repository, `package/public-key.txt` at commit `9031a94` (the same value is the `publicKey` of `package/trust-registry.json` and of the `signature` block in `package/recomputation.commitment.json`; its seed is held outside that repository). Its raw 32 bytes are `d1a7f59666e0fa9f8e4037105237bef5fe821355aae6115b3df0cd06fb1d39ac`, so `mc` is `ed01d1a7f596…1d39ac`, and the identifier is

```
did:key:z6MktZfoG3M2Navo8Pvbn8DXZAQrYTHk95QbZ7W5gnU9sK1u
```

The study's encoder passes the three test vectors of draft-msporny-base58-03; three published did:key strings (the vc-di-eddsa v1.0 Recommendation's B.1 key and the method specification's two Ed25519 examples) decode to `ed 01` plus 32 bytes and round-trip; and the Wave N14 orchestrator recomputed this example independently. No published vector pairs an SPKI-encoded key with its did:key string, so §9 has the shipped code re-derive the pairs rather than copy them.

### 3. When `self_certified` applies, and when a mismatch is fatal

**The trigger is the identifier, never the tier.** A `signer.identifier` that begins `did:key:` is a **key-derived identifier**. The self-certifying check runs if and only if the identifier is key-derived; `bindingTier` does not enter the decision. This is Wave N14's ruling D3, taken because the signed ADR-0028 packages carry `bindingTier: "pseudonymous"` with a GitHub-URL identifier and cannot be re-signed: a check triggered by the tier alone would turn both into a fatal mismatch.

- **`self_certified`** — the eighth `KEY_TRUST_STATUSES` value — is the key-trust verdict when the identifier is key-derived, `bindingTier` is `pseudonymous`, and the identifier derived from the envelope's `publicKey` equals `signer.identifier`. It carries `verified: false`, as `legacy_embedded` does: `verified` stays `active`/`deprecated_valid` only (`trust-registry.ts:53-57`), because no registry vouched for the key.
- **A key-derived identifier under any other tier is never `self_certified`.** Such a package is checked for the match exactly as below (a mismatch is still fatal), and its key-trust verdict follows the registry path as today. The identifier proves the same thing under any tier; the status is reserved for the rung the specification describes as a key with no recorded binding.
- **A mismatch is fatal.** When the identifier is key-derived and the derived value differs from `signer.identifier` — for any tier, with or without a registry — check #14 reports **`key_derived_mismatch`**, a new fatal status (tier `alarm`) beside `signer_identity_mismatch`. Its result carries `claimed` and `derived`, not `registered`: nothing was registered. A match under a key-derived identifier is check #14's **`key_derived_match`** (tier `normal`; §10 gives its label). Check #14 thus goes from four statuses to six.
- A `did:key:u…` identifier, or a `did:key:z…` for a key type other than Ed25519, is key-derived by the prefix rule and never equals an Ed25519 derivation, so it is a fatal `key_derived_mismatch`. This is deliberate: one key, one string, and a verifier never has to decode a claim to decide whether it might have been truthful under another spelling.

### 4. Where the check runs, and how a supplied registry interacts

In `verify.ts` the key-trust verdict is computed at `:324-329` from the envelope alone — `verifyKeyTrust` when `publicKey` and `kid` are both present, `legacyEmbeddedKeyTrust` otherwise — and the package's `signer` is read later, in check #14 (`:345`). The self-certifying check therefore runs on the package's `signer.identifier` and the envelope's `publicKey`, and needs both: when the package bytes are absent (a commitment view verified without its package, the case `docs/trust-and-evidence.md` describes for sealed records) no key-derived check runs, check #14 is null as today, and the key-trust verdict is what the envelope alone yields.

With the package present and a key-derived identifier:

1. Derive and compare (§2). A mismatch is fatal (§3); the key-trust verdict then follows the existing registry path unchanged, because the signature may well verify under a key that is simply not the one the identifier names.
2. On a match, when no registry is supplied, or the supplied registry has no entry for the envelope's `(kid, publicKey)`: key trust is `self_certified` (in place of `registry_unavailable`, `unknown_key` or `legacy_embedded`), and check #14 is `key_derived_match`.
3. On a match, when a supplied registry **does** list the envelope's `(kid, publicKey)`, what the registry's verdict may do depends on where the registry came from. **For a key-derived identifier, only a registry obtained from a declared `trustRegistryUrl` can change the status; a registry carried in the bundle can report `revoked` but never raise the status above `self_certified`** (the owner's G2 ruling, 2026-09-21). A self-certified signer has no domain, so a registry that arrived in its own bundle is its own statement: it may say less of itself, never more.
   - **Registry fetched from a declared `trustRegistryUrl`** (the view's `trustRegistryUrl` or `trustRegistryUrlLegacy` field, resolved by the verifier): the registry's verdict about the key stands — `active`, `deprecated_valid`, `deprecated_invalid` or `revoked` — and is reported as the key-trust status; `self_certified` is not reported. A publisher that hosts a registry at a domain has made a statement the key alone could not.
   - **Registry carried in the bundle** (the `?inline=1` form's `trustRegistry` field, or any registry the caller did not fetch from the declared URL): a verdict that **lowers** is reported — `revoked`, and `deprecated_invalid`, which is treated the same because it too says the key must not be trusted for this signature (signed after `deprecatedAt`, or deprecated with no date), and a signer that says that of its own key gains nothing by it. A verdict that would **raise** — `active` or `deprecated_valid` — leaves the status at `self_certified`, and `verified` stays `false`. `unknown_key` from a bundle-carried registry is rule 2: `self_certified`.
   - **Check #14 never reports `ok` under a key-derived identifier**, whatever the registry's source: a match stays `key_derived_match` (`ok` means "matches the registry", which no self-certified signer has earned). A listed entry whose `signerIdentity.identifier` differs from the claimed identifier is `signer_identity_mismatch`, fatal, from either source — a contradiction only lowers, so a bundle-carried registry may raise it.
   - **The provenance is the caller's to state.** verify-core takes a registry as parsed data with "no opinion on how a registry was obtained" (`trust-registry.ts:12-16`); the site already records whether it read the registry inline from the bundle or fetched it from the declared URL (`apps/web/src/lib/verify-flow.ts:757-766`, `registrySource.kind` `inline` | `fetched`). Under this record the verify-core entry point takes that provenance as an input beside the registry — fetched from the declared `trustRegistryUrl`, or carried in the bundle — and applies the rule above; the site passes what it already knows. Building the input is Wave N14 P4's and P6's; this record states the rule and the input it needs. A caller that supplies a registry without stating its provenance is treated as having carried it in the bundle.

Rule 3 is the only way a registry can raise a self-certified signer's status; it needs a registry from a declared URL, and it raises the status to what that registry says, no further. Nothing in rules 1-3 changes behaviour for a signer whose identifier is not key-derived — the site's use of a bundle-carried registry as given for every signer is typedstandards#78, outside this wave.

### 5. `kid`

Under a key-derived identifier `kid` is optional. When present, it MUST equal `metadata.signingKeyId` as §8.3.1 requires, and it SHOULD be the identifier string itself, so that a package's key is named the same way in the envelope and in the claim. A `kid` that resolves nowhere is not an error under this mechanism: the identifier, not the `kid`, names the key.

### 6. The commitment view and the produce-core helper

- **`trustRegistryUrl` may be absent only when the signer's identifier is key-derived.** `buildCommitmentView` (`produce-core/src/commitment.ts:143-147`) keeps its ADR-0024 throw for every other case: no `signer`, a `signer` whose identifier is not key-derived, or any `bindingTier` other than `pseudonymous`. When the URL is absent under a key-derived identifier the view omits the `trustRegistryUrl` key (omitted, not `null`, per §8.8.1's convention), and §8.8.1's "yes" for that field becomes "conditional" in P2. The offline bundle's `trustRegistry` field is then absent too, and a verifier reading the bundle follows §4 rule 2. A self-certified signer's bundle MAY carry a `trustRegistry` it wrote itself; a verifier reading one follows §4 rule 3's bundle-carried case — it can lower the status and never raise it.
- **The builder checks the claim it is asked to serve.** When `trustRegistryUrl` is absent, `buildCommitmentView` derives the identifier from `input.signature.publicKey` — a value the view already carries verbatim — and throws when it does not equal `input.signer.identifier`. A view that would fail check #14 on every verifier is a producer error, and ADR-0024's rule is that the core does not serve one silently. No key material is needed for this: the derivation reads the public key the view carries.
- **The helper.** produce-core exports a function that derives the identifier from a caller-supplied Ed25519 key input, through the same path as `derivePublicKeySpki` (`signing.ts:132-139`) and verify-core's derivation of §2, so producer and verifier compute one value from one implementation. verify-core exports the derivation from a base64 SPKI string and the key-derived predicate; produce-core's helper wraps the first. Neither core takes a new runtime dependency: the base-58 encoder is written in place in verify-core, `scripts/dependency-budgets.json` is unchanged, and the purity rules (`.claude/rules/purity.md` in `typedstandards`) hold — the encoder needs no `Buffer` and no Node built-in.

### 7. No rotation, no revocation; the upgrade path

A self-certifying signer has **no rotation and no revocation**. The did:key method specification states it: "This DID Method does not support updating the DID Document", "does not support deactivating the DID Document", and "there is no mechanism to rotate cryptographic keys in response to potential compromise" (§security-considerations). This specification's key lifecycle — `active`, `deprecated`, `revoked` (§8.3.3) — belongs to a registry, and a self-certified signer has none. A compromised self-certifying key can only be abandoned; a new key is a new identifier with no link to the old one, and nothing in a package signed under the old key says it was abandoned. A verifier working from a bundle can never learn that a self-certifying key was compromised. The one exception is §4 rule 3: a registry that lists such a key can mark it revoked, and a verifier given that registry sees it — whether the registry was fetched from a declared `trustRegistryUrl` or carried in the bundle, since a revocation only lowers.

**The upgrade path** is an attestation in which a domain-bound signer vouches for a key — a signed `attestation/*` node whose signer is on the ladder's `did-web` or higher rung and whose target is the self-certifying key's identifier. Wave N14 ruled it out of this sprint (D6); it is named here as the path and is undecided.

### 8. `platform` and `organization` against the specification's tier list

Measured 2026-09-21: the list at specification line 207 is `pseudonymous`, `oauth`, `orcid`, `did-web`, `notarized`, marked "extensible". The specification's own §8.3.3 registry example (line 633) uses `bindingTier: "platform"`; line 646 tells verifiers to synthesize `bindingTier: "legacy_embedded"` for pre-v0.1 registry entries. In `typedstandards` at `6b34aa3`, `platform` appears in verify-core tests and in the web `q15-*` offline-bundle fixtures, which are captures of the reference implementation's served bundles — so it is on the wire inside signed packages; `organization` appears in six produce-core test fixtures (`commitment.test.ts:30` among them) and nowhere signed.

Decision: **both are conformant under "extensible"; neither is a violation, and neither changes anything.** P2 adds `platform` to the informative list at line 207 as the reference implementation's operator value, since the specification already uses it in its own example; `organization` stays an adopter extension, unlisted; and line 646's `legacy_embedded` is described as a placeholder a verifier synthesizes, not a rung. `bindingTier` stays a bare string in verify-core (`types.ts:13-18`). None of this touches the mechanism above, which keys on the identifier alone.

### 9. Fixtures and test vectors

Wave N14 P4 re-derives, with the shipped encoder, the pair in §2 (the eval-run example's committed public key) and two pairs whose keys are published in RFCs — RFC 8032 §7.1 test 1's public key `d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a` and RFC 8410 §10.1's example key — and asserts each against the study's computed strings (`did:key:z6MktwupdmLXVVqTzCw4i46r4uGyosGXRnR3XjN4Zq7oMMsw` and `did:key:z6MkgBmPpouQ9ecfde8g8oyJyhdgxfuTB2mqsd7A8QnEu3ZA`), plus the base-58 draft's three vectors. The canary pair P4's contract names (a matching key yields `self_certified`; a swapped key fails) uses the first. P7's self-certified package fixture is signed with a key generated for the fixture, under `typedstandards`' `.claude/rules/fixtures.md`. No test vector in this record is normative; the derivation in §2 is.

### 10. What a verifier shows

The wave's cold-read question is whether any path lets a self-certified signer be shown as more than it is. The paths, and the rule for each:

| Path | What could go wrong | Rule |
|---|---|---|
| **The key-trust status** | `self_certified` rendered in the `verified` tier, or with `verified: true` | Tier `normal`, `verified: false`. Label: "Signed with a self-certifying key". Detail: "The signer's identifier is derived from the signing key, so it proves that the same key signed everything under this identifier — not who holds the key. No registry vouches for it, and the key cannot be rotated or revoked." |
| **The tier claim** (`bindingTier`) | The word `pseudonymous`, or any other tier value, read as a binding | The tier is a signer's self-description and is displayed as such. Under this record it decides nothing: a key-derived identifier at `oauth` or `did-web` gets no higher status than the registry path yields, and no verifier text may present a tier value as something a check established. |
| **A supplied registry** | A registry that lists the key read as vouching for an identity — in particular one the signer put in its own bundle | §4 rule 3: only a registry fetched from a declared `trustRegistryUrl` can raise the status, and only to what it says. A registry carried in the bundle can report `revoked` (or `deprecated_invalid`) and nothing higher: its `active` leaves `self_certified` in place, and check #14 never reports `ok`. A registry that does not list the key changes nothing, and `unknown_key` is not reported for it (it would suggest the signer *should* have been listed). The verifier states the registry's source beside the status. |
| **`displayName`** | Free text shown where a registry-bound name sits, read as verified | Under a key-derived identifier `displayName` is unverified text. It is shown as the signer's self-description ("calls itself …" or equivalent), never in the byline position a registry-recorded `signerIdentity.displayName` occupies, and never beside a check-mark. |
| **The commitment view's `signerIdentity` block** | The informational provider block (§8.8.1: "MUST NOT be used as the signature subject") rendered next to the signer as if it vouched | Not rendered as part of the signer's identity when the signer is self-certified. A producer SHOULD omit it from a self-certified view; a verifier that receives one shows it, if at all, as unrelated context. |
| **`kid`** | A `kid` that looks like a registry key id (`platform:…`) read as a registry binding | `kid` is displayed as the envelope's key label and nothing else. With no registry match it establishes nothing, and no text says "registered key". |
| **The check-#14 row** | Today's `ok` label, "Signer identity matches the registry", shown for a derived match | `key_derived_match` has its own label: "Signer identifier matches the signing key", detail "The identifier is derived from the key that signed this package. This shows the same key signed anything else under this identifier, and nothing about who holds it." `ok` is never reported for a derived match. |
| **Continuity across packages** | Two packages under one `did:key` read as "the same publisher" | Text says "the same key", never "the same person" or "the same publisher". |

Nothing above adds a `verified` tier to any surface, and no `self_certified` package satisfies "signed by a key listed in the published trust registry" — the sentence `docs/trust-and-evidence.md` (line 233) uses for what a verifier can confirm today. That document is unchanged by this record; once P4-P6 land, it gains a second case, and the phase that lands them updates it.

### 11. The signed ADR-0028 packages are unaffected

`package/recomputation.package.json` (envelope `abb93f78…4a9c`) and `package/retrieval.package.json` (envelope `3637b595…7d48`) carry a GitHub profile URL as `signer.identifier` — not key-derived — at `bindingTier: "pseudonymous"`, with the registry `package/trust-registry.json` in their bundles. Under §3 the self-certifying check never runs on them; their key-trust verdict stays `active` and check #14 stays `ok`, as the example's `docs/verify-output.txt` records for both today (`#5 key status ok active in the registry carried in the bundle`; `#14 signer identity ok`). No byte of either package changes, and neither is ever `self_certified`.

## Considered and rejected alternatives

- **A non-DID hash form** (RFC 7638 thumbprint as an RFC 9278 URN; RFC 6920 `ni:` URI). Equally checkable and cheaper by a base-58 encoder; recorded as the alternative the owner is choosing against (§1). Rejected in the recommendation on the adopter's stated condition only.
- **`did:jwk`.** A DID, but the identifier is not canonical ("Canonicalization such as JCS is not required" in its specification): a producer's JSON serialization decides the string, and a byte compare fails across producers. Rejected.
- **Accepting both did:key spellings (`z` and `u`).** Two strings for one key, and a verifier that must decode a claim before comparing. Rejected; `u` is a fatal mismatch (§3).
- **Triggering on the tier.** Rejected under D3: the ADR-0028 packages would fail.
- **Reusing `signer_identity_mismatch` for a derived mismatch.** Its result names a `registered` value and its label says "the registry"; a derived mismatch has neither. Rejected in favour of `key_derived_mismatch` with a `derived` field.
- **Reporting `self_certified` even when a registry fetched from a declared `trustRegistryUrl` lists the key.** Rejected: a publisher's revocation of a key it lists must be visible, and its `active` at a domain is a stronger statement than the key's own.
- **Letting a bundle-carried registry raise the status.** Rejected by the owner's G2 ruling (2026-09-21): the bundle is the signer's own artifact, so a registry inside it is the key vouching for itself under another name. It may lower (`revoked`, `deprecated_invalid`) and never raise.
- **A new rung on the ladder** for the self-certifying signer. Rejected under G0 D3: the specification already describes the `pseudonymous` rung as a key with no recorded binding, and a new rung would still need a trigger that is not the tier.
- **Rotation or revocation inside the mechanism** (a successor-key attestation signed by the old key; a self-revocation node). Not rejected on the merits; out of this sprint, and in any case not something a verifier could learn from the package alone. Named under §7 as future work behind the domain-vouches-for-key attestation.

## Consequences

- **A signer with no domain can be checked.** Its identifier is confirmed against the signing key from the package alone, with no registry, no network, and no new dependency, and the verdict says exactly what was confirmed.
- **Specification text (Wave N14 P2) this record licenses:**
  - §6.2 (line 207) and §8.1.1: the `signer` rows gain the key-derived identifier form and the `platform` value (§8).
  - §8.3.1: the `(kid, publicKey)`-MUST-match-a-registry sentence gains the self-certifying case; the `kid` rule of §5.
  - §8.3.3: the eighth `keyTrust` value, `self_certified`, and §4's interaction rules.
  - §8.5: the `pseudonymous` rung's self-certifying form, the derivation of §2, and the statement of §7 (no rotation, no revocation; the upgrade path, undecided).
  - §8.8.1: `trustRegistryUrl` becomes conditional; the `signer` row names the key-derived form; the `?inline=1` note says `trustRegistry` may be absent under it.
  - §9.2: check #5 and check #14 as amended (`key_derived_match`, `key_derived_mismatch`), with the fatal rule.
  - §10.2 or §11: the threat statement that a compromised self-certifying key cannot be revoked.
  - Appendix G: the revision, naming the adopter under D2 as this record does.
- **Verifier and core work.** P4: the encoder, the derivation, the predicate, the eighth status, the two check-#14 statuses, the registry-provenance input of §4 rule 3 (fetched from the declared URL, or carried in the bundle) and its raise/lower rule, the canary pair. P5: the helper, the conditional in `buildCommitmentView` with its derivation check, one byte-golden case, a produce-then-verify round trip yielding `self_certified`. P6: the site passes its `registrySource.kind` through; `KEY_TRUST_SIGNALS` and `SIGNER_IDENTITY_SIGNALS` rows per §10 (`apps/web/src/lib/trust-signal.ts:262-308`, `:614-638`), which the type check forces. P7: the fixture package. P8: the cold read against §10.
- **`docs/trust-and-evidence.md`** is unchanged by this record and out of its blast zone; its line-233 sentence needs a second case once the verifier ships the mechanism (§10, last paragraph). Flagged for the phase that lands P4-P6.
- **Q3 stays open.** This record adds a self-certifying form to the first rung; it binds no identity and is not a provider, so the question Q3 asks — the first non-GitHub identity *provider* — is untouched. Q3 carries a dated status note pointing here.
- **Not settled here:** the domain-vouches-for-key attestation (D6); any rotation or successor mechanism; Q3; the schema of `signer.identifier` for `orcid`, `did-web` and `notarized` (§8.5, still tied to Q3); whether a non-Ed25519 key ever gets a derivation under this specification (§8.3.1 admits Ed25519ph only).

## References

- [`docs/research/key-derived-identifier-study.md`](../research/key-derived-identifier-study.md) — the P1a study, with the comparison table, per-form citations, and the derivation checks.
- Specification v0.1.8, read at hub `1cdd0c2`: lines 207, 444, 597-611 (§8.3.1), 622-655 (§8.3.3), 673-685 (§8.5), 838-871 (§8.8.1), 1433 (§9.2 #14), 1532 (§11).
- `typedstandards` `6b34aa3`: `packages/verify-core/src/trust-registry.ts:40-57`, `:98-99`; `checks.ts:242-290`; `signature.ts:14-47`; `primitives.ts:35`; `verify.ts:324-329`, `:345`; `types.ts:13-18`; `packages/produce-core/src/commitment.ts:143-147`; `signing.ts:132-139`; `commitment.test.ts:30`; `apps/web/src/lib/trust-signal.ts:262-308`, `:614-638`; `scripts/dependency-budgets.json`; `.claude/rules/purity.md`.
- Eval-run example repository at `9031a94`: `package/public-key.txt`, `package/trust-registry.json`, `package/recomputation.commitment.json`, `package/recomputation.package.json`, `docs/verify-output.txt`.
- *Decentralized Identifiers (DIDs) v1.0*, W3C Recommendation 19 July 2022, https://www.w3.org/TR/did-core/ (§3.1, §8). *The did:key Method v0.9*, W3C CCG draft, https://w3c-ccg.github.io/did-key-spec/ (§did-key-identifier-syntax, §signature-method-creation-algorithm, §security-considerations, §test-vectors). multiformats `multicodec/table.csv` (`ed25519-pub`, `0xed`, draft) and `multibase/multibase.csv` (`z`, base58btc, final). *Data Integrity EdDSA Cryptosuites v1.0*, W3C Recommendation 15 May 2025, https://www.w3.org/TR/vc-di-eddsa/ (B.1). draft-msporny-base58-03 (alphabet, test vectors).
- RFC 8032 §5.1.2, §7.1; RFC 8410 §3, §4, §10.1; RFC 4648 §4, §5; RFC 7638 §3; RFC 8037 §2, Appendix A.3; RFC 9278; RFC 6920 §3.
- [dathere/qsv#4448](https://github.com/dathere/qsv/issues/4448), its [2026-08-27 investigation comment](https://github.com/dathere/qsv/issues/4448#issuecomment-5440060941) and its [2026-09-13 comment](https://github.com/dathere/qsv/issues/4448#issuecomment-5649582321), read 2026-09-21.
- [The Xanadu doctrine](../architecture/xanadu-doctrine.md); [Q3](../architecture/open-questions.md#q3--first-non-github-identity-provider); Wave N14 anchor typedstandards#77 and its G0 record (rulings D3, D6, D14).
