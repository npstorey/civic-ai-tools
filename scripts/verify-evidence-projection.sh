#!/usr/bin/env bash
# verify-evidence-projection.sh — evidence-projection-v1 verification harness.
#
# Reproduces, from a clean checkout of this branch, the one-way projection of a
# real `receipt/evidence-record/v1` record into ONE Typed Standards node, and
# the offline verification of that node.
#
#   leg A  preflight — assert the exact pinned library versions
#          (@typedstandards/produce-core 0.3.0, @typedstandards/verify-core
#          0.9.0) are resolvable from this repo's own node_modules, and that
#          every committed fixture is present. Both libraries are already
#          workspace dependencies of packages/civic-typed-harness, so `npm ci`
#          (the repo's documented setup step) is the only thing this harness
#          needs, and it needs NO network of its own.
#   leg B  offline verification of the committed commitment bundle with
#          verify-core — OUR verifier — with `fetch` stubbed to THROW (spec
#          §9.4 / Q15 pattern). The verdict is asserted FIELD BY FIELD against
#          a shape written down before the first run, and it is honestly NOT
#          green: #5 unknown_key, #14 no_registry_identity, #7 and #8
#          unverified. A GREEN #5/#7/#8 FAILS this harness — this branch
#          publishes nothing, mints no registry key, obtains no timestamp and
#          logs no entry, so a green result there would mean the harness is
#          lying about what it verified. Leg B also enforces the SUBJECT RULE
#          (below) and the containment of every observation in the signed bytes.
#   leg C  the digest join — four independent readings of the evidence record's
#          sha256 (a fresh shasum of the record file, the digest carried in the
#          node's signed extension, a recomputation over the record bytes
#          carried verbatim inside the signed package, and the 16-hex prefix
#          `receipt` itself put in the record's FILENAME), asserted to one value.
#   leg D  the hazards, executed — the trailing-LF trap in both directions, the
#          four-way proof that no signature crosses, and three rows of the
#          note's §6 field table built as NEGATIVE CONTROLS that show the
#          verifier degrade.
#   leg E  mint reproducibility — re-run the minter into a scratch directory and
#          assert the three minted fixtures come back byte-identical.
#   leg F  record provenance — OPTIONAL, needs a pinned `receipt` clone. Re-runs
#          the emitter and asserts the emitted record, body and signature are
#          byte-identical to the committed fixtures. SKIPPED with a loud notice
#          when the clone is absent; see the notice for how to enable it.
#
# THE SUBJECT RULE (carried over from poc/rulespec-interop, non-negotiable):
# the foreign artifact's digest enters our signed bytes as an OBSERVATION,
# never as a co-signed claim. Leg B asserts it directly — `packageHash`,
# `nodeId` and `contentHash` are ours and are never the record's digest; the
# record's digest, bytes and producer signature live under one extension key
# marked `co_signed: false`; and receipt's producer claim never becomes this
# node's `signer`.
#
# BUILD ONLY. Nothing here publishes. No Rekor entry, no RFC 3161 token, no
# production (civicaitools.org) request, no trust-registry key, no secrets, no
# credentials. buildRekorProposal() and buildTimestampRequest() are never
# called: they only build request bodies a caller would have to submit, and
# nothing is submitted from this branch.
#
# NETWORK: legs A-E make ZERO network calls. `fetch` is stubbed to throw in
# every Node runner and the count is asserted to be 0. Optional leg F needs
# network only the first time, to clone the pinned `receipt` source.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES="$ROOT/scripts/fixtures"
CLONES="$ROOT/.evidence-clones"
SCRATCH="$CLONES/scratch"

PRODUCE_CORE_VERSION="0.3.0"
VERIFY_CORE_VERSION="0.9.0"
RECEIPT_SHA="9108403189bd211e5d98536afa5a6350426daab3"   # npstorey/receipt @ evidence-record-v1
RECORD_STEM="0000-e7d6e3062de1a62a"

fail() { echo "FAIL: $*" >&2; exit 1; }
note() { echo; echo "== $*"; }

# --------------------------------------------------------------------------
note "leg A: preflight — pinned libraries and committed fixtures"
# --------------------------------------------------------------------------
command -v node >/dev/null || fail "node is required"
command -v shasum >/dev/null || fail "shasum is required"

