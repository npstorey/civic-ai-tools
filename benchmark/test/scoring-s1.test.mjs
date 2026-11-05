// A3.3 (hub #302, S1 P3-build; the shape now, the data at P4): the scorer
// over a stubbed run's files writes summary.json byte for byte the same twice
// (no clock), naming the three files' hashes. And the scoring the seat's read
// carried (hub #302 comment 6614538094):
//
//   - every row is scored against the raw gold and against the gold its
//     configuration offered (scoring/offered.mjs): a `boston` question under
//     baseline-7, which does not list Boston, has no offered source;
//   - rows split into need-source, no-source and open by their gold, not by
//     the question's `kind`;
//   - per configuration, the correct first picks that held a synthetic copy,
//     and the rows whose first pick was a registry entry or a CKAN pack.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const ANALYZE = join(REPO, 'benchmark/scoring/analyze.mjs');
const sha = (text) => createHash('sha256').update(text).digest('hex');

test('A3.3: over a stubbed run, the scorer writes the same summary.json twice, naming the three files’ hashes', async () => {
  await load('scoring/s1.mjs');
  const out = mkdtempSync(join(tmpdir(), 'a33-'));
  try {
    const cal = join(out, 'calibration.json');
    writeFileSync(cal, JSON.stringify({ models: { 'anthropic/claude-haiku-5.5': { charsPerToken: 2 }, 'z-ai/glm-5.3-flash': { charsPerToken: 2 } } }));
    const r = spawnSync(
      process.execPath,
      ['--import', STUB, 'benchmark/runner/run.mjs', '--plan', 'benchmark/test/fixtures/plan-mini.json', '--open-weight', 'z-ai/glm-5.3-flash', '--calibration', cal, '--cap', '5', '--today', '2026-11-03', '--out-dir', join(out, 'runs')],
      { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH, OPENROUTER_API_KEY: 'stub-not-a-credential' } },
    );
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const dir = join(out, 'runs', readdirSync(join(out, 'runs'))[0]);
    const a = join(out, 'a.json');
    const b = join(out, 'b.json');
    for (const f of [a, b]) {
      const s = spawnSync(process.execPath, [ANALYZE, dir, '--out', f], { encoding: 'utf8' });
      assert.equal(s.status, 0, s.stderr);
    }
    const text = readFileSync(a, 'utf8');
    assert.equal(readFileSync(b, 'utf8'), text, 'byte for byte');
    assert.doesNotMatch(text, /computedAt|runDir|"\d{4}-\d{2}-\d{2}T/, 'no clock and no path');
    const summary = JSON.parse(text);
    const read = (name) => {
      try {
        return readFileSync(join(dir, name), 'utf8');
      } catch {
        return '';
      }
    };
    assert.deepEqual(summary.files, { 'rows.jsonl': sha(read('rows.jsonl')), 'baseline.jsonl': sha(read('baseline.jsonl')), 'meta.json': sha(read('meta.json')) });
    assert.equal(summary.uniqueRows, summary.completeRows + summary.errorRows);
    // Every step of the plan has its group, and both golds are reported.
    const steps = JSON.parse(read('meta.json')).steps.map((s) => s.id);
    assert.deepEqual([...new Set(summary.groups.map((g) => g.step))], steps);
    for (const g of summary.groups.filter((x) => x.role === 'main')) {
      assert.ok(g.raw && g.offered, g.step);
      for (const k of ['need-source', 'no-source', 'open']) if (g.raw.bySplit[k]) assert.ok(Number.isInteger(g.raw.bySplit[k].n));
      assert.ok('correctWithSyntheticCopy' in g.picks && 'firstPickRegistry' in g.picks && 'firstPickCkanPack' in g.picks);
      // Design §2.5's tokens and cost: per request and per row; the directory's share.
      assert.ok(Number.isInteger(g.tokens.promptPerRowMedian) || typeof g.tokens.promptPerRowMedian === 'number', `${g.step}: prompt tokens a row`);
      assert.equal(g.tokens.completionPerRequestMedian, 20, 'the stub completes 20 tokens a request');
      assert.ok(g.tokens.directoryShareMedian > 0 && g.tokens.directoryShareMedian < 1, `${g.step}: the directory's share`);
      assert.ok(g.costPerRowMean > 0);
    }
    // The `boston` question under baseline-7: wrong against the raw gold,
    // and against the offered gold (nothing offered answers it) a load where
    // loading nothing was right.
    const rows = read('rows.jsonl').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const q10 = rows.find((x) => x.step === 'baseline-7' && x.qid === 'q10');
    assert.deepEqual(q10.acceptable, [['boston']]);
    assert.ok(!q10.offered.includes('boston'));
    const { rowScores } = await load('scoring/offered.mjs');
    const s = rowScores(q10);
    assert.deepEqual(s.offered.gold, [[]]);
    assert.equal(s.raw.class, 'need-source');
    assert.equal(s.offered.class, 'no-source');
    assert.equal(s.raw.score1, 'wrong');
    assert.equal(s.offered.score1, 'over');
    // And the scorer refuses to write over its own output.
    assert.equal(spawnSync(process.execPath, [ANALYZE, dir, '--out', a]).status, 1);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the offered gold, the split by gold, and the pick counts', async () => {
  const { offeredGold, goldClass } = await load('scoring/offered.mjs');
  const { summarizeS1 } = await load('scoring/s1.mjs');
  assert.deepEqual(offeredGold([['a'], ['b', 'c']], ['a', 'b']), [['a']]);
  assert.deepEqual(offeredGold([['b', 'c']], ['b']), [[]], 'a set only partly offered is not offered');
  assert.deepEqual(offeredGold([[], ['a']], []), [[]]);
  assert.deepEqual(offeredGold([['a']], undefined), [['a']], "a row with no record of what was offered keeps its raw gold (R5's rows)");
  // By gold, not by kind: a `single` question whose gold here is "no source".
  assert.equal(goldClass([[]]), 'no-source');
  assert.equal(goldClass([['a']]), 'need-source');
  assert.equal(goldClass([[], ['a']]), 'open');
  const row = (qid, kind, acceptable, loaded, picks) => ({ key: qid, step: 's', role: 'main', spec: 'm', qid, kind, status: 'complete', acceptable, offered: ['a', 'a_2', 'reg', 'ckan'], shortlist: ['a', 'a_2', 'reg', 'ckan'], loaded1: loaded, loaded2: loaded, picks, first: {} });
  const rows = [
    row('q1', 'single', [['a'], ['a_2']], ['a_2'], [{ alias: 'a_2', synthetic: true, registry: false, ckanPack: false }]),
    row('q2', 'single', [[]], [], []),
    row('q3', 'none', [['a']], ['reg'], [{ alias: 'reg', synthetic: false, registry: true, ckanPack: false }]),
    row('q4', 'single', [['a']], ['ckan', 'a'], [{ alias: 'ckan', synthetic: false, registry: false, ckanPack: true }, { alias: 'a', synthetic: false, registry: false, ckanPack: false }]),
  ];
  const s = summarizeS1({ meta: { runId: 'r', steps: [{ id: 's', config: 'flat-50' }] }, rows, base: [], files: {}, rowLines: 4 });
  const g = s.groups[0];
  assert.deepEqual(g.picks, { correctWithSyntheticCopy: 1, firstPickRegistry: 1, firstPickCkanPack: 1 });
  assert.deepEqual(g.raw.bySplit['no-source'], { n: 1, correct1: 1, correct2: 1 }, 'q2 is no-source by its gold though its kind is single');
  assert.deepEqual(g.raw.bySplit['need-source'], { n: 3, correct1: 1, correct2: 1 }, 'q3 is need-source by its gold though its kind is none');
  assert.equal(g.raw.overLoading, 0.25, 'q4 loaded a superset');
});
