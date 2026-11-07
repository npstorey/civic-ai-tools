// Self-test for check-inventory.mjs (hub #309, S2-A P0, A0.1): the check
// passes on the repository's inventory, and each decoy fails by name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inventoryProblems, nonStrings, PATHS, readInputs, REPO } from './check-inventory.mjs';

const router = await import('@typedstandards/civic-typed-router');
const inputs = () => ({ ...readInputs(), router });
const problemsWith = (change) => {
  const given = inputs();
  change(given);
  return inventoryProblems(given);
};

test('the repository inventory passes', () => {
  assert.deepEqual(inventoryProblems(inputs()), []);
});

test('the command prints its sentence and exits 0', () => {
  const run = spawnSync(process.execPath, [join(REPO, 'scripts', 'check-inventory.mjs')], { cwd: REPO, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, 'Inventory check passed.\n');
});

test('the walk finds a number, a boolean and a null', () => {
  assert.deepEqual(nonStrings({ a: ['x', { b: 7 }], c: true, d: null }), ['$.a[1].b = 7', '$.c = true', '$.d = null']);
});

test('decoy: a copy with one number value fails by name', () => {
  const problems = problemsWith((given) => {
    given.inventory.entries[0].configuration.requirement = 7;
  });
  assert.ok(problems.includes('value: $.entries[0].configuration.requirement = 7 is not a string, an array or an object'), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('sha256: the file has no canonical form')), 'canonicalJson refuses it too');
});

test("decoy: a copy whose .sha256 is the bytes' SHA-256 fails by name", () => {
  const bytes = readFileSync(join(REPO, PATHS.inventory));
  const bytesHash = createHash('sha256').update(bytes).digest('hex');
  const problems = problemsWith((given) => {
    given.sha256Text = `${bytesHash}\n`;
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0], new RegExp(`^sha256: inventory/civic-inventory\\.json\\.sha256 states ${bytesHash}; the canonicalJson SHA-256 of the parsed file is [0-9a-f]{64}$`));
});

test('decoy: a copy missing its changelog line fails by name', () => {
  const problems = problemsWith((given) => {
    given.changelog = given.changelog
      .split('\n')
      .filter((line) => !line.startsWith(`- \`${given.inventory.version}\``))
      .join('\n');
  });
  assert.deepEqual(problems, [`changelog: inventory/CHANGELOG.md has no line for ${inputs().inventory.version} ("- \`${inputs().inventory.version}\`: ...")`]);
});

test('decoy: a version not YYYY-MM-DD.N, a schema violation and an entry whose tools hash differs each fail by name', () => {
  const version = problemsWith((given) => {
    given.inventory.version = '2026-11-06';
  });
  assert.ok(version.some((p) => p === 'version: "2026-11-06" is not YYYY-MM-DD.N'), version.join('\n'));
  const schema = problemsWith((given) => {
    delete given.inventory.entries[2].hostings;
  });
  assert.ok(schema.some((p) => p.startsWith('schema: ')), schema.join('\n'));
  const tools = problemsWith((given) => {
    given.inventory.entries[4].toolsRef.sha256 = '0'.repeat(64);
  });
  assert.ok(tools.some((p) => p.startsWith('load: manifestFromInventory: nyc_checkbook: toolsRef.sha256: ')), tools.join('\n'));
});

