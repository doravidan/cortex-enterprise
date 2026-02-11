/**
 * Slack Channel Adapter
 *
 * Connects Slack to the relay using Slack Bolt (Socket Mode).
 * Messages arrive here → routed to Claude CLI → responses sent back.
 */

import { App } from "@slack/bolt";
import { handleMessage, splitResponse, type IncomingMessage } from "../relay.js";
import { parseTeamFromMessage, type TeamId } from "../router.js";

let slackApp: App | null = null;

export async function startSlack(): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!token || !appToken) {
    console.log("[SLACK] Missing SLACK_BOT_TOKEN or SLACK_APP_TOKEN — skipping");
    return;
  }

  slackApp = new App({
    token: token!,
    appToken: appToken!,
    socketMode: true,
  });

  // Handle direct messages
  slackApp.message(async ({ message, say }) => {
    if (message.subtype) return; // Ignore edits, deletes, etc.
    if (!("text" in message) || !message.text) return;

    const text = message.text;
    const sender = message.user || "unknown";

    // Parse team routing from message
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
      const chunks = splitResponse(response, 3900); // Slack limit ~4000

      for (const chunk of chunks) {
        await say(chunk);
      }
    } catch (error) {
      console.error("[SLACK] Error handling message:", error);
      await say("Sorry, I encountered an error processing your request.");
    }
  });

  // Handle app mentions in channels
  slackApp.event("app_mention", async ({ event, say }) => {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim(); // Strip mention
    const sender = event.user || "unknown";

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

      for (const chunk of chunks) {
        await say(chunk);
      }
    } catch (error) {
      console.error("[SLACK] Error handling mention:", error);
      await say("Sorry, I encountered an error processing your request.");
    }
  });

  await slackApp.start();
  console.log("[SLACK] Connected via Socket Mode");
}

/**
 * Send a proactive message to a Slack channel or user.
 * Used by smart check-ins and morning briefings.
 */
export async function sendSlackMessage(
  channelOrUser: string,
  text: string
): Promise<boolean> {
  if (!slackApp) return false;

  try {
    const chunks = splitResponse(text, 3900);
    for (const chunk of chunks) {
      await slackApp.client.chat.postMessage({
        channel: channelOrUser,
        text: chunk,
      });
    }
    return true;
  } catch (error) {
    console.error("[SLACK] Send error:", error);
    return false;
  }
}
