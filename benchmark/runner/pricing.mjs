// Prices, the reservation estimate, and what a call cost.
//
// PRICES are held as OpenRouter lists them, converted once: every per-token
// price becomes a decimal string in US dollars per MILLION tokens, by an exact
// shift of the decimal point (no float arithmetic), so `"0.0000001"` a token is
// `"0.1"` a million. A per-token price such as $0.000000625 needs nine places,
// which the digit-run convention's eight would round; per million it needs
// three. `web_search` and `request` are prices per call and are kept as listed.
//
// THE RESERVATION ESTIMATE ERRS HIGH (anchor P0 rules; R14, R17). R5 estimated
// a prompt at 3 characters a token and priced the tier from that estimate;
// Anthropic billed R5's first request at 1.23 times that estimate, so a Haiku
// prompt just over 100,000 billed tokens could have been reserved at the lower
// tier. Here a prompt is estimated at 2 characters a token until the probe
// calibrates it, and any request whose estimate is within 25% of a tier
// threshold is reserved at the higher tier.

/** Characters per token until a probe calibrates the estimate. */
export const CHARS_PER_TOKEN_DEFAULT = 2;

/** A request whose estimate is at least (1 - margin) of a tier's threshold is
 *  reserved at that tier. */
export const TIER_MARGIN = 0.25;

/** Fields priced per call, not per token. */
const PER_CALL = new Set(['web_search', 'request']);

/** A decimal string times 10^places, exactly, by moving its point:
 *  `"0.0000001"`, 6 → `"0.1"`. */
export function shiftDecimal(text, places) {
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(String(text).trim());
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) throw new Error(`shiftDecimal: not a decimal string: ${text}`);
  const [, sign, int, frac = ''] = m;
  const digits = int + frac;
  const point = int.length + places;
  const padded = point > digits.length ? digits + '0'.repeat(point - digits.length) : digits;
  let whole = padded.slice(0, point).replace(/^0+(?=\d)/, '') || '0';
  let fraction = padded.slice(point).replace(/0+$/, '');
  if (point <= 0) {
    whole = '0';
    fraction = ('0'.repeat(-point) + digits).replace(/0+$/, '');
  }
  const out = fraction ? `${whole}.${fraction}` : whole;
  return sign && out !== '0' ? `-${out}` : out;
}

/** One model's OpenRouter `pricing` object with its per-token prices written
 *  per million tokens; overrides likewise. Numbers (a tier's
 *  `min_prompt_tokens`) are kept. */
export function pricingPerMillion(pricing) {
  const convert = (obj) =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (k === 'overrides' && Array.isArray(v)) return [k, v.map(convert)];
        if (typeof v === 'string' && !PER_CALL.has(k)) return [k, shiftDecimal(v, 6)];
        return [k, v];
      }),
    );
  return { unit: 'USD per million tokens; web_search and request USD per call, as listed', ...convert(pricing) };
}

/** Per-token prices for a prompt of `promptTokens`, from a per-million pricing
 *  object. With `margin`, a tier applies from (1 - margin) of its threshold. */
export function priceFor(pricing, promptTokens, margin = 0) {
  let tier = { prompt: pricing.prompt, completion: pricing.completion, input_cache_read: pricing.input_cache_read };
  for (const o of pricing.overrides ?? []) {
    const threshold = o.min_prompt_tokens ?? Infinity;
    if (promptTokens >= threshold * (1 - margin)) tier = { ...tier, ...o };
  }
  const perToken = (perMillion) => Number(perMillion) / 1e6;
  return { in: perToken(tier.prompt), out: perToken(tier.completion), cacheRead: perToken(tier.input_cache_read ?? tier.prompt) };
}

/** The estimated prompt tokens of a request body. */
export const estimateTokens = (body, charsPerToken = CHARS_PER_TOKEN_DEFAULT) => Math.ceil(JSON.stringify(body).length / charsPerToken);

/** The worst-case cost of a request: its estimated prompt, priced at the tier
 *  the margin gives, plus every completion token its limit allows. */
export function worstCost(pricing, promptTokens, completionLimit, margin = TIER_MARGIN) {
  const price = priceFor(pricing, promptTokens, margin);
  return promptTokens * price.in + completionLimit * price.out;
}

/** What a call cost, from the usage it returned: computed from the listed
 *  prices at the tier its billed prompt falls in, and as OpenRouter reported
 *  it. With no usage, nothing is known. */
export function costOfUsage(pricing, usage) {
  if (!usage) return { computed: 0, reported: null };
  const prompt = usage.prompt_tokens ?? 0;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const price = priceFor(pricing, prompt);
  const computed = (prompt - cached) * price.in + cached * price.cacheRead + (usage.completion_tokens ?? 0) * price.out;
  return { computed, reported: typeof usage.cost === 'number' ? usage.cost : null };
}

/** The worst case over several pricing objects: a request that may land on
 *  any of several endpoints is reserved at the dearest (models.mjs). */
export function worstCostOver(pricings, promptTokens, completionLimit, margin = TIER_MARGIN) {
  return Math.max(...pricings.map((p) => worstCost(p, promptTokens, completionLimit, margin)));
}

/** What a call cost: as `costOfUsage`, and the amount the run charges to its
 *  spend. With usage, the larger of the cost at the listed price and the cost
 *  OpenRouter reported; when no cost was reported, the larger of the listed
 *  price's and the dearest endpoint's. With no usage, the reservation. */
export function chargeOf(listPricing, reservationPricings, usage, reservedUsd) {
  const cost = costOfUsage(listPricing, usage);
  if (!usage) return { ...cost, charged: reservedUsd, chargedAs: 'reservation (no usage returned)' };
  if (cost.reported !== null) return { ...cost, charged: Math.max(cost.computed, cost.reported), chargedAs: 'larger of computed and reported' };
  const dearest = Math.max(cost.computed, ...reservationPricings.map((p) => costOfUsage(p, usage).computed));
  return { ...cost, charged: dearest, chargedAs: 'dearest endpoint (no cost reported)' };
}
