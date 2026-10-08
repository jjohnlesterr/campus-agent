import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { ManualEntryForm } from "@/components/admin/manual-entry-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { collectionHref } from "@/lib/knowledge/collections"
import { createClient } from "@/lib/supabase/server"

// ?collection=<id> creates the entry in that collection; without it, in Uncategorized.
export default async function NewManualEntryPage({ searchParams }: PageProps<"/admin/knowledge/new">) {
  await requireAdmin()
  const { collection: param } = await searchParams
  const collectionId = typeof param === "string" && z.uuid().safeParse(param).success ? param : null
  const db = await createClient()
  const [{ data: categories, error }, { data: offices, error: officeError }, { data: collection, error: collectionError }] = await Promise.all([
    db.from("guideline_categories").select("id, name, slug").order("sort_order").order("name"),
    db.from("offices").select("id, name").order("name"),
    collectionId
      ? db.from("knowledge_collections").select("id, name").eq("id", collectionId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (error || officeError || collectionError) throw new Error("The form could not be loaded.")
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
          <li aria-current="page" className="font-medium text-foreground">Create manually</li>
        </ol>
      </nav>
      <PageHeader title="Create knowledge entry" description={`Add verified information that isn’t in an uploaded file. It is added to ${collection ? `“${collection.name}”` : "Uncategorized"}.`} />
      <div className="mt-6 max-w-3xl rounded-lg border bg-background p-5 sm:p-6">
        <ManualEntryForm
          categories={categories ?? []}
          offices={offices ?? []}
          defaultCategoryId={categories?.find((c) => c.slug === "general-information")?.id}
          collectionId={collection?.id ?? null}
          cancelHref={backHref}
        />
      </div>
    </>
  )
}
