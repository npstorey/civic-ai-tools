// Civic trace identity (CIVIC layer) — the reference deployment's capture
// identity, moved here from capture/trace.ts in 0.7.0 (civic-ai-tools#246,
// ADR-0033 §F), as #244 P2 moved `CIVICAITOOLS_PROVENANCE_CONFIG`. The
// package entry re-exports it under the same name, so no consumer changes;
// capture/ now defines no deployment value, which purity.test.ts holds.

import type { TraceBuilderConfig } from '../capture/trace.ts';

/** The civicaitools.org reference deployment's capture identity. Passed
 *  explicitly by the reference app — never applied as a default. */
export const CIVICAITOOLS_TRACE_CONFIG: TraceBuilderConfig = {
  serviceName: 'civic-ai-tools-website',
  scopeName: 'civic-ai-tools-evidence',
  scopeVersion: '0.1.0',
  semconvVersion: '1.30.0',
};
