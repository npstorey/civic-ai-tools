// The hosted CKAN server (CKAN-1 P2, hub issue 314; since router 0.12.0,
// CKAN-2 P2, hub issue 329: it offers seven of its own tools, and the Boston
// pack over it is retired). The criteria R1 to R6 are `src/ckan-server.test.ts`;
// this file holds the capture, the schemas and the offer path.
//
//   AP   The capture (`__fixtures__/ckan-tools.json`): the server's 20 tool
//        names are its; the script's saved-session mode writes it byte for
//        byte; the entry's `toolsRef` names the seven and their hash.
//   AS   The seven schemas: each the capture's, with the server's whole
//        description and `server_url` open; `sql` alone gains the statement
//        rule; no text names a server tool the entry does not offer; a
//        committed golden, bare and aliased.
//   AO   The offer path: `CKAN_MCP_URL`, `ckanUrl`, the entry keyed by its
//        address; a one-portal lock to a Socrata portal leaves it in every
//        offer output; the ckan kind takes no pack.
//   Q2   A pack's base with no tools (the 0.11.0 shape) is still left out of
//        every list the model reads.
//
// The file and the capture are read here, by the test; the router reads
// neither.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CIVIC_KINDS,
  CIVIC_MANIFEST,
  civicRouter,
  CKAN_ADDRESS_VARIABLE,
  CKAN_SERVER_ENTRY,
  CKAN_SERVER_TOOL_NAMES,
  CKAN_SERVER_WORDS,
  CKAN_TOOL_NAMES,
  CKAN_TOOLS,
  configuredSources,
  createCivicRouter,
  InventoryLoadError,
  manifestFromInventory,
  packHash,
  readMcpEnv,
  toolsSha256,
  type CivicManifestEntry,
  type CivicRouter,
  type InventoryDocument,
  type InventoryPackEntry,
  type McpListedTool,
  type McpRegistryEnv,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(SRC, '__fixtures__');
const REPO = join(SRC, '..', '..', '..');
const CAPTURE_PATH = join(FIXTURES, 'ckan-tools.json');
const SCRIPT_PATH = join(FIXTURES, 'pin-ckan-tools.mjs');
const GOLDEN_PATH = join(FIXTURES, 'ckan-server-tools.json');

interface Capture {
  _meta: { repository: string; commit: string; packageVersion: string; script: { path: string; sha256: string }; captureDate: string; node: string; resolved: Record<string, string> };
  initialize: { protocolVersion: string; serverInfo: { name: string; version: string }; capabilities: unknown; instructions: string | null };
  tools: McpListedTool[];
}

/** A committed file, parsed; `undefined` while it is not committed, so each
 *  test that needs it fails at its own assertion. */
const readIfCommitted = <T>(path: string): T | undefined => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : undefined);
const CAPTURE = readIfCommitted<Capture>(CAPTURE_PATH);
const capture = (): Capture => {
  assert.ok(CAPTURE, 'the capture src/__fixtures__/ckan-tools.json is committed');
  return CAPTURE;
};
const captured = (name: string): McpListedTool => {
  const tool = capture().tools.find((t) => t.name === name);
  assert.ok(tool, `the capture lists ${name}`);
  return tool;
};

const readInventory = (): InventoryDocument => JSON.parse(readFileSync(join(REPO, 'inventory', 'civic-inventory.json'), 'utf8'));
const FILE = readInventory();
const fileEntry = (file: InventoryDocument, sourceId: string) => {
  const entry = file.entries.find((e) => e.sourceId === sourceId);
  assert.ok(entry, `the inventory holds ${sourceId}`);
  return entry;
};

/** The hosted CKAN server's id (ADR-0039 §B; Q4). */
const SERVER_ID = '@aborruso/ckan-mcp-server@https://github.com/npstorey/ckan-mcp-server';
/** The seven tools the server offers (D2 = B), in routing order. */
const SEVEN = [
  'ckan_package_search',
  'ckan_find_relevant_datasets',
  'ckan_package_show',
  'ckan_list_resources',
  'ckan_datastore_search',
  'ckan_datastore_search_sql',
  'ckan_status_show',
];

