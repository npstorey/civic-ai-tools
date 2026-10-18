// Run-attribute extraction (CAPTURE group) — reads the facts the producer
// recorded on the trace's ROOT span at run time (ADR-0033 §D, §E): the date
// the prompt asserted, the servers the run had, the tools it offered, the
// sources it was offered, the components that composed its prompt, and the
// flows statement in force (by reference: address, hash and date).
//
// WHY THE TRACE (civic-ai-tools-website#495). A record is packaged after the
// run, sometimes much later; a fact read at packaging is packaging-time state.
// The trace is the one artifact that travels from the run to the package, so
// the producer writes each run-time fact there and this module reads it back.
//
// SHAPE, NOT POLICY. This module checks that each attribute parses as the
// shape ADR-0033 names (JSON text of an array of objects whose named fields
// are strings; for `analysis.flows_statement`, of one object of exactly three
// strings) and returns it under the derivation's input names. The values —
// the date form, the reason set, the hash form, the origin set, the address
// form — are policy, checked by the format group's derivation, which refuses
// a bad one by name.
//
// An ABSENT attribute is an absent field. A PRESENT attribute that does not
// parse is refused with `RunAttributeError`, never read as absent: absence
// here would hand the caller back to its packaging-time state, which is the
// defect this module exists to remove.

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
  flowsStatement?: { url: string; hash: string; date: string };
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

interface RootSpanLike {
  name?: string;
  parentSpanId?: string;
  attributes?: Array<{ key: string; value?: { stringValue?: string } }>;
}

/** The trace's root span: the first span with no parent. */
function rootSpan(trace: Record<string, unknown>): RootSpanLike | undefined {
  // Untyped walk over the caller's trace shape, as skill extraction does.
  const spans = (trace as any)?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans;
  if (!Array.isArray(spans)) return undefined;
  return (spans as RootSpanLike[]).find((s) => s && !s.parentSpanId);
}

function stringAttr(span: RootSpanLike, key: string): string | undefined {
  const attr = span.attributes?.find((a) => a.key === key);
  return attr?.value?.stringValue;
}

/** Parse an attribute as JSON text of an array of plain objects, each of
 *  whose `required` fields is a string and each of whose `optional` fields,
 *  when present, is a string. */
function objectArray(
  attribute: string,
  text: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Array<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RunAttributeError(attribute, 'is not JSON text');
  }
  if (!Array.isArray(parsed)) {
    throw new RunAttributeError(attribute, 'is not a JSON array');
  }
  parsed.forEach((entry, i) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new RunAttributeError(attribute, `entry ${i} is not an object`);
    }
    for (const field of required) {
      if (typeof (entry as Record<string, unknown>)[field] !== 'string') {
        throw new RunAttributeError(attribute, `entry ${i} has no string ${field}`);
      }
    }
    for (const field of optional) {
      const value = (entry as Record<string, unknown>)[field];
      if (value !== undefined && typeof value !== 'string') {
        throw new RunAttributeError(attribute, `entry ${i}: ${field} is not a string`);
      }
    }
  });
  return parsed as Array<Record<string, unknown>>;
}

/** Parse an attribute as JSON text of ONE plain object whose fields are
 *  exactly `fields`, each a string: a missing field, a non-string field and
 *  an extra field are each refused. The field set is closed because the
 *  object lands in the record whole; an extra field would otherwise either
 *  reach signed bytes unchecked or be dropped silently. */
function exactStringObject(
  attribute: string,
  text: string,
  fields: readonly string[],
): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RunAttributeError(attribute, 'is not JSON text');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RunAttributeError(attribute, 'is not a JSON object');
  }
  const entry = parsed as Record<string, unknown>;
  for (const field of fields) {
    if (typeof entry[field] !== 'string') {
      throw new RunAttributeError(attribute, `has no string ${field}`);
    }
  }
  const extra = Object.keys(entry).filter((k) => !fields.includes(k));
  if (extra.length > 0) {
    throw new RunAttributeError(attribute, `has a field outside ${fields.join(', ')}: ${extra.map((k) => JSON.stringify(k)).join(', ')}`);
  }
  return entry as Record<string, string>;
}

/**
 * Read the run attributes from a trace's root span. Returns `{}` for a trace
 * with no root span — including a BlobRef trace's inspection view
 * (`traceForInspection`), whose caller passes the fields as inputs instead.
 */
export function extractRunAttributes(
  trace: Record<string, unknown>,
): ExtractedRunAttributes {
  const root = rootSpan(trace);
  if (!root) return {};
  const out: ExtractedRunAttributes = {};

  const assertedDate = stringAttr(root, 'analysis.asserted_date');
  if (assertedDate !== undefined) out.assertedDate = assertedDate;

  const servers = stringAttr(root, 'analysis.mcp_servers');
  if (servers !== undefined) {
    out.runMcpServers = objectArray('analysis.mcp_servers', servers, ['url'], ['name']) as unknown as RunMcpServer[];
  }

  const tools = stringAttr(root, 'analysis.tool_definitions');
  if (tools !== undefined) {
    out.toolDefinitions = objectArray('analysis.tool_definitions', tools, []);
  }

  const offered = stringAttr(root, 'analysis.sources_offered');
  if (offered !== undefined) {
    out.sourcesOffered = objectArray('analysis.sources_offered', offered, ['sourceId', 'alias', 'reason']) as unknown as ExtractedRunAttributes['sourcesOffered'];
  }

  const components = stringAttr(root, 'analysis.components');
  if (components !== undefined) {
    out.components = objectArray('analysis.components', components, ['id'], ['version', 'guidanceHash', 'guidanceOrigin']) as unknown as ExtractedRunAttributes['components'];
  }

  const flows = stringAttr(root, 'analysis.flows_statement');
  if (flows !== undefined) {
    const { url, hash, date } = exactStringObject('analysis.flows_statement', flows, ['url', 'hash', 'date']);
    out.flowsStatement = { url, hash, date };
  }

  return out;
}
