#!/bin/bash
# OpenClaw Enterprise Setup Script
# Usage: ./setup.sh [--sap]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OPENCLAW_DIR="${HOME}/.openclaw"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   OpenClaw Enterprise Setup            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required but not installed.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}Error: Node.js 22+ is required (found v${NODE_VERSION}).${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check if OpenClaw is installed
if ! command -v openclaw &> /dev/null; then
    echo -e "${YELLOW}Installing OpenClaw...${NC}"
    npm install -g openclaw
fi

echo -e "${GREEN}✓ OpenClaw $(openclaw --version)${NC}"

# Create config directory if needed
mkdir -p "$OPENCLAW_DIR"

# Select configuration
if [ "$1" == "--sap" ]; then
    CONFIG_FILE="$PROJECT_DIR/configs/sap-config.yaml"
    echo -e "${YELLOW}Using SAP configuration${NC}"
else
    CONFIG_FILE="$PROJECT_DIR/configs/enterprise-config.yaml"
    echo -e "${YELLOW}Using enterprise configuration${NC}"
fi

# Backup existing config
if [ -f "$OPENCLAW_DIR/config.yaml" ]; then
    BACKUP_FILE="$OPENCLAW_DIR/config.yaml.backup.$(date +%Y%m%d%H%M%S)"
    cp "$OPENCLAW_DIR/config.yaml" "$BACKUP_FILE"
    echo -e "${YELLOW}Backed up existing config to: $BACKUP_FILE${NC}"
fi

# Copy configuration
cp "$CONFIG_FILE" "$OPENCLAW_DIR/config.yaml"
echo -e "${GREEN}✓ Configuration installed${NC}"

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo
    echo -e "${YELLOW}Note: ANTHROPIC_API_KEY not set.${NC}"
    echo -e "Run: ${GREEN}openclaw setup-token anthropic${NC}"
fi

# Create workspace directory
WORKSPACE="${HOME}/workspace"
if [ "$1" == "--sap" ]; then
    WORKSPACE="${HOME}/sap-workspace"
fi

mkdir -p "$WORKSPACE"
echo -e "${GREEN}✓ Workspace created: $WORKSPACE${NC}"

# Verify installation
echo
echo -e "${YELLOW}Verifying installation...${NC}"
if openclaw config validate &> /dev/null; then
    echo -e "${GREEN}✓ Configuration valid${NC}"
else
    echo -e "${RED}✗ Configuration validation failed${NC}"
    openclaw config validate
    exit 1
fi

echo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
echo "Next steps:"
echo "  1. Set up API token:    openclaw setup-token anthropic"
echo "  2. Start gateway:       openclaw gateway start"
echo "  3. Check status:        openclaw status"
echo