const SOCRATA = 'https://socrata-mcp.example.org';
const CKAN = 'https://ckan-mcp.example.org/mcp';
const ON = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: CKAN });
const OFF = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA });
const TODAY = '2026-11-18';
const fetchers = { publicationHost: null, fetchPrompt: async () => 'Fixture Socrata guidance.', fetchInstructions: async () => null };

/** The server's seven tools in the aliased view. */
const aliasedSeven = (router: CivicRouter = civicRouter) =>
  router.aliasedMcpTools.filter((t) => router.sourceForAliasedName(t.function.name)?.sourceId === 'ckan-server');

// --- AP: the capture -----------------------------------------------------------------------

test('AP: the capture is the hosted CKAN server at the pinned commit: its serverInfo, no instructions, and 20 tools, whose names are CKAN_SERVER_TOOL_NAMES in its order', () => {
  const c = capture();
  assert.equal(c._meta.repository, 'https://github.com/npstorey/ckan-mcp-server');
  assert.equal(c._meta.commit, '7b0ac8a1a4aaa550786a2ff96b326307345a7a89');
  assert.deepEqual(c.initialize.serverInfo, { name: 'ckan-mcp-server', version: '0.4.139' });
  assert.equal(c.initialize.instructions, null, 'no instructions: the server entry\'s guidance is none');
  assert.equal(c.tools.length, 20);
  assert.deepEqual([...CKAN_SERVER_TOOL_NAMES], c.tools.map((t) => t.name));
  for (const name of SEVEN) assert.ok(CKAN_SERVER_TOOL_NAMES.includes(name), `${name} is a tool of the server`);
  // The fixture names the script that wrote it, by its bytes.
  assert.equal(c._meta.script.path, 'packages/civic-typed-router/src/__fixtures__/pin-ckan-tools.mjs');
  assert.equal(c._meta.script.sha256, createHash('sha256').update(readFileSync(SCRIPT_PATH)).digest('hex'), 'the fixture is the current script\'s output');
});

