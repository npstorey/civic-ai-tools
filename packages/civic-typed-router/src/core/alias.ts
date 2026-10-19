// The naming layer (ADR-0032): the names the model sees in the aliased view,
// the checks a manifest passes before a router is built over it, the dispatch
// map, and the rewrite of text the router does not own.
//
// The aliased view names every tool `<alias>__<upstream name>`. A name that
// would hold a character outside `[A-Za-z0-9_-]`, or run past 64 characters,
// is normalized deterministically: each out-of-set character becomes `_`, and
// an over-long name is cut and ends in a short hash of the name it came from.
// Both names are kept in the dispatch map, and only a collision after
// normalizing is refused. An alias is the operator's own, so an ill-formed
// alias is refused, never normalized.
//
// Dispatch reads the map, never a split of the name: an upstream name may
// itself hold `__` (Boston OpenContext's `ckan__search_datasets`).
//
// Text names a tool in one of two ways. Text the router owns names each tool
// through `SourceView.toolName`, so the bare view reproduces the bare bytes and
// the aliased view is exact by construction. Text the router does not own (a
// fetched guidance, a server's initialize instructions) gets the anchored
// rewrite: a token equal to one of that source's own tool names is renamed
// where it is anchored, and nowhere else.

import { LOAD_SOURCE_TOOL_NAME } from './directory.ts';
import { isOfferedReason, offeredReason, type SourceSelection } from './select.ts';
import type { ConfiguredAddresses, FunctionToolSchema, JsonSchema, Manifest, ManifestEntry, SourceView } from './types.ts';

/** What joins an alias to an upstream name. */
export const ALIAS_SEPARATOR = '__';

/** The longest name the aliased view exposes. The design's conservative bound
 *  for a chat-completions function name. */
export const MAX_TOOL_NAME_LENGTH = 64;

/** Every name the aliased view exposes matches this. */
export const TOOL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

/** Every alias matches this, and contains no `__`. At most 32 characters, so
 *  an exposed name always keeps room for its tool's own name. */
export const ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/;

const OUT_OF_SET = /[^A-Za-z0-9_-]/gu;
const HASH_LENGTH = 8;

/** FNV-1a over the UTF-8 bytes, 32 bits, as eight hex characters. Short,
 *  stable across runs and platforms, and dependency-free; it separates names,
 *  it secures nothing. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(HASH_LENGTH, '0');
}

/** Normalize a candidate name: each out-of-set character (by code point)
 *  becomes `_`; a result over 64 characters is cut to 55 and ends in `_` and
 *  the short hash of the candidate as given. */
export function normalizeToolName(candidate: string): string {
  const inSet = candidate.replace(OUT_OF_SET, '_');
  if (inSet.length <= MAX_TOOL_NAME_LENGTH) return inSet;
  return `${inSet.slice(0, MAX_TOOL_NAME_LENGTH - HASH_LENGTH - 1)}_${shortHash(candidate)}`;
}

/** The name the aliased view exposes for `upstreamName` under `alias`:
 *  `<alias>__<upstreamName>`, normalized where it needs it. */
export function exposedToolName(alias: string, upstreamName: string): string {
  return normalizeToolName(`${alias}${ALIAS_SEPARATOR}${upstreamName}`);
}

/** `exposedToolName` for a manifest entry. */
export function aliasedToolName(entry: Pick<ManifestEntry<unknown>, 'alias'>, upstreamName: string): string {
  return exposedToolName(entry.alias, upstreamName);
}

// --- The checks -------------------------------------------------------------------

/** Why a manifest cannot be given an aliased view. */
export type ToolNameProblem =
  | { readonly kind: 'alias-ill-formed'; readonly sourceId: string; readonly alias: string; readonly message: string }
  | { readonly kind: 'alias-shared'; readonly alias: string; readonly sourceIds: readonly string[]; readonly message: string }
  | { readonly kind: 'source-id-shared'; readonly sourceId: string; readonly message: string }
  | {
      /** An alias, or an upstream tool name, that is the first-step tool's
       *  reserved name (`LOAD_SOURCE_TOOL_NAME`). Since 0.5.0. */
      readonly kind: 'reserved-name';
      readonly name: string;
      readonly sourceId: string;
      readonly field: 'alias' | 'tool';
      readonly message: string;
    }
  | {
      readonly kind: 'name-collision';
      readonly exposedName: string;
      readonly tools: readonly { readonly sourceId: string; readonly upstreamName: string }[];
      readonly message: string;
    };

