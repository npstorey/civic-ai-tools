// The Socrata source: its tool schemas, its guidance block, the fallback
// guidance and the per-portal table.
//
// Moved from the reference website at 3a0c894: the schemas from
// `src/lib/mcp/tools.ts:9-148`, `SOCRATA_SKILL_FALLBACK` and
// `getSkillForPortal` from `src/lib/mcp/socrata-skill.ts:54-436`, and the
// registry entry's text from `:599-609`. The text is the website's, byte for
// byte; `router-goldens.test.ts` holds it to the captured outputs.

import type { FunctionToolSchema } from '../core/types.ts';
import type { CivicGuidanceContext, CivicManifestEntry, PromptFetcher } from './context.ts';
import { SOCRATA_ADDRESS_VARIABLE } from './env.ts';

// --- Socrata MCP (city open data portals) ---
export const SOCRATA_TOOLS: FunctionToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'get_data',
      description: `Unified Socrata open data access tool. Supports multiple operation types:
- catalog: Search the catalog for datasets matching a query on a Socrata portal
- metadata: Get detailed metadata about a specific dataset
- query: Execute a SoQL query against a dataset to fetch and filter data
- metrics: Get row count, view count, last-updated timestamps for a dataset

IMPORTANT TIPS:
1. For type=metadata and type=metrics, pass the dataset ID in "dataset_id"
2. For type=query, ALWAYS start by fetching a sample with no WHERE clause to see actual column values
3. NYC 311 data uses field names like: complaint_type, descriptor, created_date, community_board
4. Field values are case-sensitive - fetch sample data first to see exact formats

Examples:
- Search catalog: { "type": "catalog", "portal": "data.cityofnewyork.us", "query": "311 complaints" }
- Get metadata: { "type": "metadata", "portal": "data.cityofnewyork.us", "dataset_id": "erm2-nwe9" }
- Get metrics: { "type": "metrics", "portal": "data.cityofnewyork.us", "dataset_id": "erm2-nwe9" }
- Fetch sample data first: { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "erm2-nwe9", "limit": 5 }
- Query with filter: { "type": "query", "portal": "data.cityofnewyork.us", "dataset_id": "erm2-nwe9", "select": "complaint_type, COUNT(*) as count", "group": "complaint_type", "order": "count DESC", "limit": 10 }`,
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['catalog', 'metadata', 'query', 'metrics'],
            description: 'The type of operation to perform',
          },
          portal: {
            type: 'string',
            description: 'Socrata portal domain (e.g., data.cityofnewyork.us, data.sfgov.org)',
          },
          query: {
            type: 'string',
            // website #340: this used to describe only the $q branch. The data-access
            // handler splits on whether the value starts with SELECT, and the
            // SoQL branch supersedes the individual clauses AND drops
            // limit/offset — so a model reading the old text could send both a
            // SELECT and a limit and be silently given neither bound it asked
            // for. Both branches are stated here because both are reachable.
            description: 'For type=catalog: search query. For type=metadata: the dataset ID. For type=query: either a full SoQL statement starting with SELECT, which is applied as the entire query and supersedes select/where/order/group (limit and offset are not applied either — bound the rows with the statement\'s own LIMIT), or a search phrase, applied as a full-text search within the data alongside the other clauses.',
          },
          dataset_id: {
            type: 'string',
            description: 'Dataset identifier (required for type=query, metadata, and metrics)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of rows to return (default: 10)',
          },
          offset: {
            type: 'number',
            description: 'Number of rows to skip (for pagination)',
          },
          select: {
            type: 'string',
            description: 'SoQL select clause (for type=query)',
          },
          where: {
            type: 'string',
            description: 'SoQL where clause (for type=query)',
          },
          order: {
            type: 'string',
            description: 'SoQL order clause (for type=query)',
          },
          group: {
            type: 'string',
            description: 'SoQL group clause (for type=query)',
          },
        },
        required: ['type'],
      },
    },
  },
  // website #323: `search` and `fetch` are the Socrata MCP server's other two tools.
  // The website's `registry.ts` has routed all three names since it was written
  // (`SOCRATA_TOOLS = ['get_data', 'search', 'fetch']`) and the skill text has
  // always described them — only the schemas were missing, so the model was
  // told about two capabilities it had no way to invoke. Measured in the
  // server's source and against the deployed endpoint: `tools/list` returns
  // exactly `get_data, search, fetch`.
  //
  // The two schemas below MIRROR the server's, which are deliberately narrow —
  // one required property each and `additionalProperties: false`. That is not
  // an omission to be helpfully filled in: neither tool accepts a portal or
  // domain, so anything else sent here is rejected upstream. The narrowness is
  // also why the loop core's portal injection stays scoped to `get_data`
  // (the website's `run-tool-loop.ts`) — an injected portal would be stripped by the server
  // and would still corrupt the arguments recorded in the signed package.
  {
    type: 'function',
    function: {
      name: 'search',
      description: `Search the Socrata portal this instance's MCP server is configured for, returning matching datasets with identifiers that "fetch" accepts.

Returns, per hit: an "id" of the form dataset:<portal>:<dataset_id>, the title, the portal URL, a description snippet, and — where the dataset allows it — its column list and a few preview rows.

WHICH TOOL TO USE:
- This tool searches ONE portal: the one the server is configured with. It takes no portal argument.
- To search any OTHER portal, use get_data with { "type": "catalog", "portal": "...", "query": "..." }, which does take a portal.`,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: {
            type: 'string',
            description: 'Full-text search phrase, e.g. "311 noise complaints"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch',
      description: `Retrieve a dataset's full metadata, or a single record, by the identifier "search" returned.

The identifier is normally taken verbatim from a search hit: dataset:<portal>:<dataset_id> for a dataset, record:<portal>:<dataset_id>:<row_id> for one row. A Socrata dataset URL is also accepted and names its own portal (the URL's hostname). A bare 4x4 dataset ID (or 4x4:<row_id> for one row) names no portal and resolves against the server's configured portal.

WHICH TOOL TO USE: this returns metadata and columns, not query results. To read or aggregate rows, use get_data with type=query.`,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            description: 'Identifier returned by the search tool, e.g. "dataset:data.cityofnewyork.us:erm2-nwe9"',
          },
        },
        required: ['id'],
      },
    },
  },
];