test("AP: the script's saved-session mode, over a session holding the capture's own answers, writes the capture byte for byte", () => {
  const c = capture();
  const dir = mkdtempSync(join(tmpdir(), 'ckan-session-'));
  try {
    const session = join(dir, 'session');
    const out = join(dir, 'ckan-tools.json');
    mkdirSync(session);
    const { requestedProtocolVersion: asked, ...initialize } = c.initialize as Capture['initialize'] & { requestedProtocolVersion: string };
    const result = { ...initialize, ...(initialize.instructions === null ? { instructions: undefined } : {}) };
    writeFileSync(join(session, `stdio-${asked}.initialize.json`), JSON.stringify({ result, jsonrpc: '2.0', id: 1 }));
    writeFileSync(join(session, `stdio-${asked}.tools-list.1.json`), JSON.stringify({ result: { tools: c.tools }, jsonrpc: '2.0', id: 2 }));
    writeFileSync(
      join(session, `stdio-${asked}.requests.jsonl`),
      [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: asked, capabilities: {}, clientInfo: { name: 'a-test', version: '1' } } },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      ]
        .map((m) => JSON.stringify(m))
        .join('\n'),
    );
    const run = spawnSync(
      process.execPath,
      [SCRIPT_PATH, '--from-session', session, '--node', c._meta.node, '--sdk', c._meta.resolved['@modelcontextprotocol/sdk']!, '--package-version', c._meta.packageVersion, '--capture-date', c._meta.captureDate, '--out', out],
      { encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.ok(readFileSync(out).equals(readFileSync(CAPTURE_PATH)), 'the saved-session mode writes the capture byte for byte');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AP: the server entry's toolsRef names the seven, in routing order, with the hash of the entry's schemas, and its fixture is the capture; the mirror's toolNames are the same", () => {
  const server = fileEntry(FILE, 'ckan-server');
  assert.equal(server.kind, 'server');
  assert.equal(server.id, SERVER_ID);
  assert.deepEqual(server.toolsRef, {
    toolNames: SEVEN,
    sha256: toolsSha256(CKAN_SERVER_ENTRY.tools),
    fixture: 'packages/civic-typed-router/src/__fixtures__/ckan-tools.json',
  });
  assert.deepEqual([...CKAN_TOOL_NAMES], SEVEN);
  assert.deepEqual(CKAN_SERVER_ENTRY.toolNames, SEVEN);
  assert.equal(CKAN_SERVER_ENTRY.id, SERVER_ID);
  // The fork's pin moved past the captured commit by two commits that change no file under src/ (G0, row 12).
  assert.equal(capture()._meta.commit, '7b0ac8a1a4aaa550786a2ff96b326307345a7a89');
});

// --- AS: the seven schemas ----------------------------------------------------------------

const STATEMENT_RULE =
  'One statement only: it begins, after any whitespace and SQL comments, with SELECT or WITH, and no second statement follows a semicolon outside a quoted literal. Any other statement is refused before it is sent.';

test("AS: each of the seven is the capture's: its description the server's whole text, its arguments the tool's inputSchema with server_url required and open; ckan_datastore_search_sql's sql alone adds the statement rule", () => {
  assert.deepEqual(CKAN_TOOLS.map((t) => t.function.name), SEVEN);
  for (const tool of CKAN_TOOLS) {
    const name = tool.function.name;
    const listed = captured(name);
    assert.equal(tool.type, 'function');
    assert.deepEqual(Object.keys(tool.function), ['name', 'description', 'parameters'], `${name}: name, description, parameters`);
    assert.equal(tool.function.description, listed.description, `${name}: the server's whole description`);
    const expected = structuredClone(listed.inputSchema) as { properties: Record<string, { description?: string }> };
    if (name === 'ckan_datastore_search_sql') expected.properties.sql!.description = `${expected.properties.sql!.description}. ${STATEMENT_RULE}`;
    assert.deepEqual(tool.function.parameters, expected, `${name}: the capture's inputSchema${name === 'ckan_datastore_search_sql' ? ', sql with the rule' : ''}`);
    const parameters = tool.function.parameters as { required: string[]; properties: { server_url: Record<string, unknown> } };
    assert.ok(parameters.required.includes('server_url'), `${name}: server_url required`);
    assert.deepEqual(Object.keys(parameters.properties.server_url).sort(), ['description', 'format', 'type'], `${name}: server_url open`);
  }
  assert.equal(CKAN_SERVER_ENTRY.tools, CKAN_TOOLS);
  // Text the router does not own: no toolsFor, so the aliased view renames and rewrites.
  assert.equal(CKAN_SERVER_ENTRY.toolsFor, undefined);
});

/** Every text of a tool the model reads: its description and every
 *  argument's description, by where it sits. */
function toolTexts(tool: { function: { description?: string; parameters?: unknown } }): [string, string][] {
  const out: [string, string][] = [['description', tool.function.description ?? '']];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (value !== null && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if (key === 'description' && typeof inner === 'string') out.push([`${path}.description`, inner]);
        else walk(inner, `${path}.${key}`);
      }
    }
  };
  walk(tool.function.parameters, 'parameters');
  return out;
}

test('AS: no text of the seven, bare or aliased, nor the guidance, names one of the 13 server tools the entry does not offer', async () => {
  const others = capture().tools.map((t) => t.name).filter((name) => !SEVEN.includes(name));
  assert.equal(others.length, 13);
  assert.deepEqual(others, CKAN_SERVER_TOOL_NAMES.filter((name) => !SEVEN.includes(name)));
  const named = new RegExp(`(?<![A-Za-z0-9_])(${others.join('|')})(?![A-Za-z0-9_])`);
  const tools = [...CKAN_SERVER_ENTRY.tools, ...aliasedSeven()];
  assert.equal(tools.length, 14, 'the seven, bare and aliased');
  for (const tool of tools) {
    for (const [where, text] of toolTexts(tool)) {
      const found = named.exec(text)?.[1];
      assert.equal(found, undefined, `${tool.function.name} ${where} names ${found}, a server tool the entry does not offer`);
    }
  }
  const guidance = await CKAN_SERVER_ENTRY.guidance.fetchText({ portal: undefined, publicationHost: null, fetchPrompt: fetchers.fetchPrompt, fetchInstructions: fetchers.fetchInstructions });
  assert.equal(named.exec(guidance)?.[1], undefined, 'the guidance');
});

