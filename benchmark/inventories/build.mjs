#!/usr/bin/env node
// Builds the benchmark's inventories, deterministically, from their sources.
// This phase (S1 P0) builds the 7-entry slice: today's seven sources, from the
// router's own manifest. P1 adds the 50-, 200- and 1,000-entry files.
//
// Usage:
//   node benchmark/inventories/build.mjs --check   rebuild and compare, byte for byte; exit 1 on a difference
//   node benchmark/inventories/build.mjs --write   write 7.json and 7.json.sha256
//
// THE FORMAT is the design's §3.2 (`civic-inventory/1`), checked by
// `schema.json`. Every value in an inventory is a string, an array or an
// object: the router's `canonicalJson`, which hashes it, refuses numbers,
// booleans and null. So a count is written as a string, and a field with
// nothing to say is left out.
//
// THE HASH beside each file (`<n>.json.sha256`) is the lowercase hex SHA-256 of
// the router's `canonicalJson` of the parsed file, not of the file's bytes, so
// it survives a move to a content node; the bytes on disk are pretty-printed.
//
// THE SEVEN. Each entry carries the router's data fields as the manifest has
// them (`to-manifest.mjs` holds the two equal), and the fields the design
// adds, curated here: `serverType`, `place`, `categories`, `provenance`, and
// `toolsRef` / `guidanceRef`, which point at the router's tools and guidance
// and hash them. Fields not read for this slice (`registry`, `licence`, and
// `authentication` where the router names no key) are left out rather than
// guessed.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalJson, CIVIC_MANIFEST, createCivicRouter, sha256Hex } from '@typedstandards/civic-typed-router';
import { jsonDocument } from '../runner/writer.mjs';
import { offlineFetchers, PUBLICATION_HOST, SOCRATA_GUIDANCE_FILE_SHA256, SOCRATA_GUIDANCE_PATH } from './guidance.mjs';

const ROUTER_PACKAGE = JSON.parse(readFileSync(new URL('../../packages/civic-typed-router/package.json', import.meta.url), 'utf8'));
const ROUTER = `${ROUTER_PACKAGE.name}@${ROUTER_PACKAGE.version}`;

/** The inventory's identity. The version is a date and a counter (§3.3). */
export const INVENTORY_7 = { id: 'civic-7', version: '2026-11-02.1' };

/**
 * THE COMPOSITION of each size, by source. Stated here (and in the README)
 * in a commit before the one that adds the 1,000-entry file (the seat's
 * ruling 3, hub #302 comment 6604092796); the build that adds the files
 * checks every count against it.
 *
 * Every Socrata, CKAN and registry selection takes `active` entries only
 * (the seat's ruling, hub #302 comment 6610180295): of the Socrata catalog's
 * 364 rows, 363 are active.
 *
 *   50     the 11 real servers (today's seven and R5's four, R6); the 34
 *          largest active US Socrata domains by dataset_count; 5 distractors
 *          (3 near-duplicates, 2 wrapper packs).
 *   200    the 50; the remaining 45 of the 79 active US Socrata domains with
 *          50 or more datasets; the 70 largest of the other 138 active US
 *          Socrata domains; the 20 largest active US CKAN portals; the first
 *          10 MCP Registry entries in the seed's order; 5 more distractors (3
 *          near-duplicates, 2 wrapper packs): 50 + 45 + 70 + 20 + 10 + 5 = 200.
 *   1,000  the 200; every remaining active Socrata domain that carries a
 *          country (95 in the catalog as copied); the 400 largest active CKAN
 *          portals not already in, any country; the next 240 MCP Registry
 *          entries in the seed's order; and near-duplicates to fill the file.
 *          The 400 and the 240 are a design choice, not a measured share of
 *          any real directory.
 *
 * THE REMAINDER RULE: the 1,000-entry file's near-duplicates are 1,000 less
 * every other entry: 1,000 − (200 + 95 + 400 + 240) = 65. A catalog that
 * moved would move the 95 and so the 65; the build stops if the count of
 * remaining active Socrata domains with a country differs from the 95 stated.
 *
 * Every "largest" is by dataset_count, descending, ties broken by the
 * catalog's `id` ascending (the `id` field, which on some rows differs from
 * the host in the row's URL). Every "in the seed's order" ranks by
 * the SHA-256 of the seed, a purpose and a key, joined by NUL, ascending:
 *   SEED  'civic-ai-tools S1 P1 inventories, 2026-11-03'
 * A near-duplicate copies the first real entry with tools (a server or a
 * portal pack, never a registry entry or a distractor) of its size not yet
 * copied, in the seed's order (purpose 'near-duplicate', key the alias); a
 * wrapper wraps the next of the eleven servers in the seed's order (purpose
 * 'wrapper', key the alias); and each of the three files lists its entries in
 * the seed's order (purpose 'order', key the alias).
 */
