// The three hosted sources of 0.6.0 (R8 H3): NYC Checkbook, NYC City Record
// and NYS Open Legislation, each a publisher's MCP server the instance runs
// from a pinned package, after NYC Charter, Laws and Rules.
//
//   - each entry: its schemas are its committed capture's, its routing list
//     the server's order, its `id` the package name and repository address;
//     the capture records the registry's `gitHead`, which is the variant's
//     `commit`;
//   - the startup checks pass with all seven entries, and a bare `search`
//     (Socrata's, Charter's and NYS Open Legislation's) is refused as
//     ambiguous when two of them are offered;
//   - the switches: each on only at exactly `sandbox` after trimming, its key
//     in the configuration and its source configured only then; with the
//     three unset every offered output is the four-entry manifest's;
//   - the variants and the postures: the sandbox platform stated by the
//     instance, then the upstream holder stated by the manifest, with its
//     statement's address and the date it was read; `keyIn` on NYS Open
//     Legislation's variant only;
//   - the directory lines, written for routing.
//
// Read through the package entry and the manifest, by source id, as plain
// records, so the file names nothing the entry modules export.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BLOCK_SEPARATOR,
  CIVIC_MANIFEST,
  checkToolNames,
  civicRouter,
  configuredAddresses,
  configuredSources,
  createCivicRouter,
  findToolNameProblems,
  readMcpEnv,
  toolNamesMatchSchemas,
  type BuildSystemPromptInput,
  type CivicManifest,
  type CivicManifestEntry,
  type FunctionToolSchema,
  type McpRegistryEnv,
} from './index.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

/** The UTC date this phase read each statement the three entries cite. */
const READ_ON = '2026-10-19';

/** What each server is, as this phase measured it at its pin. */
interface Server {
  sourceId: string;
  alias: string;
  name: string;
  package: string;
  version: string;
  /** The registry's `gitHead` for the version, read 2026-10-19. */
  gitHead: string;
  repository: string;
  switchVariable: string;
  /** `readMcpEnv`'s key for the switch. */
  key: string;
  outbound: string[];
  toolCount: number;
  consentDefault: 'on' | 'ask-first';
  serverInfo: { name: string; version: string };
  environment: Record<string, string>;
  holder: string;
  statementUrl: string;
  keyIn?: 'query';
}

const SERVERS: Server[] = [
  {
    sourceId: 'nyc-checkbook',
    alias: 'nyc_checkbook',
    name: 'nyc-checkbook',
    package: '@betanyc/nyc-checkbook-mcp',
    version: '1.6.3',
    // One commit behind the repository's head: the pin is the registry's.
    gitHead: 'f013a276e37e218e93c069c585d54dc3b4e3ee00',
    repository: 'https://github.com/BetaNYC/nyc-checkbook-mcp',
    switchVariable: 'NYC_CHECKBOOK_HOSTING',
    key: 'nycCheckbookHosting',
    outbound: ['www.checkbooknyc.com'],
    toolCount: 10,
    consentDefault: 'ask-first',
    serverInfo: { name: 'nyc-checkbook-mcp', version: '1.6.3' },
    environment: {},
    holder: 'Office of the New York City Comptroller',
    statementUrl: 'https://comptroller.nyc.gov/privacy-policy/',
  },
  {
    sourceId: 'nyc-record',
    alias: 'nyc_record',
    name: 'nyc-record',
    package: '@betanyc/nyc-record-mcp',
    version: '1.1.0',
    gitHead: '6c52a5353381592713678caa109870d1e912c858',
    repository: 'https://github.com/BetaNYC/nyc-record-mcp',
    switchVariable: 'NYC_RECORD_HOSTING',
    key: 'nycRecordHosting',
    outbound: ['data.cityofnewyork.us'],
    toolCount: 7,
    consentDefault: 'on',
    serverInfo: { name: 'nyc-record-mcp', version: '1.1.0' },
    environment: {},
    holder: 'City of New York',
    statementUrl: 'https://www.nyc.gov/home/privacy-policy.page',
  },
  {
    sourceId: 'nys-legislation',
    alias: 'nys_legislation',
    name: 'nys-legislation',
    package: '@betanyc/nys-openlegislation-mcp',
    version: '2.4.0',
    gitHead: 'cc069c46d52b939275f9dcac3d72b2dd011531d3',
    repository: 'https://github.com/BetaNYC/nys-openlegislation-mcp',
    switchVariable: 'NYS_LEGISLATION_HOSTING',
    key: 'nysLegislationHosting',
    outbound: ['legislation.nysenate.gov'],
    toolCount: 24,
    consentDefault: 'ask-first',
    // The server reports 2.3.0 in `initialize` (its `src/index.ts`); the
    // package is 2.4.0.
    serverInfo: { name: 'nys-openlegislation-mcp', version: '2.3.0' },
    // A placeholder, so the server starts: it is not a key.
    environment: { NYS_LEGISLATION_API_KEY: 'placeholder-not-a-key' },
    holder: 'New York State Senate',
    statementUrl: 'https://www.nysenate.gov/privacy-policy',
    keyIn: 'query',
  },
];

