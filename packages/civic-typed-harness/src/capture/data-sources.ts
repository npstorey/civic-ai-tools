// Data-source population (CAPTURE group) — walks the trace's `mcp_tool_call`
// spans plus the caller-supplied tool-call summary to produce one
// `dataSources` entry per (source, datasetId) tuple. Relocated from
// civic-ai-tools-website `src/lib/evidence/data-sources.ts:78–185` per the S2
// brief §1.
//
// THE SEAM (civic-ai-tools#244 P2). This module imports nothing civic: the
// tool-name → source-id resolver, the source registry (catalog types,
// endpoints, the dataset-keyed vs aggregate split), the fallback source id
// and the dataset-keyed fact all arrive as parameters, every one of them
// required. The civic defaults are applied one layer up, in
// `src/civic/data-sources.ts`, which exports the package's `buildDataSources`,
// `resolveToolSource` and `DataSourceOptions` under their existing names and
// signatures.
//
// `DataSourceEntry` is produce-core's envelope input shape — the harness
// populates it, never redefines it.

import type { DataSourceEntry } from '@typedstandards/produce-core';

export type { DataSourceEntry };

/** The caller-supplied per-tool-call summary the population walks alongside
 *  the trace. */
export interface ToolCallSummary {
  name: string;
  args: Record<string, unknown>;
  /** Did the producer record this call as REJECTED by the source? A call
   *  recorded as failed asserts no access: it contributes no dataset-keyed
   *  entry and marks no aggregate source accessed (see `buildDataSources`).
   *
   *  Optional, and absent is absent: a producer that records no outcome
   *  passes neither this nor `failureKind`, and gets exactly the entries it
   *  got before the fields existed. Absence means "not recorded as failed",
   *  never "succeeded". Added 0.4.0. */
  failed?: boolean;
  /** The producer's own label for why the call was rejected, carried so a
   *  caller can hand its record through unchanged. An open string with no
   *  normative vocabulary: the harness never interprets it, and this module
   *  never reads it. `failed` is the assertion and `failureKind` only a label
   *  on one — a summary carrying a kind but no `failed` is not treated as a
   *  rejection. Added 0.4.0. */
  failureKind?: string;
}

/** The span shape the resolver inspects. Exported for the civic layer's
 *  signatures; the package entry does not export it. */
export interface TraceSpan {
  name: string;
  attributes?: Array<{ key: string; value?: { stringValue?: string; intValue?: string; boolValue?: boolean } }>;
}

function getToolSpans(trace: Record<string, unknown>): TraceSpan[] {
  try {
    // Untyped walk over the caller's trace shape.
    const spans = (trace as any)?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans;
    if (!Array.isArray(spans)) return [];
    return (spans as TraceSpan[]).filter((s) => s.name === 'mcp_tool_call');
  } catch {
    return [];
  }
}

function spanAttr(span: TraceSpan | undefined, key: string): string | undefined {
  if (!span) return undefined;
  const attr = span.attributes?.find((a) => a.key === key);
  return attr?.value?.stringValue ?? attr?.value?.intValue ?? undefined;
}

/** Every input the population reads besides the calls and the trace, each
 *  one explicit. */
