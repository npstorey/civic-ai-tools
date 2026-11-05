// The scorer's S1 summary: one run directory written by the S1 runner
// (meta.json carries `steps`), per step and model. Pure: no clock, no path,
// no I/O; analyze.mjs reads the three files and writes what this returns.
//
// WHAT IT REPORTS, per step × model (a step is one configuration over one
// inventory; benchmark/preregistration/s1.md, "Metric definitions"):
//
//   - rows: started (complete + error), complete, error; `uniqueRows =
//     completeRows + errorRows` over the rows started. An error row counts in
//     the error class and in no recall or precision denominator.
//   - first-request and after-the-second accuracy (R5's five classes, exact
//     and acceptable correct) against the RAW gold and the OFFERED gold
//     (offered.mjs), each split by gold, not by `kind`: need-source (no empty
//     set), no-source (every set empty) and open (both);
//   - precision as R5's `over` class: the share of rows that loaded a strict
//     superset of a gold set, or anything where only "load nothing" is gold;
//   - filter recall, search recall at 5 and 10, the notice rate
//     (metrics.mjs), where the rows carry a shortlist and searches;
//   - the pick counts (the seat's notes): rows whose first-request loads were
//     correct (offered gold) and held a synthetic copy; rows whose first pick
//     was a registry entry; rows whose first pick was a CKAN pack;
//   - the request after a load: its outcomes as R5 classed them;
//   - tokens (first-request prompt median, min, max; prompt and completion
//     tokens per row, completion tokens per request; the directory's share of
//     the first request's characters; reasoning tokens), latency (median and
//     p90), cost (in all, and per row), consistency over repeats.
//
// Builder rows and rule rows are summarized apart: a builder step's
// selections (empty, dropped aliases, filter recall of the selection as a
// shortlist), and a rule step's search recall at 5 and 10.

import { CORRECT } from './score.mjs';
import { filterRecall, noticeRate, rate, SEARCH_K, searchRecallAt } from './metrics.mjs';
import { goldClass, rowScores } from './offered.mjs';

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const r4 = (x) => (x === null || x === undefined ? null : Number(x.toFixed(4)));
const pct = (n, d) => (d ? r4(n / d) : null);
const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const quantile = (xs, q) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null;
};
const rated = (r) => ({ n: r.n, hits: r.hits, rate: r4(r.rate) });

/** Accuracy over `rows` against one gold (`which`: raw or offered). */
function accuracy(rows, which) {
  const scored = rows.map((r) => ({ r, s: rowScores(r)[which] }));
  const counts1 = {};
  const counts2 = {};
  const bySplit = {};
  for (const { s } of scored) {
    counts1[s.score1] = (counts1[s.score1] ?? 0) + 1;
    counts2[s.score2] = (counts2[s.score2] ?? 0) + 1;
    const b = (bySplit[s.class] ??= { n: 0, correct1: 0, correct2: 0 });
    b.n++;
    if (CORRECT.has(s.score1)) b.correct1++;
    if (CORRECT.has(s.score2)) b.correct2++;
  }
  const c1 = scored.filter(({ s }) => CORRECT.has(s.score1)).length;
  const c2 = scored.filter(({ s }) => CORRECT.has(s.score2)).length;
  return {
    n: scored.length,
    firstRequest: pct(c1, scored.length),
    afterSecondRequest: pct(c2, scored.length),
    overLoading: pct(counts1.over ?? 0, scored.length),
    counts1: Object.fromEntries(Object.entries(counts1).sort()),
    counts2: Object.fromEntries(Object.entries(counts2).sort()),
    bySplit: Object.fromEntries(Object.entries(bySplit).sort()),
  };
}

