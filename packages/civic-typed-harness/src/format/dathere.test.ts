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
  CIVICAITOOLS_ENVIRONMENT_HOST,
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

test('environment extension: OES §9.1.1 field set, host from config (demo default)', () => {
  const env = buildDatHereEnvironment('openai/gpt-4o', 'https://socrata-mcp.civicaitools.org');
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

test('composite derivation: datHere input produces all four envelope fields', () => {
  const fields = deriveDatHereEnvelopeFields({
    model: 'openai/gpt-4o',
    contentProfile: DATHERE_CONTENT_PROFILE,
    summary: 'Short summary.',
    skillMcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    extensions: { 'org.civicaitools.notebook': { cells: [] } },
  });
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
  });
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
  });
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
  });
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
