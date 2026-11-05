#!/usr/bin/env node
// The probes' calibration (anchor P0's rule; the seat's ruling on "the
// calibrated bound", hub #302 comment 6617296646).
//
//   - characters per token: per model, the fewest characters of a request
//     body's JSON per billed prompt token over the two-question probe's
//     requests, less 10%. A lower figure means more tokens per character, so
//     the estimate errs high. The reservation and every bound read it.
//   - the largest billed completion: per model, the most completion tokens
//     any one request billed (reasoning tokens included), over the
//     two-question probe's rows, the open-weight probe's rows of its winner,
//     and, for Haiku 5.5, R5's committed rows. "The calibrated bound" counts
//     each completion at twice it (run.mjs, plan.mjs); the reservation does
//     not: it keeps the 4,000-token limit.
//
// A probe run writes calibration.json from its own rows (schema
// civic-calibration/1, characters per token and its own completions). The
// file the evaluations and the calibrated bound read is this command's:
//
//   node benchmark/runner/calibration.mjs --probe <two-question probe's run dir>
//     --open-weight-probe <open-weight probe's run dir> --out <file>
//
// which reads R5's committed rows from benchmark/runs/2026-10-11-r5/rows.jsonl
// and writes schema civic-calibration/2 (its fields: `CALIBRATION_FIELDS`).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonDocument } from './writer.mjs';

/** The calibration's rule, as the file states it. */
export const CALIBRATION_RULE =
  "per model, the fewest characters of a request body's JSON per billed prompt token over the probe's requests that returned usage, less 10%, rounded down to four places";

/** The share taken off the fewest characters per token. */
export const CALIBRATION_MARGIN = 0.1;

/** Every request of a row that returned usage: `{ chars, promptTokens }`. */
export function rowRequests(row) {
  const out = [];
  const add = (r) => {
    if (r && typeof r.promptChars === 'number' && r.usage?.prompt_tokens > 0) out.push({ chars: r.promptChars, promptTokens: r.usage.prompt_tokens });
  };
  if (Array.isArray(row.requests) && row.requests.length) row.requests.forEach(add);
  else add(row.first);
  add(row.second);
  add(row.request);
  return out;
}

/** The calibration over a probe's rows: per model slug, its characters per
 *  token and what it was read from. */
export function calibrate(rows) {
  const byModel = {};
  for (const row of rows) {
    if (!row.model) continue;
    for (const r of rowRequests(row)) {
      const ratio = r.chars / r.promptTokens;
      const m = (byModel[row.model] ??= { requests: 0, fewest: Infinity, at: null });
      m.requests++;
      if (ratio < m.fewest) {
        m.fewest = ratio;
        m.at = { key: row.key, chars: r.chars, promptTokens: r.promptTokens };
      }
    }
  }
  const models = {};
  for (const [slug, m] of Object.entries(byModel)) {
    const floor4 = (x) => Math.floor(x * 1e4) / 1e4;
    models[slug] = { charsPerToken: floor4(m.fewest * (1 - CALIBRATION_MARGIN)), fewestCharsPerToken: floor4(m.fewest), requests: m.requests, fewestAt: m.at };
  }
  return { schema: 'civic-calibration/1', rule: CALIBRATION_RULE, models };
}

/** A request's billed completion: its `completion_tokens`, which OpenRouter
 *  reports with reasoning tokens included; where its reasoning tokens are
 *  reported as larger, those. */
export const billedCompletion = (usage) => Math.max(Number(usage?.completion_tokens ?? 0), Number(usage?.completion_tokens_details?.reasoning_tokens ?? 0));

/** Every request of a row that returned usage, its usage. */
function usagesOf(row) {
  const reqs = Array.isArray(row.requests) && row.requests.length ? [...row.requests] : [row.first];
  return [...reqs, row.second, row.request].filter((r) => r?.usage).map((r) => r.usage);
}

/** The largest billed completion of `model` over `rows`: `{ requests,
 *  largest }`. */
export function completionsOf(rows, model) {
  let requests = 0;
  let largest = 0;
  for (const row of rows) {
    if (row.model !== model) continue;
    for (const u of usagesOf(row)) {
      requests++;
      largest = Math.max(largest, billedCompletion(u));
    }
  }
  return { requests, largest };
}

/** The completion rule and the bound's rule, as the file states them. */
export const COMPLETION_RULE =
  "per model, the most completion tokens one request billed (completion_tokens, which carries reasoning tokens; the reasoning tokens where reported larger), over the two-question probe's rows, the open-weight probe's rows of its winner, and for Haiku 5.5 R5's committed rows";

/** "The calibrated bound", the seat's ruling (hub #302 comment 6617296646):
 *  its three points and the rules it leaves unchanged, word for word. The
 *  preregistration quotes each. */
export const CALIBRATED_BOUND_POINTS = Object.freeze([
  "each model's calibrated characters per token, from the two-question probe, as preregistered;",
  "each completion at twice the largest billed completion (reasoning included) measured for that model, over the probes' rows and, for Haiku, R5's committed rows;",
  "the open-weight winner at the price ceiling the run's provider routing enforces for it, not at its cheapest listed endpoint.",
]);
export const CALIBRATED_BOUND_UNCHANGED = Object.freeze([
  '`--cap` is set at G3 from that bound, rounded up, and never above $100: the owner\'s G0-3a limit, with $70 the target.',
  'Up to $100 the run keeps option A; above it, option B. No fallback beyond B is ruled: if B\'s calibrated bound also passes $100, the run does not start, and the seat brings it to the owner.',
  'Every row still reserves its full worst case, so recorded spend plus the reservations in flight never pass `--cap`. A cap stop loses only the run order\'s last steps and is reported as such.',
]);