interface Capture {
  _meta: {
    package: string;
    version: string;
    gitHead: string;
    integrity: string;
    repository: string;
    captureDate: string;
    script: { path: string; sha256: string };
    resolved: Record<string, string>;
    environment: Record<string, string>;
    requests: string[];
  };
  initialize: { serverInfo: { name: string; version: string }; instructions: string | null; capabilities: Record<string, unknown> };
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
}

const fixtureText = (server: Server): string => readFileSync(join(FIXTURES, `${server.name}-tools.json`), 'utf8');
const capture = (server: Server): Capture => JSON.parse(fixtureText(server));

/** The capture's tools as the function tools a manifest entry carries. */
const captureTools = (server: Server): FunctionToolSchema[] =>
  capture(server).tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }));

function entryOf(server: Server): CivicManifestEntry {
  const entry = CIVIC_MANIFEST.find((candidate) => candidate.sourceId === server.sourceId);
  assert.ok(entry, `the civic manifest holds a ${server.sourceId} entry`);
  return entry;
}

/** The entry's variants, as plain records. */
const variantsOf = (entry: CivicManifestEntry): readonly Record<string, unknown>[] =>
  (entry as unknown as { hostings?: readonly Record<string, unknown>[] }).hostings ?? [];

const SOCRATA = 'https://socrata-mcp.example.org';
const BOSTON = 'https://boston-mcp.example.org/mcp';

/** 0.5.0's configuration keys, in order. */
const BASE_KEYS = ['socrataUrl', 'dataCommonsUrl', 'dataCommonsApiKey', 'bostonOpencontextUrl'];

/** Every source on: both optional addresses and all four switches. */
const EVERY_SOURCE_ENV = {
  SOCRATA_MCP_URL: SOCRATA,
  BOSTON_OPENCONTEXT_MCP_URL: BOSTON,
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYC_RECORD_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
};

// --- Criterion 1: the entries -------------------------------------------------------------

test('hosted entries: the manifest holds seven entries, the three of 0.6.0 after NYC Charter in D7\'s order', () => {
  assert.deepEqual(
    CIVIC_MANIFEST.map((entry) => entry.sourceId),
    ['socrata', 'data-commons', 'boston-opencontext', 'nyc-charter', 'nyc-checkbook', 'nyc-record', 'nys-legislation'],
  );
  assert.deepEqual(
    CIVIC_MANIFEST.slice(4).map((entry) => [entry.alias, entry.displayName, entry.configuration.requirement]),
    [
      ['nyc_checkbook', 'NYC Checkbook MCP Server', 'optional'],
      ['nyc_record', 'NYC City Record MCP Server', 'optional'],
      ['nys_legislation', 'NYS Open Legislation MCP Server', 'optional'],
    ],
  );
});

