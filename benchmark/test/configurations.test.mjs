// Every configuration and both probes, end to end against the stub
// (fixtures/stub-openrouter.mjs), over a test plan of the preregistered
// plan's shape with two questions a step (fixtures/plan-mini.json); and the
// preregistered plan's dry run, under the no-network preload.
//
//   - the open-weight probe prints the comparison and the winner;
//   - the two-question probe writes calibration.json, which the evaluations
//     and the dry run read;
//   - the evaluations run every step in the plan's order into one run
//     directory, one meta.json and one ledger, every row tagged by its step;
//     each row reserved every request its configuration allows (two, four,
//     one); a search's hits join the next request's directory and
//     `load_source` enum, rebuilt through the router in manifest order (the
//     simulation of design §1.5, steps 1 and 2); a builder row's selection
//     drops what is not an alias and is the main rows' directory; a registry
//     entry's load returns REGISTRY_LOAD_TEXT;
//   - `node benchmark/runner/run.mjs --dry-run --plan
//     benchmark/runner/plans/s1.json` exits 0 with no network, printing every
//     input's sha256, the inputs' hash, each configuration's hashes and each
//     step's bounds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCivicRouter, readMcpEnv } from '@typedstandards/civic-typed-router';
import { load } from './load.mjs';
import { longDigitRuns } from '../runner/writer.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const MINI = 'benchmark/test/fixtures/plan-mini.json';
const PLAN = 'benchmark/runner/plans/s1.json';
const KEY = 'stub-not-a-credential';
const OW = 'z-ai/glm-5.3-flash';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const sha256 = (rel) => createHash('sha256').update(readFileSync(join(REPO, rel))).digest('hex');

function runner(out, args, log) {
  return spawnSync(process.execPath, ['--import', STUB, 'benchmark/runner/run.mjs', '--today', '2026-11-03', '--out-dir', out, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, OPENROUTER_API_KEY: KEY, ...(log ? { STUB_LOG: log } : {}) },
  });
}
const runDirOf = (out, kind) => join(out, readdirSync(out).find((n) => n.startsWith(`2026-11-03-${kind}-`)));

