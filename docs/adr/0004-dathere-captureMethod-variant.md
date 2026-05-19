# ADR-0004: `datHere` capture-method variant — A-G envelope content profile for cross-host evidence publishing

- **Status:** Accepted
- **Date:** 2026-05-18
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

ADR-0003 (2026-04-28; re-Accepted 2026-04-29 with the §1 legacy-default amendment) introduced the `captureMethod` field on the evidence-package schema and established three vocabulary values: `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`. Its forward-extensibility callout explicitly contemplated future capture methods extending the enum and stated that an enum extension is a vocabulary change, not a key change — the platform continues to sign all capture methods under the same trust-registry keys.

The Pittsburgh / WPRDC pilot integration arc (scoped in `civic-ai-tools/docs/proposals/data-concierge-integration.md`, filed as `npstorey/civic-ai-tools#69`) requires a fourth capture method. The pilot's integration partner (an external civic-data publisher running a notebook-based publishing tool) consumes evidence packages as GitHub-frontmatter-bundled commits. The integration partner's existing publish pattern is:

1. A user asks a question against their notebook publishing tool.
2. The tool drafts a notebook, executes it, and renders an answer.
3. The notebook plus rendered answer plus a short summary are committed to a git host with a frontmatter block carrying the package envelope (hash, signature, identity binding, capture-method label, attestation links).
4. The frontmatter's envelope is independently verifiable against the publisher's trust registry — independent of the git host, the rendering tool, and Civic AI Tools' own infrastructure.

For Civic AI Tools to publish into the same trust registry under the same envelope contract, the project's answer pipeline must produce evidence packages whose content shape is consumable by the same cross-host pattern. Two structural properties are load-bearing:

1. **The notebook is the integrity-bearing artifact.** Re-executing the notebook against the documented runtime environment must produce the same rendered answer. The rendered answer is therefore recomputable from the notebook plus the runtime; integrity follows from the notebook, not from the rendered answer alone.
2. **The package's content can be serialized into a multi-file git commit** — the frontmatter carrying the cryptographic envelope, sibling files carrying the notebook, the rendered answer, and the summary — without rehashing or re-signing.

Two open architectural questions in `open-questions.md` were promoted to this issue and resolve here:

- **Q21 — Canonical notebook format for datHere captureMethod.** Direction in place; needed locking against the integration partner's pattern.
- **Q24 — Embed-vs-reference policy for attestations in published artifacts.** Direction in place; needed locking against the cross-host publishing pattern.

The Xanadu doctrine is satisfied. The Pittsburgh / WPRDC pilot is a named adopter for which the existing captureMethod vocabulary does not fit: none of the three existing values describes content captured by the Civic AI Tools platform itself for cross-host publication as a deterministic-notebook commit. The pilot's integration cannot proceed without this variant existing.

Three related ADRs are anticipated downstream of this one (ADR-0005 attest/publish lifecycle, ADR-0006 unified primitive, ADR-0007 adversarial-eval requirement model). This ADR scopes only the capture-method variant, the A-G envelope content profile it requires, the notebook-format requirement, and the cross-host frontmatter schema. Visibility modes, typed attestations, adversarial-eval gating, and the unified primitive framing are explicitly out of scope and land in subsequent ADRs.

## Decision

Introduce `datHere` as the fourth `captureMethod` vocabulary value, define the content profile (the A-G envelope) it requires, and lock the cross-host publishing schema that consumes the profile.

### 1. New vocabulary value

The `captureMethod` enum is extended with:

- **`datHere`** — the Civic AI Tools platform captured the analysis as a content-addressable bundle consumable as a notebook-plus-rendered-answer commit on a git host. The cryptographic envelope is bound to the package hash; the rendered answer is recomputable from the package's notebook section against the documented runtime.

The other three values (`chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`) remain valid. The same platform signing keys cover all four values. No new key, no new trust-registry entry, no new envelope shape.

### 2. The A-G envelope content profile

`captureMethod: datHere` requires a content profile organized as seven sections (A through G). The profile is a *mapping over existing Open Evidence Standard top-level fields*, not a new container. The package remains the same canonical JSON object whose SHA-256 is the package hash.

