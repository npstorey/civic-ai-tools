// A pack's base pins and the API groups (hub #317, S2-C P1): `checkBasePins`
// over the Socrata server's capture (A1.4), and `routesByApi` (A1.6).
//
// The capture is `src/__fixtures__/socrata-tools.json`, the server's own
// `initialize` and `tools/list` at a stated commit (`pin-socrata-tools.mjs`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { apiContains, checkBasePins, mcpToolSchemaSha256, routesByApi, type BasePin, type McpListedTool, type ObservedBase } from './index.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

interface Capture {
  _meta: { repository: string; commit: string; captureDate: string };
  initialize: { serverInfo: { name: string; version: string } };
  tools: McpListedTool[];
}

const CAPTURE: Capture = JSON.parse(readFileSync(join(FIXTURES, 'socrata-tools.json'), 'utf8'));
const tool = (name: string): McpListedTool => CAPTURE.tools.find((t) => t.name === name)!;

/** The pin the capture gives for a pack that calls get_data and fetch. */
const PIN: BasePin = {
  serverName: CAPTURE.initialize.serverInfo.name,
  serverVersion: CAPTURE.initialize.serverInfo.version,
  tools: { get_data: mcpToolSchemaSha256(tool('get_data')), fetch: mcpToolSchemaSha256(tool('fetch')) },
};

/** The capture as a consumer observes the live base. */
const observed = (change: (o: { serverName?: string; serverVersion?: string; tools: McpListedTool[] }) => void = () => {}): ObservedBase => {
  const o: { serverName?: string; serverVersion?: string; tools: McpListedTool[] } = {
    serverName: CAPTURE.initialize.serverInfo.name,
    serverVersion: CAPTURE.initialize.serverInfo.version,
    tools: structuredClone(CAPTURE.tools),
  };
  change(o);
  return o;
};

/** `tools` with the named tool's schema changed by `change`. */
const withSchema = (tools: McpListedTool[], name: string, change: (schema: { properties: Record<string, { type?: string; description?: string }> }) => void): McpListedTool[] =>
  tools.map((t) => {
    if (t.name !== name) return t;
    const copy = structuredClone(t) as McpListedTool & { inputSchema: { properties: Record<string, { type?: string }> } };
    change(copy.inputSchema);
    return copy;
  });

