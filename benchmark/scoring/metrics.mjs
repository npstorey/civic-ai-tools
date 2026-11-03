// The benchmark's per-row routing metrics beyond R5's load classes (sources-
// at-scale design §2.5; hub #302, A2.2): filter recall, search recall at k and
// the notice rate. Each is a pure function of one row; `rate` aggregates any of
// them over rows. score.mjs keeps R5's five load classes.
//
// THE ROW FIELDS these read. A row is one model × question × repeat, as the
// runner writes it to `rows.jsonl`. R5's rows carry `acceptable`; the other
// two are written by the runner's configurations (P3-build):
//
//   acceptable  string[][]  the question's gold for the row's inventory: every
//                           acceptable alias set; [[]] is "no source in this
//                           inventory", and [] among several sets is "load
//                           nothing" (benchmark/questions/README.md)
//   shortlist   string[]    the aliases the row's first request offered: the
//                           listed directory for `baseline-7` and `flat-N`,
//                           the filter's output for `shortlist-N` and
//                           `shortlist+search-N`, the builder's selection for
//                           `builder-N`. Absent: the row's configuration
//                           records none, and each metric is null
//   searches    { query: string, hits: string[] }[]
//                           the row's `find_source` calls, in the order made:
//                           the query the model sent and the aliases returned,
//                           best first. Absent or [] when the model made none
//
// Every function returns true, false, or null where the metric does not apply
// to the row; `rate` counts only the rows where it applies.
//
//   filter recall       some acceptable set is a subset of the shortlist. A
//                       gold that accepts [] (a no-data question, a question
//                       with no source in the inventory, an open place) is
//                       recalled by any shortlist, so such a row never has a
//                       filter miss.
//   search recall at k  for a row whose shortlist misses: some acceptable set
//                       is completed by the first k hits of the row's
//                       find_source calls, every alias of it that the
//                       shortlist lacks among them. For a one-alias set, a
//                       gold alias among the first k hits. Null where the
//                       shortlist does not miss or the row made no search.
//   noticed             for a row whose shortlist misses: the model called
//                       find_source. Null where the shortlist does not miss.
//                       The notice rate is `rate(rows, noticed)`.

/** The k values the design reports search recall at. */
export const SEARCH_K = Object.freeze([5, 10]);

const subset = (set, of) => set.every((alias) => of.includes(alias));
const searchesOf = (row) => (Array.isArray(row.searches) ? row.searches : []);

/** Some acceptable set is a subset of the row's shortlist; null when the row
 *  records no shortlist. */
export function filterRecall(row) {
  if (!Array.isArray(row.shortlist)) return null;
  return row.acceptable.some((set) => subset(set, row.shortlist));
}

/** For a row whose shortlist misses, some acceptable set is completed by the
 *  first `k` hits of its find_source calls; null where the shortlist does not
 *  miss or the row made no search. */
export function searchRecallAt(row, k) {
  if (!Number.isInteger(k) || k < 1) throw new Error(`search recall at k: k must be a positive integer, not ${k}`);
  if (filterRecall(row) !== false) return null;
  const searches = searchesOf(row);
  if (searches.length === 0) return null;
  const found = new Set(searches.flatMap((s) => s.hits.slice(0, k)));
  return row.acceptable.some((set) => set.length > 0 && set.every((alias) => row.shortlist.includes(alias) || found.has(alias)));
}

/** For a row whose shortlist misses, the model called find_source; null where
 *  the shortlist does not miss. */
export function noticed(row) {
  if (filterRecall(row) !== false) return null;
  return searchesOf(row).length > 0;
}

/** A metric over rows: `{ n, hits, rate }`, counting only the rows where it
 *  applies; `rate` is null when none does. */
export function rate(rows, metric) {
  const values = rows.map(metric).filter((v) => v !== null);
  const hits = values.filter((v) => v === true).length;
  return { n: values.length, hits, rate: values.length ? hits / values.length : null };
}

/** The notice rate: of the rows whose shortlist misses, the share in which the
 *  model called find_source. */
export const noticeRate = (rows) => rate(rows, noticed);
