/**
 * Webhook Channel Adapter
 *
 * HTTP server that accepts inbound webhooks and routes them to team agents.
 *
 * Backward-compatible endpoints:
 * - POST /message
 * - POST /hooks/* (legacy)
 *
 * New routers:
 * - POST /webhooks/github
 * - POST /webhooks/jira
 * - POST /webhooks/generic
 */

import express from "express";
import crypto from "node:crypto";
import { handleMessage, type IncomingMessage } from "../relay.js";
import type { TeamId } from "../router.js";
import { createGitHubWebhookRouter } from "../webhooks/github-webhook.js";
import { createJiraWebhookRouter } from "../webhooks/jira-webhook.js";
import { createGenericWebhookRouter } from "../webhooks/generic-webhook.js";

// Legacy webhook route  team mapping
const LEGACY_ROUTES: Record<string, TeamId> = {
  "/hooks/ci": "devops",
  "/hooks/pr": "code",
  "/hooks/security": "security",
  "/hooks/sap/deploy": "sap",
  "/hooks/sap/build": "sap",
  "/hooks/cap/build": "cap",
  "/hooks/hana/alert": "hana",
  "/hooks/btp": "btp",
};

export async function startWebhookServer(port: number): Promise<void> {
  const app = express();

  // Health
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", ts: new Date().toISOString(), uptime: process.uptime() });
  });

  // New routers
  app.use("/webhooks/github", createGitHubWebhookRouter());
  app.use("/webhooks/jira", createJiraWebhookRouter());
  app.use("/webhooks/generic", createGenericWebhookRouter());

  // General message endpoint (JSON)
  app.post("/message", express.json({ limit: "1mb" }), async (req, res) => {
    const { text, sender, team } = req.body ?? {};
    if (!text) {
      res.status(400).json({ error: "Missing 'text' field" });
      return;
    }
    if (!validateWebhookJson(req)) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    const incoming: IncomingMessage = {
      text,
      channel: "webhook",
      sender: sender || "webhook",
      senderId: sender || "webhook",
      teamOverride: team || undefined,
    };

    try {
      const response = await handleMessage(incoming);
      res.json({ response, team: incoming.teamOverride || "orchestrator" });
    } catch (error) {
      console.error("[WEBHOOK] Error:", error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Legacy routes
  for (const [path, teamId] of Object.entries(LEGACY_ROUTES)) {
    app.post(path, express.json({ limit: "1mb" }), async (req, res) => {
      if (!validateWebhookJson(req)) {
        res.status(401).json({ error: "Invalid webhook secret" });
        return;
      }

      const summary = buildLegacySummary(path, req.body ?? {});
      const incoming: IncomingMessage = {
        text: summary,
        channel: "webhook",
        sender: `webhook:${path}`,
        senderId: `webhook:${path}`,
        teamOverride: teamId,
      };

      try {
        const response = await handleMessage(incoming);
        res.json({ response, team: teamId });
      } catch (error) {
        console.error(`[WEBHOOK] Error on ${path}:`, error);
        res.status(500).json({ error: "Internal error" });
      }
    });
  }

  app.listen(port, () => {
    console.log(`[WEBHOOK] Server listening on port ${port}`);
  });
}

function validateWebhookJson(req: express.Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers["x-webhook-signature"] as string | undefined;
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body ?? {})).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function buildLegacySummary(path: string, body: Record<string, any>): string {
  if (path === "/hooks/ci") {
    return `CI/CD Event: ${body.event || "unknown"} on ${body.repo || body.repository || "unknown"} — Status: ${body.status || "unknown"}. ${body.message || ""}`.trim();
  }
  if (path === "/hooks/pr") {
    return `Pull Request ${body.action || "event"}: #${body.number || "?"} "${body.title || ""}" in ${body.repo || body.repository || "unknown"} by ${body.sender || body.author || "unknown"}`.trim();
  }
  if (path === "/hooks/security") {
    return `Security Alert [${body.severity || "unknown"}]: ${body.title || body.message || "Unknown alert"} in ${body.package || body.component || "unknown"}`.trim();
  }
  if (path.startsWith("/hooks/sap")) {
    return `SAP Event: ${body.event || body.status || "notification"} — Project: ${body.project || "unknown"}, Environment: ${body.environment || body.space || "unknown"}. ${body.message || ""}`.trim();
  }
  if (path === "/hooks/cap/build") {
    return `CAP Build: ${body.status || "unknown"} for service ${body.service || "unknown"}. ${body.message || ""}`.trim();
  }
  if (path === "/hooks/hana/alert") {
    return `HANA Alert [${body.severity || "info"}]: ${body.message || "Unknown"} on instance ${body.instance || "unknown"}`.trim();
  }

  return `Webhook event on ${path}: ${JSON.stringify(body).substring(0, 500)}`;
}
