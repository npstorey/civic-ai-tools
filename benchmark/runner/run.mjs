#!/usr/bin/env node
// The benchmark's runner: R5's chooser-spike runner (`chooser-spike.mjs`),
// moved into the hub as a program it owns (S1 P0).
//
// For each model × question × repeat it sends the app's first in-loop request
// (the directory as the system prompt, `load_source` the only tool) and
// records which aliases the model loads. When it loads at least one source,
// it sends one second request as the app builds it today: the system prompt
// recomposed over the loaded sources, the loaded sources' tools beside
// `load_source`, and the app's load-result text. No tool is executed and no
// source is called: the second request ends at the model's tool call, which
// is scored against the loaded schemas. Every prompt and tool comes from the
// router (`session.mjs`); benchmark/README.md names how this differs from R5.
//
// Usage (from the repository root):
//   node benchmark/runner/run.mjs --inventory <file> --questions <file> --config <name>
//     [--models a,b@effort] [--repeats 3] [--cap <usd>] [--concurrency 6]
//     [--dry-run] [--probe] [--today YYYY-MM-DD] [--chars-per-token 2]
//     [--out-dir benchmark/runs] [--resume <run-id>]
//
//   --dry-run  prints every input's sha256, the configuration and the
//              estimated cost bounds, from the recorded model list
//              (openrouter-models.json). Makes no network call (fetch is
//              disabled before anything runs), needs no key, writes nothing.
//   --probe    the two first questions of the file's `probeIds` (or of the
//              file), one repeat, on the models given.
//   --cap      required for a run that calls a model. Each call reserves its
//              worst case first; a call that would carry spend plus what is
//              in flight past the cap is not sent, the run writes what it
//              has, records the stop in meta.json and exits 2.
//
// Before it spends, a run reads OpenRouter's live model list, checks the
// roster against it (roster.mjs) and checks the key with one free call. The
// key is read from MODEL_API_KEY, else OPENROUTER_API_KEY, and is never
// printed or written. Requests go by Node's own fetch (no SDK). Output:
// <out-dir>/<run-id>/{meta.json, rows.jsonl, baseline.jsonl, contact-ledger.md},
// every JSON file under the digit-run convention (writer.mjs). The summary is
// the scorer's: node benchmark/scoring/analyze.mjs <run dir> --out <file>.

import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';
import { REPO_ROOT, SOCRATA_GUIDANCE_FILE_SHA256, SOCRATA_GUIDANCE_PATH } from '../inventories/guidance.mjs';
import { scoreLoad } from '../scoring/score.mjs';
import { CATALOG_EXCERPT, CATALOG_SOURCE, modelRequestParameters, modelRequestSettings } from './catalog.mjs';
import { APP_SOURCE, MAX_TOKENS, UNKNOWN_TOOL_TEXT } from './app-texts.mjs';
import { CHARS_PER_TOKEN_DEFAULT, costOfUsage, estimateTokens, pricingPerMillion, TIER_MARGIN, worstCost } from './pricing.mjs';
import { checkRoster } from './roster.mjs';
import { createSession } from './session.mjs';
import { baselineBody, baselineLadder, firstBody, secondBody } from './requests.mjs';
import { planBounds } from './plan.mjs';
import { openLedger } from './ledger.mjs';
import { jsonDocument, jsonLine } from './writer.mjs';

const BASE_URL = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_MODELS = 'anthropic/claude-haiku-5.5';
const USAGE = 'usage: node benchmark/runner/run.mjs --inventory <file> --questions <file> --config <name> [--dry-run] [--probe] [--models a,b@effort] [--repeats n] [--cap usd] [--concurrency n] [--today YYYY-MM-DD] [--chars-per-token n] [--out-dir dir] [--resume run-id]';

