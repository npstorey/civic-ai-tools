// The search (S3-A P1, hub #318; router 0.10.0): method `bm25`, version 1,
// as S1 ran it (`benchmark/runner/search.mjs`).
//
//   A1  For every search S1's committed run records, the router's search
//       over the same inventory file, with no space and the default `top`,
//       returns the same aliases in the same order. The parsed count is 876,
//       so a parse that drops rows fails.
//   A3  With a space, every hit is configured and in the space. Decoy: the
//       best-scoring entry is outside the space; it is not returned, and the
//       result is the first ten of the rest that score above 0, by score and
//       then manifest order. The in-space entries keep their unspaced order:
//       scores do not move with the space. An entry in the space that the
//       configuration does not offer is never a hit. With no space, an entry
//       the configuration does not offer can be a hit (the lock's exception,
//       F2, is A6's, in `pack-lock.test.ts`).
//
// The files are read here, by the test; the search reads no file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  createSearchIndex,
  DATA_COMMONS_ENTRY,
  readMcpEnv,
  SEARCH_DEFAULT_TOP,
  SEARCH_METHOD,
  type CivicManifest,
  type CivicManifestEntry,
  type SearchableEntry,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = join(SRC, '..', '..', '..');

// --- A1: S1's 876 searches ----------------------------------------------------------

const RUN_ROWS = join(REPO, 'benchmark', 'runs', '2026-11-05', '2026-11-05-run-191511', 'rows.jsonl');

interface S1Search {
  readonly query: string;
  readonly hits: readonly string[];
  readonly round?: number;
}

/** Every search the run records, with the size of the inventory its row's
 *  configuration ran over. Lines without a non-empty `searches` array are
 *  skipped before parsing. */
function s1Searches(): { size: number; config: string; search: S1Search }[] {
  const out: { size: number; config: string; search: S1Search }[] = [];
  for (const line of readFileSync(RUN_ROWS, 'utf8').split('\n')) {
    if (!line.includes('"searches":[{')) continue;
    const row = JSON.parse(line) as { config: string; searches: S1Search[] };
    const m = /-(\d+)$/.exec(row.config);
    assert.ok(m, `the row's configuration ${row.config} names its size`);
    for (const search of row.searches) out.push({ size: Number(m[1]), config: row.config, search });
  }
  return out;
}

/** A benchmark inventory's entries, in the file's order. */
function inventoryEntries(size: number): SearchableEntry[] {
  const file = JSON.parse(readFileSync(join(REPO, 'benchmark', 'inventories', `${size}.json`), 'utf8')) as {
    entries: SearchableEntry[];
  };
  return file.entries;
}

test('A1: for each of the 876 searches in S1\'s committed run, the router\'s search over the same inventory returns the same aliases in the same order', () => {
  const searches = s1Searches();
  assert.equal(searches.length, 876, 'the parsed count');
  const byConfig = new Map<string, number>();
  for (const s of searches) byConfig.set(s.config, (byConfig.get(s.config) ?? 0) + 1);
  assert.deepEqual(
    [...byConfig.keys()].sort(),
    ['rule-1000', 'rule-200', 'rule-50', 'shortlist+search-1000', 'shortlist+search-200', 'shortlist+search-50'],
    'the six configurations that searched',
  );

  const indexes = new Map([50, 200, 1000].map((size) => [size, createSearchIndex(inventoryEntries(size))]));
  const differ: string[] = [];
  for (const { size, config, search } of searches) {
    const got = indexes.get(size)!.search(search.query).map((entry) => entry.alias);
    if (JSON.stringify(got) !== JSON.stringify(search.hits)) differ.push(`${config} ${JSON.stringify(search.query)}`);
  }
  assert.deepEqual(differ, [], 'every search returns S1\'s hits');
});

test('A1: the method is bm25 version 1, and the default top is ten', () => {
  assert.deepEqual({ ...SEARCH_METHOD }, { method: 'bm25', version: '1' });
  assert.equal(SEARCH_DEFAULT_TOP, 10);
});

// --- A3 in the core: a space is a filter after scoring ------------------------------

/** Fifteen entries: twelve that hold the query's words at different
 *  strengths (two pairs of equal text, for ties), and three that hold none. */
