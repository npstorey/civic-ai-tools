// Run-attribute extraction (CAPTURE group) — reads the facts the producer
// recorded on the trace's ROOT span at run time (ADR-0033 §D, §E): the date
// the prompt asserted, the servers the run had, the tools it offered, the
// sources it was offered, the components that composed its prompt, the
// flows statement in force (by reference: address, hash and date), for an
// in-loop run, how its sources were chosen and the hash of its harness
// definition (ADR-0033 amendment 2), the inventory the run was routed
// against with how many of its entries the model was shown (amendment 3),
// and the routing configuration the run was routed under, with its hash
// (amendment 5).
//
// WHY THE TRACE (civic-ai-tools-website#495). A record is packaged after the
// run, sometimes much later; a fact read at packaging is packaging-time state.
// The trace is the one artifact that travels from the run to the package, so
// the producer writes each run-time fact there and this module reads it back.
//
// SHAPE, NOT POLICY. This module checks that each attribute parses as the
// shape ADR-0033 names (JSON text of an array of objects whose named fields
// are strings; for `analysis.flows_statement`, of one object of exactly three
// strings; for `analysis.routing`, of one object of exactly two; for
// `analysis.considered`, of one object of exactly five keys, whose
// `inventory` is one object of exactly three strings; for
// `analysis.routing_configuration`, of one object of exactly five members,
// each a string or an object of exactly its strings) and returns it under
// the derivation's input names. The values — the date form, the reason set,
// the hash forms, the origin set, the address form, the routing method set,
// the inventory version's form and the counts, the cap's and the search's
// forms and the routing configuration's hash — are policy, checked by the
// format group's derivation, which refuses a bad one by name.
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
  components?: Array<{ id: string; version?: string; guidanceHash?: string; guidanceOrigin?: string; reportedName?: string; reportedVersion?: string }>;
  flowsStatement?: { url: string; hash: string; date: string };
  routing?: { method: string; version: string };
  definitionHash?: string;
  considered?: {
    inventory: { id: string; version: string; hash: string };
    total: number;
    listed: number;
    rule: string;
    ruleVersion: string;
  };
  routingConfiguration?: ExtractedRoutingConfiguration;
}

/** `analysis.routing_configuration` as the extractor returns it (ADR-0033
 *  amendment 5): the routing configuration's four members and its hash. */
export interface ExtractedRoutingConfiguration {
  rule: { id: string; version: string };
  cap: string;
  search: string | { method: string; version: string };
  inventory: { id: string; version: string; hash: string };
  hash: string;
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

/** Parse `analysis.considered` (ADR-0033 amendment 3): JSON text of ONE
 *  object whose keys are exactly `inventory`, `total`, `listed`, `rule` and
 *  `ruleVersion`, with `inventory` one object of exactly the strings `id`,
 *  `version` and `hash`, `total` and `listed` JSON numbers, and `rule` and
 *  `ruleVersion` strings. Shape only: the counts' integer rule, the hash and
 *  version forms and the non-empty rule are the derivation's. */
function consideredObject(
  attribute: string,
  text: string,
): NonNullable<ExtractedRunAttributes['considered']> {
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
  const fields = ['inventory', 'total', 'listed', 'rule', 'ruleVersion'];
  for (const field of fields) {
    if (!Object.hasOwn(entry, field)) {
      throw new RunAttributeError(attribute, `has no ${field}`);
    }
  }
  const extra = Object.keys(entry).filter((k) => !fields.includes(k));
  if (extra.length > 0) {
    throw new RunAttributeError(attribute, `has a field outside ${fields.join(', ')}: ${extra.map((k) => JSON.stringify(k)).join(', ')}`);
  }
  const inventory = entry.inventory;
  if (inventory === null || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw new RunAttributeError(attribute, 'inventory is not a JSON object');
  }
  const inventoryFields = ['id', 'version', 'hash'];
  for (const field of inventoryFields) {
    if (typeof (inventory as Record<string, unknown>)[field] !== 'string') {
      throw new RunAttributeError(attribute, `inventory has no string ${field}`);
    }
  }
  const extraInventory = Object.keys(inventory).filter((k) => !inventoryFields.includes(k));
  if (extraInventory.length > 0) {
    throw new RunAttributeError(attribute, `inventory has a field outside ${inventoryFields.join(', ')}: ${extraInventory.map((k) => JSON.stringify(k)).join(', ')}`);
  }
  for (const field of ['total', 'listed']) {
    if (typeof entry[field] !== 'number') {
      throw new RunAttributeError(attribute, `${field} is not a JSON number`);
    }
  }
  for (const field of ['rule', 'ruleVersion']) {
    if (typeof entry[field] !== 'string') {
      throw new RunAttributeError(attribute, `has no string ${field}`);
    }
  }
  const { id, version, hash } = inventory as Record<string, string>;
  return {
    inventory: { id, version, hash },
    total: entry.total as number,
    listed: entry.listed as number,
    rule: entry.rule as string,
    ruleVersion: entry.ruleVersion as string,
  };
}

/** One nested object of exactly `fields`, each a string, for
 *  `analysis.routing_configuration`'s `member`. */
function nestedStringObject(
  attribute: string,
  member: string,
  value: unknown,
  fields: readonly string[],
): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RunAttributeError(attribute, `${member} is not a JSON object`);
  }
  for (const field of fields) {
    if (typeof (value as Record<string, unknown>)[field] !== 'string') {
      throw new RunAttributeError(attribute, `${member} has no string ${field}`);
    }
  }
  const extra = Object.keys(value).filter((k) => !fields.includes(k));
  if (extra.length > 0) {
    throw new RunAttributeError(attribute, `${member} has a field outside ${fields.join(', ')}: ${extra.map((k) => JSON.stringify(k)).join(', ')}`);
  }
  return value as Record<string, string>;
}