// --- Arguments ---
let opts;
try {
  opts = parseArgs({
    options: {
      inventory: { type: 'string' },
      questions: { type: 'string' },
      config: { type: 'string' },
      models: { type: 'string', default: DEFAULT_MODELS },
      repeats: { type: 'string' },
      cap: { type: 'string' },
      concurrency: { type: 'string', default: '6' },
      'dry-run': { type: 'boolean', default: false },
      probe: { type: 'boolean', default: false },
      today: { type: 'string' },
      'chars-per-token': { type: 'string', default: String(CHARS_PER_TOKEN_DEFAULT) },
      'out-dir': { type: 'string', default: 'benchmark/runs' },
      resume: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  }).values;
} catch (e) {
  console.error(`${e.message}\n${USAGE}`);
  process.exit(2);
}
const DRY = opts['dry-run'];
const PROBE = opts.probe;

if (DRY) {
  // The dry run makes no network call: fetch is disabled outright, before any
  // input is read.
  globalThis.fetch = () => {
    throw new Error('network call attempted in --dry-run');
  };
}

const bad = (why) => {
  console.error(`bad arguments: ${why}\n${USAGE}`);
  process.exit(2);
};
const REPEATS = Number(opts.repeats ?? (PROBE ? '1' : '3'));
const CAP = opts.cap === undefined ? null : Number(opts.cap);
const CONCURRENCY = Number(opts.concurrency);
const CHARS_PER_TOKEN = Number(opts['chars-per-token']);
const TODAY = opts.today ?? new Date().toISOString().split('T')[0];
if (!opts.inventory || !opts.questions || !opts.config) bad('--inventory, --questions and --config are required');
if (!(REPEATS > 0) || !Number.isInteger(REPEATS)) bad('--repeats must be a positive integer');
if (!(CONCURRENCY > 0) || !Number.isInteger(CONCURRENCY)) bad('--concurrency must be a positive integer');
if (!(CHARS_PER_TOKEN > 0)) bad('--chars-per-token must be positive');
if (CAP !== null && !(CAP > 0)) bad('--cap must be a positive number of dollars');
if (!DRY && CAP === null) bad('--cap <usd> is required for a run that calls a model');
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) bad('--today must be YYYY-MM-DD');
const modelSpecs = opts.models.split(',').map((s) => s.trim()).filter(Boolean);
if (!modelSpecs.length) bad('--models names no model');

// --- Inputs, each with its sha256 ---
const repoPath = (p) => {
  const rel = relative(REPO_ROOT, resolve(p));
  return rel.startsWith('..') ? resolve(p) : rel;
};
const fileSha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = [];
const input = (role, path, extra = {}) => {
  const entry = { role, path: repoPath(path), sha256: fileSha256(path), ...extra };
  inputs.push(entry);
  return entry;
};
const here = (rel) => new URL(rel, import.meta.url).pathname;

const inventoryText = readFileSync(opts.inventory, 'utf8');
const inventory = JSON.parse(inventoryText);
const inventoryCanonical = sha256Hex(canonicalJson(inventory));
const recordedPath = `${opts.inventory}.sha256`;
const recorded = existsSync(recordedPath) ? readFileSync(recordedPath, 'utf8').trim() : null;
if (recorded !== inventoryCanonical) {
  console.error(`${repoPath(opts.inventory)}: its canonical hash ${inventoryCanonical} does not match ${repoPath(recordedPath)} (${recorded ?? 'missing'})`);
  process.exit(1);
}
input('inventory', opts.inventory, { canonicalSha256: inventoryCanonical, id: inventory.id, version: inventory.version, entries: inventory.entries.length });
const questionsFile = JSON.parse(readFileSync(opts.questions, 'utf8'));
input('questions', opts.questions, { questions: questionsFile.questions.length });
input('catalog excerpt', here('./catalog.mjs'), { pins: `${CATALOG_SOURCE.repository} ${CATALOG_SOURCE.path} sha256 ${CATALOG_SOURCE.sha256}` });
input('app texts', here('./app-texts.mjs'), { pins: `${APP_SOURCE.repository} ${APP_SOURCE.routingMode.path} sha256 ${APP_SOURCE.routingMode.sha256}` });
input('socrata guidance', join(REPO_ROOT, SOCRATA_GUIDANCE_PATH));
if (fileSha256(join(REPO_ROOT, SOCRATA_GUIDANCE_PATH)) !== SOCRATA_GUIDANCE_FILE_SHA256) throw new Error('the socrata guidance pin changed under the run');
const ROUTER_PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/civic-typed-router/package.json'), 'utf8'));

