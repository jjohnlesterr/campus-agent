"use server"

import { headers } from "next/headers"
import { z } from "zod"

import type { StructuredAnswer } from "@/lib/ai/answer-types"
import { answerQuestion } from "@/lib/ai/campus-agent"

// Public landing-page assistant. Answers come only from public, verified data (the
// pipeline uses an anonymous client), current-student topics get a sign-in message,
// and nothing is stored.

export type PublicAskResult = { ok: true; answer: StructuredAnswer } | { ok: false; error: string }

const questionSchema = z.string().trim().min(2, "Type a question first.").max(500, "Keep your question under 500 characters.")

// Best-effort limit per visitor (per server instance) so the public page can't run up AI costs.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const recent = new Map<string, number[]>()

function rateLimited(key: string) {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recent.set(key, hits)
  if (recent.size > 5_000) for (const [k, v] of recent) if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k)
  return hits.length > MAX_PER_WINDOW
}

export async function askPublic(question: string): Promise<PublicAskResult> {
  const parsed = questionSchema.safeParse(question)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Type a question first." }

  const h = await headers()
  const visitor = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  if (rateLimited(visitor)) return { ok: false, error: "You're asking quickly — please wait a moment and try again." }

  try {
    const result = await answerQuestion(parsed.data, { audience: "public" })
    const answer: StructuredAnswer = {
      status: result.status,
      summary: result.summary,
      steps: result.steps,
      requirements: result.requirements,
      details: result.details,
      gaps: result.gaps,
      sources: result.sources,
      // The campus map and event pages are part of the signed-in app, so no links into it.
    }
    return { ok: true, answer }
  } catch {
    return { ok: false, error: "Campus Agent couldn't answer right now. Please try again." }
  }
}
