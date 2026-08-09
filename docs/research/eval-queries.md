# Model Evaluation: Test Queries & Scoring Rubric

*Research artifact from 2026-03-10. Retained as method-of-record; not a live decision.*

Framework for systematically evaluating LLM performance on civic data queries via the Socrata MCP server.

Created: 2026-03-10
Related issue: [civic-ai-tools-website#24](https://github.com/npstorey/civic-ai-tools-website/issues/24)

---

## Test Query Set

15 queries spanning portals, complexity levels, and query types. Each includes expected behavior so evaluators can score objectively.

### Simple Lookups (catalog search + single query)

#### Q1: NYC 311 volume
- **Query**: "How many 311 complaints were filed in NYC last month?"
- **Portal**: data.cityofnewyork.us
- **Expected dataset**: 311 Service Requests (`erm2-nwe9`)
- **Expected SoQL pattern**: `SELECT COUNT(*) WHERE created_date >= '...' AND created_date < '...'`
- **Expected behavior**: Should use the curated dataset ID directly (no catalog search needed). Should interpret "last month" relative to today's date. Should apply date filter and report the count with a data completeness caveat.
- **Guidance triggers**: Date interpretation, current date awareness

#### Q2: Chicago food inspection results
- **Query**: "What percentage of Chicago restaurant inspections failed last year?"
- **Portal**: data.cityofchicago.org
- **Expected dataset**: Food Inspections (`4ijn-s7e5`)
- **Expected SoQL pattern**: `SELECT results, COUNT(*) as count GROUP BY results WHERE inspection_date >= '...'`
- **Expected behavior**: Should find the Food Inspections dataset. Should define "failed" (results = 'Fail') and calculate percentage. Should note the distinction between Fail, Pass, Pass w/ Conditions, etc.
- **Guidance triggers**: Date interpretation, column discovery, field interpretation caveat

#### Q3: SF fire incidents
- **Query**: "Show me the 5 most recent fire incidents in San Francisco"
- **Portal**: data.sfgov.org
- **Expected dataset**: Fire Incidents (`wr8u-xric`)
- **Expected SoQL pattern**: `SELECT * ORDER BY alarm_dttm DESC LIMIT 5`
- **Expected behavior**: Should use the curated dataset ID (SF search is unreliable). Should display results in a table. No date filter needed since the query is bounded by LIMIT.
- **Guidance triggers**: SF domain workaround (use known ID, not search)

### Aggregations (GROUP BY, counts, rankings)

#### Q4: Top complaint types in NYC
- **Query**: "What are the top 10 complaint types in NYC 311 data this year?"
- **Portal**: data.cityofnewyork.us
- **Expected dataset**: 311 Service Requests (`erm2-nwe9`)
- **Expected SoQL pattern**: `SELECT complaint_type, COUNT(*) as count GROUP BY complaint_type ORDER BY count DESC LIMIT 10 WHERE created_date >= '2026-01-01'`
- **Expected behavior**: Should interpret "this year" as Jan 1 of the current year to today. Should present results as a ranked table with counts. Should state the date interpretation.
- **Guidance triggers**: Date interpretation, aggregation pattern

#### Q5: Chicago crime by ward
- **Query**: "Which Chicago ward had the most crimes in February 2026?"
- **Portal**: data.cityofchicago.org
- **Expected dataset**: Crimes - 2001 to Present (`ijzp-q8t2`)
- **Expected SoQL pattern**: `SELECT ward, COUNT(*) as count WHERE date >= '2026-02-01' AND date < '2026-03-01' GROUP BY ward ORDER BY count DESC LIMIT 10`
- **Expected behavior**: Should use the explicit user-provided date (February 2026), not a default range. Should handle the `date` field correctly.
- **Guidance triggers**: Explicit user dates override defaults

#### Q6: Seattle building permit costs
- **Query**: "What's the average building permit cost in Seattle by permit class?"
- **Portal**: data.seattle.gov
- **Expected dataset**: Building Permits (`76t5-zqzr`)
- **Expected SoQL pattern**: Column discovery first, then `SELECT permitclass, AVG(value) as avg_cost, COUNT(*) as count GROUP BY permitclass ORDER BY avg_cost DESC`
- **Expected behavior**: Should discover columns first (cost field name may vary). Should apply a reasonable date filter since this is a large dataset. Should note the date filter applied.
- **Guidance triggers**: Column discovery, date range guidelines, aggregation

### Multi-Step (multiple tool calls, joining insights)

#### Q7: NYC restaurant grade distribution by borough
- **Query**: "Compare restaurant inspection grades across NYC boroughs — which borough has the highest percentage of A grades?"
- **Portal**: data.cityofnewyork.us
- **Expected dataset**: Restaurant Inspections (`43nn-pn8j`)
- **Expected SoQL pattern**: Column discovery → `SELECT boro, grade, COUNT(*) as count GROUP BY boro, grade` → percentage calculation
- **Expected behavior**: Should discover columns, then aggregate by borough and grade. Should calculate percentages (not just raw counts). Should present a comparison table. May need to filter to most recent inspection per restaurant.
- **Guidance triggers**: Column discovery, multi-step analysis, data interpretation

#### Q8: Chicago salary analysis
- **Query**: "What are the highest-paying city jobs in Chicago and how do they compare to the median salary?"
- **Portal**: data.cityofchicago.org
- **Expected dataset**: Employee Names, Salaries, Positions (`xzkq-xp2w`)
- **Expected SoQL pattern**: `SELECT job_titles, annual_salary ORDER BY annual_salary DESC LIMIT 20` + `SELECT AVG(annual_salary)` or similar for comparison
- **Expected behavior**: Should find highest salaries, compute median/average, and present comparison. Should note whether data includes part-time employees and how that affects analysis.
- **Guidance triggers**: Multi-step, data interpretation, limitations disclosure

#### Q9: LA 311 request trends
- **Query**: "Show me the trend in LA 311 requests by month for the past 6 months"
- **Portal**: data.lacity.org
- **Expected dataset**: MyLA311 2025 (`h73f-gn57`) — possibly also 2022 dataset for older months
- **Expected SoQL pattern**: `SELECT date_trunc_ym(created_date) as month, COUNT(*) as count GROUP BY month ORDER BY month`
- **Expected behavior**: Should use the known LA dataset ID directly (search doesn't work for LA). Should produce a time series by month. Should note the LA domain limitation.
- **Guidance triggers**: LA domain workaround, time series pattern, date interpretation

### Ambiguous Queries (should trigger clarification)

#### Q10: Crime rate
- **Query**: "What's the crime rate?"
- **Portal**: data.cityofnewyork.us
- **Expected behavior**: Should ask for clarification — which city? What time period? "Crime rate" per capita requires population data not available in Socrata. Should offer to show crime counts instead and suggest a city/timeframe.
- **Guidance triggers**: Ambiguous query clarification, single clarifying question

#### Q11: Permit data
- **Query**: "Show me permit data"
- **Portal**: data.cityofchicago.org
- **Expected behavior**: Should ask for clarification — building permits? Business licenses? Food permits? What time period? What information specifically? Should offer a few options and ask the user to pick.
- **Guidance triggers**: Ambiguous query clarification

### Edge Cases (guidance adherence stress tests)

#### Q12: Zero-result scenario
- **Query**: "How many building permits were issued in the Bronx in 1950?"
- **Portal**: data.cityofnewyork.us
- **Expected dataset**: DOB Job Application Filings (`ic3t-wcy2`) or DOB Permit Issuance (`ipu4-2q9a`)
- **Expected behavior**: Should attempt the query, likely get zero results (data typically starts 2000s+). Should NOT fabricate an explanation. Should verify by checking available date ranges. Should report that the data doesn't go back that far.
- **Guidance triggers**: Zero-result verification, don't hallucinate

#### Q13: Case sensitivity
- **Query**: "Show me noise complaints in manhattan from NYC 311"
- **Portal**: data.cityofnewyork.us
- **Expected dataset**: 311 Service Requests (`erm2-nwe9`)
- **Expected SoQL pattern**: `WHERE upper(complaint_type) LIKE '%NOISE%' AND upper(borough) = 'MANHATTAN'` (or sample distinct values first)
- **Expected behavior**: Should use `upper()` for case-insensitive matching or sample distinct values first. Should NOT use lowercase "manhattan" directly in a WHERE clause.
- **Guidance triggers**: Case-insensitive text filtering, `upper()` guidance

#### Q14: Pagination awareness
- **Query**: "List all active business licenses in Seattle"
- **Portal**: data.seattle.gov
- **Expected dataset**: Active Business License Tax Certificates (`wnbq-64tb`)
- **Expected SoQL pattern**: `SELECT * LIMIT 500` with pagination note
- **Expected behavior**: Should apply LIMIT 500 (not try to fetch all ~50k rows). Should note that results are paginated and there are more rows available. Should offer to fetch the next page or suggest narrowing filters.
- **Guidance triggers**: Pagination guidance, result set limits

#### Q15: Cross-portal attempt (web constraint)
- **Query**: "Compare 311 complaint volumes between NYC and Chicago for the past week"
- **Portal**: data.cityofnewyork.us
- **Expected behavior**: On web, should decline the cross-portal comparison and suggest doing one city at a time or using the local CLI. Should explain the web demo limits.
- **Guidance triggers**: Web overlay — no cross-portal comparisons, local tools CTA

---

## Scoring Rubric

Each response is scored on 6 dimensions, 1-5 scale.

### 1. Dataset Selection (1-5)

Did the model find the correct dataset?

| Score | Criteria |
|-------|----------|
| 5 | Used the correct curated dataset ID on the first tool call (no catalog search needed) |
| 4 | Found the correct dataset via catalog search on the first try |
| 3 | Found the correct dataset after 2+ search attempts |
| 2 | Used a related but suboptimal dataset (e.g., older version, wrong granularity) |
| 1 | Used the wrong dataset or failed to find any relevant dataset |

### 2. SoQL Correctness (1-5)

Is the generated query valid and does it return the right results?

| Score | Criteria |
|-------|----------|
| 5 | Perfect SoQL — correct syntax, fields, filters, aggregation; returns exactly what was asked |
| 4 | Minor issues that don't affect results (unnecessary fields, suboptimal ordering) |
| 3 | Query works but misses part of the question (e.g., wrong date range, missing filter) |
| 2 | Query has syntax errors that require retry, or returns substantially wrong results |
| 1 | Query fails entirely, uses nonexistent fields, or fundamentally misunderstands the data |

### 3. Guidance Adherence (1-5)

Does the response follow the skill guidance instructions?

| Score | Criteria |
|-------|----------|
| 5 | Follows all applicable guidance: date ranges, pagination, clarification, planning narration, case sensitivity, limitations |
| 4 | Follows most guidance; minor omissions (e.g., missing limitation note, didn't narrate plan) |
| 3 | Follows some guidance but misses significant rules (e.g., no date filter on high-volume data, no clarification on ambiguous query) |
| 2 | Largely ignores guidance; proceeds without column discovery, fabricates explanations for zero results |
| 1 | Violates core rules: hallucinated data, no tool evidence, no date filters at all |

### 4. Interpretation Quality (1-5)

Is the data summary accurate, well-structured, and appropriately caveated?

| Score | Criteria |
|-------|----------|
| 5 | Clear, accurate summary with appropriate caveats, well-formatted tables, correct calculations, uncertainty disclosed |
| 4 | Good summary with minor formatting issues or missing one caveat |
| 3 | Summary is basically correct but poorly formatted, missing key caveats, or includes unnecessary detail |
| 2 | Summary contains calculation errors, misleading framing, or omits critical context |
| 1 | Summary is substantially wrong, fabricates conclusions, or provides no useful analysis |

### 5. Cost (tokens)

Total tokens used (input + output across all rounds). Scored relative to other models on the same query.

| Score | Criteria |
|-------|----------|
| 5 | Lowest token usage among tested models (or within 10% of lowest) |
| 4 | Below median token usage |
| 3 | Near median |
| 2 | Above median |
| 1 | Highest usage (or 2x+ the median) |

### 6. Latency (seconds)

Total response time from first API call to final response. Scored relative to other models.

| Score | Criteria |
|-------|----------|
| 5 | Fastest (or within 10% of fastest) |
| 4 | Below median latency |
| 3 | Near median |
| 2 | Above median |
| 1 | Slowest (or 2x+ the median) |

---

## Composite Score

**Quality Score** = (Dataset Selection + SoQL Correctness + Guidance Adherence + Interpretation Quality) / 4

**Efficiency Score** = (Cost + Latency) / 2

**Overall Score** = Quality Score × 0.7 + Efficiency Score × 0.3

This weights quality at 70% and efficiency at 30%, reflecting the project's priority on accurate civic data analysis while still valuing cost-effectiveness for a public demo.

---

## Models to Evaluate

### Current lineup (in `availableModels`)
1. `anthropic/claude-sonnet-4` — flagship, no budget cap
2. `openai/gpt-4o` — no budget cap
3. `anthropic/claude-haiku-4-5` — budget option, 150K token cap
4. `openai/gpt-4o-mini` — cheapest, 150K token cap
5. `google/gemini-2.0-flash-001` — fast/cheap, 150K token cap

### Candidates to add
6. `anthropic/claude-sonnet-4-6` — newer Claude, likely better tool use
7. `google/gemini-3-flash-preview` — latest Gemini Flash, very low cost
8. `deepseek/deepseek-v3.2` — extremely cheap, good tool use
9. `openai/gpt-5.4` — latest GPT, competitive pricing

Check OpenRouter availability and pricing before running. Drop any that don't support tool use reliably.

---

## Running the Evaluation

```bash
cd civic-ai-tools-website

# Ensure OPENROUTER_API_KEY and SOCRATA_MCP_URL are set
# Run the eval script
node scripts/eval-models.mjs

# Results saved to scripts/eval-results-YYYY-MM-DD.json
# Manual scoring uses this JSON as input
```

See `scripts/eval-models.mjs` in the website repo for the evaluation harness.
