#!/bin/bash
#
# Codespaces post-create setup script (fault-tolerant)
#
# Unlike scripts/setup.sh (which uses set -e for local dev), this script
# uses set +e so that a single failure (network blip, npm timeout) doesn't
# prevent the Codespace from opening. Each step has a timeout wrapper.
#

set +e  # Continue on errors — the Codespace must always open

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/workspaces/civic-ai-tools"
MCP_SERVERS_DIR="$PROJECT_DIR/.mcp-servers"
OPENGOV_DIR="$MCP_SERVERS_DIR/opengov-mcp-server"

# Prevent git from prompting for credentials (hangs in Codespaces)
export GIT_TERMINAL_PROMPT=0

echo -e "${BLUE}"
echo "========================================"
echo "  Civic AI Tools - Codespace Setup"
echo "========================================"
echo -e "${NC}"

WARNINGS=()

# ──────────────────────────────────────────
# Step 1: Clone OpenGov MCP server
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 1/4: Cloning OpenGov MCP server...${NC}"

mkdir -p "$MCP_SERVERS_DIR"

if [ -d "$OPENGOV_DIR/.git" ]; then
    echo -e "${GREEN}[OK]${NC} Already cloned"
else
    if timeout 120 git clone --depth 1 https://github.com/npstorey/opengov-mcp-server.git "$OPENGOV_DIR" 2>&1; then
        echo -e "${GREEN}[OK]${NC} Cloned successfully"
    else
        echo -e "${RED}[FAIL]${NC} git clone failed (network issue?)"
        WARNINGS+=("OpenGov MCP server failed to clone — run ./scripts/setup.sh to retry")
    fi
fi

# ──────────────────────────────────────────
# Step 2: Build OpenGov MCP server
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 2/4: Building OpenGov MCP server...${NC}"

if [ -d "$OPENGOV_DIR" ]; then
    cd "$OPENGOV_DIR"

    if timeout 180 npm install --no-fund --no-audit 2>&1; then
        echo -e "${GREEN}[OK]${NC} npm install succeeded"
    else
        echo -e "${RED}[FAIL]${NC} npm install failed"
        WARNINGS+=("npm install failed for OpenGov MCP — run ./scripts/setup.sh to retry")
    fi

    if [ -f "$OPENGOV_DIR/node_modules/.package-lock.json" ]; then
        if timeout 60 npm run build 2>&1; then
            echo -e "${GREEN}[OK]${NC} Build succeeded"
        else
            echo -e "${RED}[FAIL]${NC} npm run build failed"
            WARNINGS+=("OpenGov MCP build failed — run ./scripts/setup.sh to retry")
        fi
    fi

    cd "$PROJECT_DIR"
else
    echo -e "${YELLOW}[SKIP]${NC} OpenGov directory not found (clone failed earlier)"
fi

# ──────────────────────────────────────────
# Step 3: Install datacommons-mcp
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 3/4: Installing datacommons-mcp...${NC}"

if command -v datacommons-mcp &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Already installed"
else
    if command -v uv &>/dev/null; then
        if timeout 120 uv tool install datacommons-mcp 2>&1; then
            echo -e "${GREEN}[OK]${NC} Installed via uv"
        else
            echo -e "${YELLOW}[WARN]${NC} uv install failed, trying pip..."
            if timeout 120 pip3 install datacommons-mcp 2>&1; then
                echo -e "${GREEN}[OK]${NC} Installed via pip"
            else
                echo -e "${RED}[FAIL]${NC} datacommons-mcp installation failed"
                WARNINGS+=("datacommons-mcp failed to install — run ./scripts/setup.sh to retry")
            fi
        fi
    else
        if timeout 120 pip3 install datacommons-mcp 2>&1; then
            echo -e "${GREEN}[OK]${NC} Installed via pip"
        else
            echo -e "${RED}[FAIL]${NC} datacommons-mcp installation failed"
            WARNINGS+=("datacommons-mcp failed to install — run ./scripts/setup.sh to retry")
        fi
    fi
fi

# ──────────────────────────────────────────
# Step 4: Generate MCP config files
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 4/4: Generating MCP configuration...${NC}"

# Load API keys from .env if it exists
SOCRATA_TOKEN=""
DC_KEY=""
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "Loading API keys from .env..."
    set -a
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    set +a
    SOCRATA_TOKEN="${SOCRATA_APP_TOKEN:-}"
    DC_KEY="${DC_API_KEY:-}"
fi

[ -z "$SOCRATA_TOKEN" ] && SOCRATA_TOKEN="YOUR_SOCRATA_TOKEN_HERE"
[ -z "$DC_KEY" ] && DC_KEY="YOUR_DC_API_KEY_HERE"

DATACOMMONS_PATH=$(command -v datacommons-mcp 2>/dev/null || echo "datacommons-mcp")

# Generate .vscode/mcp.json (primary config for Codespaces)
if [ -f "$PROJECT_DIR/.vscode/mcp.json.example" ]; then
    mkdir -p "$PROJECT_DIR/.vscode"
    sed -e "s|__SOCRATA_APP_TOKEN__|$SOCRATA_TOKEN|g" \
        -e "s|__DC_API_KEY__|$DC_KEY|g" \
        -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
        "$PROJECT_DIR/.vscode/mcp.json.example" > "$PROJECT_DIR/.vscode/mcp.json"
    echo -e "${GREEN}[OK]${NC} Created .vscode/mcp.json"
fi

# Generate .mcp.json (for Claude Code CLI, if used in Codespace)
if [ -f "$PROJECT_DIR/.mcp.json.example" ]; then
    sed -e "s|__SOCRATA_APP_TOKEN__|$SOCRATA_TOKEN|g" \
        -e "s|__DC_API_KEY__|$DC_KEY|g" \
        -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
        "$PROJECT_DIR/.mcp.json.example" > "$PROJECT_DIR/.mcp.json"
    echo -e "${GREEN}[OK]${NC} Created .mcp.json"
fi

# ──────────────────────────────────────────
# Done — print summary
# ──────────────────────────────────────────
echo ""
echo -e "${BLUE}========================================${NC}"

if [ ${#WARNINGS[@]} -eq 0 ]; then
    echo -e "${GREEN}  Setup completed successfully!${NC}"
else
    echo -e "${YELLOW}  Setup completed with warnings${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    for warn in "${WARNINGS[@]}"; do
        echo -e "  ${YELLOW}⚠${NC}  $warn"
    done
fi

echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}NEXT STEPS:${NC}"
echo ""
echo "  1. Open Copilot Chat (sidebar chat icon or Ctrl+Shift+I)"
echo "  2. Switch to Agent mode (dropdown at the top of chat)"
echo "  3. Ask a question like: \"What are the top 311 complaint types in NYC?\""
echo ""
echo -e "${YELLOW}TROUBLESHOOTING:${NC}"
echo ""
echo "  • \"Language model unavailable\" or Copilot not loading?"
echo "    → Ctrl+Shift+P → \"Developer: Reload Window\" (this is normal on first load)"
echo ""
echo "  • MCP tools not showing in chat?"
echo "    → Make sure you're in Agent mode, not Ask or Edit mode"
echo ""
echo "  • Setup failed partially?"
echo "    → Run: ./scripts/setup.sh"
echo ""
