// S3-C (hub #318; benchmark/preregistration/s3c.md, "The rebuild test"): S1's
// requests rebuild byte for byte at the commit under test.
//
// S1's rows record each body's length, not its bytes, and the router and
// benchmark/inventories/to-manifest.mjs, which build every request, are
// outside the inputs' hash. So the digests of S1's requests, rebuilt at S1's
// run commit (933be10, router 0.6.0) with S1's date, are committed as
// fixtures/s1-request-digests.json (G0's method: a first request's digest is
// the SHA-256 of its body's JSON; an after-load state's is the SHA-256 of its
// system prompt, a NUL and its tools' JSON). This test rebuilds the same
// requests here, with no network, from S1's committed rows: every repeat-1
// main row's first request, every builder read, and the system prompt and
// tools after the loads of every row that loaded (not a search row's). It
// holds each digest equal to the fixture's, and each first request's length
// equal to S1's recorded `promptChars`.
//
// THE CONTROL. Run directly with another date,
//   node benchmark/test/s1-rebuild.test.mjs --today 2026-11-17
// the same rebuild asserts that every first-request digest differs from the
// fixture's while each length still equals S1's: the digests carry the date.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const S1_ROWS = 'benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl';
const FIXTURE = 'benchmark/test/fixtures/s1-request-digests.json';
const S1_DATE = '2026-11-05';
const at = process.argv.indexOf('--today');
const TODAY = at === -1 ? S1_DATE : process.argv[at + 1];
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** S1's requests rebuilt at this commit with `today`: their digests, keyed
 *  as the fixture keys them, and each first request's length beside S1's. */
async function rebuild(today) {
  const { createSession } = await load('runner/session.mjs');
  const { selectionBody, builderBody } = await load('runner/requests.mjs');
  const { resolveModel } = await load('runner/models.mjs');
  // Held fixed, as G0 held it: the router component's version enters the
  // definition hashes, which are recorded, not sent.
  const routerPackage = { name: '@typedstandards/civic-typed-router', version: '0.6.0' };
  const sizeOf = (config) => /-(\d+)$/.exec(config)?.[1] ?? '7';
  const inventories = {};
  const questions = {};
  const sessions = {};
  const sessionOf = async (config) => {
    if (!sessions[config]) {
      const n = sizeOf(config);
      inventories[n] ??= JSON.parse(readFileSync(join(REPO, `benchmark/inventories/${n}.json`), 'utf8'));
      questions[n] ??= new Map(JSON.parse(readFileSync(join(REPO, `benchmark/questions/${n}.json`), 'utf8')).questions.map((q) => [q.id, q]));
      sessions[config] = await createSession({ inventory: inventories[n], configName: config, today, routerPackage, inventoryHash: sha256Hex(canonicalJson(inventories[n])) });
    }
    return sessions[config];
  };
  const digests = {};
  const lengths = [];
  for (const line of readFileSync(join(REPO, S1_ROWS), 'utf8').split('\n')) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row.role === 'rule') continue;
    if (row.role === 'main' && row.repeat !== 1) continue;
    if (row.status !== 'complete' || row.noRequest) continue;
    const s = await sessionOf(row.config);
    const q = questions[sizeOf(row.config)].get(row.qid);
    const m = resolveModel(row.spec);
    let body;
    let recorded;
    if (row.role === 'builder') {
      body = builderBody(s.full, m, q);
      recorded = row.request?.promptChars;
    } else {
      const dir = s.directoryFor(row.shortlist.map((a) => s.entry(a).sourceId));
      const search = s.config.kind === 'search';
      body = selectionBody(dir, m, q, { search });
      recorded = search ? row.requests?.[0]?.promptChars : row.first?.promptChars;
      if (row.loaded1?.length && !search) {
        const state = await dir.afterLoads(row.loaded1.map((a) => s.entry(a).sourceId));
        digests[`${row.key}|after`] = sha(`${state.systemPrompt}\u0000${JSON.stringify(state.tools)}`);
      }
    }
    const json = JSON.stringify(body);
    digests[`${row.key}|first`] = sha(json);
    lengths.push({ key: row.key, recorded, rebuilt: json.length });
  }
  return { digests, lengths };
}

test(`S1's requests rebuild at this commit${TODAY === S1_DATE ? ' byte for byte, with S1’s date' : `, with ${TODAY}: the control`}`, async () => {
  const fixture = JSON.parse(readFileSync(join(REPO, FIXTURE), 'utf8'));
  const keys = Object.keys(fixture);
  assert.equal(keys.length, 6386, "the fixture holds G0's 6,386 digests");
  assert.equal(keys.filter((k) => k.endsWith('|first')).length, 3997);
  assert.equal(keys.filter((k) => k.endsWith('|after')).length, 2389);
  const { digests, lengths } = await rebuild(TODAY);
  assert.deepEqual(Object.keys(digests).sort(), [...keys].sort(), 'the same requests are rebuilt');
  assert.equal(lengths.length, 3997);
  const longer = lengths.filter((l) => l.recorded !== l.rebuilt);
  assert.deepEqual(longer, [], "each first request's length equals S1's promptChars");
  const firstKeys = keys.filter((k) => k.endsWith('|first'));
  if (TODAY === S1_DATE) {
    const differ = keys.filter((k) => digests[k] !== fixture[k]);
    assert.deepEqual(differ, [], 'each of the 6,386 digests equals the fixture’s');
  } else {
    const same = firstKeys.filter((k) => digests[k] === fixture[k]);
    assert.deepEqual(same, [], `with ${TODAY}, every first-request digest differs from S1's`);
    console.log(`# control: ${TODAY}: ${firstKeys.length} of ${firstKeys.length} first-request digests differ; ${lengths.length} lengths equal S1's`);
  }
});
