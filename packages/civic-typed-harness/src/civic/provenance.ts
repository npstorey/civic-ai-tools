// Civic provenance builder (CIVIC layer) — the package's `buildProvenanceGraph`,
// `ProvenanceConfig` and `CIVICAITOOLS_PROVENANCE_CONFIG`, under the names
// and signatures they had when they lived in capture/provenance.ts.
//
// The seam (civic-ai-tools#244 P2): capture/provenance.ts walks the trace and
// takes every civic input as a parameter; this module supplies the civic
// ones. It imports the format group's vocabulary and source registry and
// the capture group's builder, which is the one direction the purity test
// allows: capture imports nothing from outside capture/, and format never
// imports capture.
//
// Config-not-constants: the platform-agent identity, the source-agent
// registry (server URLs), and the model-agent description are typed config
// inputs, and the config is REQUIRED — no deployment identity is ever
// applied silently (ADR-0024 posture at the domain layer).
// `CIVICAITOOLS_PROVENANCE_CONFIG` is the reference deployment's values,
// which the reference app passes explicitly; with it, the builder reproduces
// the reference implementation's output byte-for-byte (property insertion
// order is preserved throughout — the legacy hash chain's byte contract).

import {
  buildProvenanceGraphWith,
  type ProvenanceInput,
  type ProvenanceTerms,
  type ProvGraph,
} from '../capture/provenance.ts';
import {
  CIVIC_VOCABULARY,
  CIVICAITOOLS_PLATFORM_AGENT,
  CIVIC_TERM_COMPLETION_TOKENS,
  CIVIC_TERM_CONTENT_HASH,
  CIVIC_TERM_CROISSANT_METADATA_URL,
  CIVIC_TERM_DATASET_ID,
  CIVIC_TERM_DATASET_URL,
  CIVIC_TERM_DURATION_MS,
  CIVIC_TERM_FAILED,
  CIVIC_TERM_FAILURE_KIND,
  CIVIC_TERM_OPERATION_TYPE,
  CIVIC_TERM_PORTAL_DOMAIN,
  CIVIC_TERM_PROMPT_TOKENS,
  CIVIC_TERM_RESPONSE_ROWS,
  CIVIC_TERM_SERVER_URL,
  CIVIC_TERM_SOURCE_ID,
  CIVIC_TERM_TOOL_NAME,
  CIVIC_TERM_URL,
  type CivicVocabulary,
  type PlatformAgentConfig,
} from '../format/vocabulary.ts';
import {
  CIVIC_SOURCE_REGISTRY,
  FALLBACK_SOURCE_ID,
  isDatasetKeyedSource,
  type CivicSourceRegistry,
} from '../format/sources.ts';

// The public surface capture/provenance.ts carried before the seam, re-exported
// so the package entry exports the same names from here.
export type { ProvenanceInput, ProvGraph, ProvNode } from '../capture/provenance.ts';

/** Instance configuration for the graph build (config-not-constants). */
export interface ProvenanceConfig {
  /** Platform-agent identity — the deployment publishing the record. */
  platformAgent: PlatformAgentConfig;
  /** Source registry supplying agent titles and MCP server URLs. Caller-
   *  supplied configuration: an instance passes the addresses it is pointed
   *  at, and an entry with no `serverUrl` makes its agent omit
   *  `civic:serverUrl` (civic-ai-tools#205). */
  sourceRegistry: CivicSourceRegistry;
  /** Source id untagged tool spans fall back to. Default `socrata`
   *  (pre-source-tagging captures were Socrata-only). */
  fallbackSourceId?: string;
  /** Source whose agent `civic:serverUrl` the trace's skill-fetch span URL
   *  overrides when present (the skill is fetched from that source's MCP
   *  server). Default `socrata`. */
  skillSourceId?: string;
  /** `dcterms:description` of the model agent. When unset, the model agent
   *  carries no `dcterms:description` at all — the field is omitted from the
   *  graph (honest omission), never filled with a fallback. */
  modelAgentDescription?: string;
  /** Vocabulary era to emit (spec Appendix J). Defaults to the settlement-era
   *  `CIVIC_VOCABULARY` — the only value a new emission may use. Supply
   *  `PRIOR_ERA_CIVIC_VOCABULARY` ONLY to reproduce or verify a record signed
   *  before the 2026-08-19 settlement, whose identifiers are frozen under the
   *  hash it was signed with. Unlike the other fields here this is not
   *  deployment identity, so it is defaulted rather than required: emitting
   *  the current vocabulary is never the silent-attribution hazard ADR-0024
   *  guards against. */
  vocabulary?: CivicVocabulary;
}

