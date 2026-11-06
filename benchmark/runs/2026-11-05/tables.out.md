**The run directories** (each `summary.json` → `runId`, `mode`, `completeRows`, `expectedRows`, `errorRows`, `notStarted`, `stopReason`, `spentUsd`, `files`)

| Run directory | Mode | Rows complete | Rows expected | Error rows | Not started | Stop | Recorded spend, at list price | `rows.jsonl` sha256 |
|---|---|---|---|---|---|---|---|---|
| `2026-11-05-ow-probe-181703` | `open-weight-probe` | 147 | 147 | 0 | 0 | none | $0.1227 | `8d615c4b954fe0f789c6f60c06cfbdadb618074c30740fdf4de6b7c2300a15da` |
| `2026-11-05-probe-181956` | `probe` | 8 | 8 | 0 | 0 | none | $0.3878 | `e5b8e7e75077b0b27daac5b2a68897118aa7b4d1b1612f6bf80a19ac12a3638d` |
| `2026-11-05-run-191511` | `evaluations` | 11672 | 11672 | 0 | 0 | none | $34.3373 | `316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c` |

**The open-weight probe** (`2026-11-05-ow-probe-181703/summary.json` → `groups[]`: `offered`, `raw`, `errors`, `costUsd`). The winner is the best first request over the offered gold.

| Model | Rows | First request correct, offered gold | First request correct, raw gold | Error rows | Cost of the rows |
|---|---|---|---|---|---|
| `z-ai/glm-5.3-flash` | 49 | 0.8163 of 49 | 0.7347 of 49 | 0 | $0.0475 |
| `xiaomi/mimo-v2.6-flash` | 49 | 0.6939 of 49 | 0.6531 of 49 | 0 | $0.0496 |
| `deepseek/deepseek-v4-flash-0731` | 49 | 0.6327 of 49 | 0.6327 of 49 | 0 | $0.0256 |

