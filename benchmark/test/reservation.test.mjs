// A3.2 (hub #302, S1 P3-build): spend accounting and the rows' states,
// driven against the in-process stub (fixtures/stub-openrouter.mjs, imported
// here, so this process's fetch is the stub's).
//
//   - before a row's first request, the worst case of every request its
//     configuration allows is reserved: a request estimated at 99,000 tokens
//     (and billed at 101,000) is reserved at Haiku's upper tier;
//   - a call that returns no usage keeps its worst case as spend;
//   - a request that fails after its attempts makes an error row: started
//     and finished, counted in the error class and in no recall or precision
//     denominator, `uniqueRows = completeRows + errorRows`;
//   - a cap the next row's reservation would pass stops the run: the run
//     exits 2 with `stopReason` and the rows not started in meta.json, and
//     the spend recorded never passes the cap. No row is `incomplete_cap`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';
import './fixtures/stub-openrouter.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const MINI = 'benchmark/test/fixtures/plan-mini.json';
const KEY = 'stub-not-a-credential';
const HAIKU = 'anthropic/claude-haiku-5.5';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** An engine over the 7-entry inventory and Haiku, as run.mjs builds one. */
async function setup() {
  const { createEngine } = await load('runner/engine.mjs');
  const { resolveModel, reservationPricings } = await load('runner/models.mjs');
  const { createSession } = await load('runner/session.mjs');
  const { selectionBody } = await load('runner/requests.mjs');
  const snapshot = readJson(join(REPO, 'benchmark/runner/openrouter-models.json'));
  const inventory = readJson(join(REPO, 'benchmark/inventories/7.json'));
  const session = await createSession({ inventory, configName: 'baseline-7', today: '2026-11-03', routerPackage: { name: '@typedstandards/civic-typed-router', version: '0.6.0' } });
  const m = resolveModel(HAIKU);
  const row = snapshot.data.find((x) => x.id === HAIKU);
  const mi = { m, listPricing: row.pricing, reservationPricings: reservationPricings(m, row, snapshot.endpoints[HAIKU]), cpt: 2, contextLength: row.context_length, validatorFor: () => () => true };
  const rows = [];
  const engine = (cap) =>
    createEngine({ ledger: { record() {} }, apiKey: KEY, baseUrl: 'https://openrouter.ai/api/v1', cap, writeRow: (_, out) => rows.push(out), retryDelaysMs: [0, 0] });
  const task = (text, i = 1) => ({ type: 'main', key: `t|${i}`, step: { id: 't' }, session, dir: session.full, mi, q: { id: `x${i}`, kind: 'single', text, acceptable: [['data_commons']] }, r: 1 });
  return { engine, task, rows, mi, session, selectionBody };
}

test('A3.2: a request estimated at 99,000 tokens and billed at 101,000 is reserved at Haiku’s upper tier', async () => {
  const { engine, task, rows, mi, session, selectionBody } = await setup();
  const marker = 'Census figures [stub:billed=101000] ';
  const bare = JSON.stringify(selectionBody(session.full, mi.m, { text: marker })).length;
  const text = `${marker}${'x'.repeat(198000 - bare)}`;
  assert.equal(JSON.stringify(selectionBody(session.full, mi.m, { text })).length, 198000, 'the first request is 198,000 characters: 99,000 tokens at 2 a token');
  const e = engine(10);
  assert.deepEqual(await e.runTasks([task(text)], 1), []);
  const [row] = rows;
  assert.equal(row.status, 'complete');
  assert.equal(row.reservation.requests, 2, 'two requests reserved for a baseline-7 row');
  assert.equal(row.reservation.promptBoundTokens[0], 99000);
  // Below the 100,000-token threshold, but within 25% of it: the upper tier,
  // at the dearest endpoint ($0.55 / $2.75 per million).
  const upper = 99000 * 0.55e-6 + 4000 * 2.75e-6;
  const lower = 99000 * 0.11e-6 + 4000 * 0.55e-6;
  assert.ok(Math.abs(row.reservation.perRequestUsd[0] - upper) < 1e-9, `reserved ${row.reservation.perRequestUsd[0]}, the upper tier's ${upper}`);
  assert.ok(row.reservation.perRequestUsd[0] > 4 * lower);
  assert.equal(row.first.usage.prompt_tokens, 101000, 'billed at 101,000');
  assert.ok(row.first.cost.charged <= row.reservation.perRequestUsd[0], 'the charge fits the reservation');
  assert.ok(Math.abs(row.first.cost.computed - (101000 * 0.5e-6 + 20 * 2.5e-6)) < 1e-12, 'priced at the tier the billed count falls in');
  assert.equal(e.reserved < 1e-12, true, 'every reservation is released when the row ends');
});

