#!/usr/bin/env node
/**
 * check-inventory.mjs — the civic inventory's gate (hub #309, S2-A P0, A0.1).
 *
 * `inventory/civic-inventory.json` is the source of truth for the router's
 * sources. This check holds it to what makes it citable:
 *
 *   1. it validates against `inventory/schema.json` (`civic-inventory/3`),
 *      with ajv 6.15.0, the root devDependency;
 *   2. every value in it is a string, an array or an object: the router's
 *      `canonicalJson`, which defines its hash, refuses numbers, booleans and
 *      null;
 *   3. `civic-inventory.json.sha256` is one line, the SHA-256 of the router's
 *      `canonicalJson` of the parsed file (not of its bytes);
 *   4. its version is `YYYY-MM-DD.N`, the harness's form (S2-B, F3): a
 *      calendar date and a counter with no leading zero; and
 *      `inventory/CHANGELOG.md` has its line (`- \`<version>\`: ...`);
 *   5. every pack states its hash, and the hash is the router's `packHash`
 *      of the entry: the `canonicalJson` SHA-256 of the entry with `hash`,
 *      `provenance` and `toolsRef` removed (S2-B, G0-B6);
 *   6. it loads: `manifestFromInventory(file, CIVIC_KINDS)` from the built
 *      router package, which holds every entry's tools to its `toolsRef`
 *      with the router's `toolsSha256` and every pack to its hash, resolves
 *      each pack's `base` by the server entry's `id`, holds its `basePins`
 *      to the tools it calls and (the Socrata kind) its `api` to its
 *      `filter`, and `createCivicRouter` over the result passes its startup
 *      checks;
 *   7. `id`, `sourceId` and `alias` are each unique across the entries
 *      (hub #317, S2-C);
 *   8. a server entry's `toolsRef.toolNames` is empty only when some pack
 *      names that entry as its base (hub #314's item 5; S2-C).
 *
 * Hermetic: four file reads and one local import, no network. The router is
 * the package `npm ci` builds (`packages/civic-typed-router/dist`).
 *
 * Run via `npm run check:inventory`; self-test `npm run check:inventory:self-test`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import Ajv from 'ajv';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The files the check reads, relative to the repository root. */
export const PATHS = Object.freeze({
  inventory: 'inventory/civic-inventory.json',
  sha256: 'inventory/civic-inventory.json.sha256',
  schema: 'inventory/schema.json',
  changelog: 'inventory/CHANGELOG.md',
});

/** Every value in `value` that is not a string, an array or an object, by path. */
export function nonStrings(value, path = '$') {
  if (typeof value === 'string') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonStrings(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => nonStrings(v, `${path}.${k}`));
  return [`${path} = ${JSON.stringify(value)}`];
}

/** `YYYY-MM-DD.N` as written, before the two rules below. */
const VERSION = /^(\d{4})-(\d{2})-(\d{2})\.(\d+)$/;

/** Whether year, month and day name a day of the Gregorian calendar. */
export function isCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Every problem with an inventory, as named lines; `[]` when it passes.
 * `router` is the router package's exports (`canonicalJson`, `sha256Hex`,
 * `packHash`, `manifestFromInventory`, `CIVIC_KINDS`, `createCivicRouter`).
 */
