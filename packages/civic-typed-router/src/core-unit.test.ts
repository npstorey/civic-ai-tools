// Core, on synthetic manifests: no civic source, no civic sentence. The
// goldens (`router-goldens.test.ts`) prove the civic composition; these pin
// the join, the selection, the filter and the index on their own.
//
// This file sits outside `src/core/` because it imports `node:test`, and no
// file under `src/core/` imports any package (`boundary.test.ts`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertUniqueToolNames,
  BLOCK_SEPARATOR,
  composeManifestPrompt,
  composePrompt,
  configuredAddress,
  DuplicateToolNameError,
  findDuplicateToolNames,
  isEntryOffered,
  offeredEntries,
  offerTools,
  toolNamesMatchSchemas,
  toolSourceIndex,
  withheldToolNames,
  type FunctionToolSchema,
  type Manifest,
  type ManifestEntry,
} from './core/index.ts';

const tool = (name: string): FunctionToolSchema => ({ type: 'function', function: { name } });

function entry(
  sourceId: string,
  requirement: 'required' | 'optional',
  names: string[],
  text: string | (() => Promise<string>) = `${sourceId} text`,
  toolNames: string[] = names,
): ManifestEntry<{ log: string[] }> {
  return {
    id: `${sourceId}-id`,
    alias: `${sourceId}-alias`,
    sourceId,
    displayName: `${sourceId} server`,
    configuration: { addressVariable: `${sourceId.toUpperCase()}_URL`, requirement },
    tools: names.map(tool),
    toolNames,
    guidance: {
      async fetchText(ctx) {
        ctx.log.push(sourceId);
        return typeof text === 'string' ? text : text();
      },
    },
  };
}

const A = entry('a', 'required', ['a1', 'a2']);
const B = entry('b', 'optional', ['b1', 'b2', 'b3'], 'b text', ['b3', 'b1', 'b2']);
const C = entry('c', 'optional', ['c1']);
const MANIFEST: Manifest<{ log: string[] }> = [A, B, C];

// --- The join -----------------------------------------------------------------

test('compose: intro, preamble, non-blank blocks and outro, joined by the separator', async () => {
  assert.equal(BLOCK_SEPARATOR, '\n\n---\n\n');
  const prompt = await composePrompt({ intro: 'I', preamble: 'P', outro: 'O' }, [
    async () => 'one',
    async () => '',
    async () => '  \n\t ',
    async () => 'two',
  ]);
  assert.equal(prompt, 'I\n\nP\n\n---\n\none\n\n---\n\ntwo\n\n---\n\nO');
});

test('compose: no preamble, or an empty one, leaves the intro alone', async () => {
  assert.equal(await composePrompt({ intro: 'I', outro: 'O' }, []), 'I\n\n---\n\nO');
  assert.equal(await composePrompt({ intro: 'I', preamble: '', outro: 'O' }, []), 'I\n\n---\n\nO');
});

test('compose: a block that rejects or throws is left out, and composition succeeds', async () => {
  const prompt = await composePrompt({ intro: 'I', outro: 'O' }, [
    async () => {
      throw new Error('rejects');
    },
    () => {
      throw new Error('throws before returning a promise');
    },
    async () => 'kept',
  ]);
  assert.equal(prompt, 'I\n\n---\n\nkept\n\n---\n\nO');
});

test('compose: every block starts, in order, before any is awaited', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const pending = composePrompt({ intro: 'I', outro: 'O' }, [
    async () => {
      started.push('first');
      await gate;
      return 'first';
    },
    async () => {
      started.push('second');
      return 'second';
    },
  ]);
  assert.deepEqual(started, ['first', 'second'], 'the second block started while the first was still pending');
  release();
  assert.equal(await pending, 'I\n\n---\n\nfirst\n\n---\n\nsecond\n\n---\n\nO');
});

