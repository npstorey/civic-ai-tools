// Civic PROV-O vocabulary (FORMAT-EXTENSION group) — the `civic:` JSON-LD
// namespace, the `urn:civic-record:` id scheme, and the platform-agent
// identity shape. Relocated from civic-ai-tools-website
// `src/lib/evidence/provenance.ts` (`:51` urn scheme, `:179–184` platform
// agent, `:384–391` context) per the S2 brief §1.
//
// This module defines vocabulary; it never walks a trace. The capture-side
// provenance BUILDER (src/capture/provenance.ts) imports its terms from here —
// that direction is the package's internal module boundary.
//
// TWO ERAS (spec Appendix J — the 2026-08-19 vocabulary settlement, migration
// class "frozen-in-signed-artifacts"). New emissions mint the SETTLEMENT-era
// terms (`CIVIC_NS` / `CIVIC_URN_PREFIX` below, the module's canonical
// values). The PRIOR-era terms are frozen inside every already-signed record —
// rewriting them would change the envelope hash and invalidate the signature —
// so they remain valid forever and are exported here too: reproducing or
// verifying a prior-era package byte-for-byte requires emitting its vocabulary
// exactly as it was signed. Era is not a trust signal (Appendix J §J.4 rule 2);
// prior-era injection exists for reproduction and verification, never for new
// emissions.

import { makeProvContext, PROV_NS, XSD_NS, DCTERMS_NS } from '@typedstandards/produce-core';

/** The `civic:` JSON-LD namespace URI. Part of the civic vocabulary itself
 *  (it names the term set, not a deployment), so it is a constant, not a
 *  config input. Settlement-era value (Appendix J). */
export const CIVIC_NS = 'https://civicaitools.org/ns/civic/';

/** Root of the `urn:civic-record:` id scheme. Settlement-era value
 *  (Appendix J). */
export const CIVIC_URN_PREFIX = 'urn:civic-record';

/** The prior-era `civic:` namespace URI, frozen inside records signed before
 *  the 2026-08-19 settlement. Never emitted for new packages. */
export const PRIOR_ERA_CIVIC_NS = 'https://civicaitools.org/ns/evidence/';

/** The prior-era id-scheme root, frozen inside records signed before the
 *  2026-08-19 settlement. Never emitted for new packages. */
export const PRIOR_ERA_CIVIC_URN_PREFIX = 'urn:civic-evidence';

// --- Term names ---
//
// A `civic:` property name is vocabulary as much as the namespace it hangs
// under: it is the word a reader of a signed graph interprets, so it is
// declared here and imported by the builder that emits it, never spelled as a
// literal inside capture/. Every term is era-independent — the 2026-08-19
// settlement moved the NAMESPACE, not the property names — so none carries an
// era qualifier.
//
// COMPLETE, AND GUARDED AS COMPLETE (civic-ai-tools#199 §2). Until this wave
// two terms were declared here and the other fourteen were spelled inline in
// capture/provenance.ts and declared nowhere, which the note that stood in
// this place recorded as "a real inconsistency ... a phase of its own". This
// is that phase. `purity.test.ts` no longer holds a list of the terms it
// knows about — it derives the universe from both ends: no string literal
// anywhere in capture/ may be a `civic:` term, and every `civic:` key a
// DRIVEN graph emits must be the value of a constant declared here. A term
// invented inline tomorrow fails both legs without anyone editing a list.
//
// NO BYTE MOVES. Naming a key changes no emitted byte: a computed key
// (`{ [CIVIC_TERM_SOURCE_ID]: v }`) inserts in the same position with the same
// value as the literal it replaces, and property insertion order is the legacy
// chain's byte contract. Both golden suites and the span-carrying golden case
// added in the same phase measure that rather than assume it.

/**
 * `civic:failed` — a tool-call activity whose call the SOURCE REFUSED.
 *
 * Emitted with the boolean `true` and only when the producer stated the
 * rejection; never emitted as `false`. A literal `false` would assert an
 * outcome, and "recorded as not-failed" must stay indistinguishable from
 * "nothing recorded" — the same absent-is-absent posture `ToolCallSummary`
 * takes for `failed`. A reader that finds no key learns that the record
 * states nothing, which is the truth about every package minted before 0.4.0.
 */
export const CIVIC_TERM_FAILED = 'civic:failed';

/**
 * `civic:failureKind` — the producer's own classified label for WHY a call
 * carrying {@link CIVIC_TERM_FAILED} was refused.
 *
 * An open string with no normative vocabulary here: the harness states the
 * label verbatim and never interprets or re-derives it. It is a label on an
 * assertion, not the assertion — a record that carries a kind and no failure
 * is not a rejection, and the term is emitted only alongside
 * {@link CIVIC_TERM_FAILED}. The reference producer's four values are
 * `timeout`, `unavailable`, `not_configured` and `unknown`; a producer with a
 * wider vocabulary widens this field rather than putting prose in it.
 */
