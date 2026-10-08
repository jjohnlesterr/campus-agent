"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { namesOffice, readGuideReference, topicKey } from "@/lib/knowledge/topics"

function revalidate(id?: string, documentId?: string | null) {
  for (const path of ["/admin/knowledge", "/admin", "/app/guides"]) revalidatePath(path)
  revalidatePath("/admin/knowledge/collections/[id]", "page")
  if (id) { revalidatePath(`/admin/knowledge/${id}`); revalidatePath(`/app/guides/${id}`) }
  if (documentId) revalidatePath(`/admin/documents/${documentId}`)
}

/** Short summary for School Guides when an entry has none: the start of its content. */
function excerpt(content: string) {
  const text = content.replace(/\s+/g, " ").trim()
  return text.length > 300 ? `${text.slice(0, 297).trimEnd()}…` : text
}

const stepSchema = z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(4000) })
const editSchema = z.object({
  id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }),
  title: z.string().trim().min(2, "Enter a title.").max(200),
  categoryId: z.uuid("Choose a category."),
  description: z.string().trim().max(1000),
  content: z.string().trim().min(1, "Add the section content.").max(20000),
  requirements: z.array(z.string().trim().min(1).max(2000)).max(100),
  steps: z.array(stepSchema).max(100),
  pages: z.array(z.number().int().positive("Use positive page numbers.")).max(200),
  referenceNote: z.string().trim().max(300),
  visibility: z.enum(["public", "authenticated"]),
  responsibleOfficeId: z.uuid().nullable(), intent: z.enum(["draft", "published"]), reviewed: z.boolean(),
})
export type GuideEditInput = z.input<typeof editSchema>
export type SaveGuideResult = { ok: true } | { ok: false; error: string }

/**
 * Saves a knowledge section (AI-extracted or manual). AI-extracted sections need
 * explicit review confirmation before publishing; nothing is published otherwise.
 */
export async function saveGuide(input: GuideEditInput): Promise<SaveGuideResult> {
  await requireAdmin()
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the section fields." }
  const values = parsed.data
  const db = await createClient()
  const { data: guide, error: guideError } = await db.from("guidelines").select("id, source_document_id, source_reference").eq("id", values.id).single()
  if (guideError || !guide) return { ok: false, error: "The section could not be loaded." }

  const fromSource = !!guide.source_document_id
  let visibility = values.visibility
  let sourceReference = values.referenceNote || null
  if (fromSource) {
    if (values.intent === "published" && !values.reviewed) return { ok: false, error: "Review the original source and confirm the section before publishing." }
    const ref = readGuideReference(guide.source_reference)
    if (!values.pages.length) return { ok: false, error: "Add at least one page reference." }
    const [{ data: source, error: sourceError }, { data: sample }] = await Promise.all([
      db.from("documents").select("status, visibility").eq("id", guide.source_document_id!).single(),
      db.from("document_chunks").select("metadata").eq("document_id", guide.source_document_id!).limit(1).maybeSingle(),
    ])
    if (sourceError || !source) return { ok: false, error: "The original source could not be verified." }
    if (values.intent === "published" && source.status === "archived") return { ok: false, error: "Restore the source before publishing its sections." }
    const pageCount = (sample?.metadata as { page_count?: number } | null)?.page_count
    if (pageCount && values.pages.some(page => page > pageCount)) return { ok: false, error: `Use page numbers from the source (1–${pageCount}).` }
    visibility = source.visibility
    sourceReference = JSON.stringify({ version: 1, topic: ref?.topic ?? values.title.toLowerCase(), chunkIds: ref?.chunkIds ?? [], pages: [...new Set(values.pages)].sort((a, b) => a - b) })
  }
  if (values.responsibleOfficeId) {
    const { data: office, error } = await db.from("offices").select("name, short_name").eq("id", values.responsibleOfficeId).single()
    if (error || !office) return { ok: false, error: "The responsible office could not be found." }
    if (fromSource && !namesOffice(values.content, office)) return { ok: false, error: "The responsible office must be named in the extracted content." }
  }

  // Stage as Draft before touching child rows: partially saved steps are never student-visible.
  // The timestamp prevents stale editors from overwriting a newer revision.
  const { data: staged, error: stageError } = await db.from("guidelines").update({ status: "draft" }).eq("id", values.id).eq("updated_at", values.updatedAt).select("id, updated_at").single()
  if (stageError || !staged) return { ok: false, error: "This section changed since you opened it, or could not be saved. Reload it before editing again." }
  const incomplete = "The save did not complete. The section remains Draft; reopen it and review it before publishing."
  if (values.steps.length) {
    const { error } = await db.from("guideline_steps").upsert(values.steps.map((step, i) => ({ guideline_id: values.id, step_number: i + 1, ...step })), { onConflict: "guideline_id,step_number" })
    if (error) { revalidate(values.id, guide.source_document_id); return { ok: false, error: incomplete } }
  }
  const { error: trimError } = await db.from("guideline_steps").delete().eq("guideline_id", values.id).gt("step_number", values.steps.length)
  if (trimError) { revalidate(values.id, guide.source_document_id); return { ok: false, error: incomplete } }
  const { data: saved, error } = await db.from("guidelines").update({
    title: values.title, category_id: values.categoryId, description: values.description || excerpt(values.content),
    content: values.content, requirements: values.requirements, responsible_office_id: values.responsibleOfficeId,
    source_reference: sourceReference, visibility, status: values.intent,
  }).eq("id", values.id).eq("updated_at", staged.updated_at).select("id").single()
  revalidate(values.id, guide.source_document_id)
  return error || !saved ? { ok: false, error: incomplete } : { ok: true }
}

