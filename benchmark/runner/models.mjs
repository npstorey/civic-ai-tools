// The models S1 runs and the request parameters each is sent with (G0-3b;
// the seat's record, hub #302 comment 6615311402).
//
//   - Haiku 5.5 at low, as the pinned catalog sets it (`catalog.mjs`): the
//     app's own request, with no provider routing.
//   - One open-weight model, chosen at G3 by the open-weight probe from the
//     three candidates below (the alternate stands in only if the seat names
//     it). Each is sent:
//       * no temperature (none of the four requires one);
//       * `max_tokens`, the one token-limit field each lists (none lists
//         `max_completion_tokens`, which the catalog's rule would pick for a
//         model with a reasoning setting), at the app's limit (4,000);
//       * THE REASONING SETTING: the lowest effort the model lists, matching
//         Haiku's `low`: GLM-5.3-Flash `low` (its reasoning cannot be turned
//         off, and its default is `max`), DeepSeek-V4-Flash `low`;
//         MiMo-V2.6-Flash and Qwen3.8-Flash list no effort, so none is sent
//         and each runs at its own default. A model's reasoning tokens are
//         completion tokens under its limit, and every bound counts the
//         completion at that limit;
//       * THE PROVIDER ROUTING: `provider: { max_price: { prompt: 0.15,
//         completion: 0.6 }, require_parameters: true }`, so OpenRouter routes
//         only to an endpoint listing at most $0.15 per million input tokens
//         and $0.60 per million output tokens (G0-3b's ceilings) and
//         supporting every field sent. OpenRouter's headline price is its
//         cheapest endpoint, not the one a request lands on.
//
// A model's RESERVATION PRICE (what every bound and reservation is priced
// at): the most any endpoint the request may land on lists, at the tier the
// prompt's estimate reaches. For Haiku, every endpoint in its list (some list
// 10% above the headline price); for an open-weight model, its endpoints
// within the routing's ceilings, and the ceilings themselves.

import { CATALOG_EXCERPT, modelRequestParameters, modelRequestSettings } from './catalog.mjs';

/** The routing every open-weight request carries. */
export const OPEN_WEIGHT_ROUTING = Object.freeze({ max_price: Object.freeze({ prompt: 0.15, completion: 0.6 }), require_parameters: true });

const HAIKU = CATALOG_EXCERPT.find((e) => e.id === 'anthropic/claude-haiku-5.5');

/** Every model S1 may send a request to, with its settings. */
export const MODELS = Object.freeze({
  'anthropic/claude-haiku-5.5': Object.freeze({ role: 'main', settings: modelRequestSettings(HAIKU), routing: null, source: 'the pinned catalog entry (catalog.mjs), reasoning low' }),
  'z-ai/glm-5.3-flash': Object.freeze({ role: 'open-weight candidate', settings: Object.freeze({ reasoningEffort: 'low', tokenLimitParameter: 'max_tokens' }), routing: OPEN_WEIGHT_ROUTING, source: 'G0-3b candidate 1' }),
  'deepseek/deepseek-v4-flash-0731': Object.freeze({ role: 'open-weight candidate', settings: Object.freeze({ reasoningEffort: 'low', tokenLimitParameter: 'max_tokens' }), routing: OPEN_WEIGHT_ROUTING, source: 'G0-3b candidate 2' }),
  'xiaomi/mimo-v2.6-flash': Object.freeze({ role: 'open-weight candidate', settings: Object.freeze({ tokenLimitParameter: 'max_tokens' }), routing: OPEN_WEIGHT_ROUTING, source: 'G0-3b candidate 3' }),
  'qwen/qwen3.8-flash': Object.freeze({ role: 'open-weight alternate', settings: Object.freeze({ tokenLimitParameter: 'max_tokens' }), routing: OPEN_WEIGHT_ROUTING, source: 'G0-3b alternate' }),
});

/** The main model that is not chosen at G3. */
export const HAIKU_SLUG = 'anthropic/claude-haiku-5.5';

/** The three candidates the open-weight probe compares, in the seat's order. */
export const OPEN_WEIGHT_CANDIDATES = Object.freeze(['z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.6-flash']);

/** The open-weight alternate. */
export const OPEN_WEIGHT_ALTERNATE = 'qwen/qwen3.8-flash';

/** A model by slug (or `slug@effort`, for a model outside this table, as
 *  P0's runner took one): its settings, routing and request parameters. */
export function resolveModel(spec) {
  const [slug, effort] = spec.split('@');
  const known = MODELS[slug];
  if (known && effort) throw new Error(`${slug}: its settings are preregistered (models.mjs); give it without @${effort}`);
  const catalog = CATALOG_EXCERPT.find((e) => e.id === slug || e.endpointModel === slug);
  const settings = known ? known.settings : effort ? { reasoningEffort: effort } : catalog ? modelRequestSettings(catalog) : undefined;
  const routing = known ? known.routing : null;
  return {
    spec,
    slug,
    control: Boolean(catalog),
    catalogId: catalog?.id ?? null,
    settings: settings ?? null,
    routing,
    params: (limit) => ({ ...modelRequestParameters(settings, limit), ...(routing ? { provider: routing } : {}) }),
  };
}

/** The request fields a model's `supported_parameters` must list: every
 *  field of `params` but OpenRouter's own routing field. */
export const listedFields = (params) => Object.keys(params).filter((k) => k !== 'provider');

/** Whether an endpoint is one a request with `routing` may land on. */
export function endpointEligible(endpoint, routing) {
  if (!routing) return true;
  return Number(endpoint.pricing.prompt) <= routing.max_price.prompt && Number(endpoint.pricing.completion) <= routing.max_price.completion;
}

/** The price ceilings a model's provider routing enforces, as a pricing
 *  object (per million tokens); null for a model with no routing. */
export const routingCeilings = (model) => (model.routing ? { prompt: String(model.routing.max_price.prompt), completion: String(model.routing.max_price.completion) } : null);

/** The per-million pricing objects a request to `model` may be billed at:
 *  its eligible endpoints' and, under routing, the ceilings. Falls back to
 *  the list row's pricing when no endpoints were read. */
export function reservationPricings(model, listRow, endpoints) {
  const eligible = (endpoints ?? []).filter((e) => endpointEligible(e, model.routing)).map((e) => e.pricing);
  const ceilings = model.routing ? [routingCeilings(model)] : [];
  const out = [...eligible, ...ceilings];
  return out.length ? out : [listRow.pricing];
}
