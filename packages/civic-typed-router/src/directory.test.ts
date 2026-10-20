// The directory (ADR-0037): the first request's system prompt under in-loop
// routing. The intro, a heading, one paragraph, and one line per source in
// the directory set, in manifest order:
//
//   - `<alias>`: <description, with a closing period added if it has none> Freshness: <freshness>
//
// joined by newlines, with no outro and no trailing newline. The text is the
// one the quote test of 2026-10-19 measured as shape S2: R5's frozen
// first-request template with its one sentence about the load result
// rewritten for guidance that arrives in the next request's system prompt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BARE_VIEW,
  CIVIC_MANIFEST,
  civicRouter,
  composeDirectory,
  createCivicRouter,
  directoryFrameFor,
  introFor,
  readMcpEnv,
  type CivicManifest,
  type CivicManifestEntry,
  type SourceView,
} from './index.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

/** R5's eleven entries, as its frozen directory has them. */
const R5: { source: string; entries: { alias: string; description: string; freshness: string }[] } = JSON.parse(
  readFileSync(join(FIXTURES, 'r5-directory-entries.json'), 'utf8'),
);

/** The paragraph the quote test measured (S2), as a literal. */
const PARAGRAPH =
  'The data sources below are available to you, but none of their tools are loaded yet. To use a source, call `load_source` with its alias; its tools are added for your next turn, and its guidance then appears in this system prompt. Load every source the question needs; you may call `load_source` more than once. If the question needs no data, answer without loading anything.';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

// --- Inputs ------------------------------------------------------------------------------

const TODAY = '2026-01-15';
/** Every source on: both optional addresses, and all four hosted sources'
 *  switches (since 0.6.0, the three after Charter's too). */
const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYC_RECORD_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
});
const REQUIRED_ONLY = readMcpEnv({ SOCRATA_MCP_URL: 'https://socrata-mcp.example.org' });

