// The civic router: the three sources' manifest, bound to core.
//
// Each function here reproduces one of the reference website's at 3a0c894,
// with what that function read from its environment, its clock or its network
// client taken as an argument instead:
//
//   website                                   here
//   mcpTools (tools.ts:458)                   router.mcpTools
//   mcpToolsFor (tools.ts:576)                router.mcpToolsFor
//   offeredMcpTools (tools.ts:595)            router.offeredMcpTools(tools, configured)
//   withheldToolNames (registry.ts:252)       router.withheldToolNames(configured)
//   isSourceOffered (registry.ts:242)         router.isSourceOffered(configured, sourceId)
//   offeredSkillSources (socrata-skill.ts:519) router.offeredSkillSources(configured)
//   sourceIdForToolName (operation-types.ts:87) router.sourceIdForToolName
//   buildSystemPrompt (socrata-skill.ts:750)  router.buildSystemPrompt(input)
//   portalLockGuidance (socrata-skill.ts:706) router.portalLockGuidance(lockedPortal, configured)
//   withPortalLockGuidance (:729)             router.withPortalLockGuidance(prompt, lockedPortal, configured)
//   readMcpEnvFromProcess (registry.ts:330)   readMcpEnv(source), in ./env.ts
//
// Nothing here reads an entry's `id` or `alias`.

import {
  aliasedView,
  dispatchMap as buildDispatchMap,
  resolveCalledName as resolveInMap,
  sourceForAliasedName,
  upstreamToolName,
  type CalledNameResolution,
  type DispatchMap,
  type DispatchTarget,
} from '../core/alias.ts';
import { composeManifestPrompt } from '../core/compose.ts';
import {
  isEntryOffered,
  offeredEntries,
  offerTools,
  sourcesOffered,
  withheldToolNames,
  type SourceOffered,
  type SourceSelection,
} from '../core/select.ts';
import { toolSourceIndex } from '../core/tool-index.ts';
import type { FunctionToolSchema, SourceView, ToolLike } from '../core/types.ts';
import { BOSTON_OPENCONTEXT_ENTRY } from './boston.ts';
import type { CivicManifest, InstructionsFetcher, PromptFetcher } from './context.ts';
// STUB (red tree): the 0.1.0 router, with the 0.2.0 surface typed and
// delegating to the bare view. No startup check runs, the selection is
// ignored, and dispatch knows no name.
import { DATA_COMMONS_ENTRY } from './data-commons.ts';
import { configuredAddresses, type McpRegistryEnv } from './env.ts';
import { lockedFetch, lockedGetData, lockedSearch, portalLockSection } from './portal-lock.ts';
import { crossSourcePreamble, introFor, outroFor, type SourceId } from './prompt-frame.ts';
import { SOCRATA_ENTRY } from './socrata.ts';

/** The three civic sources, in the order the prompt and the tools array name
 *  them. */
export const CIVIC_MANIFEST: CivicManifest = [SOCRATA_ENTRY, DATA_COMMONS_ENTRY, BOSTON_OPENCONTEXT_ENTRY];

/** What one composed prompt needs from the consumer. */
export interface BuildSystemPromptInput {
  /** The run's Socrata portal, if any. */
  readonly portal?: string;
  /** The instance's configuration (`readMcpEnv`). */
  readonly configured: McpRegistryEnv;
  /** Today's date, `YYYY-MM-DD`. */
  readonly today: string;
  /** The instance's publication host, or `null`. */
  readonly publicationHost: string | null;
  readonly fetchPrompt: PromptFetcher;
  readonly fetchInstructions: InstructionsFetcher;
  /** The source ids the run selects; absent, every source the configuration
   *  offers. A source the configuration does not offer stays out whatever
   *  the selection says. */
  readonly selection?: SourceSelection;
}

export interface CivicRouter {
  /** The manifest this router was built from. */
  readonly manifest: CivicManifest;

  // --- The bare view (0.1.0's outputs) ------------------------------------------

