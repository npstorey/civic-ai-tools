# Sprint: Documentation Cleanup & Repo Rename

**Started:** 2026-03-07
**Status:** In progress

## Context

Improving documentation across three related repos for the civic AI tools project. Target audience is civic technologists, government workers, journalists, and students who may not be deeply technical. Also renaming `opengov-mcp-server` → `socrata-mcp-server` to better reflect what the server does and avoid confusion with the company OpenGov Inc.

## Three repos

1. **civic-ai-tools** — Starter project people fork/clone to get started
2. **opengov-mcp-server** (renaming to **socrata-mcp-server**) — The MCP server itself
3. **civic-ai-tools-website** — Demo website at civicaitools.org

## Completed (this session)

### civic-ai-tools cleanup (Phase 1-3)
- [x] Expanded `.gitignore` with comprehensive patterns
- [x] Deleted root clutter: `analysis_results.json`, `requirements-dashboard.txt`, `visualizations/`, `BACKLOG.md`
- [x] Moved `docs/civic-ai-tools-website-project-plan.md` to `temp/` (local only)
- [x] Moved `dashboard_311_dec2025.py` → `examples/dashboard_311.py`
- [x] Moved `SETUP.md` → `docs/setup.md`
- [x] Migrated BACKLOG.md items to GitHub Issues #12-#16
- [x] Updated all cross-references (CLAUDE.md, AGENTS.md, README, examples/README)
- [x] Rewrote README.md — audience-first framing, MCP explainer, glossary, related projects, disclaimer
- [x] Added `CONTRIBUTING.md`
- [x] Added `CODE_OF_CONDUCT.md`
- [x] Added `.devcontainer/welcome.txt` terminal welcome message
- [x] Updated `post-create.sh` to install welcome message
- [x] Updated `devcontainer.json` with `openFiles` and Python extension
- [x] Committed and pushed to main

### opengov-mcp-server releases
- [x] Dropped orphaned local release notes commit
- [x] Created GitHub Release for v0.2.0 (existing tag)
- [x] Tagged and released v0.3.0 (current HEAD)

### Research
- [x] Audited opengov-mcp-server repo structure and docs
- [x] Audited civic-ai-tools-website repo structure and docs
- [x] Researched Socrata's official `odp-mcp` server (socrata/odp-mcp)
- [x] Decided on rename: `opengov-mcp-server` → `socrata-mcp-server`
- [x] Strategic decision: pursue merge with Socrata (Option B), rename now regardless

---

## TODO: Repo Rename

### 1. Rename GitHub repo
- [ ] Rename `npstorey/opengov-mcp-server` → `npstorey/socrata-mcp-server` via GitHub API
- [ ] Update local git remote URL

### 2. Update references in civic-ai-tools
- [ ] `scripts/setup.sh` — git clone URL, directory names
- [ ] `.mcp.json.example` — path references
- [ ] `.cursor/mcp.json.example` — path references
- [ ] `.vscode/mcp.json.example` — path references
- [ ] `.vscode/mcp.json.city-proxy-example` — path references
- [ ] `README.md` — repo links
- [ ] `CLAUDE.md` — repo links
- [ ] `AGENTS.md` — repo links, directory references
- [ ] `docs/setup.md` — repo links, directory references, troubleshooting paths
- [ ] `docs/opengov-skill.md` — check for repo references
- [ ] `.devcontainer/post-create.sh` — git clone URL, directory names
- [ ] `.devcontainer/post-start.sh` — directory names, config generation
- [ ] `.devcontainer/welcome.txt` — check for references
- [ ] `.gitignore` — check `.mcp-servers/` comment

### 3. Update references in socrata-mcp-server itself
- [ ] `package.json` — name field, repository URL
- [ ] `README.md` — any self-references
- [ ] `CLAUDE.md` — any self-references
- [ ] `CONTRIBUTING.md` — any self-references

### 4. Update references in civic-ai-tools-website
- [ ] `CLAUDE.md` — repo links
- [ ] `README.md` — related repos section
- [ ] `src/lib/mcp/client.ts` — check for hardcoded URLs (Render deployment)
- [ ] Any other source files referencing opengov-mcp-server

### 5. Commit and push all three repos

---

## TODO: MCP Server Inventory

- [ ] Create `docs/mcp-servers.md` in civic-ai-tools
  - Table of known civic data MCP servers
  - Include: socrata-mcp-server (ours), socrata/odp-mcp (Socrata's official), any others found
  - Columns: Name, Data Source, Status, Transport, Notes
  - Mark which ones are included in civic-ai-tools setup vs. listed for reference
- [ ] Link from README.md "What's included" section

---

## TODO: Server Repo Documentation Cleanup (next session)

### socrata-mcp-server
- [ ] Delete `server.log` from git tracking
- [ ] Delete self-referential symlink (`opengov-mcp-server`)
- [ ] Delete legacy `.eslintrc.json` (using `eslint.config.mjs`)
- [ ] Delete `POLISH_SUMMARY.md` (stale artifact)
- [ ] Move `commands.md` to `docs/`
- [ ] Consolidate/delete `RELEASE_NOTES.md` and `docs/release-notes.md` (using GitHub Releases now)
- [ ] Remove committed `.env` (use `.env.example` pattern)
- [ ] Rewrite README.md — add civic context, related projects section, audience framing
- [ ] Trim stale debugging history from CLAUDE.md
- [ ] Add CODE_OF_CONDUCT.md
- [ ] Add `.github/` directory with issue templates
- [ ] Expand `.gitignore` (add .DS_Store patterns for subdirs)
- [ ] Add personal project disclaimer

---

## TODO: Website Repo Documentation Cleanup (next session)

### civic-ai-tools-website
- [ ] Add LICENSE file (MIT)
- [ ] Add CONTRIBUTING.md
- [ ] Add CODE_OF_CONDUCT.md
- [ ] Move `project-plan.md` to `docs/` or `sprints/completed/`
- [ ] Migrate `BACKLOG.md` to GitHub Issues
- [ ] Move `RETROSPECTIVE.md` to `docs/`
- [ ] Rewrite README.md — expand with feature description, screenshots, related projects, disclaimer
- [ ] Add personal project disclaimer
- [ ] Add `.github/` directory with issue templates

---

## Future: Socrata Collaboration

- [ ] Draft outreach message to socrata/odp-mcp maintainers
- [ ] Propose collaboration/merge of MCP server projects
- [ ] Key value props: production deployment, civic-ai-tools packaging, skill docs, multi-client testing