function aliasDefect(alias: string): string | null {
  if (alias.length === 0) return 'it is empty';
  if (/[^A-Za-z0-9_-]/u.test(alias)) return 'it holds a character outside [A-Za-z0-9_-]';
  if (!/^[A-Za-z_]/.test(alias)) return 'it does not start with a letter or an underscore';
  if (alias.includes(ALIAS_SEPARATOR)) return `it contains "${ALIAS_SEPARATOR}", the separator between an alias and a tool name`;
  if (!ALIAS_PATTERN.test(alias)) return 'it is longer than 32 characters';
  return null;
}

/** Every reason the manifest cannot be given an aliased view, in manifest
 *  order: an ill-formed alias, an alias or a source id two entries share, an
 *  alias or an upstream tool name that is the first-step tool's reserved
 *  name, and two tools whose exposed names are the same after normalizing. */
export function findToolNameProblems(manifest: Manifest<unknown>): ToolNameProblem[] {
  const problems: ToolNameProblem[] = [];

  const bySourceId = new Map<string, number>();
  for (const entry of manifest) bySourceId.set(entry.sourceId, (bySourceId.get(entry.sourceId) ?? 0) + 1);
  for (const [sourceId, count] of bySourceId) {
    if (count > 1) {
      problems.push({
        kind: 'source-id-shared',
        sourceId,
        message: `Source id "${sourceId}" is used by ${count} entries. A source id is the key a call is routed and recorded under.`,
      });
    }
  }

  const byAlias = new Map<string, string[]>();
  for (const entry of manifest) {
    const defect = aliasDefect(entry.alias);
    if (defect) {
      problems.push({
        kind: 'alias-ill-formed',
        sourceId: entry.sourceId,
        alias: entry.alias,
        message: `Alias "${entry.alias}" of source "${entry.sourceId}" is ill-formed: ${defect}. An alias is the operator's own, so it is refused, not normalized.`,
      });
    }
    byAlias.set(entry.alias, [...(byAlias.get(entry.alias) ?? []), entry.sourceId]);
  }
  for (const [alias, sourceIds] of byAlias) {
    if (sourceIds.length > 1) {
      problems.push({
        kind: 'alias-shared',
        alias,
        sourceIds,
        message: `Alias "${alias}" is used by ${sourceIds.map((id) => `"${id}"`).join(' and ')}. Each source needs its own alias.`,
      });
    }
  }

  // The first-step tool's name is reserved. A bare upstream name is accepted
  // at dispatch (`resolveCalledName`), so a source tool of that name would
  // take a bare call meant for the first-step tool; and the directory names
  // each source by its alias, which the first-step tool takes as its argument.
  for (const entry of manifest) {
    if (entry.alias === LOAD_SOURCE_TOOL_NAME) {
      problems.push({
        kind: 'reserved-name',
        name: LOAD_SOURCE_TOOL_NAME,
        sourceId: entry.sourceId,
        field: 'alias',
        message: `Alias "${entry.alias}" of source "${entry.sourceId}" is reserved: "${LOAD_SOURCE_TOOL_NAME}" is the first-step tool's name, which takes a source's alias as its argument.`,
      });
    }
    for (const tool of entry.tools) {
      if (tool.function.name === LOAD_SOURCE_TOOL_NAME) {
        problems.push({
          kind: 'reserved-name',
          name: LOAD_SOURCE_TOOL_NAME,
          sourceId: entry.sourceId,
          field: 'tool',
          message: `Tool "${tool.function.name}" of source "${entry.sourceId}" has a reserved name: "${LOAD_SOURCE_TOOL_NAME}" is the first-step tool's name, and a bare call of it would be dispatched to the source.`,
        });
      }
    }
  }

  const byExposed = new Map<string, { sourceId: string; upstreamName: string }[]>();
  for (const entry of manifest) {
    for (const tool of entry.tools) {
      const upstreamName = tool.function.name;
      const exposedName = exposedToolName(entry.alias, upstreamName);
      byExposed.set(exposedName, [...(byExposed.get(exposedName) ?? []), { sourceId: entry.sourceId, upstreamName }]);
    }
  }
  for (const [exposedName, tools] of byExposed) {
    if (tools.length > 1) {
      problems.push({
        kind: 'name-collision',
        exposedName,
        tools,
        message: `Tool names collide: ${tools.map((t) => `"${t.upstreamName}" of "${t.sourceId}"`).join(' and ')} are both exposed as "${exposedName}".`,
      });
    }
  }

  return problems;
}

