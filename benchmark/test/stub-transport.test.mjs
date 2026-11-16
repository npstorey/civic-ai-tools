// S3-C, C2 (hub #318; benchmark/preregistration/s3c.md, "The stub
// transport"): under the no-network preload, with the model's replies
// supplied to the engine as its fetch, a row of `builder+search-50` (E) is
// driven to an answer (fixtures/drive-stub-row.mjs). The test of record:
//
//   - every call of a loaded source's tool got the one fixed result;
//   - `load_source`, `find_source` and a name that is not offered got S1's
//     texts;
//   - the row ended in an answer;
//   - the only fetch made was the model request, and the preload, which
//     throws on any other fetch or socket, was still in force at the end.
//
// Beside it: the loop's bound and the answering turn, an empty and an
// announcing response, the size limit, an error after S1's last request, a
// probe row's forced answering request, and the reservation of a stub row.
// Each test asserts the stub module first, so on a tree without it each is
// red at an assertion.

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
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** The stub module and its exports, asserted. */
async function stubModule() {
  const stub = await load('runner/stub.mjs');
  assert.equal(stub.STUB_RESULT_TEXT, 'The call ran and returned no rows.');
  assert.equal(stub.STUB_MAX_REQUESTS, 6);
  assert.equal(stub.STUB_BODY_LIMIT, 120000);
  assert.equal(stub.STUB_SLOTS, 7);
  return stub;
}

/** One scenario of the driver, under the no-network preload. */
function drive(scenario) {
  const out = mkdtempSync(join(tmpdir(), `stub-${scenario}-`));
  const r = spawnSync(process.execPath, ['--import', PRELOAD, DRIVER, scenario, out], { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH } });
  return { out, r, status: r.status === 0 ? JSON.parse(r.stdout.trim().split('\n').at(-1)) : null, rows: () => lines(join(out, 'rows.jsonl')), bodies: () => lines(join(out, 'requests.jsonl')), fetches: () => lines(join(out, 'fetches.jsonl')) };
}

