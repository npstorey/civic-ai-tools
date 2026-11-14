// The hosted CKAN server and the Boston pack over it (CKAN-1 P2, hub issue
// 314; router 0.11.0).
//
//   AP   The capture (`__fixtures__/ckan-tools.json`): the base's 20 tool
//        names and the six schemas the pack calls are its; `basePins[0]` is
//        its `serverInfo` and the six hashes; `checkBasePins` matches it and
//        names the member when one schema's type changes; the script's
//        saved-session mode writes it byte for byte.
//   Q1   The base entry declares no tools; the loader holds the pack's pins
//        to the base's own names, which the kind states.
//   A10  The pack's tools: the six schemas through the pack's view, each with
//        `server_url` a one-value `enum` and the refusal paragraph, the `sql`
//        argument stating the SELECT-only rule; and a committed golden.
//   A9b  The offer path: `CKAN_MCP_URL`, `ckanUrl`, both entries keyed by the
//        base's address; a decoy pack over an unconfigured base; a Socrata
//        lock leaves the pack offered, listed and found.
//   AZ   With the base offered, the model reads the pack and never the base;
//        a record states both (Q2).
//   AF   The preamble's Boston rule for the pack (finding 1, ruled (a)).
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
  BOSTON_CKAN_ENTRY,
  BOSTON_CKAN_GUIDANCE,
  BOSTON_CKAN_RULE,
  BOSTON_CKAN_WORDS,
  checkBasePins,
  CIVIC_KINDS,
  CIVIC_MANIFEST,
  civicRouter,
  CKAN_ADDRESS_VARIABLE,
  CKAN_PACK_BASE_TOOLS,
  CKAN_PACK_DESCRIPTION_CUTS,
  CKAN_PACK_TOOL_NAMES,
  CKAN_SERVER_ENTRY,
  CKAN_SERVER_TOOL_NAMES,
  CKAN_SERVER_WORDS,
  composePreamble,
  configuredSources,
  createCivicRouter,
  InventoryLoadError,
  manifestFromInventory,
  mcpToolSchemaSha256,
  packHash,
  readMcpEnv,
  toolsSha256,
  type BasePin,
  type CivicManifest,
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
const GOLDEN_PATH = join(FIXTURES, 'boston-ckan-tools.json');

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
const filePack = (file: InventoryDocument = FILE): InventoryPackEntry => fileEntry(file, 'boston-ckan') as InventoryPackEntry;

/** The hosted CKAN server's id (ADR-0039 §B; Q4) and the Boston pack's. */
const SERVER_ID = '@aborruso/ckan-mcp-server@https://github.com/npstorey/ckan-mcp-server';
const PACK_ID = 'boston-ckan@https://data.boston.gov';
const SERVER_URL = 'https://data.boston.gov';
/** The six tools the pack calls (D2), in routing order. */
const SIX = ['ckan_package_search', 'ckan_find_relevant_datasets', 'ckan_package_show', 'ckan_list_resources', 'ckan_datastore_search', 'ckan_datastore_search_sql'];

const SOCRATA = 'https://socrata-mcp.example.org';
const CKAN = 'https://ckan-mcp.example.org/mcp';
const ON = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: CKAN });
const OFF = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA });
const TODAY = '2026-11-13';
const fetchers = { publicationHost: null, fetchPrompt: async () => 'Fixture Socrata guidance.', fetchInstructions: async () => null };

/** The pack's pin, read from the capture with the router's own hash. */
const capturePin = (): BasePin => ({
  serverName: capture().initialize.serverInfo.name,
  serverVersion: capture().initialize.serverInfo.version,
  tools: Object.fromEntries(SIX.map((name) => [name, mcpToolSchemaSha256(captured(name))])),
});

// --- AP: the capture -----------------------------------------------------------------------

