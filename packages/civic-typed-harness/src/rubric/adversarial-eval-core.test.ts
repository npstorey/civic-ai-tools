// Adversarial-eval pure-core tests, ported from the reference suite, plus the
// load-bearing relocation check: RUBRIC_VERSION_SHA256 is a Q26-pinned
// version hash and MUST be byte-exact with the reference implementation —
// the literal below was captured from civic-ai-tools-website
// src/lib/evidence/adversarial-eval-core.ts on 2026-08-01.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  EVALUATION_RUBRIC,
  EVALUATION_CRITERIA,
  RUBRIC_ID,
  RUBRIC_VERSION_SHA256,
  buildEvaluationPrompt,
  parseEvaluationResponse,
} from './adversarial-eval-core.ts';
// DELIBERATELY on the prior-era name: `EvidencePackage` is produce-core
// 0.3.0's deprecated alias of `RecordPackage` (spec Appendix J,
// alias-and-deprecate). This suite is the executable proof that the alias
// still compiles and still describes the same object, so a downstream caller
// that has not renamed yet is not broken. Do not "modernize" it — the
// settlement-era name is exercised by src/rubric/adversarial-eval-core.ts's
// own signature and by src/golden-reproduction.test.ts.
import type { EvidencePackage } from '@typedstandards/produce-core';

/** The reference implementation's rubric version hash: the SHA-256 of THE
 *  RUBRIC TEXT (`EVALUATION_RUBRIC`) and of nothing else, captured from
 *  civic-ai-tools-website on 2026-08-01.
 *
 *  WHAT THIS PIN IS NOT. It is not a pin on the prompt set the evaluator
 *  reads. `buildEvaluationPrompt`'s template — which assembles this rubric
 *  with the package's tool calls, data sources and model — is OUTSIDE the
 *  hash, so this value stays fixed while what the evaluator is shown changes.
 *  That is not hypothetical: the rejected-call rendering
 *  (civic-ai-tools#203) changed what the evaluator reads and moved no byte of
 *  this digest, which is why the assertion below still passes. The gap between
 *  the field's name (`promptSetVersion`) and what it covers is filed for the
 *  specification as civic-ai-tools#207.
 *
 *  Byte-exact preservation is a G0 decision (decision 4): moving the rubric
 *  changes no hashes. */
const REFERENCE_RUBRIC_VERSION_SHA256 =
  'b62b193c992fd430cc82dff9a80a057bbe0b2b656fbdace450ca1a5d99fffa02';

function validResponse(overrides: Record<string, unknown> = {}): string {
  const base: Record<string, unknown> = Object.fromEntries(
    EVALUATION_CRITERIA.map((k, i) => [k, { score: i + 4, comment: `note ${k}` }]),
  );
  return JSON.stringify({
    ...base,
    overallScore: 6.5,
    assessment: 'A reasonable analysis with caveats.',
    ...overrides,
  });
}

test('RUBRIC_VERSION_SHA256 is byte-exact with the reference implementation', () => {
  assert.equal(RUBRIC_VERSION_SHA256, REFERENCE_RUBRIC_VERSION_SHA256);
});

test('RUBRIC_VERSION_SHA256 pins the exact rubric text (noble backend matches node:crypto)', () => {
  const expected = crypto.createHash('sha256').update(EVALUATION_RUBRIC).digest('hex');
  assert.equal(RUBRIC_VERSION_SHA256, expected);
  assert.equal(RUBRIC_VERSION_SHA256.length, 64);
  assert.ok(RUBRIC_ID.startsWith('civicaitools-adversarial-rubric/'));
});

test('parseEvaluationResponse: accepts a conformant response', () => {
  const parsed = parseEvaluationResponse(validResponse());
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.results.overallScore, 6.5);
    assert.equal(parsed.results.assessment, 'A reasonable analysis with caveats.');
    assert.equal(Object.keys(parsed.results.perCriterion).length, EVALUATION_CRITERIA.length);
    assert.equal(parsed.results.perCriterion.dataSourceIdentification.score, 4);
  }
});

test('parseEvaluationResponse: strips markdown fences', () => {
  const fenced = '```json\n' + validResponse() + '\n```';
  const parsed = parseEvaluationResponse(fenced);
  assert.ok(parsed.ok);
});

