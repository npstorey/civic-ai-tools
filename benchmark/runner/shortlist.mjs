// The deterministic shortlist of `shortlist-N` and `shortlist+search-N`: a
// place filter over the inventory and a cap of 25 lines (design §1.4, option
// B). No model, no search; a pure function of the question's text and the
// inventory.
//
// THE RULE, `place-filter` version 1.
//
//   1. The gazetteer. Each entry's names are its `place.names` and, for an
//      entry with a `catalog`, its `displayName`. For a portal pack those are
//      the catalogs' two fields: P1's place-name rule derived `place.names`
//      from the catalog row's `owner_name` (its first name, as given) and
//      `name`, and `displayName` is the catalog's `name` as given (both hold
//      on every catalog pack of the 1,000-entry file). A name is kept only
//      when one of its tokens is not in `GAZETTEER_STOP` (below): a name made
//      only of such words ("Department", "Health", "Open Data") names no
//      place.
//   2. Tokens. A text is normalized (NFKD, combining marks removed),
//      lower-cased and split on anything not a letter or a digit.
//   3. A match. A name matches a question when its tokens occur in the
//      question's tokens as a contiguous run.
//   4. The shortlist, in this order, cut at the first 25:
//        (a) every entry whose `place.level` is `multiple` or `international`
//            (it covers many places, so no place in a question rules it out),
//            in the inventory's order;
//        (b) every other entry with a matching name, the entry whose longest
//            matching name is longer first (in tokens, then in characters),
//            ties in the inventory's order.
//   5. A question that names no place gets (a) alone. A name that fits
//      several places ("Springfield") matches every entry that carries it: the
//      filter does not choose among them. An entry whose place is `unstated`
//      (an MCP Registry entry) has no name and is not `multiple`, so the
//      filter never lists it; `find_source` can reach it.
//
// The order of step 4 decides which entries the cap keeps. The directory the
// model reads lists the kept entries in the inventory's (manifest) order, as
// the router lists any selection.

import { STOPWORDS } from './search.mjs';

/** The rule and its version, as the routing configuration names them. */
export const SHORTLIST_RULE = Object.freeze({ id: 'place-filter', version: '1' });

/** The cap on the shortlist's lines. */
export const SHORTLIST_CAP = 25;

/** The generic words of P1's place-name rule (`inventories/rules.mjs`,
 *  `GENERIC`), copied. */
export const P1_GENERIC_WORDS =
  'open data opendata portal portals catalog catalogue hub site the of and for performance dashboard dashboards datos abiertos dados abertos donnees données ouvertes geoportal gis repository library platform official public government city town village county state commonwealth borough township parish municipality district province region national portale de del la le les di der die das satu dati aperti offene daten';

/** Words naming an institution, a subject or a platform, written here from
 *  the gazetteer's one- and two-word names (the inventories, not the
 *  questions). */
export const INSTITUTION_WORDS =
  'department office agency bureau authority commission division administration ministry council board health local international network provincial regional school schools university college community financial finance treasury transport transportation transit police justice development humanitarian internet neighborhood spatial centre center publications metadata information services service statistics statistical ckan socrata datasets dataset catalogo plataforma portail ville comune generalitat capitol cohesion aids';

/** Words that name no place on their own: R5's stopwords, P1's generic
 *  words and the institution words. */
export const GAZETTEER_STOP = Object.freeze(new Set([...STOPWORDS, ...P1_GENERIC_WORDS.split(' '), ...INSTITUTION_WORDS.split(' ')]));

/** A text's tokens under step 2. */
export function placeTokens(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** An entry's gazetteer names (step 1), each with its tokens. */
export function gazetteerNames(entry) {
  const raw = [...(entry.place?.names ?? []), ...(entry.catalog ? [entry.displayName] : [])];
  const seen = new Set();
  const out = [];
  for (const name of raw) {
    const tokens = placeTokens(name);
    const key = tokens.join(' ');
    if (!tokens.length || seen.has(key) || tokens.every((t) => GAZETTEER_STOP.has(t))) continue;
    seen.add(key);
    out.push({ name, tokens });
  }
  return out;
}

const occurs = (needle, hay) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

const MANY_PLACES = new Set(['multiple', 'international']);

/** A shortlister over one inventory. */
export function createShortlister(inventory, cap = SHORTLIST_CAP) {
  const entries = inventory.entries.map((e, order) => ({ alias: e.alias, order, many: MANY_PLACES.has(e.place?.level), names: gazetteerNames(e) }));
  return {
    /** The shortlist for `text`: `{ aliases, listed }`, `aliases` the kept
     *  entries in step 4's order and `listed` the same set in the
     *  inventory's order; each match with the name that matched. */
    shortlist(text) {
      const q = placeTokens(text);
      const many = entries.filter((e) => e.many);
      const matched = [];
      for (const e of entries) {
        if (e.many) continue;
        let best = null;
        for (const n of e.names) {
          if (!occurs(n.tokens, q)) continue;
          if (!best || n.tokens.length > best.tokens.length || (n.tokens.length === best.tokens.length && n.tokens.join(' ').length > best.tokens.join(' ').length)) best = n;
        }
        if (best) matched.push({ ...e, best });
      }
      matched.sort((a, b) => b.best.tokens.length - a.best.tokens.length || b.best.tokens.join(' ').length - a.best.tokens.join(' ').length || a.order - b.order);
      const kept = [...many, ...matched].slice(0, cap);
      return {
        aliases: kept.map((e) => e.alias),
        listed: [...kept].sort((a, b) => a.order - b.order).map((e) => e.alias),
        matches: matched.map((e) => ({ alias: e.alias, name: e.best.name })),
        cut: many.length + matched.length - kept.length,
      };
    },
  };
}
