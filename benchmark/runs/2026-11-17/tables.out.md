**The run directories** (each `summary.json` → `runId`, `mode`, `today`, `completeRows`, `expectedRows`, `errorRows`, `notStarted`, `stopReason`, `spentUsd`, `inputsHash`, `files`). `today` is the date every request stated.

| Run directory | Mode | Date stated | Rows complete | Rows expected | Error rows | Not started | Stop | Recorded spend, at list price | The inputs' hash | `rows.jsonl` sha256 |
|---|---|---|---|---|---|---|---|---|---|---|
| `2026-11-05-probe-130729` | `probe` | `2026-11-05` | 8 | 8 | 0 | 0 | none | $0.0319 | `79a30392bdc8169c157f90c7f9b049e8be251affa848d95a48eb2e8ec0b0dcaf` | `94c54901e9d2ac41f4270f3a53f0161c83aa3f3f81c02f6b31a966db1688e232` |
| `2026-11-05-run-130812` | `evaluations` | `2026-11-05` | 8046 | 8046 | 0 | 0 | none | $29.5054 | `79a30392bdc8169c157f90c7f9b049e8be251affa848d95a48eb2e8ec0b0dcaf` | `566bdf4266a2d2631bd5cb3ac86f98efaa6ec5710278a04c093a0c6b6af824dd` |

**The probe** (`2026-11-05-probe-130729/summary.json` → `groups[]`: `raw.firstRequest`, `offered.firstRequest`; `round.groups[]`: `endedBy`, `requestsAfterS1`, `costUsd`, `s1CostUsd`). One repeat of the probe's questions on both models; every probe row also sent the answering request, recorded apart from its answer. A rate here is over the probe's rows.

| Configuration | Model | Rows | Complete | First request, raw gold | First request, offered gold | Ended by an answer | Ended by the answering turn | Requests after S1's last, median | Largest | Cost of the rows, whole | Cost of S1's requests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `probe-builder+search-50` | `anthropic/claude-haiku-5.5` | 2 | 2 | 1 | 1 | 2 | 0 | 3.5 | 4 | $0.0105 | $0.0019 |
| `probe-builder+search-50` | `z-ai/glm-5.3-flash` | 2 | 2 | 1 | 1 | 2 | 0 | 5.5 | 6 | $0.0069 | $0.0016 |
| `probe-builder+search-1000` | `anthropic/claude-haiku-5.5` | 2 | 2 | 1 | 1 | 2 | 0 | 3 | 3 | $0.0088 | $0.0019 |
| `probe-builder+search-1000` | `z-ai/glm-5.3-flash` | 2 | 2 | 1 | 1 | 2 | 0 | 4.5 | 6 | $0.0057 | $0.0015 |