/** The civicaitools.org reference deployment's values. Passed explicitly by
 *  the reference app — never applied as a default, and never spread into
 *  another instance's config, which would assert infrastructure that
 *  instance doesn't run. */
export const CIVICAITOOLS_PROVENANCE_CONFIG: ProvenanceConfig = {
  platformAgent: CIVICAITOOLS_PLATFORM_AGENT,
  sourceRegistry: CIVIC_SOURCE_REGISTRY,
  modelAgentDescription: 'Large language model via OpenRouter',
};

/** The format group's declared `civic:` terms, one per property the builder
 *  keys. Era-independent (the 2026-08-19 settlement moved the namespace, not
 *  the property names), so one table serves both vocabularies. */
const CIVIC_PROVENANCE_TERMS: ProvenanceTerms = {
  contentHash: CIVIC_TERM_CONTENT_HASH,
  serverUrl: CIVIC_TERM_SERVER_URL,
  sourceId: CIVIC_TERM_SOURCE_ID,
  url: CIVIC_TERM_URL,
  promptTokens: CIVIC_TERM_PROMPT_TOKENS,
  completionTokens: CIVIC_TERM_COMPLETION_TOKENS,
  toolName: CIVIC_TERM_TOOL_NAME,
  operationType: CIVIC_TERM_OPERATION_TYPE,
  datasetId: CIVIC_TERM_DATASET_ID,
  portalDomain: CIVIC_TERM_PORTAL_DOMAIN,
  datasetUrl: CIVIC_TERM_DATASET_URL,
  croissantMetadataUrl: CIVIC_TERM_CROISSANT_METADATA_URL,
  responseRows: CIVIC_TERM_RESPONSE_ROWS,
  durationMs: CIVIC_TERM_DURATION_MS,
  failed: CIVIC_TERM_FAILED,
  failureKind: CIVIC_TERM_FAILURE_KIND,
};

/**
 * Build a W3C PROV-O JSON-LD graph from an OTel trace and package metadata.
 *
 * Walks the trace spans and maps them to PROV concepts:
 * - LLM inference spans → prov:Activity
 * - MCP tool call spans → prov:Activity
 * - Prompt, skill guidance, data responses, output → prov:Entity
 * - LLM model, MCP server, platform → prov:Agent
 *
 * The civic defaults applied here and nowhere else: the fallback and skill
 * source ids default to `FALLBACK_SOURCE_ID`, the vocabulary to the
 * settlement-era `CIVIC_VOCABULARY`, and the property names are the format
 * group's `civic:` terms. The dataset-keyed fact is the format group's
 * `isDatasetKeyedSource` over the config's own registry.
 */
export function buildProvenanceGraph(
  trace: Record<string, unknown>,
  input: ProvenanceInput,
  config: ProvenanceConfig,
): ProvGraph {
  const registry = config.sourceRegistry;
  return buildProvenanceGraphWith(trace, input, {
    platformAgent: config.platformAgent,
    sourceRegistry: registry,
    isDatasetKeyed: (sourceId) => isDatasetKeyedSource(sourceId, registry),
    fallbackSourceId: config.fallbackSourceId ?? FALLBACK_SOURCE_ID,
    skillSourceId: config.skillSourceId ?? FALLBACK_SOURCE_ID,
    modelAgentDescription: config.modelAgentDescription,
    vocabulary: config.vocabulary ?? CIVIC_VOCABULARY,
    terms: CIVIC_PROVENANCE_TERMS,
  });
}
