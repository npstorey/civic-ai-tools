#!/bin/bash
#
# Setup script for civic-ai-tools
# This script prepares your environment for using MCP servers with Cursor IDE or Claude Code CLI
#
# Usage:
#   ./scripts/setup.sh                                          # interactive
#   ./scripts/setup.sh --socrata-token TOKEN --dc-api-key KEY   # non-interactive (e.g. from Claude Code)
#

set -e

# Parse command-line arguments
ARG_SOCRATA_TOKEN=""
ARG_DC_KEY=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --socrata-token) ARG_SOCRATA_TOKEN="$2"; shift 2 ;;
        --dc-api-key)    ARG_DC_KEY="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_SERVERS_DIR="$PROJECT_DIR/.mcp-servers"

echo -e "${BLUE}"
echo "========================================"
echo "  Civic AI Tools - Setup Script"
echo "========================================"
echo -e "${NC}"

# Track errors
ERRORS=()

# Helper functions
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}[OK]${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}[MISSING]${NC} $1 is not installed"
        return 1
    fi
}

print_step() {
    echo -e "\n${BLUE}>>> $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ERRORS+=("$1")
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

PREREQ_OK=true

if ! check_command "node"; then
    print_error "Node.js is required. Install from https://nodejs.org/"
    PREREQ_OK=false
fi

if ! check_command "npm"; then
    print_error "npm is required. Install from https://nodejs.org/"
    PREREQ_OK=false
fi

if ! check_command "git"; then
    print_error "git is required."
    PREREQ_OK=false
fi

if ! check_command "python3"; then
    print_error "Python 3 is required."
    PREREQ_OK=false
else
    # Check Python version (need 3.11+)
    PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
    if [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 11 ]; then
        echo -e "${GREEN}[OK]${NC} Python version $PY_VERSION (3.11+ required for datacommons-mcp)"
    else
        print_warning "Python $PY_VERSION detected. datacommons-mcp requires Python 3.11+"
    fi
fi

if ! check_command "uv"; then
    echo "Installing uv (recommended Python package manager)..."
    if curl -LsSf https://astral.sh/uv/install.sh | sh 2>&1; then
        export PATH="$HOME/.local/bin:$PATH"
        print_success "uv installed"
    else
        print_warning "uv installation failed. You can install later: curl -LsSf https://astral.sh/uv/install.sh | sh"
    fi
fi

if [ "$PREREQ_OK" = false ]; then
    echo -e "\n${RED}Prerequisites missing. Please install them and re-run this script.${NC}"
    exit 1
fi

# Step 2: Set up socrata-mcp-server
print_step "Setting up Socrata MCP Server..."

mkdir -p "$MCP_SERVERS_DIR"

SOCRATA_DIR="$MCP_SERVERS_DIR/socrata-mcp-server"

if [ -d "$SOCRATA_DIR" ]; then
    echo -e "${GREEN}[OK]${NC} socrata-mcp-server already cloned"

    # Check if it needs to be built
    if [ ! -f "$SOCRATA_DIR/dist/index.js" ]; then
        print_step "Building socrata-mcp-server..."
        cd "$SOCRATA_DIR"
        npm install
        npm run build
        cd "$PROJECT_DIR"
        print_success "socrata-mcp-server built successfully"
    else
        echo -e "${GREEN}[OK]${NC} socrata-mcp-server is built"
    fi
else
    echo "Cloning socrata-mcp-server..."
    git clone https://github.com/npstorey/socrata-mcp-server.git "$SOCRATA_DIR"

    print_step "Building socrata-mcp-server..."
    cd "$SOCRATA_DIR"
    npm install
    npm run build
    cd "$PROJECT_DIR"
    print_success "socrata-mcp-server cloned and built successfully"
fi

# Step 3: Install datacommons-mcp
print_step "Installing datacommons-mcp..."

if command -v "datacommons-mcp" &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} datacommons-mcp already installed"
else
    if command -v "uv" &> /dev/null; then
        echo "Using uv to install datacommons-mcp..."
        uv tool install datacommons-mcp || {
            print_warning "uv tool install failed, trying pip..."
            pip3 install datacommons-mcp
        }
    else
        echo "Using pip to install datacommons-mcp..."
        pip3 install datacommons-mcp
    fi

    # Verify installation
    if command -v "datacommons-mcp" &> /dev/null; then
        print_success "datacommons-mcp installed successfully"
    else
        print_warning "datacommons-mcp command not found in PATH"
        echo "    You may need to add ~/.local/bin to your PATH"
        echo "    Or restart your terminal"
    fi
