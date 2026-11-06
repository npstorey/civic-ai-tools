// G3's run, committed (hub #302, P4): benchmark/runs/2026-11-05/.
//
//   A3.3  the scorer over each committed run directory reproduces that
//         directory's committed summary.json byte for byte, and the
//         summary's `files` are the committed files' sha256 (a file the run
//         did not write, `baseline.jsonl`, is hashed as the empty text, as
//         the scorer reads an absent file);
//   O1    the evaluations' rows.jsonl is committed whole, with no split and no
//         Git LFS pointer: its byte count and sha256 are the ones measured at
//         G3, and benchmark/README.md restates the sha256;
//   the directory holds exactly the files the run wrote and the wrapper's
//         records the owner kept: not `npm-ci.out`, and not the printed
//         output of steps 1, 2 and 5, which carries the account's balance
//         (the owner's ruling, P4's fix round), and nothing else;
//   no committed run file (benchmark/runs/) holds that balance line: the
//         runner's source, which prints it, is not a run file;
//   P4.6  no tracked file under benchmark/ holds an absolute home path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DATE_DIR = join(REPO, 'benchmark/runs/2026-11-05');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Each run directory, by its runId, and the files it holds. */
const RUN_DIRS = {
  '2026-11-05-ow-probe-181703': ['contact-ledger.md', 'meta.json', 'rows.jsonl', 'summary.json'],
  '2026-11-05-probe-181956': ['calibration.json', 'contact-ledger.md', 'meta.json', 'rows.jsonl', 'summary.json'],
  '2026-11-05-run-191511': ['contact-ledger.md', 'meta.json', 'rows.jsonl', 'summary.json'],
};
/** The wrapper's records kept (`benchmark/_local/g3/` in the run worktree): not
 *  npm-ci.out, and not step-1.out, step-2.out or step-5.out, which print the
 *  account's balance. */
const G3 = ['calibration.json', 'sitting-1.json', 'step-3.out', 'step-4.out', 'step-5.op-not-signed-in.out'];
/** The line the run's key check prints with the account's balance. */
const BALANCE_LINE = new RegExp(['credit', 'limit', 'remaining'].join(' '), 'i');
/** The evaluations' rows.jsonl as measured at G3 (hub #302 comment 6669754364). */
const EVALUATION_ROWS = {
  path: 'benchmark/runs/2026-11-05/2026-11-05-run-191511/rows.jsonl',
  bytes: 50426681,
  sha256: '316e361ca5588fe35fd616c0cde43c59a8857557145af5516cee06914be4c18c',
  lines: 11672,
};

