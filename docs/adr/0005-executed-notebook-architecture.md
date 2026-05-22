# ADR-0005: Executed-notebook architecture for the `datHere` content profile

- **Status:** Proposed
- **Date:** 2026-05-21
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR-0004](0004-dathere-captureMethod-variant.md) introduced the `datHere` content profile and specified the A-G envelope (§9.1 of the Open Evidence Standard). Within that envelope, section E is "an answer notebook — a notebook that, when executed against the documented runtime, produces F" (the rendered answer). ADR-0004 §4 articulates the determinism property: re-execution against the documented runtime + stable upstream data SHOULD reproduce section F. The standard does not specify *how* the publisher produces section E — only the property it must satisfy.

The Phase 2 implementation of [civic-ai-tools#69](https://github.com/npstorey/civic-ai-tools/issues/69) (PR [#103](https://github.com/npstorey/civic-ai-tools-website/pull/103) on the `civic-ai-tools-website`) produces section E as a **skeleton notebook**: ~6 cells that wrap the chat-flow answer in notebook structure (cell-0 onboarding + cell-1 environment + cell-2 imports + cell-3 data fetch + cell-4 hardcoded markdown answer + cell-5 citations). The skeleton notebook satisfies §9.1.1 syntactically: the notebook is present, it conforms to Jupyter v4.5+, and it can be re-executed. But the determinism property is illusory — the cell-4 "answer" is hardcoded markdown authored by the LLM in chat, not derived from the cell-3 data fetch output. Re-executing the notebook re-fetches data but does not re-derive the answer. The notebook structure makes a reproducibility claim that the content does not deliver.

A side-by-side comparison against a Data Concierge verified notebook (datHere's existing notebook publishing tool — see `https://github.com/dathere/data-concierge-notebooks/blob/main/verified/compare-the-predicited-air-quality-inversions-to-the-observe_6c754758.ipynb` for a representative example) made the gap concrete. Data Concierge notebooks have ~31 cells with a transparent step-by-step analysis trail: each tool call is a (markdown explainer + code cell + output) triplet, the final cell synthesizes findings by referencing the dataframes and values *computed above*, and the notebook is genuinely executed end-to-end in the publisher's pipeline before being committed to a git host as the integrity-bearing content artifact. The integration partner's pattern is the reference pattern for "section E delivers on the determinism property"; the Civic AI Tools v0 skeleton is not.

The architectural conversation that followed established that the proper way to deliver the determinism property is to **actually generate AND execute the notebook as part of the answer flow**, capturing the executed notebook (cells + outputs) as the content artifact. This ADR records that decision.

The decision is gated on **Vercel Sandbox** as the execution substrate. A 2026-05-21 validation against the canonical Vercel Sandbox docs (system-specifications, pricing, firewall, snapshots pages — last_updated 2026-01-30 through 2026-03-14) confirmed the platform is fit-for-purpose: `python3.13` is a first-class runtime image with `pip` and `uv`; default egress is `allow-all` (civic-data HTTPS endpoints reachable without an allowlist process); the Pro plan supports 2,000 concurrent sandboxes, 5-hour max duration, 200 vCPU/minute allocation; per-execution cost at typical sizing (2 vCPU, 4 GB, ~30s active CPU, ~50 MB inbound) is approximately $0.012; sandbox snapshots reduce cold start from 10-30s (with pip install) to sub-second; OIDC authentication is automatic on Vercel deployments. None of these capabilities required Vercel support consultation pre-decision; all are validated against published documentation. The full validation record lives in `executed-notebook-architecture-project-plan.md` §10 Q2 (workspace root).

A separable concern: the v0 skeleton notebook path remains valid as the output for standard-mode publishes that pick the `datHere` content profile. ADR-0004 §1 states `contentProfile` and `captureMethod` are orthogonal axes. This ADR adds a third orthogonal axis — *how the notebook was authored* — without modifying either of those. Skeleton and executed notebooks coexist; users select via a toggle (per `executed-notebook-architecture-project-plan.md` §4); hosts choose their own UX defaults.

Four anticipated downstream ADRs are in flight at related Pittsburgh-arc work: the attest/publish lifecycle ADR ([civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71)), the unified node primitive ADR (anticipated alongside [civic-ai-tools#70](https://github.com/npstorey/civic-ai-tools/issues/70)), and the adversarial-eval requirement model ADR ([civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72)). ADR-0005 scopes only the executed-notebook architecture for `contentProfile === "datHere"`; the other ADRs remain anticipated and will land in their own time. ADR-0004's References section anticipated those subsequent ADRs as 0005/0006/0007; this ADR takes the 0005 slot in creation order and the anticipated cluster's numbering is touched up in ADR-0004 (see also References below).

The Xanadu doctrine is satisfied. The Pittsburgh / WPRDC pilot is a named adopter for whom the determinism property is load-bearing — datHere's own notebooks deliver it via executed notebooks, and the integration contract that the pilot is built around presupposes the same property on Civic AI Tools' output. The v0 skeleton does not deliver the property; the executed-notebook architecture does. Promoting this work above "designed" is justified by the pilot's existing need.

## Decision

For the `datHere` content profile, the publisher MAY generate AND execute the notebook in section E (rather than producing a skeleton wrapping a chat-flow answer); when the publisher does so, the executed notebook (with output cells embedded) becomes the integrity-bearing artifact for section F (the rendered answer). The skeleton-notebook path remains valid; the two paths are distinguished by a new sub-field of the existing notebook extension and may coexist indefinitely.

### 1. Generate-and-execute path for section E

The publisher's pipeline produces section E in four phases:

- **Phase A — Discovery.** The LLM iterates via MCP tools (Socrata, Data Commons, OpenContext) to discover relevant datasets, validate column names, and prototype queries. Tool calls are captured in the trace per OES §7. This phase is identical to the standard chat-flow analysis.
- **Phase B — Synthesis.** The LLM authors a complete Jupyter v4.5+ notebook conforming to a structured template: cell-0 (branding + query + metadata + onboarding), cell-1 (environment setup — Python version detect + pinned-version pip installs), cell-2 (imports), cell-3 (helper-function definitions embedded inline; see §3 below), cell-4 ("Data Analysis Pipeline" section header), cells 5..N (alternating markdown step explainer + code cell, one pair per discovery step from Phase A), penultimate cell (results synthesis — markdown narrative referencing the dataframes/values computed above by name), final cell (citations + reproducibility guide + generation metadata). The cell structure matches the Data Concierge verified-notebook pattern.
- **Phase C — Sandbox execution.** The notebook is submitted to Vercel Sandbox (`python3.13` runtime) for execution. The sandbox boots from a pre-built snapshot containing the pinned scientific stack (`pandas`, `requests`, `numpy`, `matplotlib`) so cold start is sub-second. Execution is bounded by a timeout of 90-120s; on success, the sandbox returns the executed notebook with output cells (DataFrames, tables, charts, text) embedded. On execution failure, the pipeline retries once with the failure included in the LLM's context for self-correction; second failure surfaces a non-evidence error inviting the user to switch to standard-mode. Execution failures are NOT published as evidence packages (see [Q29](../architecture/open-questions.md#q29--execution-failure-semantics-for-the-executed-notebook-path)).
- **Phase D — Stamp execution metadata + comparison cell.** The backend reads the prominent numeric/dataframe outputs from the executed notebook and appends a comparison cell embedding original values as Python literals (see §5 below). It then stamps `extensions["org.civicaitools.execution"]` with `executedAt`, `environment` (runtime versions actually used), `executionDuration_ms`, and an opaque `sandboxId`. The completed notebook is the section-E artifact; its prominent outputs (typically the synthesis cell's rendered markdown) become section F.

The same backend pipeline supports two trigger surfaces per §6 below; both produce equivalent packages.

### 2. Notebook-provenance discriminator and execution metadata

Two protocol-level additions, both auto-emitted by the conformant packager when the executed path is taken:

- **`extensions["org.civicaitools.notebook"].provenance`** — a new sub-field on the existing notebook extension. Values: `"skeleton"` (the notebook structure wraps an answer authored elsewhere; data fetch reproducible, answer synthesis not) or `"executed"` (the notebook was executed by the publisher's pipeline, outputs in cells are computed, section F is derived from cell outputs). Pre-ADR-0005 `datHere`-profile packages omit the field; verifiers SHOULD treat absence as `"skeleton"` (the v0 default). Detail-page surfaces render labels framing the reproducibility property the package actually delivers, not internal versioning jargon (see Consequences below).

- **`extensions["org.civicaitools.execution"]`** — a new reverse-DNS-keyed extension, required when `provenance === "executed"`, that records the execution telemetry needed for verifiers to reason about the determinism property. Required fields: `executedAt` (ISO-8601 UTC), `environment` (object with at minimum `python` version and `libraries` map of pinned versions), `executionDuration_ms` (integer). Optional fields: `sandboxId` (opaque string identifying the execution substrate run; informational, not part of the trust property), `comparisonCellPresent` (boolean; defaults to `true` for new executions, `false` for executions that opt out). The shape parallels the existing `extensions["org.civicaitools.environment"]` (introduced in ADR-0004) — environment describes the runtime the package was authored under; execution describes the runtime an execution actually ran in. They coexist; a single package carries both when `provenance === "executed"`.

Both fields land in the canonical JSON, are covered by the package hash, and are signed under the existing trust-registry keys. The OES amendment that accompanies this ADR specifies the exact shapes (see References).

### 3. Helper functions embedded inline in section E

Helper functions for civic-data sources (Socrata, Data Commons, OpenContext) MUST be embedded inline in section E (cell-3 in the structured template). The publisher's source-of-truth for the helper functions lives at `civic-ai-tools-website/src/lib/notebook-author/helpers/` as Python source files; the LLM prompt template selects the relevant helpers per notebook (based on which data sources Phase A's discovery used) and embeds them as cell-3 source in every generated notebook. The sandbox does NOT require the helpers to be pre-installed — the executing notebook is self-contained.

The "embedded inline" choice is normative for the executed path. Rejected alternatives:

- **Helpers pre-installed in the sandbox snapshot (e.g., `pip install civic_data_helpers`).** This would break notebook self-containment. A re-executor on their own Jupyter env would need to know what `civic_data_helpers` is and install a matching version; verification is harder; the determinism property weakens (different installed versions could produce different outputs).
- **Helpers loaded from a remote URL at notebook start (e.g., `!curl https://.../helpers.py`).** This introduces a third-party URL dependency in the re-execution path. If `civicaitools.org` goes down or the helper version changes, historical evidence packages cease being re-executable. Verification is harder (verifier must trust the remote source matches what was used originally).

Inline-embedded helpers match the Data Concierge verified-notebook pattern (their notebooks also carry helper functions inline) and maximize re-execution determinism. Bulk overhead is ~30-50 lines of helper code per notebook, which is acceptable.

### 4. Skeleton-notebook path remains valid

The skeleton-notebook path from civic-ai-tools-website PR [#103](https://github.com/npstorey/civic-ai-tools-website/pull/103) remains valid for standard-mode chat-flow publishes that select the `datHere` content profile. Skeleton-notebook packages MUST carry `extensions["org.civicaitools.notebook"].provenance === "skeleton"` (auto-emitted by the packager from this ADR forward; absent for pre-ADR-0005 packages, which verifiers treat as `"skeleton"` by the v0 default).

Coexistence is indefinite. The two paths trade off latency and reproducibility-strength differently and serve different users: the skeleton path optimizes for chat-flow latency (the chat answer is the published canonical answer; section E wraps it in notebook structure to satisfy §9.1.1's syntactic requirements); the executed path delivers fully on the determinism property at the cost of ~1-2 minutes of pipeline time. Users select via a UI toggle (see §6 below); hosts choose their own defaults.

Skeleton-notebook packages remain conformant to OES §9.1.1 (the syntactic notebook requirement is met) but do NOT satisfy the determinism property in OES §9.1.3 with full strength: their data-fetch cells are re-executable and reproducible, but the answer-synthesis cell carries a hardcoded markdown answer that is not re-derived from the cell outputs above. Detail-page surfaces SHOULD frame this distinction honestly (see Consequences below).

### 5. Comparison cell with literals at authoring time

When `provenance === "executed"` and `comparisonCellPresent !== false`, the executed notebook MUST include a final "Comparison: original vs. current" cell appended by Phase D before signing. The cell embeds the prominent numeric and dataframe values from the original execution as Python literals and re-computes the current values on re-execution against live data, then prints the delta. The shape is:

```python
# ORIGINAL VALUES (captured at executedAt = 2026-05-19T14:23:45Z)
original = {
    "top_complaint_type": "Noise - Residential",
    "top_complaint_count": 1234,
    "total_complaints_30d": 8901,
}

# CURRENT VALUES (re-computed against live data)
current = recompute_key_metrics()  # uses the same helpers + queries from above

# DELTAS
for k in original:
    delta = (current[k] - original[k]) if isinstance(original[k], (int, float)) else (original[k], current[k])
    print(f"{k}: original={original[k]}, current={current[k]}, delta={delta}")
```

This satisfies §9.1.3's "best-effort reproducibility against the documented runtime + upstream-data state at publish time" by making the original-vs-current comparison legible to the verifier in plain Python. Re-executors do not need to introspect the .ipynb file structure at runtime; the original values are literals in source code; only the `recompute_key_metrics()` half re-runs.

The "prominent values to capture" selection heuristic for v1 is a simple top-N extraction from the synthesis cell's referenced dataframes (Phase 3 IMPL chat owns the heuristic). A future ADR may refine to LLM-selected metrics if the heuristic underperforms. The comparison cell is part of the signed notebook artifact; verifiers MUST treat it as conformant content.

Rejected alternatives for the comparison cell:

- **Notebook reads its own .ipynb file at runtime to parse original outputs.** Brittle (cell ordering, output schema variations, environment-dependent .ipynb paths); requires an introspection idiom that complicates the verifier's mental model. Rejected.
- **Structured metadata block consumed at runtime.** Works but requires a non-obvious read-from-own-metadata pattern. Less legible than literals. Rejected.

### 6. Two trigger surfaces; both produce equivalent packages; user toggle always

Two trigger surfaces support the same generate-and-execute pipeline. Both are user-controlled toggles; neither is required by any host or content profile. Hosts MAY choose their own UX defaults (e.g., Data Concierge defaults to executed because their pattern is executed; civicaitools.org defaults to standard chat-flow because most chat traffic is exploratory). The protocol does not dictate.

- **Trigger A — chat-input.** User opts in at chat submit ("Reproducible notebook" toggle); the executed notebook renders as the answer in chat; if the user publishes, the package is already an executed-path package.
- **Trigger B — publish-time.** User publishes a previously-standard chat answer with "Publish with reproducible notebook" selected; the backend reruns the analysis using the captured chat trace as discovery context (the LLM uses the trace to know what datasets/queries to use); the notebook's output becomes the canonical published answer; the original chat answer is included in section D's deliberative trace as exploratory context but is NOT the canonical published answer.

Both triggers produce packages with `notebookProvenance === "executed"` and identical structural shape. Preview-testing during Phase 2a/2b will inform which trigger should be the more prominent UX (button placement, tooltip recommendations); both remain available regardless.

The two-trigger design and the user-toggle framing are independent of this ADR's core decision (the executed-notebook architecture itself). They land here because the protocol-level packages they produce are equivalent and there is no value in scoping them across two ADRs.

## Considered and rejected alternatives

- **Force all `datHere` publishes to be executed (deprecate the skeleton path).** Rejected. The skeleton path serves chat-flow standard-mode users who want a notebook-shaped artifact without the ~1-2-minute generate-and-execute latency. Forcing executed-mode for every `datHere` publish removes the option to publish a fast chat answer as a `datHere`-profile package. The orthogonal-axes model (captureMethod × contentProfile × notebookProvenance) gives users the right choice; collapsing one axis would be a usability regression. Coexistence indefinite.

- **Different model for notebook authoring (not the chat-flow model).** Rejected for v1. The chat-flow LLM (Anthropic / Claude family via OpenRouter) handles both the discovery and the synthesis phases under unified guidance. Using a different model for notebook authoring would introduce a second integration surface, a second cost line, a second prompt-tuning loop, and a second eval surface — all for unclear gain. Phase 1 testing (curl-driven end-to-end per the project plan §6) is the right place to discover whether the chat-flow model's Python authoring quality is sufficient. If reliability problems surface (invalid Python repeatedly, structure mismatches), revisit then. Switching models is a last-resort optimization, not a first-move design choice.

- **Custom sandbox infrastructure (self-hosted JupyterHub, Modal, AWS Lambda layers, etc.).** Rejected for v1. Vercel Sandbox is validated as fit-for-purpose (Python 3.13 runtime, `allow-all` egress by default, Pro plan concurrency of 2K, ~$0.012/execution at typical sizing, sub-second cold start with snapshots). Authentication is OIDC-automatic on Vercel deployments. The cost of building custom infrastructure exceeds the cost of running on Vercel by orders of magnitude at plausible adoption volumes (at 10K executions/month, the sandbox bill is ~$120/month; custom infrastructure setup + operate is many multiples of that). If a second non-Vercel deployment ever needs this work, the OES extension is provider-agnostic — the `sandboxId` is opaque and the `environment` block does not name a provider in mandatory fields (see [Q28](../architecture/open-questions.md#q28--sandbox-provider-lock-in-vs-portability-for-the-executed-notebook-path) for the portability question).

- **Sandbox provider-locked execution metadata.** Rejected. The OES extension (§2 above) records the runtime environment that was used (Python version, library versions) — properties any re-executor can match — and an opaque `sandboxId` for telemetry only. The execution metadata is provider-agnostic at protocol level. A future non-Vercel implementation publishes valid `notebookProvenance === "executed"` packages without modifying the spec.

- **Streaming partial notebook output to the chat UI during execution.** Rejected for v1. The progress-indicator mechanism (multi-stage indicator backed by Server-Sent Events from `/api/query-notebook` at phase boundaries A/B/C/D) is sufficient feedback for a 90-120s wait. Streaming a half-rendered notebook to the chat UI adds significant client+server complexity (state synchronization between the streaming render and the final executed-notebook artifact; cell-output rendering for partially-executed cells; user confusion about what's "real" until execution completes). UX value is unclear. Stretch goal for v1.1 if user demand materializes.

- **Helpers loaded from a remote URL at notebook start.** Already addressed in §3 above; rejected because of the determinism-property weakening it would introduce.

- **Comparison cell that introspects its own .ipynb file at runtime.** Already addressed in §5 above; rejected for legibility and robustness reasons.

- **Sandbox per-execution snapshot creation (rather than a single shared snapshot for the project).** Rejected. Sandbox snapshots are a build-time artifact (Python + pinned scientific stack); they are not per-execution. The project maintains a single snapshot ID referenced by all executions. Snapshot expires after 30 days by default; the build pipeline regenerates and updates the snapshot ID on a cadence that fits the library-version-bump cadence.

## Consequences

- **OES amendment.** The Open Evidence Standard gains a new sub-section §9.1.4 ("Notebook execution provenance and metadata") specifying the `extensions["org.civicaitools.notebook"].provenance` sub-field and the `extensions["org.civicaitools.execution"]` extension. §9.1.1 requirement 4 is clarified with a note that the notebook MAY be either skeleton or executed at protocol level (both are valid datHere notebooks), with `notebookProvenance` as the conformance distinguisher. §9.1.3 (determinism property) gains a clarifying paragraph noting that executed notebooks deliver the property materially (all cells re-derive from data; comparison cell records original-vs-current) while skeleton notebooks deliver it partially (data fetch re-executes; answer synthesis carries a hardcoded markdown). The amendment ships in the same PR as this ADR.

- **Open-questions registry.** Four new questions land in the active section:
  - **Q28** — Sandbox provider lock-in vs. portability for the executed-notebook path.
  - **Q29** — Execution-failure semantics for the executed-notebook path.
  - **Q30** — Determinism over time: freshness window for civic data.
  - **Q31** — Skeleton vs executed notebook distinction in evidence metadata (current direction in place; will be resolved when the implementation ships in Phase 3 of the project plan).

- **Implementation surface (scoped here, not done here).** The detailed implementation lives in `executed-notebook-architecture-project-plan.md` (workspace-root planning doc; not part of any repo at the time this ADR is drafted) and is decomposed into three phases. Concretely:
  - Phase 1: `/api/query-notebook` endpoint on `civic-ai-tools-website`; LLM notebook-authoring prompt template at `src/lib/notebook-author/`; Python helper-function source files at `src/lib/notebook-author/helpers/`; Vercel Sandbox integration at `src/lib/sandbox/`; sandbox snapshot creation script + CI artifact; OES `org.civicaitools.execution` extension schema enforcement.
  - Phase 2a: Chat-input mode toggle + executed-notebook renderer in chat output + SSE-driven multi-stage progress indicator + comparison-cell extraction heuristic.
  - Phase 2b: Publish-dialog with side-by-side "Publish" / "Publish with reproducible notebook" buttons; chat-trace-as-discovery-context invocation of the same backend pipeline.
  - Phase 3: Packager extension to emit `notebookProvenance` and `org.civicaitools.execution`; `/api/evidence` route to accept the executed-notebook payload shape; `/api/evidence/:slug/bundle` to serve the executed notebook directly; detail-page A-G display to render section E as cells with embedded outputs and section F sourced from the synthesis cell; honest reproducibility labels per Q31.

- **Bundle export contract.** `GET /api/evidence/:slug/bundle` returns the executed notebook directly for `notebookProvenance === "executed"` packages. The skeleton-notebook bundle path remains unchanged. Both serializations (notebook-embedded per OES §9.2.2 and sibling YAML per OES §9.2.3) work identically for executed packages; the executed-notebook content is what's embedded.

- **Detail-page rendering.** The evidence detail page (`civic-ai-tools-website/src/app/evidence/[slug]/page.tsx`) renders section E as cells with embedded outputs when `notebookProvenance === "executed"`; the skeleton-path rendering (current behavior in PR #103) continues to apply when `notebookProvenance === "skeleton"` or absent. Section F is sourced from the synthesis cell's output for executed packages and from the hardcoded markdown answer for skeleton packages. Labels framing the reproducibility property surface near the section-E heading: e.g., "Executed notebook — answer derived from computed data; full re-execution reproducible" vs. "Skeleton notebook — answer authored in chat; data fetch reproducible but answer synthesis is not."

- **Backwards compatibility.** Existing `datHere`-profile packages produced under PR #103 (skeleton path) remain verifiable byte-identical. They carry no `notebookProvenance` field and verifiers treat absence as `"skeleton"`. Their `org.civicaitools.execution` extension is absent (executed packages emit it; skeleton packages do not). The schema version stays at `0.1.0` — both fields are optional additions covered by the existing canonical-JSON / signature contract. Q27 (schema-version bump trigger) governs when 0.1.0 → 0.2.0 lands; this ADR does not force the bump.

- **Cost discipline.** Per-execution cost at the typical sizing referenced in the Context section is ~$0.012, validated against published Vercel Sandbox pricing as of 2026-05-21. The publishing pipeline SHOULD configure Vercel Spend Management to alert + pause at a per-month cap. Phase 1 testing reveals the actual cost distribution against real notebook complexity; the production deployment SHOULD revisit the cap once Phase 1 data is in.

- **Sister ADRs.** Three subsequent ADRs are anticipated for the rest of the Pittsburgh integration arc: the attest/publish lifecycle ADR (from [civic-ai-tools#71](https://github.com/npstorey/civic-ai-tools/issues/71)), the unified node primitive ADR (anticipated alongside [civic-ai-tools#70](https://github.com/npstorey/civic-ai-tools/issues/70)), and the adversarial-eval requirement model ADR (from [civic-ai-tools#72](https://github.com/npstorey/civic-ai-tools/issues/72)). Each resolves additional open questions and amends the OES on its own terms. Anticipated numbering is deferred to creation order at acceptance time; this ADR's acceptance does not pre-allocate slots beyond 0005.

- **Build-state coloring.** The executed-notebook architecture enters `end-state-vision.md` at the "designed" build state once this ADR is Accepted; it moves to "built" when Phase 1 ships. The vision document update follows the implementation, matching the project pattern.

## References

- [ADR-0004](0004-dathere-captureMethod-variant.md) — introduces the `datHere` content profile and the A-G envelope; this ADR specifies the executed-notebook authoring path within that envelope. ADR-0004's References section anticipated subsequent ADRs as 0005/0006/0007; with this ADR taking the 0005 slot, the anticipated cluster shifts.
- [ADR-0003](0003-evidence-capture-method.md) — establishes the `captureMethod` field and the tamper-evident labeling principle that the executed-notebook metadata extension follows.
- `civic-ai-tools/docs/architecture/open-evidence-standard.md` — §9.1.4 (new) specifies the `notebookProvenance` sub-field and the `org.civicaitools.execution` extension shape; §9.1.1 requirement 4 and §9.1.3 receive clarifying paragraphs.
- `civic-ai-tools/docs/architecture/open-questions.md` — Q28 (sandbox provider lock-in), Q29 (execution-failure semantics), Q30 (determinism freshness window), Q31 (skeleton vs executed notebook distinction in metadata; direction-in-place) added in the same PR as this ADR.
- `civic-ai-tools/docs/architecture/xanadu-doctrine.md` — gate satisfied; the named adopter is the Pittsburgh / WPRDC pilot, for whom the determinism property is load-bearing.
- `civic-ai-tools/docs/architecture/working-method.md` — promotion path from registry to ADR: Q28-Q31 are added in the same commit that drafts this ADR, with Q31's direction already in place.
- `civic-ai-tools-website/src/lib/evidence/packager.ts` — Phase 3 packager extension surface (notebookProvenance + execution-metadata emission).
- `civic-ai-tools-website/src/app/api/evidence/route.ts` — Phase 3 route validation surface (accept executed-notebook payload shape).
- `civic-ai-tools-website/src/app/evidence/[slug]/page.tsx` — Phase 3 detail-page rendering surface (executed-cells display + honest reproducibility labels).
- [Jupyter Notebook Format v4.5+ specification](https://nbformat.readthedocs.io/en/latest/format_description.html) — the notebook format both skeleton and executed paths produce.
- [Vercel Sandbox documentation](https://vercel.com/docs/vercel-sandbox) — system specifications, pricing, firewall, snapshots. Validated 2026-05-21 against the canonical pages (last_updated 2026-01-30 through 2026-03-14).
- `executed-notebook-architecture-project-plan.md` (workspace root, local-only) — the planning document this ADR was drafted from; §10 carries the Q1-Q9 resolutions that inform §1-§6 above and the §3 helpers / §5 comparison-cell / §6 trigger-design decisions; §8 carries the cost+networking risk-table that this ADR's Context references.
