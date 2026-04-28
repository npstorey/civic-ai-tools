"""Minimal tests for publish.py — negative pattern scan + captureMethod
validation. Run with ``python3 test_publish.py`` (no pytest dependency).

Per civic-ai-tools#60 / ADR-0003. The publishing model's full JSONL-readback
pipeline is end-to-end-tested by actual publishes; these tests cover only
the gates that publish.py itself enforces."""
from __future__ import annotations

import io
import sys
import unittest
from contextlib import redirect_stderr
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