const questions = (() => {
  if (!PROBE) return questionsFile.questions;
  const ids = (questionsFile.probeIds ?? questionsFile.questions.map((q) => q.id)).slice(0, 2);
  return questionsFile.questions.filter((q) => ids.includes(q.id));
})();

// --- Models and their request settings ---
function resolveModel(spec) {
  const [slug, effort] = spec.split('@');
  const entry = CATALOG_EXCERPT.find((e) => e.id === slug || e.endpointModel === slug);
  const settings = effort ? { reasoningEffort: effort } : entry ? modelRequestSettings(entry) : undefined;
  return {
    spec,
    slug,
    control: Boolean(entry),
    catalogId: entry?.id ?? null,
    settings: settings ?? null,
    params: (limit) => modelRequestParameters(settings, limit),
  };
}
const models = modelSpecs.map(resolveModel);

// --- The run directory and ledger (a run only) ---
const runId = opts.resume ?? `${TODAY}-${PROBE ? 'probe' : 'run'}-${new Date().toISOString().slice(11, 19).replaceAll(':', '')}`;
const runDir = resolve(opts['out-dir'], runId);
let ledger = null;
if (!DRY) {
  mkdirSync(runDir, { recursive: true });
  ledger = openLedger(join(runDir, 'contact-ledger.md'), runId);
}

// --- Prices: OpenRouter's live list in a run; the recorded rows in a dry run ---
async function readModelList() {
  if (DRY) {
    const path = here('./openrouter-models.json');
    input('model list', path);
    return { source: `${repoPath(path)} (recorded; no network in a dry run)`, data: JSON.parse(readFileSync(path, 'utf8')).data };
  }
  const url = `${BASE_URL}/models`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (e) {
    ledger.record('GET', url, `error: ${e.name}`);
    throw e;
  }
  ledger.record('GET', url, res.status);
  if (!res.ok) throw new Error(`model list: HTTP ${res.status}`);
  const text = await res.text();
  return { source: `${url} read ${new Date().toISOString()}`, sha256: createHash('sha256').update(text).digest('hex'), data: JSON.parse(text).data };
}
const list = await readModelList();
const pricing = {};
for (const m of models) {
  const row = list.data.find((x) => x.id === m.slug);
  if (row) pricing[m.slug] = row.pricing.unit ? row.pricing : pricingPerMillion(row.pricing);
}
const rosterProblems = checkRoster(models, list, MAX_TOKENS);

// --- The configuration, built through the router ---
const session = await createSession({ inventory, configName: opts.config, today: TODAY });
const outside = [...new Set(questions.flatMap((q) => q.acceptable.flat()).filter((a) => !session.entryByAlias(a)))].sort();