for (const server of SERVERS) {
  test(`${server.sourceId} entry: its schemas are its committed capture's, as function tools, byte for byte, and its routing list is the server's order`, () => {
    const entry = entryOf(server);
    const tools = captureTools(server);
    assert.equal(tools.length, server.toolCount, `the capture lists ${server.toolCount} tools`);
    assert.deepEqual(entry.tools, tools);
    assert.equal(JSON.stringify(entry.tools), JSON.stringify(tools), 'and in the same key order');
    assert.deepEqual(entry.toolNames, capture(server).tools.map((t) => t.name), 'the routing list is in the server\'s order');
    assert.ok(toolNamesMatchSchemas(entry), 'the routing list and the schemas name the same tools');
    assert.equal(entry.toolsFor, undefined, 'the server owns the text: the aliased view rewrites it, anchored');
  });

  test(`${server.sourceId} capture: it records the pinned version, the registry's gitHead (the variant's commit), the date, the environment and its script`, () => {
    const meta = capture(server)._meta;
    assert.equal(meta.package, server.package);
    assert.equal(meta.version, server.version);
    assert.equal(meta.gitHead, server.gitHead, 'the registry\'s gitHead for the version');
    assert.equal(meta.repository, `git+${server.repository}.git`);
    assert.match(meta.integrity, /^sha512-/);
    assert.match(meta.captureDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(Object.keys(meta.resolved).sort(), ['@modelcontextprotocol/sdk', 'zod']);
    for (const version of Object.values(meta.resolved)) assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(meta.environment, server.environment, 'the server\'s environment: empty, or the one placeholder');
    assert.deepEqual(meta.requests, ['initialize', 'notifications/initialized', 'tools/list'], 'no tool was called');
    const script = `pin-${server.name}-tools.mjs`;
    assert.equal(meta.script.path, `packages/civic-typed-router/src/__fixtures__/${script}`);
    assert.equal(meta.script.sha256, createHash('sha256').update(readFileSync(join(FIXTURES, script))).digest('hex'), 'captured by the committed script');
    const { initialize } = capture(server);
    assert.deepEqual(initialize.serverInfo, server.serverInfo);
    assert.equal(initialize.instructions, null, 'the server sends no instructions');
    // The variant pins the same commit, in full.
    const [variant] = variantsOf(entryOf(server));
    assert.equal(variant?.commit, meta.gitHead);
    assert.match(String(variant?.commit), /^[0-9a-f]{40}$/);
  });

  test(`${server.sourceId} capture: the file holds no run of thirteen or more digits outside a full commit id or digest, and parses to the server's text`, () => {
    const text = fixtureText(server);
    const masked = text.replace(/(?<![0-9A-Za-z])[0-9a-f]{40}(?:[0-9a-f]{24})?(?![0-9A-Za-z])/g, (hex) => (/[a-f]/.test(hex) ? 'x' : hex));
    assert.doesNotMatch(masked, /\d{13}/);
    assert.doesNotThrow(() => JSON.parse(text));
  });

  test(`${server.sourceId} entry: its id is the package name and repository address (not listed in the MCP Registry), and its switch is its configuration variable`, () => {
    const entry = entryOf(server);
    assert.equal(entry.id, `${server.package}@${server.repository}`);
    assert.deepEqual([entry.alias, entry.configuration.addressVariable, entry.configuration.requirement], [server.alias, server.switchVariable, 'optional']);
    assert.equal(entry.configuration.defaultAddress, undefined, 'no default address');
    assert.equal(entry.configuration.keyVariable, undefined, 'no key variable: the key mechanism is the consumer\'s');
    assert.equal((entry as unknown as { publisher?: string }).publisher, 'BetaNYC');
  });

  test(`${server.sourceId} entry: its guidance returns "" and calls neither fetcher`, async () => {
    const calls: string[] = [];
    const text = await entryOf(server).guidance.fetchText({
      publicationHost: null,
      fetchPrompt: async (name) => {
        calls.push(name);
        return 'x';
      },
      fetchInstructions: async (sourceId) => {
        calls.push(sourceId);
        return 'x';
      },
    });
    assert.equal(text, '');
    assert.deepEqual(calls, []);
  });
}

test('startup checks: all seven entries pass (no reserved name, no collision after normalizing), and no exposed name needed normalizing', () => {
  assert.doesNotThrow(() => checkToolNames(CIVIC_MANIFEST));
  assert.deepEqual(findToolNameProblems(CIVIC_MANIFEST), []);
  assert.doesNotThrow(() => createCivicRouter(CIVIC_MANIFEST));
  for (const server of SERVERS) {
    const exposed = [...civicRouter.dispatchMap.values()].filter((t) => t.sourceId === server.sourceId);
    assert.deepEqual(exposed.map((t) => t.upstreamName), entryOf(server).toolNames);
    assert.deepEqual(exposed.map((t) => t.exposedName), entryOf(server).toolNames.map((name) => `${server.alias}__${name}`));
    assert.ok(exposed.every((t) => !t.normalized), `${server.sourceId}: no name needed normalizing`);
  }
  assert.equal(new Set(civicRouter.aliasedMcpTools.map((t) => t.function.name)).size, civicRouter.aliasedMcpTools.length);
});

test('dispatch: NYS Open Legislation\'s search is nys_legislation__search; a bare search is refused as ambiguous when it and another search are offered', () => {
  assert.equal(civicRouter.sourceForAliasedName('nys_legislation__search')?.sourceId, 'nys-legislation');
  assert.equal(civicRouter.sourceIdForToolName('search'), 'socrata', 'the index keeps the first declarer');
  const env = (extra: Record<string, string>): McpRegistryEnv => readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, ...extra });
  const off = civicRouter.resolveCalledName('search', env({}));
  assert.deepEqual(off.ok && off.exposedName, 'socrata__search');
  const legislation = civicRouter.resolveCalledName('search', env({ NYS_LEGISLATION_HOSTING: 'sandbox' }));
  assert.deepEqual(!legislation.ok && [legislation.reason, legislation.candidates], ['ambiguous', ['socrata__search', 'nys_legislation__search']]);
  const all = civicRouter.resolveCalledName('search', readMcpEnv(EVERY_SOURCE_ENV));
  assert.deepEqual(!all.ok && [all.reason, all.candidates], ['ambiguous', ['socrata__search', 'nyc_charter__search', 'nys_legislation__search']]);
  const exposed = civicRouter.resolveCalledName('nys_legislation__search', env({ NYS_LEGISLATION_HOSTING: 'sandbox' }));
  assert.deepEqual(exposed.ok && [exposed.spelling, exposed.sourceId, exposed.upstreamName], ['aliased', 'nys-legislation', 'search']);
  const withheld = civicRouter.resolveCalledName('nys_legislation__search', env({}));
  assert.deepEqual(!withheld.ok && withheld.reason, 'not-offered');
});

