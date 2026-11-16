// S3-C (hub #318; benchmark/preregistration/s3c.md, "The metrics"): the
// scorers' exports. The unnoticed miss and its rule (scoring/unnoticed.mjs),
// the labelling sheet, its batches and the agreement of two readings
// (scoring/sheet.mjs), and the round's section of a summary: the notice rate
// behind the builder, the paired first-request comparison with its exact
// McNemar test, and the builder's read priced per question
// (scoring/round.mjs). Each module is asserted before it is used, so on a
// tree without it each test is red at an assertion.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const DRIVER = fileURLToPath(new URL('./fixtures/drive-stub-row.mjs', import.meta.url));
const S1_RUN = 'benchmark/runs/2026-11-05/2026-11-05-run-191511';
const SALT = 'ab'.repeat(32);

/** A stub row, as the runner writes one, with what the metric reads. */
const stubRow = (key, { acceptable = [['socrata']], loadedEnd = [], directoryEnd = ['socrata'], answer = 'There were 3.', endedBy = 'answer', noRequest, step = 'builder+search-50', spec = 'm', status = 'complete', searches = [], stubSearches = [], shortlist = ['nyc_record'] } = {}) => ({
  key,
  step,
  config: step,
  role: 'main',
  spec,
  model: spec,
  qid: key,
  repeat: 1,
  status,
  transport: 'stub',
  acceptable,
  shortlist,
  searches,
  loaded1: [],
  ...(noRequest ? { noRequest, stub: null } : { stub: { endedBy, answer: endedBy === 'size' || endedBy === 'error' ? null : answer, loadedEnd, directoryEnd, searches: stubSearches, requests: [], s1CostUsd: '0.001', costUsd: '0.002' } }),
  costUsd: '0.003',
});

test('the rule: lower-cased, quotes and white space normalized, a listed phrase as a substring; an empty answer is no-answer', async () => {
  const u = await load('scoring/unnoticed.mjs');
  assert.equal(typeof u.saysRule, 'function', 'unnoticed.mjs exports saysRule');
  assert.equal(u.SAYS_PHRASES.length, 38);
  assert.equal(u.saysRule('I COULDN’T   find the permits.'), 'says', 'the curly apostrophe and the run of spaces');
  assert.equal(u.saysRule('The data is\nnot\tavailable.'), 'says');
  assert.equal(u.saysRule('There were 12 permits in 2024.'), 'does-not-say');
  assert.equal(u.saysRule('The query returned nothing.'), 'does-not-say', 'a sentence that a query returned nothing is not on the list');
  assert.equal(u.saysRule('   '), 'no-answer');
  assert.equal(u.saysRule(null), 'no-answer');
  assert.deepEqual(u.LABELS, ['says', 'does-not-say', 'no-answer']);
});

test('a miss at the end, its denominator, and the five figures, split by how the row ended', async () => {
  const u = await load('scoring/unnoticed.mjs');
  assert.equal(typeof u.missAtEnd, 'function', 'unnoticed.mjs exports missAtEnd');
  const rows = [
    stubRow('a', { loadedEnd: [], directoryEnd: ['nyc_record'], answer: 'There were 3.' }), // a miss, the directory's, unnoticed
    stubRow('b', { loadedEnd: ['nyc_record'], directoryEnd: ['socrata', 'nyc_record'], answer: 'It could not be checked.' }), // a miss, the model's, noticed
    stubRow('c', { loadedEnd: ['socrata'], answer: 'Five.' }), // not a miss: base rate, does not say
    stubRow('d', { loadedEnd: ['socrata'], answer: 'Not available.', endedBy: 'answering-turn' }), // not a miss: says
    stubRow('e', { endedBy: 'size' }), // counted beside
    stubRow('f', { acceptable: [[], ['socrata']] }), // gold accepts loading nothing: no miss
    stubRow('g', { noRequest: 'empty selection' }), // sent no request
  ];
  assert.deepEqual(rows.map(u.missAtEnd), [true, true, false, false, true, null, null]);
  assert.equal(u.directoryHeldGold(rows[0]), false);
  assert.equal(u.directoryHeldGold(rows[1]), true);
  const f = u.unnoticedMissFigures(rows, u.ruleNotSay);
  assert.deepEqual(f.all.missesAtEnd, { n: 4, hits: 2, rate: 0.5 });
  assert.equal(f.all.endedBySizeOrError, 1);
  assert.deepEqual(f.all.unnoticed, { n: 2, hits: 1, rate: 0.5 });
  assert.deepEqual(f.all.byDirectory.directoryMiss, { n: 1, hits: 1, rate: 1 });
  assert.deepEqual(f.all.byDirectory.modelMiss, { n: 1, hits: 0, rate: 0 });
  assert.deepEqual(f.all.unnoticedOfDenominator, { n: 4, hits: 1, rate: 0.25 });
  assert.deepEqual(f.all.baseRate, { n: 2, hits: 1, rate: 0.5 });
  assert.deepEqual(f.answer.missesAtEnd, { n: 3, hits: 2, rate: 0.6667 });
  assert.deepEqual(f.answeringTurn.missesAtEnd, { n: 1, hits: 0, rate: 0 });
});

