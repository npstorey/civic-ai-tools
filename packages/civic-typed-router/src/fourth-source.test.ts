// A manifest beyond the three civic sources (R1's F4), the selection
// parameter through the router, and the routing fields every entry carries.
//
// Before 0.2.0 the preamble entry, the outro citation and the count word were
// looked up in maps keyed by the three civic ids, so a fourth entry composed
// "You have access to undefined MCP data sources" and "4. undefined". Each
// part now comes from the entry, or is composed from its `displayName` and
// `description`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BARE_VIEW,
  CIVIC_MANIFEST,
  civicRouter,
  createCivicRouter,
  readMcpEnv,
  type BuildSystemPromptInput,
  type CivicManifest,
  type CivicManifestEntry,
  type McpRegistryEnv,
  type SourceView,
} from './index.ts';

/** A fourth source: a stub whose `sourceId` is not one of the three. Its
 *  guidance stands in for a server's initialize instructions, so it goes
 *  through the view's treatment of text the router does not own. */
const EXAMPLE_ENTRY: CivicManifestEntry = {
  id: 'example-mcp@https://example.org/mcp',
  alias: 'example',
  sourceId: 'example',
  displayName: 'Example Records Server',
  description: 'Example records: synthetic test records for one fictional town. Cannot answer about any real place.',
  freshness: 'Static: a fixed test set.',
  configuration: { addressVariable: 'EXAMPLE_MCP_URL', requirement: 'required' },
  tools: [
    {
      type: 'function',
      function: {
        name: 'lookup_record',
        description: 'Look up one record by its id. Pair with `lookup_record` again for the next.',
        parameters: { type: 'object', properties: { id: { type: 'string', description: 'The record id `lookup_record` takes.' } } },
      },
    },
  ],
  toolNames: ['lookup_record'],
  guidance: {
    async fetchText(_ctx, view: SourceView = BARE_VIEW) {
      return view.sourceText('example', '# Example server instructions\n\nCall `lookup_record` with an id.');
    },
  },
  hostings: [{ variant: 'remote', kind: 'remote', runsAt: 'other', logging: [{ statedBy: 'instance', role: 'server-operator' }] }],
  consentDefault: 'on',
};

const FOUR: CivicManifest = [...CIVIC_MANIFEST, EXAMPLE_ENTRY];

function input(configured: McpRegistryEnv, extra: Partial<BuildSystemPromptInput> = {}): BuildSystemPromptInput {
  return {
    configured,
    today: '2026-01-15',
    publicationHost: 'records.example.org',
    fetchPrompt: async () => 'Fixture Socrata guidance.',
    fetchInstructions: async () => null,
    ...extra,
  };
}

const ALL_CONFIGURED = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org', BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp' });

/** The three hosted sources of 0.6.0, after NYC Charter: their switches are
 *  unset in every configuration here, so each is not-configured. */
const HOSTED_OF_06 = ['nyc-checkbook', 'nyc-record', 'nys-legislation'];

/** Their exposed names, in manifest order: withheld in every configuration
 *  here. */
const HOSTED_OF_06_EXPOSED = [...civicRouter.dispatchMap.values()].filter((t) => HOSTED_OF_06.includes(t.sourceId)).map((t) => t.exposedName);

// --- F4 ---------------------------------------------------------------------------------

test('F4: a four-entry manifest passes the startup checks', () => {
  assert.doesNotThrow(() => createCivicRouter(FOUR));
  assert.equal(createCivicRouter(FOUR).dispatchMap.get('example__lookup_record')?.upstreamName, 'lookup_record');
});

test('F4: the bare prompt over four entries has a count word, a preamble entry and an outro citation, and no "undefined"', async () => {
  const router = createCivicRouter(FOUR);
  const prompt = router.withPortalLockGuidance(await router.buildSystemPrompt(input(ALL_CONFIGURED)), 'data.cityofnewyork.us', ALL_CONFIGURED);
  assert.doesNotMatch(prompt, /undefined/);
  assert.match(prompt, /You have access to FOUR MCP data sources through the tools below\./);
  assert.ok(
    prompt.includes(
      '4. **Example Records Server** — Example records: synthetic test records for one fictional town. Cannot answer about any real place. Tools: lookup_record.',
    ),
    'the fourth preamble entry is composed from displayName and description',
  );
  assert.ok(prompt.includes(', or the identifiers its tools return (for Example Records Server).'), 'the outro cites the fourth source');
  assert.ok(prompt.includes('# Example server instructions'), 'the fourth block is composed');
  assert.ok(
    prompt.includes('(Data Commons, Boston OpenContext for Boston, and Example Records Server) are separate'),
    'the lock section names the fourth source among the others',
  );
});

