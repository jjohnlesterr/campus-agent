"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { ingestDocument } from "@/lib/rag/ingest"
import { MAX_SOURCE_BYTES, acceptedMimeTypes, detectMimeType, isReferenceOnly } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

const SOURCE_TYPES = ["handbook", "policy", "announcement", "calendar", "campus_map", "other"] as const
const uploadPathSchema = z.string().regex(/^sources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/, "Invalid upload path.")

const registerSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  sourceType: z.enum(SOURCE_TYPES),
  visibility: z.enum(["public", "authenticated"]),
  filePath: uploadPathSchema,
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_SOURCE_BYTES, "Files can be up to 25 MB."),
})

export type RegisterResult =
  | { ok: true; id: string; referenceOnly: true }
  | { ok: true; id: string; referenceOnly: false; pages: number; chunks: number }
  | { ok: false; error: string; id?: string }

/** Recover an abandoned upload, but never remove a file referenced by a source. */
export async function discardUnregisteredSource(filePath: string) {
  await requireAdmin()
  if (!uploadPathSchema.safeParse(filePath).success) return false
  const supabase = await createClient()
  const { data, error } = await supabase.from("documents").select("id").eq("file_path", filePath).maybeSingle()
  if (error || data) return false
  const { error: removalError } = await supabase.storage.from("documents").remove([filePath])
  return !removalError
}

function revalidate() {
  revalidatePath("/admin/documents")
  revalidatePath("/admin")
  revalidatePath("/admin/locations") // shows the newest Campus Map source
  revalidatePath("/admin/knowledge")
}

/**
 * Called after the browser uploads the file to the private `documents` bucket.
 * Verifies the real file type, creates the source record, and — for text
 * sources — extracts and chunks the PDF for the assistant. Images are
 * stored as reference files only.
 */
export async function registerSource(input: z.input<typeof registerSchema>): Promise<RegisterResult> {
  await requireAdmin()
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload." }
  const { title, sourceType, visibility, filePath, fileName, fileSize } = parsed.data

  const supabase = await createClient()
  const { data: existing, error: lookupError } = await supabase.from("documents").select("id").eq("file_path", filePath).maybeSingle()
  if (lookupError) return { ok: false, error: "The source could not be checked. Please try again." }
  if (existing) return { ok: false, id: existing.id, error: "This upload already has a source record. Check the Sources list before retrying." }
  const discard = async (error: string): Promise<RegisterResult> => {
    const removed = await discardUnregisteredSource(filePath)
    return { ok: false, error: removed ? error : `${error} The file may still be in storage; ask an administrator to check abandoned uploads.` }
  }

  // Check the file's actual bytes, not its name or the browser-reported type.
  const { data: file, error: downloadError } = await supabase.storage.from("documents").download(filePath)
  if (downloadError || !file) return discard(`The uploaded file could not be read: ${downloadError?.message ?? "File not found"}.`)
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES || file.size !== fileSize) {
    return discard("The stored file size is invalid or does not match the selected file. Choose a non-empty file up to 25 MB.")
  }
  const mimeType = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!mimeType || !acceptedMimeTypes().includes(mimeType)) {
    return discard("Choose a valid PDF, PNG or JPG/JPEG image.")
  }

  const referenceOnly = isReferenceOnly(sourceType, mimeType)
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title,
      visibility,
      document_type: sourceType,
      file_path: filePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size: file.size,
      // Reference files are ready as soon as they're stored; text sources are processed next.
      status: referenceOnly ? "ready" : "uploaded",
    })
    .select("id")
    .single()
  if (error || !doc) return discard(`The source record could not be saved: ${error?.message ?? "No record was returned"}.`)

  if (referenceOnly) {
    revalidate()
    return { ok: true, id: doc.id, referenceOnly: true }
  }

  let result
  try {
    result = await ingestDocument(doc.id)
  } catch {
    const message = "PDF processing was interrupted. The source was saved; open it from the Sources list and choose Reprocess."
    const { error: statusError } = await supabase.from("documents").update({ status: "failed", processing_error: message }).eq("id", doc.id)
    revalidate()
    return { ok: false, id: doc.id, error: statusError ? `${message} Its processing status could not be updated.` : message }
  }
  revalidate()
  if (!result.ok) return { ok: false, id: doc.id, error: `${result.error} The source was saved; open it from the Sources list to reprocess or remove it.` }
  return { ok: true, id: doc.id, referenceOnly: false, pages: result.pages, chunks: result.chunks }
}

/** Re-extracts a text source (replaces its chunks). Reference files are skipped. */
export async function reprocessDocument(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data: doc } = await supabase.from("documents").select("document_type, mime_type").eq("id", id).single()
  if (doc && !isReferenceOnly(doc.document_type, doc.mime_type) && doc.mime_type === "application/pdf") {
    await ingestDocument(id)
  }
  revalidate()
  revalidatePath(`/admin/documents/${id}`)
}

export async function deleteDocument(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data: doc } = await supabase.from("documents").select("file_path").eq("id", id).single()
  // Remove the record first: if that fails, the file stays and nothing is left broken.
  const { error } = await supabase.from("documents").delete().eq("id", id) // chunks cascade; guides keep a null source
  if (!error && doc) await supabase.storage.from("documents").remove([doc.file_path])
  revalidate()
  redirect("/admin/documents")
}
