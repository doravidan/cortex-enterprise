/**
 * Cortex Enterprise Relay
 *
 * Core relay that connects enterprise channels (Slack, Teams, Webhooks)
 * to Claude Code CLI.  Same pattern as claude-telegram-relay but adapted
 * for enterprise team agents.
 *
 * Flow:
 *   Channel Message → Router → Team Agent → Claude CLI → Response → Channel
 *
 * Run:  npm start          (or: npx tsx src/relay.ts)
 * Dev:  npm run dev         (with --watch)
 */

import { spawn, type ChildProcess } from "node:child_process";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { routeToTeam, type TeamId } from "./router.js";
import {
  processMemoryIntents,
  getMemoryContext,
  getRelevantContext,
  createSupabaseClient,
} from "./memory.js";
import { startSlack } from "./channels/slack.js";
import { startTeams } from "./channels/teams.js";
import { startWebhookServer } from "./channels/webhook.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

// ============================================================
// CONFIGURATION
// ============================================================

const CLAUDE_PATH = process.env.CLAUDE_PATH || "claude";
const PROJECT_DIR = process.env.PROJECT_DIR || join(process.env.HOME || process.env.USERPROFILE || "~", "workspace");
const RELAY_DIR = process.env.RELAY_DIR || join(process.env.HOME || process.env.USERPROFILE || "~", ".cortex-relay");
const PORT = parseInt(process.env.PORT || "18789", 10);
const DEFAULT_AGENT = (process.env.DEFAULT_AGENT || "orchestrator") as TeamId;

// Directories
const TEMP_DIR = join(RELAY_DIR, "temp");
const UPLOADS_DIR = join(RELAY_DIR, "uploads");
const LOGS_DIR = join(RELAY_DIR, "logs");

// Session tracking for conversation continuity
const SESSION_FILE = join(RELAY_DIR, "session.json");

interface SessionState {
  sessionId: string | null;
  lastActivity: string;
  activeTeam: TeamId;
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

async function loadSession(): Promise<SessionState> {
  try {
    const content = await readFile(SESSION_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      sessionId: null,
      lastActivity: new Date().toISOString(),
      activeTeam: DEFAULT_AGENT,
    };
  }
}

async function saveSession(state: SessionState): Promise<void> {
  await writeFile(SESSION_FILE, JSON.stringify(state, null, 2));
}

let session = await loadSession();

// ============================================================
// LOCK FILE (prevent multiple instances)
// ============================================================

const LOCK_FILE = join(RELAY_DIR, "relay.lock");

async function acquireLock(): Promise<boolean> {
  try {
    const existingLock = await readFile(LOCK_FILE, "utf-8").catch(() => null);

    if (existingLock) {
      const pid = parseInt(existingLock);
      try {
        process.kill(pid, 0); // Check if process exists
        console.log(`[RELAY] Another instance running (PID: ${pid})`);
        return false;
      } catch {
        console.log("[RELAY] Stale lock found, taking over...");
      }
    }

    await writeFile(LOCK_FILE, process.pid.toString());
    return true;
  } catch (error) {
    console.error("[RELAY] Lock error:", error);
    return false;
  }
}

async function releaseLock(): Promise<void> {
  await unlink(LOCK_FILE).catch(() => {});
}

// Cleanup on exit
process.on("SIGINT", async () => {
  console.log("\n[RELAY] Shutting down...");
  await releaseLock();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await releaseLock();
  process.exit(0);
});

// ============================================================
// SETUP
// ============================================================

// Authentication: Claude Code uses your Anthropic subscription (claude login).
// No API key needed. If you prefer API key auth, set ANTHROPIC_API_KEY.
if (process.env.ANTHROPIC_API_KEY) {
  console.log("[RELAY] Auth: API key (ANTHROPIC_API_KEY)");
} else {
  console.log("[RELAY] Auth: Anthropic subscription (claude login)");
}

// Create directories
await mkdir(TEMP_DIR, { recursive: true });
await mkdir(UPLOADS_DIR, { recursive: true });
await mkdir(LOGS_DIR, { recursive: true });

// Supabase (optional — only if configured)
const supabase = createSupabaseClient();

// Acquire lock
if (!(await acquireLock())) {
  console.error("[RELAY] Could not acquire lock. Another instance may be running.");
  process.exit(1);
}

// ============================================================
// CORE: Call Claude CLI
// ============================================================

export async function callClaude(
  prompt: string,
  options?: {
    resume?: boolean;
    teamId?: TeamId;
    files?: string[];
  }
): Promise<string> {
  const args = [CLAUDE_PATH, "-p", prompt];

  // Resume previous session if available
  if (options?.resume && session.sessionId) {
    args.push("--resume", session.sessionId);
  }

  // Use Opus 4.6
  args.push("--model", "claude-opus-4-6-20250219");
  args.push("--output-format", "text");

  console.log(`[CLAUDE] Calling (team: ${options?.teamId || "orchestrator"}): ${prompt.substring(0, 80)}...`);

  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(args[0], args.slice(1), {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        console.error("[CLAUDE] Error:", stderr);
        resolve(`Error: ${stderr || "Claude exited with code " + code}`);
        return;
      }

      // Extract session ID for --resume
      const sessionMatch = stdout.match(/Session ID: ([a-f0-9-]+)/i);
      if (sessionMatch) {
        session.sessionId = sessionMatch[1];
        session.lastActivity = new Date().toISOString();
        if (options?.teamId) session.activeTeam = options.teamId;
        await saveSession(session);
      }

      resolve(stdout.trim());
    });

