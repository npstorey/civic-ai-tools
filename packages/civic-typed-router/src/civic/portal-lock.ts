// The one-portal lock: the Socrata tool rewrites and the section a locked
// instance appends to the composed prompt.
//
// Moved from the reference website at 3a0c894: the rewrites from
// `src/lib/mcp/tools.ts:464-565` and the appended section from
// `src/lib/mcp/socrata-skill.ts:685-721`.
//
// Under the lock the website refuses a `get_data` call naming another portal
// and a `fetch` whose identifier names one. The text below is the other half:
// the model is not invited to make those calls. The schemas' names and shapes
// do not change; only the three Socrata descriptions and `get_data`'s `portal`
// property differ. No portal hostname is written here: the locked portal is
// the instance's configuration, interpolated at call time.

import { BARE_VIEW } from '../core/alias.ts';
import type { FunctionToolSchema, SourceView } from '../core/types.ts';

/** A Socrata tool's name in `view`. */
const socrataName = (view: SourceView, name: string): string => view.toolName('socrata', name);

type ParametersWithProperties = { properties: Record<string, unknown> } & Record<string, unknown>;

/** `get_data` rewritten for one portal. `base` is the unlocked schema. */
export function lockedGetData(base: FunctionToolSchema, lockedPortal: string): FunctionToolSchema {
  const baseParameters = base.function.parameters as ParametersWithProperties;
  return {
    ...base,
    function: {
      ...base.function,
      description: `Unified Socrata open data access tool for ${lockedPortal}, the one Socrata portal this instance serves. Supports multiple operation types:
- catalog: Search ${lockedPortal}'s catalog for datasets matching a query
- metadata: Get detailed metadata about a specific dataset
- query: Execute a SoQL query against a dataset to fetch and filter data
- metrics: Get row count, view count, last-updated timestamps for a dataset

IMPORTANT TIPS:
1. For type=metadata and type=metrics, pass the dataset ID in "dataset_id"
2. For type=query, ALWAYS start by fetching a sample with no WHERE clause to see actual column values
3. Field values are case-sensitive - fetch sample data first to see exact formats
4. Omit "portal": every call goes to ${lockedPortal}. A call naming any other portal is refused and returns no data.

Examples:
- Search catalog: { "type": "catalog", "query": "311 complaints" }
- Get metadata: { "type": "metadata", "dataset_id": "<dataset-id>" }
- Get metrics: { "type": "metrics", "dataset_id": "<dataset-id>" }
- Fetch sample data first: { "type": "query", "dataset_id": "<dataset-id>", "limit": 5 }
- Query with filter: { "type": "query", "dataset_id": "<dataset-id>", "select": "<column>, COUNT(*) as count", "group": "<column>", "order": "count DESC", "limit": 10 }`,
      parameters: {
        ...baseParameters,
        properties: {
          ...baseParameters.properties,
          portal: {
            type: 'string',
            enum: [lockedPortal],
            description: `The one Socrata portal this instance serves, ${lockedPortal}. Optional: omitted, the call goes there anyway. Any other value is refused.`,
          },
        },
      },
    },
  };
}

/** `search` rewritten for one portal, every tool named through `view`.
 *  `base` is the unlocked schema in the same view. */
export function lockedSearch(base: FunctionToolSchema, lockedPortal: string, view: SourceView = BARE_VIEW): FunctionToolSchema {
  return {
    ...base,
    function: {
      ...base.function,
      description: `Search the Socrata portal this instance's MCP server is configured for, returning matching datasets with identifiers that "${socrataName(view, 'fetch')}" accepts.

Returns, per hit: an "id" of the form dataset:<portal>:<dataset_id>, the title, the portal URL, a description snippet, and — where the dataset allows it — its column list and a few preview rows.

WHICH TOOL TO USE:
- This tool searches ONE portal: the one the server is configured with. It takes no portal argument.
- This instance queries one Socrata portal only, ${lockedPortal}. To search its catalog by name, ${socrataName(view, 'get_data')} with { "type": "catalog", "query": "..." } also works. No other Socrata portal can be queried here.`,
    },
  };
}

/** `fetch` rewritten for one portal, every tool named through `view`.
 *  `base` is the unlocked schema in the same view. */
