// The civic kinds: the code half of the civic inventory's entries, by
// `serverType`, and the identity of the inventory `CIVIC_MANIFEST` mirrors.
//
// The hub's `inventory/civic-inventory.json` (`civic-inventory/3` since
// version 3, router 0.9.0) is the source of truth for the seven sources' data
// (G0-5 A on hub #309): six servers and, since version 2 (router 0.8.0), City
// Record as a pack over the Socrata server.
// `CIVIC_MANIFEST` stays code and is held equal to the file by
// `src/inventory.test.ts`; `CIVIC_INVENTORY` names the file it equals. This
// module reads no file: a consumer reads the inventory and passes the parsed
// document to `manifestFromInventory(inventory, CIVIC_KINDS)`.
//
// What a kind supplies, and nothing else: the tool schemas (the code mirror
// of each server's `tools/list`, held to the entry's `toolsRef` by the
// loader), `toolsFor` where this package owns the schemas' text, the
// guidance entry, the preamble entry where the source has its own, and the
// portal lock. The prompt's strings (`citation`, `lockMention`) are the
// file's. Three kinds:
//
//   - `socrata`: the Socrata server, and packs over it (City Record);
//   - `mcp-remote`: Google Data Commons and Boston OpenContext;
//   - `npm-package`: the three sources an instance runs from a pinned
//     package, with no guidance (none of the three servers sends any).
//
// Each kind holds code for the sources it knows, by `sourceId`, and refuses
// any other: a new server is code until its tools and guidance are data.

import { BARE_VIEW } from '../core/alias.ts';
import { InventoryLoadError, type EntryCode, type EntryKind, type EntryKinds, type InventoryPackEntry, type InventoryServerEntry, type PackCode } from '../core/inventory.ts';
import { sha256Hex } from '../core/sha256.ts';
import type { FunctionToolSchema, GuidanceEntry, JsonSchema, SourceView } from '../core/types.ts';
import { BOSTON_OPENCONTEXT_ENTRY } from './boston.ts';
import type { CivicGuidanceContext, CivicManifestEntry, CivicPromptParts } from './context.ts';
import { DATA_COMMONS_ENTRY } from './data-commons.ts';
import { NYC_CHARTER_ENTRY } from './nyc-charter.ts';
import { NYC_CHECKBOOK_ENTRY } from './nyc-checkbook.ts';
import { NYS_LEGISLATION_ENTRY } from './nys-legislation.ts';
import { lockedFetch, lockedGetData, lockedSearch } from './portal-lock.ts';
import { SOCRATA_ENTRY, SOCRATA_TOOL_NAMES, socrataTools } from './socrata.ts';

/** The inventory `CIVIC_MANIFEST` mirrors: the hub's
 *  `inventory/civic-inventory.json`, its version, and its hash (the router's
 *  `canonicalJson` SHA-256 of the parsed file, as its `.sha256` file states
 *  it). Released raw at the hub tag `civic-inventory/<version>`. */
export const CIVIC_INVENTORY = Object.freeze({
  id: 'civic',
  version: '2026-11-12.1',
  hash: '0654b2c29331bd3e2f2a9cea7752f2a313b139d0fb154f1c1ae78eda3a349912',
});

/** What the civic inventory's entries carry for the prompt frame: strings
 *  only. The preamble entry, a function of the view, is the kind's. */
type PromptStrings = Pick<CivicPromptParts, 'citation' | 'lockMention'>;

function promptStringsOf(entry: InventoryServerEntry | InventoryPackEntry): PromptStrings {
  const prompt = entry.prompt;
  if (prompt === undefined) return {};
  if (prompt === null || typeof prompt !== 'object' || Array.isArray(prompt)) {
    throw new InventoryLoadError(entry.alias, 'prompt', 'is not an object');
  }
  const out: { citation?: string; lockMention?: string } = {};
  for (const [key, value] of Object.entries(prompt)) {
    if ((key !== 'citation' && key !== 'lockMention') || typeof value !== 'string') {
      throw new InventoryLoadError(entry.alias, `prompt.${key}`, 'the prompt carries only the strings citation and lockMention');
    }
    out[key] = value;
  }
  return out;
}

/** An entry's prompt parts: the kind's preamble entry, if any, and the
 *  file's strings. Absent when neither has a part. */
function promptOf(preambleEntry: CivicPromptParts['preambleEntry'], strings: PromptStrings): { prompt?: CivicPromptParts } {
  const parts: CivicPromptParts = { ...(preambleEntry ? { preambleEntry } : {}), ...strings };
  return Object.keys(parts).length === 0 ? {} : { prompt: parts };
}

