import { mkdir, appendFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEvent } from "../types/index.js";

/**
 * Audit logging
 * - JSONL local log
 * - Optional Supabase sink
 * - Redaction / masking helpers
 */

export interface AuditLoggerOptions {
  jsonlPath: string;
  supabase?: SupabaseClient | null;
  supabaseTable?: string;
  /** additional redaction patterns */
  redactPatterns?: RegExp[];
}

const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  // API keys / bearer tokens
  /Bearer\s+[A-Za-z0-9\-_.=]+/g,
  /(api[_-]?key\s*[:=]\s*)([A-Za-z0-9\-_.]{8,})/gi,
  /(token\s*[:=]\s*)([A-Za-z0-9\-_.]{8,})/gi,
  // Slack tokens
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
];

export function redactText(text: string, patterns: RegExp[] = DEFAULT_REDACT_PATTERNS): { redacted: string; changed: boolean } {
  let out = text;
  let changed = false;
  for (const p of patterns) {
    const before = out;
    out = out.replace(p, (m, g1, g2) => {
      changed = true;
      if (typeof g1 === "string" && typeof g2 === "string") return `${g1}[REDACTED]`;
      return "[REDACTED]";
    });
    if (out !== before) changed = true;
  }
  return { redacted: out, changed };
}

export class AuditLogger {
  private readonly table: string;
  private readonly patterns: RegExp[];

  constructor(private readonly opts: AuditLoggerOptions) {
    this.table = opts.supabaseTable ?? "audit_log";
    this.patterns = [...DEFAULT_REDACT_PATTERNS, ...(opts.redactPatterns ?? [])];
  }

  /**
   * Write an audit event (best-effort). Never throws on sink failures.
   */
  async log(event: AuditEvent): Promise<void> {
    const line = JSON.stringify(event);
    const { redacted, changed } = redactText(line, this.patterns);
    const final = changed ? JSON.stringify({ ...event, redacted: true, details: { ...(event.details ?? {}), _redacted: true } }) : event;

    try {
      await mkdir(dirname(this.opts.jsonlPath), { recursive: true });
      await appendFile(this.opts.jsonlPath, `${JSON.stringify(final)}\n`, "utf-8");
    } catch {
      // ignore
    }

    if (this.opts.supabase) {
      try {
        await this.opts.supabase.from(this.table).insert({
          ts: event.ts,
          event: event.event,
          actor: event.actor ?? null,
          channel: event.channel ?? null,
          classification: event.classification ?? null,
          redacted: (final as any).redacted ?? false,
          details: event.details ?? null,
        });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Search JSONL log file by substring (simple, local).
   */
  async search(params: { query: string; limit?: number }): Promise<AuditEvent[]> {
    const limit = params.limit ?? 50;
    const content = await readFile(this.opts.jsonlPath, "utf-8").catch(() => "");
    const lines = content.split(/\r?\n/).filter(Boolean);
    const out: AuditEvent[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (!l.includes(params.query)) continue;
      try {
        out.push(JSON.parse(l) as AuditEvent);
        if (out.length >= limit) break;
      } catch {
        // ignore parse errors
      }
    }
    return out;
  }
}
