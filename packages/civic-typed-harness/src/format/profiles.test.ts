// captureMethod vocabulary-surface tests: the harness's profile constants
// must be consistent with verify-core's Q32 fallback table — by construction
// (they ARE the table entry) and by assertion (this test locks the values).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_CAPTURE_VOCAB } from '@typedstandards/verify-core';
import {
  AI_ASSISTED_ANALYSIS_PROFILE_TYPE,
  AI_ASSISTED_ANALYSIS_CAPTURE_METHODS,
} from './profiles.ts';
import { DATHERE_PRODUCER_PROFILE } from './dathere.ts';

test('profile type matches the compound producerProfile prefix', () => {
  assert.equal(AI_ASSISTED_ANALYSIS_PROFILE_TYPE, 'ai-assisted-analysis');
  assert.equal(
    DATHERE_PRODUCER_PROFILE.split('/')[0],
    AI_ASSISTED_ANALYSIS_PROFILE_TYPE,
  );
});

test('captureMethod vocabulary is verify-core\'s Q32 fallback-table entry (single-sourced)', () => {
  assert.equal(
    AI_ASSISTED_ANALYSIS_CAPTURE_METHODS,
    PROFILE_CAPTURE_VOCAB[AI_ASSISTED_ANALYSIS_PROFILE_TYPE],
    'must be the same array object — re-exported, not copied',
  );
  assert.deepEqual(AI_ASSISTED_ANALYSIS_CAPTURE_METHODS, [
    'chat-flow-stream',
    'claude-code-jsonl-readback',
    'claude-code-self-report',
  ]);
});