test('A3.3: the scorer over each committed run directory reproduces its summary.json byte for byte', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'a33-'));
  try {
    for (const runId of Object.keys(RUN_DIRS)) {
      const dir = join(DATE_DIR, runId);
      const committed = join(dir, 'summary.json');
      assert.ok(existsSync(committed), `${runId}/summary.json is committed`);
      const out = join(scratch, `${runId}.json`);
      const run = spawnSync(process.execPath, [join(REPO, 'benchmark/scoring/analyze.mjs'), dir, '--out', out], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      assert.equal(run.status, 0, `the scorer exits 0 over ${runId}\n${run.stderr}`);
      assert.equal(readFileSync(out, 'utf8'), readFileSync(committed, 'utf8'), `${runId}: the scorer's output is the committed summary.json, byte for byte`);
      const summary = JSON.parse(readFileSync(committed, 'utf8'));
      assert.equal(summary.runId, runId, `${runId}: the directory is named by its runId`);
      assert.deepEqual(Object.keys(summary.files).sort(), ['baseline.jsonl', 'meta.json', 'rows.jsonl']);
      for (const [name, hash] of Object.entries(summary.files)) {
        const path = join(dir, name);
        const expected = existsSync(path) ? sha256(readFileSync(path)) : sha256('');
        assert.equal(hash, expected, `${runId}: summary.json's files["${name}"] is ${existsSync(path) ? 'the committed file' : 'the empty text (no such file)'}'s sha256`);
      }
      assert.ok(!existsSync(join(dir, 'baseline.jsonl')), `${runId}: G3 wrote no baseline.jsonl`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("the committed run holds exactly the run's files and the wrapper's records kept", () => {
  assert.ok(existsSync(DATE_DIR), 'benchmark/runs/2026-11-05/ exists');
  for (const [runId, files] of Object.entries(RUN_DIRS)) {
    assert.deepEqual(readdirSync(join(DATE_DIR, runId)).sort(), files, `${runId}'s files`);
  }
  assert.deepEqual(readdirSync(join(DATE_DIR, 'g3')).sort(), G3, "g3/'s files: the wrapper's records");
  const meta = (runId) => JSON.parse(readFileSync(join(DATE_DIR, runId, 'meta.json'), 'utf8'));
  for (const runId of Object.keys(RUN_DIRS)) assert.equal(meta(runId).runId, runId);
  // The evaluations ran to the end: every row complete, none an error, none not started, no stop.
  const evaluations = meta('2026-11-05-run-191511');
  assert.equal(evaluations.mode, 'evaluations');
  assert.equal(evaluations.stopReason, null);
  assert.equal(evaluations.rowsNotStarted.count, 0);
  assert.equal(evaluations.completeRows, evaluations.expectedRows);
  assert.equal(evaluations.errorRows, 0);
  // The calibration the evaluations ran under is the wrapper's step-3 file, committed in g3/.
  assert.equal(evaluations.estimate.calibration.sha256, sha256(readFileSync(join(DATE_DIR, 'g3/calibration.json'))));
});

test("O1: the evaluations' rows.jsonl is committed whole, as measured at G3, and the README restates its sha256", () => {
  const path = join(REPO, EVALUATION_ROWS.path);
  assert.ok(existsSync(path), `${EVALUATION_ROWS.path} is committed`);
  assert.equal(statSync(path).size, EVALUATION_ROWS.bytes, 'its byte count');
  const bytes = readFileSync(path);
  assert.equal(sha256(bytes), EVALUATION_ROWS.sha256, 'its sha256');
  assert.equal(bytes.toString('utf8').split('\n').filter(Boolean).length, EVALUATION_ROWS.lines, 'its rows');
  assert.ok(!bytes.subarray(0, 200).toString('utf8').startsWith('version https://git-lfs'), 'not a Git LFS pointer');
  const tracked = execFileSync('git', ['ls-files', '--', EVALUATION_ROWS.path], { cwd: REPO, encoding: 'utf8' }).trim();
  assert.equal(tracked, EVALUATION_ROWS.path, 'git tracks it');
  const attributes = execFileSync('git', ['check-attr', 'filter', '--', EVALUATION_ROWS.path], { cwd: REPO, encoding: 'utf8' });
  assert.match(attributes, /filter: unspecified$/m, 'no filter (no Git LFS) applies to it');
  const readme = readFileSync(join(REPO, 'benchmark/README.md'), 'utf8');
  assert.ok(readme.includes(EVALUATION_ROWS.sha256), "benchmark/README.md restates rows.jsonl's sha256");
  assert.ok(readme.includes(`${EVALUATION_ROWS.bytes.toLocaleString('en-US')} bytes`), "benchmark/README.md restates rows.jsonl's byte count");
});

test('no committed run file under benchmark/runs/ holds the account balance line', () => {
  assert.ok(BALANCE_LINE.test(`key check: accepted; ${'credit limit'} remaining: $1.00`), 'the test of the test: the rule matches the line');
  const files = execFileSync('git', ['ls-files', '-z', 'benchmark/runs'], { cwd: REPO, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(files.some((f) => f.startsWith('benchmark/runs/2026-11-05/')), 'the committed run is tracked');
  const offenders = files.filter((file) => BALANCE_LINE.test(readFileSync(join(REPO, file), 'utf8')));
  assert.deepEqual(offenders, []);
});

/** An absolute path into a home directory: macOS, Linux, or Windows. */
const HOME_PATH = /(?:^|[^A-Za-z0-9_.~-])(?:\/(?:Users|home)\/[A-Za-z0-9._-]+|\/root\/|[A-Za-z]:\\(?:Users|Documents and Settings)\\)/;

test('P4.6, the test of the test: the home-path rule fails the three shapes and passes a relative or repository path', () => {
  const user = ['n', 'a', 'm', 'e'].join('');
  for (const sample of [`at /${'Users'}/${user}/code/x`, `"/${'home'}/${user}/x"`, `C:\\${'Users'}\\${user}\\x`, `cd /${'root'}/x`]) {
    assert.ok(HOME_PATH.test(sample), `flagged: ${sample}`);
  }
  for (const sample of ['benchmark/_local/runs/x', '~/code/civic-ai-tools', 'npstorey/civic-ai-tools-website', 'src/Users/x', 'a/home/b']) {
    assert.ok(!HOME_PATH.test(sample), `passed: ${sample}`);
  }
});

test('P4.6: no tracked file under benchmark/ holds an absolute home path', () => {
  const files = execFileSync('git', ['ls-files', '-z', 'benchmark'], { cwd: REPO, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(files.length > 0);
  const offenders = files.filter((file) => HOME_PATH.test(readFileSync(join(REPO, file), 'utf8')));
  assert.deepEqual(offenders, []);
});
