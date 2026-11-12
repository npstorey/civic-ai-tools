// The inventory loader: a manifest built from a parsed inventory document, by
// entry kind (sources-at-scale design §3.2; G0-5 A on hub #309).
//
// An inventory is data: each entry's identity, routing lines, configuration,
// hosting variants and logging postures, and a reference to its tools by
// name and hash. What is code stays code, in a table of KINDS the domain layer
// supplies: a kind, keyed by an entry's `serverType`, gives a server entry its
// tool schemas (a mirror of the server's own `tools/list`), its guidance entry
// and any other part a function of the view; and, for a kind that takes
// packs, a pack's tools over a server of that kind. The loader joins the two,
// in the file's order, and checks what joins them: the tools' names and their
// hash against the entry's `toolsRef`.
//
// Two kinds of entry:
//
//   - `server`: the entry's data fields, then its kind's code.
//   - `pack`: a base server's tools with fixed arguments (design §4.1). Its
//     `base` names the base server entry by its full `id` (since schema 3).
//     Its own identity and routing lines; the base's configuration, hosting
//     variants and consent default; `base` set to the base's `sourceId`;
//     `pack`, its version, its hash (`packHash`), which the loader checks, and
//     its base pins (`basePins`); its tools and guidance from the base's kind
//     (`EntryKind.pack`).
//
// Every entry's `id` is unique in the file; the loader refuses a second.
//
// Pure: it reads no file, no environment, no clock and no network. The
// consumer reads the file and hands the parsed document in.

import type { BasePin } from './base-pins.ts';
import { canonicalJson } from './canonical-json.ts';
import { sha256Hex } from './sha256.ts';
import type { FunctionToolSchema, ManifestEntry } from './types.ts';

// --- The tools' hash -----------------------------------------------------------------

/**
 * The tools' hash: the lowercase hex SHA-256 of `JSON.stringify(tools)`, the
 * schemas in the bare view as the entry carries them. S1's definition
 * (`benchmark/inventories/build.mjs`, `toolsSha256`), written once here. Not
 * `canonicalJson`'s: tool schemas hold booleans and numbers, which it refuses,
 * so the text hashed is the serialization the router hands the model.
 */
export function toolsSha256(tools: readonly FunctionToolSchema[]): string {
  return sha256Hex(JSON.stringify(tools));
}

// --- The document, as the loader reads it ---------------------------------------------

/** A reference to an entry's tools: their names in routing order and their
 *  hash (`toolsSha256`). The schemas themselves are the kind's mirror. */
export interface InventoryToolsRef {
  readonly toolNames: readonly string[];
  readonly sha256: string;
  readonly [field: string]: unknown;
}

/** What every inventory entry carries that the loader reads. */
interface InventoryEntryCommon {
  readonly id: string;
  readonly alias: string;
  readonly sourceId: string;
  readonly displayName: string;
  readonly description: string;
  readonly freshness: string;
  readonly freshnessSource?: string;
  readonly publisher?: string;
  /** Any other member: the domain's (prompt strings, place, provenance). */
  readonly [field: string]: unknown;
}

/** A server entry: a source the instance configures or runs. */
export interface InventoryServerEntry extends InventoryEntryCommon {
  readonly kind: 'server';
  /** The key into the kinds table. */
  readonly serverType: string;
  readonly configuration: ManifestEntry['configuration'];
  readonly hostings: ManifestEntry['hostings'];
  readonly consentDefault: ManifestEntry['consentDefault'];
  readonly toolsRef: InventoryToolsRef;
}

/** A pack: a base server's tools with fixed arguments. */
export interface InventoryPackEntry extends InventoryEntryCommon {
  readonly kind: 'pack';
  /** The base server entry's full `id` (since schema 3; its `sourceId`
   *  before). */
  readonly base: string;
  /** What the base reported when each pin was captured: one pin normally,
   *  two while a release of the base is staged. Each pin names exactly the
   *  base tools the pack calls. Required; checked by the loader. */
  readonly basePins?: readonly BasePin[];
  /** The fixed arguments, by name. */
  readonly filter: { readonly [argument: string]: string };
  /** The pack's own version. */
  readonly version: string;
  /** `packHash` of the entry; required, and checked by the loader. */
  readonly hash?: string;
  /** When present, the pack's tools as built are held to it. */
  readonly toolsRef?: InventoryToolsRef;
}

export type InventoryEntry = InventoryServerEntry | InventoryPackEntry;

/** A parsed inventory document. */
export interface InventoryDocument {
  readonly schema: string;
  readonly id: string;
  readonly version: string;
  readonly entries: readonly InventoryEntry[];
  readonly [field: string]: unknown;
}

