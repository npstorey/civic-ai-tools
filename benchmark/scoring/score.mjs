// Moved from R5's chooser spike (lib/score.mjs, unchanged below this header).
// The same function scores a row's loads in the runner and in the scorer.

// Score a loaded alias set against a question's labels. Shared by the rule
// chooser and the run analysis, so both are scored by the same function.
//
//   exact       — matches the only acceptable set
//   acceptable  — matches one of several acceptable sets
//   over        — over-loaded: a strict superset of a non-empty acceptable set,
//                 or any load on a question whose only label is "load nothing"
//   missing     — no load where one was needed, or a strict subset of an
//                 acceptable set
//   wrong       — anything else

const key = (set) => [...new Set(set)].sort().join(',');
const isSubset = (a, b) => a.every((x) => b.includes(x));

export function scoreLoad(loaded, acceptable) {
  const L = [...new Set(loaded)].sort();
  const match = acceptable.some((s) => key(s) === key(L));
  if (match) return acceptable.length === 1 ? 'exact' : 'acceptable';
  if (L.length === 0) return 'missing';
  if (acceptable.some((s) => s.length > 0 && isSubset(s, L))) return 'over';
  if (acceptable.every((s) => s.length === 0)) return 'over';
  if (acceptable.some((s) => isSubset(L, s))) return 'missing';
  return 'wrong';
}

export const CORRECT = new Set(['exact', 'acceptable']);
