// The S3-C report's tables (hub #318, M3).
//
//   the command    `node benchmark/report/round-tables.mjs benchmark/runs/2026-11-17`
//                  writes `tables.out.md`, and benchmark/reports/s3c.md holds
//                  that file verbatim between its two markers;
//   only summaries round-tables.mjs renders the same file from a directory
//                  that holds the two summary.json files and nothing else,
//                  with S1's run summary given by --s1;
//   S1 beside      the first-request table sets S1's comparator figures, from
//                  S1's run summary, beside this run's (s3c.md:287-288);
//   the condition  every number it prints is among the values of the
//                  summaries it read, and every identifier it prints in a code
//                  span that holds a digit is a string value or a key of one
//                  (the seat's condition for S1's tables, hub #302 comment
//                  6662114479, carried to the round);
//   the sections   every table the preregistration's "The metrics" asks of the
//                  round is there (benchmark/preregistration/s3c.md:271-427),
//                  with one row per group, pair or split the summary holds;
//   the sheet's cause  `node benchmark/report/sheet-cause.mjs benchmark/runs/2026-11-17`
//                  writes `sheet-cause.out.md` from the run's rows.jsonl (a
//                  report-side measurement the preregistration did not name;
//                  the seat's ruling, hub #318 comment 6983122829), and every
//                  number in the report's subsection on it is a number of that
//                  file.
//
// S1's renderer (`benchmark/report/tables.mjs`) and its file are not touched;
// test/report-tables.test.mjs still holds them. The script is run as a
// command, not imported, so this file shares no code with it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DATE = 'benchmark/runs/2026-11-17';
const SCRIPT = join(REPO, 'benchmark/report/round-tables.mjs');
const TABLES = join(REPO, DATE, 'tables.out.md');
const REPORT = join(REPO, 'benchmark/reports/s3c.md');
const S1_SUMMARY = join(REPO, 'benchmark/runs/2026-11-05/2026-11-05-run-191511/summary.json');
const CAUSE_SCRIPT = join(REPO, 'benchmark/report/sheet-cause.mjs');
const CAUSE = join(REPO, DATE, 'sheet-cause.out.md');
const CAUSE_HEADING = "#### A report-side measurement: the misses at S1's last request";
const BEGIN = '<!-- tables.out.md: begin (benchmark/report/round-tables.mjs; edit nothing between the markers) -->';
const END = '<!-- tables.out.md: end -->';

const render = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO, encoding: 'utf8' });
const summaryDirs = () => readdirSync(join(REPO, DATE)).filter((n) => statSync(join(REPO, DATE, n)).isDirectory() && readdirSync(join(REPO, DATE, n)).includes('summary.json'));
const summaries = () => summaryDirs().map((d) => JSON.parse(readFileSync(join(REPO, DATE, d, 'summary.json'), 'utf8')));
const evaluations = () => summaries().find((s) => s.mode === 'evaluations');
const s1Summary = () => JSON.parse(readFileSync(S1_SUMMARY, 'utf8'));

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
  for (const s of [...summaries(), s1Summary()]) walk(s);
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

/** A rendered file's output, written to a scratch file. */
function renderToScratch(dir) {
  const scratch = mkdtempSync(join(tmpdir(), 'round-tables-'));
  const out = join(scratch, 'out.md');
  const run = render([dir, '--out', out]);
  const text = run.status === 0 && existsSync(out) ? readFileSync(out, 'utf8') : null;
  rmSync(scratch, { recursive: true, force: true });
  return { run, text };
}

/** The section of `text` under the bold lead `title`, up to the next lead. */
function section(text, title) {
  const at = text.indexOf(`\n**${title}**`);
  if (at === -1 && !text.startsWith(`**${title}**`)) return null;
  const from = at === -1 ? 0 : at + 1;
  const next = text.indexOf('\n**', from + 2);
  return text.slice(from, next === -1 ? text.length : next);
}

/** The table rows of a section (the lines that start with "| ", less the header). */
const bodyRows = (sec) => sec.split('\n').filter((l) => l.startsWith('| ')).slice(1);

/** The sections the round's tables hold, and how many body rows each has, from
 *  the summary: §2's list of the report contract, per s3c.md:271-427. */
