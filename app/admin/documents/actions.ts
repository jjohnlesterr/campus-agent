"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { type AnalysisResult, analyzeSource } from "@/lib/knowledge/analyze"
import { nextSourcePosition } from "@/lib/knowledge/source-order"
import { IMAGE_TYPES, MAX_SOURCE_BYTES, MAX_TEXT_SOURCE_CHARS, PDF, TEXT, UPLOAD_SOURCE_TYPES, type UploadSourceType, acceptedMimeTypes, collectionSourceType, detectMimeType, isReferenceOnly } from "@/lib/sources"
import { createClient } from "@/lib/supabase/server"

// New sources (and the sections created from them) are usable by everyone: the public
// assistant and signed-in users. The column and its RLS stay; existing sources keep theirs.
const NEW_SOURCE_VISIBILITY = "public"
const uploadPathSchema =z.string().regex(/^sources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/, "Invalid upload path.")

const fileSchema = z.object({
  filePath: uploadPathSchema,
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_SOURCE_BYTES, "Files can be up to 25 MB."),
})

const registerSchema = fileSchema.extend({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  // Admin metadata shown on cards and the source page; never used to answer students.
  description: z.string().trim().max(1000, "Keep the description under 1,000 characters.").default(""),
  // Knowledge Library source types (the campus map lives in Admin › Campus Map). Optional:
  // a collection whose name implies a type (e.g. Student Handbook) sets it instead.
  sourceType: z.enum(UPLOAD_SOURCE_TYPES).optional(),
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

/**
 * Reads the uploaded file's real type from its bytes (never the name or browser type).
 * New uploads are PDF only; `accepted` lets an older image source be replaced by an image.
 */
async function verifyUpload(supabase: Awaited<ReturnType<typeof createClient>>, filePath: string, fileSize: number, accepted: readonly string[] = acceptedMimeTypes()) {
  const { data: file, error } = await supabase.storage.from("documents").download(filePath)
  if (error || !file) return { ok: false as const, error: `The uploaded file could not be read: ${error?.message ?? "File not found"}.` }
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES || file.size !== fileSize) {
    return { ok: false as const, error: "The stored file size is invalid or does not match the selected file. Choose a non-empty file up to 25 MB." }
  }
  const mimeType = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!mimeType || !accepted.includes(mimeType)) {
    return { ok: false as const, error: accepted.includes(PDF) ? "Only PDF files are supported." : "Replace an image source with another PNG, JPG/JPEG or WebP image." }
  }
  return { ok: true as const, mimeType, size: file.size }
}

/**
 * Called after the browser uploads the file to the private `documents` bucket.
 * Verifies the file is a real PDF and creates the source record. It stays Uploaded
 * until an admin chooses Analyze with AI.
 */
