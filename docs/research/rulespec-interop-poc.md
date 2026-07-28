# Rulespec Interop POC

A proof of concept composing two independently designed verification systems — The Axiom Foundation's [receipt](https://github.com/TheAxiomFoundation/receipt) witnessed-corpus verifier and this project's Typed Standards evidence envelope (`@typedstandards/verify-core`) — on a single SHA-256 digest that neither side had to negotiate with the other. Everything here is reproducible from branch `poc/rulespec-interop` via `./scripts/verify-rulespec-interop.sh`; see [Reproduction](#reproduction).

*Last updated: July 2026*

**Read the [Limitations](#limitations) section before citing any result here.** In particular: their verifier was installed from an unreleased PR branch, our package is signed with a local throwaway key that no trust registry lists, and both upstream PRs are still open, so all upstream artifacts are pre-merge.

---

## Summary

[rulespec-nz](https://github.com/TheAxiomFoundation/rulespec-nz) publishes machine-readable encodings of New Zealand statutes and regulations (`rulespec/v1` YAML). Its [PR #104](https://github.com/TheAxiomFoundation/rulespec-nz/pull/104) ("Publish a witnessed corpus an outside auditor can verify offline") adds a witnessed corpus journal: all 80 `nz/**.yaml` rule files bound by SHA-256 in an append-only journal, covered by an Ed25519-signed release manifest and two independent RFC 3161 timestamps, verifiable offline by `receipt verify`. The same PR concedes the gap this POC probes: none of those 80 encodings carry encoder apply manifests — machine-checkable records of how each encoding was produced ("no machine check asserts these rule files carry encoder apply manifests — this repo has none," PR #104 body; the backfill is tracked in their axiom-encode#1192).

The POC:

1. **Independently re-encoded** one provision — regulation 4 of the Accident Compensation (Earners' Levy) Regulations 2025 (NZ) — from the same pinned statute XML their encoding used, under a protocol in which the encoding agent never read their published encoding.
2. **Compared** the two encodings in a separate context and classified the result: **semantically different at module level**, with the shared regulation-4 rate core in exact numerical agreement (see [Comparison result](#comparison-result)).
3. **Recorded the comparison as a Typed Standards evidence package** — the package attests to the comparison event as a first-hand act by our signer; *their* artifact's digest enters the signed bytes as an **observed fact**, not a co-signed claim. This is the pivot that makes interop cheap: neither project changed formats, keys, schemas, or endpoints.
4. **Verified both legs offline**: their corpus with their verifier (`receipt verify`, exit 0) and our package with our verifier (`@typedstandards/verify-core@0.7.0`, fetch stubbed to throw, zero network calls).
5. **Joined the two systems on the digest**: the `observed_upstream_artifact_sha256` inside our signed canonical bytes equals the sha256 their witnessed journal records at entryIndex 3 equals a fresh `shasum -a 256` of the file in the pinned clone.

No production publish was made. The package is local-first, signed with a throwaway key, and the production publish (registry-listed key, real TSA, real Rekor) is a separately gated decision.

---

## Upstream project state (as of 2026-07-28)

| Field | Value |
|-------|-------|
| Organization | [TheAxiomFoundation](https://github.com/TheAxiomFoundation) |
| Corpus repo | [rulespec-nz](https://github.com/TheAxiomFoundation/rulespec-nz) — full-country NZ RuleSpec workspace |
| Verifier repo | [receipt](https://github.com/TheAxiomFoundation/receipt) — offline witnessed-corpus verification |
| Source-corpus repo | [axiom-corpus](https://github.com/TheAxiomFoundation/axiom-corpus) — pinned legal-source snapshots + release objects |
| Corpus journal PR | [rulespec-nz#104](https://github.com/TheAxiomFoundation/rulespec-nz/pull/104) — **OPEN**, head `7dd2b1ad8f13ff934aa53af562a34ea7451502f6` |
| Verifier PR | [receipt#14](https://github.com/TheAxiomFoundation/receipt/pull/14) ("Ship receipt.corpus and the spanning `receipt verify` command") — **OPEN**, head `c711adc0d0fb514b8806f83b36579e4cb4c621a7`; ships receipt 0.5.0 |
| receipt on PyPI | latest published release is **0.4.0** (`curl https://pypi.org/pypi/receipt/json`); 0.5.0 is unreleased — PR #104's own body notes "receipt 0.5.0 must be on PyPI before this merges" |
| Related upstream issues | receipt#13 (third-party verification lane), receipt#7 (generic producer-side chain machinery), axiom-encode#1192 (notary cutover / apply-manifest backfill) |

**Weaker-claim caveat, stated up front:** the `receipt` used throughout this POC was installed from the PR #14 head at git SHA `c711adc0d0fb514b8806f83b36579e4cb4c621a7` — an unreleased branch, not a published wheel. Every "their verifier passes" statement below is a statement about that branch state.

---

## Method

### Pinned environment

All pins are enforced by `scripts/verify-rulespec-interop.sh` (leg A fails if a clone drifts from its SHA or has a dirty tree):

| What | Pin |
|------|-----|
| rulespec-nz | `7dd2b1ad8f13ff934aa53af562a34ea7451502f6` (PR #104 head, fetched via `pull/104/head`) |
| axiom-corpus | `92ac9c1bedf62968eeea9a873361f49075364157` (the commit the pinned corpus release was cut from) |
| receipt | `c711adc0d0fb514b8806f83b36579e4cb4c621a7` (PR #14 head; `receipt 0.5.0`, unreleased) |
| @typedstandards/verify-core | `0.7.0` (npm) |
| Corpus release | `nz-rulespec-2026-07-20`, content sha256 `58089115f520cb99a3b90e3be503be63041ebe4a72bec69f24a2f115ed1ba196` |

**Toolchain-pin note.** A later corpus release, `nz-rulespec-2026-07-25`, exists upstream (`gh api repos/TheAxiomFoundation/axiom-corpus/contents/manifests/releases` lists both), and an earlier draft of this POC's plan referenced it. The POC instead followed the pin in PR #104's own `.axiom/toolchain.toml`, which names `nz-rulespec-2026-07-20` with the content sha256 above — because that is the corpus tree PR #104's witnessed journal actually binds (the toolchain file is itself one of the journal's seven attested files). The release manifest for `nz-rulespec-2026-07-20` is present in the axiom-corpus checkout at the pinned commit (`manifests/releases/nz-rulespec-2026-07-20.json`).

**Statute source.** The provision was encoded from the official PCO XML ingested in the pinned corpus — not scraped HTML:

- Path (in the axiom-corpus checkout): `data/corpus/sources/nz/regulation/2026-06-16-rulespec-nz-pco/regulation/public/2025/0018/wholeof.xml`
- sha256: `f675c8ac89dab2ed08c6e228b93c90c65f0d9aa29425a783790f08599ef0f574` (recomputed against the pinned clone)
- Provision id: `LMS1019194`; corpus citation path: `nz/regulation/regulation/public/2025/0018/regulation/4`

### Independence protocol

The re-encoding was produced by an orchestrated multi-agent run under a protocol stricter than originally planned: the encoding agent **never read** `earners_levy.yaml` or `earners_levy.test.yaml` at any point — not merely "drafted first, then looked." It learned the `rulespec/v1` schema from the repo's own documentation (`.axiom/repository-structure.yaml`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `docs/axiom-ecosystem-integration.md`) and four exemplar encodings of unrelated provisions (`nz/regulations/rma_district_plans/wellington_city/supermarket_zoning.yaml`, `nz/regulations/social_security/childcare_assistance/core.yaml`, `nz/regulations/student_allowances/core.yaml`, `nz/regulations/health_entitlement_cards/community_services_card/core.yaml`). Repo-wide greps during encoding were count-only, and the one recursive grep that could have surfaced the target file ran with a `grep -v earners_levy` filter and displayed nothing. The digest recomputation and semantic comparison were then done by a **separate context** that had not produced the encoding.

**Evidence basis, stated honestly:** the independence claim rests on the audited per-agent file-consultation record (the run's subagent transcripts), which is not a committed artifact on this branch. A reader who does not accept that record should treat the comparison as informative rather than adversarially independent. What *is* mechanically verifiable is byte-level non-derivation in the trivial sense: the two files differ (`eeb37719…` vs `5fe16742…`).

### The comparison event as the signed object

The evidence package does not claim to reproduce, endorse, or co-sign the upstream encoding. Its payload (`scripts/fixtures/rulespec-interop-payload.json`) records a first-hand comparison event, and the extension block `org.civicaitools.rulespec-interop` carries the upstream facts *as observed*: repo, PR number, observed commit, artifact paths, observed sha256 digests, and the journal entry indices they matched. The extension sits inside the JCS canonical bytes the signature covers — the harness prints its byte offset (1209 of 9020 in this run) as a containment proof.

### Local-signed package; production publish deferred

The package was built locally to the Typed Standards package schema and verified by the same verifier code path a production package must pass (`@typedstandards/verify-core@0.7.0`): JCS canonicalization with the `https://typedstandards.org/canonicalization/legacy-json/v1` content rule, multihash `contentHash` (`sha256: b48ea1e7eae8b8445a0ada2272ffa19953aaa7c1cc718e469437a38b6fc5a748`), envelope hash = `nodeId` = `1c376b2a56f9e4167a7bb762c8984cf60a3a9624a8316ded00e863384f191b08`, Ed25519ph over the envelope-hash hex string per spec §8.3.1.

It was signed with a **throwaway local key**, kid `local:rulespec-interop-poc-2026-07`, signer `local:rulespec-interop-poc` — deliberately *not* claiming the platform identity, and deliberately absent from the trust-registry snapshot carried in the commitment fixture (which lists only `platform:evidence-2026-04`). No TSA token, no Rekor entry, `visibility: committed`. **No production publish was made this pass** — local first, publish after review. The production publish (registry-listed key, real RFC 3161 timestamp, real Rekor inclusion) is a separately gated decision, and until it happens this POC does **not** demonstrate full-depth third-party verification of our leg — see [What a passing pair establishes](#what-a-passing-pair-establishes--and-what-it-does-not).

---

## The two verdicts

Both blocks below are verbatim from a run of `./scripts/verify-rulespec-interop.sh` on 2026-07-28 (exit code 0).

### Their verifier: `receipt verify` over the pinned rulespec-nz clone

```
receipt 0.5.0 — rulespec-nz published corpus
  root  /Users/npstorey/code/civic-ai-tools/.rulespec-clones/rulespec-nz
  spec  /Users/npstorey/code/civic-ai-tools/.rulespec-clones/rulespec-nz/verification/spec.py
        sha256 d29da2603a8d168df6596ad038fc22fe71e6a40c778c36c0611dbcff555b3fae

ESTABLISHED OFFLINE, FROM THIS CLONE ALONE
  [ok  ] custody
         1 release(s), HEAD 0000-363e52fb0f8bb41d.json; producer SPKI f703c8d871f444cd…; witnesses digicert 2026-07-26T16:38:02Z · freetsa 2026-07-26T16:38:02Z
  [ok  ] binding
         80 content file(s) and 7 attested file(s) match the witnessed journal exactly, closed-world
  [ok  ] declaration
         17 gate declaration(s) well formed and complete against the pinned spec (11 public, 6 ci-attested); none re-run here

DECLARED IN THE WITNESSED JOURNAL — NOT RE-RUN BY THIS COMMAND
  1 of 17 declared gate(s) did not pass cleanly; each is marked below.
  public: you can re-run these yourself from public inputs
    - repo/tracked-paths
    - repo/obsolete-generated-files
    - repo/layout
    - deps/commit-ancestry
    - corpus/release-object-fetch
    - corpus/provenance-commit-ancestry
    - rulespec/companion-tests
    - oracle/policyengine-coverage-classification
    - repo/pytest
    - repo/quality
    - repo/roadmap-coverage
  ci-attested: not reproducible; only the CI run's identity vouches
    - rulespec/proofs-and-claims
    - rulespec/money-proof-atoms
    - rulespec/validate-yaml
    - waivers/ratchet-audit
    - schema/retired-freeze
    - guard/manual-rulespec-changes  [DID NOT RUN — the caller sets run-generated-guard: false in .github/workflows/repository-checks.yml, so this guard was skipped on this commit]

VERDICT: PASS — custody and corpus binding
  This proves the published rule files are exactly the bytes a code-pinned
  producer key signed and the 2 pinned RFC 3161 authorities (digicert, freetsa)
  witnessed, and that nothing in the recorded history was rewritten. It does
  NOT prove that any declared gate passed, it does NOT prove the encodings
  are a correct reading of the law, and it does NOT prove this clone holds
  the producer's newest release — a stale, honestly witnessed clone also
  passes. Check freshness out of band or via --base-ref.
```

**What this does and does not establish.** The PASS covers **custody and binding only**: the 80 rule files and 7 attested files are byte-exact against an append-only journal a code-pinned Ed25519 key signed and two independent RFC 3161 authorities witnessed, closed-world (no unlisted file, no missing file), history unrewritten. The verdict's own text disclaims the rest, and their `VERIFY.md` expands it: it does **not** re-run any of the 17 declared gates (6 are `ci-attested` — not reproducible by outsiders), does **not** prove the encodings are a correct reading of NZ law, does **not** prove freshness (a stale, honestly witnessed clone passes), and one declared gate — `guard/manual-rulespec-changes`, the very gate that would demand encoder apply manifests — **did not run at all** (`run-generated-guard: false`), which the journal is required to declare precisely so its absence cannot read as a pass.

### Our verifier: `@typedstandards/verify-core@0.7.0`, offline, fetch stubbed to throw

```
=== verify-core v0.7.0 verdict (verbatim, FULL) ===
{
  "hashMatch": true,
  "envelopeIntegrity": {
    "status": "verified"
  },
  "recomputedHash": "1c376b2a56f9e4167a7bb762c8984cf60a3a9624a8316ded00e863384f191b08",
  "nodeId": "1c376b2a56f9e4167a7bb762c8984cf60a3a9624a8316ded00e863384f191b08",
  "signatureValid": true,
  "kid": "local:rulespec-interop-poc-2026-07",
  "hasSigning": true,
  "rekorVerified": null,
  "rekorDetails": null,
  "rekorInclusion": null,
  "hasRekor": false,
  "hasTimestamp": false,
  "rfc3161": null,
  "keyTrust": {
    "status": "unknown_key",
    "verified": false,
    "kid": "local:rulespec-interop-poc-2026-07"
  },
  "blobRefsVerified": null,
  "blobRefs": [],
  "contentCanonicalization": {
    "status": "ok",
    "rule": "https://typedstandards.org/canonicalization/legacy-json/v1"
  },
  "contentHash": {
    "status": "ok",
    "algorithms": [
      "sha256"
    ],
    "matched": "sha256",
    "contentHash": {
      "sha256": "b48ea1e7eae8b8445a0ada2272ffa19953aaa7c1cc718e469437a38b6fc5a748"
    }
  },
  "typeResolution": {
    "status": "ok",
    "type": "content/analysis/v1"
  },
  "signerIdentity": {
    "status": "no_registry_identity",
    "claimed": "local:rulespec-interop-poc"
  },
  "captureMethodVocab": {
    "status": "ok",
    "captureMethod": "claude-code-jsonl-readback",
    "profileType": "ai-assisted-analysis"
  },
  "lifecycle": {
    "status": "active",
    "source": "none",
    "chain": []
  }
}
=== network calls attempted: 0 ===
```

**What this does and does not establish.** The structural checks pass with zero network access: envelope hash recomputes (spec §9.2 #1), the Ed25519ph signature verifies against the embedded key (#2), the content-canonicalization rule resolves and the multihash content hash matches (#3, #4), type resolves (#12), nodeId equals the envelope hash (#13), and the captureMethod value is in the declared vocabulary (#15). But the verdict is **deliberately and honestly not green**: key trust is `unknown_key` (#5 — the throwaway key is in no trust registry), signer identity degrades to `no_registry_identity` (#14), and checks **#7 (RFC 3161 timestamp) and #8 (Rekor transparency-log inclusion) are unverified** — there is no token and no entry to verify. The harness asserts this exact shape field by field; an unexpectedly *green* #5/#7/#8 would itself fail the harness. This pass proves the digest join and the package shape. It does **not** constitute full-depth third-party verification of our leg — that requires the production publish.

---

## The digest join

The exact claim, no more:

```
extension observed_upstream_artifact_sha256: 5fe16742f55876ab33a6560793295346f3bad34912f09b7b84311436be2effed
corpus-journal entryIndex 3 sha256:          5fe16742f55876ab33a6560793295346f3bad34912f09b7b84311436be2effed
fresh shasum -a 256 (pinned clone):          5fe16742f55876ab33a6560793295346f3bad34912f09b7b84311436be2effed
```

Three independently sourced values are identical: (1) the digest recorded inside our signed canonical bytes, (2) the digest their witnessed journal binds at entryIndex 3 for `nz/regulations/acc/earners_levy.yaml`, and (3) a fresh recompute over the file in the pinned clone. (The companion test file joins the same way: `nz/regulations/acc/earners_levy.test.yaml`, sha256 `43308ecb29fc26e30819d3657f89eb531d878f7e6ffa78e3712f709acf5906a4`, journal entryIndex 2, recomputed and matched.)

**What the join is:** our signed envelope contains an **observed fact about their published artifact**, and that fact is confirmed by their own verification structure. Anyone holding our package and their clone can re-derive all three legs offline.

**What the join is not:** it is *not* a claim that our re-encoding reproduced their bytes. It did not, and was never expected to: our file hashes `eeb3771924255c2f0c8b9cd393b22b8dc19667651b62322f42017e16e504e88b` — independent YAML serializations of independently made encoding judgments do not collide.

---

## Comparison result

**Classification: (c) semantically different at module level** — with the honest counterpoint that, restricted to regulation 4's rate schedule alone, the two encodings would classify as **(b) semantically equal with byte differences**: same three rates, same effective dates (2025-04-01 / 2026-04-01 / 2027-04-01, third band open-ended), numerically identical under unit conversion — our per-$100 Money values 1.45 / 1.52 / 1.59 are exactly their fractional Rate values 0.0145 / 0.0152 / 0.0159 × 100 — and the same corpus citation path.

The meaning-bearing differences, laid out neutrally (neither reading is assumed correct):

1. **Regulation-7 routing.** Regulation 4's paragraph structure gives self-employed persons under a weekly-compensation purchase agreement the regulation-7 amount, self-employed persons within regulation 6's hours/earnings gate the regulation-6 amount — with the express exclusion "regulation 6 applies (but regulation 7 does not apply)" — and everyone else the standard rate. Our module encodes this as a derived selector with regulation-7 priority. Their module has **no routing or selector rule**: its regulation-6 derived amount (`acc_low_self_employed_minimum_levy_excluding_gst`) is gated only on regulation 6's own hours/earnings conditions, with no regulation-7 exclusion, and no rule in the module selects which amount is the levy payable for a person to whom multiple pathways apply.
2. **Module scope.** Their module spans regulations 4–9 plus extra-statutory Inland Revenue administration values (GST-inclusive rates 0.0167 / 0.0175 / 0.0183; maximum-earnings caps 152790 / 156641 / 160244; a cents-rounding scale) across 12 rules (7 parameters, 5 derived), and applies the regulation-5 earnings cap inline in its standard-levy formulas. Our module encodes regulation 4 only, across 2 rules (1 parameter, 1 derived), deferring the regulation-5 cap and the regulation-6/-7 formulas as out of scope.
3. **(Representational, not meaning-bearing.)** dtype/unit choice (Money-per-$100 vs fractional Rate) and proof-atom style — our 8 atoms all carry verbatim statute excerpts; theirs are citation-path-only with no excerpts.

**Which reading each reflects:** ours reads regulation 4 as a rate schedule *plus an exclusive routing directive*, with the regulation-6/-7 formulas external. Theirs treats the regulations package as a **component library** — parameters and standalone amounts — leaving the (b)/(c) selection and the regulation-7-priority limb unencoded, presumably for downstream composition. Both are defensible engineering positions; the divergence is exactly the kind of encoding judgment that provenance records and comparison events exist to surface.

---

## What a passing pair establishes — and what it does not

Composing the two verdicts, a party holding this branch plus the pinned clones can establish, fully offline:

- Their published encoding is byte-exact against an append-only, dual-witnessed, closed-world journal signed by a code-pinned key (receipt's PASS).
- Our comparison record is byte-exact against its own envelope hash, signed by the embedded key, with the upstream digest contained in the signed bytes (verify-core's structural pass + the containment offset).
- The digest in our signed record, the digest in their witnessed journal, and the bytes on disk agree (the triple join).

It does **not** establish — and both verifiers say so in their own output:

- That any of their 17 declared gates passed (receipt reports declarations, re-runs nothing; 6 gates are `ci-attested` and not outsider-reproducible; `guard/manual-rulespec-changes` did not run at all).
- That either encoding is a correct reading of New Zealand law (receipt's verdict text; TS spec §9.3 item 2 — correctness is a separately-signed attestation, never an envelope property).
- That the clone is fresh (a stale, honestly witnessed clone passes receipt; check freshness out of band).
- That our package is trustworthy to a third party: the key is `unknown_key`, there is no timestamp, no transparency-log entry, and no registry identity. Checks #7/#8 are unverified. Full-depth third-party verification of our leg requires the production publish, which has not happened.

---

## Findings

Observations only. Nothing was filed, and no spec, ADR, or open-questions edit was made from this POC — per the Xanadu doctrine, each item below states what it would take to act, and the gate is a real adopter need or an ADR, not a POC.

**1. No `captureMethod` value describes an encoder pipeline.** The `ai-assisted-analysis` vocabulary (spec §8.6) is `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report` — all chat/session capture mechanisms. An encoding produced by a deterministic or agentic encoder pipeline over pinned source XML has no honest label. Observed nuance from this POC itself: our comparison record's content was composed from an orchestrated multi-agent run's transcripts, which `claude-code-jsonl-readback` only approximately describes — the label names the read-back mechanism of a single session, not a composition across several. **To act:** a new vocabulary value is a Producer Profile guidance-bundle amendment (§8.6's own extension path, Q32 mechanics), gated on a named adopter publishing through it.

**2. No Producer Profile for statute encoding.** §8.6 has one built profile (`ai-assisted-analysis`); Human/Hybrid/Sandbox-only are reserved. A statute-encoding producer — the thing rulespec-nz *is* — has no profile declaring its capture vocabulary, its proof-atom discipline, or its gate expectations. **To act:** profile promotion per ADR-0006's architecture, gated on an adopter who would publish under it.

**3. No domain separation in the §8.3.1 signature.** Spec §8.3.1 signs the UTF-8 bytes of the bare envelope-hash hex string — no domain-separation tag. receipt's signing API makes the contrast concrete: `sign_payload(private_key_pem, payload, *, domain: bytes)` (receipt `sign.py:259` at the pinned SHA) *requires* a domain argument, returns a signature over `domain + payload`, and its docstring states the rationale — "``domain`` is required so every signing call names its role explicitly; a consumer that signs exact bytes with no domain states ``domain=b""`` deliberately rather than by omission." TS currently signs with, in receipt's terms, an implicit `domain=b""` by omission. Cross-protocol signature confusion is theoretical today (one key, one signing role), but the moment a TS key signs more than one artifact class, the absence becomes load-bearing. **To act:** an ADR; a domain tag changes signature bytes, so it is a versioned envelope change, not a patch.

**4. Their gate-tier taxonomy has no TS equivalent.** receipt's verdict classifies every declared gate as `public` (outsider re-runnable) or `ci-attested` (only the CI run's identity vouches), and prints DID-NOT-RUN gates with the reason inline. TS §9.2 checks are binary status plus calm-absence; there is no vocabulary for "this claim is declared but only reproducible by the publisher." The tier taxonomy is a genuinely better honesty surface for declared-but-not-re-run claims. **To act:** relevant if/when TS packages start carrying declared gate results (e.g., an encoder profile per finding 2); would be a spec addition via ADR.

**5. §8.10 asserts an append-only lifecycle; §9.2 never verifies completeness.** The spec's terminology section calls lifecycle events "Signed, public, append-only" and §8.10 mandates surfacing the chain — but §9.2 check #10 verifies only the chain *the proof carrier supplies*. verify-core's verdict in this very run shows the consequence: `lifecycle: { status: 'active', source: 'none', chain: [] }` — a publisher (or intermediary) omitting a `withdraws` attestation from the carrier still verifies green as `active`. receipt's `release_chain` module is a working answer to exactly this: "every state and append digest is recomputed from the current append-only JSONL," each release seals the previous journal rows byte for byte, so an omitted correction is a verification failure, not a silent absence. **To act:** a completeness-carrying lifecycle serialization is a spec/ADR question (it interacts with Q2's federation-substrate question); the POC only records that a proven design exists one repo away.

**6. ADR-0016 concepts map cleanly onto their model.** Three concrete correspondences, each verifiable by reading [ADR-0016](../adr/0016-vcs-native-lifecycle-mapping.md) against PR #104's artifacts:
   - **`attestation/revises/v1` / `attestation/supersedes/v1` ↔ their correction events.** ADR-0016 §C distinguishes neutral version-succession (`revises`) from corrective replacement (`supersedes`). Their journal's correction discipline — "a corrected encoding appends a new row; it cannot quietly replace an old one" (VERIFY.md) — is the same append-only correction semantic, expressed as journal rows instead of attestation nodes.
   - **`vcsRef` ↔ their git-tree anchoring.** ADR-0016 §B's optional signed `vcsRef` (repoUrl + commitSha, attests the *assertion* not the *fact*) is the TS-native form of what their gate declarations do with `subjectCommit`/`subjectScope` and what their toolchain pin does with the corpus cut commit: bind a claim to a named tree, honestly scoped.
   - **§8.10 lineage ↔ their release chain.** ADR-0016's lineage chain (one `revises` edge per revision, diff as a derivable view) parallels their release chain in which each release seals the prior journal byte-for-byte — both make history-rewriting detectable rather than forbidden by policy.
   **To act:** nothing — ADR-0016 is already Accepted; the mapping is evidence its abstractions were pitched at the right level. If a real cross-project lineage exchange is ever wanted, these are the join points.

**7. Committed-mode friction, made concrete.** The production commitment endpoint (`civic-ai-tools-website/src/app/api/evidence/[slug]/commitment/route.ts`) redacts committed records' content surface and never inlines the package — "content is creator-distributed only," by design per ADR-0010 §5's zero-location base case. This POC's package is `visibility: committed`, so had it been production-published, a third party could verify the *commitment* offline but could not obtain the package bytes — offline verification of a committed node requires creator-distributed bytes. Not a bug (it is the designed selective-disclosure property), but the POC makes the friction concrete for exactly the cross-project audience interop serves. (Terminology note: ADR-0016 §A renamed `committed` → `sealed` at the decision level; the reference implementation and this POC's fixtures still carry the legacy value.) **To act:** any change is a distribution-pattern question for a real committed-mode adopter, per ADR-0010's own Xanadu gate.

---

## Reproduction

From a clean checkout of branch `poc/rulespec-interop`:

```bash
./scripts/verify-rulespec-interop.sh
```

Requirements: `git`, `uv`, `node`/`npm`. Network is used only to fetch the pinned sources when absent (github.com, registry.npmjs.org); the verification itself is offline, and leg C stubs `fetch` to throw and asserts zero network calls. The script exits non-zero on any divergence — including an unexpectedly *green* key-trust/timestamp/Rekor result, which would mean the harness is no longer testing what it claims.

Committed artifacts on the branch:

| File | Role |
|------|------|
| `scripts/verify-rulespec-interop.sh` | Four-leg harness: pinned clones → `receipt verify` → verify-core offline → digest join |
| `scripts/fixtures/earners_levy.reencoded.yaml` | Our independent re-encoding of regulation 4 (sha256 `eeb37719…`) |
| `scripts/fixtures/rulespec-interop-payload.json` | The comparison-event payload, incl. the `org.civicaitools.rulespec-interop` extension |
| `scripts/fixtures/rulespec-interop-package.local.json` | The built package (canonical JSON, pre-envelope) |
| `scripts/fixtures/rulespec-interop-commitment.local.json` | The local commitment bundle: package + envelope hash + Ed25519ph signature + trust-registry snapshot |
| `.gitignore` (three lines) | Keeps `.rulespec-clones/` (pinned upstream clones, venv, npm harness) out of the tree |

---

## Limitations

Stated plainly; these bound every claim above.

1. **Unreleased verifier.** `receipt` was installed from the open PR #14 head (`c711adc…`), not a published wheel; PyPI's latest is 0.4.0. Their verifier's behavior at this SHA may differ from whatever 0.5.0 finally ships.
2. **Pre-merge upstream artifacts.** rulespec-nz PR #104 is open. The corpus journal, `verification/spec.py`, `VERIFY.md`, and the gate declarations are all pre-merge and may change before landing. Every digest here is pinned to the PR head commit for that reason.
3. **Local throwaway key; no full-depth verification of our leg.** verify-core reports `unknown_key` and `no_registry_identity`; checks #7 (RFC 3161) and #8 (Rekor) are unverified because no token and no log entry exist. This pass proves the digest join and package shape — nothing more. Full-depth third-party verification requires the production publish, a separately gated decision not made here.
4. **Independence rests on audited transcripts.** The never-read-the-target protocol is evidenced by the orchestrated run's per-agent file-consultation records, which are not committed artifacts. The comparison's *content* is independently checkable against both encodings; the *independence* of the re-encoding is not mechanically provable from this branch.
5. **Single provision.** One rule file, one provision, one comparison. The (c)-with-(b)-core classification says nothing about the other 79 encodings in their corpus, and the POC's findings generalize as observations, not measurements.