/** The code of one source this package knows: its module's entry, read for
 *  its code parts only (never its data fields). */
function codeFrom(source: CivicManifestEntry, entry: InventoryServerEntry, guidanceKind: string): EntryCode<CivicManifestEntry> {
  checkGuidanceRef(entry, guidanceKind);
  return {
    tools: source.tools,
    ...(source.toolsFor ? { toolsFor: source.toolsFor } : {}),
    guidance: source.guidance,
    ...promptOf(source.prompt?.preambleEntry, promptStringsOf(entry)),
    ...(source.portalLock ? { portalLock: source.portalLock } : {}),
  };
}

function knownSource(table: Readonly<Record<string, CivicManifestEntry>>, serverType: string, entry: InventoryServerEntry): CivicManifestEntry {
  const source = Object.hasOwn(table, entry.sourceId) ? table[entry.sourceId] : undefined;
  if (!source) {
    throw new InventoryLoadError(entry.alias, 'sourceId', `the ${serverType} kind has no code for "${entry.sourceId}" (it knows ${Object.keys(table).join(', ')})`);
  }
  return source;
}

/** Hold an entry's `guidanceRef.kind` to the origin of the kind's guidance:
 *  `prompt` (the server serves it, by name), `embedded` (this package's
 *  text) or `none`. */
function checkGuidanceRef(entry: InventoryServerEntry, expected: string): void {
  const ref = entry.guidanceRef as { kind?: unknown } | undefined;
  if (ref?.kind !== expected) {
    throw new InventoryLoadError(entry.alias, 'guidanceRef.kind', `is ${JSON.stringify(ref?.kind)}; this source's guidance is ${expected}`);
  }
}

/** The guidance of a source whose server sends none. */
const NO_GUIDANCE: GuidanceEntry<CivicGuidanceContext> = Object.freeze({
  async fetchText() {
    return '';
  },
});

// --- Packs over the Socrata server ------------------------------------------------------

type Properties = { properties: Record<string, unknown> } & Record<string, unknown>;

const withProperty = (tool: FunctionToolSchema, name: string, value: unknown): FunctionToolSchema => {
  const parameters = tool.function.parameters as Properties;
  return {
    ...tool,
    function: { ...tool.function, parameters: { ...parameters, properties: { ...parameters.properties, [name]: value } } as JsonSchema },
  };
};

const escapePattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `get_data` for a pack: the portal lock's rewrite for the pack's portal,
 *  and, with a dataset in the filter, `dataset_id` fixed to it. */
function packGetData(base: FunctionToolSchema, portal: string, datasetId: string | undefined): FunctionToolSchema {
  const locked = lockedGetData(base, portal);
  if (datasetId === undefined) return locked;
  const pinned = withProperty(locked, 'dataset_id', {
    type: 'string',
    enum: [datasetId],
    description: `The one dataset this source reads, ${datasetId}. Any other value is refused.`,
  });
  return {
    ...pinned,
    function: {
      ...pinned.function,
      description: `${locked.function.description}\n\nThis source reads one dataset only, ${datasetId} on ${portal}: pass it as "dataset_id". A call naming any other dataset is refused and returns no data.`,
    },
  };
}

/** `fetch` for a pack with no search tool: every tool named through `n`,
 *  and the identifier held to the pack's portal (and dataset). */
function packFetch(base: FunctionToolSchema, portal: string, datasetId: string | undefined, n: (name: string) => string): FunctionToolSchema {
  const scope = datasetId === undefined ? `one Socrata portal only, ${portal}` : `one dataset only, ${datasetId} on ${portal}`;
  const refused = datasetId === undefined ? 'any other portal' : 'any other portal or dataset';
  const example = datasetId === undefined ? `dataset:${portal}:<dataset-id>` : `dataset:${portal}:${datasetId}`;
  const id: Record<string, unknown> = {
    type: 'string',
    description: `The identifier of a dataset or a record on ${portal}, e.g. "${example}"`,
    ...(datasetId === undefined
      ? {}
      : { pattern: `^(?:dataset:${escapePattern(portal)}:${escapePattern(datasetId)}|record:${escapePattern(portal)}:${escapePattern(datasetId)}:.+)$` }),
  };
  const withId = withProperty(base, 'id', id);
  return {
    ...withId,
    function: {
      ...withId.function,
      description: `Retrieve a dataset's full metadata, or a single record, by its identifier: dataset:${portal}:<dataset_id> for a dataset, record:${portal}:<dataset_id>:<row_id> for one row.

WHICH TOOL TO USE: this returns metadata and columns, not query results. To read or aggregate rows, use ${n('get_data')} with type=query.

This source reads ${scope}: an identifier or URL naming ${refused} is refused and returns no data.`,
    },
  };
}