test('parseEvaluationResponse: recomputes overallScore when omitted', () => {
  const obj = JSON.parse(validResponse());
  delete obj.overallScore;
  const parsed = parseEvaluationResponse(JSON.stringify(obj));
  assert.ok(parsed.ok);
  if (parsed.ok) {
    // scores are 4..9 → mean 6.5
    assert.equal(parsed.results.overallScore, 6.5);
  }
});

test('parseEvaluationResponse: rejects invalid JSON with the raw text preserved', () => {
  const parsed = parseEvaluationResponse('I cannot evaluate this.');
  assert.ok(!parsed.ok);
  if (!parsed.ok) {
    assert.equal(parsed.error, 'Evaluator returned invalid JSON');
    assert.equal(parsed.raw, 'I cannot evaluate this.');
  }
});

test('parseEvaluationResponse: rejects a missing criterion by name', () => {
  const obj = JSON.parse(validResponse());
  delete obj.geographicScope;
  const parsed = parseEvaluationResponse(JSON.stringify(obj));
  assert.ok(!parsed.ok);
  if (!parsed.ok) {
    assert.match(parsed.error, /geographicScope/);
  }
});

test('parseEvaluationResponse: rejects a non-numeric score', () => {
  const obj = JSON.parse(validResponse());
  obj.limitationsNoted = { score: 'high', comment: 'x' };
  const parsed = parseEvaluationResponse(JSON.stringify(obj));
  assert.ok(!parsed.ok);
});

test('buildEvaluationPrompt: includes prompt text, tool calls, and output', () => {
  const pkg = {
    prompt: { text: 'How many noise complaints?', hash: 'h', visibility: 'full_text' },
    queries: [
      {
        tool: 'get_data',
        operationType: 'query',
        arguments: { dataset_id: 'erm2-nwe9' },
        resultRows: 12,
      },
    ],
    dataSources: [
      { datasetUrl: 'https://data.example/d/erm2-nwe9', accessTimestamp: '2026-06-12T00:00:00Z' },
    ],
    cost: { model: 'openai/gpt-4o' },
    output: 'There were 12 complaints.',
  } as unknown as EvidencePackage;
  const prompt = buildEvaluationPrompt(pkg);
  assert.match(prompt, /How many noise complaints\?/);
  assert.match(prompt, /get_data\(dataset_id="erm2-nwe9"\) → 12 rows/);
  assert.match(prompt, /https:\/\/data\.example\/d\/erm2-nwe9/);
  assert.match(prompt, /There were 12 complaints\./);
  assert.match(prompt, /openai\/gpt-4o/);
});

test('buildEvaluationPrompt: hash-only prompts render the unavailable marker', () => {
  const pkg = {
    prompt: { hash: 'h', visibility: 'hash_only' },
    queries: [],
    dataSources: [],
    cost: { model: 'm' },
    output: 'out',
  } as unknown as EvidencePackage;
  assert.match(buildEvaluationPrompt(pkg), /\[prompt text not available\]/);
});

// --- A call the source rejected is rendered as rejected (civic-ai-tools#203) ---
//
// THE PROPERTY: the evaluator is told what a package's `queries[]` entries
// actually say. Before this, every entry rendered as
// `${tool}(${args}) → ${resultRows ?? '?'} rows`, reading neither `failed` nor
// `failureKind` — so a call the source REFUSED and a call whose row count was
// simply never recorded produced the same line, under a rubric that asks the
// evaluator to "cross-check key figures against the raw data returned in the
// tool calls". The resulting score is signed as an `evaluation` attestation.
//
// THE FIXTURE IS SHAPED SO THE ASSERTIONS CAN FAIL. Three entries, because the
// defect is a CONFLATION, not a single bad line:
//   1. answered, 12 rows      — the control: it must keep its count.
//   2. REJECTED               — it must read as rejected and claim no count.
//   3. answered, no row count — it must GO ON reading `? rows`, because
//                               nothing was recorded and nothing may be
//                               asserted (absence is absence).
// A fix that merely stopped printing `? rows` would satisfy a two-entry
// fixture and fail this one. `__fixtures__/reference-golden.json` is no use
// here: its eight `queries[]` entries carry zero `failed` keys and all carry a
// row count, so an assertion over it could only ever be green.

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

