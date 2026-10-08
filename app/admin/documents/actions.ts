"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { type AnalysisResult, analyzeSource } from "@/lib/knowledge/analyze"
import { MAX_SOURCE_BYTES, PDF, acceptedMimeTypes, detectMimeType, isReferenceOnly } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// Knowledge Library source types. The campus map is not one: it lives in Admin › Campus Map.
const SOURCE_TYPES = ["handbook", "policy", "announcement", "calendar", "other"] as const
const uploadPathSchema = z.string().regex(/^sources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/, "Invalid upload path.")

const fileSchema = z.object({
  filePath: uploadPathSchema,
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_SOURCE_BYTES, "Files can be up to 25 MB."),
})

const registerSchema = fileSchema.extend({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  sourceType: z.enum(SOURCE_TYPES),
  visibility: z.enum(["public", "authenticated"]),
  // The Knowledge Library collection it was uploaded into (null: Uncategorized).
  collectionId: z.uuid().nullable().default(null),
})

export type RegisterResult =
  | { ok: true; id: string; referenceOnly: boolean }
  | { ok: false; error: string; id?: string }

export type SourceActionResult = { ok: true } | { ok: false; error: string }

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

function revalidate(id?: string) {
  revalidatePath("/admin/knowledge")
  revalidatePath("/admin/knowledge/collections/[id]", "page")
  revalidatePath("/admin")
  revalidatePath("/admin/campus-map") // shows the newest Campus Map source
  revalidatePath("/app/map")
  revalidatePath("/app/guides")
  if (id) revalidatePath(`/admin/documents/${id}`)
}

/** Reads the uploaded file's real type from its bytes (never the name or browser type). */
async function verifyUpload(supabase: Awaited<ReturnType<typeof createClient>>, filePath: string, fileSize: number) {
  const { data: file, error } = await supabase.storage.from("documents").download(filePath)
  if (error || !file) return { ok: false as const, error: `The uploaded file could not be read: ${error?.message ?? "File not found"}.` }
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES || file.size !== fileSize) {
    return { ok: false as const, error: "The stored file size is invalid or does not match the selected file. Choose a non-empty file up to 25 MB." }
  }
  const mimeType = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!mimeType || !acceptedMimeTypes().includes(mimeType)) return { ok: false as const, error: "Choose a valid PDF, PNG or JPG/JPEG image." }
  return { ok: true as const, mimeType, size: file.size }
}

/**
 * Called after the browser uploads the file to the private `documents` bucket.
 * Verifies the real file type and creates the source record. PDFs stay Uploaded
 * until an admin chooses Analyze with AI; images are Ready reference files.
 */
export async function registerSource(input: z.input<typeof registerSchema>): Promise<RegisterResult> {
  await requireAdmin()
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload." }
  const { title, sourceType, visibility, collectionId, filePath, fileName, fileSize } = parsed.data

  const supabase = await createClient()
  const { data: existing, error: lookupError } = await supabase.from("documents").select("id").eq("file_path", filePath).maybeSingle()
  if (lookupError) return { ok: false, error: "The source could not be checked. Please try again." }
  if (existing) return { ok: false, id: existing.id, error: "This upload already has a source record. Check the Knowledge Library before retrying." }
  const discard = async (error: string): Promise<RegisterResult> => {
    const removed = await discardUnregisteredSource(filePath)
    return { ok: false, error: removed ? error : `${error} The file may still be in storage; ask an administrator to check abandoned uploads.` }
  }

  const verified = await verifyUpload(supabase, filePath, fileSize)
  if (!verified.ok) return discard(verified.error)

  const referenceOnly = isReferenceOnly(sourceType, verified.mimeType)
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title,
      visibility,
      collection_id: collectionId,
      document_type: sourceType,
      file_path: filePath,
      file_name: fileName,
      mime_type: verified.mimeType,
      file_size: verified.size,
      // Images and campus maps are reference files, Ready to view right away. Other PDFs wait for Analyze with AI.
      status: referenceOnly ? "ready" : "uploaded",
    })
    .select("id")
    .single()
  if (error || !doc) return discard(`The source record could not be saved: ${error?.message ?? "No record was returned"}.`)

  revalidate()
  return { ok: true, id: doc.id, referenceOnly }
}

/**
 * Analyze with AI: extracts the PDF, adds new topics as Draft sections and an
 * admin-only overview. Never publishes and never changes existing sections.
 */
export async function analyzeDocument(id: string): Promise<AnalysisResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid source." }
  const supabase = await createClient()
  let result: AnalysisResult
  try {
    result = await analyzeSource(supabase, id)
  } catch {
    const message = "Analysis was interrupted. Existing sections were not changed; try again."
    await supabase.from("documents").update({ status: "failed", processing_error: message }).eq("id", id).eq("status", "processing")
    result = { ok: false, error: message }
  }
  revalidate(id)
  return result
}

