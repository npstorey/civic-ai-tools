// The hosted CKAN server offers its own tools, and the Boston pack is
// retired (CKAN-2 P2, hub issue 329; router 0.12.0, inventory version 5).
//
//   R1  With `CKAN_MCP_URL` set, the offered tools include the server's
//       seven as `ckan__<name>`, `server_url` required and open in each, and
//       no `boston__*` tool (D2 = B).
//   R2  `boston-ckan` is in neither `CIVIC_MANIFEST` nor the inventory; the
//       inventory is version 5, its hash stated three ways, its CHANGELOG
//       line naming the retirement.
//   R3  The composed prompt carries the server's guidance, written for any
//       portal and naming `https://data.boston.gov` for Boston; the
//       preamble's Boston rule routes to the server with that `server_url`,
//       OpenContext's rule kept for when the server is not offered.
//   R4  The server's `ckan_datastore_search_sql` states the statement rule
//       in its `sql` description (CKAN-1's D3 = A).
//   R5  The server's words no longer say none of its tools is offered or
//       that it has no data, and name no portal list (D8 = A).
//   R6  A router export of retired packs resolves the pack's id and source
//       id (P3's carried item; cold-read F2).
//   G6  No router read attributes a bare Boston OpenContext tool name (each
//       begins `ckan__`) to the CKAN server, whose alias is `ckan`.
//
// The files are read here, by the test; the router reads none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BOSTON_OPENCONTEXT_TOOL_NAMES,
  canonicalJson,
  CIVIC_INVENTORY,
  CIVIC_KINDS,
  CIVIC_MANIFEST,
  civicRouter,
  CKAN_BOSTON_RULE,
  CKAN_GUIDANCE,
  CKAN_SERVER_ENTRY,
  CKAN_SERVER_WORDS,
  CKAN_TOOL_NAMES,
  CKAN_TOOLS,
  composePreamble,
  createCivicRouter,
  manifestFromInventory,
  readMcpEnv,
  RETIRED_PACKS,
  retiredPack,
  sha256Hex,
  type InventoryDocument,
  type McpRegistryEnv,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = join(SRC, '..', '..', '..');
const readText = (...path: string[]): string | undefined => {
  const file = join(REPO, ...path);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};
const FILE: InventoryDocument = JSON.parse(readText('inventory', 'civic-inventory.json')!);

/** The seven tools the server offers, in routing order (D2 = B). */
const SEVEN = [
  'ckan_package_search',
  'ckan_find_relevant_datasets',
  'ckan_package_show',
  'ckan_list_resources',
  'ckan_datastore_search',
  'ckan_datastore_search_sql',
  'ckan_status_show',
];
const PACK_ID = 'boston-ckan@https://data.boston.gov';
const BOSTON = 'https://data.boston.gov';
/** The version this phase writes: the fifth line of the inventory's CHANGELOG. */
const VERSION_5 = '2026-11-18.1';

const SOCRATA = 'https://socrata-mcp.example.org';
const CKAN = 'https://ckan-mcp.example.org/mcp';
const OPENCONTEXT = 'https://boston-mcp.example.org/mcp';
const ON = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: CKAN });
const BOTH = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, CKAN_MCP_URL: CKAN, BOSTON_OPENCONTEXT_MCP_URL: OPENCONTEXT });
const OPENCONTEXT_ONLY = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, BOSTON_OPENCONTEXT_MCP_URL: OPENCONTEXT });
const TODAY = '2026-11-18';
const fetchers = { publicationHost: null, fetchPrompt: async () => 'Fixture Socrata guidance.', fetchInstructions: async () => null };
const input = (configured: McpRegistryEnv) => ({ configured, today: TODAY, ...fetchers });

/** The rule the preamble states for Boston when the server is offered. */
const RULE =
  "- **Boston civic questions** → the CKAN MCP Server, with `server_url` https://data.boston.gov (Analyze Boston, the City of Boston's portal). Boston is not on Socrata.";
const OPENCONTEXT_RULE = '- **Boston civic questions** → Boston OpenContext. Boston is not on Socrata.';
const bostonRules = (preamble: string): string[] =>
  preamble.split('Source selection rules:\n')[1]!.split('\n\n')[0]!.split('\n').filter((r) => r.includes('Boston civic'));

/** The statement rule's words, on `ckan_datastore_search_sql`'s `sql`. */
const STATEMENT_RULE =
  /\. One statement only: it begins, after any whitespace and SQL comments, with SELECT or WITH, and no second statement follows a semicolon outside a quoted literal\. Any other statement is refused before it is sent\.$/;