test('C2: a builder+search-50 row driven to an answer under the no-network preload: the loaded tools get the fixed result, S1’s tools S1’s texts, and the fetch sees only model calls', async () => {
  const stub = await stubModule();
  const { LOAD_RESULT_TEXT, UNKNOWN_TOOL_TEXT } = await load('runner/app-texts.mjs');
  const { FIND_SOURCE_TEXT } = await load('runner/texts.mjs');
  const d = drive('answer');
  try {
    assert.equal(d.r.status, 0, `${d.r.stdout}\n${d.r.stderr}`);
    assert.doesNotMatch(d.r.stderr, /no-network preload/, 'no fetch or socket but the engine’s was attempted');
    assert.equal(d.status.fetchRefused, true, 'the preload still refuses a fetch');
    assert.equal(d.status.socketRefused, true, 'the preload still refuses a socket');
    const rows = d.rows();
    assert.equal(rows.length, 2, 'one row a model');
    const bodies = d.bodies();
    const fetches = d.fetches();
    assert.ok(fetches.length > 0);
    assert.ok(fetches.every((f) => f.url === 'https://openrouter.ai/api/v1/chat/completions' && f.method === 'POST'), 'every fetch is a model request');
    let stubResults = 0;
    for (const row of rows) {
      assert.equal(row.status, 'complete');
      assert.equal(row.transport, 'stub');
      assert.equal(row.config, 'builder+search-50');
      assert.deepEqual([...row.shortlist].sort(), [...d.status.selection].sort(), "the directory is S1's recorded selection, listed in manifest order");
      assert.equal(row.stub.endedBy, 'answer');
      assert.match(row.stub.answer, /could not be checked/);
      assert.equal(row.stub.answeringReason, null);
      // S1's requests, then the stub's: three and two.
      assert.equal(row.requests.length, 2);
      assert.equal(row.second.kind, 'after-load');
      assert.equal(row.stub.requests.length, 2);
      assert.ok([...row.requests, row.second, ...row.stub.requests].every((q) => q.provider === 'ScriptedProvider'), "every request records the response's provider");
      assert.ok(row.stub.requests.every((q) => q.kind === 'stub' && /^[0-9a-f]{64}$/.test(q.definitionHash)));
      // The calls of the response to S1's last request, answered by the table.
      const s1Last = row.stub.s1LastAnswered;
      assert.equal(s1Last.answeredBy, 'stub');
      assert.deepEqual(s1Last.calls.map((c) => c.by), ['stub', 'unknown', 'search', 'unknown']);
      assert.match(s1Last.calls[1].nearMiss, /^bare upstream name of /, 'a bare upstream name is classed as S1 classes it');
      assert.deepEqual(row.stub.requests[0].answered.map((c) => c.by), ['stub', 'load']);
      assert.ok(row.stub.searches.length === 1 && row.stub.searches[0].afterRequest === -1, 'the search after S1’s last request is the stub’s');
      assert.equal(row.searches.length, 1, "S1's searches hold S1's requests' searches only");
      assert.equal(row.stub.loadedEnd.length, 2);
      assert.ok(row.stub.directoryEnd.length > row.shortlist.length, 'the searches widened the directory');
      // Every tool result the requests after S1's last carried, by what it answered.
      const sent = bodies.filter((b) => b.model === row.model);
      const firstStub = sent[3];
      const lastCalls = sent[2] && row.second.toolCalls;
      assert.ok(lastCalls.length === 4);
      const results = firstStub.messages.slice(-4);
      assert.deepEqual(results.map((m) => m.role), ['tool', 'tool', 'tool', 'tool']);
      assert.equal(results[0].content, stub.STUB_RESULT_TEXT, 'the loaded tool: the fixed result');
      assert.equal(results[1].content, UNKNOWN_TOOL_TEXT(lastCalls[1].name), 'a bare upstream name: S1’s unknown-tool text');
      assert.equal(results[2].content, FIND_SOURCE_TEXT.found(row.stub.searches[0].hits), 'find_source: S1’s text');
      assert.equal(results[3].content, UNKNOWN_TOOL_TEXT('nope_tool'), 'a name that is not offered: S1’s text');
      const second = sent[4].messages.slice(-2);
      assert.equal(second[0].content, stub.STUB_RESULT_TEXT);
      assert.equal(second[1].content, LOAD_RESULT_TEXT.loaded(row.stub.loadedEnd[1]), 'load_source: S1’s text');
      for (const b of sent.slice(3)) for (const m of b.messages) if (m.role === 'tool' && m.content === stub.STUB_RESULT_TEXT) stubResults++;
      // The app's request: the router's prompt over the loads, every earlier message.
      assert.equal(sent[4].tool_choice, 'auto');
      assert.ok(sent[4].tools.some((t) => t.function.name === 'find_source'));
      assert.ok(sent[4].tools.some((t) => t.function.name.startsWith(`${row.stub.loadedEnd[1]}__`)) || sent[4].tools.length >= 2);
      assert.equal(sent[4].messages.filter((m) => m.role === 'assistant').length, 4);
      assert.equal(row.reservation.requests, 11, "S1's four slots and the stub's seven");
      assert.ok(Math.abs(Number(row.costUsd) - Number(row.stub.s1CostUsd) - Number(row.stub.costUsd)) < 1e-9, "the row's cost is the whole row's");
    }
    assert.equal(stubResults, rows.length * (1 + 2), 'each stub request carries every fixed result so far: one, then two');
    assert.equal(fetches.length, rows.length * 5, 'three of S1’s requests and two of the stub’s, a row: nothing else');
  } finally {
    rmSync(d.out, { recursive: true, force: true });
  }
});

test('the loop’s bound: six requests after S1’s last, then the answering turn with the app’s note for each pending call', async () => {
  const stub = await stubModule();
  const { FINAL_ANSWER_REQUEST, UNRUN_TOOL_CALL_NOTE } = await load('runner/app-texts.mjs');
  const d = drive('bound');
  try {
    assert.equal(d.r.status, 0, d.r.stderr);
    const [row] = d.rows();
    assert.equal(row.stub.endedBy, 'answering-turn');
    assert.equal(row.stub.answeringReason, 'bound');
    assert.deepEqual(row.stub.requests.map((q) => q.kind), [...Array(stub.STUB_MAX_REQUESTS).fill('stub'), 'answering']);
    assert.deepEqual(row.stub.requests.at(-1).foundPending, [{ name: row.stub.requests[5].toolCalls[0].name, by: 'unrun' }]);
    assert.equal(row.stub.answer, 'There were no matching records.');
    const answering = d.bodies().filter((b) => b.model === row.model).at(-1);
    assert.ok(!('tools' in answering) && !('tool_choice' in answering), 'the answering request carries no tools and no tool_choice');
    assert.deepEqual(answering.messages.at(-1), { role: 'user', content: FINAL_ANSWER_REQUEST });
    assert.equal(answering.messages.at(-2).content, UNRUN_TOOL_CALL_NOTE);
    assert.equal(answering.max_completion_tokens, 4000);
  } finally {
    rmSync(d.out, { recursive: true, force: true });
  }
});

