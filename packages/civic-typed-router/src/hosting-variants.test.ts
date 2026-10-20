// The hosting variants, the logging posture, the consent default and the
// publisher, as the seven civic entries carry them (0.4.0, ADR-0036; the
// three hosted sources of 0.6.0, whose own values `hosted-entries.test.ts`
// holds field by field).
//
//   - every entry lists its variants in `hostings`, states its consent default
//     (On for all but NYC Checkbook and NYS Open Legislation, which start Ask
//     first), names its publisher, and keeps no 0.3.0 `hosting` key;
//   - Socrata, Data Commons and Boston OpenContext each have one `remote`
//     variant, with no package fields and no address;
//   - NYC Charter has one `npm-package` variant, `sandbox`, the name its
//     switch's value gives it, in the instance's sandbox, with 0.3.0's package,
//     version and commit and no outbound host;
//   - each variant's postures, in the order the data flows; a posture the
//     manifest states carries an `https:` statement address, the date it was
//     read and one of the four `keeps` values; a holder the instance chooses
//     is named by role only.
//
// Read through the package entry and the manifest, by source id, as plain
// records, so the file holds the values and not only the types.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CIVIC_MANIFEST, configuredSources, NYC_CHARTER_HOSTING_SANDBOX, readMcpEnv, type CivicManifestEntry } from './index.ts';

/** The UTC date 0.4.0's phase read every statement it cites. */
const READ_ON = '2026-10-18';

/** The UTC date 0.6.0's phase (R8 H3) read the statements its three entries
 *  cite. */
const READ_ON_H3 = '2026-10-19';

/** The date each stated posture was read, by source: the phase that wrote
 *  it. */
const READ_ON_BY_SOURCE: Record<string, string> = {
  'data-commons': READ_ON,
  'boston-opencontext': READ_ON,
  'nyc-checkbook': READ_ON_H3,
  'nyc-record': READ_ON_H3,
  'nys-legislation': READ_ON_H3,
};

/** The four values a stated posture's `keeps` takes. */
const KEEPS = ['none', 'metadata', 'content', 'not-stated'];

type Fields = Record<string, unknown>;

/** The 0.4.0 fields of an entry, read as plain records. */
function carried(entry: CivicManifestEntry): { hostings?: readonly Fields[]; consentDefault?: unknown; publisher?: unknown } {
  return entry as unknown as { hostings?: readonly Fields[]; consentDefault?: unknown; publisher?: unknown };
}

function entry(sourceId: string): CivicManifestEntry {
  const found = CIVIC_MANIFEST.find((candidate) => candidate.sourceId === sourceId);
  assert.ok(found, `the civic manifest holds a ${sourceId} entry`);
  return found;
}

/** Each entry's variants, by source id. */
function variants(sourceId: string): readonly Fields[] {
  const list = carried(entry(sourceId)).hostings;
  assert.ok(Array.isArray(list), `${sourceId} lists its variants in hostings`);
  return list;
}

/** Every posture in the manifest, with the source and variant it belongs to. */
function everyPosture(): { at: string; posture: Fields }[] {
  return CIVIC_MANIFEST.flatMap((e) =>
    (carried(e).hostings ?? []).flatMap((v) =>
      ((v.logging as readonly Fields[] | undefined) ?? []).map((posture, i) => ({ at: `${e.sourceId}/${String(v.variant)}[${i}]`, posture })),
    ),
  );
}

/** A real calendar date in `YYYY-MM-DD` form. */
function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// --- Every entry -------------------------------------------------------------------

test('hosting variants: every entry lists one variant, states its consent default, and keeps no 0.3.0 hosting key', () => {
  assert.deepEqual(
    CIVIC_MANIFEST.map((e) => [e.sourceId, variants(e.sourceId).length, carried(e).consentDefault, Object.hasOwn(e, 'hosting')]),
    [
      ['socrata', 1, 'on', false],
      ['data-commons', 1, 'on', false],
      ['boston-opencontext', 1, 'on', false],
      ['nyc-charter', 1, 'on', false],
      // D7b = A.
      ['nyc-checkbook', 1, 'ask-first', false],
      ['nyc-record', 1, 'on', false],
      ['nys-legislation', 1, 'ask-first', false],
    ],
  );
});

test('hosting variants: each entry names its publisher, as the source\'s own page names it', () => {
  assert.deepEqual(
    Object.fromEntries(CIVIC_MANIFEST.map((e) => [e.sourceId, carried(e).publisher])),
    {
      socrata: 'npstorey',
      'data-commons': 'Google',
      'boston-opencontext': 'City of Boston',
      'nyc-charter': 'BetaNYC',
      'nyc-checkbook': 'BetaNYC',
      'nyc-record': 'BetaNYC',
      'nys-legislation': 'BetaNYC',
    },
  );
});

// --- The variants ------------------------------------------------------------------

test('hosting variants: Socrata, Data Commons and Boston OpenContext each have one remote variant, with no package field and no address', () => {
  const remote = (sourceId: string) => {
    const [variant] = variants(sourceId);
    assert.ok(variant);
    assert.deepEqual(Object.keys(variant).sort(), ['kind', 'logging', 'runsAt', 'variant'], `${sourceId}: a remote variant carries no package field`);
    return [variant.variant, variant.kind, variant.runsAt];
  };
  assert.deepEqual(remote('socrata'), ['remote', 'remote', 'other']);
  assert.deepEqual(remote('data-commons'), ['remote', 'remote', 'publisher']);
  assert.deepEqual(remote('boston-opencontext'), ['remote', 'remote', 'government']);
});