| Section | Content | OES field |
|---|---|---|
| A | Initial prompt — the user's question, verbatim | `prompt.text` (with `prompt.visibility == "full_text"`) |
| B | System prompt(s) active for the model | `skillMetadata.skillText` |
| C | Model card + environment metadata: model ID/version, temperature, sampling parameters, MCP server URLs, tool definitions, publishing-host identifier | `cost.model` + `skillMetadata.mcpServerUrl` + `extensions["org.civicaitools.environment"]` (new) |
| D | Deliberative trace: thinking, tool calls, and tool results in order | `trace` (OTel-shaped, or BlobRef) + `queries[]` |
| E | Answer notebook — a notebook that, when executed against the documented runtime, produces F | `extensions["org.civicaitools.notebook"]` (promoted from informative content-format marker to normatively required for `datHere`) |
| F | The rendered answer | `output` (string or BlobRef) |
| G | Short, indexable, citation-ready summary | `summary` (promoted from database-only to canonical-JSON optional field; required for `datHere`) |

Two of these sections are gaps relative to the current canonical JSON shape: section C's environment metadata and section G's summary. Both land as additive, backwards-compatible changes:

- **`summary` becomes an optional top-level field on the package.** When present, it is part of canonical JSON and covered by the package hash and signature. Packages produced before this ADR carry no `summary` field and continue to hash/verify as before. `datHere`-captured packages MUST carry a non-empty `summary`.
- **`extensions["org.civicaitools.environment"]` is a new reverse-DNS-keyed extension** for the environment metadata that section C requires beyond what `cost.model` and `skillMetadata.mcpServerUrl` already provide. Its shape is documented in the Open Evidence Standard amendment that accompanies this ADR. The reverse-DNS namespace pattern matches the existing `extensions["org.civicaitools.notebook"]` precedent.

The A-G mapping does not change the meaning of any existing OES field. It also does not preclude other capture methods from emitting `summary` or `environment` content — both fields are optional for non-`datHere` packages.

### 3. Notebook format — Jupyter v1 default; spec admits alternatives

**Resolves Q21 (canonical notebook format for datHere captureMethod).**

The `datHere` captureMethod requires that section E's notebook conforms to **Jupyter Notebook Format v4.5+ (nbformat 4)**, expressed as the JSON cell structure with a top-level `cells` array, per the public nbformat specification. Jupyter v1 is the version that the pilot integration partner already consumes and that has the broadest ecosystem support (rendering, diffing, archival, citation tooling).

The standard admits alternative notebook formats — most notably Marimo, which has stronger determinism properties via reactive evaluation and no hidden state — as conforming notebook formats for `datHere`-captured packages, provided they:

1. Produce a self-contained executable representation whose execution against the documented runtime is reproducible (no hidden inputs, no cell-order-dependent state that is not re-evaluable);
2. Carry an explicit content-type marker on the `extensions["org.civicaitools.notebook"]` entry indicating which format is in use;
3. Are accompanied by a renderer that produces section F from section E.

The protocol-level property the standard locks is **deterministic reproducibility**, not the choice of notebook engine. A future ADR may promote Marimo (or another format) to a second normative default without superseding this one if a real adopter requires it. Until then, `datHere`-captured packages SHOULD default to Jupyter v4.5+.

### 4. The determinism property — best-effort against a documented runtime

A `datHere`-captured package's section E (the notebook) is **deterministic against a documented runtime environment plus stable upstream data**. Specifically:

1. The notebook records the runtime requirements (Python version, package versions, MCP server URLs) in its first cell or in a sidecar `requirements` metadata field on the `extensions["org.civicaitools.environment"]` object.
2. Re-execution of the notebook against the documented runtime, with the same MCP server endpoints reachable and the same upstream data unchanged since publication, SHOULD reproduce section F (the rendered answer) byte-for-byte modulo non-deterministic formatting (timestamps in tool-call results, floating-point representations that depend on platform libc, etc.).
3. The determinism property is **best-effort**, not absolute. Civic data is live; an upstream dataset that has been updated since the package was published will produce different tool-call results on re-execution, which will produce a different rendered answer. This is the expected behavior, not a verification failure. Verifiers and surfaces SHOULD render the determinism property as "reproducible against the documented runtime AND the upstream-data state at publish time," not as "the same answer forever."

The signature attests that the notebook in section E has not been altered since publication. It does NOT attest that re-executing it tomorrow produces the same answer as today; the upstream data may have changed. This distinction is structural and follows from the capture method's name and definition; it is the `datHere` analog of the chat-flow-stream / JSONL-readback "verbatim-by-construction at *some* layer, with the layer named" property.

### 5. The cross-host frontmatter publication schema

A `datHere`-captured package MAY be published cross-host as a multi-file commit on a git host. The frontmatter at the top of the published commit's primary markdown file carries the package's *commitment view* — enough fields for any reader to independently verify the package against the publisher's trust registry without fetching the canonical-JSON package object.

