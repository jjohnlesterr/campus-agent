import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Branding = {
  /** The product name. Fixed by default ("Campus Agent"); not edited in Admin › Settings. */
  assistantName: string
  universityName: string | null
  universityShortName: string | null
  universityLogoUrl: string | null
  timezone: string
}

const DEFAULT_BRANDING: Branding = {
  assistantName: "Campus Agent",
  universityName: null,
  universityShortName: null,
  universityLogoUrl: null,
  timezone: "Asia/Manila",
}

// White-label values from system_settings (readable by everyone): the school's name, short
// name, logo and time zone. Falls back to "Campus Agent" so the UI never hardcodes a school.
export const getBranding = cache(async (): Promise<Branding> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("system_settings")
    .select("assistant_name, university_name, university_short_name, university_logo_url, timezone")
    .maybeSingle()
  if (!data) return DEFAULT_BRANDING
  return {
    assistantName: data.assistant_name,
    universityName: data.university_name,
    universityShortName: data.university_short_name,
    universityLogoUrl: data.university_logo_url,
    timezone: data.timezone,
  }
})
