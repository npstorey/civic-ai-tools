// Packs a release of this router offered and a later one retired (since
// 0.12.0; CKAN-2 P2, hub issue 329, R6). A record keeps what its run was
// offered: a call of a pack's tool states the pack's inventory `id`
// (`mcp.pack_id`) and is recorded under its base's `sourceId`, and the
// record's `sourcesOffered` lists the pack by its own `sourceId`. Once the
// pack leaves `CIVIC_MANIFEST`, neither key resolves through the manifest;
// this table is where a reader of such a record finds what it named.
//
// A row is never removed or changed once released: a record made under the
// router that offered the pack reads through it for as long as the record
// is read.

/** One retired pack, as records made while it was offered name it. */
export interface RetiredPack {
  /** The pack's inventory `id`, as a call's `mcp.pack_id` states it. */
  readonly id: string;
  /** The pack's `sourceId`, as a record's `sourcesOffered` row states it. */
  readonly sourceId: string;
  /** The alias the pack held. An alias is not a key here: `boston` named
   *  Boston OpenContext through router 0.10.0 and Analyze Boston in 0.11.0,
   *  so a record's alias is read with the router version that wrote it. */
  readonly alias: string;
  /** The name the pack was offered under. */
  readonly displayName: string;
  /** The `sourceId` of its base server: the source its calls were recorded
   *  under. */
  readonly base: string;
  /** The portal every call of its tools named: its filter's one value. */
  readonly portal: string;
  /** The router release that first offered it, and the one that retired it. */
  readonly addedIn: string;
  readonly retiredIn: string;
}

/** Every pack a release of this router retired, oldest first. */
export const RETIRED_PACKS: readonly RetiredPack[] = Object.freeze([
  Object.freeze({
    id: 'boston-ckan@https://data.boston.gov',
    sourceId: 'boston-ckan',
    alias: 'boston',
    displayName: 'Analyze Boston',
    base: 'ckan-server',
    portal: 'https://data.boston.gov',
    addedIn: '0.11.0',
    retiredIn: '0.12.0',
  }),
]);

/** The retired pack whose inventory `id` or `sourceId` is `key`, or
 *  `undefined`. An alias is not read (see `RetiredPack.alias`). */
export function retiredPack(key: string): RetiredPack | undefined {
  return RETIRED_PACKS.find((pack) => pack.id === key || pack.sourceId === key);
}
