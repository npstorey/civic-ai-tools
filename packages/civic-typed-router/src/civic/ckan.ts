// The hosted CKAN server (CKAN-1 P2, hub issue 314): the base the Boston
// pack is built over, and the six tool schemas a CKAN pack calls.
//
// The server is a pinned fork of the open-source ckan-mcp-server
// (github.com/npstorey/ckan-mcp-server, at the commit its fixture names),
// which the project hosts at an address the instance configures
// (`CKAN_MCP_URL`). Its server entry declares no tools (`toolsRef.toolNames`
// is empty in the inventory, D7 = D): none of its 20 tools is offered on its
// own, and a portal is a pack over it that calls some of them with
// `server_url` fixed. Its `initialize` result carries no `instructions` and
// the entry's guidance is none.
//
// Since the entry declares no tools, the base's own tool names are stated
// here (`CKAN_SERVER_TOOL_NAMES`, in its `tools/list` order): the kind's pack
// builder hands them to the loader, which holds a pack's `basePins` to them
// (Q1). The six schemas a pack calls (`CKAN_PACK_BASE_TOOLS`) are the
// server's own, as its `tools/list` returns them at the pinned commit:
// captured by `src/__fixtures__/pin-ckan-tools.mjs` into
// `src/__fixtures__/ckan-tools.json`, and held equal to it by
// `src/ckan.test.ts`. They are code because the build reads no JSON, and
// text the router does not own: the aliased view gives their descriptions
// the anchored rewrite.

import type { FunctionToolSchema, GuidanceEntry } from '../core/types.ts';
import { CKAN_SERVER_WORDS } from './ckan-words.ts';
import type { CivicGuidanceContext, CivicManifestEntry } from './context.ts';
import { CKAN_ADDRESS_VARIABLE } from './env.ts';

/** The hosted CKAN server's source id. */
export const CKAN_SERVER_SOURCE_ID = 'ckan-server';

/** The server's 20 tool names, in the order its `tools/list` returns them
 *  at the pinned commit: what a CKAN pack's `basePins` are held to. */
export const CKAN_SERVER_TOOL_NAMES: readonly string[] = [
  "ckan_package_search",
  "ckan_find_relevant_datasets",
  "ckan_package_show",
  "ckan_list_resources",
  "ckan_organization_list",
  "ckan_organization_show",
  "ckan_organization_search",
  "ckan_datastore_search",
  "ckan_datastore_search_sql",
  "ckan_status_show",
  "ckan_tag_list",
  "ckan_group_list",
  "ckan_group_show",
  "ckan_group_search",
  "ckan_get_mqa_quality",
  "ckan_get_mqa_quality_details",
  "ckan_analyze_datasets",
  "ckan_catalog_stats",
  "sparql_query",
  "ckan_find_portals"
];

/** The six tools a CKAN pack calls, in routing order (D2). */
export const CKAN_PACK_TOOL_NAMES: readonly string[] = [
  'ckan_package_search',
  'ckan_find_relevant_datasets',
  'ckan_package_show',
  'ckan_list_resources',
  'ckan_datastore_search',
  'ckan_datastore_search_sql',
];

/** The passages of a pack tool's description, exactly as the server writes
 *  them at the pinned commit, that name a base tool no CKAN pack carries:
 *  the pack builder removes each, and nothing else (finding 2 = (b)). Two,
 *  both in `ckan_package_search`'s description and both naming
 *  `ckan_status_show`: the locale sentence of its "Query language" block
 *  (the sentences after it stay true without it), and the first step of its
 *  workflow line (the three steps after it are the pack's). A passage not
 *  found exactly once in the server's text stops the build of the pack by
 *  name, so a changed capture cannot keep or lose one silently. */
export const CKAN_PACK_DESCRIPTION_CUTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ckan_package_search: Object.freeze([
    '  Before searching a portal, check its locale via ckan_status_show (field: "Portal Locale" / locale_default).\n',
    'ckan_status_show (check locale) → ',
  ]),
});

/** The six schemas at the pinned commit, as function tools, in
 *  `CKAN_PACK_TOOL_NAMES`' order: each `inputSchema` is the tool's
 *  `parameters`, unchanged, and `server_url` is still open (a pack fixes
 *  it). */
