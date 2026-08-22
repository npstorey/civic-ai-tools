# Trust and evidence

**Audience.** Government partners, journalists, data editors — any reader who needs to know what a record package on civicaitools.org actually claims, and what it does not. It is written for a non-specialist. You do not need to be a cryptographer to read it, and it assumes you are deciding whether records produced by this kind of instance are worth relying on.

**Status.** Living document. The trust and reliability commitments it describes are refined alongside Section 3 of [`ROADMAP.md`](../ROADMAP.md).

## What this document is, and what it is not

The [Typed Standards Specification](architecture/typed-standards-specification.md) already carries the protocol-level threat model. §10.1 names the adversaries the envelope is designed to detect. §10.2 names the threats it explicitly does not address. §9.2 enumerates the fifteen checks a verifier performs on a node. §9.3 names what no verifier can determine from any combination of public sources.

This document is the **reference-implementation companion** to those sections. It describes what a signature on a record published by *this* codebase establishes — by capture method, by field, by visibility state, by signing tier — and it **cites the specification rather than restating it**. Nothing here is normative. Where a sentence below and the specification appear to disagree, the specification governs; treat the disagreement as a defect in this document and report it.

The design stance the whole system rests on is *disclosure, not validation*: every label, badge, and status on a record page tells you about **process, not truth** (`civic-ai-tools-website/docs/design-principles.md` Principle 1, `:23-29`). Nothing in this document should be read as the platform vouching for an analysis. It cannot, and it does not try to.

### How the facts below were measured

Every statement about what the code does was read off source at a fixed point. Nothing was executed.

| Repository | Commit | Measured |
|---|---|---|
| `civic-ai-tools` (this repo) | `ec608e6` | 2026-08-22 |
| `civic-ai-tools-website` (the reference implementation) | `f943e98` | 2026-08-21, re-verified 2026-08-22 |
| `typedstandards` (the portable verifier) | `08d6af9` | 2026-08-21, re-verified 2026-08-22 |

**Three verifier environments exist, and they are not interchangeable.** Any sentence below of the form "the verifier does X" names which one was read:

- **The portable library** — `@typedstandards/verify-core`, read as source at `typedstandards/packages/verify-core/src/`. This is the code every environment runs for the §9.2 checks.
- **The neutral client-side verifier** — the standalone browser verifier at `typedstandards/apps/web/src/lib/`, which anyone can point at a record from any publisher.
- **The reference implementation's server-side surfaces** — the publish route, commitment route, and detail page at `civic-ai-tools-website/src/`.

A finding about one is not a finding about the other two, and conformance observations below are scoped to the environments actually measured — never to "all verifiers."

## The generation gap

Here is the one sentence a security reviewer most needs:

> **The platform signs what was submitted to it. It does not sign what was generated.**

The specification says this in its own words: a package's signature attests that the package was published and has not been altered since; it does **not** attest that the content matches what was generated in the original session — "that property is structural and follows from the capture method" (§8.6, `:680`). §9.3 lists the same fact first among the things a verifier cannot determine (`:1415`). ADR-0003 (`:33`) is where the project first recorded it.

