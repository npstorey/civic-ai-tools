#!/usr/bin/env node
// The benchmark's runner: R5's chooser-spike runner (`chooser-spike.mjs`),
// moved into the hub as a program it owns (S1 P0), with every configuration
// S1 preregisters (P3-build; session.mjs names them).
//
// For each row (a model × question × repeat of a configuration) it sends the
// app's in-loop requests: the directory as the system prompt, `load_source`
// (and in a search row `find_source`) the tools; after a load, the system
// prompt recomposed over the loaded sources and their tools, as the app
// builds it today. No source is called: the request after a load ends at the
// model's tool call, which is scored against the loaded schemas. Every prompt
// and tool comes from the router (`session.mjs`) or, for the benchmark's own
// tools, `texts.mjs`; benchmark/README.md names how this differs from R5.
//
// Usage (from the repository root):
//
//   One configuration (P0's form):
//     node benchmark/runner/run.mjs --inventory <file> --questions <file> --config <name>
//       [--models a,b] [--repeats 3] [--probe] [--cap <usd>] ...
//
//   The preregistered plan (benchmark/runner/plans/s1.json):
//     node benchmark/runner/run.mjs --plan <file> --open-weight-probe --cap <usd>
//     node benchmark/runner/run.mjs --plan <file> --probe --open-weight <slug> --cap <usd>
//     node benchmark/runner/run.mjs --plan <file> --open-weight <slug> --calibration <file> --cap <usd> [--option A|B]
//
//   Common: [--dry-run] [--concurrency 6] [--today YYYY-MM-DD]
//     [--chars-per-token 2 | --calibration <file>] [--out-dir benchmark/_local/runs] [--resume <run-id>]
//
//   --dry-run  prints every input's sha256, the inputs' hash (A3.1), each
//              configuration's hashes (G0-9) and every step's estimated cost
//              bounds, from the committed model-list snapshot
//              (openrouter-models.json). Makes no network call (fetch is
//              disabled before anything runs), needs no key, writes nothing.
//              Under a plan with no --open-weight, the open-weight model's
//              bound is the highest of the three candidates'.
//   --probe    one configuration: the two first questions of the file's
//              `probeIds`, one repeat. Under a plan: the plan's probe steps on
//              both main models. Either writes calibration.json in the run
//              directory (calibration.mjs).
//   The calibration file the evaluations read is calibration.mjs's, from the
//   two probes' runs and R5's rows; under it, a dry run of the plan with
//   --open-weight prints "the calibrated bound" for options A and B, the
//   option it implies and its --cap (or that the run does not start).
//   --open-weight-probe  under a plan: the three candidates on R5's 49 seed
//              questions over the 7-entry inventory, baseline-7, one repeat;
//              prints the comparison and the winner.
//   --cap      required for a run that calls a model. Every row reserves its
//              worst case first (engine.mjs, bounds.mjs); a row the cap cannot
//              hold is not started, the run writes what it has, records the
//              stop and the rows not started in meta.json, and exits 2.
//
// Before it spends, a run reads OpenRouter's live model list and each model's
// endpoints list, checks the roster against them (roster.mjs) and checks the
// key with one free call. The key is read from MODEL_API_KEY, else
// OPENROUTER_API_KEY, and is never printed or written. Requests go by Node's
// own fetch (no SDK). Output: <out-dir>/<run-id>/{meta.json, rows.jsonl,
// baseline.jsonl, contact-ledger.md}, and calibration.json after a probe,
// every JSON file under the digit-run convention (writer.mjs). The summary is
// the scorer's: node benchmark/scoring/analyze.mjs <run dir> --out <file>.

import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';
import { REPO_ROOT, SOCRATA_GUIDANCE_FILE_SHA256, SOCRATA_GUIDANCE_PATH } from '../inventories/guidance.mjs';
import { CORRECT } from '../scoring/score.mjs';
import { rowScores } from '../scoring/offered.mjs';
import { CATALOG_SOURCE } from './catalog.mjs';
import { APP_SOURCE, MAX_TOKENS } from './app-texts.mjs';
import { CHARS_PER_TOKEN_DEFAULT, pricingPerMillion, TIER_MARGIN } from './pricing.mjs';
import { checkRoster } from './roster.mjs';
import { createSession } from './session.mjs';
import { stepBounds } from './plan.mjs';
import { openLedger } from './ledger.mjs';
import { jsonDocument, jsonLine } from './writer.mjs';
import { createEngine } from './engine.mjs';
import { createIndex } from './search.mjs';
import { createShortlister } from './shortlist.mjs';
import { HAIKU_SLUG, OPEN_WEIGHT_CANDIDATES, reservationPricings, resolveModel, routingCeilings } from './models.mjs';
import { BASE_URL, endpointRow, endpointsUrl, MODEL_LIST_URL, modelRow } from './openrouter.mjs';
import { calibrate, CAP_LIMIT_USD, capDecision } from './calibration.mjs';
import { INPUT_HASH_RECIPE, inputHash } from './input-hash.mjs';

const REQUEST_TIMEOUT_MS = 180_000;
const USAGE =
  'usage: node benchmark/runner/run.mjs (--inventory <file> --questions <file> --config <name> | --plan <file> [--open-weight <slug>] [--option A|B] [--open-weight-probe]) [--dry-run] [--probe] [--models a,b] [--repeats n] [--cap usd] [--concurrency n] [--today YYYY-MM-DD] [--chars-per-token n | --calibration file] [--out-dir dir] [--resume run-id]';

