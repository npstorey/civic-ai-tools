// The scorer's S3-C section (benchmark/preregistration/s3c.md, "The
// metrics"): what a run whose rows ran under the stub transport adds to S1's
// summary (s1.mjs, unchanged). Pure: no clock, no path, no I/O; analyze.mjs
// reads the files and hands their texts here. A run with no stub row gets no
// such section, so S1's summaries keep their bytes.
//
// Per step and model, for each stub step:
//   - how its rows ended (`stub.endedBy`, `stub.answeringReason`);
//   - tokens and cost per question: the requests sent after S1's last
//     (median and largest), the prompt and completion tokens of the whole row
//     (medians), the cost of the whole row and of S1's requests alone (totals
//     and means per row). S1's own cost fields sum a row's `costUsd`, the
//     whole row's;
//   - for `builder+search-N`, the notice rate behind the builder: S1's
//     `noticed` (metrics.mjs) over every row and over the rows that sent a
//     request, and `noticedByEnd`, which also counts a search run after S1's
//     last request;
//   - the unnoticed miss (unnoticed.mjs): by the rule, and, once the labels
//     are committed, by the two labelling sessions (counting a row as not
//     saying when both labelled it `does-not-say`, and when either did).
// And for the run:
//   - first-request accuracy on the raw gold, `builder+search-N` paired with
//     `builder-N` and with `shortlist+search-N` by model, question and repeat:
//     the discordant counts and an exact two-sided McNemar test (a binomial
//     test on the discordant pairs). No threshold decides anything;
//   - the builder's read priced per question: S1's measurement, not measured
//     again (`S1_BUILDER_READS`);
//   - the labelling records named by their sha256, and the two sessions'
//     agreement and kappa over the sheet and over its misses.

import { CORRECT } from './score.mjs';
import { filterRecall, noticed, rate } from './metrics.mjs';
import { rowScores } from './offered.mjs';
import { readLabels, readSalt, rowId, saltSha256, agreement, sheetMembers } from './sheet.mjs';
import { ruleNotSay, unnoticedMissFigures } from './unnoticed.mjs';
import { createHash } from 'node:crypto';

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const r4 = (x) => (x === null || x === undefined ? null : Number(x.toFixed(4)));
const rated = (r) => ({ n: r.n, hits: r.hits, rate: r4(r.rate) });
const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const counts = (xs) => Object.fromEntries(Object.entries(xs.reduce((o, x) => ({ ...o, [x]: (o[x] ?? 0) + 1 }), {})).sort());

/** The builder's reads S1 ran on 2026-11-05 (S1's committed evaluations,
 *  steps `builder-<N>-reads`): their cost over the 149 questions. */
export const S1_BUILDER_READS = Object.freeze({
  runId: '2026-11-05-run-191511',
  rowsSha256: '316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c',
  questions: 149,
  totalUsd: Object.freeze({ 50: 0.1479, 200: 0.5017, 1000: 11.1883 }),
});

/** The read's price per question, per size. */
export const builderReadPrice = () =>
  Object.fromEntries(Object.entries(S1_BUILDER_READS.totalUsd).map(([n, usd]) => [n, { totalUsd: usd, perQuestionUsd: r4(usd / S1_BUILDER_READS.questions) }]));

/** The exact two-sided McNemar test on `b` and `c` discordant pairs: the
 *  binomial probability, at one half, of a split at least as uneven. */
export function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let term = Math.pow(0.5, n);
  let tail = 0;
  for (let i = 0; i <= k; i++) {
    tail += term;
    term *= (n - i) / (i + 1);
  }
  return Math.min(1, 2 * tail);
}

/** Paired first-request accuracy on the raw gold: `rowsA` against `rowsB`,
 *  matched by model, question and repeat over the complete rows of both. */
