#!/usr/bin/env node
// Builds the benchmark's question files, deterministically, from gold.mjs and
// the four frozen inventories: 7.json, 50.json, 200.json and 1000.json, each
// with its hash beside it.
//
// Usage:
//   node benchmark/questions/build.mjs --check   rebuild and compare, byte for byte; exit 1 on a difference
//   node benchmark/questions/build.mjs --write   write every file
//
// THE GOLD (README.md, "How the files are made"). gold.mjs writes each
// question once: its text, kind and strata, and its gold as readings, each a
// list of the records it needs, each record with every alias of the
// 1,000-entry inventory that holds it (the README's rules). A file's label is
// that gold kept to its own inventory's aliases and expanded: for each
// reading whose every record has a holder there, one set per combination of
// one holder per record (rule 2); `[]` added where the question may be
// answered by asking (rule 10); and `[[]]`, no source in this inventory,
// where no set remains (rule 3).
//
// THE NOTES (rule 11). A question's note is its own text, the text for that
// size, and two clauses written here: which record no entry holds, where the
// label is `[[]]`; and, for R5's seed questions, how the label differs from
// R5's, by the aliases it adds and those this inventory lacks.
//
// THE HASH beside each file (`<n>.json.sha256`) is the lowercase hex SHA-256
// of the router's `canonicalJson` of the parsed file, as the inventories have.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256Hex } from '@typedstandards/civic-typed-router';
import { PROBE_IDS, QUESTIONS } from './gold.mjs';

export const SIZES = [7, 50, 200, 1000];
const here = (rel) => new URL(rel, import.meta.url);
const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

const inventories = Object.fromEntries(SIZES.map((size) => [size, readJson(here(`../inventories/${size}.json`))]));
const entryOf = new Map(inventories[1000].entries.map((e) => [e.alias, e]));
const R5 = new Map(readJson(here('../runner/fixtures/r5-questions.json')).questions.map((q) => [q.id, q]));

const setKey = (set) => set.join(',');
const sortSets = (sets) => [...new Map(sets.map((s) => [setKey(s), s])).values()].sort((a, b) => (setKey(a) < setKey(b) ? -1 : setKey(a) > setKey(b) ? 1 : 0));
const labelText = (sets) => JSON.stringify(sets);
const sameLabel = (a, b) => labelText(sortSets(a.map((s) => [...s].sort()))) === labelText(sortSets(b.map((s) => [...s].sort())));

/** Every combination of one holder per record, each set sorted and deduplicated. */
function product(lists) {
  return lists.reduce((acc, list) => acc.flatMap((set) => list.map((alias) => [...set, alias])), [[]]).map((set) => [...new Set(set)].sort());
}

/** The label of `q` against the inventory of `size`, and the records no entry
 *  of it holds. */
export function labelAt(q, size) {
  const present = new Set(inventories[size].entries.map((e) => e.alias));
  const sets = [];
  const missing = [];
  for (const reading of q.readings) {
    const held = reading.map((record) => record.holders.filter((a) => present.has(a)));
    held.forEach((h, i) => h.length === 0 && missing.push(reading[i].record));
    if (held.every((h) => h.length > 0)) sets.push(...product(held));
  }
  if (q.ask) sets.push([]);
  const label = sortSets(sets);
  // Rule 2: a set is minimal. A reading whose set holds a smaller set of
  // another reading is dropped, except where the question is ambiguous and
  // the larger set is a reading of its own.
  const minimal = q.kind === 'ambiguous' ? label : label.filter((s) => !label.some((t) => t !== s && t.length > 0 && t.length < s.length && t.every((a) => s.includes(a))));
  return { acceptable: minimal.length ? minimal : [[]], missing: [...new Set(missing)] };
}