The frontmatter schema is YAML-shaped and carries the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `evidenceProtocolVersion` | string | yes | The OES schema version this commit was published against (currently `0.1.0`). |
| `packageHash` | string (hex SHA-256) | yes | The SHA-256 hex digest of the canonical-JSON package object. The package's content-addressable identifier. |
| `packageUrl` | string (URL) | yes | The content-addressable URL where the canonical-JSON package is fetchable (Vercel Blob URL in the reference implementation; other hosts MAY serve from their own content-addressable storage). |
| `captureMethod` | string | yes | `datHere` for commits produced under this ADR. Future variants extend the enum. |
| `signature` | object | yes | Object with `signature` (base64), `publicKey` (base64 DER SPKI), `algorithm` (string, e.g. `Ed25519ph`), `kid` (string — key identifier from the publisher's trust registry). Matches the signed-envelope shape in OES §6.1. |
| `signerIdentity` | object | yes | Identity binding for the package's author. Shape mirrors what the OES identity-binding section produces (GitHub-bound today; future identity providers extend the field shape per Q3). |
| `rfc3161Timestamp` | string (base64) | optional | RFC 3161 trusted timestamp token. Present when the publisher's pipeline obtains one. |
| `rekorEntryId` | string | optional | Sigstore Rekor entry identifier. Present when the publisher's pipeline obtains one. |
| `trustRegistryUrl` | string (URL) | yes | The `.well-known/evidence-public-keys.json` URL where the publisher's trust registry is served. Lets a reader resolve the `signature.kid` independently of the publishing host. |
| `attestations` | array | optional | Array of attestation entries, each either a reference (pointer + hash; see §6 below) or an embed (full signed envelope inline). Embedding rules are in §6. |
| `subjectTitle` | string | yes | Human-readable title of the analysis. Matches `evidence_records.title` on the publisher's database row. |
| `subjectSummary` | string | yes | The G-section summary. Matches the canonical-JSON `summary` field. |

The commit body (everything after the frontmatter) is the rendered content of A through G with one section per markdown heading. The notebook section (E) is included as either an inline fenced code block (small notebooks) or as a sibling file in the same commit (large notebooks) with a relative-path reference in the markdown. The rendered answer (F) is similarly inline or a sibling file. Bundle-export endpoints produce the entire multi-file set in one fetch; the implementation contract for the endpoint is scoped in the Phase 2 issue cluster.

A reader holding only the published commit + the publisher's trust registry + FreeTSA + Sigstore Rekor can verify the package's cryptographic envelope — the `civicaitools.org`-dependency property in OES §13 is unchanged by this ADR (offline verifiability is still gated on Q1 resolution), but the cross-host publication pattern *makes the package's content* independent of the originating host as long as the trust registry remains independently reachable.

### 6. Embed-vs-reference policy for attestations in published artifacts

**Resolves Q24 (embed-vs-reference policy for attestations in published artifacts).**

The `attestations` array in the frontmatter MAY contain entries in either of two forms:

- **Reference form:** `{ kind, targetHash, attestationHash, attestationUrl }` — a pointer to a separately-published, independently-verifiable attestation. The reader fetches the attestation from `attestationUrl`, confirms its hash matches `attestationHash`, and verifies its signature against the publisher's trust registry. Reference form is the default.
- **Embed form:** the complete signed attestation envelope, inline. The reader verifies the embedded envelope's signature directly without fetching anything. Embed form is an optimization for attestations that are stable and load-bearing for trust evaluation (e.g., the integration partner's admin-approve attestation that establishes the corroboration relationship between the original committed claim and the publication-record).

Both forms preserve independent verifiability: an embedded attestation carries its own signature, so a reader can verify it even if the surrounding frontmatter has been altered (the alteration would break the package-hash check anyway, but the embed-vs-reference distinction is orthogonal to the package signature). The default-to-reference choice avoids inflating frontmatter size for large attestation sets while admitting embedding where the size cost is justified by the trust gain.

Implementations SHOULD prefer reference form for routine attestations (corroborations from other authors, contradictions, citations) and SHOULD use embed form only when an attestation is structurally tied to the published claim's trust state (the most common case: an admin-approve attestation gating the publication-record). A reader encountering an embedded attestation MUST verify its signature against the publisher's trust registry just like any other attestation.

### 7. Schema version and backwards compatibility

