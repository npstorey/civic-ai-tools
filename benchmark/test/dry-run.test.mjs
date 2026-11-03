// A0.1 and A0.2: the dry run, as a command.
//
//   A0.1  `node benchmark/runner/run.mjs --dry-run --inventory
//         benchmark/inventories/7.json --questions
//         benchmark/runner/fixtures/r5-questions.json --config baseline-7`
//         exits 0 and prints each input's sha256 and the estimated cost bounds.
//   A0.2  the same dry run under a no-network preload makes no network call
//         and writes nothing.
//
// The questions are R5's 49, a runner fixture, not gold (fixtures/README.md).
// When P2 commits benchmark/questions/7.json, the anchor's literal command
// joins these.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./fixtures/no-network.mjs', import.meta.url));
const COMMAND = [
  'benchmark/runner/run.mjs',
  '--dry-run',
  '--inventory',
  'benchmark/inventories/7.json',
  '--questions',
  'benchmark/runner/fixtures/r5-questions.json',
  '--config',
  'baseline-7',
];
/** Every input the dry run reads, by repository path. */
const INPUTS = [
  'benchmark/inventories/7.json',
  'benchmark/runner/fixtures/r5-questions.json',
  'benchmark/runner/catalog.mjs',
  'benchmark/runner/app-texts.mjs',
  'benchmark/runner/openrouter-models.json',
  'packages/civic-typed-router/src/__fixtures__/socrata-guidance.json',
];
/** R5's question set, as R5 recorded its hash (planning `chooser-spike-questions.json`). */
const R5_QUESTIONS_SHA256 = '82968e5841ff3636d00bc725c91dd7065c45434bf044a66ae4faa3167ed2c48d';

const sha256 = (rel) => (existsSync(join(REPO, rel)) ? createHash('sha256').update(readFileSync(join(REPO, rel))).digest('hex') : `(missing: ${rel})`);
const node = (args, extra = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', ...extra });

/** Every file under benchmark/ but the ignored local copy, with its size and
 *  modification time: what "writes nothing" is checked against. */
function benchmarkTree() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(REPO, dir))) {
      const rel = `${dir}/${name}`;
      if (rel === 'benchmark/_local') continue;
      const s = statSync(join(REPO, rel));
      if (s.isDirectory()) walk(rel);
      else out.push(`${rel} ${s.size} ${s.mtimeMs}`);
    }
  };
  walk('benchmark');
  return out.sort();
}
const gitStatus = () => spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: REPO, encoding: 'utf8' }).stdout;

test("A0.1: the dry run exits 0 and prints every input's sha256 and the estimated cost bounds", () => {
  const run = node(COMMAND);
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stderr}`);
  for (const rel of INPUTS) assert.ok(run.stdout.includes(`${sha256(rel)}  ${rel}`), `the dry run prints ${rel}'s sha256`);
  assert.equal(sha256('benchmark/runner/fixtures/r5-questions.json'), R5_QUESTIONS_SHA256, "the fixture is R5's question set, byte for byte");
  const canonical = readFileSync(join(REPO, 'benchmark/inventories/7.json.sha256'), 'utf8').trim();
  assert.ok(run.stdout.includes(`canonicalSha256 ${canonical}`), "the inventory's canonical hash is printed");
  assert.match(run.stdout, /estimated cost bounds \(USD\):/);
  assert.match(run.stdout, /total: calls ≤ \d+; floor \$\d+\.\d\d; ceiling \$\d+\.\d\d; hard ceiling \$\d+\.\d\d/);
  assert.match(run.stdout, /directory: 6 of 7 entries listed: socrata, data_commons, nyc_charter, nyc_checkbook, nyc_record, nys_legislation/);
  assert.match(run.stdout, /DRY RUN: no network call was made; nothing was written\./);
});

test('A0.2: under a no-network preload, the dry run still exits 0 and writes nothing', () => {
  const treeBefore = benchmarkTree();
  const statusBefore = gitStatus();
  const run = node(['--import', PRELOAD, ...COMMAND]);
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stderr}`);
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /no-network preload/);
  assert.deepEqual(benchmarkTree(), treeBefore, 'no file under benchmark/ was added or touched');
  assert.equal(gitStatus(), statusBefore, "the repository's status is unchanged");
});

test('A0.2, the test of the test: the preload refuses a fetch and a socket', () => {
  const fetched = node(['--import', PRELOAD, '--input-type=module', '-e', "await fetch('https://openrouter.ai/api/v1/models')"]);
  assert.notEqual(fetched.status, 0);
  assert.match(fetched.stderr, /no-network preload: fetch https:\/\/openrouter\.ai/);
  const socket = node(['--import', PRELOAD, '--input-type=module', '-e', "(await import('node:net')).connect(443, 'openrouter.ai')"]);
  assert.notEqual(socket.status, 0);
  assert.match(socket.stderr, /no-network preload: a socket connect/);
});

test('A0.6: build.mjs --check rebuilds 7.json byte for byte', () => {
  const run = node(['benchmark/inventories/build.mjs', '--check']);
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stderr}`);
  assert.match(run.stdout, /7\.json, 7\.json\.sha256 rebuilt byte for byte/);
});
