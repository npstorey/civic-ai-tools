// The words of the two CKAN entries (CKAN-1 P2, hub issue 314): the hosted
// CKAN server and the Boston pack over it, and the preamble's Boston rule
// for the pack.
//
// Every member here is a word member: a person or the model reads it. Each
// also stands in the hub's `inventory/civic-inventory.json`, the entries'
// source of truth, which `src/inventory.test.ts` holds equal to the mirror
// built from this module. So a changed word is this line, its line in the
// file, and the pack's hash with the file's (every member of the pack here
// but the rule is inside the pack's hash).

/** The hosted CKAN server's words. */
export const CKAN_SERVER_WORDS = Object.freeze({
  displayName: 'CKAN MCP Server',
  description:
    "A server for CKAN open data portals, run from a pinned copy of the open-source ckan-mcp-server. It reads a portal's public API with no sign-in, and only the portals its operator lists. None of its tools are offered on their own: each portal is a separate source that uses some of them (Analyze Boston is the first). Its portal finder tool, which no source in this inventory offers, reaches one host outside that list: datashades.info, for a public directory of CKAN portals.",
  freshness: 'It has no data of its own. Each source that uses it states how current its data is.',
  publisher: 'onData',
});

/** The Boston pack's words. */
export const BOSTON_CKAN_WORDS = Object.freeze({
  displayName: 'Analyze Boston',
  description:
    "Analyze Boston, the City of Boston's open data portal (data.boston.gov): 311 requests, permits, crime, inspections, property, elections, schools, parcels and neighborhoods. This source reads the portal's public API through a hosted CKAN server, with no sign-in. Boston's city data is here, not on Socrata. Covers the City of Boston only, and is not the source for census statistics.",
  freshness:
    "Live: queries reach data.boston.gov when they are made. The hosted server may reuse an earlier answer to the same query. A dataset's data may be reused for up to a minute, and a dataset search or a dataset's details for up to five minutes. Each dataset updates on the City's schedule.",
  freshnessSource:
    'github.com/npstorey/ckan-mcp-server at 7b0ac8a (upstream 0.4.139), the hosted CKAN server: before each CKAN request it looks in its memory for an answer to the same request (src/utils/http.ts, makeCkanRequest). It keeps an answer up to 60 seconds for datastore queries, and up to 300 seconds for package searches, package descriptions and every other request this source\'s tools send to data.boston.gov (src/utils/cache.ts, getTtlForAction). The memory is on unless CKAN_CACHE_ENABLED is false (getCacheConfig); the variables the fork\'s PIN.md lists for its deployment set no CKAN_CACHE_ variable.',
  citation: 'the resource ID + dataset title (for Analyze Boston)',
  lockMention: 'Analyze Boston for Boston',
  author: 'Civic AI Tools',
  publisher: 'Civic AI Tools',
});

/** The preamble's rule for the Boston pack, stated when the pack is offered
 *  (finding 1, ruled (a)); with the pack offered, the Boston OpenContext rule
 *  is not stated. */
export const BOSTON_CKAN_RULE = '- **Boston civic questions** → Analyze Boston. Boston is not on Socrata.';

/** The preamble's Boston rule for the hosted CKAN server (CKAN-2 P2, R3): a
 *  typed stub, empty until the server offers its own tools. */
export const CKAN_BOSTON_RULE: string = '';
