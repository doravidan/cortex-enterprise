import type { Actor, RequestContext } from "./types/index.js";
import { createJiraClientFromEnv } from "./integrations/jira.js";
import { createGitHubClientFromEnv } from "./integrations/github.js";
import { scanRepository } from "./skills/scanner.js";
import { generateSkill, writeSkillMarkdown } from "./skills/generator.js";
import { SkillRegistry } from "./skills/registry.js";

/**
 * /cortex command handler.
 *
 * Designed to be used by Slack/Teams/Webhook channel adapters.
 */

export interface CommandResult {
  text: string;
  blocks?: any[];
}

export interface CommandContext {
  request: RequestContext;
  actor: Actor;
}

function help(): string {
  return [
    "Cortex Enterprise Commands",
    "",
    "/cortex jira <action> ...",
    "/cortex pr <action> ...",
    "/cortex deploy <action> ...",
    "/cortex status",
    "/cortex cost",
    "/cortex audit <query>",
    "/cortex team <id>",
    "/cortex config",
    "/cortex skills scan <path>",
    "/cortex skills list",
    "/cortex skills install <id|name> <dest>",
  ].join("\n");
}

export async function handleCortexCommand(text: string, ctx: CommandContext): Promise<CommandResult> {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  const [, cmd, sub, ...rest] = parts[0] === "/cortex" ? parts : ["/cortex", ...parts];

  if (!cmd) return { text: help() };

  if (cmd === "skills") {
    const registryDir = process.env.SKILLS_DIR || "skills";
    const reg = new SkillRegistry({ dir: registryDir });

    if (sub === "scan") {
      const root = rest.join(" ") || process.env.PROJECT_DIR || process.cwd();
      const analysis = await scanRepository({ root });
      const skill = generateSkill({ analysis });
      await writeSkillMarkdown({ rootDir: root, markdown: skill.markdown, filename: "SKILL.md" }).catch(() => undefined);
      await reg.register({ ...skill });
      return { text: `Skill generated and registered: ${skill.name} (id=${skill.id})` };
    }

    if (sub === "list") {
      const items = await reg.list();
      const lines = items.map((s) => `- ${s.id} — ${s.name}`).join("\n") || "(none)";
      return { text: `Registered skills:\n${lines}` };
    }

    if (sub === "install") {
      const id = rest[0];
      const destDir = rest[1] || (process.env.PROJECT_DIR || process.cwd());
      if (!id) return { text: "Usage: /cortex skills install <id|name> <destDir>" };
      const out = await reg.install({ skillIdOrName: id, destDir });
      return { text: `Installed skill to: ${out}` };
    }

    return { text: "Usage: /cortex skills scan|list|install" };
  }

  if (cmd === "jira") {
    const jira = createJiraClientFromEnv();
    if (!jira) return { text: "Jira integration not configured (set JIRA_BASE_URL + JIRA_EMAIL/JIRA_API_TOKEN or JIRA_OAUTH_TOKEN)." };
    if (sub === "search") {
      const jql = rest.join(" ");
      const r = await jira.searchJQL({ jql, maxResults: 10 });
      const lines = r.issues.map((i) => `- ${i.key}`).join("\n") || "(none)";
      return { text: `Jira results:\n${lines}` };
    }
    return { text: "Jira commands: search" };
  }

  if (cmd === "pr") {
    const gh = createGitHubClientFromEnv();
    if (!gh) return { text: "GitHub integration not configured (set GITHUB_TOKEN)." };
    return { text: "PR commands available: create|review|list (not fully wired in this adapter)." };
  }

  if (cmd === "status") {
    return { text: "Cortex is running. Use /cortex skills scan to generate a SKILL.md for a repo." };
  }

  return { text: help() };
}
