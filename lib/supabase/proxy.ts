import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "./database.types"
import { getSupabaseEnv } from "./env"

const PROTECTED_PREFIXES = ["/app", "/admin"]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Refreshes the Supabase auth session cookie on each request so Server
// Components always see a valid session. Called from the root proxy.ts.
//
// This is only an optimistic check: signed-out visitors are sent to /login
// before /app or /admin renders. Role checks (student vs admin) are NOT done
// here — they happen on the server in lib/auth.ts (requireProfile /
// requireAdmin) and are enforced again by RLS in the database.
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value)
        )
      },
    },
  })

  // Do not run code between createServerClient and getClaims() — it
  // validates the JWT and triggers a token refresh when needed.
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims && isProtected(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    const redirect = NextResponse.redirect(loginUrl)
    // Keep any cookie changes (e.g. a cleared expired session).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}
