// NYC Charter, Laws and Rules: the fourth civic entry, the hosting variant it
// carries, the switch that offers it, and what it moves.
//
//   - the entry and its `sandbox` variant (package, version, commit; no
//     address);
//   - its schemas are the committed capture's, and its five aliased names pass
//     the startup checks;
//   - the switch: `readMcpEnv` reads `NYC_CHARTER_HOSTING` as on only for
//     `sandbox` after trimming, and `configuredAddresses` never has a key for
//     the source;
//   - switched on: the offered tools gain exactly its five, and the prompt
//     gains exactly one preamble entry, the count word and one outro citation,
//     and no block: its guidance calls no fetcher;
//   - the tool-to-source index and dispatch for a bare `search`.
//
// Read through the package entry and the manifest, by source id, so the file
// names nothing the entry module exports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BLOCK_SEPARATOR,
  checkToolNames,
  CIVIC_MANIFEST,
  civicRouter,
  configuredAddresses,
  readMcpEnv,
  toolNamesMatchSchemas,
  type BuildSystemPromptInput,
  type CivicManifestEntry,
  type FunctionToolSchema,
  type McpRegistryEnv,
} from './index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE = join(HERE, '__fixtures__', 'nyc-charter-tools.json');
const SCRIPT_FILE = join(HERE, '__fixtures__', 'pin-nyc-charter-tools.mjs');

interface CharterFixture {
  _meta: {
    package: string;
    version: string;
    gitHead: string;
    captureDate: string;
    script: { path: string; sha256: string };
    resolved: Record<string, string>;
  };
  initialize: { serverInfo: { name: string; version: string }; instructions: string | null };
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
  getVersion: { lines: string[] };
}

const fixture: CharterFixture = JSON.parse(readFileSync(FIXTURE_FILE, 'utf8'));

/** The fixture's tools as the function tools a manifest entry carries. */
const FIXTURE_TOOLS: FunctionToolSchema[] = fixture.tools.map((tool) => ({
  type: 'function',
  function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
}));

const FIVE = ['search', 'get_section', 'list_titles', 'get_title', 'get_version'];
const EXPOSED_FIVE = FIVE.map((name) => `nyc_charter__${name}`);

/** The entry, found by its source id. */
function charter(): CivicManifestEntry {
  const entry = CIVIC_MANIFEST.find((candidate) => candidate.sourceId === 'nyc-charter');
  assert.ok(entry, 'the civic manifest holds a nyc-charter entry');
  return entry;
}

/** The entry's npm-package variant, read as a plain record (0.4.0; 0.3.0's
 *  `hosting` field carried the same five strings). */
function hostingOf(entry: CivicManifestEntry): Record<string, unknown> | undefined {
  const hostings = (entry as unknown as { hostings?: readonly Record<string, unknown>[] }).hostings ?? [];
  return hostings.find((variant) => variant.kind === 'npm-package');
}

/** The five fields 0.3.0's hosting field had. */
function fiveOf(hosting: Record<string, unknown>): Record<string, unknown> {
  const { kind, package: name, version, commit, outbound } = hosting;
  return { kind, package: name, version, commit, outbound };
}

const SOCRATA = 'https://socrata-mcp.example.org';
const BOSTON = 'https://boston-mcp.example.org/mcp';

/** A configuration with the Charter switch at `value` (absent when undefined). */
function env(value: string | undefined, boston = true): McpRegistryEnv {
  return readMcpEnv({
    SOCRATA_MCP_URL: SOCRATA,
    ...(boston ? { BOSTON_OPENCONTEXT_MCP_URL: BOSTON } : {}),
    ...(value === undefined ? {} : { NYC_CHARTER_HOSTING: value }),
  });
}

// --- The entry -----------------------------------------------------------------------

test('charter entry: the last civic entry, optional, offered by NYC_CHARTER_HOSTING, with its alias and id', () => {
  const entry = charter();
  assert.equal(CIVIC_MANIFEST.at(-1), entry, 'after Boston OpenContext, so the three before it keep their order');
  assert.deepEqual([entry.sourceId, entry.alias, entry.configuration.requirement], ['nyc-charter', 'nyc_charter', 'optional']);
  assert.equal(entry.configuration.addressVariable, 'NYC_CHARTER_HOSTING');
  assert.equal(entry.configuration.defaultAddress, undefined, 'no default address');
  assert.equal(entry.configuration.keyVariable, undefined, 'no key');
  // The existing entries' `<name>@<address>` shape: the package and its repository.
  assert.equal(entry.id, '@betanyc/nyc-charter-laws-rules@https://github.com/BetaNYC/nyc-charter-laws-rules');
  assert.equal(entry.displayName, 'NYC Charter, Laws and Rules MCP Server');
});

