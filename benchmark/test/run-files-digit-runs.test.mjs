// The digit-run rule (A0.4) over every file the sprint's run writes and the
// report commits or derives, at the preregistered plan's denominators (hub
// #302, P3-fix): the run's five steps against the stub
// (fixtures/stub-openrouter.mjs), over benchmark/runner/plans/s1.json,
//
//   1. the open-weight probe (--open-weight-probe --cap 2);
//   2. the two-question probe beside its winner (--probe --cap 3);
//   3. the calibration step over both (calibration.mjs --out <file>);
//   4. the calibrated bound, a dry run under the no-network preload, whose
//      printed option and --cap step 5 takes;
//   5. the evaluations;
//
// then the scorer over each run directory (analyze.mjs <run dir> --out
// <file>, the S1 summary of scoring/s1.mjs). Each run directory's meta.json,
// rows.jsonl, baseline.jsonl where written, contact-ledger.md and
// calibration.json where written, step 3's file, the three summaries, and
// each step's printed output are read as text: each full hex digest masked,
// no run of 13 or more digits may remain.
//
// Two sets of rows: (a) the stub as it is; (b) the stub under STUB_PERTURB=1,
// keyed on the question id (error rows, no-usage replies, billed counts and
// costs that vary; the stub's header names the classes), so the probe's
// denominators are not the plan's whole question counts. Set (b) asserts the
// perturbation reached the rows, so the guard cannot pass on an unperturbed
// run.
//
// The rule is written out here, as digit-runs.test.mjs writes it, rather than
// imported from the writer, so the test shares no code with what it checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const PLAN = 'benchmark/runner/plans/s1.json';
const TODAY = '2026-11-03';

const DIGEST = /(?<![0-9A-Za-z])[0-9a-f]{40}(?:[0-9a-f]{24}(?:[0-9a-f]{32}(?:[0-9a-f]{32})?)?)?(?![0-9A-Za-z])/g;
/** The runs of 13 or more digits in `text`, digests masked. */
const offendingRuns = (text) => text.replace(DIGEST, (hex) => (/[a-f]/.test(hex) ? hex.replace(/\d/g, 'x') : hex)).match(/\d{13,}/g) ?? [];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const node = (args, env) => spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { PATH: process.env.PATH, ...env } });
const tail = (r) => `${r.stdout.slice(-1500)}\n${r.stderr.slice(-1500)}`;

/** G3's five steps and the scorer into `out`; the files to read, by label. */
function runSet(out, stubEnv) {
  const env = { OPENROUTER_API_KEY: 'stub-not-a-credential', ...stubEnv };
  const runs = join(out, 'runs');
  const run = (args) => node(['--import', STUB, 'benchmark/runner/run.mjs', '--today', TODAY, '--out-dir', runs, ...args], env);
  const outputOf = (r) => /^output: (.+)$/m.exec(r.stdout)?.[1] ?? null;
  const printed = {};
  const keep = (step, r) => {
    printed[step] = join(out, `${step}.out`);
    writeFileSync(printed[step], `${r.stdout}${r.stderr}`);
  };

  const s1 = run(['--plan', PLAN, '--open-weight-probe', '--cap', '2']);
  keep('step1', s1);
  assert.equal(s1.status, 0, `step 1 exits 0\n${tail(s1)}`);
  const owDir = resolve(REPO, outputOf(s1));
  const winner = readJson(join(owDir, 'meta.json')).openWeightProbe.winner;

  const s2 = run(['--plan', PLAN, '--probe', '--open-weight', winner, '--cap', '3']);
  keep('step2', s2);
  assert.equal(s2.status, 0, `step 2 exits 0\n${tail(s2)}`);
  const probeDir = resolve(REPO, outputOf(s2));

  const calFile = join(out, 'calibration.json');
  const s3 = node(['benchmark/runner/calibration.mjs', '--probe', probeDir, '--open-weight-probe', owDir, '--out', calFile], {});
  keep('step3', s3);
  assert.equal(s3.status, 0, `step 3 exits 0\n${tail(s3)}`);

  const s4 = node(['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--today', TODAY, '--plan', PLAN, '--open-weight', winner, '--calibration', calFile], {});
  keep('step4', s4);
  assert.equal(s4.status, 0, `step 4 exits 0\n${tail(s4)}`);
  const capLine = /^ {2}option ([AB]) applies.*--cap (\d+)$/m.exec(s4.stdout);
  assert.ok(capLine, `step 4 prints the option and its --cap\n${tail(s4)}`);

  const s5 = run(['--plan', PLAN, '--open-weight', winner, '--calibration', calFile, '--cap', capLine[2], '--option', capLine[1]]);
  keep('step5', s5);
  assert.equal(s5.status, 0, `step 5 exits 0\n${tail(s5)}`);
  const evalDir = resolve(REPO, outputOf(s5));

  const files = {};
  const dirs = { 'ow-probe': owDir, probe: probeDir, evaluations: evalDir };
  for (const [kind, dir] of Object.entries(dirs)) {
    for (const name of ['meta.json', 'rows.jsonl', 'baseline.jsonl', 'contact-ledger.md', 'calibration.json']) {
      if (existsSync(join(dir, name))) files[`${kind}/${name}`] = join(dir, name);
    }
    const summary = join(out, `summary-${kind}.json`);
    const a = node(['benchmark/scoring/analyze.mjs', dir, '--out', summary], {});
    assert.equal(a.status, 0, `the scorer over the ${kind} run exits 0\n${tail(a)}`);
    files[`${kind}/summary.json (analyze.mjs)`] = summary;
  }
  files['step 3 --out calibration.json'] = calFile;
  for (const [step, path] of Object.entries(printed)) files[`${step} printed output`] = path;
  for (const kind of ['ow-probe', 'probe', 'evaluations']) {
    for (const name of ['meta.json', 'rows.jsonl', 'contact-ledger.md']) assert.ok(files[`${kind}/${name}`], `the ${kind} run wrote ${name}`);
  }
  assert.ok(files['probe/calibration.json'], 'the two-question probe wrote calibration.json');
  return { files, dirs };
}

