// The naming layer's core (ADR-0032), on synthetic manifests and the civic
// one: normalization, the startup checks, the dispatch map and the dispatch
// rule, the anchored rewrite and its reverse.
//
// This file sits outside `src/core/` because it imports `node:test`, and no
// file under `src/core/` imports any package (`boundary.test.ts`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anchoredRewrite,
  BARE_VIEW,
  checkToolNames,
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  dispatchMap,
  exposedToolName,
  findToolNameProblems,
  readMcpEnv,
  resolveCalledName,
  TOOL_NAME_PATTERN,
  ToolNameError,
  unaliasText,
  upstreamToolName,
  type CivicManifest,
  type CivicManifestEntry,
  type FunctionToolSchema,
  type ManifestEntry,
} from './index.ts';

const tool = (name: string): FunctionToolSchema => ({ type: 'function', function: { name } });

function entry(sourceId: string, alias: string, names: string[]): ManifestEntry<unknown> {
  return {
    id: `${sourceId}-id`,
    alias,
    sourceId,
    displayName: `${sourceId} server`,
    description: `${sourceId}: a synthetic source.`,
    freshness: 'Synthetic.',
    configuration: { addressVariable: `${sourceId.toUpperCase()}_URL`, requirement: 'required' },
    tools: names.map(tool),
    toolNames: names,
    guidance: { fetchText: async () => '' },
  };
}

/** A civic-shaped entry for `createCivicRouter`. */
function civicStub(sourceId: string, alias: string, names: string[]): CivicManifestEntry {
  return { ...(entry(sourceId, alias, names) as CivicManifestEntry), guidance: { fetchText: async () => '' } };
}

/** The publisher-bundled server R7 hosts: five tools, one of them `search`. */
const CHARTER_TOOLS = ['search', 'get_section', 'list_titles', 'get_title', 'get_version'];

/** Run `fn`, expecting a `ToolNameError`; return its message. */
function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ToolNameError, `expected a ToolNameError, got ${String(err)}`);
    return err.message;
  }
  assert.fail('expected a refusal; nothing was thrown');
}

// --- (a) Normalization ----------------------------------------------------------

test('names (a): a dotted upstream name is exposed with the dot as "_", and both names are in the map', () => {
  const manifest = [entry('example', 'example', ['records.search'])];
  assert.equal(exposedToolName('example', 'records.search'), 'example__records_search');
  const map = dispatchMap(manifest);
  assert.deepEqual(map.get('example__records_search'), {
    exposedName: 'example__records_search',
    sourceId: 'example',
    alias: 'example',
    upstreamName: 'records.search',
    normalized: true,
  });
});

test('names (a): an exposed name over 64 characters is cut and ends in a short hash, the same on every run', () => {
  const upstream = 'retrieve_every_published_dataset_revision_with_its_full_column_history';
  assert.equal(upstream.length, 70);
  const exposed = exposedToolName('example', upstream);
  // Pinned: the hash is FNV-1a over the UTF-8 bytes of "example__<upstream>",
  // so this literal is what every run, on every platform, produces.
  assert.equal(exposed, 'example__retrieve_every_published_dataset_revision_with_66db5b49');
  assert.equal(exposed.length, 64);
  assert.match(exposed, TOOL_NAME_PATTERN);
  assert.equal(exposedToolName('example', upstream), exposed, 'a second call gives the same name');
  const map = dispatchMap([entry('example', 'example', [upstream])]);
  assert.equal(map.get(exposed)?.upstreamName, upstream, 'the upstream name is kept in the map');
  assert.equal(map.get(exposed)?.normalized, true);
});

test('names (a): characters outside the set are replaced one per code point', () => {
  assert.equal(exposedToolName('example', 'café lookup'), 'example__caf__lookup');
  assert.equal(exposedToolName('example', 'astral\u{1F600}name'), 'example__astral_name', 'a surrogate pair is one code point');
});

// --- (b) Collisions after normalizing -------------------------------------------

test('names (b): two names that collide after normalizing are refused, naming both', () => {
  const message = refusal(() => checkToolNames([entry('example', 'example', ['a.b', 'a_b'])]));
  assert.match(message, /"a\.b" of "example" and "a_b" of "example" are both exposed as "example__a_b"/);
  const [problem] = findToolNameProblems([entry('example', 'example', ['a.b', 'a_b'])]);
  assert.equal(problem?.kind, 'name-collision');
});