resolve_version() {
  node -p "try{require('$ROOT/node_modules/@typedstandards/$1/package.json').version}catch{''}" 2>/dev/null || true
}
produce_core="$(resolve_version produce-core)"
verify_core="$(resolve_version verify-core)"
[ -n "$produce_core" ] || fail "@typedstandards/produce-core is not installed — run 'npm ci' first"
[ -n "$verify_core" ] || fail "@typedstandards/verify-core is not installed — run 'npm ci' first"
[ "$produce_core" = "$PRODUCE_CORE_VERSION" ] \
  || fail "produce-core is $produce_core, expected $PRODUCE_CORE_VERSION"
[ "$verify_core" = "$VERIFY_CORE_VERSION" ] \
  || fail "verify-core is $verify_core, expected $VERIFY_CORE_VERSION"
echo "   @typedstandards/produce-core @ $produce_core"
echo "   @typedstandards/verify-core  @ $verify_core"

for f in \
  "$RECORD_STEM.json" \
  "$RECORD_STEM.body.json" \
  "$RECORD_STEM.producer.sig" \
  "emit-metadata.json" \
  "evidence-projection-trust-registry.json" \
  "evidence-projection-payload.json" \
  "evidence-projection-package.local.json" \
  "evidence-projection-commitment.local.json" \
; do
  [ -f "$FIXTURES/$f" ] || fail "missing committed fixture: scripts/fixtures/$f"
  echo "   fixture: $f ($(wc -c < "$FIXTURES/$f" | tr -d ' ') bytes)"
done

# The committed package fixture must be the same object the commitment carries.
node -e "
const fs = require('node:fs');
const c = JSON.parse(fs.readFileSync('$FIXTURES/evidence-projection-commitment.local.json','utf8'));
const p = JSON.parse(fs.readFileSync('$FIXTURES/evidence-projection-package.local.json','utf8'));
if (JSON.stringify(p) !== JSON.stringify(c.package)) {
  console.error('package fixture does not match the package inside the commitment bundle');
  process.exit(1);
}
" || fail "package fixture / commitment bundle mismatch"
echo "   package fixture matches the package inside the commitment bundle"

# --------------------------------------------------------------------------
note "leg B: verify-core offline verification (our verifier), verdict asserted field by field"
# --------------------------------------------------------------------------
node "$ROOT/scripts/run-evidence-projection-verify.mjs" \
  "$FIXTURES/evidence-projection-commitment.local.json" \
  "$FIXTURES/evidence-projection-payload.json" \
  || fail "offline verification did not match the expected verdict shape"

# --------------------------------------------------------------------------
note "leg C: the digest join — four independent readings, one value"
# --------------------------------------------------------------------------
# (1) a fresh shasum of the committed record file
FRESH_DIGEST="$(shasum -a 256 "$FIXTURES/$RECORD_STEM.json" | awk '{print $1}')"
# (2) the digest carried inside the node's SIGNED extension block
NODE_EXT_DIGEST="$(node -p "
JSON.parse(require('node:fs').readFileSync('$FIXTURES/evidence-projection-commitment.local.json','utf8'))
  .package.extensions['org.civicaitools.receipt-evidence-projection'].record_sha256
")"
# (3) recomputed over the record bytes carried VERBATIM inside the signed package
CARRIED_DIGEST="$(node -p "
const fs=require('node:fs'), crypto=require('node:crypto');
const c=JSON.parse(fs.readFileSync('$FIXTURES/evidence-projection-commitment.local.json','utf8'));
const ext=c.package.extensions['org.civicaitools.receipt-evidence-projection'];
crypto.createHash('sha256').update(Buffer.from(ext.record_bytes_verbatim,'utf8')).digest('hex')
")"
# (4) the 16-hex prefix receipt itself put in the record's FILENAME
FILENAME_PREFIX="${RECORD_STEM#0000-}"

echo "   fresh shasum -a 256 of the record file        : $FRESH_DIGEST"
echo "   digest inside the node's signed extension     : $NODE_EXT_DIGEST"
echo "   sha256 of the bytes carried in the signed pkg : $CARRIED_DIGEST"
echo "   receipt's own filename prefix (16 hex)        : $FILENAME_PREFIX"

[ "$FRESH_DIGEST" = "$NODE_EXT_DIGEST" ] || fail "digest join: fresh shasum != node extension"
[ "$NODE_EXT_DIGEST" = "$CARRIED_DIGEST" ] || fail "digest join: node extension != carried bytes"
[ "${FRESH_DIGEST:0:16}" = "$FILENAME_PREFIX" ] || fail "digest join: filename prefix != digest prefix"
echo "   digest join: all four readings agree on $FRESH_DIGEST"

