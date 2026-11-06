// The report's tables (hub #302, P4).
//
//   A4.1           `node benchmark/report/tables.mjs benchmark/runs/2026-11-05`
//                  writes `tables.out.md`, and benchmark/README.md's tables
//                  are that file's contents verbatim, between its two markers;
//   only summaries tables.mjs renders the same file from a directory that
//                  holds the three summary.json files and nothing else;
//   the condition  every number tables.mjs prints is among the values of the
//                  summaries it read, and every identifier it prints in a code
//                  span that holds a digit is a string value or a key of one
//                  (the seat's ruling, hub #302 comment 6662114479).
//
// The script is run as a command, not imported, so this file shares no code
// with it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DATE = 'benchmark/runs/2026-11-05';
const TABLES = join(REPO, DATE, 'tables.out.md');
const BEGIN = '<!-- tables.out.md: begin (benchmark/report/tables.mjs; edit nothing between the markers) -->';
const END = '<!-- tables.out.md: end -->';

const tables = (args) => spawnSync(process.execPath, [join(REPO, 'benchmark/report/tables.mjs'), ...args], { cwd: REPO, encoding: 'utf8' });
const summaryDirs = () => readdirSync(join(REPO, DATE)).filter((n) => statSync(join(REPO, DATE, n)).isDirectory() && readdirSync(join(REPO, DATE, n)).includes('summary.json'));

/** Every number, every string and every key in the summaries. */
function summaryValues() {
  const numbers = new Set();
  const strings = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (strings.add(k), walk(x));
    else if (typeof v === 'number') numbers.add(String(v));
    else if (typeof v === 'string') {
      strings.add(v);
      if (/^-?\d+(?:\.\d+)?$/.test(v)) numbers.add(v);
    }
  };
  for (const dir of summaryDirs()) walk(JSON.parse(readFileSync(join(REPO, DATE, dir, 'summary.json'), 'utf8')));
  return { numbers, strings };
}

/** What `text` prints: the numbers outside code spans, and the code spans. */
function printed(text) {
  const spans = [];
  const prose = text.replace(/`([^`\n]+)`/g, (_, inner) => (spans.push(inner), ' '));
  const numbers = prose.match(/(?<![A-Za-z0-9_.])\d+(?:\.\d+)?(?![A-Za-z0-9_])/g) ?? [];
  return { numbers, spans };
}

/** The printed figures and identifiers that are not among the summaries' values. */
function strangers(text, values) {
  const { numbers, spans } = printed(text);
  const badNumbers = numbers.filter((n) => !values.numbers.has(n));
  const badSpans = spans.filter(
    (span) => /\d/.test(span) && !values.strings.has(span) && span.split(/[\s.\/\[\]→]+/).some((piece) => /\d/.test(piece) && !values.strings.has(piece)),
  );
  return { numbers, badNumbers, badSpans };
}

test('A4.1: tables.mjs renders tables.out.md as committed, and the README holds it verbatim between its markers', () => {
  const check = tables([DATE, '--check']);
  assert.equal(check.status, 0, `tables.mjs --check exits 0 (the committed tables.out.md is what it renders)\n${check.stdout}${check.stderr}`);
  const readme = readFileSync(join(REPO, 'benchmark/README.md'), 'utf8');
  const begin = readme.indexOf(BEGIN);
  const end = readme.indexOf(END);
  assert.ok(begin !== -1 && end > begin, "benchmark/README.md holds the tables' two markers, in order");
  assert.equal(readme.indexOf(BEGIN, begin + 1), -1, 'one begin marker');
  const block = readme.slice(begin + BEGIN.length, end);
  assert.equal(block, `\n\n${readFileSync(TABLES, 'utf8')}\n`, "the README's tables are tables.out.md, verbatim");
});

test('A4.1: tables.mjs renders the same file from the three summaries alone', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'tables-'));
  try {
    const dirs = summaryDirs();
    assert.deepEqual(dirs, ['2026-11-05-ow-probe-181703', '2026-11-05-probe-181956', '2026-11-05-run-191511']);
    for (const dir of dirs) {
      mkdirSync(join(scratch, dir));
      copyFileSync(join(REPO, DATE, dir, 'summary.json'), join(scratch, dir, 'summary.json'));
    }
    const out = join(scratch, 'out.md');
    const run = tables([scratch, '--out', out]);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.equal(readFileSync(out, 'utf8'), readFileSync(TABLES, 'utf8'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("the condition: every number tables.mjs prints, and every digit-bearing identifier, is among the summaries' values", () => {
  const scratch = mkdtempSync(join(tmpdir(), 'tables-'));
  try {
    const out = join(scratch, 'out.md');
    const run = tables([DATE, '--out', out]);
    assert.equal(run.status, 0, `tables.mjs exits 0\n${run.stdout}${run.stderr}`);
    const values = summaryValues();
    const text = readFileSync(out, 'utf8');
    const { numbers, badNumbers, badSpans } = strangers(text, values);
    assert.ok(numbers.length > 1000, `the tables print their figures (${numbers.length} numbers)`);
    assert.deepEqual(badNumbers, [], 'numbers printed that no summary holds');
    assert.deepEqual(badSpans, [], 'identifiers printed that no summary holds');
    // The test of the test: a figure typed into the output, or a step no
    // summary names, is caught.
    assert.deepEqual(strangers(`${text}\n| 0.12345 | 7.5 |\n`, values).badNumbers, ['0.12345', '7.5']);
    assert.deepEqual(strangers(`${text}\n| \`flat-500\` |\n`, values).badSpans, ['flat-500']);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
