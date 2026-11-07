// The inventory as data (hub #309, S2-A P0): the hub's
// `inventory/civic-inventory.json` (`civic-inventory/2`) is the source of
// truth for the seven sources, and `CIVIC_MANIFEST` stays code, held equal to
// it here (G0-5 A).
//
//   A0.2  `createCivicRouter(manifestFromInventory(file, CIVIC_KINDS))`
//         reproduces every golden of `router-goldens.test.ts` and the in-loop
//         fixture byte for byte, and gives the same harness definitions as
//         `civicRouter`. Decoy: the file with one description changed by one
//         character fails, naming the entry and the field.
//   A0.3  The mirror: each loaded entry's data fields deep-equal
//         `CIVIC_MANIFEST`'s, its tools hash to its `toolsRef.sha256`, the
//         order is the file's, and `CIVIC_INVENTORY` names the file and its
//         hash. Decoy: two entries swapped fail on order.
//   A0.5  The pack kind: a pack over `socrata` with a portal and a dataset in
//         its filter, its tools, the `search` rule, its dispatch, its
//         hostings and consent default; and the refusals.
//
// The file is read here, by the test; the loader and the kinds read no file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  canonicalJson,
  CIVIC_INVENTORY,
  CIVIC_KINDS,
  CIVIC_MANIFEST,
  civicKinds,
  civicRouter,
  createCivicRouter,
  InventoryLoadError,
  manifestFromInventory,
  readMcpEnv,
  sha256Hex,
  ToolNameError,
  toolsSha256,
  type CivicManifest,
  type CivicManifestEntry,
  type CivicRouter,
  type InventoryDocument,
  type InventoryPackEntry,
  type McpRegistryEnv,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(SRC, '__fixtures__');
const REPO = join(SRC, '..', '..', '..');
const INVENTORY_PATH = join(REPO, 'inventory', 'civic-inventory.json');

const readInventory = (): InventoryDocument => JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
const FILE = readInventory();
const LOADED: CivicManifest = manifestFromInventory(FILE, CIVIC_KINDS);
const LOADED_ROUTER = createCivicRouter(LOADED);

// --- A0.3: the mirror ------------------------------------------------------------------

/** The data fields A0.3 holds equal, in the criterion's order. */
const DATA_FIELDS = [
  'id',
  'alias',
  'sourceId',
  'displayName',
  'description',
  'freshness',
  'freshnessSource',
  'configuration',
  'hostings',
  'consentDefault',
  'publisher',
  'toolNames',
] as const;

/** Every way `manifest` differs from `CIVIC_MANIFEST` in the mirror's terms,
 *  as `<sourceId>.<field>` (or the order), in manifest order. */
function mirrorDifferences(manifest: CivicManifest): string[] {
  const out: string[] = [];
  const order = manifest.map((entry) => entry.sourceId);
  const expectedOrder = CIVIC_MANIFEST.map((entry) => entry.sourceId);
  if (JSON.stringify(order) !== JSON.stringify(expectedOrder)) out.push(`order: ${order.join(', ')} is not ${expectedOrder.join(', ')}`);
  for (const entry of manifest) {
    const code = CIVIC_MANIFEST.find((e) => e.sourceId === entry.sourceId);
    if (!code) {
      out.push(`${entry.sourceId}: not in CIVIC_MANIFEST`);
      continue;
    }
    for (const field of DATA_FIELDS) {
      try {
        assert.deepStrictEqual(entry[field], code[field]);
      } catch {
        out.push(`${entry.sourceId}.${field}`);
      }
    }
    for (const part of ['citation', 'lockMention', 'preambleEntry'] as const) {
      if (entry.prompt?.[part] !== code.prompt?.[part]) out.push(`${entry.sourceId}.prompt.${part}`);
    }
    for (const part of ['tools', 'toolsFor', 'portalLock'] as const) {
      if (entry[part] !== code[part]) out.push(`${entry.sourceId}.${part}`);
    }
  }
  return out;
}

test('A0.3: the loaded entries are CIVIC_MANIFEST, field for field, in its order', () => {
  assert.equal(LOADED.length, 7);
  assert.deepEqual(mirrorDifferences(LOADED), []);
  // The file's order is the manifest's.
  assert.deepEqual(
    FILE.entries.map((e) => e.sourceId),
    CIVIC_MANIFEST.map((e) => e.sourceId),
  );
  // Every entry of version 1 is a server.
  assert.ok(FILE.entries.every((e) => e.kind === 'server'));
});

