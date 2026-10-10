// The civic text around the source blocks: the intro, the cross-source
// preamble and the outro. Core joins them; every sentence is here.
//
// Moved from the reference website at 3a0c894,
// `src/lib/mcp/socrata-skill.ts:462-590`.

/** The civic source ids, as the website's registry keys them. */
export type SourceId = 'socrata' | 'data-commons' | 'boston-opencontext';

/** Every civic source, in the order the prompt names them. */
export const ALL_SOURCES: readonly SourceId[] = ['socrata', 'data-commons', 'boston-opencontext'];

/** Each source's numbered entry in the cross-source preamble. */
const PREAMBLE_ENTRIES: Record<SourceId, string> = {
  socrata:
    '**Socrata open data portals** — city operational data such as 311 requests, building permits, inspections, crime, housing violations, payroll, and licenses. Covers NYC, Chicago, SF, Seattle, LA, and hundreds of other portals — but not Boston. Tools: get_data.',
  'data-commons':
    '**Google Data Commons** — authoritative federal and international statistical data from the U.S. Census Bureau (ACS, Decennial), BLS, CDC, Department of Education, EPA, and other official agencies. Tools: search_indicators, get_observations.',
  'boston-opencontext':
    "**Boston OpenContext** — the City of Boston's CKAN-native open-data MCP, fronting data.boston.gov. 311, permits, crime, inspections, property, elections, schools, parcels, and neighborhoods for Boston specifically. Tools: ckan__search_datasets, ckan__get_dataset, ckan__query_data, ckan__get_schema, ckan__execute_sql, ckan__aggregate_data.",
};

/** The preamble's source-selection rules, in order; a rule that routes to a
 *  source is stated only when that source is offered. */
const PREAMBLE_RULES: ReadonlyArray<{ routesTo?: SourceId; text: string }> = [
  { routesTo: 'boston-opencontext', text: '- **Boston civic questions** → Boston OpenContext. Boston is not on Socrata.' },
  { routesTo: 'socrata', text: '- **Other-city civic questions** (NYC, Chicago, SF, Seattle, LA, ...) → Socrata.' },
  { routesTo: 'data-commons', text: '- **Demographics, poverty, income, education, health, labor, environment** for any geography → Data Commons.' },
  { text: '- **Multi-source equity questions** that join operational data against demographic context → plan a multi-step analysis, attribute each figure to its source, and mind geography alignment (Boston neighborhoods and city council districts are not standard census geographies — state the mismatch rather than silently imputing).' },
];

const SOURCE_COUNT_WORDS = ['NO', 'ONE', 'TWO', 'THREE'];

/**
 * The cross-source preamble for exactly these sources: one numbered entry per
 * source, and the selection rules that route to a source listed. Every line it
 * can produce is a line of `CROSS_SOURCE_PREAMBLE` except the first, which
 * states the count.
 */
export function crossSourcePreamble(sources: readonly SourceId[]): string {
  const entries = sources.map((sourceId, i) => `${i + 1}. ${PREAMBLE_ENTRIES[sourceId]}`);
  const rules = PREAMBLE_RULES.filter((rule) => rule.routesTo === undefined || sources.includes(rule.routesTo)).map((rule) => rule.text);
  return `You have access to ${SOURCE_COUNT_WORDS[sources.length]} MCP data sources through the tools below.

${entries.join('\n')}

Source selection rules:
${rules.join('\n')}

See the Cross-source decision logic section in the Data Commons guidance below for the join pattern.`;
}

/** The preamble with every source this codebase has — what an instance that
 *  configures every optional source sends. */
export const CROSS_SOURCE_PREAMBLE = crossSourcePreamble(ALL_SOURCES);

/** The opening block, stating today's date (`YYYY-MM-DD`, the consumer's). */
export const introFor = (today: string): string =>
  `You are a helpful assistant with access to civic and statistical data via MCP tools.

Today's date is ${today}. Always use this as the current date for interpreting relative time expressions like "last year" or "past two months."`;

/** What the outro asks the model to cite, per source. */
const OUTRO_CITATIONS: Record<SourceId, string> = {
  socrata: 'the dataset ID (for Socrata)',
  'data-commons': 'the variable DCID + source dataset (for Data Commons)',
  'boston-opencontext': 'the resource UUID + dataset title (for Boston OpenContext)',
};

/** The closing instruction, citing exactly these sources. */
export function outroFor(sources: readonly SourceId[]): string {
  const citations = sources.map((sourceId) => OUTRO_CITATIONS[sourceId]);
  const list =
    citations.length <= 2
      ? citations.join(' or ')
      : `${citations.slice(0, -1).join(', ')}, or ${citations[citations.length - 1]}`;
  return `When you get results, summarize clearly and cite ${list}.`;
}
