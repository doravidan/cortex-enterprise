/**
 * Enterprise Smart Check-in
 *
 * Same pattern as claude-telegram-relay's smart-checkin.ts but for
 * enterprise channels.  Claude decides IF and WHAT to post based on
 * team goals, deployment status, and activity.
 *
 * Run:  npx tsx examples/smart-checkin.ts
 * Schedule: every 30-60 minutes via cron / Task Scheduler
 */

import { spawn, type ChildProcess } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CLAUDE_PATH = process.env.CLAUDE_PATH || "claude";
const STATE_FILE = process.env.CHECKIN_STATE_FILE || join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".cortex-relay",
  "checkin-state.json"
);

// Send via Slack or webhook
const SLACK_WEBHOOK_URL = process.env.SLACK_CHECKIN_WEBHOOK || "";
const TEAMS_WEBHOOK_URL = process.env.TEAMS_CHECKIN_WEBHOOK || "";

// ============================================================
// STATE MANAGEMENT
// ============================================================

interface CheckinState {
  lastMessageTime: string;
  lastCheckinTime: string;
  pendingItems: string[];
}

async function loadState(): Promise<CheckinState> {
  try {
    const content = await readFile(STATE_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      lastMessageTime: new Date().toISOString(),
      lastCheckinTime: "",
      pendingItems: [],
    };
  }
}

async function saveState(state: CheckinState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================
// CONTEXT GATHERING (customise for your enterprise)
// ============================================================

async function getTeamGoals(): Promise<string> {
  // Pull from your project management tool, Supabase, or config
  return "Sprint goals: finish API migration, deploy v2.3 to staging";
}

async function getDeploymentStatus(): Promise<string> {
  // Pull from CI/CD system
  return "Last deploy: staging (2h ago, healthy). Production: v2.2.1 (stable).";
}

async function getOpenPRs(): Promise<string> {
  // Pull from GitHub/GitLab
  return "3 open PRs, 1 awaiting review for 2 days";
}

// ============================================================
// SEND TO CHANNEL
// ============================================================

async function sendMessage(message: string): Promise<boolean> {
  // Try Slack webhook
  if (SLACK_WEBHOOK_URL) {
    try {
      const res = await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("[CHECKIN] Slack send failed:", e);
    }
  }

  // Try Teams webhook
  if (TEAMS_WEBHOOK_URL) {
    try {
      const res = await fetch(TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("[CHECKIN] Teams send failed:", e);
    }
  }

  // Fallback: relay webhook
  try {
    const port = process.env.PORT || "18789";
    const res = await fetch(`http://localhost:${port}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[CHECKIN RESPONSE]: ${message}`,
        sender: "smart-checkin",
        team: "orchestrator",
      }),
    });
    return res.ok;
  } catch {
    console.log("[CHECKIN] Message:", message);
    return false;
  }
}

// ============================================================
// CLAUDE DECISION
// ============================================================

async function askClaudeToDecide(): Promise<{
  shouldCheckin: boolean;
  message: string;
}> {
  const state = await loadState();
  const goals = await getTeamGoals();
  const deploys = await getDeploymentStatus();
  const prs = await getOpenPRs();

  const now = new Date();
  const hour = now.getHours();
  const timeContext =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const prompt = `
You are an enterprise AI assistant deciding whether to proactively check in with the team.

CONTEXT:
- Current time: ${now.toLocaleTimeString()} (${timeContext})
- Last team activity: ${state.lastMessageTime}
- Last check-in: ${state.lastCheckinTime || "Never"}
- Team goals: ${goals}
- Deployment status: ${deploys}
- Open PRs: ${prs}
- Pending follow-ups: ${state.pendingItems.join(", ") || "None"}

RULES:
1. Max 2-3 check-ins per workday (9am-6pm only)
2. Only check in if there's a genuine reason (stale PR, goal deadline, deploy issue)
3. Keep it brief and actionable — this goes to a Slack/Teams channel
4. Don't interrupt during likely focus hours (10am-12pm, 2pm-4pm) unless urgent
5. If nothing needs attention, respond with NO_CHECKIN

RESPOND IN THIS EXACT FORMAT:
DECISION: YES or NO
MESSAGE: [Your brief message if YES, or "none" if NO]
REASON: [Why you decided this]
`;

  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(
      CLAUDE_PATH,
      ["-p", prompt, "--model", "claude-opus-4-6-20250219", "--output-format", "text"],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let output = "";
    proc.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));

    proc.on("close", () => {
      const decisionMatch = output.match(/DECISION:\s*(YES|NO)/i);
      const messageMatch = output.match(/MESSAGE:\s*(.+?)(?=\nREASON:|$)/is);
      const reasonMatch = output.match(/REASON:\s*(.+)/is);

      const shouldCheckin = decisionMatch?.[1]?.toUpperCase() === "YES";
      const message = messageMatch?.[1]?.trim() || "";
      const reason = reasonMatch?.[1]?.trim() || "";

      console.log(`[CHECKIN] Decision: ${shouldCheckin ? "YES" : "NO"}`);
      console.log(`[CHECKIN] Reason: ${reason}`);

      resolve({ shouldCheckin, message });
    });

    proc.on("error", () => resolve({ shouldCheckin: false, message: "" }));
  });
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("[CHECKIN] Running enterprise smart check-in...");

  const { shouldCheckin, message } = await askClaudeToDecide();

  if (shouldCheckin && message && message !== "none") {
    console.log("[CHECKIN] Sending...");
    const success = await sendMessage(message);

    if (success) {
      const state = await loadState();
      state.lastCheckinTime = new Date().toISOString();
      await saveState(state);
      console.log("[CHECKIN] Sent!");
    } else {
      console.error("[CHECKIN] Failed to send");
    }
  } else {
    console.log("[CHECKIN] No check-in needed");
  }
}

main().catch(console.error);