    proc.on("error", (error) => {
      console.error("[CLAUDE] Spawn error:", error);
      resolve("Error: Could not run Claude CLI. Is it installed?");
    });
  });
}

// ============================================================
// MESSAGE HANDLER (called by all channels)
// ============================================================

// Load profile once at startup
let profileContext = "";
try {
  profileContext = await readFile(join(PROJECT_ROOT, "config", "profile.md"), "utf-8");
} catch {
  // No profile yet — that's fine
}

const USER_TIMEZONE = process.env.USER_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

function buildPrompt(
  userMessage: string,
  channel: string,
  sender: string,
  teamId: TeamId,
  relevantContext?: string,
  memoryContext?: string
): string {
  const now = new Date();
  const timeStr = now.toLocaleString("en-US", {
    timeZone: USER_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const teamDesc = routeToTeam(teamId);

  const parts = [
    `You are ${teamDesc.name}, an enterprise AI assistant responding via ${channel}.`,
    teamDesc.systemPrompt,
    `Current time: ${timeStr}`,
    `Channel: ${channel} | Sender: ${sender}`,
  ];

  if (profileContext) parts.push(`\nEnterprise Profile:\n${profileContext}`);
  if (memoryContext) parts.push(`\n${memoryContext}`);
  if (relevantContext) parts.push(`\n${relevantContext}`);

  parts.push(
    "\nKNOWLEDGE MANAGEMENT:" +
    "\nWhen the user shares something worth remembering (project decisions, architecture choices, " +
    "team preferences, deployment info), include these tags in your response:" +
    "\n[REMEMBER: fact to store]" +
    "\n[GOAL: goal text | DEADLINE: optional date]" +
    "\n[DONE: search text for completed goal]" +
    "\nThese tags are automatically processed and hidden from the user."
  );

  parts.push(`\nUser (${sender}): ${userMessage}`);

  return parts.join("\n");
}

export interface IncomingMessage {
  text: string;
  channel: "slack" | "teams" | "googlechat" | "webhook";
  sender: string;
  senderId: string;
  teamOverride?: TeamId;
  files?: string[];
}

export async function handleMessage(msg: IncomingMessage): Promise<string> {
  // Determine which team handles this
  const teamId = msg.teamOverride || DEFAULT_AGENT;

  // Save inbound message
  await saveMessageToDb("user", msg.text, msg.channel, msg.sender);

  // Gather context in parallel
  const [relevantContext, memoryContext] = await Promise.all([
    getRelevantContext(supabase, msg.text),
    getMemoryContext(supabase),
  ]);

  // Build enriched prompt
  const enrichedPrompt = buildPrompt(
    msg.text,
    msg.channel,
    msg.sender,
    teamId,
    relevantContext,
    memoryContext
  );

  // Call Claude CLI
  const rawResponse = await callClaude(enrichedPrompt, {
    resume: true,
    teamId,
    files: msg.files,
  });

  // Process memory intents, strip tags
  const response = await processMemoryIntents(supabase, rawResponse);

  // Save response
  await saveMessageToDb("assistant", response, msg.channel, teamId);

  return response;
}

async function saveMessageToDb(
  role: string,
  content: string,
  channel: string,
  sender: string
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("messages").insert({
      role,
      content,
      channel,
      metadata: { sender },
    });
  } catch (error) {
    console.error("[DB] Save error:", error);
  }
}

// ============================================================
// SPLIT LONG RESPONSES (channel message limits)
// ============================================================

export function splitResponse(response: string, maxLength: number = 4000): string[] {
  if (response.length <= maxLength) return [response];

  const chunks: string[] = [];
  let remaining = response;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Split at natural boundary
    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1) splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1) splitIndex = remaining.lastIndexOf(" ", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

// ============================================================
// START ALL CHANNELS
// ============================================================

console.log("[RELAY] Starting Cortex Enterprise Relay...");
console.log(`[RELAY] Model:    claude-opus-4-6-20250219 (Opus 4.6)`);
console.log(`[RELAY] Provider: Anthropic (Claude Code only)`);
console.log(`[RELAY] Teams:    orchestrator, code, devops, sap, security, research`);
console.log(`[RELAY] Default:  ${DEFAULT_AGENT}`);
console.log(`[RELAY] Workspace: ${PROJECT_DIR}`);

// Start channels that are configured
const activeChannels: string[] = [];

if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
  await startSlack();
  activeChannels.push("Slack");
}

if (process.env.MSTEAMS_APP_ID && process.env.MSTEAMS_APP_PASSWORD) {
  await startTeams(PORT + 1);
  activeChannels.push("Teams");
}

// Webhook server always starts
await startWebhookServer(PORT);
activeChannels.push(`Webhooks (:${PORT})`);

console.log(`[RELAY] Active channels: ${activeChannels.join(", ")}`);
console.log("[RELAY] Ready!");
