import "server-only"

import type { AnswerSource, StructuredAnswer } from "@/lib/ai/answer-types"
import type { DirectoryBuilding } from "@/lib/campus/directory"
import { type LegendEntry, detectLegendQuestion, legendNote, legendSentence } from "@/lib/campus/legend-match"
import {
  type LocationQuestion,
  type MapPlace,
  ambiguousIntro,
  buildingContents,
  contentsSentence,
  describePlace,
  isBuilding,
  locationSentence,
  mapHint,
  matchPlace,
  normalize,
  notFoundSentence,
} from "@/lib/campus/location-match"
import { createClient } from "@/lib/supabase/server"
import type { DbClient } from "@/lib/supabase/types"

export type CampusMapImage = { title: string; file_path: string; mime_type: string; updated_at: string | null }

/**
 * The current campus map image, referenced from system_settings (Admin › Campus Map).
 * It is a picture only: location answers come from the buildings/locations records.
 * The file itself is readable through the storage policy for the current map path.
 */
export async function getActiveCampusMap(supabase: DbClient): Promise<{ map: CampusMapImage | null }> {
  const { data } = await supabase
    .from("system_settings")
    .select("campus_map_path, campus_map_mime_type, campus_map_updated_at")
    .eq("id", true)
    .maybeSingle()
  if (!data?.campus_map_path || !data.campus_map_mime_type) return { map: null }
  return { map: { title: "Official campus map", file_path: data.campus_map_path, mime_type: data.campus_map_mime_type, updated_at: data.campus_map_updated_at } }
}

/**
 * The campus directory: buildings (by number) with the areas and places inside them.
 * The building's own legacy row (location_type = building) is not listed as a place.
 * Archived buildings and places are left out unless includeArchived (admin).
 */
export async function getCampusDirectory(supabase: DbClient, { includeArchived = false } = {}): Promise<DirectoryBuilding[]> {
  let buildingQuery = supabase.from("campus_buildings").select("id, building_number, name, description, is_active").order("building_number")
  let placeQuery = supabase.from("campus_locations").select("id, building_id, name, area, floor, aliases, location_type, is_active").not("building_id", "is", null).neq("location_type", "building").order("name")
  if (!includeArchived) {
    buildingQuery = buildingQuery.eq("is_active", true)
    placeQuery = placeQuery.eq("is_active", true)
  }
  const [{ data: buildings, error }, { data: places, error: placeError }] = await Promise.all([buildingQuery, placeQuery])
  if (error || placeError) throw new Error("The campus directory could not be loaded.")
  return (buildings ?? []).map((b) => ({
    id: b.id,
    number: b.building_number,
    name: b.name,
    description: b.description,
    isActive: b.is_active,
    places: (places ?? [])
      .filter((p) => p.building_id === b.id)
      .map((p) => ({ id: p.id, name: p.name, area: p.area, floor: p.floor, aliases: p.aliases, kind: p.location_type === "area" ? ("area" as const) : ("place" as const) })),
  }))
}

/** Every active building and place, in the shape the location matcher uses. */
async function getMapPlaces(supabase: DbClient): Promise<MapPlace[]> {
  const directory = await getCampusDirectory(supabase)
  // The legacy building rows carry aliases (e.g. "gym", "hospital"); keep them searchable.
  const { data: buildingRows } = await supabase.from("campus_locations").select("building_id, aliases").eq("location_type", "building").eq("is_active", true)
  const buildingAliases = new Map((buildingRows ?? []).map((r) => [r.building_id, r.aliases]))
  return directory.flatMap((b) => [
    { name: b.name, building_name: b.name, building_number: b.number, floor: null, aliases: buildingAliases.get(b.id) ?? [], kind: "building" as const },
    ...b.places.map((p) => ({
      name: p.name,
      building_name: p.kind === "place" && p.area ? `${p.area}, ${b.name}` : b.name,
      building_number: b.number,
      floor: p.floor,
      aliases: p.aliases,
      kind: p.kind,
      area: p.area,
    })),
  ])
}

/** College name → its code ("CECT"), from the departments table, so codes match their college's legend entry. */
async function getDepartmentAliases(supabase: DbClient) {
  const { data } = await supabase.from("departments").select("code, name")
  return new Map((data ?? []).map((d) => [normalize(d.name), [d.code]]))
}

function mapSources(numbers: number[], mapTitle: string | null): AnswerSource[] {
  return numbers.map((n) => ({
    label: `Official campus map — Building ${n}`,
    documentTitle: mapTitle ?? "Official campus map",
    pageNumber: null,
    sectionTitle: `Building ${n}`,
  }))
}