`captureMethod` is the field that tells you which mechanism stood between the model and the signature. It is inside the signed canonical JSON, so it cannot be silently re-described after the fact (§8.6, `:678`; §9.2 #11, `:1405`). What follows is what each labeled mechanism actually is, in this implementation, today.

Two facts about the two shipped paths are load-bearing, and neither is obvious from the labels.

**The Claude Code path transcribes under instruction; it does not mechanically read the session log.** `publish.py` never opens a session JSONL. Its only file reads are the saved-credentials file (`.claude/skills/publish-record/publish.py:189`) and the caller-supplied `--payload` JSON (`:1762`). The readback that the `claude-code-jsonl-readback` label names is a **procedural instruction to the publishing model** (`.claude/skills/publish-record/SKILL.md:125-127`, `:133`, `:137-143`), which transcribes the session's content into the payload. That section of the guidance is addressed to the publishing model throughout (`SKILL.md:74`, `:117`). The skill's test suite states its own coverage boundary in the same terms: “The publishing model’s full JSONL-readback pipeline is end-to-end-tested by actual publishes; these tests cover only the gates that publish.py itself enforces” (`.claude/skills/publish-record/test_publish.py:5-7`). The one mechanical guard is a **leak-marker scan** — the script rejects a payload whose `prompt`, `output`, or `turns[].content` contains `<thinking>`, the literal `tool_use`, a `toolu_…` identifier, or a `signature:` field (`publish.py:567-609`, patterns at `:129-136`). That scan detects one specific artifact class of paraphrase. It does not detect fabrication, and it does not cover `title`, `summary`, `toolCalls[].args`, or `tokenUsage`.

**The chat-flow path has a mechanical capture layer, but the platform keeps no copy of what it captured.** The server builds the analysis trace while the model is streaming (`civic-ai-tools-website/src/app/api/compare-stream/route.ts:192`, finalized and emitted at `:206-209`). Neither stream producer — `src/app/api/compare-stream/route.ts` nor `src/app/api/query-notebook/route.ts` — writes to the database, and the schema has no chat or message table (its six tables are `users`, `evidence_records`, `attestation_packages`, `attestation_nodes`, `device_codes`, `api_tokens`; `src/lib/db/schema.ts`). The publish dialog posts the answer content back from the browser (`src/components/PublishEvidenceDialog.tsx:191-193`). Stated exactly: **the platform streams the bytes to the browser, retains no server-side copy, and at publish signs the bytes the browser returns.**

Both paths are weaker than their labels read, and they are weaker in *different* ways. That difference is the whole reason the label exists.

## Table 1 — what the signature attests, by capture method

Exactly three `captureMethod` values ship for the `ai-assisted-analysis` Producer Profile (`typedstandards/packages/verify-core/src/profiles.ts:10-16`), which the specification also lists at §8.6 `:672-674`. Records published before 2026-04-29 carry no value at all, which is the fourth row.

| Capture method | What the signature attests | What it does not attest | Trust root |
|---|---|---|---|
| **`chat-flow-stream`** — the website chat flow | The package's exact bytes are unaltered since signing (§9.2 #1–#2, `:1395-1396`), and the capture-method label is itself inside the signed bytes (§8.6, `:678`) | That the content matches what was generated in the original session (§8.6, `:680`; §9.3 #1, `:1415`). Not correctness (§5.3, `:147`; §10.2, `:1457`) | Platform-attested **at capture**; client-submitted at publish |
| **`claude-code-jsonl-readback`** — the publish skill | Identical envelope properties: bytes unaltered since signing; the label is signature-covered | The same, plus: that any readback from a session log occurred | User-attested |
| **`claude-code-self-report`** — deprecated 2026-04-28 (ADR-0003 `:47`) | The same envelope properties | The same, plus: the text is a paraphrase by construction (§8.6, `:674`) | User-attested, with paraphrase by construction |
| **`null`** — records published before 2026-04-29 | Envelope integrity and signature mathematics still hold; pre-v0.1 packages verify under the legacy canonicalization chain (§9.2 #1–#2; §8.6, `:682`) | Anything about capture. There is no label | Unknown |

**Which check reads the label.** Two of the fifteen §9.2 checks touch `captureMethod`: #11 reads the value and renders it beside the signature verdict (`:1405`), and #15 confirms the value is in the Producer Profile's declared vocabulary (`:1409`). **Neither check tests whether the labeled mechanism actually ran.** For a record with no capture method, #11 reads nothing and #15 reports the explicitly neutral, non-rejecting status `no_capture_method` (`typedstandards/packages/verify-core/src/checks.ts:287-292`).

### What could be changed before signing, by method

The specification's threat model calls this class **pre-signing fabrication** and names one instance of it explicitly — a publisher self-asserting a `vcsRef` (§10.1, `:1453`). The class is broader than that one field, and it is not a threat the envelope is designed to detect (§10.2, `:1461`: an AI that fabricates plausible-looking output "produces packages whose envelope verifies cleanly").

- **`chat-flow-stream`.** The server captures the bytes, but the content round-trips through the browser before publish: the client holds it (`civic-ai-tools-website/src/hooks/useStreamingComparison.ts:501-505`) and posts it back (`src/components/PublishEvidenceDialog.tsx:191-193`). Because no server-side copy is retained, the publish route cannot compare what it signs against what it captured.
- **`claude-code-jsonl-readback`.** The session log on disk is an ordinary editable file, and — per the finding above — the publishing model transcribes rather than the script reading. So the content need not have passed through a session log at all. The leak-marker scan is the only mechanical check, over three of the payload's fields.
- **`claude-code-self-report`.** Everything above, plus paraphrase by construction. The value is retained as vocabulary so that pre-2026-04-28 records carry their actual capture method "rather than silently re-described as something they were not" (§8.6, `:674`). The skill never sets it (`SKILL.md:124`), though `publish.py` accepts it if a payload supplies one (`publish.py:117-121`, `:724-728`).
- **`null`.** Unlabeled and unbounded — the class of records the capture-method discipline was introduced to make legible (ADR-0003 `:35`).

### The label is a self-assertion the server does not cross-check

**This is a measured gap in the reference implementation, and it is registered.** The publish route validates `captureMethod` against the Producer Profile's vocabulary and nothing else (`civic-ai-tools-website/src/app/api/evidence/route.ts:231-240`); it never checks the value against the authentication path the request arrived on (`:134-147`). The value is taken verbatim from the request body (`:282`). A client holding a valid bearer token can therefore submit `chat-flow-stream` on a record the chat flow never produced, and the vocabulary check will pass. On the skill side the same holds: `claude-code-jsonl-readback` is a default a payload may override (`publish.py:122`, `:724-728`, `:1187`).

Nothing in the envelope is wrong when this happens — the label is faithfully signed, and #11 and #15 both report exactly what they are specified to report. What is absent is any binding between the label and the mechanism. Registered as [Q70](architecture/open-questions.md) in the open-questions registry; no fix is asserted here.

### The reader-facing labels, verbatim

Two different sets of reader-facing strings ship. Both are quoted character-exact.

**The record detail page and the neutral verifier** render an identical set — the strings at `civic-ai-tools-website/src/lib/evidence/trust-signal.ts:496-499` and `typedstandards/apps/web/src/lib/trust-signal.ts:569-572` are byte-identical:

| Capture method | Label |
|---|---|
| `chat-flow-stream` | `Captured from the live chat as the analysis was generated.` |
| `claude-code-jsonl-readback` | `Reconstructed from the Claude Code session transcript.` |
| `claude-code-self-report` | `Summarized by the AI from its own session memory (deprecated capture method).` |
| `null` | *no line is rendered* |

These labels are **deliberately untiered**: check #11 is not a pass/fail signal and is "never assigned a tier" (`trust-signal.ts:488-493`). A record with a deprecated capture method is not marked worse; it is marked differently.

**The downloadable notebook bundle** uses a different set entirely (`civic-ai-tools-website/src/app/api/evidence/[slug]/bundle/route.ts:96-103`): `Web chat (wire-layer verbatim)` · `Claude Code (JSONL verbatim)` · `Claude Code (self-report, deprecated)` · `Unknown`.

If you are comparing a record page against a downloaded bundle, expect the wording to differ. Reconciling the two sets is tracked outside this document.

### One more thing the labels do not say

For a record published before 2026-04-29, the detail page renders **no capture-method line at all** — `resolveCaptureMethodLabel` returns `null` for an absent value (`trust-signal.ts:513-514`) and the component omits the line (`src/components/evidence/EvidenceActions.tsx:176`, `:258`). Absence of the line means "this record predates the discipline," not "this record was captured somehow." Read it that way.

## Table 2 — what is captured verbatim, and what the publishing model wrote

ADR-0003 `:49` draws the line that matters most to a reader: a field is **verbatim-by-construction** if its value was captured at a non-paraphrasing layer, and **inherently model-authored** if the publishing model produces it for the package's metadata. The ADR names `title` and `summary` as model-authored *even under a verbatim capture method*, and it deliberately declined to enumerate the rest, routing "concrete classification lists" to implementation work (`:60`).

**This table is that list.** It classifies as ADR-0003 `:49` directs. It asserts no new principle. Each cell names where the value is produced.

| Field | `chat-flow-stream` (website chat flow) | `claude-code-jsonl-readback` (publish skill) |
|---|---|---|
| `prompt.text` | **Verbatim-by-construction** — your own typed question, carried through the client to the route (`PublishEvidenceDialog.tsx:192` → `api/evidence/route.ts:272`). Never model-produced | **Verbatim by instruction** — `SKILL.md:125` requires it byte-for-byte from the session log; the publishing model transcribes it (`publish.py:1170`). Leak-scanned (`publish.py:578-580`) |
| `output` | **Verbatim-by-construction at the wire layer**, qualified by the client round-trip above (`PublishEvidenceDialog.tsx:193` → `route.ts:273`) | **Verbatim by instruction** — `SKILL.md:126`; model-transcribed (`publish.py:1171`). Leak-scanned (`publish.py:581-583`) |
| `queries[]` (from `toolCalls`) | **Verbatim-by-construction** — derived from the server-built trace's tool spans (`compare-stream/route.ts:192`), submitted at `PublishEvidenceDialog.tsx:194` | **Model-transcribed** — `SKILL.md:143` instructs copying `tool_use.input` verbatim; the model writes the array and `publish.py` shape-validates only. **Not leak-scanned** — the scan covers `prompt`, `output`, `turns[].content` only (`publish.py:578-588`) |
| `trace` | **Verbatim-by-construction** — built server-side during the run and finalized at `compare-stream/route.ts:206-209` | **Synthesized, not captured** — `publish.py` *constructs* a minimal OpenTelemetry trace from the payload's `toolCalls` (`publish.py:5`, builder at `:426-507`). No trace was captured in the original session |
| `skillMetadata.skillText` / `systemPromptHash` | **Verbatim-by-construction** — extracted server-side from the trace's skill-fetch span (`src/lib/evidence/packager.ts:388`) | **Model-supplied** — whatever the payload passes as `skillText` (`publish.py:1205`) becomes the record's claim about its own guidance |
| `cost` (`tokenUsage`, `durationMs`, `model`) | **Verbatim-by-construction** — usage from the model API response (`PublishEvidenceDialog.tsx:195-198` → `packager.ts:440-446`) | **Model-summed by instruction** — `SKILL.md:133` forbids estimation and prescribes the summation; the model writes the numbers (`publish.py:1183`). Unscanned. ADR-0003 `:34` records the ~14× prompt-token error this instruction exists to prevent |
| `title` | **Inherently model-authored, then human-editable** — seeded as a default and edited in a form field (`PublishEvidenceDialog.tsx:68`, `:334`) | **Inherently model-authored** — `SKILL.md:121` says so in those words |
| `summary` | **Inherently model-authored — by a *different* model than ran the analysis.** Generated by `google/gemini-3.5-flash-lite` (`src/app/api/evidence/generate-summary/route.ts:6`), which its own source calls "a convenience feature, not an attestation" (`:25`) | **Inherently model-authored** — `SKILL.md:122` |
| `metadata.captureMethod` | **Self-asserted label** — hardcoded client-side (`PublishEvidenceDialog.tsx:202`); vocabulary-validated only (`route.ts:231-240`) | **Self-asserted label** — defaults to `claude-code-jsonl-readback` (`publish.py:122`); a payload may override it |
| `signer` | **The instance operator's identity, not yours** — default-filled from the active signing key (`route.ts:289` → `src/lib/evidence/signing.ts:123-124` → `src/lib/site-config.ts:403-426`) | Same. `publish.py` sends no `signer` field (`publish.py:1168-1197`) |
| `provenance` (W3C PROV-O) | **Platform-derived** — three agent classes, all `prov:SoftwareAgent`: the model, the MCP source servers, and the platform (`packages/civic-typed-harness/src/capture/provenance.ts:193-201`, `:235-242`, `:261-267`). **No `prov:Person` node exists** | Identical structure, derived from the *synthesized* trace |
| `vcsRef` | **Never emitted.** No code path in any of the three repositories writes this field | Never emitted |
| `metadata.createdAt`, `packageId`, `signingKeyId`, `contentHash`, `contentCanonicalization`, `type` | **Platform-derived at packaging time** (`packager.ts:432-459`) — identical under both methods | Same |

**How to read this table.** The last row is a third category that ADR-0003's two-way distinction does not cover: fields the packaging step computes, which neither the session nor the publishing model authored. Naming it as a third category is a description of the code, not a proposed amendment to ADR-0003.

The sharpest per-method difference in the table is `trace`. On the chat-flow path it is a recording of what happened. On the skill path it is a reconstruction assembled at publish time from the tool calls the payload declares. Both render the same way on a record page.

## Table 3 — visibility state and signing tier

Records exist in three states that matter to a reviewer. A government instance will plausibly run all three: sealed drafts, published records, and an unsigned instance during its first hours.

| State | What the signature establishes | What a reader can conclude | What a reader cannot conclude |
|---|---|---|---|
| **public + signed** | The full §9.2 chain: bytes unaltered, signed by a registry-listed key, RFC 3161-timestamped, Rekor-included — plus the `attestation/publishes/v1` + `attestation/locatedAt/v1` pair, each independently signed, timestamped, and logged (`src/lib/evidence/publication.ts:119-138`) | This record was published by this instance, has not changed, existed by the timestamped moment, and its publication is on a public append-only log | Correctness (§10.2, `:1457`); that the content matches the original session (§9.3 #1, `:1415`); absence of coercion or conflict of interest (§9.3 #3, `:1417`); who the human submitter was, from the signed bytes |
| **sealed + signed** | The same cryptographic commitment, minus content disclosure. The commitment endpoint is **public and unauthenticated** — the access gate is on the separate host-display flag, not on `visibility` (`src/lib/evidence/identifier.ts:66-79`) | This publisher committed to *some* content at this hash, at this time, on the public log, under a key their own trust registry authorizes, and its lifecycle state is what the signed chain says. **Sealed is not unverifiable** | What the content is; that the disclosed envelope claims are the signed ones; anything the envelope-integrity and content-hash checks would establish. **Sealed is not verified** |
| **unsigned dev tier** (ADR-0020) | Nothing — there is no signature, and no record is persisted. The gate runs *before* the request body is read and refuses the whole persist path with `403 unsigned_tier` (`src/app/api/evidence/route.ts:155-158`; `src/lib/evidence/unsigned-tier.ts:203-217`) | Nothing about origin | Anything requiring a signature. Per ADR-0020 Decision C (`:64`) an unsigned package may reach **neither** `sealed` nor `public`, and a historical unsigned row cannot be promoted later (`unsigned-tier.ts:229-243`) |

### What a sealed record's commitment actually exposes

Sealing is not a half-measure, and it is not full verification either. Precisely:

- **Redacted:** the content location (`packageUrl`), `subjectTitle`, and `subjectSummary` (`typedstandards/packages/produce-core/src/commitment.ts:159-161`, `:195-197`). The package is never inlined, even on the `?inline=1` bundle form (`src/app/api/evidence/[slug]/commitment/route.ts:197`).
- **Served unredacted:** `packageHash`, the signature block, `signer`, `type`, `producerProfile`, `contentHash`, `contentCanonicalization`, `captureMethod`, `contentProfile`, `visibility`, the RFC 3161 token, the Rekor entry id with its inclusion proof and entry body, the lifecycle chain, and the trust-registry URL (`produce-core/src/commitment.ts:155-193`).

**Which §9.2 checks run against a sealed record.** Read off the portable library's verify function, which every environment runs (`typedstandards/packages/verify-core/src/verify.ts:221-385`):

- **Five run:** #2 signature mathematics (`verify.ts:254-263`) · #5 trust-registry verdict (`:324-329`) · #7 RFC 3161, full cryptographic verification (`:297-300`) · #8 Rekor Merkle inclusion (`:270-292`) · #10 lifecycle state, resolved from the carried signed attestation chain (`:351-358`).
- **Eight cannot:** #1 envelope integrity, #3 canonicalization resolution, #4 content hash, #9 BlobRef integrity, #12 type resolution, #13 `nodeId`, #14 signer-identity cross-check, #15 vocabulary conformance — all gated on the package bytes being present (`verify.ts:235-244`, `:305`, `:337-347`, `:364`).
- **One is label-only:** #11 reads a `captureMethod` served from the database row rather than from the signed bytes (`src/lib/evidence/commitment.ts:258`; detail page at `src/app/(app)/evidence/[slug]/page.tsx:940`). For a sealed record you are shown a label you cannot check against the signature that covers it.

Check #1 is worth singling out because it is where a naive implementation would mislead you. When there are no bytes to recompute from, it returns the tri-state `unavailable` with `reason: 'private'` — explicitly **not** `altered` (`verify.ts:239-244`, semantics at `:75-103`). A sealed record does not read as tampered.

### Two §9.2 checks and their implementation state

**This is a measured gap, stated plainly.** §9.2 defines a conformant verifier as one that "performs every check in §9.2" (`:1389`). In the two verifier environments measured:

- **#6** (`metadata.signingKeyId` consistency, `:1400`) is **absent in both** — zero occurrences of `signingKeyId` in `typedstandards/packages/verify-core/src/`, and zero in the reference implementation's `src/lib/evidence/verify.ts`.
- **#13** (`nodeId` cross-check, `:1407`) **recomputes the value but does not perform the cross-check.** The envelope hash is recomputed and returned as `nodeId` (`verify-core/src/verify.ts:183-184`, populated at `:364`; `checks.ts:33` records that the recompute "drives both check #1 … and check #13"). What is not performed is comparing an attestation's `targetNodeId` against that recomputed value.

The neutral verifier documents both as not surfaced as discrete status codes (`typedstandards/apps/web/src/lib/trust-signal.ts:697-704`). This is a statement about two environments, not about every verifier that might exist. Registered as [Q71](architecture/open-questions.md); no fix is asserted here.

## User-attested records are a legitimate trust shape

The skill path is user-attested, and this document names it that way rather than glossing it. That is a description of where the trust sits, not a demotion.

**Who the signature names.** The `signer` on the package is the **instance operator's** configured identity, default-filled from the active signing key (`src/app/api/evidence/route.ts:289`; `src/lib/site-config.ts:403-426`). It is not you. The submitting user's identity is **not inside the signed bytes** at all: `publish.py` sends no identity field (`publish.py:1168-1197`), the submitter is stored as a foreign key on the registry row (`route.ts:325`), and the PROV-O graph contains three `prov:SoftwareAgent` classes and no `prov:Person` (`packages/civic-typed-harness/src/capture/provenance.ts:193-201`, `:235-242`, `:261-267`).

**Who the byline names.** The display name and profile link a reader sees on a record page are a database join rendered *outside* the signature (`src/app/(app)/evidence/[slug]/page.tsx:104-107`, `:403-409`). A sealed record's commitment carries the creator's GitHub identity as `signerIdentity`, and the source is explicit that this is distinct from the envelope-side `signer` that check #14 tests (`src/lib/evidence/commitment.ts:213-225`).

So: **the cryptography attributes the record to the instance; the byline attributes it to a person; the two are different claims carried by different mechanisms.** A reviewer should not read the signature as binding a named individual to the analysis.

**Why the shape still works.** By publishing under their account, a person attaches their public reputation to the analysis. For solo dogfooding, exploratory work, and bylined journalism — where the author's name is the point and readers already weigh it — reputation-attached publication is a workable trust shape. It is a weaker root than platform capture, and the label is what tells a reader which one they are looking at.

**Why the project labels rather than gatekeeps.** ADR-0003 `:51` chose one signing key across all three capture methods, with the label as the differentiation, and explicitly rejected refusing to sign, hiding legacy records, or issuing a key per method. The revisit condition is stated in the same ADR: a separate key returns to the table if a future capture method has "meaningfully different trust properties" (`:56`). That is a condition, not a plan.

**The identity ceiling.** The specification's graded identity-binding ladder is informative; **only GitHub OAuth is built** (§10.3, `:1468`). Higher-tier binding carries stronger signals but, in the specification's own framing, is no substitute for editorial judgment.

## What a verifier cannot record today

A record can point outward — at a source revision, at a location where the content lives. The specification anticipates a verifier resolving those pointers. What it does not yet say is what the verifier should **write down** about the attempt.

Measured today:

- **`vcsRef` is implemented nowhere.** The specification defines it (§8.1.1, `:445`) and the threat model names the false-VCS-binding publisher (§10.1, `:1453`), with the honest framing that "the signature attests the *assertion*, not the *fact*." No code path in any of the three repositories emits or reads the field.
- **`attestation/locatedAt/v1` is minted and persisted** at publish (`src/lib/evidence/publication.ts:126-133`, `:160-181`) and recognized as a known type URI (`typedstandards/packages/verify-core/src/checks.ts:204`), but **no verifier resolves the URI**.
- **The optional `availability` sub-field** the specification allows on `locatedAt` (§8.10.2, `:993`; §8.12.1, `:1312`) is never emitted (`publication.ts:126-133` passes only `uri`, `targetContentHash`, `contentLength`).

The consequence is narrow and specific: **a resolution that succeeded and one that was never attempted look identical in a record that only stores the assertion.** The §10.1 mitigation that weights an unverified `vcsRef` by the package's capture method then has nothing to read. This gap was raised by an external reviewer on [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) (comment of 2026-08-07).

Two in-tree precedents show what a recorded result can look like. **Neither is offered as an answer**, and this document proposes no field:

- The weaker one is §9.2 #9's BlobRef result, `blobRefsVerified: boolean | null` (`verify-core/src/verify.ts:203`), with four per-reference failure reasons (`blob-ref.ts:67-70`). Its `null` collapses **three** distinct states: no package available to inspect, no BlobRefs present, and never attempted (`verify.ts:304-309`).
- The stronger one is the envelope-integrity tri-state already described above — `verified | altered | unavailable`, where `unavailable` carries a `reason` separating private-by-design from unfetchable. Its own source records why it replaced a boolean: the boolean "collapsed 'content unavailable' onto `false` — so a private (content-redacted) record read as tampered" (`verify.ts:88-90`).

The question — what a verifier records when it resolves an external reference, and how "not attempted" is distinguished from "resolved-match" and "resolved-mismatch" — is registered as [Q69](architecture/open-questions.md) in the open-questions registry, with no answer asserted.

## Higher-stakes paths and futures

Everything above describes what ships. This section describes what does not, and is careful to say so.

**Sandbox-attested capture.** An opt-in higher-stakes path in which the analysis runs inside a controlled execution environment rather than a chat session. Tracked on the sibling website issue; not built.

**Upstream model-API attestation.** If a model provider signed its own outputs, the generation gap would close at its source. This is outside the project's control and is tracked separately; not built.

**Agent Receipts.** Assessed on [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) (comment of 2026-04-28): a receipt chain closes mid-chain reordering and post-session tampering, but not pre-signing fabrication, because the signing key is still held by the party assembling the payload.

**A separate signing key per capture method.** Considered and rejected in ADR-0003 (`:56`), with the revisit condition quoted above. Currently rejected, not permanently closed.

**Hardware-attested capture at the inference boundary.** Raised by an external reviewer on [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) (comment of 2026-06-17). Their claimed properties, stated as theirs and **not endorsed, not measured, and not added as a row to Table 1**:

- The trust root moves off the author entirely: rather than signing a user-submitted transcript, a small local proxy signs **at the inference boundary**, emitting a per-response receipt over the request hash, the response body, a timestamp, and a model digest — under a key the person running the analysis cannot forge after the fact.
- Rooting that receipt in hardware (they bind theirs to a TPM quote) would let a verifier confirm by **recomputation** that a given output came from a given model at a given time, with no provider key involved — which is why they argue closing the upstream gap does not require a model provider to sign.
- Applied to the `vcsRef` case, they claim recomputation would upgrade verify-on-fetch from an informative signal to an established binding.
- They characterize this as a trust shape the capture-method table does not have yet: **hardware-attested**, distinct from both user-attested and platform-attested.
- They agree with this project's Agent Receipts assessment — a local-key proxy closes mid-chain tampering but not pre-signing fabrication, and the fix is moving the root rather than improving the proxy key.

Under ADR-0003 `:56`, a capture method with demonstrably different trust properties is exactly the condition that reopens the separate-key question. Demonstrating them is the work that has not happened.

## How to verify a record

Four independent mechanisms, each checkable without trusting civicaitools.org:

- **Signature.** Ed25519**ph** over canonical JSON (§10.3, `:1465`), verifiable against the `kid` entry in the publisher's trust registry. The canonical location is `<publisher-origin>/.well-known/typed-publisher.json`; the prior-era `evidence-public-keys.json` path remains served as a permanent alias (ADR-0025 §D, ruling D2). Each publisher hosts their own registry at their own well-known path — there is no central key authority (§8.3.3; `src/lib/site-config.ts:364-387` derives both URLs per instance).
- **Timestamp.** An RFC 3161 token from FreeTSA, verifiable against FreeTSA's published CA chain. A conformant offline verifier validates the full X.509 chain to a **pinned** FreeTSA root, whose SHA-256 fingerprint the specification records (§10.3, `:1466`).
- **Transparency.** A Sigstore Rekor entry, resolvable at `rekor.sigstore.dev`, with RFC 6962 Merkle inclusion verified against a **pinned** Rekor log public key (§10.3, `:1467`).
- **Content-addressing.** The package SHA-256 is in the URL slug; mismatched content cannot round-trip.

**None of those checks require trusting civicaitools.org.** The portable verifier carries no `civicaitools.org` dependency at all (§9.4, `:1422`).

**Offline verification — the precise scope.** Zero-network, full-depth verification is a **demonstrated property of the self-contained commitment bundle** (the `?inline=1` form), which carries the proofs and the publisher's trust registry inline (§9.4, `:1422`). It is *not* a property of the bare package: the canonical single-blob package "still does not embed its own proofs, so a bare package handed to a verifier without its accompanying commitment view still depends on an out-of-band proof carrier" (§9.4, `:1431`).

**One honest caveat about offline verification.** A self-contained bundle carries the trust registry as of the moment the bundle was generated. An offline verifier therefore cannot see a key revoked *after* that snapshot, and renders its verdict as "verified against the publisher's trust registry as of `<generatedAt>`" rather than as it stands now (§9.4, `:1433`; the same forensic boundary §10.2 `:1458` names for a compromised signing key). This is a property of working offline, not a defect.

## What is being disclosed

Every record carries its audit trail: which AI model ran the analysis, which MCP data sources it queried, every tool call with its arguments and result summary, the skill-guidance text the model was operating under, and a W3C PROV-O graph naming each agent and data source. "Where did this number come from?" is answerable down to the tool call, not just the data source.

One qualification, from Table 2: under `claude-code-jsonl-readback` the trace is **synthesized at publish time** from the tool calls the payload declares, not captured during the session. The disclosure is real; its provenance differs by capture method.

## What is not being claimed

**A record package proves *provenance*, not *correctness*.**

"Unverified" on a record page means no attestation has been added yet — not that the AI got the answer wrong. The platform itself does not issue correctness claims, and the specification is explicit that it does not: the signature attests publication and integrity, never that the content is correct (§5.3, `:147`; §10.2, `:1457`).

Correctness review rides alongside as a **separately-signed attestation contributed by an identifiable reviewer**. Under the ratified v0.1 sub-type table (§8.12.1, `:1305-1322`), the three review shapes this project supports map as follows (§8.12.2, `:1330-1332`):

| Pre-v0.1 review kind | v0.1 sub-type |
|---|---|
| `consistency` (repeat-publish runs surfacing determinism or drift) | a separately-signed `content/analysis/v1` node plus `attestation/corroborates/v1` or `attestation/contradicts/v1` |
| `evaluation` (adversarial review against a rubric) | `attestation/evaluates/v1`, with declared methodology |
| `expert_attestation` (review by a named human expert) | `attestation/evaluates/v1` for a critique, or `attestation/endorses/v1` when vouching |

Existing pre-v0.1 attestation records have **not** been migrated to the new sub-type URIs; that migration is scoped separately (§8.12.2, `:1334`).

For the full stance, see `civic-ai-tools-website/docs/design-principles.md` — *disclosure, not validation*.

## Withdrawal, not deletion

An author can withdraw a record: a signed, public action with a stated reason. Withdrawal does not erase — it appends a signed lifecycle event that renders on the record page. A permanent record that a civic-data claim was made and later retracted is more honest than silent deletion. Reinstatement works the same way, and a record can cycle through withdrawal and reinstatement any number of times without special handling (§8.10.2–§8.10.3, `:985-1009`; the sub-types are `attestation/withdraws/v1` and `attestation/reinstates/v1`, §8.12.1 `:1307-1308`).

## Key rotation

Signing keys rotate per the runbook at `civic-ai-tools-website/docs/key-rotation.md`. Older keys stay in the trust registry indefinitely, and records signed under a retired key remain verifiable — the registry's per-key status semantics are what §9.2 #5 applies (`:1399`).

## Contract stability

Long-form verification and publish-API guidance lives in `civic-ai-tools-website/docs/api/records-publish.md`. Its stability statement: fields may be added in a backwards-compatible way; a breaking change bumps the `schemaVersion` inside the package and is noted in that document's change log (`records-publish.md:51`).

Above that sits a governance commitment, recorded in three places: **a ≥90-day breaking-change notice on the record-package schema and the documented publish API** ([`sustainability.md:17`](sustainability.md); [ADR-0001](adr/0001-roadmap-governance.md) `:24` and `:50`, where it is stated as "a commitment, not an informal practice"; and `ROADMAP.md` Section 3). `ROADMAP.md` §3 also records the commitment's current phasing honestly: while the specification and the documented API are still stabilizing, every breaking change ships with a documented migration path and prompt public disclosure, and the fixed 90-day advance-notice window takes effect once they stabilize. That section also carries a disclosure of an occasion on which the notice window did not run.

---

*Nothing in this document validates, endorses, or vouches for the correctness of any analysis. It describes what can be checked, by whom, and with what.*
