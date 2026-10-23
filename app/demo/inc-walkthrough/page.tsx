import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { IncWalkthrough } from "@/components/demo/inc-walkthrough"

export const metadata: Metadata = {
  title: "CECT Agent",
  robots: { index: false, follow: false },
}

// Product-video demo (scripts/demo/README.md). Not linked anywhere, and a 404 outside `next dev`.
export default function IncWalkthroughPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <IncWalkthrough />
}