test('the sheet: every miss with an answer and as many rows that are not, ids from the salt, in id order; batches; replies; agreement', async () => {
  const sh = await load('scoring/sheet.mjs');
  assert.equal(typeof sh.buildSheet, 'function', 'sheet.mjs exports buildSheet');
  const rows = [
    ...['m1', 'm2'].map((k) => stubRow(k, { loadedEnd: [] })),
    ...['n1', 'n2', 'n3', 'n4'].map((k) => stubRow(k, { loadedEnd: ['socrata'] })),
    stubRow('o1', { loadedEnd: [], spec: 'other' }),
    stubRow('o2', { loadedEnd: ['socrata'], spec: 'other' }),
  ];
  const sheet = sh.buildSheet(rows, SALT, (r) => `Q ${r.qid}?`);
  assert.equal(sheet.length, 2 + 2 + 1 + 1, 'each step and model: its misses, and as many rows that are not');
  assert.deepEqual(Object.keys(sheet[0]), ['id', 'question', 'answer'], 'no model, step, load, gold or score');
  assert.deepEqual(sheet.map((r) => r.id), [...sheet.map((r) => r.id)].sort());
  assert.equal(sh.rowId(SALT, 'm1'), (await import('node:crypto')).createHash('sha256').update(`${SALT}\0m1`).digest('hex').slice(0, 16));
  const members = sh.sheetMembers(rows, SALT);
  const base = members.filter((m) => m.kind === 'base' && rows.find((r) => r.key === m.key).spec === 'm').map((m) => m.key);
  const ranked = ['n1', 'n2', 'n3', 'n4'].sort((a, b) => (sh.rowId(SALT, a) < sh.rowId(SALT, b) ? -1 : 1)).slice(0, 2);
  assert.deepEqual(base.sort(), ranked.sort(), 'the rows that are not misses, in ascending order of their ids');
  assert.equal(sh.saltSha256(SALT), (await import('node:crypto')).createHash('sha256').update(SALT).digest('hex'));
  assert.throws(() => sh.readSalt('not hex'), /64 lowercase hex/);
  // Batches: 100 rows, or 200,000 characters of question and answer text.
  const many = Array.from({ length: 250 }, (_, i) => ({ id: String(i).padStart(16, '0'), question: 'q', answer: 'a' }));
  assert.deepEqual(sh.cutBatches(many).map((b) => b.length), [100, 100, 50]);
  const long = Array.from({ length: 5 }, (_, i) => ({ id: String(i), question: 'q', answer: 'x'.repeat(90_000) }));
  assert.deepEqual(sh.cutBatches(long).map((b) => b.length), [2, 2, 1]);
  assert.equal(sh.BATCH_MAX_ROWS, 100);
  assert.equal(sh.BATCH_MAX_CHARS, 200000);
  const prompt = sh.batchPrompt(sheet.slice(0, 2));
  assert.ok(prompt.startsWith(`${sh.UNNOTICED_MISS_RUBRIC}\n\n${sh.LABEL_BATCH_INSTRUCTION}\n\n`));
  assert.equal(prompt.trim().split('\n').slice(-2).map((l) => JSON.parse(l).id).join(), sheet.slice(0, 2).map((r) => r.id).join());
  // A reply: one line per row; none, two, or a label outside the three is unparsed.
  const ids = ['x1', 'x2', 'x3', 'x4'];
  const reply = ['{"id":"x1","label":"says"}', '{"id":"x2","label":"says"}', '{"id":"x2","label":"says"}', '{"id":"x3","label":"maybe"}', 'prose'].join('\n');
  assert.deepEqual([...sh.readLabels(reply, ids)], [['x1', 'says'], ['x2', 'unparsed'], ['x3', 'unparsed'], ['x4', 'unparsed']]);
  // Agreement and kappa: 10 rows, 8 alike.
  const a = new Map(Array.from({ length: 10 }, (_, i) => [`r${i}`, i < 5 ? 'says' : 'does-not-say']));
  const b = new Map(Array.from({ length: 10 }, (_, i) => [`r${i}`, i < 4 || i === 9 ? 'says' : 'does-not-say']));
  const ag = sh.agreement(a, b, [...a.keys()]);
  assert.deepEqual([ag.n, ag.alike, ag.share], [10, 8, 0.8]);
  assert.equal(ag.kappa, 0.6, 'po 0.8, pe 0.5');
});

