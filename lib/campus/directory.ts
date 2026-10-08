// Campus directory shapes and pure helpers shared by Admin › Campus Map, the student
// Campus Map page and tests. No database access here (see lib/campus/locations.ts).

import { normalize } from "@/lib/campus/location-match"

export type DirectoryPlace = { id: string; name: string; area: string | null; floor: string | null; aliases: string[]; kind: "area" | "place" }

export type DirectoryBuilding = {
  id: string
  number: number
  name: string
  description: string | null
  isActive: boolean
  places: DirectoryPlace[]
}

export type PlaceGroup = { area: string | null; floor: string | null; places: DirectoryPlace[] }

/**
 * A building's offices grouped the way the map legend lists them: by wing/hall, then
 * floor (L1, L2 …). Places with no floor recorded come after the floors of their hall.
 * Area rows (the halls themselves) are headings, not listed as places.
 */
export function groupPlaces(places: DirectoryPlace[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>()
  for (const place of places.filter((p) => p.kind === "place")) {
    const key = `${place.area ?? ""}\u0000${place.floor ?? ""}`
    const group = groups.get(key) ?? { area: place.area, floor: place.floor, places: [] }
    group.places.push(place)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) =>
    (a.area ?? "").localeCompare(b.area ?? "") ||
    (a.floor === null ? 1 : 0) - (b.floor === null ? 1 : 0) ||
    (a.floor ?? "").localeCompare(b.floor ?? "", undefined, { numeric: true }))
}

/**
 * Search-only words keyed by building or place id, e.g. a college's code ("CECT") for
 * its office, or a building's legacy aliases ("gym"). Never saved with the place.
 */
export type SearchTerms = ReadonlyMap<string, readonly string[]>

const searchText = (query: string) => normalize(query).replace(/\b(?:building|bldg)\b/g, "").trim()

function placeFields(place: DirectoryPlace, extra?: SearchTerms) {
  return [place.name, place.area ?? "", ...place.aliases, ...(extra?.get(place.id) ?? [])].map(normalize)
}

const hasAllWords = (fields: string[], words: string[]) => fields.some((field) => words.every((word) => field.includes(word)))

/**
 * Search box match: building number ("18", "building 18"), building name, or any
 * office/place name or alias (plus `extra` search words). Word order and "&"/"and" don't matter.
 */
export function matchesDirectorySearch(building: DirectoryBuilding, query: string, extra?: SearchTerms) {
  const q = searchText(query)
  if (!q) return true
  if (/^\d+$/.test(q)) return building.number === Number(q)
  const words = q.split(" ")
  const fields = [building.name, ...(extra?.get(building.id) ?? [])].map(normalize)
  return hasAllWords(fields, words) || building.places.some((p) => hasAllWords(placeFields(p, extra), words))
}

/** The places in a building that match the search (all of them when the building itself matches). */
export function matchingPlaces(building: DirectoryBuilding, query: string) {
  const q = searchText(query)
  if (!q || /^\d+$/.test(q) || normalize(building.name).includes(q)) return new Set(building.places.map((p) => p.id))
  const words = q.split(" ")
  return new Set(building.places.filter((p) => hasAllWords(placeFields(p), words)).map((p) => p.id))
}

/** Only the places whose own name, hall or aliases match (for highlighting in the admin directory). */
export function placesMatchingSearch(building: DirectoryBuilding, query: string, extra?: SearchTerms) {
  const q = searchText(query)
  if (!q || /^\d+$/.test(q)) return new Set<string>()
  const words = q.split(" ")
  return new Set(building.places.filter((p) => p.kind === "place" && hasAllWords(placeFields(p, extra), words)).map((p) => p.id))
}

/** "4 levels · 14 locations", "2 halls · 9 locations", or "No sub-locations" — derived, not stored. */
export function describeBuildingContents(building: DirectoryBuilding) {
  const places = building.places.filter((p) => p.kind === "place")
  const levels = new Set(places.map((p) => p.floor).filter(Boolean)).size
  const halls = new Set(building.places.map((p) => p.area).filter(Boolean)).size
  const parts = [
    halls > 1 && `${halls} halls`,
    levels > 0 && `${levels} ${levels === 1 ? "level" : "levels"}`,
    places.length > 0 && `${places.length} ${places.length === 1 ? "location" : "locations"}`,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "No sub-locations"
}

/**
 * The buildings to render: every match while searching (search always covers the whole
 * directory), otherwise the first `limit` in building-number order. `hasMore` tells the
 * page whether to keep watching for the next batch.
 */
export function directoryWindow<T extends { number: number }>(matches: T[], limit: number, searching: boolean) {
  const ordered = [...matches].sort((a, b) => a.number - b.number)
  const shown = searching ? ordered : ordered.slice(0, Math.max(0, limit))
  return { shown, hasMore: shown.length < ordered.length }
}
