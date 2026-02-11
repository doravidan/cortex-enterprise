#!/usr/bin/env pwsh
# Cortex Enterprise Setup Script (Claude Code Only — Windows/PowerShell)
# Usage:
#   ./scripts/setup.ps1
#   ./scripts/setup.ps1 -Sap

param(
    [switch]$Sap
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message)  { Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)    { Write-Host "[OK]   $Message" -ForegroundColor Green }
function Write-Warn([string]$Message)  { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)   { Write-Host "[ERR]  $Message" -ForegroundColor Red }

$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ConfigDir  = Join-Path $HOME ".cortex"

Write-Host ""
Write-Host "========================================"
Write-Host "   Cortex Enterprise Setup (PS)"      -ForegroundColor Cyan
Write-Host "   Claude Code + Opus 4.6"            -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

# ── Prerequisites ────────────────────────────────────────────────
Write-Info "Checking prerequisites..."

# Node.js 22+
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js is required but not installed."
    exit 1
}
$nodeVersionRaw = (node -v).Trim()
$majorVersion = [int]($nodeVersionRaw.TrimStart("v").Split(".")[0])
if ($majorVersion -lt 22) {
    Write-Err "Node.js 22+ is required (found $nodeVersionRaw)."
    exit 1
}
Write-Ok "Node.js $nodeVersionRaw"

# Claude Code CLI
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Ok "Claude Code CLI found"
} else {
    Write-Warn "Claude Code CLI not found."
    Write-Warn "  Install it:  npm install -g @anthropic-ai/claude-code"
}

# Authentication
if ($env:ANTHROPIC_API_KEY) {
    Write-Ok "Auth: API key (ANTHROPIC_API_KEY)"
} else {
    Write-Ok "Auth: Anthropic subscription (managed by Claude Code)"
}

# ── Configuration ────────────────────────────────────────────────
New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null

if ($Sap) {
    $ConfigFile = Join-Path $ProjectDir "configs/sap-config.yaml"
    $Workspace  = Join-Path $HOME "sap-workspace"
    Write-Info "Using SAP configuration (CAP / HANA / BTP teams)"
} else {
    $ConfigFile = Join-Path $ProjectDir "configs/enterprise-config.yaml"
    $Workspace  = Join-Path $HOME "workspace"
    Write-Info "Using enterprise configuration (all teams)"
}

$TargetConfigFile = Join-Path $ConfigDir "config.yaml"
if (Test-Path $TargetConfigFile) {
    $timestamp  = Get-Date -Format "yyyyMMddHHmmss"
    $BackupFile = Join-Path $ConfigDir "config.yaml.backup.$timestamp"
    Copy-Item $TargetConfigFile $BackupFile -Force
    Write-Info "Backed up existing config to: $BackupFile"
}

Copy-Item $ConfigFile $TargetConfigFile -Force
Write-Ok "Configuration installed"

# Workspace
New-Item -ItemType Directory -Path $Workspace -Force | Out-Null
Write-Ok "Workspace created: $Workspace"

# Skills directory
$SkillsDir = Join-Path $Workspace "skills"
New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
Write-Ok "Skills directory: $SkillsDir"

# ── Summary ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================"
Write-Host "         Setup Complete"               -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Configuration: $TargetConfigFile"
Write-Host "Workspace:     $Workspace"
Write-Host "Model:         claude-opus-4-6-20250219"
Write-Host "Provider:      Anthropic (Claude Code only)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Authenticate (if not already done):"
Write-Host "     claude login              (subscription - recommended)"
Write-Host '     $env:ANTHROPIC_API_KEY    (API key - alternative)'
Write-Host "  2. Start the relay:"
Write-Host "     claude --relay --config $TargetConfigFile"
Write-Host ""
