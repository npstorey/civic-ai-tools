#!/usr/bin/env node
// The S3-C report's tables (hub #318, M3), rendered from the round's
// summaries so no figure in benchmark/reports/s3c.md is typed. A sibling of
// S1's `tables.mjs`, which is not edited: that script reads `groups[]` and
// needs an open-weight probe's summary, and the round ran none.
//
// Usage: node benchmark/report/round-tables.mjs <runs/<date> dir> [--out <file>] [--check] [--s1 <file>]
//
//   Writes `<dir>/tables.out.md` (or --out). With --check, writes nothing and
//   exits 1 when that file is not what this script renders.
//
// WHAT IT READS: only each run directory's `summary.json` under <dir>, the
// scorer's output: one of mode `evaluations` with the round's section
// (`round`, benchmark/scoring/round.mjs) and one of mode `probe`; and S1's
// run summary (`S1_SUMMARY`, or --s1), for S1's comparator rows beside this
// run's (benchmark/preregistration/s3c.md:287-288), and nothing else of S1's
// folder. Never `rows.jsonl`, `meta.json`, the labels or any other file.
//
// WHAT IT PRINTS: every number is a value of a summary, printed as the
// summary holds it. The script does no arithmetic on a figure: no sum, no
// difference, no ratio, no rounding. Where a table compares two figures it
// prints the comparison's outcome in words, never a computed number.
// Identifiers (a step, a model, a run id, a field path, a hash) are in code
// spans. So benchmark/test/report-round-tables.test.mjs can find every
// printed number among the summaries' values (the seat's condition for S1's
// tables, hub #302 comment 6662114479).
//
// Not under benchmark/runner/ or benchmark/scoring/, so it is outside the
// inputs' hash (benchmark/preregistration/s3c.md, "One move means one"): it
// renders the run, it measures nothing.

import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** S1's run summary: S1's rows of the comparators, `builder-N` and
 *  `shortlist+search-N`. */
export const S1_SUMMARY = fileURLToPath(new URL('../runs/2026-11-05/2026-11-05-run-191511/summary.json', import.meta.url));

/** The round's configurations, in the preregistration's run order. */
const FAMILIES = ['builder+search', 'builder', 'shortlist+search'];
/** How a stub row ended, as the round's figures split it. */
const SPLITS = [
  ['answer', 'the answers a row gave unasked'],
  ['answeringTurn', 'the answers to the final-answer request'],
  ['all', 'the two together'],
];

/** Every run directory's summary under `dir`, by mode. */
export function readSummaries(dir) {
  const byMode = {};
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name, 'summary.json');
    if (!statSync(join(dir, name)).isDirectory() || !existsSync(path)) continue;
    const summary = JSON.parse(readFileSync(path, 'utf8'));
    if (byMode[summary.mode]) throw new Error(`two summaries of mode ${summary.mode} under ${dir}`);
    byMode[summary.mode] = { name, summary };
  }
  for (const mode of ['evaluations', 'probe']) if (!byMode[mode]) throw new Error(`no summary of mode ${mode} under ${dir}`);
  if (!byMode.evaluations.summary.round) throw new Error(`the evaluations' summary under ${dir} has no round section`);
  if (byMode.evaluations.summary.round.labels?.status !== 'read') throw new Error(`the evaluations' summary under ${dir} has not read the labels`);
  return byMode;
}

const code = (s) => `\`${s}\``;
const cell = (v) => (v === null || v === undefined ? '—' : String(v));
const usd = (v) => (v === null || v === undefined ? '—' : `$${v}`);
const rated = (r) => (r && r.n ? `${r.hits} of ${r.n} (${r.rate})` : '— (none apply)');
const row = (cells) => `| ${cells.join(' | ')} |`;
const header = (cells) => `${row(cells)}\n|${cells.map(() => '---').join('|')}|`;
const sizeOf = (step) => Number(/-(\d+)(?:-reads)?$/.exec(step)?.[1] ?? 0);
const familyOf = (step) => step.replace(/^probe-/, '').replace(/-\d+(?:-reads)?$/, '');
const compare = (a, b, more, less) => (a === null || a === undefined || b === null || b === undefined ? '—' : a > b ? more : a < b ? less : 'equal');

