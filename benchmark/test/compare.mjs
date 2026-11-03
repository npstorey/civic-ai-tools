// The comparison A0.3 names: two summaries compared as parsed objects, with
// `computedAt` and `runDir` removed from both, every number and every decimal
// string read with `Number()` and rounded to eight places, and the `files`
// hashes compared exactly, as strings, on their own.

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** `value` with every number and decimal string as a number rounded to eight
 *  places, recursively. */
export function rounded(value) {
  if (Array.isArray(value)) return value.map(rounded);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rounded(v)]));
  if (typeof value === 'number') return Number(value.toFixed(8));
  if (typeof value === 'string' && DECIMAL.test(value)) return Number(Number(value).toFixed(8));
  return value;
}

/** A summary's figures: everything but `computedAt`, `runDir` and `files`,
 *  rounded. */
export function figures(summary) {
  const { computedAt, runDir, files, ...rest } = summary;
  void computedAt;
  void runDir;
  void files;
  return rounded(rest);
}
