// The benchmark's own fixed texts: every text a model reads that neither the
// router nor the website composes. `find_source` (`shortlist+search-N`) and
// the builder (`builder-N`) exist in no app yet (S3 builds the first; the
// second is a yardstick configuration), so their tools and texts are written
// here, once, and the preregistration (benchmark/preregistration/s1.md)
// quotes each word for word; a test holds the two equal.

// --- find_source (shortlist+search-N) -------------------------------------------

/** The search tool, beside `load_source` on every selection request of a
 *  `shortlist+search-N` row. */
export const FIND_SOURCE_TOOL = Object.freeze({
  type: 'function',
  function: {
    name: 'find_source',
    description:
      "Search every source this assistant can load, including sources the directory does not list, by what they hold and where. Returns up to 10 sources, best match first, and adds them to the directory and to load_source's choices for your next turn. Use it when no source in the directory fits the question.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The records the question needs and the place they are for, in a few words.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
});

/** At most this many `find_source` calls a row are run. */
export const FIND_SOURCE_LIMIT = 2;

/** What a `find_source` call returns. */
export const FIND_SOURCE_TEXT = Object.freeze({
  found: (aliases) =>
    `Found ${aliases.length} ${aliases.length === 1 ? 'source' : 'sources'}, best match first: ${aliases.map((a) => `\`${a}\``).join(', ')}. Each is now listed in the directory in the system prompt, and load_source accepts its alias on your next turn.`,
  none: 'No source matched that search. The directory is unchanged.',
  limit: 'The search limit for this question is reached: find_source runs at most twice. Load a source from the directory, or answer without one.',
});

// --- The builder (builder-N) --------------------------------------------------

/** The builder's system prompt. */
export const BUILDER_SYSTEM =
  'You choose which sources an assistant will see before it answers a question about public records. The assistant can load only the sources you choose, and it sees at most 25. The user message holds the question, then a line of three dashes, then the directory of every source, written for that assistant (it tells the assistant to load sources; you do not load anything). Call select_sources once with the aliases of the sources that could hold the records the question needs, best first, at most 25. Choose none when the question needs no data source. Do not answer the question.';

/** The builder's user message: the question, the separator, the directory. */
export const builderUserMessage = (question, directory) => `${question}\n\n---\n\n${directory}`;

/** The builder's one tool. */
export const SELECT_SOURCES_TOOL = Object.freeze({
  type: 'function',
  function: {
    name: 'select_sources',
    description: 'Choose the sources the assistant will see: at most 25 aliases from the directory, best first. An empty list means the question needs no source.',
    parameters: {
      type: 'object',
      properties: {
        aliases: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 25,
          description: 'Aliases exactly as the directory writes them, best first.',
        },
      },
      required: ['aliases'],
      additionalProperties: false,
    },
  },
});

/** The builder's output rule, as the preregistration states it. */
export const BUILDER_OUTPUT_RULE =
  "The selection is the `aliases` argument of the response's first `select_sources` call, read in order: an alias of the inventory is kept the first time it appears and ignored after; any value that is not an alias of the inventory is dropped and recorded; the first 25 kept are the selection. A response with no `select_sources` call, or whose arguments do not parse to an object with an `aliases` array, gives an empty selection, recorded as such. A main row whose selection is empty sends no request: nothing is offered, so nothing can be loaded, and the row is complete with no load.";
