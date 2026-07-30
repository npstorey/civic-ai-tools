# BetaNYC MCP Integration Evaluation

An evaluation of the six MCP servers published by BetaNYC — NYC Council legislation, City Record, Checkbook NYC, Charter/Administrative Code/Rules, 311, and NYS legislation — as candidate data sources for `civic-ai-tools-website`. Covers what the servers are, what integrating them would actually cost, and how their data-freshness mechanics work.

*Research, not a decision. No integration work is scoped or committed.*

*Last updated: July 2026*

---

## Summary

All six servers are MIT-licensed, Node/TypeScript, published to npm under `@betanyc/*`, and **stdio-only** — none ships an HTTP transport or a Dockerfile. The website's MCP client is HTTP-based, so a transport seam has to come from somewhere before any of them can be used.

Three findings shape the cost picture:

1. **A transport seam is cheap for these servers.** Upstream code is cleanly factored (tools exported separately from the stdio wiring), and MCP's stateless Streamable HTTP mode works, so an HTTP entrypoint is an additive file rather than a refactor. Verified by spike, below.
2. **Hosting is the cost, and it is avoidable.** A container is a packaging format, not a hosting location. Because a stateless MCP server is just an HTTP POST handler, it can be a route in the Next.js app already deployed — or the protocol boundary can be skipped entirely, since these packages are importable libraries. Neither path adds a hosting bill.
3. **Tool-name collisions are a live blocker.** Two of the six expose a tool named `search`, which the website's registry already assigns to Socrata. The registry's flat tool index resolves collisions by last-write-wins, silently.

If any are adopted, `nyc-charter-laws-rules` is the strongest first candidate: no API key, no outbound network at all, five tools, and a capability (legal-text lookup) genuinely distinct from the dataset querying the site already does.

## The six servers

Tool counts are from source; sizes are `dist.unpackedSize` from npm.

| Server | Tools | npm size | Local state | Key required | Runtime egress |
|---|---|---|---|---|---|
| `nyc-charter-laws-rules` | 5 | **115 MB** | corpus baked into package | none | **none** |
| `nyc-checkbook-mcp` | 10 | 115 KB | none | none | checkbooknyc.com |
| `nyc-record-mcp` | 7 | 49 KB | none | `SOCRATA_APP_TOKEN` (optional) | data.cityofnewyork.us |
| `nyc-311-mcp` | 4 | 53 KB | none | `NYC_311_API_KEY` | api.nyc.gov |
| `nyc-council-mcp` | 20 | 203 KB | SQLite index from a ~700 MB archive | `LEGISTAR_TOKEN` and/or `LEGISTAR_DB_PATH` | webapi.legistar.com |
| `nys-openlegislation-mcp` | 24 | 195 KB | optional SQLite corpus | `NYS_LEGISLATION_API_KEY` | legislation.nysenate.gov |

Two notes on fit:

- **`nyc-record-mcp` overlaps what we already have.** It queries `data.cityofnewyork.us` over Socrata, which `socrata-mcp-server` covers generically. The differentiated servers are Charter, Checkbook, Council and 311.
- **`nyc-checkbook-mcp`'s `smart_search` is documented as unreliable server-side.** Upstream states that `checkbooknyc.com` is WAF-protected and renders results client-side, so that tool "is frequently unavailable server-side." Hosted infrastructure makes this worse, not better. Its other nine tools are structured API calls and unaffected.

## Three deployment shapes, and what each costs

The distinction that matters: **the unit of hosting cost is a process that must stay alive and reachable.** Containerizing does not avoid that — it changes what you hand a host, not whether you need one.

| Shape | When it's the right answer | Marginal cost |
|---|---|---|
| **Import the package in-process** | the tools are for our own chat surface | zero |
| **Serverless route in the existing app** | we want to *offer* a public MCP endpoint others can point clients at | invocation only |
| **Container** | in-network or air-gapped deployment for a third party | a host, and a bill |

Cost tracks isolation. For a public demo, close to none is needed.

The serverless route is viable because MCP's stateless mode is genuinely stateless (verified below) and the platform limits are not binding: Fluid Compute allows package sizes up to 5 GB and 2 GB memory on the standard instance, against a measured 110 MB corpus and 203 MB resident. The corpus is read through a computed path, so Next.js file tracing needs an explicit `outputFileTracingIncludes` entry — the same pattern `next.config.ts` already uses for the notebook-author Python helpers.

## Spike: `nyc-charter-laws-rules` over Streamable HTTP

Run 2026-07-24 against repo `58726e8e` and npm `@0.2.0`. Chosen because it is the only one of the six with zero runtime egress, so tool calls could be exercised for real rather than stubbed.

**Measured:**

| Check | Result |
|---|---|
| Clone → `npm install` → `tsc` | clean, 3s |
| MCP over stdio: initialize / tools/list / tools/call | `get_section §1043` returned 16,675 chars of real Charter text |
| Same server over Streamable HTTP | 8/8 assertions pass |
| `tools/call` with no session and no prior `initialize` | works — stateless mode viable, so no session affinity |
| Non-conforming `Accept` header | correctly rejected, HTTP 406 |
| npm install footprint | 135 MB, 4s |
| Corpus parse | 7 ms + 83 ms + 64 ms for charter / admin_code / rules |
| Memory | 203 MB resident with all three loaded, 313 MB peak; lazy per corpus, so Charter-only sits near 54 MB |

