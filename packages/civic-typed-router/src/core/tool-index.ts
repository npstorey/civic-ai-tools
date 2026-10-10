// The tool-to-source index, derived from each entry's schemas, and two
// validations over a manifest.
//
// The validations are defined here and tested, but 0.1.0 invokes neither:
// refusing a manifest at load is a behaviour change, and this release changes
// no behaviour. A consumer may call them.

import type { Manifest, ManifestEntry } from './types.ts';

/** Tool name to `sourceId`, for every function tool in the manifest.
 *
 *  A plain object, so a lookup reads it the way a property read does: a name
 *  no tool has yields `undefined`, and a name that is also an `Object.prototype`
 *  property yields that property. That is the lookup the reference app's
 *  static map performs; it is kept so the move changes no answer. */
export type ToolSourceIndex = Record<string, string>;

export function toolSourceIndex(manifest: Manifest<unknown>): ToolSourceIndex {
  const index: ToolSourceIndex = {};
  for (const entry of manifest) {
    for (const tool of entry.tools) {
      index[tool.function.name] = entry.sourceId;
    }
  }
  return index;
}

/** A tool name more than one source declares, with every source that does. */
export interface DuplicateToolName {
  readonly tool: string;
  readonly sourceIds: readonly string[];
}

/** Every tool name declared by more than one source, in first-seen order. */
export function findDuplicateToolNames(manifest: Manifest<unknown>): DuplicateToolName[] {
  const owners = new Map<string, string[]>();
  for (const entry of manifest) {
    for (const tool of entry.tools) {
      const name = tool.function.name;
      const list = owners.get(name) ?? [];
      list.push(entry.sourceId);
      owners.set(name, list);
    }
  }
  return [...owners]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([tool, sourceIds]) => ({ tool, sourceIds }));
}

/** Thrown by `assertUniqueToolNames`. */
export class DuplicateToolNameError extends Error {
  readonly duplicates: readonly DuplicateToolName[];

  constructor(duplicates: readonly DuplicateToolName[]) {
    super(
      duplicates
        .map(
          ({ tool, sourceIds }) =>
            `Duplicate tool name "${tool}": declared by ${sourceIds.map((id) => `"${id}"`).join(' and ')}. ` +
            'A tool name is the router\'s only key, so a second binding would make the first unreachable.',
        )
        .join(' '),
    );
    this.name = 'DuplicateToolNameError';
    this.duplicates = duplicates;
  }
}

/** Refuse a manifest in which two sources declare the same tool name. */
export function assertUniqueToolNames(manifest: Manifest<unknown>): void {
  const duplicates = findDuplicateToolNames(manifest);
  if (duplicates.length > 0) throw new DuplicateToolNameError(duplicates);
}

/** Whether an entry's routing list and its schemas name the same tools, each
 *  once. */
export function toolNamesMatchSchemas(entry: ManifestEntry<unknown>): boolean {
  const schemaNames = entry.tools.map((tool) => tool.function.name);
  const routed = new Set(entry.toolNames);
  const declared = new Set(schemaNames);
  return (
    routed.size === entry.toolNames.length &&
    declared.size === schemaNames.length &&
    routed.size === declared.size &&
    [...routed].every((name) => declared.has(name))
  );
}
