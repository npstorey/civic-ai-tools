# The routing benchmark

A frozen, re-runnable instrument that compares routing configurations by measurement (Sprint S1, hub #302). The
**benchmark** is the fixed instrument: the inventories, the questions and their gold, the runner and the scorer. An
**evaluation** is one scored run of a configuration against it. Nothing here is an app feature: the runner builds
every prompt and tool through the router package (`@typedstandards/civic-typed-router`, from this workspace), sends
the requests a configuration allows, and stops at the model's tool call. No source is ever called.

P0 moved R5's chooser-spike instrument here and added the 7-entry inventory; P1 added the 50-, 200- and 1,000-entry
inventories and the preregistration's inputs (`preregistration/s1.md`); P2 added the question set and its gold, the
second labelling, and the scorer's three routing metrics. P3-build added every configuration S1 preregisters, the
per-row spend reservation, the two probes, the inputs' and the configurations' hashes, and the rest of the
preregistration. The owner ran the evaluations at G3; P4 committed the run and wrote the report (below).

## Layout

| Path | What it is |
|---|---|
| `inventories/` | `schema.json` (the design's §3.2 format), `build.mjs` (deterministic; `--check` rebuilds byte for byte), `rules.mjs` (the rules every entry is derived by), `to-manifest.mjs` (inventory entries to the router's manifest entries), `guidance.mjs` (the guidance a composition reads, offline), `load-text.mjs` (the fixed text a registry entry's load returns), `extract.mjs` (re-extracts two sources from the owner's local inputs), `sources.mjs`; `7.json`, `50.json`, `200.json` and `1000.json`, each with its `.sha256` |
| `inventories/sources/` | the committed sources, each read through its sha256: the website's two portal directories, the registry entries used, R5's four servers, the registry fetch's script and log (its README) |
| `runner/` | `run.mjs` (the command) and its modules: `session.mjs` (each configuration, through the router), `shortlist.mjs` (the place filter), `search.mjs` (BM25), `texts.mjs` (the benchmark's own tools and texts), `models.mjs` (the models and their request parameters), `engine.mjs` (the rows and the cap), `bounds.mjs` (each row's worst case), `plan.mjs` (a dry run's bounds), `calibration.mjs` (the probe's estimate), `input-hash.mjs` (the inputs' hash, A3.1), `openrouter.mjs` (reads OpenRouter's lists); `plans/s1.json` (the preregistered runs); `catalog.mjs` and `app-texts.mjs` (pinned copies of the website's catalog excerpt and load-result text, each with its source commit and sha256); `openrouter-models.json` (the model and endpoints lists a dry run prices from); `writer.mjs` (the digit-run convention); `rewrite-r5.mjs` (made the committed copy of R5's run) |
| `runner/fixtures/` | `r5-questions.json`: R5's 49 questions, a runner fixture, **not gold** (its README) |
| `questions/` | the question set and its gold: `7.json`, `50.json`, `200.json` and `1000.json`, one per inventory, each with its `.sha256`; `README.md` (the labelling rules), `schema.json`, `gold.mjs` (each question and its gold, written once), `build.mjs` (deterministic; `--check` rebuilds byte for byte), `labelling.md` (the second labelling and its resolutions) |
| `scoring/` | `analyze.mjs` (the scorer) and `score.mjs` (the load classes), moved from R5; `metrics.mjs` (filter recall, search recall at k and the notice rate, per row); `offered.mjs` (the offered gold and the split by gold); `s1.mjs` (a run's summary per step and model). Not `analysis/`: the hub ignores any directory of that name |
| `preregistration/` | `s1.md`: the sprint's preregistration; P1 wrote its inputs section, P2 its questions section, P3 the rest |
| `runs/` | `2026-10-11-r5/`: R5's run, rewritten once under the digit-run convention, with the scorer's summary over it (its README); `2026-11-05/`: G3's run as the owner's run wrote it, each run directory with the scorer's summary over it, the wrapper's records, and the report's tables (below) |
| `report/` | `tables.mjs` (renders the report's tables from the summaries alone) and `quotes.mjs` (prints each quote the report makes, cut from a named row); outside the inputs' hash, as they measure nothing |
| `test/` | the benchmark's checks |
| `_local/` | ignored, never committed: the owner's copy of R5's instrument and originals, the registry pages P1 reads, and a run's files (`_local/runs/<run-id>/`), which P4 copied into `runs/2026-11-05/` |

The checks run as one root script, `npm run check:benchmark`, in CI too; AGENTS.md's Commands table lists every gate.

## Running

```sh
# Dry run: every input's sha256, the inputs' hash, the configurations' hashes and every step's estimated cost bounds.
# No key, no network, writes nothing.
node benchmark/runner/run.mjs --dry-run --plan benchmark/runner/plans/s1.json
node benchmark/runner/run.mjs --dry-run --inventory benchmark/inventories/7.json \
  --questions benchmark/questions/7.json --config baseline-7

# At G3, in order, each with --cap and a key (MODEL_API_KEY or OPENROUTER_API_KEY); the sprint's wrapper supplies both (G0-7):
node benchmark/runner/run.mjs --plan benchmark/runner/plans/s1.json --open-weight-probe --cap <usd>
node benchmark/runner/run.mjs --plan benchmark/runner/plans/s1.json --probe --open-weight <slug> --cap <usd>
node benchmark/runner/calibration.mjs --probe <run dir> --open-weight-probe <run dir> --out <file>  # then --dry-run with it: the calibrated bound
node benchmark/runner/run.mjs --plan benchmark/runner/plans/s1.json --open-weight <slug> --calibration <file> --cap <usd>

# The inputs' hash the wrapper checks before and after (A3.1):
node benchmark/runner/input-hash.mjs

# The summary is the scorer's, written where it is told and never over a file:
node benchmark/scoring/analyze.mjs benchmark/_local/runs/<run-id> --out <file>
```

A run writes under `benchmark/_local/runs/<run-id>/` (ignored); P4 copied G3's run into `benchmark/runs/2026-11-05/`.
Before it spends, a run reads OpenRouter's live model list and each model's endpoints list, checks the roster against
them (every slug present, tools supported, every request field listed as supported, the reasoning effort offered, an
endpoint up within the model's routing) and checks the key with one free call. Requests go by Node's `fetch`; no SDK.
A run writes `meta.json` (every input's sha256, the inputs' hash, each configuration's hashes, the prices as read and
when, the request parameters, the spend, any stop and the rows not started), `rows.jsonl` (every row tagged by its
step), `baseline.jsonl` (a single-configuration run's token baselines) and `contact-ledger.md` (every request's host,
path and status, as it is sent; `.md` because the hub ignores `*.log`); a probe adds `calibration.json`.

**The reservation errs high.** Before a row's first request the runner reserves the worst case of every request its
configuration allows (two for a main row, four for a search row, one for a builder row; `runner/bounds.mjs`): each
prompt estimated at 2 characters a token (`--chars-per-token`, until the probe's `--calibration`; R5 used 3, and
Anthropic billed R5's first request at 1.23 times that), the completion at its full limit, at the dearest endpoint the
request may land on, with any request within 25% of a tier's threshold priced at the higher tier (Haiku 5.5 is billed
five times higher above 100,000 prompt tokens). A row the cap cannot hold is not started: the run records the stop and
the rows not started, and exits 2. A row is complete, error or not started, never cut. A call that returns no usage
keeps its worst case as spend.

**The digit-run convention.** No committed file under `benchmark/` holds a run of 13 or more digits outside a full
hex digest: costs are decimal strings of at most eight places, token counts integers, prices decimal strings in
dollars per million tokens, and a long run inside text (a model's output, a copied tool text) is written with every
ninth digit as a JSON `\u` escape, which parses back unchanged (router README, "Re-running the captures").

## The inventory format and its hash

`civic-inventory/1`, the design's §3.2: `{ schema, id, version, entries }`, each entry a server or a pack. Every value
is a string, an array or an object, because the router's `canonicalJson` (the hash D3 names) refuses numbers,
booleans and null. `<n>.json.sha256` is the SHA-256 of the router's `canonicalJson` of the parsed file, not of its
bytes, so it survives a move to a content node.

| Inventory | `canonicalJson` SHA-256 |
|---|---|
| `7.json` (`civic-7`, `2026-11-02.1`) | `1a73fdd7ad383582fcc88051dabea88f25f96cdbe579054e9b2d0cebfb467882` |
| `50.json` (`civic-50`, `2026-11-03.1`) | `d00be22b280931bb23fc9ce8b47a01be52f2da1e63f104ffaae2a2a8b9cc02ee` |
| `200.json` (`civic-200`, `2026-11-03.1`) | `ba3eaac6d940d014efab3e5ad5171e878f3ddd5dd5152f3fd1a516ae302c7d02` |
| `1000.json` (`civic-1000`, `2026-11-03.1`) | `16e7428ac8541d9396546c773e3cae0f8fc364caa0319f2a6089a7d2f75fa62c` |

The four hashes were written here and in the preregistration (`preregistration/s1.md`) before any question existed
(A1.3): P2's questions are written against these files, so no description could be tuned to a question.

The seven are the router's manifest entries: `to-manifest.mjs` hands back the router's own entry for each, after
holding every data field, the tool names and the tools' hash to the router's.

## The questions and their hash

149 questions, R5's 49 as the seed, each labelled against each inventory by the rules in `questions/README.md`
(`questions/labelling.md` records the second labelling and its resolutions). Each `.sha256` is the SHA-256 of the
router's `canonicalJson` of the parsed file, written here after the inventories' hashes (A2.3):

| Questions | Labelled against | `canonicalJson` SHA-256 |
|---|---|---|
| `questions/7.json` | `inventories/7.json` | `62b841a6de2703decb2a16ab619190df4523cb1c114eab2f48af3924a8b61a34` |
| `questions/50.json` | `inventories/50.json` | `2e395899521f64446fe51dd17d480ddcdedb612554c18f5e0c898a30261b0522` |
| `questions/200.json` | `inventories/200.json` | `91dbf2f4abd51a5925624c170ef3a68873b94d54e4c8db244753386a098db9a2` |
| `questions/1000.json` | `inventories/1000.json` | `34c5aa3140d05bbdea95ae539df335da7b34ad81ce90a793dc37434826422438` |

## The inventories at 50, 200 and 1,000

### The composition, stated before the 1,000-entry file is built

Written here, in `inventories/build.mjs` (`COMPOSITION`) and in `preregistration/s1.md`, in a commit before the one
that adds `1000.json` (the seat's ruling 3, hub #302 comment 6604092796); the build that adds the files checks every
count against it. Every Socrata, CKAN and registry selection takes `active` entries only (the seat's ruling, hub #302
comment 6610180295): 363 of the Socrata catalog's 364 rows are active.

| Size | Entries, by source |
|---|---|
| 50 | the 11 real servers (today's seven and R5's four: `nyc_budget`, `nyc_council`, `nyc_311`, `nyc_mta`); the 34 largest active US Socrata domains, as portal packs; 5 distractors (3 near-duplicates, 2 wrapper packs) |
| 200 | the 50; the remaining 45 of the 79 active US Socrata domains with 50 or more datasets; the 70 largest of the other 138 active US Socrata domains; the 20 largest active US CKAN portals, as packs; the first 10 MCP Registry entries in the seed's order; 5 more distractors (3 near-duplicates, 2 wrapper packs). 50 + 45 + 70 + 20 + 10 + 5 = 200 |
| 1,000 | the 200; every remaining active Socrata domain that carries a country (95 in the catalog as copied); the 400 largest active CKAN portals not already in, any country; the next 240 MCP Registry entries in the seed's order; near-duplicates to fill the file |

- **The remainder rule.** The 1,000-entry file's near-duplicates are 1,000 less every other entry:
  1,000 − (200 + 95 + 400 + 240) = **65**. A catalog that moved would move the 95 and so the 65; the build stops if
  the count of remaining active Socrata domains with a country is not the 95 stated.
- **The split at 1,000** between sources (400 CKAN portals, 240 registry entries) is a design choice, not a measured
  share of any real directory.
- **The seed** is `civic-ai-tools S1 P1 inventories, 2026-11-03`. "In the seed's order" ranks by the SHA-256 of the
  seed, a purpose and a key, joined by NUL, ascending: the registry entries (purpose
  `registry`, key the name); the entries a near-duplicate copies (purpose `near-duplicate`, key the alias: the first
  real entry with tools, a server or a portal pack, of its size not yet copied); the servers a wrapper wraps (purpose
  `wrapper`, key the alias); and each file's entry order (purpose `order`, key the alias).
- **"Largest"** is by `dataset_count`, descending, ties broken by the catalog's `id` field ascending (on 7
  Socrata and 50 CKAN rows the `id` is not the host in the row's `url`).

### What each entry is

Every entry is derived by a stated rule (`inventories/rules.mjs`) from a committed source (`inventories/sources/`, its
README), never written by hand. Every value is a string, an array or an object: a count is a decimal string, and
`synthetic` is `"true"`.

| Kind | What it carries | Its tools |
|---|---|---|
| The seven (`server`) | the router's data fields, as P0 wrote them | the router's (`toolsRef.kind: router-manifest`) |
| R5's four (`server`) | R5's directory entry: id, alias, source id, display name, description, freshness, configuration; place and categories curated in `build.mjs`; `provenance.from: hand` | R5's captured tools (`toolsRef.kind: fixture`, `sources/r5-servers.json`), each name back to its upstream name (R5 wrote `<alias>__<name>`; the router's aliased view gives R5's names back) |
| Socrata portal pack (`pack`, base `socrata`) | `filter: { portal }`; the portal-pack description template; place from the catalog row; `catalog` (id, dataset count as a string, owner type, status); `provenance.from: portal-catalog` with the catalog's commit and sha256 | a copy of the Socrata server's three tools; no portal lock, no guidance, no code of the base's |
| CKAN portal pack (`pack`, base `boston-opencontext`) | as a Socrata pack, and `hosting: container`: no instance runs a generic CKAN server, so the pack is listed as a container (G0-5) | a named copy of Boston OpenContext's six `ckan__*` tools from the router's manifest, standing in for a generic CKAN server (`toolsRef.note`) |
| MCP Registry entry (`server`, `tools: not-captured`) | the registry's name (as `id`), title, description and version; `place` and `categories` unstated (the registry states neither); `provenance.from: registry` with the list page and its sha256 | none. A load returns one fixed text, `REGISTRY_LOAD_TEXT` (`inventories/load-text.mjs`), and adds no tools; a registry entry is scored on the first request only |
| Near-duplicate (`pack`, `synthetic: "true"`) | a copy of a real entry with tools: its base, filter, place and tools, its description under the near-duplicate rule, its alias with `_2`; `distractor: { kind, of }` names the original | the original's |
| Wrapper (`pack`, `synthetic: "true"`) | a pack over one of the eleven servers, no argument fixed, the wrapper template; its alias with `_pack` | the server's |

No entry names a publisher it does not have: a pack's `author` is `benchmark/inventories/build.mjs`, and the
catalogs' `owner_name` appears only as the catalog states it.

**The portal-pack template** (`packDescription`), for both catalogs: `<name>. A <catalog type> on <Socrata|CKAN>,
published by <owner_name> (<owner_type>, <country_name>), with <dataset_count> datasets. Tools: <the base's>, with the
portal fixed to <portal>.` A pack's categories are the Socrata server's list (neither catalog has a category field);
its freshness is the Socrata server's, or for a CKAN pack one fixed line.

**The place-name rule** (`placeNames`): neither catalog has a place-name field, so a pack's `place.names` are, in order
and distinct, the owner's name as given; the owner's name without a leading government kind ("City of New York" →
"New York"); and the portal name's lead (its text before the first separator or generic word), without a leading
government kind; a candidate made only of generic words ("Open Data", "City") is dropped. `place.level` is the
catalog's `government_level`; `place.country` its `country`, with a region or "World" written `multiple` and the two
countries written out as their codes (`countryCode`).

**The alias rule** (`aliasFor`): the slug of the entry's key (a portal's `url` without its scheme; a registry
entry's name's last segment less a leading or trailing "mcp" or "server", or its namespace's last label when nothing is
left), lowercased, every run outside `[a-z0-9]` one underscore; a leading `_` before a digit; `_` and six hex
characters of the key's SHA-256 appended when another member of the fixed universe (every catalog row and registry
entry any size could draw, and the eleven servers' aliases) has the same slug; and the same cut when it passes the
smaller of 32 characters and 62 less the entry's longest tool name. So every alias matches the router's
`ALIAS_PATTERN`, holds no `__`, is the same in every size it appears in, and every exposed name `<alias>__<tool>` is at
most 64 characters and never normalized. A distractor's alias is its original's, cut to leave room, with `_2` or
`_pack`.

**The registry rule** (`inventories/extract.mjs`): from the list (every entry the latest version of its name), an entry
is in the pool when its name or description holds "open data" (also "open-data", "open_data", "opendata"),
"government(s)" or "city"/"cities" as a whole word bounded by non-letters, in any case; its status is `active`; and it
lists at least one remote. That gives 638 entries; the inventories use the first 250 in the seed's order.

**The order.** Each of the three larger files lists its entries in the seed's order, so a place in the directory says
nothing of where an entry came from, and the entries two sizes share keep their relative order. `7.json` keeps the
router's order.

**The loader.** `to-manifest.mjs` builds a manifest entry for every kind: the router's own object for the seven; for
every other entry, the tools its `toolsRef` names (checked against their names and hash), no guidance, and
`requirement: required`, since the router's configuration reader knows only the seven's variables and an entry it
cannot configure would never be offered. The benchmark calls no source, so nothing is reached.

## `baseline-7`, and how its second request differs from R5's

`baseline-7` is today's in-loop directory over the seven, configured as production configures them: Boston
OpenContext unconfigured, the other six listed. Its second request is built the way the app builds it today, through
the router's functions (the seat's ruling, hub #302). R5's runner built it differently, so a comparison with R5's
first-request accuracy (0.986–1.0) is a cross-check that carries these differences, not a pass/fail test. Website
paths are at `8559002`; R5's runner is `chooser-spike.mjs` in the owner's copy (`_local/r5/`).

| | R5 | The app today, and this runner |
|---|---|---|
| Second request's system prompt | the first system prompt, unchanged (`chooser-spike.mjs:476-485`; the first prompt is R5's template, `:106`, `:177`) | recomposed over the loaded set: the router's directory, then the composition over the loaded sources (`routing-mode.ts:320-327`; `composeInLoopSystemPrompt`, `socrata-skill.ts:594-614`, which calls the router's `aliasedInLoopSystemPrompt`), placed as the system message (`run-tool-loop.ts:987`); here `session.mjs`, `afterLoads` |
| Where a loaded source's guidance arrives | in the load result's text (`loadResult`, `chooser-spike.mjs:182-187`) | in the system prompt; the load result is `LOAD_RESULT_TEXT.loaded` (`routing-mode.ts:125-126`: "its guidance now appears in the system prompt"), pinned in `runner/app-texts.mjs` |
| The lock section | none | `withLock` wraps every request's prompt (`routing-mode.ts:281`); with no portal lock it returns the prompt unchanged, which is the benchmark's case (no portal, no lock), and the runner calls it the same way |
| The second request's tools | `load_source`, then each loaded source's tools in load order, Socrata, Data Commons and Boston under their bare names (router 0.1.0; `chooser-spike.mjs:478`) | `load_source`, then the loaded sources' tools in manifest order, every name aliased `<alias>__<name>` (`routing-mode.ts:325`) |
| The directory and `load_source` | R5's frozen directory: 11 entries, its own descriptions and paragraph ("its tools and guidance arrive in the result") | the router's `directoryPrompt` and `aliasedLoadSourceTool` over the six configured sources (`socrata-skill.ts:560-563`; `routing-mode.ts:282`, `:289`), the router 0.6.0 descriptions; the enum is those six aliases |
| The date line | R5's template with the run's UTC date (`chooser-spike.mjs:105-106`) | the router's intro with the run's UTC date (`socrata-skill.ts:562`); `--today` fixes it |
| Socrata's guidance | the hosted server's prompt, captured for R5 | the router's pinned capture (`packages/civic-typed-router/src/__fixtures__/socrata-guidance.json`, socrata-mcp-server `3163601`); the app reads the hosted server live |
| A load of an Ask-first source (NYC Checkbook, NYS Open Legislation) | loaded | the app pauses to ask the reader, or declines with no pause (`routing-mode.ts:300-313`); the benchmark loads it as an On source |
| A call of any tool but `load_source` on the first request | `Error: unknown tool …` (`chooser-spike.mjs:446`) | the app's dispatch refuses it; the benchmark keeps R5's text (`app-texts.mjs`) |

## G3's run, committed (`runs/2026-11-05/`)

The owner ran G3 through the sprint's wrapper in two sittings on 2026-11-05, at `933be10011e2383e90181ab923b35e489d4ecc31`
(the wrapper's `RUN_COMMIT`), with the inputs' hash `3d4b5271880bc89f0d1f11c6693fa9e56027e6a3f2b71c88a6d83e95d4400e34`
before step 1, after step 4, before step 5 and after step 5 (G2's amendment, hub #302 comment 6662456277). P4 copied the
run's files out of the run worktree's ignored `benchmark/_local/` byte for byte: no run file is rewritten, and each run
directory keeps its name, which is its `runId`.

| Path | What it is |
|---|---|
| `2026-11-05-ow-probe-181703/` | step 1, the open-weight probe (G0-3b): `meta.json`, `rows.jsonl`, `contact-ledger.md`, and the scorer's `summary.json` |
| `2026-11-05-probe-181956/` | step 2, the two-question probe beside the probe's winner: the same four, and `calibration.json` |
| `2026-11-05-run-191511/` | step 5, the evaluations: `meta.json`, `rows.jsonl`, `contact-ledger.md`, `summary.json` |
| `g3/` | the wrapper's records: `calibration.json` (step 3's file, the calibration step 5 ran under), `sitting-1.json`, `step-3.out` and `step-4.out` (those steps' printed output; step 4's is the calibrated bound) and `step-5.op-not-signed-in.out` (step 5's first start, which stopped before any model call; kept under the seat's ruling, comment 6666737354). Not committed: the wrapper's `npm-ci.out`, and the printed output of steps 1, 2 and 5, which carries the account's balance (the owner's ruling); `test/run-2026-11-05.test.mjs` checks that no committed run file holds that line |
| `tables.out.md` | the report's tables, as `report/tables.mjs` renders them from the three summaries |

**The evaluations' `rows.jsonl` is committed whole** (the seat's O1, comment 6669754364): 50,426,681 bytes, sha256
`316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c`, under Git's 50 MiB warning, with no split and no Git
LFS. `test/run-2026-11-05.test.mjs` holds its byte count and sha256 to the values measured at G3, and checks that this
file restates the sha256. G3 wrote no `baseline.jsonl` (a plan run writes none), so each summary's
`files["baseline.jsonl"]` is the sha256 of the empty text, as the scorer reads an absent file.

**Re-scored with no key** (A3.3): the scorer over each run directory reproduces that directory's `summary.json` byte for
byte, and each summary's `files` are the committed files' sha256 (`test/run-2026-11-05.test.mjs`).

```sh
node benchmark/scoring/analyze.mjs benchmark/runs/2026-11-05/2026-11-05-run-191511 --out <file>  # equals its summary.json
node benchmark/report/tables.mjs benchmark/runs/2026-11-05 --check  # tables.out.md is what the summaries render
node benchmark/report/quotes.mjs  # each quote in the report, with its row key
```

## The report (P4)

The report reads G3's run for G4. **Everything it concludes is proposed, for the owner's ruling at G4**; the owner rules
D1 confirmed, qualified or overturned on the two models measured.

### How the figures are made

- **No figure is typed.** Every figure is in the tables below, which `node benchmark/report/tables.mjs
  benchmark/runs/2026-11-05` renders from the three `summary.json` files alone into `runs/2026-11-05/tables.out.md`.
  The block between the two markers is that file verbatim (A4.1), and every number it prints is a value of a summary,
  printed as the summary holds it (the seat's condition, comment 6662114479); `test/report-tables.test.mjs` checks
  both. The prose below names no figure: where it compares two, it names the table that holds them.
- **Every quote** is cut from a named row of the evaluations' `rows.jsonl` by `report/quotes.mjs` and sits beside
  its row key; `test/report-quotes.test.mjs` finds each one verbatim in that row (O2).
- **A row** is one question, one repeat and one model of one step, so a figure per row is a figure per question. Each
  main step asks the question set three times of each model (the Rows column). `flat-1000` ran on Haiku 5.5 only, one
  repeat, over its drawn questions (preregistration, "`rule-N`, and `flat-1000`"). A builder read is one row per
  question, shared by both models' main rows; a main row whose builder selection is empty sends no request, and is
  scored as loading nothing.
- **Raw and offered gold, side by side** (the seat's ruling, comment 6614538094). The raw gold is the question's
  `acceptable` for the row's inventory. The offered gold keeps the acceptable sets the row's directory, and any search,
  offered; with none, it is "load nothing" (`scoring/offered.mjs`). On `flat-N` the two are equal: every entry is
  offered.
- **The models.** Two ran: Haiku 5.5 (`anthropic/claude-haiku-5.5`, at low) and the open-weight probe's winner,
  GLM-5.3-Flash (`z-ai/glm-5.3-flash`). The catalog's other two, **Sonnet 5.5 and Opus 5.5, are unmeasured**: their
  stage is written in the preregistration and not run (D14).
- **The money, at list price.** Every cost is, per request, the larger of the cost computed at the listed price and the
  cost OpenRouter reported (preregistration, "Spend accounting"). **The billing route:** the owner's Anthropic key is
  on OpenRouter as a provider key (BYOK), so Haiku requests made through it bill the owner's Anthropic account, and
  some fell back to OpenRouter's credits; GLM-5.3-Flash requests bill OpenRouter. OpenRouter's balance therefore fell
  by less than the recorded spend, and the recorded spend is what the cap held.

### The six numbers of design §1.4

Each number per configuration, model and size, in the tables below. The file is
`runs/2026-11-05/2026-11-05-run-191511/summary.json`; its row count is the denominator each table prints beside the
rate (`hits of n`) or in its Rows column. Each check reads one figure with no key.

| # | Number | Definition, as scored | Field | Row count | Check one |
|---|---|---|---|---|---|
| 1 | Filter recall | the share of rows whose shortlist, the first request's directory, holds a whole acceptable set (`scoring/metrics.mjs`, `filterRecall`); for a builder read, its selection, one per question | `groups[].filterRecall`; a builder read's `groups[].selectionFilterRecall` | `n`, the step's complete rows | `jq -c '.groups[] \| select(.step=="shortlist-200") \| .filterRecall' <file>` |
| 2 | Directory accuracy at the cap | the first request: the share of rows whose first loads are R5's `exact` or `acceptable`; precision: the share in R5's `over` class; on the raw and the offered gold. The capped steps are `shortlist-N`, `shortlist+search-N` and `builder-N` | `groups[].offered`, `groups[].raw`: `firstRequest`, `overLoading` | `n` | `jq -c '.groups[] \| select(.step=="builder-200") \| [.model, .offered.firstRequest, .raw.firstRequest, .offered.n]' <file>` |
| 3 | Search recall at k | of the rows whose shortlist missed and that called `find_source`, the share whose first k hits complete an acceptable set, k five and ten; for `rule-N`, the same search over the question's text, one row per question | `groups[].searchRecall.at5`, `.at10` | `n`: the rows that missed and searched; for `rule-N`, the questions whose gold needs a source | `jq -c '.groups[] \| select(.step=="shortlist+search-1000") \| [.model, .searchRecall.at10]' <file>` |
| 4 | The notice rate | of the rows whose shortlist missed, the share in which the model called `find_source` | `groups[].notice` | `n`: the rows whose shortlist missed | `jq -c '.groups[] \| select(.step=="shortlist+search-200") \| [.model, .notice]' <file>` |
| 5 | Tokens, latency and cost per question | prompt and completion tokens per row and per request, and the directory's share of the first request; the first and second requests' latency, median and p90; the rows' cost and its mean per row, at list price. On Haiku 5.5 and GLM-5.3-Flash; Sonnet 5.5 and Opus 5.5 unmeasured | `groups[].tokens`, `.latencyMs`, `.costUsd`, `.costPerRowMean` | `rows` | `jq -c '.groups[] \| select(.step=="flat-1000") \| [.rows, .tokens.firstRequestPromptMedian, .costPerRowMean]' <file>` |
| 6 | The flat directory's break point | the smallest size at which `flat-N`'s first request falls below `shortlist+search-N`'s, at 50 and 200, with 1,000 a cost point only | `groups[].raw.firstRequest`, `.offered.firstRequest` | `rows` | `jq -c '.groups[] \| select(.step=="flat-200" or .step=="shortlist+search-200") \| [.step, .model, .raw.firstRequest]' <file>` |

The design's own lines are used where it states them: "Below about 0.95 the filter is wrong, not the directory" (§1.4,
number 1; the filter-recall table words each figure against it), and R5's 0.986–1.0 at eleven entries for number 2,
as a cross-check, not a pass or fail test (caveats).

### The tables

<!-- tables.out.md: begin (benchmark/report/tables.mjs; edit nothing between the markers) -->

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

<!-- tables.out.md: end -->

### What the tables show

Each reading names the table that holds its figures. No interval is computed (the preregistration names none), and
some of the differences read here are small.

1. **Filter recall.** The place filter's shortlist is below the design's line at 50, 200 and 1,000 entries, and lower
   at each larger size ("Filter recall"; the same shortlist under `shortlist-N` and `shortlist+search-N`, and the same
   for both models). The builder's selection is at or above the line at every size, per question and per row.
   `baseline-7`'s directory is the six configured of the seven, so a question whose only gold is Boston misses there.
2. **Directory accuracy.** Among the capped steps, `builder-N`'s first request is the highest at every size on both
   models and on both golds, `shortlist-N`'s the lowest, and `shortlist+search-N`'s between ("Directory accuracy").
   Over-loading on the offered gold is highest under `shortlist-N` at every size: when the shortlist drops the gold,
   the offered gold is "load nothing", and any load scores `over`. Every configuration's first request is below R5's
   0.986–1.0, `baseline-7`'s included (caveats).
3. **Search recall at k.** When the model searched after a filter miss, the first ten hits held the gold in most rows,
   on both models at every size ("Search recall at k"). The same search over the question's own text (`rule-N`) finds
   it less often, over a wider denominator, every question whose gold needs a source. Lexical search is enough on this
   evidence; the design's embedding fallback is not called for.
4. **The notice rate.** Haiku 5.5 searched in fewer than half of its filter misses at every size; GLM-5.3-Flash in
   about half or more ("The notice rate"). `find_source` recovers a miss in the rows where the model calls it, and the
   models often do not call it.
5. **Tokens, latency and cost.** The capped steps' first-request prompt and cost per row stay of one order at 50, 200
   and 1,000; the flat directory's grow with the inventory, and at 1,000 its first-request prompt is above the
   100,000-token price step (Haiku 5.5 is billed five times higher there) and its cost per row is the run's highest
   ("Tokens per question"; "Latency and cost per question"). The builder adds its read, which the summary prices per
   step, not per question; the read of the 1,000-entry directory is the run's dearest step. Each read step's cost in
   the summary, over its 149 reads, is $0.0010, $0.0034 and $0.0751 a question at 50, 200 and 1,000 (P5's cold read,
   after the run), so "of one order" is the figure for the capped main rows, not for the builder with its read. At the
   cap, the first request's median latency stays near `baseline-7`'s on Haiku 5.5 and below it on GLM-5.3-Flash, whose
   first-request p90 is longer than Haiku 5.5's on most steps.
6. **The break point.** On Haiku 5.5, `flat-N`'s first request is not below `shortlist+search-N`'s at 50 or at 200, so
   no break point is reached through 200; on GLM-5.3-Flash, it is below at 50 and not at 200 ("The flat directory
   against the capped shortlist with search"). Of the three shapes, the flat directory's first request is the highest
   on Haiku 5.5 at 50 and 200, and the builder's is the highest on GLM-5.3-Flash at every size and on Haiku 5.5 at
   1,000, where flat is a cost point only ("The three shapes at each size").

### The failure classes, quoted

The counts are in "The failure classes, first request" and "The request after a load, the picks and the errors". The
rows quoted below are named by key: first the question, as the rule step's row records it (its one search's query is
the question's text), then the model's call or text. Every quote is verbatim from the evaluations' `rows.jsonl`, and
… marks a cut (`node benchmark/report/quotes.mjs` prints each with its key). The texts are model output, quoted as
data.

- **`over`: a load where the inventory holds no source.** At 7 entries a question about a place none of the seven
  covers has "load nothing" as its gold, and the models often load the Socrata server anyway.
  - `rule-50|rule|q73`, the question: “How many fire and medical calls did Pompano Beach, Florida, respond to last year?”
  - `baseline-7|anthropic/claude-haiku-5.5|q73|1`, the first request: “load_source” with “{"alias": "socrata"}”
- **Raw against offered gold: a source the step does not offer.** `baseline-7` lists six of the seven, not Boston. A
  question whose gold is Boston scores `missing` on the raw gold when the model declines, and correct on the offered.
  - `rule-50|rule|q10`, the question: “How many pothole requests did Boston's 311 receive last month?”
  - `baseline-7|anthropic/claude-haiku-5.5|q10|1`, the first request, which calls nothing: “I can't answer this with the sources I have. The Socrata connector can't reach Boston's city data, and none of the other sources hold Boston 311 records.…”
- **`wrong`: a filter miss the model did not notice.** The place filter's shortlist lacks the gold, and the model
  loads a listed source without calling `find_source`.
  - `rule-50|rule|q16`, the question: “Which organizations received City Council discretionary funding in Queens in fiscal year 2025?”
  - `shortlist+search-50|anthropic/claude-haiku-5.5|q16|1`, the first request: “{"alias": "socrata"}”
- **A filter miss noticed and recovered.**
  - `rule-50|rule|q15`, the question: “What is the average assessed value of residential properties in Dorchester?”
  - `shortlist+search-50|anthropic/claude-haiku-5.5|q15|1`, the first request “find_source” with “{"query": "Boston property assessment records residential assessed value by neighborhood (Dorchester)"}”, then the load “{"alias": "boston"}”
- **`wrong`: a city's own small pack where the gold is the general server.** The labels take a portal that lists few
  datasets as holding nothing in particular (labelling rule 6).
  - `rule-200|rule|q03`, the question: “How many car break-ins were reported in San Francisco in the past six months?”
  - `shortlist+search-200|anthropic/claude-haiku-5.5|q03|1`, the first request: “{"alias": "data_sf_gov"}”
- **`wrong`: a stale catalog row.** Seattle's row in the copied Socrata catalog lists no datasets, so its pack is not
  gold (caveats).
  - `rule-1000|rule|q04`, the question: “Which Seattle neighborhoods had the most code compliance complaints this year?”
  - `shortlist-1000|anthropic/claude-haiku-5.5|q04|1`, the first request: “{"alias": "data_seattle_gov"}”
- **An MCP Registry entry picked first.** Correct on the labels; a registry entry loads no tools, and is scored on the
  first request only.
  - `rule-200|rule|q118`, the question: “Which UK local councils have open tenders for waste collection services?”
  - `flat-200|anthropic/claude-haiku-5.5|q118|1`, the first request: “{"alias": "tender"}”
- **The builder selected nothing for a question that needs a source.** Its main rows then send no request (the "No
  request" column).
  - `rule-50|rule|q127`, the question: “What was the City of Pittsburgh's general fund revenue in 2024?”
  - `builder-50-reads|builder|q127`, the read: “{"aliases": []}”, recorded as “empty selection”
- **The request after a load: no tool call.** A clarifying question.
  - `baseline-7|anthropic/claude-haiku-5.5|q143|2`, the second request: “"Springfield" is the name of many places in the U.S., so I need to know which one you mean.…”
- **The request after a load: a call that fails its schema.**
  - `baseline-7|z-ai/glm-5.3-flash|q51|1`, the second request: “socrata__get_data”, with the schema error “/ should have required property 'type'”

### Caveats

- **The comparisons.**
  - R5's 0.986–1.0 is a **cross-check, not a pass or fail test** (the seat's ruling, comment 6593327786). It carries
    the differences in the `baseline-7` table above, and one more: R5's 49 questions were labelled against R5's
    eleven entries, while S1's 149 are labelled against each of the four inventories by S1's rules, and the seven hold
    none of R5's four NYC servers, so a question R5 labelled to one of them has no source at 7 (each such label's
    `note` in `questions/7.json` says so). The summary holds no split by question, so this report does not attribute
    `baseline-7`'s gap to R5's range.
  - **Offered and raw gold are reported side by side** in every accuracy table; neither replaces the other.
  - This report computes no interval and tests no difference; the cold read's figures below are the exception.
  - P5's cold read (hub #302 comment 6687124516) computed these after the run, outside the preregistration: on the
    first request's raw gold, paired by question and repeat over 447 pairs with an exact two-sided McNemar test,
    GLM-5.3-Flash's `flat-50` at 0.7248 against `shortlist+search-50` at 0.7293 is 36 against 38 discordant rows,
    p 0.91, and Haiku 5.5's `flat-200` at 0.8568 against `builder-200` at 0.8523 is 13 against 11, p 0.84; the
    builder's filter recall at 50 and at 1,000 is 146 of 149 questions, Wilson 95% [0.9425, 0.9931], an interval
    that includes the design's 0.95. None of the three is settled by the run: the first qualifies reading 6 at 50,
    the second reading 6 and decision row 2 at 200, and the third reading 1's "at or above the line" at 50 and 1,000.
- **The counts.**
  - The pick counts: correct first loads that held a synthetic copy (a near-duplicate or a wrapper, counted correct
    wherever its original is, labelling rule 9, so the copies measure crowding and over-loading, not wrong picks);
    first picks that were an MCP Registry entry (which loads no tools); first picks that were a CKAN pack (which
    carries Boston OpenContext's tools as a stand-in for a generic CKAN server).
  - **Error rows are in no denominator** (preregistration, "Metric definitions"). The run has none: the run
    directories table's Error rows column, and each step's.
- **The data.**
  - **The stale Seattle and Austin catalog rows.** In the copied Socrata catalog, Seattle's and Austin's rows list no
    datasets (as do other rows of the 1,000-entry file), so their packs' descriptions say so and the labels do not take
    them as gold (labelling rule 6; P2's note, hub #302 comment 6614538094). A model that picks one is scored `wrong`
    (quoted above).
  - **The place filter was written after the questions were frozen, by an author who had read them** (the
    preregistration says so; the seat's note, comment 6617296646). Its filter recall is reported as a caveat: on
    questions its author had not read it may be lower than measured, and the measured figure is already below the
    design's line.
  - `flat-1000` ran on one model over a drawn subset of the questions, one repeat: a cost point, not compared.
- **The run's history.**
  - **P3-fix (#305)**, a serialization fix made before any model call (the open-weight probe's accuracy written to
    `meta.json` as an 8-place string), moved the inputs' hash `2347faa3…` → `3d4b5271…` (G2's amendment, comment
    6662456277). The run ran at the moved hash.
  - **G3 writes no `baseline.jsonl`**: a plan run records no single-configuration token baselines, so this report
    has no T0 or T1 baseline column as R5's had.
  - **Step 5's first start stopped at `op`**, which was not signed in, before any model call; no run directory was made
    and nothing was spent. Its output is kept as `g3/step-5.op-not-signed-in.out`, and step 5 was run again with the
    same three values (the seat's ruling, comment 6666737354).
- **The money.** Recorded spend is at list price, the larger of the computed and the reported cost of each request.
  Through the BYOK route above, Haiku requests billed the owner's Anthropic account or, where they fell back,
  OpenRouter's credits, so OpenRouter's balance fell by less than the recorded figure. The calibrated bound and the
  cap the evaluations ran under are in `g3/step-4.out` and `g3/sitting-1.json`.

### The decision table for D1 (proposed for G4's ruling)

D1 = A (the rulings file): a deterministic shortlist (configuration ∩ consent ∩ place), the directory over it capped at
about 25 lines, and `find_source` over the inventory; no pre-flight model call; the builder a benchmark configuration.
"Not decided until S1 reports the six numbers." S1 configured every entry, so it measured the place part of the
shortlist only. Each row names the table that holds its figures.

| What D1 = A rests on (design §1.4) | Haiku 5.5 | GLM-5.3-Flash | Sonnet 5.5 | Opus 5.5 | Proposed reading |
|---|---|---|---|---|---|
| The deterministic place filter keeps the gold: filter recall at or above about 0.95 at 50, 200 and 1,000 ("Filter recall") | below the line at every size | the same shortlist: below at every size | unmeasured | unmeasured | **overturned**, for the place filter as the shortlist rule |
| A directory capped at about 25 lines chooses well ("Directory accuracy"; "The three shapes at each size") | with the builder's shortlist, the highest capped step at every size and the highest compared at 1,000; the uncapped flat directory is higher at 50 and 200 | with the builder's shortlist, the highest of the three shapes at every size | unmeasured | unmeasured | **confirmed** for the cap, with the builder's shortlist; every step is below R5's cross-check range |
| `find_source` makes a filter miss recoverable ("Search recall at k"; "The notice rate") | when it searched, the first ten hits held the gold in most rows; it searched in fewer than half of its misses | the same recall; it searched in about half or more | unmeasured | unmeasured | **qualified**: the search finds the source; the model's notice is partial, so recovery is measured, not assured |
| Lexical search first, embeddings only if lexical recall fails ("Search recall at k") | lexical recall at ten high where the model searched | the same | unmeasured | unmeasured | **confirmed**: no embedding search is called for |
| The cap bounds the per-request cost; the flat directory's grows with the inventory ("Tokens per question"; "Latency and cost per question") | the capped cost per row stays of one order at every size; flat's grows and at 1,000 crosses the price step; the builder's read adds $0.0010, $0.0034 and $0.0751 a question at 50, 200 and 1,000, so "of one order" is the capped main rows' figure, not the builder's with its read | the same through 200 (`flat-1000` ran on Haiku 5.5 only) | unmeasured | unmeasured | **confirmed**; the builder's read of the 1,000-entry directory is the run's dearest step |
| The flat directory's break point ("The flat directory against the capped shortlist with search") | not reached through 200 | below at 50, not at 200: no consistent break point | unmeasured (its `flat-200` is in the larger models' stage) | unmeasured | **not established**: the reason to leave flat stays its cost, as §1.4 says |
| The builder stays a benchmark configuration unless it wins on recall at 200–1,000 where the deterministic shortlist loses (§1.4, D/E) | it wins on filter recall at every size, and its first request is above the place filter's with search at every size | the same | unmeasured | unmeasured | **the condition is met**: by §1.4 it becomes the shortlist rule for large inventories, with `find_source` behind it (E), which S1 did not run |

**Proposed reading: D1 qualified**, on Haiku 5.5 and GLM-5.3-Flash, with Sonnet 5.5 and Opus 5.5 unmeasured. The
capped directory and `find_source` stand: over the builder's shortlist the capped directory is the most accurate capped
step at every size, near or above the uncapped flat directory, at a bounded cost per row; and lexical search finds a
missed source when the model asks. The deterministic place filter does not stand as the shortlist rule at any size
measured: its recall is below the design's line, and the model's notice of a miss is too partial to make that up. The
builder meets the condition §1.4 set for replacing it, at every size and on both models, so the shape this report
proposes for S3 is §1.4's E: the builder's selection as the shortlist, the capped directory over it, and `find_source`
behind it. That adds the pre-flight model call D1 = A excluded, recorded as a span of its own (§1.2, §5.2). An owner who reads that clause as essential to D1 = A would rule D1 overturned in favour of E; the measurements
are the same either way.

### What S3 should build, and what it must not (proposed for G4's ruling)

S3 should build:

- the capped directory, about 25 lines, over a shortlist, with `find_source` over the inventory and §1.5's mechanism (a
  hit joins the next request's directory set and `load_source` enum), which S1 measured only as the runner's
  simulation;
- `find_source` as a lexical (BM25) search, as S1 ran it; embeddings only if a later measurement finds lexical recall
  failing;
- for inventories of 200 to 1,000 entries, the builder's selection as the shortlist rule (§1.4's E), its call a span of
  its own in the record (§5.2), and the routing configuration recorded with it (§1.4: the rule and its version, the
  cap, the search and its version, the inventory's id, version and hash);
- before committing to E: a measurement of E itself (S1 ran the builder without `find_source` behind it), and a priced
  builder read at the inventory's size, since the read of 1,000 entries is the run's dearest step;
- the configuration and consent parts of the deterministic shortlist as the design has them: S1 configured every entry
  and measured neither.

S3 must not:

- ship the place filter as the only shortlist rule at 50, 200 or 1,000 entries;
- rest a claim that a filter miss is recoverable on `find_source` alone: the notice rate is partial on both models
  (S2's stub transport measures the unnoticed miss);
- ship the flat directory (A) at 1,000 entries, for its cost per request and the price step;
- carry any reading here to Sonnet 5.5, Opus 5.5 or a Google model, or to a real registry or CKAN server's tools
  (preregistration, "What the run will not conclude").

## Not yet here

- The larger models' stage (Sonnet 5.5 and Opus 5.5; preregistration, "The larger models' stage"), until funded.
- R5's `report-tools/tables.mjs` is adapted at `report/tables.mjs`, outside the inputs' hash (the seat's ruling (a),
  comment 6662114479), not under `scoring/`.
