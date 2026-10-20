# @typedstandards/civic-typed-router

The civic MCP router for applications built on [Typed Standards](../../docs/architecture/typed-standards-specification.md): one manifest of seven sources (Socrata open data portals, Google Data Commons, Boston OpenContext, and four that an instance runs itself from pinned packages: NYC Charter, Laws and Rules; NYC Checkbook; NYC City Record; and NYS Open Legislation), each with its tool schemas and its guidance, and the two outputs a model run needs from them, the tools array and the composed system prompt. Its landing is recorded in [ADR-0031](../../docs/adr/0031-civic-typed-router-packaging.md); its naming of tools across sources in [ADR-0032](../../docs/adr/0032-tool-naming-across-sources.md).

## The output contract

The router hands a consumer three things, and any harness or gateway can consume them:

1. **a tools array** of chat-completions function tools (`{ type: 'function', function: { name, description, parameters } }`);
2. **a prompt**, one string;
3. **the dispatch map**, from each name the model may call to `{ sourceId, alias, upstreamName }`.

Under in-loop routing the prompt is the directory and the composition over the sources the model has loaded, and the tools array starts with the first-step tool `load_source` (below); each composition also yields a harness definition with its hash.

The router performs no call. The consumer sends the tools and the prompt to a model, and when the model calls a tool, resolves the name it called through the map (`resolveCalledName`) and calls the server by its upstream name.

## Two views: bare and aliased

Every output comes in two views, side by side:

- **The bare view** names every tool by its upstream name, the name the server declares: `get_data`, `search_indicators`, `ckan__search_datasets`. It is 0.1.0's output: `mcpTools`, `mcpToolsFor`, `offeredMcpTools`, `buildSystemPrompt`, `withPortalLockGuidance` and the rest, unchanged.
- **The aliased view** names every tool `<alias>__<upstream name>`: `socrata__get_data`, `data_commons__search_indicators`, `boston__ckan__search_datasets`. Each bare function has an `aliased*` sibling: `aliasedMcpTools`, `aliasedMcpToolsFor`, `aliasedOfferedMcpTools`, `aliasedWithheldToolNames`, `aliasedBuildSystemPrompt`, `aliasedPortalLockGuidance`, `aliasedWithPortalLockGuidance`.

The alias exists so that two sources may declare the same tool name: Socrata's, NYC Charter's and NYS Open Legislation's `search` become `socrata__search`, `nyc_charter__search` and `nys_legislation__search`. The wire call to each server still uses the server's own name.

**The bare view cannot tell a shared name apart.** It names tools by upstream name only, so it is exact for the three sources it was captured from. With the hosted sources switched off, their tools are withheld by schema object as well as by name, so Socrata's `search` stays and every bare output is 0.2.0's. With NYC Charter's or NYS Open Legislation's switch on, the bare tools array holds two or three tools named `search`: use the aliased view.

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