function printPlanHeader() {
  console.log(`benchmark ${DRY ? 'DRY RUN' : PROBE ? 'probe' : 'run'}: config ${session.config.name} (${session.config.rule}); today ${TODAY}`);
  console.log('inputs (sha256 of the file):');
  for (const i of inputs) {
    const extra = Object.entries(i)
      .filter(([k]) => !['role', 'path', 'sha256'].includes(k))
      .map(([k, v]) => `${k} ${v}`)
      .join('; ');
    console.log(`  ${i.role.padEnd(17)} ${i.sha256}  ${i.path}${extra ? `\n  ${''.padEnd(17)} ${extra}` : ''}`);
  }
  console.log(`  router            ${ROUTER_PACKAGE.name}@${ROUTER_PACKAGE.version} (workspace)`);
  console.log(`directory: ${session.directoryAliases.length} of ${inventory.entries.length} entries listed: ${session.directoryAliases.join(', ')}`);
  if (session.config.unconfigured.length) console.log(`  unconfigured: ${session.config.unconfigured.join(', ')}`);
  if (outside.length) console.log(`  note: the questions' labels name aliases this directory does not list: ${outside.join(', ')}`);
  console.log(`rows: ${models.length} model(s) × ${questions.length} question(s) × ${REPEATS} repeat(s) = ${models.length * questions.length * REPEATS}; concurrency ${CONCURRENCY}; cap ${CAP === null ? 'none given' : `$${CAP.toFixed(2)}`}`);
  console.log(`prices: ${list.source}`);
  if (rosterProblems.length) {
    console.log('roster problems:');
    for (const p of rosterProblems) console.log(`  - ${p}`);
  } else console.log('roster: every model on the list, tools and every request field supported');
}

async function printPlan() {
  const priced = models.filter((m) => pricing[m.slug]);
  const plan = await planBounds({ session, models: priced, questions, repeats: REPEATS, pricing, charsPerToken: CHARS_PER_TOKEN });
  const fmt = (n) => `$${n.toFixed(2)}`;
  console.log('estimated cost bounds (USD):');
  for (const p of plan.perModel) {
    const m = models.find((x) => x.spec === p.spec);
    console.log(`  - ${p.spec.padEnd(34)} ${JSON.stringify(m.params(MAX_TOKENS)).padEnd(58)} calls ≤ ${String(p.calls).padStart(5)}  floor ${fmt(p.floor).padStart(8)}  ceiling ${fmt(p.ceiling).padStart(8)}  hard ${fmt(p.hard).padStart(8)}`);
  }
  console.log(`  total: calls ≤ ${plan.total.calls}; floor ${fmt(plan.total.floor)}; ceiling ${fmt(plan.total.ceiling)}; hard ceiling ${fmt(plan.total.hard)}`);
  console.log(`  estimate: ${CHARS_PER_TOKEN} characters a token${CHARS_PER_TOKEN === CHARS_PER_TOKEN_DEFAULT ? ' (uncalibrated)' : ''}; a request within ${TIER_MARGIN * 100}% of a price tier's threshold is priced at that tier.`);
  console.log(`  floor: prompts at 5 characters a token, no completions; ceiling: completions at their limit (${MAX_TOKENS}; a baseline's ladder 1, 16, 1),`);
  console.log('  second requests carrying the larger of the largest label and the largest source, plus the first response at its limit;');
  console.log('  hard: second requests carrying every listed source. A run prices actual usage.');
  return plan;
}

printPlanHeader();
const plan = await printPlan();
if (DRY) {
  console.log('DRY RUN: no network call was made; nothing was written.');
  process.exit(rosterProblems.length ? 1 : 0);
}
if (rosterProblems.length) {
  console.error('the roster check failed; nothing was spent.');
  process.exit(1);
}

// =====================================================================
// The run. Nothing below executes in a dry run.
// =====================================================================

const apiKey = (process.env.MODEL_API_KEY || '').trim() || (process.env.OPENROUTER_API_KEY || '').trim();
if (!apiKey || apiKey.includes('op://')) {
  console.error('No usable key: set MODEL_API_KEY or OPENROUTER_API_KEY (resolved, not an op:// reference).');
  process.exit(1);
}
// A credential that is present is not a credential that works: one free call.
{
  const url = `${BASE_URL}/key`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  ledger.record('GET', url, res.status);
  if (!res.ok) {
    console.error(`key check failed: HTTP ${res.status}. Nothing was spent.`);
    process.exit(1);
  }
  const k = (await res.json()).data ?? {};
  const remaining = k.limit_remaining ?? k.limit ?? null;
  console.log(`key check: accepted; credit limit remaining: ${remaining === null ? 'no limit set' : `$${Number(remaining).toFixed(2)}`}`);
  if (remaining !== null && Number(remaining) < CAP) console.log('  note: the remaining credit is below the cap; the run stops at whichever comes first.');
}

