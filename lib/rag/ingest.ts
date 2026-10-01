import "server-only"

import { chunkPages } from "@/lib/rag/chunk"
import { embedTexts, embeddingsAvailable, toVectorLiteral } from "@/lib/rag/embeddings"
import { NoSelectableTextError, extractPdfPages, looksLikePdf } from "@/lib/rag/extract"
import { createClient } from "@/lib/supabase/server"

export type IngestResult =
  | { ok: true; pages: number; chunks: number; embedded: number }
  | { ok: false; error: string }

const INSERT_BATCH = 100

/**
 * Downloads a document's PDF from Storage, extracts its text, replaces its
 * chunks, and embeds them when an embeddings provider is configured.
 * Runs under the admin's session (RLS allows admins to write documents/chunks).
 *
 * Status: processing → ready (text chunks saved and searchable) | failed (with
 * processing_error). Embeddings are only generated when a provider is configured.
 */
export async function ingestDocument(documentId: string): Promise<IngestResult> {
  const supabase = await createClient()
  const fail = async (error: string): Promise<IngestResult> => {
    const { error: statusError } = await supabase
      .from("documents")
      .update({ status: "failed", processing_error: error })
      .eq("id", documentId)
    return { ok: false, error: statusError ? `${error} The failed status could not be saved.` : error }
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, file_path")
    .eq("id", documentId)
    .single()
  if (!doc) return { ok: false, error: "Document not found." }

  const { data: processing, error: processingError } = await supabase
    .from("documents")
    .update({ status: "processing", processing_error: null })
    .eq("id", documentId)
    .select("id")
    .single()
  if (processingError || !processing) return fail("The source could not be marked as processing.")

  const { data: file, error: downloadError } = await supabase.storage
    .from("documents")
    .download(doc.file_path)
  if (downloadError || !file) return fail("The uploaded file could not be read from storage.")

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!looksLikePdf(bytes)) return fail("This file is not a valid PDF.")

  let pages: string[]
  try {
    pages = await extractPdfPages(bytes)
  } catch (error) {
    return fail(
      error instanceof NoSelectableTextError ? error.message : "The PDF could not be read. It may be damaged or password-protected."
    )
  }

  const chunks = chunkPages(pages)
  if (chunks.length === 0) return fail(new NoSelectableTextError().message)

  let embeddings: number[][] | null = null
  if (embeddingsAvailable()) {
    try {
      embeddings = await embedTexts(chunks.map((c) => c.content))
    } catch {
      embeddings = null // keep the text; embeddings can be generated later
    }
  }

  // Replace any previous chunks for this document (reprocessing).
  const { error: deleteError } = await supabase.from("document_chunks").delete().eq("document_id", documentId)
  if (deleteError) return fail("Previous text chunks could not be replaced.")

  const rows = chunks.map((c, i) => ({
    document_id: documentId,
    chunk_index: c.chunkIndex,
    page_number: c.pageNumber,
    section_title: c.sectionTitle,
    content: c.content,
    embedding: embeddings ? toVectorLiteral(embeddings[i]) : null,
    metadata: { source_title: doc.title, page_count: pages.length, token_estimate: c.tokenCount },
  }))
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + INSERT_BATCH))
    if (error) return fail("The extracted text could not be saved.")
  }

  // Ready = searchable. The MVP uses full-text search over chunk text, so a
  // document is ready once its chunks are saved; embeddings are optional.
  const embedded = embeddings ? rows.length : 0
  const { data: ready, error: readyError } = await supabase.from("documents").update({ status: "ready", processing_error: null }).eq("id", documentId).select("id").single()
  if (readyError || !ready) return fail("The text was saved, but the source could not be marked Ready. Please reprocess it.")

  return { ok: true, pages: pages.length, chunks: rows.length, embedded }
}
