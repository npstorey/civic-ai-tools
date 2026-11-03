// One configuration's requests, built through the router.
//
// The runner never composes a prompt or a tool of its own: the directory, the
// first-step tool, the in-loop prompt after a load, the loaded sources' tools
// and the all-sources baselines all come from `createCivicRouter` over the
// inventory's manifest (`to-manifest.mjs`), called the way the website's
// in-loop routing calls it today (`createInLoopRouting`, routing-mode.ts:275).
//
// CONFIGURATIONS (this phase):
//   baseline-7  today's in-loop directory over the seven, configured as
//               production configures them: Boston OpenContext unconfigured
//               (design §2.3), the other six on;
//   flat-N      the plain flat directory: every entry of the N-entry inventory
//               configured and listed.
// P3 adds the others (shortlist, search, builder, rule).

import { BOSTON_OPENCONTEXT_ENTRY, createCivicRouter, readMcpEnv } from '@typedstandards/civic-typed-router';
import { toManifest } from '../inventories/to-manifest.mjs';
import { offlineFetchers, PUBLICATION_HOST } from '../inventories/guidance.mjs';
import { LOAD_RESULT_TEXT } from './app-texts.mjs';

/** A configuration by name, for an inventory. */
export function resolveConfig(name, inventory) {
  const size = inventory.entries.length;
  if (name === 'baseline-7') {
    if (size !== 7) throw new Error(`baseline-7 runs over the 7-entry inventory; this one has ${size}`);
    return { name, rule: 'in-loop directory, production configuration', unconfigured: [BOSTON_OPENCONTEXT_ENTRY.sourceId] };
  }
  const flat = /^flat-(\d+)$/.exec(name ?? '');
  if (flat) {
    if (Number(flat[1]) !== size) throw new Error(`${name} runs over the ${flat[1]}-entry inventory; this one has ${size}`);
    return { name, rule: 'flat directory, every entry configured', unconfigured: [] };
  }
  throw new Error(`unknown configuration ${name}: this runner knows baseline-7 and flat-N (P3 adds the others)`);
}

/** The configuration variables that offer every manifest entry but the
 *  unconfigured ones: a hosted source by its switch (the name of its
 *  npm-package variant), a remote one by an address no request reaches (the
 *  benchmark calls no source), a remote one with a default address by that
 *  default. */
function configurationSource(manifest, unconfigured) {
  const source = {};
  for (const entry of manifest) {
    if (unconfigured.includes(entry.sourceId)) continue;
    const hosted = (entry.hostings ?? []).find((h) => h.kind === 'npm-package');
    if (hosted) source[entry.configuration.addressVariable] = hosted.variant;
    else if (!entry.configuration.defaultAddress) source[entry.configuration.addressVariable] = `https://${entry.alias.replaceAll('_', '-')}.not-called.invalid/mcp`;
  }
  return source;
}

/** A session: everything one configuration's rows need, composed once. */
export async function createSession({ inventory, configName, today }) {
  const config = resolveConfig(configName, inventory);
  const manifest = toManifest(inventory);
  const router = createCivicRouter(manifest);
  const configured = readMcpEnv(configurationSource(manifest, config.unconfigured));
  const directoryIds = router.offeredSkillSources(configured);
  const byAlias = new Map(manifest.filter((e) => directoryIds.includes(e.sourceId)).map((e) => [e.alias, e]));
  const aliasOf = new Map(manifest.map((e) => [e.sourceId, e.alias]));
  // No portal and no lock: an unlocked instance's withLock is the identity,
  // and it is called here as the website calls it (routing-mode.ts:281).
  const lockedPortal = undefined;
  const withLock = (prompt) => router.aliasedWithPortalLockGuidance(prompt, lockedPortal, configured, directoryIds);
  const loadTool = router.aliasedLoadSourceTool({ configured, selection: directoryIds });
  const firstSystem = withLock(router.directoryPrompt({ configured, today, selection: directoryIds }));
  const compositionInput = { portal: undefined, configured, today, publicationHost: PUBLICATION_HOST, ...offlineFetchers };

  const cache = new Map();
  /** The system prompt and tools after `loadedIds` (any order) are loaded:
   *  the in-loop prompt over the loaded set, then the lock; `load_source` and
   *  the loaded sources' tools, in manifest order (routing-mode.ts:320-327). */
  async function afterLoads(loadedIds) {
    const loaded = directoryIds.filter((id) => loadedIds.includes(id));
    const key = loaded.join(',');
    if (!cache.has(key)) {
      const prompt = await router.aliasedInLoopSystemPrompt({ ...compositionInput, selection: directoryIds, loaded });
      cache.set(key, {
        systemPrompt: withLock(prompt),
        tools: [loadTool, ...router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockedPortal), configured, loaded)],
      });
    }
    return cache.get(key);
  }

  /** The token baselines: the website's all-sources composition (its default
   *  routing mode) over this configuration (T0) and over every entry of the
   *  inventory configured (T1). */
  async function baselines() {
    const everyEntry = readMcpEnv(configurationSource(manifest, []));
    const allSources = async (env) => ({
      system: router.aliasedWithPortalLockGuidance(await router.aliasedBuildSystemPrompt({ ...compositionInput, configured: env }), lockedPortal, env),
      tools: router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockedPortal), env),
    });
    return { T0_site_today: await allSources(configured), T1_everything: await allSources(everyEntry) };
  }

  return {
    config,
    router,
    configured,
    directoryIds,
    directoryAliases: directoryIds.map((id) => aliasOf.get(id)),
    entryByAlias: (alias) => byAlias.get(alias),
    aliasOf: (id) => aliasOf.get(id),
    loadTool,
    firstSystem,
    afterLoads,
    baselines,
    loadResultText: LOAD_RESULT_TEXT,
  };
}
