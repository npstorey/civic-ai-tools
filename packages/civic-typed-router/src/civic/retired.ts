// Packs a release of this router offered and a later one retired (CKAN-2 P2,
// hub issue 329, R6): a typed stub that resolves nothing.

/** One retired pack, as records made while it was offered name it. */
export interface RetiredPack {
  readonly id: string;
  readonly sourceId: string;
  readonly alias: string;
  readonly displayName: string;
  readonly base: string;
  readonly portal: string;
  readonly addedIn: string;
  readonly retiredIn: string;
}

/** Every pack a release of this router retired: a typed stub, empty. */
export const RETIRED_PACKS: readonly RetiredPack[] = Object.freeze([]);

/** The retired pack whose inventory `id` or `sourceId` is `key`: a typed
 *  stub that resolves nothing. */
export function retiredPack(_key: string): RetiredPack | undefined {
  return undefined;
}
