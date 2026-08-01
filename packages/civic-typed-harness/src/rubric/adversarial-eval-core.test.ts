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
import type { EvidencePackage } from '@typedstandards/produce-core';

/** The reference implementation's rubric version hash. Byte-exact preservation
 *  is a G0 decision (decision 4): moving the rubric changes no hashes. */
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
