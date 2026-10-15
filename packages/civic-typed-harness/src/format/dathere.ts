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

/** Reverse-DNS key of the composition extension (ADR-0033 §E): what the run's
 *  prompt and tools array were composed from. Emitted under every content
 *  profile, and only when at least one of its fields is passed. */
export const COMPOSITION_EXTENSION_KEY = 'org.civicaitools.composition';

/** A record-field input the derivation refuses (ADR-0033): a value that would
 *  land inside signed bytes in a form the record does not define. Refused
 *  rather than dropped, because dropping it would state absence for a value
 *  the caller did pass. */
export class RecordFieldError extends Error {
  /** The input field the value was passed in. */
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'RecordFieldError';
    this.field = field;
  }
}

/** The civicaitools.org reference deployment's value for the environment
 *  extension's `host` field. Config-not-constants — every instance supplies
 *  its own via `DatHereEnvironmentConfig`; the `host` lands under the
 *  envelope hash, so it is never applied silently. */
export const CIVICAITOOLS_ENVIRONMENT_HOST = 'civicaitools.org';

/** Per-instance configuration for the environment extension. */
export interface DatHereEnvironmentConfig {
  /** Publishing host recorded in `org.civicaitools.environment.host`. */
  host: string;
}

/** The civicaitools.org reference deployment's values. Passed explicitly by
 *  the reference app — never applied as a default. */
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

/** One MCP server the run had available, as the environment extension carries
 *  it — spec §8.7.1 requirement 3: an object with `url` and optional `name`.
 *  The CALLER supplies the order and the names; the harness neither sorts nor
 *  invents them. */
export interface DatHereMcpServer {
  /** The server's configured address. */
  url: string;
  /** Optional label for the server (the reference caller passes the source
   *  id). Omitted from the emitted object when absent, so a nameless entry
   *  stays byte-identical to the pre-0.5.0 single-server shape. */
  name?: string;
}

/** Normalize the two accepted `mcpServers` inputs to the emitted array.
 *
 *  A bare string is the pre-0.5.0 shape — the trace's skill-fetch URL — and
 *  yields at most the one `{ url }` entry, exactly as before. A list is
 *  emitted in the order given, each entry carrying `name` only when the
 *  caller supplied one. An entry with an empty `url` contributes nothing,
 *  which is the same rule the single-URL shape always applied: a server with
 *  no address is stated by absence, never by an empty string. */
function normalizeMcpServers(
  servers: string | readonly DatHereMcpServer[] | undefined,
): Array<{ url: string; name?: string }> {
  if (servers === undefined) return [];
  if (typeof servers === 'string') {
    return servers ? [{ url: servers }] : [];
  }
  return servers
    .filter((server) => Boolean(server.url))
    .map((server) => ({
      url: server.url,
      ...(server.name ? { name: server.name } : {}),
    }));
}

/** The two environment fields stated only when the caller knows them
 *  (ADR-0033 §C, civic-ai-tools#240). */
export interface DatHereRunSettings {
  /** The temperature the model request SENT. Absent when none was sent: the
   *  key is then omitted, never filled. */
  temperature?: number;
  /** The tools array as offered to the model (chat-completions function
   *  tools), in offered order, stated verbatim. Absent when not passed: the
   *  key is then omitted, never `[]`. */
  toolDefinitions?: readonly Record<string, unknown>[];
}

/**
 * Build the `org.civicaitools.environment` extension content for a datHere
 * package. Spec §8.7.1 requirement 3 (as amended in v0.1.11, ADR-0033 §C):
 * `modelVersion`, `mcpServers` and `host` always; `temperature` and
 * `toolDefinitions` when the producer knows them.
 *
 * `mcpServers` accepts EITHER shape (additive since 0.5.0,
 * civic-ai-tools-website#449): a single URL string — the trace's skill-fetch
 * span URL, the only server the pre-0.5.0 builder could name — or the list of
 * servers the run actually had, in the caller's order, each with an optional
 * `name`. The single-URL shape produces byte-identical output to before, so
 * an already-signed package still reproduces.
 *
 * HONEST ABSENCE SINCE 0.7.0 (civic-ai-tools#240, ADR-0033 §C). Until 0.7.0
 * the block stated `temperature: 0` and `toolDefinitions: []` as
 * placeholders — a temperature no request sent, and "no tools" for runs that
 * offered tools. Each is now stated only when the caller passes it, in the
 * key position it always held, so a caller that passes the recorded `0` and
 * `[]` reproduces an earlier package byte for byte.
 */
export function buildDatHereEnvironment(
  model: string,
  mcpServers: string | readonly DatHereMcpServer[] | undefined,
  config: DatHereEnvironmentConfig,
  run: DatHereRunSettings = {},
): Record<string, unknown> {
  const { temperature, toolDefinitions } = checkRunSettings(run);
  return {
    modelVersion: model,
    ...(temperature !== undefined ? { temperature } : {}),
    mcpServers: normalizeMcpServers(mcpServers),
    ...(toolDefinitions !== undefined ? { toolDefinitions } : {}),
    host: config.host,
  };
}

