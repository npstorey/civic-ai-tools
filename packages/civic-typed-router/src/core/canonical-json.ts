// Canonical JSON for the values the router hashes: RFC 8785 (JCS) restricted
// to strings, arrays and plain objects. Object members are written in the
// order of their names' UTF-16 code units, with no whitespace, and every
// string as `JSON.stringify` writes it. A number, a boolean, `null`,
// `undefined`, an array hole, a non-plain object or a symbol-keyed member is
// refused, so the router never hashes a value whose canonical form it does
// not define. The router's own code, with no import (ADR-0037).

/** Thrown by `canonicalJson` for a value it does not canonicalize. */
export class CanonicalJsonError extends Error {
  /** Where the value sits, from `$` (the root). */
  readonly path: string;

  constructor(path: string, what: string) {
    super(`canonicalJson: ${what} at ${path}; only strings, arrays and plain objects are canonicalized.`);
    this.name = 'CanonicalJsonError';
    this.path = path;
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return `a ${typeof value}`;
}

function encode(value: unknown, path: string): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new CanonicalJsonError(`${path}[${i}]`, 'an array hole');
      items.push(encode(value[i], `${path}[${i}]`));
    }
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new CanonicalJsonError(path, 'an object that is not a plain object');
    if (Object.getOwnPropertySymbols(value).length > 0) throw new CanonicalJsonError(path, 'a symbol-keyed member');
    const record = value as Record<string, unknown>;
    // `sort()` with no comparator orders strings by UTF-16 code units.
    const members = Object.keys(record)
      .sort()
      .map((name) => `${JSON.stringify(name)}:${encode(record[name], `${path}.${name}`)}`);
    return `{${members.join(',')}}`;
  }
  throw new CanonicalJsonError(path, describe(value));
}

/** The canonical JSON text of `value`, which must be made of strings,
 *  arrays and plain objects only. */
export function canonicalJson(value: unknown): string {
  return encode(value, '$');
}
