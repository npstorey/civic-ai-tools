// The Google Data Commons source: its tool schemas, its guidance block and the
// embedded Data Commons guidance.
//
// Moved from the reference website at 3a0c894: the schemas from
// `src/lib/mcp/tools.ts:150-264`, the guidance from
// `src/lib/mcp/data-commons-skill.ts:21-131`, and the registry entry's text
// from `src/lib/mcp/socrata-skill.ts:610-619`.
//
// The guidance names the instance's publication host. The website read it
// from its environment when the module loaded; here it is the consumer's
// input (`CivicGuidanceContext.publicationHost`), and the text is built per
// call. With no host, the mention is left out, as before.

import type { FunctionToolSchema } from '../core/types.ts';
import type { CivicGuidanceContext, CivicManifestEntry } from './context.ts';
import {
  DATA_COMMONS_ADDRESS_VARIABLE,
  DATA_COMMONS_DEFAULT_ADDRESS,
  DATA_COMMONS_KEY_VARIABLE,
} from './env.ts';

// --- Google Data Commons MCP (US demographic + federal statistical data) ---
// Two-tool surface: discover variables/topics with `search_indicators`, then
// fetch observed values with `get_observations`. Tools hit the hosted
// endpoint at https://api.datacommons.org/mcp. Full aggregation-semantics
// guidance (variable DCIDs, place hierarchies, vintage, margins of error) is
// a M9.2 concern and lives in the skill prompt, not the tool descriptions.
export const DATA_COMMONS_TOOLS: FunctionToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'search_indicators',
      description: `Discover statistical variables and topics available in Google Data Commons — the knowledge graph aggregating US Census Bureau (ACS, Decennial), BLS, CDC, Department of Education, EPA, and many international statistical sources.

Use this first when the user asks for demographic, economic, health, education, or environmental statistics and you don't already know the exact variable DCID. The tool returns candidate variable DCIDs that you then pass to get_observations.

IMPORTANT: Data Commons uses DCIDs (Data Commons identifiers) rather than raw Census field names. Always discover the variable DCID via search_indicators before calling get_observations — guessing the DCID silently returns wrong data.

Examples:
- { "query": "median household income", "places": ["geoId/3604600637"] }  // search near a NYC census tract
- { "query": "poverty rate", "parent_place": "geoId/36061" }  // search indicators scoped to New York County
- { "query": "asthma prevalence adults" }  // free-text topic search`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search query (e.g., "median household income", "poverty rate", "asthma prevalence")',
          },
          places: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of place DCIDs to scope the search to — the tool returns variables that have observations for those places.',
          },
          parent_place: {
            type: 'string',
            description: 'Optional parent place DCID — the tool returns variables that cover children of this place.',
          },
          per_search_limit: {
            type: 'number',
            description: 'Max results per category (default: 10)',
          },
          include_topics: {
            type: 'boolean',
            description: 'Include topic-level results alongside individual variables (default: true)',
          },
          maybe_bilateral: {
            type: 'boolean',
            description: 'Include bilateral (two-place) variables such as trade flows (default: false)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_observations',
      description: `Fetch statistical observations for a Data Commons variable at a specified place and time.

Requires a variable_dcid (discovered via search_indicators) and a place_dcid. Common place DCID patterns:
- Country: "country/USA"
- State: "geoId/36" (NY)
- County: "geoId/36061" (New York County)
- Census Tract: "geoId/36061013700" (state + county + tract FIPS)
- ZCTA: "zip/10001"

Use child_place_type to fetch observations for all children of a place at a given geography level (e.g., all tracts within a county).

CRITICAL: Data Commons returns wrong data silently if you pick the wrong variable, time range, or place type. Always prefer the latest vintage unless the user explicitly asks for a historical series. Cite the variable DCID and observation date in your summary.

Examples:
- Latest median household income for a NYC census tract:
  { "variable_dcid": "Median_Income_Household", "place_dcid": "geoId/36061013700" }
- All tracts in New York County (Manhattan):
  { "variable_dcid": "Median_Income_Household", "place_dcid": "geoId/36061", "child_place_type": "CensusTract" }
- Historical range:
  { "variable_dcid": "Count_Person", "place_dcid": "country/USA", "date_range_start": "2015", "date_range_end": "2023" }`,
      parameters: {
        type: 'object',
        properties: {
          variable_dcid: {
            type: 'string',
            description: 'Data Commons identifier for the statistical variable (e.g., "Median_Income_Household"). Discover via search_indicators.',
          },
          place_dcid: {
            type: 'string',
            description: 'Data Commons identifier for the place (e.g., "geoId/36061" for New York County, "country/USA", "zip/10001")',
          },
          child_place_type: {
            type: 'string',
            description: 'Optional child geography to enumerate (e.g., "CensusTract", "County", "State"). Returns observations for every child of place_dcid at this level.',
          },
          source_override: {
            type: 'string',
            description: 'Optional override for the upstream data source when multiple sources provide the same variable.',
          },
          date: {
            type: 'string',
            description: 'Specific observation date (default: "LATEST"). Use ISO year or YYYY-MM format.',
          },
          date_range_start: {
            type: 'string',
            description: 'Start of a date range query (inclusive). Use with date_range_end instead of date.',
          },
          date_range_end: {
            type: 'string',
            description: 'End of a date range query (inclusive).',
          },
        },
        required: ['variable_dcid', 'place_dcid'],
      },
    },
  },
];

