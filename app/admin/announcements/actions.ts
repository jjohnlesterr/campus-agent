"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { ANNOUNCEMENT_SCOPE_CODES } from "@/lib/announcement-scopes"
import { ANNOUNCEMENT_BUCKET, ANNOUNCEMENT_IMAGE_PATH, ANNOUNCEMENT_IMAGE_TYPES, MAX_ANNOUNCEMENT_IMAGE_BYTES, announcementImagePath } from "@/lib/announcement-images"
import type { BulkAnnouncementAction } from "@/lib/announcements"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { zonedToUtcIso } from "@/lib/datetime"
import { type FormState, isoDate, optionalId, toFieldErrors } from "@/lib/forms"
import { detectMimeType } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Announcements: University-wide (department_id = null) or for one enabled department
// (lib/announcement-scopes.ts; CECT for now). Every announcement is public; Draft and
// Archived ones are admin-only.
// Curated by hand from official posts: the source link is stored, never fetched or scraped.

type Client = Awaited<ReturnType<typeof createClient>>

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
  // The image: "keep" the current one, "remove" it, or a new upload's storage path.
  image: z.union([z.literal("keep"), z.literal("remove"), z.string().regex(ANNOUNCEMENT_IMAGE_PATH)]).catch("keep"),
  // Where the image sits in its crop window (CSS object-position, %). The file is never changed.
  image_position_x: z.coerce.number().min(0).max(100).catch(50),
  image_position_y: z.coerce.number().min(0).max(100).catch(50),
  // Category: "" = University-wide, or the id of an enabled department (checked below).
  scope: z.union([z.literal(""), z.uuid()]).catch(""),
  // Which button was pressed: Save draft or Publish.
  intent: z.enum(["draft", "published"]),
})

function revalidate(id?: string) {
  revalidatePath("/admin/announcements")
  revalidatePath("/admin")
  revalidatePath("/app/announcements")
  if (id) revalidatePath(`/admin/announcements/${id}`)
}

const publicUrl = (db: Client, path: string) => db.storage.from(ANNOUNCEMENT_BUCKET).getPublicUrl(path).data.publicUrl

/** Removes only images this module uploaded (announcements/<uuid>.<ext>). */
async function removeImages(db: Client, paths: (string | null | undefined)[]) {
  const own = paths.filter((p): p is string => !!p && ANNOUNCEMENT_IMAGE_PATH.test(p))
  if (own.length) await db.storage.from(ANNOUNCEMENT_BUCKET).remove(own)
}

/** The uploaded file must really be a PNG, JPG or WebP image within the size limit. */
async function verifyImage(db: Client, path: string) {
  const { data: file, error } = await db.storage.from(ANNOUNCEMENT_BUCKET).download(path)
  if (error || !file) return "The image could not be read. Please upload it again."
  if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) return "The image must be 5 MB or smaller."
  const type = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!type || !(ANNOUNCEMENT_IMAGE_TYPES as readonly string[]).includes(type)) return "The image must be a PNG, JPG or WebP file."
  return null
}

/**
 * Creates or updates an announcement. A new image was uploaded by the browser first; it
 * is verified here and removed again if anything fails, so the current image stays.
 */
