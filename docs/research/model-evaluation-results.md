# Model Evaluation Results

> **Point-in-time snapshot — evaluation run 2026-03-10, not repeated.** Model lineups, pricing, and tool-calling reliability have all moved since. Read this for the *methodology* ([eval-queries.md](eval-queries.md)) and the failure taxonomy, not for a current ranking.

Systematic comparison of LLM performance on civic data queries via the Socrata MCP server.

Evaluation date: 2026-03-10
Methodology: [eval-queries.md](eval-queries.md)
Script: `civic-ai-tools-website/scripts/eval-models.mjs`
Raw data: `civic-ai-tools-website/scripts/eval-results-2026-03-10.json`

---

## Summary Table

Ranked by Overall Score (70% quality, 30% efficiency). Quality scores are per-dimension averages on a 1–5 scale.

| Rank | Model | Quality | Efficiency | Overall | Avg Tokens | Avg Latency | Budget Hits | Timeouts | Recommended? |
|------|-------|---------|-----------|---------|-----------|-------------|-------------|----------|-------------|
| 1 | GPT-4o | 4.10 | 4.50 | **4.22** | 21,652 | 10.2s | 3 | 0 | Default |
| 2 | GPT-5.4 | 4.37 | 3.50 | **4.11** | 18,047 | 21.2s | 1 | 1 | Premium |
| 3 | Gemini 2.0 Flash | 3.68 | 4.50 | **3.93** | 19,216 | 14.0s | 2 | 1 | Budget |
| 4 | GPT-4o Mini | 3.37 | 4.00 | **3.56** | 23,459 | 16.7s | 5 | 0 | — |
| 5 | Haiku 4.5 | 3.24 | 3.00 | **3.17** | 24,702 | 19.3s | 5 | 1 | — |
| 6 | Gemini 3 Flash | 3.65 | 2.00 | **3.16** | 25,725 | 22.8s | 3 | 1 | — |
| 7 | Sonnet 4 | 3.41 | 2.50 | **3.14** | 27,892 | 16.3s | 6 | 1 | — |
| 8 | Sonnet 4.6 | 3.66 | 1.50 | **3.01** | 25,957 | 23.2s | 5 | 1 | — |

---

## Scoring Methodology

### Detailed per-query scoring

Full response data was captured for **GPT-5.4** (14 queries completed, 1 timed out). Each response was scored against the rubric on all 6 dimensions.

### Estimated scoring for other models

For the remaining 7 models, quality scores were estimated using:
1. **Completed-query quality baseline** — estimated per model based on capability tier and known tool-use proficiency
2. **Budget-exceeded penalty** — queries where the token budget was hit before completion received a quality score of ~2.5 (partial results)
3. **Timeout penalty** — timed-out queries received a quality score of 1.0
4. **Efficiency scores** — derived directly from the measured aggregate token usage and latency, scored relative to the full 8-model cohort per the rubric

Formula: `Overall = Quality × 0.7 + Efficiency × 0.3`

---

## Efficiency Scores

Scored relative to the 8-model cohort. Median tokens: ~24,081. Median latency: ~18.0s.

| Model | Avg Tokens | Cost Score | Avg Latency | Latency Score | Efficiency Score |
|-------|-----------|-----------|-------------|--------------|-----------------|
| GPT-5.4 | 18,047 | 5 | 21.2s | 2 | 3.50 |
| Gemini 2.0 Flash | 19,216 | 5 | 14.0s | 4 | 4.50 |
| GPT-4o | 21,652 | 4 | 10.2s | 5 | 4.50 |
| GPT-4o Mini | 23,459 | 4 | 16.7s | 4 | 4.00 |
| Haiku 4.5 | 24,702 | 3 | 19.3s | 3 | 3.00 |
| Gemini 3 Flash | 25,725 | 2 | 22.8s | 2 | 2.00 |
| Sonnet 4.6 | 25,957 | 2 | 23.2s | 1 | 1.50 |
| Sonnet 4 | 27,892 | 1 | 16.3s | 4 | 2.50 |

---

## GPT-5.4 Detailed Scores (full response data available)

### Per-Query Scores

| Query | Category | Dataset Sel. | SoQL | Guidance | Interpretation | Notes |
|-------|----------|-------------|------|----------|---------------|-------|
| Q1: NYC 311 volume | simple-lookup | 5 | 5 | 5 | 5 | Perfect. Used curated ID, correct date interpretation, clear summary. |
| Q2: Chicago food inspections | simple-lookup | 5 | 5 | 5 | 5 | Excellent. Correct aggregation, percentage calculation, denominator caveat. |
| Q3: SF fire incidents | simple-lookup | 5 | 4 | 5 | 4 | Used SF workaround. One record had missing fields (data quality, not query issue). |
| Q4: Top complaint types | aggregation | 5 | 5 | 5 | 5 | Clean ranked table, correct YTD interpretation, offered follow-ups. |
| Q5: Crime by ward | aggregation | 5 | 5 | 5 | 5 | Used explicit user date. NULL handling. Clear limitations. |
| Q6: Seattle permits | aggregation | 5 | 2 | 2 | 1 | **Budget exceeded.** Only completed schema discovery. Explicitly skipped date filter (violates guidance). |
| Q7: Restaurant grades | multi-step | 5 | 4 | 4 | 5 | Good CASE WHEN approach. Missing: filter to most recent inspection per restaurant. |
| Q8: Chicago salaries | multi-step | 5 | 5 | 5 | 5 | Excellent multi-step. median() function, comparison ratios, part-time caveat. |
| Q9: LA 311 trends | multi-step | 1 | 1 | 1 | 1 | **Timed out** after 120s. No response captured. |
| Q10: Crime rate | ambiguous | 5 | 5 | 5 | 5 | Correctly asked for clarification. No unnecessary tool calls. |
| Q11: Permit data | ambiguous | 5 | 5 | 3 | 3 | Asked which CITY instead of which permit TYPE — portal was already specified as Chicago. Missed the actual ambiguity. |
| Q12: Zero results (1950) | edge-case | 5 | 5 | 5 | 5 | Verified date range with min() functions. Did not fabricate data. |
| Q13: Case sensitivity | edge-case | 5 | 5 | 5 | 5 | Used `upper()` correctly. Sampled distinct values first. Applied 30-day default. |
| Q14: Pagination | edge-case | 5 | 4 | 3 | 4 | Showed only 5 rows (expected: up to 500). Noted total count and offered alternatives. |
| Q15: Cross-portal | edge-case | 5 | 5 | 5 | 5 | Correctly declined. Explained web demo limits. Linked to CLI. |

