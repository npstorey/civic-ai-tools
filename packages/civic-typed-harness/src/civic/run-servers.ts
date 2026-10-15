// Run-time server addresses (CIVIC layer) — ADR-0033 §D.
//
// STUB (H2 red tree): the signature is final, the body is not.

import type { CivicSourceRegistry } from '../format/sources.ts';
import type { DatHereMcpServer } from '../format/dathere.ts';

/** The registry with each entry's `serverUrl` set to the run's address for
 *  that source id, and omitted for a source the run's list does not name. */
export function withRunServerAddresses(
  registry: CivicSourceRegistry,
  _runMcpServers: readonly DatHereMcpServer[],
): CivicSourceRegistry {
  return registry;
}