// --- Kinds --------------------------------------------------------------------------

/** The fields the loader builds from the document itself. */
export type InventoryDataField =
  | 'id'
  | 'alias'
  | 'sourceId'
  | 'displayName'
  | 'description'
  | 'freshness'
  | 'freshnessSource'
  | 'configuration'
  | 'toolNames'
  | 'hostings'
  | 'consentDefault'
  | 'publisher'
  | 'base'
  | 'pack';

/** The code half of an entry: everything but its data fields. For a civic
 *  entry: `tools`, `toolsFor`, `guidance`, `prompt` and `portalLock`. */
export type EntryCode<E extends ManifestEntry<never>> = Omit<E, InventoryDataField>;

/** A pack's code half, and its tool names in routing order. */
export interface PackCode<E extends ManifestEntry<never>> {
  readonly code: EntryCode<E>;
  readonly toolNames: readonly string[];
}

/** One kind: the code for a server entry of its `serverType`, and for a pack
 *  over one. Each throws for an entry it has no code for. */
export interface EntryKind<E extends ManifestEntry<never>> {
  server(entry: InventoryServerEntry): EntryCode<E>;
  /** Absent: the kind takes no pack. `base` is the base's manifest entry as
   *  the loader built it. */
  pack?(entry: InventoryPackEntry, base: E): PackCode<E>;
}

/** The kinds a loader knows, by `serverType`. */
export type EntryKinds<E extends ManifestEntry<never>> = { readonly [serverType: string]: EntryKind<E> | undefined };

// --- The loader ---------------------------------------------------------------------

/** Thrown by `manifestFromInventory`: the entry's alias (or its position)
 *  and the field it is about lead the message. */
export class InventoryLoadError extends Error {
  readonly alias: string;
  readonly field: string;

  constructor(alias: string, field: string, message: string) {
    super(`manifestFromInventory: ${alias}: ${field}: ${message}`);
    this.name = 'InventoryLoadError';
    this.alias = alias;
    this.field = field;
  }
}

const sameNames = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && [...a].sort().join('\n') === [...b].sort().join('\n');

/** Hold an entry's tools to a `toolsRef`: the same names, each once, and the
 *  same hash. */
function checkTools(alias: string, tools: readonly FunctionToolSchema[], toolNames: readonly string[], ref: InventoryToolsRef): void {
  const declared = tools.map((tool) => tool.function.name);
  if (!sameNames(declared, ref.toolNames)) {
    throw new InventoryLoadError(alias, 'toolsRef.toolNames', `names ${JSON.stringify(ref.toolNames)}; the kind's schemas declare ${JSON.stringify(declared)}`);
  }
  if (!sameNames(toolNames, declared)) {
    throw new InventoryLoadError(alias, 'toolNames', `the routing list ${JSON.stringify(toolNames)} is not the schemas' set ${JSON.stringify(declared)}`);
  }
  const hash = toolsSha256(tools);
  if (hash !== ref.sha256) {
    throw new InventoryLoadError(alias, 'toolsRef.sha256', `is ${ref.sha256}; the kind's schemas hash to ${hash}`);
  }
}

/** The data fields every entry states, absent ones left out. */
function identityOf(entry: InventoryEntry) {
  return {
    id: entry.id,
    alias: entry.alias,
    sourceId: entry.sourceId,
    displayName: entry.displayName,
    description: entry.description,
    freshness: entry.freshness,
    ...(entry.freshnessSource !== undefined ? { freshnessSource: entry.freshnessSource } : {}),
  };
}

const labelOf = (entry: { readonly alias?: unknown }, i: number): string =>
  typeof entry.alias === 'string' && entry.alias !== '' ? entry.alias : `entries[${i}]`;

/** The members a pack's hash does not cover: the hash itself, the
 *  provenance note and the built tools' reference. */
const UNHASHED_PACK_MEMBERS: readonly string[] = ['hash', 'provenance', 'toolsRef'];

/**
 * A pack's hash (G0-B6 on hub #309): the lowercase hex SHA-256 of the
 * router's `canonicalJson` of the pack's inventory entry with `hash`,
 * `provenance` and `toolsRef` removed. It moves when the pack's identity,
 * filter, routing lines, text or guidance moves, and not when its provenance
 * note is edited. Throws `CanonicalJsonError` for an entry holding a number,
 * a boolean or null.
 */
export function packHash(entry: InventoryPackEntry): string {
  const covered = Object.fromEntries(Object.entries(entry).filter(([member]) => !UNHASHED_PACK_MEMBERS.includes(member)));
  return sha256Hex(canonicalJson(covered));
}

