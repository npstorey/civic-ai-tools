<!-- v1 (2026-06-07) — "Why this work exists": problem statement + theory of change for
     Civic AI Tools & Typed Standards, written impersonally for an outside audience.
     Companion to evens-foundation-evaluation-summary.md (the underlying stress-test) and
     references.md (citation library). Draft — voice not finalized. See README.md for the
     standing AI-assisted-research caveat. -->

# Why this work exists
*Civic AI Tools & Typed Standards. Draft, 2026-06-07.*

**The problems.** Three pressures are converging on public information.

The first is trust. As synthetic and AI-generated content spreads, the basic question about a claim is shifting from whether it is well-argued to whether it can be confirmed as real at all: that it came from the data it cites, at the time it claims, without alteration. Trust in AI tools specifically is low, and often for good reason, because most of them obscure what they actually did to produce an answer.

The second is the gap between information and action. More data, by itself, rarely changes decisions. But there are settings where acting on a claim that later proves fabricated or altered carries real cost, and where the people involved need claims they can verify rather than take on faith: auditors, decision-makers inside large organizations, regulators, courts. For these users, the ability to check a claim is a requirement, not a convenience.

The third is reproducibility. Across science, journalism, and policy, results that cannot be reproduced weaken everything built on them. AI-assisted analysis sharpens the problem, because its outputs are often impossible to retrace to their inputs, their method, or even the model that produced them.

Underneath all three, some institutions, such as science and public agencies, still hold meaningful trust even where it is under attack. Tools that let those institutions make identifiable, independently checkable claims, and that calmly explain what an AI system did rather than hiding it, may help defend that trust. That is a hypothesis worth testing, not a promise.

**What is being built.** Two pieces of infrastructure, each with concrete uses.

*Civic AI Tools* is a natural-language interface to real civic datasets that reports only what live queries return, with every figure traceable to the query behind it. A reporter can ask how 311 noise complaints in a district changed over five years and get a number drawn from the actual dataset, with the query shown, rather than a confident fabrication. A public servant can cross-check permit or inspection data without waiting on a data team. A student can pull census context alongside a city dataset. The defensible claim is narrow: this lowers the cost of producing a grounded, re-runnable first-pass analysis. Whether it changes any decision is an open question; what it does is make the input to that question cheap and checkable.

*Typed Standards* is an open standard and tooling to publish an analysis as a cryptographically signed, timestamped, provenance-graphed evidence package that anyone can verify independently, together with a neutral verifier and a shared library so that independent implementations agree. An editor or reader can confirm a published analysis came from the stated data, at the stated time, unaltered, without trusting the author or a screenshot. An auditor or a court can treat the provenance as something to check rather than accept. A second analyst can re-verify the first's package with different software and no coordination, which already works today. The defensible claim is again narrow: integrity and authorship become independently checkable. That is a concrete component of reproducibility for AI-assisted work, and a precondition for any honest claim about trust.

**What is demonstrated, and what is hypothesized.** The two are kept separate on purpose.

Demonstrated or buildable: grounded access; integrity a third party can verify; interoperability across implementations; a verification state a non-expert can read.

Hypothesized, not proven: that verifiable analyses actually get verified; that verification shifts trust; that better-calibrated trust changes behavior or accountability; that provenance-carrying analyses measurably improve reproducibility.

The second list is treated as hypotheses to test, not claims to assert, and the point of the first list is that the second cannot be tested until the infrastructure exists. You cannot study whether verifiable civic analysis changes institutional behavior until verifiable civic analysis is real, cheap, and deployed. Building the instrument is what turns these questions from debates into experiments, with explicit failure conditions. The shape of trust-building itself, the processes and interfaces and practices that actually move a reader or an institution, is not yet known. This work does not claim to know it. It aims to be the infrastructure that lets those experiments be run.

**The underlying bet.** The central hypothesis is that trustworthy, low-cost, independently-checkable civic analysis is a prerequisite layer for the larger problems: that little real progress on trust, on acting safely with information, or on reproducibility is possible without it. For that hypothesis to be tested at any meaningful scale, the infrastructure has to be neutral and open rather than a proprietary platform that people are simply asked to trust. Adoption and independence are not separable here; a closed version cannot answer the question it claims to.

If the value holds up, the natural next step is that some uses begin to require verification of this kind rather than offer it. An organization could make verifiable provenance a precondition for its own data-driven decisions; an auditor, a newsroom, or a court could treat it as a baseline for what counts as evidence. Whether anyone takes that step is the real test of the whole idea, and it is left as something to be earned by demonstrated value, not assumed.
