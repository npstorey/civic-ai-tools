// A server's tool, hashed as its arguments' schema (the route-identity
// design §2.2; the conventions ADR, ADR-0039).
//
// `mcpToolSchemaSha256(tool)` is the lowercase hex SHA-256 of the RFC 8785
// canonical JSON (`canonicalJsonValue`) of `{ name, inputSchema }`, as the
// server's own `tools/list` returned the tool, with the annotation keywords
// `title` and `description` removed from every schema object. Every other
// member of the tool (its `description`, `title`, `annotations`,
// `outputSchema`) is outside the hash. So the hash moves when an argument's
// name, type, enumeration, `required` or `additionalProperties` moves, and
// not when a server rewords a description or writes its settings into one.
//
// The walk, which decides what is a schema object:
//
//   - `properties`, `patternProperties`, `$defs`, `definitions` and
//     `dependentSchemas` hold schemas by name: each member's value is walked,
//     and the names are kept (an argument named `description` or `title`
//     stays);
//   - `items`, `additionalProperties`, `not`, `if`, `then`, `else`,
//     `contains` and `propertyNames` hold one schema, walked; `items` holding
//     an array is a list, each item walked;
//   - `anyOf`, `oneOf`, `allOf` and `prefixItems` hold a list of schemas,
//     each walked;
//   - every other member is kept whole and not walked: the data keywords
//     (`default`, `const`, `enum`, `examples`), and every keyword the rule
//     does not name (`additionalItems`, `unevaluatedProperties`,
//     `unevaluatedItems`, `dependencies`, `contentSchema` among them).
//
// A schema that is not a plain object (a boolean schema) is kept as it is.

import { canonicalJsonValue } from './canonical-json-value.ts';
import { sha256Hex } from './sha256.ts';

/** A tool as a server's `tools/list` returns it: a name and an input schema,
 *  and members the hash does not read. */
export interface McpListedTool {
  readonly name: string;
  readonly inputSchema: unknown;
  readonly [member: string]: unknown;
}

/** The annotation keywords removed from every schema object. */
const ANNOTATIONS: readonly string[] = ['title', 'description'];
/** Keywords whose value maps names to schemas. */
const SCHEMA_MAPS: readonly string[] = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'];
/** Keywords whose value is one schema (`items` may also be a list). */
const SCHEMA_ONE: readonly string[] = ['items', 'additionalProperties', 'not', 'if', 'then', 'else', 'contains', 'propertyNames'];
/** Keywords whose value is a list of schemas. */
const SCHEMA_LISTS: readonly string[] = ['anyOf', 'oneOf', 'allOf', 'prefixItems'];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** `schema` with `title` and `description` removed from it and from every
 *  schema object the walk reaches. A new value; the input is not changed. */
export function schemaWithoutAnnotations(schema: unknown): unknown {
  if (!isPlainObject(schema)) return schema;
  const out: Record<string, unknown> = {};
  for (const [keyword, value] of Object.entries(schema)) {
    if (ANNOTATIONS.includes(keyword)) continue;
    if (SCHEMA_MAPS.includes(keyword) && isPlainObject(value)) {
      out[keyword] = Object.fromEntries(Object.entries(value).map(([name, member]) => [name, schemaWithoutAnnotations(member)]));
    } else if (SCHEMA_ONE.includes(keyword)) {
      out[keyword] = keyword === 'items' && Array.isArray(value) ? value.map(schemaWithoutAnnotations) : schemaWithoutAnnotations(value);
    } else if (SCHEMA_LISTS.includes(keyword) && Array.isArray(value)) {
      out[keyword] = value.map(schemaWithoutAnnotations);
    } else {
      out[keyword] = value;
    }
  }
  return out;
}

/** The text `mcpToolSchemaSha256` hashes: the canonical JSON of
 *  `{ name, inputSchema }`, the schema's annotations removed. Throws
 *  `TypeError` for a tool with no string `name`, and
 *  `CanonicalJsonValueError` for a schema JSON cannot carry. */
export function mcpToolSchemaText(tool: McpListedTool): string {
  if (tool === null || typeof tool !== 'object' || typeof tool.name !== 'string') {
    throw new TypeError('mcpToolSchemaSha256: a tool is an object with a string name');
  }
  if (!Object.hasOwn(tool, 'inputSchema')) throw new TypeError(`mcpToolSchemaSha256: the tool "${tool.name}" has no inputSchema`);
  return canonicalJsonValue({ name: tool.name, inputSchema: schemaWithoutAnnotations(tool.inputSchema) });
}

/** A server tool's schema hash: the lowercase hex SHA-256 of
 *  `mcpToolSchemaText(tool)`. */
export function mcpToolSchemaSha256(tool: McpListedTool): string {
  return sha256Hex(mcpToolSchemaText(tool));
}
