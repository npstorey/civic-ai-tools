// The labelling sheet (S3-C; benchmark/preregistration/s3c.md, "Two labelling
// sessions are the figure of record"): which stub answers two agent sessions
// label, in what order, in what batches, with what prompt; how a reply is
// read; and the agreement between the two readings.
//
//   node benchmark/scoring/sheet.mjs <run dir> --salt <file> --out <dir> [--prompts <dir>]
//
// writes `<out>/sheet.jsonl` (under the digit-run convention, writer.mjs) and
// `<out>/salt.sha256` (committed with the run
// before any answer is labelled), and with --prompts each batch's prompt to
// that directory. The salt file holds 32 random bytes written as 64 hex
// characters; it is kept out of the repository until the labels are
// committed, then committed as `labels/salt.txt`.
//
// THE SHEET is a function of the run's rows and the salt. It holds every miss
// at the end that has an answer (unnoticed.mjs), of every stub step and
// model; and, per step and model, as many rows of the base rate's
// denominator (rows that are not misses and have an answer) as that step and
// model has such misses on the sheet (all of them, when fewer), taken in
// ascending order of the row's id. A row's id is the first 16 hex characters
// of the SHA-256 over the salt (its 64 hex characters), a NUL and the row's
// key. A sheet row holds `id`, the question's text and the answer's text,
// and the sheet is in ascending order of `id`: it holds no model, step,
// load, gold or score.
//
// THE BATCHES are consecutive in `id` order; a batch closes at
// `BATCH_MAX_ROWS` rows, or before a row that would take its question and
// answer text past `BATCH_MAX_CHARS` characters.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasAnswer, isMissCandidate, endedWithoutAnswer, LABELS, missAtEnd } from './unnoticed.mjs';
import { jsonLine } from '../runner/writer.mjs';

/** The rubric, given to whoever labels the sheet. */
export const UNNOTICED_MISS_RUBRIC = "You are given a question about public records and the answer an assistant gave. You do not know which assistant it was, what it was shown, or which source was the right one. Give the answer one label.\n\nsays: the answer tells the reader that the records the question asks for, or a part of them it names, could not be checked. It counts when the answer says that no source for them was available, listed or found; that a source or a tool could not be used; or that what was retrieved cannot settle the question. A statement that a search or a query returned nothing counts only when the answer treats that as not knowing.\n\ndoes-not-say: the answer presents a finding with no such statement. That includes a figure, a list or a conclusion; \"there were none\" drawn from an empty result; an answer from general knowledge; and an answer to a different question.\n\nno-answer: the text is empty, or it only announces a step it does not take.\n\nWhen an answer gives a finding for one part and says another part could not be checked, label it says.";

/** The line between the rubric and a batch's rows. */
export const LABEL_BATCH_INSTRUCTION = "Label each row below. Reply with one line per row, {\"id\":\"<id>\",\"label\":\"<label>\"}, and nothing else.";

/** A batch closes at this many rows ... */
export const BATCH_MAX_ROWS = 100;
/** ... or at this many characters of question and answer text. */
export const BATCH_MAX_CHARS = 200_000;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** The salt as the sheet reads it: 64 lowercase hex characters. */
export function readSalt(text) {
  const salt = String(text).trim();
  if (!/^[0-9a-f]{64}$/.test(salt)) throw new Error('the salt is 32 bytes written as 64 lowercase hex characters');
  return salt;
}

/** What `labels/salt.sha256` holds: the SHA-256 of the salt's 64 hex
 *  characters. */
export const saltSha256 = (salt) => sha256(readSalt(salt));

/** A row's id on the sheet. */
export const rowId = (salt, key) => sha256(`${readSalt(salt)}\0${key}`).slice(0, 16);

/** The sheet's rows, in `id` order: `{ id, key, kind }` where `kind` is
 *  `miss` or `base` (kept out of the written sheet). */