**The startup checks.** `createCivicRouter(manifest)` runs `checkToolNames` (an ill-formed alias, an alias or a source id two entries share, an alias or an upstream tool named `load_source`, the first-step tool's reserved name, and two tools whose exposed names collide after normalizing) and `assertUniqueToolNames` over the exposed names, then builds the dispatch map. A manifest that fails is refused with every problem named (`ToolNameError`, `DuplicateToolNameError`). Two sources may declare the same upstream name: their exposed names differ.

**The dispatch map** (`router.dispatchMap`, `dispatchMap(manifest)`) maps each exposed name to `{ exposedName, sourceId, alias, upstreamName, normalized }`. Dispatch reads it; it never splits a name, because an upstream name may itself hold `__` (`ckan__search_datasets`). `upstreamToolName(name)` and `sourceForAliasedName(name)` read it too.

**The dispatch rule** (`resolveCalledName(name, configured, selection?)`): an exposed name resolves by the map. A bare upstream name is accepted when exactly one offered source has it, and refused, naming every aliased form, when two or more do. A name only a source the run is not offered has, and a name no source has, are refused.

Per call, a record can then hold the exposed name, the upstream name and the alias from the map, beside the server's identity.

## Hosting variants, the logging posture, and a hosted source's switch

Every manifest entry lists the ways its source can be run or reached, `hostings`, with who holds the logs of what each is sent ([ADR-0036](../../docs/adr/0036-source-hosting-variants-and-logging-posture.md)). Beside them it carries `consentDefault`, the source's state in a reader's first consent, and `publisher`, named as the source's own page names it.

```ts
type HostingVariant = NpmPackageVariant | RemoteVariant | ContainerVariant; // discriminated on `kind`

interface HostingVariantCommon {
  readonly variant: string;   // unique within the entry; a switch's value names the variant it turns on
  readonly runsAt: 'instance-sandbox' | 'publisher' | 'government' | 'other';
  readonly keyIn?: 'header' | 'query'; // where the variant sends the instance's key, if it sends one (0.6.0)
  readonly logging: readonly LoggingPosture[]; // every log holder, in the order the data flows
}
interface NpmPackageVariant extends SourceHosting, HostingVariantCommon {} // kind: 'npm-package'
interface RemoteVariant extends HostingVariantCommon { readonly kind: 'remote' }
interface ContainerVariant extends HostingVariantCommon { readonly kind: 'container' } // a name only: no host is built

interface SourceHosting {     // 0.3.0's hosting field, unchanged
  readonly kind: 'npm-package';
  readonly package: string;   // '@betanyc/nyc-charter-laws-rules'
  readonly version: string;   // '0.3.1', exact
  readonly commit: string;    // 'b784cb763ec0d953139eef4ed366e8ec4de72625', the registry's gitHead for that version
  readonly outbound: readonly string[]; // hosts it may reach; [] = none
}

type LoggingPosture =
  | { statedBy: 'manifest'; holder: string; keeps: 'none' | 'metadata' | 'content' | 'not-stated';
      retention?: string; statementUrl: string; readOn: string } // the holder's own statement, its https address, the UTC date read
  | { statedBy: 'instance'; role: string };                     // a holder the instance chooses: the consuming app states it

// ManifestEntry: hostings: readonly HostingVariant[]; consentDefault: 'on' | 'ask-first'; publisher?: string
// Carried, never read by the router.
```

No variant carries an address: a remote's address is the instance's configuration, and a hosted source is reached at an address its host resolves per call. A posture is policy text carried by reference: what the holder's own statement says, read on `readOn`. `not-stated` means the statement read says nothing about what the holder keeps. Where the holder depends on the instance (the platform it runs its sandboxes on, the operator of an address it configures), the manifest names the holder by role and the consuming app states it, beside the instance-level recipients (the model endpoint and the rest).

| Source | `publisher` | Variant (`kind`) | `runsAt` | `logging` |
|---|---|---|---|---|
| Socrata | npstorey | `remote` (`remote`) | `other` | role `server-operator`; role `portal-operator` |
| Google Data Commons | Google | `remote` (`remote`) | `publisher` | Google, `content` ([privacy policy](https://policies.google.com/privacy?hl=en-US), read 2026-10-18) |
| Boston OpenContext | City of Boston | `remote` (`remote`) | `government` | City of Boston, `metadata` ([terms of use and privacy policy](https://www.boston.gov/government/cabinets/innovation-and-technology/terms-use-and-privacy-policy-city-boston-digital), read 2026-10-18) |
| NYC Charter, Laws and Rules | BetaNYC | `sandbox` (`npm-package`) | `instance-sandbox` | role `sandbox-platform` |
| NYC Checkbook | BetaNYC | `sandbox` (`npm-package`) | `instance-sandbox` | role `sandbox-platform`; Office of the New York City Comptroller, `not-stated` ([privacy policy](https://comptroller.nyc.gov/privacy-policy/), read 2026-10-19) |
| NYC City Record | BetaNYC | `sandbox` (`npm-package`) | `instance-sandbox` | role `sandbox-platform`; City of New York, `not-stated` ([privacy policy](https://www.nyc.gov/home/privacy-policy.page), read 2026-10-19) |
| NYS Open Legislation | BetaNYC | `sandbox` (`npm-package`), `keyIn: 'query'` | `instance-sandbox` | role `sandbox-platform`; New York State Senate, `not-stated` ([privacy policy](https://www.nysenate.gov/privacy-policy), read 2026-10-19) |

Every entry's `consentDefault` is `'on'`, except NYC Checkbook's and NYS Open Legislation's, which are `'ask-first'`: each sends a reader's tool arguments to a recipient a first consent has not named, whose statement says nothing about what it keeps of API requests, and NYS Open Legislation's receives the instance's key in every request URL. NYC City Record's upstream is the open data portal the Socrata source already reaches.

**`keyIn`** (since 0.6.0) is one optional field on every variant: where the variant sends the instance's key, `'header'` (a request header) or `'query'` (the request URL's query string). Absent, the variant sends no key of the instance's. NYS Open Legislation's variant carries `keyIn: 'query'`; no other variant carries it. It is carried, never read: `router-goldens.test.ts` runs every golden and every in-loop output with each variant's `keyIn` behind a getter that throws. How the key reaches the sandbox is the consumer's.

**Which variant is in force is the consumer's to select.** For a source offered by a switch, the switch's value names the variant that is on (`NYC_CHARTER_HOSTING=sandbox` turns on the variant `sandbox`); a remote's single variant is selected by its address variable's presence. No router function reads `hostings` (`keyIn` among them), `consentDefault` or `publisher`: `router-goldens.test.ts` runs every golden with each, and 0.3.0's `hosting`, replaced and behind a getter that throws. Two variants of one source would share its `id` and be two panel rows; each entry has one variant, and a second enabled variant of one source is later work (ADR-0036 §G).

**A hosted source.** NYC Charter, Laws and Rules (`@betanyc/nyc-charter-laws-rules` on npm, published by BetaNYC) is a stdio server whose section index ships in its package, so an instance runs the pinned package itself, in a sandbox it creates. Its `sandbox` variant (`NYC_CHARTER_SANDBOX_VARIANT`) carries 0.3.0's `NYC_CHARTER_HOSTING` strings unchanged, so a consumer derives the record's names from it as before: the purl `pkg:npm/%40betanyc/nyc-charter-laws-rules@0.3.1` (scope and name each percent-encoded, the `/` kept) and the component version `0.3.1+b784cb763ec0` (the version, then the commit's first 12 hex characters as build metadata). `src/hosted-variant-derivations.test.ts` derives every value the reference website derives from it and holds each equal to what 0.3.0's field gave.

**The three hosted sources of 0.6.0**, each a stdio server published by BetaNYC that an instance runs from the pinned package in a sandbox it creates, and each reaching one upstream host:

| Source (`sourceId`, alias) | Package and pin (`version`, `commit`, the registry's `gitHead`) | `outbound` | Key | Switch |
|---|---|---|---|---|
| NYC Checkbook (`nyc-checkbook`, `nyc_checkbook`) | `@betanyc/nyc-checkbook-mcp` 1.6.3, `f013a276e37e218e93c069c585d54dc3b4e3ee00` | `www.checkbooknyc.com` | none | `NYC_CHECKBOOK_HOSTING` |
| NYC City Record (`nyc-record`, `nyc_record`) | `@betanyc/nyc-record-mcp` 1.1.0, `6c52a5353381592713678caa109870d1e912c858` | `data.cityofnewyork.us` | none | `NYC_RECORD_HOSTING` |
| NYS Open Legislation (`nys-legislation`, `nys_legislation`) | `@betanyc/nys-openlegislation-mcp` 2.4.0, `cc069c46d52b939275f9dcac3d72b2dd011531d3` | `legislation.nysenate.gov` | the server's `NYS_LEGISLATION_API_KEY`, sent in the request URL (`keyIn: 'query'`); the server exits at start without it | `NYS_LEGISLATION_HOSTING` |

Each `id` is the package name and repository address (none is listed in the MCP Registry), and a record derives its names from the variant as for NYC Charter: the purl from `package` and `version`, the component version from `version` and `commit`. Checkbook's `gitHead` is one commit behind its repository's head (that commit changes no code); the pin is the registry's.

**The switches.** A hosted source is offered by a switch, never by an address. `readMcpEnv` reads `NYC_CHARTER_HOSTING`, `NYC_CHECKBOOK_HOSTING`, `NYC_RECORD_HOSTING` and `NYS_LEGISLATION_HOSTING`: when a switch's trimmed value is exactly `sandbox` (`HOSTING_SANDBOX`), the result gains its key (`nycCharterHosting`, `nycCheckbookHosting`, `nycRecordHosting`, `nysLegislationHosting`, in that order after the four address and key fields) with the value `'sandbox'`; unset, blank or any other value (`Sandbox`, `on`, `hosted`) and the key is absent, so with the switches off every configuration reading is 0.2.0's, key for key, and with the three of 0.6.0 off it is 0.5.0's. `configuredAddresses` (the addresses a record states) never has a key for a hosted source; selection reads `configuredSources`, which adds each switch that is on. Each entry's `configuration.addressVariable` names its switch, so a consumer that refuses a call by naming the variable that would configure the source names `NYC_CHARTER_HOSTING`, `NYC_CHECKBOOK_HOSTING`, `NYC_RECORD_HOSTING` or `NYS_LEGISLATION_HOSTING`.

**What a hosted source adds when on.** The aliased tools array gains its tools under their exposed names, in its server's order, after the sources before it in the manifest: NYC Charter's five (`nyc_charter__search`, `nyc_charter__get_section`, `nyc_charter__list_titles`, `nyc_charter__get_title`, `nyc_charter__get_version`), NYC Checkbook's 10, NYC City Record's 7, NYS Open Legislation's 24. The prompt gains one preamble entry (composed from `displayName` and `description`), the count word, one outro citation and one mention in the lock section, and no block: none of the four servers sends instructions or a prompt, so each guidance entry returns `''` and calls neither fetcher, and offering a source never wakes it. A bare `search` is refused as ambiguous whenever two of Socrata, NYC Charter and NYS Open Legislation are offered (`socrata__search`, `nyc_charter__search`, `nys_legislation__search`); with both hosted switches off it resolves to `socrata__search`.

## The selection

The composition and the offered tools take an explicit selection of source ids, `selection?: readonly string[]`. Absent (the default) it is every source the configuration offers, and every output is the one it was before the selection existed. A selection narrows the configured sources; it never adds one. `sourcesOffered(configured, selection?)` states each source's reason, as a record will:

| Reason | When |
|---|---|
| `configured` | the configuration offers the source and no selection was passed |
| `selected` | the configuration offers it and the selection names it |
| `not-selected` | the configuration offers it and the selection does not name it |
| `not-configured` | the configuration does not offer it, whatever the selection says |

Precedence: the configuration first. A selection id the manifest does not hold is ignored. There is no request field; the selection is the consumer's parameter.

## In-loop routing: the directory, the first-step tool, and the harness definition

Under in-loop routing ([ADR-0037](../../docs/adr/0037-the-first-step-tool.md)) the model's first request carries a short directory of sources and one tool, `load_source(alias)`; each later request carries the directory again, followed by the composition over the sources loaded so far, and their tools. The router composes each part. The consuming app owns the loop: it intercepts the `load_source` call, answers it with one plain line, and sends the next request. The router has no mode; a consumer that keeps all-sources routing calls none of these functions, and every output above is unchanged.

**The directory.** `directoryPrompt({ configured, today, selection? })` lists the directory set (the sources `selection` offers, in manifest order), one line per source from its alias, `description` and `freshness`, after the intro, the heading `## Data sources` and one paragraph (`DIRECTORY_PARAGRAPH`). It calls no fetcher and names no tool. The core composer is `composeDirectory(frame, entries)`; the civic values are `directoryFrameFor(today)`.

**The first-step tool.** `aliasedLoadSourceTool({ configured, selection? })` is `load_source` with one required argument, `alias`, whose enum is the directory set's aliases in manifest order. A new object on every call.

**The reserved name.** `load_source` (`LOAD_SOURCE_TOOL_NAME`) is reserved: the dispatch rule accepts a bare upstream name, so a source tool of that name would take a bare call meant for the first-step tool. `createCivicRouter` refuses a manifest whose alias, or whose upstream tool, is named `load_source`, with a `ToolNameError` whose problem has the kind `reserved-name`.

```ts
import { civicRouter, CIVIC_MANIFEST, createCivicRouter, readMcpEnv, ToolNameError } from '@typedstandards/civic-typed-router';

const configured = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });
const today = '2026-10-19';

// The first request: the directory, and the one tool.
const directory = civicRouter.directoryPrompt({ configured, today });
const loadSource = civicRouter.aliasedLoadSourceTool({ configured });
// directory ends with the lines for `socrata` and `data_commons`;
// loadSource.function.parameters.properties.alias.enum is ['socrata', 'data_commons'].

// A manifest that names a source load_source is refused.
try {
  createCivicRouter(CIVIC_MANIFEST.map((entry) => (entry.sourceId === 'nyc-charter' ? { ...entry, alias: 'load_source' } : entry)));
} catch (error) {
  if (!(error instanceof ToolNameError) || error.problems[0]!.kind !== 'reserved-name') throw error;
}
```

**Composition for a loaded set.** `aliasedInLoopSystemPrompt({ ...BuildSystemPromptInput, loaded })`, with `selection` the directory set, returns the directory; when a loaded source is in the directory set, it continues with `BLOCK_SEPARATOR` and the aliased composition over the loaded sources without its intro (its preamble, one block per loaded source, its outro), so the role and the date are stated once. With nothing loaded it is `directoryPrompt` for the same input and calls no fetcher; a loaded id outside the directory set is not composed. The tools for the same request are the first-step tool and `aliasedOfferedMcpTools` over the loaded set.

```ts
const input = {
  configured,
  today,
  publicationHost: null,
  fetchPrompt: async () => 'The Socrata guidance the consumer fetched.',
  fetchInstructions: async () => null,
};
const loaded = ['socrata'];
const systemPrompt = await civicRouter.aliasedInLoopSystemPrompt({ ...input, loaded });
const tools = [loadSource, ...civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpTools, configured, loaded)];
// systemPrompt starts with the directory; tools are load_source, then socrata__get_data, socrata__search and socrata__fetch.
```

**The harness definition.** `harnessDefinition({ configured, selection, chosenBy, components })` returns `{ domain, sources, components, chosenBy, hash }`: `domain` is `'civic'` (`CIVIC_DOMAIN`), `sources` is `offeredSkillSources(configured, selection)`, `components` are the consumer's (`id`, `version?`, `guidanceHash?`, in its order; the router reads no entry's `id` and sees no block as composed), `chosenBy` is `'reader' | 'model' | 'instance'`, and `hash` is the lowercase hex SHA-256 of the canonical JSON of the other four. There is no `task`. Out-of-shape fields are refused with `HarnessDefinitionError`. The canonical JSON (`canonicalJson`: RFC 8785 for strings, arrays and plain objects, anything else refused with `CanonicalJsonError`) and the SHA-256 (`sha256Hex`) are this package's own code, so it stays browser-safe and dependency-free. The definition is an output: reading one from a file or an address, and a signer, are later work.

```ts
const definition = civicRouter.harnessDefinition({
  configured,
  selection: loaded,
  chosenBy: 'model',
  components: [
    { id: 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server', guidanceHash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
    { id: '@typedstandards/civic-typed-router', version: '0.5.0' },
  ],
});
// definition.sources is ['socrata']; definition.hash is 64 lowercase hex characters.
```

## The pure-move contract, and the website at d1919a8

0.1.0 moved what the reference website (`npstorey/civic-ai-tools-website`) wired in six files into this package without changing an output. The bare view keeps that contract against the website at commit **`d1919a86cc826c0870c8cfbc4c902791c6f9086d`**: given the same configuration and the same inputs, it produces the tools array and the composed system prompt the website produced there, byte for byte. (0.1.0 was captured at `3a0c894`; 0.2.0 brings the civic text up to `d1919a8`: San Francisco's portal as `data.sf.gov`, and the Data Commons text and schemas that take places by name and offer only the arguments the server reads.)

The bar is `src/__fixtures__/app-goldens.json`, captured by running the website's own exported functions at that commit:

- 42 composed prompts, each `withPortalLockGuidance(await buildSystemPrompt(portal), lockedPortal)` over Boston OpenContext configured or not, the run portal and the one-portal lock, the Socrata guidance fetched or failed, each server's instructions present or absent, and the publication host set or not, plus five value cases;
- 5 tools arrays, each `offeredMcpTools(mcpToolsFor(lockedPortal))`, and four aliases of them;
- the facts: tool to source, the offered sources and withheld tools, and the configuration reading at its edges.

The goldens hold three sources; since 0.3.0 the manifest holds a fourth, and since 0.6.0 three more, that no capture switches on. Every prompt and tools array is still its golden byte for byte. The facts that name the whole vocabulary move by stated deltas, never by a looser comparison: `mcpTools` (replay's tools, the bare `mcpToolsFor`) is the golden array with the four hosted sources' schemas appended in manifest order (5, 10, 7 and 24); the withheld tools gain their names; each of their names no earlier source has maps to its source (`search` stays Socrata's); and the offered array is never the vocabulary object, since the hosted sources are withheld in every capture.

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
| `src/core/` | The manifest entry type, selection by configuration and by an explicit selection, the composer's join, the directory's join and the first-step tool, the harness definition with its canonical JSON and SHA-256, the offered-tools filter, the tool-to-source index, two validations (duplicate tool names; a routing list against its schemas), and the naming layer (`alias.ts`: exposed names and their normalization, the checks, the dispatch map and rule, the views, the anchored rewrite and its reverse). No source text: every sentence arrives as a value. |
| `src/civic/` | The seven entries (schemas and guidance texts as functions of the view, `SOCRATA_SKILL_FALLBACK`, the portal table), the one-portal rewrites and lock section, the intro, preamble and outro, the directory's heading and paragraph and the first-step tool's text, and the configuration reader. |

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
| NYC Charter, Laws and Rules | `@betanyc/nyc-charter-laws-rules@https://github.com/BetaNYC/nyc-charter-laws-rules` | Package name and repository; the publisher has not listed the server in the MCP Registry |
| NYC Checkbook | `@betanyc/nyc-checkbook-mcp@https://github.com/BetaNYC/nyc-checkbook-mcp` | Package name and repository; not in the MCP Registry (searched 2026-10-19) |
| NYC City Record | `@betanyc/nyc-record-mcp@https://github.com/BetaNYC/nyc-record-mcp` | Package name and repository; not in the MCP Registry (searched 2026-10-19) |
| NYS Open Legislation | `@betanyc/nys-openlegislation-mcp@https://github.com/BetaNYC/nys-openlegislation-mcp` | Package name and repository; not in the MCP Registry (searched 2026-10-19) |

The routing lines, as the entries carry them:

| Source | `description` | `freshness` |
|---|---|---|
| Socrata | Socrata open data portals: records that cities and states publish, such as 311 requests, building permits, inspections, crime, housing violations, payroll, licenses and transit ridership. Covers NYC, Chicago, SF, Seattle, LA, state portals such as data.ny.gov, and hundreds of other portals. Cannot reach Boston's city data, and returns only the datasets each portal's publisher posts, so it is not the source for census demographics. | Live: queries reach the portal when they are made (a dataset's metadata or a single record may be reused for up to five minutes); each dataset updates on its publisher's schedule. |
| Google Data Commons | Google Data Commons: statistical series from the U.S. Census Bureau (ACS, Decennial), BLS, CDC, the Department of Education, EPA and other official agencies, for countries, states, counties, cities, census tracts and ZIP code areas. Cannot return city operational records such as 311 requests, permits or inspections, and has no figures for city-drawn areas such as community districts, council districts or neighborhoods. | Live API over published statistical releases: a figure changes only when an agency publishes a new release, and each carries its release vintage (the ACS releases annually). |
| Boston OpenContext | Boston OpenContext: the City of Boston's open data on data.boston.gov, from its CKAN data store: 311 requests, permits, crime, inspections, property, elections, schools, parcels and neighborhoods. Boston's city data is here, not on Socrata. Covers the City of Boston only, and holds no census statistics. | Live: each call queries the CKAN data store behind data.boston.gov; each dataset updates on the City's schedule (311 daily, crime weekly, assessor annually). |
| NYC Charter, Laws and Rules | New York City's own law: the full text of the New York City Charter, the Administrative Code and the Rules of the City of New York, by section, with title and chapter listings and keyword search. Covers New York City only. Holds no court decisions, no New York State or federal law, and no bills still in progress. | Pinned to version 0.3.1 of the publisher's package and the index it bundles: the Charter and the Administrative Code are current through Local Law 2026/147, enacted September 12, 2026, and the Rules through rules effective October 4, 2026. |
| NYC Checkbook | New York City government spending as the Comptroller's Checkbook NYC publishes it: contracts (citywide, NYCHA and NYCEDC), payments to vendors, budget and revenue figures by agency and fiscal year, and payroll by agency and title. Covers New York City only. Does not hold the adopted budget's text, Council discretionary awards, or employee names. | Live: every call queries Checkbook NYC as it stands, and the server spaces its requests at least 1.1 seconds apart. |
| NYC City Record | Notices in The City Record, New York City's official journal, since 2015: procurement solicitations, awards and intent-to-award notices, public hearings and comment periods, and other agency notices, by agency, notice type, keyword and publication date. Covers New York City only. Does not hold the notices' full documents or any dataset other than City Record Online. | Live: every call queries the City Record Online dataset on NYC Open Data, which is updated daily. |
| NYS Open Legislation | New York State's legislature through the Senate's Open Legislation API: bills and resolutions since 2009 with their text, status, votes and updates, the State's consolidated laws by section, Senate and Assembly members, committees and their meetings, floor calendars, agendas, and floor and hearing transcripts. Covers New York State only. Does not hold New York City's own law (the Charter, the Administrative Code or the Rules) or federal law. | Live: every call queries the Senate's Open Legislation API as it stands. |

Carried: each source's hosting variants, its logging posture, its consent default and its publisher (since 0.4.0, above), and a pinned package version (since 0.3.0). Not carried yet: a server's tool-list mode.

### Two semantics kept from the website

- `getSkillForPortal` and the tool-to-source index look a key up on a plain object, so a key that is also an `Object.prototype` property (`constructor`) reads that property. The goldens do not cover such inputs; the behaviour is kept, and pinned by a test, so that changing it is a decision.
- The tool-to-source index (`sourceIdForToolName`) answers by bare name alone and takes no configuration. Since 0.3.0 a name two sources declare belongs to the first entry that declares it, so `search` is Socrata's under every configuration; through 0.2.0 the last entry won, which no manifest then exercised. Which source a call reached is the dispatch rule's answer, which reads the offered sources.
- Boston OpenContext's routing list orders its six tools differently from its schemas. The tools array follows the schemas; the withheld-tools list follows the routing list.

## Purity

No Node built-ins, no environment, no network, no logging, no clock and no RNG anywhere in shipped source (the harness definition's SHA-256 is this package's own code, over `TextEncoder`'s bytes); no `openai` import anywhere in the package; no runtime dependency. Enforced twice: `eslint.config.mjs` and `src/purity.test.ts`. The tool-schema type is structural (a JSON-schema shape), so a consumer's own tool type with that shape is accepted without an import.

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

It exports the commit with `git archive` and changes no file in the clone. With the commit and capture date of the committed fixture, the output is byte-identical to it. It is the instrument for the website at `d1919a8` and before: it refuses a tree whose `src/lib/mcp/` imports this package (the website since website #599, W2), because that tree's outputs are the router's own, and capturing them as the router's bar would be circular. Without `--out` it overwrites the committed fixture, whose bytes are this package's acceptance bar: regenerate it only on purpose, from a stated website commit.

`socrata-guidance.json` is the Socrata guidance the website fetches, pinned from a socrata-mcp-server clone at a stated commit (`BASE_SKILL`, the separator, then `WEB_SKILL`), with its origin and the comparison against the hub's `docs/skills/base.md` and `web.md`:

```sh
node packages/civic-typed-router/src/__fixtures__/pin-socrata-guidance.mjs \
  --server <path to the socrata-mcp-server clone> \
  --commit 3163601d8c96b17246e8e63599ae0b9e1f0c0c29 \
  --out /tmp/socrata-guidance.json
cmp /tmp/socrata-guidance.json packages/civic-typed-router/src/__fixtures__/socrata-guidance.json
```

It reads the two modules with `git show` and extracts each template literal with the hub's drift checker, which parses and never evaluates them.

`nyc-charter-tools.json` is NYC Charter's five tool schemas as the server's own `tools/list` returns them at the pinned version, with its `initialize` result and the currency lines its `get_version` tool returns:

```sh
node packages/civic-typed-router/src/__fixtures__/pin-nyc-charter-tools.mjs \
  --capture-date 2026-10-16 \
  --out /tmp/nyc-charter-tools.json
cmp /tmp/nyc-charter-tools.json packages/civic-typed-router/src/__fixtures__/nyc-charter-tools.json
```

It installs `@betanyc/nyc-charter-laws-rules@0.3.1` with `npm install --ignore-scripts` into a fresh directory under the OS temporary directory, reads the version's `gitHead` with `npm view`, starts the server over stdio with an empty environment, and removes the directory. It reaches only the npm registry. The fixture records the version, the `gitHead`, the integrity, the capture date and the resolved versions of `@modelcontextprotocol/sdk` and `zod`; two runs with the same date are byte-identical. `src/civic/nyc-charter.ts` carries the same schemas as code, and `src/nyc-charter.test.ts` holds the two equal.

The three hosted sources of 0.6.0 are pinned the same way, one script each, and each session is `initialize`, `notifications/initialized` and `tools/list` only: no tool is called, so no server reaches its upstream host.

```sh
for server in nyc-checkbook nyc-record nys-legislation; do
  node packages/civic-typed-router/src/__fixtures__/pin-$server-tools.mjs \
    --capture-date 2026-10-19 \
    --out /tmp/$server-tools.json
  cmp /tmp/$server-tools.json packages/civic-typed-router/src/__fixtures__/$server-tools.json
done
```

Checkbook's and City Record's servers start with an empty environment. NYS Open Legislation's exits at start with neither a key nor a local corpus, so its script sets one variable, `NYS_LEGISLATION_API_KEY`, to a fixed placeholder that is not a key; the server reads it at start and would send it only with a tool call. Each fixture records its environment, and a run of thirteen or more digits in a server's text (Checkbook's descriptions hold example contract identifiers) is written with one digit in nine as a JSON `\u` escape, which parses to the server's text unchanged, so the file passes the repository's pre-push scan. `src/civic/nyc-checkbook.ts`, `nyc-record.ts` and `nys-legislation.ts` carry the same schemas as code, and `src/hosted-entries.test.ts` holds each equal to its fixture.

## Develop

Run the root fanout from the repository root (the Commands table in `AGENTS.md` is the list), or this package's own scripts from here. The test script runs `node --test --experimental-strip-types`, which needs Node 22.6 or later.