fi

# Step 4: Generate MCP configuration files
print_step "Setting up MCP configuration files..."

# Load API keys from .env if it exists
SOCRATA_TOKEN=""
DC_KEY=""
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "Loading API keys from .env file..."
    # Source the .env file to get variables
    set -a
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    set +a
    SOCRATA_TOKEN="${SOCRATA_APP_TOKEN:-}"
    DC_KEY="${DC_API_KEY:-}"
fi

# Apply any keys passed via command-line flags
[ -n "$ARG_SOCRATA_TOKEN" ] && SOCRATA_TOKEN="$ARG_SOCRATA_TOKEN"
[ -n "$ARG_DC_KEY" ] && DC_KEY="$ARG_DC_KEY"

# If keys are missing, either prompt interactively or report what's needed
if [ -z "$SOCRATA_TOKEN" ] || [ -z "$DC_KEY" ]; then

    if [ -t 0 ]; then
        # ── Interactive terminal: prompt the user directly ──
        echo ""
        echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
        echo -e "${YELLOW}  API keys not found!${NC}"
        echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
        echo ""
        echo "  The MCP servers work best with API keys (they increase rate limits)."
        echo "  Both keys are free to obtain. You can skip for now and add them later."
        echo ""
        echo "  You can paste your keys below, or if you prefer, edit .env directly:"
        echo "    cp .env.example .env   # (if .env doesn't exist yet)"
        echo "    nano .env              # (or open in any text editor)"
        echo ""

        if [ -z "$SOCRATA_TOKEN" ]; then
            echo -e "${BLUE}  NYC Open Data (Socrata) App Token${NC}"
            echo "    1. Go to: https://data.cityofnewyork.us/profile/edit/developer_settings"
            echo "    2. Create a free account (or sign in)"
            echo "    3. Click 'Create New App Token'"
            echo ""
            read -rsp "  Paste your Socrata App Token (or press Enter to skip): " SOCRATA_TOKEN
            echo ""  # newline after silent read
        fi

        if [ -z "$DC_KEY" ]; then
            echo -e "${BLUE}  Google Data Commons API Key${NC}"
            echo "    1. Go to: https://apikeys.datacommons.org/"
            echo "    2. Sign in with your Google account"
            echo "    3. Copy the API key provided"
            echo ""
            read -rsp "  Paste your Data Commons API Key (or press Enter to skip): " DC_KEY
            echo ""  # newline after silent read
        fi
    else
        # ── Non-interactive (e.g. Claude Code, CI): give clear next steps ──
        echo ""
        echo "ACTION REQUIRED: API keys are missing. Please provide them."
        echo ""
        echo "The MCP servers work best with API keys (they increase rate limits)."
        echo "Both are free. Here's where to get them:"
        echo ""
        if [ -z "$SOCRATA_TOKEN" ]; then
            echo "  1. NYC Open Data (Socrata) App Token"
            echo "     Sign up or log in, then create an app token at:"
            echo "     https://data.cityofnewyork.us/profile/edit/developer_settings"
            echo ""
        fi
        if [ -z "$DC_KEY" ]; then
            echo "  2. Google Data Commons API Key"
            echo "     Sign in with Google and copy your key at:"
            echo "     https://apikeys.datacommons.org/"
            echo ""
        fi
        echo "Once you have them, re-run setup with:"
        echo "  ./scripts/setup.sh --socrata-token YOUR_TOKEN --dc-api-key YOUR_KEY"
        echo ""
        echo "Or skip for now — the tools will still work with lower rate limits."
        echo ""
    fi
fi

# Save keys to .env if we have any
if [ -n "$SOCRATA_TOKEN" ] || [ -n "$DC_KEY" ]; then
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    fi
    if [ -n "$SOCRATA_TOKEN" ]; then
        sed -i.bak "s|^SOCRATA_APP_TOKEN=.*|SOCRATA_APP_TOKEN=$SOCRATA_TOKEN|" "$PROJECT_DIR/.env"
    fi
    if [ -n "$DC_KEY" ]; then
        sed -i.bak "s|^DC_API_KEY=.*|DC_API_KEY=$DC_KEY|" "$PROJECT_DIR/.env"
    fi
    rm -f "$PROJECT_DIR/.env.bak"
    print_success "API keys saved to .env"
