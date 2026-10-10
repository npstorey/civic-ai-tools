// The composer's join: an intro, an optional preamble, one block per source,
// and an outro. Every sentence arrives as a value; this file holds none.

import type { Manifest } from './types.ts';

/** What separates the blocks of a composed prompt. */
export const BLOCK_SEPARATOR = '\n\n---\n\n';

/** The fixed text around the source blocks. */
export interface PromptFrame {
  /** The opening block. */
  readonly intro: string;
  /** Joined to the intro by a blank line when it is non-empty. */
  readonly preamble?: string;
  /** The closing block. */
  readonly outro: string;
}

/**
 * Join `frame` and the texts `blocks` produce: the intro, followed by the
 * preamble when there is one; each block whose text is not blank; the outro.
 * Parts are joined by `BLOCK_SEPARATOR`.
 *
 * Every block is started before any is awaited, in order, so the calls a block
 * makes happen in block order. A block that throws, or whose text is blank
 * after trimming, is left out; composition itself does not fail.
 */
export async function composePrompt(
  frame: PromptFrame,
  blocks: ReadonlyArray<() => Promise<string>>,
): Promise<string> {
  const introBlock = frame.preamble ? `${frame.intro}\n\n${frame.preamble}` : frame.intro;

  const texts = await Promise.all(
    blocks.map(async (block) => {
      try {
        return await block();
      } catch {
        return '';
      }
    }),
  );

  const parts: string[] = [introBlock];
  for (const text of texts) {
    if (text && text.trim().length > 0) {
      parts.push(text);
    }
  }
  parts.push(frame.outro);

  return parts.join(BLOCK_SEPARATOR);
}

/** `composePrompt` with one block per entry, each the entry's guidance text
 *  for `context`, in manifest order. */
export function composeManifestPrompt<Context>(
  entries: Manifest<Context>,
  context: Context,
  frame: PromptFrame,
): Promise<string> {
  return composePrompt(
    frame,
    entries.map((entry) => () => entry.guidance.fetchText(context)),
  );
}
