"use client"

import { LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

/**
 * Reads the invitation link's fragment (#access_token=…&refresh_token=…, or #error=…),
 * starts the session with Supabase Auth, and continues to "Set your password". The tokens
 * never leave the browser except to Supabase, and are removed from the address bar.
 */
export function AcceptInvite() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    window.history.replaceState(null, "", window.location.pathname)
    const accessToken = hash.get("access_token")
    const refreshToken = hash.get("refresh_token")
    if (hash.get("error") || !accessToken || !refreshToken) {
      // Defer the state change: no synchronous setState inside the effect.
      queueMicrotask(() => setFailed(true))
      return
    }
    createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) return setFailed(true)
      router.replace("/change-password")
    })
  }, [router])

  if (failed) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">This invitation link has expired</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Invitation links can be used once and expire after a while. Ask your administrator to send a new invitation.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Go to sign in</Link>
      </>
    )
  }
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      Opening your invitation…
    </p>
  )
}