/** The routing list (`src/lib/mcp/registry.ts:54`). */
export const DATA_COMMONS_TOOL_NAMES: readonly string[] = ['search_indicators', 'get_observations'];

/** The embedded Data Commons guidance, naming `publicationHost` when it is
 *  non-empty. The source of truth is the hub's `docs/skills/data-commons.md`;
 *  this is the website's hand-synced copy at 3a0c894. */
export function dataCommonsSkill(publicationHost: string | null): string {
  return `
# Data Commons Companion Skill — Base Guidance

Universal guidance for querying federal and international statistical data through the Google Data Commons MCP server.

## Purpose and when to use

Data Commons is a unified knowledge graph of aggregated statistics from authoritative sources: U.S. Census Bureau (ACS, Decennial), BLS, CDC, Department of Education, EPA, and many international statistical agencies. Use it for demographic, labor, health, education, and environment indicators — anything that answers "how many people / what share / what rate" for a place and a time.

- **Use Data Commons when** the question needs an ACS / Decennial / BLS / CDC / NCES / EPA figure with an auditable source and vintage.
- **Use Socrata when** the question is about city operational data (311, permits, crime, inspections, licenses, payroll, violations) or data that changes daily.
- **Use both when** equity questions need operational data joined against demographic context. See *Cross-source decision logic* below.

## Two-tool workflow

Data Commons exposes two tools:

| Tool | Purpose |
|------|---------|
| search_indicators | Discover the variable DCID matching a natural-language request for a place |
| get_observations | Retrieve actual values for a variable DCID at a place DCID (with an optional date range) |

**The default workflow is two-step: search first, then fetch.** Do not skip search_indicators. Data Commons has hundreds of thousands of statistical variables with precise, non-obvious names, and guessing a DCID burns tool calls on empty responses.

### Worked example

User: *"What was the median household income for Manhattan?"*

1. Call search_indicators with "median household income" and place DCID geoId/36061 (NY County = Manhattan). The response includes candidate variable DCIDs — typically Median_Income_Household and close relatives.
2. Call get_observations with that variable DCID and place DCID. The response is observations from ACS 5-Year Estimates.
3. Report the figure with source (ACS 5-Year Estimates) and vintage (e.g., 2020-2024).

Echo the DCID you picked back to the user so variable-selection mistakes get caught before they propagate.

## DCID patterns

Every place and every statistical variable in Data Commons has a **DCID** (Data Commons identifier). Two families matter most.

### Place DCIDs

| Pattern | Example | Meaning |
|---------|---------|---------|
| country/USA | country/USA | Country |
| geoId/XX | geoId/36 | US state (2-digit FIPS — 36 = New York) |
| geoId/XXXXX | geoId/36061 | US county (5-digit FIPS — 36061 = NY County / Manhattan) |
| geoId/XXXXXXX | geoId/3651000 | US city or incorporated place (7-digit FIPS — 3651000 = New York City) |
| geoId/<11-digit FIPS> | geoId/36061010100 | US census tract |
| geoId/<12-digit FIPS> | geoId/360610101001 | US census block group |
| zip/XXXXX | zip/10001 | ZIP Code Tabulation Area (ZCTA) |

Place hierarchies nest: block group → tract → county → state → country. Always pass the most specific DCID the question permits, and verify with the user whether "Manhattan" means the county (geoId/36061), the borough neighborhood, or a narrower slice before committing.

### Variable DCIDs

Variable DCIDs are mixed-case, loosely snake-case-ish, and often long and descriptive:

- Count_Person — total population
- Median_Income_Household — median household income
- Count_Person_BelowPovertyLevelInThePast12Months — persons below poverty (ACS count)
- Percent_Person_BelowPovertyLevelInThePast12Months — same, as a percent

Never invent a variable DCID from pattern-matching against similar-looking ones. Always discover it with search_indicators.

## Small-area coverage and limitations

Data Commons natively supports **US census tract**, **US census block group**, **ZCTA** (zip/XXXXX), county, state, and country place types.

Data Commons does **NOT** natively support NYC community districts, city council districts, Neighborhood Tabulation Areas, Chicago community areas, or arbitrary municipal boundaries beyond incorporated-place FIPS codes.

For civic analyses that need community-district or council-district resolution, the current pattern is to **work at the census tract level** and state the geography choice explicitly in the output. A tract-to-admin-geography crosswalk utility is planned as follow-up work and tracked separately; do not emulate it by guessing tract memberships.

## Aggregation semantics — silent wrong answers

**This is the single biggest risk of Data Commons queries.** Unlike a SoQL error that returns 0 rows or a 400 status, a wrong Data Commons query returns a plausible-looking but incorrect number. No exception, no warning, no hint that the variable, time range, or place type was off.

To prevent silent wrong answers:

1. **Verify the variable matches intent.** If the user asks for "poverty rate," return the percent variable (Percent_Person_BelowPovertyLevelInThePast12Months), not the raw count. When search_indicators returns multiple candidates, echo the top 2-3 and narrate your choice.
2. **Confirm the place type.** A "Manhattan" answer at county resolution is a different number than at block-group resolution. State which place type you queried: *"I queried at the county level (NY County, geoId/36061)."*
3. **Surface the vintage.** ACS releases annually; "2023" could be ACS 1-Year 2023 or ACS 5-Year 2019-2023 depending on availability. Put the vintage inline with the value, not in a footnote.
4. **Cite the source provider.** Every observation includes provenance — dataset, statistical agency, release. Surface these alongside the number. A figure without its source is not a Data Commons answer.
5. **Flag ambiguity.** If search_indicators returns several plausible variables and you cannot confidently narrow, stop and ask the user to clarify before returning a number.

## Cross-source decision logic

When a question touches both demographic data (Data Commons) and civic operational data (Socrata), plan the work before making tool calls:

1. **Split the question.** Which part is demographic, which is operational?
2. **Fetch operational data from Socrata** at the most specific geography it supports.
3. **Fetch demographic data from Data Commons** at census tract, or the nearest supported geography.
4. **Join on tract DCID**, not on mismatched place types. If a question cannot be answered at tract resolution (e.g., "by community district"), explain the geography gap rather than joining across mismatched units.
5. **Attribute each number to its source in the output.** The reader should see at a glance which figures came from Socrata and which from Data Commons.

If a question is genuinely ambiguous — "how many New Yorkers earn under $50k?" could be ACS or NYC payroll — ask one brief clarifying question before querying.

## Attribution and provenance

Attribute every Data Commons observation with the **source dataset** (e.g., "ACS 5-Year Estimates, 2020-2024"), the **statistical agency** (e.g., "U.S. Census Bureau"), and the **place DCID** and **variable DCID** used, so the answer is reproducible.

When a Data Commons call is part of an analysis published as a record package${publicationHost ? ` on ${publicationHost}` : ''}, the provenance graph captures the DCIDs, variable, vintage, and place type automatically. It emits Data Commons as a distinct prov:Agent alongside Socrata agents so a reader verifying the package can tell exactly which numbers came from which source.

## Empty or unrelated results

If search_indicators returns empty or obviously irrelevant variables, it usually means one of:

1. The variable exists but is suppressed at that resolution (ACS small-area non-publication)
2. The place DCID is wrong — re-check the FIPS pattern
3. The question cannot be answered from Data Commons and needs a different source (Socrata, a direct API, or web search)

Do not fabricate a value. Report the empty result, state the DCID and query you tried, and suggest a narrower geography or an alternative source.
`;
}

