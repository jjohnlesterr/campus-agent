import "server-only"
import { createHash } from "node:crypto"
import type { createClient } from "@/lib/supabase/server"
import { type GuideTopic, groupSourceSections, readGuideReference, supportsOffice, topicKey, topicReference } from "@/lib/knowledge/topics"

type Client = Awaited<ReturnType<typeof createClient>>
export type GenerationResult =
  | {
      ok: true; created: number; skipped: number; topics: GuideTopic[]; createdSections: { id: string; topic: string }[]
      /** Re-analysis: Draft sections whose topic is no longer in the PDF (archived, not deleted). */
      archivedStale: number
      /** Re-analysis: Published sections whose topic is no longer in the PDF (left live for review). */
      stalePublished: number
    }
  | { ok: false; error: string; created?: number }

export async function createDraftGuides(db: Client, documentId: string): Promise<GenerationResult> {
  const { data: source, error: sourceError } = await db.from("documents").select("id, status, mime_type, visibility").eq("id", documentId).single()
  if (sourceError || !source) return { ok: false, error: "The source could not be loaded." }
  if (source.status !== "ready" || source.mime_type !== "application/pdf") return { ok: false, error: "Choose a Ready PDF with extracted text." }
  // No Storage download, PDF parser, ingestion, embeddings, or Claude call here.
  const [{ data: sections, error: sectionError }, { data: existing, error: existingError }, { data: offices, error: officeError }] = await Promise.all([
    db.from("document_chunks").select("id, chunk_index, page_number, section_title, content").eq("document_id", documentId).order("chunk_index"),
    db.from("guidelines").select("id, title, slug, status, source_reference, source_order").eq("source_document_id", documentId),
    db.from("offices").select("id, name, short_name"),
  ])
  if (sectionError || existingError || officeError) return { ok: false, error: "The extracted sections or existing guides could not be loaded. No guides were changed." }
  const topics = groupSourceSections(sections ?? [])
  if (!topics.length) return { ok: false, error: "No titled sections were found. This source needs clearly labelled topics before guides can be generated." }
  // Position of each topic in the PDF (1 = first heading). Topics come out of
  // groupSourceSections in chunk order, so this is the document's own sequence.
  const order = new Map(topics.map((topic, index) => [topic.key, index + 1]))
  const synced = await syncExistingSections(db, documentId, existing ?? [], order)
  if (!synced.ok) return { ok: false, error: synced.error }
  const { archivedStale, stalePublished } = synced
  const keys = new Set((existing ?? []).map(g => readGuideReference(g.source_reference)?.topic ?? topicKey(g.title)))
  const candidates = topics.filter(t => !keys.has(t.key))
  if (!candidates.length) return { ok: true, created: 0, skipped: topics.length, topics, createdSections: [], archivedStale, stalePublished }
  // The existing category table is required by guidelines; seed only this neutral category.
  const { error: categoryError } = await db.from("guideline_categories").upsert({ name: "Source guides", slug: "source-guides" }, { onConflict: "slug", ignoreDuplicates: true })
  if (categoryError) return { ok: false, error: "The guide category could not be prepared." }
  const { data: category, error: categoryReadError } = await db.from("guideline_categories").select("id").eq("slug", "source-guides").single()
  if (categoryReadError || !category) return { ok: false, error: "The guide category could not be loaded." }
  const rows = candidates.map(topic => {
    const supportedOffices = (offices ?? []).filter(office => supportsOffice(topic.sections, office))
    return {
      title: topic.title, description: topic.description, requirements: topic.requirements,
      // Verbatim extracted text: what Campus Agent answers from once the section is Published.
      content: topic.sections.map(s => s.content).join("\n\n"),
      slug: generatedSlug(documentId, topic.key), source_order: order.get(topic.key)!,
      category_id: category.id, source_document_id: documentId, source_reference: JSON.stringify(topicReference(topic)),
      responsible_office_id: supportedOffices.length === 1 ? supportedOffices[0].id : null,
      status: "draft" as const, visibility: source.visibility,
    }
  })
  // Stable slug + existing unique constraint handles simultaneous generation too.
  // ignoreDuplicates never updates manually reviewed or published guides.
  const { data: created, error: insertError } = await db.from("guidelines").upsert(rows, { onConflict: "slug", ignoreDuplicates: true }).select("id, source_reference")
  if (insertError) return { ok: false, error: "Draft guides could not be saved. Try again; existing guides will be skipped." }
  const steps = (created ?? []).flatMap(guide => {
    const key = readGuideReference(guide.source_reference)?.topic
    return (candidates.find(t => t.key === key)?.steps ?? []).map((step, index) => ({ guideline_id: guide.id, step_number: index + 1, ...step }))
  })
  if (steps.length) {
    const { error } = await db.from("guideline_steps").insert(steps)
    if (error) return { ok: false, created: created?.length ?? 0, error: "Drafts were saved, but their numbered steps could not be saved. Review the drafts against their source excerpts before publishing." }
  }
  const createdSections = (created ?? []).flatMap(guide => {
    const topic = readGuideReference(guide.source_reference)?.topic
    return topic ? [{ id: guide.id, topic }] : []
  })
  return { ok: true, created: created?.length ?? 0, skipped: topics.length - (created?.length ?? 0), topics, createdSections, archivedStale, stalePublished }
}

/** Stable slug of an AI-extracted section: one per source topic. */
function generatedSlug(documentId: string, key: string) {
  return `source-${documentId}-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`
}

/** AI-extracted (not admin-added) sections have exactly the generated slug shape. */
export function isGeneratedSection(slug: string, documentId: string) {
  return new RegExp(`^source-${documentId}-[0-9a-f]{24}$`).test(slug)
}

type ExistingSection = { id: string; title: string; slug: string; status: "draft" | "published" | "archived"; source_reference: string | null; source_order: number | null }

/**
 * Re-analysis keeps existing AI-extracted sections in step with the latest extraction:
 * - their source_order follows the PDF's current sequence (content is never changed);
 * - a Draft whose topic is no longer in the PDF is archived (restorable), so stale
 *   drafts do not mix into the list;
 * - a Published section whose topic is gone stays live (never silently unpublished)
 *   but loses its order and is reported for review.
 * Admin-added sections are left exactly as they are.
 */
async function syncExistingSections(db: Client, documentId: string, existing: ExistingSection[], order: Map<string, number>) {
  let archivedStale = 0
  let stalePublished = 0
  for (const section of existing.filter(s => isGeneratedSection(s.slug, documentId))) {
    const position = order.get(readGuideReference(section.source_reference)?.topic ?? topicKey(section.title)) ?? null
    const stale = position === null
    const changes = {
      ...(section.source_order !== position && { source_order: position }),
      ...(stale && section.status === "draft" && { status: "archived" as const }),
    }
    if (stale && section.status === "draft") archivedStale++
    if (stale && section.status === "published") stalePublished++
    if (!Object.keys(changes).length) continue
    const { error } = await db.from("guidelines").update(changes).eq("id", section.id)
    if (error) return { ok: false as const, error: "Existing sections could not be reordered. Nothing new was added; try again." }
  }
  return { ok: true as const, archivedStale, stalePublished }
}
