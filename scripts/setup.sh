#!/bin/bash
# Cortex Enterprise Setup Script (Claude Code Only)
# Usage: ./setup.sh [--sap]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="${HOME}/.cortex"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Cortex Enterprise Setup            ║${NC}"
echo -e "${BLUE}║     Claude Code + Opus 4.6             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo

# ── Prerequisites ───────────────────────────────────────────────────
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Node.js 22+
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

# Claude Code CLI
if command -v claude &> /dev/null; then
    echo -e "${GREEN}✓ Claude Code CLI found${NC}"
else
    echo -e "${YELLOW}⚠ Claude Code CLI not found.${NC}"
    echo -e "${YELLOW}  Install it:  npm install -g @anthropic-ai/claude-code${NC}"
fi

# Authentication
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "${GREEN}✓ Auth: API key (ANTHROPIC_API_KEY)${NC}"
else
    echo -e "${GREEN}✓ Auth: Anthropic subscription (managed by Claude Code)${NC}"
fi

# ── Configuration ───────────────────────────────────────────────────
mkdir -p "$CONFIG_DIR"

if [ "$1" == "--sap" ]; then
    CONFIG_FILE="$PROJECT_DIR/configs/sap-config.yaml"
    WORKSPACE="${HOME}/sap-workspace"
    echo -e "${YELLOW}Using SAP configuration (CAP / HANA / BTP teams)${NC}"
else
    CONFIG_FILE="$PROJECT_DIR/configs/enterprise-config.yaml"
    WORKSPACE="${HOME}/workspace"
    echo -e "${YELLOW}Using enterprise configuration (all teams)${NC}"
fi

# Backup existing config
if [ -f "$CONFIG_DIR/config.yaml" ]; then
    BACKUP_FILE="$CONFIG_DIR/config.yaml.backup.$(date +%Y%m%d%H%M%S)"
    cp "$CONFIG_DIR/config.yaml" "$BACKUP_FILE"
    echo -e "${YELLOW}Backed up existing config to: $BACKUP_FILE${NC}"
fi

cp "$CONFIG_FILE" "$CONFIG_DIR/config.yaml"
echo -e "${GREEN}✓ Configuration installed${NC}"

# Workspace
mkdir -p "$WORKSPACE"
echo -e "${GREEN}✓ Workspace created: $WORKSPACE${NC}"

# Skills directory
SKILLS_DIR="$WORKSPACE/skills"
mkdir -p "$SKILLS_DIR"
echo -e "${GREEN}✓ Skills directory: $SKILLS_DIR${NC}"

# ── Summary ─────────────────────────────────────────────────────────
echo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup Complete!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
echo "Configuration: $CONFIG_DIR/config.yaml"
echo "Workspace:     $WORKSPACE"
echo "Model:         claude-opus-4-6-20250219"
echo "Provider:      Anthropic (Claude Code only)"
echo
echo "Next steps:"
echo "  1. Authenticate (if not already done):"
echo "     claude login              (subscription — recommended)"
echo "     export ANTHROPIC_API_KEY  (API key — alternative)"
echo "  2. Start the relay:"
echo "     claude --relay --config $CONFIG_DIR/config.yaml"
echo
