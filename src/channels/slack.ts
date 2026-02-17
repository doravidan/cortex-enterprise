/**
 * Slack Channel Adapter
 *
 * - Socket Mode via Slack Bolt
 * - Supports:
 *   - Messages + app mentions -> relay
 *   - /cortex slash command -> command handler
 *   - Approval buttons (Block Kit) -> approvals manager
 */

import { App } from "@slack/bolt";
import { handleMessage, splitResponse, type IncomingMessage } from "../relay.js";
import { parseTeamFromMessage } from "../router.js";
import { handleCortexCommand } from "../commands.js";
import { ApprovalManager } from "../security/approvals.js";

let slackApp: App | null = null;
export const approvalManager = new ApprovalManager({ defaultTimeoutMs: 5 * 60_000 });

export async function startSlack(): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!token || !appToken) {
    console.log("[SLACK] Missing SLACK_BOT_TOKEN or SLACK_APP_TOKEN — skipping");
    return;
  }

  slackApp = new App({
    token,
    appToken,
    signingSecret,
    socketMode: true,
  });

  // Slash command: /cortex
  slackApp.command("/cortex", async ({ command, ack, respond }) => {
    await ack();
    try {
      const result = await handleCortexCommand(`/cortex ${command.text || ""}`.trim(), {
        request: {
          requestId: `${command.channel_id}:${command.trigger_id}`,
          channel: "slack",
          actor: { id: command.user_id, displayName: command.user_name },
          timestamp: new Date().toISOString(),
        },
        actor: { id: command.user_id, displayName: command.user_name, roles: [] },
      });

      if (result.blocks) {
        await respond({ text: result.text, blocks: result.blocks as any });
      } else {
        await respond(result.text);
      }
    } catch (error) {
      console.error("[SLACK] /cortex error:", error);
      await respond("Sorry, I encountered an error processing that command.");
    }
  });

  // Approval buttons
  slackApp.action("cortex_approval_approve", async ({ body, ack, respond }) => {
    await ack();
    const requestId = (body as any).actions?.[0]?.value as string | undefined;
    if (!requestId) return;
    approvalManager.decide({ requestId, decision: "approved", actor: { id: (body as any).user?.id ?? "slack", displayName: (body as any).user?.username } });
    await respond({ text: `Approved: ${requestId}`, replace_original: false } as any);
  });

  slackApp.action("cortex_approval_reject", async ({ body, ack, respond }) => {
    await ack();
    const requestId = (body as any).actions?.[0]?.value as string | undefined;
    if (!requestId) return;
    approvalManager.decide({ requestId, decision: "rejected", actor: { id: (body as any).user?.id ?? "slack", displayName: (body as any).user?.username } });
    await respond({ text: `Rejected: ${requestId}`, replace_original: false } as any);
  });

  // Handle direct messages
  slackApp.message(async ({ message, say }) => {
    if ((message as any).subtype) return;
    if (!("text" in message) || !message.text) return;

    const text = message.text;
    const sender = (message as any).user || "unknown";

    const { teamId, cleanText } = parseTeamFromMessage(text);

    const incoming: IncomingMessage = {
      text: cleanText || text,
      channel: "slack",
      sender,
      senderId: sender,
      teamOverride: teamId || undefined,
    };

    try {
      const response = await handleMessage(incoming);
      const chunks = splitResponse(response, 3900);
      for (const chunk of chunks) await say(chunk);
    } catch (error) {
      console.error("[SLACK] Error handling message:", error);
      await say("Sorry, I encountered an error processing your request.");
    }
  });

  // App mention
  slackApp.event("app_mention", async ({ event, say }) => {
    const text = (event as any).text?.replace(/<@[A-Z0-9]+>/g, "").trim() ?? "";
    const sender = (event as any).user || "unknown";
    const { teamId, cleanText } = parseTeamFromMessage(text);

    const incoming: IncomingMessage = {
      text: cleanText || text,
      channel: "slack",
      sender,
      senderId: sender,
      teamOverride: teamId || undefined,
    };

    try {
      const response = await handleMessage(incoming);
      const chunks = splitResponse(response, 3900);
      for (const chunk of chunks) await say(chunk);
    } catch (error) {
      console.error("[SLACK] Error handling mention:", error);
      await say("Sorry, I encountered an error processing your request.");
    }
  });

  await slackApp.start();
  console.log("[SLACK] Connected via Socket Mode");
}

export async function sendSlackMessage(channelOrUser: string, text: string): Promise<boolean> {
  if (!slackApp) return false;
  try {
    const chunks = splitResponse(text, 3900);
    for (const chunk of chunks) {
      await slackApp.client.chat.postMessage({ channel: channelOrUser, text: chunk });
    }
    return true;
  } catch (error) {
    console.error("[SLACK] Send error:", error);
    return false;
  }
}
