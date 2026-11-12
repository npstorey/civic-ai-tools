# ADR-0039: Route identity — three names, `base` by `id`, a pack's base pins and their hash, `api` on every entry, and `derivedFrom`

- **Status:** **Accepted** (the owner's rulings on the route-identity design, hub [#309 comment 6799683557](https://github.com/npstorey/civic-ai-tools/issues/309#issuecomment-6799683557), every card as recommended, building on the nine directions of [6796471259](https://github.com/npstorey/civic-ai-tools/issues/309#issuecomment-6796471259); and the owner's G0 on the sprint anchor [#317](https://github.com/npstorey/civic-ai-tools/issues/317), 2026-11-12, with G0-C3 amended to `1.1` in the program seat's ruling of [6822292750](https://github.com/npstorey/civic-ai-tools/issues/317#issuecomment-6822292750). and G0-C1 = A, the Data Commons entry's `id`, ruled at G0b in the program seat's ruling of [6835239767](https://github.com/npstorey/civic-ai-tools/issues/317#issuecomment-6835239767), section B)
- **Date:** 2026-11-12
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0031](0031-civic-typed-router-packaging.md) (the router gains four pure functions in `src/core/`), [ADR-0032](0032-tool-naming-across-sources.md) (`alias` keeps its rules; `id` and `sourceId` gain theirs) and [ADR-0036](0036-source-hosting-variants-and-logging-posture.md) (an entry gains `api` beside its hosting variants). Cites [ADR-0033](0033-composed-harness-record-fields.md) (a record's components, which the reported keys of a later phase join) and [ADR-0038](0038-civicaitools-v1-producer-profile-subtype.md) (the bundle whose revision 4 states the refusal rule).

## Context

Inventory version 2 (`2026-11-09.1`, `civic-inventory/2`, router 0.8.0) made NYC City Record a pack over the Socrata server. Three facts of that version are what this record changes:

- A pack named its base by `sourceId` (`"base": "socrata"`), a key local to one inventory: another inventory, or a filtered copy, could give `socrata` to a different server, and the pack's hash would not move.
- Nothing stated what the base server was when the pack was written, so a consumer had no fact to compare the live server with before sending a pack's call.
- No check held an entry's `id` unique: not the schema, not `check:inventory`'s six rules, not the router's startup checks, which hold `alias` and `sourceId` only (`src/core/alias.ts`).

The route-identity design (planning-side, revision 4) proposed the conventions below, and the rulings adopted them. This record states them as the hub implements them in schema 3, inventory version 3 and router 0.9.0.

## Decision

### A. Three names, each with its job

| Name | Job | Scope | Rule |
|---|---|---|---|
| `id` | The global identity; a record carries it (`components[].id`, `civic:serverId`, `civic:packId`) | Every inventory | `<name>@<locator>`. Unique in the file. From schema 3 on, never changed once a released version carries it |
| `sourceId` | The key for routing, traces, addresses and consent rows | One inventory | Short. Unique in the file. Never reused for another entry |
| `alias` | The prefix of the tool names the model sees | One inventory | ADR-0032's rules, unchanged. Unique in the file |

`check:inventory` (rule 7) refuses a second holder of any of the three, by name. The router's loader refuses a second `id`; the router's startup checks already refused a second `sourceId` or `alias`.

### B. The `id` forms

- **A server an operator can run from published source:** `<name>@<the source repository's URL>`, `<name>` the package name where the server is published as a package, otherwise the repository's name. A fork has the upstream's name and its own repository URL.
- **A service one party runs at a fixed address:** `<name>@<the endpoint URL>`.
- **A pack:** `<name>@<the URL of the place in the API it reads>` (City Record's, `nyc-record@https://data.cityofnewyork.us/d/dg92-zbpx`, keeps this form: the packs card, A).
- A server's MCP Registry name, where it has one, goes in the entry's `registry.name`; it does not replace the `id`. The router's `ManifestEntry.id` comment, which said the Registry name came first, is corrected.

**The stated weakness.** Two packs of one dataset over different bases share a locator, so their `id`s can be equal. Uniqueness is a check, and a check holds within one file only: two inventories could each hold a different pack under one `id`. A record tells two such packs apart by the pack's hash characters, which its component's `version` carries (`<version>+<hash12>`). Uniqueness of a pack `id` across files is not built.

**The Data Commons entry (G0-C1 = A): the one stated exception.** Its `id` through version 2, `datacommons-mcp@https://github.com/datacommonsorg/agent-toolkit`, named a repository whose server is not the one at the entry's default address. In version 3 it is `Data Commons MCP Server@https://api.datacommons.org/mcp`: the endpoint form, with the name the hosted server reports and its address. This is the one change of an `id` a released version carried, made at the schema step where the rule starts; after it, the rule has no exception. Published records and their fixtures keep the old `id`. The facts (the curator's lookup record, `curator-lookup.md`, sha256 `75c6c854516a2cca15ed94a62a5c2f5720c2daef395648124f66e284711372e0`, and the owner's read of 2026-11-12): the hosted server reported `serverInfo` `{ name: "Data Commons MCP Server", version: "8aed5d1" }`; `8aed5d1` is a commit of `datacommonsorg/mixer` (`8aed5d19e11d467e2cba84a421b4dcd2a70676f3`) and no commit of `datacommonsorg/agent-toolkit`; mixer sets the name (`internal/server/mcp/server.go:37`) and reports its deployed commit as the version; mixer's `deploy/apigee/README.md:24` states that the MCP server "runs inside Mixer and is served by the same Cloud Endpoints (ESP) service as the Mixer API"; and its public host is `api.datacommons.org` (`deploy/apigee/terraform/prod/vars.tfvars:6`), all at `8aed5d1`. The entry's `api` is `{ platform: data-commons, host: api.datacommons.org }`, and its `freshnessSource` no longer names agent-toolkit's server. The hub's benchmark holds its frozen copy's `id` and `freshnessSource` for that entry alone (`benchmark/inventories/to-manifest.mjs`), so its definition hashes do not move.

### C. `base` by `id`

A pack's `base` is the base server entry's full `id` (`socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server`), so the pack's hash covers which server it is built over. The loader resolves the `id` to the server entry and sets the pack's manifest entry's `base` to that entry's `sourceId` (`socrata`), so the dispatch map and a consumer's registry do not change. It refuses a `base` that names no server entry's `id` (a `sourceId` is refused with the `id` to use), names a pack, or names a server whose kind takes no pack.

### D. `basePins`, the schema hash, and the live check

**The field.** On a pack, required, inside its hash: a list of pins, each `{ serverName, serverVersion, tools }`, the `serverInfo.name` and `serverInfo.version` the base reported when the pin was captured, and one member per base tool the pack calls, by the name sent on the wire, whose value is that tool's `mcpToolSchemaSha256`.

**Which tools a pin names: a correction of the design's wording.** The design says "one member per base tool the pack calls". Which tools a pack calls can depend on the instance: a portal-only Socrata pack offers `search` only where the instance's Socrata server is configured for the pack's portal (`src/civic/inventory.ts:207-208` at `ead9b07`), so an exact match would let one file load on one instance and fail on another. The rule is: **every tool the pack calls on this instance is pinned, and every pinned tool is one of the base's.** The loader refuses either gap. CKAN-1's P2 pins with this rule as merged. The list has one pin normally and two while a base release is staged; each edit moves the pack's hash, and so its credit. The capture the values were read from is named once, in the base entry's `toolsRef.fixture` (for the Socrata server, `packages/civic-typed-router/src/__fixtures__/socrata-tools.json`, written by `pin-socrata-tools.mjs` at a stated commit).

**The hash, exactly.** `mcpToolSchemaSha256(tool)` is the lowercase hex SHA-256 of the RFC 8785 canonical JSON (`canonicalJsonValue`) of `{ name, inputSchema }`, as the server's own `tools/list` returned the tool, with the annotation keywords `title` and `description` removed from every schema object the walk reaches. Every other member of the listed tool is outside it. The walk:

- `properties`, `patternProperties`, `$defs`, `definitions` and `dependentSchemas` hold schemas **by name**: each member's value is walked, and the names are kept, so an argument named `description` or `title` stays;
- `items`, `additionalProperties`, `not`, `if`, `then`, `else`, `contains` and `propertyNames` hold **one schema**, walked; `items` holding an array is a list, each item walked;
- `anyOf`, `oneOf`, `allOf` and `prefixItems` hold **a list** of schemas, each walked;
- the data keywords `default`, `const`, `enum` and `examples` are **kept whole**, and so is **every keyword the rule does not name** (for example `additionalItems`, `unevaluatedProperties`, `unevaluatedItems`, `dependencies`, `contentSchema`): kept, not walked, so a later pin over another server uses the same rule;
- a schema that is not a plain object (a boolean schema) is kept as it is.

The canonicalizer is a second one beside `canonicalJson`, which hashes the router's own values and refuses numbers, booleans and null; tool schemas hold all three.

**The worked cases** (the contract both this router and the copy in socrata-mcp-server's pinned-identity test meet). *Case 1:* the tool `{ "name": "v", "inputSchema": { "type": "object", "title": "T", "description": "D", "properties": { "description": { "type": "string", "description": "an argument named description" }, "n": { "type": "integer", "minimum": 1, "description": "x" }, "flag": { "type": "boolean", "default": false }, "tags": { "type": "array", "items": { "type": "string", "description": "y" } } }, "required": ["description"], "additionalProperties": false } }` has the canonical text `{"inputSchema":{"additionalProperties":false,"properties":{"description":{"type":"string"},"flag":{"default":false,"type":"boolean"},"n":{"minimum":1,"type":"integer"},"tags":{"items":{"type":"string"},"type":"array"}},"required":["description"],"type":"object"},"name":"v"}` and the hash `7d059d0a5564530b86cd74e9c72269f9d507e1a93eb26979666a89eb8e8455eb`. *Case 2:* case 1 with one more property, `"opts": { "type": "object", "description": "z", "default": { "description": "data, not a keyword" }, "anyOf": [ { "type": "object", "title": "a subschema's title" } ] }`, whose `default` keeps its member and whose `anyOf` item loses its `title`, has the hash `d79d93f1d11b85e4fc07d6c4b73fd7c4880bca58555c159bed96e30a57984852`. A walk that also strips inside `default` gives `2ab850b0a2234575312daea5512685b5f2e620d47fa17723909f34cf390a792a`; one that does not walk `anyOf` gives `1aff7763977b498874f890f3ad91bd35e437c7c8a80d8812b8add338a06b15e7`. `src/mcp-tool-schema.test.ts` holds all four.

**What the pin covers, and what it does not.** The argument schemas of the tools the pack calls, and the base's reported name and version. Not a tool the pack never calls, so a base that adds or changes one still matches; not the listed text, so not a reworded description or a setting the server writes into one (measured on the Socrata server at `c0512d0`: with `DATA_PORTAL_URL` set the listed descriptions differ and the three tools' hashes do not). Not a change in behaviour that leaves the schemas and the version literal alone: the version is the server's own report, and many commits share one.

**The live check (C2 = A: refuse).** The router carries the pins on the pack's manifest entry, `pack: { version, hash, basePins }`, so a consumer checks without reading the file. `checkBasePins(pins, observed)` compares what the live base reports with each pin in order and returns the first pin it equals, or each pin's first difference: the member (`serverName`, `serverVersion` or `tools.<name>`), the pinned value and the observed one. A pinned member the live base does not state counts as a difference. The router decides nothing on a difference. Before the first call of a pack's tool in a run, the reference consumer compares the base's `tools/list`, read for that run, and its `serverInfo` as the consumer's client holds it (a client may hold it for its process rather than read it per run). On a difference it does not send the call, and it records the call as a rejected call; that is the website's, in its own phase.

**The stage, and its guard (C11 = A).** A server merge that moves a pinned value deploys before any re-pin, so a refusing check would stop every call of the pack at that merge. A server change that moves one is staged: capture the new values at the server pull request's head; release a pack that lists both pins; deploy the consumer; merge the server change; drop the old pin later. The guard is a test in socrata-mcp-server that holds the server's reported name, its version and each listed tool's `mcpToolSchemaSha256` to a committed file, so a pull request that moves one fails until the file is edited. It warns; the order of the merges rests on the reviewer.

### E. `api` on every entry, and containment

Every server and pack entry states the API it reads, required: `{ platform, host?, dataset? }`, `platform` one of `socrata`, `ckan`, `arcgis`, `data-commons`, `custom-api` and `bundled-data` (a server that ships its data and calls no API); `host` the API's host name, absent on a server that reads any host of its platform; `dataset` the platform's dataset identifier, present only with `host`. `serverType` stays the key to the router's kinds. A server's `api` is the curator's statement, read from the entry's own fields (version 3: the Socrata server from its description, Boston from its freshness line, the three package-hosted servers from their hosting variants); a pack's is held to its filter by its base's kind at load (a Socrata pack: `socrata`, its `filter.portal`, its `filter.dataset_id` or no dataset).

Entry A **contains** entry B when their platforms are equal, A states no `host` or B's, and A states no `dataset` or B's. Two entries are routes to the same data when one contains the other.

### F. `routesByApi`, and the reference router's default (C5 = A)

`routesByApi(inventory)` gives the groups: one per distinct `api` that contains another entry, with every entry it contains. It decides nothing, and no router code calls it. The reference router keeps its default: a route whose address is set is offered, and when two routes to the same data are both set, both are offered and the model chooses; the record shows both in `sourcesOffered`, and each call states its server and pack. A router that filters differently states its rule in `considered.rule`.

### G. `derivedFrom`, and a pack's version

`derivedFrom` is an optional pack member, a list, inside the hash: each pinned source the pack's text is drawn from, its `id` (in section B's forms) and `sourceUrl` required, its `version`, `commit`, `file` and `fileSha256` where it has them. `provenance` keeps `addedOn`, `from`, `by` and `sourceUrl`, who curated the entry, outside the hash; its `file`, `commit` and `fileSha256` leave the schema, so the fact has one home. City Record's names `@betanyc/nyc-record-mcp@https://github.com/BetaNYC/nyc-record-mcp` 1.1.0, the `id` version `2026-11-06.1` gave that server.

A pack's version is `<major>.<minor>`. The minor moves when the pack's hashed entry changes and its recipes do not; the major moves when a recipe changes. The version `1`, released before this rule, reads as `1.0`. City Record's pack is `1.1` in version 3. No check holds the form.

### H. City Record's dedicated server (C6 = A), a stated exception

The rulings say a dedicated server stays beside a pack, the pack an alternative route. City Record's dedicated server left in version 2 and does not return here: a stated exception. It ends when a loader can hold an inventory entry the reference router does not offer, which is a later sprint's (the line S3's anchor carries). `derivedFrom` names that server exactly, inside the pack's hash; it does not make it a route.

### I. Questions filed, not decided here

- **C7 = A:** official-endpoint attestations, and the design's table of standard questions, are filed on typedstandards; the specification's "Inclusion in the index is informational" is the first conflict it names. Nothing here builds an attestation.
- **C12 = C:** what the specification's §8.1.8 means by a failed call (one "rejected by the source") for a call the producer did not send is filed on typedstandards. The bundle's own words are revision 4's (ADR-0038's amendment); the specification is not edited.

## Considered and rejected

- **`base` by `sourceId`, as in version 2.** Local to one file, so outside what a pack's hash can say about its base.
- **A pin over the listed tool text, or over a whole `tools/list`.** The Socrata server writes its settings into its descriptions, so such a hash differs between deployments and moves on ordinary merges, and a capture made with an empty environment would match no configured deployment.
- **A capture path inside each pin.** It duplicated `toolsRef.fixture`, and a file path inside the hash would move the hash when a file is renamed.
- **Keeping `provenance.commit`, `file` and `fileSha256`.** Two homes for one fact, one of them outside the hash.

## Consequences

- Schema `civic-inventory/3`; inventory version 3 (`civic-inventory/<version>`); router 0.9.0, whose `ManifestEntry.pack` gains `basePins` and whose exports gain `mcpToolSchemaSha256`, `canonicalJsonValue`, `checkBasePins` and `routesByApi`. City Record's pack hash moves once, at version 3, which also carries the pack's two owed names ("NYC City Record"; "City Record for New York City notices").
- `toolsRef.toolNames` may be empty, on a server entry only when some pack names that entry as its base (`check:inventory` rule 8), for a later inventory's server whose tools only its packs offer.
- Every server release that moves a pinned value needs the two-pin stage.
- The benchmark's frozen copies are untouched; its inputs' hash does not move.

## References

- `inventory/schema.json`, `inventory/README.md`, `scripts/check-inventory.mjs`.
- `packages/civic-typed-router/src/core/mcp-tool-schema.ts`, `canonical-json-value.ts`, `base-pins.ts`, `routes-by-api.ts`, `inventory.ts`; `src/civic/inventory.ts` (the Socrata kind's `api` check).
- `packages/civic-typed-router/src/__fixtures__/pin-socrata-tools.mjs` and `socrata-tools.json`.
- The sprint anchor, hub #317: section 4's worked example and criteria A1.1–A1.9.
