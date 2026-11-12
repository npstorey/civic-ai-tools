// A server tool's schema hash (hub #317, S2-C P1, A1.2): `mcpToolSchemaSha256`
// over the charter's two worked cases (section 4), the two wrong walks it
// tells apart, and the canonicalizer for whole JSON values beneath it.
//
// The worked cases are the contract both implementations meet: this router's,
// and the copy socrata-mcp-server's pinned-identity test carries.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { canonicalJsonValue, CanonicalJsonValueError, mcpToolSchemaSha256, mcpToolSchemaText, schemaWithoutAnnotations, type McpListedTool } from './index.ts';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Case 1, as the charter states it. */
const CASE_1 = {
  name: 'v',
  inputSchema: {
    type: 'object',
    title: 'T',
    description: 'D',
    properties: {
      description: { type: 'string', description: 'an argument named description' },
      n: { type: 'integer', minimum: 1, description: 'x' },
      flag: { type: 'boolean', default: false },
      tags: { type: 'array', items: { type: 'string', description: 'y' } },
    },
    required: ['description'],
    additionalProperties: false,
  },
} as const;

/** Case 2: case 1 with `opts`, whose `default` is data and whose `anyOf` item
 *  is a subschema. */
const CASE_2 = {
  ...CASE_1,
  inputSchema: {
    ...CASE_1.inputSchema,
    properties: {
      ...CASE_1.inputSchema.properties,
      opts: {
        type: 'object',
        description: 'z',
        default: { description: 'data, not a keyword' },
        anyOf: [{ type: 'object', title: "a subschema's title" }],
      },
    },
  },
} as const;

const CASE_1_TEXT =
  '{"inputSchema":{"additionalProperties":false,"properties":{"description":{"type":"string"},"flag":{"default":false,"type":"boolean"},"n":{"minimum":1,"type":"integer"},"tags":{"items":{"type":"string"},"type":"array"}},"required":["description"],"type":"object"},"name":"v"}';
const CASE_2_TEXT =
  '{"inputSchema":{"additionalProperties":false,"properties":{"description":{"type":"string"},"flag":{"default":false,"type":"boolean"},"n":{"minimum":1,"type":"integer"},"opts":{"anyOf":[{"type":"object"}],"default":{"description":"data, not a keyword"},"type":"object"},"tags":{"items":{"type":"string"},"type":"array"}},"required":["description"],"type":"object"},"name":"v"}';
const CASE_1_SHA256 = '7d059d0a5564530b86cd74e9c72269f9d507e1a93eb26979666a89eb8e8455eb';
const CASE_2_SHA256 = 'd79d93f1d11b85e4fc07d6c4b73fd7c4880bca58555c159bed96e30a57984852';
/** The two wrong walks case 2 tells apart. */
const STRIPS_INSIDE_DEFAULT = '2ab850b0a2234575312daea5512685b5f2e620d47fa17723909f34cf390a792a';
const SKIPS_ANYOF = '1aff7763977b498874f890f3ad91bd35e437c7c8a80d8812b8add338a06b15e7';

test('A1.2: both worked cases give the charter\'s canonical text and SHA-256', () => {
  assert.equal(mcpToolSchemaText(CASE_1), CASE_1_TEXT);
  assert.equal(mcpToolSchemaSha256(CASE_1), CASE_1_SHA256);
  assert.equal(sha256(CASE_1_TEXT), CASE_1_SHA256, 'the stated text hashes to the stated hash');
  assert.equal(mcpToolSchemaText(CASE_2), CASE_2_TEXT);
  assert.equal(mcpToolSchemaSha256(CASE_2), CASE_2_SHA256);
  assert.equal(sha256(CASE_2_TEXT), CASE_2_SHA256);
});

/** A walk that also strips `title` and `description` inside data. */
function stripEverywhere(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEverywhere);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => k !== 'title' && k !== 'description')
      .map(([k, v]) => [k, k === 'properties' ? Object.fromEntries(Object.entries(v as object).map(([n, s]) => [n, stripEverywhere(s)])) : stripEverywhere(v)]),
  );
}

/** A walk that treats `anyOf` as data. */
function stripSkippingAnyOf(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'title' || k === 'description') continue;
    if (k === 'properties') out[k] = Object.fromEntries(Object.entries(v as object).map(([n, s]) => [n, stripSkippingAnyOf(s)]));
    else if (k === 'items') out[k] = stripSkippingAnyOf(v);
    else out[k] = v;
  }
  return out;
}

test('A1.2: the two wrong walks give the charter\'s wrong hashes through the same serializer, and the router\'s walk gives neither', () => {
  const wrong = (walk: (schema: unknown) => unknown) => sha256(canonicalJsonValue({ name: CASE_2.name, inputSchema: walk(CASE_2.inputSchema) }));
  assert.equal(wrong(stripEverywhere), STRIPS_INSIDE_DEFAULT);
  assert.equal(wrong(stripSkippingAnyOf), SKIPS_ANYOF);
  for (const hash of [STRIPS_INSIDE_DEFAULT, SKIPS_ANYOF]) {
    assert.notEqual(mcpToolSchemaSha256(CASE_1), hash);
    assert.notEqual(mcpToolSchemaSha256(CASE_2), hash);
  }
});

