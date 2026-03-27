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

## Mandatory Column Discovery — DO NOT SKIP

Column names vary across portals and datasets. NEVER guess column names — guessing wastes tool calls on failed queries. ALWAYS run a schema discovery query first on any dataset you haven't seen before:

```
Tool: get_data
Type: "query"
Domain: [domain]
Dataset_id: [dataset-id]
Query: SELECT * LIMIT 1
```

Read the returned column names carefully before constructing any aggregation or filter query. This one extra call saves 2-3 failed retries with wrong column names.

## Core SoQL Query Patterns

### Basic Query Structure
```sql
SELECT field1, field2, field3
WHERE condition
ORDER BY field1
LIMIT 1000
```

### Common Filter Patterns
```sql
-- Text search (NEVER use ILIKE — it fails on many Socrata datasets, especially with GROUP BY)
WHERE upper(field) LIKE '%SEARCH_TERM%'

-- Date ranges
WHERE date_field >= '2023-01-01' AND date_field < '2024-01-01'

-- Numeric ranges
WHERE amount > 1000 AND amount < 10000

-- Multiple values
WHERE status IN ('Active', 'Pending', 'Approved')
```

### Text Column Filtering

SoQL string comparisons are **case-sensitive**. Always use `upper()` for text filters:

```sql
WHERE upper(boro) = 'MANHATTAN'
WHERE upper(complaint_type) = 'NOISE - RESIDENTIAL'
```

When filtering on a text column for the first time, sample distinct values to learn the actual casing and spelling:

```sql
SELECT DISTINCT boro LIMIT 20
```

### Zero-Result Verification

If a query returns zero results and the user's question seems reasonable, **DO NOT fabricate explanations**. Instead:

1. Sample distinct values for the filter columns (`SELECT DISTINCT col LIMIT 20`)
2. Check if your filter values match the actual casing/spelling in the data
3. Try broader filters (remove one condition at a time)
4. Only conclude the data doesn't exist after exhausting these verification steps

### Aggregation Patterns
```sql
SELECT department, COUNT(*) as count, SUM(amount) as total
GROUP BY department
ORDER BY total DESC
```

### Time Series Analysis
```sql
SELECT date_trunc_y(date_field) as year,
       COUNT(*) as annual_count
GROUP BY year
ORDER BY year
```

## Domain Support

**Any Socrata open data portal can be queried.** There are 500+ Socrata portals across the US and internationally. If the user asks about a city, state, or county, try it — use the `search` tool to discover datasets on that domain, or use `get_data` with the domain directly. Do NOT refuse a query just because a city isn't listed below.

To find a portal domain for a city, use common patterns: `data.cityofX.us`, `data.X.gov`, `data.Xcounty.gov`, `data.state.X.us`. If unsure, use the `search` tool with the city name.

### Well-Tested Domains

These portals have been extensively tested. Tool compatibility notes:

| Domain | get_data | search | fetch | Status |
|--------|----------|--------|-------|--------|
| `data.cityofnewyork.us` | Full | Full | Full | Fully Compatible |
| `data.cityofchicago.org` | Full | Full | Full | Fully Compatible |
| `data.sfgov.org` | Full | Limited | Unknown | Query-Preferred |
| `data.seattle.gov` | Full | Full | Full | Fully Compatible |
| `data.lacity.org` | Full | Limited | Fails | Query-Only |

### Other Portals

For portals not listed above, start with `search` to discover available datasets, then use `get_data` to query them. Most Socrata portals support all three tools. If `search` or `fetch` fails on a particular portal, fall back to `get_data` with a known dataset ID.

### When a Portal Doesn't Work

Not every city uses Socrata — some use ESRI/ArcGIS, CKAN, or proprietary platforms. If a portal doesn't respond or returns errors, let the user know:
- The city's data portal may not be Socrata-powered, so it isn't reachable through these tools yet
- This is an actively developing project — support for more portal types is on the roadmap
- Suggest trying one of the well-tested portals above, or ask if they're interested in data from a different city

### Domain-Specific Workarounds

**San Francisco (`data.sfgov.org`):**
- Search tool sometimes returns NYC data instead of SF
- Use web search to find SF dataset IDs, then use `get_data`

**Los Angeles (`data.lacity.org`):**
- Only `get_data` works; search and fetch tools fail
- Use web search to find LA dataset IDs, then use `get_data` exclusively

**Known LA Dataset IDs:**
- MyLA311 2025: `h73f-gn57`
- MyLA311 2022: `i5ke-k6by`
- MyLA311 2020: `rq3b-xjk8`

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

- Default to `LIMIT 500` for raw data queries (SELECT * or SELECT field1, field2, …).
- If you get back exactly N rows (where N = your LIMIT), tell the user there may be more and offer to fetch the next page.
- Use `OFFSET` to paginate: `SELECT … LIMIT 500 OFFSET 500` for page 2, `OFFSET 1000` for page 3, etc.
- For aggregation queries (COUNT, SUM, GROUP BY), pagination is rarely needed — the result set is already small.
- Never request more than 10,000 rows in a single call. If you need to scan more data, use aggregation instead.

## Key Datasets by Portal

A full curated directory with ~20-30 datasets per portal is at [`docs/datasets.md`](../datasets.md). Below are the most-used datasets per portal for quick reference. Use the MCP `search` tool for datasets not listed here.

### NYC (`data.cityofnewyork.us`)

