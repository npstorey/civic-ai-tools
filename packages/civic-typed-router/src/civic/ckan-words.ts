// The words of the hosted CKAN server's entry (CKAN-1 P2, hub issue 314;
// rewritten as facts in CKAN-2 P2, hub issue 329, D8 = A), and the
// preamble's Boston rule for it.
//
// Every member here is a word member: a person or the model reads it. Each
// also stands in the hub's `inventory/civic-inventory.json`, the entries'
// source of truth, which `src/inventory.test.ts` holds equal to the mirror
// built from this module. So a changed word is this line, its line in the
// file, and the file's hash. The rule is the router's own text, outside the
// file.

/** The hosted CKAN server's words. */
export const CKAN_SERVER_WORDS = Object.freeze({
  displayName: 'CKAN MCP Server',
  description:
    "A server for CKAN open data portals, run from a pinned copy of the open-source ckan-mcp-server. It reads a portal's public API with no sign-in, and only the portals its operator lists. Each call names the portal it reads in server_url; Boston's portal, Analyze Boston, is data.boston.gov. Its tools here search a portal's datasets, show a dataset and its resources, read and query a resource's rows, and report whether a portal answers. Its portal finder tool, which this inventory does not offer, reaches one host outside that list: datashades.info, for a public directory of CKAN portals.",
  freshness:
    "Live: a call reaches the portal it names when it is made. The server may reuse an earlier answer to the same request: a resource's rows for up to a minute, a dataset search or a dataset's details for up to five minutes, and a portal's status for up to an hour. Each portal's data updates on its publisher's schedule.",
  freshnessSource:
    "github.com/npstorey/ckan-mcp-server at 39ae5695 (upstream 0.4.139), the hosted CKAN server: before each CKAN request it looks in its memory for an answer to the same request (src/utils/http.ts, makeCkanRequest). It keeps an answer up to 60 seconds for datastore_search and datastore_search_sql, up to 3600 seconds for status_show, and up to 300 seconds for package_search, package_show and every other request (src/utils/cache.ts, getTtlForAction and getCacheConfig's default). The memory is on unless CKAN_CACHE_ENABLED is false (getCacheConfig); the variables the fork's PIN.md lists for its deployment set no CKAN_CACHE_ variable.",
  citation: 'the portal, the resource ID and the dataset title (for the CKAN MCP Server)',
  lockMention: 'the CKAN MCP Server for Boston and other CKAN portals',
  publisher: 'onData',
});

/** The preamble's Boston rule for the hosted CKAN server, stated when it is
 *  offered (since 0.12.0); with it offered, the Boston OpenContext rule is
 *  not stated. */
export const CKAN_BOSTON_RULE =
  '- **Boston civic questions** → the CKAN MCP Server, with `server_url` https://data.boston.gov (Analyze Boston, the City of Boston\'s portal). Boston is not on Socrata.';
