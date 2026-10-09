import "server-only"

import type { DbClient } from "@/lib/supabase/types"

// School Guides (/app/guides): the read-only, user-facing view of the Knowledge Library.
// Collections → sources (and manual entries) → Published sections. Only Published sections
// and Ready sources are ever returned: the explicit filters also hide drafts when an admin
// browses, and RLS enforces it again for everyone else. Admin-only fields (status, notes,
// analysis flags) are never selected.

/** Sources and entries that aren't in a collection are grouped under this id. */
export const OTHER_GUIDES = "other"

export type GuideCollection = { id: string; name: string; description: string | null; sources: number; sections: number }
export type GuideSource = { id: string; title: string; description: string | null; sections: number }
export type GuideEntry = { id: string; title: string; description: string | null }

type SectionRow = { id: string; title: string; description: string | null; source_document_id: string | null; collection_id: string | null }
type SourceRow = { id: string; title: string; description: string | null; collection_id: string | null; sort_order: number | null }

async function publishedKnowledge(db: DbClient) {
  const [sections, sources] = await Promise.all([
    db.from("guidelines").select("id, title, description, source_document_id, collection_id").eq("status", "published"),
    db.from("documents").select("id, title, description, collection_id, sort_order").eq("status", "ready").neq("document_type", "campus_map"),
  ])
  if (sections.error || sources.error) throw new Error("School guides could not be loaded.")
  return { sections: sections.data as SectionRow[], sources: sources.data as SourceRow[] }
}

const bySortOrder = (a: SourceRow, b: SourceRow) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.title.localeCompare(b.title)

/** Collections that have at least one Published section, with their counts. */
export async function listGuideCollections(db: DbClient): Promise<GuideCollection[]> {
  const [{ sections, sources }, { data: collections, error }] = await Promise.all([
    publishedKnowledge(db),
    db.from("knowledge_collections").select("id, name, description").order("name"),
  ])
  if (error) throw new Error("School guides could not be loaded.")
  const sourceCollection = new Map(sources.map((s) => [s.id, s.collection_id]))
  const groups = new Map<string, { sources: Set<string>; sections: number }>()
  for (const section of sections) {
    // A section from a source that isn't Ready is not shown.
    if (section.source_document_id && !sourceCollection.has(section.source_document_id)) continue
    const key = (section.source_document_id ? sourceCollection.get(section.source_document_id) : section.collection_id) ?? OTHER_GUIDES
    const group = groups.get(key) ?? { sources: new Set<string>(), sections: 0 }
    group.sources.add(section.source_document_id ?? section.id)
    group.sections++
    groups.set(key, group)
  }
  const list: GuideCollection[] = (collections ?? []).flatMap((c) => {
    const group = groups.get(c.id)
    return group ? [{ id: c.id, name: c.name, description: c.description, sources: group.sources.size, sections: group.sections }] : []
  })
  const other = groups.get(OTHER_GUIDES)
  if (other) list.push({ id: OTHER_GUIDES, name: "Other guides", description: "University guides not grouped in a collection.", sources: other.sources.size, sections: other.sections })
  return list
}

/** One collection: its sources with Published sections (in the admin's order), and manual entries. */
export async function getGuideCollection(db: DbClient, id: string) {
  const isOther = id === OTHER_GUIDES
  const [{ sections, sources }, collection] = await Promise.all([
    publishedKnowledge(db),
    isOther
      ? Promise.resolve({ data: { id, name: "Other guides", description: "University guides not grouped in a collection." }, error: null })
      : db.from("knowledge_collections").select("id, name, description").eq("id", id).maybeSingle(),
  ])
  if (collection.error) throw new Error("This guide could not be loaded.")
  if (!collection.data) return null
  const inCollection = (collectionId: string | null) => (isOther ? collectionId === null : collectionId === id)

  const counts = new Map<string, number>()
  for (const s of sections) if (s.source_document_id) counts.set(s.source_document_id, (counts.get(s.source_document_id) ?? 0) + 1)
  const guideSources: GuideSource[] = sources
    .filter((s) => inCollection(s.collection_id) && counts.has(s.id))
    .sort(bySortOrder)
    .map((s) => ({ id: s.id, title: s.title, description: s.description, sections: counts.get(s.id)! }))
  const entries: GuideEntry[] = sections
    .filter((s) => !s.source_document_id && inCollection(s.collection_id))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((s) => ({ id: s.id, title: s.title, description: s.description }))

  return { collection: collection.data, sources: guideSources, entries }
}

/** One source and its Published sections, in the order the admin arranged them. */
export async function getGuideSource(db: DbClient, id: string) {
  const [{ data: source, error }, { data: sections, error: sectionsError }] = await Promise.all([
    db.from("documents").select("id, title, description, collection_id, knowledge_collections(id, name)").eq("id", id).eq("status", "ready").neq("document_type", "campus_map").maybeSingle(),
    db.from("guidelines")
      .select("id, title, content, requirements, source_reference, sort_order, source_order, offices(name), guideline_steps(step_number, title, description)")
      .eq("source_document_id", id)
      .eq("status", "published"),
  ])
  if (error || sectionsError) throw new Error("This guide could not be loaded.")
  if (!source) return null
  const ordered = [...(sections ?? [])].sort((a, b) =>
    (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || (a.source_order ?? Infinity) - (b.source_order ?? Infinity) || a.title.localeCompare(b.title))
  return { source, sections: ordered }
}

export type GuideSourceDetail = NonNullable<Awaited<ReturnType<typeof getGuideSource>>>
