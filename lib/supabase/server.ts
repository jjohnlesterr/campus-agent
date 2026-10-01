import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "./database.types"
import { getSupabaseEnv } from "./env"

// Supabase client for Server Components, Server Functions and Route Handlers.
// Create a new client per request — never share one across requests.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Components can't set cookies. Safe to ignore because
          // proxy.ts refreshes the session on every request.
        }
      },
    },
  })
}
