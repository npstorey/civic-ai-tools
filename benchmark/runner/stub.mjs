// The stub transport (S3-C; benchmark/preregistration/s3c.md, "The stub
// transport"; design §2.7): so that a row ends in an answer, every call of a
// loaded source's tool is answered with one fixed result. No source is called.
//
// A STUB ROW IS AN S1 ROW THAT GOES ON. Through S1's last request (the request
// after the loads; in a row that loaded nothing, its last selection request)
// the row is built, answered, scored and recorded as S1's runner does it
// (engine.mjs). Then, from the response to S1's last request:
//
//   1. while the latest response has tool calls and the bound allows another
//      request, each unanswered call is answered, in order, by `answerOf`'s
//      table, and the next request is sent: the app's (the router's prompt
//      over the row's directory and loaded sources, or the directory's own
//      prompt while nothing is loaded; `load_source`, the loaded sources'
//      tools and, with search, `find_source`; every earlier message);
//   2. a request whose body's JSON is longer than `STUB_BODY_LIMIT`
//      characters is not sent, and the row ends with no answer;
//   3. at most `STUB_MAX_REQUESTS` requests are sent after S1's last; then,
//      or after a response with no tool call and no text, or one that
//      announces work it did not do (app-texts.mjs, `announcesWork`), the
//      answering turn: the row's messages and the app's final-answer request,
//      with no tools. Whatever it returns ends the row.
//
// The stub reads no argument, opens no socket and calls no `fetch`: it is a
// text, matched by the call's name alone.

import { FINAL_ANSWER_REQUEST, MAX_TOKENS } from './app-texts.mjs';

/** The stub's result: every call of a loaded source's tool gets this text. */
export const STUB_RESULT_TEXT = 'The call ran and returned no rows.';

/** A row's loop sends at most this many requests after S1's last. */
export const STUB_MAX_REQUESTS = 6;

/** A request after S1's last whose body's JSON is longer than this many
 *  characters is not sent; the row ends there with no answer. */
export const STUB_BODY_LIMIT = 120_000;

/** The stub's slots: the requests a row may send after S1's last, the loop's
 *  and the answering request. Each is reserved at a prompt of
 *  `STUB_BODY_LIMIT` characters (bounds.mjs, `stubSlotBounds`). */
export const STUB_SLOTS = STUB_MAX_REQUESTS + 1;

/** The transport a plan step names to run its rows on to an answer. */
export const STUB_TRANSPORT = 'stub';

/** What answered a call after S1's last request. */
export const ANSWERED_BY = Object.freeze(['stub', 'load', 'search', 'limit', 'unknown', 'unrun']);

/** How a stub row ends (`stub.endedBy`). */
export const ENDED_BY = Object.freeze(['answer', 'answering-turn', 'size', 'error']);

/** Why the answering turn was taken (`stub.answeringReason`). */
export const ANSWERING_REASONS = Object.freeze(['bound', 'empty', 'announcement']);

/** A response's text: its `content` when a string, the text parts when a
 *  list, else ''. */
export function textOf(msg) {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : typeof p?.text === 'string' ? p.text : '')).join('');
  return '';
}

/** A request of the loop, in the app's shape: the system prompt, the
 *  conversation so far, the tools, `tool_choice: 'auto'` and the model's
 *  parameters (S1's key order, requests.mjs). */
export const stubBody = (m, system, conversation, tools) => ({
  model: m.slug,
  messages: [{ role: 'system', content: system }, ...conversation],
  tools,
  tool_choice: 'auto',
  ...m.params(MAX_TOKENS),
});

/** The answering request: the row's messages, then a user message holding
 *  the final-answer request; no `tools` and no `tool_choice`. */
export const answeringBody = (m, system, conversation) => ({
  model: m.slug,
  messages: [{ role: 'system', content: system }, ...conversation, { role: 'user', content: FINAL_ANSWER_REQUEST }],
  ...m.params(MAX_TOKENS),
});

/** The tool-result message for a call. */
export const toolMessage = (id, content) => ({ role: 'tool', tool_call_id: id, content });
