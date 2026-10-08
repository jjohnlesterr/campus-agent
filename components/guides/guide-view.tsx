import Link from "next/link"

import { PageHeader } from "@/components/shared/page-header"
import { SourceText } from "@/components/shared/source-text"
import { formatDate } from "@/lib/datetime"
import type { GuideDetail } from "@/lib/knowledge/guides"
import { referenceLabel } from "@/lib/knowledge/topics"

// One published guide, read-only. Used by /app/guides/[id] and the public /guides/[id].
export function GuideView({ guide, timezone, backHref }: { guide: GuideDetail; timezone: string; backHref: string }) {
  const steps = [...guide.guideline_steps].sort((a, b) => a.step_number - b.step_number)
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href={backHref} className="mb-5 inline-block text-sm font-medium text-primary underline">All school guides</Link>
      <PageHeader title={guide.title} description={guide.description ?? undefined} />
      {guide.requirements.length > 0 && <section className="mt-8" aria-labelledby="requirements-heading"><h2 id="requirements-heading" className="font-semibold">Requirements</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">{guide.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul></section>}
      {steps.length > 0 && <section className="mt-8" aria-labelledby="steps-heading"><h2 id="steps-heading" className="font-semibold">Steps</h2><ol className="mt-3 list-decimal space-y-4 pl-5">{steps.map(step => <li key={step.step_number} className="pl-1 text-sm leading-relaxed"><p className="font-medium">{step.title}</p>{step.description && <p className="mt-1 whitespace-pre-line text-muted-foreground">{step.description}</p>}</li>)}</ol></section>}
      {guide.content && (steps.length > 0 || guide.requirements.length > 0
        ? <details className="mt-8 rounded-md border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Full official text</summary><SourceText text={guide.content} className="mt-3 text-sm leading-relaxed text-muted-foreground" /></details>
        : <section className="mt-8" aria-labelledby="details-heading"><h2 id="details-heading" className="font-semibold">Details</h2><SourceText text={guide.content} className="mt-3 text-sm leading-relaxed" /></section>)}
      {guide.offices && <p className="mt-8 text-sm"><span className="font-medium">Responsible office:</span> {guide.offices.name}</p>}
      <footer className="mt-8 border-t pt-5 text-xs leading-relaxed text-muted-foreground"><p>{[guide.documents?.title ?? "University guide", referenceLabel(guide.source_reference)].filter(Boolean).join(" · ")}</p><p className="mt-1">Updated <time dateTime={guide.updated_at}>{formatDate(guide.updated_at, timezone, { month: "long", day: "numeric", year: "numeric" })}</time></p></footer>
    </div>
  )
}
