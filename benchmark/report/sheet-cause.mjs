#!/usr/bin/env node
// The sheet's cause (hub #318, M3): a report-side measurement the
// preregistration did not name (the seat's ruling, hub #318 comment
// 6983122829). It explains the label sheet's size against the
// preregistration's estimate of "about 1,186" rows
// (benchmark/preregistration/s3c.md:387-388) and concludes nothing about the
// round.
//
// Usage: node benchmark/report/sheet-cause.mjs <runs/<date> dir> [--out <file>] [--check]
//
//   Writes `<dir>/sheet-cause.out.md` (or --out). With --check, writes
//   nothing and exits 1 when that file is not what this script writes.
//
// WHAT IT READS: the `rows.jsonl` of the run directory under <dir> whose
// `summary.json` has mode `evaluations` (the summary is read for its mode
// only).
//
// WHAT IT COUNTS, per step and model, over the stub rows of item one of the
// unnoticed miss (s3c.md:316-318: complete rows that sent a request, whose raw
// gold needs a source, and that did not end by `size` or `error`):
//   - a miss at S1's last request: none of the row's acceptable sets lies
//     within what it had loaded by S1's last request, the request after the
//     loads (`loaded2`, or `loaded1` where there was none, as
//     benchmark/scoring/offered.mjs reads a row's loads);
//   - a miss at the end: the scorer's `missAtEnd` (benchmark/scoring/unnoticed.mjs),
//     over everything the row loaded by its end (`stub.loadedEnd`);
//   - recovered: a miss at S1's last request that is not a miss at the end;
//   - new: a miss at the end that was not a miss at S1's last request.
// The estimate counted the first on S1's rows; the sheet holds the second.
// The scorer's predicates are imported, not copied; nothing under
// benchmark/scoring/ or benchmark/runner/ changes, so the inputs' hash does
// not move (s3c.md:613-615).

import { createReadStream, existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { endedWithoutAnswer, isMissCandidate, missAtEnd } from '../scoring/unnoticed.mjs';

const FAMILIES = ['builder+search', 'builder', 'shortlist+search'];
const sizeOf = (step) => Number(/-(\d+)$/.exec(step)?.[1] ?? 0);
const familyOf = (step) => step.replace(/-\d+$/, '');
const within = (set, of) => set.every((alias) => of.includes(alias));

/** A miss at S1's last request: true or false for a row of item one's denominator. */
export const missAtS1Last = (row) => !row.acceptable.some((set) => within(set, row.loaded2 ?? row.loaded1 ?? []));

/** The evaluations' run directory under `dir`. */
function runDir(dir) {
  const found = readdirSync(dir)
    .sort()
    .filter((n) => statSync(join(dir, n)).isDirectory() && existsSync(join(dir, n, 'summary.json')))
    .filter((n) => JSON.parse(readFileSync(join(dir, n, 'summary.json'), 'utf8')).mode === 'evaluations');
  if (found.length !== 1) throw new Error(`expected one evaluations run under ${dir}, found ${found.length}`);
  return found[0];
}

/** The counts, per step and model, and their totals. */
export async function countCause(dir) {
  const name = runDir(dir);
  const groups = new Map();
  const lines = createInterface({ input: createReadStream(join(dir, name, 'rows.jsonl')), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (r.role !== 'main' || r.transport !== 'stub') continue;
    const key = `${r.step}\t${r.spec}`;
    if (!groups.has(key)) groups.set(key, { step: r.step, model: r.spec, rows: 0, s1Last: 0, end: 0, recovered: 0, fresh: 0 });
    if (!isMissCandidate(r) || endedWithoutAnswer(r)) continue;
    const g = groups.get(key);
    const a = missAtS1Last(r);
    const b = missAtEnd(r) === true;
    g.rows++;
    if (a) g.s1Last++;
    if (b) g.end++;
    if (a && !b) g.recovered++;
    if (b && !a) g.fresh++;
  }
  const list = [...groups.values()].sort(
    (x, y) => FAMILIES.indexOf(familyOf(x.step)) - FAMILIES.indexOf(familyOf(y.step)) || sizeOf(x.step) - sizeOf(y.step) || x.model.localeCompare(y.model),
  );
  const total = list.reduce((t, g) => ({ rows: t.rows + g.rows, s1Last: t.s1Last + g.s1Last, end: t.end + g.end, recovered: t.recovered + g.recovered, fresh: t.fresh + g.fresh }), { rows: 0, s1Last: 0, end: 0, recovered: 0, fresh: 0 });
  return { name, list, total };
}

/** The file, as markdown. */
export async function renderCause(dir) {
  const { name, list, total } = await countCause(dir);
  const code = (s) => `\`${s}\``;
  const row = (cells) => `| ${cells.join(' | ')} |`;
  const out = [];
  out.push(
    `**The sheet's cause: misses at S1's last request and at the end** (${code(`${name}/rows.jsonl`)}, read by ${code('benchmark/report/sheet-cause.mjs')}). A report-side measurement that the preregistration did not name: it explains the sheet's size against the preregistration's estimate, which counted misses at S1's last request on S1's rows, and it concludes nothing about the round. Over the rows of item one of the unnoticed miss, per step and model: misses at S1's last request (the request after the loads), misses at the end (the scorer's ${code('missAtEnd')}, which the sheet holds), the misses at S1's last request that the later requests recovered, and the misses at the end that were not misses at S1's last request.`,
    '',
    row(['Configuration', 'Model', "Rows of item one", "Misses at S1's last request", 'Misses at the end', 'Recovered by the later requests', "Misses at the end that were not at S1's last"]),
    `|${Array(7).fill('---').join('|')}|`,
  );
  for (const g of list) out.push(row([code(g.step), code(g.model), g.rows, g.s1Last, g.end, g.recovered, g.fresh]));
  out.push(row(['every stub step', 'both models', total.rows, total.s1Last, total.end, total.recovered, total.fresh]));
  return `${out.join('\n')}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const dir = args.find((a, i) => !a.startsWith('--') && (outAt === -1 || i !== outAt + 1));
  if (!dir) {
    console.error('usage: node benchmark/report/sheet-cause.mjs <runs/<date> dir> [--out <file>] [--check]');
    process.exit(2);
  }
  const out = outAt === -1 ? join(dir, 'sheet-cause.out.md') : args[outAt + 1];
  const text = await renderCause(resolve(dir));
  if (args.includes('--check')) {
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    console.log(same ? `${out}: as written` : `${out}: not what sheet-cause.mjs writes`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, text);
  console.log(`wrote ${out}`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();
