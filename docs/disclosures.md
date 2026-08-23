# Public disclosures

This is the standing, dated record of major public-facing changes and integrity gaps for this
project — the mechanism that makes `docs/sustainability.md`'s commitments ("thirty days to fix or
publicly advise on a critical issue," "publicly disclosed maintenance state," "no stealth
deprecation") more than prose. Before this doc existed, the one precedent was an inline paragraph in
`ROADMAP.md` §3; that paragraph is now entry 1 below, with a one-line pointer left in its place.

**Entries are appended, never edited silently.** A correction to an existing entry is a new dated
line, not a rewrite of the old one.

**Entry shape.** Every entry answers the same eight questions:

| Field | Meaning |
|---|---|
| Date | When the entry was published |
| Surface | What a reader or integrator sees (site, API, skill, docs) |
| What was claimed | The statement as it stood |
| What was true | The measured fact, with file:line at a named commit |
| Window | First affected commit/date → fix commit/date |
| Affected | Count of records/users/integrators, with the referent stated |
| Fix | PR + merge SHA, or "advised, fix scheduled by \<date\>" |
| Registry | The open-questions Q / ADR / issue that carries the decision |

Related: [`docs/trust-and-evidence.md`](trust-and-evidence.md) (what a signature does and does not
establish for a reader), [`ROADMAP.md`](../ROADMAP.md) §3 (the durable trust and reliability
commitments this log exists to make good on).

---

## 1. ADR-0016 vocabulary migration shipped ahead of the notice window it later promised

