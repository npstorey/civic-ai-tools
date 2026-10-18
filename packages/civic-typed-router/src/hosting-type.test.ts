// The hosting variants' types, held at type-check time (`npm run typecheck`
// runs `tsconfig.test.json` over this file) and at run time (ADR-0036).
//
// `HostingVariant` is a union discriminated on `kind`. Its `npm-package` arm
// is 0.3.0's `SourceHosting` (the same five keys, under the same name, so a
// consumer's `Pick<SourceHosting, …>` is unchanged) with what every variant
// carries; no arm has a field for an address. `ManifestEntry` has no
// `hosting` key: it lists `hostings`, and carries `consentDefault` and
// `publisher?`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NYC_CHARTER_ENTRY,
  NYC_CHARTER_HOSTING,
  NYC_CHARTER_SANDBOX_VARIANT,
  type ConsentDefault,
  type ContainerVariant,
  type HostingRunsAt,
  type HostingVariant,
  type InstanceLoggingPosture,
  type LoggingKeeps,
  type LoggingPosture,
  type ManifestEntry,
  type NpmPackageVariant,
  type RemoteVariant,
  type SourceHosting,
  type StatedLoggingPosture,
} from './index.ts';
import type {
  HostingVariant as CoreHostingVariant,
  LoggingPosture as CoreLoggingPosture,
  SourceHosting as CoreSourceHosting,
} from './core/index.ts';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const holds = <T extends true>(value: T): T => value;

type Common = 'variant' | 'runsAt' | 'logging';

test('hosting type: SourceHosting keeps exactly kind, package, version, commit and outbound', () => {
  holds<Equal<SourceHosting, CoreSourceHosting>>(true);
  holds<Equal<keyof SourceHosting, 'kind' | 'package' | 'version' | 'commit' | 'outbound'>>(true);
  holds<Equal<SourceHosting['kind'], 'npm-package'>>(true);
  holds<Equal<SourceHosting['package'], string>>(true);
  holds<Equal<SourceHosting['version'], string>>(true);
  holds<Equal<SourceHosting['commit'], string>>(true);
  holds<Equal<SourceHosting['outbound'], readonly string[]>>(true);
  assert.deepEqual(Object.keys(NYC_CHARTER_HOSTING).sort(), ['commit', 'kind', 'outbound', 'package', 'version']);
});

test('hosting type: the variants are a union discriminated on kind, and the npm-package arm requires its four strings and string array', () => {
  holds<Equal<HostingVariant, CoreHostingVariant>>(true);
  holds<Equal<HostingVariant, NpmPackageVariant | RemoteVariant | ContainerVariant>>(true);
  holds<Equal<HostingVariant['kind'], 'npm-package' | 'remote' | 'container'>>(true);
  holds<Equal<Extract<HostingVariant, { kind: 'npm-package' }>, NpmPackageVariant>>(true);
  holds<Equal<Extract<HostingVariant, { kind: 'remote' }>, RemoteVariant>>(true);
  holds<Equal<Extract<HostingVariant, { kind: 'container' }>, ContainerVariant>>(true);

  // The npm-package arm: SourceHosting's five keys, required, and the common three.
  holds<Equal<keyof NpmPackageVariant, keyof SourceHosting | Common>>(true);
  holds<Equal<NpmPackageVariant['package'], string>>(true);
  holds<Equal<NpmPackageVariant['version'], string>>(true);
  holds<Equal<NpmPackageVariant['commit'], string>>(true);
  holds<Equal<NpmPackageVariant['outbound'], readonly string[]>>(true);
  holds<Equal<Pick<NpmPackageVariant, 'package' | 'version' | 'commit' | 'outbound'>, Required<Pick<NpmPackageVariant, 'package' | 'version' | 'commit' | 'outbound'>>>>(true);
  // A variant is a SourceHosting, so the consumer's Pick signatures take one unchanged.
  const pin: Pick<SourceHosting, 'package' | 'version'> = NYC_CHARTER_SANDBOX_VARIANT;
  const component: Pick<SourceHosting, 'version' | 'commit'> = NYC_CHARTER_SANDBOX_VARIANT;
  const whole: SourceHosting = NYC_CHARTER_SANDBOX_VARIANT;
  assert.equal(pin.package, '@betanyc/nyc-charter-laws-rules');
  assert.equal(component.commit, NYC_CHARTER_HOSTING.commit);
  assert.equal(whole.kind, 'npm-package');

  // The other arms carry the common three and their kind, nothing else.
  holds<Equal<keyof RemoteVariant, 'kind' | Common>>(true);
  holds<Equal<keyof ContainerVariant, 'kind' | Common>>(true);
  holds<Equal<HostingRunsAt, 'instance-sandbox' | 'publisher' | 'government' | 'other'>>(true);
  holds<Equal<HostingVariant['runsAt'], HostingRunsAt>>(true);
  holds<Equal<HostingVariant['variant'], string>>(true);
  holds<Equal<HostingVariant['logging'], readonly LoggingPosture[]>>(true);
});