function mainSummary(rows) {
  const complete = rows.filter((r) => r.status === 'complete');
  const errors = rows.filter((r) => r.status === 'error');
  const seconds = complete.filter((r) => r.second && !r.second.error);
  const outcomes = {};
  for (const r of seconds) outcomes[r.second.outcome] = (outcomes[r.second.outcome] ?? 0) + 1;
  const firstPrompt = complete.map((r) => r.first?.usage?.prompt_tokens);
  const requestsOf = (r) => [...(r.requests?.length ? r.requests : [r.first]), r.second].filter((q) => q && !q.error);
  const perRow = (f) => complete.filter((r) => !r.noRequest).map((r) => requestsOf(r).reduce((s, q) => s + num(f(q)), 0));
  const share = complete.map((r) => (r.first?.directoryChars && r.first?.promptChars ? r.first.directoryChars / r.first.promptChars : null));
  const reasoning = complete.reduce(
    (s, r) =>
      s +
      [...(r.requests?.length ? r.requests : [r.first]), r.second].reduce((t, q) => t + num(q?.usage?.completion_tokens_details?.reasoning_tokens), 0),
    0,
  );
  const byQ = new Map();
  for (const r of complete) {
    if (!byQ.has(r.qid)) byQ.set(r.qid, []);
    byQ.get(r.qid).push([...(r.loaded1 ?? [])].sort().join(','));
  }
  const multi = [...byQ.values()].filter((v) => v.length > 1);
  const offeredCorrect = complete.filter((r) => CORRECT.has(rowScores(r).offered.score1));
  const searchRows = complete.filter((r) => Array.isArray(r.searches));
  return {
    rows: rows.length,
    complete: complete.length,
    errors: errors.length,
    uniqueRows: complete.length + errors.length,
    noRequestRows: complete.filter((r) => r.noRequest).length,
    raw: accuracy(complete, 'raw'),
    offered: accuracy(complete, 'offered'),
    filterRecall: rated(rate(complete, filterRecall)),
    searchRecall: Object.fromEntries(SEARCH_K.map((k) => [`at${k}`, rated(rate(complete, (r) => searchRecallAt(r, k)))])),
    notice: rated(noticeRate(complete)),
    searches: searchRows.length ? { rowsThatSearched: searchRows.filter((r) => r.searches.length).length, calls: searchRows.reduce((s, r) => s + r.searches.length, 0), limitTexts: searchRows.reduce((s, r) => s + num(r.limitTexts), 0) } : null,
    picks: {
      correctWithSyntheticCopy: offeredCorrect.filter((r) => (r.picks ?? []).some((p) => p.synthetic)).length,
      firstPickRegistry: complete.filter((r) => r.picks?.[0]?.registry).length,
      firstPickCkanPack: complete.filter((r) => r.picks?.[0]?.ckanPack).length,
    },
    firstCallIsLoad: pct(complete.filter((r) => r.firstCallIsLoad).length, complete.length),
    invalidAliasCalls: complete.reduce((s, r) => s + (r.first?.invalidAliases?.length ?? 0) + (r.requests ?? []).slice(0, -1).reduce((t, q) => t + (q.invalidAliases?.length ?? 0), 0), 0),
    consistency: { questionsAllRepeatsSame: pct(multi.filter((v) => v.every((x) => x === v[0])).length, multi.length), n: multi.length },
    secondRequest: { made: seconds.length, outcomes: Object.fromEntries(Object.entries(outcomes).sort()), validRate: pct(outcomes.valid_tool_call ?? 0, seconds.length) },
    tokens: {
      firstRequestPromptMedian: median(firstPrompt),
      firstRequestPromptMin: firstPrompt.some((x) => typeof x === 'number') ? Math.min(...firstPrompt.filter((x) => typeof x === 'number')) : null,
      firstRequestPromptMax: firstPrompt.some((x) => typeof x === 'number') ? Math.max(...firstPrompt.filter((x) => typeof x === 'number')) : null,
      reasoningTokens: reasoning,
      promptPerRowMedian: median(perRow((q) => q.usage?.prompt_tokens)),
      completionPerRowMedian: median(perRow((q) => q.usage?.completion_tokens)),
      completionPerRequestMedian: median(complete.flatMap((r) => requestsOf(r).map((q) => q.usage?.completion_tokens))),
      directoryShareMedian: r4(median(share)),
    },
    latencyMs: {
      firstMedian: median(complete.map((r) => r.first?.latencyMs)),
      firstP90: quantile(complete.map((r) => r.first?.latencyMs), 0.9),
      secondMedian: median(seconds.map((r) => r.second.latencyMs)),
      secondP90: quantile(seconds.map((r) => r.second.latencyMs), 0.9),
    },
    costUsd: r4(rows.reduce((s, r) => s + num(r.costUsd), 0)),
    costPerRowMean: complete.length ? r4(complete.reduce((s, r) => s + num(r.costUsd), 0) / complete.length) : null,
  };
}