const { default: Ajv } = await import('ajv');
const ajv = new Ajv({ allErrors: true, unknownFormats: 'ignore', schemaId: 'auto' });
const validators = new Map();
function validatorFor(tool) {
  const name = tool.function.name;
  if (!validators.has(name)) {
    const schema = JSON.parse(JSON.stringify(tool.function.parameters ?? { type: 'object' }));
    delete schema.$schema;
    try {
      validators.set(name, ajv.compile(schema));
    } catch (e) {
      validators.set(name, { compileError: String(e.message).slice(0, 200) });
    }
  }
  return validators.get(name);
}

const rowsPath = join(runDir, 'rows.jsonl');
const basePath = join(runDir, 'baseline.jsonl');
const metaPath = join(runDir, 'meta.json');
const readLines = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const readDone = (path) => new Set(readLines(path).filter((r) => r.status === 'complete').map((r) => r.key));
const doneRows = readDone(rowsPath);
const doneBase = readDone(basePath);
// The cap covers the whole run directory, across resumed sessions.
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const priorSpend = [rowsPath, basePath]
  .flatMap(readLines)
  .reduce((s, r) => s + num(r.first?.cost?.charged) + num(r.second?.cost?.charged) + num(r.cost?.charged), 0);

const rowKeys = [];
for (let r = 1; r <= REPEATS; r++) for (const q of questions) for (const m of models) rowKeys.push({ m, q, r });

const meta = {
  runId,
  mode: PROBE ? 'probe' : 'run',
  config: { name: session.config.name, rule: session.config.rule, unconfigured: session.config.unconfigured, directory: session.directoryAliases },
  startedAt: new Date().toISOString(),
  today: TODAY,
  argv: process.argv.slice(2),
  models: models.map((m) => ({ spec: m.spec, slug: m.slug, control: m.control, catalogId: m.catalogId, settings: m.settings, requestParameters: m.params(MAX_TOKENS) })),
  repeats: REPEATS,
  questionIds: questions.map((q) => q.id),
  expectedRows: rowKeys.length,
  cap: CAP,
  concurrency: CONCURRENCY,
  inputs,
  router: `${ROUTER_PACKAGE.name}@${ROUTER_PACKAGE.version}`,
  estimate: { charsPerToken: CHARS_PER_TOKEN, tierMargin: TIER_MARGIN, plan: { calls: plan.total.calls, floorUsd: plan.total.floor, ceilingUsd: plan.total.ceiling, hardUsd: plan.total.hard } },
  pricingSource: list.source,
  modelListSha256: list.sha256 ?? null,
  pricing,
  request: { tool_choice: 'auto', temperature: 'not sent (the app sends none)', maxTokens: MAX_TOKENS, baseURL: BASE_URL, client: 'node fetch' },
  node: process.version,
  resumedRows: doneRows.size,
  priorSpendUsd: priorSpend,
};
const writeMeta = (extra = {}) => writeFileSync(metaPath, jsonDocument({ ...meta, ...extra }));
writeMeta();

// --- Spend accounting and the cap ---
let spent = priorSpend;
let reserved = 0;
let stopReason = null;
function reserve(m, body, limit) {
  const est = worstCost(pricing[m.slug], estimateTokens(body, CHARS_PER_TOKEN), limit, TIER_MARGIN);
  if (spent + reserved + est > CAP) {
    stopReason ??= `cap: $${spent.toFixed(4)} spent + $${reserved.toFixed(4)} in flight + $${est.toFixed(4)} next > $${CAP}`;
    return null;
  }
  reserved += est;
  return est;
}