/** How an alias came to hold a record, for a note. */
function role(alias) {
  const e = entryOf.get(alias);
  if (e.synthetic === 'true') return `${alias} (a ${e.distractor.kind} ${e.distractor.kind === 'wrapper' ? 'over' : 'of'} ${e.distractor.of})`;
  if (e.tools === 'not-captured') return `${alias} (a registry entry, rule 8)`;
  if (e.kind === 'pack' && e.filter?.portal) return `${alias} (the ${e.base === 'socrata' ? 'Socrata' : 'CKAN'} portal pack for ${e.filter.portal})`;
  return alias;
}

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** The note for `q` at `size`, or undefined. */
function noteAt(q, size, { acceptable, missing }) {
  const parts = [];
  if (q.note) parts.push(q.note);
  const order = (key) => Number(key.replace('+', ''));
  for (const [key, text] of Object.entries(q.notes ?? {}).sort(([a], [b]) => order(a) - order(b))) {
    const from = key.endsWith('+') ? Number(key.slice(0, -1)) : null;
    if (from === null ? Number(key) === size : size >= from) parts.push(text);
  }
  const noSource = acceptable.length === 1 && acceptable[0].length === 0;
  if (noSource && q.kind !== 'none' && missing.length) parts.push(`No entry in this inventory holds ${list(missing)}.`);
  const r5 = R5.get(q.id);
  if (r5 && !sameLabel(acceptable, r5.acceptable)) {
    const before = new Set(r5.acceptable.flat());
    const after = new Set(acceptable.flat());
    const present = new Set(inventories[size].entries.map((e) => e.alias));
    const added = [...after].filter((a) => !before.has(a)).sort();
    const absent = [...before].filter((a) => !present.has(a)).sort();
    const clauses = [];
    if (added.length) clauses.push(`this inventory adds ${list(added.map(role))}`);
    if (absent.length) clauses.push(`${list(absent)} ${absent.length === 1 ? 'is' : 'are'} not in this inventory`);
    if (q.r5) clauses.push(q.r5);
    parts.push(`Differs from R5's label ${labelText(r5.acceptable)}: ${clauses.join('; ')}.`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

/** The question file for `size`, as an object. */
export function questionFile(size) {
  const inv = inventories[size];
  return {
    schema: 'civic-questions/1',
    inventory: {
      path: `benchmark/inventories/${size}.json`,
      id: inv.id,
      version: inv.version,
      canonicalSha256: readFileSync(here(`../inventories/${size}.json.sha256`), 'utf8').trim(),
    },
    note: `The benchmark's questions, labelled against benchmark/inventories/${size}.json by the rules in benchmark/questions/README.md, after the inventories' hashes were recorded and before any model call. Built by benchmark/questions/build.mjs from gold.mjs.`,
    probeIds: PROBE_IDS,
    questions: QUESTIONS.map((q) => {
      const label = labelAt(q, size);
      const note = noteAt(q, size, label);
      return { id: q.id, kind: q.kind, text: q.text, strata: q.strata, acceptable: label.acceptable, ...(note ? { note } : {}) };
    }),
  };
}

/** The file's text: one question per block, one acceptable set per line. */
function questionText(file) {
  const q = (x) => {
    const lines = [
      `      "id": ${JSON.stringify(x.id)}`,
      `      "kind": ${JSON.stringify(x.kind)}`,
      `      "text": ${JSON.stringify(x.text)}`,
      `      "strata": ${JSON.stringify(x.strata).replace(/":/g, '": ').replace(/,"/g, ', "')}`,
      `      "acceptable": [\n${x.acceptable.map((s) => `        ${JSON.stringify(s).replace(/","/g, '", "')}`).join(',\n')}\n      ]`,
    ];
    if (x.note) lines.push(`      "note": ${JSON.stringify(x.note)}`);
    return `    {\n${lines.join(',\n')}\n    }`;
  };
  const head = ['schema', 'inventory', 'note', 'probeIds'].map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(file[k], null, 2).replace(/\n/g, '\n  ')}`);
  return `{\n${head.join(',\n')},\n  "questions": [\n${file.questions.map(q).join(',\n')}\n  ]\n}\n`;
}

/** Every file this script writes, as `{ path, text }`, paths relative to this
 *  directory. */
export function builtFiles() {
  for (const q of QUESTIONS) {
    for (const reading of q.readings) {
      for (const record of reading) {
        for (const alias of record.holders) if (!entryOf.has(alias)) throw new Error(`${q.id}: ${alias} is not an entry of the 1,000-entry inventory`);
      }
    }
  }
  return SIZES.flatMap((size) => {
    const file = questionFile(size);
    const text = questionText(file);
    if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(file)) throw new Error(`${size}.json: the text does not parse back to the file`);
    return [
      { path: `${size}.json`, text },
      { path: `${size}.json.sha256`, text: `${sha256Hex(canonicalJson(file))}\n` },
    ];
  });
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    console.error('usage: node benchmark/questions/build.mjs --check | --write');
    process.exit(2);
  }
  const files = builtFiles();
  if (mode === '--write') {
    for (const f of files) writeFileSync(here(f.path), f.text);
    for (const f of files) console.log(`wrote benchmark/questions/${f.path}`);
    return;
  }
  const differ = [];
  for (const f of files) {
    let onDisk = null;
    try {
      onDisk = readFileSync(here(f.path), 'utf8');
    } catch {
      onDisk = null;
    }
    if (onDisk !== f.text) differ.push(onDisk === null ? `${f.path} is missing` : `${f.path} differs from its rebuild`);
  }
  if (differ.length) {
    console.error(`build --check: ${differ.join('; ')}. Run with --write and review the diff.`);
    process.exit(1);
  }
  console.log(`build --check: ${files.map((f) => f.path).join(', ')} rebuilt byte for byte.`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