// --- Criterion 2: the switches ------------------------------------------------------------

test('switches: each reads on only for "sandbox" after trimming, its key after 0.5.0\'s, the literal "sandbox"', () => {
  const cases: Array<[string, string | undefined, boolean]> = [
    ['unset', undefined, false],
    ['empty', '', false],
    ['blank', '  ', false],
    ['another case', 'Sandbox', false],
    ['on', 'on', false],
    ['another value', 'hosted', false],
    ['padded', ' sandbox ', true],
    ['exact', 'sandbox', true],
  ];
  for (const server of SERVERS) {
    for (const [name, value, on] of cases) {
      const configured = readMcpEnv(value === undefined ? {} : { [server.switchVariable]: value });
      const read = configured as unknown as Record<string, unknown>;
      const at = `${server.switchVariable} ${name}`;
      if (on) {
        assert.deepEqual(Object.keys(read), [...BASE_KEYS, server.key], `${at}: the key follows the four`);
        assert.equal(read[server.key], 'sandbox', `${at}: the literal, not the raw value`);
        assert.deepEqual(configuredSources(configured)[server.sourceId], 'sandbox', `${at}: configured`);
      } else {
        assert.deepEqual(Object.keys(read), BASE_KEYS, `${at}: the key is absent, so the reading is 0.5.0's`);
        assert.equal(Object.hasOwn(configuredSources(configured), server.sourceId), false, `${at}: not configured`);
      }
      // Never an address.
      assert.equal(Object.hasOwn(configuredAddresses(configured), server.sourceId), false, `${at}: no address`);
      const reason = civicRouter.sourcesOffered(configured).find((s) => s.sourceId === server.sourceId)?.reason;
      assert.equal(reason, on ? 'configured' : 'not-configured', `${at}: offered reason`);
    }
  }
});

