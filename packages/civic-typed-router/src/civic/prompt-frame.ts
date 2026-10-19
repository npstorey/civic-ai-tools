// The civic text around the source blocks: the intro, the cross-source
// preamble and the outro; and the directory's heading and paragraph. Core
// joins them; every sentence is here.
//
// Moved from the reference website at 3a0c894,
// `src/lib/mcp/socrata-skill.ts:462-590`.
//
// The preamble and the outro are composed from the offered entries (F4): each
// entry brings its own preamble entry and citation, and an entry that brings
// none (a fourth source) gets them composed from its `displayName` and
// `description`. The three civic sources' texts below are kept byte for byte,
// with every tool they name going through the view.

import { BARE_VIEW } from '../core/alias.ts';
import type { DirectoryFrame } from '../core/directory.ts';
import type { SourceView } from '../core/types.ts';

/** The civic source ids, as the website's registry keys them. */
export type SourceId = 'socrata' | 'data-commons' | 'boston-opencontext';

/** Every civic source, in the order the prompt names them. */
export const ALL_SOURCES: readonly SourceId[] = ['socrata', 'data-commons', 'boston-opencontext'];

/** A `Tools:` list: each name through the view, comma-separated. */
const toolsList = (view: SourceView, sourceId: string, names: readonly string[]): string =>
  names.map((name) => view.toolName(sourceId, name)).join(', ');

/** Each civic source's numbered entry in the cross-source preamble, in a
 *  view. */
const PREAMBLE_ENTRIES: Record<SourceId, (view: SourceView) => string> = {
  socrata: (view) =>
    `**Socrata open data portals** — city operational data such as 311 requests, building permits, inspections, crime, housing violations, payroll, and licenses. Covers NYC, Chicago, SF, Seattle, LA, and hundreds of other portals — but not Boston. Tools: ${toolsList(view, 'socrata', ['get_data'])}.`,
  'data-commons': (view) =>
    `**Google Data Commons** — authoritative federal and international statistical data from the U.S. Census Bureau (ACS, Decennial), BLS, CDC, Department of Education, EPA, and other official agencies. Tools: ${toolsList(view, 'data-commons', ['search_indicators', 'get_observations'])}.`,
  'boston-opencontext': (view) =>
    `**Boston OpenContext** — the City of Boston's CKAN-native open-data MCP, fronting data.boston.gov. 311, permits, crime, inspections, property, elections, schools, parcels, and neighborhoods for Boston specifically. Tools: ${toolsList(view, 'boston-opencontext', ['ckan__search_datasets', 'ckan__get_dataset', 'ckan__query_data', 'ckan__get_schema', 'ckan__execute_sql', 'ckan__aggregate_data'])}.`,
};

/** A civic source's preamble entry (without its number), in `view`. */
export function civicPreambleEntry(sourceId: SourceId, view: SourceView = BARE_VIEW): string {
  return PREAMBLE_ENTRIES[sourceId](view);
}

/** The preamble's source-selection rules, in order; a rule that routes to a
 *  source is stated only when that source is offered. */
const PREAMBLE_RULES: ReadonlyArray<{ routesTo?: SourceId; text: string }> = [
  { routesTo: 'boston-opencontext', text: '- **Boston civic questions** → Boston OpenContext. Boston is not on Socrata.' },
  { routesTo: 'socrata', text: '- **Other-city civic questions** (NYC, Chicago, SF, Seattle, LA, ...) → Socrata.' },
  { routesTo: 'data-commons', text: '- **Demographics, poverty, income, education, health, labor, environment** for any geography → Data Commons.' },
  { text: '- **Multi-source equity questions** that join operational data against demographic context → plan a multi-step analysis, attribute each figure to its source, and mind geography alignment (Boston neighborhoods and city council districts are not standard census geographies — state the mismatch rather than silently imputing).' },
];

const SOURCE_COUNT_WORDS = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];

/** The count the preamble states: a word up to ten, then the numeral. */
export function sourceCountWord(count: number): string {
  return SOURCE_COUNT_WORDS[count] ?? String(count);
}

/** One source as the preamble and the outro name it. */
export interface PromptSource {
  readonly sourceId: string;
  /** Its preamble entry, without the number. */
  readonly preambleEntry: string;
  /** What the outro asks the model to cite for it. */
  readonly citation: string;
}

