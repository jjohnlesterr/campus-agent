import "server-only"

import type { AnswerSource, StructuredAnswer } from "@/lib/ai/answer-types"
import type { ReplyLanguage } from "@/lib/ai/language"
import { inScope } from "@/lib/announcement-scopes"
import { safeSourceUrl } from "@/lib/announcements"
import { getBranding } from "@/lib/branding"
import { ANNOUNCEMENT_LIMITS, type AnnouncementQuestion, type AnnouncementTopic, matchAnnouncements, matchesTopics, windowStart } from "@/lib/campus/announcement-match"
import { formatDate, startOfTodayIso } from "@/lib/datetime"
import type { KnowledgePassage } from "@/lib/rag/search"
import { createClient } from "@/lib/supabase/server"
import type { DbClient } from "@/lib/supabase/types"

// Published university announcements for Campus Agent: current notices (enrollment
// schedules, suspensions, advisories…). Runs under the caller's client, so RLS limits
// it to Published announcements. Never invents a notice: only stored records are used.

export type CurrentAnnouncement = {
  id: string
  title: string
  content: string
  publish_at: string
  source: string | null
  source_url: string | null
  /** null = University-wide; otherwise the department the announcement is for. */
  departments?: { code: string } | null
}

/** How many rows a topic question scans for title/text matches (newest first). */
const MATCH_WINDOW = 50

/**
 * Published, already-dated, unexpired announcements, newest first (published date, then
 * created). The category and the row limit are applied in the database query: "university"
 * keeps department_id = null, a department code keeps only that department's announcements.
 */
export async function loadCurrentAnnouncements(
  client?: DbClient,
  { since = null, scope = "all", limit = MATCH_WINDOW }: { since?: string | null; scope?: string; limit?: number } = {},
): Promise<CurrentAnnouncement[]> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  const department = scope !== "all" && scope !== "university" ? scope : null
  let query = supabase
    .from("announcements")
    // !inner: only announcements of that department are returned.
    .select(department ? "id, title, content, publish_at, source, source_url, departments!inner(code)" : "id, title, content, publish_at, source, source_url, departments(code)")
    .eq("status", "published")
    .lte("publish_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
  if (scope === "university") query = query.is("department_id", null)
  if (department) query = query.eq("departments.code", department)
  if (since) query = query.gte("publish_at", since)
  query = query.order("publish_at", { ascending: false }).order("created_at", { ascending: false }).limit(limit)
  const { data, error } = await query
  if (error) throw new Error(`Announcements could not be loaded: ${error.message}`)
  return data ?? []
}

/** First sentence (or ~200 characters) of an announcement. */
function snippet(content: string) {
  const text = content.replace(/\s+/g, " ").trim()
  const first = text.split(/(?<=[.!?])\s/)[0] ?? ""
  return first.length > 200 ? `${first.slice(0, 197).trimEnd()}…` : first
}

function announcementSource(a: CurrentAnnouncement, date: string): AnswerSource {
  const url = safeSourceUrl(a.source_url)
  return {
    label: `${a.title} — announced ${date}`,
    documentTitle: "University announcement",
    pageNumber: null,
    sectionTitle: a.title,
    ...(url ? { url } : {}),
  }
}

const WINDOW_LABELS = {
  en: { today: " today", week: " this week", month: " this month", any: "" },
  fil: { today: " ngayong araw", week: " ngayong linggo", month: " ngayong buwan", any: "" },
} as const

const TOPIC_LABELS: Record<AnnouncementTopic, { en: string; fil: string }> = {
  enrollment: { en: "enrollment", fil: "enrollment" },
  scholarship: { en: "scholarships", fil: "scholarship" },
  suspension: { en: "class suspensions", fil: "suspension ng klase" },
  advisory: { en: "advisories", fil: "advisory" },
  activity: { en: "university activities", fil: "aktibidad ng unibersidad" },
  academic: { en: "academic matters", fil: "academic" },
  services: { en: "office closures or campus services", fil: "pagsasara ng opisina o campus services" },
}

/**
 * Answers "May announcement ba…?" from Published announcements. When nothing matches,
 * says so plainly instead of guessing; `link` points signed-in users to the full list.
 */
