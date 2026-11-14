// The Boston pack over the hosted CKAN server (CKAN-1 P2, hub issue 314).
// A stub of the red tree: the names the tests import, with no pack built
// yet. The pack's guidance is empty and its entry is a placeholder that no
// manifest holds.

import type { CivicManifestEntry } from './context.ts';
import { CKAN_SERVER_ENTRY } from './ckan.ts';

/** The pack's guidance. A stub: empty. */
export const BOSTON_CKAN_GUIDANCE = '';

/** The Boston pack. A stub: a placeholder with no tools and no pack. */
export const BOSTON_CKAN_ENTRY: CivicManifestEntry = {
  ...CKAN_SERVER_ENTRY,
  id: 'boston-ckan@stub',
  alias: 'boston_ckan_stub',
  sourceId: 'boston-ckan-stub',
};
