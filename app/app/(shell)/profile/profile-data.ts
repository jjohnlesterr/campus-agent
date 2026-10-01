import "server-only"

import { createClient } from "@/lib/supabase/server"

// Department and program choices for the onboarding/profile form.
export async function getProfileOptions() {
  const supabase = await createClient()
  const [departments, programs] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("programs").select("id, name, department_id").order("name"),
  ])
  return { departments: departments.data ?? [], programs: programs.data ?? [] }
}
