// The search tool, `find_source(query)` (S3-A P1, hub #318; router 0.10.0).
//
//   A2  Its name is reserved as `load_source`'s is: a manifest with an alias
//       `find_source`, or with an upstream tool named `find_source`, is a
//       `findToolNameProblems` problem, and the startup check throws.
//   The tool, its three result texts and its limit of two searches are S1's
//   (`benchmark/runner/texts.mjs`), word for word: this test imports that
//   file and compares.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import {
  checkToolNames,
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  FIND_SOURCE_LIMIT,
  FIND_SOURCE_RESULT_TEXT,
  FIND_SOURCE_TOOL_NAME,
  FIND_SOURCE_TOOL_TEXT,
  findSourceTool,
  findToolNameProblems,
  ToolNameError,
  type CivicManifest,
  type CivicManifestEntry,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = join(SRC, '..', '..', '..');

/** S1's texts, as the benchmark ran them. */
const S1 = (await import(pathToFileURL(join(REPO, 'benchmark', 'runner', 'texts.mjs')).href)) as {
  FIND_SOURCE_TOOL: unknown;
  FIND_SOURCE_LIMIT: number;
  FIND_SOURCE_TEXT: { found: (aliases: string[]) => string; none: string; limit: string };
};

// --- A2: the reserved name ----------------------------------------------------------

const CHARTER = CIVIC_MANIFEST.find((entry) => entry.sourceId === 'nyc-charter')!;

/** NYC Charter with one more upstream tool, named `find_source`. */
const CHARTER_WITH_FIND_SOURCE: CivicManifestEntry = {
  ...CHARTER,
  tools: [...CHARTER.tools, { type: 'function', function: { name: 'find_source', description: 'A server tool that happens to take this name.' } }],
  toolNames: [...CHARTER.toolNames, 'find_source'],
};

/** NYC Charter under the alias `find_source`. */
const CHARTER_ALIASED_FIND_SOURCE: CivicManifestEntry = { ...CHARTER, alias: 'find_source' };

const withCharter = (entry: CivicManifestEntry): CivicManifest => CIVIC_MANIFEST.map((e) => (e === CHARTER ? entry : e));

const findSourceProblems = (manifest: CivicManifest) =>
  findToolNameProblems(manifest).filter((problem) => problem.kind === 'reserved-name' && problem.name === 'find_source');

test('A2: a manifest whose entry has an upstream tool named find_source is a reserved-name problem, and the startup check throws, naming it', () => {
  const manifest = withCharter(CHARTER_WITH_FIND_SOURCE);
  const problems = findSourceProblems(manifest);
  assert.equal(problems.length, 1, 'one reserved-name problem for find_source');
  assert.deepEqual(
    { ...problems[0], message: undefined },
    { kind: 'reserved-name', name: 'find_source', sourceId: 'nyc-charter', field: 'tool', message: undefined },
  );
  assert.match(problems[0]!.message, /"find_source"/);
  const refused = (error: unknown) =>
    error instanceof ToolNameError && error.problems.some((problem) => problem.kind === 'reserved-name') && /"find_source"/.test(error.message);
  assert.throws(() => checkToolNames(manifest), refused);
  assert.throws(() => createCivicRouter(manifest), refused);
});

test('A2: a manifest whose alias is find_source is a reserved-name problem, and the startup check throws, naming it', () => {
  const manifest = withCharter(CHARTER_ALIASED_FIND_SOURCE);
  const problems = findSourceProblems(manifest);
  assert.equal(problems.length, 1, 'one reserved-name problem for find_source');
  assert.deepEqual(
    { ...problems[0], message: undefined },
    { kind: 'reserved-name', name: 'find_source', sourceId: 'nyc-charter', field: 'alias', message: undefined },
  );
  const refused = (error: unknown) => error instanceof ToolNameError && /"find_source"/.test(error.message);
  assert.throws(() => checkToolNames(manifest), refused);
  assert.throws(() => createCivicRouter(manifest), refused);
});

test('A2: the civic manifest has no find_source problem, and the package exports the reserved name', () => {
  assert.deepEqual(findSourceProblems(CIVIC_MANIFEST), []);
  assert.equal(FIND_SOURCE_TOOL_NAME, 'find_source');
});

// --- The tool and its texts: S1's, word for word ------------------------------------

test('find_source: the tool is S1\'s FIND_SOURCE_TOOL, byte for byte, and a new object on every call', () => {
  const tool = civicRouter.aliasedFindSourceTool();
  assert.deepEqual(tool, S1.FIND_SOURCE_TOOL);
  assert.equal(JSON.stringify(tool), JSON.stringify(S1.FIND_SOURCE_TOOL), 'key order too');
  assert.deepEqual(findSourceTool(FIND_SOURCE_TOOL_TEXT), tool, 'the core builds it from the civic text');
  (tool.function.parameters as { required: string[] }).required.push('changed');
  assert.equal(JSON.stringify(civicRouter.aliasedFindSourceTool()), JSON.stringify(S1.FIND_SOURCE_TOOL), 'a change to one call\'s object never reaches the next');
});

test('find_source: the three result texts are S1\'s, and the limit is two searches', () => {
  assert.equal(FIND_SOURCE_LIMIT, 2);
  assert.equal(FIND_SOURCE_LIMIT, S1.FIND_SOURCE_LIMIT);
  assert.equal(FIND_SOURCE_RESULT_TEXT.none, S1.FIND_SOURCE_TEXT.none);
  assert.equal(FIND_SOURCE_RESULT_TEXT.limit, S1.FIND_SOURCE_TEXT.limit);
  for (const aliases of [['socrata'], ['nyc_record', 'socrata'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']]) {
    assert.equal(FIND_SOURCE_RESULT_TEXT.found(aliases), S1.FIND_SOURCE_TEXT.found(aliases), aliases.join(','));
  }
  assert.equal(
    FIND_SOURCE_RESULT_TEXT.found(['nyc_record']),
    'Found 1 source, best match first: `nyc_record`. Each is now listed in the directory in the system prompt, and load_source accepts its alias on your next turn.',
  );
});
