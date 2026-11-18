**The sheet's cause: misses at S1's last request and at the end** (`2026-11-05-run-130812/rows.jsonl`, read by `benchmark/report/sheet-cause.mjs`). A report-side measurement that the preregistration did not name: it explains the sheet's size against the preregistration's estimate, which counted misses at S1's last request on S1's rows, and it concludes nothing about the round. Over the rows of item one of the unnoticed miss, per step and model: misses at S1's last request (the request after the loads), misses at the end (the scorer's `missAtEnd`, which the sheet holds), the misses at S1's last request that the later requests recovered, and the misses at the end that were not misses at S1's last request.

| Configuration | Model | Rows of item one | Misses at S1's last request | Misses at the end | Recovered by the later requests | Misses at the end that were not at S1's last |
|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 336 | 21 | 16 | 5 | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 336 | 31 | 24 | 7 | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 363 | 15 | 7 | 8 | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 363 | 18 | 10 | 8 | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 390 | 20 | 8 | 12 | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 390 | 20 | 15 | 5 | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 336 | 20 | 16 | 4 | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | 336 | 24 | 20 | 4 | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 363 | 15 | 5 | 10 | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | 363 | 21 | 14 | 7 | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 390 | 20 | 9 | 11 | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 390 | 21 | 17 | 4 | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 339 | 49 | 44 | 5 | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 339 | 58 | 56 | 2 | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 363 | 54 | 39 | 15 | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 363 | 40 | 33 | 7 | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 393 | 70 | 57 | 13 | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 393 | 76 | 67 | 9 | 0 |
| every stub step | both models | 6546 | 593 | 457 | 136 | 0 |
