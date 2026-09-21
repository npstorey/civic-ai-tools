# ADR-0029: The `scripted-recomputation` Producer Profile — deterministic tool output, its capture vocabulary, and a raw-bytes content rule

- **Status:** **Proposed** (2026-09-21) — the owner rules on it at gate G1 of Wave N14 (anchor issue typedstandards#77); **this record proposes a decision and does not take one**
- **Date:** 2026-09-21
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0006](0006-producer-profile-architecture.md) (whose profile-type list this record extends by one built type), [ADR-0007](0007-content-canonicalization.md) (whose rule-URI registry gains a third entry), [ADR-0011](0011-capturemethod-generalization.md) (whose per-profile vocabulary pattern gets its second profile), and [ADR-0028](0028-eval-run-worked-example.md) (which records the need this record answers and names itself as "the place that need would be argued from")

*Numbering note: 0028 is the highest record on `main` at drafting time; 0030 is reserved for the self-certifying signer record written beside this one; 0018 remains reserved for the roadmap-governance amendment.*

## Context

Specification v0.1.8 has one built Producer Profile type, `ai-assisted-analysis`. Its capture vocabulary (§8.6) describes three ways of capturing an AI conversation, and the fields §8.1.1 marks required — `prompt`, `queries`, `cost`, `skillMetadata`, `output`, `trace` — are shaped by that conversation. A record produced by a deterministic tool (a script or command-line program that writes a file, with no AI conversation in the path) has no honest label under it. ADR-0006 reserves `human`, `hybrid` and `sandbox-only` name-only; none of them describes a program run over pinned inputs.

Both content canonicalization rules (§8.2, §12.3) fingerprint JSON: `legacy-json/v1` the package object minus `contentHash`, `dathere-ag-jupyter/v1` the notebook extension. Neither fingerprints a file's bytes as the file holds them.

Two things need what is missing.

### A signed package that verifies with an unresolved profile

ADR-0028's worked example carries two signed record packages, which cannot be re-signed:

| Node | File in the eval-run example repository | Envelope hash |
|---|---|---|
| recomputation | `package/recomputation.package.json` | `abb93f781ae71480bf8075474facbb272f3dcc38d50eeecda79be33427924a9c` |
| retrieval | `package/retrieval.package.json` | `3637b5952f6a44e050fa0ac84d2ab58454ab7d29507dbbaf09147da7f8b37d48` |

Both carry `producerProfile: "scripted-recomputation/eval-run"` and `metadata.captureMethod: "script-run"`. Under `@typedstandards/verify-core` 0.9.0 both pass every check except #15, which reports `producerProfile_bundle_unresolved`, because the hardcoded fallback table (`profiles.ts`, described in its own comment as "the Q32 stand-in") holds only `ai-assisted-analysis`. Measured 2026-09-21 against the example's pinned verify-core: check #3 `ok` (`legacy-json/v1`), check #4 `ok` (sha256 matched), check #15 `producerProfile_bundle_unresolved` with `profileType: "scripted-recomputation"`, on both packages.

### An external tool's open issue

