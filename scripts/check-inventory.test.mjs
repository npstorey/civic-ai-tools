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


// S2-B (hub #309): the version form tightened to the harness's (F3), and a
// pack's hash (G0-B6).

test("decoy (F3): a version whose counter has a leading zero fails by name", () => {
  const problems = problemsWith((given) => {
    given.inventory.version = '2026-11-06.01';
    given.changelog = `${given.changelog}- \`2026-11-06.01\`: a decoy.\n`;
  });
  assert.ok(problems.includes('version: "2026-11-06.01": the counter "01" has a leading zero'), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('schema: .version ')), `the schema refuses it too: ${problems.join('\n')}`);
});

test('decoy (F3): a version whose date is not a calendar date fails by name', () => {
  const problems = problemsWith((given) => {
    given.inventory.version = '2026-13-01.1';
    given.changelog = `${given.changelog}- \`2026-13-01.1\`: a decoy.\n`;
  });
  assert.ok(problems.includes('version: "2026-13-01.1": 2026-13-01 is not a calendar date'), problems.join('\n'));
  // The calendar, not the digits' shape: a leap day passes and a day after a month's end fails.
  const leap = problemsWith((given) => {
    given.inventory.version = '2028-02-29.1';
  });
  assert.ok(!leap.some((p) => p.includes('is not a calendar date')), leap.join('\n'));
  const april = problemsWith((given) => {
    given.inventory.version = '2026-04-31.1';
  });
  assert.ok(april.includes('version: "2026-04-31.1": 2026-04-31 is not a calendar date'), april.join('\n'));
});

/** The repository inventory's packs, by position. */
const packIndexes = () => inputs().inventory.entries.flatMap((entry, i) => (entry.kind === 'pack' ? [i] : []));

test('the repository inventory holds a pack, and its stated hash is the canonicalJson SHA-256 of the entry less hash, provenance and toolsRef', () => {
  const { inventory } = inputs();
  const indexes = packIndexes();
  assert.ok(indexes.length > 0, 'a pack to check');
  for (const i of indexes) {
    const { hash, provenance, toolsRef, ...covered } = inventory.entries[i];
    assert.ok(provenance !== undefined && toolsRef !== undefined, 'the members the hash leaves out are present');
    assert.equal(hash, router.sha256Hex(router.canonicalJson(covered)));
    assert.equal(hash, router.packHash(inventory.entries[i]));
  }
});

test("decoy (G0-B6): a pack with no hash fails schema.json's required", () => {
  const i = packIndexes()[0];
  const problems = problemsWith((given) => {
    delete given.inventory.entries[i].hash;
  });
  assert.ok(problems.some((p) => p === `schema: .entries[${i}] should have required property 'hash'`), problems.join('\n'));
  assert.ok(problems.includes('hash: nyc_record: a pack states its hash, and this one has none'), problems.join('\n'));
});

test("decoy (G0-B6): a pack whose hash is not the canonical hash of the entry less hash, provenance and toolsRef fails by name", () => {
  const i = packIndexes()[0];
  // The filter moved by one character, the stated hash left as it was.
  const problems = problemsWith((given) => {
    given.inventory.entries[i].filter.dataset_id = 'dg92-zbpy';
  });
  assert.ok(
    problems.some((p) => /^hash: nyc_record: states [0-9a-f]{64}; the canonicalJson SHA-256 of the entry less hash, provenance and toolsRef is [0-9a-f]{64}$/.test(p)),
    problems.join('\n'),
  );
  assert.ok(problems.some((p) => p.startsWith('load: manifestFromInventory: nyc_record: hash: ')), `the loader refuses it too: ${problems.join('\n')}`);
  // The provenance and the tools' reference are outside the hash: editing either moves no pack hash.
  const provenance = problemsWith((given) => {
    given.inventory.entries[i].provenance.by = `${given.inventory.entries[i].provenance.by} (edited)`;
  });
  assert.ok(!provenance.some((p) => p.startsWith('hash: ')), provenance.join('\n'));
});


// S2-C (hub #317): schema 3, inventory version 3 and the route-identity
// conventions (A1.1). Each decoy asserts the rule that fails by its name.

const SOCRATA_ID = 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server';
/** The design's §2.5 table, as version 3 states it. */
const API = {
  socrata: { platform: 'socrata' },
  'data-commons': { platform: 'data-commons', host: 'api.datacommons.org' },
  'boston-opencontext': { platform: 'ckan', host: 'data.boston.gov' },
  'nyc-charter': { platform: 'bundled-data' },
  'nyc-checkbook': { platform: 'custom-api', host: 'www.checkbooknyc.com' },
  'nyc-record': { platform: 'socrata', host: 'data.cityofnewyork.us', dataset: 'dg92-zbpx' },
  'nys-legislation': { platform: 'custom-api', host: 'legislation.nysenate.gov' },
};
const CAPTURE = JSON.parse(readFileSync(join(REPO, 'packages/civic-typed-router/src/__fixtures__/socrata-tools.json'), 'utf8'));
const captured = (name) => CAPTURE.tools.find((t) => t.name === name);

/** The pack's position, and the pack changed by `change` with its hash restated. */
const PACK = () => packIndexes()[0];
const withPack = (given, change) => {
  const pack = given.inventory.entries[PACK()];
  change(pack, given.inventory);
  pack.hash = router.packHash(pack);
};

