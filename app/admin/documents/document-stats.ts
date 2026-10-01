import "server-only"

import { createClient } from "@/lib/supabase/server"

export type DocumentStats = { chunks: number; embedded: number; pages: number | null }

/** Chunk, embedding and page counts for one document. */
export async function getDocumentStats(documentId: string): Promise<DocumentStats> {
  const supabase = await createClient()
  const [total, embedded, sample] = await Promise.all([
    supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", documentId),
    supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId)
      .not("embedding", "is", null),
    supabase.from("document_chunks").select("metadata").eq("document_id", documentId).limit(1).maybeSingle(),
  ])
  const meta = sample.data?.metadata as { page_count?: number } | null | undefined
  return { chunks: total.count ?? 0, embedded: embedded.count ?? 0, pages: meta?.page_count ?? null }
}

/** Plain-language processing status for the admin list. */
export function describeStatus(status: string) {
  if (status === "failed") return { label: "Failed", tone: "cancelled" as const }
  if (status === "ready") return { label: "Ready", tone: "published" as const }
  if (status === "archived") return { label: "Archived", tone: "archived" as const }
  return { label: "Processing", tone: "draft" as const }
}
