# @typedstandards/civic-typed-router

The civic MCP router for applications built on [Typed Standards](../../docs/architecture/typed-standards-specification.md): one manifest of three sources (Socrata open data portals, Google Data Commons, Boston OpenContext), each with its tool schemas and its guidance, and the two outputs a model run needs from them, the tools array and the composed system prompt. Its landing is recorded in [ADR-0031](../../docs/adr/0031-civic-typed-router-packaging.md); its naming of tools across sources in [ADR-0032](../../docs/adr/0032-tool-naming-across-sources.md).

## The output contract

The router hands a consumer three things, and any harness or gateway can consume them:

1. **a tools array** of chat-completions function tools (`{ type: 'function', function: { name, description, parameters } }`);
2. **a prompt**, one string;
3. **the dispatch map**, from each name the model may call to `{ sourceId, alias, upstreamName }`.

The router performs no call. The consumer sends the tools and the prompt to a model, and when the model calls a tool, resolves the name it called through the map (`resolveCalledName`) and calls the server by its upstream name.

## Two views: bare and aliased

Every output comes in two views, side by side:

- **The bare view** names every tool by its upstream name, the name the server declares: `get_data`, `search_indicators`, `ckan__search_datasets`. It is 0.1.0's output: `mcpTools`, `mcpToolsFor`, `offeredMcpTools`, `buildSystemPrompt`, `withPortalLockGuidance` and the rest, unchanged.
- **The aliased view** names every tool `<alias>__<upstream name>`: `socrata__get_data`, `data_commons__search_indicators`, `boston__ckan__search_datasets`. Each bare function has an `aliased*` sibling: `aliasedMcpTools`, `aliasedMcpToolsFor`, `aliasedOfferedMcpTools`, `aliasedWithheldToolNames`, `aliasedBuildSystemPrompt`, `aliasedPortalLockGuidance`, `aliasedWithPortalLockGuidance`.

The alias exists so that two sources may declare the same tool name: Socrata's `search` and a fourth source's `search` become `socrata__search` and `<alias>__search`. The wire call to each server still uses the server's own name.

How text names a tool in each view:

- **Text this package owns** (the prompt frame, the three civic blocks, the lock section, every tool and parameter description) names each tool through `SourceView.toolName`. The bare view gives today's bytes; the aliased view gives the exposed name wherever a tool is named. Each mention of `search` or `fetch` was read and decided: the English uses ("a web search", "fetch the next page") stay words, and `src/aliased-view.test.ts` pins every one left.
- **Text a source sends** (the Socrata guidance the consumer fetches, a server's initialize instructions) gets the anchored rewrite, scoped to that source's own tool names: an exact backtick, bold or double-quoted token, an exact table cell, or an item of a `Tools:` list is renamed, and nothing else changes. A name at no anchor (the Socrata guidance's fenced `Tool: get_data` and its header cell "get_data coverage") stays bare; the dispatch rule covers a model that calls it.

The aliased view is reversible: `unaliasText(map, text)` undoes it mechanically, and for the 42 captured prompts and the 5 captured tools arrays it gives the bare bytes exactly.

```ts
import { civicRouter, readMcpEnv } from '@typedstandards/civic-typed-router';

const configured = readMcpEnv(configurationVariables);
const tools = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(lockedPortal), configured);
const prompt = civicRouter.aliasedWithPortalLockGuidance(
  await civicRouter.aliasedBuildSystemPrompt({ portal, configured, today, publicationHost, fetchPrompt, fetchInstructions }),
  lockedPortal,
  configured,
);

// The model called a tool:
const call = civicRouter.resolveCalledName(calledName, configured);
if (call.ok) send(call.sourceId, call.upstreamName, args);
else refuse(call.message); // names the candidates
```

## Names, the checks and dispatch

**The naming contract** (ADR-0032):

- An exposed name is `<alias>__<upstream name>`, matches `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`, and is at most 64 characters.
- An upstream name outside that set is **normalized**, deterministically: each character outside `[A-Za-z0-9_-]` becomes `_` (one per code point), and a name over 64 characters is cut to 55 and ends in `_` and an eight-character hash of the name it came from (FNV-1a, the same on every run and platform). Both names are kept in the dispatch map.
- An **alias** starts with a letter or an underscore, holds only `[A-Za-z0-9_-]`, contains no `__`, and is at most 32 characters. It is the operator's own, so an ill-formed alias is refused, never normalized.

**The startup checks.** `createCivicRouter(manifest)` runs `checkToolNames` (an ill-formed alias, an alias or a source id two entries share, two tools whose exposed names collide after normalizing) and `assertUniqueToolNames` over the exposed names, then builds the dispatch map. A manifest that fails is refused with every problem named (`ToolNameError`, `DuplicateToolNameError`). Two sources may declare the same upstream name: their exposed names differ.

**The dispatch map** (`router.dispatchMap`, `dispatchMap(manifest)`) maps each exposed name to `{ exposedName, sourceId, alias, upstreamName, normalized }`. Dispatch reads it; it never splits a name, because an upstream name may itself hold `__` (`ckan__search_datasets`). `upstreamToolName(name)` and `sourceForAliasedName(name)` read it too.

**The dispatch rule** (`resolveCalledName(name, configured, selection?)`): an exposed name resolves by the map. A bare upstream name is accepted when exactly one offered source has it, and refused, naming every aliased form, when two or more do. A name only a source the run is not offered has, and a name no source has, are refused.

Per call, a record can then hold the exposed name, the upstream name and the alias from the map, beside the server's identity.

## The selection

The composition and the offered tools take an explicit selection of source ids, `selection?: readonly string[]`. Absent (the default) it is every source the configuration offers, and every output is the one it was before the selection existed. A selection narrows the configured sources; it never adds one. `sourcesOffered(configured, selection?)` states each source's reason, as a record will:

| Reason | When |
|---|---|
| `configured` | the configuration offers the source and no selection was passed |
| `selected` | the configuration offers it and the selection names it |
| `not-selected` | the configuration offers it and the selection does not name it |
| `not-configured` | the configuration does not offer it, whatever the selection says |

Precedence: the configuration first. A selection id the manifest does not hold is ignored. There is no request field; the selection is the consumer's parameter.

## The pure-move contract, and the website at d1919a8

0.1.0 moved what the reference website (`npstorey/civic-ai-tools-website`) wired in six files into this package without changing an output. The bare view keeps that contract against the website at commit **`d1919a86cc826c0870c8cfbc4c902791c6f9086d`**: given the same configuration and the same inputs, it produces the tools array and the composed system prompt the website produced there, byte for byte. (0.1.0 was captured at `3a0c894`; 0.2.0 brings the civic text up to `d1919a8`: San Francisco's portal as `data.sf.gov`, and the Data Commons text and schemas that take places by name and offer only the arguments the server reads.)

The bar is `src/__fixtures__/app-goldens.json`, captured by running the website's own exported functions at that commit:

- 42 composed prompts, each `withPortalLockGuidance(await buildSystemPrompt(portal), lockedPortal)` over Boston OpenContext configured or not, the run portal and the one-portal lock, the Socrata guidance fetched or failed, each server's instructions present or absent, and the publication host set or not, plus five value cases;
- 5 tools arrays, each `offeredMcpTools(mcpToolsFor(lockedPortal))`, and four aliases of them;
- the facts: tool to source, the offered sources and withheld tools, and the configuration reading at its edges.

`src/router-goldens.test.ts` reproduces every one through the package entry, with each capture's own inputs, and checks that the fetcher calls each prompt makes are the calls the website made, in order. It then runs everything again with every entry's `id` and `alias` replaced, to show that `id` is never read and that the bare view does not read `alias` (only the startup checks and the aliased view do).

The website-side moves, file by file (0.1.0):

| Website file at `3a0c894` | Here |
|---|---|
| `src/lib/mcp/registry.ts`: the sources, `readMcpEnvFromProcess`, `withheldToolNames`, `isSourceOffered` | the manifest entries; `readMcpEnv` (`src/civic/env.ts`); selection in `src/core/select.ts` |
| `src/lib/mcp/tools.ts`: the schemas, the one-portal rewrites, `offeredMcpTools` | each source's `*_TOOLS`; `src/civic/portal-lock.ts`; `offerTools` in core |
| `src/lib/mcp/socrata-skill.ts`: the composer, the preamble, intro and outro, `SOCRATA_SKILL_FALLBACK`, the portal table, the lock section | the join in `src/core/compose.ts`; every sentence in `src/civic/` |
| `src/lib/mcp/operation-types.ts`: the tool-to-source map | `toolSourceIndex`, derived from the schemas |
| `src/lib/mcp/data-commons-skill.ts`, `boston-skill.ts`: the embedded guidance | `dataCommonsSkill(publicationHost, view?)`, `bostonSkill(view?)` (`BOSTON_OPENCONTEXT_SKILL` in the bare view) |

Not moved: the website's network client, its endpoint routing (address normalization, request headers, the per-call refusal of an unconfigured source), the operation-type labels, and its logging.

## What the consumer supplies

**The router reads no clock, holds no cache and reads no environment.** Everything the website read from those arrives as an input:

| Input | Where the website got it |
|---|---|
| `today` (`YYYY-MM-DD`) | `new Date()` at call time |
| `publicationHost` (`string \| null`), which the Data Commons guidance names | its environment, when the module loaded |
| `configured`: the result of `readMcpEnv(source)` over a plain object of configuration variables | its process environment |
| `fetchPrompt(name, args)`: returns the text or throws | its MCP client's `callMcpPrompt` |
| `fetchInstructions(sourceId)`: returns the text or `null` | its MCP client's `getServerInstructions` |

The Socrata block calls `fetchPrompt('skill-guidance', { modality: 'web' })`. A throw puts `SOCRATA_SKILL_FALLBACK` in its place; an empty string is used as it is. A `fetchInstructions` that throws leaves that source's block out. `selection` is optional (above).

**Any cache belongs to the consumer's fetcher.** The website kept the Socrata guidance for five minutes. Its cache stored an empty result but never served one (it tested the cached text for truthiness), so an empty answer was fetched again on every prompt. A consumer that reproduces the cache decides whether to keep that behaviour; the router does not see it.

```ts
import { civicRouter, readMcpEnv } from '@typedstandards/civic-typed-router';

const configured = readMcpEnv(configurationVariables);
const tools = civicRouter.offeredMcpTools(civicRouter.mcpToolsFor(lockedPortal), configured);
const prompt = civicRouter.withPortalLockGuidance(
  await civicRouter.buildSystemPrompt({ portal, configured, today, publicationHost, fetchPrompt, fetchInstructions }),
  lockedPortal,
  configured,
);
```

That is the bare view; the aliased view is the same calls through the `aliased*` siblings (above). `createCivicRouter(manifest)` builds a router over another manifest: the three sources, or more.

## Layout: a domain-free core and its civic content

| Directory | What it holds |
|---|---|
| `src/core/` | The manifest entry type, selection by configuration and by an explicit selection, the composer's join, the offered-tools filter, the tool-to-source index, two validations (duplicate tool names; a routing list against its schemas), and the naming layer (`alias.ts`: exposed names and their normalization, the checks, the dispatch map and rule, the views, the anchored rewrite and its reverse). No source text: every sentence arrives as a value. |
| `src/civic/` | The three entries (schemas and guidance texts as functions of the view, `SOCRATA_SKILL_FALLBACK`, the portal table), the one-portal rewrites and lock section, the intro, preamble and outro, and the configuration reader. |

`src/civic/` may import `src/core/`; `src/core/` imports nothing from `src/civic/` and nothing from any package. `src/boundary.test.ts` enforces this, so extracting the core later as `@typedstandards/typed-router` (the reserved name) is a directory move. `src/index.ts` exports both.

### A manifest entry

`id` (the source's global identity: its MCP Registry name where it is published there, otherwise its package or service name and address), `alias` (`socrata`, `data_commons`, `boston`: the prefix of the source's exposed names), `sourceId` (the key the source is routed, traced and recorded under), the display name, `description`, `freshness` and `freshnessSource` (below), the configuration (address variable, key variable, required or optional, default address), the tool schemas (and `toolsFor(view)` when the package owns their text), the routing list of tool names, and the guidance entry. Nothing reads `id`.

**`description`** (required) is one line written for routing: what the source covers, for which places, and what it cannot do, with no build or status notes. **`freshness`** (required) is one line on how current the data is; it is model-facing, so it carries no citation. **`freshnessSource`** is that citation: a public source, never a deployment's address, and never model-facing. The bare and aliased prompts of the three civic sources do not read either line (their preamble entries keep their own text); a fourth source's preamble entry is composed from its `displayName` and `description`.

A civic entry may also carry `prompt` (its preamble entry in a view, its outro citation, and how the lock section names it) and `portalLock` (the one-portal rewrite of its tools and the lock section). An entry without `prompt` gets each part composed: the preamble entry `**<displayName>** — <description> Tools: <its tools, in the view>.`, the citation `the identifiers its tools return (for <displayName>)`, and its `displayName` in the lock section. The count word continues past three. So a fourth source composes with no `undefined` anywhere.

| Source | `id` | Where it comes from |
|---|---|---|
| Socrata | `socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server` | Package name and repository; the server declares no `mcpName` and is not in the MCP Registry |
| Google Data Commons | `datacommons-mcp@https://github.com/datacommonsorg/agent-toolkit` | The server package's PyPI metadata (name and homepage), which declares no MCP Registry name |
| Boston OpenContext | `opencontext@https://data-mcp.boston.gov/mcp` | Service name and address: the deployment's own metadata could not be read when the entry was written |

The three routing lines, as the entries carry them:

| Source | `description` | `freshness` |
|---|---|---|
| Socrata | Socrata open data portals: records that cities and states publish, such as 311 requests, building permits, inspections, crime, housing violations, payroll, licenses and transit ridership. Covers NYC, Chicago, SF, Seattle, LA, state portals such as data.ny.gov, and hundreds of other portals. Cannot reach Boston's city data, and returns only the datasets each portal's publisher posts, so it is not the source for census demographics. | Live: queries reach the portal when they are made (a dataset's metadata or a single record may be reused for up to five minutes); each dataset updates on its publisher's schedule. |
| Google Data Commons | Google Data Commons: statistical series from the U.S. Census Bureau (ACS, Decennial), BLS, CDC, the Department of Education, EPA and other official agencies, for countries, states, counties, cities, census tracts and ZIP code areas. Cannot return city operational records such as 311 requests, permits or inspections, and has no figures for city-drawn areas such as community districts, council districts or neighborhoods. | Live API over published statistical releases: a figure changes only when an agency publishes a new release, and each carries its release vintage (the ACS releases annually). |
| Boston OpenContext | Boston OpenContext: the City of Boston's open data on data.boston.gov, from its CKAN data store: 311 requests, permits, crime, inspections, property, elections, schools, parcels and neighborhoods. Boston's city data is here, not on Socrata. Covers the City of Boston only, and holds no census statistics. | Live: each call queries the CKAN data store behind data.boston.gov; each dataset updates on the City's schedule (311 daily, crime weekly, assessor annually). |

Not carried yet: hosting and variants, the logging posture, a pinned package version, and a server's tool-list mode.

### Two semantics kept from the website

- `getSkillForPortal` and the tool-to-source index look a key up on a plain object, so a key that is also an `Object.prototype` property (`constructor`) reads that property. The goldens do not cover such inputs; the behaviour is kept, and pinned by a test, so that changing it is a decision.
- Boston OpenContext's routing list orders its six tools differently from its schemas. The tools array follows the schemas; the withheld-tools list follows the routing list.

## Purity

No Node built-ins, no environment, no network, no logging, no clock and no RNG anywhere in shipped source; no `openai` import anywhere in the package; no runtime dependency. Enforced twice: `eslint.config.mjs` and `src/purity.test.ts`. The tool-schema type is structural (a JSON-schema shape), so a consumer's own tool type with that shape is accepted without an import.

## Re-running the captures

The two scripts beside the fixtures are Node programs and are excluded from the package's build, lint and purity checks. From the repository root, with a local clone of the website:

```sh
node packages/civic-typed-router/src/__fixtures__/capture-app-goldens.mjs \
  --website <path to the website clone> \
  --commit d1919a86cc826c0870c8cfbc4c902791c6f9086d \
  --capture-date 2026-10-15 \
  --out /tmp/app-goldens.json
cmp /tmp/app-goldens.json packages/civic-typed-router/src/__fixtures__/app-goldens.json
```

It exports the commit with `git archive` and changes no file in the clone. With the commit and capture date of the committed fixture, the output is byte-identical to it. Without `--out` it overwrites the committed fixture, whose bytes are this package's acceptance bar: regenerate it only on purpose, from a stated website commit.

`socrata-guidance.json` is the Socrata guidance the website fetches, pinned from a socrata-mcp-server clone at a stated commit (`BASE_SKILL`, the separator, then `WEB_SKILL`), with its origin and the comparison against the hub's `docs/skills/base.md` and `web.md`:

```sh
node packages/civic-typed-router/src/__fixtures__/pin-socrata-guidance.mjs \
  --server <path to the socrata-mcp-server clone> \
  --commit 3163601d8c96b17246e8e63599ae0b9e1f0c0c29 \
  --out /tmp/socrata-guidance.json
cmp /tmp/socrata-guidance.json packages/civic-typed-router/src/__fixtures__/socrata-guidance.json
```

It reads the two modules with `git show` and extracts each template literal with the hub's drift checker, which parses and never evaluates them.

## Develop

Run the root fanout from the repository root (the Commands table in `AGENTS.md` is the list), or this package's own scripts from here. The test script runs `node --test --experimental-strip-types`, which needs Node 22.6 or later.
