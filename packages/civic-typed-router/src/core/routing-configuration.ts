// The routing configuration (since 0.10.0): what decided which sources a
// request listed, as the hub's S1 benchmark defined and recorded it
// (`benchmark/runner/session.mjs`, `hashes()`; each configuration's
// `routingConfiguration` and `routingConfigurationHash` in a run's
// `meta.json`). Key for key:
//
//   { rule: { id, version }, cap, search, inventory: { id, version, hash } }
//
//   - `rule`: the rule that chose the listed set, and its version; S1 wrote
//     `{ id: 'none', version: 'none' }` where no rule chose one;
//   - `cap`: `'none'`, or the most entries the list holds, as a positive
//     decimal integer with no leading zero (S1's `'25'`), so that one cap
//     has one spelling and one hash; the harness refuses the same set;
//   - `search`: `'none'`, or the search method and its version
//     (`SEARCH_METHOD`, `{ method: 'bm25', version: '1' }`);
//   - `inventory`: the inventory's id, version and hash (64 lowercase hex
//     characters).
//
// Its hash is the lowercase hex SHA-256 of its canonical JSON (`canonicalJson`,
// `sha256Hex`), as S1 computed it. The router ships no rule that cuts a list:
// a consumer that lists every source states `cap: 'none'`.
//
// Pure: it reads nothing but its argument.

import { canonicalJson } from './canonical-json.ts';
import type { SearchMethod } from './search.ts';
import { sha256Hex } from './sha256.ts';

/** The rule that chose the listed sources, and its version. */
export interface RoutingRule {
  readonly id: string;
  readonly version: string;
}

/** The inventory the sources come from: its id, version and hash. */
export interface RoutingInventory {
  readonly id: string;
  readonly version: string;
  /** 64 lowercase hex characters. */
  readonly hash: string;
}

/** The routing configuration: S1's object, key for key. */
export interface RoutingConfiguration {
  readonly rule: RoutingRule;
  /** `'none'`, or a positive decimal integer with no leading zero. */
  readonly cap: string;
  readonly search: 'none' | SearchMethod;
  readonly inventory: RoutingInventory;
}

/** A routing configuration and its hash, under the names a run's
 *  `meta.json` gives them. */
export interface RoutingConfigurationRecord {
  readonly routingConfiguration: RoutingConfiguration;
  /** The lowercase hex SHA-256 of `canonicalJson(routingConfiguration)`. */
  readonly routingConfigurationHash: string;
}

/** Thrown by `routingConfiguration` for a value outside its shape. */
export class RoutingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingConfigurationError';
  }
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` as an object of exactly the string members `members`, in that
 *  order; throws naming `field` otherwise. */
function stringsObject(value: unknown, field: string, members: readonly string[]): Record<string, string> {
  if (!isPlainObject(value)) throw new RoutingConfigurationError(`${field} must be an object of ${members.join(', ')}.`);
  const extra = Object.keys(value).filter((key) => !members.includes(key));
  if (extra.length > 0) throw new RoutingConfigurationError(`${field} has a member it does not take: ${extra.join(', ')}.`);
  const out: Record<string, string> = {};
  for (const member of members) {
    if (!Object.hasOwn(value, member)) throw new RoutingConfigurationError(`${field}.${member} is missing.`);
    const v = value[member];
    if (typeof v !== 'string') throw new RoutingConfigurationError(`${field}.${member} must be a string.`);
    out[member] = v;
  }
  return out;
}

/**
 * The routing configuration of `input`, rebuilt key for key in S1's order
 * (`rule`, `cap`, `search`, `inventory`), and its hash. Throws
 * `RoutingConfigurationError`, and hashes nothing, when `input` is not an
 * object of exactly those four members, `rule` or `inventory` is not an
 * object of exactly its string members, `cap` is neither `'none'` nor a
 * positive decimal integer with no leading zero (`'0'`, `'025'`, `''` and
 * `'2.5'` are refused), `search` is neither `'none'` nor an object of
 * exactly the strings `method` and `version`, or `inventory.hash` is not 64
 * lowercase hex characters.
 */
export function routingConfiguration(input: RoutingConfiguration): RoutingConfigurationRecord {
  const top = routingConfigurationShape(input);
  const rule = stringsObject(top.rule, 'rule', ['id', 'version']);
  const cap = top.cap;
  if (typeof cap !== 'string' || !(cap === 'none' || POSITIVE_DECIMAL.test(cap))) {
    throw new RoutingConfigurationError(`cap must be 'none' or a positive decimal integer with no leading zero.`);
  }
  const search = top.search === 'none' ? 'none' : stringsObject(top.search, 'search', ['method', 'version']);
  const inventory = stringsObject(top.inventory, 'inventory', ['id', 'version', 'hash']);
  if (!SHA256_HEX.test(inventory.hash!)) throw new RoutingConfigurationError('inventory.hash must be 64 lowercase hex characters.');

  const configuration: RoutingConfiguration = {
    rule: { id: rule.id!, version: rule.version! },
    cap,
    search: search === 'none' ? 'none' : { method: search.method!, version: search.version! },
    inventory: { id: inventory.id!, version: inventory.version!, hash: inventory.hash! },
  };
  return { routingConfiguration: configuration, routingConfigurationHash: sha256Hex(canonicalJson(configuration)) };
}

/** `input` as an object of exactly the four members. */
function routingConfigurationShape(input: unknown): Record<string, unknown> {
  const members = ['rule', 'cap', 'search', 'inventory'];
  if (!isPlainObject(input)) throw new RoutingConfigurationError(`A routing configuration is an object of ${members.join(', ')}.`);
  const extra = Object.keys(input).filter((key) => !members.includes(key));
  if (extra.length > 0) throw new RoutingConfigurationError(`A routing configuration has a member it does not take: ${extra.join(', ')}.`);
  for (const member of members) {
    if (!Object.hasOwn(input, member)) throw new RoutingConfigurationError(`${member} is missing.`);
  }
  return input;
}
