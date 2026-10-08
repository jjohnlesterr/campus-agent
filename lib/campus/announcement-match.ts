// Announcement questions ("May announcement ba tungkol sa enrollment?", "May suspension
// ba?", "Ano latest advisory?") and topic matching against Published announcements.
// Pure: answers come from the structured announcement records, never from handbook text.

import { normalize } from "@/lib/campus/location-match"

export type AnnouncementWindow = "today" | "week" | "month" | "any"

type Topic = {
  words: string[]
  /** Asking about this topic is itself a request for current notices ("May suspension ba?"). */
  current?: boolean
}

// Words are normalized tokens. Words of 5+ letters also match longer forms ("enroll" → "enrollees").
const TOPICS = {
  enrollment: { words: ["enroll", "enrol", "enrollment", "enrolment", "registration", "register"] },
  scholarship: { words: ["scholarship", "scholar", "iskolar", "grant", "grants"] },
  suspension: { current: true, words: ["suspension", "suspended", "suspend", "suspensyon", "cancellation", "cancelled", "canceled", "kanselado", "kansela", "bagyo", "typhoon", "emergency"] },
  advisory: { current: true, words: ["advisory", "advisories", "abiso"] },
  activity: { current: true, words: ["event", "events", "activity", "activities", "aktibidad", "ganap", "happening", "celebration", "foundation"] },
  academic: { words: ["exam", "exams", "examination", "midterm", "midterms", "finals", "semester"] },
  services: { words: ["closure", "closed", "sarado", "holiday"] },
} satisfies Record<string, Topic>

export type AnnouncementTopic = keyof typeof TOPICS

const ANNOUNCEMENT_WORDS = new Set(["announcement", "announcements", "anunsyo", "anunsiyo", "balita", "news", "notice", "notices", "update", "updates", "memo"])
const LATEST_WORDS = new Set(["latest", "newest", "recent", "pinakabago", "bago", "bagong", "new"])
// Not topic words: question words, fillers and window words (English and Tagalog).
const STOP_WORDS = new Set([
  "about", "there", "today", "tonight", "upcoming", "paparating", "this", "week", "month", "what", "when", "where", "which", "have", "with", "from", "that", "will", "your", "university", "school", "campus", "official",
  "tungkol", "para", "mayroon", "meron", "kailan", "ngayon", "ngayong", "araw", "linggo", "linggong", "buwan", "yung", "naman", "lang", "nito", "mga", "sana", "please", "paki", "pakisabi",
  ...ANNOUNCEMENT_WORDS, ...LATEST_WORDS,
])
// Without "walang", "pasok" is not about suspensions ("pasok sa requirements").
const NO_CLASSES = /\bwalang pasok\b|\bno (?:classes|class|pasok)\b/

export type AnnouncementQuestion = {
  window: AnnouncementWindow
  topics: AnnouncementTopic[]
  /** Other meaningful words ("foundation", "id validation"), matched in title or text. */
  terms: string[]
  latest: boolean
}

function tokensOf(text: string) {
  return normalize(text).split(" ").filter(Boolean)
}

const matchesWord = (token: string, word: string) => token === word || (word.length >= 5 && token.startsWith(word))

/** Topics a question mentions ("How do I enroll?" → enrollment). */
export function announcementTopics(question: string): AnnouncementTopic[] {
  const text = normalize(question)
  const tokens = text.split(" ").filter(Boolean)
  const topics = (Object.keys(TOPICS) as AnnouncementTopic[]).filter((key) =>
    TOPICS[key].words.some((w) => tokens.some((t) => matchesWord(t, w)))
  )
  if (NO_CLASSES.test(text) && !topics.includes("suspension")) topics.push("suspension")
  return topics
}

/**
 * A question that asks for current notices: it names announcements/notices, or a topic
 * that only announcements cover (suspensions, advisories, university activities).
 */
export function detectAnnouncementQuestion(question: string): AnnouncementQuestion | null {
  const text = normalize(question)
  const tokens = text.split(" ").filter(Boolean)
  const topics = announcementTopics(question)
  const asksForNotices = tokens.some((t) => ANNOUNCEMENT_WORDS.has(t)) || topics.some((t) => "current" in TOPICS[t])
  if (!asksForNotices) return null

  // "ngayon" alone is today; "ngayong linggo" / "ngayong buwan" are this week / month.
  const window: AnnouncementWindow = /\b(?:today|tonight)\b|\bngayon\b(?! ?(?:linggo|buwan))|\bngayong araw\b/.test(text)
    ? "today"
    : /\b(?:week|linggo|linggong)\b/.test(text)
      ? "week"
      : /\b(?:month|buwan)\b/.test(text)
        ? "month"
        : "any"

  const topicWords = new Set(topics.flatMap((t) => TOPICS[t].words))
  const terms = [...new Set(tokens.filter((t) =>
    t.length >= 4 && !STOP_WORDS.has(t) && ![...topicWords].some((w) => matchesWord(t, w)) && !(t === "walang" || t === "pasok")
  ))]
  return { window, topics, terms, latest: tokens.some((t) => LATEST_WORDS.has(t)) }
}

type Matchable = { title: string; content: string }

/** True when the announcement's title or text is about one of the topics. */
export function matchesTopics(announcement: Matchable, topics: AnnouncementTopic[]) {
  if (!topics.length) return false
  const tokens = tokensOf(`${announcement.title} ${announcement.content}`)
  return topics.some((key) =>
    TOPICS[key].words.some((w) => tokens.some((t) => matchesWord(t, w))) ||
    (key === "suspension" && NO_CLASSES.test(normalize(announcement.content)))
  )
}

/**
 * Announcements relevant to the question. With no topic or term ("Ano latest
 * announcement?") every announcement is relevant; otherwise only matching ones.
 */
export function matchAnnouncements<T extends Matchable>(rows: T[], question: Pick<AnnouncementQuestion, "topics" | "terms">) {
  if (!question.topics.length && !question.terms.length) return rows
  return rows.filter((a) => {
    if (matchesTopics(a, question.topics)) return true
    const tokens = tokensOf(`${a.title} ${a.content}`)
    return question.terms.some((term) => tokens.some((t) => matchesWord(t, term)))
  })
}

/** Start of the window, as an ISO time (null = no limit). */
export function windowStart(window: AnnouncementWindow, now: Date, startOfToday: string) {
  const DAY_MS = 24 * 60 * 60 * 1000
  if (window === "today") return startOfToday
  if (window === "week") return new Date(now.getTime() - 7 * DAY_MS).toISOString()
  if (window === "month") return new Date(now.getTime() - 30 * DAY_MS).toISOString()
  return null
}
