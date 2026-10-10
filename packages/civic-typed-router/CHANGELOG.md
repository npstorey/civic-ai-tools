# Changelog — @typedstandards/civic-typed-router

Factual record of what changed per published version.

## Unreleased

0.1.0, the first release ([civic-ai-tools#244](https://github.com/npstorey/civic-ai-tools/issues/244);
[ADR-0031](../../docs/adr/0031-civic-typed-router-packaging.md)).

- **A pure move.** What the reference website wired at
  `3a0c894701e8e75161c85c567eb1c11efc06da71` in `src/lib/mcp/registry.ts`,
  `tools.ts`, `socrata-skill.ts` and `operation-types.ts`, with the embedded
  `data-commons-skill.ts` and `boston-skill.ts`, as one manifest of three
  sources: Socrata, Google Data Commons and Boston OpenContext. With the same
  inputs it produces the website's 42 captured prompts, 5 captured tools
  arrays and every captured fact byte for byte
  (`src/__fixtures__/app-goldens.json`).
- **Two directories.** `src/core/` is domain-free: the manifest entry type,
  selection by configuration, the composer's join, the offered-tools filter,
  the tool-to-source index, and two validations defined but not invoked.
  `src/civic/` holds the three entries and every sentence. Core imports
  nothing from civic and nothing from any package (`src/boundary.test.ts`).
- **Inputs, not reads.** The router reads no clock, holds no cache and reads
  no environment: `today`, the publication host, the configuration and the two
  fetchers are the consumer's. `readMcpEnv` reads the configuration from a
  plain object with the website's rules.
- **Carried, not applied.** Each entry carries an `id` and an `alias`; nothing
  reads them yet.
- No runtime dependency. The tool-schema type is structural.