# --------------------------------------------------------------------------
note "leg D: the hazards, executed — and three §6 table rows as negative controls"
# --------------------------------------------------------------------------
node "$ROOT/scripts/run-evidence-projection-hazards.mjs" "$FIXTURES" \
  || fail "hazard legs did not reproduce"

# --------------------------------------------------------------------------
note "leg E: mint reproducibility — re-mint and diff against the committed fixtures"
# --------------------------------------------------------------------------
rm -rf "$SCRATCH/mint"
mkdir -p "$SCRATCH/mint"
cp "$FIXTURES/$RECORD_STEM.json" \
   "$FIXTURES/$RECORD_STEM.body.json" \
   "$FIXTURES/$RECORD_STEM.producer.sig" \
   "$FIXTURES/emit-metadata.json" \
   "$FIXTURES/evidence-projection-trust-registry.json" \
   "$SCRATCH/mint/"
node "$ROOT/scripts/mint-evidence-projection.mjs" "$SCRATCH/mint" >/dev/null \
  || fail "re-mint failed"
for f in \
  evidence-projection-payload.json \
  evidence-projection-package.local.json \
  evidence-projection-commitment.local.json \
; do
  diff -q "$FIXTURES/$f" "$SCRATCH/mint/$f" >/dev/null \
    || fail "re-mint is not byte-reproducible: $f differs"
  echo "   byte-identical on re-mint: $f"
done

# --------------------------------------------------------------------------
note "leg F: record provenance — re-emit from a pinned receipt clone (OPTIONAL)"
# --------------------------------------------------------------------------
# The committed record was produced by receipt.evidence.emit_evidence_record,
# never hand-written. This leg proves it by re-running the emitter and diffing.
# It is deterministic because every emitter input is a constant: the signing
# seed is sha256 of a committed LABEL (no private key material in the tree) and
# emitted_at_utc is fixed.
if [ ! -d "$CLONES/receipt/.git" ]; then
  echo "   SKIPPED — no pinned receipt clone at .evidence-clones/receipt"
  echo "   This leg is the only one that needs network. To enable it:"
  echo "       git clone -b evidence-record-v1 https://github.com/npstorey/receipt.git \\"
  echo "           .evidence-clones/receipt"
  echo "       (then re-run this script; uv is required)"
  echo "   NOTE: legs A-E verified the COMMITTED record fixture. Without this leg"
  echo "   the harness does NOT re-derive that fixture from the emitter."
elif ! command -v uv >/dev/null; then
  echo "   SKIPPED — the clone is present but uv is not installed (https://docs.astral.sh/uv/)"
else
  head="$(git -C "$CLONES/receipt" rev-parse HEAD)"
  [ "$head" = "$RECEIPT_SHA" ] || fail "receipt clone is at $head, expected $RECEIPT_SHA"
  [ -z "$(git -C "$CLONES/receipt" status --porcelain)" ] \
    || fail "receipt clone is dirty — it must stay pinned and unmodified"
  echo "   receipt @ $head (clean)"
  export UV_CACHE_DIR="$CLONES/.uv-cache"
  export UV_PYTHON_INSTALL_DIR="$CLONES/.uv-python"
  rm -rf "$SCRATCH/emit"
  uv run --project "$CLONES/receipt" python "$ROOT/scripts/emit-evidence-record.py" "$SCRATCH/emit" \
    || fail "re-emission failed"
  for f in "$RECORD_STEM.json" "$RECORD_STEM.body.json" "$RECORD_STEM.producer.sig"; do
    cmp -s "$FIXTURES/$f" "$SCRATCH/emit/$f" \
      || fail "re-emission is not byte-identical to the committed fixture: $f"
    echo "   byte-identical on re-emission: $f"
  done
  echo "   the committed record came from the emitter, and comes back from it unchanged"
fi

echo
echo "ALL LEGS PASSED"
echo "  node id (packageHash): $(node -p "JSON.parse(require('node:fs').readFileSync('$FIXTURES/evidence-projection-commitment.local.json','utf8')).packageHash")"
echo "  record sha256        : $FRESH_DIGEST"
echo "  verdict              : structurally sound, and honestly NOT green —"
echo "                         #5 unknown_key, #14 no_registry_identity, #7/#8 unverified."
echo "                         Nothing was published; full-depth third-party verification"
echo "                         would require a production publish, which has not happened."
