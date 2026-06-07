<!-- v1 (2026-06-07) — AI-assisted theory-of-change evaluation summary, produced from
     an Evens Foundation Theory-of-Change tool stress-test (6 core causal links, run in
     both maximal and scoped form = 12 runs) plus independent web verification of all 38
     load-bearing citations (existence, attribution, claim-fit, replication status).
     STATUS: AI-assisted research artifact, NOT yet human-vetted. See README.md in this
     folder for the standing caveat. Citations and their verdicts live in references.md.
     A tightened external/funder cut is TBD. Bump this comment on structural change. -->

# Theory of Change — Evens Foundation Evaluation Summary

> ⚠️ **AI-assisted research, not yet human-vetted.** This document was produced with an
> AI agent (Claude Code) from an external Theory-of-Change stress-test plus automated
> citation verification. Every citation was machine-checked, but the synthesis,
> judgments, and grades have **not** been reviewed by a human domain expert. Treat it as
> a structured draft input to a future vetted theory of change — verify independently
> before any external use. Full caveat and method: [`README.md`](README.md). Citation
> verdicts: [`references.md`](references.md).

**Subject:** the theory of change implicit in Civic AI Tools / Typed Standards.
**Built:** 2026-06-07.
**Method:** each causal link stress-tested with the [Evens Foundation Theory-of-Change tool](https://theory.evensfoundation.eu/) in maximal and scoped form; every load-bearing citation independently verified for existence, attribution, claim-fit, and replication status (see [`references.md`](references.md)).

---

## 0. How to read this

This is **not** six independent theories. It is **one nested stack** of capabilities, each of which is *necessary* to the project's purpose and *none* of which is *sufficient* on its own. Reading the layers as rival theories — "is the access bet right, or the crypto bet?" — produces the wrong analysis. The right reading is: each layer delivers a concrete technical capability; the capabilities compose; and the project's purpose (trustworthy AI-assisted civic data analysis) emerges only across the whole stack, conditioned on factors outside the project's control.

### The one discipline this document enforces

> **We claim capabilities. We do not claim behavior change.**

When a causal claim describes *something the project ships and a third party can check* — "this analysis is cryptographically verifiable," "an independent verifier can confirm it," "a reader can tell the states apart" — the evidence is strong and the claim is defensible. The instant a claim crosses into *how humans or institutions will behave as a result* — "therefore trust," "therefore accountability," "therefore disputes move to substance" — the evidence collapses. The empirical literature is unambiguous on this, across four decades and every adjacent domain (PKI, content provenance, e-voting, open data, misinformation labels).

This boundary is not a weakness we are hiding; it is the **design principle the project already runs on**. The [Xanadu doctrine](../../architecture/xanadu-doctrine.md) ("no promotion without an adopter"), [ADR-0013's "never a verdict"](../../architecture/open-questions.md) framing, and the necessary-not-sufficient stance in [trust-and-evidence.md](../../trust-and-evidence.md) are all internal articulations of the same line. The value of the external stress-test is that an adversarial, citation-backed instrument independently drew that line in the *identical* place — clause by clause — which is suggestive (not proof) that the line is real and not self-serving.

**The practical rule for all downstream comms:** watch the word "so." Everything up to "…integrity and authorship are independently checkable" is defensible. The clause that begins "…*so* people will trust / act / argue differently" is the part we cannot assert. State the capability; offer the behavior change as a hypothesis to be tested, never as a claim.

### Grade legend

Each link carries the grade the stress-test assigned to its **scoped** (capability) form, plus the grade of its **maximal** (societal-outcome) form, to make the boundary visible.

| Grade | Meaning |
|-------|---------|
| **Strong** | The capability is well-supported by deployed systems and the literature; the claim is defensible as written. |
| **Moderate** | The capability is real but bounded by a genuine, named residual risk that is partly outside our control. |
| **Weak** | The claim depends on a human/institutional behavior change the evidence does not support. We do not make these claims. |

---

## 1. The layered stack

```
Layer 6  Verifiability substrate        — integrity/authorship are settled questions
Layer 3  Provenance & attestation       — third-party, trustless integrity verification
Layer 2  Grounding                      — figures derive from real queries, audit-traceable
Layer 4  Open standard + verify-core    — independent implementations interoperate
Layer 5  Legibility                     — a non-expert can read the verification state
Layer 1  Access                         — intermediaries self-serve civic data
```

Each section states the scoped claim, what we explicitly do **not** claim, the load-bearing assumptions, the verified evidence on both sides, and the honest residual. Citation keys in **[brackets]** resolve in [`references.md`](references.md).

---

### Layer 1 — Access  ·  *scoped: Moderate · maximal: Weak*

**X → Y (claimed):** Giving journalists, analysts, and students a natural-language AI interface to open civic datasets lets those intermediaries independently produce correct, reproducible first-pass queries against datasets they previously needed SQL, an API, or a data engineer to touch.

**We do NOT claim:** that this produces "more data-informed civic decisions" or "greater public accountability." Access is not the binding constraint on accountability; intermediaries, sanctions, and political will are **[Fox2007] [Joshi2013] [YuRobinson2012]**.

**Load-bearing assumptions:**
1. Civic datasets are clean/documented enough for an LLM to map language → correct schema and semantics.
2. A non-technical user can recognize when a query runs cleanly but returns semantically wrong results.
3. First-pass query *authorship* is the bottleneck — not data discovery, cleaning, or interpretation.

**Evidence for:**
- Natural-language DB interfaces let novices complete tasks they otherwise could not — *given interactive disambiguation* **[NaLIR2014]** (small pre-LLM user study).
- Text-to-SQL is strong on clean benchmark schemas **[Spider2018]** (⚠️ the ~90% figure is a **2023 LLM-leaderboard** result, **not** from the 2018 paper).

**Evidence against (the residual):**
- **Real-world accuracy collapse.** On large, dirty, ambiguous schemas, accuracy drops sharply: GPT-4 reached ~55% on BIRD vs. ~93% human **[BIRD2023]**; *Spider 2.0* (2024) knocks top models to ~31%. The "correct and reproducible" bar is far from met on the messy civic schemas actually in scope.
- **Confident hallucination.** LLMs emit plausible-but-wrong queries users trust uncritically **[JiHalluc2023]**.
- **Automation bias.** Non-experts over-rely on automated output and miss errors — exactly where their verification skill is weakest **[Parasuraman2010]**.

**Honest residual — the project's #1 genuine weak spot, and it is measurable.** Two open questions answerable with our own datasets: (a) *What is execution accuracy on the specific Socrata schemas in scope (NYC/Chicago/SF), not Spider/BIRD?* (b) *What catches a clean-running, semantically-wrong query before a non-SQL journalist publishes it?* Layer 2's source-linked trail is the intended answer to (b) — but only if something forces the check (see the gatekeeper problem, §2). Defensible framing: the tool **lowers the authoring barrier**; it does **not yet** guarantee correct output on dirty data, and the error-detection surface is unsolved.

---

### Layer 2 — Grounding  ·  *scoped: Moderate · maximal: Weak*

**X → Y (claimed):** Constraining civic AI tools to report only what real dataset queries return, with each figure linked to its source query, produces fewer fabricated civic figures and a reader-checkable trail from every stated number back to the query that produced it.

**We do NOT claim:** "more public trust." Accuracy is not trust; trust is shaped by reliability perception, prior attitudes, and institutional legitimacy far more than by error rate **[LeeSee2004]**.

**Load-bearing assumptions:**
1. The underlying civic datasets are themselves accurate (garbage-in is not laundered by clean provenance).
2. Constraining to query results does not suppress so much that the tool becomes unusable.
3. Readers actually inspect the linked queries rather than trusting figures uncritically.

**Evidence for:**
- Retrieval grounding measurably reduces fabricated content vs. ungrounded generation — *directionally; it does not eliminate it* **[RAG2020]**.
- A standard for traceable lineage exists and aids error detection — *but only records the trail; it does not authenticate it* **[PROV2013]**.

**Evidence against (the residual):**
- **Grounding ≠ elimination.** Even with retrieval present, systems produce unsupported/misattributed claims via faulty synthesis **[Shuster2021] [LiuVerifiability2023]** (only ~51.5% of generated sentences were fully supported by their own citations).
- **Garbage-in.** Constraining to dataset queries propagates flawed administrative data; clean provenance can *launder* bad inputs **[ONeil2016]**.
- **Trails rarely followed.** Audiences seldom follow links or check sources, blunting the audit trail's deterrent value **[Loewenstein2012]**.

**Honest residual:** the honest claim is "**fewer** fabricated figures and an **auditable** trail," never "hallucination-free" — the CLAUDE.md "never hallucinate data" rule is an asymptote, not an attainable state. The reader-checkable trail is a genuine capability (it *enables* checking); whether anyone checks is a behavior claim we don't make (and §2's gatekeeper problem is why it matters).

---

### Layer 3 — Provenance & attestation  ·  *scoped: Strong · maximal: Weak*

**X → Y (claimed):** Attaching cryptographic signatures, timestamps, and provenance graphs to AI-generated civic analyses lets any third party confirm — without trusting the publisher — that a given analysis is unaltered, was produced at the stated time by the stated key, and references the stated source datasets.

**We do NOT claim:** "greater accountability for AI claims." Signatures authenticate the signer, not the correctness of the analysis. Verifiably-signed nonsense is still nonsense.

**Load-bearing assumptions:**
1. Publishers sign with controlled private keys and bind *real* source-dataset hashes honestly.
2. Verifiers have access to trustworthy public keys and timestamp anchors.
3. Primitives remain unbroken and correctly implemented.

**Evidence for (the project's strongest ground):**
- **Trustless verification at internet scale works.** Append-only public logs let any third party verify issuance without trusting the issuer **[RFC6962]** (*Experimental*; mandatory enforcement is Chrome browser *policy* since 2018, not the RFC itself).
- **Supply-chain provenance is deployed.** Sigstore + SLSA let downstream parties verify build origin and detect tampering — *trust is shifted, not eliminated*: you still trust the OIDC IdP, Fulcio CA, build platform, and Rekor operators **[SigstoreSLSA]**.
- **Existence-at-time is provable** **[RFC3161]** (note: RFC 3161 TSA tokens and OpenTimestamps' Bitcoin anchoring are two *different* trust models).

**Evidence against (the boundary of the Strong claim):**
- **The input-binding gap.** Signatures prove a key signed a claimed dataset *hash*; they cannot prove the analysis genuinely derived from that data. "Garbage-in claims are signable" **[C2PA]**. → **Within this Strong card, claim only "references the *stated* hashes," never "references the *correct* data."** This gap is exactly what the captureMethod / JSONL-readback work ([ADR-0003](../../architecture/open-questions.md)) is narrowing — the project's live frontier, not a settled property.
- **Key-trust roots fail.** "The stated key" can be misissued or compromised, undermining the no-trust premise at the key-management layer **[DigiNotar2011]** (~500+ fraudulent certs used for MITM). *(Note: SolarWinds is NOT a valid example here — the signing key was not stolen; the build pipeline was subverted pre-signing. See references.md.)*
- **Verification non-adoption** (carried to §2 of the weak-spots): capability ≠ behavior **[Johnny1999]**.

**Honest residual:** this layer is genuinely strong — "well-supported by decades of cryptographic research and deployed systems." The only soft sub-claim is source-data binding, which we scope honestly and are actively hardening.

---

### Layer 4 — Open standard + shared verify-core  ·  *scoped: Strong · maximal: Moderate*

**X → Y (claimed):** Publishing the evidence format as an open, documented standard with a shared verification library lets an independent second implementation verify packages produced by the first with no coordination between the two parties.

**We do NOT claim:** "a decentralized ecosystem of publishers and verifiers emerges." Interop is demonstrable now; an *ecosystem* depends on adoption incentives and governance that standards alone don't supply (RSS stagnation; OpenID/OAuth consolidation).

**Status note:** this is the one layer where the scoped claim is **already realized** — `@typedstandards/verify-core@0.1.0` is consumed by both civicaitools.org and the `typedstandards` monorepo, and typedstandards.org/verify verifies prod packages in-browser.

**Load-bearing assumptions:**
1. The prose spec is complete/unambiguous enough that a second team need not consult the first.
2. The verification library encodes the *spec*, not the first implementation's quirks.
3. Both parties conform rather than embrace-and-extend.

**Evidence for:**
- Open RFC-specified protocols repeatedly yield independent interoperable implementations **[TLSACME]** (TLS 1.3 across OpenSSL/BoringSSL/rustls; ACME across Certbot/acme.sh/lego) — though "no coordination" is softened in practice by interop testing and shared lineage.
- Conformance suites turn paper standards into testable interoperability (POSIX/IEEE 1003; Matrix Sytest; Debian Reproducible Builds).

**Evidence against (the residual):**
- **Reference-implementation capture.** When a shared library becomes the de facto spec, second implementations inherit its quirks; RFC ambiguity breeds divergent, sometimes-buggy implementations **[MessyTLS2015]** (🔶 note: the paper documents RFC-ambiguity bugs; "OpenSSL is the de facto spec" is our extrapolation, not its literal claim). Browser CSS divergence and the OOXML conformance gap are the cautionary cases.

**Honest residual:** the live risk isn't *whether* interop works — it does — but whether `verify-core` silently becomes the standard. Mitigation: keep the prose spec normative, and build conformance tests independent of any single implementation that both parties can run blind.

---

### Layer 5 — Legibility  ·  *scoped: Moderate · maximal: Moderate*

**X → Y (claimed):** Rendering an AI analysis's provenance and verification status as a one-glance signal lets a non-technical reader correctly tell apart a verified-and-current analysis from an unverified, altered, or superseded one without reading the cryptography.

**We do NOT claim:** that legibility "changes sharing behavior" or "reduces the spread of confident-but-wrong claims." Scoping Y to *comprehension* (can they read the state?) rather than *behavior* (does reading it change what they do?) deliberately steps around the intractable motivated-reasoning literature and lands on a tractable, usability-testable HCI problem.

**Load-bearing assumptions:**
1. Readers actually attend to the signal rather than ignoring it.
2. A single glyph/color can reliably encode multi-state meaning (verified / altered / superseded / unverified).
3. Users interpret it correctly and don't habituate or over-trust.

**Evidence for:**
- Verification UI *can* communicate origin to lay viewers when prominent and consistent **[C2PA]** (Content Credentials pilots).

**Evidence against (the residual — note several of these REVERSE claims the project might naively make):**
- **Comprehension is hard.** Even well-designed connection-security indicators: only ~half of 1,329 users could identify a secure connection **[FeltIndicators2016]** (🔶 its *dominant* finding is low comprehension, not that chrome works).
- **Indicators get ignored.** Users proceed without the lock/auth cues **[EmperorIndicators2007]**; EV certificate UI was *removed* by Chrome/Firefox in 2019 for low efficacy **[EVremoval2019]**.
- **Habituation.** Repeated exposure → habituation and click-through **[Habituation2018]** (fMRI).
- **Badges don't reliably move trust — and can invert.** A verified checkmark had **no significant effect** on perceived credibility or sharing **[VerifiedBadge2019]** (🔶 contradicts the naive claim); and when Twitter's checkmark became paid, its meaning inverted and was widely misread **[TwitterBlue2023]**.
- **Explanations can worsen reliance.** AI explanations increased acceptance of recommendations *regardless of correctness* **[Bansal2021]**.

**Honest residual:** the defensible claim is comprehension, and even that degrades past binary states — encoding 4+ states glanceably, resisting habituation, and resisting spoofing are real design problems. This is the remit of the DTPR/TrustSignal work (`civic-ai-tools-website/docs/evidence-trust-ux-memo.md`). Scope the project's claim to "a non-expert can *read* the state correctly," validated by usability testing — never to behavior change.

---

### Layer 6 — Verifiability substrate  ·  *scoped: Weak · maximal: Weak*

**X → Y (claimed in the stress-test):** Making civic AI outputs cryptographically verifiable means integrity and authorship stop being open questions, *so* any dispute about an output is forced onto its method, data, and interpretation rather than whether it was tampered with.

**Verdict: this is the line we do not cross.** The "*so* disputes move to substance" clause is not a capability — it is a claim about how human discourse reallocates, and the evidence contradicts it. This card stayed **Weak even after scoping**, because the scoped Y still smuggled a behavioral payload back in. The genuinely-scoped version of this layer *is Layer 3* (the capability), which is Strong. Layer 6 exists in this document only to **mark the boundary explicitly.**

**Why it fails (the evidence):**
- **Real disputes already center on method, not tampering.** COMPAS and SyRI were never about tampering — they were about data bias, interpretation, and legitimacy; verification would not have touched them **[COMPAS2016] [SyRI2020]** (note: the COMPAS *fairness* question is itself **mathematically unresolved** — incompatible fairness criteria under unequal base rates; see references.md).
- **Verification is rarely consumed** **[Johnny1999] [EmperorIndicators2007]**.
- **Proof rarely changes motivated beliefs — but state this carefully.** Durable misperceptions are real; the strong "backfire effect" is **not** **[Backfire2010overturned]**: Nyhan & Reifler (2010) was **overturned** by Wood & Porter (2019) across 10,000+ subjects, and Nyhan himself walked it back. The defensible claim is "corrections and proofs are often *insufficient* against identity-driven priors," **never** "corrections backfire."

**What this layer tells the project:** verifiability *removes one category of doubt* (was this tampered/fabricated?). It does not manufacture trust, and it does not relocate disputes. Claim the removal; never claim the relocation.

---

## 2. The genuine weak spots (consolidated)

Stripped of the over-claims, four real soft spots survive — and they are where effort should go.

1. **The #1 empirical gap (Layer 1).** Text-to-SQL accuracy on dirty civic schemas, and detection of clean-but-wrong queries by non-experts. *Measurable with our own data.* Until measured, "correct and reproducible" is aspirational.

2. **The input-binding frontier (Layer 3).** Signatures bind *stated* hashes, not *correct* data. Narrowing this is the captureMethod/ADR-0003 work. Claim accordingly.

3. **The gatekeeper problem (cuts across Layers 2, 3, 5, 6).** Every "and then someone verifies / checks the trail / reads the badge" step is a *voluntary* act the literature says people skip. The one case where verifiable infrastructure genuinely shifted behavior — Certificate Transparency — worked because a **gatekeeper (the browser) made verification non-optional.** PGP, which relied on voluntary verification, did not. **The project currently has no enforcing gatekeeper.** The strategic question: *who makes verification non-optional?* A funder mandate, a newsroom house rule, a procurement requirement. Without one, adoption stays voluntary and slow — the single highest-leverage gap in the whole theory of change.

4. **Legibility is an HCI problem, not a social-science one (Layer 5).** Tractable, but unsolved past binary states, and vulnerable to habituation and spoofing. Usability-test it; scope to comprehension.

---

## 3. What would falsify or strengthen this

A theory of change is only defensible if it names what would change its mind.

| Claim | What would strengthen it | What would falsify it |
|-------|--------------------------|------------------------|
| Layer 1 (access) | Measured ≥X% execution accuracy on in-scope Socrata schemas + a working semantic-error catch | Accuracy on real civic schemas stays near BIRD/Spider-2.0 levels (~30–55%) with no reliable error-catch |
| Layer 3 (provenance) | A second independent verifier confirms prod packages (✓ done) | A signed package is shown to bind a hash it didn't actually derive from, undetectably |
| Layer 4 (interop) | A truly independent implementation (not using verify-core) passes conformance | Every "independent" verifier in fact depends on verify-core, i.e. reference-impl capture |
| Layer 5 (legibility) | A usability study shows non-experts read 4 states correctly above chance, without habituation | Users can't distinguish states, or treat "no badge" as "safe" |
| Gatekeeper (§2.3) | One named adopter makes verification non-optional in a real workflow | Verification remains voluntary and telemetry shows ~nobody verifies |

---

## 4. The defensible one-paragraph statement

> Civic AI Tools connects AI to real civic datasets and constrains it to report only what queries return, with each figure traceable to its source — reducing (not eliminating) fabricated figures and producing an auditable trail. Analyses can be published as cryptographically signed, timestamped, provenance-graphed evidence packages that **any third party can independently verify**, without trusting the publisher, as unaltered, attributed, and referencing stated sources — a capability that is well-established and, via an open standard and a shared verification core, interoperable across independent implementations. We make these **capability** claims and stand behind them. We do **not** claim that verifiability, grounding, or legibility *by themselves* produce public trust, accountability, or changed behavior: the evidence shows those outcomes depend on intermediaries, enforcement gatekeepers, institutional legitimacy, and political will that lie outside the tooling. Verifiability is a **necessary, not sufficient,** condition — it removes one category of doubt (tampering and fabrication) so that scrutiny *can* move to method, data, and interpretation, where it belongs.

---

## 5. Provenance of this document

Built 2026-06-07 with Claude Code (Opus 4.8) from a structured external stress-test (Evens Foundation Theory-of-Change tool — causal-chain, hidden-assumption, and adversarial-evidence analysis of six core links, run in both maximal and scoped form) followed by independent verification of all 38 load-bearing citations, including replication and contestation status ([`references.md`](references.md)). Citation caveats are stated inline rather than hidden; the corrections that materially changed claims (the non-replicating backfire effect, the null badge-trust result, the Spider accuracy misattribution, the SolarWinds mischaracterization, the dropped Bohnet miscite) are recorded in `references.md`. **This document has not yet been reviewed by a human domain expert** — see [`README.md`](README.md).
