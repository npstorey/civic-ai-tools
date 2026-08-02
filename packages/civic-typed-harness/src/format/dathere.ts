// datHere envelope policy (FORMAT-EXTENSION group) — the derivations the
// reference app's packager did inline, relocated from civic-ai-tools-website
// `src/lib/evidence/packager.ts` per the S2 brief §1:
//   - `:26`       DATHERE_PRODUCER_PROFILE constant
//   - `:286–301`  `org.civicaitools.environment` extension builder
//   - `:393–395`  producerProfile derivation
//   - `:407–410`  content-canonicalization rule selection
//   - `:464–466`  summary-emission decision
//   - `:477–484`  extension layering
//
// Output = explicit envelope-field values for @typedstandards/produce-core's
// `buildEnvelope` (ADR-0021's operating rule: the harness DERIVES, the core
// ASSEMBLES). Byte discipline: every field is emitted exactly when the
// reference packager emitted it, so equivalent inputs produce byte-identical
// canonical JSON through the core's conditional spreads.
//
// The canonicalization rule URIs are verify-core's, reached through
// @typedstandards/produce-core's 0.2.0 re-exports (the harness's single
// declared dependency); the harness re-emits, never redefines, them.

import {
  DATHERE_AG_JUPYTER_CANONICALIZATION,
  LEGACY_JSON_CANONICALIZATION,
} from '@typedstandards/produce-core';

/** The datHere content-profile label (ADR-0004). */
export const DATHERE_CONTENT_PROFILE = 'datHere';

/** Producer Profile auto-derived for the datHere content profile (ADR-0006):
 *  compound `<profile-type>/<profile-subtype>`. */
export const DATHERE_PRODUCER_PROFILE = 'ai-assisted-analysis/datHere';

/** Reverse-DNS key of the auto-emitted environment extension. */
export const ENVIRONMENT_EXTENSION_KEY = 'org.civicaitools.environment';

/** Demo default for the environment extension's `host` field: the
 *  civicaitools.org reference deployment. Config-not-constants — every other
 *  instance supplies its own via `DatHereEnvironmentConfig`. */
export const CIVICAITOOLS_ENVIRONMENT_HOST = 'civicaitools.org';

/** Per-instance configuration for the environment extension. */
export interface DatHereEnvironmentConfig {
  /** Publishing host recorded in `org.civicaitools.environment.host`. */
  host: string;
}

/** The civicaitools.org demo default. */
export const CIVICAITOOLS_ENVIRONMENT_CONFIG: DatHereEnvironmentConfig = {
  host: CIVICAITOOLS_ENVIRONMENT_HOST,
};

/**
 * Derive the envelope's `producerProfile` (ADR-0006): the explicit value when
 * supplied, else auto-derived from the datHere content profile, else
 * `undefined` (and thereby unemitted — pre-ADR-0006 canonical JSON stays
 * byte-identical).
 */
export function deriveProducerProfile(
  producerProfile?: string,
  contentProfile?: string,
): string | undefined {
  return (
    producerProfile
    ?? (contentProfile === DATHERE_CONTENT_PROFILE
      ? DATHERE_PRODUCER_PROFILE
      : undefined)
  );
}

/**
 * Select the content-canonicalization rule URI (spec §8.2) for a content
 * profile: `dathere-ag-jupyter/v1` for datHere (fingerprints the executed
 * notebook), `legacy-json/v1` for everything else (whole-package rule).
 */
export function selectContentCanonicalization(contentProfile?: string): string {
  return contentProfile === DATHERE_CONTENT_PROFILE
    ? DATHERE_AG_JUPYTER_CANONICALIZATION
    : LEGACY_JSON_CANONICALIZATION;
}

/**
 * Summary-emission decision (ADR-0004 §7): the datHere profile REQUIRES the
 * summary in canonical JSON (covered by the envelope hash); every other
 * profile keeps it off-envelope (DB-row only in the reference app), so their
 * package hashes stay byte-identical to pre-ADR-0004 behavior. Returns the
 * value to pass as the envelope's `summary` field, or `undefined` to omit.
 */
export function deriveSummaryEmission(
  contentProfile?: string,
  summary?: string,
): string | undefined {
  return contentProfile === DATHERE_CONTENT_PROFILE && summary
    ? summary
    : undefined;
}

/**
 * Build the `org.civicaitools.environment` extension content for a datHere
 * package. Per OES §9.1.1 requirement 3 the extension MUST carry
 * `modelVersion`, `temperature`, `mcpServers`, `toolDefinitions`, `host`.
 *
 * Prototype limitations carried over from the reference implementation
 * (known gaps, tightened in follow-up work): `temperature` placeholder `0`,
 * `toolDefinitions` placeholder `[]`; `mcpServers` derives from the trace's
 * skill-fetch span URL (the analysis's primary MCP server). Fields captured
 * honestly: `modelVersion` and `host`.
 */
export function buildDatHereEnvironment(
  model: string,
  skillMcpServerUrl: string | undefined,
  config: DatHereEnvironmentConfig = CIVICAITOOLS_ENVIRONMENT_CONFIG,
): Record<string, unknown> {
  const mcpServers: Array<{ url: string; name?: string }> = [];
  if (skillMcpServerUrl) {
    mcpServers.push({ url: skillMcpServerUrl });
  }
  return {
    modelVersion: model,
    temperature: 0,
    mcpServers,
    toolDefinitions: [],
    host: config.host,
  };
}

/** Input to the composite datHere-policy derivation. */
export interface DatHerePolicyInput {
  /** Model identifier (becomes `environment.modelVersion`). */
  model: string;
  /** Content-profile label; absence means the default profile. */
  contentProfile?: string;
  /** Explicit producerProfile — wins over auto-derivation when supplied. */
  producerProfile?: string;
  /** Candidate summary text (emitted only under the datHere profile). */
  summary?: string;
  /** MCP server URL from the trace's skill-fetch span (capture-side
   *  extraction — see src/capture/skill-metadata.ts). */
  skillMcpServerUrl?: string;
  /** Caller-supplied extensions to layer the environment extension onto. */
  extensions?: Record<string, unknown>;
}

/** The derived envelope-field values, ready to spread into produce-core's
 *  `EnvelopeInput`. Fields are `undefined` exactly when the reference
 *  packager left them unemitted. */
export interface DatHereEnvelopeFields {
  producerProfile?: string;
  contentCanonicalization: string;
  summary?: string;
  extensions?: Record<string, unknown>;
}

/**
 * Composite derivation: everything the reference packager derived inline for
 * the datHere policy, as one call. Non-datHere inputs pass through with only
 * the legacy canonicalization rule and any caller-supplied extensions —
 * byte-identical envelopes via the core's conditional spreads.
 */
export function deriveDatHereEnvelopeFields(
  input: DatHerePolicyInput,
  config: DatHereEnvironmentConfig = CIVICAITOOLS_ENVIRONMENT_CONFIG,
): DatHereEnvelopeFields {
  const extensions: Record<string, unknown> = { ...(input.extensions ?? {}) };
  if (input.contentProfile === DATHERE_CONTENT_PROFILE) {
    extensions[ENVIRONMENT_EXTENSION_KEY] = buildDatHereEnvironment(
      input.model,
      input.skillMcpServerUrl,
      config,
    );
  }
  return {
    producerProfile: deriveProducerProfile(
      input.producerProfile,
      input.contentProfile,
    ),
    contentCanonicalization: selectContentCanonicalization(input.contentProfile),
    summary: deriveSummaryEmission(input.contentProfile, input.summary),
    ...(Object.keys(extensions).length > 0 ? { extensions } : {}),
  };
}