export function pairedFirstRequest(rowsA, rowsB) {
  const key = (r) => `${r.spec}|${r.qid}|${r.repeat}`;
  const correct = (r) => CORRECT.has(rowScores(r).raw.score1);
  const b = new Map(rowsB.filter((r) => r.status === 'complete').map((r) => [key(r), r]));
  const out = { pairs: 0, both: 0, onlyFirst: 0, onlySecond: 0, neither: 0 };
  for (const r of rowsA.filter((x) => x.status === 'complete')) {
    const o = b.get(key(r));
    if (!o) continue;
    out.pairs++;
    const x = correct(r);
    const y = correct(o);
    if (x && y) out.both++;
    else if (x) out.onlyFirst++;
    else if (y) out.onlySecond++;
    else out.neither++;
  }
  return { ...out, mcnemarP: Number(mcnemarExact(out.onlyFirst, out.onlySecond).toFixed(6)) };
}

/** S1's `noticed`, counting also the searches run after S1's last request. */
export function noticedByEnd(row) {
  if (filterRecall(row) !== false) return null;
  return (row.searches?.length ?? 0) + (row.stub?.searches?.length ?? 0) > 0;
}

/** The notice rate behind the builder, over a `builder+search-N` step's
 *  complete rows. */
export function noticeBehindBuilder(complete) {
  const sent = complete.filter((r) => !r.noRequest);
  return {
    noticed: { allRows: rated(rate(complete, noticed)), rowsThatSentARequest: rated(rate(sent, noticed)) },
    noticedByEnd: { allRows: rated(rate(complete, noticedByEnd)), rowsThatSentARequest: rated(rate(sent, noticedByEnd)) },
  };
}

const s1Cost = (r) => (r.stub ? num(r.stub.s1CostUsd) : num(r.costUsd));
const allRequests = (r) => [...(r.requests?.length ? r.requests : [r.first]), r.second, ...(r.stub?.requests ?? [])].filter((q) => q && !q.error);

/** One stub step and model. */
function stubGroup(rows, notSayByLabels) {
  const complete = rows.filter((r) => r.status === 'complete');
  const stubbed = complete.filter((r) => r.stub);
  const out = {
    rows: rows.length,
    complete: complete.length,
    rowsThatWentOn: stubbed.length,
    endedBy: counts(stubbed.map((r) => r.stub.endedBy)),
    answeringReason: counts(stubbed.filter((r) => r.stub.answeringReason).map((r) => r.stub.answeringReason)),
    requestsAfterS1: { median: median(stubbed.map((r) => r.stub.requests.length)), largest: stubbed.length ? Math.max(...stubbed.map((r) => r.stub.requests.length)) : null },
    tokens: {
      promptPerRowMedian: median(stubbed.map((r) => allRequests(r).reduce((s, q) => s + num(q.usage?.prompt_tokens), 0))),
      completionPerRowMedian: median(stubbed.map((r) => allRequests(r).reduce((s, q) => s + num(q.usage?.completion_tokens), 0))),
    },
    costUsd: r4(rows.reduce((s, r) => s + num(r.costUsd), 0)),
    s1CostUsd: r4(rows.reduce((s, r) => s + s1Cost(r), 0)),
    costPerRowMeanUsd: complete.length ? r4(complete.reduce((s, r) => s + num(r.costUsd), 0) / complete.length) : null,
    s1CostPerRowMeanUsd: complete.length ? r4(complete.reduce((s, r) => s + s1Cost(r), 0) / complete.length) : null,
    unnoticedMiss: {
      rule: unnoticedMissFigures(complete, ruleNotSay),
      labels: notSayByLabels ? { bothSayNot: unnoticedMissFigures(complete, notSayByLabels.both), eitherSaysNot: unnoticedMissFigures(complete, notSayByLabels.either) } : null,
    },
  };
  if (rows[0]?.config?.startsWith('builder+search-')) out.noticeBehindBuilder = noticeBehindBuilder(complete);
  return out;
}

/** The labelling records, read: null until the sheet, the salt and both
 *  readings are in the run directory. */
