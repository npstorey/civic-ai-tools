---
name: publish-evidence
description: Publish the current Claude Code analysis to the civicaitools.org evidence registry as a cryptographically signed, timestamped, Rekor-logged evidence package. Invoke when the user has just completed a civic-data analysis (typically using the Socrata and/or Data Commons MCP tools) and says something like "publish this as evidence", "sign this analysis", "publish to civicaitools.org", or "make this a verifiable package."
allowed-tools: Bash(python3 *), Read, Write
---

# publish-evidence

This skill turns the current Claude Code conversation's civic-data analysis into a signed evidence package on civicaitools.org. It wraps `POST /api/evidence`; the endpoint contract lives in `civic-ai-tools-website/docs/api/evidence-publish.md`.

## When to invoke

The user has just finished an analysis in this session using the Socrata MCP server (`mcp__socrata__*` tools) and/or the Data Commons MCP server (`mcp__data-commons__*` tools). They now want to publish the analysis as a verifiable record. Typical phrasings:

- "publish this as evidence"
- "publish to civicaitools.org"
- "sign this analysis"
- "make this a verifiable package"

Do **not** invoke this skill for analyses the user has not asked to publish, or for non-civic conversations (code questions, chit-chat, etc.). Do not invoke it to re-publish a package that was already published in this session; just quote the URL from the prior turn.

## Prerequisites

Before posting, confirm these are all true. If any is missing, ask the user before proceeding.

1. **Authentication is configured.** One of these env vars must be set in the user's shell environment:
   - `CIVICAITOOLS_SESSION_TOKEN` — the value of the `__Secure-next-auth.session-token` cookie from a signed-in civicaitools.org browser session, OR
   - `CIVICAITOOLS_SESSION_TOKEN_OP` — a 1Password reference (`op://...`) resolved at run time.

   You can check presence without revealing the value: `[ -n "$CIVICAITOOLS_SESSION_TOKEN" ] || [ -n "$CIVICAITOOLS_SESSION_TOKEN_OP" ] && echo set || echo missing`. Never `echo`, `cat`, or otherwise print the value itself. If missing, point the user to the "Obtaining a session cookie" section of `civic-ai-tools-website/docs/api/evidence-publish.md` and stop.

2. **The analysis actually ran.** There must be at least one Socrata or Data Commons MCP tool call earlier in this conversation with a real result. Do not publish hypothetical or placeholder analyses.

3. **A concrete final response exists.** The assistant's answer to the user's original civic question should be present in the conversation and reflect what the tool calls returned. If the prior response punted on indicators or flagged data-quality issues, that's fine — publish it verbatim; the attestation flow on civicaitools.org surfaces partial completions.

## Inputs to assemble

You are assembling a JSON payload that you will pass to the bundled `publish.py` script. Gather the following from the conversation context. Ask for any you cannot infer rather than guessing.

