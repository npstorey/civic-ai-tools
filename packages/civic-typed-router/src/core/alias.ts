// STUB (red tree): the naming layer's exported surface, typed, with no
// behaviour. Every function answers as if no alias existed: names are not
// normalized, nothing is checked, nothing is rewritten, and dispatch knows no
// name. The implementation replaces this file.

import type { SourceSelection } from './select.ts';
import type { ConfiguredAddresses, FunctionToolSchema, Manifest, ManifestEntry, SourceView } from './types.ts';

export const ALIAS_SEPARATOR = '__';
export const MAX_TOOL_NAME_LENGTH = 64;
export const TOOL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
export const ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/;

export function normalizeToolName(candidate: string): string {
  return candidate;
}

export function exposedToolName(alias: string, upstreamName: string): string {
  return `${alias}${ALIAS_SEPARATOR}${upstreamName}`;
}

export function aliasedToolName(entry: Pick<ManifestEntry<unknown>, 'alias'>, upstreamName: string): string {
  return exposedToolName(entry.alias, upstreamName);
}

export type ToolNameProblem =
  | { readonly kind: 'alias-ill-formed'; readonly sourceId: string; readonly alias: string; readonly message: string }
  | { readonly kind: 'alias-shared'; readonly alias: string; readonly sourceIds: readonly string[]; readonly message: string }
  | { readonly kind: 'source-id-shared'; readonly sourceId: string; readonly message: string }
  | {
      readonly kind: 'name-collision';
      readonly exposedName: string;
      readonly tools: readonly { readonly sourceId: string; readonly upstreamName: string }[];
      readonly message: string;
    };

export function findToolNameProblems(_manifest: Manifest<unknown>): ToolNameProblem[] {
  return [];
}

export class ToolNameError extends Error {
  readonly problems: readonly ToolNameProblem[];

  constructor(problems: readonly ToolNameProblem[]) {
    super(problems.map((p) => p.message).join(' '));
    this.name = 'ToolNameError';
    this.problems = problems;
  }
}

export function checkToolNames(_manifest: Manifest<unknown>): void {}

export interface DispatchTarget {
  readonly exposedName: string;
  readonly sourceId: string;
  readonly alias: string;
  readonly upstreamName: string;
  readonly normalized: boolean;
}

export type DispatchMap = ReadonlyMap<string, DispatchTarget>;

export function dispatchMap(_manifest: Manifest<unknown>): DispatchMap {
  return new Map();
}

export function upstreamToolName(_map: DispatchMap, name: string): string {
  return name;
}

export function sourceForAliasedName(_map: DispatchMap, _name: string): DispatchTarget | undefined {
  return undefined;
}

export type CalledNameResolution =
  | {
      readonly ok: true;
      readonly spelling: 'aliased' | 'bare';
      readonly exposedName: string;
      readonly sourceId: string;
      readonly alias: string;
      readonly upstreamName: string;
    }
  | {
      readonly ok: false;
      readonly reason: 'ambiguous' | 'not-offered' | 'unknown';
      readonly candidates: readonly string[];
      readonly message: string;
    };

export function resolveCalledName(_map: DispatchMap, _offered: readonly string[] | undefined, name: string): CalledNameResolution {
  return { ok: false, reason: 'unknown', candidates: [], message: `No offered tool is named "${name}".` };
}

export const BARE_VIEW: SourceView = Object.freeze({
  toolName: (_sourceId: string, upstreamName: string) => upstreamName,
  sourceText: (_sourceId: string, text: string) => text,
});

export function aliasedView(_manifest: Manifest<unknown>, _map?: DispatchMap): SourceView {
  return BARE_VIEW;
}

export function anchoredRewrite(text: string, _names: ReadonlyMap<string, string>): string {
  return text;
}

export function aliasedGuidance(_map: DispatchMap, _sourceId: string, text: string): string {
  return text;
}

export function entryToolsInView(entry: ManifestEntry<unknown>, _view: SourceView): readonly FunctionToolSchema[] {
  return entry.tools;
}

export function aliasedTools(manifest: Manifest<unknown>, _view?: SourceView): FunctionToolSchema[] {
  return manifest.flatMap((entry) => [...entry.tools]);
}

export function aliasedWithheldToolNames(
  _manifest: Manifest<unknown>,
  _addresses: ConfiguredAddresses,
  _selection: SourceSelection,
  _view: SourceView,
): string[] {
  return [];
}

export function unaliasText(_map: DispatchMap, text: string): string {
  return text;
}
