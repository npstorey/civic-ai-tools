#!/usr/bin/env python3
"""POST a civic-data analysis to the civicaitools.org evidence registry.

Reads a structured analysis payload from ``--payload <file>`` (JSON),
synthesizes a minimal OpenTelemetry trace with ``mcp_tool_call`` spans
(so the server's per-source provenance logic emits the right PROV-O
agents), posts the whole thing to ``POST /api/evidence``, and prints
the resulting slug and blob URL.

Designed for the Claude Code skill at ``.claude/skills/publish-evidence``
to call; see ``SKILL.md`` next to this file for usage context, or
``civic-ai-tools-website/docs/api/evidence-publish.md`` for the endpoint
contract.

Capture modes:

    single_final_turn   (default) Captures the last user prompt + final
                        assistant response + tool calls used in that
                        turn. Matches the website chat flow shape.
    full_conversation   Captures every captured turn since the civic
                        analysis started, renders a markdown transcript
                        as `output`, and emits an
                        ``extensions["org.civicaitools.multi-turn"]``
                        block carrying structured turn data for richer
                        future UI rendering. Large fields above the
                        inline-bytes threshold are uploaded to Vercel
                        Blob and referenced by content hash so the
                        request body stays under the Next.js ~4 MB cap.

Authentication (checked in this order, first match wins):

    1. Saved bearer token at ``~/.config/civic-ai-tools/credentials.json``
       (device-flow minted, website#73). Run ``publish.py --login`` to
       create one. Preferred for programmatic use.
    2. ``CIVICAITOOLS_SESSION_TOKEN`` — NextAuth session cookie (legacy).
    3. ``CIVICAITOOLS_SESSION_TOKEN_OP`` — 1Password reference resolved
       via ``op read`` (legacy).

Environment variables (read at run time, never logged):

    CIVICAITOOLS_SESSION_TOKEN      NextAuth session-token cookie value.
    CIVICAITOOLS_SESSION_TOKEN_OP   1Password reference (``op://...``)
                                    resolved via ``op read``.
    CIVICAITOOLS_BASE_URL           Override the publish base URL
                                    (default ``https://www.civicaitools.org``).
    XDG_CONFIG_HOME                 Respected when locating the
                                    credentials file.

Exit codes:

    0  success
    1  auth missing or invalid
    2  input payload invalid
    3  HTTP / network failure
    4  unexpected error
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_BASE_URL = "https://www.civicaitools.org"
PROD_COOKIE_NAME = "__Secure-next-auth.session-token"
DEV_COOKIE_NAME = "next-auth.session-token"

ALLOWED_SOURCES = {"socrata", "data-commons"}
ALLOWED_PROMPT_VISIBILITY = {"full_text", "hash_only"}
ALLOWED_CAPTURE_MODES = {"single_final_turn", "full_conversation"}
ALLOWED_VISIBILITY = {"published", "committed"}
ALLOWED_TURN_ROLES = {"user", "assistant", "tool"}
# Capture-method enum per ADR-0003. The skill always emits
# ``claude-code-jsonl-readback``; the other values exist so the server's
# wider enum is reachable from the same validator if a payload sets one
# explicitly. ``claude-code-self-report`` is deprecated for new publishes
# but retained so legacy packages can be re-rendered with their actual
# capture method labeled.
ALLOWED_CAPTURE_METHODS = {
    "chat-flow-stream",
    "claude-code-jsonl-readback",
    "claude-code-self-report",
}
DEFAULT_CAPTURE_METHOD = "claude-code-jsonl-readback"

# Negative pattern scan — substrings / regexes that only appear when
# prose was paraphrased from in-context memory rather than read from the
# Claude Code session JSONL. Run as a dry-run + live-publish gate.
# Per ADR-0003 and #60. The bare-string entries are fast substring
# checks; the regex entry catches tool-use IDs of arbitrary suffix.
LEAK_LITERAL_PATTERNS: tuple[tuple[str, str], ...] = (
    ("<thinking>", "leaked <thinking> block opening tag"),
    ("tool_use", "leaked `tool_use` block markup"),
    ("signature:", "leaked thinking-block `signature:` field"),
)
LEAK_REGEX_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"toolu_[A-Za-z0-9]+"), "leaked tool-use id (toolu_...)"),
)

# Per-field size threshold at which content is uploaded to Vercel Blob
# rather than inlined in the POST /api/evidence body. Chosen to leave
# comfortable headroom under the Next.js App Router ~4 MB body cap even
# when several fields land near threshold, while small fields stay
# inline so verifiers don't need to fetch them separately. Tune via
# `--max-inline-bytes` if real-world packages land close to either
# boundary.
DEFAULT_MAX_INLINE_BYTES = 512 * 1024

# Vercel Blob API constants (from @vercel/blob/client's wire protocol;
# see civic-ai-tools-website/node_modules/@vercel/blob/dist/client.js).
VERCEL_BLOB_API_URL = "https://vercel.com/api/blob"
VERCEL_BLOB_API_VERSION = "12"

# Device flow defaults (server sends interval; these are the floor).
DEVICE_FLOW_MIN_INTERVAL_SECONDS = 5
DEVICE_FLOW_MAX_WAIT_SECONDS = 15 * 60

CREDENTIALS_FILE_VERSION = "1"
DEFAULT_CLIENT_NAME = "Claude Code publish-evidence skill"


def eprint(*args: Any, **kwargs: Any) -> None:
    print(*args, file=sys.stderr, **kwargs)


# --------------------------------------------------------------------------
# Credentials file (~/.config/civic-ai-tools/credentials.json)
# --------------------------------------------------------------------------


def credentials_path() -> Path:
    """Resolve the credentials file path, respecting XDG_CONFIG_HOME.

    Follows the GitHub CLI convention (``~/.config/civic-ai-tools/``)
    rather than a dot-directory at ``$HOME`` so the file is cleanly
    separated from runtime data and cache.
    """
    xdg = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if xdg:
        base = Path(xdg)
    else:
        base = Path.home() / ".config"
    return base / "civic-ai-tools" / "credentials.json"


def load_credentials() -> dict[str, Any]:
    path = credentials_path()
    if not path.exists():
        return {"version": CREDENTIALS_FILE_VERSION, "tokens": {}}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        eprint(
            f"warning: could not read credentials file at {path}: {exc}. "
            "Treating as empty; re-run `publish.py --login` to regenerate."
        )
        return {"version": CREDENTIALS_FILE_VERSION, "tokens": {}}
    if not isinstance(data, dict) or not isinstance(data.get("tokens"), dict):
        return {"version": CREDENTIALS_FILE_VERSION, "tokens": {}}
    return data


def save_credentials(creds: dict[str, Any]) -> None:
    """Write the credentials file atomically with mode 0600 on the file,
    0700 on the parent dir."""
    path = credentials_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path.parent, 0o700)
    except OSError:
        pass
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(creds, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.chmod(tmp, stat.S_IRUSR | stat.S_IWUSR)
    tmp.replace(path)
    # `replace()` may preserve the tmp file's inode mode, but be explicit.
    try:
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass


def _parse_iso(value: str) -> datetime | None:
    """Parse an ISO-8601 timestamp, tolerating trailing Z."""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def token_for_base_url(base_url: str) -> dict[str, Any] | None:
    """Return the saved token entry for ``base_url`` if present and
    not expired; otherwise None."""
    creds = load_credentials()
    entry = creds.get("tokens", {}).get(base_url.rstrip("/"))
    if not entry:
        return None
    expires_at = entry.get("expires_at")
    if expires_at:
        parsed = _parse_iso(expires_at)
        if parsed and parsed <= datetime.now(timezone.utc):
            return None
    return entry


def upsert_token(base_url: str, entry: dict[str, Any]) -> None:
    creds = load_credentials()
    tokens = creds.setdefault("tokens", {})
    tokens[base_url.rstrip("/")] = entry
    creds["version"] = CREDENTIALS_FILE_VERSION
    save_credentials(creds)


def remove_token(base_url: str) -> bool:
    creds = load_credentials()
    tokens = creds.get("tokens", {})
    key = base_url.rstrip("/")
    if key not in tokens:
        return False
    del tokens[key]
    save_credentials(creds)
    return True


# --------------------------------------------------------------------------
# Auth resolution
# --------------------------------------------------------------------------


def resolve_session_token() -> str:
    """Return the session-token cookie value or exit 1.

    Prefers ``CIVICAITOOLS_SESSION_TOKEN`` when set. Falls back to
    resolving ``CIVICAITOOLS_SESSION_TOKEN_OP`` through ``op read``
    (1Password CLI). Never echoes the token to stdout/stderr.
    """
    token = os.environ.get("CIVICAITOOLS_SESSION_TOKEN", "").strip()
    if token:
        return token

    op_ref = os.environ.get("CIVICAITOOLS_SESSION_TOKEN_OP", "").strip()
    if op_ref:
        try:
            result = subprocess.run(
                ["op", "read", op_ref],
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            eprint(
                "error: `op` (1Password CLI) not found on PATH but "
                "CIVICAITOOLS_SESSION_TOKEN_OP is set. Install it "
                "(brew install --cask 1password-cli) or switch to "
                "CIVICAITOOLS_SESSION_TOKEN."
            )
            sys.exit(1)
        except subprocess.CalledProcessError as exc:
            eprint(
                "error: `op read` failed resolving "
                "CIVICAITOOLS_SESSION_TOKEN_OP. Check the reference is "
                "correct and you're signed in to 1Password "
                f"(exit code {exc.returncode})."
            )
            sys.exit(1)
        token = (result.stdout or "").strip()
        if not token:
            eprint(
                "error: `op read` returned an empty value for "
                "CIVICAITOOLS_SESSION_TOKEN_OP."
            )
            sys.exit(1)
        return token

    eprint(
        "error: no credentials available. Run `publish.py --login` to "
        "obtain a bearer token via the device-authorization flow, or set "
        "CIVICAITOOLS_SESSION_TOKEN / CIVICAITOOLS_SESSION_TOKEN_OP for "
        "the legacy cookie path. See "
        "civic-ai-tools-website/docs/api/evidence-publish.md#authentication."
    )
    sys.exit(1)


def resolve_auth(base_url: str) -> tuple[str, str]:
    """Return ``(method, value)`` where method is ``"bearer"`` or
    ``"cookie"``. Saved bearer tokens take precedence; env vars are the
    legacy fallback."""
    bearer = token_for_base_url(base_url)
    if bearer and bearer.get("access_token"):
        return ("bearer", bearer["access_token"])
    return ("cookie", resolve_session_token())


def auth_headers(
    method: str, value: str, cookie_name: str
) -> dict[str, str]:
    if method == "bearer":
        return {"Authorization": f"Bearer {value}"}
    return {"Cookie": f"{cookie_name}={value}"}


# --------------------------------------------------------------------------
# Trace + payload assembly (unchanged from pre-device-flow)
# --------------------------------------------------------------------------


def attr(key: str, value: str) -> dict[str, Any]:
    return {"key": key, "value": {"stringValue": value}}


def int_attr(key: str, value: int) -> dict[str, Any]:
    return {"key": key, "value": {"intValue": str(value)}}


def synthesize_trace(
    tool_calls: list[dict[str, Any]],
    skill_text: str | None,
    skill_mcp_server_url: str | None,
    turns: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Build a minimal OpenTelemetry trace from structured tool-call records.

    Emits one ``mcp_tool_call`` span per tool call, carrying the attributes
    the server's PROV-O and data-sources builders read (see the website's
    provenance.ts / data-sources.ts): ``mcp.source``, ``tool.name``,
    ``tool.operation_type``, ``tool.arguments``. Optionally prepends a
    ``skill_fetch`` span so ``skillMetadata`` (including the skill text
    and its hash) lands in the package.

    When ``turns`` is supplied (full_conversation mode), prepends one
    ``conversation_turn`` span per captured turn carrying ``turn.index``
    and ``turn.role`` attributes. These spans are additive — every
    existing walker (data-sources, provenance, skill extraction) filters
    by explicit span name, so unknown spans are ignored. They exist so
    future tooling can reconstruct turn boundaries from the trace alone
    without depending on the extensions block.
    """
    spans: list[dict[str, Any]] = []

    if skill_text:
        skill_hash = hashlib.sha256(skill_text.encode("utf-8")).hexdigest()
        skill_attrs = [
            attr("skill.text", skill_text),
            attr("skill.text_hash", skill_hash),
        ]
        if skill_mcp_server_url:
            skill_attrs.append(attr("skill.mcp_server_url", skill_mcp_server_url))
        spans.append({"name": "skill_fetch", "attributes": skill_attrs})

    if turns:
        for turn in turns:
            turn_attrs = [
                int_attr("turn.index", int(turn["index"])),
                attr("turn.role", turn["role"]),
            ]
            spans.append(
                {
                    "name": "conversation_turn",
                    "spanId": f"turn-{int(turn['index']):04d}",
                    "attributes": turn_attrs,
                }
            )

    for idx, call in enumerate(tool_calls):
        source = call.get("source", "")
        tool_name = call.get("name", "")
        operation_type = call.get("operationType") or ""
        args_json = json.dumps(call.get("args", {}), sort_keys=True)
        span_attrs = [
            attr("mcp.source", source),
            attr("tool.name", tool_name),
            attr("tool.operation_type", operation_type),
            attr("tool.arguments", args_json),
        ]
        # Record turn membership on the span itself so future tooling can
        # reconstruct turn grouping without reading extensions. Dropped
        # at the server's queries[] mapping boundary, so this is purely
        # a trace-level record.
        turn_index = call.get("turnIndex")
        if turn_index is not None:
            span_attrs.append(int_attr("turn.index", int(turn_index)))
        spans.append(
            {
                "name": "mcp_tool_call",
                "spanId": f"span-{idx:04d}",
                "attributes": span_attrs,
            }
        )

    return {
        "resourceSpans": [
            {
                "scopeSpans": [{"spans": spans}],
            }
        ]
    }