export const CIVIC_TERM_FAILURE_KIND = 'civic:failureKind';

/**
 * `civic:contentHash` — the SHA-256 of the bytes an entity stands for, as
 * `sha256:<hex>`. Emitted on the prompt, skill, output, tool-argument and
 * data-response entities: a reader hashes the content it holds and compares.
 */
export const CIVIC_TERM_CONTENT_HASH = 'civic:contentHash';

/**
 * `civic:serverUrl` — the MCP server URL an source agent answered from, as
 * the deployment's source registry states it (or, for the skill source, as
 * the trace's skill-fetch span carried it).
 */
export const CIVIC_TERM_SERVER_URL = 'civic:serverUrl';

/**
 * `civic:sourceId` — the stable id of the source that answered a call, on
 * both the tool-call activity and the data-response entity. It is the
 * registry key, not a display name: a reader resolves it, and the graph never
 * spells the reader-facing name.
 */
export const CIVIC_TERM_SOURCE_ID = 'civic:sourceId';

/**
 * `civic:url` — the public URL of the platform agent that published the
 * record (the deployment's own address, a typed config input).
 */
export const CIVIC_TERM_URL = 'civic:url';

/** `civic:promptTokens` — prompt tokens the span reported for one inference.
 *  Emitted only when the span carried the count; never zero-filled. */
export const CIVIC_TERM_PROMPT_TOKENS = 'civic:promptTokens';

/** `civic:completionTokens` — completion tokens the span reported for one
 *  inference. Emitted only when the span carried the count. */
export const CIVIC_TERM_COMPLETION_TOKENS = 'civic:completionTokens';

/**
 * `civic:toolName` — the tool a call invoked, verbatim from the span.
 * Omitted, never placeholdered, when the span named no tool: the graph states
 * absence as absence.
 */
export const CIVIC_TERM_TOOL_NAME = 'civic:toolName';

/**
 * `civic:operationType` — the producer's classification of what a call did
 * (`query`, `metadata`, `unknown`, …). An open string the graph states
 * verbatim and never re-derives.
 */
export const CIVIC_TERM_OPERATION_TYPE = 'civic:operationType';

/**
 * `civic:datasetId` — the dataset a data response came from, stated whenever
 * the span carried one and the source is dataset-keyed.
 */
export const CIVIC_TERM_DATASET_ID = 'civic:datasetId';

/**
 * `civic:portalDomain` — the portal host a tool span carried. Never the run's
 * selected portal: a call that addressed no portal yields a response
 * attributed to none.
 */
export const CIVIC_TERM_PORTAL_DOMAIN = 'civic:portalDomain';

/**
 * `civic:datasetUrl` — the canonical dataset URL, minted only when the span
 * carried BOTH the portal host and the dataset id (a URL needs a host the
 * span actually stated).
 */
export const CIVIC_TERM_DATASET_URL = 'civic:datasetUrl';

/**
 * `civic:croissantMetadataUrl` — the Croissant 1.1 metadata URL for a
 * dataset-keyed data response. Emitted as an explicit `null` placeholder for
 * a future integration; the key is inside signed bytes, so it is stated here
 * rather than left as an undocumented literal.
 */
export const CIVIC_TERM_CROISSANT_METADATA_URL = 'civic:croissantMetadataUrl';

/** `civic:responseRows` — the row count a tool response carried, when the
 *  span reported one. */
export const CIVIC_TERM_RESPONSE_ROWS = 'civic:responseRows';

/**
 * `civic:durationMs` — the elapsed the producer measured for one tool call.
 * Emitted whenever the span carried it, on a call that answered and on one
 * the source REFUSED alike: since civic-ai-tools-website#413 the reference
 * producer records the elapsed on its rejection path too, so this term and
 * {@link CIVIC_TERM_FAILED} appear together on the same activity.
 */
export const CIVIC_TERM_DURATION_MS = 'civic:durationMs';

/**
 * One era of the civic vocabulary: the two literals plus the emitters bound
 * to them. The vocabulary is not deployment configuration (a deployment does
 * not choose its own term set); this seam exists only so a prior-era package
 * can be reproduced with the exact vocabulary it was signed under.
 */
