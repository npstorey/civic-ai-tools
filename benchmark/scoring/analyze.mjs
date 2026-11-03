#!/usr/bin/env node
// The scorer: one run directory's `meta.json`, `rows.jsonl` and
// `baseline.jsonl`, summarized. Every number the report gives is read from a
// summary this script wrote, and each summary names the three files it was
// computed from by their sha256.
//
// Usage: node benchmark/scoring/analyze.mjs <run dir> --out <file>
//
// Moved from R5's chooser spike (`lib/analyze.mjs`). What the move changed,
// and nothing else:
//
//   - THE OUTPUT CARRIES NO CLOCK AND NO ABSOLUTE PATH. R5's `computedAt` and
//     `runDir` are gone, so the same three files always give the same bytes.
//   - IT WRITES WHERE IT IS TOLD, AND NEVER OVER A FILE. `--out` is required,
//     and an existing file there is refused: a run's own `summary.json` is
//     never overwritten.
//   - A COST IS READ WITH `Number()` BEFORE ANY SUM, so a file that carries
//     costs as decimal strings (the digit-run convention) sums as one that
//     carries floats. A baseline's cost is read the same way, and a
//     baseline step that was charged and then re-sent (no usage at one
//     token) counts in `spentUsd`; R5's files hold no such step.
//   - IT WRITES UNDER THE DIGIT-RUN CONVENTION, through the runner's writer:
//     costs as decimal strings, long runs inside text escaped.
//
// A key that appears more than once (a row redone after a cap stop) counts
// once: its last line.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORRECT } from './score.mjs';
import { jsonDocument } from '../runner/writer.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** A cost as a number, whether the file carries a float or a decimal string;
 *  0 when absent. */
export const costOf = (value) => (value === null || value === undefined ? 0 : Number(value));

/** The summary of one run, from the three files' texts. Pure: no clock, no
 *  path, no I/O. */