def _validate_turn(turn: dict[str, Any], idx: int) -> None:
    if not isinstance(turn, dict):
        eprint(f"error: turns[{idx}] must be an object")
        sys.exit(2)
    for required_key in ("index", "role", "content"):
        if required_key not in turn:
            eprint(f"error: turns[{idx}] requires `{required_key}`")
            sys.exit(2)
    if turn["role"] not in ALLOWED_TURN_ROLES:
        eprint(
            f"error: turns[{idx}].role must be one of "
            f"{sorted(ALLOWED_TURN_ROLES)} (got {turn['role']!r})"
        )
        sys.exit(2)
    if not isinstance(turn["index"], int):
        eprint(f"error: turns[{idx}].index must be an integer")
        sys.exit(2)
    if not isinstance(turn["content"], str):
        eprint(f"error: turns[{idx}].content must be a string")
        sys.exit(2)


def _scan_for_leaks(field_label: str, value: str) -> list[tuple[str, str]]:
    """Return ``[(pattern_label, snippet), ...]`` for every leak match in
    ``value``. ``value`` is the prose content of a single field. The
    snippet is a small window around the first occurrence, suitable for
    embedding in an error message without dumping the whole field."""
    if not isinstance(value, str) or not value:
        return []
    findings: list[tuple[str, str]] = []
    for needle, label in LEAK_LITERAL_PATTERNS:
        idx = value.find(needle)
        if idx >= 0:
            start = max(0, idx - 24)
            end = min(len(value), idx + len(needle) + 24)
            snippet = value[start:end].replace("\n", " ")
            findings.append((label, f"...{snippet}..."))
    for pattern, label in LEAK_REGEX_PATTERNS:
        match = pattern.search(value)
        if match:
            start = max(0, match.start() - 24)
            end = min(len(value), match.end() + 24)
            snippet = value[start:end].replace("\n", " ")
            findings.append((label, f"...{snippet}..."))
    # Mention each pattern at most once per field, even if it occurs
    # multiple times — the user only needs to see that the field needs a
    # re-read, not every offset.
    seen_labels: set[str] = set()
    deduped: list[tuple[str, str]] = []
    for label, snippet in findings:
        if label in seen_labels:
            continue
        seen_labels.add(label)
        deduped.append((label, snippet))
    return deduped