/**
 * Answers a location question from the map legend, or returns null when no
 * entry matches (the caller then tries the handbook). No AI is involved.
 */
export async function lookupLocation(question: LocationQuestion, supabase?: DbClient): Promise<StructuredAnswer | null> {
  supabase ??= await createClient()
  const [places, departmentAliases, { map }] = await Promise.all([
    getMapPlaces(supabase),
    getDepartmentAliases(supabase),
    getActiveCampusMap(supabase),
  ])
  const match = matchPlace(question.target, places, departmentAliases, { exactOnly: question.exactOnly, fuzzy: question.fuzzy })
  if (match.kind === "none") return null

  const matched = match.kind === "found" ? [match.place] : match.places
  const numbers = [...new Set(matched.map((p) => p.building_number))]
  const location = { buildingNumbers: numbers, mapAvailable: Boolean(map) }
  // A building answer already says "Building N on the campus map"; places inside one get the hint.
  const onlyBuildings = matched.every(isBuilding)
  const hint = map && !onlyBuildings ? ` ${mapHint(numbers, question.language)}` : ""

  if (match.kind === "found") {
    return {
      status: "answered",
      summary: `${locationSentence(match.place, question.language)}${hint}`,
      steps: [],
      requirements: [],
      details: "",
      gaps: "",
      sources: mapSources(numbers, map?.title ?? null),
      location,
    }
  }
  return {
    status: "answered",
    summary: ambiguousIntro(question.target, question.language),
    steps: [],
    requirements: [],
    details: [...match.places.map((p) => `- **${p.name}** — ${describePlace(p)}`), hint.trim()].filter(Boolean).join("\n"),
    gaps: "",
    sources: mapSources(numbers, map?.title ?? null),
    location,
  }
}

/** A location question nothing verified answers: say so, and offer the map when there is one. */
export async function locationNotFound(question: LocationQuestion, supabase?: DbClient): Promise<StructuredAnswer> {
  const { map } = await getActiveCampusMap(supabase ?? (await createClient()))
  return {
    status: "not_found",
    summary: notFoundSentence(question.target, question.language),
    steps: [],
    requirements: [],
    details: "",
    gaps: "",
    sources: [],
    location: { buildingNumbers: [], mapAvailable: Boolean(map) },
  }
}

/**
 * "What is in Building 20?" / "What offices are inside the Gloria D. Lacson Building?"
 * Lists the building's places by hall and floor, or null when no building matches.
 */
export async function lookupBuildingContents(question: LocationQuestion, supabase?: DbClient): Promise<StructuredAnswer | null> {
  supabase ??= await createClient()
  const [places, { map }] = await Promise.all([getMapPlaces(supabase), getActiveCampusMap(supabase)])
  const buildings = places.filter(isBuilding)
  const match = matchPlace(question.target, buildings, new Map(), { fuzzy: true })
  if (match.kind !== "found") return null
  const building = match.place
  const lines = buildingContents(building, places)
  return {
    status: "answered",
    summary: contentsSentence(building, lines.length, question.language),
    steps: [],
    requirements: [],
    details: [...lines, map ? mapHint([building.building_number], question.language) : ""].filter(Boolean).join("\n"),
    gaps: "",
    sources: mapSources([building.building_number], map?.title ?? null),
    location: { buildingNumbers: [building.building_number], mapAvailable: Boolean(map) },
  }
}

/**
 * Map legend questions ("What does CR mean?", "Is there parking?"). Answers only what
 * the legend states and points to the map; never an exact spot. Null when the question
 * is not about a legend symbol.
 */
export async function lookupLegend(question: string, supabase?: DbClient): Promise<StructuredAnswer | null> {
  supabase ??= await createClient()
  const { data: legend } = await supabase.from("campus_map_legend").select("code, label, description").order("sort_order")
  const asked = detectLegendQuestion(question, (legend ?? []) as LegendEntry[])
  if (!asked) return null
  const { map } = await getActiveCampusMap(supabase)
  return {
    status: "answered",
    summary: legendSentence(asked, Boolean(map)),
    steps: [],
    requirements: [],
    details: asked.kind === "available" ? legendNote(asked.language) : "",
    gaps: "",
    sources: [{ label: `${map?.title ?? "Official campus map"} — Legend`, documentTitle: map?.title ?? "Official campus map", pageNumber: null, sectionTitle: "Legend" }],
    location: { buildingNumbers: [], mapAvailable: Boolean(map) },
  }
}
