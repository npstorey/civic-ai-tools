// A1.3 (hub #302, S1 P1): the four inventories' hashes are written into
// benchmark/README.md and into the preregistration, benchmark/preregistration/
// s1.md (the seat's ruling 1, hub #302 comment 6604092796), before any
// question exists. The preregistration's inputs section also quotes the
// registry load text word for word and carries the note on `container`
// entries.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { COMPOSITION } from '../inventories/build.mjs';
import { REGISTRY_LOAD_TEXT } from '../inventories/load-text.mjs';

const read = (rel) => {
  const url = new URL(`../${rel}`, import.meta.url);
  assert.ok(existsSync(url), `benchmark/${rel} exists`);
  return readFileSync(url, 'utf8');
};
const SIZES = [7, 50, 200, 1000];
const hashes = () => SIZES.map((size) => [size, read(`inventories/${size}.json.sha256`).trim()]);

test("A1.3: the four inventories' hashes are in benchmark/README.md", () => {
  const readme = read('README.md');
  for (const [size, hash] of hashes()) assert.match(readme, new RegExp(`\\| \`${size}\\.json\` \\([^)]*\\) \\| \`${hash}\` \\|`), `${size}.json's hash in the README's table`);
});

test("A1.3: the four inventories' hashes are in the preregistration, with its inputs and the seat's two notes", () => {
  const prereg = read('preregistration/s1.md');
  for (const [size, hash] of hashes()) assert.match(prereg, new RegExp(`\\| \`benchmark/inventories/${size}\\.json\` \\|[^|]*\\| \`${hash}\` \\|`), `${size}.json's hash`);
  assert.ok(prereg.includes(`> ${REGISTRY_LOAD_TEXT}\n`), 'the registry load text, word for word');
  assert.match(prereg, /Under D10 the product lists a package with no host as `container` and does not offer it/);
  assert.match(prereg, /2026-11-03T01:30:02Z` to `2026-11-03T01:42:17Z/, "the registry fetch's window");
  const c = COMPOSITION[1000];
  assert.ok(
    prereg.includes(`1,000 − (${c.from200} + ${c.socrataWithCountry} + ${c.ckanActive} + ${c.registry}) = ${c.nearDuplicates}`),
    'the 1,000 composition and its remainder, as build.mjs states them',
  );
  assert.match(prereg, /a design choice, not a measured share of any real directory/, 'the split at 1,000 is named a design choice');
  assert.match(prereg, /ties broken by the catalog's `id` field/, 'the tie-break names the catalog id');
  // P1 writes the inputs only: every later section is a heading with nothing under it.
  const later = prereg.slice(prereg.indexOf('## Questions and gold (P2)'));
  assert.ok(later.length > 0, 'the later sections are named');
  assert.deepEqual(
    later.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('## ')),
    [],
    'the sections after the inputs are headings only',
  );
});
