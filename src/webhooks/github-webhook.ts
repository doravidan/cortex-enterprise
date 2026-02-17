import express from "express";
import { verifyGitHubWebhookSignature, summarizeGitHubWebhookEvent } from "../integrations/github.js";
import type { IncomingMessage } from "../relay.js";
import { handleMessage } from "../relay.js";

/**
 * GitHub webhook router.
 * Mount at /webhooks/github
 */

export function createGitHubWebhookRouter(): express.Router {
  const router = express.Router();

  // Need raw body for signature validation.
  router.post(
    "/",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const secret = process.env.GITHUB_WEBHOOK_SECRET;
      const eventName = (req.headers["x-github-event"] as string) || "unknown";
      const sig = req.headers["x-hub-signature-256"] as string | undefined;
      const raw = req.body as Buffer;

      if (secret) {
        const ok = verifyGitHubWebhookSignature({ secret, payloadRawBody: raw, signature256Header: sig });
        if (!ok) {
          res.status(401).json({ error: "Invalid signature" });
          return;
        }
      }

      let payload: any = {};
      try {
        payload = JSON.parse(raw.toString("utf-8"));
      } catch {
        // ignore
      }

      const summary = summarizeGitHubWebhookEvent(eventName, payload);
      const incoming: IncomingMessage = {
        text: `GitHub webhook (${eventName}): ${summary.title}`,
        channel: "webhook",
        sender: "github",
        senderId: "github",
        teamOverride: "code",
      };

      try {
        const response = await handleMessage(incoming);
        res.json({ ok: true, summary, response });
      } catch (e) {
        res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e), summary });
      }
    }
  );

  return router;
}
