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
        "model": "anthropic/test-model",
    }
    base.update(overrides)
    return base


def _payload_without(key: str, **overrides: object) -> dict[str, object]:
    """``_payload()`` with ``key`` deleted, for testing required-field
    absence without hand-rolling a second fixture that could drift from
    the base one."""
    payload = _payload(**overrides)
    del payload[key]
    return payload


# --------------------------------------------------------------------------
# Apex default + credentials-store key normalization (civic-ai-tools#109,
# civic-ai-tools#155 P3). Live-measured 2026-08-21 against production: GET
# https://www.civicaitools.org/ 307-redirects to the apex, but the API paths
# this script calls (device-code start, /api/records, /api/blob/upload-
# token) answer directly on either host -- no redirect to follow on the API
# path at all. So the fix-shape is (a): apex-as-default + key normalization,
# with no redirect-following code, since there is nothing to follow.
# --------------------------------------------------------------------------


class DefaultBaseUrlTests(unittest.TestCase):
    def test_default_is_the_apex_form(self) -> None:
        self.assertEqual(publish.DEFAULT_BASE_URL, "https://civicaitools.org")


class NormalizeBaseUrlForKeyTests(unittest.TestCase):
    """Pure unit tests -- no filesystem, no network."""

    def test_www_and_apex_collapse_to_the_same_key(self) -> None:
        self.assertEqual(
            publish.normalize_base_url_for_key("https://www.civicaitools.org"),
            publish.normalize_base_url_for_key("https://civicaitools.org"),
        )

    def test_trailing_slash_is_trimmed(self) -> None:
        self.assertEqual(
            publish.normalize_base_url_for_key("https://civicaitools.org/"),
            publish.normalize_base_url_for_key("https://civicaitools.org"),
        )

    def test_scheme_and_host_case_is_folded(self) -> None:
        self.assertEqual(
            publish.normalize_base_url_for_key("HTTPS://WWW.CivicAiTools.org"),
            publish.normalize_base_url_for_key("https://civicaitools.org"),
        )

    def test_distinct_hosts_stay_distinct(self) -> None:
        self.assertNotEqual(
            publish.normalize_base_url_for_key("https://civicaitools.org"),
            publish.normalize_base_url_for_key("https://staging.civicaitools.org"),
        )

    def test_port_is_preserved(self) -> None:
        self.assertNotEqual(
            publish.normalize_base_url_for_key("http://localhost:3000"),
            publish.normalize_base_url_for_key("http://localhost:3001"),
        )


