# Trust and evidence

**Audience.** Government partners, journalists, data editors — any reader who needs to know what an evidence package on civicaitools.org actually claims, and what it does not.
**Status.** Stub. Refined alongside Section 3 of `ROADMAP.md`.

## What "verifiable" means here

An evidence package published on civicaitools.org is a content-addressable, cryptographically signed record of a single civic-data analysis. "Verifiable" has a specific, narrow meaning: with the package alone and a standard verification tool, anyone can confirm that the package has not been altered since publication, that it was signed by a key listed in the published trust registry, that an independent public timestamp authority saw it at the claimed time, and that an independent transparency log (Sigstore Rekor) recorded the signature.

None of those checks require trusting civicaitools.org. If the site goes offline, a reader with a copy of the package can still verify it end-to-end.

## What is being disclosed

Every package carries its audit trail: which AI model ran the analysis, which MCP data sources it queried, every tool call with its arguments and result summary, the skill-guidance text the model was operating under, and a W3C PROV-O graph naming each agent and data source. "Where did this number come from?" is answerable down to the tool call, not just the data source.

## What is not being claimed

An evidence package proves *provenance*, not *correctness*. "Unverified" on a detail page means no attestation has been added yet — not that the AI got the answer wrong. Correctness review is a separate, separately-signed attestation (`consistency`, `evaluation`, or `expert_attestation`) contributed by an identifiable reviewer. The platform itself does not issue correctness claims. See `civic-ai-tools-website/docs/design-principles.md` for the full *disclosure, not validation* stance.

## How to verify a package

- **Signature.** Ed25519 over canonical-JSON, verifiable against the `kid` entry in `https://www.civicaitools.org/.well-known/evidence-public-keys.json`.
- **Timestamp.** RFC 3161 token from FreeTSA, verifiable against FreeTSA's published CA chain.
- **Transparency.** Sigstore Rekor entry, resolvable at `rekor.sigstore.dev`.
- **Content-addressing.** The package SHA-256 is in the URL slug; mismatched content cannot round-trip.

Long-form verification guidance and the 90-day breaking-change notice on this contract live in `civic-ai-tools-website/docs/api/evidence-publish.md`.

## Withdrawal, not deletion

An author can withdraw a package (a signed, public action with a stated reason). Withdrawal does not erase — it appends a signed lifecycle event that renders on the detail page. A permanent record that a civic-data claim was made and later retracted is more honest than silent deletion. Reinstatement works the same way.

## Key rotation

Signing keys rotate per the runbook at `civic-ai-tools-website/docs/key-rotation.md`. Older keys stay in the trust registry indefinitely; packages signed under a retired key remain verifiable.
