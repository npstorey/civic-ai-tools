# OpenGov MCP Companion Skill

Guidance for querying Socrata open data portals through the OpenGov MCP Server.

## Purpose

This skill provides specialized guidance for:
- **Multi-Domain Support**: NYC, Chicago, SF, Seattle, LA, and other Socrata portals
- **Intelligent Query Assessment**: Complexity evaluation before executing large queries
- **Anti-Hallucination Protocols**: Strict adherence to actual query results
- **Domain-Specific Workarounds**: Handling limitations across different Socrata implementations

## Critical Requirements

**ALWAYS:**
- Assess query complexity before executing
- Never hallucinate data - only report what tool calls return
- Discover columns first - check schema before querying unfamiliar datasets
- Show exact queries used
- Use inline citations

**NEVER:**
- Invent data points
- Extrapolate beyond actual records
- Present findings without tool evidence
- Query without column discovery

## Query Complexity Assessment

Evaluate complexity before executing, proceed silently if low risk.

### GREEN (Low Risk) - Proceed Silently
- Single city, <7 day range
- 1-4 tool calls required
- <50k estimated records

### YELLOW (Medium Risk) - Brief Warning
- 2+ cities OR full month range
- 5-9 tool calls required
- 50-150k estimated records

### RED (High Risk) - Stop & Offer Options
- 3+ cities with month+ ranges
- 10+ tool calls required
- >150k estimated records

## Mandatory Column Discovery

Before querying ANY unfamiliar dataset, discover the schema first:

```
Tool: get_data
Type: "query"
Domain: [domain]
Dataset_id: [dataset-id]
Query: SELECT * LIMIT 1
```

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
-- Text search
WHERE field ILIKE '%search_term%'

-- Date ranges
WHERE date_field >= '2023-01-01' AND date_field < '2024-01-01'

-- Numeric ranges
WHERE amount > 1000 AND amount < 10000

-- Multiple values
WHERE status IN ('Active', 'Pending', 'Approved')
```

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

## Supported Domains

| Domain | get_data | search | fetch | Status |
|--------|----------|--------|-------|--------|
| `data.cityofnewyork.us` | Full | Full | Full | Fully Compatible |
| `data.cityofchicago.org` | Full | Full | Full | Fully Compatible |
| `data.sfgov.org` | Full | Limited | Unknown | Query-Preferred |
| `data.seattle.gov` | Full | Full | Full | Fully Compatible |
| `data.lacity.org` | Full | Limited | Fails | Query-Only |

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
| Housing Violations | ~500-1k/day | Up to 90 days | Up to 30 days |
| Building Permits | ~200-800/day | Up to 180 days | Up to 90 days |
| Business Licenses | ~50-200/day | Up to 1 year | Up to 180 days |

## NYC Open Data Key Datasets

### 311 Service Requests (`erm2-nwe9`)
- Key fields: `complaint_type`, `borough`, `created_date`, `closed_date`
- Common filters: complaint type, borough, date range
- Aggregations: by complaint type, by borough, daily/weekly trends

### Restaurant Inspections (`43nn-pn8j`)
- Key fields: `boro`, `grade`, `inspection_date`, `cuisine_description`
- Common filters: borough, grade, date range

### Housing Violations (`wvxf-dwi5`)
- Key fields: `boro`, `violationid`, `inspectiondate`
- Common filters: borough, violation type, date range

### Budget Data (`d52a-yn36`)
- Key fields: `agency_name`, `budget_amount`, `fiscal_year`
- Common filters: fiscal year, agency type

### Payroll Data (`k397-673e`)
- Key fields: `agency_name`, `title_description`, `base_salary`
- Common filters: agency, title, salary range

## Error Handling

### Common Socrata API Errors

**400 Bad Request** - SoQL syntax errors
- Check field names (case-sensitive)
- Validate data types in comparisons
- Ensure proper quoting of string values

**404 Not Found** - Dataset ID or domain issues
- Verify dataset ID format (4x4 pattern: `abcd-1234`)
- Confirm domain is correct
- Check if dataset is public/accessible

**429 Too Many Requests** - Rate limiting
- Implement delays between requests
- Use Socrata App Token for higher limits

**500 Server Error** - Complex queries or server issues
- Simplify query complexity
- Reduce result set size with LIMIT
- Retry with exponential backoff

## OpenGov MCP Server Tools

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
[2-3 paragraphs: findings, significance]

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

---

This skill provides guidance for municipal data analysis through the OpenGov MCP Server for civic research projects.
