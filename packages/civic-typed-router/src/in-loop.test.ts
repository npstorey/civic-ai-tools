// Composition for a loaded set (ADR-0037; the seat's ruling 5(c) = A on the
// R8 hub G0 record). Under in-loop routing every request's system prompt is
// the directory over the directory set; once a source is loaded, it goes on
// with the router's block separator and the aliased composition over the
// loaded set without its intro (its preamble, one block per loaded source,
// its outro), so the role and the date are stated once. With nothing loaded
// it is the directory alone, the first request's prompt.
//
// `buildSystemPrompt` does not move: with an empty selection it keeps its
// 0.4.0 bytes (pinned below), and every app golden holds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BLOCK_SEPARATOR,
  civicRouter,
  introFor,
  readMcpEnv,
  type BuildSystemPromptInput,
  type CivicRouter,
  type McpRegistryEnv,
} from './index.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

// --- What the phase adds, reached by name so the red tree type-checks ----------------

type InLoop = (input: BuildSystemPromptInput & { readonly loaded: readonly string[] }) => Promise<string>;

function inLoopOf(router: CivicRouter): InLoop {
  const value = (router as unknown as Record<string, unknown>).aliasedInLoopSystemPrompt;
  assert.equal(typeof value, 'function', 'CivicRouter has aliasedInLoopSystemPrompt');
  return value as InLoop;
}

// --- Inputs ------------------------------------------------------------------------------

const EVERY_SOURCE_ENV = {
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
};
const EVERY_SOURCE = readMcpEnv(EVERY_SOURCE_ENV);

/** Fetchers that return fixed text and log each call. */
function inputFor(configured: McpRegistryEnv, extra: Partial<BuildSystemPromptInput> = {}) {
  const calls: string[] = [];
  const input: BuildSystemPromptInput = {
    configured,
    today: '2026-01-15',
    publicationHost: 'records.example.org',
    fetchPrompt: async (name) => {
      calls.push(`prompt:${name}`);
      return 'Fixture Socrata guidance.';
    },
    fetchInstructions: async (sourceId) => {
      calls.push(`instructions:${sourceId}`);
      return sourceId === 'data-commons' ? 'Fixture Data Commons instructions.' : null;
    },
    ...extra,
  };
  return { input, calls };
}

/** The anchor's rule, written out: the directory, the separator, and the
 *  aliased composition over `selection` less its intro and the blank line
 *  after it. */
async function expectedInLoop(input: BuildSystemPromptInput, selection: readonly string[]): Promise<string> {
  const directory = civicRouter.directoryPrompt(input);
  const composed = await civicRouter.aliasedBuildSystemPrompt({ ...input, selection });
  const prefix = `${introFor(input.today)}\n\n`;
  assert.ok(composed.startsWith(prefix), 'the composition starts with the intro and a blank line');
  return `${directory}${BLOCK_SEPARATOR}${composed.slice(prefix.length)}`;
}

// --- Nothing loaded ----------------------------------------------------------------------

test('in-loop: with nothing loaded it is the directory, byte for byte, and calls no fetcher', async () => {
  const { input, calls } = inputFor(EVERY_SOURCE);
  const prompt = await inLoopOf(civicRouter)({ ...input, loaded: [] });
  assert.equal(prompt, civicRouter.directoryPrompt(input));
  assert.deepEqual(calls, []);
});

// --- One source and two ------------------------------------------------------------------

test('in-loop: one source loaded is the directory, the separator, and the aliased composition over it without its intro', async () => {
  const { input, calls } = inputFor(EVERY_SOURCE);
  const prompt = await inLoopOf(civicRouter)({ ...input, loaded: ['socrata'] });
  assert.equal(prompt, await expectedInLoop(input, ['socrata']));
  assert.equal(prompt.indexOf(introFor(input.today)), 0);
  assert.equal(prompt.lastIndexOf(introFor(input.today)), 0, 'the intro is stated once');
  assert.deepEqual(calls.slice(0, 1), ['prompt:skill-guidance'], 'the composition fetched the loaded source\'s guidance');
});

test('in-loop: two sources loaded compose over both, in manifest order whatever the load order', async () => {
  const { input } = inputFor(EVERY_SOURCE);
  const inLoop = inLoopOf(civicRouter);
  const prompt = await inLoop({ ...input, loaded: ['data-commons', 'socrata'] });
  assert.equal(prompt, await expectedInLoop(input, ['socrata', 'data-commons']));
  assert.equal(prompt, await inLoop({ ...input, loaded: ['socrata', 'data-commons'] }));
  assert.match(prompt, /You have access to TWO MCP data sources through the tools below\./);
});

test('in-loop: the output for one loaded source, with fixed fetchers, is the pinned fixture', async () => {
  const fixture: { input: { env: Record<string, string>; today: string; publicationHost: string; loaded: string[] }; output: string } = JSON.parse(
    readFileSync(join(FIXTURES, 'in-loop-one-source.json'), 'utf8'),
  );
  assert.deepEqual(fixture.input.env, EVERY_SOURCE_ENV);
  const { input } = inputFor(readMcpEnv(fixture.input.env), { today: fixture.input.today, publicationHost: fixture.input.publicationHost });
  const prompt = await inLoopOf(civicRouter)({ ...input, loaded: fixture.input.loaded });
  assert.ok(prompt === fixture.output, 'the in-loop prompt differs from the pinned fixture');
});

