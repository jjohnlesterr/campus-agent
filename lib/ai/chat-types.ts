import type { StructuredAnswer } from "@/lib/ai/answer-types"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  /** Markdown text (assistant) or the question (user). */
  content: string
  /** Structured answer for assistant messages, when available. */
  answer: StructuredAnswer | null
  createdAt: string
}

export type AskResult =
  | { ok: true; conversationId: string; isNew: boolean; user: ChatMessage; assistant: ChatMessage }
  | { ok: false; error: string }

export type RecentConversation = { id: string; title: string }