/** The Data Commons block of the composed prompt. */
export async function dataCommonsGuidanceText(ctx: CivicGuidanceContext): Promise<string> {
  const instructions = await ctx.fetchInstructions('data-commons');
  const instructionsBlock = instructions
    ? `# Data Commons server instructions (from initialize response)\n\n${instructions}`
    : '# Data Commons server instructions\n\n(The Data Commons MCP server did not advertise per-server instructions on initialize — composing with the embedded Data Commons skill only.)';
  return `${instructionsBlock}\n\n---\n\n${dataCommonsSkill(ctx.publicationHost)}`;
}

/**
 * The Google Data Commons source. Its `id` is the server's package name and
 * repository address as its PyPI metadata publishes them (`datacommons-mcp`,
 * homepage `https://github.com/datacommonsorg/agent-toolkit`), which declare
 * no MCP Registry name. Required, with Google's hosted endpoint as its
 * default address.
 */
export const DATA_COMMONS_ENTRY: CivicManifestEntry = {
  id: 'datacommons-mcp@https://github.com/datacommonsorg/agent-toolkit',
  alias: 'data_commons',
  sourceId: 'data-commons',
  displayName: 'Google Data Commons MCP Server',
  configuration: {
    addressVariable: DATA_COMMONS_ADDRESS_VARIABLE,
    keyVariable: DATA_COMMONS_KEY_VARIABLE,
    requirement: 'required',
    defaultAddress: DATA_COMMONS_DEFAULT_ADDRESS,
  },
  tools: DATA_COMMONS_TOOLS,
  toolNames: DATA_COMMONS_TOOL_NAMES,
  guidance: { fetchText: dataCommonsGuidanceText },
};
