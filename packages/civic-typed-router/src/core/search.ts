// The search (since 0.10.0): method `bm25`, version 1. RED STUB: the exports
// exist with their final signatures and return nothing.

/** What the search reads from an entry. */
export interface SearchableEntry {
  readonly alias: string;
  readonly displayName: string;
  readonly description: string;
}

/** How one search is narrowed and cut. */
export interface SearchOptions<E extends SearchableEntry = SearchableEntry> {
  /** How many hits at most. Defaults to `SEARCH_DEFAULT_TOP`. */
  readonly top?: number;
  /** The search space: whether an entry may be a hit. */
  readonly within?: (entry: E) => boolean;
}

/** An index over entries, in their order. */
export interface SearchIndex<E extends SearchableEntry = SearchableEntry> {
  readonly entries: readonly E[];
  search(query: string, options?: SearchOptions<E>): E[];
}

/** A search method and its version. */
export interface SearchMethod {
  readonly method: string;
  readonly version: string;
}

/** The method and its version, as a routing configuration names them. */
export const SEARCH_METHOD: SearchMethod = Object.freeze({ method: '', version: '' });

/** The number of hits a search returns when no `top` is passed. */
export const SEARCH_DEFAULT_TOP: number = 0;

/** An index over `entries`. */
export function createSearchIndex<E extends SearchableEntry>(entries: readonly E[]): SearchIndex<E> {
  return {
    entries,
    search: () => [],
  };
}