fi

# Show .env help and privacy note (both modes)
if [ -z "$SOCRATA_TOKEN" ] || [ -z "$DC_KEY" ]; then
    echo -e "  ${YELLOW}About .env (hidden file):${NC}"
    echo "    Mac/Linux:  open in any text editor, or run: nano .env"
    echo "                To see hidden files in Finder, press Cmd+Shift+."
    echo "    Windows:    open in Notepad, or in File Explorer click"
    echo "                View > Show > Hidden items"
    echo ""
    echo -e "  ${YELLOW}Privacy note:${NC} AI coding tools (Claude Code, Cursor, Copilot) can"
    echo "  read .env when helping you. The keys here are low-risk (public data APIs"
    echo "  with rate limits), but if you prefer to keep them private:"
    echo ""
    echo "    Claude Code:  Add .env to .claude/settings.local.json:"
    echo "                  { \"permissions\": { \"deny\": [\"Read(.env)\"] } }"
    echo "    Cursor:       Add .env to your project's .cursorignore file"
    echo "    VS Code:      Add .env to .github/copilot-instructions.md:"
    echo "                  \"Do not read or reference .env files\""
    echo ""
fi

# Use placeholder if still no token
[ -z "$SOCRATA_TOKEN" ] && SOCRATA_TOKEN="YOUR_SOCRATA_TOKEN_HERE"
[ -z "$DC_KEY" ] && DC_KEY="YOUR_DC_API_KEY_HERE"

# Find datacommons-mcp path
DATACOMMONS_PATH=$(command -v datacommons-mcp 2>/dev/null || echo "datacommons-mcp")

# Determine if we should regenerate configs (if .env has real keys)
SHOULD_REGENERATE=false
if [ -f "$PROJECT_DIR/.env" ] && [ "$SOCRATA_TOKEN" != "YOUR_SOCRATA_TOKEN_HERE" ] || [ "$DC_KEY" != "YOUR_DC_API_KEY_HERE" ]; then
    SHOULD_REGENERATE=true
fi

# Generate Claude Code CLI config (.mcp.json)
if [ -f "$PROJECT_DIR/.mcp.json" ] && [ "$SHOULD_REGENERATE" = false ]; then
    echo -e "${GREEN}[OK]${NC} .mcp.json already exists (for Claude Code CLI)"
else
    if [ -f "$PROJECT_DIR/.mcp.json" ]; then
        echo "Updating .mcp.json with API keys from .env..."
    else
        echo "Creating .mcp.json for Claude Code CLI..."
    fi
    sed -e "s|__SOCRATA_APP_TOKEN__|$SOCRATA_TOKEN|g" \
        -e "s|__DC_API_KEY__|$DC_KEY|g" \
        -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
        "$PROJECT_DIR/.mcp.json.example" > "$PROJECT_DIR/.mcp.json"
    print_success "Created .mcp.json"
fi

# Generate Cursor IDE config (.cursor/mcp.json) - requires absolute paths
mkdir -p "$PROJECT_DIR/.cursor"
if [ -f "$PROJECT_DIR/.cursor/mcp.json" ] && [ "$SHOULD_REGENERATE" = false ]; then
    echo -e "${GREEN}[OK]${NC} .cursor/mcp.json already exists (for Cursor IDE)"
else
    if [ -f "$PROJECT_DIR/.cursor/mcp.json" ]; then
        echo "Updating .cursor/mcp.json with API keys from .env..."
    else
        echo "Creating .cursor/mcp.json for Cursor IDE (with absolute paths)..."
    fi
    sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__SOCRATA_APP_TOKEN__|$SOCRATA_TOKEN|g" \
        -e "s|__DC_API_KEY__|$DC_KEY|g" \
        -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
        "$PROJECT_DIR/.cursor/mcp.json.example" > "$PROJECT_DIR/.cursor/mcp.json"
    print_success "Created .cursor/mcp.json (with absolute paths)"
