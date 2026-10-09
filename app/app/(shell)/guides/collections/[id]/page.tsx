import { ChevronRight, FileText } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { OTHER_GUIDES, getGuideCollection } from "@/lib/knowledge/school-guides"
import { createClient } from "@/lib/supabase/server"

// School Guides › one collection: its guides (sources with Published sections), then any
// standalone guide entries. Read-only.
export default async function GuideCollectionPage({ params }: PageProps<"/app/guides/collections/[id]">) {
  await requireProfile()
  const { id } = await params
  if (id !== OTHER_GUIDES && !z.uuid().safeParse(id).success) notFound()
  const data = await getGuideCollection(await createClient(), id)
  if (!data) notFound()
  const { collection, sources, entries } = data

  const row = "flex items-center gap-4 px-5 py-4 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/app/guides" className="font-medium text-primary hover:underline">School Guides</Link>
      </nav>
      <PageHeader title={collection.name} description={collection.description ?? undefined} />

      {sources.length === 0 && entries.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={FileText} title="No published guides here yet." description="Guides appear once the university publishes them." />
        </div>
      ) : (
        <>
          {sources.length > 0 && (
            <ul className="mt-6 divide-y overflow-hidden rounded-lg border bg-background">
              {sources.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/guides/sources/${s.id}`} className={row}>
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.title}</span>
                      {s.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{s.description}</span>}
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{s.sections} {s.sections === 1 ? "section" : "sections"}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {entries.length > 0 && (
            <section aria-labelledby="more-guides-heading" className="mt-8">
              <h2 id="more-guides-heading" className="text-sm font-semibold">More guides</h2>
              <ul className="mt-3 divide-y overflow-hidden rounded-lg border bg-background">
                {entries.map((e) => (
                  <li key={e.id}>
                    <Link href={`/app/guides/${e.id}`} className={row}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{e.title}</span>
                        {e.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{e.description}</span>}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