The qsv project by datHere opened [dathere/qsv#4448](https://github.com/dathere/qsv/issues/4448) on 2026-08-20, titled "Data Schematic: Replace Provenance free-text info with TypedStandards cryptographic signature". The issue is open and labelled `revisit-later`. Its [investigation comment of 2026-08-27](https://github.com/dathere/qsv/issues/4448#issuecomment-5440060941) distinguishes the tool's LLM-produced data dictionary from the schematic itself, a "deterministic derivation from the stats & frequency caches", which it says "Needs a content profile that **doesn't exist yet**". It lists as "Phase 0 (upstream, blocking)": "spec a Data Schematic content profile + canonicalization-rule URI", and names "the natural candidate" for what the content hash fingerprints as "the dataset + every `--dict-info` bundled input". The thread's [comment of 2026-09-13](https://github.com/dathere/qsv/issues/4448#issuecomment-5649582321) reads, in full:

> Revisit once TypedStandards supports something like Decentralized Identifiers
>
> https://www.w3.org/TR/did/

This record addresses the profile and the canonicalization rule. The identifier the 2026-09-13 comment names is the subject of ADR-0030 (forthcoming), not of this record.

**Two uses of one name.** The adopter's organization is datHere. The specification's `datHere` content profile (§8.7, ADR-0004) is the A-G envelope for AI-assisted analysis: full-text prompt, system prompt, environment metadata, a Jupyter notebook. The investigation comment makes the same distinction ("v0.1 defines exactly **one** content profile — literally named `datHere` (§8.7) — but it is the **A–G envelope for AI-assisted chat analysis**"). The profile this record proposes is not that content profile, does not extend it, and does not use its canonicalization rule.

### The Xanadu gate

Under [the Xanadu doctrine](../architecture/xanadu-doctrine.md), promotion needs a real package or adopter that needs the change, named in the promoting work. This record names both:

- **The packages blocked without it:** the ADR-0028 recomputation node (envelope `abb93f781ae71480bf8075474facbb272f3dcc38d50eeecda79be33427924a9c`) and retrieval node (envelope `3637b5952f6a44e050fa0ac84d2ab58454ab7d29507dbbaf09147da7f8b37d48`). Each is signed and verifiable, and the reference verifier cannot check either one's capture method until a profile bundle for its label exists.
- **The adopter:** the qsv project by datHere, through dathere/qsv#4448, whose investigation lists "spec a Data Schematic content profile + canonicalization-rule URI" under "Phase 0 (upstream, blocking)".

The transition is speculative-to-designed for the profile type (this record) and designed-to-built for its one fallback-table entry (Wave N14 phase P3).

## Decision

### 1. The profile type and its label

Add the Producer Profile type **`scripted-recomputation`**: a record whose content a program computed from inputs pinned by hash, so that running the same program over the same inputs recomputes the same bytes, with no AI conversation in the path.

- `producerProfile` takes the form `scripted-recomputation/<subtype>`, with a non-empty subtype the producer names (ADR-0006 §1: subtype names are open and not pre-allocated). This record registers no subtype. `eval-run` is the first in use, carried by the ADR-0028 packages. v0.1 verifiers resolve the vocabulary by profile type and do not check the subtype.
- The profile states what produced the content. It makes no claim about an execution environment; that is what separates it from the reserved `sandbox-only` type, which this record leaves reserved.

### 2. The capture vocabulary

The `scripted-recomputation` vocabulary has two values, in the manner of §8.6:

- **`script-run`** — a packaging program, run after the content's files already existed on disk, read their bytes into the package; the files are pinned by SHA-256 and no AI conversation is in the path. Verbatim by construction at the file layer; how each file came to exist (a program's run, or a retrieval) is recorded in `queries[]`, not by the label.
- **`tool-emitted`** — the program that computed the content wrote the package itself, in the same process, hashing the bytes as it wrote them. Verbatim by construction at emission; no step reads the content back from disk between computation and packaging. No package carries `tool-emitted` yet: the value rests on the adopter's published Phase 1 in [dathere/qsv#4448](https://github.com/dathere/qsv/issues/4448#issuecomment-5440060941), not on a package that exists.

The two differ as `chat-flow-stream` and `claude-code-jsonl-readback` do: under `script-run` a file sits on disk between the run and the packaging, and nothing but the package's own signed assertions binds the file to the run that wrote it; under `tool-emitted` that interval does not exist. `script-run` is the value the ADR-0028 packages carry. `tool-emitted` is the shape the adopter's investigation describes for its own Phase 1: the tool will "compute multihash digests … for the dataset and every `--dict-info` bundled sidecar; emit an unsigned JCS envelope (embedded and/or `.package.json` sidecar)".

