// The NYS Open Legislation source: a publisher's MCP server the instance runs
// itself, from a pinned package, rather than one it calls at a configured
// address.
//
// The server is BetaNYC's `@betanyc/nys-openlegislation-mcp` on npm. It
// serves over stdio only, and every tool call it answers is a request to the
// New York State Senate's Open Legislation API at one host:
// `legislation.nysenate.gov` (its `dist/api.js` at 2.4.0). The API takes a key,
// `NYS_LEGISLATION_API_KEY`, which the server reads at start and sends in the
// request URL of every call; it exits at start with neither a key nor a local
// corpus, and the package ships no corpus. The instance runs the pinned
// version in a sandbox it creates, behind a bridge from stdio to HTTP, with
// that one host as the sandbox's outbound allowance, and supplies the key;
// both are the consumer's, not this package's.
//
// The 24 schemas below are the server's own, as its `tools/list` returns
// them at the pinned version: captured by
// `src/__fixtures__/pin-nys-legislation-tools.mjs` into
// `src/__fixtures__/nys-legislation-tools.json`, and held equal to it by
// `src/hosted-entries.test.ts`. They are code because the build reads no JSON.
// A run of thirteen or more digits in them (an example identifier in a
// description) is written with one digit in nine as a `\u` escape, as in the
// fixture: the string is the server's, character for character. They are
// text the router does not own, so the aliased view gives their descriptions
// the anchored rewrite, as it does a server's instructions.
//
// The source sends no guidance: its `initialize` result carries no
// `instructions` and it serves no prompt, so its guidance entry returns ''
// and calls neither fetcher. Offering it never wakes it.

import type { FunctionToolSchema, NpmPackageVariant, SourceHosting } from '../core/types.ts';
import type { CivicManifestEntry } from './context.ts';
import { HOSTING_SANDBOX, NYS_LEGISLATION_HOSTING_VARIABLE } from './env.ts';

/** The server's tool names, in the order its `tools/list` returns them. */
export const NYS_LEGISLATION_TOOL_NAMES: readonly string[] = ['search_bills', 'get_bill', 'list_bills', 'get_bill_votes', 'get_bill_updates', 'list_laws', 'get_law_tree', 'get_law_section', 'list_members', 'get_member', 'search_members', 'list_committees', 'get_committee', 'get_committee_meetings', 'list_calendars', 'get_calendar', 'list_agendas', 'get_agenda', 'list_floor_transcripts', 'get_floor_transcript', 'list_hearing_transcripts', 'get_hearing_transcript', 'get_updates', 'search'];

/** The server's tool schemas at the pinned version, as function tools: each
 *  `inputSchema` is the tool's `parameters`, unchanged. */
