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
// Then all of it again with every entry's `id`, `alias`, `hosting`,
// `hostings`, `consentDefault` and `publisher` replaced: once by other values,
// once behind getters; and once more with every variant's `keyIn` (0.6.0)
// behind a getter, on real variants. Nothing reads `id`, `hosting` (0.3.0's field, trapped so
// an entry of the old shape is caught too), `hostings`, `consentDefault` or
// `publisher` (0.4.0); the bare view does not read `alias` (only the startup
// checks and the aliased view do). The in-loop functions (0.5.0: the
// directory, the first-step tool, the in-loop prompt and the harness
// definition) run under the same replacements and give the same outcomes.
//
// What the hosted sources move: NYC Charter, Laws and Rules (0.3.0), then
// NYC Checkbook, NYC City Record and NYS Open Legislation (0.6.0). The
// goldens are the website at d1919a8, which had three sources; the manifest
// now holds four more after them, each off unless its switch is on, which no
// capture sets. Every prompt and every tools array is still its golden byte
// for byte. The facts that name the whole vocabulary move, each by a stated
// delta below (`HOSTED`), never by a looser comparison:
//   - `mcpTools` (and so replay's tools and the bare `mcpToolsFor`) is the
//     golden array with the hosted sources' schemas appended, in manifest
//     order (Charter's five, then 10, 7 and 24);
//   - the tool-to-source facts gain each hosted name no earlier source has;
//     `search` stays Socrata's;
//   - the withheld tools gain every hosted source's names, in every
//     configuration;
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

// --- What the hosted sources move: the stated deltas ----------------------------

/** One hosted source, as the goldens' facts now include it: its routing list
 *  and its bare schemas, both from its committed capture (as function
 *  tools). */
const hostedSource = (sourceId: string, fixture: string) => {
  const capture: { tools: { name: string; description: string; inputSchema: unknown }[] } = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', fixture), 'utf8'),
  );
  return {
    sourceId,
    toolNames: capture.tools.map((t) => t.name),
    tools: capture.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
  };
};

/** The four hosted sources, in manifest order. */
const HOSTED_SOURCES = [
  hostedSource('nyc-charter', 'nyc-charter-tools.json'),
  hostedSource('nyc-checkbook', 'nyc-checkbook-tools.json'),
  hostedSource('nyc-record', 'nyc-record-tools.json'),
  hostedSource('nys-legislation', 'nys-legislation-tools.json'),
];

/** The goldens' delta, over all four. */
const HOSTED = {
  sourceIds: HOSTED_SOURCES.map((s) => s.sourceId),
  /** Every hosted name, in manifest order: what the withheld tools gain. */
  toolNames: HOSTED_SOURCES.flatMap((s) => s.toolNames),
  tools: HOSTED_SOURCES.flatMap((s) => s.tools),
};

/** Each hosted name no golden source and no earlier hosted source has, with
 *  the source it belongs to (the first that declares it, in manifest order).
 *  `search` is Socrata's already. */
const hostedNewNames = (goldenNames: readonly string[]): [string, string][] => {
  const seen = new Set(goldenNames);
  const owned: [string, string][] = [];
  for (const source of HOSTED_SOURCES) {
    for (const name of source.toolNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      owned.push([name, source.sourceId]);
    }
  }
  return owned;
};

/** A golden vocabulary's bytes with the hosted sources' schemas appended. */
const withHostedTools = (output: string): string => JSON.stringify([...(JSON.parse(output) as unknown[]), ...HOSTED.tools]);

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
  // The hosted sources are withheld in every capture, so the offered array is
  // never the bare one (the stated delta); `bareIsMcpTools` is the golden's.
  assert.deepEqual(
    {
      offeredIsBare: offered === bare,
      offeredIsMcpTools: offered === router.mcpTools,
      bareIsMcpTools: bare === router.mcpTools,
    },
    { ...capture.identity, offeredIsBare: false, offeredIsMcpTools: false },
    `array identity differs from the golden, with the hosted sources withheld, for configuration ${capture.id}`,
  );
  assert.deepEqual(capture.clientCalls, [], `a tools capture makes no client call (${capture.id})`);
}