type Schema = { required?: string[]; properties: Record<string, { enum?: unknown; const?: unknown; description?: string }> };
const schemaOf = (tool: { function: { parameters?: unknown } }): Schema => tool.function.parameters as Schema;

// --- R1 ------------------------------------------------------------------------

test('A1 (R1, K1): with CKAN_MCP_URL set, selected or not, the offered tools include the seven as ckan__<name>, each server_url required with no enum or const, and no boston__* tool', () => {
  for (const selection of [undefined, ['socrata', 'ckan-server']]) {
    const label = selection ? 'selected' : 'no selection';
    const offered = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(undefined), ON, selection);
    const names = offered.map((t) => t.function.name);
    assert.deepEqual(names.filter((n) => n.startsWith('ckan__')), SEVEN.map((n) => `ckan__${n}`), `${label}: the seven, in routing order`);
    assert.deepEqual(names.filter((n) => n.startsWith('boston__')), [], `${label}: no boston__ tool`);
    for (const tool of offered.filter((t) => t.function.name.startsWith('ckan__'))) {
      const schema = schemaOf(tool);
      assert.ok(schema.required?.includes('server_url'), `${tool.function.name}: server_url is required`);
      assert.equal(schema.properties.server_url?.enum, undefined, `${tool.function.name}: no enum`);
      assert.equal(schema.properties.server_url?.const, undefined, `${tool.function.name}: no const`);
      const resolved = civicRouter.resolveCalledName(tool.function.name, ON, selection);
      assert.deepEqual(resolved.ok && [resolved.sourceId, resolved.base], ['ckan-server', undefined], `${tool.function.name}: the server's own tool`);
    }
    // The bare view: the server's own names, its schemas.
    const bare = civicRouter.offeredMcpTools(civicRouter.mcpToolsFor(undefined), ON, selection);
    const own = new Set(civicRouter.manifest.find((e) => e.sourceId === 'ckan-server')?.tools ?? []);
    assert.deepEqual(bare.filter((t) => own.has(t)).map((t) => t.function.name), SEVEN, `${label}: the bare view offers the seven`);
  }
  assert.deepEqual([...CKAN_TOOL_NAMES], SEVEN);
  assert.deepEqual(CKAN_SERVER_ENTRY.toolNames, SEVEN);
  assert.equal(CKAN_SERVER_ENTRY.tools, CKAN_TOOLS);
});

// --- R2 ------------------------------------------------------------------------

test('A2 (R2): boston-ckan is in neither CIVIC_MANIFEST nor the inventory; the inventory is version 5, its .sha256 the canonicalJson SHA-256 of the file and CIVIC_INVENTORY.hash; its CHANGELOG line states the retirement', () => {
  assert.equal(CIVIC_MANIFEST.some((e) => e.sourceId === 'boston-ckan' || e.id === PACK_ID), false, 'not in CIVIC_MANIFEST');
  assert.equal(FILE.entries.some((e) => e.sourceId === 'boston-ckan' || e.id === PACK_ID), false, 'not in the inventory');
  assert.equal(manifestFromInventory(FILE, CIVIC_KINDS).some((e) => e.sourceId === 'boston-ckan'), false, 'not in the loaded manifest');
  assert.equal(FILE.version, VERSION_5);
  assert.equal(CIVIC_INVENTORY.version, VERSION_5);
  const hash = sha256Hex(canonicalJson(FILE));
  assert.equal(readText('inventory', 'civic-inventory.json.sha256')?.trim(), hash, 'the .sha256 file');
  assert.equal(CIVIC_INVENTORY.hash, hash, 'CIVIC_INVENTORY');
  const lines = (readText('inventory', 'CHANGELOG.md') ?? '').split('\n').filter((l) => /^- `\d{4}-\d{2}-\d{2}\.\d+`: /.test(l));
  assert.equal(lines.length, 5, 'five versions');
  const line = lines[4]!;
  assert.ok(line.startsWith(`- \`${VERSION_5}\`: `), 'the fifth line is this version');
  assert.match(line, /`boston-ckan`[^.]*retired/, 'the pack is retired');
  assert.match(line, /offer(s|ed)? [^.]*by no instance until the website/, "no instance offers the server's tools until the website moves");
  assert.match(line, /`retiredPack`/, 'how a record naming the pack reads');
});

// --- R3, R4, R5 ------------------------------------------------------------------

