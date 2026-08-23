# AGENTS.md

The hub repo of a four-repo project: MCP configs and setup tooling for civic open data (NYC Open Data via Socrata, Google
Data Commons), the Typed Standards Specification and its ADRs, the source of truth for shared skill guidance, and the
`publish-record` skill. npm workspaces (one package, `packages/civic-typed-harness`) alongside Python examples. Cursor
and Codex read this file natively; `CLAUDE.md` is a one-line bridge to it.

## Boundaries

**This repo is public.** Strategic and relationship context — named external stakeholders, prospective collaborators,
pre-meeting strategy, private outreach plans, named individuals' opinions — lives in local-only planning docs, never here.
Use neutral phrasing ("an external stakeholder", "an upcoming demo") wherever output lands in this repo; if a prompt you
received carries strategic context, scrub it first.

**Never push to `main`,** and never bypass a git hook or the pre-push sensitivity guard. The guard scans the added lines
of *each outgoing commit*, not the net diff, so a fix commit on top never clears it — rebuild the branch history.

**Secret hygiene** (incident: civic#174, the 2026-08-22 token exposure). Never `cat`, `head`, `tail`, or otherwise dump
`.env*`, `auth.json`, `credentials*`, `*.pem`, `*.key`, or anything under `~/.ssh` or `~/.aws`. Two reads are permitted:
a field-scoped read by key **name** (`grep '^VAR_NAME=' .env`, or `jq` over non-secret fields), and a command the tool
itself exposes (`publish.py --list-tokens` prints prefix, scope, and expiry only). One prohibition: **never
load-and-print a credentials file, even through a redaction filter** — a filter applied at the wrong nesting level prints
the value it was written to hide. Publish tokens live in `~/.config/civic-ai-tools/credentials.json`; `--logout` is
local-only, revocation is the dashboard. Setup keys belong in `.env`; tell a user to paste them there, never into a chat.

## Commands

| Command | Healthy output |
|---|---|
| `npm ci` | `added 116 packages, and audited 118 packages` … `found 0 vulnerabilities`; leaves `packages/civic-typed-harness/dist` populated |
| `npm run build` | the `tsc -p tsconfig.json` echo and nothing after it, exit 0 |
| `npm test` | `# pass 125` / `# fail 0` (`node --test` TAP; includes the golden byte-compat suite) |
| `npm run typecheck` | no output, exit 0 |
| `npm run lint` | no output, exit 0 |
| `npm run check:budgets` | `Dependency-budget check passed.` — twin `check:budgets:self-test` → `# pass 9` / `# fail 0` |
| `npm run check:spec-frontmatter` | `Spec-frontmatter check passed.` — twin `check:spec-frontmatter:self-test` → `# pass 11` / `# fail 0` |
| `npm run check:skill-drift` | `Skill-drift check passed — every embedded copy matches its source of truth.` — twin `check:skill-drift:self-test` → `# pass 29` / `# fail 0` |
| `python3 .claude/skills/publish-record/test_publish.py` | `Ran 73 tests` … `OK` |

`.github/workflows/ci.yml` is the only workflow and runs exactly these, in this order. It is **credential-free by
construction** — never add a `secrets.` reference or placeholder-credential `env:` block. `npm ci` before believing red.

## MCP configuration

Copy the tracked `.example` to the real path (gitignored — it holds your keys), or let `./scripts/setup.sh` do it. Install detail: [`docs/setup.md`](docs/setup.md).

| Tool | Tracked template | Real path |
|---|---|---|
| Claude Code CLI | `.mcp.json.example` | `.mcp.json` |
| Cursor IDE | `.cursor/mcp.json.example` | `.cursor/mcp.json` |
| VS Code / Copilot | `.vscode/mcp.json.example` | `.vscode/mcp.json` |
| Codex CLI | `.codex/config.toml.example` | `.codex/config.toml` |

## Where the detail lives

- [`docs/trust-and-evidence.md`](docs/trust-and-evidence.md) — **read before any change touching evidence-integrity
  claims, capture-method UI, or trust signalling.** It states what a signature on a record published by this codebase
  establishes and what it does not; such a change either confirms a claim it makes or falsifies one, and a falsified
  claim is fixed in the same change. Its measured `file:line` citations span three repos and can move without a fact moving.
- [`docs/architecture/open-questions.md`](docs/architecture/open-questions.md) — the registry of unresolved decisions.
- [`docs/skills/README.md`](docs/skills/README.md) — skill guidance is authored here and CI drift-checks the copies
  socrata-mcp-server embeds. [`docs/datasets.md`](docs/datasets.md) is the curated Socrata catalogue and
  [`docs/skills/data-commons.md`](docs/skills/data-commons.md) the DCID shapes.
- [`docs/publish-record.md`](docs/publish-record.md) — the `publish-record` skill end to end.

Path-scoped rules in `.claude/rules/` load on a matching file: architecture and ADR docs, skill docs, fixtures, examples.

## Rules

- **`git commit -s` on every commit.** The `Signed-off-by` email must be the exact author email.
  <!-- The DCO probot matches the trailer to the commit author literally. Live failure and fix on civic#156 and
       website#260 (2026-08-17); unmerged branches had to be amended and force-pushed. -->
- **Prove any install-path claim in a fresh `git clone`,** never an in-place `rm -rf node_modules`; npm 10.x runs
  workspace `prepare` even under `--ignore-scripts`, and `prepare` has consumers outside CI.
  <!-- civic#122: a failed install had already repopulated packages/*/dist, so the next in-place attempt passed on
       leftovers. Removing typedstandards' prepare fixed CI and broke the Vercel preview build that relied on it. -->
- **Never mint brand-role "evidence" on a new surface, and never "fix" a prior-era name.** Appendix J of the
  specification is canonical; prior-era routes, scopes, wire keys, and the exempt-frozen list are permanent.
  <!-- civic#160 (closed 2026-08-21): fixtures proving the fallback leg, exempt-frozen paths, and old-wire-key stubs
       are load-bearing — "fixing" one breaks the settlement's guarantees. -->
