// The hosted CKAN server (CKAN-1 P2, hub issue 314; since 0.12.0, CKAN-2
// P2, hub issue 329): a source that offers seven of its own tools.
//
// The server is a pinned fork of the open-source ckan-mcp-server
// (github.com/npstorey/ckan-mcp-server), which the project hosts at an
// address the instance configures (`CKAN_MCP_URL`). Through 0.11.0 its entry
// declared no tools and a portal was a pack over it (Analyze Boston, retired
// in 0.12.0: `./retired.ts`). Since 0.12.0 the entry offers seven of its 20
// tools (D2 = B): the six a pack called and `ckan_status_show`, each with
// `server_url` open, so each call names its portal. Its
// `initialize` result carries no `instructions`; its guidance is this
// package's text (`docs/skills/ckan.md`), written for any portal.
//
// The seven schemas are the server's own, as its `tools/list` returns them
// at the captured commit: captured by `src/__fixtures__/pin-ckan-tools.mjs`
// into `src/__fixtures__/ckan-tools.json`, and held equal to it by
// `src/ckan.test.ts`. They are code because the build reads no JSON, and
// text the router does not own: the aliased view gives their descriptions
// the anchored rewrite. Each description is the server's whole text; the
// one change is the statement rule on `ckan_datastore_search_sql`'s `sql`
// argument (CKAN-1's D3 = A).

import { BARE_VIEW } from '../core/alias.ts';
import type { FunctionToolSchema, GuidanceEntry, JsonSchema, SourceView } from '../core/types.ts';
import { CKAN_SERVER_WORDS } from './ckan-words.ts';
import type { CivicGuidanceContext, CivicManifestEntry } from './context.ts';
import { CKAN_ADDRESS_VARIABLE } from './env.ts';

/** The hosted CKAN server's source id. */
export const CKAN_SERVER_SOURCE_ID = 'ckan-server';

/** The server's 20 tool names, in the order its `tools/list` returns them
 *  at the captured commit. */
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

/** The seven tools the entry offers, in routing order (D2 = B, since
 *  0.12.0): the six a CKAN pack called through 0.11.0, then
 *  `ckan_status_show`. */
export const CKAN_TOOL_NAMES: readonly string[] = [
  'ckan_package_search',
  'ckan_find_relevant_datasets',
  'ckan_package_show',
  'ckan_list_resources',
  'ckan_datastore_search',
  'ckan_datastore_search_sql',
  'ckan_status_show',
];

/** The seven schemas as the server lists them at the captured commit, as
 *  function tools, in `CKAN_TOOL_NAMES`' order: each `parameters` is the
 *  tool's `inputSchema`, unchanged, and each description is the server's
 *  whole text. `server_url` is open in each. */