/** Each file's hit count, as diagnostic lines; the files that carry a run. */
function sweep(t, set, files) {
  const offenders = [];
  for (const [label, path] of Object.entries(files)) {
    const runs = offendingRuns(readFileSync(path, 'utf8'));
    t.diagnostic(`set ${set}  ${label}  hits ${runs.length}${runs.length ? `  first ${runs[0].length} digits` : ''}`);
    if (runs.length) offenders.push(`set ${set}, ${label}: ${runs.length} run(s), the first ${runs[0].length} digits long`);
  }
  return offenders;
}

test('set (a): every file the run writes and the scorer derives, at the plan’s denominators, carries no run of 13 or more digits', (t) => {
  const out = mkdtempSync(join(tmpdir(), 'sweep-a-'));
  try {
    const { files } = runSet(out, {});
    assert.deepEqual(sweep(t, 'a', files), []);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('set (b): with error rows, no-usage replies and varied billing, no file carries such a run', (t) => {
  const out = mkdtempSync(join(tmpdir(), 'sweep-b-'));
  try {
    const { files, dirs } = runSet(out, { STUB_PERTURB: '1' });
    // The perturbation reached the rows.
    const ow = readJson(join(dirs['ow-probe'], 'meta.json')).openWeightProbe;
    for (const p of ow.perModel) {
      assert.ok(p.errors > 0, `${p.spec}: the open-weight probe has error rows`);
      assert.ok(p.answered < 49, `${p.spec}: its denominator is not the plan's 49`);
    }
    const rows = lines(join(dirs.evaluations, 'rows.jsonl'));
    assert.ok(rows.some((r) => r.status === 'error' && r.first?.error?.status === 500), 'an error row on its first request');
    assert.ok(rows.some((r) => r.status === 'error' && r.second?.error?.status === 500), 'an error row on its request after a load');
    assert.ok(rows.some((r) => r.status === 'complete' && r.first?.cost?.chargedAs === 'reservation (no usage returned)'), 'a reply with no usage');
    assert.ok(rows.some((r) => r.status === 'complete' && r.first?.cost?.chargedAs === 'dearest endpoint (no cost reported)'), 'usage with no reported cost');
    assert.ok(new Set(rows.filter((r) => r.first?.usage).map((r) => r.first.usage.completion_tokens)).size > 10, 'billed completions that vary');
    assert.deepEqual(sweep(t, 'b', files), []);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
