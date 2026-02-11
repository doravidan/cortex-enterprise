/**
 * Microsoft Teams Channel Adapter
 *
 * Connects Teams to the relay using Bot Framework.
 * Messages arrive here → routed to Claude CLI → responses sent back.
 */

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  type TurnContext,
  ActivityTypes,
  MessageFactory,
} from "botbuilder";
import { handleMessage, splitResponse, type IncomingMessage } from "../relay.js";
import { parseTeamFromMessage } from "../router.js";
import http from "node:http";

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

  // Error handler
  adapter.onTurnError = async (context: TurnContext, error: Error) => {
    console.error("[TEAMS] Turn error:", error);
    await context.sendActivity("Sorry, I encountered an error.");
  };

  // Create HTTP server for Teams webhook
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/messages") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          await adapter!.process(req, res as any, async (context: TurnContext) => {
            if (context.activity.type === ActivityTypes.Message) {
              const text = context.activity.text || "";
              const sender = context.activity.from?.name || "unknown";
              const senderId = context.activity.from?.id || "unknown";

              // Show typing indicator
              await context.sendActivity({ type: ActivityTypes.Typing });

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

                for (const chunk of chunks) {
                  await context.sendActivity(MessageFactory.text(chunk));
                }
              } catch (error) {
                console.error("[TEAMS] Error handling message:", error);
                await context.sendActivity("Sorry, I encountered an error.");
              }
            }
          });
        } catch (error) {
          console.error("[TEAMS] Process error:", error);
          res.writeHead(500);
          res.end();
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
