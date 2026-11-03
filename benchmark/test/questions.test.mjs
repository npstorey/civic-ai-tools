// A2.1 (hub #302, S1 P2): the question set and its gold, one file per
// inventory size.
//
//   - every file validates against questions/schema.json, and none holds a
//     number, a boolean or null;
//   - every `acceptable` alias is an entry of that size's inventory, and each
//     file names its inventory by path, id, version and canonical hash;
//   - every stratum is in its enum, and every trap type has at least ten
//     questions;
//   - the four files hold the same questions: ids, texts, kinds and strata,
//     in the same order;
//   - each `.sha256` is the router's canonicalJson SHA-256 of the parsed file,
//     and build.mjs --check rebuilds the four files byte for byte;
//   - R5's 49 questions are the seed: ids and texts unchanged, and a note
//     wherever a label differs from R5's;
//   - the strata are covered, and at 200 and 1,000 some question that needs a
//     record has the gold "no source in this inventory".
//
// A missing file fails at an assertion, so the test is red before P2 labels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const at = (rel) => new URL(`../${rel}`, import.meta.url);
const SIZES = [7, 50, 200, 1000];
const readJson = (rel) => JSON.parse(readFileSync(at(rel), 'utf8'));

/** A question file by size, parsed; an assertion failure when it is absent. */
function questions(size) {
  assert.ok(existsSync(at(`questions/${size}.json`)), `benchmark/questions/${size}.json exists`);
  return readJson(`questions/${size}.json`);
}

/** Every value in `value` that is not a string, an array or an object. */
function nonStrings(value, path = '$') {
  if (typeof value === 'string') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonStrings(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => nonStrings(v, `${path}.${k}`));
  return [`${path} = ${JSON.stringify(value)}`];
}

const schema = () => readJson('questions/schema.json');
const strataEnums = () => {
  const props = schema().definitions.question.properties.strata.properties;
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v.enum]));
};
const key = (set) => [...set].sort().join(',');
const sameLabel = (a, b) => JSON.stringify(a.map(key).sort()) === JSON.stringify(b.map(key).sort());
/** The gold says "no source in this inventory": its only set is the empty one. */
const noSource = (q) => q.acceptable.length === 1 && q.acceptable[0].length === 0;

test('A2.1: every question file validates against schema.json and holds no number, boolean or null', () => {
  const validate = new Ajv({ allErrors: true }).compile(schema());
  // The test of the test: the walk finds each of the three.
  assert.deepEqual(nonStrings({ a: ['x', { b: 7 }], c: true, d: null }), ['$.a[1].b = 7', '$.c = true', '$.d = null']);
  for (const size of SIZES) {
    const file = questions(size);
    assert.equal(validate(file), true, `${size}.json: ${JSON.stringify(validate.errors?.slice(0, 3))}`);
    assert.deepEqual(nonStrings(file), [], `${size}.json`);
  }
  // The schema bites: a stratum out of its enum, `sources` as a number, a set
  // holding a number.
  const file = questions(7);
  const q = file.questions[0];
  const one = (question) => validate({ ...file, questions: [question] });
  assert.equal(one(q), true);
  assert.equal(one({ ...q, strata: { ...q.strata, place: 'somewhere' } }), false);
  assert.equal(one({ ...q, strata: { ...q.strata, sources: 1 } }), false);
  assert.equal(one({ ...q, strata: { ...q.strata, trap: 'a-new-trap' } }), false);
  assert.equal(one({ ...q, acceptable: [[7]] }), false);
});

test("A2.1: every acceptable alias is an entry of that size's inventory, and each file names its inventory", () => {
  for (const size of SIZES) {
    const file = questions(size);
    const inv = readJson(`inventories/${size}.json`);
    const aliases = new Set(inv.entries.map((e) => e.alias));
    assert.deepEqual(file.inventory, {
      path: `benchmark/inventories/${size}.json`,
      id: inv.id,
      version: inv.version,
      canonicalSha256: readFileSync(at(`inventories/${size}.json.sha256`), 'utf8').trim(),
    });
    for (const q of file.questions) {
      for (const set of q.acceptable) {
        for (const alias of set) assert.ok(aliases.has(alias), `${size}.json ${q.id}: ${alias} is an entry of inventories/${size}.json`);
        assert.deepEqual(set, [...set].sort(), `${size}.json ${q.id}: each set's aliases in ascending order`);
      }
      const keys = q.acceptable.map(key);
      assert.equal(new Set(keys).size, keys.length, `${size}.json ${q.id}: no set twice`);
      // Rule 1: a set is minimal, so no set holds another non-empty set. An
      // ambiguous question's readings may nest (one reading asks for both
      // records), so the check is on the others.
      if (q.kind !== 'ambiguous') for (const a of q.acceptable) {
        for (const b of q.acceptable) {
          if (a !== b && a.length > 0 && a.every((x) => b.includes(x))) assert.fail(`${size}.json ${q.id}: [${b}] holds [${a}]`);
        }
      }
    }
    for (const id of file.probeIds) assert.ok(file.questions.some((q) => q.id === id), `${size}.json: probe ${id} is a question`);
  }
});

