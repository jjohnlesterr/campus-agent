import { notFound } from "next/navigation"
import { z } from "zod"

import { GuideView } from "@/components/guides/guide-view"
import { getBranding } from "@/lib/branding"
import { getPublishedGuide } from "@/lib/knowledge/guides"
import { createPublicClient } from "@/lib/supabase/public"

// Drafts, archived and internal guides are a 404 here, never a sign-in prompt.
export default async function PublicGuidePage({ params }: PageProps<"/guides/[id]">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [{ data: guide, error }, { timezone }] = await Promise.all([
    getPublishedGuide(createPublicClient(), id, { publicOnly: true }),
    getBranding(),
  ])
  if (error) throw new Error("This guide could not be loaded.")
  if (!guide) notFound()
  return <GuideView guide={guide} timezone={timezone} backHref="/guides" />
}