test("A0.3: each entry's tools hash to its toolsRef.sha256 (toolsSha256), with its routing list", () => {
  for (const [i, item] of FILE.entries.entries()) {
    const entry = CIVIC_MANIFEST[i]!;
    assert.equal(toolsSha256(entry.tools), item.toolsRef!.sha256, `${entry.sourceId}: toolsRef.sha256`);
    assert.deepEqual(item.toolsRef!.toolNames, entry.toolNames, `${entry.sourceId}: toolsRef.toolNames`);
  }
});

test("A0.3: the tools' hash is S1's definition: each entry's toolsRef.sha256 equals benchmark/inventories/7.json's", () => {
  const seven: { entries: { sourceId: string; toolsRef: { sha256: string } }[] } = JSON.parse(
    readFileSync(join(REPO, 'benchmark', 'inventories', '7.json'), 'utf8'),
  );
  for (const item of FILE.entries) {
    const s1 = seven.entries.find((e) => e.sourceId === item.sourceId);
    assert.equal(item.toolsRef!.sha256, s1?.toolsRef.sha256, `${item.sourceId}: the same hash as S1's 7.json`);
  }
});

test('A0.3: CIVIC_INVENTORY names the file: its id, its version and its hash, which is the .sha256 file and the canonicalJson SHA-256 of the parsed file', () => {
  const recorded = readFileSync(`${INVENTORY_PATH}.sha256`, 'utf8');
  assert.match(recorded, /^[0-9a-f]{64}\n$/);
  assert.equal(CIVIC_INVENTORY.hash, recorded.trim());
  assert.equal(CIVIC_INVENTORY.hash, sha256Hex(canonicalJson(FILE)));
  assert.equal(CIVIC_INVENTORY.id, FILE.id);
  assert.equal(CIVIC_INVENTORY.version, FILE.version);
  assert.match(CIVIC_INVENTORY.version, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test('A0.3 decoy: the file with two entries swapped fails on order', () => {
  const swapped = readInventory();
  const entries = [...swapped.entries];
  [entries[1], entries[2]] = [entries[2]!, entries[1]!];
  const differences = mirrorDifferences(manifestFromInventory({ ...swapped, entries }, CIVIC_KINDS));
  assert.equal(differences.length, 1, differences.join('; '));
  assert.match(differences[0]!, /^order: socrata, boston-opencontext, data-commons, /);
});

test('A0.3 decoy: one hosting variant, consent default or publisher changed in the file fails, naming the entry and the field', () => {
  const cases: [number, (e: Record<string, unknown>) => void, string][] = [
    [3, (e) => ((e.hostings as { outbound: string[] }[])[0]!.outbound = ['example.org']), 'nyc-charter.hostings'],
    [4, (e) => (e.consentDefault = 'on'), 'nyc-checkbook.consentDefault'],
    [2, (e) => (e.publisher = 'Someone else'), 'boston-opencontext.publisher'],
    [1, (e) => ((e.prompt as Record<string, string>).lockMention = 'Data Commons!'), 'data-commons.prompt.lockMention'],
  ];
  for (const [i, change, named] of cases) {
    const copy = readInventory();
    change(copy.entries[i] as unknown as Record<string, unknown>);
    assert.deepEqual(mirrorDifferences(manifestFromInventory(copy, CIVIC_KINDS)), [named]);
  }
});

// --- A0.2: the goldens over the loaded manifest ---------------------------------------

type Encoded = unknown;
type TextEntry = { fixture: string } | { text: string } | null;
interface ClientCall {
  fn: string;
  args: unknown[];
  outcome?: string;
}
interface PromptCapture {
  id: string;
  client: { guidance: { kind: 'returns'; fixture?: string; text?: string } | { kind: 'throws' }; instructions: Record<string, TextEntry> };
  resolved: Encoded;
  configured: Encoded;
  publicationHost: string | null;
  today: string;
  clientCalls: ClientCall[];
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
  aliases: { name: string; expression: 'mcpTools' | 'mcpToolsFor(lockedPortal)'; aliasOf: string; bytesCheck: { captures?: string[] } }[];
  facts: {
    sourceIdForToolName: { tool: string; sourceId: Encoded }[];
    offered: { env: Record<string, string>; withheldToolNames: string[]; offeredSkillSources: string[] }[];
  };
}

const goldens: Goldens = JSON.parse(readFileSync(join(FIXTURES, 'app-goldens.json'), 'utf8'));
const inLoopFixture: { input: { env: Record<string, string>; today: string; publicationHost: string; loaded: string[] }; output: string } = JSON.parse(
  readFileSync(join(FIXTURES, 'in-loop-one-source.json'), 'utf8'),
);

/** The hosted sources' delta, as `router-goldens.test.ts` states it: their
 *  routing lists and bare schemas from their committed captures. */
const HOSTED = ['nyc-charter', 'nyc-checkbook', 'nyc-record', 'nys-legislation'].map((sourceId) => {
  const capture: { tools: { name: string; description: string; inputSchema: unknown }[] } = JSON.parse(
    readFileSync(join(FIXTURES, `${sourceId}-tools.json`), 'utf8'),
  );
  return {
    sourceId,
    toolNames: capture.tools.map((t) => t.name),
    tools: capture.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
  };
});
const HOSTED_NAMES = HOSTED.flatMap((s) => s.toolNames);
const withHostedTools = (output: string): string => JSON.stringify([...(JSON.parse(output) as unknown[]), ...HOSTED.flatMap((s) => s.tools)]);

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

function fetchersFor(capture: PromptCapture) {
  const calls: ClientCall[] = [];
  const textOf = (entry: TextEntry | undefined): string | null => {
    if (entry === null || entry === undefined) return null;
    return 'fixture' in entry ? goldens.fixtureStrings[entry.fixture]! : entry.text;
  };
  const fetchPrompt = async (name: string, args: Record<string, string>): Promise<string> => {
    const call: ClientCall = { fn: 'callMcpPrompt', args: JSON.parse(JSON.stringify([name, args])) };
    calls.push(call);
    if (capture.client.guidance.kind === 'throws') {
      call.outcome = 'threw';
      throw new Error('fixture: the Socrata prompt fetch fails');
    }
    call.outcome = 'returned';
    return textOf(capture.client.guidance as TextEntry) as string;
  };
  const fetchInstructions = async (sourceId: string): Promise<string | null> => {
    const call: ClientCall = { fn: 'getServerInstructions', args: [sourceId] };
    calls.push(call);
    const text = textOf(Object.hasOwn(capture.client.instructions, sourceId) ? capture.client.instructions[sourceId] : null);
    call.outcome = text === null ? 'returned-null' : 'returned';
    return text;
  };
  return { calls, fetchPrompt, fetchInstructions };
}

/** Every in-loop output for fixed inputs, as `router-goldens.test.ts`
 *  computes them: directories, first-step tools, in-loop prompts and harness
 *  definitions. */
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
  const loadedSets = [[], ['socrata'], ['socrata', 'data-commons', 'boston-opencontext', 'nyc-charter'], ['nyc-checkbook', 'nyc-record', 'nys-legislation']];
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

/** Every golden `router` fails to reproduce, by name: the app goldens
 *  (prompts, tools arrays, aliases, facts), the in-loop fixture, and the
 *  in-loop outcomes and harness definitions against `civicRouter`'s. */
async function goldenFailures(router: CivicRouter): Promise<string[]> {
  const failures: string[] = [];
  for (const capture of goldens.prompts) {
    const configured = configuredOf(capture);
    const { portal, lockedPortal } = resolvedOf(capture);
    const { calls, fetchPrompt, fetchInstructions } = fetchersFor(capture);
    const prompt = router.withPortalLockGuidance(
      await router.buildSystemPrompt({ portal, configured, today: capture.today, publicationHost: capture.publicationHost, fetchPrompt, fetchInstructions }),
      lockedPortal,
      configured,
    );
    if (prompt !== capture.output) failures.push(`prompt ${capture.id}`);
    if (JSON.stringify(calls) !== JSON.stringify(capture.clientCalls)) failures.push(`prompt ${capture.id}: fetcher calls`);
  }
  for (const capture of goldens.tools) {
    const offered = router.offeredMcpTools(router.mcpToolsFor(resolvedOf(capture).lockedPortal), configuredOf(capture));
    if (JSON.stringify(offered) !== capture.output) failures.push(`tools ${capture.id}`);
  }
  for (const alias of goldens.aliases) {
    const target = goldens.tools.find((t) => t.id === alias.aliasOf)!;
    const ids = alias.expression === 'mcpTools' ? [undefined] : (alias.bytesCheck.captures ?? []);
    for (const id of ids) {
      const capture = id === undefined ? undefined : goldens.tools.find((t) => t.id === id)!;
      const bytes = JSON.stringify(capture ? router.mcpToolsFor(resolvedOf(capture).lockedPortal) : router.mcpTools);
      if (bytes !== withHostedTools(target.output)) failures.push(`alias ${alias.name}${id ? ` in ${id}` : ''}`);
    }
  }
  const goldenNames = goldens.facts.sourceIdForToolName.slice(0, -1).map((f) => f.tool);
  if (JSON.stringify(router.mcpTools.map((t) => t.function.name)) !== JSON.stringify([...goldenNames, ...HOSTED_NAMES])) failures.push('fact: tool names');
  for (const { tool, sourceId } of goldens.facts.sourceIdForToolName) {
    if (router.sourceIdForToolName(tool) !== decode(sourceId)) failures.push(`fact: source of ${tool}`);
  }
  const seen = new Set(goldenNames);
  for (const source of HOSTED) {
    for (const name of source.toolNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (router.sourceIdForToolName(name) !== source.sourceId) failures.push(`fact: source of ${name}`);
    }
  }
  for (const fact of goldens.facts.offered) {
    const configured = readMcpEnv(fact.env);
    if (JSON.stringify(router.withheldToolNames(configured)) !== JSON.stringify([...fact.withheldToolNames, ...HOSTED_NAMES])) {
      failures.push(`fact: withheld ${JSON.stringify(fact.env)}`);
    }
    if (JSON.stringify(router.offeredSkillSources(configured)) !== JSON.stringify(fact.offeredSkillSources)) failures.push(`fact: offered ${JSON.stringify(fact.env)}`);
  }
  const inLoopPrompt = await router.aliasedInLoopSystemPrompt({
    configured: readMcpEnv(inLoopFixture.input.env),
    today: inLoopFixture.input.today,
    publicationHost: inLoopFixture.input.publicationHost,
    fetchPrompt: async () => 'Fixture Socrata guidance.',
    fetchInstructions: async () => null,
    loaded: inLoopFixture.input.loaded,
  });
  if (inLoopPrompt !== inLoopFixture.output) failures.push('in-loop fixture in-loop-one-source.json');
  const outcomes = (await inLoopOutcomes(router)) as Record<string, unknown[]>;
  const reference = (await inLoopOutcomes(civicRouter)) as Record<string, unknown[]>;
  for (const key of Object.keys(reference)) {
    reference[key]!.forEach((value, i) => {
      if (JSON.stringify(outcomes[key]![i]) !== JSON.stringify(value)) failures.push(`in-loop ${key}[${i}]`);
    });
  }
  return failures;
}

/** A0.2's check: every golden holds over `router`; on a failure, the message
 *  names each mirror difference of its manifest. */
async function assertGoldens(router: CivicRouter): Promise<void> {
  const failures = await goldenFailures(router);
  if (failures.length > 0) {
    throw new assert.AssertionError({
      message: `goldens differ: ${failures.join(', ')}; the manifest differs from CIVIC_MANIFEST at: ${mirrorDifferences(router.manifest).join(', ') || 'nothing'}`,
    });
  }
}

test('A0.2: the goldens are what this test expects (42 prompts, 5 tools arrays, 4 aliases), and civicRouter reproduces them', async () => {
  assert.equal(goldens.prompts.length, 42);
  assert.equal(goldens.tools.length, 5);
  assert.equal(goldens.aliases.length, 4);
  assert.deepEqual(await goldenFailures(civicRouter), []);
});

test('A0.2: createCivicRouter(manifestFromInventory(file, CIVIC_KINDS)) reproduces every golden and the in-loop fixture byte for byte', async () => {
  await assertGoldens(LOADED_ROUTER);
});

test("A0.2: harnessDefinition over the loaded manifest gives civicRouter's hash, for every selection and chooser", () => {
  const configured = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org', NYC_RECORD_HOSTING: 'sandbox' });
  const components = [{ id: '@typedstandards/civic-typed-router', version: '0.6.0' }];
  for (const selection of [undefined, [], ['socrata'], ['nyc-record', 'data-commons']]) {
    for (const chosenBy of ['reader', 'model', 'instance'] as const) {
      const input = { configured, selection, chosenBy, components };
      assert.equal(LOADED_ROUTER.harnessDefinition(input).hash, civicRouter.harnessDefinition(input).hash);
    }
  }
});

test('A0.2 decoy: the file with one description changed by one character fails the goldens, naming the entry and the field', async () => {
  const copy = readInventory();
  const entry = copy.entries[0] as { description: string };
  entry.description = `${entry.description.slice(0, -1)}!`;
  const router = createCivicRouter(manifestFromInventory(copy, CIVIC_KINDS));
  const failures = await goldenFailures(router);
  assert.ok(failures.includes('in-loop fixture in-loop-one-source.json'), `the goldens bite: ${failures.join(', ')}`);
  await assert.rejects(assertGoldens(router), /the manifest differs from CIVIC_MANIFEST at: socrata\.description$/);
});

// --- The loader's refusals -------------------------------------------------------------

test('manifestFromInventory refuses, naming the alias and the field: an unknown kind or serverType, tools that differ from toolsRef, a source a kind has no code for', () => {
  const refused = (change: (entries: Record<string, unknown>[]) => void, pattern: RegExp) => {
    const copy = readInventory();
    change(copy.entries as unknown as Record<string, unknown>[]);
    assert.throws(() => manifestFromInventory(copy, CIVIC_KINDS), (error: unknown) => error instanceof InventoryLoadError && pattern.test(error.message));
  };
  refused((e) => (e[0]!.kind = 'widget'), /: socrata: kind: "widget" is neither/);
  refused((e) => (e[1]!.serverType = 'arcgis'), /: data_commons: serverType: no kind for "arcgis"/);
  refused((e) => ((e[2]!.toolsRef as { sha256: string }).sha256 = '0'.repeat(64)), /: boston: toolsRef\.sha256: is 0{64}; the kind's schemas hash to 5942af35/);
  refused((e) => (e[3]!.toolsRef as { toolNames: string[] }).toolNames.pop(), /: nyc_charter: toolsRef\.toolNames: names /);
  refused((e) => (e[5]!.sourceId = 'nyc-record-2'), /: nyc_record: sourceId: the npm-package kind has no code for "nyc-record-2"/);
  refused((e) => ((e[6]!.hostings as { version: string }[])[0]!.version = '2.5.0'), /: nys_legislation: hostings: the mirror is @betanyc\/nys-openlegislation-mcp@2\.4\.0's tools\/list/);
  refused((e) => (e[0]!.guidanceRef = { kind: 'none' }), /: socrata: guidanceRef\.kind: is "none"; this source's guidance is prompt/);
  refused((e) => ((e[1]!.prompt as Record<string, unknown>).preambleEntry = 'text'), /: data_commons: prompt\.preambleEntry: /);
});

// --- A0.5: the pack kind ----------------------------------------------------------------

const PORTAL = 'data.cityofnewyork.us';
const DATASET = 'dg92-zbpx';

/** A pack over `socrata`, as an inventory entry. */
function packEntry(filter: Record<string, string>, extra: Partial<InventoryPackEntry> = {}): InventoryPackEntry {
  return {
    kind: 'pack',
    id: 'test-pack@example',
    alias: 'city_record',
    sourceId: 'city-record',
    displayName: 'City Record (a test pack)',
    base: 'socrata',
    filter,
    author: 'a test',
    version: '1.0.0',
    place: { country: 'US', level: 'local', names: ['New York City'] },
    categories: ['public-notices'],
    description: 'A test pack: one dataset on one Socrata portal, read through the Socrata server.',
    freshness: 'Live: queries reach the portal when they are made.',
    provenance: { addedOn: '2026-11-06', from: 'hand', by: 'src/inventory.test.ts', sourceUrl: 'src/inventory.test.ts' },
    ...extra,
  };
}

/** The file's seven, then `packs`. */
const withPacks = (...packs: InventoryPackEntry[]): InventoryDocument => {
  const file = readInventory();
  return { ...file, entries: [...file.entries, ...packs] };
};

const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYC_RECORD_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
});

type Parameters = { properties: Record<string, { enum?: string[]; pattern?: string; description?: string }> };
const params = (tool: { function: { parameters?: unknown } }) => tool.function.parameters as Parameters;

test('A0.5: the seven and a pack over socrata (a portal and a dataset fixed) load, and a router built over them passes the startup checks', () => {
  const manifest = manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS);
  assert.equal(manifest.length, 8);
  const router = createCivicRouter(manifest);
  const pack = router.manifest[7]!;
  assert.equal(pack.sourceId, 'city-record');
  assert.equal(pack.base, 'socrata');
  // The seven are unchanged by the pack: the mirror holds over them.
  assert.deepEqual(mirrorDifferences(manifest.slice(0, 7)), []);
  assert.equal(manifest.slice(0, 7).every((entry) => entry.base === undefined), true, 'a server entry carries no base');
});

test("A0.5: the pack's tools are <alias>__get_data and <alias>__fetch, each held to the pack's portal and dataset as the portal lock holds a portal", () => {
  const router = createCivicRouter(manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS));
  const pack = router.manifest[7]!;
  assert.deepEqual(pack.toolNames, ['get_data', 'fetch']);
  assert.deepEqual(
    pack.tools.map((t) => t.function.name),
    ['get_data', 'fetch'],
    'the bare view names them by their upstream names',
  );
  const exposed = router.aliasedMcpTools.filter((t) => t.function.name.startsWith('city_record__'));
  assert.deepEqual(exposed.map((t) => t.function.name), ['city_record__get_data', 'city_record__fetch']);
  const [getData, fetchTool] = exposed as [(typeof exposed)[number], (typeof exposed)[number]];
  // get_data: the lock's rewrite for the pack's portal, and the dataset fixed.
  assert.deepEqual(params(getData).properties.portal!.enum, [PORTAL]);
  assert.deepEqual(params(getData).properties.dataset_id!.enum, [DATASET]);
  assert.match(getData.function.description!, new RegExp(`A call naming any other portal is refused and returns no data\\.`));
  assert.match(getData.function.description!, new RegExp(`A call naming any other dataset is refused and returns no data\\.$`));
  // fetch: an identifier on the pack's portal and dataset only.
  const id = params(fetchTool).properties.id!;
  assert.ok(new RegExp(id.pattern!).test(`dataset:${PORTAL}:${DATASET}`));
  assert.ok(new RegExp(id.pattern!).test(`record:${PORTAL}:${DATASET}:row-1`));
  assert.ok(!new RegExp(id.pattern!).test(`dataset:${PORTAL}:erm2-nwe9`), 'another dataset');
  assert.ok(!new RegExp(id.pattern!).test(`dataset:data.cityofchicago.org:${DATASET}`), 'another portal');
  assert.match(fetchTool.function.description!, /naming any other portal or dataset is refused and returns no data\.$/);
  // The pack's text names its own tools in the aliased view, and no tool it does not have.
  assert.match(fetchTool.function.description!, /use city_record__get_data with type=query/);
  assert.doesNotMatch(JSON.stringify(exposed), /city_record__search|socrata__/);
  // The base's own tools are untouched.
  assert.deepEqual(
    router.aliasedMcpTools.filter((t) => t.function.name.startsWith('socrata__')),
    civicRouter.aliasedMcpTools.filter((t) => t.function.name.startsWith('socrata__')),
  );
});

test('A0.5: the __search rule. A dataset pack exposes no __search on any instance, its own portal configured included; a portal-only pack exposes it only when its portal is the one the server is configured for', () => {
  const names = (kinds: ReturnType<typeof civicKinds>, filter: Record<string, string>) =>
    createCivicRouter(manifestFromInventory(withPacks(packEntry(filter)), kinds))
      .aliasedMcpTools.map((t) => t.function.name)
      .filter((n) => n.startsWith('city_record__'));
  // A dataset filter: never.
  assert.deepEqual(names(CIVIC_KINDS, { portal: PORTAL, dataset_id: DATASET }), ['city_record__get_data', 'city_record__fetch']);
  assert.deepEqual(names(civicKinds({ socrataPortal: PORTAL }), { portal: PORTAL, dataset_id: DATASET }), ['city_record__get_data', 'city_record__fetch']);
  // A portal-only pack over a portal other than the configured one: no.
  assert.deepEqual(names(civicKinds({ socrataPortal: 'data.cityofchicago.org' }), { portal: PORTAL }), ['city_record__get_data', 'city_record__fetch']);
  // Nothing known of the configured portal (CIVIC_KINDS): no.
  assert.deepEqual(names(CIVIC_KINDS, { portal: PORTAL }), ['city_record__get_data', 'city_record__fetch']);
  // Its own portal configured: yes, as the lock rewrites it.
  const router = createCivicRouter(manifestFromInventory(withPacks(packEntry({ portal: PORTAL })), civicKinds({ socrataPortal: PORTAL })));
  const exposed = router.aliasedMcpTools.filter((t) => t.function.name.startsWith('city_record__'));
  assert.deepEqual(exposed.map((t) => t.function.name), ['city_record__get_data', 'city_record__search', 'city_record__fetch']);
  assert.match(exposed[1]!.function.description!, new RegExp(`This instance queries one Socrata portal only, ${PORTAL.replace(/\./g, '\\.')}\\.`));
  assert.match(exposed[2]!.function.description!, /Identifier|identifier/);
  assert.equal(params(exposed[2]!).properties.id!.description, `Identifier returned by the city_record__search tool, e.g. "dataset:${PORTAL}:<dataset-id>"`);
});

test("A0.5: dispatch names the base's server and the pack's id: sourceForAliasedName and resolveCalledName carry base; the pack's hostings and consent default are the base's", () => {
  const router = createCivicRouter(manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS));
  assert.deepEqual(router.sourceForAliasedName('city_record__get_data'), {
    exposedName: 'city_record__get_data',
    sourceId: 'city-record',
    alias: 'city_record',
    upstreamName: 'get_data',
    normalized: false,
    base: 'socrata',
  });
  // Resolved against the offered sources like any entry's name, with its base.
  assert.deepEqual(router.resolveCalledName('city_record__fetch', EVERY_SOURCE), {
    ok: true,
    spelling: 'aliased',
    exposedName: 'city_record__fetch',
    sourceId: 'city-record',
    alias: 'city_record',
    upstreamName: 'fetch',
    base: 'socrata',
  });
  // A server entry's tool carries no base, in this router and in civicRouter.
  assert.equal(Object.hasOwn(router.sourceForAliasedName('socrata__get_data')!, 'base'), false);
  assert.ok([...civicRouter.dispatchMap.values()].every((target) => !Object.hasOwn(target, 'base')), 'no target of CIVIC_MANIFEST carries base');
  const socrataCall = civicRouter.resolveCalledName('socrata__get_data', EVERY_SOURCE);
  assert.ok(socrataCall.ok && !Object.hasOwn(socrataCall, 'base'));
  const pack = router.manifest[7]!;
  const socrata = router.manifest[0]!;
  assert.equal(pack.hostings, socrata.hostings);
  assert.equal(pack.consentDefault, socrata.consentDefault);
  assert.equal(pack.configuration, socrata.configuration);
  // A bare get_data is now ambiguous between the base and the pack.
  const bare = router.resolveCalledName('get_data', EVERY_SOURCE);
  assert.ok(!bare.ok && bare.reason === 'ambiguous');
  // sourceIdForToolName answers by bare name, the first entry that declares it: the base.
  assert.equal(router.sourceIdForToolName('get_data'), 'socrata');
});

test("A0.5 decoy: createCivicRouter over a hand-built manifest refuses a pack whose base names no entry, with the pack's alias", () => {
  const manifest = manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS);
  const orphan = [...manifest.slice(0, 7), { ...manifest[7]!, base: 'no-such-source' }];
  assert.throws(
    () => createCivicRouter(orphan),
    (error: unknown) =>
      error instanceof ToolNameError &&
      error.problems.length === 1 &&
      error.problems[0]!.kind === 'pack-base' &&
      /^Pack "city_record" \(source "city-record"\) names base "no-such-source", which no entry of the manifest is\./.test(error.message),
  );
  // The same pack with its base removed from the manifest.
  assert.throws(() => createCivicRouter(manifest.filter((entry) => entry.sourceId !== 'socrata')), /Pack "city_record" .* names base "socrata", which no entry of the manifest is\./);
});

