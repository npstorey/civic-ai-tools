// datHere-policy tests: the derivations ported from the reference packager
// (producerProfile, canonicalization selection, summary emission, environment
// extension), the host config input, and the derive→assemble seam — the
// derived fields feed produce-core's buildEnvelope and reproduce the
// packager's conditional-emission behavior (ported from the reference
// packager.test.ts ADR-0004 section).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATHERE_PRODUCER_PROFILE,
  DATHERE_CONTENT_PROFILE,
  ENVIRONMENT_EXTENSION_KEY,
  COMPOSITION_EXTENSION_KEY,
  SOURCE_OFFERED_REASONS,
  RecordFieldError,
  CIVICAITOOLS_ENVIRONMENT_HOST,
  CIVICAITOOLS_ENVIRONMENT_CONFIG,
  deriveProducerProfile,
  selectContentCanonicalization,
  deriveSummaryEmission,
  buildDatHereEnvironment,
  deriveDatHereEnvelopeFields,
} from './dathere.ts';
import { buildEnvelope, type EnvelopeInput } from '@typedstandards/produce-core';
import {
  LEGACY_JSON_CANONICALIZATION,
  DATHERE_AG_JUPYTER_CANONICALIZATION,
} from '@typedstandards/verify-core';

test('producerProfile: auto-derived for datHere, absent otherwise, explicit wins', () => {
  assert.equal(deriveProducerProfile(undefined, 'datHere'), 'ai-assisted-analysis/datHere');
  assert.equal(deriveProducerProfile(undefined, undefined), undefined);
  assert.equal(deriveProducerProfile(undefined, 'default'), undefined);
  assert.equal(
    deriveProducerProfile('ai-assisted-analysis/other', 'datHere'),
    'ai-assisted-analysis/other',
  );
  assert.equal(DATHERE_PRODUCER_PROFILE, 'ai-assisted-analysis/datHere');
});

test('canonicalization selection: dathere-ag-jupyter/v1 for datHere, legacy-json/v1 otherwise', () => {
  assert.equal(
    selectContentCanonicalization('datHere'),
    DATHERE_AG_JUPYTER_CANONICALIZATION,
  );
  assert.equal(selectContentCanonicalization(undefined), LEGACY_JSON_CANONICALIZATION);
  assert.equal(selectContentCanonicalization('default'), LEGACY_JSON_CANONICALIZATION);
  // The rule URIs are verify-core's — re-emitted, never redefined.
  assert.ok(DATHERE_AG_JUPYTER_CANONICALIZATION.endsWith('/dathere-ag-jupyter/v1'));
  assert.ok(LEGACY_JSON_CANONICALIZATION.endsWith('/legacy-json/v1'));
});

test('summary emission: only under the datHere profile, and only when non-empty', () => {
  assert.equal(deriveSummaryEmission('datHere', 'A summary.'), 'A summary.');
  assert.equal(deriveSummaryEmission(undefined, 'A summary.'), undefined);
  assert.equal(deriveSummaryEmission('default', 'A summary.'), undefined);
  assert.equal(deriveSummaryEmission('datHere', undefined), undefined);
  assert.equal(deriveSummaryEmission('datHere', ''), undefined);
});

/** The two values every package before 0.7.0 recorded as placeholders.
 *  Passed explicitly, they reproduce those packages' bytes (ADR-0033 §C);
 *  never a default. */
const RECORDED_PLACEHOLDERS = { temperature: 0, toolDefinitions: [] } as const;