test('names (b): a collision is refused at construction, before any router exists', () => {
  const manifest: CivicManifest = [...CIVIC_MANIFEST, civicStub('example', 'example', ['a.b', 'a_b'])];
  assert.match(refusal(() => createCivicRouter(manifest)), /both exposed as "example__a_b"/);
});

// --- (c) Ill-formed and shared aliases -------------------------------------------

test('names (c): an alias with a dot is refused, naming it', () => {
  const message = refusal(() => checkToolNames([entry('example', 'ex.ample', ['lookup'])]));
  assert.match(message, /Alias "ex\.ample" of source "example" is ill-formed: it holds a character outside/);
});

test('names (c): an alias containing "__" is refused, naming it', () => {
  const message = refusal(() => checkToolNames([entry('example', 'ex__ample', ['lookup'])]));
  assert.match(message, /Alias "ex__ample" of source "example" is ill-formed: it contains "__"/);
});

test('names (c): an alias starting with a digit is refused, naming it', () => {
  const message = refusal(() => checkToolNames([entry('example', '1example', ['lookup'])]));
  assert.match(message, /Alias "1example" of source "example" is ill-formed: it does not start with a letter or an underscore/);
});

test('names (c): two entries sharing an alias are refused, naming the alias and both sources', () => {
  const message = refusal(() => checkToolNames([entry('one', 'shared', ['a']), entry('two', 'shared', ['b'])]));
  assert.match(message, /Alias "shared" is used by "one" and "two"/);
});

test('names (c): each refusal also happens at construction', () => {
  for (const alias of ['ex.ample', 'ex__ample', '1example', 'socrata']) {
    const manifest: CivicManifest = [...CIVIC_MANIFEST, civicStub('example', alias, ['lookup'])];
    assert.match(refusal(() => createCivicRouter(manifest)), new RegExp(`"${alias.replace('.', '\\.')}"`), `alias ${alias}`);
  }
});

// --- (d) The sixteen names in view ------------------------------------------------

test('names (d): the sixteen names in view are unchanged by normalization', () => {
  const map = dispatchMap([...CIVIC_MANIFEST, entry('charter', 'charter', CHARTER_TOOLS)]);
  const expected = [
    'socrata__get_data',
    'socrata__search',
    'socrata__fetch',
    'data_commons__search_indicators',
    'data_commons__get_observations',
    'boston__ckan__search_datasets',
    'boston__ckan__get_dataset',
    'boston__ckan__get_schema',
    'boston__ckan__query_data',
    'boston__ckan__aggregate_data',
    'boston__ckan__execute_sql',
    'charter__search',
    'charter__get_section',
    'charter__list_titles',
    'charter__get_title',
    'charter__get_version',
  ];
  assert.deepEqual([...map.keys()], expected);
  for (const target of map.values()) {
    assert.equal(target.exposedName, `${target.alias}__${target.upstreamName}`, `${target.exposedName} is not normalized`);
    assert.equal(target.normalized, false);
    assert.match(target.exposedName, TOOL_NAME_PATTERN);
  }
  const longest = Math.max(...expected.map((n) => n.length));
  assert.equal(longest, 31, 'data_commons__search_indicators');
});

// --- (e) The dispatch rule ---------------------------------------------------------

test('dispatch (e): an exposed name resolves by the map, never by splitting it', () => {
  const map = createCivicRouter().dispatchMap;
  const resolved = resolveCalledName(map, undefined, 'boston__ckan__search_datasets');
  assert.deepEqual(resolved, {
    ok: true,
    spelling: 'aliased',
    exposedName: 'boston__ckan__search_datasets',
    sourceId: 'boston-opencontext',
    alias: 'boston',
    upstreamName: 'ckan__search_datasets',
  });
  assert.equal(upstreamToolName(map, 'boston__ckan__search_datasets'), 'ckan__search_datasets');
  assert.equal(upstreamToolName(map, 'get_data'), 'get_data', 'a bare name reads as itself');
});

test('dispatch (e): a bare name exactly one offered source has is accepted', () => {
  const router = createCivicRouter();
  const resolved = router.resolveCalledName('get_data', readMcpEnv({}));
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.ok && [resolved.spelling, resolved.sourceId, resolved.upstreamName, resolved.exposedName], [
    'bare',
    'socrata',
    'get_data',
    'socrata__get_data',
  ]);
});

