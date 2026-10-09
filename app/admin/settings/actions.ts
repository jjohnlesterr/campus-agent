"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { toFieldErrors } from "@/lib/forms"
import { BRANDING_BUCKET, BRANDING_IMAGES, BRANDING_IMAGE_PATH, BRANDING_IMAGE_TYPES, type BrandingImage, MAX_BRANDING_IMAGE_BYTES, brandingImagePath } from "@/lib/settings"
import { detectMimeType } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Admin › Settings: the school's configuration in the one-row system_settings table (general
// information, school logo, AI preferences). Campus Agent's own name and logo are fixed in
// code and never written here. Content is managed in its own modules, and secrets stay in
// environment configuration. Only admins can write system_settings (RLS).

type Client = Awaited<ReturnType<typeof createClient>>

function revalidate() {
  // Names, time zone and AI preferences are read across the whole app.
  revalidatePath("/", "layout")
}

const settingsSchema = z.object({
  university_name: z.string().trim().min(2, "Enter the university name.").max(150, "Use 150 characters or fewer."),
  university_short_name: z.string().trim().min(1, "Enter a short name, such as WUP.").max(20, "Use 20 characters or fewer."),
  timezone: z.string().trim().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", "Choose a time zone from the list."),
  response_language: z.enum(["auto", "en", "fil"], "Choose a response language."),
  show_source_references: z.boolean(),
})
export type SettingsInput = z.input<typeof settingsSchema>
export type SettingsResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }

/** Saves the general information and AI preferences together, in one update. */
export async function saveSettings(input: SettingsInput): Promise<SettingsResult> {
  await requireAdmin()
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) }
  const db = await createClient()
  const { error } = await db.from("system_settings").update(parsed.data).eq("id", true)
  if (error) return { ok: false, error: "The settings could not be saved. Please try again." }
  revalidate()
  return { ok: true }
}

export type BrandingResult = { ok: true } | { ok: false; error: string }

async function removeImages(db: Client, paths: (string | null)[]) {
  const own = paths.filter((p): p is string => !!p && BRANDING_IMAGE_PATH.test(p))
  if (own.length) await db.storage.from(BRANDING_BUCKET).remove(own)
}

/**
 * Sets (a new upload's storage path) or removes (null) a logo. The browser uploads the
 * file to public-assets/branding/ first; it is verified here from its bytes and removed
 * again if anything fails. The replaced logo file is deleted only after saving.
 */
export async function setBrandingImage(field: BrandingImage, path: string | null): Promise<BrandingResult> {
  await requireAdmin()
  if (!Object.hasOwn(BRANDING_IMAGES, field)) return { ok: false, error: "Unknown image." }
  if (path !== null && !BRANDING_IMAGE_PATH.test(path)) return { ok: false, error: "Invalid upload." }
  const db = await createClient()
  const fail = async (error: string): Promise<BrandingResult> => {
    await removeImages(db, [path])
    return { ok: false, error }
  }

  if (path) {
    const { data: file, error } = await db.storage.from(BRANDING_BUCKET).download(path)
    if (error || !file) return fail("The image could not be read. Please upload it again.")
    if (file.size > MAX_BRANDING_IMAGE_BYTES) return fail("The image must be 2 MB or smaller.")
    const type = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
    if (!type || !(BRANDING_IMAGE_TYPES as readonly string[]).includes(type)) return fail("Choose a PNG, JPG or WebP image.")
  }

  const { data: current } = await db.from("system_settings").select("university_logo_url").eq("id", true).maybeSingle()
  const previous = current?.university_logo_url ?? null
  const url = path ? db.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl : null
  const { error } = await db.from("system_settings").update({ university_logo_url: url }).eq("id", true)
  if (error) return fail("The image could not be saved. Please try again.")
  await removeImages(db, [brandingImagePath(previous)])
  revalidate()
  return { ok: true }
}
