# Agent Receipts Evaluation

An evaluation of the [Agent Receipts](https://github.com/agent-receipts/ar) open protocol against the civic-ai-tools evidence system's OpenTelemetry trace layer. The question: should Agent Receipts replace or complement the current OTel-based capture shipped in civic-ai-tools-website v0.6.0?

*Last updated: April 2026*

---

## Summary

Agent Receipts is a draft v0.1 protocol for capturing per-call receipts of agent tool invocations as W3C Verifiable Credentials, with an Ed25519 signature on every receipt and an inter-call hash chain. At the time of this evaluation the project is ~12 days old, has one substantive maintainer, and its reference MCP proxy cannot wrap the remote HTTPS Socrata MCP server that civic-ai-tools depends on.

**Decision:** keep the current OTel trace layer. Revisit if specific upstream blockers clear (see [Revisit conditions](#revisit-conditions)). The evidence package extensions architecture shipped in website#54 allows future adoption as `org.agentreceipts.chain` without touching the trace layer.

---

## Project state (as of 2026-04-14)

| Field | Value |
|-------|-------|
| Repository | [agent-receipts/ar](https://github.com/agent-receipts/ar) |
| Created | 2026-04-02 (~12 days old) |
| Stars | 5 |
| Contributors | Effectively 1 — ojongerius (Otto Jongerius, ~180 commits) + dependabot |
| Open issues | ~41 |
| License | Apache-2.0 (code), MIT (`spec/`) |
| Governance | Local `spec/GOVERNANCE.md`, no W3C / IETF / CG process |
| Spec version | v0.1.0 (draft, dated 2026-03-31) |
| Latest `mcp-proxy` release | `mcp-proxy/v0.3.6` (2026-04-13) |

---

## What Agent Receipts v0.1 captures

The core artifact is a **receipt** issued as a W3C Verifiable Credential.

### Format and cryptography
- W3C Verifiable Credentials 2.0 + JSON-LD
- Ed25519Signature2020 signature on every receipt
- RFC 8785 canonicalization (JSON Canonical Serialization) before hashing or signing
- Optional RFC 3161 trusted timestamps via `action.trusted_timestamp`
- Hash-chained through `previous_receipt_hash` + a monotonic `sequence` within a `chain_id`
- **Chains are strictly linear in v0.1** — no parallel tool calls can be represented within a single chain

### Per-call capture (`action` object)
- `action.type` — standardized taxonomy (`filesystem.*`, `data.*`, …)
- `action.parameters_hash` — SHA-256 of the RFC 8785 canonical form of parameters; **raw parameters are never stored**
- `action.timestamp` — ISO 8601
- `action.risk_level` — required, one of `low | medium | high | critical`
- `action.target.system` and `action.target.resource`

### What v0.1 does not capture
- **Response body** — never stored
- **Response hash** — [#153](https://github.com/agent-receipts/ar/issues/153) is an *open* maintainer proposal to add a response hash as an optional field. Zero comments, not shipped.
- **LLM metadata** — model, token counts, cost — declared outside protocol scope
- **Provenance graph** — no PROV-O or equivalent; outside scope

---

## mcp-proxy reference implementation

The reference runtime is a Go binary at `mcp-proxy/` with an embedded SQLite store. It wraps an MCP server **child process's stdin/stdout** and issues a receipt per tool call. Beyond the core spec it includes a policy engine (`pass | flag | pause | block`), secret redaction, and intent tracking.

### Blocking limitation for civic-ai-tools
The proxy is **stdio-only** and cannot wrap a remote HTTPS MCP server. The civic-ai-tools Socrata MCP server is deployed on Render at `https://socrata-mcp.civicaitools.org` and is called over HTTP/SSE from the website. The maintainer has filed their own open enhancement request for remote-proxy support: [#124 — "feat: remote-hosted mcp-proxy for Claude mobile and other remote-only MCP clients"](https://github.com/agent-receipts/ar/issues/124). Still open, no progress.

### Known reliability issue
[#158](https://github.com/agent-receipts/ar/issues/158) — the proxy drops stdio connections under parallel load. Relevant because civic-ai-tools analyses frequently issue several tool calls in a short window.

### SDKs
- `@agnt-rcpt/sdk-ts` (npm)
- `agent-receipts` (PyPI)
- `github.com/agent-receipts/ar/sdk/go`

Cross-SDK correctness bugs are still being worked through: [#82](https://github.com/agent-receipts/ar/issues/82), [#86](https://github.com/agent-receipts/ar/issues/86) (RFC 8785 ordering), [#83](https://github.com/agent-receipts/ar/issues/83), [#84](https://github.com/agent-receipts/ar/issues/84) (VC 1.x vs 2.0 field divergence), [#118](https://github.com/agent-receipts/ar/issues/118) (Go `parameters_hash` canonicalization).

---

## Current OTel implementation (baseline for comparison)

Lives in `civic-ai-tools-website/src/lib/evidence/trace.ts`. A custom OTel-compatible trace builder with six span types:

- `analysis` (root)
- `skill_fetch`
- `llm_inference` (per iteration)
- `mcp_tool_call` (per tool)
- `synthesis`

Signing and transparency are handled at the **package** level (not per call) via `src/lib/evidence/sign.ts`: Ed25519 signature on the package hash, RFC 3161 timestamp from freetsa.org, Rekor transparency-log publish. Storage is Neon PostgreSQL for metadata and Vercel Blob for package files. A full PROV-O provenance graph is generated from the trace at publish time.

---

## Comparison

| Artifact | Current OTel | Agent Receipts v0.1 | Winner |
|---|---|---|---|
| Full ordered trace | Full OTel JSON | No trace concept — receipts discrete | OTel |
| Tool args capture | Full raw args | `parameters_hash` only | OTel |
| Response hash | SHA-256 captured | Not shipped (#153 open) | OTel |
| Dataset catalog | Derived + timestamped | `target.resource` only | OTel |
| LLM cost/tokens | Per-inference + aggregated | Outside scope | OTel |
| Per-call Ed25519 signature | Package-level only | Per-receipt | Agent Receipts |
| Hash chain across calls | Packages independent | `previous_receipt_hash` + sequence | Agent Receipts |
| W3C VC 2.0 format | OTel + PROV-O | Yes | Agent Receipts (if VC matters) |
| PROV-O provenance graph | Complete, 100% trace utilization | Outside scope | OTel |
| Sigstore/Rekor transparency log | Package-level, shipped | Not in spec | OTel |

Net: OTel is a **strict superset** of what Agent Receipts v0.1 offers for MCP tool-call capture, except for (a) per-call signing and (b) the inter-call hash chain. Both of those can be added later as an evidence package extension (`org.agentreceipts.chain`) without touching the trace layer.

---

## Decision

**Option A — keep the current OTel trace layer. Do not adopt Agent Receipts at this time.**

Rationale:

1. OTel captures more than Agent Receipts v0.1 offers for this use case.
2. `mcp-proxy` cannot wrap the remote HTTPS Socrata MCP server ([#124](https://github.com/agent-receipts/ar/issues/124)).
3. Package-level Ed25519 + Sigstore/Rekor already gives equivalent end-to-end auditability via a different topology (one signature over the full package, anchored in a public transparency log).
4. The project is too early (5 stars, 1 substantive maintainer, 12 days old, ~41 open issues, cross-SDK correctness bugs) to absorb production risk before the M8 demo deadline.
5. The evidence package extensions architecture shipped in v0.6.0 via [website#54](https://github.com/npstorey/civic-ai-tools-website/issues/54) was designed for exactly this kind of interop — post-M8 adoption as `org.agentreceipts.chain` is straightforward and does not require abandoning the current trace format.

---

## Revisit conditions

Any one of the following would justify re-evaluating:

- Agent Receipts ships remote-proxy support ([#124](https://github.com/agent-receipts/ar/issues/124) closed)
- Agent Receipts ships response hashing ([#153](https://github.com/agent-receipts/ar/issues/153) merged)
- Project matures — ≥2–3 substantive contributors, governance under W3C CG / IETF / similar
- An external stakeholder explicitly asks about Agent Receipts compatibility for a civic-ai-tools evidence package

---

## Links

- Repo: https://github.com/agent-receipts/ar
- Spec v0.1: https://github.com/agent-receipts/ar/blob/main/spec/spec/agent-receipt-spec-v0.1.md
- `mcp-proxy` README: https://github.com/agent-receipts/ar/blob/main/mcp-proxy/README.md
- `mcp-proxy` v0.3.6 release: https://github.com/agent-receipts/ar/releases/tag/mcp-proxy/v0.3.6
- Issue #124 — remote proxy blocker: https://github.com/agent-receipts/ar/issues/124
- Issue #153 — response hashing proposal: https://github.com/agent-receipts/ar/issues/153
