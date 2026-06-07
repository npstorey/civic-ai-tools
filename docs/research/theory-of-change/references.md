# Reference library — theory of change

> ⚠️ **AI-assisted, not fully human-vetted.** These 38 sources were surfaced by the
> [Evens Foundation Theory-of-Change tool](https://theory.evensfoundation.eu/) and then
> verified by an AI agent via web search (existence, attribution, claim-fit, replication
> status). The verdicts below caught real errors, but **AI verifying AI is a filter, not
> a guarantee** — read the primary source before citing externally. See
> [`README.md`](README.md).

## How to use this

Each entry carries a **status tag** and a **caveat**. Carry the caveat with the citation.

| Tag | Meaning |
|-----|---------|
| ✅ **Verified** | Exists, correctly attributed, supports the claim. Cite with the noted framing caveat. |
| ⚠️ **Corrected** | Real, but the tool's attribution (author/venue/year/number) was wrong — use the corrected form here. |
| 🔶 **Contested** | Exists, but the finding is disputed, failed to replicate, or the cited source cuts *against* the naive claim. Must be hedged or flipped. |
| ❌ **Dropped** | Does not support the claim / unverifiable. Do not use. |

Keys in **[brackets]** match the in-text citations in
[`evens-foundation-evaluation-summary.md`](evens-foundation-evaluation-summary.md).
Entries marked *“library only”* are verified and available but not yet cited in the summary.

---

## A. Grounding, RAG & text-to-SQL  *(Layers 1–2)*

**[RAG2020]** ✅ Lewis, Perez, Piktus, Petroni, Karpukhin, Goyal, Küttler, M. Lewis, Yih, Rocktäschel, Riedel, Kiela. *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.* NeurIPS 2020, 33:9459–9474. — arXiv:2005.11401
- *Supports:* retrieval grounding reduces fabricated content vs. parametric-only models.
- *Caveat:* the paper frames the gain as "more factual/specific," not a clean fabrication metric. RAG **reduces, does not eliminate** hallucination (see [Shuster2021]). Treat as directional.

**[Spider2018]** ⚠️ Yu, Zhang, Yang, et al. *Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task.* EMNLP 2018. — aclanthology.org/D18-1425
- *Supports:* the canonical clean-schema text-to-SQL benchmark.
- *Caveat:* the 2018 paper reports **exact-match** (~low-teens baselines), **not** the "~90% execution accuracy" figure — that is a **2023 LLM-leaderboard** result on small/clean schemas. *Spider 2.0* (2024) drops top models to ~31%. Attribute the 90% to a current leaderboard, never to this paper.

**[BIRD2023]** ✅ Li, Hui, Qu, et al. *Can LLM Already Serve as a Database Interface? A BIg Bench for Large-Scale Database Grounded Text-to-SQLs (BIRD).* NeurIPS 2023 (Datasets & Benchmarks). — arXiv:2305.03111
- *Supports:* execution accuracy collapses on large/dirty/ambiguous real schemas — GPT-4 ~54.9% vs. 92.96% human.
- *Caveat:* scores are model-/time-dependent; cite the benchmark, not a frozen number.

**[NaLIR2014]** ⚠️ Li & Jagadish. *Constructing an Interactive Natural Language Interface for Relational Databases* (system: NaLIR). PVLDB 8(1):73–84, 2014. — DOI 10.14778/2735461.2735468
- *Supports:* novices complete ad-hoc queries they otherwise could not.
- *Caveat:* "NaLIR" is the system name, not the title. The result depends on **interactive disambiguation** (users correct the parse); small, pre-LLM study.

**[JiHalluc2023]** ✅ Ji, Lee, Frieske, et al. *Survey of Hallucination in Natural Language Generation.* ACM Computing Surveys 55(12), Art. 248, 2023. — DOI 10.1145/3571730
- *Supports:* NLG systems produce fluent but unfaithful/nonfactual text.
- *Caveat:* a survey (secondary source); the "users trust it uncritically" sub-claim is only lightly covered.

**[Shuster2021]** ✅ Shuster, Poff, Chen, Kiela, Weston. *Retrieval Augmentation Reduces Hallucination in Conversation.* Findings of EMNLP 2021, 3784–3803. — arXiv:2104.07567
- *Supports:* retrieval reduces but does **not** eliminate hallucination (residual via retrieval/synthesis errors).
- *Caveat:* domain is open-domain **dialogue**; generalization to civic QA is by extension.

**[LiuVerifiability2023]** ✅ Liu (Nelson F.), Zhang, Liang. *Evaluating Verifiability in Generative Search Engines.* Findings of EMNLP 2023. — arXiv:2304.09848
- *Supports:* generative-search citations frequently fail to support their statements (only ~51.5% of sentences fully supported; ~74.5% of citations support their sentence).
- *Caveat:* evaluates 2023-era systems; numbers are time-bound.

**[Bohnet2022]** ❌ **DROPPED.** Bohnet, Tran, Verga, et al. *Attributed Question Answering: Evaluation and Modeling for Attributed LLMs.* arXiv:2212.08037 (claimed "TACL 2023" — unconfirmed).
- *Was cited for:* "attribution aids user trust."
- *Why dropped:* it is an attribution **evaluation/modeling** paper with no user-trust study — claim mismatch — and the venue could not be confirmed. Do not use; for an attribution→trust claim, use a genuine HCI study.

---

## B. Cryptographic verification, provenance & standards  *(Layers 3–4)*

**[RFC6962]** ✅ Laurie, Langley, Kasper. *Certificate Transparency.* RFC 6962, IETF, June 2013. — rfc-editor.org/rfc/rfc6962.html
- *Supports:* append-only public logs enable trustless third-party verification at internet scale.
- *Caveat:* RFC 6962 is **Experimental** (RFC 9162 is the standards-track successor). CT detects misissuance *after the fact*. "Mandatory in Chrome" (2018) is **browser policy**, not the RFC. The "enforced by infrastructure, not optional" point is the key one for §2.3 of the summary.

**[SigstoreSLSA]** ✅ Sigstore (cosign/Fulcio/Rekor) + SLSA. OpenSSF / Linux Foundation, 2021–. — slsa.dev
- *Supports:* provenance attestations let downstream parties verify build origin and detect tampering without a long-lived publisher key.
- *Caveat:* trust is **shifted, not eliminated** — you still trust the OIDC IdP, Fulcio CA, build platform, and Rekor operators. SLSA = framework; Sigstore = tooling.

**[RFC3161]** ✅ *Time-Stamp Protocol.* IETF RFC 3161, 2001 (+ OpenTimestamps). — rfc-editor.org/rfc/rfc3161
- *Supports:* trusted timestamping proves a hash existed at/before a stated time (recognized evidential weight under eIDAS).
- *Caveat:* RFC 3161 relies on a **trusted TSA** (centralized; back-dating/key-compromise risk). OpenTimestamps is **Bitcoin-anchored / trust-minimized** — a different, coarser trust model. Don't bundle them as one "standard."

**[TLSACME]** ✅ *TLS 1.3* (RFC 8446, 2018) + *ACME* (RFC 8555, 2019). — rfc-editor.org/rfc/rfc8446
- *Supports:* open RFCs yield independent interoperable implementations (OpenSSL/BoringSSL/rustls; Certbot/acme.sh/lego).
- *Caveat:* "no coordination" overstates — interop is helped by IETF interop testing and shared test vectors; BoringSSL is an OpenSSL fork; TLS 1.3 has **no** official IETF conformance suite (interop is empirical).

**[MessyTLS2015]** 🔶 Beurdouche et al. *A Messy State of the Union: Taming the Composite State Machines of TLS.* IEEE S&P 2015, 535–552. — ieee-security.org/TC/SP2015
- *Intended support:* reference-implementation capture → second implementations inherit bugs.
- *Caveat:* the paper shows RFC ambiguity + incorrect composition produced hidden bugs (e.g., FREAK) across 6/8 libraries. It does **not** literally argue "OpenSSL is the de facto spec whose bugs others inherit" — that is our extrapolation. Cite for under-specification/state-machine bugs; soften the de-facto-spec framing.

**[DigiNotar2011]** ✅ *DigiNotar CA compromise*, 2011. — en.wikipedia.org/wiki/DigiNotar
- *Supports:* a trusted key/CA can be compromised or misissued, undermining a no-trust premise at the key layer.
- *Caveat:* clean misissuance example (~500+ fraudulent certs, MITM on Iranian users). **SolarWinds (2020) is NOT a valid stolen-key example** — the signing key was *not* stolen; the build pipeline was subverted before legitimate signing. For true key-theft, use Stuxnet's stolen Realtek/JMicron certs.

**[PROV2013]** ✅ *W3C PROV-DM / PROV-O.* W3C Recommendations, 30 April 2013. — w3.org/TR/prov-overview/
- *Supports:* a standard for traceable lineage that aids quality/reliability assessment.
- *Caveat:* PROV **records** lineage; it does not itself authenticate or cryptographically protect the records. "Improves trust" only holds if the provenance assertions are themselves verifiable.

**[C2PA]** ✅ *C2PA / Content Authenticity Initiative.* CAI (Adobe) 2019; C2PA body founded Feb 2021 (Adobe, Arm, BBC, Intel, Microsoft). — c2pa.org
- *Supports:* (a) open standard binding origin metadata to media; (b) **provenance ≠ truth** — validly-signed misinformation is possible; (c) adoption is partial/uneven and metadata can be stripped.
- *Caveat:* "2019" = CAI launch; the C2PA standard is 2021 — keep distinct.

---

## C. Trust signals, usable security & HCI  *(Layer 5)*

**[Johnny1999]** ✅ Whitten & Tygar. *Why Johnny Can't Encrypt: A Usability Evaluation of PGP 5.0.* 8th USENIX Security Symposium, 1999. — usenix.org
- *Supports:* users can't correctly operate crypto UIs → capability rarely converts to verification behavior.
- *Caveat:* lab study (n=12) of the PGP encrypt/sign workflow, not verification-of-others specifically. Landmark; founded a "Why Johnny still can't…" replication lineage.

**[EmperorIndicators2007]** ✅ Schechter, Dhamija, Ozment, Fischer. *The Emperor's New Security Indicators.* IEEE S&P 2007. — usenix.org/legacy/events/sp07
- *Supports:* users ignore removed HTTPS/lock/site-auth cues and proceed past warnings.
- *Caveat:* n=67, single bank, dated UI; role-play vs. own-credential design affected results.

**[FeltIndicators2016]** 🔶 Felt, Reeder, et al. *Rethinking Connection Security Indicators.* USENIX SOUPS 2016. — usenix.org/conference/soups2016
- *Intended support:* some users notice well-designed security chrome.
- *Caveat:* the paper's **dominant** finding is **low comprehension** (only ~half of 1,329 could identify a secure connection); it's a redesign paper. Using it as a positive "chrome works" counter-point rests on a minor secondary thread — better cited as evidence that **comprehension is hard**.

**[Habituation2018]** ⚠️ Vance, Jenkins, Anderson, et al. *Tuning Out Security Warnings: A Longitudinal Examination of Habituation Through fMRI, Eye Tracking, and Field Experiments.* MIS Quarterly 42(2), 2018. — DOI 10.25300/MISQ/2018/14124
- *Supports:* repeated exposure → habituation and click-through.
- *Caveat:* the tool's "Anderson et al., MISQ 2016" **conflated** this 2018 MISQ paper with a separate 2016 JMIS paper ("From Warning to Wallpaper"). Small fMRI samples; "polymorphic" warnings resist habituation (the constructive half).

**[Bansal2021]** ✅ Bansal, Wu, Zhou, Fok, Nushi, Kamar, Ribeiro, Weld. *Does the Whole Exceed its Parts? The Effect of AI Explanations on Complementary Team Performance.* CHI 2021. — arXiv:2006.14779
- *Supports:* explanations increased acceptance of AI recommendations **regardless of correctness** — i.e., did not improve appropriate reliance/calibration.
- *Caveat:* task = humans + comparable-accuracy AI; "non-experts" is a loose gloss. Generalized by Fok & Weld (2024).

**[VerifiedBadge2019]** 🔶 Vaidya, Votipka, Mazurek, Sherr. *Does Being Verified Make You More Credible? Account Verification's Effect on Tweet Credibility.* **CHI 2019** (not SOUPS). — dl.acm.org/doi/10.1145/3290605.3300755
- *Supports:* **CONTRADICTS** the naive "verified badges shift trust" claim — cite as evidence *against* it.
- *Caveat:* two studies (n=748; n=2,041) found the badge had **no significant effect** on perceived credibility or sharing; users separated authenticity from credibility. The tool both misattributed the venue and inverted the finding.

**[TwitterBlue2023]** ✅ *Twitter Blue / X paid-verification controversy*, 2022–2023. — en.wikipedia.org/wiki/Twitter_Blue_verification_controversy
- *Supports:* when the checkmark became paid, its meaning inverted and was widely misread (impersonation incidents — fake Eli Lilly, etc.).
- *Caveat:* journalism/case-study evidence, **not** peer-reviewed measurement. Good for "meaning inverted," weak as a quantified trust effect.

**[EVremoval2019]** ✅ *EV-certificate indicator removal* (Chrome 77 / Firefox 70, 2019). — chromium.googlesource.com (ev-to-page-info)
- *Supports:* vendors removed the EV/green-bar UI citing low efficacy (users rarely notice; doesn't change secure choices).
- *Caveat:* supported for **EV specifically**; don't over-generalize to all indicators (the lock/HTTPS-warning literature is more mixed).

---

## D. Misinformation, disclosure & trust calibration  *(Layers 5–6)*

**[AccuracyNudge2021]** ✅ Pennycook, Epstein, Mosleh, Arechar, Eckles & Rand. *Shifting attention to accuracy can reduce misinformation online.* Nature 592:590–595 (2021). — nature.com/articles/s41586-021-03344-2
- *Supports:* accuracy prompts increase sharing discernment.
- *Caveat:* the effect is real but **small** and its real-world magnitude is **actively debated** (van der Linden/Roozenbeek re-analysis; 2025 replication attenuated). Present as a "small but reliable nudge," not a strong lever. Cite the full author list, not just "Pennycook & Rand."

**[ImpliedTruth2020]** ✅ Pennycook, Bear, Collins & Rand. *The Implied Truth Effect.* Management Science 66(11):4944–4957 (2020). — DOI 10.1287/mnsc.2019.3478
- *Supports:* labeling only **some** false items raises perceived accuracy of unlabeled false items (provenance-cue backfire).
- *Caveat:* robust mechanism, no major replication flag; lab-vs-real magnitude is the usual caveat.

**[Clayton2020]** ✅ Clayton et al. *Real Solutions for Fake News? Measuring the Effectiveness of General Warnings and Fact-Check Tags…* Political Behavior 42:1073–1095 (2020). — DOI 10.1007/s11109-019-09533-0
- *Supports:* warning/fact-check tags modestly reduce belief in false headlines.
- *Caveat:* effects explicitly **modest**; general warnings also slightly lowered belief in **true** headlines (collateral skepticism).

**[vanderBles2020]** ✅ van der Bles, van der Linden, Freeman & Spiegelhalter. *The effects of communicating uncertainty on public trust in facts and numbers.* PNAS 117(14):7672–7683 (2020). — pnas.org/doi/10.1073/pnas.1913678117
- *Supports:* numeric uncertainty lowered confidence in the number but did **not** significantly erode trust in the source.
- *Caveat:* the tool's "PNAS 2020" was **correct**. A companion review (RSOS 2019) is a separate framework piece — use the PNAS paper for the empirical trust result.

**[Loewenstein2012]** ⚠️ Loewenstein, Sah & Cain. *The Unintended Consequences of Conflict of Interest Disclosure.* JAMA 307(7):669–670 (**2012**, not 2011). — jamanetwork.com
- *Supports:* disclosure often fails to debias and can license biased advice / pressure advisees ("insinuation anxiety").
- *Caveat:* a Viewpoint synthesizing experiments; cite the underlying experimental papers (Cain/Loewenstein/Moore; Sah et al.) if primary data is needed.

**[Dietvorst2015]** ✅ Dietvorst, Simmons & Massey. *Algorithm Aversion: People Erroneously Avoid Algorithms After Seeing Them Err.* JEP: General 144(1):114–126 (2015). — psycnet.apa.org/record/2014-48748-001
- *Supports:* confidence in algorithms drops faster than in humans after identical errors.
- *Caveat:* **hedge as context-dependent** — there is a strong "algorithm **appreciation**" counter-literature (Logg, Minson & Moore, OBHDP 2019) and meta-analytic context-dependence (Jussupow et al. 2020). A flat "people distrust algorithms" is one-sided.

**[LeeSee2004]** ✅ Lee & See. *Trust in Automation: Designing for Appropriate Reliance.* Human Factors 46(1):50–80 (2004). — DOI 10.1518/hfes.46.1.50_30392
- *Supports:* reliance is driven by perceived reliability, predisposition, and context, not raw accuracy alone.
- *Caveat:* canonical review framework; uncontested as a model.

**[Backfire2010overturned]** 🔶 Nyhan & Reifler. *When Corrections Fail.* Political Behavior 32:303–330 (2010) — **OVERTURNED BY** — Wood & Porter. *The Elusive Backfire Effect: Mass Attitudes' Steadfast Factual Adherence.* Political Behavior 41:135–163 (2019). — DOI 10.1007/s11109-018-9443-y
- *Status:* the strong **backfire effect did NOT replicate.**
- *Caveat:* Wood & Porter (5 experiments, >10,100 subjects, 52 issues) found essentially no backfire; corrections generally moved beliefs in the **correct** direction. Nyhan himself walked it back (PNAS 2020). **Use ONLY for "misperceptions can be durable"; NEVER for "corrections/proof backfire."** This is the single highest-risk citation in the corpus.

---

## E. Open data, governance & civic cases  *(Layers 1, 6)*

**[COMPAS2016]** ✅/🔶 Angwin, Larson, Mattu & Kirchner. *Machine Bias.* ProPublica, 23 May 2016 (COMPAS / Northpointe). — propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing
- *Supports:* the controversy was about disparate error rates, fairness definitions, and interpretation — **not tampering**; integrity verification wouldn't have resolved it.
- *Caveat:* do **not** imply ProPublica was "right." Northpointe (Flores/Bechtel/Lowenkamp) rebutted, and Kleinberg et al. / Chouldechova proved the relevant fairness criteria are **mathematically incompatible** under unequal base rates. Cite only for "the dispute was about bias/interpretation, not tampering."

**[SyRI2020]** ✅ District Court of The Hague, *NJCM c.s. v. The Netherlands* (SyRI), 5 Feb 2020. — ohchr.org (press release)
- *Supports:* the court struck the SyRI legislation under Art. 8 ECHR over opacity/insufficient safeguards — a legitimacy/proportionality dispute, not tampering.
- *Caveat:* it struck the *legislation* as disproportionate; it did not rule SyRI technically malfunctioning. Keep distinct from the separate Dutch childcare-benefits (toeslagenaffaire) scandal.

**[YuRobinson2012]** ✅ Yu & Robinson. *The New Ambiguity of "Open Government."* 59 UCLA L. Rev. Disc. 178 (2012). — SSRN 2078056
- *Supports:* open-data technology can be decoupled from accountable government; openness of data ≠ accountability.
- *Caveat:* the argument is conceptual; the "depends on capacity/incentives/politics" gloss is made more squarely by Fox/Joshi/Peixoto. (SSRN 2264369 is Peixoto's *response*, not the original.)

**[Fox2007]** ✅ Fox. *The Uncertain Relationship between Transparency and Accountability.* Development in Practice 17(4–5):663–671 (2007). — escholarship.org/uc/item/8c25c3z4
- *Supports:* transparency yields accountability only conditionally — "soft" (answerability) vs. "hard" (answers + sanctions) accountability.

**[Joshi2013]** ✅ Joshi. *Do They Work? Assessing the Impact of Transparency and Accountability Initiatives in Service Delivery.* Development Policy Review 31(S1):S29–S48 (2013).
- *Supports:* mixed impact, stronger where institutions are responsive.
- *Caveat:* cite the **sole-authored Joshi** article, not the Gaventa & McGee (2013) overview in the same special issue.

**[Ostrom1990]** ✅ *library only.* Ostrom. *Governing the Commons: The Evolution of Institutions for Collective Action.* Cambridge University Press, 1990. — cambridge.org/core/books/governing-the-commons
- *Supports:* common-pool resources can be self-governed under design principles (clear boundaries, monitoring, graduated sanctions, etc.) — relevant to open-standard governance (Layer 4).
- *Caveat:* design principles are probabilistic regularities from case studies, not guarantees; refined by Cox, Arnold & Tomás (2010).

**[Scantegrity2009]** ⚠️ *library only.* Scantegrity II, Takoma Park MD municipal election, Nov 2009 (Chaum et al.); Helios (Adida), USENIX Security 2008. — usenix.org (Scantegrity II Takoma Park)
- *Supports:* end-to-end verifiable voting is technically feasible for real civic outputs.
- *Caveat:* feasibility is well-supported; the "limited adoption / modest trust gains" half is an **inference** from the broader E2E-voting literature, not a finding of these primary sources. Helios is explicitly not coercion-resistant for national elections.

**[ONeillTrust2002]** ✅ *library only.* O'Neill. *A Question of Trust: The BBC Reith Lectures 2002.* Cambridge University Press, 2002. — cambridge.org/core/books/question-of-trust
- *Supports:* poorly-designed transparency/accountability demands can **erode** rather than build trust.
- *Caveat:* O'Neill does not claim transparency *always* lowers trust; her cure is "intelligent accountability," not more raw disclosure.

**[OpenDataBarometer]** ⚠️ *library only.* Open Data Barometer (World Wide Web Foundation, eds. 1–4, 2013–2017) + OECD *Trust in Government* / *Government at a Glance*. — opendatabarometer.org/4thedition ; oecd.org/en/topics/trust-in-government.html
- *Supports:* open-data impact on accountability is limited/hard to measure; openness is one of several trust drivers.
- *Caveat:* **synthesis** — neither source states "open data correlates with modest effects on perceived trustworthiness" verbatim. Cite each for its own narrower point (ODB = openness/impact; OECD = five-driver framework).

---

## Verification provenance

All entries verified 2026-06-07 via AI web search across five thematic batches (Claude Code, Opus 4.8 sub-agents), checking existence, attribution, claim-fit, and replication/contestation status. The highest-stakes items flagged for **human** primary-source review: **[Backfire2010overturned]** (Wood & Porter 2019), **[VerifiedBadge2019]** (the null result), **[Spider2018]/[BIRD2023]** (the accuracy figures), and **[COMPAS2016]** (the fairness-impossibility results). Total: 38 works — 23 ✅ verified, 6 ⚠️ corrected, 8 🔶 contested, 1 ❌ dropped.
