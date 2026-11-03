// A0.3: the moved scorer reproduces R5's summary.
//
//   (a) over R5's original run files (ignored, never committed: present only
//       where the owner's copy sits at benchmark/_local/r5/), the scorer's
//       output equals R5's summary.json, compared as A0.3 says. Absent, the
//       test prints a named skip line and passes;
//   (b) a cost sums the same whether a file carries a float or a decimal string;
//   (c) the committed copy, benchmark/runs/2026-10-11-r5/, is R5's files
//       rewritten under the digit-run convention, and its own summary.json
//       (over the rewritten files) carries the originals' figures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRunFiles, summarize, summaryText } from '../scoring/analyze.mjs';
import { rewriteR5 } from '../runner/rewrite-r5.mjs';
import { jsonLine } from '../runner/writer.mjs';
import { figures } from './compare.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ORIGINALS = join(REPO, 'benchmark/_local/r5/runs/2026-10-11-run-171124');
const COPY = join(REPO, 'benchmark/runs/2026-10-11-r5');
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

test("A0.3 (a): over R5's originals, the moved scorer gives R5's summary", (t) => {
  if (!existsSync(join(ORIGINALS, 'summary.json'))) {
    const line = "SKIP A0.3(a): R5's originals are not at benchmark/_local/r5/runs/2026-10-11-run-171124 (ignored, never committed); the committed-copy tests below still run";
    console.log(`# ${line}`);
    t.diagnostic(line);
    return;
  }
  const scratch = mkdtempSync(join(tmpdir(), 'a03a-'));
  try {
    const out = join(scratch, 'summary.json');
    execFileSync(process.execPath, [join(REPO, 'benchmark/scoring/analyze.mjs'), ORIGINALS, '--out', out], { stdio: 'pipe' });
    const moved = readJson(out);
    const r5 = readJson(join(ORIGINALS, 'summary.json'));
    assert.ok('computedAt' in r5 && 'runDir' in r5, "R5's summary carries the two fields the move removes");
    assert.ok(!('computedAt' in moved) && !('runDir' in moved), 'the moved scorer writes no clock and no path');
    assert.deepEqual(moved.files, r5.files, 'the files hashes, exactly as strings');
    for (const [name, hash] of Object.entries(moved.files)) assert.equal(hash, sha256(join(ORIGINALS, name)), `${name} is the file R5 scored`);
    assert.deepEqual(figures(moved), figures(r5));
    // The committed record of R5's own summary is that summary.
    const record = readJson(join(COPY, 'r5-summary.json'));
    assert.deepEqual(record.files, r5.files);
    assert.deepEqual(figures(record), figures(r5));
    // And the committed copy is the rewrite of these originals, byte for byte.
    const rewritten = rewriteR5({ ...readRunFiles(ORIGINALS), summaryText: readFileSync(join(ORIGINALS, 'summary.json'), 'utf8') });
    for (const [name, text] of Object.entries(rewritten)) assert.equal(readFileSync(join(COPY, name), 'utf8'), text, `${name} is the rewrite of the original`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('A0.3 (b): costs sum the same as floats and as decimal strings', () => {
  // Floats made by arithmetic, so no long run is written in this file.
  const floatCost = (i) => 0.1 * (i + 1) + 0.2 * (i % 3) + 1 / (i + 7);
  const row = (i, cost) => ({
    key: `m|q${i}|1`,
    model: 'm',
    spec: 'm',
    qid: `q${i}`,
    kind: 'single',
    status: 'complete',
    first: { cost: { charged: cost(i) }, usage: { prompt_tokens: 10 }, latencyMs: 5 },
    second: { cost: { charged: cost(i + 50) }, outcome: 'valid_tool_call', latencyMs: 7 },
    loaded1: ['a'],
    loaded2: ['a'],
    score1: 'exact',
    score2: 'exact',
    acceptable: [['a']],
  });
  const metaText = JSON.stringify({ runId: 'r', today: '2026-11-02', expectedRows: 12, models: [{ spec: 'm' }] });
  const asFloats = Array.from({ length: 12 }, (_, i) => `${JSON.stringify(row(i, floatCost))}\n`).join('');
  const asStrings = Array.from({ length: 12 }, (_, i) => jsonLine(row(i, floatCost))).join('');
  assert.match(asStrings, /"charged":"\d+\.\d+"/, 'the writer carries the costs as decimal strings');
  const baseFloat = `${JSON.stringify({ key: 'm|T0', spec: 'm', baseline: 'T0_site_today', status: 'complete', cost: { charged: floatCost(3) } })}\n`;
  const baseString = jsonLine(JSON.parse(baseFloat));
  const a = summarize({ metaText, rowsText: asFloats, baseText: baseFloat });
  const b = summarize({ metaText, rowsText: asStrings, baseText: baseString });
  assert.ok(a.spentUsd > 0);
  assert.equal(b.spentUsd, a.spentUsd);
  assert.equal(b.models[0].costUsd, a.models[0].costUsd);
  assert.equal(b.models[0].tokens.baselines.T0_site_today.cost.toFixed(8), a.models[0].tokens.baselines.T0_site_today.cost.toFixed(8));

  // And on the committed copy: its costs, read as strings and as numbers.
  const files = readRunFiles(COPY);
  const toNumbers = (text) =>
    text
      .split('\n')
      .filter(Boolean)
      .map((l) => `${JSON.stringify(JSON.parse(l), (k, v) => (typeof v === 'string' && /^(?:cost|charged|computed|reported|costUsd)$|_cost$/.test(k) ? Number(v) : v))}\n`)
      .join('');
  const committed = summarize(files);
  const numeric = summarize({ ...files, rowsText: toNumbers(files.rowsText), baseText: toNumbers(files.baseText) });
  assert.equal(numeric.spentUsd, committed.spentUsd);
  assert.deepEqual(
    numeric.models.map((m) => m.costUsd),
    committed.models.map((m) => m.costUsd),
  );
});

test('A0.3 (c): the committed copy carries the originals’ figures', () => {
  const summary = readJson(join(COPY, 'summary.json'));
  // Its summary is the scorer's over its own files, byte for byte.
  assert.equal(readFileSync(join(COPY, 'summary.json'), 'utf8'), summaryText(summarize(readRunFiles(COPY))));
  // Its files hashes are over the rewritten files.
  for (const name of ['rows.jsonl', 'baseline.jsonl', 'meta.json']) assert.equal(summary.files[name], sha256(join(COPY, name)), name);
  // Every figure equals the original's, read from the committed record of R5's summary.
  const r5 = readJson(join(COPY, 'r5-summary.json'));
  assert.deepEqual(figures(summary), figures(r5));
  assert.notDeepEqual(summary.files, r5.files, 'the copy is a rewrite: its bytes, and so its hashes, differ from the originals');
});

test('the scorer writes where it is told and never over a file', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'a03-out-'));
  try {
    const out = join(scratch, 'summary.json');
    const run = () => execFileSync(process.execPath, [join(REPO, 'benchmark/scoring/analyze.mjs'), COPY, '--out', out], { stdio: 'pipe', encoding: 'utf8' });
    run();
    assert.equal(readFileSync(out, 'utf8'), readFileSync(join(COPY, 'summary.json'), 'utf8'));
    assert.throws(run, (e) => e.status === 1 && /never writes over a file/.test(e.stderr));
    assert.throws(
      () => execFileSync(process.execPath, [join(REPO, 'benchmark/scoring/analyze.mjs'), COPY], { stdio: 'pipe' }),
      (e) => e.status === 2,
      'no --out, no write',
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
