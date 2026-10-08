"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Admin › Campus Map: the structured campus directory (buildings and the places inside
// them) and the map legend. These records — not the map image — answer "Where is…?".

export type CampusActionResult = { ok: true } | { ok: false; error: string }

function revalidate() {
  revalidatePath("/admin/campus-map")
  revalidatePath("/app/map")
}

const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) => text(max).transform((v) => v || null)

const placeSchema = z.object({
  id: z.uuid().nullable(),
  name: text(200).min(2, "Each office or place needs a name (at least 2 characters)."),
  area: optionalText(200),
  floor: optionalText(40),
  aliases: z.array(text(100).min(1)).max(20),
})

const buildingSchema = z.object({
  id: z.uuid().nullable(),
  number: z.number({ error: "Enter the building number from the map." }).int().positive("Use the building number from the map.").max(999),
  name: text(200).min(2, "Enter the building name."),
  description: optionalText(1000),
  places: z.array(placeSchema).max(200),
})
export type BuildingInput = z.input<typeof buildingSchema>

/**
 * Creates or updates a building and the places inside it in one save.
 * Places removed in the editor are archived (hidden from the map and answers), not
 * deleted, so office links and history stay intact. Wing/hall areas are kept in step
 * with the places that use them.
 */
export async function saveBuilding(input: BuildingInput): Promise<CampusActionResult> {
  await requireAdmin()
  const parsed = buildingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the building details." }
  const { id, number, name, description, places } = parsed.data
  const db = await createClient()

  const { data: clash } = await db.from("campus_buildings").select("id, name").eq("building_number", number).maybeSingle()
  if (clash && clash.id !== id) return { ok: false, error: `Building ${number} is already “${clash.name}”. Use a different number.` }

  const saved = id
    ? await db.from("campus_buildings").update({ building_number: number, name, description }).eq("id", id).select("id").single()
    : await db.from("campus_buildings").insert({ building_number: number, name, description }).select("id").single()
  if (saved.error || !saved.data) return { ok: false, error: "The building could not be saved. Please try again." }
  const buildingId = saved.data.id

  const { data: existing, error: existingError } = await db.from("campus_locations").select("id, location_type, area, is_active").eq("building_id", buildingId)
  if (existingError) return { ok: false, error: "The building was saved, but its offices could not be loaded. Reload and try again." }
  const fail = { ok: false as const, error: "The building was saved, but not all offices were. Reload the page and check the list." }

  // Places: update the ones kept, insert new ones, archive the ones removed.
  const kept = new Set<string>()
  for (const place of places) {
    const values = { name: place.name, area: place.area, floor: place.floor, aliases: place.aliases.map((a) => a.toLowerCase()), building_id: buildingId, location_type: "place", is_active: true }
    if (place.id && existing?.some((e) => e.id === place.id)) {
      kept.add(place.id)
      const { error } = await db.from("campus_locations").update(values).eq("id", place.id)
      if (error) return fail
    } else {
      const { error } = await db.from("campus_locations").insert(values)
      if (error) return fail
    }
  }
  const removed = (existing ?? []).filter((e) => e.location_type === "place" && e.is_active && !kept.has(e.id)).map((e) => e.id)
  if (removed.length) {
    const { error } = await db.from("campus_locations").update({ is_active: false }).in("id", removed)
    if (error) return fail
  }

  // Wings/halls: one active area row per area still in use (so "Where is Bocobo Hall?" works).
  const areas = new Set(places.flatMap((p) => (p.area ? [p.area] : [])))
  for (const area of areas) {
    const row = existing?.find((e) => e.location_type === "area" && e.area === area)
    const { error } = row
      ? await db.from("campus_locations").update({ is_active: true, name: area }).eq("id", row.id)
      : await db.from("campus_locations").insert({ name: area, area, building_id: buildingId, location_type: "area", aliases: [] })
    if (error) return fail
  }
  const unusedAreas = (existing ?? []).filter((e) => e.location_type === "area" && e.is_active && (!e.area || !areas.has(e.area))).map((e) => e.id)
  if (unusedAreas.length) await db.from("campus_locations").update({ is_active: false }).in("id", unusedAreas)

  // The building's own legacy row (linked from offices) follows its new name.
  await db.from("campus_locations").update({ name }).eq("building_id", buildingId).eq("location_type", "building")

  revalidate()
  return { ok: true }
}

/** Archive hides a building and everything in it from the map page and answers; restore brings it back. */
export async function setBuildingActive(id: string, active: boolean): Promise<CampusActionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid building." }
  const db = await createClient()
  const { error } = await db.from("campus_buildings").update({ is_active: active }).eq("id", id)
  revalidate()
  return error ? { ok: false, error: active ? "The building could not be restored." : "The building could not be archived." } : { ok: true }
}

const legendSchema = z.object({
  id: z.uuid().nullable(),
  code: text(10).min(1, "Enter the symbol shown on the map (e.g. CR)."),
  label: text(120).min(2, "Enter what the symbol means."),
  description: optionalText(500),
})
export type LegendInput = z.input<typeof legendSchema>

export async function saveLegendEntry(input: LegendInput): Promise<CampusActionResult> {
  await requireAdmin()
  const parsed = legendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the legend entry." }
  const { id, code, label, description } = parsed.data
  const db = await createClient()
  const { data: clash } = await db.from("campus_map_legend").select("id").eq("code", code).maybeSingle()
  if (clash && clash.id !== id) return { ok: false, error: `“${code}” is already in the legend.` }
  let error
  if (id) {
    ;({ error } = await db.from("campus_map_legend").update({ code, label, description }).eq("id", id))
  } else {
    const { data: last } = await db.from("campus_map_legend").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle()
    ;({ error } = await db.from("campus_map_legend").insert({ code, label, description, sort_order: (last?.sort_order ?? 0) + 1 }))
  }
  revalidate()
  return error ? { ok: false, error: "The legend entry could not be saved." } : { ok: true }
}

export async function deleteLegendEntry(id: string): Promise<CampusActionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid legend entry." }
  const db = await createClient()
  const { error } = await db.from("campus_map_legend").delete().eq("id", id)
  revalidate()
  return error ? { ok: false, error: "The legend entry could not be deleted." } : { ok: true }
}
