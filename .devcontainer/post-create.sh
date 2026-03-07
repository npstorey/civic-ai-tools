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
SOCRATA_DIR="$MCP_SERVERS_DIR/socrata-mcp-server"

# Prevent git from prompting for credentials (hangs in Codespaces)
export GIT_TERMINAL_PROMPT=0

echo -e "${BLUE}"
echo "========================================"
echo "  Civic AI Tools - Codespace Setup"
echo "========================================"
echo -e "${NC}"

WARNINGS=()

# ──────────────────────────────────────────
# Step 1: Clone Socrata MCP server
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 1/3: Cloning Socrata MCP server...${NC}"

mkdir -p "$MCP_SERVERS_DIR"

if [ -d "$SOCRATA_DIR/.git" ]; then
    echo -e "${GREEN}[OK]${NC} Already cloned"
else
    if timeout --kill-after=10 90 git clone --depth 1 https://github.com/npstorey/socrata-mcp-server.git "$SOCRATA_DIR" 2>&1; then
        echo -e "${GREEN}[OK]${NC} Cloned successfully"
    else
        echo -e "${RED}[FAIL]${NC} git clone failed (network issue?)"
        WARNINGS+=("Socrata MCP server failed to clone — run ./scripts/setup.sh to retry")
    fi
fi

# ──────────────────────────────────────────
# Step 2: Build Socrata MCP server
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 2/3: Building Socrata MCP server...${NC}"

if [ -d "$SOCRATA_DIR" ]; then
    cd "$SOCRATA_DIR"

    if timeout --kill-after=10 120 npm install --no-fund --no-audit 2>&1; then
        echo -e "${GREEN}[OK]${NC} npm install succeeded"
    else
        echo -e "${RED}[FAIL]${NC} npm install failed"
        WARNINGS+=("npm install failed for Socrata MCP — run ./scripts/setup.sh to retry")
    fi

    if [ -f "$SOCRATA_DIR/node_modules/.package-lock.json" ]; then
        if timeout --kill-after=10 60 npm run build 2>&1; then
            echo -e "${GREEN}[OK]${NC} Build succeeded"
        else
            echo -e "${RED}[FAIL]${NC} npm run build failed"
            WARNINGS+=("Socrata MCP build failed — run ./scripts/setup.sh to retry")
        fi
    fi

    cd "$PROJECT_DIR"
else
    echo -e "${YELLOW}[SKIP]${NC} Socrata directory not found (clone failed earlier)"
fi

# ──────────────────────────────────────────
# Step 3: Install datacommons-mcp
# ──────────────────────────────────────────
echo -e "\n${BLUE}>>> Step 3/3: Installing datacommons-mcp...${NC}"

if command -v datacommons-mcp &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Already installed"
else
    if command -v uv &>/dev/null; then
        if timeout --kill-after=10 90 uv tool install datacommons-mcp 2>&1; then
            echo -e "${GREEN}[OK]${NC} Installed via uv"
        else
            echo -e "${YELLOW}[WARN]${NC} uv install failed, trying pip..."
            if timeout --kill-after=10 90 pip3 install datacommons-mcp 2>&1; then
                echo -e "${GREEN}[OK]${NC} Installed via pip"
            else
                echo -e "${RED}[FAIL]${NC} datacommons-mcp installation failed"
                WARNINGS+=("datacommons-mcp failed to install — run ./scripts/setup.sh to retry")
            fi
        fi
    else
        if timeout --kill-after=10 90 pip3 install datacommons-mcp 2>&1; then
            echo -e "${GREEN}[OK]${NC} Installed via pip"
        else
            echo -e "${RED}[FAIL]${NC} datacommons-mcp installation failed"
            WARNINGS+=("datacommons-mcp failed to install — run ./scripts/setup.sh to retry")
        fi
    fi
fi

# ──────────────────────────────────────────
# Set welcome message for Codespaces first-run notice
# ──────────────────────────────────────────
if [ -f "$PROJECT_DIR/.devcontainer/welcome.txt" ]; then
    sudo cp "$PROJECT_DIR/.devcontainer/welcome.txt" \
        /usr/local/etc/vscode-dev-containers/first-run-notice.txt 2>/dev/null || true
    if [ -d /workspaces/.codespaces/shared ]; then
        sudo cp "$PROJECT_DIR/.devcontainer/welcome.txt" \
            /workspaces/.codespaces/shared/first-run-notice.txt 2>/dev/null || true
    fi
fi

# ──────────────────────────────────────────
# Note: MCP config generation happens in post-start.sh
# (Codespaces Secrets aren't available during prebuild,
#  so configs must be generated at runtime.)
# ──────────────────────────────────────────

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
