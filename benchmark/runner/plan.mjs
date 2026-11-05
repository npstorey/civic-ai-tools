// The estimated cost bounds of a step, from the request bodies it would send.
//
//   floor     prompts only, at 5 characters a token (an underestimate), no
//             completion tokens; the first request, and the request after a
//             load only where the question's smallest label (within the
//             row's directory) loads something, carrying that label;
//   ceiling   every completion at its full limit (4,000 tokens; reasoning
//             tokens are among them); the request after a load carrying the
//             larger of the question's largest label and the single entry of
//             the directory whose load adds most, plus each earlier response
//             at its full limit; in a search row, two searches of ten hits,
//             each adding the ten entries with the longest directory lines;
//   reserved  the sum of every row's reservation (bounds.mjs): the worst
//             case the cap is enforced against, with every directory entry
//             loaded and the largest possible echo of every response. Not an
//             estimate of spend: at most `concurrency` rows hold one at once,
//             and each is released when its row ends.
//
// Prompts are estimated at the reservation rate (2 characters a token until
// the probe calibrates it, then the calibrated rate per model) and priced at
// the dearest endpoint the request may land on (models.mjs), at the tier the
// 25% margin gives. A builder-N main row's directory is the builder's
// selection, unknown before the run: the bounds take the 25 entries whose
// directory lines are longest. Each token baseline (single-configuration runs
// only) counts its whole ladder.

import { MAX_TOKENS } from './app-texts.mjs';
import { estimateTokens, TIER_MARGIN, worstCostOver } from './pricing.mjs';
import { reservationOf, slotBounds } from './bounds.mjs';
import { baselineBody, baselineLadder, builderBody, plannedSecondBody, selectionBody } from './requests.mjs';
import { BM25 } from './search.mjs';
import { FIND_SOURCE_LIMIT } from './texts.mjs';

const FLOOR_CHARS_PER_TOKEN = 5;

/** Per directory: its entries ranked by what a load of each adds, and by
 *  directory line. */
const rankCache = new WeakMap();
async function ranks(session) {
  if (rankCache.has(session)) return rankCache.get(session);
  const rows = [];
  for (const id of session.offeredIds) {
    const dir = session.directoryFor([id]);
    const state = await dir.afterLoads([id]);
    const line = dir.system.length + JSON.stringify(dir.loadTool).length;
    rows.push({ id, line, adds: state.systemPrompt.length + JSON.stringify(state.tools).length - line });
  }
  const out = {
    byLine: [...rows].sort((a, b) => b.line - a.line || (a.id < b.id ? -1 : 1)).map((r) => r.id),
    byAdds: [...rows].sort((a, b) => b.adds - a.adds || (a.id < b.id ? -1 : 1)).map((r) => r.id),
  };
  rankCache.set(session, out);
  return out;
}

/** The directory a row of `kind` reads first, for question `q`. */
export async function rowDirectory({ session, kind, q, shortlister }) {
  if (kind === 'shortlist' || kind === 'search') return session.directoryFor(shortlister.shortlist(q.text).aliases.map((a) => session.entry(a).sourceId));
  if (kind === 'builder') {
    const r = await ranks(session);
    return session.directoryFor(r.byLine.slice(0, 25));
  }
  return session.full;
}

/** One step's bounds for one model (`mi`: the model, its pricings, its
 *  characters per token and context length). */
