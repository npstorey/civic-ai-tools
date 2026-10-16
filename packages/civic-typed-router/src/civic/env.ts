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
//
// Since 0.3.0 it also reads one switch, `NYC_CHARTER_HOSTING`, for the one
// source the instance runs itself rather than calls at an address (NYC
// Charter, Laws and Rules; `./nyc-charter.ts`). Its key is in the result only
// when the switch is on, so with the switch unset every reading is 0.2.0's,
// key for key.

import type { ConfiguredAddresses } from '../core/types.ts';

/** The configuration variable names. */
export const SOCRATA_ADDRESS_VARIABLE = 'SOCRATA_MCP_URL';
export const DATA_COMMONS_ADDRESS_VARIABLE = 'DATA_COMMONS_MCP_URL';
export const DATA_COMMONS_KEY_VARIABLE = 'DATA_COMMONS_API_KEY';
export const BOSTON_OPENCONTEXT_ADDRESS_VARIABLE = 'BOSTON_OPENCONTEXT_MCP_URL';
/** The switch that offers NYC Charter, Laws and Rules: a source the instance
 *  runs itself, so it takes no address. */
export const NYC_CHARTER_HOSTING_VARIABLE = 'NYC_CHARTER_HOSTING';

/** The one value of `NYC_CHARTER_HOSTING` that switches the source on: the
 *  instance runs the pinned package in a sandbox it creates. Compared after
 *  trimming, and exactly: any other value leaves the switch off. */
export const NYC_CHARTER_HOSTING_SANDBOX = 'sandbox';

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
  /** Present only when `NYC_CHARTER_HOSTING` is `sandbox` after trimming: the
   *  switch is on. Absent when it is unset, blank or any other value, so a
   *  value the instance cannot run never offers the source. */
  nycCharterHosting?: typeof NYC_CHARTER_HOSTING_SANDBOX;
}

/** A plain object of configuration variables, such as a process environment. */
export type ConfigurationSource = { readonly [name: string]: string | undefined };

/** Non-empty after trimming, or `undefined`. The value itself is not trimmed. */
function presentOrUndefined(raw: string | undefined): string | undefined {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

/** Whether a switch's raw value turns it on: exactly `sandbox` after
 *  trimming. */
function hostingSwitchOn(raw: string | undefined): boolean {
  return typeof raw === 'string' && raw.trim() === NYC_CHARTER_HOSTING_SANDBOX;
}

/** Read the civic sources' configuration from `source`. The four address and
 *  key fields are always present, in this order, with `undefined` for an
 *  absent value. `nycCharterHosting` follows them only when its switch is on;
 *  otherwise the result has no such key. */
export function readMcpEnv(source: ConfigurationSource): McpRegistryEnv {
  return {
    socrataUrl: presentOrUndefined(source[SOCRATA_ADDRESS_VARIABLE]),
    dataCommonsUrl: source[DATA_COMMONS_ADDRESS_VARIABLE] || DATA_COMMONS_DEFAULT_ADDRESS,
    dataCommonsApiKey: source[DATA_COMMONS_KEY_VARIABLE] || undefined,
    bostonOpencontextUrl: presentOrUndefined(source[BOSTON_OPENCONTEXT_ADDRESS_VARIABLE]),
    ...(hostingSwitchOn(source[NYC_CHARTER_HOSTING_VARIABLE]) ? { nycCharterHosting: NYC_CHARTER_HOSTING_SANDBOX } : {}),
  };
}

/** Each civic source's configured address, keyed by source id: the mapping
 *  the reference website keeps as `MCP_SOURCE_ADDRESS_FIELD`. Addresses only:
 *  a hosted source has none, so NYC Charter never has a key here, switch on
 *  or off. */
export function configuredAddresses(configured: McpRegistryEnv): ConfiguredAddresses {
  return {
    socrata: configured.socrataUrl,
    'data-commons': configured.dataCommonsUrl,
    'boston-opencontext': configured.bostonOpencontextUrl,
  };
}

/** What selection reads: `configuredAddresses`, and each hosted source whose
 *  switch is on, keyed by its source id with the switch's value. A hosted
 *  source is offered by its switch, never by an address. */
export function configuredSources(configured: McpRegistryEnv): ConfiguredAddresses {
  return {
    ...configuredAddresses(configured),
    ...(configured.nycCharterHosting === NYC_CHARTER_HOSTING_SANDBOX ? { 'nyc-charter': NYC_CHARTER_HOSTING_SANDBOX } : {}),
  };
}