export const COMPOSITION = Object.freeze({
  seed: 'civic-ai-tools S1 P1 inventories, 2026-11-03',
  50: { servers: 11, socrataLargestUS: 34, nearDuplicates: 3, wrappers: 2 },
  200: { from50: 50, socrataUS50Plus: 45, socrataUSOther: 70, ckanUSActive: 20, registry: 10, nearDuplicates: 3, wrappers: 2 },
  1000: { from200: 200, socrataWithCountry: 95, ckanActive: 400, registry: 240, nearDuplicates: 65 },
});

/** The day the seven were copied in, for `provenance.addedOn`. */
const ADDED_ON = '2026-11-02';

/** Each source's module in the router, for `provenance.sourceUrl`. */
const ROUTER_MODULE = {
  socrata: 'socrata.ts',
  'data-commons': 'data-commons.ts',
  'boston-opencontext': 'boston.ts',
  'nyc-charter': 'nyc-charter.ts',
  'nyc-checkbook': 'nyc-checkbook.ts',
  'nyc-record': 'nyc-record.ts',
  'nys-legislation': 'nys-legislation.ts',
};

/** The router's pinned `tools/list` capture, where one exists. */
const TOOLS_FIXTURE = {
  'nyc-charter': 'nyc-charter-tools.json',
  'nyc-checkbook': 'nyc-checkbook-tools.json',
  'nyc-record': 'nyc-record-tools.json',
  'nys-legislation': 'nys-legislation-tools.json',
};

const NYC = { country: 'US', level: 'local', names: ['New York City', 'NYC'] };

/** What the design adds to an entry, curated for the seven from each entry's
 *  description. `multiple` is a place that is not one place: a server over
 *  many portals or many countries. */
const CURATED = {
  socrata: {
    serverType: 'socrata',
    place: { country: 'multiple', level: 'multiple', names: [] },
    categories: ['311-service-requests', 'permits-licensing', 'inspections', 'public-safety', 'housing', 'transportation', 'payroll-workforce'],
  },
  'data-commons': {
    serverType: 'mcp-remote',
    place: { country: 'multiple', level: 'multiple', names: [] },
    categories: ['demographics', 'economy-labor', 'health', 'education', 'environment'],
  },
  'boston-opencontext': {
    serverType: 'mcp-remote',
    place: { country: 'US', level: 'local', names: ['Boston', 'City of Boston'] },
    categories: ['311-service-requests', 'permits-licensing', 'inspections', 'public-safety', 'property-land', 'elections', 'education'],
  },
  'nyc-charter': { serverType: 'npm-package', place: NYC, categories: ['law-rules'] },
  'nyc-checkbook': { serverType: 'npm-package', place: NYC, categories: ['spending-contracts', 'budget-finance', 'payroll-workforce'] },
  'nyc-record': { serverType: 'npm-package', place: NYC, categories: ['public-notices', 'spending-contracts'] },
  'nys-legislation': {
    serverType: 'npm-package',
    place: { country: 'US', level: 'state', names: ['New York State', 'New York'] },
    categories: ['legislation', 'law-rules'],
  },
};

const sha256OfText = (text) => createHash('sha256').update(text).digest('hex');

/** sha256 of a source's tools as the router serializes them (bare view). The
 *  schemas hold booleans and numbers, which `canonicalJson` refuses, so this
 *  hash is over `JSON.stringify`'s text. */
export const toolsSha256 = (tools) => sha256OfText(JSON.stringify(tools));

/** The router's data fields of a manifest entry, as an inventory carries
 *  them: strings only, absent fields left out. */
