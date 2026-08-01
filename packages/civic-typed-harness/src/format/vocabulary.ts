// Civic PROV-O vocabulary (FORMAT-EXTENSION group) — the `civic:` JSON-LD
// namespace, the `urn:civic-evidence:` id scheme, and the platform-agent
// identity shape. Relocated from civic-ai-tools-website
// `src/lib/evidence/provenance.ts` (`:51` urn scheme, `:179–184` platform
// agent, `:384–391` context) per the S2 brief §1.
//
// This module defines vocabulary; it never walks a trace. The capture-side
// provenance BUILDER (src/capture/provenance.ts) imports its terms from here —
// that direction is the package's internal module boundary.

import { makeProvContext, PROV_NS, XSD_NS, DCTERMS_NS } from '@typedstandards/produce-core';

/** The `civic:` JSON-LD namespace URI. Part of the civic vocabulary itself
 *  (it names the term set, not a deployment), so it is a constant, not a
 *  config input. */
export const CIVIC_NS = 'https://civicaitools.org/ns/evidence/';

/** The civic evidence-package JSON-LD `@context`: prov / xsd / civic /
 *  dcterms, in the reference emission order (legacy-chain byte discipline —
 *  insertion order is the byte contract). */
export function makeCivicProvContext(): Record<string, string> {
  return makeProvContext({
    prov: PROV_NS,
    xsd: XSD_NS,
    civic: CIVIC_NS,
    dcterms: DCTERMS_NS,
  });
}

/** Root of the `urn:civic-evidence:` id scheme. */
export const CIVIC_URN_PREFIX = 'urn:civic-evidence';

/** Package-scoped node id: `urn:civic-evidence:<packageId>:<type>:<id>`. */
export function civicUrn(packageId: string, type: string, id: string): string {
  return `${CIVIC_URN_PREFIX}:${packageId}:${type}:${id}`;
}

/** Model-agent id: `urn:civic-evidence:model:<modelId>` (slashes in the
 *  model identifier collapse to dashes). */
export function civicModelUrn(model: string): string {
  return `${CIVIC_URN_PREFIX}:model:${model.replace(/\//g, '-')}`;
}

/** MCP source-agent id: `urn:civic-evidence:mcp-server:<sourceId>`. Known
 *  source ids are emitted raw (they are already URN-safe by construction);
 *  callers emitting an UNKNOWN id must encode it first (the capture-side
 *  builder uses `encodeURIComponent`, matching the reference behavior). */
export function civicSourceAgentUrn(sourceId: string): string {
  return `${CIVIC_URN_PREFIX}:mcp-server:${sourceId}`;
}

/** Platform-agent id: `urn:civic-evidence:platform:<platformId>`. */
export function civicPlatformUrn(platformId: string): string {
  return `${CIVIC_URN_PREFIX}:platform:${platformId}`;
}

/**
 * Platform-agent identity — WHO published, as a PROV agent. A typed config
 * input (config-not-constants, S2 brief §2): every deployment names its own;
 * the civicaitools.org demo values are the exported default below.
 */
export interface PlatformAgentConfig {
  /** Stable platform id — becomes `urn:civic-evidence:platform:<id>`. */
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