test('switches: all four on read in manifest order after 0.5.0\'s keys; all three of 0.6.0 unset read 0.5.0\'s keys exactly', () => {
  const all = readMcpEnv(EVERY_SOURCE_ENV);
  assert.deepEqual(Object.keys(all), [...BASE_KEYS, 'nycCharterHosting', 'nycCheckbookHosting', 'nycRecordHosting', 'nysLegislationHosting']);
  assert.deepEqual(Object.keys(configuredSources(all)), [
    'socrata',
    'data-commons',
    'boston-opencontext',
    'nyc-charter',
    'nyc-checkbook',
    'nyc-record',
    'nys-legislation',
  ]);
  for (const env of [{}, { SOCRATA_MCP_URL: SOCRATA }, { NYC_CHARTER_HOSTING: 'sandbox' }]) {
    const read = readMcpEnv(env);
    const keys = Object.keys(read);
    assert.deepEqual(keys, [...BASE_KEYS, ...('NYC_CHARTER_HOSTING' in env ? ['nycCharterHosting'] : [])], `0.5.0's keys for ${JSON.stringify(env)}`);
  }
  assert.deepEqual(civicRouter.offeredSkillSources(all), ['socrata', 'data-commons', 'boston-opencontext', 'nyc-charter', 'nyc-checkbook', 'nyc-record', 'nys-legislation']);
});

/** Fetchers that log each call. */
function recording(configured: McpRegistryEnv, extra: Partial<BuildSystemPromptInput> = {}) {
  const calls: string[] = [];
  const input: BuildSystemPromptInput = {
    configured,
    today: '2026-01-15',
    publicationHost: 'records.example.org',
    fetchPrompt: async (name) => {
      calls.push(`prompt:${name}`);
      return 'Fixture Socrata guidance.';
    },
    fetchInstructions: async (sourceId) => {
      calls.push(`instructions:${sourceId}`);
      return `Fixture ${sourceId} instructions.`;
    },
    ...extra,
  };
  return { calls, input };
}