function expectedSections() {
  const ev = evaluations();
  const probe = summaries().find((s) => s.mode === 'probe');
  const groups = ev.round.groups.length;
  const e = ev.round.groups.filter((g) => g.config.startsWith('builder+search-')).length;
  const sizes = new Set(ev.round.groups.map((g) => g.config.replace(/^.*-/, ''))).size;
  const models = new Set(ev.round.groups.map((g) => g.model)).size;
  return [
    ['The run directories', 2],
    ['The probe', probe.round.groups.length],
    ["E against the comparators, first request", sizes * models],
    ['E against the comparators, paired on the raw gold', ev.round.paired.length],
    ['The notice rate behind the builder', e],
    ['Search recall in E', e],
    ['How the stub rows ended', groups],
    ['The unnoticed miss: the misses at the end and the unnoticed-miss rate', groups * 3],
    ["The unnoticed miss: by the row's directory at its end", groups * 3],
    ['The unnoticed miss: as a share of the rows, and the base rate', groups * 3],
    ['The labelling: the sheet and the two sessions', 2],
    ['The labelling: agreement', 2],
    ["The builder's read priced per question", 3],
    ['Tokens and cost per question', groups],
    ["S1's metrics: filter recall", ev.groups.length],
    ["S1's metrics: directory accuracy", ev.groups.length],
    ["S1's metrics: search recall and the notice rate", ev.groups.length],
    ["S1's metrics: tokens per question", ev.groups.length],
    ["S1's metrics: latency and cost per question", ev.groups.length],
    ["S1's metrics: the failure classes", ev.groups.length],
    ["S1's metrics: the request after a load, the picks and the errors", ev.groups.length],
  ];
}

test('the command: round-tables.mjs --check exits 0 on the committed tables.out.md, and the report holds it verbatim between its markers', () => {
  assert.ok(existsSync(SCRIPT), 'benchmark/report/round-tables.mjs exists');
  const check = render([DATE, '--check']);
  assert.equal(check.status, 0, `round-tables.mjs --check exits 0 (the committed tables.out.md is what it renders)\n${check.stdout}${check.stderr}`);
  assert.ok(existsSync(REPORT), 'benchmark/reports/s3c.md exists');
  const report = readFileSync(REPORT, 'utf8');
  const begin = report.indexOf(BEGIN);
  const end = report.indexOf(END);
  assert.ok(begin !== -1 && end > begin, "the report holds the tables' two markers, in order");
  assert.equal(report.indexOf(BEGIN, begin + 1), -1, 'one begin marker');
  assert.equal(report.indexOf(END, end + 1), -1, 'one end marker');
  assert.equal(report.slice(begin + BEGIN.length, end), `\n\n${readFileSync(TABLES, 'utf8')}\n`, "the report's tables are tables.out.md, verbatim");
});