**Verifier table (D4).** The hardcoded fallback table gains exactly one entry, `scripted-recomputation: ["script-run", "tool-emitted"]`, under a dated status note on [Q32](../architecture/open-questions.md#q32--producer-profile-guidance-doc-routing-convention). Q32 stays open: the guidance-bundle routing convention is not settled here, and the second entry is a second stand-in.

### 3. What a package under the profile carries

A package whose `producerProfile` begins `scripted-recomputation/` MUST satisfy §8.1 and §8.6, and in addition:

1. **`producerProfile`** is `scripted-recomputation/<subtype>`, subtype non-empty.
2. **`metadata.captureMethod`** is `script-run` or `tool-emitted`.
3. **`type`** is `content/analysis/v1`, the one content type v0.1 verifiers operationalize (ADR-0028 Decision 1). A later content type for this profile needs its own record.
4. **`contentCanonicalization`** is present (the field is recommended by §8.1.1; this profile requires it) and names `legacy-json/v1` or `raw-bytes/v1` (§4 below). `dathere-ag-jupyter/v1` is not admitted: this profile carries no notebook extension.
5. **`contentHash`** carries a `sha256` digest. A producer MAY list `sha3-256` or `blake3` alongside it; v0.1 verifiers recompute `sha256` only, and `blake3` is not implemented (D5).
6. **`metadata.contentProfile`** SHOULD be omitted; when present it MUST be `"default"` (§5 below).
7. **The AI-shaped required fields** are present, populated as follows. This is the rule, and it is the shape the ADR-0028 packages already carry:

   | Field | Under `scripted-recomputation` |
   |---|---|
   | `prompt` | Required as §8.1.3 defines it. `prompt.text` states the task the program performed, or the command that ran it; `visibility` is either value. |
   | `queries` | At least one entry, recording a step that produced or obtained the content: a program run, or a retrieval. Each entry SHOULD name the program in `tool` and SHOULD pin each input it read by SHA-256 in `arguments`. A step that failed is recorded under §8.1.8. |
   | `cost` | `{"model": "none"}`. The token fields are omitted: no token-billed model ran, and zeros would state that one ran and used nothing. `durationMs` MAY be given. |
   | `skillMetadata` | Present and MAY be empty (`{}`): no skill guidance and no MCP server was in the path. |
   | `output` | The program's output: an inline string or a BlobRef (§8.1.5). Under `raw-bytes/v1` it is the fingerprinted file (§4). |
   | `trace` | `{"resourceSpans": []}` when no trace was captured, which is the conformant empty OTel-shaped trace. A producer MAY carry real spans. |

8. **`summary`** SHOULD be present. **`signer`** follows §8.1.1 and §8.5. This record adds no identity requirement; a signer with no domain is ADR-0030's subject.

**Which checks enforce these.** Items 1-2 are check #15 once the table entry lands. Item 6 is the content-profile check (§5). Items 4-5 are checks #3 and #4, with #4 extended for `raw-bytes/v1` (§4). Items 3, 7 and 8 are producer obligations that no v0.1 check tests, as the §8.7.1 requirements for `datHere` are today.

### 4. The raw-bytes content rule

Register the content canonicalization rule **`https://typedstandards.org/canonicalization/raw-bytes/v1`**, versioned `v1` like `legacy-json/v1` and `dathere-ag-jupyter/v1`, and like them an identifier resolved from a verifier's local rule registry, never fetched (ADR-0007 §3).

**What it fingerprints.** Exactly one byte sequence: the bytes of the package's `output`. The canonicalization is the identity: no newline, encoding, byte-order-mark or whitespace change. `contentHash.sha256` is the SHA-256 of those bytes, the same hex string `sha256sum` prints for the file. The rule is non-circular without an exclusion, because `output` never contains the package.

**Where the bytes live, and how a verifier obtains them with no network.**

- **Inline.** `output` is a JSON string, and the fingerprinted bytes are its UTF-8 encoding. A producer MAY inline a file only when the file is valid UTF-8, since valid UTF-8 round-trips through a JSON string byte for byte and nothing else does. A file that is not valid UTF-8 MUST be supplied by BlobRef. An inline package verifies from the package alone: check #4 hashes the UTF-8 bytes of `output` and compares.
- **BlobRef (§8.1.5).** `output` is a BlobRef, and the fingerprinted bytes are the bytes it names. `contentHash.sha256` MUST equal the hex part of `output.ref`, which §8.1.5 already defines as the SHA-256 of the same bytes. Check #4 obtains the file's bytes through the verifier's injected fetcher, the route check #9 uses, and an offline verifier supplies the file as a local copy through that fetcher. ADR-0028's example does this for its retrieval node's evaluation log (15,487,293 bytes, resolved from `data/` with zero network calls). Check #4 then hashes the bytes and compares the SHA-256 with `contentHash.sha256`. Check #4 reports:
  - `ok` when the bytes are held and their SHA-256 equals `contentHash.sha256`;
  - `content_hash_mismatch` (tier `alarm`, as today) when the bytes are held and their SHA-256 differs, and also when `contentHash.sha256` differs from the hex part of `output.ref`. The second case is decided from the package alone, because no file can hash to two different signed digests;
  - **`content_bytes_unavailable`** (tier `attention`) when the bytes cannot be obtained. The status says the bytes were not checked. It is never `ok` and never `verified`-tier, and it is not `alarm`, because a missing file does not show that the content was altered. It takes the tier the site already gives envelope integrity when a named content location cannot be fetched (`unavailable` with reason `unfetchable`, tier `attention`).

  Check #9 still checks the same bytes against `ref` and `size`. Today check #9 reports a blob it cannot fetch as `fetch_failed`, which the site tiers `alarm`. This record does not change check #9, so a verifier that is not given the file still shows that line.
- **A named external file** outside a BlobRef is not admitted. The file is `output`, and a BlobRef is the one in-envelope way to point at bytes the package does not hold.

A raw-bytes package meant to verify with no side file SHOULD inline its output. A BlobRef package's checks #4 and #9 run offline only when the file travels with the §8.8 bundle. Without the file, check #4 reports `content_bytes_unavailable` and check #9 reports as §8.1.5 says today. Carrying file bytes inside the commitment bundle is not specified here: it is package-format work under [Q1](../architecture/open-questions.md#q1--package-format).

*Illustration, not a conformance claim.* The ADR-0028 recomputation node is signed under `legacy-json/v1` and stays that way. The UTF-8 bytes of its inline `output` (1,632 bytes) hash to `54ab7c6f1817f395d1685c920336e59927cfc1c5a559fd3f883f62a1a3313126`. That is the digest the package's own extension records for `analysis/out/recomputation.json`, and the digest `shasum -a 256` prints for that file in the example repository. Under `raw-bytes/v1` that value would have been its `contentHash`. For the retrieval node it would have been `93a9f3ca91499c42c533a882a04292efedf6218d74749bc0fa28350cfff1270d`, the digest its BlobRef already carries.

**More than one file is out of scope for v1.** The rule fingerprints one file. The adopter's candidate, "the dataset + every `--dict-info` bundled input", is a set, and this record does not cover it. BlobRef substitution is defined for `output`, `trace` and `skillMetadata.skillText` only, so a package has no second place to put a fingerprinted file. Three shapes work today, and none is a set rule:

1. fingerprint the primary file under `raw-bytes/v1` and pin every other input by SHA-256 in `queries[].arguments` or `extensions`, as the ADR-0028 recomputation node pins its script, input and preregistration (these digests are signed assertions covered by the envelope hash, and check #4 does not recompute them);
2. one package per file, linked by `prov:wasDerivedFrom`, as the two ADR-0028 nodes are linked;
3. the producer archives the set into one file and fingerprints the archive.

A rule over a set of files (a manifest of per-file digests, say) is a later record's decision, once a package needs check #4 to cover the set.

The rule's definition does not depend on the profile, and checks #3 and #4 read the rule, not the profile. This record admits `raw-bytes/v1` under `scripted-recomputation`. Whether other profiles may name it is not decided here.

### 5. The content-profile axis

- **Known values after this record:** `"default"` and `"datHere"`, unchanged. This record adds none. `metadata.contentProfile` is the legacy alias ADR-0006 §2 retained. A new profile says what it is through `producerProfile` and its subtype. A second name on the legacy axis would carry no additional information, and the signed packages carry no key at all.
- **Absence** reads as `"default"` (§8.1.2), as the §8.8.1 commitment view already writes it: both ADR-0028 bundles carry `contentProfile: "default"` for packages that carry no key.
- **Consistency.** The invariant stays ADR-0006 §2's: `metadata.contentProfile === "datHere"` if and only if `producerProfile` starts with `ai-assisted-analysis/datHere`, **compared only when both fields are present**. For this profile the invariant means `metadata.contentProfile` is never `"datHere"`; requirement 3.6 narrows it to absent or `"default"`. This record adds no second invariant.

**The check Wave N14 P3 implements** (a new §9.2 check; P2 assigns its number, and #16 is the next free one) reads `metadata.contentProfile` and reports one of four statuses. The tiers use the verifier's existing four (`verified`, `normal`, `attention`, `alarm`):

| Status | When | Tier | Effect |
|---|---|---|---|
| `ok` | present, `"default"` or `"datHere"`, and consistent with `producerProfile` (or `producerProfile` absent) | `verified` | none |
| `contentProfile_absent` | the key is absent; read as `"default"` | `normal` | none. This is the ADR-0028 packages' status |
| `contentProfile_unknown` | present, and neither `"default"` nor `"datHere"` | `attention` | reported, not rejected. The value is signature-covered, so it is an unrecognized identifier, not an alteration (as with `unknown_type` and `captureMethod_unknown`); consistency is not judged |
| `contentProfile_inconsistent` | present and known, `producerProfile` present, and the invariant fails | `attention` | the package is reported malformed (ADR-0006 §2); envelope integrity and signature are unaffected, and the status does not raise the verdict to `alarm` |

No status of this check is `alarm`. Both labels are inside the signed bytes, so a contradiction between them is a producer error, and it is not evidence of tampering.

### 6. Conformance of the signed ADR-0028 packages, as signed

Every requirement above holds for both packages unchanged. Recomputation: `package/recomputation.package.json`, envelope `abb93f781ae71480bf8075474facbb272f3dcc38d50eeecda79be33427924a9c`. Retrieval: `package/retrieval.package.json`, envelope `3637b595…7d48`. Both files are in the eval-run example repository, read 2026-09-21 at its commit `9031a94`.

| Requirement | `recomputation.package.json` | `retrieval.package.json` | Holds |
|---|---|---|---|
| 3.1 `producerProfile` | `"scripted-recomputation/eval-run"` | same | yes |
| 3.2 `metadata.captureMethod` | `"script-run"` | `"script-run"` | yes |
| 3.3 `type` | `"content/analysis/v1"` | same | yes |
| 3.4 `contentCanonicalization` | `".../canonicalization/legacy-json/v1"` | same | yes |
| 3.5 `contentHash.sha256` | `8ee1929871984a5d9a10d210e9311ba9da8fcd39f27c90abc78e976c89fe5427`; check #4 `ok` | `f9524561dc9b53325a7ace48fedbfd6959fff4187a73e5dd79d5bb127c9027e0`; check #4 `ok` | yes |
| 3.6 `metadata.contentProfile` | absent (metadata keys: `schemaVersion`, `packageId`, `createdAt`, `signingKeyId`, `captureMethod`) | absent (same keys) | yes; check status `contentProfile_absent` |
| 3.7 `prompt` | `visibility: "full_text"`; text states the recomputation task | `visibility: "full_text"`; text states the retrieval task | yes |
| 3.7 `queries` | one entry: `tool: "python3"`, `scriptSha256`, `inputSha256` | three entries: a scripted retrieval with `failed: true`, `failureKind: "unavailable"`; a browser retrieval; a second scripted retrieval | yes |
| 3.7 `cost` | `{"model": "none"}` | `{"model": "none"}` | yes |
| 3.7 `skillMetadata` | `{}` | `{}` | yes |
| 3.7 `output` | inline string (1,632 bytes UTF-8) | BlobRef, `ref` `blob:sha256:93a9f3ca…1270d`, `size` 15487293 | yes |
| 3.7 `trace` | `{"resourceSpans": []}` | `{"resourceSpans": []}` | yes |
| 3.8 `summary`, `signer` | present; `bindingTier: "pseudonymous"`, identifier a GitHub profile URL, trust registry carried in the bundle; check #14 `ok` | same | yes; no identity requirement is added |
| §5 invariant | not compared (`contentProfile` absent) | not compared | yes |

Expected verify-core outcomes after Wave N14 P3, on both packages: check #3 `ok`, check #4 `ok` (unchanged), check #15 **`ok`** (was `producerProfile_bundle_unresolved`), content-profile check `contentProfile_absent` (`normal`).

## Considered and rejected alternatives

- **Use the reserved `sandbox-only` type.** Rejected. That type describes an execution environment (a sandbox-executed pipeline), and neither signed package claims one. The signed packages also carry `scripted-recomputation`, so any other type leaves them unresolved.
- **Mint a content-profile value for this profile** (the investigation proposes "a `data-schematic` (or similar) content profile"). Rejected. It would put the profile's name on the legacy alias axis as well, the signed packages carry no key, and making one required would fail them. A producer's own conventions go in the subtype segment of `producerProfile`.
- **Require `raw-bytes/v1` under this profile.** Rejected. The signed packages use `legacy-json/v1`, which remains correct for content that is the package itself.
- **Normalize text in the rule** (line endings, encoding, a trailing newline). Rejected. The rule is useful because its digest equals the file's ordinary SHA-256, which anyone holding the file can check with standard tools. Normalization would break that and add a place for implementations to disagree.
- **A multi-file rule now.** Rejected for v1 (§4). No package yet needs check #4 to recompute over a set, and the set's manifest shape is a design question in its own right.
- **Implement `blake3`** (the investigation notes the tool "already ships blake3"). Rejected under D5: `sha256` stays the required default, and a verifier would take on a dependency.

## Consequences

- **The ADR-0028 packages resolve.** Once P3 lands the table entry, check #15 reads `ok` on both, and the line ADR-0028 counted as its cost goes away. No byte of either package changes.
- **A package can carry a file's ordinary SHA-256 as its content hash.** Under `raw-bytes/v1` a file's holder can match the signed digest without any Typed Standards code.
- **Specification text (Wave N14 P2) this record licenses:**
  - §6.2 and §8.1.1: the glossary and field rows gain `raw-bytes/v1` and the `scripted-recomputation` type, and `content/analysis/v1` is no longer described as the AI profile's alone.
  - §8.1.1: the unconditional "iff" in the `producerProfile` row is aligned with ADR-0006 §2's "when both fields are present".
  - §8.1.2 and §8.1.7: the known `contentProfile` values, and `cost.model: "none"`.
  - §8.2 and §12.3: the third rule and what it fingerprints.
  - §8.6: the second profile's vocabulary.
  - §8.7: the second profile's requirements.
  - §9.2: #3, #4 and #15 as amended, and the content-profile check with a number.
  - Appendix G: the revision.
- **Verifier and site work.** Wave N14 P3 covers the rule registry, the table entry, and the content-profile check. It also covers the content-hash path for `raw-bytes/v1`, which for a BlobRef is an async path: check #4 fetches through the injected fetcher, as check #9 does. That path adds the status `content_bytes_unavailable` to check #4's list, and the site needs a tier (`attention`) and a sentence for it. The site's capture-method labels (`CAPTURE_METHOD_LABELS`, keyed by every `CaptureMethod` value) will need a sentence for each new value once verify-core widens the union.
- **Not settled here:** Q32's routing convention; a signer with no domain (ADR-0030); a set-of-files rule; `blake3`; Q7, which closes when the first non-AI profile is built, not when one is proposed.

## References

- ADR-0028 and its example repository (packages, `docs/verify-output.txt`, `analysis/out/recomputation.json`), read 2026-09-21 at `9031a94`.
- `@typedstandards/verify-core` 0.9.0 (as pinned by the example) and `typedstandards` `6b34aa3`: `packages/verify-core/src/profiles.ts:10-16`, `canonicalization.ts:20-30` and `:99-116`, `checks.ts:65-95`, `:140-190` and `:311-337`; `apps/web/src/lib/trust-signal.ts:40-47` (the four tiers) and `:642-668` (check #15's tiers).
- Specification v0.1.8: §8.1.1-§8.1.2, §8.1.5, §8.1.7, §8.2, §8.6, §8.7, §8.8.1, §9.2, §12.3.
- [dathere/qsv#4448](https://github.com/dathere/qsv/issues/4448), its [2026-08-27 investigation comment](https://github.com/dathere/qsv/issues/4448#issuecomment-5440060941), and its [2026-09-13 comment](https://github.com/dathere/qsv/issues/4448#issuecomment-5649582321), read 2026-09-21.
- [The Xanadu doctrine](../architecture/xanadu-doctrine.md); [Q32](../architecture/open-questions.md#q32--producer-profile-guidance-doc-routing-convention).