test('A3 (R3): configured, the composed prompt carries the server\'s guidance, docs/skills/ckan.md less its final newline, written for any portal and naming https://data.boston.gov for Boston; the inventory states it embedded', async () => {
  const doc = readText('docs', 'skills', 'ckan.md');
  assert.ok(doc !== undefined, 'docs/skills/ckan.md is committed');
  assert.ok(doc.endsWith('\n') && !doc.endsWith('\n\n'));
  assert.equal(CKAN_GUIDANCE, doc.slice(0, -1));
  assert.ok(CKAN_GUIDANCE.includes('Every call names the portal it reads in `server_url`'), 'for any portal');
  assert.ok(CKAN_GUIDANCE.includes("Analyze Boston, the City of Boston's portal, is `https://data.boston.gov`"), 'Boston named');
  assert.doesNotMatch(CKAN_GUIDANCE, /no other portal/, "not one portal's guidance");
  for (const name of SEVEN) assert.ok(CKAN_GUIDANCE.includes(`\`${name}\``), `the guidance names ${name}`);
  const server = FILE.entries.find((e) => e.sourceId === 'ckan-server') as { guidanceRef?: unknown };
  assert.deepEqual(server.guidanceRef, { kind: 'embedded' });
  const bare = await civicRouter.buildSystemPrompt(input(ON));
  assert.ok(bare.includes(CKAN_GUIDANCE), 'the bare prompt carries the guidance');
  assert.ok(bare.includes(`**${CKAN_SERVER_WORDS.displayName}** — ${CKAN_SERVER_WORDS.description} Tools: ${SEVEN.join(', ')}.`), 'the preamble names the server');
  const aliased = await civicRouter.aliasedBuildSystemPrompt(input(ON));
  assert.ok(aliased.includes('**`ckan__ckan_datastore_search_sql`**'), 'the aliased prompt names its tools by their exposed names');
  assert.ok(civicRouter.directoryPrompt({ configured: ON, today: TODAY }).includes('- `ckan`: '), 'the directory lists the server');
});

test("A3 (R3): the preamble's Boston rule routes Boston questions to the CKAN server with server_url https://data.boston.gov; with OpenContext alone, OpenContext's rule as before", async () => {
  assert.equal(CKAN_BOSTON_RULE, RULE);
  const preamble = (ids: string[]) => composePreamble(ids.map((sourceId) => ({ sourceId, preambleEntry: sourceId })));
  assert.deepEqual(bostonRules(preamble(['socrata', 'ckan-server'])), [RULE]);
  assert.deepEqual(bostonRules(preamble(['socrata', 'boston-opencontext', 'ckan-server'])), [RULE]);
  assert.deepEqual(bostonRules(preamble(['socrata', 'boston-opencontext'])), [OPENCONTEXT_RULE]);
  assert.deepEqual(bostonRules(preamble(['socrata'])), []);
  assert.deepEqual(bostonRules(await civicRouter.buildSystemPrompt(input(ON))), [RULE]);
  assert.deepEqual(bostonRules(await civicRouter.aliasedBuildSystemPrompt(input(BOTH))), [RULE]);
  assert.deepEqual(bostonRules(await civicRouter.buildSystemPrompt(input(OPENCONTEXT_ONLY))), [OPENCONTEXT_RULE]);
});

test("A3 (R4): the server's ckan_datastore_search_sql states the statement rule in its sql description, bare and aliased, after the server's own words", () => {
  const capture: { tools: { name: string; inputSchema: { properties: { sql?: { description: string } } } }[] } = JSON.parse(
    readFileSync(join(SRC, '__fixtures__', 'ckan-tools.json'), 'utf8'),
  );
  const own = capture.tools.find((t) => t.name === 'ckan_datastore_search_sql')!.inputSchema.properties.sql!.description;
  const bare = CKAN_SERVER_ENTRY.tools.find((t) => t.function.name === 'ckan_datastore_search_sql');
  const aliased = civicRouter.aliasedMcpTools.find((t) => t.function.name === 'ckan__ckan_datastore_search_sql');
  for (const [where, tool] of [['bare', bare], ['aliased', aliased]] as const) {
    assert.ok(tool, `${where}: the server offers ckan_datastore_search_sql`);
    const sql = schemaOf(tool).properties.sql?.description ?? '';
    assert.ok(sql.startsWith(own), `${where}: the server's own words first`);
    assert.match(sql, STATEMENT_RULE, where);
  }
});

