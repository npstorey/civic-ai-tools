#!/bin/bash
# Post-create setup for GitHub Codespaces
#
# Run this AFTER the codespace opens:  bash .devcontainer/post-create.sh
#
# Uses the lightweight base:ubuntu image, so Python and Node are installed here.
# Each step is independent with timeouts — no single step blocks readiness.
# For local development, use ./scripts/setup.sh instead.

set +e  # Do NOT exit on errors — every step is fault-tolerant
export GIT_TERMINAL_PROMPT=0  # Prevent git credential hangs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_SERVERS_DIR="$PROJECT_DIR/.mcp-servers"

step() { echo "" && echo "=== $1 ===" ; }
ok()   { echo "[OK] $1" ; }
warn() { echo "[WARN] $1" ; }

# -----------------------------------------------------------------
# 1. Install Python (if not present)
# -----------------------------------------------------------------
step "Checking Python"
if command -v python3 &>/dev/null; then
    ok "Python3 already installed: $(python3 --version)"
else
    echo "Installing Python3..."
    if sudo apt-get update -qq && sudo apt-get install -y -qq python3 python3-pip python3-venv 2>&1; then
        ok "Python3 installed"
    else
        warn "Python3 installation failed"
    fi
fi

# -----------------------------------------------------------------
# 2. Install Node.js (if not present)
# -----------------------------------------------------------------
step "Checking Node.js"
if command -v node &>/dev/null; then
    ok "Node.js already installed: $(node --version)"
else
    echo "Installing Node.js..."
    if curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 2>&1 && \
       sudo apt-get install -y -qq nodejs 2>&1; then
        ok "Node.js installed"
    else
        warn "Node.js installation failed"
    fi
fi

# -----------------------------------------------------------------
# 3. Install uv (fast — usually <10s)
# -----------------------------------------------------------------
step "Installing uv"
if command -v uv &>/dev/null; then
    ok "uv already installed"
else
    if timeout 60 bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh' 2>&1; then
        ok "uv installed"
    else
        warn "uv installation failed — you can install later: curl -LsSf https://astral.sh/uv/install.sh | sh"
    fi
fi
export PATH="$HOME/.local/bin:$PATH"

# -----------------------------------------------------------------
# 4. Clone and build opengov-mcp-server
# -----------------------------------------------------------------
step "Setting up OpenGov MCP server"
OPENGOV_DIR="$MCP_SERVERS_DIR/opengov-mcp-server"
mkdir -p "$MCP_SERVERS_DIR"

if [ -d "$OPENGOV_DIR" ] && [ -f "$OPENGOV_DIR/dist/index.js" ]; then
    ok "opengov-mcp-server already built"
else
    if [ ! -d "$OPENGOV_DIR" ]; then
        echo "Cloning opengov-mcp-server..."
        if ! timeout 120 git clone --depth 1 https://github.com/npstorey/opengov-mcp-server.git "$OPENGOV_DIR" 2>&1; then
            warn "git clone failed — you can retry with: git clone https://github.com/npstorey/opengov-mcp-server.git $OPENGOV_DIR"
        fi
    fi

    if [ -d "$OPENGOV_DIR" ]; then
        echo "Installing npm dependencies..."
        if ! timeout 180 bash -c "cd '$OPENGOV_DIR' && npm install --no-fund --no-audit 2>&1"; then
            warn "npm install failed"
        else
            echo "Building..."
            if ! timeout 60 bash -c "cd '$OPENGOV_DIR' && npm run build 2>&1"; then
                warn "npm run build failed"
            else
                ok "opengov-mcp-server built"
            fi
        fi
    fi
fi

# -----------------------------------------------------------------
# 5. Install datacommons-mcp
# -----------------------------------------------------------------
step "Installing datacommons-mcp"
if command -v datacommons-mcp &>/dev/null; then
    ok "datacommons-mcp already installed"
else
    INSTALLED=false
    if command -v uv &>/dev/null; then
        echo "Installing via uv..."
        if timeout 120 uv tool install datacommons-mcp 2>&1; then
            INSTALLED=true
            ok "datacommons-mcp installed via uv"
        else
            warn "uv tool install failed, trying pip..."
        fi
    fi
    if [ "$INSTALLED" = false ]; then
        if timeout 120 pip3 install --user datacommons-mcp 2>&1; then
            ok "datacommons-mcp installed via pip"
        else
            warn "datacommons-mcp installation failed — you can retry with: uv tool install datacommons-mcp"
        fi
    fi
fi

# -----------------------------------------------------------------
# 6. Generate MCP config files
# -----------------------------------------------------------------
step "Generating MCP configuration"
DATACOMMONS_PATH=$(command -v datacommons-mcp 2>/dev/null || echo "datacommons-mcp")

if [ -f "$PROJECT_DIR/.mcp.json.example" ] && [ ! -f "$PROJECT_DIR/.mcp.json" ]; then
    sed -e "s|__SOCRATA_APP_TOKEN__|YOUR_SOCRATA_TOKEN_HERE|g" \
        -e "s|__DC_API_KEY__|YOUR_DC_API_KEY_HERE|g" \
        -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
        "$PROJECT_DIR/.mcp.json.example" > "$PROJECT_DIR/.mcp.json" && \
    ok "Created .mcp.json" || warn "Failed to generate .mcp.json"
else
    ok ".mcp.json already exists"
fi

mkdir -p "$PROJECT_DIR/.cursor"
if [ -f "$PROJECT_DIR/.cursor/mcp.json.example" ] && [ ! -f "$PROJECT_DIR/.cursor/mcp.json" ]; then
    sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__SOCRATA_APP_TOKEN__|YOUR_SOCRATA_TOKEN_HERE|g" \
        -e "s|__DC_API_KEY__|YOUR_DC_API_KEY_HERE|g" \
        -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
        "$PROJECT_DIR/.cursor/mcp.json.example" > "$PROJECT_DIR/.cursor/mcp.json" && \
    ok "Created .cursor/mcp.json" || warn "Failed to generate .cursor/mcp.json"
else
    ok ".cursor/mcp.json already exists"
fi

# -----------------------------------------------------------------
# Done
# -----------------------------------------------------------------
step "Codespace setup complete"
echo ""
echo "Next steps:"
echo "  - Add API keys: cp .env.example .env && edit .env"
echo "  - Re-run full setup if needed: ./scripts/setup.sh"
echo "  - Try: uv run examples/real_data_analysis.py"
echo ""
