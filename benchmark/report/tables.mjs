#!/usr/bin/env node
// The report's tables (hub #302, P4), rendered from a run date's summaries so
// no figure in benchmark/README.md is typed. R5's `report-tools/tables.mjs`,
// adapted to the S1 summary (benchmark/scoring/s1.mjs).
//
// Usage: node benchmark/report/tables.mjs <runs/<date> dir> [--out <file>] [--check]
//
//   Writes `<dir>/tables.out.md` (or --out). With --check, writes nothing and
//   exits 1 when that file is not what this script renders.
//
// WHAT IT READS: only each run directory's `summary.json` under <dir>, the
// scorer's output. Never `rows.jsonl`, `meta.json` or any other file: R5's
// version read `rows.jsonl` from its line 67 on, and this one does not.
//
// WHAT IT PRINTS: every number is a value of a summary, printed as the
// summary holds it (a rate at four places, a count, a median, a cost string).
// The script does no arithmetic on a figure: no sum, no difference, no
// ratio, no rounding. Where a table compares two figures it prints the
// comparison's outcome in words, never a computed number. Identifiers (a
// step, a model, a run id, a field path, a hash) are in code spans. So
// benchmark/test/report-tables.test.mjs can find every printed number among
// the summaries' values (the seat's condition, hub #302 comment 6662114479).
//
// Not under benchmark/runner/ or benchmark/scoring/, so it is outside the
// inputs' hash (A3.1): it renders the run, it measures nothing.

import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Design §1.4's line: "Below about 0.95 the filter is wrong, not the
 *  directory". Used only to word a comparison; never printed. */
export const FILTER_RECALL_LINE = 0.95;

const FAMILIES = ['baseline', 'flat', 'shortlist', 'shortlist+search', 'builder'];

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
  for (const mode of ['evaluations', 'open-weight-probe', 'probe']) if (!byMode[mode]) throw new Error(`no summary of mode ${mode} under ${dir}`);
  return byMode;
}

const code = (s) => `\`${s}\``;
const cell = (v) => (v === null || v === undefined ? '—' : String(v));
const usd = (v) => (v === null || v === undefined ? '—' : `$${v}`);
const rated = (r) => (r && r.n ? `${r.hits} of ${r.n} (${r.rate})` : '— (none apply)');
const row = (cells) => `| ${cells.join(' | ')} |`;
const header = (cells) => `${row(cells)}\n|${cells.map(() => '---').join('|')}|`;
const sizeOf = (step) => Number(/-(\d+)(?:-reads)?$/.exec(step)?.[1] ?? 0);
const familyOf = (step) => step.replace(/-\d+(?:-reads)?$/, '');
const below = (rate) => (rate === null || rate === undefined ? '—' : rate < FILTER_RECALL_LINE ? 'below' : 'at or above');

