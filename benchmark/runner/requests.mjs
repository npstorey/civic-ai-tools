// Request bodies, in the app's shape: `tool_choice: 'auto'`, no temperature,
// and the token limit and reasoning setting from `modelRequestParameters`
// (models.mjs adds an open-weight model's provider routing).

import { LOAD_RESULT_TEXT, MAX_TOKENS } from './app-texts.mjs';
import { BUILDER_SYSTEM, builderUserMessage, FIND_SOURCE_TOOL, SELECT_SOURCES_TOOL } from './texts.mjs';

const userMessage = (q) => ({ role: 'user', content: q.text });

/** A selection request: the directory `dir` as the system prompt,
 *  `load_source` (and `find_source` in a search row) the tools, the
 *  question, then the row's earlier messages. Its first is the first
 *  request. */
export const selectionBody = (dir, m, q, { search = false, history = [] } = {}) => ({
  model: m.slug,
  messages: [{ role: 'system', content: dir.system }, userMessage(q), ...history],
  tools: search ? [dir.loadTool, FIND_SOURCE_TOOL] : [dir.loadTool],
  tool_choice: 'auto',
  ...m.params(MAX_TOKENS),
});

/** The first request: the directory as the system prompt, `load_source` the
 *  only tool (`find_source` beside it in a search row). Takes a session (its
 *  full directory) or a directory. */
export const firstBody = (dirOrSession, m, q, opts = {}) => selectionBody(dirOrSession.full ?? dirOrSession, m, q, opts);

/** The request after a load: the selection request's messages with the
 *  system prompt replaced by the one after the loads (the app's
 *  `replaceSystemPrompt`), the model's message and the tool results; the
 *  tools after the loads (and `find_source` in a search row). */
export const secondBody = (m, body1, msg1, toolMessages, state, { search = false } = {}) => ({
  model: m.slug,
  messages: [{ role: 'system', content: state.systemPrompt }, ...body1.messages.slice(1), msg1, ...toolMessages],
  tools: search ? [...state.tools, FIND_SOURCE_TOOL] : state.tools,
  tool_choice: 'auto',
  ...m.params(MAX_TOKENS),
});

/** A request after a load, as it would be if the model loaded `aliases` and
 *  wrote nothing else: for the plan's bounds. */
export async function plannedSecondBody(dirOrSession, m, q, aliases, opts = {}) {
  const dir = dirOrSession.full ?? dirOrSession;
  const body1 = selectionBody(dir, m, q, opts);
  const msg1 = {
    role: 'assistant',
    content: null,
    tool_calls: aliases.map((alias, i) => ({ id: `call_${i}`, type: 'function', function: { name: 'load_source', arguments: JSON.stringify({ alias }) } })),
  };
  const toolMessages = aliases.map((alias, i) => ({ role: 'tool', tool_call_id: `call_${i}`, content: LOAD_RESULT_TEXT.loaded(alias) }));
  const ids = dir.ids.filter((id) => aliases.includes(dir.aliases[dir.ids.indexOf(id)]));
  const state = await dir.afterLoads(ids);
  return secondBody(m, body1, msg1, toolMessages, state, opts);
}

/** The builder's request: its system prompt, the question and the N-entry
 *  directory, `select_sources` the only tool. */
export const builderBody = (fullDir, m, q) => ({
  model: m.slug,
  messages: [
    { role: 'system', content: BUILDER_SYSTEM },
    { role: 'user', content: builderUserMessage(q.text, fullDir.system) },
  ],
  tools: [SELECT_SOURCES_TOOL],
  tool_choice: 'auto',
  ...m.params(MAX_TOKENS),
});

/** A token baseline's body: its system prompt and tools, and "Hello.". */
export const baselineBody = (m, baseline, params) => ({
  model: m.slug,
  messages: [{ role: 'system', content: baseline.system }, { role: 'user', content: 'Hello.' }],
  tools: baseline.tools,
  tool_choice: 'auto',
  ...params,
});

/** The baseline ladder (R5, chooser-spike.mjs:561-568): max tokens 1; where a
 *  model refuses that or returns no usage, 16; where it still refuses, 1
 *  without its reasoning setting. */
export const baselineLadder = (m) => [
  { limit: 1, params: m.params(1), note: 'max tokens 1, app parameters' },
  { limit: 16, params: m.params(16), note: 'max tokens 16, app parameters' },
  { limit: 1, params: { max_tokens: 1 }, note: 'max_tokens 1, no reasoning setting' },
];
