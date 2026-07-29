#!/usr/bin/env bash
# verify-rulespec-interop.sh — poc/rulespec-interop verification harness
# (phase 3 single-node harness, extended for the dual-node POC).
#
# Reproduces, from a clean checkout of this branch, the full offline verification
# of the rulespec-interop POC artifacts:
#
#   leg A  pin the two upstream clones (rulespec-nz @ PR-104 head, axiom-corpus @
#          the corpus-release cut commit) into gitignored .rulespec-clones/
#   leg B  bootstrap the uv-managed receipt venv (Python >= 3.11, receipt pinned
#          to a git SHA) and run `receipt verify --spec verification/spec.py`
#          against the pinned rulespec-nz clone — THEIR verifier, exit 0 required
#   leg C  offline-verify all THREE committed local commitment bundles with
#          @typedstandards/verify-core@0.7.0 — OUR verifier — with fetch stubbed
#          to THROW (spec §9.4 / Q15 pattern): node 1 (the comparison event),
#          node 2 (the encoding run — an encoder apply manifest in Typed
#          Standards form, whose output field carries the re-encoded YAML bytes
#          themselves), and node 3 (node 2's record re-expressed under the
#          SPECULATIVE, UNREGISTERED contentProfile sketch
#          axiom/statute-encoding/v0-sketch — a demonstration of the
#          profile-bearing form; node 2 remains the canonical honest record).
#          Required verdict shape for EACH: all structural checks
#          pass (#1 #2 #3 #4 #12 #13), key trust is unknown_key (#5 — the
#          throwaway signing key is deliberately NOT in the registry snapshot),
#          #7 (RFC 3161) and #8 (Rekor) are honestly UNVERIFIED (calm-absent),
#          #14 degrades to no_registry_identity, and ZERO network calls are
#          attempted. A fully green verdict is NOT expected and would itself be
#          a failure of this harness's honesty. Leg C(3) additionally asserts
#          the verifier keeps IGNORING the unregistered sketch profile (#3 rule
#          unchanged, #15 profileType unchanged, profile id absent from the
#          verdict) — it must FAIL if a verifier starts treating the sketch as
#          registered — and that the honest not-run/none-declared declarations
#          are intact.
#   leg D  the digest join: the node-1 payload extension's
#          observed_upstream_artifact_sha256 == corpus-journal entryIndex 3's
#          sha256 for nz/regulations/acc/earners_levy.yaml == a fresh
#          shasum -a 256 of that file in the pinned clone. All three printed.
#   leg E  the tri-binding, extended to node 3: sha256 of the OUTPUT BYTES
#          CARRIED INSIDE node 2's signed package == fresh shasum -a 256 of the
#          committed scripts/fixtures/earners_levy.reencoded.yaml == node 2's
#          extension output_sha256 == node 1's extension our_reencoding_sha256
#          == sha256 of the output bytes carried inside node 3's signed package
#          == node 3's profileDeclarations.outputDigest — i.e. the encoding
#          node, the fixture file, the comparison node, and the profile-demo
#          node all bind the same bytes. All six printed.
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
# #5/#7/#8) exits non-zero. The runner is generic over the three POC nodes:
# the third argument names the extension digest field whose value must sit
# inside the signed JCS canonical bytes (node 1: the observed upstream
# artifact digest; nodes 2/3: the digest of their own carried output); the
# optional fourth argument `profile-demo` (node 3) adds the speculative-
# contentProfile assertions.
cat > "$HARNESS/run-offline-verify.mjs" <<'MJSEOF'
// poc/rulespec-interop — OFFLINE verification of a local commitment bundle
// with @typedstandards/verify-core (spec §9.2 sequence, §9.4 / Q15
// offline-harness pattern: fetch stubbed to THROW; zero network asserted).
// Runs against all THREE POC nodes (comparison event + encoding run +
// profile-bearing demo); they share key, signer, type, captureMethod, and
// absence profile, so the expected verdict shape is identical for all —
// only the hashes differ. Node 3 additionally carries the SPECULATIVE,
// UNREGISTERED contentProfile sketch, which verify-core 0.7.0 must keep
// silently ignoring (see the profile-demo assertions below).
//
// Expected verdict shape (written down BEFORE any run — see the phase-3,
// encoding-node, and node-3 pre-run records): structural checks pass
// (#1 #2 #3 #4 #12 #13), key trust is unknown_key (#5), signer-identity
// check degrades to no_registry_identity (#14), #7/#8 are
// calm-absent/UNVERIFIED (no TSA token, no Rekor entry), #9 vacuous,
// #10 active/none, #15 ok. Any divergence — better or worse — fails this
// script.
//
// Usage: node run-offline-verify.mjs <commitment.json> <payload.json> <containment-ext-key> [profile-demo]

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  verifyEvidence,
  validateRegistry,
  jcs,
} from '@typedstandards/verify-core';