test('charter entry: the sandbox variant carries the package, the version and the commit as strings, and no address', () => {
  const hosting = hostingOf(charter());
  assert.ok(hosting, 'the entry carries an npm-package variant');
  assert.deepEqual(fiveOf(hosting), {
    kind: 'npm-package',
    package: fixture._meta.package,
    version: fixture._meta.version,
    commit: fixture._meta.gitHead,
    outbound: [],
  });
  assert.deepEqual(Object.keys(hosting!).sort(), ['commit', 'kind', 'logging', 'outbound', 'package', 'runsAt', 'variant', 'version']);
  for (const key of ['package', 'version', 'commit'] as const) assert.equal(typeof hosting![key], 'string', `${key} is a string`);
  assert.equal(hosting!.version, '0.3.1');
  assert.match(hosting!.commit as string, /^[0-9a-f]{40}$/);
  // What a record derives from it (owner's ruling a2; P4 states the version).
  // The purl encodes the scope and the name each on its own: the `/` between
  // them stays, so encoding the whole package name (`%2F`) is not the purl.
  const purl = `pkg:npm/${(hosting!.package as string).split('/').map(encodeURIComponent).join('/')}@${hosting!.version}`;
  assert.notEqual(`pkg:npm/${encodeURIComponent(hosting!.package as string)}@${hosting!.version}`, purl);
  assert.equal(purl, 'pkg:npm/%40betanyc/nyc-charter-laws-rules@0.3.1');
  assert.equal(`${hosting!.version}+${(hosting!.commit as string).slice(0, 12)}`, '0.3.1+b784cb763ec0');
  // No address anywhere in it, and none of the three existing entries carries
  // an npm-package variant.
  assert.doesNotMatch(JSON.stringify(hosting), /https?:|url|address|endpoint|port/i);
  for (const entry of CIVIC_MANIFEST.filter((e) => e.sourceId !== 'nyc-charter')) {
    assert.equal(hostingOf(entry), undefined, `${entry.sourceId} carries no npm-package variant`);
  }
});

test('charter entry: the five aliased names pass checkToolNames; nyc_charter__get_section is 24 characters', () => {
  assert.doesNotThrow(() => checkToolNames(CIVIC_MANIFEST));
  const exposed = [...civicRouter.dispatchMap.values()].filter((t) => t.sourceId === 'nyc-charter');
  assert.deepEqual(exposed.map((t) => t.exposedName), EXPOSED_FIVE);
  assert.deepEqual(exposed.map((t) => t.upstreamName), FIVE);
  assert.ok(exposed.every((t) => !t.normalized), 'no name needed normalizing');
  assert.equal('nyc_charter__get_section'.length, 24);
  assert.equal(exposed.find((t) => t.upstreamName === 'get_section')!.exposedName.length, 24);
  assert.ok(toolNamesMatchSchemas(charter()), 'the routing list and the schemas name the same five');
  assert.deepEqual(charter().toolNames, FIVE, 'the routing list is in the server\'s order');
});

test('charter entry: the shipped schemas are the committed capture\'s, as function tools, byte for byte', () => {
  const entry = charter();
  assert.deepEqual(entry.tools, FIXTURE_TOOLS);
  assert.equal(JSON.stringify(entry.tools), JSON.stringify(FIXTURE_TOOLS), 'and in the same key order');
  assert.deepEqual(fixture.tools.map((t) => t.name), FIVE, 'the capture lists the five in this order');
  assert.equal(entry.toolsFor, undefined, 'the server owns the text: the aliased view rewrites it, anchored');
});