**Not measured — stated so this doc is not over-read:** no image was ever built (no container runtime available), and no real socket was opened (the environment denied `listen()` on TCP and unix sockets alike). The transport was driven with real `http.IncomingMessage` / `http.ServerResponse` objects over a synthetic socket, so the assertions read genuine serialized wire bytes — but port binding, concurrency, and behaviour under load are unverified.

**Incidental finding worth recording.** MCP SDK 1.29 routes the Node path through `@hono/node-server`'s `getRequestListener`, which builds the Web `Request` URL from `Host` and reads `req.rawHeaders`. A request lacking `Host` returns **HTTP 400 with an empty body** — no message, nothing useful in logs. Any reverse proxy in front of such a server must preserve `Host`.

## Tool-name collisions

The website's registry builds a flat `toolIndex` keyed by tool name (`src/lib/mcp/registry.ts`), so a duplicate name silently overwrites the earlier binding. Collisions against the current registry and among the BetaNYC servers themselves:

```
search              socrata ↔ charter,  socrata ↔ nys
get_bill            council ↔ nys
search_bills        council ↔ nys
get_committee       council ↔ nys
list_committees     council ↔ nys
get_calendar        311     ↔ nys
```

Adding Charter unprefixed would hijack Socrata's `search`, a core tool, with no error. Adding all six unprefixed takes the surface from 9 tools to **58** with seven collisions.

Boston's server already avoids this with a `ckan__` prefix, so the convention exists in the codebase but was decided ad hoc once and never written down. Registered as [Q60](../architecture/open-questions.md#q60--tool-name-namespacing-across-mcp-sources).

The related question — whether the *tool schema* set should be routed per request rather than sent whole — is a delta on an assumption in [`skill-routing-architectural-shapes.md`](skill-routing-architectural-shapes.md), and is recorded there rather than duplicated here.

## How these servers stay current

Three distinct update models, which matter more than they first appear.

**1. Live-API servers carry no data.** Record, Checkbook, and 311 proxy the city's APIs at call time. Nothing to refresh; their CI covers code releases only. These never go stale.

**2. Charter is automated upstream, daily.** `refresh-data.yml` runs at 11:00 UTC, fetches AML's public bulk XML, rebuilds `data/index`, runs the tests, and commits to `main` **only when content actually changed**. The build is idempotent — a no-op rebuild yields a byte-identical tree — and it authenticates with the built-in `GITHUB_TOKEN`, no PAT or repo secret. 16 refresh commits so far; cadence is irregular because AML publishes irregularly.

**3. Council and NYS refreshes are the operator's job.** Neither has refresh automation, because the data lives outside the repo — Council indexes the `jehiah/nyc_legislation` archive (~700 MB, updated most weekdays), NYS builds its corpus via `npm run sync` with an API key. Adopting either in local-index mode means inheriting a recurring job **and** persistent disk, which a serverless function does not have. In practice that limits those two to live-API mode.

### The consequential detail: data and releases are decoupled

`refresh-data.yml` commits data to `main`; `release.yml` publishes to npm only on a `v*` tag push. Nothing bridges them. So **the npm package is exactly as fresh as the last manual release, and law changes do not wait for releases.**

Observed instance: `v0.2.0` was tagged 2026-07-21 and was current at that moment. On 2026-07-23 a real Charter update landed on `main` (Local Law 2026/112 → 2026/116, four local laws) and no tag has been cut since. The gap is therefore unbounded in principle and was worth four local laws within three days in practice.

The consequence for any consumer: **for legal text, do not depend on the npm tag.** Pin a git dependency to a SHA (`data/index` is committed, so a git dependency does carry the corpus) and bump it on a schedule, or watch `main` and rebuild. A scheduled check in our own repo is sufficient and needs no new infrastructure.

## Possible upstream contributions

Both are additive and in keeping with the existing code; neither is scoped or committed here.

1. **A version-bump-and-tag step at the end of `refresh-data.yml`**, so `release.yml` publishes on real data changes. This fixes freshness for every consumer of the package, not just us. Whether corpus content counts as a semver patch is a judgment call for the maintainers, so this is a question to raise rather than a patch to submit.
2. **A Streamable HTTP entrypoint** alongside the stdio one. The spike's candidate file is the whole delta, since `TOOLS` and `callTool` are already exported independently of the transport.

Of the two, the release-cadence question is the more valuable, because it is a correctness issue in a package that answers legal questions.

## Cross-references

- Tool-name namespacing question: [Q60](../architecture/open-questions.md#q60--tool-name-namespacing-across-mcp-sources)
- Tool-schema routing (the scaling axis): [`skill-routing-architectural-shapes.md`](skill-routing-architectural-shapes.md) § Tool-schema axis
- Registry and client: `civic-ai-tools-website/src/lib/mcp/registry.ts`, `client.ts`
- Comparable prior evaluation: [`census-mcp-evaluation.md`](census-mcp-evaluation.md) — same genre, same transport-fit question
- Upstream: `github.com/BetaNYC` (`nyc-charter-laws-rules`, `nyc-checkbook-mcp`, `nyc-record-mcp`, `nyc-311-mcp`, `nyc-council-mcp`, `nys-openlegislation-mcp`)
