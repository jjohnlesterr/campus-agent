import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { getSupabaseEnv } from "./env"

// Service-role Supabase client. Bypasses RLS — use only in server actions that
// have already called requireAdmin(). The key is never NEXT_PUBLIC_ and this
// module is server-only, so it can't be bundled into client code.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return null

  return createClient<Database>(getSupabaseEnv().url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
