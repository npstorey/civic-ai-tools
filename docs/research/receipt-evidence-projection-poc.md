# Evidence-record projection POC

**Status:** research; build only. Nothing here is published, and publication is out of scope for this
branch. Not a decision — decisions land in [`../adr/`](../adr/) and the
[open-questions registry](../architecture/open-questions.md).
**Branch:** `evidence-projection-v1`.
**Date:** 2026-08-26.
**Reproduce:** `./scripts/verify-evidence-projection.sh` (after `npm ci`).

---

## What this demonstrates

One record emitted by `receipt.evidence.emit_evidence_record` — a
`receipt/evidence-record/v1` record, the non-authorizing record type — projected **one-way** into one
Typed Standards `content/analysis/v1` node, signed locally, and verified offline by
`@typedstandards/verify-core` 0.9.0 with `fetch` stubbed to throw.

It is the second execution of the join that `poc/rulespec-interop` performed by hand, against a
different artifact type, and it carries that POC's subject rule forward unchanged.

**The subject rule (non-negotiable).** The foreign artifact's digest enters our signed bytes as an
**observation**, never as a co-signed claim:

- `packageHash`, `nodeId` and `contentHash` are **ours** — computed over our own envelope, exactly as
  for any other node. None of them is, or could be, the record's digest.
- The record's digest, its bytes, its body sidecar, its producer signature and its signing domain all
  live under one reverse-DNS extension key, marked `co_signed: false`.
- `receipt`'s producer claim never becomes this node's `signer`.

Signing this node asserts *"we observed these bytes and this is their digest."* It does not re-assert
`receipt`'s claim and does not extend our key's authority over `receipt`'s producer key.

## The artifacts

| Artifact | Value |
|---|---|
| Evidence record | `scripts/fixtures/0000-e7d6e3062de1a62a.json`, 376 bytes |
| Record sha256 | `e7d6e3062de1a62a079ce2929431bf1397c4afbafe024a73149a929f7cfb5953` |
| Body sidecar | `scripts/fixtures/0000-e7d6e3062de1a62a.body.json`, 292 bytes |
| Producer signature | `scripts/fixtures/0000-e7d6e3062de1a62a.producer.sig.b64` — base64 of the 64 raw bytes |
| Body sha256 | `dc9cc260e4286a8fbe56b0219dd1aaa91d7cd901647d15e1285f1578c7744e87` |
| Node id (`packageHash`) | `50064e8a3c0e3d123722203d0d43e4533cd49bee898de2c221aec01d3f302006` |
| Node `contentHash.sha256` | `028b4e6a45ed400d7872894cecd669c753ab154edb8cc43471cc8b1b44d0d365` |
| Node signing `kid` | `local:evidence-projection-poc-2026-08` (throwaway; deliberately not in any registry) |
| Extension key | `org.civicaitools.receipt-evidence-projection` |
| Record source | `npstorey/receipt` @ `evidence-record-v1`, commit `9108403189bd211e5d98536afa5a6350426daab3` |

Neither signing key is committed. Both are derived as SHA-256 of a committed ASCII **label**, so the
tree carries no private key material and anyone can rederive them. The two keys are different keys, so
nothing in the signature-crossing result below is an accident of sharing one keypair.

**No fixture in this tree is binary.** `receipt` emits its producer signature as 64 raw bytes; it is
committed as base64 text and decoded by leg A into a gitignored scratch directory for the legs that
need the bytes. A raw blob kills the pre-push sensitivity guard's `awk` stage with
`towc: multibyte conversion failure`, which leaves that file *silently unscanned* on every push — a
guard that fails quietly is worse than one that fails loudly. Base64 is injective, so nothing is lost:
leg F still compares the emitted signature byte for byte.

## The verdict is honestly not green

`verify-core` 0.9.0, offline, zero fetches:

| Check | Result |
|---|---|
| #1 envelope integrity | `verified`, `hashMatch: true` |
| #2 signature | `signatureValid: true` (against the embedded key), `Ed25519ph` |
| #3 content canonicalization | `ok` — `legacy-json/v1` |
| #4 content hash | `ok`, matched `sha256` |
| **#5 key trust** | **`unknown_key`** — the throwaway key is not in the registry snapshot |
| #7 RFC 3161 | **unverified** (calm-absent) — no token exists |
| #8 Rekor | **unverified** (calm-absent) — no log entry exists |
| #9 blob refs | vacuous |
| #10 lifecycle | `active` / `none` |
| #12 type resolution | `ok` — `content/analysis/v1` |
| #13 nodeId | equals `packageHash` |
| **#14 signer identity** | **`no_registry_identity`** |
| #15 captureMethod vocab | `ok` |

The harness asserts this shape **field by field**, and a green `#5`, `#7`, `#8` or `#14` **fails** it.
That guard is itself tested: injecting the throwaway key into the registry snapshot makes the runner
exit non-zero on `#5 keyTrust must be unknown_key`. This branch publishes nothing, mints no registry
key, obtains no timestamp and logs no entry — a green result there would mean the harness was lying
about what it verified.

## Findings against the design note's §6

The projection rule in the planning note's §6 was treated as a **claim under test**. Its hazard list
holds. Its **field table does not**: six of its eight rows are wrong, and three of those are
reproduced as runnable negative controls in leg D. Only rows 6 (producer signature —
*not projectable*) and 8 (`createdAtUtc` — informational only) survive intact.

Full detail, including what each row should say instead, is in the report accompanying this branch.
The short form:

1. **`packageHash` cannot take a foreign digest.** It is the envelope hash of our own package —
   computed, not assigned. Also conflates two distinct fields (`packageHash` vs `contentHash`).
2. **`contentHash` does not fingerprint carried foreign bytes.** Under both defined rules it is
   SHA-256 of the JCS canonicalization of a *JavaScript object* (the package minus `contentHash`, or
   the notebook), never of bytes carried verbatim.
3. **`contentCanonicalization` must not name `receipt`'s rule.** Check #3 resolves the URI against a
   closed local registry: an unrecognized URI degrades #3 to `unknown_canonicalization_rule` and
   cascades #4 to `unresolved_rule`. The field describes *our* package's rule.
4. **`recordIndex` / `previousRecordSha256` do not project onto §8.10.1.** That section is a chain of
   separately-signed attestation nodes about our own node, linked by `nodeId`. The two link types can
   never be equal.
5. **`producer` must not project onto `signer`.** `signer` is check #14's subject, resolved against the
   registry entry for *our* `kid`; a foreign producer there asserts they hold our signing key.
6. **An RFC 3161 token does not project into `rfc3161Timestamp`.** The row calls this "re-encoded, not
   re-issued", implying the token carries over. It does not: check #7 verifies a token's
   `messageImprint` against *our* `packageHash` (`verify.ts:298`, `rfc3161.ts:297`), and `receipt`'s
   token attests a `receipt` digest. Re-encoding DER to base64 changes the encoding, not the subject.
   Source-cited, not executed — see limitation 5. Moot for the evidence-record variant, where v1
   *refuses* a `.tsr` sidecar, so the row has no analogue at all.

Two further observations, neither a defect in the note's hazard list but both worth adding to it:

- **The body sidecar carries the same trailing-LF trap** as the record. `body.sha256` is
  SHA-256 of `canonical_bytes(body) + b"\n"`. The note's hazard 2 names only the record.
- **`standing` has no Typed Standards field to land in.** There is no non-authorizing framing in the
  spec, so the literal is carried in the extension as an observation.

Measured, on this record: `receipt`'s `canonical_bytes` is **byte-identical** to RFC 8785 JCS, and the
trailing LF is the entire difference (375 vs 376 bytes). That is not guaranteed in general and the
projection does not rely on it — the bytes are carried verbatim.

## The harness

`./scripts/verify-evidence-projection.sh` — six legs, exit non-zero on any divergence.

| Leg | What it does |
|---|---|
| A | preflight: pinned `produce-core` 0.3.0 / `verify-core` 0.9.0 resolvable from this repo's `node_modules`; every committed fixture present; package fixture matches the commitment bundle |
| B | offline `verify-core` verification; verdict asserted field by field; subject rule enforced; every observation asserted to sit inside the signed JCS bytes |
| C | the digest join — four independent readings of the record's sha256 (fresh `shasum`, the node's signed extension, a recomputation over the bytes carried inside the signed package, and the 16-hex prefix `receipt` put in the filename), asserted to one value |
| D | the hazards, executed: the trailing-LF trap in both directions, a four-way proof that no signature crosses, and three §6 table rows built as negative controls |
| E | mint reproducibility — re-mint and diff; the three minted fixtures come back byte-identical |
| F | **optional** — re-run the emitter against a pinned `receipt` clone and assert the record, body and signature are byte-identical to the committed fixtures. Skipped with a notice when the clone is absent |

Legs A–E make **zero network calls**: `fetch` is stubbed to throw in every Node runner and the count is
asserted to be 0. Leg F needs network only the first time, to clone the pinned source.

`buildRekorProposal()` and `buildTimestampRequest()` are never called. They only build request bodies a
caller would have to submit, and nothing is submitted from this branch.

## Limitations

Stated plainly; these bound every claim above.

1. **Local throwaway keys; no full-depth verification.** `verify-core` reports `unknown_key` and
   `no_registry_identity`; checks #7 and #8 are unverified because no token and no log entry exist.
   This pass proves the digest join, the signature separation and the package shape — nothing more.
   Everything inside the spec-content boundary was verified; none of the spec's external anchors (the
   published trust registry, the RFC 3161 TSA, the Rekor log — spec §7.3) were.
2. **Unmerged record type.** `receipt/evidence-record/v1` lives on a fork branch and has not been
   opened as a pull request upstream. Its shape may change, and every digest here is pinned to
   `9108403` for that reason.
3. **One record, genesis position.** `recordIndex: 0`, `previousRecordSha256: null`, `refs: []`. The
   chain-position and `refs` projections are **not exercised** — finding 4 above is derived from the
   spec and the verifier's code, not from a built counter-example.
4. **`captureMethod` is a nearest fit, not an honest label.** No value in the
   `ai-assisted-analysis` vocabulary describes projecting a foreign artifact; the node carries
   `claude-code-jsonl-readback`. This is the same gap `poc/rulespec-interop` recorded as its finding 1,
   reached from a second direction — check #15 *rejects* out-of-vocabulary values, so an honest label
   is structurally blocked rather than merely absent.
5. **Finding 6 is source-cited, not executed.** No RFC 3161 token was built to demonstrate the
   `messageImprint` mismatch: v1 evidence records refuse a `.tsr` sidecar, so none exists, and
   fabricating one to fail a check would prove nothing the cited lines do not already state. It is
   the one finding here resting on reading the verifier rather than running it.
6. **The body is a domain event about this branch.** It states what was built, not a civic-data
   finding. Nothing about the projection depends on its contents; `receipt` has no opinion about body
   schemas and neither does this node.
