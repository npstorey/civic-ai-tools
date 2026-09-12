// Adversarial evaluation — PURE core (RUBRIC group): the civic six-criterion
// rubric text, its pinned identifiers, the prompt builder, and the response
// parser. Relocated from civic-ai-tools-website
// `src/lib/evidence/adversarial-eval-core.ts:13, 24–55, 66–94` per the S2
// brief §1. The model runner and DB/blob emission (`adversarial-eval.ts`)
// stay app-side — this module never performs I/O.
//
// ⚠ RUBRIC_VERSION_SHA256 is a Q26-pinned version hash over THE RUBRIC TEXT
// ALONE (`sha256Hex(EVALUATION_RUBRIC)`). It does NOT cover
// `buildEvaluationPrompt` below — the template that assembles the rubric with
// the package's tool calls, data sources and model into the turn the evaluator
// actually reads. So two evaluations either side of a change to that template
// carry the SAME `methodology.promptSetVersion` while the evaluator saw
// different inputs; civic-ai-tools#207 files that gap for the specification to
// settle, and this module does not resolve it. The rubric text below is
// byte-exact with the reference implementation (the relocation changes no
// hashes), and the test suite asserts the literal digest. Any wording change
// to EVALUATION_RUBRIC is a NEW rubric version — never edit the text without
// versioning intent.

import {
  sha256Hex,
  type RecordPackage,
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
 *  version, so an attestation pins the rubric WORDING that scored it — and
 *  that wording only. The prompt template around it (`buildEvaluationPrompt`)
 *  is outside this hash, so one value does not identify one set of evaluator
 *  inputs (civic-ai-tools#207). */
export const RUBRIC_VERSION_SHA256 = sha256Hex(EVALUATION_RUBRIC);

/** The outcome keys a producer records on a `queries[]` entry, declared HERE
 *  rather than imported. produce-core's `EnvelopeQuery` does not name them —
 *  the lockfile resolves 0.3.0, whose entry shape is `tool` / `operationType`
 *  / `arguments` / `datasetId` / `portal` / `duration_ms` / `resultRows` /
 *  `resultColumns` and nothing else. The harness already reads these keys off
 *  its own locally-declared shape in `capture/data-sources.ts`
 *  (`ToolCallSummary.failed`), and this module follows that precedent, so
 *  reading them here needs no lockfile bump, no manifest change and no new
 *  dependency (civic-ai-tools#203).
 *
 *  ABSENCE IS ABSENCE. `failed` is the assertion. A producer that records no
 *  outcome passes neither key and gets exactly the rendering it got before the
 *  fields existed; absence means "not recorded as failed", never "succeeded".
 *
 *  `failureKind` is the producer's own open-vocabulary label for a rejection.
 *  It is declared so this shape describes what an entry can carry, and it is
 *  DELIBERATELY NOT RENDERED: it is producer-controlled text, and the turn
 *  built here is read by a model whose score becomes a signed attestation, so
 *  the rejection is stated in this module's own fixed words instead. `failed`
 *  is the assertion and `failureKind` only a label on one — an entry carrying
 *  a kind but no `failed` is NOT a rejection, which is the harness's own rule
 *  as stated at `capture/data-sources.ts`. */
interface RecordedCallOutcome {
  failed?: boolean;
  failureKind?: string;
}

/** Did the producer record this entry as REJECTED by the source? Only a
 *  literal `failed: true` is a rejection (see `RecordedCallOutcome`). */
function wasRecordedRejected(query: RecordPackage['queries'][number]): boolean {
  return (query as typeof query & RecordedCallOutcome).failed === true;
}

/** What the evaluator is told about a call the source rejected. A FIXED
 *  string: it interpolates nothing the producer wrote, and it claims no row
 *  count — there were no rows to count, which is neither "zero rows" nor "an
 *  unknown number of rows". The rubric asks the evaluator to cross-check
 *  figures against the data returned in the tool calls, so a rejected call
 *  reading `→ ? rows` invited it to treat absent data as merely unrecorded
 *  (civic-ai-tools#203). */
const REJECTED_CALL_RENDERING =
  'REJECTED by the source — no data was returned, and no row count is claimed';

/** Build the user-turn evaluation content from a package's signed fields.
 *  Takes `RecordPackage` — produce-core 0.3.0's settlement-era name for the
 *  same object (spec Appendix J, migration class alias-and-deprecate). The
 *  prior name is a deprecated alias of this exact type upstream, so existing
 *  callers still compile unchanged. */
export function buildEvaluationPrompt(pkg: RecordPackage): string {
  const toolCallSummary = pkg.queries
    .map((q, i) => {
      const argStr = Object.entries(q.arguments)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      const outcome = wasRecordedRejected(q)
        ? REJECTED_CALL_RENDERING
        : `${q.resultRows ?? '?'} rows`;
      return `  ${i + 1}. ${q.tool}(${argStr}) → ${outcome}`;
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
