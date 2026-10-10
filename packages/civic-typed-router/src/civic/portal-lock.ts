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

import type { FunctionToolSchema } from '../core/types.ts';

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

export function lockedSearch(base: FunctionToolSchema, lockedPortal: string): FunctionToolSchema {
  return {
    ...base,
    function: {
      ...base.function,
      description: `Search the Socrata portal this instance's MCP server is configured for, returning matching datasets with identifiers that "fetch" accepts.

Returns, per hit: an "id" of the form dataset:<portal>:<dataset_id>, the title, the portal URL, a description snippet, and — where the dataset allows it — its column list and a few preview rows.

WHICH TOOL TO USE:
- This tool searches ONE portal: the one the server is configured with. It takes no portal argument.
- This instance queries one Socrata portal only, ${lockedPortal}. To search its catalog by name, get_data with { "type": "catalog", "query": "..." } also works. No other Socrata portal can be queried here.`,
    },
  };
}

export function lockedFetch(base: FunctionToolSchema, lockedPortal: string): FunctionToolSchema {
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
            description: `Identifier returned by the search tool, e.g. "dataset:${lockedPortal}:<dataset-id>"`,
          },
        },
      },
    },
  };
}

/**
 * The section a locked instance appends to the composed prompt.
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
export function portalLockSection(lockedPortal: string, bostonOffered: boolean): string {
  const others = bostonOffered
    ? 'the other data sources described above (Data Commons, and Boston OpenContext for Boston) are separate, remain available, and keep their own scope'
    : 'the other data source described above (Data Commons) is separate, remains available, and keeps its own scope';
  return `## ONE SOCRATA PORTAL ONLY

This instance answers questions against one Socrata portal only: ${lockedPortal}. Anything above that describes querying other Socrata portals (any portal being reachable with get_data, naming patterns for other cities' portals, the tables of other portals and their datasets) does not apply on this instance:
- get_data reaches ${lockedPortal} only. Leave its portal argument out; a call naming any other portal is refused and returns no data.
- fetch accepts identifiers and URLs on ${lockedPortal} only; one naming any other portal is refused.
- search covers the portal the data server is configured for.

If a question asks for Socrata data about a place ${lockedPortal} does not cover, say so plainly instead of answering from another Socrata portal. This limit applies to Socrata portals only; ${others}.`;
}
