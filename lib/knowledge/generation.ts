import "server-only"
import { createHash } from "node:crypto"
import type { createClient } from "@/lib/supabase/server"
import { isAnalyzable } from "@/lib/sources"
import type { ProposedTable } from "@/lib/knowledge/tables"
import { type GuideTopic, type OutlineEntry, type SourceLine, groupSourceSections, readGuideReference, supportsOffice, topicKey, topicReference, topicsFromOutline } from "@/lib/knowledge/topics"

type Client = Awaited<ReturnType<typeof createClient>>
export type GenerationResult =
  | {
      ok: true; created: number; skipped: number; topics: GuideTopic[]; createdSections: { id: string; topic: string }[]
      /** Re-analysis: unedited AI Draft sections whose text was replaced by the new analysis. */
      refreshed: number
      /** True when sections follow the AI outline of the source; false for heading-based grouping. */
      outlined: boolean
      /** Sections with a table kept as source text because it could not be rebuilt faithfully. */
      tableReviews: number
      /** Re-analysis: unedited AI Drafts whose topic is no longer in the PDF (archived, not deleted). */
      archivedStale: number
      /** Re-analysis: admin-edited Drafts whose topic is no longer in the PDF (kept as they are, for review). */
      staleEdited: number
      /** Re-analysis: Published sections whose topic is no longer in the PDF (left live for review). */
      stalePublished: number
    }
  | { ok: false; error: string; created?: number }

/** The source text and AI outline from Analyze with AI; without it, chunks are grouped by heading. */
export type SourceOutline = { lines: SourceLine[]; entries: OutlineEntry[]; tables: ProposedTable[] }

/** Fingerprint of a generated section's title and text; any admin edit changes or drops it. */
export function generatedHash(title: string, content: string) {
  return createHash("sha256").update(`${title}\u0000${content}`).digest("hex").slice(0, 32)
}

/** True while an AI-extracted section still has exactly the title and text analysis gave it. */
function isUnedited(section: { title: string; content: string | null; source_reference: string | null }) {
  const hash = readGuideReference(section.source_reference)?.contentHash
  return !!hash && hash === generatedHash(section.title, section.content ?? "")
}

