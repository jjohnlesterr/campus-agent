import { NextResponse } from "next/server"

import { getSupabaseEnv } from "@/lib/supabase/env"

// Dev-only connectivity check: GET /api/health/supabase
// Calls the Supabase Auth health endpoint through the API gateway, which
// rejects requests with an invalid key — so a 200 confirms both the project
// URL and the publishable key. Reads no data and returns no secrets.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 })
  }

  const { url, publishableKey } = getSupabaseEnv()

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
    })

    return NextResponse.json(
      { ok: res.ok, status: res.status, project: new URL(url).hostname },
      { status: res.ok ? 200 : 502 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    )
  }
}
