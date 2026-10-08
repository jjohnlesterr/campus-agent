import { notFound } from "next/navigation"
import { z } from "zod"

import { GuideView } from "@/components/guides/guide-view"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { getPublishedGuide } from "@/lib/knowledge/guides"
import { createClient } from "@/lib/supabase/server"

export default async function StudentGuidePage({ params }: PageProps<"/app/guides/[id]">) {
  await requireProfile()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const db = await createClient()
  const [{ data: guide, error }, { timezone }] = await Promise.all([getPublishedGuide(db, id), getBranding()])
  if (error) throw new Error("This guide could not be loaded.")
  if (!guide) notFound()
  return <GuideView guide={guide} timezone={timezone} backHref="/app/guides" />
}
