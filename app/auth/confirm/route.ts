import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Landing point for Supabase email links (e.g. sign-up confirmation, password reset).
// Supports both the PKCE `code` link and the `token_hash` email template.
// On success the session cookie is set and /login forwards the user by role; a verified
// password-reset (recovery) link goes to /reset-password to choose a new password.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  const supabase = await createClient()
  let ok = false
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  }

  // An invitation link (token_hash email template) continues to "Set your password".
  const next = !ok ? "/login?error=confirm" : type === "recovery" ? "/reset-password" : type === "invite" ? "/change-password" : "/login"
  return NextResponse.redirect(new URL(next, request.url))
}
