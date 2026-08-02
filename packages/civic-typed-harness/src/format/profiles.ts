// captureMethod vocabulary surface (FORMAT-EXTENSION group) — the profile
// constants the civic harness publishes under, re-exported CONSISTENT WITH
// verify-core's hardcoded fallback table by construction (the values below
// ARE that table's entry, not a copy).
//
// ⚠ Q32 adjacency (open-questions registry): verify-core's per-profile
// captureMethod vocabulary is a hardcoded fallback table pending versioned,
// content-addressed guidance bundles. The `ai-assisted-analysis` guidance
// bundle already lives in civic-ai-tools docs (ADR-0006/ADR-0011), which is
// one more reason the Q32 versioned-bundle question eventually lands in this
// package. Flagged, not solved, here — do not grow this module into a bundle
// mechanism without resolving Q32 first.

// Reached through @typedstandards/produce-core's 0.2.0 re-exports (the
// harness's single declared dependency); the table itself is verify-core's.
import {
  PROFILE_CAPTURE_VOCAB,
  type CaptureMethod,
} from '@typedstandards/produce-core';

export type { CaptureMethod };

/** The profile TYPE the civic harness publishes under (the segment before the
 *  first `/` of the compound producerProfile). */
export const AI_ASSISTED_ANALYSIS_PROFILE_TYPE = 'ai-assisted-analysis';

/**
 * The captureMethod vocabulary for the `ai-assisted-analysis` profile type —
 * verify-core's Q32 fallback-table entry, re-exported (single-sourced, so the
 * harness cannot drift from what the verifier accepts):
 * `chat-flow-stream` · `claude-code-jsonl-readback` ·
 * `claude-code-self-report` (legacy, deprecated 2026-04-28).
 */
export const AI_ASSISTED_ANALYSIS_CAPTURE_METHODS: readonly CaptureMethod[] =
  PROFILE_CAPTURE_VOCAB[AI_ASSISTED_ANALYSIS_PROFILE_TYPE];
