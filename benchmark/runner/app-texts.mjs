// The website's texts and settings an in-loop run depends on, pinned with
// where each was copied from. The runner builds every other text through the
// router (`@typedstandards/civic-typed-router`, from the workspace).
//
// Source: npstorey/civic-ai-tools-website at 8559002; routing-mode.ts is
// identical at d745bd9.

export const APP_SOURCE = Object.freeze({
  repository: 'npstorey/civic-ai-tools-website',
  commit: '85590020eae4ab72795afd7e8e6cd81589e8ac23',
  routingMode: Object.freeze({ path: 'src/lib/mcp/routing-mode.ts', sha256: 'db796ba0805f074c9f0887722c2a8556784c8762130264375d2fbd06fdab19a1' }),
});

/** What the model is told a load did (`LOAD_RESULT_TEXT`, routing-mode.ts
 *  :124-141). The declined and no-answer texts are not copied: the benchmark
 *  loads every listed source as an On source (no consent pause). */
export const LOAD_RESULT_TEXT = Object.freeze({
  loaded: (alias) => `Loaded ${alias}. Its tools are added for your next turn, and its guidance now appears in the system prompt.`,
  alreadyLoaded: (alias) => `${alias} is already loaded. Its tools and its guidance are unchanged.`,
  notOffered: 'No source in the directory has that alias, so nothing was loaded. Call load_source with an alias the directory lists.',
});

/** The tool loop's completion limit (`DEFAULT_MAX_TOKENS`,
 *  src/lib/model-loop/run-tool-loop.ts:304). */
export const MAX_TOKENS = 4000;

/** What R5's runner answered to a call of any tool but `load_source` on the
 *  first request (chooser-spike.mjs:446). The app refuses such a call through
 *  its tool dispatch instead; the benchmark keeps R5's text, and the README
 *  names the difference. */
export const UNKNOWN_TOOL_TEXT = (name) => `Error: unknown tool ${name}. Load a source with load_source first.`;

// --- The round's app texts (S3-C; benchmark/preregistration/s3c.md, "The texts, one place each") ---
//
// Copied from npstorey/civic-ai-tools-website at 1623bf1, the tool loop
// (`APP_LOOP_SOURCE`), for the stub transport's requests after S1's last
// (stub.mjs, engine.mjs). The preregistration quotes each word for word.

export const APP_LOOP_SOURCE = Object.freeze({
  repository: 'npstorey/civic-ai-tools-website',
  commit: '1623bf167c00352062832d38b580d01072d5b374',
  path: 'src/lib/model-loop/run-tool-loop.ts',
  sha256: '8707781231feb88e662836aade90b5b199372d7c30dab535b7df0bc4fad4169b',
});

/** The app's note for a tool call that was not run (run-tool-loop.ts
 *  :457-458): the answer to every call still pending when the loop's bound
 *  is reached. */
export const UNRUN_TOOL_CALL_NOTE =
  "This tool call was not run: the tool-call limit for this query was reached.";

/** The app's final-answer request (run-tool-loop.ts:438-444): the user
 *  message of the answering turn. */
export const FINAL_ANSWER_REQUEST =
  "This is the final turn: no further tool calls will be made, and what you write now is the published answer. Answer my original question using only the data already collected above. Do not describe a query you plan to run or a step you intend to take next — a statement of intent is not an answer. State the findings themselves, and cite the source of each figure (dataset ID, variable DCID plus source dataset, or resource UUID plus dataset title). If the data collected is not enough to answer, say so plainly and state what it does show.";

/** The app's test for a response that announces work it did not do
 *  (run-tool-loop.ts:394-417): its trimmed text is shorter than
 *  `ANNOUNCEMENT_MAX_CHARS` and matches `DATA_STEP_COMMITMENT`. */
export const ANNOUNCEMENT_MAX_CHARS = 600;
export const DATA_STEP_COMMITMENT =
  /(?:\bi['’]?ll\b|\bi\s+will\b|\bi['’]?m\s+going\s+to\b|\bi\s+am\s+going\s+to\b|\bi\s+need\s+to\b|\bi\s+plan\s+to\b|\bi\s+intend\s+to\b|\bi['’]?m\s+about\s+to\b|\bi\s+am\s+about\s+to\b|\blet\s+me\b(?!\s+know)|\blet['’]?s\b|\bnext,?\s+i\b|\bnow\s+i\b|\bthen\s+i\b)(?:\s+\w+){0,2}\s+(?:quer(?:y|ies|ying)|fetch(?:ing)?|retriev\w*|re-?run(?:ning)?|run(?:ning)?|pull(?:ing)?|request(?:ing)?|check(?:ing)?|search(?:ing)?|count(?:ing)?|calculat\w*|comput\w*|analyz\w*|analys\w*|examin\w*|inspect(?:ing)?|compar\w*|aggregat\w*|cross-?\s?referenc\w*|look(?:ing)?\s+(?:at|up|into))\b/i;

/** Whether a response's text announces work it did not do, by the app's
 *  test. */
export function announcesWork(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return trimmed.length < ANNOUNCEMENT_MAX_CHARS && DATA_STEP_COMMITMENT.test(trimmed);
}