test("A0.5 decoy: createCivicRouter over a hand-built manifest refuses a pack whose base is a pack, with the pack's alias", () => {
  const manifest = manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS);
  const first = manifest[7]!;
  const second = { ...first, alias: 'second_pack', sourceId: 'second-pack', base: 'city-record', tools: first.tools, toolsFor: undefined };
  assert.throws(
    () => createCivicRouter([...manifest, second]),
    (error: unknown) =>
      error instanceof ToolNameError &&
      error.problems.length === 1 &&
      error.problems[0]!.kind === 'pack-base' &&
      /^Pack "second_pack" \(source "second-pack"\) names base "city-record", which is itself a pack\./.test(error.message),
  );
});

test("A0.5: the pack's guidance is its own text, as text the router does not own; composed into the prompt with the base's", async () => {
  const text = 'Read `get_data` with type "query" for the notices.';
  const router = createCivicRouter(
    manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET }, { guidance: { kind: 'inline', text, blockSha256: sha256Hex(text) } })), CIVIC_KINDS),
  );
  const pack = router.manifest[7]!;
  assert.equal(await pack.guidance.fetchText({ publicationHost: null, fetchPrompt: async () => '', fetchInstructions: async () => null }), text);
  const prompt = await router.aliasedBuildSystemPrompt({
    configured: EVERY_SOURCE,
    today: '2026-11-06',
    publicationHost: null,
    fetchPrompt: async () => 'Fixture Socrata guidance.',
    fetchInstructions: async () => null,
    selection: ['socrata', 'city-record'],
  });
  assert.ok(prompt.includes('Read `city_record__get_data` with type "query" for the notices.'), 'the anchored rewrite names the pack\'s tool');
  assert.ok(prompt.includes('**City Record (a test pack)** — A test pack'), 'a preamble entry composed from its display name and description');
  // A text whose hash is not its blockSha256 is refused.
  assert.throws(
    () => manifestFromInventory(withPacks(packEntry({ portal: PORTAL }, { guidance: { kind: 'inline', text, blockSha256: '0'.repeat(64) } })), CIVIC_KINDS),
    /city_record: guidance\.blockSha256: the text hashes to /,
  );
});

