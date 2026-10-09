"use server"

import { z } from "zod"

import { scopeFilter } from "@/lib/announcement-scopes"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { type AnnouncementCard, pageOfAnnouncements } from "@/lib/campus/published-announcements"
import { createClient } from "@/lib/supabase/server"

export type AnnouncementPage = { ok: true; items: AnnouncementCard[]; hasMore: boolean } | { ok: false; error: string }

/** One batch of the user announcement feed (filter change or "Load more"). Published only. */
export async function loadAnnouncementPage(input: { scope: string; offset: number }): Promise<AnnouncementPage> {
  await requireProfile()
  const offset = z.number().int().min(0).max(10_000).catch(0).parse(input.offset)
  try {
    const [{ timezone }, db] = await Promise.all([getBranding(), createClient()])
    const page = await pageOfAnnouncements(db, { scope: scopeFilter(input.scope), offset, timezone })
    return { ok: true, ...page }
  } catch {
    return { ok: false, error: "Announcements could not be loaded right now. Please try again." }
  }
}