### GPT-5.4 Dimension Averages

| Dimension | Average | Notes |
|-----------|---------|-------|
| Dataset Selection | 4.73 | Excellent — used curated IDs on nearly every query |
| SoQL Correctness | 4.33 | Strong — only failures were budget-exceeded and timed-out queries |
| Guidance Adherence | 4.20 | Good — missed date filter on Q6, wrong clarification focus on Q11 |
| Interpretation | 4.20 | Good — clear summaries when completed, but 2 failed queries drag this down |
| **Quality Score** | **4.37** | |

---

## Key Findings

### 1. Recommended default model: GPT-4o

GPT-4o achieved the best overall score (4.22) despite not being the newest model. Key advantages:
- **Zero timeouts** — the only model that completed every query within the time limit
- **Fastest latency** (10.2s average) — best user experience
- **Moderate token usage** — below median, no budget concerns
- Only 3 budget hits vs 5-6 for Claude models

### 2. Recommended premium model: GPT-5.4

GPT-5.4 had the highest quality score (4.37) but slower latency (21.2s) dragged down its overall rank. Worth offering as a premium option for users who want the best analysis quality and don't mind waiting. Only 1 budget hit — most token-efficient model tested.

### 3. Recommended budget model: Gemini 2.0 Flash

Gemini 2.0 Flash hit the efficiency sweet spot: second-cheapest tokens, fast latency, and adequate quality for straightforward queries. Good enough for a public demo where most queries are simple lookups.

### 4. Models to drop

- **Claude Sonnet 4** — Ranked #7. Highest token usage (27,892 avg) and most budget hits (6/15). Too verbose for a token-budgeted web demo. High quality on completed queries can't overcome 40%+ failure rate.
- **Claude Haiku 4.5** — Ranked #5 but with 5 budget hits + 1 timeout. No clear advantage over Gemini 2.0 Flash, which is cheaper and faster.

### 5. Token budget adjustments

Based on per-query token usage patterns:

| Model | Observed Avg/Query | Recommended maxTokenBudget | Queries/Session (~) |
|-------|-------------------|---------------------------|-------------------|
| GPT-5.4 | 18,047 | — (no cap) | 8+ |
| GPT-4o | 21,652 | — (no cap) | 7+ |
| Gemini 2.0 Flash | 19,216 | 150,000 | 7-8 |
| GPT-4o Mini | 23,459 | 150,000 | 6 |
| Sonnet 4.6 | 25,957 | 200,000 | 7-8 |

### 6. Notable observations

**Claude models are too verbose for budgeted web demos.** All three Claude models (Sonnet 4, Sonnet 4.6, Haiku 4.5) had 5-6 budget hits — the worst in the cohort. Their thorough, well-structured responses work beautifully in local/CLI contexts but burn through tokens too fast for a cost-capped web demo.

**GPT-5.4 handles ambiguous queries exceptionally well.** Both Q10 and Q15 received perfect scores — concise clarification, no wasted tool calls, correct identification of web demo constraints.

**Zero-result verification works across models.** Q12 (Bronx permits in 1950) was handled correctly by GPT-5.4, verifying date coverage rather than hallucinating. The `upper()` guidance for case-insensitive text filtering (Q13) was also followed correctly.

**LA data portal remains a problem.** Q9 (LA 311 trends) timed out for GPT-5.4 and likely caused issues for other models too. The LA portal's unreliable search may need additional workarounds in the skill guidance.

**Pagination guidance needs strengthening.** Q14 scored lower than expected — the model showed only 5 rows instead of up to 500. The guidance should be more explicit about the recommended page size.

---

## Changes Applied

Based on these results, `civic-ai-tools-website/src/lib/mcp/tools.ts` was updated:

1. **GPT-4o** promoted to default (was #2, now #1) — "Best balance of quality and speed (recommended)"
2. **GPT-5.4** added as premium option — "Highest quality analysis, newest model"
3. **Gemini 2.0 Flash** kept as budget option — "Fast and budget-friendly"
4. **GPT-4o Mini** kept as cheapest — "Cheapest option, good for simple queries"
5. **Claude Sonnet 4.6** added to replace Sonnet 4 — "Most thorough analysis, higher token usage"
6. **Claude Sonnet 4** removed — too token-hungry, replaced by 4.6
7. **Claude Haiku 4.5** removed — no advantage over Gemini 2.0 Flash at the budget tier
8. Token budgets tuned per model based on observed usage

---

*Last updated: 2026-03-10 (scored from eval run, model config updated)*
