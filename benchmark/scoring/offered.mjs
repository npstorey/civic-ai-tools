// A row's gold over what its configuration offered (the seat's read, hub #302
// comment 6614538094), beside the raw gold.
//
//   raw gold      the question's `acceptable` for the row's inventory, as
//                 labelled (benchmark/questions/README.md), whatever the
//                 configuration listed.
//   offered gold  the acceptable sets every alias of which was offered to the
//                 model in that row: the row's directory, plus every entry a
//                 `find_source` call added to it (`row.offered`). When no
//                 acceptable set was wholly offered, the offered gold is
//                 [[]]: with no offered source able to answer, loading
//                 nothing is the right move. So the seven questions whose gold
//                 at 7 is `boston` are scored under `baseline-7`, which does
//                 not list Boston, as questions with no offered source.
//
// A row that records no `offered` (R5's rows) has none: its offered gold is
// its raw gold.

import { scoreLoad } from './score.mjs';

/** The offered gold of `acceptable` given the aliases `offered`. */
export function offeredGold(acceptable, offered) {
  if (!Array.isArray(offered)) return acceptable;
  const kept = acceptable.filter((set) => set.every((alias) => offered.includes(alias)));
  return kept.length ? kept : [[]];
}

/** The gold's class: `no-source` (every set empty), `need-source` (no set
 *  empty) or `open` (an empty set beside a non-empty one: rule 10). The split
 *  is by gold, not by the question's `kind`. */
export function goldClass(gold) {
  const empty = gold.filter((s) => s.length === 0).length;
  if (empty === gold.length) return 'no-source';
  if (empty === 0) return 'need-source';
  return 'open';
}

/** A row's two scores, first request and after the second, against the raw
 *  and the offered gold. */
export function rowScores(row) {
  const offered = offeredGold(row.acceptable, row.offered);
  const loaded1 = row.loaded1 ?? [];
  const loaded2 = row.loaded2 ?? loaded1;
  return {
    raw: { gold: row.acceptable, class: goldClass(row.acceptable), score1: scoreLoad(loaded1, row.acceptable), score2: scoreLoad(loaded2, row.acceptable) },
    offered: { gold: offered, class: goldClass(offered), score1: scoreLoad(loaded1, offered), score2: scoreLoad(loaded2, offered) },
  };
}