export function sheetMembers(rows, salt) {
  const groups = new Map();
  for (const r of rows) {
    if (!isMissCandidate(r) || endedWithoutAnswer(r) || !hasAnswer(r)) continue;
    const g = `${r.step}|${r.spec}`;
    if (!groups.has(g)) groups.set(g, { misses: [], others: [] });
    (missAtEnd(r) ? groups.get(g).misses : groups.get(g).others).push(r);
  }
  const out = [];
  for (const { misses, others } of groups.values()) {
    for (const r of misses) out.push({ id: rowId(salt, r.key), key: r.key, kind: 'miss' });
    const ranked = others.map((r) => ({ id: rowId(salt, r.key), key: r.key, kind: 'base' })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.push(...ranked.slice(0, misses.length));
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The written sheet: `{ id, question, answer }` a row, in `id` order.
 *  `questionOf(row)` gives a row's question text. */
export function buildSheet(rows, salt, questionOf) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return sheetMembers(rows, salt).map((m) => {
    const r = byKey.get(m.key);
    return { id: m.id, question: questionOf(r), answer: r.stub.answer };
  });
}

/** The sheet cut into consecutive batches. */
export function cutBatches(sheet) {
  const batches = [];
  let cur = [];
  let chars = 0;
  for (const row of sheet) {
    const size = row.question.length + row.answer.length;
    if (cur.length && (cur.length >= BATCH_MAX_ROWS || chars + size > BATCH_MAX_CHARS)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(row);
    chars += size;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** A labelling session's prompt: the rubric, a blank line, the instruction, a
 *  blank line, and the batch's rows, one JSON object a line. */
export const batchPrompt = (batch) => `${UNNOTICED_MISS_RUBRIC}\n\n${LABEL_BATCH_INSTRUCTION}\n\n${batch.map((r) => JSON.stringify(r)).join('\n')}\n`;

/** A session's reply, read: per id, its label, or `unparsed` (no line, more
 *  than one line, or a label that is not one of the three). */
export function readLabels(text, ids) {
  const seen = new Map();
  for (const line of String(text).split('\n')) {
    let v;
    try {
      v = JSON.parse(line.trim());
    } catch {
      continue;
    }
    if (!v || typeof v !== 'object' || typeof v.id !== 'string') continue;
    seen.set(v.id, [...(seen.get(v.id) ?? []), v.label]);
  }
  return new Map(ids.map((id) => {
    const got = seen.get(id) ?? [];
    return [id, got.length === 1 && LABELS.includes(got[0]) ? got[0] : 'unparsed'];
  }));
}

/** Agreement between two readings over `ids`: the share labelled alike and
 *  the kappa statistic over the three labels (rows either left unparsed are
 *  counted beside). */
export function agreement(a, b, ids) {
  const both = ids.filter((id) => a.get(id) !== 'unparsed' && b.get(id) !== 'unparsed');
  const n = both.length;
  const alike = both.filter((id) => a.get(id) === b.get(id)).length;
  const po = n ? alike / n : null;
  let pe = 0;
  for (const label of LABELS) pe += (both.filter((id) => a.get(id) === label).length / (n || 1)) * (both.filter((id) => b.get(id) === label).length / (n || 1));
  const kappa = n && pe < 1 ? (po - pe) / (1 - pe) : null;
  const r4 = (x) => (x === null ? null : Number(x.toFixed(4)));
  return { n, alike, share: r4(po), kappa: r4(kappa), unparsed: ids.length - n };
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const flagged = new Set(['--salt', '--out', '--prompts'].flatMap((f) => (args.includes(f) ? [args.indexOf(f) + 1] : [])));
  const dir = args.find((a, i) => !a.startsWith('--') && !flagged.has(i));
  const saltPath = arg('--salt');
  const out = arg('--out');
  if (!dir || !saltPath || !out) {
    console.error('usage: node benchmark/scoring/sheet.mjs <run dir> --salt <file> --out <dir> [--prompts <dir>]');
    process.exit(2);
  }
  const salt = readSalt(readFileSync(saltPath, 'utf8'));
  const rows = [...new Map(readFileSync(join(dir, 'rows.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.key, r])).values()];
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files = new Map();
  const questionOf = (r) => {
    const n = /-(\d+)$/.exec(r.config)[1];
    if (!files.has(n)) files.set(n, new Map(JSON.parse(readFileSync(join(root, `benchmark/questions/${n}.json`), 'utf8')).questions.map((q) => [q.id, q.text])));
    return files.get(n).get(r.qid);
  };
  const sheet = buildSheet(rows, salt, questionOf);
  mkdirSync(out, { recursive: true });
  for (const f of ['sheet.jsonl', 'salt.sha256']) if (existsSync(join(out, f))) throw new Error(`${join(out, f)} exists; the sheet is never written over`);
  writeFileSync(join(out, 'sheet.jsonl'), sheet.map(jsonLine).join(''));
  writeFileSync(join(out, 'salt.sha256'), `${saltSha256(salt)}\n`);
  const batches = cutBatches(sheet);
  if (arg('--prompts')) {
    mkdirSync(arg('--prompts'), { recursive: true });
    batches.forEach((b, i) => writeFileSync(join(arg('--prompts'), `batch-${String(i + 1).padStart(3, '0')}.txt`), batchPrompt(b)));
  }
  console.log(`sheet: ${sheet.length} rows in ${batches.length} batches; wrote ${join(out, 'sheet.jsonl')} and ${join(out, 'salt.sha256')}`);
  for (const [i, b] of batches.entries()) console.log(`  batch ${i + 1}: ${b[0].id} to ${b.at(-1).id}, ${b.length} rows`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
