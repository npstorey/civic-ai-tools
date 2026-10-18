# Changelog — @typedstandards/civic-typed-router

Factual record of what changed per published version.

## Unreleased

Hosting variants and the logging posture on every entry, with each source's
consent default and publisher ([ADR-0036](../../docs/adr/0036-source-hosting-variants-and-logging-posture.md)).
No golden moves: every prompt, tools array and fact is 0.3.0's.

- **Breaking: `ManifestEntry.hosting?` is removed.** In its place every entry
  lists `hostings: readonly HostingVariant[]`, a union discriminated on
  `kind`: `NpmPackageVariant` (`kind: 'npm-package'`; it extends
  `SourceHosting`, whose five keys are unchanged, so a
  `Pick<SourceHosting, …>` of a variant compiles as before), `RemoteVariant`
  (`kind: 'remote'`) and `ContainerVariant` (`kind: 'container'`, a name only:
  no host is built). Every arm carries `variant`, `runsAt`
  (`'instance-sandbox' | 'publisher' | 'government' | 'other'`) and
  `logging`. No arm has an address field. A manifest built outside this
  package must add `hostings` and `consentDefault` to each entry.
- **The logging posture.** `logging: readonly LoggingPosture[]` names every
  holder of logs of what a variant is sent, in the order the data flows.
  A posture is either stated by the manifest (`statedBy: 'manifest'`,
  `holder`, `keeps: 'none' | 'metadata' | 'content' | 'not-stated'`,
  `retention?`, `statementUrl`, `readOn`) or left to the instance by role
  (`statedBy: 'instance'`, `role`), for a holder the instance chooses. Policy
  text carried by reference, never read by the router.
- **`consentDefault: 'on' | 'ask-first'`** on every entry, `'on'` for all
  four, and **`publisher?: string`**: npstorey (Socrata), Google (Data
  Commons), City of Boston (Boston OpenContext), BetaNYC (NYC Charter).
