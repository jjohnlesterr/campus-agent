import "server-only"

import type { AnswerSource, StructuredAnswer } from "@/lib/ai/answer-types"
import {
  type LocationQuestion,
  type MapPlace,
  ambiguousIntro,
  describePlace,
  isBuilding,
  locationSentence,
  mapHint,
  matchPlace,
  normalize,
  notFoundSentence,
} from "@/lib/campus/location-match"
import { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type CampusMapSource = { id: string; title: string; file_path: string; mime_type: string; created_at: string }

/**
 * The active campus map: the newest Ready source of type Campus Map, preferring
 * an image over a PDF. Runs under the caller's session (RLS), so students only
 * ever see Ready sources.
 */
export async function getActiveCampusMap(supabase: Supabase): Promise<{ map: CampusMapSource | null; count: number }> {
  const { data } = await supabase
    .from("documents")
    .select("id, title, file_path, mime_type, created_at")
    .eq("document_type", "campus_map")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
  const maps = data ?? []
  return { map: maps.find((m) => m.mime_type.startsWith("image/")) ?? maps[0] ?? null, count: maps.length }
}

/** Entries from the official map legend (rows with a building number). */
async function getMapPlaces(supabase: Supabase): Promise<MapPlace[]> {
  const { data, error } = await supabase
    .from("campus_locations")
    .select("name, building_name, building_number, floor, aliases")
    .not("building_number", "is", null)
  if (error) throw new Error(`Campus locations could not be loaded: ${error.message}`)
  return (data ?? []).flatMap((p) => (p.building_number === null ? [] : [{ ...p, building_number: p.building_number }]))
}

/** College name → its code ("CECT"), from the departments table, so codes match their college's legend entry. */
async function getDepartmentAliases(supabase: Supabase) {
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
export async function lookupLocation(question: LocationQuestion): Promise<StructuredAnswer | null> {
  const supabase = await createClient()
  const [places, departmentAliases, { map }] = await Promise.all([
    getMapPlaces(supabase),
    getDepartmentAliases(supabase),
    getActiveCampusMap(supabase),
  ])
  const match = matchPlace(question.target, places, departmentAliases, { exactOnly: question.exactOnly })
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
export async function locationNotFound(question: LocationQuestion): Promise<StructuredAnswer> {
  const { map } = await getActiveCampusMap(await createClient())
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