test('hosting type: no arm has a field for an address', () => {
  const posture: LoggingPosture = { statedBy: 'instance', role: 'server-operator' };
  const npm: HostingVariant = {
    kind: 'npm-package',
    package: 'example',
    version: '1.0.0',
    commit: 'a'.repeat(40),
    outbound: [],
    variant: 'sandbox',
    runsAt: 'instance-sandbox',
    logging: [posture],
    // @ts-expect-error -- the npm-package arm has no address
    url: 'https://example.org/mcp',
  };
  const remote: HostingVariant = {
    kind: 'remote',
    variant: 'remote',
    runsAt: 'other',
    logging: [posture],
    // @ts-expect-error -- the remote arm has no address: the instance configures it
    url: 'https://example.org/mcp',
  };
  const container: HostingVariant = {
    kind: 'container',
    variant: 'container',
    runsAt: 'other',
    logging: [posture],
    // @ts-expect-error -- the container arm has no address
    address: 'https://example.org/mcp',
  };
  // @ts-expect-error -- a remote variant carries no package
  const remoteWithPackage: RemoteVariant = { kind: 'remote', variant: 'remote', runsAt: 'other', logging: [], package: 'example' };
  for (const variant of [npm, remote, container, remoteWithPackage]) assert.equal(typeof variant, 'object');
});

test('hosting type: a logging posture is stated by the manifest, with its statement, or by the instance, by role', () => {
  holds<Equal<LoggingPosture, CoreLoggingPosture>>(true);
  holds<Equal<LoggingPosture, StatedLoggingPosture | InstanceLoggingPosture>>(true);
  holds<Equal<LoggingPosture['statedBy'], 'manifest' | 'instance'>>(true);
  holds<Equal<LoggingKeeps, 'none' | 'metadata' | 'content' | 'not-stated'>>(true);
  holds<Equal<keyof StatedLoggingPosture, 'statedBy' | 'holder' | 'keeps' | 'retention' | 'statementUrl' | 'readOn'>>(true);
  holds<Equal<StatedLoggingPosture['statementUrl'], string>>(true);
  holds<Equal<StatedLoggingPosture['readOn'], string>>(true);
  holds<Equal<keyof InstanceLoggingPosture, 'statedBy' | 'role'>>(true);
  // @ts-expect-error -- a stated posture needs its statement's address and read date
  const unread: LoggingPosture = { statedBy: 'manifest', holder: 'Example', keeps: 'not-stated' };
  // @ts-expect-error -- a holder the instance chooses carries no statement in the manifest
  const instanceWithStatement: LoggingPosture = { statedBy: 'instance', role: 'sandbox-platform', statementUrl: 'https://example.org/privacy' };
  assert.equal(typeof unread, 'object');
  assert.equal(typeof instanceWithStatement, 'object');
});

test('hosting type: ManifestEntry has no hosting key; it lists hostings and carries consentDefault and publisher', () => {
  holds<Equal<'hosting' extends keyof ManifestEntry ? true : false, false>>(true);
  holds<Equal<ManifestEntry['hostings'], readonly HostingVariant[]>>(true);
  holds<Equal<ManifestEntry['consentDefault'], ConsentDefault>>(true);
  holds<Equal<ConsentDefault, 'on' | 'ask-first'>>(true);
  holds<Equal<ManifestEntry['publisher'], string | undefined>>(true);

  assert.equal(NYC_CHARTER_ENTRY.hostings.length, 1);
  assert.equal(NYC_CHARTER_ENTRY.hostings[0], NYC_CHARTER_SANDBOX_VARIANT);
  const [variant] = NYC_CHARTER_ENTRY.hostings;
  assert.ok(variant && variant.kind === 'npm-package');
  // Narrowed by kind, the arm's strings are read without a cast.
  assert.deepEqual([variant.package, variant.version, variant.commit, variant.outbound], [
    NYC_CHARTER_HOSTING.package,
    NYC_CHARTER_HOSTING.version,
    NYC_CHARTER_HOSTING.commit,
    NYC_CHARTER_HOSTING.outbound,
  ]);
  assert.equal(Object.hasOwn(NYC_CHARTER_ENTRY, 'hosting'), false);
});
