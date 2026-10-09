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

/** Example source label for the admin form, from the configured university name. */
export function sourceLabelPlaceholder(universityName: string | null | undefined) {
  return universityName?.trim() ? `e.g. ${universityName.trim()} Official Facebook` : "e.g. Official university Facebook page"
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
  { value: "manual", label: "Manual order" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const
export type AnnouncementSort = (typeof ANNOUNCEMENT_SORTS)[number]["value"]

/** Manual order (drag and drop) is the default; newest/oldest sort by published date. */
export function announcementSort(value: unknown): AnnouncementSort {
  return value === "oldest" || value === "newest" ? value : "manual"
}

type Dated = { publish_at: string | null; created_at: string; sort_order?: number | null }

/**
 * Manual (sort_order), or by published date (newest or oldest first). A record without a published date
 * sorts by when it was created; created_at also breaks ties between same-day notices.
 */
export function sortAnnouncements<T extends Dated>(rows: T[], sort: AnnouncementSort) {
  const byDate = (direction: number) => (a: T, b: T) =>
    direction * ((a.publish_at ?? a.created_at).localeCompare(b.publish_at ?? b.created_at) || a.created_at.localeCompare(b.created_at))
  // Manual: the admin's drag-and-drop order; rows without one follow, newest first.
  if (sort === "manual") return [...rows].sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || byDate(-1)(a, b))
  return [...rows].sort(byDate(sort === "oldest" ? 1 : -1))
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
