// Skill-metadata extraction (CAPTURE group) — OTel `skill_fetch` span
// walking, relocated from civic-ai-tools-website
// `src/lib/evidence/packager.ts:303–322` (extraction) and `:354–357` (the
// trace-as-BlobRef inspection fallback) per the S2 brief §1.

import { isBlobRef, type BlobRef } from '@typedstandards/produce-core';

/** Skill metadata extracted from a trace's `skill_fetch` span. Feeds the
 *  envelope's `skillMetadata` block (and the datHere policy's
 *  `skillMcpServerUrl` input). */
export interface ExtractedSkillMetadata {
  systemPromptHash?: string;
  mcpServerUrl?: string;
  skillText?: string;
}

/**
 * Extract skill metadata from the trace's `skill_fetch` span. Returns `{}`
 * when the trace has no such span (or is not span-shaped) — callers shipping
 * trace-as-BlobRef should supply an explicit override instead (the packager
 * cannot inspect spans it does not have).
 */
export function extractSkillMetadata(
  trace: Record<string, unknown>,
): ExtractedSkillMetadata {
  try {
    // Untyped walk over the caller's trace shape.
    const spans = (trace as any)?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans;
    if (!Array.isArray(spans)) return {};
    const skillSpan = spans.find((s: { name: string }) => s.name === 'skill_fetch');
    if (!skillSpan) return {};
    const attrs: Record<string, string> = {};
    for (const a of skillSpan.attributes || []) {
      attrs[a.key] = a.value?.stringValue || '';
    }
    return {
      systemPromptHash: attrs['skill.text_hash'] || undefined,
      mcpServerUrl: attrs['skill.mcp_server_url'] || undefined,
      skillText: attrs['skill.text'] || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Resolve the span-walkable view of a trace input. When the trace is a
 * BlobRef the capture machinery cannot inspect spans (data-source detection,
 * skill extraction, PROV-O construction all degrade gracefully on the empty
 * trace this returns); otherwise the trace object passes through unchanged.
 */
export function traceForInspection(
  trace: Record<string, unknown> | BlobRef,
): Record<string, unknown> {
  return isBlobRef(trace)
    ? { resourceSpans: [] }
    : (trace as Record<string, unknown>);
}
