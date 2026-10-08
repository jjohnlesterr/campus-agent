import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type Profile = Tables<"profiles">

export const CHANGE_PASSWORD_PATH = "/change-password"

// Where each role lands after signing in. The role always comes from
// profiles.role in the database — never from the login form or the URL.
export function homePathFor(role: Profile["role"]) {
  return role === "admin" ? "/admin" : "/app"
}

/**
 * College / program used only to personalize (rank) results. Self-registered users
 * set an intended college; legacy admin-provisioned accounts fall back to theirs.
 */
export function personalDepartmentId(profile: Pick<Profile, "intended_department_id" | "department_id">) {
  return profile.intended_department_id ?? profile.department_id
}

export function personalProgramId(profile: Pick<Profile, "intended_program_id" | "program_id">) {
  return profile.intended_program_id ?? profile.program_id
}

/** Where a signed-in user should go next: change a temporary password first, then home. */
export function nextPathFor(profile: Pick<Profile, "role" | "must_change_password">) {
  return profile.must_change_password ? CHANGE_PASSWORD_PATH : homePathFor(profile.role)
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

/**
 * Signed-in user with a usable account. Sends signed-out visitors to /login
 * and users still on a temporary password to /change-password.
 */
export async function requireProfile() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  if (profile.must_change_password) redirect(CHANGE_PASSWORD_PATH)
  return profile
}

export async function requireAdmin() {
  const profile = await requireProfile()
  if (profile.role !== "admin") redirect("/app")
  return profile
}
