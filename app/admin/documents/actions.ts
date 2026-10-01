"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { ingestDocument } from "@/lib/rag/ingest"
import { MAX_SOURCE_BYTES, acceptedMimeTypes, detectMimeType, isReferenceOnly } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

const SOURCE_TYPES = ["handbook", "policy", "announcement", "calendar", "campus_map", "other"] as const

const registerSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  sourceType: z.enum(SOURCE_TYPES),
  visibility: z.enum(["public", "authenticated"]),
  filePath: z.string().regex(/^sources\/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/, "Invalid upload path."),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_SOURCE_BYTES, "Files can be up to 25 MB."),
})

export type RegisterResult =
  | { ok: true; id: string; referenceOnly: true }
  | { ok: true; id: string; referenceOnly: false; pages: number; chunks: number }
  | { ok: false; error: string }

function revalidate() {
  revalidatePath("/admin/documents")
  revalidatePath("/admin")
}

/**
 * Called after the browser uploads the file to the private `documents` bucket.
 * Verifies the real file type, creates the source record, and — for text
 * sources — extracts and chunks the PDF for the assistant. Campus maps are
 * stored as reference files only.
 */
export async function registerSource(input: z.input<typeof registerSchema>): Promise<RegisterResult> {
  await requireAdmin()
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload." }
  const { title, sourceType, visibility, filePath, fileName, fileSize } = parsed.data

  const supabase = await createClient()
  const discard = async (error: string): Promise<RegisterResult> => {
    await supabase.storage.from("documents").remove([filePath])
    return { ok: false, error }
  }

  // Check the file's actual bytes, not its name or the browser-reported type.
  const { data: file } = await supabase.storage.from("documents").download(filePath)
  if (!file) return discard("The uploaded file could not be read. Please try again.")
  const mimeType = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!mimeType || !acceptedMimeTypes(sourceType).includes(mimeType)) {
    return discard(
      isReferenceOnly(sourceType)
        ? "Campus maps must be a PDF, PNG, JPEG or WebP file."
        : "This source type needs a PDF with selectable text."
    )
  }

  const referenceOnly = isReferenceOnly(sourceType)
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title,
      visibility,
      document_type: sourceType,
      file_path: filePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size: fileSize,
      // Reference files are ready as soon as they're stored; text sources are processed next.
      status: referenceOnly ? "ready" : "uploaded",
    })
    .select("id")
    .single()
  if (error || !doc) return discard("The source could not be saved. Please try again.")

  if (referenceOnly) {
    revalidate()
    return { ok: true, id: doc.id, referenceOnly: true }
  }

  const result = await ingestDocument(doc.id)
  revalidate()
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, id: doc.id, referenceOnly: false, pages: result.pages, chunks: result.chunks }
}

/** Re-extracts a text source (replaces its chunks). Reference files are skipped. */
export async function reprocessDocument(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data: doc } = await supabase.from("documents").select("document_type, mime_type").eq("id", id).single()
  if (doc && !isReferenceOnly(doc.document_type) && doc.mime_type === "application/pdf") {
    await ingestDocument(id)
  }
  revalidate()
  revalidatePath(`/admin/documents/${id}`)
}

export async function deleteDocument(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data: doc } = await supabase.from("documents").select("file_path").eq("id", id).single()
  if (doc) await supabase.storage.from("documents").remove([doc.file_path])
  await supabase.from("documents").delete().eq("id", id) // chunks cascade
  revalidate()
  redirect("/admin/documents")
}