function builderSummary(rows) {
  const complete = rows.filter((r) => r.status === 'complete');
  return {
    rows: rows.length,
    complete: complete.length,
    errors: rows.filter((r) => r.status === 'error').length,
    emptySelections: complete.filter((r) => !r.selection?.length).length,
    droppedAliases: complete.reduce((s, r) => s + (r.dropped?.length ?? 0), 0),
    outcomes: Object.fromEntries(Object.entries(complete.reduce((o, r) => ({ ...o, [r.outcome]: (o[r.outcome] ?? 0) + 1 }), {})).sort()),
    selectionFilterRecall: rated(rate(complete, filterRecall)),
    costUsd: r4(rows.reduce((s, r) => s + num(r.costUsd), 0)),
  };
}

const ruleSummary = (rows) => ({
  rows: rows.length,
  searchRecall: Object.fromEntries(SEARCH_K.map((k) => [`at${k}`, rated(rate(rows, (r) => searchRecallAt(r, k)))])),
  goldClasses: Object.fromEntries(Object.entries(rows.reduce((o, r) => ({ ...o, [goldClass(r.acceptable)]: (o[goldClass(r.acceptable)] ?? 0) + 1 }), {})).sort()),
});

/** The S1 summary of a run's parsed meta, rows and baselines. */
export function summarizeS1({ meta, rows, base, files, rowLines }) {
  const groups = [];
  for (const step of meta.steps) {
    const stepRows = rows.filter((r) => (r.step ?? step.id) === step.id);
    const roles = [...new Set(stepRows.map((r) => r.role))];
    for (const role of roles) {
      const rs = stepRows.filter((r) => r.role === role);
      if (role === 'rule') groups.push({ step: step.id, config: step.config, role, ...ruleSummary(rs) });
      else if (role === 'builder') groups.push({ step: step.id, config: step.config, role, model: rs[0]?.spec ?? null, ...builderSummary(rs) });
      else for (const spec of [...new Set(rs.map((r) => r.spec))]) groups.push({ step: step.id, config: step.config, role, model: spec, ...mainSummary(rs.filter((r) => r.spec === spec)) });
    }
  }
  const completeRows = rows.filter((r) => r.status === 'complete').length;
  const errorRows = rows.filter((r) => r.status === 'error').length;
  const spent = rows.reduce((s, r) => s + num(r.costUsd), 0) + base.reduce((s, b) => s + num(b.cost?.charged) + (b.tried ?? []).reduce((t, x) => t + num(x.cost?.charged), 0), 0);
  return {
    files,
    runId: meta.runId,
    mode: meta.mode,
    today: meta.today,
    plan: meta.plan ?? null,
    openWeight: meta.openWeight ?? null,
    inputsHash: meta.inputsHash?.hash ?? null,
    expectedRows: meta.expectedRows,
    uniqueRows: completeRows + errorRows,
    completeRows,
    errorRows,
    notStarted: meta.rowsNotStarted?.count ?? null,
    stopReason: meta.stopReason ?? null,
    rowLines,
    spentUsd: r4(spent),
    configurations: Object.fromEntries(Object.entries(meta.configurations ?? {}).map(([k, v]) => [k, { routingConfigurationHash: v.routingConfigurationHash, firstRequestDefinitionHash: v.firstRequestDefinitionHash }])),
    groups,
  };
}
