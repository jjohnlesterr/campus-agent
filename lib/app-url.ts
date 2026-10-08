import "server-only"

import { headers } from "next/headers"

/**
 * The app's public base URL for email links: NEXT_PUBLIC_APP_URL (the Vercel URL in
 * production). Falls back to the host this request came in on, so local development works.
 */
export async function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return new URL(process.env.NEXT_PUBLIC_APP_URL)
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https")
  return new URL(`${proto}://${host}`)
}