/** Refuse a run setting the block cannot state as given. */
function checkRunSettings(run: DatHereRunSettings): DatHereRunSettings {
  if (run.temperature !== undefined && !(typeof run.temperature === 'number' && Number.isFinite(run.temperature))) {
    throw new RecordFieldError('temperature', 'must be a finite number — the value the request sent');
  }
  if (
    run.toolDefinitions !== undefined
    && !(Array.isArray(run.toolDefinitions)
      && run.toolDefinitions.every((t) => t !== null && typeof t === 'object' && !Array.isArray(t)))
  ) {
    throw new RecordFieldError('toolDefinitions', 'must be an array of tool-definition objects, as offered');
  }
  return run;
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
   *  extraction — see src/capture/skill-metadata.ts). Consulted only when
   *  `mcpServers` is absent, so the pre-0.5.0 call shape keeps producing
   *  byte-identical envelopes. */
  skillMcpServerUrl?: string;
  /** Every MCP server the run had available, in the order the caller wants
   *  them emitted, each with an optional `name`
   *  (civic-ai-tools-website#449). When supplied this REPLACES
   *  `skillMcpServerUrl` as the source of `environment.mcpServers`. */
  mcpServers?: readonly DatHereMcpServer[];
  /** The servers the run HAD, as the trace's root span recorded them at run
   *  time (`analysis.mcp_servers`, read by `extractRunAttributes`;
   *  civic-ai-tools-website#495). When supplied it wins over `mcpServers`
   *  (packaging-time) and `skillMcpServerUrl`. */
  runMcpServers?: readonly DatHereMcpServer[];
  /** The temperature the request sent (environment block; omitted when
   *  absent). */
  temperature?: number;
  /** The tools array as offered (environment block; omitted when absent). */
  toolDefinitions?: readonly Record<string, unknown>[];
  /** The `today` the composed prompt stated, `YYYY-MM-DD` (composition block;
   *  civic-ai-tools-website#475). */
  assertedDate?: string;
  /** Every manifest source with the reason it was or was not offered
   *  (composition block). */
  sourcesOffered?: readonly SourceOfferedInput[];
  /** What composed the prompt (composition block). */
  components?: readonly CompositionComponentInput[];
  /** Caller-supplied extensions to layer the environment extension onto. */
  extensions?: Record<string, unknown>;
}

/** Why a source was or was not offered to the model (ADR-0033 §E). A source
 *  was offered exactly when its reason is `configured` or `selected`. */
export type SourceOfferedReason = 'configured' | 'not-configured' | 'selected' | 'not-selected';

/** The four reasons, in the order ADR-0033 §E states them. */
export const SOURCE_OFFERED_REASONS: readonly SourceOfferedReason[] = [
  'configured',
  'not-configured',
  'selected',
  'not-selected',
];

/** One `sourcesOffered` entry as a caller passes it. `reason` is a string so
 *  the trace extractor's output is accepted as is; the derivation refuses a
 *  value outside `SOURCE_OFFERED_REASONS`. */
export interface SourceOfferedInput {
  sourceId: string;
  alias: string;
  reason: string;
}

/** Where a component's guidance text came from (Q65's three kinds):
 *  `endpoint`, fetched from the source's server at run time; `inline`,
 *  carried in the manifest or composing package; `fallback`, the composer's
 *  stand-in after a fetch failed. */
export type GuidanceOrigin = 'endpoint' | 'inline' | 'fallback';

/** The three origins. */
export const GUIDANCE_ORIGINS: readonly GuidanceOrigin[] = ['endpoint', 'inline', 'fallback'];

/** One `components` entry as a caller passes it. `id` is the manifest
 *  entry's id (or the composing package's name); `version` is omitted when
 *  unknown; `guidanceHash` (lowercase hex SHA-256 of the component's guidance
 *  as composed) and `guidanceOrigin` are present together or not at all. */
export interface CompositionComponentInput {
  id: string;
  version?: string;
  guidanceHash?: string;
  guidanceOrigin?: string;
}

/** The composition block's inputs (ADR-0033 §E). */
export interface CompositionInput {
  assertedDate?: string;
  sourcesOffered?: readonly SourceOfferedInput[];
  components?: readonly CompositionComponentInput[];
}

const ASSERTED_DATE_FORM = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHA256_HEX_FORM = /^[0-9a-f]{64}$/;

/** A `YYYY-MM-DD` string naming a real calendar date. Checked by arithmetic,
 *  not by a `Date`, so the format group reads no clock. */