export interface DataSourceBuildConfig {
  /** Tool-name → source-id resolver (fallback when a span carries no
   *  `mcp.source` attribute). */
  resolver: (toolName: string) => string | undefined;
  /** Source id → catalog type and, for an aggregate source, the portal URL of
   *  its single entry. Insertion order is emission order. */
  registry: Record<string, { catalogType: string; aggregatePortalUrl?: string }>;
  /** Source id for calls neither the trace nor the resolver can identify. */
  fallbackSourceId: string;
  /** Is this source dataset-keyed (one entry per dataset)? Supplied by the
   *  caller, consistent with `registry`. */
  isDatasetKeyed: (sourceId: string) => boolean;
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
export function resolveToolSourceWith(
  toolCall: ToolCallSummary,
  span: TraceSpan | undefined,
  resolver: (toolName: string) => string | undefined,
  fallbackSourceId: string,
): string {
  return spanAttr(span, 'mcp.source')
    ?? resolver(toolCall.name)
    ?? fallbackSourceId;
}

/**
 * Build the per-source evidence-package `dataSources` array.
 *
 * Dataset-keyed sources (Socrata) contribute one entry per unique
 * `dataset_id` observed across tool calls that also carried a `portal`
 * argument; a dataset-keyed call that carried no portal contributes NO
 * entry (the loop body says why). Aggregate sources (Data Commons,
 * Boston OpenContext — registry entries carrying `aggregatePortalUrl`)
 * contribute a single entry when any of their tool calls was made. Unknown
 * source ids contribute no entry. Each entry is tagged with `sourceId` so
 * downstream consumers can distinguish provenance. Emission order: the
 * dataset-keyed entries (first-seen order), then aggregate sources in
 * registry insertion order — matching the reference implementation.
 *
 * A call the producer recorded as FAILED (`ToolCallSummary.failed`) asserts
 * no access and contributes nothing on either branch: no dataset-keyed entry
 * for a dataset it never read, and no accessed-marking of its aggregate
 * source. It keeps its POSITION in the walk, because calls are paired to
 * spans by index. The call is still on the PROV-O graph's tool-call
 * activities and in the caller's own `queries[]` — what it is not is an
 * assertion, inside signed bytes, that a source was reached at a timestamp.
 *
 * The run's portal is not a parameter: an entry states the portal the call
 * carried, never the run's (the civic layer's `buildDataSources` keeps its
 * inert `fallbackPortal` positional for existing callers).
 */
export function buildDataSourcesWith(
  toolCalls: ToolCallSummary[],
  trace: Record<string, unknown>,
  now: string,
  config: DataSourceBuildConfig,
): DataSourceEntry[] {
  const { resolver, registry, fallbackSourceId } = config;

  const toolSpans = getToolSpans(trace);
  const datasetKeyed = new Map<string, Map<string, { portalUrl: string; datasetId: string }>>();
  const aggregateAccessed = new Set<string>();

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    // A call the producer recorded as rejected reached no data, so it mints
    // no entry on either branch below. The walk keeps its index rather than
    // filtering the list: `resolveToolSourceWith` pairs a call to `toolSpans[i]`,
    // and a filtered list would shift every later call onto the wrong span.
    if (tc.failed) continue;
    const source = resolveToolSourceWith(tc, toolSpans[i], resolver, fallbackSourceId);
    if (config.isDatasetKeyed(source)) {
      const datasetId = tc.args.dataset_id as string | undefined;
      const portal = tc.args.portal as string | undefined;
      // An entry is minted only from what the call carried: a dataset id AND
      // a portal. A dataset-keyed call with a dataset id and no portal
      // contributes no entry. `DataSourceEntry.portalUrl` is a required
      // string (produce-core), so "an entry with no portal" is not a shape
      // this package can emit; and substituting the run's portal
      // (`fallbackPortal`, before 0.3.1) attributed the call to a portal it
      // never addressed. Omission is the honest shape — the call is still on
      // the PROV-O graph's tool-call activities, stated without a portal.
      // The branch is latent for the reference producer, whose loop injects
      // the run portal into `get_data` arguments before the record is built
      // (run-tool-loop.ts:799 at the time of writing); any caller whose
      // summary carries `dataset_id` without `portal` reaches it.
      if (datasetId && portal) {
        let byDataset = datasetKeyed.get(source);
        if (!byDataset) {
          byDataset = new Map();
          datasetKeyed.set(source, byDataset);
        }
        if (!byDataset.has(datasetId)) {
          byDataset.set(datasetId, { portalUrl: `https://${portal}`, datasetId });
        }
      }
    } else if (registry[source]?.aggregatePortalUrl !== undefined) {
      aggregateAccessed.add(source);
    }
    // Unknown sources contribute no dataSources entry (their provenance is
    // still visible on the PROV-O graph's tool-call activities).
  }

  const entries: DataSourceEntry[] = [];
  for (const [sourceId, info] of Object.entries(registry)) {
    if (info.aggregatePortalUrl === undefined) {
      const byDataset = datasetKeyed.get(sourceId);
      if (!byDataset) continue;
      for (const { portalUrl, datasetId } of byDataset.values()) {
        entries.push({
          sourceId,
          catalogType: info.catalogType,
          portalUrl,
          datasetId,
          datasetUrl: `${portalUrl}/d/${datasetId}`,
          accessTimestamp: now,
        });
      }
    } else if (aggregateAccessed.has(sourceId)) {
      entries.push({
        sourceId,
        catalogType: info.catalogType,
        portalUrl: info.aggregatePortalUrl,
        accessTimestamp: now,
      });
    }
  }
  return entries;
}
