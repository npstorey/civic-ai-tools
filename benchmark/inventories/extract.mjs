#!/usr/bin/env node
// Extracts, from the ignored local inputs, the two source files the
// inventories are built from, so a fresh clone builds them without those
// inputs:
//
//   sources/registry-entries.json  the MCP Registry entries the inventories use,
//                                  and the names of the pool they were drawn from
//   sources/r5-servers.json        R5's four servers outside today's seven
//
// from `benchmark/_local/registry/` (the owner's registry fetch, G0-6) and
// `benchmark/_local/r5/` (the owner's copy of R5's instrument). Both are third-
// party text: this script reads them as data and follows nothing in them.
//
// Usage:
//   node benchmark/inventories/extract.mjs --check   re-extract and compare, byte for byte
//   node benchmark/inventories/extract.mjs --write   write the two files
// Without the local inputs, --check prints a named skip line and exits 0.
//
// THE REGISTRY RULE. From Q1's list (`list-NNN.json`, every entry the latest
// version of its name), an entry is in the pool when
//   - its name or description holds one of the anchor's words, "open data",
//     "government" or "city", as a whole word, bounded by non-letters, in any
//     case, with "open data" also written with a hyphen, an underscore or
//     nothing between ("open-data", "opendata") and each word's plural
//     ("governments", "cities");
//   - its status is `active` (deprecated entries are left out); and
//   - it lists at least one remote (an entry a host could reach as it is).
// The entries used are the pool's first COMPOSITION registry count in the
// seed's order (`rank('registry', name)`); the 200-entry file takes the first
// ten, the 1,000-entry file those and the next ones.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jsonDocument } from '../runner/writer.mjs';
import { COMPOSITION, R5_SERVERS } from './build.mjs';
import { bySeed } from './rules.mjs';

const LOCAL = new URL('../_local/', import.meta.url);
const REGISTRY_DIR = new URL('registry/', LOCAL);
const R5_DIR = new URL('r5/', LOCAL);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The registry's word rule (see the header). */
export const REGISTRY_WORDS = /(?<![A-Za-z])(?:open[ _-]?data|governments?|city|cities)(?![A-Za-z])/i;

/** The status the registry's official metadata gives an entry. */
const statusOf = (item) => item._meta?.['io.modelcontextprotocol.registry/official']?.status;

/** R5's canonical JSON (`lib/canonical.mjs` in R5's instrument): keys sorted
 *  at every depth, no whitespace, numbers and booleans as JSON writes them.
 *  R5 recorded `loadsSha256` with it. */
