import "server-only"

import type { DirectoryBuilding } from "@/lib/campus/directory"
import { normalize } from "@/lib/campus/location-match"
import type { DbClient } from "@/lib/supabase/types"

/**
 * Search-only words for the campus directory (never saved): a college office also matches
 * its code ("CECT"), and a building matches its aliases ("gym"). The same terms Admin ›
 * Campus Map and Campus Agent answers use. Returned as [id, terms] pairs for client props.
 */
export async function directorySearchTerms(db: DbClient, buildings: DirectoryBuilding[]): Promise<[string, string[]][]> {
  const [{ data: departments }, { data: buildingRows }] = await Promise.all([
    db.from("departments").select("code, name"),
    db.from("campus_locations").select("building_id, aliases").eq("location_type", "building"),
  ])
  const codeByCollege = new Map((departments ?? []).map((d) => [normalize(d.name), d.code]))
  return [
    ...buildings.flatMap((b) => b.places.flatMap((p) => {
      const code = codeByCollege.get(normalize(p.name))
      return code ? [[p.id, [code]] as [string, string[]]] : []
    })),
    ...(buildingRows ?? []).filter((r) => r.building_id && r.aliases.length).map((r) => [r.building_id!, r.aliases] as [string, string[]]),
  ]
}
