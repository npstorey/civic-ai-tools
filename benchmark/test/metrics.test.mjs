// A2.2 (hub #302, S1 P2): the scorer.
//
//   - over R5's committed rows (benchmark/runs/2026-10-11-r5/rows.jsonl),
//     scoreLoad over each row's loads and `acceptable` gives the `score1` and
//     `score2` R5 recorded, and all five of R5's classes occur;
//   - filter recall, search recall at k and the notice rate
//     (scoring/metrics.mjs), on constructed rows: one gold set and several,
//     a two-alias set, an empty gold, a row with no search, a row with no
//     shortlist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORRECT, scoreLoad } from '../scoring/score.mjs';
import { filterRecall, noticed, noticeRate, rate, SEARCH_K, searchRecallAt } from '../scoring/metrics.mjs';

const R5_ROWS = new URL('../runs/2026-10-11-r5/rows.jsonl', import.meta.url);

test("A2.2: scoreLoad reproduces R5's five classes on R5's committed rows", () => {
  const rows = readFileSync(R5_ROWS, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(rows.length, 1323);
  const seen = new Set();
  for (const row of rows) {
    assert.equal(scoreLoad(row.loaded1, row.acceptable), row.score1, `${row.key}: score1`);
    assert.equal(scoreLoad(row.loaded2, row.acceptable), row.score2, `${row.key}: score2`);
    seen.add(row.score1).add(row.score2);
  }
  assert.deepEqual([...seen].sort(), ['acceptable', 'exact', 'missing', 'over', 'wrong']);
  assert.deepEqual([...CORRECT].sort(), ['acceptable', 'exact']);
});

/** A constructed row. */
const row = (acceptable, shortlist, searches) => ({ acceptable, ...(shortlist === undefined ? {} : { shortlist }), ...(searches === undefined ? {} : { searches }) });
const search = (...hits) => ({ query: 'q', hits });

test('A2.2: filter recall is some acceptable set within the shortlist', () => {
  assert.equal(filterRecall(row([['a']], ['a', 'b'])), true);
  assert.equal(filterRecall(row([['a']], ['b', 'c'])), false);
  // Several sets: any one of them, whole.
  assert.equal(filterRecall(row([['a'], ['b', 'c']], ['c', 'd'])), false);
  assert.equal(filterRecall(row([['a'], ['b', 'c']], ['b', 'c'])), true);
  // A two-alias set needs both.
  assert.equal(filterRecall(row([['a', 'b']], ['a'])), false);
  // An empty gold, or a gold that accepts loading nothing, is recalled by any shortlist.
  assert.equal(filterRecall(row([[]], [])), true);
  assert.equal(filterRecall(row([[]], ['x'])), true);
  assert.equal(filterRecall(row([[], ['a']], ['x'])), true);
  // No shortlist recorded: the metric does not apply.
  assert.equal(filterRecall(row([['a']])), null);
});

test('A2.2: search recall at k completes a missed set from the first k hits', () => {
  const hits = (n, alias) => [...Array.from({ length: n - 1 }, (_, i) => `x${i}`), alias];
  // A gold alias at hit 3, 5 and 7 of one call.
  assert.equal(searchRecallAt(row([['a']], ['b'], [search(...hits(3, 'a'))]), 5), true);
  assert.equal(searchRecallAt(row([['a']], ['b'], [search(...hits(5, 'a'))]), 5), true);
  assert.equal(searchRecallAt(row([['a']], ['b'], [search(...hits(7, 'a'))]), 5), false);
  assert.equal(searchRecallAt(row([['a']], ['b'], [search(...hits(7, 'a'))]), 10), true);
  // Over a row's two calls.
  assert.equal(searchRecallAt(row([['a']], ['b'], [search('x'), search('a')]), 5), true);
  // Several sets: completing any one counts; a hit that completes none does not.
  assert.equal(searchRecallAt(row([['a'], ['b', 'c']], ['c'], [search('b')]), 5), true);
  assert.equal(searchRecallAt(row([['a'], ['b', 'c']], ['d'], [search('b')]), 5), false);
  assert.equal(searchRecallAt(row([['a'], ['b', 'c']], ['d'], [search('b', 'c')]), 5), true);
  // A two-alias set: the hit must be the alias the shortlist lacks.
  assert.equal(searchRecallAt(row([['a', 'b']], ['a'], [search('a')]), 5), false);
  assert.equal(searchRecallAt(row([['a', 'b']], ['a'], [search('b')]), 5), true);
  // Null where the shortlist does not miss (an empty gold never misses), or the row made no search.
  assert.equal(searchRecallAt(row([['a']], ['a'], [search('a')]), 5), null);
  assert.equal(searchRecallAt(row([[]], ['x'], [search('a')]), 5), null);
  assert.equal(searchRecallAt(row([['a']], ['b'], []), 5), null);
  assert.equal(searchRecallAt(row([['a']], ['b']), 5), null);
  assert.equal(searchRecallAt(row([['a']], undefined, [search('a')]), 5), null);
  assert.deepEqual(SEARCH_K, [5, 10]);
  assert.throws(() => searchRecallAt(row([['a']], ['b'], [search('a')]), 0), /positive integer/);
});

test('A2.2: the notice rate is the share of filter misses where the model called find_source', () => {
  const rows = [
    row([['a']], ['b'], [search('a')]), // a miss, searched
    row([['a']], ['b'], [search('x')]), // a miss, searched, not found
    row([['a']], ['b'], []), // a miss, no search
    row([['a']], ['b']), // a miss, no search (no field)
    row([['a']], ['a'], [search('a')]), // no miss: does not count
    row([[]], [], []), // an empty gold: never a miss
    row([['a']]), // no shortlist: does not count
  ];
  assert.deepEqual(rows.map(noticed), [true, true, false, false, null, null, null]);
  assert.deepEqual(noticeRate(rows), { n: 4, hits: 2, rate: 0.5 });
  assert.deepEqual(rate(rows, (r) => searchRecallAt(r, 5)), { n: 2, hits: 1, rate: 0.5 });
  assert.deepEqual(rate(rows, filterRecall), { n: 6, hits: 2, rate: 2 / 6 });
  assert.deepEqual(rate([], noticed), { n: 0, hits: 0, rate: null });
});
