# ADR-0038: The `ai-assisted-analysis/civicaitools-v1` Producer Profile subtype — its guidance bundle as the first worked instance of Q32, the invariant read from the subtype's table row, and a verifier check for the system prompt

- **Status:** **Accepted** (2026-10-30 — the eight rulings D1-D8 made by the owner at the filing of sprint R10, anchor [civic-ai-tools#289](https://github.com/npstorey/civic-ai-tools/issues/289), every card as recommended; D4's row shape as corrected at the sprint's G0 and ruled by the owner on 2026-10-30; the verifier check of §6 added by the anchor's amendment 1 the same day)
- **Date:** 2026-10-30
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0006](0006-producer-profile-architecture.md) (§1: the reserved subtype name is spent and the subtype is built under the ruled name; §2: the consistency invariant is read from the subtype's table row; §5: the first guidance bundle exists), [ADR-0011](0011-capturemethod-generalization.md) (§2: the G4 decision applied to the second subtype, which inherits the type's vocabulary with no override), [ADR-0029](0029-scripted-recomputation-producer-profile.md) (§5: the content-profile check reads the invariant as amended here), [ADR-0033](0033-composed-harness-record-fields.md) (the fields it documents gain a document a verifier can resolve)

*Numbering note: 0037 is the highest record on `main` at drafting time (hub `2222249`). ADR-0006 and ADR-0011 are refined by reference and not edited.*

## Context

### What a record of this producer carries, and what describes it

The reference host of this project, civicaitools.org, publishes records through the composed harness ([ADR-0033](0033-composed-harness-record-fields.md), [ADR-0037](0037-the-first-step-tool.md)). Beyond the `datHere` requirements of specification §8.7.1, such a record carries a field set that no specification text and no document a verifier can resolve describes (measured at hub `2222249`, website `567a7c2`, typedstandards `ae96af8`, 2026-10-30):

- `extensions["org.civicaitools.composition"]` with `assertedDate`, `sourcesOffered[]` (six reasons), `components[]`, `flowsStatement`, `routing` (three methods) and `definitionHash`, each emitted only when passed (`packages/civic-typed-harness/src/format/dathere.ts:36-39`, `:282-289`, `:337`, `:482-497`; ADR-0033 §E and its two amendments);
- `toolDefinitions` in the environment block (ADR-0033 §C);
- the execution block, the structured summary and the notebook's `provenance` discriminator, which the reference host writes inside the notebook's own metadata (website `src/lib/notebook-author/phase-d.ts:253-255`, `synthesize.ts:187`, `:197`; §7 below records where that differs from §8.7.4);
- a load span per `load_source` call (`tool.operation_type: load_source`, `tool.load_outcome` in five values), carried into the graph as `civic:loadOutcome` (ADR-0033 amendment 2);
- twenty `civic:` terms (`format/vocabulary.ts`, twenty `CIVIC_TERM_` exports).

ADR-0033 §H records that the specification names extension keys and `civic:` terms by example only, so none of these is in it. The fields are documented in ADR-0033 and the harness README, in a repository the record does not point to.

**A hash-only record of this producer carries no profile at all.** The publish dialog sets `contentProfile` to `datHere` for a full-text prompt and `default` for a hash-only one (`PublishEvidenceDialog.tsx:279`, sent at `:297`); the harness derives `producerProfile` only for `datHere` (`dathere.ts:73-89`, `deriveProducerProfile`); so a hash-only record carries the same composition block under no `producerProfile`.

**The reserved name.** ADR-0006 §1 reserved the subtype `civicaitools-default`, "name-only. Would specify the civicaitools.org default conventions if/when they diverge from `datHere` enough to need a separately-named subtype. No realized divergence today" (2026-05-23). Specification §8.6 and ADR-0011 §2 repeat the reservation. The divergence now exists and is measured above.

**The invariant.** `metadata.contentProfile === "datHere"` iff `producerProfile.startsWith("ai-assisted-analysis/datHere")`, compared only when both are present (§6.2 line 218, §8.1.1 line 441; ADR-0006 §2). It is enforced in three places: verify-core's datHere detection (`packages/verify-core/src/checks.ts:93`), §9.2 check #16 (`checks.ts:324`, status `contentProfile_inconsistent`), and the reference host's publish route, which returns 400 on a mismatch (`src/app/api/evidence/route.ts:246`). So a second subtype under `ai-assisted-analysis/` on a record that keeps `contentProfile: datHere` is refused by the route and reported malformed by every deployed verifier until the invariant is amended.

**Q32 and its stand-ins.** [Q32](../architecture/open-questions.md#q32--producer-profile-guidance-doc-routing-convention) is open with four candidate routing models. verify-core's `profiles.ts` calls itself "the Q32 stand-in"; ADR-0029 added a second row and called it "a second stand-in, not a routing convention"; the harness's `format/profiles.ts:6-12` warns against growing a bundle mechanism before Q32 is resolved. Q32's resolution criterion is a bundle consumed outside the reference implementation with the routing load-bearing for verifier work.

**The harness definition is a different object.** The MCP-sources design (planning-side, §10 item 11) put the versioned name on the harness definition; ADR-0037 §E made the definition `{ domain, sources, components, chosenBy, hash }`, "an output and a hash only", with no name and no version. The definition says what composed the prompt and the tools. It does not say which fields the producer's records carry or what each means. This record names the second thing and leaves the first where ADR-0037 put it.

**The system prompt (website #694).** The executed-run records of this producer carry `skillMetadata: {}`: the packager reads a `skill_fetch` span (`src/lib/evidence/packager.ts:639-645`; harness `capture/skill-metadata.ts:28-41`) that the composed-harness flow never writes, and the dialog sends no override (`route.ts:408` only forwards one). The system prompt's hash is in each such record's trace (`gen_ai.system_prompt_hash` on an `llm_inference` span); its text is not. The census of the reference host's 61 public records (the web ORCH's G0 amendment 1, 2026-10-30): the 17 executed-run records published since September carry neither text nor hash; 33 older records carry text and hash; one comparison record carries the hash only, by website ruling #411 D3. Specification §8.7.1 requirement 2 says a `datHere` record MUST carry a non-empty `skillMetadata.skillText`; each of the 17 that declares `datHere` does not meet it (the census read the trace root, the text and the hash, not `metadata.contentProfile`; the two of the 17 that #694 read both declare `datHere`; an executed run can also be published hash-only, as `default`), and no §9.2 check reads the requirement. The owner ruled on 2026-10-30 (the anchor's amendments 1 and 2; #694 = C) that on every new record, executed run and comparison run alike, `skillMetadata.systemPromptHash` is carried inline and `skillMetadata.skillText` as a BlobRef whose content hashes to it, one blob per distinct composed prompt, with no prose in the signed bytes; and that the fix lands in a website phase of its own before the reference host declares this subtype, so the first records of the subtype meet their own bundle.

### The Xanadu gate

Under [the Xanadu doctrine](../architecture/xanadu-doctrine.md), promotion needs a real package or adopter that needs the change, named in the promoting work. [ADR-0029](0029-scripted-recomputation-producer-profile.md) states the pattern. This record names the records:

- **Public records carry a composition block that no resolvable document describes.** A read-only census of the reference host's public records API on 2026-10-30 at 12:35Z (sprint R10's web ORCH, G0 §3): 61 public records, 13 carrying `org.civicaitools.composition`, 0 carrying `routing` or `definitionHash`, the newest created 2026-10-23T16:09:47Z. The thirteen carry fields whose meaning a second host finds only by knowing this repository.
- **A hash-only record carries no profile.** Every hash-only record of this producer, by construction (above).
- **In-loop runs on production since 2026-10-27 16:46Z write `routing` and `definitionHash` into every record they publish.** None was public at the census; the first public one will carry two keys no document describes.
- **The executed-run records of this producer carry an empty `skillMetadata`** ([civic-ai-tools-website#694](https://github.com/npstorey/civic-ai-tools-website/issues/694), raised by the owner from production on 2026-10-30; the census the same day: of the 61 public records, the 17 executed-run records since September carry no system prompt, 33 older records carry its text and hash, and one comparison record carries the hash only): the datHere profile's requirement 2 is unmet on each of the 17 that declares it (both that #694 read do), and nothing says so.

The transition is designed-to-built for ADR-0006 §5's bundle principle (one bundle exists, content-addressed and resolvable off-platform) and reserved-to-built for the subtype. It is not a resolution of Q32: one producer's bundle, consumed by one verifier's table row, is the first worked instance of model (d), and the question stays open until a second producer or host consumes a bundle (§8).

## Decision

### 1. The subtype and its name (D1 = A, D2 = A)

A record of this producer declares a **Producer Profile subtype**, not a content profile: **`ai-assisted-analysis/civicaitools-v1`**, display name **"Civic AI Tools profile, v1"**.

- The axis is the one ADR-0006 built for this. The content-profile axis is closed by the specification's own sentence (§8.1.2: "a new Producer Profile says what it is through `producerProfile` and its subtype, not through a new value here") and by ADR-0029 §5, which rejected a content-profile value for its profile on the same ground.
- The name is the host's own, already in every record's `environment.host`; it is not a partner's name. "Content" is not in it: `contentProfile` already carries two senses the specification records (§6.2, the collision note), and a third would land on the record page's label.
- The reserved `civicaitools-default` is not promoted under its reserved name: "default" says nothing about a version and reads as the subtype with no conventions, the opposite of a subtype whose point is its bundle. The reservation is **spent**: specification §8.6 and the §7.1 diagram name the ruled subtype in its place, and the name `civicaitools-default` is not reserved again. Two frozen fixtures carry it (§7).
- **Every new record of this producer, full-text or hash-only, declares the subtype** (the owner's reading, 2026-10-30). The content profile's values and their meaning do not change: `datHere` is the A-G envelope, carried by a full-text record, whose §8.7 requirements stay binding on it; `default` is the plain shape, carried by a hash-only record.

**The owner's note on D3, and the seat's reading.** The owner's one note at the rulings: "if it makes more sense we could call it civicaitools-v0.1.0". The seat's reading, which this record adopts and the owner may overrule at this record's review: the name stays `civicaitools-v1`. Under §2 the name carries only the major; a three-part version in the slug re-encodes what the bundle's digest already carries; and `0.x` reads as "not yet stable" on a label meant to stay readable on records for years. The bundle's header carries a revision number and date, so "first revision" is said there, where it can change without renaming the subtype.

### 2. The version rule (D3 = A)

Two levels.

- **The subtype name carries the major.** `civicaitools-v2` when a declared field changes meaning, is removed, or a v1 reader statement (§4) would be false of the record.
- **The bundle's digest carries the revisions.** An added entry with an absence rule, a new reader sentence, a corrected citation or a corrected path stays `v1` and moves the bundle's SHA-256 and the verifier table row's pin (§5). Each revision costs one verify-core patch.

The rule matches how the composition block has moved: twice by additive, honest-absence keys (ADR-0033's two amendments) without any reader statement becoming wrong.

### 3. The invariant, read from the subtype's table row (D4 = A, as corrected)

**The one-sentence invariant**, replacing the `startsWith` sentence in specification §6.2 and §8.1.1:

> Compared only when both fields are present: `metadata.contentProfile` is one of the content profiles the subtype's table row admits; a subtype with no row admits `"datHere"` exactly when it begins with `ai-assisted-analysis/datHere`, and `"default"` exactly when it does not.

**The table.** The verifier's subtype-level table, beside its profile-type table, has one row per built subtype:

| Subtype | Admits | Bundle |
|---|---|---|
| `ai-assisted-analysis/datHere` | `["datHere"]` | — (the integration partner's, not this project's to write) |
| `ai-assisted-analysis/civicaitools-v1` | `["datHere", "default"]` | `{ url, sha256 }` of §5 |

**Why the row names a set and not a boolean.** D4 as ruled named a boolean `datHereShaped` per row. The sprint's G0 measured that one boolean cannot admit both of this producer's shapes: a hash-only record carries `metadata.contentProfile: "default"` in its signed bytes (the dialog sends it, `:279`; the route validates and passes it; the packager passes it, `packager.ts:687`; produce-core emits any non-empty value), and a full-text record carries `"datHere"`, and §1 puts the subtype on both. Under "datHere iff the row is datHere-shaped", `true` makes every hash-only record `contentProfile_inconsistent` and `false` every full-text one. The row therefore names the content profiles the subtype admits. The owner ruled the corrected shape on 2026-10-30. The rule D4 stated is kept: read from the table; no row keeps today's reading.

**Every existing verdict holds.** The no-row clause is today's `startsWith` reading verbatim, so a record whose subtype has no row reads as before. On the `datHere` row the set `["datHere"]` gives the same answer as `startsWith`. The combinations:

| `metadata.contentProfile` | `producerProfile` | Before | After |
|---|---|---|---|
| `datHere` | `ai-assisted-analysis/datHere` | `ok` | `ok` |
| `default` | `ai-assisted-analysis/datHere` | `contentProfile_inconsistent` | `contentProfile_inconsistent` |
| `datHere` | an unlisted subtype | `contentProfile_inconsistent` | `contentProfile_inconsistent` |
| `default` | an unlisted subtype | `ok` | `ok` |
| `datHere` | `ai-assisted-analysis/datHere-x` (prefixed, unlisted) | `ok` | `ok` |
| `default` | `ai-assisted-analysis/datHere-x` | `contentProfile_inconsistent` | `contentProfile_inconsistent` |
| `datHere` | `ai-assisted-analysis/civicaitools-v1` | `contentProfile_inconsistent` | **`ok`** |
| `default` | `ai-assisted-analysis/civicaitools-v1` | `ok` | `ok` |

The one combination that changes is one no published record carries, because the route has refused it with 400. `ai-assisted-analysis/datHere` stays a valid subtype forever; no record is re-signed or re-labelled.

**Who reads it.** verify-core exports the table and a consistency predicate over it, in place of a boolean; check #16 and the datHere detection read the predicate; the reference host's publish route calls it in place of its own `startsWith`. These are the sprint's P3 and P5, named here as planned.

### 4. The bundle's contents and the derived statements (D5 = A, D7 = A)

The subtype's guidance bundle is one JSON file (§5). It states:

- **The header:** the subtype, the display name, revision `1` and its date, the decision record, the bundle's own URL, the version rule, the content profiles the row admits, and the capture vocabulary, **inherited from the type with no override** (ADR-0011's G4 decision: `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`).
- **One entry per field** (thirty-four), each with six members: `path`, `values`, `absent` (the absence rule), `carriedBy` (the record or fixture that carries it), `sentence` (the statement a host derives from it) and `class`. The fields: the composition block's six keys; `environment.toolDefinitions`; the execution block, the structured summary and the notebook's `provenance`, each at the path a record carries it; the load span's `tool.operation_type` and `tool.load_outcome`; the twenty `civic:` terms; and the system prompt's two fields, `skillMetadata.skillText` and `skillMetadata.systemPromptHash` (website #694 = C): on every new record the hash inline and the text as a BlobRef whose content hashes to it, one blob per distinct composed prompt, resolved by check #9; the absence rule for records published before that phase (the text was not carried; the hash where present; the composition names the prompt's pieces by `guidanceHash` and `guidanceOrigin`); and the derived sentence for each state, text present, hash only, neither, whose words the bundle marks as hypotheses for this record's reviewer. Each field's absence rule is ADR-0033's honest-absence rule: an absent key renders as not recorded, never as a default.
- **Three classes** (D7): `shows`, the statement a host that shows the reached sources derives and shows (a SHOULD); `may-show`, a statement a host may derive; `never-invents`, what no host states because the record does not hold it.
  - **Shows:** the chooser sentence, read from `routing.method`, the load spans and `sourcesOffered`, in three groups: loaded; asked, with the reader's answer; never asked. Under in-loop routing it reads "the model chose which sources to use: it loaded …; it asked about …; it did not ask for …". It is shown wherever reached sources are shown. A record with no `routing` key reads "not recorded". The all-sources sentence ("every configured source was offered from the first request") applies only if a record of this producer ever states that method; today an all-sources run writes no `routing` key (website `src/lib/evidence/trace.ts:63-67`, `src/lib/mcp/routing-mode.ts:35-37`), so no record states it. The honest execution label (§8.7.3 item 4, §8.7.4) and the system prompt's three-state sentence are in this class too.
  - **May show:** the router version and the definition hash as small print; each not-reached source's reason; the flows statement's date and address; the asserted date; the components and the tools offered; the execution telemetry; the graph's per-call terms.
  - **Never invents:** who consented or when; the definition's contents (unresolvable until the definition is a node type, ADR-0037 §E); the flows statement's text as if from the record; any default for an absent key.
- **The never-carried list** (seven facts, from the MCP-sources design §1.6 and §4.4): who consented; when; the account; the per-source consent states; the flows version row; the session cookie; the flows statement's text. Each with the rule that keeps it out of the signed record. A profile that says what its records never carry is the profile's strongest reader statement to a privacy reader, and it is stated where a verifier resolves it.

The bundle adds no record field and no composition key. The reference host's display policy (host-core) stays what it is: unsigned, keyed on status, signer, type and index extensions, choosing which records a page shows and never what a sentence says.

### 5. Where the bundle lives: a hub file, pinned by URL and SHA-256 (D6 = A)

The bundle is `docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json` in this repository, with an informative rendering beside it, `bundle.md`, which names the JSON and its digest.

- **URL:** `https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.13-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json`, the file's raw address at the tag the owner's merge kit sets on this record's merge commit, as `v0.1.12-typed-standards-spec` sits on the merge of the previous revision.
- **SHA-256 of `bundle.json`, revision 1 (2026-10-30):** `724e399e02db8993041b64982eec731505084bec2ec5e6ca58fda2de8087a281`.
- **The table row** (§3) carries `bundle: { url, sha256 }` with these two values. The digest makes the URL's host irrelevant to integrity: a verifier holding the file checks the digest and never fetches. A verify-core test reads a local copy, never the network.
- The record points at the bundle only through its subtype name; no bundle hash is on the record (Q32's (c) is the second step once a bundle has moved, not the first).

A later revision of the bundle moves the digest and the row's pin (§2) and nothing else. The bundle's `date` is the day its revision was written.

### 6. §9.2 check #17: the system prompt of a `datHere` record (the anchor's amendment 1)

Specification §9.2 gains a seventeenth check, implemented by `@typedstandards/verify-core` 0.15.0 as planned:

> **Content-profile system prompt** *(reads whether a `datHere`-content-profile record carries the system prompt §8.7.1 requirement 2 requires)*. When `metadata.contentProfile` is `"datHere"`, read `skillMetadata.skillText` and report `ok` when it is a non-empty string or a BlobRef, and **`skillText_absent`** when the key is absent, not a string or BlobRef, or empty; when `metadata.contentProfile` is not `"datHere"` (absent, `"default"` or unknown) report `not_applicable`. `skillText_absent` is an attention status and never a failure: the record declares the `datHere` profile and does not carry the prompt's text, which is a producer omission against requirement 2; it says nothing about the envelope, the signature or the notebook, and every other verdict is unchanged. The check does not resolve a BlobRef (check #9 does), and it does not check that the text is the prompt the model ran under, which no check can.

- **The MUST it enforces is §8.7.1's existing requirement 2.** The only new normative sentence is the check's.
- **Records published before the check keep their verdicts.** Each of the 17 executed-run records of this producer that carries no system prompt and declares `datHere` reads `skillText_absent`; the 33 older records that carry the text read `ok`. Three fixtures declare `datHere` with no `skillText` and read `skillText_absent` by design, as the absent case (measured at hub `2222249` and typedstandards `ae96af8`): the hub harness's `reference-golden.json` cases `v01-dathere-empty-notebook` and `v01-dathere-executed-notebook`, whose copies in typedstandards produce-core's `reference-golden.json` read the same, and the hub harness's `in-loop-golden.json` (`skillMetadata: {}`). typedstandards apps/web's `q15-d67b8e.json` carries a 38,462-character `skillText` and reads `ok`. No fixture's bytes move (§7); none is rejected, re-signed or re-labelled.
- **The fix lands before the subtype is declared** (website #694 = C, the owner's ruling of 2026-10-30, in a website phase named only as planned): every new record carries `systemPromptHash` inline and `skillText` as a BlobRef, so the first `civicaitools-v1` records read `ok`.

### 7. What does not change

- **Every published record keeps its bytes and its verdicts.** Signed bytes move only on new records and only in the `producerProfile` value. The three frozen harness goldens and `in-loop-golden.json` do not move.
- **The composition block does not move.** No key is added to `org.civicaitools.composition`; the chooser sentence derives from fields the record already holds.
- **The two frozen goldens that carry the retired name** (the hub harness's `v01-signer-producer-capture` and typedstandards produce-core's counterpart) carry `ai-assisted-analysis/civicaitools-default` with no `contentProfile` key. With no row, the no-row reading applies and check #16 reads `contentProfile_absent`, as today. The name is not "fixed" in a fixture.
- **ADR-0006 and ADR-0011 are not edited.** ADRs are immutable; this record refines them by reference.
- **The `datHere` subtype's bundle** is not written here: it is the integration partner's.
- **Two paths differ from §8.7.4, and this record does not resolve them.** §8.7.4 places the execution extension at `extensions["org.civicaitools.execution"]` and the discriminator at `extensions["org.civicaitools.notebook"].provenance`. The reference host writes both inside the notebook's own metadata: `extensions["org.civicaitools.notebook"].metadata.extensions["org.civicaitools.execution"]` and `…metadata.extensions["org.civicaitools.notebook"].provenance` (`phase-d.ts:253-255`, `synthesize.ts:187`), and the three executed fixture records of the reference host's flows tests carry them there. The bundle states each at the path a record carries, so a host reads it where it is. Whether the specification's path or the host's is the one to keep is a question for a later record, not a passing fix.

### 8. Q32's status

The registry's Q32 entry gains a dated status note: this record is the first worked instance of model (d), a primary URL with a content-hash pin; it is one producer's bundle consumed by one verifier's table row; Q32 stays open until a second producer or host consumes a bundle. Nothing here settles how bundles in general are referenced, versioned, distributed or verified.

## Considered and rejected

- **Not yet (D1 B): the website's answer surfaces alone, the field documentation staying in ADR-0033.** Rejected. Nothing is blocked today, since every record verifies; but the only description of `composition.routing` would stay in a repository the record does not point to, and a hash-only record would stay profile-less.
- **A new content profile under §8.7 (D1 C), or both a subtype and a content-profile value (D1 D).** Rejected. Closed by §8.1.2's own sentence and ADR-0029 §5; `contentProfile_unknown` on every deployed verifier; the route rejects it; §8.7.4's fields stop applying; D is two names for one thing on two axes.
- **`civicaitools-content-v1`, the owner's working name as a slug (D2 B).** Rejected for the third sense of "content". **`civicaitools-default`, promoted under its reserved name (D2 C).** Rejected: "default" misdescribes a subtype whose point is its bundle; the rename costs one line in §8.6.
- **Every bundle change a new subtype name (D3 B).** Rejected: records from one month would read as a different profile from the next for a wording fix. **No version in the name (D3 C).** Rejected: a reader of the label could not tell a v1 record from a later incompatible one without resolving the bundle.
- **A boolean `datHereShaped` per row (D4 as first stated).** Rejected at G0 for the measured reason in §3: it fails one of this producer's two record shapes whichever way it is set.
- **Drop `contentProfile: datHere` from new records (D4 B).** Rejected: the record would lose the label §8.7.4's provenance fields, the bundle endpoint and the notebook rendering key on. **A name inside today's prefix, `ai-assisted-analysis/datHere-civicaitools-v1` (D4 C).** Rejected: it passes deployed verifiers by the accident of `startsWith`, the two-segment form does not define it, and it puts an integration partner's profile name inside this project's.
- **The carried set only, no never-carried list (D5 B).** Rejected: the never-carried facts would stay in a planning document a reader cannot reach, and the list is free.
- **A bundle hash on each record (D6 B).** Deferred: the per-record pin is the right second step once a bundle has moved; it costs a new composition key. **Served by the reference app (D6 C).** Rejected: it couples the bundle's availability to a deployment, and a second host verifying offline gains nothing a hub file does not give.
- **Every statement "may show" (D7 B).** Rejected: it lets the silence the answer surfaces were found to produce count as conformance.
- **Treating check #17's status as a failure.** Rejected: every executed-run record of this producer that declares `datHere` and carries no system prompt would fail a check on bytes that cannot change, for an omission that is the producer's, not evidence of tampering.

## Consequences

- **Specification text this record licenses (v0.1.13, the same change):** §6.2 and §8.1.1, the invariant's new sentence and the second subtype in the `producerProfile` vocabulary; §8.1.2, unchanged in rule, with its cross-reference; §7.1's diagram and §8.6, the built subtype in place of the reserved name, the reservation spent, and §8.6's step 2 naming the first worked bundle; §8.7's pointer to the bundle; §9.2 check #16's wording and the new check #17; Appendix E's status line and Appendix G's entry.
- **Releases, each named only as planned:** `@typedstandards/verify-core` 0.15.0 (the subtype table, the predicate, check #16 reading it, check #17, the row's `{ url, sha256 }`), with range-only patches `@typedstandards/produce-core` 0.9.1, `@typedstandards/cli` 0.2.2 and `@typedstandards/host-core` 0.1.3 so that the repository's publish script admits the new range; `@typedstandards/civic-typed-harness` 0.11.0 (the subtype constant and a declaring golden). The reference host then declares the subtype on new records and has its route call the predicate, after #694's fix.
- **The first public in-loop record** will be the reference host's first publish under the subtype; until then the chooser sentence's record-page leg rests on `in-loop-golden.json`.
- **Flagged, not changed here:** the §8.7.4 path divergence (§7); `docs/research/`'s formal model restates the `startsWith` invariant and is a research document outside the specification's normative text; the frozen `open-evidence-standard.md` snapshot restates the earlier invariant and is frozen by ADR-0012.
- **Not settled here:** Q32's routing convention in general; the harness definition as a node type; the `picker` method's emission; host-core's display seam; the deterministic-output content profile (ADR-0029, its own case).

## References

- [civic-ai-tools#289](https://github.com/npstorey/civic-ai-tools/issues/289): the R10 anchor, its rulings D1-D9, its G0 records and amendment 1; the R10 decision memo (ruled 2026-10-30).
- [civic-ai-tools-website#682](https://github.com/npstorey/civic-ai-tools-website/issues/682) (the answer says what chose the sources), [#667](https://github.com/npstorey/civic-ai-tools-website/issues/667), [#694](https://github.com/npstorey/civic-ai-tools-website/issues/694) (the system prompt is missing from every record).
- Hub `2222249`: `packages/civic-typed-harness/src/format/dathere.ts:36-39`, `:73-89`, `:282-289`, `:337`, `:482-497`; `format/vocabulary.ts` (twenty `CIVIC_TERM_` exports); `format/profiles.ts:6-12`; `capture/skill-metadata.ts:28-41`; `src/__fixtures__/in-loop-golden.json`, `reference-golden.json`.
- Website `567a7c2`: `src/components/PublishEvidenceDialog.tsx:279`, `:297`; `src/app/api/evidence/route.ts:246`, `:408`; `src/lib/evidence/packager.ts:639-645`, `:687`, `:712-713`, `:749`; `src/lib/evidence/trace.ts:63-67`; `src/lib/mcp/routing-mode.ts:35-37`, `:363`; `src/lib/notebook-author/prompt.ts:52-55`, `phase-d.ts:253-255`, `synthesize.ts:187`, `:197`; `src/components/answer-view/adapt-record.ts:262`, `:285`; the three fixture records under `src/lib/flows/fixtures/`.
- typedstandards `ae96af8`: `packages/verify-core/src/profiles.ts`; `checks.ts:83-93`, `:291-330` (`startsWith` at `:93` and `:324`).
- Specification v0.1.12: §6.1, §6.2, §7.1, §8.1.1, §8.1.2, §8.6, §8.7, §8.7.1, §8.7.4, §9.2, Appendix E, Appendix G.
- [ADR-0006](0006-producer-profile-architecture.md) §1, §2, §5; [ADR-0011](0011-capturemethod-generalization.md) §2; [ADR-0024](0024-evidence-path-configuration.md); [ADR-0029](0029-scripted-recomputation-producer-profile.md); [ADR-0033](0033-composed-harness-record-fields.md) §C, §E, §H and its two amendments; [ADR-0036](0036-source-hosting-variants-and-logging-posture.md) §D; [ADR-0037](0037-the-first-step-tool.md) §E.
- [The Xanadu doctrine](../architecture/xanadu-doctrine.md); [Q32](../architecture/open-questions.md#q32--producer-profile-guidance-doc-routing-convention); the MCP-sources design (planning-side) §1.6, §4.4, §10 item 11.

## Amendment — 2026-11-02: revision 2 of the bundle (rulings G0-1 = A, G0-2 = (a), G0-3 = A, G0-4 = A)

Ruled by the owner on 2026-11-02 at gate G0 of sprint R11, anchor [civic-ai-tools#294](https://github.com/npstorey/civic-ai-tools/issues/294), for [civic-ai-tools#293](https://github.com/npstorey/civic-ai-tools/issues/293): G0-1 = A (the version rule's reading below), G0-2 = (a) (the URL's tag, with specification v0.1.14), G0-3 = A (the words as proposed, with one question to a research check) and G0-4 = A (the five items found beyond #293's text). The owner then ruled the words themselves on 2026-11-02 ([#294 comment 6580908649](https://github.com/npstorey/civic-ai-tools/issues/294#issuecomment-6580908649)): W1 = A (the per-load reasons) and W3 = A (the chooser sentence's "Not requested" group), for the reason the research check of G0-3 gave ([#294 comment 6579727934](https://github.com/npstorey/civic-ai-tools/issues/294#issuecomment-6579727934)); W2 = C (the never-carried rule for the per-source consent states); and W4, the seat's correction of `skillMetadata.systemPromptHash`'s absence rule ([#294 comment 6580229504](https://github.com/npstorey/civic-ai-tools/issues/294#issuecomment-6580229504)). Written by the sprint's phase P1 and landing in its PR. §4 and §5 are not edited; this section records what revision 2 corrects, why it stays `civicaitools-v1`, and its URL and digest.

### What revision 1 stated that a record does not hold

Measured at website `4777b79` and hub `af8faa7`:

- **`declined`.** Revision 1's `trace.loadSpan.loadOutcome` sentence read `declined` as "it asked about {alias}, and you said no", and its `composition.routing` sentence named a group "asked, with the reader's answer" (§4's Shows bullet repeats both). The reference host's code writes `declined` for a source that is not On in two cases: the reader answered Not now to a held pause (`src/lib/mcp/routing-mode.ts:312`), or no pause exists, so no reader is asked (`:301`, `if (!pause) return { outcome: 'declined', … }`). Today the second case reaches no published record: the two paths that write a record's trace, the chat flow (`src/app/api/compare-stream/route.ts:282-288`) and the notebook run (`src/app/api/query-notebook/route.ts:309-316`), hold a pause whenever the consent gate is enforced, and the one path with no pause, `src/app/api/compare/route.ts:189`, writes no trace (`:184-185`). The code permits it, so the sentence is not guaranteed by the record. "You said no" also fails on any page but the reader's own: a host rendering a record for someone else addresses a person who answered nothing.
- **`no-answer`.** Revision 1's sentence, "it asked about {alias}, and no answer arrived in time", is false of records that reach production. The host writes `no-answer` when no pause could be held, so no question was put: `src/lib/sources/decision.ts:243-250` (`notHeld`) returns it with no consent facts for the source, no store, no time left in the run's budget, or the reader already gone.
- **`environment.toolDefinitions`.** Its absence rule named only a producer that does not know the tools the run offered. A record whose `metadata.contentProfile` is not `datHere` carries no `org.civicaitools.environment` block at all, because the harness emits the block only for `datHere` (`packages/civic-typed-harness/src/format/dathere.ts:557-571`). The reference host's hash-only record `data-cityofnewyork-us-analysis-2026-10-31-4a76c0` (`default`) carries no environment block while its trace's root span states `analysis.tool_definitions`.

A sentence of the bundle is true of every record the producer can write, not only of the records measured. The two outcome sentences are not, and the absence rule leads a reader of a hash-only record to infer the wrong fact. The record does not hold whether a question was put to the reader, so revision 2 states no reason that says one was.

### The version rule's reading (G0-1 = A)

§2 names `civicaitools-v2` "when a declared field changes meaning, is removed, or a v1 reader statement (§4) would be false of the record", and lists "a new reader sentence" among the changes that stay `v1`. No field changed meaning or was removed: the producer wrote `declined` and `no-answer` for the same cases from revision 1 on. Revision 1's two sentences were not guaranteed by the record from the start; no change in what the records mean made them so. This record reads §2's major trigger as a change in the records' meaning, and a sentence that was wrong of unchanged records as corrected by a revision. Revision 2 therefore stays `ai-assisted-analysis/civicaitools-v1`, and no record is re-labelled. The other reading, a new subtype name for a wording correction, is the outcome §2's rejection of D3 B names: records from one month reading as a different profile from the next for a wording fix.

### What revision 2 changes

Eight entries and one never-carried rule change, and the header's `revision`, `date` and `url`:

1. **`composition.routing`, the chooser sentence** (the website's words, `src/lib/sources/copy.ts:497-507`): in-loop, "The model chose which sources to load, from those this question could use.", then three groups by the host's names for the sources: "Loaded", "Requested, not loaded" (each with its last load's reason, one line each) and "Not requested: {the sources whose reason is configured, selected or not-consented, with no load}" (W3 = A; the website's rule, `src/lib/flows/source-chooser.ts:218`), an empty group saying "none". The phrase a host MAY add is "from a source list given by {router component id} {version}" (`:541`). Absent: "What chose these sources is not recorded." All-sources: "Every source this question could use was given to the model from the start."
2. **`trace.loadSpan.loadOutcome`, its sentence** (W1 = A): `declined`: "Not allowed, so it was not used for this question."; `no-answer`: "Not used, because the site that ran this question could not ask, or no answer arrived in time."; `unavailable`: "Unavailable. The site that ran this question could not load it." No reason states that the reader was asked or answered. These are not the website's `CHOOSER_REASONS` (`copy.ts:522-526`), which open the first two with the setting "Ask first" and say "this site". The record holds the outcome `not-consented` for one run, not a stored setting (the never-carried rule below), and on a second host "this site" names that host, not the one that ran the question. `loaded` keeps its role. `not-offered` keeps its phrase, with the same correction: "it asked for {alias}, which the site that ran this question does not offer". The website's constants are reported and not changed here.
3. **`trace.loadSpan.loadOutcome`, its values**: `declined`, the source needed the reader's permission for this run and was not used, because the reader answered Not now or the producer held no pause in which to ask; `no-answer`, no decision arrived, because the reader did not answer in time or could not be asked.
4. **`environment.toolDefinitions`, its absence rule**, which adds the case above: on a record that is not `datHere` the whole environment block is absent, and that absence states nothing about the tools.
5. **`skillMetadata.skillText`, its values and absence rule** (the website's R10 phase P1b, `src/lib/evidence/prompt-blob.ts`): the carried text is the final request's system prompt; on an in-loop run whose loads recomposed the prompt, the earlier prompts are not carried as text and each is identified by `gen_ai.system_prompt_hash` on its `llm_inference` span; a new record carries `systemPromptHash` with no `skillText` when the run-end write of the text failed, or when at publish the stored text could not be read or did not hash to the reference. The hash-only record above states five span hashes, two distinct, and its `skillMetadata.systemPromptHash` is the last.
6. **`skillMetadata.skillText`, its sentence**: the website's `SYSTEM_PROMPT_TEXT` (`copy.ts:587-615`), no longer marked as hypotheses for this record's reviewer.
7. **`composition.sourcesOffered` and `trace.loadSpan.operationType`**: their sentences name the chooser sentence's groups by item 1's names.
8. **`skillMetadata.systemPromptHash`, its absence rule** (W4): the hash is carried inline "beside the skillText BlobRef when the text was stored (see skillMetadata.skillText's absence rule)". Revision 1 said beside the BlobRef without the condition, which item 5's failed write makes untrue.
9. **The never-carried rule for `consent.perSourceStates`** (W2 = C). Its `fact` and id are unchanged, and no field of a record carries the state: `sourcesOffered[].reason` is an outcome for one run. Revision 1 said the state "never enters a record". A record's notebook text does carry the setting the site applied: the reference host's notebook author writes "not used, set to Ask first" for a declined source (website `src/lib/notebook-author/tool-to-cell.ts:1169` at `4777b79`), and the production record `how-many-311-noise-complaints-were-filed-in-manhattan-last-week-and-what-is-37159b` carries it at `extensions["org.civicaitools.notebook"].cells[5].source[5]`. Revision 2's rule says so: the text, written at run time, may name the setting the site applied, and no host derives a consent state from that text or from any other part of a record. New records stop writing it under [npstorey/civic-ai-tools-website#714](https://github.com/npstorey/civic-ai-tools-website/issues/714).

The same two outcome definitions are in ADR-0033's amendment 2 and the harness's `LoadOutcome` comment (`format/vocabulary.ts`). ADR-0033 gains a dated note, and the comment is corrected for the harness's next release.

### §4 and §5 as they stand

- **§4's Shows bullet** quotes revision 1's chooser sentence and groups. It is not edited: it records what revision 1 stated. A host derives the words of the revision its verifier's row pins, and from revision 2 those are the words above.
- **§5's "nothing else".** §5 says a later revision "moves the digest and the row's pin (§2) and nothing else". The URL names a tag, and the bundle states its own URL, so a revision also moves the URL's tag. Revision 2 is at the tag the owner's merge kit sets on its merge commit, `v0.1.14-typed-standards-spec`, as revision 1 is at `v0.1.13-typed-standards-spec`. "Nothing else" reads as: no record, no field and no other row moves.

### The URL and the digest

- **URL:** `https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.14-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json`.
- **SHA-256 of `bundle.json`, revision 2 (2026-11-02):** `45bf3ab479325a791829ed9987f5f291fea44238b54bfb598f32f306f574eb9b`.
- Revision 1's URL and digest (§5) still name revision 1's bytes, at their own tag.

### What does not change

No record field, composition key or record byte moves. The 34 field ids and the 7 never-carried ids are unchanged, as are the classes, the version rule's text in the bundle, and §9.2 checks #16 and #17. Every published record keeps its bytes and its verdicts. The verifier's table row is re-pinned to revision 2's URL and digest in `@typedstandards/verify-core` 0.15.1, planned (§2: one verify-core patch per revision); until then the row names revision 1.

### References

- [civic-ai-tools#293](https://github.com/npstorey/civic-ai-tools/issues/293), [civic-ai-tools#294](https://github.com/npstorey/civic-ai-tools/issues/294) (the anchor, its G0 rulings, the words it proposed and the research check of G0-3); [civic-ai-tools#289](https://github.com/npstorey/civic-ai-tools/issues/289) (R10's cold read, findings F2 and F5).
- [npstorey/civic-ai-tools-website#714](https://github.com/npstorey/civic-ai-tools-website/issues/714) (new records stop naming the setting in the notebook text).
- Website `4777b79`: `src/lib/notebook-author/tool-to-cell.ts:1169`; `src/lib/mcp/routing-mode.ts:89-103`, `:300-313`; `src/lib/sources/decision.ts:243-250`, `:300-310`; `src/app/api/compare-stream/route.ts:282-288`; `src/app/api/query-notebook/route.ts:309-316`; `src/app/api/compare/route.ts:183-189`; `src/lib/sources/copy.ts:497-507`, `:522-526`, `:541`, `:587-615`; `src/lib/evidence/prompt-blob.ts`; `src/lib/flows/source-chooser.ts` (the three groups).
- Hub `af8faa7`: `packages/civic-typed-harness/src/format/dathere.ts:557-571`; `format/vocabulary.ts` (`LoadOutcome`).

## Note — 2026-11-02: two counts and a path in the amendment of 2026-11-02 (cold read R11, F2 and F3)

Found by sprint R11's cold read ([civic-ai-tools#294 comment 6588502038](https://github.com/npstorey/civic-ai-tools/issues/294#issuecomment-6588502038), findings F2 and F3) and corrected here under the owner's ruling of 2026-11-02 for a fix round. The amendment of 2026-11-02 is not edited. Revision 2's bytes, its URL and digest, and every record byte stay as they are; this note corrects the amendment's own description of them.

- **"Eight entries"** (the amendment's "What revision 2 changes"). Seven field entries change: `composition.routing`, `composition.sourcesOffered`, `environment.toolDefinitions`, `skillMetadata.skillText`, `skillMetadata.systemPromptHash`, `trace.loadSpan.loadOutcome` and `trace.loadSpan.operationType`. With the never-carried rule `consent.perSourceStates` and the header's `revision`, `date` and `url`, these are every member that differs between revision 1 (tag `v0.1.13-typed-standards-spec`) and revision 2 (tag `v0.1.14-typed-standards-spec`). The amendment's items 1 to 8 name the seven: items 2 and 3 are one entry, items 5 and 6 are one entry, and item 7 names two.
- **"five span hashes, two distinct"** (item 5). The hash-only record `data-cityofnewyork-us-analysis-2026-10-31-4a76c0` states four `gen_ai.system_prompt_hash` values, one on each of its four `llm_inference` spans, two of them distinct; its `skillMetadata.systemPromptHash` equals the last. The trace's fifth hash is the `executed_notebook` span's `analysis.prompt_hash`, which is a different hash.
- **"the one path with no pause"** (the `declined` bullet of "What revision 1 stated that a record does not hold"). A second path calls `createInLoopRouting` with no pause: the replay of an in-loop record, website `src/lib/model-loop/replay-loop.ts:607` at `4777b79`. It builds its directory with the consent gate not enforced (`:603`, `directorySet(configured, { enforced: false, states: {} })`), so every entry is `on` (`src/lib/mcp/routing-mode.ts:97-99`) and the `if (!pause)` branch at `:301` is not reached. The conclusion stands: today the no-pause case of `declined` reaches no published record.

## Amendment — 2026-11-07: revision 3 of the bundle (rulings D5 = D, G0-2 = A, G0-8 = A; the words ruled R1 = A, Q1 = A, Q2 = A, A3 = A)

Ruled by the owner on 2026-11-02 on the sources-at-scale design (planning-side), D5 = D (`considered` is a new field of the `civicaitools-v1` record, with an absence rule, in a bundle revision), and on 2026-11-06 at gate G0 of sprint S2, anchor [civic-ai-tools#309](https://github.com/npstorey/civic-ai-tools/issues/309): G0-2 = A (bundle revision 3, with specification v0.1.15 moving its version lines only) and G0-8 = A (`tool.load_asked` and `civic:loadAsked` in the same revision). Written by sprint S2-A's phase P1 and landing in its PR. §4 and §5 are not edited.

**The words went through a research check** before the phase's gate (#309, criterion A1.7), as revision 2's did: an independent read of the drafted words against the reference host's code and the project's research on consent and data-flow wording, reported in planning `temp/s2/research-check-p1.md` (SHA-256 `0e1f854b7dd48633be218abdda54cceefb808f627c64e22992c1c0b7fcd8344b`). The owner ruled it on 2026-11-07 ([#309 comment 6706653107](https://github.com/npstorey/civic-ai-tools/issues/309#issuecomment-6706653107)):
- **R1 = A:** the check's eight REVISE verdicts' words and its one KEEP, as the report gives them.
- **Q1 = A:** the site that ran the question is the subject of the `loadAsked` sentences ("The site that ran this question asked whether to use {source}." and "… did not ask whether to use {source}."); in the host-facing prose of those entries, "the reader" becomes "the person running the question".
- **Q2 = A:** a pack's `+hash12` is the first twelve hex characters of the hash its inventory entry states (`hash`); the inventory schema defines what that hash covers, not this bundle.
- **A3 = A:** a host finds a pack's name and author only in the inventory `composition.considered` cites, at its tag with its hash checked; otherwise it shows the id as written and names no author.

### What revision 3 adds

Four entries, each with the seven members and an absence rule, for the field and terms of [ADR-0033](0033-composed-harness-record-fields.md) amendment 3:

1. **`composition.considered`** (class `shows`): the inventory the run was routed against, by `id`, `version` (`<YYYY-MM-DD>.<n>+<hash12>`) and `hash`, with `total`, `listed`, `rule` and `ruleVersion`. The entry names no inventory version and no hash: a reader resolves a cited inventory at the hub tag `civic-inventory/<YYYY-MM-DD>.<n>` and checks the hash its `.sha256` file states, so a new inventory version is not a bundle revision. Its sentence is two sentences beside the chooser sentence: how many of the source inventory's sources the model was shown, then the rule's words; a rule or rule version the host has no words for is named as written.
2. **`trace.loadSpan.loadAsked`** (class `may-show`): the span attribute `tool.load_asked`, whether the site that ran the question asked the person running it whether to use the load's source, in this run. A producer that cannot tell omits it. A host says the site asked only when the value is `true`, and that it did not ask only when it is `false`.
3. **`civic.packId`** (class `may-show`): the graph term for the pack that shaped a call, read from `mcp.pack_id`. Its sentence names the pack, "a pack by {author}, using" its base, with the name and author resolved as A3 rules.
4. **`civic.loadAsked`** (class `may-show`): the graph's statement of `tool.load_asked`, on the load activity. The research check kept its drafted sentence.

### What revision 3 revises

- **`composition.components`**, its values and sentence: a pack is one entry of its own with `version` `<version>+<hash12>`, the twelve being the first twelve of the hash its inventory entry states (Q2), its base's entry present beside it; the sentence names it "{the host's name for the pack}, a pack by {author}, using {the host's name for its base}", with the name and author resolved as A3 rules.
- **`composition.routing`**, its sentence: the opening is followed by `composition.considered`'s sentences when the record carries it, and a loaded source the host resolves as a pack is named as in `composition.components`.
- **`trace.loadSpan.loadOutcome`**, its sentence, one clause: "No reason states whether a question was put or answered: a record states whether one was put only in trace.loadSpan.loadAsked, when it carries that attribute, and that entry's words are the only words for it." Revision 2's clause, "the record does not hold whether a question was put", is false of a record that carries `tool.load_asked`. The three reasons are unchanged.
- **The never-carried rule for `consent.who`:** a record states only that a load was asked for, how it ended, and, where it carries `trace.loadSpan.loadAsked`, whether a question was put; never who answered it. Its `fact` and id are unchanged.
- Two corrections that are not reader sentences: `civic.loadOutcome`'s values no longer say it is always the activity's last key (`civic:loadAsked` follows it), and `environment.toolDefinitions`' absence rule cites the harness's branch at its new lines (`format/dathere.ts:662-676`).

The 34 entries of revision 2 keep their ids, paths and classes, and the 7 never-carried entries keep their ids and facts.

**Revision 2's amendment, as history.** The amendment of 2026-11-02 says "The record does not hold whether a question was put to the reader, so revision 2 states no reason that says one was." It is not edited: it was true of every record revision 2 described. A record carrying `tool.load_asked` does state whether a question was put; from revision 3 the bundle says so, and the reasons still state none.

### The version rule's reading

§2 lists "an added entry with an absence rule, a new reader sentence or a corrected citation" among the changes that stay `v1`, and names `civicaitools-v2` "when a declared field changes meaning, is removed, or a v1 reader statement (§4) would be false of the record". Each change, read against it:

- **The four added entries** are each an added entry with an absence rule, and each reads as not recorded on every record before harness 0.12.0: `v1`.
- **`composition.components`' values and sentence and `composition.routing`'s sentence** add words for a pack entry and for `considered`, which no earlier record carries; `components[]`'s form already admitted such an entry, and no existing record's reading changes: `v1`.
- **`trace.loadSpan.loadOutcome`'s sentence and the `consent.who` rule** are corrected with the revision that adds the attribute they would otherwise contradict. Each of revision 2's words is true of every record before harness 0.12.0, and no declared field changes meaning; as the amendment of 2026-11-02 reads §2, a statement corrected by a revision is not a change in the records' meaning: `v1`.
- **The two corrections** are a corrected statement and a corrected citation: `v1`.

Revision 3 therefore stays `ai-assisted-analysis/civicaitools-v1`, and no record is re-labelled.

### The URL and the digest

- **URL:** `https://raw.githubusercontent.com/npstorey/civic-ai-tools/v0.1.15-typed-standards-spec/docs/profiles/ai-assisted-analysis/civicaitools-v1/bundle.json`.
- **SHA-256 of `bundle.json`, revision 3 (2026-11-07):** `db8175703601a5de9d785a2cda93db194eb05cdeeb222dcfd509ea8ab249f016`.
- Revision 2's URL and digest (the amendment of 2026-11-02) still name revision 2's bytes, at their own tag. The verifier's table row is re-pinned to revision 3 in `@typedstandards/verify-core` 0.15.2, planned (§2); until then the row names revision 2.

### What does not change

No record byte moves for a record built without `considered`, `mcp.pack_id` or `tool.load_asked`. The classes of revision 2's entries, the version rule's text in the bundle, and §9.2 checks #16 and #17 are unchanged. Every published record keeps its bytes and its verdicts.
