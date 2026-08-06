"""Minimal tests for publish.py — negative pattern scan, captureMethod
validation, and blob-host derivation. Run with ``python3 test_publish.py``
(no pytest dependency).

Per civic-ai-tools#60 / ADR-0003. The publishing model's full JSONL-readback
pipeline is end-to-end-tested by actual publishes; these tests cover only
the gates that publish.py itself enforces. No test makes a live API call or
needs a session token — every server response is stubbed."""
from __future__ import annotations

import io
import json
import os
import re
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import publish  # noqa: E402  (import after sys.path tweak)


def _payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "title": "t",
        "summary": "s",
        "prompt": "p",
        "output": "o",
        "toolCalls": [],
    }
    base.update(overrides)
    return base


class NegativePatternScanTests(unittest.TestCase):
    def test_clean_payload_passes(self) -> None:
        publish.negative_pattern_scan(_payload())

    def test_thinking_tag_in_output_fails(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.negative_pattern_scan(_payload(output="hello <thinking> bad"))
        self.assertEqual(cm.exception.code, 2)

    def test_toolu_id_in_prompt_fails(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.negative_pattern_scan(_payload(prompt="ref toolu_01ABCdef"))
        self.assertEqual(cm.exception.code, 2)

    def test_signature_in_turn_content_fails(self) -> None:
        turns = [{"index": 0, "role": "user", "content": "x"},
                 {"index": 1, "role": "assistant", "content": "signature: foo"}]
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.negative_pattern_scan(_payload(turns=turns))
        self.assertEqual(cm.exception.code, 2)


class CaptureMethodValidationTests(unittest.TestCase):
    def test_default_passes(self) -> None:
        publish.validate_payload(_payload())

    def test_jsonl_readback_passes(self) -> None:
        publish.validate_payload(_payload(captureMethod="claude-code-jsonl-readback"))

    def test_unknown_method_fails(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.validate_payload(_payload(captureMethod="made-up"))
        self.assertEqual(cm.exception.code, 2)


# --------------------------------------------------------------------------
# Blob-host derivation (no instance-specific constant in the skill)
# --------------------------------------------------------------------------

# Stand-in hosts. Any value works — the point of the change is that the
# script carries no host of its own.
STORE_HOST = "examplestore0001.public.blob.vercel-storage.com"
OTHER_HOST = "otherstore0002.public.blob.vercel-storage.com"
PACKAGE_HASH = "deadbeef" * 8  # 64 hex chars, same shape as a real hash
BASE_URL = "https://www.example.org"
SLUG = "some-analysis-deadbe"


def _legacy_blob_url_for(host: str, package_hash: str) -> str:
    """The pre-change implementation, verbatim, with the module-level
    host constant replaced by a parameter.

    This is the byte-compatibility reference: whatever host the server
    reports, the URL the script emits must equal what the old constant-
    based code emitted for that same host.
    """
    return f"https://{host}/evidence-packages/{package_hash}.json"


class _FakeResponse:
    """Minimal stand-in for the object urlopen returns."""

    def __init__(self, body: str, headers: dict[str, str] | None = None) -> None:
        self._body = body.encode("utf-8")
        self.headers = headers or {}

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False


def _commitment_response(host: str, package_hash: str = PACKAGE_HASH) -> _FakeResponse:
    """A stubbed `GET /api/evidence/<slug>/commitment` body, shaped like
    the documented commitment view (only the fields we read matter)."""
    return _FakeResponse(
        json.dumps(
            {
                "evidenceProtocolVersion": "0.1.0",
                "packageHash": package_hash,
                "packageUrl": _legacy_blob_url_for(host, package_hash),
                "captureMethod": "claude-code-jsonl-readback",
            }
        )
    )


class BlobUrlByteCompatTests(unittest.TestCase):
    """`blob_url_for` must be byte-identical to the pre-change code."""

    def test_url_matches_legacy_formula(self) -> None:
        for host in (STORE_HOST, OTHER_HOST, "blob.example.gov"):
            with self.subTest(host=host):
                self.assertEqual(
                    publish.blob_url_for(PACKAGE_HASH, host),
                    _legacy_blob_url_for(host, PACKAGE_HASH),
                )

    def test_end_to_end_hint_matches_legacy_for_same_server_state(self) -> None:
        """Resolution + construction together reproduce the old output.

        Given a server whose package blobs live on ``STORE_HOST`` — the
        situation the removed constant described — the emitted hint is
        byte-identical to what the constant produced.
        """
        with mock.patch(
            "urllib.request.urlopen", return_value=_commitment_response(STORE_HOST)
        ):
            host = publish.resolve_blob_host(
                override="",
                base_url=BASE_URL,
                slug=SLUG,
                observed_urls=[],
            )
        self.assertEqual(
            publish.blob_url_for(PACKAGE_HASH, host),
            _legacy_blob_url_for(STORE_HOST, PACKAGE_HASH),
        )


class NoInstanceConstantTests(unittest.TestCase):
    def test_module_has_no_blob_host_constant(self) -> None:
        self.assertFalse(hasattr(publish, "VERCEL_BLOB_HOST"))

    def test_source_carries_no_concrete_store_host(self) -> None:
        """A `<store>` placeholder in help text is fine; a real store id
        is not."""
        source = Path(publish.__file__).read_text(encoding="utf-8")
        matches = re.findall(
            r"[A-Za-z0-9]{6,}\.public\.blob\.vercel-storage\.com", source
        )
        self.assertEqual(matches, [])

    def test_blob_url_for_requires_an_explicit_host(self) -> None:
        with self.assertRaises(TypeError):
            publish.blob_url_for(PACKAGE_HASH)  # type: ignore[call-arg]


class BlobHostFromUrlTests(unittest.TestCase):
    def test_extracts_host(self) -> None:
        self.assertEqual(
            publish.blob_host_from_url(_legacy_blob_url_for(STORE_HOST, PACKAGE_HASH)),
            STORE_HOST,
        )

    def test_rejects_non_urls(self) -> None:
        for value in (None, "", "   ", 42, {}, "not a url", "ftp://x/y"):
            with self.subTest(value=value):
                self.assertIsNone(publish.blob_host_from_url(value))


class FetchCommitmentBlobHostTests(unittest.TestCase):
    def test_reads_host_from_package_url(self) -> None:
        with mock.patch(
            "urllib.request.urlopen", return_value=_commitment_response(STORE_HOST)
        ) as urlopen:
            host = publish.fetch_commitment_blob_host(BASE_URL, SLUG)
        self.assertEqual(host, STORE_HOST)
        requested = urlopen.call_args.args[0]
        self.assertEqual(
            requested.full_url, f"{BASE_URL}/api/evidence/{SLUG}/commitment"
        )
        # Public endpoint — the fetch must carry no credentials.
        header_names = {k.lower() for k in requested.headers}
        self.assertNotIn("authorization", header_names)
        self.assertNotIn("cookie", header_names)

    def test_network_failure_returns_none(self) -> None:
        with mock.patch(
            "urllib.request.urlopen", side_effect=urllib.error.URLError("down")
        ):
            self.assertIsNone(publish.fetch_commitment_blob_host(BASE_URL, SLUG))

    def test_unparseable_body_returns_none(self) -> None:
        with mock.patch(
            "urllib.request.urlopen", return_value=_FakeResponse("<html>nope</html>")
        ):
            self.assertIsNone(publish.fetch_commitment_blob_host(BASE_URL, SLUG))

    def test_missing_package_url_returns_none(self) -> None:
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_FakeResponse(json.dumps({"packageHash": PACKAGE_HASH})),
        ):
            self.assertIsNone(publish.fetch_commitment_blob_host(BASE_URL, SLUG))


class ResolveBlobHostTests(unittest.TestCase):
    def test_commitment_response_is_the_default_source(self) -> None:
        with mock.patch(
            "urllib.request.urlopen", return_value=_commitment_response(STORE_HOST)
        ):
            host = publish.resolve_blob_host(
                override="",
                base_url=BASE_URL,
                slug=SLUG,
                observed_urls=[],
            )
        self.assertEqual(host, STORE_HOST)

    def test_uploaded_blob_url_is_the_fallback(self) -> None:
        with mock.patch(
            "urllib.request.urlopen", side_effect=urllib.error.URLError("down")
        ):
            host = publish.resolve_blob_host(
                override="",
                base_url=BASE_URL,
                slug=SLUG,
                observed_urls=[
                    f"https://{OTHER_HOST}/evidence-refs/{PACKAGE_HASH}.md"
                ],
            )
        self.assertEqual(host, OTHER_HOST)

    def test_override_wins_without_any_request(self) -> None:
        with mock.patch(
            "urllib.request.urlopen",
            side_effect=AssertionError("override must not hit the network"),
        ):
            self.assertEqual(
                publish.resolve_blob_host(
                    override=OTHER_HOST,
                    base_url=BASE_URL,
                    slug=SLUG,
                    observed_urls=[f"https://{STORE_HOST}/evidence-refs/x.md"],
                ),
                OTHER_HOST,
            )

    def test_override_accepts_a_full_url(self) -> None:
        with mock.patch(
            "urllib.request.urlopen",
            side_effect=AssertionError("override must not hit the network"),
        ):
            self.assertEqual(
                publish.resolve_blob_host(
                    override=f"https://{OTHER_HOST}/",
                    base_url=BASE_URL,
                    slug=SLUG,
                    observed_urls=[],
                ),
                OTHER_HOST,
            )

    def test_no_source_returns_none(self) -> None:
        with mock.patch(
            "urllib.request.urlopen", side_effect=urllib.error.URLError("down")
        ):
            self.assertIsNone(
                publish.resolve_blob_host(
                    override=None,
                    base_url=BASE_URL,
                    slug=SLUG,
                    observed_urls=[],
                )
            )


def _run_main(
    commitment: object,
    extra_argv: list[str] | None = None,
    server_visibility: str = "public",
) -> tuple[dict[str, object], str, dict[str, object] | None]:
    """Run ``main()`` against a stubbed server. ``commitment`` is the
    stubbed response (or exception) for the commitment GET. ``extra_argv``
    is appended to the CLI invocation (e.g. ``["--visibility",
    "committed"]``). ``server_visibility`` is the ``visibility`` value the
    stubbed ``POST /api/evidence`` response carries — defaults to
    ``"public"`` (what a current-instance server serves per ADR-0016 §A);
    pass a legacy value (``"published"`` / ``"committed"``) to simulate an
    older instance. Returns ``(parsed_stdout, stderr_text,
    sent_request_body)`` — the third element is the JSON body actually
    POSTed to ``/api/evidence`` (``None`` if the request never fired).

    Shared by ``PublishOutputTests`` (blob-hint derivation) and
    ``VisibilityCliEndToEndTests`` (visibility rename / legacy-flag
    coverage) — both exercise the same ``main()`` call path against a
    stubbed server, no network, no credentials."""
    served_url = (
        f"/evidence/{SLUG}"
        if server_visibility in ("public", "published")
        else None
    )
    publish_response = _FakeResponse(
        json.dumps(
            {
                "slug": SLUG,
                "url": served_url,
                "packageHash": PACKAGE_HASH,
                "visibility": server_visibility,
            }
        )
    )
    sent_bodies: list[dict[str, object]] = []

    def fake_urlopen(req: object, *args: object, **kwargs: object) -> object:
        full_url = getattr(req, "full_url", "")
        if full_url.endswith("/commitment"):
            if isinstance(commitment, Exception):
                raise commitment
            return commitment
        if full_url.endswith("/api/evidence"):
            data = getattr(req, "data", None)
            if data:
                sent_bodies.append(json.loads(data.decode("utf-8")))
            return publish_response
        raise AssertionError(f"unexpected request to {full_url}")

    with tempfile.TemporaryDirectory() as tmp:
        payload_path = Path(tmp) / "payload.json"
        payload_path.write_text(
            json.dumps(
                _payload(
                    toolCalls=[
                        {
                            "name": "get_data",
                            "source": "socrata",
                            "args": {"type": "query"},
                        }
                    ]
                )
            ),
            encoding="utf-8",
        )
        argv = [
            "publish.py",
            "--payload",
            str(payload_path),
            "--base-url",
            BASE_URL,
        ] + (extra_argv or [])
        stdout, stderr = io.StringIO(), io.StringIO()
        with mock.patch.object(sys, "argv", argv), mock.patch.object(
            publish, "resolve_auth", return_value=("bearer", "stub-token")
        ), mock.patch("urllib.request.urlopen", side_effect=fake_urlopen), \
                redirect_stdout(stdout), redirect_stderr(stderr):
            publish.main()
    sent_body = sent_bodies[-1] if sent_bodies else None
    return json.loads(stdout.getvalue()), stderr.getvalue(), sent_body


class PublishOutputTests(unittest.TestCase):
    """End-to-end over the one call path that produces a blob URL:
    ``main()`` publishing a package. All server responses are stubbed —
    no network, no credentials."""

    def test_hint_is_derived_from_the_commitment_response(self) -> None:
        result, stderr, _body = _run_main(_commitment_response(STORE_HOST))
        self.assertEqual(
            result["blobHint"], _legacy_blob_url_for(STORE_HOST, PACKAGE_HASH)
        )
        self.assertEqual(stderr, "")

    def test_hint_omitted_when_no_response_offers_a_host(self) -> None:
        result, stderr, _body = _run_main(urllib.error.URLError("down"))
        self.assertNotIn("blobHint", result)
        self.assertIn("blob host", stderr)
        # The rest of the result is unaffected.
        self.assertEqual(result["slug"], SLUG)
        self.assertEqual(result["packageHash"], PACKAGE_HASH)

    def test_hint_honours_the_escape_hatch(self) -> None:
        with mock.patch.dict(os.environ, {"CIVICAITOOLS_BLOB_HOST": OTHER_HOST}):
            result, _stderr, _body = _run_main(_commitment_response(STORE_HOST))
        self.assertEqual(
            result["blobHint"], _legacy_blob_url_for(OTHER_HOST, PACKAGE_HASH)
        )


# --------------------------------------------------------------------------
# Visibility rename (ADR-0016 §A: `committed` -> `sealed`, `published` ->
# `public`) + legacy-flag back-compat (sprint decision G0-4: never a hard
# error, always a deprecation note).
# --------------------------------------------------------------------------


class VisibilityConstantsTests(unittest.TestCase):
    """The canonical/legacy vocabularies themselves."""

    def test_allowed_visibility_is_canonical_only(self) -> None:
        self.assertEqual(publish.ALLOWED_VISIBILITY, {"public", "sealed"})

    def test_legacy_aliases_map_to_canonical(self) -> None:
        self.assertEqual(
            publish.LEGACY_VISIBILITY_ALIASES,
            {"published": "public", "committed": "sealed"},
        )
        # Every legacy value maps into the canonical set; no legacy value
        # is itself allowed through unmapped.
        for legacy, canonical in publish.LEGACY_VISIBILITY_ALIASES.items():
            self.assertIn(canonical, publish.ALLOWED_VISIBILITY)
            self.assertNotIn(legacy, publish.ALLOWED_VISIBILITY)


class NormalizeVisibilityUnitTests(unittest.TestCase):
    """`normalize_visibility` / `validate_payload` mapping, in isolation."""

    def test_legacy_committed_maps_to_sealed_with_note(self) -> None:
        payload = _payload(visibility="committed")
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            publish.validate_payload(payload)
        self.assertEqual(payload["visibility"], "sealed")
        note = stderr.getvalue()
        self.assertIn("committed", note)
        self.assertIn("sealed", note)
        self.assertIn("ADR-0016", note)

    def test_legacy_published_maps_to_public_with_note(self) -> None:
        payload = _payload(visibility="published")
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            publish.validate_payload(payload)
        self.assertEqual(payload["visibility"], "public")
        self.assertIn("published", stderr.getvalue())

    def test_canonical_sealed_passes_through_with_no_note(self) -> None:
        payload = _payload(visibility="sealed")
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            publish.validate_payload(payload)
        self.assertEqual(payload["visibility"], "sealed")
        self.assertEqual(stderr.getvalue(), "")

    def test_canonical_public_passes_through_with_no_note(self) -> None:
        payload = _payload(visibility="public")
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            publish.validate_payload(payload)
        self.assertEqual(payload["visibility"], "public")
        self.assertEqual(stderr.getvalue(), "")

    def test_unset_visibility_defaults_to_public(self) -> None:
        payload = _payload()
        self.assertNotIn("visibility", payload)
        publish.validate_payload(payload)
        # validate_payload doesn't write the default back — it only
        # normalizes a *present* value — so the key stays absent; the
        # default is applied downstream (build_request_body).
        self.assertNotIn("visibility", payload)

    def test_genuinely_invalid_value_still_hard_errors(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.validate_payload(_payload(visibility="draft"))
        self.assertEqual(cm.exception.code, 2)


class VisibilityCliEndToEndTests(unittest.TestCase):
    """Reuses the module-level ``_run_main`` helper (shared with
    ``PublishOutputTests``) for full CLI-flag -> request-body ->
    printed-result coverage of the visibility rename + legacy aliases."""

    def test_legacy_committed_flag_sends_sealed_and_notes_on_stderr(self) -> None:
        result, stderr, body = _run_main(
            _commitment_response(STORE_HOST),
            extra_argv=["--visibility", "committed"],
            server_visibility="sealed",
        )
        self.assertEqual(body["visibility"], "sealed")
        self.assertEqual(result["visibility"], "sealed")
        self.assertIn("note", result)
        self.assertIn("Sealed (not public)", result["note"])
        self.assertNotIn("blobHint", result)
        self.assertIn("legacy alias", stderr)
        self.assertIn("committed", stderr)
        self.assertIn("sealed", stderr)

    def test_legacy_published_flag_sends_public_with_no_note(self) -> None:
        result, stderr, body = _run_main(
            _commitment_response(STORE_HOST),
            extra_argv=["--visibility", "published"],
            server_visibility="public",
        )
        self.assertEqual(body["visibility"], "public")
        self.assertEqual(result["visibility"], "public")
        self.assertNotIn("note", result)
        self.assertIn("blobHint", result)
        self.assertIn("legacy alias", stderr)

    def test_new_sealed_flag_sends_sealed_with_no_deprecation_note(self) -> None:
        result, stderr, body = _run_main(
            _commitment_response(STORE_HOST),
            extra_argv=["--visibility", "sealed"],
            server_visibility="sealed",
        )
        self.assertEqual(body["visibility"], "sealed")
        self.assertEqual(result["visibility"], "sealed")
        self.assertIn("Sealed (not public)", result["note"])
        # Canonical input: no deprecation note anywhere in stderr.
        self.assertNotIn("legacy alias", stderr)

    def test_new_public_flag_sends_public_with_no_deprecation_note(self) -> None:
        result, stderr, body = _run_main(
            _commitment_response(STORE_HOST),
            extra_argv=["--visibility", "public"],
            server_visibility="public",
        )
        self.assertEqual(body["visibility"], "public")
        self.assertEqual(result["visibility"], "public")
        self.assertNotIn("legacy alias", stderr)

    def test_default_with_no_flag_sends_public(self) -> None:
        # No --visibility at all: the payload has no `visibility` key
        # either, so the skill's own default (public — "publish this" is
        # the expected outcome) applies.
        result, stderr, body = _run_main(
            _commitment_response(STORE_HOST), server_visibility="public"
        )
        self.assertEqual(body["visibility"], "public")
        self.assertNotIn("legacy alias", stderr)

    def test_served_legacy_committed_still_tolerated_on_readback(self) -> None:
        """The server MAY be an older instance still serving the legacy
        label back (never the request skill sends, per ADR-0016 §A back-
        compat) — the skill's own comparisons must tolerate it."""
        result, _stderr, _body = _run_main(
            _commitment_response(STORE_HOST),
            extra_argv=["--visibility", "sealed"],
            server_visibility="committed",
        )
        self.assertEqual(result["visibility"], "committed")
        self.assertIn("note", result)
        self.assertIn("Sealed (not public)", result["note"])
        self.assertNotIn("blobHint", result)


if __name__ == "__main__":
    unittest.main()
