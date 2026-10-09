import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { PageHeader } from "@/components/shared/page-header"
import { SourceText } from "@/components/shared/source-text"
import { requireProfile } from "@/lib/auth"
import { OTHER_GUIDES, getGuideSource } from "@/lib/knowledge/school-guides"
import { referenceLabel } from "@/lib/knowledge/topics"
import { createClient } from "@/lib/supabase/server"

// School Guides › one guide (a Knowledge Library source): its Published sections as one
// readable page, in the order the admin arranged them, with page references. Read-only.
export default async function GuideSourcePage({ params }: PageProps<"/app/guides/sources/[id]">) {
  await requireProfile()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const data = await getGuideSource(await createClient(), id)
  if (!data || data.sections.length === 0) notFound()
  const { source, sections } = data
  const collection = source.knowledge_collections

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
        <Link href="/app/guides" className="font-medium text-primary hover:underline">School Guides</Link>
        <span aria-hidden="true" className="text-muted-foreground">/</span>
        <Link href={`/app/guides/collections/${collection?.id ?? OTHER_GUIDES}`} className="font-medium text-primary hover:underline">
          {collection?.name ?? "Other guides"}
        </Link>
      </nav>
      <PageHeader title={source.title} description={source.description ?? undefined} />

      {sections.length > 3 && (
        <nav aria-labelledby="contents-heading" className="mt-6 rounded-lg border bg-background px-5 py-4">
          <h2 id="contents-heading" className="text-sm font-semibold">Contents</h2>
          <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id} className="min-w-0">
                <a href={`#section-${s.id}`} className="block truncate text-muted-foreground hover:text-primary hover:underline">
                  <span className="tabular-nums">{i + 1}.</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {sections.map((s) => {
          const steps = [...s.guideline_steps].sort((a, b) => a.step_number - b.step_number)
          const reference = referenceLabel(s.source_reference)
          return (
            <article key={s.id} id={`section-${s.id}`} aria-labelledby={`heading-${s.id}`} className="scroll-mt-6 rounded-lg border bg-background px-5 py-5 sm:px-6">
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`heading-${s.id}`} className="font-semibold">{s.title}</h2>
                {reference && <p className="text-xs text-muted-foreground">{reference}</p>}
              </header>
              {s.requirements.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Requirements</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">{s.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              {steps.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Steps</h3>
                  <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                    {steps.map((step) => <li key={step.step_number}><span className="font-medium">{step.title}</span>{step.description && <span className="text-muted-foreground"> — {step.description}</span>}</li>)}
                  </ol>
                </div>
              )}
              {s.content && <SourceText text={s.content} className="mt-3 text-sm leading-relaxed" />}
              {s.offices && <p className="mt-4 text-sm"><span className="font-medium">Responsible office:</span> {s.offices.name}</p>}
            </article>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Source: {source.title}</p>
    </div>
  )
}