test('dispatch (e): a bare name two offered sources share is refused, naming both aliased forms', () => {
  const router = createCivicRouter([...CIVIC_MANIFEST, civicStub('charter', 'charter', CHARTER_TOOLS)]);
  const resolved = router.resolveCalledName('search', readMcpEnv({}));
  assert.equal(resolved.ok, false);
  assert.deepEqual(!resolved.ok && [resolved.reason, resolved.candidates], ['ambiguous', ['socrata__search', 'charter__search']]);
  assert.match(!resolved.ok ? resolved.message : '', /"socrata__search" or "charter__search"/);
  // Each exposed name still resolves.
  const charter = router.resolveCalledName('charter__search', readMcpEnv({}));
  assert.deepEqual(charter.ok && [charter.sourceId, charter.upstreamName], ['charter', 'search']);
});

test('index: a bare name a later source also declares stays on the first source, under every configuration', () => {
  // The stub declares a bare `search` after Socrata's. The tool-to-source
  // index answers by name alone and takes no configuration.
  const router = createCivicRouter([...CIVIC_MANIFEST, civicStub('example', 'example', ['search', 'lookup'])]);
  assert.equal(router.sourceIdForToolName('search'), 'socrata', 'the index does not move to the newest entry');
  assert.equal(router.sourceIdForToolName('lookup'), 'example');
  assert.equal(civicRouter.sourceIdForToolName('search'), 'socrata');
});

test('dispatch (e): an unknown name is refused; a tool of a source the run is not offered is refused', () => {
  const router = createCivicRouter();
  const unknown = router.resolveCalledName('no_such_tool', readMcpEnv({}));
  assert.deepEqual(!unknown.ok && [unknown.reason, unknown.candidates], ['unknown', []]);
  // Boston is optional: with no address it is not offered.
  const exposed = router.resolveCalledName('boston__ckan__query_data', readMcpEnv({}));
  assert.deepEqual(!exposed.ok && [exposed.reason, exposed.candidates], ['not-offered', ['boston__ckan__query_data']]);
  const bare = router.resolveCalledName('ckan__query_data', readMcpEnv({}));
  assert.deepEqual(!bare.ok && [bare.reason, bare.candidates], ['not-offered', ['boston__ckan__query_data']]);
});

// --- The anchored rewrite, on its own ------------------------------------------------

test('anchored rewrite: each anchor is rewritten, and nothing else', () => {
  const names = new Map([
    ['get_data', 'socrata__get_data'],
    ['search', 'socrata__search'],
  ]);
  const text = [
    'Use `get_data` first, then **search**, or "search".',
    '| search | the configured portal |',
    '| **get_data** | any portal |',
    'Tools: get_data, search.',
    'A web search, a search phrase, get_data in prose, `get_data_x`, and `search_indicators` stay.',
    'Tool: get_data',
    '| Domain | get_data coverage |',
  ].join('\n');
  assert.equal(
    anchoredRewrite(text, names),
    [
      'Use `socrata__get_data` first, then **socrata__search**, or "socrata__search".',
      '| socrata__search | the configured portal |',
      '| **socrata__get_data** | any portal |',
      'Tools: socrata__get_data, socrata__search.',
      'A web search, a search phrase, get_data in prose, `get_data_x`, and `search_indicators` stay.',
      'Tool: get_data',
      '| Domain | get_data coverage |',
    ].join('\n'),
  );
  assert.equal(anchoredRewrite(text, new Map()), text, 'no names, no change');
});

test('unalias: the reverse restores the bare bytes, normalized names included', () => {
  const manifest = [entry('example', 'example', ['records.search', 'lookup'])];
  const map = dispatchMap(manifest);
  const bare = 'Call `records.search`, then `lookup`; a search is a word.';
  const aliased = anchoredRewrite(bare, new Map([...map.values()].map((t) => [t.upstreamName, t.exposedName])));
  assert.equal(aliased, 'Call `example__records_search`, then `example__lookup`; a search is a word.');
  assert.equal(unaliasText(map, aliased), bare);
  assert.equal(BARE_VIEW.toolName('example', 'lookup'), 'lookup');
});
