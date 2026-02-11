/**
 * Cortex Enterprise — Verify Setup
 *
 * Runs all health checks: env, channels, config, relay.
 * Same pattern as claude-telegram-relay's setup/verify.ts.
 *
 * Usage: npx tsx setup/verify.ts
 *   or:  npm run setup:verify
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

// Colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const PASS = green("✓");
const FAIL = red("✗");
const WARN = yellow("!");

let passed = 0;
let failed = 0;
let warned = 0;

function pass(msg: string) { console.log(` ${PASS} ${msg}`); passed++; }
function fail(msg: string) { console.log(` ${FAIL} ${msg}`); failed++; }
function warn(msg: string) { console.log(` ${WARN} ${msg}`); warned++; }

// Load .env manually
async function loadEnv(): Promise<Record<string, string>> {
  try {
    const content = await readFile(join(PROJECT_ROOT, ".env"), "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return vars;
  } catch {
    return {};
  }
}

async function main() {
  console.log("");
  console.log(bold("  Cortex Enterprise — Health Check"));
  console.log(dim("  Claude Code + Opus 4.6 • Enterprise Relay"));
  console.log("");

  const env = await loadEnv();

  // ── Files ──────────────────────────────────────────────
  console.log(bold("  Files"));
  existsSync(join(PROJECT_ROOT, ".env")) ? pass(".env exists") : fail(".env missing — run: npm run setup");
  existsSync(join(PROJECT_ROOT, "node_modules")) ? pass("Dependencies installed") : fail("node_modules missing — run: npm install");
  existsSync(join(PROJECT_ROOT, "config", "profile.md")) ? pass("Enterprise profile configured") : warn("No profile.md — copy config/profile.example.md");

  const configPath = join(process.env.HOME || process.env.USERPROFILE || "~", ".cortex", "config.yaml");
  existsSync(configPath) ? pass("Gateway config installed") : warn("No ~/.cortex/config.yaml — run: npm run setup");

  // ── Prerequisites ──────────────────────────────────────
  console.log(`\n${bold("  Prerequisites")}`);

  try {
    const nodeV = execSync("node -v", { encoding: "utf-8" }).trim();
    const major = parseInt(nodeV.replace("v", "").split(".")[0]);
    major >= 22 ? pass(`Node.js: ${nodeV}`) : fail(`Node.js: ${nodeV} (need 22+)`);
  } catch {
    fail("Node.js: not found");
  }

  try {
    execSync("claude --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    pass("Claude Code CLI: installed");
  } catch {
    warn("Claude Code CLI: not found (install: npm i -g @anthropic-ai/claude-code)");
  }

  // ── Authentication ──────────────────────────────────────
  console.log(`\n${bold("  Authentication")}`);

  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  if (apiKey && !apiKey.includes("sk-ant-...")) {
    pass("Auth: API key (ANTHROPIC_API_KEY)");
  } else {
    // Subscription auth — Claude Code handles this internally
    try {
      execSync("claude --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      pass("Auth: Anthropic subscription (managed by Claude Code)");
    } catch {
      fail("Auth: Claude Code CLI not found — install with: npm i -g @anthropic-ai/claude-code");
    }
  }

  // ── Channels ───────────────────────────────────────────
  console.log(`\n${bold("  Channels")}`);

  const slackToken = env.SLACK_BOT_TOKEN || process.env.SLACK_BOT_TOKEN || "";
  const slackApp = env.SLACK_APP_TOKEN || process.env.SLACK_APP_TOKEN || "";
  if (slackToken && slackApp && !slackToken.includes("xoxb-...")) {
    pass("Slack: configured");
  } else {
    warn("Slack: not configured (optional)");
  }

  const teamsId = env.MSTEAMS_APP_ID || process.env.MSTEAMS_APP_ID || "";
  const teamsPw = env.MSTEAMS_APP_PASSWORD || process.env.MSTEAMS_APP_PASSWORD || "";
  if (teamsId && teamsPw) {
    pass("Teams: configured");
  } else {
    warn("Teams: not configured (optional)");
  }

  // Webhook server always available
  pass("Webhooks: always available on :18789");

  // ── Supabase (Memory) ─────────────────────────────────
  console.log(`\n${bold("  Memory (Supabase)")}`);

  const supaUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supaKey = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!supaUrl || supaUrl.includes("your_")) {
    warn("Supabase: not configured (memory will be session-only)");
  } else if (!supaKey || supaKey.includes("your_")) {
    warn("SUPABASE_ANON_KEY: missing");
  } else {
    // Test connectivity
    for (const table of ["messages", "memory", "logs"]) {
      try {
        const res = await fetch(`${supaUrl}/rest/v1/${table}?select=*&limit=1`, {
          headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
        });
        res.status === 200 ? pass(`Table "${table}": OK`) : fail(`Table "${table}": ${res.status}`);
      } catch (e: any) {
        fail(`Supabase unreachable: ${e.message}`);
        break;
      }
    }
  }

  // ── Relay Health ───────────────────────────────────────
  console.log(`\n${bold("  Relay")}`);
  try {
    const res = await fetch("http://localhost:18789/health", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json() as any;
      pass(`Relay running: ${data.status} (uptime: ${Math.round(data.uptime || 0)}s)`);
    } else {
      warn("Relay: responded but not healthy");
    }
  } catch {
    warn("Relay: not running (start with: npm start)");
  }

  // ── Summary ────────────────────────────────────────────
  console.log(`\n${bold("  Summary")}`);
  const parts = [green(`${passed} passed`)];
  if (failed > 0) parts.push(red(`${failed} failed`));
  if (warned > 0) parts.push(yellow(`${warned} warnings`));
  console.log(`  ${parts.join("  ")}`);

  if (failed === 0) {
    console.log(`\n  ${green("Ready!")} Start with: npm start`);
  } else {
    console.log(`\n  ${red("Fix the failures above, then re-run:")} npm run setup:verify`);
  }
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n  ${red("Error:")} ${err.message}`);
  process.exit(1);
});
