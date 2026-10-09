import "server-only"

import { UNIVERSITY_WIDE, scopeLabel } from "@/lib/announcement-scopes"
import { formatDate } from "@/lib/datetime"
import type { DbClient } from "@/lib/supabase/types"

// Announcements for signed-in users (/app/announcements): Published, already published and
// not expired, newest first. The same records Admin › Announcements manages; drafts and
// archived notices are never returned (RLS also limits users to Published ones).

// departments(code): null = University-wide, otherwise the department it is for.
const SELECT = "id, title, content, publish_at, source, source_url, image_url, image_position_x, image_position_y, departments(code)"

function visible(db: DbClient) {
  const now = new Date().toISOString()
  return db
    .from("announcements")
    .select(SELECT)
    .eq("status", "published")
    .lte("publish_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
}

export async function getPublishedAnnouncement(db: DbClient, id: string) {
  return visible(db).eq("id", id).maybeSingle()
}

/** One card in the user feed: only what the card shows (no full body). */
export type AnnouncementCard = {
  id: string
  title: string
  preview: string
  dateLabel: string
  publishAt: string
  source: string | null
  imageUrl: string | null
  imagePosition: string
  category: string
}

/** Cards per batch in the user feed (first page and each "Load more"). */
export const ANNOUNCEMENT_PAGE_SIZE = 10

/**
 * One batch of the user feed, newest first, with the category filter and the range applied
 * in the query. "all" = every Published announcement (the category is never access control).
 * Fetches one extra row to know whether more remain.
 */
export async function pageOfAnnouncements(db: DbClient, { scope, offset, timezone }: { scope: string; offset: number; timezone: string }) {
  const department = scope !== "all" && scope !== UNIVERSITY_WIDE ? scope : null
  const now = new Date().toISOString()
  // !inner: a department filter returns only that department's announcements.
  const select: string = department ? SELECT.replace("departments(code)", "departments!inner(code)") : SELECT
  let query = db.from("announcements").select(select).eq("status", "published").lte("publish_at", now).or(`expires_at.is.null,expires_at.gt.${now}`)
  if (scope === UNIVERSITY_WIDE) query = query.is("department_id", null)
  if (department) query = query.eq("departments.code", department)
  const { data, error } = await query
    .order("publish_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + ANNOUNCEMENT_PAGE_SIZE)
  if (error) throw new Error("Announcements could not be loaded.")
  const rows = (data ?? []) as unknown as {
    id: string; title: string; content: string; publish_at: string; source: string | null
    image_url: string | null; image_position_x: number; image_position_y: number; departments: { code: string } | null
  }[]
  const items: AnnouncementCard[] = rows.slice(0, ANNOUNCEMENT_PAGE_SIZE).map((a) => ({
    id: a.id,
    title: a.title,
    preview: previewText(a.content).slice(0, 280),
    dateLabel: formatDate(a.publish_at, timezone, { month: "long", day: "numeric", year: "numeric" }),
    publishAt: a.publish_at,
    source: a.source,
    imageUrl: a.image_url,
    imagePosition: imagePosition(a),
    category: scopeLabel(a.departments?.code ?? null),
  }))
  return { items, hasMore: rows.length > ANNOUNCEMENT_PAGE_SIZE }
}

/** CSS object-position for an announcement image (the admin's crop). */
export const imagePosition = (a: { image_position_x: number; image_position_y: number }) => `${Number(a.image_position_x)}% ${Number(a.image_position_y)}%`

/** A one-paragraph preview of the content. */
export const previewText = (content: string) => content.replace(/\s+/g, " ").trim()
