/**
 * Cortex Enterprise Router
 *
 * - Team catalog (system prompts)
 * - Conversation context tracking (lightweight)
 * - Heuristic routing + optional LLM intent hook
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
      "You are the central orchestrator. Analyze the request and either handle it directly " +
      "(if simple/conversational) or route to a specialist team. Keep answers concise and actionable.",
  },
  code: {
    id: "code",
    name: "Cortex Coder",
    emoji: "💻",
    systemPrompt:
      "You are the code team. You write, review, refactor, and ship code. Prefer small, safe diffs; run tests and typechecks.",
  },
  devops: {
    id: "devops",
    name: "Cortex DevOps",
    emoji: "🚀",
    systemPrompt:
      "You are the DevOps team. You manage deployments, CI/CD, Docker/K8s, observability, and incident response. Prefer staged rollouts.",
  },
  sap: {
    id: "sap",
    name: "Cortex SAP",
    emoji: "💎",
    systemPrompt:
      "You are the SAP team. You work on CAP, HANA, BTP, CF/Kyma, XSUAA, Destinations, and SAP best practices.",
  },
  cap: {
    id: "cap",
    name: "Cortex CAP",
    emoji: "🗺️",
    systemPrompt:
      "You are the CAP development team. You build CDS models, services, handlers, and OData APIs. Validate with cds build and tests.",
  },
  hana: {
    id: "hana",
    name: "Cortex HANA",
    emoji: "🗄️",
    systemPrompt:
      "You are the HANA database team. You design data models, write SQL/SQLScript, manage HDI, optimize queries, and handle HANA ops.",
  },
  btp: {
    id: "btp",
    name: "Cortex BTP",
    emoji: "☁️",
    systemPrompt:
      "You are the BTP platform team. You manage CF spaces, BTP services, XSUAA/Destination/Connectivity, and deployments.",
  },
  security: {
    id: "security",
    name: "Cortex Security",
    emoji: "🔒",
    systemPrompt:
      "You are the security team. You perform audits, review authn/authz, data classification, approvals, and compliance. Default-deny when unsure.",
  },
  research: {
    id: "research",
    name: "Cortex Research",
    emoji: "🔎",
    systemPrompt:
      "You are the research team. You investigate, read docs/code, summarize findings, and propose next steps with sources.",
  },
};

/** Get the team configuration for a given team ID. */
export function routeToTeam(teamId: TeamId): TeamConfig {
  return TEAMS[teamId] || TEAMS.orchestrator;
}

/**
 * Parse team routing from a message.
 * Supports:  /team code   /team devops   @cortex-coder
 */
export function parseTeamFromMessage(text: string): { teamId: TeamId | null; cleanText: string } {
  const teamMatch = text.match(/^\/team\s+(\w+)\s*/i);
  if (teamMatch) {
    const id = teamMatch[1].toLowerCase() as TeamId;
    if (TEAMS[id]) return { teamId: id, cleanText: text.replace(teamMatch[0], "").trim() };
  }

  const mentionMatch = text.match(/@cortex[-_](\w+)\s*/i);
  if (mentionMatch) {
    const id = mentionMatch[1].toLowerCase() as TeamId;
    if (TEAMS[id]) return { teamId: id, cleanText: text.replace(mentionMatch[0], "").trim() };
  }

  return { teamId: null, cleanText: text };
}

export function getTeamIds(): TeamId[] {
  return Object.keys(TEAMS) as TeamId[];
}

// ============================================================
// Conversation context tracking
// ============================================================

export interface ConversationContext {
  /** stable channel thread / user / room identifier */
  conversationId: string;
  activeTeam: TeamId;
  lastIntent?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Update an existing conversation context.
 */
export function updateConversationContext(
  ctx: ConversationContext,
  patch: Partial<Omit<ConversationContext, "conversationId">>
): ConversationContext {
  return {
    ...ctx,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// Heuristic routing + optional LLM intent hook
// ============================================================

export interface IntentHookResult {
  teamId?: TeamId;
  intent?: string;
  confidence?: number;
}

export type IntentHook = (input: { text: string; currentTeam: TeamId }) => Promise<IntentHookResult | null>;

/**
 * Heuristic team selection (no LLM calls).
 */
export function chooseTeamHeuristically(text: string): { teamId: TeamId; reason: string } {
  const t = text.toLowerCase();

  const matchAny = (xs: string[]) => xs.some((x) => t.includes(x));

  if (matchAny(["vulnerability", "cve", "soc2", "gdpr", "pii", "secrets", "rbac", "audit", "approval"])) {
    return { teamId: "security", reason: "security keywords" };
  }
  if (matchAny(["docker", "kubernetes", "helm", "ci", "cd", "pipeline", "deploy", "terraform", "observability", "prometheus", "grafana"])) {
    return { teamId: "devops", reason: "devops keywords" };
  }
  if (matchAny(["cap", "cds", "xsuaa", "btp", "cloud foundry", "hana", "fiori", "ui5", "mta.yaml", "integration suite"])) {
    return { teamId: "sap", reason: "sap keywords" };
  }
  if (matchAny(["pull request", "pr ", "typescript", "refactor", "unit test", "bug", "compile", "tsc", "npm", "pnpm"])) {
    return { teamId: "code", reason: "code keywords" };
  }
  if (matchAny(["research", "investigate", "docs", "confluence", "sharepoint"])) {
    return { teamId: "research", reason: "research keywords" };
  }

  return { teamId: "orchestrator", reason: "default" };
}

/**
 * Choose a team for text. Uses heuristic routing and optionally an intent hook.
 */
export async function chooseTeam(params: {
  text: string;
  currentTeam: TeamId;
  intentHook?: IntentHook;
}): Promise<{ teamId: TeamId; intent?: string; reason: string }> {
  const heuristic = chooseTeamHeuristically(params.text);

  if (params.intentHook) {
    try {
      const r = await params.intentHook({ text: params.text, currentTeam: params.currentTeam });
      if (r?.teamId && TEAMS[r.teamId]) {
        return { teamId: r.teamId, intent: r.intent, reason: "intentHook" };
      }
    } catch {
      // ignore hook failures
    }
  }

  return { teamId: heuristic.teamId, reason: heuristic.reason };
}
