// Budget-check fixture: test files are exempt from the budget scan, so the
// bare import below must NOT be reported. This file is never executed by the
// repo test suite — it exists only to be (not) scanned by the checker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import testOnly from 'test-only-mod';

test('fixture test file (never run)', () => {
  assert.ok(testOnly);
});
