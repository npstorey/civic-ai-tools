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

Environment variables (read at run time, never logged):

    CIVICAITOOLS_SESSION_TOKEN      NextAuth session-token cookie value.
    CIVICAITOOLS_SESSION_TOKEN_OP   1Password reference (``op://...``)
                                    resolved via ``op read``; used when
                                    ``CIVICAITOOLS_SESSION_TOKEN`` is
                                    unset.
    CIVICAITOOLS_BASE_URL           Override the publish base URL
                                    (default ``https://civicaitools.org``).

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


def synthesize_trace(
    tool_calls: list[dict[str, Any]],
    skill_text: str | None,
    skill_mcp_server_url: str | None,
) -> dict[str, Any]:
    """Build a minimal OpenTelemetry trace from structured tool-call records.

    Emits one ``mcp_tool_call`` span per tool call, carrying the attributes
    the server's PROV-O and data-sources builders read (see the website's
    provenance.ts / data-sources.ts): ``mcp.source``, ``tool.name``,
    ``tool.operation_type``, ``tool.arguments``. Optionally prepends a
    ``skill_fetch`` span so ``skillMetadata`` (including the skill text
    and its hash) lands in the package.
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
    prompt_visibility = payload.get("promptVisibility", "full_text")
    if prompt_visibility not in ALLOWED_PROMPT_VISIBILITY:
        eprint(
            f"error: promptVisibility must be one of "
            f"{sorted(ALLOWED_PROMPT_VISIBILITY)} (got {prompt_visibility!r})"
        )
        sys.exit(2)


def build_request_body(payload: dict[str, Any]) -> dict[str, Any]:
    tool_calls = payload["toolCalls"]
    trace = synthesize_trace(
        tool_calls=tool_calls,
        skill_text=payload.get("skillText"),
        skill_mcp_server_url=payload.get("skillMcpServerUrl"),
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
        post_tool_calls.append(entry)

    body: dict[str, Any] = {
        "trace": trace,
        "prompt": payload["prompt"],
        "output": payload["output"],
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
    if payload.get("extensions"):
        body["extensions"] = payload["extensions"]
    return body


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
            "User-Agent": "civic-ai-tools-publish-evidence/0.1",
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
            "$CIVICAITOOLS_BASE_URL or https://civicaitools.org)."
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
        "without POSTing. Useful for debugging payload shape.",
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

    validate_payload(payload)
    body = build_request_body(payload)

    if args.dry_run:
        preview = {
            "title": body["title"],
            "model": body["model"],
            "portal": body["portal"],
            "promptVisibility": body["promptVisibility"],
            "promptChars": len(body["prompt"]),
            "outputChars": len(body["output"]),
            "toolCallCount": len(body["toolCalls"]),
            "sources": sorted(
                {c.get("source", "") for c in payload["toolCalls"] if c.get("source")}
            ),
            "hasSkillText": bool(payload.get("skillText")),
            "tokenUsage": body["tokenUsage"],
            "duration_ms": body.get("duration_ms"),
            "extensions": sorted((body.get("extensions") or {}).keys()),
        }
        print(json.dumps(preview, indent=2))
        return

    session_token = resolve_session_token()
    cookie_name = DEV_COOKIE_NAME if args.dev else PROD_COOKIE_NAME
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
