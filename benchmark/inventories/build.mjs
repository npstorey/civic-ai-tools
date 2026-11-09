#!/usr/bin/env node
// Builds the benchmark's inventories, deterministically, from their sources:
// 7.json, 50.json, 200.json and 1000.json, each with its hash beside it.
//
// Usage:
//   node benchmark/inventories/build.mjs --check   rebuild and compare, byte for byte; exit 1 on a difference
//   node benchmark/inventories/build.mjs --write   write every file
//
// THE FORMAT is the design's §3.2 (`civic-inventory/1`), checked by
// `schema.json`. Every value in an inventory is a string, an array or an
// object: the router's `canonicalJson`, which hashes it, refuses numbers,
// booleans and null. So a count is written as a string, `synthetic` is
// "true", and a field with nothing to say is left out.
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
//
// THE OTHER ENTRIES (50, 200, 1,000), every one derived by a rule in
// `rules.mjs` from a committed source (`sources.mjs`), never written by hand:
//   - R5's four servers outside the seven: R5's directory entry and tools
//     (`sources/r5-servers.json`), the place and categories curated here;
//   - Socrata portal packs: one per catalog row, over the `socrata` server;
//   - CKAN portal packs: one per catalog row, over a copy of Boston
//     OpenContext's six `ckan__*` tools standing in for a generic CKAN server
//     that no instance runs, so each is marked `hosting: container` (G0-5);
//   - MCP Registry entries: no tools (`tools: not-captured`); a load returns
//     `REGISTRY_LOAD_TEXT` (`load-text.mjs`);
//   - distractors (`synthetic: "true"`): near-duplicates of a real entry and
//     wrapper packs over a real server. Each names the entry it copies; none
//     names a publisher.
// Each file lists its entries in the seed's order (`rank('order', alias)`), so
// an entry's place in the directory carries no signal of where it came from,
// and the entries two sizes share keep their order.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ALIAS_PATTERN, canonicalJson, CIVIC_MANIFEST, sha256Hex } from '@typedstandards/civic-typed-router';
import { jsonDocument } from '../runner/writer.mjs';
import { offlineFetchers, PUBLICATION_HOST, SOCRATA_GUIDANCE_FILE_SHA256, SOCRATA_GUIDANCE_PATH } from './guidance.mjs';
import {
  aliasFor,
  byDatasetCount,
  bySeed,
  countryCode,
  maxAliasFor,
  nearDuplicate,
  packDescription,
  placeNames,
  portalOf,
  registrySlug,
  SEED,
  slug,
  suffixedAlias,
  wrapperDescription,
} from './rules.mjs';
import { CATALOGS, readCatalog, readR5Extract, readRegistryExtract, WEBSITE_SOURCE } from './sources.mjs';

// The router version the seven were copied at (S2-A P0, A0.4): a constant, so a router release does not rebuild 7.json.
const ROUTER = '@typedstandards/civic-typed-router@0.6.0';

/** The inventory's identity. The version is a date and a counter (§3.3). */
export const INVENTORY_7 = { id: 'civic-7', version: '2026-11-02.1' };

/** The other three, by size. */
export const INVENTORIES = Object.freeze({
  50: { id: 'civic-50', version: '2026-11-03.1' },
  200: { id: 'civic-200', version: '2026-11-03.1' },
  1000: { id: 'civic-1000', version: '2026-11-03.1' },
});

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

/** R5's four servers outside today's seven, in R5's directory order (R6). */
export const R5_SERVERS = Object.freeze(['nyc_budget', 'nyc_council', 'nyc_311', 'nyc_mta']);

/** The day the seven were copied in, for `provenance.addedOn`. */
const ADDED_ON = '2026-11-02';
/** The day every other entry was built. */
const ADDED_ON_P1 = '2026-11-03';
/** The day the registry pages were read (fetch-log.tsv, UTC). */
const REGISTRY_READ_ON = '2026-11-03';

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

