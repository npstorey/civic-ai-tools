// The Boston pack over the hosted CKAN server (CKAN-1 P2, hub issue 314):
// Analyze Boston, the City of Boston's CKAN portal at data.boston.gov.
//
// The pack calls six tools of the hosted CKAN server (`./ckan.ts`) with
// `server_url` fixed to `https://data.boston.gov`, and carries its own
// guidance: the hub's Boston guidance (the City's OpenContext server's text,
// `docs/skills/boston.md`) rewritten for those six tools, its source of truth
// `docs/skills/boston-ckan.md`, held equal to the text below by
// `src/ckan.test.ts`. A call of one of its tools goes to the base's server
// and is recorded under the base's `sourceId` (`ckan-server`), with the
// pack's inventory `id` beside it (`mcp.pack_id`). The pack takes no address
// of its own: `configuredAddresses` keys it by the CKAN server's address
// (`CKAN_MCP_URL`, `./env.ts`), and its configuration (optional), hosting
// variants and consent default are the server entry's.
//
// The hub's `inventory/civic-inventory.json` is the source of truth for the
// pack's data. The entry below is its mirror in code, built by the same code
// the inventory loader builds a pack with (`packManifestEntry`, the CKAN
// kind's pack builder), and held equal to the file by `src/inventory.test.ts`.
// Its words are `./ckan-words.ts`'s.

import { packHash, packManifestEntry, type InventoryPackEntry } from '../core/inventory.ts';
import { sha256Hex } from '../core/sha256.ts';
import { CKAN_SERVER_ENTRY } from './ckan.ts';
import { BOSTON_CKAN_WORDS } from './ckan-words.ts';
import type { CivicManifestEntry } from './context.ts';
import { ckanPack } from './inventory.ts';

/** The pack's guidance: the hub's Boston guidance for the six CKAN tools
 *  (`docs/skills/boston-ckan.md`, less its final newline). Text the router
 *  does not own, so the aliased view gives it the anchored rewrite. */
export const BOSTON_CKAN_GUIDANCE = `# Analyze Boston: guidance for the CKAN tools

Guidance for querying Boston civic open data on Analyze Boston (\`data.boston.gov\`), the City of Boston's CKAN portal, through six tools of a hosted CKAN server. Every call of these tools reads \`https://data.boston.gov\` and no other portal: pass it as \`server_url\`.

## Purpose and when to use

- **Use these tools** for Boston civic data on \`data.boston.gov\`: 311 requests, permits, crime, inspections, property records, elections, schools, parcels, parking, neighborhoods.
- **Use Socrata** for other cities (NYC, Chicago, SF, Seattle, LA). Boston is not on Socrata.
- **Use Data Commons for Boston demographics**: ACS, Census and BLS figures for Boston, Suffolk County (\`geoId/25025\`), Boston city (\`geoId/2507000\`), or tracts. Analyze Boston is not where demographic tables are.

When a question mixes operational and demographic data ("311 noise per capita by neighborhood"), plan a multi-source analysis: operational counts from Analyze Boston, the population denominator from Data Commons at tract level. State the geography caveat: neighborhoods and council districts are not standard census geographies.

## CKAN and Socrata, side by side

Boston runs CKAN, not Socrata. On CKAN a dataset is a package holding one or more resources; a resource whose rows are loaded into the portal's DataStore is the table you query, by its resource id.

| Concern | Socrata | CKAN (Analyze Boston) |
|---------|---------|-----------------------|
| Query language | SoQL | PostgreSQL \`SELECT\`, through \`ckan_datastore_search_sql\` |
| Table identity | 4x4 dataset code (\`erm2-nwe9\`) | resource id, a UUID (\`8048697b-ad64-4bfc-b090-ee00169f2323\`) |
| Identifier quoting in SQL | not required | the resource id **must** be double-quoted: \`FROM "uuid-here"\` |
| Column discovery | \`get_data\` with \`LIMIT 1\` | \`ckan_datastore_search\` with \`"limit": 0\` |
| Writes | not exposed | not exposed: one \`SELECT\` or \`WITH\` statement per call |

## Typical workflow chain

1. **\`ckan_find_relevant_datasets\`**: a keyword search, ranked. A good first step when you do not know the dataset.
2. **\`ckan_package_search\`**: the catalogue search in Solr syntax, for filters (\`fq\`), facets, sorting and paging.
3. **\`ckan_package_show\`**: one dataset's full metadata, with its resources; pick the resource whose \`datastore_active\` is true.
4. **\`ckan_list_resources\`**: a short table of a dataset's resources (format, size, whether each is in the DataStore), when a dataset bundles several.
5. **\`ckan_datastore_search\`**: rows of one resource by its resource id, with exact-match \`filters\`, \`q\`, \`sort\`, \`limit\` and \`offset\`. Call it with \`"limit": 0\` first: the answer lists the resource's column names and types and no rows. Boston uses its own column names, not the NYC or Chicago names a model may have memorized.
6. **\`ckan_datastore_search_sql\`**: one \`SELECT\` or \`WITH\` statement over a resource, for \`GROUP BY\`, counts, sums, joins, window functions and percentiles. The table name is the resource id, double-quoted.

Do not skip steps 1 to 3 and the column check on an unfamiliar dataset: a guessed column name against a wide CKAN resource returns zero rows or a SQL error.

## Boston-specific geographies

- **Neighborhoods**: not Census tracts. About 20 city-maintained names (Dorchester, Roxbury, Jamaica Plain, South Boston, ...).
- **BPD districts**: 12 police districts (A1, A7, B2, B3, C6, C11, D4, D14, E5, E13, E18). Different from neighborhoods.
- **BPS school zones**: Boston Public Schools has its own geography; present on school datasets only.
- **Parcel IDs**: 10-digit strings. Assessor data is keyed on parcel, not address; to go from an address to a parcel, query the parcels dataset first.
- **ZIP codes**: the \`021xx\` range. Boston crosses multiple ZIPs; take care when comparing against ACS ZCTAs.

Neighborhoods do **not** map cleanly to Census tracts. When joining Boston operational data with Data Commons tract-level demographics, state the geography mismatch rather than silently imputing.

## Caveats

- **Update cadence varies by dataset.** Surface \`metadata_modified\`, or a resource's \`last_modified\`, when the question is time-sensitive.
- **The hosted server may reuse an answer.** A repeated query can return an answer up to a minute old for a resource's rows, and up to five minutes old for a dataset search or a dataset's details.
- **Coverage gaps.** Some city agencies (BPD, BPS, BPL) publish partial data. If a natural query returns empty, the data genuinely may not be there: say so rather than fishing.
- **Resource ids change** when a dataset gets a new resource. Look the id up again with \`ckan_package_show\` in each session; do not carry ids across runs.
- **Hot-spotting risk.** Crime and 311 point-level data can be re-identifying when filtered narrowly. Honor aggregation thresholds: do not report a single address.

## Attribution

Cite Analyze Boston analyses with the dataset title, the resource id, the \`data.boston.gov\` portal URL, and the SQL or the search arguments that produced the number. The record captures tool calls and their arguments automatically; your job in the text is to make the citation human-readable.`;

