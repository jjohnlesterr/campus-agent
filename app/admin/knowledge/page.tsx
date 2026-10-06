import { cn } from "cn"
import { Library, PenLine, Search } from "lucide-react"
import Link from "next/link"

import { LibraryCard } from "@/components/admin/library-card"
import { SourceUploader } from "@/components/admin/source-uploader"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { LIBRARY_TABS, type LibraryEntry, type LibraryItem, buildSources, filterLibrary, libraryTab, matchesTab } from "@/lib/knowledge/library"
import { createClient } from "@/lib/supabase/server"

// Admin → Knowledge Library: sources (uploaded files) and manual entries together.
export default async function KnowledgeLibraryPage({ searchParams }: PageProps<"/admin/knowledge">) {
  await requireAdmin()
  const params = await searchParams
  const tab = libraryTab(params.tab)
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : ""
  const db = await createClient()
  const [{ timezone }, { data: documents, error: documentError }, { data: sections, error: sectionError }] = await Promise.all([
    getBranding(),
    db.from("documents").select("id, title, status, mime_type, document_type, file_path, summary, key_topics, updated_at"),
    db.from("guidelines").select("id, title, status, description, updated_at, source_document_id, guideline_categories(name)"),
  ])
  const loadError = !!documentError || !!sectionError

  const manual: LibraryEntry[] = (sections ?? []).filter((s) => !s.source_document_id).map((s) => ({
    kind: "manual", id: s.id, title: s.title, status: s.status, category: s.guideline_categories?.name ?? null,
    description: s.description, updatedAt: s.updated_at,
  }))
  const items: LibraryItem[] = [...buildSources(documents ?? [], sections ?? []), ...manual]
  const visible = filterLibrary(items, tab, query)

  // Small previews for image sources (private bucket → short-lived signed links).
  const images = (documents ?? []).filter((d) => d.mime_type.startsWith("image/") && visible.some((v) => v.id === d.id))
  const { data: signed } = images.length
    ? await db.storage.from("documents").createSignedUrls(images.map((d) => d.file_path), 60 * 60)
    : { data: [] }
  const thumbnails = new Map(images.map((d, i) => [d.id, signed?.[i]?.signedUrl ?? undefined]))

  const hrefFor = (nextTab: string) => {
    const search = new URLSearchParams()
    if (nextTab !== "all") search.set("tab", nextTab)
    if (query) search.set("q", query)
    return `/admin/knowledge${search.size ? `?${search}` : ""}`
  }

  return (
    <div data-layout="wide" className="w-full min-w-0">
      <PageHeader title="Knowledge Library" description="Manage university sources and knowledge entries that power Campus Agent.">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/knowledge/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <PenLine aria-hidden="true" />
            Create manually
          </Link>
          <SourceUploader defaultOpen={params.upload === "1"} />
        </div>
      </PageHeader>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter the library" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
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
        <form action="/admin/knowledge" role="search" className="relative w-full lg:w-72">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <label htmlFor="library-search" className="sr-only">Search sources and entries</label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="library-search" type="search" name="q" defaultValue={query} placeholder="Search sources / entries" className="h-9 pl-8" />
        </form>
      </div>

      {loadError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">The Knowledge Library could not be loaded. Please refresh this page.</p>
      ) : visible.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Sources and entries">
          {visible.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex">
              <LibraryCard item={item} timezone={timezone} thumbnailUrl={thumbnails.get(item.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-lg border bg-background p-2">
          <EmptyState
            icon={Library}
            title={query ? "Nothing matches your search." : items.length ? "Nothing here yet." : "The Knowledge Library is empty."}
            description={
              query
                ? "Try a different word, or clear the search to see everything."
                : "Upload a PDF to analyze it into knowledge sections, or create an entry manually. Only Published knowledge is used by Campus Agent."
            }
          >
            {query && <Link href={tab === "all" ? "/admin/knowledge" : `/admin/knowledge?tab=${tab}`} className={buttonVariants({ variant: "outline" })}>Clear search</Link>}
          </EmptyState>
        </div>
      )}
    </div>
  )
}