/** Thrown by `checkToolNames`. */
export class ToolNameError extends Error {
  readonly problems: readonly ToolNameProblem[];

  constructor(problems: readonly ToolNameProblem[]) {
    super(problems.map((p) => p.message).join(' '));
    this.name = 'ToolNameError';
    this.problems = problems;
  }
}

/** Refuse a manifest that cannot be given an aliased view. */
export function checkToolNames(manifest: Manifest<unknown>): void {
  const problems = findToolNameProblems(manifest);
  if (problems.length > 0) throw new ToolNameError(problems);
}

// --- The dispatch map -------------------------------------------------------------

/** Where an exposed name goes. */
export interface DispatchTarget {
  /** The name the model sees and calls. */
  readonly exposedName: string;
  readonly sourceId: string;
  readonly alias: string;
  /** The name the server knows, sent on the wire. */
  readonly upstreamName: string;
  /** Whether the exposed name differs from `<alias>__<upstreamName>`. */
  readonly normalized: boolean;
}

/** Exposed name to target, for every function tool in a manifest, in
 *  manifest order. */
export type DispatchMap = ReadonlyMap<string, DispatchTarget>;

/** The dispatch map of `manifest`. Runs `checkToolNames` first, so every
 *  exposed name in the map is unique. */
export function dispatchMap(manifest: Manifest<unknown>): DispatchMap {
  checkToolNames(manifest);
  const map = new Map<string, DispatchTarget>();
  for (const entry of manifest) {
    for (const tool of entry.tools) {
      const upstreamName = tool.function.name;
      const exposedName = exposedToolName(entry.alias, upstreamName);
      map.set(exposedName, {
        exposedName,
        sourceId: entry.sourceId,
        alias: entry.alias,
        upstreamName,
        normalized: exposedName !== `${entry.alias}${ALIAS_SEPARATOR}${upstreamName}`,
      });
    }
  }
  return map;
}

/** The upstream name of an exposed name; any other name is returned as it
 *  is, so a bare name reads the same as its exposed form. */
export function upstreamToolName(map: DispatchMap, name: string): string {
  return map.get(name)?.upstreamName ?? name;
}

/** The target of an exposed name, or `undefined`. */
export function sourceForAliasedName(map: DispatchMap, name: string): DispatchTarget | undefined {
  return map.get(name);
}

/** How a called name resolved. */
export type CalledNameResolution =
  | {
      readonly ok: true;
      /** `aliased`: the call used the exposed name. `bare`: the call used an
       *  upstream name exactly one offered source has. */
      readonly spelling: 'aliased' | 'bare';
      readonly exposedName: string;
      readonly sourceId: string;
      readonly alias: string;
      readonly upstreamName: string;
    }
  | {
      readonly ok: false;
      /** `ambiguous`: two or more offered sources have the bare name.
       *  `not-offered`: only a source this run is not offered has it.
       *  `unknown`: no source has it. */
      readonly reason: 'ambiguous' | 'not-offered' | 'unknown';
      /** The exposed names the call could have meant. */
      readonly candidates: readonly string[];
      readonly message: string;
    };

/**
 * Resolve the name a model called (the dispatch rule, ADR-0032).
 *
 * An exposed name resolves by the map. A bare upstream name is accepted when
 * exactly one offered source has it, and refused, naming every aliased form,
 * when two or more do. `offered` is the source ids the run is offered;
 * `undefined` offers every source in the map.
 */
