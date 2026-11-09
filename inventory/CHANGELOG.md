# Changelog — the civic inventory

One line per version: the version, then what changed. The version is the UTC date it was written and a counter; the
file's hash is its `.sha256` at the tag `civic-inventory/<version>`.

- `2026-11-06.1`: the router's seven sources (router 0.6.0's `CIVIC_MANIFEST`), as `server` entries in its order.
- `2026-11-09.1`: City Record (`nyc-record`) as a pack over the Socrata server: the dataset `dg92-zbpx` on `data.cityofnewyork.us`, seven query recipes as its guidance, its own `hash`; the other six unchanged (router 0.8.0's `CIVIC_MANIFEST`).
