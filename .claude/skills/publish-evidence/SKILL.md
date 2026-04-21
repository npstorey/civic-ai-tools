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

## Capture modes

The skill supports two capture modes. Pick the one that matches what the user said, set `captureMode` in the JSON payload, and proceed.

| Mode | When to choose it | What gets captured |
|------|-------------------|---------------------|
| `single_final_turn` (default) | "publish this as evidence", "publish this analysis", "sign this answer" — the user points at a single question → answer cycle. | The last user prompt, the final assistant markdown response, and every civic MCP tool call made to answer it. Matches the website chat-flow shape. |
| `full_conversation` | "publish this whole session", "publish the full conversation", "include every turn", "publish everything we did" — the user wants the multi-turn record. | Every captured turn since the civic analysis started, rendered as a markdown transcript in `output`, plus every civic MCP tool call across those turns. Emits a structured turn list in `extensions["org.civicaitools.multi-turn"]`. |

If the user's phrasing is ambiguous (e.g., "publish this"), default to `single_final_turn` and confirm with the user before proceeding: *"Publishing just this final answer. Want the whole multi-turn session instead?"*

Modes can also be overridden at the command line with `--mode single_final_turn|full_conversation`, which takes precedence over the payload field. Don't use the flag in the Claude-driven flow; set the payload field instead.

### Session-boundary convention (full_conversation only)

Default capture starts at the **first Socrata or Data Commons MCP tool call** in the session, not at session start. Claude Code sessions often include unrelated setup before the user pivots to civic data; capturing from session start bundles noise into the evidence record.

The user can override this by saying something like "publish from the beginning of the session" or "include everything before the first tool call too." If overriding, **confirm with the user before proceeding** — session-start capture may include content the user didn't realise would be published. Record the chosen boundary in the payload as `sessionBoundary: "first_civic_tool_call"` (default) or `sessionBoundary: "session_start"`.

### Prompt-field selection (multi-turn)

Default: the first user message in the captured window becomes `prompt`. If that turn is clearly setup or clarification and a later turn carries the real analysis question ("ok now compare that to the Bronx", etc.), **promote the later turn to `prompt`** and keep the earlier context in the transcript. Either way, `prompt` should reflect the semantic analysis question, not a greeting or clarification.

### Turn roles

Use exactly these three values for `turns[].role`:

- `"user"` — a user message
- `"assistant"` — an assistant message
- `"tool"` — a tool result (when captured separately; usually tool results fold into the adjacent assistant turn)

### Token usage (multi-turn)

Sum `promptTokens` + `completionTokens` across **all captured turns**, not just the final turn. The evidence package's cost attribution reflects the full analysis cost; partial token accounting would misrepresent the dogfooded workload.

## Prerequisites

Before posting, confirm these are all true. If any is missing, ask the user before proceeding.

1. **Authentication is configured.** Check in this order (first match is enough):
   - **Preferred:** a saved bearer token at `~/.config/civic-ai-tools/credentials.json`. Confirm with `python3 .claude/skills/publish-evidence/publish.py --list-tokens`. If nothing is saved, tell the user to run `python3 .claude/skills/publish-evidence/publish.py --login` once — that starts a browser-based device-authorization flow and saves a 90-day token. The user can also revoke tokens anytime from the civicaitools.org dashboard.
   - **Legacy fallback:** `CIVICAITOOLS_SESSION_TOKEN` or `CIVICAITOOLS_SESSION_TOKEN_OP` set in the user's shell. Check presence without revealing the value: `[ -n "$CIVICAITOOLS_SESSION_TOKEN" ] || [ -n "$CIVICAITOOLS_SESSION_TOKEN_OP" ] && echo set || echo missing`. Never `echo`, `cat`, or otherwise print the value itself.

   If neither path is configured, prefer pointing the user at `--login` over the cookie path — it's the cleaner long-term story. See `civic-ai-tools-website/docs/api/evidence-publish.md#authentication`.

2. **The analysis actually ran.** There must be at least one Socrata or Data Commons MCP tool call earlier in this conversation with a real result. Do not publish hypothetical or placeholder analyses.

3. **A concrete final response exists** (or, in multi-turn mode, a coherent transcript). Publish what was actually said verbatim — partial completions and flagged uncertainties are fine; the attestation flow on civicaitools.org surfaces them.

## Inputs to assemble

You are assembling a JSON payload that you will pass to the bundled `publish.py` script. Gather the following from the conversation context. Ask for any you cannot infer rather than guessing.

