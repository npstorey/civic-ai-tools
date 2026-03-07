# Sprint: Documentation Cleanup & Repo Rename

**Started:** 2026-03-07
**Status:** In progress

## Context

Improving documentation across three related repos for the civic AI tools project. Target audience is civic technologists, government workers, journalists, and students who may not be deeply technical. Also renaming `opengov-mcp-server` → `socrata-mcp-server` to better reflect what the server does and avoid confusion with the company OpenGov Inc.

## Three repos

1. **civic-ai-tools** — Starter project people fork/clone to get started
2. **socrata-mcp-server** (formerly opengov-mcp-server) — The MCP server itself
3. **civic-ai-tools-website** — Demo website at civicaitools.org

## Completed

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

### Releases
- [x] Dropped orphaned local release notes commit
- [x] Created GitHub Release for v0.2.0 (existing tag)
- [x] Tagged and released v0.3.0 (current HEAD)

### Research
- [x] Audited socrata-mcp-server repo structure and docs
- [x] Audited civic-ai-tools-website repo structure and docs
- [x] Researched Socrata's official `odp-mcp` server (socrata/odp-mcp)
- [x] Decided on rename: `opengov-mcp-server` → `socrata-mcp-server`
- [x] Strategic decision: pursue merge with Socrata (Option B), rename now regardless

### Repo Rename
- [x] Renamed GitHub repo `npstorey/opengov-mcp-server` → `npstorey/socrata-mcp-server`
- [x] Updated local git remote URL
- [x] Updated all references in civic-ai-tools (setup.sh, config examples, devcontainer scripts, docs, README, CLAUDE.md, AGENTS.md)
- [x] Updated socrata-mcp-server itself (package.json name/bin/URLs, src/index.ts server name, CONTRIBUTING.md)
- [x] Updated civic-ai-tools-website (README, CLAUDE.md, about page links, tools.ts comment)
- [x] Committed and pushed all three repos

---

## TODO: Coordinated Render/Vercel Rename (do together)

These changes affect the live deployment and should be done as one coordinated update:

- [x] Rename Render service to `socrata-mcp-server` (new URL: https://socrata-mcp-server.onrender.com)
- [x] Update Render repository link to `npstorey/socrata-mcp-server`
- [x] Update `OPENGOV_MCP_URL` value in Vercel to new Render URL
- [x] Verified live site still works at civicaitools.org
- [ ] Rename env var: `OPENGOV_MCP_URL` → `SOCRATA_MCP_URL` in Vercel dashboard (after code deploy)
- [x] Rename `opengovMcpTools` → `socrataMcpTools` in `src/lib/mcp/tools.ts`
- [x] Update imports in `src/app/api/compare-stream/route.ts` and `src/app/api/compare/route.ts`
- [x] Rename `src/lib/mcp/opengov-skill.ts` → `src/lib/mcp/socrata-skill.ts`
- [x] Rename `OPENGOV_SKILL` constant → `SOCRATA_SKILL`
- [x] Update imports in API routes
- [x] Update GitHub display links in `src/app/about/page.tsx` and `src/components/SkillPromptDisclosure.tsx`
- [x] Update `OPENGOV_MCP_URL` → `SOCRATA_MCP_URL` in `client.ts`, `README.md`, `CLAUDE.md`
- [ ] Deploy and verify

---

## TODO: Remaining Rename Housekeeping

- [x] Add note to top of `docs/opengov-skill.md` that this was formerly called "OpenGov MCP"
- [x] Rename local directory `/Users/nathanstorey/Code/opengov-mcp-server` → `socrata-mcp-server` (cosmetic, local only)

---

## TODO: MCP Server Inventory

- [x] Create `docs/mcp-servers.md` in civic-ai-tools
  - Table of known civic data MCP servers
  - Include: socrata-mcp-server (ours), socrata/odp-mcp (Socrata's official), any others found
  - Columns: Name, Data Source, Status, Transport, Notes
  - Mark which ones are included in civic-ai-tools setup vs. listed for reference
- [x] Link from README.md Documentation section

---

## TODO: Server Repo Documentation Cleanup (next session)

### socrata-mcp-server
- [x] Delete self-referential symlink (`opengov-mcp-server`)
- [x] Delete legacy `.eslintrc.json` (using `eslint.config.mjs`)
- [x] Delete `POLISH_SUMMARY.md` (stale artifact)
- [x] Delete `commands.md` (content folded into README)
- [x] Delete `docs/release-notes.md` (using GitHub Releases now)
- [x] Add `.env.example` (`.env` was already gitignored)
- [x] Rewrite README.md — add civic context, related projects section, audience framing
- [x] Trim stale debugging history from CLAUDE.md
- [x] Add CODE_OF_CONDUCT.md
- [x] Add `.github/` directory with issue templates
- [x] Add personal project disclaimer
- [ ] Remove tracked `dist/` files from git (18 files committed despite .gitignore; Render rebuilds on deploy)
- [ ] `server.log` was already gitignored (not tracked)

---

## TODO: Website Repo Documentation Cleanup (next session)

### civic-ai-tools-website
- [x] Add LICENSE file (MIT)
- [x] Add CONTRIBUTING.md
- [x] Add CODE_OF_CONDUCT.md
- [x] Move `project-plan.md` to `docs/`
- [x] Migrate `BACKLOG.md` to GitHub Issues (#8-#11)
- [x] Move `RETROSPECTIVE.md` to `docs/`
- [x] Add personal project disclaimer and contributing section to README
- [x] Add `.github/` directory with issue templates

---

## Future: Socrata Collaboration

- [ ] Draft outreach message to socrata/odp-mcp maintainers
- [ ] Propose collaboration/merge of MCP server projects
- [ ] Key value props: production deployment, civic-ai-tools packaging, skill docs, multi-client testing