test('environment extension: §8.7.1 field set, host from config (reference config, passed explicitly)', () => {
  const env = buildDatHereEnvironment(
    'openai/gpt-4o',
    'https://socrata-mcp.civicaitools.org',
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
    RECORDED_PLACEHOLDERS,
  );
  assert.deepEqual(env, {
    modelVersion: 'openai/gpt-4o',
    temperature: 0,
    mcpServers: [{ url: 'https://socrata-mcp.civicaitools.org' }],
    toolDefinitions: [],
    host: CIVICAITOOLS_ENVIRONMENT_HOST,
  });
  // Key order is part of the byte contract on the legacy chain.
  assert.deepEqual(Object.keys(env), [
    'modelVersion',
    'temperature',
    'mcpServers',
    'toolDefinitions',
    'host',
  ]);
});

test('environment extension: host is a config input, not a constant', () => {
  const env = buildDatHereEnvironment('openai/gpt-4o', undefined, {
    host: 'evidence.city.example',
  });
  assert.equal(env.host, 'evidence.city.example');
  assert.deepEqual(env.mcpServers, []);
});

// --- #449: the environment names the servers the run had ---

/** The exact bytes today's single-URL call emits, captured from the
 *  pre-#449 builder at 3d09d99. The additive list parameter must leave these
 *  untouched: an already-signed datHere package reproduces through this
 *  function, so a moved byte here is a broken record, not a new feature. */
const PRE_CHANGE_SINGLE_URL_BYTES =
  '{"modelVersion":"openai/gpt-4o","temperature":0,'
  + '"mcpServers":[{"url":"https://socrata-mcp.civicaitools.org"}],'
  + '"toolDefinitions":[],"host":"civicaitools.org"}';

/** And the bytes when there is no server at all. */
const PRE_CHANGE_NO_SERVER_BYTES =
  '{"modelVersion":"openai/gpt-4o","temperature":0,'
  + '"mcpServers":[],"toolDefinitions":[],"host":"civicaitools.org"}';

test('#449: the single-URL call shape is byte-identical to the pre-change builder, given the recorded values', () => {
  assert.equal(
    JSON.stringify(
      buildDatHereEnvironment(
        'openai/gpt-4o',
        'https://socrata-mcp.civicaitools.org',
        CIVICAITOOLS_ENVIRONMENT_CONFIG,
        RECORDED_PLACEHOLDERS,
      ),
    ),
    PRE_CHANGE_SINGLE_URL_BYTES,
  );
  assert.equal(
    JSON.stringify(
      buildDatHereEnvironment('openai/gpt-4o', undefined, CIVICAITOOLS_ENVIRONMENT_CONFIG, RECORDED_PLACEHOLDERS),
    ),
    PRE_CHANGE_NO_SERVER_BYTES,
  );
});

test('#449: two servers are listed as two, in the order given, each carrying its name', () => {
  // Two entries that cannot collapse into one: different urls AND different
  // names. A builder that kept only the first, de-duplicated, or sorted would
  // fail here rather than pass on a shape that could not tell.
  const env = buildDatHereEnvironment(
    'openai/gpt-4o',
    [
      { url: 'https://mcp-warehouse.city.example', name: 'city-warehouse' },
      { url: 'https://mcp-indicators.city.example', name: 'indicators' },
    ],
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
    RECORDED_PLACEHOLDERS,
  );
  assert.deepEqual(env.mcpServers, [
    { url: 'https://mcp-warehouse.city.example', name: 'city-warehouse' },
    { url: 'https://mcp-indicators.city.example', name: 'indicators' },
  ]);
  // Order is the caller's, and it is in the hashed bytes.
  assert.equal(
    JSON.stringify(env.mcpServers),
    '[{"url":"https://mcp-warehouse.city.example","name":"city-warehouse"},'
    + '{"url":"https://mcp-indicators.city.example","name":"indicators"}]',
  );
  // The reverse order is a different serialization, so the assertion above is
  // about order and not merely about membership.
  assert.notEqual(
    JSON.stringify(env.mcpServers),
    JSON.stringify([
      { url: 'https://mcp-indicators.city.example', name: 'indicators' },
      { url: 'https://mcp-warehouse.city.example', name: 'city-warehouse' },
    ]),
  );
  // §8.7.1 requirement 3's field set is unchanged by the list shape.
  assert.deepEqual(Object.keys(env), [
    'modelVersion',
    'temperature',
    'mcpServers',
    'toolDefinitions',
    'host',
  ]);
});