Adding `datHere` to the `captureMethod` enum and adding two optional fields (`summary` at the top level, `extensions["org.civicaitools.environment"]` in the extensions namespace) does not bump the OES schema version. Per ADR-0003, an enum extension is a vocabulary change, not a key change. Adding optional fields preserves backwards compatibility for verifiers: a verifier reading a pre-`datHere` package finds no `summary` and no `org.civicaitools.environment` extension and rejects nothing on that basis; a verifier reading a `datHere` package that lacks either field rejects the package as malformed per the `datHere`-specific requirements above. The schema version stays at `0.1.0`.

The `extensions["org.civicaitools.notebook"]` extension was previously described in OES §4.6 as an informative content-format marker emitted by the canonical reference implementation. This ADR promotes its presence to normatively required for `datHere`-captured packages. Other capture methods may continue to omit or include it as before — the promotion is `datHere`-scoped, not OES-wide.

## Considered and rejected alternatives

- **New top-level package field carrying A-G as a structured envelope object.** Rejected. The existing OES fields already cover six of the seven sections; adding a parallel structured representation would either duplicate content (forcing verifiers to reconcile two views of the same data) or replace existing fields (breaking every existing package). Mapping A-G over the existing fields with two additive optional fields is the smaller and more reversible change.

- **Different signing key for `datHere`-captured packages.** Rejected, for the same reasons ADR-0003 rejected per-capture-method keys: trust-registry complexity grows with no corresponding gain. The `datHere` capture method has the same trust properties as the other values (the platform attests "this content was captured by Civic AI Tools at the wire layer / JSONL layer / answer-pipeline layer and has not been altered since"), just with the layer being different. If a future capture method has meaningfully different trust properties — for example, a third-party signed self-attestation — a separate key is back on the table. Not for this case.

- **Marimo as the v1 default notebook format.** Rejected for the v1 default. Marimo's reactive evaluation property is genuinely better for determinism, and the spec explicitly admits Marimo as a conforming format under §3 above. The v1 default is Jupyter because the pilot integration partner already consumes Jupyter notebooks, the broader ecosystem (rendering tools, diffing tools, archival systems) supports Jupyter, and the protocol-level property the spec locks is *deterministic reproducibility*, not the choice of engine. Promoting Marimo to a second normative default is reserved for a future ADR if a real adopter requires it.

- **Mandate absolute determinism (notebook re-execution always produces F).** Rejected. Civic data is live; tool-call results against an upstream dataset depend on whether that dataset has been updated since publication. Mandating absolute determinism either forces packages to embed all upstream data (inflating package size dramatically and complicating data-licensing edge cases) or makes every `datHere` package un-conformant the moment any tool's underlying dataset is updated. Best-effort determinism against a documented runtime plus a "stable upstream data" caveat is the honest property; the spec says so explicitly.

- **A separate `claimType: datHere-answer` field instead of a captureMethod variant.** Rejected for this ADR's scope. The unified node primitive framing (which introduces `claimType` as a first-class field on every signed evidence package) is contemplated by a separate ADR (ADR-0006, anticipated). Conflating the captureMethod work with the unified primitive work would either delay the captureMethod variant the pilot needs (the integration partner is the named adopter; the unified primitive is not yet) or force the unified primitive's framing decisions to be made under captureMethod-extension pressure. Keeping the two ADRs separate respects each one's resolution criteria and lets the implementation land in pieces.

- **Lock the spec to a single notebook tool indefinitely.** Rejected. The protocol-level property is determinism, not Jupyter specifically. Allowing alternative formats with explicit conformance requirements (deterministic reproducibility, content-type marker, renderer presence) preserves the protocol's room to grow without re-cutting the spec each time a new notebook engine reaches adoption.

- **Embed all attestations by default in the cross-host frontmatter.** Rejected. Frontmatter is the lightweight commitment view; routinely embedding every attestation would inflate it for popular packages with many corroborations, citations, and contradictions. Reference-by-default with selective embed for trust-load-bearing attestations preserves both size discipline and verifiability. Embeds carry their own signatures, so a reader gets the same trust property either way; the trade is fetch-time vs. frontmatter-size.

- **Treat the frontmatter as proprietary to the integration partner's pattern.** Rejected. The OES spec is the canonical home for cross-host publication patterns; the integration partner is the first conforming consumer, not the schema author. Specifying the frontmatter in the OES means future hosts (other notebook publishers, academic archival systems, third-party verification services) can adopt the same pattern without renegotiating the schema with the integration partner.

## Consequences

- **OES amendment.** The Open Evidence Standard's §9 (`captureMethod`) gains the `datHere` value in its vocabulary list, plus three new sub-sections: §9.1 (the A-G content profile and the new `summary` field + `extensions["org.civicaitools.environment"]`), §9.2 (the cross-host GitHub-frontmatter schema), and §9.3 (the embed-vs-reference policy). The amendment ships in the same Phase 1 PR as this ADR.

