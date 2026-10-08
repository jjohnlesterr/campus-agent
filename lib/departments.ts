import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Department = { id: string; code: string; name: string }

export const getDepartments = cache(async (): Promise<Department[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from("departments").select("id, code, name").order("code")
  return data ?? []
})

export type Program = { id: string; code: string; name: string; department_id: string }

export const getPrograms = cache(async (): Promise<Program[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from("programs").select("id, code, name, department_id").order("name")
  return data ?? []
})

// Admin Users filter: all | university | <code>. Unknown values fall back to all.
export type AdminDepartmentFilter =
  | { kind: "all" }
  | { kind: "university" }
  | { kind: "department"; department: Department }

export function resolveAdminDepartmentFilter(
  param: string | string[] | undefined,
  departments: Department[]
): AdminDepartmentFilter {
  const value = Array.isArray(param) ? param[0] : param
  if (value === "university") return { kind: "university" }
  const department = departments.find((d) => d.code === value)
  return department ? { kind: "department", department } : { kind: "all" }
}
