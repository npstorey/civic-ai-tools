// A1.3 (hub #302, S1 P1): the four inventories' hashes are written into
// benchmark/README.md and into the preregistration, benchmark/preregistration/
// s1.md (the seat's ruling 1, hub #302 comment 6604092796), before any
// question exists. The preregistration's inputs section also quotes the
// registry load text word for word and carries the note on `container`
// entries.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { COMPOSITION } from '../inventories/build.mjs';
import { REGISTRY_LOAD_TEXT } from '../inventories/load-text.mjs';
import { createHash } from 'node:crypto';
import { load } from './load.mjs';

const read = (rel) => {
  const url = new URL(`../${rel}`, import.meta.url);
  assert.ok(existsSync(url), `benchmark/${rel} exists`);
  return readFileSync(url, 'utf8');
};
const SIZES = [7, 50, 200, 1000];
const hashes = () => SIZES.map((size) => [size, read(`inventories/${size}.json.sha256`).trim()]);

test("A1.3: the four inventories' hashes are in benchmark/README.md", () => {
  const readme = read('README.md');
  for (const [size, hash] of hashes()) assert.match(readme, new RegExp(`\\| \`${size}\\.json\` \\([^)]*\\) \\| \`${hash}\` \\|`), `${size}.json's hash in the README's table`);
});

