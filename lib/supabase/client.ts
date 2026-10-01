import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./database.types"
import { getSupabaseEnv } from "./env"

// Supabase client for Client Components. Uses only the publishable key;
// access control is enforced by Row Level Security in the database.
// createBrowserClient returns a singleton in the browser, so calling this
// repeatedly is cheap.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv()
  return createBrowserClient<Database>(url, publishableKey)
}