const truncate = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n)}…[${s.length} chars]` : s);
const RETRYABLE = (s) => s === null || s === 408 || s === 429 || s >= 500;

async function chat(body) {
  const url = `${BASE_URL}/chat/completions`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    ledger.record('POST', url, `error: ${e.name}`);
    throw Object.assign(new Error(`${e.name}: ${e.message}`), { status: null });
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const failed = !res.ok || !json || json.error;
  const status = !res.ok ? res.status : json?.error ? (Number(json.error.code) || 502) : res.status;
  ledger.record('POST', url, failed ? `${status} (refused)` : status);
  if (failed) throw Object.assign(new Error(`HTTP ${status}: ${truncate(json?.error ? JSON.stringify(json.error) : text, 600)}`), { status });
  return json;
}

async function call(m, body, limit) {
  const est = reserve(m, body, limit);
  if (est === null) return { status: 'skipped_cap' };
  const attempts = [];
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const t0 = Date.now();
      try {
        const res = await chat(body);
        const latencyMs = Date.now() - t0;
        const usage = res.usage ?? null;
        const cost = costOfUsage(pricing[m.slug], usage);
        // A call that returns no usage keeps its worst case as spend (R8).
        const charged = usage ? Math.max(cost.computed, cost.reported ?? 0) : est;
        spent += charged;
        return { status: 'ok', res, latencyMs, attempts: attempts.length + 1, usage, cost: { ...cost, charged, reservedUsd: est } };
      } catch (e) {
        const err = { status: e.status ?? null, message: truncate(String(e.message), 600) };
        attempts.push({ ...err, latencyMs: Date.now() - t0 });
        if (!RETRYABLE(err.status) || attempt === 3) return { status: 'error', error: err, attempts };
        await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 8000));
      }
    }
  } finally {
    reserved -= est;
  }
}

function summarizeMessage(msg) {
  return {
    content: truncate(msg?.content ?? null, 800),
    toolCalls: (msg?.tool_calls ?? []).map((tc) => ({ id: tc.id, name: tc.function?.name, args: truncate(tc.function?.arguments ?? '', 1500) })),
  };
}
const parseAlias = (raw) => {
  try {
    return JSON.parse(raw || '{}').alias;
  } catch {
    return undefined;
  }
};

async function runRow({ m, q, r }) {
  const key = `${m.spec}|${q.id}|${r}`;
  const row = { key, config: session.config.name, model: m.slug, spec: m.spec, control: m.control, qid: q.id, kind: q.kind, repeat: r, acceptable: q.acceptable };

  // First request: load_source is the only tool.
  const body1 = firstBody(session, m, q);
  const c1 = await call(m, body1, MAX_TOKENS);
  if (c1.status !== 'ok') {
    row.status = c1.status === 'skipped_cap' ? 'incomplete_cap' : 'error';
    row.first = c1.status === 'error' ? { error: c1.error, attempts: c1.attempts } : { skipped: 'cap' };
    return row;
  }
  const msg1 = c1.res.choices?.[0]?.message ?? {};
  const calls1 = msg1.tool_calls ?? [];
  const loaded = [];
  const invalidAliases = [];
  const otherCalls = [];
  const toolMessages = [];
  for (const tc of calls1) {
    const name = tc.function?.name;
    let content;
    if (name === 'load_source') {
      const alias = parseAlias(tc.function.arguments);
      if (alias && session.entryByAlias(alias)) {
        content = loaded.includes(alias) ? session.loadResultText.alreadyLoaded(alias) : session.loadResultText.loaded(alias);
        if (!loaded.includes(alias)) loaded.push(alias);
      } else {
        invalidAliases.push(tc.function?.arguments ?? '');
        content = session.loadResultText.notOffered;
      }
    } else {
      otherCalls.push(name);
      content = UNKNOWN_TOOL_TEXT(name);
    }
    toolMessages.push({ role: 'tool', tool_call_id: tc.id, content });
  }
  row.first = {
    latencyMs: c1.latencyMs,
    attempts: c1.attempts,
    promptChars: JSON.stringify(body1).length,
    usage: c1.usage,
    cost: c1.cost,
    finishReason: c1.res.choices?.[0]?.finish_reason ?? null,
    respondedModel: c1.res.model ?? null,
    ...summarizeMessage(msg1),
    firstCallName: calls1[0]?.function?.name ?? null,
    loadCalls: calls1.filter((tc) => tc.function?.name === 'load_source').length,
    invalidAliases,
    otherCalls,
  };
  row.firstCallIsLoad = calls1[0]?.function?.name === 'load_source';
  row.loaded1 = [...loaded];
  row.score1 = scoreLoad(loaded, q.acceptable);

  if (!loaded.length) {
    row.second = null;
    row.loaded2 = [...loaded];
    row.score2 = row.score1;
    row.status = 'complete';
    row.costUsd = c1.cost.charged;
    return row;
  }

  // Second request, as the app builds it after these loads.
  const state = await session.afterLoads(loaded.map((a) => session.entryByAlias(a).sourceId));
  const body2 = secondBody(m, body1, msg1, toolMessages, state);
  const c2 = await call(m, body2, MAX_TOKENS);
  if (c2.status !== 'ok') {
    row.status = c2.status === 'skipped_cap' ? 'incomplete_cap' : 'complete';
    row.second = c2.status === 'error' ? { outcome: 'error', error: c2.error, attempts: c2.attempts, promptChars: JSON.stringify(body2).length } : { skipped: 'cap' };
    row.loaded2 = [...loaded];
    row.score2 = row.score1;
    row.costUsd = c1.cost.charged;
    return row;
  }
  const msg2 = c2.res.choices?.[0]?.message ?? {};
  const s2 = summarizeMessage(msg2);
  const offeredByName = new Map(state.tools.map((t) => [t.function.name, t]));
  const nearMiss = (name) => {
    for (const a of loaded) if (offeredByName.has(`${a}__${name}`)) return `bare upstream name of ${a}__${name}`;
    const target = session.router.sourceForAliasedName(name);
    if (target) return `a tool of ${session.aliasOf(target.sourceId)}, which was not loaded`;
    return null;
  };
  const loaded2 = [...loaded];
  const evaluated = (msg2.tool_calls ?? []).map((tc) => {
    const name = tc.function?.name;
    const raw = tc.function?.arguments ?? '';
    if (name === 'load_source') {
      const alias = parseAlias(raw);
      if (alias && session.entryByAlias(alias) && !loaded2.includes(alias)) loaded2.push(alias);
      return { name, kind: 'load_source', alias: alias ?? null };
    }
    const tool = offeredByName.get(name);
    if (!tool) return { name, kind: 'unknown', validName: false, nearMiss: nearMiss(name), args: truncate(raw, 400) };
    let args;
    try {
      args = raw ? JSON.parse(raw) : {};
    } catch {
      return { name, kind: 'loaded', validName: true, argsParse: false, schemaValid: false, args: truncate(raw, 400) };
    }
    const v = validatorFor(tool);
    if (v.compileError) return { name, kind: 'loaded', validName: true, argsParse: true, schemaValid: null, schemaNote: v.compileError };
    const ok = v(args);
    return {
      name,
      kind: 'loaded',
      validName: true,
      argsParse: true,
      schemaValid: Boolean(ok),
      ...(ok ? {} : { schemaErrors: (v.errors ?? []).slice(0, 5).map((e) => `${e.dataPath || '/'} ${e.message}`), args: truncate(raw, 400) }),
    };
  });
  const loadedCalls = evaluated.filter((e) => e.kind === 'loaded');
  const unknownCalls = evaluated.filter((e) => e.kind === 'unknown');
  let outcome;
  if (loadedCalls.length && !unknownCalls.length && loadedCalls.every((e) => e.schemaValid)) outcome = 'valid_tool_call';
  else if (loadedCalls.length || unknownCalls.length) outcome = 'invalid_tool_call';
  else if (evaluated.length) outcome = 'loaded_more_only';
  else outcome = 'no_tool_call';
  row.second = {
    latencyMs: c2.latencyMs,
    attempts: c2.attempts,
    promptChars: JSON.stringify(body2).length,
    usage: c2.usage,
    cost: c2.cost,
    finishReason: c2.res.choices?.[0]?.finish_reason ?? null,
    respondedModel: c2.res.model ?? null,
    content: s2.content,
    toolCalls: s2.toolCalls,
    evaluated,
    outcome,
    offeredToolCount: state.tools.length,
  };
  row.loaded2 = loaded2;
  row.score2 = scoreLoad(loaded2, q.acceptable);
  row.status = 'complete';
  row.costUsd = c1.cost.charged + c2.cost.charged;
  return row;
}

// Token baselines (R5): the ladder of `baselineLadder`; a step that returns no
// usage is re-sent at the next step (R8). Recorded either way.
async function runBaseline(m, name, b) {
  const key = `${m.spec}|${name}`;
  const tried = [];
  let lastOk = null;
  for (const step of baselineLadder(m)) {
    const body = baselineBody(m, b, step.params);
    const c = await call(m, body, step.limit);
    if (c.status === 'skipped_cap') return { key, model: m.slug, spec: m.spec, baseline: name, status: 'incomplete_cap', tried };
    if (c.status === 'ok' && c.usage) {
      return { key, model: m.slug, spec: m.spec, baseline: name, status: 'complete', sent: step.note, toolCount: b.tools.length, systemChars: b.system.length, usage: c.usage, cost: c.cost, latencyMs: c.latencyMs, tried };
    }
    if (c.status === 'ok') {
      lastOk = { step, c };
      tried.push({ sent: step.note, note: 'no usage returned', cost: c.cost });
    } else tried.push({ sent: step.note, error: c.error });
  }
  if (lastOk) {
    return { key, model: m.slug, spec: m.spec, baseline: name, status: 'complete', sent: lastOk.step.note, toolCount: b.tools.length, systemChars: b.system.length, usage: null, cost: lastOk.c.cost, latencyMs: lastOk.c.latencyMs, tried };
  }
  return { key, model: m.slug, spec: m.spec, baseline: name, status: 'error', tried };
}

// --- Work queue ---
const baselines = await session.baselines();
const tasks = [];
for (const m of models) for (const [name, b] of Object.entries(baselines)) if (!doneBase.has(`${m.spec}|${name}`)) tasks.push({ type: 'baseline', m, name, b });
for (const k of rowKeys) if (!doneRows.has(`${k.m.spec}|${k.q.id}|${k.r}`)) tasks.push({ type: 'row', ...k });

let next = 0;
let finished = 0;
const t0 = Date.now();
async function worker() {
  while (next < tasks.length && !stopReason) {
    const t = tasks[next++];
    const out = t.type === 'row' ? await runRow(t) : await runBaseline(t.m, t.name, t.b);
    appendFileSync(t.type === 'row' ? rowsPath : basePath, jsonLine(out));
    finished++;
    if (finished % 25 === 0 || finished === tasks.length) console.log(`  ${finished}/${tasks.length} done, $${spent.toFixed(3)} spent, ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
console.log(`run ${runId}: ${tasks.length} tasks (${doneRows.size} rows already complete)`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const completeRows = readDone(rowsPath).size;
writeMeta({ endedAt: new Date().toISOString(), spentUsd: spent, stopReason, completeRows, completeBaselines: readDone(basePath).size });
console.log(`done: ${completeRows}/${rowKeys.length} rows complete; $${spent.toFixed(4)} spent in this run directory (of which $${priorSpend.toFixed(4)} before this session)${stopReason ? `; stopped — ${stopReason}` : ''}`);
console.log(`output: ${repoPath(runDir)}`);
process.exit(stopReason ? 2 : 0);
