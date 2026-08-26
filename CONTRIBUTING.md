# Contributing to Civic AI Tools

Thank you for your interest in contributing! This project aims to make public data more accessible through AI, and there are many ways to help — technical and non-technical.

## Ways to contribute

### No coding required

- **Report data issues** — If a query returns unexpected results or a dataset link is broken, [open an issue](https://github.com/npstorey/civic-ai-tools/issues/new)
- **Suggest MCP servers or data tools** — Know an MCP server or data tool that would be useful here? Let us know
- **Improve documentation** — Typos, unclear instructions, or missing steps are all fair game
- **Test the setup** — Try the Codespaces or local setup and report what worked or didn't

### Code contributions

- **Add example scripts** — New analyses or dashboards in `examples/`
- **Fix bugs** — Check [open issues](https://github.com/npstorey/civic-ai-tools/issues) for things to work on
- **Improve MCP server support** — Help with new IDE integrations or server configuration

## Getting started

1. Fork the repo and clone your fork
2. Follow the [setup guide](docs/setup.md)
3. Create a branch for your changes
4. Submit a pull request

## If you use Claude Code

Cloning this repo installs its checked-in Claude Code configuration: `.claude/settings.json` (a network
allowlist and a sandbox block — no hooks in this repo today), the agent definitions in `.claude/agents/`
(`impl` for one sprint phase, `cold-read` for a fresh-context review), the path-scoped rules in
`.claude/rules/`, and the `publish-record` skill in `.claude/skills/`. `AGENTS.md` is the instruction file
— Cursor and Codex read it natively, and `CLAUDE.md` is a one-line bridge to it, so all three tools get
the same guidance.

Those files are ordinary JSON and Markdown — read them before you trust them, the same as any other code
you clone. Personal overrides belong in `.claude/settings.local.json`, which is gitignored.

## Guidelines

- Keep changes focused — one fix or feature per PR
- Test your changes before submitting
- Update documentation if your change affects setup or usage
- Be respectful in issues and pull requests

## Commits, signing, and how we merge

This is the project-wide policy. The other three repositories point here rather than restating it.

This project is *about* provenance — signing, attestation, and records that survive inspection. Its own
git history is held to the same standard, which makes a few things about commits matter more here than
they do in most repositories. None of it is onerous, and we would rather help you at review time than
turn any of it into a barrier.

### Sign off every commit — required

Commit with `git commit -s`, which appends a `Signed-off-by: Your Name <email>` line. This is a
Developer Certificate of Origin 1.1 sign-off; what it certifies is in [IPR.md](IPR.md). It is enforced
by a required `DCO` status check, so a pull request with unsigned-off commits cannot merge.

If you forget, `git rebase --signoff main` adds it to every commit on your branch at once — easier than
amending them one at a time.

### Sign your commits — encouraged, not required

Configure git to sign with SSH or GPG and register the public key on your GitHub account. No branch
currently *requires* signed commits, and we have deliberately not turned that on
([Q74](docs/architecture/open-questions.md#q74--should-the-default-branches-require-signed-commits)
records why). But a signed commit is the thing this project spends its time arguing that people should
be able to verify, and because we never squash or rebase your work, your signature is what stays on
`main`.

### Rebase into atomic commits before you request review

Each commit should be one coherent change that builds and passes tests on its own. Squash your
work-in-progress checkpoints together locally — `git rebase -i`, or `git commit --fixup` plus
`git rebase --autosquash` — before asking for review.

This matters more here than in most projects because **we do not squash at merge time**, so your branch
lands on `main` exactly as you shaped it. It is also what keeps `git bisect` useful: bisect walks
individual commits, so a branch whose every commit builds stays bisectable and a branch of
half-finished checkpoints does not.

### We merge with merge commits — never squash, never rebase

Squash and rebase merges rewrite commits, so what lands on `main` is a new object: your signature is
replaced by GitHub's and your per-commit sign-offs collapse into a single commit body. A merge commit is
the only method that leaves your commits on `main` as the objects you actually made and signed.

Squash and rebase merge are disabled across all six repositories, at both the repository-settings and
branch-ruleset layers. The full reasoning, the alternatives weighed, and the costs we accepted are in
[ADR-0027](docs/adr/0027-merge-commit-only-vcs-policy.md).

To read `main` as one entry per merged pull request, use `git log --first-parent`.

## Legal: licenses and patents

- The sign-off above is the inbound IPR instrument; the full policy is [IPR.md](IPR.md), adopted per [ADR-0017](docs/adr/0017-ipr-posture-dco-rf-statement.md).
- Contributions that add or change **normative Typed Standards Specification text** additionally carry the royalty-free patent terms in [PATENTS.md](PATENTS.md) § Contributions.
- Copyright licenses are recorded in [LICENSING.md](LICENSING.md) (MIT code, CC BY 4.0 spec).

## This is a multi-repo project

Civic AI Tools spans four repositories. If you're unsure where to file an issue or contribute, start here — this is the main entry point.

| Repo | What it covers | Issues |
|------|---------------|--------|
| **[civic-ai-tools](https://github.com/npstorey/civic-ai-tools)** (this repo) | Setup, MCP configs, skill docs, examples, the Typed Standards Specification | [Issues](https://github.com/npstorey/civic-ai-tools/issues) |
| **[socrata-mcp-server](https://github.com/npstorey/socrata-mcp-server)** | The Socrata MCP server itself | [Issues](https://github.com/npstorey/socrata-mcp-server/issues) |
| **[civic-ai-tools-website](https://github.com/npstorey/civic-ai-tools-website)** | Demo website at civicaitools.org | [Issues](https://github.com/npstorey/civic-ai-tools-website/issues) |
| **[typedstandards](https://github.com/npstorey/typedstandards)** | typedstandards.org site + `@typedstandards/verify-core` + `@typedstandards/produce-core` | [Issues](https://github.com/npstorey/typedstandards/issues) |

Not sure which repo? Open an issue here and we'll route it.

## Questions?

Open an issue with your question — there are no bad questions here.
