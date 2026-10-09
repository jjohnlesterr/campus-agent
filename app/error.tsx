"use client"

import { ErrorState } from "@/components/shared/error-state"

// Unexpected errors render a friendly message instead of Next's default error screen.
// Any page outside the signed-in app and admin.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} homeHref="/" homeLabel="Go to home" />
}
