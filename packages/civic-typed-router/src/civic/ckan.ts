// The hosted CKAN server (CKAN-1 P2, hub issue 314): the base the Boston
// pack is built over, and the six tool schemas a CKAN pack calls.
//
// The server is a pinned fork of the open-source ckan-mcp-server
// (github.com/npstorey/ckan-mcp-server, at the commit its fixture names),
// which the project hosts at an address the instance configures
// (`CKAN_MCP_URL`). Its server entry declares no tools (`toolsRef.toolNames`
// is empty in the inventory, D7 = D): none of its 20 tools is offered on its
// own, and a portal is a pack over it that calls some of them with
// `server_url` fixed. Its `initialize` result carries no `instructions` and
// the entry's guidance is none.
//
// Since the entry declares no tools, the base's own tool names are stated
// here (`CKAN_SERVER_TOOL_NAMES`, in its `tools/list` order): the kind's pack
// builder hands them to the loader, which holds a pack's `basePins` to them
// (Q1). The six schemas a pack calls (`CKAN_PACK_BASE_TOOLS`) are the
// server's own, as its `tools/list` returns them at the pinned commit:
// captured by `src/__fixtures__/pin-ckan-tools.mjs` into
// `src/__fixtures__/ckan-tools.json`, and held equal to it by
// `src/ckan.test.ts`. They are code because the build reads no JSON, and
// text the router does not own: the aliased view gives their descriptions
// the anchored rewrite.

import type { FunctionToolSchema, GuidanceEntry } from '../core/types.ts';
import { CKAN_SERVER_WORDS } from './ckan-words.ts';
import type { CivicGuidanceContext, CivicManifestEntry } from './context.ts';
import { CKAN_ADDRESS_VARIABLE } from './env.ts';

/** The hosted CKAN server's source id. */
export const CKAN_SERVER_SOURCE_ID = 'ckan-server';

/** The server's 20 tool names, in the order its `tools/list` returns them
 *  at the pinned commit: what a CKAN pack's `basePins` are held to. */
// A stub of the red tree: empty until the capture is mirrored.
export const CKAN_SERVER_TOOL_NAMES: readonly string[] = [];

/** The six tools a CKAN pack calls, in routing order (D2). */
// A stub of the red tree: empty until the capture is mirrored.
export const CKAN_PACK_TOOL_NAMES: readonly string[] = [];

/** The passages a pack removes from the server's descriptions. A stub of the
 *  red tree: none. */
export const CKAN_PACK_DESCRIPTION_CUTS: Readonly<Record<string, readonly string[]>> = Object.freeze({});

/** The six schemas at the pinned commit, as function tools, in
 *  `CKAN_PACK_TOOL_NAMES`' order: each `inputSchema` is the tool's
 *  `parameters`, unchanged, and `server_url` is still open (a pack fixes
 *  it). */
// A stub of the red tree: empty until the capture is mirrored.
export const CKAN_PACK_BASE_TOOLS: readonly FunctionToolSchema[] = [];

/** The guidance of a server that sends none. */
const NO_GUIDANCE: GuidanceEntry<CivicGuidanceContext> = Object.freeze({
  async fetchText() {
    return '';
  },
});

/**
 * The hosted CKAN server's manifest entry: the mirror of its inventory
 * entry. It declares no tools, so it is never in a list the model reads (the
 * router leaves an entry with no tool names out of the preamble, the outro,
 * the directory, `load_source`'s choices, the lock text and the search's
 * hits); it is in every list a record states. Optional, with no default
 * address: offered, with its packs, only when `CKAN_MCP_URL` is set.
 *
 * One variant: the hosted server, run by whoever operates it, reaching the
 * portals its operator lists. As with the Socrata server, the instance
 * decides who holds its logs, so they are named by role.
 */
export const CKAN_SERVER_ENTRY: CivicManifestEntry = {
  id: '@aborruso/ckan-mcp-server@https://github.com/npstorey/ckan-mcp-server',
  alias: 'ckan',
  sourceId: CKAN_SERVER_SOURCE_ID,
  displayName: CKAN_SERVER_WORDS.displayName,
  description: CKAN_SERVER_WORDS.description,
  freshness: CKAN_SERVER_WORDS.freshness,
  configuration: {
    addressVariable: CKAN_ADDRESS_VARIABLE,
    requirement: 'optional',
  },
  tools: [],
  toolNames: [],
  guidance: NO_GUIDANCE,
  hostings: [
    {
      variant: 'remote',
      kind: 'remote',
      runsAt: 'other',
      logging: [
        { statedBy: 'instance', role: 'server-operator' },
        { statedBy: 'instance', role: 'portal-operator' },
      ],
    },
  ],
  consentDefault: 'on',
  publisher: CKAN_SERVER_WORDS.publisher,
};
