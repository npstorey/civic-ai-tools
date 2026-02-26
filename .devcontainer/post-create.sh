#!/bin/bash
# Post-create setup for GitHub Codespaces
#
# This wrapper ensures the Codespace always becomes "ready" even if
# setup.sh encounters errors. Without this, any failure in the &&-chained
# postCreateCommand causes the Codespace to appear permanently stuck.

echo "=== Installing uv package manager ==="
curl -LsSf https://astral.sh/uv/install.sh | sh || {
    echo "WARNING: uv installation failed — continuing without it"
}

# Add uv to PATH for this session
export PATH="$HOME/.local/bin:$PATH"

echo ""
echo "=== Running project setup ==="

# Prevent git from hanging on credential prompts for cloned repos
export GIT_TERMINAL_PROMPT=0

if ./scripts/setup.sh; then
    echo ""
    echo "Setup completed successfully!"
else
    echo ""
    echo "============================================"
    echo "  Setup encountered errors (see above)."
    echo "  Your Codespace is still usable."
    echo "  Re-run to retry:  ./scripts/setup.sh"
    echo "============================================"
    echo ""
fi
