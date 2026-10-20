// The NYC Checkbook source: a publisher's MCP server the instance runs itself,
// from a pinned package, rather than one it calls at a configured address.
//
// The server is BetaNYC's `@betanyc/nyc-checkbook-mcp` on npm. It serves over
// stdio only, and every tool call it answers is a request to the Checkbook NYC
// API, the New York City Comptroller's financial transparency service, at one
// host: `www.checkbooknyc.com` (its `dist/checkbook.js` at 1.6.3; no key, and
// requests spaced at least 1.1 seconds apart, process-wide). The instance runs
// the pinned version in a sandbox it creates, behind a bridge from stdio to
// HTTP, with that one host as the sandbox's outbound allowance; that host is
// the consumer's, not this package's.
//
// The 10 schemas below are the server's own, as its `tools/list` returns
// them at the pinned version: captured by
// `src/__fixtures__/pin-nyc-checkbook-tools.mjs` into
// `src/__fixtures__/nyc-checkbook-tools.json`, and held equal to it by
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
import { HOSTING_SANDBOX, NYC_CHECKBOOK_HOSTING_VARIABLE } from './env.ts';

/** The server's tool names, in the order its `tools/list` returns them. */
export const NYC_CHECKBOOK_TOOL_NAMES: readonly string[] = ['smart_search', 'search_contracts', 'get_contract', 'search_spending', 'search_budget', 'search_payroll', 'search_revenue', 'get_agency_spending', 'search_nycedc_contracts', 'search_nycha_contracts'];

/** The server's tool schemas at the pinned version, as function tools: each
 *  `inputSchema` is the tool's `parameters`, unchanged. */
