#!/usr/bin/env node
// OpenRouter's public lists, as the runner reads them: the model list
// (GET /api/v1/models) and a model's endpoints list (GET
// /api/v1/models/<author>/<slug>/endpoints). Both need no key.
//
// A run reads both live, before it spends. A dry run reads the committed
// snapshot, `openrouter-models.json`, which this file writes from the raw
// responses (read once, 2026-11-03, by curl, kept outside the repository):
//
//   node benchmark/runner/openrouter.mjs --write <raw dir> --read-at <file of
//     "<model list time>"> --endpoints-log <file of "<slug> <time> <status>
//     <sha256>" lines>
//
// Only the fields the runner reads are kept, every price written per million
// tokens (pricing.mjs); a model's description and anything else free-form is
// not copied. The raw texts are third-party data: nothing in them is followed.

import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pricingPerMillion } from './pricing.mjs';
import { jsonDocument } from './writer.mjs';

export const BASE_URL = 'https://openrouter.ai/api/v1';
export const MODEL_LIST_URL = `${BASE_URL}/models`;
export const endpointsUrl = (slug) => `${BASE_URL}/models/${slug}/endpoints`;

/** The models the snapshot keeps: the catalog's three, and the open-weight
 *  candidates and their alternate (the seat's G0-3b record, hub #302 comment
 *  6615311402). */
export const SNAPSHOT_MODELS = Object.freeze([
  'anthropic/claude-haiku-5.5',
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-opus-5.5',
  'z-ai/glm-5.3-flash',
  'deepseek/deepseek-v4-flash-0731',
  'xiaomi/mimo-v2.6-flash',
  'qwen/qwen3.8-flash',
]);

/** The models whose endpoints the snapshot keeps: the two main models'
 *  candidates (the larger models are not run, D14). */
export const SNAPSHOT_ENDPOINT_MODELS = Object.freeze([
  'anthropic/claude-haiku-5.5',
  'z-ai/glm-5.3-flash',
  'deepseek/deepseek-v4-flash-0731',
  'xiaomi/mimo-v2.6-flash',
  'qwen/qwen3.8-flash',
]);

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

/** One model-list row, as the runner keeps it. */
export function modelRow(row) {
  return {
    id: row.id,
    context_length: row.context_length,
    pricing: pricingPerMillion(row.pricing),
    supported_parameters: [...(row.supported_parameters ?? [])].sort(),
    ...(row.reasoning ? { reasoning: pick(row.reasoning, ['mandatory', 'default_enabled', 'supported_efforts', 'default_effort']) } : {}),
    ...(row.top_provider ? { top_provider: pick(row.top_provider, ['context_length', 'max_completion_tokens']) } : {}),
  };
}

/** One endpoint, as the runner keeps it. `discount` is kept as listed. */
export function endpointRow(e) {
  const { discount, ...prices } = e.pricing ?? {};
  return {
    provider_name: e.provider_name,
    tag: e.tag,
    quantization: e.quantization ?? null,
    status: e.status,
    context_length: e.context_length,
    max_completion_tokens: e.max_completion_tokens ?? null,
    pricing: { ...pricingPerMillion(prices), discount: String(discount ?? 0) },
    supported_parameters: [...(e.supported_parameters ?? [])].sort(),
  };
}

/** The runner's view of a model list and its endpoints. */
export function snapshotOf({ listText, endpointTexts }) {
  const list = JSON.parse(listText).data;
  const data = SNAPSHOT_MODELS.map((id) => {
    const row = list.find((m) => m.id === id);
    if (!row) throw new Error(`the model list has no ${id}`);
    return modelRow(row);
  });
  const endpoints = Object.fromEntries(
    Object.entries(endpointTexts).map(([slug, text]) => [slug, JSON.parse(text).data.endpoints.map(endpointRow).sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))]),
  );
  return { data, endpoints };
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function main() {
  const args = process.argv.slice(2);
  const arg = (name) => args[args.indexOf(name) + 1];
  if (!args.includes('--write')) {
    console.error('usage: node benchmark/runner/openrouter.mjs --write <raw dir> --read-at <file> --endpoints-log <file>');
    process.exit(2);
  }
  const dir = arg('--write');
  const listText = readFileSync(join(dir, 'models.json'), 'utf8');
  const log = readFileSync(arg('--endpoints-log'), 'utf8').trim().split('\n').map((l) => l.split(' '));
  const endpointTexts = {};
  const endpointSources = [];
  for (const [slug, readAt, status, hash] of log) {
    const text = readFileSync(join(dir, `endpoints-${slug.replace('/', '_')}.json`), 'utf8');
    if (sha256(text) !== hash || status !== '200') throw new Error(`${slug}: the raw file is not the one logged`);
    endpointTexts[slug] = text;
    endpointSources.push({ model: slug, url: endpointsUrl(slug), readAt, status, sha256: hash });
  }
  const snap = snapshotOf({ listText, endpointTexts });
  const out = {
    source: {
      description:
        "OpenRouter's public model list and the endpoints lists of the two main models' candidates, read with no key, the fields the runner reads kept and every price written per million tokens (benchmark/runner/openrouter.mjs). Read by a dry run; a run reads both lists live.",
      modelList: { url: MODEL_LIST_URL, readAt: readFileSync(arg('--read-at'), 'utf8').trim(), status: '200', models: String(JSON.parse(listText).data.length), sha256: sha256(listText) },
      endpoints: endpointSources,
      replaces: "R5's snapshot rows (pricing-snapshot.json, 2026-10-11, sha256 e4bd088dc5b89992036421c3da23d0fb8f88c63487887f8fa6c75c49a87de58a), which P0 copied here",
    },
    ...snap,
  };
  writeFileSync(new URL('./openrouter-models.json', import.meta.url), jsonDocument(out));
  console.log(`wrote benchmark/runner/openrouter-models.json: ${snap.data.length} models, endpoints for ${Object.keys(snap.endpoints).length}`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