class _IsolatedCredentialsTestCase(unittest.TestCase):
    """Points the credentials file at a throwaway temp dir for the
    duration of each test, so these tests never touch a real
    ``~/.config/civic-ai-tools/credentials.json``."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._env_patch = mock.patch.dict(
            os.environ, {"XDG_CONFIG_HOME": self._tmp.name}
        )
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        self.addCleanup(self._tmp.cleanup)


class TokenKeyMigrationTests(_IsolatedCredentialsTestCase):
    """The normalization must not orphan a token a pre-#109 `--login` run
    already wrote to disk under the literal, un-normalized `www` key --
    that's what makes it close the "secondary hazard" rather than just
    stop making it worse going forward."""

    def _seed_legacy_entry(self, key: str, access_token: str) -> None:
        creds_path = publish.credentials_path()
        creds_path.parent.mkdir(parents=True, exist_ok=True)
        creds_path.write_text(
            json.dumps(
                {
                    "version": publish.CREDENTIALS_FILE_VERSION,
                    "tokens": {
                        key: {
                            "access_token": access_token,
                            "scope": "records:publish",
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

    def test_legacy_www_keyed_token_is_found_by_apex_lookup(self) -> None:
        self._seed_legacy_entry("https://www.civicaitools.org", "legacy-token")
        entry = publish.token_for_base_url("https://civicaitools.org")
        self.assertIsNotNone(entry)
        assert entry is not None  # narrow for type checkers
        self.assertEqual(entry["access_token"], "legacy-token")

    def test_legacy_keyed_token_is_found_by_the_same_spelling_too(self) -> None:
        self._seed_legacy_entry("https://www.civicaitools.org", "legacy-token")
        entry = publish.token_for_base_url("https://www.civicaitools.org")
        self.assertIsNotNone(entry)
        assert entry is not None
        self.assertEqual(entry["access_token"], "legacy-token")

    def test_remove_token_clears_a_legacy_keyed_entry(self) -> None:
        self._seed_legacy_entry("https://www.civicaitools.org", "legacy-token")
        removed = publish.remove_token("https://civicaitools.org")
        self.assertTrue(removed)
        self.assertIsNone(publish.token_for_base_url("https://civicaitools.org"))
        self.assertIsNone(
            publish.token_for_base_url("https://www.civicaitools.org")
        )

    def test_upsert_writes_the_normalized_key_going_forward(self) -> None:
        publish.upsert_token(
            "https://www.civicaitools.org/",
            {"access_token": "fresh-token", "scope": "records:publish"},
        )
        creds = json.loads(publish.credentials_path().read_text(encoding="utf-8"))
        self.assertEqual(list(creds["tokens"].keys()), ["https://civicaitools.org"])

    def test_no_saved_token_returns_none_not_an_error(self) -> None:
        self.assertIsNone(publish.token_for_base_url("https://civicaitools.org"))
        self.assertFalse(publish.remove_token("https://civicaitools.org"))


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
# Required `model` (ADR-0024 §A/§B; civic-ai-tools#129 / A8). No fallback
# slug: an absent-or-blank `model` must refuse, naming the field, rather
# than silently asserting a specific model inside a signed record.
# --------------------------------------------------------------------------


class RequiredModelTests(unittest.TestCase):
    def test_present_model_passes(self) -> None:
        publish.validate_payload(_payload())

    def test_absent_model_fails_naming_the_field(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()) as err:
            publish.validate_payload(_payload_without("model"))
        self.assertEqual(cm.exception.code, 2)
        self.assertIn("model", err.getvalue())

    def test_empty_string_model_fails(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()) as err:
            publish.validate_payload(_payload(model=""))
        self.assertEqual(cm.exception.code, 2)
        self.assertIn("model", err.getvalue())

    def test_whitespace_only_model_fails(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.validate_payload(_payload(model="   "))
        self.assertEqual(cm.exception.code, 2)

    def test_non_string_model_fails(self) -> None:
        with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
            publish.validate_payload(_payload(model=None))
        self.assertEqual(cm.exception.code, 2)

    def test_build_request_body_carries_the_supplied_model_verbatim(self) -> None:
        payload = _payload(model="some/other-model")
        publish.validate_payload(payload)
        body, _stats = publish.build_request_body(
            payload, max_inline_bytes=1_000_000, blob_upload=None
        )
        self.assertEqual(body["model"], "some/other-model")

    def test_no_fallback_default_for_model_in_source(self) -> None:
        """`model` must be a bare subscript (`payload["model"]`), never
        `.get("model", <default>)` -- the presence of any default is
        itself the defect ADR-0024 §B names, regardless of what the
        default value is."""
        source = Path(publish.__file__).read_text(encoding="utf-8")
        self.assertNotRegex(source, r'payload\.get\(\s*"model"\s*,')
        self.assertNotRegex(source, r"payload\.get\(\s*'model'\s*,")

    def test_dry_run_cli_exits_2_naming_model_for_an_absent_field(self) -> None:
        """Gate evidence (civic-ai-tools#155 P3): `--dry-run` of an
        absent-`model` payload exits 2 naming the field. Exercised at
        the CLI level (main()), not just as a direct validate_payload
        call, per the sprint's evidence requirement."""
        with tempfile.TemporaryDirectory() as tmp:
            payload_path = Path(tmp) / "payload.json"
            payload_path.write_text(
                json.dumps(_payload_without("model")), encoding="utf-8"
            )
            argv = [
                "publish.py",
                "--payload",
                str(payload_path),
                "--dry-run",
            ]
            stderr = io.StringIO()
            with mock.patch.object(sys, "argv", argv), redirect_stderr(stderr):
                with self.assertRaises(SystemExit) as cm:
                    publish.main()
        self.assertEqual(cm.exception.code, 2)
        self.assertIn("model", stderr.getvalue())


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
    """A stubbed `GET /api/records/<slug>/commitment` body, shaped like
    the documented commitment view (only the fields we read matter).

    The version key is deliberately the PRIOR-era ``evidenceProtocolVersion``:
    that is what the deployed civicaitools.org instance emits today, measured
    directly against production on 2026-08-20 (the reference publisher serves
    the new ``/api/records/*`` segments already, but still assembles its
    commitment views with produce-core 0.2.x). A stub that ran ahead of the
    server would be testing a fiction. When the website adopts produce-core
    0.3.0 the emitted key becomes ``protocolVersion``; at that point this stub
    gains the new key. The script reads neither key -- it reads ``packageUrl``
    -- so this field is here for shape fidelity, not behavior, and the
    transition is a documentation change rather than a break."""
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
            requested.full_url, f"{BASE_URL}/api/records/{SLUG}/commitment"
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


# --------------------------------------------------------------------------
# Blob upload TARGET + protocol (E6, civic-ai-tools#155 P3; fix-on-top of the
# first E6 pass). The original pass gated uploads on
# `is_reference_deployment(base_url)` -- reasoning that only civicaitools.org
# was known to run Vercel Blob, and required an operator override for any
# other instance. That premise was incomplete: the website's
# `grantClientUpload` is already driver-shaped SERVER-SIDE
# (civic-ai-tools-website src/lib/storage/driver.ts) -- an s3-backed
# instance's upload-token grant carries `uploadMethod: 'presigned-put'` +
# `url` + `headers` + `blobUrl` instead of `clientToken`, so the correct
# upload target for ANY instance is simply "whatever the grant says", with no
# guessing, no override, and no refusal needed. Confirmed by reading
# src/lib/storage/s3.ts, src/app/api/blob/upload-token/route.ts, and the
# website's own reference client scripts/publish-with-blob-ref.mjs directly,
# 2026-08-21.
# --------------------------------------------------------------------------


def _grant_response(grant: dict[str, object]) -> _FakeResponse:
    return _FakeResponse(json.dumps(grant))


def _blob_put_response(url: str) -> _FakeResponse:
    return _FakeResponse(json.dumps({"url": url}))


PRESIGNED_PUT_HEADERS = {"Content-Type": "text/markdown", "Content-Length": "18"}


class PutToBlobStoreTests(unittest.TestCase):
    """`put_to_blob_store` -- the vercel-blob driver's PUT protocol.
    Unchanged by the E6 fix-on-top; only reached when the upload-token
    grant carries `clientToken` (see UploadBlobRefProtocolTests)."""

    def test_puts_to_the_vercel_blob_api_host_with_bearer_auth(self) -> None:
        requested: list[object] = []

        def fake_urlopen(req: object, *a: object, **kw: object) -> object:
            requested.append(req)
            return _blob_put_response("https://blob.example/x")

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            url = publish.put_to_blob_store(
                pathname="evidence-refs/deadbeef.md",
                content=b"hi",
                content_type="text/markdown",
                client_token="tok",
            )
        req = requested[0]
        self.assertTrue(req.full_url.startswith(publish.VERCEL_BLOB_API_URL))
        header_names = {k.lower(): v for k, v in req.headers.items()}
        self.assertEqual(header_names.get("authorization"), "Bearer tok")
        self.assertEqual(url, "https://blob.example/x")


class MintUploadTokenGrantTests(unittest.TestCase):
    """`mint_upload_token` sends contentType/contentLength and returns the
    FULL grant dict, unexamined beyond "is this a JSON object" -- the
    driver-shape branching is `upload_blob_ref`'s job, not this one's."""

    def test_includes_content_type_and_length_in_the_mint_payload(self) -> None:
        sent_bodies: list[dict[str, object]] = []

        def fake_urlopen(req: object, *a: object, **kw: object) -> object:
            data = getattr(req, "data", None)
            if data:
                sent_bodies.append(json.loads(data.decode("utf-8")))
            return _grant_response({"clientToken": "tok"})

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            publish.mint_upload_token(
                base_url=BASE_URL,
                pathname="evidence-refs/deadbeef.md",
                auth_method="bearer",
                auth_value="stub-token",
                cookie_name=publish.PROD_COOKIE_NAME,
                content_type="text/markdown",
                content_length=18,
            )
        sent_payload = sent_bodies[0]["payload"]
        self.assertEqual(sent_payload["contentType"], "text/markdown")
        self.assertEqual(sent_payload["contentLength"], 18)

    def test_returns_the_full_vercel_shaped_grant_unexamined(self) -> None:
        grant_body = {"clientToken": "tok", "type": "blob.generate-client-token"}
        with mock.patch(
            "urllib.request.urlopen", return_value=_grant_response(grant_body)
        ):
            grant = publish.mint_upload_token(
                base_url=BASE_URL,
                pathname="evidence-refs/deadbeef.md",
                auth_method="bearer",
                auth_value="stub-token",
                cookie_name=publish.PROD_COOKIE_NAME,
                content_type="text/markdown",
                content_length=2,
            )
        self.assertEqual(grant, grant_body)

    def test_returns_the_full_presigned_put_shaped_grant_unexamined(self) -> None:
        grant_body = {
            "uploadMethod": "presigned-put",
            "url": "https://s3.example/bucket/evidence-refs/x.md",
            "headers": PRESIGNED_PUT_HEADERS,
            "pathname": "evidence-refs/x.md",
            "blobUrl": "https://cdn.example/evidence-refs/x.md",
        }
        with mock.patch(
            "urllib.request.urlopen", return_value=_grant_response(grant_body)
        ):
            grant = publish.mint_upload_token(
                base_url=BASE_URL,
                pathname="evidence-refs/x.md",
                auth_method="bearer",
                auth_value="stub-token",
                cookie_name=publish.PROD_COOKIE_NAME,
                content_type="text/markdown",
                content_length=18,
            )
        self.assertEqual(grant, grant_body)

    def test_non_object_response_refuses(self) -> None:
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_FakeResponse(json.dumps(["not", "an", "object"])),
        ):
            with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
                publish.mint_upload_token(
                    base_url=BASE_URL,
                    pathname="evidence-refs/x.md",
                    auth_method="bearer",
                    auth_value="stub-token",
                    cookie_name=publish.PROD_COOKIE_NAME,
                    content_type="text/markdown",
                    content_length=1,
                )
        self.assertEqual(cm.exception.code, 3)


