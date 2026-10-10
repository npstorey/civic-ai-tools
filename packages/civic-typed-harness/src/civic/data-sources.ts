// Civic data-source population (CIVIC layer) — the package's
// `buildDataSources`, `resolveToolSource` and `DataSourceOptions`, under the
// names and signatures they had when they lived in capture/data-sources.ts.
//
// The seam (civic-ai-tools#244 P2): capture/data-sources.ts walks the calls
// and the trace and takes every civic input as a parameter; this module
// supplies the civic defaults — `civicToolSourceResolver`,
// `CIVIC_SOURCE_REGISTRY`, `FALLBACK_SOURCE_ID` and the format group's
// `isDatasetKeyedSource` — wherever the caller leaves one out.

import {
  buildDataSourcesWith,
  resolveToolSourceWith,
  type DataSourceEntry,
  type ToolCallSummary,
  type TraceSpan,
} from '../capture/data-sources.ts';
import {
  CIVIC_SOURCE_REGISTRY,
  FALLBACK_SOURCE_ID,
  civicToolSourceResolver,
  isDatasetKeyedSource,
  type CivicSourceRegistry,
  type ToolSourceResolver,
} from '../format/sources.ts';

// The public surface capture/data-sources.ts carried before the seam,
// re-exported so the package entry exports the same names from here.
export type { DataSourceEntry, ToolCallSummary } from '../capture/data-sources.ts';

/** Optional knobs for `resolveToolSource` / `buildDataSources`. Defaults are
 *  the civic demo values. */
export interface DataSourceOptions {
  /** Tool-name → source-id resolver (fallback when a span carries no
   *  `mcp.source` attribute). Default: the civic map. */
  resolver?: ToolSourceResolver;
  /** Source registry driving catalog types, endpoints, and the
   *  dataset-keyed vs aggregate split. Default: the civic registry. */
  registry?: CivicSourceRegistry;
  /** Source id for calls neither the trace nor the resolver can identify.
   *  Default `socrata` (pre-M9.1 packages predate source tagging). */
  fallbackSourceId?: string;
}

/**
 * Resolve the MCP source for a tool call. Prefers the `mcp.source` attribute
 * recorded on the matching `mcp_tool_call` span (the trace is the source of
 * truth); falls back to the resolver's static mapping for packages written
 * before source tagging or callers that ship an empty trace.
 *
 * Tool calls are paired to spans by index — the reference capture emits one
 * span per call in order, so positional matching is exact in the normal
 * flow. When the counts diverge, the static resolver still identifies the
 * source.
 */
export function resolveToolSource(
  toolCall: ToolCallSummary,
  span: TraceSpan | undefined,
  resolver: ToolSourceResolver = civicToolSourceResolver,
  fallbackSourceId: string = FALLBACK_SOURCE_ID,
): string {
  return resolveToolSourceWith(toolCall, span, resolver, fallbackSourceId);
}

/**
 * Build the per-source evidence-package `dataSources` array.
 *
 * Dataset-keyed sources (Socrata) contribute one entry per unique
 * `dataset_id` observed across tool calls that also carried a `portal`
 * argument; a dataset-keyed call that carried no portal contributes NO
 * entry. Aggregate sources (Data Commons, Boston OpenContext — registry
 * entries carrying `aggregatePortalUrl`) contribute a single entry when any
 * of their tool calls was made. Unknown source ids contribute no entry. Each
 * entry is tagged with `sourceId` so downstream consumers can distinguish
 * provenance. Emission order: the dataset-keyed entries (first-seen order),
 * then aggregate sources in registry insertion order — matching the
 * reference implementation.
 *
 * A call the producer recorded as FAILED (`ToolCallSummary.failed`) asserts
 * no access and contributes nothing on either branch; it keeps its position
 * in the walk, because calls are paired to spans by index. The walk itself,
 * and why each branch is shaped as it is, is `buildDataSourcesWith` in
 * capture/data-sources.ts.
 *
 * @param fallbackPortal DEPRECATED, and inert since 0.3.1: an entry states
 * the portal the call carried, never the run's. It stays third of five
 * positional parameters so existing callers keep compiling, and since 0.4.0
 * it also accepts `undefined`, which is what a caller that has stopped
 * consulting it should pass. Dropping it is a breaking change and waits for
 * a major.
 */
export function buildDataSources(
  toolCalls: ToolCallSummary[],
  trace: Record<string, unknown>,
  fallbackPortal: string | undefined,
  now: string,
  options: DataSourceOptions = {},
): DataSourceEntry[] {
  const resolver = options.resolver ?? civicToolSourceResolver;
  const registry = options.registry ?? CIVIC_SOURCE_REGISTRY;
  const fallbackSourceId = options.fallbackSourceId ?? FALLBACK_SOURCE_ID;
  return buildDataSourcesWith(toolCalls, trace, now, {
    resolver,
    registry,
    fallbackSourceId,
    isDatasetKeyed: (sourceId) => isDatasetKeyedSource(sourceId, registry),
  });
}
