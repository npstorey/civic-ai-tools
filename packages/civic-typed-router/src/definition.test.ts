// The harness definition (ADR-0037; R8 decision D5 = B, as corrected by the R8
// hub G0 record's 5(d) and 5(i)): an output, `{ domain, sources, components,
// chosenBy, hash }`, whose hash is the lowercase hex SHA-256 of the canonical
// JSON of the rest. The canonical JSON and the SHA-256 are the router's own
// code in `src/core/`, with no import; this file, a test, checks them against
// `node:crypto` and fixed vectors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  canonicalJson,
  civicRouter,
  harnessDefinitionOf,
  readMcpEnv,
  sha256Hex,
  type ChosenBy,
  type HarnessDefinitionComponent,
  type HarnessDefinitionInput,
} from './index.ts';

const nodeSha256 = (input: string | Uint8Array): string => createHash('sha256').update(input).digest('hex');

// --- Inputs ------------------------------------------------------------------------------

const EVERY_SOURCE = readMcpEnv({
  SOCRATA_MCP_URL: 'https://socrata-mcp.example.org',
  BOSTON_OPENCONTEXT_MCP_URL: 'https://boston-mcp.example.org/mcp',
  NYC_CHARTER_HOSTING: 'sandbox',
});

/** sha256("abc") and sha256(""), as guidance hashes: 64 lowercase hex. */
const HASH_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const HASH_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const COMPONENTS: readonly HarnessDefinitionComponent[] = [
  { id: 'socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server', guidanceHash: HASH_ABC },
  { id: '@betanyc/nyc-charter-laws-rules@https://github.com/BetaNYC/nyc-charter-laws-rules', version: '0.3.1+b784cb763ec0' },
  { id: '@typedstandards/civic-typed-router', version: '0.4.0' },
];

const FIXED_INPUT: HarnessDefinitionInput = { configured: EVERY_SOURCE, selection: ['nyc-charter', 'socrata'], chosenBy: 'model', components: COMPONENTS };

/** The canonical JSON of the fixed definition without its hash, written out
 *  here. Members in UTF-16 code-unit order, no whitespace. */
const FIXED_CANONICAL =
  '{"chosenBy":"model","components":[{"guidanceHash":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad","id":"socrata-mcp-server@https://github.com/npstorey/socrata-mcp-server"},{"id":"@betanyc/nyc-charter-laws-rules@https://github.com/BetaNYC/nyc-charter-laws-rules","version":"0.3.1+b784cb763ec0"},{"id":"@typedstandards/civic-typed-router","version":"0.4.0"}],"domain":"civic","sources":["socrata","nyc-charter"]}';

// --- The definition ----------------------------------------------------------------------

test('definition: its fields are domain, sources, components, chosenBy and hash, and no task', () => {
  const definition = civicRouter.harnessDefinition(FIXED_INPUT);
  assert.deepEqual(Object.keys(definition), ['domain', 'sources', 'components', 'chosenBy', 'hash']);
  assert.equal(definition.domain, 'civic');
  assert.deepEqual(definition.sources, civicRouter.offeredSkillSources(EVERY_SOURCE, FIXED_INPUT.selection));
  assert.deepEqual(definition.sources, ['socrata', 'nyc-charter'], 'the composed source ids, in manifest order');
  assert.deepEqual(definition.components, COMPONENTS, 'the consumer\'s components, in their order');
  assert.equal(definition.chosenBy, 'model');
  assert.match(definition.hash, /^[0-9a-f]{64}$/);
});

test('definition: its hash is the SHA-256 of the canonical JSON of the rest, which is the literal written out here', () => {
  const definition = civicRouter.harnessDefinition(FIXED_INPUT);
  const { hash, ...rest } = definition;
  assert.equal(canonicalJson(rest), FIXED_CANONICAL);
  assert.equal(hash, nodeSha256(FIXED_CANONICAL));
});

test('definition: the same inputs give one hash; another selection, or another component guidance hash, gives another', () => {
  const harnessDefinition = civicRouter.harnessDefinition;
  const first = harnessDefinition(FIXED_INPUT);
  assert.equal(harnessDefinition({ ...FIXED_INPUT, components: COMPONENTS.map((c) => ({ ...c })) }).hash, first.hash);
  const otherSelection = harnessDefinition({ ...FIXED_INPUT, selection: ['socrata'] });
  assert.notEqual(otherSelection.hash, first.hash);
  const otherGuidance = harnessDefinition({
    ...FIXED_INPUT,
    components: [{ ...COMPONENTS[0]!, guidanceHash: HASH_EMPTY }, ...COMPONENTS.slice(1)],
  });
  assert.notEqual(otherGuidance.hash, first.hash);
  assert.notEqual(harnessDefinition({ ...FIXED_INPUT, chosenBy: 'reader' }).hash, first.hash, 'chosenBy is in the hash');
});

test('definition: it carries only id, version and guidanceHash of a component; any other key the consumer\'s component has is not read', () => {
  const harnessDefinition = civicRouter.harnessDefinition;
  const withOrigin = COMPONENTS.map((c) => ({ ...c, guidanceOrigin: 'endpoint' }));
  const definition = harnessDefinition({ ...FIXED_INPUT, components: withOrigin });
  assert.deepEqual(definition.components, COMPONENTS);
  assert.equal(definition.hash, harnessDefinition(FIXED_INPUT).hash);
});