export function lockedFetch(base: FunctionToolSchema, lockedPortal: string, view: SourceView = BARE_VIEW): FunctionToolSchema {
  const baseParameters = base.function.parameters as ParametersWithProperties;
  return {
    ...base,
    function: {
      ...base.function,
      description: `${base.function.description}

This instance queries one Socrata portal only, ${lockedPortal}: an identifier or URL naming any other portal is refused and returns no data.`,
      parameters: {
        ...baseParameters,
        properties: {
          ...baseParameters.properties,
          // The unlocked example names a real portal; this one names the portal served.
          id: {
            type: 'string',
            description: `Identifier returned by the ${socrataName(view, 'search')} tool, e.g. "dataset:${lockedPortal}:<dataset-id>"`,
          },
        },
      },
    },
  };
}

/**
 * The three Socrata schemas of `tools` (the Socrata entry's, in `view`)
 * rewritten for one portal; any other tool is returned as it is. Throws when
 * one of the three is missing.
 */
export function lockSocrataTools(
  tools: readonly FunctionToolSchema[],
  lockedPortal: string,
  view: SourceView = BARE_VIEW,
): FunctionToolSchema[] {
  const find = (name: string): FunctionToolSchema => {
    const exposed = socrataName(view, name);
    const tool = tools.find((t) => t.type === 'function' && t.function.name === exposed);
    if (!tool) throw new Error(`mcpToolsFor: no Socrata tool named ${name}`);
    return tool;
  };
  const locked = [
    lockedGetData(find('get_data'), lockedPortal),
    lockedSearch(find('search'), lockedPortal, view),
    lockedFetch(find('fetch'), lockedPortal, view),
  ];
  const byName = new Map(locked.map((tool) => [tool.function.name, tool]));
  return tools.map((tool) => (tool.type === 'function' && byName.get(tool.function.name)) || tool);
}

/**
 * The section a locked instance appends to the composed prompt, naming the
 * other sources the run is offered (`others`, each as the lock names it, in
 * order) and every Socrata tool through `view`.
 *
 * A superseding section rather than an edit: several sentences that reach the
 * model are false under the lock (the fallback's "Any Socrata open data
 * portal can be queried with get_data", the portal tables, the preamble's
 * portal list), yet stay true of every unlocked instance, and the live skill
 * text the Socrata server serves says the same things from outside this
 * package. So the lock adds one section, last, naming what no longer applies.
 *
 * The closing sentence names the other sources the instance offers: Data
 * Commons, and Boston OpenContext only where it is offered.
 */
export function portalLockSectionFor(lockedPortal: string, others: readonly string[], view: SourceView = BARE_VIEW): string {
  const n = (name: string): string => socrataName(view, name);
  const listed =
    others.length <= 1 ? others.join('') : `${others.slice(0, -1).join(', ')}, and ${others[others.length - 1]}`;
  const remainder =
    others.length === 0
      ? ''
      : others.length === 1
        ? `; the other data source described above (${listed}) is separate, remains available, and keeps its own scope`
        : `; the other data sources described above (${listed}) are separate, remain available, and keep their own scope`;
  return `## ONE SOCRATA PORTAL ONLY

This instance answers questions against one Socrata portal only: ${lockedPortal}. Anything above that describes querying other Socrata portals (any portal being reachable with ${n('get_data')}, naming patterns for other cities' portals, the tables of other portals and their datasets) does not apply on this instance:
- ${n('get_data')} reaches ${lockedPortal} only. Leave its portal argument out; a call naming any other portal is refused and returns no data.
- ${n('fetch')} accepts identifiers and URLs on ${lockedPortal} only; one naming any other portal is refused.
- ${n('search')} covers the portal the data server is configured for.

If a question asks for Socrata data about a place ${lockedPortal} does not cover, say so plainly instead of answering from another Socrata portal. This limit applies to Socrata portals only${remainder}.`;
}

/** The section in the bare view, for the civic sources: Data Commons, and
 *  Boston OpenContext where it is offered. */
export function portalLockSection(lockedPortal: string, bostonOffered: boolean): string {
  return portalLockSectionFor(
    lockedPortal,
    bostonOffered ? ['Data Commons', 'Boston OpenContext for Boston'] : ['Data Commons'],
  );
}
