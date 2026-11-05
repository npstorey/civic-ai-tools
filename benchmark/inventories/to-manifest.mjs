// A minimal loader from inventory entries to the router's manifest entries:
// enough for `createCivicRouter` to accept an inventory. The prototype of S2's
// loader (design §3.2, "what stays code"); it lives under `benchmark/`, not in
// the router, and S2's replaces it.
//
// FOUR KINDS OF ENTRY:
//
//   - a server whose tools are the router's own (`toolsRef.kind:
//     router-manifest`): the router's manifest entry for that source id, the
//     same object, so a composition over it is the one the website builds
//     today (its prompt parts, its portal lock and its guidance are the
//     router's code). Before handing it back, the loader holds the inventory
//     to the router: every data field the inventory states, the tool names
//     and the tools' hash must equal the manifest entry's.
//   - a server whose tools are a pinned fixture (`toolsRef.kind: fixture`,
//     R5's four): its tools read from the fixture, checked against
//     `toolsRef.sha256`; no guidance.
//   - a pack: a copy of its base's tools (`toolsRef`: the router's entry or a
//     fixture server, checked against the hash), the filter noted in its
//     description, no guidance, no portal lock and no code of the base's. A
//     pack marked `hosting: container` carries the router's container
//     variant, the one hosting no instance runs (G0-5).
//   - a registry entry (`tools: not-captured`): no tools and no guidance.
//
// OFFERED LIKE ANY ENTRY. The router's configuration reader knows only the
// seven sources' variables, so an entry outside them could never be
// configured and would never be offered. The loader makes every such entry
// `requirement: required` (always offered); the benchmark calls no source, so
// nothing is reached. The inventory keeps the entry's own configuration.

import { readFileSync } from 'node:fs';
import { CIVIC_MANIFEST } from '@typedstandards/civic-typed-router';
import { r5UpstreamTools, routerDataFields, toolsSha256 } from './build.mjs';

const REPO = new URL('../../', import.meta.url);

/** A blank guidance: the router leaves a source with blank guidance out of
 *  the composed prompt's guidance blocks. */
const NO_GUIDANCE = Object.freeze({ fetchText: async () => '' });

/** The container hosting: no instance runs it (ADR-0036's `container` arm). */
const CONTAINER = Object.freeze([{ kind: 'container', variant: 'container', runsAt: 'other', logging: [] }]);

/** The tools of a fixture server, by source id, from its fixture file. */
function fixtureTools(path, sourceId, cache) {
  if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(new URL(path, REPO), 'utf8')));
  const server = cache.get(path).servers.find((s) => s.entry.sourceId === sourceId);
  if (!server) throw new Error(`to-manifest: ${path} has no source ${sourceId}`);
  return r5UpstreamTools(server);
}

/** The tools a `toolsRef` names, checked against its names and hash. */
function toolsOf(item, bySourceId, cache) {
  const ref = item.toolsRef;
  let tools;
  if (ref.kind === 'router-manifest') {
    const base = bySourceId.get(ref.sourceId);
    if (!base) throw new Error(`to-manifest: ${item.alias}: the router's manifest has no source ${ref.sourceId}`);
    tools = base.tools.filter((t) => ref.toolNames.includes(t.function.name));
  } else if (ref.kind === 'fixture') {
    tools = fixtureTools(ref.path, ref.sourceId, cache);
  } else {
    throw new Error(`to-manifest: ${item.alias}: no loader for tools of kind "${ref.kind}"`);
  }
  if (JSON.stringify([...tools.map((t) => t.function.name)].sort()) !== JSON.stringify([...ref.toolNames].sort())) {
    throw new Error(`to-manifest: ${item.alias}: toolsRef.toolNames differ from the tools loaded`);
  }
  if (toolsSha256(tools) !== ref.sha256) throw new Error(`to-manifest: ${item.alias}: toolsRef.sha256 is not the hash of the tools loaded`);
  // A copy: no schema object is shared with the base.
  return structuredClone(tools);
}

function routerEntry(item, bySourceId) {
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
}

/** The manifest entry of an entry this loader builds itself. */
function builtEntry(item, tools) {
  return {
    id: item.kind === 'pack' ? `${item.author}#${item.sourceId}@${item.version}` : item.id,
    alias: item.alias,
    sourceId: item.sourceId,
    displayName: item.displayName,
    description: item.description,
    freshness: item.freshness,
    ...(item.freshnessSource !== undefined ? { freshnessSource: item.freshnessSource } : {}),
    configuration: { addressVariable: item.configuration?.addressVariable ?? `${item.alias.toUpperCase()}_PACK`, requirement: 'required' },
    tools,
    toolNames: item.toolsRef ? [...item.toolsRef.toolNames] : [],
    guidance: NO_GUIDANCE,
    hostings: item.hosting === 'container' ? CONTAINER : [],
    consentDefault: item.consentDefault ?? 'on',
  };
}

/** The manifest entries of `inventory`, in its order. Throws on an entry this
 *  loader does not build, or one that disagrees with the router or its
 *  fixture. */
export function toManifest(inventory) {
  const bySourceId = new Map(CIVIC_MANIFEST.map((entry) => [entry.sourceId, entry]));
  const cache = new Map();
  return inventory.entries.map((item) => {
    if (item.kind === 'server' && item.tools === 'not-captured') return builtEntry(item, []);
    if (item.kind === 'server' && item.toolsRef?.kind === 'router-manifest') return routerEntry(item, bySourceId);
    if ((item.kind === 'server' && item.toolsRef?.kind === 'fixture') || item.kind === 'pack') return builtEntry(item, toolsOf(item, bySourceId, cache));
    throw new Error(`to-manifest: ${item.alias}: no loader for an entry of kind "${item.kind}"`);
  });
}
