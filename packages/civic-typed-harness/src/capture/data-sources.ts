// Data-source population (CAPTURE group) — walks the trace's `mcp_tool_call`
// spans plus the caller-supplied tool-call summary to produce one
// `dataSources` entry per (source, datasetId) tuple. Relocated from
// civic-ai-tools-website `src/lib/evidence/data-sources.ts:78–185` per the S2
// brief §1, with two changes:
//   - The tool-name → source-id resolver is a CALLER-SUPPLIED input (the
//     app's MCP registry stays app-side); `civicToolSourceResolver` is the
//     exported civic default.
//   - The per-source coordinates (catalog types, endpoints) come from the
//     format-extension group's source registry instead of module constants —
//     which sources are dataset-keyed vs aggregate is registry-driven.
//
// `DataSourceEntry` is produce-core's envelope input shape — the harness
// populates it, never redefines it.

import type { DataSourceEntry } from '@typedstandards/produce-core';
import {
  CIVIC_SOURCE_REGISTRY,
  FALLBACK_SOURCE_ID,
  civicToolSourceResolver,
  isDatasetKeyedSource,
  type CivicSourceRegistry,
  type ToolSourceResolver,
} from '../format/sources.ts';

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

interface TraceSpan {
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

  const toolSpans = getToolSpans(trace);
  const datasetKeyed = new Map<string, Map<string, { portalUrl: string; datasetId: string }>>();
  const aggregateAccessed = new Set<string>();

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    // A call the producer recorded as rejected reached no data, so it mints
    // no entry on either branch below. The walk keeps its index rather than
    // filtering the list: `resolveToolSource` pairs a call to `toolSpans[i]`,
    // and a filtered list would shift every later call onto the wrong span.
    if (tc.failed) continue;
    const source = resolveToolSource(tc, toolSpans[i], resolver, fallbackSourceId);
    if (isDatasetKeyedSource(source, registry)) {
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
