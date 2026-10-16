// The civic manifest's entries: what each carries, and the properties the
// goldens do not show directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertUniqueToolNames,
  CIVIC_MANIFEST,
  civicRouter,
  configuredAddresses,
  createCivicRouter,
  findDuplicateToolNames,
  getSkillForPortal,
  readMcpEnv,
  socrataTools,
  dataCommonsTools,
  bostonTools,
  BARE_VIEW,
  toolNamesMatchSchemas,
  ToolNameError,
  type CivicManifest,
} from './index.ts';

test('manifest: four entries, each carrying identity, alias, configuration, schemas and guidance', () => {
  // 0.3.0 adds NYC Charter, Laws and Rules, last; the three before it are 0.2.0's.
  assert.deepEqual(
    CIVIC_MANIFEST.map((e) => [e.sourceId, e.alias, e.configuration.requirement]),
    [
      ['socrata', 'socrata', 'required'],
      ['data-commons', 'data_commons', 'required'],
      ['boston-opencontext', 'boston', 'optional'],
      ['nyc-charter', 'nyc_charter', 'optional'],
    ],
  );
  for (const entry of CIVIC_MANIFEST) {
    assert.ok(entry.id.length > 0 && entry.displayName.length > 0, `${entry.sourceId}: id and display name`);
    assert.ok(entry.tools.length > 0, `${entry.sourceId}: tool schemas`);
    assert.equal(typeof entry.guidance.fetchText, 'function', `${entry.sourceId}: guidance entry`);
    assert.ok(toolNamesMatchSchemas(entry), `${entry.sourceId}: routing list and schemas name the same tools`);
  }
  assert.equal(CIVIC_MANIFEST[0]!.id, 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server');
  assert.equal(CIVIC_MANIFEST[1]!.configuration.defaultAddress, 'https://api.datacommons.org/mcp');
  assert.equal(CIVIC_MANIFEST[1]!.configuration.keyVariable, 'DATA_COMMONS_API_KEY');
  assert.equal(CIVIC_MANIFEST[0]!.configuration.defaultAddress, undefined, 'Socrata has no default address');
  assert.equal(CIVIC_MANIFEST[2]!.configuration.defaultAddress, undefined, 'Boston OpenContext has no default address');
  assert.equal(CIVIC_MANIFEST[3]!.configuration.defaultAddress, undefined, 'NYC Charter has no default address');
});

test('manifest: one bare name is shared, search (Socrata and NYC Charter); every exposed name is unique', () => {
  // Through 0.2.0 no two sources shared a bare name. The exposed names, the
  // router's key, are unique, and the startup checks run over them.
  assert.deepEqual(findDuplicateToolNames(CIVIC_MANIFEST), [{ tool: 'search', sourceIds: ['socrata', 'nyc-charter'] }]);
  assert.throws(() => assertUniqueToolNames(CIVIC_MANIFEST), /Duplicate tool name "search"/);
  assert.doesNotThrow(() => createCivicRouter(CIVIC_MANIFEST));
  assert.equal(new Set(civicRouter.aliasedMcpTools.map((t) => t.function.name)).size, civicRouter.aliasedMcpTools.length);
});

test('manifest: each entry\'s configuration variable is the one the configuration reader reads for it', () => {
  for (const entry of CIVIC_MANIFEST) {
    const variable = entry.configuration.addressVariable;
    if ((entry as unknown as { hosting?: unknown }).hosting !== undefined) {
      // A hosted source takes no address: its variable is a switch, and it
      // offers the source without adding an address.
      const on = readMcpEnv({ [variable]: 'sandbox' });
      assert.equal(configuredAddresses(on)[entry.sourceId], undefined, `${variable} is no address`);
      assert.equal(civicRouter.sourcesOffered(on).find((s) => s.sourceId === entry.sourceId)?.reason, 'configured', `${variable} offers ${entry.sourceId}`);
      continue;
    }
    const address = `https://${entry.sourceId}.example.org/mcp`;
    const read = configuredAddresses(readMcpEnv({ [variable]: address }));
    assert.equal(read[entry.sourceId], address, `${variable} configures ${entry.sourceId}`);
  }
});

test('startup checks: the civic manifest passes them, and its dispatch map holds the sixteen', () => {
  assert.doesNotThrow(() => createCivicRouter(CIVIC_MANIFEST));
  assert.equal(civicRouter.dispatchMap.size, 16);
  assert.deepEqual(
    [...civicRouter.dispatchMap.values()].map((t) => [t.exposedName, t.upstreamName]),
    civicRouter.mcpTools.map((t) => [`${CIVIC_MANIFEST.find((e) => e.tools.includes(t))!.alias}__${t.function.name}`, t.function.name]),
  );
});

test('startup checks: a name two sources share builds (their exposed names differ); one source declaring a name twice is refused', () => {
  const [socrata, dataCommons, boston] = CIVIC_MANIFEST;
  // Data Commons also declares `get_data`: the bare names collide, the exposed ones do not.
  const shared: CivicManifest = [socrata!, { ...dataCommons!, tools: [...dataCommons!.tools, socrata!.tools[0]!] }, boston!];
  assert.throws(() => assertUniqueToolNames(shared), 'the bare names do collide');
  assert.doesNotThrow(() => createCivicRouter(shared));
  // Data Commons declares `search_indicators` twice: refused at construction.
  const twice: CivicManifest = [socrata!, { ...dataCommons!, tools: [...dataCommons!.tools, dataCommons!.tools[0]!] }, boston!];
  assert.throws(
    () => createCivicRouter(twice),
    (err: unknown) => err instanceof ToolNameError && /both exposed as "data_commons__search_indicators"/.test(err.message),
  );
});

test('views: each civic entry\'s tools are its toolsFor in the bare view, byte for byte', () => {
  const [socrata, dataCommons, boston, charter] = CIVIC_MANIFEST;
  assert.equal(JSON.stringify(socrataTools(BARE_VIEW)), JSON.stringify(socrata!.tools));
  assert.equal(JSON.stringify(dataCommonsTools(BARE_VIEW)), JSON.stringify(dataCommons!.tools));
  assert.equal(JSON.stringify(bostonTools(BARE_VIEW)), JSON.stringify(boston!.tools));
  // NYC Charter's schemas are its server's text, not the package's: no toolsFor.
  assert.ok(charter, 'a fourth entry');
  assert.equal(charter.toolsFor, undefined);
  for (const entry of CIVIC_MANIFEST.slice(0, 3)) assert.equal(JSON.stringify(entry.toolsFor!(BARE_VIEW)), JSON.stringify(entry.tools));
});

test('kept from the website: the portal table is a plain-object lookup, so a prototype key reads the prototype', () => {
  assert.equal(getSkillForPortal('data.example.org'), '');
  assert.match(getSkillForPortal('data.cityofnewyork.us'), /erm2-nwe9/);
  // Not covered by the goldens; pinned so that a change to it is a decision, not a side effect.
  assert.equal(getSkillForPortal('constructor') as unknown, Object);
});