/** The tables, as markdown. */
export function renderTables(dir) {
  const S = readSummaries(dir);
  const ev = S.evaluations.summary;
  const main = ev.groups.filter((g) => g.role === 'main');
  // Haiku 5.5 (the builder's model) first, then the open-weight model.
  const models = [...new Set(main.map((g) => g.model))].sort((a, b) => (a === ev.openWeight) - (b === ev.openWeight) || a.localeCompare(b));
  const order = (a, b) => FAMILIES.indexOf(familyOf(a.step)) - FAMILIES.indexOf(familyOf(b.step)) || sizeOf(a.step) - sizeOf(b.step) || models.indexOf(a.model) - models.indexOf(b.model);
  const mains = [...main].sort(order);
  const of = (family) => mains.filter((g) => familyOf(g.step) === family);
  const find = (step, model) => main.find((g) => g.step === step && g.model === model) ?? null;
  const builders = ev.groups.filter((g) => g.role === 'builder').sort((a, b) => sizeOf(a.step) - sizeOf(b.step));
  const rules = ev.groups.filter((g) => g.role === 'rule').sort((a, b) => sizeOf(a.step) - sizeOf(b.step));
  const at = (path) => `${code(`${S.evaluations.name}/summary.json`)} → ${code(path)}`;
  const out = [];
  const p = (...lines) => out.push(...lines);

  p(`**The run directories** (each ${code('summary.json')} → ${code('runId')}, ${code('mode')}, ${code('completeRows')}, ${code('expectedRows')}, ${code('errorRows')}, ${code('notStarted')}, ${code('stopReason')}, ${code('spentUsd')}, ${code('files')})`, '');
  p(header(['Run directory', 'Mode', 'Rows complete', 'Rows expected', 'Error rows', 'Not started', 'Stop', 'Recorded spend, at list price', `${code('rows.jsonl')} sha256`]));
  for (const mode of ['open-weight-probe', 'probe', 'evaluations']) {
    const s = S[mode].summary;
    p(row([code(s.runId), code(s.mode), cell(s.completeRows), cell(s.expectedRows), cell(s.errorRows), cell(s.notStarted), s.stopReason === null ? 'none' : code(s.stopReason), usd(s.spentUsd), code(s.files['rows.jsonl'])]));
  }

  const ow = S['open-weight-probe'].summary;
  p('', `**The open-weight probe** (${code(`${S['open-weight-probe'].name}/summary.json`)} → ${code('groups[]')}: ${code('offered')}, ${code('raw')}, ${code('errors')}, ${code('costUsd')}). The winner is the best first request over the offered gold.`, '');
  p(header(['Model', 'Rows', 'First request correct, offered gold', 'First request correct, raw gold', 'Error rows', 'Cost of the rows']));
  for (const g of [...ow.groups].sort((a, b) => b.offered.firstRequest - a.offered.firstRequest)) {
    p(row([code(g.model), cell(g.rows), `${g.offered.firstRequest} of ${g.offered.n}`, `${g.raw.firstRequest} of ${g.raw.n}`, cell(g.errors), usd(g.costUsd)]));
  }

  p('', `**Filter recall** (${at('groups[].filterRecall')}; for the builder's reads, ${code('groups[].selectionFilterRecall')}): the rows whose shortlist holds a whole acceptable set. A main row's shortlist is its first request's directory; a builder read is one per question.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'Shortlist holds the gold', 'Against the design\'s line']));
  for (const g of [...of('baseline'), ...of('flat'), ...of('shortlist'), ...of('shortlist+search'), ...of('builder')]) {
    p(row([code(g.step), code(g.model), cell(g.rows), rated(g.filterRecall), below(g.filterRecall.rate)]));
  }
  for (const g of builders) p(row([code(g.step), code(g.model), cell(g.rows), rated(g.selectionFilterRecall), below(g.selectionFilterRecall.rate)]));

  p('', `**Directory accuracy** (${at('groups[].offered')} and ${code('raw')}: ${code('n')}, ${code('firstRequest')}, ${code('afterSecondRequest')}, ${code('overLoading')}). Correct is R5's ${code('exact')} or ${code('acceptable')}; over-loaded is R5's ${code('over')} class, the precision measure. The capped configurations are ${code('shortlist')}, ${code('shortlist+search')} and ${code('builder')}; ${code('baseline-7')} and ${code('flat')} are not capped.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'First request, offered gold', 'First request, raw gold', 'After the second, offered gold', 'After the second, raw gold', 'Over-loaded, offered gold', 'Over-loaded, raw gold']));
  for (const g of mains) {
    p(row([code(g.step), code(g.model), cell(g.offered.n), cell(g.offered.firstRequest), cell(g.raw.firstRequest), cell(g.offered.afterSecondRequest), cell(g.raw.afterSecondRequest), cell(g.offered.overLoading), cell(g.raw.overLoading)]));
  }

  p('', `**Search recall at k** (${at('groups[].searchRecall')}: ${code('at5')}, ${code('at10')}): of the rows whose shortlist missed and that called ${code('find_source')}, those whose first k hits completed an acceptable set. ${code('rule')} is the same search with the question's text as the query and no model, one row per question, over the questions whose gold needs a source.`, '');
  p(header(['Configuration', 'Model', 'Recall in the first five hits', 'Recall in the first ten hits']));
  for (const g of of('shortlist+search')) p(row([code(g.step), code(g.model), rated(g.searchRecall.at5), rated(g.searchRecall.at10)]));
  for (const g of rules) p(row([code(g.step), 'none', rated(g.searchRecall.at5), rated(g.searchRecall.at10)]));

  p('', `**The notice rate** (${at('groups[].notice')}, ${code('searches')}): of the rows whose shortlist missed, those in which the model called ${code('find_source')}.`, '');
  p(header(['Configuration', 'Model', 'Shortlist missed, and the model searched', 'Rows that searched at all', 'Search calls']));
  for (const g of of('shortlist+search')) p(row([code(g.step), code(g.model), rated(g.notice), cell(g.searches?.rowsThatSearched), cell(g.searches?.calls)]));

  p('', `**Tokens per question** (${at('groups[].tokens')}): a row is one question, one repeat, one model; medians over the rows.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'First-request prompt tokens, median', 'Least', 'Most', 'Prompt tokens a row, median', 'Completion tokens a row, median', 'Completion tokens a request, median', 'Directory\'s share of the first request\'s characters, median', 'Reasoning tokens, all rows']));
  for (const g of mains) {
    const t = g.tokens;
    p(row([code(g.step), code(g.model), cell(g.rows), cell(t.firstRequestPromptMedian), cell(t.firstRequestPromptMin), cell(t.firstRequestPromptMax), cell(t.promptPerRowMedian), cell(t.completionPerRowMedian), cell(t.completionPerRequestMedian), cell(t.directoryShareMedian), cell(t.reasoningTokens)]));
  }

  p('', `**Latency and cost per question** (${at('groups[].latencyMs')}, ${code('costUsd')}, ${code('costPerRowMean')}): milliseconds; cost at list price, the larger of the computed and the reported cost of each request. A builder read is its own row, one per question, shared by both models' main rows; the summary gives its cost only.`, '');
  p(header(['Configuration', 'Model', 'Rows', 'First request, median ms', 'First request, p90 ms', 'Second request, median ms', 'Second request, p90 ms', 'Cost of the rows', 'Cost a row, mean']));
  for (const g of mains) {
    const L = g.latencyMs;
    p(row([code(g.step), code(g.model), cell(g.rows), cell(L.firstMedian), cell(L.firstP90), cell(L.secondMedian), cell(L.secondP90), usd(g.costUsd), usd(g.costPerRowMean)]));
  }
  for (const g of builders) p(row([code(g.step), code(g.model), cell(g.rows), '—', '—', '—', '—', usd(g.costUsd), '—']));

  p('', `**The flat directory against the capped shortlist with search** (${at('groups[].raw.firstRequest')}, ${code('offered.firstRequest')}, ${code('costPerRowMean')}). On ${code('flat')} every entry is offered, so its offered gold is its raw gold. ${code('flat-1000')} ran on one model, one repeat, over a drawn subset of the questions (its rows): a cost point, not compared.`, '');
  p(header(['Model', 'Flat', 'Flat, first request', 'Shortlist with search', 'Its first request, raw gold', 'Its first request, offered gold', 'Flat below it, raw gold', 'Flat below it, offered gold', 'Flat, cost a row', 'Shortlist with search, cost a row']));
  for (const model of models) {
    for (const g of of('flat').filter((x) => x.model === model)) {
      const c = find(g.step.replace('flat', 'shortlist+search'), model);
      const compared = c && g.rows === c.rows;
      const flag = (a, b) => (!compared ? 'not compared' : a < b ? 'yes' : 'no');
      p(row([code(model), code(g.step), cell(g.raw.firstRequest), c ? code(c.step) : '—', cell(c?.raw.firstRequest), cell(c?.offered.firstRequest), flag(g.raw.firstRequest, c?.raw.firstRequest), flag(g.raw.firstRequest, c?.offered.firstRequest), usd(g.costPerRowMean), usd(c?.costPerRowMean)]));
    }
  }

  p('', `**The three shapes at each size** (${at('groups[].filterRecall')}, ${code('raw.firstRequest')}): the place filter's shortlist (${code('shortlist+search')}), the builder's (${code('builder')}), and no shortlist (${code('flat')}). The last column names the configuration with the highest first request on the raw gold; a tie names each.`, '');
  p(header(['Model', 'Shortlist with search', 'Filter recall, place filter', 'Filter recall, builder', 'Flat, raw gold', 'Shortlist with search, raw gold', 'Builder, raw gold', 'Highest']));
  for (const model of models) {
    for (const c of of('shortlist+search').filter((x) => x.model === model)) {
      const size = c.step.slice('shortlist+search'.length);
      const b = find(`builder${size}`, model);
      const f = find(`flat${size}`, model);
      const shapes = [f && f.rows === c.rows ? f : null, c, b].filter(Boolean);
      const top = Math.max(...shapes.map((g) => g.raw.firstRequest));
      p(row([code(model), code(c.step), cell(c.filterRecall.rate), cell(b?.filterRecall.rate), f && f.rows === c.rows ? cell(f.raw.firstRequest) : 'not compared', cell(c.raw.firstRequest), cell(b?.raw.firstRequest), shapes.filter((g) => g.raw.firstRequest === top).map((g) => code(g.step)).join(', ')]));
    }
  }

  p('', `**The failure classes, first request** (${at('groups[].offered.counts1')} and ${code('raw.counts1')}): rows by R5's five classes. ${code('over')} loaded a gold set and more, or anything where only loading nothing is gold; ${code('missing')} loaded nothing where a load was needed, or part of a gold set; ${code('wrong')} is any other load (${code('scoring/score.mjs')}).`, '');
  p(header(['Configuration', 'Model', 'Exact, offered', 'Acceptable, offered', 'Over, offered', 'Missing, offered', 'Wrong, offered', 'Exact, raw', 'Acceptable, raw', 'Over, raw', 'Missing, raw', 'Wrong, raw']));
  const k = ['exact', 'acceptable', 'over', 'missing', 'wrong'];
  for (const g of mains) p(row([code(g.step), code(g.model), ...k.map((c) => cell(g.offered.counts1[c] ?? 0)), ...k.map((c) => cell(g.raw.counts1[c] ?? 0))]));

  p('', `**The request after a load, the picks and the errors** (${at('groups[].secondRequest')}, ${code('picks')}, ${code('noRequestRows')}, ${code('errors')}, ${code('consistency')}). A pick is a first load; a synthetic copy is a near-duplicate or a wrapper, counted correct wherever its original is; a registry entry loads no tools; a CKAN pack carries Boston OpenContext's tools as a stand-in.`, '');
  p(header(['Configuration', 'Model', 'Second requests', 'A valid tool call', 'No tool call', 'Loaded more only', 'An invalid tool call', 'Correct, with a synthetic copy', 'First pick a registry entry', 'First pick a CKAN pack', 'No request (empty selection)', 'Error rows', 'Questions whose repeats loaded the same set']));
  for (const g of mains) {
    const o = g.secondRequest.outcomes;
    p(row([code(g.step), code(g.model), cell(g.secondRequest.made), cell(o.valid_tool_call ?? 0), cell(o.no_tool_call ?? 0), cell(o.loaded_more_only ?? 0), cell(o.invalid_tool_call ?? 0), cell(g.picks.correctWithSyntheticCopy), cell(g.picks.firstPickRegistry), cell(g.picks.firstPickCkanPack), cell(g.noRequestRows), cell(g.errors), g.consistency.n ? `${g.consistency.questionsAllRepeatsSame} of ${g.consistency.n}` : '— (one repeat)']));
  }

  p('', `**The builder's reads** (${at('groups[]')}, role ${code('builder')}: ${code('emptySelections')}, ${code('droppedAliases')}, ${code('errors')}, ${code('costUsd')}).`, '');
  p(header(['Step', 'Model', 'Reads', 'Empty selections', 'Dropped aliases', 'Error rows', 'Cost of the reads']));
  for (const g of builders) p(row([code(g.step), code(g.model), cell(g.rows), cell(g.emptySelections), cell(g.droppedAliases), cell(g.errors), usd(g.costUsd)]));

  return `${out.join('\n')}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const dir = args.find((a, i) => !a.startsWith('--') && (outAt === -1 || i !== outAt + 1));
  if (!dir) {
    console.error('usage: node benchmark/report/tables.mjs <runs/<date> dir> [--out <file>] [--check]');
    process.exit(2);
  }
  const out = outAt === -1 ? join(dir, 'tables.out.md') : args[outAt + 1];
  const text = renderTables(resolve(dir));
  if (args.includes('--check')) {
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    console.log(same ? `${out}: as rendered` : `${out}: not what tables.mjs renders`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, text);
  console.log(`wrote ${out}`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
