// The first-step tool and its reserved name (ADR-0037).
//
// `aliasedLoadSourceTool` is R5's frozen `load_source` schema with its enum
// replaced by the directory's aliases, in manifest order. Its name is
// reserved: the dispatch rule accepts a bare upstream name (ADR-0032), so a
// source with a tool of that name would take a bare `load_source` call, and a
// source with that alias would be listed under the tool's own name. The
// startup check refuses both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  findToolNameProblems,
  LOAD_SOURCE_TOOL_NAME,
  readMcpEnv,
  ToolNameError,
  type CivicManifest,
  type CivicManifestEntry,
  type FunctionToolSchema,
} from './index.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

/** R5's frozen `loadSourceTool`, as its directory has it. */
const R5: { source: string; loadSourceTool: FunctionToolSchema } = JSON.parse(
  readFileSync(join(FIXTURES, 'r5-load-source-tool.json'), 'utf8'),
);

/** R5's tool with its enum replaced by `aliases`. */
function r5With(aliases: readonly string[]): FunctionToolSchema {
  const tool = structuredClone(R5.loadSourceTool) as unknown as {
    function: { parameters: { properties: { alias: { enum: string[] } } } };
  };
  tool.function.parameters.properties.alias.enum = [...aliases];
  return tool as unknown as FunctionToolSchema;
}

/** Every source on: both optional addresses, and all four hosted sources'
 *  switches (since 0.6.0, the three after Charter's too). */
const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYC_RECORD_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
});
const REQUIRED_ONLY = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });

// --- The tool ------------------------------------------------------------------------------

test('load_source: the fixture is R5\'s frozen tool, with its eleven aliases', () => {
  assert.match(R5.source, /be0874030f0c95dd6083fd3d1e8fdfae4fa956ff848c7b67d4c25c1053e5dea7/, 'the fixture names the frozen file it came from');
  assert.equal(R5.loadSourceTool.function.name, 'load_source');
  assert.equal((R5.loadSourceTool.function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum.length, 11);
});

test('load_source: with every source configured it is R5\'s tool with the seven aliases in manifest order, byte for byte', () => {
  const tool = civicRouter.aliasedLoadSourceTool({ configured: EVERY_SOURCE });
  const expected = r5With(['socrata', 'data_commons', 'boston', 'nyc_charter', 'nyc_checkbook', 'nyc_record', 'nys_legislation']);
  assert.deepEqual(tool, expected);
  assert.equal(JSON.stringify(tool), JSON.stringify(expected), 'key order too');
  assert.equal(tool.function.description, R5.loadSourceTool.function.description, 'the description is R5\'s');
});

test('load_source: its enum is the directory set: two aliases with the optional sources off, and a selection narrows it', () => {
  const aliasedLoadSourceTool = civicRouter.aliasedLoadSourceTool;
  assert.deepEqual(aliasedLoadSourceTool({ configured: REQUIRED_ONLY }), r5With(['socrata', 'data_commons']));
  assert.deepEqual(
    aliasedLoadSourceTool({ configured: EVERY_SOURCE, selection: ['nyc-charter', 'data-commons'] }),
    r5With(['data_commons', 'nyc_charter']),
  );
  assert.deepEqual(
    aliasedLoadSourceTool({ configured: REQUIRED_ONLY, selection: ['boston-opencontext', 'socrata'] }),
    r5With(['socrata']),
    'a selection never adds an unconfigured source',
  );
});

test('load_source: each call returns a new object, so a consumer\'s change to one never reaches the next', () => {
  const aliasedLoadSourceTool = civicRouter.aliasedLoadSourceTool;
  const first = aliasedLoadSourceTool({ configured: EVERY_SOURCE });
  (first.function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum.push('changed');
  assert.deepEqual(aliasedLoadSourceTool({ configured: EVERY_SOURCE }), r5With(['socrata', 'data_commons', 'boston', 'nyc_charter', 'nyc_checkbook', 'nyc_record', 'nys_legislation']));
});

test('load_source: the package exports the reserved name', () => {
  assert.equal(LOAD_SOURCE_TOOL_NAME, 'load_source');
});

// --- The reserved name --------------------------------------------------------------------

const CHARTER = CIVIC_MANIFEST.find((entry) => entry.sourceId === 'nyc-charter')!;

/** NYC Charter with one more upstream tool, named `load_source`. */
const CHARTER_WITH_LOAD_SOURCE: CivicManifestEntry = {
  ...CHARTER,
  tools: [...CHARTER.tools, { type: 'function', function: { name: 'load_source', description: 'A server tool that happens to take this name.' } }],
  toolNames: [...CHARTER.toolNames, 'load_source'],
};

/** NYC Charter under the alias `load_source`. */
const CHARTER_ALIASED_LOAD_SOURCE: CivicManifestEntry = { ...CHARTER, alias: 'load_source' };

/** The civic manifest with NYC Charter's entry replaced by `entry`, in place. */
const withCharter = (entry: CivicManifestEntry): CivicManifest => CIVIC_MANIFEST.map((e) => (e === CHARTER ? entry : e));

const reservedProblems = (manifest: CivicManifest) =>
  findToolNameProblems(manifest).filter((problem) => problem.kind === 'reserved-name');

test('reserved name: a manifest whose entry has an upstream tool named load_source is refused at construction, naming it', () => {
  const manifest = withCharter(CHARTER_WITH_LOAD_SOURCE);
  const problems = reservedProblems(manifest);
  assert.equal(problems.length, 1, 'one reserved-name problem');
  assert.deepEqual(
    { ...problems[0], message: undefined },
    { kind: 'reserved-name', name: 'load_source', sourceId: 'nyc-charter', field: 'tool', message: undefined },
  );
  assert.throws(
    () => createCivicRouter(manifest),
    (error: unknown) =>
      error instanceof ToolNameError &&
      error.problems.some((problem) => problem.kind === 'reserved-name') &&
      /"load_source"/.test(error.message),
  );
});

test('reserved name: a manifest whose alias is load_source is refused at construction, naming it', () => {
  const manifest = withCharter(CHARTER_ALIASED_LOAD_SOURCE);
  const problems = reservedProblems(manifest);
  assert.equal(problems.length, 1, 'one reserved-name problem');
  assert.deepEqual(
    { ...problems[0], message: undefined },
    { kind: 'reserved-name', name: 'load_source', sourceId: 'nyc-charter', field: 'alias', message: undefined },
  );
  assert.throws(
    () => createCivicRouter(manifest),
    (error: unknown) =>
      error instanceof ToolNameError &&
      error.problems.some((problem) => problem.kind === 'reserved-name') &&
      /"load_source"/.test(error.message),
  );
});

test('reserved name: the seven-entry manifest passes, and no other name is reserved', () => {
  assert.deepEqual(findToolNameProblems(CIVIC_MANIFEST), []);
  assert.doesNotThrow(() => createCivicRouter(CIVIC_MANIFEST));
  const near: CivicManifestEntry = {
    ...CHARTER,
    alias: 'load_sources',
    tools: [...CHARTER.tools, { type: 'function', function: { name: 'load_source_x' } }],
    toolNames: [...CHARTER.toolNames, 'load_source_x'],
  };
  assert.deepEqual(findToolNameProblems(withCharter(near)), [], 'a name that only starts with the reserved one passes');
});