test('the open-weight probe runs the three candidates on baseline-7 and prints the comparison and the winner', async () => {
  await load('runner/engine.mjs');
  const out = mkdtempSync(join(tmpdir(), 'ow-probe-'));
  try {
    const r = runner(out, ['--plan', MINI, '--open-weight-probe', '--cap', '1']);
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /open-weight probe: first-request accuracy on the offered gold/);
    for (const m of ['z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.6-flash']) assert.match(r.stdout, new RegExp(`${m.replace(/[./]/g, '\\$&')} +\\d+/\\d+ = `));
    assert.match(r.stdout, /winner: \S+/);
    const meta = readJson(join(runDirOf(out, 'ow-probe'), 'meta.json'));
    assert.equal(meta.mode, 'open-weight-probe');
    assert.equal(meta.openWeightProbe.perModel.length, 3);
    assert.ok(meta.openWeightProbe.perModel.map((p) => p.spec).includes(meta.openWeightProbe.winner));
    // The candidates' requests carry the preregistered routing and no temperature.
    for (const m of meta.models) {
      assert.deepEqual(m.requestParameters.provider, { max_price: { prompt: 0.15, completion: 0.6 }, require_parameters: true });
      assert.ok(!('temperature' in m.requestParameters));
      assert.equal(m.requestParameters.max_tokens, 4000);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the two-question probe runs both main models and writes the calibration the evaluations read', async () => {
  await load('runner/engine.mjs');
  const out = mkdtempSync(join(tmpdir(), 'probe-'));
  try {
    const r = runner(out, ['--plan', MINI, '--probe', '--open-weight', OW, '--cap', '1']);
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const dir = runDirOf(out, 'probe');
    const rows = lines(join(dir, 'rows.jsonl'));
    assert.deepEqual([...new Set(rows.map((x) => x.spec))].sort(), ['anthropic/claude-haiku-5.5', OW]);
    assert.deepEqual([...new Set(rows.map((x) => x.qid))].sort(), ['q11', 'q34'], 'the two first probe ids');
    const cal = readJson(join(dir, 'calibration.json'));
    // The stub bills one token for every four characters: the fewest
    // characters per token is about 4, and the calibration 10% under it.
    for (const m of ['anthropic/claude-haiku-5.5', OW]) {
      const c = cal.models[m];
      assert.ok(c.fewestCharsPerToken > 3.9 && c.fewestCharsPerToken <= 4, `${m}: ${c.fewestCharsPerToken}`);
      assert.ok(Math.abs(c.charsPerToken - c.fewestCharsPerToken * 0.9) < 1e-3);
    }
    const dry = spawnSync(process.execPath, ['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--plan', MINI, '--open-weight', OW, '--calibration', join(dir, 'calibration.json')], { cwd: REPO, encoding: 'utf8' });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /estimate: calibrated \(/, 'the dry run prints the calibrated bound');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the evaluations run every configuration into one run directory, every row reserved and tagged by step', async () => {
  const { REGISTRY_LOAD_TEXT } = await import('../inventories/load-text.mjs');
  await load('runner/engine.mjs');
  const out = mkdtempSync(join(tmpdir(), 'evals-'));
  const log = join(out, 'requests.jsonl');
  try {
    const refused = runner(out, ['--plan', MINI, '--open-weight', OW, '--cap', '5']);
    assert.equal(refused.status, 2, 'the evaluations need the calibration');
    assert.match(refused.stderr, /--calibration <file> is required/);
    const p = runner(out, ['--plan', MINI, '--probe', '--open-weight', OW, '--cap', '1']);
    assert.equal(p.status, 0, p.stderr);
    const cal = join(runDirOf(out, 'probe'), 'calibration.json');
    const r = runner(out, ['--plan', MINI, '--open-weight', OW, '--calibration', cal, '--cap', '5'], log);
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const dir = runDirOf(out, 'run');
    assert.deepEqual(readdirSync(dir).sort(), ['contact-ledger.md', 'meta.json', 'rows.jsonl']);
    for (const name of readdirSync(dir)) assert.deepEqual(longDigitRuns(readFileSync(join(dir, name), 'utf8')), [], `${name} keeps the digit-run convention`);
    const meta = readJson(join(dir, 'meta.json'));
    const rows = lines(join(dir, 'rows.jsonl'));
    const plan = readJson(join(REPO, MINI));
    assert.deepEqual(meta.steps.map((s) => s.id), plan.steps.map((s) => s.id), 'the plan’s steps, in its order');
    assert.equal(meta.openWeight, OW);
    assert.equal(rows.length, meta.expectedRows);
    assert.ok(rows.every((x) => x.status === 'complete'));
    // The steps ran in the plan's order.
    const firstAt = (id) => rows.findIndex((x) => x.step === id);
    const order = plan.steps.map((s) => firstAt(s.id));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    // Reservations: two requests a main row, four a search row, one a builder row.
    const byStep = (id) => rows.filter((x) => x.step === id);
    for (const id of ['baseline-7', 'flat-50', 'shortlist-200', 'builder-50', 'flat-1000']) for (const x of byStep(id)) assert.equal(x.reservation.requests, 2, x.key);
    for (const x of byStep('shortlist+search-200')) assert.equal(x.reservation.requests, 4, x.key);
    for (const x of byStep('builder-50-reads')) assert.equal(x.reservation.requests, 1, x.key);
    for (const x of byStep('rule-50')) assert.ok(x.role === 'rule' && x.searches[0].query && x.searches[0].hits.length <= 10 && !x.reservation);
    // The inputs' hash and the configurations' hashes, at the run's start.
    assert.match(meta.inputsHash.hash, /^[0-9a-f]{64}$/);
    for (const c of ['rule-50', 'baseline-7', 'flat-50', 'shortlist-200', 'shortlist+search-200', 'builder-50', 'flat-1000']) {
      assert.match(meta.configurations[c].routingConfigurationHash, /^[0-9a-f]{64}$/, c);
      assert.match(meta.configurations[c].firstRequestDefinitionHash, /^[0-9a-f]{64}$/, c);
    }
    // A row after a load records the harness definition of its composition.
    assert.ok(rows.filter((x) => x.second).every((x) => /^[0-9a-f]{64}$/.test(x.second.definitionHash)));
    // The builder: the selection drops what is not an alias, keeps a repeat
    // once, and is the main rows' directory.
    for (const b of byStep('builder-50-reads')) {
      assert.deepEqual(b.selection, ['socrata', 'nyc_charter']);
      assert.deepEqual(b.dropped, ['not_an_alias']);
    }
    for (const x of byStep('builder-50')) assert.deepEqual([...x.shortlist].sort(), ['nyc_charter', 'socrata']);
    // A search's hits join the next request's directory and enum, rebuilt
    // through the router in manifest order.
    const sent = lines(log);
    const searchRow = byStep('shortlist+search-200').find((x) => x.qid === 'q65' && x.spec === OW);
    assert.equal(searchRow.searches.length, 1);
    assert.equal(searchRow.loadRound, 2);
    const inventory = readJson(join(REPO, 'benchmark/inventories/200.json'));
    const order200 = inventory.entries.map((e) => e.alias);
    const widened = order200.filter((a) => searchRow.shortlist.includes(a) || searchRow.searches[0].hits.includes(a));
    assert.deepEqual(searchRow.offered, widened);
    const second = sent.find(
      (b) => b.model === OW && /Bronx/.test(b.messages[1].content) && b.tools.some((t) => t.function.name === 'find_source') && !b.tools.some((t) => t.function.name.includes('__')) && b.messages.filter((m) => m.role === 'tool').length === 1,
    );
    assert.ok(second, 'the request after the search was sent');
    assert.deepEqual(second.tools.find((t) => t.function.name === 'load_source').function.parameters.properties.alias.enum, widened);
    const { toManifest } = await import('../inventories/to-manifest.mjs');
    const router = createCivicRouter(toManifest(inventory));
    const ids = toManifest(inventory).filter((e) => widened.includes(e.alias)).map((e) => e.sourceId);
    assert.equal(second.messages[0].content, router.directoryPrompt({ configured: readMcpEnv({}), today: '2026-11-03', selection: ids }));
    // One ledger: the lists, the key check and every chat request.
    const ledger = readFileSync(join(dir, 'contact-ledger.md'), 'utf8').split('\n').filter((l) => /^\| \d{4}-/.test(l));
    assert.equal(ledger.filter((l) => l.includes('/chat/completions')).length, sent.length);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('a registry entry’s load returns REGISTRY_LOAD_TEXT and adds no tools', async () => {
  const { REGISTRY_LOAD_TEXT } = await import('../inventories/load-text.mjs');
  const { createEngine } = await load('runner/engine.mjs');
  const { resolveModel, reservationPricings } = await load('runner/models.mjs');
  const { createSession } = await load('runner/session.mjs');
  const inventory = readJson(join(REPO, 'benchmark/inventories/200.json'));
  const registry = inventory.entries.find((e) => e.tools === 'not-captured');
  const session = await createSession({ inventory, configName: 'shortlist-200', today: '2026-11-03', routerPackage: { name: '@typedstandards/civic-typed-router', version: '0.6.0' } });
  const snapshot = readJson(join(REPO, 'benchmark/runner/openrouter-models.json'));
  const m = resolveModel('anthropic/claude-haiku-5.5');
  const row = snapshot.data.find((x) => x.id === m.slug);
  const mi = { m, listPricing: row.pricing, reservationPricings: reservationPricings(m, row, snapshot.endpoints[m.slug]), cpt: 2, contextLength: row.context_length, validatorFor: () => () => true };
  const rows = [];
  const bodies = [];
  await import('./fixtures/stub-openrouter.mjs');
  const fetchImpl = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return globalThis.fetch(url, init);
  };
  const engine = createEngine({ ledger: { record() {} }, apiKey: KEY, baseUrl: 'https://openrouter.ai/api/v1', cap: 1, writeRow: (_, out) => rows.push(out), retryDelaysMs: [0, 0], fetchImpl });
  const dir = session.directoryFor([session.entry(registry.alias).sourceId]);
  await engine.runTasks([{ type: 'main', key: 'k', step: { id: 's' }, session, dir, mi, q: { id: 'x', kind: 'single', text: 'Which city council meetings are next week?', acceptable: [[registry.alias]] }, r: 1 }], 1);
  assert.deepEqual(rows[0].loaded1, [registry.alias]);
  assert.deepEqual(rows[0].picks, [{ alias: registry.alias, synthetic: false, registry: true, ckanPack: false }]);
  const after = bodies[1];
  assert.equal(after.messages.find((x) => x.role === 'tool' && x.content === REGISTRY_LOAD_TEXT)?.content, REGISTRY_LOAD_TEXT);
  assert.deepEqual(after.tools.map((t) => t.function.name), ['load_source'], 'no tools added');
});

test("the preregistered plan's dry run exits 0 with no network and prints every input, the inputs' hash, the configurations' hashes and every step's bounds", async () => {
  await load('runner/input-hash.mjs');
  const r = spawnSync(process.execPath, ['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--plan', PLAN], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(`${r.stdout}${r.stderr}`, /no-network preload/);
  const plan = readJson(join(REPO, PLAN));
  const files = [PLAN, 'benchmark/runner/openrouter-models.json', 'benchmark/runner/texts.mjs', ...new Set(plan.steps.flatMap((s) => [s.inventory, s.questions]))];
  for (const rel of files) assert.ok(r.stdout.includes(`${sha256(rel)}  ${rel}`), `prints ${rel}'s sha256`);
  const { inputHash } = await load('runner/input-hash.mjs');
  assert.ok(r.stdout.includes(`inputs' hash (A3.1, node benchmark/runner/input-hash.mjs): ${inputHash().hash}`));
  for (const s of plan.steps) assert.match(r.stdout, new RegExp(`\\n  ${s.id.replace(/[+]/g, '\\+')} `), `step ${s.id}`);
  assert.match(r.stdout, /open-weight \(highest of the three\)/);
  assert.match(r.stdout, /total: calls ≤ \d+; floor \$\d+\.\d\d; ceiling \$\d+\.\d\d; hard ceiling \$\d+\.\d\d/);
  assert.match(r.stdout, /DRY RUN: no network call was made; nothing was written\./);
  const b = spawnSync(process.execPath, ['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--plan', PLAN, '--option', 'B'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  const total = (s) => Number(/ceiling \$(\d+\.\d\d); hard/.exec(s)[1]);
  assert.ok(total(b.stdout) < total(r.stdout), 'option B costs less');
  assert.match(b.stdout, /baseline-7 +anthropic\/claude-haiku-5\.5 +rows +298 /, 'two repeats on a 450-row configuration');
  assert.match(b.stdout, /flat-1000 +anthropic\/claude-haiku-5\.5 +rows +50 /, 'the probe unchanged');
  assert.ok(!existsSync(join(REPO, 'benchmark/_local/runs/x')));
});