test('AS: the seven, bare and aliased, are the committed golden byte for byte', () => {
  const golden = readIfCommitted<{ bare: unknown; aliased: unknown }>(GOLDEN_PATH);
  assert.ok(golden, 'the golden src/__fixtures__/ckan-server-tools.json is committed');
  assert.equal(JSON.stringify(CKAN_SERVER_ENTRY.tools), JSON.stringify(golden.bare));
  assert.equal(JSON.stringify(aliasedSeven()), JSON.stringify(golden.aliased));
});

test("the entry's identity and data: id, alias ckan, last in the manifest, serverType ckan, api any CKAN portal, guidance embedded, its prompt strings, its words the module's; Boston OpenContext keeps boston_opencontext and no entry holds boston", () => {
  const server = fileEntry(FILE, 'ckan-server') as Record<string, unknown>;
  assert.deepEqual(FILE.entries.at(-1)?.sourceId, 'ckan-server');
  assert.deepEqual(CIVIC_MANIFEST.at(-1)?.sourceId, 'ckan-server');
  assert.deepEqual([server.alias, server.serverType, server.api, server.guidanceRef], ['ckan', 'ckan', { platform: 'ckan' }, { kind: 'embedded' }]);
  assert.deepEqual(server.prompt, { citation: CKAN_SERVER_WORDS.citation, lockMention: CKAN_SERVER_WORDS.lockMention });
  assert.deepEqual(CKAN_SERVER_ENTRY.prompt, { citation: CKAN_SERVER_WORDS.citation, lockMention: CKAN_SERVER_WORDS.lockMention });
  assert.equal(server.publisher, CKAN_SERVER_WORDS.publisher);
  assert.equal(server.displayName, CKAN_SERVER_WORDS.displayName);
  assert.equal(fileEntry(FILE, 'boston-opencontext').alias, 'boston_opencontext', 'D7 = A');
  assert.equal(FILE.entries.some((e) => e.alias === 'boston'), false, 'boston is unassigned');
  assert.equal(CIVIC_MANIFEST.some((e) => e.alias === 'boston'), false, 'boston is unassigned');
});

// --- AO: the offer path ---------------------------------------------------------------

test('AO: CKAN_MCP_URL set, the server is keyed by its address, offered, and its seven offered; unset or blank, no key, not offered, the seven withheld', () => {
  assert.equal(CKAN_ADDRESS_VARIABLE, 'CKAN_MCP_URL');
  assert.equal(ON.ckanUrl, CKAN);
  assert.equal(configuredSources(ON)['ckan-server'], CKAN);
  assert.equal(Object.hasOwn(configuredSources(ON), 'boston-ckan'), false, 'the retired pack has no key');
  assert.equal(civicRouter.isSourceOffered(ON, 'ckan-server'), true);
  const offered = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(undefined), ON).map((t) => t.function.name);
  for (const name of SEVEN) assert.ok(offered.includes(`ckan__${name}`), `ckan__${name} offered`);
  for (const configured of [OFF, readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: '  ' })]) {
    assert.equal(Object.hasOwn(configured, 'ckanUrl'), false, 'no ckanUrl key');
    assert.equal(Object.hasOwn(configuredSources(configured), 'ckan-server'), false, 'no key');
    assert.equal(civicRouter.isSourceOffered(configured, 'ckan-server'), false, 'not offered');
    assert.deepEqual(
      civicRouter.aliasedWithheldToolNames(configured).filter((name) => name.startsWith('ckan__')),
      SEVEN.map((name) => `ckan__${name}`),
      'the seven withheld',
    );
  }
});

/** The server in each offer output pack-lock.test.ts's A6 lists, for
 *  `configured` and the lock text's `lockPortal`. */