**E against the comparators, first request** (`2026-11-05-run-130812/summary.json` → `groups[].raw.firstRequest` and `offered.firstRequest`; S1's rows, `2026-11-05-run-191511/summary.json` → the same fields): per model and size, `builder+search-N` (the design's E) beside `builder-N` (the same directory, no search) and `shortlist+search-N` (the same search over the place filter's shortlist), this run's rows and S1's. S1's rows sent the same requests to the same models on another day (the preregistration, "The comparators"). Correct is `exact` or `acceptable`. The comparison columns compare the first request on the raw gold in words: E against each comparator, this run's and S1's, and each comparator's run against its S1 rows.

| Model | E | Rows | E, raw gold | E, offered gold | Builder | Builder, raw gold | Builder, offered gold | S1's builder, raw gold | S1's builder, offered gold | Place filter with search | Its raw gold | Its offered gold | S1's place filter, raw gold | S1's place filter, offered gold | E against the builder, raw | E against S1's builder, raw | E against the place filter, raw | E against S1's place filter, raw | This run's builder against S1's, raw | This run's place filter against S1's, raw |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `anthropic/claude-haiku-5.5` | `builder+search-50` | 447 | 0.8121 | 0.8188 | `builder-50` | 0.7987 | 0.8054 | 0.7919 | 0.7987 | `shortlist+search-50` | 0.7718 | 0.7763 | 0.774 | 0.7763 | E above | E above | E above | E above | above | below |
| `anthropic/claude-haiku-5.5` | `builder+search-200` | 447 | 0.8591 | 0.8591 | `builder-200` | 0.8456 | 0.8456 | 0.8523 | 0.8523 | `shortlist+search-200` | 0.7785 | 0.7785 | 0.7785 | 0.7808 | E above | E above | E above | E above | below | equal |
| `anthropic/claude-haiku-5.5` | `builder+search-1000` | 447 | 0.8635 | 0.8702 | `builder-1000` | 0.8568 | 0.8635 | 0.8568 | 0.8635 | `shortlist+search-1000` | 0.7539 | 0.7852 | 0.7517 | 0.7718 | E above | E above | E above | E above | equal | above |
| `z-ai/glm-5.3-flash` | `builder+search-50` | 447 | 0.7808 | 0.7875 | `builder-50` | 0.7808 | 0.7875 | 0.774 | 0.7808 | `shortlist+search-50` | 0.7472 | 0.7472 | 0.7293 | 0.736 | equal | E above | E above | E above | above | above |
| `z-ai/glm-5.3-flash` | `builder+search-200` | 447 | 0.8412 | 0.8412 | `builder-200` | 0.8166 | 0.8166 | 0.8233 | 0.8233 | `shortlist+search-200` | 0.7808 | 0.7808 | 0.7651 | 0.7673 | E above | E above | E above | E above | below | above |
| `z-ai/glm-5.3-flash` | `builder+search-1000` | 447 | 0.8143 | 0.821 | `builder-1000` | 0.7964 | 0.8031 | 0.8277 | 0.8345 | `shortlist+search-1000` | 0.736 | 0.7606 | 0.7338 | 0.7629 | E above | E below | E above | E above | below | above |

**E against the comparators, paired on the raw gold** (`2026-11-05-run-130812/summary.json` → `round.paired[]`: `pairs`, `both`, `onlyFirst`, `onlySecond`, `neither`, `mcnemarP`): this run's rows paired by model, question and repeat; the first request correct on the raw gold in both, in E only, in the comparator only, or in neither. The p is the exact two-sided McNemar test on the two discordant counts, at six places as the summary holds it. No threshold decides anything (the preregistration).

| E | Comparator | Model | Pairs | Correct in both | In E only | In the comparator only | In neither | Exact McNemar p | The discordant pairs lean to |
|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 351 | 12 | 6 | 78 | 0.237885 | E |
| `builder+search-50` | `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 325 | 38 | 20 | 64 | 0.024746 | E |
| `builder+search-50` | `builder-50` | `z-ai/glm-5.3-flash` | 447 | 331 | 18 | 18 | 80 | 1 | neither: equal |
| `builder+search-50` | `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 308 | 41 | 26 | 72 | 0.086437 | E |
| `builder+search-200` | `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 377 | 7 | 1 | 62 | 0.070313 | E |
| `builder+search-200` | `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 333 | 51 | 15 | 48 | 0.00001 | E |
| `builder+search-200` | `builder-200` | `z-ai/glm-5.3-flash` | 447 | 351 | 25 | 14 | 57 | 0.108129 | E |
| `builder+search-200` | `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 323 | 53 | 26 | 45 | 0.003183 | E |
| `builder+search-1000` | `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 373 | 13 | 10 | 51 | 0.677639 | E |
| `builder+search-1000` | `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 317 | 69 | 20 | 41 | 0 | E |
| `builder+search-1000` | `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 340 | 24 | 16 | 67 | 0.268187 | E |
| `builder+search-1000` | `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 293 | 71 | 36 | 47 | 0.000923 | E |

**The notice rate behind the builder** (`2026-11-05-run-130812/summary.json` → `round.groups[].noticeBehindBuilder`): over `builder+search-N`'s rows whose directory, the builder's selection, holds no whole acceptable set. `noticed` is S1's: the model called `find_source` in S1's requests. `noticedByEnd` also counts a search run after S1's last request. Each over every such row and over those that sent a request (a row with an empty selection sends none). The preregistration reports these as counts: they rest on a few questions.

| Configuration | Model | Noticed in S1's requests, every such row | Of those that sent a request | Noticed by the end, every such row | Of those that sent a request |
|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 0 of 9 (0) | 0 of 6 (0) | 4 of 9 (0.4444) | 4 of 6 (0.6667) |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 0 of 9 (0) | 0 of 6 (0) | 0 of 9 (0) | 0 of 6 (0) |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 0 of 9 (0) | 0 of 6 (0) | 2 of 9 (0.2222) | 2 of 6 (0.3333) |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 0 of 9 (0) | 0 of 6 (0) | 0 of 9 (0) | 0 of 6 (0) |

**Search recall in E** (`2026-11-05-run-130812/summary.json` → `groups[].searchRecall`: `at5`, `at10`; `searches`): S1's search recall at k over `builder+search-N`'s rows: of the rows whose directory misses and that searched in S1's requests, those whose first five, and first ten, hits complete an acceptable set. `searches` counts S1's requests' searches over every row.

| Configuration | Model | Recall in the first five hits | Recall in the first ten hits | Rows that searched at all | Search calls |
|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | — (none apply) | — (none apply) | 4 | 4 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | — (none apply) | — (none apply) | 64 | 71 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | — (none apply) | — (none apply) | 0 | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | — (none apply) | — (none apply) | 53 | 57 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | — (none apply) | — (none apply) | 7 | 7 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | — (none apply) | — (none apply) | 47 | 48 |

**How the stub rows ended** (`2026-11-05-run-130812/summary.json` → `round.groups[]`: `rows`, `complete`, `rowsThatWentOn`, `endedBy`, `answeringReason`, `requestsAfterS1`). A row that went on is a complete row that sent a request; `answer` is a response with no tool call and with text; `answering-turn` is the final-answer request's response, sent at the bound (`bound`), after an empty response (`empty`) or after one that announced work (`announcement`); `size` and `error` end a row with no answer.

| Configuration | Model | Rows | Complete | Went on | Ended by an answer | Ended by the answering turn | Ended by size | Ended by an error | Answering turn at the bound | After an empty response | After an announcement | Requests after S1's last, median | Largest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 447 | 447 | 396 | 279 | 117 | 0 | 0 | 112 | 0 | 5 | 5 | 7 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 447 | 447 | 396 | 174 | 222 | 0 | 0 | 221 | 0 | 1 | 7 | 7 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 447 | 447 | 408 | 250 | 158 | 0 | 0 | 150 | 0 | 8 | 6 | 7 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 447 | 447 | 408 | 164 | 244 | 0 | 0 | 241 | 0 | 3 | 7 | 7 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 447 | 423 | 261 | 162 | 0 | 0 | 159 | 0 | 3 | 6 | 7 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 447 | 447 | 423 | 177 | 246 | 0 | 0 | 243 | 0 | 3 | 7 | 7 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 447 | 396 | 294 | 102 | 0 | 0 | 98 | 0 | 4 | 5 | 7 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 447 | 396 | 190 | 206 | 0 | 0 | 200 | 0 | 6 | 7 | 7 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 447 | 408 | 274 | 134 | 0 | 0 | 128 | 0 | 6 | 5 | 7 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 447 | 408 | 195 | 213 | 0 | 0 | 210 | 0 | 3 | 7 | 7 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 447 | 423 | 277 | 146 | 0 | 0 | 143 | 0 | 3 | 6 | 7 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 447 | 423 | 209 | 214 | 0 | 0 | 211 | 0 | 3 | 6 | 7 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 447 | 447 | 327 | 120 | 0 | 0 | 115 | 0 | 5 | 5 | 7 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 447 | 447 | 211 | 236 | 0 | 0 | 231 | 0 | 5 | 7 | 7 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 447 | 447 | 321 | 126 | 0 | 0 | 119 | 0 | 7 | 5 | 7 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 447 | 447 | 213 | 234 | 0 | 0 | 233 | 0 | 1 | 7 | 7 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 447 | 447 | 325 | 122 | 0 | 0 | 117 | 0 | 5 | 5 | 7 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 447 | 447 | 181 | 266 | 0 | 0 | 264 | 0 | 2 | 7 | 7 |

**The unnoticed miss: the misses at the end and the unnoticed-miss rate** (`2026-11-05-run-130812/summary.json` → `round.groups[].unnoticedMiss` → `rule` and `labels`: `missesAtEnd`, `endedBySizeOrError`, `unnoticed`, `countedBeside`). Item one: of the complete rows that sent a request, whose raw gold needs a source and that did not end by `size` or `error`, those none of whose acceptable sets lies within the sources the row loaded by its end; it reads no answer, so it is the same under each reading, and the rows ended by `size` or `error` are counted beside it. Item two: of those misses that have an answer, the ones whose answer does not say what could not be checked. Each figure is per step and model, split by how the row ended (`answer`, the answers a row gave unasked; `answeringTurn`, the answers to the final-answer request; `all`, the two together), and given three ways: a row does not say when both labelling sessions labelled it `does-not-say` (`bothSayNot`), when either did (`eitherSaysNot`), and by the preregistered phrase rule (`rule`), printed beside the two. A row either session labelled `no-answer` or left `unparsed` is counted beside, as is a rule reading of an empty answer.

| Configuration | Model | How the row ended | Misses at the end | Ended by size or error, beside | Unnoticed, both sessions | Beside | Unnoticed, either session | Beside | Unnoticed, the rule | Beside |
|---|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `answer` | 13 of 230 (0.0565) | 0 | 0 of 13 (0) | 0 | 0 of 13 (0) | 0 | 0 of 13 (0) | 0 |
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 3 of 106 (0.0283) | 0 | 0 of 3 (0) | 0 | 0 of 3 (0) | 0 | 0 of 3 (0) | 0 |
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `all` | 16 of 336 (0.0476) | 0 | 0 of 16 (0) | 0 | 0 of 16 (0) | 0 | 0 of 16 (0) | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `answer` | 14 of 134 (0.1045) | 0 | 0 of 14 (0) | 0 | 0 of 14 (0) | 0 | 1 of 14 (0.0714) | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 10 of 202 (0.0495) | 0 | 0 of 10 (0) | 0 | 0 of 10 (0) | 0 | 0 of 10 (0) | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `all` | 24 of 336 (0.0714) | 0 | 0 of 24 (0) | 0 | 0 of 24 (0) | 0 | 1 of 24 (0.0417) | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `answer` | 5 of 216 (0.0231) | 0 | 0 of 5 (0) | 0 | 0 of 5 (0) | 0 | 0 of 5 (0) | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 2 of 147 (0.0136) | 0 | 0 of 2 (0) | 0 | 0 of 2 (0) | 0 | 0 of 2 (0) | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `all` | 7 of 363 (0.0193) | 0 | 0 of 7 (0) | 0 | 0 of 7 (0) | 0 | 0 of 7 (0) | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `answer` | 6 of 134 (0.0448) | 0 | 0 of 6 (0) | 0 | 0 of 6 (0) | 0 | 0 of 6 (0) | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 4 of 229 (0.0175) | 0 | 0 of 4 (0) | 0 | 0 of 4 (0) | 0 | 0 of 4 (0) | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `all` | 10 of 363 (0.0275) | 0 | 0 of 10 (0) | 0 | 0 of 10 (0) | 0 | 0 of 10 (0) | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `answer` | 8 of 236 (0.0339) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 154 (0) | 0 | — (none apply) | 0 | — (none apply) | 0 | — (none apply) | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `all` | 8 of 390 (0.0205) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `answer` | 7 of 159 (0.044) | 0 | 0 of 7 (0) | 0 | 0 of 7 (0) | 0 | 0 of 7 (0) | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 8 of 231 (0.0346) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `all` | 15 of 390 (0.0385) | 0 | 0 of 15 (0) | 0 | 0 of 15 (0) | 0 | 0 of 15 (0) | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | `answer` | 12 of 242 (0.0496) | 0 | 0 of 12 (0) | 0 | 0 of 12 (0) | 0 | 0 of 12 (0) | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 4 of 94 (0.0426) | 0 | 0 of 4 (0) | 0 | 0 of 4 (0) | 0 | 0 of 4 (0) | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | `all` | 16 of 336 (0.0476) | 0 | 0 of 16 (0) | 0 | 0 of 16 (0) | 0 | 0 of 16 (0) | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | `answer` | 12 of 161 (0.0745) | 0 | 0 of 12 (0) | 0 | 0 of 12 (0) | 0 | 0 of 12 (0) | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 8 of 175 (0.0457) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | `all` | 20 of 336 (0.0595) | 0 | 0 of 20 (0) | 0 | 0 of 20 (0) | 0 | 0 of 20 (0) | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | `answer` | 4 of 238 (0.0168) | 0 | 0 of 4 (0) | 0 | 0 of 4 (0) | 0 | 0 of 4 (0) | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 1 of 125 (0.008) | 0 | 0 of 1 (0) | 0 | 0 of 1 (0) | 0 | 0 of 1 (0) | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | `all` | 5 of 363 (0.0138) | 0 | 0 of 5 (0) | 0 | 0 of 5 (0) | 0 | 0 of 5 (0) | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | `answer` | 12 of 166 (0.0723) | 0 | 0 of 12 (0) | 0 | 0 of 12 (0) | 0 | 0 of 12 (0) | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 2 of 197 (0.0102) | 0 | 0 of 2 (0) | 0 | 0 of 2 (0) | 0 | 0 of 2 (0) | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | `all` | 14 of 363 (0.0386) | 0 | 0 of 14 (0) | 0 | 0 of 14 (0) | 0 | 0 of 14 (0) | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `answer` | 8 of 253 (0.0316) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 1 of 137 (0.0073) | 0 | 0 of 1 (0) | 0 | 0 of 1 (0) | 0 | 0 of 1 (0) | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `all` | 9 of 390 (0.0231) | 0 | 0 of 9 (0) | 0 | 0 of 9 (0) | 0 | 0 of 9 (0) | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | `answer` | 9 of 187 (0.0481) | 0 | 0 of 9 (0) | 0 | 0 of 9 (0) | 0 | 0 of 9 (0) | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 8 of 203 (0.0394) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | `all` | 17 of 390 (0.0436) | 0 | 0 of 17 (0) | 0 | 0 of 17 (0) | 0 | 0 of 17 (0) | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `answer` | 36 of 229 (0.1572) | 0 | 1 of 35 (0.0286) | 1 | 1 of 35 (0.0286) | 1 | 2 of 36 (0.0556) | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 8 of 110 (0.0727) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 | 0 of 8 (0) | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `all` | 44 of 339 (0.1298) | 0 | 1 of 43 (0.0233) | 1 | 1 of 43 (0.0233) | 1 | 2 of 44 (0.0455) | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `answer` | 25 of 129 (0.1938) | 0 | 0 of 24 (0) | 1 | 1 of 24 (0.0417) | 1 | 1 of 25 (0.04) | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 31 of 210 (0.1476) | 0 | 0 of 31 (0) | 0 | 0 of 31 (0) | 0 | 0 of 31 (0) | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `all` | 56 of 339 (0.1652) | 0 | 0 of 55 (0) | 1 | 1 of 55 (0.0182) | 1 | 1 of 56 (0.0179) | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `answer` | 28 of 243 (0.1152) | 0 | 2 of 28 (0.0714) | 0 | 2 of 28 (0.0714) | 0 | 2 of 28 (0.0714) | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 11 of 120 (0.0917) | 0 | 0 of 11 (0) | 0 | 0 of 11 (0) | 0 | 0 of 11 (0) | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `all` | 39 of 363 (0.1074) | 0 | 2 of 39 (0.0513) | 0 | 2 of 39 (0.0513) | 0 | 2 of 39 (0.0513) | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `answer` | 11 of 136 (0.0809) | 0 | 0 of 11 (0) | 0 | 0 of 11 (0) | 0 | 0 of 11 (0) | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 22 of 227 (0.0969) | 0 | 0 of 22 (0) | 0 | 0 of 22 (0) | 0 | 0 of 22 (0) | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `all` | 33 of 363 (0.0909) | 0 | 0 of 33 (0) | 0 | 0 of 33 (0) | 0 | 0 of 33 (0) | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `answer` | 43 of 275 (0.1564) | 0 | 3 of 42 (0.0714) | 1 | 6 of 42 (0.1429) | 1 | 3 of 43 (0.0698) | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 14 of 118 (0.1186) | 0 | 0 of 14 (0) | 0 | 0 of 14 (0) | 0 | 0 of 14 (0) | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `all` | 57 of 393 (0.145) | 0 | 3 of 56 (0.0536) | 1 | 6 of 56 (0.1071) | 1 | 3 of 57 (0.0526) | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `answer` | 30 of 144 (0.2083) | 0 | 6 of 30 (0.2) | 0 | 6 of 30 (0.2) | 0 | 4 of 30 (0.1333) | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 37 of 249 (0.1486) | 0 | 0 of 37 (0) | 0 | 0 of 37 (0) | 0 | 0 of 37 (0) | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `all` | 67 of 393 (0.1705) | 0 | 6 of 67 (0.0896) | 0 | 6 of 67 (0.0896) | 0 | 4 of 67 (0.0597) | 0 |

**The unnoticed miss: by the row's directory at its end** (`2026-11-05-run-130812/summary.json` → `round.groups[].unnoticedMiss` → `byDirectory`: `modelMiss`, `directoryMiss`). Item three: the unnoticed-miss rate over the misses whose directory at the end (the first request's directory and every hit of every search in the row) held a whole acceptable set, the model's miss, and over those whose directory never did, the directory's miss. Each figure is per step and model, split by how the row ended (`answer`, the answers a row gave unasked; `answeringTurn`, the answers to the final-answer request; `all`, the two together), and given three ways: a row does not say when both labelling sessions labelled it `does-not-say` (`bothSayNot`), when either did (`eitherSaysNot`), and by the preregistered phrase rule (`rule`), printed beside the two. A row either session labelled `no-answer` or left `unparsed` is counted beside, as is a rule reading of an empty answer.

| Configuration | Model | How the row ended | The model's miss, both sessions | Either session | The rule | The directory's miss, both sessions | Either session | The rule |
|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 9 (0) | 0 of 9 (0) | 0 of 9 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) |
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 1 (0) | 0 of 1 (0) | 0 of 1 (0) |
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `all` | 0 of 11 (0) | 0 of 11 (0) | 0 of 11 (0) | 0 of 5 (0) | 0 of 5 (0) | 0 of 5 (0) |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `answer` | 0 of 12 (0) | 0 of 12 (0) | 1 of 12 (0.0833) | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `all` | 0 of 18 (0) | 0 of 18 (0) | 1 of 18 (0.0556) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `all` | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `answer` | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `all` | 0 of 7 (0) | 0 of 7 (0) | 0 of 7 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | — (none apply) | — (none apply) | — (none apply) | — (none apply) | — (none apply) | — (none apply) |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `all` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `answer` | 0 of 1 (0) | 0 of 1 (0) | 0 of 1 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 8 (0) | 0 of 8 (0) | 0 of 8 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `all` | 0 of 9 (0) | 0 of 9 (0) | 0 of 9 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder-50` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 8 (0) | 0 of 8 (0) | 0 of 8 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) |
| `builder-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) |
| `builder-50` | `anthropic/claude-haiku-5.5` | `all` | 0 of 10 (0) | 0 of 10 (0) | 0 of 10 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder-50` | `z-ai/glm-5.3-flash` | `answer` | 0 of 9 (0) | 0 of 9 (0) | 0 of 9 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 5 (0) | 0 of 5 (0) | 0 of 5 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder-50` | `z-ai/glm-5.3-flash` | `all` | 0 of 14 (0) | 0 of 14 (0) | 0 of 14 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder-200` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 1 (0) | 0 of 1 (0) | 0 of 1 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 1 (0) | 0 of 1 (0) | 0 of 1 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder-200` | `anthropic/claude-haiku-5.5` | `all` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder-200` | `z-ai/glm-5.3-flash` | `answer` | 0 of 9 (0) | 0 of 9 (0) | 0 of 9 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder-200` | `z-ai/glm-5.3-flash` | `all` | 0 of 11 (0) | 0 of 11 (0) | 0 of 11 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 2 (0) | 0 of 2 (0) | 0 of 2 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 1 (0) | 0 of 1 (0) | 0 of 1 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `all` | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder-1000` | `z-ai/glm-5.3-flash` | `answer` | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `builder-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 8 (0) | 0 of 8 (0) | 0 of 8 (0) | — (none apply) | — (none apply) | — (none apply) |
| `builder-1000` | `z-ai/glm-5.3-flash` | `all` | 0 of 11 (0) | 0 of 11 (0) | 0 of 11 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 12 (0) | 0 of 12 (0) | 0 of 12 (0) | 1 of 23 (0.0435) | 1 of 23 (0.0435) | 2 of 24 (0.0833) |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `all` | 0 of 16 (0) | 0 of 16 (0) | 0 of 16 (0) | 1 of 27 (0.037) | 1 of 27 (0.037) | 2 of 28 (0.0714) |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `answer` | 0 of 20 (0) | 1 of 20 (0.05) | 1 of 20 (0.05) | 0 of 4 (0) | 0 of 4 (0) | 0 of 5 (0) |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 9 (0) | 0 of 9 (0) | 0 of 9 (0) | 0 of 22 (0) | 0 of 22 (0) | 0 of 22 (0) |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `all` | 0 of 29 (0) | 1 of 29 (0.0345) | 1 of 29 (0.0345) | 0 of 26 (0) | 0 of 26 (0) | 0 of 27 (0) |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `answer` | 2 of 4 (0.5) | 2 of 4 (0.5) | 2 of 4 (0.5) | 0 of 24 (0) | 0 of 24 (0) | 0 of 24 (0) |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 7 (0) | 0 of 7 (0) | 0 of 7 (0) |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `all` | 2 of 8 (0.25) | 2 of 8 (0.25) | 2 of 8 (0.25) | 0 of 31 (0) | 0 of 31 (0) | 0 of 31 (0) |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `answer` | 0 of 8 (0) | 0 of 8 (0) | 0 of 8 (0) | 0 of 3 (0) | 0 of 3 (0) | 0 of 3 (0) |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 4 (0) | 0 of 4 (0) | 0 of 4 (0) | 0 of 18 (0) | 0 of 18 (0) | 0 of 18 (0) |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `all` | 0 of 12 (0) | 0 of 12 (0) | 0 of 12 (0) | 0 of 21 (0) | 0 of 21 (0) | 0 of 21 (0) |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) | 3 of 36 (0.0833) | 6 of 36 (0.1667) | 3 of 37 (0.0811) |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 8 (0) | 0 of 8 (0) | 0 of 8 (0) | 0 of 6 (0) | 0 of 6 (0) | 0 of 6 (0) |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `all` | 0 of 14 (0) | 0 of 14 (0) | 0 of 14 (0) | 3 of 42 (0.0714) | 6 of 42 (0.1429) | 3 of 43 (0.0698) |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `answer` | 1 of 12 (0.0833) | 1 of 12 (0.0833) | 1 of 12 (0.0833) | 5 of 18 (0.2778) | 5 of 18 (0.2778) | 3 of 18 (0.1667) |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 14 (0) | 0 of 14 (0) | 0 of 14 (0) | 0 of 23 (0) | 0 of 23 (0) | 0 of 23 (0) |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `all` | 1 of 26 (0.0385) | 1 of 26 (0.0385) | 1 of 26 (0.0385) | 5 of 41 (0.122) | 5 of 41 (0.122) | 3 of 41 (0.0732) |

**The unnoticed miss: as a share of the rows, and the base rate** (`2026-11-05-run-130812/summary.json` → `round.groups[].unnoticedMiss` → `unnoticedOfDenominator`, `baseRate`, `baseCountedBeside`). Item four: the unnoticed misses as a share of item one's rows. Item five, the base rate: of item one's rows that are not misses and have an answer, those whose answer says. Under the labels it is read on the sheet's rows that are not misses only; a row that is not on the sheet is counted beside. Each figure is per step and model, split by how the row ended (`answer`, the answers a row gave unasked; `answeringTurn`, the answers to the final-answer request; `all`, the two together), and given three ways: a row does not say when both labelling sessions labelled it `does-not-say` (`bothSayNot`), when either did (`eitherSaysNot`), and by the preregistered phrase rule (`rule`), printed beside the two. A row either session labelled `no-answer` or left `unparsed` is counted beside, as is a rule reading of an empty answer.

| Configuration | Model | How the row ended | Unnoticed of the rows, both sessions | Either session | The rule | Base rate, both sessions | Beside | Base rate, either session | Beside | Base rate, the rule | Beside |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 230 (0) | 0 of 230 (0) | 0 of 230 (0) | 11 of 11 (1) | 206 | 11 of 11 (1) | 206 | 209 of 217 (0.9631) | 0 |
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 106 (0) | 0 of 106 (0) | 0 of 106 (0) | 5 of 5 (1) | 98 | 5 of 5 (1) | 98 | 103 of 103 (1) | 0 |
| `builder+search-50` | `anthropic/claude-haiku-5.5` | `all` | 0 of 336 (0) | 0 of 336 (0) | 0 of 336 (0) | 16 of 16 (1) | 304 | 16 of 16 (1) | 304 | 312 of 320 (0.975) | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `answer` | 0 of 134 (0) | 0 of 134 (0) | 1 of 134 (0.0075) | 5 of 10 (0.5) | 110 | 5 of 10 (0.5) | 110 | 92 of 120 (0.7667) | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 202 (0) | 0 of 202 (0) | 0 of 202 (0) | 14 of 14 (1) | 178 | 14 of 14 (1) | 178 | 192 of 192 (1) | 0 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | `all` | 0 of 336 (0) | 0 of 336 (0) | 1 of 336 (0.003) | 19 of 24 (0.7917) | 288 | 19 of 24 (0.7917) | 288 | 284 of 312 (0.9103) | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 216 (0) | 0 of 216 (0) | 0 of 216 (0) | 4 of 4 (1) | 207 | 4 of 4 (1) | 207 | 201 of 211 (0.9526) | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 147 (0) | 0 of 147 (0) | 0 of 147 (0) | 3 of 3 (1) | 142 | 3 of 3 (1) | 142 | 145 of 145 (1) | 0 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | `all` | 0 of 363 (0) | 0 of 363 (0) | 0 of 363 (0) | 7 of 7 (1) | 349 | 7 of 7 (1) | 349 | 346 of 356 (0.9719) | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `answer` | 0 of 134 (0) | 0 of 134 (0) | 0 of 134 (0) | 1 of 1 (1) | 127 | 1 of 1 (1) | 127 | 98 of 128 (0.7656) | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 229 (0) | 0 of 229 (0) | 0 of 229 (0) | 9 of 9 (1) | 216 | 9 of 9 (1) | 216 | 223 of 225 (0.9911) | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | `all` | 0 of 363 (0) | 0 of 363 (0) | 0 of 363 (0) | 10 of 10 (1) | 343 | 10 of 10 (1) | 343 | 321 of 353 (0.9093) | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 236 (0) | 0 of 236 (0) | 0 of 236 (0) | 2 of 2 (1) | 226 | 2 of 2 (1) | 226 | 220 of 228 (0.9649) | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 154 (0) | 0 of 154 (0) | 0 of 154 (0) | 6 of 6 (1) | 148 | 6 of 6 (1) | 148 | 153 of 154 (0.9935) | 0 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | `all` | 0 of 390 (0) | 0 of 390 (0) | 0 of 390 (0) | 8 of 8 (1) | 374 | 8 of 8 (1) | 374 | 373 of 382 (0.9764) | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `answer` | 0 of 159 (0) | 0 of 159 (0) | 0 of 159 (0) | 5 of 6 (0.8333) | 146 | 4 of 6 (0.6667) | 146 | 130 of 152 (0.8553) | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 231 (0) | 0 of 231 (0) | 0 of 231 (0) | 9 of 9 (1) | 214 | 9 of 9 (1) | 214 | 223 of 223 (1) | 0 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | `all` | 0 of 390 (0) | 0 of 390 (0) | 0 of 390 (0) | 14 of 15 (0.9333) | 360 | 13 of 15 (0.8667) | 360 | 353 of 375 (0.9413) | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 242 (0) | 0 of 242 (0) | 0 of 242 (0) | 7 of 8 (0.875) | 222 | 7 of 8 (0.875) | 222 | 219 of 230 (0.9522) | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 94 (0) | 0 of 94 (0) | 0 of 94 (0) | 8 of 8 (1) | 82 | 8 of 8 (1) | 82 | 90 of 90 (1) | 0 |
| `builder-50` | `anthropic/claude-haiku-5.5` | `all` | 0 of 336 (0) | 0 of 336 (0) | 0 of 336 (0) | 15 of 16 (0.9375) | 304 | 15 of 16 (0.9375) | 304 | 309 of 320 (0.9656) | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | `answer` | 0 of 161 (0) | 0 of 161 (0) | 0 of 161 (0) | 7 of 10 (0.7) | 139 | 7 of 10 (0.7) | 139 | 121 of 149 (0.8121) | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 175 (0) | 0 of 175 (0) | 0 of 175 (0) | 10 of 10 (1) | 157 | 10 of 10 (1) | 157 | 166 of 167 (0.994) | 0 |
| `builder-50` | `z-ai/glm-5.3-flash` | `all` | 0 of 336 (0) | 0 of 336 (0) | 0 of 336 (0) | 17 of 20 (0.85) | 296 | 17 of 20 (0.85) | 296 | 287 of 316 (0.9082) | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 238 (0) | 0 of 238 (0) | 0 of 238 (0) | 2 of 2 (1) | 232 | 2 of 2 (1) | 232 | 225 of 234 (0.9615) | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 125 (0) | 0 of 125 (0) | 0 of 125 (0) | 3 of 3 (1) | 121 | 3 of 3 (1) | 121 | 124 of 124 (1) | 0 |
| `builder-200` | `anthropic/claude-haiku-5.5` | `all` | 0 of 363 (0) | 0 of 363 (0) | 0 of 363 (0) | 5 of 5 (1) | 353 | 5 of 5 (1) | 353 | 349 of 358 (0.9749) | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | `answer` | 0 of 166 (0) | 0 of 166 (0) | 0 of 166 (0) | 5 of 8 (0.625) | 146 | 5 of 8 (0.625) | 146 | 131 of 154 (0.8506) | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 197 (0) | 0 of 197 (0) | 0 of 197 (0) | 6 of 6 (1) | 189 | 6 of 6 (1) | 189 | 195 of 195 (1) | 0 |
| `builder-200` | `z-ai/glm-5.3-flash` | `all` | 0 of 363 (0) | 0 of 363 (0) | 0 of 363 (0) | 11 of 14 (0.7857) | 335 | 11 of 14 (0.7857) | 335 | 326 of 349 (0.9341) | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `answer` | 0 of 253 (0) | 0 of 253 (0) | 0 of 253 (0) | 4 of 4 (1) | 241 | 4 of 4 (1) | 241 | 235 of 245 (0.9592) | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 137 (0) | 0 of 137 (0) | 0 of 137 (0) | 5 of 5 (1) | 131 | 5 of 5 (1) | 131 | 136 of 136 (1) | 0 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | `all` | 0 of 390 (0) | 0 of 390 (0) | 0 of 390 (0) | 9 of 9 (1) | 372 | 9 of 9 (1) | 372 | 371 of 381 (0.9738) | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | `answer` | 0 of 187 (0) | 0 of 187 (0) | 0 of 187 (0) | 4 of 4 (1) | 174 | 4 of 4 (1) | 174 | 149 of 178 (0.8371) | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 203 (0) | 0 of 203 (0) | 0 of 203 (0) | 13 of 13 (1) | 182 | 13 of 13 (1) | 182 | 195 of 195 (1) | 0 |
| `builder-1000` | `z-ai/glm-5.3-flash` | `all` | 0 of 390 (0) | 0 of 390 (0) | 0 of 390 (0) | 17 of 17 (1) | 356 | 17 of 17 (1) | 356 | 344 of 373 (0.9223) | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `answer` | 1 of 229 (0.0044) | 1 of 229 (0.0044) | 2 of 229 (0.0087) | 25 of 25 (1) | 168 | 24 of 25 (0.96) | 168 | 191 of 193 (0.9896) | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 110 (0) | 0 of 110 (0) | 0 of 110 (0) | 19 of 19 (1) | 83 | 19 of 19 (1) | 83 | 102 of 102 (1) | 0 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | `all` | 1 of 339 (0.0029) | 1 of 339 (0.0029) | 2 of 339 (0.0059) | 44 of 44 (1) | 251 | 43 of 44 (0.9773) | 251 | 293 of 295 (0.9932) | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `answer` | 0 of 129 (0) | 1 of 129 (0.0078) | 1 of 129 (0.0078) | 20 of 24 (0.8333) | 80 | 20 of 24 (0.8333) | 80 | 92 of 104 (0.8846) | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 210 (0) | 0 of 210 (0) | 0 of 210 (0) | 32 of 32 (1) | 147 | 32 of 32 (1) | 147 | 179 of 179 (1) | 0 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | `all` | 0 of 339 (0) | 1 of 339 (0.0029) | 1 of 339 (0.0029) | 52 of 56 (0.9286) | 227 | 52 of 56 (0.9286) | 227 | 271 of 283 (0.9576) | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `answer` | 2 of 243 (0.0082) | 2 of 243 (0.0082) | 2 of 243 (0.0082) | 25 of 25 (1) | 190 | 25 of 25 (1) | 190 | 215 of 215 (1) | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 120 (0) | 0 of 120 (0) | 0 of 120 (0) | 14 of 14 (1) | 95 | 14 of 14 (1) | 95 | 109 of 109 (1) | 0 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | `all` | 2 of 363 (0.0055) | 2 of 363 (0.0055) | 2 of 363 (0.0055) | 39 of 39 (1) | 285 | 39 of 39 (1) | 285 | 324 of 324 (1) | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `answer` | 0 of 136 (0) | 0 of 136 (0) | 0 of 136 (0) | 11 of 12 (0.9167) | 113 | 11 of 12 (0.9167) | 113 | 109 of 125 (0.872) | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 227 (0) | 0 of 227 (0) | 0 of 227 (0) | 21 of 21 (1) | 184 | 21 of 21 (1) | 184 | 205 of 205 (1) | 0 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | `all` | 0 of 363 (0) | 0 of 363 (0) | 0 of 363 (0) | 32 of 33 (0.9697) | 297 | 32 of 33 (0.9697) | 297 | 314 of 330 (0.9515) | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `answer` | 3 of 275 (0.0109) | 6 of 275 (0.0218) | 3 of 275 (0.0109) | 39 of 40 (0.975) | 192 | 39 of 40 (0.975) | 192 | 231 of 232 (0.9957) | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `answeringTurn` | 0 of 118 (0) | 0 of 118 (0) | 0 of 118 (0) | 17 of 17 (1) | 87 | 17 of 17 (1) | 87 | 104 of 104 (1) | 0 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | `all` | 3 of 393 (0.0076) | 6 of 393 (0.0153) | 3 of 393 (0.0076) | 56 of 57 (0.9825) | 279 | 56 of 57 (0.9825) | 279 | 335 of 336 (0.997) | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `answer` | 6 of 144 (0.0417) | 6 of 144 (0.0417) | 4 of 144 (0.0278) | 22 of 25 (0.88) | 89 | 21 of 25 (0.84) | 89 | 99 of 114 (0.8684) | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `answeringTurn` | 0 of 249 (0) | 0 of 249 (0) | 0 of 249 (0) | 41 of 41 (1) | 171 | 41 of 41 (1) | 171 | 212 of 212 (1) | 0 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | `all` | 6 of 393 (0.0153) | 6 of 393 (0.0153) | 4 of 393 (0.0102) | 63 of 66 (0.9545) | 260 | 62 of 66 (0.9394) | 260 | 311 of 326 (0.954) | 0 |

**The labelling: the sheet and the two sessions** (`2026-11-05-run-130812/summary.json` → `round.labels`: `sheetRows`, `misses`, `labels`, `disputed`). The sheet holds every miss at the end that has an answer, of every stub step and model, and as many rows that are not misses; each session read every batch of it once. A row the two label differently is disputed and not settled.

| Session | Sheet rows | Of them misses | says | does-not-say | no-answer | unparsed | Disputed rows |
|---|---|---|---|---|---|---|---|
| `a` | 914 | 457 | 876 | 34 | 2 | 2 | 9 |
| `b` | 914 | 457 | 871 | 41 | 2 | 0 | 9 |

**The labelling: agreement** (`2026-11-05-run-130812/summary.json` → `round.labels.agreement`: `n`, `alike`, `share`, `kappa`, `unparsed`): the share of rows the two sessions label alike, and the kappa statistic over the three labels, over the whole sheet and over its misses. A row either session left unparsed is counted beside.

| Over | Rows both parsed | Labelled alike | Share alike | Kappa | Unparsed, beside |
|---|---|---|---|---|---|
| the sheet | 912 | 905 | 0.9923 | 0.9076 | 2 |
| the misses on it | 456 | 452 | 0.9912 | 0.871 | 1 |

**The labelling records** (`2026-11-05-run-130812/summary.json` → `round.labels.files`): each file under the run directory's `labels/`, by its sha256 as the scorer read it.

| File | sha256 |
|---|---|
| `labels/sheet.jsonl` | `edc62fbc299fa8d4e2bf2ada0afa95904f5e30156f34000aed78088ab5a15706` |
| `labels/salt.sha256` | `5149d6f211ca9f8dc3348a46269266b4c3fa23b2223e6877f8a4fea3a4f3b41a` |
| `labels/batches.json` | `3900dae9e31c5b6f67564882ebd09e490c8e383fe8c257d8d4917e0dc587f11b` |
| `labels/a.jsonl` | `993365d21871cf92426e150845d015782343f5677eca5c61f2b88c4f5452a5bb` |
| `labels/b.jsonl` | `f1fef93f7a1532acf8eb954410a7bde948339a33f9dfbfec4e5283799a718154` |
| `labels/salt.txt` | `9ffc2b77ebfafc715e387bc411fc4bfc475f3a4f42d577564f5391486f741888` |

**The builder's read priced per question** (`2026-11-05-run-130812/summary.json` → `round.builderReadPrice`): S1's measurement, not measured again; the round reused S1's recorded selections (`2026-11-05-run-191511`, `rows.jsonl` `316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c`). The read's cost over the questions, and per question, at list price.

| Inventory size | The reads, all questions | A question |
|---|---|---|
| `50` | $0.1479 | $0.001 |
| `200` | $0.5017 | $0.0034 |
| `1000` | $11.1883 | $0.0751 |

**Tokens and cost per question** (`2026-11-05-run-130812/summary.json` → `round.groups[]`: `tokens`, `costUsd`, `s1CostUsd`, `costPerRowMeanUsd`, `s1CostPerRowMeanUsd`; the requests after S1's last are under "How the stub rows ended"). A row is one question, one repeat and one model. The tokens are the whole row's, every request, medians over the rows that went on; the cost is the whole row's and S1's requests' alone, at list price, the larger of the computed and the reported cost of each request. S1's cost a row is the figure to set against S1's run.

| Configuration | Model | Rows | Prompt tokens a row, median | Completion tokens a row, median | Cost of the rows, whole | Cost of the rows, S1's requests | Cost a row, whole, mean | Cost a row, S1's requests, mean |
|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 447 | 40347 | 1414 | $1.9638 | $0.3542 | $0.0044 | $0.0008 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 447 | 28736 | 721.5 | $1.1386 | $0.2891 | $0.0025 | $0.0006 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 447 | 36062.5 | 1417 | $1.8263 | $0.3125 | $0.0041 | $0.0007 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 447 | 22360 | 694 | $0.9918 | $0.246 | $0.0022 | $0.0006 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 36005 | 1371 | $1.8706 | $0.3125 | $0.0042 | $0.0007 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 447 | 23886 | 675 | $1.0546 | $0.2539 | $0.0024 | $0.0006 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 39343.5 | 1412 | $1.9449 | $0.3463 | $0.0044 | $0.0008 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 23893.5 | 730.5 | $0.9845 | $0.2556 | $0.0022 | $0.0006 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 33242 | 1447 | $1.7568 | $0.3017 | $0.0039 | $0.0007 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 20037.5 | 709 | $0.8806 | $0.2224 | $0.002 | $0.0005 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 35486 | 1403 | $1.8116 | $0.2945 | $0.0041 | $0.0007 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 20609 | 722 | $0.9403 | $0.234 | $0.0021 | $0.0005 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 52358 | 1446 | $2.7096 | $0.5401 | $0.0061 | $0.0012 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 33344 | 729 | $1.3494 | $0.3894 | $0.003 | $0.0009 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 48084 | 1452 | $2.6726 | $0.5315 | $0.006 | $0.0012 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 35092 | 725 | $1.4178 | $0.4186 | $0.0032 | $0.0009 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 50056 | 1411 | $2.7042 | $0.5621 | $0.006 | $0.0013 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 33683 | 720 | $1.4876 | $0.4245 | $0.0033 | $0.0009 |

**S1's metrics: filter recall** (`2026-11-05-run-130812/summary.json` → `groups[].filterRecall`): S1's metrics over S1's requests of every row, unchanged; from here on every table is S1's. The rows whose first request's directory holds a whole acceptable set.

| Configuration | Model | Rows | Directory holds the gold |
|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 447 | 438 of 447 (0.9799) |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 447 | 438 of 447 (0.9799) |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 447 | 444 of 447 (0.9933) |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 447 | 444 of 447 (0.9933) |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 438 of 447 (0.9799) |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 447 | 438 of 447 (0.9799) |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 438 of 447 (0.9799) |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 438 of 447 (0.9799) |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 444 of 447 (0.9933) |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 444 of 447 (0.9933) |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 438 of 447 (0.9799) |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 438 of 447 (0.9799) |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 402 of 447 (0.8993) |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 402 of 447 (0.8993) |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 393 of 447 (0.8792) |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 393 of 447 (0.8792) |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 363 of 447 (0.8121) |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 363 of 447 (0.8121) |

**S1's metrics: directory accuracy** (`2026-11-05-run-130812/summary.json` → `groups[].offered` and `raw`: `n`, `firstRequest`, `afterSecondRequest`, `overLoading`). Correct is `exact` or `acceptable`; over-loaded is the `over` class. "After the second" is S1's request after the loads, not the stub's later requests.

| Configuration | Model | Rows | First request, offered gold | First request, raw gold | After the second, offered gold | After the second, raw gold | Over-loaded, offered gold | Over-loaded, raw gold |
|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 447 | 0.8188 | 0.8121 | 0.8188 | 0.8121 | 0.1454 | 0.132 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 447 | 0.7875 | 0.7808 | 0.7875 | 0.7808 | 0.1342 | 0.1186 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 447 | 0.8591 | 0.8591 | 0.8591 | 0.8591 | 0.1119 | 0.1051 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 447 | 0.8412 | 0.8412 | 0.8434 | 0.8434 | 0.1029 | 0.0962 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 0.8702 | 0.8635 | 0.8166 | 0.8098 | 0.0984 | 0.0716 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 447 | 0.821 | 0.8143 | 0.8009 | 0.7942 | 0.1186 | 0.0962 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 0.8054 | 0.7987 | 0.8054 | 0.7987 | 0.1611 | 0.1477 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 0.7875 | 0.7808 | 0.7875 | 0.7808 | 0.1588 | 0.1432 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 0.8456 | 0.8456 | 0.8456 | 0.8456 | 0.1275 | 0.1208 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 0.8166 | 0.8166 | 0.8166 | 0.8166 | 0.1275 | 0.1208 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 0.8635 | 0.8568 | 0.8121 | 0.8054 | 0.1051 | 0.0783 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 0.8031 | 0.7964 | 0.7919 | 0.7852 | 0.1454 | 0.1186 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 0.7763 | 0.7718 | 0.7763 | 0.7718 | 0.1902 | 0.1186 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 0.7472 | 0.7472 | 0.745 | 0.745 | 0.1767 | 0.1163 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 0.7785 | 0.7785 | 0.7808 | 0.7808 | 0.1834 | 0.0984 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 0.7808 | 0.7808 | 0.7875 | 0.7875 | 0.1521 | 0.1007 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 0.7852 | 0.7539 | 0.7651 | 0.7338 | 0.1723 | 0.0895 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 0.7606 | 0.736 | 0.7472 | 0.7226 | 0.1521 | 0.0783 |

**S1's metrics: search recall and the notice rate** (`2026-11-05-run-130812/summary.json` → `groups[].searchRecall`, `notice`, `searches`): of the rows whose directory missed, those in which the model called `find_source` in S1's requests, and of those, the ones whose first five or ten hits completed an acceptable set. A configuration without search has no search to count.

| Configuration | Model | Directory missed, and the model searched | Recall in the first five hits | Recall in the first ten hits | Rows that searched at all | Search calls |
|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 0 of 9 (0) | — (none apply) | — (none apply) | 4 | 4 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 0 of 9 (0) | — (none apply) | — (none apply) | 64 | 71 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 0 of 3 (0) | — (none apply) | — (none apply) | 0 | 0 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 0 of 3 (0) | — (none apply) | — (none apply) | 53 | 57 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 0 of 9 (0) | — (none apply) | — (none apply) | 7 | 7 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 0 of 9 (0) | — (none apply) | — (none apply) | 47 | 48 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 0 of 9 (0) | — (none apply) | — (none apply) | — | — |
| `builder-50` | `z-ai/glm-5.3-flash` | 0 of 9 (0) | — (none apply) | — (none apply) | — | — |
| `builder-200` | `anthropic/claude-haiku-5.5` | 0 of 3 (0) | — (none apply) | — (none apply) | — | — |
| `builder-200` | `z-ai/glm-5.3-flash` | 0 of 3 (0) | — (none apply) | — (none apply) | — | — |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 0 of 9 (0) | — (none apply) | — (none apply) | — | — |
| `builder-1000` | `z-ai/glm-5.3-flash` | 0 of 9 (0) | — (none apply) | — (none apply) | — | — |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 11 of 45 (0.2444) | 11 of 11 (1) | 11 of 11 (1) | 43 | 51 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 18 of 45 (0.4) | 15 of 18 (0.8333) | 18 of 18 (1) | 100 | 108 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 16 of 54 (0.2963) | 16 of 16 (1) | 16 of 16 (1) | 40 | 44 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 32 of 54 (0.5926) | 31 of 32 (0.9688) | 31 of 32 (0.9688) | 93 | 96 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 37 of 84 (0.4405) | 33 of 37 (0.8919) | 33 of 37 (0.8919) | 51 | 51 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 41 of 84 (0.4881) | 40 of 41 (0.9756) | 40 of 41 (0.9756) | 87 | 89 |

**S1's metrics: tokens per question** (`2026-11-05-run-130812/summary.json` → `groups[].tokens`): S1's requests only; medians over the rows.

| Configuration | Model | Rows | First-request prompt tokens, median | Least | Most | Prompt tokens a row, median | Completion tokens a row, median | Completion tokens a request, median | Directory's share of the first request's characters, median | Reasoning tokens, all rows |
|---|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 447 | 1185.5 | 928 | 3482 | 6730 | 233 | 115 | 0.5083 | 32867 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 447 | 767 | 566 | 2680 | 4262 | 69.5 | 30 | 0.5266 | 12769 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 447 | 1236.5 | 908 | 2528 | 5500 | 215.5 | 107 | 0.5424 | 30119 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 447 | 796 | 552 | 2677 | 3748.5 | 62 | 28 | 0.5379 | 11420 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 1233 | 915 | 3251 | 5543 | 217 | 107 | 0.5353 | 33219 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 447 | 782 | 558 | 2331 | 3679 | 61 | 27 | 0.5288 | 10255 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 999 | 753 | 3307 | 6391 | 236 | 112 | 0.6323 | 32202 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 607.5 | 437 | 2133 | 3998.5 | 65 | 30 | 0.6154 | 12779 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 1061.5 | 733 | 2353 | 5148 | 225.5 | 106 | 0.6659 | 30550 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 644 | 423 | 1517 | 3155.5 | 59 | 28 | 0.6496 | 9503 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 1058 | 740 | 1803 | 5160 | 228 | 105.5 | 0.6562 | 35232 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 642 | 429 | 1138 | 3255 | 68 | 30 | 0.6401 | 10119 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 1687 | 1506 | 5668 | 9012 | 304 | 139 | 0.6479 | 54822 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 1081 | 937 | 3044 | 5706 | 94 | 37 | 0.6681 | 15199 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 2106 | 1767 | 5172 | 9292 | 293 | 133 | 0.7177 | 52236 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 1378 | 1109 | 2981 | 6044 | 87 | 34 | 0.7256 | 14607 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 2680 | 2155 | 4762 | 10303 | 286 | 131 | 0.7725 | 54651 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 1736 | 1364 | 3074 | 6563 | 81 | 32 | 0.7644 | 13692 |

**S1's metrics: latency and cost per question** (`2026-11-05-run-130812/summary.json` → `groups[].latencyMs`, `costUsd`, `costPerRowMean`): milliseconds, S1's requests only. S1's cost fields sum a row's `costUsd`, which over a stub step is the whole row's, so they equal "Tokens and cost per question"'s whole-row cost, not S1's requests' alone.

| Configuration | Model | Rows | First request, median ms | First request, p90 ms | Second request, median ms | Second request, p90 ms | Cost of the rows | Cost a row, mean |
|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 447 | 1596.5 | 2120 | 912 | 1862 | $1.9638 | $0.0044 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 447 | 766.5 | 1952 | 946 | 2174 | $1.1386 | $0.0025 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 447 | 1485 | 1984 | 782 | 1607 | $1.8263 | $0.0041 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 447 | 793 | 2025 | 970.5 | 2600 | $0.9918 | $0.0022 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 1355 | 1719 | 791.5 | 1487 | $1.8706 | $0.0042 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 447 | 747 | 2044 | 978.5 | 3028 | $1.0546 | $0.0024 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 447 | 1407.5 | 1830 | 792.5 | 1701 | $1.9449 | $0.0044 |
| `builder-50` | `z-ai/glm-5.3-flash` | 447 | 737.5 | 1855 | 987.5 | 2492 | $0.9845 | $0.0022 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 447 | 1590 | 2199 | 911 | 1932 | $1.7568 | $0.0039 |
| `builder-200` | `z-ai/glm-5.3-flash` | 447 | 761 | 2224 | 971.5 | 2991 | $0.8806 | $0.002 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 447 | 1460 | 1867 | 790 | 1844 | $1.8116 | $0.0041 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 447 | 735 | 2100 | 1157 | 4303 | $0.9403 | $0.0021 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 447 | 1565 | 2380 | 848.5 | 1789 | $2.7096 | $0.0061 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 447 | 906 | 2835 | 986 | 2379 | $1.3494 | $0.003 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 447 | 1792 | 2654 | 1040.5 | 2047 | $2.6726 | $0.006 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 447 | 866 | 3083 | 1050 | 2540 | $1.4178 | $0.0032 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 447 | 1680 | 2437 | 911 | 1963 | $2.7042 | $0.006 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 447 | 818 | 2255 | 952.5 | 2863 | $1.4876 | $0.0033 |

**S1's metrics: the failure classes** (`2026-11-05-run-130812/summary.json` → `groups[].offered.counts1` and `raw.counts1`): rows by the five classes of the first request (`scoring/score.mjs`).

| Configuration | Model | Exact, offered | Acceptable, offered | Over, offered | Missing, offered | Wrong, offered | Exact, raw | Acceptable, raw | Over, raw | Missing, raw | Wrong, raw |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 235 | 131 | 65 | 0 | 16 | 182 | 181 | 59 | 3 | 22 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 224 | 128 | 60 | 5 | 30 | 173 | 176 | 53 | 8 | 37 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 202 | 182 | 50 | 0 | 13 | 141 | 243 | 47 | 0 | 16 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 207 | 169 | 46 | 1 | 24 | 143 | 233 | 43 | 1 | 27 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 198 | 191 | 44 | 0 | 14 | 117 | 269 | 32 | 3 | 26 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 187 | 180 | 53 | 0 | 27 | 112 | 252 | 43 | 3 | 37 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 232 | 128 | 72 | 0 | 15 | 177 | 180 | 66 | 3 | 21 |
| `builder-50` | `z-ai/glm-5.3-flash` | 230 | 122 | 71 | 0 | 24 | 176 | 173 | 64 | 3 | 31 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 202 | 176 | 57 | 0 | 12 | 141 | 237 | 54 | 0 | 15 |
| `builder-200` | `z-ai/glm-5.3-flash` | 198 | 167 | 57 | 0 | 25 | 136 | 229 | 54 | 0 | 28 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 202 | 184 | 47 | 0 | 14 | 120 | 263 | 35 | 3 | 26 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 190 | 169 | 65 | 0 | 23 | 115 | 241 | 53 | 3 | 35 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 204 | 143 | 85 | 0 | 15 | 160 | 185 | 53 | 2 | 47 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 191 | 143 | 79 | 5 | 29 | 159 | 175 | 52 | 5 | 56 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 115 | 233 | 82 | 3 | 14 | 112 | 236 | 44 | 3 | 52 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 122 | 227 | 68 | 4 | 26 | 119 | 230 | 45 | 4 | 49 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 117 | 234 | 77 | 0 | 19 | 85 | 252 | 40 | 14 | 56 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 117 | 223 | 68 | 3 | 36 | 86 | 243 | 35 | 14 | 69 |

**S1's metrics: the request after a load, the picks and the errors** (`2026-11-05-run-130812/summary.json` → `groups[].secondRequest`, `picks`, `noRequestRows`, `errors`, `consistency`). A pick is a first load; a synthetic copy is a near-duplicate or a wrapper, counted correct wherever its original is.

| Configuration | Model | Second requests | A valid tool call | No tool call | Loaded more only | An invalid tool call | Correct, with a synthetic copy | First pick a registry entry | First pick a CKAN pack | No request (empty selection) | Error rows | Share of questions whose repeats loaded the same set |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `builder+search-50` | `anthropic/claude-haiku-5.5` | 387 | 386 | 0 | 0 | 1 | 9 | 0 | 0 | 51 | 0 | 0.8926 |
| `builder+search-50` | `z-ai/glm-5.3-flash` | 377 | 364 | 1 | 11 | 1 | 6 | 0 | 0 | 51 | 0 | 0.7047 |
| `builder+search-200` | `anthropic/claude-haiku-5.5` | 399 | 389 | 0 | 10 | 0 | 14 | 9 | 15 | 39 | 0 | 0.9262 |
| `builder+search-200` | `z-ai/glm-5.3-flash` | 392 | 374 | 8 | 10 | 0 | 12 | 8 | 15 | 39 | 0 | 0.7315 |
| `builder+search-1000` | `anthropic/claude-haiku-5.5` | 420 | 357 | 4 | 52 | 7 | 4 | 57 | 15 | 24 | 0 | 0.9195 |
| `builder+search-1000` | `z-ai/glm-5.3-flash` | 416 | 351 | 19 | 44 | 2 | 6 | 51 | 15 | 24 | 0 | 0.7383 |
| `builder-50` | `anthropic/claude-haiku-5.5` | 390 | 387 | 1 | 1 | 1 | 10 | 0 | 0 | 51 | 0 | 0.8658 |
| `builder-50` | `z-ai/glm-5.3-flash` | 384 | 375 | 1 | 6 | 2 | 7 | 0 | 0 | 51 | 0 | 0.7651 |
| `builder-200` | `anthropic/claude-haiku-5.5` | 399 | 390 | 7 | 2 | 0 | 21 | 9 | 15 | 39 | 0 | 0.8792 |
| `builder-200` | `z-ai/glm-5.3-flash` | 400 | 378 | 14 | 7 | 1 | 20 | 9 | 15 | 39 | 0 | 0.7651 |
| `builder-1000` | `anthropic/claude-haiku-5.5` | 417 | 362 | 18 | 32 | 5 | 11 | 51 | 15 | 24 | 0 | 0.8591 |
| `builder-1000` | `z-ai/glm-5.3-flash` | 416 | 353 | 48 | 15 | 0 | 6 | 51 | 16 | 24 | 0 | 0.7315 |
| `shortlist+search-50` | `anthropic/claude-haiku-5.5` | 390 | 387 | 3 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0.8792 |
| `shortlist+search-50` | `z-ai/glm-5.3-flash` | 378 | 371 | 2 | 3 | 2 | 2 | 0 | 0 | 0 | 0 | 0.7047 |
| `shortlist+search-200` | `anthropic/claude-haiku-5.5` | 398 | 389 | 9 | 0 | 0 | 23 | 7 | 15 | 0 | 0 | 0.8054 |
| `shortlist+search-200` | `z-ai/glm-5.3-flash` | 394 | 370 | 9 | 10 | 5 | 11 | 8 | 15 | 0 | 0 | 0.7383 |
| `shortlist+search-1000` | `anthropic/claude-haiku-5.5` | 406 | 380 | 16 | 10 | 0 | 19 | 22 | 15 | 0 | 0 | 0.7919 |
| `shortlist+search-1000` | `z-ai/glm-5.3-flash` | 404 | 369 | 18 | 15 | 2 | 13 | 27 | 15 | 0 | 0 | 0.6577 |
