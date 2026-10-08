"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { nonEmptyCollectionMessage } from "@/lib/knowledge/collections"
import { createClient } from "@/lib/supabase/server"

// Knowledge Library collections. Organizational only: moving or grouping a source never
// changes its sections, statuses or what Campus Agent retrieves.

const collectionSchema = z.object({
  name: z.string().trim().min(2, "Enter a name (at least 2 characters).").max(100, "Use 100 characters or fewer for the name."),
  description: z.string().trim().max(500, "Keep the description under 500 characters."),
})
export type CollectionInput = z.input<typeof collectionSchema>
export type CollectionResult = { ok: true; id: string } | { ok: false; error: string }
export type CollectionActionResult = { ok: true } | { ok: false; error: string }

function revalidate(documentId?: string, entryId?: string) {
  revalidatePath("/admin/knowledge")
  revalidatePath("/admin/knowledge/collections/[id]", "page")
  if (documentId) revalidatePath(`/admin/documents/${documentId}`)
  if (entryId) revalidatePath(`/admin/knowledge/${entryId}`)
}

const duplicateName = (code?: string) => code === "23505" ? "A collection with this name already exists." : null

export async function createCollection(input: CollectionInput): Promise<CollectionResult> {
  await requireAdmin()
  const parsed = collectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the collection fields." }
  const db = await createClient()
  const { data, error } = await db.from("knowledge_collections")
    .insert({ name: parsed.data.name, description: parsed.data.description || null })
    .select("id").single()
  if (error || !data) return { ok: false, error: duplicateName(error?.code) ?? "The collection could not be created. Please try again." }
  revalidate()
  return { ok: true, id: data.id }
}

export async function updateCollection(id: string, input: CollectionInput): Promise<CollectionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid collection." }
  const parsed = collectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the collection fields." }
  const db = await createClient()
  const { data, error } = await db.from("knowledge_collections")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", id).select("id").maybeSingle()
  if (error || !data) return { ok: false, error: duplicateName(error?.code) ?? "The collection could not be saved. Please try again." }
  revalidate()
  return { ok: true, id: data.id }
}

/** Sources (uploads + manual entries) in a collection, counted without loading them. */
async function countSources(db: Awaited<ReturnType<typeof createClient>>, id: string) {
  const [documents, entries] = await Promise.all([
    db.from("documents").select("id", { count: "exact", head: true }).eq("collection_id", id),
    db.from("guidelines").select("id", { count: "exact", head: true }).eq("collection_id", id).is("source_document_id", null),
  ])
  if (documents.error || entries.error) return null
  return (documents.count ?? 0) + (entries.count ?? 0)
}

/**
 * Deletes an empty collection. Never cascades: a collection with sources is refused here,
 * and the database (on delete restrict) refuses it too if a source was added meanwhile.
 */
export async function deleteCollection(id: string): Promise<CollectionActionResult> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid collection." }
  const db = await createClient()
  const count = await countSources(db, id)
  if (count === null) return { ok: false, error: "The collection could not be checked. Please try again." }
  if (count > 0) return { ok: false, error: nonEmptyCollectionMessage(count) }
  const { data, error } = await db.from("knowledge_collections").delete().eq("id", id).select("id").maybeSingle()
  if (error?.code === "23503") {
    return { ok: false, error: nonEmptyCollectionMessage((await countSources(db, id)) ?? 1) }
  }
  if (error || !data) return { ok: false, error: "The collection could not be deleted. Please try again." }
  revalidate()
  return { ok: true }
}

const moveSchema = z.object({
  kind: z.enum(["source", "manual"]),
  id: z.uuid(),
  collectionId: z.uuid().nullable(),
})
export type MoveInput = z.input<typeof moveSchema>

/** Moves an uploaded source or a manual entry. Only collection_id changes; nothing is copied. */
export async function moveToCollection(input: MoveInput): Promise<CollectionActionResult> {
  await requireAdmin()
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Choose a valid collection." }
  const { kind, id, collectionId } = parsed.data
  const db = await createClient()
  const { data, error } = kind === "source"
    ? await db.from("documents").update({ collection_id: collectionId }).eq("id", id).neq("document_type", "campus_map").select("id").maybeSingle()
    : await db.from("guidelines").update({ collection_id: collectionId }).eq("id", id).is("source_document_id", null).select("id").maybeSingle()
  if (error?.code === "23503") return { ok: false, error: "That collection no longer exists. Refresh the page and try again." }
  if (error || !data) return { ok: false, error: "The item could not be moved. Please try again." }
  revalidate(kind === "source" ? id : undefined, kind === "manual" ? id : undefined)
  return { ok: true }
}
