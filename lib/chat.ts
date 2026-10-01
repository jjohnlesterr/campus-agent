import "server-only"

import type { StructuredAnswer } from "@/lib/ai/answer-types"
import type { ChatMessage, RecentConversation } from "@/lib/ai/chat-types"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

function toAnswer(meta: Json | null): StructuredAnswer | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null
  const m = meta as Record<string, unknown>
  if (typeof m.summary !== "string" || typeof m.status !== "string") return null
  return {
    status: m.status as StructuredAnswer["status"],
    summary: m.summary,
    steps: Array.isArray(m.steps) ? (m.steps as string[]) : [],
    requirements: Array.isArray(m.requirements) ? (m.requirements as string[]) : [],
    details: typeof m.details === "string" ? m.details : "",
    gaps: typeof m.gaps === "string" ? m.gaps : "",
    sources: Array.isArray(m.sources) ? (m.sources as StructuredAnswer["sources"]) : [],
  }
}

export function toChatMessage(row: {
  id: string
  role: "user" | "assistant"
  content: string
  response_metadata: Json | null
  created_at: string
}): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    answer: row.role === "assistant" ? toAnswer(row.response_metadata) : null,
    createdAt: row.created_at,
  }
}

/** A conversation and its messages, or null if it isn't the caller's (RLS). */
export async function getConversation(id: string) {
  const supabase = await createClient()
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("id, title").eq("id", id).maybeSingle(),
    supabase
      .from("messages")
      .select("id, role, content, response_metadata, created_at")
      .eq("conversation_id", id)
      .order("created_at"),
  ])
  if (!conversation) return null
  return { conversation, messages: (messages ?? []).map(toChatMessage) }
}

export async function getRecentConversations(limit = 15): Promise<RecentConversation[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("conversations")
    .select("id, title")
    .order("updated_at", { ascending: false })
    .limit(limit)
  return data ?? []
}