test('AP: the capture is the hosted CKAN server at the pinned commit: its serverInfo, no instructions, and 20 tools, whose names are CKAN_SERVER_TOOL_NAMES in its order', () => {
  const c = capture();
  assert.equal(c._meta.repository, 'https://github.com/npstorey/ckan-mcp-server');
  assert.equal(c._meta.commit, '7b0ac8a1a4aaa550786a2ff96b326307345a7a89');
  assert.deepEqual(c.initialize.serverInfo, { name: 'ckan-mcp-server', version: '0.4.139' });
  assert.equal(c.initialize.instructions, null, 'no instructions: the server entry\'s guidance is none');
  assert.equal(c.tools.length, 20);
  assert.deepEqual([...CKAN_SERVER_TOOL_NAMES], c.tools.map((t) => t.name));
  for (const name of SIX) assert.ok(CKAN_SERVER_TOOL_NAMES.includes(name), `${name} is a tool of the base`);
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

test("AP: basePins[0] is the capture's serverInfo and mcpToolSchemaSha256 of the six, in the file and the mirror; the server entry's toolsRef.fixture names the capture", () => {
  const pin = capturePin();
  assert.deepEqual(filePack().basePins, [pin]);
  assert.deepEqual(BOSTON_CKAN_ENTRY.pack?.basePins, [pin]);
  assert.equal(fileEntry(FILE, 'ckan-server').toolsRef?.fixture, 'packages/civic-typed-router/src/__fixtures__/ckan-tools.json');
});

test('AP: checkBasePins matches the capture\'s list, and names the member when one schema\'s type is changed', () => {
  const pins = BOSTON_CKAN_ENTRY.pack?.basePins ?? [];
  assert.equal(pins.length, 1, 'the pack states one pin');
  const c = capture();
  const observed = { serverName: c.initialize.serverInfo.name, serverVersion: c.initialize.serverInfo.version, tools: structuredClone(c.tools) };
  assert.deepEqual(checkBasePins(pins, observed), { ok: true, pin: 0 });
  const changed = structuredClone(c.tools).map((t) => {
    if (t.name !== 'ckan_datastore_search') return t;
    (t.inputSchema as { properties: { limit: { type: string } } }).properties.limit.type = 'string';
    return t;
  });
  const result = checkBasePins(pins, { ...observed, tools: changed });
  assert.equal(result.ok, false);
  assert.deepEqual(!result.ok && result.differences.map((d) => [d.member, d.pinned === pins[0]!.tools.ckan_datastore_search]), [['tools.ckan_datastore_search', true]]);
});

// --- Q1: the base declares no tools ----------------------------------------------------

test('Q1: the server entry declares no tools (toolsRef.toolNames empty, its hash toolsSha256([])), its guidance is none, and the base, in the file and the mirror, is the server\'s id', () => {
  const server = fileEntry(FILE, 'ckan-server');
  assert.equal(server.kind, 'server');
  assert.equal(server.id, SERVER_ID);
  assert.deepEqual(server.toolsRef, {
    toolNames: [],
    sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    fixture: 'packages/civic-typed-router/src/__fixtures__/ckan-tools.json',
  });
  assert.equal(toolsSha256([]), '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945');
  assert.deepEqual((server as { guidanceRef?: unknown }).guidanceRef, { kind: 'none' });
  assert.equal(filePack().base, SERVER_ID);
  assert.equal(CKAN_SERVER_ENTRY.id, SERVER_ID);
  assert.deepEqual(CKAN_SERVER_ENTRY.toolNames, []);
  assert.equal(BOSTON_CKAN_ENTRY.base, 'ckan-server');
});

/** The file with the Boston pack changed by `change`, its hash restated. */
const packChanged = (change: (pack: Record<string, unknown>) => void): InventoryDocument => {
  const copy = readInventory();
  const pack = filePack(copy) as unknown as Record<string, unknown>;
  change(pack);
  pack.hash = packHash(pack as unknown as InventoryPackEntry);
  return copy;
};
const refused = (doc: InventoryDocument, field: string, pattern: RegExp) =>
  assert.throws(
    () => manifestFromInventory(doc, CIVIC_KINDS),
    (error: unknown) => error instanceof InventoryLoadError && error.alias === 'boston' && error.field === field && pattern.test(error.message),
    `${field}: ${pattern}`,
  );

test("Q1: the loader holds the pack's pins to the base's own names, which the kind states: a pin missing one of the six, or naming a tool the capture lacks, is refused by name; a pin also naming a base tool the pack does not call loads", () => {
  assert.equal(manifestFromInventory(FILE, CIVIC_KINDS).find((e) => e.sourceId === 'boston-ckan')?.base, 'ckan-server', 'the file loads');
  const pin = () => structuredClone(filePack().basePins![0]!) as unknown as Record<string, unknown> & { tools: Record<string, string> };
  const missing = pin();
  delete missing.tools.ckan_datastore_search_sql;
  refused(packChanged((p) => (p.basePins = [missing])), 'basePins[0].tools', /the pack calls "ckan_datastore_search_sql", which no member pins$/);
  refused(packChanged((p) => (p.basePins = [{ ...pin(), tools: { ...pin().tools, ckan_no_such_tool: 'a'.repeat(64) } }])), 'basePins[0].tools.ckan_no_such_tool', /is not a tool of the base/);
  const extra = packChanged((p) => (p.basePins = [{ ...pin(), tools: { ...pin().tools, ckan_status_show: 'b'.repeat(64) } }]));
  assert.equal(manifestFromInventory(extra, CIVIC_KINDS).find((e) => e.sourceId === 'boston-ckan')?.pack?.basePins.length, 1);
});

test("Q1: the ckan kind holds a pack's filter and api: only server_url, an https URL, and api { ckan, its host }", () => {
  refused(packChanged((p) => (p.filter = { server_url: SERVER_URL, portal: 'data.boston.gov' })), 'filter.portal', /a ckan pack fixes only server_url$/);
  refused(packChanged((p) => (p.filter = {})), 'filter.server_url', /a ckan pack fixes its server_url$/);
  refused(packChanged((p) => (p.filter = { server_url: 'http://data.boston.gov' })), 'filter.server_url', /is not an https URL$/);
  refused(packChanged((p) => ((p.api as Record<string, string>).host = 'data.cityofnewyork.us')), 'api.host', /a ckan pack's host is the host of its filter\.server_url, "data\.boston\.gov"$/);
  refused(packChanged((p) => ((p.api as Record<string, string>).platform = 'socrata')), 'api.platform', /a ckan pack's platform is "ckan"$/);
  refused(packChanged((p) => ((p.api as Record<string, string>).dataset = 'x')), 'api.dataset', /states platform and host only$/);
  refused(packChanged((p) => (p.base = 'ckan-server')), 'base', /"ckan-server" is a sourceId; a pack names its base by the server entry's id/);
});

// --- A10: the pack's tools -------------------------------------------------------------

test("A10: each mirrored schema, before server_url is fixed, is the capture's: its arguments' schema is the tool's inputSchema, and its mcpToolSchemaSha256 equals the pin's member", () => {
  assert.deepEqual(CKAN_PACK_BASE_TOOLS.map((t) => t.function.name), SIX);
  for (const tool of CKAN_PACK_BASE_TOOLS) {
    const name = tool.function.name;
    const listed = captured(name);
    assert.deepEqual(tool.function.parameters, listed.inputSchema, `${name}: the capture's inputSchema`);
    assert.equal(tool.function.description, listed.description, `${name}: the capture's description`);
    assert.equal(mcpToolSchemaSha256({ name, inputSchema: tool.function.parameters }), BOSTON_CKAN_ENTRY.pack?.basePins[0]?.tools[name], `${name}: the pin's member`);
  }
});

test('A10: the pack\'s tools are the six, named through the pack\'s view, each with server_url one value and the refusal paragraph; sql states the SELECT-only rule; its toolNames are its schemas\' set', () => {
  assert.deepEqual([...BOSTON_CKAN_ENTRY.toolNames], SIX);
  assert.deepEqual(BOSTON_CKAN_ENTRY.tools.map((t) => t.function.name), SIX, 'the bare view: the upstream names');
  assert.deepEqual(filePack().toolsRef?.toolNames, SIX);
  assert.equal(filePack().toolsRef?.sha256, toolsSha256(BOSTON_CKAN_ENTRY.tools));
  const aliased = civicRouter.aliasedMcpTools.filter((t) => civicRouter.sourceForAliasedName(t.function.name)?.sourceId === 'boston-ckan');
  assert.deepEqual(aliased.map((t) => t.function.name), SIX.map((name) => `boston__${name}`));
  for (const tool of [...BOSTON_CKAN_ENTRY.tools, ...aliased]) {
    const properties = (tool.function.parameters as { properties: Record<string, { enum?: string[]; description?: string }> }).properties;
    assert.deepEqual(properties.server_url?.enum, [SERVER_URL], `${tool.function.name}: server_url is one value`);
    assert.match(tool.function.description ?? '', /\n\nThis source reads one CKAN portal only, https:\/\/data\.boston\.gov: pass it as "server_url"\. A call naming any other portal is refused and returns no data\.$/);
  }
  const sql = (aliased.find((t) => t.function.name === 'boston__ckan_datastore_search_sql')!.function.parameters as { properties: { sql: { description: string } } }).properties.sql;
  assert.match(sql.description, /One statement only: it begins, after any whitespace and SQL comments, with SELECT or WITH/);
  // The pack's tools carry no toolsFor: their text is the server's.
  assert.equal(BOSTON_CKAN_ENTRY.toolsFor, undefined);
});

// --- AT: no text of the pack's tools names a tool it does not carry (finding 2 = (b)) ---

/** The passages the pack removes from the server's descriptions, as the
 *  finding states them: both name `ckan_status_show`. */
const STATED_CUTS: Record<string, string[]> = {
  ckan_package_search: [
    '  Before searching a portal, check its locale via ckan_status_show (field: "Portal Locale" / locale_default).\n',
    'ckan_status_show (check locale) → ',
  ],
};

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

test("AT: no text of the pack's six tools, bare or aliased, names one of the 14 base tools the pack does not carry; each description is the capture's less exactly the stated passages, with the router's last paragraph", () => {
  const others = capture().tools.map((t) => t.name).filter((name) => !SIX.includes(name));
  assert.equal(others.length, 14);
  assert.deepEqual(others, CKAN_SERVER_TOOL_NAMES.filter((name) => !CKAN_PACK_TOOL_NAMES.includes(name)));
  const named = new RegExp(`(?<![A-Za-z0-9_])(${others.join('|')})(?![A-Za-z0-9_])`);
  const aliased = civicRouter.aliasedMcpTools.filter((t) => civicRouter.sourceForAliasedName(t.function.name)?.sourceId === 'boston-ckan');
  const tools = [...BOSTON_CKAN_ENTRY.tools, ...aliased];
  assert.equal(tools.length, 12, 'the six, bare and aliased');
  for (const tool of tools) {
    for (const [where, text] of toolTexts(tool)) {
      const found = named.exec(text)?.[1];
      assert.equal(found, undefined, `${tool.function.name} ${where} names ${found}, a base tool the pack does not carry`);
    }
  }
  // The pack's cuts are the stated ones, each found once in the capture's text, and nothing else moved.
  assert.deepEqual(CKAN_PACK_DESCRIPTION_CUTS, STATED_CUTS);
  const tail = `\n\nThis source reads one CKAN portal only, ${SERVER_URL}: pass it as "server_url". A call naming any other portal is refused and returns no data.`;
  for (const tool of BOSTON_CKAN_ENTRY.tools) {
    let expected = captured(tool.function.name).description as string;
    for (const passage of STATED_CUTS[tool.function.name] ?? []) {
      assert.equal(expected.split(passage).length - 1, 1, `the capture holds the passage once: ${passage}`);
      expected = expected.replace(passage, '');
    }
    assert.equal(tool.function.description, `${expected}${tail}`, `${tool.function.name}: the capture's description less the stated passages`);
  }
});

test("A10: the pack's tools, bare and aliased, are the committed golden byte for byte", () => {
  const golden = readIfCommitted<{ bare: unknown; aliased: unknown }>(GOLDEN_PATH);
  assert.ok(golden, 'the golden src/__fixtures__/boston-ckan-tools.json is committed');
  const aliased = civicRouter.aliasedMcpTools.filter((t) => civicRouter.sourceForAliasedName(t.function.name)?.sourceId === 'boston-ckan');
  assert.equal(JSON.stringify(BOSTON_CKAN_ENTRY.tools), JSON.stringify(golden.bare));
  assert.equal(JSON.stringify(aliased), JSON.stringify(golden.aliased));
});

test("the pack's guidance is docs/skills/boston-ckan.md less its final newline, inline in the file with its blockSha256", () => {
  const docPath = join(REPO, 'docs', 'skills', 'boston-ckan.md');
  assert.ok(existsSync(docPath), 'docs/skills/boston-ckan.md is committed');
  const doc = readFileSync(docPath, 'utf8');
  assert.ok(doc.endsWith('\n') && !doc.endsWith('\n\n'));
  assert.equal(BOSTON_CKAN_GUIDANCE, doc.slice(0, -1));
  const guidance = filePack().guidance as { kind: string; text: string; blockSha256: string };
  assert.equal(guidance.kind, 'inline');
  assert.equal(guidance.text, BOSTON_CKAN_GUIDANCE);
  assert.equal(guidance.blockSha256, createHash('sha256').update(BOSTON_CKAN_GUIDANCE, 'utf8').digest('hex'));
  // Every OpenContext tool name is replaced, and the six are named.
  assert.doesNotMatch(BOSTON_CKAN_GUIDANCE, /ckan__/);
  for (const name of SIX) assert.ok(BOSTON_CKAN_GUIDANCE.includes(`\`${name}\``), `the guidance names ${name}`);
});

test("the entries' identity and data: the ids, aliases, order, version 1.0, filter, api, and no derivedFrom", () => {
  const pack = filePack();
  assert.deepEqual(FILE.entries.slice(-2).map((e) => [e.kind, e.sourceId, e.alias]), [
    ['server', 'ckan-server', 'ckan'],
    ['pack', 'boston-ckan', 'boston'],
  ]);
  assert.deepEqual(CIVIC_MANIFEST.slice(-2).map((e) => e.sourceId), ['ckan-server', 'boston-ckan']);
  assert.equal(pack.id, PACK_ID);
  assert.equal(pack.version, '1.0');
  assert.deepEqual(pack.filter, { server_url: SERVER_URL });
  assert.deepEqual(pack.api, { platform: 'ckan', host: 'data.boston.gov' });
  assert.deepEqual(fileEntry(FILE, 'ckan-server').api, { platform: 'ckan' });
  assert.equal((fileEntry(FILE, 'ckan-server') as { serverType?: string }).serverType, 'ckan');
  assert.equal(Object.hasOwn(pack, 'derivedFrom'), false, 'no sentence of the guidance is drawn from the server\'s text');
  assert.equal(fileEntry(FILE, 'boston-opencontext').alias, 'boston_opencontext', 'D2 = A');
  assert.equal(pack.hash, packHash(pack));
  assert.equal(BOSTON_CKAN_ENTRY.pack?.hash, pack.hash);
  // The words: the file's are the words module's.
  assert.equal(pack.displayName, BOSTON_CKAN_WORDS.displayName);
  assert.equal(pack.author, BOSTON_CKAN_WORDS.author);
  assert.equal(fileEntry(FILE, 'ckan-server').publisher, CKAN_SERVER_WORDS.publisher);
});

// --- A9b: the offer path ---------------------------------------------------------------

test('A9b: CKAN_MCP_URL set, both entries are keyed by its address, offered, and the pack\'s six are offered; unset or blank, no key, not offered, withheld', () => {
  assert.equal(CKAN_ADDRESS_VARIABLE, 'CKAN_MCP_URL');
  assert.equal(ON.ckanUrl, CKAN);
  assert.equal(Object.keys(ON).at(-1), 'ckanUrl', 'the key follows the others');
  assert.equal(configuredSources(ON)['boston-ckan'], CKAN);
  assert.equal(configuredSources(ON)['ckan-server'], CKAN);
  const six = SIX.map((name) => `boston__${name}`);
  for (const sourceId of ['ckan-server', 'boston-ckan']) assert.equal(civicRouter.isSourceOffered(ON, sourceId), true, `${sourceId} offered`);
  const offered = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(undefined), ON).map((t) => t.function.name);
  for (const name of six) assert.ok(offered.includes(name), `${name} offered`);
  for (const configured of [OFF, readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: '  ' })]) {
    assert.equal(Object.hasOwn(configured, 'ckanUrl'), false, 'no ckanUrl key');
    assert.deepEqual(Object.keys(configured), Object.keys(readMcpEnv({})), 'the reading is 0.10.0\'s, key for key');
    for (const sourceId of ['ckan-server', 'boston-ckan']) {
      assert.equal(Object.hasOwn(configuredSources(configured), sourceId), false, `${sourceId}: no key`);
      assert.equal(civicRouter.isSourceOffered(configured, sourceId), false, `${sourceId}: not offered`);
    }
    const withheld = civicRouter.aliasedWithheldToolNames(configured);
    for (const name of six) assert.ok(withheld.includes(name), `${name} withheld`);
  }
});

test('A9b decoy: a pack whose base has no address is not-configured while the CKAN server has one', () => {
  const decoyServer: CivicManifestEntry = { ...CKAN_SERVER_ENTRY, id: 'decoy-ckan@https://example.org/decoy', alias: 'decoy_ckan', sourceId: 'decoy-ckan' };
  const decoyPack: CivicManifestEntry = { ...BOSTON_CKAN_ENTRY, id: 'decoy-pack@https://example.org', alias: 'decoy', sourceId: 'decoy-pack', base: 'decoy-ckan' };
  const router = createCivicRouter([...CIVIC_MANIFEST, decoyServer, decoyPack] as CivicManifest);
  const reasons = Object.fromEntries(router.sourcesOffered(ON).map((s) => [s.sourceId, s.reason]));
  assert.equal(reasons['ckan-server'], 'configured');
  assert.equal(reasons['boston-ckan'], 'configured');
  assert.equal(reasons['decoy-ckan'], 'not-configured');
  assert.equal(reasons['decoy-pack'], 'not-configured');
});

/** The Boston pack in each offer output pack-lock.test.ts's A6 lists, for
 *  `configured` and the lock text's `lockPortal`. */
async function packEverywhere(router: CivicRouter, configured: McpRegistryEnv, lockPortal: string): Promise<string[]> {
  const missing: string[] = [];
  const has = (name: string, ok: boolean) => {
    if (!ok) missing.push(name);
  };
  const packTools = new Set<unknown>(router.manifest.find((e) => e.sourceId === 'boston-ckan')?.tools ?? []);
  const input = { configured, today: TODAY, portal: lockPortal, ...fetchers };
  has('sourcesOffered', router.sourcesOffered(configured).find((s) => s.sourceId === 'boston-ckan')?.reason === 'configured');
  has('offeredSkillSources', router.offeredSkillSources(configured).includes('boston-ckan'));
  has('withheldToolNames', !SIX.some((name) => router.withheldToolNames(configured).includes(name)));
  has('aliasedWithheldToolNames', !router.aliasedWithheldToolNames(configured).some((name) => name.startsWith('boston__')));
  has('directoryPrompt', router.directoryPrompt({ configured, today: TODAY }).includes('- `boston`: '));
  const enumOf = (router.aliasedLoadSourceTool({ configured }).function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum;
  has('aliasedLoadSourceTool', enumOf.includes('boston'));
  has('aliasedInLoopSystemPrompt', (await router.aliasedInLoopSystemPrompt({ ...input, loaded: ['boston-ckan'] })).includes(`**${BOSTON_CKAN_WORDS.displayName}** — `));
  has('buildSystemPrompt', (await router.buildSystemPrompt(input)).includes(`**${BOSTON_CKAN_WORDS.displayName}** — `));
  has('aliasedBuildSystemPrompt', (await router.aliasedBuildSystemPrompt(input)).includes('boston__ckan_package_search'));
  has('harnessDefinition', router.harnessDefinition({ configured, chosenBy: 'model', components: [] }).sources.includes('boston-ckan'));
  has('offeredMcpTools', router.offeredMcpTools(router.mcpToolsFor(lockPortal), configured).filter((t) => packTools.has(t)).length === 6);
  has('aliasedOfferedMcpTools', router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockPortal), configured).filter((t) => t.function.name.startsWith('boston__')).length === 6);
  has('isSourceOffered', router.isSourceOffered(configured, 'boston-ckan'));
  has('resolveCalledName', router.resolveCalledName('boston__ckan_datastore_search', configured).ok);
  has('portalLockGuidance', router.portalLockGuidance(lockPortal, configured).includes(BOSTON_CKAN_WORDS.lockMention));
  has('aliasedPortalLockGuidance', router.aliasedPortalLockGuidance(lockPortal, configured).includes(BOSTON_CKAN_WORDS.lockMention));
  has('searchSources', router.searchSources({ configured, query: 'Boston 311 requests and permits' }).some((h) => h.sourceId === 'boston-ckan'));
  has('searchSources (spaced)', router.searchSources({ configured, query: 'Boston 311 requests and permits', space: router.manifest.map((e) => e.sourceId) }).some((h) => h.sourceId === 'boston-ckan'));
  return missing;
}

test("A9b: a one-portal lock to a Socrata portal (City Record's or another) leaves the Boston pack in every offer output pack-lock.test.ts's A6 lists, and both searches find it", async () => {
  const loaded = createCivicRouter(manifestFromInventory(FILE, CIVIC_KINDS));
  for (const [name, router] of [['civicRouter', civicRouter], ['the router over the inventory file', loaded]] as const) {
    for (const portal of ['data.cityofnewyork.us', 'data.cityofchicago.org']) {
      // Through the configuration's lockedPortal, and as the lock text's argument alone.
      assert.deepEqual(await packEverywhere(router, { ...ON, lockedPortal: portal }, portal), [], `${name}, locked to ${portal}`);
      assert.deepEqual(await packEverywhere(router, ON, portal), [], `${name}, the lock text alone, ${portal}`);
    }
  }
});

// --- AZ: the base offered, the model reads the pack only (Q2) ---------------------------

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

test('AZ: with the CKAN server offered, every list the model reads names the pack and never the base; every list a record states holds both', async () => {
  const loaded = createCivicRouter(manifestFromInventory(FILE, CIVIC_KINDS));
  for (const router of [civicRouter, loaded]) {
    const texts = await modelText(router, ON);
    for (const [name, text] of Object.entries(texts)) {
      assert.doesNotMatch(text, /Tools: \./, `${name}: no empty Tools list`);
      assert.ok(!text.includes(CKAN_SERVER_WORDS.displayName), `${name}: the base's name is not read`);
      assert.ok(!text.includes('"ckan-server"') && !text.includes('`ckan`') && !text.includes('"ckan"'), `${name}: the base's id and alias are not read`);
    }
    assert.match(texts.buildSystemPrompt!, /^You have access to FOUR MCP data sources/m, 'the count leaves the base out: Socrata, Data Commons, City Record, Analyze Boston');
    assert.ok(texts.buildSystemPrompt!.includes(`\n4. **${BOSTON_CKAN_WORDS.displayName}** — ${BOSTON_CKAN_WORDS.description} Tools: ckan_package_search,`), 'the preamble names the pack, fourth');
    assert.ok(texts.buildSystemPrompt!.includes(BOSTON_CKAN_WORDS.citation), 'the outro cites the pack');
    assert.doesNotMatch(texts.buildSystemPrompt!, /the identifiers its tools return \(for /, 'no composed citation for the base');
    assert.ok(texts.directoryPrompt!.includes('- `boston`: '), 'the directory lists the pack');
    assert.ok(JSON.parse(texts.loadSourceEnum!).includes('boston'), 'load_source offers the pack');
    assert.ok(texts.portalLockGuidance!.includes(BOSTON_CKAN_WORDS.lockMention), 'the lock text names the pack');
    const hits = JSON.parse(texts.searchSources!) as { sourceId: string }[];
    assert.ok(hits.some((h) => h.sourceId === 'boston-ckan'), 'the search finds the pack');
    assert.deepEqual(router.searchSources({ configured: ON, query: 'CKAN portals', space: ['ckan-server'] }), [], 'the base is no hit, even alone in the space');
    // What a record states holds both.
    const rows = Object.fromEntries(router.sourcesOffered(ON).map((s) => [s.sourceId, s.reason]));
    assert.deepEqual([rows['ckan-server'], rows['boston-ckan']], ['configured', 'configured']);
    assert.ok(router.isSourceOffered(ON, 'ckan-server') && router.isSourceOffered(ON, 'boston-ckan'));
    assert.deepEqual(router.offeredSkillSources(ON).slice(-2), ['ckan-server', 'boston-ckan']);
    assert.deepEqual(router.harnessDefinition({ configured: ON, chosenBy: 'model', components: [] }).sources.slice(-2), ['ckan-server', 'boston-ckan']);
  }
});

test('Q2: a pack\'s base with no tools, offered without an address, is in no list the model reads; an entry with no tools that no pack names is listed as before', async () => {
  // The two entries made required, so they are offered with no CKAN address.
  const required = (entry: CivicManifestEntry): CivicManifestEntry => ({ ...entry, configuration: { ...entry.configuration, requirement: 'required' } });
  const server = required(CKAN_SERVER_ENTRY);
  const pack: CivicManifestEntry = { ...required(CKAN_SERVER_ENTRY), id: 'q2-pack@https://example.org', alias: 'q2_pack', sourceId: 'q2-pack', base: 'ckan-server', displayName: 'A Q2 pack', tools: [{ type: 'function', function: { name: 'lookup', description: 'Look up one record.' } }], toolNames: ['lookup'] };
  const router = createCivicRouter([...CIVIC_MANIFEST.slice(0, 7), server, pack]);
  const texts = await modelText(router, OFF);
  for (const [name, text] of Object.entries(texts)) {
    assert.doesNotMatch(text, /Tools: \./, `${name}: no empty Tools list`);
    assert.ok(!text.includes(CKAN_SERVER_WORDS.displayName), `${name}: the base's name is not read`);
  }
  assert.ok(router.offeredSkillSources(OFF).includes('ckan-server'), 'a record still states the base');
  // With no pack naming it, the same entry is an ordinary entry: listed.
  const alone = createCivicRouter([...CIVIC_MANIFEST.slice(0, 7), server]);
  assert.ok(alone.directoryPrompt({ configured: OFF, today: TODAY }).includes('- `ckan`: '), 'listed when no pack names it');
});

// --- AF: the preamble's Boston rule (finding 1) -----------------------------------------

const OPENCONTEXT_RULE = '- **Boston civic questions** → Boston OpenContext. Boston is not on Socrata.';
const rulesOf = (preamble: string): string[] => preamble.split('Source selection rules:\n')[1]!.split('\n\n')[0]!.split('\n');

test("AF: with the pack offered and OpenContext not, the rules hold the pack's Boston line; with both, the pack's line and not OpenContext's; with OpenContext alone, OpenContext's line as before", async () => {
  const preamble = (ids: string[]) => composePreamble(ids.map((sourceId) => ({ sourceId, preambleEntry: sourceId })));
  assert.deepEqual(rulesOf(preamble(['socrata', 'boston-ckan'])).filter((r) => r.includes('Boston civic')), [BOSTON_CKAN_RULE]);
  assert.deepEqual(rulesOf(preamble(['socrata', 'boston-opencontext', 'boston-ckan'])).filter((r) => r.includes('Boston civic')), [BOSTON_CKAN_RULE]);
  assert.deepEqual(rulesOf(preamble(['socrata', 'boston-opencontext'])).filter((r) => r.includes('Boston civic')), [OPENCONTEXT_RULE]);
  assert.deepEqual(rulesOf(preamble(['socrata'])).filter((r) => r.includes('Boston civic')), []);
  // Through the router.
  const both = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: CKAN, BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp' });
  const input = (configured: McpRegistryEnv) => ({ configured, today: TODAY, ...fetchers });
  const packOnly = await civicRouter.buildSystemPrompt(input(ON));
  assert.ok(packOnly.includes(`\n${BOSTON_CKAN_RULE}\n`) && !packOnly.includes(OPENCONTEXT_RULE));
  const withBoth = await civicRouter.aliasedBuildSystemPrompt(input(both));
  assert.ok(withBoth.includes(`\n${BOSTON_CKAN_RULE}\n`) && !withBoth.includes(OPENCONTEXT_RULE));
  const openContext = await civicRouter.buildSystemPrompt(input(readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp' })));
  assert.ok(openContext.includes(`\n${OPENCONTEXT_RULE}\n`) && !openContext.includes(BOSTON_CKAN_RULE));
});

// --- The capture's pins, cross-checked -------------------------------------------------

test("AP: the six pins equal the owner's capture record (K3's hashes.tsv, computed there with router 0.10.0)", () => {
  // The cross-check, not the source: the pins are computed from the capture above.
  assert.deepEqual(BOSTON_CKAN_ENTRY.pack?.basePins[0]?.tools, {
    ckan_package_search: 'f4a766bc17325feb4099b790cd849e126a537af50fbca68f458cbb8549b10145',
    ckan_find_relevant_datasets: '41e36171a4f110c1d89964335e86fa2dd32e6cc92a2935f506fd0c0d188eb028',
    ckan_package_show: 'ff022c49c7263ba72ab649568e78ceac64de909e5bfeb930ef63b0a11005c3c5',
    ckan_list_resources: '0a5048a337b3e239e0bf71e84aab593712f181224aef0c656bca66fe343c5dbf',
    ckan_datastore_search: 'a89056ee57437ebafb4bdb3d7aaaa83fc8829f3279d3970b2a78e40f9f3a1701',
    ckan_datastore_search_sql: 'ee15e13fa342ca280d51dbaf7a9db8a48fef6d0a4bc2e008e24e414cc4d30fe7',
  });
});
