# Publishing a Claude Code analysis as a signed record

The `publish-record` skill lets a Claude Code session post a completed civic-data analysis to [civicaitools.org](https://civicaitools.org) as a cryptographically signed, timestamped, Rekor-logged record package — the same kind of package the website's chat flow produces. It's intended for dogfooding frontier-model analyses that the website's cost-constrained chat flow cannot run at full depth.

> **Renamed 2026-08-19.** This skill was `publish-evidence` until the vocabulary settlement (specification Appendix J) retired "evidence" as the name of the artifact surface, keeping it only for the epistemic Question/Evidence/Claim role. **Both invocations still work** and always will: `.claude/skills/publish-evidence/` remains as a permanent alias pointing at the one script in `.claude/skills/publish-record/`. Saying "publish this as evidence" still works too. This page was `docs/publish-evidence.md`; that path now redirects here.

The skill lives at `.claude/skills/publish-record/` in this repo. It is auto-discovered by Claude Code when you open civic-ai-tools as the working directory, under either name.

**Substitute your own origin.** This guide describes the reference deployment, civicaitools.org — the skill's default publish target. Every `civicaitools.org` host below that the skill actually calls (the sign-in / device-flow destination, the dashboard, and above all the `POST /api/records` publish target itself, including every sample record URL and JSON output shown in the examples further down) is that deployment's concrete example. Pass `--base-url <your-origin>` to `publish.py`, or set `CIVICAITOOLS_BASE_URL=<your-origin>` in the environment, to point the skill at any other instance running this skill's server-side contract instead — see "Publishing to your own instance" below. Where the text instead states a fact about what civicaitools.org itself does or requires (e.g. "sign in once at civicaitools.org" as an instruction for using the reference deployment specifically), that's describing that deployment's own behavior, not a host the reader must substitute.

## What you need

- **Claude Code**, pointing at this repo as cwd.
- **The Socrata and Data Commons MCP servers** configured in `.mcp.json` (already set up in this repo via `./scripts/setup.sh`).
- **A civicaitools.org GitHub login.** Sign in once at [civicaitools.org](https://civicaitools.org) before starting the device-authorization flow below.
- **Python 3.8+** on PATH (the bundled script is stdlib-only).

## One-time setup: log in with the device flow

The preferred auth path is an OAuth 2.0 device-authorization flow that saves a 90-day bearer token to `~/.config/civic-ai-tools/credentials.json` (file mode `0600`). Run it once:

```bash
python3 civic-ai-tools/.claude/skills/publish-record/publish.py --login
```

The script:

1. Asks the civicaitools.org platform for a short user code and a verification URL.
2. Opens your browser to the verification URL with the code prefilled (use `--no-browser` to disable). If you're not signed in, you'll hit a GitHub OAuth flow first.
3. Waits while you click **Approve** on the authorization page. The page shows the client name ("Claude Code publish-record skill" by default; override with `--name "something else"`) and the scope (`records:publish`). Tokens minted before 2026-08-19 carry the prior-era `evidence:publish` scope, which civicaitools.org still accepts — an existing saved token does not need re-issuing.
4. Saves the returned bearer token to `~/.config/civic-ai-tools/credentials.json` and prints a summary.

Useful follow-ups:

- `publish.py --list-tokens` — show saved tokens (display-safe: prefix + scope + expiry only, never the full value).
- `publish.py --logout` — delete the token for the current base URL from the credentials file. This does **not** revoke the token server-side; visit the [Dashboard → Tokens tab](https://civicaitools.org/dashboard) to revoke.
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

Full authentication contract: [`civic-ai-tools-website/docs/api/records-publish.md#authentication`](../../civic-ai-tools-website/docs/api/records-publish.md#authentication).

## Invoking the skill

1. Open a fresh Claude Code session with civic-ai-tools as the working directory. Use a frontier model (Opus 4.7 recommended for multi-indicator or cross-source analyses).
2. Ask your civic-data question naturally. Claude uses the Socrata and/or Data Commons MCP tools to answer.
3. When the analysis is complete and you're satisfied with the answer, say something like:
   > Publish this as evidence.

   The skill auto-triggers on phrases like "publish this as a record", "publish this as evidence", "publish to civicaitools.org", "sign this analysis", or "make this a verifiable package."
4. Claude will:
   - Read the session JSONL at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` to capture prose content (`prompt`, `output`, `turns[].content`), tool args, and per-invocation token usage verbatim. (See "Verbatim capture from JSONL" below for what this means and why.)
   - Read the composed skill text (`docs/skills/base.md` + `local.md` + `data-commons.md`) and include it in the payload as `skillText` so the published package records the guidance that shaped the analysis. This happens by default; see "Skill guidance capture" below for the opt-out conditions.
   - Summarize what it's about to publish (title, summary, token usage, source list, capture mode, capture method).
   - Write the payload to a temp file and run the publish script with `--dry-run` — which validates schema, runs the negative pattern scan, and prints a redacted preview.
   - Ask for your go-ahead.
5. Confirm, and the skill POSTs to `civicaitools.org/api/records`. On success it prints:
   - The public URL (`https://civicaitools.org/records/<slug>`), as `recordUrl` — and as `evidenceUrl` beside it, the deprecated alias key carrying the identical value so existing consumers of this JSON keep working
   - The package hash
   - A readback URL (`/api/records/<slug>`) for programmatic inspection

6. Open the URL to run consistency or adversarial attestations from the dashboard.

## Verbatim capture from JSONL

Per [ADR-0003](./adr/0003-evidence-capture-method.md), packages published from this skill carry `captureMethod: "claude-code-jsonl-readback"` — meaning the skill instructs the publishing model to read prose content and tool args directly from the Claude Code session log on disk (`~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`) rather than reconstruct them from its own in-context memory, and `publish.py` refuses payloads that show paraphrase markers. The readback is the publishing model's job: `publish.py` never opens a session log itself — its only file reads are the saved-credentials file and the `--payload` file you hand it — so the label names an instructed-and-scanned procedure rather than a mechanical capture. See [`trust-and-evidence.md`](./trust-and-evidence.md) for what that means for a reader of the published record. This matters because:

- The cryptographic signature on the package attests "this content was published and has not been tampered with since," not "this content matches the original session." For chat-flow packages the website server does capture the bytes from the model stream — though it streams them to the browser, retains no server-side copy, and at publish signs the bytes the browser returns, so it never compares what it signs against what it captured. For skill-published packages the two line up only if the publishing model read the session log verbatim.
- Earlier publishes that paraphrased from memory introduced fabricated bracketed annotations (e.g., `[Tool calls: load Socrata MCP tools via ToolSearch...]` that were never emitted in the original session) and hand-typed token counts that have been observed off by ~14× on prompt tokens.

Two safeguards keep the skill on the verbatim path:

1. **JSONL readback in `SKILL.md`.** The skill instructs the publishing model to walk the session JSONL line-by-line, group assistant content blocks by `message.id`, filter to `text`-typed blocks for prose, copy `tool_use.input` verbatim for tool args, and sum `usage.input_tokens + cache_creation_input_tokens + cache_read_input_tokens` and `usage.output_tokens` once per unique `message.id` for token totals.
2. **Negative pattern scan in `publish.py --dry-run`.** The script scans `prompt`, `output`, and every `turns[].content` for substrings that only appear when prose was paraphrased — `<thinking>` tags, the literal text `tool_use`, `toolu_*` IDs, and `signature:` fields. Any match exits non-zero with the field name and a snippet, so you can re-read that field from the JSONL rather than ship a paraphrased package. Those three fields are the scan's entire scope: `title`, `summary`, `toolCalls[].args`, and `tokenUsage` are not scanned.

If the dry-run scan flags a field, the fix is to re-read it from the JSONL — not to scrub the markers out of paraphrased prose.

## Skill guidance capture

Published packages by default include the civic-ai-tools repo's composed skill text — the three files in `docs/skills/` (`base.md`, `local.md`, `data-commons.md`) concatenated and shipped in the payload as `skillText`, with `skillMcpServerUrl` set to `"local-stdio (civic-ai-tools/.mcp.json)"`. This records the guidance that shaped the analysis alongside the analysis itself, so a reader of the record page can see not just what Claude said but the framing it was operating under. The website chat flow does the equivalent capture by fetching the same guidance from the MCP server's prompt endpoint, so packages from both publish paths carry comparable provenance.

The skill resolves the three files relative to the current cwd: directly when cwd is the civic-ai-tools repo, and via a `civic-ai-tools/` symlink when cwd is a workspace root set up with one (the maintainer's own workspace layout — one convention, not a requirement). If the files aren't on disk (cwd is a different repo or a workspace that doesn't carry civic-ai-tools), or you say something like "publish without skill text" / "skip skill capture", the skill omits both fields and surfaces a one-line note in the dry-run summary (e.g., "no skillText — files not on disk") so you can either correct the cwd or reconfirm the opt-out before the live publish.

## Capture modes: single turn vs. full conversation

Claude Code sessions are often multi-turn — exploratory tool use, refinement prompts, mid-session pivots. The skill supports two ways to capture a session:

- **Single final turn (default).** Captures your last question + Claude's final answer + every civic MCP tool call used to produce that answer. Matches the shape of analyses published from the website's chat flow. Say "publish this as a record" (or the prior-era "publish this as evidence") or "sign this answer" to invoke.

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
- On confirmation, POSTs. If the transcript or trace is over 512 KB, they upload to Vercel Blob first; the record package ends up with BlobRef entries the detail page resolves server-side.

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

Writes `/tmp/publish-record-<timestamp>.json`, runs `--dry-run`, shows the redacted preview, and asks for confirmation. On confirmation, POSTs. Final output:

```
https://civicaitools.org/records/manhattan-311-noise-complaints-2025-<hash>
```

The published package will have `dataSources[]` listing Socrata with the NYC portal, `queries[]` containing the `get_data` call, and a PROV-O graph with one `urn:civic-record:mcp-server:socrata` agent. (Records published before 2026-08-19 carry the prior-era `urn:civic-evidence:` form; those identifiers are frozen inside the signature and stay valid forever — verifiers accept both eras.)

## Direct script invocation (optional)

If you're scripting around the skill or want to publish without a Claude conversation in the loop, you can run the publish script directly:

```bash
python3 civic-ai-tools/.claude/skills/publish-record/publish.py \
    --payload /path/to/payload.json \
    --dry-run   # optional: preview without POSTing
```

The payload schema is documented at the top of `publish.py` and in the `SKILL.md` file alongside it. In short, required: `title`, `summary`, `prompt`, `output`, `toolCalls[]` with `name` + `source` + `args` per call, and `model` — the script exits 2 if any is missing, and `model` alone gets a stricter present-but-blank check too (an empty `"model": ""` would otherwise assert an unsupplied fact inside a signed record; civic-ai-tools#129). Optional: `captureMode`, `captureMethod`, `visibility`, `turns[]`, `sessionBoundary`, `portal`, `tokenUsage`, `duration_ms`, `extensions`, `skillText`, `skillMcpServerUrl`. `captureMethod` defaults to `"claude-code-jsonl-readback"` and is the only value the skill should set. The wider enum (`chat-flow-stream`, `claude-code-self-report`) is reachable for completeness — and *reachable* is the operative word: a payload that sets one of those values is accepted both by this script and by the publish route, which validates `captureMethod` against the Producer Profile's vocabulary and never against the path the request arrived on. The label is a self-assertion the server does not cross-check; see [`trust-and-evidence.md`](./trust-and-evidence.md).

### Sealed visibility (attest without publishing)

By default the skill publishes — content public, listed in the registry. Pass `--visibility sealed` (or set `"visibility": "sealed"` in the payload) to **seal instead**: the package is signed, RFC 3161-timestamped, and registered on the Sigstore Rekor transparency log, but the content stays private to you, the record is unlisted, and the content blob lives at a non-derivable key. The script output then carries `"visibility": "sealed"`, omits the blob hint, and points at the public commitment endpoint (`/api/records/<slug>/commitment`) — the proofs anyone can verify without the content. Publish later from your [dashboard](https://civicaitools.org/dashboard), where the promotion step runs an adversarial evaluation by default (toggleable). Per the lifecycle model (civic-ai-tools#71, spec §8.10; ADR-0016 §A): every claim is attested; publication is opt-in and irreversible.

Legacy `--visibility committed`/`published` values (and `"visibility": "committed"`/`"published"` in the payload) are still accepted indefinitely and mapped automatically to `sealed`/`public` — the script prints a deprecation note on stderr when it substitutes one. Prefer the new spelling for anything you write; the old one keeps working for already-shipped payloads and older callers.

When publishing without a Claude conversation in the loop, you are responsible for the JSONL readback yourself — copying prose into `prompt` / `output` / `turns[].content` from a Python string literal you typed will trip the negative pattern scan as soon as the captured session contained any thinking blocks or tool-use IDs.

CLI flags worth knowing:

- `--mode single_final_turn|full_conversation` — override the payload's `captureMode` without editing the file.
- `--base-url <url>` (or `CIVICAITOOLS_BASE_URL`) — override the publish target. Defaults to `https://civicaitools.org`. See "Publishing to your own instance" below.
- `--blob-host <host>` (or `CIVICAITOOLS_BLOB_HOST`) — escape hatch only, for the target instance's public blob-store host (e.g. `<store>.public.blob.vercel-storage.com`) used to build the `blobHint` in the result. Not needed in the normal flow: the host is normally read from the target instance's own commitment response. It does **not** affect the actual upload target — that's derived entirely from the upload-token grant response, regardless of which storage driver the target instance runs.
- `--max-inline-bytes N` — per-field inline threshold (default 524288). Fields above this threshold upload to Vercel Blob via `/api/blob/upload-token` and are referenced by SHA-256 hash in the record package.
- `--dry-run` — validate the payload, run the negative pattern scan, print a redacted preview, and exit without POSTing or uploading. Useful for debugging payload shape and for catching accidental paraphrase before publication.

## Publishing to your own instance

This skill is not reference-deployment-only. `publish.py` publishes to whatever `--base-url` (or `CIVICAITOOLS_BASE_URL`) names, as long as that instance runs this skill's server-side contract — the `POST /api/records` route and the auth, blob-upload, and commitment endpoints it depends on (documented in [`civic-ai-tools-website/docs/api/records-publish.md`](../../civic-ai-tools-website/docs/api/records-publish.md)). Everywhere else in this guide, `civicaitools.org` is the reference deployment's default, not a hardcoded requirement.

```bash
python3 civic-ai-tools/.claude/skills/publish-record/publish.py \
    --base-url https://your-instance.example \
    --payload /path/to/payload.json
```

or, for the whole session:

```bash
export CIVICAITOOLS_BASE_URL=https://your-instance.example
```

Saved bearer tokens are keyed per base URL (`--login` against one instance doesn't authenticate you against another), so run `publish.py --login --base-url https://your-instance.example` once per instance you publish to. `--blob-host` is a separate, rarely-needed escape hatch — see the flag list above — not part of the normal cross-instance setup.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` (bearer) | Saved token expired or was revoked. | Run `publish.py --logout && publish.py --login` to start a fresh device flow. |
| `403 Forbidden` with scope mention | Token holds neither `records:publish` nor the still-accepted prior-era `evidence:publish`. | Shouldn't happen with the default `--login`; re-run the flow and confirm the approval page shows `records:publish`. |
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
- The published prompt appears on the public record page. If your prompt is sensitive, ask Claude to set `promptVisibility: "hash_only"` before publishing; only the SHA-256 of the prompt will appear in the package.
