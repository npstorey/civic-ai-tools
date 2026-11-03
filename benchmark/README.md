# The routing benchmark

A frozen, re-runnable instrument that compares routing configurations by measurement (Sprint S1, hub #302). The
**benchmark** is the fixed instrument: the inventories, the questions and their gold, the runner and the scorer. An
**evaluation** is one scored run of a configuration against it. Nothing here is an app feature: the runner builds
every prompt and tool through the router package (`@typedstandards/civic-typed-router`, from this workspace), sends
the requests a configuration allows, and stops at the model's tool call. No source is ever called.

P0 moved R5's chooser-spike instrument here and added the 7-entry inventory; P1 added the 50-, 200- and 1,000-entry
inventories and the preregistration's inputs (`preregistration/s1.md`). P2 adds the question set and gold, P3 the
other configurations and the rest of the preregistration.

## Layout

| Path | What it is |
|---|---|
| `inventories/` | `schema.json` (the design's §3.2 format), `build.mjs` (deterministic; `--check` rebuilds byte for byte), `rules.mjs` (the rules every entry is derived by), `to-manifest.mjs` (inventory entries to the router's manifest entries), `guidance.mjs` (the guidance a composition reads, offline), `load-text.mjs` (the fixed text a registry entry's load returns), `extract.mjs` (re-extracts two sources from the owner's local inputs), `sources.mjs`; `7.json`, `50.json`, `200.json` and `1000.json`, each with its `.sha256` |
| `inventories/sources/` | the committed sources, each read through its sha256: the website's two portal directories, the registry entries used, R5's four servers, the registry fetch's script and log (its README) |
| `runner/` | `run.mjs` and its modules; `catalog.mjs` and `app-texts.mjs` (pinned copies of the website's catalog excerpt and load-result text, each with its source commit and sha256); `openrouter-models.json` (the model-list rows a dry run prices from); `writer.mjs` (the digit-run convention); `rewrite-r5.mjs` (made the committed copy of R5's run) |
| `runner/fixtures/` | `r5-questions.json`: R5's 49 questions, a runner fixture, **not gold** (its README) |
| `scoring/` | `analyze.mjs` (the scorer) and `score.mjs` (the load classes), moved from R5. Not `analysis/`: the hub ignores any directory of that name |
| `preregistration/` | `s1.md`: the sprint's preregistration; P1 writes its inputs section, P2 and P3 the rest |
| `runs/2026-10-11-r5/` | R5's run, rewritten once under the digit-run convention, with the scorer's summary over it (its README) |
| `test/` | the benchmark's checks |
| `_local/` | ignored, never committed: the owner's copy of R5's instrument and originals, and the registry pages P1 reads |

The checks run as one root script, `npm run check:benchmark`, which CI runs; the AGENTS.md Commands table is the list
of every gate and the healthy output of each.

## Running

```sh
# Dry run: every input's sha256, the configuration, and the estimated cost bounds. No key, no network, writes nothing.
node benchmark/runner/run.mjs --dry-run --inventory benchmark/inventories/7.json \
  --questions benchmark/runner/fixtures/r5-questions.json --config baseline-7

# A run needs --cap and a key (MODEL_API_KEY or OPENROUTER_API_KEY); the sprint's wrapper supplies both (G0-7).
# The summary is the scorer's, written where it is told and never over a file:
node benchmark/scoring/analyze.mjs benchmark/runs/<run-id> --out benchmark/runs/<run-id>/summary.json
```

Before it spends, a run reads OpenRouter's live model list, checks the roster against it (every slug present, tools
supported, every request field listed as supported, the reasoning effort offered) and checks the key with one free
call. Requests go by Node's `fetch`; no SDK. A run writes `meta.json` (every input's sha256, the configuration, the
prices as read and when, the request parameters, the spend), `rows.jsonl`, `baseline.jsonl` and `contact-ledger.md`
(every request's host, path and status, as it is sent; `.md` because the hub ignores `*.log`).

**The reservation estimate errs high.** Before each call the runner reserves its worst case: the prompt estimated at
2 characters a token (`--chars-per-token`, until a probe calibrates it; R5 used 3, and Anthropic billed R5's first
request at 1.23 times that), the completion at its full limit, and the price of the tier the prompt would fall in,
with any request within 25% of a tier's threshold priced at the higher tier (Haiku 5.5 is billed five times higher
above 100,000 prompt tokens). A call that would carry the spend past `--cap` is not sent; the run records the stop
and exits 2. A call that returns no usage keeps its reservation as spend.

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

## Not yet here

- `questions/` and the gold (P2). The anchor's literal dry-run command, with `--questions benchmark/questions/7.json`,
  joins the checks when P2 commits that file.
- The configurations beyond `baseline-7` and the plain `flat-N`, the per-row reservation of A3.2, the
  per-configuration hashes of G0-9, and the preregistration's remaining sections (P3).
- R5's `report-tools/tables.mjs` (P4 moves it to `scoring/`).
