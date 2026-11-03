// The estimated cost bounds of a run, from the request bodies it would send.
//
//   floor    prompts only, at 5 characters a token (an underestimate), no
//            completion tokens; a second request only where the question's
//            smallest label loads something, carrying that label;
//   ceiling  every completion at its full limit; every second request carrying
//            the larger of the question's largest label and the largest single
//            source, plus the first response at its full limit (the second
//            request carries the model's first message);
//   hard     as the ceiling, with every second request carrying every source
//            in the directory.
// Prompts are estimated at the reservation rate (2 characters a token until a
// probe calibrates it) and priced at the tier the 25% margin gives. Each
// baseline counts its whole ladder (three calls) in the ceiling.

import { MAX_TOKENS } from './app-texts.mjs';
import { estimateTokens, TIER_MARGIN, worstCost } from './pricing.mjs';
import { baselineBody, baselineLadder, firstBody, plannedSecondBody } from './requests.mjs';

const FLOOR_CHARS_PER_TOKEN = 5;

export async function planBounds({ session, models, questions, repeats, pricing, charsPerToken, margin = TIER_MARGIN }) {
  const inDirectory = (set) => set.filter((alias) => session.entryByAlias(alias));
  const sizes = new Map();
  const secondChars = async (m, q, aliases) => {
    const key = `${m.spec}|${q.id}|${[...aliases].sort().join(',')}`;
    if (!sizes.has(key)) sizes.set(key, JSON.stringify(await plannedSecondBody(session, m, q, aliases)).length);
    return sizes.get(key);
  };
  const baselines = await session.baselines();
  const perModel = [];
  for (const m of models) {
    const p = pricing[m.slug];
    let calls = 0;
    let floor = 0;
    let ceiling = 0;
    let hard = 0;
    for (const q of questions) {
      const first = estimateTokens(firstBody(session, m, q), charsPerToken);
      const firstFloor = estimateTokens(firstBody(session, m, q), FLOOR_CHARS_PER_TOKEN);
      const labels = q.acceptable.map(inDirectory).filter((s) => s.length);
      const candidates = [...labels, ...session.directoryAliases.map((a) => [a])];
      let largest = 0;
      for (const set of candidates) largest = Math.max(largest, await secondChars(m, q, set));
      const all = await secondChars(m, q, session.directoryAliases);
      const second = Math.ceil(largest / charsPerToken) + MAX_TOKENS;
      const secondAll = Math.ceil(all / charsPerToken) + MAX_TOKENS;
      let smallest = null;
      for (const set of labels) {
        const chars = await secondChars(m, q, set);
        smallest = smallest === null ? chars : Math.min(smallest, chars);
      }
      calls += 2 * repeats;
      ceiling += repeats * (worstCost(p, first, MAX_TOKENS, margin) + worstCost(p, second, MAX_TOKENS, margin));
      hard += repeats * (worstCost(p, first, MAX_TOKENS, margin) + worstCost(p, secondAll, MAX_TOKENS, margin));
      floor += repeats * (worstCost(p, firstFloor, 0, 0) + (smallest === null ? 0 : worstCost(p, Math.floor(smallest / FLOOR_CHARS_PER_TOKEN), 0, 0)));
    }
    for (const b of Object.values(baselines)) {
      for (const step of baselineLadder(m)) {
        const tokens = estimateTokens(baselineBody(m, b, step.params), charsPerToken);
        calls += 1;
        ceiling += worstCost(p, tokens, step.limit, margin);
        hard += worstCost(p, tokens, step.limit, margin);
      }
      floor += worstCost(p, estimateTokens(baselineBody(m, b, m.params(1)), FLOOR_CHARS_PER_TOKEN), 0, 0);
    }
    perModel.push({ spec: m.spec, slug: m.slug, calls, floor, ceiling, hard });
  }
  const total = perModel.reduce((t, x) => ({ calls: t.calls + x.calls, floor: t.floor + x.floor, ceiling: t.ceiling + x.ceiling, hard: t.hard + x.hard }), { calls: 0, floor: 0, ceiling: 0, hard: 0 });
  return { perModel, total };
}