export async function unpublishGuide(id: string): Promise<SaveGuideResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid section." }
  const db = await createClient()
  const { data, error } = await db.from("guidelines").update({ status: "draft" }).eq("id", id).eq("status", "published").select("id, source_document_id").single()
  revalidate(id, data?.source_document_id)
  return error || !data ? { ok: false, error: "The section could not be moved to Draft." } : { ok: true }
}

/** Archive: hidden from students and Campus Agent. Restore: back to Draft for review. */
export async function setGuideArchived(id: string, archived: boolean): Promise<SaveGuideResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid section." }
  const db = await createClient()
  let query = db.from("guidelines").update({ status: archived ? "archived" : "draft" }).eq("id", id)
  query = archived ? query.neq("status", "archived") : query.eq("status", "archived")
  const { data, error } = await query.select("id, source_document_id").single()
  revalidate(id, data?.source_document_id)
  return error || !data ? { ok: false, error: archived ? "The section could not be archived." : "The section could not be restored." } : { ok: true }
}

/** Deletes a Draft or Archived section. Published sections must be unpublished first. */
export async function deleteGuide(id: string): Promise<SaveGuideResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid section." }
  const db = await createClient()
  const { data, error } = await db.from("guidelines").delete().eq("id", id).neq("status", "published").select("id, source_document_id").maybeSingle()
  if (error) return { ok: false, error: "The section could not be deleted." }
  if (!data) return { ok: false, error: "Published sections can't be deleted. Move it to Draft first." }
  revalidate(undefined, data.source_document_id)
  return { ok: true }
}

const bulkStatusSchema = z.object({
  ids: z.array(z.uuid()).min(1),
  intent: z.enum(["draft", "published"]),
})
export type BulkGuideStatusResult = { ok: true; updated: number; skipped: number } | { ok: false; error: string }

export async function setGuideStatuses(ids: string[], intent: "draft" | "published"): Promise<BulkGuideStatusResult> {
  await requireAdmin()
  const parsed = bulkStatusSchema.safeParse({ ids, intent })
  if (!parsed.success) return { ok: false, error: "Select valid sections and a publishing action." }
  const uniqueIds = [...new Set(parsed.data.ids)]
  const db = await createClient()
  // One status-only statement. The status predicate protects mixed or stale selections.
  const { data, count, error } = await db.from("guidelines")
    .update({ status: parsed.data.intent }, { count: "exact" })
    .in("id", uniqueIds)
    .eq("status", parsed.data.intent === "published" ? "draft" : "published")
    .select("id")
  if (error) return { ok: false, error: "The publishing status could not be updated. Your selection is preserved; please try again." }
  revalidate()
  revalidatePath("/admin/knowledge/[id]", "page")
  revalidatePath("/admin/documents/[id]", "page")
  revalidatePath("/app/guides/[id]", "page")
  const updated = count ?? data?.length ?? 0
  return { ok: true, updated, skipped: uniqueIds.length - updated }
}

const manualSchema = z.object({
  title: z.string().trim().min(2, "Enter a title (at least 2 characters).").max(200),
  categoryId: z.uuid("Choose a category."),
  content: z.string().trim().min(10, "Add the content Campus Agent should use.").max(20000),
  responsibleOfficeId: z.union([z.uuid(), z.literal("")]),
  referenceNote: z.string().trim().max(300),
  visibility: z.enum(["public", "authenticated"]),
  status: z.enum(["draft", "published"]),
  // Knowledge Library collection it is created in ("" = Uncategorized).
  collectionId: z.union([z.uuid(), z.literal("")]),
})
export type ManualEntryState = { error?: string; values?: Record<string, string> }

/** Create manually: a knowledge section with no source file. */
export async function createManualEntry(_previous: ManualEntryState, formData: FormData): Promise<ManualEntryState> {
  await requireAdmin()
  const raw = Object.fromEntries(["title", "categoryId", "content", "responsibleOfficeId", "referenceNote", "visibility", "status", "collectionId"].map(key => [key, String(formData.get(key) ?? "")]))
  const parsed = manualSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the entry fields.", values: raw }
  const values = parsed.data
  const db = await createClient()
  const { data, error } = await db.from("guidelines").insert({
    title: values.title, slug: `manual-${randomUUID()}`, category_id: values.categoryId,
    description: excerpt(values.content), content: values.content,
    responsible_office_id: values.responsibleOfficeId || null, source_reference: values.referenceNote || null,
    visibility: values.visibility, status: values.status, collection_id: values.collectionId || null,
  }).select("id").single()
  if (error || !data) return { error: "The entry could not be created. Please try again.", values: raw }
  revalidate(data.id)
  redirect(`/admin/knowledge/${data.id}?created=1`)
}

