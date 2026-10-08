// Knowledge Library collections: one organizational level above sources (never nested).
// Pure helpers shared by the library pages and tests. Collections only group sources for
// admins; Campus Agent retrieval ignores them.

import type { SectionStatus } from "@/lib/knowledge/library"

/** Route id of the system grouping for sources with no collection (not a database row). */
export const UNCATEGORIZED = "uncategorized"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A collection route id: a collection uuid, or "uncategorized". Anything else is invalid. */
export function parseCollectionId(value: unknown): string | null {
  if (value === UNCATEGORIZED) return UNCATEGORIZED
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null
}

export function collectionHref(collectionId: string | null | undefined) {
  return `/admin/knowledge/collections/${collectionId ?? UNCATEGORIZED}`
}

export type CollectionSummary = {
  /** Collection uuid, or UNCATEGORIZED. */
  id: string
  name: string
  description: string | null
  updatedAt: string
  /** Uploaded sources plus manual entries. */
  sources: number
  published: number
  drafts: number
  archived: number
}

type CollectionRow = { id: string; name: string; description: string | null; updated_at: string }
type SourceRow = { id: string; collection_id: string | null; updated_at: string }
type SectionRow = { source_document_id: string | null; collection_id: string | null; status: SectionStatus; updated_at: string }

/**
 * Lightweight per-collection counts from three flat row lists (no per-collection queries).
 * A manual entry is both a source and one section; a source's sections count toward its
 * source's collection. Uncategorized is appended only when something is in it.
 */
export function summarizeCollections(collections: CollectionRow[], sources: SourceRow[], sections: SectionRow[]): CollectionSummary[] {
  const sourceCollection = new Map(sources.map((s) => [s.id, s.collection_id ?? UNCATEGORIZED]))
  const summaries = new Map<string, CollectionSummary>()
  const summaryFor = (id: string) => {
    let summary = summaries.get(id)
    if (!summary) {
      summary = { id, name: "Uncategorized", description: "Sources that are not in a collection yet. Move them into a collection to keep the library organized.", updatedAt: "", sources: 0, published: 0, drafts: 0, archived: 0 }
      summaries.set(id, summary)
    }
    return summary
  }
  for (const c of collections) {
    summaries.set(c.id, { id: c.id, name: c.name, description: c.description, updatedAt: c.updated_at, sources: 0, published: 0, drafts: 0, archived: 0 })
  }
  const touch = (summary: CollectionSummary, at: string) => { if (at > summary.updatedAt) summary.updatedAt = at }

  for (const source of sources) {
    const summary = summaryFor(source.collection_id ?? UNCATEGORIZED)
    summary.sources++
    touch(summary, source.updated_at)
  }
  for (const section of sections) {
    let id: string
    if (section.source_document_id) {
      // Sections of sources outside the library (e.g. the campus map) are not listed.
      const owner = sourceCollection.get(section.source_document_id)
      if (!owner) continue
      id = owner
    } else {
      id = section.collection_id ?? UNCATEGORIZED
      summaryFor(id).sources++
    }
    const summary = summaryFor(id)
    if (section.status === "published") summary.published++
    else if (section.status === "draft") summary.drafts++
    else summary.archived++
    touch(summary, section.updated_at)
  }

  const named = [...summaries.values()].filter((s) => s.id !== UNCATEGORIZED).sort((a, b) => a.name.localeCompare(b.name))
  const uncategorized = summaries.get(UNCATEGORIZED)
  return uncategorized ? [...named, uncategorized] : named
}

export function filterCollections(collections: CollectionSummary[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return collections
  return collections.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
}

/** Message shown instead of deleting a collection that still has sources. */
export function nonEmptyCollectionMessage(sourceCount: number) {
  const one = sourceCount === 1
  return `This collection contains ${sourceCount} ${one ? "source" : "sources"}. Move ${one ? "it" : "them"} to another collection before deleting the collection.`
}
