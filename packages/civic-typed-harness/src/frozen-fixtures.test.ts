// The two FROZEN fixtures, held frozen by a test and not only by a comment.
//
// `website-golden.json` is a capture of the reference implementation's output
// (2026-08-01); `reference-golden.json` is a verbatim copy of
// @typedstandards/produce-core@0.1.0's `src/__fixtures__/reference-golden.json`
// (typedstandards `d231ae6`). Neither is ever edited: a deliberate behaviour
// change reaches them as a named lift over their bytes, with the number of
// lifted nodes asserted (civic-ai-tools#205, ADR-0033 §A), and the suites
// compare against the lifted bytes. Until 0.7.0 that rule lived in comments
// (golden-reproduction.test.ts's header named the copy's sha256; nothing
// computed it). These pins compute it: a byte changed in either file — an
// edit, a re-format, a re-copy from a newer upstream — fails here, by name.
//
// `span-carrying-golden.json` is NOT pinned here: it is this repository's own
// fixture, recording two hashes that are regenerated, with a dated note, when
// a change intends to move them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

const FROZEN: ReadonlyArray<readonly [file: string, sha256: string]> = [
  ['website-golden.json', 'ce3a12aabc6b60f803828ecc7ba5f4d94079ae56aaf3c421f074c46e92e74275'],
  ['reference-golden.json', '2f5ea4408b19f0ce46204956b29b38aeb92ec183e44c2704b1041cf75cf9f5dd'],
];

for (const [file, expected] of FROZEN) {
  test(`frozen fixture: ${file} is byte-identical to the capture it records (sha256 pinned)`, () => {
    const actual = crypto.createHash('sha256').update(readFileSync(join(FIXTURES, file))).digest('hex');
    assert.equal(
      actual,
      expected,
      `${file} has changed. It is frozen: never edit it. Express a deliberate behaviour change as a named lift over its bytes in the test that reads it, with the lifted-node count asserted.`,
    );
  });
}
