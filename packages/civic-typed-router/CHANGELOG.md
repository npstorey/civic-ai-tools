# Changelog — @typedstandards/civic-typed-router

Factual record of what changed per published version.

## 0.10.0 — 2026-11-13

The search, its tool and the routing configuration, and the one-portal lock
for a Socrata pack (S3-A P1, hub #318). Nothing here reads a clock, a file
or the network. With no lock and no search call, every output is 0.9.0's.

- **The search, method `bm25` version 1**, the method the hub's S1
  benchmark ran (`benchmark/runner/search.mjs`), with the same arithmetic
  in the same order: for each of the 876 searches S1's committed run
  records, it returns the same aliases in the same order. In the core:
  **`createSearchIndex(entries)`**, an index (`SearchIndex`) over any
  entries with `alias`, `displayName` and `description`
  (`SearchableEntry`), whose `search(query, { top?, within? })`
  (`SearchOptions`) returns the entries scoring above 0, best first, ties
  in the entries' order, then those `within` the space, then the first
  `top`; **`SEARCH_METHOD`** (`SearchMethod`, `{ method: 'bm25', version:
  '1' }`) and **`SEARCH_DEFAULT_TOP`** (10). The space is a filter after
  scoring: it moves no score.
- **`router.searchSources({ configured, query, space?, top? })`**
  (`SearchSourcesInput`), hits as `{ sourceId, alias }` (`SourceHit`): the
  search over an index of the whole manifest, with the space the consumer
  passes intersected with the sources the configuration offers. With no
  space, every entry may be a hit, offered or not, except a Socrata pack
  the one-portal lock removes.
- **The search tool, `find_source(query)`**: **`router.aliasedFindSourceTool()`**,
  built by the core's **`findSourceTool(text)`** (`FindSourceToolText`) from
  **`FIND_SOURCE_TOOL_TEXT`**, S1's schema and description byte for byte, a
  new object on every call; its result texts **`FIND_SOURCE_RESULT_TEXT`**
  (`FindSourceResultText`: `found(aliases)`, `none`, `limit`), S1's; and
  **`FIND_SOURCE_LIMIT`** (2), the searches a run answers, part of the
  tool's contract, so a change to it is a new search version.
  **`FIND_SOURCE_TOOL_NAME`** (`'find_source'`) is reserved as
  `load_source` is: `findToolNameProblems` reports an alias or an upstream
  tool of that name as a `reserved-name` problem, and `checkToolNames` and
  `createCivicRouter` throw `ToolNameError`. The `load_source` problems and
  their messages are unchanged.
- **`routingConfiguration({ rule, cap, search, inventory })`**: S1's
  routing configuration (`RoutingConfiguration`, `RoutingRule`,
  `RoutingInventory`), rebuilt key for key in S1's order, and the
  lowercase hex SHA-256 of its canonical JSON, returned as
  `{ routingConfiguration, routingConfigurationHash }`
  (`RoutingConfigurationRecord`). For each of the 16 configurations of
  S1's committed run, the object and the hash equal the ones its
  `meta.json` records. A value outside the shape (a `cap` neither `'none'`
  nor a positive decimal integer with no leading zero, so `'0'` and `'025'`
  are refused, a `search` neither `'none'` nor exactly the strings
  `method` and `version`, a `rule` or `inventory` with a missing, extra or
  non-string member, an `inventory.hash` not 64 lowercase hex characters)
  is refused with **`RoutingConfigurationError`** and never hashed.
- **The one-portal lock and a Socrata pack** (G0-6 on hub #318):
  `McpRegistryEnv` gains **`lockedPortal`**, optional, set by the consumer
  (`readMcpEnv` never sets it). Locked to a Socrata portal other than a
  Socrata pack's own (compared trimmed and lower-cased), the pack is not
  configured: `configuredAddresses` gives it no address, its reason in
  `sourcesOffered` is `not-configured`, every offer output leaves it out
  and withholds its tools, `isSourceOffered` is `false`,
  `resolveCalledName` refuses its tools, and no search finds it. The lock
  text (`portalLockGuidance`, `withPortalLockGuidance` and their aliased
  twins) no longer names it, also when the lock arrives only as their
  `lockedPortal` argument. So an instance locked to another portal no
  longer offers NYC City Record; one locked to `data.cityofnewyork.us`, or
  not locked, is unchanged. No existing function's signature changes.

## 0.9.0 — 2026-11-12

The route-identity conventions (ADR-0039), and the inventory moves to
version 3 (`2026-11-12.1`, schema `civic-inventory/3`).

- **`pack.basePins`**, a new member of `pack` on a pack's manifest entry:
  `pack` is now `{ version, hash, basePins }`. Each pin is what the pack's
  base reported when it was captured: `serverName`, `serverVersion`, and
  `tools`, the `mcpToolSchemaSha256` of each base tool the pack calls.
  Carried, never read by the router. `NYC_RECORD_ENTRY.pack` holds one pin,
  for the Socrata server `socrata-mcp-server` `0.9.2`, `get_data` and
  `fetch`.
- **`mcpToolSchemaSha256(tool)`**, with `mcpToolSchemaText` and
  `schemaWithoutAnnotations`: a server tool's schema hash, the SHA-256 of
  the RFC 8785 canonical JSON of `{ name, inputSchema }` with `title` and
  `description` removed from every schema object the walk reaches (the walk
  is ADR-0039's). **`canonicalJsonValue(value)`** and
  `CanonicalJsonValueError`: RFC 8785 over every JSON value type.
- **`checkBasePins(pins, observed)`**: the first pin a live base's report
  equals, or each pin's first difference (member, pinned value, observed
  value). A tool no pin names is not compared.
- **`routesByApi(inventory)`** and **`apiContains(a, b)`**: the groups of
  inventory entries that are routes to the same data, by their `api`. No
  router code calls them.
- **`manifestFromInventory`** reads `civic-inventory/3`: a pack names its
  base by the base server entry's full `id`, and the loader writes that
  entry's `sourceId` as the manifest entry's `base`, as before. It refuses
  (`InventoryLoadError`, naming the alias and the field) an `id` a second
  entry states; a `base` naming no server entry's `id` (a `sourceId` is
  refused with the `id` to use); a pack with no `basePins`, a malformed
  pin, a pin that leaves out a tool the pack calls, or one naming a tool
  the base does not have; and, in the Socrata kind, a pack whose `api` is
  not its filter's (`platform` `socrata`, `host` its `filter.portal`,
  `dataset` its `filter.dataset_id`). `InventoryPackEntry` gains
  `basePins`; `packManifestEntry` writes the base's `sourceId` and the pins.
