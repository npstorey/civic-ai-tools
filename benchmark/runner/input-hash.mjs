#!/usr/bin/env node
// A3.1: the inputs' hash, the one recipe the sprint's wrapper checks before
// and after a run (G0-7) and the runner records in meta.json at a run's
// start.
//
// THE RECIPE. The covered files are every regular file under
// `benchmark/runner/` and `benchmark/scoring/` (at any depth), and every
// `benchmark/inventories/*.json` and `benchmark/questions/*.json` (the top
// level of each, so each schema.json with its four files, and not the
// `.sha256` files or `inventories/sources/`), read from disk. Sorted by
// repository path, byte order, each gives one line:
//
//   <sha256 of the file's bytes, lowercase hex><two spaces><repository path>\n
//
// which is `sha256sum`'s line. The hash is the SHA-256 of those lines
// concatenated. From the repository root, with coreutils:
//
//   { find benchmark/runner benchmark/scoring -type f; ls benchmark/inventories/*.json benchmark/questions/*.json; } \
//     | LC_ALL=C sort | xargs sha256sum | sha256sum
//
// Usage: node benchmark/runner/input-hash.mjs [--list] [--root <dir>]
// prints the hash (with --list, the lines first).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The recipe's statement, as meta.json records it. */
export const INPUT_HASH_RECIPE =
  "every regular file under benchmark/runner/ and benchmark/scoring/, and benchmark/inventories/*.json and benchmark/questions/*.json, sorted by repository path (byte order), each as sha256sum's line '<sha256>  <path>\\n'; the hash is the SHA-256 of the lines concatenated";

/** The covered files' repository paths under `root`, sorted. */
export function coveredPaths(root = REPO_ROOT) {
  const out = [];
  const walk = (rel) => {
    for (const d of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = `${rel}/${d.name}`;
      if (d.isDirectory()) walk(p);
      else if (d.isFile()) out.push(p);
    }
  };
  walk('benchmark/runner');
  walk('benchmark/scoring');
  for (const dir of ['benchmark/inventories', 'benchmark/questions']) {
    for (const d of readdirSync(join(root, dir), { withFileTypes: true })) if (d.isFile() && d.name.endsWith('.json')) out.push(`${dir}/${d.name}`);
  }
  const bytes = (s) => Buffer.from(s, 'utf8');
  return out.sort((a, b) => Buffer.compare(bytes(a), bytes(b)));
}

/** The lines and the hash over the covered files under `root`. */
export function inputHash(root = REPO_ROOT) {
  const files = coveredPaths(root).map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') }));
  const lines = files.map((f) => `${f.sha256}  ${f.path}\n`).join('');
  return { files, lines, hash: createHash('sha256').update(lines).digest('hex') };
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--root');
  const root = at === -1 ? REPO_ROOT : args[at + 1];
  const r = inputHash(root);
  if (args.includes('--list')) process.stdout.write(r.lines);
  console.log(r.hash);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
