// "The calibrated bound" (the seat's ruling, hub #302 comment 6617296646):
//
//   - the calibration step (runner/calibration.mjs) reads a stubbed
//     two-question probe, a stubbed open-weight probe and R5's committed
//     rows into one file: per model the calibrated characters per token and
//     the largest billed completion;
//   - the plan's dry run under that file prints the calibrated bound for
//     options A and B, held here to a figure priced by hand: each request's
//     characters at the calibrated rate, each completion at twice the largest
//     billed completion, Haiku 5.5 at its dearest endpoint and the open-weight
//     model at its routing's ceilings; and the option and --cap it implies,
//     in the three outcomes: A at or under $100, B, and the run does not start.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const MINI = 'benchmark/test/fixtures/plan-mini.json';
const BOUND = 'benchmark/test/fixtures/plan-bound.json';
const HAIKU = 'anthropic/claude-haiku-5.5';
const OW = 'z-ai/glm-5.3-flash';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
const runner = (out, args) => node(['--import', STUB, 'benchmark/runner/run.mjs', '--today', '2026-11-03', '--out-dir', out, ...args], { OPENROUTER_API_KEY: 'stub-not-a-credential' });
const runDir = (out, prefix) => join(out, readdirSync(out).find((n) => n.startsWith(prefix)));

