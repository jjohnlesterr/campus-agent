import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { GuideEditor } from "@/components/admin/guide-editor"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { readGuideReference, pageLabel, supportsOffice } from "@/lib/knowledge/topics"
import { createClient } from "@/lib/supabase/server"

export default async function GuideEditPage({ params }: PageProps<"/admin/knowledge/[id]">) {
  await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const db = await createClient()
  const { data: guide, error } = await db.from("guidelines").select("*, documents(title, status), guideline_steps(step_number, title, description)").eq("id", id).maybeSingle()
  if (error) throw new Error("The guide could not be loaded.")
  if (!guide) notFound()
  const ref = readGuideReference(guide.source_reference)
  const [{ data: sections, error: sectionError }, { data: offices, error: officeError }] = await Promise.all([
    guide.source_document_id && ref ? db.from("document_chunks").select("id, content, page_number, chunk_index, section_title").eq("document_id", guide.source_document_id).in("id", ref.chunkIds).order("chunk_index") : Promise.resolve({ data: [], error: null }),
    db.from("offices").select("id, name, short_name").order("name"),
  ])
  if (sectionError || officeError) throw new Error("The source excerpts could not be loaded.")
  const supportedOffices = (offices ?? []).filter(o => supportsOffice(sections ?? [], o))
  return (
    <>
      <PageHeader title="Review guide" description="Verify the source excerpts, edit the draft, and publish when it is ready."><StatusBadge status={guide.status} /></PageHeader>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Guide editor" className="min-w-0 rounded-lg border bg-background p-5 sm:p-6">
          <GuideEditor key={guide.id} values={{ id: guide.id, updatedAt: guide.updated_at, title: guide.title, description: guide.description ?? "", requirements: guide.requirements,
            steps: [...guide.guideline_steps].sort((a, b) => a.step_number - b.step_number).map(s => ({ title: s.title, description: s.description ?? "" })),
            pages: ref?.pages ?? [], responsibleOfficeId: guide.responsible_office_id, status: guide.status }} offices={supportedOffices} />
        </section>
        <section aria-labelledby="evidence-heading" className="min-w-0">
          <h2 id="evidence-heading" className="font-semibold">Source excerpts</h2>
          {guide.source_document_id && <Link href={`/admin/documents/${guide.source_document_id}`} className="mt-2 inline-block text-sm font-medium text-primary underline">{guide.documents?.title ?? "Open source"}</Link>}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">These are the original stored sections. If a procedure, requirement, or office is not stated, leave it unspecified.</p>
          {sections?.length ? <ol className="mt-4 divide-y rounded-lg border bg-background">
            {sections.map(s => <li key={s.id} className="p-5">
              <p className="text-xs font-medium text-muted-foreground">{pageLabel(s.page_number ? [s.page_number] : [])}{s.section_title ? ` � ${s.section_title}` : ""}</p>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line break-words">{s.content}</p>
            </li>)}
          </ol> : <p role="alert" className="mt-4 text-sm text-destructive">The linked source sections are unavailable. This guide cannot be published.</p>}
        </section>
      </div>
    </>
  )
}
