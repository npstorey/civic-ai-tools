// Selection: which sources a run is offered, which tools it is not, and the
// tools array with those removed.
//
// Two inputs decide it. The configuration offers a source when it is required
// or has a configured address. A selection, when the consumer passes one,
// narrows that to the source ids it names. The configuration comes first: a
// source the configuration does not offer is `not-configured` whatever the
// selection says, and a selection can never add one. With no selection (the
// default) every source the configuration offers is offered, and every output
// is what it was before the selection existed. A selection id the manifest
// does not hold is ignored.

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

/** A selection of source ids. `undefined` is the default: every source the
 *  configuration offers. */
export type SourceSelection = readonly string[] | undefined;

/** Why a run is, or is not, offered a source.
 *  - `configured`: the configuration offers it and no selection was passed.
 *  - `selected`: the configuration offers it and the selection names it.
 *  - `not-selected`: the configuration offers it and the selection does not
 *    name it.
 *  - `not-configured`: the configuration does not offer it, whatever the
 *    selection. */
export type OfferedReason = 'configured' | 'not-configured' | 'selected' | 'not-selected';

/** One source's offered-reason, as a record states it. */
export interface SourceOffered {
  readonly sourceId: string;
  readonly alias: string;
  readonly reason: OfferedReason;
}

/** Why a run is, or is not, offered `entry`. */
export function offeredReason(
  entry: ManifestEntry<unknown>,
  addresses: ConfiguredAddresses,
  selection?: SourceSelection,
): OfferedReason {
  if (!isEntryOffered(entry, addresses)) return 'not-configured';
  if (selection === undefined) return 'configured';
  return selection.includes(entry.sourceId) ? 'selected' : 'not-selected';
}

/** Whether a reason offers the source. */
export const isOfferedReason = (reason: OfferedReason): boolean => reason === 'configured' || reason === 'selected';

/** Every source's offered-reason, in manifest order. */
export function sourcesOffered(
  manifest: Manifest<unknown>,
  addresses: ConfiguredAddresses,
  selection?: SourceSelection,
): SourceOffered[] {
  return manifest.map((entry) => ({
    sourceId: entry.sourceId,
    alias: entry.alias,
    reason: offeredReason(entry, addresses, selection),
  }));
}

/** The sources a run is offered, in manifest order. */
export function offeredEntries<Context>(
  manifest: Manifest<Context>,
  addresses: ConfiguredAddresses,
  selection?: SourceSelection,
): ManifestEntry<Context>[] {
  return manifest.filter((entry) => isOfferedReason(offeredReason(entry, addresses, selection)));
}

/** The tool names a run is not offered: every tool of each source it is not
 *  offered, in manifest order and each source's routing order. Empty when
 *  every source is offered. */
export function withheldToolNames(
  manifest: Manifest<unknown>,
  addresses: ConfiguredAddresses,
  selection?: SourceSelection,
): string[] {
  return manifest
    .filter((entry) => !isOfferedReason(offeredReason(entry, addresses, selection)))
    .flatMap((entry) => [...entry.toolNames]);
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
