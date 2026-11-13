// A found source in the directory and the enum (S3-A P1, hub #318).
//
//   A4  A PIN: it holds on 0.9.0, with no new code. A consumer adds a
//       search's hit to the selection it passes; over that extended
//       selection, `directoryPrompt` and `aliasedLoadSourceTool` list the
//       found entry at its manifest position, whatever position the hit was
//       added at, and the enum equals the directory lines' aliases, in order.
//       The hits here are fixed source ids, not a search's output, so the pin
//       reads only what 0.9.0 already had.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CIVIC_MANIFEST, civicRouter, readMcpEnv } from './index.ts';

const TODAY = '2026-11-13';
const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
  NYC_CHECKBOOK_HOSTING: 'sandbox',
  NYS_LEGISLATION_HOSTING: 'sandbox',
});

/** The aliases of a directory's entry lines, in order. */
const directoryAliases = (directory: string): string[] =>
  directory
    .split('\n')
    .filter((line) => line.startsWith('- `'))
    .map((line) => line.split('`')[1]!);

const enumOf = (tool: ReturnType<typeof civicRouter.aliasedLoadSourceTool>): string[] =>
  (tool.function.parameters as { properties: { alias: { enum: string[] } } }).properties.alias.enum;

test('A4 (pin, holds on 0.9.0): over a selection extended by a hit, the directory and the enum list the found entry at its manifest position', () => {
  const ids = CIVIC_MANIFEST.map((entry) => entry.sourceId);
  const aliasOf = new Map(CIVIC_MANIFEST.map((entry) => [entry.sourceId, entry.alias]));
  const selections: string[][] = [[], ['socrata'], ['nys-legislation', 'data-commons'], ['boston-opencontext', 'nyc-checkbook', 'socrata']];
  let cases = 0;
  for (const selection of selections) {
    for (const hit of ids.filter((id) => !selection.includes(id))) {
      const extended = [...selection, hit];
      const expected = ids.filter((id) => extended.includes(id)).map((id) => aliasOf.get(id)!);
      const listed = directoryAliases(civicRouter.directoryPrompt({ configured: EVERY_SOURCE, today: TODAY, selection: extended }));
      const enumed = enumOf(civicRouter.aliasedLoadSourceTool({ configured: EVERY_SOURCE, selection: extended }));
      assert.deepEqual(listed, expected, `${extended.join(',')}: the directory in manifest order`);
      assert.ok(listed.indexOf(aliasOf.get(hit)!) === expected.indexOf(aliasOf.get(hit)!), `${hit} at its manifest position`);
      assert.deepEqual(enumed, listed, `${extended.join(',')}: the enum equals the directory lines' aliases, in order`);
      cases++;
    }
  }
  assert.equal(cases, 7 + 6 + 5 + 4);
});
