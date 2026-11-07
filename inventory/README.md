# The civic inventory

`civic-inventory.json` is the source of truth for the sources the civic router offers: one versioned, hashed file of
entries, each a source's identity, routing lines, configuration, hosting variants with their logging postures, and its
tools by name and hash. The router builds a manifest from it by entry kind (`manifestFromInventory(inventory, kinds)`
in `@typedstandards/civic-typed-router`); the router's own `CIVIC_MANIFEST` stays code and is held equal to this file
by the router's tests (hub #309, G0-5 A). Version `2026-11-06.1` holds the router's seven sources, as `server` entries
in `CIVIC_MANIFEST`'s order.

| File | What it is |
|---|---|
| `civic-inventory.json` | The inventory, `civic-inventory/2` |
| `civic-inventory.json.sha256` | Its hash (below), one line |
| `schema.json` | The schema, `$id: civic-inventory/2` (JSON Schema draft-07) |
| `CHANGELOG.md` | One line per version |

## The format and the hash

`{ schema, id, version, note?, entries }`, each entry a `server` or a `pack` (`schema.json`; the sources-at-scale
design §3.2). Every value is a string, an array or an object: the router's `canonicalJson`, which hashes the file,
refuses numbers, booleans and null, so a field with nothing to say is left out. No entry of version 1 has a value of
another type (each was checked: the router's entries carry none in the fields the file states, and the tool schemas,
which do hold booleans and numbers, are referenced by hash, never carried).

- **`id`** is `civic`. **`version`** is `YYYY-MM-DD.N`: the UTC date the version was written and a counter, with one
  `CHANGELOG.md` line.
- **The hash** is the SHA-256 of the router's `canonicalJson` of the parsed file, not of its bytes (S1's definition,
  `benchmark/README.md`, kept so the hash can become a content node's hash later, hub #299). It is computed by the
  same code that hashes a harness definition, so re-indenting the file does not move it. `civic-inventory.json.sha256`
  states it, and the router's `CIVIC_INVENTORY.hash` names it.
- **The release.** Each version is served raw at the hub tag `civic-inventory/<version>`, its own tag family (the
  bundle's pattern, ADR-0038 §5), so a reader resolves a cited version by its tag and checks its hash.
- **Curation.** One editor merges; an entry arrives by pull request with its `provenance`. Every column of version 1 is
  curated (a person read and dated it): no entry is a portal pack, so no column is generated from a catalog, and the
  refresh script for generated columns lands with the first packs (S6).
- **Logging postures** keep ADR-0036's rule: a posture is stated by the manifest (`statedBy: manifest`) only where a
  holder's statement was read, with its `statementUrl` and `readOn` date; where the instance decides the holder, the
  entry names it by role (`statedBy: instance`). The schema requires both fields of a stated posture.

## What an entry is

**A server entry** is the router's manifest entry as data: `id`, `alias`, `sourceId`, `displayName`, `description`,
`freshness`, `freshnessSource`, `configuration`, `hostings`, `consentDefault`, `publisher`, and the prompt frame's
strings (`prompt.citation`, `prompt.lockMention`); then the design's columns, `serverType`, `place`, `categories`,
`authentication`, `provenance`, `toolsRef` and `guidanceRef`. `serverType` names the entry's kind: the code the router
supplies for it (the tool schemas as a code mirror of the server's own `tools/list`, `toolsFor`, the guidance entry,
the preamble entry where a source has its own, the portal lock). A kind is code; a new instance of a known kind is
data.

**A pack** is a base server's tools called with fixed arguments (`filter`), plus text (design §4.1's three-part rule).
Its `configuration`, hosting variants and consent default are its base's; the loader sets `base` on its manifest entry
so a call names the base's server and the pack's `sourceId`. Over the Socrata server a filter fixes `portal` and
optionally `dataset_id`; the pack's `get_data` and `fetch` are rewritten for them as the one-portal lock rewrites a
portal, and its `search` exists only for a portal-only pack over the portal the server is configured for (`search`
takes one argument and covers that portal alone). Version 1 holds no pack.

## Against civic-inventory/1

`civic-inventory/1` (`benchmark/inventories/schema.json`, S1's, unchanged) is the benchmark's format. `/2` keeps its
vocabulary (`text`, `alias`, `sha256`, `date`, `configuration`, `place`, `categories`, `registry`, `authentication`,
`provenance`) and the hash definition, and differs as follows.

**Added:**
- `hostings[]` on a server entry, required: the router's hosting variants (`npm-package`, `remote`, and `container`,
  which is a name in the type only), each with its `logging` postures, `keyIn` where a variant sends a key, and for a
  package its `package`, `version`, `commit` and `outbound` hosts.
