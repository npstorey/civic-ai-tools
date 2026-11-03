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
