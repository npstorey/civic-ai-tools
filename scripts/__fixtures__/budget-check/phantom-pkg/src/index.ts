// Budget-check fixture (failure mode a). Every bare *value* import below is a
// phantom — absent from this manifest's `dependencies`. Module names are
// deliberately fake (`left-pad`, `@fake-scope/fake-lib`); this file is never
// compiled or executed, only scanned as text by the checker's self-test.
import leftPad from 'left-pad';
import { helper } from '@fake-scope/fake-lib/subpath.js';
import type { TypeOnlyShape } from 'type-only-mod';
// import ghost from 'commented-out-mod';
import { local } from './util.ts';

const NOT_A_COMMENT = 'https://example.test/path';

export function decorate(value: TypeOnlyShape): string {
  return String(leftPad(local(String(value)), 4)) + helper(NOT_A_COMMENT);
}
