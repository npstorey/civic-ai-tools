// One configuration's requests, built through the router.
//
// The runner never composes a prompt or a tool of its own: the directory, the
// first-step tool, the in-loop prompt after a load, the loaded sources' tools
// and the all-sources baselines all come from `createCivicRouter` over the
// inventory's manifest (`to-manifest.mjs`), called the way the website's
// in-loop routing calls it today (`createInLoopRouting`, routing-mode.ts:275).
// The benchmark's own texts (`find_source`, the builder) are in `texts.mjs`.
//
// CONFIGURATIONS (design §2.4; N is the inventory's size):
//   baseline-7          today's in-loop directory over the seven, configured
//                       as production configures them: Boston OpenContext
//                       unconfigured (design §2.3), the other six on;
//   flat-N              the plain flat directory: every entry configured and
//                       listed;
//   shortlist-N         the directory over the place filter's shortlist
//                       (`shortlist.mjs`), cap 25, no search;
//   shortlist+search-N  the same, with `find_source` beside `load_source`
//                       (`search.mjs`, `texts.mjs`); after a search the next
//                       request's directory and enum are rebuilt over the
//                       shortlist and the hits (design §1.5, steps 1 and 2,
//                       simulated);
//   builder-N           the directory over the builder's selection (Haiku 5.5
//                       at low, once per question), no search;
//   rule-N              BM25 over the inventory with the question as the
//                       query; no model, no request.
// In every configuration but baseline-7 every entry is configured; the
// directory set is the row's selection over them.

import { BOSTON_OPENCONTEXT_ENTRY, canonicalJson, createCivicRouter, readMcpEnv, sha256Hex } from '@typedstandards/civic-typed-router';
import { toManifest } from '../inventories/to-manifest.mjs';
import { offlineFetchers, PUBLICATION_HOST } from '../inventories/guidance.mjs';
import { REGISTRY_LOAD_TEXT } from '../inventories/load-text.mjs';
import { LOAD_RESULT_TEXT } from './app-texts.mjs';
import { SEARCH_METHOD } from './search.mjs';
import { SHORTLIST_CAP, SHORTLIST_RULE } from './shortlist.mjs';

const N_SIZES = new Set([50, 200, 1000]);

/** A configuration by name, for an inventory: its kind, its routing rule and
 *  the requests a row of it may send (A3.2). */
