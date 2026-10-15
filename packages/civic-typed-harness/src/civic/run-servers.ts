// Run-time server addresses (CIVIC layer) — ADR-0033 §D,
// civic-ai-tools-website#495.
//
// The provenance graph's source agents state the address each source's
// registry entry carries. A registry built when a record is PACKAGED states
// the packaging-time configuration; this function rebuilds it from the
// servers the trace recorded at RUN time (`extractRunAttributes`'s
// `runMcpServers`), so the graph names the servers the run had.

import type { CivicSourceInfo, CivicSourceRegistry } from '../format/sources.ts';
import type { DatHereMcpServer } from '../format/dathere.ts';

/**
 * The registry with each entry's `serverUrl` set to the run's address for
 * that source id (a run-list entry's `name` is the source id), and OMITTED
 * for a source the run's list does not name: the run did not have that
 * server, so the graph states no address for it (civic-ai-tools#205's rule).
 * Every other field of an entry, the entries' order and the input registry
 * are unchanged. A run-list entry with an empty `url` names no address.
 */
export function withRunServerAddresses(
  registry: CivicSourceRegistry,
  runMcpServers: readonly DatHereMcpServer[],
): CivicSourceRegistry {
  const runAddress = new Map<string, string>();
  for (const server of runMcpServers) {
    if (server.name && server.url && !runAddress.has(server.name)) {
      runAddress.set(server.name, server.url);
    }
  }
  const out: CivicSourceRegistry = {};
  for (const [sourceId, info] of Object.entries(registry)) {
    const { serverUrl: _packagingTimeAddress, ...rest } = info;
    void _packagingTimeAddress;
    const address = runAddress.get(sourceId);
    // The graph reads each field by name, so an entry's key order is not in
    // any signed byte.
    const entry: CivicSourceInfo = address ? { ...rest, serverUrl: address } : rest;
    out[sourceId] = entry;
  }
  return out;
}