/** Parse `analysis.routing_configuration` (ADR-0033 amendment 5): JSON text
 *  of ONE object whose members are exactly `rule`, `cap`, `search`,
 *  `inventory` and `hash`; `rule` one object of exactly the strings `id` and
 *  `version`; `cap` a string; `search` a string or one object of exactly the
 *  strings `method` and `version`; `inventory` one object of exactly the
 *  strings `id`, `version` and `hash`; `hash` a string. Shape only, returned
 *  in the record's member order: the cap's and the search's forms, the
 *  non-empty strings, the hash forms and the hash's value are the
 *  derivation's. */
function routingConfigurationObject(
  attribute: string,
  text: string,
): ExtractedRoutingConfiguration {
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
  const fields = ['rule', 'cap', 'search', 'inventory', 'hash'];
  for (const field of fields) {
    if (!Object.hasOwn(entry, field)) {
      throw new RunAttributeError(attribute, `has no ${field}`);
    }
  }
  const extra = Object.keys(entry).filter((k) => !fields.includes(k));
  if (extra.length > 0) {
    throw new RunAttributeError(attribute, `has a field outside ${fields.join(', ')}: ${extra.map((k) => JSON.stringify(k)).join(', ')}`);
  }
  const rule = nestedStringObject(attribute, 'rule', entry.rule, ['id', 'version']);
  if (typeof entry.cap !== 'string') {
    throw new RunAttributeError(attribute, 'cap is not a string');
  }
  let search: ExtractedRoutingConfiguration['search'];
  if (typeof entry.search === 'string') {
    search = entry.search;
  } else {
    const { method, version } = nestedStringObject(attribute, 'search', entry.search, ['method', 'version']);
    search = { method, version };
  }
  const inventory = nestedStringObject(attribute, 'inventory', entry.inventory, ['id', 'version', 'hash']);
  if (typeof entry.hash !== 'string') {
    throw new RunAttributeError(attribute, 'hash is not a string');
  }
  return {
    rule: { id: rule.id, version: rule.version },
    cap: entry.cap,
    search,
    inventory: { id: inventory.id, version: inventory.version, hash: inventory.hash },
    hash: entry.hash,
  };
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
    out.components = objectArray('analysis.components', components, ['id'], ['version', 'guidanceHash', 'guidanceOrigin', 'reportedName', 'reportedVersion']) as unknown as ExtractedRunAttributes['components'];
  }

  const flows = stringAttr(root, 'analysis.flows_statement');
  if (flows !== undefined) {
    const { url, hash, date } = exactStringObject('analysis.flows_statement', flows, ['url', 'hash', 'date']);
    out.flowsStatement = { url, hash, date };
  }

  const routing = stringAttr(root, 'analysis.routing');
  if (routing !== undefined) {
    const { method, version } = exactStringObject('analysis.routing', routing, ['method', 'version']);
    out.routing = { method, version };
  }

  const definitionHash = stringAttr(root, 'analysis.definition_hash');
  if (definitionHash !== undefined) out.definitionHash = definitionHash;

  const considered = stringAttr(root, 'analysis.considered');
  if (considered !== undefined) out.considered = consideredObject('analysis.considered', considered);

  // Read by key, not through `stringAttr`: an attribute that is present and
  // carries no text is refused, never read as absent (ADR-0033 amendment 5).
  const routingConfiguration = root.attributes?.find((a) => a.key === 'analysis.routing_configuration');
  if (routingConfiguration !== undefined) {
    const text = routingConfiguration.value?.stringValue;
    if (typeof text !== 'string') {
      throw new RunAttributeError('analysis.routing_configuration', 'is not text');
    }
    out.routingConfiguration = routingConfigurationObject('analysis.routing_configuration', text);
  }

  return out;
}
