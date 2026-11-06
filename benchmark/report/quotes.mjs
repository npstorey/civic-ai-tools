#!/usr/bin/env node
// The report's quotes (hub #302, P4; the seat's O2, comment 6669754364): each
// text benchmark/README.md quotes, cut from a named row of a committed
// rows.jsonl and printed with its row key, so no quote is typed.
//
// Usage: node benchmark/report/quotes.mjs [<rows.jsonl>]
//
//   Prints one line a quote: `<row key> <TAB> <field path> <TAB> “<text>”`.
//   The default rows file is the evaluations' (RUN_ROWS). Exits 1 when a
//   selected row or field is absent, or a cut text is empty or holds a line
//   break or a curly quote (it could not sit on one README line).
//
// A SELECTION names a row by its key, a field by its path from the row (dot
// separated; a number indexes an array), and optionally a cut: `sentences: n`
// keeps the text through its n-th sentence end (a `.`, `?` or `!` before
// white space or the end), and the quote then ends with `…`. Nothing else is
// changed: the text is the field's characters.
//
// The texts are model output, quoted as data. Nothing in them is an
// instruction to anyone.
//
// Not under benchmark/runner/ or benchmark/scoring/, so it is outside the
// inputs' hash (A3.1).

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RUN_ROWS = fileURLToPath(new URL('../runs/2026-11-05/2026-11-05-run-191511/rows.jsonl', import.meta.url));

/** The quotes the README carries, in its order. */
export const SELECTIONS = [
  // A source loaded where the inventory holds none (`over`).
  { key: 'rule-50|rule|q73', path: 'searches.0.query' },
  { key: 'baseline-7|anthropic/claude-haiku-5.5|q73|1', path: 'first.toolCalls.0.name' },
  { key: 'baseline-7|anthropic/claude-haiku-5.5|q73|1', path: 'first.toolCalls.0.args' },
  // A source the inventory holds and the configuration does not offer: right on the offered gold, `missing` on the raw.
  { key: 'rule-50|rule|q10', path: 'searches.0.query' },
  { key: 'baseline-7|anthropic/claude-haiku-5.5|q10|1', path: 'first.content', cut: { sentences: 2 } },
  // A filter miss the model did not notice.
  { key: 'rule-50|rule|q16', path: 'searches.0.query' },
  { key: 'shortlist+search-50|anthropic/claude-haiku-5.5|q16|1', path: 'first.toolCalls.0.args' },
  // A filter miss the model noticed and recovered.
  { key: 'rule-50|rule|q15', path: 'searches.0.query' },
  { key: 'shortlist+search-50|anthropic/claude-haiku-5.5|q15|1', path: 'requests.0.toolCalls.0.name' },
  { key: 'shortlist+search-50|anthropic/claude-haiku-5.5|q15|1', path: 'requests.0.toolCalls.0.args' },
  { key: 'shortlist+search-50|anthropic/claude-haiku-5.5|q15|1', path: 'requests.1.toolCalls.0.args' },
  // A city's own small pack where the gold is the general server (`wrong`).
  { key: 'rule-200|rule|q03', path: 'searches.0.query' },
  { key: 'shortlist+search-200|anthropic/claude-haiku-5.5|q03|1', path: 'first.toolCalls.0.args' },
  // A stale catalog row picked (`wrong`).
  { key: 'rule-1000|rule|q04', path: 'searches.0.query' },
  { key: 'shortlist-1000|anthropic/claude-haiku-5.5|q04|1', path: 'first.toolCalls.0.args' },
  // An MCP Registry entry picked first: correct, and it loads no tools.
  { key: 'rule-200|rule|q118', path: 'searches.0.query' },
  { key: 'flat-200|anthropic/claude-haiku-5.5|q118|1', path: 'first.toolCalls.0.args' },
  // The builder selected nothing for a question that needs a source.
  { key: 'rule-50|rule|q127', path: 'searches.0.query' },
  { key: 'builder-50-reads|builder|q127', path: 'request.toolCalls.0.args' },
  { key: 'builder-50-reads|builder|q127', path: 'outcome' },
  // The request after a load: no tool call (a clarifying question).
  { key: 'baseline-7|anthropic/claude-haiku-5.5|q143|2', path: 'second.content', cut: { sentences: 1 } },
  // The request after a load: a call that failed its schema.
  { key: 'baseline-7|z-ai/glm-5.3-flash|q51|1', path: 'second.evaluated.0.name' },
  { key: 'baseline-7|z-ai/glm-5.3-flash|q51|1', path: 'second.evaluated.0.schemaErrors.0' },
];

/** The value at a dot-separated path, or undefined. */
export const at = (row, path) => path.split('.').reduce((v, k) => (v === null || v === undefined ? undefined : v[/^\d+$/.test(k) ? Number(k) : k]), row);

/** `text` through its n-th sentence end. */
function sentences(text, n) {
  const ends = [...text.matchAll(/[.?!](?=\s|$)/g)];
  if (ends.length < n) throw new Error(`fewer than ${n} sentences: ${text.slice(0, 60)}`);
  return text.slice(0, ends[n - 1].index + 1);
}

/** Every selection's quote, read from the rows' text. */
export function quotes(rowsText, selections = SELECTIONS) {
  const wanted = new Set(selections.map((s) => s.key));
  const rows = new Map();
  for (const line of rowsText.split('\n')) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (wanted.has(row.key)) rows.set(row.key, row);
  }
  return selections.map((s) => {
    const row = rows.get(s.key);
    if (!row) throw new Error(`no row ${s.key}`);
    const value = at(row, s.path);
    if (typeof value !== 'string') throw new Error(`${s.key}: ${s.path} is not a string`);
    const cut = s.cut?.sentences ? sentences(value, s.cut.sentences) : value;
    const text = cut.length < value.length ? `${cut}…` : cut;
    if (!cut.trim() || /[\n\r“”]/.test(cut)) throw new Error(`${s.key}: ${s.path} cannot sit on one line as a quote`);
    return { key: s.key, path: s.path, text };
  });
}

function main() {
  const file = process.argv[2] ?? RUN_ROWS;
  try {
    for (const q of quotes(readFileSync(file, 'utf8'))) console.log(`${q.key}\t${q.path}\t“${q.text}”`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