test('#449: a list entry with no name emits no name key — the single-server bytes are the one-entry list', () => {
  assert.equal(
    JSON.stringify(
      buildDatHereEnvironment(
        'openai/gpt-4o',
        [{ url: 'https://socrata-mcp.civicaitools.org' }],
        CIVICAITOOLS_ENVIRONMENT_CONFIG,
        RECORDED_PLACEHOLDERS,
      ),
    ),
    PRE_CHANGE_SINGLE_URL_BYTES,
  );
});

test('#449: the composite derivation carries the list, and prefers it over the skill URL', () => {
  const withList = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    contentProfile: DATHERE_CONTENT_PROFILE,
    summary: 'Short summary.',
    skillMcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    mcpServers: [
      { url: 'https://mcp-warehouse.city.example', name: 'city-warehouse' },
      { url: 'https://mcp-indicators.city.example', name: 'indicators' },
    ],
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  const env = (withList.extensions as Record<string, Record<string, unknown>>)[
    ENVIRONMENT_EXTENSION_KEY
  ];
  assert.deepEqual(env.mcpServers, [
    { url: 'https://mcp-warehouse.city.example', name: 'city-warehouse' },
    { url: 'https://mcp-indicators.city.example', name: 'indicators' },
  ]);

  // Without the list, the pre-change input (with the values it recorded)
  // produces the pre-change bytes.
  const withoutList = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    contentProfile: DATHERE_CONTENT_PROFILE,
    summary: 'Short summary.',
    skillMcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    ...RECORDED_PLACEHOLDERS,
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  assert.equal(
    JSON.stringify(
      (withoutList.extensions as Record<string, unknown>)[ENVIRONMENT_EXTENSION_KEY],
    ),
    PRE_CHANGE_SINGLE_URL_BYTES,
  );
});

// --- ADR-0033 §C: temperature and toolDefinitions only when known (#240) ---

const OFFERED_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'socrata__get_data',
      description: 'Query a dataset.',
      parameters: { type: 'object', properties: { dataset_id: { type: 'string' } }, required: ['dataset_id'] },
    },
  },
];

test('ADR-0033 §C: with neither input, the environment states neither temperature nor toolDefinitions', () => {
  const env = buildDatHereEnvironment(
    'openai/gpt-4o',
    'https://socrata-mcp.civicaitools.org',
    CIVICAITOOLS_ENVIRONMENT_CONFIG,
  );
  assert.deepEqual(Object.keys(env), ['modelVersion', 'mcpServers', 'host']);
  assert.equal(
    JSON.stringify(env),
    '{"modelVersion":"openai/gpt-4o","mcpServers":[{"url":"https://socrata-mcp.civicaitools.org"}],"host":"civicaitools.org"}',
    'the 0.6.0 bytes with exactly the two placeholder keys removed',
  );
});

test('ADR-0033 §C: values passed are stated verbatim, each in its 0.6.0 key position', () => {
  const env = buildDatHereEnvironment('openai/gpt-4o', undefined, CIVICAITOOLS_ENVIRONMENT_CONFIG, {
    temperature: 0.2,
    toolDefinitions: OFFERED_TOOLS,
  });
  assert.deepEqual(Object.keys(env), ['modelVersion', 'temperature', 'mcpServers', 'toolDefinitions', 'host']);
  assert.equal(env.temperature, 0.2);
  assert.equal(JSON.stringify(env.toolDefinitions), JSON.stringify(OFFERED_TOOLS));
  // Either one alone: the other stays absent.
  const toolsOnly = buildDatHereEnvironment('openai/gpt-4o', undefined, CIVICAITOOLS_ENVIRONMENT_CONFIG, {
    toolDefinitions: OFFERED_TOOLS,
  });
  assert.deepEqual(Object.keys(toolsOnly), ['modelVersion', 'mcpServers', 'toolDefinitions', 'host']);
});

