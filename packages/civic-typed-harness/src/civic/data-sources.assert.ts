// Type-level acceptance gate for the 0.4.0 additive change (civic-ai-tools#192):
// `ToolCallSummary` can see a rejection the producer recorded, and BOTH new
// fields are OPTIONAL — a caller that records no outcome passes neither and
// compiles exactly as it did at 0.3.1.
//
// Why a file rather than a test: `tsconfig.json` EXCLUDES `src/**/*.test.ts`,
// so the suite type-checks nothing. A test can drive a field the type does not
// have and `npm run typecheck` stays green — which is exactly what happened
// while this phase's red instrument was the only thing pinning the shape. The
// type is pinned here instead, mirroring `src/required-config.assert.ts`.
//
// Compile-time only: nothing here is exported, and the guard is never invoked.

import { buildDataSources, type ToolCallSummary } from './data-sources.ts';

declare const trace: Record<string, unknown>;

function pinsToolCallSummaryShape(): void {
  // The 0.3.1 shape is still a ToolCallSummary — both new fields are optional.
  const unrecorded: ToolCallSummary = { name: 'get_data', args: {} };

  // A recorded outcome is expressible, with or without a producer label.
  const rejected: ToolCallSummary = { name: 'get_data', args: {}, failed: true };
  const succeeded: ToolCallSummary = { name: 'get_data', args: {}, failed: false };
  const labelled: ToolCallSummary = {
    name: 'get_data',
    args: {},
    failed: true,
    failureKind: 'unavailable',
  };

  // @ts-expect-error #192 — `failed` is the producer's boolean assertion, never a string
  const wrongFailedType: ToolCallSummary = { name: 'get_data', args: {}, failed: 'yes' };

  // @ts-expect-error #192 — `failureKind` is an open producer label (string), never a flag
  const wrongKindType: ToolCallSummary = { name: 'get_data', args: {}, failureKind: true };

  // `fallbackPortal` stays positional third of five for callers that still
  // pass it, and since 0.4.0 accepts `undefined` from callers that do not.
  buildDataSources([unrecorded, rejected, succeeded, labelled], trace, 'portal.example', 'now');
  buildDataSources([unrecorded], trace, undefined, 'now');

  void wrongFailedType;
  void wrongKindType;
}

void pinsToolCallSummaryShape;