test('an empty response and an announcing one take the answering turn; the empty one is left out of its messages', async () => {
  await stubModule();
  for (const [scenario, reason] of [['empty', 'empty'], ['announcement', 'announcement']]) {
    const d = drive(scenario);
    try {
      assert.equal(d.r.status, 0, d.r.stderr);
      const [row] = d.rows();
      assert.equal(row.stub.endedBy, 'answering-turn', scenario);
      assert.equal(row.stub.answeringReason, reason);
      assert.deepEqual(row.stub.requests.map((q) => q.kind), ['answering']);
      const answering = d.bodies().filter((b) => b.model === row.model).at(-1);
      const last = answering.messages.at(-2);
      if (scenario === 'empty') assert.equal(last.role, 'tool', 'the empty response is not among the messages');
      else assert.equal(last.content, "I'll query the dataset for the figures next.", 'the announcing response is');
    } finally {
      rmSync(d.out, { recursive: true, force: true });
    }
  }
});

test('the size limit and an error after S1’s last request end the row with no answer; the row stays complete', async () => {
  const stub = await stubModule();
  const size = drive('size');
  try {
    assert.equal(size.r.status, 0, size.r.stderr);
    const [row] = size.rows();
    assert.equal(row.status, 'complete');
    assert.equal(row.stub.endedBy, 'size');
    assert.equal(row.stub.answer, null);
    assert.ok(row.stub.notSent.promptChars > stub.STUB_BODY_LIMIT);
    assert.equal(row.stub.requests.length, 0);
    assert.ok(size.bodies().every((b) => JSON.stringify(b).length <= stub.STUB_BODY_LIMIT || !b.messages.some((m) => m.role === 'tool' && m.content === stub.STUB_RESULT_TEXT)), 'no body past the limit was sent after S1’s last');
  } finally {
    rmSync(size.out, { recursive: true, force: true });
  }
  const error = drive('error');
  try {
    assert.equal(error.r.status, 0, error.r.stderr);
    const [row] = error.rows();
    assert.equal(row.status, 'complete', "S1's requests all returned");
    assert.equal(row.stub.endedBy, 'error');
    assert.equal(row.stub.failedRequest.error.status, 400);
    assert.equal(row.stub.answer, null);
  } finally {
    rmSync(error.out, { recursive: true, force: true });
  }
});

test('a probe row sends the answering request once its loop ends, recorded under stub.shapeCheck; its answer is its loop’s', async () => {
  await stubModule();
  const d = drive('probe');
  try {
    assert.equal(d.r.status, 0, d.r.stderr);
    for (const row of d.rows()) {
      assert.equal(row.stub.endedBy, 'answer');
      assert.match(row.stub.answer, /could not be checked/);
      assert.equal(row.stub.shapeCheck.sent, true);
      assert.equal(row.stub.shapeCheck.kind, 'answering');
      assert.ok(row.stub.shapeCheck.usage);
    }
    const forced = d.bodies().filter((b) => !b.tools);
    assert.equal(forced.length, 2, 'one forced answering request a row');
    assert.ok(forced.every((b) => b.messages.some((m) => m.role === 'tool')), 'it carries tool results and no tools');
  } finally {
    rmSync(d.out, { recursive: true, force: true });
  }
});

test('a stub row’s reservation: S1’s slots, then seven at 120,000 characters with the completion at its limit', async () => {
  const stub = await stubModule();
  const bounds = await load('runner/bounds.mjs');
  assert.equal(typeof bounds.stubSlotBounds, 'function', 'bounds.mjs exports stubSlotBounds');
  assert.deepEqual(bounds.stubSlotBounds({ cpt: 2, contextLength: 1000000 }), Array(stub.STUB_SLOTS).fill(60000));
  assert.deepEqual(bounds.stubSlotBounds({ cpt: 1.9523, contextLength: 1000000 }), Array(7).fill(Math.ceil(120000 / 1.9523)));
  assert.deepEqual(bounds.stubSlotBounds({ cpt: 1, contextLength: 50000 }), Array(7).fill(50000), 'never past the context length');
  assert.equal(bounds.REQUESTS_PER_ROW['builder+search'], 4);
});
