// Adversarial evaluation — PURE core (RUBRIC group): the civic six-criterion
// rubric text, its pinned identifiers, the prompt builder, and the response
// parser. Relocated from civic-ai-tools-website
// `src/lib/evidence/adversarial-eval-core.ts:13, 24–55, 66–94` per the S2
// brief §1. The model runner and DB/blob emission (`adversarial-eval.ts`)
// stay app-side — this module never performs I/O.
//
// ⚠ RUBRIC_VERSION_SHA256 is a Q26-pinned version hash: attestations pin the
// exact prompt set that scored them by this value. The rubric text below is
// byte-exact with the reference implementation (the relocation changes no
// hashes), and the test suite asserts the literal digest. Any wording change
// to EVALUATION_RUBRIC is a NEW rubric version — never edit the text without
// versioning intent.

import {
  sha256Hex,
  type EvidencePackage,
  type EvaluationResults,
} from '@typedstandards/produce-core';

/** Rubric identifier carried as the `scoringRubric` payload field and the
 *  methodology `testSet`. Six criteria, 1-10 each, plus aggregate. */
export const RUBRIC_ID = 'civicaitools-adversarial-rubric/six-criterion-v1';

export const EVALUATION_CRITERIA = [
  'dataSourceIdentification',
  'quantitativeClaimSupport',
  'confoundersAndBias',
  'geographicScope',
  'limitationsNoted',
  'contradictoryConclusion',
] as const;

export const EVALUATION_RUBRIC = `You are an independent evaluator assessing an AI-generated civic data analysis.

You will receive:
1. The original prompt (question asked)
2. The tool calls made (MCP queries to Socrata open data portals)
3. The AI's final output/analysis

Evaluate the analysis against these 6 criteria, scoring each 1-10:

a) **Data Source Identification** (1-10): Does the output correctly identify the data source(s) and time period? Are dataset IDs, portal domains, and date ranges accurate?

b) **Quantitative Claim Support** (1-10): Are the quantitative claims (numbers, percentages, rankings) supported by the data returned in the tool calls? Cross-check key figures against the raw data.

c) **Confounders and Bias** (1-10): Does the analysis acknowledge obvious confounders, selection biases, or framing issues? Are there lurking variables or cherry-picked timeframes?

d) **Geographic Scope** (1-10): Is the geographic scope appropriate for the question? Does the analysis avoid over-generalizing from one jurisdiction?

e) **Limitations Noted** (1-10): Are limitations and caveats noted? Does the analysis flag data quality issues, missing fields, or incomplete coverage?

f) **Contradictory Conclusion** (1-10): Could the same data reasonably support a contradictory conclusion? Does the analysis consider alternative interpretations?

Respond in this exact JSON format (no markdown fences, just raw JSON):
{
  "dataSourceIdentification": { "score": <1-10>, "comment": "<1-2 sentences>" },
  "quantitativeClaimSupport": { "score": <1-10>, "comment": "<1-2 sentences>" },
  "confoundersAndBias": { "score": <1-10>, "comment": "<1-2 sentences>" },
  "geographicScope": { "score": <1-10>, "comment": "<1-2 sentences>" },
  "limitationsNoted": { "score": <1-10>, "comment": "<1-2 sentences>" },
  "contradictoryConclusion": { "score": <1-10>, "comment": "<1-2 sentences>" },
  "overallScore": <average of all 6 scores, one decimal>,
  "assessment": "<2-4 sentence overall assessment>"
}`;

/** The methodology's `promptSetVersion`: SHA-256 of the rubric text, computed
 *  once at module load. Any wording change to the rubric produces a new
 *  version, so an attestation pins the exact prompt set that scored it. */
export const RUBRIC_VERSION_SHA256 = sha256Hex(EVALUATION_RUBRIC);

/** Build the user-turn evaluation content from a package's signed fields. */
export function buildEvaluationPrompt(pkg: EvidencePackage): string {
  const toolCallSummary = pkg.queries
    .map((q, i) => {
      const argStr = Object.entries(q.arguments)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      return `  ${i + 1}. ${q.tool}(${argStr}) → ${q.resultRows ?? '?'} rows`;
    })
    .join('\n');

  const dataSources = pkg.dataSources
    .map(ds => `  - ${ds.datasetUrl} (accessed ${ds.accessTimestamp})`)
    .join('\n');

  return `## Original Prompt
${pkg.prompt.text || '[prompt text not available]'}

## Tool Calls Made (${pkg.queries.length} total)
${toolCallSummary || '  (none)'}

## Data Sources
${dataSources || '  (none)'}

## Model Used
${pkg.cost.model}

## AI Output
${pkg.output}`;
}

export type ParsedEvaluation =
  | { ok: true; results: EvaluationResults }
  | { ok: false; error: string; raw: string };

/**
 * Parse + validate an evaluator response into structured results. Pure —
 * unit-tested directly. Strips markdown fences (some models wrap despite the
 * instruction), requires every criterion with a numeric score, and recomputes
 * the aggregate when the model omits it.
 */
export function parseEvaluationResponse(raw: string): ParsedEvaluation {
  const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let parsed: Record<string, { score?: unknown; comment?: unknown }> & {
    overallScore?: unknown;
    assessment?: unknown;
  };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: 'Evaluator returned invalid JSON', raw };
  }

  const perCriterion: EvaluationResults['perCriterion'] = {};
  for (const key of EVALUATION_CRITERIA) {
    const entry = parsed[key];
    if (!entry || typeof entry.score !== 'number') {
      return { ok: false, error: `Missing or invalid rubric criterion: ${key}`, raw };
    }
    perCriterion[key] = {
      score: entry.score,
      comment: typeof entry.comment === 'string' ? entry.comment : '',
    };
  }

  const overallScore =
    typeof parsed.overallScore === 'number'
      ? parsed.overallScore
      : EVALUATION_CRITERIA.reduce((sum, k) => sum + perCriterion[k].score, 0) /
        EVALUATION_CRITERIA.length;

  return {
    ok: true,
    results: {
      perCriterion,
      overallScore,
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    },
  };
}
