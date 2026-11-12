// The inventory as data (hub #309, S2-A P0): the hub's
// `inventory/civic-inventory.json` (`civic-inventory/3` since version 3) is
// the source of truth for the seven sources, and `CIVIC_MANIFEST` stays code,
// held equal to it here (G0-5 A). Since version 2 (S2-B, router 0.8.0) City
// Record is a pack over the Socrata server, mirrored in
// `src/civic/nyc-record.ts`.
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
//   S2-B  B2: the mirror holds over City Record's pack, `pack: { version,
//         hash }` included; decoy: the pack's filter moved by one character
//         fails on nyc-record's tools. B9: the loader sets `pack` on a pack
//         and on nothing else. F-E: the loader refuses a pack whose stated
//         hash is not its `packHash`, naming its alias.
//   S2-C  (hub #317, router 0.9.0) A1.5: the pack names its base by the
//         Socrata entry's `id`, and the loaded entry's `base` is still
//         `socrata`; `pack` carries `basePins`; the loader refuses a second
//         `id`, a `base` naming no server's `id`, and a pack with no pins or
//         with pins that leave out a tool it calls. The Socrata kind holds a
//         pack's `api` to its filter. A1.3: `basePins[0]` is the capture's.
//         A1.6: `routesByApi` over the file.
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
  configuredAddresses,
  configuredSources,
  manifestFromInventory,
  NYC_RECORD_ENTRY,
  packHash,
  readMcpEnv,
  sha256Hex,
  ToolNameError,
  toolsSha256,
  type CivicManifest,
  type CivicManifestEntry,
  type CivicRouter,
  type InventoryDocument,
  type InventoryPackEntry,
  type McpListedTool,
  type McpRegistryEnv,
  mcpToolSchemaSha256,
  routesByApi,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(SRC, '__fixtures__');
const REPO = join(SRC, '..', '..', '..');
const INVENTORY_PATH = join(REPO, 'inventory', 'civic-inventory.json');

const readInventory = (): InventoryDocument => JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
const FILE = readInventory();
const LOADED: CivicManifest = manifestFromInventory(FILE, CIVIC_KINDS);
const LOADED_ROUTER = createCivicRouter(LOADED);
/** The Socrata server entry's full id: how a pack names it as its base. */
const SOCRATA_ID = FILE.entries[0]!.id;

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
  'base',
  'pack',
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
    if (entry.base === undefined) {
      // A server's code is the kind's: the same objects.
      for (const part of ['tools', 'toolsFor', 'portalLock'] as const) {
        if (entry[part] !== code[part]) out.push(`${entry.sourceId}.${part}`);
      }
    } else {
      // A pack's code is built per load: the same schemas, in both views.
      if (JSON.stringify(entry.tools) !== JSON.stringify(code.tools)) out.push(`${entry.sourceId}.tools`);
      if (JSON.stringify(entry.toolsFor?.(civicRouter.aliasedView)) !== JSON.stringify(code.toolsFor?.(civicRouter.aliasedView))) out.push(`${entry.sourceId}.toolsFor`);
      if (entry.portalLock !== code.portalLock) out.push(`${entry.sourceId}.portalLock`);
    }
  }
  return out;
}

/** Each pack's guidance text, by source id. */
async function packGuidance(manifest: CivicManifest): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of manifest) {
    if (entry.base !== undefined) out[entry.sourceId] = await entry.guidance.fetchText({ publicationHost: null, fetchPrompt: async () => '', fetchInstructions: async () => null });
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
  // Every entry is a server but City Record, a pack over the Socrata server, named by its id.
  assert.equal(SOCRATA_ID, 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server');
  assert.deepEqual(
    FILE.entries.map((e) => (e.kind === 'pack' ? `${e.sourceId} pack over ${e.base}` : e.kind)),
    ['server', 'server', 'server', 'server', 'server', `nyc-record pack over ${SOCRATA_ID}`, 'server'],
  );
  // The loaded pack's base is the base's sourceId, the dispatch map's key.
  assert.equal(LOADED[5]!.base, 'socrata');
});

test("B2: the pack's guidance, as the loader builds it, is the mirror's text", async () => {
  assert.deepEqual(await packGuidance(LOADED), await packGuidance(CIVIC_MANIFEST));
  assert.deepEqual(Object.keys(await packGuidance(CIVIC_MANIFEST)), ['nyc-record']);
});

