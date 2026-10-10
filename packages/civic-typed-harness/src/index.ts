// civic-typed-harness — the civic DOMAIN layer of ADR-0021's format/domain
// line, relocated from the reference app (civic-ai-tools-website) per the S2
// brief. The operating rule: THE HARNESS DERIVES, THE CORE ASSEMBLES — every
// export here produces domain-derived values (vocabulary terms, datHere
// policy fields, provenance graphs, capture artifacts) that feed
// @typedstandards/produce-core's neutral envelope assembly.
//
// Internal module boundary (structure-for-the-future; see README):
//   - format/  — the civic FORMAT-EXTENSION: what extends the standard
//     (civic: vocabulary, source registry, datHere policy, profile constants).
//   - capture/ — what PRODUCES under it: TraceBuilder, skill-metadata
//     extraction, data-source population, and the provenance BUILDER. It
//     imports nothing from outside capture/: the vocabulary, the source
//     registry and their defaults arrive as parameters. Clock + RNG live
//     here only.
//   - civic/   — the civic defaults applied over capture: the package's
//     `buildProvenanceGraph`, `buildDataSources` and `resolveToolSource`
//     (with their config types and `CIVICAITOOLS_PROVENANCE_CONFIG`), which
//     pass format/'s values to the capture builders (civic-ai-tools#244 P2).
//   - rubric/  — the adversarial-evaluation pure core (Q26-pinned hash).
//
// Purity contract (harness-grade): no I/O and no environment reads anywhere;
// clock + RNG permitted in capture modules only and injectable for tests.
// Enforced by eslint.config.mjs and src/purity.test.ts.

// Format-extension group
export * from './format/vocabulary.ts';
export * from './format/sources.ts';
export * from './format/dathere.ts';
export * from './format/profiles.ts';

// Capture group
export * from './capture/trace.ts';
export * from './capture/skill-metadata.ts';
// data-sources.ts and provenance.ts are exported through the civic layer,
// which re-exports their public types and applies the civic defaults; the
// capture builders it calls are not part of the package's entry.

// Civic layer
export * from './civic/data-sources.ts';
export * from './civic/provenance.ts';

// Rubric group
export * from './rubric/adversarial-eval-core.ts';
