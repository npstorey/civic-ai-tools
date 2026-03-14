<!-- AUTO-GENERATED from data/mcp-servers.json. Do not edit directly. Run: npm run generate-directory-md -->

# Civic Data MCP Servers

A directory of MCP servers for accessing civic and public data. Servers marked **Included** are pre-configured in this repo's setup.

*Last surveyed: March 2026. Sources: GitHub, official MCP Registry, Glama, PulseMCP, mcpservers.org, mcp.so, Smithery, LobeHub, Playbooks.*

## Included in civic-ai-tools

| Server | Data Source | Transport | Maintainer | Notes |
|--------|------------|-----------|------------|-------|
| [socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server) | Socrata open data portals (NYC, Chicago, SF, etc.) | stdio, http | [@npstorey](https://github.com/npstorey) | Pre-configured for NYC Open Data. Supports any Socrata portal. npm. |
| [data-commons-mcp](https://github.com/datacommonsorg/data-commons-mcp) | Google Data Commons (UN, Census, WHO, CDC, etc.) | stdio | [@Google](https://github.com/Google) | Hosted free on Google Cloud. Aggregates data from hundreds of sources. Free API key from apikeys.datacommons.org. Docs. |

## Other Socrata / Open Data Portal Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [odp-mcp](https://github.com/socrata/odp-mcp) | Socrata open data portals | stdio | Socrata (Tyler Technologies) | Active | Official Socrata MCP server. Lightweight, read-only tools. |
| [Socrata-MCP](https://github.com/Thomas-TyTech/Socrata-MCP) | Socrata open data portals | stdio | [@Thomas-TyTech](https://github.com/Thomas-TyTech) | Active | From a Tyler Technologies developer. Natural language queries generate insights. |
| [opengov-mcp-server](https://github.com/srobbin/opengov-mcp-server) | Socrata open data portals | stdio | [@srobbin](https://github.com/srobbin) | Active | No API key required. ~10 stars, available via npx. Built by co-founder of Chi Hack Night. |
| [open-data-mcp](https://github.com/leomerida15/open-data-mcp) | Socrata open data portals | stdio | [@leomerida15](https://github.com/leomerida15) | Active | Socrata-based open data MCP. |
| [nyc-mcp](https://lobehub.com/pl/mcp/forest-builds-nyc-mcp) | NYC Open Data (2,000+ datasets) | stdio | [@forest-builds](https://github.com/forest-builds) | Active | NYC-specific. City services, housing, transportation, events, spending. |

## U.S. Federal Government Servers

### Official (agency-maintained)

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [census-mcp](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp) | U.S. Census Bureau / ACS | stdio | U.S. Census Bureau | Active | Official. Built with MCP TypeScript SDK. Requires `CENSUS_API_KEY`. Uses local Postgres for robust search. |
| [govinfo-mcp](https://github.com/usgpo/api) | GovInfo (Congressional Record, Federal Register, CFR) | stdio | U.S. Government Publishing Office | Beta | Official. Access to all three branches of federal government publications. GitHub. |

### Community-built

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [us-gov-open-data-mcp](https://github.com/lzinga/us-gov-open-data-mcp) | 36+ federal APIs (Census, EPA, NOAA, FDA, SEC, BLS, FRED, FEC, FBI, USDA, CDC, etc.) | stdio | [@lzinga](https://github.com/lzinga) | Active | 188+ tools. TypeScript SDK, caching, retry logic, selective module loading. 18 APIs need no key. Featured on Hacker News. |
| [gov-mcp-servers](https://github.com/martc03/gov-mcp-servers) | 13 government data sources | stdio, http | [@martc03](https://github.com/martc03) | Active | Unified gateway packaging 13 production servers. Listed on official MCP Registry. |
| [mcp-civic-data](https://github.com/EricGrill/mcp-civic-data) | 7 federal APIs (NOAA, Census, NASA, World Bank, Data.gov, EU) | stdio | [@EricGrill](https://github.com/EricGrill) | Active | 22 tools. No API keys required for most. Good starter server. |
| [datagov-mcp-server](https://github.com/melaodoidao/datagov-mcp-server) | Data.gov | stdio | [@melaodoidao](https://github.com/melaodoidao) | Active | Search packages, view datasets, list groups/tags from the federal open data portal. |
| [usaspending-mcp-server](https://github.com/thsmale/usaspending-mcp-server) | USAspending.gov | http | [@thsmale](https://github.com/thsmale) | Active | Federal spending data. Streamable HTTP transport. |
| [capture-mcp-server](https://github.com/blencorp/capture-mcp-server) | SAM.gov + USAspending.gov + Tango | stdio | [@blencorp](https://github.com/blencorp) | Active | 15 tools for government contracting. Returns both human-readable text and structured JSON. |

## U.S. Legislative & Legal Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [CongressMCP](https://github.com/amurshak/congressMCP) | Congress.gov (bills, votes, members, committees) | stdio | Lawgiver.ai | Active | 6 tool suites, 113 functions. Free tier: 500 calls/month; Pro: $19/month. GitHub. |
| [congress-gov-mcp](https://github.com/ashwinsundar/congress_gov_mcp) | Congress.gov API v3 | stdio | [@AshwinSundar](https://github.com/AshwinSundar) | Active | Bills, amendments, voting records, committee info, member details. |
| [legiscan-mcp](https://github.com/sh-patterson/legiscan-mcp) | LegiScan (all 50 states + Congress) | stdio | [@sh-patterson](https://github.com/sh-patterson) | Active | Search bills, get full text, track votes, look up legislators. Requires API key. |
| [us-legal-mcp](https://github.com/JamesANZ/us-legal-mcp) | Congress + Federal Register + CourtListener | stdio | [@JamesANZ](https://github.com/JamesANZ) | Active | Multi-source aggregation for legal research. |
| [courtlistener-mcp](https://github.com/blakeox/courtlistener-mcp) | CourtListener (3,352 U.S. courts) | stdio | [@blakeox](https://github.com/blakeox) | Active | 20+ tools. Opinions, dockets, judges, oral arguments, financial disclosures. |
| [umbrella-terminal-mcp](https://glama.ai/mcp/servers/@TheBlackCompany/umbrella_terminal_mcp) | Colorado legislative intelligence | stdio | [@TheBlackCompany](https://github.com/TheBlackCompany) | Active | 67 tools. Bills, statutes, rules, campaign finance. State-specific. |

## U.S. Elections & Campaign Finance

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [fec-mcp-server](https://github.com/sh-patterson/fec-mcp-server) | Federal Election Commission | stdio | [@sh-patterson](https://github.com/sh-patterson) | Active | Candidates, donations, spending, Super PAC activity, donor search. |

## U.S. Census & Demographics

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [open-census-mcp-server](https://github.com/brockwebb/open-census-mcp-server) | U.S. Census Bureau | stdio | [@brockwebb](https://github.com/brockwebb) | Active | Natural language to Census variable codes via semantic matching. |
| [mcp-census](https://github.com/shawndrake2/mcp-census) | U.S. Census Bureau | stdio | [@shawndrake2](https://github.com/shawndrake2) | Active | Demographics, population, income, housing data. |
| [censuschat](https://github.com/smach/censuschat) | U.S. Census Bureau | stdio | [@smach](https://github.com/smach) | Active | R package + MCP server with web chat interface and LLM evaluation framework. |

## U.S. Health & Public Health

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [mimilabs](https://www.mimilabs.ai/mcp) | 50+ CMS/CDC/FDA datasets | stdio | [@mimilabs](https://github.com/mimilabs) | Active | Medicare, Medicaid, CDC, FDA, hospital quality, provider directories. |
| [medicare-mcp](https://github.com/openpharma-org/medicare-mcp) | CMS Medicare | stdio | [@openpharma-org](https://github.com/openpharma-org) | Active | Provider and claims data. |
| [PopHIVE MCP](https://pophive.yale.edu) | CDC + Epic Cosmos EHR | stdio | [@Yale](https://github.com/Yale) | Active | Near real-time health data combining CDC and Epic Cosmos EHR. Featured on Claude. |

## U.S. Economic Data

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [fred-mcp-server](https://github.com/stefanoamorelli/fred-mcp-server) | FRED (Federal Reserve Economic Data) | stdio | [@stefanoamorelli](https://github.com/stefanoamorelli) | Active | 800,000+ economic data series. Categories, releases, sources. |
| [sec-edgar-mcp](https://github.com/stefanoamorelli/sec-edgar-mcp) | SEC EDGAR (13M+ filings) | stdio | [@stefanoamorelli](https://github.com/stefanoamorelli) | Active | XBRL financials, company info. Docker image available. |

## U.S. Government Contracting (Commercial)

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [GovCon MCP](https://glama.ai/mcp/servers/ezbiz-services/gov-con) | SAM.gov + USAspending + FPDS | stdio | [@ezbiz-services](https://github.com/ezbiz-services) | Active | Contracts, agency spending, competitor analysis, small business set-asides. |
| [GovTribe MCP](https://blog.govtribe.com/govtribe-mcp-server-connect-govtribe-to-your-ai-tools) | GovTribe platform | stdio | [@GovTribe](https://github.com/GovTribe) | Active | Commercial. Opportunities, awards, IDVs, contract vehicles, vendors, forecasts. |

## International Government Servers

### Official (government-maintained)

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [datagouv-mcp](https://github.com/datagouv/datagouv-mcp) | data.gouv.fr (France) | stdio, http | French government | Active | Official. Remote endpoint at `https://mcp.data.gouv.fr/mcp`. No API key required. |
| [India NSO MCP](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2224472) | eSankhyiki (India statistics) | stdio | India Ministry of Statistics | Beta | 7 data products: Labour Force Survey, CPI, Industry, National Accounts, etc. |

### Europe

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [eurostat-mcp](https://github.com/ano-kuhanathan/eurostat-mcp) | Eurostat (37 European countries) | stdio | [@ano-kuhanathan](https://github.com/ano-kuhanathan) | Active | GDP, unemployment, inflation, population, trade. No API key required. |
| [datos-gob-es-mcp](https://github.com/AlbertoUAH/datos-gob-es-mcp) | Spain (BOE + INE + AEMET + Datos.gob.es) | stdio | [@AlbertoUAH](https://github.com/AlbertoUAH) | Active | 11 tools, 5 resources, 6 prompts. Unified 4 Spanish data sources + 40,000+ datasets. |
| [kolada-mcp](https://github.com/isakskogstad/Kolada-MCP) | Kolada (Sweden municipal statistics) | stdio | [@isakskogstad](https://github.com/isakskogstad) | Active | 5,000+ KPIs across 290 Swedish municipalities and 21 regions. |
| [riksdag-regering-mcp](https://github.com/isakskogstad/riksdag-regering-mcp) | Swedish Parliament + Government | stdio | [@isakskogstad](https://github.com/isakskogstad) | Active | Open data from Swedish legislative and executive branches. |
| [parliament-mcp](https://github.com/i-dot-ai/parliament-mcp) | UK Parliament | stdio | [@i-dot-ai](https://github.com/i-dot-ai) | Active | 13 tools including semantic search via Qdrant. |
| [GovUK-MCP](https://stealthlabs.ai/govuk-mcp) | UK government data | stdio | Stealth Labs | Active | 24 tools + 15 visual widgets for UK government data. |
| [swedish-law-mcp](https://github.com/Ansvar-Systems/swedish-law-mcp) | Swedish, Danish, Finnish law | stdio | [@Ansvar-Systems](https://github.com/Ansvar-Systems) | Active | Also Danish and Finnish law MCPs from the same maintainer. |

### Asia-Pacific

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [estat-mcp](https://github.com/ajtgjmdjp/estat-mcp) | e-Stat (Japan statistics) | stdio | [@ajtgjmdjp](https://github.com/ajtgjmdjp) | Active | 3,000+ tables: population, economy, prices, labor, agriculture. |
| [jpn-laws-mcp](https://github.com/michimani/jpn-laws-mcp-server) | Japanese laws (e-Gov) | stdio | [@michimani](https://github.com/michimani) | Active | No API key required. |
| [data-gov-hk-mcp](https://www.pulsemcp.com/servers/tonychan-data-gov-hk) | DATA.GOV.HK (Hong Kong) | stdio | [@tonychan](https://github.com/tonychan) | Active | Official Hong Kong open data portal. Search datasets, browse categories. |
| [mcp-datagovmy](https://github.com/hithereiamaliff/mcp-datagovmy) | Malaysia data.gov.my | stdio | [@hithereiamaliff](https://github.com/hithereiamaliff) | Active | Includes GTFS transit data tools. |
| [OpenDart-mcp](https://github.com/keonho-kim/OpenDart-mcp) | South Korea DART (corporate disclosures) | stdio | [@keonho-kim](https://github.com/keonho-kim) | Active | Korean financial disclosures via OpenDart API. |

### Middle East

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [budgetkey-mcp](https://github.com/openbudget/budgetkey-mcp) | Israel budget transparency | stdio | [@openbudget](https://github.com/openbudget) | Active | Israeli budget transparency data. |

### Americas

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [gov-ca-mcp](https://glama.ai/mcp/servers/@krunal16-c/gov-ca-mcp) | Government of Canada (250,000+ datasets) | stdio | [@krunal16-c](https://github.com/krunal16-c) | Active | Two servers: datasets and transportation (bridges, airports, cycling, transit, railways). |
| [ibge-mcp](https://github.com/SidneyBissoli/ibge-br-mcp) | IBGE (Brazilian census/statistics) | stdio | [@SidneyBissoli](https://github.com/SidneyBissoli) | Active | 23 tools. Demographics, geography, economics, SIDRA tables, population projections. |
| [bcb-mcp](https://lobehub.com/mcp/sidneybissoli-bcb-br-mcp) | Brazil Central Bank | stdio | [@SidneyBissoli](https://github.com/SidneyBissoli) | Active | Selic, IPCA, exchange rates, GDP time series. |
| [agrobr-mcp](https://github.com/bruno-portfolio/agrobr-mcp) | Brazilian agriculture (19 sources) | stdio | [@bruno-portfolio](https://github.com/bruno-portfolio) | Active | CEPEA, CONAB, IBGE, INPE, B3. Prices, crop estimates, climate, deforestation. |

### Global

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [world-bank-data-mcp](https://github.com/llnormll/world-bank-data-mcp) | World Bank Data360 | stdio | [@llnormll](https://github.com/llnormll) | Active | 1,000+ indicators, 200+ countries. WDI, HNP, GDF, IDS datasets. |

## Framework / Multi-Portal Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [OpenDataMCP](https://github.com/OpenDataMCP/OpenDataMCP) | Universal open data portals | stdio | [@OpenDataMCP](https://github.com/OpenDataMCP) | Active | Universal framework aiming to connect any open data portal to any LLM via MCP. Starting with Switzerland. |

## CKAN Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [ckan-mcp-server (ondata)](https://github.com/ondata/ckan-mcp-server) | Any CKAN portal worldwide | stdio | [@ondata](https://github.com/ondata) | Active | Generic CKAN connector. Works with data.gov, data.gov.uk, data.europa.eu, and hundreds more. Docs. |
| [ckan-mcp-server (ondics)](https://github.com/ondics/ckan-mcp-server) | Any CKAN portal | stdio | [@ondics](https://github.com/ondics) | Active | Alternative CKAN implementation. Browsing and management. |
| [ckan-mcp (OpenASCOT)](https://glama.ai/mcp/servers/@openascot/ckan-mcp) | 600+ global CKAN portals | stdio | [@openascot](https://github.com/openascot) | Active | Exposes 600+ portals to AI assistants. |

## Geospatial / GIS Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [gis-mcp](https://github.com/mahdin75/gis-mcp) | GIS operations | stdio | [@mahdin75](https://github.com/mahdin75) | Active | Shapely, PyProj, GeoPandas, Rasterio, PySAL. Geometry, coordinate transforms, spatial analysis. |
| [osmmcp](https://github.com/NERVsystems/osmmcp) | OpenStreetMap | stdio | [@NERVsystems](https://github.com/NERVsystems) | Active | 25 tools: geocoding, routing, nearby places, neighborhood analysis. No keys required. |
| [mapbox-mcp](https://github.com/mapbox/mcp-server) | Mapbox | stdio | Mapbox (official) | Active | Geocoding, POI search, routing, travel time, isochrones. |

## Weather & Environmental Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [open-meteo-mcp](https://github.com/cmer81/open-meteo-mcp) | Open-Meteo (weather, climate) | stdio | [@cmer81](https://github.com/cmer81) | Active | 7-day forecasts, ERA5 historical data from 1940, air quality, marine, CMIP6 climate projections. No API key. |

## Other Civic-Adjacent Servers

| Server | Data Source | Transport | Maintainer | Status | Notes |
|--------|------------|-----------|------------|--------|-------|
| [NASA-MCP-server](https://github.com/ProgramComputer/NASA-MCP-server) | 20+ NASA APIs | stdio | [@ProgramComputer](https://github.com/ProgramComputer) | Active | APOD, Mars Rover, EPIC earth imagery, NEO, EONET, DONKI, GIBS, POWER, JPL. |
| [patent-mcp](https://github.com/riemannzeta/patent_mcp_server) | USPTO Patents | stdio | [@riemannzeta](https://github.com/riemannzeta) | Active | Patent Public Search, PTAB, PatentsView, Office Action, Patent Litigation. |
| [mcp-nutrition-tools](https://mcpservers.org/servers/zen-apps/mcp-nutrition-tools) | USDA FoodData Central | stdio | [@zen-apps](https://github.com/zen-apps) | Active | 600,000+ foods. CC0 public domain. |
| [mcp-wikidata](https://github.com/zzaebok/mcp-wikidata) | Wikidata | stdio | [@zzaebok](https://github.com/zzaebok) | Active | Entity search, property retrieval, SPARQL queries. Runs on Cloudflare Workers. |
| [foiagras](https://foiagras.com/mcp/) | Government transparency / FOIA | stdio | FOIA Gras | Active | Public records, meeting minutes, local government documents. |
| [civicnet-mcp-server](https://github.com/Publik-Works/civicnet-mcp-server) | Federated civic infrastructure | stdio | [@Publik-Works](https://github.com/Publik-Works) | Active | Federated civic infrastructure with equity principles. |

---

## Coverage Gaps

The following civic data domains have **no or limited MCP server coverage** as of March 2026:

| Domain | Data Sources That Could Be Wrapped | Notes |
|--------|-----------------------------------|-------|
| **Elections / voting results** | State election boards, AP election data | Campaign finance (FEC) is covered, but actual election results are not |
| **Universal transit (GTFS)** | GTFS feeds from any transit agency | International coverage exists (mcp-datagovmy includes GTFS for Malaysia) but US-specific coverage is still missing |
| **Local 311 / permits** | Open311 API, municipal permit databases | No dedicated server found |
| **Zoning / land use** | Municipal zoning databases | Highly local, fragmented data |
| **Property records** | County assessor databases | Parcel data, assessments, ownership |

---

## Priority Recommendations

Servers ranked by value to civic-ai-tools users, considering data breadth, quality signals, and compatibility:

### Tier 1: Incorporate Next

1. **[ckan-mcp-server (ondata)](https://github.com/ondata/ckan-mcp-server)** — Unlocks data.gov (250,000+ datasets), data.gov.uk, and hundreds of international CKAN portals. Single integration, massive coverage expansion.

2. **[census-mcp (official)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp)** — Official Census Bureau server. ACS data is foundational for almost all civic analysis. Maintained by the agency itself.

3. **[us-gov-open-data-mcp](https://github.com/lzinga/us-gov-open-data-mcp)** — 36+ APIs, 188+ tools. Covers EPA, NOAA, FDA, SEC, BLS, and more in a single server. Modular loading lets users enable only the APIs they need.

### Tier 2: High Value, More Specialized

4. **[govinfo-mcp (official)](https://www.govinfo.gov/features/mcp-public-preview)** — Official GPO server. Congressional Record, Federal Register, and CFR are essential for legislative and regulatory research.

5. **[legiscan-mcp](https://github.com/sh-patterson/legiscan-mcp)** — State legislation tracking across all 50 states + Congress. Valuable for policy researchers and journalists.

6. **[fred-mcp-server](https://github.com/stefanoamorelli/fred-mcp-server)** — 800,000+ economic time series. Foundational for any analysis touching on economic trends.

### Tier 3: Watch and Evaluate

7. **[datagouv-mcp (official)](https://github.com/datagouv/datagouv-mcp)** — Official French government server. Signals that government-maintained MCP servers are becoming a global pattern.

8. **[mimilabs](https://www.mimilabs.ai/mcp)** — 50+ healthcare datasets. Valuable for health equity research.

9. **International data servers** — Spain (datos-gob-es), Sweden (kolada), Brazil (ibge), Japan (e-stat) all have mature implementations. Worth including as civic-ai-tools expands internationally.

### Integration Notes

- Most servers use **stdio transport only** — they work with Claude Code, Cursor, and VS Code Copilot out of the box. Only socrata-mcp-server and datagouv-mcp offer HTTP transport for web applications.
- Adding a new server to civic-ai-tools requires: (1) adding it to `claude_desktop_config.json`, (2) writing a skill guidance doc in `docs/skills/`, and (3) testing with representative queries.
- The **us-gov-open-data-mcp** server's modular loading pattern is worth studying — it lets users enable only the APIs they need, avoiding tool overload.
- **Two official U.S. federal agencies** (Census Bureau, GPO) and **two national governments** (France, India) now maintain MCP servers. This is a strong legitimacy signal for the ecosystem.

---

## Adding a Server

Know of a civic data MCP server not listed here? Open an [issue](https://github.com/npstorey/civic-ai-tools/issues) or submit a pull request.

## Transport Types

- **stdio** — Runs locally as a subprocess. Used by Claude Code, Cursor, and VS Code Copilot.
- **HTTP** — Runs as a web service. Used by web applications (e.g., [civicaitools.org](https://civicaitools.org)).
- **SSE** — Server-Sent Events transport. Older MCP transport, being superseded by HTTP.
