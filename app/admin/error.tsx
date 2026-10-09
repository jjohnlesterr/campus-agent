"use client"

import { ErrorState } from "@/components/shared/error-state"

// Unexpected errors render a friendly message instead of Next's default error screen.
// Admin pages: the admin sidebar stays in place.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} homeHref="/admin" homeLabel="Go to dashboard" />
}