/** Hold a pack's stated `hash` to `packHash`. */
function checkPackHash(alias: string, entry: InventoryPackEntry): void {
  if (typeof entry.hash !== 'string') throw new InventoryLoadError(alias, 'hash', 'is missing; every pack states its hash (packHash)');
  let hash: string;
  try {
    hash = packHash(entry);
  } catch (error) {
    throw new InventoryLoadError(alias, 'hash', `the entry has no canonical form (${(error as Error).message})`);
  }
  if (entry.hash !== hash) throw new InventoryLoadError(alias, 'hash', `is ${entry.hash}; the pack's hash (packHash) is ${hash}`);
}

/**
 * A pack's manifest entry, from its inventory entry, its base's manifest
 * entry and the code its base's kind built for it: its own identity and
 * routing lines; the base's `configuration`, `hostings` and
 * `consentDefault`; `base`, the base's `sourceId` (the dispatch map's key,
 * whatever the inventory names the base by); `pack`, its `version`, `hash`
 * and `basePins` as the entry states them; then the code. The loader's own
 * builder, and the one a mirror of a pack in code uses. Checks nothing.
 */
export function packManifestEntry<E extends ManifestEntry<never>>(pack: InventoryPackEntry, base: E, built: PackCode<E>): E {
  return {
    ...identityOf(pack),
    configuration: base.configuration,
    toolNames: [...built.toolNames],
    hostings: base.hostings,
    consentDefault: base.consentDefault,
    ...(pack.publisher !== undefined ? { publisher: pack.publisher } : {}),
    base: base.sourceId,
    pack: { version: pack.version, hash: pack.hash as string, basePins: pack.basePins as readonly BasePin[] },
    ...built.code,
  } as unknown as E;
}

const SHA256 = /^[0-9a-f]{64}$/;
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** Hold a pack's `basePins` to their form, and each pin's tools to the base
 *  tools the pack calls: every tool the pack calls on this instance
 *  (`toolNames`, the names sent on the wire) is pinned, and every pinned
 *  tool is one of the base's (`baseToolNames`). A portal-only pack's `search`
 *  is offered on some instances only, so a pin may name it where the pack
 *  does not call it. */
function checkBasePinsOf(alias: string, pack: InventoryPackEntry, toolNames: readonly string[], baseToolNames: readonly string[]): void {
  const pins = pack.basePins as unknown;
  if (!Array.isArray(pins) || pins.length === 0) throw new InventoryLoadError(alias, 'basePins', 'is missing or empty; every pack pins its base (one pin, or two while a base release is staged)');
  pins.forEach((pin: unknown, i: number) => {
    const at = `basePins[${i}]`;
    if (pin === null || typeof pin !== 'object' || Array.isArray(pin)) throw new InventoryLoadError(alias, at, 'is not an object');
    const { serverName, serverVersion, tools, ...rest } = pin as Record<string, unknown>;
    const extra = Object.keys(rest);
    if (extra.length > 0) throw new InventoryLoadError(alias, `${at}.${extra[0]}`, 'a pin states serverName, serverVersion and tools only');
    if (!isText(serverName)) throw new InventoryLoadError(alias, `${at}.serverName`, 'is not a non-empty string');
    if (!isText(serverVersion)) throw new InventoryLoadError(alias, `${at}.serverVersion`, 'is not a non-empty string');
    if (tools === null || typeof tools !== 'object' || Array.isArray(tools)) throw new InventoryLoadError(alias, `${at}.tools`, 'is not an object');
    for (const [name, hash] of Object.entries(tools)) {
      if (typeof hash !== 'string' || !SHA256.test(hash)) throw new InventoryLoadError(alias, `${at}.tools.${name}`, 'is not 64 lowercase hex characters (mcpToolSchemaSha256)');
    }
    const pinned = Object.keys(tools);
    const unpinned = toolNames.filter((name) => !pinned.includes(name));
    if (unpinned.length > 0) throw new InventoryLoadError(alias, `${at}.tools`, `pins ${JSON.stringify(pinned)}; the pack calls ${JSON.stringify(unpinned[0])}, which no member pins`);
    const foreign = pinned.filter((name) => !baseToolNames.includes(name));
    if (foreign.length > 0) throw new InventoryLoadError(alias, `${at}.tools.${foreign[0]}`, `is not a tool of the base (${JSON.stringify(baseToolNames)})`);
  });
}