test('definition: the domain is a value the civic layer passes to core', () => {
  const definition = harnessDefinitionOf({ domain: 'example', sources: ['a'], components: [{ id: 'a' }], chosenBy: 'instance' });
  assert.equal(definition.domain, 'example');
  assert.equal(definition.hash, nodeSha256('{"chosenBy":"instance","components":[{"id":"a"}],"domain":"example","sources":["a"]}'));
});

test('definition: chosenBy outside reader, model and instance, an empty id, a guidanceHash not 64 lowercase hex, and an empty version are each refused', () => {
  const harnessDefinition = civicRouter.harnessDefinition;
  for (const chosenBy of ['reader', 'model', 'instance'] as const) {
    assert.doesNotThrow(() => harnessDefinition({ ...FIXED_INPUT, chosenBy }), `chosenBy ${chosenBy} is accepted`);
  }
  const refused = (input: HarnessDefinitionInput, pattern: RegExp, what: string) =>
    assert.throws(
      () => harnessDefinition(input),
      (error: unknown) => error instanceof Error && error.name === 'HarnessDefinitionError' && pattern.test(error.message),
      what,
    );
  refused({ ...FIXED_INPUT, chosenBy: 'user' as ChosenBy }, /chosenBy/, 'a chosenBy outside the three');
  refused({ ...FIXED_INPUT, components: [{ id: '' }] }, /id/, 'an empty id');
  refused({ ...FIXED_INPUT, components: [{ id: 'a', guidanceHash: HASH_ABC.toUpperCase() }] }, /guidanceHash/, 'an upper-case guidanceHash');
  refused({ ...FIXED_INPUT, components: [{ id: 'a', guidanceHash: HASH_ABC.slice(1) }] }, /guidanceHash/, 'a 63-character guidanceHash');
  refused({ ...FIXED_INPUT, components: [{ id: 'a', guidanceHash: `${HASH_ABC.slice(1)}g` }] }, /guidanceHash/, 'a non-hex guidanceHash');
  refused({ ...FIXED_INPUT, components: [{ id: 'a', version: '' }] }, /version/, 'an empty version');
});

// --- The canonical JSON ------------------------------------------------------------------

test('canonical JSON: members in UTF-16 code-unit order, no whitespace, strings as JSON.stringify writes them', () => {
  // Code-point order would put U+FB33 before U+1F600; UTF-16 code units put
  // the surrogate pair (0xD83D …) first.
  const value = {
    'דּ': 'hebrew',
    '😀': 'emoji',
    '€': 'euro',
    b: ['x', 'y'],
    a: { z: 'quote " backslash \\ newline \n control \u0001', y: 'é  ' },
    A: [],
    '': {},
  };
  assert.equal(
    canonicalJson(value),
    '{"":{},"A":[],"a":{"y":"\u00e9 \u2028","z":"quote \\" backslash \\\\ newline \\n control \\u0001"},"b":["x","y"],"\u20ac":"euro","\ud83d\ude00":"emoji","\ufb33":"hebrew"}',
  );
});

test('canonical JSON: any value other than a string, an array or a plain object is refused with a named error', () => {
  const refusals: unknown[] = [1, 0, true, false, null, undefined, () => 'f', new Date(0), new Map(), Symbol('s'), 1n, { a: 1 }, ['a', null], { a: undefined }, [, 'hole']];
  for (const value of refusals) {
    assert.throws(
      () => canonicalJson(value),
      (error: unknown) => error instanceof Error && error.name === 'CanonicalJsonError',
      `refuses ${String(typeof value)} ${Array.isArray(value) ? 'array' : ''}`,
    );
  }
});

// --- The SHA-256 -----------------------------------------------------------------------------

test('SHA-256: the FIPS 180-4 example digests', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const twoBlock = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
  assert.equal(twoBlock.length, 56);
  assert.equal(sha256Hex(twoBlock), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(sha256Hex('a'.repeat(1_000_000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});

/** A small deterministic generator, so a failure reproduces. */
function* generator(seed: number): Generator<number> {
  let state = seed >>> 0;
  for (;;) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    yield state;
  }
}

test('SHA-256: equals node:crypto over 1,200 generated inputs, the 55-, 56- and 64-byte boundaries and multi-byte UTF-8 among them', () => {
  const next = generator(0xa5a5a5a5);
  const n = (): number => next.next().value as number;
  let count = 0;

  // Byte inputs at and around every block boundary up to three blocks.
  for (let length = 0; length <= 200; length++) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = n() & 0xff;
    assert.equal(sha256Hex(bytes), nodeSha256(bytes), `bytes of length ${length}`);
    count++;
  }
  for (const length of [55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
    const text = 'x'.repeat(length);
    assert.equal(sha256Hex(text), nodeSha256(text), `text of ${length} bytes`);
    count++;
  }

  // Strings mixing one-, two-, three- and four-byte UTF-8 characters.
  const alphabet = ['a', 'Z', '0', ' ', '\n', 'é', 'ß', 'Ж', '€', '中', 'דּ', '😀', '𐀀'];
  while (count < 1200) {
    const length = n() % 90;
    let text = '';
    for (let i = 0; i < length; i++) text += alphabet[n() % alphabet.length];
    assert.equal(sha256Hex(text), nodeSha256(text), `text ${JSON.stringify(text)}`);
    count++;
  }
  assert.ok(count >= 1000);
});
