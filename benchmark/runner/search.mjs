// The benchmark's search: BM25 over an inventory, as `find_source` runs it
// (`shortlist+search-N`) and as `rule-N` runs it with the question's text as
// the query. No model; the same function for both.
//
// THE METHOD, `bm25` version 1. R5's rule chooser's parameters, declared in
// its plan before its questions existed (R5's `lib/rule-chooser.mjs`, in the
// owner's copy at benchmark/_local/r5/), applied to a search instead of a
// chooser:
//
//   - k1 = 1.2, b = 0.75; IDF = ln(1 + (N - df + 0.5) / (df + 0.5)), N the
//     inventory's entry count;
//   - each entry's document: its alias split on "_", its display name and its
//     description, joined by spaces;
//   - tokens: lower-cased, split on anything not a letter a-z or a digit,
//     R5's fixed stopword list dropped, a trailing "s" removed from a token
//     longer than three characters (R5's `tokenize`, unchanged);
//   - the result: the entries scoring above 0, best first, ties in the
//     inventory's order, the first 10.
//
// What differs from R5: R5 loaded its top one or two entries (a chooser);
// this returns ten candidates for a model to read (a search), so its measure
// is recall at k (design §1.4, item 3).

/** The method and its version, as the routing configuration names them. */
export const SEARCH_METHOD = Object.freeze({ method: 'bm25', version: '1' });

/** The parameters, as declared. */
export const BM25 = Object.freeze({ k1: 1.2, b: 0.75, top: 10 });

/** R5's stopword list, word for word. */
export const STOPWORDS = Object.freeze(
  new Set(
    'a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves'.split(
      ' ',
    ),
  ),
);

/** R5's tokenizer. */
export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

/** An entry's document text: its alias split on "_", display name and
 *  description. */
export const documentOf = (entry) => `${entry.alias.split('_').join(' ')} ${entry.displayName} ${entry.description}`;

/** A BM25 index over `entries` (inventory entries, in the inventory's order). */
export function createIndex(entries) {
  const docs = entries.map((e, i) => {
    const tokens = tokenize(documentOf(e));
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { alias: e.alias, order: i, length: tokens.length, tf };
  });
  const n = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / n;
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t) => Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
  const score = (queryTokens, d) => {
    let s = 0;
    for (const q of queryTokens) {
      const f = d.tf.get(q) ?? 0;
      if (!f) continue;
      s += idf(q) * ((f * (BM25.k1 + 1)) / (f + BM25.k1 * (1 - BM25.b + (BM25.b * d.length) / avgdl)));
    }
    return s;
  };
  return {
    /** The aliases of the first `top` entries scoring above 0 for `query`,
     *  best first, ties in inventory order. */
    search(query, top = BM25.top) {
      const q = tokenize(query ?? '');
      return docs
        .map((d) => ({ alias: d.alias, order: d.order, score: score(q, d) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || a.order - b.order)
        .slice(0, top)
        .map((r) => r.alias);
    },
  };
}
