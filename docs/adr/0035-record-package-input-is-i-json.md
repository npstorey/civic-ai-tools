# ADR-0035: A record package's JSON text is I-JSON — a repeated member name is refused before any hash is computed

- **Status:** **Accepted** (ruling D1 = A by the owner at gate G0 of anchor [civic-ai-tools#260](https://github.com/npstorey/civic-ai-tools/issues/260), 2026-10-15: [typedstandards#145](https://github.com/npstorey/typedstandards/issues/145) is carried in the same sprint, with the §8.2 sentence and §9.2 check #1's clause in specification v0.1.12 and the verifier's change under a drop rule that lets it leave the release; recorded in the [G0 record](https://github.com/npstorey/civic-ai-tools/issues/260#issuecomment-6202752527))
- **Date:** 2026-10-16
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0008](0008-multihash-content-hash.md) (it committed envelope canonicalization to RFC 8785 JCS; this record states the input that rule requires)

## Context

The envelope hash is RFC 8785 JCS over the parsed package object (specification §8.2). RFC 8785 takes I-JSON input ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493)), and I-JSON allows no duplicate member names within an object. The specification stated no rule for a repeated member name.

Measured at typedstandards `ec997fc` ([typedstandards#145](https://github.com/npstorey/typedstandards/issues/145)), every package boundary parses the package text with the platform's JSON parser, which keeps the last occurrence of a repeated name and drops the earlier ones silently:

- the command-line tool, `packages/cli/src/input.ts:300` (`JSON.parse`);
- the host library, `packages/host-core/src/json.ts:39` (`JSON.parse`);
- the public verifier, for a pasted or uploaded package, `apps/web/src/lib/verify-flow.ts:667` (`JSON.parse`);
- the public verifier, for a commitment and a package fetched by address, `apps/web/src/lib/verify-flow.ts:271` (`Response.json()`, which parses the same way).

So two package files that differ only in a repeated key have the same envelope hash and the same content hash, and both verify as the same record. A reader that resolves the repetition differently, by keeping the first occurrence or by refusing, sees different content in one verified file.

## Decision

### A. A record package's JSON text is I-JSON

A record package's JSON text is I-JSON (RFC 7493), the input RFC 8785 requires (specification §8.2).

### B. A verifier rejects a repeated member name

A verifier MUST reject a package whose JSON text repeats a member name within an object, before it computes any hash. This revision gives the verifier no other I-JSON obligation.

### C. The refusal is not `altered`

The reference verifier's check #1 reports `verified`, `altered` or `unavailable`. A refused package is not reported as `altered`: what fails is the input rule, not the signed content (specification §9.2 check #1).

### D. Where it is implemented

The reference verifier's strict parse at each package boundary is tracked at [typedstandards#145](https://github.com/npstorey/typedstandards/issues/145). This record names no release, because that change can leave the release that ships the layout sub-type ([ADR-0034](0034-content-layout-node.md)) under the sprint's drop rule.

### E. What it does not change

No field, no hash rule and no already-signed byte changes. A producer that builds a package by serializing an object cannot emit a repeated key. Whether any published record carries one is to be checked before the release that ships the refusal (#145 item 4); this record states that check as planned, not as a measured result.

The rule meets the Xanadu doctrine as a hardening of the input to packages that already exist, with its need measured on them (#145); it adds no sub-type, field or vocabulary.

## Considered and rejected

- **A keep-first or keep-last rule.** Readers differ in which occurrence they keep, and a rule that picks one leaves every reader that picks the other in disagreement. Refusal is the one rule every reader can apply alike.
- **A separate, later revision for this rule** (D1 option B). It would cost a second specification revision and a second verifier minor release, with no coupling to justify the split.

## Consequences

- Specification v0.1.12 states the rule in §8.2 and §9.2 check #1, and lists RFC 7493 in §14.1.
- Until the reference verifier ships its strict parse, it still accepts a package that repeats a member name; the specification's rule is ahead of that implementation, and #145 stays open for it.

## References

- [typedstandards#145](https://github.com/npstorey/typedstandards/issues/145): the finding and the proposed shape.
- [RFC 7493](https://www.rfc-editor.org/rfc/rfc7493): The I-JSON Message Format. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): JSON Canonicalization Scheme (JCS).
- Specification §8.2 (canonical JSON and the envelope hash), §9.2 check #1 (envelope integrity), §14.1 (normative references).
