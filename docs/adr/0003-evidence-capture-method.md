# ADR-0003: Capture-method differentiation for evidence packages

- **Status:** Accepted
- **Date:** 2026-04-28
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —

## Context

civicaitools.org's evidence system signs and registers analyses as cryptographically verifiable packages. As of 2026-04-28 there are two production paths that produce these packages, and they have **different epistemic guarantees that look identical to readers of the detail page**:

1. **Website chat flow.** The server (`POST /api/evidence` from streaming chat completion) captures the model's text byte stream as it emits to the browser. `prompt`, `output`, `toolCalls[].args`, and `tokenUsage` are recorded at the wire layer. Verbatim by construction — there is no opportunity for a downstream model to retroactively rewrite the captured text.

2. **Claude Code publish-evidence skill.** A second Claude Code session reads the original analysis from in-context conversational memory and assembles a payload. Until 2026-04-28, the recommended assembly pattern (in SKILL.md and demonstrated by the existing Bronx package `a9e428…`) was for the publishing model to write `turns[].content`, `prompt`, and `output` into Python string literals from memory — i.e., to **paraphrase its own prior outputs**. Token usage was hand-estimated. The package was then signed with the same platform key as chat-flow packages.

Three observations made the divergence load-bearing:

1. The cryptographic signature attests "this content was published and has not been tampered with since." It does **not** attest "this content matches what was actually generated in the original session." For chat-flow packages the two are equivalent because the server captured the bytes. For self-report packages they are not.
2. A side-by-side check during the 2026-04-28 NYC 311 publish (working package `ca6cd14499f0`) showed the paraphrased multi-turn transcript was *close in length* to the verbatim version (16,467 vs. 16,376 chars, within 1%) but contained constructed bracketed annotations like `[Tool calls: load Socrata MCP tools via ToolSearch...]` that were never emitted in the original session. Token estimates were off by ~14× on prompt tokens (estimated 80k vs. actual 1,092,067 summed from per-invocation `usage` records).
3. No package-level field exists today to label which capture path produced a given record. Readers of `a9e428…` next to `ca6cd14499f0` cannot tell from the detail page that the former is paraphrased reconstruction while the latter is verbatim JSONL readback.

This is a Principle 1 (disclosure, not validation) failure applied to the project's own evidence chain.

## Decision

Introduce a `captureMethod` field on the evidence-package schema and require future skill-published packages to obtain content verbatim from the Claude Code session JSONL. The label is preserved in the signed envelope so the capture method is itself tamper-evident.

**Capture-method vocabulary (signed enum on the package):**

- `chat-flow-stream` — website server captured bytes as the model streamed. Default for chat-flow publishes. Verbatim by construction at the wire layer.
- `claude-code-jsonl-readback` — Claude Code publish skill read each turn's `content` and per-invocation `usage` directly from `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`, filtering to `text`-typed content blocks only (excluding `thinking` and `tool_use`). Tool-call args read from the same source. Verbatim by construction at the JSONL layer.
- `claude-code-self-report` — Legacy: publishing model paraphrased the original session from in-context memory. Deprecated as of this ADR. Retained as an enum value so packages predating 2026-04-28 (notably `a9e428…`) can be re-rendered with their actual capture method labeled rather than silently re-described as something they were not.

**Field carve-out — verbatim-by-construction vs. inherently model-authored.** Even under a verbatim capture method, the package contains fields the original session never produced, which the publishing model necessarily authors for legibility (notably `title` and `summary`). The principle: a field is *verbatim-by-construction* if its value was captured at a non-paraphrasing layer (the wire stream for chat-flow, the session JSONL for the skill). It is *inherently model-authored* if the publishing model produces it for the package's metadata. The detail page UI may surface this distinction so readers do not conflate the publishing-model's characterization with the captured analysis. Future schema additions classify per this principle; only changes to the principle itself require an ADR amendment.

**Don't gatekeep — label.** This ADR does not introduce a separate signing key per capture method, refuse to sign self-report packages, or hide legacy packages. The platform signs all three under the existing key. The label is the differentiation.

## Considered and rejected alternatives

