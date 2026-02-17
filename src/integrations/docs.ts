/**
 * Docs integrations:
 * - Confluence REST (read/search/upsert)
 * - SharePoint via Microsoft Graph (read/search/upsert)
 *
 * All integrations are optional. Prefer creating clients via create*FromEnv.
 */

export interface TextChunk {
  id: string;
  text: string;
  meta?: Record<string, unknown>;
}

export function chunkText(params: {
  text: string;
  maxChars?: number;
  overlapChars?: number;
  prefix?: string;
}): TextChunk[] {
  const maxChars = Math.max(200, params.maxChars ?? 2000);
  const overlap = Math.max(0, Math.min(maxChars - 1, params.overlapChars ?? 200));
  const text = params.text || "";
  const chunks: TextChunk[] = [];
  let i = 0;
  let idx = 0;

  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    const slice = text.slice(i, end);
    const id = `${params.prefix ?? "chunk"}-${idx}`;
    chunks.push({ id, text: slice });
    idx += 1;
    if (end >= text.length) break;
    i = end - overlap;
  }

  return chunks;
}

// ============================================================
// Confluence
// ============================================================

export interface ConfluenceAuth {
  baseUrl: string; // e.g. https://your-domain.atlassian.net/wiki
  email: string;
  apiToken: string;
}

export interface ConfluenceClientOptions {
  fetchImpl?: typeof fetch;
}

export interface ConfluencePage {
  id: string;
  title: string;
  type?: string;
  spaceId?: string;
  body?: any;
  version?: { number: number };
  _links?: { webui?: string };
}

export class ConfluenceClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly auth: ConfluenceAuth, opts: ConfluenceClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const basic = Buffer.from(`${this.auth.email}:${this.auth.apiToken}`, "utf-8").toString("base64");
    return {
      authorization: `Basic ${basic}`,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "cortex-enterprise/3.0",
    };
  }

  private url(path: string): string {
    return `${this.auth.baseUrl.replace(/\/$/, "")}${path}`;
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    return this.request("GET", `/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`);
  }

  async search(query: string, limit: number = 10): Promise<ConfluencePage[]> {
    const q = encodeURIComponent(query);
    const res = await this.request<{ results: ConfluencePage[] }>(
      "GET",
      `/wiki/rest/api/search?cql=${q}&limit=${limit}`
    );
    return res.results ?? [];
  }

  /** Upsert a page by id (update) or create if id is absent. */
  async upsertPage(params: {
    pageId?: string;
    spaceId: string;
    title: string;
    storageHtml: string;
  }): Promise<ConfluencePage> {
    if (!params.pageId) {
      return this.request("POST", "/api/v2/pages", {
        spaceId: params.spaceId,
        title: params.title,
        body: { representation: "storage", value: params.storageHtml },
      });
    }

    const current = await this.getPage(params.pageId);
    const nextVersion = (current.version?.number ?? 1) + 1;
    return this.request("PUT", `/api/v2/pages/${encodeURIComponent(params.pageId)}`, {
      id: params.pageId,
      status: "current",
      title: params.title,
      version: { number: nextVersion },
      body: { representation: "storage", value: params.storageHtml },
    });
  }

  private async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(this.url(path), {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[CONFLUENCE] ${method} ${path} failed: ${res.status} ${res.statusText} :: ${text.substring(0, 1000)}`);
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

export function createConfluenceClientFromEnv(): ConfluenceClient | null {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const email = process.env.CONFLUENCE_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  if (!baseUrl || !email || !apiToken) return null;
  return new ConfluenceClient({ baseUrl, email, apiToken });
}

// ============================================================
// SharePoint via Microsoft Graph
// ============================================================

export interface GraphAuth {
  /** OAuth2 access token for Microsoft Graph */
  accessToken: string;
}

export interface SharePointClientOptions {
  fetchImpl?: typeof fetch;
}

export interface SharePointDriveItem {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
}

export class SharePointClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly auth: GraphAuth, opts: SharePointClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.auth.accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "cortex-enterprise/3.0",
    };
  }

  async search(params: { query: string; top?: number }): Promise<SharePointDriveItem[]> {
    // Graph search endpoint (simplified). Many orgs require Search API permissions.
    const top = params.top ?? 10;
    const body = {
      requests: [
        {
          entityTypes: ["driveItem"],
          query: { queryString: params.query },
          from: 0,
          size: top,
        },
      ],
    };

    const res = await this.request<any>("POST", "https://graph.microsoft.com/v1.0/search/query", body);
    const hits = res?.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
    return hits
      .map((h: any) => h.resource)
      .filter(Boolean)
      .map((r: any) => ({ id: r.id, name: r.name, webUrl: r.webUrl, lastModifiedDateTime: r.lastModifiedDateTime }));
  }

  /** Read a drive item content as text (best-effort). */
  async readItemContent(params: { driveId: string; itemId: string }): Promise<string> {
    const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(params.driveId)}/items/${encodeURIComponent(params.itemId)}/content`;
    const res = await this.fetchImpl(url, { method: "GET", headers: { authorization: `Bearer ${this.auth.accessToken}` } });
    const text = await res.text();
    if (!res.ok) throw new Error(`[GRAPH] read content failed: ${res.status} ${res.statusText} :: ${text.substring(0, 1000)}`);
    return text;
  }

  /** Upsert a text file into a drive path. */
  async upsertTextFile(params: { driveId: string; path: string; content: string }): Promise<SharePointDriveItem> {
    const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(params.driveId)}/root:/${params.path.replace(/^\//, "") }:/content`;
    const res = await this.fetchImpl(url, {
      method: "PUT",
      headers: { authorization: `Bearer ${this.auth.accessToken}`, "content-type": "text/plain" },
      body: params.content,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[GRAPH] upsert failed: ${res.status} ${res.statusText} :: ${text.substring(0, 1000)}`);
    return JSON.parse(text) as SharePointDriveItem;
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(url, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[GRAPH] ${method} ${url} failed: ${res.status} ${res.statusText} :: ${text.substring(0, 1000)}`);
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

export function createSharePointClientFromEnv(): SharePointClient | null {
  const token = process.env.MS_GRAPH_TOKEN;
  if (!token) return null;
  return new SharePointClient({ accessToken: token });
}
