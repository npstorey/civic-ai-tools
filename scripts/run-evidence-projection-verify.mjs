// run-evidence-projection-verify.mjs — OFFLINE verification of the committed
// evidence-projection commitment bundle with @typedstandards/verify-core
// (spec §9.2 sequence; §9.4 / Q15 offline-harness pattern: `fetch` stubbed to
// THROW, zero network asserted).
//
// EXPECTED VERDICT SHAPE — written down BEFORE the first run, and asserted
// field by field below. The node is signed with a local throwaway key that is
// deliberately absent from the inline trust-registry snapshot, and it carries
// no RFC 3161 token and no Rekor entry, so:
//
//   structural checks pass  — #1 #2 #3 #4 #12 #13
//   key trust               — unknown_key            (#5)   NOT green, by design
//   signer identity         — no_registry_identity   (#14)  NOT green, by design
//   RFC 3161                — calm-absent/UNVERIFIED (#7)   NOT green, by design
//   Rekor                   — calm-absent/UNVERIFIED (#8)   NOT green, by design
//   blob refs               — vacuous                (#9)
//   lifecycle               — active / none          (#10)
//   captureMethod vocab     — ok                     (#15)
//   network calls attempted — 0
//
// A divergence in EITHER direction fails this script. In particular a GREEN
// #5, #7 or #8 is a FAILURE: this branch publishes nothing, mints no registry
// key, obtains no timestamp and logs no entry, so a green result there would
// mean the harness is lying about what it verified.
//
// Usage: node scripts/run-evidence-projection-verify.mjs <commitment.json> <payload.json>

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyEvidence, validateRegistry, jcs } from '@typedstandards/verify-core';

const [, , commitmentPath, payloadPath] = process.argv;
if (!commitmentPath || !payloadPath) {
  console.error('usage: node run-evidence-projection-verify.mjs <commitment.json> <payload.json>');
  process.exit(2);
}

const commitment = JSON.parse(readFileSync(commitmentPath, 'utf8'));
const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));

// --- fetch stubbed to THROW (spec §9.4 / Q15 pattern) -----------------------
let fetches = 0;
const blockedFetch = (...args) => {
  fetches += 1;
  throw new Error(`NETWORK BLOCKED — offline harness attempted a fetch: ${String(args[0])}`);
};
globalThis.fetch = blockedFetch;

const pkg = commitment.package;
const registry = validateRegistry(commitment.trustRegistry);
assert.ok(registry, 'inline trust registry must validate structurally');

const result = await verifyEvidence(
  {
    package: pkg,
    packageHash: commitment.packageHash,
    signature: commitment.signature,
    rfc3161Timestamp: null,
    rekorEntryId: null,
    lifecycle: null,
  },
  { registry, fetch: blockedFetch },
);

console.log('=== Typed Standards verifier (verify-core 0.9.0) — verdict (verbatim, FULL) ===');
console.log(JSON.stringify(result, null, 2));
console.log('=== network calls attempted:', fetches, '===');

const KID = 'local:evidence-projection-poc-2026-08';
const EXT_KEY = 'org.civicaitools.receipt-evidence-projection';

// --- the verdict, asserted FIELD BY FIELD ----------------------------------
// #1 envelope integrity
assert.equal(result.hashMatch, true, '#1 hashMatch');
assert.deepEqual(result.envelopeIntegrity, { status: 'verified' }, '#1 envelopeIntegrity');
assert.equal(result.recomputedHash, commitment.packageHash, '#1 recomputedHash');
// #2 signature (valid against the EMBEDDED key)
assert.equal(result.signatureValid, true, '#2 signatureValid');
assert.equal(result.hasSigning, true, '#2 hasSigning');
assert.equal(result.kid, KID, '#2 kid');
assert.equal(commitment.signature.algorithm, 'Ed25519ph', '#2 algorithm is Ed25519ph');
// #3 content-canonicalization resolution — OUR rule, for OUR package
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
  '#5 keyTrust must be unknown_key (the throwaway key is NOT in the registry snapshot)',
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
  { status: 'no_registry_identity', claimed: 'local:evidence-projection-poc' },
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

// --- the NOT-GREEN guard, stated positively --------------------------------
// The three checks above that must stay un-green are re-asserted here as their
// own named failures, so a future verifier change that "improves" them fails
// loudly on a line that says why that is wrong rather than on a deep deepEqual.
assert.notEqual(result.keyTrust.status, 'ok', '#5 must NOT be green — nothing here is registry-trusted');
assert.equal(result.keyTrust.verified, false, '#5 must NOT report verified');
assert.notEqual(result.rfc3161?.verified, true, '#7 must NOT be green — no RFC 3161 token exists');
assert.notEqual(result.rekorVerified, true, '#8 must NOT be green — no Rekor entry exists');
assert.notEqual(result.signerIdentity.status, 'ok', '#14 must NOT be green — no registry identity');

