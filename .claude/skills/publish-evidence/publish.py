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

Environment variables (read at run time, never logged):

    CIVICAITOOLS_SESSION_TOKEN      NextAuth session-token cookie value.
    CIVICAITOOLS_SESSION_TOKEN_OP   1Password reference (``op://...``)
                                    resolved via ``op read``; used when
                                    ``CIVICAITOOLS_SESSION_TOKEN`` is
                                    unset.
    CIVICAITOOLS_BASE_URL           Override the publish base URL
                                    (default ``https://www.civicaitools.org``).

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
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from typing import Any

DEFAULT_BASE_URL = "https://www.civicaitools.org"
PROD_COOKIE_NAME = "__Secure-next-auth.session-token"
DEV_COOKIE_NAME = "next-auth.session-token"

ALLOWED_SOURCES = {"socrata", "data-commons"}
ALLOWED_PROMPT_VISIBILITY = {"full_text", "hash_only"}
ALLOWED_CAPTURE_MODES = {"single_final_turn", "full_conversation"}
ALLOWED_TURN_ROLES = {"user", "assistant", "tool"}

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


def eprint(*args: Any, **kwargs: Any) -> None:
    print(*args, file=sys.stderr, **kwargs)


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
        "error: no session token provided. Set CIVICAITOOLS_SESSION_TOKEN "
        "to the value of the `__Secure-next-auth.session-token` cookie "
        "from a signed-in civicaitools.org browser session, or set "
        "CIVICAITOOLS_SESSION_TOKEN_OP to an `op://` reference. See "
        "civic-ai-tools-website/docs/api/evidence-publish.md#authentication."
    )
    sys.exit(1)


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


def mint_upload_token(
    base_url: str,
    pathname: str,
    session_token: str,
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
    req = urllib.request.Request(
        url,
        data=encoded,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Cookie": f"{cookie_name}={session_token}",
            "User-Agent": "civic-ai-tools-publish-evidence/0.2",
        },
    )
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
            eprint(
                "error: 401 Unauthorized from /api/blob/upload-token. The "
                "session cookie is missing, invalid, or expired. Sign in "
                "at civicaitools.org, re-copy the cookie, and update "
                "CIVICAITOOLS_SESSION_TOKEN."
            )
            sys.exit(1)
        eprint(f"error: HTTP {exc.code} from /api/blob/upload-token.")
        if detail:
            eprint(f"  response body: {detail[:500]}")
        sys.exit(3)
    except urllib.error.URLError as exc:
        eprint(
            f"error: network failure minting upload token: {exc.reason}"
        )
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
            "User-Agent": "civic-ai-tools-publish-evidence/0.2",
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
    session_token: str,
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
        session_token=session_token,
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

    # Per-field encoding decisions. Each decision is a tuple:
    #   (value, content_type, extension) -> inline_value_or_blob_ref
    # The body is assembled from the resolved values; stats records
    # which path each field took.
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
                "--dry-run (with a valid session cookie) so the field can be "
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
    }
    if payload.get("duration_ms") is not None:
        body["duration_ms"] = payload["duration_ms"]

    # When `trace` is a BlobRef the server can't walk spans to extract
    # skill metadata. Supply an explicit override so `skillMetadata.*`
    # isn't blanked out on the package. Field names align with
    # civic-ai-tools-website/src/lib/evidence/packager.ts#PackageInput
    # (systemPromptHash — not skillTextHash — matches the `skill.text_hash`
    # span attribute the packager reads).
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

    # Extensions: start from any caller-supplied block, then layer the
    # multi-turn extension when applicable. Reverse-DNS keyed so new
    # extensions can coexist without collision.
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


def post_evidence(
    base_url: str,
    body: dict[str, Any],
    session_token: str,
    cookie_name: str,
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/api/evidence"
    encoded = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Cookie": f"{cookie_name}={session_token}",
            "User-Agent": "civic-ai-tools-publish-evidence/0.2",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp_body = resp.read().decode("utf-8")
            return json.loads(resp_body)
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        if exc.code == 401:
            eprint(
                "error: 401 Unauthorized from /api/evidence. The session "
                "token is missing, invalid, or expired. Sign in again at "
                "https://civicaitools.org, re-copy the "
                f"`{cookie_name}` cookie value, and update "
                "CIVICAITOOLS_SESSION_TOKEN (or the 1Password item "
                "referenced by CIVICAITOOLS_SESSION_TOKEN_OP)."
            )
            sys.exit(1)
        if exc.code == 404:
            eprint(
                "error: 404 from /api/evidence. The server could not find "
                "your user record. Try signing out + back in on "
                "civicaitools.org, then re-copy the session cookie."
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Publish a civic-data analysis to civicaitools.org."
    )
    parser.add_argument(
        "--payload",
        required=True,
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
        "the production `__Secure-next-auth.session-token`.",
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
        "--max-inline-bytes",
        type=int,
        default=DEFAULT_MAX_INLINE_BYTES,
        help=f"Per-field inline threshold in bytes (default: "
        f"{DEFAULT_MAX_INLINE_BYTES}). Fields larger than this are "
        "uploaded to Vercel Blob and referenced by hash.",
    )
    args = parser.parse_args()

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

    validate_payload(payload)

    if args.dry_run:
        body, stats = build_request_body(
            payload,
            max_inline_bytes=args.max_inline_bytes,
            blob_upload=None,
        )
        print(json.dumps(_redacted_preview(body, payload, stats), indent=2))
        return

    session_token = resolve_session_token()
    cookie_name = DEV_COOKIE_NAME if args.dev else PROD_COOKIE_NAME

    def do_upload(value: Any, content_type: str, extension: str) -> dict[str, Any]:
        return upload_blob_ref(
            value=value,
            content_type=content_type,
            extension=extension,
            base_url=args.base_url,
            session_token=session_token,
            cookie_name=cookie_name,
        )

    body, _stats = build_request_body(
        payload,
        max_inline_bytes=args.max_inline_bytes,
        blob_upload=do_upload,
    )
    # Token value never flows through stdout/stderr from here on.
    result = post_evidence(args.base_url, body, session_token, cookie_name)

    slug = result.get("slug")
    relative_url = result.get("url")
    package_hash = result.get("packageHash")
    if not slug or not package_hash:
        eprint("error: unexpected response shape from /api/evidence:")
        eprint(json.dumps(result, indent=2))
        sys.exit(4)

    full_url = f"{args.base_url.rstrip('/')}{relative_url}"

    print(
        json.dumps(
            {
                "slug": slug,
                "evidenceUrl": full_url,
                "packageHash": package_hash,
                "packageId": payload.get("packageId") or str(uuid.uuid5(
                    uuid.NAMESPACE_URL, full_url
                )),
                "readbackUrl": f"{args.base_url.rstrip('/')}/api/evidence/{slug}",
                "blobHint": blob_url_for(package_hash),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
