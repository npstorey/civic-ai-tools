// The NYC City Record source: a publisher's MCP server the instance runs
// itself, from a pinned package, rather than one it calls at a configured
// address.
//
// The server is BetaNYC's `@betanyc/nyc-record-mcp` on npm. It serves over
// stdio only, and every tool call it answers is a query of one dataset on
// NYC Open Data, City Record Online, at one host: `data.cityofnewyork.us` (its
// `dist/city-record.js` at 1.1.0; no key is required, and an optional app
// token, `SOCRATA_APP_TOKEN`, is not set by this entry). The instance runs the
// pinned version in a sandbox it creates, behind a bridge from stdio to HTTP,
// with that one host as the sandbox's outbound allowance; that host is the
// consumer's, not this package's.
//
// The 7 schemas below are the server's own, as its `tools/list` returns
// them at the pinned version: captured by
// `src/__fixtures__/pin-nyc-record-tools.mjs` into
// `src/__fixtures__/nyc-record-tools.json`, and held equal to it by
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
import { HOSTING_SANDBOX, NYC_RECORD_HOSTING_VARIABLE } from './env.ts';

/** The server's tool names, in the order its `tools/list` returns them. */
export const NYC_RECORD_TOOL_NAMES: readonly string[] = ['search_notices', 'get_notices_by_agency', 'get_notices_by_type', 'get_procurement_notices', 'get_public_hearings', 'get_open_solicitations', 'get_notices_by_date_range'];

/** The server's tool schemas at the pinned version, as function tools: each
 *  `inputSchema` is the tool's `parameters`, unchanged. */
export const NYC_RECORD_TOOLS: readonly FunctionToolSchema[] = [
  {
    "type": "function",
    "function": {
      "name": "search_notices",
      "description": "Full-text search across all NYC City Record notices. Returns recent matching notices sorted by date.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search term"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          }
        },
        "required": [
          "query"
        ],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_notices_by_agency",
      "description": "Get City Record notices published by a specific city agency (partial name match).",
      "parameters": {
        "type": "object",
        "properties": {
          "agency_name": {
            "type": "string",
            "description": "Agency name or partial name, e.g. 'DCAS', 'Parks'"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          }
        },
        "required": [
          "agency_name"
        ],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_notices_by_type",
      "description": "Get notices filtered by type. Valid types: Solicitation, Award, Intent to Award, Intent to Negotiate, Public Hearings, Public Comment, Meeting, Notice, Vendor List, Sale.",
      "parameters": {
        "type": "object",
        "properties": {
          "notice_type": {
            "type": "string",
            "enum": [
              "Solicitation",
              "Award",
              "Intent to Award",
              "Intent to Negotiate",
              "Public Hearings",
              "Public Comment",
              "Meeting",
              "Notice",
              "Vendor List",
              "Sale"
            ],
            "description": "Notice type"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          }
        },
        "required": [
          "notice_type"
        ],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_procurement_notices",
      "description": "Get recent procurement-related notices: solicitations, awards, intent to award, vendor lists. Useful for tracking open contracts and recent awards.",
      "parameters": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          }
        },
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_public_hearings",
      "description": "Get recent public hearings, public comment periods, and agency meetings from the City Record.",
      "parameters": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          }
        },
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_open_solicitations",
      "description": "Get active solicitations (RFPs, RFQs, IFBs) where the due date has not yet passed. Sorted by due date ascending — soonest deadlines first.",
      "parameters": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "number",
            "description": "Max results (default 25, max 100)"
          }
        },
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_notices_by_date_range",
      "description": "Get all City Record notices published within a date range.",
      "parameters": {
        "type": "object",
        "properties": {
          "start_date": {
            "type": "string",
            "description": "Start date, YYYY-MM-DD"
          },
          "end_date": {
            "type": "string",
            "description": "End date, YYYY-MM-DD"
          },
          "limit": {
            "type": "number",
            "description": "Max results (default 50, max 200)"
          }
        },
        "required": [
          "start_date",
          "end_date"
        ],
        "additionalProperties": false
      }
    }
  }
];

/** The pinned package: version 1.1.0, whose registry metadata states the
 *  commit below as its `gitHead`. It may reach the open data portal's one
 *  host. */
export const NYC_RECORD_HOSTING: SourceHosting = {
  kind: 'npm-package',
  package: '@betanyc/nyc-record-mcp',
  version: '1.1.0',
  commit: '6c52a5353381592713678caa109870d1e912c858',
  outbound: ['data.cityofnewyork.us'],
};

/** The source's one variant: the pinned package, run in a sandbox the
 *  instance creates, while `NYC_RECORD_HOSTING` is `sandbox`. Two log
 *  holders, in the order the data flows: the platform the instance runs its
 *  sandboxes on (the instance states its posture), then the City of New York,
 *  named as its statement names it. That statement, read on the date below,
 *  covers NYC.gov and says nothing of the open data portal or its API (the
 *  portal platform vendor's page refused the read), so it states nothing
 *  about what is kept of these requests. No key is sent. */
export const NYC_RECORD_SANDBOX_VARIANT: NpmPackageVariant = {
  ...NYC_RECORD_HOSTING,
  variant: HOSTING_SANDBOX,
  runsAt: 'instance-sandbox',
  logging: [
    { statedBy: 'instance', role: 'sandbox-platform' },
    {
      statedBy: 'manifest',
      holder: 'City of New York',
      keeps: 'not-stated',
      statementUrl: 'https://www.nyc.gov/home/privacy-policy.page',
      readOn: '2026-10-19',
    },
  ],
};

/**
 * The NYC City Record source. Its `id` is the package name and repository
 * address: the publisher has not listed the server in the MCP Registry
 * (searched 2026-10-19). Optional, and switched on by `NYC_RECORD_HOSTING`
 * rather than configured with an address: a run is offered it only while the
 * switch is on.
 */
export const NYC_RECORD_ENTRY: CivicManifestEntry = {
  id: '@betanyc/nyc-record-mcp@https://github.com/BetaNYC/nyc-record-mcp',
  alias: 'nyc_record',
  sourceId: 'nyc-record',
  displayName: 'NYC City Record MCP Server',
  description:
    "Notices in The City Record, New York City's official journal, since 2015: procurement solicitations, awards and intent-to-award notices, public hearings and comment periods, and other agency notices, by agency, notice type, keyword and publication date. Covers New York City only. Does not hold the notices' full documents or any dataset other than City Record Online.",
  freshness:
    'Live: every call queries the City Record Online dataset on NYC Open Data, which is updated daily.',
  freshnessSource:
    "The publisher's README for version 1.1.0, \"Data source\" (github.com/BetaNYC/nyc-record-mcp): the City Record Online dataset on NYC Open Data \"is updated daily and includes notices published in the official City Record since 2015\".",
  configuration: {
    addressVariable: NYC_RECORD_HOSTING_VARIABLE,
    requirement: 'optional',
  },
  tools: NYC_RECORD_TOOLS,
  toolNames: NYC_RECORD_TOOL_NAMES,
  guidance: {
    async fetchText() {
      return '';
    },
  },
  prompt: {
    citation: 'the agency, notice type and publication date of each notice (for The City Record)',
    // The lock section lists the other sources with commas: a name without one.
    lockMention: 'the City Record server for New York City notices',
  },
  hostings: [NYC_RECORD_SANDBOX_VARIANT],
  // On (D7b = A): its upstream is the open data portal the Socrata source
  // already reaches, under the operator a reader's first consent names.
  consentDefault: 'on',
  // The publisher's README: built by BetaNYC.
  publisher: 'BetaNYC',
};
