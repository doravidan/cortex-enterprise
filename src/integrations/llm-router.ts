import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CostRecord } from "../types/index.js";

/**
 * LLM Router
 *
 * - Task-based routing (chat vs code vs summarize)
 * - Fallback chain between providers
 * - Cost tracking + budget enforcement
 *
 * NOTE: This module is provider-SDK based (API keys), separate from Claude Code CLI.
 * If keys are absent, providers are considered unavailable.
 */

export type LLMProviderId = "anthropic" | "openai" | "gemini";

export type LLMTask =
  | "chat"
  | "code"
  | "summarize"
  | "classify"
  | "extract"
  | "tool";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  task: LLMTask;
  messages: LLMMessage[];
  /** hard cap in USD for this call (optional) */
  maxUsd?: number;
  /** high-level tags for telemetry */
  tags?: string[];
  /** temperature (best-effort) */
  temperature?: number;
  /** provider override */
  provider?: LLMProviderId;
}

export interface LLMResponse {
  provider: LLMProviderId;
  model: string;
  text: string;
  cost?: CostRecord;
  raw?: unknown;
}

export interface BudgetState {
  /** cumulative cost in USD */
  spentUsd: number;
  /** budget ceiling in USD */
  budgetUsd: number;
}

export interface LLMRouterOptions {
  /** Defaults: anthropic -> openai -> gemini */
  fallbackChain?: LLMProviderId[];
  /** Optional budget state reference; router will increment spentUsd */
  budget?: BudgetState;
}

function approxUsdFromTokens(_provider: LLMProviderId, _model: string, inputTokens?: number, outputTokens?: number): number | undefined {
  // Intentionally conservative / approximate; real pricing varies by plan.
  if (inputTokens == null && outputTokens == null) return undefined;
  const inT = inputTokens ?? 0;
  const outT = outputTokens ?? 0;
  // Use generic $5/M input and $15/M output as a rough ceiling.
  return (inT * 5e-6) + (outT * 15e-6);
}

export class LLMRouter {
  private readonly chain: LLMProviderId[];
  private anthropic: Anthropic | null;
  private openai: OpenAI | null;
  private gemini: GoogleGenerativeAI | null;

  constructor(private readonly opts: LLMRouterOptions = {}) {
    this.chain = opts.fallbackChain ?? ["anthropic", "openai", "gemini"];
    this.anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    this.gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
  }

  /**
   * Route a request using task heuristics unless provider override is specified.
   */
  async complete(req: LLMRequest): Promise<LLMResponse> {
    const budget = this.opts.budget;
    if (budget && budget.spentUsd >= budget.budgetUsd) {
      throw new Error(`[LLM] Budget exceeded: spent $${budget.spentUsd.toFixed(2)} / $${budget.budgetUsd.toFixed(2)}`);
    }

    const chain = req.provider ? [req.provider] : this.pickChainForTask(req.task);

    let lastErr: unknown;
    for (const provider of chain) {
      try {
        const out = await this.callProvider(provider, req);
        const usd = out.cost?.usd;
        if (budget && typeof usd === "number") {
          if (req.maxUsd != null && usd > req.maxUsd) {
            throw new Error(`[LLM] Call cost $${usd.toFixed(4)} exceeds maxUsd $${req.maxUsd.toFixed(4)}`);
          }
          if (budget.spentUsd + usd > budget.budgetUsd) {
            throw new Error(`[LLM] Budget would be exceeded by this call ($${usd.toFixed(4)}).`);
          }
          budget.spentUsd += usd;
        }
        return out;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private pickChainForTask(task: LLMTask): LLMProviderId[] {
    // Heuristic ordering; can be configured externally.
    if (task === "code" || task === "tool") return this.chain;
    if (task === "summarize" || task === "extract") return this.chain;
    if (task === "classify") return this.chain;
    return this.chain;
  }

  private async callProvider(provider: LLMProviderId, req: LLMRequest): Promise<LLMResponse> {
    if (provider === "anthropic") return this.callAnthropic(req);
    if (provider === "openai") return this.callOpenAI(req);
    return this.callGemini(req);
  }

  private async callAnthropic(req: LLMRequest): Promise<LLMResponse> {
    if (!this.anthropic) throw new Error("[LLM] Anthropic not configured");
    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

    const system = req.messages.find((m) => m.role === "system")?.content;
    const messages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content } as const));

    const r = await this.anthropic.messages.create({
      model,
      system,
      messages,
      max_tokens: 1024,
      temperature: req.temperature,
    });

    const text = r.content
      .map((c: any) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    const cost: CostRecord = {
      provider: "anthropic",
      model,
      inputTokens: (r as any).usage?.input_tokens,
      outputTokens: (r as any).usage?.output_tokens,
    };
    cost.usd = approxUsdFromTokens("anthropic", model, cost.inputTokens, cost.outputTokens);

    return { provider: "anthropic", model, text, cost, raw: r };
  }

  private async callOpenAI(req: LLMRequest): Promise<LLMResponse> {
    if (!this.openai) throw new Error("[LLM] OpenAI not configured");
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const r = await this.openai.chat.completions.create({
      model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature,
    });

    const text = r.choices?.[0]?.message?.content?.trim() ?? "";
    const cost: CostRecord = {
      provider: "openai",
      model,
      inputTokens: (r as any).usage?.prompt_tokens,
      outputTokens: (r as any).usage?.completion_tokens,
    };
    cost.usd = approxUsdFromTokens("openai", model, cost.inputTokens, cost.outputTokens);

    return { provider: "openai", model, text, cost, raw: r };
  }

  private async callGemini(req: LLMRequest): Promise<LLMResponse> {
    if (!this.gemini) throw new Error("[LLM] Gemini not configured");
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const gm = this.gemini.getGenerativeModel({ model });

    // Gemini API uses a different message format.
    const system = req.messages.find((m) => m.role === "system")?.content;
    const userText = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const prompt = system ? `${system}\n\n${userText}` : userText;
    const r = await gm.generateContent(prompt);
    const text = r.response.text().trim();

    const cost: CostRecord = { provider: "gemini", model };
    // Token usage not always returned; keep undefined.

    return { provider: "gemini", model, text, cost, raw: r };
  }
}