  /** Every tool schema of every source: the vocabulary, not one instance's
   *  offer. One array object for the router's lifetime. */
  readonly mcpTools: FunctionToolSchema[];
  /** `mcpTools` itself when `lockedPortal` is absent or empty; otherwise a new
   *  array with the locked source's tools rewritten for that one portal. */
  mcpToolsFor(lockedPortal?: string): FunctionToolSchema[];
  /** `tools` without the tools of any source the run is not offered; `tools`
   *  itself when every source is offered. */
  offeredMcpTools<T extends ToolLike>(tools: T[], configured: McpRegistryEnv, selection?: SourceSelection): T[];
  /** The tool names the run is not offered. */
  withheldToolNames(configured: McpRegistryEnv, selection?: SourceSelection): string[];
  /** Whether the instance's configuration offers the source. A source id the
   *  manifest does not hold is offered, as in the website. */
  isSourceOffered(configured: McpRegistryEnv, sourceId: string): boolean;
  /** The source ids a prompt is composed from, in manifest order. */
  offeredSkillSources(configured: McpRegistryEnv, selection?: SourceSelection): string[];
  /** The source a tool name belongs to, by the schemas; see `ToolSourceIndex`
   *  for the lookup's semantics. */
  sourceIdForToolName(toolName: string): string | undefined;
  /** The composed system prompt: intro and preamble, one block per offered
   *  source, outro. */
  buildSystemPrompt(input: BuildSystemPromptInput): Promise<string>;
  /** The section a locked instance appends. */
  portalLockGuidance(lockedPortal: string, configured: McpRegistryEnv, selection?: SourceSelection): string;
  /** `systemPrompt` with the lock section appended when `lockedPortal` is
   *  non-empty; `systemPrompt` unchanged when it is not. */
  withPortalLockGuidance(
    systemPrompt: string,
    lockedPortal: string | undefined,
    configured: McpRegistryEnv,
    selection?: SourceSelection,
  ): string;

  // --- Selection ------------------------------------------------------------------

  /** Every source's offered-reason, in manifest order: what a record states. */
  sourcesOffered(configured: McpRegistryEnv, selection?: SourceSelection): SourceOffered[];

  // --- The aliased view (ADR-0032) ------------------------------------------------

  /** Exposed name to `{ sourceId, alias, upstreamName }`, built at
   *  construction. Dispatch reads it; it never splits a name. */
  readonly dispatchMap: DispatchMap;
  /** The aliased view itself, for text a consumer composes around the
   *  router's. */
  readonly aliasedView: SourceView;
  /** `mcpTools` in the aliased view. One array object for the router's
   *  lifetime. */
  readonly aliasedMcpTools: FunctionToolSchema[];
  /** `mcpToolsFor` in the aliased view. */
  aliasedMcpToolsFor(lockedPortal?: string): FunctionToolSchema[];
  /** `offeredMcpTools` over an aliased tools array. */
  aliasedOfferedMcpTools<T extends ToolLike>(tools: T[], configured: McpRegistryEnv, selection?: SourceSelection): T[];
  /** `withheldToolNames` in the aliased view. */
  aliasedWithheldToolNames(configured: McpRegistryEnv, selection?: SourceSelection): string[];
  /** `buildSystemPrompt` in the aliased view. */
  aliasedBuildSystemPrompt(input: BuildSystemPromptInput): Promise<string>;
  /** `portalLockGuidance` in the aliased view. */
  aliasedPortalLockGuidance(lockedPortal: string, configured: McpRegistryEnv, selection?: SourceSelection): string;
  /** `withPortalLockGuidance` in the aliased view. */
  aliasedWithPortalLockGuidance(
    systemPrompt: string,
    lockedPortal: string | undefined,
    configured: McpRegistryEnv,
    selection?: SourceSelection,
  ): string;
  /** The dispatch rule: the name a model called, resolved against the
   *  sources the run is offered. */
  resolveCalledName(name: string, configured: McpRegistryEnv, selection?: SourceSelection): CalledNameResolution;
  /** The upstream name of an exposed name; any other name as it is. */
  upstreamToolName(name: string): string;
  /** The target of an exposed name, or `undefined`. */
  sourceForAliasedName(name: string): DispatchTarget | undefined;
}

/** Build a router over `manifest`. The default is the civic manifest; another
 *  manifest of the same sources (a fork's, or a test's) is accepted. */
