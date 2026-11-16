# S3-C preregistration

Sprint S3, leg C: the benchmark round S1 left open (hub #318; S1 is hub #302). This file is merged before any model
call of the round. It fixes the configurations, the models, the builder's reads, the stub transport, the metrics, the
run, the inputs' hash and the tag that keeps S1's run reproducible, and what the round will not conclude. Where it is
silent, S1's preregistration (`benchmark/preregistration/s1.md`) holds. No inventory, question, label, text or tool of
S1 changes.

Line numbers are at hub `1d97e0e64ba3297d2897301c12c2406589225e3e` and, where the website is named, at
`npstorey/civic-ai-tools-website` `1623bf167c00352062832d38b580d01072d5b374`: the commits this file was written
against. "Design" is the sources-at-scale design S1's preregistration cites by section.

## Inputs

S1's, unchanged. The runner checks each inventory against the `canonicalJson` hash recorded beside it
(`benchmark/runner/run.mjs:180-186`). The question files are bound by the inputs' hash; the runner records each one's
file sha256 in `meta.json` (`benchmark/runner/run.mjs:192-199`). The hashes below are the ones S1's preregistration
records.

| Input | `canonicalJson` SHA-256 |
|---|---|
| `benchmark/inventories/50.json` | `d00be22b280931bb23fc9ce8b47a01be52f2da1e63f104ffaae2a2a8b9cc02ee` |
| `benchmark/inventories/200.json` | `ba3eaac6d940d014efab3e5ad5171e878f3ddd5dd5152f3fd1a516ae302c7d02` |
| `benchmark/inventories/1000.json` | `16e7428ac8541d9396546c773e3cae0f8fc364caa0319f2a6089a7d2f75fa62c` |
| `benchmark/questions/50.json` | `2e395899521f64446fe51dd17d480ddcdedb612554c18f5e0c898a30261b0522` |
| `benchmark/questions/200.json` | `91dbf2f4abd51a5925624c170ef3a68873b94d54e4c8db244753386a098db9a2` |
| `benchmark/questions/1000.json` | `34c5aa3140d05bbdea95ae539df335da7b34ad81ce90a793dc37434826422438` |

The 149 questions and their gold are S1's. The 7-entry inventory and its questions are not read.

The round also reads one record of S1's run, by the SHA-256 of the file:
`benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl`, 50,426,681 bytes, sha256
`316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c`. It holds the builder's recorded selections.
The calibration reads the same file.

## The configurations

N is the inventory's size: 50, 200 or 1,000. Every prompt and tool is built through the router over the inventory's
manifest, as S1 built them (`benchmark/runner/session.mjs:93-171`). The code is in `benchmark/runner/`, run by
`benchmark/runner/run.mjs` over the plan `benchmark/runner/plans/s3c.json`.

| Configuration | The first request's directory | Tools on a selection request | S1's requests a row may send |
|---|---|---|---|
| `builder+search-N` (design §1.4's E) | the builder's selection, at most 25, widened by each search | `load_source`, `find_source` | 4: up to three selection requests, then the request after a load |
| `builder-N` | the builder's selection, at most 25 | `load_source` | 2: the selection request, and the request after a load |
| `shortlist+search-N` | the place filter's shortlist, widened by each search | `load_source`, `find_source` | 4 |

"S1's requests" are the requests S1's runner sends for a row of that shape, ending at the request after the loads. A
row under the stub transport sends them unchanged and then goes on (see "The stub transport").

**`requestsPerRow`,** as `meta.json` records it per configuration (`benchmark/runner/run.mjs:350`), is the most
requests a row of the configuration may send under its step's transport. For a step that is not under the stub it
is S1's figure: 4, 2 and 4, in the table's order. For a step under the stub it is, in the table's order,
11, 9 and 11: S1's figure and seven more.

### `builder+search-N` (E)

A row of `shortlist+search-N` as S1 ran it (`benchmark/runner/engine.mjs:288-366`), with one difference: its directory
is the builder's selection for the question, not the place filter's shortlist.

1. **The directory.** The builder's selection for the question (see "The builder's reads"), listed by the router in
   manifest order. The cap of 25 applies to the selection, not to found entries.
2. **The tools.** Every selection request carries `load_source` over the directory's enum and `find_source`, S1's tool
   byte for byte (`benchmark/runner/requests.mjs:14-20`; quoted under "The texts, one place each").
3. **The search.** S1's index, method `bm25` version 1 (`benchmark/runner/search.mjs:53-87`), over every entry of the
   inventory (`benchmark/runner/run.mjs:334`), with the model's query: at most ten hits, best first. The round measures
   the benchmark's copy of the search, not the router's.
4. **The simulation of design §1.5, steps 1 and 2, as S1 ran it.** After a search, the next request's directory text
   and `load_source` enum are rebuilt through the router over the selection and every hit so far, in manifest order
   (`benchmark/runner/engine.mjs:301`, `:329`, `:350`). No app does this for a builder's selection.
5. **The limits.** At most two `find_source` calls a row are run (`benchmark/runner/texts.mjs:30`); every call past
   the second is answered with the limit text. In S1's requests a row sends at most three selection requests: one is
   sent again only after a response that called `find_source` and loaded nothing
   (`benchmark/runner/engine.mjs:300`, `:356-357`). A `find_source` call in the same response as a load is run, and
   its hits join the request after the load (`benchmark/runner/engine.mjs:322-330`, `:350-352`).
6. **An empty selection.**
   The row sends no request, by S1's output rule: it is complete, with no load and no search. S1's search
   row has no such rule (`benchmark/runner/engine.mjs:288-303`); it is new code.
7. **The routing configuration** (the object of `benchmark/runner/session.mjs:196-201`): `builder-N`'s rule and cap
   with `shortlist+search-N`'s search:
   `{ rule: { id: "builder", version: "1" }, cap: "25", search: { method: "bm25", version: "1" }, inventory: { id, version, hash } }`.
   Its kind is `builder+search`. Its rule text is
   `builder selection (Haiku 5.5 at low, once per question), cap 25, find_source (bm25 1)`. Its hashes are under
   "The per-configuration hashes".
8. **The reservation.** S1's four slots, as `benchmark/runner/bounds.mjs:98-116` computes a search row's, with the
   builder's selection as the row's directory; then the stub's slots (see "The run").

### The comparators

`builder-N` (the same directory, no search) and `shortlist+search-N` (the same search, over the place filter's
shortlist) are S1's configurations, unchanged: `benchmark/runner/session.mjs:62-63`. Their first-request accuracy is
compared with E's per model and size.

- Both run under the stub transport, so both run again in the same sitting.

A comparator's rows in this run are compared with its S1 rows too (first-request accuracy, per model and size). Run
again with S1's date (see "The run"), a comparator's S1 requests are S1's bytes: they rebuild byte for byte at
`1d97e0e`, and M1's test holds that at the run's commit (see "The hash and the tag"). So a difference between a
comparator's two runs is the model's or its provider's, not the instrument's.

### Which configurations run on to an answer under the stub

- `builder+search-N`, `builder-N` and `shortlist+search-N`.

### What is not run again

`rule-N`, `flat-N` (the `flat-1000` probe among them), `shortlist-N` and `baseline-7`. S1's rows are their record.

## The models

Haiku 5.5 at low and GLM-5.3-Flash, as S1 ran them (`benchmark/runner/models.mjs:36-43`; S1's `meta.json`, `models`).
Each request is the app's shape: `tool_choice: "auto"`, no temperature, a 4,000-token completion limit.

| Model | Request parameters | Routing |
|---|---|---|
| `anthropic/claude-haiku-5.5` | `{"max_completion_tokens":4000,"reasoning_effort":"low"}` | none: the app's request |
| `z-ai/glm-5.3-flash` | `{"max_tokens":4000,"reasoning_effort":"low","provider":{"max_price":{"prompt":0.15,"completion":0.6},"require_parameters":true}}` | `provider` as shown, as S1 sent it |

- **The open-weight model is fixed:** `z-ai/glm-5.3-flash`, named in the plan, given as `--open-weight` and recorded
  in `meta.json`. No open-weight probe runs.
- **The price source** is read at run time, as S1 read it: OpenRouter's model list and each model's endpoints list,
  live, each recorded with its sha256 (`benchmark/runner/run.mjs:294-314`; `meta.json`: `pricingSource`,
  `modelListSha256`, `endpointSources`, `pricing`). A dry run prices from S1's committed snapshot, unchanged
  (`benchmark/runner/openrouter-models.json`; the list read at 2026-11-03T21:15:29Z, sha256
  `c135d0628bb0923ccb335b2ce50ace95a4d1c23a8e672fcff769c93e33c17f67`).
- **The roster check** and **the reservation price** are S1's (`benchmark/runner/roster.mjs`;
  `benchmark/runner/models.mjs:95-100`).

## The builder's reads

- **S1's recorded selections are reused.** No builder request is sent.
  - **The source** is `benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl`. Each step that reads a selection
    names it in a new plan field, `selectionsFrom` (see "The plan file"). S1's field `selectionFrom`, a string naming
    a reads step of the same run (`benchmark/runner/run.mjs:249`, `:616-617`), keeps its meaning.
  - **The binding.** The runner hashes the file before any request, refuses a file whose sha256 is not the plan's, and
    records the file among `meta.json`'s `inputs` (role `builder selections`, with its path and sha256). For each
    question it takes the row whose `step` is the one named, whose `role` is `builder` and whose `qid` is the
    question's id; that row's `selection` is the directory.
  - **What the file holds,** as read at `1d97e0e`: 149 rows a step, one per question, every one complete; no error
    row.
  - **A question with no complete row** (an error row, or none): its main rows are not started, recorded with the
    reason, as S1 recorded them (`benchmark/runner/run.mjs:629-635`). The file holds no such question.
  - **An empty selection:** 17 questions at 50, 13 at 200 and 8 at 1,000. Two of them need a source: `q127` at 50
    and `q129` at 1,000. What such a row sends is under "`builder+search-N` (E)".
  - **The read's price** is S1's, of 2026-11-05: $0.1479, $0.5017 and $11.1883 over 149 questions, so $0.0010, $0.0034
    and $0.0751 a question at 50, 200 and 1,000. It is reported as S1's measurement, not measured again.
  - **What reuse fixes.** For each question, `builder+search-N`, `builder-N` and S1's own `builder-N` rows read the
    same directory.

The selection is read from a read's response by S1's output rule, quoted under "The texts, one place each".

## The stub transport

Design §2.7: so that a row ends in an answer, every call of a loaded source's tool is answered with one fixed result.
No source is called.

**Which rows.** The rows of the configurations named under "Which configurations run on to an answer under the stub".
A step's `transport` is `stub` in the plan; `meta.json` records it per step and every row carries it.

**A stub row is an S1 row that goes on.** Through S1's last request (the request after the loads; in a row that
loaded nothing, its last selection request) the row is built, answered, scored and recorded as S1's runner does it,
field for field.

- **What is kept.** The tool results S1's runner computed are kept: those of every selection response, the last among
  them. A `find_source` call S1's runner ran in the response to its last selection request is not run again.
- **What the stub answers.** Only the calls S1's runner left unanswered: those of the response to the request after
  the loads, and of every later response.
- **The row's directory** is the first request's directory and every hit of every search run in the row, S1's and
  the stub's, in manifest order.

Then, starting from the response to S1's last request:

1. **The loop.** While the latest response has tool calls and the bound allows another request, each unanswered call
   is answered, in order, by the table below, and the next request is sent.
2. **The next request is the app's.** Its system prompt is the router's prompt over the row's directory and its loaded
   sources (`afterLoads`, `benchmark/runner/session.mjs:146-167`), or the directory's own prompt while nothing is
   loaded. Its tools are `load_source` over the directory's enum, the loaded sources' tools in manifest order, and
   `find_source` in a configuration with search. Its messages are the system prompt, the question, then every earlier
   response and tool result of the row, in order. `tool_choice` is `auto`; the parameters are the model's.
3. **The size limit.** A request after S1's last whose body's JSON is longer than 120,000 characters
   (`STUB_BODY_LIMIT`) is not sent, and the row ends there with no answer. The largest request after a load in S1's
   `builder-N` and `shortlist+search-N` rows was 59,915 characters.

**The bound is the round's own.** A row's loop sends at most six requests after S1's last
(`STUB_MAX_REQUESTS = 6`). The app allows 20 tool-calling rounds a question on its streamed routes
(website `src/lib/openrouter-streaming.ts:141`, passed at `:397`; the loop's test,
`src/lib/model-loop/run-tool-loop.ts:937`) and 10 on its blocking route (`src/lib/model-loop/compare-loop.ts:52`,
`:167`). A stub call returns the same text in every round, so the bound is set by cost: at S1's recorded cost of a
request after the loads, every stub row sending every request it may stays under the cap at this bound, and passes
it at the app's.

**The answering turn,** taken when the app takes it (website `src/lib/model-loop/run-tool-loop.ts:1351-1381`): one
more request, sent when

- the bound is reached and the latest response still has tool calls: each is answered with the app's note for a call
  that was not run; or
- the latest response has no tool call and no text; or
- the latest response has no tool call and announces work it did not do, by the app's test, quoted under "The texts,
  one place each".

The answering request is the row's messages (the last response among them when it has text or tool calls), then a
user message holding the final-answer request. It carries no `tools` and no `tool_choice`. The size limit applies to
it. Whatever it returns ends the row.

**The stub's slots** are the requests a row may send after S1's last:
seven, the six of the loop and the answering request.

**How a call is answered after S1's last request.**

| The call | Its result |
|---|---|
| `load_source` | S1's load step and texts, over the row's directory as it stands (`benchmark/runner/engine.mjs:220-226`): loaded, already loaded, the registry entry's text, or not offered. A fresh load joins the loaded set. |
| `find_source`, in a configuration with search | S1's rule: run while fewer than two searches have run in the row, its hits joining the directory for the next request; S1's found, none and limit texts (`benchmark/runner/engine.mjs:322-334`). |
| a tool the last request offered for a loaded source (`<alias>__<name>`) | the stub's result, whatever the arguments |
| any other name: an unknown name, a tool of a source that is not loaded, `find_source` in a configuration without search | S1's unknown-tool text (`benchmark/runner/app-texts.mjs:31`) |

S1 gave the unknown-tool text on a selection request only (`benchmark/runner/engine.mjs:259`, `:337`). After a load
S1 answered no call: it classed the response's calls and ended the row (`benchmark/runner/engine.mjs:187-216`). The
round extends S1's text to the requests after S1's last because it is the one text S1 has for a call of a tool that
is not offered, and a new text would be one more thing a model reads. Its second sentence ("Load a source with
load_source first.") does not fit a bare upstream name of a loaded tool; the row records that case as S1 classes it
(`nearMiss`). The app answers such a call through its own dispatch (S1's README, `benchmark/README.md:212`).

**The stub's result** is one fixed text, returned as every tool result is, a message
`{ "role": "tool", "tool_call_id": <the call's id>, "content": <the text> }`. The stub matches a call by its name
alone. It reads no argument, opens no socket and calls no `fetch`.

**What ends a row.**

| `stub.endedBy` | When | The row's answer |
|---|---|---|
| `answer` | a response with no tool call, with text, that does not announce work | that response's text |
| `answering-turn` | the answering request returned; `stub.answeringReason` is `bound`, `empty` or `announcement` | its response's text |
| `size` | a request was not sent for its size | none |
| `error` | a request after S1's last failed after its attempts (S1's rule: three for no status, 408, 429 or 5xx; one otherwise) | none |

A row whose S1 requests all returned keeps `status: complete` whatever ends it after, so S1's metrics count it as S1
would. A row that ends with no answer is counted beside the answer's metrics, as "The metrics" says.

**What is recorded per request.** S1's request record
(`benchmark/runner/engine.mjs:144-155`: `kind`, `promptChars`, `latencyMs`, `attempts`, `usage`, `cost`,
`finishReason`, `respondedModel`, the response's text cut at 800 characters, its tool calls), with `kind` `stub`
after S1's last request, and these additions:

- `provider`: the response's `provider` field, on every request of the round, S1's requests among them (S1 recorded
  the responding model only);
- `answered`: per tool call, its name, what answered it (`stub`, `load`, `search`, `limit` or `unknown`) and, for a
  stub call, S1's classing of it (`validName`, `argsParse`, `schemaValid`);
- `definitionHash`: the harness-definition hash of the request's composition, as S1 records it per request.
- The answering request's record has `kind` `answering`, and a call it found pending is
  recorded as answered by `unrun`.

**What is recorded per row,** under `stub`, beside S1's fields: `requests` (the records above), `endedBy`,
`searches` (each search run after S1's last request: query, hits, the request it followed), `directoryEnd` (the
row's directory at its end), `loadedEnd` (every source the row loaded, in S1's requests and after), `answer` (the
answer's text, whole), `costUsd` (the charge of the requests after S1's last) and `s1CostUsd` (the charge of S1's
requests). The row's `costUsd` is the whole row's: the cap's accounting reads it
(`benchmark/runner/run.mjs:549-551`). S1's `searches` holds S1's requests' searches only, so S1's metrics read what
they read in S1.
`stub` also holds `answeringReason`.

**No source and no host but the model API is contacted.** The sprint's criterion says every tool call gets the one
fixed result. This file reads it as every call of a loaded source's tool: `load_source`, `find_source` and a name
that is not offered keep S1's texts, as the table above has it. The test of record drives a `builder+search` row to
an answer under the no-network preload (`benchmark/test/fixtures/no-network.mjs:6-15`), with the model's replies
supplied to the engine as its `fetchImpl` (`benchmark/runner/engine.mjs:67`). It asserts that every call of a loaded
source's tool got the one fixed result, that `load_source`, `find_source` and an unknown name got S1's texts, that
the row ended in an answer, and that the only `fetch` made was the model request: any other `fetch` or socket throws
under the preload. A run records every request's host in its contact ledger, as S1's did.

## The metrics

Computed by `benchmark/scoring/`, per step and model. A run's summary is the scorer's
(`node benchmark/scoring/analyze.mjs <run dir> --out <file>`); it holds no clock and no path.

**S1's metrics, unchanged,** over S1's requests of every row: raw and offered gold, first-request accuracy and the
accuracy after the request that follows the loads, precision, the split by gold, filter recall, search recall at 5
and 10, the notice rate, the error class, the pick counts, tokens, latency and consistency
(`benchmark/scoring/metrics.mjs:51-85`, `benchmark/scoring/s1.mjs:52-142`, `benchmark/scoring/offered.mjs:22-47`).
The scorer over S1's committed run still reproduces S1's `summary.json` byte for byte.

**Cost, over a stub step.** S1's cost fields (`costUsd`, `costPerRowMean`) sum a row's `costUsd`
(`benchmark/scoring/s1.mjs:139-140`), so over a stub step they are the whole row's, while S1's token and latency
fields are S1's requests' only (`benchmark/scoring/s1.mjs:85-86`). The cost of S1's requests alone is summed from
`stub.s1CostUsd` and reported beside, and that is the figure to set against S1's cost per row.

**First-request accuracy, E against the comparators.** Per model and size: `builder+search-N`'s first request beside
`builder-N`'s and `shortlist+search-N`'s, on the raw and the offered gold, this run's rows and S1's. For each pair,
this run's rows are also paired by model, question and repeat number, and the discordant counts are given with an
exact two-sided McNemar test (a binomial test on the discordant pairs) on the raw gold, the test S1's README names
(`benchmark/README.md:650`). No threshold decides anything.

**The notice rate behind the builder.** S1's `noticed` (`benchmark/scoring/metrics.mjs:70-73`) over
`builder+search-N`'s rows: of the rows whose directory (the builder's selection) holds no whole acceptable set, the
share in which the model called `find_source` in S1's requests. It is given twice: over every such row, as S1 counts
them, and over those that sent a request. A second figure, `noticedByEnd`, also counts a search run after S1's last
request.

- The selections miss on 3 questions at 50 (`q90`, `q127`, `q138`), 1 at 200 (`q53`) and 3 at 1,000
  (`q52`, `q53`, `q129`): 9, 3 and 9 rows a model. The figure is reported as counts.
- Of those rows 6, 3 and 6 send a request: `q127` at 50 and `q129` at 1,000 have empty
  selections.

**Search recall at 5 and 10 in E.** S1's `searchRecallAt` (`benchmark/scoring/metrics.mjs:59-66`) over
`builder+search-N`'s rows: of the rows whose directory misses and that searched in S1's requests, the share whose
first 5, and first 10, hits complete an acceptable set.

**The unnoticed miss** (design §2.5: recall at the end below 1, and the answer does not say what could not be
checked).

- **A miss at the end:** a complete row that sent a request, whose raw gold has no empty set, and none of whose
  acceptable sets lies within `stub.loadedEnd`. The raw gold, not the offered gold: a row whose directory never listed
  the source is the miss the metric is for. A question whose gold accepts loading nothing has no miss.
- **The answer:** `stub.answer`. A row that ended with no answer has none.
- **Says:** whether the answer says what could not be checked. How that is decided is below.
- **The rate and its denominator,** per step and model, each as hits of n:
  1. misses at the end, of the complete rows that sent a request, whose raw gold needs a source, and whose stub row
     did not end by `size` or `error`. The rows ended by `size` or `error` are counted beside it;
  2. **the unnoticed-miss rate:** of the misses at the end that have an answer, those whose answer does not say;
  3. the same, split by the row's directory at its end (`stub.directoryEnd`: the first request's directory and every
     hit of every search run in the row): it held a whole acceptable set (the model's miss), or it never did (the
     directory's miss);
  4. the unnoticed misses as a share of the rows in 1's denominator;
  5. the base rate: of the rows in 1's denominator that are not misses and have an answer, those whose answer says.
     Under the stub a row that loaded the right source gets no rows either, and this is how often it says so.
- **The split by how the row ended.** Each figure is given for the answers a row gave
  unasked (`answer`) and for the answers given to the final-answer request (`answering-turn`), and for the two
  together.

**The rule** is computed for every stub row with an answer, whatever the figure of record. The answer is lower-cased,
`’` and `‘` are replaced by `'`, and each run of white space by one space. It **says** when one of these phrases is
then a substring of it, and **does not say** otherwise. An empty answer is `no-answer`.

```text
could not
couldn't
cannot
can not
can't
unable to
not able to
wasn't able to
was not able to
weren't able to
were not able to
not available
isn't available
aren't available
unavailable
no source
no data source
no dataset
no data available
no data is available
not covered
does not cover
doesn't cover
do not cover
don't cover
no access to
do not have access
don't have access
does not have access
doesn't have access
i do not have
i don't have
we do not have
we don't have
not enough
insufficient
not possible to
no way to
```

The rule reads phrases, not meaning. A sentence that a query returned nothing is not on the list: under the stub
nearly every answer can say it, and it does not tell "nothing was found" from "it could not be checked". The rule
was written before any answer of the round exists and was not tuned on S1's responses.

**Two labelling sessions are the figure of record;** the rule's figure is printed beside theirs.

- **The sheet** is a function of the run's files and a salt of 32 random bytes, written as 64 hex characters. It
  holds every miss at the end that has an answer, of every stub step and model; and, per step and model, as many
  rows of the base rate's denominator as that step and model has misses (all of them, when fewer), taken in
  ascending order of a SHA-256 over the salt, a NUL and the row's key. A sheet row holds three fields: `id` (the
  first 16 hex characters of that SHA-256), the question's text and the answer's text. The sheet is in ascending
  order of `id`. It holds no model, step, load, gold or score, and does not tell a miss from a row that is not one.
- **How many rows.** Every miss, and as many rows that are not. By S1's rows that is about
  1,186 sheet rows.
- **The base rate** is read on the sheet's rows that are not misses, not on every such row of the run.
- **Building it.** `node benchmark/scoring/sheet.mjs <run dir> --salt <file> --out <dir>`, in the owner's sitting,
  after the run.
- **The ids.** The salt is drawn in that sitting. Its SHA-256 is written to `labels/salt.sha256` and committed with
  the sheet before any answer is labelled. The salt itself is kept by the owner, out of the repository and out of
  what an agent session can read, until the labels are committed; then it is committed as `labels/salt.txt`, and the
  sheet can be rebuilt from the run's files. A row's key has a known format (`benchmark/runner/run.mjs:553`), so an
  `id` made from a published seed could be traced to its row; one made from the salt cannot.
- **The sessions.** Session a is Opus 5.5 at `high`. Session b is Sonnet 5.5 at `high`. They are agent sessions
  under the owner's plan, not people and not requests through the runner: they spend none of the run's cap. Neither
  model is measured by the round.
- **The batches.** The sheet is cut, in `id` order, into consecutive batches. A batch closes at 100 rows, or at
  200,000 characters of question and answer text, whichever comes first. Both sessions read the same batches.
- **A batch's reading.** Each batch is read by one fresh session, whose prompt is the rubric and the batch and
  nothing else: not the run's rows, the summary, the gold, the other session's labels or the rest of this file. It
  is told to call no tool. A batch whose session called a tool, or was served by a model other than the one named,
  is void: a fresh session reads it again, and the record says so.
- **The reply.** One line per row, `{"id":"<id>","label":"<label>"}`, and nothing else. A row with no line, with more
  than one line, or with a label that is not one of the three is `unparsed` for that session. It is counted beside
  and is not read again.
- **The rubric** is quoted under "The texts, one place each".
- **Agreement:** the share of sheet rows the two label alike, and the kappa statistic (agreement corrected for
  chance) over the three labels; each over the whole sheet and over the misses.
- **A disagreement is not settled.** A row the two label differently is disputed, and every figure of the
  unnoticed miss is given twice: counting a row as not saying when both sessions labelled it `does-not-say`, and
  when either did. A row either session labelled `no-answer`, or left `unparsed`, is counted beside. No third reader
  rules: a settled label would be a third reading presented as agreement.
- **The records,** committed with the run: `labels/sheet.jsonl` and `labels/salt.sha256` before labelling;
  `labels/batches.json` (each batch's first and last `id`, each reading's served model id, and every void reading),
  `labels/a.jsonl` and `labels/b.jsonl` after; then `labels/salt.txt`. The summary names each by its sha256. No
  label changes after a score is seen.

**The builder's read priced per question.** The reads' cost over the 149 questions, per size:
S1's figures, given under "The builder's reads".

**Tokens and cost per question.** For S1's requests, S1's fields. For a stub row, also: the requests sent after S1's
last (median and largest), the prompt and completion tokens of the whole row (medians), and the cost of the whole
row and of S1's requests alone (totals and means per row). A row is one question, one repeat and one model.

## The run

One invocation runs the plan's steps in order into one run directory, every row tagged by its step:

```sh
node benchmark/runner/run.mjs --plan benchmark/runner/plans/s3c.json --open-weight z-ai/glm-5.3-flash \
  --calibration <file> --cap <usd> [--option <letter>]
```

**The date.** Every system prompt states a date (`benchmark/runner/session.mjs:104`, `:134`, `:150`), and the runner
takes the day it runs unless told (`benchmark/runner/run.mjs:140`). The round states S1's, 2026-11-05, in every
request of every configuration: the plan carries it, and the runner refuses another. So the comparators send S1's
bytes, and `builder+search-N`'s requests differ from theirs only in what this file changes. A model is therefore
told a date that is not the day of the run.

**Repeats.** Three, as S1: 149 questions, three repeats, both models, so 447 rows a model and step.

**The cap is $60** (the owner's ruling, hub #318, G0-9). `--cap` holds as in S1: every row reserves its worst case
before its first request, and a row starts only if the spend so far, the reservations in flight and its own fit
under it (`benchmark/runner/engine.mjs:72-80`, `:158-163`). A row is complete, error or not started; never cut by
the cap.

- The probe is given `--cap 5` and the run's cap is $55, `--cap 55`, so the two together stay
  under $60.

**The reservation of a stub row** is S1's slots for S1's requests, unchanged, and one more for each of the stub's
slots. Each of those is reserved at a prompt of 120,000 characters at the model's characters per token, priced as S1
prices a request, with its completion at the full 4,000-token limit. This is a new pattern, and the slot and the
size limit are one rule: the slot holds only because the runner refuses a longer body. S1 bounds a later request by
every earlier response at its full limit with 500 tool results (`benchmark/runner/bounds.mjs:93-94`); carried over
the stub's slots that pattern reserves dollars for one row, where this one reserves cents.

**The run order.**

- `builder+search-50`, `-200`, `-1000`; `builder-50`, `-200`, `-1000`;
  `shortlist+search-50`, `-200`, `-1000`.

**The calibration.**

**A two-question probe under the stub** runs first: both models, one repeat, on `builder+search-50` and
`builder+search-1000`, their steps written in the plan's `probe` section. Its questions are the first of each
question file's `probeIds`:
two, `q11` and `q34`.

- **The probe's rows read their selections as the run's rows do.** At `1d97e0e` a probe builds its steps with no
  selection (`benchmark/runner/run.mjs:237-238`); carrying one is new code.
  Each probe step carries the run step's `selectionsFrom`.
- **Every probe row sends the answering request** once its loop ends, whatever ended it, so
  the request with tool results and no `tools` meets both models before the run. A probe row's answer is its loop's;
  the forced request is recorded under `stub.shapeCheck`.
- **A probe that fails stops the round before the run.** If a probe row is an error row, or is not started, the
  wrapper stops, and the seat brings it to the owner: a fix would be a second move of the inputs' hash, and one is
  ruled.

The calibration step is a new mode of `benchmark/runner/calibration.mjs`, writing schema `civic-calibration/3`.
S1's mode and its file are untouched: at `1d97e0e` the command needs `--open-weight-probe`
(`benchmark/runner/calibration.mjs:184-190`) and reads an open-weight probe's winner and R5's rows (`:146-176`), and
this round runs neither. The new mode differs from S1's rule (`benchmark/preregistration/s1.md:329-332`) in three
stated ways:

- it reads every request of a row that returned usage, the requests under `stub` among them; S1's mode reads S1's
  fields only (`benchmark/runner/calibration.mjs:40-50`, `:82-85`);
- it does not read R5's rows or an open-weight probe's rows;
- the completion allowance is twice the largest billed completion, at most the 4,000-token limit; S1's has no such
  cap (`benchmark/runner/calibration.mjs:162`).

Per model it takes the fewest characters of a request body's JSON per billed prompt token, less 10%, floored to four
places as S1's rule floors it (`benchmark/runner/calibration.mjs:70-71`), and the largest billed completion.
The calibration has two sources, the probe and S1's whole committed run, and takes per model the fewer characters
per token and the larger completion of the two:

```sh
node benchmark/runner/run.mjs --plan benchmark/runner/plans/s3c.json --probe --open-weight z-ai/glm-5.3-flash --cap 5
node benchmark/runner/calibration.mjs --stub-probe <the probe's run dir> --s1-run benchmark/runs/2026-11-05/2026-11-05-run-191511 --out <file>
node benchmark/runner/run.mjs --dry-run --plan benchmark/runner/plans/s3c.json --open-weight z-ai/glm-5.3-flash --calibration <file>
```

`--stub-probe` and `--s1-run` are the flags M1 adds; the first selects the new mode. The file names both sources by
run id and the sha256 of their rows. S1's run gives 2.1693 characters a token over 10,686 requests for Haiku 5.5 and
3.5610 over 10,132 for GLM-5.3-Flash, and largest completions of 2,046 and 4,000 tokens. So the calibration is at
most 1.9523 and 3.2049 characters a token, and both allowances are the limit. S1's fewest figures come from requests
under 5,000 characters, where the tools' fixed overhead dominates; on a request the size of a stub's they overstate
its tokens, which errs toward a larger reservation.

**The calibrated bound** is S1's (`benchmark/runner/run.mjs:445-485`, `benchmark/runner/plan.mjs:73-148`), with two
additions. A row whose directory is a recorded selection is counted over that selection. And each stub row that sends
a request is counted with every one of the stub's slots: each such request carries the row's planned request after a
load, every earlier response at the completion allowance and one stub result per response, with its own completion
at the allowance. The dry run prints the bound for S1's requests and for the stub's, at each of the plan's options,
and `meta.json` records it. The figures are a **[placeholder]** until the dry run prints them.

**The start rule, and the fallback.**

**The cap is the gate.** The run starts under its cap whatever the calibrated bound. The bound is S1's pattern with
every row at its worst; S1's own run spent $34.34 under a bound of $91.37. What holds the spend is the reservation.
The fallback is the run order: a cap stop starts no other row, lets the rows in flight finish, records `stopReason`
and the rows not started, and exits 2 (S1's rule). It loses the order's last steps and is reported as such; the
report scores complete steps only. No second sitting is ruled: the seat brings a lost step to the owner. Two repeats
on every step with three (`--option B`) is in the plan and is taken only by a ruling before the run.

**The dry run's decision line.** At `1d97e0e` the dry run of a plan prints S1's decision against S1's $100
(`benchmark/runner/run.mjs:478-483`). For this round's plan M1 prints, after the bound's lines, one line read from
the plan's `startRule` and `capLimitUsd`, and the wrapper checks it. For S1's plan the dry run prints what it prints
today, byte for byte. This round's line is
`the cap gates: --cap <limit> (the bound is recorded and does not gate)`.

**The sittings.** S1 ran two, with the seat's read of the calibration file and the bound between them.

- The round runs one sitting: the probe, the calibration, the dry run and the run.
  Nothing is decided between the calibration and the run, so no read stands between them. In its place the wrapper
  stops unless every probe row is complete, the calibration file names both models, and the dry run's decision
  line is the one above with the run's cap. The seat reads the wrapper's record of all three before the report is
  written.

**The plan file** is `benchmark/runner/plans/s3c.json`, schema `civic-run-plan/2`. S1's plan and its schema
`civic-run-plan/1` are not edited, and the runner reads both. Its fields:

- `schema`: `"civic-run-plan/2"`. `id`: `"s3c"`.
- `today`: `"2026-11-05"`.
- `models`: `{ "main": "anthropic/claude-haiku-5.5", "builder": "anthropic/claude-haiku-5.5", "openWeight": "z-ai/glm-5.3-flash" }`.
  The runner refuses an `--open-weight` that is not the plan's.
- `capLimitUsd`: `55`.
- `startRule`: `"cap"`.
- `options`: an option's `repeats` replaces the repeats of every step that has three, as S1's option B does
  (`benchmark/runner/run.mjs:247`). They are
  `{ "A": {}, "B": { "repeats": 2 } }`.
- `steps`: one per step of "The run order", in that order. A main step is
  `{ "id": "<name>", "config": "<name>", "inventory": "benchmark/inventories/<N>.json", "questions": "benchmark/questions/<N>.json", "models": ["main", "openWeight"], "repeats": 3 }`,
  where `<name>` is the configuration's name with its size and `<N>` is that size, 50, 200 or 1000, written out. To
  that:
  - a step under the stub adds `"transport": "stub"`. A step with no `transport` field sends S1's requests only;
  - a `builder+search-<N>` or `builder-<N>` step adds
    `"selectionsFrom": { "rows": "benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl", "sha256": "316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c", "step": "builder-<N>-reads" }`.
    The runner refuses a step that has both `selectionsFrom` and `selectionFrom`;
- `probe`:
  `{ "questionIds": { "probeIds": <count> }, "repeats": 1, "models": ["main", "openWeight"], "capUsd": 5, "steps": [<the two steps>] }`.
  The count is the number of probe questions given under "The calibration". The two steps are the run's
  `builder+search-50` and `builder+search-1000` steps as written above, each `id` prefixed `probe-`.

**Spend accounting** is S1's: each request is charged the larger of its cost at the listed price and the cost
OpenRouter reported; a call that returns no usage is charged its worst case
(`benchmark/runner/pricing.mjs:106-112`).

**The wrapper.** The owner runs the round through the sprint's wrapper, written from S1's. It holds to what S1's
held to:

- a detached worktree at the run's commit, then `npm ci`;
- the inputs' hash checked before the first step, after every step and after the last, by
  `benchmark/runner/input-hash.mjs` and by the shell recipe, against the hash this file records for the run's commit;
- the key reaches the runner only through `op run --env-file`, under a cleared environment
  (`env -i PATH HOME MODEL_API_KEY`); the env file holds references only; no value is printed or written;
- it writes only inside the worktree, under the ignored `benchmark/_local/`;
- a check it cannot pass is a stop that names the check; a cap stop is reported after the hash check.

**The records the run writes.**

- Under `benchmark/_local/runs/<run-id>/`: `meta.json` (every input's sha256, the inputs' hash, each configuration's
  hashes, each step's transport, the date stated, the prices as read and when, the request parameters, the
  calibrated bound, the spend, any stop and the rows not started), `rows.jsonl` and `contact-ledger.md`; and the
  wrapper's step outputs.
- The probe's run directory and the calibration file.
- M3 copies the run into `benchmark/runs/<run date>/` byte for byte, with the scorer's summary.
- The files under `labels/` are committed with it, in the order "The metrics" gives.
- `rows.jsonl` is committed whole when it is under 100,000,000 bytes. Above that it is committed as consecutive
  parts of at most 50 MiB, cut at line ends, with a test that their concatenation has the sha256 the summary names.
  By S1's record shape the file is expected to pass S1's 50,426,681 bytes.

## The hash and the tag

**The one move.** The inputs' hash (`node benchmark/runner/input-hash.mjs`: every file under `benchmark/runner/` and
`benchmark/scoring/`, and `benchmark/inventories/*.json` and `benchmark/questions/*.json`) is
`3d4b5271880bc89f0d1f11c6693fa9e56027e6a3f2b71c88a6d83e95d4400e34` over 39 files in S1's `meta.json` and at
`1d97e0e`. It moves once in the round, in the first commit that touches a hashed path, before any run.

| Commit of M1 | What it holds | The inputs' hash |
|---|---|---|
| tree 1 | tests only, under `benchmark/test/`: the stub transport's test, red | `3d4b5271…0e34`, S1's |
| tree 2 | every hashed change at its final bytes: the runner, the scorer, the plan file | `79a30392bdc8169c157f90c7f9b049e8be251affa848d95a48eb2e8ec0b0dcaf` over 44 files |
| tree 3 and later | this file, the rebuild test and its fixture, one bullet in the README's run history | the same as tree 2's |
| the merge commit | | the same as tree 2's |
| the merge commit's first parent | `main` before M1 | `3d4b5271…0e34`: the tagged commit |

The handover records the hash `input-hash.mjs` prints at every commit. The run's commit is the merge commit; its
`meta.json` records the new hash, and the wrapper checks it before and after.

**One move means one.** A code fix after the merge, to the runner or to the scorer, would be a second move and
needs a ruling. So the report's analyses beyond the scorer's summary live under `benchmark/report/`, outside the
hash, as S1's did.

**The tag.** A signed annotated tag, `benchmark/s1-inputs-3d4b5271`, on the first parent of M1's merge commit: the
last commit of `main` whose tree hashes to S1's value. It is set after `input-hash.mjs` prints S1's hash at that
commit and the new hash at the merge. Tree 1 also hashes to S1's value; the tag names `main`'s commit, not tree 1.
S1's run is reproduced from the tag.

**The rebuild finding.** S1's run ran at `933be10` on router 0.6.0; `1d97e0e` carries router 0.11.0, and the router
and `benchmark/inventories/to-manifest.mjs` are outside the hash. The round's G0 record (hub #318) rebuilt, with no
network and S1's date, every repeat-1 main row's first request, every builder read, and the system prompt and tools
after the loads of every row that loaded: 3,997 request bodies and 2,389 after-load states. At both commits each
body's JSON length equals S1's recorded `promptChars`, and none of the 6,386 SHA-256 values differs between the two.
**With S1's date, S1's requests rebuild byte for byte at `1d97e0e`.** With another date none of the 3,997 bodies has
S1's bytes, though each has S1's length. S1's calibrated dry run, run again at `1d97e0e`, prints S1's bounds to the
cent ($91.37 and $69.60).

**The rebuild test.** S1's rows record each body's length, not its bytes. So M1 commits the digests:
`benchmark/test/fixtures/s1-request-digests.json`, the 6,386 SHA-256 values of S1's requests rebuilt at `933be10`
with S1's date, in tree 3, outside the hash. The test rebuilds the same requests at the commit under test and holds
each digest equal to the fixture's, and each first request's length equal to S1's `promptChars`. The
reproducibility of S1's requests then rests on a measurement at the run's commit.

**What still differs.** The harness-definition hashes carry the router component's version
(`benchmark/runner/session.mjs:105`, `:163`, `:202`): the first request's is
`2bd9c6583545b4e1c29f5d35a15b38558e6c77c49e6337098ba1e09bd3087f19` at 0.6.0 and
`c68bd1206de5e5326274192be9c8c157ebd644a7be9120e20710719cb3cdab41` at 0.11.0. They are recorded, not sent. The
routing-configuration hashes carry no version and are S1's.

## What the round will not conclude

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

## The per-configuration hashes

As S1's preregistration gives them: per configuration, the routing configuration as the router's `canonicalJson`, its
SHA-256, and the SHA-256 of the router's `harnessDefinition` of the first request's composition. Every value was
computed at tree 2, and the plan's dry run prints it; each equals the prediction computed at `1d97e0e`. The stub
transport is not part of a routing configuration: `builder-N` and `shortlist+search-N` keep S1's routing-configuration
hashes under it.

| Configuration | Routing configuration (`canonicalJson`) | Its SHA-256 |
|---|---|---|
| `builder+search-50` | `{"cap":"25","inventory":{"hash":"d00be22b280931bb23fc9ce8b47a01be52f2da1e63f104ffaae2a2a8b9cc02ee","id":"civic-50","version":"2026-11-03.1"},"rule":{"id":"builder","version":"1"},"search":{"method":"bm25","version":"1"}}` | `6a469d222be05e6468950fc84e2ab72effad68c5abc83cd64c2c675f5bde92d2` |
| `builder+search-200` | `{"cap":"25","inventory":{"hash":"ba3eaac6d940d014efab3e5ad5171e878f3ddd5dd5152f3fd1a516ae302c7d02","id":"civic-200","version":"2026-11-03.1"},"rule":{"id":"builder","version":"1"},"search":{"method":"bm25","version":"1"}}` | `4507327ecc333598adb93b451d69521e811e1dcc5543693cd5fb69c6b12f3e66` |
| `builder+search-1000` | `{"cap":"25","inventory":{"hash":"16e7428ac8541d9396546c773e3cae0f8fc364caa0319f2a6089a7d2f75fa62c","id":"civic-1000","version":"2026-11-03.1"},"rule":{"id":"builder","version":"1"},"search":{"method":"bm25","version":"1"}}` | `4d551caafdb76dd9f7b598e8b2c3689aef27c582760ec185e7e1c936018caea4` |
| `builder-50` | as S1's preregistration gives it | `f3adb773f1161daea675f9c7a917c03c8ffcf1748f0fc7fd7f7ca9ef1f716233`, S1's |
| `builder-200` | as S1's | `33396b9aefdf0d59aa9e7c729a56c628282acd774a31225be5bad5b68db48d17`, S1's |
| `builder-1000` | as S1's | `9a54a537fd1f1003399935a4b204f8e5ae7a74dcdbfa8b973793113c2ac0af00`, S1's |
| `shortlist+search-50` | as S1's | `ba91fc0817390b35d58172ae139f728e244823ba3cdcccedd1d4db42963fbcbf`, S1's |
| `shortlist+search-200` | as S1's | `84358bba5f0e29e41bbd06f32bd0bcfc92096eda422d9993ba83ddb054d7e0c3`, S1's |
| `shortlist+search-1000` | as S1's | `25434e23206312fd996e78acd8fa5e7710b3e76f3c49858dc87eabfb2fe38469`, S1's |

**The first request's harness definition** is the same in every configuration: on a first request nothing is loaded,
so its composition is the router's component alone,
`{"domain":"civic","sources":[],"components":[{"id":"@typedstandards/civic-typed-router","version":"<the workspace's>"}],"chosenBy":"model"}`.
Its hash at tree 2 (router 0.11.0), as at `1d97e0e` (0.11.0), is
`c68bd1206de5e5326274192be9c8c157ebd644a7be9120e20710719cb3cdab41`. `meta.json` records both hashes per
configuration at the run's start, and each row records the harness-definition hash of each request's composition.

## The texts, one place each

Every text a model reads that the round adds is quoted here word for word, once. A test holds the runner's copy
equal to this file, as S1's does (`benchmark/test/preregistration.test.mjs:105-121`). S1's texts follow, unchanged.

### The round's texts

**The stub's result** (`STUB_RESULT_TEXT`):

> The call ran and returned no rows.

**The app's note for a tool call that was not run** (`UNRUN_TOOL_CALL_NOTE`; copied from website
`src/lib/model-loop/run-tool-loop.ts:457-458`):

> This tool call was not run: the tool-call limit for this query was reached.

**The final-answer request** is the app's (`FINAL_ANSWER_REQUEST`; copied from website
`src/lib/model-loop/run-tool-loop.ts:438-444`):

