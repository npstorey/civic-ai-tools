// THROWAWAY red instrument — Wave N11 P-H1 (civic-ai-tools-website#434, hub #203). Never merged.
//
// THE PROPERTY: the adversarial evaluator is told what a package's `queries[]`
// entries actually say. A call the producer recorded as REJECTED is rendered as
// rejected — never as a call that returned an unknown number of rows.
//
// WHAT IT IS AT `f6bec7a`: `buildEvaluationPrompt` renders every entry as
// `${q.tool}(${args}) → ${q.resultRows ?? '?'} rows` (adversarial-eval-core.ts:83).
// It reads neither `failed` nor `failureKind`, so the evaluator scoring the
// analysis is told a refused call returned "? rows".
//
// THE FIXTURE IS SHAPED SO THE CRITERION CAN FAIL IN THE RIGHT DIRECTION
// (CLAUDE.md: a criterion demonstrated on a fixture shaped so it cannot fail is
// not demonstrated). Three entries, because the defect is a CONFLATION:
//
//   1. answered, 12 rows      — the control: it must keep saying 12 rows.
//   2. REJECTED               — at base it reads `→ ? rows`; it must read as rejected.
//   3. answered, no row count — at base it reads `→ ? rows` too, and it must GO ON
//                               reading `? rows`, because nothing was recorded and
//                               nothing may be asserted (absence is absence).
//
// A fix that simply stopped printing `? rows` would pass a two-entry fixture and
// fail this one. The reference golden is no use here: it carries zero rejected
// entries, so an assertion over it could only ever be green.
//
// The package is hand-shaped through `as unknown as EvidencePackage`, exactly as
// this suite's own `buildEvaluationPrompt` tests build theirs — the prior-era
// alias is deliberate there and kept here.
//
// Run with: npm test   (or: node --test --experimental-strip-types
//   packages/civic-typed-harness/src/rubric/ph1-red-rejected-entry.test.ts)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEvaluationPrompt } from './adversarial-eval-core.ts';
import type { EvidencePackage } from '@typedstandards/produce-core';

const ANSWERED_DATASET = 'erm2-nwe9';
const REJECTED_DATASET = 'wxyz-9876';
const UNRECORDED_DATASET = 'qrst-5432';

function packageWithARejectedCall(): EvidencePackage {
  return {
    prompt: { text: 'How many noise complaints?', hash: 'h', visibility: 'full_text' },
    queries: [
      {
        tool: 'get_data',
        operationType: 'query',
        arguments: { dataset_id: ANSWERED_DATASET },
        resultRows: 12,
      },
      {
        tool: 'get_data',
        operationType: 'query',
        arguments: { dataset_id: REJECTED_DATASET },
        failed: true,
        failureKind: 'unavailable',
      },
      {
        tool: 'get_data',
        operationType: 'metadata',
        arguments: { dataset_id: UNRECORDED_DATASET },
      },
    ],
    dataSources: [
      { datasetUrl: `https://data.example/d/${ANSWERED_DATASET}`, accessTimestamp: '2026-06-12T00:00:00Z' },
    ],
    cost: { model: 'openai/gpt-4o' },
    output: 'There were 12 complaints.',
  } as unknown as EvidencePackage;
}

/** The one rendered line for a dataset, as the evaluator receives it. */
function lineFor(prompt: string, datasetId: string): string {
  const line = prompt.split('\n').find((l) => l.includes(datasetId));
  assert.ok(line, `the evaluator was told nothing at all about ${datasetId}`);
  return line!;
}

// --- Premises, green at base ---------------------------------------------------

test('premise: the evaluator is told about all three calls, and the answered one keeps its row count', () => {
  const prompt = buildEvaluationPrompt(packageWithARejectedCall());
  assert.match(prompt, /## Tool Calls Made \(3 total\)/);
  assert.match(lineFor(prompt, ANSWERED_DATASET), /→ 12 rows/);
});

test('premise: absence stays absence — a call with no row count recorded still says so', () => {
  const prompt = buildEvaluationPrompt(packageWithARejectedCall());
  assert.match(lineFor(prompt, UNRECORDED_DATASET), /\? rows/);
});

// --- The red -------------------------------------------------------------------
//
// THE SECOND ASSERTION WAS WRITTEN ONCE IN A FORM THAT PASSED AT BASE, and the
// correction is recorded here rather than quietly made. It compared the two
// rendered lines after replacing only the dataset id — and the leading `2.` and
// `3.` index made them differ whatever the evaluator printed, so it would have
// gone green at base while pinning nothing. The normalisation below strips the
// index too, so what is compared is the rendered outcome and nothing else.
//
// The first assertion is also narrowed: it refuses `? rows` for a rejected call
// rather than the word "rows" outright, so a fix that says "rejected … no rows"
// is not failed for its wording, and it separately requires that the rejection
// be stated at all.

/** One rendered line, with everything that is not the outcome removed. */
function outcomeOf(line: string, datasetId: string): string {
  return line.replace(/^\s*\d+\.\s*/, '').replace(datasetId, 'X');
}

test('#203 RED: a rejected call is rendered as rejected, and claims no row count', () => {
  const line = lineFor(buildEvaluationPrompt(packageWithARejectedCall()), REJECTED_DATASET);
  assert.doesNotMatch(
    line,
    /\?\s*rows/,
    `the evaluator is told a REJECTED call returned an unknown number of rows:\n  ${line}`,
  );
  assert.match(
    line,
    /reject|refus|fail/i,
    `the evaluator is never told the call was rejected:\n  ${line}`,
  );
});

test('#203 RED: the rejected call is told apart from the call whose row count was never recorded', () => {
  const prompt = buildEvaluationPrompt(packageWithARejectedCall());
  assert.notEqual(
    outcomeOf(lineFor(prompt, REJECTED_DATASET), REJECTED_DATASET),
    outcomeOf(lineFor(prompt, UNRECORDED_DATASET), UNRECORDED_DATASET),
    'a rejected call and a call with no recorded row count read identically to the evaluator',
  );
});