/** The pack as the inventory states it, less its provenance and its tools'
 *  reference, which are the file's alone and outside its hash; its place and
 *  categories stay, so the hash below is the file's `packHash`, computed. */
const BOSTON_CKAN_PACK: InventoryPackEntry = {
  kind: 'pack',
  id: 'boston-ckan@https://data.boston.gov',
  alias: 'boston',
  sourceId: 'boston-ckan',
  displayName: BOSTON_CKAN_WORDS.displayName,
  description: BOSTON_CKAN_WORDS.description,
  freshness: BOSTON_CKAN_WORDS.freshness,
  freshnessSource: BOSTON_CKAN_WORDS.freshnessSource,
  base: CKAN_SERVER_ENTRY.id,
  // What the CKAN server reported at the capture the server entry's
  // `toolsRef.fixture` names (src/__fixtures__/ckan-tools.json).
  basePins: [
    {
      serverName: 'ckan-mcp-server',
      serverVersion: '0.4.139',
      tools: {
        ckan_package_search: 'f4a766bc17325feb4099b790cd849e126a537af50fbca68f458cbb8549b10145',
        ckan_find_relevant_datasets: '41e36171a4f110c1d89964335e86fa2dd32e6cc92a2935f506fd0c0d188eb028',
        ckan_package_show: 'ff022c49c7263ba72ab649568e78ceac64de909e5bfeb930ef63b0a11005c3c5',
        ckan_list_resources: '0a5048a337b3e239e0bf71e84aab593712f181224aef0c656bca66fe343c5dbf',
        ckan_datastore_search: 'a89056ee57437ebafb4bdb3d7aaaa83fc8829f3279d3970b2a78e40f9f3a1701',
        ckan_datastore_search_sql: 'ee15e13fa342ca280d51dbaf7a9db8a48fef6d0a4bc2e008e24e414cc4d30fe7'
      }
    }
  ],
  filter: { server_url: 'https://data.boston.gov' },
  api: { platform: 'ckan', host: 'data.boston.gov' },
  author: BOSTON_CKAN_WORDS.author,
  publisher: BOSTON_CKAN_WORDS.publisher,
  version: '1.0',
  prompt: {
    citation: BOSTON_CKAN_WORDS.citation,
    lockMention: BOSTON_CKAN_WORDS.lockMention,
  },
  place: { country: 'US', level: 'local', names: ['Boston', 'City of Boston'] },
  categories: ['311-service-requests', 'permits-licensing', 'inspections', 'public-safety', 'property-land', 'elections', 'education'],
  guidance: { kind: 'inline', text: BOSTON_CKAN_GUIDANCE, blockSha256: sha256Hex(BOSTON_CKAN_GUIDANCE) },
};

/**
 * The Boston pack: Analyze Boston over the hosted CKAN server. Its `id` is
 * the pack's inventory id, its name and the portal it reads. Its tools are
 * the six (`boston__ckan_package_search` and the rest in the aliased view),
 * each held to `https://data.boston.gov`. Optional, as its base is: offered
 * only when `CKAN_MCP_URL` is set.
 */
export const BOSTON_CKAN_ENTRY: CivicManifestEntry = packManifestEntry(
  { ...BOSTON_CKAN_PACK, hash: packHash(BOSTON_CKAN_PACK) },
  CKAN_SERVER_ENTRY,
  ckanPack(BOSTON_CKAN_PACK, CKAN_SERVER_ENTRY),
);