> This is the final turn: no further tool calls will be made, and what you write now is the published answer. Answer my original question using only the data already collected above. Do not describe a query you plan to run or a step you intend to take next — a statement of intent is not an answer. State the findings themselves, and cite the source of each figure (dataset ID, variable DCID plus source dataset, or resource UUID plus dataset title). If the data collected is not enough to answer, say so plainly and state what it does show.

The app's texts are pinned in `benchmark/runner/app-texts.mjs` with the website's commit and the file's sha256
(`8707781231feb88e662836aade90b5b199372d7c30dab535b7df0bc4fad4169b`), as S1 pinned the load-result texts.

**The rubric** (`UNNOTICED_MISS_RUBRIC`), given to whoever labels the sheet:

```text
You are given a question about public records and the answer an assistant gave. You do not know which assistant it was, what it was shown, or which source was the right one. Give the answer one label.

says: the answer tells the reader that the records the question asks for, or a part of them it names, could not be checked. It counts when the answer says that no source for them was available, listed or found; that a source or a tool could not be used; or that what was retrieved cannot settle the question. A statement that a search or a query returned nothing counts only when the answer treats that as not knowing.

does-not-say: the answer presents a finding with no such statement. That includes a figure, a list or a conclusion; "there were none" drawn from an empty result; an answer from general knowledge; and an answer to a different question.

no-answer: the text is empty, or it only announces a step it does not take.

When an answer gives a finding for one part and says another part could not be checked, label it says.
```
**A labelling session's prompt** is the rubric, a blank line, this line (`LABEL_BATCH_INSTRUCTION`), a blank line,
and the batch's rows, one JSON object a line:

> Label each row below. Reply with one line per row, {"id":"<id>","label":"<label>"}, and nothing else.

### The app's rules, quoted

Not texts a model reads: the app's test for a response that announces work it did not do, which decides whether the
answering turn is taken. Copied from website `src/lib/model-loop/run-tool-loop.ts:394-417`, so that the test of this
file can hold the runner's copy equal to it. A response announces work when its trimmed text is shorter than
`ANNOUNCEMENT_MAX_CHARS` and matches `DATA_STEP_COMMITMENT`.

```text
const ANNOUNCEMENT_MAX_CHARS = 600;
```

```text
/(?:\bi['’]?ll\b|\bi\s+will\b|\bi['’]?m\s+going\s+to\b|\bi\s+am\s+going\s+to\b|\bi\s+need\s+to\b|\bi\s+plan\s+to\b|\bi\s+intend\s+to\b|\bi['’]?m\s+about\s+to\b|\bi\s+am\s+about\s+to\b|\blet\s+me\b(?!\s+know)|\blet['’]?s\b|\bnext,?\s+i\b|\bnow\s+i\b|\bthen\s+i\b)(?:\s+\w+){0,2}\s+(?:quer(?:y|ies|ying)|fetch(?:ing)?|retriev\w*|re-?run(?:ning)?|run(?:ning)?|pull(?:ing)?|request(?:ing)?|check(?:ing)?|search(?:ing)?|count(?:ing)?|calculat\w*|comput\w*|analyz\w*|analys\w*|examin\w*|inspect(?:ing)?|compar\w*|aggregat\w*|cross-?\s?referenc\w*|look(?:ing)?\s+(?:at|up|into))\b/i;
```