/** The routing list: the server's tool names in the order the website's
 *  registry routes them (`src/lib/mcp/registry.ts:53`). */
export const SOCRATA_TOOL_NAMES: readonly string[] = ['get_data', 'search', 'fetch'];

// Fallback guidance, used when the prompt fetch throws. Generic only: it
// carries no deployment posture (no host names, no deployment limits, no
// links); the Socrata MCP server appends posture when it serves the live text.
// The website keeps it in step with the hub's docs/skills/ claims by hand,
// under its own tests; this copy is the website's at 3a0c894.
export const SOCRATA_SKILL_FALLBACK = `
# Socrata MCP Companion Skill — Base Guidance

Universal guidance for querying Socrata open data portals through the Socrata MCP Server.

## Purpose

This skill provides specialized guidance for:
- **Multi-Domain Support**: NYC, Chicago, SF, Seattle, LA, and other Socrata portals
- **Intelligent Query Assessment**: Complexity evaluation before executing large queries
- **Anti-Hallucination Protocols**: Strict adherence to actual query results
- **Domain-Specific Workarounds**: Handling limitations across different Socrata implementations

## Critical Requirements

**ALWAYS:**
- Assess query complexity before executing
- Never hallucinate data — only report what tool calls return
- Discover columns first — check schema before querying unfamiliar datasets
- Show exact queries used
- Use inline citations
- When the user specifies a date or time period (e.g., "in 2025", "last December", "this month"), ALWAYS use that date in your query. Default date ranges only apply when the user doesn't specify a time period.
- Add date filters when querying large or high-volume datasets to avoid performance issues and overly broad results. Use the Date Range Guidelines table to pick an appropriate range. Tell the user you applied a date filter, why, and that they can ask for a different range or all-time data if needed.
- Use the actual current date (from the system prompt if provided), not your training cutoff. Default to rolling windows: "past two years" = 24 months back from today, "last year" = past 12 months. State your interpretation before querying: "I'm interpreting 'past two years' as [start] to [end]."
- When a query has significant ambiguity that would change the analysis (which dataset, timeframe, or metric), ask one brief clarifying question before querying. For minor ambiguity, state your assumption and proceed: "I'll look at 311 noise complaints in Brooklyn for the past 12 months — let me know if you meant something different." Never ask more than one clarifying question at a time.

**NEVER:**
- Invent data points
- Extrapolate beyond actual records
- Present findings without tool evidence
- Query without column discovery

## Workflow

- **Plan first**: Before executing any tool calls, briefly state your plan: what dataset you'll query, what timeframe, what filters, and how you interpreted the user's question. This lets the user catch misinterpretations before tool calls are made.
- **Narrate as you go**: After stating your plan, narrate each phase briefly — "Retrieving data..." before tool calls, "Analyzing results..." after getting data back, then proceed to synthesis. Keep narration to one line per phase.

## Query Complexity Assessment

Evaluate complexity before executing, proceed silently if low risk.

### GREEN (Low Risk) — Proceed Silently
- Single city, <7 day range
- 1–4 tool calls required
- <50k estimated records

### YELLOW (Medium Risk) — Brief Warning
- 2+ cities OR full month range
- 5–9 tool calls required
- 50–150k estimated records

### RED (High Risk) — Stop & Offer Options
- 3+ cities with month+ ranges
- 10+ tool calls required
- >150k estimated records

## Mandatory Column Discovery

Before querying ANY unfamiliar dataset, discover the schema first:

\`\`\`
Tool: get_data
Type: "query"
Domain: [domain]
Dataset_id: [dataset-id]
Query: SELECT * LIMIT 1
\`\`\`

## Core SoQL Query Patterns

### Basic Query Structure
\`\`\`sql
SELECT field1, field2, field3
WHERE condition
ORDER BY field1
LIMIT 1000
\`\`\`

### Common Filter Patterns
\`\`\`sql
-- Text search
WHERE field ILIKE '%search_term%'

-- Date ranges
WHERE date_field >= '2023-01-01' AND date_field < '2024-01-01'

-- Numeric ranges
WHERE amount > 1000 AND amount < 10000

-- Multiple values
WHERE status IN ('Active', 'Pending', 'Approved')
\`\`\`

### Aggregation Patterns
\`\`\`sql
SELECT department, COUNT(*) as count, SUM(amount) as total
GROUP BY department
ORDER BY total DESC
\`\`\`

### Time Series Analysis
\`\`\`sql
SELECT date_trunc_y(date_field) as year,
       COUNT(*) as annual_count
GROUP BY year
ORDER BY year
\`\`\`

## Domain Support

**Any Socrata open data portal can be queried with get_data.** There are 500+ Socrata portals across the US and internationally. If the user asks about a city, state, or county, try it — use get_data with type "catalog" and that portal to discover its datasets, then get_data with type "query" to read them. Do NOT refuse a query just because a city isn't listed below.

To find a portal domain for a city, use common patterns: data.cityofX.us, data.X.gov, data.Xcounty.gov, data.state.X.us. If you aren't sure which domain is right, try a candidate with get_data and type "catalog" — one call either returns that portal's datasets or shows the portal isn't reachable.

### Which Tool Reaches Which Portal

get_data is the only tool that takes a portal. Settle that before choosing a tool:

- **get_data** accepts a portal argument (domain is an accepted spelling of the same thing) and works against any Socrata portal. With type "catalog" it is the cross-portal discovery path; with type "query" it runs SoQL against the portal you name.
- **search** takes exactly one argument, query, and searches only the portal this server is configured for. It has no portal argument. Reach for it when the portal you want is the configured one; use get_data with type "catalog" for every other portal.
- **fetch** takes only one argument, id, and the portal travels inside that identifier — a search hit's dataset:portal:dataset_id form (or a full dataset URL) names its portal, but a bare 4x4 ID names none, so it resolves against the portal this server is configured for.

So a dataset ID you learned somewhere else — the tables below, a curated directory, a web search — is reached with get_data and an explicit portal argument, not handed to fetch as a bare ID.

### Well-Tested Domains

get_data has been extensively tested against these portals:

| Domain | Notes |
|--------|-------|
| data.cityofnewyork.us | NYC — see Key Datasets below |
| data.cityofchicago.org | Chicago — see Key Datasets below |
| data.sfgov.org | San Francisco — see Key Datasets below |
| data.seattle.gov | Seattle — see Key Datasets below |
| data.lacity.org | Los Angeles — see Key Datasets below |

search and fetch aren't in this table: they only ever reach the portal this server is configured for, so "compatibility" isn't something that varies by domain the way it does for get_data.

### Other Portals

For portals not listed above, use get_data with type "catalog" and that portal to discover available datasets, then get_data with type "query" to read them. search and fetch won't help here — whichever portal this server is configured for, that's the only one they reach.

### When a Portal Doesn't Work

Not every city uses Socrata — some use ESRI/ArcGIS, CKAN, or proprietary platforms. If a portal doesn't respond or returns errors, let the user know:
- The city's data portal may not be Socrata-powered, so it isn't reachable through these tools yet
- This is an actively developing project — support for more portal types is on the roadmap
- Suggest trying one of the well-tested portals above, or ask if they're interested in data from a different city

### Working With a Portal Other Than the Configured One

search and fetch only ever reach the portal this server is configured for — that isn't a per-domain quirk to work around, it's what those two tools do. If the user asks about San Francisco, Los Angeles, or anywhere else that isn't the configured portal, reach it with get_data and an explicit portal argument plus dataset ID — from the tables below, a web search, or get_data with type "catalog" on that portal.

**Known LA Dataset IDs** (once you're pointed at data.lacity.org with get_data):
- MyLA311 2025: h73f-gn57
- MyLA311 2022: i5ke-k6by
- MyLA311 2020: rq3b-xjk8

## Date Range Guidelines

| Dataset Type | Volume | Single City Range | Multi-City Range |
|--------------|--------|-------------------|------------------|
| NYC 311 | ~10k/day | Up to 30 days | Up to 7 days |
| Chicago 311 | ~5k/day | Up to 30 days | Up to 14 days |
| LA 311 | ~4k/day | Up to 30 days | Up to 14 days |
| Seattle 311 | ~1.5k/day | Up to 90 days | Up to 30 days |
| SF 311 | ~2k/day | Up to 60 days | Up to 30 days |
| Housing Violations | ~500–1k/day | Up to 90 days | Up to 30 days |
| Building Permits | ~200–800/day | Up to 180 days | Up to 90 days |
| Business Licenses | ~50–200/day | Up to 1 year | Up to 180 days |

## Pagination

- Default to LIMIT 500 for raw data queries (SELECT * or SELECT field1, field2, …).
- If you get back exactly N rows (where N = your LIMIT), tell the user there may be more and offer to fetch the next page.
- Use OFFSET to paginate: SELECT … LIMIT 500 OFFSET 500 for page 2, OFFSET 1000 for page 3, etc.
- For aggregation queries (COUNT, SUM, GROUP BY), pagination is rarely needed — the result set is already small.
- Never request more than 10,000 rows in a single call. If you need to scan more data, use aggregation instead.

## Key Datasets by Portal

Below are the most-used datasets per portal for quick reference. For a dataset not listed here, use get_data with type "catalog" and the portal to discover it — search only covers the portal this server is configured for.

### NYC (data.cityofnewyork.us)

| Dataset | ID | Key Fields |
|---------|----|------------|
| 311 Service Requests (2020+) | erm2-nwe9 | complaint_type, borough, created_date, closed_date |
| Motor Vehicle Collisions | h9gi-nx95 | crash_date, borough, number_of_persons_injured |
| Restaurant Inspections | 43nn-pn8j | dba, grade, inspection_date, cuisine_description |
| Housing Violations | wvxf-dwi5 | boro, violationid, inspectiondate, class |
| Citywide Payroll | k397-673e | agency_name, title_description, base_salary, fiscal_year |
| DOB Job Applications | ic3t-wcy2 | job_type, borough, building_type, initial_cost |
| NYPD Arrests (YTD) | uip8-fykc | arrest_date, arrest_boro, ofns_desc, perp_race |
| Parking/Camera Violations | nc67-uf89 | plate, violation, issue_date, amount_due |

### Chicago (data.cityofchicago.org)

| Dataset | ID | Key Fields |
|---------|----|------------|
| Crimes - 2001 to Present | ijzp-q8t2 | date, primary_type, location_description, arrest, ward |
| Traffic Crashes | 85ca-t3if | crash_date, injuries_total, weather_condition |
| Building Permits | ydr8-5enu | permit_type, issue_date, estimated_cost |
| Food Inspections | 4ijn-s7e5 | dba_name, inspection_date, results, risk, violations |
| Building Violations | 22u3-xenr | violation_code, violation_description, address |
| Business Licenses (Active) | uupf-x98q | license_number, business_activity, expiration_date |
| Employee Salaries | xzkq-xp2w | name, job_titles, department, annual_salary |

### San Francisco (data.sfgov.org)

| Dataset | ID | Key Fields |
|---------|----|------------|
| 311 Cases | vw6y-z8j6 | requested_datetime, service_name, status_description |
| Police Incidents (2018+) | wg3w-h783 | incident_date, incident_category, police_district |
| Fire Incidents | wr8u-xric | alarm_dttm, primary_situation, address |
| Building Permits | i98e-djp9 | permit_number, filed_date, description, estimated_cost |
| Eviction Notices | 5cei-gny5 | file_date, address, non_payment, ellis_act_withdrawal |
| Registered Businesses | g8m3-pdis | dba_name, full_business_address, certificate_number |
| Employee Compensation | 88g8-5mnd | department, total_compensation, salaries, year |

### Seattle (data.seattle.gov)

| Dataset | ID | Key Fields |
|---------|----|------------|
| SPD Crime Data (2008+) | tazs-3rd5 | offense_category, offense_date, neighborhood, beat |
| Fire 911 Calls (real-time) | kzjm-xkqj | type, datetime, address, incident_number |
| Building Permits | 76t5-zqzr | permitnum, permitclass, statuscurrent, issueddate |
| Code Complaints/Violations | ez4a-iug7 | recordnum, statuscurrent, opendate, recordtype |
| Business Licenses | wnbq-64tb | business_legal_name, naics_code, street_address |
| City Wage Data | 2khk-5ukd | hourly_rate, job_title, department |

### Los Angeles (data.lacity.org)

Note: reach LA with get_data and portal "data.lacity.org" unless that happens to be the configured portal — search and fetch only cover the configured portal.

| Dataset | ID | Key Fields |
|---------|----|------------|
| MyLA311 2025 | h73f-gn57 | created_date, request_type, status, address |
| MyLA311 2022 | i5ke-k6by | created_date, request_type, status, address |
| MyLA311 2020 | rq3b-xjk8 | created_date, request_type, status, address |
| Crime Data (2020-2024) | 2nrs-mtv8 | date_occ, crm_cd, area, location, lat, lon |
| Active Businesses | 6rrh-rzua | business_name, street_address, naics, dba_name |
| Traffic Collisions (2010+) | d5tf-ez2w | date_occ, area, location_1, vict_age |

## Error Handling

### Common Socrata API Errors

**400 Bad Request** — SoQL syntax errors
- Check field names (case-sensitive)
- Validate data types in comparisons
- Ensure proper quoting of string values

**404 Not Found** — Dataset ID or domain issues
- Verify dataset ID format (4x4 pattern: abcd-1234)
- Confirm domain is correct
- Check if dataset is public/accessible

**429 Too Many Requests** — Rate limiting
- Implement delays between requests
- Use Socrata App Token for higher limits

**500 Server Error** — Complex queries or server issues
- Simplify query complexity
- Reduce result set size with LIMIT
- Retry with exponential backoff

## Socrata MCP Server Tools

| Tool | Arguments | Purpose | Returns |
|------|-----------|---------|---------|
| **search** | query only — no portal argument | Find datasets on the portal this server is configured for | Encoded IDs, e.g. dataset:portal:dataset_id |
| **fetch** | id only — the portal travels in the identifier; a bare 4x4 resolves against the configured portal | Retrieve full metadata or one record | Complete data with metadata |
| **get_data** | type, portal (any portal), plus SoQL parameters | Catalog discovery and SoQL queries — the only tool that reaches a portal other than the configured one | Raw query results |

## Output Format Guidelines

### Standard Output Structure

# [Analysis Title]

## Key Metrics
[Visual comparison table]

## Executive Summary
[2–3 paragraphs: findings, significance]

## Detailed Analysis
[Analysis with inline calculations]

## Methodology
### Data Sources
[Datasets, date ranges, record counts]

### Queries Used
| Purpose | Records | Query |
|---------|---------|-------|
| [Purpose] | [Count] | SELECT... |

## Uncertainty & Limitations Disclosure

When presenting analysis, include structured caveats so users know what they can and can't conclude:

- **Data completeness**: State what the results cover — e.g., "This covers 12,430 of ~300k annual records (last 30 days)." If you applied filters, say so.
- **Field interpretation**: When a query depends on interpreting the user's intent as a specific field or value, say so — e.g., "I interpreted 'noise' as complaint_type ILIKE '%noise%' — verify this matches your intent."
- **Limitations section**: End analysis responses with a brief **Limitations** block listing anything that qualifies the findings: date range used, missing fields, sample size, portal quirks, etc.

## Data Quality Checks

Always check for:
1. **Null Values**: WHERE field IS NOT NULL
2. **Data Freshness**: Check last_updated or similar fields
3. **Completeness**: Count missing vs. total records
4. **Consistency**: Validate against known constraints

## Advanced Techniques

### Spatial Queries
\`\`\`sql
SELECT *
WHERE within_circle(location, 40.7128, -74.0060, 1000)
\`\`\`

### Complex Aggregations
\`\`\`sql
SELECT category,
       COUNT(*) as total_requests,
       COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_requests,
       AVG(CASE WHEN closed_date IS NOT NULL
           THEN (closed_date - created_date) END) as avg_resolution_days
GROUP BY category
ORDER BY total_requests DESC
\`\`\`

---

# Socrata MCP Skill — Web Overlay

> Applies to: HTTP-connected web clients, on any deployment of the web app.

## Date Filter Enforcement

**ALWAYS add a date filter** on high-volume datasets (>1M rows, e.g., 311 data) unless the user explicitly asks for all-time data. Default to **30 days** for 311-type datasets. This is mandatory — the web environment has tighter resource constraints than local tools.

If a user's question is open-ended (e.g., "What are the top complaints in NYC?"), default to the last 30 days and tell them:
- That you scoped to the last 30 days for performance
- They can ask for a different range
- For all-time analysis, suggest using a local (stdio) client

## Deployment Limits

Follow the limits your deployment declares; where none are declared, prefer conservative defaults appropriate to shared web environments — modest result sets, few tool calls per response, and concise output.

## Token-Conscious Formatting

- Lead with the answer, then supporting data
- Use compact tables rather than verbose explanations
- Keep to a small set of key findings per response
- Skip the full "Methodology" section — include a brief "Data source" line instead
- Omit the "Queries Used" table unless the user asks for it

## Suggesting a Local Client

When a user hits a limit (complex multi-city query, long date range, deep analysis), suggest a local (stdio) client for heavier analysis — local clients connect directly to the same data sources without web-environment constraints. Keep the suggestion neutral unless your deployment declares a specific alternative.
`;