test('ADR-0033 §C: the composite derivation carries both, and a temperature that is not a finite number is refused', () => {
  const fields = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    contentProfile: DATHERE_CONTENT_PROFILE,
    temperature: 1,
    toolDefinitions: OFFERED_TOOLS,
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  const env = fields.extensions![ENVIRONMENT_EXTENSION_KEY] as Record<string, unknown>;
  assert.equal(env.temperature, 1);
  assert.equal(JSON.stringify(env.toolDefinitions), JSON.stringify(OFFERED_TOOLS));
  assert.throws(
    () => deriveDatHereEnvelopeFields({ model: 'm', contentProfile: DATHERE_CONTENT_PROFILE, temperature: Number.NaN }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
    (e: unknown) => e instanceof RecordFieldError && e.field === 'temperature',
  );
});

// --- ADR-0033 §D: the run-time servers win (#495) ---

test('ADR-0033 §D: runMcpServers wins over the packaging-time list and the skill URL', () => {
  const fields = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    contentProfile: DATHERE_CONTENT_PROFILE,
    skillMcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    mcpServers: [{ url: 'https://boston-at-publish.example', name: 'boston-opencontext' }],
    runMcpServers: [{ url: 'https://boston-at-run.example', name: 'boston-opencontext' }],
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  const env = fields.extensions![ENVIRONMENT_EXTENSION_KEY] as Record<string, unknown>;
  assert.deepEqual(env.mcpServers, [{ url: 'https://boston-at-run.example', name: 'boston-opencontext' }]);
});

// --- ADR-0033 §E: the composition block ---

const SOURCES_OFFERED = [
  { sourceId: 'socrata', alias: 'socrata', reason: 'configured' },
  { sourceId: 'data-commons', alias: 'data_commons', reason: 'configured' },
  { sourceId: 'boston-opencontext', alias: 'boston', reason: 'not-configured' },
];
const COMPONENTS = [
  { id: 'io.github.example/socrata-mcp-server', version: '0.9.2', guidanceHash: 'a0'.repeat(32), guidanceOrigin: 'endpoint' },
  { id: 'data-commons', guidanceHash: 'b1'.repeat(32), guidanceOrigin: 'inline' },
  { id: '@typedstandards/civic-typed-router', version: '0.2.0' },
];

test('ADR-0033 §E: the composition block states the three fields, in key order, under every content profile', () => {
  for (const contentProfile of [DATHERE_CONTENT_PROFILE, undefined]) {
    const fields = deriveDatHereEnvelopeFields({
      model: 'openai/gpt-4o',
      contentProfile,
      assertedDate: '2026-10-15',
      sourcesOffered: SOURCES_OFFERED,
      components: COMPONENTS,
    }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
    const keys = Object.keys(fields.extensions!);
    assert.equal(keys[keys.length - 1], COMPOSITION_EXTENSION_KEY, 'appended after every other extension');
    assert.equal(
      JSON.stringify(fields.extensions![COMPOSITION_EXTENSION_KEY]),
      '{"assertedDate":"2026-10-15",'
      + '"sourcesOffered":[{"sourceId":"socrata","alias":"socrata","reason":"configured"},'
      + '{"sourceId":"data-commons","alias":"data_commons","reason":"configured"},'
      + '{"sourceId":"boston-opencontext","alias":"boston","reason":"not-configured"}],'
      + '"components":[{"id":"io.github.example/socrata-mcp-server","version":"0.9.2","guidanceHash":"' + 'a0'.repeat(32) + '","guidanceOrigin":"endpoint"},'
      + '{"id":"data-commons","guidanceHash":"' + 'b1'.repeat(32) + '","guidanceOrigin":"inline"},'
      + '{"id":"@typedstandards/civic-typed-router","version":"0.2.0"}]}',
    );
  }
});

test('ADR-0033 §E: each field alone is stated alone, and with none the block is absent', () => {
  const dateOnly = deriveDatHereEnvelopeFields({ model: 'm', assertedDate: '2024-02-29' }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  assert.equal(JSON.stringify(dateOnly.extensions), '{"org.civicaitools.composition":{"assertedDate":"2024-02-29"}}');
  const none = deriveDatHereEnvelopeFields({ model: 'm' }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  assert.equal(none.extensions, undefined);
});

test('ADR-0033 §E: a value outside the record\'s form is refused, never dropped', () => {
  const refuses = (input: Record<string, unknown>, field: string) =>
    assert.throws(
      () => deriveDatHereEnvelopeFields({ model: 'm', ...input }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
      (e: unknown) => e instanceof RecordFieldError && e.field === field,
      `${JSON.stringify(input)} was not refused under ${field}`,
    );
  refuses({ assertedDate: '2026-10-15T00:00:00Z' }, 'assertedDate');
  refuses({ assertedDate: '2026-02-30' }, 'assertedDate');
  refuses({ assertedDate: '2025-02-29' }, 'assertedDate');
  refuses({ sourcesOffered: [{ sourceId: 'socrata', alias: 'socrata', reason: 'offered' }] }, 'sourcesOffered');
  refuses({ sourcesOffered: [{ sourceId: '', alias: 'socrata', reason: 'configured' }] }, 'sourcesOffered');
  refuses({
    sourcesOffered: [
      { sourceId: 'socrata', alias: 'socrata', reason: 'configured' },
      { sourceId: 'socrata', alias: 'socrata', reason: 'selected' },
    ],
  }, 'sourcesOffered');
  refuses({ components: [{ id: 'x', guidanceHash: 'A0'.repeat(32), guidanceOrigin: 'inline' }] }, 'components');
  refuses({ components: [{ id: 'x', guidanceHash: 'a0'.repeat(32) }] }, 'components');
  refuses({ components: [{ id: 'x', guidanceOrigin: 'inline' }] }, 'components');
  refuses({ components: [{ id: 'x', guidanceHash: 'a0'.repeat(32), guidanceOrigin: 'remote' }] }, 'components');
  refuses({ components: [{ id: 'x', version: '' }] }, 'components');
});

// --- ADR-0033 §E as amended 2026-10-18: the six reasons ---

const SIX_REASONS = ['configured', 'not-configured', 'selected', 'not-selected', 'reader-off', 'not-consented'];

/** ADR-0033 §E: "a source was offered exactly when its reason is `configured`
 *  or `selected`". Written here, since the harness exports no predicate. */
const wasOffered = (reason: string): boolean => reason === 'configured' || reason === 'selected';

test('ADR-0033 §E amended: the reasons are the four in §E\'s order, then reader-off and not-consented', () => {
  assert.deepEqual([...SOURCE_OFFERED_REASONS], SIX_REASONS);
});

test('ADR-0033 §E amended: the derivation accepts each of the six reasons and states it as passed', () => {
  for (const reason of SIX_REASONS) {
    const fields = deriveDatHereEnvelopeFields({
      model: 'm',
      sourcesOffered: [{ sourceId: 'socrata', alias: 'socrata', reason }],
    }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
    assert.equal(
      JSON.stringify(fields.extensions),
      `{"org.civicaitools.composition":{"sourcesOffered":[{"sourceId":"socrata","alias":"socrata","reason":"${reason}"}]}}`,
      `reason ${reason}`,
    );
  }
});

test('ADR-0033 §E amended: a seventh reason is refused with RecordFieldError', () => {
  for (const reason of ['off', 'ask-first', 'not-selected ', 'Reader-off', '']) {
    assert.throws(
      () => deriveDatHereEnvelopeFields({
        model: 'm',
        sourcesOffered: [{ sourceId: 'socrata', alias: 'socrata', reason }],
      }, CIVICAITOOLS_ENVIRONMENT_CONFIG),
      (e: unknown) => e instanceof RecordFieldError && e.field === 'sourcesOffered',
      `reason ${JSON.stringify(reason)} was not refused`,
    );
  }
});

test('ADR-0033 §E amended: "offered" is exactly configured or selected, over the six', () => {
  assert.deepEqual(SIX_REASONS.filter(wasOffered), ['configured', 'selected']);
  assert.deepEqual(SOURCE_OFFERED_REASONS.filter(wasOffered), ['configured', 'selected']);
  for (const reason of ['not-configured', 'not-selected', 'reader-off', 'not-consented']) {
    assert.equal(wasOffered(reason), false, `${reason} is not offered`);
  }
});

// --- ADR-0033 §E as amended 2026-10-18: the flows statement, by reference ---

const FLOWS = { url: 'https://instance.example/api/flows', hash: 'c4'.repeat(32), date: '2026-10-18' };
const FLOWS_JSON = '{"url":"https://instance.example/api/flows","hash":"' + 'c4'.repeat(32) + '","date":"2026-10-18"}';

/** Derive with inputs the policy type may not name yet (typed as a record, as
 *  the refusal helper above passes its inputs). */
function deriveWith(input: Record<string, unknown>) {
  return deriveDatHereEnvelopeFields({ model: 'm', ...input }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
}

test('ADR-0033 §E amended: a block passed only flowsStatement carries that one key, exactly as passed', () => {
  assert.equal(
    JSON.stringify(deriveWith({ flowsStatement: FLOWS }).extensions),
    '{"org.civicaitools.composition":{"flowsStatement":' + FLOWS_JSON + '}}',
  );
  // Stated in the record's key order (url, hash, date), whatever order it was passed in.
  const reordered = { date: FLOWS.date, hash: FLOWS.hash, url: FLOWS.url };
  assert.equal(
    JSON.stringify(deriveWith({ flowsStatement: reordered }).extensions),
    '{"org.civicaitools.composition":{"flowsStatement":' + FLOWS_JSON + '}}',
  );
  // A local instance's address is accepted (shape answer (a)).
  const local = { ...FLOWS, url: 'http://localhost:3000/api/flows' };
  const block = deriveWith({ flowsStatement: local }).extensions![COMPOSITION_EXTENSION_KEY] as Record<string, unknown>;
  assert.deepEqual(block.flowsStatement, local);
});

test('ADR-0033 §E amended: flowsStatement is the block\'s last key, after the three fields, under every content profile', () => {
  for (const contentProfile of [DATHERE_CONTENT_PROFILE, undefined]) {
    const fields = deriveWith({
      contentProfile,
      assertedDate: '2026-10-15',
      sourcesOffered: SOURCES_OFFERED,
      components: COMPONENTS,
      flowsStatement: FLOWS,
    });
    const block = fields.extensions![COMPOSITION_EXTENSION_KEY] as Record<string, unknown>;
    assert.deepEqual(Object.keys(block), ['assertedDate', 'sourcesOffered', 'components', 'flowsStatement']);
    assert.equal(JSON.stringify(block.flowsStatement), FLOWS_JSON);
  }
});

test('ADR-0033 §E amended: an absent flowsStatement is an absent key, and the block\'s bytes do not move', () => {
  const without = deriveWith({ assertedDate: '2026-10-15', sourcesOffered: SOURCES_OFFERED, components: COMPONENTS });
  const withUndefined = deriveWith({ assertedDate: '2026-10-15', sourcesOffered: SOURCES_OFFERED, components: COMPONENTS, flowsStatement: undefined });
  assert.equal(JSON.stringify(withUndefined.extensions), JSON.stringify(without.extensions));
  assert.equal(JSON.stringify(without.extensions).includes('flowsStatement'), false);
  assert.equal(deriveWith({ flowsStatement: undefined }).extensions, undefined);
});

test('ADR-0033 §E amended: a flowsStatement outside the record\'s form is refused, never dropped', () => {
  const refused = (flowsStatement: unknown, why: string) =>
    assert.throws(
      () => deriveWith({ flowsStatement }),
      (e: unknown) => e instanceof RecordFieldError && e.field === 'flowsStatement',
      `${why}: ${JSON.stringify(flowsStatement)} was not refused`,
    );
  // The object itself.
  refused(null, 'null');
  refused([FLOWS], 'an array');
  refused(FLOWS_JSON, 'JSON text instead of an object');
  refused({ url: FLOWS.url, hash: FLOWS.hash }, 'a missing date');
  refused({ ...FLOWS, content: 'the statement itself' }, 'an extra key');
  // hash: lowercase hex SHA-256.
  refused({ ...FLOWS, hash: 'C4'.repeat(32) }, 'uppercase hex');
  refused({ ...FLOWS, hash: 'c4'.repeat(31) }, '62 hex digits');
  refused({ ...FLOWS, hash: 'sha256:' + 'c4'.repeat(32) }, 'a prefixed digest');
  refused({ ...FLOWS, hash: 7 }, 'a number');
  // date: a real YYYY-MM-DD.
  refused({ ...FLOWS, date: '2026-02-30' }, 'no such day');
  refused({ ...FLOWS, date: '2026-10-18T00:00:00Z' }, 'a timestamp');
  refused({ ...FLOWS, date: '' }, 'empty');
  // url: an absolute http: or https: URL with no credentials and no whitespace.
  refused({ ...FLOWS, url: '/api/flows' }, 'a relative reference');
  refused({ ...FLOWS, url: 'instance.example/api/flows' }, 'no scheme');
  refused({ ...FLOWS, url: 'ftp://instance.example/flows.json' }, 'another scheme');
  refused({ ...FLOWS, url: 'data:application/json,{}' }, 'a data URL');
  refused({ ...FLOWS, url: 'https:instance.example/api/flows' }, 'no authority');
  refused({ ...FLOWS, url: 'https://reader:pw@instance.example/api/flows' }, 'credentials');
  refused({ ...FLOWS, url: ' https://instance.example/api/flows' }, 'leading whitespace');
  refused({ ...FLOWS, url: 'https://instance.example/api/\nflows' }, 'an embedded newline');
  refused({ ...FLOWS, url: '' }, 'empty');
  refused({ ...FLOWS, url: 42 }, 'a number');
});

test('composite derivation: datHere input produces all four envelope fields', () => {
  const fields = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    contentProfile: DATHERE_CONTENT_PROFILE,
    summary: 'Short summary.',
    skillMcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    extensions: { 'org.civicaitools.notebook': { cells: [] } },
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  assert.equal(fields.producerProfile, DATHERE_PRODUCER_PROFILE);
  assert.equal(fields.contentCanonicalization, DATHERE_AG_JUPYTER_CANONICALIZATION);
  assert.equal(fields.summary, 'Short summary.');
  assert.ok(fields.extensions);
  // Caller extensions are preserved; the environment extension layers on top.
  assert.ok(fields.extensions!['org.civicaitools.notebook']);
  const env = fields.extensions![ENVIRONMENT_EXTENSION_KEY] as Record<string, unknown>;
  assert.equal(env.modelVersion, 'openai/gpt-4o');
  assert.equal(env.host, CIVICAITOOLS_ENVIRONMENT_HOST);
});

test('composite derivation: non-datHere input emits neither summary nor environment extension', () => {
  const fields = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    summary: 'Provided but not emitted.',
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  assert.equal(fields.producerProfile, undefined);
  assert.equal(fields.contentCanonicalization, LEGACY_JSON_CANONICALIZATION);
  assert.equal(fields.summary, undefined);
  assert.equal(fields.extensions, undefined);
});

// --- The derive→assemble seam (ADR-0021: the harness derives, the core
// --- assembles). Ported behaviors from the reference packager.test.ts.

function envelopeInput(overrides: Partial<EnvelopeInput> = {}): EnvelopeInput {
  return {
    packageId: '00000000-0000-4000-8000-000000000001',
    createdAt: '2026-08-01T00:00:00.000Z',
    signingKeyId: 'platform:test-key',
    prompt: 'How many noise complaints?',
    promptVisibility: 'full_text',
    queries: [],
    dataSources: [],
    cost: { model: 'openai/gpt-4o' },
    skillMetadata: {},
    output: 'There were 12 complaints.',
    trace: { resourceSpans: [] },
    ...overrides,
  };
}

function datHereAssembled(model = 'openai/gpt-4o', summary = 'Test summary.') {
  const fields = deriveDatHereEnvelopeFields({
    model,
    contentProfile: DATHERE_CONTENT_PROFILE,
    summary,
    skillMcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    // v0.1 datHere packages carry the executed notebook (the
    // dathere-ag-jupyter/v1 content hash fingerprints it) — the publish flow
    // supplies it as a caller extension; a stub stands in here.
    extensions: {
      'org.civicaitools.notebook': { nbformat: 4, nbformat_minor: 5, cells: [] },
    },
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  return buildEnvelope(
    envelopeInput({
      cost: { model },
      captureMethod: 'chat-flow-stream',
      contentProfile: DATHERE_CONTENT_PROFILE,
      type: 'content/analysis/v1',
      ...fields,
    }),
  );
}

test('assembled datHere envelope carries summary in canonical JSON', () => {
  const { pkg } = datHereAssembled();
  assert.equal(pkg.summary, 'Test summary.');
  assert.ok(Object.prototype.hasOwnProperty.call(pkg, 'summary'));
});

test('assembled datHere envelope auto-carries the environment extension', () => {
  const { pkg } = datHereAssembled();
  const env = pkg.extensions?.[ENVIRONMENT_EXTENSION_KEY] as Record<string, unknown>;
  assert.ok(env, 'environment extension should be present');
  assert.equal(env.modelVersion, 'openai/gpt-4o');
  assert.equal(env.host, CIVICAITOOLS_ENVIRONMENT_HOST);
  assert.equal(pkg.producerProfile, DATHERE_PRODUCER_PROFILE);
  assert.equal(pkg.contentCanonicalization, DATHERE_AG_JUPYTER_CANONICALIZATION);
});

test('assembled non-datHere envelope emits neither summary nor environment extension', () => {
  const fields = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    summary: 'Provided but off-envelope.',
  }, CIVICAITOOLS_ENVIRONMENT_CONFIG);
  const { pkg } = buildEnvelope(
    envelopeInput({ captureMethod: 'chat-flow-stream', ...fields }),
  );
  assert.equal(JSON.stringify(pkg).includes('"summary"'), false);
  assert.equal(pkg.extensions?.[ENVIRONMENT_EXTENSION_KEY], undefined);
  assert.equal(pkg.producerProfile, undefined);
});

test('summary value is part of the envelope hash for datHere (tamper-evidence)', () => {
  const a = datHereAssembled('openai/gpt-4o', 'Summary A');
  const b = datHereAssembled('openai/gpt-4o', 'Summary B');
  assert.notEqual(a.envelopeHash, b.envelopeHash);
});

test('environment modelVersion is part of the envelope hash for datHere (tamper-evidence)', () => {
  const a = datHereAssembled('openai/gpt-4o');
  const b = datHereAssembled('anthropic/claude-3-5-sonnet');
  assert.notEqual(a.envelopeHash, b.envelopeHash);
});
