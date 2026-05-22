# ADR-0004: `datHere` content profile — A-G envelope, deterministic notebook, cross-host commitment view

- **Status:** Accepted
- **Date:** 2026-05-18 (originally Accepted as the `datHere` captureMethod variant); reframed 2026-05-19 to introduce `datHere` as a `contentProfile` value separate from `captureMethod` (see status note below)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

> **2026-05-19 status note (post-implementation, reframe).** Originally accepted as a fourth `captureMethod` vocabulary value (Phase 1 spec PR #76). Phase 2 implementation smoke testing surfaced a conflation: `captureMethod` (specified by ADR-0003) and the A-G envelope content shape are orthogonal axes. `captureMethod` describes *how the content was captured* — the integrity-of-pipeline property (chat-flow-stream, claude-code-jsonl-readback, claude-code-self-report). A new field `contentProfile` describes *what shape the content is in* — `default` (legacy shape) or `datHere` (A-G envelope, deterministic notebook). A chat-flow-stream capture can have either content profile; the same is true for claude-code-jsonl-readback.
>
> **What this status note changes about the ADR.** Decision §1 reframes `datHere` as the first `contentProfile` vocabulary value, not a fourth `captureMethod` value. `captureMethod` reverts to the three ADR-0003 values. All substantive decisions in §2-§7 (the A-G envelope, the notebook format, the determinism property, the cross-host commitment view, the embed-vs-reference policy, the schema-version stance) stand as accepted; only the field the new vocabulary attaches to changes. The filename `0004-dathere-captureMethod-variant.md` is historical and stays for stability of external references.
>
> **What this status note implies for implementers.** The packager emits `contentProfile === 'datHere'` when the publisher selects the A-G envelope; `captureMethod` continues to reflect *how* the content was captured (chat-flow-stream for the website chat flow, claude-code-jsonl-readback for the Claude Code skill, etc.). The route's additional validation (`promptVisibility === 'full_text'`, non-empty `summary`) gates on `contentProfile`, not `captureMethod`. The bundle endpoint gates on `contentProfile === 'datHere'`. The OES amendment in this PR carries the reframe through §3, §4, and §9.1-§9.3.

## Context

ADR-0003 (2026-04-28; re-Accepted 2026-04-29 with the §1 legacy-default amendment) introduced the `captureMethod` field on the evidence-package schema and established three vocabulary values: `chat-flow-stream`, `claude-code-jsonl-readback`, `claude-code-self-report`. `captureMethod` answers *how was the content captured?* — the integrity-of-pipeline property. The platform signs all values under the same trust-registry keys; the label differentiates structurally distinct capture paths.

The Pittsburgh / WPRDC pilot integration arc (scoped in `civic-ai-tools/docs/proposals/data-concierge-integration.md`, filed as `npstorey/civic-ai-tools#69`) requires a new vocabulary on a *different* axis: not how the content was captured, but what shape the content is in. The pilot's integration partner (an external civic-data publisher running a notebook-based publishing tool) consumes evidence packages as Jupyter notebooks committed to a git host, with package metadata carried in a dedicated namespace inside the notebook's root `metadata` object alongside their existing analysis-metadata namespace. The notebook is the integrity-bearing artifact for the *content*; the *capture* of the content remains whatever pipeline the publisher used (chat-flow-stream when civicaitools.org's chat flow produces it, future captureMethods for other pipelines). The integration partner's existing publish pattern is:

1. A user asks a question against their notebook publishing tool.
2. The tool drafts a notebook, executes it, and renders an answer; the notebook's first markdown cell renders a human-readable metadata table summarizing the analysis.
3. The notebook (containing the rendered answer cells and a short summary cell) is committed to a git host. The notebook's root `metadata` object carries the package envelope (hash, signature, identity binding, capture-method label, attestation links) in a dedicated reverse-DNS namespace, coexisting with the publisher's existing analysis-metadata namespace.
4. The envelope is independently verifiable against the publisher's trust registry — independent of the git host, the rendering tool, and Civic AI Tools' own infrastructure.

For Civic AI Tools to publish into the same trust registry under the same envelope contract, the project's answer pipeline must produce evidence packages whose content shape is consumable by the same cross-host pattern. Two structural properties are load-bearing:

1. **The notebook is the integrity-bearing artifact.** Re-executing the notebook against the documented runtime environment must produce the same rendered answer. The rendered answer is therefore recomputable from the notebook plus the runtime; integrity follows from the notebook, not from the rendered answer alone.
2. **The package's content can be serialized into a publishable artifact** — primarily a single Jupyter notebook with the cryptographic envelope in a dedicated metadata namespace and A-G content in cells (notebook-embedded serialization); alternatively, as a multi-file commit with a sibling YAML file carrying the envelope and separate sibling files for the notebook, rendered answer, and summary — without rehashing or re-signing in either case.

Two open architectural questions in `open-questions.md` were promoted to this issue and resolve here:

- **Q21 — Canonical notebook format for the datHere content profile** (registry anchor's "captureMethod" slug retained for stability after the 2026-05-19 reframe). Direction in place; needed locking against the integration partner's pattern.
- **Q24 — Embed-vs-reference policy for attestations in published artifacts.** Direction in place; needed locking against the cross-host publishing pattern.

The Xanadu doctrine is satisfied. The Pittsburgh / WPRDC pilot is a named adopter for which the legacy content shape (no canonical content profile) does not fit: there is no existing field to label that the package follows the A-G envelope shape with a deterministic-notebook reproducibility property. The pilot's integration cannot proceed without this content profile existing as a first-class concept in the schema.

Three related ADRs are anticipated downstream of this one (ADR-0005 attest/publish lifecycle, ADR-0006 unified primitive, ADR-0007 adversarial-eval requirement model). This ADR scopes only the capture-method variant, the A-G envelope content profile it requires, the notebook-format requirement, and the cross-host commitment-view schema (with two concrete serializations). Visibility modes, typed attestations, adversarial-eval gating, and the unified primitive framing are explicitly out of scope and land in subsequent ADRs.

## Decision

Introduce a new optional field `contentProfile` on the evidence package, define `datHere` as its first vocabulary value, specify the A-G envelope content shape that the `datHere` profile requires, and lock the cross-host publishing schema that consumes the profile.

### 1. New field and vocabulary value

Add an optional `contentProfile` field to the canonical-JSON evidence package, alongside the existing top-level fields. Values are an extensible enum:

- **`default`** — the legacy content shape. Pre-ADR-0004 packages omit the field entirely; rendering surfaces treat absence as `"default"`. No additional normative requirements beyond §4 of the standard.
- **`datHere`** — the A-G envelope content profile. A package with `contentProfile === "datHere"` MUST satisfy §9.1.1 requirements (full-text prompt, system prompt present, environment metadata present, deterministic notebook present, rendered answer present, summary present).

`contentProfile` is orthogonal to `captureMethod`. A package with `contentProfile === "datHere"` can carry any of the three ADR-0003 `captureMethod` values: `chat-flow-stream` when civicaitools.org's chat flow produces it, `claude-code-jsonl-readback` when a future Claude Code skill produces a notebook-shaped package, or any future captureMethod value. The reverse is also true: a `chat-flow-stream` capture can have either `contentProfile === "default"` (legacy chat publishes) or `contentProfile === "datHere"` (A-G envelope chat publishes).

The same platform signing keys cover all combinations. No new key, no new trust-registry entry, no new envelope shape.

### 2. The A-G envelope content profile

`contentProfile: datHere` requires a content shape organized as seven sections (A through G). The profile is a *mapping over existing Open Evidence Standard top-level fields*, not a new container. The package remains the same canonical JSON object whose SHA-256 is the package hash.

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

- **`summary` becomes an optional top-level field on the package.** When present, it is part of canonical JSON and covered by the package hash and signature. Packages produced before this ADR carry no `summary` field and continue to hash/verify as before. `datHere`-content-profile packages MUST carry a non-empty `summary`.
- **`extensions["org.civicaitools.environment"]` is a new reverse-DNS-keyed extension** for the environment metadata that section C requires beyond what `cost.model` and `skillMetadata.mcpServerUrl` already provide. Its shape is documented in the Open Evidence Standard amendment that accompanies this ADR. The reverse-DNS namespace pattern matches the existing `extensions["org.civicaitools.notebook"]` precedent.

The A-G mapping does not change the meaning of any existing OES field. It also does not preclude packages with `contentProfile === "default"` (or absent) from emitting `summary` or `environment` content — both fields are optional for non-datHere content profiles. Packages with absent `contentProfile` (the legacy / default shape) continue to keep `summary` on the DB row only and emit no environment extension, preserving byte-identical canonical JSON.

### 3. Notebook format — Jupyter v1 default; spec admits alternatives

**Resolves Q21 (canonical notebook format for datHere content profile).**

The `datHere` content profile requires that section E's notebook conforms to **Jupyter Notebook Format v4.5+ (nbformat 4)**, expressed as the JSON cell structure with a top-level `cells` array, per the public nbformat specification. Jupyter v1 is the version that the pilot integration partner already consumes and that has the broadest ecosystem support (rendering, diffing, archival, citation tooling).

The standard admits alternative notebook formats — most notably Marimo, which has stronger determinism properties via reactive evaluation and no hidden state — as conforming notebook formats for `datHere`-content-profile packages, provided they:

1. Produce a self-contained executable representation whose execution against the documented runtime is reproducible (no hidden inputs, no cell-order-dependent state that is not re-evaluable);
2. Carry an explicit content-type marker on the `extensions["org.civicaitools.notebook"]` entry indicating which format is in use;
3. Are accompanied by a renderer that produces section F from section E.

The protocol-level property the standard locks is **deterministic reproducibility**, not the choice of notebook engine. A future ADR may promote Marimo (or another format) to a second normative default without superseding this one if a real adopter requires it. Until then, `datHere`-content-profile packages SHOULD default to Jupyter v4.5+.

### 4. The determinism property — best-effort against a documented runtime

A `datHere`-content-profile package's section E (the notebook) is **deterministic against a documented runtime environment plus stable upstream data**. Specifically:

1. The notebook records the runtime requirements (Python version, package versions, MCP server URLs) in its first cell or in a sidecar `requirements` metadata field on the `extensions["org.civicaitools.environment"]` object.
2. Re-execution of the notebook against the documented runtime, with the same MCP server endpoints reachable and the same upstream data unchanged since publication, SHOULD reproduce section F (the rendered answer) byte-for-byte modulo non-deterministic formatting (timestamps in tool-call results, floating-point representations that depend on platform libc, etc.).
3. The determinism property is **best-effort**, not absolute. Civic data is live; an upstream dataset that has been updated since the package was published will produce different tool-call results on re-execution, which will produce a different rendered answer. This is the expected behavior, not a verification failure. Verifiers and surfaces SHOULD render the determinism property as "reproducible against the documented runtime AND the upstream-data state at publish time," not as "the same answer forever."

The signature attests that the notebook in section E has not been altered since publication. It does NOT attest that re-executing it tomorrow produces the same answer as today; the upstream data may have changed. This distinction is structural and follows from the content profile's name and definition; it is the `datHere`-content-profile analog of the chat-flow-stream / JSONL-readback "verbatim-by-construction at *some* layer, with the layer named" property that captureMethod (ADR-0003) carries. captureMethod attests the integrity of capture; contentProfile attests the shape and reproducibility of the captured content.

### 5. The cross-host commitment-view schema (logical + two serializations)

A `datHere`-content-profile package MAY be published cross-host as a Jupyter notebook on a git host, as a multi-file commit with a sibling metadata file, or as future analogous content-addressable surfaces. The published artifact carries the package's *commitment view* — enough fields for any reader to independently verify the package against the publisher's trust registry without fetching the canonical-JSON package object.

The commitment view is specified as a **logical schema** with two **concrete serializations**:

- **Notebook-embedded** (recommended default for `.ipynb` outputs; OES §9.2.2). The commitment view lives in the notebook's root `metadata` object under the reverse-DNS namespace `org.civicaitools.evidence`. This matches the integration partner's existing pattern of carrying analysis metadata in the notebook itself; the evidence namespace coexists with publisher-specific namespaces (`kernelspec`, `language_info`, any publisher conventions) and is preserved by conformant notebook tooling on round-trip. The Jupyter notebook format spec is explicit that root-level metadata under unrecognized keys is preserved by conformant tooling, which makes this serialization durable in practice.
- **Sibling YAML file** (primary path for non-notebook outputs; valid sidecar for notebook outputs; OES §9.2.3). The commitment view lives as a sibling `<artifact-basename>.evidence.yaml` file. Markdown publications MAY ALTERNATIVELY embed the YAML between `---` delimiters at the top of the file (Jekyll / GitHub Pages frontmatter convention).

The field set is the same regardless of serialization (OES §9.2.1 defines the fields once; §9.2.2 and §9.2.3 specify the per-serialization arrangement). Notebook-embedded and sibling-YAML serializations are byte-different but semantically identical for verification. A conformant publisher MAY emit either serialization; a conformant verifier MUST accept either. When a notebook is published with both serializations (notebook-embedded plus sibling YAML), the two MUST carry the same field values for any field they both express.

Notebook publications SHOULD also render a human-readable metadata table in the notebook's first markdown cell as a reader affordance (recommended fields: signer identity + binding tier, package hash truncated, captureMethod, contentProfile, attestation summary count, publishing host + timestamp). Verification does NOT depend on this rendering; the authoritative metadata is the `org.civicaitools.evidence` namespace. Full cell-0 conventions are in OES §9.2.4.

Full field definitions, serialization details, and the cell-0 rendering recommendation live in OES §9.2; this ADR records the architectural decision but does not duplicate the field table.

A reader holding only the published artifact + the publisher's trust registry + FreeTSA + Sigstore Rekor can verify the package's cryptographic envelope — the `civicaitools.org`-dependency property in OES §13 is unchanged by this ADR (offline verifiability is still gated on Q1 resolution), but the cross-host publication pattern *makes the package's content* independent of the originating host as long as the trust registry remains independently reachable.

### 6. Embed-vs-reference policy for attestations in published artifacts

**Resolves Q24 (embed-vs-reference policy for attestations in published artifacts).**

The `attestations` array in the commitment view (regardless of serialization, per §5 above) MAY contain entries in either of two forms:

- **Reference form:** `{ kind, targetHash, attestationHash, attestationUrl }` — a pointer to a separately-published, independently-verifiable attestation. The reader fetches the attestation from `attestationUrl`, confirms its hash matches `attestationHash`, and verifies its signature against the publisher's trust registry. Reference form is the default.
- **Embed form:** the complete signed attestation envelope, inline. The reader verifies the embedded envelope's signature directly without fetching anything. Embed form is an optimization for attestations that are stable and load-bearing for trust evaluation (e.g., the integration partner's admin-approve attestation that establishes the corroboration relationship between the original committed claim and the publication-record).

Both forms preserve independent verifiability: an embedded attestation carries its own signature, so a reader can verify it even if the surrounding commitment view has been altered (the alteration would break the package-hash check anyway, but the embed-vs-reference distinction is orthogonal to the package signature). The default-to-reference choice avoids inflating commitment-view size for large attestation sets while admitting embedding where the size cost is justified by the trust gain.

Implementations SHOULD prefer reference form for routine attestations (corroborations from other authors, contradictions, citations) and SHOULD use embed form only when an attestation is structurally tied to the published claim's trust state (the most common case: an admin-approve attestation gating the publication-record). A reader encountering an embedded attestation MUST verify its signature against the publisher's trust registry just like any other attestation.

### 7. Schema version and backwards compatibility

Three additive changes to the canonical-JSON shape, all of which are backwards-compatible at the verify path:

1. **`contentProfile` field** — a new optional top-level field carrying the values `"default"` or `"datHere"`. Packages produced before this ADR omit the field entirely; verifiers treat absence as `"default"` and apply no additional requirements. Schema version unchanged.
2. **`summary` field** — optional at the top level (OES §4.1). Emitted into canonical JSON only when `contentProfile === "datHere"`; non-datHere packages keep `summary` on the database row only and emit no `summary` field in the package JSON, preserving byte-identical pre-ADR-0004 hashes. When present, `summary` IS covered by the package hash and signature.
3. **`extensions["org.civicaitools.environment"]`** — auto-emitted by the packager when `contentProfile === "datHere"`. Non-datHere packages emit no environment extension.

The schema version stays at `0.1.0`. `captureMethod` (ADR-0003) is unchanged — still three values, still required at the publish route, still covered by the package hash. The `contentProfile` field is orthogonal: a chat-flow-stream capture can have either content profile, and so can a claude-code-jsonl-readback capture.

The `extensions["org.civicaitools.notebook"]` extension was previously described in OES §4.6 as an informative content-format marker emitted by the canonical reference implementation. This ADR promotes its presence to normatively required for `datHere`-content-profile packages. Other content profiles may continue to omit or include it as before — the promotion is `datHere`-scoped, not OES-wide.

## Considered and rejected alternatives

- **New top-level package field carrying A-G as a structured envelope object.** Rejected. The existing OES fields already cover six of the seven sections; adding a parallel structured representation would either duplicate content (forcing verifiers to reconcile two views of the same data) or replace existing fields (breaking every existing package). Mapping A-G over the existing fields with two additive optional fields is the smaller and more reversible change.

- **Different signing key for `datHere`-content-profile packages.** Rejected, for the same reasons ADR-0003 rejected per-capture-method keys: trust-registry complexity grows with no corresponding gain. The platform's trust properties are about captureMethod (ADR-0003), not contentProfile — the platform attests "this content was captured by Civic AI Tools at the wire layer / JSONL layer / answer-pipeline layer and has not been altered since" regardless of content shape. If a future *capture method* has meaningfully different trust properties — for example, a third-party signed self-attestation — a separate key is back on the table. Not for content profiles.

- **Marimo as the v1 default notebook format.** Rejected for the v1 default. Marimo's reactive evaluation property is genuinely better for determinism, and the spec explicitly admits Marimo as a conforming format under §3 above. The v1 default is Jupyter because the pilot integration partner already consumes Jupyter notebooks, the broader ecosystem (rendering tools, diffing tools, archival systems) supports Jupyter, and the protocol-level property the spec locks is *deterministic reproducibility*, not the choice of engine. Promoting Marimo to a second normative default is reserved for a future ADR if a real adopter requires it.

- **Mandate absolute determinism (notebook re-execution always produces F).** Rejected. Civic data is live; tool-call results against an upstream dataset depend on whether that dataset has been updated since publication. Mandating absolute determinism either forces packages to embed all upstream data (inflating package size dramatically and complicating data-licensing edge cases) or makes every `datHere` package un-conformant the moment any tool's underlying dataset is updated. Best-effort determinism against a documented runtime plus a "stable upstream data" caveat is the honest property; the spec says so explicitly.

- **A separate `claimType: datHere-answer` field instead of a `contentProfile` value.** Rejected for this ADR's scope. The unified node primitive framing (which introduces `claimType` as a first-class field on every signed evidence package) is contemplated by a separate ADR (ADR-0006, anticipated). Conflating the content-profile work with the unified primitive work would either delay the variant the pilot needs (the integration partner is the named adopter; the unified primitive is not yet) or force the unified primitive's framing decisions to be made under content-profile-extension pressure. Keeping the two ADRs separate respects each one's resolution criteria and lets the implementation land in pieces. When the unified primitive lands, `contentProfile` and `claimType` may consolidate; that's a future refactor, not a v0.1 design.

- **A fourth `captureMethod` value (`datHere`) instead of a separate `contentProfile` field.** Rejected after Phase 2 smoke testing surfaced the conflation. `captureMethod` and content shape are orthogonal: chat-flow-stream captures can produce either the legacy content shape or the A-G envelope; the same is true for claude-code-jsonl-readback. Folding the A-G envelope's existence into the captureMethod vocabulary forced "Captured via: datHere" labels on chat-flow publishes, which is structurally wrong — the capture method was the wire-layer chat-flow stream; the content shape was the A-G envelope. Splitting the two axes is the architecturally honest choice and avoids cascading conflations as more capture methods or content profiles arrive. The 2026-05-19 status note at the top of this ADR records the reframe; the original capture-method framing landed in PR #76 and PR #103 in Phase 1 + early Phase 2.

- **Lock the spec to a single notebook tool indefinitely.** Rejected. The protocol-level property is determinism, not Jupyter specifically. Allowing alternative formats with explicit conformance requirements (deterministic reproducibility, content-type marker, renderer presence) preserves the protocol's room to grow without re-cutting the spec each time a new notebook engine reaches adoption.

- **Embed all attestations by default in the cross-host commitment view.** Rejected. The commitment view is the lightweight wrapper around content; routinely embedding every attestation would inflate it (notebook-metadata bloat for the embedded serialization, frontmatter bloat for the sibling-YAML serialization) for popular packages with many corroborations, citations, and contradictions. Reference-by-default with selective embed for trust-load-bearing attestations preserves both size discipline and verifiability. Embeds carry their own signatures, so a reader gets the same trust property either way; the trade is fetch-time vs. commitment-view size.

- **Treat the commitment view as proprietary to the integration partner's pattern.** Rejected. The OES spec is the canonical home for cross-host publication patterns; the integration partner is the first conforming consumer, not the schema author. Specifying the commitment view in the OES — with both notebook-embedded and sibling-YAML serializations admitted — means future hosts (other notebook publishers, academic archival systems, third-party verification services) can adopt the same pattern without renegotiating the schema with the integration partner.

## Consequences

- **OES amendment.** The Open Evidence Standard's §3 (definitions) gains a `contentProfile` entry; §4.1 (top-level fields) gains a `contentProfile` row and reframes the `summary` row to reference `contentProfile === "datHere"` (not `captureMethod === "datHere"`); §4.6 (extensions) reframes the `org.civicaitools.environment` extension paragraph as `contentProfile`-gated; §5 hash-coverage paragraph reframes accordingly. §9 (captureMethod) reverts to the three ADR-0003 values (no fourth value). §9.1-§9.3 sub-sections are retained where they are but reframed as the **datHere content profile** — sub-sections of §9 for historical document-layout reasons, but conceptually about the `contentProfile` field. The §9.1.1 normative requirements drop the `metadata.captureMethod === "datHere"` clause and replace it with `metadata.contentProfile === "datHere"`. The amendment ships in the same Phase 1 PR as this ADR.

- **Open-questions registry.** Q21 (canonical notebook format) and Q24 (embed-vs-reference policy) move from `Promoted to issue #69` to the Resolution log with a link to this ADR. The OES sections §9.1-§9.3 are referenced as the resolution locations.

- **Phase 2 implementation surface (scoped, not done here).**
  - `civic-ai-tools-website/src/lib/evidence/packager.ts` — `CaptureMethod` type **unchanged** (reverts to the three ADR-0003 values). `EvidencePackage` interface gains optional `contentProfile?: 'default' | 'datHere'` and optional `summary?: string` fields. `PackageInput` accepts an optional `contentProfile`. The packager auto-emits `summary` into canonical JSON when `contentProfile === "datHere"` and auto-emits `extensions["org.civicaitools.environment"]` under the same condition.
  - `civic-ai-tools-website/src/app/api/evidence/route.ts` — `VALID_CAPTURE_METHODS` **unchanged** (three values). When `body.contentProfile === "datHere"`, the route enforces `promptVisibility === "full_text"` and non-empty `summary`; both return `400` on violation.
  - `GET /api/evidence/:slug/bundle` validates `contentProfile === "datHere"` (not captureMethod) and returns the published artifact in the notebook-embedded serialization (with `org.civicaitools.evidence` namespace as the default for datHere; multi-file bundle with sibling YAML is future work).
  - Evidence detail page (`src/app/evidence/[slug]/page.tsx`) restructures around **A-G as the page structure** when `contentProfile === "datHere"` (the existing `ProvenanceChain` rendering is replaced by A-G sections in this case). Non-datHere-content-profile packages continue to use the existing `ProvenanceChain` rendering. The detail page surfaces a friendly captureMethod label ("Captured via: Web chat" for `chat-flow-stream`) and a separate "datHere content profile · OES §9.1" small label near the top.
  - Drizzle schema: a new `content_profile` column on `evidence_records` (enum: `default` | `datHere`) lands via migration `0009`. The `0008` migration adding `datHere` to the `capture_method` enum stays in history; the `datHere` value on the `capture_method` enum is **unused** going forward (Postgres `ALTER TYPE DROP VALUE` is non-trivial; documenting the value as unused is the lower-disruption path).

- **Bundle export contract.** A `datHere`-content-profile package can be exported in either the notebook-embedded or sibling-YAML serialization via `GET /api/evidence/:slug/bundle`. The published artifact's outer shape is the commitment-view-plus-content described in §5 above (and specified in detail by OES §9.2). The endpoint gates on `contentProfile === "datHere"` and returns `400` for other content profiles.

- **Backwards compatibility.** Existing packages remain verifiable byte-identical. They carry no `contentProfile` field; verifiers treat absence as `"default"`. The `captureMethod` field on existing packages keeps its existing value (one of the three ADR-0003 values; no migration changes existing data). `summary` and the environment extension are absent on legacy packages and continue to be on new non-datHere publishes. The schema version stays at `0.1.0`.

- **API documentation.** `civic-ai-tools-website/docs/api/evidence-publish.md` documents the new `contentProfile` field, the `datHere` value, and the additional route validation that fires when `contentProfile === "datHere"`. The `captureMethod` section reverts to the three ADR-0003 values. The bundle endpoint section gates on `contentProfile`.

- **Build-state coloring.** The `datHere` content profile enters `end-state-vision.md` at the "designed" build state once this ADR is Accepted; it moves to "built" when Phase 2 ships. The vision document is updated in Phase 2 when the implementation lands, matching the project pattern of vision-doc updates following ADRs into code.

- **Sister ADRs.** Four subsequent ADRs are anticipated for the rest of the Pittsburgh integration arc: ADR-0005 (executed-notebook architecture for the `datHere` content profile, extending this ADR's section E framing; accepted 2026-05-21 — see `0005-executed-notebook-architecture.md`), an ADR for the attest/publish lifecycle (from civic#71), an ADR for the unified node primitive framing (anticipated alongside civic#70), and an ADR for the adversarial-eval requirement model (from civic#72). Anticipated numbering for the latter three is deferred to creation order at acceptance time — this paragraph's earlier draft pre-allocated 0005/0006/0007 to the civic#71/#70/#72 ADRs; the executed-notebook ADR took the 0005 slot in creation order, and the others remain anticipated without pre-allocated numbers. Each ADR resolves additional open questions and amends the OES on its own terms. This ADR's decisions are independent of all of them — it stands on its own and does not depend on the others landing. The future unified-primitive ADR may consolidate `contentProfile` with `claimType` if the unified primitive's design absorbs the orthogonal-axes pattern; that's a future refactor.

## References

- [ADR-0003](0003-evidence-capture-method.md) — establishes the `captureMethod` field, the vocabulary-extension pattern, and the tamper-evident labeling principle this ADR extends.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §3 (definitions) gains a `contentProfile` entry; §4.1 (top-level fields) gains a `contentProfile` row and an optional `summary` field; §4.6 (extensions) reframes the `org.civicaitools.environment` extension as `contentProfile`-gated; §9 (captureMethod) reverts to three ADR-0003 values; §9.1-§9.3 sub-sections are reframed as the **datHere content profile** (orthogonal to captureMethod).
- `civic-ai-tools/docs/architecture/open-questions.md` — Q21 and Q24 move to the Resolution log with a link to this ADR.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied; named adopter is the Pittsburgh / WPRDC pilot.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path from registry to ADR followed (Q21 + Q24 were promoted to issue #69 before this ADR drafted).
- `civic-ai-tools/docs/proposals/data-concierge-integration.md` — the integration-arc proposal that surfaced this work and scopes the four-issue cluster (#69-#72) this ADR is the first of.
- `civic-ai-tools-website/src/lib/evidence/packager.ts` — current `CaptureMethod` type and `EvidencePackage` interface; Phase 2 extension surface.
- `civic-ai-tools-website/src/app/api/evidence/route.ts` — current `VALID_CAPTURE_METHODS` enforcement surface; Phase 2 route validation change.
- `civic-ai-tools-website/docs/api/evidence-publish.md` — external-clients API contract; Phase 2 update with the `datHere` value and the A-G profile pointer.
- [Jupyter Notebook Format v4.5+ specification](https://nbformat.readthedocs.io/en/latest/format_description.html) — the v1 default notebook format.
