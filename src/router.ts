/**
 * Team Agent Router
 *
 * Maps team IDs to their identity and system prompts.
 * The orchestrator decides which team handles a message;
 * this module provides the context for that team.
 */

export type TeamId =
  | "orchestrator"
  | "code"
  | "devops"
  | "sap"
  | "cap"
  | "hana"
  | "btp"
  | "security"
  | "research";

export interface TeamConfig {
  id: TeamId;
  name: string;
  emoji: string;
  systemPrompt: string;
}

const TEAMS: Record<TeamId, TeamConfig> = {
  orchestrator: {
    id: "orchestrator",
    name: "Cortex Orchestrator",
    emoji: "🧠",
    systemPrompt:
      "You are the central orchestrator. Analyse the request and either handle it " +
      "directly (if simple/conversational) or indicate which team should handle it: " +
      "code (coding, PRs), devops (deployments, CI/CD), sap (CAP, HANA, BTP), " +
      "security (audits, compliance), or research (investigation, docs).",
  },
  code: {
    id: "code",
    name: "Cortex Coder",
    emoji: "💻",
    systemPrompt:
      "You are the code team. You write, review, refactor, and ship code. " +
      "Create pull requests, run tests, perform code reviews. Follow project " +
      "coding standards and test coverage requirements.",
  },
  devops: {
    id: "devops",
    name: "Cortex DevOps",
    emoji: "🚀",
    systemPrompt:
      "You are the DevOps team. You manage deployments, CI/CD pipelines, " +
      "Docker images, Kubernetes manifests, Cloud Foundry apps, and " +
      "infrastructure. Always validate in staging before production.",
  },
  sap: {
    id: "sap",
    name: "Cortex SAP",
    emoji: "💎",
    systemPrompt:
      "You are the SAP team. You build CAP applications, manage Cloud Foundry " +
      "deployments, query HANA databases, configure BTP services, and work " +
      "with Kyma/Kubernetes. Follow SAP best practices.",
  },
  cap: {
    id: "cap",
    name: "Cortex CAP",
    emoji: "🏗️",
    systemPrompt:
      "You are the CAP development team. You build SAP Cloud Application " +
      "Programming Model projects — CDS models, services, custom handlers, " +
      "Fiori UIs, and OData APIs. Use cds build before deploy.",
  },
  hana: {
    id: "hana",
    name: "Cortex HANA",
    emoji: "🗄️",
    systemPrompt:
      "You are the HANA database team. You design data models, write SQL and " +
      "SQLScript, manage HDI containers, optimise queries, and handle HANA " +
      "Cloud administration. Always validate SQL before production.",
  },
  btp: {
    id: "btp",
    name: "Cortex BTP",
    emoji: "☁️",
    systemPrompt:
      "You are the BTP platform team. You manage Cloud Foundry apps, SAP BTP " +
      "services (XSUAA, Destination, Connectivity), Kyma deployments, and " +
      "CI/CD pipelines. Use blue-green deployments for production.",
  },
  security: {
    id: "security",
    name: "Cortex Security",
    emoji: "🔒",
    systemPrompt:
      "You are the security team. You perform security audits, check " +
      "dependencies for vulnerabilities, review authentication flows, " +
      "verify TLS, and ensure GDPR/SOC2/SAP compliance.",
  },
  research: {
    id: "research",
    name: "Cortex Research",
    emoji: "🔍",
    systemPrompt:
      "You are the research team. You investigate issues, search codebases, " +
      "read documentation, summarise findings, and build knowledge base " +
      "entries. Prefer depth over speed.",
  },
};

/**
 * Get the team configuration for a given team ID.
 * Falls back to orchestrator for unknown IDs.
 */
export function routeToTeam(teamId: TeamId): TeamConfig {
  return TEAMS[teamId] || TEAMS.orchestrator;
}

/**
 * Parse team routing from a message.
 * Supports:  /team code   /team devops   @cortex-coder   etc.
 */
export function parseTeamFromMessage(text: string): { teamId: TeamId | null; cleanText: string } {
  // /team <id> syntax
  const teamMatch = text.match(/^\/team\s+(\w+)\s*/i);
  if (teamMatch) {
    const id = teamMatch[1].toLowerCase() as TeamId;
    if (TEAMS[id]) {
      return {
        teamId: id,
        cleanText: text.replace(teamMatch[0], "").trim(),
      };
    }
  }

  // @cortex-<team> syntax
  const mentionMatch = text.match(/@cortex[-_](\w+)\s*/i);
  if (mentionMatch) {
    const id = mentionMatch[1].toLowerCase() as TeamId;
    if (TEAMS[id]) {
      return {
        teamId: id,
        cleanText: text.replace(mentionMatch[0], "").trim(),
      };
    }
  }

  return { teamId: null, cleanText: text };
}

/**
 * Get all available team IDs.
 */
export function getTeamIds(): TeamId[] {
  return Object.keys(TEAMS) as TeamId[];
}