async function serverEverywhere(router: CivicRouter, configured: McpRegistryEnv, lockPortal: string): Promise<string[]> {
  const missing: string[] = [];
  const has = (name: string, ok: boolean) => {
    if (!ok) missing.push(name);
  };
  const own = new Set<unknown>(router.manifest.find((e) => e.sourceId === 'ckan-server')?.tools ?? []);
  const input = { configured, today: TODAY, portal: lockPortal, ...fetchers };
  has('sourcesOffered', router.sourcesOffered(configured).find((s) => s.sourceId === 'ckan-server')?.reason === 'configured');
  has('offeredSkillSources', router.offeredSkillSources(configured).includes('ckan-server'));
  has('withheldToolNames', !SEVEN.some((name) => router.withheldToolNames(configured).includes(name)));
  has('aliasedWithheldToolNames', !router.aliasedWithheldToolNames(configured).some((name) => name.startsWith('ckan__')));
  has('directoryPrompt', router.directoryPrompt({ configured, today: TODAY }).includes('- `ckan`: '));
  const enumOf = (router.aliasedLoadSourceTool({ configured }).function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum;
  has('aliasedLoadSourceTool', enumOf.includes('ckan'));
  has('aliasedInLoopSystemPrompt', (await router.aliasedInLoopSystemPrompt({ ...input, loaded: ['ckan-server'] })).includes(`**${CKAN_SERVER_WORDS.displayName}** — `));
  has('buildSystemPrompt', (await router.buildSystemPrompt(input)).includes(`**${CKAN_SERVER_WORDS.displayName}** — `));
  has('aliasedBuildSystemPrompt', (await router.aliasedBuildSystemPrompt(input)).includes('ckan__ckan_package_search'));
  has('harnessDefinition', router.harnessDefinition({ configured, chosenBy: 'model', components: [] }).sources.includes('ckan-server'));
  has('offeredMcpTools', router.offeredMcpTools(router.mcpToolsFor(lockPortal), configured).filter((t) => own.has(t)).length === 7);
  has('aliasedOfferedMcpTools', router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockPortal), configured).filter((t) => t.function.name.startsWith('ckan__')).length === 7);
  has('isSourceOffered', router.isSourceOffered(configured, 'ckan-server'));
  has('resolveCalledName', router.resolveCalledName('ckan__ckan_datastore_search', configured).ok);
  has('portalLockGuidance', router.portalLockGuidance(lockPortal, configured).includes(CKAN_SERVER_WORDS.lockMention));
  has('aliasedPortalLockGuidance', router.aliasedPortalLockGuidance(lockPortal, configured).includes(CKAN_SERVER_WORDS.lockMention));
  has('searchSources', router.searchSources({ configured, query: 'CKAN open data portals Boston', top: 20 }).some((h) => h.sourceId === 'ckan-server'));
  has('searchSources (spaced)', router.searchSources({ configured, query: 'CKAN open data portals Boston', top: 20, space: router.manifest.map((e) => e.sourceId) }).some((h) => h.sourceId === 'ckan-server'));
  return missing;
}

test("AO: a one-portal lock to a Socrata portal (City Record's or another) leaves the CKAN server in every offer output pack-lock.test.ts's A6 lists, and both searches find it", async () => {
  const loaded = createCivicRouter(manifestFromInventory(FILE, CIVIC_KINDS));
  for (const [name, router] of [['civicRouter', civicRouter], ['the router over the inventory file', loaded]] as const) {
    for (const portal of ['data.cityofnewyork.us', 'data.cityofchicago.org']) {
      assert.deepEqual(await serverEverywhere(router, { ...ON, lockedPortal: portal }, portal), [], `${name}, locked to ${portal}`);
      assert.deepEqual(await serverEverywhere(router, ON, portal), [], `${name}, the lock text alone, ${portal}`);
    }
  }
});

