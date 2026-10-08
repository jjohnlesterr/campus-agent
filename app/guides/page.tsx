import type { Metadata } from "next"

import { GuideList } from "@/components/guides/guide-list"
import { listPublishedGuides } from "@/lib/knowledge/guides"
import { createPublicClient } from "@/lib/supabase/public"

export const metadata: Metadata = { title: "School Guides" }

// Anonymous client: even a signed-in visitor only sees Published, public guides here.
export default async function PublicGuidesPage() {
  const { data: guides, error } = await listPublishedGuides(createPublicClient(), { publicOnly: true })
  return (
    <GuideList
      guides={guides}
      failed={Boolean(error)}
      basePath="/guides"
      emptyDescription="Guides appear here once the university publishes them. You can still ask a question on the home page."
    />
  )
}