/**
 * The manifest `inventory` describes, in its order, built with `kinds`.
 *
 * Throws `InventoryLoadError`, naming the entry's alias and the field, for an
 * entry of an unknown `kind`, a server whose `serverType` has no kind, tools
 * whose names or hash differ from its `toolsRef`, a pack with no `hash` or
 * whose `hash` is not its `packHash`, an `id` a second entry states, a pack
 * whose `base` names no server entry's `id`, names a pack, or names a server
 * whose kind takes no pack, and a pack with no `basePins`, a malformed pin,
 * a pin that leaves out a tool the pack calls, or one naming a tool the
 * base does not have. A manifest it
 * returns still goes through the router's own startup checks when a router
 * is built over it.
 */
export function manifestFromInventory<E extends ManifestEntry<never>>(inventory: InventoryDocument, kinds: EntryKinds<E>): E[] {
  if (!Array.isArray(inventory.entries)) throw new InventoryLoadError(String(inventory.id), 'entries', 'is not an array');
  const kindOf = (serverType: string): EntryKind<E> | undefined => (Object.hasOwn(kinds, serverType) ? kinds[serverType] : undefined);

  // An `id` is the entry's global identity: once in the file.
  const ids = new Map<string, number>();
  inventory.entries.forEach((item, i) => {
    const first = ids.get(item.id);
    if (first !== undefined) {
      throw new InventoryLoadError(labelOf(item, i), 'id', `"${item.id}" is also ${labelOf(inventory.entries[first]!, first)}'s id; an id is unique in the file`);
    }
    ids.set(item.id, i);
  });

  // Servers first, so a pack may name a base listed after it. Keyed by `id`,
  // which is how a pack names its base.
  const servers = new Map<string, { entry: E; serverType: string }>();
  const built: (E | undefined)[] = inventory.entries.map((item, i) => {
    if (item.kind === 'pack') return undefined;
    const alias = labelOf(item, i);
    if (item.kind !== 'server') throw new InventoryLoadError(alias, 'kind', `${JSON.stringify((item as { kind?: unknown }).kind)} is neither "server" nor "pack"`);
    const kind = kindOf(item.serverType);
    if (!kind) throw new InventoryLoadError(alias, 'serverType', `no kind for "${item.serverType}"`);
    if (!item.toolsRef || !Array.isArray(item.toolsRef.toolNames)) throw new InventoryLoadError(alias, 'toolsRef', 'is missing, or names no tools');
    const code = kind.server(item);
    const toolNames = [...item.toolsRef.toolNames];
    checkTools(alias, (code as { tools: readonly FunctionToolSchema[] }).tools, toolNames, item.toolsRef);
    const entry = {
      ...identityOf(item),
      configuration: item.configuration,
      toolNames,
      hostings: item.hostings,
      consentDefault: item.consentDefault,
      ...(item.publisher !== undefined ? { publisher: item.publisher } : {}),
      ...code,
    } as unknown as E;
    servers.set(item.id, { entry, serverType: item.serverType });
    return entry;
  });

  return inventory.entries.map((item, i) => {
    const done = built[i];
    if (done) return done;
    const pack = item as InventoryPackEntry;
    const alias = labelOf(pack, i);
    checkPackHash(alias, pack);
    const base = typeof pack.base === 'string' ? servers.get(pack.base) : undefined;
    if (!base) {
      const isPack = inventory.entries.some((other) => other.kind === 'pack' && (other.id === pack.base || other.sourceId === pack.base));
      const bySourceId = inventory.entries.find((other) => other.kind === 'server' && other.sourceId === pack.base);
      throw new InventoryLoadError(
        alias,
        'base',
        isPack
          ? `"${pack.base}" is a pack; a pack's base is a server entry`
          : bySourceId
            ? `"${pack.base}" is a sourceId; a pack names its base by the server entry's id ("${bySourceId.id}")`
            : `"${pack.base}" names no server entry's id`,
      );
    }
    const kind = kindOf(base.serverType);
    if (!kind?.pack) throw new InventoryLoadError(alias, 'base', `the kind of "${pack.base}" (${base.serverType}) takes no pack`);
    const code = kind.pack(pack, base.entry);
    const tools = (code.code as { tools: readonly FunctionToolSchema[] }).tools;
    if (pack.toolsRef) checkTools(alias, tools, code.toolNames, pack.toolsRef);
    else if (!sameNames(code.toolNames, tools.map((tool) => tool.function.name))) {
      throw new InventoryLoadError(alias, 'toolNames', "the pack's routing list is not its schemas' set");
    }
    checkBasePinsOf(alias, pack, code.toolNames, (base.entry as { toolNames: readonly string[] }).toolNames);
    return packManifestEntry(pack, base.entry, code);
  });
}