export async function saveAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin()
  const supabase = await createClient()
  const raw = formData.get("image")
  const upload = typeof raw === "string" && ANNOUNCEMENT_IMAGE_PATH.test(raw) ? raw : null
  const fail = async (state: FormState): Promise<FormState> => {
    await removeImages(supabase, [upload])
    return state
  }

  const parsed = announcementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail({ fieldErrors: toFieldErrors(parsed.error) })

  const { id, date, intent, source_label, image, image_position_x, image_position_y, scope, ...input } = parsed.data
  // Only enabled departments can be chosen; anything else is refused, never silently changed.
  if (scope) {
    const { data: department } = await supabase.from("departments").select("id").eq("id", scope).in("code", [...ANNOUNCEMENT_SCOPE_CODES]).maybeSingle()
    if (!department) return fail({ fieldErrors: { scope: "Choose University-wide or one of the listed categories." } })
  }
  if (upload) {
    const problem = await verifyImage(supabase, upload)
    if (problem) return fail({ fieldErrors: { image: problem } })
  }
  let previous: string | null = null
  if (id && image !== "keep") {
    const { data: current } = await supabase.from("announcements").select("image_url").eq("id", id).maybeSingle()
    previous = current?.image_url ?? null
  }
  const { timezone } = await getBranding()
  const row = {
    ...input,
    ...(image !== "keep" && { image_url: image === "remove" ? null : publicUrl(supabase, image) }),
    image_position_x: Math.round(image_position_x * 100) / 100,
    image_position_y: Math.round(image_position_y * 100) / 100,
    source: source_label,
    status: intent,
    publish_at: zonedToUtcIso(date, "00:00", timezone),
    // Category (not access control): null = University-wide; otherwise the department it comes from.
    department_id: scope || null,
    visibility: "public" as const,
  }

  let error: { message: string } | null
  if (id) {
    ({ error } = await supabase.from("announcements").update(row).eq("id", id))
  } else {
    // New announcements go to the top of the manual order; the others keep theirs.
    const { data: first } = await supabase.from("announcements").select("sort_order").order("sort_order", { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    ;({ error } = await supabase.from("announcements").insert({ ...row, sort_order: (first?.sort_order ?? 1) - 1 }))
  }
  if (error) return fail({ error: "We couldn't save this announcement. Please try again." })

  // The replaced or removed image is deleted only once the announcement points elsewhere.
  if (image !== "keep") await removeImages(supabase, [announcementImagePath(previous)])
  revalidate(id)
  redirect(intent === "published" ? "/admin/announcements?tab=published&saved=published" : "/admin/announcements?tab=draft&saved=draft")
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
  const { data } = await supabase.from("announcements").delete().eq("id", id).select("image_url")
  await removeImages(supabase, (data ?? []).map((a) => announcementImagePath(a.image_url)))
  revalidate()
  redirect("/admin/announcements")
}

const reorderSchema = z.array(z.uuid()).max(2000)

/**
 * Saves the admin's manual order (drag and drop). `ids` is every announcement, in the new
 * order. Only sort_order changes; published dates and statuses stay as they are.
 */
export async function reorderAnnouncements(ids: string[]): Promise<BulkAnnouncementResult> {
  await requireAdmin()
  const parsed = reorderSchema.safeParse(ids)
  if (!parsed.success) return { ok: false, error: "Invalid announcement order." }
  const supabase = await createClient()
  const { data, error } = await supabase.from("announcements").select("id, sort_order")
  if (error || !data) return { ok: false, error: "The announcements could not be loaded. Refresh the page and try again." }
  const current = new Map(data.map((a) => [a.id, a.sort_order]))
  if (new Set(parsed.data).size !== parsed.data.length || parsed.data.length !== current.size || parsed.data.some((id) => !current.has(id))) {
    return { ok: false, error: "The announcements changed. Refresh the page and try again." }
  }
  let changed = 0
  for (const [index, id] of parsed.data.entries()) {
    if (current.get(id) === index + 1) continue
    const { error: updateError } = await supabase.from("announcements").update({ sort_order: index + 1 }).eq("id", id)
    if (updateError) return { ok: false, error: "The new order could not be saved. Refresh the page and try again." }
    changed++
  }
  revalidatePath("/admin/announcements")
  return { ok: true, changed }
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
    ? await supabase.from("announcements").delete().in("id", unique).select("id, image_url")
    : await supabase.from("announcements").update({ status: status[parsed.data.action] }).in("id", unique).select("id, image_url")
  if (error) return { ok: false, error: "The selected announcements could not be updated. Please try again." }
  if (parsed.data.action === "delete") await removeImages(supabase, (data ?? []).map((a) => announcementImagePath(a.image_url)))
  revalidate()
  return { ok: true, changed: data?.length ?? 0 }
}
