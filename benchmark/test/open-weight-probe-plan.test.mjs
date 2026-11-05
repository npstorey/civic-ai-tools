// The open-weight probe over the preregistered plan (benchmark/runner/plans/
// s1.json: R5's 49 seed questions, three candidates, baseline-7, one
// repeat), against the stub (fixtures/stub-openrouter.mjs), then the
// two-question probe and the calibration step over both runs: the first
// three steps of the sprint's run (hub #302, P3-fix).
//
// The probe records its winner. Its first-request accuracy is a ratio over
// the plan's real denominators (k/49), which as a JSON number carries a run
// of 13 or more digits for 48 of the 50 values of k; meta.json writes it as
// a decimal string of 8 places (the digit-run convention, writer.mjs), so
// the probe exits 0, prints its `output:` line, and names a winner the
// calibration step accepts.
//
// What the fix leaves alone is held to the rows: the printed comparison
// (each candidate's count, its ratio at 4 places, its cost and errors) and
// the winner by the plan's rule are recomputed here from rows.jsonl and must
// equal what the probe printed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const PLAN = 'benchmark/runner/plans/s1.json';
const CANDIDATES = ['z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.6-flash'];
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
const runner = (out, args) => node(['--import', STUB, 'benchmark/runner/run.mjs', '--today', '2026-11-03', '--out-dir', out, ...args], { OPENROUTER_API_KEY: 'stub-not-a-credential' });
const runDir = (out, prefix) => join(out, readdirSync(out).find((n) => n.startsWith(prefix)));
const outputLine = (stdout) => /^output: (.+)$/m.exec(stdout)?.[1] ?? null;

test('the open-weight probe over the plan records its winner, each accuracy as an 8-place decimal string, and the calibration step accepts the run', async () => {
  await load('runner/calibration.mjs');
  const out = mkdtempSync(join(tmpdir(), 'owp-plan-'));
  try {
    const r = runner(out, ['--plan', PLAN, '--open-weight-probe', '--cap', '2']);
    assert.equal(r.status, 0, `the open-weight probe exits 0\n${r.stdout.slice(-1500)}\n${r.stderr.slice(-1500)}`);
    assert.ok(outputLine(r.stdout), 'the probe prints its output: line');
    const ow = runDir(out, '2026-11-03-ow-probe-');
    const meta = readJson(join(ow, 'meta.json'));
    assert.equal(meta.mode, 'open-weight-probe');
    assert.ok(meta.openWeightProbe, 'meta.json records the probe');
    assert.ok(CANDIDATES.includes(meta.openWeightProbe.winner), `the winner is a candidate: ${meta.openWeightProbe.winner}`);
    assert.deepEqual(meta.openWeightProbe.perModel.map((p) => p.spec), CANDIDATES);
    for (const p of meta.openWeightProbe.perModel) {
      assert.equal(p.rows, 49, `${p.spec}: a row for each of the plan's 49 questions`);
      assert.equal(typeof p.accuracyOffered, 'string', `${p.spec}: the accuracy is written as a string`);
      assert.match(p.accuracyOffered, /^\d\.\d{8}$/, `${p.spec}: a decimal string of 8 places`);
      assert.equal(p.accuracyOffered, (p.correctOffered / p.answered).toFixed(8), `${p.spec}: the in-memory ratio at 8 places`);
    }

    // The two-question probe beside the winner, then the calibration step
    // over both runs: it reads the winner from meta.json.
    const winner = meta.openWeightProbe.winner;
    const p = runner(out, ['--plan', PLAN, '--probe', '--open-weight', winner, '--cap', '3']);
    assert.equal(p.status, 0, `the two-question probe exits 0\n${p.stdout.slice(-1500)}\n${p.stderr.slice(-1500)}`);
    const probe = runDir(out, '2026-11-03-probe-');
    const file = join(out, 'calibration.json');
    const c = node(['benchmark/runner/calibration.mjs', '--probe', probe, '--open-weight-probe', ow, '--out', file]);
    assert.equal(c.status, 0, `the calibration step accepts the run\n${c.stdout}\n${c.stderr}`);
    assert.ok(existsSync(file));
    const cal = readJson(file);
    assert.equal(cal.openWeight, winner);
    assert.equal(cal.sources.openWeightProbe.winner, winner);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the printed comparison and the winner are what the rows give under the plan’s rule', async () => {
  const { CORRECT } = await load('scoring/score.mjs');
  const { rowScores } = await load('scoring/offered.mjs');
  const out = mkdtempSync(join(tmpdir(), 'owp-plan-print-'));
  try {
    // Read whether or not the run reached its end: the rows and the printed
    // comparison come before meta.json's last write.
    const r = runner(out, ['--plan', PLAN, '--open-weight-probe', '--cap', '2']);
    const rows = lines(join(runDir(out, '2026-11-03-ow-probe-'), 'rows.jsonl'));
    const num = (v) => (v === null || v === undefined ? 0 : Number(v));
    const perModel = CANDIDATES.map((spec) => {
      const rs = rows.filter((x) => x.spec === spec && x.role === 'main');
      const answered = rs.filter((x) => x.status === 'complete' && x.first && !x.first.error);
      const correct = answered.filter((x) => CORRECT.has(rowScores(x).offered.score1)).length;
      const correctRaw = answered.filter((x) => CORRECT.has(rowScores(x).raw.score1)).length;
      const errors = rs.filter((x) => x.status === 'error').length;
      return { spec, answered: answered.length, correct, correctRaw, errors, accuracy: answered.length ? correct / answered.length : null, cost: rs.reduce((s, x) => s + num(x.costUsd), 0) };
    });
    assert.ok(perModel.every((m) => m.answered === 49), 'the stub answers every question');
    for (const m of perModel) {
      const line = `  ${m.spec.padEnd(36)} ${m.correct}/${m.answered} = ${m.accuracy === null ? 'n/a' : m.accuracy.toFixed(4)} (raw ${m.correctRaw}/${m.answered})  $${m.cost.toFixed(4)}  errors ${m.errors}`;
      assert.ok(r.stdout.split('\n').includes(line), `the probe printed: ${line}`);
    }
    // The plan's rule: the best accuracy; a tie to the cheaper; a further tie
    // to the earlier candidate.
    const ranked = [...perModel].sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || a.cost - b.cost || CANDIDATES.indexOf(a.spec) - CANDIDATES.indexOf(b.spec));
    assert.match(r.stdout, new RegExp(`^  winner: ${ranked[0].spec.replace(/[./]/g, '\\$&')}$`, 'm'));
    if (r.status === 0) assert.equal(readJson(join(runDir(out, '2026-11-03-ow-probe-'), 'meta.json')).openWeightProbe.winner, ranked[0].spec, 'meta.json names the printed winner');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