/** One rendered line with everything that is NOT the outcome removed — the
 *  leading list index as well as the dataset id. Stripping the index matters:
 *  comparing the raw lines would make `2.` and `3.` differ whatever the
 *  evaluator printed, so the comparison would pin nothing. */
function outcomeOf(line: string, datasetId: string): string {
  return line.replace(/^\s*\d+\.\s*/, '').replace(datasetId, 'X');
}

test('buildEvaluationPrompt: every call is listed, and an answered call keeps its row count', () => {
  const prompt = buildEvaluationPrompt(packageWithARejectedCall());
  assert.match(prompt, /## Tool Calls Made \(3 total\)/);
  assert.match(lineFor(prompt, ANSWERED_DATASET), /→ 12 rows/);
});

test('buildEvaluationPrompt: a rejected call is rendered as rejected and claims no row count', () => {
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

test('buildEvaluationPrompt: absence stays absence — no recorded row count still reads "? rows"', () => {
  const line = lineFor(buildEvaluationPrompt(packageWithARejectedCall()), UNRECORDED_DATASET);
  assert.match(line, /\? rows/);
  assert.doesNotMatch(
    line,
    /reject|refus|fail/i,
    'a call with no recorded outcome was rendered as a rejection — absence is not a rejection',
  );
});

test('buildEvaluationPrompt: a rejected call reads differently from one whose count was never recorded', () => {
  const prompt = buildEvaluationPrompt(packageWithARejectedCall());
  assert.notEqual(
    outcomeOf(lineFor(prompt, REJECTED_DATASET), REJECTED_DATASET),
    outcomeOf(lineFor(prompt, UNRECORDED_DATASET), UNRECORDED_DATASET),
    'a rejected call and a call with no recorded row count read identically to the evaluator',
  );
});

// `failed` is the assertion; `failureKind` is only a label on one. This is the
// harness's own rule, stated at capture/data-sources.ts, and it is asserted
// here so a future "treat any failureKind as a rejection" change goes red.
test('buildEvaluationPrompt: a failureKind with no `failed` is NOT a rejection', () => {
  const pkg = {
    prompt: { text: 'q', hash: 'h', visibility: 'full_text' },
    queries: [
      {
        tool: 'get_data',
        operationType: 'query',
        arguments: { dataset_id: 'kind-only' },
        failureKind: 'unavailable',
      },
    ],
    dataSources: [],
    cost: { model: 'm' },
    output: 'o',
  } as unknown as EvidencePackage;
  const line = lineFor(buildEvaluationPrompt(pkg), 'kind-only');
  assert.match(line, /\? rows/);
  assert.doesNotMatch(line, /reject|refus/i);
});

test('buildEvaluationPrompt: `failed: false` is NOT a rejection', () => {
  const pkg = {
    prompt: { text: 'q', hash: 'h', visibility: 'full_text' },
    queries: [
      {
        tool: 'get_data',
        operationType: 'query',
        arguments: { dataset_id: 'not-failed' },
        failed: false,
        resultRows: 7,
      },
    ],
    dataSources: [],
    cost: { model: 'm' },
    output: 'o',
  } as unknown as EvidencePackage;
  const line = lineFor(buildEvaluationPrompt(pkg), 'not-failed');
  assert.match(line, /→ 7 rows/);
  assert.doesNotMatch(line, /reject|refus/i);
});

// The turn built here is read by a model whose score becomes a SIGNED
// attestation, so the producer's own words must not be interpolated into it.
test('buildEvaluationPrompt: the rejection is stated in fixed words, not the producer\'s', () => {
  const pkg = {
    prompt: { text: 'q', hash: 'h', visibility: 'full_text' },
    queries: [
      {
        tool: 'get_data',
        operationType: 'query',
        arguments: { dataset_id: 'producer-text' },
        failed: true,
        failureKind: 'SENTINEL_PRODUCER_SUPPLIED_LABEL',
      },
    ],
    dataSources: [],
    cost: { model: 'm' },
    output: 'o',
  } as unknown as EvidencePackage;
  const prompt = buildEvaluationPrompt(pkg);
  assert.doesNotMatch(
    prompt,
    /SENTINEL_PRODUCER_SUPPLIED_LABEL/,
    'the producer\'s own failureKind text reached the evaluator prompt',
  );
  assert.match(lineFor(prompt, 'producer-text'), /reject|refus|fail/i);
});
