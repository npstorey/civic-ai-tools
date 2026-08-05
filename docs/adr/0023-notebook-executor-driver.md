# ADR-0023: Notebook executor as a driver interface — Vercel Sandbox default, local container-runner as the portable shape

- **Status:** **Accepted** 2026-08-05 (maintainer review, post-merge of #125; the seam shipped in civic-ai-tools-website#176 and its both-drivers parity bar was met byte-identically)
- **Date:** 2026-08-04 (decision + draft)
- **Decision-maker:** Solo maintainer
- **Supersedes:** —
- **Superseded by:** —
- **Evolves:** [ADR-0005](0005-executed-notebook-architecture.md) (the executed-notebook pipeline whose Phase C execution step this ADR turns into a seam; the snapshot-boot and timeout posture carry over unchanged), [ADR-0019](0019-reference-app-posture.md) (the reference-app posture — a reference implementation others stand up on their own stack needs its one hosted-platform-specific execution dependency behind an interface)

*Numbering note: 0018 remains reserved for the roadmap-governance amendment; 0019–0022 are taken (confirmed against `origin/main` at drafting time).*

## Context

ADR-0005 chose executed notebooks as the evidence substrate and Vercel Sandbox as the execution environment: the reference application boots a python3.13 microVM from a pre-built snapshot, writes the authored notebook in, runs `jupyter nbconvert --execute`, and reads the executed notebook back. That executed notebook is not incidental output — its bytes feed evidence packages, so the execution step sits on the pipeline's integrity path.

Until now the sandbox integration was a single module (`src/lib/sandbox/execute.ts` in the reference app) importing the hosted platform's SDK directly, with exactly one runtime caller (the notebook-pipeline route). That made it the last hosted-platform-specific dependency without a portability seam: the current portability sprint had already put the database behind `DB_DRIVER` (serverless-HTTP default, TCP Postgres alternative) and object storage behind `BLOB_DRIVER` (platform blob store default, S3-compatible alternative), each an env-var-selected, lazily-loaded driver pair whose default preserves the demo deployment's behavior byte-for-byte. An instance standing up the reference app on a standard cloud/container stack could bring its own Postgres and its own object store, but not its own notebook executor.

The sprint's G0 gate weighed the portable shape for execution and chose a **local container-runner** as the second driver: the driver execs a pinned image via the host container runtime, with nbconvert running inside the image. A prebuilt image is the portable equivalent of the hosted snapshot concept — both freeze the pinned scientific stack ahead of time so per-run cost is boot + exec, not dependency install.

One rider surfaced during implementation survey: the pinned scientific-stack library table (pandas/requests/numpy/matplotlib versions) appeared in more than one place — the notebook-author module and a hand-mirrored copy in the snapshot build script, with a comment as the only drift guard — and a container image would have added a third. Executed-notebook reproducibility rests on those pins agreeing everywhere, so the seam work single-sources them.

## Decision

### A. The notebook executor becomes a driver interface

`executeNotebook(notebook, opts) → ExecutionResult` keeps its exact signature and remains the pipeline's only entry point; behind it, a `NotebookExecutorDriver` interface (`src/lib/sandbox/driver.ts`) carries the create/exec/read/teardown session semantics the pipeline actually uses: create a session with a wall-clock cap and notebook-visible env, run commands in it, stage files, read the executed notebook back, tear the runtime down. The surface mirrors what the pipeline used of the hosted SDK (create-with-snapshot-or-base-image, runCommand, writeFiles, readFileToBuffer, stop), so the default driver is a relocation, not a redesign.

Selection follows the established in-app driver-seam register (`DB_DRIVER`, `BLOB_DRIVER`): an `EXECUTOR_DRIVER` env var, `vercel-sandbox` when unset, drivers loaded lazily via dynamic import so the non-selected driver's dependencies never load, and a loud failure on unknown values. Orchestration above the seam — notebook staging, the nbconvert invocation and its per-cell timeout, error mapping, the version probe — is shared, not per-driver; drivers supply only the runtime primitives. Runtime-specific environment fixups (the hosted image's CA-bundle paths) live inside the driver that needs them.

### B. Driver #1: `vercel-sandbox` (default; demo-instance behavior unchanged)

The existing integration relocated verbatim: snapshot boot when a snapshot id is configured, fresh-boot-plus-inline-pip fallback otherwise, identical timeouts, env handling, and error shapes. With no `EXECUTOR_DRIVER` set, the demo instance's behavior is unchanged.

### C. Driver #2: `container` — the local container-runner (the G0 portable shape)

The driver execs a pinned image via the host container runtime's `docker` CLI (any Docker-compatible runtime): boot an idle container (create), `docker exec` per step (exec/read), kill on teardown, with a wall-clock timer killing the container at the same cap the default driver enforces at create time — overrun surfaces as a failed in-flight exec and maps into the same error shape. nbconvert runs inside the image. The image (`docker/executor/Dockerfile` in the reference app) prebuilds python3.13 + the pinned scientific stack + the notebook tooling — the portable equivalent of the snapshot: build once, then per-run cost is container start + exec.