test('A1.2: a reworded description hashes the same; a changed type, a renamed argument, a moved required or a moved enum hash differently', () => {
  const tool = structuredClone(CASE_1) as unknown as { name: string; inputSchema: { properties: Record<string, Record<string, unknown>>; required: string[] } };
  const reworded = structuredClone(tool);
  reworded.inputSchema.properties.n!.description = 'a reworded description';
  (reworded.inputSchema as Record<string, unknown>).description = 'another top-level description';
  assert.equal(mcpToolSchemaSha256(reworded), CASE_1_SHA256);
  // The tool's own description and title are outside the hash.
  assert.equal(mcpToolSchemaSha256({ ...tool, description: 'listed text', title: 'Listed title', annotations: { readOnlyHint: true } }), CASE_1_SHA256);

  const typed = structuredClone(tool);
  typed.inputSchema.properties.n!.type = 'number';
  assert.notEqual(mcpToolSchemaSha256(typed), CASE_1_SHA256);
  const renamed = structuredClone(tool);
  renamed.inputSchema.properties.m = renamed.inputSchema.properties.n!;
  delete renamed.inputSchema.properties.n;
  assert.notEqual(mcpToolSchemaSha256(renamed), CASE_1_SHA256);
  const required = structuredClone(tool);
  required.inputSchema.required = ['description', 'n'];
  assert.notEqual(mcpToolSchemaSha256(required), CASE_1_SHA256);
  const enumerated = structuredClone(tool);
  enumerated.inputSchema.properties.description!.enum = ['a', 'b'];
  assert.notEqual(mcpToolSchemaSha256(enumerated), CASE_1_SHA256);
  // The name sent on the wire is inside it.
  assert.notEqual(mcpToolSchemaSha256({ ...tool, name: 'w' }), CASE_1_SHA256);
});

test('the walk: every named schema keyword is walked, data keywords and unnamed keywords are kept whole, the input is not changed', () => {
  const s = (extra: Record<string, unknown>) => ({ type: 'string', title: 't', description: 'd', ...extra });
  const schema = {
    $defs: { a: s({}) },
    definitions: { b: s({}) },
    patternProperties: { '^x': s({}) },
    dependentSchemas: { c: s({}) },
    items: [s({}), s({})],
    additionalProperties: s({}),
    not: s({}),
    if: s({}),
    then: s({}),
    else: s({}),
    contains: s({}),
    propertyNames: s({}),
    oneOf: [s({})],
    allOf: [s({})],
    prefixItems: [s({})],
    const: { title: 'kept' },
    enum: [{ description: 'kept' }],
    examples: [{ title: 'kept' }],
    additionalItems: s({}),
    unevaluatedProperties: s({}),
    unevaluatedItems: s({}),
    dependencies: { d: s({}) },
    contentSchema: s({}),
  };
  const before = JSON.stringify(schema);
  const out = schemaWithoutAnnotations(schema) as Record<string, unknown>;
  assert.equal(JSON.stringify(schema), before, 'the input is not changed');
  const bare = { type: 'string' };
  for (const k of ['$defs', 'definitions', 'patternProperties', 'dependentSchemas']) {
    assert.deepEqual(Object.values(out[k] as object), [bare], k);
  }
  for (const k of ['additionalProperties', 'not', 'if', 'then', 'else', 'contains', 'propertyNames']) assert.deepEqual(out[k], bare, k);
  for (const k of ['items', 'oneOf', 'allOf', 'prefixItems']) assert.ok((out[k] as unknown[]).every((item) => JSON.stringify(item) === JSON.stringify(bare)), k);
  for (const k of ['const', 'enum', 'examples', 'additionalItems', 'unevaluatedProperties', 'unevaluatedItems', 'dependencies', 'contentSchema']) {
    assert.deepEqual(out[k], schema[k as keyof typeof schema], `${k} is kept whole`);
  }
  // A boolean schema is kept as it is.
  assert.deepEqual(schemaWithoutAnnotations({ items: true, additionalProperties: false }), { items: true, additionalProperties: false });
});

test('mcpToolSchemaSha256 refuses a tool with no string name or no inputSchema, and a schema JSON cannot carry', () => {
  assert.throws(() => mcpToolSchemaSha256({ inputSchema: {} } as unknown as McpListedTool), TypeError);
  assert.throws(() => mcpToolSchemaSha256({ name: 'x' } as unknown as McpListedTool), /the tool "x" has no inputSchema/);
  assert.throws(() => mcpToolSchemaSha256({ name: 'x', inputSchema: { minimum: Number.NaN } }), CanonicalJsonValueError);
});

test('canonicalJsonValue: RFC 8785 for every JSON value type', () => {
  assert.equal(canonicalJsonValue({ b: [true, false, null], a: 1, c: 'x' }), '{"a":1,"b":[true,false,null],"c":"x"}');
  // ECMAScript's number form, as RFC 8785 §3.2.2.3 states it.
  assert.equal(canonicalJsonValue([0, -0, 1.5, 1e21, 1e-7, 100, 0.1, -3]), '[0,0,1.5,1e+21,1e-7,100,0.1,-3]');
  // Names by UTF-16 code units, strings as JSON.stringify writes them.
  assert.equal(canonicalJsonValue({ 'é': 1, z: 2, '\u0080': 3, A: 4 }), '{"A":4,"z":2,"\u0080":3,"é":1}');
  assert.equal(canonicalJsonValue('a"b\\c\n\u0001'), '"a\\"b\\\\c\\n\\u0001"');
  assert.equal(canonicalJsonValue({}), '{}');
  assert.equal(canonicalJsonValue([]), '[]');
  for (const [value, path] of [
    [undefined, '$'],
    [{ a: undefined }, '$.a'],
    [[1, Number.POSITIVE_INFINITY], '$[1]'],
    [{ f: () => 1 }, '$.f'],
    [10n, '$'],
    [new Date(0), '$'],
    [{ [Symbol('s')]: 1 }, '$'],
    // eslint-disable-next-line no-sparse-arrays
    [[1, , 3], '$[1]'],
  ] as [unknown, string][]) {
    assert.throws(() => canonicalJsonValue(value), (error: unknown) => error instanceof CanonicalJsonValueError && error.path === path, String(path));
  }
});
