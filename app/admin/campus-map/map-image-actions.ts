"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { IMAGE_TYPES, detectMimeType } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Admin › Campus Map: the map image. Stored in the private `documents` bucket under
// campus-map/ and referenced from system_settings — never as a Knowledge Library
// source, so no documents row, extraction or AI analysis is involved. Buildings,
// locations and the legend are separate records and are never touched here.

export type MapImageResult = { ok: true } | { ok: false; error: string }

const MAX_MAP_BYTES = 15 * 1024 * 1024
const mapPathSchema = z.string().regex(/^campus-map\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/, "Invalid upload path.")

function revalidate() {
  revalidatePath("/admin/campus-map")
  revalidatePath("/app/map")
}

/** Only files this module uploaded are removed when the map changes (never Knowledge Library files). */
const isMapUpload = (path: string | null | undefined): path is string => !!path && mapPathSchema.safeParse(path).success

/**
 * Called after the browser uploads the image to documents/campus-map/<uuid>.<ext>.
 * Verifies the real file type from its bytes, makes it the current map, and removes the
 * previous map image. On any failure the uploaded file is discarded and the current map stays.
 */
export async function setCampusMapImage(input: { filePath: string; fileSize: number }): Promise<MapImageResult> {
  const profile = await requireAdmin()
  const parsed = z.object({ filePath: mapPathSchema, fileSize: z.number().int().positive().max(MAX_MAP_BYTES, "The map image can be up to 15 MB.") }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload." }
  const { filePath, fileSize } = parsed.data
  const db = await createClient()
  const discard = async (error: string): Promise<MapImageResult> => {
    await db.storage.from("documents").remove([filePath])
    return { ok: false, error }
  }

  const { data: file, error: downloadError } = await db.storage.from("documents").download(filePath)
  if (downloadError || !file) return discard("The uploaded image could not be read. Please try again.")
  if (file.size !== fileSize) return discard("The uploaded image is incomplete. Please try again.")
  const mimeType = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!mimeType || !(IMAGE_TYPES as readonly string[]).includes(mimeType)) return discard("Choose a PNG, JPG or WebP image of the campus map.")

  const { data: current } = await db.from("system_settings").select("campus_map_path").eq("id", true).maybeSingle()
  const { data: saved, error } = await db
    .from("system_settings")
    .update({ campus_map_path: filePath, campus_map_mime_type: mimeType, campus_map_updated_at: new Date().toISOString(), campus_map_updated_by: profile.id })
    .eq("id", true)
    .select("id")
    .maybeSingle()
  if (error || !saved) return discard("The map could not be saved. The current map is unchanged.")

  if (isMapUpload(current?.campus_map_path) && current.campus_map_path !== filePath) {
    await db.storage.from("documents").remove([current.campus_map_path])
  }
  revalidate()
  return { ok: true }
}

/** Removes only the map image. The building directory and legend stay as they are. */
export async function removeCampusMapImage(): Promise<MapImageResult> {
  await requireAdmin()
  const db = await createClient()
  const { data: current } = await db.from("system_settings").select("campus_map_path").eq("id", true).maybeSingle()
  const { error } = await db
    .from("system_settings")
    .update({ campus_map_path: null, campus_map_mime_type: null, campus_map_updated_at: new Date().toISOString() })
    .eq("id", true)
  if (error) return { ok: false, error: "The map could not be removed. Please try again." }
  if (isMapUpload(current?.campus_map_path)) await db.storage.from("documents").remove([current.campus_map_path])
  revalidate()
  return { ok: true }
}

/** Cleans up an upload that never became the map (e.g. the browser upload succeeded but saving failed). */
export async function discardCampusMapUpload(filePath: string): Promise<void> {
  await requireAdmin()
  if (!mapPathSchema.safeParse(filePath).success) return
  const db = await createClient()
  const { data: current } = await db.from("system_settings").select("campus_map_path").eq("id", true).maybeSingle()
  if (current?.campus_map_path === filePath) return
  await db.storage.from("documents").remove([filePath])
}
