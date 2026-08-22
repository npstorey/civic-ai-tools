# ADR-0026: The `claude-code-jsonl-readback` capture method labels a readback no shipped tool performs or verifies

- **Status:** **Proposed** 2026-08-22 (raised by the [civic-ai-tools#63](https://github.com/npstorey/civic-ai-tools/issues/63) threat-model sprint, which measured the gap while writing [`trust-and-evidence.md`](../trust-and-evidence.md); **this record proposes a decision and does not take one**)
- **Date:** 2026-08-22
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0003](0003-evidence-capture-method.md) (which minted the `claude-code-jsonl-readback` value and the label-don't-gatekeep choice this record does not disturb)

*Numbering note: 0025 is the highest record on `main` at drafting time; 0018 remains reserved for the roadmap-governance amendment.*

## Context

[ADR-0003](0003-evidence-capture-method.md) introduced `captureMethod` so that a reader could tell a verbatim capture from a paraphrased one, and defined `claude-code-jsonl-readback` as the value for records where "Claude Code publish skill read each turn's `content` and per-invocation `usage` directly from `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`" — "Verbatim by construction at the JSONL layer" (`:46`). The specification carries the same definition at §8.6 `:673`: "the publishing client (typically a Claude Code skill) read each turn's content and per-invocation usage from the session JSONL on disk, filtering to text-typed content blocks only. Verbatim by construction at the JSONL layer."

**Measured at civic-ai-tools `ec608e6`, the readback that sentence describes is not performed by any shipped tool.**

- `publish.py` never opens a session JSONL. Its only file operations are the saved-credentials read (`:189`), the saved-credentials write (`:212`), and the caller-supplied `--payload` read (`:1762`). Everything else is network I/O.
- The readback is a **procedural instruction to the publishing model**, carried in the skill's guidance text (`.claude/skills/publish-record/SKILL.md:74`, `:117`, `:125-127`, `:133`, `:137-143`). The model reads the session log and transcribes its content into the payload; the script receives the payload and never sees the log.
- The one mechanical guard is a **leak-marker heuristic**: the script rejects a payload whose `prompt`, `output`, or `turns[].content` contains `<thinking>`, the literal `tool_use`, a `toolu_…` identifier, or a `signature:` field (`publish.py:567-609`, patterns at `:129-136`). Those three fields are its entire scope; `title`, `summary`, `toolCalls[].args`, and `tokenUsage` are unscanned. The heuristic detects one artifact class of paraphrase. It does not detect fabrication, and a correctly-transcribed payload and a well-written fabrication are indistinguishable to it.
- The skill's own test suite states the coverage boundary: "The publishing model's full JSONL-readback pipeline is end-to-end-tested by actual publishes; these tests cover only the gates that publish.py itself enforces" (`.claude/skills/publish-record/test_publish.py:5-7`).

Nothing here is a defect in the envelope. The label is faithfully placed inside the signed canonical JSON, is tamper-evident exactly as §8.6 `:678` specifies, and is read by §9.2 #11 and vocabulary-checked by §9.2 #15 exactly as specified. The gap is between what the value's *definition* describes — a client reading a file — and what the shipped path *does* — a model transcribing under instruction, guarded by a three-field heuristic.

Why it is worth a record rather than a code comment: `captureMethod` exists precisely so a reader can weigh one capture path against another, and §10.1's `captureMethod`-weighting mitigation instructs consumers to do exactly that. A value whose definition overstates its mechanism degrades the one signal the field was minted to carry.

## What this record proposes

**That the divergence be decided, deliberately, in one of the directions below.** This record takes no position among them and is not self-executing.

### Option A — make the readback mechanical

Have the skill itself read the session JSONL: locate the session file, extract `text`-typed content blocks, sum per-invocation `usage`, and construct the payload from what it read rather than from what a model typed.

- *Buys:* the value's definition becomes true of the shipped path. `prompt`, `output`, `turns[].content`, and `tokenUsage` become verbatim-by-construction in the same sense the chat-flow path is, and ADR-0003 `:34`'s token-estimation failure class closes mechanically rather than by instruction.
- *Costs:* a substantial new surface in the skill (session-file discovery, JSONL schema-version tolerance, turn/window boundary logic currently exercised by a model's judgment), coupled to an undocumented on-disk format outside this project's control. The window-selection and prompt-promotion behaviors that `SKILL.md:113-115` currently leave to model judgment would need mechanical rules or would remain model-supplied, which would leave the label partly overstated anyway.

### Option B — rename the capture method to describe what happens

Mint a new vocabulary value naming the actual mechanism — transcription under instruction with a paraphrase-marker gate — and follow the Appendix J alias-and-deprecate pattern: new records emit the new value, existing records keep theirs, verifiers accept both.

- *Buys:* the label stops overstating without any change to the publish path. Readers weighing capture methods get an accurate distinction, and the `chat-flow-stream` / this-value gap becomes legible rather than implied.
- *Costs:* a vocabulary change reaches five surfaces that restate the value list plus the Postgres enum and the reader-facing label maps; the value is frozen inside every already-signed record, so the old value is permanent and the vocabulary grows rather than changes. It also renames a property rather than strengthening it — a reader who trusted the old label learns they should not have, which is honest but is not a mitigation.

### Option C — keep the label and document the gap

Leave the vocabulary and the code as they are; correct the *definitions* in ADR-0003 `:46` and specification §8.6 `:673` so they describe an instructed-and-scanned readback rather than a client file read, and let [`trust-and-evidence.md`](../trust-and-evidence.md) carry the reader-facing account.

- *Buys:* the cheapest path to an accurate public record; no wire change, no vocabulary growth, no new code. Consistent with ADR-0003 `:51`'s label-don't-gatekeep posture, which chose disclosure over enforcement in the first place.
- *Costs:* the value's *name* still says "readback," and names travel further than definitions — a consumer implementing §10.1's `captureMethod`-weighting reads the vocabulary value, not the ADR. Leaves the strength of the two shipped methods closer together than their names suggest.

### Option D — a verifying wrapper

Keep the model-transcription flow and add a check between the payload and the POST: a step that reads the session JSONL and compares it against the payload's prose and token fields, refusing or flagging on divergence.

- *Buys:* the strongest form of the property without moving the extraction logic — the model still decides *what* window to capture, and the wrapper confirms the captured text *is* what the log holds. Could emit a machine-readable result, which is the shape [Q69](../architecture/open-questions.md#q69--what-should-a-verifier-record-when-it-resolves-an-external-reference) contemplates for external references.
- *Costs:* carries Option A's session-file and schema coupling without Option A's simplification, and needs a defined answer for the case where the payload legitimately differs from the log (a rendered multi-turn transcript is assembled, not copied). Largest surface of the four.

## What this record does not decide

- **It does not choose among A–D**, and the ordering above is presentational, not a ranking.
- **It does not disturb ADR-0003's label-don't-gatekeep decision** (`:51`). None of the four options refuses to sign anything.
- **It does not settle whether an emitter should bind `captureMethod` to the path that produced a record** — that is the general question, registered as [Q70](../architecture/open-questions.md#q70--capturemethod-is-validated-against-the-profile-vocabulary-but-not-bound-to-the-path-that-produced-the-record). This record concerns one value's fidelity to its own definition.
- **It asserts nothing about the chat-flow path**, whose separate measured property (the platform retains no server-side copy of what it captured) is described in [`trust-and-evidence.md`](../trust-and-evidence.md) and is not this record's subject.

## Consequences

- **Until this is decided, the gap is disclosed rather than closed.** [`trust-and-evidence.md`](../trust-and-evidence.md) states the measured mechanism in reader-facing terms, and [`docs/publish-record.md`](../publish-record.md) `:87` describes the skill path as an instructed-and-scanned procedure rather than a file read.
- **The specification text at §8.6 `:673` is inaccurate as written** and is recorded as errata regardless of how this record resolves: it describes a JSONL read the client does not perform. Correcting the specification is not this record's to do, and no option above requires the correction to wait.
- **`captureMethod` remains a signed self-assertion in every case.** Whatever is decided here, §9.2 #11 and #15 continue to read and vocabulary-check the label without testing that the labeled mechanism ran — a property of the check list, not of this value.

## References

- [ADR-0003](0003-evidence-capture-method.md) — minted `claude-code-jsonl-readback` (`:46`), the verbatim-by-construction vs. inherently-model-authored carve-out (`:49`), and the label-don't-gatekeep choice (`:51`); `:34` records the token-estimation failure the readback instruction exists to prevent.
- [`typed-standards-specification.md`](../architecture/typed-standards-specification.md) §8.6 — the vocabulary and its definitions (`:670-674`), the tamper-evidence property (`:678`), and the "signed ≠ verbatim" statement (`:680`). §9.2 #11 and #15; §10.1's `captureMethod`-weighting mitigation.
- [`trust-and-evidence.md`](../trust-and-evidence.md) — the reference-implementation account, with the measured `file:line` citations this record draws on.
- [Q70](../architecture/open-questions.md#q70--capturemethod-is-validated-against-the-profile-vocabulary-but-not-bound-to-the-path-that-produced-the-record) — the general emitter-binding question.
- `.claude/skills/publish-record/SKILL.md`, `publish.py`, `test_publish.py` — the measured surfaces.
