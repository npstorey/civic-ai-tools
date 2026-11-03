// A0.5: every file under benchmark/ is tracked, and none matches an ignore
// pattern; the owner's local copy of R5 (benchmark/_local/) is ignored.
//
// The hub's .gitignore ignores any `analysis/` directory, `*.log`,
// `*_results.json`, `*.output.json` and `output/` (R19), so a benchmark file
// that matched one would sit on disk and never reach a clone. This walks the
// directory on disk, not git's list, so an ignored or untracked file is found.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });

function filesOnDisk() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(REPO, dir))) {
      const rel = `${dir}/${name}`;
      if (rel === 'benchmark/_local') continue;
      if (statSync(join(REPO, rel)).isDirectory()) walk(rel);
      else out.push(rel);
    }
  };
  walk('benchmark');
  return out.sort();
}

test('A0.5: every file under benchmark/ is tracked and matches no ignore pattern', () => {
  const files = filesOnDisk();
  assert.ok(files.length > 0);
  const ignored = files.filter((f) => git('check-ignore', '-q', f).status !== 1);
  assert.deepEqual(ignored, [], 'git check-ignore -q exits 1 for each');
  const tracked = new Set(git('ls-files', '-z', 'benchmark').stdout.split('\0').filter(Boolean));
  assert.deepEqual(
    files.filter((f) => !tracked.has(f)),
    [],
    'git ls-files lists each',
  );
});

test("A0.5: the owner's local copy of R5 is ignored", () => {
  assert.equal(git('check-ignore', '-q', 'benchmark/_local/r5/chooser-spike.mjs').status, 0);
  assert.equal(git('check-ignore', '-q', 'benchmark/_local/registry/fetch-log.tsv').status, 0);
});