const [, , commitmentPath, payloadPath, containmentKey, mode] = process.argv;
if (!commitmentPath || !payloadPath || !containmentKey) {
  console.error('usage: node run-offline-verify.mjs <commitment.json> <payload.json> <containment-ext-key> [profile-demo]');
  process.exit(2);
}
const profileDemo = mode === 'profile-demo';
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

console.log(`=== bundle: ${commitmentPath} ===`);
console.log('=== Typed Standards verifier (verify-core v0.7.0) — verdict (verbatim, FULL) ===');
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

// --- the contentProfile axis ----------------------------------------------
// Node 3 (profile-demo mode) carries metadata.contentProfile =
// "axiom/statute-encoding/v0-sketch" — a SPECULATIVE, UNREGISTERED sketch id
// (no spec value, no ADR, no registry, no verifier vocabulary). The step-1
// prediction, written BEFORE any run: verify-core 0.7.0 consults
// contentProfile only (a) on check #3's pre-v0.1 fallback branch — never
// taken here, the package carries an explicit contentCanonicalization — and
// (b) in check #15's profile-type resolution, where every non-datHere value
// falls through to the implicit 'ai-assisted-analysis'. So the unknown
// profile id must leave the verdict IDENTICAL in shape to nodes 1/2 (the
// exact #3 and #15 states are already asserted above for every node) and
// must appear NOWHERE in the verdict. If a future verify-core starts
// treating the sketch as registered — a different #3 rule, a different #15
// profileType, or any verdict surface naming the profile id — these
// assertions FAIL, by design: the demo is only honest while the profile
// stays unregistered.
const SKETCH_PROFILE = 'axiom/statute-encoding/v0-sketch';
if (profileDemo) {
  assert.equal(pkg.metadata.contentProfile, SKETCH_PROFILE, 'node 3 metadata.contentProfile');
  assert.ok(
    !JSON.stringify(result).includes(SKETCH_PROFILE),
    'verdict must NOT mention the sketch profile id — the verifier must not treat it as registered',
  );
  assert.ok(!('producerProfile' in pkg), 'node 3 must not claim a producerProfile');
  const ext3 = pkg.extensions['org.civicaitools.rulespec-interop'];
  assert.equal(ext3.role, 'encoding-run-profile-demo', 'node 3 role discriminator');
  assert.equal(ext3.profileStatus, 'speculative-unregistered-sketch', 'node 3 profileStatus');
  assert.equal(
    ext3.profileDeclarations.oracleComparisons.status,
    'not-run',
    'oracleComparisons must stay honestly not-run (no oracle was compared in this POC)',
  );
  assert.ok(ext3.profileDeclarations.oracleComparisons.reason.length > 0, 'oracleComparisons carries a reason');
  assert.equal(
    ext3.profileDeclarations.gateDeclarations.status,
    'none-declared',
    'gateDeclarations must stay honestly none-declared',
  );
  assert.ok(ext3.profileDeclarations.gateDeclarations.reason.length > 0, 'gateDeclarations carries a reason');
  assert.equal(
    ext3.profileDeclarations.outputDigest,
    ext3.output_sha256,
    'profileDeclarations.outputDigest == extension output_sha256',
  );
} else {
  assert.ok(
    !('contentProfile' in pkg.metadata),
    'nodes 1/2 carry no contentProfile (default by absence)',
  );
}