export async function stepBounds({ session, kind, mi, questions, repeats, shortlister, baselines = null }) {
  const p = mi.reservationPricings;
  const cpt = mi.cpt;
  const out = { calls: 0, floor: 0, ceiling: 0, completions: 0, reserved: 0, largestRow: 0 };
  // A request's worst cost; `rep` times its completion share is added to
  // `out.completions`, so the ceiling can be read as prompts plus completions.
  let rep = 1;
  const worst = (tokens, limit = MAX_TOKENS) => {
    const t = Math.min(tokens, mi.contextLength ?? Infinity);
    const all = worstCostOver(p, t, limit, TIER_MARGIN);
    out.completions += rep * (all - worstCostOver(p, t, 0, TIER_MARGIN));
    return all;
  };
  if (kind === 'rule') return out;
  const r = await ranks(session);
  for (const q of questions) {
    rep = repeats;
    if (kind === 'builder-read') {
      const body = builderBody(session.full, mi.m, q);
      const res = reservationOf(await slotBounds({ session, kind, dir: session.full, m: mi.m, q, cpt, contextLength: mi.contextLength }), p, TIER_MARGIN);
      out.calls += repeats;
      out.floor += repeats * worstCostOver(p, estimateTokens(body, FLOOR_CHARS_PER_TOKEN), 0, 0);
      out.ceiling += repeats * worst(estimateTokens(body, cpt));
      out.reserved += repeats * res.usd;
      out.largestRow = Math.max(out.largestRow, res.usd);
      continue;
    }
    const search = kind === 'search';
    const dir = await rowDirectory({ session, kind, q, shortlister });
    if (!dir.ids.length) continue;
    const body1 = selectionBody(dir, mi.m, q, { search });
    const labels = q.acceptable.map((set) => set.filter((a) => dir.has(a))).filter((s) => s.length);
    const largestSingle = r.byAdds.find((id) => dir.ids.includes(id));
    const candidates = [...labels, ...(largestSingle ? [[session.aliasOf(largestSingle)]] : [])];
    // The request after a load: in a search row, over the directory widened
    // by two searches.
    const wideIds = search ? [...dir.ids, ...r.byLine.filter((id) => !dir.ids.includes(id)).slice(0, FIND_SOURCE_LIMIT * BM25.top)] : dir.ids;
    const wide = session.directoryFor(wideIds);
    let largest = 0;
    for (const set of candidates) largest = Math.max(largest, JSON.stringify(await plannedSecondBody(wide, mi.m, q, set, { search })).length);
    let smallest = null;
    for (const set of labels) {
      const chars = JSON.stringify(await plannedSecondBody(dir, mi.m, q, set, { search })).length;
      smallest = smallest === null ? chars : Math.min(smallest, chars);
    }
    const rounds = search ? 1 + FIND_SOURCE_LIMIT : 1;
    let ceiling = worst(estimateTokens(body1, cpt));
    if (search) {
      const hits10 = session.directoryFor([...dir.ids, ...r.byLine.filter((id) => !dir.ids.includes(id)).slice(0, BM25.top)]);
      ceiling += worst(estimateTokens(selectionBody(hits10, mi.m, q, { search }), cpt) + MAX_TOKENS);
      ceiling += worst(estimateTokens(selectionBody(wide, mi.m, q, { search }), cpt) + 2 * MAX_TOKENS);
    }
    if (candidates.length) ceiling += worst(Math.ceil(largest / cpt) + rounds * MAX_TOKENS);
    const res = reservationOf(await slotBounds({ session, kind: search ? 'search' : 'main', dir, m: mi.m, q, cpt, contextLength: mi.contextLength }), p, TIER_MARGIN);
    out.calls += repeats * (search ? 2 + FIND_SOURCE_LIMIT : 2);
    out.ceiling += repeats * ceiling;
    out.floor += repeats * (worstCostOver(p, estimateTokens(body1, FLOOR_CHARS_PER_TOKEN), 0, 0) + (smallest === null ? 0 : worstCostOver(p, Math.floor(smallest / FLOOR_CHARS_PER_TOKEN), 0, 0)));
    out.reserved += repeats * res.usd;
    out.largestRow = Math.max(out.largestRow, res.usd);
  }
  if (baselines) {
    rep = 1;
    for (const b of Object.values(baselines)) {
      for (const step of baselineLadder(mi.m)) {
        const tokens = estimateTokens(baselineBody(mi.m, b, step.params), cpt);
        out.calls += 1;
        out.ceiling += worst(tokens, step.limit);
        out.reserved += worstCostOver(p, tokens, step.limit, TIER_MARGIN);
      }
      out.floor += worstCostOver(p, estimateTokens(baselineBody(mi.m, b, mi.m.params(1)), FLOOR_CHARS_PER_TOKEN), 0, 0);
    }
  }
  return out;
}
