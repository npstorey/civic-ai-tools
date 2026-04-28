# Publishing a Claude Code analysis as signed evidence

The `publish-evidence` skill lets a Claude Code session post a completed civic-data analysis to [civicaitools.org](https://civicaitools.org) as a cryptographically signed, timestamped, Rekor-logged evidence package — the same kind of package the website's chat flow produces. It's intended for dogfooding frontier-model analyses that the website's cost-constrained chat flow cannot run at full depth.

The skill lives at `.claude/skills/publish-evidence/` in this repo. It is auto-discovered by Claude Code when you open civic-ai-tools as the working directory.

## What you need

- **Claude Code**, pointing at this repo as cwd.
- **The Socrata and Data Commons MCP servers** configured in `.mcp.json` (already set up in this repo via `./scripts/setup.sh`).
- **A civicaitools.org GitHub login.** Sign in once at [civicaitools.org](https://civicaitools.org) before starting the device-authorization flow below.
- **Python 3.8+** on PATH (the bundled script is stdlib-only).

## One-time setup: log in with the device flow

The preferred auth path is an OAuth 2.0 device-authorization flow that saves a 90-day bearer token to `~/.config/civic-ai-tools/credentials.json` (file mode `0600`). Run it once:

```bash
python3 civic-ai-tools/.claude/skills/publish-evidence/publish.py --login
```

The script:

1. Asks the civicaitools.org platform for a short user code and a verification URL.
2. Opens your browser to the verification URL with the code prefilled (use `--no-browser` to disable). If you're not signed in, you'll hit a GitHub OAuth flow first.
3. Waits while you click **Approve** on the authorization page. The page shows the client name ("Claude Code publish-evidence skill" by default; override with `--name "something else"`) and the scope (`evidence:publish`).
4. Saves the returned bearer token to `~/.config/civic-ai-tools/credentials.json` and prints a summary.

Useful follow-ups:

- `publish.py --list-tokens` — show saved tokens (display-safe: prefix + scope + expiry only, never the full value).
- `publish.py --logout` — delete the token for the current base URL from the credentials file. This does **not** revoke the token server-side; visit the [Dashboard → Tokens tab](https://www.civicaitools.org/dashboard) to revoke.
- Visit the same Dashboard tab anytime to see active tokens, last-used timestamps, and a Revoke button per token.

Tokens are valid for 90 days. When one expires or you revoke it, re-run `--login` to get a fresh token.

### Legacy alternative: session cookie (still supported)

If you already use the session-cookie path, it keeps working indefinitely. Responses now carry an `X-Auth-Deprecated: cookie` header as a nudge toward the bearer-token path.

<details>
<summary>Show legacy setup</summary>

1. Open [civicaitools.org](https://civicaitools.org) in your browser and sign in with GitHub.
2. Open browser devtools → Application (Chrome) or Storage (Firefox) → Cookies → `https://civicaitools.org`.
3. Copy the **value** of the `__Secure-next-auth.session-token` cookie.
4. Either:

   ```bash
   # plain env var
   export CIVICAITOOLS_SESSION_TOKEN='<paste-cookie-value-here>'
   # or 1Password reference
   export CIVICAITOOLS_SESSION_TOKEN_OP='op://<vault>/<item>/<field>'
   ```

The session token expires — when you see `401 Unauthorized`, either re-copy the cookie or switch to `publish.py --login`.

</details>

Full authentication contract: [`civic-ai-tools-website/docs/api/evidence-publish.md#authentication`](../../civic-ai-tools-website/docs/api/evidence-publish.md#authentication).

## Invoking the skill

1. Open a fresh Claude Code session with civic-ai-tools as the working directory. Use a frontier model (Opus 4.7 recommended for multi-indicator or cross-source analyses).
2. Ask your civic-data question naturally. Claude uses the Socrata and/or Data Commons MCP tools to answer.
3. When the analysis is complete and you're satisfied with the answer, say something like:
   > Publish this as evidence.

   The skill auto-triggers on phrases like "publish this as evidence", "publish to civicaitools.org", "sign this analysis", or "make this a verifiable package."
4. Claude will:
   - Read the session JSONL at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` to capture prose content (`prompt`, `output`, `turns[].content`), tool args, and per-invocation token usage verbatim. (See "Verbatim capture from JSONL" below for what this means and why.)
   - Summarize what it's about to publish (title, summary, token usage, source list, capture mode, capture method).
   - Write the payload to a temp file and run the publish script with `--dry-run` — which validates schema, runs the negative pattern scan, and prints a redacted preview.
   - Ask for your go-ahead.
5. Confirm, and the skill POSTs to `civicaitools.org/api/evidence`. On success it prints:
   - The public URL (`https://civicaitools.org/evidence/<slug>`)
   - The package hash
   - A readback URL (`/api/evidence/<slug>`) for programmatic inspection

6. Open the URL to run consistency or adversarial attestations from the dashboard.

## Verbatim capture from JSONL

Per [ADR-0003](./adr/0003-evidence-capture-method.md), packages published from this skill carry `captureMethod: "claude-code-jsonl-readback"` — meaning prose content and tool args are read directly from the Claude Code session log on disk (`~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`), not reconstructed from the publishing model's in-context memory. This matters because:

- The cryptographic signature on the package attests "this content was published and has not been tampered with since," not "this content matches the original session." For chat-flow packages those are the same (the website server captured bytes from the model stream); for skill-published packages they only line up if the skill reads the session log verbatim.
- Earlier publishes that paraphrased from memory introduced fabricated bracketed annotations (e.g., `[Tool calls: load Socrata MCP tools via ToolSearch...]` that were never emitted in the original session) and hand-typed token counts that have been observed off by ~14× on prompt tokens.

Two safeguards keep the skill on the verbatim path:

1. **JSONL readback in `SKILL.md`.** The skill instructs the publishing model to walk the session JSONL line-by-line, group assistant content blocks by `message.id`, filter to `text`-typed blocks for prose, copy `tool_use.input` verbatim for tool args, and sum `usage.input_tokens + cache_creation_input_tokens + cache_read_input_tokens` and `usage.output_tokens` once per unique `message.id` for token totals.
2. **Negative pattern scan in `publish.py --dry-run`.** The script scans `prompt`, `output`, and every `turns[].content` for substrings that only appear when prose was paraphrased — `<thinking>` tags, the literal text `tool_use`, `toolu_*` IDs, and `signature:` fields. Any match exits non-zero with the field name and a snippet, so you can re-read that field from the JSONL rather than ship a paraphrased package.

If the dry-run scan flags a field, the fix is to re-read it from the JSONL — not to scrub the markers out of paraphrased prose.

## Capture modes: single turn vs. full conversation

Claude Code sessions are often multi-turn — exploratory tool use, refinement prompts, mid-session pivots. The skill supports two ways to capture a session:

- **Single final turn (default).** Captures your last question + Claude's final answer + every civic MCP tool call used to produce that answer. Matches the shape of analyses published from the website's chat flow. Say "publish this as evidence" or "sign this answer" to invoke.

- **Full conversation.** Captures every turn since the analysis started and publishes them as a markdown transcript, with structured turn metadata in an `org.civicaitools.multi-turn` extension block. Say "publish this whole session", "publish the full conversation", or "include every turn" to invoke. Large transcripts and traces are automatically uploaded to Vercel Blob and referenced by SHA-256 hash so the POST body stays under the request size cap.

**Session boundary.** In full-conversation mode, capture defaults to starting at the **first Socrata or Data Commons MCP tool call** in the session — Claude Code sessions often include unrelated setup before the civic analysis begins. To include everything from the start of the session (less common, and worth double-checking before you publish), say "publish from the beginning of the session." Claude will confirm before widening the window.

**Prompt field selection.** Claude picks one turn to surface as the analysis `prompt`. By default that's the first captured user message; if the first turn is clearly setup or clarification, Claude promotes the later semantic question ("now compare that to the Bronx") and keeps the earlier context in the transcript.

**Token usage.** Multi-turn publishes sum `promptTokens` + `completionTokens` across every captured turn, not just the final one. The published cost attribution reflects the full analysis workload.

### Example: publishing a multi-turn session

**In Claude Code (Opus 4.7, civic-ai-tools cwd, MCP servers configured):**

> What's the median household income in Manhattan?

Claude searches Data Commons, fetches `Median_Income_Household` for `geoId/36061`, returns an answer.

> Now compare that to the Bronx and Brooklyn.

Claude fetches the same indicator for `geoId/36005` and `geoId/36047`, returns a three-borough comparison.

> And include the margin of error on each figure.

Claude fetches the MoE observations, returns the comparison with ±ranges.

> Publish this whole session as evidence.

The skill:
- Sets `captureMode: "full_conversation"`, collects all six turns into `turns[]`, tags each civic tool call with its `turnIndex`.
- Renders `output` as a markdown transcript (`### Turn 1 — User`, `### Turn 1 — Assistant`, etc.).
- Sums token usage across all turns.
- Runs `--dry-run` and shows you the redacted preview (turn count, body bytes, whether fields are inline or blob-referenced).
- On confirmation, POSTs. If the transcript or trace is over 512 KB, they upload to Vercel Blob first; the evidence package ends up with BlobRef entries the detail page resolves server-side.

The published package has `dataSources[]` listing Data Commons, `queries[]` containing every `get_observations` call across all turns, a PROV-O graph reflecting Data Commons provenance, and an `extensions["org.civicaitools.multi-turn"]` block that future UI can surface turn-by-turn.

## End-to-end example

**In Claude Code (Opus 4.7, civic-ai-tools cwd, MCP servers configured):**

> How many 311 noise complaints did Manhattan receive last year?

Claude calls `mcp__socrata__get_data` against dataset `erm2-nwe9` with a count query and returns a final markdown response.

> Publish this as evidence.

The skill collects:
- `title`: "Manhattan 311 noise complaints, 2025"
- `summary`: a neutral two-sentence description
- `prompt`: the original question
- `output`: the markdown answer
- `toolCalls[]`: one entry for the `get_data` call with `source: "socrata"`
- `model`: `anthropic/claude-opus-4-7`
- `portal`: `data.cityofnewyork.us`

Writes `/tmp/publish-evidence-<timestamp>.json`, runs `--dry-run`, shows the redacted preview, and asks for confirmation. On confirmation, POSTs. Final output:

```
https://civicaitools.org/evidence/manhattan-311-noise-complaints-2025-<hash>
```

The published package will have `dataSources[]` listing Socrata with the NYC portal, `queries[]` containing the `get_data` call, and a PROV-O graph with one `urn:civic-evidence:mcp-server:socrata` agent.

## Direct script invocation (optional)

If you're scripting around the skill or want to publish without a Claude conversation in the loop, you can run the publish script directly:

```bash
python3 civic-ai-tools/.claude/skills/publish-evidence/publish.py \
    --payload /path/to/payload.json \
    --dry-run   # optional: preview without POSTing
```

The payload schema is documented at the top of `publish.py` and in the `SKILL.md` file alongside it. In short: `title`, `summary`, `prompt`, `output`, `toolCalls[]` with `name` + `source` + `args` per call, and optional `captureMode`, `captureMethod`, `turns[]`, `sessionBoundary`, `model`, `portal`, `tokenUsage`, `duration_ms`, `extensions`, `skillText`, `skillMcpServerUrl`. `captureMethod` defaults to `"claude-code-jsonl-readback"` and is the only value the skill should set; the wider enum (`chat-flow-stream`, `claude-code-self-report`) is reachable for completeness only.

When publishing without a Claude conversation in the loop, you are responsible for the JSONL readback yourself — copying prose into `prompt` / `output` / `turns[].content` from a Python string literal you typed will trip the negative pattern scan as soon as the captured session contained any thinking blocks or tool-use IDs.

CLI flags worth knowing:

- `--mode single_final_turn|full_conversation` — override the payload's `captureMode` without editing the file.
- `--max-inline-bytes N` — per-field inline threshold (default 524288). Fields above this threshold upload to Vercel Blob via `/api/blob/upload-token` and are referenced by SHA-256 hash in the evidence package.
- `--dry-run` — validate the payload, run the negative pattern scan, print a redacted preview, and exit without POSTing or uploading. Useful for debugging payload shape and for catching accidental paraphrase before publication.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` (bearer) | Saved token expired or was revoked. | Run `publish.py --logout && publish.py --login` to start a fresh device flow. |
| `403 Forbidden` with scope mention | Token doesn't hold `evidence:publish`. | Shouldn't happen with the default `--login`; re-run the flow and confirm the approval page shows `evidence:publish`. |
| `401 Unauthorized` (cookie) | Session cookie expired. | Either switch to bearer via `publish.py --login` (recommended) or re-copy the cookie. |
| `error: no credentials available` | No saved token and neither legacy env var is set. | Run `publish.py --login`. |
| `error: ``op`` (1Password CLI) not found` | Using `CIVICAITOOLS_SESSION_TOKEN_OP` without the CLI. | Install with `brew install --cask 1password-cli`, or switch to `publish.py --login`. |
| Published package shows `operationType: "unknown"` | Tool call was reconstructed without an explicit `operationType`. | Pass `operationType` per tool call (`query`, `search`, `catalog`, `metadata`, `metrics`) in the payload. |
| PROV-O graph missing a source | A tool call in the analysis didn't end up in `toolCalls[]`. | Walk through the conversation and add the missing call; republish. |
| `--dry-run` exits 2 with "exceeds the … inline threshold" | A field (usually the transcript in `output`) is larger than 512 KB. | Expected in `--dry-run` — blob uploads are skipped there. Re-run without `--dry-run` and valid credentials; the field will upload to Vercel Blob and be referenced by hash. If you need the dry-run to succeed for debugging, raise `--max-inline-bytes`. |
| `--dry-run` exits 2 with "negative pattern scan failed" | A prose field (`prompt`, `output`, or a `turns[].content`) contains markers that only appear when the content was paraphrased rather than read from the session JSONL. | Re-read the offending field directly from `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` — group assistant records by `message.id`, filter content blocks to `text` only, and copy verbatim. Don't try to scrub the markers out of paraphrased prose. |
| Multi-turn package detail page shows only the transcript, not per-turn UI | Expected for now. | Turn-by-turn rendering lives in `extensions["org.civicaitools.multi-turn"]` on the package and is a separate future website ticket. The transcript in `output` still captures every turn verbatim. |

## Privacy notes

- The payload file contains the prompt and full markdown output. Delete the temp file after publishing.
- Saved bearer tokens live at `~/.config/civic-ai-tools/credentials.json` (file mode `0600`). The publish script never echoes the token value to stdout, stderr, or the payload.
- Session-cookie values (legacy path) never leave your machine; the publish script passes them only in the `Cookie` header of the HTTPS POST.
- The published prompt appears on the public evidence page. If your prompt is sensitive, ask Claude to set `promptVisibility: "hash_only"` before publishing; only the SHA-256 of the prompt will appear in the package.