- **Open-questions registry.** Q21 (canonical notebook format) and Q24 (embed-vs-reference policy) move from `Promoted to issue #69` to the Resolution log with a link to this ADR. The OES sections §9.1-§9.3 are referenced as the resolution locations.

- **Phase 2 implementation surface (scoped, not done here).**
  - `civic-ai-tools-website/src/lib/evidence/packager.ts` — `CaptureMethod` type extended to include `'datHere'`; `EvidencePackage` interface gains optional `summary: string` field; `PackageInput` accepts a new optional `environment` object that the packager writes into `extensions["org.civicaitools.environment"]`.
  - `civic-ai-tools-website/src/app/api/evidence/route.ts` — `VALID_CAPTURE_METHODS` extended; `summary` continues to be read from the request body but now also flows into canonical JSON for `datHere`-captured packages.
  - New endpoint `GET /api/evidence/:slug/bundle` returns the multi-file bundle (frontmatter + notebook + rendered answer + summary) for cross-host publishing. Contract details land with the Phase 2 PR.
  - Evidence detail page (`src/app/evidence/[slug]/page.tsx`) renders the A-G structure with collapse/expand controls when `captureMethod == datHere`. The existing `NOTEBOOK_EXTENSION_KEY = 'org.civicaitools.notebook'` constant carries over unchanged.
  - Drizzle schema: no change required — `evidence_records.captureMethod` is already an open-ended string column constrained at the route layer; adding `'datHere'` is a route-validation change.

- **Bundle export contract.** A `datHere`-captured package can be exported as a Data-Concierge-compatible bundle via `GET /api/evidence/:slug/bundle`. The bundle's outer shape is the frontmatter-plus-content described in §5 above. The endpoint contract is captured in the Phase 2 implementation work in `civic-ai-tools-website`.

- **Backwards compatibility.** Existing packages signed with any of the three prior captureMethod values remain verifiable. Pre-`datHere` packages do not gain a `summary` field or an `org.civicaitools.environment` extension and hash exactly as they did before. The schema version stays at `0.1.0`.

- **API documentation.** `civic-ai-tools-website/docs/api/evidence-publish.md` will need a new entry under the `captureMethod` field documenting the `datHere` value plus a pointer to the OES section that describes the A-G profile. This amendment lands with the Phase 2 PR alongside the route-layer validation change.

- **Build-state coloring.** The `datHere` captureMethod variant enters `end-state-vision.md` at the "designed" build state once this ADR is Accepted; it moves to "built" when Phase 2 ships. The vision document is updated in Phase 2 when the implementation lands, matching the project pattern of vision-doc updates following ADRs into code.

- **Sister ADRs.** Three subsequent ADRs are anticipated for the rest of the Pittsburgh integration arc: ADR-0005 (attest/publish lifecycle, from civic#71), ADR-0006 (unified node primitive framing, anticipated alongside civic#70), and ADR-0007 (adversarial-eval requirement model, from civic#72). Each one resolves additional open questions and amends the OES on its own terms. This ADR's decisions are independent of those — it stands on its own and does not depend on the others landing.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the `captureMethod` field, the vocabulary-extension pattern, and the tamper-evident labeling principle this ADR extends.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §9 (captureMethod) is amended in the same PR; §4.1 gains the optional `summary` field; §4.6 (extensions) gains the `org.civicaitools.environment` reverse-DNS namespace example.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q21 and Q24 move to the Resolution log with a link to this ADR.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied; named adopter is the Pittsburgh / WPRDC pilot.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path from registry to ADR followed (Q21 + Q24 were promoted to issue #69 before this ADR drafted).
- `civic-ai-tools/docs/proposals/data-concierge-integration.md` — the integration-arc proposal that surfaced this work and scopes the four-issue cluster (#69-#72) this ADR is the first of.
- `civic-ai-tools-website/src/lib/evidence/packager.ts` — current `CaptureMethod` type and `EvidencePackage` interface; Phase 2 extension surface.
- `civic-ai-tools-website/src/app/api/evidence/route.ts` — current `VALID_CAPTURE_METHODS` enforcement surface; Phase 2 route validation change.
- `civic-ai-tools-website/docs/api/evidence-publish.md` — external-clients API contract; Phase 2 update with the `datHere` value and the A-G profile pointer.
- [Jupyter Notebook Format v4.5+ specification](https://nbformat.readthedocs.io/en/latest/format_description.html) — the v1 default notebook format.
