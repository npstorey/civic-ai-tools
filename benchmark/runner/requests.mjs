// Request bodies, in the app's shape: `tool_choice: 'auto'`, no temperature,
// and the token limit and reasoning setting from `modelRequestParameters`.

import { MAX_TOKENS } from './app-texts.mjs';

const userMessage = (q) => ({ role: 'user', content: q.text });

/** The first request: the directory as the system prompt, `load_source` the
 *  only tool. */
export const firstBody = (session, m, q) => ({
  model: m.slug,
  messages: [{ role: 'system', content: session.firstSystem }, userMessage(q)],
  tools: [session.loadTool],
  tool_choice: 'auto',
  ...m.params(MAX_TOKENS),
});

/** The second request: the first's messages with the system prompt replaced
 *  by the one after the loads (the app's `replaceSystemPrompt`), the model's
 *  message and the load results; the tools after the loads. */
export const secondBody = (m, body1, msg1, toolMessages, state) => ({
  model: m.slug,
  messages: [{ role: 'system', content: state.systemPrompt }, ...body1.messages.slice(1), msg1, ...toolMessages],
  tools: state.tools,
  tool_choice: 'auto',
  ...m.params(MAX_TOKENS),
});

/** A second request as it would be if the model loaded `aliases` and wrote
 *  nothing else: for the plan's bounds. */
export async function plannedSecondBody(session, m, q, aliases) {
  const body1 = firstBody(session, m, q);
  const msg1 = {
    role: 'assistant',
    content: null,
    tool_calls: aliases.map((alias, i) => ({ id: `call_${i}`, type: 'function', function: { name: 'load_source', arguments: JSON.stringify({ alias }) } })),
  };
  const toolMessages = aliases.map((alias, i) => ({ role: 'tool', tool_call_id: `call_${i}`, content: session.loadResultText.loaded(alias) }));
  const state = await session.afterLoads(aliases.map((a) => session.entryByAlias(a).sourceId));
  return secondBody(m, body1, msg1, toolMessages, state);
}

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
