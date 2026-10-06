import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { referenceLabel } from "@/lib/knowledge/topics"
import { createClient } from "@/lib/supabase/server"

export default async function StudentGuidePage({ params }: PageProps<"/app/guides/[id]">) {
  await requireProfile()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const db = await createClient()
  const [{ data: guide, error }, { timezone }] = await Promise.all([
    db.from("guidelines").select("title, description, content, requirements, source_reference, updated_at, documents(title), offices(name), guideline_steps(step_number, title, description)").eq("id", id).eq("status", "published").maybeSingle(),
    getBranding(),
  ])
  if (error) throw new Error("This guide could not be loaded.")
  if (!guide) notFound()
  const steps = [...guide.guideline_steps].sort((a, b) => a.step_number - b.step_number)
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/app/guides" className="mb-5 inline-block text-sm font-medium text-primary underline">All school guides</Link>
      <PageHeader title={guide.title} description={guide.description ?? undefined} />
      {guide.requirements.length > 0 && <section className="mt-8" aria-labelledby="requirements-heading"><h2 id="requirements-heading" className="font-semibold">Requirements</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">{guide.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul></section>}
      {steps.length > 0 && <section className="mt-8" aria-labelledby="steps-heading"><h2 id="steps-heading" className="font-semibold">Steps</h2><ol className="mt-3 list-decimal space-y-4 pl-5">{steps.map(step => <li key={step.step_number} className="pl-1 text-sm leading-relaxed"><p className="font-medium">{step.title}</p>{step.description && <p className="mt-1 whitespace-pre-line text-muted-foreground">{step.description}</p>}</li>)}</ol></section>}
      {guide.content && (steps.length > 0 || guide.requirements.length > 0
        ? <details className="mt-8 rounded-md border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Full official text</summary><p className="mt-3 text-sm leading-relaxed whitespace-pre-line break-words text-muted-foreground">{guide.content}</p></details>
        : <section className="mt-8" aria-labelledby="details-heading"><h2 id="details-heading" className="font-semibold">Details</h2><p className="mt-3 text-sm leading-relaxed whitespace-pre-line break-words">{guide.content}</p></section>)}
      {guide.offices && <p className="mt-8 text-sm"><span className="font-medium">Responsible office:</span> {guide.offices.name}</p>}
      <footer className="mt-8 border-t pt-5 text-xs leading-relaxed text-muted-foreground"><p>{guide.documents?.title ?? "University guide"} · {referenceLabel(guide.source_reference)}</p><p className="mt-1">Updated <time dateTime={guide.updated_at}>{formatDate(guide.updated_at, timezone, { month: "long", day: "numeric", year: "numeric" })}</time></p></footer>
    </div>
  )
}
