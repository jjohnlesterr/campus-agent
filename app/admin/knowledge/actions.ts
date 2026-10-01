"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createDraftGuides, type GenerationResult } from "@/lib/knowledge/generation"
import { readGuideReference, supportsOffice } from "@/lib/knowledge/topics"

function revalidate(id?: string, documentId?: string) {
  for (const path of ["/admin/knowledge", "/admin", "/app/guides"]) revalidatePath(path)
  if (id) { revalidatePath(`/admin/knowledge/${id}`); revalidatePath(`/app/guides/${id}`) }
  if (documentId) revalidatePath(`/admin/documents/${documentId}`)
}

export async function generateSourceGuides(documentId: string): Promise<GenerationResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(documentId).success) return { ok: false, error: "Invalid source." }
  const result = await createDraftGuides(await createClient(), documentId)
  revalidate(undefined, documentId)
  return result
}

const editSchema = z.object({
  id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }),
  title: z.string().trim().min(2).max(200), description: z.string().trim().min(1).max(6000),
  requirements: z.array(z.string().trim().min(1).max(2000)).max(100),
  steps: z.array(z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(4000) })).max(100),
  pages: z.array(z.number().int().positive()).min(1).max(200),
  responsibleOfficeId: z.uuid().nullable(), intent: z.enum(["draft", "published"]), reviewed: z.boolean(),
})
export type GuideEditInput = z.input<typeof editSchema>
export type SaveGuideResult = { ok: true } | { ok: false; error: string }

export async function saveGuide(input: GuideEditInput): Promise<SaveGuideResult> {
  await requireAdmin()
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the guide fields." }
  const values = parsed.data
  if (values.intent === "published" && !values.reviewed) return { ok: false, error: "Review the source excerpts and confirm the guide before publishing." }
  const db = await createClient()
  const { data: guide, error: guideError } = await db.from("guidelines").select("id, source_document_id, source_reference").eq("id", values.id).single()
  if (guideError || !guide?.source_document_id) return { ok: false, error: "The guide or its original source could not be loaded." }
  const ref = readGuideReference(guide.source_reference)
  if (!ref) return { ok: false, error: "This guide has no generated source references. Generate a guide from a Ready source first." }
  const { data: source, error: sourceError } = await db.from("documents").select("status, visibility").eq("id", guide.source_document_id).single()
  const { data: sections, error: sectionError } = await db.from("document_chunks").select("id, content, section_title, chunk_index, page_number").eq("document_id", guide.source_document_id).in("id", ref.chunkIds)
  if (sourceError || sectionError || !source || !sections?.length) return { ok: false, error: "The original extracted sections could not be verified." }
  if (values.intent === "published" && source.status !== "ready") return { ok: false, error: "The source must be Ready before its guide can be published." }
  const allowedPages = new Set(sections.flatMap(s => s.page_number ? [s.page_number] : []))
  if (values.pages.some(page => !allowedPages.has(page))) return { ok: false, error: "Use page numbers from the linked source excerpts." }
  if (values.responsibleOfficeId) {
    const { data: office, error } = await db.from("offices").select("name, short_name").eq("id", values.responsibleOfficeId).single()
    if (error || !office || !supportsOffice(sections, office)) return { ok: false, error: "The responsible office must be explicitly named in the linked excerpts." }
  }
  // Stage as Draft before touching child rows: partially saved steps are never student-visible.
  // The timestamp prevents stale editors from overwriting a newer revision.
  const { data: staged, error: stageError } = await db.from("guidelines").update({ status: "draft" }).eq("id", values.id).eq("updated_at", values.updatedAt).select("id, updated_at").single()
  if (stageError || !staged) return { ok: false, error: "This guide changed since you opened it, or could not be saved. Reload it before editing again." }
  const incomplete = "The save did not complete. The guide remains Draft; reopen it and review the steps before publishing."
  if (values.steps.length) {
    const { error } = await db.from("guideline_steps").upsert(values.steps.map((step, i) => ({ guideline_id: values.id, step_number: i + 1, ...step })), { onConflict: "guideline_id,step_number" })
    if (error) { revalidate(values.id); return { ok: false, error: incomplete } }
  }
  const { error: trimError } = await db.from("guideline_steps").delete().eq("guideline_id", values.id).gt("step_number", values.steps.length)
  if (trimError) { revalidate(values.id); return { ok: false, error: incomplete } }
  const { data: saved, error } = await db.from("guidelines").update({
    title: values.title, description: values.description, requirements: values.requirements,
    responsible_office_id: values.responsibleOfficeId,
    source_reference: JSON.stringify({ ...ref, pages: [...new Set(values.pages)].sort((a, b) => a - b) }),
    visibility: source.visibility, status: values.intent,
  }).eq("id", values.id).eq("updated_at", staged.updated_at).select("id").single()
  revalidate(values.id, guide.source_document_id)
  return error || !saved ? { ok: false, error: incomplete } : { ok: true }
}

export async function unpublishGuide(id: string): Promise<SaveGuideResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid guide." }
  const db = await createClient()
  const { data, error } = await db.from("guidelines").update({ status: "draft" }).eq("id", id).select("id").single()
  revalidate(id)
  return error || !data ? { ok: false, error: "The guide could not be unpublished." } : { ok: true }
}

const bulkStatusSchema = z.object({
  ids: z.array(z.uuid()).min(1),
  intent: z.enum(["draft", "published"]),
})
export type BulkGuideStatusResult = { ok: true; updated: number; skipped: number } | { ok: false; error: string }

export async function setGuideStatuses(ids: string[], intent: "draft" | "published"): Promise<BulkGuideStatusResult> {
  await requireAdmin()
  const parsed = bulkStatusSchema.safeParse({ ids, intent })
  if (!parsed.success) return { ok: false, error: "Select valid guides and a publishing action." }
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
  revalidatePath("/app/guides/[id]", "page")
  const updated = count ?? data?.length ?? 0
  return { ok: true, updated, skipped: uniqueIds.length - updated }
}
