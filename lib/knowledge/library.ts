// Knowledge Library: one list of sources (uploaded files) and manual entries.
// Pure helpers shared by the library page and tests.

export const LIBRARY_TABS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
] as const

export type LibraryTab = (typeof LIBRARY_TABS)[number]["value"]

export function libraryTab(value: unknown): LibraryTab {
  return LIBRARY_TABS.some((tab) => tab.value === value) ? (value as LibraryTab) : "all"
}

export type SectionStatus = "draft" | "published" | "archived"

export type LibrarySource = {
  kind: "source"
  id: string
  title: string
  status: string
  mimeType: string
  documentType: string
  /** Admin-written description (metadata only, never used in answers). */
  description: string | null
  summary: string | null
  keyTopics: string[]
  updatedAt: string
  /** Card position in its collection (drag and drop); null until placed. */
  sortOrder: number | null
  counts: { total: number; published: number; draft: number; archived: number }
}

export type LibraryEntry = {
  kind: "manual"
  id: string
  title: string
  status: SectionStatus
  category: string | null
  description: string | null
  updatedAt: string
}

export type LibraryItem = LibrarySource | LibraryEntry

/** Section counts per source, and the newest change across a source and its sections. */
export function buildSources(
  documents: { id: string; title: string; status: string; mime_type: string; document_type: string; description: string | null; summary: string | null; key_topics: string[]; updated_at: string; sort_order?: number | null }[],
  sections: { source_document_id: string | null; status: SectionStatus; updated_at: string }[]
): LibrarySource[] {
  return documents.map((doc) => {
    const own = sections.filter((s) => s.source_document_id === doc.id)
    const count = (status: SectionStatus) => own.filter((s) => s.status === status).length
    const updatedAt = own.reduce((latest, s) => (s.updated_at > latest ? s.updated_at : latest), doc.updated_at)
    return {
      kind: "source",
      id: doc.id,
      title: doc.title,
      status: doc.status,
      mimeType: doc.mime_type,
      documentType: doc.document_type,
      description: doc.description,
      summary: doc.summary,
      keyTopics: doc.key_topics,
      updatedAt,
      sortOrder: doc.sort_order ?? null,
      counts: { total: own.length, published: count("published"), draft: count("draft"), archived: count("archived") },
    }
  })
}

export function matchesTab(item: LibraryItem, tab: LibraryTab) {
  const archived = item.status === "archived"
  if (tab === "archived") return archived
  if (archived) return false
  if (item.kind === "source") {
    if (tab === "published") return item.counts.published > 0
    if (tab === "draft") return item.counts.draft > 0
    return tab === "all"
  }
  if (tab === "all") return true
  return item.status === tab
}

export function matchesSearch(item: LibraryItem, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const fields = item.kind === "source" ? [item.title, item.description, item.summary, ...item.keyTopics] : [item.title, item.category, item.description]
  return fields.some((field) => field?.toLowerCase().includes(q))
}

/**
 * Sources in the admin's order (drag and drop; unplaced ones after, newest first), then
 * older manual entries, newest first.
 */
export function filterLibrary(items: LibraryItem[], tab: LibraryTab, query: string) {
  return orderLibrary(items.filter((item) => matchesTab(item, tab) && matchesSearch(item, query)))
}

export function orderLibrary(items: LibraryItem[]) {
  const position = (item: LibraryItem) => (item.kind === "source" ? item.sortOrder ?? Infinity : Infinity)
  return [...items].sort((a, b) =>
    Number(a.kind === "manual") - Number(b.kind === "manual") ||
    position(a) - position(b) ||
    b.updatedAt.localeCompare(a.updatedAt))
}