export function summarize({ metaText, rowsText, baseText }) {
  const meta = JSON.parse(metaText);
  const lastByKey = (text) => {
    const m = new Map();
    for (const l of text.split('\n').filter(Boolean)) {
      const r = JSON.parse(l);
      m.set(r.key, r);
    }
    return [...m.values()];
  };
  const rows = lastByKey(rowsText);
  const base = lastByKey(baseText);

  const pct = (n, d) => (d ? Number((n / d).toFixed(4)) : null);
  const median = (xs) => {
    const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
    if (!s.length) return null;
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const quantile = (xs, q) => {
    const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null;
  };
  const setKey = (s) => [...(s ?? [])].sort().join(',');

  function perModel(spec) {
    const rs = rows.filter((r) => r.spec === spec);
    const complete = rs.filter((r) => r.status === 'complete');
    const answered = complete.filter((r) => r.first && !r.first.error);
    const needSource = answered.filter((r) => r.kind === 'single' || r.kind === 'two');
    const noSource = answered.filter((r) => r.kind === 'none');
    const counts1 = {};
    const counts2 = {};
    for (const r of answered) {
      counts1[r.score1] = (counts1[r.score1] ?? 0) + 1;
      counts2[r.score2] = (counts2[r.score2] ?? 0) + 1;
    }
    const byKind = {};
    for (const r of answered) {
      byKind[r.kind] ??= { n: 0, correct1: 0, correct2: 0 };
      byKind[r.kind].n++;
      if (CORRECT.has(r.score1)) byKind[r.kind].correct1++;
      if (CORRECT.has(r.score2)) byKind[r.kind].correct2++;
    }
    // Consistency: a question whose every repeat loaded the same alias set.
    const byQ = new Map();
    for (const r of answered) {
      if (!byQ.has(r.qid)) byQ.set(r.qid, []);
      byQ.get(r.qid).push(setKey(r.loaded1));
    }
    const multi = [...byQ.values()].filter((v) => v.length > 1);
    const consistent = multi.filter((v) => v.every((x) => x === v[0])).length;
    // Second request.
    const seconds = answered.filter((r) => r.second);
    const outcomes = {};
    for (const r of seconds) outcomes[r.second.outcome ?? 'skipped'] = (outcomes[r.second.outcome ?? 'skipped'] ?? 0) + 1;
    const loadedCalls = seconds.flatMap((r) => (r.second.evaluated ?? []).filter((e) => e.kind === 'loaded' || e.kind === 'unknown'));
    const firstTokens = answered.map((r) => r.first.usage?.prompt_tokens);
    const reasoning = answered.reduce(
      (s, r) =>
        s + (r.first.usage?.completion_tokens_details?.reasoning_tokens ?? 0) + (r.second?.usage?.completion_tokens_details?.reasoning_tokens ?? 0),
      0,
    );
    const cost = rs.reduce((s, r) => s + costOf(r.first?.cost?.charged) + costOf(r.second?.cost?.charged), 0);
    const bl = Object.fromEntries(
      base
        .filter((b) => b.spec === spec)
        .map((b) => [
          b.baseline,
          {
            status: b.status,
            promptTokens: b.usage?.prompt_tokens ?? null,
            sent: b.sent ?? null,
            toolCount: b.toolCount ?? null,
            cost: b.cost?.charged === undefined || b.cost?.charged === null ? null : costOf(b.cost.charged),
            tried: b.tried,
          },
        ]),
    );
    const firstMedian = median(firstTokens);
    const failures = answered
      .filter((r) => !CORRECT.has(r.score1) || (r.second && r.second.outcome !== 'valid_tool_call'))
      .map((r) => ({
        key: r.key,
        kind: r.kind,
        acceptable: r.acceptable,
        loaded1: r.loaded1,
        score1: r.score1,
        firstContent: r.first.content,
        firstToolCalls: r.first.toolCalls,
        second: r.second ? { outcome: r.second.outcome, toolCalls: r.second.toolCalls, evaluated: r.second.evaluated, content: r.second.content, error: r.second.error } : null,
      }));
    return {
      spec,
      model: rs[0]?.model ?? spec.split('@')[0],
      control: rs[0]?.control ?? null,
      rows: rs.length,
      complete: complete.length,
      errors: complete.filter((r) => r.first?.error).length + rs.filter((r) => r.status === 'error').length,
      firstCallIsLoad: { onSourceQuestions: pct(needSource.filter((r) => r.firstCallIsLoad).length, needSource.length), n: needSource.length, onAll: pct(answered.filter((r) => r.firstCallIsLoad).length, answered.length) },
      aliasAccuracy: {
        firstRequest: pct(answered.filter((r) => CORRECT.has(r.score1)).length, answered.length),
        afterSecondRequest: pct(answered.filter((r) => CORRECT.has(r.score2)).length, answered.length),
        n: answered.length,
        counts1,
        counts2,
        byKind,
      },
      overLoading: pct(counts1.over ?? 0, answered.length),
      noLoadOnNoSource: { rate: pct(noSource.filter((r) => !r.loaded1.length).length, noSource.length), n: noSource.length },
      invalidAliasCalls: answered.reduce((s, r) => s + (r.first.invalidAliases?.length ?? 0), 0),
      otherToolCallsOnFirst: answered.reduce((s, r) => s + (r.first.otherCalls?.length ?? 0), 0),
      consistency: { questionsAllRepeatsSame: pct(consistent, multi.length), n: multi.length },
      secondRequest: {
        made: seconds.length,
        outcomes,
        validRate: pct(outcomes.valid_tool_call ?? 0, seconds.length),
        toolCalls: loadedCalls.length,
        validName: pct(loadedCalls.filter((e) => e.validName).length, loadedCalls.length),
        argsParse: pct(loadedCalls.filter((e) => e.argsParse).length, loadedCalls.length),
        schemaValid: pct(loadedCalls.filter((e) => e.schemaValid).length, loadedCalls.length),
      },
      tokens: {
        firstRequestPromptMedian: firstMedian,
        firstRequestPromptMin: Math.min(...firstTokens.filter((x) => typeof x === 'number')),
        firstRequestPromptMax: Math.max(...firstTokens.filter((x) => typeof x === 'number')),
        baselines: bl,
        directoryVsT1: bl.T1_everything?.promptTokens && firstMedian ? Number((firstMedian / bl.T1_everything.promptTokens).toFixed(4)) : null,
        directoryVsT0: bl.T0_site_today?.promptTokens && firstMedian ? Number((firstMedian / bl.T0_site_today.promptTokens).toFixed(4)) : null,
        reasoningTokens: reasoning,
      },
      latencyMs: {
        firstMedian: median(answered.map((r) => r.first.latencyMs)),
        firstP90: quantile(answered.map((r) => r.first.latencyMs), 0.9),
        secondMedian: median(seconds.map((r) => r.second.latencyMs)),
        secondP90: quantile(seconds.map((r) => r.second.latencyMs), 0.9),
      },
      costUsd: Number(cost.toFixed(4)),
      respondedModels: [...new Set(answered.map((r) => r.first.respondedModel))],
      failures,
    };
  }

  const specs = meta.models.map((m) => m.spec);
  return {
    files: { 'rows.jsonl': sha256(rowsText), 'baseline.jsonl': sha256(baseText), 'meta.json': sha256(metaText) },
    runId: meta.runId,
    today: meta.today,
    expectedRows: meta.expectedRows,
    uniqueRows: rows.length,
    completeRows: rows.filter((r) => r.status === 'complete').length,
    rowLines: rowsText.split('\n').filter(Boolean).length,
    spentUsd: Number(
      rows
        .concat(base)
        .reduce(
          (s, r) =>
            s +
            costOf(r.first?.cost?.charged) +
            costOf(r.second?.cost?.charged) +
            costOf(r.cost?.charged) +
            (r.tried ?? []).reduce((t, step) => t + costOf(step.cost?.charged), 0),
          0,
        )
        .toFixed(4),
    ),
    models: specs.map(perModel),
  };
}

/** The three files of a run directory, as texts; an absent file reads as ''. */
export function readRunFiles(dir) {
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '');
  return { metaText: read('meta.json'), rowsText: read('rows.jsonl'), baseText: read('baseline.jsonl') };
}