test('B9, A1.5: the loader sets pack ({ version, hash, basePins }) on a pack from the file, equal to the mirror, and on no server entry', () => {
  for (const [i, item] of FILE.entries.entries()) {
    const entry = LOADED[i]!;
    if (item.kind === 'pack') {
      assert.deepEqual(entry.pack, { version: item.version, hash: item.hash, basePins: item.basePins }, `${entry.sourceId}: pack is the file's version, hash and pins`);
      assert.deepEqual(CIVIC_MANIFEST[i]!.pack, entry.pack, `${entry.sourceId}: the mirror carries the same`);
      assert.equal(entry.pack!.hash, packHash(item), `${entry.sourceId}: the hash is the pack's packHash`);
    } else {
      assert.equal(Object.hasOwn(entry, 'pack'), false, `${entry.sourceId}: a server entry carries no pack`);
      assert.equal(Object.hasOwn(CIVIC_MANIFEST[i]!, 'pack'), false, `${entry.sourceId}: nor does its mirror`);
    }
  }
  const pack = FILE.entries[5] as InventoryPackEntry;
  assert.deepEqual(NYC_RECORD_ENTRY.pack, { version: '1.1', hash: pack.hash, basePins: pack.basePins });
  assert.equal(NYC_RECORD_ENTRY.pack!.basePins.length, 1);
});

test("B2 decoy: the file with the pack's filter (and its api) moved by one character fails on nyc-record's tools", () => {
  const moved = (keepToolsRef: boolean): InventoryDocument => {
    const copy = readInventory();
    const pack = copy.entries[5] as unknown as Record<string, unknown> & { filter: Record<string, string>; api: Record<string, string> };
    pack.filter.dataset_id = 'dg92-zbpy';
    pack.api.dataset = 'dg92-zbpy';
    if (!keepToolsRef) delete pack.toolsRef;
    // The hash restated, so the loader's hash check passes and the tools are compared.
    pack.hash = packHash(pack as unknown as InventoryPackEntry);
    return copy;
  };
  // With its toolsRef, the loader refuses the tools by name.
  assert.throws(
    () => manifestFromInventory(moved(true), CIVIC_KINDS),
    (error: unknown) => error instanceof InventoryLoadError && error.alias === 'nyc_record' && error.field === 'toolsRef.sha256',
  );
  // Without it, the mirror refuses them.
  const differences = mirrorDifferences(manifestFromInventory(moved(false), CIVIC_KINDS));
  assert.ok(differences.includes('nyc-record.tools'), differences.join(', '));
  assert.ok(differences.includes('nyc-record.pack'), 'the hash moved with the filter');
});