test('the round’s section: McNemar’s exact test, the paired comparison, the notice rate behind the builder and the read’s price', async () => {
  const round = await load('scoring/round.mjs');
  assert.equal(typeof round.mcnemarExact, 'function', 'round.mjs exports mcnemarExact');
  // The two figures S1's cold read computed (benchmark/README.md, "Caveats").
  assert.equal(Number(round.mcnemarExact(36, 38).toFixed(2)), 0.91);
  assert.equal(Number(round.mcnemarExact(13, 11).toFixed(2)), 0.84);
  assert.equal(round.mcnemarExact(0, 0), 1);
  assert.equal(round.mcnemarExact(0, 5), 0.0625);
  const row = (spec, qid, repeat, loaded1) => ({ status: 'complete', spec, qid, repeat, acceptable: [['socrata']], loaded1 });
  const p = round.pairedFirstRequest([row('m', 'q1', 1, ['socrata']), row('m', 'q2', 1, []), row('m', 'q3', 1, ['socrata'])], [row('m', 'q1', 1, []), row('m', 'q2', 1, []), row('m', 'q3', 1, ['socrata']), row('m', 'q4', 1, [])]);
  assert.deepEqual([p.pairs, p.both, p.onlyFirst, p.onlySecond, p.neither, p.mcnemarP], [3, 1, 1, 0, 1, 1]);
  // The notice rate behind the builder: rows whose selection misses.
  const miss = stubRow('a', { shortlist: ['nyc_record'], searches: [{ query: 'x', hits: [] }] });
  const late = stubRow('b', { shortlist: ['nyc_record'], stubSearches: [{ query: 'y', hits: [], afterRequest: -1 }] });
  const empty = stubRow('c', { shortlist: [], noRequest: 'empty selection' });
  const held = stubRow('d', { shortlist: ['socrata'] });
  const n = round.noticeBehindBuilder([miss, late, empty, held]);
  assert.deepEqual(n.noticed.allRows, { n: 3, hits: 1, rate: 0.3333 });
  assert.deepEqual(n.noticed.rowsThatSentARequest, { n: 2, hits: 1, rate: 0.5 });
  assert.deepEqual(n.noticedByEnd.rowsThatSentARequest, { n: 2, hits: 2, rate: 1 });
  // The builder's read, priced per question: S1's measurement, held to S1's rows.
  const price = round.builderReadPrice();
  assert.deepEqual(Object.fromEntries(Object.entries(price).map(([k, v]) => [k, v.perQuestionUsd])), { 50: 0.001, 200: 0.0034, 1000: 0.0751 });
  const reads = readFileSync(join(REPO, S1_RUN, 'rows.jsonl'), 'utf8').split('\n').filter((l) => l.includes('"role":"builder"')).map((l) => JSON.parse(l));
  for (const size of [50, 200, 1000]) {
    const sum = reads.filter((r) => r.step === `builder-${size}-reads`).reduce((s, r) => s + Number(r.costUsd), 0);
    assert.equal(Number(sum.toFixed(4)), round.S1_BUILDER_READS.totalUsd[size], `builder-${size}-reads`);
  }
  assert.equal(round.summarizeRound({ meta: { steps: [] }, rows: [{ status: 'complete' }] }), null, 'a run with no stub row has no round section');
});

test('the scorer over a driven stub run adds the round’s section; over S1’s committed run it adds none', async () => {
  const { summarize, readRunFiles } = await load('scoring/analyze.mjs');
  await load('scoring/round.mjs');
  const out = mkdtempSync(join(tmpdir(), 'round-'));
  try {
    const r = spawnSync(process.execPath, ['--import', PRELOAD, DRIVER, 'answer', out], { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(r.status, 0, r.stderr);
    const s = summarize(readRunFiles(out));
    assert.ok(s.round, 'the round section');
    assert.equal(s.round.groups.length, 2);
    for (const g of s.round.groups) {
      assert.deepEqual(g.endedBy, { answer: 1 });
      assert.ok(g.noticeBehindBuilder, 'E carries the notice rate behind the builder');
      assert.equal(g.unnoticedMiss.labels, null, 'no labels yet');
      assert.ok(Number(g.costUsd) > Number(g.s1CostUsd));
    }
    const s1 = summarize(readRunFiles(join(REPO, S1_RUN)));
    assert.equal(s1.round, undefined);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