/** The same, curated for R5's four from each one's R5 description; with the
 *  address each one's own id names, for `provenance.sourceUrl`. */
const CURATED_R5 = {
  nyc_budget: { serverType: 'npm-package', place: NYC, categories: ['budget-finance', 'spending-contracts'], sourceUrl: 'https://www.npmjs.com/package/@betanyc/nyc-budget-mcp/v/1.3.1' },
  nyc_council: { serverType: 'npm-package', place: NYC, categories: ['legislation'], sourceUrl: 'https://www.npmjs.com/package/@betanyc/nyc-council-mcp/v/2.6.0' },
  nyc_311: { serverType: 'npm-package', place: NYC, categories: ['311-service-requests', 'government-operations'], sourceUrl: 'https://www.npmjs.com/package/@betanyc/nyc-311-mcp/v/1.1.0' },
  nyc_mta: { serverType: 'custom', place: NYC, categories: ['transportation'], sourceUrl: 'https://github.com/BetaNYC/mta-mcp' },
};

/** Every portal pack's categories: neither catalog has a category field, so a
 *  pack carries the general portal's list, the Socrata server's. */
const PORTAL_CATEGORIES = CURATED.socrata.categories;

/** A CKAN pack's freshness line (Boston OpenContext's names Boston). */
const CKAN_FRESHNESS = "Live: each call would query the portal's CKAN API as it stands; each dataset updates on its publisher's schedule.";

/** A registry entry's freshness line and place: the registry states neither. */
const REGISTRY_FRESHNESS = 'Not stated: the MCP Registry entry says nothing about how current its data is.';
const UNSTATED_PLACE = Object.freeze({ country: 'unstated', level: 'unstated', names: [] });

/** Who built the packs and the distractors. No entry names a publisher it
 *  does not have: a pack's author is this script. */
const PACK_AUTHOR = 'benchmark/inventories/build.mjs';
const PACK_VERSION = '1.0.0';

/** The note each CKAN pack's tools carry. */
const CKAN_TOOLS_NOTE =
  "A copy of Boston OpenContext's six ckan__* tools from the router's manifest, standing in for a generic CKAN server: no instance runs one, so the pack is listed as a container (G0-5).";

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

/** Router 0.6.0's seven, frozen (hub #309, S2-B): every value this file and
 *  `to-manifest.mjs` read of the seven, in `CIVIC_MANIFEST`'s order at 0.6.0.
 *  The seven are built from it, never from the live router, so a router
 *  release that changes a source (0.8.0 makes City Record a pack) does not
 *  rebuild 7.json. */
export const SEVEN_PATH = 'benchmark/inventories/sources/router-0.6.0-seven.json';

/** The frozen copy, parsed: `{ router, note, entries }`, each entry the
 *  router's data fields with its `toolNames`, `tools` (bare view),
 *  `guidanceBlock`, `prompt` strings and `hostings`. */
export function readSeven() {
  return JSON.parse(readFileSync(new URL('./sources/router-0.6.0-seven.json', import.meta.url), 'utf8'));
}