- `prompt` on any entry: the prompt frame's strings, `citation` and `lockMention`.
- On a pack: `id` (required), `publisher`, `freshnessSource` and `prompt`; `base` and `filter` as the loader reads them
  (`base` a server entry's `sourceId`; `filter` one or more fixed arguments, each a non-empty string).
- `guidanceRef.kind: inline` with `text`, a pack's own guidance, held to its `blockSha256`.

**Changed:**
- `toolsRef` is `{ toolNames, sha256, fixture? }`: no `kind`, `package` or `sourceId`. `guidanceRef` is
  `{ kind, fetch?, text?, blockSha256? }`, with no `pinned`, `pinnedSha256`, `instructions`, `publicationHost` or
  `path`. The reasons are under "Decisions" below.
- `toolsRef` is optional on a pack; when present, the loader holds the pack's built tools to it.
- `guidanceRef` is required on a server entry: the loader holds it to the origin of the kind's guidance.

**Dropped:**
- `catalog`, `synthetic` and `distractor` on a pack (benchmark-only members);
- the registry entry (`tools: not-captured`): every `/2` entry has tools a kind supplies;
- `hosting: container` on a pack: a pack's hosting variants are its base's.

## Decisions (S2-A P0)

1. **What `toolsRef` carries: names and the tools' hash, and no package.** `7.json`'s `toolsRef` names the router
   package and its version (`@typedstandards/civic-typed-router@0.6.0`); written into this file, that string would
   move the file's hash on every router release whether or not a source changed, against D3 = A ("a data change
   should not need a package release"). The hash already says which schemas the entry means: a router release whose
   mirror gives the same schemas loads the same file, and one that changes a schema fails to load it until the file's
   `sha256` moves, which is a data change. `fixture` names the pinned `tools/list` capture a hosted source's mirror is
   held to. Each entry's `provenance.by` names the manifest version the entry was copied from; that is a fixed
   statement of where the data came from, not a reference that follows releases.
2. **The tools' hash: S1's definition, written once.** The SHA-256 of `JSON.stringify` of the bare-view schemas
   (`benchmark/inventories/build.mjs`, `toolsSha256`), not `canonicalJson`'s, which refuses the booleans and numbers
   tool schemas hold. It is written once, as the router's `toolsSha256` (`src/core/inventory.ts`): the loader checks
   every entry with it, the router's mirror test uses it (and finds each entry's hash equal to `7.json`'s), and
   `scripts/check-inventory.mjs` reaches it through `manifestFromInventory` over the built package.
3. **Booleans and numbers.** None exists in the fields version 1 carries, so nothing is re-encoded; the checker refuses
   any (`check:inventory`'s self-test has the decoy). Had one existed, it would have been reported, not quoted into a
   string.
4. **The version string** is `2026-11-06.1`, the date from `date -u` on the day the file was written.
5. **Guidance is referenced by origin, not by hash.** The embedded guidance texts and the Socrata fallback are code
   (the guidance fetchers stay code), and a block's hash moves with the publication host a consumer passes, so the
   file states each server's guidance origin (`prompt` with its prompt's name, `embedded`, `none`) and the loader holds
   it to the kind's. A pack's guidance is data, carried inline with its hash.

## Adding a source today

Until the onboarding kit (S6, G0-9 A), a source the instance runs from a pinned npm package takes four steps, each in
the repository named:

1. **Pin its tools** (hub): a capture script under `packages/civic-typed-router/src/__fixtures__/`
   (`pin-<server>-tools.mjs`, one per server) installs the exact package version into a temporary directory, reads its
   `gitHead`, runs `initialize` and `tools/list` over stdio, and writes `<server>-tools.json`. The router carries the
   same schemas as code (`src/civic/<server>.ts`), held equal to the fixture by its tests (router README, "Re-running
   the captures").
2. **Generate its lockfile** (website): `scripts/generate-hosted-lockfiles.ts` resolves the pin's `package.json` with
   `npm install --package-lock-only` and writes `src/lib/mcp/hosting/lockfiles.generated.ts`; the sandbox installs from
   it with `npm ci --ignore-scripts`.
3. **Create its sandbox** (website): `src/lib/mcp/hosting/lifecycle.ts` (`wakeHostedSource`) creates one named sandbox
   per source and pinned version on first use, installs the pin and the bridge from the committed lockfiles while the
   package registry is the only host it may reach, then applies the entry's `outbound` list as its network policy; the
   instance turns the source on with its switch (`<SOURCE>_HOSTING=sandbox`), which the website's preflight and
   deployment notes list.
4. **Write its inventory entry** (hub): a `server` entry here with its hosting variant, logging postures read and
   dated, consent default, `toolsRef` (names and `toolsSha256` of the schemas) and a `CHANGELOG.md` line under a new
   version; and, while the app runs `CIVIC_MANIFEST` (until S3), the same values in the router's mirror and an
   `npm-package` kind entry for its `sourceId`.

## Checks

`npm run check:inventory` (`scripts/check-inventory.mjs`) prints `Inventory check passed.` when the file validates
against `schema.json` (ajv 6.15.0), holds only strings, arrays and objects, has a `.sha256` equal to its
`canonicalJson` SHA-256, a `YYYY-MM-DD.N` version with a `CHANGELOG.md` line, and loads with the router's
`manifestFromInventory(file, CIVIC_KINDS)`. Its self-test, `check:inventory:self-test`, runs it on the file and on
decoys.
