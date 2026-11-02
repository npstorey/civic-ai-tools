// run-evidence-projection-hazards.mjs — the traps, executed rather than asserted.
//
// Each block below turns one hazard from
// civic-ai-tools-planning/receipt-evidence-record-note.md §6 into a runnable
// check, and the last block turns three rows of that section's field table into
// NEGATIVE CONTROLS: it builds the projection the table describes and shows the
// verifier degrade. Those blocks fail if the table's advice ever starts working
// — which would mean the finding is stale and the note can be corrected.
//
// Offline by construction: `fetch` is stubbed to throw and zero calls are
// asserted. No key material is read from disk; both throwaway keys are derived
// from committed labels.
//
// Usage: node scripts/run-evidence-projection-hazards.mjs <fixtures-dir>

import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify as nodeVerify } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import {
  jcs,
  verifySignature,
  verifyEvidence,
  validateRegistry,
  computeEnvelopeHash,
  computeContentHashSha256,
  resolveContentCanonicalization,
  LEGACY_JSON_CANONICALIZATION,
} from '@typedstandards/verify-core';

const fixtures = process.argv[2];
if (!fixtures) {
  console.error('usage: node run-evidence-projection-hazards.mjs <fixtures-dir>');
  process.exit(2);
}

let fetches = 0;
const blockedFetch = (...args) => {
  fetches += 1;
  throw new Error(`NETWORK BLOCKED — hazard harness attempted a fetch: ${String(args[0])}`);
};
globalThis.fetch = blockedFetch;

const RECORD_STEM = '0000-e7d6e3062de1a62a';
const EXT_KEY = 'org.civicaitools.receipt-evidence-projection';
// The documented signing domain, as hex so no NUL byte has to survive a shell
// or an editor: b"receipt/evidence-record/v1\x00".
const DOMAIN_HEX = '726563656970742f65766964656e63652d7265636f72642f763100';
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const recordRaw = readFileSync(join(fixtures, `${RECORD_STEM}.json`));
const bodyRaw = readFileSync(join(fixtures, `${RECORD_STEM}.body.json`));
const producerSig = readFileSync(join(fixtures, `${RECORD_STEM}.producer.sig`));
const emitMeta = JSON.parse(readFileSync(join(fixtures, 'emit-metadata.json'), 'utf8'));
const commitment = JSON.parse(
  readFileSync(join(fixtures, 'evidence-projection-commitment.local.json'), 'utf8'),
);
const pkg = commitment.package;
const ext = pkg.extensions[EXT_KEY];

// ===========================================================================
console.log('--- hazard 2: the trailing newline is INSIDE the digest ---');
// ===========================================================================
// receipt digests and signs canonical_bytes(payload) + b"\n". RFC 8785 JCS
// carries no trailing LF. The "same" JSON therefore has two digests, and only
// the exact bytes settle which one a claim means.
const record = JSON.parse(recordRaw.toString('utf8'));
const jcsBytes = Buffer.from(jcs(record), 'utf8');
const jcsPlusLf = Buffer.concat([jcsBytes, Buffer.from('\n', 'utf8')]);
const digestNoLf = sha256(jcsBytes);
const digestWithLf = sha256(jcsPlusLf);
const digestOnDisk = sha256(recordRaw);

console.log(`   sha256(canonical_bytes(payload))      = ${digestNoLf}   <-- NOT the record's digest`);
console.log(`   sha256(canonical_bytes(payload) + LF) = ${digestWithLf}`);
console.log(`   sha256(the record file on disk)       = ${digestOnDisk}`);
console.log(
  `   JCS bytes ${jcsBytes.length} | record bytes ${recordRaw.length} | delta ${recordRaw.length - jcsBytes.length} byte(s)`,
);

assert.notEqual(digestNoLf, digestWithLf, 'HAZARD 2: the two digests MUST differ');
assert.equal(digestWithLf, digestOnDisk, 'HAZARD 2: the +LF digest is the one on disk');
assert.equal(recordRaw[recordRaw.length - 1], 0x0a, 'the record file ends in LF');
// ...and the NODE carries the latter, not the former.
assert.equal(ext.record_sha256, digestWithLf, 'HAZARD 2: the node carries the +LF digest');
assert.notEqual(ext.record_sha256, digestNoLf, 'HAZARD 2: the node does NOT carry the no-LF digest');
assert.equal(
  ext.record_sha256_without_trailing_lf,
  digestNoLf,
  'HAZARD 2: the node records the trap value too, labelled as the wrong one',
);
assert.equal(ext.record_sha256_covers_trailing_lf, true, 'HAZARD 2: the node says so explicitly');
console.log('   OK — the node carries the +LF digest; the no-LF value is carried only as a labelled trap');