### S1's texts, as used

**The search tool** (`FIND_SOURCE_TOOL`), word for word:

```json
{
  "type": "function",
  "function": {
    "name": "find_source",
    "description": "Search every source this assistant can load, including sources the directory does not list, by what they hold and where. Returns up to 10 sources, best match first, and adds them to the directory and to load_source's choices for your next turn. Use it when no source in the directory fits the question.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The records the question needs and the place they are for, in a few words."
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    }
  }
}
```

**What a `find_source` call returns** (`FIND_SOURCE_TEXT`), word for word. A search with hits, shown for two hits and
for one:

> Found 2 sources, best match first: `nyc_charter`, `data_ny_gov`. Each is now listed in the directory in the system prompt, and load_source accepts its alias on your next turn.

> Found 1 source, best match first: `nyc_charter`. Each is now listed in the directory in the system prompt, and load_source accepts its alias on your next turn.

A search with no hit:

> No source matched that search. The directory is unchanged.

A call past the second:

> The search limit for this question is reached: find_source runs at most twice. Load a source from the directory, or answer without one.

**The builder's system prompt** (`BUILDER_SYSTEM`), word for word. It was sent in S1's reads; the round
sends it to no model.

> You choose which sources an assistant will see before it answers a question about public records. The assistant can load only the sources you choose, and it sees at most 25. The user message holds the question, then a line of three dashes, then the directory of every source, written for that assistant (it tells the assistant to load sources; you do not load anything). Call select_sources once with the aliases of the sources that could hold the records the question needs, best first, at most 25. Choose none when the question needs no data source. Do not answer the question.

