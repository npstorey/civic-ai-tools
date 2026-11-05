# The inventories' sources

Every file the 50-, 200- and 1,000-entry inventories are built from. `build.mjs` reads them through `sources.mjs`,
which checks each file's sha256 before it parses it, so a source that changed stops the build.

| File | What it is | sha256 |
|---|---|---|
| `socrata.json` | The website's Socrata portal directory, **the whole file**, byte for byte: `data/portals/socrata.json` in `npstorey/civic-ai-tools-website` at `85590020eae4ab72795afd7e8e6cd81589e8ac23` (last changed at `b69c65a3d165afd4d5f4b0af60f134b40cd16feb`). 364 rows; fields as `src/lib/mcp/portal-data.ts:7-20` types them | `97f6131d3a434e643cb24d9038864a72cacf8ff44961894c3dffe0d5ac2397e9` |
| `ckan.json` | The website's CKAN portal directory, **the whole file**, byte for byte: `data/portals/ckan.json`, same commit. 1,947 rows | `7590d64fd0ae794fc2d489c6333ff519c002c60a442faa2b571828ba47f54580` |
| `registry-entries.json` | The MCP Registry entries the inventories use (250), with the names of the pool they were drawn from (638), extracted by `../extract.mjs` from the owner's registry fetch. Third-party text, copied as read, under the digit-run convention | `89a919e6c662f5c3052f5bc74a1dc3cd38f8ee6c8f336ba94346417d49f9b2c1` |
| `r5-servers.json` | R5's four servers outside today's seven (`nyc_budget`, `nyc_council`, `nyc_311`, `nyc_mta`): each one's directory entry and its load, as R5 froze them, extracted by `../extract.mjs` from the owner's copy of R5's instrument (R5's `directory.json`, sha256 `be0874030f0c95dd6083fd3d1e8fdfae4fa956ff848c7b67d4c25c1053e5dea7`; its `loads.json`, R5's canonical-JSON sha256 `f9e018df5cf15e3d250e758ef3691ea8d88ddca536b3ee6cddb0457c271ed86e`) | `26526aa977681040b049606f3f45ffc14e535427be76395b9a0b17263544125d` |
| `g06-registry-fetch.py` | The script the owner ran to read the registry (G0-6), byte for byte. It reads no file here; it is committed so the fetch can be rerun | `ad6a07af2c41b7b128212fbb337fd489d26306cd2ace05648642e13457515763` |
| `fetch-log.tsv` | That run's log, byte for byte: 567 requests, every one HTTP 200, from `2026-11-03T01:30:02Z` to `2026-11-03T01:42:17Z`; each row's URL, time, size and sha256. The list pages themselves stay in the owner's `benchmark/_local/registry/` (ignored); each registry entry's `provenance` names its page and that page's sha256 from this log | `846ef149c49ae797db935ac6c0942e307c9cde5a3ffd1cbfcba37aae89e3ae29` |

**The registry runs.** The fetch above is the second run. The first run, by the first version of the script, stopped
at its cap of 100 pages before the list ended; it is kept in the owner's `benchmark/_local/registry-run1-capped/` and
**is not used**.

**Re-extracting.** `node benchmark/inventories/extract.mjs --check` re-extracts the two extracted files from the
owner's `benchmark/_local/` and compares them byte for byte; without those inputs, as in a fresh clone or CI, it prints
a named skip line and the committed files stand. The test `inventories.test.mjs` runs it.