export const NYS_LEGISLATION_TOOLS: readonly FunctionToolSchema[] = [
  {
    "type": "function",
    "function": {
      "name": "search_bills",
      "description": "Search NYS legislation by keyword using ElasticSearch syntax. Searches bill titles, summaries, and full text. Supports boolean operators (AND, OR, NOT), phrase quotes, wildcards, and field targeting (e.g. title:\"climate\" AND sponsor:Krueger). Optionally filter by session year (odd-numbered years: 2023, 2025, etc.).",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "term": {
            "type": "string",
            "description": "Search term or ElasticSearch query string"
          },
          "session_year": {
            "type": "number",
            "description": "Legislative session year (odd-numbered, e.g. 2025). Omit to search all sessions (all sessions in the local corpus, when it answers)."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "term"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_bill",
      "description": "Get a specific NYS bill by print number and session year. Print numbers are in the format S1234 (Senate) or A1234 (Assembly). Returns full bill details including status, sponsor, summary, actions, and votes.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "print_no": {
            "type": "string",
            "description": "Bill print number, e.g. 'S1234' or 'A5678'"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          }
        },
        "required": [
          "print_no"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_bills",
      "description": "List bills introduced in a given NYS legislative session year, in order of introduction.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 500)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_bill_votes",
      "description": "Get all recorded votes on a specific NYS bill, including committee and floor votes. Returns each member's vote grouped by vote code (AYE, NAY, EXC, ABS, etc.). These are the `votes` from the bill record; a bill with no recorded votes returns an empty list.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "print_no": {
            "type": "string",
            "description": "Bill print number, e.g. 'S1234'"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          }
        },
        "required": [
          "print_no"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_bill_updates",
      "description": "Get a feed of bill changes within a date range — useful for tracking what was introduced, amended, or acted on during a specific period.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "Start datetime, ISO-8601 format: 'YYYY-MM-DDTHH:MM:SS' (e.g. '2025-01-01T00:00:00')"
          },
          "to": {
            "type": "string",
            "description": "End datetime, ISO-8601 format: 'YYYY-MM-DDTHH:MM:SS'"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50, max 500)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "from",
          "to"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_laws",
      "description": "List all law bodies in New York State — the Consolidated Laws, the NYC Administrative Code, the state Constitution, and other codified bodies. Returns law IDs and names.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_law_tree",
      "description": "Get the hierarchical table of contents for a specific NYS law body. Use list_laws to find the law ID (e.g. 'EDN' for Education Law, 'LAB' for Labor Law). Returns the document tree with titles and location IDs for each section.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "law_id": {
            "type": "string",
            "description": "Law body identifier, e.g. 'EDN' (Education), 'LAB' (Labor), 'ENV' (Environmental). Use list_laws to find IDs."
          }
        },
        "required": [
          "law_id"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_law_section",
      "description": "Get the text of a specific section within an NYS law body. Use get_law_tree to find the location ID for the section you need.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "law_id": {
            "type": "string",
            "description": "Law body identifier, e.g. 'EDN'"
          },
          "location_id": {
            "type": "string",
            "description": "Section location ID from the law tree, e.g. 'A1S1' or '701'"
          }
        },
        "required": [
          "law_id",
          "location_id"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_members",
      "description": "List all members of the NYS Senate or Assembly for a given session year. Returns member IDs, names, districts, and contact information.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "chamber": {
            "type": "string",
            "enum": [
              "senate",
              "assembly"
            ],
            "description": "Which chamber to list (senate or assembly)"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 100)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "chamber"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_member",
      "description": "Get a specific NYS legislator by their member ID. Returns full profile including name, district, contact info, and party. Errors if the member sits in the other chamber from `chamber`.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "member_id": {
            "type": "number",
            "description": "Numeric member ID (from list_members or search_members)"
          },
          "chamber": {
            "type": "string",
            "enum": [
              "senate",
              "assembly"
            ],
            "description": "Which chamber the member belongs to"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          }
        },
        "required": [
          "member_id",
          "chamber"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_members",
      "description": "Search for NYS legislators by name. Every result carries `chamber`, and `fullName` where known (a locally served member who has never prime-sponsored a bill has none), so similar names can be told apart. Optionally filter by chamber or session year. Served from the local corpus when present (substring match on short and full name, works without an API key); otherwise, or when nothing matches locally, from the live API, where ElasticSearch field queries such as 'districtCode:20' also work.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "term": {
            "type": "string",
            "description": "Name or keyword to search"
          },
          "chamber": {
            "type": "string",
            "enum": [
              "senate",
              "assembly"
            ],
            "description": "Filter by chamber (optional)"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "term"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_committees",
      "description": "List all committees in the NYS Senate or Assembly for a given session year.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "chamber": {
            "type": "string",
            "enum": [
              "senate",
              "assembly"
            ],
            "description": "Which chamber's committees to list"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 100)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "chamber"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_committee",
      "description": "Get details for a specific NYS committee — chair, meeting schedule, location, and subcommittees.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "committee_name": {
            "type": "string",
            "description": "Full committee name, e.g. 'Finance', 'Codes', 'Health'"
          },
          "chamber": {
            "type": "string",
            "enum": [
              "senate",
              "assembly"
            ],
            "description": "Which chamber the committee belongs to"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          }
        },
        "required": [
          "committee_name",
          "chamber"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_committee_meetings",
      "description": "Get the meeting history and upcoming meetings for a specific NYS committee, including bills considered at each meeting.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "committee_name": {
            "type": "string",
            "description": "Full committee name, e.g. 'Finance'"
          },
          "chamber": {
            "type": "string",
            "enum": [
              "senate",
              "assembly"
            ],
            "description": "Which chamber the committee belongs to"
          },
          "session_year": {
            "type": "number",
            "description": "Session year (odd-numbered, e.g. 2025). Defaults to current session."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "committee_name",
          "chamber"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_calendars",
      "description": "List Senate floor calendars for a given year. Floor calendars show which bills are scheduled for floor votes.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "year": {
            "type": "number",
            "description": "Calendar year (e.g. 2025). Defaults to current year."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_calendar",
      "description": "Get a specific Senate floor calendar by year and calendar number. Returns active lists and supplemental calendars showing bills scheduled for floor votes.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "year": {
            "type": "number",
            "description": "Calendar year (e.g. 2025)"
          },
          "calendar_no": {
            "type": "number",
            "description": "Calendar number within the year"
          }
        },
        "required": [
          "year",
          "calendar_no"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_agendas",
      "description": "List committee agendas for a given year. Agendas show committee meeting schedules and which bills were considered.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "year": {
            "type": "number",
            "description": "Calendar year (e.g. 2025). Defaults to current year."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_agenda",
      "description": "Get a specific committee agenda by year and agenda number. Returns committee meetings, bills considered, and vote records.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "year": {
            "type": "number",
            "description": "Calendar year (e.g. 2025)"
          },
          "agenda_no": {
            "type": "number",
            "description": "Agenda number within the year"
          }
        },
        "required": [
          "year",
          "agenda_no"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_floor_transcripts",
      "description": "List NYS Senate floor session transcripts for a given year.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "year": {
            "type": "number",
            "description": "Year of the transcripts (e.g. 2025). Defaults to current year."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_floor_transcript",
      "description": "Get a specific NYS Senate floor session transcript by its datetime. Use list_floor_transcripts to find datetime values.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "date_time": {
            "type": "string",
            "description": "Session datetime, ISO-8601 format: 'YYYY-MM-DDTHH:MM:SS'"
          }
        },
        "required": [
          "date_time"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_hearing_transcripts",
      "description": "List NYS Senate public hearing transcripts for a given year.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "year": {
            "type": "number",
            "description": "Year of the transcripts (e.g. 2025). Defaults to current year."
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_hearing_transcript",
      "description": "Get a specific NYS Senate public hearing transcript by its filename. Use list_hearing_transcripts to find filenames.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "filename": {
            "type": "string",
            "description": "Hearing transcript filename (from list_hearing_transcripts)"
          }
        },
        "required": [
          "filename"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_updates",
      "description": "Get aggregate updates across all NYS Open Legislation content types for a date range. Useful for polling what changed — new bills, amendments, votes, agendas, etc. Optionally restrict to one content type via content_type: bills, agendas, calendars, laws.",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "Start datetime, ISO-8601: 'YYYY-MM-DDTHH:MM:SS'"
          },
          "to": {
            "type": "string",
            "description": "End datetime, ISO-8601: 'YYYY-MM-DDTHH:MM:SS'"
          },
          "type": {
            "type": "string",
            "enum": [
              "processed",
              "published"
            ],
            "description": "Which timestamp the date range filters on: 'processed' (when Open Legislation processed the change) or 'published' (when the source data was published). Not a content-type filter — use content_type for that. (optional)"
          },
          "content_type": {
            "type": "string",
            "enum": [
              "bills",
              "agendas",
              "calendars",
              "laws"
            ],
            "description": "Restrict results to one content type (optional)"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "from",
          "to"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search",
      "description": "Full-text search within one NYS Open Legislation content type using ElasticSearch syntax. The upstream API has no unified search endpoint — each content type is searched separately, so this tool searches a single type per call (defaults to bills). Supported types: bills, laws, agendas, calendars, transcripts, hearings. Supports boolean operators (AND, OR, NOT), phrase quotes, wildcards, and field targeting. To search resolutions, use type 'bills' (they share the bills index).",
      "parameters": {
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "term": {
            "type": "string",
            "description": "Search query (e.g. 'minimum wage', 'climate AND emissions', 'title:\"housing\"')"
          },
          "type": {
            "type": "string",
            "description": "Content type to search: bills (default), laws, agendas, calendars, transcripts, hearings. One type per call.",
            "enum": [
              "bills",
              "laws",
              "agendas",
              "calendars",
              "transcripts",
              "hearings"
            ]
          },
          "session_year": {
            "type": "number",
            "description": "Filter bills to a specific session year (optional)"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          },
          "offset": {
            "type": "number",
            "description": "Pagination offset (default 0)"
          }
        },
        "required": [
          "term"
        ]
      }
    }
  }
];