export function resolveConfig(name, inventory) {
  const size = inventory.entries.length;
  const sized = (kind, n) => {
    if (Number(n) !== size) throw new Error(`${name} runs over the ${n}-entry inventory; this one has ${size}`);
    if (kind !== 'flat' && !N_SIZES.has(size)) throw new Error(`${name}: N is one of 50, 200 and 1,000`);
  };
  if (name === 'baseline-7') {
    if (size !== 7) throw new Error(`baseline-7 runs over the 7-entry inventory; this one has ${size}`);
    return { name, kind: 'baseline', rule: 'in-loop directory, production configuration', routingRule: { id: 'production-configuration', version: '1' }, cap: 'none', search: 'none', unconfigured: [BOSTON_OPENCONTEXT_ENTRY.sourceId], requestsPerRow: 2 };
  }
  let m = /^flat-(\d+)$/.exec(name ?? '');
  if (m) {
    sized('flat', m[1]);
    return { name, kind: 'flat', rule: 'flat directory, every entry configured', routingRule: { id: 'flat', version: '1' }, cap: 'none', search: 'none', unconfigured: [], requestsPerRow: 2 };
  }
  m = /^(shortlist|shortlist\+search|builder|rule)-(\d+)$/.exec(name ?? '');
  if (m) {
    sized(m[1], m[2]);
    const cap = String(SHORTLIST_CAP);
    if (m[1] === 'shortlist') return { name, kind: 'shortlist', rule: `place filter (${SHORTLIST_RULE.id} ${SHORTLIST_RULE.version}), cap ${cap}, no search`, routingRule: { ...SHORTLIST_RULE }, cap, search: 'none', unconfigured: [], requestsPerRow: 2 };
    if (m[1] === 'shortlist+search') return { name, kind: 'search', rule: `place filter (${SHORTLIST_RULE.id} ${SHORTLIST_RULE.version}), cap ${cap}, find_source (${SEARCH_METHOD.method} ${SEARCH_METHOD.version})`, routingRule: { ...SHORTLIST_RULE }, cap, search: { ...SEARCH_METHOD }, unconfigured: [], requestsPerRow: 4 };
    if (m[1] === 'builder') return { name, kind: 'builder', rule: `builder selection (Haiku 5.5 at low, once per question), cap ${cap}, no search`, routingRule: { id: 'builder', version: '1' }, cap, search: 'none', unconfigured: [], requestsPerRow: 2, builderRequestsPerQuestion: 1 };
    return { name, kind: 'rule', rule: `${SEARCH_METHOD.method} ${SEARCH_METHOD.version} over the inventory, the question as the query, no model`, routingRule: { id: 'none', version: 'none' }, cap: 'none', search: { ...SEARCH_METHOD }, unconfigured: [], requestsPerRow: 0 };
  }
  throw new Error(`unknown configuration ${name}: baseline-7, flat-N, shortlist-N, shortlist+search-N, builder-N or rule-N`);
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

/** The router package's own component, as every composition states it last
 *  (the website's `routerComponent`, socrata-skill.ts). */
export function routerComponent(routerPackage) {
  return { id: routerPackage.name, version: routerPackage.version };
}

/** A session: everything one configuration's rows need over one inventory,
 *  composed once; a directory is built per selection and cached. */
export async function createSession({ inventory, configName, today, routerPackage, inventoryHash }) {
  const config = resolveConfig(configName, inventory);
  const manifest = toManifest(inventory);
  const router = createCivicRouter(manifest);
  const configured = readMcpEnv(configurationSource(manifest, config.unconfigured));
  const offeredIds = router.offeredSkillSources(configured);
  const items = new Map(inventory.entries.map((e) => [e.alias, e]));
  const byAlias = new Map(manifest.map((e) => [e.alias, e]));
  const aliasOf = new Map(manifest.map((e) => [e.sourceId, e.alias]));
  const order = new Map(manifest.map((e, i) => [e.sourceId, i]));
  const lockedPortal = undefined;
  const compositionInput = { portal: undefined, configured, today, publicationHost: PUBLICATION_HOST, ...offlineFetchers };
  const ROUTER = routerComponent(routerPackage ?? { name: '@typedstandards/civic-typed-router', version: 'workspace' });

  /** The entry's guidance block as the composition fetches it, offline. */
  const blocks = new Map();
  async function blockOf(entry) {
    if (!blocks.has(entry.sourceId)) {
      let text = '';
      try {
        text = await entry.guidance.fetchText({ portal: undefined, publicationHost: PUBLICATION_HOST, ...offlineFetchers }, router.aliasedView);
      } catch {
        text = '';
      }
      blocks.set(entry.sourceId, text ?? '');
    }
    return blocks.get(entry.sourceId);
  }

  const directories = new Map();
  /** The directory over `ids` (source ids, any order; kept in manifest
   *  order): its prompt, its `load_source`, and the request state after a
   *  set of loads. */
  function directoryFor(ids) {
    const selection = offeredIds.filter((id) => ids.includes(id));
    const key = selection.join(',');
    if (directories.has(key)) return directories.get(key);
    // No portal and no lock: an unlocked instance's withLock is the identity,
    // and it is called here as the website calls it (routing-mode.ts:281).
    const withLock = (prompt) => router.aliasedWithPortalLockGuidance(prompt, lockedPortal, configured, selection);
    const loadTool = router.aliasedLoadSourceTool({ configured, selection });
    const system = withLock(router.directoryPrompt({ configured, today, selection }));
    const cache = new Map();
    const dir = {
      ids: selection,
      aliases: selection.map((id) => aliasOf.get(id)),
      has: (alias) => byAlias.has(alias) && selection.includes(byAlias.get(alias).sourceId),
      system,
      loadTool,
      /** The system prompt, the tools and the composition's components after
       *  `loadedIds` (any order) are loaded: the in-loop prompt over the
       *  loaded set, then the lock; `load_source` and the loaded sources'
       *  tools, in manifest order (routing-mode.ts:320-327). */
      async afterLoads(loadedIds) {
        const loaded = selection.filter((id) => loadedIds.includes(id));
        const k = loaded.join(',');
        if (!cache.has(k)) {
          const prompt = withLock(await router.aliasedInLoopSystemPrompt({ ...compositionInput, selection, loaded }));
          const components = [];
          for (const id of loaded) {
            const entry = manifest[order.get(id)];
            const block = await blockOf(entry);
            const contributed = block.trim().length > 0 && prompt.includes(block);
            components.push({ id: entry.id, ...(contributed ? { guidanceHash: sha256Hex(block) } : {}) });
          }
          components.push(ROUTER);
          cache.set(k, {
            systemPrompt: prompt,
            tools: [loadTool, ...router.aliasedOfferedMcpTools(router.aliasedMcpToolsFor(lockedPortal), configured, loaded)],
            components,
            definitionHash: router.harnessDefinition({ configured, selection: loaded, chosenBy: 'model', components }).hash,
          });
        }
        return cache.get(k);
      },
    };
    directories.set(key, dir);
    return dir;
  }

  const full = directoryFor(offeredIds);

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

  /** G0-9: the routing configuration (design §1.4) and its hash, the SHA-256
   *  of the router's `canonicalJson` of it; and the router's harness
   *  definition of the first request's composition. On the first request
   *  nothing is loaded, so that composition is the router's component alone,
   *  the same in every configuration; the routing configuration is what
   *  tells them apart. */
  let hashed = null;
  function hashes() {
    if (hashed) return hashed;
    const routing = {
      rule: config.routingRule,
      cap: config.cap,
      search: config.search,
      inventory: { id: inventory.id, version: inventory.version, hash: inventoryHash ?? sha256Hex(canonicalJson(inventory)) },
    };
    const first = router.harnessDefinition({ configured, selection: [], chosenBy: 'model', components: [ROUTER] });
    hashed = { routingConfiguration: routing, routingConfigurationHash: sha256Hex(canonicalJson(routing)), firstRequestDefinition: first, firstRequestDefinitionHash: first.hash };
    return hashed;
  }

  /** What kind of entry an alias is, for the scorer's pick counts. */
  const kindOf = (alias) => {
    const item = items.get(alias);
    if (!item) return null;
    return {
      synthetic: item.synthetic === 'true',
      registry: item.kind === 'server' && item.tools === 'not-captured',
      ckanPack: item.kind === 'pack' && item.catalog?.platform === 'ckan',
    };
  };

  return {
    config,
    inventory,
    router,
    configured,
    offeredIds,
    directoryFor,
    full,
    // The default directory (baseline-7 and flat-N): every offered entry.
    directoryIds: full.ids,
    directoryAliases: full.aliases,
    firstSystem: full.system,
    loadTool: full.loadTool,
    afterLoads: (ids) => full.afterLoads(ids),
    entryByAlias: (alias) => (full.has(alias) ? byAlias.get(alias) : undefined),
    entry: (alias) => byAlias.get(alias),
    item: (alias) => items.get(alias),
    aliasOf: (id) => aliasOf.get(id),
    kindOf,
    isRegistry: (alias) => kindOf(alias)?.registry === true,
    loadResultText: { ...LOAD_RESULT_TEXT, registry: REGISTRY_LOAD_TEXT },
    baselines,
    hashes,
  };
}
