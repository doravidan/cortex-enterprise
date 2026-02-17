import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

/**
 * GitHub integration via Octokit.
 * Optional: if GITHUB_TOKEN is missing, createGitHubClientFromEnv returns null.
 */

export interface GitHubClientOptions {
  userAgent?: string;
  baseUrl?: string;
}

export interface CreatePROptions {
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body?: string;
  draft?: boolean;
}

export interface ReviewPROptions {
  owner: string;
  repo: string;
  pull_number: number;
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  body?: string;
}

export interface ListPROptions {
  owner: string;
  repo: string;
  state?: "open" | "closed" | "all";
  per_page?: number;
}

export interface WorkflowRunsOptions {
  owner: string;
  repo: string;
  per_page?: number;
  branch?: string;
}

export interface CreateIssueOptions {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface SearchCodeOptions {
  q: string;
  per_page?: number;
}

export type GitHubEventSummary = {
  kind: "pull_request" | "workflow_run" | "security_alert" | "push" | "unknown";
  title: string;
  repo?: string;
  url?: string;
  actor?: string;
  details?: Record<string, unknown>;
};

export class GitHubClient {
  constructor(public readonly octokit: Octokit) {}

  /** Create a pull request. */
  async createPR(opts: CreatePROptions) {
    const res = await this.octokit.pulls.create(opts as any);
    return res.data;
  }

  /** Submit a PR review. */
  async reviewPR(opts: ReviewPROptions) {
    const res = await this.octokit.pulls.createReview(opts as any);
    return res.data;
  }

  /** List pull requests. */
  async listPRs(opts: ListPROptions) {
    const res = await this.octokit.pulls.list({
      owner: opts.owner,
      repo: opts.repo,
      state: opts.state ?? "open",
      per_page: opts.per_page ?? 20,
    });
    return res.data;
  }

  /** Get workflow runs for repository. */
  async getWorkflowRuns(opts: WorkflowRunsOptions) {
    const res = await this.octokit.actions.listWorkflowRunsForRepo({
      owner: opts.owner,
      repo: opts.repo,
      per_page: opts.per_page ?? 20,
      branch: opts.branch,
    });
    return res.data;
  }

  /** Create an issue. */
  async createIssue(opts: CreateIssueOptions) {
    const res = await this.octokit.issues.create(opts as any);
    return res.data;
  }

  /** Search code across GitHub (requires token scopes depending on org settings). */
  async searchCode(opts: SearchCodeOptions) {
    const res = await this.octokit.search.code({ q: opts.q, per_page: opts.per_page ?? 10 });
    return res.data;
  }
}

/**
 * Validate GitHub webhook signature (x-hub-signature-256).
 */
export function verifyGitHubWebhookSignature(params: {
  secret: string;
  payloadRawBody: Buffer | string;
  signature256Header: string | undefined;
}): boolean {
  const { secret, payloadRawBody, signature256Header } = params;
  if (!signature256Header) return false;
  const raw = typeof payloadRawBody === "string" ? Buffer.from(payloadRawBody, "utf-8") : payloadRawBody;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature256Header), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Summarize common GitHub webhook events into a short message for the assistant.
 */
export function summarizeGitHubWebhookEvent(eventName: string, payload: any): GitHubEventSummary {
  try {
    if (eventName === "pull_request") {
      const pr = payload.pull_request;
      return {
        kind: "pull_request",
        title: `PR ${payload.action}: #${pr.number} ${pr.title}`,
        repo: payload.repository?.full_name,
        url: pr.html_url,
        actor: payload.sender?.login,
        details: {
          base: pr.base?.ref,
          head: pr.head?.ref,
          draft: pr.draft,
          merged: pr.merged,
        },
      };
    }

    if (eventName === "workflow_run") {
      const wr = payload.workflow_run;
      return {
        kind: "workflow_run",
        title: `Workflow ${wr.name}: ${wr.conclusion || wr.status}`,
        repo: payload.repository?.full_name,
        url: wr.html_url,
        actor: wr.actor?.login,
        details: { event: wr.event, branch: wr.head_branch, run_number: wr.run_number },
      };
    }

    if (eventName === "push") {
      return {
        kind: "push",
        title: `Push: ${payload.ref} (${payload.commits?.length ?? 0} commits)` ,
        repo: payload.repository?.full_name,
        url: payload.compare,
        actor: payload.sender?.login,
      };
    }

    return {
      kind: "unknown",
      title: `GitHub event: ${eventName}`,
      repo: payload.repository?.full_name,
    };
  } catch {
    return { kind: "unknown", title: `GitHub event: ${eventName}` };
  }
}

/** Create an authenticated GitHub client from env (GITHUB_TOKEN). */
export function createGitHubClientFromEnv(opts: GitHubClientOptions = {}): GitHubClient | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const octokit = new Octokit({
    auth: token,
    userAgent: opts.userAgent ?? "cortex-enterprise/3.0",
    baseUrl: opts.baseUrl,
  });
  return new GitHubClient(octokit);
}
