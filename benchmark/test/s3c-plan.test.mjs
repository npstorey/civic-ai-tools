// S3-C (hub #318; benchmark/preregistration/s3c.md, "The run"): the plan
// file benchmark/runner/plans/s3c.json (schema civic-run-plan/2) and how the
// runner reads it.
//
//   C3  its dry run, under the no-network preload and a civic-calibration/3
//       file, exits 0 and prints the inputs' hash, the per-configuration
//       hashes, the calibrated bound (S1's requests and the stub's, at each
//       option) and the decision line the preregistration states; S1's
//       plan's dry run still prints S1's calibrated decision;
//   C7  the runner refuses an --open-weight or a --today that is not the
//       plan's, a step with both selectionsFrom and selectionFrom, and a
//       selectionsFrom file whose sha256 is not the plan's; the --probe dry
//       run lists the two probe steps, q11 and q34, each with its
//       selectionsFrom;
//   and the round end to end through the runner against the stub (a plan of
//   the same shape on a few questions): the probe, the calibration, the run,
//   every row tagged with its transport and step, and the scorer's round
//   section.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';
import { longDigitRuns } from '../runner/writer.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const DRIVER = fileURLToPath(new URL('./fixtures/drive-stub-row.mjs', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter-s3c.mjs', import.meta.url));
const PLAN = 'benchmark/runner/plans/s3c.json';
const S1_RUN = 'benchmark/runs/2026-11-05/2026-11-05-run-191511';
const ROWS_SHA = '316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c';
const OW = 'z-ai/glm-5.3-flash';
const KEY = 'stub-not-a-credential';
const DECISION = 'the cap gates: --cap 55 (the bound is recorded and does not gate)';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
const dry = (args) => node(['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', ...args]);

/** The plan the preregistration states, written out here from its text. */
function preregisteredPlan() {
  const step = (config, n, prefix = '') => ({
    id: `${prefix}${config}-${n}`,
    config: `${config}-${n}`,
    inventory: `benchmark/inventories/${n}.json`,
    questions: `benchmark/questions/${n}.json`,
    models: ['main', 'openWeight'],
    repeats: 3,
    transport: 'stub',
    ...(config === 'shortlist+search' ? {} : { selectionsFrom: { rows: `${S1_RUN}/rows.jsonl`, sha256: ROWS_SHA, step: `builder-${n}-reads` } }),
  });
  return {
    schema: 'civic-run-plan/2',
    id: 's3c',
    today: '2026-11-05',
    models: { main: 'anthropic/claude-haiku-5.5', builder: 'anthropic/claude-haiku-5.5', openWeight: OW },
    capLimitUsd: 55,
    startRule: 'cap',
    options: { A: {}, B: { repeats: 2 } },
    steps: ['builder+search', 'builder', 'shortlist+search'].flatMap((c) => [50, 200, 1000].map((n) => step(c, n))),
    probe: { questionIds: { probeIds: 2 }, repeats: 1, models: ['main', 'openWeight'], capUsd: 5, steps: [step('builder+search', 50, 'probe-'), step('builder+search', 1000, 'probe-')] },
  };
}

/** A civic-calibration/3 file from the C2 driver's rows and S1's run. */
function calibrationFile(dir) {
  const probe = join(dir, 'driven');
  assert.equal(node(['--import', PRELOAD, DRIVER, 'probe', probe]).status, 0);
  const file = join(dir, 'calibration.json');
  const r = node(['--import', PRELOAD, 'benchmark/runner/calibration.mjs', '--stub-probe', probe, '--s1-run', S1_RUN, '--out', file]);
  assert.equal(r.status, 0, r.stderr);
  return file;
}

test('the plan file is the preregistration’s, field for field', () => {
  assert.ok(existsSync(join(REPO, PLAN)), `${PLAN} exists`);
  assert.deepEqual(readJson(join(REPO, PLAN)), preregisteredPlan());
  assert.equal(createHash('sha256').update(readFileSync(join(REPO, S1_RUN, 'rows.jsonl'))).digest('hex'), ROWS_SHA, "S1's rows are the bytes the plan binds");
});

