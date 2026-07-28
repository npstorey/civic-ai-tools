#!/usr/bin/env bash
# verify-rulespec-interop.sh — poc/rulespec-interop phase 3 verification harness.
#
# Reproduces, from a clean checkout of this branch, the full offline verification
# of the rulespec-interop POC artifacts:
#
#   leg A  pin the two upstream clones (rulespec-nz @ PR-104 head, axiom-corpus @
#          the corpus-release cut commit) into gitignored .rulespec-clones/
#   leg B  bootstrap the uv-managed receipt venv (Python >= 3.11, receipt pinned
#          to a git SHA) and run `receipt verify --spec verification/spec.py`
#          against the pinned rulespec-nz clone — THEIR verifier, exit 0 required
#   leg C  offline-verify the committed local commitment bundle with
#          @typedstandards/verify-core@0.7.0 — OUR verifier — with fetch stubbed
#          to THROW (spec §9.4 / Q15 pattern). Required verdict shape: all
#          structural checks pass (#1 #2 #3 #4 #12 #13), key trust is
#          unknown_key (#5 — the throwaway signing key is deliberately NOT in
#          the registry snapshot), #7 (RFC 3161) and #8 (Rekor) are honestly
#          UNVERIFIED (calm-absent), #14 degrades to no_registry_identity, and
#          ZERO network calls are attempted. A fully green verdict is NOT
#          expected and would itself be a failure of this harness's honesty.
#   leg D  the digest join: the payload extension's
#          observed_upstream_artifact_sha256 == corpus-journal entryIndex 3's
#          sha256 for nz/regulations/acc/earners_levy.yaml == a fresh
#          shasum -a 256 of that file in the pinned clone. All three printed.
#
# No secrets, no credentials, no production (civicaitools.org) requests.
# Network is used ONLY to clone/install pinned sources when absent
# (github.com, registry.npmjs.org); the verification itself is offline.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLONES="$ROOT/.rulespec-clones"
HARNESS="$CLONES/verify-harness"
FIXTURES="$ROOT/scripts/fixtures"

RULESPEC_NZ_SHA="7dd2b1ad8f13ff934aa53af562a34ea7451502f6"   # PR 104 head
AXIOM_CORPUS_SHA="92ac9c1bedf62968eeea9a873361f49075364157"  # release cut commit
RECEIPT_SHA="c711adc0d0fb514b8806f83b36579e4cb4c621a7"       # receipt pin
VERIFY_CORE_VERSION="0.7.0"

# Keep every uv artifact inside the gitignored clones dir.
export UV_PYTHON_INSTALL_DIR="$CLONES/.uv-python"
export UV_CACHE_DIR="$CLONES/.uv-cache"

mkdir -p "$CLONES"

fail() { echo "FAIL: $*" >&2; exit 1; }
note() { echo "== $*"; }

# --------------------------------------------------------------------------
note "leg A: pinned upstream clones"
# --------------------------------------------------------------------------
pin_clone() {
  # pin_clone <dir> <url> <sha> [extra-fetch-refspec]
  dir="$1"; url="$2"; sha="$3"; refspec="${4:-}"
  if [ ! -d "$dir/.git" ]; then
    git clone "$url" "$dir"
  fi
  if ! git -C "$dir" rev-parse --verify --quiet "${sha}^{commit}" >/dev/null; then
    if [ -n "$refspec" ]; then
      git -C "$dir" fetch origin "$refspec"
    else
      git -C "$dir" fetch origin
    fi
  fi
  git -C "$dir" rev-parse --verify --quiet "${sha}^{commit}" >/dev/null \
    || fail "$dir: pinned commit $sha not reachable after fetch"
  head="$(git -C "$dir" rev-parse HEAD)"
  if [ "$head" != "$sha" ]; then
    git -C "$dir" checkout --quiet "$sha"
  fi
  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    fail "$dir: working tree is not clean — clones must stay pinned and unmodified"
  fi
  echo "   $dir @ $(git -C "$dir" rev-parse HEAD) (clean)"
}
pin_clone "$CLONES/rulespec-nz" "https://github.com/TheAxiomFoundation/rulespec-nz" \
  "$RULESPEC_NZ_SHA" "pull/104/head"