// --- extension round-trip + signed-bytes containment ----------------------
const extPayload = JSON.stringify(payload.extensions['org.civicaitools.rulespec-interop']);
const extPackage = JSON.stringify(pkg.extensions['org.civicaitools.rulespec-interop']);
assert.equal(extPackage, extPayload, 'extension round-trips into the signed package unchanged');
const canonical = jcs(pkg);
const digest = payload.extensions['org.civicaitools.rulespec-interop'][containmentKey];
assert.match(String(digest), /^[0-9a-f]{64}$/, `extension field ${containmentKey} is a sha256 hex digest`);
const offset = canonical.indexOf(digest);
assert.ok(offset >= 0, `extension ${containmentKey} sits INSIDE the JCS canonical (signed) bytes`);
console.log(`extension containment: ${containmentKey} ${digest.slice(0, 8)}… at byte offset ${offset} of ${Buffer.byteLength(canonical, 'utf8')} JCS bytes`);
// The package's FULL output field (for the encoding node, the verbatim
// re-encoded YAML) also sits inside the signed bytes. RFC 8785 string
// serialization equals ECMAScript JSON.stringify for strings, so the
// JSON-escaped body of the output is a substring of the JCS bytes.
const escapedOutputBody = JSON.stringify(pkg.output).slice(1, -1);
const outputOffset = canonical.indexOf(escapedOutputBody);
assert.ok(outputOffset >= 0, 'FULL output body sits INSIDE the JCS canonical (signed) bytes');
console.log(`output containment: full output (JSON-escaped body, ${escapedOutputBody.length} chars) at byte offset ${outputOffset} of ${Buffer.byteLength(canonical, 'utf8')} JCS bytes`);
if (profileDemo) {
  const profileOffset = canonical.indexOf(`"contentProfile":"${SKETCH_PROFILE}"`);
  assert.ok(profileOffset >= 0, 'speculative contentProfile sits INSIDE the JCS canonical (signed) bytes');
  const declOffset = canonical.indexOf('"profileDeclarations":');
  assert.ok(declOffset >= 0, 'profileDeclarations block sits INSIDE the JCS canonical (signed) bytes');
  console.log(`profile containment: contentProfile "${SKETCH_PROFILE}" at byte offset ${profileOffset}; profileDeclarations at byte offset ${declOffset} of ${Buffer.byteLength(canonical, 'utf8')} JCS bytes`);
}

console.log('OFFLINE VERIFY: expected verdict shape CONFIRMED (structural pass + unknown_key + #7/#8 unverified + 0 fetches)');
MJSEOF

echo "   --- leg C(1): node 1 — the comparison event ---"
node "$HARNESS/run-offline-verify.mjs" \
  "$FIXTURES/rulespec-interop-commitment.local.json" \
  "$FIXTURES/rulespec-interop-payload.json" \
  observed_upstream_artifact_sha256 \
  || fail "verify-core offline verification (node 1) did not match the expected verdict shape"
echo "   --- leg C(2): node 2 — the encoding run (apply-manifest form) ---"
node "$HARNESS/run-offline-verify.mjs" \
  "$FIXTURES/rulespec-interop-encoding-commitment.local.json" \
  "$FIXTURES/rulespec-interop-encoding-payload.json" \
  output_sha256 \
  || fail "verify-core offline verification (node 2) did not match the expected verdict shape"
echo "   --- leg C(3): node 3 — the encoding run under the speculative profile sketch (demo form) ---"
node "$HARNESS/run-offline-verify.mjs" \
  "$FIXTURES/rulespec-interop-encoding-profile-commitment.local.json" \
  "$FIXTURES/rulespec-interop-encoding-profile-payload.json" \
  output_sha256 \
  profile-demo \
  || fail "verify-core offline verification (node 3) did not match the expected verdict shape"

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

