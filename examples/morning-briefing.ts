/**
 * Enterprise Morning Briefing
 *
 * Same pattern as claude-telegram-relay's morning-briefing.ts but
 * for enterprise channels.  Sends a daily team summary to Slack/Teams.
 *
 * Run:  npx tsx examples/morning-briefing.ts
 * Schedule: daily at 9:00 AM via cron / Task Scheduler
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_BRIEFING_WEBHOOK || "";
const TEAMS_WEBHOOK_URL = process.env.TEAMS_BRIEFING_WEBHOOK || "";

// ============================================================
// SEND TO CHANNEL
// ============================================================

async function sendMessage(message: string): Promise<boolean> {
  if (SLACK_WEBHOOK_URL) {
    try {
      const res = await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("[BRIEFING] Slack send failed:", e);
    }
  }

  if (TEAMS_WEBHOOK_URL) {
    try {
      const res = await fetch(TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("[BRIEFING] Teams send failed:", e);
    }
  }

  // Fallback: print to stdout
  console.log("[BRIEFING] Message:\n" + message);
  return false;
}

// ============================================================
// DATA FETCHERS (customise for your enterprise systems)
// ============================================================

async function getDeploymentStatus(): Promise<string> {
  // Pull from your CI/CD dashboard
  return "- Production: v2.2.1 (stable, 99.9% uptime)\n- Staging: v2.3.0-rc1 (deployed yesterday)";
}

async function getOpenPRs(): Promise<string> {
  // Pull from GitHub/GitLab API
  return "- 3 open PRs (1 approved, awaiting merge)\n- 1 PR needs review (open 2 days)";
}

async function getActiveGoals(): Promise<string> {
  // Pull from Supabase memory or project management tool
  return "- Complete API v2 migration (deadline: Friday)\n- Fix HANA query performance issue\n- Update XSUAA role configuration";
}

async function getSecurityAlerts(): Promise<string> {
  // Pull from security scanning tools
  return "- No critical vulnerabilities\n- 2 moderate npm audit findings (non-blocking)";
}

async function getScheduledJobs(): Promise<string> {
  // Upcoming scheduled tasks
  return "- 11:00 Production deploy window\n- 14:00 Sprint review\n- 16:00 Security scan (automated)";
}

// ============================================================
// BUILD BRIEFING
// ============================================================

async function buildBriefing(): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const sections: string[] = [];

  sections.push(`*Good Morning, Team!*\n${dateStr}\n`);

  try {
    const schedule = await getScheduledJobs();
    if (schedule) sections.push(`*Today's Schedule*\n${schedule}\n`);
  } catch (e) {
    console.error("[BRIEFING] Schedule fetch failed:", e);
  }

  try {
    const deploys = await getDeploymentStatus();
    if (deploys) sections.push(`*Deployment Status*\n${deploys}\n`);
  } catch (e) {
    console.error("[BRIEFING] Deploy status failed:", e);
  }

  try {
    const prs = await getOpenPRs();
    if (prs) sections.push(`*Pull Requests*\n${prs}\n`);
  } catch (e) {
    console.error("[BRIEFING] PR fetch failed:", e);
  }

  try {
    const goals = await getActiveGoals();
    if (goals) sections.push(`*Active Goals*\n${goals}\n`);
  } catch (e) {
    console.error("[BRIEFING] Goals fetch failed:", e);
  }

  try {
    const security = await getSecurityAlerts();
    if (security) sections.push(`*Security*\n${security}\n`);
  } catch (e) {
    console.error("[BRIEFING] Security fetch failed:", e);
  }

  sections.push("---\n_Reply to this thread or DM me to get started._");

  return sections.join("\n");
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("[BRIEFING] Building enterprise morning briefing...");

  const briefing = await buildBriefing();

  console.log("[BRIEFING] Sending...");
  const success = await sendMessage(briefing);

  if (success) {
    console.log("[BRIEFING] Sent successfully!");
  } else {
    console.log("[BRIEFING] Printed to stdout (no webhook configured)");
  }
}

main().catch(console.error);