// The same trap applies to the BODY sidecar, which the note's hazard list does
// not mention: body.sha256 is sha256(canonical_bytes(body) + b"\n") too.
const bodyJcs = Buffer.from(jcs(JSON.parse(bodyRaw.toString('utf8'))), 'utf8');
const bodyNoLf = sha256(bodyJcs);
const bodyWithLf = sha256(Buffer.concat([bodyJcs, Buffer.from('\n', 'utf8')]));
console.log(`   body: sha256(canonical)      = ${bodyNoLf}   <-- NOT body.sha256`);
console.log(`   body: sha256(canonical + LF) = ${bodyWithLf}`);
assert.equal(record.body.sha256, bodyWithLf, "the record's own body.sha256 covers the body LF too");
assert.notEqual(record.body.sha256, bodyNoLf, 'the body trap is real');
assert.equal(bodyRaw[bodyRaw.length - 1], 0x0a, 'the body file ends in LF');
console.log("   OK — the body sidecar carries the SAME trailing-LF trap (not in the note's hazard list)");

// ===========================================================================
console.log('--- hazard 1: a signature never crosses ---');
// ===========================================================================
// Four schemes are in play. Two of them are exercised here:
//   receipt evidence record : raw Ed25519 over DOMAIN || bytes
//   Typed Standards node    : Ed25519ph over the UTF-8 bytes of the
//                             envelope-hash HEX STRING (spec §8.3.1)
// Both directions must fail across the boundary, and both must hold within it.
const DOMAIN = Buffer.from(DOMAIN_HEX, 'hex');
assert.equal(emitMeta.domainHex, DOMAIN_HEX, 'DOMAIN matches what the emitter recorded');
assert.equal(
  DOMAIN.subarray(0, DOMAIN.length - 1).toString('ascii'),
  'receipt/evidence-record/v1',
  'DOMAIN is the documented label',
);
assert.equal(DOMAIN[DOMAIN.length - 1], 0x00, 'DOMAIN ends in the NUL separator');

const receiptPubKey = createPublicKey({
  key: Buffer.from(emitMeta.producerPublicKeySpkiBase64, 'base64'),
  format: 'der',
  type: 'spki',
});
const nodePubKeySpki = commitment.signature.publicKey;
const nodePubKey = createPublicKey({
  key: Buffer.from(nodePubKeySpki, 'base64'),
  format: 'der',
  type: 'spki',
});

// (a) receipt's signature is GOOD under receipt's own scheme.
const receiptOk = nodeVerify(null, Buffer.concat([DOMAIN, recordRaw]), receiptPubKey, producerSig);
assert.equal(receiptOk, true, "(a) receipt's signature verifies over DOMAIN || record bytes");
console.log('   (a) receipt sig over DOMAIN||bytes, raw Ed25519 ........... VALID   (as it must be)');

// (b) ...and it is domain-separated: the same signature over the bare bytes fails.
const receiptNoDomain = nodeVerify(null, recordRaw, receiptPubKey, producerSig);
assert.equal(receiptNoDomain, false, '(b) receipt signature must NOT verify without the domain');
console.log('   (b) receipt sig over bare bytes (no domain) ............... INVALID (domain separation)');

// (c) receipt's signature presented as a Typed Standards Ed25519ph signature
//     over this node's packageHash — the crossing the projection must refuse.
const crossed = verifySignature(
  commitment.packageHash,
  producerSig.toString('base64'),
  emitMeta.producerPublicKeySpkiBase64,
  'Ed25519ph',
);
assert.equal(crossed, false, "(c) receipt's signature must NOT verify as a Typed Standards signature");
console.log('   (c) receipt sig as TS Ed25519ph over packageHash .......... INVALID (never crosses)');

// (d) our node's Ed25519ph signature is GOOD under TS rules...
const nodeOk = verifySignature(
  commitment.packageHash,
  commitment.signature.signature,
  nodePubKeySpki,
  'Ed25519ph',
);
assert.equal(nodeOk, true, "(d) the node's signature verifies under spec §8.3.1");
console.log('   (d) node sig as TS Ed25519ph over packageHash ............. VALID   (as it must be)');

// (e) ...and it is NOT a receipt signature: it does not verify as raw Ed25519
//     over DOMAIN || record bytes.
const nodeAsReceipt = nodeVerify(
  null,
  Buffer.concat([DOMAIN, recordRaw]),
  nodePubKey,
  Buffer.from(commitment.signature.signature, 'base64'),
);
assert.equal(nodeAsReceipt, false, "(e) the node's signature must NOT verify as a receipt signature");
console.log('   (e) node sig as receipt raw Ed25519 over DOMAIN||bytes .... INVALID (never crosses)');