function checkAlias(router: CivicRouter, alias: Alias): void {
  const target = goldens.tools.find((t) => t.id === alias.aliasOf);
  assert.ok(target, `alias "${alias.name}" names a capture the fixture holds`);
  const configured = configuredOf(target!);
  // The stated delta: each alias held in the goldens (identity and bytes both
  // true). The vocabulary is now the golden one with the hosted sources'
  // schemas appended, and they are withheld from the offer, so the offer is
  // never the vocabulary object.
  assert.equal(alias.identityCheck.result, true, `alias "${alias.name}": the golden identity`);
  assert.equal(alias.bytesCheck.result, true, `alias "${alias.name}": the golden bytes`);
  if (alias.expression === 'mcpTools') {
    const identity = router.offeredMcpTools(router.mcpToolsFor(undefined), configured) === router.mcpTools;
    assert.equal(identity, false, `alias "${alias.name}": identity, with the hosted sources withheld`);
    assert.ok(JSON.stringify(router.mcpTools) === withHostedTools(target!.output), `alias "${alias.name}": bytes, the golden plus the hosted sources' schemas`);
  } else {
    const bare = router.mcpToolsFor(resolvedOf(target!).lockedPortal);
    assert.equal(router.offeredMcpTools(bare, configured) === bare, false, `alias "${alias.name}": identity, with the hosted sources withheld`);
    const listed = alias.bytesCheck.captures ?? [];
    assert.ok(listed.length > 0, `alias "${alias.name}" lists the captures its bytes are checked in`);
    for (const id of listed) {
      const capture = goldens.tools.find((t) => t.id === id)!;
      assert.ok(
        JSON.stringify(router.mcpToolsFor(resolvedOf(capture).lockedPortal)) === withHostedTools(target!.output),
        `alias "${alias.name}": bytes in ${id}, the golden plus the hosted sources' schemas`,
      );
    }
  }
}