/** One of the seven, from its frozen copy. */
function entryOf(entry) {
  const curated = CURATED[entry.sourceId];
  if (!curated) throw new Error(`build: no curation for ${entry.sourceId}`);
  const block = entry.guidanceBlock;
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

/** The 7-entry inventory, from router 0.6.0's frozen seven. */
export async function buildInventory7() {
  const seven = readSeven();
  if (seven.router !== ROUTER) throw new Error(`build: ${SEVEN_PATH} is ${seven.router}'s seven, not ${ROUTER}'s`);
  return {
    schema: 'civic-inventory/1',
    id: INVENTORY_7.id,
    version: INVENTORY_7.version,
    note: `Today's seven sources, from the router's manifest (${ROUTER}), in its order. The baseline configuration (baseline-7) leaves Boston OpenContext unconfigured, as production does; the inventory lists all seven.`,
    entries: seven.entries.map(entryOf),
  };
}

// --- R5's four servers ---------------------------------------------------------------

/** The repository path of an extract, for `toolsRef.path` and `provenance.file`. */
const repoPath = (rel) => `benchmark/inventories/${rel}`;

/** R5's tools for one server, each name back to its upstream name: R5 named
 *  every tool `<alias>__<upstream name>` and changed nothing else. */
export function r5UpstreamTools(server) {
  const prefix = `${server.entry.alias}__`;
  return server.load.tools.map((tool) => {
    if (!tool.function.name.startsWith(prefix)) throw new Error(`build: R5's ${tool.function.name} lacks the prefix ${prefix}`);
    return { ...tool, function: { ...tool.function, name: tool.function.name.slice(prefix.length) } };
  });
}

function r5ServerEntry(server, extract) {
  const { entry } = server;
  const curated = CURATED_R5[entry.alias];
  const tools = r5UpstreamTools(server);
  return {
    kind: 'server',
    id: entry.id,
    alias: entry.alias,
    sourceId: entry.sourceId,
    displayName: entry.displayName,
    description: entry.description,
    freshness: entry.freshness,
    freshnessSource: entry.freshnessSource,
    configuration: entry.configuration,
    consentDefault: 'on',
    serverType: curated.serverType,
    place: curated.place,
    categories: curated.categories,
    provenance: {
      addedOn: ADDED_ON_P1,
      from: 'hand',
      by: `R5's frozen directory (directory.json, sha256 ${extract.json.directory.sha256}), one of its four servers outside today's seven, copied by benchmark/inventories/build.mjs`,
      sourceUrl: curated.sourceUrl,
      file: repoPath('sources/r5-servers.json'),
      fileSha256: extract.sha256,
    },
    toolsRef: {
      kind: 'fixture',
      path: repoPath('sources/r5-servers.json'),
      sourceId: entry.sourceId,
      toolNames: tools.map((t) => t.function.name),
      sha256: toolsSha256(tools),
    },
    guidanceRef: { kind: 'none' },
  };
}

// --- The catalogs, the registry, and the alias universe ------------------------------

/** Everything a size draws from, read once. */
function loadSources() {
  const socrata = readCatalog('socrata');
  const ckan = readCatalog('ckan');
  const registry = readRegistryExtract();
  const r5 = readR5Extract();
  const socrataActive = socrata.filter((row) => row.status === 'active');
  const socrataCountry = socrataActive.filter((row) => row.country !== '');
  const ckanActive = ckan.filter((row) => row.status === 'active');
  const byId = new Map(CIVIC_MANIFEST.map((e) => [e.sourceId, e]));

  // THE ALIAS UNIVERSE: every member any size could draw, so an alias is a
  // function of its key alone (rules.mjs, aliasFor, rule 2).
  const members = [
    ...socrataCountry.map((row) => ({ space: 'socrata', key: portalOf(row) })),
    ...ckanActive.map((row) => ({ space: 'ckan', key: portalOf(row) })),
    ...registry.json.pool.map((name) => ({ space: 'registry', key: name, base: registrySlug(name) })),
  ].map((m) => ({ ...m, base: m.base ?? slug(m.key) }));
  const reserved = new Set([...CIVIC_MANIFEST.map((e) => e.alias), ...R5_SERVERS]);
  const counts = new Map();
  for (const m of members) {
    const b = /^[0-9]/.test(m.base) ? `_${m.base}` : m.base;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const aliasOf = (space, key, longestTool) => {
    const m = members.find((x) => x.space === space && x.key === key);
    if (!m) throw new Error(`build: ${space} ${key} is not in the alias universe`);
    const b = /^[0-9]/.test(m.base) ? `_${m.base}` : m.base;
    return aliasFor(key, m.base, { shared: counts.get(b) > 1 || reserved.has(b), max: maxAliasFor(longestTool) });
  };
  return { socrata, ckan, socrataActive, socrataCountry, ckanActive, registry, r5, byId, aliasOf };
}

const longest = (names) => Math.max(0, ...names.map((n) => n.length));

function socrataPack(row, src) {
  const base = src.byId.get('socrata');
  const portal = portalOf(row);
  const alias = src.aliasOf('socrata', portal, longest(base.toolNames));
  return {
    kind: 'pack',
    alias,
    sourceId: alias,
    displayName: row.name.trim(),
    base: 'socrata',
    filter: { portal },
    guidance: { kind: 'none' },
    author: PACK_AUTHOR,
    version: PACK_VERSION,
    place: { country: countryCode(row.country), level: row.government_level, names: placeNames(row), portalDomain: portal },
    categories: PORTAL_CATEGORIES,
    description: packDescription(row, { platform: 'Socrata', tools: "the Socrata server's" }),
    freshness: base.freshness,
    provenance: {
      addedOn: ADDED_ON_P1,
      from: 'portal-catalog',
      by: `benchmark/inventories/build.mjs, the portal-pack template over one row of the website's ${CATALOGS.socrata.from}`,
      sourceUrl: row.url,
      file: repoPath(CATALOGS.socrata.path),
      commit: WEBSITE_SOURCE.commit,
      fileSha256: CATALOGS.socrata.sha256,
    },
    catalog: { platform: 'socrata', id: row.id, datasetCount: String(row.dataset_count), ownerType: row.owner_type, status: row.status },
    toolsRef: { kind: 'router-manifest', package: ROUTER, sourceId: 'socrata', toolNames: [...base.toolNames], sha256: toolsSha256(base.tools) },
  };
}

/** Boston OpenContext's `ckan__*` tools: the stand-in a CKAN pack copies. */
function ckanStandIn(src) {
  const boston = src.byId.get('boston-opencontext');
  const tools = boston.tools.filter((t) => t.function.name.startsWith('ckan__'));
  const toolNames = boston.toolNames.filter((n) => n.startsWith('ckan__'));
  if (tools.length !== 6 || toolNames.length !== 6) throw new Error("build: Boston OpenContext no longer has six ckan__ tools");
  return { tools, toolNames };
}

function ckanPack(row, src) {
  const standIn = ckanStandIn(src);
  const portal = portalOf(row);
  const alias = src.aliasOf('ckan', portal, longest(standIn.toolNames));
  return {
    kind: 'pack',
    alias,
    sourceId: alias,
    displayName: row.name.trim(),
    base: 'boston-opencontext',
    filter: { portal },
    guidance: { kind: 'none' },
    author: PACK_AUTHOR,
    version: PACK_VERSION,
    place: { country: countryCode(row.country), level: row.government_level, names: placeNames(row), portalDomain: portal },
    categories: PORTAL_CATEGORIES,
    description: packDescription(row, { platform: 'CKAN', tools: "a copy of Boston OpenContext's six CKAN tools, standing in for a generic CKAN server" }),
    freshness: CKAN_FRESHNESS,
    provenance: {
      addedOn: ADDED_ON_P1,
      from: 'portal-catalog',
      by: `benchmark/inventories/build.mjs, the portal-pack template over one row of the website's ${CATALOGS.ckan.from}`,
      sourceUrl: row.url,
      file: repoPath(CATALOGS.ckan.path),
      commit: WEBSITE_SOURCE.commit,
      fileSha256: CATALOGS.ckan.sha256,
    },
    catalog: { platform: 'ckan', id: row.id, datasetCount: String(row.dataset_count), ownerType: row.owner_type, status: row.status },
    hosting: 'container',
    toolsRef: {
      kind: 'router-manifest',
      package: ROUTER,
      sourceId: 'boston-opencontext',
      toolNames: standIn.toolNames,
      sha256: toolsSha256(standIn.tools),
      note: CKAN_TOOLS_NOTE,
    },
  };
}

function registryEntry(item, src) {
  const s = item.server;
  if (!s.description) throw new Error(`build: registry entry ${s.name} has no description`);
  const alias = src.aliasOf('registry', s.name, 0);
  return {
    kind: 'server',
    id: s.name,
    alias,
    sourceId: alias,
    displayName: s.title || s.name,
    description: s.description,
    freshness: REGISTRY_FRESHNESS,
    configuration: { addressVariable: `${alias.toUpperCase()}_MCP_URL`, requirement: 'optional' },
    consentDefault: 'on',
    serverType: 'mcp-remote',
    place: UNSTATED_PLACE,
    categories: [],
    registry: { name: s.name, version: s.version, readOn: REGISTRY_READ_ON },
    provenance: {
      addedOn: ADDED_ON_P1,
      from: 'registry',
      by: `benchmark/inventories/build.mjs, from the MCP Registry list read ${src.registry.json.fetch.window} (fetch-log.tsv sha256 ${src.registry.json.fetch.logSha256})`,
      sourceUrl: item.pageUrl,
      file: item.page,
      fileSha256: item.pageSha256,
    },
    tools: 'not-captured',
  };
}

// --- The distractors ---------------------------------------------------------------

/** The longest tool name an entry carries. */
const longestTool = (entry) => longest(entry.toolsRef?.toolNames ?? []);

/** The fields a distractor copies from the entry it copies or wraps. */
function copiedToolsRef(entry) {
  return { ...entry.toolsRef };
}

function nearDuplicateOf(original) {
  const alias = suffixedAlias(original.alias, '_2', maxAliasFor(longestTool(original)));
  const isPack = original.kind === 'pack';
  return {
    kind: 'pack',
    alias,
    sourceId: alias,
    displayName: original.displayName,
    base: isPack ? original.base : original.sourceId,
    filter: isPack ? { ...original.filter } : {},
    guidance: { kind: 'none' },
    author: PACK_AUTHOR,
    version: PACK_VERSION,
    place: original.place,
    categories: original.categories,
    description: nearDuplicate(original.description),
    freshness: original.freshness,
    provenance: {
      addedOn: ADDED_ON_P1,
      from: 'hand',
      by: `benchmark/inventories/build.mjs, a constructed distractor: the near-duplicate rule (rules.mjs) over \`${original.alias}\``,
      sourceUrl: repoPath('rules.mjs'),
    },
    ...(original.hosting ? { hosting: original.hosting } : {}),
    toolsRef: copiedToolsRef(original),
    synthetic: 'true',
    distractor: { kind: 'near-duplicate', of: original.alias },
  };
}

function wrapperOf(server) {
  const alias = suffixedAlias(server.alias, '_pack', maxAliasFor(longestTool(server)));
  return {
    kind: 'pack',
    alias,
    sourceId: alias,
    displayName: `${server.displayName} (pack)`,
    base: server.sourceId,
    filter: {},
    guidance: { kind: 'none' },
    author: PACK_AUTHOR,
    version: PACK_VERSION,
    place: server.place,
    categories: server.categories,
    description: wrapperDescription(server),
    freshness: server.freshness,
    provenance: {
      addedOn: ADDED_ON_P1,
      from: 'hand',
      by: `benchmark/inventories/build.mjs, a constructed distractor: the wrapper template (rules.mjs) over \`${server.alias}\``,
      sourceUrl: repoPath('rules.mjs'),
    },
    toolsRef: copiedToolsRef(server),
    synthetic: 'true',
    distractor: { kind: 'wrapper', of: server.alias },
  };
}

/** Whether a near-duplicate may copy `entry`: a real entry with tools. */
const copyable = (entry) => entry.synthetic === undefined && entry.toolsRef !== undefined;

/** The first `count` entries of `entries` a near-duplicate may copy, in the
 *  seed's order, skipping those `done` already holds. */
function nearDuplicateOriginals(entries, done, count) {
  const picked = bySeed(entries.filter(copyable), 'near-duplicate', (e) => e.alias).filter((e) => !done.has(e.alias)).slice(0, count);
  if (picked.length !== count) throw new Error(`build: ${count} near-duplicates asked, ${picked.length} originals left`);
  for (const e of picked) done.add(e.alias);
  return picked;
}

// --- The sizes ---------------------------------------------------------------------

/** Every entry of the three larger sizes, each tagged with its source, built
 *  once: the 200 holds the 50's entries, the 1,000 the 200's. */
export async function buildLargerInventories() {
  if (COMPOSITION.seed !== SEED) throw new Error('build: the composition names a seed other than rules.mjs');
  const src = loadSources();
  const seven = (await buildInventory7()).entries;
  const servers = [...seven, ...R5_SERVERS.map((alias) => r5ServerEntry(src.r5.json.servers.find((s) => s.entry.alias === alias), src.r5))];
  const tag = (source) => (entry) => ({ source, entry });

  const usSocrata = src.socrataActive.filter((row) => row.country === 'US').sort(byDatasetCount);
  const us50Plus = usSocrata.filter((row) => row.dataset_count >= 50);
  const usOther = usSocrata.filter((row) => row.dataset_count < 50);
  const c50 = COMPOSITION[50];
  const c200 = COMPOSITION[200];
  const c1000 = COMPOSITION[1000];
  if (us50Plus.length !== c50.socrataLargestUS + c200.socrataUS50Plus) throw new Error(`build: ${us50Plus.length} US Socrata domains with 50 or more datasets, not ${c50.socrataLargestUS + c200.socrataUS50Plus}`);

  const wrapperBases = bySeed(servers, 'wrapper', (e) => e.alias);
  const duplicated = new Set();

  // 50
  const real50 = [...servers.map(tag('server')), ...us50Plus.slice(0, c50.socrataLargestUS).map((row) => tag('socrata-pack')(socrataPack(row, src)))];
  const d50 = [
    ...nearDuplicateOriginals(real50.map((x) => x.entry), duplicated, c50.nearDuplicates).map((e) => tag('near-duplicate')(nearDuplicateOf(e))),
    ...wrapperBases.slice(0, c50.wrappers).map((e) => tag('wrapper')(wrapperOf(e))),
  ];
  const all50 = [...real50, ...d50];

  // 200
  const usedSocrata = new Set(us50Plus.slice(0, c50.socrataLargestUS).map((row) => row.id));
  const add200Socrata = [...us50Plus.slice(c50.socrataLargestUS), ...usOther.slice(0, c200.socrataUSOther)];
  for (const row of add200Socrata) usedSocrata.add(row.id);
  const ckanUS = src.ckanActive.filter((row) => row.country === 'US').sort(byDatasetCount).slice(0, c200.ckanUSActive);
  const registry200 = src.registry.json.entries.slice(0, c200.registry);
  const real200add = [
    ...add200Socrata.map((row) => tag('socrata-pack')(socrataPack(row, src))),
    ...ckanUS.map((row) => tag('ckan-pack')(ckanPack(row, src))),
    ...registry200.map((item) => tag('registry')(registryEntry(item, src))),
  ];
  const real200 = [...real50, ...real200add];
  const d200 = [
    ...nearDuplicateOriginals(real200.map((x) => x.entry), duplicated, c200.nearDuplicates).map((e) => tag('near-duplicate')(nearDuplicateOf(e))),
    ...wrapperBases.slice(c50.wrappers, c50.wrappers + c200.wrappers).map((e) => tag('wrapper')(wrapperOf(e))),
  ];
  const all200 = [...all50, ...real200add, ...d200];

  // 1,000
  const restSocrata = src.socrataCountry.filter((row) => !usedSocrata.has(row.id)).sort(byDatasetCount);
  if (restSocrata.length !== c1000.socrataWithCountry) throw new Error(`build: ${restSocrata.length} remaining active Socrata domains carry a country, not the ${c1000.socrataWithCountry} stated`);
  const usedCkan = new Set(ckanUS.map((row) => row.id));
  const moreCkan = src.ckanActive.filter((row) => !usedCkan.has(row.id)).sort(byDatasetCount).slice(0, c1000.ckanActive);
  const registry1000 = src.registry.json.entries.slice(c200.registry, c200.registry + c1000.registry);
  if (registry1000.length !== c1000.registry) throw new Error(`build: ${registry1000.length} registry entries left, ${c1000.registry} stated`);
  const real1000add = [
    ...restSocrata.map((row) => tag('socrata-pack')(socrataPack(row, src))),
    ...moreCkan.map((row) => tag('ckan-pack')(ckanPack(row, src))),
    ...registry1000.map((item) => tag('registry')(registryEntry(item, src))),
  ];
  const remainder = 1000 - all200.length - real1000add.length;
  if (remainder !== c1000.nearDuplicates) throw new Error(`build: the remainder is ${remainder}, not the ${c1000.nearDuplicates} stated`);
  const real1000 = [...real200, ...real1000add];
  const d1000 = nearDuplicateOriginals(real1000.map((x) => x.entry), duplicated, remainder).map((e) => tag('near-duplicate')(nearDuplicateOf(e)));
  const all1000 = [...all200, ...real1000add, ...d1000];

  const sizes = { 50: all50, 200: all200, 1000: all1000 };
  for (const [size, tagged] of Object.entries(sizes)) {
    if (tagged.length !== Number(size)) throw new Error(`build: ${size}.json has ${tagged.length} entries`);
    const aliases = tagged.map((x) => x.entry.alias);
    const bad = aliases.filter((a) => !ALIAS_PATTERN.test(a) || a.includes('__'));
    if (bad.length) throw new Error(`build: aliases outside the router's pattern: ${bad.join(', ')}`);
    const seen = new Set();
    for (const a of aliases) {
      if (seen.has(a)) throw new Error(`build: alias ${a} twice in ${size}.json`);
      seen.add(a);
    }
  }
  return sizes;
}

const NOTES = {
  50: 'The 11 real servers (the seven and R5 four), the 34 largest US Socrata portals as packs, and 5 constructed distractors. Composition and rules: build.mjs and the README.',
  200: 'The 50, the remaining 45 active US Socrata portals with 50 or more datasets, the 70 largest other active US Socrata portals, the 20 largest active US CKAN portals (listed as containers), 10 MCP Registry entries (no tools captured) and 5 more distractors. Composition and rules: build.mjs and the README.',
  1000: 'The 200, every remaining active Socrata portal that carries a country, the next 400 active CKAN portals, 240 more MCP Registry entries, and near-duplicates to fill the file. Composition and rules: build.mjs and the README.',
};

/** An inventory of one of the larger sizes from its tagged entries, in the
 *  seed's order. */
function inventoryOf(size, tagged) {
  return {
    schema: 'civic-inventory/1',
    id: INVENTORIES[size].id,
    version: INVENTORIES[size].version,
    note: NOTES[size],
    seed: SEED,
    entries: bySeed(
      tagged.map((x) => x.entry),
      'order',
      (e) => e.alias,
    ),
  };
}

/** The inventory's hash: SHA-256 of the router's canonical JSON. */
export const inventoryHash = (inventory) => sha256Hex(canonicalJson(inventory));

/** Every inventory, by size. */
export async function buildInventories() {
  const larger = await buildLargerInventories();
  return {
    7: await buildInventory7(),
    50: inventoryOf(50, larger[50]),
    200: inventoryOf(200, larger[200]),
    1000: inventoryOf(1000, larger[1000]),
  };
}

/** Every file this script writes, as `{ path, text }`, paths relative to this
 *  directory. */
export async function builtFiles() {
  const inventories = await buildInventories();
  return [7, 50, 200, 1000].flatMap((size) => [
    { path: `${size}.json`, text: jsonDocument(inventories[size]) },
    { path: `${size}.json.sha256`, text: `${inventoryHash(inventories[size])}\n` },
  ]);
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
