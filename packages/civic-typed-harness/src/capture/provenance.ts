// Civic provenance builder (CAPTURE group) — walks an OTel trace and maps the
// analysis pipeline (LLM inference, MCP tool calls, data responses) to a
// W3C PROV-O JSON-LD graph. Relocated whole from civic-ai-tools-website
// `src/lib/evidence/provenance.ts:65–392` per the S2 brief §1, rebuilt on
// @typedstandards/produce-core's generic ProvGraph/ProvNode types and
// node/edge helpers. Every `civic:` term, urn scheme, and agent coordinate is
// imported from the format-extension group — this module WALKS, it does not
// define vocabulary (the package's internal module boundary).
//
// Config-not-constants: the platform-agent identity, the source-agent
// registry (server URLs), and the model-agent description are typed config
// inputs; `CIVICAITOOLS_PROVENANCE_CONFIG` is the demo default and
// reproduces the reference implementation's output byte-for-byte (property
// insertion order is preserved throughout — the legacy hash chain's byte
// contract).

import {
  makeProvGraph,
  makeEntityNode,
  makeActivityNode,
  makeAgentNode,
  provRef,
  provUsed,
  provWasGeneratedBy,
  provWasDerivedFrom,
  provWasAssociatedWith,
  xsdDateTime,
  type ProvGraph,
  type ProvNode,
  type ProvNodeRef,
} from '@typedstandards/produce-core';
import { hash } from './trace.ts';
import type { OTelTrace, OTelAttribute } from './trace.ts';
import {
  makeCivicProvContext,
  civicUrn,
  civicModelUrn,
  civicSourceAgentUrn,
  civicPlatformUrn,
  CIVICAITOOLS_PLATFORM_AGENT,
  type PlatformAgentConfig,
} from '../format/vocabulary.ts';
import {
  CIVIC_SOURCE_REGISTRY,
  FALLBACK_SOURCE_ID,
  isDatasetKeyedSource,
  type CivicSourceRegistry,
} from '../format/sources.ts';

export type { ProvGraph, ProvNode };

/** Package-level inputs to the graph build. */
export interface ProvenanceInput {
  packageId: string;
  promptHash: string;
  promptText?: string;
  /** Inline output text. Used to derive the output hash unless
   *  `outputHash` is supplied explicitly. */
  outputText?: string;
  /** Pre-computed SHA-256 hex of the output. Supplied when the output is
   *  stored as a BlobRef and inline text isn't available; the ref hash
   *  itself is exactly this value by construction. */
  outputHash?: string;
  model: string;
  portal: string;
}

/** Instance configuration for the graph build (config-not-constants). */
export interface ProvenanceConfig {
  /** Platform-agent identity — the deployment publishing the evidence. */
  platformAgent: PlatformAgentConfig;
  /** Source registry supplying agent titles and MCP server URLs. */
  sourceRegistry: CivicSourceRegistry;
  /** Source id untagged tool spans fall back to. Default `socrata`
   *  (pre-source-tagging captures were Socrata-only). */
  fallbackSourceId?: string;
  /** Source whose agent `civic:serverUrl` the trace's skill-fetch span URL
   *  overrides when present (the skill is fetched from that source's MCP
   *  server). Default `socrata`. */
  skillSourceId?: string;
  /** `dcterms:description` of the model agent. Default names the demo
   *  deployment's model gateway. */
  modelAgentDescription?: string;
}

/** Demo default: the civicaitools.org reference deployment. */
export const CIVICAITOOLS_PROVENANCE_CONFIG: ProvenanceConfig = {
  platformAgent: CIVICAITOOLS_PLATFORM_AGENT,
  sourceRegistry: CIVIC_SOURCE_REGISTRY,
};

const DEFAULT_MODEL_AGENT_DESCRIPTION = 'Large language model via OpenRouter';

// --- Helpers ---

function getAttr(attrs: OTelAttribute[], key: string): string | undefined {
  const attr = attrs.find(a => a.key === key);
  return attr?.value?.stringValue ?? attr?.value?.intValue ?? undefined;
}

function nanoToIso(nano: string): string {
  const ms = Math.floor(Number(nano) / 1_000_000);
  return new Date(ms).toISOString();
}

// --- Builder ---

/**
 * Build a W3C PROV-O JSON-LD graph from an OTel trace and package metadata.
 *
 * Walks the trace spans and maps them to PROV concepts:
 * - LLM inference spans → prov:Activity
 * - MCP tool call spans → prov:Activity
 * - Prompt, skill guidance, data responses, output → prov:Entity
 * - LLM model, MCP server, platform → prov:Agent
 */