**Filter recall** (`2026-11-05-run-191511/summary.json` → `groups[].filterRecall`; for the builder's reads, `groups[].selectionFilterRecall`): the rows whose shortlist holds a whole acceptable set. A main row's shortlist is its first request's directory; a builder read is one per question.

| Configuration | Model | Rows | Shortlist holds the gold | Against the design's line |
|---|---|---|---|---|
| `baseline-7` | `anthropic/claude-haiku-5.5` | 447 | 426 of 447 (0.953) | at or above |
| `baseline-7` | `z-ai/glm-5.3-flash` | 447 | 426 of 447 (0.953) | at or above |
| `flat-50` | `anthropic/claude-haiku-5.5` | 447 | 447 of 447 (1) | at or above |
| `flat-50` | `z-ai/glm-5.3-flash` | 447 | 447 of 447 (1) | at or above |
| `flat-200` | `anthropic/claude-haiku-5.5` | 447 | 447 of 447 (1) | at or above |
| `flat-200` | `z-ai/glm-5.3-flash` | 447 | 447 of 447 (1) | at or above |
| `flat-1000` | `anthropic/claude-haiku-5.5` | 50 | 50 of 50 (1) | at or above |
| `shortlist-50` | `anthropic/claude-haiku-5.5` | 447 | 402 of 447 (0.8993) | below |
| `shortlist-50` | `z-ai/glm-5.3-flash` | 447 | 402 of 447 (0.8993) | below |
| `shortlist-200` | `anthropic/claude-haiku-5.5` | 447 | 393 of 447 (0.8792) | below |
| `shortlist-200` | `z-ai/glm-5.3-flash` | 447 | 393 of 447 (0.8792) | below |
| `shortlist-1000` | `anthropic/claude-haiku-5.5` | 447 | 363 of 447 (0.8121) | below |
| `shortlist-1000` | `z-ai/glm-5.3-flash` | 447 | 363 of 447 (0.8121) | below |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 402 of 447 (0.8993) | below |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 402 of 447 (0.8993) | below |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 393 of 447 (0.8792) | below |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 393 of 447 (0.8792) | below |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 363 of 447 (0.8121) | below |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 363 of 447 (0.8121) | below |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 438 of 447 (0.9799) | at or above |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 438 of 447 (0.9799) | at or above |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 444 of 447 (0.9933) | at or above |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 444 of 447 (0.9933) | at or above |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 438 of 447 (0.9799) | at or above |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 438 of 447 (0.9799) | at or above |
| `builder-50-reads` | `anthropic/claude-haiku-5.5` | 149 | 146 of 149 (0.9799) | at or above |
| `builder-200-reads` | `anthropic/claude-haiku-5.5` | 149 | 148 of 149 (0.9933) | at or above |
| `builder-1000-reads` | `anthropic/claude-haiku-5.5` | 149 | 146 of 149 (0.9799) | at or above |

**Directory accuracy** (`2026-11-05-run-191511/summary.json` → `groups[].offered` and `raw`: `n`, `firstRequest`, `afterSecondRequest`, `overLoading`). Correct is R5's `exact` or `acceptable`; over-loaded is R5's `over` class, the precision measure. The capped configurations are `shortlist`, `shortlist+search` and `builder`; `baseline-7` and `flat` are not capped.

| Configuration | Model | Rows | First request, offered gold | First request, raw gold | After the second, offered gold | After the second, raw gold | Over-loaded, offered gold | Over-loaded, raw gold |
|---|---|---|---|---|---|---|---|---|
| `baseline-7` | `anthropic/claude-haiku-5.5` | 447 | 0.7606 | 0.7159 | 0.7606 | 0.7159 | 0.2192 | 0.217 |
| `baseline-7` | `z-ai/glm-5.3-flash` | 447 | 0.7584 | 0.7159 | 0.7584 | 0.7159 | 0.1879 | 0.1834 |
| `flat-50` | `anthropic/claude-haiku-5.5` | 447 | 0.8121 | 0.8121 | 0.8121 | 0.8121 | 0.1253 | 0.1253 |
| `flat-50` | `z-ai/glm-5.3-flash` | 447 | 0.7248 | 0.7248 | 0.7248 | 0.7248 | 0.1298 | 0.1298 |
| `flat-200` | `anthropic/claude-haiku-5.5` | 447 | 0.8568 | 0.8568 | 0.8568 | 0.8568 | 0.094 | 0.094 |
| `flat-200` | `z-ai/glm-5.3-flash` | 447 | 0.7942 | 0.7942 | 0.7942 | 0.7942 | 0.0895 | 0.0895 |
| `flat-1000` | `anthropic/claude-haiku-5.5` | 50 | 0.82 | 0.82 | 0.8 | 0.8 | 0.12 | 0.12 |
| `shortlist-50` | `anthropic/claude-haiku-5.5` | 447 | 0.7136 | 0.7002 | 0.7136 | 0.7002 | 0.2528 | 0.1655 |
| `shortlist-50` | `z-ai/glm-5.3-flash` | 447 | 0.7047 | 0.689 | 0.7047 | 0.689 | 0.2327 | 0.1477 |
| `shortlist-200` | `anthropic/claude-haiku-5.5` | 447 | 0.745 | 0.7271 | 0.745 | 0.7271 | 0.226 | 0.123 |
| `shortlist-200` | `z-ai/glm-5.3-flash` | 447 | 0.7226 | 0.7025 | 0.7226 | 0.7025 | 0.2103 | 0.1096 |
| `shortlist-1000` | `anthropic/claude-haiku-5.5` | 447 | 0.7226 | 0.6868 | 0.7226 | 0.6868 | 0.2304 | 0.0738 |
| `shortlist-1000` | `z-ai/glm-5.3-flash` | 447 | 0.7002 | 0.6286 | 0.7002 | 0.6286 | 0.2103 | 0.094 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 0.7763 | 0.774 | 0.7763 | 0.774 | 0.1946 | 0.123 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 0.736 | 0.7293 | 0.7338 | 0.7271 | 0.17 | 0.132 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 0.7808 | 0.7785 | 0.7785 | 0.7763 | 0.1812 | 0.1007 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 0.7673 | 0.7651 | 0.7673 | 0.7651 | 0.1477 | 0.0872 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 0.7718 | 0.7517 | 0.7517 | 0.7315 | 0.1879 | 0.0895 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 0.7629 | 0.7338 | 0.7539 | 0.7248 | 0.132 | 0.085 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 0.7987 | 0.7919 | 0.7987 | 0.7919 | 0.1678 | 0.1544 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 0.7808 | 0.774 | 0.7808 | 0.774 | 0.1499 | 0.1342 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 0.8523 | 0.8523 | 0.8523 | 0.8523 | 0.1208 | 0.1141 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 0.8233 | 0.8233 | 0.8233 | 0.8233 | 0.1298 | 0.1208 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 0.8635 | 0.8568 | 0.8121 | 0.8054 | 0.1074 | 0.0805 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 0.8345 | 0.8277 | 0.8143 | 0.8076 | 0.1074 | 0.0805 |

**Search recall at k** (`2026-11-05-run-191511/summary.json` → `groups[].searchRecall`: `at5`, `at10`): of the rows whose shortlist missed and that called `find_source`, those whose first k hits completed an acceptable set. `rule` is the same search with the question's text as the query and no model, one row per question, over the questions whose gold needs a source.

| Configuration | Model | Recall in the first five hits | Recall in the first ten hits |
|---|---|---|---|
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 12 of 12 (1) | 12 of 12 (1) |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 23 of 26 (0.8846) | 25 of 26 (0.9615) |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 17 of 17 (1) | 17 of 17 (1) |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 26 of 27 (0.963) | 26 of 27 (0.963) |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 31 of 35 (0.8857) | 31 of 35 (0.8857) |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 49 of 51 (0.9608) | 50 of 51 (0.9804) |
| `rule-50` | none | 70 of 113 (0.6195) | 86 of 113 (0.7611) |
| `rule-200` | none | 84 of 121 (0.6942) | 96 of 121 (0.7934) |
| `rule-1000` | none | 83 of 131 (0.6336) | 92 of 131 (0.7023) |

**The notice rate** (`2026-11-05-run-191511/summary.json` → `groups[].notice`, `searches`): of the rows whose shortlist missed, those in which the model called `find_source`.

| Configuration | Model | Shortlist missed, and the model searched | Rows that searched at all | Search calls |
|---|---|---|---|---|
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 12 of 45 (0.2667) | 47 | 53 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 26 of 45 (0.5778) | 103 | 113 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 17 of 54 (0.3148) | 42 | 43 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 27 of 54 (0.5) | 82 | 87 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 35 of 84 (0.4167) | 38 | 38 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 51 of 84 (0.6071) | 94 | 95 |

**Tokens per question** (`2026-11-05-run-191511/summary.json` → `groups[].tokens`): a row is one question, one repeat, one model; medians over the rows.

| Configuration | Model | Rows | First-request prompt tokens, median | Least | Most | Prompt tokens a row, median | Completion tokens a row, median | Completion tokens a request, median | Directory's share of the first request's characters, median | Reasoning tokens, all rows |
|---|---|---|---|---|---|---|---|---|---|---|
| `baseline-7` | `anthropic/claude-haiku-5.5` | 447 | 1827 | 1815 | 1850 | 15895 | 427 | 179 | 0.8143 | 79054 |
| `baseline-7` | `z-ai/glm-5.3-flash` | 447 | 1148 | 1139 | 1198 | 7474 | 125 | 47 | 0.8037 | 48257 |
| `flat-50` | `anthropic/claude-haiku-5.5` | 447 | 9233 | 9221 | 9256 | 20848 | 259 | 137 | 0.9263 | 62676 |
| `flat-50` | `z-ai/glm-5.3-flash` | 447 | 6064 | 6055 | 6110 | 13718 | 88 | 35 | 0.9239 | 54563 |
| `flat-200` | `anthropic/claude-haiku-5.5` | 447 | 34843 | 34831 | 34866 | 72069 | 243 | 123 | 0.9407 | 56545 |
| `flat-200` | `z-ai/glm-5.3-flash` | 447 | 22883 | 22874 | 22926 | 47334 | 98 | 42 | 0.94 | 172212 |
| `flat-1000` | `anthropic/claude-haiku-5.5` | 50 | 161328.5 | 161318 | 161345 | 325140 | 321 | 152.5 | 0.9413 | 7766 |
| `shortlist-50` | `anthropic/claude-haiku-5.5` | 447 | 1353 | 1331 | 3118 | 8592 | 354 | 151 | 0.7575 | 70448 |
| `shortlist-50` | `z-ai/glm-5.3-flash` | 447 | 855 | 808 | 2014 | 5305 | 93 | 38 | 0.7436 | 38781 |
| `shortlist-200` | `anthropic/claude-haiku-5.5` | 447 | 1772 | 1592 | 3378 | 8755 | 321 | 140 | 0.8074 | 64645 |
| `shortlist-200` | `z-ai/glm-5.3-flash` | 447 | 1105 | 980 | 2193 | 5600 | 84 | 35 | 0.7965 | 47869 |
| `shortlist-1000` | `anthropic/claude-haiku-5.5` | 447 | 2308 | 1980 | 3939 | 9941 | 301 | 143 | 0.8446 | 68850 |
| `shortlist-1000` | `z-ai/glm-5.3-flash` | 447 | 1459 | 1235 | 2555 | 6232 | 86 | 35 | 0.836 | 32328 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 1690 | 1506 | 5326 | 8928 | 328 | 145 | 0.6479 | 62111 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 1103 | 937 | 3296 | 5723 | 101 | 35 | 0.6702 | 29037 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 2110 | 1767 | 4953 | 9117 | 316 | 136 | 0.7177 | 59406 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 1378 | 1109 | 3436 | 5915 | 85 | 33 | 0.7249 | 29211 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 2620 | 2155 | 4231 | 10205 | 313 | 135.5 | 0.7725 | 59682 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 1739 | 1364 | 3650 | 6596 | 87 | 33 | 0.7653 | 29236 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 999 | 753 | 3307 | 6385 | 241 | 111 | 0.6323 | 37593 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 610 | 437 | 2133 | 3998 | 63 | 29 | 0.6154 | 18149 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 1061.5 | 733 | 2353 | 5029.5 | 223.5 | 105 | 0.6659 | 35903 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 646.5 | 423 | 1516 | 3238.5 | 60 | 28 | 0.6496 | 12816 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 1058 | 740 | 1803 | 5008 | 230 | 110.5 | 0.6562 | 40836 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 650 | 429 | 1138 | 3250 | 61 | 28 | 0.6401 | 9834 |

**Latency and cost per question** (`2026-11-05-run-191511/summary.json` → `groups[].latencyMs`, `costUsd`, `costPerRowMean`): milliseconds; cost at list price, the larger of the computed and the reported cost of each request. A builder read is its own row, one per question, shared by both models' main rows; the summary gives its cost only.

| Configuration | Model | Rows | First request, median ms | First request, p90 ms | Second request, median ms | Second request, p90 ms | Cost of the rows | Cost a row, mean |
|---|---|---|---|---|---|---|---|---|
| `baseline-7` | `anthropic/claude-haiku-5.5` | 447 | 1856 | 3367 | 1993 | 2864 | $0.6244 | $0.0014 |
| `baseline-7` | `z-ai/glm-5.3-flash` | 447 | 1369 | 4900 | 1577 | 6280 | $0.3055 | $0.0007 |
| `flat-50` | `anthropic/claude-haiku-5.5` | 447 | 1864 | 3005 | 1230 | 2550 | $1.0424 | $0.0023 |
| `flat-50` | `z-ai/glm-5.3-flash` | 447 | 1319 | 4983 | 1357 | 8187 | $0.6309 | $0.0014 |
| `flat-200` | `anthropic/claude-haiku-5.5` | 447 | 1925 | 3034 | 1439 | 2690 | $3.1657 | $0.0071 |
| `flat-200` | `z-ai/glm-5.3-flash` | 447 | 1434 | 4716 | 1850 | 16489 | $1.823 | $0.0041 |
| `flat-1000` | `anthropic/claude-haiku-5.5` | 50 | 3217.5 | 5900 | 3240 | 6487 | $7.7135 | $0.1543 |
| `shortlist-50` | `anthropic/claude-haiku-5.5` | 447 | 1890 | 3099 | 1501 | 2598 | $0.5274 | $0.0012 |
| `shortlist-50` | `z-ai/glm-5.3-flash` | 447 | 1070 | 4109 | 1406 | 6344 | $0.3349 | $0.0007 |
| `shortlist-200` | `anthropic/claude-haiku-5.5` | 447 | 1873 | 3021 | 1339 | 2503 | $0.5114 | $0.0011 |
| `shortlist-200` | `z-ai/glm-5.3-flash` | 447 | 1158 | 4338 | 1419.5 | 7696 | $0.361 | $0.0008 |
| `shortlist-1000` | `anthropic/claude-haiku-5.5` | 447 | 1851 | 2845 | 1293.5 | 2702 | $0.5608 | $0.0013 |
| `shortlist-1000` | `z-ai/glm-5.3-flash` | 447 | 1197 | 5069 | 1433.5 | 5753 | $0.3962 | $0.0009 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 1869 | 2839 | 1411.5 | 2740 | $0.5358 | $0.0012 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 1096 | 3834 | 1312 | 4553 | $0.3967 | $0.0009 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 1828 | 2783 | 1234 | 2610 | $0.5273 | $0.0012 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 1143 | 4049 | 1241 | 4918 | $0.4018 | $0.0009 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 1787 | 2623 | 1310 | 2680 | $0.5636 | $0.0013 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 1087 | 3677 | 1401 | 4339 | $0.4381 | $0.001 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 1614 | 2156 | 1107 | 2300 | $0.3497 | $0.0008 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 847.5 | 2320 | 984 | 3694 | $0.2494 | $0.0006 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 1638 | 2100 | 1046 | 2320 | $0.3004 | $0.0007 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 764 | 2213 | 925 | 2963 | $0.2234 | $0.0005 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 1609 | 2103 | 1137 | 2370 | $0.2992 | $0.0007 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 731 | 1744 | 993 | 3293 | $0.2167 | $0.0005 |
| `builder-50-reads` | `anthropic/claude-haiku-5.5` | 149 | — | — | — | — | $0.1479 | — |
| `builder-200-reads` | `anthropic/claude-haiku-5.5` | 149 | — | — | — | — | $0.5017 | — |
| `builder-1000-reads` | `anthropic/claude-haiku-5.5` | 149 | — | — | — | — | $11.1883 | — |

**The flat directory against the capped shortlist with search** (`2026-11-05-run-191511/summary.json` → `groups[].raw.firstRequest`, `offered.firstRequest`, `costPerRowMean`). On `flat` every entry is offered, so its offered gold is its raw gold. `flat-1000` ran on one model, one repeat, over a drawn subset of the questions (its rows): a cost point, not compared.

| Model | Flat | Flat, first request | Shortlist with search | Its first request, raw gold | Its first request, offered gold | Flat below it, raw gold | Flat below it, offered gold | Flat, cost a row | Shortlist with search, cost a row |
|---|---|---|---|---|---|---|---|---|---|
| `anthropic/claude-haiku-5.5` | `flat-50` | 0.8121 | `shortlist+search-50` | 0.774 | 0.7763 | no | no | $0.0023 | $0.0012 |
| `anthropic/claude-haiku-5.5` | `flat-200` | 0.8568 | `shortlist+search-200` | 0.7785 | 0.7808 | no | no | $0.0071 | $0.0012 |
| `anthropic/claude-haiku-5.5` | `flat-1000` | 0.82 | `shortlist+search-1000` | 0.7517 | 0.7718 | not compared | not compared | $0.1543 | $0.0013 |
| `z-ai/glm-5.3-flash` | `flat-50` | 0.7248 | `shortlist+search-50` | 0.7293 | 0.736 | yes | yes | $0.0014 | $0.0009 |
| `z-ai/glm-5.3-flash` | `flat-200` | 0.7942 | `shortlist+search-200` | 0.7651 | 0.7673 | no | no | $0.0041 | $0.0009 |

**The three shapes at each size** (`2026-11-05-run-191511/summary.json` → `groups[].filterRecall`, `raw.firstRequest`): the place filter's shortlist (`shortlist+search`), the builder's (`builder`), and no shortlist (`flat`). The last column names the configuration with the highest first request on the raw gold; a tie names each.

| Model | Shortlist with search | Filter recall, place filter | Filter recall, builder | Flat, raw gold | Shortlist with search, raw gold | Builder, raw gold | Highest |
|---|---|---|---|---|---|---|---|
| `anthropic/claude-haiku-5.5` | `shortlist+search-50` | 0.8993 | 0.9799 | 0.8121 | 0.774 | 0.7919 | `flat-50` |
| `anthropic/claude-haiku-5.5` | `shortlist+search-200` | 0.8792 | 0.9933 | 0.8568 | 0.7785 | 0.8523 | `flat-200` |
| `anthropic/claude-haiku-5.5` | `shortlist+search-1000` | 0.8121 | 0.9799 | not compared | 0.7517 | 0.8568 | `builder-1000` |
| `z-ai/glm-5.3-flash` | `shortlist+search-50` | 0.8993 | 0.9799 | 0.7248 | 0.7293 | 0.774 | `builder-50` |
| `z-ai/glm-5.3-flash` | `shortlist+search-200` | 0.8792 | 0.9933 | 0.7942 | 0.7651 | 0.8233 | `builder-200` |
| `z-ai/glm-5.3-flash` | `shortlist+search-1000` | 0.8121 | 0.9799 | not compared | 0.7338 | 0.8277 | `builder-1000` |

**The failure classes, first request** (`2026-11-05-run-191511/summary.json` → `groups[].offered.counts1` and `raw.counts1`): rows by R5's five classes. `over` loaded a gold set and more, or anything where only loading nothing is gold; `missing` loaded nothing where a load was needed, or part of a gold set; `wrong` is any other load (`scoring/score.mjs`).

| Configuration | Model | Exact, offered | Acceptable, offered | Over, offered | Missing, offered | Wrong, offered | Exact, raw | Acceptable, raw | Over, raw | Missing, raw | Wrong, raw |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `baseline-7` | `anthropic/claude-haiku-5.5` | 319 | 21 | 98 | 0 | 9 | 299 | 21 | 97 | 20 | 10 |
| `baseline-7` | `z-ai/glm-5.3-flash` | 318 | 21 | 84 | 6 | 18 | 299 | 21 | 82 | 25 | 20 |
| `flat-50` | `anthropic/claude-haiku-5.5` | 180 | 183 | 56 | 1 | 27 | 180 | 183 | 56 | 1 | 27 |
| `flat-50` | `z-ai/glm-5.3-flash` | 162 | 162 | 58 | 10 | 55 | 162 | 162 | 58 | 10 | 55 |
| `flat-200` | `anthropic/claude-haiku-5.5` | 144 | 239 | 42 | 0 | 22 | 144 | 239 | 42 | 0 | 22 |
| `flat-200` | `z-ai/glm-5.3-flash` | 135 | 220 | 40 | 15 | 37 | 135 | 220 | 40 | 15 | 37 |
| `flat-1000` | `anthropic/claude-haiku-5.5` | 13 | 28 | 6 | 1 | 2 | 13 | 28 | 6 | 1 | 2 |
| `shortlist-50` | `anthropic/claude-haiku-5.5` | 180 | 139 | 113 | 0 | 15 | 133 | 180 | 74 | 6 | 54 |
| `shortlist-50` | `z-ai/glm-5.3-flash` | 180 | 135 | 104 | 1 | 27 | 135 | 173 | 66 | 8 | 65 |
| `shortlist-200` | `anthropic/claude-haiku-5.5` | 104 | 229 | 101 | 0 | 13 | 93 | 232 | 55 | 8 | 59 |
| `shortlist-200` | `z-ai/glm-5.3-flash` | 114 | 209 | 94 | 0 | 30 | 102 | 212 | 49 | 9 | 75 |
| `shortlist-1000` | `anthropic/claude-haiku-5.5` | 98 | 225 | 103 | 0 | 21 | 69 | 238 | 33 | 16 | 91 |
| `shortlist-1000` | `z-ai/glm-5.3-flash` | 113 | 200 | 94 | 1 | 39 | 66 | 215 | 42 | 33 | 91 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 205 | 142 | 87 | 0 | 13 | 162 | 184 | 55 | 1 | 45 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 187 | 142 | 76 | 7 | 35 | 151 | 175 | 59 | 10 | 52 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 117 | 232 | 81 | 0 | 17 | 113 | 235 | 45 | 1 | 53 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 118 | 225 | 66 | 1 | 37 | 114 | 228 | 39 | 2 | 64 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 111 | 234 | 84 | 0 | 18 | 83 | 253 | 40 | 9 | 62 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 117 | 224 | 59 | 4 | 43 | 86 | 242 | 38 | 17 | 64 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 233 | 124 | 75 | 0 | 15 | 177 | 177 | 69 | 3 | 21 |
| `builder-50` | `z-ai/glm-5.3-flash` | 226 | 123 | 67 | 0 | 31 | 170 | 176 | 60 | 3 | 38 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 203 | 178 | 54 | 0 | 12 | 141 | 240 | 51 | 0 | 15 |
| `builder-200` | `z-ai/glm-5.3-flash` | 197 | 171 | 58 | 0 | 21 | 134 | 234 | 54 | 0 | 25 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 201 | 185 | 48 | 0 | 13 | 120 | 263 | 36 | 3 | 25 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 190 | 183 | 48 | 1 | 25 | 116 | 254 | 36 | 4 | 37 |

**The request after a load, the picks and the errors** (`2026-11-05-run-191511/summary.json` → `groups[].secondRequest`, `picks`, `noRequestRows`, `errors`, `consistency`). A pick is a first load; a synthetic copy is a near-duplicate or a wrapper, counted correct wherever its original is; a registry entry loads no tools; a CKAN pack carries Boston OpenContext's tools as a stand-in.

| Configuration | Model | Second requests | A valid tool call | No tool call | Loaded more only | An invalid tool call | Correct, with a synthetic copy | First pick a registry entry | First pick a CKAN pack | No request (empty selection) | Error rows | Questions whose repeats loaded the same set |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `baseline-7` | `anthropic/claude-haiku-5.5` | 375 | 373 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.9195 of 149 |
| `baseline-7` | `z-ai/glm-5.3-flash` | 349 | 344 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0.8054 of 149 |
| `flat-50` | `anthropic/claude-haiku-5.5` | 386 | 385 | 0 | 0 | 1 | 23 | 0 | 0 | 0 | 0 | 0.8456 of 149 |
| `flat-50` | `z-ai/glm-5.3-flash` | 377 | 358 | 4 | 15 | 0 | 2 | 0 | 0 | 0 | 0 | 0.7114 of 149 |
| `flat-200` | `anthropic/claude-haiku-5.5` | 395 | 386 | 7 | 0 | 2 | 11 | 7 | 15 | 0 | 0 | 0.8658 of 149 |
| `flat-200` | `z-ai/glm-5.3-flash` | 378 | 355 | 17 | 6 | 0 | 2 | 8 | 17 | 0 | 0 | 0.6711 of 149 |
| `flat-1000` | `anthropic/claude-haiku-5.5` | 44 | 39 | 3 | 2 | 0 | 0 | 5 | 0 | 0 | 0 | — (one repeat) |
| `shortlist-50` | `anthropic/claude-haiku-5.5` | 399 | 391 | 8 | 0 | 0 | 22 | 0 | 0 | 0 | 0 | 0.8523 of 149 |
| `shortlist-50` | `z-ai/glm-5.3-flash` | 382 | 377 | 2 | 1 | 2 | 1 | 0 | 0 | 0 | 0 | 0.7584 of 149 |
| `shortlist-200` | `anthropic/claude-haiku-5.5` | 400 | 394 | 6 | 0 | 0 | 32 | 0 | 15 | 0 | 0 | 0.8456 of 149 |
| `shortlist-200` | `z-ai/glm-5.3-flash` | 386 | 377 | 5 | 3 | 1 | 10 | 0 | 13 | 0 | 0 | 0.7181 of 149 |
| `shortlist-1000` | `anthropic/claude-haiku-5.5` | 406 | 391 | 12 | 1 | 2 | 31 | 0 | 15 | 0 | 0 | 0.8121 of 149 |
| `shortlist-1000` | `z-ai/glm-5.3-flash` | 384 | 376 | 2 | 6 | 0 | 6 | 0 | 15 | 0 | 0 | 0.7315 of 149 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 390 | 384 | 5 | 1 | 0 | 15 | 0 | 0 | 0 | 0 | 0.8658 of 149 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 379 | 365 | 2 | 8 | 4 | 1 | 0 | 0 | 0 | 0 | 0.6644 of 149 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 397 | 389 | 7 | 1 | 0 | 22 | 6 | 15 | 0 | 0 | 0.8523 of 149 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 397 | 373 | 11 | 11 | 2 | 11 | 10 | 14 | 0 | 0 | 0.7248 of 149 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 409 | 386 | 11 | 12 | 0 | 31 | 22 | 15 | 0 | 0 | 0.7987 of 149 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 403 | 371 | 9 | 22 | 1 | 10 | 22 | 18 | 0 | 0 | 0.651 of 149 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 390 | 390 | 0 | 0 | 0 | 5 | 0 | 0 | 51 | 0 | 0.906 of 149 |
| `builder-50` | `z-ai/glm-5.3-flash` | 386 | 374 | 5 | 7 | 0 | 9 | 0 | 0 | 51 | 0 | 0.7383 of 149 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 399 | 386 | 9 | 0 | 4 | 20 | 9 | 15 | 39 | 0 | 0.8591 of 149 |
| `builder-200` | `z-ai/glm-5.3-flash` | 401 | 382 | 10 | 9 | 0 | 14 | 8 | 16 | 39 | 0 | 0.7181 of 149 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 417 | 365 | 21 | 31 | 0 | 12 | 53 | 15 | 24 | 0 | 0.8456 of 149 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 418 | 358 | 41 | 19 | 0 | 9 | 50 | 15 | 24 | 0 | 0.745 of 149 |

**The builder's reads** (`2026-11-05-run-191511/summary.json` → `groups[]`, role `builder`: `emptySelections`, `droppedAliases`, `errors`, `costUsd`).

| Step | Model | Reads | Empty selections | Dropped aliases | Error rows | Cost of the reads |
|---|---|---|---|---|---|---|
| `builder-50-reads` | `anthropic/claude-haiku-5.5` | 149 | 17 | 1 | 0 | $0.1479 |
| `builder-200-reads` | `anthropic/claude-haiku-5.5` | 149 | 13 | 0 | 0 | $0.5017 |
| `builder-1000-reads` | `anthropic/claude-haiku-5.5` | 149 | 8 | 0 | 0 | $11.1883 |
