// Selection by configuration: which sources a run is offered, which tools it
// is not, and the tools array with those removed.

import type { ConfiguredAddresses, Manifest, ManifestEntry, ToolLike } from './types.ts';

/** A source's configured address, or `undefined` when it has none. An empty
 *  string is `undefined` too: absence is stated by absence. */
export function configuredAddress(addresses: ConfiguredAddresses, sourceId: string): string | undefined {
  if (!Object.hasOwn(addresses, sourceId)) return undefined;
  const value = addresses[sourceId];
  return value ? value : undefined;
}

/** Whether a run is offered this source: always, unless it is optional and
 *  has no configured address. */
export function isEntryOffered(entry: ManifestEntry<unknown>, addresses: ConfiguredAddresses): boolean {
  if (entry.configuration.requirement !== 'optional') return true;
  return configuredAddress(addresses, entry.sourceId) !== undefined;
}

/** The sources a run is offered, in manifest order. */
export function offeredEntries<Context>(
  manifest: Manifest<Context>,
  addresses: ConfiguredAddresses,
): ManifestEntry<Context>[] {
  return manifest.filter((entry) => isEntryOffered(entry, addresses));
}

/** The tool names a run is not offered: every tool of each source it is not
 *  offered, in manifest order and each source's routing order. Empty when
 *  every source is offered. */
export function withheldToolNames(manifest: Manifest<unknown>, addresses: ConfiguredAddresses): string[] {
  return manifest.filter((entry) => !isEntryOffered(entry, addresses)).flatMap((entry) => [...entry.toolNames]);
}

/**
 * `tools` without the function tools named in `withheld`. With nothing
 * withheld, `tools` itself is returned, the same array object, so a consumer
 * that offers every source sends exactly what it would have sent without
 * this filter.
 */
export function offerTools<T extends ToolLike>(tools: T[], withheld: readonly string[]): T[] {
  const names = new Set(withheld);
  if (names.size === 0) return tools;
  return tools.filter(
    (tool) => !(tool.type === 'function' && names.has((tool as unknown as { function: { name: string } }).function.name)),
  );
}
