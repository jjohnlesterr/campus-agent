import "server-only"

import { createClient } from "@/lib/supabase/server"

export async function getLocationNames() {
  const supabase = await createClient()
  const { data } = await supabase.from("campus_locations").select("name").order("name")
  return [...new Set((data ?? []).map((l) => l.name))]
}
