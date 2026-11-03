#!/usr/bin/env node
// Rewrites R5's run files once, under the digit-run convention, into a
// directory that can be committed. Run once, for `benchmark/runs/2026-10-11-r5/`;
// kept so the copy can be remade from the originals and compared.
//
// Usage: node benchmark/runner/rewrite-r5.mjs <R5 run dir> <new dir>
//
// What changes, and nothing else:
//   - `rows.jsonl`, `baseline.jsonl`: each line parsed and written again by the
//     runner's writer, in the same order: costs as decimal strings of at most
//     eight places, a long digit run inside text escaped (it parses back
//     unchanged);
//   - `meta.json`: the same, and its `pricing` written per million tokens, as
//     the runner records prices;
//   - `r5-summary.json`: R5's own `summary.json` through the writer, less
//     `computedAt` and `runDir` (a clock and an absolute path on the machine
//     that ran it), so the originals' figures travel with the copy.
// The copy's own `summary.json` is the scorer's, over the rewritten files:
//   node benchmark/scoring/analyze.mjs <new dir> --out <new dir>/summary.json
// Nothing is written over an existing file.

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { jsonDocument, jsonLine } from './writer.mjs';
import { pricingPerMillion } from './pricing.mjs';

/** The rewritten texts of R5's files, keyed by file name. */
export function rewriteR5({ metaText, rowsText, baseText, summaryText }) {
  const lines = (text) => text.split('\n').filter(Boolean).map((l) => jsonLine(JSON.parse(l))).join('');
  const meta = JSON.parse(metaText);
  meta.pricing = Object.fromEntries(Object.entries(meta.pricing).map(([slug, p]) => [slug, pricingPerMillion(p)]));
  const { computedAt, runDir, ...figures } = JSON.parse(summaryText);
  void computedAt;
  void runDir;
  return {
    'meta.json': jsonDocument(meta),
    'rows.jsonl': lines(rowsText),
    'baseline.jsonl': lines(baseText),
    'r5-summary.json': jsonDocument(figures),
  };
}

function main() {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) {
    console.error('usage: node benchmark/runner/rewrite-r5.mjs <R5 run dir> <new dir>');
    process.exit(2);
  }
  const read = (f) => readFileSync(join(src, f), 'utf8');
  const out = rewriteR5({ metaText: read('meta.json'), rowsText: read('rows.jsonl'), baseText: read('baseline.jsonl'), summaryText: read('summary.json') });
  mkdirSync(dst, { recursive: true });
  for (const [name, text] of Object.entries(out)) {
    writeFileSync(join(dst, name), text, { flag: 'wx' });
    console.log(`wrote ${name}`);
  }
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