function labelsOf(rows, labels) {
  if (!labels?.sheet || !labels?.saltSha256) return { notSay: null, record: labels?.sheet ? { files: { 'labels/sheet.jsonl': sha256(labels.sheet), 'labels/salt.sha256': labels.saltSha256 ? sha256(labels.saltSha256) : null }, status: 'labels not yet read' } : null };
  const files = Object.fromEntries(
    [['labels/sheet.jsonl', labels.sheet], ['labels/salt.sha256', labels.saltSha256], ['labels/batches.json', labels.batches], ['labels/a.jsonl', labels.a], ['labels/b.jsonl', labels.b], ['labels/salt.txt', labels.salt]].filter(([, t]) => t).map(([p, t]) => [p, sha256(t)]),
  );
  if (!labels.salt || !labels.a || !labels.b) return { notSay: null, record: { files, status: 'labels not yet read' } };
  const salt = readSalt(labels.salt);
  if (saltSha256(salt) !== labels.saltSha256.trim()) return { notSay: null, record: { files, status: "labels/salt.txt does not hash to labels/salt.sha256; the labels are not read" } };
  const ids = labels.sheet.split('\n').filter(Boolean).map((l) => JSON.parse(l).id);
  const members = sheetMembers(rows, salt);
  const kindOf = new Map(members.map((m) => [m.id, m.kind]));
  if (ids.length !== members.length || ids.some((id) => !kindOf.has(id))) return { notSay: null, record: { files, status: "labels/sheet.jsonl is not the sheet the run's rows and the salt give; the labels are not read" } };
  const a = readLabels(labels.a, ids);
  const b = readLabels(labels.b, ids);
  const idOfKey = new Map(rows.map((r) => [r.key, rowId(salt, r.key)]));
  const pair = (r) => {
    const id = idOfKey.get(r.key);
    if (!kindOf.has(id)) return null;
    const x = a.get(id);
    const y = b.get(id);
    if (x === 'no-answer' || y === 'no-answer' || x === 'unparsed' || y === 'unparsed') return null;
    return [x, y];
  };
  const both = (r) => {
    const p = pair(r);
    return p === null ? null : p[0] === 'does-not-say' && p[1] === 'does-not-say';
  };
  const either = (r) => {
    const p = pair(r);
    return p === null ? null : p[0] === 'does-not-say' || p[1] === 'does-not-say';
  };
  const missIds = ids.filter((id) => kindOf.get(id) === 'miss');
  const labelCounts = (m) => counts(ids.map((id) => m.get(id)));
  return {
    notSay: { both, either },
    record: {
      files,
      status: 'read',
      sheetRows: ids.length,
      misses: missIds.length,
      labels: { a: labelCounts(a), b: labelCounts(b) },
      agreement: { sheet: agreement(a, b, ids), misses: agreement(a, b, missIds) },
      disputed: ids.filter((id) => a.get(id) !== b.get(id)).length,
    },
  };
}

/** The round's section of a run's summary; null for a run with no stub row. */
export function summarizeRound({ meta, rows, labels = null }) {
  if (!rows.some((r) => r.transport === 'stub')) return null;
  const lab = labelsOf(rows, labels);
  const groups = [];
  for (const step of meta.steps) {
    const stepRows = rows.filter((r) => r.step === step.id && r.role === 'main' && r.transport === 'stub');
    for (const spec of [...new Set(stepRows.map((r) => r.spec))]) groups.push({ step: step.id, config: step.config, model: spec, ...stubGroup(stepRows.filter((r) => r.spec === spec), lab.notSay) });
  }
  // E against each comparator, per model and size, within this run.
  const paired = [];
  const stepOf = (config) => meta.steps.find((s) => s.config === config);
  for (const e of meta.steps.filter((s) => s.config.startsWith('builder+search-'))) {
    const n = e.config.slice('builder+search-'.length);
    for (const other of [`builder-${n}`, `shortlist+search-${n}`]) {
      const o = stepOf(other);
      if (!o) continue;
      const eRows = rows.filter((r) => r.step === e.id && r.role === 'main');
      const oRows = rows.filter((r) => r.step === o.id && r.role === 'main');
      for (const spec of [...new Set(eRows.map((r) => r.spec))]) paired.push({ first: e.id, second: o.id, model: spec, ...pairedFirstRequest(eRows.filter((r) => r.spec === spec), oRows.filter((r) => r.spec === spec)) });
    }
  }
  return { groups, paired, builderReadPrice: { source: { runId: S1_BUILDER_READS.runId, rowsSha256: S1_BUILDER_READS.rowsSha256 }, perSize: builderReadPrice() }, labels: lab.record };
}
