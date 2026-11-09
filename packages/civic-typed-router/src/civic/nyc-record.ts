// The NYC City Record source: since 0.8.0 a pack over the Socrata server
// (sources-at-scale design §4.1; hub #309, S2-B).
//
// City Record Online is one dataset on NYC Open Data, `dg92-zbpx` on
// `data.cityofnewyork.us`, which the Socrata server already reaches. Through
// 0.7.0 the source was BetaNYC's `@betanyc/nyc-record-mcp` 1.1.0, a stdio
// server an instance ran from the pinned package in a sandbox of its own,
// switched on by a variable; every tool it had was one query of that dataset
// (its `dist/city-record.js`). Since 0.8.0 it is a pack: the Socrata server's
// `get_data` and `fetch`, with the portal and the dataset fixed by the pack's
// filter, and seven query recipes as its guidance, one for each of the
// package's seven tools, with that tool's `where`, `order` and `limit`.
//
// Its `sourceId` and alias are kept (`nyc-record`, `nyc_record`), so a
// reader's consent and the directory carry over. A call of one of its tools
// goes to the base's server and is recorded under the base's `sourceId`, with
// the pack's inventory `id` beside it (`mcp.pack_id`); the consumer records
// it so. The pack takes no address of its own: `configuredAddresses` keys it
// by the Socrata address (`./env.ts`), and its configuration, hosting
// variants and consent default are the Socrata entry's.
//
// The hub's `inventory/civic-inventory.json` is the source of truth for the
// pack's data (version 2). The entry below is its mirror in code, built by
// the same code the inventory loader builds a pack with
// (`packManifestEntry`, the Socrata kind's pack builder), and held equal to
// the file by `src/inventory.test.ts`.

import { packManifestEntry, type InventoryPackEntry } from '../core/inventory.ts';
import { sha256Hex } from '../core/sha256.ts';
import type { CivicManifestEntry } from './context.ts';
import { socrataPack } from './inventory.ts';
import { SOCRATA_ENTRY } from './socrata.ts';

/** The pack's guidance: seven query recipes, one for each tool of
 *  `@betanyc/nyc-record-mcp` 1.1.0, in its order, with the `where`, `order`
 *  and `limit` of that tool's handler. Text the router does not own, so the
 *  aliased view gives it the anchored rewrite (`get_data` and `fetch` are the
 *  pack's tools). */
const NYC_RECORD_GUIDANCE = `# NYC City Record: query recipes

This source reads one dataset, City Record Online (\`dg92-zbpx\` on \`data.cityofnewyork.us\`): the notices published in The City Record, New York City's official journal, since 2015, one row per notice. The recipes use four of its columns: \`agency_name\`, \`type_of_notice_description\`, \`start_date\` (the date the notice was published) and \`due_date\` (a solicitation's response deadline).

Read it with \`get_data\` and "type": "query". Every call names the portal and the dataset, "portal": "data.cityofnewyork.us" and "dataset_id": "dg92-zbpx": without "dataset_id" the server reads the "query" value as a dataset ID. \`fetch\` returns the dataset's metadata and columns, or one record by its identifier.

Each recipe below is the query one tool of the City Record server (BetaNYC's nyc-record-mcp 1.1.0) sent to this dataset. Replace each value in angle brackets. Inside a SoQL string literal, write a single quote as two. Raise "limit" to see more rows.

1. Search the notices' text for a phrase. Pass the phrase as "query": the server applies a "query" that does not begin with SELECT as a full-text search of the dataset (SoQL's $q), alongside "order" and "limit". A phrase that begins with the word SELECT is read as a SoQL statement instead, so reword it.
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "query": "sidewalk repair", "order": "start_date DESC", "limit": 25 }

2. Notices from one agency, by a full or partial name, such as DCAS or Parks:
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "where": "upper(agency_name) like upper('%<agency>%')", "order": "start_date DESC", "limit": 25 }

3. Notices of one type. The types are Solicitation, Award, Intent to Award, Intent to Negotiate, Public Hearings, Public Comment, Meeting, Notice, Vendor List and Sale:
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "where": "type_of_notice_description='<type>'", "order": "start_date DESC", "limit": 25 }

4. Procurement notices: solicitations, awards, intents to award or negotiate, and vendor lists:
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "where": "type_of_notice_description in ('Solicitation','Award','Intent to Award','Intent to Negotiate','Vendor List')", "order": "start_date DESC", "limit": 25 }

5. Public hearings, comment periods, meetings and other notices:
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "where": "type_of_notice_description in ('Public Hearings','Public Comment','Meeting','Notice')", "order": "start_date DESC", "limit": 25 }

6. Open solicitations, whose response deadline has not passed, soonest first. <today> is today's date in New York, YYYY-MM-DD:
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "where": "type_of_notice_description='Solicitation' AND due_date >= '<today>'", "order": "due_date ASC", "limit": 25 }

7. Notices published between two dates, YYYY-MM-DD, both days included:
   { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "dg92-zbpx", "where": "start_date >= '<start>' AND start_date <= '<end>'", "order": "start_date DESC", "limit": 50 }`;

