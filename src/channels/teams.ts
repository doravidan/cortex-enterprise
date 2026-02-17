/**
 * Microsoft Teams Channel Adapter
 *
 * Bot Framework adapter.
 * Supports message command: "/cortex ..." (or "cortex ...")
 */

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  type TurnContext,
  ActivityTypes,
  MessageFactory,
} from "botbuilder";
import http from "node:http";

import { handleMessage, splitResponse, type IncomingMessage } from "../relay.js";
import { parseTeamFromMessage } from "../router.js";
import { handleCortexCommand } from "../commands.js";

let adapter: CloudAdapter | null = null;

export async function startTeams(port: number): Promise<void> {
  const appId = process.env.MSTEAMS_APP_ID;
  const appPassword = process.env.MSTEAMS_APP_PASSWORD;

  if (!appId || !appPassword) {
    console.log("[TEAMS] Missing MSTEAMS_APP_ID or MSTEAMS_APP_PASSWORD — skipping");
    return;
  }

  const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({}, undefined, undefined);
  adapter = new CloudAdapter(botFrameworkAuth);

  adapter.onTurnError = async (context: TurnContext, error: Error) => {
    console.error("[TEAMS] Turn error:", error);
    await context.sendActivity("Sorry, I encountered an error.");
  };

  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/messages") {
      await adapter!.process(req, res as any, async (context: TurnContext) => {
        if (context.activity.type !== ActivityTypes.Message) return;

        const text = context.activity.text || "";
        const sender = context.activity.from?.name || "unknown";
        const senderId = context.activity.from?.id || "unknown";

        await context.sendActivity({ type: ActivityTypes.Typing });

        // Commands
        const normalized = text.trim();
        const isCommand = normalized.startsWith("/cortex") || normalized.toLowerCase().startsWith("cortex ");
        if (isCommand) {
          try {
            const cmdText = normalized.startsWith("/cortex") ? normalized : `/cortex ${normalized.substring("cortex".length).trim()}`;
            const result = await handleCortexCommand(cmdText, {
              request: {
                requestId: `${senderId}:${context.activity.id ?? Date.now()}`,
                channel: "teams",
                actor: { id: senderId, displayName: sender },
                timestamp: new Date().toISOString(),
              },
              actor: { id: senderId, displayName: sender, roles: [] },
            });

            const chunks = splitResponse(result.text, 3900);
            for (const chunk of chunks) await context.sendActivity(MessageFactory.text(chunk));
            return;
          } catch (e) {
            console.error("[TEAMS] Command error:", e);
            await context.sendActivity("Sorry, I encountered an error processing that command.");
            return;
          }
        }

        const { teamId, cleanText } = parseTeamFromMessage(text);
        const incoming: IncomingMessage = {
          text: cleanText || text,
          channel: "teams",
          sender,
          senderId,
          teamOverride: teamId || undefined,
        };

        try {
          const response = await handleMessage(incoming);
          const chunks = splitResponse(response, 3900);
          for (const chunk of chunks) await context.sendActivity(MessageFactory.text(chunk));
        } catch (error) {
          console.error("[TEAMS] Error handling message:", error);
          await context.sendActivity("Sorry, I encountered an error.");
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`[TEAMS] Bot listening on port ${port}`);
  });
}
