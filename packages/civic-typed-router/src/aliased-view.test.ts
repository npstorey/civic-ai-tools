// The aliased view of the civic manifest (ADR-0032), held to the goldens:
//
//   - reversible: undoing the alias mechanically (`unaliasText`) yields the
//     bare bytes exactly, for all 42 captured prompts and 5 tools arrays;
//   - complete: the aliased output names no bare tool name in text the router
//     owns, and every remaining "search" or "fetch" is one of the English uses
//     pinned below, each decided by reading it;
//   - callable: the reference website's advertised-tools property
//     (`src/lib/mcp/prompt-advertised-tools.test.ts:22-31` at d1919a8) holds
//     for the aliased names;
//   - anchored: on the Socrata guidance the website fetches (pinned in
//     `__fixtures__/socrata-guidance.json`), the rewrite renames every anchored
//     tool-name token and nothing else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BLOCK_SEPARATOR,
  bostonSkill,
  civicRouter,
  composePreamble,
  dataCommonsSkill,
  getSkillForPortal,
  readMcpEnv,
  socrataSkillFallback,
  unaliasText,
  type CivicRouter,
  type McpRegistryEnv,
} from './index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const HUB_ROOT = join(HERE, '..', '..', '..');

// --- The goldens, read as router-goldens.test.ts reads them -----------------------

type Encoded = unknown;
type TextEntry = { fixture: string } | { text: string } | null;
interface PromptCapture {
  id: string;
  client: {
    guidance: { kind: 'returns'; fixture?: string; text?: string } | { kind: 'throws' };
    instructions: Record<string, TextEntry>;
  };
  resolved: Encoded;
  configured: Encoded;
  publicationHost: string | null;
  today: string;
  output: string;
}
interface ToolsCapture {
  id: string;
  resolved: Encoded;
  configured: Encoded;
  output: string;
}
interface Goldens {
  fixtureStrings: Record<string, string>;
  prompts: PromptCapture[];
  tools: ToolsCapture[];
}

const goldens: Goldens = JSON.parse(readFileSync(join(HERE, '__fixtures__', 'app-goldens.json'), 'utf8'));
const guidanceFixture: {
  _meta: {
    origin: { repository: string; commit: string; parts: { path: string; exportName: string; hubDoc: string; hubDocIdentical: boolean }[] };
    sha256: string;
  };
  text: string;
} = JSON.parse(readFileSync(join(HERE, '__fixtures__', 'socrata-guidance.json'), 'utf8'));

function decode(value: Encoded): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length === 1 && record.$undefined === true) return undefined;
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

const resolvedOf = (c: { resolved: Encoded }) => decode(c.resolved) as { portal?: string; lockedPortal?: string };
const configuredOf = (c: { configured: Encoded }) => decode(c.configured) as McpRegistryEnv;

function textOf(entry: TextEntry | undefined): string | null {
  if (entry === null || entry === undefined) return null;
  return 'fixture' in entry ? goldens.fixtureStrings[entry.fixture]! : entry.text;
}

/** The routes' prompt expression, in the aliased view. */
async function aliasedPrompt(router: CivicRouter, capture: PromptCapture): Promise<string> {
  const configured = configuredOf(capture);
  const { portal, lockedPortal } = resolvedOf(capture);
  const guidance = capture.client.guidance;
  const prompt = await router.aliasedBuildSystemPrompt({
    portal,
    configured,
    today: capture.today,
    publicationHost: capture.publicationHost,
    fetchPrompt: async () => {
      if (guidance.kind === 'throws') throw new Error('fixture: the Socrata prompt fetch fails');
      return textOf(guidance as TextEntry) as string;
    },
    fetchInstructions: async (sourceId) =>
      textOf(Object.hasOwn(capture.client.instructions, sourceId) ? capture.client.instructions[sourceId] : null),
  });
  return router.aliasedWithPortalLockGuidance(prompt, lockedPortal, configured);
}

/** The routes' tools expression, in the aliased view, as the request carries it. */
function aliasedToolsText(router: CivicRouter, capture: ToolsCapture): string {
  const { lockedPortal } = resolvedOf(capture);
  return JSON.stringify(router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockedPortal), configuredOf(capture)));
}

const ALIAS_PREFIX = /(?<![A-Za-z0-9_-])(?:socrata|data_commons|boston|nyc_charter)__/;
const ELEVEN = [
  'get_data',
  'search',
  'fetch',
  'search_indicators',
  'get_observations',
  'ckan__search_datasets',
  'ckan__get_dataset',
  'ckan__query_data',
  'ckan__get_schema',
  'ckan__execute_sql',
  'ckan__aggregate_data',
];