/**
 * The cross-source preamble for exactly these sources, in order: one numbered
 * entry per source, and the selection rules that route to a source listed.
 */
export function composePreamble(sources: readonly Pick<PromptSource, 'sourceId' | 'preambleEntry'>[]): string {
  const ids = sources.map((source) => source.sourceId);
  const entries = sources.map((source, i) => `${i + 1}. ${source.preambleEntry}`);
  const rules = PREAMBLE_RULES.filter((rule) => rule.routesTo === undefined || ids.includes(rule.routesTo)).map((rule) => rule.text);
  return `You have access to ${sourceCountWord(sources.length)} MCP data sources through the tools below.

${entries.join('\n')}

Source selection rules:
${rules.join('\n')}

See the Cross-source decision logic section in the Data Commons guidance below for the join pattern.`;
}

/**
 * The cross-source preamble for exactly these civic sources, in the bare
 * view: one numbered entry per source, and the selection rules that route to
 * a source listed. Every line it can produce is a line of
 * `CROSS_SOURCE_PREAMBLE` except the first, which states the count.
 */
export function crossSourcePreamble(sources: readonly SourceId[]): string {
  return composePreamble(
    sources.map((sourceId) => ({ sourceId, preambleEntry: `${PREAMBLE_ENTRIES[sourceId]?.(BARE_VIEW)}` })),
  );
}

/** The preamble with every source this codebase has — what an instance that
 *  configures every optional source sends. */
export const CROSS_SOURCE_PREAMBLE = crossSourcePreamble(ALL_SOURCES);

/** The opening block, stating today's date (`YYYY-MM-DD`, the consumer's). */
export const introFor = (today: string): string =>
  `You are a helpful assistant with access to civic and statistical data via MCP tools.

Today's date is ${today}. Always use this as the current date for interpreting relative time expressions like "last year" or "past two months."`;

/** What the outro asks the model to cite, per civic source. */
const OUTRO_CITATIONS: Record<SourceId, string> = {
  socrata: 'the dataset ID (for Socrata)',
  'data-commons': 'the variable DCID + source dataset (for Data Commons)',
  'boston-opencontext': 'the resource UUID + dataset title (for Boston OpenContext)',
};

/** A civic source's outro citation. */
export function civicCitation(sourceId: SourceId): string {
  return OUTRO_CITATIONS[sourceId];
}

/** The closing instruction, citing these, in order. */
export function composeOutro(citations: readonly string[]): string {
  const list =
    citations.length <= 2
      ? citations.join(' or ')
      : `${citations.slice(0, -1).join(', ')}, or ${citations[citations.length - 1]}`;
  return `When you get results, summarize clearly and cite ${list}.`;
}

/** The closing instruction, citing exactly these civic sources. */
export function outroFor(sources: readonly SourceId[]): string {
  return composeOutro(sources.map((sourceId) => OUTRO_CITATIONS[sourceId]));
}

// --- The directory (ADR-0037) ---------------------------------------------------

/** The heading above the directory's paragraph. */
export const DIRECTORY_HEADING = '## Data sources';

/** The directory's paragraph: R5's, with its one sentence about the load
 *  result stating where a loaded source's tools and guidance arrive (the
 *  next turn's tools, and this system prompt). The quote test of 2026-10-19
 *  measured this text as shape S2. */
export const DIRECTORY_PARAGRAPH =
  'The data sources below are available to you, but none of their tools are loaded yet. To use a source, call `load_source` with its alias; its tools are added for your next turn, and its guidance then appears in this system prompt. Load every source the question needs; you may call `load_source` more than once. If the question needs no data, answer without loading anything.';

/** The label before each directory line's freshness. */
export const DIRECTORY_FRESHNESS_LABEL = 'Freshness:';

/** The civic directory frame for `today` (`YYYY-MM-DD`): the same intro as
 *  the composed prompt, the heading and the paragraph. No outro. */
export function directoryFrameFor(today: string): DirectoryFrame {
  return {
    intro: introFor(today),
    heading: DIRECTORY_HEADING,
    paragraph: DIRECTORY_PARAGRAPH,
    freshnessLabel: DIRECTORY_FRESHNESS_LABEL,
  };
}
