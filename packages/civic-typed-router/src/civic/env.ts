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
//
// Since 0.6.0 it reads two more switches of the same kind, one per hosted
// source: `NYC_CHECKBOOK_HOSTING` and `NYS_LEGISLATION_HOSTING`
// (`./nyc-checkbook.ts`, `./nys-legislation.ts`). Each is on only at exactly
// `sandbox` after trimming, and each key is in the result only while its
// switch is on, so with the switches unset every reading is 0.5.0's, key for
// key. 0.6.0 and 0.7.0 read a third, City Record's; since 0.8.0 City Record
// is a pack over the Socrata server (`./nyc-record.ts`), takes no switch, and
// is keyed by the Socrata address (`configuredAddresses`).
//
// Since 0.10.0 the configuration may carry the instance's one-portal lock,
// `lockedPortal`, which the consumer sets: `readMcpEnv` never reads or sets
// it, so every reading is 0.9.0's, key for key. A lock to a Socrata portal
// other than a Socrata pack's own (its `filter.portal`, compared trimmed and
// lower-cased) leaves the pack unconfigured (G0-6 on hub #318): it has no
// address here, and the router offers, lists and finds it nowhere.

import type { ConfiguredAddresses } from '../core/types.ts';

/** The configuration variable names. */
export const SOCRATA_ADDRESS_VARIABLE = 'SOCRATA_MCP_URL';
export const DATA_COMMONS_ADDRESS_VARIABLE = 'DATA_COMMONS_MCP_URL';
export const DATA_COMMONS_KEY_VARIABLE = 'DATA_COMMONS_API_KEY';
export const BOSTON_OPENCONTEXT_ADDRESS_VARIABLE = 'BOSTON_OPENCONTEXT_MCP_URL';
/** The switch that offers NYC Charter, Laws and Rules: a source the instance
 *  runs itself, so it takes no address. */
export const NYC_CHARTER_HOSTING_VARIABLE = 'NYC_CHARTER_HOSTING';

/** The switch that offers NYC Checkbook (since 0.6.0). */
export const NYC_CHECKBOOK_HOSTING_VARIABLE = 'NYC_CHECKBOOK_HOSTING';
/** The switch that offers NYS Open Legislation (since 0.6.0). */
export const NYS_LEGISLATION_HOSTING_VARIABLE = 'NYS_LEGISLATION_HOSTING';

/** The one value of a hosted source's switch that turns it on: the instance
 *  runs the pinned package in a sandbox it creates. Compared after trimming,
 *  and exactly: any other value leaves the switch off. It is the name of the
 *  variant it turns on (each hosted entry's `sandbox` variant). Since 0.6.0,
 *  the name every switch shares; `NYC_CHARTER_HOSTING_SANDBOX` is the same
 *  value under its 0.3.0 name. */
export const HOSTING_SANDBOX = 'sandbox';

/** The one value of `NYC_CHARTER_HOSTING` that switches the source on:
 *  `HOSTING_SANDBOX`, under its 0.3.0 name. It is the name of the variant it
 *  turns on (`NYC_CHARTER_SANDBOX_VARIANT.variant`). */
export const NYC_CHARTER_HOSTING_SANDBOX = HOSTING_SANDBOX;

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
  /** Present only when `NYC_CHECKBOOK_HOSTING` is `sandbox` after trimming
   *  (since 0.6.0). */
  nycCheckbookHosting?: typeof HOSTING_SANDBOX;
  /** Present only when `NYS_LEGISLATION_HOSTING` is `sandbox` after trimming
   *  (since 0.6.0). */
  nysLegislationHosting?: typeof HOSTING_SANDBOX;
  /** The one Socrata portal the instance is locked to, set by the consumer
   *  (since 0.10.0); the value it passes as `lockedPortal` to
   *  `withPortalLockGuidance` and `mcpToolsFor`. `readMcpEnv` never sets it.
   *  Absent, empty or blank after trimming, there is no lock. Set, a Socrata
   *  pack fixed to another portal (compared trimmed and lower-cased) is not
   *  configured: every offer output leaves it out, and no search finds it. */
  lockedPortal?: string;
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
  return typeof raw === 'string' && raw.trim() === HOSTING_SANDBOX;
}

/** Read the civic sources' configuration from `source`. The four address and
 *  key fields are always present, in this order, with `undefined` for an
 *  absent value. Each switch's key follows them only when that switch is on,
 *  in manifest order (`nycCharterHosting`, `nycCheckbookHosting`,
 *  `nysLegislationHosting`); otherwise the result has no such key. */