### D. Explicitly reversible and additive

The seam adds surface; it removes and rewrites nothing. A hosted HTTP runner-service can land later as driver #3 — implementing the same session interface over a remote API — without unwinding either existing driver or touching the orchestration or its caller. Symmetrically, if the container driver proves unnecessary it can be deleted without a trace in the default path.

### E. Rider: the pinned scientific-stack table is single-sourced

The single source is `src/lib/notebook-author/prompt.ts` in the reference app (`PINNED_LIBRARIES` + `PYTHON_RUNTIME_VERSION`); the notebook-tooling package set lives beside the seam (`EXECUTOR_TOOLING_PACKAGES` in `src/lib/sandbox/driver.ts`). Everything else derives:

- the notebook's own pip-install cell and the fresh-sandbox pip fallback (direct imports, as before);
- the snapshot build script (`scripts/build-sandbox-snapshot.ts`) — its hand-mirrored copy is deleted in favor of importing the table;
- the container image's Dockerfile — which cannot import TypeScript, so it is a **test-enforced mirror**: a unit test (`src/lib/sandbox/container.test.ts`) parses the Dockerfile's pins and FROM line and asserts exact equality with the table, making drift a test failure rather than a comment's plea.

## Considered and rejected

- **HTTP runner-service now (driver #2 as a hosted service).** Deferred, not precluded — it is the named driver #3 shape. A service adds an authenticated network surface, a deployment to operate, and a second repo/artifact to version, and no adopter has asked for remote execution; the G0 gate chose the shape an instance can run with nothing but a container runtime. The seam is the part that must exist first either way.
- **In-process execution on the app host (spawn jupyter directly).** Rejected: notebooks execute model-authored code; ADR-0005's isolation posture (a disposable runtime per execution) is load-bearing, and a container provides it portably where a bare process does not.
- **Extracting execution into a published package now.** Rejected on the Xanadu gate: no second consumer exists; the seam is an application-internal interface. If the reference-app posture later warrants it, the driver interface is the extraction-ready boundary.
- **Letting each driver define its own result shape.** Rejected: the executed notebook feeds evidence packages, so the seam must not alter execution output beyond what the runtimes inherently differ in. One `ExecutionResult` shape plus an explicit, minimal normalization contract (instance ids, durations, python patch version, per-cell execution-timing metadata — the parity harness documents each) keeps "inherently differs" from growing by convenience.

## Consequences

- **A parity harness is the seam's conformance check.** A standalone script executes a deterministic, network-free fixture notebook on a named driver, writes a normalized result, and diffs two drivers' results with a non-zero exit on mismatch. The normalization list is the complete statement of tolerated cross-runtime difference; anything outside it is a regression in one driver or the other.
- **Operators of the container driver own an image build.** The Dockerfile ships in the reference app; building and (re)tagging the image is an operator step, re-run when the pinned table changes. The anti-drift test converts a stale Dockerfile into a failing build rather than a silently divergent runtime.
- **The environment inventory grows the executor's variables** — the driver selector, the container image tag, and (previously undocumented) the default driver's snapshot id and off-platform auth set — closing an env-inventory gap the sprint brief flagged. The auth set is a case where documenting the variables was not sufficient on its own: the sandbox SDK reads exactly one auth variable from the environment (its OIDC token) and accepts the token/team/project triple *only* as explicit create-call parameters, so the application reads those three variables and passes them through to the SDK, all three or none — a partial set is an SDK error, and with none set the on-platform OIDC path is untouched. An env-inventory entry that names a variable the code never reads documents a mechanism that does not exist; this one is backed by the pass-through and a unit test.
- **ADR-0005 is narrowed, not amended.** Its executed-notebook architecture, snapshot rationale, and timeout posture stand; "Vercel Sandbox" in its text now names the default driver rather than the only execution path.
- **The demo default is byte-identical.** With no env var set, the default driver runs the relocated code against the same snapshot with the same timeouts; the sprint's acceptance bar for the phase is an unchanged test suite plus the container leg of the parity harness proven locally.

## References

- [ADR-0005](0005-executed-notebook-architecture.md) — the executed-notebook pipeline and the original sandbox-execution decision this seam generalizes.
- [ADR-0019](0019-reference-app-posture.md) — the reference-app posture motivating portability seams.
- Reference app (`civic-ai-tools-website`): `src/lib/sandbox/driver.ts` (interface), `src/lib/sandbox/vercel-sandbox.ts` / `src/lib/sandbox/container.ts` (drivers #1/#2), `src/lib/sandbox/execute.ts` (dispatch + orchestration), `docker/executor/Dockerfile` (the pinned image), `scripts/executor-parity.mjs` (parity harness + normalization contract), `src/lib/sandbox/container.test.ts` (single-source anti-drift test).
- In-app precedent: the `DB_DRIVER` and `BLOB_DRIVER` seams (`src/lib/db/index.ts`, `src/lib/storage/index.ts`) whose selection register this seam follows.