test('F4: the aliased view over four entries names the fourth source\'s tools by their exposed names, with no "undefined"', async () => {
  const router = createCivicRouter(FOUR);
  const prompt = router.aliasedWithPortalLockGuidance(
    await router.aliasedBuildSystemPrompt(input(ALL_CONFIGURED)),
    'data.cityofnewyork.us',
    ALL_CONFIGURED,
  );
  assert.doesNotMatch(prompt, /undefined/);
  assert.match(prompt, /Tools: example__lookup_record\./);
  assert.ok(prompt.includes('Call `example__lookup_record` with an id.'), 'its server text gets the anchored rewrite');
  const tools = router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(undefined), ALL_CONFIGURED);
  const example = tools.find((t) => t.function.name === 'example__lookup_record');
  assert.ok(example, 'the fourth source\'s tool is offered under its exposed name');
  assert.doesNotMatch(JSON.stringify(tools), /undefined/);
  assert.equal(example!.function.description, 'Look up one record by its id. Pair with `example__lookup_record` again for the next.');
  assert.equal(
    (example!.function.parameters as { properties: { id: { description: string } } }).properties.id.description,
    'The record id `example__lookup_record` takes.',
  );
});

test('F4: the count word continues past three', async () => {
  const many: CivicManifest = [
    ...FOUR,
    ...['five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'].map((id) => ({ ...EXAMPLE_ENTRY, sourceId: id, alias: id, id })),
  ];
  const prompt = await createCivicRouter(many).buildSystemPrompt(input(ALL_CONFIGURED));
  assert.match(prompt, /You have access to 11 MCP data sources/);
  // The civic manifest's NYC Charter entry is not offered here (its switch is
  // off), so the last entry dropped leaves ten offered.
  const ten = await createCivicRouter(many.slice(0, -1)).buildSystemPrompt(input(ALL_CONFIGURED));
  assert.match(ten, /You have access to TEN MCP data sources/);
});

// --- The selection, through the router ------------------------------------------------------

test('selection: the default is every configured source, and its outputs are the bare ones', async () => {
  const configured = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });
  assert.deepEqual(
    civicRouter.sourcesOffered(configured).map((s) => [s.sourceId, s.alias, s.reason]),
    [
      ['socrata', 'socrata', 'configured'],
      ['data-commons', 'data_commons', 'configured'],
      ['boston-opencontext', 'boston', 'not-configured'],
      ['nyc-charter', 'nyc_charter', 'not-configured'],
      ['nyc-checkbook', 'nyc_checkbook', 'not-configured'],
      ['nyc-record', 'nyc_record', 'not-configured'],
      ['nys-legislation', 'nys_legislation', 'not-configured'],
    ],
  );
  const bare = await civicRouter.buildSystemPrompt(input(configured));
  assert.equal(await civicRouter.buildSystemPrompt(input(configured, { selection: undefined })), bare);
  // Selecting every offered source by name changes the reasons, not the bytes.
  const all = ['socrata', 'data-commons'];
  assert.equal(await civicRouter.buildSystemPrompt(input(configured, { selection: all })), bare);
  assert.deepEqual(civicRouter.sourcesOffered(configured, all).map((s) => s.reason), [
    'selected',
    'selected',
    'not-configured',
    'not-configured',
    ...HOSTED_OF_06.map(() => 'not-configured'),
  ]);
});

