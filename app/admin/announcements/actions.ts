"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { BulkAnnouncementAction } from "@/lib/announcements"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { zonedToUtcIso } from "@/lib/datetime"
import { type FormState, isoDate, optionalId, toFieldErrors } from "@/lib/forms"
import { createClient } from "@/lib/supabase/server"

// University-wide announcements. Every announcement is public and for the whole
// university (department targeting is retired); Draft and Archived ones are admin-only.

const optionalText = (max: number, message: string) => z.string().trim().max(max, message).transform((v) => v || null)

const announcementSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(2, "Enter a title.").max(200, "Use 200 characters or fewer."),
  content: z.string().trim().min(1, "Write the announcement.").max(8000, "Keep it under 8,000 characters."),
  date: isoDate,
  source_label: optionalText(200, "Use 200 characters or fewer for the source label."),
  source_url: z.string().trim().max(2000, "This link is too long.")
    .refine((v) => !v || (/^https?:\/\/\S+$/i.test(v) && URL.canParse(v)), "Paste the full link, starting with https://.")
    .transform((v) => v || null),
  // Which button was pressed: Save draft or Publish.
  intent: z.enum(["draft", "published"]),
})

function revalidate(id?: string) {
  revalidatePath("/admin/announcements")
  revalidatePath("/admin")
  revalidatePath("/app/announcements")
  if (id) revalidatePath(`/admin/announcements/${id}`)
}

export async function saveAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) }

  const { id, date, intent, source_label, ...input } = parsed.data
  const { timezone } = await getBranding()
  const row = {
    ...input,
    source: source_label,
    status: intent,
    publish_at: zonedToUtcIso(date, "00:00", timezone),
    // University-wide and public: no department or audience targeting.
    department_id: null,
    visibility: "public" as const,
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert(row)
  if (error) return { error: "We couldn't save this announcement. Please try again." }

  revalidate(id)
  redirect(intent === "published" ? "/admin/announcements?tab=published" : "/admin/announcements?tab=draft")
}

/** Archive: hidden from users and Campus Agent, kept for reference. Restore by saving it again. */
export async function archiveAnnouncement(id: string) {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return
  const supabase = await createClient()
  await supabase.from("announcements").update({ status: "archived" }).eq("id", id)
  revalidate(id)
  redirect("/admin/announcements?tab=archived")
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return
  const supabase = await createClient()
  await supabase.from("announcements").delete().eq("id", id)
  revalidate()
  redirect("/admin/announcements")
}

const bulkSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  action: z.enum(["publish", "draft", "archive", "delete"]),
})
export type BulkAnnouncementResult = { ok: true; changed: number } | { ok: false; error: string }

/**
 * Bulk Publish / Move to Draft / Archive / Delete for the rows the admin selected.
 * Only the given ids are touched, in one statement.
 */
export async function bulkUpdateAnnouncements(ids: string[], action: BulkAnnouncementAction): Promise<BulkAnnouncementResult> {
  await requireAdmin()
  const parsed = bulkSchema.safeParse({ ids, action })
  if (!parsed.success) return { ok: false, error: "Select announcements and an action." }
  const unique = [...new Set(parsed.data.ids)]
  const supabase = await createClient()
  const status = { publish: "published", draft: "draft", archive: "archived" } as const
  const { data, error } = parsed.data.action === "delete"
    ? await supabase.from("announcements").delete().in("id", unique).select("id")
    : await supabase.from("announcements").update({ status: status[parsed.data.action] }).in("id", unique).select("id")
  if (error) return { ok: false, error: "The selected announcements could not be updated. Please try again." }
  revalidate()
  return { ok: true, changed: data?.length ?? 0 }
}
