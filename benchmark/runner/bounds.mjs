// A row's worst case, request by request (A3.2), and a step's estimated
// bounds for the dry run.
//
// THE RESERVATION. Before a row's first request the runner reserves the worst
// case of every request its configuration allows: two for a `baseline-7`,
// `flat-N`, `shortlist-N` or `builder-N` main row (the selection request and
// the request after a load), four for a `shortlist+search-N` row (three
// selection requests, so two searches can each be followed by one, and the
// request after a load), one for a builder row. Each request's worst case is
// its prompt bound, estimated at the calibrated characters per token (2 until
// the probe calibrates it), priced at the dearest endpoint the request may
// land on at the tier the 25% margin gives, plus the completion at its full
// limit (4,000 tokens; a model's reasoning tokens are among them).
//
// A PROMPT BOUND is exact for a request whose body is known before the row
// starts (a first request, a builder request) and, for a later request, the
// body at its largest:
//
//   - its directory: the row's directory, and in a search row the 20 entries
//     outside it whose directory lines are longest (two searches of ten
//     hits); after a load, every entry of that directory loaded (for the
//     search row's last request, the 20 entries whose loaded state is
//     largest), composed through the router;
//   - for each earlier response: the response itself at its full limit, the
//     tool names and call ids it wrote at their full limit again, and one
//     tool result per call, at most `MAX_CALLS` calls (a tool call is taken
//     to cost at least `TOOL_CALL_MIN_TOKENS` completion tokens), each the
//     longest fixed result text the row can return;
//   - and never more than the model's context length, since no endpoint
//     bills a prompt it cannot read.
//
// A request whose own worst case (from its actual body) passes its slot's
// bound tops the reservation up when the cap allows, and otherwise stops the
// run before it is sent (engine.mjs); neither is expected.

import { LOAD_RESULT_TEXT, MAX_TOKENS, UNKNOWN_TOOL_TEXT } from './app-texts.mjs';
import { REGISTRY_LOAD_TEXT } from '../inventories/load-text.mjs';
import { estimateTokens, worstCostOver } from './pricing.mjs';
import { builderBody, plannedSecondBody, selectionBody } from './requests.mjs';
import { FIND_SOURCE_TEXT, FIND_SOURCE_TOOL } from './texts.mjs';
import { BM25 } from './search.mjs';
import { FIND_SOURCE_LIMIT } from './texts.mjs';

/** A tool call is taken to cost at least this many completion tokens. */
export const TOOL_CALL_MIN_TOKENS = 8;

/** So a response holds at most this many tool calls. */
export const MAX_CALLS = Math.floor(MAX_TOKENS / TOOL_CALL_MIN_TOKENS);

/** Characters a tool-result message adds beyond its text (its JSON frame). */
const TOOL_MESSAGE_FRAME = 64;

/** The requests a row of each kind may send. */
export const REQUESTS_PER_ROW = Object.freeze({ baseline: 2, flat: 2, shortlist: 2, builder: 2, search: 2 + FIND_SOURCE_LIMIT, rule: 0, 'builder-read': 1 });

/** The largest single entries of a session, for the bounds: per entry, its
 *  directory over it alone and its state after loading it alone. */
const sizeCache = new WeakMap();
async function entrySizes(session) {
  if (sizeCache.has(session)) return sizeCache.get(session);
  const rows = [];
  for (const id of session.offeredIds) {
    const dir = session.directoryFor([id]);
    const state = await dir.afterLoads([id]);
    rows.push({ id, line: dir.system.length + JSON.stringify(dir.loadTool).length, loaded: state.systemPrompt.length + JSON.stringify(state.tools).length });
  }
  const out = {
    byLine: [...rows].sort((a, b) => b.line - a.line || (a.id < b.id ? -1 : 1)).map((r) => r.id),
    byLoaded: [...rows].sort((a, b) => b.loaded - a.loaded || (a.id < b.id ? -1 : 1)).map((r) => r.id),
  };
  sizeCache.set(session, out);
  return out;
}

const top = (ranked, exclude, n) => ranked.filter((id) => !exclude.includes(id)).slice(0, n);

/** The longest fixed text a tool call in this session's rows can return. */
function longestResultChars(session) {
  const longestAlias = Math.max(...session.directoryAliases.map((a) => a.length), ...session.offeredIds.map((id) => session.aliasOf(id).length));
  const alias = 'x'.repeat(longestAlias);
  return Math.max(
    LOAD_RESULT_TEXT.loaded(alias).length,
    LOAD_RESULT_TEXT.alreadyLoaded(alias).length,
    LOAD_RESULT_TEXT.notOffered.length,
    REGISTRY_LOAD_TEXT.length,
    UNKNOWN_TOOL_TEXT('').length,
    FIND_SOURCE_TEXT.found(Array.from({ length: BM25.top }, () => alias)).length,
    FIND_SOURCE_TEXT.none.length,
    FIND_SOURCE_TEXT.limit.length,
  );
}

/** Tokens an earlier response can add to a later request. */
const echoTokens = (session, cpt) => 3 * MAX_TOKENS + MAX_CALLS * Math.ceil((longestResultChars(session) + TOOL_MESSAGE_FRAME) / cpt);

/** The prompt bounds, in tokens, of each request a row may send, in order.
 *  `dir` is the row's directory (for a builder read, the full one). */
export async function slotBounds({ session, kind, dir, m, q, cpt, contextLength }) {
  const cap = (tokens) => Math.min(tokens, contextLength ?? Infinity);
  const est = (body) => estimateTokens(body, cpt);
  if (kind === 'rule') return [];
  if (kind === 'builder-read') return [cap(est(builderBody(session.full, m, q)))];
  const search = kind === 'search';
  const first = est(selectionBody(dir, m, q, { search }));
  if (!search) {
    const all = await plannedSecondBody(dir, m, q, dir.aliases);
    return [cap(first), cap(est(all) + echoTokens(session, cpt))];
  }
  const sizes = await entrySizes(session);
  const wide = session.directoryFor([...dir.ids, ...top(sizes.byLine, dir.ids, 2 * BM25.top)]);
  const wideBody = selectionBody(wide, m, q, { search });
  const loadedWide = session.directoryFor([...dir.ids, ...top(sizes.byLoaded, dir.ids, 2 * BM25.top)]);
  const after = await plannedSecondBody(loadedWide, m, q, loadedWide.aliases, { search });
  const echo = echoTokens(session, cpt);
  return [cap(first), cap(est(wideBody) + echo), cap(est(wideBody) + 2 * echo), cap(est(after) + 3 * echo)];
}

/** A row's reservation: the worst case of each of its requests, summed. */
export function reservationOf(bounds, pricings, margin) {
  const perRequest = bounds.map((tokens) => worstCostOver(pricings, tokens, MAX_TOKENS, margin));
  return { perRequest, usd: perRequest.reduce((s, x) => s + x, 0) };
}

export { FIND_SOURCE_TOOL };
