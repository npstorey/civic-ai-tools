// The roster check, as the website's eval script makes it before it spends
// (`checkRoster`, scripts/eval-models.mjs:550-590 at 8559002): every slug on
// OpenRouter's model list, tools supported, every request field the model
// will be sent listed as supported, and the reasoning effort among the
// model's efforts. S1 adds the endpoints: where a model's endpoints list was
// read, some endpoint the request may land on is up (status 0) and lists
// `tools`; under provider routing (models.mjs: within its prices, and
// `require_parameters`, so OpenRouter routes only to an endpoint listing every
// field sent) some such endpoint lists every field sent as well. Empty means
// the run may start.

import { CATALOG_EXCERPT } from './catalog.mjs';
import { endpointEligible, listedFields } from './models.mjs';

/** Every problem with `models` against the list's rows (`list.data`) and,
 *  where given, `endpoints` (by slug). */
export function checkRoster(models, list, maxTokens, endpoints = null) {
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
    const fields = listedFields(model.params(maxTokens));
    const supported = new Set(listed.supported_parameters ?? []);
    if (!supported.has('tools')) problems.push(`${model.slug}: the list does not give "tools" as supported`);
    for (const field of fields) {
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
    if (endpoints) {
      const eps = endpoints[model.slug];
      if (!eps) {
        problems.push(`${model.slug}: its endpoints list was not read`);
        continue;
      }
      const needed = model.routing?.require_parameters ? ['tools', 'tool_choice', ...fields] : ['tools'];
      const usable = eps.filter((e) => e.status === 0 && endpointEligible(e, model.routing) && needed.every((f) => e.supported_parameters.includes(f)));
      if (!usable.length) problems.push(`${model.slug}: no endpoint is up${model.routing ? ", within the routing's prices," : ''} and lists ${needed.join(', ')}`);
    }
  }
  return problems;
}