| Field | How to populate |
|------|--------|
| `title` | A short, specific name for the analysis (≤80 chars, shown on the evidence detail page and in the URL slug). Derive from the user's original question. Ask the user to confirm. |
| `summary` | 2–4 sentences for a non-technical reader. Neutral third-person voice (never "I" or "we"). Describe what was analyzed, what the key finding was, and any caveats or partial results. |
| `prompt` | The user's original analysis question, verbatim — the question that kicked off the tool calls. NOT the follow-up "publish this". |
| `output` | The assistant's final markdown response to the analysis question. Verbatim; preserve tables, citations, caveats, flagged uncertainties. |
| `model` | `anthropic/claude-opus-4-7` if you are Claude Opus 4.7 ("Opus 4.7" appears in the session's model identifier). Use the exact model slug from the current session. |
| `portal` | `data.cityofnewyork.us` if any Socrata tool calls used NYC Open Data; otherwise the portal used; otherwise `n/a` for Data-Commons-only analyses. |
| `promptVisibility` | `full_text` by default — the prompt goes into the package in the clear. Switch to `hash_only` only if the user explicitly asks to omit their prompt text. |
| `tokenUsage.promptTokens`, `tokenUsage.completionTokens` | Best available estimates. If you cannot reasonably estimate, omit the inner fields (send an empty `{}`); the server accepts that. |
| `duration_ms` | Rough end-to-end analysis wall-clock in milliseconds. If unknown, omit. |
| `toolCalls[]` | One entry per MCP tool call made in the analysis — see below. |

### `toolCalls[]` reconstruction

Walk through every tool call in this conversation's context. For each one, add an entry:

- `name` — the underlying MCP tool name. Strip any `mcp__socrata__` / `mcp__data-commons__` prefix before populating (e.g., `mcp__socrata__get_data` → `get_data`, `mcp__data-commons__search_indicators` → `search_indicators`).
- `source` — `"socrata"` or `"data-commons"` based on the tool prefix. Exactly one of those two values.
- `args` — the full arguments object you sent to the tool. Do not rewrite or trim; the server stores these verbatim in `queries[].arguments`.
- `resultSummary` — optional `{ rows: number, columns: number }` if the tool result has tabular shape you can count. Skip otherwise.
- `duration_ms` — optional. Skip unless you have a real number.
- `operationType` — optional. For Socrata, the server auto-derives from `args.type` (`query`, `catalog`, `metadata`, `metrics`); pass through the `args.type` value if you have it. For Data Commons, provide `search` for `search_indicators` and `query` for `get_observations`.

The script synthesizes a minimal OpenTelemetry trace with `mcp_tool_call` spans carrying `mcp.source`, `tool.name`, and `tool.operation_type` — that drives the server's PROV-O graph and `dataSources[]` builder, so **every MCP tool call must be represented here** for attribution to be correct.

### Optional: skill guidance capture

If the civic-ai-tools repo's skill files are present on disk, you may read them and include the composed text as `skillText` so the published package captures the guidance that shaped the analysis. Use the local copies at `civic-ai-tools/docs/skills/base.md` + `civic-ai-tools/docs/skills/local.md` + `civic-ai-tools/docs/skills/data-commons.md` (concatenate in that order with `\n\n---\n\n` separators). Also set `skillMcpServerUrl` to `"local-stdio (civic-ai-tools/.mcp.json)"` to record that the MCP servers were loaded locally by Claude Code, not fetched over HTTP. This step is optional — omit both fields to publish without a skill-fetch span.

## How to invoke the script

1. Write the assembled payload to a temporary JSON file outside the repo (e.g., `/tmp/publish-evidence-<timestamp>.json`) so it never gets accidentally committed.
2. Preview it first:

   ```bash
   python3 .claude/skills/publish-evidence/publish.py --payload /tmp/publish-evidence-<timestamp>.json --dry-run
   ```

   This prints a redacted summary — no prompt/output text, no tool args, no session token. Share the summary with the user and ask for go/no-go before publishing.

3. On confirmation, publish for real:

   ```bash
   python3 .claude/skills/publish-evidence/publish.py --payload /tmp/publish-evidence-<timestamp>.json
   ```

   The script reads `CIVICAITOOLS_SESSION_TOKEN` (or `CIVICAITOOLS_SESSION_TOKEN_OP`) from the environment. Never echo those values. Never pass them on the command line.

4. On success the script prints a JSON result with `slug`, `evidenceUrl`, `packageHash`, and `readbackUrl`. Show the user:
   - The full evidence URL (`https://civicaitools.org/evidence/<slug>`)
   - The package hash (first 12 chars is fine)
   - A one-line next-step hint: "Open the URL to run adversarial / consistency attestations from the dashboard."

5. Delete the temporary payload file when done. It contains the prompt and full output; keep your workspace clean.

## Error handling

- **Exit 1 (auth)** — session cookie is missing, invalid, or expired. Surface the script's stderr to the user verbatim; do not speculate about fixes beyond what the error says.
- **Exit 2 (payload)** — your payload violated the schema. Read the stderr, fix the field, try the `--dry-run` again. Do not re-POST.
- **Exit 3 (network/HTTP)** — transient or server-side. Show the error to the user; offer to retry once. Do not retry automatically without asking.
- **Exit 4 (unexpected)** — treat as a bug. Preserve the stderr output; don't retry.

## Privacy / secret hygiene

- Never `cat`, `head`, `tail`, `echo`, or otherwise print `CIVICAITOOLS_SESSION_TOKEN` or the value referenced by `CIVICAITOOLS_SESSION_TOKEN_OP`.
- Never include the session-token value or an `op://` reference in the JSON payload, in a commit, or in chat output.
- The payload JSON contains the prompt text and full output — anything the user would see on the published evidence page. Do not paste it into another repo or share it outside the immediate conversation.
- If the user's prompt text is sensitive and they don't want it public, set `promptVisibility: "hash_only"` (the server hashes it and stores only the hash).

## Long-term cleanup

Session-cookie auth is a dogfooding shim, not a durable contract. The cleaner long-term path (scoped API tokens) is tracked in [civic-ai-tools-website#73](https://github.com/npstorey/civic-ai-tools-website/issues/73). If the user asks for a better auth pattern, point them at that issue.