export function resolveCalledName(map: DispatchMap, offered: readonly string[] | undefined, name: string): CalledNameResolution {
  const isOffered = (sourceId: string): boolean => offered === undefined || offered.includes(sourceId);
  const quoted = (names: readonly string[]): string => names.map((n) => `"${n}"`).join(' or ');

  const exact = map.get(name);
  if (exact) {
    if (isOffered(exact.sourceId)) {
      return { ok: true, spelling: 'aliased', ...pick(exact) };
    }
    return {
      ok: false,
      reason: 'not-offered',
      candidates: [exact.exposedName],
      message: `Tool "${name}" belongs to source "${exact.sourceId}", which this run is not offered.`,
    };
  }

  const bare = [...map.values()].filter((t) => t.upstreamName === name);
  const offeredBare = bare.filter((t) => isOffered(t.sourceId));
  if (offeredBare.length === 1) {
    return { ok: true, spelling: 'bare', ...pick(offeredBare[0]!) };
  }
  if (offeredBare.length > 1) {
    const candidates = offeredBare.map((t) => t.exposedName);
    return {
      ok: false,
      reason: 'ambiguous',
      candidates,
      message: `Tool "${name}" is offered by more than one source; call it by its full name: ${quoted(candidates)}.`,
    };
  }
  if (bare.length > 0) {
    const candidates = bare.map((t) => t.exposedName);
    return {
      ok: false,
      reason: 'not-offered',
      candidates,
      message: `Tool "${name}" belongs only to a source this run is not offered (${quoted(candidates)}).`,
    };
  }
  return { ok: false, reason: 'unknown', candidates: [], message: `No offered tool is named "${name}".` };
}

function pick(t: DispatchTarget) {
  return { exposedName: t.exposedName, sourceId: t.sourceId, alias: t.alias, upstreamName: t.upstreamName };
}

// --- Views ------------------------------------------------------------------------

/** The bare view: every tool by its upstream name, every text as it is. */
export const BARE_VIEW: SourceView = Object.freeze({
  toolName: (_sourceId: string, upstreamName: string) => upstreamName,
  sourceText: (_sourceId: string, text: string) => text,
});

/**
 * The aliased view of `manifest`. A tool the source declares is named by the
 * map. A name the source does not declare (a pattern such as `ckan__*`) gets
 * the source's alias and the separator in front of it, as written. A source
 * the manifest does not hold keeps its names.
 */
export function aliasedView(manifest: Manifest<unknown>, map: DispatchMap = dispatchMap(manifest)): SourceView {
  const exposedBySource = new Map<string, Map<string, string>>();
  for (const target of map.values()) {
    const names = exposedBySource.get(target.sourceId) ?? new Map<string, string>();
    names.set(target.upstreamName, target.exposedName);
    exposedBySource.set(target.sourceId, names);
  }
  const aliasOf = new Map(manifest.map((entry) => [entry.sourceId, entry.alias]));
  return Object.freeze({
    toolName(sourceId: string, upstreamName: string): string {
      const exposed = exposedBySource.get(sourceId)?.get(upstreamName);
      if (exposed !== undefined) return exposed;
      const alias = aliasOf.get(sourceId);
      return alias === undefined ? upstreamName : `${alias}${ALIAS_SEPARATOR}${upstreamName}`;
    },
    sourceText(sourceId: string, text: string): string {
      const names = exposedBySource.get(sourceId);
      return names ? anchoredRewrite(text, names) : text;
    },
  });
}

// --- The anchored rewrite ---------------------------------------------------------

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TOOLS_LIST_BEFORE = /(?:^|[^A-Za-z0-9_])Tools:[ \t]*(?:[^\s,]+,[ \t]*)*$/;
const TABLE_ROW = /^\s*\|/;

/** Whether the token `name` at `offset` in `line` sits at an anchor: an exact
 *  backtick, bold or double-quoted token, an exact table cell, or an item of a
 *  `Tools:` list. */
function isAnchored(line: string, offset: number, name: string): boolean {
  const before = line.slice(0, offset);
  const after = line.slice(offset + name.length);
  if (before.endsWith('`') && after.startsWith('`')) return true;
  if (before.endsWith('**') && after.startsWith('**')) return true;
  if (before.endsWith('"') && after.startsWith('"')) return true;
  if (TABLE_ROW.test(line)) {
    const start = before.lastIndexOf('|');
    const end = after.indexOf('|');
    if (start >= 0 && end >= 0 && before.slice(start + 1).trim() === '' && after.slice(0, end).trim() === '') return true;
  }
  return TOOLS_LIST_BEFORE.test(before);
}

