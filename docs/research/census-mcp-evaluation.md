# Census MCP Evaluation

An evaluation of candidate MCP servers for adding authoritative US demographic and statistical data to the civic-ai-tools stack, focused on the needs of the `civic-ai-tools-website` multi-MCP architecture (M9 in the local project plan). The question: should the website's second data source be Google Data Commons MCP, or a dedicated Census Bureau MCP?

*Last updated: April 2026*

---

## Summary

Two candidates were evaluated against the needs of an HTTP-transport Next.js app that already runs a single remote MCP server (`socrata-mcp.civicaitools.org`). Option 1 is **Google Data Commons MCP**, a Google-hosted multi-source statistical knowledge graph accessible via a free HTTP endpoint. Option 2 is the **official U.S. Census Bureau Data API MCP server** (plus community alternatives), which wrap the Census Bureau API behind a local stdio server.

**Decision:** Option 1 — Google Data Commons MCP — on the basis of transport fit, broader coverage, lower integration friction, and a simpler tool surface. Option 2's stdio-only deployment is a blocker for the website's HTTP architecture and would require standing up and operating a second self-hosted MCP server, which is not a good tradeoff for a solo-maintained project under M8 schedule pressure.

---

## Option 1 — Google Data Commons MCP

### Current state (as of 2026-04-14)

