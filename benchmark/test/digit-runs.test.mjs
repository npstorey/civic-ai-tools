// A0.4: the digit-run convention over every tracked file under benchmark/
// (`git ls-files benchmark`): each full 40-, 64-, 96- or 128-hex digest
// masked (a hash is not an identifier), then no run of 13 or more digits
// anywhere. The rule is the hub's fixture convention (router README,
// "Re-running the captures"), stricter than the harness golden's `\b`-bounded
// test: a run glued to letters, such as a contract identifier, fails here.
//
// The rule is written out in this file rather than imported from the writer,
// so the test does not share code with what it checks. Its samples are built
// by `repeat` and concatenation, so this file holds no long run itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

const DIGEST = /(?<![0-9A-Za-z])[0-9a-f]{40}(?:[0-9a-f]{24}(?:[0-9a-f]{32}(?:[0-9a-f]{32})?)?)?(?![0-9A-Za-z])/g;

/** The runs of 13 or more digits in `text`, digests masked. */
export function offendingRuns(text) {
  return text.replace(DIGEST, (hex) => (/[a-f]/.test(hex) ? hex.replace(/\d/g, 'x') : hex)).match(/\d{13,}/g) ?? [];
}

test('A0.4, the test of the test: the rule fails the shapes R5 wrote and passes a digest', () => {
  // R5's meta.json held a 22-digit price string (a per-token cache price).
  const priceString = `"input_cache_write": "0.${'0'.repeat(7)}8${'3'.repeat(14)}"`;
  // R5's rows.jsonl held cost floats with runs of 20 digits.
  const costFloat = `"computed":0.${'000348'}8${'9'.repeat(12)}7`;
  // A contract identifier glued to letters: CT and 15 digits.
  const contract = `contract CT${'1'.repeat(3)}${'2026'}${'0'.repeat(4)}${'5'.repeat(4)}.`;
  assert.equal(priceString.match(/\d+/g).at(-1).length, 22);
  assert.equal(costFloat.match(/\d+/g).at(-1).length, 20);
  assert.equal(contract.match(/\d+/g)[0].length, 15);
  for (const sample of [priceString, costFloat, contract, `x${'7'.repeat(13)}y`]) {
    assert.notDeepEqual(offendingRuns(sample), [], `the rule fails: ${sample.slice(0, 40)}`);
  }
  // A 64-hex digest holding a 13-digit run passes: it is a hash.
  const digest = `a${'1234567890'}123${'b'.repeat(50)}`;
  assert.equal(digest.length, 64);
  assert.deepEqual(offendingRuns(`"sha256": "${digest}"`), []);
  // The same run outside a digest does not.
  assert.notDeepEqual(offendingRuns(`"id": "${digest.slice(0, 20)}"`), []);
  // Twelve digits pass; the escaped form the convention writes passes and
  // parses back to the original.
  assert.deepEqual(offendingRuns(`x${'7'.repeat(12)}y`), []);
  const escaped = `"CT${'1'.repeat(8)}\\u0031${'1'.repeat(6)}"`;
  assert.deepEqual(offendingRuns(escaped), []);
  assert.equal(JSON.parse(escaped), `CT${'1'.repeat(15)}`);
});

test('A0.4: no tracked file under benchmark/ holds a run of 13 or more digits outside a digest', () => {
  const files = execFileSync('git', ['ls-files', '-z', 'benchmark'], { cwd: REPO, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(files.length > 0, 'git lists the tracked files under benchmark/');
  const offenders = [];
  for (const file of files) {
    const runs = offendingRuns(readFileSync(join(REPO, file), 'utf8'));
    if (runs.length) offenders.push(`${file}: ${runs.length} run(s), the first ${runs[0].length} digits long`);
  }
  assert.deepEqual(offenders, []);
});