const LISTED_TOOLS: readonly FunctionToolSchema[] = [
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
  },
  {
    "type": "function",
    "function": {
      "name": "ckan_status_show",
      "description": "Check if a CKAN server is available and get version information.\n\nUseful to verify server accessibility before making other requests.\nAlso shows the count of High-Value Datasets (HVD) when the portal supports it.\n\nArgs:\n  - server_url (string): Base URL of CKAN server\n\nReturns:\n  Server status, version information, and HVD dataset count (if available)\n\nTypical workflow: ckan_status_show (verify server is up) → ckan_package_search (discover datasets)",
      "parameters": {
        "type": "object",
        "properties": {
          "server_url": {
            "type": "string",
            "format": "uri",
            "description": "Base URL of the CKAN server"
          }
        },
        "required": [
          "server_url"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  }
];

/** What `ckan_datastore_search_sql`'s `sql` argument adds to the server's
 *  own description (CKAN-1's D3 = A): the statement rule the instance holds a
 *  call to before it is sent. */
const SQL_STATEMENT_RULE =
  'One statement only: it begins, after any whitespace and SQL comments, with SELECT or WITH, and no second statement follows a semicolon outside a quoted literal. Any other statement is refused before it is sent.';

type Properties = { properties: Record<string, unknown> } & Record<string, unknown>;

/** `ckan_datastore_search_sql` with its `sql` argument stating the
 *  statement rule; every other member is the server's. */
function withStatementRule(tool: FunctionToolSchema): FunctionToolSchema {
  const parameters = tool.function.parameters as Properties;
  const sql = parameters.properties.sql as { description?: string } & Record<string, unknown>;
  return {
    ...tool,
    function: {
      ...tool.function,
      parameters: {
        ...parameters,
        properties: { ...parameters.properties, sql: { ...sql, description: `${sql.description ?? 'SQL query'}. ${SQL_STATEMENT_RULE}` } },
      } as JsonSchema,
    },
  };
}

/** The seven tools the entry offers (since 0.12.0): the server's schemas,
 *  `server_url` open in each, with `ckan_datastore_search_sql`'s `sql`
 *  argument stating the statement rule. Text the router does not own: the
 *  aliased view renames them and gives their descriptions the anchored
 *  rewrite. */
export const CKAN_TOOLS: readonly FunctionToolSchema[] = LISTED_TOOLS.map((tool) =>
  tool.function.name === 'ckan_datastore_search_sql' ? withStatementRule(tool) : tool,
);

/** The entry's guidance: the hub's CKAN guidance for the seven tools
 *  (`docs/skills/ckan.md`, less its final newline), written for any portal
 *  and naming `https://data.boston.gov` for Boston. It names each tool in
 *  backticks or bold, so the aliased view gives it the anchored rewrite. */
export const CKAN_GUIDANCE = `# CKAN portals: guidance for the CKAN tools

Guidance for querying open data on CKAN portals through seven tools of a hosted CKAN server. Every call names the portal it reads in \`server_url\`: the portal's base URL, such as \`https://data.boston.gov\`. The server reads only the portals its operator lists; a call naming any other portal is refused and returns no data.

## Which portal

- **Boston**: Analyze Boston, the City of Boston's portal, is \`https://data.boston.gov\`. Boston's city data is there, not on Socrata: 311 requests, permits, crime, inspections, property records, elections, schools, parcels, parking, neighborhoods.
- **Another place**: pass the base URL of the CKAN portal that publishes its data. Do not guess an address: if you do not know a place's portal, say so. \`ckan_status_show\` tells you whether an address answers as a CKAN portal.
- **Use Socrata** for cities whose portals run Socrata (NYC, Chicago, SF, Seattle, LA).
- **Use Data Commons for demographics**: ACS, Census and BLS figures. A CKAN portal is not where demographic tables are. For Boston: Suffolk County (\`geoId/25025\`), Boston city (\`geoId/2507000\`), or tracts.

When a question mixes operational and demographic data ("311 noise per capita by neighborhood"), plan a multi-source analysis: operational counts from the portal, the population denominator from Data Commons. State the geography caveat when the portal's areas are not standard census geographies.

## CKAN and Socrata, side by side

On CKAN a dataset is a package holding one or more resources; a resource whose rows are loaded into the portal's DataStore is the table you query, by its resource id.

| Concern | Socrata | CKAN |
|---------|---------|------|
| Portal | the \`portal\` argument or the server's own portal | \`server_url\`, on every call |
| Query language | SoQL | PostgreSQL \`SELECT\`, through \`ckan_datastore_search_sql\` |
| Table identity | 4x4 dataset code (\`erm2-nwe9\`) | resource id, a UUID (\`8048697b-ad64-4bfc-b090-ee00169f2323\`) |
| Identifier quoting in SQL | not required | the resource id **must** be double-quoted: \`FROM "uuid-here"\` |
| Column discovery | \`get_data\` with \`LIMIT 1\` | \`ckan_datastore_search\` with \`"limit": 0\` |
| Writes | not exposed | not exposed: one \`SELECT\` or \`WITH\` statement per call |

## Typical workflow chain

1. **\`ckan_status_show\`**: whether the portal answers, its CKAN version, and its locale where the portal states one. Search in the portal's language: a search in English on a portal in another language can return nothing.
2. **\`ckan_find_relevant_datasets\`**: a keyword search, ranked. A good first step when you do not know the dataset.
3. **\`ckan_package_search\`**: the catalogue search in Solr syntax, for filters (\`fq\`), facets, sorting and paging.
4. **\`ckan_package_show\`**: one dataset's full metadata, with its resources; pick the resource whose \`datastore_active\` is true.
5. **\`ckan_list_resources\`**: a short table of a dataset's resources (format, size, whether each is in the DataStore), when a dataset bundles several.
6. **\`ckan_datastore_search\`**: rows of one resource by its resource id, with exact-match \`filters\`, \`q\`, \`sort\`, \`limit\` and \`offset\`. Call it with \`"limit": 0\` first: the answer lists the resource's column names and types and no rows. Each portal uses its own column names, not the ones a model may have memorized from another city.
7. **\`ckan_datastore_search_sql\`**: one \`SELECT\` or \`WITH\` statement over a resource, for \`GROUP BY\`, counts, sums, joins, window functions and percentiles. The table name is the resource id, double-quoted.

Do not skip the search, the dataset's details and the column check on an unfamiliar dataset: a guessed column name against a wide CKAN resource returns zero rows or a SQL error. A resource whose \`datastore_active\` is false has no rows the DataStore tools can read: say so, and give its download URL instead.

## Boston-specific geographies

- **Neighborhoods**: not Census tracts. About 20 city-maintained names (Dorchester, Roxbury, Jamaica Plain, South Boston, ...).
- **BPD districts**: 12 police districts (A1, A7, B2, B3, C6, C11, D4, D14, E5, E13, E18). Different from neighborhoods.
- **BPS school zones**: Boston Public Schools has its own geography; present on school datasets only.
- **Parcel IDs**: 10-digit strings. Assessor data is keyed on parcel, not address; to go from an address to a parcel, query the parcels dataset first.
- **ZIP codes**: the \`021xx\` range. Boston crosses multiple ZIPs; take care when comparing against ACS ZCTAs.

Neighborhoods do **not** map cleanly to Census tracts. When joining Boston operational data with Data Commons tract-level demographics, state the geography mismatch rather than silently imputing.

## Caveats

- **Update cadence varies by portal and by dataset.** Surface \`metadata_modified\`, or a resource's \`last_modified\`, when the question is time-sensitive.
- **The hosted server may reuse an answer.** A repeated request can return an answer up to a minute old for a resource's rows, up to five minutes old for a dataset search or a dataset's details, and up to an hour old for a portal's status.
- **Coverage gaps.** A portal may publish only part of an agency's data. If a natural query returns empty, the data genuinely may not be there: say so rather than fishing.
- **Resource ids change** when a dataset gets a new resource. Look the id up again with \`ckan_package_show\` in each session; do not carry ids across runs.
- **Hot-spotting risk.** Crime and 311 point-level data can be re-identifying when filtered narrowly. Honor aggregation thresholds: do not report a single address.

## Attribution

Cite each figure with the portal's URL, the dataset title, the resource id, and the SQL or the search arguments that produced it. The record captures tool calls and their arguments automatically; your job in the text is to make the citation human-readable.`;

/** The entry's guidance in `view`. */
const GUIDANCE: GuidanceEntry<CivicGuidanceContext> = Object.freeze({
  async fetchText(_context: CivicGuidanceContext, view: SourceView = BARE_VIEW) {
    return view.sourceText(CKAN_SERVER_SOURCE_ID, CKAN_GUIDANCE);
  },
});

/**
 * The hosted CKAN server's manifest entry: the mirror of its inventory
 * entry. Optional, with no default address: offered only when
 * `CKAN_MCP_URL` is set. Since 0.12.0 it offers seven of its own tools, each
 * naming its portal in `server_url`, and its own guidance.
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
  freshnessSource: CKAN_SERVER_WORDS.freshnessSource,
  configuration: {
    addressVariable: CKAN_ADDRESS_VARIABLE,
    requirement: 'optional',
  },
  tools: CKAN_TOOLS,
  toolNames: CKAN_TOOL_NAMES,
  guidance: GUIDANCE,
  prompt: {
    citation: CKAN_SERVER_WORDS.citation,
    lockMention: CKAN_SERVER_WORDS.lockMention,
  },
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
