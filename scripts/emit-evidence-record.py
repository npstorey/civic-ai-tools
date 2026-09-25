#!/usr/bin/env python3
"""Emit ONE real receipt evidence record, deterministically, into scripts/fixtures/.

Leg A of scripts/verify-evidence-projection.sh re-runs this against a pinned
`receipt` clone and asserts the output is BYTE-IDENTICAL to the committed
fixtures — which is only meaningful because every input here is fixed:

  * the signing key is derived from a committed seed STRING (see KEY_SEED_LABEL),
    so no private key material is ever written to the tree;
  * `emitted_at_utc` is a constant, not a clock read;
  * `receipt.evidence.emit_evidence_record` itself is deterministic given those.

The record is produced by the EMITTER, never hand-written: this script only
supplies the body, the producer block and the emission time, and `receipt`
computes the index, the digests, the canonical bytes, the filename and the
signature. That is the point — a hand-written record would prove nothing about
the byte stream a consumer actually has to project.

Usage (from the repo root, with a pinned receipt clone at .evidence-clones/receipt):

    uv run --project .evidence-clones/receipt python scripts/emit-evidence-record.py <outdir>

Writes into <outdir>:  <NNNN>-<sha16>.json, .body.json, .producer.sig.b64
plus emit-metadata.json (the public key + the parameters, for the harness).

The signature is flattened out as BASE64 TEXT rather than the 64 raw bytes
`receipt` writes, so no fixture in the tree is binary — see the comment at the
flatten step for why that matters to the pre-push guard.
"""

from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from receipt.evidence import DOMAIN, EvidenceSpec, emit_evidence_record

# --- deterministic throwaway key -------------------------------------------
# A LABEL, not a key: the 32-byte Ed25519 seed is sha256 of this ASCII string,
# so the tree carries no private key material and anyone can rederive it. This
# key is a throwaway for a build-only POC — it is deliberately NOT in any trust
# registry, and nothing signed with it is published.
KEY_SEED_LABEL = b"civic-ai-tools/evidence-projection-v1/receipt-producer-throwaway"

# Fixed emission time: a claimed time with NO witness (note hazard 5). It is
# a constant here so re-emission is byte-reproducible, which is also the
# honest shape — receipt parses this field and never refuses on it.
EMITTED_AT_UTC = "2026-08-26T00:00:00Z"

RECORDS_RELATIVE = pathlib.PurePosixPath("evidence-records")

# The domain event this record binds by digest. Every value is a measured fact
# about the branch that emitted it; `receipt` has no opinion about the schema.
BODY_SCHEMA = "org.civicaitools/projection-build-event/v1"
BODY = {
    "event": "typed-standards-projection-built",
    "repo": "npstorey/civic-ai-tools",
    "branch": "evidence-projection-v1",
    "harness": "scripts/verify-evidence-projection.sh",
    "projects": "receipt/evidence-record/v1",
    "into": "Typed Standards content/analysis/v1 node",
    "direction": "one-way",
    "published": False,
}

PRODUCER = {"repo": "npstorey/receipt", "branch": "evidence-record-v1"}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    outdir = pathlib.Path(sys.argv[1]).resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    seed = hashlib.sha256(KEY_SEED_LABEL).digest()
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    public_spki_der = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    # Emission is only byte-reproducible into a FRESH directory: the emitter
    # reads the existing chain to pick the next `recordIndex`, so re-running
    # over a previous emission would produce record 1, not record 0. Refuse
    # rather than silently emit a different record.
    if (outdir / RECORDS_RELATIVE).exists():
        print(
            f"refusing to emit: {outdir / RECORDS_RELATIVE} already exists — "
            "emit into a fresh directory (the emitter would bump recordIndex)",
            file=sys.stderr,
        )
        return 1

    spec = EvidenceSpec(records_relative=RECORDS_RELATIVE)
    record_path = emit_evidence_record(
        outdir,
        spec=spec,
        private_key_pem=private_key_pem,
        body=BODY,
        body_schema=BODY_SCHEMA,
        refs=[],
        producer=PRODUCER,
        emitted_at_utc=EMITTED_AT_UTC,
    )

    # Flatten the emitted directory up into <outdir> so the fixture names are
    # stable and flat; the emitter's own layout is an implementation detail.
    import shutil

    body_path = record_path.with_name(f"{record_path.stem}.body.json")
    sig_path = record_path.with_name(f"{record_path.stem}.producer.sig")
    for src in (record_path, body_path):
        dst = outdir / src.name
        if src.resolve() != dst.resolve():
            shutil.copyfile(src, dst)

    # The signature is emitted by `receipt` as 64 RAW bytes. It is flattened out
    # as BASE64 TEXT, not copied verbatim: a 64-byte binary blob in the tree
    # makes the pre-push sensitivity guard's awk stage die with
    # "towc: multibyte conversion failure", which leaves that file SILENTLY
    # UNSCANNED on every push. A guard that fails quietly is worse than one that
    # fails loudly, so nothing under scripts/fixtures/ is binary.
    # Base64 is injective, so comparing the .b64 files IS comparing the raw
    # bytes — the harness's re-emission leg loses nothing by diffing the text.
    # Encoded here in Python rather than by the `base64(1)` CLI because the
    # no-wrap flag is spelled `-w 0` on GNU and `-b 0` on BSD/macOS; this always
    # writes ONE unwrapped line, which `base64 -d` reads on both.
    signature_raw = sig_path.read_bytes()
    signature_b64 = base64.b64encode(signature_raw).decode("ascii")
    (outdir / f"{record_path.stem}.producer.sig.b64").write_text(
        signature_b64 + "\n", encoding="utf-8"
    )

    raw = record_path.read_bytes()
    metadata = {
        "$comment": (
            "Emission parameters + the derived PUBLIC key, written by "
            "scripts/emit-evidence-record.py. No private key material: the "
            "signing seed is sha256 of keySeedLabel."
        ),
        "emitter": "receipt.evidence.emit_evidence_record",
        "keySeedLabel": KEY_SEED_LABEL.decode("ascii"),
        "emittedAtUtc": EMITTED_AT_UTC,
        "recordsRelative": str(RECORDS_RELATIVE),
        "bodySchema": BODY_SCHEMA,
        "producer": PRODUCER,
        "refs": [],
        "recordFilename": record_path.name,
        "recordSha256": hashlib.sha256(raw).hexdigest(),
        "domain": DOMAIN.decode("latin-1"),
        "domainHex": DOMAIN.hex(),
        "producerPublicKeyPem": public_pem.decode("ascii"),
        "producerPublicKeySpkiBase64": base64.b64encode(public_spki_der).decode("ascii"),
        "producerSignatureBase64": signature_b64,
    }
    (outdir / "emit-metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"emitted {record_path.name} ({len(raw)} bytes) into {outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
