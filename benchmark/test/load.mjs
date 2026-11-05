// A module of the benchmark, loaded inside a test: its absence fails the
// test at an assertion, not at the import, so a test written before its
// module is red where it asserts.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

/** `benchmark/<rel>`, imported, after asserting it exists. */
export async function load(rel) {
  const url = new URL(`../${rel}`, import.meta.url);
  assert.ok(existsSync(url), `benchmark/${rel} exists`);
  return import(url);
}