export interface CivicVocabulary {
  /** The `civic:` JSON-LD namespace URI for this era. */
  readonly ns: string;
  /** The id-scheme root for this era. */
  readonly urnPrefix: string;
  /** The civic record-package JSON-LD `@context`: prov / xsd / civic /
   *  dcterms, in the reference emission order (legacy-chain byte discipline —
   *  insertion order is the byte contract). */
  context(): Record<string, string>;
  /** Package-scoped node id: `<prefix>:<packageId>:<type>:<id>`. */
  urn(packageId: string, type: string, id: string): string;
  /** Model-agent id: `<prefix>:model:<modelId>` (slashes in the model
   *  identifier collapse to dashes). */
  modelUrn(model: string): string;
  /** MCP source-agent id: `<prefix>:mcp-server:<sourceId>`. Known source ids
   *  are emitted raw (they are already URN-safe by construction); callers
   *  emitting an UNKNOWN id must encode it first (the capture-side builder
   *  uses `encodeURIComponent`, matching the reference behavior). */
  sourceAgentUrn(sourceId: string): string;
  /** Platform-agent id: `<prefix>:platform:<platformId>`. */
  platformUrn(platformId: string): string;
}

/** Bind the emitters to one era's two literals. */
export function makeCivicVocabulary(ns: string, urnPrefix: string): CivicVocabulary {
  return {
    ns,
    urnPrefix,
    context: () =>
      makeProvContext({
        prov: PROV_NS,
        xsd: XSD_NS,
        civic: ns,
        dcterms: DCTERMS_NS,
      }),
    urn: (packageId, type, id) => `${urnPrefix}:${packageId}:${type}:${id}`,
    modelUrn: (model) => `${urnPrefix}:model:${model.replace(/\//g, '-')}`,
    sourceAgentUrn: (sourceId) => `${urnPrefix}:mcp-server:${sourceId}`,
    platformUrn: (platformId) => `${urnPrefix}:platform:${platformId}`,
  };
}

/** The settlement-era vocabulary — what every new emission uses. */
export const CIVIC_VOCABULARY: CivicVocabulary = makeCivicVocabulary(CIVIC_NS, CIVIC_URN_PREFIX);

/** The prior-era vocabulary, valid forever inside records signed before the
 *  settlement. Supply it to reproduce or verify such a record byte-for-byte;
 *  never to mint a new package. */
export const PRIOR_ERA_CIVIC_VOCABULARY: CivicVocabulary = makeCivicVocabulary(
  PRIOR_ERA_CIVIC_NS,
  PRIOR_ERA_CIVIC_URN_PREFIX,
);

// --- Settlement-era convenience bindings (unchanged signatures) ---

/** The civic record-package JSON-LD `@context`: prov / xsd / civic /
 *  dcterms, in the reference emission order (legacy-chain byte discipline —
 *  insertion order is the byte contract). Settlement era; for a prior-era
 *  graph use `PRIOR_ERA_CIVIC_VOCABULARY.context()`. */
export function makeCivicProvContext(): Record<string, string> {
  return CIVIC_VOCABULARY.context();
}

/** Package-scoped node id: `urn:civic-record:<packageId>:<type>:<id>`. */
export function civicUrn(packageId: string, type: string, id: string): string {
  return CIVIC_VOCABULARY.urn(packageId, type, id);
}

/** Model-agent id: `urn:civic-record:model:<modelId>` (slashes in the
 *  model identifier collapse to dashes). */
export function civicModelUrn(model: string): string {
  return CIVIC_VOCABULARY.modelUrn(model);
}

/** MCP source-agent id: `urn:civic-record:mcp-server:<sourceId>`. Known
 *  source ids are emitted raw (they are already URN-safe by construction);
 *  callers emitting an UNKNOWN id must encode it first (the capture-side
 *  builder uses `encodeURIComponent`, matching the reference behavior). */
export function civicSourceAgentUrn(sourceId: string): string {
  return CIVIC_VOCABULARY.sourceAgentUrn(sourceId);
}

/** Platform-agent id: `urn:civic-record:platform:<platformId>`. */
export function civicPlatformUrn(platformId: string): string {
  return CIVIC_VOCABULARY.platformUrn(platformId);
}

/**
 * Platform-agent identity — WHO published, as a PROV agent. A typed config
 * input (config-not-constants, S2 brief §2): every deployment names its own;
 * the civicaitools.org demo values are the exported default below.
 */
export interface PlatformAgentConfig {
  /** Stable platform id — becomes `urn:civic-record:platform:<id>` (prior-era
   *  graphs carry the same id under the prior-era prefix). */
  id: string;
  /** Human-readable platform title (`dcterms:title`). */
  title: string;
  /** Public URL of the deployment (`civic:url`). */
  url: string;
}

/** Demo default: the civicaitools.org reference deployment's identity. */
export const CIVICAITOOLS_PLATFORM_AGENT: PlatformAgentConfig = {
  id: 'civic-ai-tools',
  title: 'Civic AI Tools',
  url: 'https://civicaitools.org',
};