test('A2.1: every stratum is in its enum, and every trap type has at least ten questions', () => {
  const enums = strataEnums();
  for (const size of SIZES) {
    for (const q of questions(size).questions) {
      for (const [k, values] of Object.entries(enums)) assert.ok(values.includes(q.strata[k]), `${size}.json ${q.id}: strata.${k} = ${q.strata[k]}`);
    }
  }
  const qs = questions(7).questions;
  for (const trap of enums.trap.filter((t) => t !== 'none')) {
    const n = qs.filter((q) => q.strata.trap === trap).length;
    assert.ok(n >= 10, `${trap}: ${n} questions, at least ten`);
  }
  // Every place stratum and category is covered, and every count of sources.
  for (const k of ['place', 'category', 'sources']) {
    for (const value of enums[k]) assert.ok(qs.some((q) => q.strata[k] === value), `some question has strata.${k} = ${value}`);
  }
  // A question that needs no record is kind `none`, and the reverse.
  for (const q of qs) assert.equal(q.strata.sources === '0', q.kind === 'none', `${q.id}: sources "0" exactly when kind is none`);
});

test('A2.1: the four files hold the same questions: ids, texts, kinds and strata, in order', () => {
  const shape = (size) => questions(size).questions.map(({ id, kind, text, strata }) => ({ id, kind, text, strata }));
  const base = shape(7);
  assert.equal(new Set(base.map((q) => q.id)).size, base.length, 'ids are unique');
  for (const size of SIZES.slice(1)) assert.deepEqual(shape(size), base, `${size}.json`);
  for (const size of SIZES.slice(1)) assert.deepEqual(questions(size).probeIds, questions(7).probeIds, `${size}.json probeIds`);
});

test("A2.1: each .sha256 is the router's canonicalJson SHA-256 of the parsed file, and build.mjs --check rebuilds the files", () => {
  for (const size of SIZES) {
    const file = questions(size);
    assert.ok(existsSync(at(`questions/${size}.json.sha256`)), `${size}.json.sha256 exists`);
    const recorded = readFileSync(at(`questions/${size}.json.sha256`), 'utf8');
    assert.match(recorded, /^[0-9a-f]{64}\n$/, `${size}.json.sha256`);
    assert.equal(recorded.trim(), sha256Hex(canonicalJson(file)), `${size}.json.sha256`);
  }
  const run = spawnSync(process.execPath, ['benchmark/questions/build.mjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stderr}`);
  for (const size of SIZES) assert.match(run.stdout, new RegExp(`\\b${size}\\.json, ${size}\\.json\\.sha256\\b`), `${size}.json and its hash are rebuilt`);
});

test("A2.1: R5's 49 questions are the seed, and a seed label that changes carries a note", () => {
  const r5 = readJson('runner/fixtures/r5-questions.json').questions;
  assert.equal(r5.length, 49);
  for (const size of SIZES) {
    const byId = new Map(questions(size).questions.map((q) => [q.id, q]));
    for (const seed of r5) {
      const q = byId.get(seed.id);
      assert.ok(q, `${size}.json holds ${seed.id}`);
      assert.equal(q.text, seed.text, `${seed.id}: R5's text`);
      assert.equal(q.kind, seed.kind, `${seed.id}: R5's kind`);
      if (!sameLabel(q.acceptable, seed.acceptable)) assert.ok(q.note, `${size}.json ${seed.id}: the label differs from R5's, so a note says why`);
    }
  }
});

test('A2.1: at 200 and 1,000 some questions that need a record have no source in the inventory, each with a note', () => {
  for (const size of SIZES) {
    for (const q of questions(size).questions) {
      if (noSource(q) && q.kind !== 'none') assert.ok(q.note, `${size}.json ${q.id}: no source in this inventory, so a note says what is missing`);
    }
  }
  for (const size of [200, 1000]) {
    const n = questions(size).questions.filter((q) => q.kind !== 'none' && noSource(q)).length;
    assert.ok(n >= 5, `${size}.json: ${n} questions that need a record have no source here`);
  }
  // The no-data questions stay in at every size.
  for (const size of SIZES) {
    const none = questions(size).questions.filter((q) => q.kind === 'none');
    assert.ok(none.length >= 4, `${size}.json keeps the no-data questions`);
    for (const q of none) assert.ok(noSource(q), `${size}.json ${q.id}: a no-data question's gold is [[]]`);
  }
});