| Field | Value |
|-------|-------|
| Repository | [datacommonsorg/agent-toolkit](https://github.com/datacommonsorg/agent-toolkit) (package `packages/datacommons-mcp`) |
| Stars | 138 (agent-toolkit) |
| Open issues | 2 |
| Latest release | v1.2.1 (2026-04-07) |
| Transport | stdio + Streamable HTTP (both supported in the package) |
| Hosted HTTP endpoint | [`https://api.datacommons.org/mcp`](https://api.datacommons.org/mcp) — free, Google-hosted since 2026-02-09 |
| Auth | `X-API-Key` header; free API key from [apikeys.datacommons.org](https://apikeys.datacommons.org) |
| Package | `datacommons-mcp` on PyPI; also Docker image |

The starter project already has a working Data Commons MCP integration in `.mcp.json` (stdio via local binary), so query ergonomics can be tested directly from Claude Code. The hosted HTTP endpoint is new (Feb 2026) and is the key unlock for the website use case.

### Coverage

Data Commons aggregates statistical data from the U.S. Census Bureau (ACS + Decennial), BLS, CDC, Department of Education, EPA, UN, WHO, World Bank, and many more — roughly 240 billion data points across hundreds of thousands of statistical variables.

Supported small-area geographies ([place types docs](https://docs.datacommons.org/place_types.html)) include:

- **Census Tract** (as defined by the U.S. Census Bureau)
- **Census Block Group**
- **CensusZipCodeTabulationArea** (ZCTA — approximate for US zip codes)
- County, State, Country
- S2 cells and IPCC grid placeholders for climate data

**Gap:** Data Commons does *not* natively expose NYC community districts, Chicago community areas, school districts, or arbitrary municipal boundaries. Joining city-operational data at those resolutions to Data Commons requires a tract-level crosswalk, handled either with skill guidance or a small utility in the website. This gap is the same for Option 2.

### Tool surface

Two tools:

- **`search_indicators`** — discovers available variables and topics for specified places
- **`get_observations`** — retrieves statistical data for variables and locations

The two-tool surface is simpler than Option 2's four-tool surface and maps well onto a typical LLM question flow: find the right variable, then get the data.

### Maturity signals

- Active development (v1.2.1 shipped 2026-04-07, low open-issue count)
- Backed by Google; steady release cadence since public launch (2025-10-02)
- Hosted cloud endpoint operational since 2026-02-09
- DataGemma research (Gemma 2 fine-tuned on Data Commons, 58%→99% factuality on statistical claims) signals Google's longer-arc investment in the knowledge graph, not a one-off MCP release

### Integration friction (website)

Minimal. The hosted HTTP endpoint + `X-API-Key` header slot directly into the website's existing `src/lib/mcp/client.ts` pattern. No new Render service or Docker image to deploy. Configuration is a single new entry in the mcpServers map.

### Known limitations

- Hosted endpoint is rate-limited implicitly; exact quotas not documented
- The hosted endpoint can only query `datacommons.org`; a custom Data Commons instance requires self-hosting
- Aggregation semantics (which variable, which time range, which place type) remain an LLM-guidance problem — wrong choices silently return wrong data

---

## Option 2 — Dedicated Census Bureau MCP options

### Official U.S. Census Bureau MCP (primary Option 2 candidate)

| Field | Value |
|-------|-------|
| Repository | [uscensusbureau/us-census-bureau-data-api-mcp](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp) |
| Stars | 63 |
| Open issues | 5 |
| Latest release | v0.1.2-beta (2026-03-06) |
| Commits | 152 on main |
| Transport | **stdio only** (Docker-wrapped local deployment) |
| Hosted endpoint | None |
| Auth | `CENSUS_API_KEY` env var; free key from [api.census.gov](https://api.census.gov/data/key_signup.html) |
| Tools | `list-datasets`, `fetch-dataset-geography`, `fetch-aggregate-data`, `resolve-geography-fips` |

**Coverage:** all Census Bureau Data API endpoints (ACS, Decennial, Population Estimates, etc.) and full FIPS geography resolution. Broader census-specific surface than Data Commons' ACS slice, narrower overall (no BLS/CDC/Ed/EPA/international).

**Known reliability issues:**
- [#34](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues/34) — the client guesses at the data vintage when not specified (silent wrong-answer risk)
- [#25](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues/25) — incomplete dataset parameter returns 404
- [#35](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues/35) — no descriptive error when a user requests ACS 1-year for a sub-65,000-population place
- [#70](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues/70) — token/context management need, "help wanted"
- [#122](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues/122) — caching not implemented

### Community alternatives

| Server | Stars | Transport | Signal |
|--------|-------|-----------|--------|
| [brockwebb/open-census-mcp-server](https://github.com/brockwebb/open-census-mcp-server) | 17 | stdio | Active (199 commits), Python, "pragmatics rules engine" for variable matching |
| [smach/censuschat](https://github.com/smach/censuschat) | 11 | stdio | R package + MCP; integrates `vitals` LLM eval framework; tract-level tigris support |
| [shawndrake2/mcp-census](https://github.com/shawndrake2/mcp-census) | — | stdio | Small, less mature |

None of these offer an HTTP transport or a hosted endpoint. All would require the website to deploy and operate a second self-hosted MCP server.

---

## Comparison

| Dimension | Google Data Commons MCP | Official Census Bureau MCP |
|---|---|---|
| Transport (website) | Hosted HTTP + self-host HTTP/stdio | stdio (Docker) only |
| Hosted endpoint | Yes — `api.datacommons.org/mcp` | None |
| Integration friction (website) | Low — single config entry | High — deploy + operate second MCP server |
| Coverage | Census + BLS + CDC + Ed + EPA + intl | Census only (ACS, Decennial, PEP, etc.) |
| Small-area geographies | Tract, Block Group, ZCTA | All Census geographies via FIPS resolver |
| Municipal boundaries (CD, CA) | Not native | Not native |
| Tool surface | 2 (search + observations) | 4 |
| Stars | 138 (agent-toolkit) | 63 |
| Open issues | 2 | 5 (including vintage guessing + 404 bugs) |
| Release cadence | v1.2.1 (Apr 2026) | v0.1.2-beta (Mar 2026) |
| API key | Free from apikeys.datacommons.org | Free from api.census.gov |
| Starter project integration | Already present | Not yet |

---

## Decision

**Option 1 — Google Data Commons MCP.**

1. The hosted HTTP endpoint is the decisive factor. The website's single-MCP-server architecture calls a remote HTTP MCP endpoint over HTTPS; adding a second remote HTTP MCP endpoint is a minimal-risk configuration change. Option 2 would require deploying and operating a second self-hosted MCP server on top of the Render-hosted Socrata server — a material increase in infrastructure and operational surface for a solo-maintained project under M8 schedule pressure.
2. Broader source coverage preserves optionality. Future civic-tech questions touching health (CDC), labor (BLS), education (NCES), or environment (EPA) are served by the same integration without a second MCP onboarding.
3. The two-tool surface needs less skill guidance than four tools plus FIPS resolution.
4. The hardest open problem — joining city-operational data to Data Commons at municipal-boundary resolutions (e.g., NYC community districts) — is identical for both candidates and must be solved by a tract-to-CD crosswalk regardless.
5. The starter project already has a working Data Commons integration via stdio, so query ergonomics can be sanity-checked from Claude Code before M9.1 architectural work begins.

---

## Open questions deferred to M9.1+

- **Geography crosswalks.** Tract → community district / community area / council district / school district mapping is the hardest remaining problem for the M9 demo analysis. Options: (a) push to LLM with skill guidance, (b) build a small crosswalk utility in `src/lib/`, (c) require users to work at one geography per query.
- **Skill-guidance depth on aggregation semantics.** The wrong variable, time range, or place type silently returns the wrong answer. Skill guidance must cover this more carefully than Socrata skill guidance does for SoQL.
- **PROV-O graph distinctions.** The provenance mapping in `src/lib/evidence/provenance.ts` needs to emit distinct `prov:Agent` entries for Data Commons vs. Socrata, and `data-sources.json` needs a source tag per artifact.
- **Caching strategy.** ACS releases once a year; aggressive caching could meaningfully reduce API calls and cost. Cache location options: Vercel KV, Neon, static repo artifacts.
- **Rate limits and quotas.** The hosted Data Commons endpoint's quotas are undocumented; worth confirming before pushing demo traffic through it.
- **Self-hosted fallback.** Whether the website should also support a self-hosted Data Commons MCP as a fallback path in case the hosted endpoint becomes unavailable or rate-limited.
- **Skill guidance for the starter project.** civic#15 is the natural first step — unblocked by this decision.

---

## Links

- Data Commons MCP (agent-toolkit): https://github.com/datacommonsorg/agent-toolkit
- Data Commons MCP docs: https://docs.datacommons.org/mcp/
- Hosted cloud endpoint announcement (2026-02-09): https://blog.datacommons.org/2026/02/09/the-data-commons-mcp-server-is-now-hosted-in-the-cloud/
- Data Commons MCP server launch announcement (2025-10-02): https://blog.datacommons.org/2025/10/02/announcing-the-data-commons-model-context-protocol-server/
- Data Commons place types: https://docs.datacommons.org/place_types.html
- Data Commons API key signup: https://apikeys.datacommons.org
- Official Census Bureau MCP: https://github.com/uscensusbureau/us-census-bureau-data-api-mcp
- Census Bureau API key signup: https://api.census.gov/data/key_signup.html
- Open Census MCP Server (brockwebb): https://github.com/brockwebb/open-census-mcp-server
- Censuschat (smach): https://github.com/smach/censuschat
- mcp-census (shawndrake2): https://github.com/shawndrake2/mcp-census
- DataGemma full paper (grounding LLMs in Data Commons): https://docs.datacommons.org/papers/DataGemma-FullPaper.pdf
