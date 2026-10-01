import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { getSupabaseEnv } from "./env"

// Anonymous Supabase client for the public landing-page assistant. No cookies, so
// even a signed-in visitor's session is never used: RLS gives the `anon` role only
// public, Ready sources (and public events/announcements, campus locations,
// colleges and programs).
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseEnv()
  return createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
}
