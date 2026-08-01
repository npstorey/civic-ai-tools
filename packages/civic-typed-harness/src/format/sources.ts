// Civic data-source registry (FORMAT-EXTENSION group) — the source ids the
// civic vocabulary knows, their display names, catalog types, and endpoint
// coordinates, plus the default tool-name → source-id resolver and the
// display helpers. Relocated from civic-ai-tools-website:
//   - endpoint constants + display helpers: `src/lib/evidence/data-sources.ts:15–16, 41–76`
//   - agent titles/server URLs: `src/lib/evidence/provenance.ts:132–148`
//   - static tool→source map: `src/lib/mcp/operation-types.ts:21–33` (the
//     app's MCP registry itself stays app-side; this is the harness's civic
//     DEFAULT — callers supply their own resolver to add or replace sources).
//
// Endpoint URLs name the demo deployment's data plane, so the registry is a
// typed config input (config-not-constants, S2 brief §2) with the civic
// values as the exported default map.

import type { DataSourceEntry } from '@typedstandards/produce-core';

/** One known data source: identity, display, and endpoint coordinates. */
export interface CivicSourceInfo {
  /** Human-friendly display label (evidence detail page "Data sources"). */
  displayName: string;
  /** PROV agent `dcterms:title`, e.g. "Socrata MCP Server". */
  agentTitle: string;
  /** MCP endpoint URL — the PROV agent's `civic:serverUrl`. */
  serverUrl: string;
  /** `dataSources[].catalogType` value for entries from this source. */
  catalogType: string;
  /**
   * Portal URL for the single AGGREGATE `dataSources` entry emitted when this
   * source's query surface is not dataset-keyed (Data Commons's knowledge
   * graph, Boston OpenContext's CKAN DataStore). ABSENT for dataset-keyed
   * sources (Socrata), which emit one entry per dataset instead — presence of
   * this field is what routes a source down the aggregate path.
   */
  aggregatePortalUrl?: string;
}

/** A source registry: source id → coordinates. Insertion order is emission
 *  order for aggregate `dataSources` entries. */
export type CivicSourceRegistry = Record<string, CivicSourceInfo>;

/** The civic default registry — the three demo sources. */
export const CIVIC_SOURCE_REGISTRY: CivicSourceRegistry = {
  socrata: {
    displayName: 'Socrata',
    agentTitle: 'Socrata MCP Server',
    serverUrl: 'https://socrata-mcp.civicaitools.org',
    catalogType: 'socrata',
  },
  'data-commons': {
    displayName: 'Data Commons',
    agentTitle: 'Google Data Commons MCP Server',
    serverUrl: 'https://api.datacommons.org/mcp',
    catalogType: 'data-commons',
    aggregatePortalUrl: 'https://api.datacommons.org/mcp',
  },
  'boston-opencontext': {
    displayName: 'Boston OpenContext',
    agentTitle: 'Boston OpenContext MCP Server',
    serverUrl: 'https://data-mcp.boston.gov/mcp',
    catalogType: 'ckan',
    aggregatePortalUrl: 'https://data.boston.gov',
  },
};

/** The source id untagged/pre-M9.1 captures fall back to. Socrata was the
 *  only source when those packages were written. */
export const FALLBACK_SOURCE_ID = 'socrata';

/** Is this source dataset-keyed (one `dataSources` entry per dataset) rather
 *  than aggregate? Unknown ids are neither — they contribute no entry. */
export function isDatasetKeyedSource(
  sourceId: string,
  registry: CivicSourceRegistry = CIVIC_SOURCE_REGISTRY,
): boolean {
  const info = registry[sourceId];
  return info !== undefined && info.aggregatePortalUrl === undefined;
}

/**
 * Resolve an MCP tool name to a source id, or `undefined` when unknown.
 * The data-source population function (capture group) takes one of these as
 * a CALLER-SUPPLIED input; `civicToolSourceResolver` below is the civic
 * default. An instance wiring its own MCP layer supplies its own resolver —
 * the resolver is how the app-side MCP registry stays app-side.
 */
export type ToolSourceResolver = (toolName: string) => string | undefined;

/** Civic default tool-name → source-id map (mirrors the demo app's static
 *  MCP-layer map; used as a fallback when a trace span carries no
 *  `mcp.source` attribute). */
export const CIVIC_TOOL_SOURCE_MAP: Record<string, string> = {
  get_data: 'socrata',
  search: 'socrata',
  fetch: 'socrata',
  search_indicators: 'data-commons',
  get_observations: 'data-commons',
  ckan__search_datasets: 'boston-opencontext',
  ckan__get_dataset: 'boston-opencontext',
  ckan__query_data: 'boston-opencontext',
  ckan__get_schema: 'boston-opencontext',
  ckan__execute_sql: 'boston-opencontext',
  ckan__aggregate_data: 'boston-opencontext',
};

/** The civic default `ToolSourceResolver`. */
export const civicToolSourceResolver: ToolSourceResolver = (toolName) =>
  CIVIC_TOOL_SOURCE_MAP[toolName];

/** Human-friendly display label for a `sourceId`. Unknown ids fall back to a
 *  capitalised form of the raw id so new sources render sensibly before the
 *  registry is updated. Missing ids coerce to the fallback source (pre-M9.3
 *  packages have no `sourceId` on dataSources entries). */
export function displayNameForSource(
  sourceId: string | undefined | null,
  registry: CivicSourceRegistry = CIVIC_SOURCE_REGISTRY,
): string {
  const id = sourceId || FALLBACK_SOURCE_ID;
  return (
    registry[id]?.displayName
    ?? id
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

/** Format a `dataSources` array as a compact, de-duplicated summary string
 *  (middle-dot separated). Returns `null` when the array is empty or missing,
 *  letting callers render a fallback. */
export function formatDataSourcesSummary(
  entries: DataSourceEntry[] | undefined,
  registry: CivicSourceRegistry = CIVIC_SOURCE_REGISTRY,
): string | null {
  if (!entries || entries.length === 0) return null;
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const entry of entries) {
    const name = displayNameForSource(entry.sourceId, registry);
    if (seen.has(name)) continue;
    seen.add(name);
    ordered.push(name);
  }
  return ordered.join(' · ');
}
