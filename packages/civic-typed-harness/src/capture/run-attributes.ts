// Run-attribute extraction (CAPTURE group) — reads the facts the producer
// recorded on the trace's ROOT span at run time (ADR-0033 §D, §E): the date
// the prompt asserted, the servers the run had, the tools it offered, the
// sources it was offered and the components that composed its prompt.
//
// STUB (H2 red tree): the shape is final, the body is not.

/** One server the run had, as the root span recorded it. */
export interface RunMcpServer {
  url: string;
  name?: string;
}

/** What the root span carried, under the derivation's input names. A field
 *  is absent when its attribute is. */
export interface ExtractedRunAttributes {
  assertedDate?: string;
  runMcpServers?: RunMcpServer[];
  toolDefinitions?: Array<Record<string, unknown>>;
  sourcesOffered?: Array<{ sourceId: string; alias: string; reason: string }>;
  components?: Array<{ id: string; version?: string; guidanceHash?: string; guidanceOrigin?: string }>;
}

/** A root-span attribute that is present but not the shape ADR-0033 names. */
export class RunAttributeError extends Error {
  /** The span attribute that failed to parse. */
  readonly attribute: string;
  constructor(attribute: string, message: string) {
    super(`${attribute}: ${message}`);
    this.name = 'RunAttributeError';
    this.attribute = attribute;
  }
}

/** Read the run attributes from a trace's root span. */
export function extractRunAttributes(
  _trace: Record<string, unknown>,
): ExtractedRunAttributes {
  return {};
}