test('A3.2: a call that returns no usage keeps its worst case as spend', async () => {
  const { engine, task, rows } = await setup();
  const e = engine(10);
  await e.runTasks([task('[stub:no-usage] How many people live in Ohio?')], 1);
  const [row] = rows;
  assert.equal(row.status, 'complete');
  assert.equal(row.first.usage, null);
  assert.equal(row.first.cost.charged, row.first.cost.worstUsd, 'charged its worst case');
  assert.match(row.first.cost.chargedAs, /no usage/);
  assert.ok(row.first.cost.charged > 0);
  assert.ok(Math.abs(e.spent - row.costUsd) < 1e-12, "the run's spend holds it");
});

test('A3.2: a request that fails after its attempts makes an error row, counted apart from recall', async () => {
  const { engine, task, rows } = await setup();
  const e = engine(10);
  await e.runTasks([task('[stub:status=503] Ohio?', 1), task('[stub:status=400] Ohio?', 2), task('What does the New York City Charter say about the powers of the Public Advocate?', 3)], 1);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(byKey['t|1'].status, 'error');
  assert.equal(byKey['t|1'].first.attempts.length, 3, 'a 503 is tried three times');
  assert.equal(byKey['t|2'].status, 'error');
  assert.equal(byKey['t|2'].first.attempts.length, 1, 'a 400 is not tried again');
  assert.equal(byKey['t|3'].status, 'complete');
  assert.ok(rows.every((r) => r.status === 'complete' || r.status === 'error'), 'no row is incomplete_cap');
  assert.equal(e.spent, byKey['t|3'].costUsd, 'a failed request is not charged');
  const { summarizeS1 } = await load('scoring/s1.mjs');
  const s = summarizeS1({ meta: { runId: 'r', steps: [{ id: 't', config: 'baseline-7' }] }, rows: rows.map((r) => ({ ...r, acceptable: r.acceptable })), base: [], files: {}, rowLines: rows.length });
  assert.equal(s.errorRows, 2);
  assert.equal(s.uniqueRows, s.completeRows + s.errorRows);
  const g = s.groups[0];
  assert.equal(g.errors, 2);
  assert.equal(g.offered.n, 1, 'an error row is in no accuracy denominator');
  assert.equal(g.raw.n, 1);
  assert.equal(g.filterRecall.n, 1, 'nor in filter recall');
});

test('A3.2: a cap the next row cannot fit under stops the run: exit 2, stopReason, the rows not started; spend within the cap', () => {
  const out = mkdtempSync(join(tmpdir(), 'a32-cap-'));
  try {
    const cal = join(out, 'calibration.json');
    writeFileSync(cal, JSON.stringify({ models: { [HAIKU]: { charsPerToken: 2 }, 'z-ai/glm-5.3-flash': { charsPerToken: 2 } } }));
    const cap = 0.3;
    const r = spawnSync(
      process.execPath,
      ['--import', STUB, 'benchmark/runner/run.mjs', '--plan', MINI, '--open-weight', 'z-ai/glm-5.3-flash', '--calibration', cal, '--cap', String(cap), '--concurrency', '2', '--today', '2026-11-03', '--out-dir', out],
      { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH, OPENROUTER_API_KEY: KEY } },
    );
    assert.equal(r.status, 2, `${r.stdout}\n${r.stderr}`);
    const [runId] = readdirSync(out).filter((n) => n.startsWith('2026-11-03-run-'));
    assert.ok(runId, `the run wrote its directory\n${r.stderr}`);
    const meta = readJson(join(out, runId, 'meta.json'));
    assert.match(meta.stopReason, /^cap: /);
    assert.ok(meta.rowsNotStarted.count > 0, 'some rows were not started');
    assert.equal(meta.rowsNotStarted.keys.length, meta.rowsNotStarted.count);
    assert.ok(Number(meta.spentUsd) <= cap, `spent ${meta.spentUsd} within the cap ${cap}`);
    const rows = readFileSync(join(out, runId, 'rows.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    assert.ok(rows.length > 0, 'the rows that fit were run');
    assert.ok(rows.every((x) => x.status === 'complete' || x.status === 'error'), 'no row is incomplete_cap');
    assert.equal(meta.uniqueRows, meta.completeRows + meta.errorRows);
    assert.equal(rows.length + meta.rowsNotStarted.count, meta.expectedRows, 'every row is started or listed as not started');
    for (const k of meta.rowsNotStarted.keys) assert.ok(!rows.some((x) => x.key === k), `${k} was not started`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
