# ADR-0017: IPR posture — DCO inbound + maintainer royalty-free patent statement, as a pre-RFC gate

- **Status:** Proposed — flips to Accepted when the maintainer merges the PR introducing this ADR, `IPR.md`, and `PATENTS.md`; that merge is also the act that executes the PATENTS.md covenant
- **Date:** 2026-07-01
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

The 2026-07-01 extraction evaluation ([civic-ai-tools#99](https://github.com/npstorey/civic-ai-tools/issues/99)) confirmed the project's #1 governance gap: across all four repositories there was **no IPR language of any kind** — no DCO, no CLA, no royalty-free commitment, no patent language. What existed: MIT on the code repos (no express patent grant), CC BY 4.0 on the specification (copyright only — expressly not a patent license), a `LICENSING.md` that inventories copyright licenses, a `CONTRIBUTING.md` with no legal terms, and no CONTRIBUTING file at all in the typedstandards repo.

The gap is not theoretical. A named external party's content profile is embedded in the frozen specification (§8.7, acknowledged in Appendix I), meaning an external implementer is already building against a standard that offers no patent safety. Every additional adopter compounds the reliance interest, and the adoption-strategy record names the paired failure mode explicitly: a small adopter set defining normative behavior before an IPR regime exists (governance capture).

Maintainer decisions recorded on [#99](https://github.com/npstorey/civic-ai-tools/issues/99) (2026-07-01): adopt the DCO + RF-statement instrument as proposed; confirm the posture as a hard pre-public-RFC gate with the reference SDK sequenced behind it; use the standard scope-of-rights formulation in the RF statement.

## Decision

1. **Inbound — DCO.** All contributions to all four repositories made after 2026-07-01 require a Developer Certificate of Origin 1.1 sign-off (`Signed-off-by` line; `git commit -s`). Policy text: [`IPR.md`](../../IPR.md). Enforcement is by review convention initially; an automated check may be added without revisiting this ADR.
2. **Inbound — spec patent terms.** Substantive contributions of normative specification text are accepted only with the contributor extending the same royalty-free covenant over their Essential Claims essential to the contribution ([`PATENTS.md`](../../PATENTS.md) § Contributions). The DCO alone covers copyright provenance, not patents; this clause closes the inbound patent path.
3. **Outbound — royalty-free statement.** The maintainer executes [`PATENTS.md`](../../PATENTS.md): an irrevocable, worldwide, royalty-free non-assertion covenant over Essential Claims for Conformant Implementations of the Typed Standards Specification, on a **scope-of-rights** basis (covering claims the maintainer owns or controls), with a standard **defensive-suspension** clause. Modeled on the W3C Patent Policy §5 royalty-free goal and the OWFa 1.0 non-assert covenant.
4. **Sequencing.** This posture is a gate before any formal public RFC review window opens, and the reference SDK (`attest()`/`verify()` core + shells) does not ship before it is in force. (No RFC review is currently dated per the 2026-06-25 maturity-framing decision, so the gate binds when RFC planning resumes.)
5. **Surface updates.** `CONTRIBUTING.md` gains a sign-off/IPR section and lists all four repositories; `LICENSING.md` gains a Patents pointer section; specification §3 gains a one-line pointer to `PATENTS.md`. Equivalent CONTRIBUTING pointers land in the other three repositories as mechanical follow-ups after this PR merges.

## Alternatives considered

- **Relicense code to Apache-2.0** (express patent grant in the code license). Rejected: a relicensing event across all repos, heavier than needed, and it still would not cover the specification text — the artifact adopters actually implement.
- **Full CLA.** Rejected: heavier than a DCO, adds contributor friction, and its main benefits (relicensing latitude, corporate signatures) are not needs this project has today.
- **OWFa 1.0 as the executed instrument.** Considered seriously — it is purpose-built for specification patent commitments — and its non-assert structure is what `PATENTS.md` follows. A plain-language statement in-repo was preferred over the formal OWFa document for legibility to this project's audience; migrating to a formally executed OWFa (or a standards body's IPR regime) remains open as part of the institutional-home discussion.
- **Defer until an institutional home exists.** Rejected: cheapest today, but it leaves the existing adopter's reliance interest uncovered through any RFC window, which is the exact exposure the extraction evaluation flagged as the project's #1 gap.

## Consequences

- The RFC-launch checklist gains a hard item: IPR posture in force before the public review window opens.
- The reference SDK is unblocked (on this dimension) the moment this merges; it remains sequenced behind the merge, not before.
- The zero-to-one spoke-emission probe ([civic-ai-tools#102](https://github.com/npstorey/civic-ai-tools/issues/102)) stays deliberately small enough not to constitute the SDK and is not gated by this ADR.
- Contributions merged before adoption are unaffected; the sign-off requirement is forward-looking.
- Enforcement debt is accepted knowingly: DCO checking is by convention until an automated check is worth adding.
- The covenant's scope-of-rights formulation means the statement is exactly as strong as the maintainer's actual rights — honest by construction, and the standard practice for this instrument class.

## References

- [`IPR.md`](../../IPR.md) — the policy this ADR adopts.
- [`PATENTS.md`](../../PATENTS.md) — the royalty-free statement this ADR executes on merge.
- [civic-ai-tools#99](https://github.com/npstorey/civic-ai-tools/issues/99) — the gap analysis and the recorded maintainer decisions.
- Developer Certificate of Origin 1.1 — <https://developercertificate.org>.
- W3C Patent Policy — <https://www.w3.org/policies/patent-policy/>; Open Web Foundation Agreement 1.0.
- [`LICENSING.md`](../../LICENSING.md) — the copyright-license record this policy complements.