export async function registerSource(input: z.input<typeof registerSchema>): Promise<RegisterResult> {
  await requireAdmin()
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload." }
  const { title, description, collectionId, filePath, fileName, fileSize } = parsed.data

  const supabase = await createClient()
  let collectionType: UploadSourceType | null = null
  if (collectionId) {
    const { data: collection, error: collectionError } = await supabase.from("knowledge_collections").select("name").eq("id", collectionId).maybeSingle()
    if (collectionError || !collection) return { ok: false, error: "The collection could not be found. Refresh the page and try again." }
    collectionType = collectionSourceType(collection.name)
  }
  const sourceType = collectionType ?? parsed.data.sourceType
  if (!sourceType) return { ok: false, error: "Choose a source type." }

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
      description: description || null,
      visibility: NEW_SOURCE_VISIBILITY,
      collection_id: collectionId,
      // A new source goes to the end of its collection.
      sort_order: await nextSourcePosition(supabase, collectionId),
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

const textSourceSchema = z.object({
  title: z.string().trim().min(2, "Enter a title (at least 2 characters).").max(200, "Use 200 characters or fewer for the title."),
  description: z.string().trim().max(1000, "Keep the description under 1,000 characters."),
  content: z.string().trim().min(10, "Add the verified text (at least 10 characters).").max(MAX_TEXT_SOURCE_CHARS, "Keep the text under 200,000 characters."),
  referenceLabel: z.string().trim().max(300, "Use 300 characters or fewer for the reference."),
  sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Enter a full link starting with https://." }).max(2000)]),
  // Knowledge Library collection it is created in ("" = Uncategorized).
  collectionId: z.union([z.uuid(), z.literal("")]),
  // Save as Draft, or save and Organize with AI right away.
  intent: z.enum(["draft", "organize"]),
})
export type TextSourceState = { error?: string; values?: Record<string, string> }

/**
 * Create text source: verified text written or pasted by an admin, saved as a source in
 * the collection. The text is stored unchanged as a plain-text file (the source of truth),
 * so it is analyzed like a PDF: Organize with AI creates Draft sections for review.
 * Nothing is published.
 */
export async function createTextSource(_previous: TextSourceState, formData: FormData): Promise<TextSourceState> {
  await requireAdmin()
  const raw = Object.fromEntries(["title", "description", "content", "referenceLabel", "sourceUrl", "collectionId", "intent"].map((key) => [key, String(formData.get(key) ?? "")]))
  const parsed = textSourceSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the source fields.", values: raw }
  const { title, description, content, referenceLabel, sourceUrl, collectionId, intent } = parsed.data

  const supabase = await createClient()
  let documentType: UploadSourceType = "other"
  if (collectionId) {
    const { data: collection, error } = await supabase.from("knowledge_collections").select("name").eq("id", collectionId).maybeSingle()
    if (error || !collection) return { error: "The collection could not be found. Go back to the Knowledge Library and try again.", values: raw }
    documentType = collectionSourceType(collection.name) ?? "other"
  }

  const file = new Blob([content], { type: TEXT })
  const filePath = `sources/${randomUUID()}.txt`
  const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, { contentType: TEXT, upsert: false })
  if (uploadError) return { error: "The text could not be saved. Please try again.", values: raw }

  const { data: doc, error } = await supabase.from("documents").insert({
    title,
    description: description || null,
    visibility: NEW_SOURCE_VISIBILITY,
    collection_id: collectionId || null,
    sort_order: await nextSourcePosition(supabase, collectionId || null),
    document_type: documentType,
    file_path: filePath,
    file_name: `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "text-source"}.txt`,
    mime_type: TEXT,
    file_size: file.size,
    reference_label: referenceLabel || null,
    source_url: sourceUrl || null,
    status: "uploaded",
  }).select("id").single()
  if (error || !doc) {
    await supabase.storage.from("documents").remove([filePath])
    return { error: "The source could not be saved. Please try again.", values: raw }
  }

  // Organize with AI now; any problem is shown on the source page, where it can be retried.
  if (intent === "organize") await analyzeDocument(doc.id)
  revalidate(doc.id)
  redirect(`/admin/documents/${doc.id}`)
}

/**
 * Analyze with AI: extracts the PDF or text source, adds new topics as Draft sections
 * and an admin-only overview. Never publishes and never changes existing sections.
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
  if (doc.mime_type === TEXT) return discard("A text source has no uploaded file to replace.")

  // A PDF is replaced by a PDF; an older image source keeps accepting images.
  const verified = await verifyUpload(supabase, filePath, fileSize, doc.mime_type === PDF ? [PDF] : IMAGE_TYPES)
  if (!verified.ok) return discard(verified.error)

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

const detailsSchema = z.object({
  title: z.string().trim().min(2, "Enter a title (at least 2 characters).").max(200, "Keep the title under 200 characters."),
  description: z.string().trim().max(1000, "Keep the description under 1,000 characters."),
})

/**
 * Renames a source and updates its admin description. Metadata only: the file, its
 * analysis, its sections (and their status, pages and citations) are not touched.
 * Citations name the source by its current title, so they show the new title.
 */
export async function updateSourceDetails(id: string, input: z.input<typeof detailsSchema>): Promise<SourceActionResult> {
  await requireAdmin()
  const parsed = detailsSchema.safeParse(input)
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid source." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the source details." }
  const { title, description } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.from("documents").update({ title, description: description || null }).eq("id", id).select("id").maybeSingle()
  if (error) return { ok: false, error: "The source details could not be saved. Please try again." }
  if (!data) return { ok: false, error: "This source no longer exists. Refresh the page." }
  revalidate(id)
  return { ok: true }
}