// --- Reversible ---------------------------------------------------------------------

test('aliased view: the bare goldens and the pinned guidance hold no alias prefix, so the reverse is exact', () => {
  for (const capture of [...goldens.prompts, ...goldens.tools]) {
    assert.ok(!ALIAS_PREFIX.test(capture.output), `${capture.id} holds an alias prefix`);
  }
  for (const text of Object.values(goldens.fixtureStrings)) assert.ok(!ALIAS_PREFIX.test(text));
  assert.ok(!ALIAS_PREFIX.test(guidanceFixture.text));
});

test('aliased view: every one of the 42 prompts, un-aliased, is its golden byte for byte', async () => {
  assert.equal(goldens.prompts.length, 42);
  for (const capture of goldens.prompts) {
    const aliased = await aliasedPrompt(civicRouter, capture);
    assert.notEqual(aliased, capture.output, `${capture.id}: the aliased prompt differs from the bare one`);
    assert.match(aliased, /socrata__get_data/, `${capture.id}: the aliased prompt names socrata__get_data`);
    assert.ok(unaliasText(civicRouter.dispatchMap, aliased) === capture.output, `${capture.id}: un-aliased, the prompt is not the golden`);
  }
});

test('aliased view: every one of the 5 tools arrays, un-aliased, is its golden byte for byte', () => {
  assert.equal(goldens.tools.length, 5);
  for (const capture of goldens.tools) {
    const aliased = aliasedToolsText(civicRouter, capture);
    const names = (JSON.parse(aliased) as { function: { name: string } }[]).map((t) => t.function.name);
    assert.ok(names.length > 0 && names.every((n) => civicRouter.dispatchMap.has(n)), `${capture.id}: every tool has an exposed name`);
    assert.ok(unaliasText(civicRouter.dispatchMap, aliased) === capture.output, `${capture.id}: un-aliased, the tools array is not the golden`);
  }
});

// --- Complete -------------------------------------------------------------------------

/** Every English "search" or "fetch" in the aliased outputs, as 30 characters
 *  of its line on each side. Each was read and decided: a word, not a tool.
 *  One is a short form of two Boston tools ("search/get_dataset"), kept as
 *  written in both views (ADR-0032; a later text change may name the tools). */
const ENGLISH_USES = [
  ' from the tables below, a web search, or socrata__get_data with ty',
  " statement's own LIMIT), or a search phrase, applied as a full-tex",
  ' two-step: search first, then fetch.** Do not skip data_commons__',
  '*boston__ckan__get_schema** — fetch field names/types. Run this b',
  '- To search any OTHER portal, use socrata',
  '-- Text search',
  'For type=catalog: search query. For type=metadata: the',
  'Free-text search query (e.g., "311 pothole req',
  'Free-text search query (e.g., "median househol',
  'Full-text search phrase, e.g. "311 noise compl',
  'QL query against a dataset to fetch and filter data',
  'Socrata, a direct API, or web search)',
  'adults" }  // free-text topic search',
  'al only, data.example.org. To search its catalog by name, socrata_',
  'd values are case-sensitive - fetch sample data first to see exac',
  'default workflow is two-step: search first, then fetch.** Do not s',
  'et gets a v2 resource. Re-run search/get_dataset for current IDs e',
  'here may be more and offer to fetch the next page.',
  'hrase, applied as a full-text search within the data alongside the',
  'ings County, New York"] }  // search scoped to Brooklyn, by name',
  'ly, data.cityofnewyork.us. To search its catalog by name, socrata_',
  'r boston__ckan__get_schema to fetch field names for querying.',
  't of place names to scope the search to, qualified so they are una',
  'w, a curated directory, a web search — is reached with socrata__ge',
];

function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsOf);
  return [];
}

test('aliased view: no bare tool name in the text the router owns; every "search" and "fetch" left is a pinned English use', async () => {
  const bare = new RegExp(`(?<![A-Za-z0-9_-])(${ELEVEN.join('|')})(?![A-Za-z0-9_-])`, 'g');
  const unexpected: string[] = [];
  const english = new Set<string>();
  const scan = (where: string, text: string) => {
    for (const line of text.split('\n')) {
      for (const m of line.matchAll(bare)) {
        const name = m[1]!;
        const context = line.slice(Math.max(0, m.index! - 30), m.index! + name.length + 30);
        if (name === 'search' || name === 'fetch') english.add(context);
        else unexpected.push(`${where}: ${name} in "${context}"`);
      }
    }
  };
  // The synthetic fixture strings the goldens feed in name no tool, so every
  // mention found is the router's own text.
  for (const text of Object.values(goldens.fixtureStrings)) assert.doesNotMatch(text, bare);
  for (const capture of goldens.prompts) scan(capture.id, await aliasedPrompt(civicRouter, capture));
  for (const capture of goldens.tools) {
    for (const text of stringsOf(JSON.parse(aliasedToolsText(civicRouter, capture)))) scan(capture.id, text);
  }
  assert.deepEqual(unexpected, [], 'a bare tool name survived in the aliased view');
  assert.deepEqual([...english].sort(), [...ENGLISH_USES].sort(), 'the "search" and "fetch" left in the aliased view are not the pinned English uses');
});

