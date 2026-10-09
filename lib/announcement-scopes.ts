// Announcement category: where an announcement comes from — University-wide (department_id =
// null) or one department (department_id = that department). A classification only, never
// access control: every Published announcement is visible to every signed-in user.
// Reusable for any department; for now only the codes in ANNOUNCEMENT_SCOPE_CODES are offered
// in the admin form and the filters. Shared by server code, pages, client components and
// tests (no server-only imports).

/** Departments that can have their own announcements today. Add codes here to enable more. */
export const ANNOUNCEMENT_SCOPE_CODES = ["CECT"] as const

export const UNIVERSITY_WIDE = "university"

/** A filter value: every relevant scope, University-wide only, or one department code. */
export type ScopeFilter = "all" | typeof UNIVERSITY_WIDE | string

/** One selectable scope: University-wide (no department) or an enabled department. */
export type AnnouncementScope = { departmentId: string | null; code: string; label: string }

export function scopeFilter(value: unknown, codes: readonly string[] = ANNOUNCEMENT_SCOPE_CODES): ScopeFilter {
  if (value === UNIVERSITY_WIDE) return UNIVERSITY_WIDE
  if (typeof value === "string" && codes.includes(value)) return value
  return "all"
}

/**
 * Whether an announcement (by its department code, null = University-wide) is in the filter.
 * "all" covers University-wide and the enabled categories (used by Campus Agent answers).
 */
export function inScope(departmentCode: string | null, filter: ScopeFilter, codes: readonly string[] = ANNOUNCEMENT_SCOPE_CODES) {
  if (filter === "all") return departmentCode === null || codes.includes(departmentCode)
  if (filter === UNIVERSITY_WIDE) return departmentCode === null
  return departmentCode === filter
}

/** Badge text for an announcement's category. */
export const scopeLabel = (departmentCode: string | null) => departmentCode ?? "University-wide"