test('the calibration step reads both probes and R5’s rows into one file: characters per token and the largest billed completion', async () => {
  await load('runner/calibration.mjs');
  const out = mkdtempSync(join(tmpdir(), 'cal-'));
  try {
    assert.equal(runner(out, ['--plan', MINI, '--open-weight-probe', '--cap', '1']).status, 0);
    assert.equal(runner(out, ['--plan', MINI, '--probe', '--open-weight', OW, '--cap', '1']).status, 0);
    const ow = runDir(out, '2026-11-03-ow-probe-');
    const probe = runDir(out, '2026-11-03-probe-');
    assert.equal(readJson(join(ow, 'meta.json')).openWeightProbe.winner, OW, 'the stub ties the candidates; the first in the seat’s order wins');
    const file = join(out, 'calibration.json');
    const r = node(['benchmark/runner/calibration.mjs', '--probe', probe, '--open-weight-probe', ow, '--out', file]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(file), 'the calibration step wrote its file');
    const cal = readJson(file);
    assert.equal(cal.schema, 'civic-calibration/2');
    assert.equal(cal.openWeight, OW);
    // Characters per token: the two-question probe's own calibration.
    const own = readJson(join(probe, 'calibration.json')).models;
    for (const m of [HAIKU, OW]) assert.equal(cal.models[m].charsPerToken, own[m].charsPerToken);
    // The largest billed completion: the stub bills 20 a request; R5's Haiku
    // rows billed up to their own largest, read here from the committed file.
    const r5 = readFileSync(join(REPO, 'benchmark/runs/2026-10-11-r5/rows.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.model === HAIKU);
    const r5Largest = Math.max(...r5.flatMap((x) => [x.first, x.second]).filter((q) => q?.usage).map((q) => Math.max(q.usage.completion_tokens, q.usage.completion_tokens_details?.reasoning_tokens ?? 0)));
    assert.ok(r5Largest > 20);
    assert.equal(cal.models[HAIKU].largestCompletion, r5Largest);
    assert.equal(cal.models[HAIKU].completionsFrom.probe.largest, 20);
    assert.equal(cal.models[HAIKU].completionsFrom.r5.largest, r5Largest);
    assert.equal(cal.models[OW].largestCompletion, 20);
    assert.ok(cal.models[OW].completionsFrom.openWeightProbe.requests > 0, "the winner's open-weight probe rows count");
    assert.equal(cal.models[OW].completionsFrom.r5, undefined, "R5's rows count for Haiku only");
    for (const m of [HAIKU, OW]) assert.equal(cal.models[m].completionAllowance, 2 * cal.models[m].largestCompletion);
    // A two-question probe of another model than the winner is refused.
    assert.equal(runner(out, ['--plan', MINI, '--probe', '--open-weight', 'deepseek/deepseek-v4-flash-0731', '--cap', '1', '--resume', 'other']).status, 0);
    const refused = node(['benchmark/runner/calibration.mjs', '--probe', join(out, 'other'), '--open-weight-probe', ow, '--out', join(out, 'x.json')]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /must run Haiku 5\.5 and the open-weight probe's winner/);
    // The calibrated bound over the preregistered plan, from this file.
    const dry = node(['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--plan', 'benchmark/runner/plans/s1.json', '--open-weight', OW, '--calibration', file]);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /the calibrated bound .*\n(?:.*\n)*  option A: \$\d+\.\d\d\n  option B: \$\d+\.\d\d\n  (option A applies|option B applies|the run does not start)/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the calibrated bound, priced by hand, and the option and --cap it implies in each of the three outcomes', async () => {
  const { createSession } = await load('runner/session.mjs');
  const { BUILDER_SYSTEM, SELECT_SOURCES_TOOL } = await load('runner/texts.mjs');
  const { resolveModel } = await load('runner/models.mjs');
  const inventory = readJson(join(REPO, 'benchmark/inventories/50.json'));
  const questions = readJson(join(REPO, 'benchmark/questions/50.json')).questions.filter((q) => ['q11', 'q34'].includes(q.id));
  const session = await createSession({ inventory, configName: 'builder-50', today: '2026-11-03', routerPackage: { name: 'x', version: 'x' } });
  // A builder read's body, written out here: its characters at 2 a token.
  const tokens = (slug, q) =>
    Math.ceil(
      JSON.stringify({
        model: slug,
        messages: [
          { role: 'system', content: BUILDER_SYSTEM },
          { role: 'user', content: `${q.text}\n\n---\n\n${session.full.system}` },
        ],
        tools: [SELECT_SOURCES_TOOL],
        tool_choice: 'auto',
        ...resolveModel(slug).params(4000),
      }).length / 2,
    );
  // Haiku at its dearest endpoint below its 100,000-token step ($0.11 /
  // $0.55 a million; these prompts are far under 75,000 tokens); the
  // open-weight model at its routing's ceilings ($0.15 / $0.60).
  const haiku = questions.reduce((s, q) => s + tokens(HAIKU, q) * 0.11e-6 + 2 * 1000 * 0.55e-6, 0);
  for (const q of questions) assert.ok(tokens(HAIKU, q) < 75000);
  const openWeight = (largest) => questions.reduce((s, q) => s + tokens(OW, q) * 0.15e-6 + 2 * largest * 0.6e-6, 0);
  const out = mkdtempSync(join(tmpdir(), 'bound-'));
  try {
    const outcomes = [
      { largest: 10_000_000, applies: 'A' },
      { largest: 15_000_000, applies: 'B' },
      { largest: 25_000_000, applies: null },
    ];
    for (const { largest, applies } of outcomes) {
      const file = join(out, `cal-${largest}.json`);
      writeFileSync(file, JSON.stringify({ schema: 'civic-calibration/2', models: { [HAIKU]: { charsPerToken: 2, largestCompletion: 1000, completionAllowance: 2000 }, [OW]: { charsPerToken: 2, largestCompletion: largest, completionAllowance: 2 * largest } } }));
      const r = node(['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--plan', BOUND, '--today', '2026-11-03', '--open-weight', OW, '--calibration', file]);
      assert.equal(r.status, 0, r.stderr);
      const a = haiku + 3 * openWeight(largest);
      const b = haiku + 2 * openWeight(largest);
      assert.ok(r.stdout.includes(`  option A: $${a.toFixed(2)}\n`), `option A ${a.toFixed(2)}\n${r.stdout}`);
      assert.ok(r.stdout.includes(`  option B: $${b.toFixed(2)}\n`), `option B ${b.toFixed(2)}`);
      if (applies === 'A') {
        assert.ok(a <= 100);
        assert.ok(r.stdout.includes(`  option A applies (its bound is at most $100): --cap ${Math.ceil(a)}\n`));
      } else if (applies === 'B') {
        assert.ok(a > 100 && b <= 100);
        assert.ok(r.stdout.includes(`  option B applies (option A's bound passes $100): --option B --cap ${Math.ceil(b)}\n`));
      } else {
        assert.ok(b > 100);
        assert.match(r.stdout, /  the run does not start: option B's calibrated bound passes \$100, and no fallback beyond B is ruled; the seat brings it to the owner\.\n/);
      }
    }
    // A calibration file with no completion figure prints no bound, and says why.
    const thin = join(out, 'thin.json');
    writeFileSync(thin, JSON.stringify({ models: { [HAIKU]: { charsPerToken: 2 }, [OW]: { charsPerToken: 2 } } }));
    const r = node(['--import', PRELOAD, 'benchmark/runner/run.mjs', '--dry-run', '--plan', BOUND, '--open-weight', OW, '--calibration', thin]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /  not computed: it needs a largest billed completion for anthropic\/claude-haiku-5\.5/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
