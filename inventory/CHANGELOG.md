# Changelog — the civic inventory

One line per version: the version, then what changed. The version is the UTC date it was written and a counter; the
file's hash is its `.sha256` at the tag `civic-inventory/<version>`.

- `2026-11-06.1`: the router's seven sources (router 0.6.0's `CIVIC_MANIFEST`), as `server` entries in its order.
- `2026-11-09.1`: City Record (`nyc-record`) as a pack over the Socrata server: the dataset `dg92-zbpx` on `data.cityofnewyork.us`, seven query recipes as its guidance, its own `hash`; the other six unchanged (router 0.8.0's `CIVIC_MANIFEST`).
- `2026-11-12.1`: schema `civic-inventory/3` (the route-identity conventions, ADR-0039; router 0.9.0's `CIVIC_MANIFEST`): every entry states its `api`; City Record's pack names its base by the Socrata entry's `id`, pins it (`basePins`, one pin, read from the capture the Socrata entry's `toolsRef.fixture` names), states the dedicated server its recipes were drawn from in `derivedFrom` (the pin `provenance` held in version 2), is named "NYC City Record" with the lock mention "City Record for New York City notices", and moves to version `1.1`; `provenance` no longer carries `file`, `commit` or `fileSha256`. The Data Commons entry's `id` becomes `Data Commons MCP Server@https://api.datacommons.org/mcp` (the endpoint form; G0-C1 = A): the one stated exception to "an `id` is never changed once released" (ADR-0039 §B). Its `freshnessSource` no longer says the server is agent-toolkit's: the hosted server is the one built into Google's Data Commons Mixer.