/**
 * Portal-specific guidance for the run's Socrata portal, or `''`.
 *
 * The lookup is a property read on a plain object, as the website's is: a
 * portal string that is also an `Object.prototype` property (`constructor`,
 * say) reads that property. Kept as it is, because the move changes no
 * output, including outputs the captured goldens do not cover.
 */
export const getSkillForPortal = (portal: string): string => {
  const portalSpecificGuidance: Record<string, string> = {
    'data.cityofnewyork.us': `
Use these NYC dataset IDs directly:
- 311 complaints: erm2-nwe9 (fields: complaint_type, borough, created_date)
- Restaurant inspections: 43nn-pn8j
- Housing violations: wvxf-dwi5`,
    'data.cityofchicago.org': `
Use these Chicago dataset IDs directly:
- 311 requests: v6vf-nfxy (fields: sr_type, created_date, community_area)`,
    'data.sfgov.org': `
Note: search only covers the portal this server is configured for — if that isn't data.sfgov.org, reach SF with get_data and portal: "data.sfgov.org" instead. Use dataset IDs directly:
- 311 cases: vw6y-z8j6 (fields: service_name, opened, neighborhood)`,
  };

  return portalSpecificGuidance[portal] || '';
};

/** The Socrata guidance as fetched, or the fallback when the fetch throws. */
async function fetchSkillGuidance(fetchPrompt: PromptFetcher): Promise<string> {
  try {
    const guidance = await fetchPrompt('skill-guidance', { modality: 'web' });
    // The website read `guidance.length` here, for a log line, inside this
    // `try`: a nullish result therefore threw and fell back. The read is
    // kept, without the log.
    void guidance.length;
    return guidance;
  } catch {
    return SOCRATA_SKILL_FALLBACK;
  }
}

/** The Socrata block of the composed prompt. */
export async function socrataGuidanceText(ctx: CivicGuidanceContext): Promise<string> {
  const guidance = await fetchSkillGuidance(ctx.fetchPrompt);
  const portalSection = ctx.portal
    ? `\n\n## PORTAL-SPECIFIC GUIDANCE\nDefault portal: ${ctx.portal}\n${getSkillForPortal(ctx.portal)}`
    : '';
  return `# Socrata skill guidance\n\n${guidance}${portalSection}`;
}

/**
 * The Socrata source. Its `id` is the server's package name and repository
 * address: the server declares no `mcpName` and is not published to the MCP
 * Registry. Required, with no default address.
 */
export const SOCRATA_ENTRY: CivicManifestEntry = {
  id: 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server',
  alias: 'socrata',
  sourceId: 'socrata',
  displayName: 'Socrata MCP Server',
  configuration: {
    addressVariable: SOCRATA_ADDRESS_VARIABLE,
    requirement: 'required',
  },
  tools: SOCRATA_TOOLS,
  toolNames: SOCRATA_TOOL_NAMES,
  guidance: { fetchText: socrataGuidanceText },
};
