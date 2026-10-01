import "server-only"

import { formatSourceLabel } from "@/lib/rag/sources"
import { createClient } from "@/lib/supabase/server"
import type { DbClient } from "@/lib/supabase/types"

export type HandbookPassage = {
  chunkId: string
  documentId: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
  content: string
  /** Full-text relevance (higher is better). Not comparable across queries. */
  rank: number
  /** e.g. "Student Handbook — Page 42" */
  sourceLabel: string
}

/**
 * Finds the handbook sections most relevant to a question using PostgreSQL
 * full-text search (search_document_chunks). Runs under the caller's session,
 * so RLS limits public visitors to public documents. Only `ready` documents
 * are searched.
 */
export async function searchHandbook(question: string, { limit = 5, supabase }: { limit?: number; supabase?: DbClient } = {}) {
  supabase ??= await createClient()
  const { data, error } = await supabase.rpc("search_document_chunks", {
    query_text: question,
    match_count: limit,
  })
  if (error) throw new Error(`Handbook search failed: ${error.message}`)

  return (data ?? []).map((row): HandbookPassage => {
    // Generated types mark these non-null, but they can be null in the database.
    const pageNumber = (row.page_number as number | null) ?? null
    return {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      pageNumber,
      sectionTitle: (row.section_title as string | null) ?? null,
      content: row.content,
      rank: row.rank,
      sourceLabel: formatSourceLabel({ documentTitle: row.document_title, pageNumber }),
    }
  })
}