export async function createDraftGuides(db: Client, documentId: string, outline: SourceOutline | null = null): Promise<GenerationResult> {
  const { data: source, error: sourceError } = await db.from("documents").select("id, status, mime_type, visibility").eq("id", documentId).single()
  if (sourceError || !source) return { ok: false, error: "The source could not be loaded." }
  if (source.status !== "ready" || !isAnalyzable(source.mime_type)) return { ok: false, error: "Choose a Ready PDF or text source with extracted text." }
  // No Storage download, PDF parser, ingestion, embeddings, or Claude call here.
  const [{ data: sections, error: sectionError }, { data: existing, error: existingError }, { data: offices, error: officeError }] = await Promise.all([
    db.from("document_chunks").select("id, chunk_index, page_number, section_title, content").eq("document_id", documentId).order("chunk_index"),
    db.from("guidelines").select("id, title, slug, status, content, source_reference, source_order, sort_order").eq("source_document_id", documentId),
    db.from("offices").select("id, name, short_name"),
  ])
  if (sectionError || existingError || officeError) return { ok: false, error: "The extracted sections or existing guides could not be loaded. No guides were changed." }
  // The source's own structure (AI outline) first; heading-based grouping as the fallback.
  const outlined = outline ? topicsFromOutline(outline.lines, outline.entries, sections ?? [], outline.tables) : []
  const topics = outlined.length ? outlined : groupSourceSections(sections ?? [])
  if (!topics.length) return { ok: false, error: "No titled sections were found. This source needs clearly labelled topics before guides can be generated." }
  // Position of each topic in the PDF (1 = first heading), in the document's own sequence.
  const order = new Map(topics.map((topic, index) => [topic.key, index + 1]))
  const synced = await syncExistingSections(db, documentId, existing ?? [], order)
  if (!synced.ok) return { ok: false, error: synced.error }
  const { archivedStale, staleEdited, stalePublished } = synced

  const rowFor = (topic: GuideTopic, categoryId: string) => {
    const supportedOffices = (offices ?? []).filter(office => supportsOffice([{ content: topic.content }], office))
    return {
      title: topic.title, description: topic.description, requirements: topic.requirements,
      // Verbatim source text: what Campus Agent answers from once the section is Published.
      content: topic.content,
      slug: generatedSlug(documentId, topic.key), source_order: order.get(topic.key)!,
      category_id: categoryId, source_document_id: documentId,
      source_reference: JSON.stringify({ ...topicReference(topic), contentHash: generatedHash(topic.title, topic.content) }),
      responsible_office_id: supportedOffices.length === 1 ? supportedOffices[0].id : null,
      status: "draft" as const, visibility: source.visibility,
    }
  }
  const stepsFor = (guidelineId: string, topic: GuideTopic) => topic.steps.map((step, index) => ({ guideline_id: guidelineId, step_number: index + 1, ...step }))

  // Existing sections by topic. An unedited AI Draft is refreshed with the new analysis;
  // edited, Published, Archived and admin-added sections are never changed or duplicated.
  const byKey = new Map((existing ?? []).map(g => [readGuideReference(g.source_reference)?.topic ?? topicKey(g.title), g]))
  const refreshable = topics.flatMap(topic => {
    const current = byKey.get(topic.key)
    return current && current.status === "draft" && isGeneratedSection(current.slug, documentId) && isUnedited(current) ? [{ topic, current }] : []
  })
  const candidates = topics.filter(t => !byKey.has(t.key))

  let categoryId: string | null = null
  if (candidates.length || refreshable.length) {
    // The existing category table is required by guidelines; seed only this neutral category.
    const { error: categoryError } = await db.from("guideline_categories").upsert({ name: "Source guides", slug: "source-guides" }, { onConflict: "slug", ignoreDuplicates: true })
    if (categoryError) return { ok: false, error: "The guide category could not be prepared." }
    const { data: category, error: categoryReadError } = await db.from("guideline_categories").select("id").eq("slug", "source-guides").single()
    if (categoryReadError || !category) return { ok: false, error: "The guide category could not be loaded." }
    categoryId = category.id
  }

  const createdSections: { id: string; topic: string }[] = []
  let refreshed = 0
  for (const { topic, current } of refreshable) {
    const row = rowFor(topic, categoryId!)
    if (current.title === row.title && current.content === row.content) continue // unchanged text
    // Category, office and summary are re-suggested by the AI enrichment that follows.
    const { error } = await db.from("guidelines").update({
      title: row.title, description: row.description, requirements: row.requirements, content: row.content,
      source_reference: row.source_reference, responsible_office_id: row.responsible_office_id,
    }).eq("id", current.id).eq("status", "draft")
    if (error) return { ok: false, error: "Draft sections could not be refreshed. Try again; edited and Published sections were not changed." }
    const { error: clearError } = await db.from("guideline_steps").delete().eq("guideline_id", current.id)
    const steps = stepsFor(current.id, topic)
    const { error: stepError } = !clearError && steps.length ? await db.from("guideline_steps").insert(steps) : { error: clearError }
    if (stepError) return { ok: false, error: "A refreshed draft's numbered steps could not be saved. Review the drafts against their source before publishing." }
    createdSections.push({ id: current.id, topic: topic.key })
    refreshed++
  }

  let created = 0
  if (candidates.length) {
    // Stable slug + existing unique constraint handles simultaneous generation too.
    // ignoreDuplicates never updates manually reviewed or published guides.
    const { data: inserted, error: insertError } = await db.from("guidelines").upsert(candidates.map(t => rowFor(t, categoryId!)), { onConflict: "slug", ignoreDuplicates: true }).select("id, source_reference")
    if (insertError) return { ok: false, error: "Draft guides could not be saved. Try again; existing guides will be skipped." }
    created = inserted?.length ?? 0
    const steps = (inserted ?? []).flatMap(guide => {
      const topic = candidates.find(t => t.key === readGuideReference(guide.source_reference)?.topic)
      return topic ? stepsFor(guide.id, topic) : []
    })
    if (steps.length) {
      const { error } = await db.from("guideline_steps").insert(steps)
      if (error) return { ok: false, created, error: "Drafts were saved, but their numbered steps could not be saved. Review the drafts against their source excerpts before publishing." }
    }
    for (const guide of inserted ?? []) {
      const topic = readGuideReference(guide.source_reference)?.topic
      if (topic) createdSections.push({ id: guide.id, topic })
    }
  }
  const placed = await placeNewSections(db, documentId, existing ?? [], createdSections.filter(c => !(existing ?? []).some(e => e.id === c.id)), order)
  if (!placed.ok) return { ok: false, created, error: placed.error }
  return { ok: true, created, refreshed, outlined: outlined.length > 0, tableReviews: topics.filter(t => t.tableReview).length, skipped: topics.length - created - refreshed, topics, createdSections, archivedStale, staleEdited, stalePublished }
}

