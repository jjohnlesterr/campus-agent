import "server-only"

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
