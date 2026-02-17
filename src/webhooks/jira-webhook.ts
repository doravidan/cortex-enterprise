import express from "express";
import crypto from "node:crypto";
import type { IncomingMessage } from "../relay.js";
import { handleMessage } from "../relay.js";

/**
 * Jira webhook router.
 * Mount at /webhooks/jira
 */

function verify(req: express.Request, rawBody: Buffer): boolean {
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = (req.headers["x-webhook-signature"] as string | undefined) ?? (req.headers["x-jira-signature"] as string | undefined);
  if (!sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createJiraWebhookRouter(): express.Router {
  const router = express.Router();

  router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    const raw = req.body as Buffer;
    if (!verify(req, raw)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let payload: any = {};
    try {
      payload = JSON.parse(raw.toString("utf-8"));
    } catch {
      // ignore
    }

    const webhookEvent = payload.webhookEvent || payload.issue_event_type_name || "jira_event";
    const issueKey = payload.issue?.key;
    const sprintName = payload.sprint?.name;

    const text = issueKey
      ? `Jira event: ${webhookEvent} on ${issueKey}`
      : sprintName
        ? `Jira event: ${webhookEvent} (sprint: ${sprintName})`
        : `Jira event: ${webhookEvent}`;

    const incoming: IncomingMessage = {
      text,
      channel: "webhook",
      sender: "jira",
      senderId: "jira",
      teamOverride: "orchestrator",
    };

    try {
      const response = await handleMessage(incoming);
      res.json({ ok: true, response });
    } catch (e) {
      res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
