/**
 * Webhook Channel Adapter
 *
 * HTTP server that accepts inbound webhooks from CI/CD, monitoring,
 * and other enterprise systems.  Routes directly to team agents.
 *
 * Endpoints:
 *   POST /hooks/ci        → DevOps team
 *   POST /hooks/pr        → Code team
 *   POST /hooks/security  → Security team
 *   POST /hooks/sap/*     → SAP team
 *   POST /message         → Orchestrator (general messages)
 *   GET  /health          → Health check
 */

import express from "express";
import crypto from "node:crypto";
import { handleMessage, splitResponse, type IncomingMessage } from "../relay.js";
import type { TeamId } from "../router.js";

// Webhook route → team agent mapping
const WEBHOOK_ROUTES: Record<string, TeamId> = {
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
  app.use(express.json({ limit: "1mb" }));

  // ── Health check ──────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      provider: "anthropic",
      model: "claude-opus-4-6-20250219",
      uptime: process.uptime(),
    });
  });

  // ── General message endpoint ──────────────────────────────
  app.post("/message", async (req, res) => {
    const { text, sender, team } = req.body;

    if (!text) {
      res.status(400).json({ error: "Missing 'text' field" });
      return;
    }

    if (!validateWebhook(req)) {
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

  // ── Routed webhook endpoints ──────────────────────────────
  for (const [path, teamId] of Object.entries(WEBHOOK_ROUTES)) {
    app.post(path, async (req, res) => {
      if (!validateWebhook(req)) {
        res.status(401).json({ error: "Invalid webhook secret" });
        return;
      }

      // Build a message from the webhook payload
      const body = req.body;
      const summary = buildWebhookSummary(path, body);

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

  // ── Start server ──────────────────────────────────────────
  app.listen(port, () => {
    console.log(`[WEBHOOK] Server listening on port ${port}`);
    console.log(`[WEBHOOK] Health:  http://localhost:${port}/health`);
    console.log(`[WEBHOOK] Message: POST http://localhost:${port}/message`);
    console.log(`[WEBHOOK] Routes:  ${Object.keys(WEBHOOK_ROUTES).join(", ")}`);
  });
}

// ============================================================
// WEBHOOK VALIDATION
// ============================================================

function validateWebhook(req: express.Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured = allow all

  const signature = req.headers["x-webhook-signature"] as string;
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ============================================================
// WEBHOOK PAYLOAD → MESSAGE
// ============================================================

function buildWebhookSummary(path: string, body: Record<string, any>): string {
  // CI/CD webhook
  if (path === "/hooks/ci") {
    return `CI/CD Event: ${body.event || "unknown"} on ${body.repo || body.repository || "unknown"} — Status: ${body.status || "unknown"}. ${body.message || ""}`.trim();
  }

  // PR webhook
  if (path === "/hooks/pr") {
    return `Pull Request ${body.action || "event"}: #${body.number || "?"} "${body.title || ""}" in ${body.repo || body.repository || "unknown"} by ${body.sender || body.author || "unknown"}`.trim();
  }

  // Security alert
  if (path === "/hooks/security") {
    return `Security Alert [${body.severity || "unknown"}]: ${body.title || body.message || "Unknown alert"} in ${body.package || body.component || "unknown"}`.trim();
  }

  // SAP deploy
  if (path.startsWith("/hooks/sap")) {
    return `SAP Event: ${body.event || body.status || "notification"} — Project: ${body.project || "unknown"}, Environment: ${body.environment || body.space || "unknown"}. ${body.message || ""}`.trim();
  }

  // CAP build
  if (path === "/hooks/cap/build") {
    return `CAP Build: ${body.status || "unknown"} for service ${body.service || "unknown"}. ${body.message || ""}`.trim();
  }

  // HANA alert
  if (path === "/hooks/hana/alert") {
    return `HANA Alert [${body.severity || "info"}]: ${body.message || "Unknown"} on instance ${body.instance || "unknown"}`.trim();
  }

  // Generic fallback
  return `Webhook event on ${path}: ${JSON.stringify(body).substring(0, 500)}`;
}
