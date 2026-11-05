// A3.1 (hub #302, S1 P3-build): the inputs' hash. `node
// benchmark/runner/input-hash.mjs` prints the recipe's hash; it equals a
// recomputation written here independently (its own file walk, its own
// lines), and it changes when any covered file changes and only then.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './load.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = 'benchmark/runner/input-hash.mjs';

/** The recipe, recomputed: every file under the two directories, the
 *  top-level JSON of the other two, `<sha256>  <path>\n` each in byte order,
 *  and the SHA-256 of the lines. */
function recompute(root) {
  const files = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(root, rel))) {
      const p = `${rel}/${name}`;
      if (statSync(join(root, p)).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk('benchmark/runner');
  walk('benchmark/scoring');
  for (const dir of ['benchmark/inventories', 'benchmark/questions']) {
    for (const name of readdirSync(join(root, dir))) if (/\.json$/.test(name) && statSync(join(root, dir, name)).isFile()) files.push(`${dir}/${name}`);
  }
  files.sort((a, b) => (Buffer.from(a) < Buffer.from(b) ? -1 : Buffer.from(a) > Buffer.from(b) ? 1 : 0));
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  return { files, hash: sha(files.map((f) => `${sha(readFileSync(join(root, f)))}  ${f}\n`).join('')) };
}

const run = (root) => spawnSync(process.execPath, [join(REPO, SCRIPT), ...(root ? ['--root', root] : [])], { cwd: REPO, encoding: 'utf8' });

test('A3.1: input-hash.mjs prints the recipe’s hash, equal to an independent recomputation', async () => {
  await load('runner/input-hash.mjs');
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const expected = recompute(REPO);
  assert.equal(r.stdout.trim(), expected.hash);
  assert.ok(expected.files.includes('benchmark/inventories/1000.json') && expected.files.includes('benchmark/questions/schema.json'));
  assert.ok(expected.files.includes('benchmark/runner/plans/s1.json'), 'the plan file is covered');
  assert.ok(!expected.files.some((f) => f.endsWith('.sha256') || f.startsWith('benchmark/inventories/sources/') || f.startsWith('benchmark/test/')));
  const mod = await load('runner/input-hash.mjs');
  assert.equal(mod.inputHash(REPO).hash, expected.hash);
});

test('A3.1: the hash changes when any covered file changes, and not otherwise', async () => {
  await load('runner/input-hash.mjs');
  const root = mkdtempSync(join(tmpdir(), 'a31-'));
  try {
    for (const dir of ['runner', 'scoring', 'inventories', 'questions', 'test']) cpSync(join(REPO, 'benchmark', dir), join(root, 'benchmark', dir), { recursive: true });
    const base = run(root).stdout.trim();
    assert.equal(base, recompute(root).hash);
    assert.equal(base, run().stdout.trim(), 'the copy hashes as the repository does');
    const touch = (rel, how) => {
      const p = join(root, rel);
      const before = readFileSync(p);
      how(p);
      const after = run(root).stdout.trim();
      writeFileSync(p, before);
      return after;
    };
    const covered = ['benchmark/runner/engine.mjs', 'benchmark/runner/plans/s1.json', 'benchmark/scoring/analyze.mjs', 'benchmark/inventories/200.json', 'benchmark/questions/7.json'];
    for (const rel of covered) assert.notEqual(touch(rel, (p) => appendFileSync(p, ' ')), base, `${rel} is covered`);
    const added = join(root, 'benchmark/runner/extra.txt');
    writeFileSync(added, 'x');
    assert.notEqual(run(root).stdout.trim(), base, 'a new file under runner/ is covered');
    rmSync(added);
    for (const rel of ['benchmark/inventories/7.json.sha256', 'benchmark/inventories/sources/README.md', 'benchmark/test/load.mjs']) {
      assert.equal(touch(rel, (p) => appendFileSync(p, ' ')), base, `${rel} is not covered`);
    }
    assert.equal(run(root).stdout.trim(), base, 'restored, the hash is back');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