export function readMcpEnv(source: ConfigurationSource): McpRegistryEnv {
  return {
    socrataUrl: presentOrUndefined(source[SOCRATA_ADDRESS_VARIABLE]),
    dataCommonsUrl: source[DATA_COMMONS_ADDRESS_VARIABLE] || DATA_COMMONS_DEFAULT_ADDRESS,
    dataCommonsApiKey: source[DATA_COMMONS_KEY_VARIABLE] || undefined,
    bostonOpencontextUrl: presentOrUndefined(source[BOSTON_OPENCONTEXT_ADDRESS_VARIABLE]),
    ...(hostingSwitchOn(source[NYC_CHARTER_HOSTING_VARIABLE]) ? { nycCharterHosting: NYC_CHARTER_HOSTING_SANDBOX } : {}),
    ...(hostingSwitchOn(source[NYC_CHECKBOOK_HOSTING_VARIABLE]) ? { nycCheckbookHosting: HOSTING_SANDBOX } : {}),
    ...(hostingSwitchOn(source[NYS_LEGISLATION_HOSTING_VARIABLE]) ? { nysLegislationHosting: HOSTING_SANDBOX } : {}),
  };
}

/** Each civic pack's base, by the pack's source id (since 0.8.0): City
 *  Record over the Socrata server. A pack takes no address of its own. */
const PACK_BASES: Readonly<Record<string, string>> = Object.freeze({ 'nyc-record': 'socrata' });

/** Each civic Socrata pack's portal, its `filter.portal`, by the pack's
 *  source id (since 0.10.0): City Record's, `data.cityofnewyork.us`
 *  (`./nyc-record.ts`, and the inventory file). */
const SOCRATA_PACK_PORTALS: Readonly<Record<string, string>> = Object.freeze({ 'nyc-record': 'data.cityofnewyork.us' });

/** A portal hostname compared the way the reference website compares one:
 *  trimmed and lower-cased. */
const normalizePortal = (portal: string): string => portal.trim().toLowerCase();

/** The Socrata packs a one-portal lock leaves unconfigured, by source id, in
 *  the order above (since 0.10.0): each whose portal is not `lockedPortal`,
 *  compared trimmed and lower-cased. None when `lockedPortal` is absent, or
 *  empty or blank after trimming. */
export function socrataPacksOutsideLock(lockedPortal: string | undefined): string[] {
  if (typeof lockedPortal !== 'string') return [];
  const lock = normalizePortal(lockedPortal);
  if (lock === '') return [];
  return Object.entries(SOCRATA_PACK_PORTALS)
    .filter(([, portal]) => normalizePortal(portal) !== lock)
    .map(([pack]) => pack);
}

/** Each civic source's configured address, keyed by source id: the mapping
 *  the reference website keeps as `MCP_SOURCE_ADDRESS_FIELD`. Addresses only:
 *  a hosted source has none, so no hosted source ever has a key here, switch
 *  on or off. Since 0.8.0 a pack is keyed by its base's address: it has a key
 *  when its base has an address, with that address as its value, and none
 *  otherwise. Since 0.10.0 a Socrata pack outside the configuration's
 *  `lockedPortal` (`socrataPacksOutsideLock`) has no key. */
export function configuredAddresses(configured: McpRegistryEnv): ConfiguredAddresses {
  const addresses: Record<string, string | undefined> = {
    socrata: configured.socrataUrl,
    'data-commons': configured.dataCommonsUrl,
    'boston-opencontext': configured.bostonOpencontextUrl,
  };
  const outsideLock = socrataPacksOutsideLock(configured.lockedPortal);
  for (const [pack, base] of Object.entries(PACK_BASES)) {
    const address = addresses[base];
    if (address !== undefined && !outsideLock.includes(pack)) addresses[pack] = address;
  }
  return addresses;
}

/** What selection reads: `configuredAddresses` (a pack keyed by its base's
 *  address), and each hosted source whose switch is on, keyed by its source
 *  id with the switch's value. A hosted source is offered by its switch,
 *  never by an address. */
export function configuredSources(configured: McpRegistryEnv): ConfiguredAddresses {
  return {
    ...configuredAddresses(configured),
    ...(configured.nycCharterHosting === NYC_CHARTER_HOSTING_SANDBOX ? { 'nyc-charter': NYC_CHARTER_HOSTING_SANDBOX } : {}),
    ...(configured.nycCheckbookHosting === HOSTING_SANDBOX ? { 'nyc-checkbook': HOSTING_SANDBOX } : {}),
    ...(configured.nysLegislationHosting === HOSTING_SANDBOX ? { 'nys-legislation': HOSTING_SANDBOX } : {}),
  };
}
