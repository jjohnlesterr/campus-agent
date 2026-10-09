import "server-only"

import { ANNOUNCEMENT_SCOPE_CODES, type AnnouncementScope } from "@/lib/announcement-scopes"
import type { DbClient } from "@/lib/supabase/types"

/** University-wide plus the enabled departments that exist (by their real department ids). */
export async function getAnnouncementScopes(db: DbClient): Promise<AnnouncementScope[]> {
  const { data } = await db.from("departments").select("id, code").in("code", [...ANNOUNCEMENT_SCOPE_CODES])
  const departments = ANNOUNCEMENT_SCOPE_CODES.flatMap((code) => {
    const d = (data ?? []).find((row) => row.code === code)
    return d ? [{ departmentId: d.id, code: d.code, label: d.code }] : []
  })
  return [{ departmentId: null, code: "university", label: "University-wide" }, ...departments]
}
