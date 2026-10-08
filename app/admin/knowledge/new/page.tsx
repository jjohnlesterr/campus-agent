import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { TextSourceForm } from "@/components/admin/text-source-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { collectionHref } from "@/lib/knowledge/collections"
import { createClient } from "@/lib/supabase/server"

// Organize with AI runs from this page's server action: the same analysis as a PDF.
export const maxDuration = 120

// Create text source. ?collection=<id> creates it in that collection; without it, in Uncategorized.
export default async function NewTextSourcePage({ searchParams }: PageProps<"/admin/knowledge/new">) {
  await requireAdmin()
  const { collection: param } = await searchParams
  const collectionId = typeof param === "string" && z.uuid().safeParse(param).success ? param : null
  const db = await createClient()
  const { data: collection, error } = collectionId
    ? await db.from("knowledge_collections").select("id, name").eq("id", collectionId).maybeSingle()
    : { data: null, error: null }
  if (error) throw new Error("The form could not be loaded.")
  if (collectionId && !collection) notFound()
  const backHref = collectionHref(collection?.id)

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
          <li><Link href="/admin/knowledge" className="hover:text-foreground hover:underline">Knowledge Library</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li className="max-w-64 truncate"><Link href={backHref} className="hover:text-foreground hover:underline">{collection?.name ?? "Uncategorized"}</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="font-medium text-foreground">Create text source</li>
        </ol>
      </nav>
      <PageHeader title="Create text source" description={`Write or paste verified information. It is added to ${collection ? `“${collection.name}”` : "Uncategorized"} as a source, next to uploaded documents.`} />
      <div className="mt-6 max-w-3xl rounded-lg border bg-background p-5 sm:p-6">
        <TextSourceForm collectionId={collection?.id ?? null} cancelHref={backHref} />
      </div>
    </>
  )
}
