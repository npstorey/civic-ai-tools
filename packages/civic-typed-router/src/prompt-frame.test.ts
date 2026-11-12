// The prompt frame's helpers over an id outside their tables (hub #317, S2-C
// P1): `outroFor` names City Record's citation for the pack's `sourceId`
// (A1.5b, the item S2-B owed the next router release), and every helper
// refuses an id it has no text for by name, in the shape of the reference
// website's guard (A1.5c), so no function of `prompt-frame.ts` writes
// `undefined` into a prompt.
//
// `SourceId` is the three code sources' union, so a call with another id
// passes a widened value (`as never`), as the website's own test does.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALL_SOURCES, civicCitation, civicPreambleEntry, CROSS_SOURCE_PREAMBLE, crossSourcePreamble, NYC_RECORD_ENTRY, outroFor } from './index.ts';

/** City Record's citation, as its pack's inventory entry states it. */
const PACK_CITATION = 'the agency, notice type and publication date of each notice (for The City Record)';

/** An `Error` that is not a `TypeError`, its message holding `id` in double quotes. */
const refusedByName = (id: string) => (error: unknown) => error instanceof Error && !(error instanceof TypeError) && error.message.includes(`"${id}"`);

test("A1.5b: outroFor over a list holding the pack's sourceId names the pack's citation and writes no undefined", () => {
  assert.equal(NYC_RECORD_ENTRY.prompt?.citation, PACK_CITATION, "the mirror's citation is the inventory's");
  const outro = outroFor(['socrata', 'nyc-record'] as never);
  assert.equal(outro.includes('undefined'), false, outro);
  assert.equal(outro, `When you get results, summarize clearly and cite the dataset ID (for Socrata) or ${PACK_CITATION}.`);
  // Before 0.9.0 the pack was cited as nothing in a pair ("... or ."), as
  // nothing between two others (", , or"), and as "undefined" when last of
  // three or more.
  assert.equal(
    outroFor(['socrata', 'nyc-record', 'data-commons'] as never),
    `When you get results, summarize clearly and cite the dataset ID (for Socrata), ${PACK_CITATION}, or the variable DCID + source dataset (for Data Commons).`,
  );
  const all = outroFor([...ALL_SOURCES, 'nyc-record'] as never);
  assert.equal(all.includes('undefined'), false, all);
  assert.ok(all.endsWith(`, or ${PACK_CITATION}.`), all);
  // The three alone are as before.
  assert.equal(
    outroFor(ALL_SOURCES),
    'When you get results, summarize clearly and cite the dataset ID (for Socrata), the variable DCID + source dataset (for Data Commons), or the resource UUID + dataset title (for Boston OpenContext).',
  );
});

test('A1.5c: crossSourcePreamble refuses an id outside its three by name, in the website guard\'s shape; the three still compose to CROSS_SOURCE_PREAMBLE', () => {
  assert.equal(crossSourcePreamble(['socrata', 'data-commons', 'boston-opencontext']), CROSS_SOURCE_PREAMBLE);
  for (const id of ['nyc-record', 'nyc-charter']) {
    assert.throws(() => crossSourcePreamble(['socrata', id] as never), refusedByName(id), `${id}: not refused by name`);
  }
});

test('no helper of prompt-frame.ts writes undefined: outroFor, civicCitation and civicPreambleEntry refuse an id they have no text for, by name', () => {
  for (const id of ['nyc-charter', 'nys-legislation', 'no-such-source']) {
    assert.throws(() => outroFor(['socrata', id] as never), refusedByName(id), `outroFor: ${id}`);
    assert.throws(() => civicCitation(id as never), refusedByName(id), `civicCitation: ${id}`);
    assert.throws(() => civicPreambleEntry(id as never), refusedByName(id), `civicPreambleEntry: ${id}`);
  }
  // The pack's preamble entry is the router's, composed from its manifest entry, not one of the three.
  assert.throws(() => civicPreambleEntry('nyc-record' as never), refusedByName('nyc-record'));
  // A member name of Object.prototype is no id either.
  assert.throws(() => outroFor(['toString'] as never), refusedByName('toString'));
});
