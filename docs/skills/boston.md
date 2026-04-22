# Boston OpenContext Companion Skill — Base Guidance

Guidance for querying Boston civic open data through the OpenContext MCP server at `data-mcp.boston.gov/mcp`. OpenContext is a CKAN-native MCP framework maintained by the City of Boston; it fronts the CKAN DataStore powering Analyze Boston (`data.boston.gov`).

## Purpose and when to use

- **Use Boston OpenContext** for Boston civic data on `data.boston.gov` — 311 requests, permits, crime, inspections, property records, elections, schools, parcels, parking, neighborhoods.
- **Use Socrata** for other cities (NYC, Chicago, SF, Seattle, LA). Boston is not on Socrata.
- **Use Data Commons for Boston demographics** — ACS / Census / BLS figures for Boston, Suffolk County (`geoId/25025`), Boston city (`geoId/2507000`), or tracts. Don't go hunting for demographic tables on Analyze Boston.

When a question mixes operational and demographic data ("311 noise per capita by neighborhood"), plan a multi-source analysis: operational counts from OpenContext, population denominator from Data Commons at tract level. State the geography caveat — neighborhoods and council districts are not standard census geographies.

## CKAN vs Socrata — the one-screen summary

Boston runs CKAN, not Socrata:

| Concern | Socrata | CKAN / OpenContext |
|---------|---------|--------------------|
| Query language | SoQL (SQL-like but dialectal) | PostgreSQL SELECT |
| Dataset identity | 4x4 code (`erm2-nwe9`) | UUID resource id (`8048697b-ad64-4bfc-b090-ee00169f2323`) |
| Identifier quoting in SQL | not required | UUIDs **MUST** be double-quoted: `FROM "uuid-here"` |
| Schema discovery | `get_data` with `LIMIT 1` | `ckan__get_schema` (explicit) |
| Aggregation | `SELECT … GROUP BY` via `get_data` | `ckan__aggregate_data` or `ckan__execute_sql` |
| Writes | Not exposed | Blocked server-side — only SELECT passes |

## Typical workflow chain

1. **`ckan__search_datasets`** — natural-language discovery. Returns candidate datasets with their UUID resource ids.
2. **`ckan__get_dataset`** — inspect a dataset's full metadata; pick the right resource when a dataset bundles several.
3. **`ckan__get_schema`** — fetch field names/types. Run this before querying unfamiliar data — Boston uses CKAN field conventions, not the NYC/Chicago conventions a model may have memorized.
4. **`ckan__query_data`** — simple equality-filter queries. Good for "rows where field = value" patterns.
5. **`ckan__aggregate_data`** — structured GROUP BY + metrics. Prefer this over raw SQL for countable/summable questions; the server compiles safe SQL from a JSON spec (`group_by`, `metrics`, `filters`, `having`, `order_by`).
6. **`ckan__execute_sql`** — raw SELECT for CTEs, window functions, JOINs, percentile aggregates.

Don't skip steps 1–3 on an unfamiliar dataset — guessing a field name against a 500-column CKAN resource silently returns zero rows or a SQL error.

## Boston-specific geographies

- **Neighborhoods** — not Census tracts. ~20 city-maintained names (Dorchester, Roxbury, Jamaica Plain, South Boston, …).
- **BPD districts** — 12 police districts (A1, A7, B2, B3, C6, C11, D4, D14, E5, E13, E18). Different from neighborhoods.
- **BPS school zones** — Boston Public Schools has its own geography; present on school datasets only.
- **Parcel IDs** — 10-digit strings. Assessor data is keyed on parcel, not address; to go address→parcel, query the parcels dataset first.
- **ZIP codes** — `021xx` range. Boston crosses multiple ZIPs; treat carefully when comparing against ACS ZCTAs.

Neighborhoods do **not** map cleanly to Census tracts. When joining Boston operational data with Data Commons tract-level demographics, state the geography mismatch rather than silently imputing.

## Caveats

- **Update cadence varies.** 311 daily, assessor annually, crime weekly. Surface `metadata_updated` or `last_modified` when the question is time-sensitive.
- **Coverage gaps.** Some city agencies (BPD, BPS, BPL) publish partial data. If a natural query returns empty, the data genuinely may not be there — say so rather than fishing.
- **Resource UUIDs change** when a dataset gets a v2 resource. Re-run search/get_dataset for current IDs each session; don't cache UUIDs across runs.
- **Hot-spotting risk.** Crime and 311 point-level data can be re-identifying when filtered narrowly. Honor aggregation thresholds — don't report a single address.

## Attribution

Cite Boston OpenContext analyses with: dataset title, resource UUID, `data.boston.gov` portal URL, and the SQL / aggregation spec that produced the number. The evidence-package layer captures tool calls and args automatically; your job in the text output is to make the citation human-readable.
