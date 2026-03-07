#!/bin/bash
#
# Codespaces post-start script — runs every time the Codespace starts.
#
# This generates MCP config files using Codespaces Secrets (env vars),
# which are NOT available during prebuild but ARE available at runtime.
#

set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/workspaces/civic-ai-tools"
MCP_SERVERS_DIR="$PROJECT_DIR/.mcp-servers"
SOCRATA_DIR="$MCP_SERVERS_DIR/socrata-mcp-server"

echo -e "\n${BLUE}>>> Generating MCP configuration...${NC}"

# API keys come from (in priority order):
#   1. Codespaces Secrets (auto-injected as env vars)
#   2. .env file in the project
# If neither is set, Socrata works without a token (just rate-limited),
# and Data Commons is skipped entirely.

SOCRATA_TOKEN="${SOCRATA_APP_TOKEN:-}"
DC_KEY="${DC_API_KEY:-}"

# Fall back to .env file if Codespaces Secrets aren't set
if [ -z "$SOCRATA_TOKEN" ] || [ -z "$DC_KEY" ]; then
    if [ -f "$PROJECT_DIR/.env" ]; then
        echo "Loading API keys from .env..."
        set -a
        source "$PROJECT_DIR/.env" 2>/dev/null || true
        set +a
        [ -z "$SOCRATA_TOKEN" ] && SOCRATA_TOKEN="${SOCRATA_APP_TOKEN:-}"
        [ -z "$DC_KEY" ] && DC_KEY="${DC_API_KEY:-}"
    fi
fi

DATACOMMONS_PATH=$(command -v datacommons-mcp 2>/dev/null || echo "")

# Determine which servers to include
INCLUDE_SOCRATA=false
INCLUDE_DATACOMMONS=false

if [ -f "$SOCRATA_DIR/dist/index.js" ]; then
    INCLUDE_SOCRATA=true
else
    echo -e "${YELLOW}[SKIP]${NC} Socrata server not built — run ./scripts/setup.sh to fix"
fi

if [ -n "$DATACOMMONS_PATH" ] && [ -n "$DC_KEY" ]; then
    INCLUDE_DATACOMMONS=true
elif [ -z "$DATACOMMONS_PATH" ]; then
    echo -e "${YELLOW}[SKIP]${NC} datacommons-mcp not installed — excluding from MCP config"
elif [ -z "$DC_KEY" ]; then
    echo -e "${YELLOW}[SKIP]${NC} No DC_API_KEY found — excluding Data Commons from MCP config"
    echo -e "         Set it via Codespaces Secrets or .env to enable Data Commons"
fi

# Build .vscode/mcp.json dynamically
mkdir -p "$PROJECT_DIR/.vscode"
{
    echo '{'
    echo '  "servers": {'

    NEED_COMMA=false

    if $INCLUDE_SOCRATA; then
        $NEED_COMMA && echo ','
        echo '    "socrata": {'
        echo '      "type": "stdio",'
        echo '      "command": "node",'
        echo "      \"args\": [\"\${workspaceFolder}/.mcp-servers/socrata-mcp-server/dist/index.js\", \"--stdio\"],"
        echo '      "env": {'
        echo '        "DEFAULT_DOMAIN": "data.cityofnewyork.us",'
        if [ -n "$SOCRATA_TOKEN" ]; then
            echo "        \"SOCRATA_APP_TOKEN\": \"$SOCRATA_TOKEN\","
        fi
        echo '        "CACHE_ENABLED": "true",'
        echo '        "LOG_LEVEL": "info"'
        echo '      }'
        echo -n '    }'
        NEED_COMMA=true
    fi

    if $INCLUDE_DATACOMMONS; then
        $NEED_COMMA && echo ','
        echo '    "data-commons": {'
        echo '      "type": "stdio",'
        echo "      \"command\": \"$DATACOMMONS_PATH\","
        echo '      "args": ["serve", "--skip-api-key-validation", "stdio"],'
        echo '      "env": {'
        echo "        \"DC_API_KEY\": \"$DC_KEY\""
        echo '      }'
        echo -n '    }'
        NEED_COMMA=true
    fi

    echo ''
    echo '  }'
    echo '}'
} > "$PROJECT_DIR/.vscode/mcp.json"

# Generate .mcp.json (for Claude Code CLI, if used in Codespace)
{
    echo '{'
    echo '  "mcpServers": {'

    NEED_COMMA=false

    if $INCLUDE_SOCRATA; then
        $NEED_COMMA && echo ','
        echo '    "socrata": {'
        echo '      "type": "stdio",'
        echo '      "command": "node",'
        echo "      \"args\": [\".mcp-servers/socrata-mcp-server/dist/index.js\", \"--stdio\"],"
        echo '      "env": {'
        echo '        "DEFAULT_DOMAIN": "data.cityofnewyork.us",'
        if [ -n "$SOCRATA_TOKEN" ]; then
            echo "        \"SOCRATA_APP_TOKEN\": \"$SOCRATA_TOKEN\","
        fi
        echo '        "CACHE_ENABLED": "true",'
        echo '        "LOG_LEVEL": "info"'
        echo '      }'
        echo -n '    }'
        NEED_COMMA=true
    fi

    if $INCLUDE_DATACOMMONS; then
        $NEED_COMMA && echo ','
        echo '    "data-commons": {'
        echo '      "type": "stdio",'
        echo "      \"command\": \"$DATACOMMONS_PATH\","
        echo '      "args": ["serve", "--skip-api-key-validation", "stdio"],'
        echo '      "env": {'
        echo "        \"DC_API_KEY\": \"$DC_KEY\""
        echo '      }'
        echo -n '    }'
        NEED_COMMA=true
    fi

    echo ''
    echo '  }'
    echo '}'
} > "$PROJECT_DIR/.mcp.json"

if $INCLUDE_SOCRATA || $INCLUDE_DATACOMMONS; then
    echo -e "${GREEN}[OK]${NC} Created MCP config files"
    $INCLUDE_SOCRATA && echo -e "       ${GREEN}✓${NC} Socrata MCP (Socrata${SOCRATA_TOKEN:+ — API key set}${SOCRATA_TOKEN:- — no key, rate-limited})"
    $INCLUDE_DATACOMMONS && echo -e "       ${GREEN}✓${NC} Data Commons MCP"
else
    echo -e "${YELLOW}[WARN]${NC} No MCP servers available"
fi

if [ -z "$SOCRATA_TOKEN" ] && [ -z "$DC_KEY" ]; then
    echo ""
    echo -e "${YELLOW}API KEYS:${NC}"
    echo "  No API keys detected. Socrata works without a key (rate-limited)."
    echo "  For full access, set Codespaces Secrets in your repo settings:"
    echo "    → Settings → Secrets and variables → Codespaces"
    echo "    → Add SOCRATA_APP_TOKEN and/or DC_API_KEY"
    echo "    → Then rebuild the Codespace"
fi
