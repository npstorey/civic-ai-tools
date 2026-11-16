// S3-C, C6 (hub #318; benchmark/preregistration/s3c.md, "The calibration"):
// calibration.mjs's new mode, selected by --stub-probe, reads a stub probe's
// run directory (here the C2 driver's rows, made with no network) and S1's
// committed evaluations, and writes civic-calibration/3: per model the fewer
// characters per token and the larger billed completion of the two, the
// allowance at most the 4,000-token limit. From S1's run alone the figures are
// 1.9523 and 3.2049 characters a token, and both allowances are 4,000. S1's
// mode (--probe with --open-weight-probe) is calibrated-bound.test.mjs's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const DRIVER = fileURLToPath(new URL('./fixtures/drive-stub-row.mjs', import.meta.url));
const S1_RUN = 'benchmark/runs/2026-11-05/2026-11-05-run-191511';
const HAIKU = 'anthropic/claude-haiku-5.5';
const OW = 'z-ai/glm-5.3-flash';
const node = (args) => spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH } });

test('C6: --stub-probe with --s1-run writes civic-calibration/3; from S1’s run alone 1.9523 and 3.2049, both allowances 4,000', async () => {
  const cal = await load('runner/calibration.mjs');
  assert.equal(typeof cal.combineStub, 'function', 'calibration.mjs exports combineStub');
  const out = mkdtempSync(join(tmpdir(), 'cal3-'));
  try {
    const probe = join(out, 'probe');
    const d = node(['--import', PRELOAD, DRIVER, 'probe', probe]);
    assert.equal(d.status, 0, d.stderr);
    const file = join(out, 'calibration.json');
    const r = node(['--import', PRELOAD, 'benchmark/runner/calibration.mjs', '--stub-probe', probe, '--s1-run', S1_RUN, '--out', file]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /civic-calibration\/3/);
    const c = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(c.schema, 'civic-calibration/3');
    assert.deepEqual(Object.keys(c.models).sort(), [HAIKU, OW]);
    assert.equal(c.sources.s1Run.runId, '2026-11-05-run-191511');
    assert.equal(c.sources.s1Run.rowsSha256, '316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c');
    assert.equal(c.sources.stubProbe.runId, 'driven-probe');
    // S1's run alone.
    assert.deepEqual([c.models[HAIKU].from.s1Run.charsPerToken, c.models[HAIKU].from.s1Run.fewestCharsPerToken, c.models[HAIKU].from.s1Run.requests, c.models[HAIKU].from.s1Run.completions.largest], [1.9523, 2.1693, 10686, 2046]);
    assert.deepEqual([c.models[OW].from.s1Run.charsPerToken, c.models[OW].from.s1Run.fewestCharsPerToken, c.models[OW].from.s1Run.requests, c.models[OW].from.s1Run.completions.largest], [3.2049, 3.561, 10132, 4000]);
    // The stub probe's rows bill one token for four characters and 20
    // completion tokens, its stub requests among them: S1's figures are the fewer and the larger.
    for (const m of [HAIKU, OW]) {
      assert.ok(c.models[m].from.stubProbe.requests > 3, `${m}: the requests under stub are read`);
      assert.equal(c.models[m].from.stubProbe.completions.largest, 20);
      assert.equal(c.models[m].completionAllowance, 4000, 'twice the largest, at most the limit');
    }
    assert.equal(c.models[HAIKU].charsPerToken, 1.9523);
    assert.equal(c.models[OW].charsPerToken, 3.2049);
    assert.equal(c.models[HAIKU].largestCompletion, 2046);
    assert.equal(c.models[OW].largestCompletion, 4000);
    // The file is not written over, and a directory that is not a probe's is refused.
    const again = node(['benchmark/runner/calibration.mjs', '--stub-probe', probe, '--s1-run', S1_RUN, '--out', file]);
    assert.equal(again.status, 1);
    const notProbe = node(['benchmark/runner/calibration.mjs', '--stub-probe', join(REPO, S1_RUN), '--s1-run', S1_RUN, '--out', join(out, 'x.json')]);
    assert.notEqual(notProbe.status, 0);
    assert.match(notProbe.stderr, /is not a probe's run/);
    assert.ok(!existsSync(join(out, 'x.json')));
    const usage = node(['benchmark/runner/calibration.mjs', '--stub-probe', probe, '--out', join(out, 'y.json')]);
    assert.equal(usage.status, 2);
    assert.match(usage.stderr, /--stub-probe <run dir> --s1-run <run dir> --out <file>/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('S1’s mode is unchanged: without --stub-probe, the command asks for --probe and --open-weight-probe as at 1d97e0e', async () => {
  await load('runner/calibration.mjs');
  const out = mkdtempSync(join(tmpdir(), 'cal2-'));
  try {
    const r = node(['benchmark/runner/calibration.mjs', '--probe', out, '--out', join(out, 'c.json')]);
    assert.equal(r.status, 2);
    assert.equal(r.stderr, 'usage: node benchmark/runner/calibration.mjs --probe <run dir> --open-weight-probe <run dir> --out <file>\n');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
