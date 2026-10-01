// Event / announcement questions ("May event ba CECT this week?", "Ano latest
// announcement?"). Pure detection — answers come from the structured Events and
// Announcements records, never from handbook text.

import { normalize } from "@/lib/campus/location-match"

export type FeedKind = "events" | "announcements"
export type FeedWindow = "today" | "week" | "month" | "upcoming"

export type FeedQuestion = {
  kind: FeedKind
  window: FeedWindow
  /** A college code named in the question ("CECT"), if any. */
  department: string | null
}

const EVENT_WORDS = new Set(["event", "events", "activity", "activities", "aktibidad", "ganap", "happening", "happenings"])
const ANNOUNCEMENT_WORDS = new Set(["announcement", "announcements", "anunsyo", "anunsiyo", "abiso", "balita", "news", "notice", "notices"])

/**
 * Detects an events/announcements question and its scope. `departmentCodes`
 * come from the departments table, so new colleges are recognized automatically.
 */
export function detectFeedQuestion(question: string, departmentCodes: string[]): FeedQuestion | null {
  const text = normalize(question)
  const tokens = text.split(" ").filter(Boolean)
  const kind: FeedKind | null = tokens.some((t) => ANNOUNCEMENT_WORDS.has(t))
    ? "announcements"
    : tokens.some((t) => EVENT_WORDS.has(t))
      ? "events"
      : null
  if (!kind) return null

  // "ngayon" alone is today; "ngayong linggo" / "ngayong buwan" are this week / month.
  const window: FeedWindow = /\b(?:today|tonight|ngayon)\b/.test(text)
    ? "today"
    : /\b(?:week|linggo|linggong)\b/.test(text)
      ? "week"
      : /\b(?:month|buwan)\b/.test(text)
        ? "month"
        : "upcoming"

  const codes = new Map(departmentCodes.map((c) => [c.toLowerCase(), c]))
  const department = tokens.map((t) => codes.get(t)).find(Boolean) ?? null
  return { kind, window, department }
}