/**
 * Replaces a source's file. Existing sections and their Published content stay as
 * they are; a replaced PDF returns to Uploaded until it is analyzed again.
 */
export async function replaceSourceFile(id: string, input: z.input<typeof fileSchema>): Promise<SourceActionResult> {
  await requireAdmin()
  const parsed = fileSchema.safeParse(input)
  if (!z.uuid().safeParse(id).success || !parsed.success) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid upload." }
  const { filePath, fileName, fileSize } = parsed.data
  const supabase = await createClient()
  const { data: doc, error: docError } = await supabase.from("documents").select("file_path, mime_type, document_type, status").eq("id", id).single()
  if (docError || !doc) return { ok: false, error: "The source could not be loaded." }
  const discard = async (error: string): Promise<SourceActionResult> => {
    await discardUnregisteredSource(filePath)
    return { ok: false, error }
  }
  if (doc.status === "processing") return discard("This source is being analyzed. Try again when analysis finishes.")
  if (doc.status === "archived") return discard("Restore this source before replacing its file.")

  const verified = await verifyUpload(supabase, filePath, fileSize)
  if (!verified.ok) return discard(verified.error)
  if ((verified.mimeType === PDF) !== (doc.mime_type === PDF)) {
    return discard(doc.mime_type === PDF ? "Replace a PDF source with another PDF." : "Replace an image source with another image.")
  }

  const { error } = await supabase.from("documents").update({
    file_path: filePath,
    file_name: fileName,
    mime_type: verified.mimeType,
    file_size: verified.size,
    status: isReferenceOnly(doc.document_type, verified.mimeType) ? "ready" : "uploaded",
    processing_error: null,
  }).eq("id", id)
  if (error) return discard("The source could not be updated. The previous file is unchanged.")

  await supabase.storage.from("documents").remove([doc.file_path])
  revalidate(id)
  return { ok: true }
}

/**
 * Archives a source and its sections, so none of them are used by Campus Agent
 * or shown to students. Section content is kept.
 */
export async function archiveDocument(id: string): Promise<SourceActionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid source." }
  const supabase = await createClient()
  const { error: sectionError } = await supabase.from("guidelines").update({ status: "archived" }).eq("source_document_id", id).neq("status", "archived")
  if (sectionError) return { ok: false, error: "The sections could not be archived. Nothing was changed." }
  const { error } = await supabase.from("documents").update({ status: "archived" }).eq("id", id)
  revalidate(id)
  return error ? { ok: false, error: "The sections were archived, but the source could not be. Try again." } : { ok: true }
}

/** Restores an archived source. Its sections stay Archived until an admin restores them. */
export async function restoreDocument(id: string): Promise<SourceActionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid source." }
  const supabase = await createClient()
  const [{ data: doc }, { count }] = await Promise.all([
    supabase.from("documents").select("document_type, mime_type").eq("id", id).single(),
    supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", id),
  ])
  if (!doc) return { ok: false, error: "The source could not be loaded." }
  const ready = isReferenceOnly(doc.document_type, doc.mime_type) || (count ?? 0) > 0
  const { error } = await supabase.from("documents").update({ status: ready ? "ready" : "uploaded" }).eq("id", id).eq("status", "archived")
  revalidate(id)
  return error ? { ok: false, error: "The source could not be restored." } : { ok: true }
}

/**
 * Deletes a source only when none of its sections are Published. Its Draft and
 * Archived sections are deleted with it.
 */
export async function deleteDocument(id: string): Promise<SourceActionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid source." }
  const supabase = await createClient()
  const [{ data: doc }, { count, error: countError }] = await Promise.all([
    supabase.from("documents").select("file_path").eq("id", id).single(),
    supabase.from("guidelines").select("id", { count: "exact", head: true }).eq("source_document_id", id).eq("status", "published"),
  ])
  if (!doc || countError) return { ok: false, error: "The source could not be checked. Nothing was deleted." }
  if ((count ?? 0) > 0) return { ok: false, error: "Unpublish or archive this source's Published sections before deleting it." }
  const { error: sectionError } = await supabase.from("guidelines").delete().eq("source_document_id", id).neq("status", "published")
  if (sectionError) return { ok: false, error: "The source's sections could not be deleted. Nothing else was changed." }
  // Remove the record first: if that fails, the file stays and nothing is left broken.
  const { error } = await supabase.from("documents").delete().eq("id", id) // extracted text cascades
  if (error) return { ok: false, error: "The source could not be deleted." }
  await supabase.storage.from("documents").remove([doc.file_path])
  revalidate()
  redirect("/admin/knowledge")
}
