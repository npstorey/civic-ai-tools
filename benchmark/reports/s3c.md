# S3-C: the report

The benchmark round S1 left open (hub #318; S1 is hub #302), read for the round's closing ruling. It measures the
design's E, `builder+search-N`: the builder's recorded selection as the shortlist, the capped directory over it, and
`find_source` behind it, against `builder-N` and `shortlist+search-N`, every row run on to an answer under the stub
transport. **Everything this report concludes is proposed, for the owner's ruling.** The preregistration is
`benchmark/preregistration/s3c.md`; where it is silent, `benchmark/preregistration/s1.md` holds. S1's report
(`benchmark/README.md`, "The report (P4)") is not edited.

## How the figures are made

- **No figure is typed.** Every figure is in the tables below, which `node benchmark/report/round-tables.mjs
  benchmark/runs/2026-11-17` renders from the round's two `summary.json` files and S1's run summary alone into
  `runs/2026-11-17/tables.out.md`. The block between the two markers is that file verbatim, and every number it prints
  is a value of a summary, printed as the summary holds it (the condition S1's tables were held to, hub #302 comment
  6662114479); `test/report-round-tables.test.mjs` checks both, and that every table the preregistration's "The
  metrics" asks for is there with one row per group (`preregistration/s3c.md:271-427`). The prose below names no
  summary figure: where it compares two, it names the table that holds them. The record's items cite their own sources.
- **S1's renderer is not used.** `report/tables.mjs` needs an open-weight probe's summary (`report/tables.mjs:47`), which
  the round did not run, and reads S1's metrics only, not the round's section of the summary. It and S1's
  `tables.out.md` are unchanged; the round's renderer is a sibling, outside the inputs' hash
  (`preregistration/s3c.md:613-615`).
- **A row** is one question, one repeat and one model of one step, so a figure per row is a figure per question. Each
  step asks S1's question set three times of each model (the Rows columns). Every request states S1's date, not the day
  of the run (the run directories' "Date stated"); the run's folder is named for the day it ran.
- **Raw and offered gold, side by side,** as in S1. The paired test is on the raw gold (`preregistration/s3c.md:287-291`).
- **S1's figures for the comparators,** `builder-N` and `shortlist+search-N`, are set beside this run's in the
  first-request table, read from S1's run summary (`runs/2026-11-05/2026-11-05-run-191511/summary.json`) and from
  nothing else of S1's folder, as the preregistration asks (`preregistration/s3c.md:287-288`). The paired test is on
  this run's rows only (`preregistration/s3c.md:288-291`).
- **One report-side measurement,** which the preregistration did not name, explains the sheet's size: see "A
  report-side measurement" under the record's "The sheet". It concludes nothing about the round.
- **The models.** Two ran: Haiku 5.5 (`anthropic/claude-haiku-5.5`, at low) and GLM-5.3-Flash
  (`z-ai/glm-5.3-flash`), as S1 ran them. **Sonnet 5.5 and Opus 5.5 are unmeasured.** The two labelling sessions were
  agent sessions, session a Opus 5.5 and session b Sonnet 5.5, each at high (`preregistration/s3c.md:397-399`); neither
  model is measured by the round.

## The tables

<!-- tables.out.md: begin (benchmark/report/round-tables.mjs; edit nothing between the markers) -->

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

<!-- tables.out.md: end -->

## The record

### The sheet, and why it is smaller than estimated

The sheet holds 914 rows in 10 batches (hub #318 comment 6954995443; "The labelling: the sheet and the two sessions"),
against the preregistration's "about 1,186" (`preregistration/s3c.md:387-388`; the note in comment 6955039454).

**The cause.** The sheet holds every miss at the end that has an answer, and per step and model as many rows that are
not misses (`preregistration/s3c.md:381-386`), so its size follows the count of misses: the sheet table gives its rows
and, of them, the misses, and the two halves are equal. The estimate was made before the run from S1's committed rows:
it counted a miss at S1's last request, the request after the loads, and took `builder+search-N`'s count as
`builder-N`'s. The run counts a miss at the end of each stub row, after its later requests
(`preregistration/s3c.md:311-315`). A row whose later requests load a whole acceptable set is a miss at S1's last
request and not at the end, so the run's misses are fewer, and so is the sheet. The misses at the end, per step and
model, are in "The unnoticed miss: the misses at the end and the unnoticed-miss rate" (the rows `all`). The summary
holds no count of misses at S1's last request; the subsection below measures it.

#### A report-side measurement: the misses at S1's last request

The preregistration did not name this measurement, and it concludes nothing about the round: it explains the sheet's
size against the estimate. `node benchmark/report/sheet-cause.mjs benchmark/runs/2026-11-17` reads the run's
`rows.jsonl` with the scorer's own predicates and writes `runs/2026-11-17/sheet-cause.out.md` (its `--check` holds the
committed file to the rows), per step and model over the rows of item one of the unnoticed miss. Over every stub step
and both models, as that file's last row gives them: 593 misses at S1's last request, 457 misses at the end, 136 of
the first recovered by the later requests, and 0 misses at the end that were not misses at S1's last request. So the
later requests remove misses and add none, and the sheet, which holds the misses at the end, is smaller than an
estimate made from misses at S1's last request. Every number in this subsection is a number of that file
(`test/report-round-tables.test.mjs`).

### The two unparsed rows

Session a left two rows unparsed: `1255a4625140719e`, in batch 4, and `21855521026f9749`, in batch 5 (the batches of
`labels/batches.json`; comment 6968100596). Session b parsed both. Neither was read again
(`preregistration/s3c.md:406-408`). Each is counted beside every figure that reads a row's labels
(`preregistration/s3c.md:412-415`): the "Beside" columns of the unnoticed-miss tables, and the "Unparsed, beside"
column of "The labelling: agreement", which shows that one of the two is a miss and one is not.

### The named deviations

- **Smoke run 3's eight items** (comments 6967363943 and 6967463181), each a named deviation, and each recorded on
  every reading in `labels/batches.json` (`deviationsRuled`):
  - `a: effort: the flag accepted; its effect not recorded` and the same for b: `--effort high` was passed on every
    reading, and the command-line tool's debug log records no effort;
  - `a: hooks not shown`, `a: plugins not shown`, `b: hooks not shown`, `b: plugins not shown`: the readings ran under
    an empty configuration directory, which holds no hooks or plugins;
  - `b: claude-md not shown` and `b: the probe check is not live (the control's reply holds no line of the owner's
    files)`: session b's control reply quoted no line of the owner's instruction files, while session a's control,
    with the same record on the tool's side, quoted some; the evidence for the means is session a's live probe, and
    both models quoted none under the means.
- **D-means** (comment 6966330066): every labelling reading ran with an empty `CLAUDE_CONFIG_DIR`, signed in once,
  added to the means the labelling contract set (`--safe-mode --setting-sources "" --disable-slash-commands`,
  `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`). The reason: in smoke run 1 the tool named
  the user's settings file as often under the means as without them, and the check could not tell a file named from
  a file applied; those settings carry the model and effort settings, and under an empty configuration directory they
  are not read. The command each reading ran is in `labels/batches.json` (`command`).
- **Premise 3 is recorded as not holding in this run** (comment 6967463181, ruling 3). The premise was that the tool
  skips a symbolically linked user instruction file, so that the owner's files would not reach a reading at all.
  Session a's control showed that the owner's files did reach a non-interactive session's context without the means;
  the counts do not say through which file. The means kept them out for both models.
- **R1 and R2** (comment 6936950264). R1: had the run stopped at its cap, the summary and the sheet would still have
  been made from the rows written, and this report would score complete steps only, keeping the labels of a cut step's rows and reporting no figure from them. Its effect in this run: none. Every
  expected row is complete and no stop is recorded ("The run directories"), so no step was cut. R2: the salt was
  checked before the first step, so a conflict over it would have stopped the sitting before any spend.

### The command-line tool's version

The tool moved from 2.1.326 to 2.1.327 between the labelling contract and the readings: it updated itself (comment
6964510213, "The CLI has updated itself"). Every reading of every batch, in both sessions, ran on 2.1.327
(`labels/batches.json`, each reading's `claudeVersion`).

### The sitting's first attempt

The sitting's first attempt stopped at step 1, on the password manager's "not currently signed in". No run directory
was written and nothing was spent (comment 6954995443). The second attempt is the run reported here.

### When the figures became public

The labels' figures (the unnoticed miss by the two sessions, the label counts and the agreement) became public at
tree 3's push to the pull request, at 14:41:07Z on 2026-11-18, as the read-back of that push gives it (comment
6981988077; condition 3 of comment 6968325460). Every other figure of the run's summary was already public before
that: the summary committed with the run in tree 1, pushed at 22:42Z on 2026-11-17 (comment 6964510213), holds the
same values outside the labels' figures. The labels were committed and pushed in tree 2, before tree 3 committed the
salt and the summary that reads them, and no label changed after (`preregistration/s3c.md:416-419`).

### What the round will not conclude

Carried from the preregistration word for word (`preregistration/s3c.md:645-677`); this report concludes none of it.

- **Nothing about Sonnet 5.5, Opus 5.5 or a Google model.** Two models are measured, as in S1.
- **Nothing about a real registry server's or a generic CKAN server's tools:** registry entries load no tools, and the
  CKAN packs carry Boston OpenContext's tools as a stand-in (S1's preregistration).
- **Nothing about the builder's path in the app.** The builder is the benchmark's own request; no app sends it, and
  the round measures no span, no routing choice and no consent step.
- **An unnoticed-miss rate against a stub that never returns rows is not a rate against real tools.** A row that
  loaded the right source also gets no rows, and a model that had found records might answer otherwise. The base
  rate is reported so that this can be read.
- **Nothing about how a model reads a real source's result.** The stub's result is one plain sentence; a real
  source returns JSON, and S1 left that risk unmeasured too.
- **Nothing about what a source would have refused.** The stub answers a call by its name; a real server would
  refuse a malformed one.
- **Nothing that depends on the day.** Every request states 2026-11-05, S1's date, not the day of the run.
- **The notice rate behind the builder is not a rate.** It rests on 3, 1 and 3 questions: 9, 3 and 9
  rows a model.
- **Nothing about search behind an empty selection.** E sends no request there, so on those questions
  E and `builder-N` are equal by construction. That is 17, 13 and 8 questions; two of them need a source, and they
  are 6 of the 21 rows a model on which the builder's selection misses.
- **Nothing about the builder's stability or its price today.** Each question has one read, S1's.
- **Nothing about the shortlist's cap.** The largest recorded selection is 15 entries.
- **Nothing about a longer conversation.** A row's loop sends at most six requests after S1's last; the
  app allows 20 rounds.
- **An answer given to the final-answer request is a prompted answer.** That request asks the model to
  say so when the data is not enough. The unnoticed-miss rate over such answers is the app's behaviour, its prompt
  included; it is not the rate of an answer given unasked. The two are reported apart, and the rows that reach the
  request are not a random part of the rows.
- **Nothing about the place filter as a rule.** S1's G4 overturned it. `shortlist+search-N` is here as a comparator.
  It is also where a directory misses often.
- **No rule is chosen here.** The report proposes the first rule that shortens the list; the owner rules it.
- **The labellers are agent sessions.** Their agreement is reported; no person read the answers.
- **Nothing about the unnoticed miss between the two models.** The labelling sessions are of the same model family
  as Haiku 5.5, one of the two models measured. Within one model, E against `builder-N`, any lean the labellers have
  falls on both sides of the comparison; between Haiku 5.5 and GLM-5.3-Flash it does not.

## The decision table (proposed for the owner's ruling)

The question (hub #318, C5): the first rule that shortens the list, and from what size. S1's ruling is the starting
point (hub #318, the table of what is settled, S1's G4): the place filter is overturned as the shortlist rule, the
capped directory and `find_source` stand, and for 200 to 1,000 entries the builder's selection is the rule, with E
measured first. S1's proposal and its list for S3 are `benchmark/README.md:710-718` and `:722-735`. Each row names the
table that holds its figures. The builder's read is Haiku 5.5's in both models' columns.

| What the proposal rests on | Haiku 5.5 | GLM-5.3-Flash | Sonnet 5.5 | Opus 5.5 | Proposed reading |
|---|---|---|---|---|---|
| E's first request against the place filter with search, `shortlist+search-N` ("E against the comparators, first request"; "E against the comparators, paired on the raw gold") | E above this run's and S1's rows at every size; the two runs of the comparator differ (this run's below S1's at 50, equal at 200, above at 1,000), and E is above both; in this run the discordant pairs lean to E at every size, and the p is smaller at 200 and 1,000 than at 50 | E above this run's and S1's rows at every size; this run's comparator is above S1's at every size, and E is above both; the pairs lean to E at every size, the p largest at 50 and smallest at 1,000 | unmeasured | unmeasured | **confirmed**, against S1's rows as well: over the builder's selection the first request is more accurate than over the place filter's shortlist, at every size measured. S1's figures do not change this reading |
| E's first request against the same selection without search, `builder-N` (the same two tables) | E above this run's and S1's rows at every size; this run's comparator is above S1's at 50, below at 200 and equal at 1,000; in this run the pairs lean to E at every size, and every p is larger than every p against the place filter | against this run's rows equal at 50 and E above at 200 and 1,000; against S1's rows E above at 50 and 200 and **below at 1,000**; this run's comparator is above S1's at 50 and below at 200 and 1,000, so at 1,000 the two runs of `builder-1000` fall on either side of E; the pairs equal at 50 and leaning to E at 200 and 1,000; every p is larger than every p against the place filter | unmeasured | unmeasured | **not separated**, and S1's figures weaken the wording: against this run's rows `find_source` behind the selection does not lower the first request's accuracy, but against S1's rows E is below `builder-1000` on GLM-5.3-Flash. The two runs of one comparator differ by more than E's lead over this run's there, a difference that is the model's or its provider's, not the instrument's (`preregistration/s3c.md:96-99`); so the runs do not settle whether search behind the selection changes the first request, either way |
| The notice rate behind the builder ("The notice rate behind the builder") | in S1's requests, no row whose selection missed called `find_source` at any size; by the end, some did at 50 and 1,000 and none at 200 | none, in S1's requests or by the end, at any size | unmeasured | unmeasured | **not a rate** (`preregistration/s3c.md:658-659`): the selection seldom misses, and a model behind it seldom searches when it does |
| Search recall in E ("Search recall in E") | none apply at any size: no row whose selection missed searched in S1's requests | the same | unmeasured | unmeasured | **unmeasured for E**; S1's recall of the same search over the place filter's misses stands (S1's tables) |
| The unnoticed miss ("The unnoticed miss" tables; "The labelling: agreement") | none of E's misses at the end is unnoticed, under both sessions, under either, at any size; none of `builder-N`'s either; the place filter with search has a few at each size | the same for E and `builder-N`; the place filter with search has a few at 50 under either session and at 1,000 | unmeasured | unmeasured | **qualified**: behind the builder's selection a miss at the end was answered with a statement that the records could not be checked; but most answers that are not misses say so too (the base rate), since under the stub a row that loaded the right source also gets no rows (`preregistration/s3c.md:650-652`), so this is not a rate against real tools |
| How the rows ended ("How the stub rows ended") | more of E's rows ended with an answer given unasked than at the final-answer request, at every size | more ended at the final-answer request, nearly all of them at the bound, at every size | unmeasured | unmeasured | **context**: an answer to the final-answer request is a prompted answer (`preregistration/s3c.md:667-670`); the unnoticed miss is given for each kind apart |
| The builder's read priced per question ("The builder's read priced per question"; "Tokens and cost per question") | a question's read costs less than E's whole row, mean, at 50 and 200, and more at 1,000 | less at 50; more at 200 and 1,000 | unmeasured | unmeasured | **priced, as S1 measured it**: small beside a row at 50; the dearest part of a question at 1,000. Not measured again (`preregistration/s3c.md:663`) |
| E's cost per row against the comparators ("Tokens and cost per question") | E's whole row, mean, at or above `builder-N`'s and below the place filter with search's, at every size | above `builder-N`'s and below the place filter with search's, at every size | unmeasured | unmeasured | **no cost reason against E**, before the builder's read |
| The sizes ("E against the comparators, first request") | measured at 50, 200 and 1,000 | the same | unmeasured | unmeasured | 50 is the smallest size measured: below 50 nothing is measured, and from 50 to 199 the reading rests on the points at 50 and 200 |

**Proposed reading: the first rule that shortens the list is the design's E, from 26 entries,** on Haiku 5.5 and
GLM-5.3-Flash, with Sonnet 5.5 and Opus 5.5 unmeasured. The rule is the builder's selection as the shortlist, the
directory capped at 25 over it, and `find_source` behind it (`preregistration/s3c.md:44`); 26 is the first size the cap
cuts.

- **What it rests on.** Over the builder's selection the first request is more accurate than over the place filter's
  shortlist at every size measured, on both models, against this run's rows and S1's, and its cost per row is lower.
  `find_source` behind the selection is not separated from the selection alone: it does not lower the first request's
  accuracy against this run's rows, E is below S1's `builder-1000` on GLM-5.3-Flash, where the two runs of that
  comparator fall on either side of E, no gain from it is shown, and it is seldom called when the selection misses. It
  is kept because S1's ruling kept it and because the rule switches on the model's search (hub #318, G0-1), not because
  this run measured a gain from it.
- **What S1's figures change.** The wording of the first two rows and of the bullet above; not the proposed rule, its
  size, or any other row.
- **The range from 26 to 199 entries** (hub #318, "Not carded"). From 50 to 199 the proposal rests on the measurements
  at 50 and at 200. **From 26 entries to below 50 it rests on no measurement**: 50 is the smallest size measured, and
  the proposal carries the 50 point down to the cap. An owner who wants every size of the rule measured would rule it
  from 50, and leave a directory of 26 entries or more and fewer than 50 listed whole until it is measured; the
  measurements are the same either way.
- **What it does not rest on.** The builder's path in the app, its span and its price today are unmeasured
  (`preregistration/s3c.md:648-649`, `:663`); so is the cap of 25 itself, which no recorded selection reached (`:664`);
  the unnoticed miss is read against a stub that returns no rows; and everything in "What the round will not conclude"
  above holds.