export function createCivicRouter(manifest: CivicManifest = CIVIC_MANIFEST): CivicRouter {
  const mcpTools: FunctionToolSchema[] = manifest.flatMap((entry) => entry.tools);
  const index = toolSourceIndex(manifest);

  const socrataTool = (name: string): FunctionToolSchema => {
    const tool = manifest
      .find((entry) => entry.sourceId === 'socrata')
      ?.tools.find((t) => t.type === 'function' && t.function.name === name);
    if (!tool) throw new Error(`mcpToolsFor: no Socrata tool named ${name}`);
    return tool;
  };

  const isSourceOffered = (configured: McpRegistryEnv, sourceId: string): boolean => {
    const entry = manifest.find((e) => e.sourceId === sourceId);
    return entry === undefined || isEntryOffered(entry, configuredAddresses(configured));
  };

  const portalLockGuidance = (lockedPortal: string, configured: McpRegistryEnv): string =>
    portalLockSection(lockedPortal, isSourceOffered(configured, 'boston-opencontext'));

  const map = buildDispatchMap(manifest);
  const bareTools = (lockedPortal?: string): FunctionToolSchema[] => {
    if (!lockedPortal) return mcpTools;
    const locked: Record<string, FunctionToolSchema> = {
      get_data: lockedGetData(socrataTool('get_data'), lockedPortal),
      search: lockedSearch(socrataTool('search'), lockedPortal),
      fetch: lockedFetch(socrataTool('fetch'), lockedPortal),
    };
    return mcpTools.map((tool) => (tool.type === 'function' && locked[tool.function.name]) || tool);
  };
  const bareView: SourceView = aliasedView(manifest, map);

  return {
    manifest,
    mcpTools,

    sourcesOffered(configured: McpRegistryEnv, selection?: SourceSelection): SourceOffered[] {
      return sourcesOffered(manifest, configuredAddresses(configured), selection);
    },
    dispatchMap: map as DispatchMap,
    aliasedView: bareView,
    aliasedMcpTools: mcpTools,
    aliasedMcpToolsFor: bareTools,
    aliasedOfferedMcpTools(tools, configured) {
      return offerTools(tools, withheldToolNames(manifest, configuredAddresses(configured)));
    },
    aliasedWithheldToolNames(configured) {
      return withheldToolNames(manifest, configuredAddresses(configured));
    },
    aliasedBuildSystemPrompt(input) {
      return this.buildSystemPrompt(input);
    },
    aliasedPortalLockGuidance(lockedPortal, configured) {
      return portalLockGuidance(lockedPortal, configured);
    },
    aliasedWithPortalLockGuidance(systemPrompt, lockedPortal, configured) {
      return lockedPortal ? `${systemPrompt}\n\n---\n\n${portalLockGuidance(lockedPortal, configured)}` : systemPrompt;
    },
    resolveCalledName(name: string): CalledNameResolution {
      return resolveInMap(map, undefined, name);
    },
    upstreamToolName(name: string): string {
      return upstreamToolName(map, name);
    },
    sourceForAliasedName(name: string): DispatchTarget | undefined {
      return sourceForAliasedName(map, name);
    },

    mcpToolsFor: bareTools,

    offeredMcpTools(tools, configured) {
      return offerTools(tools, withheldToolNames(manifest, configuredAddresses(configured)));
    },

    withheldToolNames(configured) {
      return withheldToolNames(manifest, configuredAddresses(configured));
    },

    isSourceOffered,

    offeredSkillSources(configured) {
      return offeredEntries(manifest, configuredAddresses(configured)).map((entry) => entry.sourceId);
    },

    sourceIdForToolName(toolName) {
      return index[toolName];
    },

    buildSystemPrompt(input) {
      const entries = offeredEntries(manifest, configuredAddresses(input.configured));
      const sources = entries.map((entry) => entry.sourceId) as SourceId[];
      return composeManifestPrompt(
        entries,
        {
          portal: input.portal,
          publicationHost: input.publicationHost,
          fetchPrompt: input.fetchPrompt,
          fetchInstructions: input.fetchInstructions,
        },
        {
          intro: introFor(input.today),
          preamble: crossSourcePreamble(sources),
          outro: outroFor(sources),
        },
      );
    },

    portalLockGuidance,

    withPortalLockGuidance(systemPrompt, lockedPortal, configured) {
      return lockedPortal
        ? `${systemPrompt}\n\n---\n\n${portalLockGuidance(lockedPortal, configured)}`
        : systemPrompt;
    },
  };
}

/** The router over `CIVIC_MANIFEST`. */
export const civicRouter: CivicRouter = createCivicRouter();