function isCalendarDate(value: string): boolean {
  const m = ASSERTED_DATE_FORM.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Build the `org.civicaitools.composition` extension content (ADR-0033 §E),
 * or `undefined` when no field is passed (the block is then not emitted, and
 * the extensions bytes are those of 0.6.0).
 *
 * Each field is stated as passed, normalized only to the record's key order,
 * and a value outside the record's form is REFUSED with a `RecordFieldError`
 * rather than dropped: dropping it would state absence for a value the
 * caller did pass.
 */
export function buildCompositionExtension(
  input: CompositionInput,
): Record<string, unknown> | undefined {
  const block: Record<string, unknown> = {};

  if (input.assertedDate !== undefined) {
    if (typeof input.assertedDate !== 'string' || !isCalendarDate(input.assertedDate)) {
      throw new RecordFieldError('assertedDate', `must be the YYYY-MM-DD date the prompt stated; got ${JSON.stringify(input.assertedDate)}`);
    }
    block.assertedDate = input.assertedDate;
  }

  if (input.sourcesOffered !== undefined) {
    if (!Array.isArray(input.sourcesOffered)) {
      throw new RecordFieldError('sourcesOffered', 'must be an array');
    }
    const seen = new Set<string>();
    block.sourcesOffered = input.sourcesOffered.map((entry, i) => {
      if (!nonEmptyString(entry?.sourceId) || !nonEmptyString(entry?.alias)) {
        throw new RecordFieldError('sourcesOffered', `entry ${i} needs a non-empty sourceId and alias`);
      }
      if (!(SOURCE_OFFERED_REASONS as readonly string[]).includes(entry.reason)) {
        throw new RecordFieldError('sourcesOffered', `entry ${i} (${entry.sourceId}): reason ${JSON.stringify(entry.reason)} is not one of ${SOURCE_OFFERED_REASONS.join(', ')}`);
      }
      if (seen.has(entry.sourceId)) {
        throw new RecordFieldError('sourcesOffered', `entry ${i}: ${entry.sourceId} is listed twice`);
      }
      seen.add(entry.sourceId);
      return { sourceId: entry.sourceId, alias: entry.alias, reason: entry.reason };
    });
  }

  if (input.components !== undefined) {
    if (!Array.isArray(input.components)) {
      throw new RecordFieldError('components', 'must be an array');
    }
    block.components = input.components.map((entry, i) => {
      if (!nonEmptyString(entry?.id)) {
        throw new RecordFieldError('components', `entry ${i} needs a non-empty id`);
      }
      if (entry.version !== undefined && !nonEmptyString(entry.version)) {
        throw new RecordFieldError('components', `entry ${i} (${entry.id}): version, when given, is a non-empty string — omit it when unknown`);
      }
      const hasHash = entry.guidanceHash !== undefined;
      const hasOrigin = entry.guidanceOrigin !== undefined;
      if (hasHash !== hasOrigin) {
        throw new RecordFieldError('components', `entry ${i} (${entry.id}): guidanceHash and guidanceOrigin are given together or not at all`);
      }
      if (hasHash && !(typeof entry.guidanceHash === 'string' && SHA256_HEX_FORM.test(entry.guidanceHash))) {
        throw new RecordFieldError('components', `entry ${i} (${entry.id}): guidanceHash is a lowercase hex SHA-256`);
      }
      if (hasOrigin && !(GUIDANCE_ORIGINS as readonly string[]).includes(entry.guidanceOrigin as string)) {
        throw new RecordFieldError('components', `entry ${i} (${entry.id}): guidanceOrigin ${JSON.stringify(entry.guidanceOrigin)} is not one of ${GUIDANCE_ORIGINS.join(', ')}`);
      }
      return {
        id: entry.id,
        ...(entry.version !== undefined ? { version: entry.version } : {}),
        ...(hasHash ? { guidanceHash: entry.guidanceHash, guidanceOrigin: entry.guidanceOrigin } : {}),
      };
    });
  }

  return Object.keys(block).length > 0 ? block : undefined;
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
  config: DatHereEnvironmentConfig,
): DatHereEnvelopeFields {
  const extensions: Record<string, unknown> = { ...(input.extensions ?? {}) };
  if (input.contentProfile === DATHERE_CONTENT_PROFILE) {
    extensions[ENVIRONMENT_EXTENSION_KEY] = buildDatHereEnvironment(
      input.model,
      // The servers the run HAD when the trace recorded them (#495), else the
      // caller's packaging-time list, else the single skill-fetch URL — an
      // input carrying none still emits `mcpServers: []`.
      input.runMcpServers ?? input.mcpServers ?? input.skillMcpServerUrl,
      config,
      { temperature: input.temperature, toolDefinitions: input.toolDefinitions },
    );
  } else {
    // Outside datHere the two settings land nowhere, but a malformed value is
    // still refused rather than silently ignored.
    checkRunSettings({ temperature: input.temperature, toolDefinitions: input.toolDefinitions });
  }
  // Every content profile: appended after the caller's extensions and the
  // environment block, and only when a field was passed (ADR-0033 §E).
  const composition = buildCompositionExtension({
    assertedDate: input.assertedDate,
    sourcesOffered: input.sourcesOffered,
    components: input.components,
  });
  if (composition !== undefined) {
    extensions[COMPOSITION_EXTENSION_KEY] = composition;
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