// --- Callable: the website's advertised-tools property, aliased ---------------------

/** A lowercase identifier: the shape every exposed name here has. */
const TOOL_NAME_SHAPE = /^[a-z][a-z0-9_]*$/;

/** The website's extractor (`prompt-advertised-tools.test.ts:158-194` at
 *  d1919a8), unchanged: `Tools:` lists, bold lowercase identifiers, table cells
 *  that are lowercase identifiers, and a snake_case word before "tool(s)". */
function extractToolMentions(text: string): string[] {
  const found = new Set<string>();
  for (const list of text.matchAll(/Tools:\s*([^.\n]+)\./g)) {
    for (const name of list[1]!.split(',')) found.add(name.trim());
  }
  for (const bold of text.matchAll(/\*\*([^*\s]+)\*\*/g)) {
    if (TOOL_NAME_SHAPE.test(bold[1]!)) found.add(bold[1]!);
  }
  for (const line of text.split('\n')) {
    const row = line.trim();
    if (!row.startsWith('|') || !row.endsWith('|')) continue;
    for (const cell of row.slice(1, -1).split('|')) {
      const value = cell.trim().replace(/^\*\*/, '').replace(/\*\*$/, '');
      if (TOOL_NAME_SHAPE.test(value)) found.add(value);
    }
  }
  for (const before of text.matchAll(/([a-z][a-z0-9_]*)\s+tools?\b/g)) {
    if (before[1]!.includes('_')) found.add(before[1]!);
  }
  return [...found];
}

test('callable: the extractor recognises each anchor it claims to (the website\'s self-test)', () => {
  const fixture = [
    'Tools: alpha_one, alpha_two.',
    'Prefer **beta_one** for discovery, and **Capitalised** is not a tool name.',
    '',
    '| Tool | Purpose |',
    '|------|---------|',
    '| gamma_one | does a thing |',
    '| **gamma_two** | does another |',
    '',
    'Call the delta_one tool first. The search tool is a bare word this anchor skips.',
  ].join('\n');
  assert.deepEqual(extractToolMentions(fixture).sort(), ['alpha_one', 'alpha_two', 'beta_one', 'delta_one', 'gamma_one', 'gamma_two']);
});

test('callable: every tool name the aliased prompt-reaching text presents has an aliased schema', async () => {
  const view = civicRouter.aliasedView;
  const callable = new Set(civicRouter.aliasedMcpTools.map((t) => t.function.name));
  const portals = ['data.cityofnewyork.us', 'data.cityofchicago.org', 'data.sf.gov'];
  // The three civic sources' own preamble entries, and the preamble the router
  // composes with every source offered, NYC Charter's composed entry included
  // (its intro block: the intro and the preamble, before the first block).
  const everySource = readMcpEnv({
    SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
    BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
    NYC_CHARTER_HOSTING: 'sandbox',
  });
  const composed = await civicRouter.aliasedBuildSystemPrompt({
    configured: everySource,
    today: '2026-01-15',
    publicationHost: null,
    fetchPrompt: async () => '',
    fetchInstructions: async () => null,
  });
  const corpus: Record<string, string> = {
    'the cross-source preamble': composePreamble(
      civicRouter.manifest
        .filter((entry) => entry.prompt?.preambleEntry)
        .map((entry) => ({ sourceId: entry.sourceId, preambleEntry: entry.prompt!.preambleEntry!(view) })),
    ),
    'the composed preamble, every source offered': composed.split(BLOCK_SEPARATOR)[0]!,
    'the Socrata fallback': socrataSkillFallback(view),
    'the Data Commons guidance': dataCommonsSkill('records.example.org', view),
    'the Boston guidance': bostonSkill(view),
    ...Object.fromEntries(portals.map((portal) => [`getSkillForPortal('${portal}')`, getSkillForPortal(portal, view)])),
  };
  for (const portal of portals) assert.notEqual(getSkillForPortal(portal, view), '', `${portal} has portal guidance`);

  const seen: string[] = [];
  for (const [name, text] of Object.entries(corpus)) {
    for (const mentioned of extractToolMentions(text)) {
      seen.push(mentioned);
      assert.ok(callable.has(mentioned), `${name} names tool "${mentioned}", which has no aliased schema`);
    }
  }
  assert.ok(seen.length >= 11, `the extractor found only ${seen.length} mentions; it has stopped measuring`);
  assert.ok(seen.every((name) => ALIAS_PREFIX.test(name)), 'every presented name is an exposed one');
  // The three own preamble entries describe three sources, one `Tools:` list
  // each; with every source offered the composed preamble has four, the
  // fourth NYC Charter's five exposed names.
  assert.equal([...corpus['the cross-source preamble']!.matchAll(/Tools:\s*([^.\n]+)\./g)].length, 3);
  const lists = [...corpus['the composed preamble, every source offered']!.matchAll(/Tools:\s*([^.\n]+)\./g)].map((m) => m[1]);
  assert.equal(lists.length, 4);
  assert.equal(lists[3], 'nyc_charter__search, nyc_charter__get_section, nyc_charter__list_titles, nyc_charter__get_title, nyc_charter__get_version');
});

