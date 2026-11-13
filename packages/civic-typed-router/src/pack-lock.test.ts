// The one-portal lock and a Socrata pack fixed to another portal (S3-A P1,
// hub #318; G0-6 = A; the seat's F1 and F2; router 0.10.0).
//
//   A6  An instance locked to one Socrata portal, with the Socrata address
//       set, does not offer, list or find a pack over the Socrata server
//       whose filter fixes another portal: City Record's pack
//       (`data.cityofnewyork.us`) on an instance locked to
//       `data.cityofchicago.org`. It is absent from `sourcesOffered` (reason
//       `not-configured`), `offeredSkillSources`, `directoryPrompt`,
//       `aliasedLoadSourceTool`'s enum, `aliasedInLoopSystemPrompt`,
//       `harnessDefinition`'s sources, `offeredMcpTools` and
//       `aliasedOfferedMcpTools` (its tools withheld), `isSourceOffered`
//       (false), `resolveCalledName` (refused) and both searches; and the
//       lock text does not name it. That holds whether the lock reaches the
//       router through the configuration's `lockedPortal`, or only as
//       `portalLockGuidance`'s argument (the lock text alone). Decoys: locked
//       to `data.cityofnewyork.us`, written `' Data.CityOfNewYork.us '` (trim
//       and lower case), every output equals the unlocked instance's; with no
//       lock, every output is unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CIVIC_KINDS,
  civicRouter,
  configuredAddresses,
  createCivicRouter,
  manifestFromInventory,
  NYC_RECORD_ENTRY,
  readMcpEnv,
  type CivicRouter,
  type InventoryDocument,
  type McpRegistryEnv,
} from './index.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = join(SRC, '..', '..', '..');
const FILE = JSON.parse(readFileSync(join(REPO, 'inventory', 'civic-inventory.json'), 'utf8')) as InventoryDocument;
const LOADED_ROUTER = createCivicRouter(manifestFromInventory(FILE, CIVIC_KINDS));
const ROUTERS: [string, CivicRouter][] = [
  ['civicRouter', civicRouter],
  ['the router over the inventory file', LOADED_ROUTER],
];

const TODAY = '2026-11-13';
const CHICAGO = 'data.cityofchicago.org';
const NYC_WRITTEN_LOOSELY = ' Data.CityOfNewYork.us ';
const PACK = 'nyc-record';
const PACK_ALIAS = 'nyc_record';
const PACK_MENTION = 'City Record for New York City notices';

const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
});
const locked = (configured: McpRegistryEnv, lockedPortal: string): McpRegistryEnv => ({ ...configured, lockedPortal });

const fetchers = {
  publicationHost: null,
  fetchPrompt: async () => 'The Socrata server\'s guidance.',
  fetchInstructions: async (sourceId: string) => `Instructions of ${sourceId}.`,
};

const PACK_QUERY = 'City Record procurement notices and public hearings';

/** Every offer output of `router` for `configured`, as text, by name. The
 *  lock text takes `lockPortal` as its argument. */
async function outputs(router: CivicRouter, configured: McpRegistryEnv, lockPortal: string): Promise<Record<string, string>> {
  const all = router.manifest.map((entry) => entry.sourceId);
  const loaded = [...all];
  const input = { configured, today: TODAY, portal: lockPortal, ...fetchers };
  return {
    sourcesOffered: JSON.stringify(router.sourcesOffered(configured)),
    offeredSkillSources: JSON.stringify(router.offeredSkillSources(configured)),
    withheldToolNames: JSON.stringify(router.withheldToolNames(configured)),
    aliasedWithheldToolNames: JSON.stringify(router.aliasedWithheldToolNames(configured)),
    directoryPrompt: router.directoryPrompt({ configured, today: TODAY }),
    aliasedLoadSourceTool: JSON.stringify(router.aliasedLoadSourceTool({ configured })),
    aliasedInLoopSystemPrompt: await router.aliasedInLoopSystemPrompt({ ...input, loaded }),
    buildSystemPrompt: await router.buildSystemPrompt(input),
    aliasedBuildSystemPrompt: await router.aliasedBuildSystemPrompt(input),
    harnessDefinition: JSON.stringify(router.harnessDefinition({ configured, chosenBy: 'model', components: [] })),
    offeredMcpTools: JSON.stringify(router.offeredMcpTools(router.mcpToolsFor(lockPortal), configured)),
    aliasedOfferedMcpTools: JSON.stringify(router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockPortal), configured)),
    isSourceOffered: JSON.stringify(all.map((id) => router.isSourceOffered(configured, id))),
    resolveCalledName: JSON.stringify(['nyc_record__get_data', 'nyc_record__fetch', 'socrata__get_data'].map((name) => router.resolveCalledName(name, configured))),
    portalLockGuidance: router.portalLockGuidance(lockPortal, configured),
    aliasedPortalLockGuidance: router.aliasedPortalLockGuidance(lockPortal, configured),
    withPortalLockGuidance: router.withPortalLockGuidance('P', lockPortal, configured),
    aliasedWithPortalLockGuidance: router.aliasedWithPortalLockGuidance('P', lockPortal, configured),
    searchSources: JSON.stringify(router.searchSources({ configured, query: PACK_QUERY })),
    searchSourcesSpaced: JSON.stringify(router.searchSources({ configured, query: PACK_QUERY, space: all })),
  };
}