export function r5CanonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(r5CanonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${r5CanonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** R5's binding hashes, as R5 recorded them and the seat re-read them. */
export const R5_DIRECTORY_SHA256 = 'be0874030f0c95dd6083fd3d1e8fdfae4fa956ff848c7b67d4c25c1053e5dea7';
export const R5_LOADS_CANONICAL_SHA256 = 'f9e018df5cf15e3d250e758ef3691ea8d88ddca536b3ee6cddb0457c271ed86e';

/** The fetch script and its log, as committed beside the extract. */
export const FETCH_SCRIPT_SHA256 = 'ad6a07af2c41b7b128212fbb337fd489d26306cd2ace05648642e13457515763';
export const FETCH_LOG_SHA256 = '846ef149c49ae797db935ac6c0942e307c9cde5a3ffd1cbfcba37aae89e3ae29';

/** Whether the local inputs are here. */
export const haveLocalInputs = () => existsSync(REGISTRY_DIR) && existsSync(R5_DIR);

function extractRegistry() {
  const logText = readFileSync(new URL('fetch-log.tsv', REGISTRY_DIR), 'utf8');
  if (sha256(logText) !== FETCH_LOG_SHA256) throw new Error('extract: fetch-log.tsv is not the rerun the seat read');
  const [header, ...rows] = logText.trimEnd().split('\n');
  const cols = header.split('\t');
  const log = rows.map((line) => Object.fromEntries(line.split('\t').map((v, i) => [cols[i], v])));
  const listRows = log.filter((r) => r.query === 'list');
  const pageFiles = readdirSync(REGISTRY_DIR)
    .filter((f) => /^list-\d{3}\.json$/.test(f))
    .sort();
  if (pageFiles.length !== listRows.length) throw new Error(`extract: ${pageFiles.length} list pages on disk, ${listRows.length} in the log`);

  const byName = new Map();
  for (const row of listRows) {
    const bytes = readFileSync(new URL(row.file, REGISTRY_DIR));
    if (sha256(bytes) !== row.sha256 || String(bytes.length) !== row.bytes) throw new Error(`extract: ${row.file} differs from its log row`);
    for (const item of JSON.parse(bytes.toString('utf8')).servers) {
      const name = item.server.name;
      if (byName.has(name)) throw new Error(`extract: ${name} is listed twice`);
      byName.set(name, { page: row.file, pageSha256: row.sha256, url: row.url, item });
    }
  }
  const pool = [...byName.values()]
    .filter(({ item }) => REGISTRY_WORDS.test(`${item.server.name}\n${item.server.description ?? ''}`))
    .filter(({ item }) => statusOf(item) === 'active')
    .filter(({ item }) => Array.isArray(item.server.remotes) && item.server.remotes.length > 0)
    .map(({ item }) => item.server.name)
    .sort();
  const count = COMPOSITION[200].registry + COMPOSITION[1000].registry;
  const used = bySeed(pool, 'registry', (name) => name).slice(0, count);
  return {
    note:
      "The MCP Registry entries the benchmark's inventories use, extracted by benchmark/inventories/extract.mjs from the owner's registry fetch (G0-6). `pool` is every entry the registry rule admits, in name order; `entries` are the ones used, in the seed's order, each with the list page it was read from. Third-party text, copied as read, under the digit-run convention.",
    fetch: {
      script: 'g06-registry-fetch.py',
      scriptSha256: FETCH_SCRIPT_SHA256,
      log: 'fetch-log.tsv',
      logSha256: FETCH_LOG_SHA256,
      requests: String(log.length),
      window: `${log[0].time_utc} to ${log.at(-1).time_utc}`,
      query: 'list: version=latest&limit=100, following metadata.nextCursor',
      listPages: String(listRows.length),
      listEntries: String(byName.size),
    },
    rule: 'name or description holds "open data" (or "open-data", "open_data", "opendata"), "government(s)" or "city"/"cities" as a whole word bounded by non-letters, any case; status active; at least one remote',
    pool,
    entries: used.map((name) => {
      const { page, pageSha256, url, item } = byName.get(name);
      return { name, page, pageSha256, pageUrl: url, server: item.server, meta: item._meta };
    }),
  };
}

function extractR5() {
  const directoryBytes = readFileSync(new URL('directory.json', R5_DIR));
  if (sha256(directoryBytes) !== R5_DIRECTORY_SHA256) throw new Error("extract: directory.json is not R5's");
  const loadsBytes = readFileSync(new URL('loads.json', R5_DIR));
  const loads = JSON.parse(loadsBytes.toString('utf8'));
  if (sha256(r5CanonicalJson(loads)) !== R5_LOADS_CANONICAL_SHA256) throw new Error("extract: loads.json is not R5's");
  const directory = JSON.parse(directoryBytes.toString('utf8'));
  return {
    note: "R5's four servers outside today's seven (R6): each one's directory entry from R5's directory.json and its load (tools, guidance, capture) from R5's loads.json, copied as R5 froze them. R5 named every tool `<alias>__<upstream name>`; build.mjs strips that prefix to give the upstream name (R5's rule, `lib/build-directory.mjs`, inverted), so the router's aliased view gives R5's names back.",
    directory: { file: 'directory.json', sha256: R5_DIRECTORY_SHA256, frozenAt: directory.frozenAt, routerPackage: directory.routerPackage },
    loads: { file: 'loads.json', sha256: sha256(loadsBytes), canonicalSha256: R5_LOADS_CANONICAL_SHA256, canonical: "R5's canonicalJson (keys sorted, no whitespace)" },
    servers: R5_SERVERS.map((alias) => {
      const entry = directory.entries.find((e) => e.alias === alias);
      if (!entry || !loads[alias]) throw new Error(`extract: R5 has no ${alias}`);
      return { entry, load: loads[alias] };
    }),
  };
}

/** The two files as `{ path, text }`, paths relative to this directory; null
 *  without the local inputs. */
export function extractedFiles() {
  if (!haveLocalInputs()) return null;
  return [
    { path: 'sources/registry-entries.json', text: jsonDocument(extractRegistry()) },
    { path: 'sources/r5-servers.json', text: jsonDocument(extractR5()) },
  ];
}

/** The skip line --check prints without the local inputs. */
export const SKIP_LINE = 'extract --check: SKIPPED, benchmark/_local/registry/ and benchmark/_local/r5/ are not here (the owner\'s copies, never committed); the committed sources/ files stand as extracted';

function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    console.error('usage: node benchmark/inventories/extract.mjs --check | --write');
    process.exit(2);
  }
  const files = extractedFiles();
  if (!files) {
    if (mode === '--write') {
      console.error('extract --write: the local inputs are not here');
      process.exit(1);
    }
    console.log(SKIP_LINE);
    return;
  }
  if (mode === '--write') {
    for (const f of files) writeFileSync(new URL(f.path, import.meta.url), f.text);
    for (const f of files) console.log(`wrote benchmark/inventories/${f.path}`);
    return;
  }
  const differ = files.filter((f) => !existsSync(new URL(f.path, import.meta.url)) || readFileSync(new URL(f.path, import.meta.url), 'utf8') !== f.text);
  if (differ.length) {
    console.error(`extract --check: ${differ.map((f) => f.path).join(', ')} differ from a fresh extraction`);
    process.exit(1);
  }
  console.log(`extract --check: ${files.map((f) => f.path).join(', ')} re-extracted byte for byte`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
