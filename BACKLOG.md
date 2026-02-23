# Backlog

Future decisions and potential improvements for this project.

---

## Current Priority: civic-ai-tools-website

**Status:** Next up (after fixing opengov-mcp edge cases)

**Goal:** Build a website that demonstrates the value of MCP servers for civic data queries.

📄 **Full project plan:** [docs/civic-ai-tools-website-project-plan.md](docs/civic-ai-tools-website-project-plan.md)

**Summary:**
- Side-by-side comparison: LLM alone vs LLM + MCP
- User selects model (same model used for both, fair comparison)
- Technical explainer + link to GitHub repo
- Rate limiting: 5 requests/day anonymous, 25/day with GitHub auth
- Stack: Next.js on Vercel, OpenRouter for LLM, opengov-mcp on Render

**Key finding:** opengov-mcp-server already supports HTTP transport via `/mcp` endpoint - no server changes needed for website integration.

---

## In Progress

### Fix opengov-mcp get_data Edge Cases

**Status:** In progress (separate repo)

**Issue 1: `type=metadata` fails**
- Error: "Query (expected as dataset_id) is required for type=metadata"
- The tool expects a `query` parameter instead of `dataset_id` for metadata lookups
- Fix needed in opengov-mcp-server source code

**Issue 2: `type=metrics` returns 404**
- Error: "API request failed: 404 - Not Found"
- The Socrata metrics endpoint may not exist or has a different URL
- Investigate whether this is a Socrata API limitation or implementation bug

---

## Blocked on Website Completion

The following items are deferred until civic-ai-tools-website is complete:

### Simplify opengov-mcp Installation (Publish to npm)

**Current state:** Users must clone and build opengov-mcp-server locally via the setup script.

**Goal:** Allow installation via `npx opengov-mcp-server` directly.

**Requires:** npm account, proper package.json metadata, publish workflow

### Add Codex CLI Support
- Add `~/.codex/config.toml` setup instructions for OpenAI Codex CLI
- Currently only supports Cursor IDE and Claude Code CLI

### Add Data Commons Skill
- Create `docs/datacommons-skill.md` companion skill
- Document common query patterns for other Socrata portals (Chicago, SF, etc.)

### Add Integration Tests
- Add integration tests that verify MCP servers respond correctly
- Could run as part of CI after setup

---

## Resolved

### civic-ai-tools Repository
**Decision:** Archive when ready. Renamed to `civic-ai-tools-old`. This project is now standalone.

---

## Notes

- Decision point created: 2026-01-08
- Project converted to standalone: 2026-01-08
- Website project added: 2026-01-14
