#!/bin/bash
# Cortex Enterprise Setup Script
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
echo -e "${BLUE}║       Cortex Enterprise Setup          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
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

# Create config directory
mkdir -p "$CONFIG_DIR"

# Select configuration
if [ "$1" == "--sap" ]; then
    CONFIG_FILE="$PROJECT_DIR/configs/sap-config.yaml"
    echo -e "${YELLOW}Using SAP configuration${NC}"
else
    CONFIG_FILE="$PROJECT_DIR/configs/enterprise-config.yaml"
    echo -e "${YELLOW}Using enterprise configuration${NC}"
fi

# Backup existing config
if [ -f "$CONFIG_DIR/config.yaml" ]; then
    BACKUP_FILE="$CONFIG_DIR/config.yaml.backup.$(date +%Y%m%d%H%M%S)"
    cp "$CONFIG_DIR/config.yaml" "$BACKUP_FILE"
    echo -e "${YELLOW}Backed up existing config to: $BACKUP_FILE${NC}"
fi

# Copy configuration
cp "$CONFIG_FILE" "$CONFIG_DIR/config.yaml"
echo -e "${GREEN}✓ Configuration installed${NC}"

# Create workspace directory
WORKSPACE="${HOME}/workspace"
if [ "$1" == "--sap" ]; then
    WORKSPACE="${HOME}/sap-workspace"
fi

mkdir -p "$WORKSPACE"
echo -e "${GREEN}✓ Workspace created: $WORKSPACE${NC}"

echo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Setup Complete!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
echo "Configuration location: $CONFIG_DIR/config.yaml"
echo "Workspace: $WORKSPACE"
echo
