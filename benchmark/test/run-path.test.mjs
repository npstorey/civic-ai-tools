// The run path, end to end, with no key and no network: OpenRouter is stubbed
// in the process (fixtures/stub-openrouter.mjs), the run writes to a temporary
// directory, and the scorer reads what it wrote. What this holds:
//
//   - the second request is the app's after a load: the system prompt
//     recomposed by the router over the loaded set, the app's load-result
//     text, `load_source` and the loaded source's tools (aliased names);
//   - every file the run writes keeps the digit-run convention, and the key
//     appears in none of them;
//   - the contact ledger names every request;
//   - a cap too small for the first call stops the run, records the stop and
//     exits 2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCivicRouter, CIVIC_MANIFEST, readMcpEnv } from '@typedstandards/civic-typed-router';
import { longDigitRuns } from '../runner/writer.mjs';
import { LOAD_RESULT_TEXT } from '../runner/app-texts.mjs';
import { readRunFiles, summarize } from '../scoring/analyze.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const STUB = fileURLToPath(new URL('./fixtures/stub-openrouter.mjs', import.meta.url));
const KEY = 'stub-not-a-credential';

function run(out, extra) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      STUB,
      'benchmark/runner/run.mjs',
      '--inventory',
      'benchmark/inventories/7.json',
      '--questions',
      'benchmark/runner/fixtures/r5-questions.json',
      '--config',
      'baseline-7',
      '--probe',
      '--today',
      '2026-11-02',
      '--out-dir',
      out,
      ...extra,
    ],
    { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH, OPENROUTER_API_KEY: KEY, STUB_LOG: join(out, 'requests.jsonl') } },
  );
}

test('a stubbed probe runs end to end and writes under the convention', async () => {
  const out = mkdtempSync(join(tmpdir(), 'run-path-'));
  try {
    const r = run(out, ['--cap', '1']);
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const [runId] = readdirSync(out).filter((n) => n.startsWith('2026-11-02-probe-'));
    const dir = join(out, runId);
    assert.deepEqual(readdirSync(dir).sort(), ['baseline.jsonl', 'contact-ledger.md', 'meta.json', 'rows.jsonl']);

    for (const name of readdirSync(dir)) {
      const text = readFileSync(join(dir, name), 'utf8');
      assert.deepEqual(longDigitRuns(text), [], `${name} keeps the digit-run convention`);
      assert.ok(!text.includes(KEY), `${name} does not hold the key`);
    }
    const rows = readFileSync(join(dir, 'rows.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    assert.equal(rows.length, 2);
    const charter = rows.find((x) => x.qid === 'q11');
    assert.equal(charter.status, 'complete');
    assert.equal(charter.score1, 'exact');
    assert.equal(charter.second.outcome, 'valid_tool_call');
    assert.match(charter.second.content, /CT\d{15}/, 'the text parses back to the digits the model wrote');
    assert.match(charter.first.cost.charged, /^\d+\.\d{1,8}$/, 'a cost is a decimal string');
    const twoSource = rows.find((x) => x.qid === 'q34');
    assert.deepEqual(twoSource.first.invalidAliases, ['{"alias":"boston"}'], 'Boston is unconfigured in baseline-7, so its alias is not listed');
    assert.deepEqual(twoSource.loaded1, ['data_commons']);
    assert.equal(twoSource.second.outcome, 'invalid_tool_call');
    assert.equal(twoSource.second.evaluated.find((e) => e.name === 'get_observations').nearMiss, 'bare upstream name of data_commons__get_observations');

    // What the runner sent: the app's second request.
    const sent = readFileSync(join(out, 'requests.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const second = sent.find((b) => b.messages.some((m) => m.role === 'tool') && b.messages.find((m) => m.role === 'user').content.includes('Public Advocate'));
    const router = createCivicRouter(CIVIC_MANIFEST);
    const configured = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata.not-called.invalid/mcp', NYC_CHARTER_HOSTING: 'sandbox', NYC_CHECKBOOK_HOSTING: 'sandbox', NYC_RECORD_HOSTING: 'sandbox', NYS_LEGISLATION_HOSTING: 'sandbox' });
    const directory = router.offeredSkillSources(configured);
    const fetchers = { fetchPrompt: async () => '', fetchInstructions: async () => null };
    const expectedSystem = await router.aliasedInLoopSystemPrompt({ configured, today: '2026-11-02', publicationHost: 'civicaitools.org', selection: directory, loaded: ['nyc-charter'], ...fetchers });
    assert.equal(second.messages[0].content, expectedSystem, 'the system prompt is the router’s in-loop prompt over the loaded source');
    assert.equal(second.messages.find((m) => m.role === 'tool').content, LOAD_RESULT_TEXT.loaded('nyc_charter'));
    assert.deepEqual(
      second.tools.map((t) => t.function.name),
      ['load_source', ...router.aliasedMcpTools.filter((t) => t.function.name.startsWith('nyc_charter__')).map((t) => t.function.name)],
    );
    assert.deepEqual(second.reasoning_effort, 'low');
    assert.equal(second.max_completion_tokens, 4000);

    const ledger = readFileSync(join(dir, 'contact-ledger.md'), 'utf8');
    const lines = ledger.split('\n').filter((l) => /^\| \d{4}-/.test(l));
    assert.equal(lines.length, 2 + sent.length, 'the list, the key check and every chat request');
    assert.ok(lines.every((l) => l.includes('openrouter.ai/api/v1/')));

    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
    assert.ok(meta.inputs.some((i) => i.role === 'inventory' && i.canonicalSha256));
    assert.deepEqual(meta.config.directory, ['socrata', 'data_commons', 'nyc_charter', 'nyc_checkbook', 'nyc_record', 'nys_legislation']);
    assert.equal(meta.stopReason, null);
    // The spend the run recorded is the spend the scorer sums, including the
    // baseline step re-sent at 16 after no usage at 1.
    const summary = summarize(readRunFiles(dir));
    assert.equal(summary.spentUsd, Number(Number(meta.spentUsd).toFixed(4)));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('a cap the first call would pass stops the run and exits 2', () => {
  const out = mkdtempSync(join(tmpdir(), 'run-cap-'));
  try {
    const r = run(out, ['--cap', '0.0001']);
    assert.equal(r.status, 2, `${r.stdout}\n${r.stderr}`);
    const [runId] = readdirSync(out).filter((n) => n.startsWith('2026-11-02-probe-'));
    const meta = JSON.parse(readFileSync(join(out, runId, 'meta.json'), 'utf8'));
    assert.match(meta.stopReason, /^cap: /);
    assert.equal(meta.completeRows, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('a run without --cap is refused before anything is read', () => {
  const out = mkdtempSync(join(tmpdir(), 'run-nocap-'));
  try {
    const r = run(out, []);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--cap <usd> is required/);
    assert.deepEqual(readdirSync(out), []);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
