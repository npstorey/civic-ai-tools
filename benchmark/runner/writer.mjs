// The benchmark's one writer of JSON: every file the runner, the scorer and
// the inventory builder commit under `benchmark/` goes through it, so every
// such file keeps the digit-run convention.
//
// THE CONVENTION. No run of 13 or more digits appears in a committed file
// outside a full hex digest (40, 64, 96 or 128 hex characters with a letter
// among them). A leak scanner reads such a run as an account-shaped number,
// and R5's run files held 1,639 of them, nearly all in cost floats. So:
//
//   - a cost (a number under a cost key, below) is written as a decimal string
//     of at most eight places: the float R5 wrote as `0.00266250…0004`
//     (nineteen digits after the point) becomes "0.0026625";
//   - a token count stays an integer;
//   - a run of 13 or more digits inside a string (a model's raw text, a copied
//     tool text, a price string) is written with every ninth digit of the run
//     as its JSON `\u` escape, the hub's fixture convention (router README,
//     "Re-running the captures"). The escape is lexical only: `JSON.parse`
//     gives the original string, character for character.
//
// A run of 13 or more digits in any other number has no lossless spelling,
// so `serialize` refuses it rather than write it.

/** A full hex digest as the convention reads one: 40, 64, 96 or 128 hex
 *  characters, no letter or digit on either side. Masked only when a letter
 *  is among them, so a bare run of digits is never taken for a digest. */
const DIGEST = /(?<![0-9A-Za-z])[0-9a-f]{40}(?:[0-9a-f]{24}(?:[0-9a-f]{32}(?:[0-9a-f]{32})?)?)?(?![0-9A-Za-z])/g;

/** `text` with the digits of every full hex digest replaced by `x`. */
export function maskDigests(text) {
  return text.replace(DIGEST, (hex) => (/[a-f]/.test(hex) ? hex.replace(/\d/g, 'x') : hex));
}

/** Every run of 13 or more digits in `text` outside a full hex digest. */
export function longDigitRuns(text) {
  return maskDigests(text).match(/\d{13,}/g) ?? [];
}

/** A key whose number is a cost in US dollars: `cost`, `charged`, `computed`,
 *  `reported`, any key ending in `Usd`, and OpenRouter's `*_cost` details. */
const COST_KEY = /^(?:cost|charged|computed|reported)$|Usd$|_cost$/;

/** `n` as a decimal string of at most eight places, with no exponent and no
 *  trailing zero: R5's `0.00266250…0004` is "0.0026625", 0 is "0". */
export function decimalString(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`decimalString: not a finite number: ${n}`);
  const fixed = n.toFixed(8);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed === '-0' ? '0' : trimmed;
}

/** `value` with every number under a cost key written as a decimal string. */
function withCostStrings(value, key) {
  if (Array.isArray(value)) return value.map((item) => withCostStrings(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withCostStrings(v, k)]));
  }
  if (typeof value === 'number' && key !== undefined && COST_KEY.test(key)) return decimalString(value);
  return value;
}

/** A run of 13 or more digits, broken: every ninth digit as its `\u` escape,
 *  so no run in the result is longer than eight digits. */
function breakRun(run) {
  return [...run].map((digit, i) => (i % 9 === 8 ? `\\u${digit.charCodeAt(0).toString(16).padStart(4, '0')}` : digit)).join('');
}

/** A JSON string literal (with its quotes) with every long run outside a
 *  digest broken. A literal's escapes are left whole: a run can include an
 *  escape's four hex digits only at its start, and the ninth digit is past
 *  them. */
function breakRunsInLiteral(literal) {
  let out = '';
  let last = 0;
  for (const match of literal.matchAll(DIGEST)) {
    if (!/[a-f]/.test(match[0])) continue;
    out += literal.slice(last, match.index).replace(/\d{13,}/g, breakRun) + match[0];
    last = match.index + match[0].length;
  }
  return out + literal.slice(last).replace(/\d{13,}/g, breakRun);
}

/** JSON text for `value` under the convention; `indent` as JSON.stringify's.
 *  Throws when a number other than a cost would carry a long run, or when the
 *  text would not parse back to the value it was made from. */
export function serialize(value, indent) {
  const normalized = withCostStrings(value);
  const plain = JSON.stringify(normalized, null, indent);
  const text = plain.replace(/"(?:[^"\\]|\\.)*"/g, breakRunsInLiteral);
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(JSON.parse(plain))) {
    throw new Error('serialize: the escaped text does not parse to the value');
  }
  const runs = longDigitRuns(text);
  if (runs.length) throw new Error(`serialize: a ${runs[0].length}-digit run outside a string; write it as a string or reshape it`);
  return text;
}

/** One JSON Lines record, newline-terminated. */
export const jsonLine = (value) => `${serialize(value)}\n`;

/** A JSON document, two-space indented and newline-terminated. */
export const jsonDocument = (value) => `${serialize(value, 2)}\n`;