/** Stable slug of an AI-extracted section: one per source topic. */
function generatedSlug(documentId: string, key: string) {
  return `source-${documentId}-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`
}

/** AI-extracted (not admin-added) sections have exactly the generated slug shape. */
export function isGeneratedSection(slug: string, documentId: string) {
  return new RegExp(`^source-${documentId}-[0-9a-f]{24}$`).test(slug)
}

type ExistingSection = { id: string; title: string; slug: string; status: "draft" | "published" | "archived"; content: string | null; source_reference: string | null; source_order: number | null; sort_order: number | null }

/**
 * Gives new drafts a place in the admin's section order (sort_order) that follows the
 * document's structure: each goes right after the section that comes before it in the
 * source, or before the first section that follows it. The admin's order of existing
 * sections is kept; manual sections stay where the admin put them.
 */
async function placeNewSections(db: Client, documentId: string, existing: ExistingSection[], added: { id: string; topic: string }[], order: Map<string, number>) {
  const sourcePosition = (section: ExistingSection) =>
    isGeneratedSection(section.slug, documentId) ? order.get(readGuideReference(section.source_reference)?.topic ?? topicKey(section.title)) ?? null : null
  const list: { id: string; position: number | null; sortOrder: number | null }[] = [...existing]
    .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || (a.source_order ?? Infinity) - (b.source_order ?? Infinity))
    .map(section => ({ id: section.id, position: sourcePosition(section), sortOrder: section.sort_order }))
  for (const section of [...added].sort((a, b) => (order.get(a.topic) ?? 0) - (order.get(b.topic) ?? 0))) {
    const position = order.get(section.topic) ?? Infinity
    const before = list.findLastIndex(s => s.position !== null && s.position < position)
    const after = list.findIndex(s => s.position !== null && s.position > position)
    const at = before >= 0 ? before + 1 : after >= 0 ? after : list.length
    list.splice(at, 0, { id: section.id, position, sortOrder: null })
  }
  for (const [index, section] of list.entries()) {
    if (section.sortOrder === index + 1) continue
    const { error } = await db.from("guidelines").update({ sort_order: index + 1 }).eq("id", section.id)
    if (error) return { ok: false as const, error: "Draft sections were saved, but their order could not be. Drag them into place on the source page." }
  }
  return { ok: true as const }
}

/**
 * Re-analysis keeps existing AI-extracted sections in step with the latest extraction:
 * - their source_order follows the PDF's current sequence;
 * - an unedited AI Draft whose topic is no longer in the PDF is archived (restorable), so
 *   stale drafts do not mix into the list; a Draft an admin edited is kept as it is and
 *   reported for review;
 * - a Published section whose topic is gone stays live (never silently unpublished)
 *   but loses its order and is reported for review.
 * Admin-added sections are left exactly as they are.
 */
async function syncExistingSections(db: Client, documentId: string, existing: ExistingSection[], order: Map<string, number>) {
  let archivedStale = 0
  let staleEdited = 0
  let stalePublished = 0
  for (const section of existing.filter(s => isGeneratedSection(s.slug, documentId))) {
    const position = order.get(readGuideReference(section.source_reference)?.topic ?? topicKey(section.title)) ?? null
    const stale = position === null
    const archive = stale && section.status === "draft" && isUnedited(section)
    const changes = {
      ...(section.source_order !== position && { source_order: position }),
      ...(archive && { status: "archived" as const }),
    }
    if (archive) archivedStale++
    if (stale && section.status === "draft" && !archive) staleEdited++
    if (stale && section.status === "published") stalePublished++
    if (!Object.keys(changes).length) continue
    const { error } = await db.from("guidelines").update(changes).eq("id", section.id)
    if (error) return { ok: false as const, error: "Existing sections could not be reordered. Nothing new was added; try again." }
  }
  return { ok: true as const, archivedStale, staleEdited, stalePublished }
}