test('the capture is the Socrata server at a stated commit, listing get_data, search and fetch', () => {
  assert.equal(CAPTURE._meta.repository, 'https://github.com/npstorey/socrata-mcp-server');
  assert.match(CAPTURE._meta.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(CAPTURE.tools.map((t) => t.name), ['get_data', 'search', 'fetch']);
  assert.equal(CAPTURE.initialize.serverInfo.name, 'socrata-mcp-server');
});

test("A1.4: checkBasePins matches the capture's own values", () => {
  assert.deepEqual(checkBasePins([PIN], observed()), { ok: true, pin: 0 });
  // A reworded description in a called tool is not a difference.
  const reworded = observed((o) => (o.tools = withSchema(o.tools, 'get_data', (s) => (s.properties.domain!.description = 'reworded'))));
  assert.deepEqual(checkBasePins([PIN], reworded), { ok: true, pin: 0 });
});

test('A1.4: a difference names the member, the pinned value and the observed one: the name, the version, a called tool\'s schema, a called tool absent', () => {
  const differs = (o: ObservedBase) => {
    const result = checkBasePins([PIN], o);
    assert.equal(result.ok, false);
    return result.ok ? [] : result.differences;
  };
  assert.deepEqual(differs(observed((o) => (o.serverName = 'another-server'))), [{ pin: 0, member: 'serverName', pinned: PIN.serverName, observed: 'another-server' }]);
  assert.deepEqual(differs(observed((o) => (o.serverVersion = '0.9.3'))), [{ pin: 0, member: 'serverVersion', pinned: PIN.serverVersion, observed: '0.9.3' }]);
  // A version the base does not state is a difference, observed absent.
  assert.deepEqual(differs(observed((o) => delete o.serverVersion)), [{ pin: 0, member: 'serverVersion', pinned: PIN.serverVersion }]);
  const retyped = observed((o) => (o.tools = withSchema(o.tools, 'fetch', (s) => (s.properties.id!.type = 'number'))));
  assert.deepEqual(differs(retyped), [{ pin: 0, member: 'tools.fetch', pinned: PIN.tools.fetch, observed: mcpToolSchemaSha256(retyped.tools.find((t) => t.name === 'fetch')!) }]);
  assert.notEqual(mcpToolSchemaSha256(retyped.tools.find((t) => t.name === 'fetch')!), PIN.tools.fetch);
  assert.deepEqual(differs(observed((o) => (o.tools = o.tools.filter((t) => t.name !== 'get_data')))), [{ pin: 0, member: 'tools.get_data', pinned: PIN.tools.get_data }]);
  assert.deepEqual(differs(observed((o) => o.tools.push(structuredClone(tool('fetch'))))), [{ pin: 0, member: 'tools.fetch', pinned: PIN.tools.fetch, observed: 'listed 2 times' }]);
});

test('A1.4: with two pins, an observation equal to the second matches it; one equal to neither names each pin\'s first difference', () => {
  const next: BasePin = { ...PIN, serverVersion: '0.9.3' };
  assert.deepEqual(checkBasePins([PIN, next], observed((o) => (o.serverVersion = '0.9.3'))), { ok: true, pin: 1 });
  assert.deepEqual(checkBasePins([PIN, next], observed()), { ok: true, pin: 0 });
  assert.deepEqual(checkBasePins([PIN, next], observed((o) => (o.serverVersion = '1.0.0'))), {
    ok: false,
    differences: [
      { pin: 0, member: 'serverVersion', pinned: '0.9.2', observed: '1.0.0' },
      { pin: 1, member: 'serverVersion', pinned: '0.9.3', observed: '1.0.0' },
    ],
  });
});

test('A1.4: a change to search, which the pack does not call, still matches; so does a tool the base adds', () => {
  const search = observed((o) => (o.tools = withSchema(o.tools, 'search', (s) => (s.properties.query!.type = 'number'))));
  assert.notEqual(mcpToolSchemaSha256(search.tools.find((t) => t.name === 'search')!), mcpToolSchemaSha256(tool('search')));
  assert.deepEqual(checkBasePins([PIN], search), { ok: true, pin: 0 });
  assert.deepEqual(checkBasePins([PIN], observed((o) => o.tools.push({ name: 'a_new_tool', inputSchema: { type: 'object' } }))), { ok: true, pin: 0 });
  assert.deepEqual(checkBasePins([PIN], observed((o) => (o.tools = o.tools.filter((t) => t.name !== 'search')))), { ok: true, pin: 0 });
});

test('checkBasePins refuses an empty list of pins', () => {
  assert.throws(() => checkBasePins([], observed()), TypeError);
});

// --- A1.6: routesByApi --------------------------------------------------------------

const entry = (sourceId: string, api: unknown) => ({ sourceId, alias: sourceId.replace(/-/g, '_'), api });

test('A1.6: two entries stating the same { ckan, data.boston.gov } are one group; an entry of another platform or host is left alone', () => {
  const groups = routesByApi({
    entries: [
      entry('boston-opencontext', { platform: 'ckan', host: 'data.boston.gov' }),
      entry('nyc-charter', { platform: 'bundled-data' }),
      entry('boston-pack', { platform: 'ckan', host: 'data.boston.gov' }),
      entry('other-ckan', { platform: 'ckan', host: 'data.example.org' }),
    ],
  });
  assert.deepEqual(groups, [{ api: { platform: 'ckan', host: 'data.boston.gov' }, sourceIds: ['boston-opencontext', 'boston-pack'] }]);
});

test('A1.6: a server of a platform with no host contains a pack of one dataset on it; two packs of different datasets are not one route but both sit in their platform\'s group', () => {
  const groups = routesByApi({
    entries: [
      entry('socrata', { platform: 'socrata' }),
      entry('data-commons', { platform: 'data-commons', host: 'api.datacommons.org' }),
      entry('pack-a', { platform: 'socrata', host: 'data.cityofnewyork.us', dataset: 'aaaa-1111' }),
      entry('pack-b', { platform: 'socrata', host: 'data.cityofnewyork.us', dataset: 'bbbb-2222' }),
    ],
  });
  assert.deepEqual(groups, [{ api: { platform: 'socrata' }, sourceIds: ['socrata', 'pack-a', 'pack-b'] }]);
  assert.equal(apiContains({ platform: 'socrata', host: 'h', dataset: 'a' }, { platform: 'socrata', host: 'h', dataset: 'b' }), false);
  assert.equal(apiContains({ platform: 'socrata', host: 'h' }, { platform: 'socrata' }), false, 'a host does not contain the whole platform');
});

test('routesByApi refuses an entry with no api, or a dataset with no host, naming the entry', () => {
  assert.throws(() => routesByApi({ entries: [entry('socrata', undefined)] }), /routesByApi: socrata: api: /);
  assert.throws(() => routesByApi({ entries: [entry('x', { platform: 'socrata', dataset: 'd' })] }), /routesByApi: x: api\.dataset: /);
  assert.throws(() => routesByApi({ entries: [entry('x', { platform: '' })] }), /routesByApi: x: api: /);
});