/** The pinned package: version 2.4.0, whose registry metadata states the
 *  commit below as its `gitHead`. It may reach the Open Legislation API's one
 *  host. (Its server reports the version "2.3.0" in `initialize`; the package
 *  is 2.4.0.) */
export const NYS_LEGISLATION_HOSTING: SourceHosting = {
  kind: 'npm-package',
  package: '@betanyc/nys-openlegislation-mcp',
  version: '2.4.0',
  commit: 'cc069c46d52b939275f9dcac3d72b2dd011531d3',
  outbound: ['legislation.nysenate.gov'],
};

/** The source's one variant: the pinned package, run in a sandbox the
 *  instance creates, while `NYS_LEGISLATION_HOSTING` is `sandbox`. The
 *  server sends the instance's key in the request URL's query string
 *  (`keyIn: 'query'`). Two log holders, in the order the data flows: the
 *  platform the instance runs its sandboxes on (the instance states its
 *  posture), then the New York State Senate, whose policy, read on the date
 *  below, covers "all Senate Websites" and says nothing of API requests. */
export const NYS_LEGISLATION_SANDBOX_VARIANT: NpmPackageVariant = {
  ...NYS_LEGISLATION_HOSTING,
  variant: HOSTING_SANDBOX,
  runsAt: 'instance-sandbox',
  keyIn: 'query',
  logging: [
    { statedBy: 'instance', role: 'sandbox-platform' },
    {
      statedBy: 'manifest',
      holder: 'New York State Senate',
      keeps: 'not-stated',
      statementUrl: 'https://www.nysenate.gov/privacy-policy',
      readOn: '2026-10-19',
    },
  ],
};