// --- Anchored: the server's guidance --------------------------------------------------

test('anchored: the pinned guidance is socrata-mcp-server\'s at 3163601, and equals the hub\'s docs/skills/base.md and web.md', () => {
  const origin = guidanceFixture._meta.origin;
  assert.equal(origin.repository, 'npstorey/socrata-mcp-server');
  assert.equal(origin.commit, '3163601d8c96b17246e8e63599ae0b9e1f0c0c29');
  assert.deepEqual(
    origin.parts.map((p) => [p.path, p.exportName, p.hubDoc, p.hubDocIdentical]),
    [
      ['src/skills/base.ts', 'BASE_SKILL', 'docs/skills/base.md', true],
      ['src/skills/web.ts', 'WEB_SKILL', 'docs/skills/web.md', true],
    ],
  );
  const base = readFileSync(join(HUB_ROOT, 'docs', 'skills', 'base.md'), 'utf8');
  const web = readFileSync(join(HUB_ROOT, 'docs', 'skills', 'web.md'), 'utf8');
  assert.ok(guidanceFixture.text === `${base}\n\n---\n\n${web}`, 'the fixture is base.md, the separator, then web.md');
});

/** Word-bounded occurrences of `name`, not part of a longer name. */
const count = (text: string, name: string): number =>
  [...text.matchAll(new RegExp(`(?<![A-Za-z0-9_-])${name}(?![A-Za-z0-9_-])`, 'g'))].length;

test('anchored: the rewrite renames every anchored tool-name token in the server\'s guidance, and no other token', () => {
  const original = guidanceFixture.text;
  const rewritten = civicRouter.aliasedView.sourceText('socrata', original);

  // Before: each name at its anchors and elsewhere (measured at G0 and here).
  assert.deepEqual(
    ['get_data', 'search', 'fetch'].map((name) => count(original, name)),
    [19, 11, 9],
  );
  // After: 16 backtick + 1 bold get_data, 7 + 1 search, 6 + 1 fetch renamed.
  assert.deepEqual(
    ['socrata__get_data', 'socrata__search', 'socrata__fetch'].map((name) => count(rewritten, name)),
    [17, 8, 7],
  );
  // Left as written: get_data at no anchor (a fenced `Tool: get_data`, and the
  // header cell "get_data coverage"), and the English search and fetch.
  assert.deepEqual(
    ['get_data', 'search', 'fetch'].map((name) => count(rewritten, name)),
    [2, 3, 2],
  );
  const lines = rewritten.split('\n');
  for (const kept of [
    'Tool: get_data',
    '| Domain | City | get_data coverage |',
    '-- Text search (NEVER use ILIKE — it fails on many Socrata datasets, especially with GROUP BY)',
  ]) {
    assert.ok(lines.includes(kept), `kept as written: ${kept}`);
  }
  for (const phrase of ['from a web search', 'and a search phrase', 'fetch raw date columns', 'offer to fetch the next page']) {
    assert.ok(rewritten.includes(phrase), `English kept: ${phrase}`);
  }
  // No other token changed: undone, the rewrite is the original exactly.
  assert.ok(unaliasText(civicRouter.dispatchMap, rewritten) === original);
  // The other sources' names are not Socrata's: nothing of theirs is touched.
  assert.equal(civicRouter.aliasedView.sourceText('data-commons', original), original);
});