test('A1.1: the repository inventory is civic-inventory/3: seven entries, each with its api; the pack over the Socrata entry by id, pinned, derived from the dedicated server, with the owed names', () => {
  const { inventory } = inputs();
  assert.equal(inventory.schema, 'civic-inventory/3');
  assert.equal(inventory.entries.length, 7);
  assert.deepEqual(Object.fromEntries(inventory.entries.map((e) => [e.sourceId, e.api])), API);
  const pack = inventory.entries[PACK()];
  assert.equal(inventory.entries[0].id, SOCRATA_ID);
  assert.equal(pack.base, SOCRATA_ID);
  assert.deepEqual(pack.basePins, [
    {
      serverName: CAPTURE.initialize.serverInfo.name,
      serverVersion: CAPTURE.initialize.serverInfo.version,
      tools: { get_data: router.mcpToolSchemaSha256(captured('get_data')), fetch: router.mcpToolSchemaSha256(captured('fetch')) },
    },
  ]);
  assert.equal(pack.version, '1.1');
  assert.equal(pack.displayName, 'NYC City Record');
  assert.equal(pack.prompt.lockMention, 'City Record for New York City notices');
  assert.deepEqual(pack.derivedFrom, [
    {
      id: '@betanyc/nyc-record-mcp@https://github.com/BetaNYC/nyc-record-mcp',
      version: '1.1.0',
      commit: '6c52a5353381592713678caa109870d1e912c858',
      file: 'dist/city-record.js',
      fileSha256: '622edb9fb6263b9a3ad40a20415f4b409d652c2531bf4dbbf7cfac619e2b0512',
      sourceUrl: 'https://www.npmjs.com/package/@betanyc/nyc-record-mcp/v/1.1.0',
    },
  ]);
  for (const entry of inventory.entries) {
    for (const member of ['file', 'commit', 'fileSha256']) assert.equal(Object.hasOwn(entry.provenance, member), false, `${entry.sourceId}: provenance.${member}`);
  }
});

test("decoy (A1.1): a pack whose base is the Socrata entry's sourceId fails the load by name", () => {
  const problems = problemsWith((given) => withPack(given, (pack) => (pack.base = 'socrata')));
  assert.ok(problems.some((p) => p.startsWith('load: manifestFromInventory: nyc_record: base: "socrata" is a sourceId; ')), problems.join('\n'));
});

test('decoy (A1.1): a duplicate id, a duplicate sourceId and a duplicate alias each fail the uniqueness rule by name', () => {
  const id = problemsWith((given) => (given.inventory.entries[4].id = given.inventory.entries[3].id));
  assert.ok(id.includes(`unique: id "${inputs().inventory.entries[3].id}" is stated by entries[3] (nyc_charter) and entries[4] (nyc_checkbook)`), id.join('\n'));
  const sourceId = problemsWith((given) => (given.inventory.entries[2].sourceId = 'data-commons'));
  assert.ok(sourceId.includes('unique: sourceId "data-commons" is stated by entries[1] (data_commons) and entries[2] (boston)'), sourceId.join('\n'));
  const alias = problemsWith((given) => (given.inventory.entries[6].alias = 'nyc_checkbook'));
  assert.ok(alias.includes('unique: alias "nyc_checkbook" is stated by entries[4] (nyc_checkbook) and entries[6] (nyc_checkbook)'), alias.join('\n'));
});

test('decoy (A1.1): a pack with no basePins fails the schema and the load by name', () => {
  const problems = problemsWith((given) => withPack(given, (pack) => delete pack.basePins));
  assert.ok(problems.includes(`schema: .entries[${PACK()}] should have required property 'basePins'`), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('load: manifestFromInventory: nyc_record: basePins: is missing')), problems.join('\n'));
});

test("decoy (A1.1): a pack whose api.host differs from its filter.portal fails the load by name", () => {
  const problems = problemsWith((given) => withPack(given, (pack) => (pack.api = { ...pack.api, host: 'data.cityofchicago.org' })));
  assert.ok(problems.some((p) => p.startsWith('load: manifestFromInventory: nyc_record: api.host: is "data.cityofchicago.org"; ')), problems.join('\n'));
});

test('decoy (A1.1): a server entry with no tools that no pack names fails the empty-tools rule by name; one a pack names passes it', () => {
  const unnamed = problemsWith((given) => (given.inventory.entries[1].toolsRef.toolNames = []));
  assert.ok(unnamed.includes('tools: data_commons: toolsRef.toolNames is empty, and no pack names this entry as its base'), unnamed.join('\n'));
  assert.ok(!unnamed.some((p) => p.startsWith('schema: ')), `the schema admits it: ${unnamed.join('\n')}`);
  // The Socrata entry, the pack's base, may list none (CKAN-1's case); its kind's schemas then fail the load, not this rule.
  const named = problemsWith((given) => (given.inventory.entries[0].toolsRef.toolNames = []));
  assert.ok(!named.some((p) => p.startsWith('tools: ')), named.join('\n'));
});

test('decoy (A1.1): a version-2 file fails schema 3 by name', () => {
  const problems = problemsWith((given) => {
    const v2 = given.inventory;
    v2.schema = 'civic-inventory/2';
    for (const entry of v2.entries) delete entry.api;
    const pack = v2.entries[PACK()];
    pack.base = 'socrata';
    delete pack.basePins;
    const from = pack.derivedFrom?.[0] ?? pack.provenance;
    delete pack.derivedFrom;
    Object.assign(pack.provenance, { file: from.file, commit: from.commit, fileSha256: from.fileSha256 });
    pack.hash = router.packHash(pack);
  });
  for (const expected of [
    '/schema should be equal to constant',
    `/entries[0] should have required property 'api'`,
    `/entries[${PACK()}] should have required property 'basePins'`,
    `/entries[${PACK()}].provenance should NOT have additional properties`,
  ]) {
    assert.ok(problems.some((p) => p.startsWith('schema: ') && p.replace('schema: .', '/').startsWith(expected)), `${expected}:\n${problems.join('\n')}`);
  }
});
