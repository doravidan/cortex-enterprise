#!/bin/bash
# Cortex Enterprise Health Check (Claude Code Relay)
# Usage: ./health-check.sh [--json]

GATEWAY_URL="${CORTEX_GATEWAY_URL:-http://localhost:18789}"

JSON_OUTPUT=false
if [ "$1" == "--json" ]; then
    JSON_OUTPUT=true
fi

check_gateway() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health" 2>/dev/null)
    if [ "$response" == "200" ]; then
        return 0
    else
        return 1
    fi
}

check_config() {
    if [ -f "${HOME}/.cortex/config.yaml" ]; then
        return 0
    else
        return 1
    fi
}

check_auth() {
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        return 0
    fi
    # Subscription auth is managed by Claude Code — check if CLI exists
    if command -v claude &> /dev/null; then
        return 0
    fi
    return 1
}

check_claude_cli() {
    if command -v claude &> /dev/null; then
        return 0
    else
        return 1
    fi
}

if [ "$JSON_OUTPUT" = true ]; then
    gateway_ok=$(check_gateway && echo "true" || echo "false")
    config_ok=$(check_config && echo "true" || echo "false")
    api_key_ok=$(check_auth && echo "true" || echo "false")
    claude_cli_ok=$(check_claude_cli && echo "true" || echo "false")
    
    overall="healthy"
    if [ "$gateway_ok" = "false" ] || [ "$config_ok" = "false" ]; then
        overall="unhealthy"
    fi
    
    cat <<EOF
{
  "status": "$overall",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "provider": "anthropic",
  "model": "claude-opus-4-6-20250219",
  "checks": {
    "gateway": $gateway_ok,
    "config": $config_ok,
    "auth": $api_key_ok,
    "claudeCli": $claude_cli_ok
  }
}
EOF
else
    echo "Cortex Enterprise Health Check"
    echo "==============================="
    echo "Provider: Anthropic (Claude Code only)"
    echo "Model:    Opus 4.6"
    echo
    
    printf "Gateway:      "
    if check_gateway; then echo "✓ Running"; else echo "✗ Not responding"; fi
    
    printf "Config:       "
    if check_config; then echo "✓ Present"; else echo "✗ Not found"; fi
    
    printf "Auth:         "
    if check_auth; then echo "✓ Authenticated"; else echo "✗ Not authenticated (run: claude login)"; fi
    
    printf "Claude CLI:   "
    if check_claude_cli; then echo "✓ Installed"; else echo "✗ Not found"; fi
    
    echo
fi
