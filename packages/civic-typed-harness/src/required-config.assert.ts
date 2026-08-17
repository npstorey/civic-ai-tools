// Type-level acceptance gate for the 0.2.0 breaking change (civic-ai-tools#153,
// findings A3–A7): identity-bearing config is a REQUIRED parameter — a bare
// call that omits it must FAIL typecheck. Each `@ts-expect-error` below
// asserts exactly that: if a silently-applied default parameter is ever
// reintroduced, the bare call becomes legal, the directive turns unused, and
// `npm run typecheck` / `npm run build` fail.
//
// Compile-time only: the guard function is never exported and never invoked,
// and the `declare`d values have no runtime existence.

import {
  buildProvenanceGraph,
  buildDatHereEnvironment,
  deriveDatHereEnvelopeFields,
  TraceBuilder,
  isDatasetKeyedSource,
  displayNameForSource,
  formatDataSourcesSummary,
  type ProvenanceInput,
  type DatHerePolicyInput,
} from './index.ts';
import type { DataSourceEntry } from '@typedstandards/produce-core';

declare const trace: Record<string, unknown>;
declare const provenanceInput: ProvenanceInput;
declare const policyInput: DatHerePolicyInput;
declare const entries: DataSourceEntry[];

function rejectsBareCalls(): void {
  // @ts-expect-error A3 — buildProvenanceGraph: the ProvenanceConfig is required
  buildProvenanceGraph(trace, provenanceInput);

  // @ts-expect-error A4 — buildDatHereEnvironment: the DatHereEnvironmentConfig is required
  buildDatHereEnvironment('model/slug', undefined);

  // @ts-expect-error A4 — deriveDatHereEnvelopeFields: the DatHereEnvironmentConfig is required
  deriveDatHereEnvelopeFields(policyInput);

  // @ts-expect-error A6 — TraceBuilder: the TraceBuilderConfig is required
  new TraceBuilder();

  // @ts-expect-error A7 — isDatasetKeyedSource: the CivicSourceRegistry is required
  isDatasetKeyedSource('socrata');

  // @ts-expect-error A7 — displayNameForSource: the CivicSourceRegistry is required
  displayNameForSource('socrata');

  // @ts-expect-error A7 — formatDataSourcesSummary: the CivicSourceRegistry is required
  formatDataSourcesSummary(entries);
}

void rejectsBareCalls;