for (const [name, router] of ROUTERS) {
  test(`A6 (${name}): locked to another Socrata portal through the configuration, City Record's pack is not offered, listed or found, and the lock text does not name it`, async () => {
    const configured = locked(EVERY_SOURCE, CHICAGO);
    const reason = router.sourcesOffered(configured).find((s) => s.sourceId === PACK)?.reason;
    assert.equal(reason, 'not-configured', 'sourcesOffered: not-configured');
    assert.ok(!router.offeredSkillSources(configured).includes(PACK), 'offeredSkillSources');
    assert.ok(!router.directoryPrompt({ configured, today: TODAY }).includes(`\`${PACK_ALIAS}\``), 'directoryPrompt');
    const enumOf = (router.aliasedLoadSourceTool({ configured }).function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum;
    assert.ok(!enumOf.includes(PACK_ALIAS), 'aliasedLoadSourceTool\'s enum');
    const inLoop = await router.aliasedInLoopSystemPrompt({ configured, today: TODAY, portal: CHICAGO, ...fetchers, loaded: [PACK, 'socrata'] });
    assert.ok(!inLoop.includes(PACK_ALIAS) && !inLoop.includes(NYC_RECORD_ENTRY.displayName), 'aliasedInLoopSystemPrompt: no line, no block');
    assert.ok(!router.harnessDefinition({ configured, chosenBy: 'model', components: [] }).sources.includes(PACK), 'harnessDefinition\'s sources');

    const bare = router.offeredMcpTools(router.mcpToolsFor(CHICAGO), configured);
    const packTools = new Set<unknown>(router.manifest.find((entry) => entry.sourceId === PACK)!.tools);
    assert.ok(!bare.some((tool) => packTools.has(tool)), 'offeredMcpTools: the pack\'s tools are withheld');
    assert.ok(bare.some((tool) => tool.function.name === 'get_data'), 'offeredMcpTools: the Socrata server\'s get_data stays');
    const aliased = router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(CHICAGO), configured).map((tool) => tool.function.name);
    assert.ok(!aliased.some((n) => n.startsWith(`${PACK_ALIAS}__`)), 'aliasedOfferedMcpTools: the pack\'s tools are withheld');
    assert.ok(aliased.includes('socrata__get_data'), 'aliasedOfferedMcpTools: socrata__get_data stays');
    assert.ok(router.withheldToolNames(configured).includes('get_data') && router.aliasedWithheldToolNames(configured).includes(`${PACK_ALIAS}__get_data`), 'withheld by name');

    assert.equal(router.isSourceOffered(configured, PACK), false, 'isSourceOffered');
    const resolved = router.resolveCalledName(`${PACK_ALIAS}__get_data`, configured);
    assert.ok(!resolved.ok && resolved.reason === 'not-offered', 'resolveCalledName refuses the pack\'s tool');
    assert.ok(router.resolveCalledName('socrata__get_data', configured).ok, 'resolveCalledName: the Socrata server\'s tool resolves');

    const all = router.manifest.map((entry) => entry.sourceId);
    for (const space of [undefined, all, [PACK], [PACK, 'socrata']]) {
      const hits = router.searchSources({ configured, query: PACK_QUERY, ...(space ? { space } : {}) }).map((hit) => hit.sourceId);
      assert.ok(!hits.includes(PACK), `the search${space ? ` over ${space.join(',')}` : ', no space'}: not a hit`);
    }
    const unlockedHits = router.searchSources({ configured: EVERY_SOURCE, query: PACK_QUERY }).map((hit) => hit.sourceId);
    assert.ok(unlockedHits.includes(PACK), 'the decoy: unlocked, the pack is a hit');

    for (const text of [router.portalLockGuidance(CHICAGO, configured), router.aliasedPortalLockGuidance(CHICAGO, configured)]) {
      assert.ok(!text.includes(PACK_MENTION), 'the lock text does not name the pack');
      assert.ok(text.includes('Data Commons'), 'the lock text names the other sources');
    }
    assert.ok(!('nyc-record' in configuredAddresses(configured)), 'configuredAddresses gives the pack no address');
  });

  test(`A6 (${name}): with no Socrata address and the lock set, the pack, required as Socrata is, is not-configured`, () => {
    const configured = locked(readMcpEnv({}), CHICAGO);
    assert.equal(router.sourcesOffered(configured).find((s) => s.sourceId === PACK)?.reason, 'not-configured');
    assert.equal(router.sourcesOffered(readMcpEnv({})).find((s) => s.sourceId === PACK)?.reason, 'configured', 'the decoy: unlocked, it is offered without an address');
  });

  test(`A6 (${name}): the lock only as portalLockGuidance's argument leaves the pack out of the lock text, and nothing else changes`, async () => {
    for (const text of [
      router.portalLockGuidance(CHICAGO, EVERY_SOURCE),
      router.aliasedPortalLockGuidance(CHICAGO, EVERY_SOURCE),
      router.withPortalLockGuidance('P', CHICAGO, EVERY_SOURCE),
      router.aliasedWithPortalLockGuidance('P', CHICAGO, EVERY_SOURCE),
    ]) {
      assert.ok(!text.includes(PACK_MENTION), 'the lock text does not name the pack');
      assert.ok(text.includes(`one Socrata portal only: ${CHICAGO}`), 'it is the lock section');
    }
    assert.ok(router.portalLockGuidance(NYC_WRITTEN_LOOSELY, EVERY_SOURCE).includes(PACK_MENTION), 'the decoy: locked to the pack\'s own portal, written loosely, the text names it');
    assert.equal(router.sourcesOffered(EVERY_SOURCE).find((s) => s.sourceId === PACK)?.reason, 'configured', 'the offer is the configuration\'s');
  });

  test(`A6 (${name}): decoys: locked to the pack's own portal (written ' Data.CityOfNewYork.us '), every output equals the unlocked instance's; with no lock, every output is unchanged`, async () => {
    const unlocked = await outputs(router, EVERY_SOURCE, 'data.cityofnewyork.us');
    assert.deepEqual(await outputs(router, locked(EVERY_SOURCE, NYC_WRITTEN_LOOSELY), 'data.cityofnewyork.us'), unlocked, 'locked to the pack\'s own portal');
    assert.deepEqual(await outputs(router, locked(EVERY_SOURCE, ''), 'data.cityofnewyork.us'), unlocked, 'an empty lock is no lock');
    assert.deepEqual(await outputs(router, { ...EVERY_SOURCE, lockedPortal: undefined }, 'data.cityofnewyork.us'), unlocked, 'an undefined lock is no lock');
    assert.ok(unlocked.portalLockGuidance!.includes(PACK_MENTION), 'unlocked, the lock text names the pack');
    assert.ok(JSON.parse(unlocked.searchSources!).some((hit: { sourceId: string }) => hit.sourceId === PACK), 'unlocked, the pack is a hit');
    const chicago = await outputs(router, locked(EVERY_SOURCE, CHICAGO), 'data.cityofnewyork.us');
    const moved = Object.keys(unlocked).filter((key) => unlocked[key] !== chicago[key]);
    assert.ok(moved.includes('sourcesOffered') && moved.includes('searchSources'), 'the comparison can fail: a lock to another portal moves the offer and the search');
  });
}

test('A6: every Socrata pack the inventory file holds keeps its offer under a lock to its own portal, and loses it under a lock to another', () => {
  const socrataId = FILE.entries.find((entry) => entry.alias === 'socrata')!.id;
  const packs = FILE.entries.filter((entry) => 'base' in entry && entry.base === socrataId) as unknown as { sourceId: string; filter: { portal: string } }[];
  assert.ok(packs.length >= 1, 'the file holds a Socrata pack');
  for (const pack of packs) {
    const reasonUnder = (portal: string) => LOADED_ROUTER.sourcesOffered(locked(EVERY_SOURCE, portal)).find((s) => s.sourceId === pack.sourceId)?.reason;
    assert.equal(reasonUnder(pack.filter.portal), 'configured', `${pack.sourceId}: locked to its own portal`);
    assert.equal(reasonUnder(pack.filter.portal.toUpperCase()), 'configured', `${pack.sourceId}: locked to its own portal, upper case`);
    assert.equal(reasonUnder(CHICAGO), 'not-configured', `${pack.sourceId}: locked to another portal`);
  }
});
