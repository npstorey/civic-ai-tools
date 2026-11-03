# Runner fixtures

`r5-questions.json` is R5's question set, copied byte for byte from R5's frozen inputs (planning
`chooser-spike-questions.json`, sha256 `82968e5841ff3636d00bc725c91dd7065c45434bf044a66ae4faa3167ed2c48d`; R5's
`questions.json`). It is a **fixture, not gold**: the runner's dry runs and its run-path test read it so P0 can be
checked before the benchmark's own questions exist. Its labels name R5's eleven-entry directory, so five aliases in
them (`boston`, `nyc_311`, `nyc_budget`, `nyc_council`, `nyc_mta`) are not in `baseline-7`'s directory; the dry run
says so. The benchmark's questions and gold are P2's, under `benchmark/questions/`, written after the inventories'
hashes are recorded. The file is kept unedited so its hash stays R5's; this README is where it is marked.
