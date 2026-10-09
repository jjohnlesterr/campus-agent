import "server-only"

import { safeExternalUrl } from "@/lib/social-links"
import type { DbClient } from "@/lib/supabase/types"

// Departments (/app/departments): read-only views of the departments and programs managed
// in Admin › Departments. Only Published departments are shown; covers use the crop
// position the admin set.

export type DepartmentCard = {
  id: string
  name: string
  shortName: string
  description: string | null
  /** Official Facebook page (http/https only), or null. */
  facebookUrl: string | null
  logoUrl: string | null
  coverUrl: string | null
  /** CSS object-position for the cover, from the admin's crop. */
  coverPosition: string
  programs: { id: string; name: string; code: string | null }[]
}

const SELECT = "id, code, name, description, facebook_url, logo_url, cover_image_url, cover_position_x, cover_position_y, sort_order, programs(id, name, code, sort_order)"

type Row = {
  id: string; code: string; name: string; description: string | null; facebook_url: string | null; logo_url: string | null; cover_image_url: string | null
  cover_position_x: number; cover_position_y: number
  programs: { id: string; name: string; code: string | null; sort_order: number | null }[]
}

function toCard(d: Row): DepartmentCard {
  return {
    id: d.id,
    name: d.name,
    shortName: d.code,
    description: d.description,
    facebookUrl: safeExternalUrl(d.facebook_url),
    logoUrl: d.logo_url,
    coverUrl: d.cover_image_url,
    coverPosition: `${Number(d.cover_position_x)}% ${Number(d.cover_position_y)}%`,
    programs: [...d.programs]
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.name.localeCompare(b.name))
      .map(({ id, name, code }) => ({ id, name, code })),
  }
}

/** Published departments in the admin's gallery order. */
export async function listPublishedDepartments(db: DbClient): Promise<DepartmentCard[]> {
  const { data, error } = await db.from("departments").select(SELECT).eq("is_published", true).order("sort_order", { nullsFirst: false }).order("code")
  if (error) throw new Error("Departments could not be loaded.")
  return (data ?? []).map(toCard)
}

export async function getPublishedDepartment(db: DbClient, id: string): Promise<DepartmentCard | null> {
  const { data, error } = await db.from("departments").select(SELECT).eq("id", id).eq("is_published", true).maybeSingle()
  if (error) throw new Error("This department could not be loaded.")
  return data ? toCard(data) : null
}

/** A program's code, or null when it has none (or the stored value only repeats the name). */
export function programCode(program: { name: string; code: string | null }) {
  return program.code && program.code !== program.name ? program.code : null
}
