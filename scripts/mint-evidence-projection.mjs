// mint-evidence-projection.mjs — project ONE emitted `receipt` evidence record
// into ONE Typed Standards node, sign it locally, and write the three fixtures
// scripts/verify-evidence-projection.sh verifies offline.
//
// BUILD ONLY. Nothing here publishes: no Rekor entry, no RFC 3161 token, no
// trust-registry key, no network of any kind. buildRekorProposal() and
// buildTimestampRequest() are NOT called — they only build request bodies a
// caller would have to submit, and no request is submitted from this branch.
//
// THE SUBJECT RULE (carried over from poc/rulespec-interop, non-negotiable):
// the foreign artifact's digest enters our signed bytes as an OBSERVATION,
// never as a co-signed claim. Concretely, in the node this writes:
//
//   * `packageHash`, `contentHash` and `nodeId` are OURS — computed over our
//     own envelope, exactly as they would be for any other node. None of them
//     is, or could be, the receipt record's digest.
//   * the record's digest, its bytes, its producer signature and its signing
//     domain all live under one reverse-DNS extension key, labelled
//     `co_signed: false`. Signing this node asserts "we observed these bytes
//     and this is their digest" — it does not re-assert receipt's claim, and
//     it does not extend our key's authority over receipt's producer key.
//   * receipt's producer signature is carried VERBATIM as an observation. It
//     stays checkable only against the original bytes under receipt's own
//     scheme (raw Ed25519 over DOMAIN||bytes) — see the harness's leg E.
//
// Determinism: every input is a constant (packageId, createdAt, both key
// seeds), so re-minting is byte-reproducible and the committed fixtures can be
// regenerated and diffed. produce-core is I/O-free and takes no clock and no
// RNG, so nothing else varies.
//
// Usage: node scripts/mint-evidence-projection.mjs <fixtures-dir>

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  buildEnvelope,
  signEnvelopeHash,
  buildCommitmentView,
  LEGACY_JSON_CANONICALIZATION,
} from '@typedstandards/produce-core';

const fixtures = process.argv[2];
if (!fixtures) {
  console.error('usage: node scripts/mint-evidence-projection.mjs <fixtures-dir>');
  process.exit(2);
}

// --- fail loudly if anything reaches for the network ------------------------
globalThis.fetch = () => {
  throw new Error('NETWORK BLOCKED — the minter is offline by construction');
};

const RECORD_STEM = '0000-e7d6e3062de1a62a';
const EXT_KEY = 'org.civicaitools.receipt-evidence-projection';

// Deterministic identity constants (produce-core supplies no clock and no RNG
// — these are the caller's job, and here they are fixed so the mint is
// reproducible byte-for-byte).
const PACKAGE_ID = 'e2f4a9c1-6b3d-4f80-9a52-7c1de8b40f36';
const CREATED_AT = '2026-08-26T00:00:00.000Z';
const KID = 'local:evidence-projection-poc-2026-08';
const SIGNER = {
  bindingTier: 'local',
  identifier: 'local:evidence-projection-poc',
  displayName: 'Evidence Projection POC (local throwaway signer)',
};

// The NODE's signing key — deliberately a DIFFERENT key from the one that
// signed the receipt record. Two schemes, two keys, no crossing (note hazard
// 1). Derived from a label so no private key material is committed.
const NODE_KEY_SEED_LABEL = 'civic-ai-tools/evidence-projection-v1/ts-node-throwaway';
const nodeSeed = createHash('sha256').update(NODE_KEY_SEED_LABEL, 'utf8').digest();

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// --- read the EMITTED artifacts, as bytes -----------------------------------
const recordRaw = readFileSync(join(fixtures, `${RECORD_STEM}.json`));
const bodyRaw = readFileSync(join(fixtures, `${RECORD_STEM}.body.json`));
const producerSig = readFileSync(join(fixtures, `${RECORD_STEM}.producer.sig`));
const emitMeta = JSON.parse(readFileSync(join(fixtures, 'emit-metadata.json'), 'utf8'));

