// The Boston OpenContext source: its tool schemas, its guidance block and the
// embedded Boston guidance.
//
// Moved from the reference website at 3a0c894: the schemas from
// `src/lib/mcp/tools.ts:275-448`, the guidance from
// `src/lib/mcp/boston-skill.ts:16-73`, and the registry entry's text from
// `src/lib/mcp/socrata-skill.ts:620-629`.
//
// OpenContext is a CKAN-native MCP framework; the City of Boston's deployment
// fronts the CKAN DataStore behind data.boston.gov. Tool names keep the
// upstream server's `ckan__` prefix. The source is optional: a run is offered
// it only when the instance configures its address.

import type { FunctionToolSchema } from '../core/types.ts';
import type { CivicGuidanceContext, CivicManifestEntry } from './context.ts';
import { BOSTON_OPENCONTEXT_ADDRESS_VARIABLE } from './env.ts';

// --- Boston OpenContext MCP (CKAN-native, data.boston.gov) ---
export const BOSTON_OPENCONTEXT_TOOLS: FunctionToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'ckan__search_datasets',
      description: `Natural-language dataset discovery against Boston's CKAN portal (data.boston.gov). Returns candidate datasets with their CKAN UUID resource ids, titles, and descriptions.

Use this first when the user asks about Boston civic data and you don't already know the resource UUID. Pair with ckan__get_dataset to inspect a specific candidate or ckan__get_schema to fetch field names for querying.

Examples:
- { "query": "311 pothole requests", "limit": 5 }
- { "query": "building permits" }`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search query (e.g., "311 pothole requests", "building permits", "assessing values")',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results (default: 20)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ckan__get_dataset',
      description: `Fetch detailed metadata for a specific Boston dataset — title, publisher, update cadence, description, and the list of CKAN resources attached to it. Use after ckan__search_datasets when you need to pick the right resource within a dataset that bundles several.

Example:
- { "dataset_id": "311-service-requests" }
- { "dataset_id": "8048697b-ad64-4bfc-b090-ee00169f2323" }`,
      parameters: {
        type: 'object',
        properties: {
          dataset_id: {
            type: 'string',
            description: 'CKAN dataset ID or slug (UUID or human-readable name)',
          },
        },
        required: ['dataset_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ckan__get_schema',
      description: `Fetch the field names and types for a specific Boston CKAN resource. Always run this before querying an unfamiliar resource — Boston follows CKAN field-naming conventions that differ from Socrata portals (NYC, Chicago, etc.), and guessing a field name can silently return zero rows.

Example:
- { "resource_id": "8048697b-ad64-4bfc-b090-ee00169f2323" }`,
      parameters: {
        type: 'object',
        properties: {
          resource_id: {
            type: 'string',
            description: 'CKAN resource UUID (e.g., "8048697b-ad64-4bfc-b090-ee00169f2323")',
          },
        },
        required: ['resource_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ckan__query_data',
      description: `Simple equality-filter query against a Boston CKAN resource. Supports exact-match filtering on one or more fields. For GROUP BY / aggregation, use ckan__aggregate_data. For complex SQL (CTEs, window functions, JOINs), use ckan__execute_sql.

Example:
- { "resource_id": "8048697b-ad64-4bfc-b090-ee00169f2323", "filters": { "neighborhood": "Dorchester" }, "limit": 100 }`,
      parameters: {
        type: 'object',
        properties: {
          resource_id: {
            type: 'string',
            description: 'CKAN resource UUID to query',
          },
          filters: {
            type: 'object',
            description: 'Optional exact-match filters as field: value pairs (e.g., { "neighborhood": "Dorchester" })',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of records (default: 100)',
          },
        },
        required: ['resource_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ckan__aggregate_data',
      description: `Structured GROUP BY + aggregation against a Boston CKAN resource. The server compiles a safe SQL query from a JSON spec — prefer this over ckan__execute_sql whenever the question is countable / summable / averageable. Supports count(*), sum(), avg(), min(), max(), stddev().

Run ckan__get_schema first to confirm field names.

Examples:
- Count 311 requests by neighborhood:
  { "resource_id": "8048697b-ad64-4bfc-b090-ee00169f2323", "group_by": ["neighborhood"], "metrics": { "count": "count(*)" }, "order_by": "count DESC", "limit": 25 }
- Requests matching a specific case type grouped by year:
  { "resource_id": "...", "group_by": ["year"], "metrics": { "total": "count(*)" }, "filters": { "case_title": "Request for Pothole Repair" } }`,
      parameters: {
        type: 'object',
        properties: {
          resource_id: {
            type: 'string',
            description: 'CKAN resource UUID',
          },
          group_by: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to group by',
          },
          metrics: {
            type: 'object',
            description: 'Aggregation metrics as alias: expression pairs (e.g., { "count": "count(*)", "avg_val": "avg(amount)" })',
          },
          filters: {
            type: 'object',
            description: 'Optional exact-match filters before aggregation',
          },
          having: {
            type: 'object',
            description: 'Optional post-aggregation filters',
          },
          order_by: {
            type: 'string',
            description: 'Optional ORDER BY clause (e.g., "count DESC")',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of groups to return (default: 100)',
          },
        },
        required: ['resource_id', 'metrics'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ckan__execute_sql',
      description: `Execute a raw PostgreSQL SELECT against a Boston CKAN resource. For complex queries only — prefer ckan__query_data or ckan__aggregate_data first.

CRITICAL:
- Only SELECT is allowed. INSERT / UPDATE / DELETE / DDL are rejected server-side.
- Resource UUIDs MUST be double-quoted in the FROM clause: FROM "8048697b-ad64-4bfc-b090-ee00169f2323"

Supports CTEs (WITH ...), window functions (RANK() OVER (...)), percentile aggregates (PERCENTILE_CONT), and JOINs across resources.

Example:
- { "sql": "SELECT neighborhood, count(*) AS requests FROM \\"8048697b-ad64-4bfc-b090-ee00169f2323\\" WHERE open_dt >= '2024-01-01' GROUP BY neighborhood ORDER BY requests DESC LIMIT 10" }`,
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'PostgreSQL SELECT statement. Resource UUIDs must be double-quoted in FROM.',
          },
        },
        required: ['sql'],
      },
    },
  },
];

/**
 * The routing list, in the order the website's registry routes it
 * (`src/lib/mcp/registry.ts:55-62`). It is the same six names as the schemas
 * above, in a different order; the withheld-tools list follows this order.
 */
export const BOSTON_OPENCONTEXT_TOOL_NAMES: readonly string[] = [
  'ckan__search_datasets',
  'ckan__get_dataset',
  'ckan__query_data',
  'ckan__get_schema',
  'ckan__execute_sql',
  'ckan__aggregate_data',
];

/** The embedded Boston OpenContext guidance. The source of truth is the hub's
 *  `docs/skills/boston.md`; this is the website's hand-synced copy at 3a0c894. */
export const BOSTON_OPENCONTEXT_SKILL = `
# Boston OpenContext Companion Skill — Base Guidance

Guidance for querying Boston civic open data through the OpenContext MCP server at data-mcp.boston.gov/mcp. OpenContext is a CKAN-native MCP framework maintained by the City of Boston; it fronts the CKAN DataStore powering Analyze Boston (data.boston.gov).

## Purpose and when to use

- **Use Boston OpenContext** for Boston civic data on data.boston.gov — 311 requests, permits, crime, inspections, property records, elections, schools, parcels, parking, neighborhoods.
- **Use Socrata** for other cities (NYC, Chicago, SF, Seattle, LA). Boston is not on Socrata.
- **Use Data Commons for Boston demographics** — ACS / Census / BLS figures for Boston, Suffolk County (geoId/25025), Boston city (geoId/2507000), or tracts. Don't go hunting for demographic tables on Analyze Boston.

When a question mixes operational and demographic data ("311 noise per capita by neighborhood"), plan a multi-source analysis: operational counts from OpenContext, population denominator from Data Commons at tract level. State the geography caveat — neighborhoods and council districts are not standard census geographies.

## CKAN vs Socrata — the one-screen summary

Boston runs CKAN, not Socrata:

| Concern | Socrata | CKAN / OpenContext |
|---------|---------|--------------------|
| Query language | SoQL (SQL-like but dialectal) | PostgreSQL SELECT |
| Dataset identity | 4x4 code (erm2-nwe9) | UUID resource id (8048697b-ad64-4bfc-b090-ee00169f2323) |
| Identifier quoting in SQL | not required | UUIDs MUST be double-quoted: FROM "uuid-here" |
| Schema discovery | get_data with LIMIT 1 | ckan__get_schema (explicit) |
| Aggregation | SELECT ... GROUP BY via get_data | ckan__aggregate_data or ckan__execute_sql |
| Writes | Not exposed | Blocked server-side — only SELECT passes |

## Typical workflow chain

1. **ckan__search_datasets** — natural-language discovery. Returns candidate datasets with their UUID resource ids.
2. **ckan__get_dataset** — inspect a dataset's full metadata; pick the right resource when a dataset bundles several.
3. **ckan__get_schema** — fetch field names/types. Run this before querying unfamiliar data — Boston uses CKAN field conventions, not the NYC/Chicago conventions a model may have memorized.
4. **ckan__query_data** — simple equality-filter queries. Good for "rows where field = value" patterns.
5. **ckan__aggregate_data** — structured GROUP BY + metrics. Prefer this over raw SQL for countable/summable questions; the server compiles safe SQL from a JSON spec (group_by, metrics, filters, having, order_by).
6. **ckan__execute_sql** — raw SELECT for CTEs, window functions, JOINs, percentile aggregates.

Don't skip steps 1-3 on an unfamiliar dataset — guessing a field name against a 500-column CKAN resource silently returns zero rows or a SQL error.

## Boston-specific geographies

- **Neighborhoods** — not Census tracts. ~20 city-maintained names (Dorchester, Roxbury, Jamaica Plain, South Boston, ...).
- **BPD districts** — 12 police districts (A1, A7, B2, B3, C6, C11, D4, D14, E5, E13, E18). Different from neighborhoods.
- **BPS school zones** — Boston Public Schools has its own geography; present on school datasets only.
- **Parcel IDs** — 10-digit strings. Assessor data is keyed on parcel, not address; to go address to parcel, query the parcels dataset first.
- **ZIP codes** — 021xx range. Boston crosses multiple ZIPs; treat carefully when comparing against ACS ZCTAs.

Neighborhoods do NOT map cleanly to Census tracts. When joining Boston operational data with Data Commons tract-level demographics, state the geography mismatch rather than silently imputing.

## Caveats

- **Update cadence varies.** 311 daily, assessor annually, crime weekly. Surface metadata_updated or last_modified when the question is time-sensitive.
- **Coverage gaps.** Some city agencies (BPD, BPS, BPL) publish partial data. If a natural query returns empty, the data genuinely may not be there — say so rather than fishing.
- **Resource UUIDs change** when a dataset gets a v2 resource. Re-run search/get_dataset for current IDs each session; don't cache UUIDs across runs.
- **Hot-spotting risk.** Crime and 311 point-level data can be re-identifying when filtered narrowly. Honor aggregation thresholds — don't report a single address.

## Attribution

Cite Boston OpenContext analyses with: dataset title, resource UUID, data.boston.gov portal URL, and the SQL / aggregation spec that produced the number. The record-package layer captures tool calls and args automatically; your job in the text output is to make the citation human-readable.
`;

/** The Boston OpenContext block of the composed prompt. */
export async function bostonGuidanceText(ctx: CivicGuidanceContext): Promise<string> {
  const instructions = await ctx.fetchInstructions('boston-opencontext');
  const instructionsBlock = instructions
    ? `# Boston OpenContext server instructions (from initialize response)\n\n${instructions}`
    : '# Boston OpenContext server instructions\n\n(The OpenContext MCP server did not advertise per-server instructions on initialize — composing with the embedded Boston skill only; per-tool guidance is carried inline on each ckan__* tool description.)';
  return `${instructionsBlock}\n\n---\n\n${BOSTON_OPENCONTEXT_SKILL}`;
}

/**
 * The Boston OpenContext source. Its `id` is the service name and address:
 * the deployment's own metadata could not be read when this entry was written
 * (the endpoint was out of reach), so the identity is the service as the
 * reference website configures it. Optional, with no default address: the
 * public endpoint refuses a request that carries no bearer token.
 */
export const BOSTON_OPENCONTEXT_ENTRY: CivicManifestEntry = {
  id: 'opencontext@https://data-mcp.boston.gov/mcp',
  alias: 'boston',
  sourceId: 'boston-opencontext',
  displayName: 'Boston OpenContext MCP Server',
  configuration: {
    addressVariable: BOSTON_OPENCONTEXT_ADDRESS_VARIABLE,
    requirement: 'optional',
  },
  tools: BOSTON_OPENCONTEXT_TOOLS,
  toolNames: BOSTON_OPENCONTEXT_TOOL_NAMES,
  guidance: { fetchText: bostonGuidanceText },
};
