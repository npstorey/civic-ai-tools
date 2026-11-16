// S3-C (hub #318): benchmark/preregistration/s3c.md quotes every text a
// model reads that the round adds, word for word, once ("The texts, one
// place each"), and this test holds each equal to the runner's or the
// scorer's copy, as preregistration.test.mjs does for S1's: the stub's
// result, the app's note for a call that was not run, the final-answer
// request, the rubric, the batch instruction, the app's announcement rule's
// two constants, and the rule's phrases; and S1's texts as it quotes them.
// The per-configuration hashes it records are the runner's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const prereg = () => read('benchmark/preregistration/s3c.md');

/** A fenced block's body: the text between "```<lang>\n" and "\n```" that
 *  begins with `start`. */
function fenced(text, lang, start) {
  const open = `\`\`\`${lang}\n${start}`;
  const at = text.indexOf(open);
  assert.ok(at >= 0, `a ${lang} block beginning ${start.slice(0, 40)}`);
  const body = at + lang.length + 4;
  return text.slice(body, text.indexOf('\n```', body));
}

test("the round's texts, word for word: the stub's result, the unrun note, the final-answer request, the rubric, the batch instruction", async () => {
  const text = prereg();
  const stub = await load('runner/stub.mjs');
  const app = await load('runner/app-texts.mjs');
  const sheet = await load('scoring/sheet.mjs');
  for (const quoted of [stub.STUB_RESULT_TEXT, app.UNRUN_TOOL_CALL_NOTE, app.FINAL_ANSWER_REQUEST, sheet.LABEL_BATCH_INSTRUCTION]) {
    assert.equal(text.split(`\n> ${quoted}\n`).length - 1, 1, `quoted once: ${quoted.slice(0, 50)}`);
  }
  assert.ok(text.includes('(`STUB_RESULT_TEXT`)') && text.includes('(`UNRUN_TOOL_CALL_NOTE`;') && text.includes('(`FINAL_ANSWER_REQUEST`;') && text.includes('(`LABEL_BATCH_INSTRUCTION`)'));
  assert.equal(fenced(text, 'text', 'You are given a question'), sheet.UNNOTICED_MISS_RUBRIC, 'the rubric');
  assert.equal(app.APP_LOOP_SOURCE.sha256, '8707781231feb88e662836aade90b5b199372d7c30dab535b7df0bc4fad4169b');
  assert.ok(text.includes(app.APP_LOOP_SOURCE.sha256) && text.includes('1623bf167c00352062832d38b580d01072d5b374'), "the app's texts are pinned to the commit and file the preregistration names");
  assert.ok(text.includes(`(\`STUB_MAX_REQUESTS = ${stub.STUB_MAX_REQUESTS}\`)`));
  assert.match(text, /longer than 120,000 characters\s+\(`STUB_BODY_LIMIT`\)/);
  assert.equal(stub.STUB_BODY_LIMIT, 120000);
});

test("the app's announcement rule's two constants, as the preregistration quotes them", async () => {
  const text = prereg();
  const app = await load('runner/app-texts.mjs');
  assert.equal(fenced(text, 'text', 'const ANNOUNCEMENT_MAX_CHARS'), `const ANNOUNCEMENT_MAX_CHARS = ${app.ANNOUNCEMENT_MAX_CHARS};`);
  assert.equal(fenced(text, 'text', '/(?:'), `${app.DATA_STEP_COMMITMENT.toString()};`);
});

test("the rule's phrases, in the preregistration's order", async () => {
  const u = await load('scoring/unnoticed.mjs');
  assert.equal(fenced(prereg(), 'text', 'could not'), u.SAYS_PHRASES.join('\n'));
});

test("S1's texts, as the preregistration quotes them, are the runner's", async () => {
  const text = prereg();
  const t = await load('runner/texts.mjs');
  assert.ok(text.includes(`\`\`\`json\n${JSON.stringify(t.FIND_SOURCE_TOOL, null, 2)}\n\`\`\``), 'find_source');
  assert.ok(text.includes(`\`\`\`json\n${JSON.stringify(t.SELECT_SOURCES_TOOL, null, 2)}\n\`\`\``), 'select_sources');
  for (const quoted of [t.FIND_SOURCE_TEXT.found(['nyc_charter', 'data_ny_gov']), t.FIND_SOURCE_TEXT.found(['nyc_charter']), t.FIND_SOURCE_TEXT.none, t.FIND_SOURCE_TEXT.limit, t.BUILDER_SYSTEM, t.BUILDER_OUTPUT_RULE]) {
    assert.ok(text.includes(`\n> ${quoted}\n`), quoted.slice(0, 50));
  }
});

test('the per-configuration hashes it records are the runner’s, and the first request’s harness definition at the workspace’s router', async () => {
  const text = prereg();
  const { createSession } = await load('runner/session.mjs');
  const router = JSON.parse(read('packages/civic-typed-router/package.json'));
  const plan = JSON.parse(read('benchmark/runner/plans/s3c.json'));
  for (const s of plan.steps) {
    const inventory = JSON.parse(read(s.inventory));
    const h = (await createSession({ inventory, configName: s.config, today: plan.today, routerPackage: router, inventoryHash: sha256Hex(canonicalJson(inventory)) })).hashes();
    const row = text.split('\n').find((l) => l.startsWith(`| \`${s.config}\` |`));
    assert.ok(row, s.config);
    assert.ok(row.includes(`\`${h.routingConfigurationHash}\``), `${s.config}: ${h.routingConfigurationHash}`);
    if (s.config.startsWith('builder+search-')) assert.ok(row.includes(`\`${canonicalJson(h.routingConfiguration)}\``));
    if (router.version === '0.11.0') assert.ok(text.includes(`Its hash at tree 2 (router 0.11.0), as at \`1d97e0e\` (0.11.0), is\n\`${h.firstRequestDefinitionHash}\`.`));
  }
  // At most one placeholder is left: the calibrated bound's, which the sitting's dry run fills.
  const left = text.split('\n').filter((l) => l.includes('[placeholder]'));
  assert.ok(left.length <= 1 && left.every((l) => l.includes('until the dry run prints them')), left.join('\n'));
});