def negative_pattern_scan(payload: dict[str, Any]) -> None:
    """Verify prose fields contain no markers indicating paraphrase from
    memory rather than verbatim JSONL readback. Exits 2 with a clear
    error if any leak is found. Per ADR-0003 and #60.

    Scans ``prompt``, ``output`` (only when inline-string; BlobRef
    ``output`` is uploaded after this gate, which is fine — the BlobRef
    is hash-bound and the bytes were already vetted before upload), and
    every ``turns[].content``.
    """
    fields_to_scan: list[tuple[str, str]] = []
    prompt = payload.get("prompt")
    if isinstance(prompt, str):
        fields_to_scan.append(("prompt", prompt))
    output = payload.get("output")
    if isinstance(output, str):
        fields_to_scan.append(("output", output))
    turns = payload.get("turns")
    if isinstance(turns, list):
        for idx, turn in enumerate(turns):
            if isinstance(turn, dict) and isinstance(turn.get("content"), str):
                fields_to_scan.append((f"turns[{idx}].content", turn["content"]))

    all_findings: list[tuple[str, str, str]] = []
    for field_label, value in fields_to_scan:
        for leak_label, snippet in _scan_for_leaks(field_label, value):
            all_findings.append((field_label, leak_label, snippet))

    if not all_findings:
        return

    eprint(
        "error: negative pattern scan failed — payload contains markers that "
        "only appear when prose is paraphrased from memory rather than read "
        "verbatim from the Claude Code session JSONL (per ADR-0003)."
    )
    eprint("Re-read the affected field(s) directly from the session JSONL; do "
           "not try to scrub the markers out of paraphrased prose.")
    eprint("")
    for field_label, leak_label, snippet in all_findings:
        eprint(f"  - {field_label}: {leak_label}")
        eprint(f"    near: {snippet}")
    sys.exit(2)


