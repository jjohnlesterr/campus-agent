import "server-only"

import { createClient } from "@/lib/supabase/server"

export async function getLocationNames() {
  const supabase = await createClient()
  // Suggestions for the office form: active campus directory names only.
  const { data } = await supabase.from("campus_locations").select("name").eq("is_active", true).order("name")
  return [...new Set((data ?? []).map((l) => l.name))]
}
