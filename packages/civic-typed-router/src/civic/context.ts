// What the consumer supplies for one composed prompt. The router reads no
// clock, holds no cache and performs no I/O: the date, the publication host
// and both network reads arrive here.

import type { FunctionToolSchema, ManifestEntry, SourceView } from '../core/types.ts';

/**
 * Fetch an MCP prompt by name: the reference website's `callMcpPrompt`. The
 * Socrata entry calls it once per composed prompt, as
 * `fetchPrompt('skill-guidance', { modality: 'web' })`.
 *
 * Returns the prompt text, or throws. A throw puts `SOCRATA_SKILL_FALLBACK` in
 * the Socrata block; an empty string is used as it is.
 *
 * Any cache is the consumer's. The website kept the guidance for five minutes,
 * and its cache held an empty result without ever serving it (it tested the
 * cached text for truthiness), so an empty answer was re-fetched every time.
 */
export type PromptFetcher = (name: string, args: Record<string, string>) => Promise<string>;

/**
 * Fetch a server's advertised instructions by source id: the reference
 * website's `getServerInstructions`. Returns the text, or `null` when the
 * server advertises none. A throw leaves that source's block out of the prompt.
 */
export type InstructionsFetcher = (sourceId: string) => Promise<string | null>;

/** The context every civic guidance entry receives. */
export interface CivicGuidanceContext {
  /** The run's Socrata portal; with one, the Socrata block names it and
   *  appends any portal-specific guidance. */
  readonly portal?: string;
  /** The instance's publication host, which the Data Commons guidance names;
   *  `null` (or empty) and the mention is left out. */
  readonly publicationHost: string | null;
  readonly fetchPrompt: PromptFetcher;
  readonly fetchInstructions: InstructionsFetcher;
}

/** How a source appears in the civic prompt frame. Every part is optional:
 *  an entry without one gets it composed from its `displayName` and
 *  `description` (F4). */
export interface CivicPromptParts {
  /** The source's entry in the cross-source preamble, without its number, in
   *  `view`. Composed when absent: `**<displayName>** — <description> Tools:
   *  <its tools, in the view>.` */
  preambleEntry?(view: SourceView): string;
  /** What the closing instruction asks the model to cite for the source.
   *  Composed when absent: `the identifiers its tools return (for
   *  <displayName>)`. */
  readonly citation?: string;
  /** How the one-portal lock section names the source among the other
   *  sources a locked run is offered. `displayName` when absent. */
  readonly lockMention?: string;
}

/** A source that a one-portal lock applies to: its tools and the section a
 *  locked run's prompt gains. One entry of a manifest carries it (Socrata). */
export interface CivicPortalLock {
  /** `tools` (the entry's own, in `view`) rewritten for `lockedPortal`. */
  lockTools(tools: readonly FunctionToolSchema[], lockedPortal: string, view: SourceView): FunctionToolSchema[];
  /** The section a locked run's prompt gains, naming `others` (the other
   *  offered sources, each as the lock names it, in manifest order). */
  section(lockedPortal: string, others: readonly string[], view: SourceView): string;
}

/** A civic manifest entry: a manifest entry, plus how the civic prompt frame
 *  and the portal lock read it. */
export interface CivicManifestEntry extends ManifestEntry<CivicGuidanceContext> {
  readonly prompt?: CivicPromptParts;
  readonly portalLock?: CivicPortalLock;
}

export type CivicManifest = readonly CivicManifestEntry[];
