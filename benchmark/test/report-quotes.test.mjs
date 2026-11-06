// The report's quotes (hub #302, P4; the seat's O2, comment 6669754364).
//
//   Every quote in benchmark/README.md, a text between “ and ”, sits on a
//   line that names exactly one row key in a code span, and is found
//   verbatim in that row of the evaluations' committed rows.jsonl: in one of
//   the row's string values, character for character. A quote cut short
//   marks each cut with …, and its pieces are found in that order in the
//   same string.
//
//   And benchmark/report/quotes.mjs prints each of them with its key, so the
//   README's quotes are the script's, cut from the rows, not typed.
//
// The rows hold model output. They are read as data here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(REPO, 'benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl');
const ROW_KEY = /^[a-z0-9+-]+\|[^|`\s]+\|q\d+(?:\|\d+)?$/;

/** Every string value in `value`. */
const stringsOf = (value) => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(stringsOf) : value && typeof value === 'object' ? Object.values(value).flatMap(stringsOf) : []);

/** The quote's pieces, in order, in one of the row's strings. */
function foundIn(row, quote) {
  const pieces = quote.split('…').filter(Boolean);
  return pieces.length > 0 && stringsOf(row).some((s) => {
    let from = 0;
    for (const piece of pieces) {
      const i = s.indexOf(piece, from);
      if (i === -1) return false;
      from = i + piece.length;
    }
    return true;
  });
}

/** The README's quotes: { line, keys, quotes } for each line that holds a
 *  curly quote mark. A line whose marks do not pair fails the count check. */
function readmeQuotes(text) {
  return text
    .split('\n')
    .map((line, i) => ({
      line: i + 1,
      marks: (line.match(/[“”]/g) ?? []).length,
      keys: [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((k) => ROW_KEY.test(k)),
      quotes: [...line.matchAll(/“([^“”]*)”/g)].map((m) => m[1]),
    }))
    .filter((l) => l.marks > 0);
}

const rowsByKey = () => {
  const rows = new Map();
  for (const line of readFileSync(ROWS, 'utf8').split('\n')) {
    if (!line) continue;
    const row = JSON.parse(line);
    rows.set(row.key, row);
  }
  return rows;
};

test('O2: every quote in the README is verbatim in the row its key names', () => {
  const lines = readmeQuotes(readFileSync(join(REPO, 'benchmark/README.md'), 'utf8'));
  const count = lines.reduce((n, l) => n + l.quotes.length, 0);
  assert.ok(count >= 20, `the README quotes the rows (${count} quotes)`);
  const rows = rowsByKey();
  const problems = [];
  for (const l of lines) {
    if (l.marks !== 2 * l.quotes.length) problems.push(`line ${l.line}: unpaired quote marks`);
    if (l.keys.length !== 1) {
      problems.push(`line ${l.line}: ${l.keys.length} row keys`);
      continue;
    }
    const row = rows.get(l.keys[0]);
    if (!row) {
      problems.push(`line ${l.line}: no row ${l.keys[0]}`);
      continue;
    }
    for (const q of l.quotes) if (!foundIn(row, q)) problems.push(`line ${l.line}: not in ${l.keys[0]}: ${q.slice(0, 60)}`);
  }
  assert.deepEqual(problems, []);
  // The test of the test: one character changed, or the right text under
  // another row's key, is not found.
  const [first] = lines;
  const row = rows.get(first.keys[0]);
  assert.ok(!foundIn(row, `${first.quotes[0]}x`));
  const other = [...rows.values()].find((r) => r.qid !== row.qid && r.role === 'rule');
  assert.ok(!foundIn(other, first.quotes[0]));
});

test("O2: quotes.mjs prints each of the README's quotes beside its row key", () => {
  const run = spawnSync(process.execPath, [join(REPO, 'benchmark/report/quotes.mjs')], { cwd: REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.equal(run.status, 0, `quotes.mjs exits 0\n${run.stderr}`);
  const printed = new Set(run.stdout.split('\n').filter(Boolean).map((l) => {
    const [key, , text] = l.split('\t');
    return `${key}\t${text}`;
  }));
  const lines = readmeQuotes(readFileSync(join(REPO, 'benchmark/README.md'), 'utf8'));
  assert.ok(lines.length > 0, 'the README quotes the rows');
  const missing = lines.flatMap((l) => l.quotes.map((q) => `${l.keys[0]}\t“${q}”`)).filter((pair) => !printed.has(pair));
  assert.deepEqual(missing, [], 'README quotes quotes.mjs does not print');
});