// --- Arguments ---
let opts;
try {
  opts = parseArgs({
    options: {
      inventory: { type: 'string' },
      questions: { type: 'string' },
      config: { type: 'string' },
      plan: { type: 'string' },
      'open-weight': { type: 'string' },
      'open-weight-probe': { type: 'boolean', default: false },
      option: { type: 'string', default: 'A' },
      models: { type: 'string' },
      repeats: { type: 'string' },
      cap: { type: 'string' },
      concurrency: { type: 'string', default: '6' },
      'dry-run': { type: 'boolean', default: false },
      probe: { type: 'boolean', default: false },
      today: { type: 'string' },
      'chars-per-token': { type: 'string' },
      calibration: { type: 'string' },
      'out-dir': { type: 'string', default: 'benchmark/_local/runs' },
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
const OW_PROBE = opts['open-weight-probe'];
const PLAN = opts.plan ?? null;

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
const CAP = opts.cap === undefined ? null : Number(opts.cap);
const CONCURRENCY = Number(opts.concurrency);
const CHARS_PER_TOKEN = Number(opts['chars-per-token'] ?? CHARS_PER_TOKEN_DEFAULT);
const TODAY = opts.today ?? new Date().toISOString().split('T')[0];
if (PLAN && (opts.inventory || opts.questions || opts.config)) bad('--plan takes no --inventory, --questions or --config');
if (!PLAN && (!opts.inventory || !opts.questions || !opts.config)) bad('--inventory, --questions and --config are required (or --plan)');
if (!PLAN && (OW_PROBE || opts['open-weight'])) bad('--open-weight-probe and --open-weight need --plan');
if (PROBE && OW_PROBE) bad('--probe and --open-weight-probe are two runs');
if (opts.repeats !== undefined && !(Number(opts.repeats) > 0 && Number.isInteger(Number(opts.repeats)))) bad('--repeats must be a positive integer');
if (PLAN && opts.repeats !== undefined) bad('a plan states its repeats; use --option');
if (!(CONCURRENCY > 0) || !Number.isInteger(CONCURRENCY)) bad('--concurrency must be a positive integer');
if (!(CHARS_PER_TOKEN > 0)) bad('--chars-per-token must be positive');
if (opts.calibration && opts['chars-per-token']) bad('--calibration and --chars-per-token are two estimates; give one');
if (CAP !== null && !(CAP > 0)) bad('--cap must be a positive number of dollars');
if (!DRY && CAP === null) bad('--cap <usd> is required for a run that calls a model');
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) bad('--today must be YYYY-MM-DD');
if (!['A', 'B'].includes(opts.option)) bad('--option is A or B');
if (PLAN && !DRY && !OW_PROBE && !opts['open-weight']) bad('--open-weight <slug> is required: the model the open-weight probe chose at G3');
if (PLAN && !DRY && !PROBE && !OW_PROBE && !opts.calibration) bad('--calibration <file> is required for the evaluations: the two-question probe calibrates the estimate first');

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
const atRoot = (p) => (resolve(p) === p ? p : join(REPO_ROOT, p));

const plan = PLAN ? JSON.parse(readFileSync(PLAN, 'utf8')) : null;
if (PLAN) input('plan', PLAN, { id: plan.id, option: opts.option });

const inventories = new Map();
function loadInventory(path) {
  const key = repoPath(path);
  if (inventories.has(key)) return inventories.get(key);
  const inventory = JSON.parse(readFileSync(path, 'utf8'));
  const canonical = sha256Hex(canonicalJson(inventory));
  const recordedPath = `${path}.sha256`;
  const recorded = existsSync(recordedPath) ? readFileSync(recordedPath, 'utf8').trim() : null;
  if (recorded !== canonical) {
    console.error(`${key}: its canonical hash ${canonical} does not match ${repoPath(recordedPath)} (${recorded ?? 'missing'})`);
    process.exit(1);
  }
  input('inventory', path, { canonicalSha256: canonical, id: inventory.id, version: inventory.version, entries: inventory.entries.length });
  inventories.set(key, { inventory, canonical });
  return inventories.get(key);
}
const questionFiles = new Map();
function loadQuestions(path) {
  const key = repoPath(path);
  if (!questionFiles.has(key)) {
    const file = JSON.parse(readFileSync(path, 'utf8'));
    input('questions', path, { questions: file.questions.length });
    questionFiles.set(key, file);
  }
  return questionFiles.get(key);
}
const qnum = (id) => Number(id.replace(/^\D+/, ''));
/** A step's questions, by its `questionIds` (plans/s1.json). */
function pickQuestions(file, ids) {
  const all = file.questions;
  if (!ids) return all;
  if (ids.list) return all.filter((q) => ids.list.includes(q.id));
  if (ids.from) return all.filter((q) => qnum(q.id) >= qnum(ids.from) && qnum(q.id) <= qnum(ids.to));
  if (ids.probeIds) {
    const want = (file.probeIds ?? all.map((q) => q.id)).slice(0, ids.probeIds);
    return all.filter((q) => want.includes(q.id));
  }
  if (ids.draw) {
    const rank = (id) => createHash('sha256').update(`${ids.seed}\0${id}`).digest('hex');
    const drawn = new Set([...all].sort((a, b) => (rank(a.id) < rank(b.id) ? -1 : 1)).slice(0, ids.draw).map((q) => q.id));
    return all.filter((q) => drawn.has(q.id));
  }
  throw new Error(`questionIds: no rule for ${JSON.stringify(ids)}`);
}

// --- The steps ---
const ROLE_MODELS = (role) => {
  if (role === 'main' || role === 'builder') return [HAIKU_SLUG];
  if (role === 'openWeight') return opts['open-weight'] ? [opts['open-weight']] : DRY ? [...OPEN_WEIGHT_CANDIDATES] : [];
  return [role];
};
let steps;
if (!PLAN) {
  const file = loadQuestions(opts.questions);
  loadInventory(opts.inventory);
  const specs = (opts.models ?? HAIKU_SLUG).split(',').map((s) => s.trim()).filter(Boolean);
  if (!specs.length) bad('--models names no model');
  steps = [{ id: opts.config, config: opts.config, inventory: opts.inventory, questions: pickQuestions(file, PROBE ? { probeIds: 2 } : null), models: specs, repeats: Number(opts.repeats ?? (PROBE ? '1' : '3')), role: 'main', baselines: true }];
} else if (OW_PROBE) {
  const p = plan.openWeightProbe;
  const specs = opts.models ? opts.models.split(',').map((s) => s.trim()) : p.models;
  steps = [{ id: 'open-weight-probe', config: p.config, inventory: atRoot(p.inventory), questions: pickQuestions(loadQuestions(atRoot(p.questions)), p.questionIds), models: specs, repeats: p.repeats, role: 'main' }];
} else if (PROBE) {
  steps = plan.probe.steps.map((s) => ({ id: s.id, config: s.config, inventory: atRoot(s.inventory), questions: pickQuestions(loadQuestions(atRoot(s.questions)), plan.probe.questionIds), models: plan.probe.models.flatMap(ROLE_MODELS), repeats: plan.probe.repeats, role: 'main' }));
} else {
  const b = plan.options[opts.option];
  steps = plan.steps.map((s) => ({
    id: s.id,
    config: s.config,
    inventory: atRoot(s.inventory),
    questions: pickQuestions(loadQuestions(atRoot(s.questions)), s.questionIds),
    models: s.models.flatMap(ROLE_MODELS),
    repeats: b.repeats && s.repeats === 3 ? b.repeats : s.repeats,
    role: s.role ?? 'main',
    selectionFrom: s.selectionFrom ?? null,
  }));
}
for (const s of steps) loadInventory(s.inventory);

input('catalog excerpt', here('./catalog.mjs'), { pins: `${CATALOG_SOURCE.repository} ${CATALOG_SOURCE.path} sha256 ${CATALOG_SOURCE.sha256}` });
input('app texts', here('./app-texts.mjs'), { pins: `${APP_SOURCE.repository} ${APP_SOURCE.routingMode.path} sha256 ${APP_SOURCE.routingMode.sha256}` });
input('benchmark texts', here('./texts.mjs'));
input('socrata guidance', join(REPO_ROOT, SOCRATA_GUIDANCE_PATH));
if (fileSha256(join(REPO_ROOT, SOCRATA_GUIDANCE_PATH)) !== SOCRATA_GUIDANCE_FILE_SHA256) throw new Error('the socrata guidance pin changed under the run');
const ROUTER_PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/civic-typed-router/package.json'), 'utf8'));
let calibration = null;
if (opts.calibration) {
  calibration = JSON.parse(readFileSync(opts.calibration, 'utf8'));
  input('calibration', opts.calibration, { models: Object.entries(calibration.models ?? {}).map(([s, m]) => `${s} ${m.charsPerToken}`).join(', ') });
}
const INPUT_HASH = inputHash(REPO_ROOT);

// --- Models ---
const specs = [...new Set(steps.flatMap((s) => s.models))];
const resolved = new Map(specs.map((s) => [s, resolveModel(s)]));

// --- The run directory and ledger (a run only) ---
const runId = opts.resume ?? `${TODAY}-${OW_PROBE ? 'ow-probe' : PROBE ? 'probe' : 'run'}-${new Date().toISOString().slice(11, 19).replaceAll(':', '')}`;
const runDir = resolve(opts['out-dir'], runId);
let ledger = null;
if (!DRY) {
  mkdirSync(runDir, { recursive: true });
  ledger = openLedger(join(runDir, 'contact-ledger.md'), runId);
}

// --- Prices: OpenRouter's live lists in a run; the snapshot in a dry run ---
async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (e) {
    ledger.record('GET', url, `error: ${e.name}`);
    throw e;
  }
  ledger.record('GET', url, res.status);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  return { text, sha256: createHash('sha256').update(text).digest('hex'), json: JSON.parse(text) };
}
async function readLists() {
  if (DRY) {
    const path = here('./openrouter-models.json');
    input('model list', path);
    const snap = JSON.parse(readFileSync(path, 'utf8'));
    return { source: `${repoPath(path)} (snapshot read ${snap.source?.modelList?.readAt ?? 'earlier'}; no network in a dry run)`, data: snap.data, endpoints: snap.endpoints ?? {} };
  }
  const list = await getJson(MODEL_LIST_URL);
  const endpoints = {};
  const endpointSources = [];
  for (const slug of new Set([...resolved.values()].map((m) => m.slug))) {
    try {
      const e = await getJson(endpointsUrl(slug));
      endpoints[slug] = e.json.data.endpoints.map(endpointRow);
      endpointSources.push({ model: slug, sha256: e.sha256 });
    } catch (e) {
      endpointSources.push({ model: slug, error: String(e.message) });
    }
  }
  return { source: `${MODEL_LIST_URL} read ${new Date().toISOString()}`, sha256: list.sha256, data: list.json.data.map((r) => (resolved.has(r.id) || [...resolved.values()].some((m) => m.slug === r.id) ? modelRow(r) : { id: r.id })), endpoints, endpointSources };
}
const lists = await readLists();
const modelInfo = new Map();
for (const [spec, m] of resolved) {
  const row = lists.data.find((x) => x.id === m.slug);
  if (!row?.pricing) continue;
  const listPricing = row.pricing.unit ? row.pricing : pricingPerMillion(row.pricing);
  const cpt = calibration ? calibration.models?.[m.slug]?.charsPerToken : CHARS_PER_TOKEN;
  if (calibration && !(cpt > 0)) bad(`--calibration has no figure for ${m.slug}`);
  modelInfo.set(spec, { m, listPricing, reservationPricings: reservationPricings(m, { pricing: listPricing }, lists.endpoints[m.slug]), cpt, contextLength: row.context_length ?? null });
}
const rosterProblems = checkRoster([...resolved.values()], lists, MAX_TOKENS, lists.endpoints);

// --- Sessions: one per inventory and configuration, built through the router ---
const sessions = new Map();
async function sessionFor(step) {
  const key = `${repoPath(step.inventory)}|${step.config}`;
  if (!sessions.has(key)) {
    const { inventory, canonical } = loadInventory(step.inventory);
    const session = await createSession({ inventory, configName: step.config, today: TODAY, routerPackage: ROUTER_PACKAGE, inventoryHash: canonical });
    sessions.set(key, { session, index: createIndex(inventory.entries), shortlister: createShortlister(inventory) });
  }
  return sessions.get(key);
}
for (const s of steps) {
  const ss = await sessionFor(s);
  s.session = ss.session;
  s.index = ss.index;
  s.shortlister = ss.shortlister;
  s.kind = s.role === 'builder' ? 'builder-read' : s.session.config.kind;
}
const configurations = {};
for (const s of steps) {
  const name = s.session.config.name;
  if (configurations[name]) continue;
  const h = s.session.hashes();
  configurations[name] = { rule: s.session.config.rule, requestsPerRow: s.session.config.requestsPerRow, routingConfiguration: h.routingConfiguration, routingConfigurationHash: h.routingConfigurationHash, firstRequestDefinition: h.firstRequestDefinition, firstRequestDefinitionHash: h.firstRequestDefinitionHash };
}

const fmt = (n) => `$${n.toFixed(2)}`;
function printHeader() {
  const mode = DRY ? 'DRY RUN' : OW_PROBE ? 'open-weight probe' : PROBE ? 'probe' : PLAN ? 'evaluations' : 'run';
  console.log(`benchmark ${mode}: ${PLAN ? `plan ${plan.id} (option ${opts.option})` : `config ${steps[0].session.config.name} (${steps[0].session.config.rule})`}; today ${TODAY}`);
  console.log('inputs (sha256 of the file):');
  for (const i of inputs) {
    const extra = Object.entries(i)
      .filter(([k]) => !['role', 'path', 'sha256'].includes(k))
      .map(([k, v]) => `${k} ${v}`)
      .join('; ');
    console.log(`  ${i.role.padEnd(17)} ${i.sha256}  ${i.path}${extra ? `\n  ${''.padEnd(17)} ${extra}` : ''}`);
  }
  console.log(`  router            ${ROUTER_PACKAGE.name}@${ROUTER_PACKAGE.version} (workspace)`);
  console.log(`inputs' hash (A3.1, node benchmark/runner/input-hash.mjs): ${INPUT_HASH.hash} over ${INPUT_HASH.files.length} files`);
  if (!PLAN) {
    const s = steps[0];
    console.log(`directory: ${s.session.directoryAliases.length} of ${s.session.inventory.entries.length} entries listed: ${s.session.directoryAliases.join(', ')}`);
    if (s.session.config.unconfigured.length) console.log(`  unconfigured: ${s.session.config.unconfigured.join(', ')}`);
    const outside = [...new Set(s.questions.flatMap((q) => q.acceptable.flat()).filter((a) => !s.session.entryByAlias(a)))].sort();
    if (outside.length) console.log(`  note: the questions' labels name aliases this directory does not list: ${outside.join(', ')}`);
    console.log(`rows: ${s.models.length} model(s) × ${s.questions.length} question(s) × ${s.repeats} repeat(s) = ${s.models.length * s.questions.length * s.repeats}; concurrency ${CONCURRENCY}; cap ${CAP === null ? 'none given' : `$${CAP.toFixed(2)}`}`);
  } else {
    console.log('configurations (G0-9): routing-configuration hash; harness-definition hash of the first request');
    for (const [name, c] of Object.entries(configurations)) console.log(`  ${name.padEnd(22)} ${c.routingConfigurationHash}  ${c.firstRequestDefinitionHash}`);
    console.log(`steps: ${steps.length}; concurrency ${CONCURRENCY}; cap ${CAP === null ? 'none given' : `$${CAP.toFixed(2)}`}`);
  }
  console.log(`prices: ${lists.source}`);
  if (rosterProblems.length) {
    console.log('roster problems:');
    for (const p of rosterProblems) console.log(`  - ${p}`);
  } else console.log('roster: every model on the list, tools and every request field supported, an endpoint up within its routing');
}

async function printPlan() {
  const estimate = calibration ? `calibrated (${repoPath(opts.calibration)}): ${Object.entries(calibration.models).map(([s, m]) => `${s} ${m.charsPerToken}`).join(', ')} characters a token` : `${CHARS_PER_TOKEN} characters a token${CHARS_PER_TOKEN === CHARS_PER_TOKEN_DEFAULT ? ' (uncalibrated)' : ''}`;
  console.log('estimated cost bounds (USD):');
  const total = { calls: 0, floor: 0, ceiling: 0, completions: 0, reserved: 0, largestRow: 0 };
  const perModel = new Map();
  for (const s of steps) {
    const baselines = s.baselines ? await s.session.baselines() : null;
    // The open-weight model's bound, before G3 fixes it: the highest of the
    // candidates', per step.
    const groups = new Map();
    for (const spec of s.models) {
      const group = PLAN && OPEN_WEIGHT_CANDIDATES.includes(spec) && !opts['open-weight'] && !OW_PROBE ? 'open-weight (highest of the three)' : spec;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(spec);
    }
    if (!s.models.length) console.log(`  ${s.id.padEnd(24)} no model: ${s.questions.length} rows, no request`);
    for (const [group, members] of groups) {
      let best = null;
      for (const spec of members) {
        const mi = modelInfo.get(spec);
        if (!mi) continue;
        const b = await stepBounds({ session: s.session, kind: s.kind, mi, questions: s.questions, repeats: s.repeats, shortlister: s.shortlister, baselines });
        if (!best || b.ceiling > best.b.ceiling) best = { spec, b };
      }
      if (!best) {
        console.log(`  ${s.id.padEnd(24)} ${group}: no price`);
        continue;
      }
      const { b } = best;
      const label = members.length > 1 ? `${group}: ${best.spec}` : group;
      const params = JSON.stringify(modelInfo.get(best.spec).m.params(MAX_TOKENS));
      if (PLAN) console.log(`  ${s.id.padEnd(24)} ${label.padEnd(56)} rows ${String(s.questions.length * s.repeats).padStart(4)}  calls ≤ ${String(b.calls).padStart(5)}  floor ${fmt(b.floor).padStart(7)}  ceiling ${fmt(b.ceiling).padStart(7)}  reserved ${fmt(b.reserved).padStart(8)}  largest row ${fmt(b.largestRow)}`);
      else console.log(`  - ${best.spec.padEnd(34)} ${params.padEnd(58)} calls ≤ ${String(b.calls).padStart(5)}  floor ${fmt(b.floor).padStart(8)}  ceiling ${fmt(b.ceiling).padStart(8)}  hard ${fmt(b.reserved).padStart(8)}`);
      for (const k of ['calls', 'floor', 'ceiling', 'completions', 'reserved']) total[k] += b[k];
      total.largestRow = Math.max(total.largestRow, b.largestRow);
      const pm = perModel.get(group) ?? { calls: 0, floor: 0, ceiling: 0, completions: 0, reserved: 0 };
      for (const k of ['calls', 'floor', 'ceiling', 'completions', 'reserved']) pm[k] += b[k];
      perModel.set(group, pm);
    }
  }
  if (PLAN) for (const [g, pm] of perModel) console.log(`  by model: ${g.padEnd(40)} calls ≤ ${pm.calls}; floor ${fmt(pm.floor)}; ceiling ${fmt(pm.ceiling)} (completions at their limit ${fmt(pm.completions)}); reserved ${fmt(pm.reserved)}`);
  console.log(`  total: calls ≤ ${total.calls}; floor ${fmt(total.floor)}; ceiling ${fmt(total.ceiling)}; hard ceiling ${fmt(total.reserved)}`);
  console.log(`  of the ceiling, completions at their full limit: ${fmt(total.completions)}; prompts: ${fmt(total.ceiling - total.completions)}`);
  if (PLAN) console.log(`  the largest single row's reservation: ${fmt(total.largestRow)}; at concurrency ${CONCURRENCY}, at most ${fmt(total.largestRow * CONCURRENCY)} is held in flight beyond the spend`);
  console.log(`  estimate: ${estimate}; a request within ${TIER_MARGIN * 100}% of a price tier's threshold is priced at that tier, at the dearest endpoint it may land on.`);
  console.log(`  floor: prompts at 5 characters a token, no completions; ceiling: completions at their limit (${MAX_TOKENS}, reasoning among them; a baseline's ladder 1, 16, 1),`);
  console.log("  the request after a load carrying the larger of the largest label and the largest single source, plus each earlier response at its limit;");
  console.log('  hard ceiling: every row reserved at its worst case (bounds.mjs), summed. A run prices actual usage.');
  return total;
}

/** "The calibrated bound" (the seat's ruling, hub #302 comment 6617296646;
 *  the preregistration's "Repeats, cap, run order and fallback"): the plan's
 *  ceiling recomputed with each model's calibrated characters per token, each
 *  completion (and each earlier response a later request carries) at twice
 *  the model's largest billed completion, and the open-weight model at its
 *  routing's price ceilings; Haiku 5.5 at its dearest endpoint, as the dry
 *  run prices it. For option A and option B, and the option and `--cap` it
 *  implies. Only the evaluations' plan, with --calibration and --open-weight. */
async function calibratedBound() {
  const missing = [];
  if (!opts['open-weight']) missing.push('--open-weight <slug>');
  for (const spec of new Set(steps.flatMap((s) => s.models))) {
    const slug = resolved.get(spec).slug;
    if (!(calibration.models?.[slug]?.largestCompletion > 0)) missing.push(`a largest billed completion for ${slug}`);
  }
  console.log(`the calibrated bound (benchmark/preregistration/s1.md, "Repeats, cap, run order and fallback"):`);
  if (missing.length) {
    console.log(`  not computed: it needs ${missing.join(' and ')} (node benchmark/runner/calibration.mjs --probe <run dir> --open-weight-probe <run dir> --out <file>)`);
    return null;
  }
  const repeatsOf = (id, option) => {
    const s = plan.steps.find((x) => x.id === id);
    const o = plan.options[option];
    return o.repeats && s.repeats === 3 ? o.repeats : s.repeats;
  };
  const bound = { A: 0, B: 0 };
  const perModel = {};
  for (const s of steps) {
    for (const spec of s.models) {
      const mi = modelInfo.get(spec);
      const cal = calibration.models[mi.m.slug];
      const ceilings = routingCeilings(mi.m);
      const b = await stepBounds({ session: s.session, kind: s.kind, mi, questions: s.questions, repeats: 1, shortlister: s.shortlister, completion: cal.completionAllowance ?? 2 * cal.largestCompletion, pricings: ceilings ? [ceilings] : null, ceilingOnly: true });
      for (const option of ['A', 'B']) bound[option] += repeatsOf(s.id, option) * b.ceiling;
      perModel[mi.m.slug] = (perModel[mi.m.slug] ?? 0) + repeatsOf(s.id, opts.option) * b.ceiling;
    }
  }
  for (const [slug, c] of Object.entries(calibration.models).filter(([slug]) => perModel[slug] !== undefined)) {
    const ceilings = routingCeilings(resolveModel(slug));
    console.log(`  ${slug.padEnd(36)} ${c.charsPerToken} characters a token; each completion at ${c.completionAllowance ?? 2 * c.largestCompletion} tokens (twice ${c.largestCompletion}); ${ceilings ? `at its routing's ceilings, $${ceilings.prompt} / $${ceilings.completion} a million` : 'at its dearest endpoint'}; option ${opts.option} ${fmt(perModel[slug])}`);
  }
  const d = capDecision(bound.A, bound.B);
  console.log(`  option A: ${fmt(bound.A)}`);
  console.log(`  option B: ${fmt(bound.B)}`);
  if (d.option === 'A') console.log(`  option A applies (its bound is at most $${CAP_LIMIT_USD}): --cap ${d.cap}`);
  else if (d.option === 'B') console.log(`  option B applies (option A's bound passes $${CAP_LIMIT_USD}): --option B --cap ${d.cap}`);
  else console.log(`  the run does not start: option B's calibrated bound passes $${CAP_LIMIT_USD}, and no fallback beyond B is ruled; the seat brings it to the owner.`);
  return { optionA: bound.A, optionB: bound.B, applies: d.option, cap: d.cap };
}

printHeader();
const bounds = await printPlan();
const calibrated = PLAN && !PROBE && !OW_PROBE && calibration ? await calibratedBound() : null;
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
for (const mi of modelInfo.values()) mi.validatorFor = validatorFor;

const rowsPath = join(runDir, 'rows.jsonl');
const basePath = join(runDir, 'baseline.jsonl');
const metaPath = join(runDir, 'meta.json');
const readLines = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const priorRows = readLines(rowsPath);
const priorBase = readLines(basePath);
const done = new Set([...priorRows, ...priorBase].filter((r) => r.status === 'complete' || r.status === 'error').map((r) => r.key));
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const rowSpend = (r) => (r.costUsd !== undefined ? num(r.costUsd) : num(r.first?.cost?.charged) + num(r.second?.cost?.charged)) + num(r.cost?.charged) + (r.tried ?? []).reduce((t, s) => t + num(s.cost?.charged), 0);
// The cap covers the whole run directory, across resumed sessions.
const priorSpend = [...priorRows, ...priorBase].reduce((s, r) => s + rowSpend(r), 0);

const rowKey = (s, spec, q, r) => (s.kind === 'rule' ? `${s.id}|rule|${q.id}` : s.kind === 'builder-read' ? `${s.id}|builder|${q.id}` : PLAN ? `${s.id}|${spec}|${q.id}|${r}` : `${spec}|${q.id}|${r}`);
const expected = steps.map((s) => ({ id: s.id, config: s.session.config.name, rows: s.kind === 'rule' ? s.questions.length : s.kind === 'builder-read' ? s.questions.length : s.models.length * s.questions.length * s.repeats }));

const meta = {
  runId,
  mode: OW_PROBE ? 'open-weight-probe' : PROBE ? 'probe' : PLAN ? 'evaluations' : 'run',
  ...(PLAN ? { plan: { path: repoPath(PLAN), sha256: fileSha256(PLAN), id: plan.id, option: opts.option }, openWeight: opts['open-weight'] ?? null } : {}),
  ...(!PLAN ? { config: { name: steps[0].session.config.name, rule: steps[0].session.config.rule, unconfigured: steps[0].session.config.unconfigured, directory: steps[0].session.directoryAliases } } : {}),
  startedAt: new Date().toISOString(),
  today: TODAY,
  argv: process.argv.slice(2),
  inputsHash: { recipe: INPUT_HASH_RECIPE, hash: INPUT_HASH.hash, files: INPUT_HASH.files.length },
  configurations,
  steps: expected,
  models: [...modelInfo.values()].map((mi) => ({ spec: mi.m.spec, slug: mi.m.slug, control: mi.m.control, catalogId: mi.m.catalogId, settings: mi.m.settings, routing: mi.m.routing, requestParameters: mi.m.params(MAX_TOKENS), charsPerToken: mi.cpt, contextLength: mi.contextLength, reservationPricings: mi.reservationPricings })),
  repeats: steps.length === 1 ? steps[0].repeats : null,
  questionIds: steps.length === 1 ? steps[0].questions.map((q) => q.id) : null,
  expectedRows: expected.reduce((s, x) => s + x.rows, 0),
  cap: CAP,
  concurrency: CONCURRENCY,
  inputs,
  router: `${ROUTER_PACKAGE.name}@${ROUTER_PACKAGE.version}`,
  estimate: { charsPerToken: calibration ? 'calibrated, per model' : CHARS_PER_TOKEN, calibration: opts.calibration ? { path: repoPath(opts.calibration), sha256: fileSha256(opts.calibration) } : null, tierMargin: TIER_MARGIN, plan: { calls: bounds.calls, floorUsd: bounds.floor, ceilingUsd: bounds.ceiling, hardUsd: bounds.reserved }, calibratedBound: calibrated && { optionAUsd: calibrated.optionA, optionBUsd: calibrated.optionB, applies: calibrated.applies, capUsd: calibrated.cap } },
  pricingSource: lists.source,
  modelListSha256: lists.sha256 ?? null,
  endpointSources: lists.endpointSources ?? null,
  pricing: Object.fromEntries([...modelInfo.values()].map((mi) => [mi.m.slug, mi.listPricing])),
  request: { tool_choice: 'auto', temperature: 'not sent (the app sends none)', maxTokens: MAX_TOKENS, baseURL: BASE_URL, client: 'node fetch' },
  node: process.version,
  resumedRows: done.size,
  priorSpendUsd: priorSpend,
};
const writeMeta = (extra = {}) => writeFileSync(metaPath, jsonDocument({ ...meta, ...extra }));
writeMeta();

const rowsByKey = new Map(priorRows.map((r) => [r.key, r]));
let finished = 0;
const t0 = Date.now();
const engine = createEngine({
  ledger,
  apiKey,
  baseUrl: BASE_URL,
  cap: CAP,
  writeRow: (kind, out) => {
    appendFileSync(kind === 'baseline' ? basePath : rowsPath, jsonLine(out));
    if (kind !== 'baseline') rowsByKey.set(out.key, out);
  },
  log: (t, out, s) => {
    finished++;
    if (finished % 25 === 0) console.log(`  ${finished} done (step ${t.step?.id ?? 'baselines'}), $${s.spent.toFixed(3)} spent, $${s.reserved.toFixed(3)} reserved, ${Math.round((Date.now() - t0) / 1000)} s`);
  },
});
engine.priorSpend = priorSpend;

const notStarted = [];
const notStartedWhy = {};
console.log(`run ${runId}: ${steps.length} step(s); ${done.size} row(s) already done`);
for (const s of steps) {
  const tasks = [];
  if (s.baselines) {
    const baselines = await s.session.baselines();
    for (const spec of s.models) for (const [name, b] of Object.entries(baselines)) if (!done.has(`${spec}|${name}`)) tasks.push({ type: 'baseline', key: `${spec}|${name}`, mi: modelInfo.get(spec), name, b });
  }
  const selections = new Map();
  if (s.selectionFrom) for (const r of rowsByKey.values()) if (r.step === s.selectionFrom && r.role === 'builder') selections.set(r.qid, r);
  for (let r = 1; r <= (s.kind === 'rule' || s.kind === 'builder-read' ? 1 : s.repeats); r++) {
    for (const q of s.questions) {
      const specsHere = s.kind === 'rule' ? [null] : s.models;
      for (const spec of specsHere) {
        const key = rowKey(s, spec, q, r);
        if (done.has(key)) continue;
        const base = { key, step: s, session: s.session, index: s.index, q, r, mi: spec ? modelInfo.get(spec) : null };
        if (s.kind === 'rule') tasks.push({ ...base, type: 'rule' });
        else if (s.kind === 'builder-read') tasks.push({ ...base, type: 'builder' });
        else if (s.kind === 'search') tasks.push({ ...base, type: 'search', dir: s.session.directoryFor(s.shortlister.shortlist(q.text).aliases.map((a) => s.session.entry(a).sourceId)) });
        else if (s.kind === 'shortlist') tasks.push({ ...base, type: 'main', dir: s.session.directoryFor(s.shortlister.shortlist(q.text).aliases.map((a) => s.session.entry(a).sourceId)) });
        else if (s.kind === 'builder') {
          const b = selections.get(q.id);
          if (!b || b.status !== 'complete') {
            notStarted.push(key);
            notStartedWhy[key] = b ? 'its builder row is an error' : 'no builder row';
            continue;
          }
          tasks.push({ ...base, type: 'main', dir: s.session.directoryFor(b.selection.map((a) => s.session.entry(a).sourceId)) });
        } else tasks.push({ ...base, type: 'main', dir: s.session.full });
      }
    }
  }
  if (engine.stopReason) {
    for (const t of tasks) notStarted.push(t.key);
    continue;
  }
  notStarted.push(...(await engine.runTasks(tasks, CONCURRENCY)));
}

// --- The end: meta, and the probes' outputs ---
const allRows = [...rowsByKey.values()];
const lastBase = new Map(readLines(basePath).map((b) => [b.key, b]));
const completeRows = allRows.filter((r) => r.status === 'complete').length;
const errorRows = allRows.filter((r) => r.status === 'error').length;
const byStep = {};
for (const k of notStarted) {
  const step = PLAN ? k.split('|')[0] : steps[0].id;
  byStep[step] = (byStep[step] ?? 0) + 1;
}
const extra = {
  endedAt: new Date().toISOString(),
  spentUsd: engine.spent,
  stopReason: engine.stopReason,
  completeRows,
  errorRows,
  uniqueRows: completeRows + errorRows,
  completeBaselines: [...lastBase.values()].filter((b) => b.status === 'complete').length,
  rowsNotStarted: { count: notStarted.length, byStep, keys: notStarted, ...(Object.keys(notStartedWhy).length ? { why: notStartedWhy } : {}) },
};

if (PROBE) {
  const cal = { ...calibrate(allRows), runId, rowsSha256: existsSync(rowsPath) ? fileSha256(rowsPath) : null };
  writeFileSync(join(runDir, 'calibration.json'), jsonDocument(cal));
  extra.calibration = cal.models;
  console.log('calibration (calibration.json): characters a token, per model');
  for (const [slug, c] of Object.entries(cal.models)) console.log(`  ${slug.padEnd(36)} ${c.charsPerToken} (fewest ${c.fewestCharsPerToken} over ${c.requests} requests, less 10%)`);
  console.log(`  the calibration file the bound reads: node benchmark/runner/calibration.mjs --probe ${repoPath(runDir)} --open-weight-probe <run dir> --out <file>`);
  console.log(`  then the calibrated bound: node benchmark/runner/run.mjs --dry-run --plan ${PLAN ? repoPath(PLAN) : '<plan>'} --open-weight <slug> --calibration <file>`);
}
if (OW_PROBE) {
  const perModel = [];
  for (const spec of steps[0].models) {
    const rows = allRows.filter((r) => r.spec === spec && r.role === 'main');
    const answered = rows.filter((r) => r.status === 'complete' && r.first && !r.first.error);
    const correct = answered.filter((r) => CORRECT.has(rowScores(r).offered.score1)).length;
    const correctRaw = answered.filter((r) => CORRECT.has(rowScores(r).raw.score1)).length;
    perModel.push({ spec, rows: rows.length, answered: answered.length, errors: rows.filter((r) => r.status === 'error').length, correctOffered: correct, accuracyOffered: answered.length ? correct / answered.length : null, correctRaw, costUsd: rows.reduce((s, r) => s + num(r.costUsd), 0) });
  }
  const order = steps[0].models;
  const ranked = [...perModel].sort((a, b) => (b.accuracyOffered ?? -1) - (a.accuracyOffered ?? -1) || a.costUsd - b.costUsd || order.indexOf(a.spec) - order.indexOf(b.spec));
  // meta.json carries each accuracy as a decimal string of 8 places: as a
  // number, a ratio such as 4/49 carries a run of 13 or more digits, which
  // the writer refuses (writer.mjs). The ranking above and the printed line
  // below read the number.
  const written = perModel.map((p) => ({ ...p, accuracyOffered: p.accuracyOffered === null ? null : p.accuracyOffered.toFixed(8) }));
  extra.openWeightProbe = { rule: plan.openWeightProbe.winner, perModel: written, winner: ranked[0]?.spec ?? null, complete: notStarted.length === 0 };
  console.log('open-weight probe: first-request accuracy on the offered gold (raw gold beside it), cost, errors');
  for (const p of perModel) console.log(`  ${p.spec.padEnd(36)} ${p.correctOffered}/${p.answered} = ${p.accuracyOffered === null ? 'n/a' : p.accuracyOffered.toFixed(4)} (raw ${p.correctRaw}/${p.answered})  $${p.costUsd.toFixed(4)}  errors ${p.errors}`);
  console.log(`  winner: ${extra.openWeightProbe.winner}${notStarted.length ? ' (the probe stopped before every row; read with care)' : ''}`);
}
writeMeta(extra);
console.log(`done: ${completeRows} complete, ${errorRows} error, ${notStarted.length} not started; $${engine.spent.toFixed(4)} spent in this run directory (of which $${priorSpend.toFixed(4)} before this session)${engine.stopReason ? `; stopped — ${engine.stopReason}` : ''}`);
console.log(`output: ${repoPath(runDir)}`);
process.exit(engine.stopReason ? 2 : 0);