pin_clone "$CLONES/axiom-corpus" "https://github.com/TheAxiomFoundation/axiom-corpus" \
  "$AXIOM_CORPUS_SHA"

# --------------------------------------------------------------------------
note "leg B: receipt verify (their verifier) — uv venv, receipt @ $RECEIPT_SHA"
# --------------------------------------------------------------------------
command -v uv >/dev/null || fail "uv is required (https://docs.astral.sh/uv/)"
VENV="$CLONES/.venv"
if [ ! -x "$VENV/bin/receipt" ]; then
  uv venv --python ">=3.11" "$VENV"
  uv pip install --python "$VENV/bin/python" \
    "git+https://github.com/TheAxiomFoundation/receipt@$RECEIPT_SHA"
fi
"$VENV/bin/python" - "$RECEIPT_SHA" <<'PYEOF'
import importlib.metadata, json, sys
d = importlib.metadata.distribution("receipt")
raw = d.read_text("direct_url.json")
commit = json.loads(raw)["vcs_info"]["commit_id"] if raw else None
if commit != sys.argv[1]:
    raise SystemExit(f"FAIL: receipt venv is not pinned to {sys.argv[1]} (found {commit})")
print(f"   receipt {d.version} pinned @ {commit}")
PYEOF
pyver="$("$VENV/bin/python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
echo "   venv python $pyver"
( cd "$CLONES/rulespec-nz" && "$VENV/bin/receipt" verify --spec verification/spec.py ) \
  || fail "receipt verify exited non-zero"
echo "   receipt verify: exit 0"

# --------------------------------------------------------------------------
note "leg C: verify-core offline verification (our verifier)"
# --------------------------------------------------------------------------
command -v node >/dev/null || fail "node is required"
command -v npm  >/dev/null || fail "npm is required"
mkdir -p "$HARNESS"
installed="$(node -p "try{require('$HARNESS/node_modules/@typedstandards/verify-core/package.json').version}catch{''}" 2>/dev/null || true)"
if [ "$installed" != "$VERIFY_CORE_VERSION" ]; then
  ( cd "$HARNESS" && npm install --no-fund --no-audit "@typedstandards/verify-core@$VERIFY_CORE_VERSION" )
fi
echo "   @typedstandards/verify-core @ $(node -p "require('$HARNESS/node_modules/@typedstandards/verify-core/package.json').version")"

# The offline runner is written by this harness (self-contained: a clean
# checkout carries no file under gitignored .rulespec-clones/). fetch is
# stubbed to THROW; the exact expected verdict shape is asserted field by
# field — a divergence in EITHER direction (including an unexpectedly green
# #5/#7/#8) exits non-zero.
cat > "$HARNESS/run-offline-verify.mjs" <<'MJSEOF'
// poc/rulespec-interop phase 3 — OFFLINE verification of the local commitment
// bundle with @typedstandards/verify-core (spec §9.2 sequence, §9.4 / Q15
// offline-harness pattern: fetch stubbed to THROW; zero network asserted).
//
// Expected verdict shape (written down BEFORE any run — see the phase-3 record):
// structural checks pass (#1 #2 #3 #4 #12 #13), key trust is unknown_key (#5),
// signer-identity check degrades to no_registry_identity (#14), #7/#8 are
// calm-absent/UNVERIFIED (no TSA token, no Rekor entry), #9 vacuous, #10
// active/none, #15 ok. Any divergence — better or worse — fails this script.
//
// Usage: node run-offline-verify.mjs <commitment.json> <payload.json>

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  verifyEvidence,
  validateRegistry,
  jcs,
} from '@typedstandards/verify-core';

