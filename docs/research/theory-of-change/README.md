# Theory of Change — research folder

> ## ⚠️ AI-assisted research — not yet vetted by a human
>
> Everything in this folder was produced with an AI agent (Claude Code, Opus 4.8). It
> combines an external theory-of-change stress-test with automated citation verification.
> **Citations have been machine-checked; the synthesis, judgments, grades, and framing
> have NOT been reviewed by a human domain expert.** Treat these documents as a
> structured *draft input* toward a future, human-vetted theory of change — not as a
> settled position, and not for external distribution without independent review.
>
> Known limitations:
> - The citation verification was itself performed by AI web search. It caught real
>   errors (see `references.md`), but a machine verifying machine output is not a
>   substitute for a human reading the primary sources.
> - Grades ("Strong / Moderate / Weak") originate from a third-party tool and the agent's
>   interpretation of it; they are directional, not authoritative.
> - Coverage is the six causal links that were tested. Other parts of the project's
>   theory of change are not yet evaluated here.

---

## What this folder is

A working space for stress-testing and documenting the **theory of change** behind
Civic AI Tools / Typed Standards, plus a growing **reference library** of the academic
and technical sources that bear on it.

The motivating question: *can we state, and defend with citations, what change this
project actually creates in the world — and, just as important, what it does not?*

## Contents

| File | What it is |
|------|------------|
| [`evens-foundation-evaluation-summary.md`](evens-foundation-evaluation-summary.md) | The main artifact. A layered, scoped, cited theory of change derived from an [Evens Foundation Theory-of-Change tool](https://theory.evensfoundation.eu/) stress-test of six core causal links. Distinguishes defensible *capability* claims from unsupported *behavior-change* claims. |
| [`references.md`](references.md) | The reference library: 38 load-bearing sources, each tagged with a verification verdict (✅ verified / ⚠️ corrected / 🔶 contested / ❌ dropped) and the caveat to carry when citing it. |

## How it was produced (method)

1. **Stress-test.** Six core causal links of the project's theory of change were phrased
   as `X action → Y change` statements and run through the Evens Foundation tool, which
   returns a causal-chain analysis, hidden assumptions, evidence for/against, historical
   precedents, and a link-strength grade.
2. **Two passes — maximal then scoped.** Each link was run first with a *maximal*
   (societal-outcome) `Y`, then with a *scoped* (near-term capability) `Y`. The delta
   between the two grades isolates genuine mechanism risk from over-claiming. The central
   finding: claims about *capabilities the project ships* grade Strong/Moderate; claims
   about *human or institutional behavior change* grade Weak. The summary enforces that
   boundary throughout.
3. **Citation verification.** Every load-bearing citation the tool produced (38 works)
   was independently web-verified for existence, correct attribution, claim-fit, and —
   critically — replication/contestation status. This step caught several errors that
   would have undermined the document (a non-replicating "backfire effect," a null
   verified-badge result cited as if positive, a misattributed benchmark number, a
   mischaracterized supply-chain incident, and one citation that did not support its
   claim at all). Results and caveats live in `references.md`.

## How to use it

- **Citing a source:** check its verdict in `references.md` first. Anything tagged ⚠️ or
  🔶 carries a caveat that must travel with the citation. Anything ❌ must not be used.
- **Reusing a claim externally:** read the primary source yourself. The AI verification
  is a filter, not a guarantee.
- **Extending the library:** add new sources to `references.md` using the same entry
  format and verdict tags. Note whether a human or an agent verified each addition.

## Status & next steps

- [ ] Human review of the summary's synthesis and grades
- [ ] Human spot-check of the highest-stakes primary sources (Wood & Porter 2019; the
      BIRD/Spider-2.0 accuracy figures; the COMPAS fairness-impossibility results)
- [ ] Derive a tightened external/funder cut from the vetted summary
- [ ] Measure the Layer-1 empirical gap (text-to-SQL accuracy on in-scope Socrata schemas)