class UploadBlobRefProtocolTests(unittest.TestCase):
    """`upload_blob_ref` branches on the mint-token grant's shape -- not on
    --base-url. `base_url` in every test below is the non-reference
    `BASE_URL` (https://www.example.org) on purpose: which protocol runs
    must depend only on what the grant says, never on which instance was
    asked."""

    def test_vercel_client_token_grant_puts_via_put_to_blob_store(self) -> None:
        requests: list[object] = []

        def fake_urlopen(req: object, *a: object, **kw: object) -> object:
            full_url = getattr(req, "full_url", "")
            requests.append(req)
            if full_url.endswith("/api/blob/upload-token"):
                return _grant_response({"clientToken": "tok"})
            if getattr(req, "get_method", lambda: "GET")() == "PUT":
                return _blob_put_response("https://blob.example/evidence-refs/x.md")
            raise AssertionError(f"unexpected request to {full_url}")

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            ref = publish.upload_blob_ref(
                value="oversized content",
                content_type="text/markdown",
                extension=".md",
                base_url=BASE_URL,
                auth_method="bearer",
                auth_value="stub-token",
                cookie_name=publish.PROD_COOKIE_NAME,
            )
        put_req = next(
            r for r in requests if getattr(r, "get_method", lambda: "GET")() == "PUT"
        )
        self.assertTrue(put_req.full_url.startswith(publish.VERCEL_BLOB_API_URL))
        header_names = {k.lower(): v for k, v in put_req.headers.items()}
        self.assertEqual(header_names.get("authorization"), "Bearer tok")
        self.assertEqual(ref["url"], "https://blob.example/evidence-refs/x.md")

    def test_presigned_put_grant_puts_with_exactly_the_granted_headers(self) -> None:
        content = "oversized content"
        content_bytes = content.encode("utf-8")
        granted_headers = {
            "Content-Type": "text/markdown",
            "Content-Length": str(len(content_bytes)),
        }
        presigned_url = "https://s3.example/bucket/evidence-refs/x.md?sig=abc"
        put_requests: list[object] = []

        def fake_urlopen(req: object, *a: object, **kw: object) -> object:
            full_url = getattr(req, "full_url", "")
            if full_url.endswith("/api/blob/upload-token"):
                return _grant_response(
                    {
                        "uploadMethod": "presigned-put",
                        "url": presigned_url,
                        "headers": granted_headers,
                        "blobUrl": "https://cdn.example/evidence-refs/x.md",
                    }
                )
            if full_url == presigned_url:
                put_requests.append(req)
                return _FakeResponse("")
            raise AssertionError(f"unexpected request to {full_url}")

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            ref = publish.upload_blob_ref(
                value=content,
                content_type="text/markdown",
                extension=".md",
                base_url=BASE_URL,
                auth_method="bearer",
                auth_value="stub-token",
                cookie_name=publish.PROD_COOKIE_NAME,
            )

        self.assertEqual(len(put_requests), 1)
        sent_headers = {k.lower(): v for k, v in put_requests[0].headers.items()}
        self.assertEqual(
            sent_headers, {k.lower(): v for k, v in granted_headers.items()}
        )
        # Nothing Vercel-specific leaked onto the presigned PUT -- that
        # would break the URL's signature (s3.ts's `signableHeaders`
        # covers exactly content-type + content-length, nothing else).
        self.assertNotIn("authorization", sent_headers)
        self.assertNotIn("x-vercel-blob-access", sent_headers)
        self.assertNotIn("x-api-version", sent_headers)
        self.assertNotIn("x-content-type", sent_headers)
        self.assertEqual(ref["url"], "https://cdn.example/evidence-refs/x.md")

    def test_presigned_put_grant_missing_fields_refuses(self) -> None:
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_grant_response({"uploadMethod": "presigned-put"}),
        ):
            with self.assertRaises(SystemExit) as cm, redirect_stderr(
                io.StringIO()
            ) as err:
                publish.upload_blob_ref(
                    value="x",
                    content_type="text/markdown",
                    extension=".md",
                    base_url=BASE_URL,
                    auth_method="bearer",
                    auth_value="stub-token",
                    cookie_name=publish.PROD_COOKIE_NAME,
                )
        self.assertEqual(cm.exception.code, 3)
        self.assertIn("presigned-put", err.getvalue())

    def test_unrecognized_grant_shape_refuses_quoting_the_response(self) -> None:
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_grant_response(
                {"somethingElse": "unexpected-driver-shape"}
            ),
        ):
            with self.assertRaises(SystemExit) as cm, redirect_stderr(
                io.StringIO()
            ) as err:
                publish.upload_blob_ref(
                    value="x",
                    content_type="text/markdown",
                    extension=".md",
                    base_url=BASE_URL,
                    auth_method="bearer",
                    auth_value="stub-token",
                    cookie_name=publish.PROD_COOKIE_NAME,
                )
        self.assertEqual(cm.exception.code, 3)
        stderr_text = err.getvalue()
        self.assertIn("somethingElse", stderr_text)
        self.assertIn("unexpected-driver-shape", stderr_text)


