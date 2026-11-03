// The rules the inventories are built by: each one a stated function, so an
// entry is derived from its catalog row and never written by hand.
//
//   rank            the seed's order over a key (every "by the seed" below)
//   slug, aliasFor  the alias rule
//   countryCode     a catalog's country, as an inventory's place.country
//   placeNames      a catalog row's place names, from its name and owner_name
//   packDescription the one template a portal pack's description is composed by
//   nearDuplicate   the near-duplicate distractor's description
//   wrapperDescription the wrapper distractor's description
//
// Nothing here reads a file: build.mjs hands each rule its inputs.

import { createHash } from 'node:crypto';

/** The seed every ordering in the inventories is drawn from. */
export const SEED = 'civic-ai-tools S1 P1 inventories, 2026-11-03';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** The seed's rank of `key` for one purpose: the hex SHA-256 of the seed, the
 *  purpose and the key, joined by NUL. Sorting by it ascending is the seed's
 *  order; two keys never tie. */
export const rank = (purpose, key) => sha256(`${SEED}\0${purpose}\0${key}`);

/** `items` in the seed's order for `purpose`, keyed by `keyOf`. */
export function bySeed(items, purpose, keyOf) {
  return items
    .map((item) => ({ item, r: rank(purpose, keyOf(item)) }))
    .sort((a, b) => (a.r < b.r ? -1 : a.r > b.r ? 1 : 0))
    .map((x) => x.item);
}

/** Catalog order: `dataset_count` descending, ties broken by `id` ascending
 *  (UTF-16 code-unit order). */
export const byDatasetCount = (a, b) => b.dataset_count - a.dataset_count || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// --- The alias rule ----------------------------------------------------------------

/** The longest alias (the router's ALIAS_PATTERN). */
export const MAX_ALIAS = 32;

/** The longest name the aliased view exposes before it normalizes one. */
export const MAX_EXPOSED = 64;

/** `text` lowercased, accents dropped, every run of characters outside
 *  `[a-z0-9]` one underscore, none at either end. */
