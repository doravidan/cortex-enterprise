/**
 * Memory Module — Enterprise Knowledge Management
 *
 * Same pattern as claude-telegram-relay/src/memory.ts but adapted for
 * enterprise: team knowledge, project decisions, architecture context.
 *
 * Claude manages memory via intent tags in its responses:
 *   [REMEMBER: fact]
 *   [GOAL: text | DEADLINE: date]
 *   [DONE: search text]
 *
 * The relay parses these, saves to Supabase, and strips them from
 * the response before sending to the channel.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// SUPABASE CLIENT
// ============================================================

export function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("[MEMORY] Supabase not configured — memory is session-only");
    return null;
  }

  console.log("[MEMORY] Supabase connected — persistent memory enabled");
  return createClient(url, key);
}

// ============================================================
// MEMORY INTENT PROCESSING
// ============================================================

/**
 * Parse Claude's response for memory intent tags.
 * Saves facts/goals to Supabase and returns the cleaned response.
 */
export async function processMemoryIntents(
  supabase: SupabaseClient | null,
  response: string
): Promise<string> {
  if (!supabase) return stripMemoryTags(response);

  let clean = response;

  // [REMEMBER: fact to store]
  for (const match of response.matchAll(/\[REMEMBER:\s*(.+?)\]/gi)) {
    try {
      await supabase.from("memory").insert({
        type: "fact",
        content: match[1],
      });
      console.log(`[MEMORY] Stored fact: ${match[1].substring(0, 60)}...`);
    } catch (error) {
      console.error("[MEMORY] Save fact error:", error);
    }
    clean = clean.replace(match[0], "");
  }

  // [GOAL: text] or [GOAL: text | DEADLINE: date]
  for (const match of response.matchAll(
    /\[GOAL:\s*(.+?)(?:\s*\|\s*DEADLINE:\s*(.+?))?\]/gi
  )) {
    try {
      await supabase.from("memory").insert({
        type: "goal",
        content: match[1],
        deadline: match[2] || null,
      });
      console.log(`[MEMORY] Stored goal: ${match[1].substring(0, 60)}...`);
    } catch (error) {
      console.error("[MEMORY] Save goal error:", error);
    }
    clean = clean.replace(match[0], "");
  }

  // [DONE: search text for completed goal]
  for (const match of response.matchAll(/\[DONE:\s*(.+?)\]/gi)) {
    try {
      const { data } = await supabase
        .from("memory")
        .select("id")
        .eq("type", "goal")
        .ilike("content", `%${match[1]}%`)
        .limit(1);

      if (data?.[0]) {
        await supabase
          .from("memory")
          .update({
            type: "completed_goal",
            completed_at: new Date().toISOString(),
          })
          .eq("id", data[0].id);
        console.log(`[MEMORY] Goal completed: ${match[1].substring(0, 60)}...`);
      }
    } catch (error) {
      console.error("[MEMORY] Complete goal error:", error);
    }
    clean = clean.replace(match[0], "");
  }

  return clean.trim();
}

/**
 * Strip memory tags without saving (when Supabase is not configured).
 */
function stripMemoryTags(response: string): string {
  return response
    .replace(/\[REMEMBER:\s*.+?\]/gi, "")
    .replace(/\[GOAL:\s*.+?\]/gi, "")
    .replace(/\[DONE:\s*.+?\]/gi, "")
    .trim();
}

// ============================================================
// MEMORY CONTEXT RETRIEVAL
// ============================================================

/**
 * Get all facts and active goals for prompt enrichment.
 */
export async function getMemoryContext(
  supabase: SupabaseClient | null
): Promise<string> {
  if (!supabase) return "";

  try {
    const [factsResult, goalsResult] = await Promise.all([
      supabase.rpc("get_facts"),
      supabase.rpc("get_active_goals"),
    ]);

    const parts: string[] = [];

    if (factsResult.data?.length) {
      parts.push(
        "KNOWN FACTS:\n" +
        factsResult.data.map((f: any) => `- ${f.content}`).join("\n")
      );
    }

    if (goalsResult.data?.length) {
      parts.push(
        "ACTIVE GOALS:\n" +
        goalsResult.data
          .map((g: any) => {
            const deadline = g.deadline
              ? ` (by ${new Date(g.deadline).toLocaleDateString()})`
              : "";
            return `- ${g.content}${deadline}`;
          })
          .join("\n")
      );
    }

    return parts.join("\n\n");
  } catch (error) {
    console.error("[MEMORY] Context error:", error);
    return "";
  }
}

/**
 * Semantic search for relevant past messages.
 * Uses Supabase Edge Function (no OpenAI key needed locally).
 */
export async function getRelevantContext(
  supabase: SupabaseClient | null,
  query: string
): Promise<string> {
  if (!supabase) return "";

  try {
    const { data, error } = await supabase.functions.invoke("search", {
      body: { query, match_count: 5, table: "messages" },
    });

    if (error || !data?.length) return "";

    return (
      "RELEVANT PAST MESSAGES:\n" +
      data
        .map((m: any) => `[${m.role}] (${m.channel}): ${m.content}`)
        .join("\n")
    );
  } catch {
    // Search not available yet — that's fine
    return "";
  }
}
