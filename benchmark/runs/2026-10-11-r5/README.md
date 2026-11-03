# R5's run, rewritten under the digit-run convention

R5's chooser-spike run `2026-10-11-run-171124`: nine models, 49 questions, three repeats, 1,323 rows. The originals
live only in the owner's copy of R5's instrument (`benchmark/_local/r5/runs/2026-10-11-run-171124/`, ignored) and are
never committed: their cost floats hold runs of 13 to 20 digits.

| File | What it is |
|---|---|
| `meta.json`, `rows.jsonl`, `baseline.jsonl` | the originals, each line parsed and written again by the runner's writer, in the same order: costs as decimal strings of at most eight places, a long digit run inside text escaped (it parses back unchanged), and `meta.json`'s prices per million tokens |
| `summary.json` | the scorer's summary over the three files above; its `files` hashes are theirs |
| `r5-summary.json` | R5's own `summary.json` through the writer, less `computedAt` and `runDir` (a clock and an absolute path); its `files` hashes are the originals' |

Made with `node benchmark/runner/rewrite-r5.mjs <originals> benchmark/runs/2026-10-11-r5`, then
`node benchmark/scoring/analyze.mjs benchmark/runs/2026-10-11-r5 --out benchmark/runs/2026-10-11-r5/summary.json`.
`benchmark/test/scoring.test.mjs` holds `summary.json`'s figures equal to `r5-summary.json`'s, and, where the
originals are present, the scorer's output over them equal to R5's summary and this directory equal to their rewrite,
byte for byte.

R5 built its requests with router 0.1.0 and its own frozen directory; how that differs from `baseline-7` is in
`benchmark/README.md`.
