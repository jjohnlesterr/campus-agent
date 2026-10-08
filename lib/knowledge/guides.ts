import type { DbClient } from "@/lib/supabase/types"

// Read-only guide queries shared by the signed-in Guides section (/app/guides) and
// the public one (/guides). Only Published guides are ever returned: the explicit
// status filter also hides drafts when an admin browses, and RLS enforces it again.
// `publicOnly` adds the public-visibility filter for signed-out visitors (the anon
// RLS policy requires it too).

type Scope = { publicOnly?: boolean }

export async function listPublishedGuides(db: DbClient, { publicOnly = false }: Scope = {}) {
  let query = db.from("guidelines").select("id, title, description, source_reference, documents(title)").eq("status", "published")
  if (publicOnly) query = query.eq("visibility", "public")
  return query.order("title")
}

export async function getPublishedGuide(db: DbClient, id: string, { publicOnly = false }: Scope = {}) {
  let query = db
    .from("guidelines")
    .select("title, description, content, requirements, source_reference, updated_at, documents(title), offices(name), guideline_steps(step_number, title, description)")
    .eq("id", id)
    .eq("status", "published")
  if (publicOnly) query = query.eq("visibility", "public")
  return query.maybeSingle()
}

export type GuideSummary = NonNullable<Awaited<ReturnType<typeof listPublishedGuides>>["data"]>[number]
export type GuideDetail = NonNullable<Awaited<ReturnType<typeof getPublishedGuide>>["data"]>