test('switches unset: every offered output is the four-entry manifest\'s, byte for byte', async () => {
  const four = createCivicRouter(CIVIC_MANIFEST.slice(0, 4) as CivicManifest);
  const envs = [
    {},
    { SOCRATA_MCP_URL: SOCRATA },
    { SOCRATA_MCP_URL: SOCRATA, BOSTON_OPENCONTEXT_MCP_URL: BOSTON },
    { SOCRATA_MCP_URL: SOCRATA, BOSTON_OPENCONTEXT_MCP_URL: BOSTON, NYC_CHARTER_HOSTING: 'sandbox' },
    // A switch at a value that is not `sandbox` is off.
    { SOCRATA_MCP_URL: SOCRATA, NYC_CHECKBOOK_HOSTING: 'Sandbox', NYC_RECORD_HOSTING: 'on', NYS_LEGISLATION_HOSTING: ' ' },
  ];
  for (const env of envs) {
    const configured = readMcpEnv(env);
    const at = JSON.stringify(env);
    for (const selection of [undefined, ['socrata', 'nyc-charter']]) {
      const a = recording(configured, { selection });
      const b = recording(configured, { selection });
      assert.equal(await civicRouter.buildSystemPrompt(a.input), await four.buildSystemPrompt(b.input), `${at}: bare prompt`);
      assert.equal(await civicRouter.aliasedBuildSystemPrompt(a.input), await four.aliasedBuildSystemPrompt(b.input), `${at}: aliased prompt`);
      assert.deepEqual(a.calls, b.calls, `${at}: fetcher calls`);
      assert.equal(
        civicRouter.withPortalLockGuidance('P', 'data.cityofnewyork.us', configured, selection),
        four.withPortalLockGuidance('P', 'data.cityofnewyork.us', configured, selection),
        `${at}: lock section`,
      );
      assert.equal(
        civicRouter.aliasedWithPortalLockGuidance('P', 'data.cityofnewyork.us', configured, selection),
        four.aliasedWithPortalLockGuidance('P', 'data.cityofnewyork.us', configured, selection),
        `${at}: aliased lock section`,
      );
      assert.equal(
        JSON.stringify(civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor('data.cityofnewyork.us'), configured, selection)),
        JSON.stringify(four.aliasedOfferedMcpTools(four.aliasedMcpToolsFor('data.cityofnewyork.us'), configured, selection)),
        `${at}: aliased offered tools`,
      );
      assert.equal(
        JSON.stringify(civicRouter.offeredMcpTools(civicRouter.mcpToolsFor(undefined), configured, selection)),
        JSON.stringify(four.offeredMcpTools(four.mcpToolsFor(undefined), configured, selection)),
        `${at}: bare offered tools`,
      );
      assert.deepEqual(civicRouter.offeredSkillSources(configured, selection), four.offeredSkillSources(configured, selection), `${at}: offered sources`);
      assert.equal(civicRouter.directoryPrompt(a.input), four.directoryPrompt(b.input), `${at}: directory`);
      assert.deepEqual(civicRouter.aliasedLoadSourceTool({ configured, selection }), four.aliasedLoadSourceTool({ configured, selection }), `${at}: load_source`);
      for (const loaded of [['socrata'], ['socrata', 'nyc-charter', 'nys-legislation']]) {
        assert.equal(
          await civicRouter.aliasedInLoopSystemPrompt({ ...a.input, loaded }),
          await four.aliasedInLoopSystemPrompt({ ...b.input, loaded }),
          `${at}: in-loop prompt, loaded ${loaded.join(', ')}`,
        );
      }
      const components = [{ id: 'a-component', version: '1' }];
      assert.deepEqual(
        civicRouter.harnessDefinition({ configured, selection, chosenBy: 'instance', components }),
        four.harnessDefinition({ configured, selection, chosenBy: 'instance', components }),
        `${at}: harness definition`,
      );
      for (const name of ['search', 'socrata__search', 'nyc_charter__get_section', 'get_bill']) {
        assert.deepEqual(civicRouter.resolveCalledName(name, configured, selection).ok, four.resolveCalledName(name, configured, selection).ok, `${at}: ${name}`);
      }
    }
  }
});

test('switch on: a hosted source adds its preamble entry, the count word and its citation, and no block; its tools are appended in its order', async () => {
  const base = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA });
  for (const server of SERVERS) {
    const entry = entryOf(server);
    const on = readMcpEnv({ SOCRATA_MCP_URL: SOCRATA, [server.switchVariable]: 'sandbox' });
    const off = recording(base);
    const set = recording(on);
    const unsetPrompt = await civicRouter.aliasedBuildSystemPrompt(off.input);
    const setPrompt = await civicRouter.aliasedBuildSystemPrompt(set.input);
    const exposed = entry.toolNames.map((name) => `${server.alias}__${name}`);
    assert.match(unsetPrompt, /You have access to TWO MCP data sources/);
    assert.match(setPrompt, /You have access to THREE MCP data sources/);
    assert.ok(setPrompt.includes(`\n3. **${entry.displayName}** — ${entry.description} Tools: ${exposed.join(', ')}.\n`), `${server.sourceId}: its preamble entry`);
    assert.ok(setPrompt.includes(`, or ${entry.prompt!.citation}.`), `${server.sourceId}: its citation closes the outro`);
    assert.deepEqual(set.calls, off.calls, `${server.sourceId}: no fetch for it`);
    assert.equal(setPrompt.split(BLOCK_SEPARATOR).length, unsetPrompt.split(BLOCK_SEPARATOR).length, `${server.sourceId}: no block`);
    const tools = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpTools, on);
    const before = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpTools, base);
    assert.deepEqual(tools.map((t) => t.function.name), [...before.map((t) => t.function.name), ...exposed]);
    assert.deepEqual(tools.slice(before.length).map((t) => t.function.parameters), entry.tools.map((t) => t.function.parameters));
    // The lock section names it among the other sources.
    assert.match(civicRouter.aliasedPortalLockGuidance('data.cityofnewyork.us', on), new RegExp(`\\(Data Commons, and ${entry.prompt!.lockMention}\\) are separate`));
  }
});