export const CKAN_PACK_BASE_TOOLS: readonly FunctionToolSchema[] = [
  {
    "type": "function",
    "function": {
      "name": "ckan_package_search",
      "description": "Search for datasets (packages) on a CKAN server using Solr query syntax.\n\nSupports full Solr search capabilities including filters, facets, and sorting.\nUse this to discover datasets matching specific criteria.\n\nNote on parser behavior:\nSome CKAN portals use a restrictive default query parser that can break long OR queries.\nFor those portals, this tool may force the query into 'text:(...)' based on per-portal config.\nYou can override with 'query_parser' to force or disable this behavior per request.\n\nImportant - Date field semantics:\n  - issued: publisher's content publish date when available (best proxy for \"created/published\")\n  - modified: publisher's content update date when available\n  - metadata_created: CKAN record creation timestamp (publish time on source portals,\n    harvest time on aggregators; fallback for \"created\" if issued missing)\n  - metadata_modified: CKAN record update timestamp (publish time on source portals,\n    harvest time on aggregators; use for \"updated/modified in last X\")\n\nNatural language mapping (important for tool callers):\n  - \"created\"/\"published\" -> prefer issued; fallback to metadata_created\n  - \"updated\"/\"modified\" -> prefer modified; fallback to metadata_modified\n  - For \"recent in last X\", consider using content_recent (issued with metadata_created fallback)\n\nContent-recent helper:\n  - content_recent: if true, rewrites the query to use issued with a fallback to\n    metadata_created when issued is missing.\n  - content_recent_days: window for content_recent (default 30 days).\n\nArgs:\n  - server_url (string): Base URL of CKAN server (e.g., \"https://dati.gov.it/opendata\")\n  - q (string): Search query using Solr syntax (default: \"*:*\" for all)\n  - fq (string): Filter query (e.g., \"organization:comune-palermo\")\n    IMPORTANT — Solr fq syntax rules:\n    1. OR inside a single field: use field:(val1 OR val2), NOT field:val1 OR field:val2.\n       Wrong: fq=type:\"A\" OR type:\"B\"  → silently ignored, returns entire catalog.\n       Right:  fq=type:(\"A\" OR \"B\")\n    2. CKAN extras fields are indexed as extras_fieldname, not fieldname.\n       e.g. to filter on extra field \"hvd_category\" use fq=extras_hvd_category:\"<value>\"\n  - rows (number): Number of results to return (default: 10, max: 1000)\n  - start (number): Offset for pagination (default: 0)\n  - page (number): Page number (1-based); alias for start. Overrides start if provided.\n  - page_size (number): Results per page when using page (default: 10, max: 1000)\n  - sort (string): Sort field and direction (e.g., \"metadata_modified desc\")\n  - facet_field (array): Fields to facet on (e.g., [\"organization\", \"tags\"])\n  - facet_limit (number): Max facet values per field (default: 50)\n  - include_drafts (boolean): Include draft datasets (default: false)\n  - query_parser ('default' | 'text'): Override search parser behavior\n  - response_format ('markdown' | 'json'): Output format\n\nReturns:\n  Search results with:\n  - count: Number of results found\n  - results: Array of dataset objects\n  - facets: Facet counts (if facet_field specified)\n  - search_facets: Detailed facet information\n\nQuery Syntax (parameter q):\n  Boolean operators:\n    - AND / &&: \"water AND climate\"\n    - OR / ||: \"health OR sanità\"\n    - NOT / !: \"data NOT personal\"\n    - +required -excluded: \"+title:water -title:sea\"\n    - Grouping: \"(title:water OR title:climate) AND tags:environment\"\n\n  Wildcards:\n    - *: \"title:environment*\" (matches environmental, environments, etc.)\n    - Note: Left truncation (*water) not supported\n\n  Fuzzy search (edit distance):\n    - ~: \"title:rest~\" or \"title:rest~1\" (finds \"test\", \"best\", \"rest\")\n\n  Proximity search (words within N positions):\n    - \"phrase\"~N: \"title:\"climate change\"~5\"\n\n  Range queries:\n    - Inclusive [a TO b]: \"num_resources:[5 TO 10]\"\n    - Exclusive {a TO b}: \"num_resources:{0 TO 100}\"\n    - One side open: \"metadata_modified:[2024-01-01T00:00:00Z TO *]\"\n\n  Date math:\n    - NOW-1YEAR, NOW-6MONTHS, NOW-7DAYS, NOW-1HOUR\n    - NOW/DAY, NOW/MONTH (round down)\n    - Combined: \"metadata_modified:[NOW-2MONTHS TO NOW]\"\n    - Example: \"metadata_created:[NOW-1YEAR TO *]\"\n    - IMPORTANT: NOW syntax works on metadata_modified and metadata_created fields\n    - For 'modified' and 'issued' fields, NOW syntax is auto-converted to ISO dates\n    - Manual ISO dates always work: \"modified:[2026-01-15T00:00:00Z TO *]\"\n\n  Field existence:\n    - Exists: \"field:*\" or \"field:[* TO *]\"\n    - Not exists: \"NOT field:*\" or \"-field:*\"\n\n  Boosting (relevance scoring):\n    - Boost term: \"title:water^2 OR notes:water\" (title matches score higher)\n    - Constant score: \"title:water^=1.5\"\n\nExamples:\n  - Search all: { q: \"*:*\" }\n  - By tag: { q: \"tags:sanità\" }\n  - Boolean: { q: \"(title:water OR title:climate) AND NOT title:sea\" }\n  - Wildcard: { q: \"title:environment*\" }\n  - Fuzzy: { q: \"title:health~2\" }\n  - Proximity: { q: \"notes:\"open data\"~3\" }\n  - Date range: { q: \"metadata_modified:[2024-01-01T00:00:00Z TO 2024-12-31T23:59:59Z]\" }\n  - Date math: { q: \"metadata_modified:[NOW-6MONTHS TO *]\" }\n  - Date math (auto-converted): { q: \"modified:[NOW-30DAYS TO NOW]\" }\n  - Published in 2025 (content date): { fq: \"issued:[2025-01-01T00:00:00Z TO 2025-12-31T23:59:59Z]\" }\n  - First appeared on portal in 2025: { fq: \"metadata_created:[2025-01-01T00:00:00Z TO 2025-12-31T23:59:59Z]\" }\n  - Recent content (issued w/ fallback): { q: \"*:*\", content_recent: true, content_recent_days: 180 }\n  - Field exists: { q: \"organization:* AND num_resources:[1 TO *]\" }\n  - Boosting: { q: \"title:climate^2 OR notes:climate\" }\n  - Filter org: { fq: \"organization:regione-siciliana\" }\n  - Filter extras field (correct): { fq: \"extras_hvd_category:\"http://data.europa.eu/bna/c_ac64a52d\"\" }\n  - Filter extras OR (correct): { fq: \"extras_hvd_category:(\"http://data.europa.eu/bna/c_ac64a52d\" OR \"http://data.europa.eu/bna/c_dd313021\")\" }\n  - Get facets: { facet_field: [\"organization\"], rows: 0 }\n\nQuery language:\n  Before searching a portal, check its locale via ckan_status_show (field: \"Portal Locale\" / locale_default).\n  Translate query terms to the portal's language — searching in English on a non-English portal returns 0 results.\n  Examples: locale \"it\" → Italian terms; \"uk_UA\" → Ukrainian (Cyrillic); \"fr_FR\" → French.\n  Exception: multilingual portals (e.g. data.europa.eu, open.canada.ca) accept EN + native terms joined with OR.\n\nTypical workflow: ckan_status_show (check locale) → ckan_package_search (query in portal's language) → ckan_package_show (get full metadata + resource IDs) → ckan_datastore_search (query tabular data)",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server"
          },
          "q": {
            "type": "string",
            "default": "*:*",
            "description": "Search query in Solr syntax"
          },
          "fq": {
            "type": "string",
            "description": "Filter query in Solr syntax; applied after scoring, does not affect relevance. CKAN extras fields use prefix 'extras_' (e.g. extras_hvd_category). For OR on same field use field:(val1 OR val2), never field:val1 OR field:val2 (silently breaks). Examples: 'organization:comune-palermo', 'res_format:CSV', 'extras_hvd_category:(\"uri1\" OR \"uri2\")'."
          },
          "rows": {
            "type": "integer",
            "minimum": 0,
            "maximum": 1000,
            "default": 10,
            "description": "Number of results to return"
          },
          "start": {
            "type": "integer",
            "minimum": 0,
            "default": 0,
            "description": "Offset for pagination"
          },
          "sort": {
            "type": "string",
            "description": "Sort field and direction (e.g., 'metadata_modified desc')"
          },
          "facet_field": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Fields to facet on"
          },
          "facet_limit": {
            "type": "integer",
            "minimum": 1,
            "default": 50,
            "description": "Maximum facet values per field"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "description": "Page number (1-based); alias for start. Overrides start if provided."
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000,
            "default": 10,
            "description": "Results per page when using page (default: 10)"
          },
          "include_drafts": {
            "type": "boolean",
            "default": false,
            "description": "Include draft datasets"
          },
          "content_recent": {
            "type": "boolean",
            "default": false,
            "description": "Use issued date with fallback to metadata_created for recent content"
          },
          "content_recent_days": {
            "type": "integer",
            "minimum": 1,
            "default": 30,
            "description": "Day window for content_recent (default 30)"
          },
          "query_parser": {
            "type": "string",
            "enum": [
              "default",
              "text"
            ],
            "description": "Override search parser ('text' forces text:(...) on non-fielded queries)"
          },
          "response_format": {
            "type": "string",
            "enum": [
              "markdown",
              "json"
            ],
            "default": "markdown",
            "description": "Output format: 'markdown' for human-readable or 'json' for machine-readable"
          }
        },
        "required": [
          "server_url"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "ckan_find_relevant_datasets",
      "description": "Find and rank datasets by relevance to a query using weighted fields.\n\nUse this instead of ckan_package_search when you want relevance-ranked results with\nexplicit scoring across title, notes, tags, and organization fields.\nUse ckan_package_search instead when you need Solr filter syntax, facets, or pagination.\n\nUses package_search for discovery and applies a local scoring model.\n\nArgs:\n  - server_url (string): Base URL of CKAN server (e.g., \"https://dati.gov.it/opendata\")\n  - query (string): Natural language or keyword query (e.g., \"mobilità urbana\", \"air quality\")\n  - limit (number): Number of datasets to return (default: 10)\n  - weights (object): Field weights for scoring — higher weight = more influence on rank\n    Default: title=4, tags=3, notes=2, organization=1, holder=4, publisher=2, coverage=4\n    coverage: bonus for datasets the portal returned with every query term required\n    (Solr mm=100%); these are fetched first, the rest fills in when they are fewer than limit\n    Note on holder vs organization: on federated catalogs (e.g. dati.gov.it), `organization`\n    is the harvesting catalog (e.g. Regione Puglia), while `holder` (DCAT-AP_IT dct:rightsHolder)\n    is the actual data owner (e.g. Comune di Lecce). Queries like \"datasets from a specific Comune\"\n    match `holder` correctly; matching only `organization` misses datasets harvested via\n    aggregators. `publisher` (dct:publisher) is scored separately at lower weight as it can\n    contain technical roles (\"Redazione OD\") rather than the institutional owner.\n  - query_parser ('default' | 'text'): Override search parser behavior\n  - response_format ('markdown' | 'json'): Output format\n\nReturns:\n  Ranked datasets with relevance scores and per-field score breakdowns\n\nExamples:\n  - { server_url: \"https://dati.gov.it/opendata\", query: \"mobilità\" }\n  - { server_url: \"...\", query: \"trasporti\", limit: 5, weights: { title: 5, notes: 2 } }\n  - { server_url: \"...\", query: \"defibrillatori Comune di Lecce\", weights: { holder: 5 } }\n\nTypical workflow: ckan_find_relevant_datasets → ckan_package_show (inspect top results) → ckan_datastore_search (query data)",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"
          },
          "query": {
            "type": "string",
            "minLength": 2,
            "description": "Natural language or keyword query to match against dataset title, notes, tags, organization, holder and publisher"
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "default": 10,
            "description": "Number of datasets to return"
          },
          "weights": {
            "type": "object",
            "properties": {
              "title": {
                "type": "number",
                "minimum": 0,
                "description": "Weight for title match (default 4)"
              },
              "notes": {
                "type": "number",
                "minimum": 0,
                "description": "Weight for description match (default 2)"
              },
              "tags": {
                "type": "number",
                "minimum": 0,
                "description": "Weight for tag match (default 3)"
              },
              "organization": {
                "type": "number",
                "minimum": 0,
                "description": "Weight for organization (CKAN catalog / harvester) match (default 1)"
              },
              "holder": {
                "type": "number",
                "minimum": 0,
                "description": "Weight for holder_name match — DCAT-AP_IT dct:rightsHolder, the actual data owner (default 4)"
              },
              "publisher": {
                "type": "number",
                "minimum": 0,
                "description": "Weight for publisher_name match — DCAT-AP_IT dct:publisher (default 2)"
              },
              "coverage": {
                "type": "number",
                "minimum": 0,
                "description": "Bonus for datasets the portal returned with every query term required (default 4)"
              }
            },
            "additionalProperties": false,
            "description": "Per-field scoring weights; unspecified fields use defaults"
          },
          "query_parser": {
            "type": "string",
            "enum": [
              "default",
              "text"
            ],
            "description": "Override search parser ('text' forces text:(...) on non-fielded queries)"
          },
          "response_format": {
            "type": "string",
            "enum": [
              "markdown",
              "json"
            ],
            "default": "markdown",
            "description": "Output format: 'markdown' for human-readable or 'json' for machine-readable"
          }
        },
        "required": [
          "server_url",
          "query"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "ckan_package_show",
      "description": "Get complete metadata for a specific dataset (package).\n\nReturns full details including resources, organization, tags, and all metadata fields.\n\nNotes:\n  - metadata_modified is a CKAN record timestamp (publish time on source portals,\n    harvest time on aggregators), not the content date.\n  - issued/modified are content dates when provided by the publisher.\n  - JSON output adds metadata_harvested_at (same as metadata_modified).\n\nArgs:\n  - server_url (string): Base URL of CKAN server\n  - id (string): Dataset ID or name (machine-readable slug)\n  - include_tracking (boolean): Include view/download statistics (default: false)\n  - response_format ('markdown' | 'json'): Output format\n\nOn portals that use ckanext-scheming the schema's other root fields are added as \"fields\"\n([{field, label, value}]), each with the label the schema gives it and the value as stored.\nPortals without scheming are unaffected.\n\nReturns (JSON format):\n  id, name, title, notes, organization, tags, state, license_title,\n  metadata_created, metadata_modified, issued, modified,\n  author, maintainer,\n  frequency, language, publisher_name, holder_name,\n  hvd_category, applicable_legislation,\n  temporal_coverage (array of {start, end, start_equals_issued} from dct:temporal; empty if absent;\n    start_equals_issued=true when start = issued and no end: on dcatapit portals an export default, not a data period),\n  resources (id, name, format, url, size, datastore_active, created, last_modified, api_json_url),\n  view_url, api_json_url\n\nExamples:\n  - { server_url: \"https://dati.gov.it/opendata\", id: \"dataset-name\" }\n  - { server_url: \"...\", id: \"abc-123-def\", include_tracking: true }\n\nTypical workflow: ckan_package_show → pick a resource with datastore_active=true → ckan_datastore_search (query its data)",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Dataset ID (UUID) or machine-readable name slug (e.g., 'raccolta-differenziata-comuni')"
          },
          "include_tracking": {
            "type": "boolean",
            "default": false,
            "description": "Include tracking statistics"
          },
          "response_format": {
            "type": "string",
            "enum": [
              "markdown",
              "json"
            ],
            "default": "markdown",
            "description": "Output format: 'markdown' for human-readable or 'json' for machine-readable"
          }
        },
        "required": [
          "server_url",
          "id"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "ckan_list_resources",
      "description": "List all resources in a dataset with a compact summary.\n\nReturns a focused table of resources showing format, size, DataStore availability, and download URL.\nUse this to quickly assess what files a dataset contains before deciding how to access the data.\n\nArgs:\n  - server_url (string): Base URL of CKAN server\n  - id (string): Dataset ID or name\n  - format_filter (string): Filter resources by format, case-insensitive (e.g., \"CSV\", \"json\", \"XLSX\")\n  - response_format ('markdown' | 'json'): Output format\n\nReturns:\n  Compact resource summary with name, ID, format, size, DataStore flag, and URL\n\nExamples:\n  - { server_url: \"https://dati.gov.it/opendata\", id: \"dataset-name\" }\n  - { server_url: \"...\", id: \"dataset-name\", format_filter: \"CSV\" }\n\nTypical workflow: ckan_package_search → ckan_list_resources (assess available files) → ckan_datastore_search (for resources with DataStore=true)\n\nWhen a resource has DataStore=false but its download URL belongs to a different (source) portal,\nthe tool can probe the source portal for DataStore availability and report\nsource_datastore_active and source_portal_url so you can query the data there instead.\nThis probing is OFF by default (it issues extra HTTP requests to hosts taken from the\ndataset's own resource URLs); set check_source_portal=true to enable it.",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server"
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Dataset ID or name"
          },
          "format_filter": {
            "type": "string",
            "description": "Filter resources by format, case-insensitive (e.g., 'CSV', 'json', 'XLSX')"
          },
          "check_source_portal": {
            "type": "boolean",
            "description": "Opt-in (default false): when true, probes the source portal for DataStore availability when a resource URL points to a different CKAN instance. Issues extra HTTP requests to hosts taken from the dataset's resource URLs."
          },
          "response_format": {
            "type": "string",
            "enum": [
              "markdown",
              "json"
            ],
            "default": "markdown",
            "description": "Output format: 'markdown' for human-readable or 'json' for machine-readable"
          }
        },
        "required": [
          "server_url",
          "id"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "ckan_datastore_search",
      "description": "Query data from a CKAN DataStore resource.\n\nThe DataStore allows SQL-like queries on tabular data. Not all resources have DataStore enabled.\n\nThe response always includes a Fields section listing all available column names and types.\nUse limit=0 to discover column names without fetching data — do this before using filters\nto avoid guessing column names and getting HTTP 400 errors.\n\nArgs:\n  - server_url (string): Base URL of CKAN server\n  - resource_id (string): ID of the DataStore resource\n  - q (string): Full-text search query (optional)\n  - filters (object): Key-value filters (e.g., { \"anno\": 2023 })\n  - limit (number): Max rows to return (default: 100, max: 32000)\n  - offset (number): Pagination offset (default: 0)\n  - fields (array): Specific fields to return (optional)\n  - sort (string): Sort field with direction (e.g., \"anno desc\")\n  - distinct (boolean): Return distinct values (default: false)\n  - response_format ('markdown' | 'json'): Output format\n\nReturns:\n  DataStore records matching query, always including available column names and types\n\nExamples:\n  - { server_url: \"...\", resource_id: \"abc-123\", limit: 0 }  ← discover columns first\n  - { server_url: \"...\", resource_id: \"abc-123\", limit: 50 }\n  - { server_url: \"...\", resource_id: \"...\", filters: { \"regione\": \"Sicilia\" } }\n  - { server_url: \"...\", resource_id: \"...\", sort: \"anno desc\", limit: 100 }\n\nTypical workflow: ckan_package_search → ckan_package_show (find resource_id with datastore_active=true) → ckan_datastore_search (limit=0 to get columns) → ckan_datastore_search (with filters)",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"
          },
          "resource_id": {
            "type": "string",
            "minLength": 1,
            "description": "UUID of the DataStore resource (from ckan_package_show resource.id where datastore_active is true)"
          },
          "q": {
            "type": "string",
            "description": "Full-text search across all fields"
          },
          "filters": {
            "type": "object",
            "additionalProperties": {},
            "description": "Key-value filters for exact matches (e.g., { \"regione\": \"Sicilia\", \"anno\": 2023 })"
          },
          "limit": {
            "type": "integer",
            "minimum": 0,
            "maximum": 32000,
            "default": 100,
            "description": "Max rows to return (default 100, max 32000); use 0 to get only column names without data"
          },
          "offset": {
            "type": "integer",
            "minimum": 0,
            "default": 0,
            "description": "Pagination offset"
          },
          "fields": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Specific field names to return; omit to return all fields"
          },
          "sort": {
            "type": "string",
            "description": "Sort expression (e.g., 'anno desc', 'nome asc')"
          },
          "distinct": {
            "type": "boolean",
            "default": false,
            "description": "Return only distinct rows"
          },
          "response_format": {
            "type": "string",
            "enum": [
              "markdown",
              "json"
            ],
            "default": "markdown",
            "description": "Output format: 'markdown' for human-readable or 'json' for machine-readable"
          }
        },
        "required": [
          "server_url",
          "resource_id"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "ckan_datastore_search_sql",
      "description": "Run SQL queries on a CKAN DataStore resource.\n\nThis endpoint is only available on CKAN portals with DataStore enabled and SQL access exposed.\n\nArgs:\n  - server_url (string): Base URL of CKAN server\n  - sql (string): SQL query (e.g., SELECT * FROM \"resource_id\" LIMIT 10)\n  - response_format ('markdown' | 'json'): Output format\n\nReturns:\n  SQL query results from DataStore\n\nExamples:\n  - { server_url: \"...\", sql: \"SELECT * FROM \"abc-123\" LIMIT 10\" }\n  - { server_url: \"...\", sql: \"SELECT COUNT(*) AS total FROM \"abc-123\"\" }\n\nTypical workflow: ckan_package_show (get resource_id) → ckan_datastore_search_sql (run SQL on it)\n\nSecurity note: SQL queries are forwarded directly to the CKAN DataStore API. The CKAN server enforces its own access controls and read-only permissions. No local database is exposed. Queries are limited to public DataStore resources on the target portal.",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server (e.g., https://dati.gov.it/opendata)"
          },
          "sql": {
            "type": "string",
            "minLength": 1,
            "description": "SQL SELECT query; resource_id is the table name, must be double-quoted (e.g., SELECT * FROM \"abc-123\" LIMIT 10)"
          },
          "response_format": {
            "type": "string",
            "enum": [
              "markdown",
              "json"
            ],
            "default": "markdown",
            "description": "Output format: 'markdown' for human-readable or 'json' for machine-readable"
          }
        },
        "required": [
          "server_url",
          "sql"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  }
];