// Source details page: a source's sections are listed in page order and can be edited
// in place. These actions change only a section's title, pages and text; the full
// editor (/admin/knowledge/[id]) still handles steps, requirements, category and office.

const sectionTextSchema = z.object({
  title: z.string().trim().min(2, "Enter a title (at least 2 characters).").max(200, "Use 200 characters or fewer for the title."),
  content: z.string().trim().min(1, "Add the section text.").max(20000, "Keep a section under 20,000 characters."),
  pages: z.array(z.number().int().positive("Use positive page numbers.")).max(200),
})

/** Page count recorded at extraction, when known. */
async function sourcePageCount(db: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  const { data } = await db.from("document_chunks").select("metadata").eq("document_id", documentId).limit(1).maybeSingle()
  return (data?.metadata as { page_count?: number } | null)?.page_count ?? null
}

function pagesError(pages: number[], pageCount: number | null) {
  return pageCount && pages.some((page) => page > pageCount) ? `Use page numbers from the source (1–${pageCount}).` : null
}

/**
 * Saves a section's title, pages and text. The section keeps its status: edits to a
 * Published section are used in answers once saved (the admin saving it is the review).
 */
export async function saveSectionText(input: { id: string; updatedAt: string; title: string; content: string; pages: number[] }): Promise<SaveGuideResult> {
  await requireAdmin()
  const ids = z.object({ id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }) }).safeParse(input)
  const parsed = sectionTextSchema.safeParse(input)
  if (!ids.success) return { ok: false, error: "Invalid section." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the section." }
  const { title, content, pages } = parsed.data
  const db = await createClient()
  const { data: guide, error: guideError } = await db.from("guidelines").select("source_document_id, source_reference, description").eq("id", input.id).single()
  if (guideError || !guide?.source_document_id) return { ok: false, error: "The section could not be loaded." }
  const pageProblem = pagesError(pages, await sourcePageCount(db, guide.source_document_id))
  if (pageProblem) return { ok: false, error: pageProblem }

  const ref = readGuideReference(guide.source_reference)
  const { data: saved, error } = await db.from("guidelines").update({
    title, content,
    description: guide.description?.trim() ? guide.description : excerpt(content),
    source_reference: JSON.stringify({ version: 1, topic: ref?.topic ?? topicKey(title), chunkIds: ref?.chunkIds ?? [], pages }),
  }).eq("id", input.id).eq("updated_at", input.updatedAt).select("id").maybeSingle()
  revalidate(input.id, guide.source_document_id)
  if (error) return { ok: false, error: "The section could not be saved. Please try again." }
  return saved ? { ok: true } : { ok: false, error: "This section changed since you opened it. Reload the page before editing again." }
}

/** Adds an admin-written section to a source. It starts as Draft, like AI-extracted sections. */
export async function addSourceSection(input: { documentId: string; title: string; content: string; pages: number[] }): Promise<SaveGuideResult> {
  await requireAdmin()
  const parsed = sectionTextSchema.safeParse(input)
  if (!z.uuid().safeParse(input.documentId).success) return { ok: false, error: "Invalid source." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the section." }
  const { title, content, pages } = parsed.data
  const db = await createClient()
  const { data: source, error: sourceError } = await db.from("documents").select("status, mime_type, visibility").eq("id", input.documentId).single()
  if (sourceError || !source) return { ok: false, error: "The source could not be loaded." }
  if (source.mime_type !== "application/pdf") return { ok: false, error: "Sections can only be added to PDF sources." }
  if (source.status === "archived") return { ok: false, error: "Restore the source before adding sections." }
  const pageProblem = pagesError(pages, await sourcePageCount(db, input.documentId))
  if (pageProblem) return { ok: false, error: pageProblem }

  // Same neutral category AI-extracted sections use (created by the first analysis if missing).
  const { error: categoryError } = await db.from("guideline_categories").upsert({ name: "Source guides", slug: "source-guides" }, { onConflict: "slug", ignoreDuplicates: true })
  const { data: category } = await db.from("guideline_categories").select("id").eq("slug", "source-guides").maybeSingle()
  if (categoryError || !category) return { ok: false, error: "The section could not be created. Please try again." }

  const { error } = await db.from("guidelines").insert({
    title, content, description: excerpt(content),
    slug: `source-${input.documentId}-section-${randomUUID()}`, category_id: category.id,
    source_document_id: input.documentId, visibility: source.visibility, status: "draft",
    source_reference: JSON.stringify({ version: 1, topic: topicKey(title), chunkIds: [], pages }),
  })
  revalidate(undefined, input.documentId)
  return error ? { ok: false, error: "The section could not be created. Please try again." } : { ok: true }
}
