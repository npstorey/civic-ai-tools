// The NYC Charter, Laws and Rules source: a publisher-bundled MCP server the
// instance runs itself, rather than one it calls at a configured address.
//
// The server is BetaNYC's `@betanyc/nyc-charter-laws-rules` on npm. It serves
// over stdio only, and it serves the section index bundled in its package: it
// makes no network request (its `dist/corpus.js` at 0.3.1 reads files only).
// The instance runs the pinned version in a sandbox it creates, behind a
// bridge from stdio to HTTP; that host is the consumer's, not this package's.
//
// The five schemas below are the server's own, as its `tools/list` returns
// them at the pinned version: captured by
// `src/__fixtures__/pin-nyc-charter-tools.mjs` into
// `src/__fixtures__/nyc-charter-tools.json`, and held equal to it by
// `src/nyc-charter.test.ts`. They are code because the build reads no JSON.
// They are text the router does not own, so the aliased view gives their
// descriptions the anchored rewrite, as it does a server's instructions.
//
// The source sends no guidance: its `initialize` result carries no
// `instructions` and it serves no prompt, so its guidance entry returns ''
// and calls neither fetcher. Offering it never wakes it.

import type { FunctionToolSchema, NpmPackageVariant, SourceHosting } from '../core/types.ts';
import type { CivicManifestEntry } from './context.ts';
import { NYC_CHARTER_HOSTING_SANDBOX, NYC_CHARTER_HOSTING_VARIABLE } from './env.ts';

/** The server's tool names, in the order its `tools/list` returns them. */
export const NYC_CHARTER_TOOL_NAMES: readonly string[] = ['search', 'get_section', 'list_titles', 'get_title', 'get_version'];

/** The server's tool schemas at the pinned version, as function tools: each
 *  `inputSchema` is the tool's `parameters`, unchanged. */
