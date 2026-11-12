// Canonical JSON for whole JSON values: RFC 8785 (JCS). Object members are
// written in the order of their names' UTF-16 code units, with no
// whitespace; every string as `JSON.stringify` writes it; every number as
// ECMAScript writes it (`JSON.stringify` of a finite number, which is
// RFC 8785's rule, `-0` as `0`); `true`, `false` and `null` as themselves.
//
// It exists beside `canonicalJson` (`./canonical-json.ts`), which hashes the
// router's own values and refuses numbers, booleans and null: a server's tool
// schemas hold all three (`mcpToolSchemaSha256`). A value JSON cannot carry
// is refused, never coerced: `undefined`, a function, a symbol, a bigint, a
// number that is not finite, an array hole, an object that is not a plain
// object, and a symbol-keyed member. The router's own code, with no import
// (ADR-0037).

/** Thrown by `canonicalJsonValue` for a value JSON cannot carry. */
export class CanonicalJsonValueError extends Error {
  /** Where the value sits, from `$` (the root). */
  readonly path: string;

  constructor(path: string, what: string) {
    super(`canonicalJsonValue: ${what} at ${path}; only JSON values are canonicalized.`);
    this.name = 'CanonicalJsonValueError';
    this.path = path;
  }
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return `the number ${String(value)}`;
  return `a ${typeof value}`;
}

function encode(value: unknown, path: string): string {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CanonicalJsonValueError(path, describe(value));
    // ECMAScript's Number-to-String, as RFC 8785 §3.2.2.3 states it; `-0` is `0`.
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new CanonicalJsonValueError(`${path}[${i}]`, 'an array hole');
      items.push(encode(value[i], `${path}[${i}]`));
    }
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new CanonicalJsonValueError(path, 'an object that is not a plain object');
    if (Object.getOwnPropertySymbols(value).length > 0) throw new CanonicalJsonValueError(path, 'a symbol-keyed member');
    const record = value as Record<string, unknown>;
    // `sort()` with no comparator orders strings by UTF-16 code units.
    const members = Object.keys(record)
      .sort()
      .map((name) => `${JSON.stringify(name)}:${encode(record[name], `${path}.${name}`)}`);
    return `{${members.join(',')}}`;
  }
  throw new CanonicalJsonValueError(path, describe(value));
}

/** The RFC 8785 canonical JSON text of `value`, a JSON value. */
export function canonicalJsonValue(value: unknown): string {
  return encode(value, '$');
}
