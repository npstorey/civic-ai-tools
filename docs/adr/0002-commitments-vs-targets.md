# ADR-0002: Trust commitments vs. operational targets

- **Status:** Accepted
- **Date:** 2026-04-24
- **Decision-maker:** Solo maintainer
- **Supersedes:** ADR-0001, consequence-section clause "Publicly committed breaking-change discipline. The ≥90-day notice on the evidence-package format and documented publish API is now a commitment, not an informal practice."
- **Superseded by:** —

## Context

ADR-0001 (2026-04-23) adopted Section 3's nine trust and reliability commitments with explicit numeric timelines for three of them: 90-day breaking-change notice, 5-business-day security acknowledgment, 30-day critical-vulnerability fix. Those numbers were carried into the roadmap as firm commitments.

One day of maintainer reflection surfaced a gap: solo-maintained projects with routine multi-week maintainer absences (vacations, teaching, extended off-grid periods) cannot honor a 5-business-day acknowledgment or 30-day fix SLO as firm commitments without on-call discipline the project does not have and cannot sustain. Unhedged numbers create silent-breach risk — a Principle 1 failure applied to the project's own commitments.

No external integrators currently depend on the specific numbers; the roadmap was published 2026-04-23 and has not yet been externally scrutinized. Correction is low-cost now and compounds if deferred.

## Decision

Introduce a commitment-vs-target distinction within ROADMAP.md Section 3.

**Absolute commitments (hold unconditionally regardless of capacity):**

1. Evidence-package verifiability, long-term (five-year operational window; indefinite cryptographic verifiability of older formatVersions)
2. Coordinated release cadence (as publicly disclosed framing)
6. Security-path test coverage
7. No stealth deprecation
8. No dark patterns around identity
9. Directory hygiene

**Operational targets (aspirational, with public-disclosure accountability when missed):**

3. Advance notice on breaking changes — targets 90 days
4. Security triage — targets 5 business days for acknowledgment, 30 days for fix-or-advisory
5. API stability for documented endpoints — inherits target framing from Commitment 3

Specific body changes captured in the accompanying roadmap-change issue (civic-ai-tools#52).

## Considered and rejected alternatives

- **Drop the numeric targets entirely.** Rejected: the numbers are useful planning data for future integrators even as targets. "Reasonable notice" is subject to dispute; removing the numbers loses specificity without commensurate credibility gain.
- **Keep firm commitments with an emergency escape-valve clause.** Rejected: the escape valve handles acute emergency cases but does not handle routine multi-week absence, which is the core solo-maintainer reality the hedge needs to address.
- **Firm commitments, no change.** Rejected: creates silent-breach risk incompatible with Principle 1 (disclosure, not validation) applied to the project's own commitments.

## Consequences

- Section 3 now carries two kinds of items. The distinction is set in the Section 3 preamble and surfaced in each item's language.
- External integrators planning against the 90-day / 5-day / 30-day numbers now see them labeled as targets; their planning horizon should account for shorter-notice periods being possible with published rationale.
- Targets may convert to commitments over time if operational capacity grows (for example, co-maintainer arrangement). Future ADRs will record any such conversion.
- Does not affect pillars (Section 2), out-of-scope (Section 7), fork framing (Section 6), or governance (Section 8).
- Does not affect Commitments 1, 2, 6, 7, 8, 9 (absolute commitments).

## References

- ADR-0001 — sets the nine-commitment structure this ADR refines.
- `ROADMAP.md` Section 3 — where the rewrite lands.
- `civic-ai-tools-website/docs/design-principles.md` — Principle 1 (disclosure, not validation) applied to the project's own commitments.