- **Refuse to sign self-report packages going forward.** Rejected: closes off Claude Code as a publish path entirely. The Claude Code publish path exists because the website chat flow's cost-managed model and 200K token cap cannot support the frontier-model multi-indicator analyses that motivate the dual-package demo narrative. The right answer is to require verbatim *within* that path, not to remove the path.
- **Different signing keys for different capture methods.** Rejected: complicates the trust registry (`/.well-known/evidence-public-keys.json`), forces key-per-environment proliferation that the system is structurally unprepared for, and adds no benefit beyond what a labeled enum field provides. If a future capture method has *meaningfully different* trust properties (for example, a third-party signed self-attestation), a separate key is back on the table. Not for this case.
- **Single capture path (only chat flow); deprecate Claude Code publish.** Rejected: removes the frontier-tier capability deliberately. Cost-constrained chat flow and frontier-model Claude Code publish solve different needs; both must remain.
- **No `captureMethod` field; trust the publisher.** Rejected: this is the status quo. The status quo created the confusion this ADR resolves. A reader inspecting two packages signed by the same key needs a structural way to tell them apart.
- **Hide or withdraw legacy self-report packages until they can be re-published with verbatim capture.** Rejected: silently rewriting the public record is a worse trust failure than honest labeling. The existing `a9e428…` Bronx package receives a human-expert attestation noting its capture method and the token-estimate gap, and remains visible.
- **Enumerate every field's classification within this ADR.** Rejected: creates a maintenance surface that drifts as the schema evolves and tempts ADR amendments for ordinary schema additions. The principle self-applies; concrete classification lists belong in the implementation issues that ship the UI surfacing.

## Consequences

- **Package schema migration.** A new optional `captureMethod` field is added to the signed envelope (`civic-ai-tools-website/src/lib/evidence/packager.ts`). Default for new publishes from chat flow: `chat-flow-stream`. Default for new publishes from the skill: `claude-code-jsonl-readback`. Default for packages predating this ADR (where the field is absent in storage): `claude-code-self-report` if they originated from the skill, `chat-flow-stream` otherwise. Pre-ADR records are not re-signed.
- **publish-evidence skill update (civic-ai-tools).** SKILL.md must require: read each `turns[].content` from JSONL filtering to `text`-typed content blocks only; sum `usage` across unique `msg.id` invocations (cache tokens fold into `promptTokens`); set `captureMethod: "claude-code-jsonl-readback"` on the payload; verify against a negative pattern scan (no `<thinking>` tags, no `tool_use` literals, no `toolu_` IDs, no `signature:` fields) before dry-run completes. The Python builder pattern is fine for tool args; for prose content it must read JSONL, never write Python string literals from memory.
- **Detail-page UI update (civic-ai-tools-website).** The page surfaces `captureMethod` near the verification status as a short label. Multi-turn package transcripts are rendered from `turns[]` rather than truncated `output` (the existing 2,000-char hard truncation in `ProvenanceChain.tsx:173` is replaced; tracked separately).
- **Bronx package retroactive attestation.** The `a9e428…` Bronx package receives a human-expert attestation explicitly stating it was published before the JSONL fix and that its `tokenUsage` was hand-estimated. The attestation does not change the package's signature; it adds metadata visible on the detail page.
- **Future capture methods extend this enum.** A hook-based path that records bytes at message-emission time, or a future Claude Code SDK with a session-replay primitive, would add new vocabulary values. This ADR sets the labeling pattern.
- **Implementation timeline.** The skill change ships in civic-ai-tools as the implementation of the publish-evidence-skill issue filed alongside this ADR. The schema and UI changes ship in civic-ai-tools-website as separate issues. The current `ca6cd14499f0` package is unaffected because it was published with verbatim JSONL readback (the implementation predated the schema field by hours; it will retroactively be tagged `claude-code-jsonl-readback` when the field lands).

## References

- `ca6cd14499f0` — first JSONL-readback skill publish (NYC 311 cross-agency reassignment, 2026-04-28). Working example of the verbatim pattern.
- `a9e428ba…` — Bronx demographic profile, published 2026-04-17 via the self-report path. Receives a retroactive attestation.
- `civic-ai-tools/.claude/skills/publish-evidence/SKILL.md` — must be updated.
- `civic-ai-tools/docs/publish-evidence.md` — user-facing doc; needs corresponding update.
- `civic-ai-tools-website/src/lib/evidence/packager.ts` — package schema location.
- `civic-ai-tools-website/src/app/evidence/[slug]/page.tsx`, `src/components/evidence/ProvenanceChain.tsx` — detail-page surfaces.
- `civic-ai-tools-website/docs/api/evidence-publish.md` — Phase A external-clients doc; needs `captureMethod` reference once the field lands.
- `civic-ai-tools-website/docs/design-principles.md` — Principle 1 (disclosure, not validation), Principle 2 (verifiable, not just claimed) applied to the project's own evidence chain.
