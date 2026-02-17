/**
 * Shared Cortex Enterprise types.
 */

export type ChannelId = "slack" | "teams" | "googlechat" | "webhook";

export type ClassificationLevel = "public" | "internal" | "confidential" | "restricted";

export interface Actor {
  id: string;
  displayName?: string;
  email?: string;
  roles?: string[];
}

export interface RequestContext {
  requestId: string;
  channel: ChannelId;
  actor: Actor;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export interface CostRecord {
  provider: "anthropic" | "openai" | "gemini";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  usd?: number;
  meta?: Record<string, unknown>;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description?: string;
  requestedBy: Actor;
  createdAt: string;
  timeoutMs: number;
  metadata?: Record<string, unknown>;
}

export type ApprovalDecision = "approved" | "rejected" | "timeout";

export interface ApprovalResult {
  id: string;
  decision: ApprovalDecision;
  decidedBy?: Actor;
  decidedAt: string;
  reason?: string;
}

export interface AuditEvent {
  ts: string;
  event: string;
  actor?: Actor;
  channel?: ChannelId;
  classification?: ClassificationLevel;
  redacted?: boolean;
  details?: Record<string, unknown>;
}