/** The pack as the inventory states it, less what the manifest does not
 *  carry (its place, categories, provenance and tools' reference, which are
 *  the file's alone). `hash` is the file's `packHash` of the whole entry. */
const NYC_RECORD_PACK: InventoryPackEntry = {
  kind: 'pack',
  id: 'nyc-record@https://data.cityofnewyork.us/d/dg92-zbpx',
  alias: 'nyc_record',
  sourceId: 'nyc-record',
  displayName: 'NYC City Record MCP Server',
  description:
    "Notices in The City Record, New York City's official journal, since 2015: procurement solicitations, awards and intent-to-award notices, public hearings and comment periods, and other agency notices, by agency, notice type, keyword and publication date. Covers New York City only. Does not hold the notices' full documents or any dataset other than City Record Online.",
  freshness: 'Live: every call queries the City Record Online dataset on NYC Open Data, which is updated daily.',
  freshnessSource:
    "The publisher's README for version 1.1.0, \"Data source\" (github.com/BetaNYC/nyc-record-mcp): the City Record Online dataset on NYC Open Data \"is updated daily and includes notices published in the official City Record since 2015\".",
  base: 'socrata',
  filter: { portal: 'data.cityofnewyork.us', dataset_id: 'dg92-zbpx' },
  guidance: { kind: 'inline', text: NYC_RECORD_GUIDANCE, blockSha256: sha256Hex(NYC_RECORD_GUIDANCE) },
  // The package's publisher, as its page names it: BetaNYC wrote the
  // queries the recipes copy.
  author: 'BetaNYC',
  publisher: 'BetaNYC',
  version: '1',
  hash: 'b4a208462f8d18b72be9817982e21c61374e1bdd3aab6f670cd68ce7dece8236',
  prompt: {
    citation: 'the agency, notice type and publication date of each notice (for The City Record)',
    // The lock section lists the other sources with commas: a name without one.
    lockMention: 'the City Record server for New York City notices',
  },
};

/**
 * The NYC City Record source: a pack over the Socrata server. Its `id` is the
 * pack's inventory id, the source id and the dataset's address. Its tools
 * are `get_data` and `fetch` (`nyc_record__get_data`, `nyc_record__fetch`),
 * held to the dataset; it has no `search`, since its filter names a dataset.
 * Its configuration is the Socrata entry's (`required`), so it is offered
 * wherever Socrata is, with the Socrata server's address or without one.
 */
export const NYC_RECORD_ENTRY: CivicManifestEntry = packManifestEntry(NYC_RECORD_PACK, SOCRATA_ENTRY, socrataPack({})(NYC_RECORD_PACK, SOCRATA_ENTRY));
