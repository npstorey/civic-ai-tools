# ADR-0031: Civic-router packaging — `@typedstandards/civic-typed-router`, a domain-free core beside its civic content

- **Status:** **Accepted** (2026-10-09 — ruled by the owner at gate G0 of the router sprint, anchor issue [civic-ai-tools#244](https://github.com/npstorey/civic-ai-tools/issues/244), rulings G0-1, G0-3 and G0-6)
- **Date:** 2026-10-09 (decision); written by the sprint's P1 implementation session and landing in its PR, per G0-6
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0022](0022-civic-typed-harness-packaging.md) (the hub's npm workspace and its first package; this records the second, on the same pattern)

## Context

The reference website wires its MCP sources in six files: the source registry and its environment reading, the static tool schemas, the skill registry with its prompt composer, the tool-to-source map, and two embedded guidance texts. Every source added means editing all of them, and nothing outside the website can reuse them. The MCP-sources design (planning-side, §10–§12) moves them into a package as one manifest of sources, as a pure move first: with the three current sources the tools array and the composed system prompt are byte-identical before and after. The design's ruling D11 makes the router its own package; the owner named it `@typedstandards/civic-typed-router` and reserved `@typedstandards/typed-router` for its later domain-free extraction.

## Decision

### A. One package, `packages/civic-typed-router`, the hub's second workspace

It joins `packages/civic-typed-harness` under the root `workspaces: ["packages/*"]`. The root build, test, typecheck and lint scripts fan out to it unchanged, and `scripts/dependency-budgets.json` budgets it. Its acceptance bar is a golden fixture captured from the website's own exported functions at a stated commit, committed beside the capture script that produced it.

### B. Two directories, and a test for the line between them

- **`src/core/`** is domain-free: the manifest entry type, selection by configuration (required and optional sources), the composer's join, the offered-tools filter and the tool-to-source index. Validations such as a duplicate-tool-name refusal are defined there and not invoked by 0.1.0. Core holds no source text: the intro, the preamble, the outro and every other sentence reach it as values.
- **`src/civic/`** holds the three sources' entries (schemas, guidance texts, the fallback guidance, the per-portal table), the one-portal rewrites, the intro, preamble and outro, and the configuration reader.

`civic/` may import `core/`. `core/` imports nothing from `civic/` and nothing from any package, type-only imports included; `src/boundary.test.ts` fails on any such import. The entry `src/index.ts` exports both. As with ADR-0022 §C, the boundary is the hedge: the later extraction of the core is a directory move, not a re-partition.

The router reads no clock, holds no cache and reads no environment. The date, the publication host, the configuration and the two network reads are the consumer's inputs, and any cache stays with the consumer's fetcher. This is the harness's purity discipline (ADR-0022 §D) without its capture-group exception, which the router does not need.

### C. No runtime dependency

The package declares none. Its tool-schema type is structural, a JSON-schema shape, rather than an import from the `openai` package the website uses, so a consumer's own tool type of that shape is accepted without an import in either direction. Its budget is empty.

### D. Published at the sprint's close, as 0.1.0

The version is `0.1.0`, under an `Unreleased` changelog heading until the release change dates it. It is published, not `private`: the website's adoption and the sprint's other consumers import it, and a 0.x version promises change rather than stability. This departs from ADR-0022 §B, which kept the harness private until a consumer was ready; here the consumers are named.

### E. The reserved core name

`@typedstandards/typed-router` is reserved for `src/core/` when it is extracted. Nothing is published under it now.

## Considered and rejected

- **Two packages now, a core and a civic package.** The ruled name is one package, and no adopter needs the core without the civic sources yet. The directory boundary and its test keep the split mechanical at near-zero cost.
- **The composer's preamble and outro logic in core.** The anchor's first fix shape put them there. They are civic sentences (the preamble names Data Commons), so core receives them as values and keeps only the join.
- **`private: true` until the website consumes it** (ADR-0022's posture). Saves one publish; costs every other consumer a file dependency.

## Consequences

- The website is unchanged by this decision. Its adoption of the package, the renaming of tools under source aliases and the startup checks are later, separate changes; each manifest entry carries the `id` and `alias` they need, and 0.1.0 reads neither.
- Each change to a source's schemas or guidance now has two homes until the website consumes the package; the golden fixture records which bytes the package was moved from.
- Adding a source becomes one manifest entry, once the website reads the manifest.

## References

- [civic-ai-tools#244](https://github.com/npstorey/civic-ai-tools/issues/244) — the sprint anchor, its G0 record and amendments.
- [ADR-0022](0022-civic-typed-harness-packaging.md) — the workspace, the first package and its module boundary.
- `packages/civic-typed-router/README.md` — the pure-move contract, the inputs, the layout and how to re-run the capture.