test('F-E decoy: manifestFromInventory refuses a pack whose stated hash is not its packHash, or that states none, naming its alias', () => {
  const refused = (change: (pack: Record<string, unknown>) => void, pattern: RegExp) => {
    const copy = readInventory();
    change(copy.entries[5] as unknown as Record<string, unknown>);
    assert.throws(
      () => manifestFromInventory(copy, CIVIC_KINDS),
      (error: unknown) => error instanceof InventoryLoadError && error.alias === 'nyc_record' && error.field === 'hash' && pattern.test(error.message),
    );
  };
  refused((pack) => (pack.hash = `${(pack.hash as string).slice(0, -1)}${(pack.hash as string).endsWith('0') ? '1' : '0'}`), /^manifestFromInventory: nyc_record: hash: is [0-9a-f]{64}; the pack's hash \(packHash\) is [0-9a-f]{64}$/);
  refused((pack) => (pack.description = `${pack.description as string}!`), /: nyc_record: hash: is /);
  refused((pack) => delete pack.hash, /: nyc_record: hash: is missing/);
  // The provenance and the tools' reference are outside the hash.
  const copy = readInventory();
  (copy.entries[5] as unknown as { provenance: { by: string } }).provenance.by += ' (edited)';
  assert.equal(manifestFromInventory(copy, CIVIC_KINDS).length, 7);
});

/** 0.7.0's switch for City Record, spelled so that no line of this package's
 *  source names it (B3's grep over src/). */
const RETIRED_SWITCH = ['NYC', 'RECORD', 'HOSTING'].join('_');

test("B3: the router keys the City Record pack by the Socrata address and reads no switch for it; it offers the pack with Socrata's address set and unset", () => {
  const u = 'https://socrata-mcp.example.org';
  const set = readMcpEnv({ SOCRATA_MCP_URL: u });
  assert.equal(configuredSources(set)['nyc-record'], u);
  assert.equal(Object.hasOwn(set, 'nycRecordHosting'), false);
  const switched = readMcpEnv({ [RETIRED_SWITCH]: 'sandbox' });
  assert.equal(Object.hasOwn(switched, 'nycRecordHosting'), false, "0.7.0's switch is read no more");
  assert.deepEqual(Object.keys(switched), Object.keys(readMcpEnv({})));
  for (const configured of [set, readMcpEnv({}), switched]) {
    const row = civicRouter.sourcesOffered(configured).find((offered) => offered.sourceId === 'nyc-record');
    assert.deepEqual(row, { sourceId: 'nyc-record', alias: 'nyc_record', reason: 'configured' }, 'offered as Socrata is: required');
    assert.equal(civicRouter.sourcesOffered(configured).find((offered) => offered.sourceId === 'socrata')?.reason, 'configured');
  }
});

test('B3 decoy: with no Socrata address, configuredSources has no nyc-record key, the retired switch set or not', () => {
  assert.equal(Object.hasOwn(configuredSources(readMcpEnv({})), 'nyc-record'), false);
  assert.equal(Object.hasOwn(configuredSources(readMcpEnv({ [RETIRED_SWITCH]: 'sandbox' })), 'nyc-record'), false);
  // A blank address is no address.
  assert.equal(Object.hasOwn(configuredSources(readMcpEnv({ SOCRATA_MCP_URL: '  ' })), 'nyc-record'), false);
});

test("the router keys every pack of CIVIC_MANIFEST by its base's address, and offers it with its base's requirement", () => {
  const u = 'https://socrata-mcp.example.org';
  const packs = CIVIC_MANIFEST.filter((entry) => entry.base !== undefined);
  assert.deepEqual(packs.map((entry) => [entry.sourceId, entry.base]), [['nyc-record', 'socrata']]);
  for (const pack of packs) {
    assert.equal(configuredAddresses(readMcpEnv({ SOCRATA_MCP_URL: u }))[pack.sourceId], u);
    assert.equal(Object.hasOwn(configuredAddresses(readMcpEnv({})), pack.sourceId), false);
    assert.equal(pack.configuration, CIVIC_MANIFEST.find((entry) => entry.sourceId === pack.base)!.configuration);
  }
});

test("A0.3: each entry's tools hash to its toolsRef.sha256 (toolsSha256), with its routing list", () => {
  for (const [i, item] of FILE.entries.entries()) {
    const entry = CIVIC_MANIFEST[i]!;
    assert.equal(toolsSha256(entry.tools), item.toolsRef!.sha256, `${entry.sourceId}: toolsRef.sha256`);
    assert.deepEqual(item.toolsRef!.toolNames, entry.toolNames, `${entry.sourceId}: toolsRef.toolNames`);
  }
});

test("A0.3: the tools' hash is S1's definition: each server entry's toolsRef.sha256 equals benchmark/inventories/7.json's", () => {
  const seven: { entries: { sourceId: string; toolsRef: { sha256: string } }[] } = JSON.parse(
    readFileSync(join(REPO, 'benchmark', 'inventories', '7.json'), 'utf8'),
  );
  for (const item of FILE.entries) {
    const s1 = seven.entries.find((e) => e.sourceId === item.sourceId);
    // City Record's 7.json entry is router 0.6.0's server (the benchmark's
    // frozen copy); the pack's tools are the Socrata kind's, hashed the same way.
    if (item.kind === 'pack') assert.notEqual(item.toolsRef!.sha256, s1?.toolsRef.sha256, `${item.sourceId}: the pack's tools are not the old server's`);
    else assert.equal(item.toolsRef!.sha256, s1?.toolsRef.sha256, `${item.sourceId}: the same hash as S1's 7.json`);
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

/** The four later entries' delta, as `router-goldens.test.ts` states it: the
 *  hosted sources' routing lists and bare schemas from their committed
 *  captures, and the pack's (City Record, offered in every configuration). */
const PACK_ID = 'nyc-record';
const HOSTED = ['nyc-charter', 'nyc-checkbook', PACK_ID, 'nys-legislation'].map((sourceId) => {
  if (sourceId === PACK_ID) return { sourceId, toolNames: [...NYC_RECORD_ENTRY.toolNames], tools: NYC_RECORD_ENTRY.tools as unknown[] };
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
/** The withheld names: the hosted sources', not the pack's. */
const WITHHELD_HOSTED_NAMES = HOSTED.filter((s) => s.sourceId !== PACK_ID).flatMap((s) => s.toolNames);
const withHostedTools = (output: string): string => JSON.stringify([...(JSON.parse(output) as unknown[]), ...HOSTED.flatMap((s) => s.tools)]);
/** The sources `configured` offers, the pack left out: the selection the
 *  goldens hold under. */
const lessPack = (router: CivicRouter, configured: McpRegistryEnv): string[] =>
  router.offeredSkillSources(configured).filter((id) => id !== PACK_ID);

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
    const selection = lessPack(router, configured);
    const prompt = router.withPortalLockGuidance(
      await router.buildSystemPrompt({ portal, configured, today: capture.today, publicationHost: capture.publicationHost, fetchPrompt, fetchInstructions, selection }),
      lockedPortal,
      configured,
      selection,
    );
    if (prompt !== capture.output) failures.push(`prompt ${capture.id}`);
    if (JSON.stringify(calls) !== JSON.stringify(capture.clientCalls)) failures.push(`prompt ${capture.id}: fetcher calls`);
  }
  for (const capture of goldens.tools) {
    const configured = configuredOf(capture);
    const offered = router.offeredMcpTools(router.mcpToolsFor(resolvedOf(capture).lockedPortal), configured, lessPack(router, configured));
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
    if (JSON.stringify(router.withheldToolNames(configured)) !== JSON.stringify([...fact.withheldToolNames, ...WITHHELD_HOSTED_NAMES])) {
      failures.push(`fact: withheld ${JSON.stringify(fact.env)}`);
    }
    if (JSON.stringify(router.offeredSkillSources(configured)) !== JSON.stringify([...fact.offeredSkillSources, PACK_ID])) failures.push(`fact: offered ${JSON.stringify(fact.env)}`);
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
  const configured = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });
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
  refused((e) => (e[4]!.sourceId = 'nyc-checkbook-2'), /: nyc_checkbook: sourceId: the npm-package kind has no code for "nyc-checkbook-2"/);
  refused((e) => ((e[6]!.hostings as { version: string }[])[0]!.version = '2.5.0'), /: nys_legislation: hostings: the mirror is @betanyc\/nys-openlegislation-mcp@2\.4\.0's tools\/list/);
  refused((e) => (e[0]!.guidanceRef = { kind: 'none' }), /: socrata: guidanceRef\.kind: is "none"; this source's guidance is prompt/);
  refused((e) => ((e[1]!.prompt as Record<string, unknown>).preambleEntry = 'text'), /: data_commons: prompt\.preambleEntry: /);
});

// --- A0.5: the pack kind ----------------------------------------------------------------

const PORTAL = 'data.cityofnewyork.us';
const DATASET = 'dg92-zbpx';

/** A pin naming `get_data` and `fetch`, and `search` for a portal-only
 *  filter (offered on an instance configured for that portal). The values
 *  are placeholders: the loader holds a pin's form, never a live server. */
const pinsFor = (filter: Record<string, string>) => [
  {
    serverName: 'socrata-mcp-server',
    serverVersion: '0.9.2',
    tools: { get_data: 'a'.repeat(64), fetch: 'b'.repeat(64), ...(filter.dataset_id === undefined ? { search: 'c'.repeat(64) } : {}) },
  },
];

/** A pack over the Socrata server, as an inventory entry, its hash its packHash. */
function packEntry(filter: Record<string, string>, extra: Partial<InventoryPackEntry> = {}): InventoryPackEntry {
  const entry: InventoryPackEntry = {
    kind: 'pack',
    id: 'test-pack@example',
    alias: 'city_record',
    sourceId: 'city-record',
    displayName: 'City Record (a test pack)',
    base: SOCRATA_ID,
    basePins: pinsFor(filter),
    filter,
    api: { platform: 'socrata', ...(filter.portal !== undefined ? { host: filter.portal } : {}), ...(filter.dataset_id !== undefined ? { dataset: filter.dataset_id } : {}) },
    author: 'a test',
    version: '1.0.0',
    place: { country: 'US', level: 'local', names: ['New York City'] },
    categories: ['public-notices'],
    description: 'A test pack: one dataset on one Socrata portal, read through the Socrata server.',
    freshness: 'Live: queries reach the portal when they are made.',
    provenance: { addedOn: '2026-11-06', from: 'hand', by: 'src/inventory.test.ts', sourceUrl: 'src/inventory.test.ts' },
    ...extra,
  };
  return { ...entry, hash: packHash(entry) };
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
  assert.deepEqual(
    manifest.flatMap((entry) => (entry.base === undefined ? [] : [entry.sourceId])),
    ['nyc-record', 'city-record'],
    'a server entry carries no base; each pack does',
  );
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
  // A server entry's tool carries no base, in this router and in civicRouter;
  // in CIVIC_MANIFEST only City Record's, a pack's, do.
  assert.equal(Object.hasOwn(router.sourceForAliasedName('socrata__get_data')!, 'base'), false);
  assert.deepEqual(
    [...civicRouter.dispatchMap.values()].filter((target) => Object.hasOwn(target, 'base')).map((target) => `${target.exposedName} -> ${target.base}`),
    ['nyc_record__get_data -> socrata', 'nyc_record__fetch -> socrata'],
    "only the pack's targets carry base",
  );
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
  refuses(withPacks(packEntry({ portal: PORTAL }, { base: 'no-such-source' })), /city_record: base: "no-such-source" names no server entry's id$/);
  refuses(
    withPacks(packEntry({ portal: PORTAL }, { alias: 'other_pack', sourceId: 'other-pack', id: 'other-pack@example' }), packEntry({ portal: PORTAL }, { base: 'other-pack@example' })),
    /city_record: base: "other-pack@example" is a pack/,
  );
  const dataCommonsId = FILE.entries[1]!.id;
  refuses(withPacks(packEntry({ portal: PORTAL }, { base: dataCommonsId })), /city_record: base: the kind of ".+" \(mcp-remote\) takes no pack/);
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
  assert.deepEqual(router.offeredSkillSources(readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' })), ['socrata', 'data-commons', 'nyc-record', 'city-record']);
  const tool = router.aliasedLoadSourceTool({ configured: EVERY_SOURCE });
  assert.match(JSON.stringify(tool), /"city_record"/);
});

// --- Purity of the loaded manifest's text ------------------------------------------------

test('the loaded manifest holds no entry of CIVIC_MANIFEST itself: every entry is built from the file and the kinds', () => {
  for (const [i, entry] of LOADED.entries()) {
    assert.notEqual(entry, CIVIC_MANIFEST[i] as CivicManifestEntry, `${entry.sourceId} is a new object`);
  }
});

// --- S2-C (hub #317): the route-identity conventions --------------------------------

test("A1.5: the pack's base is the Socrata entry's id in the file and the mirror; its manifest base is socrata; its two names are S2-B's owed words", () => {
  const pack = FILE.entries[5] as InventoryPackEntry;
  assert.equal(pack.base, SOCRATA_ID);
  assert.equal(NYC_RECORD_ENTRY.base, 'socrata');
  assert.equal(pack.displayName, 'NYC City Record');
  assert.equal((pack.prompt as { lockMention: string }).lockMention, 'City Record for New York City notices');
  assert.equal(NYC_RECORD_ENTRY.displayName, 'NYC City Record');
  assert.equal(NYC_RECORD_ENTRY.prompt?.lockMention, 'City Record for New York City notices');
  // The pack's version under ADR-0039's form, and derivedFrom holding version 2's provenance pin.
  assert.equal(pack.version, '1.1');
  assert.deepEqual(pack.derivedFrom, [
    {
      id: '@betanyc/nyc-record-mcp@https://github.com/BetaNYC/nyc-record-mcp',
      version: '1.1.0',
      commit: '6c52a5353381592713678caa109870d1e912c858',
      file: 'dist/city-record.js',
      fileSha256: '622edb9fb6263b9a3ad40a20415f4b409d652c2531bf4dbbf7cfac619e2b0512',
      sourceUrl: 'https://www.npmjs.com/package/@betanyc/nyc-record-mcp/v/1.1.0',
    },
  ]);
  assert.deepEqual(Object.keys(pack.provenance as object), ['addedOn', 'from', 'by', 'sourceUrl']);
});

test("A1.3: basePins[0] is the capture's serverInfo and the hashes of its get_data and fetch; the Socrata entry's toolsRef.fixture names the capture", () => {
  const capture: { initialize: { serverInfo: { name: string; version: string } }; tools: McpListedTool[] } = JSON.parse(readFileSync(join(FIXTURES, 'socrata-tools.json'), 'utf8'));
  const tool = (name: string) => capture.tools.find((t) => t.name === name)!;
  const pack = FILE.entries[5] as InventoryPackEntry;
  assert.deepEqual(pack.basePins, [
    {
      serverName: capture.initialize.serverInfo.name,
      serverVersion: capture.initialize.serverInfo.version,
      tools: { get_data: mcpToolSchemaSha256(tool('get_data')), fetch: mcpToolSchemaSha256(tool('fetch')) },
    },
  ]);
  assert.equal(FILE.entries[0]!.toolsRef!.fixture, 'packages/civic-typed-router/src/__fixtures__/socrata-tools.json');
});

test('A1.6: routesByApi over the file groups socrata with nyc-record and leaves the rest alone; no router code calls it', () => {
  assert.deepEqual(routesByApi(FILE), [{ api: { platform: 'socrata' }, sourceIds: ['socrata', 'nyc-record'] }]);
});

test('A1.5: manifestFromInventory refuses a second id, naming the entry and the first holder', () => {
  const copy = readInventory();
  (copy.entries[4] as { id: string }).id = copy.entries[2]!.id;
  assert.throws(
    () => manifestFromInventory(copy, CIVIC_KINDS),
    (error: unknown) =>
      error instanceof InventoryLoadError &&
      error.alias === 'nyc_checkbook' &&
      error.field === 'id' &&
      error.message === `manifestFromInventory: nyc_checkbook: id: "${copy.entries[2]!.id}" is also boston's id; an id is unique in the file`,
  );
  // A pack's id counts too.
  assert.throws(() => manifestFromInventory(withPacks(packEntry({ portal: PORTAL, dataset_id: DATASET }, { id: FILE.entries[5]!.id, alias: 'other', sourceId: 'other' })), CIVIC_KINDS), /: other: id: .* is also nyc_record's id/);
});

/** The file with the pack changed by `change`, its hash restated. */
const packChanged = (change: (pack: Record<string, unknown>) => void): InventoryDocument => {
  const copy = readInventory();
  const pack = copy.entries[5] as unknown as Record<string, unknown>;
  change(pack);
  pack.hash = packHash(pack as unknown as InventoryPackEntry);
  return copy;
};
const refusedPack = (doc: InventoryDocument, field: string, pattern: RegExp) =>
  assert.throws(
    () => manifestFromInventory(doc, CIVIC_KINDS),
    (error: unknown) => error instanceof InventoryLoadError && error.alias === 'nyc_record' && error.field === field && pattern.test(error.message),
    `${field}: ${pattern}`,
  );

test("A1.5: manifestFromInventory refuses a base naming no server's id, by name; a base by sourceId names the id to use", () => {
  refusedPack(packChanged((p) => (p.base = 'socrata')), 'base', /: "socrata" is a sourceId; a pack names its base by the server entry's id \("socrata-mcp-server@https:\/\/github\.com\/npstorey\/socrata-mcp-server"\)$/);
  refusedPack(packChanged((p) => (p.base = 'socrata-mcp-server@https://github.com/someone-else/socrata-mcp-server')), 'base', /names no server entry's id$/);
});

test('A1.5: manifestFromInventory refuses a pack with no basePins, a malformed pin, a pin that leaves out a tool the pack calls, and one naming a tool the base lacks', () => {
  refusedPack(packChanged((p) => delete p.basePins), 'basePins', /is missing or empty/);
  refusedPack(packChanged((p) => (p.basePins = [])), 'basePins', /is missing or empty/);
  const pin = () => structuredClone((FILE.entries[5] as InventoryPackEntry).basePins![0]!) as unknown as Record<string, unknown> & { tools: Record<string, string> };
  refusedPack(packChanged((p) => (p.basePins = [{ ...pin(), serverVersion: '' }])), 'basePins[0].serverVersion', /not a non-empty string/);
  refusedPack(packChanged((p) => (p.basePins = [{ ...pin(), capture: 'x.json' }])), 'basePins[0].capture', /serverName, serverVersion and tools only/);
  refusedPack(packChanged((p) => (p.basePins = [{ ...pin(), tools: { ...pin().tools, fetch: 'F'.repeat(64) } }])), 'basePins[0].tools.fetch', /64 lowercase hex/);
  const noFetch = pin();
  delete noFetch.tools.fetch;
  refusedPack(packChanged((p) => (p.basePins = [noFetch])), 'basePins[0].tools', /the pack calls "fetch", which no member pins$/);
  refusedPack(packChanged((p) => (p.basePins = [pin(), { ...pin(), tools: { ...pin().tools, query: 'd'.repeat(64) } }])), 'basePins[1].tools.query', /is not a tool of the base/);
  // A pin may also name search, a base tool this dataset pack does not call; two pins load.
  const both = packChanged((p) => (p.basePins = [pin(), { ...pin(), serverVersion: '0.9.3', tools: { ...pin().tools, search: 'e'.repeat(64) } }]));
  assert.equal(manifestFromInventory(both, CIVIC_KINDS)[5]!.pack!.basePins.length, 2);
});

test("A1.5: the Socrata kind holds a pack's api to its filter: platform socrata, host its portal, dataset its dataset_id", () => {
  refusedPack(packChanged((p) => ((p.api as Record<string, string>).host = 'data.cityofchicago.org')), 'api.host', /is "data\.cityofchicago\.org"; a Socrata pack's host is its filter\.portal, "data\.cityofnewyork\.us"$/);
  refusedPack(packChanged((p) => ((p.api as Record<string, string>).dataset = 'erm2-nwe9')), 'api.dataset', /its filter\.dataset_id, "dg92-zbpx"$/);
  refusedPack(packChanged((p) => delete (p.api as Record<string, string>).dataset), 'api.dataset', /is absent; a Socrata pack's dataset is its filter\.dataset_id, "dg92-zbpx"$/);
  refusedPack(packChanged((p) => ((p.api as Record<string, string>).platform = 'ckan')), 'api.platform', /is "ckan"/);
  refusedPack(packChanged((p) => delete p.api), 'api', /is missing/);
  // A portal-only pack states no dataset.
  assert.equal(manifestFromInventory(withPacks(packEntry({ portal: PORTAL })), CIVIC_KINDS).length, 8);
  assert.throws(() => manifestFromInventory(withPacks(packEntry({ portal: PORTAL }, { api: { platform: 'socrata', host: PORTAL, dataset: DATASET } })), CIVIC_KINDS), /city_record: api\.dataset: is "dg92-zbpx"; the filter fixes no dataset_id/);
});

test("A1.7 (G0-C1 = A): the Data Commons entry's id is the endpoint form in the file and the mirror, and its freshnessSource no longer names agent-toolkit's server", () => {
  const item = FILE.entries.find((e) => e.sourceId === 'data-commons')!;
  const mirror = CIVIC_MANIFEST.find((e) => e.sourceId === 'data-commons')!;
  assert.equal(item.id, 'Data Commons MCP Server@https://api.datacommons.org/mcp');
  assert.equal(mirror.id, item.id);
  assert.equal(mirror.freshnessSource, item.freshnessSource);
  assert.doesNotMatch(item.freshnessSource!, /agent-toolkit/);
  assert.match(item.freshnessSource!, /datacommonsorg\/mixer/);
  assert.deepEqual(item.api, { platform: 'data-commons', host: 'api.datacommons.org' });
  // A space in an id is carried as it is: the loaded router accepts it and offers the source by its alias.
  assert.equal(LOADED_ROUTER.manifest[1]!.id, item.id);
  assert.equal(LOADED_ROUTER.sourceForAliasedName('data_commons__get_observations')?.sourceId, 'data-commons');
});