def _run_main(
    commitment: object,
    extra_argv: list[str] | None = None,
    server_visibility: str = "public",
) -> tuple[dict[str, object], str, dict[str, object] | None]:
    """Run ``main()`` against a stubbed server. ``commitment`` is the
    stubbed response (or exception) for the commitment GET. ``extra_argv``
    is appended to the CLI invocation (e.g. ``["--visibility",
    "committed"]``). ``server_visibility`` is the ``visibility`` value the
    stubbed ``POST /api/records`` response carries — defaults to
    ``"public"`` (what a current-instance server serves per ADR-0016 §A);
    pass a legacy value (``"published"`` / ``"committed"``) to simulate an
    older instance. Returns ``(parsed_stdout, stderr_text,
    sent_request_body)`` — the third element is the JSON body actually
    POSTed to ``/api/records`` (``None`` if the request never fired).

    Shared by ``PublishOutputTests`` (blob-hint derivation) and
    ``VisibilityCliEndToEndTests`` (visibility rename / legacy-flag
    coverage) — both exercise the same ``main()`` call path against a
    stubbed server, no network, no credentials."""
    served_url = (
        f"/records/{SLUG}"
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
        if full_url.endswith("/api/records"):
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
# Vocabulary settlement (2026-08-19; specification Appendix J). The skill is a
# NEW-emission surface, so it constructs the canonical `/api/records/*` paths
# and prints the canonical output key -- while keeping every prior-era name
# that something in the wild might already be reading.
# --------------------------------------------------------------------------


class OutputKeyAliasTests(unittest.TestCase):
    """`recordUrl` is canonical; `evidenceUrl` is the deprecated alias.

    Alias-and-deprecate means BOTH keys are emitted and both carry the
    identical value -- a consumer that parses this JSON for `evidenceUrl`
    must not break, and a consumer that moves to `recordUrl` must not get a
    different URL. Asserting only the new key would let the alias silently
    disappear; asserting only equality would let both keys vanish together."""

    def test_both_keys_present_and_identical(self) -> None:
        result, _stderr, _body = _run_main(_commitment_response(STORE_HOST))
        self.assertIn("recordUrl", result)
        self.assertIn("evidenceUrl", result)
        self.assertEqual(result["recordUrl"], result["evidenceUrl"])

    def test_record_url_uses_the_canonical_public_segment(self) -> None:
        result, _stderr, _body = _run_main(_commitment_response(STORE_HOST))
        self.assertEqual(result["recordUrl"], f"{BASE_URL}/records/{SLUG}")

    def test_readback_url_uses_the_canonical_api_segment(self) -> None:
        result, _stderr, _body = _run_main(_commitment_response(STORE_HOST))
        self.assertEqual(result["readbackUrl"], f"{BASE_URL}/api/records/{SLUG}")


class ScopeAndClientNameTests(unittest.TestCase):
    """The device-authorization flow requests the settlement-era scope, and
    the client display name shown on the approval page moves with it."""

    def test_default_client_name_names_the_new_skill(self) -> None:
        self.assertEqual(
            publish.DEFAULT_CLIENT_NAME, "Claude Code publish-record skill"
        )

    def test_login_requests_the_records_publish_scope(self) -> None:
        sent: list[dict[str, object]] = []

        def fake_post_json(url: str, body: dict[str, object]) -> tuple[int, dict]:
            sent.append({"url": url, "body": body})
            # Stop the flow immediately after the first call; the scope in
            # that first request is the whole point of this test.
            return 500, {"error": "stopped by test"}

        with mock.patch.object(publish, "_post_json", fake_post_json):
            with self.assertRaises(SystemExit):
                publish.do_login(BASE_URL, publish.DEFAULT_CLIENT_NAME, False)

        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]["body"]["scope"], "records:publish")
        self.assertEqual(
            sent[0]["url"], f"{BASE_URL}/api/auth/device/code"
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