export function buildProvenanceGraph(
  trace: Record<string, unknown>,
  input: ProvenanceInput,
  config: ProvenanceConfig = CIVICAITOOLS_PROVENANCE_CONFIG,
): ProvGraph {
  const otel = trace as unknown as OTelTrace;
  const spans = otel?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans || [];
  const { packageId, promptHash, promptText, outputText, model, portal } = input;
  const outputHash = input.outputHash ?? hash(outputText ?? '');

  const registry = config.sourceRegistry;
  const fallbackSourceId = config.fallbackSourceId ?? FALLBACK_SOURCE_ID;
  const skillSourceId = config.skillSourceId ?? FALLBACK_SOURCE_ID;
  const modelDescription =
    config.modelAgentDescription ?? DEFAULT_MODEL_AGENT_DESCRIPTION;

  const graph: ProvNode[] = [];

  // --- Entities ---

  // User prompt
  graph.push(
    makeEntityNode(civicUrn(packageId, 'prompt', promptHash), {
      'civic:contentHash': `sha256:${promptHash}`,
      'dcterms:description': 'User query prompt',
      ...(promptText ? { 'prov:value': promptText } : {}),
    }),
  );

  // Skill guidance (from skill_fetch span). The skill is a composition of
  // per-source guidance, so the description is source-neutral. Per-source
  // tool agents are emitted from the tool spans below based on which sources
  // were actually invoked.
  const skillSpan = spans.find(s => s.name === 'skill_fetch');
  const skillHash = skillSpan ? getAttr(skillSpan.attributes, 'skill.text_hash') : undefined;
  const skillServerUrl = skillSpan ? getAttr(skillSpan.attributes, 'skill.mcp_server_url') : undefined;

  if (skillHash) {
    graph.push(
      makeEntityNode(
        civicUrn(packageId, 'skill', skillHash),
        {
          'civic:contentHash': `sha256:${skillHash}`,
          'dcterms:description': 'Composed MCP skill guidance (system prompt)',
        },
        ['prov:Plan'],
      ),
    );
  }

  // Final output
  graph.push(
    makeEntityNode(civicUrn(packageId, 'output', outputHash), {
      'civic:contentHash': `sha256:${outputHash}`,
      'dcterms:description': 'AI-generated analysis output',
    }),
  );

  // --- Agents ---

  // LLM model
  const modelUrn = civicModelUrn(model);
  graph.push(
    makeAgentNode(
      modelUrn,
      {
        'dcterms:title': model,
        'dcterms:description': modelDescription,
      },
      ['prov:SoftwareAgent'],
    ),
  );

  // MCP server agents — one per distinct data source that appears in the
  // trace. Tool spans carry `mcp.source`; evidence records captured before
  // source tagging have no source attribute, so they fall back to the
  // configured fallback source (socrata — the only source at the time) for
  // backwards compatibility. Agent coordinates come from the source registry;
  // the skill-fetch span URL overrides the skill source's server URL.
  const toolSpans = spans.filter(s => s.name === 'mcp_tool_call');
  const sourceAgentMap: Record<string, { urn: string; title: string; serverUrl: string }> = {};
  for (const [id, info] of Object.entries(registry)) {
    sourceAgentMap[id] = {
      urn: civicSourceAgentUrn(id),
      title: info.agentTitle,
      serverUrl:
        id === skillSourceId ? skillServerUrl || info.serverUrl : info.serverUrl,
    };
  }

  const sourcesInTrace = new Set<string>();
  for (const span of toolSpans) {
    const source = getAttr(span.attributes, 'mcp.source') || fallbackSourceId;
    sourcesInTrace.add(source);
  }

  for (const sourceId of sourcesInTrace) {
    const meta = sourceAgentMap[sourceId] ?? {
      urn: civicSourceAgentUrn(encodeURIComponent(sourceId)),
      title: `${sourceId} MCP Server`,
      serverUrl: sourceId,
    };
    graph.push(
      makeAgentNode(
        meta.urn,
        {
          'dcterms:title': meta.title,
          'civic:serverUrl': meta.serverUrl,
          'civic:sourceId': sourceId,
        },
        ['prov:SoftwareAgent'],
      ),
    );
  }

  // Resolve a source id to its agent URN, falling back to the configured
  // fallback source for records that never tagged the span. (Reference
  // behavior preserved: unknown ids resolve to the fallback source's agent.)
  function agentUrnForSource(sourceId: string | undefined): string {
    const id = sourceId || fallbackSourceId;
    return (
      sourceAgentMap[id]?.urn
      ?? sourceAgentMap[fallbackSourceId]?.urn
      ?? civicSourceAgentUrn(encodeURIComponent(id))
    );
  }

  // Platform
  graph.push(
    makeAgentNode(
      civicPlatformUrn(config.platformAgent.id),
      {
        'dcterms:title': config.platformAgent.title,
        'civic:url': config.platformAgent.url,
      },
      ['prov:SoftwareAgent'],
    ),
  );

  // --- Activities ---

  // LLM inference spans
  const inferenceSpans = spans.filter(s => s.name === 'llm_inference');
  const inferenceUrns: string[] = [];

  for (const span of inferenceSpans) {
    const spanUrn = civicUrn(packageId, 'inference', span.spanId);
    inferenceUrns.push(spanUrn);

    const used: ProvNodeRef[] = [provRef(civicUrn(packageId, 'prompt', promptHash))];
    if (skillHash) {
      used.push(provRef(civicUrn(packageId, 'skill', skillHash)));
    }

    const promptTokens = getAttr(span.attributes, 'gen_ai.response.prompt_tokens');
    const completionTokens = getAttr(span.attributes, 'gen_ai.response.completion_tokens');

    graph.push(
      makeActivityNode(spanUrn, {
        'dcterms:description': `LLM inference call (iteration ${getAttr(span.attributes, 'gen_ai.inference_index') || '0'})`,
        ...provWasAssociatedWith(modelUrn),
        'prov:used': used,
        ...(span.startTimeUnixNano
          ? { 'prov:startedAtTime': xsdDateTime(nanoToIso(span.startTimeUnixNano)) }
          : {}),
        ...(span.endTimeUnixNano
          ? { 'prov:endedAtTime': xsdDateTime(nanoToIso(span.endTimeUnixNano)) }
          : {}),
        ...(promptTokens ? { 'civic:promptTokens': Number(promptTokens) } : {}),
        ...(completionTokens ? { 'civic:completionTokens': Number(completionTokens) } : {}),
      }),
    );
  }

  // MCP tool call spans
  const dataResponseUrns: string[] = [];

  for (const span of toolSpans) {
    const toolCallUrn = civicUrn(packageId, 'tool-call', span.spanId);
    const argsStr = getAttr(span.attributes, 'tool.arguments') || '{}';
    const queryHash = hash(argsStr);
    const responseHash = getAttr(span.attributes, 'tool.response_hash');
    const toolName = getAttr(span.attributes, 'tool.name') || 'get_data';
    const opType = getAttr(span.attributes, 'tool.operation_type') || 'unknown';
    const datasetId = getAttr(span.attributes, 'tool.dataset_id');
    const portalDomain = getAttr(span.attributes, 'tool.portal_domain') || portal;
    const toolSource = getAttr(span.attributes, 'mcp.source') || fallbackSourceId;
    const toolAgentUrn = agentUrnForSource(toolSource);
    const toolSourceDatasetKeyed = isDatasetKeyedSource(toolSource, registry);

    // Query entity (tool arguments). Find the most recent inference span
    // before this tool call to link as generator.
    const toolStart = Number(span.startTimeUnixNano);
    const precedingInference = inferenceSpans
      .filter(is => Number(is.endTimeUnixNano || '0') <= toolStart)
      .sort((a, b) => Number(b.endTimeUnixNano || '0') - Number(a.endTimeUnixNano || '0'))[0];

    const queryUrn = civicUrn(packageId, 'query', queryHash);
    graph.push(
      makeEntityNode(queryUrn, {
        'civic:contentHash': `sha256:${queryHash}`,
        'civic:toolName': toolName,
        'civic:operationType': opType,
        'dcterms:description': `MCP tool arguments (${opType})`,
        ...(precedingInference
          ? provWasGeneratedBy(civicUrn(packageId, 'inference', precedingInference.spanId))
          : {}),
      }),
    );

    // Data response entity
    if (responseHash) {
      const dataUrn = civicUrn(packageId, 'data', responseHash);
      dataResponseUrns.push(dataUrn);

      // Description varies by source — dataset-keyed sources (Socrata) have
      // a portal domain; aggregate/unknown sources are described by their
      // agent title.
      const description = toolSourceDatasetKeyed
        ? `Data response from ${portalDomain}`
        : `Data response from ${sourceAgentMap[toolSource]?.title || toolSource}`;

      const responseRows = getAttr(span.attributes, 'tool.response_rows');

      graph.push(
        makeEntityNode(dataUrn, {
          'civic:contentHash': `sha256:${responseHash}`,
          'dcterms:description': description,
          'civic:sourceId': toolSource,
          ...provWasGeneratedBy(toolCallUrn),
          // Croissant 1.1 placeholder — only meaningful for dataset-keyed
          // sources today.
          ...(toolSourceDatasetKeyed && datasetId
            ? {
                'civic:datasetId': datasetId,
                'civic:portalDomain': portalDomain,
                'civic:datasetUrl': `https://${portalDomain}/d/${datasetId}`,
                'civic:croissantMetadataUrl': null, // hook for future Croissant integration
              }
            : {}),
          ...(responseRows ? { 'civic:responseRows': Number(responseRows) } : {}),
        }),
      );
    }

    // Tool call activity — associated with the MCP source agent that handled
    // the call. In multi-source analyses each call may target a different
    // agent (e.g. socrata for `get_data`, data-commons for `get_observations`).
    const durationMs = getAttr(span.attributes, 'tool.duration_ms');
    graph.push(
      makeActivityNode(toolCallUrn, {
        'dcterms:description': `MCP tool call: ${toolName} (${opType})`,
        'civic:sourceId': toolSource,
        ...provUsed([queryUrn]),
        ...provWasAssociatedWith(toolAgentUrn),
        ...(span.startTimeUnixNano
          ? { 'prov:startedAtTime': xsdDateTime(nanoToIso(span.startTimeUnixNano)) }
          : {}),
        ...(span.endTimeUnixNano
          ? { 'prov:endedAtTime': xsdDateTime(nanoToIso(span.endTimeUnixNano)) }
          : {}),
        ...(durationMs ? { 'civic:durationMs': Number(durationMs) } : {}),
      }),
    );
  }

  // --- Final output relationships ---

  // Output wasGeneratedBy the last inference or synthesis span
  const synthesisSpan = spans.find(s => s.name === 'synthesis');
  const lastInference = inferenceSpans.length > 0
    ? inferenceSpans[inferenceSpans.length - 1]
    : undefined;
  const generatorSpan = synthesisSpan || lastInference;

  if (generatorSpan) {
    const generatorUrn = synthesisSpan
      ? civicUrn(packageId, 'synthesis', synthesisSpan.spanId)
      : civicUrn(packageId, 'inference', generatorSpan.spanId);

    // Add synthesis activity if it exists
    if (synthesisSpan) {
      graph.push(
        makeActivityNode(generatorUrn, {
          'dcterms:description': 'Output synthesis',
          ...provWasAssociatedWith(modelUrn),
          ...(synthesisSpan.startTimeUnixNano
            ? { 'prov:startedAtTime': xsdDateTime(nanoToIso(synthesisSpan.startTimeUnixNano)) }
            : {}),
          ...(synthesisSpan.endTimeUnixNano
            ? { 'prov:endedAtTime': xsdDateTime(nanoToIso(synthesisSpan.endTimeUnixNano)) }
            : {}),
        }),
      );
    }

    // Output wasGeneratedBy
    graph.push(
      makeEntityNode(civicUrn(packageId, 'output', outputHash), {
        ...provWasGeneratedBy(generatorUrn),
        ...(dataResponseUrns.length > 0
          ? provWasDerivedFrom(dataResponseUrns)
          : {}),
      }),
    );
  }

  // Add data responses to inference used list (inference used data to synthesize)
  if (dataResponseUrns.length > 0 && inferenceUrns.length > 0) {
    const lastInferenceUrn = inferenceUrns[inferenceUrns.length - 1];
    const existing = graph.find(n => n['@id'] === lastInferenceUrn);
    if (existing && Array.isArray(existing['prov:used'])) {
      for (const dUrn of dataResponseUrns) {
        (existing['prov:used'] as ProvNodeRef[]).push(provRef(dUrn));
      }
    }
  }

  // --- Skill hadPlan relationship ---
  if (skillHash && inferenceUrns.length > 0) {
    graph.push(
      makeActivityNode(inferenceUrns[0], {
        'prov:qualifiedAssociation': {
          '@type': 'prov:Association',
          'prov:agent': provRef(modelUrn),
          'prov:hadPlan': provRef(civicUrn(packageId, 'skill', skillHash)),
        },
      }),
    );
  }

  return makeProvGraph(makeCivicProvContext(), graph);
}
