// University announcements: official, university-wide notices (enrollment schedules,
// suspensions, scholarship reminders, advisories, office closures…). Pure helpers
// shared by admin pages, the student page, Campus Agent and tests.
// (The old optional `category` column is no longer used.)

/** A safe http(s) link to the original source, or null. */
export function safeSourceUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

/** Short source text for lists: the label, else the link's site (Facebook for facebook.com), else null. */
export function sourceSummary(label: string | null | undefined, url: string | null | undefined) {
  const text = label?.trim()
  if (text) return text
  const safe = safeSourceUrl(url)
  if (!safe) return null
  const host = new URL(safe).hostname.replace(/^www\.|^m\./, "")
  return /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/.test(host) ? "Facebook post" : host
}

export const ANNOUNCEMENT_TABS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
] as const
export type AnnouncementTab = (typeof ANNOUNCEMENT_TABS)[number]["value"]

export function announcementTab(value: unknown): AnnouncementTab {
  return ANNOUNCEMENT_TABS.some((t) => t.value === value) ? (value as AnnouncementTab) : "all"
}

export const ANNOUNCEMENT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const
export type AnnouncementSort = (typeof ANNOUNCEMENT_SORTS)[number]["value"]

export function announcementSort(value: unknown): AnnouncementSort {
  return value === "oldest" ? "oldest" : "newest"
}

type Dated = { publish_at: string | null; created_at: string }

/**
 * By published date (newest or oldest first). A record without a published date
 * sorts by when it was created; created_at also breaks ties between same-day notices.
 */
export function sortAnnouncements<T extends Dated>(rows: T[], sort: AnnouncementSort) {
  const direction = sort === "oldest" ? 1 : -1
  return [...rows].sort((a, b) =>
    direction * ((a.publish_at ?? a.created_at).localeCompare(b.publish_at ?? b.created_at) || a.created_at.localeCompare(b.created_at))
  )
}

type Filterable = { title: string; content: string; status: string; source: string | null }

/** Admin list: status tab and a case-insensitive text search (title, content, source). */
export function filterAnnouncements<T extends Filterable>(rows: T[], { tab, query }: { tab: AnnouncementTab; query: string }) {
  const q = query.trim().toLowerCase()
  return rows.filter((a) =>
    (tab === "all" || a.status === tab) &&
    (!q || [a.title, a.content, a.source].some((field) => field?.toLowerCase().includes(q)))
  )
}

export type BulkAnnouncementAction = "publish" | "draft" | "archive" | "delete"