/** The cap limit and the decision between the options. */
export const CAP_LIMIT_USD = 100;
export function capDecision(boundA, boundB) {
  if (boundA <= CAP_LIMIT_USD) return { option: 'A', cap: Math.ceil(boundA) };
  if (boundB <= CAP_LIMIT_USD) return { option: 'B', cap: Math.ceil(boundB) };
  return { option: null, cap: null };
}

/** The fields of a civic-calibration/2 file. */
export const CALIBRATION_FIELDS = Object.freeze({
  schema: '"civic-calibration/2"',
  rule: 'the characters-per-token rule (CALIBRATION_RULE)',
  completionRule: 'the largest-completion rule (COMPLETION_RULE)',
  openWeight: "the open-weight probe's winner, the model the two-question probe ran beside Haiku 5.5",
  sources: "each run read, by run id and the sha256 of its rows.jsonl; R5's rows by path and sha256",
  'models.<slug>.charsPerToken': "the calibrated characters per token (the two-question probe's)",
  'models.<slug>.fewestCharsPerToken, requests, fewestAt': 'what it was read from',
  'models.<slug>.largestCompletion': 'the largest billed completion over every source counted for the model',
  'models.<slug>.completionAllowance': 'twice it: what the calibrated bound counts for each completion',
  'models.<slug>.completionsFrom': 'per source, the requests read and the largest completion among them',
});

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const readRows = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** The civic-calibration/2 file from the three sources' texts. */
export function combine({ probe, openWeightProbe, r5 }) {
  const winner = openWeightProbe.meta.openWeightProbe?.winner;
  if (!winner) throw new Error("the open-weight probe's meta.json names no winner");
  const probeModels = [...new Set(probe.rows.map((r) => r.model).filter(Boolean))].sort();
  const HAIKU = 'anthropic/claude-haiku-5.5';
  if (JSON.stringify(probeModels) !== JSON.stringify([HAIKU, winner].sort())) {
    throw new Error(`the two-question probe ran ${probeModels.join(', ')}; it must run Haiku 5.5 and the open-weight probe's winner, ${winner}`);
  }
  const cpt = calibrate(probe.rows).models;
  const models = {};
  for (const slug of [HAIKU, winner]) {
    const from = { probe: completionsOf(probe.rows, slug) };
    if (slug === winner) from.openWeightProbe = completionsOf(openWeightProbe.rows, slug);
    if (slug === HAIKU) from.r5 = completionsOf(r5.rows, slug);
    const largest = Math.max(...Object.values(from).map((f) => f.largest));
    if (!(cpt[slug]?.charsPerToken > 0) || !(largest > 0)) throw new Error(`${slug}: the probes give no figure`);
    models[slug] = { ...cpt[slug], largestCompletion: largest, completionAllowance: 2 * largest, completionsFrom: from };
  }
  return {
    schema: 'civic-calibration/2',
    rule: CALIBRATION_RULE,
    completionRule: COMPLETION_RULE,
    openWeight: winner,
    sources: {
      probe: { runId: probe.meta.runId, rowsSha256: probe.rowsSha256 },
      openWeightProbe: { runId: openWeightProbe.meta.runId, rowsSha256: openWeightProbe.rowsSha256, winner },
      r5: { path: r5.path, rowsSha256: r5.rowsSha256 },
    },
    models,
  };
}

export const R5_ROWS = 'benchmark/runs/2026-10-11-r5/rows.jsonl';
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function main() {
  const args = process.argv.slice(2);
  const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const probeDir = arg('--probe');
  const owDir = arg('--open-weight-probe');
  const out = arg('--out');
  if (!probeDir || !owDir || !out) {
    console.error('usage: node benchmark/runner/calibration.mjs --probe <run dir> --open-weight-probe <run dir> --out <file>');
    process.exit(2);
  }
  const run = (dir) => {
    const text = readFileSync(join(dir, 'rows.jsonl'), 'utf8');
    return { meta: JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')), rows: readRows(join(dir, 'rows.jsonl')), rowsSha256: sha256(text) };
  };
  const probe = run(probeDir);
  const openWeightProbe = run(owDir);
  if (probe.meta.mode !== 'probe') throw new Error(`${probeDir} is not a two-question probe's run (mode ${probe.meta.mode})`);
  if (openWeightProbe.meta.mode !== 'open-weight-probe') throw new Error(`${owDir} is not an open-weight probe's run (mode ${openWeightProbe.meta.mode})`);
  const r5Text = readFileSync(join(REPO_ROOT, R5_ROWS), 'utf8');
  const r5 = { path: R5_ROWS, rows: readRows(join(REPO_ROOT, R5_ROWS)), rowsSha256: sha256(r5Text) };
  if (existsSync(out)) {
    console.error(`${out} exists; give another --out`);
    process.exit(1);
  }
  const cal = combine({ probe, openWeightProbe, r5 });
  writeFileSync(out, jsonDocument(cal));
  for (const [slug, m] of Object.entries(cal.models)) console.log(`${slug.padEnd(36)} ${m.charsPerToken} characters a token; largest completion ${m.largestCompletion} tokens, counted at ${m.completionAllowance}`);
  console.log(`wrote ${out}`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
