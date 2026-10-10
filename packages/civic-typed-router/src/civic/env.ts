// The civic sources' configuration, read from a plain object.
//
// Moved from the reference website's `readMcpEnvFromProcess`
// (`src/lib/mcp/registry.ts:312-337` at 3a0c894). The website read its own
// process environment; this function reads whatever object the consumer hands
// it, so the package reads no environment. The rules are unchanged:
//   - the Socrata and Boston OpenContext addresses are present only when
//     non-empty after trimming, and have no default;
//   - the Data Commons address falls back to its public endpoint when unset or
//     empty (a whitespace-only value is kept as it is);
//   - the Data Commons key is absent when unset or empty.

import type { ConfiguredAddresses } from '../core/types.ts';

/** The configuration variable names. */
export const SOCRATA_ADDRESS_VARIABLE = 'SOCRATA_MCP_URL';
export const DATA_COMMONS_ADDRESS_VARIABLE = 'DATA_COMMONS_MCP_URL';
export const DATA_COMMONS_KEY_VARIABLE = 'DATA_COMMONS_API_KEY';
export const BOSTON_OPENCONTEXT_ADDRESS_VARIABLE = 'BOSTON_OPENCONTEXT_MCP_URL';

/** Google's hosted Data Commons endpoint: a third-party public service, used
 *  when the instance configures no Data Commons address. */
export const DATA_COMMONS_DEFAULT_ADDRESS = 'https://api.datacommons.org/mcp';

/** The civic sources' configuration, as the reference website types it. */
export interface McpRegistryEnv {
  /** Absent when the Socrata address is unset or blank: there is no default. */
  socrataUrl?: string;
  dataCommonsUrl: string;
  dataCommonsApiKey?: string;
  /** Absent when the Boston OpenContext address is unset or blank: the source
   *  is optional and has no default. */
  bostonOpencontextUrl?: string;
}

/** A plain object of configuration variables, such as a process environment. */
export type ConfigurationSource = { readonly [name: string]: string | undefined };

/** Non-empty after trimming, or `undefined`. The value itself is not trimmed. */
function presentOrUndefined(raw: string | undefined): string | undefined {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

/** Read the civic sources' configuration from `source`. Every key of the
 *  result is present, in this order, with `undefined` for an absent value. */
export function readMcpEnv(source: ConfigurationSource): McpRegistryEnv {
  return {
    socrataUrl: presentOrUndefined(source[SOCRATA_ADDRESS_VARIABLE]),
    dataCommonsUrl: source[DATA_COMMONS_ADDRESS_VARIABLE] || DATA_COMMONS_DEFAULT_ADDRESS,
    dataCommonsApiKey: source[DATA_COMMONS_KEY_VARIABLE] || undefined,
    bostonOpencontextUrl: presentOrUndefined(source[BOSTON_OPENCONTEXT_ADDRESS_VARIABLE]),
  };
}

/** Each civic source's configured address, keyed by source id: the mapping
 *  the reference website keeps as `MCP_SOURCE_ADDRESS_FIELD`. */
export function configuredAddresses(configured: McpRegistryEnv): ConfiguredAddresses {
  return {
    socrata: configured.socrataUrl,
    'data-commons': configured.dataCommonsUrl,
    'boston-opencontext': configured.bostonOpencontextUrl,
  };
}