const recordText = recordRaw.toString('utf8');
const bodyText = bodyRaw.toString('utf8');
// Carrying bytes as a JSON string is only lossless if the round trip is exact.
// Assert it here rather than discovering it in a verifier.
if (!Buffer.from(recordText, 'utf8').equals(recordRaw)) {
  throw new Error('record bytes do not round-trip through a UTF-8 JS string');
}
if (!Buffer.from(bodyText, 'utf8').equals(bodyRaw)) {
  throw new Error('body bytes do not round-trip through a UTF-8 JS string');
}

const recordSha256 = sha256(recordRaw);
const bodySha256 = sha256(bodyRaw);
const record = JSON.parse(recordText);

// The note's hazard 2, computed rather than asserted: the SAME JSON under RFC
// 8785 JCS with no trailing LF has a different digest. Both values go into the
// signed bytes so a reader can see which one the record's digest actually is.
const jcsNoLf = JSON.stringify(record) === recordText.slice(0, -1)
  ? recordText.slice(0, -1)
  : null;
if (jcsNoLf === null) {
  // Not fatal to the projection, but the harness's hazard leg computes this
  // independently — record that the two disagreed here.
  console.error('note: JSON.stringify(record) !== record bytes minus LF (key order differs)');
}
const recordSha256WithoutTrailingLf = sha256(recordRaw.subarray(0, recordRaw.length - 1));