fi

# Generate VS Code + Copilot config (.vscode/mcp.json) - uses ${workspaceFolder} variable
if [ -f "$PROJECT_DIR/.vscode/mcp.json.example" ]; then
    mkdir -p "$PROJECT_DIR/.vscode"
    if [ -f "$PROJECT_DIR/.vscode/mcp.json" ] && [ "$SHOULD_REGENERATE" = false ]; then
        echo -e "${GREEN}[OK]${NC} .vscode/mcp.json already exists (for VS Code + Copilot)"
    else
        if [ -f "$PROJECT_DIR/.vscode/mcp.json" ]; then
            echo "Updating .vscode/mcp.json with API keys from .env..."
        else
            echo "Creating .vscode/mcp.json for VS Code + Copilot..."
        fi
        sed -e "s|__SOCRATA_APP_TOKEN__|$SOCRATA_TOKEN|g" \
            -e "s|__DC_API_KEY__|$DC_KEY|g" \
            -e "s|__DATACOMMONS_MCP_PATH__|$DATACOMMONS_PATH|g" \
            "$PROJECT_DIR/.vscode/mcp.json.example" > "$PROJECT_DIR/.vscode/mcp.json"
        print_success "Created .vscode/mcp.json"
    fi
fi

# Step 5: Verify API keys
print_step "Checking API keys..."

if [ "$SOCRATA_TOKEN" != "YOUR_SOCRATA_TOKEN_HERE" ]; then
    echo -e "${GREEN}[OK]${NC} Socrata App Token is configured"
else
    print_warning "Socrata App Token not set. OpenGov MCP will work but with lower rate limits."
fi

if [ "$DC_KEY" != "YOUR_DC_API_KEY_HERE" ]; then
    echo -e "${GREEN}[OK]${NC} Data Commons API Key is configured"
else
    print_warning "Data Commons API Key not set. Data Commons MCP may have limited functionality."
fi

# Summary
print_step "Setup Summary"

if [ ${#ERRORS[@]} -eq 0 ]; then
    echo -e "${GREEN}"
    echo "========================================"
    echo "  Setup completed successfully!"
    echo "========================================"
    echo -e "${NC}"
    echo ""
    echo "Project structure:"
    echo "  $PROJECT_DIR/"
    echo "  ├── .mcp-servers/socrata-mcp-server/  (cloned & built)"
    echo "  ├── .mcp.json                         (Claude Code config - auto-generated)"
    echo "  ├── .cursor/mcp.json                  (Cursor config - auto-generated)"
    echo "  └── .vscode/mcp.json                  (VS Code + Copilot config - auto-generated)"
    echo ""
    echo "Next steps:"
    echo ""
    if [ "$SOCRATA_TOKEN" = "YOUR_SOCRATA_TOKEN_HERE" ] || [ "$DC_KEY" = "YOUR_DC_API_KEY_HERE" ]; then
        echo "  1. Add your missing API keys (optional but recommended):"
        echo "     Edit .env with your API keys, then re-run: ./scripts/setup.sh"
        echo ""
    fi
    echo "  For VS Code / Codespaces (with GitHub Copilot):"
    echo "    1. Open the Command Palette (Ctrl+Shift+P)"
    echo "    2. Run: Developer: Reload Window"
    echo "    3. Open Copilot Chat and switch to Agent mode"
    echo "    4. MCP tools are available automatically"
    echo ""
    echo "  For Cursor IDE:"
    echo "    1. Open this folder in Cursor"
    echo "    2. MCP servers will load automatically"
    echo "    3. If servers don't appear, restart Cursor (Cmd+Q then reopen)"
    echo ""
    echo "  For Claude Code CLI:"
    echo "    1. Run: claude"
    echo "    2. Approve the MCP servers when prompted"
    echo "    3. Verify with: /mcp"
    echo ""
    echo "  Try asking:"
    echo "    \"What are the top 311 complaint types in NYC?\""
    echo ""
else
    echo -e "${YELLOW}"
    echo "========================================"
    echo "  Setup completed with warnings"
    echo "========================================"
    echo -e "${NC}"
    echo ""
    echo "Issues to resolve:"
    for err in "${ERRORS[@]}"; do
        echo "  - $err"
    done
    echo ""
fi
