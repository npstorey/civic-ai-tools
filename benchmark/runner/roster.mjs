// The roster check, as the website's eval script makes it before it spends
// (`checkRoster`, scripts/eval-models.mjs:550-590 at 8559002): every slug on
// OpenRouter's model list, tools supported, every request field the model
// will be sent listed as supported, and the reasoning effort among the
// model's efforts. Empty means the run may start.

import { CATALOG_EXCERPT, modelRequestParameters } from './catalog.mjs';

/** Every problem with `models` against the list's rows (`list.data`). */
export function checkRoster(models, list, maxTokens) {
  const problems = [];
  const byId = new Map((list?.data ?? []).map((m) => [m.id, m]));
  for (const model of models) {
    if (model.catalogId && !CATALOG_EXCERPT.some((e) => e.id === model.catalogId)) {
      problems.push(`${model.slug}: the catalog excerpt no longer has an entry "${model.catalogId}"`);
    }
    const listed = byId.get(model.slug);
    if (!listed) {
      problems.push(`${model.slug}: not on OpenRouter's model list`);
      continue;
    }
    const supported = new Set(listed.supported_parameters ?? []);
    if (!supported.has('tools')) problems.push(`${model.slug}: the list does not give "tools" as supported`);
    for (const field of Object.keys(modelRequestParameters(model.settings ?? undefined, maxTokens))) {
      if (!supported.has(field)) problems.push(`${model.slug}: would be sent "${field}", which the list does not give as supported`);
    }
    const effort = model.settings?.reasoningEffort;
    if (effort !== undefined) {
      const efforts = listed.reasoning?.supported_efforts;
      if (!efforts) problems.push(`${model.slug}: reasoning "${effort}" is set and the list gives no reasoning efforts`);
      else if (!efforts.includes(effort) && effort !== 'none') {
        problems.push(`${model.slug}: reasoning "${effort}" is not among the list's efforts (${efforts.join(', ')})`);
      }
    }
  }
  return problems;
}
