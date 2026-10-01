"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { StructuredAnswer } from "@/lib/ai/answer-types"
import { answerQuestion } from "@/lib/ai/campus-agent"
import type { AskResult } from "@/lib/ai/chat-types"
import { requireProfile } from "@/lib/auth"
import { toChatMessage } from "@/lib/chat"
import { createClient } from "@/lib/supabase/server"

const askSchema = z.object({
  conversationId: z.uuid().nullable(),
  question: z.string().trim().min(2, "Type a question first.").max(1000, "Keep your question under 1,000 characters."),
})

/** Conversation title from the first question, e.g. "How do I fix an INC?" */
function titleFrom(question: string) {
  const oneLine = question.replace(/\s+/g, " ").trim()
  if (oneLine.length <= 60) return oneLine
  return `${oneLine.slice(0, 57).replace(/\s+\S*$/, "")}…`
}

/**
 * Saves the student's question, answers it from the handbook, and saves the
 * answer. Creates the conversation on the first question.
 */
export async function askCampusAgent(conversationId: string | null, question: string): Promise<AskResult> {
  const profile = await requireProfile()
  const parsed = askSchema.safeParse({ conversationId, question })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question." }
  const q = parsed.data.question

  const supabase = await createClient()
  let id = parsed.data.conversationId
  const isNew = !id
  if (id) {
    // RLS: only the owner's conversation is visible.
    const { data } = await supabase.from("conversations").select("id").eq("id", id).maybeSingle()
    if (!data) return { ok: false, error: "This conversation could not be found." }
  } else {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: profile.id, title: titleFrom(q) })
      .select("id")
      .single()
    if (error || !data) return { ok: false, error: "Your conversation could not be started. Please try again." }
    id = data.id
  }

  const { data: userRow, error: userError } = await supabase
    .from("messages")
    .insert({ conversation_id: id, role: "user", content: q })
    .select("id, role, content, response_metadata, created_at")
    .single()
  if (userError || !userRow) return { ok: false, error: "Your question could not be saved. Please try again." }

  const result = await answerQuestion(q)
  const answer: StructuredAnswer = {
    status: result.status,
    summary: result.summary,
    steps: result.steps,
    requirements: result.requirements,
    details: result.details,
    gaps: result.gaps,
    sources: result.sources,
  }

  const { data: assistantRow, error: assistantError } = await supabase
    .from("messages")
    .insert({ conversation_id: id, role: "assistant", content: result.text, response_metadata: answer })
    .select("id, role, content, response_metadata, created_at")
    .single()
  if (assistantError || !assistantRow) return { ok: false, error: "The answer could not be saved. Please try again." }

  revalidatePath("/app", "layout") // refresh Recent conversations
  return {
    ok: true,
    conversationId: id,
    isNew,
    user: toChatMessage(userRow),
    assistant: toChatMessage(assistantRow),
  }
}