test('selection: a source left out of the selection is left out of the prompt, the tools and the lock section', async () => {
  const selection = ['socrata', 'data-commons'];
  assert.deepEqual(civicRouter.sourcesOffered(ALL_CONFIGURED, selection).map((s) => s.reason), [
    'selected',
    'selected',
    'not-selected',
    'not-configured',
    ...HOSTED_OF_06.map(() => 'not-configured'),
  ]);

  const prompt = await civicRouter.buildSystemPrompt(input(ALL_CONFIGURED, { selection }));
  assert.match(prompt, /You have access to TWO MCP data sources/);
  assert.doesNotMatch(prompt, /Boston OpenContext server instructions/);

  const tools = civicRouter.offeredMcpTools(civicRouter.mcpTools, ALL_CONFIGURED, selection);
  assert.deepEqual(tools.map((t) => t.function.name), ['get_data', 'search', 'fetch', 'search_indicators', 'get_observations']);
  assert.deepEqual(civicRouter.offeredSkillSources(ALL_CONFIGURED, selection), selection);
  assert.deepEqual(civicRouter.aliasedWithheldToolNames(ALL_CONFIGURED, selection), [
    'boston__ckan__search_datasets',
    'boston__ckan__get_dataset',
    'boston__ckan__query_data',
    'boston__ckan__get_schema',
    'boston__ckan__execute_sql',
    'boston__ckan__aggregate_data',
    // NYC Charter's switch is off in ALL_CONFIGURED: withheld whatever the selection.
    'nyc_charter__search',
    'nyc_charter__get_section',
    'nyc_charter__list_titles',
    'nyc_charter__get_title',
    'nyc_charter__get_version',
    // So are the three hosted sources of 0.6.0.
    ...HOSTED_OF_06_EXPOSED,
  ]);
  assert.equal(HOSTED_OF_06_EXPOSED.length, 41);
  assert.match(civicRouter.portalLockGuidance('data.cityofnewyork.us', ALL_CONFIGURED, selection), /\(Data Commons\) is separate/);

  // Not selected, the source is not offered at dispatch either.
  const resolved = civicRouter.resolveCalledName('boston__ckan__query_data', ALL_CONFIGURED, selection);
  assert.deepEqual(!resolved.ok && resolved.reason, 'not-offered');
});

test('selection: a source the configuration does not offer is not-configured whatever the selection says', async () => {
  const configured = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });
  const selection = ['socrata', 'boston-opencontext'];
  assert.deepEqual(civicRouter.sourcesOffered(configured, selection).map((s) => s.reason), [
    'selected',
    'not-selected',
    'not-configured',
    'not-configured',
    ...HOSTED_OF_06.map(() => 'not-configured'),
  ]);
  assert.deepEqual(civicRouter.offeredSkillSources(configured, selection), ['socrata']);
});

// --- The routing fields --------------------------------------------------------------------

test('fields: each civic entry carries a description and a freshness line, one line each, and a citation for the freshness', () => {
  for (const entry of CIVIC_MANIFEST) {
    for (const field of ['description', 'freshness', 'freshnessSource'] as const) {
      const value = entry[field];
      assert.ok(typeof value === 'string' && value.length > 0, `${entry.sourceId}.${field} is set`);
      assert.doesNotMatch(value!, /\n/, `${entry.sourceId}.${field} is one line`);
    }
    // Model-facing lines name no deployment and carry no citation.
    for (const field of ['description', 'freshness'] as const) {
      assert.doesNotMatch(entry[field], /https?:|\.example\.|src\//, `${entry.sourceId}.${field} carries no address or citation`);
    }
    assert.doesNotMatch(entry.freshnessSource!, /https?:/, `${entry.sourceId}.freshnessSource names no deployment address`);
  }
});

test('fields: the bare outputs do not read description or freshness', async () => {
  const blanked: CivicManifest = CIVIC_MANIFEST.map((entry) => ({ ...entry, description: 'X', freshness: 'Y', freshnessSource: 'Z' }));
  const router = createCivicRouter(blanked);
  const configured = ALL_CONFIGURED;
  assert.equal(await router.buildSystemPrompt(input(configured)), await civicRouter.buildSystemPrompt(input(configured)));
  assert.equal(JSON.stringify(router.mcpToolsFor('data.cityofnewyork.us')), JSON.stringify(civicRouter.mcpToolsFor('data.cityofnewyork.us')));
});
