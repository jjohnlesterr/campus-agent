import "server-only"

import { SOURCE_UPDATES } from "@/lib/knowledge/source-precedence"
import { pageLabel, readGuideReference } from "@/lib/knowledge/topics"
import { createClient } from "@/lib/supabase/server"
import type { DbClient } from "@/lib/supabase/types"

export type KnowledgePassage = {
  sectionId: string
  /** Source file title, or the entry title for a manual entry. */
  documentTitle: string
  /** First cited page (null for manual entries). */
  pageNumber: number | null
  sectionTitle: string | null
  content: string
  /** Full-text relevance (higher is better). Not comparable across queries. */
  rank: number
  /** e.g. "Student Handbook — Page 42", "Student Handbook — Pages 4, 5" */
  sourceLabel: string
  /** Original notice link (announcement passages only). */
  url?: string
}

/**
 * Read designated updates independently of full-text rank: a wordier older source
 * must not crowd them out of the search hits. Reads use the caller's client/RLS.
 * Only visible, non-archived sources and Published sections qualify. The model
 * checks direct relevance before using an update, not merely shared keywords.
 */
export async function designatedUpdatePassages(supabase?: DbClient): Promise<KnowledgePassage[]> {
  supabase ??= await createClient()
  const { data: sources, error: sourceError } = await supabase.from("documents")
    .select("id,title").in("id", SOURCE_UPDATES.map((s) => s.sourceId)).neq("status", "archived")
  if (sourceError) throw new Error(`Source update lookup failed: ${sourceError.message}`)
  if (!sources?.length) return []
  const titles = new Map(sources.map((s) => [s.id, s.title]))
  const passages: KnowledgePassage[] = []
  // Paginate rather than silently dropping a later section at the API row limit.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from("guidelines")
      .select("id,title,source_document_id,source_reference,content,description")
      .in("source_document_id", [...titles.keys()]).eq("status", "published")
      .order("id").range(offset, offset + 99)
    if (error) throw new Error(`Source update sections failed: ${error.message}`)
    for (const row of data ?? []) {
      const title = titles.get(row.source_document_id ?? "")
      if (!title) continue
      const pages = readGuideReference(row.source_reference)?.pages ?? []
      passages.push({
        sectionId: row.id,
        documentTitle: title,
        sectionTitle: row.title,
        pageNumber: pages[0] ?? null,
        sourceLabel: `${title} — ${pages.length ? pageLabel(pages) : row.title}`,
        content: row.content?.trim() || row.description?.trim() || "",
        rank: 0,
      })
    }
    if (!data || data.length < 100) return passages.filter((p) => p.content)
  }
}

/**
 * Finds the Published knowledge sections most relevant to a question using
 * PostgreSQL full-text search (search_knowledge). Draft and Archived sections,
 * and sections of archived sources, are never returned. Runs under the caller's
 * session, so RLS limits public visitors to public sections.
 */
export async function searchKnowledge(question: string, { limit = 5, supabase }: { limit?: number; supabase?: DbClient } = {}) {
  supabase ??= await createClient()
  const { data, error } = await supabase.rpc("search_knowledge", {
    query_text: question,
    match_count: limit,
  })
  if (error) throw new Error(`Knowledge search failed: ${error.message}`)

  return (data ?? []).map((row): KnowledgePassage => {
    // Generated types mark these non-null, but they can be null in the database.
    const sourceTitle = (row.source_title as string | null) ?? null
    const reference = (row.source_reference as string | null) ?? null
    if (!sourceTitle) {
      // Manual entry: cite the entry itself and the admin's reference note, if any.
      const note = readGuideReference(reference) ? null : reference?.trim()
      return {
        sectionId: row.section_id,
        documentTitle: row.title,
        pageNumber: null,
        sectionTitle: null,
        content: row.content,
        rank: row.rank,
        sourceLabel: note ? `${row.title} — ${note}` : row.title,
      }
    }
    const pages = readGuideReference(reference)?.pages ?? []
    return {
      sectionId: row.section_id,
      documentTitle: sourceTitle,
      pageNumber: pages[0] ?? null,
      sectionTitle: row.title,
      content: row.content,
      rank: row.rank,
      sourceLabel: pages.length ? `${sourceTitle} — ${pageLabel(pages)}` : sourceTitle,
    }
  })
}
