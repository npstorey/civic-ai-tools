// The directory: the text a model reads before any source is loaded, and the
// first-step tool it loads a source with (ADR-0037). The directory is an
// intro, a heading, a paragraph, and one line per source:
//
//   - `<alias>`: <description as a sentence> <freshness label> <freshness>
//
// Every sentence arrives as a value; this file holds none. The join is the
// one R5's frozen first-request template has: blocks separated by a blank
// line, entry lines by a newline, no closing block and no trailing newline.

import type { FunctionToolSchema, ManifestEntry } from './types.ts';

/** The fixed text around the directory's lines. */
export interface DirectoryFrame {
  /** The opening block. */
  readonly intro: string;
  /** The heading above the paragraph. */
  readonly heading: string;
  /** What the directory is and how to load a source from it. */
  readonly paragraph: string;
  /** The label before each entry's freshness line. */
  readonly freshnessLabel: string;
}

/** What one directory line reads from an entry. */
export type DirectoryEntry = Pick<ManifestEntry<unknown>, 'alias' | 'description' | 'freshness'>;

/** `text` as a sentence: unchanged when it ends in `.`, `!` or `?`, otherwise
 *  with a period added, so it does not run into the freshness label. */
export function directorySentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** One entry's line: `` - `<alias>`: <description> <label> <freshness> ``. */
export function directoryLine(entry: DirectoryEntry, freshnessLabel: string): string {
  return `- \`${entry.alias}\`: ${directorySentence(entry.description)} ${freshnessLabel} ${entry.freshness}`;
}

/**
 * The directory over `entries`, in the order given: the intro, the heading
 * and the paragraph, each followed by a blank line, then one line per entry
 * joined by a newline. With no entries, the text ends at the paragraph.
 */
export function composeDirectory(frame: DirectoryFrame, entries: readonly DirectoryEntry[]): string {
  const head = `${frame.intro}\n\n${frame.heading}\n\n${frame.paragraph}`;
  if (entries.length === 0) return head;
  return `${head}\n\n${entries.map((entry) => directoryLine(entry, frame.freshnessLabel)).join('\n')}`;
}

// --- The first-step tool ----------------------------------------------------------

/** The first-step tool's name. Reserved: the startup check refuses an alias
 *  or an upstream tool of this name (`findToolNameProblems`), since the
 *  dispatch rule accepts a bare upstream name and the directory lists each
 *  source by its alias. */
export const LOAD_SOURCE_TOOL_NAME = 'load_source';

/** The first-step tool's text, from the consumer's frame. */
export interface LoadSourceToolText {
  /** The tool's description. */
  readonly description: string;
  /** The `alias` argument's description. */
  readonly aliasDescription: string;
}

/**
 * The first-step tool: `load_source`, one required argument `alias` whose
 * enum is `aliases` in the order given, and no other argument. A new object
 * on every call.
 */
export function loadSourceTool(aliases: readonly string[], text: LoadSourceToolText): FunctionToolSchema {
  return {
    type: 'function',
    function: {
      name: LOAD_SOURCE_TOOL_NAME,
      description: text.description,
      parameters: {
        type: 'object',
        properties: {
          alias: {
            type: 'string',
            enum: [...aliases],
            description: text.aliasDescription,
          },
        },
        required: ['alias'],
        additionalProperties: false,
      },
    },
  };
}