/** What a Socrata pack's filter may fix. */
const SOCRATA_FILTER_ARGUMENTS = ['portal', 'dataset_id'];

/** Hold a Socrata pack's `api` to its filter (since 0.9.0): the platform
 *  `socrata`, `host` its `filter.portal`, and `dataset` its
 *  `filter.dataset_id`, or both absent. */
function checkSocrataPackApi(entry: InventoryPackEntry, portal: string, datasetId: string | undefined): void {
  const stated = (value: unknown): string => (value === undefined ? 'absent' : `${JSON.stringify(value)}`);
  const api = entry.api as { platform?: unknown; host?: unknown; dataset?: unknown; [member: string]: unknown } | undefined;
  if (api === null || typeof api !== 'object' || Array.isArray(api)) throw new InventoryLoadError(entry.alias, 'api', 'is missing; a pack states the API it reads');
  const extra = Object.keys(api).filter((member) => !['platform', 'host', 'dataset'].includes(member));
  if (extra.length > 0) throw new InventoryLoadError(entry.alias, `api.${extra[0]}`, 'an api states platform, host and dataset only');
  if (api.platform !== 'socrata') throw new InventoryLoadError(entry.alias, 'api.platform', `is ${stated(api.platform)}; a Socrata pack's platform is "socrata"`);
  if (api.host !== portal) throw new InventoryLoadError(entry.alias, 'api.host', `is ${stated(api.host)}; a Socrata pack's host is its filter.portal, "${portal}"`);
  if (api.dataset !== datasetId) {
    throw new InventoryLoadError(
      entry.alias,
      'api.dataset',
      datasetId === undefined ? `is ${stated(api.dataset)}; the filter fixes no dataset_id` : `is ${stated(api.dataset)}; a Socrata pack's dataset is its filter.dataset_id, "${datasetId}"`,
    );
  }
}

/** The kinds' options: what the instance knows of its servers. */
export interface CivicKindsOptions {
  /** The portal the instance's Socrata server is configured for (its
   *  `search` covers that portal alone), when the instance knows it. A
   *  portal-only pack over that portal exposes `search`; with this absent,
   *  no pack does. */
  readonly socrataPortal?: string;
}

/** The Socrata kind's pack builder, for an instance that knows `options` of
 *  its servers: a pack's tool names and code over its base's manifest entry.
 *  The loader calls it through `civicKinds(options)`; `./nyc-record.ts`
 *  builds City Record's mirror with it. */
export function socrataPack(options: CivicKindsOptions) {
  return (entry: InventoryPackEntry, base: CivicManifestEntry): PackCode<CivicManifestEntry> => {
    const filter = entry.filter;
    if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) throw new InventoryLoadError(entry.alias, 'filter', 'is not an object');
    for (const [key, value] of Object.entries(filter)) {
      if (!SOCRATA_FILTER_ARGUMENTS.includes(key)) {
        throw new InventoryLoadError(entry.alias, `filter.${key}`, `a Socrata pack fixes only ${SOCRATA_FILTER_ARGUMENTS.join(' and ')}`);
      }
      if (typeof value !== 'string' || value === '') throw new InventoryLoadError(entry.alias, `filter.${key}`, 'is not a non-empty string');
    }
    const portal = filter.portal;
    if (portal === undefined) throw new InventoryLoadError(entry.alias, 'filter.portal', 'a Socrata pack fixes its portal');
    const datasetId = filter.dataset_id;
    checkSocrataPackApi(entry, portal, datasetId);
    // `search` takes one argument, `query`, and covers the server's
    // configured portal alone: it can fix neither a portal nor a dataset.
    const withSearch = datasetId === undefined && options.socrataPortal !== undefined && options.socrataPortal === portal;
    const toolNames = SOCRATA_TOOL_NAMES.filter((name) => name !== 'search' || withSearch);

    const toolsFor = (view: SourceView): FunctionToolSchema[] => {
      // The base's schemas, every tool named as the pack's in `view`.
      const packView: SourceView = {
        toolName: (sourceId, name) => view.toolName(sourceId === base.sourceId ? entry.sourceId : sourceId, name),
        sourceText: (sourceId, text) => view.sourceText(sourceId === base.sourceId ? entry.sourceId : sourceId, text),
      };
      const n = (name: string): string => packView.toolName(base.sourceId, name);
      const own = socrataTools(packView);
      const find = (name: string): FunctionToolSchema => own.find((tool) => tool.function.name === n(name))!;
      return own
        .filter((tool) => toolNames.some((name) => n(name) === tool.function.name))
        .map((tool) => {
          if (tool === find('get_data')) return packGetData(tool, portal, datasetId);
          if (tool === find('search')) return lockedSearch(tool, portal, packView);
          return withSearch ? lockedFetch(tool, portal, packView) : packFetch(tool, portal, datasetId, n);
        });
    };

    const guidance = packGuidance(entry);
    return {
      toolNames,
      code: {
        tools: toolsFor(BARE_VIEW),
        toolsFor,
        guidance,
        ...promptOf(undefined, promptStringsOf(entry)),
      },
    };
  };
}