**The builder's one tool** (`SELECT_SOURCES_TOOL`), word for word, on the same terms:

```json
{
  "type": "function",
  "function": {
    "name": "select_sources",
    "description": "Choose the sources the assistant will see: at most 25 aliases from the directory, best first. An empty list means the question needs no source.",
    "parameters": {
      "type": "object",
      "properties": {
        "aliases": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "maxItems": 25,
          "description": "Aliases exactly as the directory writes them, best first."
        }
      },
      "required": [
        "aliases"
      ],
      "additionalProperties": false
    }
  }
}
```

**The builder's output rule** (`BUILDER_OUTPUT_RULE`), word for word:

> The selection is the `aliases` argument of the response's first `select_sources` call, read in order: an alias of the inventory is kept the first time it appears and ignored after; any value that is not an alias of the inventory is dropped and recorded; the first 25 kept are the selection. A response with no `select_sources` call, or whose arguments do not parse to an object with an `aliases` array, gives an empty selection, recorded as such. A main row whose selection is empty sends no request: nothing is offered, so nothing can be loaded, and the row is complete with no load.

The load-result texts, the registry entry's load text and the unknown-tool text are S1's
(`benchmark/runner/app-texts.mjs:17-31`; S1's preregistration quotes the registry text).

## Notes

- **How the stub row differs from the app.** The app pauses to ask before loading an Ask-first source; the benchmark
  loads every listed source as an On source, as S1 did. The app stops a question at a token total and then asks for
  its answer (website `src/lib/model-loop/run-tool-loop.ts:1283-1287`, `:1351-1352`); the round refuses a request at
  a size, and the row then ends with no answer.
  The app streams its answering turn; the runner does not.
- **S1's tests keep passing, with additions only.** `MODELS`, `OPEN_WEIGHT_ROUTING` and the catalog excerpt are not
  edited, so S1's preregistration test still finds every model's parameters in S1's preregistration
  (`benchmark/test/preregistration.test.mjs:126`). S1's limit of $100 and its decision function are not edited
  (`benchmark/runner/calibration.mjs:121-126`); the round's limit is the plan's `capLimitUsd`. S1's plan, its
  `selectionFrom`, its calibration command and its texts are not edited. The dry run of S1's plan, and the scorer
  over S1's committed run (`benchmark/test/run-2026-11-05.test.mjs`), give the bytes they give today.
- **The README** gains one bullet under its run history naming the hash's move and the tag. S1's text is not
  otherwise edited, including its sentence that names the stub transport as S2's: the work is this round's.