test('charter capture: the fixture records the pinned version, its gitHead, the date, the rendering packages, and its script', () => {
  const meta = fixture._meta;
  assert.equal(meta.package, '@betanyc/nyc-charter-laws-rules');
  assert.equal(meta.version, '0.3.1');
  assert.equal(meta.gitHead, 'b784cb763ec0d953139eef4ed366e8ec4de72625');
  assert.match(meta.captureDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(meta.resolved).sort(), ['@modelcontextprotocol/sdk', 'zod']);
  for (const version of Object.values(meta.resolved)) assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(meta.script.path, 'packages/civic-typed-router/src/__fixtures__/pin-nyc-charter-tools.mjs');
  assert.equal(meta.script.sha256, createHash('sha256').update(readFileSync(SCRIPT_FILE)).digest('hex'), 'captured by the committed script');
  // The server reports the pinned version, and sends no instructions.
  assert.deepEqual(fixture.initialize.serverInfo, { name: 'nyc-charter-laws-rules', version: '0.3.1' });
  assert.equal(fixture.initialize.instructions, null);
});

test('charter entry: the freshness line states the pinned version and the currency get_version reported at capture', () => {
  const entry = charter();
  assert.match(entry.freshness, /version 0\.3\.1/);
  const lines = fixture.getVersion.lines;
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /^NYC Charter: +Current through Local Law 2026\/147, enacted September 12, 2026,/);
  assert.match(lines[1]!, /^Administrative Code: +Current through Local Law 2026\/147, enacted September 12, 2026,/);
  assert.match(lines[2]!, /^Rules of NYC: +Current through rules effective October 4, 2026\./);
  assert.match(entry.freshness, /Local Law 2026\/147, enacted September 12, 2026/);
  assert.match(entry.freshness, /rules effective October 4, 2026/);
  assert.match(entry.freshnessSource ?? '', /releases\/tag\/v0\.3\.1/, 'the citation is the publisher\'s release page');
});

// --- The switch ------------------------------------------------------------------------

const BASE_KEYS = ['socrataUrl', 'dataCommonsUrl', 'dataCommonsApiKey', 'bostonOpencontextUrl'];

test('switch: readMcpEnv holds nycCharterHosting only for "sandbox" after trimming, and then the literal "sandbox"', () => {
  const cases: Array<[string, string | undefined, boolean]> = [
    ['unset', undefined, false],
    ['empty', '', false],
    ['blank', '  ', false],
    ['another case', 'Sandbox', false],
    ['padded', ' sandbox ', true],
    ['exact', 'sandbox', true],
    ['another value', 'hosted', false],
  ];
  for (const [name, value, on] of cases) {
    const read = readMcpEnv(value === undefined ? {} : { NYC_CHARTER_HOSTING: value }) as unknown as Record<string, unknown>;
    if (on) {
      assert.deepEqual(Object.keys(read), [...BASE_KEYS, 'nycCharterHosting'], `${name}: the key follows the four`);
      assert.equal(read.nycCharterHosting, 'sandbox', `${name}: the literal, not the raw value`);
    } else {
      assert.deepEqual(Object.keys(read), BASE_KEYS, `${name}: the key is absent, so the reading is 0.2.0's`);
      assert.equal(Object.hasOwn(read, 'nycCharterHosting'), false);
    }
  }
});

test('switch: configuredAddresses never has a key for nyc-charter, switch on or off', () => {
  for (const value of [undefined, '', 'sandbox', ' sandbox ', 'hosted']) {
    const addresses = configuredAddresses(env(value));
    assert.deepEqual(Object.keys(addresses), ['socrata', 'data-commons', 'boston-opencontext']);
    assert.equal(Object.hasOwn(addresses, 'nyc-charter'), false, `NYC_CHARTER_HOSTING=${String(value)}`);
  }
});

test('switch: sourcesOffered gives nyc-charter not-configured with the switch off and configured with it on', () => {
  const rows = (configured: McpRegistryEnv) => civicRouter.sourcesOffered(configured).map((s) => [s.sourceId, s.alias, s.reason]);
  const three = [
    ['socrata', 'socrata', 'configured'],
    ['data-commons', 'data_commons', 'configured'],
    ['boston-opencontext', 'boston', 'configured'],
  ];
  assert.deepEqual(rows(env(undefined)), [...three, ['nyc-charter', 'nyc_charter', 'not-configured']]);
  assert.deepEqual(rows(env('hosted')), [...three, ['nyc-charter', 'nyc_charter', 'not-configured']]);
  assert.deepEqual(rows(env('sandbox')), [...three, ['nyc-charter', 'nyc_charter', 'configured']]);
  assert.deepEqual(civicRouter.offeredSkillSources(env('sandbox')), ['socrata', 'data-commons', 'boston-opencontext', 'nyc-charter']);
  assert.deepEqual(civicRouter.offeredSkillSources(env(undefined)), ['socrata', 'data-commons', 'boston-opencontext']);
  // A selection narrows it as any other source.
  assert.deepEqual(civicRouter.sourcesOffered(env('sandbox'), ['socrata']).map((s) => s.reason), ['selected', 'not-selected', 'not-selected', 'not-selected']);
});

