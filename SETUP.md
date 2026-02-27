# Setup Guide

This guide walks you through setting up the civic-ai-tools project to work with **Cursor IDE** or **Claude Code CLI**.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/npstorey/civic-ai-tools.git
cd civic-ai-tools

# 2. Set up your API keys (recommended)
cp .env.example .env
# Edit .env and add your API keys:
#   - SOCRATA_APP_TOKEN from https://data.cityofnewyork.us/profile/edit/developer_settings
#   - DC_API_KEY from https://apikeys.datacommons.org/

# 3. Run the setup script
./scripts/setup.sh
```

**Important:** Set up your `.env` file with API keys *before* running the setup script. The script reads your keys from `.env` and bakes them into the generated config files (`.mcp.json` and `.cursor/mcp.json`). Without this step, you'll get placeholder values and lower rate limits.

The setup script will:
1. Check prerequisites (Node.js, Python 3.11+, git)
2. Clone and build the OpenGov MCP server into `.mcp-servers/`
3. Install the `datacommons-mcp` Python package via uv
4. **Auto-generate MCP config files** (`.mcp.json` and `.cursor/mcp.json`)
   - Reads API keys from `.env` if present
   - Uses absolute paths for Cursor (required for reliability)

### Setup Script Details

Here's exactly what `scripts/setup.sh` does at each step:

#### Step 1: Check Prerequisites

Verifies these tools are installed on your system:
- **Node.js** and **npm** – required to build the OpenGov MCP server
- **git** – required to clone the MCP server repository
- **Python 3** – checks version and warns if below 3.11 (required by datacommons-mcp)
- **uv** – optional but recommended Python package manager (warns if missing but continues)

If any required tool (node, npm, git, python3) is missing, the script exits with an error.

#### Step 2: Set Up OpenGov MCP Server

1. Creates `.mcp-servers/` directory if it doesn't exist
2. Clones `https://github.com/npstorey/opengov-mcp-server.git` into `.mcp-servers/opengov-mcp-server/` (skips if already cloned)
3. Runs `npm install` to install Node.js dependencies
4. Runs `npm run build` to compile TypeScript to JavaScript in `dist/`

#### Step 3: Install datacommons-mcp

Installs the `datacommons-mcp` Python package globally:
- First attempts `uv tool install datacommons-mcp`
- Falls back to `pip3 install datacommons-mcp` if uv fails or isn't installed
- Verifies the `datacommons-mcp` command is available in PATH

#### Step 4: Generate MCP Configuration Files

1. Loads API keys from `.env` file if it exists (looks for `SOCRATA_APP_TOKEN` and `DC_API_KEY`)
2. Uses placeholder values if no `.env` found or keys are missing
3. Finds the installed `datacommons-mcp` executable path
4. Creates `.mcp.json` from `.mcp.json.example` template, substituting:
   - API tokens
   - Path to datacommons-mcp executable
5. Creates `.cursor/mcp.json` from `.cursor/mcp.json.example`, substituting:
   - API tokens
   - Path to datacommons-mcp executable
   - **Converts relative paths to absolute paths** (Cursor requires this)

#### Step 5: Verify Data Commons API Key

Checks if `DC_API_KEY` environment variable is set and warns if missing (Data Commons will still work but with lower rate limits).

#### Step 6: Print Summary

Displays what was created and provides next steps for using the MCP servers with Cursor or Claude Code CLI.

---

## Prerequisites

### Required

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runs opengov-mcp-server |
| npm | 8+ | Installs Node dependencies |
| Python | 3.11+ | Required by datacommons-mcp |
| git | any | Clones MCP server |

### Recommended

