import { BookOpen, ChevronRight } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import type { GuideSummary } from "@/lib/knowledge/guides"
import { referenceLabel } from "@/lib/knowledge/topics"

// Published guides list, used by /app/guides and the public /guides.
export function GuideList({
  guides,
  failed,
  basePath,
  emptyDescription,
}: {
  guides: GuideSummary[] | null
  failed: boolean
  basePath: string
  emptyDescription: string
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="School Guides" description="Step-by-step procedures reviewed by university staff — enrollment, INC grades, clearance, graduation and more." />
      {failed ? <p role="alert" className="mt-6 text-sm text-destructive">Guides could not be loaded. Please try again.</p> : guides?.length ? <ul className="mt-6 divide-y border-y">
        {guides.map(guide => <li key={guide.id}><Link href={`${basePath}/${guide.id}`} className="flex items-start gap-4 rounded-sm py-5 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
          <div className="min-w-0 flex-1"><h2 className="font-semibold">{guide.title}</h2><p className="mt-2 line-clamp-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{guide.description}</p><p className="mt-3 text-xs text-muted-foreground">{[guide.documents?.title ?? "University guide", referenceLabel(guide.source_reference)].filter(Boolean).join(" · ")}</p></div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link></li>)}
      </ul> : <div className="mt-8"><EmptyState icon={BookOpen} title="No published guides yet." description={emptyDescription} /></div>}
    </div>
  )
}
