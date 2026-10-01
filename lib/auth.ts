import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type Profile = Tables<"profiles">

// Where each role lands after signing in. The role always comes from
// profiles.role in the database — never from the login form or the URL.
export function homePathFor(role: Profile["role"]) {
  return role === "admin" ? "/admin" : "/app"
}

// The signed-in user's profile, or null when signed out. getClaims() verifies
// the session token; cache() dedupes the lookup within one request.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
  return profile
})

export async function requireProfile() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  return profile
}

export async function requireAdmin() {
  const profile = await requireProfile()
  if (profile.role !== "admin") redirect("/app")
  return profile
}