/**
 * Rename, in `text`, every token equal to a key of `names` that sits at an
 * anchor, to its value. The anchors: an exact backtick token (`` `get_data` ``),
 * an exact bold token (`**get_data**`), an exact double-quoted token
 * (`"get_data"`), an exact markdown table cell (`| get_data |`), and an item
 * of a `Tools:` list (`Tools: a, b.`). A token is a whole name: a name inside
 * a longer identifier is not one. Nothing else changes.
 */
export function anchoredRewrite(text: string, names: ReadonlyMap<string, string>): string {
  if (names.size === 0) return text;
  const alternation = [...names.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const token = new RegExp(`(?<![A-Za-z0-9_-])(?:${alternation})(?![A-Za-z0-9_-])`, 'g');
  return text
    .split('\n')
    .map((line) => line.replace(token, (match: string, offset: number) => (isAnchored(line, offset, match) ? names.get(match)! : match)))
    .join('\n');
}

/** A source's own text, rewritten for the aliased view of `map`: the
 *  anchored rewrite of that source's tool names. */
export function aliasedGuidance(map: DispatchMap, sourceId: string, text: string): string {
  const names = new Map<string, string>();
  for (const target of map.values()) {
    if (target.sourceId === sourceId) names.set(target.upstreamName, target.exposedName);
  }
  return anchoredRewrite(text, names);
}

// --- Tools in a view --------------------------------------------------------------

function rewriteDescriptions(value: unknown, rewrite: (text: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteDescriptions(item, rewrite));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === 'description' && typeof inner === 'string' ? rewrite(inner) : rewriteDescriptions(inner, rewrite),
      ]),
    );
  }
  return value;
}

/** An entry's tool schemas in `view`: its own `toolsFor` when it has one
 *  (text the router owns); otherwise each schema renamed by the view, with
 *  every description given the view's treatment of the source's own text. */
export function entryToolsInView(entry: ManifestEntry<unknown>, view: SourceView): readonly FunctionToolSchema[] {
  if (entry.toolsFor) return entry.toolsFor(view);
  return entry.tools.map((tool) => {
    const fn = tool.function;
    const rewrite = (text: string): string => view.sourceText(entry.sourceId, text);
    return {
      ...tool,
      function: {
        ...fn,
        name: view.toolName(entry.sourceId, fn.name),
        ...(fn.description === undefined ? {} : { description: rewrite(fn.description) }),
        ...(fn.parameters === undefined ? {} : { parameters: rewriteDescriptions(fn.parameters, rewrite) as JsonSchema }),
      },
    };
  });
}

/** Every function tool of `manifest` in the aliased view, in manifest order. */
export function aliasedTools(manifest: Manifest<unknown>, view: SourceView = aliasedView(manifest)): FunctionToolSchema[] {
  return manifest.flatMap((entry) => [...entryToolsInView(entry, view)]);
}

/** The exposed names a run is not offered: `withheldToolNames` in the aliased
 *  view. */
export function aliasedWithheldToolNames(
  manifest: Manifest<unknown>,
  addresses: ConfiguredAddresses,
  selection: SourceSelection,
  view: SourceView,
): string[] {
  return manifest
    .filter((entry) => !isOfferedReason(offeredReason(entry, addresses, selection)))
    .flatMap((entry) => entry.toolNames.map((name) => view.toolName(entry.sourceId, name)));
}

// --- The reverse ------------------------------------------------------------------

/**
 * The aliased view undone, mechanically: every exposed name the map
 * normalized becomes its upstream name, then every alias prefix (`<alias>__`
 * not preceded by a name character) is removed. For text the router composed
 * from a manifest whose bare text holds no alias prefix, this yields the bare
 * bytes exactly.
 */
export function unaliasText(map: DispatchMap, text: string): string {
  let out = text;
  const normalized = [...map.values()].filter((t) => t.normalized);
  if (normalized.length > 0) {
    const byName = new Map(normalized.map((t) => [t.exposedName, t.upstreamName]));
    const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_-])(?:${names})(?![A-Za-z0-9_-])`, 'g'), (m) => byName.get(m)!);
  }
  const aliases = [...new Set([...map.values()].map((t) => t.alias))];
  if (aliases.length > 0) {
    const prefix = new RegExp(`(?<![A-Za-z0-9_-])(?:${aliases.map(escapeRegExp).join('|')})${ALIAS_SEPARATOR}`, 'g');
    out = out.replace(prefix, '');
  }
  return out;
}
