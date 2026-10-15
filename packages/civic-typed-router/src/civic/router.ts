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
// Those are the bare view, and their outputs are 0.1.0's. Beside each sits an
// `aliased*` sibling: the same output with every tool named
// `<alias>__<upstream name>` (ADR-0032). Both take an optional selection of
// source ids (`SourceSelection`); with none, every source the configuration
// offers is offered, and the output is the one the function gave before the
// selection existed.
//
// Construction runs the startup checks: `checkToolNames` (aliases and the
// exposed names) and `assertUniqueToolNames` over the exposed names, then
// builds the dispatch map. A manifest that fails either is refused. Two
// sources may share an upstream name: their exposed names differ, and a bare
// call of that name is refused at dispatch (`resolveCalledName`).
//
// Nothing here reads an entry's `id`. The bare view reads no `alias` either:
// only the checks, the dispatch map and the aliased view do.

import {
  aliasedTools,
  aliasedView,
  aliasedWithheldToolNames,
  BARE_VIEW,
  dispatchMap as buildDispatchMap,
  checkToolNames,
  entryToolsInView,
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
import { assertUniqueToolNames, toolSourceIndex } from '../core/tool-index.ts';
import type { FunctionToolSchema, SourceView, ToolLike } from '../core/types.ts';
import { BOSTON_OPENCONTEXT_ENTRY } from './boston.ts';
import type { CivicManifest, CivicManifestEntry, InstructionsFetcher, PromptFetcher } from './context.ts';
import { DATA_COMMONS_ENTRY } from './data-commons.ts';
import { configuredAddresses, type McpRegistryEnv } from './env.ts';
import { composeOutro, composePreamble, introFor } from './prompt-frame.ts';
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

/** An entry's preamble entry in `view`: its own, or composed from its
 *  display name, description and tools (F4). */
function preambleEntryOf(entry: CivicManifestEntry, view: SourceView): string {
  if (entry.prompt?.preambleEntry) return entry.prompt.preambleEntry(view);
  const tools = entry.toolNames.map((name) => view.toolName(entry.sourceId, name)).join(', ');
  return `**${entry.displayName}** — ${entry.description} Tools: ${tools}.`;
}

/** An entry's outro citation: its own, or composed from its display name. */
function citationOf(entry: CivicManifestEntry): string {
  return entry.prompt?.citation ?? `the identifiers its tools return (for ${entry.displayName})`;
}

/** Build a router over `manifest`. The default is the civic manifest; a
 *  fork's manifest, with more or other sources, is accepted. Throws
 *  `ToolNameError` or `DuplicateToolNameError` when the manifest fails the
 *  startup checks. */
export function createCivicRouter(manifest: CivicManifest = CIVIC_MANIFEST): CivicRouter {
  // The startup checks, then the map. `checkToolNames` refuses an ill-formed
  // or shared alias and a collision after normalizing (`dispatchMap` would run
  // it too; it is called here so the order is explicit).
  // `assertUniqueToolNames` runs over the exposed names: two sources may share
  // an upstream name.
  checkToolNames(manifest);
  const map = buildDispatchMap(manifest);
  const aliased = aliasedView(manifest, map);
  const aliasedMcpTools = aliasedTools(manifest, aliased);
  assertUniqueToolNames(manifest.map((entry) => ({ sourceId: entry.sourceId, tools: entryToolsInView(entry, aliased) })));

  const mcpTools: FunctionToolSchema[] = manifest.flatMap((entry) => entry.tools);
  const index = toolSourceIndex(manifest);
  const lockEntry = manifest.find((entry) => entry.portalLock !== undefined);

  const toolsInView = (view: SourceView, all: FunctionToolSchema[], lockedPortal: string | undefined): FunctionToolSchema[] => {
    if (!lockedPortal) return all;
    if (!lockEntry?.portalLock) throw new Error('mcpToolsFor: no source in the manifest takes a portal lock');
    const lock = lockEntry.portalLock;
    return manifest.flatMap((entry) => {
      const tools = view === BARE_VIEW ? entry.tools : entryToolsInView(entry, view);
      return entry === lockEntry ? lock.lockTools(tools, lockedPortal, view) : [...tools];
    });
  };

  const isSourceOffered = (configured: McpRegistryEnv, sourceId: string): boolean => {
    const entry = manifest.find((e) => e.sourceId === sourceId);
    return entry === undefined || isEntryOffered(entry, configuredAddresses(configured));
  };

  const lockGuidance = (view: SourceView, lockedPortal: string, configured: McpRegistryEnv, selection?: SourceSelection): string => {
    if (!lockEntry?.portalLock) throw new Error('portalLockGuidance: no source in the manifest takes a portal lock');
    // `offeredEntries` keeps manifest entries as they are: these are civic ones.
    const others = (offeredEntries(manifest, configuredAddresses(configured), selection) as CivicManifestEntry[])
      .filter((entry) => entry !== lockEntry)
      .map((entry) => entry.prompt?.lockMention ?? entry.displayName);
    return lockEntry.portalLock.section(lockedPortal, others, view);
  };

  const withLock = (
    view: SourceView,
    systemPrompt: string,
    lockedPortal: string | undefined,
    configured: McpRegistryEnv,
    selection?: SourceSelection,
  ): string =>
    lockedPortal ? `${systemPrompt}\n\n---\n\n${lockGuidance(view, lockedPortal, configured, selection)}` : systemPrompt;

  const compose = (view: SourceView, input: BuildSystemPromptInput): Promise<string> => {
    const entries = offeredEntries(manifest, configuredAddresses(input.configured), input.selection) as CivicManifestEntry[];
    const sources = entries.map((entry) => ({
      sourceId: entry.sourceId,
      preambleEntry: preambleEntryOf(entry, view),
      citation: citationOf(entry),
    }));
    const context = {
      portal: input.portal,
      publicationHost: input.publicationHost,
      fetchPrompt: input.fetchPrompt,
      fetchInstructions: input.fetchInstructions,
    };
    const frame = {
      intro: introFor(input.today),
      preamble: composePreamble(sources),
      outro: composeOutro(sources.map((source) => source.citation)),
    };
    // The bare view calls each guidance entry exactly as 0.1.0 did, with the
    // context alone.
    return view === BARE_VIEW
      ? composeManifestPrompt(entries, context, frame)
      : composeManifestPrompt(
          entries.map((entry) => ({ guidance: { fetchText: (ctx: typeof context) => entry.guidance.fetchText(ctx, view) } })),
          context,
          frame,
        );
  };

  const offeredIds = (configured: McpRegistryEnv, selection?: SourceSelection): string[] =>
    offeredEntries(manifest, configuredAddresses(configured), selection).map((entry) => entry.sourceId);

  return {
    manifest,
    mcpTools,

    mcpToolsFor(lockedPortal) {
      return toolsInView(BARE_VIEW, mcpTools, lockedPortal);
    },

    offeredMcpTools(tools, configured, selection) {
      return offerTools(tools, withheldToolNames(manifest, configuredAddresses(configured), selection));
    },

    withheldToolNames(configured, selection) {
      return withheldToolNames(manifest, configuredAddresses(configured), selection);
    },

    isSourceOffered,

    offeredSkillSources(configured, selection) {
      return offeredIds(configured, selection);
    },

    sourceIdForToolName(toolName) {
      return index[toolName];
    },

    buildSystemPrompt(input) {
      return compose(BARE_VIEW, input);
    },

    portalLockGuidance(lockedPortal, configured, selection) {
      return lockGuidance(BARE_VIEW, lockedPortal, configured, selection);
    },

    withPortalLockGuidance(systemPrompt, lockedPortal, configured, selection) {
      return withLock(BARE_VIEW, systemPrompt, lockedPortal, configured, selection);
    },

    sourcesOffered(configured, selection) {
      return sourcesOffered(manifest, configuredAddresses(configured), selection);
    },

    dispatchMap: map,
    aliasedView: aliased,
    aliasedMcpTools,

    aliasedMcpToolsFor(lockedPortal) {
      return toolsInView(aliased, aliasedMcpTools, lockedPortal);
    },

    aliasedOfferedMcpTools(tools, configured, selection) {
      return offerTools(tools, aliasedWithheldToolNames(manifest, configuredAddresses(configured), selection, aliased));
    },

    aliasedWithheldToolNames(configured, selection) {
      return aliasedWithheldToolNames(manifest, configuredAddresses(configured), selection, aliased);
    },

    aliasedBuildSystemPrompt(input) {
      return compose(aliased, input);
    },

    aliasedPortalLockGuidance(lockedPortal, configured, selection) {
      return lockGuidance(aliased, lockedPortal, configured, selection);
    },

    aliasedWithPortalLockGuidance(systemPrompt, lockedPortal, configured, selection) {
      return withLock(aliased, systemPrompt, lockedPortal, configured, selection);
    },

    resolveCalledName(name, configured, selection) {
      return resolveInMap(map, offeredIds(configured, selection), name);
    },

    upstreamToolName(name) {
      return upstreamToolName(map, name);
    },

    sourceForAliasedName(name) {
      return sourceForAliasedName(map, name);
    },
  };
}

/** The router over `CIVIC_MANIFEST`. */
export const civicRouter: CivicRouter = createCivicRouter();