| Field | |
|---|---|
| **Date** | 2026-08-10 (first published, as a `ROADMAP.md` §3 paragraph; relocated here 2026-08-23 with no change in substance, per civic-ai-tools#172) |
| **Surface** | The reference deployment's public API — the `visibility` field's values (`committed`/`published`) — and the public `ROADMAP.md` commitment describing how breaking changes to it are disclosed |
| **What was claimed** | The prior form of `ROADMAP.md` commitment 3 ("no silent breaking changes") described a fixed 90-day advance-notice window ahead of any breaking change to the documented API contract |
| **What was true** | The ADR-0016 vocabulary migration — `committed`→`sealed`, `published`→`public` — changed the values the API serves and accepts ahead of that notice mechanism: no 90-day window ran, and no shorter period was published with rationale before the change |
| **Window** | Not separated into first-affected/fix commits in the original disclosure; the source paragraph states the migration path (an accept-both phase) shipped *before* the breaking read, and that the change landed pre-launch. [ADR-0016](adr/0016-vcs-native-lifecycle-mapping.md) itself was accepted 2026-06-15; no more precise window is available without inventing one, so none is stated here |
| **Affected** | Zero known external API consumers at the time of the change, per the source paragraph — legacy aliases (`committed`/`published`) are still served today |
| **Fix** | Not a code fix: the commitment's own language was corrected to state its phasing explicitly (the fixed 90-day window now applies once the spec and API stabilize, rather than unconditionally today). Adopted through the civic-ai-tools#140 roadmap-change review (closed 2026-08-11) |
| **Registry** | civic-ai-tools#140 (roadmap-change review); [ADR-0016](adr/0016-vcs-native-lifecycle-mapping.md) |

**In full, as it stood in `ROADMAP.md` §3** (ported verbatim, no information lost in the move):

> *Disclosure (2026-Q3) — the history behind this restaging.* The ADR-0016 vocabulary migration
> changed the visibility values the API serves and accepts (`committed`→`sealed`, `published`→
> `public`) ahead of the notice mechanism the previous form of this commitment described: no 90-day
> window ran, and no shorter period was published with rationale before the change. Mitigating facts,
> recorded rather than offered as excuses: the migration path shipped *before* the breaking read (an
> accept-both phase preceded the flip), legacy aliases are still served, and the change landed
> pre-launch with no known external API consumers at the time. The commitment's substance — no silent
> breaking change, and a migration path with every one — held; the fixed notice window did not, which
> is why the commitment now states its phasing explicitly. Adopted through the civic-ai-tools#140
> roadmap-change review.

`ROADMAP.md` §3 commitment 3 now carries a one-line pointer to this entry in place of the full
paragraph.

---

## 2. Correctness reviews were recorded unsigned while four surfaces said they were signed

| Field | |
|---|---|
| **Date** | 2026-08-22 (advisory published, same day the fix landed; backfill counts and public verification below completed 2026-08-23) |
| **Surface** | `PositioningBand.tsx` (home-page build-state copy), `AttestationDialog.tsx` (review-submission copy), `expert-attestation.ts` and `schema.ts` module documentation, and one internal working draft (`docs/proposed-issues/007-...md`) — all in civic-ai-tools-website |
| **What was claimed** | A human correctness review carries a cryptographic signature — asserted as shipped, not planned |
| **What was true** | Every correctness review was content-addressed and hash-bound to its base package, and unsigned. The submission route computed a signature and an RFC 3161 timestamp on every submission and discarded both before either reached a column that could hold them |
| **Window** | `8f86c9f` (2026-04-12) → `1171c2e` (2026-08-22) |
| **Affected** | Nine attestations across seven records — five human expert reviews, four machine attestations (evaluation and consistency) |
| **Fix** | P1 `1171c2e` (persist-and-refuse, merged 2026-08-22); P2 `aafae07` (backfill, merged 2026-08-22) |
| **Registry** | civic-ai-tools#63 Q73 — open. The persistence defect this entry discloses is fixed; Q73's remaining, distinct question is whether a correctness endorsement should carry the *instance operator's* signature at all |

**Found by:** the civic-ai-tools#63 threat-model cold read, registered there as Q73.
**Severity:** disclosure defect — the platform described a property it did not have. No signature was
forged, and no verification verdict was affected.

### What was claimed

Four product surfaces and two internal drafts told readers that a human correctness review carried a
cryptographic signature.

**Public build-state claims** — `src/components/home/PositioningBand.tsx`:

- `:230` — "human review attaches as its own signed attestation", carried alongside a `<LegendLabel
  status="built" />`. This is the strongest form of the claim: not a plan, not a roadmap item, but an
  assertion that the capability was built and shipped.
- `:273` — "human review is recorded as its own signed attestation."

**Submission-time copy** — `src/components/evidence/AttestationDialog.tsx`, shown to a reviewer at the
moment they submitted:

- "A signed, timestamped review from a domain expert."
- The submit button read "Signing and publishing…" while the request was in flight — describing an
  operation that was not happening.

**Module-level documentation**, which is where a contributor would go to check the first two:

- `src/lib/evidence/expert-attestation.ts:2` — "A human domain expert submits a free-text signed
  review on an evidence package."
- `src/lib/db/schema.ts:32` — "`expert_attestation` is a free-text, signed review attached by a human
  domain expert."

**Internal working drafts** — `docs/proposed-issues/007-attestation-as-upstream-evidence.md` described
the attestation infrastructure as already "handling signing", and reasoned about future work from that
premise.

### What was actually true

From `8f86c9f` (2026-04-12) until `1171c2e` (2026-08-22), every correctness review was
**content-addressed and hash-bound to its base package, and unsigned.**

The submission route called `signPackage(hash)` **without awaiting it** and discarded the return
value; it then awaited `getRfc3161Timestamp(hash)` and discarded that too; then it inserted a row into
a table that had no column to hold either. A signature was computed on every single submission and
thrown away. `attestation_packages` gained `signature`, `signing_key_id`, `rfc3161_timestamp`,
`signed_at`, and `unsigned_reason` only at migration 0016, as part of the fix.

The reviews themselves were never fabricated or altered. Review text, author identity, and the content
hash binding each review to the package it commented on were all stored correctly and remain
unchanged. What was missing was the cryptographic commitment tying them to the recording instance.

### What was NOT affected

Scoping this precisely matters, because "signatures were broken" would overstate it in three
directions:

- **Base-record signatures were unaffected.** Published record packages were signed, timestamped, and
  logged exactly as documented. This defect was confined to the review rows in `attestation_packages`.
- **No verification verdict was affected.** Reviews have never been an input to verification (spec
  §9.2 check #10; ADR-0010). A signed review would not have changed any verdict, and an unsigned one
  did not either. No published verification result needs revisiting.
- **Lifecycle attestations were unaffected.** The `attestation_nodes` chain — `publishes`, `locatedAt`,
  `withdraws`, `reinstates`, `evaluates` — consists of full signed envelopes, each with its own
  envelope hash, signature, timestamp, and transparency-log proof. Those are a different table and a
  different mechanism, and every claim made about them was and is accurate.

### How it was found

Not by a user report and not by monitoring. It surfaced during the civic-ai-tools#63 threat-model cold
read — a deliberate line-by-line pass comparing what the surfaces claim against what the code does —
and was registered there as open question Q73.

We consider the detection route itself worth disclosing: the defect was invisible to tests (nothing
asserted the signature was persisted), invisible to type-checking (the discarded return value was
legal), and invisible to the UI (which rendered its claim from static copy rather than from row
state). It survived four months because nothing in the system was positioned to notice it.

### What was done

**P1 (`1171c2e`) — stop the bleeding, and make the state legible.**

Migration 0016 added the five signature columns. The write path now signs, timestamps, and persists,
and a three-way split replaced the previous silent discard:

- **No signing key** → the review is stored, labeled unsigned, with `unsigned_reason =
  'no_signing_key'`. This is ADR-0020 §B's intended unsigned tier: this repo's own CI is keyless, and
  so is every first-run self-hoster. Nothing is misrepresented, because the row records why it is
  unsigned and the record page says so.
- **Key present, signing fails** → the submission is refused (HTTP 500,
  `attestation_signing_failed`) and nothing is persisted. Storing it anyway would produce a row
  indistinguishable from the keyless tier, recording a misconfiguration as though it were a choice.
- **Timestamp authority unavailable** → stored, signed, not timestamped. Never a refusal; a third
  party's uptime does not decide whether a reviewer can submit.

`unsigned_reason` is a closed vocabulary rather than free text, mirrored into a `Record<>` keyed by
that vocabulary, so a value with no reader-facing copy is a compile error rather than a row that
renders as nothing.

The four overclaiming surfaces were corrected in the same change: the home-page copy was scoped, the
dialog copy now says each review "shows its own signing status once submitted", and the module
comments were corrected.

**P2 (`aafae07`) — sign the rows that were already there, honestly.**

A backfill (`scripts/backfill-attestation-signatures.ts`) signs the reviews recorded during the
affected window. Three properties are worth stating publicly, because each one is a place where a
backfill could have quietly made things worse:

- **`signed_at` records when the signature was actually produced — never the review's own
  timestamp.** Backdating would assert a moment that did not happen. The record detail page shows the
  signing date alongside the review date wherever the two differ, so a reader can see that the
  signature came later. That visible gap is what makes this a correction rather than a silent
  rewrite.
- **A keyless backfill run refuses outright and touches no row.** Labeling every historical review
  `no_signing_key` would take the operator's current environment and assert it retroactively across
  rows written under a configuration the run cannot observe — replacing "unknown" with a specific and
  possibly false claim, irreversibly.
- **A row the pass reaches and cannot sign is labeled `backfill_signing_failed`, never left blank.** A
  blank would be indistinguishable from a row the pass never reached, destroying the only record that
  an attempt was made.

**Backfill results (apply run, 2026-08-22):** **9 signable / 9 signed / 0 failed** — every row the
backfill reached, it signed. The referent: nine attestation rows across seven records — five human
expert reviews and four machine attestations (evaluation and consistency) — all signed 2026-08-22,
each `signed_at` set to when the backfill actually produced the signature rather than to the review's
original timestamp, and zero backdated.

### Verification

Confirmed 2026-08-23 on the public record `median-household-income-for-manhattan-255b8e`, viewed
**signed out** in an ordinary browser: the 2026-04-19 expert attestation on that record renders "✓
Signed and timestamped" followed by —

> "Signed August 22, 2026, after the review itself was recorded. This review predates signing on this
> instance; the signature was added later and is dated when it was actually produced, not backdated to
> the review."

Review date and signing date render as distinct values, four months apart, to an anonymous reader — a
backfilled signature dated when it was produced, not backdated, is visible on the public web rather
than asserted only in a report. Sprint close record:
[civic-ai-tools-website#294 (comment)](https://github.com/npstorey/civic-ai-tools-website/issues/294#issuecomment-5388669226).

**Cross-reference.** [civic-ai-tools-website#307](https://github.com/npstorey/civic-ai-tools-website/issues/307)
tracks a separate, related defect: the public record index reports `attestationCount: 0` for every
record, including ones carrying the nine attestations described above — the counting bug that made
these signed reviews look absent from the registry surface. It does not change any fact in this entry;
the underlying rows and signatures described here are correct and independently verifiable on each
record's own page.

### Commitment

This project's published security-triage commitment, quoted from `docs/sustainability.md`:

> Security triage SLOs: five business days to acknowledge, thirty days to fix or publicly advise on a
> critical issue.

Clock started **2026-08-22**. Thirty-day mark: **2026-09-21**.

The code fix landed the day the clock started. This entry is the public advisory half of that
commitment, complete as of 2026-08-23 with the backfill counts and the public verification above.
