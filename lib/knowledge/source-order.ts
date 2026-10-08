import "server-only"

import type { createClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createClient>>

/** The card position after the last source in a collection (null: Uncategorized). */
export async function nextSourcePosition(db: Client, collectionId: string | null) {
  const query = db.from("documents").select("sort_order").neq("document_type", "campus_map")
  const { data } = await (collectionId ? query.eq("collection_id", collectionId) : query.is("collection_id", null))
  const rows = Array.isArray(data) ? data : []
  return Math.max(rows.length, ...rows.map((row) => row.sort_order ?? 0)) + 1
}