const [, , commitmentPath, payloadPath] = process.argv;
if (!commitmentPath || !payloadPath) {
  console.error('usage: node run-offline-verify.mjs <commitment.json> <payload.json>');
  process.exit(2);
}
const commitment = JSON.parse(readFileSync(commitmentPath, 'utf8'));
const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));

// --- fetch stubbed to THROW (spec §9.4 / Q15 pattern) ----------------------
let fetches = 0;
const blockedFetch = (...args) => {
  fetches += 1;
  throw new Error(`NETWORK BLOCKED — offline harness attempted a fetch: ${String(args[0])}`);
};
globalThis.fetch = blockedFetch;

const pkg = commitment.package;
const registry = validateRegistry(commitment.trustRegistry);
assert.ok(registry, 'inline trust registry must validate structurally');

const input = {
  package: pkg,
  packageHash: commitment.packageHash,
  signature: commitment.signature,
  rfc3161Timestamp: null,
  rekorEntryId: null,
  lifecycle: null,
};

const result = await verifyEvidence(input, { registry, fetch: blockedFetch });

console.log('=== verify-core v0.7.0 verdict (verbatim, FULL) ===');
console.log(JSON.stringify(result, null, 2));
console.log('=== network calls attempted:', fetches, '===');

// --- assert the step-1 expectation EXACTLY --------------------------------
const KID = 'local:rulespec-interop-poc-2026-07';

// #1 envelope integrity
assert.equal(result.hashMatch, true, '#1 hashMatch');
assert.deepEqual(result.envelopeIntegrity, { status: 'verified' }, '#1 envelopeIntegrity');
assert.equal(result.recomputedHash, commitment.packageHash, '#1 recomputedHash');
// #2 signature (valid against the EMBEDDED key)
assert.equal(result.signatureValid, true, '#2 signatureValid');
assert.equal(result.hasSigning, true, '#2 hasSigning');
assert.equal(result.kid, KID, '#2 kid');
// #3 content-canonicalization resolution
assert.deepEqual(
  result.contentCanonicalization,
  { status: 'ok', rule: 'https://typedstandards.org/canonicalization/legacy-json/v1' },
  '#3 contentCanonicalization',
);
// #4 content hash
assert.equal(result.contentHash.status, 'ok', '#4 contentHash.status');
assert.deepEqual(result.contentHash.algorithms, ['sha256'], '#4 algorithms');
assert.equal(result.contentHash.matched, 'sha256', '#4 matched');
// #5 trust registry — the honest headline: unknown_key
assert.deepEqual(
  result.keyTrust,
  { status: 'unknown_key', verified: false, kid: KID },
  '#5 keyTrust must be unknown_key (throwaway key is NOT in the registry)',
);
// #6 signingKeyId consistency (not a discrete verify-core field; assert directly)
assert.equal(pkg.metadata.signingKeyId, commitment.signature.kid, '#6 signingKeyId === envelope kid');
// #7 RFC 3161 — UNVERIFIED (calm-absent), not failed
assert.equal(result.hasTimestamp, false, '#7 hasTimestamp');
assert.equal(result.rfc3161, null, '#7 rfc3161 null (unverified)');
// #8 Rekor — UNVERIFIED (calm-absent), not failed
assert.equal(result.hasRekor, false, '#8 hasRekor');
assert.equal(result.rekorVerified, null, '#8 rekorVerified null (unverified)');
assert.equal(result.rekorDetails, null, '#8 rekorDetails');
assert.equal(result.rekorInclusion, null, '#8 rekorInclusion');
assert.ok(!('rekorIntegratedTime' in result), '#8 no rekorIntegratedTime');
// #9 blob refs — vacuous (no BlobRefs in this package)
assert.deepEqual(result.blobRefs, [], '#9 blobRefs empty');
assert.equal(result.blobRefsVerified, null, '#9 blobRefsVerified null');
// #10 lifecycle
assert.deepEqual(result.lifecycle, { status: 'active', source: 'none', chain: [] }, '#10 lifecycle');
// #12 type resolution
assert.deepEqual(result.typeResolution, { status: 'ok', type: 'content/analysis/v1' }, '#12 type');
// #13 nodeId
assert.equal(result.nodeId, commitment.packageHash, '#13 nodeId');
// #14 signer identity — degraded consequence of the unknown key, NOT a mismatch
assert.deepEqual(
  result.signerIdentity,
  { status: 'no_registry_identity', claimed: 'local:rulespec-interop-poc' },
  '#14 signerIdentity',
);
// #15 captureMethod vocabulary
assert.deepEqual(
  result.captureMethodVocab,
  { status: 'ok', captureMethod: 'claude-code-jsonl-readback', profileType: 'ai-assisted-analysis' },
  '#15 captureMethodVocab',
);
// zero network
assert.equal(fetches, 0, 'ZERO network calls attempted');

