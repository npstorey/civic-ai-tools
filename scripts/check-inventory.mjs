#!/usr/bin/env node
/**
 * check-inventory.mjs — the civic inventory's gate (hub #309, S2-A P0, A0.1).
 *
 * `inventory/civic-inventory.json` is the source of truth for the router's
 * sources. This check holds it to what makes it citable:
 *
 *   1. it validates against `inventory/schema.json` (`civic-inventory/2`),
 *      with ajv 6.15.0, the root devDependency;
 *   2. every value in it is a string, an array or an object: the router's
 *      `canonicalJson`, which defines its hash, refuses numbers, booleans and
 *      null;
 *   3. `civic-inventory.json.sha256` is one line, the SHA-256 of the router's
 *      `canonicalJson` of the parsed file (not of its bytes);
 *   4. its version is `YYYY-MM-DD.N` and `inventory/CHANGELOG.md` has its
 *      line (`- \`<version>\`: ...`);
 *   5. it loads: `manifestFromInventory(file, CIVIC_KINDS)` from the built
 *      router package, which holds every entry's tools to its `toolsRef`
 *      with the router's `toolsSha256`, and `createCivicRouter` over the
 *      result passes its startup checks.
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

const VERSION = /^\d{4}-\d{2}-\d{2}\.\d+$/;

/**
 * Every problem with an inventory, as named lines; `[]` when it passes.
 * `router` is the router package's exports (`canonicalJson`, `sha256Hex`,
 * `manifestFromInventory`, `CIVIC_KINDS`, `createCivicRouter`).
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
  if (typeof version !== 'string' || !VERSION.test(version)) {
    problems.push(`version: ${JSON.stringify(version)} is not YYYY-MM-DD.N`);
  } else if (!changelog.split('\n').some((line) => line.startsWith(`- \`${version}\`: `))) {
    problems.push(`changelog: ${PATHS.changelog} has no line for ${version} ("- \`${version}\`: ...")`);
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