test("only summaries: round-tables.mjs renders the same file from the two summaries and S1's run summary alone", () => {
  assert.deepEqual(summaryDirs(), ['2026-11-05-probe-130729', '2026-11-05-run-130812']);
  const scratch = mkdtempSync(join(tmpdir(), 'round-tables-'));
  try {
    for (const dir of summaryDirs()) {
      mkdirSync(join(scratch, dir));
      copyFileSync(join(REPO, DATE, dir, 'summary.json'), join(scratch, dir, 'summary.json'));
    }
    const s1 = join(scratch, 's1-summary.json');
    copyFileSync(S1_SUMMARY, s1);
    const out = join(scratch, 'out.md');
    const run = render([scratch, '--out', out, '--s1', s1]);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.ok(existsSync(TABLES), `${DATE}/tables.out.md exists`);
    assert.equal(readFileSync(out, 'utf8'), readFileSync(TABLES, 'utf8'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("the condition: every number round-tables.mjs prints, and every digit-bearing identifier, is among the summaries' values", () => {
  const { run, text } = renderToScratch(DATE);
  assert.equal(run.status, 0, `round-tables.mjs exits 0\n${run.stdout}${run.stderr}`);
  const values = summaryValues();
  const { numbers, badNumbers, badSpans } = strangers(text, values);
  assert.ok(numbers.length > 1000, `the tables print their figures (${numbers.length} numbers)`);
  assert.deepEqual(badNumbers, [], 'numbers printed that no summary holds');
  assert.deepEqual(badSpans, [], 'identifiers printed that no summary holds');
  // The test of the test: a figure typed into the output, or a step no
  // summary names, is caught.
  assert.deepEqual(strangers(`${text}\n| 0.12345 | 7.5 |\n`, values).badNumbers, ['0.12345', '7.5']);
  assert.deepEqual(strangers(`${text}\n| \`builder+search-500\` |\n`, values).badSpans, ['builder+search-500']);
});

test("the sections: every table the round's metrics ask for is there, with one row per group, pair or split", () => {
  const { run, text } = renderToScratch(DATE);
  assert.equal(run.status, 0, `round-tables.mjs exits 0\n${run.stdout}${run.stderr}`);
  const missing = [];
  const wrongRows = [];
  for (const [title, rows] of expectedSections()) {
    const sec = section(text, title);
    if (sec === null) {
      missing.push(title);
      continue;
    }
    const got = bodyRows(sec).length;
    if (got !== rows) wrongRows.push(`${title}: ${got} rows, expected ${rows}`);
  }
  assert.deepEqual(missing, [], 'sections absent from the tables');
  assert.deepEqual(wrongRows, [], 'sections with the wrong number of rows');
  // Every step and model of the summary's 18 groups is in S1's metrics, and
  // every stub group is in the round's tables.
  const ev = evaluations();
  const s1 = section(text, "S1's metrics: directory accuracy");
  for (const g of ev.groups) assert.ok(s1.includes(`| \`${g.step}\` | \`${g.model}\` |`), `S1's metrics hold ${g.step} on ${g.model}`);
  const ended = section(text, 'How the stub rows ended');
  for (const g of ev.round.groups) assert.ok(ended.includes(`| \`${g.step}\` | \`${g.model}\` |`), `the round's tables hold ${g.step} on ${g.model}`);
  // The test of the test: a section dropped from the output is found.
  const dropped = text.replace('**The notice rate behind the builder**', '**Something else**');
  assert.equal(section(dropped, 'The notice rate behind the builder'), null);
});

test("S1 beside: the first-request table sets S1's builder-N and shortlist+search-N figures beside this run's, as S1's summary holds them", () => {
  const { run, text } = renderToScratch(DATE);
  assert.equal(run.status, 0, `round-tables.mjs exits 0\n${run.stdout}${run.stderr}`);
  const sec = section(text, 'E against the comparators, first request');
  assert.ok(sec, 'the first-request section is there');
  assert.ok(sec.includes('2026-11-05-run-191511/summary.json'), "its lead names S1's run summary");
  const lines = sec.split('\n').filter((l) => l.startsWith('| '));
  const cells = (l) => l.slice(2, -2).split(' | ');
  const head = cells(lines[0]);
  const col = (name) => head.indexOf(name);
  const wanted = ["S1's builder, raw gold", "S1's builder, offered gold", "S1's place filter, raw gold", "S1's place filter, offered gold", "E against S1's builder, raw", "E against S1's place filter, raw"];
  assert.deepEqual(wanted.filter((w) => col(w) === -1), [], "the table's columns for S1's rows");
  const s1 = s1Summary().groups.filter((g) => g.role === 'main');
  const ev = evaluations().groups.filter((g) => g.role === 'main');
  const word = (a, b) => (a > b ? 'E above' : a < b ? 'E below' : 'equal');
  let checked = 0;
  for (const l of lines.slice(1)) {
    const c = cells(l);
    const model = c[col('Model')].replaceAll('`', '');
    const size = c[col('E')].replaceAll('`', '').replace('builder+search-', '');
    const e = ev.find((g) => g.step === `builder+search-${size}` && g.model === model);
    const b = s1.find((g) => g.step === `builder-${size}` && g.model === model);
    const s = s1.find((g) => g.step === `shortlist+search-${size}` && g.model === model);
    assert.ok(e && b && s, `${model} at ${size}: E in this run, and S1's two comparators`);
    assert.equal(c[col("S1's builder, raw gold")], String(b.raw.firstRequest));
    assert.equal(c[col("S1's builder, offered gold")], String(b.offered.firstRequest));
    assert.equal(c[col("S1's place filter, raw gold")], String(s.raw.firstRequest));
    assert.equal(c[col("S1's place filter, offered gold")], String(s.offered.firstRequest));
    assert.equal(c[col("E against S1's builder, raw")], word(e.raw.firstRequest, b.raw.firstRequest));
    assert.equal(c[col("E against S1's place filter, raw")], word(e.raw.firstRequest, s.raw.firstRequest));
    checked++;
  }
  assert.equal(checked, 6, 'two models at three sizes');
});

test("the sheet's cause: sheet-cause.mjs --check exits 0, and every number in the report's subsection on it is a number of sheet-cause.out.md", () => {
  assert.ok(existsSync(CAUSE_SCRIPT), 'benchmark/report/sheet-cause.mjs exists');
  const check = spawnSync(process.execPath, [CAUSE_SCRIPT, DATE, '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(check.status, 0, `sheet-cause.mjs --check exits 0\n${check.stdout}${check.stderr}`);
  const file = readFileSync(CAUSE, 'utf8');
  const fileNumbers = new Set(printed(file).numbers);
  assert.ok(fileNumbers.size > 10, `the file prints its counts (${fileNumbers.size} distinct numbers)`);
  const report = readFileSync(REPORT, 'utf8');
  const at = report.indexOf(`\n${CAUSE_HEADING}\n`);
  assert.ok(at !== -1, `the report holds the subsection "${CAUSE_HEADING}"`);
  const next = report.slice(at + 1).search(/\n#{1,4} /);
  const sub = report.slice(at + 1 + CAUSE_HEADING.length, next === -1 ? undefined : at + 1 + next);
  assert.ok(sub.includes('`runs/2026-11-17/sheet-cause.out.md`'), 'the subsection names the file');
  const nums = printed(sub).numbers;
  assert.ok(nums.length >= 4, `the subsection gives the totals (${nums.length} numbers)`);
  assert.deepEqual(nums.filter((n) => !fileNumbers.has(n)), [], 'numbers in the subsection that the file does not print');
  // The test of the test: a number typed into the subsection is caught.
  assert.deepEqual(printed(`${sub} 4321.5`).numbers.filter((n) => !fileNumbers.has(n)), ['4321.5']);
});
