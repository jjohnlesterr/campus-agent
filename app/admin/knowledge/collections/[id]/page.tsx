import { cn } from "cn"
import { ChevronRight, Library, PenLine, Search } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CollectionMenu, LibraryCardMenu } from "@/components/admin/collection-dialogs"
import { LibraryCard } from "@/components/admin/library-card"
import { SourceUploader } from "@/components/admin/source-uploader"
import { EmptyState } from "@/components/shared/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { UNCATEGORIZED, collectionHref, parseCollectionId } from "@/lib/knowledge/collections"
import { LIBRARY_TABS, type LibraryEntry, type LibraryItem, buildSources, filterLibrary, libraryTab, matchesTab } from "@/lib/knowledge/library"
import { createClient } from "@/lib/supabase/server"

// Knowledge Library → one collection: its uploaded sources and manual entries together.
// "uncategorized" lists sources that are not in a collection yet.
export default async function CollectionPage({ params, searchParams }: PageProps<"/admin/knowledge/collections/[id]">) {
  await requireAdmin()
  const id = parseCollectionId((await params).id)
  if (!id) notFound()
  const uncategorized = id === UNCATEGORIZED
  const search = await searchParams
  const tab = libraryTab(search.tab)
  const query = typeof search.q === "string" ? search.q.slice(0, 100) : ""
  const db = await createClient()

  let documentQuery = db.from("documents")
    .select("id, title, status, mime_type, document_type, file_path, summary, key_topics, updated_at, collection_id")
    .neq("document_type", "campus_map")
  let entryQuery = db.from("guidelines")
    .select("id, title, status, description, updated_at, source_document_id, collection_id, guideline_categories(name)")
    .is("source_document_id", null)
  documentQuery = uncategorized ? documentQuery.is("collection_id", null) : documentQuery.eq("collection_id", id)
  entryQuery = uncategorized ? entryQuery.is("collection_id", null) : entryQuery.eq("collection_id", id)

  const [{ timezone }, collection, collections, documents, entries] = await Promise.all([
    getBranding(),
    uncategorized
      ? Promise.resolve({ data: null, error: null })
      : db.from("knowledge_collections").select("id, name, description").eq("id", id).maybeSingle(),
    db.from("knowledge_collections").select("id, name").order("name"),
    documentQuery,
    entryQuery,
  ])
  if (collection.error) throw new Error("The collection could not be loaded.")
  if (!uncategorized && !collection.data) notFound()

  // Section statuses for these sources only (for counts; no section text).
  const documentIds = (documents.data ?? []).map((d) => d.id)
  const sections = documentIds.length
    ? await db.from("guidelines").select("source_document_id, status, updated_at").in("source_document_id", documentIds)
    : { data: [], error: null }
  const loadError = !!documents.error || !!entries.error || !!sections.error || !!collections.error

  const manual: LibraryEntry[] = (entries.data ?? []).map((s) => ({
    kind: "manual", id: s.id, title: s.title, status: s.status, category: s.guideline_categories?.name ?? null,
    description: s.description, updatedAt: s.updated_at,
  }))
  const items: LibraryItem[] = [...buildSources(documents.data ?? [], sections.data ?? []), ...manual]
  const visible = filterLibrary(items, tab, query)

  // Small previews for image sources (private bucket → short-lived signed links).
  const images = (documents.data ?? []).filter((d) => d.mime_type.startsWith("image/") && visible.some((v) => v.id === d.id))
  const { data: signed } = images.length
    ? await db.storage.from("documents").createSignedUrls(images.map((d) => d.file_path), 60 * 60)
    : { data: [] }
  const thumbnails = new Map(images.map((d, i) => [d.id, signed?.[i]?.signedUrl ?? undefined]))

  const name = collection.data?.name ?? "Uncategorized"
  const description = uncategorized
    ? "Sources that are not in a collection yet. Use the ⋯ menu on a card to move each one into a collection."
    : collection.data?.description
  const basePath = collectionHref(id)
  const hrefFor = (nextTab: string) => {
    const params = new URLSearchParams()
    if (nextTab !== "all") params.set("tab", nextTab)
    if (query) params.set("q", query)
    return `${basePath}${params.size ? `?${params}` : ""}`
  }
  const moveTargets = collections.data ?? []
  const collectionId = uncategorized ? null : id

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <li className="shrink-0"><Link href="/admin/knowledge" className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">Knowledge Library</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">{name}</li>
        </ol>
      </nav>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{name}</h1>
          {description && <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/knowledge/new${collectionId ? `?collection=${collectionId}` : ""}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            <PenLine aria-hidden="true" />
            Create manually
          </Link>
          <SourceUploader collectionId={collectionId} />
          {collection.data && <CollectionMenu collection={collection.data} sourceCount={items.length} />}
        </div>
      </header>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter sources" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
          {LIBRARY_TABS.map(({ value, label }) => {
            const count = items.filter((item) => matchesTab(item, value)).length
            return (
              <Link
                key={value}
                href={hrefFor(value)}
                aria-current={tab === value ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
                <span className="text-xs tabular-nums opacity-70">{count}</span>
              </Link>
            )
          })}
        </nav>
        <form action={basePath} role="search" className="relative w-full lg:w-72">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <label htmlFor="library-search" className="sr-only">Search sources in this collection</label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="library-search" type="search" name="q" defaultValue={query} placeholder="Search sources / entries" className="h-9 pl-8" />
        </form>
      </div>

      {loadError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">This collection could not be loaded. Please refresh this page.</p>
      ) : visible.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Sources and entries">
          {visible.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex">
              <LibraryCard
                item={item}
                timezone={timezone}
                thumbnailUrl={thumbnails.get(item.id)}
                menu={<LibraryCardMenu kind={item.kind} id={item.id} title={item.title} currentCollectionId={collectionId} collections={moveTargets} />}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-lg border bg-background p-2">
          <EmptyState
            icon={Library}
            title={query ? "Nothing matches your search." : items.length ? "Nothing here yet." : "This collection is empty."}
            description={
              query
                ? "Try a different word, or clear the search to see everything in this collection."
                : "Upload a PDF to analyze it into knowledge sections, or create an entry manually. Only Published knowledge is used by Campus Agent."
            }
          >
            {query && <Link href={tab === "all" ? basePath : `${basePath}?tab=${tab}`} className={buttonVariants({ variant: "outline" })}>Clear search</Link>}
          </EmptyState>
        </div>
      )}
    </div>
  )
}