test("A3 (R5): the server's words no longer say none of its tools is offered or that it has no data, keep \"only the portals its operator lists\", and name no portal list; the file's words are the module's", () => {
  const server = FILE.entries.find((e) => e.sourceId === 'ckan-server')!;
  for (const words of [CKAN_SERVER_WORDS, server]) {
    assert.ok(!words.description.includes('None of its tools are offered on their own'), 'ckan-words.ts:16 is gone');
    assert.ok(!words.freshness.includes('It has no data of its own'), 'ckan-words.ts:17 is gone');
    assert.ok(words.description.includes('only the portals its operator lists'), 'D8 = A');
    const text = [words.description, words.freshness, (words as { freshnessSource?: string }).freshnessSource ?? ''].join('\n');
    const hosts = new Set(text.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:gov|info|com|org|it|ca|eu)\b/g) ?? []);
    assert.deepEqual([...hosts].sort(), ['data.boston.gov', 'datashades.info', 'github.com'], 'Boston, the portal finder and the fork: no list');
    assert.doesNotMatch(text, /CKAN_ALLOWED_DOMAINS/);
  }
  assert.equal(server.description, CKAN_SERVER_WORDS.description);
  assert.equal(server.freshness, CKAN_SERVER_WORDS.freshness);
  assert.equal(server.freshnessSource, (CKAN_SERVER_WORDS as { freshnessSource?: string }).freshnessSource);
});

// --- R6 ------------------------------------------------------------------------

test("A4 (R6): retiredPack resolves the pack's id and its source id to Analyze Boston over ckan-server at https://data.boston.gov; RETIRED_PACKS lists it; no retired id or source id is in CIVIC_MANIFEST", () => {
  const expected = { id: PACK_ID, sourceId: 'boston-ckan', displayName: 'Analyze Boston', base: 'ckan-server', portal: BOSTON };
  for (const key of [PACK_ID, 'boston-ckan']) {
    const found = retiredPack(key);
    assert.ok(found, `${key} resolves`);
    assert.deepEqual({ id: found.id, sourceId: found.sourceId, displayName: found.displayName, base: found.base, portal: found.portal }, expected, key);
  }
  assert.equal(retiredPack('boston'), undefined, 'an alias is not a key');
  assert.equal(retiredPack('ckan-server'), undefined, 'a live source is not retired');
  assert.deepEqual(RETIRED_PACKS.map((p) => p.sourceId), ['boston-ckan']);
  assert.ok(CIVIC_MANIFEST.some((e) => e.sourceId === retiredPack('boston-ckan')?.base), 'the base is live');
  for (const pack of RETIRED_PACKS) {
    assert.equal(CIVIC_MANIFEST.some((e) => e.id === pack.id || e.sourceId === pack.sourceId), false, `${pack.sourceId} is retired`);
  }
});

// --- G6 ------------------------------------------------------------------------

test('A5 (G6): no router read attributes a bare Boston OpenContext tool name to the CKAN server: the dispatch map and resolveCalledName, with both configured, with the server alone and with neither', () => {
  assert.ok(BOSTON_OPENCONTEXT_TOOL_NAMES.every((name) => name.startsWith('ckan__')), "each OpenContext name begins with the server's alias and the separator");
  const routers = [civicRouter, createCivicRouter(manifestFromInventory(FILE, CIVIC_KINDS))];
  for (const router of routers) {
    for (const name of BOSTON_OPENCONTEXT_TOOL_NAMES) {
      // The map: the bare name is no exposed name; its exposed form is OpenContext's.
      assert.equal(router.sourceForAliasedName(name), undefined, `${name} is not an exposed name`);
      assert.equal(router.sourceForAliasedName(`boston_opencontext__${name}`)?.sourceId, 'boston-opencontext');
      const targets = [...router.dispatchMap.values()].filter((t) => t.upstreamName === name || t.exposedName === name);
      assert.deepEqual(targets.map((t) => t.sourceId), ['boston-opencontext'], `${name}: one target, OpenContext's`);
      // Called bare.
      const both = router.resolveCalledName(name, BOTH);
      assert.deepEqual(both.ok && [both.spelling, both.sourceId, both.upstreamName], ['bare', 'boston-opencontext', name], `${name}, both configured`);
      for (const configured of [ON, readMcpEnv({})]) {
        const alone = router.resolveCalledName(name, configured);
        assert.deepEqual(!alone.ok && [alone.reason, alone.candidates], ['not-offered', [`boston_opencontext__${name}`]], `${name}: OpenContext's, not offered`);
      }
    }
    // No exposed name of the server's is one of OpenContext's upstream names.
    const serverNames = [...router.dispatchMap.values()].filter((t) => t.sourceId === 'ckan-server').map((t) => t.exposedName);
    assert.deepEqual(serverNames.filter((n) => BOSTON_OPENCONTEXT_TOOL_NAMES.includes(n)), []);
  }
});

