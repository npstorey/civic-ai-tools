// The models S1 runs (G0-3b): each one's preregistered request parameters,
// its reservation price, and the roster check over the committed snapshot
// of OpenRouter's lists (runner/openrouter-models.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './load.mjs';

const snapshot = () => JSON.parse(readFileSync(new URL('../runner/openrouter-models.json', import.meta.url), 'utf8'));

test('each model’s request parameters: no temperature, the limit field it lists, the reasoning setting and the routing', async () => {
  const { resolveModel, OPEN_WEIGHT_CANDIDATES, OPEN_WEIGHT_ALTERNATE } = await load('runner/models.mjs');
  assert.deepEqual(resolveModel('anthropic/claude-haiku-5.5').params(4000), { max_completion_tokens: 4000, reasoning_effort: 'low' });
  const routing = { max_price: { prompt: 0.15, completion: 0.6 }, require_parameters: true };
  assert.deepEqual(resolveModel('z-ai/glm-5.3-flash').params(4000), { max_tokens: 4000, reasoning_effort: 'low', provider: routing });
  assert.deepEqual(resolveModel('deepseek/deepseek-v4-flash-0731').params(4000), { max_tokens: 4000, reasoning_effort: 'low', provider: routing });
  assert.deepEqual(resolveModel('xiaomi/mimo-v2.6-flash').params(4000), { max_tokens: 4000, provider: routing });
  assert.deepEqual(resolveModel('qwen/qwen3.8-flash').params(4000), { max_tokens: 4000, provider: routing });
  assert.deepEqual(OPEN_WEIGHT_CANDIDATES, ['z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.6-flash']);
  assert.equal(OPEN_WEIGHT_ALTERNATE, 'qwen/qwen3.8-flash');
  assert.throws(() => resolveModel('z-ai/glm-5.3-flash@high'), /preregistered/);
});

test('the reservation price is the dearest endpoint a request may land on, and the routing’s ceilings', async () => {
  const { resolveModel, reservationPricings } = await load('runner/models.mjs');
  const { worstCostOver } = await load('runner/pricing.mjs');
  const snap = snapshot();
  const haiku = resolveModel('anthropic/claude-haiku-5.5');
  const hp = reservationPricings(haiku, snap.data.find((x) => x.id === haiku.slug), snap.endpoints[haiku.slug]);
  assert.ok(Math.abs(worstCostOver(hp, 1000, 0, 0) - 1000 * 0.11e-6) < 1e-15, "Haiku's dearest endpoint, $0.11 a million");
  assert.ok(Math.abs(worstCostOver(hp, 100000, 0, 0) - 100000 * 0.55e-6) < 1e-12, 'and $0.55 above its 100,000-token step');
  for (const slug of ['z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.6-flash']) {
    const m = resolveModel(slug);
    const p = reservationPricings(m, snap.data.find((x) => x.id === slug), snap.endpoints[slug]);
    assert.ok(Math.abs(worstCostOver(p, 1e6, 0, 0) - 0.15) < 1e-9, `${slug}: input at the $0.15 ceiling`);
    assert.ok(Math.abs(worstCostOver(p, 0, 1e6, 0) - 0.6) < 1e-9, `${slug}: output at the $0.60 ceiling`);
  }
});

test('the roster check passes the snapshot and refuses what the routing could not serve', async () => {
  const { resolveModel } = await load('runner/models.mjs');
  const { checkRoster } = await load('runner/roster.mjs');
  const snap = snapshot();
  const all = ['anthropic/claude-haiku-5.5', 'z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.6-flash', 'qwen/qwen3.8-flash'].map(resolveModel);
  assert.deepEqual(checkRoster(all, snap, 4000, snap.endpoints), []);
  const glm = resolveModel('z-ai/glm-5.3-flash');
  const noEffort = { ...snap.endpoints, [glm.slug]: snap.endpoints[glm.slug].map((e) => ({ ...e, supported_parameters: e.supported_parameters.filter((f) => f !== 'reasoning_effort') })) };
  assert.match(checkRoster([glm], snap, 4000, noEffort).join('\n'), /no endpoint is up, within the routing's prices, and lists .*reasoning_effort/);
  const dear = { ...snap.endpoints, [glm.slug]: snap.endpoints[glm.slug].map((e) => ({ ...e, pricing: { ...e.pricing, prompt: '0.2' } })) };
  assert.match(checkRoster([glm], snap, 4000, dear).join('\n'), /no endpoint is up, within the routing's prices/);
  assert.match(checkRoster([glm], snap, 4000, {}).join('\n'), /endpoints list was not read/);
});