/** The guidance of a server that sends none. */
const NO_GUIDANCE: GuidanceEntry<CivicGuidanceContext> = Object.freeze({
  async fetchText() {
    return '';
  },
});

/**
 * The hosted CKAN server's manifest entry: the mirror of its inventory
 * entry. It declares no tools, so it is never in a list the model reads (the
 * router leaves an entry with no tool names out of the preamble, the outro,
 * the directory, `load_source`'s choices, the lock text and the search's
 * hits); it is in every list a record states. Optional, with no default
 * address: offered, with its packs, only when `CKAN_MCP_URL` is set.
 *
 * One variant: the hosted server, run by whoever operates it, reaching the
 * portals its operator lists. As with the Socrata server, the instance
 * decides who holds its logs, so they are named by role.
 */
export const CKAN_SERVER_ENTRY: CivicManifestEntry = {
  id: '@aborruso/ckan-mcp-server@https://github.com/npstorey/ckan-mcp-server',
  alias: 'ckan',
  sourceId: CKAN_SERVER_SOURCE_ID,
  displayName: CKAN_SERVER_WORDS.displayName,
  description: CKAN_SERVER_WORDS.description,
  freshness: CKAN_SERVER_WORDS.freshness,
  configuration: {
    addressVariable: CKAN_ADDRESS_VARIABLE,
    requirement: 'optional',
  },
  tools: [],
  toolNames: [],
  guidance: NO_GUIDANCE,
  hostings: [
    {
      variant: 'remote',
      kind: 'remote',
      runsAt: 'other',
      logging: [
        { statedBy: 'instance', role: 'server-operator' },
        { statedBy: 'instance', role: 'portal-operator' },
      ],
    },
  ],
  consentDefault: 'on',
  publisher: CKAN_SERVER_WORDS.publisher,
};

// --- CKAN-2 P2 (hub issue 329): typed stubs, empty until the server offers
// its own tools (D2 = B). -------------------------------------------------------

/** The seven tools the entry offers, in routing order: a typed stub. */
export const CKAN_TOOL_NAMES: readonly string[] = [];

/** The seven schemas the entry offers: a typed stub. */
export const CKAN_TOOLS: readonly FunctionToolSchema[] = [];

/** The entry's guidance (`docs/skills/ckan.md`): a typed stub. */
export const CKAN_GUIDANCE: string = '';