# --------------------------------------------------------------------------
note "leg E: tri-binding (encoding node's carried bytes == fixture file == node-1 extension == node-3 carried bytes)"
# --------------------------------------------------------------------------
# The encoding node CARRIES the re-encoded YAML as its output field, inside its
# signed bytes — and so does node 3 (the profile-demo re-expression). Assert:
# sha256(node 2's carried bytes) == fresh shasum of the committed fixture file
# == node 2's extension output_sha256 == node 1's extension
# our_reencoding_sha256 == sha256(node 3's carried bytes) == node 3's
# profileDeclarations.outputDigest. Six independent readings, one value.
CARRIED_DIGEST="$(node -e "
const crypto = require('node:crypto');
const fs = require('node:fs');
const commitment = JSON.parse(fs.readFileSync('$FIXTURES/rulespec-interop-encoding-commitment.local.json', 'utf8'));
const pkgFixture = JSON.parse(fs.readFileSync('$FIXTURES/rulespec-interop-encoding-package.local.json', 'utf8'));
if (JSON.stringify(pkgFixture) !== JSON.stringify(commitment.package)) {
  console.error('encoding package fixture does not match the package inside the commitment bundle');
  process.exit(1);
}
const ext = commitment.package.extensions['org.civicaitools.rulespec-interop'];
if (ext.role !== 'encoding-run') {
  console.error('encoding node extension is missing the role: encoding-run discriminator');
  process.exit(1);
}
console.log(crypto.createHash('sha256').update(Buffer.from(commitment.package.output, 'utf8')).digest('hex'));
")"
NODE2_EXT_DIGEST="$(node -p "JSON.parse(require('fs').readFileSync('$FIXTURES/rulespec-interop-encoding-payload.json','utf8')).extensions['org.civicaitools.rulespec-interop'].output_sha256")"
NODE1_EXT_DIGEST="$(node -p "JSON.parse(require('fs').readFileSync('$FIXTURES/rulespec-interop-payload.json','utf8')).extensions['org.civicaitools.rulespec-interop'].our_reencoding_sha256")"
FILE_DIGEST="$(shasum -a 256 "$FIXTURES/earners_levy.reencoded.yaml" | awk '{print $1}')"
# Node 3 carries the SAME output bytes inside its own signed package; its
# profileDeclarations.outputDigest must also bind them.
CARRIED3_DIGEST="$(node -e "
const crypto = require('node:crypto');
const fs = require('node:fs');
const commitment = JSON.parse(fs.readFileSync('$FIXTURES/rulespec-interop-encoding-profile-commitment.local.json', 'utf8'));
const pkgFixture = JSON.parse(fs.readFileSync('$FIXTURES/rulespec-interop-encoding-profile-package.local.json', 'utf8'));
if (JSON.stringify(pkgFixture) !== JSON.stringify(commitment.package)) {
  console.error('node 3 package fixture does not match the package inside the commitment bundle');
  process.exit(1);
}
const ext = commitment.package.extensions['org.civicaitools.rulespec-interop'];
if (ext.role !== 'encoding-run-profile-demo') {
  console.error('node 3 extension is missing the role: encoding-run-profile-demo discriminator');
  process.exit(1);
}
console.log(crypto.createHash('sha256').update(Buffer.from(commitment.package.output, 'utf8')).digest('hex'));
")"
NODE3_DECL_DIGEST="$(node -p "JSON.parse(require('fs').readFileSync('$FIXTURES/rulespec-interop-encoding-profile-payload.json','utf8')).extensions['org.civicaitools.rulespec-interop'].profileDeclarations.outputDigest")"
echo "   sha256 of output bytes carried in node 2's signed package: $CARRIED_DIGEST"
echo "   fresh shasum -a 256 of committed earners_levy.reencoded.yaml: $FILE_DIGEST"
echo "   node 2 extension output_sha256:                              $NODE2_EXT_DIGEST"
echo "   node 1 extension our_reencoding_sha256:                      $NODE1_EXT_DIGEST"
echo "   sha256 of output bytes carried in node 3's signed package: $CARRIED3_DIGEST"
echo "   node 3 profileDeclarations.outputDigest:                     $NODE3_DECL_DIGEST"
[ "$CARRIED_DIGEST" = "$FILE_DIGEST" ] || fail "tri-binding: carried output bytes != fixture file"
[ "$CARRIED_DIGEST" = "$NODE2_EXT_DIGEST" ] || fail "tri-binding: carried output bytes != node 2 extension output_sha256"
[ "$CARRIED_DIGEST" = "$NODE1_EXT_DIGEST" ] || fail "tri-binding: carried output bytes != node 1 extension our_reencoding_sha256"
[ "$CARRIED3_DIGEST" = "$FILE_DIGEST" ] || fail "tri-binding: node 3 carried output bytes != fixture file"
[ "$NODE3_DECL_DIGEST" = "$FILE_DIGEST" ] || fail "tri-binding: node 3 profileDeclarations.outputDigest != fixture file"
echo "   tri-binding: all six values identical — encoding node, fixture file, comparison node, and profile-demo node bind the same bytes"

echo
echo "ALL LEGS PASSED: pinned clones + receipt verify (exit 0) + verify-core offline"
echo "verdicts for all THREE nodes (structural pass, unknown_key, #7/#8 unverified,"
echo "0 fetches; node 3's speculative profile ignored, not resolved) + digest join"
echo "+ tri-binding of the re-encoding bytes across nodes 1, 2, and 3."
