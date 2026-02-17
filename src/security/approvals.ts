import crypto from "node:crypto";
import type { ApprovalRequest, ApprovalResult, Actor } from "../types/index.js";

/**
 * Approval flow for sensitive actions.
 *
 * - createApproval(): returns a Promise resolved by approve/reject/timeout
 * - Slack Block Kit builders for interactive buttons
 *
 * Storage is in-memory by default; production deployments should persist externally.
 */

export interface ApprovalManagerOptions {
  defaultTimeoutMs?: number;
}

export interface SlackApprovalBlockParams {
  requestId: string;
  title: string;
  description?: string;
}

export type SlackBlock = Record<string, unknown>;

export function buildSlackApprovalBlocks(p: SlackApprovalBlockParams): SlackBlock[] {
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Approval required*: ${p.title}\n${p.description ?? ""}`.trim() },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "cortex_approval_approve",
          value: p.requestId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "cortex_approval_reject",
          value: p.requestId,
        },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: `Request ID: \`${p.requestId}\`` }] },
  ];
}

export class ApprovalManager {
  private readonly pending = new Map<
    string,
    {
      req: ApprovalRequest;
      resolve: (r: ApprovalResult) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(private readonly opts: ApprovalManagerOptions = {}) {}

  /**
   * Create a new approval request. The returned promise resolves on decision.
   */
  createApproval(params: {
    title: string;
    description?: string;
    requestedBy: Actor;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
  }): { request: ApprovalRequest; result: Promise<ApprovalResult> } {
    const id = crypto.randomUUID();
    const timeoutMs = params.timeoutMs ?? this.opts.defaultTimeoutMs ?? 5 * 60_000;
    const request: ApprovalRequest = {
      id,
      title: params.title,
      description: params.description,
      requestedBy: params.requestedBy,
      createdAt: new Date().toISOString(),
      timeoutMs,
      metadata: params.metadata,
    };

    let resolveFn!: (r: ApprovalResult) => void;
    const result = new Promise<ApprovalResult>((resolve) => {
      resolveFn = resolve;
    });

    const timer = setTimeout(() => {
      this.pending.delete(id);
      resolveFn({ id, decision: "timeout", decidedAt: new Date().toISOString() });
    }, timeoutMs);

    this.pending.set(id, { req: request, resolve: resolveFn, timer });
    return { request, result };
  }

  /** Decide an approval (approve/reject). */
  decide(params: { requestId: string; decision: "approved" | "rejected"; actor: Actor; reason?: string }): boolean {
    const p = this.pending.get(params.requestId);
    if (!p) return false;
    clearTimeout(p.timer);
    this.pending.delete(params.requestId);
    p.resolve({
      id: params.requestId,
      decision: params.decision,
      decidedBy: params.actor,
      decidedAt: new Date().toISOString(),
      reason: params.reason,
    });
    return true;
  }

  getPending(requestId: string): ApprovalRequest | null {
    return this.pending.get(requestId)?.req ?? null;
  }
}