test('C3: the plan’s dry run, no network: the inputs’ hash, the per-configuration hashes, the calibrated bound and the decision line', async () => {
  assert.ok(existsSync(join(REPO, PLAN)), `${PLAN} exists`);
  const { inputHash } = await load('runner/input-hash.mjs');
  const out = mkdtempSync(join(tmpdir(), 's3c-dry-'));
  try {
    const cal = calibrationFile(out);
    const r = dry(['--plan', PLAN, '--open-weight', OW, '--calibration', cal]);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, /no-network preload/);
    assert.match(r.stdout, /^benchmark DRY RUN: plan s3c \(option A\); today 2026-11-05$/m);
    const h = inputHash();
    assert.ok(r.stdout.includes(`inputs' hash (A3.1, node benchmark/runner/input-hash.mjs): ${h.hash} over ${h.files.length} files`));
    assert.ok(r.stdout.includes(`${ROWS_SHA}  ${S1_RUN}/rows.jsonl`), "the builder selections' file is an input, by its sha256");
    for (const c of ['builder+search', 'builder', 'shortlist+search']) for (const n of [50, 200, 1000]) assert.match(r.stdout, new RegExp(`\\n  ${c.replace('+', '\\+')}-${n} +[0-9a-f]{64}  [0-9a-f]{64}\\n`), `${c}-${n}'s hashes`);
    assert.match(r.stdout, /\n  builder\+search-50 +6a469d222be05e6468950fc84e2ab72effad68c5abc83cd64c2c675f5bde92d2  /);
    assert.match(r.stdout, /the calibrated bound \(benchmark\/preregistration\/s3c\.md, "The calibrated bound"\):\n/);
    assert.match(r.stdout, /anthropic\/claude-haiku-5\.5 +1\.9523 characters a token; each completion at 4000 tokens/);
    assert.match(r.stdout, /z-ai\/glm-5\.3-flash +3\.2049 characters a token; each completion at 4000 tokens/);
    const a = /\n  option A: \$(\d+\.\d\d) \(S1's requests \$(\d+\.\d\d); the stub's \$(\d+\.\d\d)\)\n/.exec(r.stdout);
    const b = /\n  option B: \$(\d+\.\d\d) \(S1's requests \$(\d+\.\d\d); the stub's \$(\d+\.\d\d)\)\n/.exec(r.stdout);
    assert.ok(a && b, 'the bound at each option, S1’s requests and the stub’s');
    assert.ok(Number(b[1]) < Number(a[1]));
    assert.ok(Math.abs(Number(a[2]) + Number(a[3]) - Number(a[1])) <= 0.011);
    assert.ok(r.stdout.includes(`\n${DECISION}\n`), 'the decision line, read from the plan’s startRule and capLimitUsd');
    assert.doesNotMatch(r.stdout, /option A applies|option B applies|the run does not start/, "S1's decision against $100 is not printed for this plan");
    assert.match(r.stdout, /DRY RUN: no network call was made; nothing was written\./);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("C3: S1's plan's dry run still prints S1's calibrated bound and decision", () => {
  const r = dry(['--plan', 'benchmark/runner/plans/s1.json', '--today', '2026-11-05', '--open-weight', OW, '--calibration', 'benchmark/runs/2026-11-05/g3/calibration.json']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('\n  option A: $91.37\n  option B: $69.60\n  option A applies (its bound is at most $100): --cap 92\n'));
  assert.ok(!r.stdout.includes(DECISION));
});

test('C7: the runner refuses an --open-weight or a --today that is not the plan’s', () => {
  assert.ok(existsSync(join(REPO, PLAN)), `${PLAN} exists`);
  const ow = dry(['--plan', PLAN, '--open-weight', 'deepseek/deepseek-v4-flash-0731']);
  assert.equal(ow.status, 2);
  assert.match(ow.stderr, /--open-weight deepseek\/deepseek-v4-flash-0731 is not the plan's \(z-ai\/glm-5\.3-flash\)/);
  const today = dry(['--plan', PLAN, '--today', '2026-11-17']);
  assert.equal(today.status, 2);
  assert.match(today.stderr, /--today 2026-11-17 is not the plan's date \(2026-11-05\)/);
  const same = dry(['--plan', PLAN, '--today', '2026-11-05', '--open-weight', OW]);
  assert.equal(same.status, 0, same.stderr);
});

test('C7: the runner refuses a step with both selectionsFrom and selectionFrom, and a selections file whose sha256 is not the plan’s', () => {
  assert.ok(existsSync(join(REPO, PLAN)), `${PLAN} exists`);
  const out = mkdtempSync(join(tmpdir(), 's3c-refuse-'));
  try {
    const plan = readJson(join(REPO, PLAN));
    const both = structuredClone(plan);
    both.steps[0].selectionFrom = 'builder-50-reads';
    writeFileSync(join(out, 'both.json'), JSON.stringify(both));
    const r1 = dry(['--plan', join(out, 'both.json')]);
    assert.equal(r1.status, 2);
    assert.match(r1.stderr, /step builder\+search-50: both selectionsFrom and selectionFrom/);
    const wrong = structuredClone(plan);
    wrong.steps[3].selectionsFrom.sha256 = '0'.repeat(63) + 'a';
    wrong.steps = [wrong.steps[3]];
    writeFileSync(join(out, 'wrong.json'), JSON.stringify(wrong));
    const r2 = dry(['--plan', join(out, 'wrong.json')]);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, new RegExp(`its sha256 ${ROWS_SHA} is not the plan's \\(0{63}a\\); the builder's selections are not read`));
    assert.doesNotMatch(r2.stdout, /estimated cost bounds/, 'refused before any bound or request');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('C7: the --probe dry run lists the two probe steps, q11 and q34, each with its selectionsFrom', () => {
  assert.ok(existsSync(join(REPO, PLAN)), `${PLAN} exists`);
  const r = dry(['--plan', PLAN, '--probe', '--open-weight', OW]);
  assert.equal(r.status, 0, r.stderr);
  for (const n of [50, 1000]) {
    assert.match(r.stdout, new RegExp(`\\n  probe-builder\\+search-${n} +transport stub; q11, q34; repeats 1; selectionsFrom builder-${n}-reads in ${S1_RUN}/rows\\.jsonl \\(sha256 ${ROWS_SHA}\\)\\n`));
  }
});

test('the round end to end against the stub: probe, calibration, run, rows tagged by transport and step, the scorer’s round section', async () => {
  assert.ok(existsSync(join(REPO, PLAN)), `${PLAN} exists`);
  const { summarize, readRunFiles } = await load('scoring/analyze.mjs');
  const out = mkdtempSync(join(tmpdir(), 's3c-run-'));
  const log = join(out, 'requests.jsonl');
  try {
    // The plan's shape on a few questions a step, one repeat.
    const plan = readJson(join(REPO, PLAN));
    const ids = { 'builder+search-50': ['q34', 'q90', 'q127'], 'builder-50': ['q11'], 'shortlist+search-50': ['q11'] };
    plan.steps = plan.steps.filter((s) => ids[s.id]).map((s) => ({ ...s, questionIds: { list: ids[s.id] }, repeats: 1 }));
    plan.probe.steps = plan.probe.steps.slice(0, 1);
    const mini = join(out, 'mini.json');
    writeFileSync(mini, JSON.stringify(plan));
    const run = (args) => node(['--import', STUB, 'benchmark/runner/run.mjs', '--plan', mini, '--out-dir', out, ...args], { OPENROUTER_API_KEY: KEY, STUB_LOG: log });
    const p = run(['--probe', '--open-weight', OW, '--cap', '5']);
    assert.equal(p.status, 0, `${p.stdout}\n${p.stderr}`);
    const probeDir = join(out, readdirSync(out).find((n) => n.startsWith('2026-11-05-probe-')));
    const probeRows = lines(join(probeDir, 'rows.jsonl'));
    assert.equal(probeRows.length, 4, 'q11 and q34, both models');
    assert.ok(probeRows.every((r) => r.transport === 'stub' && (r.noRequest || r.stub.shapeCheck)), 'every probe row that sent a request sent the answering request');
    const cal = join(out, 'cal.json');
    assert.equal(node(['benchmark/runner/calibration.mjs', '--stub-probe', probeDir, '--s1-run', S1_RUN, '--out', cal]).status, 0);
    const r = run(['--open-weight', OW, '--calibration', cal, '--cap', '5']);
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const dir = join(out, readdirSync(out).find((n) => n.startsWith('2026-11-05-run-')));
    for (const name of readdirSync(dir)) {
      const text = readFileSync(join(dir, name), 'utf8');
      assert.deepEqual(longDigitRuns(text), [], `${name} keeps the digit-run convention`);
      assert.ok(!text.includes(KEY), `${name} does not hold the key`);
    }
    const meta = readJson(join(dir, 'meta.json'));
    const rows = lines(join(dir, 'rows.jsonl'));
    assert.equal(meta.today, '2026-11-05');
    assert.equal(meta.openWeight, OW);
    assert.deepEqual(meta.steps.map((s) => [s.id, s.transport]), [['builder+search-50', 'stub'], ['builder-50', 'stub'], ['shortlist+search-50', 'stub']]);
    assert.deepEqual(meta.inputs.find((i) => i.role === 'builder selections'), { role: 'builder selections', path: `${S1_RUN}/rows.jsonl`, sha256: ROWS_SHA });
    assert.deepEqual([meta.configurations['builder+search-50'].requestsPerRow, meta.configurations['builder-50'].requestsPerRow, meta.configurations['shortlist+search-50'].requestsPerRow], [11, 9, 11]);
    assert.equal(meta.configurations['builder+search-50'].routingConfigurationHash, '6a469d222be05e6468950fc84e2ab72effad68c5abc83cd64c2c675f5bde92d2');
    assert.ok(meta.estimate.calibratedBound.options.A.totalUsd, 'meta.json records the calibrated bound');
    assert.equal(meta.estimate.calibratedBound.startRule, 'cap');
    assert.equal(rows.length, meta.expectedRows);
    assert.ok(rows.every((x) => x.transport === 'stub' && x.status === 'complete'));
    const empty = rows.filter((x) => x.qid === 'q127');
    assert.ok(empty.length === 2 && empty.every((x) => /^empty selection/.test(x.noRequest) && x.stub === null), 'q127 at 50: an empty selection sends nothing');
    for (const x of rows.filter((y) => !y.noRequest)) {
      assert.ok(['answer', 'answering-turn'].includes(x.stub.endedBy), `${x.key}: ${x.stub.endedBy}`);
      assert.ok(x.stub.answer, `${x.key} has an answer`);
      assert.ok(!x.stub.shapeCheck, 'a run row sends no forced answering request');
    }
    const builder = rows.filter((x) => x.step === 'builder-50');
    assert.ok(builder.every((x) => x.reservation.requests === 9), "builder-N under the stub: S1's two slots and the stub's seven");
    const e = rows.filter((x) => x.step === 'builder+search-50' && !x.noRequest);
    assert.ok(e.every((x) => x.reservation.requests === 11));
    const recorded = new Map(readFileSync(join(REPO, S1_RUN, 'rows.jsonl'), 'utf8').split('\n').filter((l) => l.includes('"role":"builder"')).map((l) => JSON.parse(l)).filter((x) => x.step === 'builder-50-reads').map((x) => [x.qid, x.selection]));
    for (const x of rows.filter((y) => y.step !== 'shortlist+search-50')) assert.deepEqual([...x.shortlist].sort(), [...recorded.get(x.qid)].sort(), `${x.key}: S1's recorded selection`);
    // Every request states S1's date.
    const sent = lines(log);
    assert.ok(sent.length > 0);
    assert.ok(sent.every((b) => b.messages[0].content.includes('2026-11-05')), "every system prompt states S1's date");
    const s = summarize(readRunFiles(dir));
    assert.ok(s.round && s.round.groups.length === 6, 'the round section: three steps, two models');
    assert.equal(s.round.paired.length, 4, 'E against builder-50 and shortlist+search-50, per model');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