const extension = {
  role: 'receipt-evidence-record-projection',
  projection_direction:
    'one-way: receipt -> Typed Standards. Nothing in this node is asserted back to receipt, and receipt neither defines nor blesses this projection.',

  // --- where the record came from ------------------------------------------
  source_repo: 'npstorey/receipt',
  source_branch: 'evidence-record-v1',
  source_commit: '9108403189bd211e5d98536afa5a6350426daab3',
  source_emitter: 'receipt.evidence.emit_evidence_record',
  source_emitter_note:
    'The record was produced by the emitter, not hand-written: receipt computed the index, the digests, the canonical bytes, the filename and the signature.',
  record_filename: `${RECORD_STEM}.json`,

  // --- the record, carried VERBATIM ----------------------------------------
  // The bytes themselves, not a re-serialization. A projection that re-encodes
  // from parsed JSON loses the digest (note hazard 3, and hazard 2 below).
  record_bytes_verbatim: recordText,
  record_byte_length: recordRaw.length,
  record_canonicalization:
    'receipt.canonical.canonical_bytes(payload) + b"\\n" (canonical JSON plus exactly one trailing LF)',
  record_canonicalization_is_jcs: false,
  record_canonicalization_note:
    'Measured on THIS record, receipt canonical_bytes is byte-identical to RFC 8785 JCS; the trailing LF is the entire difference. That equivalence is not guaranteed in general and is not relied on here — the bytes are carried verbatim.',

  // --- the digests, as OBSERVATIONS ----------------------------------------
  record_sha256: recordSha256,
  record_sha256_covers_trailing_lf: true,
  record_sha256_without_trailing_lf: recordSha256WithoutTrailingLf,
  record_sha256_trap_note:
    'record_sha256_without_trailing_lf is the WRONG digest for this record — it is recorded only so a reader can see that the two differ and which one receipt means.',
  record_index: record.recordIndex,
  record_previous_sha256: record.previousRecordSha256,
  record_schema_version: record.schemaVersion,
  record_standing: record.standing,
  record_standing_note:
    'receipt/evidence-record/v1 is NON-AUTHORIZING by construction. Typed Standards has no standing field and no non-authorizing framing to project it into, so the literal is carried here, inside our signed bytes, as an observation.',

  // --- the body sidecar, carried VERBATIM ----------------------------------
  body_schema: record.body.schema,
  body_sha256_claimed_by_record: record.body.sha256,
  body_sha256_recomputed: bodySha256,
  body_bytes_verbatim: bodyText,
  body_byte_length: bodyRaw.length,
  body_sha256_covers_trailing_lf: true,
  body_note:
    'The body sidecar carries a trailing LF too — body.sha256 is sha256(canonical_bytes(body) + b"\\n"). A projector that recomputes it from parsed JSON without the LF gets a mismatch.',

  // --- receipt's producer signature: OBSERVED, NOT CO-SIGNED ---------------
  co_signed: false,
  producer_signature_base64: producerSig.toString('base64'),
  producer_signature_byte_length: producerSig.length,
  producer_signature_scheme:
    'raw Ed25519 (NOT Ed25519ph) over DOMAIN || record_bytes, where DOMAIN = b"receipt/evidence-record/v1\\x00"',
  producer_signature_domain_hex: emitMeta.domainHex,
  producer_public_key_spki_base64: emitMeta.producerPublicKeySpkiBase64,
  producer_claimed: record.producer,
  producer_claim_note:
    "receipt's producer block is a claim by the emitting repo about itself. It is NOT projected into this node's `signer` field: `signer` is the subject of verify-core check #14, cross-checked against the trust-registry entry for THIS node's kid, so putting a foreign producer there would assert that the foreign producer holds our signing key.",
  signature_crossing_note:
    "This node re-signs under its own scheme (Ed25519ph over the UTF-8 bytes of the envelope-hash hex string, spec §8.3.1) with a DIFFERENT key. receipt's signature above stays checkable only against the original record bytes under receipt's own scheme. Neither signature verifies under the other's rules — that is what makes the projection one-way.",

  // --- claimed time is not evidence (note hazard 5) ------------------------
  emitted_at_utc_claimed: record.emittedAtUtc,
  emitted_at_utc_witnessed: false,
  emitted_at_utc_note:
    'receipt parses emittedAtUtc for well-formedness and uses it in no refusal — v1 has no witness for it. It is carried here as a producer claim and is NOT projected into any field a reader would take as witnessed time.',

  // --- what this node does NOT carry ---------------------------------------
  rfc3161_timestamp: null,
  rfc3161_note:
    "No RFC 3161 token exists for this record: receipt/evidence-record/v1 deliberately REFUSES a .tsr sidecar, so there is nothing to re-encode. Separately, verify-core check #7 binds a token's messageImprint to THIS node's packageHash, so a receipt token attesting a receipt digest could not satisfy it even if one existed.",
  rekor_entry_id: null,
  rekor_note:
    'No transparency-log entry. buildRekorProposal() was not called; it only builds a request body a caller would submit, and nothing is submitted from this branch.',
  published: false,
  refs_exercised: false,
  refs_note:
    'The emitted record carries refs: [] — this projection sits beside no release chain, so the refs projection is not exercised here.',
};

// --- build the node ---------------------------------------------------------
const prompt =
  'Project one emitted receipt/evidence-record/v1 record into a Typed Standards content node, one-way, carrying the record bytes verbatim and its digest as an observation; sign the node locally under Ed25519ph and verify it offline with verify-core. Nothing is published.';

const output = [
  `Projected receipt evidence record ${RECORD_STEM}.json (${recordRaw.length} bytes, sha256 ${recordSha256}) into one Typed Standards content/analysis/v1 node.`,
  '',
  `The record was emitted by receipt.evidence.emit_evidence_record on branch evidence-record-v1 at commit ${extension.source_commit}; the receipt suite runs 370 passed at that commit. The record's bytes are canonical JSON plus exactly one trailing LF, and its digest covers that LF: sha256 of the 376 bytes is ${recordSha256}, while sha256 of the same JSON without the trailing LF is ${recordSha256WithoutTrailingLf}. Those two values are the whole of the note's hazard 2, measured.`,
  '',
  `The record's digest, its bytes, its body sidecar, its producer signature and its signing domain are carried under the extension key ${EXT_KEY} as OBSERVATIONS, marked co_signed: false. This node's own packageHash, contentHash and nodeId are computed over this node's own envelope and are unrelated to the record's digest — the foreign artifact's digest never becomes this node's identity.`,
  '',
  "The node is signed with a local throwaway key that is deliberately absent from the trust registry, and it carries no RFC 3161 token and no Rekor entry. Its verdict is therefore honestly not green: key trust is unknown_key, signer identity degrades to no_registry_identity, and checks #7 and #8 are unverified. Full-depth third-party verification would require a production publish, which has not happened and is out of scope for this branch.",
].join('\n');

