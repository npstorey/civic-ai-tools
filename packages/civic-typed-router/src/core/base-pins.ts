// A pack's base pins, and the check a consumer runs before it sends a pack's
// call (the route-identity design §2.2; the conventions ADR, ADR-0039).
//
// A pin states what the base server reported when the pin was captured: its
// `serverInfo.name` and `serverInfo.version`, and `mcpToolSchemaSha256` of
// each base tool the pack calls, by the name sent on the wire. A pack states
// one pin normally, and two while a release of its base is staged.
//
// `checkBasePins(pins, observed)` compares what the live base reports with
// each pin, and decides nothing beyond the comparison: it returns a match
// (the first pin the observation equals) or, for each pin, its first
// difference. What the consumer does on a difference is the consumer's. A
// tool the base lists and the pin does not name is not compared, so a base
// that adds a tool, or changes one the pack never calls, still matches. A
// pinned member the live base does not state counts as a difference.
//
// Pure: it reads nothing but its arguments.

import { mcpToolSchemaSha256, type McpListedTool } from './mcp-tool-schema.ts';

/** One pin: what the base reported when the pin was captured. */
export interface BasePin {
  readonly serverName: string;
  readonly serverVersion: string;
  /** `mcpToolSchemaSha256` of each base tool the pack calls, by name. */
  readonly tools: { readonly [toolName: string]: string };
}

/** What the live base reported: `serverInfo`'s name and version where it
 *  stated them, and its `tools/list` tools as listed (every page). */
export interface ObservedBase {
  readonly serverName?: string;
  readonly serverVersion?: string;
  readonly tools: readonly McpListedTool[];
}

/** One pin's first difference from the observation. */
export interface BasePinDifference {
  /** The pin's position in the list. */
  readonly pin: number;
  /** `serverName`, `serverVersion`, or `tools.<name>`. */
  readonly member: string;
  readonly pinned: string;
  /** What the base reported; absent when it stated nothing for the member
   *  (a version it did not state, a tool it did not list). For a tool
   *  listed more than once, `listed <n> times`. */
  readonly observed?: string;
}

/** A match, naming the pin the observation equals; or each pin's first
 *  difference, in the pins' order. */
export type BasePinCheck =
  | { readonly ok: true; readonly pin: number }
  | { readonly ok: false; readonly differences: readonly BasePinDifference[] };

function firstDifference(pin: BasePin, index: number, observed: ObservedBase, listed: ReadonlyMap<string, readonly McpListedTool[]>): BasePinDifference | undefined {
  const of = (member: string, pinned: string, seen: string | undefined): BasePinDifference => ({
    pin: index,
    member,
    pinned,
    ...(seen !== undefined ? { observed: seen } : {}),
  });
  if (observed.serverName !== pin.serverName) return of('serverName', pin.serverName, observed.serverName);
  if (observed.serverVersion !== pin.serverVersion) return of('serverVersion', pin.serverVersion, observed.serverVersion);
  for (const [name, pinned] of Object.entries(pin.tools)) {
    const tools = listed.get(name) ?? [];
    if (tools.length === 0) return of(`tools.${name}`, pinned, undefined);
    if (tools.length > 1) return of(`tools.${name}`, pinned, `listed ${tools.length} times`);
    const hash = mcpToolSchemaSha256(tools[0]!);
    if (hash !== pinned) return of(`tools.${name}`, pinned, hash);
  }
  return undefined;
}

/** Compare the live base with each pin, in order: the first pin it equals
 *  is a match. Throws `TypeError` for an empty list of pins. */
export function checkBasePins(pins: readonly BasePin[], observed: ObservedBase): BasePinCheck {
  if (!Array.isArray(pins) || pins.length === 0) throw new TypeError('checkBasePins: a pack states at least one pin');
  const listed = new Map<string, McpListedTool[]>();
  for (const tool of observed.tools) listed.set(tool.name, [...(listed.get(tool.name) ?? []), tool]);
  const differences: BasePinDifference[] = [];
  for (const [index, pin] of pins.entries()) {
    const difference = firstDifference(pin, index, observed, listed);
    if (difference === undefined) return { ok: true, pin: index };
    differences.push(difference);
  }
  return { ok: false, differences };
}