// (f) the two keys are different keys, so nothing here is an accident of
//     sharing one keypair between the two schemes.
assert.notEqual(
  emitMeta.producerPublicKeySpkiBase64,
  nodePubKeySpki,
  '(f) the record and the node are signed by DIFFERENT keys',
);
console.log('   (f) record key != node key ............................... CONFIRMED');
console.log('   OK — the projection carries the original bytes and re-signs; neither signature crosses');

// ===========================================================================
console.log('--- §6 field-table negative controls: three rows, built and run ---');
// ===========================================================================
// These build the projection the note's §6 table describes and show the
// verifier degrade. If any of them ever PASSES, the finding is stale.

// (1) Table row: `canonical.py` rule -> contentCanonicalization (URI),
//     "must name receipt's rule, not JCS".
//     Check #3 resolves the URI against a CLOSED local rule registry, so an
//     unrecognized URI degrades #3 and cascades into #4.
const RECEIPT_RULE_URI = 'https://github.com/TheAxiomFoundation/receipt/canonical/v1';
const mislabeled = { ...pkg, contentCanonicalization: RECEIPT_RULE_URI };
const resolution = resolveContentCanonicalization(mislabeled);
console.log(`   (1) contentCanonicalization := "${RECEIPT_RULE_URI}"`);
console.log(`       check #3 -> ${resolution.status}`);
assert.equal(
  resolution.status,
  'unknown_canonicalization_rule',
  "(1) naming receipt's rule in contentCanonicalization degrades check #3",
);
// ...and #4 then cannot recompute. Run the whole verifier to show the cascade.
const registry = validateRegistry(commitment.trustRegistry);
const mislabeledHash = computeEnvelopeHash(mislabeled);
const mislabeledVerdict = await verifyEvidence(
  {
    package: mislabeled,
    packageHash: mislabeledHash,
    signature: commitment.signature,
    rfc3161Timestamp: null,
    rekorEntryId: null,
    lifecycle: null,
  },
  { registry, fetch: blockedFetch },
);
console.log(`       check #4 -> ${mislabeledVerdict.contentHash.status}`);
assert.notEqual(mislabeledVerdict.contentHash.status, 'ok', '(1) check #4 cannot recompute');
console.log("       CONFIRMED — the row's advice degrades #3 and #4; the node names OUR rule instead");
assert.equal(pkg.contentCanonicalization, LEGACY_JSON_CANONICALIZATION, '(1) the node names legacy-json/v1');

// (2) Table row: SHA-256 of the record bytes -> `packageHash` / content digest.
//     packageHash is the envelope hash of OUR OWN package; it is computed, not
//     assigned, so it can never be a foreign artifact's digest.
const recomputedPackageHash = computeEnvelopeHash(pkg);
console.log(`   (2) recomputed packageHash (ours)   = ${recomputedPackageHash}`);
console.log(`       record sha256 (foreign)         = ${ext.record_sha256}`);
assert.equal(recomputedPackageHash, commitment.packageHash, '(2) packageHash recomputes over OUR envelope');
assert.notEqual(recomputedPackageHash, ext.record_sha256, '(2) packageHash is not the record digest');
console.log(
  '       CONFIRMED — packageHash is derived from our envelope; assigning a foreign digest is not expressible',
);

// (3) Table row: record bytes -> "off-log content, fingerprinted by contentHash".
//     Under legacy-json/v1, contentHash is sha256(JCS(package minus contentHash))
//     — a fingerprint of OUR package object, not of foreign bytes carried
//     verbatim. Recompute it and show what it actually names.
const recomputedContentHash = computeContentHashSha256(pkg, LEGACY_JSON_CANONICALIZATION);
console.log(`   (3) recomputed contentHash.sha256   = ${recomputedContentHash}`);
assert.equal(recomputedContentHash, pkg.contentHash.sha256, '(3) contentHash recomputes over OUR package');
assert.notEqual(recomputedContentHash, ext.record_sha256, '(3) contentHash is not the record digest');
// Prove the stronger claim: no choice of carried bytes makes contentHash equal
// the record digest, because contentHash covers the WHOLE package — the
// carried bytes and everything else.
const carriedOnly = sha256(Buffer.from(ext.record_bytes_verbatim, 'utf8'));
assert.equal(carriedOnly, ext.record_sha256, '(3) sha256 of the carried bytes IS the record digest...');
assert.notEqual(carriedOnly, recomputedContentHash, '(3) ...but contentHash is a different value entirely');
console.log('       CONFIRMED — contentHash fingerprints the package object, never the carried foreign bytes');

assert.equal(fetches, 0, 'ZERO network calls attempted');
console.log(`=== network calls attempted: ${fetches} ===`);
console.log('HAZARDS: all traps reproduced; all three §6 table rows degrade as reported');