/** The line rule, written out here from the entry's fields. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);
const lineOf = (entry: { alias: string; description: string; freshness: string }): string =>
  `- \`${entry.alias}\`: ${sentence(entry.description)} Freshness: ${entry.freshness}`;
const expectedDirectory = (today: string, entries: readonly { alias: string; description: string; freshness: string }[]): string =>
  `${introFor(today)}\n\n## Data sources\n\n${PARAGRAPH}\n\n${entries.map(lineOf).join('\n')}`;

const entryLines = (directory: string): string[] => directory.split('\n').filter((line) => line.startsWith('- `'));

// --- The text the quote test measured ------------------------------------------------------

test('directory: the composer over R5\'s eleven frozen entries, with today {{TODAY}}, is the text S2 measured (3,486 characters, sha256 ce6b136a…)', () => {
  assert.match(R5.source, /be0874030f0c95dd6083fd3d1e8fdfae4fa956ff848c7b67d4c25c1053e5dea7/, 'the fixture names the frozen file it came from');
  assert.equal(R5.entries.length, 11);
  const text = composeDirectory(directoryFrameFor('{{TODAY}}'), R5.entries);
  assert.equal(text.length, 3486);
  assert.equal(sha256(text), 'ce6b136a19890a693b05a24f6778569db76d2bfaaadb92a7f6d3e2f7cf31f89d');
  assert.equal(text, expectedDirectory('{{TODAY}}', R5.entries));
});

test('directory: the civic frame is the intro, the heading and the paragraph S2 measured', () => {
  const frame = directoryFrameFor(TODAY);
  assert.deepEqual(
    { ...frame },
    { intro: introFor(TODAY), heading: '## Data sources', paragraph: PARAGRAPH, freshnessLabel: 'Freshness:' },
  );
});

test('directory: a description without closing punctuation gains a period, and one with it is kept as it is', () => {
  const frame = { intro: 'I', heading: 'H', paragraph: 'P', freshnessLabel: 'F:' };
  const text = composeDirectory(frame, [
    { alias: 'a', description: 'Ends bare', freshness: 'x' },
    { alias: 'b', description: 'Ends with a period.', freshness: 'y' },
    { alias: 'c', description: 'Ends with a question?', freshness: 'z' },
    { alias: 'd', description: 'Ends with a bang!', freshness: 'w' },
  ]);
  assert.equal(
    text,
    'I\n\nH\n\nP\n\n- `a`: Ends bare. F: x\n- `b`: Ends with a period. F: y\n- `c`: Ends with a question? F: z\n- `d`: Ends with a bang! F: w',
  );
});

// --- The seven current entries ---------------------------------------------------------------

test('directory: for the seven current entries each line is the rule over the entry\'s alias, description and freshness, in manifest order', () => {
  const directory = civicRouter.directoryPrompt({ configured: EVERY_SOURCE, today: TODAY });
  assert.equal(directory, expectedDirectory(TODAY, CIVIC_MANIFEST));
  assert.deepEqual(entryLines(directory), CIVIC_MANIFEST.map(lineOf));
});

test('directory: with every source configured it has seven lines; with Boston OpenContext and the four hosted sources unconfigured, two', () => {
  const directoryPrompt = civicRouter.directoryPrompt;
  assert.deepEqual(
    entryLines(directoryPrompt({ configured: EVERY_SOURCE, today: TODAY })).map((line) => line.split('`')[1]),
    ['socrata', 'data_commons', 'boston', 'nyc_charter', 'nyc_checkbook', 'nyc_record', 'nys_legislation'],
  );
  const two = directoryPrompt({ configured: REQUIRED_ONLY, today: TODAY });
  assert.deepEqual(entryLines(two).map((line) => line.split('`')[1]), ['socrata', 'data_commons']);
  assert.equal(two, expectedDirectory(TODAY, CIVIC_MANIFEST.slice(0, 2)));
});

test('directory: the selection narrows the directory set, in manifest order, and never adds an unconfigured source', () => {
  const directoryPrompt = civicRouter.directoryPrompt;
  const narrowed = directoryPrompt({ configured: EVERY_SOURCE, today: TODAY, selection: ['nyc-charter', 'socrata'] });
  assert.deepEqual(entryLines(narrowed).map((line) => line.split('`')[1]), ['socrata', 'nyc_charter']);
  const unconfigured = directoryPrompt({ configured: REQUIRED_ONLY, today: TODAY, selection: ['boston-opencontext', 'data-commons'] });
  assert.deepEqual(entryLines(unconfigured).map((line) => line.split('`')[1]), ['data_commons']);
});

test('directory: no exposed tool name and no backticked upstream name appears in the directory', () => {
  const directoryPrompt = civicRouter.directoryPrompt;
  const upstream = new Set([...civicRouter.dispatchMap.values()].map((target) => target.upstreamName));
  for (const configured of [EVERY_SOURCE, REQUIRED_ONLY]) {
    const directory = directoryPrompt({ configured, today: TODAY });
    for (const exposed of civicRouter.dispatchMap.keys()) {
      assert.ok(!directory.includes(exposed), `the directory names the exposed tool "${exposed}"`);
    }
    for (const name of upstream) {
      assert.ok(!directory.includes(`\`${name}\``), `the directory names the upstream tool "${name}" in backticks`);
    }
  }
});

test('directory: it calls neither fetcher, and returns the text itself', () => {
  const calls: string[] = [];
  const input = {
    configured: EVERY_SOURCE,
    today: TODAY,
    publicationHost: 'records.example.org',
    fetchPrompt: async (name: string): Promise<string> => {
      calls.push(`prompt:${name}`);
      throw new Error('the directory must not fetch a prompt');
    },
    fetchInstructions: async (sourceId: string): Promise<string | null> => {
      calls.push(`instructions:${sourceId}`);
      throw new Error('the directory must not fetch instructions');
    },
  };
  const directory = civicRouter.directoryPrompt(input);
  assert.equal(typeof directory, 'string');
  assert.deepEqual(calls, []);
});

// --- A fork's manifest ----------------------------------------------------------------------

const EXAMPLE_ENTRY: CivicManifestEntry = {
  id: 'example-mcp@https://example.org/mcp',
  alias: 'example',
  sourceId: 'example',
  displayName: 'Example Records Server',
  description: 'Example records: synthetic test records for one fictional town',
  freshness: 'Static: a fixed test set.',
  configuration: { addressVariable: 'EXAMPLE_MCP_URL', requirement: 'required' },
  tools: [{ type: 'function', function: { name: 'lookup_record', description: 'Look up one record by its id.' } }],
  toolNames: ['lookup_record'],
  guidance: {
    async fetchText(_ctx, view: SourceView = BARE_VIEW) {
      return view.sourceText('example', 'Call `lookup_record` with an id.');
    },
  },
  hostings: [{ variant: 'remote', kind: 'remote', runsAt: 'other', logging: [{ statedBy: 'instance', role: 'server-operator' }] }],
  consentDefault: 'on',
};

test('directory: createCivicRouter(fork) gives a fork the same function over its own manifest', () => {
  const fork: CivicManifest = [...CIVIC_MANIFEST, EXAMPLE_ENTRY];
  const directory = createCivicRouter(fork).directoryPrompt({ configured: EVERY_SOURCE, today: TODAY });
  assert.equal(directory, expectedDirectory(TODAY, fork));
  assert.equal(
    entryLines(directory).at(-1),
    '- `example`: Example records: synthetic test records for one fictional town. Freshness: Static: a fixed test set.',
  );
});