const CORE_ENTRIES: SearchableEntry[] = [
  { alias: 'a00', displayName: 'Parking tickets', description: 'Parking tickets, parking tickets and more parking tickets.' },
  { alias: 'a01', displayName: 'Street trees', description: 'The census of street trees.' },
  { alias: 'a02', displayName: 'Parking', description: 'Parking tickets issued in the city.' },
  { alias: 'a03', displayName: 'Parking', description: 'Parking tickets issued in the city.' },
  { alias: 'a04', displayName: 'Tickets', description: 'Tickets for events.' },
  { alias: 'a05', displayName: 'Garages', description: 'Parking garages and their capacity.' },
  { alias: 'a06', displayName: 'Meters', description: 'Parking meters by block.' },
  { alias: 'a07', displayName: 'Fines', description: 'Fines, including parking fines and ticket appeals.' },
  { alias: 'a08', displayName: 'Restaurant inspections', description: 'Inspection grades for restaurants.' },
  { alias: 'a09', displayName: 'Permits', description: 'Parking permits for residents.' },
  { alias: 'a10', displayName: 'Permits', description: 'Parking permits for residents.' },
  { alias: 'a11', displayName: 'Tickets', description: 'Speed camera tickets.' },
  { alias: 'a12', displayName: 'Lots', description: 'Municipal parking lots.' },
  { alias: 'a13', displayName: 'Rats', description: 'Rodent inspection results.' },
  { alias: 'a14', displayName: 'Tolls', description: 'Bridge tolls and parking at stations.' },
];
const QUERY = 'parking tickets';
const aliasesOf = (entries: readonly SearchableEntry[]): string[] => entries.map((entry) => entry.alias);

test('A3 (core): with a space, the best-scoring entry outside it is not returned, and the result is the first ten of the rest that score above 0, in the unspaced order', () => {
  const index = createSearchIndex(CORE_ENTRIES);
  const unspaced = aliasesOf(index.search(QUERY, { top: CORE_ENTRIES.length }));
  assert.ok(unspaced.length >= 12, `twelve entries score above 0 (got ${unspaced.length})`);
  assert.ok(!unspaced.includes('a01') && !unspaced.includes('a08') && !unspaced.includes('a13'), 'an entry with none of the words is never a hit');
  const best = unspaced[0];
  const spaced = aliasesOf(index.search(QUERY, { within: (entry) => entry.alias !== best }));
  assert.ok(!spaced.includes(best!), 'the best-scoring entry, outside the space, is not returned');
  assert.equal(spaced.length, 10, 'ten hits, the default top');
  assert.deepEqual(spaced, unspaced.filter((alias) => alias !== best).slice(0, 10), 'the first ten of the rest, in the unspaced order');
  assert.deepEqual(aliasesOf(index.search(QUERY)), unspaced.slice(0, 10), 'with no space, the first ten');
});

test('A3 (core): scores do not move with the space; ties keep the entries\' order; top cuts after the space', () => {
  const index = createSearchIndex(CORE_ENTRIES);
  const unspaced = aliasesOf(index.search(QUERY, { top: CORE_ENTRIES.length }));
  assert.ok(unspaced.indexOf('a02') + 1 === unspaced.indexOf('a03'), 'equal text: a02 then a03, in the entries\' order');
  assert.ok(unspaced.indexOf('a09') + 1 === unspaced.indexOf('a10'), 'equal text: a09 then a10, in the entries\' order');
  for (const space of [['a03', 'a14', 'a02', 'a07'], ['a10', 'a00', 'a09'], ['a12', 'a05', 'a06', 'a11', 'a04', 'a13']]) {
    const inSpace = new Set(space);
    const spaced = aliasesOf(index.search(QUERY, { within: (entry) => inSpace.has(entry.alias), top: CORE_ENTRIES.length }));
    assert.deepEqual(spaced, unspaced.filter((alias) => inSpace.has(alias)), `the space ${space.join(',')} keeps the unspaced order`);
    const two = aliasesOf(index.search(QUERY, { within: (entry) => inSpace.has(entry.alias), top: 2 }));
    assert.deepEqual(two, spaced.slice(0, 2), 'top cuts after the space');
  }
});

// --- A3 in the civic router: the space meets the configuration ----------------------

const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
});
const REQUIRED_ONLY = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });
const NOT_OFFERED_UNDER_REQUIRED_ONLY = ['boston-opencontext', 'nyc-charter', 'nyc-checkbook', 'nys-legislation'];

const idsOf = (hits: readonly { sourceId: string }[]): string[] => hits.map((hit) => hit.sourceId);

test('A3: the civic router\'s search over the manifest equals the core search over the manifest\'s entries, hits named by source id and alias', () => {
  const index = createSearchIndex(CIVIC_MANIFEST);
  for (const query of ['New York City budget spending', 'Boston permits', 'laws of New York State', 'population statistics', 'City Record notices']) {
    const expected = index.search(query).map((entry) => ({ sourceId: entry.sourceId, alias: entry.alias }));
    assert.ok(expected.length > 0, `${query}: some hit`);
    assert.deepEqual(civicRouter.searchSources({ configured: EVERY_SOURCE, query }), expected, query);
  }
});

test('A3: with no space, an entry the configuration does not offer can be a hit', () => {
  const hits = idsOf(civicRouter.searchSources({ configured: REQUIRED_ONLY, query: 'Boston permits and city services' }));
  assert.ok(hits.includes('boston-opencontext'), `Boston OpenContext, not configured, is a hit (${hits.join(', ')})`);
  const laws = idsOf(civicRouter.searchSources({ configured: REQUIRED_ONLY, query: 'New York State laws and bills' }));
  assert.ok(laws.includes('nys-legislation'), `NYS Open Legislation, not configured, is a hit (${laws.join(', ')})`);
});

