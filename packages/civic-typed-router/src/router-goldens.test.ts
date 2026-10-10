// The pure-move bar: every output captured from the reference website at
// 3a0c894 (`__fixtures__/app-goldens.json`) is reproduced byte for byte, with
// each capture's own inputs, driving the router only through the package
// entry (`./index.ts`).
//
//   - each composed prompt, as a string, and the fetcher calls it made, in
//     order and with their arguments;
//   - each tools array, by `JSON.stringify`, and which arrays are the same
//     object;
//   - each alias (replay's tools, the bare `mcpToolsFor`), by identity and by
//     bytes;
//   - every fact: tool to source, the offered sources and withheld tools, and
//     the configuration reading at its edges.
//
// Then all of it again with every entry's `id` and `alias` replaced: once by a
// sentinel value, once by a getter that throws. Nothing reads either field.
//
// The fixture is read, never written: its two files' blobs are pinned at the
// gate, and the capture script beside it is how they are regenerated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  readMcpEnv,
  type CivicManifest,
  type CivicManifestEntry,
  type CivicRouter,
  type McpRegistryEnv,
} from './index.ts';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'app-goldens.json');

// --- The fixture's shape ---------------------------------------------------

type Encoded = unknown;
type TextEntry = { fixture: string } | { text: string } | null;
interface ClientCall {
  fn: string;
  args: unknown[];
  outcome?: string;
}
interface PromptCapture {
  id: string;
  env: Record<string, string>;
  client: {
    guidance: { kind: 'returns'; fixture?: string; text?: string } | { kind: 'throws' };
    instructions: Record<string, TextEntry>;
  };
  resolved: Encoded;
  configured: Encoded;
  publicationHost: string | null;
  today: string;
  clientCalls: ClientCall[];
  output: string;
}
interface ToolsCapture {
  id: string;
  env: Record<string, string>;
  resolved: Encoded;
  configured: Encoded;
  identity: { offeredIsBare: boolean; offeredIsMcpTools: boolean; bareIsMcpTools: boolean };
  clientCalls: ClientCall[];
  output: string;
}
interface Alias {
  name: string;
  expression: 'mcpTools' | 'mcpToolsFor(lockedPortal)';
  aliasOf: string;
  identityCheck: { result: boolean };
  bytesCheck: { captures?: string[]; result: boolean };
}
interface Goldens {
  _meta: { website: { commit: string }; counts: { prompts: number; tools: number } };
  fixtureStrings: Record<string, string>;
  prompts: PromptCapture[];
  tools: ToolsCapture[];
  aliases: Alias[];
  facts: {
    sourceIdForToolName: { tool: string; sourceId: Encoded }[];
    offered: { env: Record<string, string>; withheldToolNames: string[]; offeredSkillSources: string[] }[];
    readMcpEnvFromProcess: { id: string; env: Record<string, string>; keys: string[]; result: Encoded }[];
  };
}

const goldens: Goldens = JSON.parse(readFileSync(FIXTURE, 'utf8'));

/** The fixture writes `undefined` as `{"$undefined": true}`. */
function decode(value: Encoded): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length === 1 && record.$undefined === true) return undefined;
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

function resolvedOf(capture: { resolved: Encoded }): { portal?: string; lockedPortal?: string } {
  return decode(capture.resolved) as { portal?: string; lockedPortal?: string };
}

function configuredOf(capture: { configured: Encoded }): McpRegistryEnv {
  return decode(capture.configured) as McpRegistryEnv;
}

/** Fetchers that answer as the capture's client stub did, and log each call
 *  the way the stub logged it. */
function fetchersFor(capture: PromptCapture) {
  const calls: ClientCall[] = [];
  const textOf = (entry: TextEntry | undefined): string | null => {
    if (entry === null || entry === undefined) return null;
    if ('fixture' in entry) return goldens.fixtureStrings[entry.fixture]!;
    return entry.text;
  };
  const fetchPrompt = async (name: string, args: Record<string, string>): Promise<string> => {
    const call: ClientCall = { fn: 'callMcpPrompt', args: JSON.parse(JSON.stringify([name, args])) };
    calls.push(call);
    const guidance = capture.client.guidance;
    if (guidance.kind === 'throws') {
      call.outcome = 'threw';
      throw new Error('fixture: the Socrata prompt fetch fails');
    }
    call.outcome = 'returned';
    return textOf(guidance as TextEntry) as string;
  };
  const fetchInstructions = async (sourceId: string): Promise<string | null> => {
    const call: ClientCall = { fn: 'getServerInstructions', args: [sourceId] };
    calls.push(call);
    const entry = Object.hasOwn(capture.client.instructions, sourceId) ? capture.client.instructions[sourceId] : null;
    const text = textOf(entry);
    call.outcome = text === null ? 'returned-null' : 'returned';
    return text;
  };
  return { calls, fetchPrompt, fetchInstructions };
}