test('compose: composeManifestPrompt asks each entry, in manifest order, with the context', async () => {
  const ctx = { log: [] as string[] };
  const prompt = await composeManifestPrompt(MANIFEST, ctx, { intro: 'I', outro: 'O' });
  assert.deepEqual(ctx.log, ['a', 'b', 'c']);
  assert.equal(prompt, 'I\n\n---\n\na text\n\n---\n\nb text\n\n---\n\nc text\n\n---\n\nO');
});

// --- Selection ----------------------------------------------------------------

test('select: a required source is always offered; an optional one only with a non-empty address', () => {
  assert.equal(isEntryOffered(A, {}), true);
  assert.equal(isEntryOffered(B, {}), false);
  assert.equal(isEntryOffered(B, { b: '' }), false);
  assert.equal(isEntryOffered(B, { b: undefined }), false);
  assert.equal(isEntryOffered(B, { b: 'https://b.example.org' }), true);
  assert.deepEqual(
    offeredEntries(MANIFEST, { c: 'https://c.example.org' }).map((e) => e.sourceId),
    ['a', 'c'],
  );
});

test('select: an address is read only from the object\'s own keys', () => {
  assert.equal(configuredAddress({}, 'constructor'), undefined);
  assert.equal(configuredAddress({ x: 'u' }, 'x'), 'u');
  assert.equal(configuredAddress({ x: '' }, 'x'), undefined);
});

test('select: withheld tools follow manifest order and each source\'s routing order', () => {
  assert.deepEqual(withheldToolNames(MANIFEST, {}), ['b3', 'b1', 'b2', 'c1']);
  assert.deepEqual(withheldToolNames(MANIFEST, { b: 'u', c: 'u' }), []);
});

test('offerTools: nothing withheld returns the same array; otherwise function tools by name are dropped', () => {
  const tools = [tool('a1'), tool('b1'), { type: 'custom', custom: { name: 'b1' } } as unknown as FunctionToolSchema];
  assert.equal(offerTools(tools, []), tools, 'the same array object');
  const offered = offerTools(tools, ['b1']);
  assert.notEqual(offered, tools);
  assert.deepEqual(offered, [tools[0], tools[2]], 'a non-function tool is passed through even when its name matches');
});

// --- The index and the validations -------------------------------------------

test('index: tool name to source id, derived from the schemas', () => {
  const index = toolSourceIndex(MANIFEST);
  assert.equal(index.a2, 'a');
  assert.equal(index.b3, 'b');
  assert.equal(index.c1, 'c');
  assert.equal(index.nope, undefined);
  // A plain object, as the website's static map was: a prototype key reads the prototype.
  assert.equal(index.constructor as unknown, Object);
});

test('validation: duplicate tool names are found and refused when asked', () => {
  const dup = entry('d', 'required', ['a1', 'd1']);
  assert.deepEqual(findDuplicateToolNames(MANIFEST), []);
  assert.doesNotThrow(() => assertUniqueToolNames(MANIFEST));
  assert.deepEqual(findDuplicateToolNames([A, dup]), [{ tool: 'a1', sourceIds: ['a', 'd'] }]);
  assert.throws(() => assertUniqueToolNames([A, dup]), (err: unknown) => {
    assert.ok(err instanceof DuplicateToolNameError);
    assert.match(err.message, /"a1": declared by "a" and "d"/);
    return true;
  });
});

test('validation: a routing list and the schemas must name the same tools, each once', () => {
  assert.equal(toolNamesMatchSchemas(B), true, 'the same set in another order matches');
  assert.equal(toolNamesMatchSchemas(entry('x', 'required', ['x1', 'x2'], 't', ['x1'])), false);
  assert.equal(toolNamesMatchSchemas(entry('x', 'required', ['x1'], 't', ['x1', 'x1'])), false);
  assert.equal(toolNamesMatchSchemas(entry('x', 'required', ['x1'], 't', ['y1'])), false);
});
