# The routing benchmark

A frozen, re-runnable instrument that compares routing configurations by measurement (Sprint S1, hub #302). The
**benchmark** is the fixed instrument: the inventories, the questions and their gold, the runner and the scorer. An
**evaluation** is one scored run of a configuration against it. Nothing here is an app feature: the runner builds
every prompt and tool through the router package (`@typedstandards/civic-typed-router`, from this workspace), sends
the requests a configuration allows, and stops at the model's tool call. No source is ever called.

This phase (P0) moved R5's chooser-spike instrument here and added the 7-entry inventory. P1 adds the 50-, 200- and
1,000-entry inventories, P2 the question set and gold, P3 the other configurations and the preregistration.

## Layout

| Path | What it is |
|---|---|
| `inventories/` | `schema.json` (the design's §3.2 format), `build.mjs` (deterministic; `--check` rebuilds byte for byte), `to-manifest.mjs` (inventory entries to the router's manifest entries), `guidance.mjs` (the guidance a composition reads, offline), `7.json` and `7.json.sha256` |
| `runner/` | `run.mjs` and its modules; `catalog.mjs` and `app-texts.mjs` (pinned copies of the website's catalog excerpt and load-result text, each with its source commit and sha256); `openrouter-models.json` (the model-list rows a dry run prices from); `writer.mjs` (the digit-run convention); `rewrite-r5.mjs` (made the committed copy of R5's run) |
| `runner/fixtures/` | `r5-questions.json`: R5's 49 questions, a runner fixture, **not gold** (its README) |
| `scoring/` | `analyze.mjs` (the scorer) and `score.mjs` (the load classes), moved from R5. Not `analysis/`: the hub ignores any directory of that name |
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

The seven are the router's manifest entries: `to-manifest.mjs` hands back the router's own entry for each, after
holding every data field, the tool names and the tools' hash to the router's.

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

- The 50-, 200- and 1,000-entry inventories, and loaders for pack and fixture entries (P1).
- `questions/` and the gold (P2). The anchor's literal dry-run command, with `--questions benchmark/questions/7.json`,
  joins the checks when P2 commits that file.
- The configurations beyond `baseline-7` and the plain `flat-N`, the per-row reservation of A3.2, the
  per-configuration hashes of G0-9, and the preregistration (P3).
- R5's `report-tools/tables.mjs` (P4 moves it to `scoring/`).
