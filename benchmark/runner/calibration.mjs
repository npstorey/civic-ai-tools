// The probe's calibration of the reservation estimate (anchor P0's rule; the
// contract's two-question probe): per model, the fewest characters of a
// request body's JSON per billed prompt token over the probe's requests, less
// 10%. A lower figure means more tokens per character, so the estimate errs
// high. The evaluations and the dry run read the file with --calibration.

/** The calibration's rule, as the file states it. */
export const CALIBRATION_RULE =
  "per model, the fewest characters of a request body's JSON per billed prompt token over the probe's requests that returned usage, less 10%, rounded down to four places";

/** The share taken off the fewest characters per token. */
export const CALIBRATION_MARGIN = 0.1;

/** Every request of a row that returned usage: `{ chars, promptTokens }`. */
export function rowRequests(row) {
  const out = [];
  const add = (r) => {
    if (r && typeof r.promptChars === 'number' && r.usage?.prompt_tokens > 0) out.push({ chars: r.promptChars, promptTokens: r.usage.prompt_tokens });
  };
  if (Array.isArray(row.requests) && row.requests.length) row.requests.forEach(add);
  else add(row.first);
  add(row.second);
  add(row.request);
  return out;
}

/** The calibration over a probe's rows: per model slug, its characters per
 *  token and what it was read from. */
export function calibrate(rows) {
  const byModel = {};
  for (const row of rows) {
    if (!row.model) continue;
    for (const r of rowRequests(row)) {
      const ratio = r.chars / r.promptTokens;
      const m = (byModel[row.model] ??= { requests: 0, fewest: Infinity, at: null });
      m.requests++;
      if (ratio < m.fewest) {
        m.fewest = ratio;
        m.at = { key: row.key, chars: r.chars, promptTokens: r.promptTokens };
      }
    }
  }
  const models = {};
  for (const [slug, m] of Object.entries(byModel)) {
    const floor4 = (x) => Math.floor(x * 1e4) / 1e4;
    models[slug] = { charsPerToken: floor4(m.fewest * (1 - CALIBRATION_MARGIN)), fewestCharsPerToken: floor4(m.fewest), requests: m.requests, fewestAt: m.at };
  }
  return { schema: 'civic-calibration/1', rule: CALIBRATION_RULE, models };
}