export function slug(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** A registry entry's slug: its name's last segment, less a leading or
 *  trailing "mcp" or "server"; when nothing is left, the last dot-label of
 *  its namespace (`io.github.someone/mcp` → `someone`). */
export function registrySlug(name) {
  const cutAt = name.lastIndexOf('/');
  const namespace = name.slice(0, Math.max(cutAt, 0));
  const core = slug(name.slice(cutAt + 1)).replace(/^(?:(?:mcp|server)_)+|(?:_(?:mcp|server))+$/g, '');
  return core === 'mcp' || core === 'server' || core === '' ? slug(namespace.slice(namespace.lastIndexOf('.') + 1)) : core;
}

/** `text` cut to `max` characters with no underscore at its end. */
const cut = (text, max) => text.slice(0, max).replace(/_+$/, '');

/**
 * THE ALIAS RULE. An entry's alias is the slug of its key (a portal's URL
 * without its scheme, `portalOf`; a registry name's `registrySlug`), with:
 *   1. a leading `_` when the slug starts with a digit (an alias starts with a
 *      letter or an underscore);
 *   2. `_` and the first six hex characters of the SHA-256 of the full key
 *      appended when another member of the universe has the same slug (the
 *      universe is fixed: every catalog row and registry entry any size could
 *      draw, and the eleven servers' own aliases, so an alias never depends on
 *      which size it is in);
 *   3. the result cut and ended the same way when it is longer than `max`,
 *      the smaller of 32 and 62 less the longest tool name the entry carries,
 *      so every exposed name `<alias>__<tool>` is at most 64 characters and
 *      none is normalized.
 * A slug holds no `__` (rule 1 adds one underscore before a digit), so no
 * alias does. build.mjs checks every alias against the router's pattern and
 * for uniqueness, and the router's startup checks run over every file.
 */
export function aliasFor(key, base, { shared, max }) {
  let alias = /^[0-9]/.test(base) ? `_${base}` : base;
  const tag = sha256(key).slice(0, 6);
  if (shared) alias = `${cut(alias, max - 7)}_${tag}`;
  if (alias.length > max) alias = `${cut(alias, max - 7)}_${tag}`;
  return alias;
}

/** The largest alias an entry may have, given its longest tool name. */
export const maxAliasFor = (longestToolName) => Math.min(MAX_ALIAS, MAX_EXPOSED - 2 - longestToolName);

/** A distractor's alias: its original's alias, cut to leave room, and a
 *  suffix (`_2` for a near-duplicate, `_pack` for a wrapper). */
export const suffixedAlias = (alias, suffix, max) => `${cut(alias, max - suffix.length)}${suffix}`;

// --- Place -------------------------------------------------------------------------

/** A catalog's `country` value that is not a two-letter code, as the
 *  inventory writes it: a region or "World" is `multiple`; a country written
 *  out is its code. Any other value stops the build. */
const COUNTRY_WORDS = {
  World: 'multiple',
  Africa: 'multiple',
  Caribbean: 'multiple',
  LatinAmerica: 'multiple',
  Oceania: 'multiple',
  'United Kingdom': 'GB',
  'Telangana, India': 'IN',
};

export function countryCode(value) {
  if (/^[A-Z]{2}$/.test(value)) return value;
  if (Object.hasOwn(COUNTRY_WORDS, value)) return COUNTRY_WORDS[value];
  throw new Error(`countryCode: no rule for the catalog's country "${value}"`);
}

/** A leading "the" and a government's kind ("City of", "County of", ...). */
const GOVERNMENT_PREFIX =
  /^(?:the\s+)?(?:(?:city\s+and\s+county|city|town|village|county|state|commonwealth|borough|township|parish|municipality|district|province|region|republic|government)\s+of\s+(?:the\s+)?)/i;

/** Words that name no place on their own (a government's kind among them).
 *  A candidate made only of these is dropped. */
const GENERIC = new Set(
  'open data opendata portal portals catalog catalogue hub site the of and for performance dashboard dashboards datos abiertos dados abertos donnees données ouvertes geoportal gis repository library platform official public government city town village county state commonwealth borough township parish municipality district province region national portale de del la le les di der die das satu dati aperti offene daten'.split(
    ' ',
  ),
);

/** A portal name's lead: its text before the first separator (`|`, `:`,
 *  `,`, `(`, a dash) or the first generic word after the first word. */
function nameLead(name) {
  const head = name.split(/\s*[|:,(—–]\s*|\s+-\s+/)[0].trim();
  const words = head.split(/\s+/);
  const stop = words.findIndex((w, i) => i > 0 && GENERIC.has(w.toLowerCase()));
  return (stop === -1 ? words : words.slice(0, stop)).join(' ');
}

const stripGovernment = (text) => text.replace(GOVERNMENT_PREFIX, '').trim();

/** THE PLACE-NAME RULE. A catalog row's place names, in order, distinct, each
 *  kept only if one of its words is not generic: the owner's name as given;
 *  the owner's name without a leading government kind ("City of New York" →
 *  "New York"); the portal name's lead, without a leading government kind
 *  ("Chicago, Il Open Data" → "Chicago"). Neither catalog has a place-name
 *  field, so these two fields are what a gazetteer reads. */
export function placeNames(row) {
  const candidates = [row.owner_name.trim(), stripGovernment(row.owner_name.trim()), stripGovernment(nameLead(row.name.trim()))];
  const kept = [];
  for (const c of candidates) {
    if (!c || kept.includes(c)) continue;
    if (c.split(/\s+/).every((w) => GENERIC.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) || !/[\p{L}]/u.test(w))) continue;
    kept.push(c);
  }
  return kept;
}

// --- Descriptions ------------------------------------------------------------------

const article = (phrase) => (/^[aeiou]/i.test(phrase) ? 'an' : 'a');
/** `text` with its first letter lowered, unless the word is an acronym. */
const lowerFirst = (text) => (/^[A-Z][a-z]/.test(text) ? `${text[0].toLowerCase()}${text.slice(1)}` : text);
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** THE PORTAL-PACK TEMPLATE, over a catalog row's fields: the one template
 *  every portal pack's description is composed by, for both catalogs. */
export function packDescription(row, { platform, tools }) {
  const kind = lowerFirst(row.catalog_type);
  return `${sentence(row.name.trim())} ${article(kind)[0].toUpperCase()}${article(kind).slice(1)} ${kind} on ${platform}, published by ${row.owner_name.trim()} (${row.owner_type}, ${row.country_name}), with ${row.dataset_count} datasets. Tools: ${tools}, with the portal fixed to ${portalOf(row)}.`;
}

/** A catalog row's portal, as a pack's filter names it: the URL without its
 *  scheme or a trailing slash. */
export const portalOf = (row) => row.url.replace(/^https?:\/\//, '').replace(/\/+$/, '');

/** THE NEAR-DUPLICATE RULE. Each whole lowercase word in this table is
 *  replaced; a capitalized word (a name) never is. When no word is in the
 *  table, the description's sentences are rotated (the last one first). */
const NEAR_WORDS = {
  portal: 'site',
  portals: 'sites',
  datasets: 'data sets',
  dataset: 'data set',
  published: 'maintained',
  publishes: 'maintains',
  tools: 'functions',
  tool: 'function',
  server: 'service',
  queries: 'requests',
  query: 'request',
  search: 'find',
  live: 'current',
  records: 'entries',
  legislation: 'laws',
};

export function nearDuplicate(text) {
  const swapped = text.replace(/\b[a-z]+\b/g, (w) => (Object.hasOwn(NEAR_WORDS, w) ? NEAR_WORDS[w] : w));
  if (swapped !== text) return swapped;
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
  if (parts && parts.length > 1) return [parts.at(-1).trim(), ...parts.slice(0, -1).map((p) => p.trim())].join(' ');
  throw new Error(`nearDuplicate: no rule changes "${text.slice(0, 60)}"`);
}

/** THE WRAPPER TEMPLATE: a pack over one of the eleven servers, every tool,
 *  no argument fixed. */
export const wrapperDescription = (base) =>
  `A pack over ${base.displayName} (\`${base.alias}\`): its tools under one alias, with no argument fixed. ${sentence(base.description)}`;