/** The tables, as markdown. */
export function renderTables(dir, s1Path = S1_SUMMARY) {
  const S = readSummaries(dir);
  const s1 = JSON.parse(readFileSync(s1Path, 'utf8'));
  if (s1.mode !== 'evaluations') throw new Error(`${s1Path} is not an evaluations summary`);
  const s1Find = (step, model) => s1.groups.find((g) => g.step === step && g.model === model && g.role === 'main') ?? null;
  const ev = S.evaluations.summary;
  const pr = S.probe.summary;
  const R = ev.round;
  // Haiku 5.5 (the builder's model) first, then the open-weight model.
  const models = [...new Set(ev.groups.map((g) => g.model))].sort((a, b) => (a === ev.openWeight) - (b === ev.openWeight) || a.localeCompare(b));
  const order = (a, b) => FAMILIES.indexOf(familyOf(a.step)) - FAMILIES.indexOf(familyOf(b.step)) || sizeOf(a.step) - sizeOf(b.step) || models.indexOf(a.model) - models.indexOf(b.model);
  const mains = ev.groups.filter((g) => g.role === 'main').sort(order);
  const stubs = [...R.groups].sort(order);
  const probes = [...pr.round.groups].sort(order);
  const find = (step, model) => ev.groups.find((g) => g.step === step && g.model === model && g.role === 'main') ?? null;
  const sizes = [...new Set(mains.map((g) => sizeOf(g.step)))].sort((a, b) => a - b);
  const es = mains.filter((g) => familyOf(g.step) === 'builder+search');
  const at = (path) => `${code(`${S.evaluations.name}/summary.json`)} → ${code(path)}`;
  const out = [];
  const p = (...lines) => out.push(...lines);

  // The figure of item one is the same under every reading of "says" (it
  // does not read the answer); the renderer prints the rule's copy and holds
  // the other two equal to it.
  for (const g of stubs) {
    for (const [split] of SPLITS) {
      const u = g.unnoticedMiss;
      const ref = JSON.stringify([u.rule[split].missesAtEnd, u.rule[split].endedBySizeOrError]);
      for (const reading of ['bothSayNot', 'eitherSaysNot']) {
        if (JSON.stringify([u.labels[reading][split].missesAtEnd, u.labels[reading][split].endedBySizeOrError]) !== ref) throw new Error(`${g.step} ${g.model} ${split}: the misses at the end differ between readings`);
      }
    }
  }

  p(`**The run directories** (each ${code('summary.json')} → ${code('runId')}, ${code('mode')}, ${code('today')}, ${code('completeRows')}, ${code('expectedRows')}, ${code('errorRows')}, ${code('notStarted')}, ${code('stopReason')}, ${code('spentUsd')}, ${code('inputsHash')}, ${code('files')}). ${code('today')} is the date every request stated.`, '');
  p(header(['Run directory', 'Mode', 'Date stated', 'Rows complete', 'Rows expected', 'Error rows', 'Not started', 'Stop', 'Recorded spend, at list price', "The inputs' hash", `${code('rows.jsonl')} sha256`]));
  for (const mode of ['probe', 'evaluations']) {
    const s = S[mode].summary;
    p(row([code(s.runId), code(s.mode), code(s.today), cell(s.completeRows), cell(s.expectedRows), cell(s.errorRows), cell(s.notStarted), s.stopReason === null ? 'none' : code(s.stopReason), usd(s.spentUsd), code(s.inputsHash), code(s.files['rows.jsonl'])]));
  }

  p('', `**The probe** (${code(`${S.probe.name}/summary.json`)} → ${code('groups[]')}: ${code('raw.firstRequest')}, ${code('offered.firstRequest')}; ${code('round.groups[]')}: ${code('endedBy')}, ${code('requestsAfterS1')}, ${code('costUsd')}, ${code('s1CostUsd')}). One repeat of the probe's questions on both models; every probe row also sent the answering request, recorded apart from its answer. A rate here is over the probe's rows.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'Complete', 'First request, raw gold', 'First request, offered gold', 'Ended by an answer', 'Ended by the answering turn', 'Requests after S1\'s last, median', 'Largest', 'Cost of the rows, whole', 'Cost of S1\'s requests']));
  for (const g of probes) {
    const s1 = pr.groups.find((x) => x.step === g.step && x.model === g.model);
    p(row([code(g.step), code(g.model), cell(g.rows), cell(g.complete), cell(s1?.raw.firstRequest), cell(s1?.offered.firstRequest), cell(g.endedBy.answer ?? 0), cell(g.endedBy['answering-turn'] ?? 0), cell(g.requestsAfterS1.median), cell(g.requestsAfterS1.largest), usd(g.costUsd), usd(g.s1CostUsd)]));
  }

  p('', `**E against the comparators, first request** (${at('groups[].raw.firstRequest')} and ${code('offered.firstRequest')}; S1's rows, ${code(`${s1.runId}/summary.json`)} → the same fields): per model and size, ${code('builder+search-N')} (the design's E) beside ${code('builder-N')} (the same directory, no search) and ${code('shortlist+search-N')} (the same search over the place filter's shortlist), this run's rows and S1's. S1's rows sent the same requests to the same models on another day (the preregistration, "The comparators"). Correct is ${code('exact')} or ${code('acceptable')}. The comparison columns compare the first request on the raw gold in words: E against each comparator, this run's and S1's, and each comparator's run against its S1 rows.`, '');
  p(header(['Model', 'E', 'Rows', 'E, raw gold', 'E, offered gold', 'Builder', 'Builder, raw gold', 'Builder, offered gold', "S1's builder, raw gold", "S1's builder, offered gold", 'Place filter with search', 'Its raw gold', 'Its offered gold', "S1's place filter, raw gold", "S1's place filter, offered gold", 'E against the builder, raw', "E against S1's builder, raw", 'E against the place filter, raw', "E against S1's place filter, raw", "This run's builder against S1's, raw", "This run's place filter against S1's, raw"]));
  const vs = (a, b) => compare(a, b, 'above', 'below');
  for (const model of models) {
    for (const size of sizes) {
      const e = find(`builder+search-${size}`, model);
      const b = find(`builder-${size}`, model);
      const s = find(`shortlist+search-${size}`, model);
      const b1 = s1Find(`builder-${size}`, model);
      const s1s = s1Find(`shortlist+search-${size}`, model);
      if (!e) continue;
      const eVs = (x) => compare(e.raw.firstRequest, x?.raw.firstRequest, 'E above', 'E below');
      p(row([code(model), code(e.step), cell(e.rows), cell(e.raw.firstRequest), cell(e.offered.firstRequest), b ? code(b.step) : '—', cell(b?.raw.firstRequest), cell(b?.offered.firstRequest), cell(b1?.raw.firstRequest), cell(b1?.offered.firstRequest), s ? code(s.step) : '—', cell(s?.raw.firstRequest), cell(s?.offered.firstRequest), cell(s1s?.raw.firstRequest), cell(s1s?.offered.firstRequest), eVs(b), eVs(b1), eVs(s), eVs(s1s), vs(b?.raw.firstRequest, b1?.raw.firstRequest), vs(s?.raw.firstRequest, s1s?.raw.firstRequest)]));
    }
  }

  p('', `**E against the comparators, paired on the raw gold** (${at('round.paired[]')}: ${code('pairs')}, ${code('both')}, ${code('onlyFirst')}, ${code('onlySecond')}, ${code('neither')}, ${code('mcnemarP')}): this run's rows paired by model, question and repeat; the first request correct on the raw gold in both, in E only, in the comparator only, or in neither. The p is the exact two-sided McNemar test on the two discordant counts, at six places as the summary holds it. No threshold decides anything (the preregistration).`, '');
  p(header(['E', 'Comparator', 'Model', 'Pairs', 'Correct in both', 'In E only', 'In the comparator only', 'In neither', 'Exact McNemar p', 'The discordant pairs lean to']));
  const pairs = [...R.paired].sort((a, b) => order({ step: a.first, model: a.model }, { step: b.first, model: b.model }) || FAMILIES.indexOf(familyOf(a.second)) - FAMILIES.indexOf(familyOf(b.second)));
  for (const x of pairs) p(row([code(x.first), code(x.second), code(x.model), cell(x.pairs), cell(x.both), cell(x.onlyFirst), cell(x.onlySecond), cell(x.neither), cell(x.mcnemarP), compare(x.onlyFirst, x.onlySecond, 'E', 'the comparator').replace('equal', 'neither: equal')]));

  p('', `**The notice rate behind the builder** (${at('round.groups[].noticeBehindBuilder')}): over ${code('builder+search-N')}'s rows whose directory, the builder's selection, holds no whole acceptable set. ${code('noticed')} is S1's: the model called ${code('find_source')} in S1's requests. ${code('noticedByEnd')} also counts a search run after S1's last request. Each over every such row and over those that sent a request (a row with an empty selection sends none). The preregistration reports these as counts: they rest on a few questions.`, '');
  p(header(['Configuration', 'Model', 'Noticed in S1\'s requests, every such row', 'Of those that sent a request', 'Noticed by the end, every such row', 'Of those that sent a request']));
  for (const g of stubs.filter((x) => x.noticeBehindBuilder)) {
    const n = g.noticeBehindBuilder;
    p(row([code(g.step), code(g.model), rated(n.noticed.allRows), rated(n.noticed.rowsThatSentARequest), rated(n.noticedByEnd.allRows), rated(n.noticedByEnd.rowsThatSentARequest)]));
  }

  p('', `**Search recall in E** (${at('groups[].searchRecall')}: ${code('at5')}, ${code('at10')}; ${code('searches')}): S1's search recall at k over ${code('builder+search-N')}'s rows: of the rows whose directory misses and that searched in S1's requests, those whose first five, and first ten, hits complete an acceptable set. ${code('searches')} counts S1's requests' searches over every row.`, '');
  p(header(['Configuration', 'Model', 'Recall in the first five hits', 'Recall in the first ten hits', 'Rows that searched at all', 'Search calls']));
  for (const g of es) p(row([code(g.step), code(g.model), rated(g.searchRecall.at5), rated(g.searchRecall.at10), cell(g.searches?.rowsThatSearched), cell(g.searches?.calls)]));

  p('', `**How the stub rows ended** (${at('round.groups[]')}: ${code('rows')}, ${code('complete')}, ${code('rowsThatWentOn')}, ${code('endedBy')}, ${code('answeringReason')}, ${code('requestsAfterS1')}). A row that went on is a complete row that sent a request; ${code('answer')} is a response with no tool call and with text; ${code('answering-turn')} is the final-answer request's response, sent at the bound (${code('bound')}), after an empty response (${code('empty')}) or after one that announced work (${code('announcement')}); ${code('size')} and ${code('error')} end a row with no answer.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'Complete', 'Went on', 'Ended by an answer', 'Ended by the answering turn', 'Ended by size', 'Ended by an error', 'Answering turn at the bound', 'After an empty response', 'After an announcement', 'Requests after S1\'s last, median', 'Largest']));
  for (const g of stubs) {
    const e = g.endedBy;
    const a = g.answeringReason;
    p(row([code(g.step), code(g.model), cell(g.rows), cell(g.complete), cell(g.rowsThatWentOn), cell(e.answer ?? 0), cell(e['answering-turn'] ?? 0), cell(e.size ?? 0), cell(e.error ?? 0), cell(a.bound ?? 0), cell(a.empty ?? 0), cell(a.announcement ?? 0), cell(g.requestsAfterS1.median), cell(g.requestsAfterS1.largest)]));
  }

  const um = (g, reading, split) => (reading === 'rule' ? g.unnoticedMiss.rule[split] : g.unnoticedMiss.labels[reading][split]);
  const readings = [
    ['bothSayNot', 'both sessions'],
    ['eitherSaysNot', 'either session'],
    ['rule', 'the rule'],
  ];
  const lead = `Each figure is per step and model, split by how the row ended (${SPLITS.map(([k, w]) => `${code(k)}, ${w}`).join('; ')}), and given three ways: a row does not say when both labelling sessions labelled it ${code('does-not-say')} (${code('bothSayNot')}), when either did (${code('eitherSaysNot')}), and by the preregistered phrase rule (${code('rule')}), printed beside the two. A row either session labelled ${code('no-answer')} or left ${code('unparsed')} is counted beside, as is a rule reading of an empty answer.`;

  p('', `**The unnoticed miss: the misses at the end and the unnoticed-miss rate** (${at('round.groups[].unnoticedMiss')} → ${code('rule')} and ${code('labels')}: ${code('missesAtEnd')}, ${code('endedBySizeOrError')}, ${code('unnoticed')}, ${code('countedBeside')}). Item one: of the complete rows that sent a request, whose raw gold needs a source and that did not end by ${code('size')} or ${code('error')}, those none of whose acceptable sets lies within the sources the row loaded by its end; it reads no answer, so it is the same under each reading, and the rows ended by ${code('size')} or ${code('error')} are counted beside it. Item two: of those misses that have an answer, the ones whose answer does not say what could not be checked. ${lead}`, '');
  p(header(['Configuration', 'Model', 'How the row ended', 'Misses at the end', 'Ended by size or error, beside', 'Unnoticed, both sessions', 'Beside', 'Unnoticed, either session', 'Beside', 'Unnoticed, the rule', 'Beside']));
  for (const g of stubs) {
    for (const [split] of SPLITS) {
      const r = um(g, 'rule', split);
      p(row([code(g.step), code(g.model), code(split), rated(r.missesAtEnd), cell(r.endedBySizeOrError), ...readings.flatMap(([k]) => [rated(um(g, k, split).unnoticed), cell(um(g, k, split).countedBeside)])]));
    }
  }

  p('', `**The unnoticed miss: by the row's directory at its end** (${at('round.groups[].unnoticedMiss')} → ${code('byDirectory')}: ${code('modelMiss')}, ${code('directoryMiss')}). Item three: the unnoticed-miss rate over the misses whose directory at the end (the first request's directory and every hit of every search in the row) held a whole acceptable set, the model's miss, and over those whose directory never did, the directory's miss. ${lead}`, '');
  p(header(['Configuration', 'Model', 'How the row ended', "The model's miss, both sessions", 'Either session', 'The rule', "The directory's miss, both sessions", 'Either session', 'The rule']));
  for (const g of stubs) {
    for (const [split] of SPLITS) {
      p(row([code(g.step), code(g.model), code(split), ...readings.map(([k]) => rated(um(g, k, split).byDirectory.modelMiss)), ...readings.map(([k]) => rated(um(g, k, split).byDirectory.directoryMiss))]));
    }
  }

  p('', `**The unnoticed miss: as a share of the rows, and the base rate** (${at('round.groups[].unnoticedMiss')} → ${code('unnoticedOfDenominator')}, ${code('baseRate')}, ${code('baseCountedBeside')}). Item four: the unnoticed misses as a share of item one's rows. Item five, the base rate: of item one's rows that are not misses and have an answer, those whose answer says. Under the labels it is read on the sheet's rows that are not misses only; a row that is not on the sheet is counted beside. ${lead}`, '');
  p(header(['Configuration', 'Model', 'How the row ended', 'Unnoticed of the rows, both sessions', 'Either session', 'The rule', 'Base rate, both sessions', 'Beside', 'Base rate, either session', 'Beside', 'Base rate, the rule', 'Beside']));
  for (const g of stubs) {
    for (const [split] of SPLITS) {
      p(row([code(g.step), code(g.model), code(split), ...readings.map(([k]) => rated(um(g, k, split).unnoticedOfDenominator)), ...readings.flatMap(([k]) => [rated(um(g, k, split).baseRate), cell(um(g, k, split).baseCountedBeside)])]));
    }
  }

  const L = R.labels;
  p('', `**The labelling: the sheet and the two sessions** (${at('round.labels')}: ${code('sheetRows')}, ${code('misses')}, ${code('labels')}, ${code('disputed')}). The sheet holds every miss at the end that has an answer, of every stub step and model, and as many rows that are not misses; each session read every batch of it once. A row the two label differently is disputed and not settled.`, '');
  p(header(['Session', 'Sheet rows', 'Of them misses', 'says', 'does-not-say', 'no-answer', 'unparsed', 'Disputed rows']));
  for (const s of ['a', 'b']) {
    const c = L.labels[s];
    p(row([code(s), cell(L.sheetRows), cell(L.misses), cell(c.says ?? 0), cell(c['does-not-say'] ?? 0), cell(c['no-answer'] ?? 0), cell(c.unparsed ?? 0), cell(L.disputed)]));
  }

  p('', `**The labelling: agreement** (${at('round.labels.agreement')}: ${code('n')}, ${code('alike')}, ${code('share')}, ${code('kappa')}, ${code('unparsed')}): the share of rows the two sessions label alike, and the kappa statistic over the three labels, over the whole sheet and over its misses. A row either session left unparsed is counted beside.`, '');
  p(header(['Over', 'Rows both parsed', 'Labelled alike', 'Share alike', 'Kappa', 'Unparsed, beside']));
  for (const k of ['sheet', 'misses']) {
    const a = L.agreement[k];
    p(row([k === 'sheet' ? 'the sheet' : 'the misses on it', cell(a.n), cell(a.alike), cell(a.share), cell(a.kappa), cell(a.unparsed)]));
  }

  p('', `**The labelling records** (${at('round.labels.files')}): each file under the run directory's ${code('labels/')}, by its sha256 as the scorer read it.`, '');
  p(header(['File', 'sha256']));
  for (const [f, h] of Object.entries(L.files)) p(row([code(f), code(h)]));

  const B = R.builderReadPrice;
  p('', `**The builder's read priced per question** (${at('round.builderReadPrice')}): S1's measurement, not measured again; the round reused S1's recorded selections (${code(B.source.runId)}, ${code('rows.jsonl')} ${code(B.source.rowsSha256)}). The read's cost over the questions, and per question, at list price.`, '');
  p(header(['Inventory size', 'The reads, all questions', 'A question']));
  for (const [n, v] of Object.entries(B.perSize).sort(([a], [b]) => Number(a) - Number(b))) p(row([code(n), usd(v.totalUsd), usd(v.perQuestionUsd)]));

  p('', `**Tokens and cost per question** (${at('round.groups[]')}: ${code('tokens')}, ${code('costUsd')}, ${code('s1CostUsd')}, ${code('costPerRowMeanUsd')}, ${code('s1CostPerRowMeanUsd')}; the requests after S1's last are under "How the stub rows ended"). A row is one question, one repeat and one model. The tokens are the whole row's, every request, medians over the rows that went on; the cost is the whole row's and S1's requests' alone, at list price, the larger of the computed and the reported cost of each request. S1's cost a row is the figure to set against S1's run.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'Prompt tokens a row, median', 'Completion tokens a row, median', 'Cost of the rows, whole', "Cost of the rows, S1's requests", 'Cost a row, whole, mean', "Cost a row, S1's requests, mean"]));
  for (const g of stubs) p(row([code(g.step), code(g.model), cell(g.rows), cell(g.tokens.promptPerRowMedian), cell(g.tokens.completionPerRowMedian), usd(g.costUsd), usd(g.s1CostUsd), usd(g.costPerRowMeanUsd), usd(g.s1CostPerRowMeanUsd)]));

  p('', `**S1's metrics: filter recall** (${at('groups[].filterRecall')}): S1's metrics over S1's requests of every row, unchanged; from here on every table is S1's. The rows whose first request's directory holds a whole acceptable set.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'Directory holds the gold']));
  for (const g of mains) p(row([code(g.step), code(g.model), cell(g.rows), rated(g.filterRecall)]));

  p('', `**S1's metrics: directory accuracy** (${at('groups[].offered')} and ${code('raw')}: ${code('n')}, ${code('firstRequest')}, ${code('afterSecondRequest')}, ${code('overLoading')}). Correct is ${code('exact')} or ${code('acceptable')}; over-loaded is the ${code('over')} class. "After the second" is S1's request after the loads, not the stub's later requests.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'First request, offered gold', 'First request, raw gold', 'After the second, offered gold', 'After the second, raw gold', 'Over-loaded, offered gold', 'Over-loaded, raw gold']));
  for (const g of mains) p(row([code(g.step), code(g.model), cell(g.offered.n), cell(g.offered.firstRequest), cell(g.raw.firstRequest), cell(g.offered.afterSecondRequest), cell(g.raw.afterSecondRequest), cell(g.offered.overLoading), cell(g.raw.overLoading)]));

  p('', `**S1's metrics: search recall and the notice rate** (${at('groups[].searchRecall')}, ${code('notice')}, ${code('searches')}): of the rows whose directory missed, those in which the model called ${code('find_source')} in S1's requests, and of those, the ones whose first five or ten hits completed an acceptable set. A configuration without search has no search to count.`, '');
  p(header(['Configuration', 'Model', 'Directory missed, and the model searched', 'Recall in the first five hits', 'Recall in the first ten hits', 'Rows that searched at all', 'Search calls']));
  for (const g of mains) p(row([code(g.step), code(g.model), rated(g.notice), rated(g.searchRecall.at5), rated(g.searchRecall.at10), cell(g.searches?.rowsThatSearched), cell(g.searches?.calls)]));

  p('', `**S1's metrics: tokens per question** (${at('groups[].tokens')}): S1's requests only; medians over the rows.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'First-request prompt tokens, median', 'Least', 'Most', 'Prompt tokens a row, median', 'Completion tokens a row, median', 'Completion tokens a request, median', 'Directory\'s share of the first request\'s characters, median', 'Reasoning tokens, all rows']));
  for (const g of mains) {
    const t = g.tokens;
    p(row([code(g.step), code(g.model), cell(g.rows), cell(t.firstRequestPromptMedian), cell(t.firstRequestPromptMin), cell(t.firstRequestPromptMax), cell(t.promptPerRowMedian), cell(t.completionPerRowMedian), cell(t.completionPerRequestMedian), cell(t.directoryShareMedian), cell(t.reasoningTokens)]));
  }

  p('', `**S1's metrics: latency and cost per question** (${at('groups[].latencyMs')}, ${code('costUsd')}, ${code('costPerRowMean')}): milliseconds, S1's requests only. S1's cost fields sum a row's ${code('costUsd')}, which over a stub step is the whole row's, so they equal "Tokens and cost per question"'s whole-row cost, not S1's requests' alone.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'First request, median ms', 'First request, p90 ms', 'Second request, median ms', 'Second request, p90 ms', 'Cost of the rows', 'Cost a row, mean']));
  for (const g of mains) {
    const l = g.latencyMs;
    p(row([code(g.step), code(g.model), cell(g.rows), cell(l.firstMedian), cell(l.firstP90), cell(l.secondMedian), cell(l.secondP90), usd(g.costUsd), usd(g.costPerRowMean)]));
  }

  p('', `**S1's metrics: the failure classes** (${at('groups[].offered.counts1')} and ${code('raw.counts1')}): rows by the five classes of the first request (${code('scoring/score.mjs')}).`, '');
  p(header(['Configuration', 'Model', 'Exact, offered', 'Acceptable, offered', 'Over, offered', 'Missing, offered', 'Wrong, offered', 'Exact, raw', 'Acceptable, raw', 'Over, raw', 'Missing, raw', 'Wrong, raw']));
  const k = ['exact', 'acceptable', 'over', 'missing', 'wrong'];
  for (const g of mains) p(row([code(g.step), code(g.model), ...k.map((c) => cell(g.offered.counts1[c] ?? 0)), ...k.map((c) => cell(g.raw.counts1[c] ?? 0))]));

  p('', `**S1's metrics: the request after a load, the picks and the errors** (${at('groups[].secondRequest')}, ${code('picks')}, ${code('noRequestRows')}, ${code('errors')}, ${code('consistency')}). A pick is a first load; a synthetic copy is a near-duplicate or a wrapper, counted correct wherever its original is.`, '');
  p(header(['Configuration', 'Model', 'Second requests', 'A valid tool call', 'No tool call', 'Loaded more only', 'An invalid tool call', 'Correct, with a synthetic copy', 'First pick a registry entry', 'First pick a CKAN pack', 'No request (empty selection)', 'Error rows', 'Share of questions whose repeats loaded the same set']));
  for (const g of mains) {
    const o = g.secondRequest.outcomes;
    p(row([code(g.step), code(g.model), cell(g.secondRequest.made), cell(o.valid_tool_call ?? 0), cell(o.no_tool_call ?? 0), cell(o.loaded_more_only ?? 0), cell(o.invalid_tool_call ?? 0), cell(g.picks.correctWithSyntheticCopy), cell(g.picks.firstPickRegistry), cell(g.picks.firstPickCkanPack), cell(g.noRequestRows), cell(g.errors), cell(g.consistency.questionsAllRepeatsSame)]));
  }

  return `${out.join('\n')}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const s1At = args.indexOf('--s1');
  const dir = args.find((a, i) => !a.startsWith('--') && (outAt === -1 || i !== outAt + 1) && (s1At === -1 || i !== s1At + 1));
  if (!dir) {
    console.error('usage: node benchmark/report/round-tables.mjs <runs/<date> dir> [--out <file>] [--check] [--s1 <file>]');
    process.exit(2);
  }
  const out = outAt === -1 ? join(dir, 'tables.out.md') : args[outAt + 1];
  const text = renderTables(resolve(dir), s1At === -1 ? S1_SUMMARY : resolve(args[s1At + 1]));
  if (args.includes('--check')) {
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    console.log(same ? `${out}: as rendered` : `${out}: not what round-tables.mjs renders`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, text);
  console.log(`wrote ${out}`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