def validate_payload(payload: dict[str, Any]) -> None:
    required = [
        "title",
        "summary",
        "prompt",
        "output",
        "toolCalls",
    ]
    missing = [k for k in required if k not in payload]
    if missing:
        eprint(f"error: payload missing required fields: {', '.join(missing)}")
        sys.exit(2)
    if not isinstance(payload["toolCalls"], list):
        eprint("error: payload.toolCalls must be a list")
        sys.exit(2)
    for idx, call in enumerate(payload["toolCalls"]):
        if not isinstance(call, dict):
            eprint(f"error: toolCalls[{idx}] must be an object")
            sys.exit(2)
        if "name" not in call or "source" not in call:
            eprint(
                f"error: toolCalls[{idx}] requires `name` and `source` "
                f"(got keys {sorted(call.keys())})"
            )
            sys.exit(2)
        if call["source"] not in ALLOWED_SOURCES:
            eprint(
                f"error: toolCalls[{idx}].source must be one of "
                f"{sorted(ALLOWED_SOURCES)} (got {call['source']!r})"
            )
            sys.exit(2)
        if "args" not in call or not isinstance(call["args"], dict):
            eprint(f"error: toolCalls[{idx}].args must be an object")
            sys.exit(2)
        if "turnIndex" in call and call["turnIndex"] is not None:
            if not isinstance(call["turnIndex"], int):
                eprint(f"error: toolCalls[{idx}].turnIndex must be an integer")
                sys.exit(2)
    prompt_visibility = payload.get("promptVisibility", "full_text")
    if prompt_visibility not in ALLOWED_PROMPT_VISIBILITY:
        eprint(
            f"error: promptVisibility must be one of "
            f"{sorted(ALLOWED_PROMPT_VISIBILITY)} (got {prompt_visibility!r})"
        )
        sys.exit(2)
    capture_mode = payload.get("captureMode", "single_final_turn")
    if capture_mode not in ALLOWED_CAPTURE_MODES:
        eprint(
            f"error: captureMode must be one of "
            f"{sorted(ALLOWED_CAPTURE_MODES)} (got {capture_mode!r})"
        )
        sys.exit(2)
    capture_method = payload.get("captureMethod", DEFAULT_CAPTURE_METHOD)
    if capture_method not in ALLOWED_CAPTURE_METHODS:
        eprint(
            f"error: captureMethod must be one of "
            f"{sorted(ALLOWED_CAPTURE_METHODS)} (got {capture_method!r})"
        )
        sys.exit(2)
    visibility = payload.get("visibility", "published")
    if visibility not in ALLOWED_VISIBILITY:
        eprint(
            f"error: visibility must be one of "
            f"{sorted(ALLOWED_VISIBILITY)} (got {visibility!r})"
        )
        sys.exit(2)
    if capture_mode == "full_conversation":
        turns = payload.get("turns")
        if not isinstance(turns, list) or len(turns) == 0:
            eprint(
                "error: captureMode=full_conversation requires a non-empty "
                "`turns` list describing the captured conversation turns."
            )
            sys.exit(2)
        for idx, turn in enumerate(turns):
            _validate_turn(turn, idx)
        # Enforce consistent ordering so the transcript and the
        # conversation_turn spans agree on turn identity.
        indices = [t["index"] for t in turns]
        if indices != sorted(indices):
            eprint(
                "error: turns[].index values must be monotonically increasing "
                "(the script does not reorder them)."
            )
            sys.exit(2)


def byte_length(value: Any) -> int:
    """Return the UTF-8 byte length of ``value``.

    Strings hash/upload as their UTF-8 encoding. Non-string values
    (dict/list) are serialised first with the same ``json.dumps`` shape
    that would be uploaded so the threshold check matches what actually
    ends up in the blob.
    """
    if isinstance(value, str):
        return len(value.encode("utf-8"))
    return len(json.dumps(value).encode("utf-8"))


def content_to_bytes(value: Any, content_type: str) -> bytes:
    """Serialise ``value`` for blob upload.

    Strings go through as UTF-8; structured values (OTel traces) are
    serialised as JSON. ``content_type`` is informational here — the
    server accepts the same body regardless — but the caller uses it to
    decide whether to json.dumps or just encode.
    """
    if isinstance(value, str):
        return value.encode("utf-8")
    return json.dumps(value).encode("utf-8")


# --------------------------------------------------------------------------
# Blob upload (via presigned tokens from /api/blob/upload-token)
# --------------------------------------------------------------------------


