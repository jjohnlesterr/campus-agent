import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Branding = {
  assistantName: string
  universityName: string | null
  timezone: string
}

const DEFAULT_BRANDING: Branding = {
  assistantName: "Campus Agent",
  universityName: null,
  timezone: "Asia/Manila",
}

// White-label values from system_settings (readable by everyone). Falls back to
// "Campus Agent" so the UI never hardcodes a school name.
export const getBranding = cache(async (): Promise<Branding> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("system_settings")
    .select("assistant_name, university_name, timezone")
    .maybeSingle()
  if (!data) return DEFAULT_BRANDING
  return {
    assistantName: data.assistant_name,
    universityName: data.university_name,
    timezone: data.timezone,
  }
})