test('A3: with a space, every hit is configured and in the space; an entry in the space the configuration does not offer is never a hit', () => {
  const all = CIVIC_MANIFEST.map((entry) => entry.sourceId);
  const queries = ['Boston permits and city services', 'New York State laws and bills', 'New York City budget spending', 'City Record notices', 'population statistics'];
  for (const query of queries) {
    for (const space of [all, ['boston-opencontext', 'socrata'], ['nys-legislation', 'nyc-charter', 'data-commons'], ['nyc-record']]) {
      const hits = idsOf(civicRouter.searchSources({ configured: REQUIRED_ONLY, query, space }));
      for (const id of hits) {
        assert.ok(space.includes(id), `${query} / ${space.join(',')}: ${id} is in the space`);
        assert.ok(!NOT_OFFERED_UNDER_REQUIRED_ONLY.includes(id), `${query} / ${space.join(',')}: ${id} is configured`);
      }
      const unspaced = idsOf(civicRouter.searchSources({ configured: REQUIRED_ONLY, query }));
      const expected = unspaced.filter((id) => space.includes(id) && !NOT_OFFERED_UNDER_REQUIRED_ONLY.includes(id));
      assert.deepEqual(hits, expected, `${query} / ${space.join(',')}: the unspaced order, filtered`);
    }
  }
  const boston = idsOf(civicRouter.searchSources({ configured: REQUIRED_ONLY, query: 'Boston permits and city services', space: ['boston-opencontext'] }));
  assert.deepEqual(boston, [], 'Boston OpenContext alone in the space, not configured: no hit');
  const bostonOn = idsOf(civicRouter.searchSources({ configured: EVERY_SOURCE, query: 'Boston permits and city services', space: ['boston-opencontext'] }));
  assert.deepEqual(bostonOn, ['boston-opencontext'], 'the decoy: configured, it is the hit');
  const unknown = idsOf(civicRouter.searchSources({ configured: EVERY_SOURCE, query: 'Boston permits', space: ['no-such-source'] }));
  assert.deepEqual(unknown, [], 'a space id the manifest does not hold is ignored');
});

/** The fork's optional sources: no configuration offers them. */
const FORK_OPTIONAL = new Set(['a01', 'a12', 'a13']);

/** A fork's manifest of fifteen sources: Data Commons' entry, re-named and
 *  re-described, with no tools. Three are optional (`FORK_OPTIONAL`), the
 *  rest required (always offered). */
function forkManifest(): CivicManifest {
  return CORE_ENTRIES.map((source): CivicManifestEntry => ({
    ...DATA_COMMONS_ENTRY,
    id: `fork-${source.alias}@https://example.org/${source.alias}`,
    alias: source.alias,
    sourceId: `fork-${source.alias}`,
    displayName: source.displayName,
    description: source.description,
    configuration: { ...DATA_COMMONS_ENTRY.configuration, requirement: FORK_OPTIONAL.has(source.alias) ? 'optional' : 'required' },
    tools: [],
    toolsFor: undefined,
    toolNames: [],
    prompt: undefined,
  }));
}

test('A3: over a fork\'s fifteen sources, the decoy: the best-scoring source outside the space is not returned; the first ten of the rest that score above 0, by score then manifest order', () => {
  const manifest = forkManifest();
  const router = createCivicRouter(manifest);
  const configured = readMcpEnv({});
  const unspaced = idsOf(router.searchSources({ configured, query: QUERY, top: manifest.length }));
  const coreOrder = createSearchIndex(manifest).search(QUERY, { top: manifest.length }).map((entry) => entry.sourceId);
  assert.deepEqual(unspaced, coreOrder, 'with no space, every source that scores is a hit, configured or not');
  const best = unspaced[0]!;
  const space = manifest.map((entry) => entry.sourceId).filter((id) => id !== best);
  const spaced = idsOf(router.searchSources({ configured, query: QUERY, space }));
  assert.ok(!spaced.includes(best), 'the best-scoring source is not returned');
  const offered = new Set(manifest.filter((entry) => !FORK_OPTIONAL.has(entry.alias)).map((entry) => entry.sourceId));
  assert.deepEqual(spaced, unspaced.filter((id) => id !== best && offered.has(id)).slice(0, 10), 'the first ten of the rest, configured');
  assert.equal(spaced.length, 10, 'ten hits: eleven configured sources score above 0');
  assert.ok(unspaced.includes('fork-a12'), 'the decoy: an optional source scores');
  assert.ok(!spaced.some((id) => !offered.has(id)), 'no optional, unconfigured source, though the space names it');
});