def mint_upload_token(
    base_url: str,
    pathname: str,
    auth_method: str,
    auth_value: str,
    cookie_name: str,
) -> str:
    """Mint a presigned client token for a single blob upload.

    Wraps the first half of the ``@vercel/blob/client`` upload flow:
    POST ``/api/blob/upload-token`` with the ``blob.generate-client-token``
    event, receive a ``vercel_blob_client_...`` token authorised for
    exactly this pathname.
    """
    url = f"{base_url.rstrip('/')}/api/blob/upload-token"
    body = {
        "type": "blob.generate-client-token",
        "payload": {
            "pathname": pathname,
            "clientPayload": None,
            "multipart": False,
        },
    }
    encoded = json.dumps(body).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "civic-ai-tools-publish-evidence/0.3",
    }
    headers.update(auth_headers(auth_method, auth_value, cookie_name))
    req = urllib.request.Request(url, data=encoded, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp_body = resp.read().decode("utf-8")
            parsed = json.loads(resp_body)
            token = parsed.get("clientToken")
            if not token:
                eprint(
                    "error: upload-token response missing `clientToken`: "
                    f"{resp_body[:300]}"
                )
                sys.exit(3)
            return token
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        if exc.code == 401:
            if auth_method == "bearer":
                eprint(
                    "error: 401 Unauthorized from /api/blob/upload-token. "
                    "The saved bearer token is invalid, expired, or revoked. "
                    "Run `publish.py --logout && publish.py --login` to "
                    "start a fresh device-authorization flow."
                )
            else:
                eprint(
                    "error: 401 Unauthorized from /api/blob/upload-token. "
                    "The session cookie is missing, invalid, or expired. "
                    "Sign in at civicaitools.org, re-copy the cookie, and "
                    "update CIVICAITOOLS_SESSION_TOKEN — or switch to bearer "
                    "auth via `publish.py --login`."
                )
            sys.exit(1)
        eprint(f"error: HTTP {exc.code} from /api/blob/upload-token.")
        if detail:
            eprint(f"  response body: {detail[:500]}")
        sys.exit(3)
    except urllib.error.URLError as exc:
        eprint(f"error: network failure minting upload token: {exc.reason}")
        sys.exit(3)


def put_to_blob_store(
    pathname: str,
    content: bytes,
    content_type: str,
    client_token: str,
) -> str:
    """PUT ``content`` to Vercel Blob using a presigned client token.

    Mirrors the second half of the ``@vercel/blob/client`` upload flow
    (see ``chunk-WLMB4XQD.js``'s ``requestApi`` + ``createPutHeaders``):
    PUT ``https://vercel.com/api/blob/?pathname=<p>`` with the
    Authorization bearer token plus Vercel-specific blob headers. The
    response is JSON with the public blob URL.
    """
    from urllib.parse import urlencode

    query = urlencode({"pathname": pathname})
    url = f"{VERCEL_BLOB_API_URL}/?{query}"
    req = urllib.request.Request(
        url,
        data=content,
        method="PUT",
        headers={
            "Authorization": f"Bearer {client_token}",
            "x-api-version": VERCEL_BLOB_API_VERSION,
            "x-vercel-blob-access": "public",
            "x-content-type": content_type,
            "Content-Type": content_type,
            "User-Agent": "civic-ai-tools-publish-evidence/0.3",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            resp_body = resp.read().decode("utf-8")
            parsed = json.loads(resp_body)
            blob_url = parsed.get("url")
            if not blob_url:
                eprint(
                    "error: Vercel Blob PUT response missing `url`: "
                    f"{resp_body[:300]}"
                )
                sys.exit(3)
            return blob_url
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        eprint(
            f"error: HTTP {exc.code} from Vercel Blob store while uploading "
            f"{pathname}."
        )
        if detail:
            eprint(f"  response body: {detail[:500]}")
        sys.exit(3)
    except urllib.error.URLError as exc:
        eprint(f"error: network failure uploading blob: {exc.reason}")
        sys.exit(3)


def upload_blob_ref(
    value: Any,
    content_type: str,
    extension: str,
    base_url: str,
    auth_method: str,
    auth_value: str,
    cookie_name: str,
) -> dict[str, Any]:
    """Upload ``value`` to Vercel Blob and return a BlobRef object.

    Content-addressable: the pathname is derived from the SHA-256 of the
    uploaded bytes so re-uploads of identical content resolve to the
    same URL. The returned shape matches the ``BlobRef`` TypeScript
    interface in the website's ``src/lib/evidence/blob-ref.ts``; the
    server-side verifier fetches the URL and confirms the hash and size
    match.
    """
    content = content_to_bytes(value, content_type)
    size = len(content)
    hash_hex = hashlib.sha256(content).hexdigest()
    pathname = f"evidence-refs/{hash_hex}{extension}"
    client_token = mint_upload_token(
        base_url=base_url,
        pathname=pathname,
        auth_method=auth_method,
        auth_value=auth_value,
        cookie_name=cookie_name,
    )
    blob_url = put_to_blob_store(
        pathname=pathname,
        content=content,
        content_type=content_type,
        client_token=client_token,
    )
    return {
        "ref": f"blob:sha256:{hash_hex}",
        "url": blob_url,
        "contentType": content_type,
        "size": size,
    }


# --------------------------------------------------------------------------
# Request body assembly (unchanged apart from auth plumbing)
# --------------------------------------------------------------------------


def build_request_body(
    payload: dict[str, Any],
    *,
    max_inline_bytes: int,
    blob_upload: Any | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Assemble the /api/evidence request body.

    Returns ``(body, stats)``. ``stats`` records per-field size and
    inline-vs-blob decisions so the dry-run preview can surface them
    without re-encoding.

    ``blob_upload`` is a callable ``(value, content_type, extension) ->
    blob_ref`` or ``None``. When ``None``, oversized fields cause an
    exit — used for dry-run previews that don't have a session cookie.
    """
    tool_calls = payload["toolCalls"]
    capture_mode = payload.get("captureMode", "single_final_turn")
    turns = payload.get("turns") if capture_mode == "full_conversation" else None

    trace = synthesize_trace(
        tool_calls=tool_calls,
        skill_text=payload.get("skillText"),
        skill_mcp_server_url=payload.get("skillMcpServerUrl"),
        turns=turns,
    )

    post_tool_calls: list[dict[str, Any]] = []
    for call in tool_calls:
        entry: dict[str, Any] = {
            "name": call["name"],
            "args": call["args"],
        }
        if "resultSummary" in call and call["resultSummary"] is not None:
            entry["resultSummary"] = call["resultSummary"]
        if "duration_ms" in call and call["duration_ms"] is not None:
            entry["duration_ms"] = call["duration_ms"]
        if "operationType" in call and call["operationType"]:
            entry["operationType"] = call["operationType"]
        # Intentional: `turnIndex` is not propagated to toolCalls[].
        # Belt-and-suspenders with the OTel `turn.index` attribute (on
        # the mcp_tool_call span) + the multi-turn extension block —
        # both are durable carriers. The server's queries[] mapping
        # would drop extra fields anyway.
        post_tool_calls.append(entry)

    stats: dict[str, Any] = {"fields": {}}

    def encode_field(
        field_name: str,
        value: Any,
        content_type: str,
        extension: str,
    ) -> Any:
        size = byte_length(value)
        if size <= max_inline_bytes:
            stats["fields"][field_name] = {
                "encoding": "inline",
                "bytes": size,
            }
            return value
        if blob_upload is None:
            eprint(
                f"error: field `{field_name}` is {size:,} bytes which exceeds "
                f"the {max_inline_bytes:,}-byte inline threshold, but blob "
                "uploads are disabled (dry-run or --no-blob). Re-run without "
                "--dry-run (with valid credentials) so the field can be "
                "uploaded to Vercel Blob, or raise --max-inline-bytes."
            )
            sys.exit(2)
        blob_ref = blob_upload(value, content_type, extension)
        stats["fields"][field_name] = {
            "encoding": "blob",
            "bytes": size,
            "ref": blob_ref["ref"],
            "url": blob_ref["url"],
        }
        return blob_ref

    output_value = encode_field(
        "output", payload["output"], "text/markdown", ".md"
    )
    trace_value = encode_field(
        "trace", trace, "application/json", ".json"
    )

    body: dict[str, Any] = {
        "trace": trace_value,
        "prompt": payload["prompt"],
        "output": output_value,
        "toolCalls": post_tool_calls,
        "model": payload.get("model", "anthropic/claude-opus-4-7"),
        "portal": payload.get("portal", "n/a"),
        "tokenUsage": payload.get("tokenUsage", {}),
        "promptVisibility": payload.get("promptVisibility", "full_text"),
        "title": payload["title"],
        "summary": payload["summary"],
        "captureMethod": payload.get("captureMethod", DEFAULT_CAPTURE_METHOD),
        # Request-level visibility (civic-ai-tools#71): "published" (default —
        # the skill is invoked as "publish this", so public is the expected
        # outcome) or "committed" (signed + transparency-logged, content
        # private; promote later from the civicaitools.org dashboard).
        "visibility": payload.get("visibility", "published"),
    }
    if payload.get("duration_ms") is not None:
        body["duration_ms"] = payload["duration_ms"]

    # When `trace` is a BlobRef the server can't walk spans to extract
    # skill metadata. Supply an explicit override so `skillMetadata.*`
    # isn't blanked out on the package.
    trace_is_blob = isinstance(trace_value, dict) and "ref" in trace_value
    skill_text = payload.get("skillText")
    if trace_is_blob and skill_text:
        skill_text_value = encode_field(
            "skillMetadataOverride.skillText",
            skill_text,
            "text/markdown",
            ".md",
        )
        override: dict[str, Any] = {
            "systemPromptHash": hashlib.sha256(
                skill_text.encode("utf-8")
            ).hexdigest(),
            "skillText": skill_text_value,
        }
        mcp_server_url = payload.get("skillMcpServerUrl")
        if mcp_server_url:
            override["mcpServerUrl"] = mcp_server_url
        body["skillMetadataOverride"] = override

    extensions: dict[str, Any] = {}
    caller_extensions = payload.get("extensions")
    if caller_extensions:
        if not isinstance(caller_extensions, dict):
            eprint("error: payload.extensions must be an object")
            sys.exit(2)
        extensions.update(caller_extensions)
    if capture_mode == "full_conversation" and turns:
        extensions["org.civicaitools.multi-turn"] = {
            "version": "0.1.0",
            "captureMode": "full_conversation",
            "sessionBoundary": payload.get(
                "sessionBoundary", "first_civic_tool_call"
            ),
            "turns": turns,
        }
    if extensions:
        body["extensions"] = extensions

    stats["captureMode"] = capture_mode
    stats["turnCount"] = len(turns) if turns else 0
    stats["totalBodyBytes"] = byte_length(body)
    return body, stats


# --------------------------------------------------------------------------
# HTTP POST to /api/evidence
# --------------------------------------------------------------------------


def post_evidence(
    base_url: str,
    body: dict[str, Any],
    auth_method: str,
    auth_value: str,
    cookie_name: str,
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/api/evidence"
    encoded = json.dumps(body).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "civic-ai-tools-publish-evidence/0.3",
    }
    headers.update(auth_headers(auth_method, auth_value, cookie_name))
    req = urllib.request.Request(url, data=encoded, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            deprecated = resp.headers.get("X-Auth-Deprecated")
            if deprecated:
                eprint(
                    f"warning: server indicates this auth method is deprecated: "
                    f"{deprecated}. Run `publish.py --login` to switch to a "
                    "device-flow bearer token."
                )
            resp_body = resp.read().decode("utf-8")
            return json.loads(resp_body)
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        if exc.code == 401:
            if auth_method == "bearer":
                eprint(
                    "error: 401 Unauthorized from /api/evidence. The saved "
                    "bearer token is invalid, expired, or revoked. Run "
                    "`publish.py --logout && publish.py --login` to start a "
                    "fresh device-authorization flow."
                )
            else:
                eprint(
                    "error: 401 Unauthorized from /api/evidence. The session "
                    "token is missing, invalid, or expired. Sign in again at "
                    "https://civicaitools.org, re-copy the "
                    f"`{cookie_name}` cookie value, and update "
                    "CIVICAITOOLS_SESSION_TOKEN — or switch to bearer auth "
                    "via `publish.py --login`."
                )
            sys.exit(1)
        if exc.code == 403:
            eprint(
                "error: 403 Forbidden from /api/evidence. The bearer token "
                "is missing the evidence:publish scope. Run `publish.py "
                "--login` and ensure the approval page showed scope "
                "`evidence:publish`."
            )
            sys.exit(1)
        if exc.code == 404:
            eprint(
                "error: 404 from /api/evidence. The server could not find "
                "your user record. Try signing out + back in on "
                "civicaitools.org and re-running `publish.py --login`."
            )
            sys.exit(1)
        eprint(f"error: HTTP {exc.code} from /api/evidence.")
        if detail:
            eprint(f"  response body: {detail[:500]}")
        sys.exit(3)
    except urllib.error.URLError as exc:
        eprint(f"error: network failure posting to /api/evidence: {exc.reason}")
        sys.exit(3)


VERCEL_BLOB_HOST = "ayoozcuc1c16axbw.public.blob.vercel-storage.com"


def blob_url_for(package_hash: str) -> str:
    return f"https://{VERCEL_BLOB_HOST}/evidence-packages/{package_hash}.json"


def _redacted_preview(
    body: dict[str, Any],
    payload: dict[str, Any],
    stats: dict[str, Any],
) -> dict[str, Any]:
    """Build a no-sensitive-content summary of the request body."""

    def size_or_ref(value: Any) -> dict[str, Any]:
        if isinstance(value, dict) and "ref" in value:
            return {
                "encoding": "blob",
                "ref": value["ref"],
                "url": value["url"],
                "size": value.get("size"),
            }
        return {
            "encoding": "inline",
            "chars": len(value) if isinstance(value, str) else byte_length(value),
        }

    sources = sorted(
        {c.get("source", "") for c in payload["toolCalls"] if c.get("source")}
    )
    ext = body.get("extensions") or {}
    multi_turn_ext = ext.get("org.civicaitools.multi-turn")
    preview: dict[str, Any] = {
        "captureMode": stats.get("captureMode"),
        "captureMethod": body.get("captureMethod"),
        "turnCount": stats.get("turnCount"),
        "title": body["title"],
        "model": body["model"],
        "portal": body["portal"],
        "promptVisibility": body["promptVisibility"],
        "promptChars": len(body["prompt"]),
        "output": size_or_ref(body["output"]),
        "trace": size_or_ref(body["trace"]),
        "toolCallCount": len(body["toolCalls"]),
        "sources": sources,
        "hasSkillText": bool(payload.get("skillText")),
        "skillMetadataOverride": bool(body.get("skillMetadataOverride")),
        "tokenUsage": body["tokenUsage"],
        "duration_ms": body.get("duration_ms"),
        "extensions": sorted(ext.keys()),
        "totalBodyBytes": stats.get("totalBodyBytes"),
    }
    if multi_turn_ext:
        preview["multiTurn"] = {
            "turnCount": len(multi_turn_ext.get("turns", [])),
            "roles": sorted(
                {t["role"] for t in multi_turn_ext.get("turns", [])}
            ),
            "sessionBoundary": multi_turn_ext.get("sessionBoundary"),
        }
    return preview


# --------------------------------------------------------------------------
# Device authorization grant (RFC 8628)
# --------------------------------------------------------------------------


def _post_json(url: str, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """POST a JSON body and return ``(status, parsed_json)``. Does not
    raise on non-200; caller inspects status."""
    encoded = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "civic-ai-tools-publish-evidence/0.3",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body_text = ""
        try:
            body_text = exc.read().decode("utf-8")
        except Exception:
            body_text = ""
        try:
            return exc.code, json.loads(body_text)
        except json.JSONDecodeError:
            return exc.code, {"error": "http_error", "body": body_text[:500]}
    except urllib.error.URLError as exc:
        return 0, {"error": "network_error", "reason": str(exc.reason)}


def do_login(base_url: str, client_name: str, open_browser: bool) -> None:
    """Run the device-authorization flow against ``base_url`` and save
    the resulting bearer token to the credentials file."""
    start_url = f"{base_url.rstrip('/')}/api/auth/device/code"
    status, start = _post_json(
        start_url,
        {"name": client_name, "scope": "evidence:publish"},
    )
    if status != 200 or "device_code" not in start:
        eprint(
            "error: could not start device-authorization flow "
            f"(HTTP {status}): {json.dumps(start)[:300]}"
        )
        sys.exit(3)

    device_code = start["device_code"]
    user_code = start["user_code"]
    verification_uri = start["verification_uri"]
    verification_uri_complete = start.get(
        "verification_uri_complete", verification_uri
    )
    server_interval = int(start.get("interval", DEVICE_FLOW_MIN_INTERVAL_SECONDS))
    expires_in = int(start.get("expires_in", DEVICE_FLOW_MAX_WAIT_SECONDS))

    print(f"To authorize this client, visit:\n\n    {verification_uri}\n")
    print(f"and enter the code:\n\n    {user_code}\n")
    print(f"Or open the full URL directly:\n\n    {verification_uri_complete}\n")

    if open_browser:
        try:
            webbrowser.open(verification_uri_complete)
            print("(Opened your browser to the authorization page.)\n")
        except Exception:
            pass

    print(
        f"Waiting for approval... (polls every {server_interval}s, "
        f"times out after {expires_in}s)"
    )

    token_url = f"{base_url.rstrip('/')}/api/auth/device/token"
    interval = max(server_interval, DEVICE_FLOW_MIN_INTERVAL_SECONDS)
    deadline = time.time() + min(expires_in, DEVICE_FLOW_MAX_WAIT_SECONDS)

    while time.time() < deadline:
        time.sleep(interval)
        status, resp = _post_json(token_url, {"device_code": device_code})
        if status == 200 and resp.get("access_token"):
            entry = {
                "access_token": resp["access_token"],
                "token_type": resp.get("token_type", "Bearer"),
                "expires_at": resp.get("expires_at"),
                "scope": resp.get("scope", "evidence:publish"),
                "name": client_name,
                "created_at": datetime.now(timezone.utc)
                .isoformat(timespec="seconds")
                .replace("+00:00", "Z"),
            }
            upsert_token(base_url, entry)
            print(
                f"\nSuccess. Bearer token saved to {credentials_path()} "
                f"(scope: {entry['scope']}, expires: {entry['expires_at']})."
            )
            return
        error_code = resp.get("error")
        if error_code == "authorization_pending":
            continue
        if error_code == "slow_down":
            interval += 5
            continue
        if error_code == "expired_token":
            eprint(
                "error: device code expired before approval. Re-run "
                "`publish.py --login`."
            )
            sys.exit(1)
        # Unknown or terminal error — exit.
        eprint(
            f"error: device-flow token exchange failed "
            f"(HTTP {status}): {json.dumps(resp)[:300]}"
        )
        sys.exit(1)

    eprint(
        "error: device-flow approval did not complete in time. Re-run "
        "`publish.py --login`."
    )
    sys.exit(1)


def do_logout(base_url: str) -> None:
    removed = remove_token(base_url)
    if removed:
        print(f"Token for {base_url} removed from {credentials_path()}.")
    else:
        print(f"No saved token for {base_url} (nothing to remove).")


def do_list_tokens() -> None:
    creds = load_credentials()
    tokens = creds.get("tokens", {})
    if not tokens:
        print(f"No saved tokens ({credentials_path()} is empty or missing).")
        return
    print(f"Saved tokens ({credentials_path()}):")
    for url, entry in tokens.items():
        prefix = (entry.get("access_token") or "")[:12]
        expires = entry.get("expires_at") or "unknown"
        scope = entry.get("scope") or "unknown"
        name = entry.get("name") or "(no name)"
        print(f"  {url}")
        print(f"    name:    {name}")
        print(f"    prefix:  {prefix}...")
        print(f"    scope:   {scope}")
        print(f"    expires: {expires}")


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Publish a civic-data analysis to civicaitools.org.",
    )
    parser.add_argument(
        "--payload",
        help="Path to a JSON file describing the analysis (see script "
        "docstring or .claude/skills/publish-evidence/SKILL.md).",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("CIVICAITOOLS_BASE_URL", DEFAULT_BASE_URL),
        help=(
            "Override the publish base URL (default: "
            "$CIVICAITOOLS_BASE_URL or https://www.civicaitools.org)."
        ),
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Use the dev cookie name `next-auth.session-token` instead of "
        "the production `__Secure-next-auth.session-token`. Only applies "
        "to cookie auth.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build the request body, print a redacted preview, and exit "
        "without POSTing. Blob uploads are skipped; oversize fields exit 2.",
    )
    parser.add_argument(
        "--mode",
        choices=sorted(ALLOWED_CAPTURE_MODES),
        default=None,
        help="Override the payload's `captureMode`. Use "
        "`single_final_turn` or `full_conversation`.",
    )
    parser.add_argument(
        "--visibility",
        choices=sorted(ALLOWED_VISIBILITY),
        default=None,
        help="Override the payload's `visibility` (civic-ai-tools#71): "
        "`published` (default — content public + listed) or `committed` "
        "(signed, timestamped, and registered on the transparency log, "
        "but content stays private; publish later from the dashboard).",
    )
    parser.add_argument(
        "--max-inline-bytes",
        type=int,
        default=DEFAULT_MAX_INLINE_BYTES,
        help=f"Per-field inline threshold in bytes (default: "
        f"{DEFAULT_MAX_INLINE_BYTES}). Fields larger than this are "
        "uploaded to Vercel Blob and referenced by hash.",
    )
    # Auth subcommands (mutually exclusive so --login --logout can't race)
    auth_group = parser.add_mutually_exclusive_group()
    auth_group.add_argument(
        "--login",
        action="store_true",
        help="Start a device-authorization flow and save a bearer token "
        "to ~/.config/civic-ai-tools/credentials.json.",
    )
    auth_group.add_argument(
        "--logout",
        action="store_true",
        help="Remove the saved token for --base-url from the credentials "
        "file. Does not revoke the token server-side; use the dashboard "
        "to revoke.",
    )
    auth_group.add_argument(
        "--list-tokens",
        action="store_true",
        help="List saved tokens (display-safe fields only).",
    )
    parser.add_argument(
        "--name",
        default=DEFAULT_CLIENT_NAME,
        help="Client name recorded on the token. Shown in the approval "
        "page and the Dashboard tokens tab. Only used with --login.",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Don't auto-open a browser window during --login.",
    )
    args = parser.parse_args()

    if args.login:
        do_login(args.base_url, args.name, open_browser=not args.no_browser)
        return
    if args.logout:
        do_logout(args.base_url)
        return
    if args.list_tokens:
        do_list_tokens()
        return

    # Default path: publish an analysis.
    if not args.payload:
        parser.error("--payload is required (or pass --login / --logout / --list-tokens)")

    try:
        with open(args.payload, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except FileNotFoundError:
        eprint(f"error: payload file not found: {args.payload}")
        sys.exit(2)
    except json.JSONDecodeError as exc:
        eprint(f"error: payload JSON is not valid: {exc}")
        sys.exit(2)

    if not isinstance(payload, dict):
        eprint("error: payload root must be a JSON object.")
        sys.exit(2)

    if args.mode:
        payload["captureMode"] = args.mode
    if args.visibility:
        payload["visibility"] = args.visibility

    validate_payload(payload)
    negative_pattern_scan(payload)

    if args.dry_run:
        body, stats = build_request_body(
            payload,
            max_inline_bytes=args.max_inline_bytes,
            blob_upload=None,
        )
        print(json.dumps(_redacted_preview(body, payload, stats), indent=2))
        return

    auth_method, auth_value = resolve_auth(args.base_url)
    cookie_name = DEV_COOKIE_NAME if args.dev else PROD_COOKIE_NAME

    def do_upload(value: Any, content_type: str, extension: str) -> dict[str, Any]:
        return upload_blob_ref(
            value=value,
            content_type=content_type,
            extension=extension,
            base_url=args.base_url,
            auth_method=auth_method,
            auth_value=auth_value,
            cookie_name=cookie_name,
        )

    body, _stats = build_request_body(
        payload,
        max_inline_bytes=args.max_inline_bytes,
        blob_upload=do_upload,
    )
    # Auth value never flows through stdout/stderr from here on.
    result = post_evidence(
        args.base_url, body, auth_method, auth_value, cookie_name
    )

    slug = result.get("slug")
    package_hash = result.get("packageHash")
    if not slug or not package_hash:
        eprint("error: unexpected response shape from /api/evidence:")
        eprint(json.dumps(result, indent=2))
        sys.exit(4)

    # Committed responses carry no public `url` (civic-ai-tools#71): the
    # detail page is creator-only and the content blob lives at a random,
    # non-derivable key — so neither evidenceUrl-as-public nor a hash-derived
    # blobHint would be honest. The hint is omitted and the URL labeled.
    visibility = result.get("visibility", "published")
    relative_url = result.get("url") or f"/evidence/{slug}"
    full_url = f"{args.base_url.rstrip('/')}{relative_url}"

    output: dict[str, Any] = {
        "slug": slug,
        "visibility": visibility,
        "evidenceUrl": full_url,
        "packageHash": package_hash,
        "packageId": payload.get("packageId") or str(uuid.uuid5(
            uuid.NAMESPACE_URL, full_url
        )),
        "readbackUrl": f"{args.base_url.rstrip('/')}/api/evidence/{slug}",
    }
    if visibility == "committed":
        output["note"] = (
            "Committed (not published): the page and read-back URLs are "
            "creator-only; the public commitment is at "
            f"{args.base_url.rstrip('/')}/api/evidence/{slug}/commitment. "
            "Publish from the civicaitools.org dashboard when ready."
        )
    else:
        output["blobHint"] = blob_url_for(package_hash)

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