test("AO: the ckan kind takes no pack: version 4's Boston pack, put back into the file, is refused by the loader, naming its base's kind", () => {
  const withPack = readInventory();
  const pack: Record<string, unknown> = {
    kind: 'pack',
    id: 'boston-ckan@https://data.boston.gov',
    alias: 'boston',
    sourceId: 'boston-ckan',
    displayName: 'Analyze Boston',
    description: 'A pack over the hosted CKAN server.',
    freshness: 'Live.',
    base: SERVER_ID,
    basePins: [{ serverName: 'ckan-mcp-server', serverVersion: '0.4.139', tools: Object.fromEntries(SEVEN.slice(0, 6).map((n) => [n, 'a'.repeat(64)])) }],
    filter: { server_url: 'https://data.boston.gov' },
    api: { platform: 'ckan', host: 'data.boston.gov' },
    version: '1.0',
  };
  pack.hash = packHash(pack as unknown as InventoryPackEntry);
  (withPack.entries as unknown[]).push(pack);
  assert.throws(
    () => manifestFromInventory(withPack, CIVIC_KINDS),
    (error: unknown) => error instanceof InventoryLoadError && error.alias === 'boston' && error.field === 'base' && /\(ckan\) takes no pack$/.test(error.message),
  );
});

test("AO: the ckan kind holds the server entry's guidanceRef to embedded: none, the 0.11.0 value, is refused by name", () => {
  const stale = readInventory();
  (stale.entries.find((e) => e.sourceId === 'ckan-server') as unknown as { guidanceRef: unknown }).guidanceRef = { kind: 'none' };
  assert.throws(
    () => manifestFromInventory(stale, CIVIC_KINDS),
    (error: unknown) => error instanceof InventoryLoadError && error.alias === 'ckan' && error.field === 'guidanceRef.kind' && /this source's guidance is embedded$/.test(error.message),
  );
});

// --- Q2: a pack's base with no tools (the 0.11.0 shape) ---------------------------------

/** Every text the model reads, for `configured`. */
async function modelText(router: CivicRouter, configured: McpRegistryEnv): Promise<Record<string, string>> {
  const input = { configured, today: TODAY, ...fetchers };
  return {
    buildSystemPrompt: await router.buildSystemPrompt(input),
    aliasedBuildSystemPrompt: await router.aliasedBuildSystemPrompt(input),
    directoryPrompt: router.directoryPrompt(input),
    aliasedInLoopSystemPrompt: await router.aliasedInLoopSystemPrompt({ ...input, loaded: router.manifest.map((e) => e.sourceId) }),
    loadSourceEnum: JSON.stringify((router.aliasedLoadSourceTool({ configured }).function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum),
    portalLockGuidance: router.portalLockGuidance('data.cityofnewyork.us', configured),
    searchSources: JSON.stringify(router.searchSources({ configured, query: 'CKAN open data portals Boston', top: 20 })),
  };
}

test("Q2: a pack's base with no tools, offered without an address, is in no list the model reads; an entry with no tools that no pack names is listed as before", async () => {
  // The 0.11.0 shape, built here: the server with no tools, made required so it is offered with no CKAN address.
  // No prompt strings either: the 0.11.0 entry stated none.
  const server = Object.fromEntries(Object.entries(CKAN_SERVER_ENTRY).filter(([key]) => key !== 'prompt')) as unknown as CivicManifestEntry;
  const base: CivicManifestEntry = { ...server, tools: [], toolNames: [], configuration: { ...server.configuration, requirement: 'required' } };
  const pack: CivicManifestEntry = { ...base, id: 'q2-pack@https://example.org', alias: 'q2_pack', sourceId: 'q2-pack', base: 'ckan-server', displayName: 'A Q2 pack', tools: [{ type: 'function', function: { name: 'lookup', description: 'Look up one record.' } }], toolNames: ['lookup'] };
  const router = createCivicRouter([...CIVIC_MANIFEST.slice(0, 7), base, pack]);
  const texts = await modelText(router, OFF);
  for (const [name, text] of Object.entries(texts)) {
    assert.doesNotMatch(text, /Tools: \./, `${name}: no empty Tools list`);
    assert.ok(!text.includes(CKAN_SERVER_WORDS.displayName), `${name}: the base's name is not read`);
  }
  assert.ok(router.offeredSkillSources(OFF).includes('ckan-server'), 'a record still states the base');
  // With no pack naming it, the same entry is an ordinary entry: listed.
  const alone = createCivicRouter([...CIVIC_MANIFEST.slice(0, 7), base]);
  assert.ok(alone.directoryPrompt({ configured: OFF, today: TODAY }).includes('- `ckan`: '), 'listed when no pack names it');
});