// --- Switched on: the tools and the prompt ----------------------------------------------

test('switch on: the aliased offered tools gain exactly Charter\'s five, after the sources before it, in its order', () => {
  for (const boston of [true, false]) {
    const off = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(undefined), env(undefined, boston));
    const on = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(undefined), env('sandbox', boston));
    const names = (tools: FunctionToolSchema[]) => tools.map((t) => t.function.name);
    assert.equal(off.length, boston ? 11 : 5);
    assert.deepEqual(names(on), [...names(off), ...EXPOSED_FIVE], `Boston ${boston ? 'set' : 'unset'}: the five are appended`);
    assert.equal(JSON.stringify(on.slice(0, off.length)), JSON.stringify(off), 'the tools before them are unchanged');
    // Positions: 11-15 with Boston set, 5-9 without.
    assert.deepEqual(EXPOSED_FIVE.map((n) => names(on).indexOf(n)), boston ? [11, 12, 13, 14, 15] : [5, 6, 7, 8, 9]);
  }
  // The five are the fixture's schemas under their exposed names.
  const on = civicRouter.aliasedOfferedMcpTools(civicRouter.aliasedMcpToolsFor(undefined), env('sandbox'));
  const five = on.slice(-5);
  assert.deepEqual(five.map((t) => t.function.parameters), FIXTURE_TOOLS.map((t) => t.function.parameters));
  assert.deepEqual(five.map((t) => t.function.description), FIXTURE_TOOLS.map((t) => t.function.description), 'no anchored name in them to rewrite');
});

/** Fetchers that log each call. */
function recording(): { calls: string[]; input: (configured: McpRegistryEnv) => BuildSystemPromptInput } {
  const calls: string[] = [];
  return {
    calls,
    input: (configured) => ({
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
    }),
  };
}

const CHARTER_DESCRIPTION =
  "New York City's own law: the full text of the New York City Charter, the Administrative Code and the Rules of the City of New York, by section, with title and chapter listings and keyword search. Covers New York City only. Holds no court decisions, no New York State or federal law, and no bills still in progress.";
const CHARTER_CITATION = 'the section citation and the document it is from (for the NYC Charter, Administrative Code and Rules)';

