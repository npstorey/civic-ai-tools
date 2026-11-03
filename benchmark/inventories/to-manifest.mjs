// A minimal loader from inventory entries to the router's manifest entries:
// enough for `createCivicRouter` to accept an inventory. The prototype of S2's
// loader (design §3.2, "what stays code"); it lives under `benchmark/`, not in
// the router, and S2's replaces it.
//
// This phase loads one kind: an entry whose tools are the router's own
// (`toolsRef.kind: router-manifest`). It becomes the router's manifest entry
// for that source id, the same object, so a composition over it is the one the
// website builds today: its prompt parts, its portal lock and its guidance
// are the router's code. Before handing the entry back, the loader holds the
// inventory to the router: every data field the inventory states, the tool
// names and the tools' hash must equal the manifest entry's, so an inventory
// cannot drift from the router it claims to copy.
//
// Pack entries and entries with pinned fixtures of their own are P1's: the
// loader refuses them by name rather than guess their shape.

import { CIVIC_MANIFEST } from '@typedstandards/civic-typed-router';
import { routerDataFields, toolsSha256 } from './build.mjs';

/** The manifest entries of `inventory`, in its order. Throws on an entry this
 *  loader does not build, or one that disagrees with the router. */
export function toManifest(inventory) {
  const bySourceId = new Map(CIVIC_MANIFEST.map((entry) => [entry.sourceId, entry]));
  return inventory.entries.map((item) => {
    const kind = item.kind === 'server' ? item.toolsRef?.kind : item.kind;
    if (kind !== 'router-manifest') {
      throw new Error(`to-manifest: ${item.alias}: entries of kind "${kind}" are loaded from P1 on; this loader builds router-manifest entries only`);
    }
    const entry = bySourceId.get(item.toolsRef.sourceId);
    if (!entry) throw new Error(`to-manifest: ${item.alias}: the router's manifest has no source ${item.toolsRef.sourceId}`);
    const expected = routerDataFields(entry);
    const stated = Object.fromEntries(Object.keys(expected).map((key) => [key, item[key]]));
    const extra = ['freshnessSource', 'publisher'].filter((key) => item[key] !== undefined && expected[key] === undefined);
    if (JSON.stringify(stated) !== JSON.stringify(expected) || extra.length) {
      throw new Error(`to-manifest: ${item.alias}: the inventory's data fields differ from the router's manifest entry`);
    }
    if (JSON.stringify(item.toolsRef.toolNames) !== JSON.stringify(entry.toolNames)) {
      throw new Error(`to-manifest: ${item.alias}: toolsRef.toolNames differ from the router's`);
    }
    if (item.toolsRef.sha256 !== toolsSha256(entry.tools)) {
      throw new Error(`to-manifest: ${item.alias}: toolsRef.sha256 is not the hash of the router's tools`);
    }
    return entry;
  });
}
