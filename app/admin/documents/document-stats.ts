import "server-only"

import { createClient } from "@/lib/supabase/server"

export type DocumentStats = { chunks: number; pages: number | null }

/** Chunk and page counts for one source (text sources only). */
export async function getDocumentStats(documentId: string): Promise<DocumentStats> {
  const supabase = await createClient()
  const [total, sample] = await Promise.all([
    supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", documentId),
    supabase.from("document_chunks").select("metadata").eq("document_id", documentId).limit(1).maybeSingle(),
  ])
  const meta = sample.data?.metadata as { page_count?: number } | null | undefined
  return { chunks: total.count ?? 0, pages: meta?.page_count ?? null }
}

/** Uploaded · Processing · Ready · Failed */
export function describeStatus(status: string) {
  switch (status) {
    case "ready":
      return { label: "Ready", tone: "published" as const }
    case "failed":
      return { label: "Failed", tone: "cancelled" as const }
    case "processing":
      return { label: "Processing", tone: "draft" as const }
    case "archived":
      return { label: "Archived", tone: "archived" as const }
    default:
      return { label: "Uploaded", tone: "draft" as const }
  }
}
