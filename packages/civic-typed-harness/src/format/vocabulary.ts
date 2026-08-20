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
