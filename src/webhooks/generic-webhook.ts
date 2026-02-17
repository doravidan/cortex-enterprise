import express from "express";
import type { IncomingMessage } from "../relay.js";
import { handleMessage } from "../relay.js";

/**
 * Generic webhook router: accepts POST /webhooks/generic
 */

export function createGenericWebhookRouter(): express.Router {
  const router = express.Router();
  router.post("/", express.json({ limit: "1mb" }), async (req, res) => {
    const secret = process.env.GENERIC_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.header("x-webhook-secret");
      if (!provided || provided !== secret) {
        res.status(401).json({ error: "Invalid secret" });
        return;
      }
    }

    const body = req.body ?? {};
    const text = typeof body.text === "string" ? body.text : `Generic webhook: ${JSON.stringify(body).slice(0, 800)}`;

    const incoming: IncomingMessage = {
      text,
      channel: "webhook",
      sender: body.sender || "generic-webhook",
      senderId: body.senderId || body.sender || "generic-webhook",
      teamOverride: body.team,
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
