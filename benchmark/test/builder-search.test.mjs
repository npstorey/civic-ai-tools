// S3-C (hub #318; benchmark/preregistration/s3c.md, "`builder+search-N`
// (E)"): the configuration resolves at 50, 200 and 1,000 with builder-N's
// rule and cap and shortlist+search-N's search; its routing configuration and
// hashes are the ones the preregistration records, and S1's configurations
// keep theirs; an empty selection sends no request.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const ROUTER = readJson('packages/civic-typed-router/package.json');

/** The routing-configuration hashes the preregistration records (computed
 *  at hub 1d97e0e, before this configuration existed). */
const RECORDED = {
  'builder+search-50': '6a469d222be05e6468950fc84e2ab72effad68c5abc83cd64c2c675f5bde92d2',
  'builder+search-200': '4507327ecc333598adb93b451d69521e811e1dcc5543693cd5fb69c6b12f3e66',
  'builder+search-1000': '4d551caafdb76dd9f7b598e8b2c3689aef27c582760ec185e7e1c936018caea4',
  'builder-50': 'f3adb773f1161daea675f9c7a917c03c8ffcf1748f0fc7fd7f7ca9ef1f716233',
  'builder-200': '33396b9aefdf0d59aa9e7c729a56c628282acd774a31225be5bad5b68db48d17',
  'builder-1000': '9a54a537fd1f1003399935a4b204f8e5ae7a74dcdbfa8b973793113c2ac0af00',
  'shortlist+search-50': 'ba91fc0817390b35d58172ae139f728e244823ba3cdcccedd1d4db42963fbcbf',
  'shortlist+search-200': '84358bba5f0e29e41bbd06f32bd0bcfc92096eda422d9993ba83ddb054d7e0c3',
  'shortlist+search-1000': '25434e23206312fd996e78acd8fa5e7710b3e76f3c49858dc87eabfb2fe38469',
};

test('builder+search-N resolves at 50, 200 and 1,000: builder-N’s rule and cap, shortlist+search-N’s search', async () => {
  const { resolveConfig } = await load('runner/session.mjs');
  for (const n of [50, 200, 1000]) {
    const inventory = readJson(`benchmark/inventories/${n}.json`);
    let c;
    assert.doesNotThrow(() => {
      c = resolveConfig(`builder+search-${n}`, inventory);
    }, `builder+search-${n} resolves`);
    assert.equal(c.kind, 'builder+search');
    assert.equal(c.rule, 'builder selection (Haiku 5.5 at low, once per question), cap 25, find_source (bm25 1)');
    assert.deepEqual(c.routingRule, { id: 'builder', version: '1' });
    assert.equal(c.cap, '25');
    assert.deepEqual(c.search, { method: 'bm25', version: '1' });
    assert.equal(c.requestsPerRow, 4, "S1's requests: up to three selection requests, then the request after a load");
    assert.throws(() => resolveConfig(`builder+search-${n}`, readJson('benchmark/inventories/7.json')), /runs over the/);
  }
});

test('the per-configuration hashes: E’s as the preregistration records them, S1’s configurations’ unchanged', async () => {
  const { createSession } = await load('runner/session.mjs');
  for (const [config, hash] of Object.entries(RECORDED)) {
    const n = /-(\d+)$/.exec(config)[1];
    const inventory = readJson(`benchmark/inventories/${n}.json`);
    let session;
    await assert.doesNotReject(async () => {
      session = await createSession({ inventory, configName: config, today: '2026-11-05', routerPackage: ROUTER, inventoryHash: sha256Hex(canonicalJson(inventory)) });
    }, config);
    const h = session.hashes();
    assert.equal(h.routingConfigurationHash, hash, config);
    // The first request's harness definition: the router's component alone,
    // the same in every configuration; at router 0.11.0, the preregistration's value.
    if (ROUTER.version === '0.11.0') assert.equal(h.firstRequestDefinitionHash, 'c68bd1206de5e5326274192be9c8c157ebd644a7be9120e20710719cb3cdab41', config);
    if (config.startsWith('builder+search-')) {
      assert.equal(canonicalJson(h.routingConfiguration), `{"cap":"25","inventory":{"hash":"${readFileSync(join(REPO, `benchmark/inventories/${n}.json.sha256`), 'utf8').trim()}","id":"civic-${n}","version":"2026-11-03.1"},"rule":{"id":"builder","version":"1"},"search":{"method":"bm25","version":"1"}}`);
    }
  }
});

test('an empty selection: a builder+search-N row sends no request and is complete with no load and no search', async () => {
  const { createEngine } = await load('runner/engine.mjs');
  const { createSession, resolveConfig } = await load('runner/session.mjs');
  const { createIndex } = await load('runner/search.mjs');
  const inventory = readJson('benchmark/inventories/50.json');
  assert.doesNotThrow(() => resolveConfig('builder+search-50', inventory), 'builder+search-50 resolves');
  const session = await createSession({ inventory, configName: 'builder+search-50', today: '2026-11-05', routerPackage: ROUTER });
  assert.equal(session.config.kind, 'builder+search');
  const rows = [];
  let fetched = 0;
  const engine = createEngine({ ledger: { record() {} }, apiKey: 'x', baseUrl: 'https://openrouter.ai/api/v1', cap: 1, writeRow: (_, r) => rows.push(r), fetchImpl: async () => { fetched++; throw new Error('no request is sent'); } });
  const q = { id: 'q127', kind: 'single', text: 'x', acceptable: [['socrata']] };
  await engine.runTasks([{ type: 'search', key: 'k', step: { id: 'builder+search-50' }, session, index: createIndex(inventory.entries), dir: session.directoryFor([]), mi: { m: { slug: 'm', spec: 'm', control: false } }, q, r: 1, transport: 'stub' }], 1);
  assert.equal(fetched, 0);
  assert.equal(rows[0].status, 'complete');
  assert.match(rows[0].noRequest, /^empty selection/);
  assert.deepEqual([rows[0].loaded1, rows[0].searches, rows[0].requests, rows[0].shortlist], [[], [], [], []]);
  assert.equal(rows[0].stub, null);
  assert.equal(rows[0].transport, 'stub');
  assert.equal(rows[0].costUsd, 0);
});
