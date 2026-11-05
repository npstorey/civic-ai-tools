// The two rules P3-build adds, on their own: the place filter of
// `shortlist-N` (runner/shortlist.mjs) and the BM25 search of `find_source`
// and `rule-N` (runner/search.mjs). Both are pure functions of the
// question's text and the inventory; neither reads a label.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './load.mjs';

const inventory = (n) => JSON.parse(readFileSync(new URL(`../inventories/${n}.json`, import.meta.url), 'utf8'));
const questions = (n) => JSON.parse(readFileSync(new URL(`../questions/${n}.json`, import.meta.url), 'utf8')).questions;

test('the place filter: the gazetteer drops names made only of generic words', async () => {
  const { gazetteerNames, placeTokens, SHORTLIST_RULE, SHORTLIST_CAP } = await load('runner/shortlist.mjs');
  assert.deepEqual(SHORTLIST_RULE, { id: 'place-filter', version: '1' });
  assert.equal(SHORTLIST_CAP, 25);
  assert.deepEqual(placeTokens('Ayuntamiento de Málaga, ES'), ['ayuntamiento', 'de', 'malaga', 'es']);
  const names = (place, extra = {}) => gazetteerNames({ place: { names: place }, ...extra }).map((n) => n.name);
  assert.deepEqual(names(['U.S. Department of Veterans Affairs', 'Department']), ['U.S. Department of Veterans Affairs']);
  assert.deepEqual(names(['Health', 'Open Data', 'By', 'King County', 'King']), ['King County', 'King']);
  assert.deepEqual(names(['City of Austin'], { catalog: {}, displayName: 'City Data Hub | City of Austin' }), ['City of Austin', 'City Data Hub | City of Austin'], "a catalog pack's display name is the catalog's name");
});

test('the place filter: many-place entries first, then name matches by length, cut at 25, deterministic', async () => {
  const { createShortlister } = await load('runner/shortlist.mjs');
  for (const n of [50, 200, 1000]) {
    const inv = inventory(n);
    const s = createShortlister(inv);
    const many = inv.entries.filter((e) => ['multiple', 'international'].includes(e.place.level)).map((e) => e.alias);
    const noPlace = s.shortlist('What is the difference between a median and a mean?');
    assert.deepEqual(noPlace.aliases, many, `${n}: a question naming no place gets the many-place entries alone`);
    const nyc = s.shortlist('What does the New York City Charter say about the powers of the Public Advocate?');
    assert.deepEqual(nyc.aliases.slice(0, many.length), many);
    assert.ok(nyc.aliases.includes('nyc_charter') && nyc.aliases.includes('nys_legislation'));
    assert.ok(nyc.aliases.indexOf('nyc_charter') < nyc.aliases.indexOf('nys_legislation'), '"New York City" is a longer match than "New York"');
    assert.deepEqual(nyc.listed, inv.entries.map((e) => e.alias).filter((a) => nyc.aliases.includes(a)), 'listed in the inventory’s order');
    for (const q of questions(n)) {
      const a = s.shortlist(q.text);
      assert.ok(a.aliases.length <= 25);
      assert.deepEqual(createShortlister(inv).shortlist(q.text), a, 'the same twice');
    }
    assert.ok(!s.shortlist('Which registry servers cover Boston?').aliases.some((a) => inv.entries.find((e) => e.alias === a).place.level === 'unstated'), 'the filter never lists an entry of unstated place');
  }
  const capped = createShortlister(inventory(1000), 3).shortlist('New York City and New York State');
  assert.equal(capped.aliases.length, 3);
  assert.ok(capped.cut > 0);
});

test("the search: R5's BM25 parameters and tokenizer, the top ten above 0, ties in the inventory's order", async () => {
  const { BM25, SEARCH_METHOD, createIndex, tokenize } = await load('runner/search.mjs');
  assert.deepEqual(BM25, { k1: 1.2, b: 0.75, top: 10 });
  assert.deepEqual(SEARCH_METHOD, { method: 'bm25', version: '1' });
  assert.deepEqual(tokenize('The Permits, issued by Chicago’s buildings'), ['permit', 'issued', 'chicago', 's', 'building'], "R5's tokenizer, unchanged: an apostrophe splits a word");
  const entries = [
    { alias: 'a_permits', displayName: 'Permits', description: 'Building permits in Chicago.' },
    { alias: 'b', displayName: 'Other', description: 'Nothing here.' },
    { alias: 'c_permits', displayName: 'Permits', description: 'Building permits in Chicago.' },
  ];
  const idx = createIndex(entries);
  assert.deepEqual(idx.search('Chicago building permits'), ['a_permits', 'c_permits'], 'equal scores keep the inventory order; a zero score is no hit');
  assert.deepEqual(idx.search(''), []);
  const big = createIndex(inventory(1000).entries);
  const hits = big.search('New York City subway service alerts');
  assert.equal(hits.length, 10);
  assert.deepEqual(big.search('New York City subway service alerts'), hits);
});
