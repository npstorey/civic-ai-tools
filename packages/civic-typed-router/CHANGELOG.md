# Changelog — @typedstandards/civic-typed-router

Factual record of what changed per published version.

## 0.2.0 — 2026-10-15

The aliased view, the routing fields, the startup checks, the selection, and a
fourth source ([ADR-0032](../../docs/adr/0032-tool-naming-across-sources.md)).
`version` stays `0.1.0` until the release change dates this heading.

- **The civic text at the website's `d1919a8`.** San Francisco's portal is
  `data.sf.gov` in the `get_data` schema, the fallback's portal table and the
  per-portal notes, whose San Francisco fields are now `requested_datetime`,
  `service_name` and `analysis_neighborhood` (website #587). The Data Commons
  text takes places by name (website #578), and its schemas offer only the
  arguments the server reads: `parent_place`, `maybe_bilateral` and
  `child_place_type` are dropped (website #579). The goldens are re-captured
  at `d1919a86cc826c0870c8cfbc4c902791c6f9086d` with the committed script,
  whose San Francisco configuration now uses `data.sf.gov`
  ([civic-ai-tools#253](https://github.com/npstorey/civic-ai-tools/issues/253)).
  These are the only changes to the bare output.
- **Two views.** Every output has an `aliased*` sibling that names each tool
  `<alias>__<upstream name>`: `aliasedMcpTools`, `aliasedMcpToolsFor`,
  `aliasedOfferedMcpTools`, `aliasedWithheldToolNames`,
  `aliasedBuildSystemPrompt`, `aliasedPortalLockGuidance`,
  `aliasedWithPortalLockGuidance`. The bare functions are unchanged. Text the
  package owns names tools through `SourceView.toolName`; text a source sends
  gets the anchored rewrite (`anchoredRewrite`, `aliasedGuidance`).
  `unaliasText` undoes the aliased view; for every captured prompt and tools
  array it gives the bare bytes.
- **Names and dispatch.** `exposedToolName` and `normalizeToolName` (out-of-set
  characters to `_`; a name over 64 characters cut and ended with a short
  hash); `checkToolNames` and `findToolNameProblems` (ill-formed, shared
  alias; shared source id; a collision after normalizing), throwing
  `ToolNameError`; `dispatchMap`, `resolveCalledName` (the dispatch rule),
  `upstreamToolName`, `sourceForAliasedName`, `aliasedView`, `BARE_VIEW`,
  `entryToolsInView`, `aliasedTools`.
- **Startup checks.** `createCivicRouter` runs `checkToolNames` and
  `assertUniqueToolNames` (over the exposed names) and builds the dispatch
  map, exposed as `router.dispatchMap`. A manifest that fails is refused. 0.1.0
  invoked no validation.
- **The routing fields.** `ManifestEntry` gains `description` and `freshness`
  (required, one line each, model-facing) and `freshnessSource` (the
  citation, never model-facing), and `toolsFor(view)`. The three civic
  entries carry them. `GuidanceEntry.fetchText` takes an optional view.
- **The selection.** The composition and the offered tools take an optional
  `selection` of source ids (`SourceSelection`); the default is every source
  the configuration offers, with the 0.1.0 output. `sourcesOffered` and
  `router.sourcesOffered` give each source's reason: `configured`,
  `not-configured`, `selected` or `not-selected`. The configuration takes
  precedence.
- **A fourth source composes.** The preamble entry, the outro citation and the
  lock text come from the entry (`CivicManifestEntry.prompt`,
  `CivicManifestEntry.portalLock`), or are composed from its `displayName` and
  `description`; the count word continues past three. A manifest with a
  source beyond the three no longer composes `undefined`. The lock's other
  sources are now the offered entries other than the locked one, so a manifest
  without Boston OpenContext no longer names it in the lock section.
- **New exports for the views.** `socrataTools`, `socrataSkillFallback`,
  `dataCommonsTools`, `bostonTools`, `bostonSkill`, `lockSocrataTools`,
  `portalLockSectionFor`, `composePreamble`, `composeOutro`,
  `civicPreambleEntry`, `civicCitation`, `sourceCountWord`; `getSkillForPortal`,
  `dataCommonsSkill`, `lockedSearch` and `lockedFetch` take an optional view.
- **A pinned guidance fixture.** `src/__fixtures__/socrata-guidance.json`, the
  Socrata guidance the website fetches, from socrata-mcp-server at `3163601`,
  with the script that pins it.

## 0.1.0 — 2026-10-10

The first release ([civic-ai-tools#244](https://github.com/npstorey/civic-ai-tools/issues/244);
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
