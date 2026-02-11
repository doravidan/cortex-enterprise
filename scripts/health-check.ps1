#!/usr/bin/env pwsh
# Cortex Enterprise Health Check (Claude Code Relay — Windows/PowerShell)
# Usage:
#   ./scripts/health-check.ps1
#   ./scripts/health-check.ps1 -Json

param(
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$GatewayUrl = if ($env:CORTEX_GATEWAY_URL) { $env:CORTEX_GATEWAY_URL } else { "http://localhost:18789" }
$ConfigPath = Join-Path (Join-Path $HOME ".cortex") "config.yaml"

function Test-Gateway {
    try {
        $response = Invoke-WebRequest -Uri "$GatewayUrl/health" -Method GET -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-Config {
    return Test-Path $ConfigPath
}

function Test-Auth {
    if ($env:ANTHROPIC_API_KEY) { return $true }
    # Subscription auth is managed by Claude Code — check if CLI exists
    return [bool](Get-Command claude -ErrorAction SilentlyContinue)
}

function Test-ClaudeCli {
    return [bool](Get-Command claude -ErrorAction SilentlyContinue)
}

$gatewayOk  = Test-Gateway
$configOk   = Test-Config
$apiKeyOk   = Test-Auth
$claudeOk   = Test-ClaudeCli
$overall    = if ($gatewayOk -and $configOk) { "healthy" } else { "unhealthy" }

if ($Json) {
    $payload = [ordered]@{
        status    = $overall
        timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        provider  = "anthropic"
        model     = "claude-opus-4-6-20250219"
        checks    = [ordered]@{
            gateway   = $gatewayOk
            config    = $configOk
            auth      = $apiKeyOk
            claudeCli = $claudeOk
        }
    }
    $payload | ConvertTo-Json -Depth 4
    exit 0
}

Write-Host "Cortex Enterprise Health Check"
Write-Host "==============================="
Write-Host "Provider: Anthropic (Claude Code only)"
Write-Host "Model:    Opus 4.6"
Write-Host ""
Write-Host ("Gateway:      " + $(if ($gatewayOk) { "OK Running" }      else { "X Not responding" }))
Write-Host ("Config:       " + $(if ($configOk)  { "OK Present" }      else { "X Not found" }))
Write-Host ("Auth:         " + $(if ($apiKeyOk)  { "OK Authenticated" } else { "X Not authenticated (run: claude login)" }))
Write-Host ("Claude CLI:   " + $(if ($claudeOk)  { "OK Installed" }    else { "X Not found" }))
Write-Host ""