// --- One check per output kind, over any router ------------------------------

/** The routes' expression: `withPortalLockGuidance(await buildSystemPrompt(portal), lockedPortal)`. */
async function checkPrompt(router: CivicRouter, capture: PromptCapture): Promise<void> {
  const configured = configuredOf(capture);
  const { portal, lockedPortal } = resolvedOf(capture);
  const { calls, fetchPrompt, fetchInstructions } = fetchersFor(capture);

  const prompt = router.withPortalLockGuidance(
    await router.buildSystemPrompt({
      portal,
      configured,
      today: capture.today,
      publicationHost: capture.publicationHost,
      fetchPrompt,
      fetchInstructions,
    }),
    lockedPortal,
    configured,
  );

  assert.ok(prompt === capture.output, `the composed prompt differs from the golden for configuration ${capture.id}`);
  assert.deepEqual(calls, capture.clientCalls, `the fetcher calls differ from the golden for configuration ${capture.id}`);
}

/** The routes' expression: `offeredMcpTools(mcpToolsFor(lockedPortal))`. */
function checkTools(router: CivicRouter, capture: ToolsCapture): void {
  const configured = configuredOf(capture);
  const { lockedPortal } = resolvedOf(capture);
  const bare = router.mcpToolsFor(lockedPortal);
  const offered = router.offeredMcpTools(bare, configured);

  assert.ok(JSON.stringify(offered) === capture.output, `the tools array differs from the golden for configuration ${capture.id}`);
  assert.deepEqual(
    {
      offeredIsBare: offered === bare,
      offeredIsMcpTools: offered === router.mcpTools,
      bareIsMcpTools: bare === router.mcpTools,
    },
    capture.identity,
    `array identity differs from the golden for configuration ${capture.id}`,
  );
  assert.deepEqual(capture.clientCalls, [], `a tools capture makes no client call (${capture.id})`);
}

function checkAlias(router: CivicRouter, alias: Alias): void {
  const target = goldens.tools.find((t) => t.id === alias.aliasOf);
  assert.ok(target, `alias "${alias.name}" names a capture the fixture holds`);
  const configured = configuredOf(target!);
  if (alias.expression === 'mcpTools') {
    const identity = router.offeredMcpTools(router.mcpToolsFor(undefined), configured) === router.mcpTools;
    assert.equal(identity, alias.identityCheck.result, `alias "${alias.name}": identity`);
    const bytes = goldens.tools.every(() => JSON.stringify(router.mcpTools) === target!.output);
    assert.equal(bytes, alias.bytesCheck.result, `alias "${alias.name}": bytes`);
  } else {
    const bare = router.mcpToolsFor(resolvedOf(target!).lockedPortal);
    assert.equal(router.offeredMcpTools(bare, configured) === bare, alias.identityCheck.result, `alias "${alias.name}": identity`);
    const listed = alias.bytesCheck.captures ?? [];
    assert.ok(listed.length > 0, `alias "${alias.name}" lists the captures its bytes are checked in`);
    const bytes = listed.every((id) => {
      const capture = goldens.tools.find((t) => t.id === id)!;
      return JSON.stringify(router.mcpToolsFor(resolvedOf(capture).lockedPortal)) === target!.output;
    });
    assert.equal(bytes, alias.bytesCheck.result, `alias "${alias.name}": bytes`);
  }
}