| Field | How to populate |
|------|--------|
| `title` | A short, specific name for the analysis (≤80 chars, shown on the evidence detail page and in the URL slug). Derive from the user's original question. Ask the user to confirm. |
| `summary` | 2–4 sentences for a non-technical reader. Neutral third-person voice (never "I" or "we"). Describe what was analyzed, what the key finding was, and any caveats or partial results. |
| `captureMode` | `"single_final_turn"` (default) or `"full_conversation"`. See "Capture modes" above. |
| `prompt` | Single-turn: the user's original analysis question, verbatim. Multi-turn: the first user message in the captured window, OR a later semantic analysis question if the first turn is setup/clarification. Never a "publish this" follow-up. |
| `output` | Single-turn: the assistant's final markdown response verbatim. Multi-turn: a rendered markdown transcript of every captured turn with `### Turn N — User` / `### Turn N — Assistant` headers (matching `turns[].index` and `turns[].role`). Preserve tables, citations, and caveats. |
| `turns[]` | Required when `captureMode` is `full_conversation`. Array of `{ index, role, content }` objects, strictly increasing `index`. Roles are `user`, `assistant`, or `tool`. See "Turn roles" above. |
| `sessionBoundary` | Optional, full_conversation only. `"first_civic_tool_call"` (default) or `"session_start"`. Confirm with the user before setting to `session_start`. |
| `model` | `anthropic/claude-opus-4-7` if you are Claude Opus 4.7 ("Opus 4.7" appears in the session's model identifier). Use the exact model slug from the current session. |
| `portal` | `data.cityofnewyork.us` if any Socrata tool calls used NYC Open Data; otherwise the portal used; otherwise `n/a` for Data-Commons-only analyses. |
| `promptVisibility` | `full_text` by default — the prompt goes into the package in the clear. Switch to `hash_only` only if the user explicitly asks to omit their prompt text. |
| `tokenUsage.promptTokens`, `tokenUsage.completionTokens` | Single-turn: best available estimates for the one turn. Multi-turn: **sum across all captured turns**. If you cannot reasonably estimate, omit the inner fields (send an empty `{}`). |
| `duration_ms` | Rough end-to-end wall-clock in milliseconds (single-turn) or the span of the captured turns (multi-turn). If unknown, omit. |
| `toolCalls[]` | One entry per civic MCP tool call made in the captured window — see below. |

### `toolCalls[]` reconstruction

Walk through every tool call in the captured window. For each one, add an entry:

- `name` — the underlying MCP tool name. Strip any `mcp__socrata__` / `mcp__data-commons__` prefix (e.g., `mcp__socrata__get_data` → `get_data`, `mcp__data-commons__search_indicators` → `search_indicators`).
- `source` — `"socrata"` or `"data-commons"` based on the tool prefix. Exactly one of those two values.
- `args` — the full arguments object you sent to the tool. Do not rewrite or trim; the server stores these verbatim in `queries[].arguments`.
- `resultSummary` — optional `{ rows: number, columns: number }` if the tool result has tabular shape you can count. Skip otherwise.
- `duration_ms` — optional. Skip unless you have a real number.
- `operationType` — optional. For Socrata, the server auto-derives from `args.type` (`query`, `catalog`, `metadata`, `metrics`); pass through the `args.type` value if you have it. For Data Commons, provide `search` for `search_indicators` and `query` for `get_observations`.
- `turnIndex` — **multi-turn only**. The `turns[].index` the call belongs to. Used to emit `turn.index` on the `mcp_tool_call` span so future tooling can reconstruct turn grouping from the trace. The server drops this field at the `queries[]` boundary — don't rely on it being surfaced in the package's top-level `queries[]`.

The script synthesizes a minimal OpenTelemetry trace with `mcp_tool_call` spans carrying `mcp.source`, `tool.name`, and `tool.operation_type` — that drives the server's PROV-O graph and `dataSources[]` builder, so **every MCP tool call must be represented here** for attribution to be correct.

### Optional: skill guidance capture

If the civic-ai-tools repo's skill files are present on disk, you may read them and include the composed text as `skillText` so the published package captures the guidance that shaped the analysis. Use the local copies at `civic-ai-tools/docs/skills/base.md` + `civic-ai-tools/docs/skills/local.md` + `civic-ai-tools/docs/skills/data-commons.md` (concatenate in that order with `\n\n---\n\n` separators). Also set `skillMcpServerUrl` to `"local-stdio (civic-ai-tools/.mcp.json)"` to record that the MCP servers were loaded locally by Claude Code, not fetched over HTTP. This step is optional — omit both fields to publish without a skill-fetch span.

## Large-content handling (blob references)

Per-field inline threshold: **512 KB** (JSON-encoded bytes). The script uploads any field above that to Vercel Blob via the website's `POST /api/blob/upload-token` handshake and references the content by SHA-256 hash. This keeps the POST body under the Next.js ~4 MB cap even for long multi-turn sessions.

Fields that can become a BlobRef: `output`, `trace`, `skillMetadataOverride.skillText`. When `trace` is uploaded as a BlobRef, the server cannot walk spans to extract skill metadata; the script automatically emits `skillMetadataOverride` carrying `systemPromptHash`, `mcpServerUrl`, and `skillText` so those fields land in the package.

The threshold can be overridden with `--max-inline-bytes N` (e.g., force-inline with a very high number for debugging, or force-blob with a low number to exercise the upload path). Don't change it without reason — 512 KB is tuned to keep request bodies comfortably under the cap while avoiding blob overhead for small content.

## How to invoke the script

1. Write the assembled payload to a temporary JSON file outside the repo (e.g., `/tmp/publish-evidence-<timestamp>.json`) so it never gets accidentally committed.
2. Preview it first:

   ```bash
   python3 .claude/skills/publish-evidence/publish.py --payload /tmp/publish-evidence-<timestamp>.json --dry-run
   ```

   This prints a redacted summary — no prompt/output text, no tool args, no session token — showing `captureMode`, turn count, per-field encoding (inline vs blob), total body bytes, and extension keys. Blob uploads are skipped in dry-run; oversize fields exit 2 with an instructive message so you can raise `--max-inline-bytes` or proceed to the live publish. Share the summary with the user and ask for go/no-go.

3. On confirmation, publish for real:

   ```bash
   python3 .claude/skills/publish-evidence/publish.py --payload /tmp/publish-evidence-<timestamp>.json
   ```

   The script resolves auth in this order and uses the first that matches: saved bearer token → `CIVICAITOOLS_SESSION_TOKEN` → `CIVICAITOOLS_SESSION_TOKEN_OP`. Never echo those values. Never pass them on the command line. Oversized fields are uploaded to Vercel Blob before the `/api/evidence` POST; each upload uses the same credentials as the main POST.

4. On success the script prints a JSON result with `slug`, `evidenceUrl`, `packageHash`, and `readbackUrl`. Show the user:
   - The full evidence URL (`https://civicaitools.org/evidence/<slug>`)
   - The package hash (first 12 chars is fine)
   - A one-line next-step hint: "Open the URL to run adversarial / consistency attestations from the dashboard."

5. Delete the temporary payload file when done. It contains the prompt and full output; keep your workspace clean.

## Error handling

- **Exit 1 (auth)** — session cookie is missing, invalid, or expired. Surface the script's stderr to the user verbatim; do not speculate about fixes beyond what the error says.
- **Exit 2 (payload)** — your payload violated the schema (including oversize fields in dry-run). Read the stderr, fix the field, try the `--dry-run` again. Do not re-POST.
- **Exit 3 (network/HTTP)** — transient or server-side. Applies to both `/api/evidence` and `/api/blob/upload-token` / Vercel Blob uploads. Show the error to the user; offer to retry once. Do not retry automatically without asking.
- **Exit 4 (unexpected)** — treat as a bug. Preserve the stderr output; don't retry.

## Privacy / secret hygiene

- Never `cat`, `head`, `tail`, `echo`, or otherwise print `CIVICAITOOLS_SESSION_TOKEN`, the value referenced by `CIVICAITOOLS_SESSION_TOKEN_OP`, or the contents of `~/.config/civic-ai-tools/credentials.json`.
- Never include a session-token value, bearer token, or `op://` reference in the JSON payload, in a commit, or in chat output.
- The credentials file is written with mode `0600` on the file and `0700` on the parent directory. Don't loosen those. If you need to inspect what's saved, use `publish.py --list-tokens` (display-safe summary — prefix + expiry + scope only).
- The payload JSON contains the prompt text and full output (or transcript) — anything the user would see on the published evidence page. Do not paste it into another repo or share it outside the immediate conversation.
- If any part of the captured content is sensitive and the user wants to omit their prompt text from the public record, set `promptVisibility: "hash_only"` (the server hashes it and stores only the hash). There is no equivalent for the transcript — if any transcript turn should not be public, switch back to `single_final_turn` or omit that content before composing the transcript.