// --- A loaded id outside the directory set ------------------------------------------------

test('in-loop: a loaded id outside the directory set composes nothing for it', async () => {
  const inLoop = inLoopOf(civicRouter);
  // Not in the selection.
  const narrowed = inputFor(EVERY_SOURCE, { selection: ['socrata', 'data-commons'] });
  assert.equal(
    await inLoop({ ...narrowed.input, loaded: ['socrata', 'boston-opencontext'] }),
    await expectedInLoop(narrowed.input, ['socrata']),
  );
  // Not configured.
  const required = inputFor(readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' }));
  assert.equal(
    await inLoop({ ...required.input, loaded: ['nyc-charter', 'data-commons'] }),
    await expectedInLoop(required.input, ['data-commons']),
  );
  // Not in the manifest, and nothing else loaded: the directory alone.
  const unknown = inputFor(EVERY_SOURCE);
  assert.equal(await inLoop({ ...unknown.input, loaded: ['no-such-source'] }), civicRouter.directoryPrompt(unknown.input));
  assert.deepEqual(unknown.calls, []);
});

// --- The tools and the offered reasons agree with the composed set ---------------------------

test('in-loop: the offered tools and the offered reasons for a loaded set agree with the set it composes, for zero, one and two sources', async () => {
  const inLoop = inLoopOf(civicRouter);
  const sourceOf = (name: string): string | undefined => civicRouter.dispatchMap.get(name)?.sourceId;
  for (const loaded of [[], ['socrata'], ['socrata', 'data-commons']]) {
    const { input, calls } = inputFor(EVERY_SOURCE);
    const prompt = await inLoop({ ...input, loaded });
    const tools = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpTools, EVERY_SOURCE, loaded);
    const toolSources = [...new Set(tools.map((tool) => sourceOf(tool.function.name)))];
    const selected = civicRouter
      .sourcesOffered(EVERY_SOURCE, loaded)
      .filter((offered) => offered.reason === 'selected')
      .map((offered) => offered.sourceId);
    assert.deepEqual(toolSources, loaded, `the offered tools are the loaded sources' (${loaded.join(', ')})`);
    assert.deepEqual(selected, loaded, `the selected sources are the loaded ones (${loaded.join(', ')})`);
    assert.deepEqual(civicRouter.offeredSkillSources(EVERY_SOURCE, loaded), loaded);
    if (loaded.length === 0) {
      assert.equal(prompt, civicRouter.directoryPrompt(input), 'nothing composed');
      assert.deepEqual(calls, []);
    } else {
      assert.equal(prompt, await expectedInLoop(input, loaded));
      const fetched = [...new Set(calls.map((call) => (call.startsWith('prompt:') ? 'socrata' : call.slice('instructions:'.length))))];
      assert.deepEqual(fetched.sort(), [...loaded].sort(), 'the composition fetched for the loaded sources only');
    }
  }
});

// --- What does not move ----------------------------------------------------------------------

/** `buildSystemPrompt` with an empty selection at 0.4.0 (hub 9a6eff5): 807
 *  characters for this input (the R8 hub G0 record, 5(b)). */
const EMPTY_SELECTION_PROMPT =
  'You are a helpful assistant with access to civic and statistical data via MCP tools.\n\nToday\'s date is 2026-10-19. Always use this as the current date for interpreting relative time expressions like "last year" or "past two months."\n\nYou have access to NO MCP data sources through the tools below.\n\n\n\nSource selection rules:\n- **Multi-source equity questions** that join operational data against demographic context → plan a multi-step analysis, attribute each figure to its source, and mind geography alignment (Boston neighborhoods and city council districts are not standard census geographies — state the mismatch rather than silently imputing).\n\nSee the Cross-source decision logic section in the Data Commons guidance below for the join pattern.\n\n---\n\nWhen you get results, summarize clearly and cite .';

test('in-loop: buildSystemPrompt and aliasedBuildSystemPrompt with an empty selection keep their 0.4.0 bytes (807 characters)', async () => {
  assert.equal(EMPTY_SELECTION_PROMPT.length, 807);
  const input: BuildSystemPromptInput = {
    configured: readMcpEnv({}),
    today: '2026-10-19',
    publicationHost: null,
    fetchPrompt: async () => {
      throw new Error('no fetch for an empty selection');
    },
    fetchInstructions: async () => {
      throw new Error('no fetch for an empty selection');
    },
    selection: [],
  };
  assert.equal(await civicRouter.buildSystemPrompt(input), EMPTY_SELECTION_PROMPT);
  assert.equal(await civicRouter.aliasedBuildSystemPrompt(input), EMPTY_SELECTION_PROMPT);
});
