# CKAN portals: guidance for the CKAN tools

Guidance for querying open data on CKAN portals through seven tools of a hosted CKAN server. Every call names the portal it reads in `server_url`: the portal's base URL, such as `https://data.boston.gov`. The server reads only the portals its operator lists; a call naming any other portal is refused and returns no data.

## Which portal

- **Boston**: Analyze Boston, the City of Boston's portal, is `https://data.boston.gov`. Boston's city data is there, not on Socrata: 311 requests, permits, crime, inspections, property records, elections, schools, parcels, parking, neighborhoods.
- **Another place**: pass the base URL of the CKAN portal that publishes its data. Do not guess an address: if you do not know a place's portal, say so. `ckan_status_show` tells you whether an address answers as a CKAN portal.
- **Use Socrata** for cities whose portals run Socrata (NYC, Chicago, SF, Seattle, LA).
- **Use Data Commons for demographics**: ACS, Census and BLS figures. A CKAN portal is not where demographic tables are. For Boston: Suffolk County (`geoId/25025`), Boston city (`geoId/2507000`), or tracts.

When a question mixes operational and demographic data ("311 noise per capita by neighborhood"), plan a multi-source analysis: operational counts from the portal, the population denominator from Data Commons. State the geography caveat when the portal's areas are not standard census geographies.

## CKAN and Socrata, side by side

On CKAN a dataset is a package holding one or more resources; a resource whose rows are loaded into the portal's DataStore is the table you query, by its resource id.

| Concern | Socrata | CKAN |
|---------|---------|------|
| Portal | the `portal` argument or the server's own portal | `server_url`, on every call |
| Query language | SoQL | PostgreSQL `SELECT`, through `ckan_datastore_search_sql` |
| Table identity | 4x4 dataset code (`erm2-nwe9`) | resource id, a UUID (`8048697b-ad64-4bfc-b090-ee00169f2323`) |
| Identifier quoting in SQL | not required | the resource id **must** be double-quoted: `FROM "uuid-here"` |
| Column discovery | `get_data` with `LIMIT 1` | `ckan_datastore_search` with `"limit": 0` |
| Writes | not exposed | not exposed: one `SELECT` or `WITH` statement per call |

## Typical workflow chain

1. **`ckan_status_show`**: whether the portal answers, its CKAN version, and its locale where the portal states one. Search in the portal's language: a search in English on a portal in another language can return nothing.
2. **`ckan_find_relevant_datasets`**: a keyword search, ranked. A good first step when you do not know the dataset.
3. **`ckan_package_search`**: the catalogue search in Solr syntax, for filters (`fq`), facets, sorting and paging.
4. **`ckan_package_show`**: one dataset's full metadata, with its resources; pick the resource whose `datastore_active` is true.
5. **`ckan_list_resources`**: a short table of a dataset's resources (format, size, whether each is in the DataStore), when a dataset bundles several.
6. **`ckan_datastore_search`**: rows of one resource by its resource id, with exact-match `filters`, `q`, `sort`, `limit` and `offset`. Call it with `"limit": 0` first: the answer lists the resource's column names and types and no rows. Each portal uses its own column names, not the ones a model may have memorized from another city.
7. **`ckan_datastore_search_sql`**: one `SELECT` or `WITH` statement over a resource, for `GROUP BY`, counts, sums, joins, window functions and percentiles. The table name is the resource id, double-quoted.

Do not skip the search, the dataset's details and the column check on an unfamiliar dataset: a guessed column name against a wide CKAN resource returns zero rows or a SQL error. A resource whose `datastore_active` is false has no rows the DataStore tools can read: say so, and give its download URL instead.

## Boston-specific geographies

- **Neighborhoods**: not Census tracts. About 20 city-maintained names (Dorchester, Roxbury, Jamaica Plain, South Boston, ...).
- **BPD districts**: 12 police districts (A1, A7, B2, B3, C6, C11, D4, D14, E5, E13, E18). Different from neighborhoods.
- **BPS school zones**: Boston Public Schools has its own geography; present on school datasets only.
- **Parcel IDs**: 10-digit strings. Assessor data is keyed on parcel, not address; to go from an address to a parcel, query the parcels dataset first.
- **ZIP codes**: the `021xx` range. Boston crosses multiple ZIPs; take care when comparing against ACS ZCTAs.

Neighborhoods do **not** map cleanly to Census tracts. When joining Boston operational data with Data Commons tract-level demographics, state the geography mismatch rather than silently imputing.

## Caveats

- **Update cadence varies by portal and by dataset.** Surface `metadata_modified`, or a resource's `last_modified`, when the question is time-sensitive.
- **The hosted server may reuse an answer.** A repeated request can return an answer up to a minute old for a resource's rows, up to five minutes old for a dataset search or a dataset's details, and up to an hour old for a portal's status.
- **Coverage gaps.** A portal may publish only part of an agency's data. If a natural query returns empty, the data genuinely may not be there: say so rather than fishing.
- **Resource ids change** when a dataset gets a new resource. Look the id up again with `ckan_package_show` in each session; do not carry ids across runs.
- **Hot-spotting risk.** Crime and 311 point-level data can be re-identifying when filtered narrowly. Honor aggregation thresholds: do not report a single address.

## Attribution

Cite each figure with the portal's URL, the dataset title, the resource id, and the SQL or the search arguments that produced it. The record captures tool calls and their arguments automatically; your job in the text is to make the citation human-readable.
