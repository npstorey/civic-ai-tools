// Skill-metadata extraction tests: `skill_fetch` span walking and the
// trace-as-BlobRef inspection fallback ported from the reference packager.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSkillMetadata, traceForInspection } from './skill-metadata.ts';

function skillTrace(attrs: Record<string, string>): Record<string, unknown> {
  return {
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                name: 'skill_fetch',
                attributes: Object.entries(attrs).map(([key, stringValue]) => ({
                  key,
                  value: { stringValue },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}

test('extracts hash, server URL, and skill text from the skill_fetch span', () => {
  const meta = extractSkillMetadata(
    skillTrace({
      'skill.text_hash': 'abc123',
      'skill.mcp_server_url': 'https://socrata-mcp.civicaitools.org',
      'skill.text': 'You are a civic data analyst…',
    }),
  );
  assert.deepEqual(meta, {
    systemPromptHash: 'abc123',
    mcpServerUrl: 'https://socrata-mcp.civicaitools.org',
    skillText: 'You are a civic data analyst…',
  });
});

test('missing attributes come back undefined (empty strings coerce to undefined)', () => {
  const meta = extractSkillMetadata(skillTrace({ 'skill.text_hash': 'abc123' }));
  assert.equal(meta.systemPromptHash, 'abc123');
  assert.equal(meta.mcpServerUrl, undefined);
  assert.equal(meta.skillText, undefined);
});

test('no skill_fetch span → empty result', () => {
  assert.deepEqual(
    extractSkillMetadata({
      resourceSpans: [{ scopeSpans: [{ spans: [{ name: 'llm_inference', attributes: [] }] }] }],
    }),
    {},
  );
});

test('non-span-shaped trace → empty result, no throw', () => {
  assert.deepEqual(extractSkillMetadata({}), {});
  assert.deepEqual(extractSkillMetadata({ resourceSpans: 'garbage' as unknown as [] }), {});
});

test('traceForInspection passes span-shaped traces through unchanged', () => {
  const trace = skillTrace({ 'skill.text_hash': 'abc' });
  assert.equal(traceForInspection(trace), trace);
});

test('traceForInspection degrades a BlobRef trace to the empty trace', () => {
  const blobRef = {
    ref: 'blob:sha256:1111111111111111111111111111111111111111111111111111111111111111',
    url: 'https://blob.example/traces/1111.json',
    contentType: 'application/json',
    size: 1024,
  };
  const inspectable = traceForInspection(blobRef);
  assert.deepEqual(inspectable, { resourceSpans: [] });
  // Downstream extraction degrades gracefully on the empty trace.
  assert.deepEqual(extractSkillMetadata(inspectable), {});
});
