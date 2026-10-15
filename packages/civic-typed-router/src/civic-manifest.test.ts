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

test('manifest: three entries, each carrying identity, alias, configuration, schemas and guidance', () => {
  assert.deepEqual(
    CIVIC_MANIFEST.map((e) => [e.sourceId, e.alias, e.configuration.requirement]),
    [
      ['socrata', 'socrata', 'required'],
      ['data-commons', 'data_commons', 'required'],
      ['boston-opencontext', 'boston', 'optional'],
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
});

test('manifest: no two sources declare the same tool name', () => {
  assert.doesNotThrow(() => assertUniqueToolNames(CIVIC_MANIFEST));
});

test('manifest: each entry\'s address variable is the one the configuration reader reads for it', () => {
  for (const entry of CIVIC_MANIFEST) {
    const address = `https://${entry.sourceId}.example.org/mcp`;
    const read = configuredAddresses(readMcpEnv({ [entry.configuration.addressVariable]: address }));
    assert.equal(read[entry.sourceId], address, `${entry.configuration.addressVariable} configures ${entry.sourceId}`);
  }
});

test('startup checks: the civic manifest passes them, and its dispatch map holds the eleven', () => {
  assert.doesNotThrow(() => createCivicRouter(CIVIC_MANIFEST));
  assert.equal(civicRouter.dispatchMap.size, 11);
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
  const [socrata, dataCommons, boston] = CIVIC_MANIFEST;
  assert.equal(JSON.stringify(socrataTools(BARE_VIEW)), JSON.stringify(socrata!.tools));
  assert.equal(JSON.stringify(dataCommonsTools(BARE_VIEW)), JSON.stringify(dataCommons!.tools));
  assert.equal(JSON.stringify(bostonTools(BARE_VIEW)), JSON.stringify(boston!.tools));
  for (const entry of CIVIC_MANIFEST) assert.equal(JSON.stringify(entry.toolsFor!(BARE_VIEW)), JSON.stringify(entry.tools));
});

test('kept from the website: the portal table is a plain-object lookup, so a prototype key reads the prototype', () => {
  assert.equal(getSkillForPortal('data.example.org'), '');
  assert.match(getSkillForPortal('data.cityofnewyork.us'), /erm2-nwe9/);
  // Not covered by the goldens; pinned so that a change to it is a decision, not a side effect.
  assert.equal(getSkillForPortal('constructor') as unknown, Object);
});