export function routerDataFields(entry) {
  const configuration = Object.fromEntries(Object.entries(entry.configuration).filter(([, v]) => v !== undefined));
  return {
    id: entry.id,
    alias: entry.alias,
    sourceId: entry.sourceId,
    displayName: entry.displayName,
    description: entry.description,
    freshness: entry.freshness,
    ...(entry.freshnessSource !== undefined ? { freshnessSource: entry.freshnessSource } : {}),
    configuration,
    consentDefault: entry.consentDefault,
    ...(entry.publisher !== undefined ? { publisher: entry.publisher } : {}),
  };
}

async function entryOf(entry, view) {
  const curated = CURATED[entry.sourceId];
  if (!curated) throw new Error(`build: no curation for ${entry.sourceId}`);
  const block = await entry.guidance.fetchText({ portal: undefined, publicationHost: PUBLICATION_HOST, ...offlineFetchers }, view);
  const guidanceRef =
    entry.sourceId === 'socrata'
      ? { kind: 'prompt', fetch: 'skill-guidance', pinned: SOCRATA_GUIDANCE_PATH, pinnedSha256: SOCRATA_GUIDANCE_FILE_SHA256, blockSha256: sha256OfText(block) }
      : block === ''
        ? { kind: 'none' }
        : { kind: 'embedded', instructions: 'none', publicationHost: PUBLICATION_HOST, blockSha256: sha256OfText(block) };
  return {
    kind: 'server',
    ...routerDataFields(entry),
    ...(entry.configuration.keyVariable ? { authentication: { kind: 'instance-key', keyVariable: entry.configuration.keyVariable } } : {}),
    serverType: curated.serverType,
    place: curated.place,
    categories: curated.categories,
    provenance: {
      addedOn: ADDED_ON,
      from: 'hand',
      by: `the router's manifest (${ROUTER}), copied by benchmark/inventories/build.mjs`,
      sourceUrl: `packages/civic-typed-router/src/civic/${ROUTER_MODULE[entry.sourceId]}`,
    },
    toolsRef: {
      kind: 'router-manifest',
      package: ROUTER,
      sourceId: entry.sourceId,
      toolNames: [...entry.toolNames],
      sha256: toolsSha256(entry.tools),
      ...(TOOLS_FIXTURE[entry.sourceId] ? { fixture: `packages/civic-typed-router/src/__fixtures__/${TOOLS_FIXTURE[entry.sourceId]}` } : {}),
    },
    guidanceRef,
  };
}

/** The 7-entry inventory. */
export async function buildInventory7() {
  const view = createCivicRouter(CIVIC_MANIFEST).aliasedView;
  return {
    schema: 'civic-inventory/1',
    id: INVENTORY_7.id,
    version: INVENTORY_7.version,
    note: `Today's seven sources, from the router's manifest (${ROUTER}), in its order. The baseline configuration (baseline-7) leaves Boston OpenContext unconfigured, as production does; the inventory lists all seven.`,
    entries: await Promise.all(CIVIC_MANIFEST.map((entry) => entryOf(entry, view))),
  };
}

/** The inventory's hash: SHA-256 of the router's canonical JSON. */
export const inventoryHash = (inventory) => sha256Hex(canonicalJson(inventory));

/** Every file this script writes, as `{ path, text }`, paths relative to this
 *  directory. */
export async function builtFiles() {
  const inventory = await buildInventory7();
  return [
    { path: '7.json', text: jsonDocument(inventory) },
    { path: '7.json.sha256', text: `${inventoryHash(inventory)}\n` },
  ];
}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    console.error('usage: node benchmark/inventories/build.mjs --check | --write');
    process.exit(2);
  }
  const files = await builtFiles();
  if (mode === '--write') {
    for (const f of files) writeFileSync(new URL(f.path, import.meta.url), f.text);
    for (const f of files) console.log(`wrote benchmark/inventories/${f.path}`);
    return;
  }
  const differ = [];
  for (const f of files) {
    let onDisk = null;
    try {
      onDisk = readFileSync(new URL(f.path, import.meta.url), 'utf8');
    } catch {
      onDisk = null;
    }
    if (onDisk !== f.text) differ.push(onDisk === null ? `${f.path} is missing` : `${f.path} differs from its rebuild`);
  }
  if (differ.length) {
    console.error(`build --check: ${differ.join('; ')}. Run with --write and review the diff.`);
    process.exit(1);
  }
  console.log(`build --check: ${files.map((f) => f.path).join(', ')} rebuilt byte for byte.`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();