test('in-loop: loading a hosted source composes its preamble entry and citation and fetches nothing for it', async () => {
  const configured = readMcpEnv(EVERY_SOURCE_ENV);
  for (const server of SERVERS) {
    const { input, calls } = recording(configured);
    const prompt = await civicRouter.aliasedInLoopSystemPrompt({ ...input, loaded: [server.sourceId] });
    const composed = prompt.split(BLOCK_SEPARATOR).slice(1).join(BLOCK_SEPARATOR);
    assert.match(composed, /You have access to ONE MCP data sources/);
    assert.ok(composed.includes(`1. **${entryOf(server).displayName}** —`), `${server.sourceId}: composed`);
    assert.deepEqual(calls, [], `${server.sourceId}: nothing fetched`);
  }
});

// --- Criterion 3: the variants and the postures ---------------------------------------------

for (const server of SERVERS) {
  test(`${server.sourceId} variant: one npm-package variant, sandbox, in the instance's sandbox, with its pin, its one outbound host, ${server.keyIn ? 'keyIn query' : 'no keyIn'}, and its two holders`, () => {
    const entry = entryOf(server);
    const variants = variantsOf(entry);
    assert.equal(variants.length, 1);
    assert.deepEqual(variants[0], {
      kind: 'npm-package',
      package: server.package,
      version: server.version,
      commit: server.gitHead,
      outbound: server.outbound,
      variant: 'sandbox',
      runsAt: 'instance-sandbox',
      ...(server.keyIn ? { keyIn: server.keyIn } : {}),
      logging: [
        { statedBy: 'instance', role: 'sandbox-platform' },
        { statedBy: 'manifest', holder: server.holder, keeps: 'not-stated', statementUrl: server.statementUrl, readOn: READ_ON },
      ],
    });
    assert.equal(Object.hasOwn(variants[0]!, 'keyIn'), server.keyIn !== undefined, 'keyIn only where the key travels');
    assert.equal((entry as unknown as { consentDefault: string }).consentDefault, server.consentDefault, 'D7b = A');
    // The switch's value names the variant that is on.
    assert.equal(configuredSources(readMcpEnv({ [server.switchVariable]: ' sandbox ' }))[server.sourceId], variants[0]!.variant);
  });
}

test('record names: each variant gives a purl and a component version as NYC Charter\'s does (scope and name each encoded; the version, then 12 hex characters of the commit)', () => {
  const derived = SERVERS.map((server) => {
    const [variant] = variantsOf(entryOf(server));
    const pkg = String(variant!.package);
    const version = String(variant!.version);
    return [
      `pkg:npm/${pkg.split('/').map(encodeURIComponent).join('/')}@${version}`,
      `${version}+${String(variant!.commit).slice(0, 12)}`,
    ];
  });
  assert.deepEqual(derived, [
    ['pkg:npm/%40betanyc/nyc-checkbook-mcp@1.6.3', '1.6.3+f013a276e37e'],
    ['pkg:npm/%40betanyc/nyc-record-mcp@1.1.0', '1.1.0+6c52a5353381'],
    ['pkg:npm/%40betanyc/nys-openlegislation-mcp@2.4.0', '2.4.0+cc069c46d52b'],
  ]);
});