- **NYC City Record**: display name "NYC City Record" (was "NYC City Record
  MCP Server"), lock-section mention "City Record for New York City
  notices" (was "the City Record server for New York City notices"), pack
  version `1.1`, and a new hash, which also covers its `base` by `id`, its
  pin, its `api` and its `derivedFrom`. So a composition offering City
  Record with the one-portal lock names it by the new mention. Every golden
  holds byte for byte.
- **The prompt frame's helpers refuse an id they have no text for**, by
  name, with an `Error` whose message holds the id in double quotes:
  `crossSourcePreamble` and `civicPreambleEntry` (which wrote `undefined`
  or threw a `TypeError` for an id outside the three code sources),
  `civicCitation`, and `outroFor`. `outroFor` and `civicCitation` take
  `CitedSourceId` (new): the three and `nyc-record`, whose citation they
  now name; through 0.8.0 `outroFor` cited City Record as nothing, or as
  `undefined` when it came last of three or more.
- **Google Data Commons** (`DATA_COMMONS_ENTRY`): `id`
  `Data Commons MCP Server@https://api.datacommons.org/mcp` (was
  `datacommons-mcp@https://github.com/datacommonsorg/agent-toolkit`), the
  endpoint form, with the name the hosted server reports. The one stated
  exception to "an `id` is never changed once released" (ADR-0039 §B).
  A component that names the source carries the new `id`, so a harness
  definition over it moves. Its `freshnessSource` now says the hosted
  server is the one built into Google's Data Commons Mixer.
- **`ManifestEntry.id`'s comment** no longer says an MCP Registry name comes
  first: a Registry name goes in an inventory entry's `registry.name`.
- **`CIVIC_INVENTORY`** is `{ id: 'civic', version: '2026-11-12.1', hash }`.
- **The Socrata server's capture**: `src/__fixtures__/socrata-tools.json`,
  its `initialize` and `tools/list` at a stated commit, and
  `pin-socrata-tools.mjs`, which writes it (README, "Re-running the
  captures"). Not in the package's files.

## 0.8.0 — 2026-11-09

NYC City Record becomes a pack over the Socrata server, and the inventory
moves to version 2 (`2026-11-09.1`). City Record keeps its `sourceId`
(`nyc-record`) and alias (`nyc_record`), so a reader's consent and the
directory carry over; its server, its sandbox and its switch are gone.

- **City Record is a pack** (`NYC_RECORD_ENTRY`, sixth in `CIVIC_MANIFEST`
  as before). `base` `socrata`; filter `{ portal: 'data.cityofnewyork.us',
  dataset_id: 'dg92-zbpx' }`; `id`
  `nyc-record@https://data.cityofnewyork.us/d/dg92-zbpx`; `version` `1`.
  Its tools are `nyc_record__get_data` and `nyc_record__fetch`, the Socrata
  server's held to that dataset; it has no `search`, since its filter names
  a dataset. Its guidance is seven query recipes, one for each tool of
  `@betanyc/nyc-record-mcp` 1.1.0, with that tool's `where`, `order` and
  `limit`; the search recipe passes the phrase as `query` with
  `type: query`, which the Socrata server applies as a full-text search
  (`$q`). Its configuration, hosting variant and consent default are the
  Socrata entry's: `required`, so the pack is offered in every
  configuration, with the Socrata address set or unset, as Socrata is. So
  every composition with no selection gains City Record's preamble entry,
  block, citation and lock-section mention, and its tools array the pack's
  two tools; and a bare `get_data` or `fetch` is refused as ambiguous
  (`socrata__get_data` or `nyc_record__get_data`) in every configuration.
  Every golden prompt and tools array holds byte for byte with the pack left
  out of the selection; the in-loop fixture is re-captured, its directory
  gaining City Record's line.
- **The configuration (removed field and variable).** `readMcpEnv` reads
  `NYC_RECORD_HOSTING` no more, and `McpRegistryEnv` loses its
  `nycRecordHosting` field. `configuredAddresses`, and so
  `configuredSources`, keys a pack by its base's address: `nyc-record` has a
  key, the `SOCRATA_MCP_URL` value, exactly when `socrata` has an address.
- **Five exports removed:** `NYC_RECORD_HOSTING_VARIABLE`,
  `NYC_RECORD_HOSTING`, `NYC_RECORD_SANDBOX_VARIANT`,
  `NYC_RECORD_TOOL_NAMES` and `NYC_RECORD_TOOLS`. `NYC_RECORD_ENTRY` stays.
- **`pack: { version, hash }`**, a new optional member of `ManifestEntry`:
  set by `manifestFromInventory` on a pack's entry from the inventory's
  `version` and `hash`, absent on a server entry, and carried, never read
  by the router. A consumer credits a pack as `<version>+<hash12>`.
- **`packHash(entry)`**: a pack's hash, the SHA-256 of `canonicalJson` of
  its inventory entry with `hash`, `provenance` and `toolsRef` removed.
  `manifestFromInventory` refuses, with `InventoryLoadError` naming the
  pack's alias and the field `hash`, a pack that states no hash or one that
  is not its `packHash`. `InventoryPackEntry` gains `version` and `hash`.
- **Three passages corrected.** `ManifestEntry.base`'s comment, the README's
  pack paragraph and `DispatchTarget.base`'s comment named the pack's
  `sourceId` as the one a pack's call is recorded by. Each now says the call
  is recorded under the base's `sourceId`, with the pack's inventory `id`
  beside it as `mcp.pack_id`.
- **`CIVIC_INVENTORY`** is `{ id: 'civic', version: '2026-11-09.1', hash }`.
  The hub's inventory check and schema now hold the version to a calendar
  date and a counter with no leading zero (`2026-11-06.01` and
  `2026-13-01.1` are refused), and require every pack's `hash`.

## 0.7.0 — 2026-11-07

The seven sources as data: the hub's `inventory/civic-inventory.json`
(`civic-inventory/2`, version `2026-11-06.1`) is their source of truth, and
the manifest can be built from it. `CIVIC_MANIFEST` does not change: it stays
code, held equal to the file by a test. Every golden prompt and tools array,
the in-loop fixture and every harness definition holds, over `CIVIC_MANIFEST`
and over the manifest loaded from the file.

- **`manifestFromInventory(inventory, kinds)`**, pure: a manifest from a
  parsed inventory document, by entry kind, with each entry's tools held to
  its `toolsRef` (names and `toolsSha256`). Refuses an entry it cannot build
  with `InventoryLoadError`, naming the entry's alias and the field. With its
  document types (`InventoryDocument`, `InventoryServerEntry`,
  `InventoryPackEntry`) and kind types (`EntryKind`, `EntryKinds`).
- **`toolsSha256(tools)`**: the tools' hash, the SHA-256 of
  `JSON.stringify` of the bare-view schemas (the benchmark's definition).
- **`CIVIC_KINDS`** and **`civicKinds(options)`**: the civic kinds,
  `socrata`, `mcp-remote` and `npm-package`.
- **`CIVIC_INVENTORY`**: `{ id: 'civic', version: '2026-11-06.1', hash }`,
  the file `CIVIC_MANIFEST` mirrors.
- **Packs.** `ManifestEntry` gains an optional `base`: on a pack, the
  `sourceId` of the server whose tools it calls with fixed arguments. The
  `socrata` kind builds a pack's `get_data` and `fetch` with its portal (and
  dataset) fixed, and `search` only for a portal-only pack over the portal
  the server is configured for. No entry of `CIVIC_MANIFEST` is a pack.
- **Dispatch names a pack's base.** `DispatchTarget` and a resolved
  `CalledNameResolution` gain an optional `base`, set on a pack's tools
  only: the server a call goes to, beside the pack's `sourceId`. A server
  entry's target is unchanged, key for key.
- **A startup check for packs.** `findToolNameProblems` (and so
  `checkToolNames` and `createCivicRouter`) reports a pack whose `base`
  names no entry of the manifest or names another pack, as a new
  `ToolNameProblem` kind, `pack-base`, naming the pack's alias. No
  manifest without a `base` gains a problem.

## 0.6.0 — 2026-10-20

Three more sources an instance runs itself from pinned packages, each
switched off by default, and one carried field on every hosting variant
([ADR-0036](../../docs/adr/0036-source-hosting-variants-and-logging-posture.md)).
With the three switches unset every prompt, offered tools array,
directory, first-step tool, in-loop prompt and harness definition is
0.5.0's, every golden prompt and tools array holds, and `readMcpEnv`
returns 0.5.0's keys. What names the whole vocabulary grows, as it did for
NYC Charter in 0.3.0: `mcpTools` and `aliasedMcpTools` gain the 41 new
schemas after Charter's, and the withheld tools gain their names while
their switches are off.

- **NYC Checkbook, NYC City Record and NYS Open Legislation**
  (`NYC_CHECKBOOK_ENTRY`, `NYC_RECORD_ENTRY`, `NYS_LEGISLATION_ENTRY`), after
  NYC Charter in `CIVIC_MANIFEST`, which now holds seven entries. Each is a
  stdio server published by BetaNYC, pinned by version and by the registry's
  `gitHead`: `@betanyc/nyc-checkbook-mcp` 1.6.3
  (`f013a276e37e218e93c069c585d54dc3b4e3ee00`), `@betanyc/nyc-record-mcp`
  1.1.0 (`6c52a5353381592713678caa109870d1e912c858`) and
  `@betanyc/nys-openlegislation-mcp` 2.4.0
  (`cc069c46d52b939275f9dcac3d72b2dd011531d3`). Source ids `nyc-checkbook`,
  `nyc-record`, `nys-legislation`; aliases `nyc_checkbook`, `nyc_record`,
  `nys_legislation`; each `id` the package name and repository address.
  Their 10, 7 and 24 tool schemas are the servers' own `tools/list` at the
  pins (`*_TOOLS`, `*_TOOL_NAMES`). NYS Open Legislation's `search` is
  exposed as `nys_legislation__search`; a bare `search` is refused as
  ambiguous whenever two of Socrata, NYC Charter and NYS Open Legislation
  are offered. None of the three sends guidance, so offering one fetches
  nothing and wakes nothing.
- **Their variants** (`*_HOSTING`, `*_SANDBOX_VARIANT`): one `sandbox`
  variant each, `npm-package`, run at `instance-sandbox`, with one outbound
  host each (`www.checkbooknyc.com`, `data.cityofnewyork.us`,
  `legislation.nysenate.gov`), and two log holders: the sandbox platform by
  role, then the upstream holder stated by the manifest (Office of the New
  York City Comptroller; City of New York; New York State Senate), each
  `keeps: 'not-stated'`, since none of the statements read on 2026-10-19
  says what it keeps of API requests.
- **Consent defaults:** `'ask-first'` for NYC Checkbook and NYS Open
  Legislation, `'on'` for NYC City Record; `publisher` BetaNYC for all three.
- **`keyIn?: 'header' | 'query'`** on `HostingVariantCommon`: where a
  variant sends the instance's key, `'header'` (a request header) or
  `'query'` (the request URL's query string); absent, the variant sends
  no key of the instance's. NYS Open Legislation's variant carries
  `keyIn: 'query'` (the server sends its key in the request URL); no other
  variant carries it. Carried, never read by the router. How the key
  reaches the sandbox is the consumer's.
- **Three switches:** `NYC_CHECKBOOK_HOSTING`, `NYC_RECORD_HOSTING` and
  `NYS_LEGISLATION_HOSTING` (`*_HOSTING_VARIABLE`), each on only when its
  trimmed value is exactly `sandbox`. `readMcpEnv` then adds
  `nycCheckbookHosting`, `nycRecordHosting` or `nysLegislationHosting`
  (after `nycCharterHosting`, in that order), and `configuredSources` adds
  the source; `configuredAddresses` never does. `HOSTING_SANDBOX` names the
  value every switch shares; `NYC_CHARTER_HOSTING_SANDBOX` is the same value.
- **Directory lines.** Each new entry's `description` says what the source
  covers and what it does not hold, and its `freshness` that every call is
  live, with `freshnessSource` citing the publisher's README at the pin.
- **For a consumer's records.** A hosted source reaches a record as NYC
  Charter does: its purl in `mcpServers` and `x.y.z+commit` in
  `components[].version`, from its variant's `package`, `version` and
  `commit`; nothing new in shape. At the pin bump to this release, the
  router's own `components[]` entry in every new record moves to it.
- Tests: `hosted-entries.test.ts` (each entry against its capture, the
  captures' metadata, the startup checks and dispatch, the switches, every
  offered output with the switches unset against the four-entry manifest's,
  the variants and postures, the directory lines); the goldens' stated
  delta covers the four hosted sources, and a run with every variant's
  `keyIn` behind a throwing getter; the directory, first-step tool and
  in-loop tests switch the new entries on in their every-source
  configuration (the pinned in-loop fixture keeps its own). Fixtures:
  `nyc-checkbook-tools.json`, `nyc-record-tools.json` and
  `nys-legislation-tools.json`, each captured by its `pin-*-tools.mjs`
  (`initialize`, `notifications/initialized` and `tools/list` only; NYS
  Open Legislation's server started with a placeholder key).

## 0.5.0 — 2026-10-19

In-loop routing: the directory, the first-step tool, composition for a
loaded set, and the harness definition
([ADR-0037](../../docs/adr/0037-the-first-step-tool.md)). Every function
is new; no golden moves: every prompt, tools array and fact is 0.4.0's,
and `buildSystemPrompt` with an empty selection keeps its bytes.

- **The directory.** `directoryPrompt({ configured, today, selection? })`:
  the intro, `## Data sources`, one paragraph (`DIRECTORY_PARAGRAPH`), and
  one line per source of the directory set in manifest order,
  `` - `<alias>`: <description> Freshness: <freshness> `` (a period added
  to a description without closing punctuation). No outro, no trailing
  newline, no fetch. Over R5's eleven frozen entries it is the text the
  quote test of 2026-10-19 measured (3,486 characters). Core:
  `composeDirectory`, `directoryLine`, `directorySentence`,
  `DirectoryFrame`, `DirectoryEntry`; civic: `directoryFrameFor`,
  `DIRECTORY_HEADING`, `DIRECTORY_FRESHNESS_LABEL`.
- **The first-step tool.** `aliasedLoadSourceTool({ configured,
  selection? })`: `load_source` with one required argument, `alias`,
  whose enum is the directory set's aliases; R5's frozen schema and
  descriptions (`LOAD_SOURCE_TOOL_TEXT`). Core: `loadSourceTool`,
  `LOAD_SOURCE_TOOL_NAME`, `LoadSourceToolText`.
- **Breaking for a manifest that uses the name: `load_source` is
  reserved.** `ToolNameProblem` gains a kind, `reserved-name` (`name`,
  `sourceId`, `field: 'alias' | 'tool'`), and `createCivicRouter` refuses
  a manifest whose alias or upstream tool is named `load_source`, since a
  bare call of that name would otherwise be dispatched to the source. A
  consumer that switches over `ToolNameProblem['kind']` sees one more.
- **Composition for a loaded set.** `aliasedInLoopSystemPrompt({
  ...BuildSystemPromptInput, loaded })`: the directory over `selection`,
  then, when a loaded source is in the directory set, `BLOCK_SEPARATOR`
  and the aliased composition over the loaded sources without its intro.
  With nothing loaded it is the directory and calls no fetcher.
- **The harness definition.** `harnessDefinition({ configured, selection,
  chosenBy, components })` returns `{ domain, sources, components,
  chosenBy, hash }`: `domain` `'civic'` (`CIVIC_DOMAIN`), `sources`
  `offeredSkillSources(configured, selection)`, the consumer's components
  (`id`, `version?`, `guidanceHash?`), `chosenBy` `'reader' | 'model' |
  'instance'` (`CHOSEN_BY`), and `hash`, the lowercase hex SHA-256 of the
  canonical JSON of the other four. No `task`. Refusals throw
  `HarnessDefinitionError`. Core: `harnessDefinitionOf`,
  `HarnessDefinitionParts`, `HarnessDefinition`,
  `HarnessDefinitionComponent`, `ChosenBy`.
- **Canonical JSON and SHA-256, the package's own.** `canonicalJson`
  (RFC 8785 for strings, arrays and plain objects; any other value throws
  `CanonicalJsonError`), `sha256` and `sha256Hex` (FIPS 180-4 over UTF-8
  bytes). No import and no runtime dependency.
- New types for the inputs: `DirectoryPromptInput`, `LoadSourceToolInput`,
  `InLoopSystemPromptInput`, `HarnessDefinitionInput`.
- **For a consumer's records.** At the pin bump to this version, the
  router's own `components[]` entry in every new record moves to this
  version. Nothing else in a record moves from this package alone.
- Tests: `directory.test.ts`, `load-source.test.ts`, `in-loop.test.ts`
  (with the pinned fixture `in-loop-one-source.json`) and
  `definition.test.ts` (FIPS 180-4 vectors and 1,200 inputs against
  `node:crypto`); the fixtures `r5-directory-entries.json` and
  `r5-load-source-tool.json` from R5's frozen directory; the goldens'
  sentinel and throwing-getter runs also run the four new functions.

## 0.4.0 — 2026-10-18

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
- **For a consumer's records.** At the pin bump to this version, the
  router's own `components[]` entry in every new record moves from `0.3.0`
  to `0.4.0`. Nothing else in a record moves: the `sandbox` variant carries
  0.3.0's package, version and commit strings, so the purl and the component
  version a consumer derives for NYC Charter are unchanged.
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
