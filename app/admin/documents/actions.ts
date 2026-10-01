"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { type IngestResult, ingestDocument } from "@/lib/rag/ingest"
import { createClient } from "@/lib/supabase/server"

const MAX_PDF_BYTES = 25 * 1024 * 1024

const registerSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  visibility: z.enum(["public", "authenticated"]),
  filePath: z.string().regex(/^handbook\/[0-9a-f-]{36}\.pdf$/, "Invalid upload path."),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_PDF_BYTES, "PDFs can be up to 25 MB."),
})

function revalidate() {
  revalidatePath("/admin/documents")
  revalidatePath("/admin")
}

/**
 * Called after the browser has uploaded the PDF to the private `documents`
 * bucket: creates the documents record and extracts + chunks its text.
 */
export async function registerHandbook(input: z.input<typeof registerSchema>): Promise<IngestResult> {
  await requireAdmin()
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload." }
  const { title, visibility, filePath, fileName, fileSize } = parsed.data

  const supabase = await createClient()
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title,
      visibility,
      document_type: "handbook",
      file_path: filePath,
      file_name: fileName,
      mime_type: "application/pdf",
      file_size: fileSize,
      status: "uploaded",
    })
    .select("id")
    .single()
  if (error || !doc) {
    await supabase.storage.from("documents").remove([filePath])
    return { ok: false, error: "The document could not be registered. Please try again." }
  }

  const result = await ingestDocument(doc.id)
  revalidate()
  return result
}

export async function reprocessDocument(id: string) {
  await requireAdmin()
  await ingestDocument(id)
  revalidate()
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
