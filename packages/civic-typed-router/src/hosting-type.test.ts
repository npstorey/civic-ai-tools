// The hosting field's type, held at type-check time (`npm run typecheck`
// runs `tsconfig.test.json` over this file) and at run time.
//
// `SourceHosting` lives in core, carries the package, the version and the
// commit as separate strings, and has no field for an address: a hosted
// source is reached at an address its host resolves per call.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NYC_CHARTER_ENTRY, NYC_CHARTER_HOSTING, type ManifestEntry, type SourceHosting } from './index.ts';
import type { SourceHosting as CoreSourceHosting } from './core/index.ts';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const holds = <T extends true>(value: T): T => value;

test('hosting type: core exports it, with exactly kind, package, version, commit and outbound', () => {
  holds<Equal<SourceHosting, CoreSourceHosting>>(true);
  holds<Equal<keyof SourceHosting, 'kind' | 'package' | 'version' | 'commit' | 'outbound'>>(true);
  holds<Equal<SourceHosting['package'], string>>(true);
  holds<Equal<SourceHosting['version'], string>>(true);
  holds<Equal<SourceHosting['commit'], string>>(true);
  holds<Equal<ManifestEntry['hosting'], SourceHosting | undefined>>(true);

  const address: SourceHosting = {
    kind: 'npm-package',
    package: 'example',
    version: '1.0.0',
    commit: 'a'.repeat(40),
    outbound: [],
    // @ts-expect-error -- the hosting field has no address
    url: 'https://example.org/mcp',
  };
  assert.equal(typeof address, 'object');
  assert.equal(NYC_CHARTER_ENTRY.hosting, NYC_CHARTER_HOSTING);
});
