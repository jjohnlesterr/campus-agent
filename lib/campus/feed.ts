import "server-only"

import { cache } from "react"

import type { StructuredAnswer } from "@/lib/ai/answer-types"
import type { ReplyLanguage } from "@/lib/ai/language"
import { getBranding } from "@/lib/branding"
import type { FeedQuestion } from "@/lib/campus/feed-match"
import { formatDate, formatTime, startOfTodayIso } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

/** College codes ("CECT"), so questions naming a college are scoped to it. */
export const getDepartmentCodes = cache(async (): Promise<string[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from("departments").select("code")
  return (data ?? []).map((d) => d.code)
})

const DAY_MS = 24 * 60 * 60 * 1000
const LIMIT = 8

type DepartmentRef = { code: string } | null

/** "CECT" or "University-wide". */
const audience = (d: DepartmentRef) => d?.code ?? "University-wide"

/** First sentence (or ~160 characters) of an announcement, for the list. */
function snippet(content: string) {
  const first = content.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? ""
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first
}

function windowLabel(question: FeedQuestion, language: ReplyLanguage) {
  const labels = {
    en: { today: "today", week: "this week", month: "this month", upcoming: "" },
    fil: { today: "ngayong araw", week: "ngayong linggo", month: "ngayong buwan", upcoming: "" },
  } as const
  return labels[language][question.window]
}

/**
 * Answers an events/announcements question from the published records. Runs under
 * the student's session, so RLS shows only what students may see. When a college
 * is named, its items are listed together with university-wide ones.
 */
export async function answerFeedQuestion(question: FeedQuestion, language: ReplyLanguage): Promise<StructuredAnswer> {
  const supabase = await createClient()
  const { timezone } = await getBranding()
  const now = new Date()
  const nowIso = now.toISOString()

  let departmentId: string | null = null
  if (question.department) {
    const { data } = await supabase.from("departments").select("id").eq("code", question.department).maybeSingle()
    departmentId = data?.id ?? null
  }
  const scope = question.department ? `${question.department} ${language === "fil" ? "at" : "and"} university-wide` : ""
  const when = windowLabel(question, language)
  const viewAll = (path: string) => (question.department ? `${path}?dept=${encodeURIComponent(question.department)}` : `${path}?dept=all`)

  if (question.kind === "events") {
    const end = { today: 1, week: 7, month: 30, upcoming: 60 }[question.window]
    let query = supabase
      .from("events")
      .select("title, starts_at, all_day, venue, status, departments(code)")
      .neq("status", "draft")
      .gte("starts_at", question.window === "today" ? startOfTodayIso(timezone) : nowIso)
      .lt("starts_at", new Date(now.getTime() + end * DAY_MS).toISOString())
      .order("starts_at")
      .limit(LIMIT)
    if (departmentId) query = query.or(`department_id.eq.${departmentId},department_id.is.null`)
    const { data, error } = await query
    if (error) throw new Error(`Events could not be loaded: ${error.message}`)
    const events = data ?? []

    const lines = events.map((e) => {
      const date = formatDate(e.starts_at, timezone, { weekday: "short", month: "short", day: "numeric" })
      const time = e.all_day ? (language === "fil" ? "buong araw" : "all day") : formatTime(e.starts_at, timezone)
      const parts = [date, time, e.venue, audience(e.departments)].filter(Boolean).join(" · ")
      return `- **${e.title}** — ${parts}${e.status === "cancelled" ? (language === "fil" ? " (kinansela)" : " (cancelled)") : ""}`
    })
    // Tagalog links a modifier with "na" ("CECT at university-wide na events"), but not a bare noun.
    const subject = scope ? (language === "fil" ? `${scope} na events` : `${scope} events`) : "events"
    const summary = events.length
      ? language === "fil"
        ? `Ito ang mga paparating na ${subject}${when ? ` ${when}` : ""}:`
        : `Here are the upcoming ${subject}${when ? ` ${when}` : ""}:`
      : language === "fil"
        ? `Walang nakalistang paparating na ${subject}${when ? ` ${when}` : ""}.`
        : `There are no upcoming ${subject} listed${when ? ` ${when}` : ""}.`
    return {
      status: events.length ? "answered" : "not_found",
      summary,
      steps: [],
      requirements: [],
      details: lines.join("\n"),
      gaps: "",
      sources: events.length ? [{ label: "University events", documentTitle: "University events", pageNumber: null, sectionTitle: null }] : [],
      link: { label: language === "fil" ? "Tingnan lahat ng events" : "View all events", href: viewAll("/app/events") },
    }
  }

  const since = { today: startOfTodayIso(timezone), week: new Date(now.getTime() - 7 * DAY_MS).toISOString(), month: new Date(now.getTime() - 30 * DAY_MS).toISOString(), upcoming: null }[question.window]
  let query = supabase
    .from("announcements")
    .select("title, content, publish_at, expires_at, departments(code)")
    .eq("status", "published")
    .lte("publish_at", nowIso)
    .order("publish_at", { ascending: false })
    .limit(20)
  if (since) query = query.gte("publish_at", since)
  if (departmentId) query = query.or(`department_id.eq.${departmentId},department_id.is.null`)
  const { data, error } = await query
  if (error) throw new Error(`Announcements could not be loaded: ${error.message}`)
  // Expired announcements are filtered here (one .or() per request is reserved for the department scope).
  const announcements = (data ?? []).filter((a) => !a.expires_at || a.expires_at > nowIso).slice(0, 5)

  const lines = announcements.map((a) => {
    const date = formatDate(a.publish_at, timezone, { month: "short", day: "numeric" })
    return `- **${a.title}** (${date} · ${audience(a.departments)}) — ${snippet(a.content)}`
  })
  const subject = scope ? (language === "fil" ? `${scope} na announcements` : `${scope} announcements`) : "announcements"
  const summary = announcements.length
    ? language === "fil"
      ? `Ito ang mga pinakabagong ${subject}${when ? ` ${when}` : ""}:`
      : `Here are the latest ${subject}${when ? ` ${when}` : ""}:`
    : language === "fil"
      ? `Walang aktibong ${subject}${when ? ` ${when}` : ""}.`
      : `There are no active ${subject}${when ? ` ${when}` : ""}.`
  return {
    status: announcements.length ? "answered" : "not_found",
    summary,
    steps: [],
    requirements: [],
    details: lines.join("\n"),
    gaps: "",
    sources: announcements.length ? [{ label: "University announcements", documentTitle: "University announcements", pageNumber: null, sectionTitle: null }] : [],
    link: { label: language === "fil" ? "Tingnan lahat ng announcements" : "View all announcements", href: viewAll("/app/announcements") },
  }
}