export function inventoryProblems({ inventory, sha256Text, schema, changelog, router }) {
  const problems = [];

  const validate = new Ajv({ allErrors: true }).compile(schema);
  if (!validate(inventory)) {
    for (const error of validate.errors ?? []) problems.push(`schema: ${error.dataPath || '$'} ${error.message}`);
  }

  for (const found of nonStrings(inventory)) problems.push(`value: ${found} is not a string, an array or an object`);

  if (!/^[0-9a-f]{64}\n$/.test(sha256Text)) {
    problems.push(`sha256: ${PATHS.sha256} is not one line of 64 lowercase hex characters`);
  } else {
    let hash;
    try {
      hash = router.sha256Hex(router.canonicalJson(inventory));
    } catch (error) {
      problems.push(`sha256: the file has no canonical form (${error.message})`);
    }
    if (hash !== undefined && sha256Text.trim() !== hash) {
      problems.push(`sha256: ${PATHS.sha256} states ${sha256Text.trim()}; the canonicalJson SHA-256 of the parsed file is ${hash}`);
    }
  }

  const version = inventory?.version;
  const parts = typeof version === 'string' ? VERSION.exec(version) : null;
  if (!parts) {
    problems.push(`version: ${JSON.stringify(version)} is not YYYY-MM-DD.N`);
  } else {
    const [, year, month, day, counter] = parts;
    if (!isCalendarDate(Number(year), Number(month), Number(day))) {
      problems.push(`version: ${JSON.stringify(version)}: ${year}-${month}-${day} is not a calendar date`);
    }
    if (/^0\d/.test(counter)) {
      problems.push(`version: ${JSON.stringify(version)}: the counter ${JSON.stringify(counter)} has a leading zero`);
    }
    if (!changelog.split('\n').some((line) => line.startsWith(`- \`${version}\`: `))) {
      problems.push(`changelog: ${PATHS.changelog} has no line for ${version} ("- \`${version}\`: ...")`);
    }
  }

  for (const [i, entry] of (Array.isArray(inventory?.entries) ? inventory.entries : []).entries()) {
    if (entry?.kind !== 'pack') continue;
    const label = typeof entry.alias === 'string' ? entry.alias : `entries[${i}]`;
    if (typeof entry.hash !== 'string') {
      problems.push(`hash: ${label}: a pack states its hash, and this one has none`);
      continue;
    }
    let hash;
    try {
      hash = router.packHash(entry);
    } catch (error) {
      problems.push(`hash: ${label}: the entry has no canonical form (${error.message})`);
      continue;
    }
    if (entry.hash !== hash) {
      problems.push(`hash: ${label}: states ${entry.hash}; the canonicalJson SHA-256 of the entry less hash, provenance and toolsRef is ${hash}`);
    }
  }

  const entries = Array.isArray(inventory?.entries) ? inventory.entries : [];
  const labelOf = (entry, i) => `entries[${i}]${typeof entry?.alias === 'string' ? ` (${entry.alias})` : ''}`;
  for (const member of ['id', 'sourceId', 'alias']) {
    const holders = new Map();
    entries.forEach((entry, i) => {
      const value = entry?.[member];
      if (typeof value !== 'string') return;
      holders.set(value, [...(holders.get(value) ?? []), labelOf(entry, i)]);
    });
    for (const [value, at] of holders) {
      if (at.length > 1) problems.push(`unique: ${member} ${JSON.stringify(value)} is stated by ${at.slice(0, -1).join(', ')} and ${at[at.length - 1]}`);
    }
  }

  const bases = new Set(entries.filter((entry) => entry?.kind === 'pack').map((entry) => entry.base));
  for (const [i, entry] of entries.entries()) {
    if (entry?.kind !== 'server' || !Array.isArray(entry.toolsRef?.toolNames) || entry.toolsRef.toolNames.length > 0) continue;
    if (!bases.has(entry.id)) {
      problems.push(`tools: ${typeof entry.alias === 'string' ? entry.alias : `entries[${i}]`}: toolsRef.toolNames is empty, and no pack names this entry as its base`);
    }
  }

  try {
    router.createCivicRouter(router.manifestFromInventory(inventory, router.CIVIC_KINDS));
  } catch (error) {
    problems.push(`load: ${error.message}`);
  }

  return problems;
}

/** The repository's own inputs. */
export function readInputs(root = REPO) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  return {
    inventory: JSON.parse(read(PATHS.inventory)),
    sha256Text: read(PATHS.sha256),
    schema: JSON.parse(read(PATHS.schema)),
    changelog: read(PATHS.changelog),
  };
}

async function main() {
  const router = await import('@typedstandards/civic-typed-router');
  const problems = inventoryProblems({ ...readInputs(), router });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`check-inventory: ${problem}`);
    console.error(`Inventory check FAILED: ${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log('Inventory check passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
