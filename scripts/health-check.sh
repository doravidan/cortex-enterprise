#!/bin/bash
# OpenClaw Enterprise Health Check
# Usage: ./health-check.sh [--json]

GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-http://localhost:18789}"

# Output format
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

check_api_keys() {
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        return 0
    elif openclaw auth status 2>/dev/null | grep -q "anthropic.*active"; then
        return 0
    else
        return 1
    fi
}

check_config() {
    if openclaw config validate &> /dev/null; then
        return 0
    else
        return 1
    fi
}

if [ "$JSON_OUTPUT" = true ]; then
    # JSON output for monitoring systems
    gateway_ok=$(check_gateway && echo "true" || echo "false")
    api_ok=$(check_api_keys && echo "true" || echo "false")
    config_ok=$(check_config && echo "true" || echo "false")
    
    overall="healthy"
    if [ "$gateway_ok" = "false" ] || [ "$api_ok" = "false" ] || [ "$config_ok" = "false" ]; then
        overall="unhealthy"
    fi
    
    cat <<EOF
{
  "status": "$overall",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "checks": {
    "gateway": $gateway_ok,
    "api_keys": $api_ok,
    "config": $config_ok
  }
}
EOF
else
    # Human-readable output
    echo "OpenClaw Enterprise Health Check"
    echo "================================"
    echo
    
    printf "Gateway:    "
    if check_gateway; then
        echo "✓ Running"
    else
        echo "✗ Not responding"
    fi
    
    printf "API Keys:   "
    if check_api_keys; then
        echo "✓ Configured"
    else
        echo "✗ Not configured"
    fi
    
    printf "Config:     "
    if check_config; then
        echo "✓ Valid"
    else
        echo "✗ Invalid"
    fi
    
    echo
fi
