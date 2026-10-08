import { FolderOpen, Search } from "lucide-react"
import Link from "next/link"

import { CollectionCard } from "@/components/admin/collection-card"
import { CreateCollectionButton } from "@/components/admin/collection-dialogs"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { filterCollections, summarizeCollections } from "@/lib/knowledge/collections"
import { createClient } from "@/lib/supabase/server"

// Admin → Knowledge Library: collections first. Sources (uploads and manual entries)
// are managed inside a collection (/admin/knowledge/collections/[id]).
export default async function KnowledgeLibraryPage({ searchParams }: PageProps<"/admin/knowledge">) {
  await requireAdmin()
  const params = await searchParams
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : ""
  const db = await createClient()
  // Metadata and the few columns needed for counts only; no summaries, files or section text.
  const [{ timezone }, collections, documents, sections] = await Promise.all([
    getBranding(),
    db.from("knowledge_collections").select("id, name, description, updated_at"),
    // Knowledge sources only: campus map images belong to Admin › Campus Map.
    db.from("documents").select("id, collection_id, updated_at").neq("document_type", "campus_map"),
    db.from("guidelines").select("source_document_id, collection_id, status, updated_at"),
  ])
  const loadError = !!collections.error || !!documents.error || !!sections.error

  const all = summarizeCollections(collections.data ?? [], documents.data ?? [], sections.data ?? [])
  const visible = filterCollections(all, query)

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <PageHeader title="Knowledge Library" description="Organize university knowledge into collections. Campus Agent uses Published knowledge from every collection.">
        <CreateCollectionButton />
      </PageHeader>

      {params.upload === "1" && (
        <p role="status" className="mt-5 rounded-md border bg-accent/40 px-4 py-3 text-sm">
          Open a collection, then choose <span className="font-medium">Upload PDF</span> to add a source to it.
        </p>
      )}

      {all.length > 0 && (
        <form action="/admin/knowledge" role="search" className="relative mt-5 w-full sm:max-w-xs">
          <label htmlFor="collection-search" className="sr-only">Search collections</label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="collection-search" type="search" name="q" defaultValue={query} placeholder="Search collections" className="h-9 pl-8" />
        </form>
      )}

      {loadError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">The Knowledge Library could not be loaded. Please refresh this page.</p>
      ) : visible.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Collections">
          {visible.map((collection) => (
            <li key={collection.id} className="flex">
              <CollectionCard collection={collection} timezone={timezone} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-lg border bg-background p-2">
          <EmptyState
            icon={FolderOpen}
            title={query ? "No collections match your search." : "No collections yet."}
            description={
              query
                ? "Try a different word, or clear the search to see every collection."
                : "Create a collection such as Student Handbook or Admissions, then upload PDFs or add manual entries inside it."
            }
          >
            {query && <Link href="/admin/knowledge" className={buttonVariants({ variant: "outline" })}>Clear search</Link>}
          </EmptyState>
        </div>
      )}
    </div>
  )
}
