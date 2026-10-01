import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Department = { id: string; code: string; name: string }

export const getDepartments = cache(async (): Promise<Department[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from("departments").select("id, code, name").order("name")
  return data ?? []
})

// Department filter for student Events/Announcements. Department personalizes
// what is shown by default; it never restricts what a student may browse.
//   mine        → the student's department + university-wide items
//   all         → everything
//   university  → items with no department
//   <code>      → one department (e.g. "CCS")
export type DepartmentFilter =
  | { kind: "mine"; department: Department }
  | { kind: "all" }
  | { kind: "university" }
  | { kind: "department"; department: Department }

export function resolveDepartmentFilter(
  param: string | string[] | undefined,
  departments: Department[],
  myDepartmentId: string | null
): DepartmentFilter {
  const value = Array.isArray(param) ? param[0] : param
  const mine = departments.find((d) => d.id === myDepartmentId)

  if (value === "all") return { kind: "all" }
  if (value === "university") return { kind: "university" }
  const byCode = departments.find((d) => d.code === value)
  if (byCode) return { kind: "department", department: byCode }
  return mine ? { kind: "mine", department: mine } : { kind: "all" }
}

export function filterValue(filter: DepartmentFilter) {
  if (filter.kind === "department") return filter.department.code
  return filter.kind
}

/** e.g. "CCS and university-wide events" — shown above filtered lists. */
export function describeFilter(filter: DepartmentFilter, noun: string) {
  switch (filter.kind) {
    case "mine":
      return `${filter.department.code} and university-wide ${noun}`
    case "department":
      return `${filter.department.name} ${noun}`
    case "university":
      return `University-wide ${noun}`
    case "all":
      return `${noun[0].toUpperCase()}${noun.slice(1)} from all departments`
  }
}
