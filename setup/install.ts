/**
 * Cortex Enterprise — Setup
 *
 * Checks prerequisites, installs dependencies, creates directories,
 * and prepares .env file.  Same pattern as claude-telegram-relay's
 * setup/install.ts but for enterprise.
 *
 * Usage: npx tsx setup/install.ts
 *   or:  npm run setup
 */

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const RELAY_DIR = join(process.env.HOME || process.env.USERPROFILE || "~", ".cortex-relay");

// Colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

const PASS = green("✓");
const FAIL = red("✗");
const WARN = yellow("!");

function run(cmd: string): { ok: boolean; stdout: string } {
  try {
    const stdout = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    return { ok: true, stdout };
  } catch {
    return { ok: false, stdout: "" };
  }
}

// ── Checks ──────────────────────────────────────────────────

function checkNode(): boolean {
  const result = run("node -v");
  if (result.ok) {
    const major = parseInt(result.stdout.replace("v", "").split(".")[0]);
    if (major >= 22) {
      console.log(` ${PASS} Node.js: ${result.stdout}`);
      return true;
    }
    console.log(` ${FAIL} Node.js: ${result.stdout} (need 22+)`);
    return false;
  }
  console.log(` ${FAIL} Node.js: not installed`);
  return false;
}

function checkClaude(): boolean {
  // Try 'claude --version'
  const result = run("claude --version");
  if (result.ok) {
    console.log(` ${PASS} Claude Code: ${result.stdout}`);
    return true;
  }

  console.log(` ${WARN} Claude Code CLI: not found`);
  console.log(`   ${dim("Install: npm install -g @anthropic-ai/claude-code")}`);
  return false;
}

function checkAuth(): boolean {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(` ${PASS} Auth: API key (ANTHROPIC_API_KEY)`);
    return true;
  }
  // Subscription auth is managed by Claude Code internally
  console.log(` ${PASS} Auth: Anthropic subscription (managed by Claude Code)`);
  return true;
}

// ── Install ─────────────────────────────────────────────────

function installDeps(): boolean {
  console.log(`\n  Installing dependencies...`);
  const result = run(`npm install --prefix "${PROJECT_ROOT}"`);
  if (result.ok) {
    console.log(` ${PASS} Dependencies installed`);
    return true;
  }
  console.log(` ${FAIL} npm install failed`);
  return false;
}

function createDirs(): void {
  const dirs = [
    join(RELAY_DIR, "temp"),
    join(RELAY_DIR, "uploads"),
    join(RELAY_DIR, "logs"),
    join(process.env.HOME || process.env.USERPROFILE || "~", "workspace"),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(` ${PASS} Created ${dir}`);
    } else {
      console.log(` ${PASS} ${dir} ${dim("(exists)")}`);
    }
  }
}

function setupEnv(): boolean {
  const envPath = join(PROJECT_ROOT, ".env");
  const examplePath = join(PROJECT_ROOT, ".env.example");

  if (existsSync(envPath)) {
    console.log(` ${PASS} .env ${dim("(exists)")}`);
    return true;
  }

  if (!existsSync(examplePath)) {
    console.log(` ${FAIL} .env.example not found`);
    return false;
  }

  copyFileSync(examplePath, envPath);
  console.log(` ${WARN} .env created from .env.example`);
  console.log(`   ${yellow(">>> Edit .env and add your ANTHROPIC_API_KEY <<<")}`);
  return false;
}

function setupConfig(): void {
  const configDir = join(process.env.HOME || process.env.USERPROFILE || "~", ".cortex");
  const configPath = join(configDir, "config.yaml");

  if (existsSync(configPath)) {
    console.log(` ${PASS} Config: ${configPath} ${dim("(exists)")}`);
    return;
  }

  const sourceConfig = join(PROJECT_ROOT, "configs", "enterprise-config.yaml");
  if (existsSync(sourceConfig)) {
    mkdirSync(configDir, { recursive: true });
    copyFileSync(sourceConfig, configPath);
    console.log(` ${PASS} Config installed: ${configPath}`);
  } else {
    console.log(` ${WARN} Config source not found`);
  }
}

// ── Main ────────────────────────────────────────────────────

function main() {
  const platform = { darwin: "macOS", win32: "Windows", linux: "Linux" }[process.platform] || process.platform;

  console.log("");
  console.log(bold("  Cortex Enterprise — Setup"));
  console.log(dim(`  ${platform} • ${process.arch} • Claude Code + Opus 4.6`));

  // 1. Prerequisites
  console.log(`\n${cyan("  [1/5] Prerequisites")}`);
  const nodeOk = checkNode();
  if (!nodeOk) {
    console.log(`\n  ${red("Node.js 22+ is required. Install it first.")}`);
    process.exit(1);
  }
  checkClaude();
  checkAuth();

  // 2. Dependencies
  console.log(`\n${cyan("  [2/5] Dependencies")}`);
  installDeps();

  // 3. Directories
  console.log(`\n${cyan("  [3/5] Directories")}`);
  createDirs();

  // 4. Environment
  console.log(`\n${cyan("  [4/5] Environment")}`);
  const envReady = setupEnv();

  // 5. Config
  console.log(`\n${cyan("  [5/5] Configuration")}`);
  setupConfig();

  // Summary
  console.log(`\n${bold("  Next steps:")}`);
  console.log(dim("  ----------"));

  const steps: string[] = [];
  if (!envReady) {
    steps.push(`Edit .env with your API key: ${cyan("$EDITOR .env")}`);
  }
  steps.push(`Verify setup: ${cyan("npm run setup:verify")}`);
  steps.push(`Start the relay: ${cyan("npm start")}`);

  steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  console.log("");
}

main();
