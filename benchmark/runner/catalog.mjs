// A pinned excerpt of the website's model catalog (G0-8): the Haiku 5.5 entry
// and the two functions every app call site uses to set a request's token
// limit and reasoning setting. R5's runner imported the website's file; the
// hub does not depend on the website, so the excerpt is copied here, as
// JavaScript, with the source it was copied from.
//
// Source: npstorey/civic-ai-tools-website, src/lib/model-catalog.ts, identical
// at d745bd9 and 8559002 (the website's main when this was copied), sha256
// below. The Haiku 5.5 entry is at :215-229; `modelRequestSettings` at
// :323-329; `modelRequestParameters` at :352-362. Only types were removed.
// The Sonnet 5.5 and Opus 5.5 entries (:230-253) are not copied: under D14
// only Haiku 5.5 runs, and a model without an entry here takes its settings
// from a `slug@effort` argument, as R5's did.

export const CATALOG_SOURCE = Object.freeze({
  repository: 'npstorey/civic-ai-tools-website',
  path: 'src/lib/model-catalog.ts',
  commit: '85590020eae4ab72795afd7e8e6cd81589e8ac23',
  identicalAt: ['d745bd9', '8559002'],
  sha256: 'a2a1576be84df3b0767f9566db05873790ae1c6106bf23a4cb5c4af7be3b341f',
});

/** The catalog entries this excerpt carries (`BUILT_IN_CATALOG`, :214-229). */
export const CATALOG_EXCERPT = Object.freeze([
  Object.freeze({
    id: 'anthropic/claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    tag: 'recommended',
    provider: 'Anthropic',
    supports_tools: true,
    description: 'Accurate and fast, at the lowest cost',
    endpointModel: 'anthropic/claude-haiku-5.5',
    pricing: Object.freeze({ input: 0.1, output: 0.5 }),
    reasoningEffort: 'low',
    default: true,
    summarizer: true,
  }),
]);

/** The entry's request settings, or undefined when it declares none. */
export function modelRequestSettings(entry) {
  if (entry.reasoningEffort === undefined && entry.tokenLimitParameter === undefined) return undefined;
  return {
    ...(entry.reasoningEffort !== undefined ? { reasoningEffort: entry.reasoningEffort } : {}),
    ...(entry.tokenLimitParameter !== undefined ? { tokenLimitParameter: entry.tokenLimitParameter } : {}),
  };
}

/** The token limit and the reasoning setting of one request, as request-body
 *  fields: an explicit `tokenLimitParameter` wins; otherwise any
 *  `reasoningEffort` means `max_completion_tokens`; otherwise `max_tokens`. */
export function modelRequestParameters(settings, tokenLimit) {
  const reasoningEffort = settings?.reasoningEffort;
  const parameter = settings?.tokenLimitParameter ?? (reasoningEffort !== undefined ? 'max_completion_tokens' : 'max_tokens');
  const limit = parameter === 'max_completion_tokens' ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit };
  return reasoningEffort !== undefined ? { ...limit, reasoning_effort: reasoningEffort } : limit;
}