/** The summary's text under the digit-run convention. */
export const summaryText = (summary) => jsonDocument(summary);

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const dir = args.find((a, i) => !a.startsWith('--') && i !== outAt + 1);
  const out = outAt === -1 ? undefined : args[outAt + 1];
  if (!dir || !out) {
    console.error('usage: node benchmark/scoring/analyze.mjs <run dir> --out <file>');
    process.exit(2);
  }
  if (!existsSync(join(dir, 'meta.json'))) {
    console.error(`no meta.json in ${dir}`);
    process.exit(2);
  }
  const summary = summarize(readRunFiles(dir));
  try {
    writeFileSync(out, summaryText(summary), { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') {
      console.error(`${out} exists; the scorer never writes over a file. Give another --out.`);
      process.exit(1);
    }
    throw e;
  }
  console.log(`${summary.runId}: ${summary.completeRows}/${summary.expectedRows} rows complete (${summary.uniqueRows} unique keys, ${summary.rowLines} lines); $${summary.spentUsd}`);
  for (const m of summary.models) {
    console.log(
      `  ${m.spec.padEnd(36)} load-first ${m.firstCallIsLoad.onSourceQuestions} acc1 ${m.aliasAccuracy.firstRequest} acc2 ${m.aliasAccuracy.afterSecondRequest} over ${m.overLoading} noLoad(none) ${m.noLoadOnNoSource.rate} consist ${m.consistency.questionsAllRepeatsSame} 2nd-valid ${m.secondRequest.validRate} (${m.secondRequest.made}) tok ${m.tokens.firstRequestPromptMedian}/${m.tokens.baselines.T1_everything?.promptTokens} err ${m.errors} $${m.costUsd}`,
    );
  }
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