test('hosting variants: NYC Charter has one npm-package variant, sandbox, in the instance\'s sandbox, with 0.3.0\'s package, version and commit and no outbound host', () => {
  const [variant] = variants('nyc-charter');
  assert.ok(variant);
  assert.deepEqual(variant, {
    kind: 'npm-package',
    package: '@betanyc/nyc-charter-laws-rules',
    version: '0.3.1',
    commit: 'b784cb763ec0d953139eef4ed366e8ec4de72625',
    outbound: [],
    variant: 'sandbox',
    runsAt: 'instance-sandbox',
    logging: [{ statedBy: 'instance', role: 'sandbox-platform' }],
  });
  // The switch's value names the variant that is on.
  assert.equal(variant.variant, NYC_CHARTER_HOSTING_SANDBOX);
  assert.equal(configuredSources(readMcpEnv({ NYC_CHARTER_HOSTING: ' sandbox ' }))['nyc-charter'], variant.variant);
});

test('hosting variants: no variant carries an address', () => {
  for (const e of CIVIC_MANIFEST) {
    for (const variant of variants(e.sourceId)) {
      const { logging: _postures, ...rest } = variant;
      assert.doesNotMatch(JSON.stringify(rest), /https?:|url|address|endpoint|port/i, `${e.sourceId}/${String(variant.variant)}`);
    }
  }
});

// --- The postures ------------------------------------------------------------------

test('logging posture: each variant\'s holders, in the order the data flows, stated by the manifest or left to the instance', () => {
  assert.deepEqual(
    Object.fromEntries(CIVIC_MANIFEST.map((e) => [e.sourceId, variants(e.sourceId).map((v) => v.logging)])),
    {
      socrata: [
        [
          { statedBy: 'instance', role: 'server-operator' },
          { statedBy: 'instance', role: 'portal-operator' },
        ],
      ],
      'data-commons': [
        [
          {
            statedBy: 'manifest',
            holder: 'Google',
            keeps: 'content',
            retention: 'Varies by kind of data and use; the statement gives no period.',
            statementUrl: 'https://policies.google.com/privacy?hl=en-US',
            readOn: READ_ON,
          },
        ],
      ],
      'boston-opencontext': [
        [
          {
            statedBy: 'manifest',
            holder: 'City of Boston',
            keeps: 'metadata',
            retention: "Under the City's records retention schedule; the statement gives no period for server logs.",
            statementUrl: 'https://www.boston.gov/government/cabinets/innovation-and-technology/terms-use-and-privacy-policy-city-boston-digital',
            readOn: READ_ON,
          },
        ],
      ],
      'nyc-charter': [[{ statedBy: 'instance', role: 'sandbox-platform' }]],
      'nyc-checkbook': [
        [
          { statedBy: 'instance', role: 'sandbox-platform' },
          {
            statedBy: 'manifest',
            holder: 'Office of the New York City Comptroller',
            keeps: 'not-stated',
            statementUrl: 'https://comptroller.nyc.gov/privacy-policy/',
            readOn: READ_ON_H3,
          },
        ],
      ],
      'nyc-record': [
        [
          { statedBy: 'instance', role: 'sandbox-platform' },
          {
            statedBy: 'manifest',
            holder: 'City of New York',
            keeps: 'not-stated',
            statementUrl: 'https://www.nyc.gov/home/privacy-policy.page',
            readOn: READ_ON_H3,
          },
        ],
      ],
      'nys-legislation': [
        [
          { statedBy: 'instance', role: 'sandbox-platform' },
          {
            statedBy: 'manifest',
            holder: 'New York State Senate',
            keeps: 'not-stated',
            statementUrl: 'https://www.nysenate.gov/privacy-policy',
            readOn: READ_ON_H3,
          },
        ],
      ],
    },
  );
});

test('logging posture: every stated posture has an https statement address, a real read date equal to its phase\'s, and one of the four keeps values; every other names a role only', () => {
  const postures = everyPosture();
  const stated = postures.filter(({ posture }) => posture.statedBy === 'manifest');
  const byRole = postures.filter(({ posture }) => posture.statedBy === 'instance');
  assert.equal(stated.length + byRole.length, postures.length, 'every posture is stated by the manifest or by the instance');
  assert.ok(stated.length > 0, 'the manifest states at least one posture');
  for (const { at, posture } of stated) {
    assert.equal(new URL(String(posture.statementUrl)).protocol, 'https:', `${at}: statementUrl is https`);
    assert.ok(isCalendarDate(posture.readOn), `${at}: readOn is a real YYYY-MM-DD date`);
    assert.equal(posture.readOn, READ_ON_BY_SOURCE[at.split('/')[0]!], `${at}: readOn is the read date of the phase that wrote it`);
    assert.ok(KEEPS.includes(posture.keeps as string), `${at}: keeps is one of ${KEEPS.join(', ')}`);
    assert.equal(typeof posture.holder, 'string', `${at}: names its holder`);
    for (const key of Object.keys(posture)) {
      assert.ok(['statedBy', 'holder', 'keeps', 'retention', 'statementUrl', 'readOn'].includes(key), `${at}: no field ${key}`);
    }
  }
  for (const { at, posture } of byRole) {
    assert.deepEqual(Object.keys(posture).sort(), ['role', 'statedBy'], `${at}: a holder the instance chooses carries a role and nothing the manifest cannot know`);
  }
  // The checks above refuse what they should.
  assert.equal(isCalendarDate('2026-02-30'), false);
  assert.equal(isCalendarDate('2026-10-18'), true);
});