/** A pack's guidance: its own text (`guidance.kind: inline`, held to
 *  `guidance.blockSha256`), as text the router does not own; or none. */
function packGuidance(entry: InventoryPackEntry): GuidanceEntry<CivicGuidanceContext> {
  const ref = entry.guidance as { kind?: unknown; text?: unknown; blockSha256?: unknown } | undefined;
  if (ref === undefined || ref.kind === 'none') return NO_GUIDANCE;
  if (ref.kind !== 'inline' || typeof ref.text !== 'string') throw new InventoryLoadError(entry.alias, 'guidance', 'a pack carries its guidance inline, or none');
  const hash = sha256Hex(ref.text);
  if (ref.blockSha256 !== hash) throw new InventoryLoadError(entry.alias, 'guidance.blockSha256', `the text hashes to ${hash}`);
  const text = ref.text;
  return {
    async fetchText(_context, view = BARE_VIEW) {
      return view.sourceText(entry.sourceId, text);
    },
  };
}

// --- The kinds --------------------------------------------------------------------------

const SOCRATA_SOURCES: Readonly<Record<string, CivicManifestEntry>> = Object.freeze({ socrata: SOCRATA_ENTRY });
const REMOTE_SOURCES: Readonly<Record<string, CivicManifestEntry>> = Object.freeze({
  'data-commons': DATA_COMMONS_ENTRY,
  'boston-opencontext': BOSTON_OPENCONTEXT_ENTRY,
});
const PACKAGE_SOURCES: Readonly<Record<string, CivicManifestEntry>> = Object.freeze({
  'nyc-charter': NYC_CHARTER_ENTRY,
  'nyc-checkbook': NYC_CHECKBOOK_ENTRY,
  'nys-legislation': NYS_LEGISLATION_ENTRY,
});

/** The pinned package the mirror of a hosted source was captured from. */
function mirroredPackage(source: CivicManifestEntry): string {
  const variant = source.hostings.find((v) => v.kind === 'npm-package');
  return variant && variant.kind === 'npm-package' ? `${variant.package}@${variant.version}` : '';
}

const npmPackageKind: EntryKind<CivicManifestEntry> = {
  server(entry) {
    const source = knownSource(PACKAGE_SOURCES, 'npm-package', entry);
    // The mirror is one package version's `tools/list`: an entry that pins
    // another version needs its own capture first.
    const variant = (entry.hostings ?? []).find((v) => v.kind === 'npm-package');
    const stated = variant && variant.kind === 'npm-package' ? `${variant.package}@${variant.version}` : '';
    if (stated !== mirroredPackage(source)) {
      throw new InventoryLoadError(entry.alias, 'hostings', `the mirror is ${mirroredPackage(source)}'s tools/list; the entry pins ${stated || 'no package'}`);
    }
    checkGuidanceRef(entry, 'none');
    return { tools: source.tools, guidance: NO_GUIDANCE, ...promptOf(undefined, promptStringsOf(entry)) };
  },
};

const remoteKind: EntryKind<CivicManifestEntry> = {
  server(entry) {
    return codeFrom(knownSource(REMOTE_SOURCES, 'mcp-remote', entry), entry, 'embedded');
  },
};

/** The civic kinds, for an instance that knows `options` of its servers. */
export function civicKinds(options: CivicKindsOptions = {}): EntryKinds<CivicManifestEntry> {
  const socrataKind: EntryKind<CivicManifestEntry> = {
    server(entry) {
      return codeFrom(knownSource(SOCRATA_SOURCES, 'socrata', entry), entry, 'prompt');
    },
    pack: socrataPack(options),
  };
  return Object.freeze({ socrata: socrataKind, 'mcp-remote': remoteKind, 'npm-package': npmPackageKind });
}

/** The civic kinds with nothing known of the instance's servers: no pack
 *  exposes `search`. */
export const CIVIC_KINDS: EntryKinds<CivicManifestEntry> = civicKinds();
