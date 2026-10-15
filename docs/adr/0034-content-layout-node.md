# ADR-0034: The `content/layout/v1` node — a page layout published and verified apart from the host that renders it, and the optional `layoutNodeId` on publication

- **Status:** **Accepted** (the signed node: the answer-layout design's ruling D3 = B, 2026-10-14; the optional `layoutNodeId`: the sequencing ruling D4 = A, 2026-10-15; gate G0 of anchor [civic-ai-tools#260](https://github.com/npstorey/civic-ai-tools/issues/260): D1-D3 ruled A and C1-C2 confirmed by the owner, 2026-10-15, among them the payload shape (C1), the vocabulary rule (D2) and the adopter sentence (D3), recorded in the [G0 record](https://github.com/npstorey/civic-ai-tools/issues/260#issuecomment-6202752527))
- **Date:** 2026-10-15
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0009](0009-unified-typed-attestation-primitive.md) (the two-family taxonomy gains a built `content/*` sub-type, §A), [ADR-0010](0010-visibility-lifecycle-location-attestations.md) (the publication attestation gains an optional field, §C)

## Context

A host's page arranges a node's parts: which part comes first, which sit behind a heading, which start open. Today that arrangement lives only in the host's code. A reader of a second host, or a publisher whose records appear on a host it does not operate, cannot see which arrangement a page used, and cannot publish an arrangement of its own in a form anyone can check.

The specification's two-family taxonomy (§7.4) already gives a standalone assertion a place: a `content/*` node, signed by the party that makes it. §7.4 also states the gate for a new sub-type: it arrives by an ADR that names the motivating adopter, per the Xanadu doctrine. This record is that ADR for a layout, and specification v0.1.12 states it (§8.14, §8.10.1, §8.12.1).

## Decision

### A. The sub-type and its payload

`content/layout/v1` is a `content/*` sub-type. A layout node is the structural primitive (`metadata`, `type`, `signer`, `contentCanonicalization`, `contentHash`) plus seven payload fields at the canonical-JSON top level. It carries no `targetNodeId` and no `output`, and it uses `https://typedstandards.org/canonicalization/legacy-json/v1`.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | The layout's name. |
| `version` | integer, at least 1 | yes | The layout's own version. `metadata.schemaVersion` stays `0.1.0`. |
| `appliesTo` | non-empty array of strings | yes | The `metadata.contentProfile` values (§8.1.2) of the nodes the layout is for, such as `"default"` and `"datHere"`. |
| `order` | non-empty array of strings, no entry repeated | yes | The page's parts, in the order the page shows them. |
| `disclosure` | object: `label` (string), `order` (array of strings), `openByDefault` (boolean) | yes | The part that holds a node's detail behind a heading: the heading's text, the order of its sections, and whether it starts open. |
| `steps` | object: `placement` (string), `openByDefault` (boolean) | yes | The part that shows the run's steps: where it sits, and whether it starts open. |
| `rendererVersion` | string | yes | The renderer contract the layout was written for. |

The specification ratifies the shape only. The part names in `order` and `disclosure.order`, the value of `steps.placement`, and `rendererVersion` itself are the renderer's vocabulary, identified by `rendererVersion`. A name a renderer does not know does not make the layout malformed.

### B. A layout changes no node's bytes

A layout carries nothing a node needs, and applying one changes no node's bytes, hash, signature, timestamp or log entry. A record carries no reference to a layout. A page picks the layout it renders a node with by the host's default, then by the reader's choice, never by anything in the record.

### C. The optional `layoutNodeId` on `attestation/publishes/v1`

A publication attestation MAY carry `layoutNodeId`: the `nodeId` of the `content/layout/v1` node the host rendered the target with at release. Absence is absence: a publication attestation without the field asserts nothing about a layout. A verifier that does not know the field ignores it. The field is the host's statement about its own page, inside the host's own signed attestation, so it does not touch the target node (§B).

The alternative, a separate `attestation/renderedWith/v1` sub-type that any host could sign about how it showed a node, is named here so it is not re-derived. It is not minted: the adopter at hand needs only the publisher's own statement, which the existing publication attestation carries.

### D. Who signs a layout

Any party with a `pseudonymous`-or-better binding (§8.5) may sign a layout node, a host's platform key included.

### E. What a verifier does

A verifier resolves the type at §9.2 check #12 and verifies the node's envelope as it does any node's. This revision adds no payload check: the seven fields' presence and types are the builder's and the specification's requirements, not a §9.2 check. A verifier does not render a layout.

### F. The motivating adopter

The motivating adopter is an adopter publishing records on a host it does not operate, who needs the layout its readers see to be publishable and verifiable apart from that host. The adopter is described and not named here, by the maintainer's decision of 2026-10-14; the §7.4 rule is met by the description.

## Considered and rejected

- **A file-backed host setting alone.** It serves one host, and its arrangement cannot be published or checked apart from that host, which is the adopter's need. The setting remains the host's way to hold its built-in layouts; its payload is the node's payload without the envelope, so a host can publish the same bytes as a node later.
- **A layout reference inside the record.** It would change the record's bytes for a presentation choice, and a node signed before the layout existed could never name one.
- **Ratifying one renderer's part names as the v1 vocabulary.** It would put one application's user interface in the standard and bind every host to its names, the growth the Xanadu doctrine gates.
- **A payload check in the verifier** (a status such as `layout_malformed`). Nothing in a layout bears on the integrity of any record, and the planned layout builder is to refuse a malformed payload before it is signed.
- **Placing the section inside §8.12, or before §8.13.** §8.12 is the attestation namespace, and an insertion before §8.13 would renumber it. The new section is §8.14.

## Consequences

- **Two core releases are to implement it**, planned as `@typedstandards/verify-core` 0.14.0 (to register `content/layout/v1`, so check #12 reads `ok` for it instead of `unknown_type`) and `@typedstandards/produce-core` 0.9.0 (to build a layout node, and to emit `layoutNodeId` on a publication attestation when the caller supplies it, appended after `releasedAt`). A publication attestation built without the field is to stay byte-identical to one built by produce-core 0.8.0, and every already-signed package is unchanged.
- **The reference app reads layouts later.** Reading a layout from its own configuration or from a published node, the reader's choice between layouts, and passing `layoutNodeId` from its publish route are a later change in that repository.
- **The reference app's default layout is the first published node of this type**, signed with its platform key, from the same bytes as its built-in default. The specification's §8.14 example is that layout.

## References

- [civic-ai-tools#260](https://github.com/npstorey/civic-ai-tools/issues/260): the anchor, and its [G0 record](https://github.com/npstorey/civic-ai-tools/issues/260#issuecomment-6202752527).
- [ADR-0009](0009-unified-typed-attestation-primitive.md): the two-family taxonomy. [ADR-0010](0010-visibility-lifecycle-location-attestations.md): lifecycle and publication as attestations.
- Specification §7.4 (the taxonomy and the rule for a new sub-type), §8.10.1 and §8.12.1 (`attestation/publishes/v1`), §8.14 (this sub-type), §9.2 check #12.
- [`xanadu-doctrine.md`](../architecture/xanadu-doctrine.md): the growth discipline.