test("A0.5 decoys: a pack whose base names no entry, a pack, or a kind with no pack is refused with the pack's alias; a filter argument a Socrata pack cannot fix is refused", () => {
  const refuses = (doc: InventoryDocument, pattern: RegExp) =>
    assert.throws(() => manifestFromInventory(doc, CIVIC_KINDS), (error: unknown) => error instanceof InventoryLoadError && error.alias === 'city_record' && pattern.test(error.message));
  refuses(withPacks(packEntry({ portal: PORTAL }, { base: 'no-such-source' })), /city_record: base: "no-such-source" names no server entry/);
  refuses(
    withPacks(packEntry({ portal: PORTAL }, { alias: 'other_pack', sourceId: 'other-pack' }), packEntry({ portal: PORTAL }, { base: 'other-pack' })),
    /city_record: base: "other-pack" is a pack/,
  );
  refuses(withPacks(packEntry({ portal: PORTAL }, { base: 'data-commons' })), /city_record: base: the kind of "data-commons" \(mcp-remote\) takes no pack/);
  refuses(withPacks(packEntry({ portal: PORTAL, where: 'x' })), /city_record: filter\.where: a Socrata pack fixes only portal and dataset_id/);
  refuses(withPacks(packEntry({ dataset_id: DATASET })), /city_record: filter\.portal: a Socrata pack fixes its portal/);
  // A toolsRef on a pack holds the tools the loader builds.
  const built = manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS)[7]!;
  const ref = { toolNames: ['get_data', 'fetch'], sha256: toolsSha256(built.tools) };
  assert.equal(manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET }, { toolsRef: ref })), CIVIC_KINDS).length, 8);
  refuses(withPacks(packEntry({ portal: PORTAL }, { toolsRef: ref })), /city_record: toolsRef\.sha256: /);
});

test('A0.5: a pack offered with its base, under the base\'s configuration (a required base: always)', () => {
  const router = createCivicRouter(manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET })), CIVIC_KINDS));
  assert.deepEqual(router.offeredSkillSources(readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' })), ['socrata', 'data-commons', 'city-record']);
  const tool = router.aliasedLoadSourceTool({ configured: EVERY_SOURCE });
  assert.match(JSON.stringify(tool), /"city_record"/);
});

// --- Purity of the loaded manifest's text ------------------------------------------------

test('the loaded manifest holds no entry of CIVIC_MANIFEST itself: every entry is built from the file and the kinds', () => {
  for (const [i, entry] of LOADED.entries()) {
    assert.notEqual(entry, CIVIC_MANIFEST[i] as CivicManifestEntry, `${entry.sourceId} is a new object`);
  }
});