export const NYC_CHECKBOOK_TOOLS: readonly FunctionToolSchema[] = [
  {
    "type": "function",
    "function": {
      "name": "smart_search",
      "description": "DISABLED BY DEFAULT (opt in with CHECKBOOK_ENABLE_SMART_SEARCH=1). The checkbooknyc.com /smart_search endpoint is not a supported Checkbook NYC API endpoint — it is a WAF-fronted, JavaScript-rendered web page — so this server does not call it by default. Prefer the structured tools: search_spending(payee_name=…) to find checks paid to a named vendor, search_contracts for contract filters. When disabled (or when opted-in but WAF-blocked) this returns structured fallback guidance rather than data.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search term — product name, vendor name, keyword, or phrase"
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "description": "Max results to return (default 25, max 100)"
          }
        },
        "required": [
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
      "name": "search_contracts",
      "description": "Search NYC registered and pending contracts with structured filters. Filter by agency, vendor_code, contract ID, date range, amount range, industry, MWBE category, and more. NOTE: the contracts API has NO vendor-name filter — vendors are filtered only by vendor_code. To find contracts by vendor NAME, use search_spending (payee_name) for checks paid to a named vendor. Many contracts are held by resellers, so a product/software name may not match the contract's own vendor. KNOWN API LIMITATION: registered revenue contracts (category 'revenue') with fiscal_year return no rows from Checkbook NYC (a match count, no records), so the tool refuses that combination without sending a request; omit fiscal_year and filter by dates instead.",
      "parameters": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "registered",
              "pending"
            ],
            "default": "registered",
            "description": "Contract status (default: registered)"
          },
          "category": {
            "type": "string",
            "enum": [
              "expense",
              "revenue",
              "all"
            ],
            "default": "expense",
            "description": "Contract category (default: expense). Record field names follow the API's own domain and differ by shape: registered expense/all use prime_contract_* names (prime_contract_id, prime_contract_purpose, ...); registered revenue and every pending search use plain names (contract_id, purpose, agency, ...). Records are returned as the API sends them, not normalized."
          },
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2024'"
          },
          "agency_code": {
            "type": "string",
            "description": "3-digit agency code, e.g. '858' for OTI/DoITT, '002' for DoF"
          },
          "vendor_name": {
            "type": "string",
            "description": "NOT SUPPORTED as a contracts filter — the Checkbook API has no vendor-name parameter and no name→code lookup. Supplying this returns actionable guidance (use vendor_code, or search_spending with payee_name for name search). Prefer vendor_code."
          },
          "vendor_code": {
            "type": "string",
            "description": "Vendor identification code (the only vendor filter for contracts)"
          },
          "contract_id": {
            "type": "string",
            "description": "Contract number, e.g. 'CT18582020\u0031424467'"
          },
          "amount_min": {
            "type": "number",
            "description": "Minimum current contract amount"
          },
          "amount_max": {
            "type": "number",
            "description": "Maximum current contract amount"
          },
          "start_date_from": {
            "type": "string",
            "description": "Contract start date range begin (YYYY-MM-DD)"
          },
          "start_date_to": {
            "type": "string",
            "description": "Contract start date range end (YYYY-MM-DD)"
          },
          "end_date_from": {
            "type": "string",
            "description": "Contract end date range begin (YYYY-MM-DD)"
          },
          "end_date_to": {
            "type": "string",
            "description": "Contract end date range end (YYYY-MM-DD)"
          },
          "award_method": {
            "type": "string",
            "description": "Award method code"
          },
          "mwbe_category": {
            "type": "string",
            "description": "M/WBE category code"
          },
          "industry": {
            "type": "string",
            "description": "Industry code"
          },
          "contract_type": {
            "type": "string",
            "description": "Contract type code"
          },
          "purpose": {
            "type": "string",
            "description": "Contract purpose keyword (server-side 'contains' match). Live-verified 2026-07-28. purpose='software' returned 168 of 19,139 registered/expense FY2025."
          },
          "pin": {
            "type": "string",
            "description": "Contract PIN / tracking number. Live-verified 2026-07-28. An exact PIN returned exactly 1 record."
          },
          "registration_date_from": {
            "type": "string",
            "description": "Registration date range begin (YYYY-MM-DD). Registered contracts only. Live-verified 2026-07-28."
          },
          "registration_date_to": {
            "type": "string",
            "description": "Registration date range end (YYYY-MM-DD). Registered contracts only. Live-verified 2026-07-28. A 6-month range returned 9,599 of 19,139."
          },
          "received_date_from": {
            "type": "string",
            "description": "Received date range begin (YYYY-MM-DD). Pending contracts only (registered use registration_date). Live-verified 2026-07-28. An open-ended range returned the full pending set."
          },
          "received_date_to": {
            "type": "string",
            "description": "Received date range end (YYYY-MM-DD). Pending contracts only. Live-verified 2026-07-28."
          },
          "contract_includes_sub_vendors": {
            "type": "integer",
            "minimum": 0,
            "maximum": 99,
            "description": "Sub-vendor flag: 1 = contracts that include sub-vendors. Registered contracts only. Live-verified 2026-07-28. 1 returned 3,246 of 19,139 registered/expense FY2025; 0 returned 0. This is an INTEGER, not a status code — the API rejects a non-numeric value with \"is not of data type integer\", and it does so as HTTP 200 with a plain-text (non-XML) body, which parses as an empty response. Note the response column of the same name reports 'N/A', so an observed column value cannot be fed back in as a filter value."
          },
          "include_sub_vendors": {
            "type": "boolean",
            "default": false,
            "description": "Include sub-vendor / subcontractor detail columns (sub_vendor, sub_vendor_mwbe_category, sub_contract_current_amount, etc.) in the response. Applies to registered expense/all contracts only; ignored for status='pending' and for category='revenue', whose domains list no sub-vendor columns."
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_contract",
      "description": "Look up a single NYC contract by its contract ID. Returns full contract details. Use this after finding a contract ID via search_contracts or search_spending. Field names follow status/category, as in search_contracts: registered expense uses prime_contract_* names, registered revenue and pending use plain names (contract_id, purpose, ...).",
      "parameters": {
        "type": "object",
        "properties": {
          "contract_id": {
            "type": "string",
            "description": "Contract ID, e.g. 'CT18582020\u0031424467' or 'DO18582025\u0032009241'"
          },
          "status": {
            "type": "string",
            "enum": [
              "registered",
              "pending"
            ],
            "default": "registered",
            "description": "Contract status (default: registered)"
          },
          "category": {
            "type": "string",
            "enum": [
              "expense",
              "revenue"
            ],
            "default": "expense",
            "description": "Contract category (default: expense)"
          }
        },
        "required": [
          "contract_id"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_spending",
      "description": "Search NYC spending (check) records. Filter by agency, payee, contract, date range, amount, or expense category. Either fiscal_year or issue_date_from is required.",
      "parameters": {
        "type": "object",
        "properties": {
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2024'"
          },
          "agency_code": {
            "type": "string",
            "description": "3-digit agency code"
          },
          "payee_name": {
            "type": "string",
            "description": "Payee (vendor) name"
          },
          "contract_id": {
            "type": "string",
            "description": "Filter spending by contract ID"
          },
          "issue_date_from": {
            "type": "string",
            "description": "Check issue date range start (YYYY-MM-DD)"
          },
          "issue_date_to": {
            "type": "string",
            "description": "Check issue date range end (YYYY-MM-DD)"
          },
          "amount_min": {
            "type": "number",
            "description": "Minimum check amount"
          },
          "amount_max": {
            "type": "number",
            "description": "Maximum check amount"
          },
          "expense_category": {
            "type": "string",
            "description": "Expense category code"
          },
          "spending_category": {
            "type": "string",
            "description": "'c' for capital, 'e' for expense"
          },
          "mwbe_category": {
            "type": "string",
            "description": "M/WBE category code"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_budget",
      "description": "Search NYC budget data by agency, department, fiscal year, or budget code.",
      "parameters": {
        "type": "object",
        "properties": {
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2024'"
          },
          "agency_code": {
            "type": "string",
            "description": "3-digit agency code"
          },
          "department_code": {
            "type": "string",
            "description": "Department code"
          },
          "budget_code": {
            "type": "string",
            "description": "Budget code"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_payroll",
      "description": "Search NYC payroll records by agency, job title, pay frequency, pay date, or amount range. Requires fiscal_year or calendar_year. NOTE: the Checkbook NYC API does not expose employee names — payroll data is aggregated by agency/title/pay date. There is no employee-name search.",
      "parameters": {
        "type": "object",
        "properties": {
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2026'. Either fiscal_year or calendar_year is required."
          },
          "calendar_year": {
            "type": "string",
            "description": "Calendar year, e.g. '2025'. Either fiscal_year or calendar_year is required."
          },
          "agency_code": {
            "type": "string",
            "description": "3-digit agency code, e.g. '846' for Parks"
          },
          "title": {
            "type": "string",
            "description": "Job title (partial match)"
          },
          "pay_frequency": {
            "type": "string",
            "description": "Pay frequency, e.g. 'BI-WEEKLY', 'SUPPLEMENTAL'"
          },
          "pay_date_from": {
            "type": "string",
            "description": "Pay date range start (YYYY-MM-DD)"
          },
          "pay_date_to": {
            "type": "string",
            "description": "Pay date range end (YYYY-MM-DD)"
          },
          "amount_min": {
            "type": "number",
            "description": "Minimum payment amount"
          },
          "amount_max": {
            "type": "number",
            "description": "Maximum payment amount"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_revenue",
      "description": "Search NYC revenue data by agency, revenue category/class/source, fund class, or fiscal year.",
      "parameters": {
        "type": "object",
        "properties": {
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2026'"
          },
          "budget_fiscal_year": {
            "type": "string",
            "description": "Budget fiscal year, e.g. '2026'"
          },
          "agency_code": {
            "type": "string",
            "description": "3-digit agency code"
          },
          "revenue_category": {
            "type": "string",
            "description": "2-character revenue category code (not the category name)"
          },
          "revenue_class": {
            "type": "string",
            "description": "Revenue class code"
          },
          "revenue_source": {
            "type": "string",
            "description": "Revenue source code"
          },
          "fund_class": {
            "type": "string",
            "description": "Fund class code"
          },
          "funding_class": {
            "type": "string",
            "description": "Funding class code"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_agency_spending",
      "description": "Get all spending for a specific NYC agency in a fiscal year. A convenience wrapper around search_spending for agency-level financial overview.",
      "parameters": {
        "type": "object",
        "properties": {
          "agency_code": {
            "type": "string",
            "description": "3-digit agency code, e.g. '858' for OTI/DoITT, '040' for NYPD"
          },
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2024'"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "required": [
          "agency_code",
          "fiscal_year"
        ],
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_nycedc_contracts",
      "description": "Search NYCEDC / Other Government Entities (OGE) contracts (Checkbook domain Contracts_OGE). These are separate from citywide contracts and cover economic-development-corporation and other-government-entity agreements. Registered expense contracts only. Filter by fiscal year, vendor, entity contract number, OGE agency code, award method, expense category, budget name, commodity line, amount, and date ranges.",
      "parameters": {
        "type": "object",
        "properties": {
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2024'"
          },
          "vendor_name": {
            "type": "string",
            "description": "Prime vendor name (first 3 characters matched)"
          },
          "contract_id": {
            "type": "string",
            "description": "Contract number"
          },
          "entity_contract_number": {
            "type": "string",
            "description": "OGE entity contract number"
          },
          "other_government_entities_code": {
            "type": "string",
            "description": "OGE agency code (identifies the other government entity)"
          },
          "award_method": {
            "type": "string",
            "description": "Award method code"
          },
          "expense_category": {
            "type": "string",
            "description": "Expense category code"
          },
          "budget_name": {
            "type": "string",
            "description": "Budget name (first 3 characters matched)"
          },
          "commodity_line": {
            "type": "string",
            "description": "Commodity line code (EDC contracts)"
          },
          "pin": {
            "type": "string",
            "description": "Contract PIN / tracking number"
          },
          "amount_min": {
            "type": "number",
            "description": "Minimum current contract amount"
          },
          "amount_max": {
            "type": "number",
            "description": "Maximum current contract amount"
          },
          "start_date_from": {
            "type": "string",
            "description": "Start date range begin (YYYY-MM-DD)"
          },
          "start_date_to": {
            "type": "string",
            "description": "Start date range end (YYYY-MM-DD)"
          },
          "end_date_from": {
            "type": "string",
            "description": "End date range begin (YYYY-MM-DD)"
          },
          "end_date_to": {
            "type": "string",
            "description": "End date range end (YYYY-MM-DD)"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_nycha_contracts",
      "description": "Search NYCHA (New York City Housing Authority) contracts (Checkbook domain Contracts_NYCHA). These are separate from citywide contracts and are reported at release / line-item granularity (purchase-order releases, funding source, program/project). Filter by fiscal year, vendor, purchase-order type, responsibility center, contract type, industry, amount, and date ranges (including approved date). Results carry a year field only when you filter by fiscal_year; without fiscal_year they carry no year or fiscal-year field. When the year matters, filter by fiscal_year (one call per year). start_date, end_date, and approved_date are per record.",
      "parameters": {
        "type": "object",
        "properties": {
          "fiscal_year": {
            "type": "string",
            "description": "Fiscal year, e.g. '2024'"
          },
          "vendor_name": {
            "type": "string",
            "description": "Vendor name (contains match)"
          },
          "vendor_code": {
            "type": "string",
            "description": "Vendor number / code"
          },
          "contract_id": {
            "type": "string",
            "description": "Contract ID"
          },
          "purchase_order_type": {
            "type": "string",
            "description": "Purchase order type code"
          },
          "responsibility_center": {
            "type": "string",
            "description": "Responsibility center code"
          },
          "contract_type": {
            "type": "string",
            "description": "Contract type code"
          },
          "award_method": {
            "type": "string",
            "description": "Award method code"
          },
          "industry": {
            "type": "string",
            "description": "Industry type code"
          },
          "other_government_entities_code": {
            "type": "string",
            "description": "NYCHA agency code"
          },
          "purpose": {
            "type": "string",
            "description": "Contract purpose (contains match)"
          },
          "pin": {
            "type": "string",
            "description": "PO header ID / PIN"
          },
          "amount_min": {
            "type": "number",
            "description": "Minimum contract amount"
          },
          "amount_max": {
            "type": "number",
            "description": "Maximum contract amount"
          },
          "start_date_from": {
            "type": "string",
            "description": "Start date range begin (YYYY-MM-DD)"
          },
          "start_date_to": {
            "type": "string",
            "description": "Start date range end (YYYY-MM-DD)"
          },
          "end_date_from": {
            "type": "string",
            "description": "End date range begin (YYYY-MM-DD)"
          },
          "end_date_to": {
            "type": "string",
            "description": "End date range end (YYYY-MM-DD)"
          },
          "approved_date_from": {
            "type": "string",
            "description": "Release approved date range begin (YYYY-MM-DD)"
          },
          "approved_date_to": {
            "type": "string",
            "description": "Release approved date range end (YYYY-MM-DD)"
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number, 1-based (default: 1)"
          },
          "page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20000,
            "default": 50,
            "description": "Results per page (default: 50, max: 20000)"
          }
        },
        "additionalProperties": false,
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  }
];

/** The pinned package: version 1.6.3, whose registry metadata states the
 *  commit below as its `gitHead`. That commit is one behind the head of the
 *  publisher's repository (the later commit changes no code); the pin is the
 *  registry's. It may reach the Checkbook NYC API's one host. */
export const NYC_CHECKBOOK_HOSTING: SourceHosting = {
  kind: 'npm-package',
  package: '@betanyc/nyc-checkbook-mcp',
  version: '1.6.3',
  commit: 'f013a276e37e218e93c069c585d54dc3b4e3ee00',
  outbound: ['www.checkbooknyc.com'],
};

/** The source's one variant: the pinned package, run in a sandbox the
 *  instance creates, while `NYC_CHECKBOOK_HOSTING` is `sandbox`. Two log
 *  holders, in the order the data flows: the platform the instance runs its
 *  sandboxes on (the instance states its posture), then the Checkbook NYC
 *  API's operator, whose policy, read on the date below, says nothing of what
 *  it keeps of API requests: it covers the Comptroller's website and does not
 *  name Checkbook NYC or its API (the service's own pages refused the read
 *  with HTTP 403). No key is sent. */
export const NYC_CHECKBOOK_SANDBOX_VARIANT: NpmPackageVariant = {
  ...NYC_CHECKBOOK_HOSTING,
  variant: HOSTING_SANDBOX,
  runsAt: 'instance-sandbox',
  logging: [
    { statedBy: 'instance', role: 'sandbox-platform' },
    {
      statedBy: 'manifest',
      holder: 'Office of the New York City Comptroller',
      keeps: 'not-stated',
      statementUrl: 'https://comptroller.nyc.gov/privacy-policy/',
      readOn: '2026-10-19',
    },
  ],
};

/**
 * The NYC Checkbook source. Its `id` is the package name and repository
 * address: the publisher has not listed the server in the MCP Registry
 * (searched 2026-10-19). Optional, and switched on by `NYC_CHECKBOOK_HOSTING`
 * rather than configured with an address: a run is offered it only while the
 * switch is on.
 */
export const NYC_CHECKBOOK_ENTRY: CivicManifestEntry = {
  id: '@betanyc/nyc-checkbook-mcp@https://github.com/BetaNYC/nyc-checkbook-mcp',
  alias: 'nyc_checkbook',
  sourceId: 'nyc-checkbook',
  displayName: 'NYC Checkbook MCP Server',
  description:
    "New York City government spending as the Comptroller's Checkbook NYC publishes it: contracts (citywide, NYCHA and NYCEDC), payments to vendors, budget and revenue figures by agency and fiscal year, and payroll by agency and title. Covers New York City only. Does not hold the adopted budget's text, Council discretionary awards, or employee names.",
  freshness:
    'Live: every call queries Checkbook NYC as it stands, and the server spaces its requests at least 1.1 seconds apart.',
  freshnessSource:
    "The publisher's README for version 1.6.3, \"API notes and limits\" (github.com/BetaNYC/nyc-checkbook-mcp): every outbound request goes to the Checkbook NYC API, rate-limited to one request per second and spaced at least 1.1 seconds apart.",
  configuration: {
    addressVariable: NYC_CHECKBOOK_HOSTING_VARIABLE,
    requirement: 'optional',
  },
  tools: NYC_CHECKBOOK_TOOLS,
  toolNames: NYC_CHECKBOOK_TOOL_NAMES,
  guidance: {
    async fetchText() {
      return '';
    },
  },
  prompt: {
    citation: 'the contract ID, agency and fiscal year (for Checkbook NYC)',
    // The lock section lists the other sources with commas: a name without one.
    lockMention: 'the Checkbook server for New York City spending',
  },
  hostings: [NYC_CHECKBOOK_SANDBOX_VARIANT],
  // Ask first (D7b = A): its upstream is a recipient a reader's first consent
  // has not named, and that recipient's statement says nothing of API requests.
  consentDefault: 'ask-first',
  // The publisher's README: built by BetaNYC.
  publisher: 'BetaNYC',
};