test("A1.3: the four inventories' hashes are in the preregistration, with its inputs and the seat's two notes", () => {
  const prereg = read('preregistration/s1.md');
  for (const [size, hash] of hashes()) assert.match(prereg, new RegExp(`\\| \`benchmark/inventories/${size}\\.json\` \\|[^|]*\\| \`${hash}\` \\|`), `${size}.json's hash`);
  assert.ok(prereg.includes(`> ${REGISTRY_LOAD_TEXT}\n`), 'the registry load text, word for word');
  assert.match(prereg, /Under D10 the product lists a package with no host as `container` and does not offer it/);
  assert.match(prereg, /2026-11-03T01:30:02Z` to `2026-11-03T01:42:17Z/, "the registry fetch's window");
  const c = COMPOSITION[1000];
  assert.ok(
    prereg.includes(`1,000 − (${c.from200} + ${c.socrataWithCountry} + ${c.ckanActive} + ${c.registry}) = ${c.nearDuplicates}`),
    'the 1,000 composition and its remainder, as build.mjs states them',
  );
  assert.match(prereg, /a design choice, not a measured share of any real directory/, 'the split at 1,000 is named a design choice');
  assert.match(prereg, /ties broken by the catalog's `id` field/, 'the tie-break names the catalog id');
  assert.ok(prereg.includes('## Configurations (P3)'), "P3's sections are named");
});

// A2.3 (hub #302, S1 P2): the four question files' hashes are in the
// preregistration's "Questions and gold (P2)" section and in the README, each
// after the inventories' hashes.
const questionHashes = () => SIZES.map((size) => [size, read(`questions/${size}.json.sha256`).trim()]);

test("A2.3: the four question files' hashes are in the preregistration, after the inventories' hashes", () => {
  const prereg = read('preregistration/s1.md');
  const section = prereg.indexOf('## Questions and gold (P2)');
  assert.ok(section > 0, 'the section exists');
  const lastInventory = Math.max(...hashes().map(([, hash]) => prereg.indexOf(hash)));
  assert.ok(lastInventory > 0 && lastInventory < section, "the inventories' hashes come first");
  const body = prereg.slice(section, prereg.indexOf('## Configurations (P3)'));
  for (const [size, hash] of questionHashes()) {
    assert.match(body, new RegExp(`\\| \`benchmark/questions/${size}\\.json\` \\| \`benchmark/inventories/${size}\\.json\` \\| \`${hash}\` \\|`), `${size}.json's hash`);
  }
});

test("A2.3: the four question files' hashes are in benchmark/README.md, after the inventories' hashes", () => {
  const readme = read('README.md');
  const lastInventory = Math.max(...hashes().map(([, hash]) => readme.indexOf(hash)));
  for (const [size, hash] of questionHashes()) {
    const at = readme.search(new RegExp(`\\| \`questions/${size}\\.json\` \\| \`inventories/${size}\\.json\` \\| \`${hash}\` \\|`));
    assert.ok(at > 0, `${size}.json's hash in the README's table`);
    assert.ok(at > lastInventory, `${size}.json's hash after the inventories' hashes`);
  }
});

// P3-build (hub #302): the preregistration's P3 sections, written before G2,
// with the P1 and P2 sections untouched. Every fixed text a model reads that
// the benchmark wrote is quoted word for word; the request parameters, the
// flat-1000 draw and the per-configuration hashes (G0-9) are the ones the
// runner computes.

const P3_SECTIONS = [
  'Configurations (P3)',
  'Models and request parameters (P3)',
  'Repeats, cap, run order and fallback (P3)',
  'Metric definitions (P3)',
  "The larger models' stage (P3)",
  'What the run will not conclude (P3)',
  'Per-configuration hashes (P3)',
];
/** The SHA-256 of the text before "## Configurations (P3)" at P2's head
 *  (0250e3f): P1's and P2's sections. */
const P1_P2_SHA256 = 'bc54125b8443fb8df07564083fe65179f7d31bee7d259263664a64e904a6983a';

const section = (prereg, title) => {
  const at = prereg.indexOf(`## ${title}\n`);
  assert.ok(at > 0, `the section ${title}`);
  const next = prereg.indexOf('\n## ', at + 3);
  return prereg.slice(at, next === -1 ? undefined : next);
};

test('P3-build: every P3 section is written, and the P1 and P2 sections are as P2 left them', () => {
  const prereg = read('preregistration/s1.md');
  const head = prereg.slice(0, prereg.indexOf('## Configurations (P3)'));
  assert.equal(createHash('sha256').update(head).digest('hex'), P1_P2_SHA256);
  for (const title of P3_SECTIONS) assert.ok(section(prereg, title).split('\n').filter((l) => l.trim() && !l.startsWith('## ')).length >= 3, `${title} is written`);
});

test("P3-build: the benchmark's fixed texts and tools are quoted word for word", async () => {
  const prereg = read('preregistration/s1.md');
  const t = await load('runner/texts.mjs');
  const sl = await load('runner/shortlist.mjs');
  assert.ok(prereg.includes(`\`\`\`json\n${JSON.stringify(t.FIND_SOURCE_TOOL, null, 2)}\n\`\`\``), 'find_source: name, description and schema');
  assert.ok(prereg.includes(`\`\`\`json\n${JSON.stringify(t.SELECT_SOURCES_TOOL, null, 2)}\n\`\`\``), 'select_sources');
  for (const text of [t.FIND_SOURCE_TEXT.found(['nyc_charter', 'data_ny_gov']), t.FIND_SOURCE_TEXT.found(['nyc_charter']), t.FIND_SOURCE_TEXT.none, t.FIND_SOURCE_TEXT.limit, t.BUILDER_SYSTEM, t.BUILDER_OUTPUT_RULE]) {
    assert.ok(prereg.includes(`> ${text}\n`), `quoted: ${text.slice(0, 50)}`);
  }
  assert.equal(t.FIND_SOURCE_LIMIT, 2);
  assert.match(prereg, /question, a blank line, `---`, a blank line, and the router's directory/);
  assert.equal(t.builderUserMessage('Q?', 'DIR'), 'Q?\n\n---\n\nDIR');
  for (const words of [sl.P1_GENERIC_WORDS, sl.INSTITUTION_WORDS]) assert.ok(prereg.includes(`\`\`\`text\n${words}\n\`\`\``));
  const rules = read('inventories/rules.mjs');
  assert.ok(rules.includes(`'${sl.P1_GENERIC_WORDS}'`), "P1's generic words, copied as rules.mjs holds them");
  assert.match(section(prereg, 'Configurations (P3)'), /simulat/, 'the §1.5 simulation is named');
});

test('P3-build: the request parameters, the flat-1000 draw and the snapshot read are the runner’s', async () => {
  const prereg = read('preregistration/s1.md');
  const { MODELS, resolveModel } = await load('runner/models.mjs');
  for (const slug of Object.keys(MODELS)) assert.ok(prereg.includes(`| \`${slug}\``) && prereg.includes(`\`${JSON.stringify(resolveModel(slug).params(4000))}\``), slug);
  const plan = JSON.parse(read('runner/plans/s1.json'));
  const step = plan.steps.find((s) => s.id === 'flat-1000');
  const qs = JSON.parse(read('questions/1000.json')).questions;
  const rank = (id) => createHash('sha256').update(`${step.questionIds.seed}\0${id}`).digest('hex');
  const drawn = new Set([...qs].sort((a, b) => (rank(a.id) < rank(b.id) ? -1 : 1)).slice(0, step.questionIds.draw).map((q) => q.id));
  assert.ok(prereg.includes(qs.filter((q) => drawn.has(q.id)).map((q) => q.id).join(', ')), 'the 50 drawn ids');
  const snap = JSON.parse(read('runner/openrouter-models.json'));
  assert.ok(prereg.includes(snap.source.modelList.sha256) && prereg.includes(snap.source.modelList.readAt));
  const readme = read('README.md').split('\n');
  const from = readme.findIndex((l) => l === '| | R5 | The app today, and this runner |') + 1;
  const to = readme.findIndex((l) => l.startsWith('| A call of any tool but `load_source`')) + 1;
  assert.ok(from > 0 && to > from);
  assert.ok(prereg.includes(`\`benchmark/README.md\`'s table (lines ${from}-${to})`), "the note points at the README table's lines");
});

test("P3-build: the per-configuration hashes are the router's, for every configuration of the plan", async () => {
  const prereg = read('preregistration/s1.md');
  const { createSession } = await load('runner/session.mjs');
  const { canonicalJson } = await import('@typedstandards/civic-typed-router');
  const plan = JSON.parse(read('runner/plans/s1.json'));
  const pkg = JSON.parse(readFileSync(new URL('../../packages/civic-typed-router/package.json', import.meta.url), 'utf8'));
  const table = section(prereg, 'Per-configuration hashes (P3)');
  const configs = [...new Set(plan.steps.map((s) => s.config))];
  assert.equal(configs.length, 16);
  for (const config of configs) {
    const s = plan.steps.find((x) => x.config === config);
    const inventory = JSON.parse(readFileSync(new URL(`../../${s.inventory}`, import.meta.url), 'utf8'));
    const h = (await createSession({ inventory, configName: config, today: '2026-11-03', routerPackage: pkg })).hashes();
    assert.ok(table.includes(`| \`${config}\` | \`${canonicalJson(h.routingConfiguration)}\` | \`${h.routingConfigurationHash}\` | \`${h.firstRequestDefinitionHash}\` |`), config);
  }
});