function checkFacts(router: CivicRouter): void {
  const facts = goldens.facts;

  // The fact's tool list is mcpTools' names, then one name no tool has.
  assert.deepEqual(
    facts.sourceIdForToolName.slice(0, -1).map((f) => f.tool),
    router.mcpTools.map((t) => t.function.name),
    'fact: the tool names, in mcpTools order',
  );
  for (const { tool, sourceId } of facts.sourceIdForToolName) {
    assert.equal(router.sourceIdForToolName(tool), decode(sourceId), `fact: the source of tool "${tool}"`);
  }

  for (const fact of facts.offered) {
    const configured = readMcpEnv(fact.env);
    assert.deepEqual(router.withheldToolNames(configured), fact.withheldToolNames, `fact: withheld tools, env ${JSON.stringify(fact.env)}`);
    assert.deepEqual(router.offeredSkillSources(configured), fact.offeredSkillSources, `fact: offered sources, env ${JSON.stringify(fact.env)}`);
  }

  for (const fact of facts.readMcpEnvFromProcess) {
    const read = readMcpEnv(fact.env);
    assert.deepEqual(Object.keys(read), fact.keys, `fact: configuration keys, ${fact.id}`);
    assert.deepEqual(read, decode(fact.result), `fact: configuration reading, ${fact.id}`);
  }
}

/** The capture's `configured` is what the website read from the capture's
 *  environment; the router's reader reads the same from the same variables. */
function checkConfigurationReading(capture: { id: string; env: Record<string, string>; configured: Encoded }): void {
  const read = readMcpEnv(capture.env);
  assert.deepEqual(read, configuredOf(capture), `configuration reading differs for ${capture.id}`);
  assert.deepEqual(Object.keys(read), Object.keys(capture.configured as object), `configuration keys differ for ${capture.id}`);
}

// --- The fixture is what this suite expects --------------------------------

test('goldens: the fixture is the website capture at 3a0c894, 42 prompts and 5 tools arrays', () => {
  assert.equal(goldens._meta.website.commit, '3a0c894701e8e75161c85c567eb1c11efc06da71');
  assert.equal(goldens.prompts.length, goldens._meta.counts.prompts);
  assert.equal(goldens.tools.length, goldens._meta.counts.tools);
  assert.equal(goldens.prompts.length, 42);
  assert.equal(goldens.tools.length, 5);
  assert.equal(new Set(goldens.prompts.map((c) => c.id)).size, 42, 'prompt capture ids are distinct');
});

// --- The default router, one test per capture ------------------------------

for (const capture of goldens.prompts) {
  test(`goldens: prompt ${capture.id}`, async () => {
    checkConfigurationReading(capture);
    await checkPrompt(civicRouter, capture);
  });
}

for (const capture of goldens.tools) {
  test(`goldens: tools ${capture.id}`, () => {
    checkConfigurationReading(capture);
    checkTools(civicRouter, capture);
  });
}

test('goldens: aliases (replay\'s tools, the bare mcpToolsFor) by identity and bytes', () => {
  assert.equal(goldens.aliases.length, 4);
  for (const alias of goldens.aliases) checkAlias(civicRouter, alias);
});

test('goldens: facts (tool to source, offered and withheld, configuration reading)', () => {
  checkFacts(civicRouter);
});

// --- Nothing reads `id` or `alias` -----------------------------------------

async function checkEverything(router: CivicRouter): Promise<void> {
  for (const capture of goldens.prompts) await checkPrompt(router, capture);
  for (const capture of goldens.tools) checkTools(router, capture);
  for (const alias of goldens.aliases) checkAlias(router, alias);
  checkFacts(router);
}

const SENTINEL = 'sentinel: id and alias are carried, never read';

test('id and alias are never read: every golden holds with both replaced by one sentinel', async () => {
  const manifest: CivicManifest = CIVIC_MANIFEST.map((entry) => ({ ...entry, id: SENTINEL, alias: SENTINEL }));
  assert.ok(manifest.every((e) => e.id === SENTINEL && e.alias === SENTINEL));
  assert.notEqual(manifest, CIVIC_MANIFEST);
  await checkEverything(createCivicRouter(manifest));
});

test('id and alias are never read: every golden holds with both behind a getter that throws', async () => {
  const reads: string[] = [];
  const manifest: CivicManifest = CIVIC_MANIFEST.map((entry) => {
    const trapped = { ...entry } as CivicManifestEntry;
    for (const field of ['id', 'alias'] as const) {
      Object.defineProperty(trapped, field, {
        enumerable: true,
        get() {
          reads.push(`${entry.sourceId}.${field}`);
          throw new Error(`${entry.sourceId}.${field} was read`);
        },
      });
    }
    return trapped;
  });
  // The trap works: a read throws and is recorded.
  assert.throws(() => manifest[0]!.id, /was read/);
  reads.length = 0;

  await checkEverything(createCivicRouter(manifest));
  assert.deepEqual(reads, [], 'no code path read an entry\'s id or alias');
});
