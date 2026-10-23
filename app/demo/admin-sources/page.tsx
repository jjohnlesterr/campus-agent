import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminSourceWalkthrough } from "@/components/demo/admin-source-walkthrough"

export const metadata: Metadata = {
  title: "CECT Agent",
  robots: { index: false, follow: false },
}

// Product-video demo (scripts/demo/README.md). Not linked anywhere, and a 404 outside `next dev`.
export default function AdminSourcesDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <AdminSourceWalkthrough />
}
