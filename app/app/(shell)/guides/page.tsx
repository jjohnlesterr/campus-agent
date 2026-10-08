import { GuideList } from "@/components/guides/guide-list"
import { requireProfile } from "@/lib/auth"
import { listPublishedGuides } from "@/lib/knowledge/guides"
import { createClient } from "@/lib/supabase/server"

export default async function GuidesPage() {
  await requireProfile()
  const { data: guides, error } = await listPublishedGuides(await createClient())
  return (
    <GuideList
      guides={guides}
      failed={Boolean(error)}
      basePath="/app/guides"
      emptyDescription="Guides appear here once the university publishes them. You can still ask a question from New conversation."
    />
  )
}