| Tool | Purpose |
|------|---------|
| [uv](https://github.com/astral-sh/uv) | Fast Python package manager |
| [Data Commons API Key](https://apikeys.datacommons.org/) | Higher rate limits |

Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Project Structure

After running setup:

```
civic-ai-tools/
├── .devcontainer/
│   └── devcontainer.json       # GitHub Codespaces / Dev Container config
├── .mcp-servers/
│   └── opengov-mcp-server/    # Cloned & built by setup script
├── .mcp.json                   # Claude Code CLI config (auto-generated, gitignored)
├── .mcp.json.example           # Template for Claude Code config
├── .cursor/
│   ├── mcp.json               # Cursor IDE config (auto-generated, gitignored)
│   └── mcp.json.example       # Template for Cursor config
├── .vscode/
│   ├── mcp.json               # VS Code + Copilot config (auto-generated, gitignored)
│   ├── mcp.json.example       # Template for VS Code config
│   └── mcp.json.city-proxy-example  # Template for city workers behind proxy
├── .env.example               # API keys template
├── .env                       # Your API keys (gitignored)
├── docs/
│   └── opengov-skill.md       # OpenGov query guidance
├── scripts/
│   ├── setup.sh               # Setup script
│   └── *.py                   # Demo scripts
└── CLAUDE.md                  # Claude Code instructions
```

**Note:** The `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, and `.env` files are gitignored because they contain API keys and machine-specific paths.

---

## Tool-Specific Setup

### GitHub Codespaces

The fastest way to get started — no local install needed.

1. Click the "Open in GitHub Codespaces" badge in the README (or go to **Code → Codespaces → New codespace**)
2. Wait for the container to build — `setup.sh` runs automatically via `devcontainer.json`
3. Once ready, open **Copilot Chat** (sidebar chat icon or `Ctrl+Shift+I`)
4. Switch to **Agent** mode (dropdown at the top of the chat panel)
5. Start querying — MCP tools are available

**Troubleshooting Copilot Chat in Codespaces:**

- **"Chat took too long to get ready"**: Open Command Palette (`Ctrl+Shift+P`) → "Developer: Reload Window". Wait 30 seconds for extensions to reconnect.
- **Still timing out after reload**: Check that you have a [GitHub Copilot](https://github.com/features/copilot) subscription (free tier works). Go to github.com → Settings → Copilot to verify.
- **MCP tools not showing**: Make sure you're in **Agent** mode (not "Ask" or "Edit" mode). The MCP servers only appear in Agent mode.
- **Setup didn't run**: Open the terminal and run `./scripts/setup.sh` manually.

### VS Code with GitHub Copilot

1. Run `./scripts/setup.sh` (auto-generates `.vscode/mcp.json`)
2. Reload VS Code (Ctrl+Shift+P → "Developer: Reload Window")
3. Open Copilot Chat and switch to **Agent** mode
4. MCP tools should be available — try asking about NYC data

### VS Code with GitHub Copilot (City Workers)

For NYC city employees behind the corporate proxy (`bcpxy.nycnet`):

1. **Build the OpenGov MCP server:**
   ```powershell
   cd .mcp-servers/opengov-mcp-server
   npm install
   npm install global-agent --save
   npm run build
   ```

2. **Copy the proxy wrapper:**
   ```powershell
   copy scripts\proxy-wrapper.js .mcp-servers\opengov-mcp-server\
   ```

3. **Copy and configure MCP settings:**
   ```powershell
   copy .vscode\mcp.json.city-proxy-example .vscode\mcp.json
   ```
   Edit `.vscode/mcp.json` and replace `YOUR_SOCRATA_TOKEN_HERE` with your token from [NYC Open Data](https://data.cityofnewyork.us/profile/edit/developer_settings).

4. **Reload VS Code** (Ctrl+Shift+P → "Developer: Reload Window")

5. MCP tools should now be available in GitHub Copilot Chat.

### Cursor IDE

1. Run `./scripts/setup.sh` (auto-generates `.cursor/mcp.json` with absolute paths)
2. Open this folder in Cursor
3. MCP servers should load automatically
4. If servers don't appear, fully quit Cursor (Cmd+Q) and reopen
5. Start asking questions about NYC data

### Claude Code CLI

1. Run `./scripts/setup.sh` (auto-generates `.mcp.json`)
2. Start Claude Code:
   ```bash
   claude
   ```
3. On first run, approve the MCP servers when prompted
4. Verify servers are connected:
   ```
   /mcp
   ```

---

## MCP Servers

### OpenGov MCP Server

Provides access to NYC Open Data portal (data.cityofnewyork.us) via Socrata API.

**Capabilities:**
- Query datasets using SoQL
- Dataset discovery and metadata retrieval
- Built-in caching and rate limiting

**Key Datasets:**
| Dataset | ID | Description |
|---------|-----|-------------|
| 311 Service Requests | `erm2-nwe9` | Citywide service complaints |
| Restaurant Inspections | `43nn-pn8j` | Health inspection grades |
| Housing Violations | `wvxf-dwi5` | Building code violations |
| NYC Schools | `s3k6-pzi2` | School directory |
| Traffic Accidents | `h9gi-nx95` | Motor vehicle collisions |

### Data Commons MCP

Provides access to Google Data Commons for statistical data.

**Capabilities:**
- Search geographic entities (cities, states, countries)
- Retrieve statistical data across variables
- Compare data across locations

**Key Entity DCIDs:**
| City | DCID |
|------|------|
| New York City | `geoId/3651000` |
| Los Angeles | `geoId/0644000` |
| Chicago | `geoId/1714000` |

---

## Example Queries

Once set up, try these natural language queries:

### NYC Open Data
- "What are the top 10 complaint types in NYC 311?"
- "Show me restaurant inspection grades by borough"
- "Analyze housing violation trends over the past year"

### Statistical Data
- "What's NYC's population?"
- "Compare median income in NYC, LA, and Chicago"

### Combined Analysis
- "What's the relationship between median income and housing violations?"

---

## Running Demo Scripts

```bash
# Interactive MCP capabilities demo
python scripts/mcp_demo.py

# Real data analysis example
python scripts/real_data_analysis.py
```

---

## API Keys Configuration

API keys are optional but recommended for higher rate limits. Configure them by creating a `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Edit with your API keys
nano .env  # or use your preferred editor
```

### Getting API Keys

| Service | Purpose | Get Key |
|---------|---------|---------|
| NYC Open Data (Socrata) | Higher rate limits for NYC data | [Get Token](https://data.cityofnewyork.us/profile/edit/developer_settings) |
| Google Data Commons | Higher rate limits for statistical data | [Get Key](https://apikeys.datacommons.org/) |

### .env File Format

```bash
# NYC Open Data - increases rate limits significantly
SOCRATA_APP_TOKEN=your_token_here

# Data Commons - recommended for statistical queries
DC_API_KEY=your_key_here
```

The MCP servers will automatically load these from the project root `.env` file.

---

## Security Note

### About These API Keys

The API keys used in this project are **low-risk, public data keys**:

| Key | What It Protects | Risk If Exposed |
|-----|------------------|-----------------|
| **Socrata App Token** | NYC Open Data (public data) | Low - only affects rate limits. No private data access, no billing. |
| **Data Commons API Key** | Google Data Commons (public data) | Low - only affects rate limits. No private data access, no billing. |

These keys exist primarily for **rate limiting and usage tracking**, not for protecting sensitive data or billing. The underlying data is publicly accessible.

### Best Practices

1. **Never commit keys to git** - The `.env` and generated config files are already gitignored
2. **Don't share your `.env` or config files** - Each user should generate their own
3. **AI assistants can see your keys** - When tools like Claude Code or Cursor read your config files, they see the contents including API keys. If you have training data sharing enabled, this content could theoretically be included.
4. **For sensitive keys, use different approaches** - If you ever work with keys that have billing implications or access private data (AWS, payment processors, etc.), use environment variables at the shell level or a secrets manager instead of baking them into config files.

### Why This Approach Is Acceptable Here

For public data APIs with no billing or private data risk, the current setup follows standard practices:
- Keys stored in gitignored files
- Templates committed without real keys
- Each user generates their own config locally

---

## Troubleshooting

### "MCP server not found" / "Cannot find module"

1. Run the setup script:
   ```bash
   ./scripts/setup.sh
   ```
2. Verify the server exists:
   ```bash
   ls .mcp-servers/opengov-mcp-server/dist/index.js
   ```

### "datacommons-mcp: command not found"

1. Install it:
   ```bash
   uv tool install datacommons-mcp
   ```
2. Add `~/.local/bin` to your PATH if needed
3. Re-run setup to update configs with the correct path:
   ```bash
   rm .mcp.json .cursor/mcp.json
   ./scripts/setup.sh
   ```

### Claude Code doesn't show MCP tools

1. Restart Claude Code session
2. Check `/mcp` for server status
3. Approve project-scoped servers if prompted

### Cursor doesn't load MCP servers

**Common issues and solutions:**

1. **Server shows "connected" but no tools appear:**
   - Fully quit Cursor (Cmd+Q on Mac, not just close window)
   - Reopen Cursor and the project

2. **"Cannot find module" error in logs:**
   - This usually means the path in `.cursor/mcp.json` is incorrect
   - The setup script generates absolute paths which work reliably
   - Re-run setup to regenerate:
     ```bash
     rm .cursor/mcp.json
     ./scripts/setup.sh
     ```

3. **Server connects then immediately disconnects:**
   - Check Cursor's MCP logs: Help → Toggle Developer Tools → Console
   - Look for path-related errors
   - Ensure you're using absolute paths (the setup script does this automatically)

4. **"Request timed out" errors:**
   - Fully quit and restart Cursor
   - If persists, clear Cursor's MCP cache:
     ```bash
     rm -rf ~/Library/Application\ Support/Cursor/User/globalStorage/mcp-*
     ```

**Why Cursor needs absolute paths:**

Unlike Claude Code CLI which runs from the project directory, Cursor's MCP client may resolve relative paths from a different working directory. Using absolute paths in `.cursor/mcp.json` ensures the MCP server is always found correctly. The setup script handles this automatically.

**Manually checking your Cursor config:**

Your `.cursor/mcp.json` should have paths like:
```json
{
  "args": ["/Users/yourname/path/to/civic-ai-tools/.mcp-servers/opengov-mcp-server/dist/index.js"]
}
```

NOT relative paths like:
```json
{
  "args": [".mcp-servers/opengov-mcp-server/dist/index.js"]
}
```

---

## Files Reference

| File | Purpose | Generated By |
|------|---------|--------------|
| `.devcontainer/devcontainer.json` | GitHub Codespaces / Dev Container config | Committed to repo |
| `.mcp.json.example` | MCP config template for Claude Code CLI | Committed to repo |
| `.mcp.json` | Your MCP config (gitignored) | `setup.sh` auto-generates |
| `.cursor/mcp.json.example` | MCP config template for Cursor IDE | Committed to repo |
| `.cursor/mcp.json` | Your Cursor MCP config with absolute paths (gitignored) | `setup.sh` auto-generates |
| `.vscode/mcp.json.example` | MCP config template for VS Code + Copilot | Committed to repo |
| `.vscode/mcp.json.city-proxy-example` | MCP config template for city workers behind proxy | Committed to repo |
| `.vscode/mcp.json` | Your VS Code MCP config (gitignored) | `setup.sh` auto-generates |
| `.env.example` | API keys template | Committed to repo |
| `.env` | Your API keys (gitignored) | Copy from `.env.example` |
| `scripts/setup.sh` | Automated setup script | Committed to repo |
| `scripts/proxy-wrapper.js` | Proxy bootstrap for city workers behind NTLM proxy | Committed to repo |
| `docs/opengov-skill.md` | Detailed OpenGov query guidance | Committed to repo |
| `CLAUDE.md` | Instructions for Claude Code | Committed to repo |
