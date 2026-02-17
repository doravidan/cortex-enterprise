import crypto from "node:crypto";

/**
 * Minimal Jira REST API client (Cloud/DC).
 *
 * Supports API token (Basic) and OAuth2 bearer.
 * All calls are optional: if not configured, callers should handle null clients.
 */

export interface JiraAuthApiToken {
  /** Jira base URL, e.g. https://your-domain.atlassian.net */
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraAuthOAuth2 {
  baseUrl: string;
  accessToken: string;
}

export type JiraAuth = JiraAuthApiToken | JiraAuthOAuth2;

export interface JiraClientOptions {
  /** max requests per second (soft). Default 5 */
  rps?: number;
  /** optional fetch override */
  fetchImpl?: typeof fetch;
}

export interface JiraIssue {
  id: string;
  key: string;
  self?: string;
  fields?: Record<string, unknown>;
}

export interface JiraBoard {
  id: number;
  name: string;
  type?: string;
  self?: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state?: "future" | "active" | "closed" | string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  self?: string;
}

export interface JiraSearchResult {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

class RateLimiter {
  private last = 0;
  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const next = this.last + this.minIntervalMs;
    const delay = Math.max(0, next - now);
    this.last = now + delay;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
}

export class JiraClient {
  private readonly limiter: RateLimiter;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly auth: JiraAuth, opts: JiraClientOptions = {}) {
    const rps = Math.max(0.1, opts.rps ?? 5);
    this.limiter = new RateLimiter(Math.floor(1000 / rps));
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /**
   * Create a Jira issue.
   * https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post
   */
  async createIssue(input: {
    fields: Record<string, unknown>;
    update?: Record<string, unknown>;
  }): Promise<JiraIssue> {
    return this.request<JiraIssue>("POST", "/rest/api/3/issue", input);
  }

  /** Update Jira issue fields. */
  async updateIssue(issueKeyOrId: string, input: { fields?: Record<string, unknown>; update?: Record<string, unknown> }): Promise<void> {
    await this.request<void>("PUT", `/rest/api/3/issue/${encodeURIComponent(issueKeyOrId)}`, input);
  }

  /** Transition an issue to a new workflow state. */
  async transitionIssue(issueKeyOrId: string, input: { transition: { id: string }; fields?: Record<string, unknown> }): Promise<void> {
    await this.request<void>(
      "POST",
      `/rest/api/3/issue/${encodeURIComponent(issueKeyOrId)}/transitions`,
      input
    );
  }

  /** Search issues by JQL. */
  async searchJQL(input: { jql: string; startAt?: number; maxResults?: number; fields?: string[] }): Promise<JiraSearchResult> {
    const body: Record<string, unknown> = {
      jql: input.jql,
      startAt: input.startAt ?? 0,
      maxResults: input.maxResults ?? 50,
    };
    if (input.fields) body.fields = input.fields;
    return this.request<JiraSearchResult>("POST", "/rest/api/3/search", body);
  }

  /** Get a Jira Software board (Agile API). */
  async getBoard(boardId: number): Promise<JiraBoard> {
    return this.request<JiraBoard>("GET", `/rest/agile/1.0/board/${boardId}`);
  }

  /** Get sprint details (Agile API). */
  async getSprint(sprintId: number): Promise<JiraSprint> {
    return this.request<JiraSprint>("GET", `/rest/agile/1.0/sprint/${sprintId}`);
  }

  /** Add comment to an issue. */
  async addComment(issueKeyOrId: string, input: { body: unknown }): Promise<{ id: string; self?: string }> {
    return this.request("POST", `/rest/api/3/issue/${encodeURIComponent(issueKeyOrId)}/comment`, input);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "cortex-enterprise/3.0",
    };

    if ((this.auth as JiraAuthApiToken).apiToken) {
      const a = this.auth as JiraAuthApiToken;
      const basic = Buffer.from(`${a.email}:${a.apiToken}`, "utf-8").toString("base64");
      headers.authorization = `Basic ${basic}`;
    } else {
      const a = this.auth as JiraAuthOAuth2;
      headers.authorization = `Bearer ${a.accessToken}`;
    }

    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.limiter.wait();
    const baseUrl = this.auth.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}${path}`;

    const res = await this.fetchImpl(url, {
      method,
      headers: this.buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      // Jira can return HTML for some failures; keep snippet.
      const snippet = text.substring(0, 2000);
      throw new Error(`[JIRA] ${method} ${path} failed: ${res.status} ${res.statusText} :: ${snippet}`);
    }

    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

/**
 * Helper to create a JiraClient from environment variables.
 *
 * Supported env:
 * - JIRA_BASE_URL
 * - JIRA_EMAIL + JIRA_API_TOKEN  (Basic)
 * - JIRA_OAUTH_TOKEN            (Bearer)
 */
export function createJiraClientFromEnv(opts: JiraClientOptions = {}): JiraClient | null {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) return null;

  const oauth = process.env.JIRA_OAUTH_TOKEN;
  if (oauth) return new JiraClient({ baseUrl, accessToken: oauth }, opts);

  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  if (email && apiToken) return new JiraClient({ baseUrl, email, apiToken }, opts);

  return null;
}

/**
 * Compute Atlassian webhook signature (for validation / tests).
 * Some deployments use a shared secret in a header; signature schemes vary.
 */
export function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