export const NYC_CHARTER_TOOLS: readonly FunctionToolSchema[] = [
  {
    "type": "function",
    "function": {
      "name": "search",
      "description": "Search across the NYC Charter, Administrative Code, and Rules of the City of New York by keyword or phrase. Results are relevance-ranked: heading matches rank above citation matches, which rank above body-text matches, and whole-word matches rank above substring matches. For informational purposes only. Not legal advice. Verify against official sources at codelibrary.amlegal.com before relying on any result.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search term or phrase"
          },
          "corpus": {
            "type": "string",
            "enum": [
              "charter",
              "admin_code",
              "rules",
              "all"
            ],
            "description": "Which document to search (default: all)"
          },
          "limit": {
            "type": "number",
            "description": "Max results to return (default 10, max 50)"
          }
        },
        "additionalProperties": false,
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_section",
      "description": "Retrieve a specific section by its citation (e.g. '§ 259', 'Section 259', '11-602.1', 'Chapter 11'). Input is normalized (with or without '§', any case). Pass 'corpus' to disambiguate when the same citation exists in multiple documents (e.g. charter 'Chapter 3' vs a rules chapter); if multiple sections still match, a disambiguation list is returned. For informational purposes only. Not legal advice. Verify against official sources at codelibrary.amlegal.com before relying on any result.",
      "parameters": {
        "type": "object",
        "properties": {
          "citation": {
            "type": "string",
            "description": "Section citation or heading"
          },
          "corpus": {
            "type": "string",
            "enum": [
              "charter",
              "admin_code",
              "rules"
            ],
            "description": "Which document to look in (default: all three)"
          }
        },
        "additionalProperties": false,
        "required": [
          "citation"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_titles",
      "description": "List the top-level chapters or titles of a document. For informational purposes only. Not legal advice. Verify against official sources at codelibrary.amlegal.com before relying on any result.",
      "parameters": {
        "type": "object",
        "properties": {
          "corpus": {
            "type": "string",
            "enum": [
              "charter",
              "admin_code",
              "rules"
            ],
            "description": "Which document to list"
          }
        },
        "additionalProperties": false,
        "required": [
          "corpus"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_title",
      "description": "Retrieve chapter/title records matching an identifier (whole-token match: 'Chapter 1' does not match 'Chapter 10'). Note: the index is flat — deep hierarchy (every section nested within a title) is not indexed, so this returns matching chapter/title-level records, not full title contents. For informational purposes only. Not legal advice. Verify against official sources at codelibrary.amlegal.com before relying on any result.",
      "parameters": {
        "type": "object",
        "properties": {
          "corpus": {
            "type": "string",
            "enum": [
              "charter",
              "admin_code",
              "rules"
            ],
            "description": "Which document"
          },
          "title": {
            "type": "string",
            "description": "Chapter or title identifier (e.g. 'Chapter 11')"
          }
        },
        "additionalProperties": false,
        "required": [
          "corpus",
          "title"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_version",
      "description": "Return the currency date for each document — how current the Charter, Administrative Code, and Rules are. Each corpus updates on its own schedule. Always call this tool before answering legal questions so responses are grounded in the correct version of the law. For informational purposes only. Not legal advice. Verify against official sources at codelibrary.amlegal.com before relying on any result.",
      "parameters": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      }
    }
  }
];

/** The pinned package: version 0.3.1, whose registry metadata states the
 *  commit below as its `gitHead` (and whose provenance names the same commit,
 *  built from the tag `v0.3.1`). It may reach no host. 0.3.0's hosting
 *  field, unchanged; since 0.4.0 the `sandbox` variant carries it. */
export const NYC_CHARTER_HOSTING: SourceHosting = {
  kind: 'npm-package',
  package: '@betanyc/nyc-charter-laws-rules',
  version: '0.3.1',
  commit: 'b784cb763ec0d953139eef4ed366e8ec4de72625',
  outbound: [],
};

/** The source's one variant: the pinned package, run in a sandbox the
 *  instance creates, while `NYC_CHARTER_HOSTING` is `sandbox` (the switch's
 *  value is the variant's name). Its one log holder is the platform the
 *  instance runs its sandboxes on, which the instance chooses, so the
 *  instance states its posture: the package reaches no host, so nothing goes
 *  onward. */
export const NYC_CHARTER_SANDBOX_VARIANT: NpmPackageVariant = {
  ...NYC_CHARTER_HOSTING,
  variant: NYC_CHARTER_HOSTING_SANDBOX,
  runsAt: 'instance-sandbox',
  logging: [{ statedBy: 'instance', role: 'sandbox-platform' }],
};

/**
 * The NYC Charter, Laws and Rules source. Its `id` is the package name and
 * repository address: the publisher has not listed the server in the MCP
 * Registry. Optional, and switched on by `NYC_CHARTER_HOSTING` rather than
 * configured with an address: a run is offered it only while the switch is on.
 */
export const NYC_CHARTER_ENTRY: CivicManifestEntry = {
  id: '@betanyc/nyc-charter-laws-rules@https://github.com/BetaNYC/nyc-charter-laws-rules',
  alias: 'nyc_charter',
  sourceId: 'nyc-charter',
  displayName: 'NYC Charter, Laws and Rules MCP Server',
  description:
    "New York City's own law: the full text of the New York City Charter, the Administrative Code and the Rules of the City of New York, by section, with title and chapter listings and keyword search. Covers New York City only. Holds no court decisions, no New York State or federal law, and no bills still in progress.",
  freshness:
    "Pinned to version 0.3.1 of the publisher's package and the index it bundles: the Charter and the Administrative Code are current through Local Law 2026/147, enacted September 12, 2026, and the Rules through rules effective October 4, 2026.",
  freshnessSource:
    "The publisher's release page for v0.3.1 (github.com/BetaNYC/nyc-charter-laws-rules/releases/tag/v0.3.1), and the currency lines the 0.3.1 server's get_version tool returned at capture (src/__fixtures__/nyc-charter-tools.json, getVersion).",
  configuration: {
    addressVariable: NYC_CHARTER_HOSTING_VARIABLE,
    requirement: 'optional',
  },
  tools: NYC_CHARTER_TOOLS,
  toolNames: NYC_CHARTER_TOOL_NAMES,
  guidance: {
    async fetchText() {
      return '';
    },
  },
  prompt: {
    citation: 'the section citation and the document it is from (for the NYC Charter, Administrative Code and Rules)',
    // The lock section lists the other sources with commas: a name without one.
    lockMention: 'the NYC Charter server for New York City law',
  },
  hostings: [NYC_CHARTER_SANDBOX_VARIANT],
  consentDefault: 'on',
  // The publisher's repository: "built and maintained by BetaNYC".
  publisher: 'BetaNYC',
};
