#!/bin/bash
# Cortex Enterprise Health Check
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

if [ "$JSON_OUTPUT" = true ]; then
    gateway_ok=$(check_gateway && echo "true" || echo "false")
    config_ok=$(check_config && echo "true" || echo "false")
    
    overall="healthy"
    if [ "$gateway_ok" = "false" ] || [ "$config_ok" = "false" ]; then
        overall="unhealthy"
    fi
    
    cat <<EOF
{
  "status": "$overall",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "checks": {
    "gateway": $gateway_ok,
    "config": $config_ok
  }
}
EOF
else
    echo "Cortex Enterprise Health Check"
    echo "==============================="
    echo
    
    printf "Gateway:    "
    if check_gateway; then
        echo "✓ Running"
    else
        echo "✗ Not responding"
    fi
    
    printf "Config:     "
    if check_config; then
        echo "✓ Present"
    else
        echo "✗ Not found"
    fi
    
    echo
fi
