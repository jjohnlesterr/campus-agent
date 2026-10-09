import { BookOpen, ChevronRight } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { listGuideCollections } from "@/lib/knowledge/school-guides"
import { createClient } from "@/lib/supabase/server"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// School Guides: the university's published handbooks and guides, grouped as the admin
// organized them. The same Published content Campus Agent answers from.
export default async function GuidesPage() {
  await requireProfile()
  let collections: Awaited<ReturnType<typeof listGuideCollections>> | null = null
  try {
    collections = await listGuideCollections(await createClient())
  } catch {
    collections = null
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="School Guides" description="Official handbooks and university guides — the same published information Campus Agent answers from." />

      {collections === null ? (
        <p role="alert" className="mt-6 text-sm text-destructive">School guides could not be loaded. Please try again.</p>
      ) : collections.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={BookOpen} title="No published guides yet." description="Guides appear here once the university publishes them. You can still ask a question from New conversation." />
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {collections.map((c) => (
            <li key={c.id} className="flex">
              <Link
                href={`/app/guides/collections/${c.id}`}
                className="group flex w-full flex-col rounded-lg border bg-background p-5 transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
                  <BookOpen className="size-4" />
                </span>
                <h2 className="mt-3 font-semibold group-hover:text-primary">{c.name}</h2>
                {c.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{c.description}</p>}
                <span className="flex-1" />
                <span className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                  {plural(c.sources, "guide")} · {plural(c.sections, "section")}
                  <span className="flex items-center gap-0.5 font-medium text-primary">Open <ChevronRight className="size-3.5" aria-hidden="true" /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
