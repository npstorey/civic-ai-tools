// What the consumer supplies for one composed prompt. The router reads no
// clock, holds no cache and performs no I/O: the date, the publication host
// and both network reads arrive here.

import type { Manifest, ManifestEntry } from '../core/types.ts';

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

export type CivicManifestEntry = ManifestEntry<CivicGuidanceContext>;
export type CivicManifest = Manifest<CivicGuidanceContext>;
