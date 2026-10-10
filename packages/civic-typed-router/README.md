# @typedstandards/civic-typed-router

The civic MCP router for applications built on [Typed Standards](../../docs/architecture/typed-standards-specification.md): one manifest of three sources (Socrata open data portals, Google Data Commons, Boston OpenContext), each with its tool schemas and its guidance, and the two outputs a model run needs from them, the tools array and the composed system prompt. Its landing is recorded in [ADR-0031](../../docs/adr/0031-civic-typed-router-packaging.md).

## The pure-move contract

0.1.0 moves what the reference website (`npstorey/civic-ai-tools-website`) wired in six files into this package without changing an output. Given the same configuration and the same inputs, the package produces the tools array and the composed system prompt the website produced at commit **`3a0c894701e8e75161c85c567eb1c11efc06da71`**, byte for byte.

The bar is `src/__fixtures__/app-goldens.json`, captured by running the website's own exported functions at that commit:

- 42 composed prompts, each `withPortalLockGuidance(await buildSystemPrompt(portal), lockedPortal)` over Boston OpenContext configured or not, the run portal and the one-portal lock, the Socrata guidance fetched or failed, each server's instructions present or absent, and the publication host set or not, plus five value cases;
- 5 tools arrays, each `offeredMcpTools(mcpToolsFor(lockedPortal))`, and four aliases of them;
- the facts: tool to source, the offered sources and withheld tools, and the configuration reading at its edges.

`src/router-goldens.test.ts` reproduces every one through the package entry, with each capture's own inputs, and checks that the fetcher calls each prompt makes are the calls the website made, in order. It then runs everything again with every entry's `id` and `alias` replaced, to show that neither is read.

The website-side moves, file by file:

| Website file at `3a0c894` | Here |
|---|---|
| `src/lib/mcp/registry.ts`: the sources, `readMcpEnvFromProcess`, `withheldToolNames`, `isSourceOffered` | the manifest entries; `readMcpEnv` (`src/civic/env.ts`); selection in `src/core/select.ts` |
| `src/lib/mcp/tools.ts`: the schemas, the one-portal rewrites, `offeredMcpTools` | each source's `*_TOOLS`; `src/civic/portal-lock.ts`; `offerTools` in core |
| `src/lib/mcp/socrata-skill.ts`: the composer, the preamble, intro and outro, `SOCRATA_SKILL_FALLBACK`, the portal table, the lock section | the join in `src/core/compose.ts`; every sentence in `src/civic/` |
| `src/lib/mcp/operation-types.ts`: the tool-to-source map | `toolSourceIndex`, derived from the schemas |
| `src/lib/mcp/data-commons-skill.ts`, `boston-skill.ts`: the embedded guidance | `dataCommonsSkill(publicationHost)`, `BOSTON_OPENCONTEXT_SKILL` |

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

The Socrata block calls `fetchPrompt('skill-guidance', { modality: 'web' })`. A throw puts `SOCRATA_SKILL_FALLBACK` in its place; an empty string is used as it is. A `fetchInstructions` that throws leaves that source's block out.

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

`createCivicRouter(manifest)` builds the same router over another manifest of the same sources.

## Layout: a domain-free core and its civic content

| Directory | What it holds |
|---|---|
| `src/core/` | The manifest entry type, selection by configuration (required and optional sources), the composer's join, the offered-tools filter, the tool-to-source index, and two validations (duplicate tool names; a routing list against its schemas) that 0.1.0 defines but does not invoke. No source text: every sentence arrives as a value. |
| `src/civic/` | The three entries (schemas, guidance texts, `SOCRATA_SKILL_FALLBACK`, the portal table), the one-portal rewrites and lock section, the intro, preamble and outro, and the configuration reader. |

`src/civic/` may import `src/core/`; `src/core/` imports nothing from `src/civic/` and nothing from any package. `src/boundary.test.ts` enforces this, so extracting the core later as `@typedstandards/typed-router` (the reserved name) is a directory move. `src/index.ts` exports both.

### A manifest entry

`id` (the source's global identity: its MCP Registry name where it is published there, otherwise its package or service name and address), `alias` (`socrata`, `data_commons`, `boston`), `sourceId` (the key the source is routed, traced and recorded under), the display name, the configuration (address variable, key variable, required or optional, default address), the tool schemas, the routing list of tool names, and the guidance entry. 0.1.0 carries `id` and `alias` and reads neither.

| Source | `id` | Where it comes from |
|---|---|---|
| Socrata | `socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server` | Package name and repository; the server declares no `mcpName` and is not in the MCP Registry |
| Google Data Commons | `datacommons-mcp@https://github.com/datacommonsorg/agent-toolkit` | The server package's PyPI metadata (name and homepage), which declares no MCP Registry name |
| Boston OpenContext | `opencontext@https://data-mcp.boston.gov/mcp` | Service name and address: the deployment's own metadata could not be read when the entry was written |

Not carried yet: hosting and variants, the logging posture, a pinned package version, and identity applied to tool names.

### Two semantics kept from the website

- `getSkillForPortal` and the tool-to-source index look a key up on a plain object, so a key that is also an `Object.prototype` property (`constructor`) reads that property. The goldens do not cover such inputs; the behaviour is kept, and pinned by a test, so that changing it is a decision.
- Boston OpenContext's routing list orders its six tools differently from its schemas. The tools array follows the schemas; the withheld-tools list follows the routing list.

## Purity

No Node built-ins, no environment, no network, no logging, no clock and no RNG anywhere in shipped source; no `openai` import anywhere in the package; no runtime dependency. Enforced twice: `eslint.config.mjs` and `src/purity.test.ts`. The tool-schema type is structural (a JSON-schema shape), so a consumer's own tool type with that shape is accepted without an import.

## Re-running the capture

The capture script beside the fixture is a Node program and is excluded from the package's build, lint and purity checks. From the repository root, with a local clone of the website:

```sh
node packages/civic-typed-router/src/__fixtures__/capture-app-goldens.mjs \
  --website <path to the website clone> \
  --commit 3a0c894701e8e75161c85c567eb1c11efc06da71 \
  --capture-date 2026-10-10 \
  --out /tmp/app-goldens.json
cmp /tmp/app-goldens.json packages/civic-typed-router/src/__fixtures__/app-goldens.json
```

It exports the commit with `git archive` and changes no file in the clone. With the commit and capture date of the committed fixture, the output is byte-identical to it. Without `--out` it overwrites the committed fixture, whose bytes are this package's acceptance bar: regenerate it only on purpose, from a stated website commit.

## Develop

Run the root fanout from the repository root (the Commands table in `AGENTS.md` is the list), or this package's own scripts from here. The test script runs `node --test --experimental-strip-types`, which needs Node 22.6 or later.
