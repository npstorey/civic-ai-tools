// The guidance a composition reads, offline. The benchmark calls no source,
// so the two reads the website makes at composition time are answered here:
//
//   - `fetchPrompt('skill-guidance', { modality: 'web' })`, Socrata's guidance:
//     the router's pinned capture of socrata-mcp-server's prompt
//     (`packages/civic-typed-router/src/__fixtures__/socrata-guidance.json`),
//     where the website reads the hosted server's prompt live;
//   - `fetchInstructions(sourceId)`, a remote server's `initialize`
//     instructions: none, as R5 read Data Commons and Boston OpenContext, so
//     their blocks carry the router's embedded skill text.
//
// The publication host is the one R5's directory recorded.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

/** The repository root, from this file's place in it. */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The pinned Socrata guidance, as a repository path. */
export const SOCRATA_GUIDANCE_PATH = 'packages/civic-typed-router/src/__fixtures__/socrata-guidance.json';

/** The instance's publication host, which the Data Commons guidance names. */
export const PUBLICATION_HOST = 'civicaitools.org';

const pinned = JSON.parse(readFileSync(new URL(`../../${SOCRATA_GUIDANCE_PATH}`, import.meta.url), 'utf8'));

/** The pinned Socrata guidance text. */
export const SOCRATA_GUIDANCE_TEXT = pinned.text;

/** sha256 of the pinned file's bytes. */
export const SOCRATA_GUIDANCE_FILE_SHA256 = createHash('sha256')
  .update(readFileSync(new URL(`../../${SOCRATA_GUIDANCE_PATH}`, import.meta.url)))
  .digest('hex');

/** The two fetchers a composition is given. Any other prompt is refused, as
 *  a server that does not serve it would refuse it. */
export const offlineFetchers = Object.freeze({
  async fetchPrompt(name, args) {
    if (name === 'skill-guidance' && args?.modality === 'web') return SOCRATA_GUIDANCE_TEXT;
    throw new Error(`offline: no pinned prompt ${name}`);
  },
  async fetchInstructions() {
    return null;
  },
});
