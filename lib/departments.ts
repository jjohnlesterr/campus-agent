import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Department = { id: string; code: string; name: string }

export const getDepartments = cache(async (): Promise<Department[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from("departments").select("id, code, name").order("code")
  return data ?? []
})

export type Program = { id: string; code: string | null; name: string; department_id: string }

export const getPrograms = cache(async (): Promise<Program[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from("programs").select("id, code, name, department_id").order("name")
  return data ?? []
})
