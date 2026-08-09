# Dataset Directory Size Evaluation

*Research artifact from 2026-03-10. Retained as method-of-record; not a live decision.*

Analysis of whether the current curated dataset directory (~15-20 datasets per portal, 78 total) is optimal for AI-assisted civic data queries.

Created: 2026-03-10
Related issue: [civic-ai-tools#28](https://github.com/npstorey/civic-ai-tools/issues/28)

---

## 1. Current State

### Directory structure

- **`docs/datasets.md`** — Full curated directory: 78 datasets across 5 portals
- **`docs/skills/base.md`** (line 180) — Quick-reference table inlined in skill guidance: 6-8 datasets per portal (34 total)
- The full directory is **not** inlined in the AI prompt. Only the quick-reference table in `base.md` is sent to models.

### Datasets per portal

| Portal | Full directory | Quick-reference (in prompt) |
|--------|---------------|----------------------------|
| NYC | 16 | 8 |
| Chicago | 19 | 7 |
| SF | 17 | 7 |
| Seattle | 15 | 6 |
| LA | 11 | 6 |
| **Total** | **78** | **34** |

### How datasets are used at runtime

1. **Web demo**: The system prompt includes `base.md` + `web.md` (via MCP prompt endpoint). The quick-reference table (~34 datasets) is inlined. The full directory is NOT included.
2. **Local tools (Claude Code, Cursor)**: The system prompt includes `base.md` + `local.md`. Same quick-reference table. The full `datasets.md` file exists in the repo but is only accessible if the AI reads it.
3. **Catalog search**: The MCP server's `search` tool can find datasets not in the directory by querying the Socrata Discovery API.

**Key finding**: The AI prompt currently includes ~34 datasets (the quick-reference table), not 78. The full directory is a reference document, not part of the prompt.

---

## 2. Token Cost Analysis

### Current prompt token consumption

Measured by counting the quick-reference table in `base.md` (lines 182-242):

| Component | Approx. tokens |
|-----------|---------------|
| Quick-reference table (34 datasets) | ~1,200 |
| Full `base.md` skill guidance | ~4,500 |
| `web.md` overlay | ~800 |
| System prompt wrapper | ~200 |
| **Total system prompt** | **~5,500** |

The dataset quick-reference table is ~22% of the total system prompt. This is reasonable.

### Scaling scenarios

| Scenario | Datasets in prompt | Est. table tokens | % of system prompt | Impact |
|----------|-------------------|-------------------|-------------------|--------|
| Current | 34 | ~1,200 | 22% | Baseline |
| Expanded (50) | 50 | ~1,800 | 28% | Modest increase |
| Expanded (100) | 100 | ~3,500 | 42% | Significant — starts competing with guidance for attention |
| Expanded (200) | 200 | ~7,000 | 56% | Excessive — dataset list would dominate the prompt |

**Cost impact per query** (at $3/M input tokens for Claude Sonnet):
- Current (1,200 tokens): $0.0036 per query for datasets
- 50 datasets: $0.0054 (+50%)
- 100 datasets: $0.0105 (+192%)
- 200 datasets: $0.021 (+483%)

At the web demo's volume (est. 50-200 queries/day), the cost difference between 34 and 100 datasets is $0.35-$1.40/day — not significant. But the attention dilution effect matters more than cost.

### Full directory as a tool call target

The full `datasets.md` file is ~8,800 tokens. If the AI fetches it via a tool call instead of having it inlined, it:
- Saves ~1,200 tokens per query where the dataset is already known
- Costs ~8,800 tokens when the AI needs to consult the directory (but only when needed)
- This is the tiered approach — and it's roughly what the current architecture already does (quick-reference inline, full directory in repo)

---

## 3. Coverage Analysis

Using the 15 test queries from `eval-queries.md`, check whether the quick-reference table (34 datasets in `base.md`) contains the needed dataset:

| Query | Needed Dataset | In quick-reference? | Notes |
|-------|---------------|---------------------|-------|
| Q1: NYC 311 volume | `erm2-nwe9` | **Yes** | Top dataset |
| Q2: Chicago food inspection | `4ijn-s7e5` | **Yes** | In quick-ref |
| Q3: SF fire incidents | `wr8u-xric` | **Yes** | In quick-ref |
| Q4: NYC 311 top complaints | `erm2-nwe9` | **Yes** | Same as Q1 |
| Q5: Chicago crime by ward | `ijzp-q8t2` | **Yes** | Top dataset |
| Q6: Seattle permit costs | `76t5-zqzr` | **Yes** | In quick-ref |
| Q7: NYC restaurant grades | `43nn-pn8j` | **Yes** | In quick-ref |
| Q8: Chicago salaries | `xzkq-xp2w` | **Yes** | In quick-ref |
| Q9: LA 311 trends | `h73f-gn57` | **Yes** | In quick-ref |
| Q10: Crime rate (ambiguous) | N/A | N/A | Clarification needed |
| Q11: Permit data (ambiguous) | N/A | N/A | Clarification needed |
| Q12: NYC permits 1950 | `ic3t-wcy2` | **Yes** | In quick-ref |
| Q13: NYC noise complaints | `erm2-nwe9` | **Yes** | Same as Q1 |
| Q14: Seattle business licenses | `wnbq-64tb` | **Yes** | In quick-ref |
| Q15: Cross-portal comparison | N/A | N/A | Should decline on web |

**Result: 12/12 answerable queries are covered by the quick-reference table.** The 34-dataset quick-reference covers the most common query types well.

### Where the quick-reference falls short

The quick-reference doesn't include more specialized datasets that users might ask about:

| Query type | Example | Covered? |
|------------|---------|----------|
| "What's the air quality in NYC?" | Environmental data — not in directory | No |
| "Show me school test scores in Chicago" | Education data — not in directory | No |
| "What are taxi trip patterns in NYC?" | NYC TLC trip data — not in quick-ref (but in full directory for Chicago) | Partial |
| "How many evictions in SF this year?" | SF Eviction Notices (`5cei-gny5`) — in quick-ref | Yes |
| "Show me road conditions in Seattle" | Road Weather Stations (`egc4-d24i`) — in full directory only | No |
| "What are the biggest city contracts in Chicago?" | Contracts (`rsxa-ify5`) — in full directory only | No |

The full directory (78 datasets) covers most of these. But even 78 datasets can't cover every possible question — that's what catalog search is for.

### Portal gaps

| Portal | Full directory | Coverage quality | Gap areas |
|--------|---------------|------------------|-----------|
| NYC | 16 datasets | Strong | Environment, education, transit ridership |
| Chicago | 19 datasets | Strong | Education, energy, environment |
| SF | 17 datasets | Good | Environment, transit, education |
| Seattle | 15 datasets | Good | Environment, education, social services |
| LA | 11 datasets | Weakest | Limited by portal reliability issues; environment, education, transit |

LA has the fewest datasets, partly because the portal's search/fetch tools don't work — making it harder to discover new datasets to add.

---

## 4. Recommendation: Keep Current Tiered Approach

The current architecture is already close to optimal:

### What's working

1. **Quick-reference (34 datasets) in the prompt** — covers 100% of common query types, reasonable token cost (~1,200 tokens, 22% of prompt)
2. **Full directory (78 datasets) in the repo** — available for the AI to consult in local mode, and serves as documentation
3. **Catalog search as fallback** — handles anything not in either directory

### What to change

**Minor adjustments, not structural:**

1. **Add a reference to the full directory in the skill guidance** (already done at base.md line 180 — "A full curated directory with ~20-30 datasets per portal is at `docs/datasets.md`"). In local mode, the AI can read this file. In web mode, it relies on catalog search for anything not in the quick-reference.

2. **Grow the full directory to ~25-30 per portal where gaps exist** — specifically:
   - Add 2-3 environment/sustainability datasets per portal
   - Add 1-2 education datasets for NYC and Chicago (if available on Socrata)
   - Grow LA to ~15 by adding more known dataset IDs

3. **Don't expand the quick-reference table beyond ~8 per portal** — the current 6-8 per portal is the right balance. More would dilute attention without improving first-try accuracy for common queries.

4. **Don't inline the full directory in the prompt** — at 8,800+ tokens, it would nearly double the system prompt and mostly add datasets that are rarely asked about.

### Why NOT to expand aggressively

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| 50 per portal in prompt | More first-try hits for niche queries | +600 tokens, attention dilution, most rarely used | Not worth it |
| 100 per portal in prompt | Near-comprehensive coverage | +2,300 tokens, significant dilution, competing with guidance | Counterproductive |
| Tiered: 8 inline + full via tool | Best of both worlds | Already the current approach | **Keep** |
| Dynamic directory (fetched per query) | Always current | Extra latency, complexity | Over-engineered for now |

### Action items

- [x] Quick-reference table in base.md (34 datasets, 6-8 per portal) — already optimal
- [x] Full directory at docs/datasets.md (78 datasets) — already exists
- [x] Reference from base.md to full directory — already at line 180
- [ ] Add 5-10 more datasets to full directory (environment, education gaps) — optional, low priority
- [ ] Run the model evaluation (eval-queries.md) and check if any queries fail due to missing datasets — will validate this analysis

---

## 5. For Research Collaborators

If conducting a formal evaluation of directory size impact:

### Experimental design

1. **Control**: Current quick-reference (34 datasets inline)
2. **Treatment A**: Expanded quick-reference (50 datasets inline)
3. **Treatment B**: Full directory inline (78+ datasets)
4. **Treatment C**: No directory (catalog search only)

### Metrics to measure

- **First-try dataset accuracy**: Did the model use the correct dataset on its first tool call?
- **Tool calls to correct answer**: How many tool calls before the right data is returned?
- **Token cost**: Total input + output tokens per query
- **Latency**: End-to-end response time
- **Guidance adherence**: Does a larger directory distract from following other guidance instructions?

### Hypothesis

The current tiered approach (34 datasets inline) should produce the best overall score because:
- Common queries hit the inline directory on the first try (no catalog search delay)
- Uncommon queries fall through to catalog search (which works for NYC, Chicago, and Seattle)
- The prompt stays focused on guidance quality, not dataset enumeration
- Portal-specific workarounds (SF, LA) are more valuable than more dataset IDs

Expanding to 50 inline might marginally improve first-try accuracy for niche queries but at the cost of prompt size and attention. Expanding to 100+ would likely decrease overall quality due to attention dilution.

---

*This analysis supports closing civic-ai-tools#28 with the conclusion that the current size is near-optimal. The tiered architecture (quick-reference inline + full directory as reference + catalog search fallback) is the right design. Growth should focus on the full directory (not the inline table) and on improving catalog search reliability for SF and LA portals.*