// --- the extension round-trips into the signed package ---------------------
const extPayload = JSON.stringify(payload.extensions[EXT_KEY]);
const extPackage = JSON.stringify(pkg.extensions[EXT_KEY]);
assert.equal(extPackage, extPayload, 'extension round-trips into the signed package unchanged');
const ext = pkg.extensions[EXT_KEY];

// --- THE SUBJECT RULE (non-negotiable, carried from poc/rulespec-interop) ---
// The foreign artifact's digest is an OBSERVATION inside our signed bytes. It
// is never this node's identity, never its content fingerprint, and never a
// co-signed claim.
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
assert.match(ext.record_sha256, /^[0-9a-f]{64}$/, 'record_sha256 is a sha256 hex digest');
assert.equal(ext.co_signed, false, 'SUBJECT RULE: the record is observed, never co-signed');
assert.notEqual(
  commitment.packageHash,
  ext.record_sha256,
  'SUBJECT RULE: packageHash is OUR envelope hash and must never be the foreign record digest',
);
assert.notEqual(
  result.nodeId,
  ext.record_sha256,
  'SUBJECT RULE: nodeId must never be the foreign record digest',
);
assert.notEqual(
  pkg.contentHash.sha256,
  ext.record_sha256,
  'SUBJECT RULE: contentHash fingerprints OUR package, never the foreign record',
);
// The foreign producer's identity must NOT have been projected into `signer`,
// which is check #14's subject and is resolved against OUR kid.
assert.equal(pkg.signer.identifier, 'local:evidence-projection-poc', 'signer is OURS');
assert.notEqual(
  pkg.signer.identifier,
  ext.producer_claimed.repo,
  "SUBJECT RULE: receipt's producer claim must not become this node's signer",
);
assert.notEqual(
  pkg.signer.displayName,
  ext.producer_claimed.repo,
  "SUBJECT RULE: receipt's producer claim must not become this node's signer displayName",
);

// --- containment: the observations sit INSIDE the signed canonical bytes ----
const canonical = jcs(pkg);
const canonicalBytes = Buffer.byteLength(canonical, 'utf8');
const containment = (needle, label) => {
  const offset = canonical.indexOf(needle);
  assert.ok(offset >= 0, `${label} sits INSIDE the JCS canonical (signed) bytes`);
  return offset;
};
const digestOffset = containment(ext.record_sha256, 'record_sha256');
// The record's own bytes, carried verbatim. RFC 8785 string serialization
// equals ECMAScript JSON.stringify for strings, so the JSON-escaped body of
// the carried string is a substring of the JCS bytes.
const escapedRecord = JSON.stringify(ext.record_bytes_verbatim).slice(1, -1);
const recordOffset = containment(escapedRecord, 'record_bytes_verbatim');
const sigOffset = containment(ext.producer_signature_base64, 'producer_signature_base64');
const domainOffset = containment(ext.producer_signature_domain_hex, 'producer_signature_domain_hex');
console.log(`containment (of ${canonicalBytes} JCS bytes):`);
console.log(`   record_sha256                  ${ext.record_sha256.slice(0, 8)}… @ ${digestOffset}`);
console.log(`   record_bytes_verbatim          ${escapedRecord.length} chars @ ${recordOffset}`);
console.log(`   producer_signature_base64      @ ${sigOffset}`);
console.log(`   producer_signature_domain_hex  @ ${domainOffset}`);

// --- the carried bytes really are the bytes the digest names ---------------
const carriedRecord = Buffer.from(ext.record_bytes_verbatim, 'utf8');
assert.equal(carriedRecord.length, ext.record_byte_length, 'carried record byte length');
assert.equal(sha256(carriedRecord), ext.record_sha256, 'sha256(carried record bytes) === record_sha256');
assert.equal(carriedRecord[carriedRecord.length - 1], 0x0a, 'carried record bytes end in LF');
const carriedBody = Buffer.from(ext.body_bytes_verbatim, 'utf8');
assert.equal(
  sha256(carriedBody),
  ext.body_sha256_claimed_by_record,
  "sha256(carried body bytes) === the record's own body.sha256",
);
assert.equal(carriedBody[carriedBody.length - 1], 0x0a, 'carried body bytes end in LF too');

console.log(
  'OFFLINE VERIFY: expected verdict shape CONFIRMED ' +
    '(structural pass + unknown_key + no_registry_identity + #7/#8 unverified + 0 fetches), ' +
    'subject rule held, observations contained in the signed bytes',
);
