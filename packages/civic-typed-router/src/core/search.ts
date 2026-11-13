// The search (since 0.10.0): method `bm25`, version 1, as the hub's S1
// benchmark ran it (`benchmark/runner/search.mjs`), ported with the same
// arithmetic in the same order, so that every search S1 recorded returns the
// same entries in the same order here.
//
// THE METHOD, `bm25` version 1:
//
//   - k1 = 1.2, b = 0.75; IDF = ln(1 + (N - df + 0.5) / (df + 0.5)), N the
//     index's entry count;
//   - each entry's document: its alias split on "_", its display name and
//     its description, joined by spaces;
//   - tokens: lower-cased, split on anything not a letter a-z or a digit, a
//     fixed stopword list dropped, a trailing "s" removed from a token longer
//     than three characters;
//   - the result: the entries scoring above 0, best first, ties in the
//     index's order, the first `top` (10 unless the caller says otherwise).
//
// The index covers every entry it is given, and each entry's score is
// computed against that whole index. A search space (`within`) is a filter
// applied after scoring and before the cut: it removes entries from the
// result and moves no score. So the entries a space keeps are in the order
// the unspaced ranking has them, and the first `top` are taken after the
// filter.
//
// Any change to the parameters, the document, the tokenizer, the stopwords
// or the ranking is a new version of the method, and so is a change to the
// search tool's limit (`FIND_SOURCE_LIMIT`, `./directory.ts`).
//
// Pure: it reads nothing but its arguments.

/** What the search reads from an entry. A manifest entry has these fields,
 *  and so does an inventory entry. */
export interface SearchableEntry {
  readonly alias: string;
  readonly displayName: string;
  readonly description: string;
}

/** How one search is narrowed and cut. */
export interface SearchOptions<E extends SearchableEntry = SearchableEntry> {
  /** How many hits at most: a non-negative integer. Defaults to
   *  `SEARCH_DEFAULT_TOP`. */
  readonly top?: number;
  /** The search space: whether an entry may be a hit. Applied after
   *  scoring; absent, every entry may be. */
  readonly within?: (entry: E) => boolean;
}

/** An index over entries, in their order. */
export interface SearchIndex<E extends SearchableEntry = SearchableEntry> {
  /** The entries indexed, in the order given. */
  readonly entries: readonly E[];
  /** The entries scoring above 0 for `query` and inside the space, best
   *  first, ties in the entries' order, the first `top`. */
  search(query: string, options?: SearchOptions<E>): E[];
}

/** A search method and its version. */
export interface SearchMethod {
  readonly method: string;
  readonly version: string;
}

/** The method and its version, as a routing configuration names them. */
export const SEARCH_METHOD: SearchMethod = Object.freeze({ method: 'bm25', version: '1' });

/** The number of hits a search returns when no `top` is passed. */
export const SEARCH_DEFAULT_TOP: number = 10;

/** The parameters, as version 1 declares them. */
const K1 = 1.2;
const B = 0.75;

/** The stopword list, word for word. */
const STOPWORDS: ReadonlySet<string> = new Set(
  'a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves'.split(
    ' ',
  ),
);

/** The tokenizer. */
function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

/** An entry's document text: its alias split on "_", display name and
 *  description. */
const documentOf = (entry: SearchableEntry): string => `${entry.alias.split('_').join(' ')} ${entry.displayName} ${entry.description}`;

interface IndexedDocument<E> {
  readonly entry: E;
  readonly order: number;
  readonly length: number;
  readonly tf: Map<string, number>;
}

/** An index over `entries`, in their order. The entries are read once, when
 *  the index is built. */
export function createSearchIndex<E extends SearchableEntry>(entries: readonly E[]): SearchIndex<E> {
  const indexed = [...entries];
  const docs: IndexedDocument<E>[] = indexed.map((e, i) => {
    const tokens = tokenize(documentOf(e));
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { entry: e, order: i, length: tokens.length, tf };
  });
  const n = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / n;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string): number => Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
  const score = (queryTokens: readonly string[], d: IndexedDocument<E>): number => {
    let s = 0;
    for (const q of queryTokens) {
      const f = d.tf.get(q) ?? 0;
      if (!f) continue;
      s += idf(q) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / avgdl)));
    }
    return s;
  };
  return {
    entries: indexed,
    search(query, options = {}) {
      const top = options.top ?? SEARCH_DEFAULT_TOP;
      if (!Number.isInteger(top) || top < 0) throw new RangeError(`search: top must be a non-negative integer; it is ${String(top)}`);
      const within = options.within;
      const q = tokenize(query ?? '');
      return docs
        .map((d) => ({ entry: d.entry, order: d.order, score: score(q, d) }))
        .filter((r) => r.score > 0)
        .filter((r) => within === undefined || within(r.entry))
        .sort((a, b) => b.score - a.score || a.order - b.order)
        .slice(0, top)
        .map((r) => r.entry);
    },
  };
}