// --- extension round-trip + signed-bytes containment ----------------------
const extPayload = JSON.stringify(payload.extensions['org.civicaitools.rulespec-interop']);
const extPackage = JSON.stringify(pkg.extensions['org.civicaitools.rulespec-interop']);
assert.equal(extPackage, extPayload, 'extension round-trips into the signed package unchanged');
const canonical = jcs(pkg);
const digest = payload.extensions['org.civicaitools.rulespec-interop'].observed_upstream_artifact_sha256;
const offset = canonical.indexOf(digest);
assert.ok(offset >= 0, 'observed upstream digest sits INSIDE the JCS canonical (signed) bytes');
console.log(`extension containment: upstream digest ${digest.slice(0, 8)}… at byte offset ${offset} of ${Buffer.byteLength(canonical, 'utf8')} JCS bytes`);

console.log('OFFLINE VERIFY: expected verdict shape CONFIRMED (structural pass + unknown_key + #7/#8 unverified + 0 fetches)');
MJSEOF

node "$HARNESS/run-offline-verify.mjs" \
  "$FIXTURES/rulespec-interop-commitment.local.json" \
  "$FIXTURES/rulespec-interop-payload.json" \
  || fail "verify-core offline verification did not match the expected verdict shape"

# --------------------------------------------------------------------------
note "leg D: triple digest join (extension == journal entryIndex 3 == fresh shasum)"
# --------------------------------------------------------------------------
EXT_DIGEST="$(node -p "JSON.parse(require('fs').readFileSync('$FIXTURES/rulespec-interop-payload.json','utf8')).extensions['org.civicaitools.rulespec-interop'].observed_upstream_artifact_sha256")"
JOURNAL_DIGEST="$(node -e "
const lines = require('fs').readFileSync('$CLONES/rulespec-nz/verification/corpus-journal.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse);
const e = lines.find(x => x.entryIndex === 3);
if (!e || e.path !== 'nz/regulations/acc/earners_levy.yaml') { console.error('journal entryIndex 3 is not earners_levy.yaml:', e && e.path); process.exit(1); }
console.log(e.sha256);
")"
FRESH_DIGEST="$(shasum -a 256 "$CLONES/rulespec-nz/nz/regulations/acc/earners_levy.yaml" | awk '{print $1}')"
echo "   extension observed_upstream_artifact_sha256: $EXT_DIGEST"
echo "   corpus-journal entryIndex 3 sha256:          $JOURNAL_DIGEST"
echo "   fresh shasum -a 256 (pinned clone):          $FRESH_DIGEST"
[ "$EXT_DIGEST" = "$JOURNAL_DIGEST" ] || fail "digest join: extension != journal"
[ "$JOURNAL_DIGEST" = "$FRESH_DIGEST" ] || fail "digest join: journal != fresh shasum"
echo "   digest join: all three values identical"

echo
echo "ALL LEGS PASSED: pinned clones + receipt verify (exit 0) + verify-core offline"
echo "verdict (structural pass, unknown_key, #7/#8 unverified, 0 fetches) + digest join."