- **The four entries' variants.** Socrata: `remote`, runs at `other`, holders
  by role `server-operator` and `portal-operator`. Data Commons: `remote`,
  runs at `publisher`, Google, `content`
  (https://policies.google.com/privacy?hl=en-US). Boston OpenContext:
  `remote`, runs at `government`, City of Boston, `metadata` (the City's
  terms of use and privacy policy for its digital services). NYC Charter:
  `sandbox` (`npm-package`), runs at `instance-sandbox`, with 0.3.0's
  package, version, commit and `outbound: []`, holder by role
  `sandbox-platform`. Every stated posture was read on 2026-10-18.
- **The switch names the variant.** `NYC_CHARTER_HOSTING=sandbox` turns on
  the variant named `sandbox` (`NYC_CHARTER_HOSTING_SANDBOX`); the switch rule
  itself is unchanged.
- New exports: the types `HostingVariant`, `HostingVariantCommon`,
  `NpmPackageVariant`, `RemoteVariant`, `ContainerVariant`, `HostingRunsAt`,
  `LoggingPosture`, `StatedLoggingPosture`, `InstanceLoggingPosture`,
  `LoggingKeeps` and `ConsentDefault`, and the value
  `NYC_CHARTER_SANDBOX_VARIANT`. `NYC_CHARTER_HOSTING` and `SourceHosting`
  are unchanged.
- Tests: the goldens' sentinel and throwing-getter runs cover `hostings`,
  `consentDefault` and `publisher` beside `id` and `hosting`;
  `hosting-type.test.ts` pins the union, its arms and the posture at type
  check; `hosting-variants.test.ts` pins the four entries' values;
  `hosted-variant-derivations.test.ts` derives every value the reference
  website derives from a hosting value and holds each equal to 0.3.0's.

## 0.3.0 — 2026-10-16

A fourth source the instance runs itself, the minimal hosting field and its
switch, and the tool-to-source index for a shared bare name.

- **NYC Charter, Laws and Rules** (`NYC_CHARTER_ENTRY`, last in
  `CIVIC_MANIFEST`): `@betanyc/nyc-charter-laws-rules` on npm, published by
  BetaNYC, pinned at 0.3.1. `id`
  `@betanyc/nyc-charter-laws-rules@https://github.com/BetaNYC/nyc-charter-laws-rules`,
  alias `nyc_charter`, source id `nyc-charter`, optional. Its five tools are
  exposed as `nyc_charter__search`, `nyc_charter__get_section`,
  `nyc_charter__list_titles`, `nyc_charter__get_title` and
  `nyc_charter__get_version`; their schemas are the server's own at 0.3.1,
  captured by `src/__fixtures__/pin-nyc-charter-tools.mjs` into
  `nyc-charter-tools.json` and carried as code (`NYC_CHARTER_TOOLS`). Its
  guidance returns `''` and calls neither fetcher. New exports:
  `NYC_CHARTER_ENTRY`, `NYC_CHARTER_HOSTING`, `NYC_CHARTER_TOOLS`,
  `NYC_CHARTER_TOOL_NAMES`.
- **The hosting field, minimal.** `SourceHosting` (core) and
  `ManifestEntry.hosting?`: `kind: 'npm-package'`, `package`, `version` and
  `commit` as separate strings, and `outbound` (the hosts the source may
  reach; NYC Charter's is `[]`, none). No address, command or port. Carried,
  never read by the router. The full field, with its variants and the
  logging posture, is later work (R6).
- **The switch rule.** `readMcpEnv` reads `NYC_CHARTER_HOSTING`
  (`NYC_CHARTER_HOSTING_VARIABLE`): when its trimmed value is exactly
  `sandbox` (`NYC_CHARTER_HOSTING_SANDBOX`), the result gains
  `nycCharterHosting: 'sandbox'`; unset, blank or any other value, and the
  key is absent. `McpRegistryEnv` gains the optional field. With the switch
  unset every configuration reading is 0.2.0's, key for key.
  `configuredAddresses` gains no key; selection reads the new
  `configuredSources`, which adds a hosted source's switch while it is on.
  The entry's `configuration.addressVariable` names the switch.
- **The index rule.** `toolSourceIndex` (and so `sourceIdForToolName`) gives
  a bare name two sources declare to the first entry that declares it,
  whatever is configured: `search` is Socrata's. Through 0.2.0 the last entry
  won; no manifest then shared a name.
- **The bare filter.** `offeredMcpTools` withholds a not-offered source's own
  schema objects as well as the names only not-offered sources declare, so
  withholding NYC Charter's `search` keeps Socrata's. With the switch on, the
  bare tools array holds two tools named `search`: the bare view cannot name
  them apart, and the aliased view is the one to use.
- **With the switch unset**, every bare and aliased prompt and tools array is
  0.2.0's byte for byte (the 42 and the 5 goldens). The facts that move, each
  asserted as a stated delta in `src/router-goldens.test.ts`:
  - `mcpTools` and `aliasedMcpTools`, the vocabulary (replay's tools, the
    bare and aliased `mcpToolsFor`), gain NYC Charter's five schemas at the
    end;
  - `withheldToolNames` and `aliasedWithheldToolNames` gain its five names in
    every configuration, and so the offered array is never the vocabulary
    object (`offeredIsBare`, `offeredIsMcpTools` false where every other
    source is configured);
  - `sourcesOffered` gains a row `{ sourceId: 'nyc-charter', alias:
    'nyc_charter', reason: 'not-configured' }`;
  - `sourceIdForToolName` answers `nyc-charter` for `get_section`,
    `list_titles`, `get_title` and `get_version`, names no source had;
  - the dispatch map holds sixteen names;
  - a bare `search` still resolves to `socrata__search`.
- **With the switch on**, the aliased tools array gains the five after every
  other source's, and the prompt gains the count word, one preamble entry,
  one outro citation and one lock-section mention, and no block. A bare
  `search` is refused as ambiguous, naming `socrata__search` and
  `nyc_charter__search`.
- **For a consumer's records.** At the pin bump to this version, the
  router's own `components[]` entry in every new record moves from `0.2.0`
  to `0.3.0`, and every new record's `sourcesOffered` gains the
  `nyc-charter` row above.
- **The goldens capture refuses a circular tree.**
  `capture-app-goldens.mjs` refuses a website tree whose `src/lib/mcp/`
  imports this package; its call sites stay the website's at `d1919a8`. The
  committed goldens are re-captured at `d1919a8` with the changed script:
  `_meta.script.sha256` is the only byte that moves.

## 0.2.0 — 2026-10-15

The aliased view, the routing fields, the startup checks, the selection, and a
fourth source ([ADR-0032](../../docs/adr/0032-tool-naming-across-sources.md)).

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
