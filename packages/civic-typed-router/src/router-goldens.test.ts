// The pure-move bar: every output captured from the reference website at
// d1919a8 (`__fixtures__/app-goldens.json`; 0.1.0 captured at 3a0c894) is reproduced byte for byte, with
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
// Then all of it again with every entry's `id`, `alias` and `hosting`
// replaced: once by other values, once behind getters. Nothing reads `id` or
// `hosting`; the bare view does not read `alias` (only the startup checks and
// the aliased view do).
//
// What NYC Charter, Laws and Rules moves (0.3.0). The goldens are the website
// at d1919a8, which had three sources; the manifest now holds a fourth, last,
// and off unless its switch is on, which no capture sets. Every prompt and
// every tools array is still its golden byte for byte. The facts that name
// the whole vocabulary move, each by a stated delta below (`CHARTER`), never
// by a looser comparison:
//   - `mcpTools` (and so replay's tools and the bare `mcpToolsFor`) is the
//     golden array with Charter's five schemas appended;
//   - the tool-to-source facts gain Charter's four names no other source
//     has; `search` stays Socrata's;
//   - the withheld tools gain Charter's five, in every configuration;
//   - so nothing is ever withheld-free: `offeredIsBare` and
//     `offeredIsMcpTools` are false in every capture, where the goldens have
//     them true with Boston OpenContext configured.
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

// --- What the fourth source moves: the stated deltas ----------------------------

/** NYC Charter, Laws and Rules, as the goldens' facts now include it: its
 *  routing list, its bare schemas (from the committed capture, as function
 *  tools), and the source its four unshared names belong to. */
const CHARTER = (() => {
  const capture: { tools: { name: string; description: string; inputSchema: unknown }[] } = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'nyc-charter-tools.json'), 'utf8'),
  );
  return {
    sourceId: 'nyc-charter',
    toolNames: ['search', 'get_section', 'list_titles', 'get_title', 'get_version'],
    /** The names no golden source has: `search` is Socrata's already. */
    newNames: ['get_section', 'list_titles', 'get_title', 'get_version'],
    tools: capture.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
  };
})();

/** A golden vocabulary's bytes with Charter's five schemas appended. */
const withCharterTools = (output: string): string => JSON.stringify([...(JSON.parse(output) as unknown[]), ...CHARTER.tools]);

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
  // Charter is withheld in every capture, so the offered array is never the
  // bare one (the stated delta); `bareIsMcpTools` is the golden's.
  assert.deepEqual(
    {
      offeredIsBare: offered === bare,
      offeredIsMcpTools: offered === router.mcpTools,
      bareIsMcpTools: bare === router.mcpTools,
    },
    { ...capture.identity, offeredIsBare: false, offeredIsMcpTools: false },
    `array identity differs from the golden, with Charter withheld, for configuration ${capture.id}`,
  );
  assert.deepEqual(capture.clientCalls, [], `a tools capture makes no client call (${capture.id})`);
}

function checkAlias(router: CivicRouter, alias: Alias): void {
  const target = goldens.tools.find((t) => t.id === alias.aliasOf);
  assert.ok(target, `alias "${alias.name}" names a capture the fixture holds`);
  const configured = configuredOf(target!);
  // The stated delta: each alias held in the goldens (identity and bytes both
  // true). The vocabulary is now the golden one with Charter's five appended,
  // and Charter is withheld from the offer, so the offer is never the
  // vocabulary object.
  assert.equal(alias.identityCheck.result, true, `alias "${alias.name}": the golden identity`);
  assert.equal(alias.bytesCheck.result, true, `alias "${alias.name}": the golden bytes`);
  if (alias.expression === 'mcpTools') {
    const identity = router.offeredMcpTools(router.mcpToolsFor(undefined), configured) === router.mcpTools;
    assert.equal(identity, false, `alias "${alias.name}": identity, with Charter withheld`);
    assert.ok(JSON.stringify(router.mcpTools) === withCharterTools(target!.output), `alias "${alias.name}": bytes, the golden plus Charter's five`);
  } else {
    const bare = router.mcpToolsFor(resolvedOf(target!).lockedPortal);
    assert.equal(router.offeredMcpTools(bare, configured) === bare, false, `alias "${alias.name}": identity, with Charter withheld`);
    const listed = alias.bytesCheck.captures ?? [];
    assert.ok(listed.length > 0, `alias "${alias.name}" lists the captures its bytes are checked in`);
    for (const id of listed) {
      const capture = goldens.tools.find((t) => t.id === id)!;
      assert.ok(
        JSON.stringify(router.mcpToolsFor(resolvedOf(capture).lockedPortal)) === withCharterTools(target!.output),
        `alias "${alias.name}": bytes in ${id}, the golden plus Charter's five`,
      );
    }
  }
}

