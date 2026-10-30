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
//
// First worked instance (ADR-0038, 2026-10-30): the
// `ai-assisted-analysis/civicaitools-v1` subtype's bundle is one hub file,
// pinned by URL and SHA-256 in verify-core's subtype table (0.15.0). This
// module exports the subtype's name and nothing of its bundle: it reads no
// table, resolves no bundle and checks no digest. Q32 stays open.

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

/**
 * The Producer Profile subtype this project's reference host declares on its
 * records (hub ADR-0038 §1), full-text (`metadata.contentProfile: "datHere"`)
 * and hash-only (`"default"`) alike. The host passes it as `producerProfile`;
 * the derivation states it as passed under either content profile. Its
 * guidance bundle and the content profiles it admits are verify-core's subtype
 * table row, not this package's.
 */
export const CIVICAITOOLS_V1_PRODUCER_PROFILE = 'ai-assisted-analysis/civicaitools-v1';
