"use server"

import { headers } from "next/headers"
import { z } from "zod"

import type { StructuredAnswer } from "@/lib/ai/answer-types"
import { answerQuestion } from "@/lib/ai/campus-agent"
import { getCurrentProfile } from "@/lib/auth"
import { GUEST_LIMIT_MESSAGE, readGuestQuota, recordGuestQuestion, remainingQuestions } from "@/lib/guest-quota"

// Landing-page assistant for incoming freshmen and visitors. Answers come only from
// public, verified data (the pipeline uses an anonymous client) and nothing is stored.
// Signed-out visitors get GUEST_QUESTION_LIMIT successful answers, then a sign-up gate.

/** remaining: free questions left for a guest; null for a signed-in user (no limit). */
export type PublicAskResult =
  | { ok: true; answer: StructuredAnswer; remaining: number | null }
  | { ok: false; error: string; limitReached?: boolean; remaining: number | null }

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
  const [profile, quota] = await Promise.all([getCurrentProfile(), readGuestQuota()])
  const guest = profile ? null : quota
  const remaining = guest ? remainingQuestions(guest) : null

  if (guest && remaining === 0) return { ok: false, error: GUEST_LIMIT_MESSAGE, limitReached: true, remaining: 0 }

  // Empty or invalid submissions never count.
  const parsed = questionSchema.safeParse(question)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Type a question first.", remaining }

  const h = await headers()
  const visitor = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  if (rateLimited(visitor)) return { ok: false, error: "You're asking quickly — please wait a moment and try again.", remaining }

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
      // The campus map and announcements pages are part of the signed-in app, so no links into it.
    }
    // Only a real answer uses a free question: failed AI calls ("error") and the
    // instant local replies (greetings, off-topic, gibberish) don't.
    if (guest && result.status !== "error" && !result.handledLocally) {
      const used = await recordGuestQuestion(guest)
      return { ok: true, answer, remaining: remainingQuestions(used) }
    }
    return { ok: true, answer, remaining }
  } catch {
    return { ok: false, error: "Campus Agent couldn't answer right now. Please try again.", remaining }
  }
}