export async function answerAnnouncementQuestion(
  question: AnnouncementQuestion,
  language: ReplyLanguage,
  { client, linkToList = true }: { client?: DbClient; linkToList?: boolean } = {},
): Promise<StructuredAnswer> {
  const { timezone } = await getBranding()
  const since = windowStart(question.window, new Date(), startOfTodayIso(timezone))
  // "latest announcements" covers both categories (University-wide + CECT); a named category
  // narrows it. Only as many rows as will be shown are fetched (3 by default, a requested
  // number, or "more" / "all", at most 10); a topic question scans a window for matches.
  const scope = question.scope ?? "all"
  const limit = question.limit ?? ANNOUNCEMENT_LIMITS.default
  const plain = !question.topics.length && !question.terms.length
  // "all" may include not-yet-enabled categories, which are dropped below: fetch a little extra.
  const fetch = plain ? (scope === "all" ? Math.min(limit * 3, MATCH_WINDOW) : limit) : MATCH_WINDOW
  const rows = (await loadCurrentAnnouncements(client, { since, scope, limit: fetch })).filter((a) => inScope(a.departments?.code ?? null, scope))
  const found = matchAnnouncements(rows, question).slice(0, limit)

  const fil = language === "fil"
  const when = WINDOW_LABELS[language][question.window]
  const category = question.scope && question.scope !== "all" ? (question.scope === "university" ? (fil ? " pang-unibersidad" : " university-wide") : ` ${question.scope}`) : ""
  const topic = question.topics.length
    ? question.topics.map((t) => TOPIC_LABELS[t][language]).join(fil ? " o " : " or ")
    : question.terms.join(" ")

  const sources: AnswerSource[] = []
  const lines = found.map((a) => {
    const date = formatDate(a.publish_at, timezone, { month: "long", day: "numeric", year: "numeric" })
    sources.push(announcementSource(a, date))
    const tag = a.departments?.code ? ` · ${a.departments.code}` : ""
    return `- **${a.title}** (${date}${tag}) — ${snippet(a.content)}`
  })

  let summary: string
  if (found.length) {
    summary = topic
      ? fil ? `Ito ang mga published na announcement tungkol sa ${topic}${when}:` : `Here are the published announcements about ${topic}${when}:`
      : fil ? `Ito ang mga pinakabagong${category} announcement${when}:` : `Here are the latest${category} announcements${when}:`
  } else {
    summary = topic
      ? fil
        ? `Wala akong nahanap na published na announcement tungkol sa ${topic}${when}. Para makasiguro, tingnan ang official na channels ng unibersidad o makipag-ugnayan sa kinauukulang opisina.`
        : `I couldn't find a published announcement about ${topic}${when}. For confirmation, check the university's official channels or contact the responsible office.`
      : fil
        ? `Walang published na${category} announcement${when}.`
        : `There are no published${category} announcements${when}.`
  }

  return {
    status: found.length ? "answered" : "not_found",
    summary,
    steps: [],
    requirements: [],
    details: lines.join("\n"),
    gaps: "",
    sources,
    ...(linkToList ? { link: { label: fil ? "Tingnan lahat ng announcements" : "View all announcements", href: "/app/announcements" } } : {}),
  }
}

/**
 * Current announcements on the same topic as a general question ("Kailan enrollment?"),
 * passed to Claude next to Knowledge Library sections so time-sensitive notices come
 * first. Only topic matches count, so unrelated notices never crowd the handbook out.
 */
export async function announcementPassages(topics: AnnouncementTopic[], client?: DbClient, limit = 2): Promise<KnowledgePassage[]> {
  if (!topics.length) return []
  const [{ timezone }, rows] = await Promise.all([getBranding(), loadCurrentAnnouncements(client)])
  return rows.filter((a) => inScope(a.departments?.code ?? null, "all") && matchesTopics(a, topics)).slice(0, limit).map((a) => {
    const date = formatDate(a.publish_at, timezone, { month: "long", day: "numeric", year: "numeric" })
    const source = announcementSource(a, date)
    return {
      sectionId: a.id,
      documentTitle: source.documentTitle,
      pageNumber: null,
      sectionTitle: a.title,
      content: `University announcement published ${date}.\n${a.content}`,
      rank: 0,
      sourceLabel: source.label,
      url: source.url,
    }
  })
}