test('switch on: the prompt differs from the same configuration unset in exactly the count word, one preamble entry and one outro citation, in both views', async () => {
  for (const view of ['bare', 'aliased'] as const) {
    const build = view === 'bare' ? civicRouter.buildSystemPrompt : civicRouter.aliasedBuildSystemPrompt;
    const off = recording();
    const on = recording();
    const unset = await build(off.input(env(undefined)));
    const set = await build(on.input(env('sandbox')));
    const tools = (view === 'bare' ? FIVE : EXPOSED_FIVE).join(', ');
    const expected = unset
      .replace('You have access to THREE MCP data sources', 'You have access to FOUR MCP data sources')
      .replace(
        /(\n3\. \*\*Boston OpenContext\*\*[^\n]*\n)/,
        `$1${`4. **NYC Charter, Laws and Rules MCP Server** — ${CHARTER_DESCRIPTION} Tools: ${tools}.`.replace(/\$/g, '$$$$')}\n`,
      )
      .replace(
        'the resource UUID + dataset title (for Boston OpenContext).',
        `the resource UUID + dataset title (for Boston OpenContext), or ${CHARTER_CITATION}.`,
      )
      .replace('cite the dataset ID (for Socrata), the variable DCID + source dataset (for Data Commons), or the resource UUID', 'cite the dataset ID (for Socrata), the variable DCID + source dataset (for Data Commons), the resource UUID');
    assert.notEqual(set, unset, `${view}: switched on, the prompt changes`);
    assert.ok(set === expected, `${view}: the switched-on prompt is the unset one with exactly those three changes`);
    // No block: the guidance asked no fetcher, and the block count is unchanged.
    assert.deepEqual(on.calls, off.calls, `${view}: the same fetcher calls, none for nyc-charter`);
    assert.ok(!on.calls.some((c) => c.includes('nyc-charter')));
    assert.equal(set.split(BLOCK_SEPARATOR).length, unset.split(BLOCK_SEPARATOR).length, `${view}: no Charter block`);
    assert.doesNotMatch(set, /# NYC Charter|nyc-charter instructions/);
  }
});

test('switch on: the one-portal lock section names Charter among the other sources, and changes nowhere else', () => {
  for (const view of ['bare', 'aliased'] as const) {
    const lock = view === 'bare' ? civicRouter.portalLockGuidance : civicRouter.aliasedPortalLockGuidance;
    const unset = lock('data.cityofnewyork.us', env(undefined));
    const set = lock('data.cityofnewyork.us', env('sandbox'));
    assert.ok(unset.includes('(Data Commons, and Boston OpenContext for Boston) are separate'), `${view}: the unset mention`);
    assert.ok(
      set === unset.replace(
        '(Data Commons, and Boston OpenContext for Boston) are separate',
        '(Data Commons, Boston OpenContext for Boston, and the NYC Charter server for New York City law) are separate',
      ),
      `${view}: one mention added, nothing else`,
    );
  }
});

test('switch on: Charter\'s guidance returns "" and calls neither fetcher', async () => {
  const entry = charter();
  const calls: string[] = [];
  const text = await entry.guidance.fetchText({
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

// --- A bare `search`: the index and dispatch ----------------------------------------------

test('index: sourceIdForToolName("search") is socrata under every configuration; Charter\'s other four are its own', () => {
  for (const value of [undefined, 'sandbox']) {
    // The index takes no configuration; the reading is passed to show it does not matter.
    void env(value);
    assert.equal(civicRouter.sourceIdForToolName('search'), 'socrata');
  }
  for (const name of FIVE.slice(1)) assert.equal(civicRouter.sourceIdForToolName(name), 'nyc-charter', name);
  assert.equal(civicRouter.sourceForAliasedName('nyc_charter__search')?.sourceId, 'nyc-charter');
});

test('dispatch: a bare "search" resolves to socrata__search with the switch off, and is refused as ambiguous with it on', () => {
  const off = civicRouter.resolveCalledName('search', env(undefined));
  assert.equal(off.ok, true);
  assert.deepEqual(off.ok && [off.spelling, off.exposedName, off.sourceId, off.upstreamName], ['bare', 'socrata__search', 'socrata', 'search']);
  // Socrata is required, so it is offered even without its address.
  const offNoAddress = civicRouter.resolveCalledName('search', readMcpEnv({}));
  assert.deepEqual(offNoAddress.ok && offNoAddress.exposedName, 'socrata__search');

  for (const configured of [env('sandbox'), readMcpEnv({ NYC_CHARTER_HOSTING: 'sandbox' })]) {
    const on = civicRouter.resolveCalledName('search', configured);
    assert.equal(on.ok, false);
    assert.deepEqual(!on.ok && [on.reason, on.candidates], ['ambiguous', ['socrata__search', 'nyc_charter__search']]);
  }
  // Each exposed name still resolves; a Charter name with the switch off is not offered.
  const exposed = civicRouter.resolveCalledName('nyc_charter__get_section', env('sandbox'));
  assert.deepEqual(exposed.ok && [exposed.spelling, exposed.sourceId, exposed.upstreamName], ['aliased', 'nyc-charter', 'get_section']);
  const withheld = civicRouter.resolveCalledName('get_section', env(undefined));
  assert.deepEqual(!withheld.ok && [withheld.reason, withheld.candidates], ['not-offered', ['nyc_charter__get_section']]);
});

test('bare view, switch on: it cannot tell the two "search" tools apart by name, so it offers both (use the aliased view)', () => {
  const tools = civicRouter.offeredMcpTools(civicRouter.mcpToolsFor(undefined), env('sandbox'));
  assert.equal(tools, civicRouter.mcpTools, 'nothing withheld: the vocabulary itself');
  assert.deepEqual(
    tools.filter((t) => t.function.name === 'search').map((t) => civicRouter.manifest.find((e) => e.tools.includes(t))!.sourceId),
    ['socrata', 'nyc-charter'],
  );
  assert.deepEqual(civicRouter.withheldToolNames(env('sandbox')), []);
});