test('postures: every stated row of the three has an https statement address read on this phase\'s date and keeps not-stated; the first row of each is the sandbox platform, stated by the instance', () => {
  for (const server of SERVERS) {
    const [variant] = variantsOf(entryOf(server));
    const logging = variant!.logging as readonly Record<string, unknown>[];
    assert.deepEqual(logging[0], { statedBy: 'instance', role: 'sandbox-platform' }, `${server.sourceId}: the sandbox platform first`);
    const stated = logging.filter((row) => row.statedBy === 'manifest');
    assert.equal(stated.length, 1, `${server.sourceId}: one stated row`);
    for (const row of stated) {
      assert.equal(new URL(String(row.statementUrl)).protocol, 'https:', `${server.sourceId}: https`);
      assert.equal(row.readOn, READ_ON, `${server.sourceId}: read on this phase's date`);
      // None of the three statements names the API host it would cover.
      assert.equal(row.keeps, 'not-stated', `${server.sourceId}: the statement read says nothing of API requests`);
      assert.equal(Object.hasOwn(row, 'retention'), false, `${server.sourceId}: no retention, since none is stated`);
      assert.equal(typeof row.holder, 'string');
    }
  }
  // keyIn: only NYS Open Legislation's variant, and as `query`.
  const keyIns = CIVIC_MANIFEST.flatMap((entry) => variantsOf(entry).filter((v) => Object.hasOwn(v, 'keyIn')).map((v) => [entry.sourceId, v.keyIn]));
  assert.deepEqual(keyIns, [['nys-legislation', 'query']]);
});

// --- Criterion 4: the directory lines ------------------------------------------------------

test('directory: over all seven switched on it lists seven lines in D7\'s order', () => {
  const directory = civicRouter.directoryPrompt({ configured: readMcpEnv(EVERY_SOURCE_ENV), today: '2026-01-15' });
  const lines = directory.split('\n').filter((line) => line.startsWith('- `'));
  assert.deepEqual(
    lines.map((line) => line.split('`')[1]),
    ['socrata', 'data_commons', 'boston', 'nyc_charter', 'nyc_checkbook', 'nyc_record', 'nys_legislation'],
  );
  for (const server of SERVERS) {
    const entry = entryOf(server);
    assert.ok(lines.includes(`- \`${server.alias}\`: ${entry.description} Freshness: ${entry.freshness}`), `${server.sourceId}: its line`);
  }
});

test('directory lines: each new description says what the source covers and what it cannot do, with no tool name, no backtick and no load_source; each freshness is one model-facing line with its source', () => {
  const upstream = new Set([...civicRouter.dispatchMap.values()].map((t) => t.upstreamName));
  for (const server of SERVERS) {
    const entry = entryOf(server);
    for (const [field, value] of [
      ['description', entry.description],
      ['freshness', entry.freshness],
    ] as const) {
      assert.doesNotMatch(value, /\n/, `${server.sourceId}.${field} is one line`);
      assert.doesNotMatch(value, /`/, `${server.sourceId}.${field} holds no backtick`);
      assert.doesNotMatch(value, /load_source/, `${server.sourceId}.${field} names no load_source`);
      assert.doesNotMatch(value, /https?:|github\.com|src\//, `${server.sourceId}.${field} carries no address or citation`);
      for (const name of upstream) {
        if (name.includes('_')) assert.ok(!value.includes(name), `${server.sourceId}.${field} names the tool ${name}`);
      }
    }
    assert.match(entry.description, /Covers New York (City|State) only\./, `${server.sourceId}: its place`);
    assert.match(entry.description, /Does not hold [^.]+\.$/, `${server.sourceId}: what it cannot do, last`);
    assert.match(entry.freshness, /^Live: /, `${server.sourceId}: live on every call`);
    const source = entry.freshnessSource ?? '';
    assert.ok(source.includes(`version ${server.version}`), `${server.sourceId}: the freshness source is at the pin`);
    assert.ok(source.includes(server.repository.replace('https://', '')), `${server.sourceId}: the freshness source names the publisher's repository`);
    assert.doesNotMatch(source, /https?:/);
  }
});