function checkFacts(router: CivicRouter): void {
  const facts = goldens.facts;

  // The fact's tool list is mcpTools' names, then one name no tool has; the
  // vocabulary now ends with Charter's five (the stated delta).
  assert.deepEqual(
    [...facts.sourceIdForToolName.slice(0, -1).map((f) => f.tool), ...CHARTER.toolNames],
    router.mcpTools.map((t) => t.function.name),
    'fact: the tool names, in mcpTools order, then Charter\'s five',
  );
  // Every golden answer holds, `search` (Socrata's) included.
  for (const { tool, sourceId } of facts.sourceIdForToolName) {
    assert.equal(router.sourceIdForToolName(tool), decode(sourceId), `fact: the source of tool "${tool}"`);
  }
  for (const tool of CHARTER.newNames) {
    assert.ok(!facts.sourceIdForToolName.some((f) => f.tool === tool), `fact: "${tool}" is a name no golden source has`);
    assert.equal(router.sourceIdForToolName(tool), CHARTER.sourceId, `fact: the source of tool "${tool}", Charter's`);
  }

  for (const fact of facts.offered) {
    const configured = readMcpEnv(fact.env);
    assert.deepEqual(
      router.withheldToolNames(configured),
      [...fact.withheldToolNames, ...CHARTER.toolNames],
      `fact: withheld tools, the golden's then Charter's five, env ${JSON.stringify(fact.env)}`,
    );
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

test('goldens: the fixture is the website capture at d1919a8, 42 prompts and 5 tools arrays', () => {
  assert.equal(goldens._meta.website.commit, 'd1919a86cc826c0870c8cfbc4c902791c6f9086d');
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

// --- Nothing reads `id`, `hosting` or `alias` ------------------------------

async function checkEverything(router: CivicRouter): Promise<void> {
  for (const capture of goldens.prompts) await checkPrompt(router, capture);
  for (const capture of goldens.tools) checkTools(router, capture);
  for (const alias of goldens.aliases) checkAlias(router, alias);
  checkFacts(router);
}

const SENTINEL = 'sentinel: id is carried, never read';
/** A hosting value no consumer could use: if the router read it, an output
 *  or a check would change. */
const SENTINEL_HOSTING = Object.freeze({ kind: 'sentinel: hosting is carried, never read' });

/** Whether the civic manifest carries a hosting field at all: the hosting
 *  traps below test nothing until one does. */
const hostedEntries = (): string[] =>
  CIVIC_MANIFEST.filter((entry) => (entry as unknown as { hosting?: unknown }).hosting !== undefined).map((e) => e.sourceId);

test('id and hosting are never read and the bare view does not depend on alias: every golden holds with id and hosting sentinels and every alias another', async () => {
  assert.deepEqual(hostedEntries(), ['nyc-charter'], 'the manifest carries one hosted entry');
  // An alias must pass the startup checks, so each is replaced by another
  // well-formed one rather than by the sentinel. Every entry gets a hosting
  // sentinel, the hosted one in place of its own.
  const manifest: CivicManifest = CIVIC_MANIFEST.map(
    (entry, i) => ({ ...entry, id: SENTINEL, alias: `other_alias_${i}`, hosting: SENTINEL_HOSTING }) as unknown as CivicManifestEntry,
  );
  assert.ok(manifest.every((e) => e.id === SENTINEL && e.alias.startsWith('other_alias_')));
  assert.ok(manifest.every((e) => (e as unknown as { hosting: unknown }).hosting === SENTINEL_HOSTING));
  assert.notEqual(manifest, CIVIC_MANIFEST);
  await checkEverything(createCivicRouter(manifest));
});

test('id and hosting are never read, and alias only at construction: every golden holds with id and hosting behind getters that throw', async () => {
  assert.deepEqual(hostedEntries(), ['nyc-charter'], 'the manifest carries one hosted entry');
  const reads: string[] = [];
  const manifest: CivicManifest = CIVIC_MANIFEST.map((entry) => {
    const trapped = { ...entry } as CivicManifestEntry;
    Object.defineProperty(trapped, 'id', {
      enumerable: true,
      get() {
        reads.push(`${entry.sourceId}.id`);
        throw new Error(`${entry.sourceId}.id was read`);
      },
    });
    Object.defineProperty(trapped, 'hosting', {
      enumerable: true,
      get() {
        reads.push(`${entry.sourceId}.hosting`);
        throw new Error(`${entry.sourceId}.hosting was read`);
      },
    });
    Object.defineProperty(trapped, 'alias', {
      enumerable: true,
      get() {
        reads.push(`${entry.sourceId}.alias`);
        return entry.alias;
      },
    });
    return trapped;
  });
  // The traps work: a read of id or hosting throws, and each read is recorded.
  assert.throws(() => manifest[0]!.id, /was read/);
  assert.throws(() => (manifest.at(-1) as unknown as { hosting: unknown }).hosting, /nyc-charter\.hosting was read/);
  assert.equal(manifest[0]!.alias, 'socrata');
  reads.length = 0;

  const router = createCivicRouter(manifest);
  assert.ok(reads.length > 0 && reads.every((r) => r.endsWith('.alias')), 'construction reads alias (the checks and the map), never id or hosting');
  reads.length = 0;

  await checkEverything(router);
  assert.deepEqual(reads, [], 'no bare output read an entry\'s id, hosting or alias');
});
