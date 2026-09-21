# A key-derived identifier for a signer with no domain

A timeboxed comparison of the identifier forms a signer with no domain could derive from its own signing key, so that a verifier can check the signer's identifier against the signature's public key with no registry and no network. Written as phase P1a of Wave N14 (anchor issue typedstandards#77), inside that wave's G0 rulings.

*Research, not a decision. The decision this study informs is proposed in [ADR-0030](../adr/0030-self-certifying-signer-did-key.md); the owner's ruling on that record settles it.*

*Read against `typedstandards` main `6b34aa3`, the specification v0.1.8 at hub `1cdd0c2`, and the eval-run example repository at `9031a94`. Last updated 2026-09-21.*

---

## Answer

Adopt **`did:key`** in its base58btc form (`did:key:z…`, Ed25519 multicodec `0xed`) as the key-derived identifier for the `pseudonymous` rung. Reason in one line: it is the one candidate that is a W3C DID method (the adopter's stated condition), carries the whole public key in a fixed-length string a verifier can recompute from the envelope's `publicKey` and compare with no hash, no registry and no network, is recognizable from its first eight characters (`did:key:`), and costs verify-core about thirty lines and no dependency. The owner is choosing between a DID form (`did:key`, or `did:jwk` as the DID runner-up) and a non-DID hash form (the RFC 7638 JWK thumbprint in its RFC 9278 URN, or an RFC 6920 `ni:` URI). The non-DID forms are equally checkable offline and equally cheap; what they lack is the property the adopter named.

## Comparison

"Q1" = what an independent implementation builds, with no network; "Q2" = what it proves; "Q3" = the adopter's stated condition; "string" = recognizable from the identifier string alone (the D3 requirement); "cost" = implementation cost in verify-core with no new dependency.

| Form | Q1 — build, no network | Q2 — proves / does not | Q3 — adopter's condition | Recognizable from string | Cost in verify-core |
|---|---|---|---|---|---|
| **`did:key` (`z` form)** — recommended | SPKI decode (exists), prepend `ed 01`, base58btc (write ~25 lines), prefix `z`; compare strings. Test vectors: the method spec's Ed25519 vectors and vc-di-eddsa B.1 give `z6Mk…` strings; none pairs an SPKI with its did:key, so this study computes one below | Same key as any other signature under this identifier; nothing about the holder; no rotation, no deactivation (method spec §Security) | A DID method under DID Core; matches "something like Decentralized Identifiers" literally | Yes: `did:key:` prefix; every Ed25519 key starts `did:key:z6Mk` | ~30 lines: base58 encoder + derive + predicate |
| `did:key` (`u` form) | Same, base64url instead of base58 (no encoder to write) | Same | Same | Yes: `did:key:u` | Smaller, but two spellings of one key unless the spec fixes one |
| `did:jwk` | Build the OKP JWK JSON, base64url it | Same as did:key | A DID method (community draft) | Yes: `did:jwk:` | Small, but not canonical: the same key has many valid strings ("Canonicalization such as JCS is not required") — a byte compare fails across producers |
| RFC 7638 JWK thumbprint as RFC 9278 URN (`urn:ietf:params:oauth:jwk-thumbprint:sha-256:…`) — non-DID | Build the three-member JWK, SHA-256 (exists), base64url; published vector RFC 8037 A.3 reproduced here | Same as did:key; identifier is a hash, so the key still comes only from the envelope | Not a DID; would need the adopter to accept a non-DID answer | Yes: fixed URN prefix | ~15 lines |
| RFC 6920 `ni:///sha-256;…` over the SPKI DER — non-DID | SHA-256 of the 44 DER bytes, base64url | Same; names an object (a key encoding), not a signer by design | Not a DID | Yes: `ni:///sha-256;` | ~5 lines |
| Bare key with a local prefix (`ed25519:<base64>`) | Nothing to build | Same | Not a DID; no external specification at all | Yes, but only by this spec's own rule | ~1 line |
| `did:web` | Out: needs a domain — the case this study exists for | — | — | — | — |
| Sigstore keyless / OIDC | Out: needs a network and an identity provider at verify time | — | — | — | — |

## Per-form notes

**`did:key`.** "The did:key Method v0.9", W3C Credentials Community Group draft (https://w3c-ccg.github.io/did-key-spec/; repository last pushed 2025-11-02; the fetched page carries no dated status line). Syntax (§did-key-identifier-syntax): `did-key-format := did:key:<mb-value>`, `mb-value := (z[a-km-zA-HJ-NP-Z1-9]+|u[A-Za-z0-9_-]+)`, defined as `did:key:MULTIBASE(base58-btc, MULTICODEC(public-key-type, raw-public-key-bytes))` and the base64url twin. Key table (§signature-method-creation-algorithm): "ed25519-pub — 0xed — 32 bytes". Decode rule: "Implementers are cautioned to ensure that the multicodecValue is set to the result after performing varint decoding" — so the header is the unsigned varint of 0xed, which is the two bytes `ed 01`. Rotation (§security-considerations): "This DID Method does not support updating the DID Document"; "does not support deactivating the DID Document"; "a purely generative method … there is no mechanism to rotate cryptographic keys in response to potential compromise." The spec does not make Ed25519 support mandatory; it is the first key type in its table and in its test vectors (§test-vectors: Ed25519, Ed25519+X25519, secp256k1, BLS12-381, P-256, P-384; multibase strings only). Two published Ed25519 strings decoded in this study to `ed 01` + 32 bytes and round-tripped. Multicodec row (multiformats/multicodec `table.csv`): `ed25519-pub, key, 0xed, draft`. Multibase row (multiformats/multibase `multibase.csv`): `z, base58btc, Base58 Bitcoin, final`; `u, base64url, RFC4648 no padding, final`. DID Core: "Decentralized Identifiers (DIDs) v1.0", W3C Recommendation 19 July 2022 (https://www.w3.org/TR/did-core/; §3.1 DID syntax `did = "did:" method-name ":" method-specific-id`; §8 Methods, which a method must define for create, resolve, update, deactivate). The adopter's link https://www.w3.org/TR/did/ resolved to this document on 2026-09-21.

**`did:jwk`** (https://github.com/quartzjer/did-jwk/blob/main/spec.md). `did:jwk:<base64url of the JWK JSON>`; "Canonicalization such as JCS is not required"; "there is no support for key rotation". Out because the identifier is not canonical: a TypeScript and a Rust producer that order or space the JSON differently mint different identifiers for one key, and the verifier's compare becomes a JSON parse plus a key compare. The spec could pin a canonical JWK, but then the form is this spec's, not did:jwk's.

**RFC 7638 JWK thumbprint** (https://www.rfc-editor.org/rfc/rfc7638.html §3: the required members only, "lexicographically ordered", no whitespace, UTF-8, hashed; §1: usable "for identifying or selecting the key", including as a `kid`). §3.2 lists EC, RSA and symmetric members only; the OKP members (`crv`, `kty`, `x`) and the Ed25519 vector are in RFC 8037 Appendix A.3 (https://www.rfc-editor.org/rfc/rfc8037.html): input `{"crv":"Ed25519","kty":"OKP","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}`, thumbprint `kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k` — reproduced byte-for-byte by this study's script. The URN carrier is RFC 9278 (JWK Thumbprint URI; not fetched in this study). In the comparison because it is the strongest non-DID answer: IETF standards track, one published vector for exactly this key type, and the one JWT/JOSE-world identifier a Rust implementer already has in `jsonwebtoken`-class crates. Out only on Q3.

**RFC 6920 `ni:` URI** (https://www.rfc-editor.org/rfc/rfc6920.html §3: `ni:///sha-256;<base64url digest>`, authority optional, identity is "the digest algorithm, length, and value"; §9.4 the hash-name registry). Names an object by its hash; applying it to the SPKI DER names the key's encoding. Out: it has no ecosystem meaning as a signer identifier, and it names the DER, which is one encoding of the key rather than the key.

**Bare key with a local prefix.** Nothing external to cite; the identifier would be defined only by this specification. Out on Q3 and on the doctrine's preference for an existing standard.

**`did:web`, Sigstore keyless.** Out by the study's premise: the first needs a domain, the second needs a network and a provider at verify time. `did:web` stays the ladder's institutional rung (spec §8.5 :679) and is the natural target of the D6 upgrade path.

## Derivation for `did:key` (Ed25519, `z` form)

Inputs from this specification's signature envelope (spec §8.3.1 :597-604; verify-core `packages/verify-core/src/signature.ts:14-47`): `publicKey` is standard base64 of the 44-byte DER SubjectPublicKeyInfo, whose first 12 bytes are fixed (`30 2a 30 05 06 03 2b 65 70 03 21 00`: SEQUENCE, AlgorithmIdentifier with OID 1.3.101.112 and no parameters, BIT STRING with 0 unused bits — RFC 8410 §3 "id-Ed25519 OBJECT IDENTIFIER ::= { 1 3 101 112 }", "the parameters MUST be absent"; §4 "subjectPublicKey contains the byte stream of the public key"; https://www.rfc-editor.org/rfc/rfc8410.html) and the last 32 are the RFC 8032 §5.1.2 public key.

1. Base64-decode `publicKey` (RFC 4648 §4) → 44 bytes `der`. Fail unless the length is 44 and `der[0..12]` equals the prefix above. (verify-core: `extractRawPublicKey`, exported.)
2. `raw = der[12..44]` — 32 bytes.
3. `mc = 0xed 0x01 ‖ raw` — 34 bytes. `ed 01` is the unsigned varint of multicodec `0xed`.
4. `s = base58btc(mc)`: Bitcoin alphabet `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`, big-endian base conversion, one leading `1` per leading zero byte (there are none here, since `mc[0] = 0xed`).
5. `identifier = "did:key:z" ‖ s`. For an Ed25519 key `s` is 47 characters and begins `6Mk`.
6. Verify: recompute 1-5 from the envelope's `publicKey`; the result must equal `signer.identifier` byte for byte (case-sensitive; no normalization). The verifier does not need a base-58 decoder.

The same key under the method's `u` form is `did:key:u` ‖ base64url(`mc`) (RFC 4648 §5, no padding). ADR-0030 fixes the `z` form only.

**Worked example.** Input: the committed public key of the eval-run example repository (`typedstandards-eval-run-example` `9031a94`, `package/public-key.txt`, also the `publicKey` in `package/trust-registry.json` and in `package/recomputation.commitment.json`'s `signature`). The seed is held outside that repository; no private material was read or generated.

```
der (hex):  302a300506032b6570032100 d1a7f59666e0fa9f8e4037105237bef5fe821355aae6115b3df0cd06fb1d39ac
raw (hex):  d1a7f59666e0fa9f8e4037105237bef5fe821355aae6115b3df0cd06fb1d39ac
mc  (hex):  ed01 d1a7f59666e0fa9f8e4037105237bef5fe821355aae6115b3df0cd06fb1d39ac
did:key:    did:key:z6MktZfoG3M2Navo8Pvbn8DXZAQrYTHk95QbZ7W5gnU9sK1u
```

For comparison, the same key's RFC 7638 thumbprint is `jOnygwxmboooeL1c5-6uugbjSMKdC2D17l3yXoumlTQ`.

The derivation was run as a Node 22 script using only `node:crypto` for SHA-256; the base-58 encoder is the ~20-line in-place function verify-core would carry. The scripts are not committed; ADR-0030 §2 gives the steps and the Wave N14 phase report gives a one-line recomputation command. Checks run on the encoder and the derivation: (a) the three test vectors of draft-msporny-base58-03 §Test Vectors ("Hello World!" → `2NEpo7TZRRrLZSi2U`; the pangram → `USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z`; `0x0000287fb4cd` → `11233QC4`) all pass; (b) RFC 8037 A.3's thumbprint reproduces exactly; (c) three published did:key strings (vc-di-eddsa B.1 `z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2`, W3C Recommendation 15 May 2025, https://www.w3.org/TR/vc-di-eddsa/; the method spec's `z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2PKGNCKVtZxP` and `z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK`) each decode to header `ed01` plus 32 bytes and round-trip. Two more computed pairs, usable as fixtures because their keys are published in RFCs: RFC 8032 §7.1 test 1 public key `d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a` → `did:key:z6MktwupdmLXVVqTzCw4i46r4uGyosGXRnR3XjN4Zq7oMMsw`; RFC 8410 §10.1 example key (raw `19bf44096984cdfe8541bac167dc3b96c85086aa30b6b6cb0c5c38ad703166e1`) → `did:key:z6MkgBmPpouQ9ecfde8g8oyJyhdgxfuTB2mqsd7A8QnEu3ZA`. **No published vector pairs an SPKI or raw-hex Ed25519 key with its did:key string**; the pairs above are this study's computation and the implementing phases should re-derive them with the shipped code, not copy them.

**What a Rust or TypeScript implementer needs.** Base64 decode (standard library), a 12-byte prefix compare, a base-58 encoder (Rust: the `bs58` crate or the same 20 lines; TypeScript: in place — `@scure/base` is not a verify-core dependency and must not become one), string compare. The adopter's 2026-08-27 comment already lists `ed25519-dalek`, `serde_json_canonicalizer` and `sha2`; base-58 is the only addition. In verify-core: `base64ToBytes`, `extractRawPublicKey` and `ED25519_SPKI_PREFIX` exist (`primitives.ts:35`, `signature.ts:24-47`); `@noble/hashes/utils` has hex helpers but no base-58, so the encoder is written in place, keeping `scripts/dependency-budgets.json` unchanged (`check:budgets` is the gate) and the purity rules (`.claude/rules/purity.md`: no `Buffer`, no Node built-ins) satisfied — the encoder needs neither.

## What it proves, what it does not, and what a verifier must display

Proves: the key that signed this envelope is the key the identifier names, so every signature under the same `did:key` was made by the same key, and a `signer.identifier` that names a different key than the envelope's `publicKey` is a detectable substitution (the same attack check #14 rules out with a registry, spec §8.3.1 :610, §9.2 #14 :1433). Does not prove: who holds the key, that one party holds it, that the holder today is the holder yesterday, that the key is uncompromised. There is no rotation and no revocation: the method spec says so, and this spec's registry lifecycle (`active` / `deprecated` / `revoked`, §8.3.3 :651-655) does not apply because there is no registry. A compromised self-certifying key can only be abandoned; a new key is a new identifier with no link to the old one. The upgrade path (D6, out of the sprint) is an attestation in which a domain-bound signer vouches for a key.

Display, so a self-certified signer is never shown as more than it is (the wave's P8 question):

- Key-trust status `self_certified` renders in the calm tier the verifier uses for `legacy_embedded` (`apps/web/src/lib/trust-signal.ts:262-308`: `normal`, not `verified`), with `verified: false` in `KeyTrustResult` (`trust-registry.ts:53-57` defines `verified` as `active` or `deprecated_valid` only). Suggested text: label "Signed with a self-certifying key"; detail "The signer's identifier is derived from the signing key, so it proves that the same key signed everything under this identifier — not who holds the key. No registry vouches for it, and the key cannot be rotated or revoked."
- The check-#14 row must not say "matches the registry" (its `ok` label today, `trust-signal.ts:617`). Either check #14 reports a distinct status for the derived case or `self_certified` carries the identity sentence itself; ADR-0030 chooses.
- `signer.displayName` is unverified free text under this form. It must be shown as the signer's self-description ("calls itself …"), never in the position a registry-bound name occupies.
- The informational `signerIdentity` block (spec §8.8.1 :853, "MUST NOT be used as the signature subject") must not be rendered next to a self-certified signer as if it vouched for it.
- Nothing in the display may imply continuity of holder across packages beyond "same key".

## The adopter's stated condition

The adopter is the qsv project by datHere, issue dathere/qsv#4448, "Data Schematic: Replace Provenance free-text info with TypedStandards cryptographic signature", opened 2026-08-20, labels `enhancement, revisit-later, FAIRification, AI`, open. Read via `gh api repos/dathere/qsv/issues/4448` and `/comments` on 2026-09-21.

The 2026-09-13 comment (id 5649582321) reads, in full: "Revisit once TypedStandards supports something like Decentralized Identifiers" followed by the link https://www.w3.org/TR/did/.

The 2026-08-27 investigation comment (id 5440060941) names two asks under key custody and the identifier story: "**Key custody**: who signs a locally-generated dashboard? Likely `--sign-key <file>` / env var, with the publisher (a portal, an org) hosting the trust registry at their origin. Not signing must stay first-class (produce-core treats it that way too): an **unsigned envelope + envelope hash already delivers content-addressed integrity** without identity." And: "**Identifier / verify story**: a CLI artifact has no origin, so the inline commitment-view bundle (§9.4 zero-network verification) is the natural default, with hosted `/verify/<host>/<id>` links for publishers who serve their packages." Its Phase 0 asks, quoted: "spec a Data Schematic content profile + canonicalization-rule URI; settle the CLI-artifact identifier/verify story; decide whether the describegpt dictionary gets its own (AI-assisted) package or rides inside the schematic package."

Against these: `did:key` is a DID method under the DID Core Recommendation the comment links, so "something like Decentralized Identifiers" is met on its own terms; a signer with no origin gets an identifier that needs no hosted registry, which is the "CLI artifact has no origin" case; and the zero-network inline bundle the comment names verifies it. The thread says nothing beyond this, and this study says nothing beyond the thread: whether the adopter accepts this particular form, or a non-DID form, is not stated there.

## Constraints and premises, as measured

- D3 holds on the string: `did:key:` cannot be confused with the ADR-0028 package's GitHub-profile-URL identifier at `bindingTier: "pseudonymous"` (read from `package/recomputation.package.json` and its commitment view; its envelope is carried in `recomputation.commitment.json`, not in the package file). A predicate on the prefix `did:key:` (or the stricter `did:key:z6Mk`) is unambiguous.
- `packages/verify-core/src/trust-registry.ts:40-48`: seven statuses, as stated; `verified` is `active`/`deprecated_valid` only. `verifyKeyTrust` returns `registry_unavailable` without a registry (`:98-99`); `verify.ts:324-329` calls it only when both `publicKey` and `kid` are present, else `legacy_embedded` — so a self-certifying signer today lands on one of those two, depending on whether it set a `kid`.
- `checks.ts:242-290`: check #14 as stated (the contract said :240); `no_registry_identity` (`:279`) is today's answer when no registry entry names an identity; the result field is `registered`.
- `types.ts:13-18`: `bindingTier: string`, as stated.
- `packages/produce-core/src/commitment.ts:143-147`: the throw, as stated (the contract said :140).
- Spec :207 lists `pseudonymous`, `oauth`, `orcid`, `did-web`, `notarized`, "extensible", as stated. Corrected premise: the spec's own §8.3.3 registry example at :633 uses `bindingTier: "platform"`, and :646 synthesizes `bindingTier: "legacy_embedded"` for pre-v0.1 entries; the list at :207 is not the spec's only tier vocabulary. :1532 already describes the `pseudonymous` rung as "a one-time signing key with no registry-recorded human binding", which is the self-certifying signer in prose.
- `platform` and `organization` in `typedstandards`: `platform` in 18 places (verify-core tests, the web `q15-*` offline-bundle fixtures, which are captures of the reference implementation's served bundles — so `platform` is on the wire inside signed production packages), `organization` in 6 (produce-core `commitment.test.ts:30`, `attestation.test.ts`, `envelope.test.ts`, `produce-verify-roundtrip.test.ts`, `reference-golden.json`) — fixtures only, none signed by a live publisher. Neither is a violation under "extensible".
- `did:key` appears nowhere in either repository (`git grep -i`), as stated; the only multiformats mention is hub ADR-0008's rejection of numeric multihash codes for JSON ergonomics, which does not bear on an identifier string.
- Hub `docs/architecture/open-questions.md`, Q3: open, "No commitment", three candidates (ORCID, sigstore OIDC keyless, `did:web`); resolution criterion "A real publisher type emerges that GitHub OAuth doesn't fit".
- The example package carries `producerProfile: scripted-recomputation/eval-run`, `metadata.captureMethod: script-run`, no `metadata.contentProfile`, `kid eval-run-example:ed25519-2026-09` — the G0 record's two extra premises hold.

## Open points the study left for ADR-0030

Each is settled in ADR-0030's Decision section; the numbers here are the ones that record cites.

1. **Spelling.** `z` form only (recommended), or accept `u` as well.
2. **Which check reports the mismatch.** Reuse check #14's `signer_identity_mismatch` with the derived value in a field named for what it is (`derived`, not `registered`), or add a status. Either way fatal, and only when the identifier is key-derived.
3. **Where `self_certified` is decided.** `verifyKeyTrust` is not reached without a `kid`; the derived check must run on the identifier alone, before or instead of the registry path. With a registry and a `kid` also present under a key-derived identifier, decide whether the registry verdict replaces `self_certified`, is reported beside it, or is ignored. The study recommends: the self-certifying check always runs and is fatal on mismatch; a supplied registry match may raise the key-trust status to `active`, never lower the fatal result.
4. **`kid` for a self-certifying signer.** Optional; if present it need not resolve anywhere. Suggest recommending the did:key string itself, or leaving it absent.
5. **Commitment view.** `buildCommitmentView` accepts an absent `trustRegistryUrl` only when `signer.identifier` is key-derived (the D3 wording: "when the caller states the self-certifying tier" means a key-derived identifier at `pseudonymous`); every other case keeps the ADR-0024 throw. The produce-core helper derives the identifier from the caller's key; whether it also verifies the caller's stated identifier against the key before signing (recommended: yes, throw on mismatch).
6. **Tier vocabulary.** Settle `platform` and `organization`: both permitted under "extensible"; recommend the spec's list gain `platform` (it is in the spec's own example and on the wire) and mark `organization` an adopter extension; and note that :646's `legacy_embedded` is a trust status, not a tier. `self_certified` keys on the identifier, so the tier vocabulary never decides it.
7. **Q3 status note (dated).** A note on Q3 saying the `pseudonymous` rung gains a self-certifying form, and that Q3's question — the first non-GitHub identity *provider* — stays open; `did:key` binds no identity and is not a provider.
8. **Upgrade path.** Name D6's domain-vouches-for-key attestation as the way a self-certified signer later gains a binding; undecided, out of the sprint.
9. **Fixtures.** The implementing phases should mint the SPKI→did:key pair from a committed fixture key with the shipped encoder; the eval-run example key and the two RFC keys above are candidates, and the fixture rules (`.claude/rules/fixtures.md`) apply.