const summary =
  'A record emitted by one system was carried, byte for byte, into a second system’s signed envelope, so that a reader can check the first system’s fingerprint without either system trusting the other. The original signature is carried alongside as an observation and is not re-asserted: the two systems sign different things in different ways, so the carry only ever runs one way. This node is signed with a throwaway key and is not published, so it proves the shape of the carry and nothing about the publisher.';

const { pkg, envelopeHash } = buildEnvelope({
  packageId: PACKAGE_ID,
  createdAt: CREATED_AT,
  signingKeyId: KID,
  prompt,
  promptVisibility: 'full_text',
  queries: [],
  dataSources: [],
  cost: { model: 'anthropic/claude-opus-5' },
  skillMetadata: {},
  output,
  trace: { resourceSpans: [] },
  summary,
  captureMethod: 'claude-code-jsonl-readback',
  type: 'content/analysis/v1',
  signer: SIGNER,
  contentCanonicalization: LEGACY_JSON_CANONICALIZATION,
  extensions: { [EXT_KEY]: extension },
});

const signature = signEnvelopeHash(envelopeHash, new Uint8Array(nodeSeed), KID);

const trustRegistry = JSON.parse(
  readFileSync(join(fixtures, 'evidence-projection-trust-registry.json'), 'utf8'),
);

const commitment = {
  ...buildCommitmentView({
    packageHash: envelopeHash,
    visibility: 'committed',
    captureMethod: pkg.metadata.captureMethod,
    contentProfile: null,
    type: pkg.type,
    signer: pkg.signer,
    contentHash: pkg.contentHash,
    contentCanonicalization: pkg.contentCanonicalization,
    signature: { ...signature },
    trustRegistryUrl: 'https://civicaitools.org/.well-known/typed-publisher.json',
    trustRegistryUrlLegacy:
      'https://civicaitools.org/.well-known/evidence-public-keys.json',
    subjectTitle:
      'Evidence-projection POC: one receipt/evidence-record/v1 record projected into a Typed Standards node',
    subjectSummary: summary,
  }),
  // The §8.8.1 self-contained (`?inline=1`) serialization: the same commitment
  // view plus the package and the trust-registry snapshot inline, so the whole
  // bundle verifies with zero network access (§9.4).
  package: pkg,
  trustRegistry,
};

const payload = {
  $comment:
    'The projection INPUT — the extension block and the envelope-shaping fields the minter fed to buildEnvelope. Committed so the extension can be diffed against the copy inside the signed package.',
  prompt,
  output,
  summary,
  type: 'content/analysis/v1',
  captureMethod: 'claude-code-jsonl-readback',
  promptVisibility: 'full_text',
  visibility: 'committed',
  signer: SIGNER,
  contentCanonicalization: LEGACY_JSON_CANONICALIZATION,
  extensions: { [EXT_KEY]: extension },
};

const write = (name, obj) =>
  writeFileSync(join(fixtures, name), JSON.stringify(obj, null, 2) + '\n', 'utf8');

write('evidence-projection-payload.json', payload);
write('evidence-projection-package.local.json', pkg);
write('evidence-projection-commitment.local.json', commitment);

console.log(`node id (packageHash): ${envelopeHash}`);
console.log(`contentHash.sha256   : ${pkg.contentHash.sha256}`);
console.log(`record sha256        : ${recordSha256}`);
console.log(`kid                  : ${KID}`);
console.log(`public key (SPKI b64): ${signature.publicKey}`);