function checkFacts(router: CivicRouter): void {
  const facts = goldens.facts;

  // The fact's tool list is mcpTools' names, then one name no tool has; the
  // vocabulary now ends with the hosted sources' names (the stated delta).
  const goldenNames = facts.sourceIdForToolName.slice(0, -1).map((f) => f.tool);
  assert.deepEqual(
    [...goldenNames, ...HOSTED.toolNames],
    router.mcpTools.map((t) => t.function.name),
    'fact: the tool names, in mcpTools order, then the hosted sources\' names',
  );
  // Every golden answer holds, `search` (Socrata's) included.
  for (const { tool, sourceId } of facts.sourceIdForToolName) {
    assert.equal(router.sourceIdForToolName(tool), decode(sourceId), `fact: the source of tool "${tool}"`);
  }
  const newNames = hostedNewNames(goldenNames);
  // Every hosted name but `search` (which Charter and NYS Open Legislation
  // share with Socrata) is new: 4 + 10 + 7 + 23.
  assert.equal(newNames.length, 44);
  for (const [tool, sourceId] of newNames) {
    assert.ok(!facts.sourceIdForToolName.some((f) => f.tool === tool), `fact: "${tool}" is a name no golden source has`);
    assert.equal(router.sourceIdForToolName(tool), sourceId, `fact: the source of tool "${tool}", ${sourceId}'s`);
  }

  for (const fact of facts.offered) {
    const configured = readMcpEnv(fact.env);
    assert.deepEqual(
      router.withheldToolNames(configured),
      [...fact.withheldToolNames, ...HOSTED.toolNames],
      `fact: withheld tools, the golden's then the hosted sources' names, env ${JSON.stringify(fact.env)}`,
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

// --- Nothing reads `id`, the hosting fields or `alias` ---------------------

async function checkEverything(router: CivicRouter): Promise<void> {
  for (const capture of goldens.prompts) await checkPrompt(router, capture);
  for (const capture of goldens.tools) checkTools(router, capture);
  for (const alias of goldens.aliases) checkAlias(router, alias);
  checkFacts(router);
}

// --- The in-loop functions (0.5.0), over any router ----------------------------

/** Every in-loop function's output over `router`, for fixed inputs: what the
 *  sentinel runs compare. */
async function inLoopOutcomes(router: CivicRouter): Promise<unknown> {
  const configured = readMcpEnv({
    SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
    BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
    NYC_CHARTER_HOSTING: 'sandbox',
    NYC_CHECKBOOK_HOSTING: 'sandbox',
    NYC_RECORD_HOSTING: 'sandbox',
    NYS_LEGISLATION_HOSTING: 'sandbox',
  });
  const input = {
    configured,
    today: '2026-01-15',
    publicationHost: 'records.example.org',
    fetchPrompt: async () => 'Fixture Socrata guidance.',
    fetchInstructions: async (sourceId: string) => (sourceId === 'data-commons' ? 'Fixture Data Commons instructions.' : null),
  };
  const selections = [undefined, ['socrata', 'nyc-charter'], ['nyc-record', 'nys-legislation']];
  const loadedSets = [
    [],
    ['socrata'],
    ['socrata', 'data-commons', 'boston-opencontext', 'nyc-charter'],
    ['nyc-checkbook', 'nyc-record', 'nys-legislation'],
  ];
  return {
    directory: selections.map((selection) => router.directoryPrompt({ ...input, selection })),
    tool: selections.map((selection) => router.aliasedLoadSourceTool({ configured, selection })),
    inLoop: await Promise.all(loadedSets.map((loaded) => router.aliasedInLoopSystemPrompt({ ...input, loaded }))),
    definition: selections.map((selection) =>
      router.harnessDefinition({
        configured,
        selection,
        chosenBy: 'model',
        components: [{ id: 'a-component', version: '1', guidanceHash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }],
      }),
    ),
  };
}

const SENTINEL = 'sentinel: id is carried, never read';
/** A hosting value no consumer could use: if the router read it, an output
 *  or a check would change. 0.3.0's `hosting`, kept so an old-shape entry is
 *  trapped too. */
const SENTINEL_HOSTING = Object.freeze({ kind: 'sentinel: hosting is carried, never read' });
/** The same for 0.4.0's carried fields: the variants, the consent default and
 *  the publisher. */
const SENTINEL_HOSTINGS = Object.freeze([Object.freeze({ kind: 'sentinel: hostings are carried, never read' })]);
const SENTINEL_CONSENT_DEFAULT = 'sentinel: consentDefault is carried, never read';
const SENTINEL_PUBLISHER = 'sentinel: publisher is carried, never read';

/** The carried fields the traps cover, beside `id`. */
const CARRIED = ['hosting', 'hostings', 'consentDefault', 'publisher'] as const;

/** The entries that carry an `npm-package` variant: the hosting traps below
 *  test nothing until one does. */
const hostedEntries = (): string[] =>
  CIVIC_MANIFEST.filter((entry) =>
    ((entry as unknown as { hostings?: readonly { kind?: unknown }[] }).hostings ?? []).some((v) => v.kind === 'npm-package'),
  ).map((e) => e.sourceId);

/** Every entry carries the three 0.4.0 fields, so the traps below trap a
 *  value that is there. */
const everyEntryCarries = (): boolean =>
  CIVIC_MANIFEST.every((entry) => Object.hasOwn(entry, 'hostings') && Object.hasOwn(entry, 'consentDefault') && Object.hasOwn(entry, 'publisher'));

test('id and the hosting fields are never read and the bare view does not depend on alias: every golden holds with id, hosting, hostings, consentDefault and publisher sentinels and every alias another', async () => {
  assert.deepEqual(hostedEntries(), ['nyc-charter', 'nyc-checkbook', 'nyc-record', 'nys-legislation'], 'the manifest carries four hosted entries');
  assert.ok(everyEntryCarries(), 'every entry carries hostings, consentDefault and publisher');
  // An alias must pass the startup checks, so each is replaced by another
  // well-formed one rather than by the sentinel. Every entry gets each
  // carried-field sentinel in place of its own value.
  const manifest: CivicManifest = CIVIC_MANIFEST.map(
    (entry, i) =>
      ({
        ...entry,
        id: SENTINEL,
        alias: `other_alias_${i}`,
        hosting: SENTINEL_HOSTING,
        hostings: SENTINEL_HOSTINGS,
        consentDefault: SENTINEL_CONSENT_DEFAULT,
        publisher: SENTINEL_PUBLISHER,
      }) as unknown as CivicManifestEntry,
  );
  assert.ok(manifest.every((e) => e.id === SENTINEL && e.alias.startsWith('other_alias_')));
  assert.ok(
    manifest.every((e) => {
      const carried = e as unknown as Record<(typeof CARRIED)[number], unknown>;
      return (
        carried.hosting === SENTINEL_HOSTING &&
        carried.hostings === SENTINEL_HOSTINGS &&
        carried.consentDefault === SENTINEL_CONSENT_DEFAULT &&
        carried.publisher === SENTINEL_PUBLISHER
      );
    }),
  );
  assert.notEqual(manifest, CIVIC_MANIFEST);
  await checkEverything(createCivicRouter(manifest));

  // The in-loop functions give, under the sentinels, what they give with
  // only the aliases replaced.
  const aliasesOnly: CivicManifest = CIVIC_MANIFEST.map((entry, i) => ({ ...entry, alias: `other_alias_${i}` }));
  const outcomes = await inLoopOutcomes(createCivicRouter(manifest));
  assert.match(JSON.stringify(outcomes), /other_alias_3/, 'the outcomes name the replaced aliases');
  assert.deepEqual(outcomes, await inLoopOutcomes(createCivicRouter(aliasesOnly)));
});

test('id and the hosting fields are never read, and alias only at construction: every golden holds with id, hosting, hostings, consentDefault and publisher behind getters that throw', async () => {
  assert.deepEqual(hostedEntries(), ['nyc-charter', 'nyc-checkbook', 'nyc-record', 'nys-legislation'], 'the manifest carries four hosted entries');
  assert.ok(everyEntryCarries(), 'every entry carries hostings, consentDefault and publisher');
  const reads: string[] = [];
  const manifest: CivicManifest = CIVIC_MANIFEST.map((entry) => {
    const trapped = { ...entry } as CivicManifestEntry;
    for (const field of ['id', ...CARRIED]) {
      Object.defineProperty(trapped, field, {
        enumerable: true,
        get() {
          reads.push(`${entry.sourceId}.${field}`);
          throw new Error(`${entry.sourceId}.${field} was read`);
        },
      });
    }
    Object.defineProperty(trapped, 'alias', {
      enumerable: true,
      get() {
        reads.push(`${entry.sourceId}.alias`);
        return entry.alias;
      },
    });
    return trapped;
  });
  // The traps work: a read of id or of any carried field throws, and each
  // read is recorded.
  const charter = manifest[3] as unknown as Record<(typeof CARRIED)[number], unknown>;
  assert.throws(() => manifest[0]!.id, /was read/);
  assert.throws(() => charter.hosting, /nyc-charter\.hosting was read/);
  assert.throws(() => charter.hostings, /nyc-charter\.hostings was read/);
  assert.throws(() => charter.consentDefault, /nyc-charter\.consentDefault was read/);
  assert.throws(() => charter.publisher, /nyc-charter\.publisher was read/);
  assert.throws(() => (manifest[0] as unknown as Record<string, unknown>).hostings, /socrata\.hostings was read/);
  assert.deepEqual(
    reads,
    ['socrata.id', 'nyc-charter.hosting', 'nyc-charter.hostings', 'nyc-charter.consentDefault', 'nyc-charter.publisher', 'socrata.hostings'],
  );
  assert.equal(manifest[0]!.alias, 'socrata');
  reads.length = 0;

  const router = createCivicRouter(manifest);
  assert.ok(
    reads.length > 0 && reads.every((r) => r.endsWith('.alias')),
    'construction reads alias (the checks and the map), never id or a carried field',
  );
  reads.length = 0;

  await checkEverything(router);
  assert.deepEqual(reads, [], 'no bare output read an entry\'s id, hosting, hostings, consentDefault, publisher or alias');

  // The in-loop functions read `alias` (the aliased view) and nothing the
  // traps cover, and give what the default router gives.
  assert.deepEqual(await inLoopOutcomes(router), await inLoopOutcomes(civicRouter));
  // (`reads` is narrowed to empty by the assertion above; it has grown since.)
  const inLoopReads = reads as string[];
  assert.ok(
    inLoopReads.length > 0 && inLoopReads.every((r) => r.endsWith('.alias')),
    'the in-loop functions read alias, never id or a carried field',
  );
});

// --- keyIn (0.6.0) is carried, never read ---------------------------------------------

test('keyIn is carried, never read: every golden and every in-loop outcome holds with each variant\'s keyIn behind a getter that throws', async () => {
  // NYS Open Legislation's variant carries it; the trap is set on every
  // variant of every entry, so a read of an absent keyIn is caught too.
  const carriers = CIVIC_MANIFEST.filter((entry) => entry.hostings.some((v) => Object.hasOwn(v, 'keyIn'))).map((e) => e.sourceId);
  assert.deepEqual(carriers, ['nys-legislation'], 'one variant carries keyIn');
  const reads: string[] = [];
  const manifest: CivicManifest = CIVIC_MANIFEST.map((entry) => ({
    ...entry,
    hostings: entry.hostings.map((variant) => {
      const trapped = { ...variant };
      Object.defineProperty(trapped, 'keyIn', {
        enumerable: true,
        get() {
          reads.push(`${entry.sourceId}.${variant.variant}.keyIn`);
          throw new Error(`${entry.sourceId}.${variant.variant}.keyIn was read`);
        },
      });
      return trapped;
    }),
  }));
  // The trap works.
  // Read as a plain record: the field is 0.6.0's.
  const keyInOf = (entry: CivicManifestEntry | undefined): unknown => (entry!.hostings[0] as unknown as Record<string, unknown>).keyIn;
  assert.throws(() => keyInOf(manifest.find((e) => e.sourceId === 'nys-legislation')), /nys-legislation\.sandbox\.keyIn was read/);
  assert.throws(() => keyInOf(manifest[0]), /socrata\.remote\.keyIn was read/);
  reads.length = 0;

  const router = createCivicRouter(manifest);
  await checkEverything(router);
  assert.deepEqual(await inLoopOutcomes(router), await inLoopOutcomes(civicRouter));
  assert.deepEqual(reads, [], 'no output read a variant\'s keyIn');
});