| Dataset | ID | Key Fields |
|---------|----|------------|
| 311 Service Requests (2020+) | `erm2-nwe9` | complaint_type, borough, created_date, closed_date |
| Motor Vehicle Collisions | `h9gi-nx95` | crash_date, borough, number_of_persons_injured |
| Restaurant Inspections | `43nn-pn8j` | dba, grade, inspection_date, cuisine_description |
| Housing Violations | `wvxf-dwi5` | boro, violationid, inspectiondate, class |
| Citywide Payroll | `k397-673e` | agency_name, title_description, base_salary, fiscal_year |
| DOB Job Applications | `ic3t-wcy2` | job_type, borough, building_type, initial_cost |
| NYPD Arrests (YTD) | `uip8-fykc` | arrest_date, arrest_boro, ofns_desc, perp_race |
| Parking/Camera Violations | `nc67-uf89` | plate, violation, issue_date, amount_due |

### Chicago (`data.cityofchicago.org`)

| Dataset | ID | Key Fields |
|---------|----|------------|
| Crimes - 2001 to Present | `ijzp-q8t2` | date, primary_type, location_description, arrest, ward |
| Traffic Crashes | `85ca-t3if` | crash_date, injuries_total, weather_condition |
| Building Permits | `ydr8-5enu` | permit_type, issue_date, estimated_cost |
| Food Inspections | `4ijn-s7e5` | dba_name, inspection_date, results, risk, violations |
| Building Violations | `22u3-xenr` | violation_code, violation_description, address |
| Business Licenses (Active) | `uupf-x98q` | license_number, business_activity, expiration_date |
| Employee Salaries | `xzkq-xp2w` | name, job_titles, department, annual_salary |

### San Francisco (`data.sfgov.org`)

| Dataset | ID | Key Fields |
|---------|----|------------|
| 311 Cases | `vw6y-z8j6` | requested_datetime, service_name, status_description |
| Police Incidents (2018+) | `wg3w-h783` | incident_date, incident_category, police_district |
| Fire Incidents | `wr8u-xric` | alarm_dttm, primary_situation, address |
| Building Permits | `i98e-djp9` | permit_number, filed_date, description, estimated_cost |
| Eviction Notices | `5cei-gny5` | file_date, address, non_payment, ellis_act_withdrawal |
| Registered Businesses | `g8m3-pdis` | dba_name, full_business_address, certificate_number |
| Employee Compensation | `88g8-5mnd` | department, total_compensation, salaries, year |

### Seattle (`data.seattle.gov`)

| Dataset | ID | Key Fields |
|---------|----|------------|
| SPD Crime Data (2008+) | `tazs-3rd5` | offense_category, offense_date, neighborhood, beat |
| Fire 911 Calls (real-time) | `kzjm-xkqj` | type, datetime, address, incident_number |
| Building Permits | `76t5-zqzr` | permitnum, permitclass, statuscurrent, issueddate |
| Code Complaints/Violations | `ez4a-iug7` | recordnum, statuscurrent, opendate, recordtype |
| Business Licenses | `wnbq-64tb` | business_legal_name, naics_code, street_address |
| City Wage Data | `2khk-5ukd` | hourly_rate, job_title, department |

### Los Angeles (`data.lacity.org`)

**Note:** Only `get_data` works for LA — search and fetch tools fail.

| Dataset | ID | Key Fields |
|---------|----|------------|
| MyLA311 2025 | `h73f-gn57` | created_date, request_type, status, address |
| MyLA311 2022 | `i5ke-k6by` | created_date, request_type, status, address |
| MyLA311 2020 | `rq3b-xjk8` | created_date, request_type, status, address |
| Crime Data (2020-2024) | `2nrs-mtv8` | date_occ, crm_cd, area, location, lat, lon |
| Active Businesses | `6rrh-rzua` | business_name, street_address, naics, dba_name |
| Traffic Collisions (2010+) | `d5tf-ez2w` | date_occ, area, location_1, vict_age |

## Error Handling

### Common Socrata API Errors

**400 Bad Request** — SoQL syntax errors
- Check field names (case-sensitive)
- Validate data types in comparisons
- Ensure proper quoting of string values

**404 Not Found** — Dataset ID or domain issues
- Verify dataset ID format (4x4 pattern: `abcd-1234`)
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

| Tool | Purpose | Returns |
|------|---------|---------|
| **search** | Find datasets or search within a dataset | Encoded IDs |
| **fetch** | Retrieve full metadata or records | Complete data with metadata |
| **get_data** | Execute SoQL queries (recommended) | Raw query results |

## Output Format Guidelines

### Standard Output Structure
```markdown
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
| [Purpose] | [Count] | `SELECT...` |
```

## Uncertainty & Limitations Disclosure

When presenting analysis, include structured caveats so users know what they can and can't conclude:

- **Data completeness**: State what the results cover — e.g., "This covers 12,430 of ~300k annual records (last 30 days)." If you applied filters, say so.
- **Field interpretation**: When a query depends on interpreting the user's intent as a specific field or value, say so — e.g., "I interpreted 'noise' as upper(complaint_type) LIKE '%NOISE%' — verify this matches your intent."
- **Limitations section**: End analysis responses with a brief **Limitations** block listing anything that qualifies the findings: date range used, missing fields, sample size, portal quirks, etc.

## Data Quality Checks

Always check for:
1. **Null Values**: `WHERE field IS NOT NULL`
2. **Data Freshness**: Check `last_updated` or similar fields
3. **Completeness**: Count missing vs. total records
4. **Consistency**: Validate against known constraints

## Advanced Techniques

### Spatial Queries
```sql
SELECT *
WHERE within_circle(location, 40.7128, -74.0060, 1000)
```

### Complex Aggregations
```sql
SELECT category,
       COUNT(*) as total_requests,
       COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_requests,
       AVG(CASE WHEN closed_date IS NOT NULL
           THEN (closed_date - created_date) END) as avg_resolution_days
GROUP BY category
ORDER BY total_requests DESC
```