/**
 * The NYS Open Legislation source. Its `id` is the package name and repository
 * address: the publisher has not listed the server in the MCP Registry
 * (searched 2026-10-19). Optional, and switched on by
 * `NYS_LEGISLATION_HOSTING` rather than configured with an address: a run is
 * offered it only while the switch is on.
 */
export const NYS_LEGISLATION_ENTRY: CivicManifestEntry = {
  id: '@betanyc/nys-openlegislation-mcp@https://github.com/BetaNYC/nys-openlegislation-mcp',
  alias: 'nys_legislation',
  sourceId: 'nys-legislation',
  displayName: 'NYS Open Legislation MCP Server',
  description:
    "New York State's legislature through the Senate's Open Legislation API: bills and resolutions since 2009 with their text, status, votes and updates, the State's consolidated laws by section, Senate and Assembly members, committees and their meetings, floor calendars, agendas, and floor and hearing transcripts. Covers New York State only. Does not hold New York City's own law (the Charter, the Administrative Code or the Rules) or federal law.",
  freshness:
    "Live: every call queries the Senate's Open Legislation API as it stands.",
  freshnessSource:
    "The publisher's README for version 2.4.0, \"Local corpus (optional)\" (github.com/BetaNYC/nys-openlegislation-mcp): \"By default the server queries the live NYS Open Legislation API on every request\"; the package ships no local corpus.",
  configuration: {
    addressVariable: NYS_LEGISLATION_HOSTING_VARIABLE,
    requirement: 'optional',
  },
  tools: NYS_LEGISLATION_TOOLS,
  toolNames: NYS_LEGISLATION_TOOL_NAMES,
  guidance: {
    async fetchText() {
      return '';
    },
  },
  prompt: {
    citation: 'the bill print number and session year, or the law and section (for NYS Open Legislation)',
    // The lock section lists the other sources with commas: a name without one.
    lockMention: 'the NYS legislation server for New York State bills and laws',
  },
  hostings: [NYS_LEGISLATION_SANDBOX_VARIANT],
  // Ask first (D7b = A): its upstream is a recipient a reader's first consent
  // has not named, its statement says nothing of API requests, and it
  // receives the instance's key in every request URL.
  consentDefault: 'ask-first',
  // The publisher's README: built by BetaNYC.
  publisher: 'BetaNYC',
};
